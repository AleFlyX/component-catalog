import ts from "typescript";
import { canonicalSymbol } from "./source.mjs";

function moduleTargets(checker, specifier, name, ancestors) {
  const module = checker.getSymbolAtLocation(specifier);
  const result = new Set();
  for (const source of module?.declarations ?? []) {
    if (!ts.isSourceFile(source)) continue;
    for (const symbol of publicExportSymbols(checker, source, name, ancestors)) result.add(symbol);
  }
  return result;
}

function bindingTargets(checker, symbol, ancestors) {
  if (!symbol || ancestors.has(symbol) || checker.getTypeOnlyAliasDeclaration(symbol)) return new Set();
  const seen = new Set(ancestors).add(symbol);
  for (const node of symbol.declarations ?? []) {
    if (ts.isExportSpecifier(node)) {
      const declaration = node.parent.parent;
      if (declaration.moduleSpecifier)
        return moduleTargets(checker, declaration.moduleSpecifier, (node.propertyName ?? node.name).text, seen);
      return bindingTargets(checker, checker.getExportSpecifierLocalTargetSymbol(node), seen);
    }
    if (ts.isImportSpecifier(node))
      return moduleTargets(checker, node.parent.parent.parent.moduleSpecifier, (node.propertyName ?? node.name).text, seen);
    if (ts.isImportClause(node))
      return moduleTargets(checker, node.parent.moduleSpecifier, "default", seen);
    if (ts.isExportAssignment(node) && ts.isIdentifier(node.expression))
      return bindingTargets(checker, checker.getSymbolAtLocation(node.expression), seen);
  }
  const target = canonicalSymbol(checker, symbol);
  return target && (target.flags & ts.SymbolFlags.Value) ? new Set([target]) : new Set();
}

// Resolve the public value through barrels without accepting an ambiguous star winner.
export function publicExportSymbols(checker, source, name, ancestors = new Set()) {
  const key = `${source.fileName}:${name}`;
  if (ancestors.has(key)) return new Set();
  const seen = new Set(ancestors).add(key);
  const module = checker.getSymbolAtLocation(source);
  if (!module) return new Set();
  const exported = checker.getExportsOfModule(module).find((symbol) => symbol.name === name);
  if (!exported || checker.getTypeOnlyAliasDeclaration(exported)) return new Set();
  const direct = exported.declarations?.some((node) => node.getSourceFile() === source);
  if (direct) return bindingTargets(checker, exported, seen);
  const result = new Set();
  if (name === "default") return result;
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement) || statement.isTypeOnly || statement.exportClause || !statement.moduleSpecifier) continue;
    for (const symbol of moduleTargets(checker, statement.moduleSpecifier, name, seen)) result.add(symbol);
  }
  return result;
}

export function matchesPublicExport(program, file, name, expected) {
  // An existing public facade may not yet have consumers in the configured program.
  // Analyze it without changing enrollment or emitting files. Symbols from separate
  // programs have different identities, so compare their actual value declarations.
  const targetProgram = program.getSourceFile(file) ? program : ts.createProgram([file], program.getCompilerOptions());
  const source = targetProgram.getSourceFile(file);
  if (!source) return false;
  const symbols = publicExportSymbols(targetProgram.getTypeChecker(), source, name);
  if (symbols.size !== 1) return false;
  const [symbol] = symbols;
  if (symbol === expected) return true;
  const actual = symbol.valueDeclaration;
  const wanted = expected.valueDeclaration;
  return !!actual && !!wanted && actual.kind === wanted.kind && actual.pos === wanted.pos &&
    actual.end === wanted.end && actual.getSourceFile().fileName === wanted.getSourceFile().fileName;
}

export function exampleImportModes(checker, source, entrySymbol, specifier, options) {
  const exact = new Set();
  const related = new Set();
  function visit(node) {
    let moduleSpecifier;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) moduleSpecifier = node.moduleSpecifier;
    else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) moduleSpecifier = node.arguments[0];
    if (moduleSpecifier && ts.isStringLiteralLike(moduleSpecifier)) {
      const module = checker.getSymbolAtLocation(moduleSpecifier);
      if (module && checker.getExportsOfModule(module).some((symbol) => canonicalSymbol(checker, symbol) === entrySymbol)) {
        const mode = ts.getModeForUsageLocation(source, moduleSpecifier, options);
        related.add(mode);
        if (moduleSpecifier.text === specifier) exact.add(mode);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return exact.size ? exact : related.size ? related : new Set([source.impliedNodeFormat]);
}
