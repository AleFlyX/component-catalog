import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { compare, declarationShape, isCatalogMarked, catalogDecision, localDeclaration, defaultReference } from "./source.mjs";
import { isSourceFile } from "./files.mjs";

const namedCandidate = (name) =>
  name && ts.isIdentifier(name) && /^[A-Z][A-Za-z0-9]*$/.test(name.text);
const bytes = (value) => Buffer.byteLength(JSON.stringify(value) + "\n");
const normalize = (value) => value.normalize("NFKC").toLowerCase();

function candidateNames(node) {
  const marked = isCatalogMarked(node);
  const flags = ts.getCombinedModifierFlags(node);
  if (marked || catalogDecision(node).ignored) {
    const name = ts.isVariableStatement(node)
      ? node.declarationList.declarations[0]?.name
      : node.name;
    return [name?.getText() ?? "default"];
  }
  if (
    ts.isExportDeclaration(node) &&
    !node.isTypeOnly &&
    node.exportClause &&
    ts.isNamedExports(node.exportClause)
  )
    return node.exportClause.elements
      .filter((entry) => !entry.isTypeOnly && namedCandidate(entry.name))
      .map((entry) => entry.name.text);
  if (ts.isExportAssignment(node) && !node.isExportEquals) return ["default"];
  if (!(flags & ts.ModifierFlags.Export)) return [];
  if (
    (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
    (namedCandidate(node.name) || flags & ts.ModifierFlags.Default)
  )
    return [node.name?.text ?? "default"];
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations
      .filter((declaration) => {
        if (!namedCandidate(declaration.name) || !declaration.initializer) return false;
        const value = declaration.initializer;
        return (
          ts.isArrowFunction(value) ||
          ts.isFunctionExpression(value) ||
          ts.isCallExpression(value) ||
          ts.isObjectLiteralExpression(value) ||
          ts.isIdentifier(value) ||
          ts.isPropertyAccessExpression(value) ||
          ts.isAsExpression(value) ||
          ts.isSatisfiesExpression(value) ||
          ts.isParenthesizedExpression(value)
        );
      })
      .map((declaration) => declaration.name.text);
  }
  return [];
}

function missingMetadata(node) {
  const tags = ts.getJSDocTags(node);
  const missing = [];
  if (!isCatalogMarked(node)) missing.push("componentCatalog");
  if (!node.jsDoc?.some((doc) => ts.getTextOfJSDocComment(doc.comment)?.trim()))
    missing.push("summary");
  for (const name of ["catalogStatus", "catalogTask", "catalogConstraint", "catalogExample"]) {
    if (
      !tags.some(
        (tag) => tag.tagName.text === name && ts.getTextOfJSDocComment(tag.comment)?.trim(),
      )
    )
      missing.push(name);
  }
  return missing;
}

