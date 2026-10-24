import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const skill = path.join(root, "skills/component-catalog");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

test("a copied skill runs independently of the repository and leaves consumer dependencies alone", (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "catalog skill install "));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const installed = path.join(temporary, "component-catalog");
  fs.cpSync(skill, installed, {
    recursive: true,
    filter: (file) => path.basename(file) !== "node_modules",
  });
  const scripts = path.join(installed, "scripts");
  const cli = path.join(scripts, "bin/component-catalog.mjs");
  const consumer = path.join(temporary, "consumer");
  fs.cpSync(path.join(root, "examples/basic"), consumer, { recursive: true });
  const run = (args, expected = 0) => {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: consumer,
      encoding: "utf8",
    });
    assert.equal(result.status, expected, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  };
  assert.equal(run(["--version"]).version, read(path.join(root, "package.json")).version);
  assert.equal(
    run(["doctor", "--installation"], 1).checks.find((c) => c.id === "typescript").status,
    "fail",
  );
  // Supply the pinned dependency offline for repeatable tests. The actual npm ci
  // install path is also exercised during distribution validation, without making
  // every contributor's test suite depend on registry availability or npm cache.
  const dependency = path.dirname(
    createRequire(import.meta.url).resolve("typescript/package.json"),
  );
  fs.cpSync(dependency, path.join(scripts, "node_modules/typescript"), { recursive: true });
  assert.equal(run(["doctor", "--installation"]).status, "pass");
  assert.ok(run(["scan", path.join(consumer, "src")]).counts.candidates > 0);
  assert.ok(run(["generate"]).components > 0);
  assert.equal(run(["check"]).status, "pass");
  const found = run(["search", "按钮"]);
  assert.equal(found.items[0].id, "demo.ui.Button");
  assert.equal(
    run(["get", "demo.ui.Button", "--prop", "disabled"]).component.prop.name,
    "disabled",
  );
  assert.equal(fs.existsSync(path.join(consumer, "node_modules")), false);
  assert.equal(fs.existsSync(path.join(consumer, "package-lock.json")), false);
  assert.equal(fs.existsSync(path.join(installed, "test")), false);
});

test("repository and standalone skill manifests keep the same runtime contract", () => {
  const repository = read(path.join(root, "package.json"));
  const runtime = read(path.join(skill, "scripts/package.json"));
  const lock = read(path.join(skill, "scripts/package-lock.json"));
  for (const field of ["name", "version", "engines", "dependencies"])
    assert.deepEqual(runtime[field], repository[field], field);
  assert.deepEqual(lock.packages[""].dependencies, runtime.dependencies);
  assert.equal(lock.version, runtime.version);
});
