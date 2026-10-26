import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadConfig, template } from "../skills/component-catalog/scripts/lib/config.mjs";
import { generateCatalog } from "../skills/component-catalog/scripts/lib/generate.mjs";
import { search, get, getMany } from "../skills/component-catalog/scripts/lib/query.mjs";

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
  const found = ok(f.run(["search", "按钮"])).items[0];
  assert.equal(found.id, "demo.ui.Button");
  assert.equal(found.importPath, "@demo/ui/Button");
  assert.equal(found.layer, "shared");
  assert.deepEqual(found.requiredProps, ["label"]);
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
  assert.equal(limited.omitted.byLimit, 3);
  assert.equal(limited.omitted.byBytes, 0);
  assert.equal(limited.truncated, false);
  const brief = search(baseCatalog, "button", 10, {}, true);
  assert.equal(brief.brief, true);
  assert.equal(brief.items[0].summary, undefined);
  assert.equal(brief.items[0].importPath, "@demo/ui/Button");
  const detailed = search(baseCatalog, "button", 5, {}, false, true);
  assert.equal(detailed.details, true);
  assert.ok(detailed.items[0].constraint);
  assert.ok(detailed.items[0].usage);
  const detailedBrief = search(baseCatalog, "button", 5, {}, true, true);
  assert.equal(detailedBrief.items[0].summary, undefined);
  assert.ok(detailedBrief.items[0].constraint);
  const layered = search(baseCatalog, "button", 5, {}, false, false, "shared");
  assert.equal(layered.layer, "shared");
  assert.ok(layered.items.length > 0);
  assert.ok(layered.items.every((item) => item.layer === "shared"));
  const noLayer = search(baseCatalog, "button", 5, {}, false, false, "missing");
  assert.equal(noLayer.items.length, 0);
  assert.equal(noLayer.omitted.byLimit, 0);
  assert.equal(noLayer.truncated, false);
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

