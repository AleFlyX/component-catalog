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

  // Both language editions carry the same facts in the same table shape, so a
  // version bump must reach both or the test fails.
  const escaped = pkg.version.replaceAll(".", "\\.");
  for (const file of ["README.md", "README.zh.md"]) {
    const readme = read(file);
    assert.match(readme, new RegExp(`\\| CLI \\| \\x60${escaped}\\x60 \\|`), `${file} must state the CLI version`);
    assert.match(readme, new RegExp(`\\| Skill revision \\| \\x60${revision}\\x60 \\|`), `${file} must state the skill revision`);
    assert.match(
      readme,
      new RegExp(`doctor --installation --expect-version ${escaped} --expect-skill-revision ${revision}`),
      `${file} must pin the version in its doctor command`,
    );
  }
});

test("every versioned surface agrees, including llms.txt and the reference docs", () => {
  const pkg = json("package.json");
  const version = pkg.version.replaceAll(".", "\\.");
  const skill = read("skills/component-catalog/SKILL.md");
  const revision = /^---[\s\S]*?revision:\s*"([1-9][0-9]*)"[\s\S]*?---/m.exec(skill)?.[1];
  assert.ok(revision);

  // llms.txt is the file LLM crawlers read first and has no test of its own;
  // it silently carried the previous release through a version bump.
  const llms = read("llms.txt");
  assert.match(
    llms,
    new RegExp(`--expect-version ${version} --expect-skill-revision ${revision}`),
    "llms.txt quick start must pin the current version and revision",
  );
  assert.match(
    llms,
    new RegExp(`CLI ${version}, skill revision ${revision},`),
    "llms.txt Status line must name the current version and revision",
  );
  // A hardcoded test count here has no owner and drifts on every added test.
  // Asserting its absence keeps the number out of a file nobody updates.
  assert.doesNotMatch(llms, /runs \d+ tests/, "llms.txt must not hardcode a test count");

  // The bundled instructions are the drift risk: a stale pin here makes a
  // correctly installed consumer fail doctor.
  const setup = read("skills/component-catalog/references/setup.md");
  for (const [, pinned] of setup.matchAll(/--expect-version ([0-9.]+)/g))
    assert.equal(pinned, pkg.version, `setup.md pins ${pinned}`);
  for (const [, pinned] of setup.matchAll(/--expect-skill-revision (\d+)/g))
    assert.equal(pinned, revision, `setup.md pins revision ${pinned}`);
  for (const [, pinned] of skill.matchAll(/--expect-version ([0-9.]+)/g))
    assert.equal(pinned, pkg.version, `SKILL.md pins ${pinned}`);
  for (const [, pinned] of skill.matchAll(/--expect-skill-revision (\d+)/g))
    assert.equal(pinned, revision, `SKILL.md pins revision ${pinned}`);

  // README is checked above; assert it does not also carry a second, stale pin.
  const readme = read("README.md");
  for (const [, pinned] of readme.matchAll(/--expect-version ([0-9.]+)/g))
    assert.equal(pinned, pkg.version, `README.md pins ${pinned}`);
});

test("license stays consistent across LICENSE, package and README", () => {
  const pkg = json("package.json");
  const license = read("LICENSE");
  assert.equal(pkg.license, "MIT");
  assert.equal(json("package-lock.json").packages[""].license, "MIT");
  assert.match(license, /^MIT License\n/);
  for (const file of ["README.md", "README.zh.md"]) {
    const text = read(file);
    assert.match(text, /\| License \| \[MIT\]\(LICENSE\) \|/, `${file} must state the license`);
    assert.match(text, /## License\n\n\[MIT\]\(LICENSE\)/, `${file} must end with the license`);
  }
});
