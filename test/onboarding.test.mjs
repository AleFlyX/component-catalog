import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { scan } from "../skills/component-catalog/scripts/lib/scan.mjs";

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

test("filtered discovery finds unmarked, ignored and unsupported candidates without enrolling them", (t) => {
  const f = fixture(t);
  f.write("ui/Dialog.ts", "export function DialogContent() {}\nexport function Dialog() {}\n");
  f.write(
    "features/billing/Picker.ts",
    `/** Choose an account. */
export const AccountPicker = memo(() => null);
export { AccountPicker as BillingSelector };
function PrivatePicker() {}
`,
  );
  f.write(
    "ui/Feedback.ts",
    `/** 加载状态提示 */
export function Spinner() {}
/** @componentCatalogIgnore unsupported: third-party component alias */
export const Overlay = Primitive.Overlay;
/**
 * An annotated candidate whose metadata is not validated here.
 * @componentCatalog
 * @catalogTask confirm-action
 */
export function Confirm() {}
`,
  );
  const catalog = f.write("component-catalog.json", "existing snapshot must remain untouched\n");
  const files = [
    catalog,
    path.join(f.root, "ui/Dialog.ts"),
    path.join(f.root, "ui/Feedback.ts"),
    path.join(f.root, "features/billing/Picker.ts"),
  ];
  const before = files.map((file) => [fs.readFileSync(file), fs.statSync(file).mtimeMs]);
  const query = (text) => ok(run(["scan", f.root, "--query", text]));
  const dialog = query("ＤＩＡＬＯＧ");
  assert.deepEqual(
    dialog.items.map((x) => x.exportName),
    ["Dialog", "DialogContent"],
  );
  assert.equal(dialog.items[0].marked, false);
  assert.ok(dialog.items[0].missingMetadata.includes("componentCatalog"));
  assert.equal(dialog.counts.candidates, 7);
  assert.equal(dialog.matchingCandidates, 2);
  const picker = query("billing AccountPicker");
  assert.equal(picker.matchingCandidates, 1);
  assert.equal(picker.items[0].supportedShape, false);
  assert.deepEqual(picker.items[0].matchedFields, ["exportName", "sourcePath"]);
  assert.equal(query("BillingSelector").items[0].kind, "unsupported");
  assert.equal(query("加载").items[0].exportName, "Spinner");
  assert.equal(query("choose account").items[0].exportName, "AccountPicker");
  assert.deepEqual(query("confirm-action").items[0].matchedFields, ["tasks"]);
  const ignored = query("Overlay");
  assert.equal(ignored.items[0].ignored, true);
  assert.match(ignored.items[0].ignoreReason, /^unsupported:/);
  assert.match(ignored.nextStep, /Do not annotate or generate/);
  for (const term of ["PrivatePicker", ".*", "definitely-absent"]) {
    const empty = query(term);
    assert.deepEqual(empty.items, []);
    assert.equal(empty.nextOffset, null);
    assert.equal(empty.truncated, false);
    assert.equal(empty.counts.candidates, 7);
    assert.match(empty.nextStep, /source search/);
  }
  for (const [index, file] of files.entries()) {
    assert.deepEqual(fs.readFileSync(file), before[index][0]);
    assert.equal(fs.statSync(file).mtimeMs, before[index][1]);
  }
  assert.equal(fs.existsSync(path.join(f.root, "component-catalog.config.json")), false);
});

test("filtered pagination is bounded, deterministic and independent of unmatched candidates", (t) => {
  const f = fixture(t);
  for (let i = 0; i < 60; i++)
    f.write(
      `候选${String(i).padStart(2, "0")}.ts`,
      `export function Account${i}() {}\nexport function Other${i}() {}\n`,
    );
  let offset = 0;
  const names = [];
  do {
    const page = scan(f.root, { query: "account", limit: 50, offset });
    assert.ok(Buffer.byteLength(JSON.stringify(page) + "\n") <= 8192);
    assert.equal(page.counts.candidates, 120);
    assert.equal(page.matchingCandidates, 60);
    assert.equal(page.totalItems, 60);
    assert.equal(page.omitted.after, 60 - offset - page.items.length);
    assert.ok(page.items.length > 0);
    names.push(...page.items.map((x) => x.exportName));
    offset = page.nextOffset;
  } while (offset !== null);
  assert.equal(names.length, 60);
  assert.equal(new Set(names).size, 60);
  assert.deepEqual(scan(f.root, { query: "Account10" }), scan(f.root, { query: "Account10" }));
  assert.equal(scan(f.root, { query: "Account10" }).items[0].exportName, "Account10");
  assert.deepEqual(scan(f.root, { query: "account", offset: 60 }).items, []);
  assert.throws(() => scan(f.root, { query: "account", offset: 61 }), /offset exceeds/);
});

