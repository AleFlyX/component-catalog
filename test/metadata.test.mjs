import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));

test("package, locks, SKILL revision and README stay in sync", () => {
  const pkg = json("package.json");
  const lock = json("package-lock.json");
  const nestedPkg = json("skills/component-catalog/scripts/package.json");
  const nestedLock = json("skills/component-catalog/scripts/package-lock.json");
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
  assert.equal(nestedPkg.version, pkg.version);
  assert.equal(nestedLock.version, pkg.version);
  assert.equal(nestedLock.packages[""].version, pkg.version);

  const skill = read("skills/component-catalog/SKILL.md");
  const revision = /^---[\s\S]*?revision:\s*"([1-9][0-9]*)"[\s\S]*?---/m.exec(skill)?.[1];
  assert.ok(revision, "SKILL.md frontmatter must declare a revision");

  const readme = read("README.md");
  assert.match(readme, new RegExp(`CLI：\\x60${pkg.version.replaceAll(".", "\\.")}\\x60`));
  assert.match(readme, new RegExp(`Skill revision：\\x60${revision}\\x60`));
  assert.match(
    readme,
    new RegExp(`doctor --installation --expect-version ${pkg.version.replaceAll(".", "\\.")} --expect-skill-revision ${revision}`),
  );
});

test("license stays consistent across LICENSE, package and README", () => {
  const pkg = json("package.json");
  const license = read("LICENSE");
  assert.equal(pkg.license, "MIT");
  assert.equal(json("package-lock.json").packages[""].license, "MIT");
  assert.match(license, /^MIT License\n/);
  const readmeText = read("README.md");
  assert.match(readmeText, /License：`?\[MIT\]\(LICENSE\)`?/);
  assert.match(readmeText, /## License\n\n\[MIT\]\(LICENSE\)/);
});
