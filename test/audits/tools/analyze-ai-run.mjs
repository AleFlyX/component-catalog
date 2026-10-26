#!/usr/bin/env node
// Local, read-only AI-run analysis: combines DSH's session projection cache with
// the component-catalog JSONL usage log. No network access, no project writes.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const readJSON = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const readJSONL = (file) =>
  fs.existsSync(file)
    ? fs
        .readFileSync(file, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line, index) => {
          try {
            return JSON.parse(line);
          } catch {
            return { parseError: true, line: index + 1 };
          }
        })
    : [];
const num = (value) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

export function analyzeSession(session, log = []) {
  const rows = session?.record?.rows ?? {};
  const totals = rows.tokenUsage?.val?.totals ?? null;
  const stats = rows.sessionStats?.val ?? null;
  const timing = rows.subagentTiming?.val ?? null;
  const breakdown = rows.contextBreakdown?.val?.breakdown ?? null;
  const timeline = rows.contextTimeline?.val?.surface ?? [];
  const activity = rows.contextActivity?.val?.days ?? {};

  const activityTotals = Object.values(activity).reduce(
    (acc, day) => ({
      tokens: acc.tokens + num(day.tokens),
      requests: acc.requests + num(day.requests),
      toolCalls: acc.toolCalls + num(day.toolCalls),
      wallMs: acc.wallMs + num(day.wallMs),
      toolsMs: acc.toolsMs + num(day.toolsMs),
    }),
    { tokens: 0, requests: 0, toolCalls: 0, wallMs: 0, toolsMs: 0 },
  );

  const toolTokens = {};
  let toolResultTokens = 0;
  let assistantTokens = 0;
  let assistantSteps = 0;
  let toolCallsFromTimeline = 0;
  let observedToolCalls = activityTotals.toolCalls;
  const toolCallsByName = {};
  const topResults = [];
  const timelineRows = timeline.map((entry, index) => {
    const tool = entry?.tool ?? null;
    const calls = Array.isArray(entry?.calls) ? entry.calls : [];
    if (entry?.cat === "tool") {
      toolResultTokens += num(entry.tokens);
      if (tool) toolTokens[tool] = (toolTokens[tool] ?? 0) + num(entry.tokens);
      topResults.push({ index, tool, tokens: num(entry.tokens) });
    } else if (entry?.cat === "assistant") {
      assistantTokens += num(entry.tokens);
      assistantSteps += 1;
      toolCallsFromTimeline += calls.length;
      observedToolCalls = Math.max(observedToolCalls, toolCallsFromTimeline);
      for (const call of calls) {
        const name = typeof call === "string" ? call : (call?.name ?? "unknown");
        toolCallsByName[name] = (toolCallsByName[name] ?? 0) + 1;
      }
    }
    return {
      index,
      seq: entry?.seq ?? null,
      time: entry?.time ?? null,
      cat: entry?.cat ?? null,
      tool,
      calls,
      tokens: num(entry?.tokens),
      text: typeof entry?.text === "string" ? entry.text.slice(0, 160) : null,
    };
  });
  topResults.sort((a, b) => b.tokens - a.tokens);

  const byCommand = {};
  const repeatedArguments = {};
  const repeatedComponents = {};
  const tasks = {};
  let logOutputBytes = 0;
  let searchTruncated = 0;
  let searchDetails = 0;
  let searchBrief = 0;
  let searchOmittedByLimit = 0;
  let searchOmittedByBytes = 0;
  let searchResultIds = 0;
  let getBatchCalls = 0;
  const uniqueGetIds = new Set();
  for (const entry of log) {
    if (entry.parseError) continue;
    const command = entry.command ?? "unknown";
    const bucket = (byCommand[command] ??= {
      calls: 0,
      outputBytes: 0,
      truncated: 0,
      errors: 0,
      props: 0,
    });
    bucket.calls += 1;
    bucket.outputBytes += num(entry.outputBytes);
    logOutputBytes += num(entry.outputBytes);
    if (entry.truncated) bucket.truncated += 1;
    if (entry.error) bucket.errors += 1;
    if (typeof entry.options?.include === "string" && entry.options.include.includes("props"))
      bucket.props += 1;
    const arg = typeof entry.argument === "string" ? entry.argument : null;
    if (arg) repeatedArguments[arg] = (repeatedArguments[arg] ?? 0) + 1;
    for (const id of entry.componentIds ?? []) {
      if (typeof id === "string") repeatedComponents[id] = (repeatedComponents[id] ?? 0) + 1;
    }
    if (entry.task !== null && entry.task !== undefined) {
      const task = String(entry.task).slice(0, 40);
      const t = (tasks[task] ??= { calls: 0, outputBytes: 0 });
      t.calls += 1;
      t.outputBytes += num(entry.outputBytes);
    }
    if (command === "search") {
      if (entry.truncated) searchTruncated += 1;
      if (entry.options?.details) searchDetails += 1;
      if (entry.options?.brief) searchBrief += 1;
      searchOmittedByLimit += num(entry.omitted?.byLimit);
      searchOmittedByBytes += num(entry.omitted?.byBytes);
      searchResultIds += Array.isArray(entry.resultIds) ? entry.resultIds.length : 0;
    }
    if (command === "get") {
      const ids = Array.isArray(entry.componentIds) ? entry.componentIds : [];
      if (ids.length > 1) getBatchCalls += 1;
      for (const id of ids) uniqueGetIds.add(String(id));
    }
  }

  const usage = totals
    ? {
        uncachedInputTokens: totals.uncachedInputTokens,
        outputTokens: totals.outputTokens,
        cacheReadTokens: totals.cacheReadTokens,
        cacheWriteTokens: totals.cacheWriteTokens,
        totalTokens:
          num(totals.uncachedInputTokens) +
          num(totals.cacheReadTokens) +
          num(totals.outputTokens),
        cacheReadShare:
          totals.uncachedInputTokens + totals.cacheReadTokens
            ? Math.round(
                (totals.cacheReadTokens /
                  (totals.uncachedInputTokens + totals.cacheReadTokens)) *
                  100,
              )
            : 0,
      }
    : null;

  return {
    usage,
    breakdown,
    session: {
      steps: stats?.steps ?? null,
      turns: stats?.turns ?? null,
      llmMs: stats?.llmMs ?? null,
      toolMs: stats?.toolMs ?? null,
      settledMs: timing?.settledMs ?? null,
      wallMs: activityTotals.wallMs || null,
      requests: activityTotals.requests || null,
      activityToolCalls: activityTotals.toolCalls || null,
    },
    timeline: {
      entries: timelineRows,
      assistantSteps,
      assistantTokens,
      toolCalls: toolCallsFromTimeline,
      toolCallsByName,
      toolResultTokens,
      toolTokens,
      topResults: topResults.slice(0, 5),
    },
    cli: {
      calls: log.length,
      outputBytes: logOutputBytes,
      byCommand,
      searchCalls: byCommand.search?.calls ?? 0,
      searchDetails,
      searchBrief,
      searchTruncated,
      searchOmittedByLimit,
      searchOmittedByBytes,
      searchResultIds,
      getCalls: byCommand.get?.calls ?? 0,
      getBatchCalls,
      uniqueGetIds: uniqueGetIds.size,
      repeatedArguments: Object.entries(repeatedArguments).filter(([, count]) => count > 1),
      repeatedComponents: Object.entries(repeatedComponents).filter(([, count]) => count > 1),
      tasks,
      entries: log.map((entry) => ({
        ts: entry.ts ?? null,
        task: entry.task ?? null,
        command: entry.command ?? null,
        argument: entry.argument ?? null,
        options: entry.options ?? null,
        outputBytes: num(entry.outputBytes),
        truncated: entry.truncated ?? null,
        omitted: entry.omitted ?? null,
        error: entry.error ?? null,
        resultIds: entry.resultIds ?? null,
        componentIds: entry.componentIds ?? null,
      })),
    },
    derived: {
      cliBytesPerCall: log.length ? Math.round(logOutputBytes / log.length) : null,
      toolTokensPerAssistantStep: assistantSteps
        ? Math.round(toolResultTokens / assistantSteps)
        : null,
      cacheReadPerCall: log.length && usage ? Math.round(usage.cacheReadTokens / log.length) : null,
      observedToolCalls,
      nonCliToolCalls: Math.max(0, observedToolCalls - log.length),
      outputTokensPerCliCall: log.length && usage ? Math.round(usage.outputTokens / log.length) : null,
      cliSearchResultIdsPerSearch: byCommand.search?.calls
        ? Math.round((searchResultIds / byCommand.search.calls) * 10) / 10
        : null,
    },
  };
}

