import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadConfig } from "../lib/config.mjs";
import { auditProject, auditResponse } from "../lib/audit.mjs";
import { scan } from "../lib/scan.mjs";

const cli = fileURLToPath(new URL("../bin/component-catalog.mjs", import.meta.url));
const run = (args, cwd = os.tmpdir()) =>
  spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });
function json(result, status = 0) {
  assert.equal(result.status, status, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}
function fixture(t, enrollment = "public") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-lifecycle-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, value) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof value === "string" ? value : JSON.stringify(value));
    return target;
  };
  const raw = {
    configVersion: 2,
    projectRoot: ".",
    sourceRoot: "client",
    tsconfig: "tsconfig.json",
    catalog: "generated/catalog.json",
    componentRoots: [
      {
        path: "client/ui",
        idPrefix: "library",
        importPrefix: "@widgets",
        layer: "foundation",
        enrollment,
      },
    ],
    previewRoots: ["client/demo"],
    testRoots: [],
    exclude: [],
  };
  const configPath = write("component-catalog.config.json", raw);
  write("tsconfig.json", {
    compilerOptions: {
      strict: true,
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      paths: { "@widgets/*": ["./client/ui/*"] },
    },
    include: ["client"],
  });
  fs.mkdirSync(path.join(root, "client/ui"), { recursive: true });
  const component = (name, extra = "", status = "experimental") => `/**
 * Display ${name} data.
 * @componentCatalog
 * @catalogStatus ${status}
 * @catalogTask display
 * @catalogConstraint Caller supplies label text.
 * @catalogExample preview client/demo/${name}.ts | Existing use
 ${extra}
 */
export function ${name}({ label }: { label: string }) { return label; }
`;
  const add = (name, extra, status) => {
    write(`client/ui/${name}.ts`, component(name, extra, status));
    write(
      `client/demo/${name}.ts`,
      `import { ${name} } from '@widgets/${name}';\nexport const sample = ${name}({ label: 'Example' });\n`,
    );
  };
  return {
    root,
    write,
    raw,
    configPath,
    component,
    add,
    config: () => loadConfig(configPath),
    run: (args) => run(["--config", configPath, ...args]),
  };
}

test("public omissions fail independently of freshness; enrolling fixes the complete check", (t) => {
  const f = fixture(t);
  f.add("Button");
  json(f.run(["generate"]));
  json(f.run(["check"]));
  const output = path.join(f.root, f.raw.catalog);
  const before = fs.readFileSync(output);
  const mtime = fs.statSync(output).mtimeMs;
  json(f.run(["audit"]));
  json(f.run(["check"]));
  assert.deepEqual(fs.readFileSync(output), before);
  assert.equal(fs.statSync(output).mtimeMs, mtime);
  f.write("client/ui/Alert.ts", "export function Alert() { return null; }\n");
  const report = json(f.run(["audit"]), 1);
  assert.ok(report.issues.some((item) => item.code === "UNREGISTERED_COMPONENT"));
  assert.equal(report.counts.undecided, 1);
  assert.equal(f.run(["generate"]).status, 1); // refuses to hide a missing enrollment by regenerating
  assert.deepEqual(fs.readFileSync(output), before);
  assert.equal(fs.statSync(output).mtimeMs, mtime);
  f.add("Alert");
  json(f.run(["generate"]));
  const fixed = json(f.run(["check"]));
  assert.equal(fixed.counts.generated, 2);
  assert.equal(fixed.status, "pass");
  assert.equal(f.run(["get", "check"]).status, 1);
  assert.equal(f.run(["search", "check", "--bad"]).status, 1);
  assert.equal(fs.existsSync(path.join(f.root, ".git")), false);
});

