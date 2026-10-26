import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const tool = fileURLToPath(new URL("../", import.meta.url));
const cli = path.join(tool, "bin/component-catalog.mjs");
function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-doctor-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}
function run(cwd, args, entry = cli) {
  return spawnSync(process.execPath, [entry, ...args], { cwd, encoding: "utf8" });
}
function json(result, status = 0) {
  assert.equal(result.status, status, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  assert.ok(Buffer.byteLength(result.stdout) <= 8192);
  return JSON.parse(result.stdout);
}

test("installation doctor works before configuration and rejects mismatched skill versions", (t) => {
  const cwd = fixture(t);
  const version = json(run(cwd, ["--version"]));
  assert.equal(version.version, "0.3.0");
  const good = json(run(cwd, ["doctor", "--installation", "--expect-version", version.version]));
  assert.equal(good.status, "pass");
  assert.equal(good.config, null);
  assert.equal(good.runtime.typescript, "5.9.3");
  const bad = json(run(cwd, ["doctor", "--installation", "--expect-version", "0.1.0"]), 1);
  assert.equal(bad.checks.find((item) => item.id === "cli-version").status, "fail");
  assert.equal(
    json(run(cwd, ["doctor"]), 1).checks.find((item) => item.id === "config").status,
    "fail",
  );
  assert.deepEqual(fs.readdirSync(cwd), []);
  for (const args of [
    ["doctor", "--installation", "--config", "absent.json"],
    ["doctor", "--expect-version", ">=0.3.0"],
    ["doctor", "--expect-version", "1".repeat(100) + ".0.0"],
    ["doctor", "--bad"],
    ["doctor", "--limit", "1"],
    ["doctor", "--expect-version"],
    ["--config", "absent.json", "doctor", "--expect-version"],
  ]) {
    const result = run(cwd, args);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
  }
});

test("doctor diagnoses absent tool dependencies without failing at module startup", (t) => {
  const cwd = fixture(t);
  for (const name of ["bin", "lib", "schema", "package.json"])
    fs.cpSync(path.join(tool, "skills/component-catalog/scripts", name), path.join(cwd, name), {
      recursive: true,
    });
  const result = json(
    run(cwd, ["doctor", "--installation"], path.join(cwd, "bin/component-catalog.mjs")),
    1,
  );
  assert.equal(result.checks.find((item) => item.id === "typescript").status, "fail");
  assert.equal(fs.existsSync(path.join(cwd, "node_modules")), false);
});

test("doctor distinguishes instruction revisions even when CLI versions match", (t) => {
  const cwd = fixture(t);
  const version = json(run(cwd, ["--version"]));
  assert.equal(version.skillRevision, 10);
  const args = ["doctor", "--installation", "--expect-version", "0.3.0", "--expect-skill-revision"];
  assert.equal(json(run(cwd, [...args, "10"])).status, "pass");
  const mismatch = json(run(cwd, [...args, "1"]), 1);
  assert.equal(mismatch.checks.find((c) => c.id === "cli-version").status, "pass");
  assert.equal(mismatch.checks.find((c) => c.id === "skill-revision").status, "fail");
  for (const value of ["0", "-1", "1.0", "1000000", ""])
    assert.equal(run(cwd, [...args, value]).status, 2);
  const isolated = path.join(cwd, "skill");
  fs.cpSync(path.join(tool, "skills/component-catalog"), isolated, {
    recursive: true,
    filter: (file) => path.basename(file) !== "node_modules",
  });
  const entry = path.join(isolated, "scripts/bin/component-catalog.mjs");
  fs.writeFileSync(
    path.join(isolated, "SKILL.md"),
    "---\nname: component-catalog\ndescription: Older instructions\n---\n",
  );
  const old = json(run(cwd, [...args, "1"], entry), 1);
  assert.equal(old.runtime.skillRevision, null);
  assert.equal(old.checks.find((c) => c.id === "skill-revision").status, "fail");
  fs.unlinkSync(path.join(isolated, "SKILL.md"));
  assert.equal(json(run(cwd, ["--version"], entry)).skillRevision, null);
});

test("oversized configuration diagnostics stay bounded and preserve failure status", (t) => {
  const cwd = fixture(t);
  const config = path.join(cwd, "component-catalog.config.json");
  fs.writeFileSync(
    config,
    JSON.stringify({ configVersion: 2, projectRoot: ".", sourceRoot: "../" + "长".repeat(15000) }),
  );
  const result = json(run(cwd, ["doctor", "--config", config]), 1);
  assert.equal(result.status, "fail");
  // Also cover an OS path diagnostic whose full input cannot fit in one response.
  const huge = json(run(cwd, ["doctor", "--config", "长".repeat(15000)]), 1);
  assert.equal(huge.truncated, true);
  assert.ok(huge.omitted.fields.some((field) => field.endsWith(".message")));
  assert.equal(huge.checks.find((item) => item.id === "config").status, "fail");
});
