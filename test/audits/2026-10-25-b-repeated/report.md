# B 审计重复实验（3 runs × 3 conditions）

- 日期：2026-10-25
- 项目：`alan2207/bulletproof-react` @ `9506629`（monorepo，3 个应用，约 241 个 TSX）
- 任务：5 个固定查询（确认弹窗、登录输入框、讨论分页、Markdown 渲染、创建讨论）
- 条件：`catalog`（只用 search/get）、`source`（带本次标注的 monorepo 源码）、`source-pristine`（上游未标注源码）
- 每条件 3 次独立子 agent 运行；共 9 次
- 真实模型 usage：从 DSH `~/.dsh/storages/session_projcache/sessions/<session-id>.json` 的 `rows.tokenUsage.val.totals` 读取，而不是字节估算

> 后续优化（search 返回 importPath/requiredProps + 紧凑 propIndex）后，catalog 条件 3 次复测均值为 198,647 tokens（本轮为 229,299），见 [第二轮优化报告](../2026-10-25-optimization-b/report.md)。本报告仍是该优化前的基线。

## 1. 指标定义

| 指标 | 含义 |
| --- | --- |
| `uncached_input` | 未命中上下文缓存的输入 token |
| `cache_read` | 从上下文缓存读取的 token（通常比未缓存输入便宜） |
| `output` | 模型输出 token |
| `total_tokens` | `uncached_input + cache_read + output`（未做价格加权） |
| `cli_calls` / `cli_output` | catalog 条件的 CLI 调用数与成功响应字节 |
| `source_bytes` | source 条件实际完整读取的源码字节（来自子 agent 报告） |
| `steps` / `settled_ms` | 子 agent 的 LLM/tool 步数与总耗时 |

所有子 agent 都使用同一 agent preset、同一任务文本；catalog 条件允许在 catalog 不足时读源码（实际 0 次）。

## 2. 逐次结果

| 条件 | run | 正确 | CLI 调用 | CLI 字节 | 源码字节 | steps | uncached | output | cache read | total tokens | 耗时 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| catalog | 1 | 5/5 | 17 | 36,872 | 0 | 10 | 14,257 | 5,583 | 170,496 | 190,336 | 40,111 |
| catalog | 2 | 5/5 | 31 | 61,010 | 0 | 11 | 20,439 | 10,016 | 247,424 | 277,879 | 98,167 |
| catalog | 3 | 5/5 | 18 | 35,471 | 0 | 10 | 14,751 | 9,090 | 195,840 | 219,681 | 99,695 |
| source | 1 | 5/5 | 0 | 0 | 42,877 | 15 | 19,564 | 9,650 | 294,400 | 323,614 | 89,688 |
| source | 2 | 5/5 | 0 | 0 | 44,100 | 17 | 17,442 | 10,661 | 322,688 | 350,791 | 86,228 |
| source | 3 | 5/5 | 0 | 0 | 39,980 | 8 | 17,806 | 6,386 | 158,080 | 182,272 | 34,149 |
| source-pristine | 1 | 5/5 | 0 | 0 | 29,500 | 9 | 16,114 | 8,265 | 167,936 | 192,315 | 44,233 |
| source-pristine | 2 | 5/5 | 0 | 0 | 29,500 | 10 | 15,335 | 11,516 | 191,872 | 218,723 | 59,068 |
| source-pristine | 3 | 5/5 | 0 | 0 | 35,261 | 13 | 19,197 | 10,177 | 252,672 | 282,046 | 55,887 |

## 3. 条件汇总

| 指标 | catalog | source（带标注） | source-pristine | catalog vs pristine |
| --- | --- | --- | --- | --- |
| 正确率 | 15/15 | 15/15 | 15/15 | 相同 |
| total tokens 均值 | **229,299** | 285,559 | **231,028** | **−0.75%** |
| total tokens 中位数 | **219,681** | 323,614 | **218,723** | +0.44% |
| total tokens 范围 | 190,336–277,879 | 182,272–350,791 | 192,315–282,046 | 大幅重叠 |
| output 均值 | **8,230** | 8,899 | 9,986 | −17.6% |
| uncached input 均值 | **16,482** | 18,271 | 16,882 | −2.4% |
| cache read 均值 | 204,587 | 258,389 | 204,160 | +0.2% |
| steps 均值 | 10 | 13 | 11 | — |
| CLI 调用/输出字节 | 22 / 44,451 | 0 / 0 | 0 / 0 | 读源码 0 B，但 CLI 输出更多 |
| 源码读取均值 | 0 B | 42,319 B | 31,420 B | — |
| 耗时均值 | 79,324 ms | 70,022 ms | 53,063 ms | +49% |