test("local export lists and imported React forwardRef preserve public Props, defaults and examples", (t) => {
  const f = fixture(t);
  f.write(
    "client/react.d.ts",
    `declare module "react" {
    export function forwardRef<T, P = {}>(render: (props: P, ref: T | null) => unknown):
      (props: P & { ref?: T | null }) => unknown;
  }`,
  );
  const forms = [
    ['import * as React from "react";', "React.forwardRef"],
    ['import { forwardRef as withRef } from "react";', "withRef"],
  ];
  for (const [i, [imp, call]] of forms.entries()) {
    const name = `Control${i}`;
    f.add(name);
    const metadata = f.component(name).split("export function")[0];
    f.write(
      `client/ui/${name}.ts`,
      `${imp}\n${metadata}
const ${name} = ${call}<string, { label: string; disabled?: boolean }>(
  ({ label, disabled = false }, ref) => label);
export { ${name} };
`,
    );
  }
  f.add("Header");
  f.write(
    "client/ui/Header.ts",
    f.component("Header").replace("export function", "function") + "\nexport { Header };\n",
  );
  const before = scan(path.join(f.root, "client/ui"));
  assert.equal(before.counts.candidates, 3);
  assert.equal(before.counts.unsupported, 0);
  assert.equal(json(f.run(["generate"])).components, 3);
  const checked = json(f.run(["check"]));
  assert.equal(checked.discovery.status, "available");
  for (let i = 0; i < 2; i++) {
    const entry = json(f.run(["get", `library.Control${i}`])).component;
    assert.equal(entry.exportName, `Control${i}`);
    assert.equal(entry.props.items.find((p) => p.name === "label").required, true);
    assert.equal(entry.props.items.find((p) => p.name === "disabled").defaultValue, "false");
    assert.equal(entry.props.items.find((p) => p.name === "ref").required, false);
    assert.equal(entry.examples.length, 1);
  }
  f.write(
    "client/ui/Header.ts",
    "/** @componentCatalogIgnore unsupported: local export */\nfunction Header() {}\nexport { Header };\n",
  );
  assert.ok(auditProject(f.config()).issues.some((item) => item.code === "IGNORE_REVIEW_REQUIRED"));
});

test("review policy, explicit ignores, conflicts and unsupported exclusions remain visible", (t) => {
  const f = fixture(t, "review");
  f.write("client/ui/Internal.ts", "export function Internal() {}\n");
  assert.ok(auditProject(f.config()).issues.some((item) => item.code === "UNREVIEWED_CANDIDATE"));
  f.write(
    "client/ui/Internal.ts",
    "/** @componentCatalogIgnore internal: private field adapter */\nexport function Internal() {}\n",
  );
  f.write(
    "client/ui/Wrapped.ts",
    "/** @componentCatalogIgnore unsupported: memo result needs extractor support */\nexport const Wrapped = memo(() => null);\n",
  );
  f.write(
    "client/ui/Settings.ts",
    "/** @componentCatalogIgnore non-component: numeric design constant */\nexport const Settings = 1;\n",
  );
  const accepted = auditProject(f.config());
  assert.deepEqual(accepted.issues, []);
  assert.equal(accepted.counts.ignored, 3);
  assert.equal(accepted.counts.ignoredUnsupported, 1);
  const coverage = auditResponse(accepted);
  assert.equal(coverage.status, "pass");
  assert.equal(coverage.discovery.status, "partial");
  assert.equal(coverage.discovery.excludedUnsupported, 1);
  assert.equal(coverage.discovery.searchable, 0);
  json(f.run(["generate"]));
  assert.equal(json(f.run(["check"])).counts.generated, 0);
  assert.deepEqual(json(f.run(["search", "anything"])).items, []);
  f.write(
    "client/ui/Internal.ts",
    "/**\n * @componentCatalog\n * @componentCatalogIgnore internal: hide it\n */\nexport function Internal() {}\n",
  );
  assert.ok(auditProject(f.config()).issues.some((item) => item.code === "DECISION_INVALID"));
  f.write(
    "client/ui/Internal.ts",
    "/** @componentCatalogIgnore */\nexport function Internal() {}\n",
  );
  assert.ok(auditProject(f.config()).issues.some((item) => item.code === "DECISION_INVALID"));
});