export function renderMarkdown(analysis, label = "run") {
  const lines = [];
  const u = analysis.usage;
  lines.push(`# AI run analysis: ${label}`, "");
  if (u)
    lines.push(
      `- tokens: ${u.totalTokens} (uncached ${u.uncachedInputTokens}, cache read ${u.cacheReadTokens} [${u.cacheReadShare}%], output ${u.outputTokens})`,
    );
  else lines.push("- tokens: unavailable");
  lines.push(
    `- steps: ${analysis.session.steps ?? "?"}, tool calls: ${analysis.timeline.toolCalls}, wall: ${analysis.session.wallMs ?? "?"} ms`,
  );
  if (analysis.breakdown)
    lines.push(
      `- breakdown: system ${analysis.breakdown.systemTokens}, tools ${analysis.breakdown.toolsTokens}, messages ${analysis.breakdown.messageTokens}`,
    );
  lines.push("", "## Tool results", "", "| tool | result tokens |", "| --- | --- |");
  for (const [tool, tokens] of Object.entries(analysis.timeline.toolTokens).sort(
    (a, b) => b[1] - a[1],
  ))
    lines.push(`| ${tool} | ${tokens} |`);
  lines.push("", "## Most expensive tool results", "");
  for (const item of analysis.timeline.topResults)
    lines.push(`- #${item.index} ${item.tool ?? "?"}: ${item.tokens} tokens`);
  lines.push(
    "",
    "## CLI vs non-CLI",
    "",
    `- CLI calls: ${analysis.cli.calls} (search ${analysis.cli.searchCalls}, details ${analysis.cli.searchDetails}, brief ${analysis.cli.searchBrief}, get ${analysis.cli.getCalls}, batch get ${analysis.cli.getBatchCalls})`,
    `- observed tool calls: ${analysis.derived.observedToolCalls}; non-CLI: ${analysis.derived.nonCliToolCalls}`,
    `- search truncated: ${analysis.cli.searchTruncated}; omitted by limit ${analysis.cli.searchOmittedByLimit}, by bytes ${analysis.cli.searchOmittedByBytes}`,
  );
  if (Object.keys(analysis.timeline.toolCallsByName).length)
    lines.push(
      `- tool calls by name: ${Object.entries(analysis.timeline.toolCallsByName)
        .map(([name, count]) => `${name}=${count}`)
        .join(", ")}`,
    );
  lines.push("", "## CLI calls", "");
  for (const [command, bucket] of Object.entries(analysis.cli.byCommand))
    lines.push(
      `- ${command}: ${bucket.calls} calls, ${bucket.outputBytes} B, ${bucket.truncated} truncated, ${bucket.errors} errors, ${bucket.props} include-props`,
    );
  if (analysis.cli.repeatedComponents.length)
    lines.push(
      "",
      "Repeated component IDs: " +
        analysis.cli.repeatedComponents.map(([id, count]) => `${id}×${count}`).join(", "),
    );
  if (Object.keys(analysis.cli.tasks).length)
    lines.push(
      "",
      "By task: " +
        Object.entries(analysis.cli.tasks)
          .map(([task, value]) => `${task}=${value.calls} calls/${value.outputBytes} B`)
          .join(", "),
    );
  lines.push("", "## Timeline");
  for (const entry of analysis.timeline.entries) {
    const calls = entry.calls.length ? ` calls=${entry.calls.join(",")}` : "";
    lines.push(
      `- #${entry.index} ${entry.cat}${entry.tool ? ` (${entry.tool})` : ""}: ${entry.tokens} tokens${calls}`,
    );
  }
  return lines.join("\n") + "\n";
}

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const sessionId = argument("--session");
    const logPath = argument("--log");
    if (!sessionId || !logPath) throw new Error("Usage: analyze-ai-run.mjs --session <id> --log <path> [--out <dir>] [--label <text>]");
    const store = process.env.DSH_SESSION_STORE ?? path.join(os.homedir(), ".dsh/storages/session_projcache/sessions");
    const cachePath = path.join(store, `${sessionId}.json`);
    if (!fs.existsSync(cachePath)) throw new Error(`Session cache not found: ${cachePath}`);
    const analysis = analyzeSession(readJSON(cachePath), readJSONL(logPath));
    const out = argument("--out", path.dirname(logPath));
    fs.mkdirSync(out, { recursive: true });
    const label = argument("--label", sessionId);
    fs.writeFileSync(path.join(out, "analysis.json"), JSON.stringify({ session: sessionId, label, ...analysis }, null, 2) + "\n");
    fs.writeFileSync(path.join(out, "analysis.md"), renderMarkdown(analysis, label));
    process.stdout.write(JSON.stringify({ out, session: sessionId, tokens: analysis.usage?.totalTokens ?? null, calls: analysis.cli.calls }) + "\n");
  } catch (error) {
    process.stderr.write(`analyze-ai-run: ${error.message}\n`);
    process.exitCode = 1;
  }
}