test("filtered scan rejects ambiguous modes and invalid queries", (t) => {
  const f = fixture(t);
  for (const query of ["", "   ", "长".repeat(201)])
    fail(run(["scan", f.root, "--query", query]), /--query must contain/);
  fail(run(["scan", f.root, "--query", "Button", "--summary"]), /cannot be combined/);
  fail(run(["scan", f.root, "--query"]), /argument missing/);
  fail(run(["scan", f.root, "--query", "A", "--query", "B"]), /cannot be repeated/);
  fail(run(["search", "Button", "--query", "A"]), /does not accept --query/);
  fail(
    run(["scan", f.root, "--query", "Button", "--config", "absent.json"]),
    /does not accept --config/,
  );
  assert.match(run(["scan", "--help"]).stdout, /--query/);
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

test("scan deduplicates local exports without accepting aliases, private declarations or fake wrappers", (t) => {
  const f = fixture(t);
  f.write(
    "forms.ts",
    `import { forwardRef as ref } from "react";
const Button = ref((props: { label: string }, reference) => null);
const Header = () => null;
interface Header { title: string }
function Private() {}
const Renamed = () => null;
const forwardRef = (value: unknown) => value;
const Fake = forwardRef(() => null);
export { Button, Header, Renamed as Public, Fake };
export type { Private };
`,
  );
  const result = scan(f.root);
  assert.equal(result.counts.candidates, 4);
  assert.deepEqual(
    result.items.filter((item) => item.supportedShape).map((item) => item.exportName),
    ["Button", "Header"],
  );
  assert.deepEqual(
    result.items.filter((item) => !item.supportedShape).map((item) => item.exportName),
    ["Public", "Fake"],
  );
  f.write(
    "ignored.ts",
    `const Internal = () => null;
/** @componentCatalogIgnore internal: private export bridge */
export { Internal };
`,
  );
  assert.doesNotThrow(() => scan(f.root));
});

test("scan recognizes inline React memo forms without accepting arbitrary wrappers", (t) => {
  const f = fixture(t);
  f.write(
    "memo.ts",
    `import React, { memo as cache, forwardRef as ref } from "react";
import * as R from "react";
import { memo as otherMemo } from "other-library";
import type { memo as typeMemo } from "react";
const Plain = cache(({ label }: { label: string }) => label);
export { Plain };
export const Compared = React.memo(function Named() { return null; }, () => true);
export const WithRef = R.memo(ref((props, reference) => null));
export const Parens = cache((() => null));
const memo = (fn) => fn;
export const Fake = memo(() => null);
export const Foreign = otherMemo(() => null);
export const TypeOnly = typeMemo(() => null);
export const Referenced = cache(Plain);
export const Nested = cache(cache(() => null));
export const Hoc = cache(observer(() => null));
export const Reverse = ref(cache(() => null));
export const Spread = cache(...callbacks);
export const Empty = cache();
export const TooMany = cache(() => null, () => true, true);
`,
  );
  const result = scan(f.root);
  assert.equal(result.counts.candidates, 14);
  assert.deepEqual(
    result.items.filter((item) => item.supportedShape).map((item) => item.exportName),
    ["Plain", "Compared", "WithRef", "Parens", "Referenced", "Nested"],
  );
  assert.equal(result.counts.unsupported, 8);
});

test("scan resolves local React wrapper references and named defaults without accepting unknown HOCs or cycles", (t) => {
  const f = fixture(t);
  f.write("wrappers.tsx", `import { memo, forwardRef } from "react";
function Render({ label = "Ready" }: { label?: string }) { return null; }
const Arrow = ({ label = "Arrow" }: { label?: string }) => null;
const Ref = forwardRef(Render);
export const Named = memo(Render);
export const WithRef = memo(Ref);
export const Cast = memo(Arrow) as typeof Arrow;
export const Checked = memo(Render) satisfies typeof Render;
export default memo(Render);
const A = memo(B);
const B = memo(A);
export const Cycle = memo(A);
export const Missing = memo(Absent);
export const Custom = memo(observer(Render));
export const BareAlias = Render;
`);
  const result = scan(f.root);
  assert.deepEqual(result.items.filter((item) => item.supportedShape).map((item) => item.exportName),
    ["Named", "WithRef", "Cast", "Checked", "Render"]);
  assert.deepEqual(result.items.filter((item) => !item.supportedShape).map((item) => item.exportName),
    ["Cycle", "Missing", "Custom", "BareAlias"]);
  assert.ok(result.items.find((item) => item.exportName === "Render").missingMetadata.includes("componentCatalog"));
  f.write("anonymous.tsx", 'import { memo } from "react"; export default memo(() => null);');
  assert.match(scan(f.root).items.find((item) => item.sourcePath === "anonymous.tsx").shapeIssue, /PascalCase/);
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
  fail(run(["scan", f.root]), /invalid.ts:1: cannot scan invalid JavaScript\/TypeScript syntax/);
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

test("brief scan fits a full page and keeps identifying fields only", (t) => {
  const f = fixture(t);
  for (let i = 0; i < 60; i++)
    f.write(`brief/C${String(i).padStart(2, "0")}.ts`, `export function C${i}() { return null; }\n`);
  const page = scan(f.root, { limit: 50, brief: true });
  assert.equal(page.brief, true);
  assert.ok(Buffer.byteLength(JSON.stringify(page) + "\n") <= 8192);
  assert.equal(page.items.length, 50);
  assert.deepEqual(Object.keys(page.items[0]).sort(), [
    "exportName",
    "line",
    "marked",
    "sourcePath",
    "supportedShape",
  ]);
  assert.match(page.note, /Brief view omits metadata tags/);
  assert.throws(() => scan(f.root, { brief: true, summary: true }), /cannot be combined/);
  assert.equal(ok(run(["scan", f.root, "--brief", "--limit", "50"])).brief, true);
});
