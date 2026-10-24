import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import test from "node:test";
import { loadConfig } from "../skills/component-catalog/scripts/lib/config.mjs";
import { auditProject } from "../skills/component-catalog/scripts/lib/audit.mjs";
import { get } from "../skills/component-catalog/scripts/lib/query.mjs";
import { loadCatalog } from "../skills/component-catalog/scripts/lib/catalog.mjs";

const cli = fileURLToPath(new URL("../bin/component-catalog.mjs", import.meta.url));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "atlas relative imports "));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, content) => {
    const absolute = path.join(root, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, typeof content === "string" ? content : JSON.stringify(content));
    return absolute;
  };
  const raw = {
    configVersion: 2, projectRoot: ".", sourceRoot: "src", tsconfig: "tsconfig.json",
    catalog: "generated/catalog.json",
    componentRoots: [{ path: "src/ui", idPrefix: "ui", importPrefix: null, layer: "shared", enrollment: "public" }],
    previewRoots: ["src/previews"], testRoots: [], exclude: [],
  };
  const compiler = {
    compilerOptions: { strict: true, target: "ES2022", module: "ESNext", moduleResolution: "Bundler" },
    include: ["src"],
  };
  const configFile = write("component-catalog.config.json", raw);
  write("tsconfig.json", compiler);
  const source = `/**
 * A labeled button.
 * @componentCatalog
 * @catalogStatus experimental
 * @catalogTask button
 * @catalogConstraint Supply label text.
 * @catalogExample preview src/previews/Button.ts | Actual relative consumer
 */
function Button({ label, disabled = false }: { label: string; disabled?: boolean }) { return { label, disabled }; }
export default Button;
`;
  write("src/ui/Button.ts", source);
  write("src/previews/Button.ts", 'import Button from "../ui/Button"; export const example = Button({ label: "Send" });');
  const run = (args, cwd = os.tmpdir()) => spawnSync(process.execPath, [cli, "--config", configFile, ...args], { cwd, encoding: "utf8" });
  return { root, write, raw, compiler, source, configFile, run, config: () => loadConfig(configFile) };
}
function ok(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}
function typecheck(f, emit = false) {
  const parsed = ts.getParsedCommandLineOfConfigFile(path.join(f.root, "tsconfig.json"),
    { noEmit: !emit, ...(emit ? { outDir: path.join(f.root, "out") } : {}) },
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => assert.fail(ts.flattenDiagnosticMessageText(d.messageText, " ")) });
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => f.root, getCanonicalFileName: (x) => x, getNewLine: () => "\n",
  }));
  return program;
}

test("relative imports work without aliases, retain context and typecheck from multiple caller locations", (t) => {
  const f = fixture(t);
  assert.deepEqual(auditProject(f.config()).issues, []);
  ok(f.run(["generate"]));
  ok(f.run(["check"]));
  const basic = ok(f.run(["get", "ui.Button"])).component;
  assert.equal(basic.importPath, null);
  assert.deepEqual(basic.importContext, { kind: "relative", from: null, extension: "omit" });
  for (const [caller, expected] of [
    ["src/features/orders/Page.ts", "../../ui/Button"],
    ["src/ui/Neighbor.ts", "./Button"],
    ["Main.ts", "./src/ui/Button"],
    ["src\\pages\\Page.tsx", "../ui/Button"],
  ]) {
    const result = ok(f.run(["get", "ui.Button", "--prop", "label", "--from", caller]));
    assert.equal(result.component.importPath, expected);
    assert.equal(result.component.exportKind, "default");
    assert.equal(result.component.importContext.from, caller.replaceAll("\\", "/"));
    assert.ok(Buffer.byteLength(JSON.stringify(result) + "\n") <= 16384);
    // Add a real consumer outside enrollment scope and check the returned specifier.
    if (caller.startsWith("src/features")) {
      f.write(caller, `import Button from ${JSON.stringify(expected)}; export const value = Button({ label: "Actual" });`);
      typecheck(f);
    }
  }
  const snapshot = path.join(f.root, f.raw.catalog);
  const before = fs.readFileSync(snapshot);
  const mtime = fs.statSync(snapshot).mtimeMs;
  // Snapshot queries remain usable offline, including for a caller not created yet.
  fs.renameSync(path.join(f.root, "src"), path.join(f.root, "sources-offline"));
  fs.renameSync(path.join(f.root, "tsconfig.json"), path.join(f.root, "tsconfig.offline"));
  assert.equal(ok(f.run(["get", "ui.Button", "--include", "usage", "--from", "src/New.tsx"])).component.importPath, "./ui/Button");
  assert.deepEqual(fs.readFileSync(snapshot), before);
  assert.equal(fs.statSync(snapshot).mtimeMs, mtime);
});

