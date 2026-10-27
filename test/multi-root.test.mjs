import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const cli = path.join(root, "skills/component-catalog/scripts/bin/component-catalog.mjs");
const fixture = path.join(root, "test/fixtures/multi-root");

function run(args, cwd) {
  return spawnSync(process.execPath, [cli, "--config", path.join(cwd, "component-catalog.config.json"), ...args], {
    cwd,
    encoding: "utf8",
  });
}

test("multi-root componentRoots fixture generates, checks and verifies in a temp checkout", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "component-catalog-multi-root-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.cpSync(fixture, dir, { recursive: true });
  const configPath = path.join(dir, "component-catalog.config.json");

  const generated = run(["generate"], dir);
  assert.equal(generated.status, 0, generated.stderr);
  const output = JSON.parse(generated.stdout);
  assert.equal(output.components, 3);
  assert.equal(output.typeScope, "componentRoots");
  assert.equal(output.typeCheck, "partial");
  assert.equal(output.suppressedTypeDiagnostics, 1);
  assert.deepEqual(output.suppressedTypeFiles, [{ sourcePath: "src/ui/Button.tsx", count: 1 }]);
  assert.match(output.sourceDigest, /^sha256:[0-9a-f]{64}$/);

  const checked = run(["check"], dir);
  assert.equal(checked.status, 0, checked.stderr);
  const check = JSON.parse(checked.stdout);
  assert.equal(check.status, "pass");
  assert.equal(check.typeCheck, "partial");
  assert.equal(check.counts.candidates, 4);
  assert.equal(check.counts.ignoredUnsupported, 1);
  assert.equal(check.discovery.status, "partial");
  assert.equal(fs.existsSync(path.join(dir, "catalog.json")), true);
  assert.equal(fs.existsSync(path.join(fixture, "catalog.json")), false);

  const suggested = run(["verify", "--suggest", "--out", "queries.json"], dir);
  assert.equal(suggested.status, 0, suggested.stderr);
  assert.equal(JSON.parse(suggested.stdout).queries, 12);
  const queries = JSON.parse(fs.readFileSync(path.join(dir, "queries.json"), "utf8"));
  for (const scope of ["self", "task", "vocabulary", "mixed-auto", "mixed-task-auto", "mixed-vocabulary-auto"])
    assert.ok(queries.some((query) => query.scope === scope), `missing ${scope}`);

  const verified = run(["verify", "--queries", "queries.json", "--out", "verify.json"], dir);
  assert.equal(verified.status, 0, verified.stderr);
  const summary = JSON.parse(verified.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.counts.passed, 12);
  assert.deepEqual(summary.results, []);
  assert.equal(summary.resultsOmitted, 12);
  const report = JSON.parse(fs.readFileSync(path.join(dir, "verify.json"), "utf8"));
  assert.equal(report.results.length, 12);

  fs.writeFileSync(
    path.join(dir, "filtered.json"),
    JSON.stringify([
      { query: "button", expectedId: "ui.Button", layer: "shared-ui" },
      { query: "input", expectedId: "primitives.Input", layer: "primitives" },
      {
        query: "button form-field input",
        expectedIds: ["ui.Button", "forms.FormField", "primitives.Input"],
        perLayer: 1,
      },
    ]),
  );
  const filtered = run(["verify", "--queries", "filtered.json", "--out", "filtered-report.json"], dir);
  assert.equal(filtered.status, 0, filtered.stderr);
  assert.equal(JSON.parse(filtered.stdout).counts.passed, 3);
  const filteredReport = JSON.parse(fs.readFileSync(path.join(dir, "filtered-report.json"), "utf8"));
  assert.equal(filteredReport.results.length, 3);
  assert.equal(filteredReport.results[1].expectedIds[0], "primitives.Input");

  fs.writeFileSync(
    path.join(dir, "failing.json"),
    JSON.stringify([{ query: "button", expectedId: "ui.Missing" }]),
  );
  const failing = run(["verify", "--queries", "failing.json", "--out", "failing-report.json"], dir);
  assert.equal(failing.status, 1);
  const failedSummary = JSON.parse(failing.stdout);
  assert.equal(failedSummary.ok, false);
  assert.equal(failedSummary.results.length, 1);
  assert.deepEqual(failedSummary.results[0].missingIds, ["ui.Missing"]);
  const failedReport = JSON.parse(fs.readFileSync(path.join(dir, "failing-report.json"), "utf8"));
  assert.equal(failedReport.ok, false);
  assert.deepEqual(failedReport.results[0].missingIds, ["ui.Missing"]);

  assert.equal(fs.existsSync(configPath), true);
});
