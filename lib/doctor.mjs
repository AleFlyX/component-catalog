import fs from "node:fs";
import { loadConfig, validateGenerationPaths } from "./config.mjs";
import { loadCatalog } from "./catalog.mjs";

const manifest = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
export const versionInfo = { name: manifest.name, version: manifest.version };

// Explicit, read-only readiness diagnosis. Never installs dependencies, runs
// consumer scripts, generates a catalog, or claims catalog freshness.
export async function doctor({ configPath, installation = false, expectVersion } = {}) {
  const checks = [];
  const add = (id, status, message) => checks.push({ id, status, message });
  const runtime = {
    ...versionInfo,
    node: process.versions.node,
    requiredNode: manifest.engines.node,
    expectedVersion: expectVersion ?? null,
    typescript: null,
    expectedTypescript: manifest.dependencies.typescript,
  };
  add(
    "node",
    Number(process.versions.node.split(".")[0]) >= 22 ? "pass" : "fail",
    `Use Node ${manifest.engines.node}.`,
  );
  add(
    "cli-version",
    !expectVersion || expectVersion === manifest.version ? "pass" : "fail",
    expectVersion && expectVersion !== manifest.version
      ? "CLI and skill versions differ. Install the CLI and copy the skill from the same pinned checkout/package."
      : "Running CLI version matches the requested version, if supplied.",
  );
  let ts;
  try {
    ts = (await import("typescript")).default;
    runtime.typescript = ts.version;
    add(
      "typescript",
      ts.version === manifest.dependencies.typescript ? "pass" : "fail",
      "The CLI dependency must match its package manifest. Restore this tool installation using its lockfile (npm ci in the tool checkout).",
    );
  } catch {
    add(
      "typescript",
      "fail",
      "Cannot load the CLI TypeScript dependency. Run npm ci in the tool checkout or reinstall the pinned local package.",
    );
  }

  let config;
  if (!installation) {
    try {
      config = loadConfig(configPath);
      add("config", "pass", "Configuration parsed; paths resolve relative to its project root.");
    } catch (error) {
      add("config", "fail", error.message);
    }
    if (config) {
      add(
        "enrollment-policy",
        config.configVersion === 2 ? "pass" : "fail",
        config.configVersion === 2
          ? "Explicit per-root enrollment policies are configured."
          : "Queries and generation remain available, but lifecycle audit/check require configVersion 2 and explicit public/review policies.",
      );
      let pathsReady = false;
      try {
        validateGenerationPaths(config);
        for (const root of config.componentRoots)
          if (!fs.statSync(root.path).isDirectory())
            throw new Error(`Not a component directory: ${root.path}`);
        pathsReady = true;
        add(
          "paths",
          "pass",
          "Source, tsconfig and component roots exist; generation paths stay within the project.",
        );
      } catch (error) {
        add("paths", "fail", error.message);
      }
      if (pathsReady && ts) {
        try {
          const { createProject } = await import("./project.mjs");
          const { program } = createProject(config);
          const dependencies = new Set([2307, 2688, 2792, 7016, 6053, 5083]);
          const diagnostics = [
            ...program.getOptionsDiagnostics(),
            ...program.getGlobalDiagnostics(),
            ...program.getSemanticDiagnostics().filter((item) => dependencies.has(item.code)),
          ];
          add(
            "project-dependencies",
            diagnostics.length ? "fail" : "pass",
            diagnostics.length
              ? `${diagnostics.length} dependency/config diagnostic(s). First: ${ts.flattenDiagnosticMessageText(diagnostics[0].messageText, " ")}. Restore consumer dependencies or fix its tsconfig/imports; doctor makes no changes.`
              : "Project compiler options and statically referenced module/type dependencies resolve. This is not a full typecheck.",
          );
        } catch (error) {
          add("project-dependencies", "fail", error.message);
        }
      } else add("project-dependencies", "not_run", "Resolve failed path/TypeScript checks first.");
      if (fs.existsSync(config.catalog)) {
        try {
          const catalog = loadCatalog(config.catalog);
          add(
            "catalog",
            "pass",
            `Readable schemaVersion ${catalog.schemaVersion} snapshot. Freshness is NOT checked; run check after setup.`,
          );
        } catch (error) {
          add("catalog", "fail", error.message);
        }
      } else
        add(
          "catalog",
          "not_run",
          "No snapshot yet. Complete enrollment, then generate and check with this config.",
        );
    }
  }
  const response = {
    doctorVersion: 1,
    command: "doctor",
    scope: installation ? "installation" : "project",
    status: checks.some((item) => item.status === "fail") ? "fail" : "pass",
    runtime,
    config: config ? { path: config.configPath, version: config.configVersion } : null,
    checks,
    coverage:
      "Installation/config/dependency readiness only. Does not verify enrollment, freshness, runtime behavior or routine-check integration.",
    truncated: false,
    omitted: { fields: [] },
  };
  const size = () => Buffer.byteLength(JSON.stringify(response) + "\n");
  // Preserve every check identity/status even if diagnostics contain huge paths.
  for (const item of [...checks].sort((a, b) => b.message.length - a.message.length)) {
    if (size() <= 8192) break;
    const index = checks.indexOf(item);
    delete item.message;
    response.omitted.fields.push(`checks[${index}].message`);
    response.truncated = true;
  }
  if (size() > 8192 && response.config) {
    delete response.config.path;
    response.omitted.fields.push("config.path");
    response.truncated = true;
  }
  if (size() > 8192) throw new Error("Doctor identity exceeds output limit");
  return response;
}
