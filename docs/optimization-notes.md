# 优化记录与后续方向

本文件汇总 component-catalog 在真实项目上的性能/调用行为发现，作为后续迭代的长期记录。详细原始数据在 `test/audits/`，基线在 `test/baselines/bulletproof-react-2026-10-25/`。

## 1. 测试环境

- 项目：`alan2207/bulletproof-react`，`apps/react-vite`，74 个 catalog 条目
- CLI 0.3.0；skill revision 9；Node 24
- 真实 usage：DSH `session_projcache` 的 `tokenUsage.val.totals` + `contextTimeline.val.surface`
- 任务集：确认弹窗、登录输入框、讨论分页、Markdown 渲染、创建讨论
- 指标：CLI 调用数、`total tokens = uncached + cacheRead + output`、tool 结果 token、steps、wall time、正确率

## 2. 已完成的优化

| 优化 | 效果 |
| --- | --- |
| `propsSummary` + 紧凑 `propIndex` | 大组件 props 不再整体丢失；`get --include props` 从约 13 KB 降到约 5 KB |
| `scan --brief` | 113 个候选从 4 页/30.9 KB 降到 3 页/16.5 KB |
| ASCII 词边界 | `isLoading` 不再误命中 `loading` 概念 |
| search 返回 `importPath`/`requiredProps`/`layer` | 常见任务可由一次 search 回答，少一次 get |
| 批量 `get`（1–5 ID） | 多组件详情一次调用；单 ID 响应不变 |
| `COMPONENT_CATALOG_LOG` + `COMPONENT_CATALOG_TASK` | 本地 JSONL 可关联任务、结果 ID、输出字节 |
| `analyze-ai-run.mjs` | 合并 session 时间线与 CLI 日志，定位逐任务/逐工具成本 |
| 查询预算（skill revision 9） | 每任务 1 次 search、最多 1 次 get、批量 get、不默认 `--include props` |
| trial 词表（英文任务词、input、分页） | task 2 从 3 次调用降到 2 次；task 3 固定 1 次 |
| search `--brief` + `truncated` 语义拆分 | 省略 summary 的紧凑视图；`truncated` 只表示字节裁剪，更多匹配用 `omitted.byLimit` |
| 查询回归集（`test/query-regression.test.mjs`） | 25 个查询 + 5 个必须排第一的入口，使用真实 trial catalog 防止 task 2/3 排序回退 |

## 3. 测量结果

同一 5 任务、3 次复测（before 为一次对照）：

| 条件 | 调用均值 | total tokens 均值 / 中位数 | tool 结果 tokens | 正确率 | steps |
| --- | --- | --- | --- | --- | --- |
| before | 20 | 233,969 / 233,969 | 11,775 | 5/5 | 12 |
| budgeted | 7 | 155,518 / 145,179 | 3,938 | 15/15 | 10 |
| tuned | 7 | 166,250 / 123,258 | 5,487 | 15/15 | 10 |
| final | **6** | **169,691 / 162,184** | 4,673 | 15/15 | 11 |

调用 −70%，token 均值 −27%～−34%，tool 结果 token −60%；所有 final 运行均为 6 次调用、0 源码读取、0 `--include props`。各条件 token 差异有较大方差，不能把某一次词表调整单独归因为总量下降。

## 4. AI 行为发现

1. **成本是步骤，不是单条响应字节**：before 有 8 次 get、每次都带 `--include props`；预算后 1 次批量 get 覆盖全部类型细节。
2. **max 1 get/task + 批量 get 有效**：重复 get 消失；final 每次只有 1 次 get（Input 的 registration 约束）。
3. **task 2（登录输入框）是固定浪费**：首次 search 返回 Form/LoginForm，agent 需要再搜 “input”；`input`/`login form input` 词表后固定 2 次（search + get）。
4. **task 3（分页）是第二个固定浪费**：中文“分页控件”未命中 TablePagination；加入“表格分页/分页控件/pagination control”后固定 1 次 search。
5. **`truncated` 语义容易被误解**：search 的 `truncated` 过去同时表示“匹配数超过 limit”和“字节裁剪”，agent 会误以为输出被截断。现已拆分：`truncated` 只表示字节裁剪，更多匹配用 `omitted.byLimit`，字节裁剪用 `omitted.byBytes`；同时新增 `search --brief`，省略 summary 后在 4 KiB 内可容纳更多候选。
6. **剩余方差主要来自上下文/输出长度**：final 三次都是 6 次调用，但 total tokens 155K–192K；单次输出和上下文长度仍是主要变量。

