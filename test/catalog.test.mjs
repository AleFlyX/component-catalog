import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadConfig, template } from "../lib/config.mjs";
import { generateCatalog } from "../lib/generate.mjs";
import { search, get } from "../lib/query.mjs";

const cli = fileURLToPath(new URL("../bin/component-catalog.mjs", import.meta.url));
const basic = fileURLToPath(new URL("../examples/basic/", import.meta.url));
const baseCatalog = generateCatalog(loadConfig(path.join(basic, "component-catalog.config.json")));
const encode = (value) => JSON.stringify(value) + "\n";
const size = (value) => Buffer.byteLength(encode(value));
function run(args, cwd = os.tmpdir()) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });
}
function ok(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}
function fails(result, pattern) {
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, pattern);
}
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "component-catalog-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const write = (file, value) => {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof value === "string" ? value : encode(value));
    return target;
  };
  const config = structuredClone(template);
  config.configVersion = 1;
  for (const root of config.componentRoots) delete root.enrollment;
  config.vocabulary = { 按钮: { primary: "button", related: [] } };
  const configFile = write("component-catalog.config.json", config);
  const catalogFile = write(config.catalog, baseCatalog);
  return {
    dir,
    config,
    configFile,
    catalogFile,
    write,
    run: (args, cwd) => run(["--config", configFile, ...args], cwd),
  };
}

test("configurable query, exact prop context, fields and offline source-free operation", (t) => {
  const f = fixture(t);
  const before = fs.readFileSync(f.catalogFile);
  const beforeStat = fs.statSync(f.catalogFile);
  assert.equal(ok(f.run(["search", "按钮"])).items[0].id, "demo.ui.Button");
  assert.equal(ok(f.run(["search", "ＤＩＳＡＢＬＥＤ"])).items[0].exportName, "Button");
  const focused = ok(f.run(["get", "demo.ui.Button", "--prop", "disabled"]));
  assert.equal(focused.component.prop.defaultValue, "false");
  assert.equal(focused.selection.partial, true);
  assert.ok(focused.component.propsContext);
  assert.ok(focused.component.constraints);
  assert.equal(focused.component.props, undefined);
  assert.equal(focused.truncated, false);
  const selected = ok(f.run(["get", "demo.ui.Button", "--include", "usage"]));
  assert.equal(selected.component.props, undefined);
  assert.equal(selected.component.usage.preview, 1);
  fs.mkdirSync(path.join(f.dir, "nested/deep"), { recursive: true });
  assert.equal(
    ok(run(["search", "button"], path.join(f.dir, "nested/deep"))).items[0].id,
    "demo.ui.Button",
  );
  assert.deepEqual(fs.readFileSync(f.catalogFile), before);
  assert.equal(fs.statSync(f.catalogFile).mtimeMs, beforeStat.mtimeMs);
});

test("ranking precedence, deterministic ties, empty results and limit", () => {
  const base = baseCatalog.components[0];
  const definitions = [
    {
      exportName: "Api",
      props: { ...base.props, items: [{ ...base.props.items[0], name: "rowKey" }] },
    },
    { exportName: "Summary", summary: "rowKey summary" },
    { exportName: "RowKeyHost" },
    { exportName: "Task", tasks: ["rowkey"] },
    { exportName: "RowKey", status: "experimental" },
  ];
  const catalog = {
    ...baseCatalog,
    components: definitions.map((item) => ({
      ...base,
      summary: "Unrelated",
      tasks: ["unrelated"],
      ...item,
      id: `ui.${item.exportName}`,
    })),
  };
  assert.deepEqual(
    search(catalog, "ROWKEY", 10).items.map((item) => item.exportName),
    ["RowKey", "Task", "RowKeyHost", "Summary", "Api"],
  );
  assert.deepEqual(search(catalog, "no-matches").items, []);
  const limited = search(catalog, "rowkey", 2);
  assert.equal(limited.items.length, 2);
  assert.equal(limited.omitted.items, 3);
  const ties = {
    ...baseCatalog,
    components: ["Z", "B", "A"].map((name) => ({
      ...base,
      id: `ui.${name}`,
      status: name === "A" ? "experimental" : "stable",
    })),
  };
  assert.deepEqual(
    search(ties, "button").items.map((item) => item.id),
    ["ui.B", "ui.Z", "ui.A"],
  );
  assert.deepEqual(
    search(ties, "button"),
    search({ ...ties, components: ties.components.toReversed() }, "button"),
  );
});

