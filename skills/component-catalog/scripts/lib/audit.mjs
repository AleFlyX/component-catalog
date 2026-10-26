import fs from "node:fs";
import { createProject } from "./project.mjs";
import { inventory } from "./inventory.mjs";
import { generateCatalog } from "./generate.mjs";
import { loadCatalog } from "./catalog.mjs";
import { compare } from "./source.mjs";
import { validateGenerationPaths } from "./config.mjs";

export function auditProject(config, { stored = true, freshness = false } = {}) {
  if (config.configVersion !== 2)
    throw new Error(
      "audit/check require configVersion 2 with an explicit enrollment policy per root. Review and migrate the config; v1 search/get/generate remain supported.",
    );
  validateGenerationPaths(config);
  const project = createProject(config);
  const result = inventory(config, project);
  const { issues, counts } = result;
  let catalog;
  try {
    catalog = generateCatalog(config, { project, issues });
  } catch (error) {
    issues.push({ code: "GENERATION_INVALID", message: error.message });
  }
  const expected = catalog ? JSON.stringify(catalog, null, 2) + "\n" : undefined;
  if (stored) {
    if (fs.existsSync(config.catalog)) {
      let existing;
      try {
        existing = loadCatalog(config.catalog);
      } catch (error) {
        issues.push({ code: "CATALOG_INVALID", message: error.message });
      }
      if (existing && catalog) {
        const ids = new Set(catalog.components.map((item) => item.id));
        for (const entry of existing.components) {
          if (!ids.has(entry.id))
            issues.push({
              code: "STALE_ENTRY",
              sourcePath: entry.sourcePath,
              exportName: entry.exportName,
              message: `Catalog entry ${entry.id} is no longer generated. Review removal/move/ignore changes and regenerate.`,
            });
        }
      }
      if (
        freshness &&
        expected !== undefined &&
        fs.readFileSync(config.catalog, "utf8") !== expected
      )
        issues.push({
          code: "CATALOG_STALE",
          message:
            "Catalog differs from current sources/config; run generate with this same --config, then check.",
        });
    } else if (freshness)
      issues.push({
        code: "CATALOG_MISSING",
        message: "Catalog missing; run generate with this same --config, then check.",
      });
  }
  const unique = [...new Map(issues.map((item) => [JSON.stringify(item), item])).values()].sort(
    (a, b) =>
      compare(a.sourcePath ?? "", b.sourcePath ?? "") ||
      (a.line ?? 0) - (b.line ?? 0) ||
      compare(a.code, b.code) ||
      compare(a.exportName ?? "", b.exportName ?? "") ||
      compare(a.message, b.message),
  );
  return {
    config: config.configPath,
    counts: { ...counts, generated: catalog?.components.length ?? 0, issues: unique.length },
    issues: unique,
    catalog,
    expected,
    generation: catalog?.generation ?? null,
  };
}

export function auditResponse(result, { command = "audit", offset = 0, limit = 20 } = {}) {
  const total = result.issues.length;
  if (offset > total) throw new Error(`--offset exceeds ${total} issues; restart at 0`);
  const issues = result.issues.slice(offset, offset + limit).map((item) => ({ ...item }));
  const response = {
    auditVersion: 1,
    command,
    config: result.config,
    status: total ? "fail" : "pass",
    ...(result.generation
      ? {
          typeScope: result.generation.typeScope,
          typeCheck: result.generation.typeCheck,
          suppressedTypeDiagnostics: result.generation.suppressedTypeDiagnostics,
          ...(result.generation.suppressedTypeCodes
            ? { suppressedTypeCodes: result.generation.suppressedTypeCodes }
            : {}),
        }
      : {}),
    discovery: {
      status: total
        ? "needs-attention"
        : result.counts.ignoredUnsupported
          ? "partial"
          : result.counts.generated
            ? "available"
            : "empty",
      searchable: result.counts.generated,
      excludedUnsupported: result.counts.ignoredUnsupported,
      note: "Based on current-source generation, not the saved query snapshot. Audit pass validates decisions, not useful search coverage or routine-check integration. Verify representative tasks against the generated snapshot.",
    },
    counts: result.counts,
    issues,
    offset,
    nextOffset: null,
    truncated: false,
    omitted: { before: offset, after: 0, fields: [] },
    coverage:
      "Configured JS/JSX/TS/TSX PascalCase value/default exports and explicit decisions. Ignored entries are not enrolled; unsupported exclusions are counted separately.",
  };
  const size = () => Buffer.byteLength(JSON.stringify(response) + "\n");
  const update = () => {
    response.omitted.after = total - offset - issues.length;
    response.nextOffset = response.omitted.after ? offset + issues.length : null;
    response.truncated =
      offset > 0 || response.omitted.after > 0 || response.omitted.fields.length > 0;
  };
  update();
  while (size() > 8192 && issues.length > 1) {
    issues.pop();
    update();
  }
  if (size() > 8192 && issues.length) {
    delete issues[0].message;
    response.omitted.fields.push("issues[0].message");
    update();
  }
  if (size() > 8192)
    throw new Error(
      "Audit issue identity exceeds output limit; inspect configuration/source paths locally",
    );
  return response;
}
