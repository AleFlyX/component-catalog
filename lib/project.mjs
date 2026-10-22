import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { inside } from "./config.mjs";

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
  const files = filesBelow(
    config.sourceRoot,
    config,
    (file) => /\.tsx?$/.test(file) && !file.endsWith(".d.ts"),
  );
  const program = ts.createProgram([...new Set([...parsed.fileNames, ...files])], parsed.options);
  const checker = program.getTypeChecker();
  const sources = files.map((file) => program.getSourceFile(file));
  if (sources.some((source) => !source))
    throw new Error("TypeScript could not load every configured source file");
  const rootFor = (file) => config.componentRoots.find((root) => inside(root.path, file));
  const relative = (file) => path.relative(workspace, file).split(path.sep).join("/");
  return { program, checker, sources, parsed, configInputs, diagnosticHost, rootFor, relative };
}