test("rename, props changes and deletion of the last entry leave no stale identity", (t) => {
  const f = fixture(t);
  f.add("Old");
  json(f.run(["generate"]));
  f.write(
    "client/ui/Old.ts",
    f.component("Old").replace("label: string", "label: string; disabled?: boolean"),
  );
  assert.ok(json(f.run(["check"]), 1).issues.some((item) => item.code === "CATALOG_STALE"));
  json(f.run(["generate"]));
  assert.equal(
    json(f.run(["get", "library.Old", "--prop", "disabled"])).component.prop.required,
    false,
  );
  fs.unlinkSync(path.join(f.root, "client/ui/Old.ts"));
  fs.unlinkSync(path.join(f.root, "client/demo/Old.ts"));
  f.add("New");
  assert.ok(
    json(f.run(["audit"]), 1).issues.some(
      (item) => item.code === "STALE_ENTRY" && item.exportName === "Old",
    ),
  );
  json(f.run(["generate"]));
  json(f.run(["check"]));
  assert.notEqual(f.run(["get", "library.Old"]).status, 0);
  fs.unlinkSync(path.join(f.root, "client/ui/New.ts"));
  fs.unlinkSync(path.join(f.root, "client/demo/New.ts"));
  assert.ok(json(f.run(["check"]), 1).issues.some((item) => item.code === "STALE_ENTRY"));
  assert.equal(json(f.run(["generate"])).components, 0);
  assert.equal(json(f.run(["check"])).counts.generated, 0);
  assert.deepEqual(json(f.run(["search", "New"])).items, []);
});

test("audit canonicalizes aliases and stars and rejects unresolved/out-of-scope exports", (t) => {
  const f = fixture(t);
  f.add("Button");
  f.write(
    "client/ui/index.ts",
    "export { Button as PublicButton } from './Button';\nexport * from './Button';\nexport type { Button as ButtonType } from './Button';\n",
  );
  let report = auditProject(f.config());
  assert.deepEqual(report.issues, []);
  assert.equal(report.counts.candidates, 1);
  f.write("client/ui/missing.ts", "export * from './does-not-exist';\n");
  assert.ok(auditProject(f.config()).issues.some((item) => item.code === "UNRESOLVED_EXPORT"));
  fs.unlinkSync(path.join(f.root, "client/ui/missing.ts"));
  f.write("client/foreign/External.ts", "export function External() {}\n");
  f.write("client/ui/external.ts", "export * from '../foreign/External';\n");
  assert.ok(auditProject(f.config()).issues.some((item) => item.code === "OUT_OF_SCOPE_EXPORT"));
  f.write(
    "client/ui/external.ts",
    "/** @componentCatalogIgnore unsupported: foreign library is documented separately */\nexport * from '../foreign/External';\n",
  );
  assert.deepEqual(auditProject(f.config()).issues, []);
  f.write("client/ui/external.ts", "export type * from '../foreign/External';\n");
  assert.deepEqual(auditProject(f.config()).issues, []);
  f.write("client/ui/chain.ts", "export * from './external';\n");
  assert.deepEqual(auditProject(f.config()).issues, []);
  f.write(
    "client/ui/chain.ts",
    "export * from './external';\nexport * from '../foreign/External';\n",
  );
  assert.ok(auditProject(f.config()).issues.some((item) => item.code === "OUT_OF_SCOPE_EXPORT"));
});

