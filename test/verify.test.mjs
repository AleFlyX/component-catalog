import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadConfig } from "../skills/component-catalog/scripts/lib/config.mjs";
import { generateCatalog } from "../skills/component-catalog/scripts/lib/generate.mjs";
import { suggestVerifyQueries, summarizeVerifyResult, verifyCatalog } from "../skills/component-catalog/scripts/lib/verify.mjs";

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
  const log = path.join(dir, "usage.jsonl");
  const pass = spawnSync(process.execPath, [cli, "--config", configPath, "verify", "--queries", queries], {
    encoding: "utf8",
    env: { ...process.env, COMPONENT_CATALOG_LOG: log },
  });
  assert.equal(pass.status, 0, pass.stderr);
  const passOutput = JSON.parse(pass.stdout);
  assert.deepEqual(passOutput.results, []);
  assert.equal(passOutput.resultsOmitted, 1);
  const logEntry = JSON.parse(fs.readFileSync(log, "utf8").trim());
  assert.equal(logEntry.verifyOk, true);
  assert.equal(logEntry.verifyQueries, 1);
  assert.equal(logEntry.verifyFailed, 0);
  assert.equal(logEntry.verifyResultsOmitted, 1);
  const detailed = spawnSync(process.execPath, [cli, "--config", configPath, "verify", "--queries", queries, "--details"], { encoding: "utf8" });
  assert.equal(detailed.status, 0, detailed.stderr);
  assert.equal(JSON.parse(detailed.stdout).results.length, 1);
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
  const suggestions = suggestVerifyQueries(multi, {
    ...config.vocabulary,
    other: { primary: "other", related: [] },
  });
  const mixed = suggestions.find((item) => item.scope === "mixed-auto");
  assert.deepEqual(mixed.expectedIds.sort(), ["demo.ui.Button", "demo.ui.Other"]);
  assert.equal(mixed.query, "Button Other");
  const taskMixed = suggestions.find((item) => item.scope === "mixed-task-auto");
  assert.deepEqual(taskMixed.expectedIds.sort(), ["demo.ui.Button", "demo.ui.Other"]);
  assert.equal(taskMixed.query, "button other");
  const vocabularyMixed = suggestions.find((item) => item.scope === "mixed-vocabulary-auto");
  assert.deepEqual(vocabularyMixed.expectedIds.sort(), ["demo.ui.Button", "demo.ui.Other"]);
  assert.equal(vocabularyMixed.query, "按钮 other");
});

test("suggested queries pass against all committed airport fixtures", () => {
  for (const size of ["30", "40", "55", "57"]) {
    const dir = path.join(root, `test/fixtures/airport-${size}`);
    const fixtureConfig = JSON.parse(fs.readFileSync(path.join(dir, "trial-config.json"), "utf8"));
    const fixtureCatalog = JSON.parse(
      zlib.gunzipSync(fs.readFileSync(path.join(dir, "catalog.json.gz"))).toString("utf8"),
    );
    const queries = suggestVerifyQueries(fixtureCatalog, fixtureConfig.vocabulary);
    const result = verifyCatalog(fixtureCatalog, queries, fixtureConfig.vocabulary);
    assert.equal(result.ok, true, `airport-${size}: ${JSON.stringify(result.results.filter((item) => !item.ok))}`);
    assert.ok(queries.some((item) => item.scope === "mixed-auto"));
    assert.ok(queries.some((item) => item.scope === "mixed-task-auto"));
    assert.ok(queries.some((item) => item.scope === "mixed-vocabulary-auto"));
  }
});

test("verify summary keeps failures and omits passing details", () => {
  const full = verifyCatalog(catalog, [
    { query: "按钮", expectedId: "demo.ui.Button" },
    { query: "按钮", expectedId: "demo.ui.Missing" },
  ], config.vocabulary);
  const summary = summarizeVerifyResult(full);
  assert.equal(summary.results.length, 1);
  assert.equal(summary.results[0].ok, false);
  assert.equal(summary.resultsIncluded, 1);
  assert.equal(summary.resultsOmitted, 1);
  assert.equal(summarizeVerifyResult(full, { details: true }).results.length, 2);
});

test("verify --out writes query suggestions and a report", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "component-catalog-out-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const cli = path.join(root, "bin/component-catalog.mjs");
  const configPath = path.join(root, "examples/basic/component-catalog.config.json");
  const queries = path.join(dir, "queries.json");
  const report = path.join(dir, "report.json");
  const suggest = spawnSync(process.execPath, [cli, "--config", configPath, "verify", "--suggest", "--out", queries], { encoding: "utf8" });
  assert.equal(suggest.status, 0, suggest.stderr);
  assert.equal(JSON.parse(suggest.stdout).queries, 3);
  assert.ok(Array.isArray(JSON.parse(fs.readFileSync(queries, "utf8"))));
  const run = spawnSync(process.execPath, [cli, "--config", configPath, "verify", "--queries", queries, "--out", report], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const reportData = JSON.parse(fs.readFileSync(report, "utf8"));
  assert.equal(reportData.ok, true);
  assert.equal(reportData.results.length, 3);
});
