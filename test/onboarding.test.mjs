import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { scan } from "../lib/scan.mjs";

const cli = fileURLToPath(new URL("../bin/component-catalog.mjs", import.meta.url));
function run(args, cwd = os.tmpdir()) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", cwd });
}
function ok(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}
function fail(result, pattern) {
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, pattern);
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-onboarding-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  function write(file, content) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content));
    return target;
  }
  return { root, write };
}

test("scan needs no config, dependencies or markers and distinguishes syntax from public ownership", (t) => {
  const f = fixture(t);
  const file = f.write(
    "ui/entries.tsx",
    `export function Button(props: { label: string }) { return <button>{props.label}</button>; }
export const Label = () => null;
export const Wrapped = memo(() => null);
export const Fields = { Button: Button };
export const MultiA = () => null, MultiB = () => null;
export { Button as Alias };
export type { Button as TypeAlias };
export const VERSION = 1;
export function helper() { return null; }
function Private() { return null; }
/** @componentCatalog */
function MarkedPrivate() { return null; }
export default function() { return null; }
`,
  );
  f.write("pages/Page.ts", "export function Page() { return null; }");
  f.write("previews/Button.stories.ts", "export const Preview = () => null;");
  f.write("node_modules/library/Dependency.ts", "export function Dependency() {}");
  f.write(".git/Hidden.ts", "export function Hidden() {}");
  f.write("ui/types.d.ts", "export declare function Declared(): void;");
  fs.symlinkSync(path.join(f.root, "ui"), path.join(f.root, "linked"), "dir");
  const before = fs.readFileSync(file);
  const mtime = fs.statSync(file).mtimeMs;
  const result = ok(run(["scan", f.root, "--limit", "50"]));
  assert.equal(result.counts.files, 3);
  assert.equal(result.counts.candidates, 11);
  assert.equal(result.counts.marked, 1);
  assert.equal(result.counts.unmarked, 10);
  assert.equal(result.counts.unsupported, 6);
  assert.equal(result.counts.skippedDirectories, 2);
  assert.equal(result.counts.skippedSymlinks, 1);
  const button = result.items.find((entry) => entry.exportName === "Button");
  assert.equal(button.supportedShape, true);
  assert.equal(button.sourcePath, "ui/entries.tsx");
  assert.ok(button.missingMetadata.includes("componentCatalog"));
  assert.equal(result.items.find((entry) => entry.exportName === "Fields").kind, "namespace");
  assert.match(
    result.items.find((entry) => entry.exportName === "MarkedPrivate").shapeIssue,
    /must be exported/,
  );
  assert.ok(result.items.some((entry) => entry.exportName === "Page"));
  assert.match(result.note, /not catalog entries or proof of public ownership/);
  assert.deepEqual(fs.readFileSync(file), before);
  assert.equal(fs.statSync(file).mtimeMs, mtime);
  assert.equal(fs.existsSync(path.join(f.root, "component-catalog.config.json")), false);
  assert.equal(fs.existsSync(path.join(f.root, "component-catalog.json")), false);
});

test("scan pagination stays bounded and visits all candidates deterministically", (t) => {
  const f = fixture(t);
  for (let i = 0; i < 60; i++)
    f.write(
      `公共目录/Component${String(i).padStart(2, "0")}.ts`,
      `export function Component${i}() { return null; }`,
    );
  let offset = 0;
  const entries = [];
  do {
    const page = scan(f.root, { limit: 50, offset });
    assert.ok(Buffer.byteLength(JSON.stringify(page) + "\n") <= 8192);
    assert.equal(page.counts.candidates, 60);
    assert.equal(page.omitted.before, offset);
    assert.equal(page.omitted.after, 60 - offset - page.items.length);
    assert.ok(page.items.length > 0);
    entries.push(...page.items.map((item) => item.exportName));
    assert.ok(page.nextOffset === null || page.nextOffset > offset);
    offset = page.nextOffset;
  } while (offset !== null);
  assert.equal(entries.length, 60);
  assert.equal(new Set(entries).size, 60);
  assert.deepEqual(scan(f.root), scan(f.root));
  const last = scan(f.root, { offset: 60 });
  assert.deepEqual(last.items, []);
  assert.equal(last.nextOffset, null);
});