test("bounded UTF-8 JSON, omissions and mandatory focused context", () => {
  const base = structuredClone(baseCatalog.components[0]);
  const huge = "大".repeat(10000);
  base.summary = huge;
  let catalog = { ...baseCatalog, components: [base] };
  const found = search(catalog, "button");
  assert.ok(size(found) <= 4096);
  assert.equal(found.omitted.items, 1);
  assert.equal(found.truncated, true);
  let detail = get(catalog, base.id);
  assert.ok(size(detail) <= 16384);
  assert.ok(detail.omitted.fields.includes("summary"));
  detail = get(catalog, base.id, undefined, "label");
  assert.ok(size(detail) <= 16384);
  assert.equal(detail.component.prop.name, "label");
  assert.deepEqual(detail.component.constraints, base.constraints);
  base.props.items[0].description = huge;
  assert.throws(() => get(catalog, base.id, undefined, "label"), /exceed output limit/);
  base.summary = "Small";
  base.examples = Array(4).fill(base.examples[0]);
  detail = get(catalog, base.id);
  assert.ok(size(detail) <= 16384);
  assert.equal(detail.omitted.examples, 2);
  assert.ok(detail.omitted.fields.includes("props"));
});

test("CLI rejects invalid commands, IDs, fields and incompatible selectors", (t) => {
  const f = fixture(t);
  for (const args of [
    [],
    ["bad"],
    ["search"],
    ["search", ""],
    ["get", "demo.ui.Button", "--limit", "1"],
    ["search", "a", "--include", "props"],
    ["search", "a", "--prop", "label"],
    ["search", "a", "--limit", "11"],
    ["search", "a", "--limit", "0"],
    ["search", "a", "--limit", "1", "--limit", "2"],
    ["get", "demo.ui.Button", "--include", "oops"],
    ["get", "demo.ui.Button", "--include", "props,props"],
    ["get", "demo.ui.Button", "--prop", "label", "--include", "props"],
    ["get", "demo.ui.Button", "--prop", ""],
    ["generate", "--limit", "1"],
    ["search", "a", "--check"],
  ]) {
    fails(f.run(args), /component-catalog:/);
  }
  fails(f.run(["get", "unknown"]), /Unknown component ID/);
  fails(f.run(["get", "demo.ui.Button", "--prop", "Label"]), /Unknown catalog prop/);
  assert.equal(run(["--help"]).status, 0);
  assert.equal(ok(run(["init"])).configVersion, 2);
});

test("missing, damaged, duplicate and incompatible catalogs fail clearly", (t) => {
  const f = fixture(t);
  for (const [value, pattern] of [
    ["{broken", /Cannot read catalog JSON/],
    [{ ...baseCatalog, schemaVersion: 2 }, /expected 3/],
    [
      { ...baseCatalog, components: [baseCatalog.components[0], baseCatalog.components[0]] },
      /unique IDs/,
    ],
    [{ ...baseCatalog, extra: true }, /unexpected property/],
  ]) {
    f.write(f.config.catalog, value);
    fails(f.run(["search", "button"]), pattern);
  }
  fs.unlinkSync(f.catalogFile);
  fails(f.run(["search", "button"]), /Catalog missing.*generate/);
});

test("legacy v3 snapshots remain queryable while v4 preserves retirement reasons", (t) => {
  const f = fixture(t);
  const legacy = structuredClone(baseCatalog);
  legacy.schemaVersion = 3;
  f.write(f.config.catalog, legacy);
  assert.equal(ok(f.run(["get", "demo.ui.Button"])).schemaVersion, 3);
  assert.equal(ok(f.run(["search", "Button"])).items[0].exportName, "Button");
  legacy.components[0].deprecationReason = "A v4-only field";
  f.write(f.config.catalog, legacy);
  fails(f.run(["get", "demo.ui.Button"]), /unexpected property/);
  legacy.schemaVersion = 4;
  legacy.components[0].status = "deprecated";
  f.write(f.config.catalog, legacy);
  assert.equal(
    ok(f.run(["get", "demo.ui.Button", "--prop", "label"])).component.deprecationReason,
    "A v4-only field",
  );
});

