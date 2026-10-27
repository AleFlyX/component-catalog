import { search } from "./query.mjs";

const isString = (value) => typeof value === "string" && value.trim().length > 0;

/**
 * Read-only retrieval gate. Each query must name expected IDs/exports and may
 * optionally name IDs that must stay absent. It uses the saved catalog only;
 * freshness is the caller's responsibility (run check first).
 */
export function verifyCatalog(catalog, queries, vocabulary = {}, defaultLimit = 5) {
  if (!Array.isArray(queries) || !queries.length)
    throw new Error("verify queries must be a nonempty array");
  const results = queries.map((entry, index) => {
    if (!entry || !isString(entry.query)) throw new Error(`verify query ${index + 1}: query is required`);
    const expectedIds = entry.expectedIds ?? (isString(entry.expectedId) ? [entry.expectedId] : []);
    const absentIds = entry.absentIds ?? [];
    if (!Array.isArray(expectedIds) || expectedIds.some((id) => !isString(id)))
      throw new Error(`verify query ${index + 1}: expectedIds must be an array of nonempty strings`);
    if (!Array.isArray(absentIds) || absentIds.some((id) => !isString(id)))
      throw new Error(`verify query ${index + 1}: absentIds must be an array of nonempty strings`);
    if (
      !expectedIds.length &&
      !isString(entry.expectedExport) &&
      !entry.expectNoResults &&
      !absentIds.length
    )
      throw new Error(`verify query ${index + 1}: add expectedIds, expectedExport, absentIds or expectNoResults`);
    if (entry.expectedExport !== undefined && !isString(entry.expectedExport))
      throw new Error(`verify query ${index + 1}: expectedExport must be a nonempty string`);
    if (entry.perLayer !== undefined && (!Number.isInteger(entry.perLayer) || entry.perLayer < 1 || entry.perLayer > 5))
      throw new Error(`verify query ${index + 1}: perLayer must be 1..5`);
    if (entry.layer !== undefined && !isString(entry.layer))
      throw new Error(`verify query ${index + 1}: layer must be a nonempty string`);
    const limit = entry.limit ?? defaultLimit;
    if (!Number.isInteger(limit) || limit < 1 || limit > 10)
      throw new Error(`verify query ${index + 1}: limit must be 1..10`);
    const response = search(
      catalog,
      entry.query,
      limit,
      vocabulary,
      false,
      false,
      entry.layer ?? null,
      entry.layerFallback ?? false,
      entry.perLayer ?? null,
    );
    const ids = response.items.map((item) => item.id);
    const exports = response.items.map((item) => item.exportName);
    const missingIds = expectedIds.filter((id) => !ids.includes(id));
    const presentAbsent = absentIds.filter((id) => ids.includes(id));
    const expectedRank = expectedIds.map((id) => ({ id, rank: ids.indexOf(id) + 1 || null }));
    const exportRank = isString(entry.expectedExport)
      ? exports.indexOf(entry.expectedExport) + 1 || null
      : null;
    const noResults = response.items.length === 0;
    const ok =
      missingIds.length === 0 &&
      presentAbsent.length === 0 &&
      (!isString(entry.expectedExport) || exportRank !== null) &&
      (!entry.expectNoResults || noResults);
    return {
      scope: entry.scope ?? "general",
      query: entry.query,
      ok,
      expectedIds,
      missingIds,
      absentIds,
      presentAbsent,
      expectedExport: entry.expectedExport ?? null,
      exportRank,
      expectedRank,
      expectNoResults: entry.expectNoResults ?? false,
      limit,
      items: response.items.map((item) => ({ id: item.id, exportName: item.exportName })),
    };
  });
  const byScope = {};
  for (const result of results) {
    const bucket = (byScope[result.scope] ??= { queries: 0, passed: 0 });
    bucket.queries += 1;
    if (result.ok) bucket.passed += 1;
  }
  for (const bucket of Object.values(byScope))
    bucket.rate = Math.round((bucket.passed / bucket.queries) * 1000) / 10;
  const passed = results.filter((result) => result.ok).length;
  return {
    verifyVersion: 1,
    sourceDigest: catalog.sourceDigest,
    catalogEntries: catalog.components.length,
    defaultLimit,
    ok: passed === results.length,
    counts: { queries: results.length, passed, failed: results.length - passed },
    byScope,
    results,
  };
}

