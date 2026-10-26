import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { inside } from "./config.mjs";
import { isJavaScript, isSourceFile } from "./files.mjs";

export function filesBelow(directory, config, predicate = () => true, onSymlink = () => {}) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (config.exclude.some((excluded) => inside(excluded, file))) continue;
    if (entry.isSymbolicLink()) {
      onSymlink(file);
      continue;
    }
    if (entry.isDirectory()) {
      if (!["node_modules", ".git"].includes(entry.name))
        result.push(...filesBelow(file, config, predicate, onSymlink));
    } else if (entry.isFile() && predicate(file)) result.push(file);
  }
  return result.sort();
}

function createScopedTypeHost(workspace, options, config, files) {
  const host = ts.createCompilerHost(options, true);
  const resolveModule = (name, containing) =>
    ts.resolveModuleName(name, containing, options, host).resolvedModule;
  const baseFileExists = host.fileExists.bind(host);
  const baseReadFile = host.readFile.bind(host);
  const baseGetSourceFile = host.getSourceFile.bind(host);
  const keep = (name) =>
    name === "react" ||
    name === "react-dom" ||
    name.startsWith("react/") ||
    name.startsWith("react-dom/");
  const stubNames = new Map();
  const virtual = new Map();
  const virtualContents = new Map();
  const moduleKey = (name, containing) => {
    const resolved = ts.resolveModuleName(name, containing, options, host).resolvedModule;
    return resolved?.resolvedFileName ?? name;
  };
  const addName = (key, name) => {
    if (!stubNames.has(key)) stubNames.set(key, new Set());
    if (name) stubNames.get(key).add(name);
  };
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const source = ts.createSourceFile(
      file,
      text,
      options.target ?? ts.ScriptTarget.Latest,
      true,
      file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node) => {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const name = node.moduleSpecifier.text;
        const key = moduleKey(name, file);
        const clause = node.importClause;
        if (clause?.name) addName(key, "default");
        if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
          const namespace = clause.namedBindings.name.text;
          for (const match of text.matchAll(new RegExp(`\\b${namespace}\\.([A-Za-z_]\\w*)`, "g")))
            addName(key, match[1]);
        } else if (clause?.namedBindings) {
          for (const element of clause.namedBindings.elements) addName(key, element.name.text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const stubPath = (key) => {
    if (virtual.has(key)) return virtual.get(key);
    const hash = crypto.createHash("sha1").update(key).digest("hex");
    const file = path.join(workspace, ".component-catalog-stubs", `${hash}.d.ts`);
    const names = [...(stubNames.get(key) ?? [])].filter((name) => name !== "default");
    const content = [
      ...names.map((name) => `export const ${name}: any;`),
      ...names.map((name) => `export type ${name} = any;`),
      "declare const _default: any;",
      "export default _default;",
    ].join("\n");
    virtual.set(key, file);
    virtualContents.set(file, content);
    return file;
  };
  host.resolveModuleNames = (names, containing) => names.map((name) => {
    const resolved = resolveModule(name, containing);
    if (keep(name)) return resolved;
    if (!resolved) return undefined;
    if (config.componentRoots.some((root) => inside(root.path, resolved.resolvedFileName))) return resolved;
    return {
      resolvedFileName: stubPath(resolved.resolvedFileName),
      extension: ts.Extension.Dts,
      isExternalLibraryImport: false,
    };
  });
  host.fileExists = (file) => virtual.has(file) || baseFileExists(file);
  host.readFile = (file) => virtualContents.get(file) ?? baseReadFile(file);
  host.getSourceFile = (file, languageVersion, onError) => {
    const content = virtualContents.get(file);
    if (content !== undefined)
      return ts.createSourceFile(file, content, languageVersion, true, ts.ScriptKind.TS);
    return baseGetSourceFile(file, languageVersion, onError);
  };
  return host;
}

export function createProject(config) {
  const workspace = config.projectRoot;
  const diagnosticHost = {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => workspace,
    getNewLine: () => "\n",
  };
  const configInputs = new Set();
  const parsed = ts.getParsedCommandLineOfConfigFile(
    config.tsconfig,
    {},
    {
      ...ts.sys,
      getCurrentDirectory: () => workspace,
      readFile(file) {
        if (inside(workspace, file) && file.endsWith(".json")) configInputs.add(file);
        return ts.sys.readFile(file);
      },
      onUnRecoverableConfigFileDiagnostic(error) {
        throw new Error(ts.formatDiagnostic(error, diagnosticHost));
      },
    },
  );
  // A configured empty source tree is legitimate in v2; malformed configs are not.
  const configErrors = parsed.errors.filter(
    (error) => !(config.configVersion === 2 && [18002, 18003].includes(error.code)),
  );
  if (configErrors.length) throw new Error(ts.formatDiagnostics(configErrors, diagnosticHost));
  if (parsed.projectReferences?.length && !parsed.fileNames.length)
    throw new Error(
      `Solution-style compiler config ${path.relative(workspace, config.tsconfig)} contains references but no source files. Set the catalog's tsconfig to the owning application config (referenced: ${parsed.projectReferences.map((ref) => path.relative(workspace, ref.path)).join(", ")}); references do not inherit compiler options or aliases.`,
    );
  const discovered = filesBelow(config.sourceRoot, config, isSourceFile);
  const allowJs = parsed.options.allowJs ?? parsed.options.checkJs ?? false;
  const disabled = !allowJs && discovered.find((file) =>
    isJavaScript(file) && config.componentRoots.some((root) => inside(root.path, file)));
  if (disabled)
    throw new Error(
      `${path.relative(workspace, disabled)}: JavaScript component sources require allowJs. Point tsconfig at the project's jsconfig.json or a catalog-specific config with allowJs: true; preserve the application's compiler policy.`,
    );
  const files = discovered.filter((file) => allowJs || !isJavaScript(file));
  // This tool never emits compiler output, including when the consumer config normally does.
  parsed.options = { ...parsed.options, noEmit: true };
  const host = config.typeScope === "componentRoots" ? createScopedTypeHost(workspace, parsed.options, config, files) : undefined;
  const program = ts.createProgram([...new Set([...parsed.fileNames, ...files])], parsed.options, host);
  const checker = program.getTypeChecker();
  const sources = files.map((file) => program.getSourceFile(file));
  if (sources.some((source) => !source))
    throw new Error("TypeScript could not load every configured source file");
  const rootFor = (file) => config.componentRoots.find((root) => inside(root.path, file));
  const relative = (file) => path.relative(workspace, file).split(path.sep).join("/");
  return { program, checker, sources, parsed, configInputs, diagnosticHost, rootFor, relative, host };
}