test("relative import extension policies support NodeNext and explicit TS imports without changing IDs", (t) => {
  const f = fixture(t);
  f.compiler.compilerOptions.module = "NodeNext";
  f.compiler.compilerOptions.moduleResolution = "NodeNext";
  f.write("tsconfig.json", f.compiler);
  f.write("package.json", { type: "module" });
  f.write("src/previews/Button.ts", 'import Button from "../ui/Button.js"; export const example = Button({ label: "ESM" });');
  assert.ok(auditProject(f.config()).issues.some((i) => /catalog import.*importExtension/.test(i.message)));
  f.raw.componentRoots[0].importExtension = "js";
  f.write("component-catalog.config.json", f.raw);
  ok(f.run(["generate"]));
  const js = ok(f.run(["get", "ui.Button", "--from", "src/Consumer.ts"])).component;
  assert.equal(js.importPath, "./ui/Button.js");
  f.write("src/Consumer.ts", `import Button from ${JSON.stringify(js.importPath)}; export const value = Button({ label: "ESM" });`);
  assert.equal(typecheck(f, true).emit().emitSkipped, false);
  const executed = spawnSync(process.execPath, ["--input-type=module", "-e",
    `import { value } from ${JSON.stringify(pathToFileURL(path.join(f.root, "out/Consumer.js")).href)}; console.log(value.label);`],
    { encoding: "utf8" });
  assert.equal(executed.status, 0, executed.stderr);
  assert.equal(executed.stdout.trim(), "ESM");
  f.compiler.compilerOptions.allowImportingTsExtensions = true;
  f.write("tsconfig.json", f.compiler);
  f.raw.componentRoots[0].importExtension = "preserve";
  f.write("component-catalog.config.json", f.raw);
  assert.ok(auditProject(f.config(), { freshness: true }).issues.some((i) => i.code === "CATALOG_STALE"));
  ok(f.run(["generate"]));
  const explicit = ok(f.run(["get", "ui.Button", "--from", "src/Consumer.ts"])).component;
  assert.equal(explicit.id, js.id);
  assert.equal(explicit.importPath, "./ui/Button.ts");
  f.write("src/Consumer.ts", `import Button from ${JSON.stringify(explicit.importPath)}; export const value = Button({ label: "TS" });`);
  typecheck(f);
});

test("invented and misdirected module prefixes fail before publishing, while real aliases work", (t) => {
  const f = fixture(t);
  ok(f.run(["generate"]));
  const snapshot = fs.readFileSync(path.join(f.root, f.raw.catalog));
  f.raw.componentRoots[0].importPrefix = "@missing";
  f.write("component-catalog.config.json", f.raw);
  assert.ok(auditProject(f.config()).issues.some((i) => /catalog import @missing\/Button/.test(i.message)));
  assert.notEqual(f.run(["generate"]).status, 0);
  assert.deepEqual(fs.readFileSync(path.join(f.root, f.raw.catalog)), snapshot);
  f.compiler.compilerOptions.paths = { "@missing/*": ["./src/wrong/*"] };
  f.write("tsconfig.json", f.compiler);
  f.write("src/wrong/Button.ts", "export default function Button() { return null; }");
  assert.ok(auditProject(f.config()).issues.some((i) => /does not resolve to src\/ui/.test(i.message)));
  f.compiler.compilerOptions.paths = { "@ui/*": ["./src/ui/*"] };
  f.write("tsconfig.json", f.compiler);
  f.raw.componentRoots[0].importPrefix = "@ui";
  f.write("component-catalog.config.json", f.raw);
  ok(f.run(["generate"]));
  const item = ok(f.run(["get", "ui.Button", "--from", "src/Consumer.ts"])).component;
  assert.equal(item.importPath, "@ui/Button");
  assert.equal(item.importContext, undefined);
});

