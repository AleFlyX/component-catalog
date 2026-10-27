import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeFileAtomic } from "../skills/component-catalog/scripts/lib/files.mjs";

test("writeFileAtomic writes content and removes its temporary file", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "component-catalog-atomic-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const target = path.join(dir, "nested", "catalog.json");
  writeFileAtomic(target, "content\n");
  assert.equal(fs.readFileSync(target, "utf8"), "content\n");
  assert.deepEqual(fs.readdirSync(dir), ["nested"]);
  assert.deepEqual(fs.readdirSync(path.dirname(target)), ["catalog.json"]);
});

test("writeFileAtomic cleans up when the rename fails", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "component-catalog-atomic-fail-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const target = path.join(dir, "target");
  fs.mkdirSync(target);
  assert.throws(() => writeFileAtomic(target, "content"));
  assert.deepEqual(fs.readdirSync(dir).filter((name) => name.endsWith(".tmp")), []);
});
