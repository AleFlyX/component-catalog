import fs from 'node:fs';
import path from 'node:path';

const DIR = '/tmp/audit-b2';
const EXPECTED = {
  1: ['ConfirmationDialog', 'DeleteDiscussion', 'ui.dialog.confirmation-dialog.ConfirmationDialog', 'discussions.DeleteDiscussion'],
  2: ['Input', 'ui.form.Input'],
  3: ['TablePagination', 'ui.table.TablePagination'],
  4: ['MDPreview', 'ui.md-preview.MDPreview'],
  5: ['CreateDiscussion', 'discussions.CreateDiscussion'],
};
const runs = [
  { condition: 'catalog', run: 1, session: '5bb1b695-d638-4778-a7a7-464fcf0e219c', file: 'catalog-1.json', log: 'usage/catalog-1.jsonl' },
  { condition: 'catalog', run: 2, session: 'd54e93db-794c-4042-b030-ed2efb06eff2', file: 'catalog-2.json', log: 'usage/catalog-2.jsonl' },
  { condition: 'catalog', run: 3, session: '1b3ed4f1-2181-4a30-b823-8013ded501d0', file: 'catalog-3.json', log: 'usage/catalog-3.jsonl' },
  { condition: 'source', run: 1, session: '7c83b76e-1d00-4f11-b91e-26a48db5ff75', file: 'source-1.json', log: null },
  { condition: 'source', run: 2, session: '82f7eccf-2536-4874-bb0c-4849b7a2a8f7', file: 'source-2.json', log: null },
  { condition: 'source', run: 3, session: 'f46a6cc6-5fc6-4e04-b8bd-251af820135a', file: 'source-3.json', log: null },
  { condition: 'source-pristine', run: 1, session: '34fcbe6f-0545-402c-b1d9-933a27545011', file: 'source-pristine-1.json', log: null },
  { condition: 'source-pristine', run: 2, session: '70721487-a697-42cb-a79a-b225ebd33430', file: 'source-pristine-2.json', log: null },
  { condition: 'source-pristine', run: 3, session: '442fa7ff-7f48-4211-92d2-6f2eca6d6947', file: 'source-pristine-3.json', log: null },
];

const usageOf = (session) => {
  const cache = `/home/ccb/.dsh/storages/session_projcache/sessions/${session}.json`;
  if (!fs.existsSync(cache)) return null;
  const j = JSON.parse(fs.readFileSync(cache, 'utf8'));
  const rows = j.record.rows;
  const t = rows.tokenUsage?.val?.totals;
  const stats = rows.sessionStats?.val;
  const timing = rows.subagentTiming?.val;
  if (!t) return null;
  return {
    uncachedInputTokens: t.uncachedInputTokens,
    outputTokens: t.outputTokens,
    cacheReadTokens: t.cacheReadTokens,
    totalInputTokens: t.uncachedInputTokens + t.cacheReadTokens,
    totalTokens: t.uncachedInputTokens + t.cacheReadTokens + t.outputTokens,
    steps: stats?.steps ?? null,
    llmMs: stats?.llmMs ?? null,
    settledMs: timing?.settledMs ?? null,
  };
};

const out = [];
for (const r of runs) {
  const file = path.join(DIR, r.file);
  if (!fs.existsSync(file)) {
    out.push({ ...r, missing: true });
    continue;
  }
  const answer = JSON.parse(fs.readFileSync(file, 'utf8'));
  const names = answer.tasks.map((t) => t.componentId ?? t.exportName ?? '');
  const correct = answer.tasks.filter((t, i) => EXPECTED[i + 1].includes(names[i])).length;
  let cli = null;
  if (r.log) {
    const p = path.join(DIR, r.log);
    const lines = fs.existsSync(p)
      ? fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
      : [];
    const ok = lines.filter((x) => !x.error);
    cli = {
      calls: lines.length,
      succeeded: ok.length,
      failed: lines.length - ok.length,
      outputBytes: ok.reduce((s, x) => s + (x.outputBytes ?? 0), 0),
      truncated: ok.filter((x) => x.truncated).length,
    };
  }
  out.push({
    ...r,
    answers: names,
    correct,
    total: answer.tasks.length,
    filesRead: answer.filesRead?.length ?? 0,
    sourceBytesRead: answer.totalBytesRead ?? 0,
    commands: answer.commands ?? null,
    cli,
    contentBytes: (answer.totalBytesRead ?? 0) + (cli?.outputBytes ?? 0),
    usage: usageOf(r.session),
  });
}

const byCondition = {};
for (const r of out) {
  if (r.missing) continue;
  (byCondition[r.condition] ??= []).push(r);
}
const stats = (values) => {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mean = nums.reduce((s, v) => s + v, 0) / nums.length;
  const median = nums.length % 2 ? nums[(nums.length - 1) / 2] : (nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2;
  return { mean: Math.round(mean), median: Math.round(median), min: nums[0], max: nums[nums.length - 1] };
};
const summary = {};
for (const [condition, list] of Object.entries(byCondition)) {
  summary[condition] = {
    runs: list.length,
    correctness: list.reduce((s, r) => s + r.correct, 0) + '/' + list.reduce((s, r) => s + r.total, 0),
    sourceBytesRead: stats(list.map((r) => r.sourceBytesRead)),
    cliOutputBytes: stats(list.map((r) => r.cli?.outputBytes ?? 0)),
    cliCalls: stats(list.map((r) => r.cli?.calls ?? 0)),
    uncachedInputTokens: stats(list.map((r) => r.usage?.uncachedInputTokens)),
    outputTokens: stats(list.map((r) => r.usage?.outputTokens)),
    cacheReadTokens: stats(list.map((r) => r.usage?.cacheReadTokens)),
    totalTokens: stats(list.map((r) => r.usage?.totalTokens)),
    steps: stats(list.map((r) => r.usage?.steps)),
    settledMs: stats(list.map((r) => r.usage?.settledMs)),
  };
}
fs.writeFileSync(path.join(DIR, 'runs.json'), JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync(path.join(DIR, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ runs: out, summary }, null, 2));
