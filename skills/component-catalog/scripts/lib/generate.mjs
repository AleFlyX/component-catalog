import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { validateSchemaValue } from "./schema.mjs";
import { compare, discoverEntries, referencedExports, usageKind } from "./source.mjs";
import { createProject, filesBelow } from "./project.mjs";
import { isSourceFile } from "./files.mjs";
import { importFile, relativeImport } from "./imports.mjs";
import { exampleImportModes, matchesPublicExport } from "./import-validation.mjs";
import { unresolvedImports } from "./dependencies.mjs";

export function generateCatalog(config, options = {}) {
  const { projectRoot: workspace, sourceRoot, componentRoots } = config;
  const project = options.project ?? createProject(config);
  const { relative, configInputs, parsed, program, checker, sources, diagnosticHost } = project;
  const schemaPath = new URL("../schema/catalog.schema.json", import.meta.url);
  const rootFor = (file) => componentRoots.find((root) => file.startsWith(root.path + path.sep));
  const allowedStatuses = new Set(["experimental", "stable", "deprecated"]);
  const allowedExamples = new Set(["production", "preview", "test", "story"]);
  const componentIdPattern = /^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)+$/;
  const typeFormat =
    ts.TypeFormatFlags.NoTruncation |
    ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope |
    ts.TypeFormatFlags.UseFullyQualifiedType;

  function readJSON(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }

  function tagText(tag) {
    if (typeof tag.comment === "string") return tag.comment.trim();
    return (tag.comment ?? [])
      .map((part) => part.text)
      .join("")
      .trim();
  }

  function tagsFor(node) {
    const result = new Map();
    for (const tag of ts.getJSDocTags(node)) {
      const name = tag.tagName.text;
      const values = result.get(name) ?? [];
      values.push(tagText(tag));
      result.set(name, values);
    }
    return result;
  }

  function oneTag(tags, name, component, { optional = false } = {}) {
    const values = tags.get(name) ?? [];
    if (values.length > 1) throw new Error(`${component}: duplicate @${name}`);
    if (!values.length) {
      if (optional) return undefined;
      throw new Error(`${component}: missing @${name}`);
    }
    if (!values[0]) throw new Error(`${component}: empty @${name}`);
    return values[0];
  }

  function manyTags(tags, name, component) {
    const values = tags.get(name) ?? [];
    if (!values.length) throw new Error(`${component}: missing @${name}`);
    if (values.some((value) => !value)) throw new Error(`${component}: empty @${name}`);
    if (new Set(values).size !== values.length) throw new Error(`${component}: duplicate @${name}`);
    return values;
  }

  function componentId(sourceFile, exportName) {
    const folder = path
      .relative(rootFor(sourceFile.fileName).path, path.dirname(sourceFile.fileName))
      .split(path.sep)
      .filter(Boolean);
    return [rootFor(sourceFile.fileName).idPrefix, ...folder, exportName].join(".");
  }

  function importExtension(sourceFile) {
    const selected = rootFor(sourceFile.fileName).importExtension ?? "omit";
    return selected === "js" && /\.[jt]sx$/.test(sourceFile.fileName) && parsed.options.jsx === ts.JsxEmit.Preserve
      ? "jsx" : selected;
  }

  function importPath(sourceFile) {
    const root = rootFor(sourceFile.fileName);
    if (root.importPrefix === null) return null;
    return (
      root.importPrefix +
      "/" +
      importFile(path.relative(root.path, sourceFile.fileName).replaceAll(path.sep, "/"),
        importExtension(sourceFile))
    );
  }

  function declarationDefaultValues(parameter) {
    const values = new Map();
    if (!ts.isObjectBindingPattern(parameter.name)) return values;
    for (const element of parameter.name.elements) {
      if (!element.initializer || !ts.isIdentifier(element.name)) continue;
      values.set(
        element.propertyName?.getText() ?? element.name.text,
        element.initializer.getText(),
      );
    }
    return values;
  }

  function declaredProps(typeNode, checker, seen = new Set()) {
    if (!typeNode) return { names: undefined, inheritedTypes: [] };
    if (ts.isParenthesizedTypeNode(typeNode)) return declaredProps(typeNode.type, checker, seen);
    if (ts.isTypeLiteralNode(typeNode)) {
      return {
        names: new Set(
          typeNode.members
            .filter(ts.isPropertySignature)
            .map((member) => member.name?.getText())
            .filter(Boolean),
        ),
        inheritedTypes: [],
      };
    }
    if (ts.isIntersectionTypeNode(typeNode)) {
      const names = new Set();
      const inheritedTypes = [];
      for (const member of typeNode.types) {
        const declared = declaredProps(member, checker, seen);
        if (declared.names === undefined)
          inheritedTypes.push(member.getText().replace(/\s+/g, " "));
        else for (const name of declared.names) names.add(name);
        inheritedTypes.push(...declared.inheritedTypes);
      }
      return { names, inheritedTypes };
    }
    if (ts.isTypeReferenceNode(typeNode)) {
      const symbol = checker.getSymbolAtLocation(typeNode.typeName);
      const declaration = symbol?.declarations?.find(ts.isTypeAliasDeclaration);
      if (declaration && !seen.has(declaration)) {
        seen.add(declaration);
        return declaredProps(declaration.type, checker, seen);
      }
    }
    return { names: undefined, inheritedTypes: [] };
  }

  function schemaForType(type, checker) {
    if (type.flags & ts.TypeFlags.String) return { status: "complete", schema: { type: "string" } };
    if (type.flags & ts.TypeFlags.Number) return { status: "complete", schema: { type: "number" } };
    if (type.flags & ts.TypeFlags.Boolean)
      return { status: "complete", schema: { type: "boolean" } };
    if (type.flags & ts.TypeFlags.StringLiteral) {
      return { status: "complete", schema: { type: "string", const: type.value } };
    }
    if (type.flags & ts.TypeFlags.NumberLiteral) {
      return { status: "complete", schema: { type: "number", const: type.value } };
    }
    if (type.flags & ts.TypeFlags.BooleanLiteral) {
      return {
        status: "complete",
        schema: { type: "boolean", const: type.intrinsicName === "true" },
      };
    }
    if (type.flags & ts.TypeFlags.Null) return { status: "complete", schema: { type: "null" } };
    if (type.isUnion()) {
      const members = type.types.filter((member) => !(member.flags & ts.TypeFlags.Undefined));
      const schemas = members.map((member) => schemaForType(member, checker));
      if (schemas.every(({ status }) => status === "complete")) {
        const literals = schemas.map(({ schema }) => schema);
        const primitive = new Set(literals.map((schema) => schema.type));
        if (primitive.size === 1 && literals.every((schema) => Object.hasOwn(schema, "const"))) {
          return {
            status: "complete",
            schema: {
              type: literals[0].type,
              enum: literals.map((schema) => schema.const),
            },
          };
        }
        if (literals.length === 1) return { status: "complete", schema: literals[0] };
        return { status: "complete", schema: { anyOf: literals } };
      }
      return { status: "partial" };
    }
    if (checker.isTupleType(type)) return { status: "unsupported" };
    if (checker.isArrayType(type)) {
      const [element] = checker.getTypeArguments(type);
      if (!element) return { status: "partial" };
      const item = schemaForType(element, checker);
      return item.status === "complete"
        ? { status: "complete", schema: { type: "array", items: item.schema } }
        : { status: "partial" };
    }
    if (type.getCallSignatures().length || type.getConstructSignatures().length) {
      return { status: "unsupported" };
    }
    return { status: "unsupported" };
  }

  function genericParameters(signature, location) {
    return (signature?.typeParameters ?? []).map((parameter) => {
      const constraint = parameter.getConstraint();
      const defaultType = parameter.getDefault();
      const declaration = parameter.getSymbol()?.declarations?.find(ts.isTypeParameterDeclaration);
      const isConst = declaration?.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ConstKeyword);
      const display = (type) => checker.typeToString(type, location, typeFormat);
      return (isConst ? "const " : "") + display(parameter) +
        (constraint ? ` extends ${display(constraint)}` : "") +
        (defaultType ? ` = ${display(defaultType)}` : "");
    });
  }

  function propsFor(node, checker, entry) {
    const parameter = node.parameters[0];
    let typeParameters = genericParameters(checker.getSignatureFromDeclaration(node), node);
    if (!parameter && !entry.wrapper)
      return { displayType: "{}", typeParameters, inheritedTypes: [], items: [] };
    let type;
    if (entry.wrapper) {
      const signatures = checker.getTypeAtLocation(entry.publicExpression ?? entry.declaration.name).getCallSignatures();
      const props = signatures.length === 1 && signatures[0].getParameters()[0];
      if (!props && signatures.length === 1 && !parameter)
        return { displayType: "{}", typeParameters: genericParameters(signatures[0], entry.declaration), inheritedTypes: [], items: [] };
      if (!props)
        throw new Error(`${entry.declaration.name.text}: cannot resolve ${entry.wrapper} public Props`);
      typeParameters = genericParameters(signatures[0], entry.declaration);
      type = checker.getTypeOfSymbolAtLocation(props, entry.declaration);
      // React's memo overload may infer unknown for a render with no parameters.
      // Preserve that public type rather than inventing {} or rejecting a valid component.
      const parameterlessMemo = entry.wrapper === "memo" && !parameter;
      if (
        (type.flags & ts.TypeFlags.Any) ||
        ((type.flags & ts.TypeFlags.Unknown) && !parameterlessMemo)
      )
        throw new Error(`${entry.declaration.name.text}: unresolved ${entry.wrapper} public Props`);
    } else type = checker.getTypeAtLocation(parameter);
    const location = parameter ?? entry.declaration;
    const defaults = parameter ? declarationDefaultValues(parameter) : new Map();
    const declared = entry.wrapper
      ? { names: undefined, inheritedTypes: [] }
      : declaredProps(parameter.type, checker);
    const items = type
      .getProperties()
      .filter((property) => declared.names === undefined || declared.names.has(property.getName()))
      .map((property) => {
        const declaration = property.valueDeclaration ?? property.declarations?.[0] ?? location;
        const propertyType = checker.getTypeOfSymbolAtLocation(property, declaration);
        const value = schemaForType(propertyType, checker);
        const description = ts
          .displayPartsToString(property.getDocumentationComment(checker))
          .trim();
        const item = {
          name: property.getName(),
          displayType: checker.typeToString(propertyType, declaration, typeFormat),
          required: !(property.flags & ts.SymbolFlags.Optional),
          ...(description ? { description } : {}),
          ...(defaults.has(property.getName())
            ? { defaultValue: defaults.get(property.getName()) }
            : {}),
          schemaStatus: value.status,
          ...(value.schema ? { valueSchema: value.schema } : {}),
        };
        return item;
      });
    return {
      displayType: checker.typeToString(type, location, typeFormat),
      typeParameters,
      inheritedTypes: declared.inheritedTypes,
      items,
    };
  }

  function parseExamples(tags, entry) {
    const component = entry.declaration.name.text;
    return manyTags(tags, "catalogExample", component).map((value) => {
      const match = /^(production|preview|test|story)\s+(\S+)\s+\|\s+(.+)$/.exec(value);
      if (!match)
        throw new Error(
          `${component}: @catalogExample must be KIND project/relative/path.tsx | purpose`,
        );
      const [, kind, sourcePath, purpose] = match;
      const resolved = path.resolve(workspace, sourcePath);
      if (
        !allowedExamples.has(kind) ||
        !resolved.startsWith(sourceRoot + path.sep) ||
        !references.has(resolved)
      ) {
        throw new Error(`${component}: invalid example path ${sourcePath}`);
      }
      if (usageKind(resolved, config) !== kind) {
        throw new Error(`${component}: example kind does not match its source: ${sourcePath}`);
      }
      if (!references.get(resolved).has(entry.symbol)) {
        throw new Error(`${component}: example does not use the exported entry: ${sourcePath}`);
      }
      return { kind, path: relative(resolved), purpose };
    });
  }

  function usageFor(entry) {
    const usage = { production: 0, preview: 0, test: 0 };
    for (const [file, symbols] of references) {
      const kind = usageKind(file, config);
      if (rootFor(file) && kind === "production") continue;
      if (Object.hasOwn(usage, kind) && symbols.has(entry.symbol)) usage[kind] += 1;
    }
    return usage;
  }

  function catalogEntry(entry, checker) {
    const { node, declaration, callable, members, source: sourceFile, exportKind } = entry;
    const exportName = declaration.name.text;
    const tags = tagsFor(node);
    const reuseTag = oneTag(tags, "catalogReuse", exportName, { optional: true });
    let reuse = rootFor(sourceFile.fileName).reuse ?? { scope: "unspecified" };
    if (reuseTag !== undefined) {
      if (["project", "unspecified"].includes(reuseTag)) reuse = { scope: reuseTag };
      else {
        const owner = /^module:([a-z][a-z0-9]*(?:[._-][a-z0-9]+)*)$/.exec(reuseTag)?.[1];
        if (!owner) throw new Error(`${exportName}: invalid @catalogReuse; use project, unspecified or module:<owner>`);
        reuse = { scope: "module", owner };
      }
    }
    const status = oneTag(tags, "catalogStatus", exportName);
    if (!allowedStatuses.has(status))
      throw new Error(`${exportName}: invalid @catalogStatus ${status}`);
    const replacement = oneTag(tags, "catalogReplacement", exportName, { optional: true });
    const deprecationReason = oneTag(tags, "catalogDeprecatedReason", exportName, {
      optional: true,
    });
    if (status === "deprecated" && !replacement && !deprecationReason) {
      throw new Error(
        `${exportName}: deprecated component requires @catalogDeprecatedReason or @catalogReplacement`,
      );
    }
    if (deprecationReason && status !== "deprecated")
      throw new Error(`${exportName}: @catalogDeprecatedReason requires deprecated status`);
    if (replacement && !componentIdPattern.test(replacement)) {
      throw new Error(`${exportName}: invalid @catalogReplacement ${replacement}`);
    }
    const summary = entry.publicExpression
      ? (node.jsDoc ?? []).map((doc) => ts.getTextOfJSDocComment(doc.comment) ?? "").join("\n").trim()
      : ts.displayPartsToString(checker.getSymbolAtLocation(declaration.name).getDocumentationComment(checker)).trim();
    if (!summary) throw new Error(`${exportName}: missing component summary`);
    const tasks = manyTags(tags, "catalogTask", exportName);
    if (tasks.some((task) => !/^[a-z][a-z0-9-]*$/.test(task))) {
      throw new Error(`${exportName}: invalid @catalogTask`);
    }
    const sourceImport = importPath(sourceFile);
    const examples = parseExamples(tags, entry);
    for (const example of examples) {
      if (sourceImport === null && example.path === relative(sourceFile.fileName)) continue;
      const specifier = sourceImport ?? relativeImport(relative(sourceFile.fileName), example.path,
        importExtension(sourceFile)).specifier;
      if (/\.tsx?$/.test(specifier) &&
          !(parsed.options.allowImportingTsExtensions || (parsed.options.rewriteRelativeImportExtensions && /^\.\.?\//.test(specifier))))
        throw new Error(`${exportName}: preserved TypeScript import ${specifier} requires allowImportingTsExtensions or relative-import rewriting. Choose an importExtension supported by the project.`);
      const from = path.resolve(workspace, example.path);
      const modes = exampleImportModes(checker, program.getSourceFile(from), entry.symbol, specifier, parsed.options);
      const valid = [...modes].some((mode) => {
        const resolved = ts.resolveModuleName(specifier, from, parsed.options, ts.sys,
          undefined, undefined, mode).resolvedModule;
        if (!resolved) return false;
        return matchesPublicExport(program, resolved.resolvedFileName,
          exportKind === "default" ? "default" : exportName, entry.symbol);
      });
      if (!valid)
        throw new Error(`${exportName}: catalog import ${specifier} does not resolve to ${relative(sourceFile.fileName)} from ${example.path}. Correct importPrefix/importExtension, or use importPrefix: null for caller-relative imports; do not invent a runtime alias.`);
    }
    if (
      status === "stable" &&
      !examples.some(({ kind }) => ["production", "preview"].includes(kind))
    ) {
      throw new Error(`${exportName}: stable component requires a production or preview example`);
    }
    return {
      id: componentId(sourceFile, exportName),
      exportName,
      exportKind,
      kind: members ? "namespace" : "component",
      importPath: sourceImport,
      importExtension: importExtension(sourceFile),
      sourcePath: relative(sourceFile.fileName),
      layer: rootFor(sourceFile.fileName).layer,
      reuse,
      status,
      ...(replacement ? { replacement } : {}),
      ...(deprecationReason ? { deprecationReason } : {}),
      documentationStatus: "complete",
      summary,
      tasks,
      ...(members ? { members } : { props: propsFor(callable, checker, entry) }),
      constraints: manyTags(tags, "catalogConstraint", exportName),
      examples,
      usage: usageFor(entry),
    };
  }

  function sourceDigest(components) {
    const hash = crypto.createHash("sha256");
    const examples = components.flatMap((component) =>
      component.examples.map((example) => path.join(workspace, example.path)),
    );
    const inputs = [
      config.configPath,
      ...configInputs,
      ...componentRoots.flatMap((root) =>
        filesBelow(root.path, config, (file) => isSourceFile(file) || file.endsWith(".d.ts")),
      ),
      ...examples,
    ];
    for (const file of [...new Set(inputs)].sort()) {
      hash.update(relative(file));
      hash.update("\0");
      hash.update(fs.readFileSync(file));
      hash.update("\0");
    }
    hash.update(fs.readFileSync(schemaPath));
    hash.update(ts.version);
    hash.update("\0");
    hash.update(JSON.stringify(components));
    return `sha256:${hash.digest("hex")}`;
  }

  const catalogSchema = readJSON(schemaPath);
  const entries = discoverEntries(sources, checker, workspace, componentRoots);
  if (!entries.length && config.configVersion !== 2)
    throw new Error(
      "No @componentCatalog declarations found in configured componentRoots. Run scan <component-directory>, review public candidates, and add metadata to selected supported declarations before generate.",
    );
  const extraction = ts.createProgram({
    rootNames: parsed.options.composite ? program.getRootFileNames() : [
      ...new Set(entries.map(({ source }) => source.fileName)),
      ...parsed.fileNames.filter((file) => file.endsWith(".d.ts")),
    ],
    options: parsed.options,
    oldProgram: program,
  });
  const diagnostics = ts.getPreEmitDiagnostics(extraction);
  if (diagnostics.length) throw new Error(ts.formatDiagnostics(diagnostics, diagnosticHost));
  const missing = unresolvedImports(
    extraction.getSourceFiles().filter((source) => !source.isDeclarationFile),
    extraction.getTypeChecker(),
    extraction.getCompilerOptions(),
  )[0];
  if (missing)
    throw new Error(`${relative(missing.sourcePath)}:${missing.line}: Cannot resolve static import ${missing.module}; restore dependencies or correct the compiler config.`);
  const references = new Map(
    sources.map((source) => [source.fileName, referencedExports(source, checker)]),
  );
  const components = entries
    .map((entry) => {
      try {
        return catalogEntry(entry, checker);
      } catch (error) {
        const { line } = entry.source.getLineAndCharacterOfPosition(entry.node.getStart());
        if (options.issues) {
          options.issues.push({
            code: "METADATA_INVALID",
            sourcePath: relative(entry.source.fileName),
            line: line + 1,
            exportName: entry.declaration.name.text,
            message: error.message,
          });
          return null;
        }
        throw new Error(`${relative(entry.source.fileName)}:${line + 1}: ${error.message}`, {
          cause: error,
        });
      }
    })
    .filter(Boolean);
  components.sort((left, right) => compare(left.id, right.id));
  const ids = new Set();
  for (const component of components) {
    if (ids.has(component.id)) throw new Error(`Duplicate component catalog id: ${component.id}`);
    ids.add(component.id);
  }
  if (config.configVersion === 2) {
    const byId = new Map(components.map((item) => [item.id, item]));
    for (const component of components) {
      let current = component;
      const visited = new Set();
      let message;
      while (current?.replacement) {
        if (visited.has(current.id)) {
          message = `Replacement cycle involving ${current.id}`;
          break;
        }
        visited.add(current.id);
        if (!byId.has(current.replacement)) {
          message = `Replacement ${current.replacement} does not exist`;
          break;
        }
        current = byId.get(current.replacement);
      }
      if (message) {
        if (options.issues)
          options.issues.push({
            code: "REPLACEMENT_INVALID",
            sourcePath: component.sourcePath,
            exportName: component.exportName,
            message,
          });
        else throw new Error(message);
      }
    }
  }
  const catalog = {
    schemaVersion: 7,
    sourceDigest: sourceDigest(components),
    typescriptVersion: ts.version,
    components,
  };
  validateSchemaValue(catalog, catalogSchema, catalogSchema);
  return catalog;
}
