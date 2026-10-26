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
