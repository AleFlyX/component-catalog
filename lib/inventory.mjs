import ts from "typescript";
import { canonicalSymbol, catalogDecision, declarationShape } from "./source.mjs";
import { filesBelow } from "./project.mjs";

function owner(node) {
  if (ts.isVariableDeclaration(node) && ts.isVariableDeclarationList(node.parent))
    return node.parent.parent;
  return node;
}
function typeOnly(node) {
  if (ts.isExportSpecifier(node)) return node.isTypeOnly || node.parent.parent.isTypeOnly;
  return ts.isExportDeclaration(node) && node.isTypeOnly;
}

// Full, unpaginated inventory for policy enforcement. Scan stays a config-free heuristic.
export function inventory(config, project) {
  const { program, checker, sources, rootFor, relative } = project;
  const issues = [];
  const candidates = new Map();
  const loaded = new Set(sources.map((source) => source.fileName));
  const selected = sources.filter((source) => rootFor(source.fileName));
  const issue = (code, node, message, exportName) => {
    const source = node.getSourceFile();
    const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    issues.push({
      code,
      sourcePath: relative(source.fileName),
      line,
      ...(exportName ? { exportName } : {}),
      message,
    });
  };
  // Type-only stars expose the original value symbol too. Follow actual value
  // export paths instead of mistaking that symbol for a runtime re-export.
  function hasValuePath(source, name, seen = new Set()) {
    const key = `${source.fileName}:${name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const module = checker.getSymbolAtLocation(source);
    if (!module) return false;
    const exported = checker.getExportsOfModule(module).find((item) => item.name === name);
    if (!exported) return false;
    if (
      !checker.getTypeOnlyAliasDeclaration(exported) &&
      exported.declarations?.some((node) => node.getSourceFile() === source && !typeOnly(node))
    )
      return true;
    if (name === "default") return false;
    return source.statements.some((statement) => {
      if (
        !ts.isExportDeclaration(statement) ||
        statement.isTypeOnly ||
        statement.exportClause ||
        !statement.moduleSpecifier
      )
        return false;
      const target = checker.getSymbolAtLocation(statement.moduleSpecifier);
      return target?.declarations?.some(
        (node) => ts.isSourceFile(node) && hasValuePath(node, name, seen),
      );
    });
  }
  function add(node, declaration, exportName, root) {
    const key = `${declaration.getSourceFile().fileName}:${declaration.pos}`;
    if (candidates.has(key)) return;
    const decision = catalogDecision(node);
    let shape;
    let shapeError;
    try {
      shape = declarationShape(node);
    } catch (error) {
      shapeError = error.message;
    }
    const entry = { node, exportName, root, decision, supported: !!shape, shapeError };
    candidates.set(key, entry);
    if (decision.error) issue("DECISION_INVALID", node, decision.error, exportName);
    else if (decision.ignored) return;
    else if (!shape)
      issue(
        "UNSUPPORTED_DECLARATION",
        node,
        `${shapeError} Enroll when supported or record a truthful @componentCatalogIgnore reason.`,
        exportName,
      );
    else if (!decision.marked)
      issue(
        root.enrollment === "public" ? "UNREGISTERED_COMPONENT" : "UNREVIEWED_CANDIDATE",
        node,
        root.enrollment === "public"
          ? "Public scope requires enrollment or an explicit ignore reason; the Agent should complete metadata."
          : "Review public ownership; enroll or record a justified ignore decision.",
        exportName,
      );
  }

  for (const root of config.componentRoots) {
    const files = filesBelow(
      root.path,
      config,
      () => true,
      (file) => {
        issues.push({
          code: "UNSCANNED_SYMLINK",
          sourcePath: relative(file),
          message:
            "Audit does not follow descendant symlinks; select the real source or explicitly exclude this path.",
        });
      },
    );
    for (const file of files) {
      if (/\.(jsx?|vue|svelte|mts|cts|mdx)$/.test(file))
        issues.push({
          code: "UNSUPPORTED_SOURCE_FILE",
          sourcePath: relative(file),
          message:
            "Audit supports .ts/.tsx sources only; assess and explicitly exclude other source files or add extractor support.",
        });
    }
  }

  for (const source of selected) {
    const root = rootFor(source.fileName);
    for (const diagnostic of program.getSyntacticDiagnostics(source)) {
      const line = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1;
      issues.push({
        code: "SOURCE_SYNTAX",
        sourcePath: relative(source.fileName),
        line,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
      });
    }
    // Explicit decisions on non-exported/lowercase/unsupported declarations must also be validated.
    function visit(node) {
      const decision = catalogDecision(node);
      if (decision.marked || decision.ignored) {
        const declaration = ts.isVariableStatement(node)
          ? node.declarationList.declarations[0]
          : node;
        add(node, declaration, declaration.name?.getText() ?? "default", root);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    for (const statement of source.statements) {
      if (!ts.isExportDeclaration(statement) || statement.isTypeOnly) continue;
      const decision = catalogDecision(statement);
      if (decision.ignored && !decision.error) continue;
      if (statement.moduleSpecifier && !checker.getSymbolAtLocation(statement.moduleSpecifier))
        issue(
          "UNRESOLVED_EXPORT",
          statement,
          "Cannot resolve re-export module; audit coverage is incomplete.",
        );
    }
    // Ambiguous star exports must not silently select whichever symbol the checker returned first.
    for (const diagnostic of program
      .getSemanticDiagnostics(source)
      .filter((item) => item.code === 2308)) {
      issues.push({
        code: "AMBIGUOUS_EXPORT",
        sourcePath: relative(source.fileName),
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
      });
    }
    const module = checker.getSymbolAtLocation(source);
    if (!module) continue;
    for (const exported of checker.getExportsOfModule(module)) {
      if (exported.declarations?.length && exported.declarations.every(typeOnly)) continue;
      if (!hasValuePath(source, exported.name)) continue;
      const exportSite = exported.declarations?.find((node) => ts.isExportSpecifier(node));
      const exportOwner = exportSite ? exportSite.parent.parent : undefined;
      if (exportOwner && catalogDecision(exportOwner).ignored) continue;
      const symbol = canonicalSymbol(checker, exported);
      if (!symbol || !(symbol.flags & ts.SymbolFlags.Value)) {
        if (exported.flags & ts.SymbolFlags.Alias && !symbol?.declarations?.length)
          issue(
            "UNRESOLVED_EXPORT",
            exportOwner ?? source,
            "Cannot resolve exported value; audit coverage is incomplete.",
            exported.name,
          );
        continue;
      }
      let declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
      if (
        declaration &&
        ts.isExportAssignment(declaration) &&
        ts.isIdentifier(declaration.expression)
      ) {
        const target = canonicalSymbol(
          checker,
          checker.getSymbolAtLocation(declaration.expression),
        );
        declaration = target?.valueDeclaration ?? target?.declarations?.[0] ?? declaration;
      }
      if (!declaration) {
        issue(
          "UNRESOLVED_EXPORT",
          exportOwner ?? source,
          "Exported value has no inspectable declaration.",
          exported.name,
        );
        continue;
      }
      const node = owner(declaration);
      const decision = catalogDecision(node);
      // PascalCase value exports (including constants/classes), default exports, and explicit decisions.
      if (
        !/^[A-Z]/.test(exported.name) &&
        exported.name !== "default" &&
        !decision.marked &&
        !decision.ignored
      )
        continue;
      const targetFile = declaration.getSourceFile().fileName;
      const targetRoot = rootFor(targetFile);
      if (!targetRoot || !loaded.has(targetFile)) {
        // A reason on an export-star statement can explicitly waive external/unsupported exports.
        const ignoredStar = source.statements.some(
          (statement) =>
            ts.isExportDeclaration(statement) &&
            !statement.exportClause &&
            statement.moduleSpecifier &&
            catalogDecision(statement).ignored &&
            !catalogDecision(statement).error &&
            checker
              .getExportsOfModule(checker.getSymbolAtLocation(statement.moduleSpecifier) ?? module)
              .some((item) => canonicalSymbol(checker, item) === symbol),
        );
        if (!ignoredStar)
          issue(
            "OUT_OF_SCOPE_EXPORT",
            exportOwner ?? source,
            "Value export resolves outside scanned component roots (or into excluded/declaration-only source). Review scope or justify ignoring the re-export.",
            exported.name,
          );
        continue;
      }
      add(node, declaration, declaration.name?.getText() ?? exported.name, targetRoot);
    }
  }
  const entries = [...candidates.values()];
  return {
    issues,
    counts: {
      candidates: entries.length,
      marked: entries.filter((entry) => entry.decision.marked).length,
      ignored: entries.filter((entry) => entry.decision.ignored && !entry.decision.error).length,
      ignoredUnsupported: entries.filter(
        (entry) =>
          entry.decision.ignored &&
          !entry.decision.error &&
          entry.decision.reason.startsWith("unsupported:"),
      ).length,
      undecided: entries.filter((entry) => !entry.decision.marked && !entry.decision.ignored)
        .length,
    },
  };
}
