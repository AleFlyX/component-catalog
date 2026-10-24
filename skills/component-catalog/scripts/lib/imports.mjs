import path from "node:path";

export function importFile(file, extension = "omit") {
  if (extension === "preserve") return file;
  if (extension === "js") return file.replace(/\.[jt]sx?$/, ".js");
  if (extension === "jsx") return file.replace(/\.[jt]sx?$/, ".jsx");
  return file.replace(/\.[jt]sx?$/, "");
}

export function callerPath(input) {
  if (typeof input !== "string" || !input.trim() || input.length > 4096 || input.includes("\0"))
    throw new Error("--from requires a project-relative JS/JSX/TS/TSX caller file");
  const file = input.replaceAll("\\", "/");
  const normalized = path.posix.normalize(file);
  if (path.posix.isAbsolute(file) || /^[A-Za-z]:/.test(file) || normalized === ".." ||
      normalized.startsWith("../") || !/\.[jt]sx?$/.test(normalized) || normalized.endsWith(".d.ts"))
    throw new Error("--from must be a JS/JSX/TS/TSX file inside projectRoot, not an absolute or escaping path");
  return normalized;
}

export function relativeImport(sourcePath, from, extension) {
  const caller = callerPath(from);
  if (caller === sourcePath) throw new Error("--from cannot import a component from its own source file");
  const relative = path.posix.relative(path.posix.dirname(caller), sourcePath);
  const specifier = importFile(relative, extension);
  return { specifier: /^(\.\/|\.\.\/)/.test(specifier) ? specifier : `./${specifier}`, caller };
}
