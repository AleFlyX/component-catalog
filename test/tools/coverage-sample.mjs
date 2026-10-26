#!/usr/bin/env node
// Read-only retrieval coverage sample: compares expected IDs/exports with
// component-catalog search top-k results. No network, no project writes.
import fs from "node:fs";
import zlib from "node:zlib";
import { search } from "../../../skills/component-catalog/scripts/lib/query.mjs";

const readJSON = (file) =>
  JSON.parse(
    file.endsWith(".gz")
      ? zlib.gunzipSync(fs.readFileSync(file)).toString("utf8")
      : fs.readFileSync(file, "utf8"),
  );

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const catalogPath = arg("--catalog");
const configPath = arg("--config");
const queriesPath = arg("--queries");
const outPath = arg("--out", "coverage.json");
const limit = Number(arg("--limit", "5"));
if (!catalogPath || !configPath || !queriesPath) {
  console.error("Usage: coverage-sample.mjs --catalog <file[.gz]> --config <file> --queries <file> [--limit 5] [--out coverage.json]");
  process.exit(2);
}

const catalog = readJSON(catalogPath);
const config = readJSON(configPath);
const queries = readJSON(queriesPath);
const results = queries.map(({ scope, query, expectedId, expectedExport }) => {
  const response = search(catalog, query, limit, config.vocabulary);
  const ids = response.items.map((item) => item.id);
  const exports = response.items.map((item) => item.exportName);
  const hit = expectedId ? ids.includes(expectedId) : exports.includes(expectedExport);
  return {
    scope,
    query,
    expected: expectedId ?? expectedExport,
    hit,
    rank: hit ? (expectedId ? ids.indexOf(expectedId) : exports.indexOf(expectedExport)) + 1 : null,
    results: response.items.map((item) => ({ id: item.id, exportName: item.exportName })),
  };
});

const byScope = {};
for (const result of results) {
  const bucket = (byScope[result.scope] ??= { queries: 0, hits: 0 });
  bucket.queries += 1;
  if (result.hit) bucket.hits += 1;
}
for (const bucket of Object.values(byScope)) bucket.rate = Math.round((bucket.hits / bucket.queries) * 1000) / 10;
const summary = {
  catalogEntries: catalog.components.length,
  limit,
  overall: {
    queries: results.length,
    hits: results.filter((result) => result.hit).length,
    rate: Math.round((results.filter((result) => result.hit).length / results.length) * 1000) / 10,
  },
  byScope,
  results,
};
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify({ out: outPath, ...summary.overall, byScope }, null, 2));
