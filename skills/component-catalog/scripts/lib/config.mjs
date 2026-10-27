import fs from "node:fs";
import path from "node:path";

export const template = {
  configVersion: 2,
  projectRoot: ".",
  sourceRoot: "src",
  tsconfig: "tsconfig.json",
  catalog: "component-catalog.json",
  importPathStyle: "direct",
  typeScope: "project",
  typeCheck: "partial",
  componentRoots: [
    {
      path: "src/components",
      idPrefix: "ui",
      importPrefix: null,
      layer: "shared",
      enrollment: "review",
    },
  ],
  exclude: [],
  previewRoots: [],
  testRoots: [],
  vocabulary: { 按钮: { primary: "button", related: [] } },
};

export const inside = (root, file) => file === root || file.startsWith(root + path.sep);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function keys(value, allowed, label) {
  if (!object(value) || Object.keys(value).some((key) => !allowed.includes(key)))
    throw new Error(`Invalid ${label}; unknown fields are not accepted`);
}
function nonempty(value, label) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0"))
    throw new Error(`Invalid ${label}`);
  return value;
}

export function loadConfig(argument, cwd = process.cwd()) {
  let configPath;
  if (argument !== undefined) configPath = path.resolve(cwd, nonempty(argument, "--config"));
  else {
    let directory = cwd;
    while (true) {
      const candidate = path.join(directory, "component-catalog.config.json");
      if (fs.existsSync(candidate)) {
        configPath = candidate;
        break;
      }
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  if (!configPath)
    throw new Error(
      "Config missing; first scan <frontend-directory> to review candidates. Use init for a JSON template (stdout only), save adapted configuration, then --config <path>",
    );
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    throw new Error(`Cannot read config JSON at ${configPath}; check the path and JSON syntax`);
  }
  keys(raw, Object.keys(template), "config");
  if (![1, 2].includes(raw.configVersion))
    throw new Error("Unsupported configVersion; expected 1 or 2");
  const projectRoot = path.resolve(
    path.dirname(configPath),
    nonempty(raw.projectRoot, "projectRoot"),
  );
  const resolve = (value, label) => {
    nonempty(value, label);
    if (path.isAbsolute(value)) throw new Error(`${label} must be project-relative`);
    const result = path.resolve(projectRoot, value);
    if (!inside(projectRoot, result)) throw new Error(`${label} escapes projectRoot`);
    return result;
  };
  const sourceRoot = resolve(raw.sourceRoot, "sourceRoot");
  const tsconfig = resolve(raw.tsconfig, "tsconfig");
  const catalog = resolve(raw.catalog, "catalog");
  if (!catalog.endsWith(".json") || catalog === configPath || catalog === tsconfig)
    throw new Error("catalog must be a separate .json output");
  const importPathStyle = raw.importPathStyle ?? "direct";
  if (!["direct", "barrel"].includes(importPathStyle))
    throw new Error("importPathStyle must be direct or barrel");
  const typeScope = raw.typeScope ?? "project";
  if (!["project", "componentRoots"].includes(typeScope))
    throw new Error("typeScope must be project or componentRoots");
  const typeCheck = raw.typeCheck ?? "partial";
  if (!["partial", "strict"].includes(typeCheck))
    throw new Error("typeCheck must be partial or strict");
  if (!Array.isArray(raw.componentRoots) || !raw.componentRoots.length)
    throw new Error("componentRoots must be nonempty");
  const componentRoots = raw.componentRoots.map((root) => {
    keys(
      root,
      [
        "path",
        "idPrefix",
        "importPrefix",
        "importExtension",
        "layer",
        "reuse",
        ...(raw.configVersion === 2 ? ["enrollment"] : []),
      ],
      "componentRoot",
    );
    if (raw.configVersion === 2 && !["public", "review"].includes(root.enrollment))
      throw new Error(
        "Each v2 componentRoot needs enrollment: public or review; choose from project policy",
      );
    const resolved = resolve(root.path, "componentRoot.path");
    if (!inside(sourceRoot, resolved)) throw new Error("componentRoot must be inside sourceRoot");
    if (
      !/^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)*$/.test(
        nonempty(root.idPrefix, "idPrefix"),
      )
    )
      throw new Error("Invalid idPrefix");
    const importPrefix = root.importPrefix === null ? null : nonempty(root.importPrefix, "importPrefix");
    if (
      importPrefix !== null && (/\s|\\/.test(importPrefix) ||
      importPrefix.endsWith("/") ||
      importPrefix.startsWith(".") ||
      importPrefix.startsWith("/"))
    )
      throw new Error(
        "importPrefix must be a real module alias/package subpath without trailing slash, or null for caller-relative imports",
      );
    if (root.importExtension !== undefined && !["omit", "js", "preserve"].includes(root.importExtension))
      throw new Error("importExtension must be omit, js or preserve");
    nonempty(root.layer, "layer");
    if (root.reuse !== undefined) {
      keys(root.reuse, ["scope", "owner"], "componentRoot.reuse");
      if (!["project", "module", "unspecified"].includes(root.reuse.scope))
        throw new Error("reuse.scope must be project, module or unspecified");
      if (
        root.reuse.owner !== undefined &&
        (typeof root.reuse.owner !== "string" ||
          !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(root.reuse.owner))
      )
        throw new Error("reuse.owner must be a lowercase module identifier");
      if (root.reuse.scope === "module" && !root.reuse.owner)
        throw new Error("module reuse scope requires an owner");
    }
    return { ...root, path: resolved };
  });
  for (let i = 0; i < componentRoots.length; i++) {
    for (const other of componentRoots.slice(i + 1)) {
      const root = componentRoots[i];
      if (
        inside(root.path, other.path) ||
        inside(other.path, root.path) ||
        root.idPrefix === other.idPrefix
      )
        throw new Error("componentRoots must be disjoint with distinct idPrefix values");
    }
  }
  const lists = {};
  for (const key of ["exclude", "previewRoots", "testRoots"]) {
    const values = raw[key] === undefined ? [] : raw[key];
    if (!Array.isArray(values)) throw new Error(`${key} must be an array`);
    lists[key] = values.map((value) => resolve(value, key));
    if (lists[key].some((file) => !inside(sourceRoot, file)))
      throw new Error(`${key} must be inside sourceRoot`);
  }
  if (componentRoots.some((root) => lists.exclude.some((excluded) => inside(excluded, root.path))))
    throw new Error("exclude cannot hide a componentRoot");
  if (
    lists.previewRoots.some((preview) =>
      lists.testRoots.some((test) => inside(test, preview) || inside(preview, test)),
    )
  )
    throw new Error("previewRoots and testRoots must not overlap");
  const vocabulary = raw.vocabulary === undefined ? {} : raw.vocabulary;
  if (!object(vocabulary)) throw new Error("vocabulary must be an object");
  for (const [term, concept] of Object.entries(vocabulary)) {
    nonempty(term, "vocabulary term");
    keys(concept, ["primary", "related"], "vocabulary concept");
    if (
      typeof concept.primary !== "string" ||
      !/^[a-z][a-z0-9-]*$/.test(concept.primary) ||
      !Array.isArray(concept.related) ||
      concept.related.some((tag) => typeof tag !== "string" || !/^[a-z][a-z0-9-]*$/.test(tag))
    )
      throw new Error("Vocabulary values require primary and related task tags");
  }
  return {
    configVersion: raw.configVersion,
    configPath,
    projectRoot,
    sourceRoot,
    tsconfig,
    catalog,
    importPathStyle,
    typeScope,
    typeCheck,
    componentRoots,
    ...lists,
    vocabulary,
  };
}

// Resolve existing ancestors too: generation must not follow an output symlink outside the project.
export function validateGenerationPaths(config) {
  const realRoot = fs.realpathSync(config.projectRoot);
  for (const file of [
    config.sourceRoot,
    config.tsconfig,
    config.catalog,
    ...config.componentRoots.map((root) => root.path),
  ]) {
    let ancestor = file;
    while (!fs.existsSync(ancestor)) {
      if (fs.lstatSync(ancestor, { throwIfNoEntry: false })?.isSymbolicLink())
        throw new Error("Broken path symlink");
      ancestor = path.dirname(ancestor);
    }
    if (!inside(realRoot, fs.realpathSync(ancestor)))
      throw new Error("Generation path symlink escapes projectRoot");
  }
  if (!fs.statSync(config.sourceRoot).isDirectory() || !fs.statSync(config.tsconfig).isFile())
    throw new Error("sourceRoot and tsconfig must exist");
  if (fs.existsSync(config.catalog)) {
    const resolved = fs.realpathSync(config.catalog);
    if ([config.configPath, config.tsconfig].some((file) => fs.realpathSync(file) === resolved))
      throw new Error("catalog cannot overwrite a configuration file");
  }
}