test("directory summary enables scope selection without reading every candidate", (t) => {
  const f = fixture(t);
  f.write("ui/Button.ts", "export function Button() {}\n");
  f.write("ui/forms/Input.ts", "/** @componentCatalog */\nexport function Input() {}\n");
  f.write("ui/Wrapped.ts", "export const Wrapped = memo(() => null);\n");
  f.write("features/account/Page.ts", "export function Page() {}\n");
  f.write("Root.ts", "export function Root() {}\n");
  const result = ok(run(["scan", f.root, "--summary"]));
  assert.equal(result.view, "directories");
  assert.equal(result.totalItems, 3);
  assert.equal(result.counts.candidates, 5);
  assert.equal(result.counts.directories, 3);
  assert.deepEqual(result.items, [
    { directory: ".", candidates: 1, marked: 0, unmarked: 1, unsupported: 0 },
    { directory: "features", candidates: 1, marked: 0, unmarked: 1, unsupported: 0 },
    { directory: "ui", candidates: 3, marked: 1, unmarked: 2, unsupported: 1 },
  ]);
  const paged = ok(run(["scan", f.root, "--summary", "--limit", "1", "--offset", "1"]));
  assert.equal(paged.items[0].directory, "features");
  assert.equal(paged.nextOffset, 2);
  assert.deepEqual(paged.omitted, { before: 1, after: 1 });
  fail(run(["scan", f.root, "--summary", "--offset", "4"]), /directory groups/);
  for (let i = 0; i < 60; i++) f.write(`目录${i}/A.ts`, "export function A() {}\n");
  const bounded = scan(f.root, { summary: true, limit: 50 });
  assert.ok(Buffer.byteLength(JSON.stringify(bounded) + "\n") <= 8192);
  assert.ok(bounded.nextOffset > 0);
});

test("empty directories, invalid source and mistaken scan arguments give actionable outcomes", (t) => {
  const f = fixture(t);
  const empty = ok(run(["scan", f.root]));
  assert.equal(empty.counts.candidates, 0);
  assert.match(empty.nextStep, /other languages or export styles/);
  fail(run(["scan", path.join(f.root, "missing")]), /directory/);
  for (const args of [
    ["scan"],
    ["scan", ""],
    ["scan", f.root, "--limit", "51"],
    ["scan", f.root, "--offset", "-1"],
    ["scan", f.root, "--offset", "9007199254740992"],
    ["scan", f.root, "--offset", "1"],
    ["scan", f.root, "--config", "missing.json"],
    ["search", "Button", "--offset", "1"],
  ])
    fail(run(args), /component-catalog:/);
  f.write("invalid.ts", "export function Broken( {");
  fail(run(["scan", f.root]), /invalid.ts:1: cannot scan invalid TypeScript syntax/);
});