test("config validation rejects mistakes and ambiguous roots", (t) => {
  const f = fixture(t);
  const mutations = [
    (c) => {
      c.configVersion = 99;
    },
    (c) => {
      c.typograph = true;
    },
    (c) => {
      c.componentRoots = [];
    },
    (c) => {
      c.componentRoots.push({
        ...c.componentRoots[0],
        path: "src/components/nested",
        idPrefix: "other",
      });
    },
    (c) => {
      c.catalog = "tsconfig.json";
    },
    (c) => {
      c.catalog = "../escape.json";
    },
    (c) => {
      c.componentRoots[0].path = "other";
    },
    (c) => {
      c.componentRoots[0].importPrefix = "../ui";
    },
    (c) => {
      c.vocabulary = [];
    },
    (c) => {
      c.vocabulary.bad = { primary: "BAD", related: [] };
    },
    (c) => {
      c.exclude = ["src"];
    },
    (c) => {
      c.testRoots = ["src/dev"];
      c.previewRoots = ["src/dev"];
    },
  ];
  for (const mutate of mutations) {
    const c = structuredClone(f.config);
    mutate(c);
    f.write("component-catalog.config.json", c);
    fails(f.run(["search", "button"]), /component-catalog:/);
  }
  f.write("component-catalog.config.json", "{broken");
  fails(f.run(["search", "button"]), /config JSON/);
  fs.unlinkSync(f.configFile);
  fails(run(["search", "button"], f.dir), /Config missing/);
});

test("generation works across custom layouts, multiple roots, aliases and explicit check", (t) => {
  const f = fixture(t);
  const c = {
    ...f.config,
    projectRoot: "..",
    sourceRoot: "packages/client/code",
    tsconfig: "packages/client/tsconfig.json",
    catalog: "artifacts/ui.json",
    componentRoots: [
      {
        path: "packages/client/code/widgets",
        idPrefix: "design",
        importPrefix: "@acme/widgets",
        layer: "foundation",
      },
      {
        path: "packages/client/code/controls",
        idPrefix: "controls",
        importPrefix: "~controls",
        layer: "feature",
      },
    ],
    previewRoots: ["packages/client/code/previews"],
    exclude: ["packages/client/code/generated"],
  };
  const configFile = f.write("config/catalog.json", c);
  f.write("packages/client/tsconfig.json", {
    compilerOptions: {
      strict: true,
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      paths: { "@acme/widgets/*": ["./code/widgets/*"] },
    },
    include: ["code"],
  });
  f.write(
    "packages/client/code/widgets/forms/Picker.ts",
    `type Props<T extends object> = { value: T; rowKey: keyof T & string; label?: string };
/**
 * Pick a record.
 * @componentCatalog
 * @catalogStatus stable
 * @catalogTask record-selection
 * @catalogConstraint Keep the record type.
 * @catalogExample preview packages/client/code/previews/picker.ts | Generic record
 */
export function Picker<T extends object>({ label: text = 'Pick', ...rest }: Props<T>) { return { text, ...rest }; }
`,
  );
  f.write(
    "packages/client/code/controls/Fields.ts",
    `import { Picker } from '@acme/widgets/forms/Picker';
/**
 * Field helpers.
 * @componentCatalog
 * @catalogStatus experimental
 * @catalogTask fields
 * @catalogConstraint Use the named member.
 * @catalogExample preview packages/client/code/previews/picker.ts | Helpers
 */
export const Fields = { Picker: Picker };
`,
  );
  f.write(
    "packages/client/code/previews/picker.ts",
    "import { Picker } from '@acme/widgets/forms/Picker';\nimport { Fields } from '../controls/Fields';\nexport const demo = Picker({ value: { id: 1 }, rowKey: 'id' });\nexport const helpers = Fields;\n",
  );
  f.write(
    "packages/client/code/generated/Bad.ts",
    "/** @componentCatalog */ export const Bad = 1;",
  );
  const args = ["--config", configFile];
  const generated = ok(run([...args, "generate"]));
  assert.equal(generated.components, 2);
  const output = path.join(f.dir, c.catalog);
  const before = fs.readFileSync(output);
  const catalog = JSON.parse(before);
  const item = catalog.components.find((item) => item.exportName === "Picker");
  assert.equal(item.id, "design.forms.Picker");
  assert.equal(item.importPath, "@acme/widgets/forms/Picker");
  assert.equal(item.layer, "foundation");
  assert.equal(
    item.props.items.find((prop) => prop.name === "rowKey").displayType,
    "keyof T & string",
  );
  assert.deepEqual(item.props.typeParameters, ["T extends object"]);
  assert.equal(item.props.items.find((prop) => prop.name === "label").defaultValue, "'Pick'");
  assert.equal(item.usage.preview, 1);
  const namespace = ok(run([...args, "get", "controls.Fields"]));
  assert.equal(namespace.component.members[0].name, "Picker");
  fails(run([...args, "get", "controls.Fields", "--prop", "Picker"]), /namespace/);
  assert.equal(ok(run([...args, "generate", "--check"])).command, "check");
  assert.deepEqual(fs.readFileSync(output), before);
  fs.appendFileSync(path.join(f.dir, c.sourceRoot, "widgets/forms/Picker.ts"), "\n// changed\n");
  fails(run([...args, "generate", "--check"]), /stale/);
  assert.deepEqual(fs.readFileSync(output), before);
  assert.equal(ok(run([...args, "generate"])).components, 2);
  f.write(c.catalog, "{broken");
  assert.equal(ok(run([...args, "generate"])).components, 2);
});