test("metadata, missing examples and replacement graphs are audited", (t) => {
  const f = fixture(t);
  f.add("First", "* @catalogReplacement library.Absent", "deprecated");
  assert.ok(auditProject(f.config()).issues.some((item) => item.code === "REPLACEMENT_INVALID"));
  f.add("Second", "* @catalogReplacement library.First", "deprecated");
  f.add("First", "* @catalogReplacement library.Second", "deprecated");
  assert.ok(
    auditProject(f.config()).issues.some(
      (item) => item.code === "REPLACEMENT_INVALID" && /cycle/.test(item.message),
    ),
  );
  f.add("Second");
  assert.deepEqual(auditProject(f.config()).issues, []);
  f.write("client/demo/First.ts", "export const unrelated = 1;\n");
  assert.ok(
    auditProject(f.config()).issues.some(
      (item) => item.code === "METADATA_INVALID" && /does not use/.test(item.message),
    ),
  );
  f.write(
    "client/ui/Second.ts",
    f.component("Second").replace("@catalogTask display", "@catalogTask BAD"),
  );
  const bad = auditProject(f.config());
  assert.equal(bad.issues.filter((item) => item.code === "METADATA_INVALID").length, 2);
});

test("deprecation without a successor keeps its reason in all detail selections", (t) => {
  const f = fixture(t);
  f.add(
    "Old",
    "* @catalogDeprecatedReason This workflow is retired; use the native browser control.",
    "deprecated",
  );
  assert.deepEqual(auditProject(f.config()).issues, []);
  json(f.run(["generate"]));
  json(f.run(["check"]));
  for (const args of [[], ["--include", "usage"], ["--prop", "label"]]) {
    const result = json(f.run(["get", "library.Old", ...args]));
    assert.equal(result.schemaVersion, 4);
    assert.equal(
      result.component.deprecationReason,
      "This workflow is retired; use the native browser control.",
    );
    assert.equal(result.component.replacement, undefined);
  }
  f.add("Old", "", "deprecated");
  assert.ok(
    auditProject(f.config()).issues.some((item) => /catalogDeprecatedReason or/.test(item.message)),
  );
  f.add("Old", "* @catalogDeprecatedReason", "deprecated");
  assert.ok(
    auditProject(f.config()).issues.some((item) =>
      /empty @catalogDeprecatedReason/.test(item.message),
    ),
  );
  f.add(
    "Old",
    "* @catalogDeprecatedReason Retired.\n * @catalogDeprecatedReason Duplicate.",
    "deprecated",
  );
  assert.ok(
    auditProject(f.config()).issues.some((item) =>
      /duplicate @catalogDeprecatedReason/.test(item.message),
    ),
  );
  f.add("Old", "* @catalogDeprecatedReason Retired.");
  assert.ok(
    auditProject(f.config()).issues.some((item) => /requires deprecated status/.test(item.message)),
  );
  f.add(
    "Old",
    "* @catalogDeprecatedReason Retired.\n * @catalogReplacement library.Absent",
    "deprecated",
  );
  assert.ok(auditProject(f.config()).issues.some((item) => item.code === "REPLACEMENT_INVALID"));
});

test("a resolved unsupported ignore blocks generation until ownership is reviewed", (t) => {
  const f = fixture(t);
  f.write(
    "client/ui/Wrapped.ts",
    "/** @componentCatalogIgnore unsupported: wrapper result */\nexport const Wrapped = memo(() => null);\n",
  );
  json(f.run(["generate"]));
  const before = fs.readFileSync(path.join(f.root, f.raw.catalog));
  f.write(
    "client/ui/Wrapped.ts",
    "/** @componentCatalogIgnore unsupported: wrapper result */\nexport function Wrapped() {}\n",
  );
  for (const command of ["audit", "check"]) {
    const report = json(f.run([command]), 1);
    assert.ok(
      report.issues.some(
        (item) => item.code === "IGNORE_REVIEW_REQUIRED" && item.exportName === "Wrapped",
      ),
    );
    assert.equal(report.counts.ignoredUnsupported, 1);
  }
  assert.equal(f.run(["generate"]).status, 1);
  assert.deepEqual(fs.readFileSync(path.join(f.root, f.raw.catalog)), before);
  f.add("Wrapped");
  json(f.run(["generate"]));
  assert.equal(json(f.run(["check"])).counts.generated, 1);
});