test("source package subpaths and dot-prefixed filenames produce usable imports", (t) => {
  const f = fixture(t);
  f.raw.componentRoots[0].importPrefix = "@sample/design";
  f.write("component-catalog.config.json", f.raw);
  f.write("package.json", { name: "@sample/design", type: "module", exports: { "./*": "./src/ui/*.ts" } });
  ok(f.run(["generate"]));
  assert.equal(ok(f.run(["get", "ui.Button"])).component.importPath, "@sample/design/Button");
  f.raw.componentRoots[0].importPrefix = null;
  f.write("component-catalog.config.json", f.raw);
  fs.renameSync(path.join(f.root, "src/ui/Button.ts"), path.join(f.root, "src/ui/.Button.ts"));
  f.write("src/previews/Button.ts", 'import Button from "../ui/.Button"; export const example = Button({ label: "Dot" });');
  ok(f.run(["generate"]));
  const specifier = ok(f.run(["get", "ui.Button", "--from", "src/ui/Neighbor.ts"])).component.importPath;
  assert.equal(specifier, "./.Button");
  f.write("src/ui/Neighbor.ts", `import Button from ${JSON.stringify(specifier)}; const example = Button({ label: "Dot" });`);
  typecheck(f);
});

test("caller validation, bounded context and legacy snapshots remain unambiguous", (t) => {
  const f = fixture(t);
  ok(f.run(["generate"]));
  for (const from of ["", "../Outside.tsx", "/tmp/Outside.tsx", "C:\\Outside.tsx", "src/", "src/types.d.ts", "src/ui/Button.ts"]) {
    const result = f.run(["get", "ui.Button", "--from", from]);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /--from/);
  }
  for (const args of [["search", "Button", "--from", "src/Page.tsx"], ["get", "ui.Button", "--from"],
    ["get", "ui.Button", "--from", "src/Page.tsx", "--from", "src/Page.tsx"]])
    assert.notEqual(f.run(args).status, 0);
  f.raw.componentRoots[0].importExtension = "auto";
  f.write("component-catalog.config.json", f.raw);
  assert.throws(f.config, /importExtension/);
  const catalogFile = path.join(f.root, "generated/catalog.json");
  const current = loadCatalog(catalogFile);
  current.components[0].summary = "长".repeat(15000);
  const bounded = get(current, "ui.Button", undefined, undefined, "src/Page.tsx");
  assert.ok(Buffer.byteLength(JSON.stringify(bounded) + "\n") <= 16384);
  assert.equal(bounded.component.importPath, "./ui/Button");
  assert.equal(bounded.component.importContext.from, "src/Page.tsx");
  const legacy = structuredClone(current);
  legacy.schemaVersion = 6;
  for (const entry of legacy.components) delete entry.importExtension;
  f.write("legacy.json", legacy);
  assert.throws(() => loadCatalog(path.join(f.root, "legacy.json")), /Invalid catalog/);
  legacy.components[0].importPath = "@ui/Button";
  f.write("legacy.json", legacy);
  assert.equal(get(loadCatalog(path.join(f.root, "legacy.json")), "ui.Button").component.importPath, "@ui/Button");
});