test("specific vocabulary phrases override contained terms without losing independent concepts", () => {
  const base = baseCatalog.components[0];
  const catalog = {
    ...baseCatalog,
    components: [
      { id: "ui.ADialog", exportName: "Dialog", tasks: ["dialog"] },
      { id: "ui.ZConfirm", exportName: "Confirm", tasks: ["confirmation"] },
      { id: "ui.Drawer", exportName: "Drawer", tasks: ["drawer"] },
    ].map((item) => ({ ...base, summary: "Unrelated", ...item })),
  };
  const vocabulary = {
    弹窗: { primary: "dialog", related: [] },
    确认弹窗: { primary: "confirmation", related: ["dialog"] },
    抽屉: { primary: "drawer", related: [] },
  };
  for (const query of ["确认弹窗", "需要一个确认弹窗"]) {
    assert.deepEqual(
      search(catalog, query, 5, vocabulary).items.map((x) => x.exportName),
      ["Confirm", "Dialog"],
    );
  }
  assert.deepEqual(
    search(catalog, "弹窗和抽屉", 5, vocabulary).items.map((x) => x.exportName),
    ["Dialog", "Drawer"],
  );
  assert.deepEqual(
    search(catalog, "弹窗", 5, vocabulary).items.map((x) => x.exportName),
    ["Dialog"],
  );
  assert.deepEqual(
    search(catalog, "确认弹窗", 5, Object.fromEntries(Object.entries(vocabulary).reverse())),
    search(catalog, "确认弹窗", 5, vocabulary),
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
  assert.equal(found.omitted.byBytes, 1);
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
  for (const entry of legacy.components) {
    delete entry.reuse;
    delete entry.importExtension;
  }
  f.write(f.config.catalog, legacy);
  assert.equal(ok(f.run(["get", "demo.ui.Button"])).schemaVersion, 3);
  assert.deepEqual(ok(f.run(["search", "Button"])).items[0].reuse, { scope: "unspecified" });
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

test("reuse boundary is validated in stored snapshots and preserved under output limits", (t) => {
  const f = fixture(t);
  const catalog = structuredClone(baseCatalog);
  const item = catalog.components[0];
  item.reuse = { scope: "module", owner: "billing" };
  item.constraints = ["large ".repeat(4000)];
  f.write(f.config.catalog, catalog);
  const detail = ok(f.run(["get", item.id]));
  assert.ok(size(detail) <= 16384);
  assert.deepEqual(detail.component.reuse, item.reuse);
  assert.equal(detail.truncated, true);
  for (const reuse of [undefined, { scope: "module" }, { scope: "project", owner: "../billing" }]) {
    item.reuse = reuse;
    f.write(f.config.catalog, catalog);
    fails(f.run(["get", item.id]), /Invalid catalog/);
  }
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
      c.importPathStyle = "alias";
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
      paths: { "@acme/widgets/*": ["./code/widgets/*"], "~controls/*": ["./code/controls/*"] },
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
    "import { Picker } from '@acme/widgets/forms/Picker';\nimport { Fields } from '~controls/Fields';\nexport const demo = Picker({ value: { id: 1 }, rowKey: 'id' });\nexport const helpers = Fields;\n",
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

test("oversized inherited props fall back to a bounded prop index", () => {
  const base = structuredClone(baseCatalog.components[0]);
  base.props.items = Array.from({ length: 300 }, (_, index) => ({
    name: `prop${index}`,
    displayType: "string",
    required: false,
    schemaStatus: "complete",
  }));
  base.props.displayType = "React.HTMLAttributes<HTMLElement>";
  const catalog = { ...baseCatalog, components: [base] };
  const summary = get(catalog, base.id);
  assert.ok(size(summary) <= 16384);
  assert.ok(summary.omitted.fields.includes("props"));
  assert.equal(summary.truncated, true);
  assert.equal(summary.component.props, undefined);
  assert.equal(summary.component.propIndex, undefined);
  assert.equal(summary.component.propsSummary.total, 300);
  assert.match(summary.component.propsSummary.hint, /--include props/);
  const detail = get(catalog, base.id, ["props"]);
  assert.ok(size(detail) <= 16384);
  assert.ok(detail.omitted.fields.includes("props"));
  assert.equal(detail.truncated, true);
  assert.equal(detail.component.props, undefined);
  assert.equal(detail.component.propIndex.total, 300);
  assert.equal(detail.component.propIndex.names.length, 300);
  assert.equal(detail.component.propIndex.names[299], "prop299");
  assert.deepEqual(detail.component.propIndex.required, []);
  assert.deepEqual(detail.component.propIndex.inheritedTypes, base.props.inheritedTypes);
});

test("batch get returns bounded component details and rejects ambiguous selectors", (t) => {
  const f = fixture(t);
  const catalog = JSON.parse(fs.readFileSync(f.catalogFile, "utf8"));
  const second = structuredClone(catalog.components[0]);
  second.id = "demo.ui.Second";
  second.exportName = "Second";
  second.summary = "Second component.";
  catalog.components.push(second);
  f.write("component-catalog.json", catalog);
  const batch = ok(f.run(["get", "demo.ui.Button", "demo.ui.Second", "demo.ui.Button"]));
  assert.equal(batch.components.length, 2);
  assert.equal(batch.components[0].id, "demo.ui.Button");
  assert.equal(batch.components[1].id, "demo.ui.Second");
  assert.ok(Buffer.byteLength(JSON.stringify(batch) + "\n") <= 16384);
  assert.equal(batch.truncated, false);
  assert.equal(batch.omitted.components, 0);
  fails(f.run(["get", "demo.ui.Button", "demo.ui.Second", "--prop", "label"]), /single component ID/);
  fails(f.run(["get", "demo.ui.Button", "demo.ui.Second", "--from", "src/Page.tsx"]), /single component ID/);
  fails(f.run(["get", "demo.ui.Button", "missing"]), /Unknown component ID/);
  fails(f.run(["get", "a", "b", "c", "d", "e", "f"]), /1–5/);

  const first = structuredClone(catalog.components[0]);
  const heavyProps = Array.from({ length: 240 }, (_, index) => ({
    name: `prop${index}`,
    displayType: "string",
    required: false,
    schemaStatus: "complete",
  }));
  const heavy = Array.from({ length: 5 }, (_, index) => ({
    ...structuredClone(first),
    id: `demo.ui.Heavy${index}`,
    exportName: `Heavy${index}`,
    props: { ...first.props, items: heavyProps },
    constraints: ["x".repeat(200)],
    examples: [first.examples[0], { ...first.examples[0], purpose: "y".repeat(100) }],
  }));
  const bounded = getMany({ ...catalog, components: heavy }, heavy.map((item) => item.id), ["props", "usage", "constraints", "examples"]);
  assert.ok(Buffer.byteLength(JSON.stringify(bounded) + "\n") <= 16384);
  assert.equal(bounded.truncated, true);
  assert.ok(bounded.omitted.components >= 1);
});

test("ASCII vocabulary terms require word boundaries", () => {
  const base = baseCatalog.components[0];
  const catalog = {
    ...baseCatalog,
    components: [
      {
        id: "ui.Button",
        exportName: "Button",
        summary: "Unrelated",
        tasks: ["button"],
        props: { ...base.props, items: [{ ...base.props.items[0], name: "isLoading" }] },
      },
      {
        id: "ui.Spinner",
        exportName: "Spinner",
        summary: "Unrelated",
        tasks: ["loading"],
        props: { ...base.props, items: [] },
      },
    ].map((item) => ({ ...base, ...item })),
  };
  const vocabulary = { loading: { primary: "loading", related: [] } };
  assert.deepEqual(
    search(catalog, "isLoading", 5, vocabulary).items.map((item) => item.exportName),
    ["Button"],
  );
  assert.equal(search(catalog, "loading", 5, vocabulary).items[0].exportName, "Spinner");
});

test("barrel import style uses a real directory entrypoint", (t) => {
  const f = fixture(t);
  fs.cpSync(basic, f.dir, {
    recursive: true,
    filter: (source) => path.basename(source) !== "component-catalog.json",
  });
  const config = JSON.parse(fs.readFileSync(f.configFile, "utf8"));
  config.importPathStyle = "barrel";
  f.write("component-catalog.config.json", config);
  f.write("src/components/forms/index.ts", "export * from '../Button';\n");
  assert.equal(ok(f.run(["generate"])).components, 1);
  const detail = ok(f.run(["get", "demo.ui.Button"]));
  assert.equal(detail.component.importPath, "@demo/ui/forms");
  const generated = JSON.parse(fs.readFileSync(f.catalogFile, "utf8"));
  assert.equal(generated.components[0].importExtension, "omit");
});

test("opt-in usage log records command metadata without changing output", (t) => {  const f = fixture(t);
  const log = path.join(f.dir, "usage.jsonl");
  const result = spawnSync(
    process.execPath,
    [cli, "--config", f.configFile, "search", "button"],
    {
      cwd: os.tmpdir(),
      encoding: "utf8",
      env: { ...process.env, COMPONENT_CATALOG_LOG: log, COMPONENT_CATALOG_TASK: "task-1" },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  const [entry] = fs
    .readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(entry.command, "search");
  assert.equal(entry.argument, "button");
  assert.equal(entry.task, "task-1");
  assert.deepEqual(entry.resultIds, ["demo.ui.Button"]);
  assert.equal(entry.outputBytes, Buffer.byteLength(result.stdout));
  assert.equal(entry.truncated, output.truncated);
  assert.equal(entry.status, null);
  assert.ok(entry.durationMs >= 0);

  const failureLog = path.join(f.dir, "failure.jsonl");
  const failed = spawnSync(
    process.execPath,
    [cli, "--config", f.configFile, "search", "--limit", "2"],
    {
      cwd: os.tmpdir(),
      encoding: "utf8",
      env: { ...process.env, COMPONENT_CATALOG_LOG: failureLog, COMPONENT_CATALOG_TASK: "task-fail" },
    },
  );
  assert.notEqual(failed.status, 0);
  const [failure] = fs
    .readFileSync(failureLog, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(failure.command, "search");
  assert.equal(failure.task, "task-fail");
  assert.equal(failure.options.limit, "2");
  assert.match(failure.error, /search/i);
});