test("doctor diagnoses project readiness without requiring enrollment or changing files", (t) => {
  const f = fixture(t);
  f.write("client/ui/Card.ts", "export function Card() {}\n");
  const before = fs.readFileSync(f.configPath);
  const timestamp = fs.statSync(f.configPath).mtimeMs;
  const report = json(f.run(["doctor", "--expect-version", "0.2.0"]));
  assert.equal(report.scope, "project");
  assert.equal(report.checks.find((item) => item.id === "catalog").status, "not_run");
  assert.equal(fs.existsSync(path.join(f.root, f.raw.catalog)), false);
  assert.deepEqual(fs.readFileSync(f.configPath), before);
  assert.equal(fs.statSync(f.configPath).mtimeMs, timestamp);
  assert.equal(f.run(["audit"]).status, 1); // readiness must not claim enrollment coverage
  f.write("client/ui/Card.ts", "import { Card } from 'missing-ui-package';\nexport { Card };\n");
  const missing = json(f.run(["doctor"]), 1);
  assert.equal(missing.checks.find((item) => item.id === "project-dependencies").status, "fail");
  f.write("client/ui/Card.ts", "export function Card() {}\n");
  f.raw.componentRoots[0].path = "client/absent";
  f.write("component-catalog.config.json", f.raw);
  assert.equal(
    json(f.run(["doctor"]), 1).checks.find((item) => item.id === "paths").status,
    "fail",
  );
  f.raw.componentRoots[0].path = "client/ui";
  f.raw.configVersion = 1;
  delete f.raw.componentRoots[0].enrollment;
  f.write("component-catalog.config.json", f.raw);
  assert.equal(
    json(f.run(["doctor"]), 1).checks.find((item) => item.id === "enrollment-policy").status,
    "fail",
  );
  f.write("tsconfig.json", "{broken");
  assert.equal(
    json(f.run(["doctor"]), 1).checks.find((item) => item.id === "project-dependencies").status,
    "fail",
  );
});

test("export coverage includes named defaults, broken aliases and ambiguous barrels", (t) => {
  const f = fixture(t);
  f.add("Button");
  f.write("client/ui/Default.ts", "export default function Default() {}\n");
  assert.ok(
    auditProject(f.config()).issues.some(
      (item) => item.code === "UNREGISTERED_COMPONENT" && item.exportName === "Default",
    ),
  );
  fs.unlinkSync(path.join(f.root, "client/ui/Default.ts"));
  f.write("client/ui/aliases.ts", "export { Absent } from './Button';\n");
  assert.ok(auditProject(f.config()).issues.some((item) => item.code === "UNRESOLVED_EXPORT"));
  f.write("client/ui/aliases.ts", "import type { Button } from './Button';\nexport { Button };\n");
  assert.deepEqual(auditProject(f.config()).issues, []);
  f.write("client/foreign/Other.ts", "export function Button() {}\n");
  f.write("client/ui/aliases.ts", "export * from './Button';\nexport * from '../foreign/Other';\n");
  assert.ok(auditProject(f.config()).issues.some((item) => item.code === "AMBIGUOUS_EXPORT"));
  f.write("client/ui/aliases.ts", "export * from './cycle';\nexport * from './Button';\n");
  f.write("client/ui/cycle.ts", "export * from './aliases';\n");
  const report = auditProject(f.config());
  assert.deepEqual(report.issues, []);
  assert.equal(report.counts.candidates, 1);
});

test("check reports missing and corrupt snapshots and generation repairs them explicitly", (t) => {
  const f = fixture(t);
  f.add("Button");
  json(f.run(["audit"]));
  assert.ok(json(f.run(["check"]), 1).issues.some((item) => item.code === "CATALOG_MISSING"));
  f.write(f.raw.catalog, "{corrupt");
  assert.ok(json(f.run(["audit"]), 1).issues.some((item) => item.code === "CATALOG_INVALID"));
  assert.equal(fs.readFileSync(path.join(f.root, f.raw.catalog), "utf8"), "{corrupt");
  json(f.run(["generate"]));
  json(f.run(["check"]));
});

