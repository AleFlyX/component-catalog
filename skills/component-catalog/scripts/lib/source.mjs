import path from "node:path";
import ts from "typescript";

export const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function fail(node, workspace, message) {
  const source = node.getSourceFile();
  const { line } = source.getLineAndCharacterOfPosition(node.getStart());
  throw new Error(`${path.relative(workspace, source.fileName)}:${line + 1}: ${message}`);
}

export function canonicalSymbol(checker, symbol) {
  if (!symbol) return undefined;
  const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  return checker.getExportSymbolOfSymbol(target);
}

export function isCatalogMarked(node) {
  return !!node.jsDoc?.some((doc) =>
    doc.tags?.some((tag) => tag.tagName.text === "componentCatalog"),
  );
}

export function catalogDecision(node) {
  const owned = (node.jsDoc ?? []).flatMap((doc) => [...(doc.tags ?? [])]);
  const marks = owned.filter((tag) => tag.tagName.text === "componentCatalog");
  const ignores = owned.filter((tag) => tag.tagName.text === "componentCatalogIgnore");
  const reason = ignores.length
    ? (ts.getTextOfJSDocComment(ignores[0].comment) ?? "").trim()
    : undefined;
  let error;
  if (marks.length && ignores.length)
    error = "@componentCatalog and @componentCatalogIgnore are mutually exclusive";
  else if (marks.length > 1 || ignores.length > 1)
    error = "Catalog decision tags cannot be repeated";
  else if (ignores.length && !/^(internal|non-component|unsupported):\s*\S[\s\S]*$/.test(reason))
    error =
      "@componentCatalogIgnore requires internal:, non-component: or unsupported: followed by a concrete reason";
  return { marked: marks.length > 0, ignored: ignores.length > 0, reason, error };
}

// Shared by discovery and generation: a supported syntax is not a public-API decision.
export function localExportNames(source) {
  return new Set(
    source.statements.flatMap((statement) =>
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
        ? statement.exportClause.elements
            .filter(
              (entry) =>
                !entry.isTypeOnly &&
                (!entry.propertyName || entry.propertyName.text === entry.name.text),
            )
            .map((entry) => entry.name.text)
        : [],
    ),
  );
}

export function localDeclaration(source, name) {
  return source.statements.find((statement) =>
    ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name?.text === name) ||
    (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(
      (declaration) => declaration.name?.text === name,
    )));
}

export function defaultReference(expression) {
  while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) || ts.isSatisfiesExpression(expression)) expression = expression.expression;
  return ts.isIdentifier(expression) ? expression : undefined;
}

function localDefaultExport(source, name) {
  if (!name) return undefined;
  return source.statements.find((statement) =>
    ts.isExportAssignment(statement) && !statement.isExportEquals &&
    defaultReference(statement.expression)?.text === name);
}

// Only direct React imports, never same-named local helpers or arbitrary HOCs.
function isReactHelper(expression, source, helper) {
  return source.statements.some((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      statement.moduleSpecifier.text !== "react" ||
      !statement.importClause ||
      statement.importClause.isTypeOnly
    )
      return false;
    const clause = statement.importClause;
    const bindings = clause.namedBindings;
    if (ts.isIdentifier(expression))
      return (
        bindings &&
        ts.isNamedImports(bindings) &&
        bindings.elements.some(
          (entry) =>
            !entry.isTypeOnly &&
            entry.name.text === expression.text &&
            (entry.propertyName ?? entry.name).text === helper,
        )
      );
    return (
      ts.isPropertyAccessExpression(expression) &&
      expression.name.text === helper &&
      ts.isIdentifier(expression.expression) &&
      (clause.name?.text === expression.expression.text ||
        (bindings &&
          ts.isNamespaceImport(bindings) &&
          bindings.name.text === expression.expression.text))
    );
  });
}

