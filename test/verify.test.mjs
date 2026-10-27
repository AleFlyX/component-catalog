import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadConfig } from "../skills/component-catalog/scripts/lib/config.mjs";
import { generateCatalog } from "../skills/component-catalog/scripts/lib/generate.mjs";
import { suggestVerifyQueries, verifyCatalog } from "../skills/component-catalog/scripts/lib/verify.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const config = loadConfig(path.join(root, "examples/basic/component-catalog.config.json"));
const catalog = generateCatalog(config);

test("verify accepts expected IDs, exports and absent IDs", () => {
  const result = verifyCatalog(catalog, [
    { query: "按钮", expectedId: "demo.ui.Button" },
    { query: "Button disabled", expectedIds: ["demo.ui.Button"], expectedExport: "Button" },
    { query: "totally absent", absentIds: ["demo.ui.Button"] },
    { query: "totally absent", expectNoResults: true },
  ], config.vocabulary);
  assert.equal(result.ok, true);
  assert.equal(result.counts.queries, 4);
  assert.equal(result.counts.failed, 0);
});

test("verify reports missing IDs and present absent IDs", () => {
  const result = verifyCatalog(catalog, [
    { query: "按钮", expectedId: "demo.ui.Missing" },
    { query: "按钮", absentIds: ["demo.ui.Button"] },
  ], config.vocabulary);
  assert.equal(result.ok, false);
  assert.deepEqual(result.results[0].missingIds, ["demo.ui.Missing"]);
  assert.deepEqual(result.results[1].presentAbsent, ["demo.ui.Button"]);
  assert.equal(result.byScope.general.rate, 0);
});

test("verify rejects queries without expectations or with an invalid limit", () => {
  assert.throws(() => verifyCatalog(catalog, [{ query: "按钮" }], config.vocabulary), /expectedIds/);
  assert.throws(
    () => verifyCatalog(catalog, [{ query: "按钮", expectedId: "demo.ui.Button", limit: 11 }], config.vocabulary),
    /limit/,
  );
});

test("verify CLI returns 0/1/2 for pass, miss and invalid invocation", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "component-catalog-verify-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const queries = path.join(dir, "queries.json");
  const cli = path.join(root, "bin/component-catalog.mjs");
  const configPath = path.join(root, "examples/basic/component-catalog.config.json");
  fs.writeFileSync(queries, JSON.stringify([{ query: "按钮", expectedId: "demo.ui.Button" }]));
  const pass = spawnSync(process.execPath, [cli, "--config", configPath, "verify", "--queries", queries], { encoding: "utf8" });
  assert.equal(pass.status, 0, pass.stderr);
  fs.writeFileSync(queries, JSON.stringify([{ query: "按钮", expectedId: "demo.ui.Missing" }]));
  const miss = spawnSync(process.execPath, [cli, "--config", configPath, "verify", "--queries", queries], { encoding: "utf8" });
  assert.equal(miss.status, 1);
  const invalid = spawnSync(process.execPath, [cli, "--config", configPath, "verify"], { encoding: "utf8" });
  assert.equal(invalid.status, 2);
});

test("suggest produces exact export-name and unique task queries", () => {
  const suggestions = suggestVerifyQueries(catalog, config.vocabulary);
  assert.deepEqual(
    suggestions.map((item) => [item.scope, item.query, item.expectedId]),
    [
      ["self", "Button", "demo.ui.Button"],
      ["task", "button", "demo.ui.Button"],
      ["vocabulary", "按钮", "demo.ui.Button"],
    ],
  );
});

test("verify CLI --suggest prints a query array", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "component-catalog-suggest-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const cli = path.join(root, "bin/component-catalog.mjs");
  const configPath = path.join(root, "examples/basic/component-catalog.config.json");
  const run = spawnSync(process.execPath, [cli, "--config", configPath, "verify", "--suggest"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const queries = JSON.parse(run.stdout);
  assert.ok(Array.isArray(queries));
  assert.ok(queries.some((item) => item.query === "Button" && item.expectedId === "demo.ui.Button"));
  const both = spawnSync(process.execPath, [cli, "--config", configPath, "verify", "--suggest", "--queries", path.join(dir, "q.json")], { encoding: "utf8" });
  assert.equal(both.status, 2);
});

test("suggest adds one same-layer mixed query", () => {
  const multi = structuredClone(catalog);
  multi.components.push({
    ...structuredClone(catalog.components[0]),
    id: "demo.ui.Other",
    exportName: "Other",
    tasks: ["other"],
  });
  const suggestions = suggestVerifyQueries(multi, config.vocabulary);
  const mixed = suggestions.find((item) => item.scope === "mixed-auto");
  assert.deepEqual(mixed.expectedIds.sort(), ["demo.ui.Button", "demo.ui.Other"]);
  assert.equal(mixed.query, "Button Other");
});
