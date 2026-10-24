import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadConfig } from "../skills/component-catalog/scripts/lib/config.mjs";
import { auditProject } from "../skills/component-catalog/scripts/lib/audit.mjs";
import { scan } from "../skills/component-catalog/scripts/lib/scan.mjs";
import { loadCatalog } from "../skills/component-catalog/scripts/lib/catalog.mjs";

const cli = fileURLToPath(new URL("../bin/component-catalog.mjs", import.meta.url));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-javascript-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, content) => {
    const absolute = path.join(root, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, typeof content === "string" ? content : JSON.stringify(content));
    return absolute;
  };
  const config = {
    configVersion: 2, projectRoot: ".", sourceRoot: "src", tsconfig: "jsconfig.json",
    catalog: "generated/catalog.json",
    componentRoots: [{ path: "src/ui", idPrefix: "ui", importPrefix: "@ui", layer: "shared", enrollment: "public" }],
    previewRoots: ["src/previews"], testRoots: [], exclude: [],
  };
  const compiler = {
    compilerOptions: {
      strict: true, checkJs: true, jsx: "preserve", module: "ESNext",
      moduleResolution: "Bundler", target: "ES2022", paths: { "@ui/*": ["./src/ui/*"] },
    },
    include: ["src"],
  };
  const configFile = write("component-catalog.config.json", config);
  write("jsconfig.json", compiler);
  write("src/jsx.d.ts", `declare namespace JSX {
    interface IntrinsicElements { button: { children?: unknown; disabled?: boolean }; span: { children?: unknown } }
  }`);
  const metadata = (name, example, extra = "") => `/**
 * Display ${name} to the user.
 * @componentCatalog
 * @catalogStatus experimental
 * @catalogTask display
 * @catalogConstraint Caller supplies visible label text.
 * @catalogExample preview src/previews/${example} | Existing preview
 ${extra}
 */\n`;
  const button = metadata("Button", "Button.jsx", "* @param {{ label: string, disabled?: boolean }} props") +
    'export function Button({ label, disabled = false }) { return <button disabled={disabled}>{label}</button>; }\n';
  write("src/ui/Button.jsx", button);
  write("src/previews/Button.jsx", 'import { Button } from "@ui/Button"; export const example = <Button label="Send" />;');
  const run = (args) => spawnSync(process.execPath, [cli, "--config", configFile, ...args], { cwd: os.tmpdir(), encoding: "utf8" });
  return { root, write, config, compiler, configFile, metadata, button, run, loaded: () => loadConfig(configFile) };
}
function ok(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test("JSX and mixed JavaScript/TypeScript projects retain JSDoc Props, examples and freshness", (t) => {
  const f = fixture(t);
  f.write("src/types.ts", "export interface BadgeProps { label: string; count?: number }\n");
  f.write("src/ui/Badge.js", f.metadata("Badge", "Badge.js", "* @param {import('../types').BadgeProps} props") +
    "export const Badge = ({ label, count = 0 }) => ({ label, count });\n");
  f.write("src/previews/Badge.js", 'import { Badge } from "@ui/Badge"; export const example = Badge({ label: "Inbox" });');
  f.write("src/ui/Heading.tsx", f.metadata("Heading", "Heading.jsx") +
    "export function Heading({ label }: { label: string }) { return <span>{label}</span>; }\n");
  f.write("src/previews/Heading.jsx", 'import { Heading } from "@ui/Heading"; export const example = <Heading label="Hello" />;');
  const scanResult = scan(path.join(f.root, "src/ui"));
  assert.equal(scanResult.counts.candidates, 3);
  assert.equal(scanResult.counts.unsupported, 0);
  assert.equal(scan(path.join(f.root, "src/ui"), { query: "Button" }).items[0].sourcePath, "Button.jsx");
  assert.deepEqual(auditProject(f.loaded()).issues, []);
  assert.equal(ok(f.run(["generate"])).components, 3);
  const report = ok(f.run(["check"]));
  assert.equal(report.discovery.status, "available");
  const button = ok(f.run(["get", "ui.Button", "--include", "props,usage,examples"])).component;
  assert.equal(button.importPath, "@ui/Button");
  assert.equal(button.sourcePath, "src/ui/Button.jsx");
  assert.equal(button.props.items.find((p) => p.name === "label").displayType, "string");
  assert.equal(button.props.items.find((p) => p.name === "label").required, true);
  assert.equal(button.props.items.find((p) => p.name === "disabled").required, false);
  assert.equal(button.props.items.find((p) => p.name === "disabled").defaultValue, "false");
  assert.equal(button.usage.preview, 1);
  assert.equal(button.examples[0].path, "src/previews/Button.jsx");
  const count = ok(f.run(["get", "ui.Badge", "--prop", "count"])).component.prop;
  assert.equal(count.defaultValue, "0");
  assert.match(count.displayType, /number/);
  assert.equal(ok(f.run(["search", "Button"])).items[0].id, "ui.Button");
  const snapshot = path.join(f.root, f.config.catalog);
  const before = fs.readFileSync(snapshot);
  const mtime = fs.statSync(snapshot).mtimeMs;
  ok(f.run(["search", "label"]));
  ok(f.run(["check"]));
  assert.deepEqual(fs.readFileSync(snapshot), before);
  assert.equal(fs.statSync(snapshot).mtimeMs, mtime);
  f.write("src/ui/Button.jsx", f.button.replace("disabled = false", "disabled = true"));
  assert.ok(auditProject(f.loaded(), { freshness: true }).issues.some((i) => i.code === "CATALOG_STALE"));
  ok(f.run(["generate"]));
  assert.equal(ok(f.run(["get", "ui.Button", "--prop", "disabled"])).component.prop.defaultValue, "true");
  assert.deepEqual(fs.readdirSync(path.join(f.root, "src/ui")).sort(), ["Badge.js", "Button.jsx", "Heading.tsx"]);
});

test("JavaScript scope cannot pass silently when allowJs is disabled, with a read-only remedy", (t) => {
  const f = fixture(t);
  f.compiler.compilerOptions.allowJs = false;
  f.compiler.compilerOptions.checkJs = false;
  f.write("jsconfig.json", f.compiler);
  const before = fs.readFileSync(path.join(f.root, "jsconfig.json"));
  assert.throws(() => auditProject(f.loaded()), /Button.jsx.*require allowJs/);
  const result = f.run(["generate"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /catalog-specific config/);
  assert.equal(fs.existsSync(path.join(f.root, f.config.catalog)), false);
  assert.deepEqual(fs.readFileSync(path.join(f.root, "jsconfig.json")), before);
  assert.equal(scan(path.join(f.root, "src/ui")).items[0].exportName, "Button");
});

test("untyped JavaScript retains uncertainty and malformed JSX cannot be accepted", (t) => {
  const f = fixture(t);
  f.compiler.compilerOptions.checkJs = false;
  f.compiler.compilerOptions.allowJs = true;
  f.write("jsconfig.json", f.compiler);
  f.write("src/ui/Loose.js", f.metadata("Loose", "Loose.js") +
    "export function Loose({ label, disabled = false }) { return { label, disabled }; }\n");
  f.write("src/previews/Loose.js", 'import { Loose } from "@ui/Loose"; export const example = Loose({ label: "Hi" });');
  ok(f.run(["generate"]));
  const label = ok(f.run(["get", "ui.Loose", "--prop", "label"])).component.prop;
  assert.equal(label.displayType, "any");
  assert.equal(label.schemaStatus, "unsupported");
  assert.equal(label.valueSchema, undefined);
  f.write("src/ui/Broken.jsx", "export function Broken() { return <div>; }");
  assert.throws(() => scan(path.join(f.root, "src/ui")), /Broken.jsx.*invalid JavaScript\/TypeScript/);
  assert.ok(auditProject(f.loaded()).issues.some((i) => i.code === "SOURCE_SYNTAX"));
});

test("v6 source paths do not weaken the older TS-only catalog contracts", (t) => {
  const f = fixture(t);
  ok(f.run(["generate"]));
  const snapshot = path.join(f.root, f.config.catalog);
  const catalog = loadCatalog(snapshot);
  assert.equal(catalog.schemaVersion, 7);
  for (const schemaVersion of [3, 4, 5]) {
    const legacy = structuredClone(catalog);
    legacy.schemaVersion = schemaVersion;
    for (const component of legacy.components) delete component.importExtension;
    if (schemaVersion < 5) for (const component of legacy.components) delete component.reuse;
    f.write(f.config.catalog, legacy);
    assert.throws(() => loadCatalog(snapshot), /Invalid catalog/);
    for (const component of legacy.components) {
      component.sourcePath = component.sourcePath.replace(/\.jsx$/, ".tsx");
      for (const example of component.examples) example.path = example.path.replace(/\.jsx$/, ".tsx");
    }
    f.write(f.config.catalog, legacy);
    assert.equal(loadCatalog(snapshot).schemaVersion, schemaVersion);
  }
});

test("separate named default exports preserve component identity and real default consumers", (t) => {
  const f = fixture(t);
  f.write("src/ui/Button.jsx", f.button.replace("export function", "function") + "\nexport default Button;\n");
  f.write("src/previews/Button.jsx", 'import Control from "@ui/Button"; export const example = <Control label="Send" />;');
  f.write("src/ui/Badge.js", f.metadata("Badge", "Badge.js", "* @param {{ label: string }} props") +
    "const Badge = ({ label }) => label;\nexport default Badge;\n");
  f.write("src/previews/Badge.js", 'import DefaultBadge from "@ui/Badge"; export const example = DefaultBadge({ label: "Inbox" });');
  f.write("src/ui/Heading.ts", f.metadata("Heading", "Heading.js") +
    "export function Heading({ label }: { label: string }) { return label; }\nexport default Heading;\n");
  f.write("src/previews/Heading.js", 'import Heading from "@ui/Heading"; export const example = Heading({ label: "Title" });');
  const result = scan(path.join(f.root, "src/ui"));
  assert.equal(result.counts.candidates, 3);
  assert.equal(result.counts.unsupported, 0);
  assert.equal(result.items.find((item) => item.sourcePath === "Button.jsx").exportName, "Button");
  assert.equal(scan(path.join(f.root, "src/ui"), { query: "Button" }).matchingCandidates, 1);
  assert.equal(ok(f.run(["generate"])).components, 3);
  ok(f.run(["check"]));
  for (const name of ["Button", "Badge"]) {
    const entry = ok(f.run(["get", `ui.${name}`, "--include", "props,examples,usage"])).component;
    assert.equal(entry.exportKind, "default");
    assert.equal(entry.exportName, name);
    assert.equal(entry.props.items.find((p) => p.name === "label").required, true);
    assert.equal(entry.usage.preview, 1);
  }
  assert.equal(ok(f.run(["get", "ui.Heading"])).component.exportKind, "named");
  f.write("src/previews/Button.jsx", 'import Control from "@ui/Button"; export const unrelated = "unused import";');
  assert.ok(auditProject(f.loaded()).issues.some((i) => /does not use the exported entry/.test(i.message)));
});

test("referenced JSX renders keep JSDoc Props and defaults on named and default memo exports", (t) => {
  const f = fixture(t);
  f.write("src/react.d.ts", `declare module "react" {
    interface Exotic<P> { (props: P): unknown; readonly marker: symbol }
    export function memo<P>(component: (props: P) => unknown): Exotic<P>;
  }`);
  f.write("src/ui/Button.jsx", 'import { memo } from "react";\n' +
    '/** @param {{ label: string, disabled?: boolean }} props */\n' +
    'function Button({ label, disabled = false }) { return <button disabled={disabled}>{label}</button>; }\n' +
    f.metadata("Button", "Button.jsx") + 'export default memo(Button);');
  f.write("src/previews/Button.jsx", 'import Button from "@ui/Button"; export const example = <Button label="Send" />;');
  f.write("src/ui/Message.jsx", 'import { memo } from "react";\n' +
    '/** @param {{ label: string, count?: number }} props */\n' +
    'const Render = ({ label, count = 1 }) => <span>{label}: {count}</span>;\n' +
    f.metadata("Message", "Message.jsx") + 'export const Message = memo(Render);');
  f.write("src/previews/Message.jsx", 'import { Message } from "@ui/Message"; export const example = <Message label="Inbox" />;');
  assert.equal(scan(path.join(f.root, "src/ui")).counts.unsupported, 0);
  const audit = auditProject(f.loaded());
  assert.deepEqual(audit.issues, []);
  for (const name of ["Button", "Message"]) {
    const component = audit.catalog.components.find((entry) => entry.id === `ui.${name}`);
    assert.equal(component.exportKind, name === "Button" ? "default" : "named");
    assert.equal(component.props.items.find((item) => item.name === "label").displayType, "string");
    assert.equal(component.usage.preview, 1);
    const prop = component.props.items.find((item) => item.name === (name === "Button" ? "disabled" : "count"));
    assert.equal(prop.defaultValue, name === "Button" ? "false" : "1");
  }
});

test("unchecked JavaScript barrels still reject ambiguous value exports", (t) => {
  const f = fixture(t);
  f.compiler.compilerOptions.checkJs = false;
  f.write("jsconfig.json", f.compiler);
  for (const name of ["a", "b"]) {
    f.write(`src/ui/${name}/Action.js`, f.metadata("Action", `${name}.js`) +
      "export function Action() { return null; }\n");
    f.write(`src/previews/${name}.js`, `import { Action } from '@ui/${name}/Action'; export const example = Action();`);
  }
  f.write("src/ui/index.js", "export * from './a/Action'; export * from './b/Action';");
  assert.ok(auditProject(f.loaded()).issues.some((i) => i.code === "AMBIGUOUS_EXPORT"));
  assert.notEqual(f.run(["generate"]).status, 0);
  // Explicit exports disambiguate; repeated stars of the same binding do not collide.
  f.write("src/ui/index.js", "export { Action } from './a/Action'; export * from './a/Action'; export * from './b/Action';");
  assert.deepEqual(auditProject(f.loaded()).issues, []);
  f.write("src/ui/bridge.ts", "export type * from './b/Action';");
  f.write("src/ui/index.js", "export * from './a/Action'; export * from './a/Action'; export * from './bridge';");
  assert.deepEqual(auditProject(f.loaded()).issues, []);
});

test("CommonJS exports report unsupported coverage rather than an empty public scope", (t) => {
  const f = fixture(t);
  f.compiler.compilerOptions.checkJs = false;
  f.write("jsconfig.json", f.compiler);
  for (const expression of ["module.exports = Button", "exports.Button = Button", "module.exports = { Button }"]) {
    f.write("src/ui/Legacy.js", "function Button() {}\n" + expression + ";\n");
    const report = auditProject(f.loaded());
    assert.ok(report.issues.some((i) => i.code === "UNSUPPORTED_COMMONJS"));
    assert.notEqual(f.run(["generate"]).status, 0);
  }
});

test("unchecked static imports fail dependency diagnosis and generation without discarding ambient modules", (t) => {
  const f = fixture(t);
  f.compiler.compilerOptions.checkJs = false;
  f.write("jsconfig.json", f.compiler);
  f.write("src/ui/Button.jsx", "import { missing } from './missing.js';\n" + f.button);
  const doctor = f.run(["doctor"]);
  assert.equal(doctor.status, 1);
  assert.match(JSON.parse(doctor.stdout).checks.find((c) => c.id === "project-dependencies").message, /missing.js/);
  assert.ok(auditProject(f.loaded()).issues.some((i) => /Cannot resolve static import/.test(i.message)));
  f.write("src/assets.d.ts", "declare module '*.css' {}\n");
  f.write("src/ui/Button.jsx", "import './button.css';\n" + f.button);
  assert.equal(ok(f.run(["doctor"])).status, "pass");
  assert.deepEqual(auditProject(f.loaded()).issues, []);
  f.write("src/setup.js", "console.log('initialize');\n");
  f.write("src/ui/Button.jsx", "import '../setup.js';\nvoid import('../setup.js');\n" + f.button);
  assert.equal(ok(f.run(["doctor"])).status, "pass");
  assert.deepEqual(auditProject(f.loaded()).issues, []);
  f.write("src/ui/Button.jsx", '/** @import {Item} from "../missing.js" */\n' + f.button);
  const missingType = f.run(["doctor"]);
  assert.equal(missingType.status, 1);
  assert.match(missingType.stdout, /missing.js/);
  assert.ok(auditProject(f.loaded()).issues.some((i) => /Cannot resolve static import/.test(i.message)));
});

test("JSDoc generic constraints and defaults survive extraction", (t) => {
  const f = fixture(t);
  f.write("src/ui/Generic.js", f.metadata("Generic", "Generic.js",
    "* @template {string} [T=string]\n * @param {{ label: T }} props") +
    "export function Generic({ label }) { return label; }\n");
  f.write("src/previews/Generic.js", 'import { Generic } from "@ui/Generic"; export const example = Generic({ label: "Title" });');
  ok(f.run(["generate"]));
  const props = ok(f.run(["get", "ui.Generic"])).component.props;
  assert.deepEqual(props.typeParameters, ["T extends string = string"]);
  assert.equal(props.items.find((p) => p.name === "label").displayType, "T");
});