## 5. 后续方向（按优先级）

1. **更大、更陌生的代码库**（下一步）：当前是 3 应用 monorepo；换一个已安装依赖的陌生中大型仓库，每条件 5 次，按 cache read 折扣做价格加权。需要重新 setup/标注，成本较高，应在查询语义稳定后进行。
2. **setup 成本摊销**：把标注/生成的实际 token 成本纳入对比；本次标注约 +842 行，按当前节省额估算仍需约 20–30 个同类任务才可能回本。
3. **catalog 产物体积**：3.93 MB/74 条主要来自继承 DOM props；可考虑生成时的 inherited/declared 标记或 compact catalog，但要避免隐藏真实 API。
4. **skill 指令与工具行为同步**：任何新增 selector/字段都要同步 SKILL.md、README 与 doctor revision，避免安装方看到旧指引。
5. **compact search 的复测**：`--brief` 已实现并有回归测试，但尚未单独跑 3 次 B；下一步用 `--limit 10 --brief` 做探索任务，确认调用数不增加且目标仍在 top 5。

## 7. Setup 成本与 catalog 体积

### Setup 成本（基于本次 trial 的实测文件）

| 项目 | 数值 |
| --- | --- |
| 标注补丁 | 76,232 B；新增 857 行 / 39,051 B（约 9.8K tokens，按 4 B/token 估） |
| 被标注源文件 | 35 个，104,440 B（约 26K tokens） |
| 配置 + 生成 + 验证 | 未单独计时；按工具调用和读取估算总 setup 约 50–100K tokens |

注意：这是一次性成本，且不包含后续组件变更的维护。按 4 B/token 只是量级估算，并非真实模型 token。

### 回本模型

相对 `source-pristine`（231,028 tokens/5 任务），final catalog 为 169,691，节省约 61,337 tokens/批；相对 before 为 64,278/批。

- **总 token 等权**（cache read 与输出同价）：50–100K setup ÷ 61K/批 ≈ **1–2 批（5–10 个同类任务）**。
- **只按 output token 计**（更保守，因为 cache read 通常更便宜）：output 9,986 → 7,140，节省 2,846/批；9.8K 标注输出 ÷ 2,846 ≈ **3.4 批（约 17 个任务）**。
- 两种口径都说明：项目长期使用、任务重复时才可能回本；一次性或低频查询不适合先做完整 setup。此前文档中的 20–30 任务估算偏向 output-only 且使用旧基线，应以此处的双口径为准。

### Catalog 体积

- 未压缩 `component-catalog.json`：3,929,651 B；gzip 后 249 KB。
- 74 条中 46 条 props >12 KB；props 字段合计约 2.2 MB，主要来自继承的 DOM/aria/event 属性。
- 当前查询不读全量 catalog，所以体积主要影响仓库 diff、生成/传输和审阅，而不是在线查询 token；若要做 compact catalog，应先标记 inherited/declared props，避免隐藏真实 API。

## 8. 相关产物

- 基线：`test/baselines/bulletproof-react-2026-10-25/`
- 第一轮优化/审计：`test/audits/2026-10-25-optimization-a/`
- 重复 B：`test/audits/2026-10-25-b-repeated/`
- 第二轮（search/compact propIndex）：`test/audits/2026-10-25-optimization-b/`
- 第三轮（barrel）：`test/audits/2026-10-25-optimization-c/`
- AI 细节与预算：`test/audits/2026-10-25-ai-detail/`
- 分析器：`test/audits/tools/analyze-ai-run.mjs`