test("audit is bounded but hidden findings and pagination still fail", (t) => {
  const f = fixture(t);
  for (let i = 0; i < 65; i++)
    f.write(`client/ui/Entry${i}.ts`, `export function Entry${i}() {}\n`);
  const full = auditProject(f.config());
  assert.equal(full.counts.undecided, 65);
  let offset = 0;
  const found = [];
  do {
    const report = auditResponse(full, { offset, limit: 50 });
    assert.ok(Buffer.byteLength(JSON.stringify(report) + "\n") <= 8192);
    assert.equal(report.status, "fail");
    assert.equal(report.counts.issues, 65);
    found.push(...report.issues.map((item) => item.sourcePath));
    offset = report.nextOffset;
  } while (offset !== null);
  assert.equal(new Set(found).size, 65);
  const last = json(f.run(["audit", "--offset", "65"]), 1);
  assert.deepEqual(last.issues, []);
  assert.equal(last.status, "fail");
  const oversized = auditResponse({
    ...full,
    issues: [{ code: "GENERATION_INVALID", message: "大".repeat(10000) }],
    counts: { ...full.counts, issues: 1 },
  });
  assert.ok(Buffer.byteLength(JSON.stringify(oversized) + "\n") <= 8192);
  assert.deepEqual(oversized.omitted.fields, ["issues[0].message"]);
});

test("v1 remains usable and cannot silently claim enrollment coverage", (t) => {
  const f = fixture(t);
  f.raw.configVersion = 1;
  delete f.raw.componentRoots[0].enrollment;
  f.write("component-catalog.config.json", f.raw);
  assert.equal(f.config().configVersion, 1);
  assert.throws(() => auditProject(f.config()), /require configVersion 2/);
  const result = f.run(["check"]);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  f.add("Button");
  f.write("client/ui/Unmarked.ts", "export function Unmarked() {}\n");
  assert.equal(json(f.run(["generate"])).components, 1);
  json(f.run(["generate", "--check"]));
  assert.equal(json(f.run(["search", "Button"])).items.length, 1);
  assert.equal(json(f.run(["get", "library.Button"])).component.exportName, "Button");
  f.raw.configVersion = 2;
  f.write("component-catalog.config.json", f.raw);
  assert.equal(f.run(["audit"]).status, 2); // policy choice is required, not inferred from folder names
});

test("unsupported files, symlinks and syntax failures cannot become an empty pass", (t) => {
  const f = fixture(t);
  f.write("client/ui/Card.jsx", "export function Card() { return <div/>; }\n");
  assert.ok(
    auditProject(f.config()).issues.some((item) => item.code === "UNSUPPORTED_SOURCE_FILE"),
  );
  f.raw.exclude = ["client/ui/Card.jsx"];
  f.write("component-catalog.config.json", f.raw);
  assert.deepEqual(auditProject(f.config()).issues, []);
  fs.symlinkSync(path.join(f.root, "client/ui/Card.jsx"), path.join(f.root, "client/ui/Link.ts"));
  assert.ok(auditProject(f.config()).issues.some((item) => item.code === "UNSCANNED_SYMLINK"));
  fs.unlinkSync(path.join(f.root, "client/ui/Link.ts"));
  f.write("client/ui/Broken.ts", "export function Broken( {\n");
  assert.ok(auditProject(f.config()).issues.some((item) => item.code === "SOURCE_SYNTAX"));
  f.write("tsconfig.json", "{bad");
  const unable = f.run(["audit"]);
  assert.equal(unable.status, 2);
  assert.equal(unable.stdout, "");
  assert.equal(f.run(["audit", "--bad"]).status, 2);
});
