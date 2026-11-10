import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const docs = [
  "AGENTS.md",
  "CONTRIBUTING.md",
  "README.md",
  "README.zh.md",
  "llms.txt",
  "skills/component-catalog/SKILL.md",
  "skills/component-catalog/references/setup.md",
  "skills/component-catalog/references/maintenance.md",
  "skills/component-catalog/references/evaluation.md",
];
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

/** GitHub-style heading slug, lowercased with spaces turned into hyphens. */
function slug(heading) {
  return heading
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Every heading slug in a Markdown file, including setext-free ATX only. */
function anchors(text) {
  const result = new Set();
  for (const [, , heading] of text.matchAll(/^#{1,6} +(?:<a id="([^"]+)"><\/a>)?(.+)$/gm))
    result.add(slug(heading));
  for (const [, id] of text.matchAll(/<a id="([^"]+)"><\/a>/g)) result.add(id);
  return result;
}

test("no Markdown heading is glued onto a paragraph", () => {
  // A heading must start a line. An inline "### X" renders as literal text and
  // silently loses its anchor; this happened in setup.md and stayed unnoticed
  // until a structural review.
  for (const file of docs) {
    for (const [index, line] of read(file).split("\n").entries())
      assert.doesNotMatch(
        line,
        /\S\s+#{2,6}\s+/,
        `${file}:${index + 1} has an inline heading: ${line.slice(0, 80)}`,
      );
  }
});

test("no paragraph or line exceeds the readable bound", () => {
  // Long single lines are the main readability complaint against these docs.
  // The bound is the current worst case, so it ratchets: it fails a regression
  // without demanding an immediate rewrite of every remaining long sentence.
  const MAX_LINE = 1300;
  for (const file of docs) {
    for (const [index, line] of read(file).split("\n").entries())
      assert.ok(
        line.length <= MAX_LINE,
        `${file}:${index + 1} is ${line.length} characters; split it below ${MAX_LINE}`,
      );
  }
});

test("every relative Markdown link resolves to a real file and anchor", () => {
  // Anchors rot silently because nothing compiles them. Resolve each target,
  // then require its fragment to match a heading in that file.
  for (const file of docs) {
    const text = read(file);
    const directory = path.dirname(path.join(root, file));
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(?:https?:|mailto:|#)/.test(target)) continue;
      const [rawPath, fragment] = target.split("#");
      const resolved = path.resolve(directory, decodeURIComponent(rawPath));
      assert.ok(
        fs.existsSync(resolved) && fs.statSync(resolved).isFile(),
        `${file} links to a missing file: ${target}`,
      );
      if (!fragment) continue;
      const anchorsInTarget = anchors(fs.readFileSync(resolved, "utf8"));
      assert.ok(
        anchorsInTarget.has(fragment),
        `${file} links to a missing anchor: ${target} (have: ${[...anchorsInTarget].join(", ")})`,
      );
    }
  }
});

test("each configured rule has exactly one owning document", () => {
  // Duplicated contracts drift: typeScope used to be spelled out three times in
  // three different wordings. Only the owner may carry the full remediation
  // contract; every other file that discusses the decision points at it.
  const owner = "skills/component-catalog/references/setup.md";
  const OWNER_LINK = "setup.md#large-repository-type-scope";
  assert.match(read(owner), /do not raise the heap as the fix/, "the owner states the contract");

  for (const file of ["README.md", "skills/component-catalog/SKILL.md"]) {
    const text = read(file);
    assert.doesNotMatch(
      text,
      /do not raise the heap as the fix/,
      `${file} duplicates the typeScope contract owned by ${owner}`,
    );
    if (!/typeScope/.test(text)) continue;
    assert.match(text, new RegExp(OWNER_LINK.replace(/[.#]/g, "\\$&")), `${file} must link to the owner`);
  }
});