test("JSX import extensions follow emitted files for preserve and transform modes", (t) => {
  for (const [extension, jsx, moduleType, suffix] of [
    ["tsx", "preserve", "commonjs", "jsx"],
    ["jsx", "react", "module", "js"],
  ]) {
    const f = fixture(t);
    fs.renameSync(path.join(f.root, "src/ui/Button.ts"), path.join(f.root, `src/ui/Button.${extension}`));
    if (extension === "jsx") f.write("src/ui/Button.jsx", f.source.replace(": { label: string; disabled?: boolean }", ""));
    Object.assign(f.compiler.compilerOptions, { module: "NodeNext", moduleResolution: "NodeNext", jsx, allowJs: true });
    f.write("tsconfig.json", f.compiler);
    f.write("package.json", { type: moduleType });
    f.raw.componentRoots[0].importExtension = "js";
    f.write("component-catalog.config.json", f.raw);
    f.write("src/previews/Button.ts", `import Button from "../ui/Button.${suffix}"; export const example = Button({ label: "Emitted" });`);
    const audit = auditProject(f.config());
    assert.deepEqual(audit.issues, []);
    const component = get(audit.catalog, "ui.Button", undefined, undefined, "src/Consumer.ts").component;
    assert.equal(component.importPath, `./ui/Button.${suffix}`);
    f.write("src/Consumer.ts", `import Button from ${JSON.stringify(component.importPath)}; console.log(Button({ label: "Emitted" }).label);`);
    assert.equal(typecheck(f, true).emit().emitSkipped, false);
    assert.ok(fs.existsSync(path.join(f.root, `out/ui/Button.${suffix}`)));
    const result = spawnSync(process.execPath, [path.join(f.root, "out/Consumer.js")], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "Emitted");
  }
});

