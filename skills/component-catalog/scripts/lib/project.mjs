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
  const program = ts.createProgram([...new Set([...parsed.fileNames, ...files])], parsed.options);
  const checker = program.getTypeChecker();
  const sources = files.map((file) => program.getSourceFile(file));
  if (sources.some((source) => !source))
    throw new Error("TypeScript could not load every configured source file");
  const rootFor = (file) => config.componentRoots.find((root) => inside(root.path, file));
  const relative = (file) => path.relative(workspace, file).split(path.sep).join("/");
  return { program, checker, sources, parsed, configInputs, diagnosticHost, rootFor, relative };
}