test("new users can follow help and errors from inventory through annotation and generation", (t) => {
  const f = fixture(t);
  assert.equal(run([]).status, 0);
  assert.match(run([]).stdout, /First use: scan/);
  assert.equal(run(["--config", "not-created.json", "--help"]).status, 0);
  assert.equal(run(["--config", "not-created.json", "generate", "--help"]).status, 0);
  fail(
    run(["--config", "not-created.json", "scan", f.root]),
    /scan does not accept --config.*without a script/,
  );
  for (const command of ["scan", "init", "generate", "search", "get"]) {
    const help = run([command, "--help"]);
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, new RegExp(`component-catalog.*${command}`));
  }
  const file = f.write(
    "frontend/public/Button.ts",
    "export function Button(props: { label: string }) { return props.label; }\n",
  );
  f.write(
    "frontend/previews/button.ts",
    "import { Button } from '@ui/Button';\nexport const example = Button({ label: 'Save' });\n",
  );
  f.write("frontend/tsconfig.json", {
    compilerOptions: {
      strict: true,
      module: "ESNext",
      moduleResolution: "Bundler",
      paths: { "@ui/*": ["./public/*"] },
    },
    include: ["public", "previews"],
  });
  const first = ok(run(["scan", path.dirname(file)]));
  assert.equal(first.counts.unmarked, 1);
  fail(run(["search", "button"], f.root), /Config missing.*scan.*stdout only/);
  const config = ok(run(["init"]));
  Object.assign(config, {
    projectRoot: "..",
    sourceRoot: "frontend",
    tsconfig: "frontend/tsconfig.json",
    catalog: "output/catalog.json",
    componentRoots: [
      {
        path: "frontend/public",
        idPrefix: "ui",
        importPrefix: "@ui",
        layer: "shared",
        enrollment: "public",
      },
    ],
    previewRoots: ["frontend/previews"],
  });
  const configFile = f.write("configuration/with space.json", config);
  const prefix = ["--config", configFile];
  const missing = run([...prefix, "search", "button"]);
  fail(missing, /Catalog missing.*--config.*with space.json.*generate/);
  fail(run([...prefix, "generate"]), /audit failed.*metadata/);
  assert.equal(fs.existsSync(path.join(f.root, "output/catalog.json")), false);
  const source = fs.readFileSync(file, "utf8");
  fs.writeFileSync(
    file,
    `/**
 * Display a caller-provided label.
 * @componentCatalog
 * @catalogStatus experimental
 * @catalogTask button
 * @catalogConstraint The caller supplies the label.
 * @catalogExample preview frontend/previews/button.ts | Basic label
 */\n${source}`,
  );
  const marked = ok(run(["scan", path.dirname(file)]));
  assert.equal(marked.counts.marked, 1);
  assert.deepEqual(marked.items[0].missingMetadata, []);
  assert.equal(marked.counts.needsMetadata, 0);
  assert.match(marked.nextStep, /Run generate to validate/);
  assert.doesNotMatch(marked.nextStep, /choose scope|reconfirmation/);
  const generated = ok(run([...prefix, "generate"]));
  assert.equal(generated.components, 1);
  assert.equal(generated.config, configFile);
  assert.equal(ok(run([...prefix, "search", "button"])).items[0].id, "ui.Button");
  assert.equal(
    ok(run([...prefix, "get", "ui.Button", "--prop", "label"])).component.prop.required,
    true,
  );
  assert.equal(ok(run([...prefix, "generate", "--check"])).command, "check");
  fs.appendFileSync(file, "\n// changed\n");
  fail(run([...prefix, "generate", "--check"]), /stale.*--config.*with space.json.*generate/);
});

test("scan metadata presence does not masquerade as generation readiness", (t) => {
  const f = fixture(t);
  f.write(
    "Button.ts",
    `/**
 * A button.
 * @componentCatalog
 * @catalogStatus not-a-status
 * @catalogTask button
 * @catalogConstraint Real constraint must be reviewed.
 * @catalogExample preview missing.ts | Missing file
 */
export function Button() { return null; }
`,
  );
  const result = scan(f.root);
  assert.deepEqual(result.items[0].missingMetadata, []);
  assert.equal(result.items[0].supportedShape, true);
  assert.match(result.note, /Metadata presence is not validity/);
  assert.match(result.nextStep, /validate types, tag values and examples/);
  const metadataMissing = f.write("Unmarked.ts", "export function Unmarked() {}\n");
  assert.equal(scan(f.root).counts.needsMetadata, 1);
  assert.match(scan(f.root).nextStep, /already selected scope needs no reconfirmation/);
  fs.unlinkSync(metadataMissing);
  fs.unlinkSync(path.join(f.root, "Button.ts"));
  f.write("Wrapped.ts", "export const Wrapped = memo(() => null);\n");
  const unsupported = scan(f.root);
  assert.match(unsupported.nextStep, /Only unsupported/);
  assert.match(unsupported.items[0].shapeIssue, /preserve runtime behavior/);
  assert.doesNotMatch(unsupported.items[0].shapeIssue, /@componentCatalog/);
});
