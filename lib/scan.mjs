import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { compare, declarationShape, isCatalogMarked, catalogDecision } from "./source.mjs";

const namedCandidate = (name) =>
  name && ts.isIdentifier(name) && /^[A-Z][A-Za-z0-9]*$/.test(name.text);
const bytes = (value) => Buffer.byteLength(JSON.stringify(value) + "\n");

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
export function scan(directory, { limit = 20, offset = 0, summary = false } = {}) {
  const root = path.resolve(directory);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory())
    throw new Error(`Scan directory does not exist or is not a directory: ${root}`);
  const candidates = [];
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
      } else if (entry.isFile() && /\.tsx?$/.test(file) && !file.endsWith(".d.ts")) {
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
            `${relative}:${line + 1}: cannot scan invalid TypeScript syntax; ${ts.flattenDiagnosticMessageText(first.messageText, " ")}`,
          );
        }
        const visit = (node) => {
          // Nested/private declarations are surfaced only when already explicitly marked.
          const names =
            node.parent === source || isCatalogMarked(node) || catalogDecision(node).ignored
              ? candidateNames(node)
              : [];
          for (const exportName of names) {
            const decision = catalogDecision(node);
            let shape;
            let shapeIssue;
            try {
              shape = declarationShape(node);
            } catch (error) {
              shapeIssue = isCatalogMarked(node)
                ? error.message
                : error.message.replaceAll("@componentCatalog declaration", "declaration shape");
            }
            candidates.push({
              exportName,
              sourcePath: relative,
              line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
              marked: isCatalogMarked(node),
              ...(decision.ignored
                ? { ignored: !decision.error, ignoreReason: decision.reason }
                : {}),
              ...(decision.error ? { decisionIssue: decision.error } : {}),
              supportedShape: !!shape,
              kind: shape ? (shape.members ? "namespace" : "component") : "unsupported",
              ...(shapeIssue ? { shapeIssue } : {}),
              missingMetadata: decision.ignored && !decision.error ? [] : missingMetadata(node),
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
  const allItems = summary
    ? [...groups.values()].sort((a, b) => compare(a.directory, b.directory))
    : candidates;
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
      "No candidates found. Check the directory and exported TS/TSX declarations; use source search for other languages or export styles.";
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
  const items = allItems.slice(offset, offset + limit);
  const response = {
    scanVersion: 1,
    view: summary ? "directories" : "candidates",
    root,
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