## 4. 结论

1. **重复 3 次后，catalog 与 pristine 源码的总 token 基本打平**：均值 229.3K vs 231.0K（−0.75%），中位数 219.7K vs 218.7K（+0.4%），范围高度重叠（190–278K vs 192–282K）。**不能证明 catalog 在这组任务上省 token。**
2. **catalog 相对“带标注源码”低约 19.7%**（229.3K vs 285.6K）：标注让源文件变大（42.3KB vs 31.4KB），source 条件要读更多字节；但这只是“标注后的源码”对照，不是上游基线。
3. **catalog 的 output token 更少**（8.2K vs 10.0K），但 input/cache read 占主导；catalog 用更多 CLI 调用（均值 22 次，最高 31 次）和更长的耗时（79s vs 53s）换来了零源码读取。
4. **单次字节结论不可靠**：上一轮“catalog 比 pristine 多 59% 字节”是按 CLI/源码字节算的；按真实模型 token，catalog 与 pristine 几乎相同。字节数不能替代 token，尤其是 JSON 与源码的 token/byte 比不同。
5. **正确性没有差异**：9 次运行全部 5/5。任务 1 存在合理歧义（`ConfirmationDialog` vs feature 级 `DeleteDiscussion`），三种条件都给出了另一个候选；catalog 条件的导入路径常是直接模块（`.../confirmation-dialog/confirmation-dialog`），source 条件常是 barrel（`@/components/ui/dialog`），两者都能解析，但 catalog 没有优先给出项目惯用的 barrel 路径。
6. **一次性成本仍未摊销**：标注约 +842 行（粗估 8–15K output tokens，另加 setup 期读源码成本）。按本轮 output 平均节省 1,756 tokens/5 任务估算，约 24 个同类任务才可能摊平；而总 token 差异本身在噪声范围内，所以“回本”没有可靠证据。
7. **“更大/更陌生代码库”只完成了部分**：source 条件在 3 个应用的 monorepo（约 241 TSX）里搜索，任务限定 `apps/react-vite`；没有换到一个完全陌生、需要重新 setup 的仓库（那需要再次标注/生成 catalog，成本很高）。因此本轮仍属于“中等规模、熟悉项目”的重复实验。
8. **`rg/grep` 输出未单独拆分**：子 agent 的搜索命令输出会进入模型上下文，已包含在 `uncached_input`/`cache_read` 中；本机没有 `rg`，source 条件实际使用 `grep`。逐次命令数见 `raw/source-*.json` 的 `commands` 字段（8–17 次），未再单独统计命令 stdout 字节。

## 5. 对工具/流程的启示

- **不要用字节数做 token 结论**；用 harness 的 usage（本次已接入 projcache 读取）。
- catalog agent 的探索成本是主要变量：同一条件 17–31 次调用，token 从 190K 到 278K。若把词汇/ID 直达做得更好（减少试错），catalog 有望稳定低于源码条件。
- `--brief`、`propsSummary` 等优化减少了单次响应字节；但 agent 若仍用 `--include props`，会拉大 output。建议在 skill 指引中明确“先 search 拿 ID，再 get 默认视图，必要时才 --prop/--include props”。
- 导入路径：catalog 的 `importPath` 是 root 前缀 + 文件路径，未建模 barrel；对 `@/components/ui/dialog` 这类惯用入口，agent 需要自行判断。可考虑在 catalog 中记录 preferred export 或允许 `importPrefix` 指向 barrel。
- 若继续验证，建议：换一个已安装依赖的陌生中大型仓库，做 10 个以上任务、每条件 5 次，并用价格加权（cache read 折扣）；同时记录 setup 的真实 token 成本。

## 6. 产物与复现

- 原始 9 份回答：`raw/`
- catalog 使用日志：`usage/catalog-{1,2,3}.jsonl`
- 汇总：`runs.json`、`runs.csv`、`summary.json`
- 聚合脚本：`aggregate.mjs`（写死了本机 session id 与 `/tmp/audit-b2` 路径，仅作记录）
- 真实 usage 读取位置：`~/.dsh/storages/session_projcache/sessions/<id>.json` 的 `record.rows.tokenUsage.val.totals`、`sessionStats.val`、`subagentTiming.val`
- 条件 prompt：见本报告第 1 节；子 agent 工作目录分别为 `apps/react-vite`（catalog）、monorepo 根（source）、pristine monorepo 根（source-pristine）
