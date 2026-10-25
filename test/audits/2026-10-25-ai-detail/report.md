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
| budgeted | 3 | 15/15 | 7（6/7/7） | 12,766 B | **155,518 / 145,179** | 5,968 | **3,938** | 10 | 42.5 s |
| tuned | 3 | 15/15 | 7（6/6/8） | 12,619 B | 166,250 / 123,258 | 5,931 | 5,487 | 10 | 42.0 s |
| final（input + pagination 词表） | 3 | 15/15 | **6**（6/6/6） | **12,178 B** | 169,691 / 162,184 | 7,140 | 4,673 | 11 | 46.1 s |
| brief（`--limit 10 --brief`） | 3 | 15/15 | 8（7/8/8） | 18,474 B | 180,542 / 182,508 | 8,347 | 5,479 | 11 | 56.2 s |

- 调用：20 → **6**（−70%）；CLI 输出字节 −70%；tool 结果 tokens −60%；steps 12 → 11；耗时 93.2 s → 46.1 s。
- 总 token（相对 before）：budgeted 均值 −33.5%；tuned 均值 −28.9%、中位数 −47.3%；final 均值 −27.5%、中位数 −30.7%。
- final 的三次都是 6 次调用，任务 3 不再额外试探；但 final 的 total token 均值（169.7K）高于 budgeted/tuned，说明“调用更少”不必然等于“更少 token”——每次的上下文长度和输出长度仍有波动。
- **brief 反而更差**：省略 summary 后，agent 为 task 1/2/5 各补 1 次 get，调用 6 → 8、总 token 169.7K → 180.5K；它适合宽泛发现，不适合替代默认回答视图。
- 全部运行 15/15；没有源码读取；没有 `--include props`；final 每次只用 1 次 get（Input 的 registration 绑定约束），其余任务由 search 直接回答。

### 每个任务的调用数

| 条件 | task1 | task2 | task3 | task4 | task5 |
| --- | --- | --- | --- | --- | --- |
| budgeted run1–3 | 1 / 1 / 1 | **3 / 3 / 3** | 1 / 1 / 1 | 1 / 1 / 1 | 1 / 1 / 1 |
| tuned run1–3 | 1 / 1 / 1 | **2 / 2 / 2** | 1 / 1 / 3 | 1 / 1 / 1 | 1 / 1 / 1 |
| final run1–3 | 1 / 1 / 1 | **2 / 2 / 2** | **1 / 1 / 1** | 1 / 1 / 1 | 1 / 1 / 1 |
| brief run1–3 | 2 / 2 / 2 | 2 / 2 / 2 | 2 / 1 / 1 | 1 / 1 / 1 | — / 2 / 2 |

- task 2（登录输入框 + RHF 绑定）是上一轮的主要浪费：第一次 search 返回 Form/LoginForm 等包装组件，agent 必须再搜 “input” 并 get。
- 增加 `input`/`login form input` 词表后，tuned 的 task 2 全部降到 2 次（1 search + 1 get 确认绑定约束）。
- task 3 在 tuned run3 出现 3 次：中文查询未命中 TablePagination 的具体词表，先搜 “pagination” 又试 “table pagination”。final 增加 “表格分页/分页控件/pagination control” 词表后，task 3 全部 1 次 search；这是本轮最后一个被消除的固定浪费模式。

## 3. AI 细节发现

1. **真正的成本是步骤，不是单条响应**：before 的 8 次 get 全部是 `--include props`，单次 13KB 的 Input propIndex 很贵；但更大的成本是 20 次调用、12 steps。预算后 1 次批量 get 就覆盖了所有类型细节。
2. **重复 get 已消失**：before 对 `ui.form.Input` 等 ID 重复 get 2–3 次；budgeted/tuned 每个任务最多 1 次 get，且多 ID 合并。
3. **`--brief` 不适用于回答型任务**：brief 省略 summary 后，agent 为 task 1/2/5 各补一次 get，调用 6→8、token 169.7K→180.5K。它应只用于宽泛发现；默认回答仍使用带 summary 的 search。
4. **任务 1 的歧义已缓解但仍存在**：英文 “delete discussion” 现在稳定排到 `DeleteDiscussion`，但 agent 仍会在答案里解释 `ConfirmationDialog`；final task 1 均 1 次调用，不再是问题。
5. **工具结果 token 分布**：before 最贵单条 bash 结果 3,646 tokens；budgeted/tuned/final 最贵约 0.8–1.0K，工具结果总量从 11.8K 降到 3.9–5.5K。

## 4. 验收

- 调用均值：budgeted/tuned 7、final 6、brief 8；total tokens 均值：budgeted 155.5K、tuned 166.3K、final 169.7K、brief 180.5K；15/15；`npm test` 83/83；trial `check` pass。
- 结论：**预算指引 + 批量 get + 两层词表调优把调用从 20 降到 6（−70%），token 均值降到 155–170K（−27%～−34%）；但各条件之间的 token 差异在噪声内，不能宣称某一次词表调整单独降低了总 token**。任务 2/3 的固定浪费模式都已消除。
- 后续最值得做：在更大的陌生仓库复测、把 setup 成本纳入摊销、评估 catalog 体积；`--brief` 已证实不适合回答型任务，保持为发现选项。

## 5. 产物

- 逐次分析：`before/analysis.md`、`budgeted/run*/analysis.md`、`tuned/run*/analysis.md`、`final/run*/analysis.md`、`brief/run*/analysis.md`
- 原始回答与日志：各 run 的 `answer.json`、`usage.jsonl`
- 汇总：`runs.json`、`runs.csv`、`summary.json`
- 分析器：`test/audits/tools/analyze-ai-run.mjs`
- 代码/文档/测试：`query.mjs`、CLI、`SKILL.md` revision 9、README、`test/ai-audit.test.mjs`、`test/catalog.test.mjs`、`test/doctor.test.mjs`