// This deliberately needs neither a config, a catalog nor installed frontend dependencies.
// It inventories syntactic candidates; generation remains the semantic validation step.
export function scan(directory, { limit = 20, offset = 0, summary = false, query } = {}) {
  if (query !== undefined && (typeof query !== "string" || !query.trim() || query.length > 200))
    throw new Error("--query must contain 1–200 characters");
  if (query !== undefined && summary) throw new Error("--query and --summary cannot be combined");
  const root = path.resolve(directory);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory())
    throw new Error(`Scan directory does not exist or is not a directory: ${root}`);
  const candidates = [];
  const searchable = new Map();
  let files = 0;
  let skippedDirectories = 0;
  let skippedSymlinks = 0;
  function walk(folder) {
    for (const entry of fs
      .readdirSync(folder, { withFileTypes: true })
      .sort((a, b) => compare(a.name, b.name))) {
      const file = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) {
        skippedSymlinks++;
        continue;
      }
      if (entry.isDirectory()) {
        if (["node_modules", ".git"].includes(entry.name)) skippedDirectories++;
        else walk(file);
      } else if (entry.isFile() && isSourceFile(file)) {
        files++;
        const relative = path.relative(root, file).split(path.sep).join("/");
        const source = ts.createSourceFile(
          file,
          fs.readFileSync(file, "utf8"),
          ts.ScriptTarget.Latest,
          true,
        );
        if (source.parseDiagnostics.length) {
          const first = source.parseDiagnostics[0];
          const { line } = source.getLineAndCharacterOfPosition(first.start ?? 0);
          throw new Error(
            `${relative}:${line + 1}: cannot scan invalid JavaScript/TypeScript syntax; ${ts.flattenDiagnosticMessageText(first.messageText, " ")}`,
          );
        }
        const seen = new Set();
        const visit = (node) => {
          // Nested/private declarations are surfaced only when already explicitly marked.
          const names =
            node.parent === source || isCatalogMarked(node) || catalogDecision(node).ignored
              ? candidateNames(node)
              : [];
          for (let exportName of names) {
            let target = node;
            if (
              ts.isExportDeclaration(node) &&
              !node.moduleSpecifier &&
              node.exportClause &&
              ts.isNamedExports(node.exportClause)
            ) {
              const specifier = node.exportClause.elements.find(
                (entry) => entry.name.text === exportName,
              );
              if (
                specifier &&
                (!specifier.propertyName || specifier.propertyName.text === exportName)
              )
                target = localDeclaration(source, exportName) ?? node;
            }
            if (ts.isExportAssignment(node) && !node.isExportEquals && defaultReference(node.expression)) {
              const reference = defaultReference(node.expression);
              target = localDeclaration(source, reference.text) ?? node;
              if (target !== node) exportName = reference.text;
            }
            const key = `${target.pos}:${exportName}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const decision = catalogDecision(target);
            let shape;
            let shapeIssue;
            try {
              shape = declarationShape(target);
              if (shape.publicExpression) exportName = shape.declaration.name.text;
            } catch (error) {
              shapeIssue = isCatalogMarked(target)
                ? error.message
                : error.message.replaceAll("@componentCatalog declaration", "declaration shape");
            }
            const item = {
              exportName,
              sourcePath: relative,
              line: source.getLineAndCharacterOfPosition(target.getStart()).line + 1,
              marked: isCatalogMarked(target),
              ...(decision.ignored
                ? { ignored: !decision.error, ignoreReason: decision.reason }
                : {}),
              ...(decision.error ? { decisionIssue: decision.error } : {}),
              supportedShape: !!shape,
              kind: shape ? (shape.members ? "namespace" : "component") : "unsupported",
              ...(shapeIssue ? { shapeIssue } : {}),
              missingMetadata: decision.ignored && !decision.error ? [] : missingMetadata(target),
            };
            candidates.push(item);
            if (query !== undefined)
              searchable.set(item, {
                exportName,
                sourcePath: relative,
                summary: (target.jsDoc ?? [])
                  .map((doc) => ts.getTextOfJSDocComment(doc.comment) ?? "")
                  .join(" "),
                tasks: ts
                  .getJSDocTags(target)
                  .filter((tag) => tag.tagName.text === "catalogTask")
                  .map((tag) => ts.getTextOfJSDocComment(tag.comment) ?? "")
                  .join(" "),
              });
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
    }
  }
  walk(root);
  const groups = new Map();
  for (const item of candidates) {
    const directory = item.sourcePath.includes("/") ? item.sourcePath.split("/")[0] : ".";
    const group = groups.get(directory) ?? {
      directory,
      candidates: 0,
      marked: 0,
      unmarked: 0,
      unsupported: 0,
    };
    group.candidates++;
    group[item.marked ? "marked" : "unmarked"]++;
    if (!item.supportedShape) group.unsupported++;
    groups.set(directory, group);
  }
  let allItems = summary
    ? [...groups.values()].sort((a, b) => compare(a.directory, b.directory))
    : candidates;
  if (query !== undefined) {
    const normalized = normalize(query.trim());
    const terms = [...new Set(normalized.split(/\s+/))];
    allItems = candidates
      .map((item) => {
        const fields = Object.entries(searchable.get(item)).map(([key, value]) => [
          key,
          normalize(value),
        ]);
        const matches = fields
          .filter(([, value]) => terms.some((term) => value.includes(term)))
          .map(([key]) => key);
        const matched = terms.every((term) => fields.some(([, value]) => value.includes(term)));
        const rank =
          normalize(item.exportName) === normalized
            ? 5
            : matches.includes("exportName")
              ? 4
              : matches.includes("tasks")
                ? 3
                : matches.includes("summary")
                  ? 2
                  : 1;
        return { item, matches, matched, rank };
      })
      .filter(({ matched }) => matched)
      .sort(
        (a, b) =>
          b.rank - a.rank ||
          compare(a.item.sourcePath, b.item.sourcePath) ||
          a.item.line - b.item.line ||
          compare(a.item.exportName, b.item.exportName),
      )
      .map(({ item, matches }) => ({ ...item, matchedFields: matches }));
  }
  if (offset > allItems.length)
    throw new Error(
      `--offset exceeds ${allItems.length} ${summary ? "directory groups" : "candidates"}; restart scan at --offset 0`,
    );
  const marked = candidates.filter((entry) => entry.marked).length;
  const supported = candidates.filter((entry) => entry.supportedShape);
  const needsMetadata = supported.filter(
    (entry) => !entry.ignored && entry.missingMetadata.length > 0,
  ).length;
  const ignored = candidates.filter((entry) => entry.ignored).length;
  let nextStep;
  if (!candidates.length)
    nextStep =
      "No candidates found. Check the directory and exported JS/JSX/TS/TSX declarations; use source search for other languages or export styles.";
  else if (candidates.some((entry) => entry.decisionIssue))
    nextStep = "Fix conflicting or invalid decision tags, then audit with the project config.";
  else if (ignored === candidates.length)
    nextStep =
      "All candidates have explicit ignore decisions. Audit with the project config; a validated empty catalog is allowed in v2.";
  else if (!supported.length)
    nextStep =
      "Only unsupported declaration shapes found. Report the limitations and inspect source; preserve runtime behavior.";
  else if (!needsMetadata)
    nextStep =
      "Supported candidates have the required metadata fields. Run generate to validate types, tag values and examples, or generate --check for an existing catalog. Report unsupported entries separately.";
  else
    nextStep =
      "Review ownership and annotate missing metadata only for selected supported candidates. An already selected scope needs no reconfirmation. Then generate and report remaining exclusions.";
  if (query !== undefined)
    nextStep = allItems.length
      ? "Inspect candidate source and actual consumers; markers and supported syntax do not prove catalog enrollment or reuse permission. Do not annotate or generate for a read-only discovery task."
      : "No matching syntactic candidates. Try another name/path term or use source search for private declarations, export-star barrels and unsupported source formats; do not conclude no component exists.";
  const items = allItems.slice(offset, offset + limit);
  const response = {
    scanVersion: 1,
    view: summary ? "directories" : "candidates",
    root,
    ...(query !== undefined ? { query: query.trim(), matchingCandidates: allItems.length } : {}),
    counts: {
      files,
      candidates: candidates.length,
      marked,
      ignored,
      ignoredUnsupported: candidates.filter(
        (entry) => entry.ignored && entry.ignoreReason.startsWith("unsupported:"),
      ).length,
      unmarked: candidates.length - marked,
      unsupported: candidates.filter((entry) => !entry.supportedShape).length,
      needsMetadata,
      directories: groups.size,
      skippedDirectories,
      skippedSymlinks,
    },
    note:
      "Heuristic candidates, not catalog entries or proof of public ownership. Metadata presence is not validity. Paths are relative to root." +
      (summary
        ? " Groups include descendants under each immediate child; '.' means files directly in root."
        : "") +
      (query !== undefined
        ? " Counts describe the full scanned directory; matchingCandidates and pagination describe filtered results. All query terms must match. No config exclusions or vocabulary expansion are applied. marked means annotation presence, not verified catalog membership."
        : ""),
    totalItems: allItems.length,
    items,
    offset,
    nextOffset: null,
    truncated: false,
    omitted: { before: offset, after: 0 },
    nextStep,
  };
  const update = () => {
    response.omitted.after = allItems.length - offset - items.length;
    response.nextOffset = response.omitted.after ? offset + items.length : null;
    response.truncated = offset > 0 || response.omitted.after > 0;
  };
  update();
  while (bytes(response) > 8192 && items.length) {
    items.pop();
    update();
  }
  if (bytes(response) > 8192 || (!items.length && response.omitted.after))
    throw new Error("Scan entry exceeds output limit; scan a narrower directory");
  return response;
}
