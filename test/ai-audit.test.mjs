import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSession, renderMarkdown } from "./audits/tools/analyze-ai-run.mjs";

const cache = {
  record: {
    rows: {
      tokenUsage: {
        val: { totals: { uncachedInputTokens: 100, outputTokens: 50, cacheReadTokens: 900, cacheWriteTokens: 0 } },
      },
      sessionStats: { val: { steps: 3, turns: 1, llmMs: 10, toolMs: 5 } },
      subagentTiming: { val: { settledMs: 20 } },
      contextBreakdown: { val: { breakdown: { systemTokens: 10, toolsTokens: 20, messageTokens: 30 } } },
      contextTimeline: {
        val: {
          surface: [
            { seq: 1, cat: "assistant", tokens: 30, calls: ["bash", "bash"] },
            { seq: 2, cat: "tool", tool: "bash", tokens: 120 },
            { seq: 3, cat: "tool", tool: "send_message", tokens: 7 },
            { seq: 4, cat: "assistant", tokens: 20, calls: ["bash"] },
          ],
        },
      },
      contextActivity: { val: { days: { "2026-10-25": { tokens: 1050, requests: 3, toolCalls: 3, wallMs: 100, toolsMs: 20 } } } },
    },
  },
};
const log = [
  { ts: "t1", command: "search", argument: "button", outputBytes: 300, task: "1", resultIds: ["ui.Button"] },
  { ts: "t2", command: "get", argument: "ui.Button", outputBytes: 400, task: "1", componentIds: ["ui.Button"] },
  { ts: "t3", command: "get", argument: "ui.Button", outputBytes: 200, task: "2", componentIds: ["ui.Button", "ui.Input"] },
  { command: "search", outputBytes: 100, truncated: true, error: "x" },
];

test("analyzeSession combines token usage, timeline, and CLI logs", () => {
  const analysis = analyzeSession(cache, log);
  assert.equal(analysis.usage.totalTokens, 1050);
  assert.equal(analysis.usage.cacheReadShare, 90);
  assert.equal(analysis.timeline.assistantSteps, 2);
  assert.equal(analysis.timeline.toolCalls, 3);
  assert.equal(analysis.timeline.toolTokens.bash, 120);
  assert.equal(analysis.timeline.topResults[0].tokens, 120);
  assert.equal(analysis.cli.calls, 4);
  assert.equal(analysis.cli.byCommand.search.calls, 2);
  assert.equal(analysis.cli.byCommand.get.calls, 2);
  assert.equal(analysis.cli.byCommand.get.truncated, 0);
  assert.deepEqual(analysis.cli.repeatedComponents, [["ui.Button", 2]]);
  assert.equal(analysis.cli.tasks["1"].calls, 2);
  assert.equal(analysis.session.wallMs, 100);
  assert.match(renderMarkdown(analysis, "fixture"), /cache read 900/);
});

test("analyzeSession tolerates missing session fields", () => {
  const analysis = analyzeSession({ record: { rows: {} } }, []);
  assert.equal(analysis.usage, null);
  assert.deepEqual(analysis.timeline.entries, []);
  assert.equal(analysis.cli.calls, 0);
  assert.match(renderMarkdown(analysis), /tokens: unavailable/);
});