test("generation rejects output symlinks outside project and missing source roots", (t) => {
  const f = fixture(t);
  fails(f.run(["generate"]), /component-catalog:/);
  fs.mkdirSync(path.join(f.dir, "src/components"), { recursive: true });
  f.write("tsconfig.json", {});
  const external = fs.mkdtempSync(path.join(os.tmpdir(), "component-catalog-outside-"));
  t.after(() => fs.rmSync(external, { recursive: true, force: true }));
  const sentinel = path.join(external, "keep.json");
  fs.writeFileSync(sentinel, "{}");
  fs.unlinkSync(f.catalogFile);
  fs.symlinkSync(sentinel, f.catalogFile);
  fails(f.run(["generate"]), /symlink escapes/);
  assert.equal(fs.readFileSync(sentinel, "utf8"), "{}");
});

test("unsupported wrappers and invalid example bindings fail without publishing a catalog", (t) => {
  const f = fixture(t);
  fs.cpSync(basic, f.dir, {
    recursive: true,
    filter: (source) => path.basename(source) !== "component-catalog.json",
  });
  const file = path.join(f.dir, "src/components/Button.ts");
  const original = fs.readFileSync(file, "utf8");
  const before = fs.readFileSync(f.catalogFile);
  fs.writeFileSync(
    file,
    original.replace(
      "export function Button({ label, disabled = false }: ButtonProps) {\n  return { label, disabled };\n}",
      "export const Button = Object.assign(() => null, {});",
    ),
  );
  fails(f.run(["generate"]), /Unsupported @componentCatalog/);
  assert.deepEqual(fs.readFileSync(f.catalogFile), before);
  fs.writeFileSync(file, original);
  f.write("src/previews/button.ts", "export const preview = 1;");
  fails(f.run(["generate"]), /does not use the exported entry/);
});

test("co-located previews count and config does not coerce invalid vocabulary types", (t) => {
  const f = fixture(t);
  fs.cpSync(basic, f.dir, {
    recursive: true,
    filter: (source) => path.basename(source) !== "component-catalog.json",
  });
  const config = JSON.parse(fs.readFileSync(f.configFile, "utf8"));
  config.previewRoots = ["src/components/previews"];
  f.write("component-catalog.config.json", config);
  const source = fs.readFileSync(path.join(f.dir, "src/components/Button.ts"), "utf8");
  f.write(
    "src/components/Button.ts",
    source.replace("src/previews/button.ts", "src/components/previews/button.ts"),
  );
  f.write(
    "src/components/previews/button.ts",
    'import { Button } from "@demo/ui/Button";\nexport const demo = Button({ label: "Nested" });\n',
  );
  assert.equal(ok(f.run(["generate"])).components, 1);
  assert.equal(
    ok(f.run(["get", "demo.ui.Button", "--include", "usage"])).component.usage.preview,
    1,
  );
  for (const patch of [
    { vocabulary: null },
    { exclude: null },
    { vocabulary: { button: { primary: ["button"], related: [] } } },
  ]) {
    f.write("component-catalog.config.json", { ...config, ...patch });
    fails(f.run(["search", "button"]), /component-catalog:/);
  }
});