test("suggested module imports accept forwarding aliases and package subpaths", (t) => {
  for (const prefix of ["@ui", "#ui"]) {
    const f = fixture(t);
    f.raw.componentRoots[0].importPrefix = prefix;
    f.write("component-catalog.config.json", f.raw);
    f.write("src/public/Button.ts", 'export { default } from "../ui/Button.js";');
    f.write("src/previews/Button.ts", `import Button from "${prefix}/Button"; export const example = Button({ label: "Forwarded" });`);
    if (prefix === "@ui") f.compiler.compilerOptions.paths = { "@ui/*": ["./src/public/*"] };
    else {
      Object.assign(f.compiler.compilerOptions, { module: "NodeNext", moduleResolution: "NodeNext", rootDir: "src", outDir: "out" });
      f.write("package.json", { type: "commonjs", imports: { "#ui/*": "./out/public/*.js" } });
    }
    f.write("tsconfig.json", f.compiler);
    assert.deepEqual(auditProject(f.config()).issues, []);
    typecheck(f);
    if (prefix === "#ui") {
      typecheck(f, true).emit();
      const result = spawnSync(process.execPath, [path.join(f.root, "out/previews/Button.js")], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    }
  }
});

test("NodeNext dynamic imports use import conditions from CommonJS examples", (t) => {
  const f = fixture(t);
  f.write("src/ui/Button.ts", f.source.replace("function Button(", "export function Button(").replace("export default Button;", ""));
  f.raw.componentRoots[0].importPrefix = "#ui";
  f.write("component-catalog.config.json", f.raw);
  Object.assign(f.compiler.compilerOptions, { module: "NodeNext", moduleResolution: "NodeNext", rootDir: "src", outDir: "out" });
  f.write("tsconfig.json", f.compiler);
  f.write("package.json", { type: "commonjs", imports: { "#ui/*": { import: "./out/ui/*.js" } } });
  f.write("src/previews/Button.ts", 'export async function example() { return (await import("#ui/Button")).Button({ label: "Dynamic" }); }');
  const audit = auditProject(f.config());
  assert.deepEqual(audit.issues, []);
  assert.equal(get(audit.catalog, "ui.Button").component.importPath, "#ui/Button");
  typecheck(f, true).emit();
  const result = spawnSync(process.execPath, ["-e", `require(${JSON.stringify(path.join(f.root, "out/previews/Button.js"))}).example().then(value => console.log(value.label));`], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "Dynamic");
});

test("preserved TS suffixes require compiler support before suggesting new imports", (t) => {
  const f = fixture(t);
  f.raw.componentRoots[0].importExtension = "preserve";
  f.write("component-catalog.config.json", f.raw);
  assert.ok(auditProject(f.config()).issues.some((issue) => /requires allowImportingTsExtensions/.test(issue.message)));
  f.compiler.compilerOptions.rewriteRelativeImportExtensions = true;
  f.write("tsconfig.json", f.compiler);
  const audit = auditProject(f.config());
  assert.deepEqual(audit.issues, []);
  const specifier = get(audit.catalog, "ui.Button", undefined, undefined, "src/Consumer.ts").component.importPath;
  f.write("src/Consumer.ts", `import Button from ${JSON.stringify(specifier)}; console.log(Button({ label: "Rewritten" }).label);`);
  f.compiler.compilerOptions.module = "CommonJS";
  f.compiler.compilerOptions.moduleResolution = "Node";
  f.write("tsconfig.json", f.compiler);
  typecheck(f, true).emit();
  const result = spawnSync(process.execPath, [path.join(f.root, "out/Consumer.js")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "Rewritten");
  f.raw.componentRoots[0].importPrefix = "@ui";
  f.compiler.compilerOptions.paths = { "@ui/*": ["./src/ui/*"] };
  f.write("component-catalog.config.json", f.raw);
  f.write("tsconfig.json", f.compiler);
  assert.ok(auditProject(f.config()).issues.some((issue) => /requires allowImportingTsExtensions/.test(issue.message)));
});

test("unused package facades outside sourceRoot can be validated without expanding enrollment", (t) => {
  const f = fixture(t);
  f.raw.componentRoots[0].importPrefix = "#ui";
  f.write("component-catalog.config.json", f.raw);
  Object.assign(f.compiler.compilerOptions, { module: "NodeNext", moduleResolution: "NodeNext", rootDir: ".", outDir: "out" });
  f.write("tsconfig.json", f.compiler);
  f.write("package.json", { type: "commonjs", imports: { "#ui/*": "./out/public/*.js" } });
  const facade = f.write("public/Button.ts", 'export { default } from "../src/ui/Button.js";');
  const before = fs.readFileSync(facade);
  const audit = auditProject(f.config());
  assert.deepEqual(audit.issues, []);
  assert.equal(audit.catalog.components.length, 1);
  assert.equal(audit.catalog.components[0].sourcePath, "src/ui/Button.ts");
  const specifier = get(audit.catalog, "ui.Button").component.importPath;
  assert.equal(specifier, "#ui/Button");
  assert.deepEqual(fs.readFileSync(facade), before);
  assert.equal(fs.existsSync(path.join(f.root, "out")), false);
  f.write("src/Consumer.ts", `import Button from ${JSON.stringify(specifier)}; console.log(Button({ label: "Public" }).label);`);
  typecheck(f, true).emit();
  const result = spawnSync(process.execPath, [path.join(f.root, "out/src/Consumer.js")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "Public");
});

test("forwarding chains reject ambiguous stars but allow an explicit source selection", (t) => {
  const f = fixture(t);
  f.write("src/ui/Button.ts", f.source.replace("function Button(", "export function Button(").replace("export default Button;", ""));
  f.write("src/previews/Button.ts", 'import { Button } from "../ui/Button.js"; export const example = Button({ label: "Direct" });');
  f.raw.componentRoots[0].importPrefix = "#ui";
  f.write("component-catalog.config.json", f.raw);
  Object.assign(f.compiler.compilerOptions, { module: "NodeNext", moduleResolution: "NodeNext", rootDir: "src", outDir: "out", allowJs: true, checkJs: false });
  f.write("tsconfig.json", f.compiler);
  f.write("package.json", { type: "module", imports: { "#ui/*": "./out/public/*.js" } });
  f.write("src/other.js", "export function Button() { return 'Wrong'; }");
  f.write("src/barrel.js", 'export * from "./ui/Button.js"; export * from "./other.js";');
  for (const forwarding of [
    'export { Button } from "../barrel.js";',
    'import { Button as Chosen } from "../barrel.js"; export { Chosen as Button };',
  ]) {
    f.write("src/public/Button.js", forwarding);
    // checkJs:false suppresses the JS ambiguity diagnostic, so identity checks must detect it.
    typecheck(f);
    assert.ok(auditProject(f.config()).issues.some((issue) => /catalog import #ui\/Button/.test(issue.message)));
  }
  f.write("src/public/Button.js", 'export * from "../barrel.js"; export { Button } from "../ui/Button.js";');
  assert.deepEqual(auditProject(f.config()).issues, []);
  f.write("src/Consumer.ts", 'import { Button } from "#ui/Button"; console.log(Button({ label: "Selected" }).label);');
  typecheck(f, true).emit();
  const result = spawnSync(process.execPath, [path.join(f.root, "out/Consumer.js")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "Selected");
});
