#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadConfig, template, validateGenerationPaths } from "../lib/config.mjs";
import { loadCatalog } from "../lib/catalog.mjs";
import { search, get, getMany } from "../lib/query.mjs";

const usage = {
  doctor:
    "component-catalog [--config path] doctor [--installation] [--expect-version x.y.z] [--expect-skill-revision 1..999999]\nRead-only installation, bundled skill revision, version, config and dependency diagnosis. --installation skips project checks. Exit 1 for findings, 2 for invalid invocation. Does not audit enrollment or freshness.\n",
  audit:
    "component-catalog [--config path] audit [--limit 1..50] [--offset n]\nRead-only enrollment and metadata audit; requires explicit v2 policies. Exit 1 for findings, 2 if unable to check.\n",
  check:
    "component-catalog [--config path] check [--limit 1..50] [--offset n]\nAudit enrollment and verify generated catalog freshness without writing.\n",
  scan: "component-catalog scan <directory> [--summary | --query text | --brief] [--limit 1..50] [--offset n]\nRead-only JS/JSX/TS/TSX candidate inventory; no config or markers required. --summary groups by immediate child directory. --brief returns only name/path/line/marked/supportedShape so more items fit per bounded page. --query filters names, paths, JSDoc summaries and task tags (all whitespace-separated terms); no vocabulary expansion. Does not enroll components.\n",
  init: "component-catalog init\nPrints a JSON template only. Adapt paths and save it as component-catalog.config.json.\n",
  generate:
    "component-catalog [--config path] generate [--check]\nGenerate explicitly marked components; --check compares without writing. Unmarked candidates need annotation first.\n",
  search:
    "component-catalog [--config path] search <query> [--limit 1..10]\nRead the existing catalog; default limit 5. Try an export name, task tag or Prop name.\n",
  get: "component-catalog [--config path] get <id> [<id> ...] [--include props,members,constraints,examples,usage | --prop name] [--from project/relative/caller.tsx]\nUse exact IDs from search. Accepts 1–5 IDs; multiple IDs return components[] and never combine with --prop or --from. --prop is case-sensitive; namespaces use members. --from derives a relative import from the saved catalog without reading caller/source files.\n",
};
const help = `First use: scan a frontend directory, choose public components, configure, annotate, then generate.\nInstalling the skill alone does not configure or mark a project.\n\n${Object.values(usage).join("\n")}\nQueries never generate. Use <command> --help for command help, --version for CLI version JSON.\n`;
const shellQuote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
const taskLabel = (() => {
  const raw = process.env.COMPONENT_CATALOG_TASK;
  if (raw === undefined) return null;
  const value = raw.trim().slice(0, 40).replace(/[\u0000-\u001f\u007f]/g, "");
  return value || null;
})();
const startedAt = Date.now();
let activeCommand;
// Opt-in, local-only usage audit. Never changes command output; a failed log
// write is ignored so instrumentation cannot break the CLI.
function writeUsageLog(entry) {
  const target = process.env.COMPONENT_CATALOG_LOG;
  if (!target) return;
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.appendFileSync(target, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
  } catch {
    // Best effort only.
  }
}
let diagnosticCommand = false;
const cliOptions = {
  config: { type: "string" },
  limit: { type: "string" },
  offset: { type: "string" },
  summary: { type: "boolean" },
  brief: { type: "boolean" },
  query: { type: "string" },
  include: { type: "string" },
  prop: { type: "string" },
  from: { type: "string" },
  check: { type: "boolean" },
  help: { type: "boolean" },
  version: { type: "boolean" },
  installation: { type: "boolean" },
  "expect-version": { type: "string" },
  "expect-skill-revision": { type: "string" },
};
try {
  // Retain the diagnostic exit code even if parsing fails on a missing option
  // value. Skip known option values so a config path/query named check is not
  // mistaken for the command.
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      diagnosticCommand = ["audit", "check", "doctor"].includes(argv[i + 1]);
      break;
    }
    if (arg.startsWith("-")) {
      if (arg.startsWith("--") && !arg.includes("=") && cliOptions[arg.slice(2)]?.type === "string")
        i++;
      continue;
    }
    diagnosticCommand = ["audit", "check", "doctor"].includes(arg);
    break;
  }
  const { values, positionals, tokens } = parseArgs({
    allowPositionals: true,
    tokens: true,
    options: cliOptions,
  });
  const options = tokens.filter((token) => token.kind === "option").map((token) => token.name);
  if (new Set(options).size !== options.length) throw new Error("Options cannot be repeated");
  if (values.version && !positionals.length && options.length === 1) {
    const { versionInfo } = await import("../lib/doctor.mjs");
    process.stdout.write(JSON.stringify(versionInfo) + "\n");
  } else if (
    (!positionals.length && !options.length) ||
    (values.help &&
      !positionals.length &&
      options.every((name) => ["help", "config"].includes(name)))
  )
    process.stdout.write(help);
  else if (
    values.help &&
    positionals.length === 1 &&
    options.every((name) => ["help", "config"].includes(name)) &&
    Object.hasOwn(usage, positionals[0])
  )
    process.stdout.write(usage[positionals[0]]);
  else {
    const [command, ...inputs] = positionals;
    const input = inputs[0];
    activeCommand = command;
    const allowed = {
      init: [],
      scan: ["limit", "offset", "summary", "query", "brief"],
      generate: ["config", "check"],
      search: ["config", "limit"],
      get: ["config", "include", "prop", "from"],
      audit: ["config", "limit", "offset"],
      check: ["config", "limit", "offset"],
      doctor: ["config", "installation", "expect-version", "expect-skill-revision"],
    };
    diagnosticCommand = ["audit", "check", "doctor"].includes(command);
    if (!Object.hasOwn(allowed, command)) throw new Error("Unknown or missing command; use --help");
    const unexpected = options.find((option) => !allowed[command].includes(option));
    if (unexpected)
      throw new Error(
        `${command} does not accept --${unexpected}; use ${command} --help${command === "scan" && unexpected === "config" ? ". scan uses a directory argument; call the CLI without a script's fixed --config" : ""}`,
      );
    if (command === "get") {
      if (inputs.length < 1 || inputs.length > 5)
        throw new Error("get accepts 1–5 component IDs; use get --help");
    } else if (positionals.length !== (["scan", "search"].includes(command) ? 2 : 1))
      throw new Error(`Invalid arguments; use ${command} --help`);
    if (command === "scan" && !input.trim())
      throw new Error("scan requires a directory; use scan --help");
    if (command !== "scan" && inputs.some((value) => !value.trim() || value.length > 200))
      throw new Error("Query or ID must contain 1–200 characters");
    if (command === "get" && inputs.length > 1 && (values.prop !== undefined || values.from !== undefined))
      throw new Error("--prop and --from require a single component ID");
    if (values.installation && values.config !== undefined)
      throw new Error("--installation and --config cannot be combined");
    if (
      values["expect-version"] !== undefined &&
      (values["expect-version"].length > 64 ||
        !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(values["expect-version"]))
    )
      throw new Error("--expect-version requires an exact release version such as 0.3.0");
    const maxLimit = command === "scan" || diagnosticCommand ? 50 : 10;
    if (
      values.limit !== undefined &&
      (!/^[1-9][0-9]*$/.test(values.limit) || Number(values.limit) > maxLimit)
    )
      throw new Error(`--limit must be 1..${maxLimit}`);
    if (
      values.offset !== undefined &&
      (!/^(?:0|[1-9][0-9]*)$/.test(values.offset) || !Number.isSafeInteger(Number(values.offset)))
    )
      throw new Error("--offset must be a nonnegative safe integer");
    if (values.prop !== undefined && (!values.prop.trim() || values.prop.length > 200))
      throw new Error("Invalid --prop name");
    if (values.prop !== undefined && values.include !== undefined)
      throw new Error("--prop and --include cannot be combined");
    const include = values.include?.split(",");
    if (
      include &&
      (new Set(include).size !== include.length ||
        include.some(
          (field) => !["props", "members", "constraints", "examples", "usage"].includes(field),
        ))
    )
      throw new Error(
        "Invalid --include fields; choose unique fields: props,members,constraints,examples,usage",
      );
    let result;
    if (
      values["expect-skill-revision"] !== undefined &&
      !/^[1-9][0-9]{0,5}$/.test(values["expect-skill-revision"])
    )
      throw new Error("--expect-skill-revision must be 1..999999");
    if (command === "init") result = template;
    else if (command === "scan") {
      const { scan } = await import("../lib/scan.mjs");
      result = scan(input, {
        limit: Number(values.limit ?? 20),
        offset: Number(values.offset ?? 0),
        summary: values.summary ?? false,
        query: values.query,
        brief: values.brief ?? false,
      });
    } else if (command === "doctor") {
      const { doctor } = await import("../lib/doctor.mjs");
      result = await doctor({
        configPath: values.config,
        installation: values.installation ?? false,
        expectVersion: values["expect-version"],
        expectSkillRevision:
          values["expect-skill-revision"] === undefined
            ? undefined
            : Number(values["expect-skill-revision"]),
      });
      if (result.status === "fail") process.exitCode = 1;
    } else {
      const config = loadConfig(values.config);
      const regenerate = `component-catalog --config ${shellQuote(config.configPath)} generate`;
      if (["audit", "check"].includes(command)) {
        const { auditProject, auditResponse } = await import("../lib/audit.mjs");
        const report = auditProject(config, { freshness: command === "check" });
        result = auditResponse(report, {
          command,
          limit: Number(values.limit ?? 20),
          offset: Number(values.offset ?? 0),
        });
        if (report.issues.length) process.exitCode = 1;
      } else if (command === "generate") {
        validateGenerationPaths(config);
        const { generateCatalog } = await import("../lib/generate.mjs");
        let catalog;
        if (config.configVersion === 2) {
          const { auditProject } = await import("../lib/audit.mjs");
          const report = auditProject(config, { stored: false });
          if (report.issues.length)
            throw new Error(
              `Enrollment/metadata audit failed (${report.issues.length} issues). Run component-catalog --config ${shellQuote(config.configPath)} audit for bounded details. First issue: ${report.issues[0].message}`,
            );
          catalog = report.catalog;
        } else catalog = generateCatalog(config);
        const content = JSON.stringify(catalog, null, 2) + "\n";
        if (values.check) {
          if (!fs.existsSync(config.catalog) || fs.readFileSync(config.catalog, "utf8") !== content)
            throw new Error(`Catalog missing or stale at ${config.catalog}; run ${regenerate}`);
        } else {
          fs.mkdirSync(path.dirname(config.catalog), { recursive: true });
          fs.writeFileSync(config.catalog, content);
        }
        result = {
          command: values.check ? "check" : "generate",
          config: config.configPath,
          components: catalog.components.length,
          catalog: config.catalog,
          sourceDigest: catalog.sourceDigest,
        };
      } else {
        const catalog = loadCatalog(config.catalog, regenerate);
        if (command === "search")
          result = search(catalog, input.trim(), Number(values.limit ?? 5), config.vocabulary);
        else if (inputs.length === 1)
          result = get(catalog, input.trim(), include, values.prop, values.from);
        else result = getMany(catalog, inputs.map((value) => value.trim()), include);
      }
    }
    const output = JSON.stringify(result) + "\n";
    process.stdout.write(output);
    writeUsageLog({
      command,
      argument: typeof input === "string" ? input.slice(0, 200) : null,
      arguments: inputs.length ? inputs.map((value) => value.slice(0, 200)) : null,
      task: taskLabel,
      ...(command === "search" && Array.isArray(result?.items)
        ? { resultIds: result.items.map((item) => item.id).slice(0, 5) }
        : {}),
      ...(command === "get"
        ? { componentIds: inputs.map((value) => value.trim()) }
        : {}),
      config: values.config ?? null,
      options: {
        limit: values.limit ?? null,
        offset: values.offset ?? null,
        include: values.include ?? null,
        prop: values.prop ?? null,
        from: values.from ?? null,
        brief: values.brief ?? null,
      },
      outputBytes: Buffer.byteLength(output, "utf8"),
      durationMs: Date.now() - startedAt,
      status: typeof result?.status === "string" ? result.status : null,
      truncated: result?.truncated ?? null,
      omitted: result?.omitted ?? null,
    });
  }
} catch (error) {
  writeUsageLog({
    command: activeCommand ?? null,
    error: error.message,
    durationMs: Date.now() - startedAt,
  });
  process.stderr.write(`component-catalog: ${error.message}\n`);
  process.exitCode = diagnosticCommand ? 2 : 1;
}