function componentRender(value, source, seen = new Set()) {
  if (!value) return undefined;
  while (ts.isParenthesizedExpression(value)) value = value.expression;
  if (seen.has(value)) return undefined;
  seen = new Set(seen).add(value);
  // Preserve the declared public API of cast memo/ref results; do not interpret
  // arbitrary cast values as component implementations.
  if (ts.isAsExpression(value) || ts.isTypeAssertionExpression(value) || ts.isSatisfiesExpression(value)) {
    const render = componentRender(value.expression, source, seen);
    return render?.wrapper ? render : undefined;
  }
  if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) return { callable: value, declaration: value };
  if (ts.isIdentifier(value)) {
    const node = source.statements.find((item) => ts.isFunctionDeclaration(item) && item.name?.text === value.text && item.body)
      ?? localDeclaration(source, value.text);
    if (!node) return undefined;
    if (ts.isFunctionDeclaration(node) && node.body)
      return { callable: node, declaration: node };
    if (ts.isVariableStatement(node) && node.declarationList.flags & ts.NodeFlags.Const) {
      const declaration = node.declarationList.declarations.find((item) => item.name?.text === value.text);
      const render = componentRender(declaration?.initializer, source, seen);
      return render ? { ...render, declaration } : undefined;
    }
    return undefined;
  }
  if (
    ts.isCallExpression(value) &&
    isReactHelper(value.expression, source, "forwardRef") &&
    value.arguments.length === 1 && !ts.isSpreadElement(value.arguments[0])
  ) {
    const render = componentRender(value.arguments[0], source, seen);
    if (render && !render.wrapper) return { ...render, wrapper: "forwardRef" };
  }
  if (
    ts.isCallExpression(value) &&
    isReactHelper(value.expression, source, "memo") &&
    [1, 2].includes(value.arguments.length) &&
    !value.arguments.some(ts.isSpreadElement)
  ) {
    const render = componentRender(value.arguments[0], source, seen);
    if (render) return { ...render, wrapper: render.wrapper?.includes("forwardRef") ? "memo(forwardRef)" : "memo" };
  }
  return undefined;
}

export function declarationShape(node) {
  const source = node.getSourceFile();
  let declaration = node;
  let callable;
  let members;
  let wrapper;
  let publicExpression;
  if (node.parent === source && ts.isFunctionDeclaration(node) && node.body) {
    callable = node;
  } else if (
    node.parent === source &&
    ts.isVariableStatement(node) &&
    node.declarationList.flags & ts.NodeFlags.Const &&
    node.declarationList.declarations.length === 1
  ) {
    [declaration] = node.declarationList.declarations;
    let value = declaration.initializer;
    while (value && ts.isParenthesizedExpression(value)) value = value.expression;
    // A bare alias remains a distinct unsupported export; resolve references only
    // inside known React wrappers, whose public callable type is checked later.
    const render = value && !ts.isIdentifier(value) ? componentRender(value, source) : undefined;
    if (render) ({ callable, wrapper } = render);
    else if (value && ts.isObjectLiteralExpression(value)) {
      members = value.properties.map((property) => {
        if (
          !ts.isPropertyAssignment(property) ||
          !ts.isIdentifier(property.name) ||
          !isReference(property.initializer)
        )
          throw new Error("Catalog namespace members require named references");
        return { name: property.name.text, target: property.initializer.getText() };
      });
      if (!members.length || new Set(members.map(({ name }) => name)).size !== members.length)
        throw new Error("Catalog namespace requires nonempty, unique members");
    }
  } else if (node.parent === source && ts.isExportAssignment(node) && !node.isExportEquals) {
    const render = componentRender(node.expression, source);
    if (render?.wrapper) {
      ({ declaration, callable, wrapper } = render);
      publicExpression = node.expression;
    }
  }
  if (!callable && !members)
    throw new Error(
      "Unsupported @componentCatalog declaration: supports direct functions, React forwardRef/memo with inline or same-file render functions, named wrapped defaults, or reference namespaces. Report this limitation; preserve runtime behavior.",
    );
  const flags = ts.getCombinedModifierFlags(node);
  const named = !!(flags & ts.ModifierFlags.Export) || localExportNames(source).has(declaration.name?.text);
  const defaultAssignment = !named && localDefaultExport(source, declaration.name?.text);
  if (!publicExpression && defaultAssignment) {
    publicExpression = defaultAssignment.expression;
    if (publicExpression !== defaultReference(publicExpression)) wrapper ??= "default export";
  }
  const defaultExport = !!publicExpression || !!(flags & ts.ModifierFlags.Default) ||
    !!defaultAssignment;
  if (!named && !defaultExport)
    throw new Error("@componentCatalog declaration must be exported");
  if (
    !declaration.name ||
    !ts.isIdentifier(declaration.name) ||
    !/^[A-Z][A-Za-z0-9]*$/.test(declaration.name.text)
  )
    throw new Error("Catalog entries require a PascalCase name");
  return {
    declaration,
    callable,
    members,
    wrapper,
    publicExpression,
    exportKind: defaultExport ? "default" : "named",
  };
}

