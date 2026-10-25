# AI 调用细节审计与查询预算优化（2026-10-25）

- 基线（优化前，一次对照）：`test/audits/2026-10-25-optimization-b/catalog-runs/usage/catalog-1.jsonl` + session `75f5edd2...`
- 预算实验（budgeted）：3 次，`budgeted/run1..3`
- 词汇调优后（tuned）：3 次，`tuned/run1..3`
- 指标为 DSH 真实 usage：`uncached + cacheRead + output`；工具结果 token 来自 `contextTimeline.val.surface`

## 1. 这轮落地了什么

| 改动 | 位置 | 目的 |
| --- | --- | --- |
| `get` 支持 1–5 个 ID，批量返回 `components[]` | `lib/query.mjs`、CLI | 一次拿多个详情，减少步骤 |
| search 增加 `layer` | `lib/query.mjs` | 区分 shared-ui / feature，辅助选择 |
| usage log 增加 `task`、`resultIds`、`componentIds`、`arguments` | CLI | 为 AI 时间线提供任务/结果归因 |
| `COMPONENT_CATALOG_TASK` | CLI | 给每次调用打任务标签 |
| `analyze-ai-run.mjs` | `test/audits/tools/` | 合并 session 时间线与 CLI 日志，输出逐事件分析 |
| skill 查询预算 | `SKILL.md`（revision 9） | 每任务 1 次 search、最多 1 次 get、批量 get、不默认 `--include props` |
| trial vocabulary 增加英文任务词与 `input` | trial 配置 | 直接命中预期组件，减少试探 |
| 测试 | `test/ai-audit.test.mjs` 等 | 81 个测试全绿 |

## 2. 结果

| 条件 | 运行数 | 正确 | CLI 调用均值 | CLI 输出均值 | total tokens 均值 / 中位数 | output 均值 | tool 结果 tokens 均值 | steps 均值 | 耗时均值 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before（一次对照） | 1 | 5/5 | 20 | 40,435 B | 233,969 / 233,969 | 8,086 | 11,775 | 12 | 93.2 s |
| budgeted | 3 | 15/15 | **7**（6/7/7） | **12,766 B** | **155,518 / 145,179** | 5,968 | **3,938** | 10 | 42.5 s |
| tuned | 3 | 15/15 | **7**（6/6/8） | **12,619 B** | **166,250 / 123,258** | 5,931 | 5,487 | 10 | 42.0 s |

- 调用：20 → 7（−65%）；CLI 输出字节 −68%；tool 结果 tokens −67%；steps 12 → 10。
- 总 token：budgeted 均值 −33.5%、中位数 −38%；tuned 均值 −28.9%、中位数 −47.3%。
- tuned 的均值被 run3 拉高（256,710；搜索截断导致 task 3 多做 2 次 search、14 steps）；中位数反而更低（123,258）。
- 全部运行 15/15；没有源码读取；没有 `--include props`；批量 get 每次运行都被使用。

### 每个任务的调用数

| 条件 | task1 | task2 | task3 | task4 | task5 |
| --- | --- | --- | --- | --- | --- |
| budgeted run1–3 | 1 / 1 / 1 | **3 / 3 / 3** | 1 / 1 / 1 | 1 / 1 / 1 | 1 / 1 / 1 |
| tuned run1–3 | 1 / 1 / 1 | **2 / 2 / 2** | 1 / 1 / 3 | 1 / 1 / 1 | 1 / 1 / 1 |

- task 2（登录输入框 + RHF 绑定）是上一轮的主要浪费：第一次 search 返回 Form/LoginForm 等包装组件，agent 必须再搜 “input” 并 get。
- 增加 `input`/`login form input` 词表后，tuned 的 task 2 全部降到 2 次（1 search + 1 get 确认绑定约束）。
- task 3 在 tuned run3 仍出现 3 次：首次 search “table pagination” 的 4 KiB 响应被截断，分页组件未出现，agent 又搜了两次。

## 3. AI 细节发现

1. **真正的成本是步骤，不是单条响应**：before 的 8 次 get 全部是 `--include props`，单次 13KB 的 Input propIndex 很贵；但更大的成本是 20 次调用、12 steps。预算后 1 次批量 get 就覆盖了所有类型细节。
2. **重复 get 已消失**：before 对 `ui.form.Input` 等 ID 重复 get 2–3 次；budgeted/tuned 每个任务最多 1 次 get，且多 ID 合并。
3. **search 截断成为新的主要噪声**：budgeted/tuned 的 search 调用 4–7 次里常有 4–6 次 `truncated`（4 KiB 上限）。这不一定影响答案，但确实导致 task 3 的一次额外试探。下一轮应优化 search 的“紧凑结果”而不是继续加字段（可考虑 `--limit 3` 默认、search 的 `--brief`、或对 summary/requiredProps 做可配置裁剪）。
4. **任务 1 的歧义已缓解但仍存在**：英文 “delete discussion” 现在稳定排到 `DeleteDiscussion`，但 agent 仍会在答案里解释 `ConfirmationDialog`；task 1 均 1 次调用，不再是问题。
5. **工具结果 token 分布**：before 最贵单条 bash 结果 3,646 tokens；budgeted/tuned 最贵约 0.8–1.0K，工具结果总量从 11.8K 降到 3.9–5.5K。

## 4. 验收

- 调用均值 7 ≤ 13（目标达成）；total tokens 均值 155.5K/166.3K ≤179K（目标达成）；15/15；`npm test` 81/81；trial `check` pass。
- 结论：**预算指引 + 批量 get + 词表调优把调用从 20 降到 7、token 均值降到 155–166K**；但 tuned 与 budgeted 的差异在方差内，不能宣称 `input` 词表让总 token 进一步下降（它只稳定把 task 2 从 3 次降到 2 次）。
- 后续最值得做：解决 search 4 KiB 截断（compact search view），再复测一次；目标是消除 task 3 的额外搜索并降低 tuned 的 256K 离群值。

## 5. 产物

- 逐次分析：`before/analysis.md`、`budgeted/run*/analysis.md`、`tuned/run*/analysis.md`
- 原始回答与日志：各 run 的 `answer.json`、`usage.jsonl`
- 汇总：`runs.json`、`runs.csv`、`summary.json`
- 分析器：`test/audits/tools/analyze-ai-run.mjs`
- 代码/文档/测试：`query.mjs`、CLI、`SKILL.md` revision 9、README、`test/ai-audit.test.mjs`、`test/catalog.test.mjs`、`test/doctor.test.mjs`
