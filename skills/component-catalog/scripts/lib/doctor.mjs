import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, template, validateGenerationPaths } from "./config.mjs";
import { loadCatalog } from "./catalog.mjs";

const manifest = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const catalogSchema = JSON.parse(
  fs.readFileSync(new URL("../schema/catalog.schema.json", import.meta.url), "utf8"),
);
function readSkillRevision() {
  try {
    const source = fs.readFileSync(new URL("../../SKILL.md", import.meta.url), "utf8");
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)?.[1];
    const revision = /^  revision: "([1-9][0-9]{0,5})"\r?$/m.exec(frontmatter ?? "")?.[1];
    return revision ? Number(revision) : null;
  } catch {
    return null;
  }
}
const skillDirectory = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Content digest of every bundled instruction file: SKILL.md plus each Markdown
 * file under references/, keyed by its skill-relative path.
 *
 * A revision number is a name, not an identity. Two checkouts can ship the same
 * revision with different prose — a local fork that splits a section into a new
 * reference file keeps the number while changing the instructions — and the
 * numeric comparison cannot tell them apart. This digest can.
 */
function readSkillContent() {
  const files = [];
  const walk = (directory) => {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const target = path.join(directory, entry.name);
      // Installed dependencies never contain model-facing instructions.
      if (entry.isDirectory() && entry.name !== "node_modules") walk(target);
      else if (entry.name.endsWith(".md")) files.push(target);
    }
  };
  walk(skillDirectory);
  const digest = createHash("sha256");
  let counted = 0;
  for (const file of files) {
    const relative = path.relative(skillDirectory, file).split(path.sep).join("/");
    // Skip the tool checkout's own notes; they are not model-facing instructions.
    if (relative.startsWith("..") || relative === "README.md") continue;
    digest.update(relative + "\0" + fs.readFileSync(file) + "\n");
    counted += 1;
  }
  return counted ? "sha256:" + digest.digest("hex").slice(0, 16) : null;
}

export const versionInfo = {
  name: manifest.name,
  version: manifest.version,
  skillRevision: readSkillRevision(),
  skillContent: readSkillContent(),
  configSchemaVersion: template.configVersion,
  catalogSchemaVersion: catalogSchema.properties.schemaVersion.const,
};

// Explicit, read-only readiness diagnosis. Never installs dependencies, runs
// consumer scripts, generates a catalog, or claims catalog freshness.
export async function doctor({
  configPath,
  installation = false,
  expectVersion,
  expectSkillRevision,
  expectSkillContent,
} = {}) {
  const checks = [];
  const add = (id, status, message) => checks.push({ id, status, message });
  const runtime = {
    ...versionInfo,
    node: process.versions.node,
    requiredNode: manifest.engines.node,
    expectedVersion: expectVersion ?? null,
    expectedSkillRevision: expectSkillRevision ?? null,
    expectedSkillContent: expectSkillContent ?? null,
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
  // Revision numbers collide across forks; only the content digest proves the
  // installed instructions are the intended ones.
  add(
    "skill-content",
    expectSkillContent === undefined || expectSkillContent === versionInfo.skillContent
      ? "pass"
      : "fail",
    expectSkillContent && expectSkillContent !== versionInfo.skillContent
      ? `Bundled instructions differ from the pinned content (${versionInfo.skillContent}). A matching revision number does not prove matching instructions; replace the complete skill from the intended source.`
      : "Content digest of the bundled SKILL.md and references; pass --expect-skill-content to pin it.",
  );
  let ts;
  add(
    "skill-revision",
    versionInfo.skillRevision !== null &&
      (expectSkillRevision === undefined || expectSkillRevision === versionInfo.skillRevision)
      ? "pass"
      : "fail",
    "Checks the SKILL.md bundled with this executable, not other installed copies. Missing/older instructions require replacing the complete skill from the intended pinned source; do not change revision numbers to bypass this check.",
  );
  try {
    ts = (await import("typescript")).default;
    runtime.typescript = ts.version;
    add(
      "typescript",
      ts.version === manifest.dependencies.typescript ? "pass" : "fail",
      "The CLI dependency must match its package manifest. Run npm ci --ignore-scripts in the installed skill's scripts directory (or npm ci in the tool checkout).",
    );
  } catch {
    add(
      "typescript",
      "fail",
      "Cannot load the CLI TypeScript dependency. Run npm ci --ignore-scripts in the installed skill's scripts directory, or restore the tool checkout/pinned local package.",
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
          const { unresolvedImports } = await import("./dependencies.mjs");
          const { program, checker, sources } = createProject(config);
          const dependencies = new Set([2307, 2688, 2792, 7016, 6053, 5083]);
          const diagnostics = [
            ...program.getOptionsDiagnostics(),
            ...program.getGlobalDiagnostics(),
            ...program.getSemanticDiagnostics().filter((item) => dependencies.has(item.code)),
          ];
          const unresolved = unresolvedImports(sources, checker, program.getCompilerOptions());
          const missing = unresolved[0];
          add(
            "project-dependencies",
            diagnostics.length || unresolved.length ? "fail" : "pass",
            missing
              ? `Cannot resolve static import ${missing.module} at ${missing.sourcePath}:${missing.line}. Restore dependencies or correct the compiler config; doctor makes no changes.`
              : diagnostics.length
              ? `${diagnostics.length} dependency/config diagnostic(s). First: ${ts.flattenDiagnosticMessageText(diagnostics[0].messageText, " ")}. Restore consumer dependencies or fix its tsconfig/imports; doctor makes no changes.`
              : "Compiler-reported dependencies and static ESM/import() module references resolve. This is not a full typecheck or a check of computed/CommonJS imports.",
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