// Inspect owned JSDoc, rather than inherited tags on each child of a declaration.
export function discoverEntries(sources, checker, workspace, roots) {
  const entries = [];
  for (const source of sources) {
    function visit(node) {
      const decision = catalogDecision(node);
      if (decision.error) fail(node, workspace, decision.error);
      if (isCatalogMarked(node)) {
        if (!roots.some((root) => source.fileName.startsWith(root.path + path.sep))) {
          fail(node, workspace, "@componentCatalog must belong to a configured componentRoot");
        }
        let shape;
        try {
          shape = declarationShape(node);
        } catch (error) {
          fail(node, workspace, error.message);
        }
        const { declaration, callable, members, wrapper, publicExpression, exportKind } = shape;
        entries.push({
          node,
          declaration,
          callable,
          members,
          wrapper,
          publicExpression,
          source,
          symbol: publicExpression
            ? canonicalSymbol(checker, checker.getExportsOfModule(checker.getSymbolAtLocation(source)).find((item) => item.name === "default"))
            : canonicalSymbol(checker, checker.getSymbolAtLocation(declaration.name)),
          exportKind,
        });
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return entries;
}

function isReference(node) {
  return (
    ts.isIdentifier(node) || (ts.isPropertyAccessExpression(node) && isReference(node.expression))
  );
}

function unwrapped(node) {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAwaitExpression(node)))
    node = node.expression;
  return node;
}

function importDeclaration(node) {
  while (node && !ts.isImportDeclaration(node)) node = node.parent;
  return node;
}

function isReactLazy(expression, checker) {
  if (ts.isIdentifier(expression)) {
    return checker
      .getSymbolAtLocation(expression)
      ?.declarations?.some(
        (declaration) =>
          ts.isImportSpecifier(declaration) &&
          (declaration.propertyName ?? declaration.name).text === "lazy" &&
          importDeclaration(declaration)?.moduleSpecifier.text === "react",
      );
  }
  if (ts.isPropertyAccessExpression(expression) && expression.name.text === "lazy") {
    return checker
      .getSymbolAtLocation(expression.expression)
      ?.declarations?.some(
        (declaration) =>
          (ts.isNamespaceImport(declaration) || ts.isImportClause(declaration)) &&
          importDeclaration(declaration)?.moduleSpecifier.text === "react",
      );
  }
  return false;
}

function lazyTarget(initializer, checker) {
  if (!ts.isCallExpression(initializer) || !isReactLazy(initializer.expression, checker))
    return undefined;
  const [loader] = initializer.arguments;
  if (!loader || (!ts.isArrowFunction(loader) && !ts.isFunctionExpression(loader)))
    return undefined;
  let result = loader.body;
  if (ts.isBlock(result)) {
    if (result.statements.length !== 1 || !ts.isReturnStatement(result.statements[0]))
      return undefined;
    result = result.statements[0].expression;
  }
  result = unwrapped(result);
  let name = "default";
  if (result && ts.isObjectLiteralExpression(result)) {
    const property = result.properties.find(
      (item) => ts.isPropertyAssignment(item) && item.name.getText() === "default",
    );
    result = unwrapped(property?.initializer);
    if (!result || !ts.isPropertyAccessExpression(result)) return undefined;
    name = result.name.text;
    result = unwrapped(result.expression);
  }
  if (
    !result ||
    !ts.isCallExpression(result) ||
    result.expression.kind !== ts.SyntaxKind.ImportKeyword
  )
    return undefined;
  const [specifier] = result.arguments;
  if (!specifier || !ts.isStringLiteral(specifier)) return undefined;
  const module = checker.getSymbolAtLocation(specifier);
  return (
    module &&
    canonicalSymbol(
      checker,
      checker.getExportsOfModule(module).find((symbol) => symbol.name === name),
    )
  );
}

// Symbols distinguish aliases and shadowed names; imports/types/comments alone are not uses.
export function referencedExports(source, checker) {
  const references = new Set();
  const lazyBindings = [];
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node)) return;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      isReactLazy(node.initializer.expression, checker)
    ) {
      const target = lazyTarget(node.initializer, checker);
      if (target)
        lazyBindings.push([
          canonicalSymbol(checker, checker.getSymbolAtLocation(node.name)),
          target,
        ]);
      // The loader is deferred. Its named member access is not an independent use.
      return;
    }
    if (ts.isIdentifier(node)) {
      const parent = node.parent;
      const declarationName =
        parent.name === node &&
        (ts.isVariableDeclaration(parent) ||
          ts.isFunctionDeclaration(parent) ||
          ts.isFunctionExpression(parent) ||
          ts.isParameter(parent) ||
          ts.isBindingElement(parent) ||
          ts.isMethodDeclaration(parent) ||
          ts.isPropertyDeclaration(parent));
      if (!declarationName) {
        const symbol = canonicalSymbol(checker, checker.getSymbolAtLocation(node));
        if (symbol) references.add(symbol);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  for (const [binding, target] of lazyBindings) {
    if (references.has(binding)) references.add(target);
  }
  return references;
}

export function usageKind(file, config) {
  if (
    /\.(test|spec)\.[^.]+$/.test(file) ||
    config.testRoots.some((root) => file.startsWith(root + path.sep))
  )
    return "test";
  if (/\.stories\.[^.]+$/.test(file)) return "story";
  return config.previewRoots.some((root) => file.startsWith(root + path.sep))
    ? "preview"
    : "production";
}