/**
 * Build safe first-pass verification queries from the saved catalog.
 * Exact export-name queries are unambiguous; task-tag queries are only
 * generated when that primary task belongs to exactly one component.
 */
export function suggestVerifyQueries(catalog, vocabulary = {}) {
  const components = catalog.components ?? [];
  const taskCounts = new Map();
  for (const component of components) {
    const task = component.tasks?.[0];
    if (task) taskCounts.set(task, (taskCounts.get(task) ?? 0) + 1);
  }
  const queries = [];
  const seen = new Set();
  const vocabularyTermForTask = (task) => {
    const terms = Object.entries(vocabulary)
      .filter(([, concept]) => concept.primary === task || (concept.related ?? []).includes(task))
      .map(([term]) => term)
      .sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
    return terms[0] ?? null;
  };
  const add = (entry) => {
    const key = `${entry.query}\0${entry.expectedId}`;
    if (seen.has(key)) return;
    seen.add(key);
    queries.push(entry);
  };
  for (const component of components) {
    add({ scope: "self", query: component.exportName, expectedId: component.id });
    const task = component.tasks?.[0];
    if (!task || taskCounts.get(task) !== 1) continue;
    add({ scope: "task", query: task, expectedId: component.id });
    const term = vocabularyTermForTask(task);
    if (term) add({ scope: "vocabulary", query: term, expectedId: component.id });
  }
  // Exact-name mixed proves that two roles can coexist; task/vocabulary mixed
  // additionally exercises ranking and configured aliases. Missing cases still
  // need human curation because absence cannot be inferred from the catalog.
  const byLayer = new Map();
  for (const component of components) {
    const layer = component.layer ?? "unspecified";
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer).push(component);
  }
  const representatives = [...byLayer.values()].map((items) => items[0]);
  const pair =
    representatives.length >= 2
      ? representatives.slice(0, 2)
      : components.length >= 2
        ? components.slice(0, 2)
        : [];
  if (pair.length === 2) {
    add({
      scope: "mixed-auto",
      query: pair.map((component) => component.exportName).join(" "),
      expectedIds: pair.map((component) => component.id),
    });
  }
  const hasUniqueTask = (component) => component.tasks?.[0] && taskCounts.get(component.tasks[0]) === 1;
  const taskRepresentatives = [...byLayer.values()]
    .map((items) => items.find(hasUniqueTask))
    .filter(Boolean);
  const taskPair =
    taskRepresentatives.length >= 2
      ? taskRepresentatives.slice(0, 2)
      : components.filter(hasUniqueTask).slice(0, 2);
  if (taskPair.length === 2) {
    add({
      scope: "mixed-task-auto",
      query: taskPair.map((component) => component.tasks[0]).join(" "),
      expectedIds: taskPair.map((component) => component.id),
    });
  }
  const vocabularyTerm = (component) => {
    const task = component.tasks?.[0];
    return task ? vocabularyTermForTask(task) : null;
  };
  const withTerm = (component) => hasUniqueTask(component) && vocabularyTerm(component);
  const vocabularyRepresentatives = [...byLayer.values()]
    .map((items) => items.find(withTerm))
    .filter(Boolean);
  const vocabularyPair =
    vocabularyRepresentatives.length >= 2
      ? vocabularyRepresentatives.slice(0, 2)
      : components.filter(withTerm).slice(0, 2);
  if (vocabularyPair.length === 2) {
    add({
      scope: "mixed-vocabulary-auto",
      query: vocabularyPair.map((component) => vocabularyTerm(component)).join(" "),
      expectedIds: vocabularyPair.map((component) => component.id),
    });
  }
  return queries;
}

/**
 * CLI stdout is failure-focused by default; --out retains the complete report.
 */
export function summarizeVerifyResult(result, { details = false } = {}) {
  if (details) return result;
  const failures = result.results.filter((item) => !item.ok);
  return {
    ...result,
    results: failures,
    resultsIncluded: failures.length,
    resultsOmitted: result.results.length - failures.length,
  };
}
