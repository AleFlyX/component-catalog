import ts from "typescript";

// Semantic diagnostics may be suppressed by checkJs:false or @ts-nocheck.
// Module symbols still resolve static ESM imports, reexports and import() types.
export function unresolvedImports(sources, checker, options) {
  const issues = [];
  for (const source of sources) {
    const seen = new Set();
    function visit(node) {
      let specifier;
      let acceptsScript = false;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isJSDocImportTag(node)) {
        specifier = node.moduleSpecifier;
        acceptsScript = ts.isImportDeclaration(node) && !node.importClause;
      }
      else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) specifier = node.argument.literal;
      else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        specifier = node.arguments[0];
        acceptsScript = true;
      }
      if (specifier && ts.isStringLiteralLike(specifier) && !seen.has(specifier.pos)) {
        seen.add(specifier.pos);
        const symbol = checker.getSymbolAtLocation(specifier);
        const resolvedScript = !symbol && acceptsScript && ts.resolveModuleName(
          specifier.text, source.fileName, options, ts.sys, undefined, undefined,
          ts.getModeForUsageLocation(source, specifier, options),
        ).resolvedModule;
        if (!symbol && !resolvedScript) {
          const { line } = source.getLineAndCharacterOfPosition(specifier.getStart());
          issues.push({ sourcePath: source.fileName, line: line + 1, module: specifier.text });
        }
      }
      ts.forEachChild(node, visit);
      for (const doc of node.jsDoc ?? []) visit(doc);
    }
    visit(source);
  }
  return issues;
}
