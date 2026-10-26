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
| search `--details` + 非 CLI 预算 | 第一条 constraint + usage 计数；禁止 config/help/shell 探索。airport：6→5 次调用，205K→100K tokens |
| search `--layer` | 55 条目录 + layer 过滤：95% 覆盖，94.9K tokens；比无过滤 55 条低 43% |
| search `--per-layer` | 55 条 + 每层 top2：95% 覆盖，103.5K；无需选层，混合意图稳定 |

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

## 8. 大规模陌生仓库复测（airport-internal-mobile）

- 项目：`/home/ccb/airport-workspace/airport-internal-mobile`，约 1431 源文件 / 136 TSX；只登记 30 个业务相关组件（约 2% 候选）。
- Catalog：30 条，315 KB / gzip 22 KB；标注 patch 30,947 B / 新增 284 行；doctor/audit/check 全 pass。
- 5 个任务 × 3 次：
  - catalog：6 次调用 / 11 steps / 204,896 tokens（中位数 200,600）
  - catalog-details：**5 次调用 / 7 steps / 100,194 tokens（中位数 87,723）**
  - source：14 文件 / 94 KB / 20 steps / 29 tool calls / 462,815 tokens（中位数 396,472）
- 正确率均 15/15；details 相对 source **总 token −78.3% 均值 / −77.9% 中位数**，相对普通 catalog 再降 **51.1% / 56.3%**；范围 78–135K 与 source 355–637K 不重叠。
- 收益来源：search 直接返回第一条 constraint + usage，agent 不再补 get；严格的“不读 config/不跑 help/不做 shell 探索”预算把 steps/tool calls 从 11/13 降到 7/8。
- 结论：**收益随仓库规模和检索空间显著增长**；只覆盖 2% 源文件的精选范围已足够回答跨模块任务；setup 按本轮节省额可在一批任务左右回本（依赖安装成本未计入）。
- 质量教训：第一次 details 测试中 `TravelerBookingListScreen` 的 constraint 误写“initialStatus 必填”，实际可选；修正后重跑。AI 生成的 constraint 必须做类型/源码复核。
- 限制：未覆盖全部 519 个候选；任务 2 的“特殊旅客列表”没有专用变体，catalog/source 都收敛到同一组件；精确 DOM 结构仍需 source。

## 9. AI 埋点与覆盖率（2026-10-26）

### AI 埋点增强

`test/audits/tools/analyze-ai-run.mjs` 新增：

- CLI 维度：`searchDetails`、`searchBrief`、`searchTruncated`、`searchOmittedByLimit/ByBytes`、`getBatchCalls`、`uniqueGetIds`
- 会话维度：`toolCallsByName`、`observedToolCalls`、`nonCliToolCalls`
- CLI 失败日志补全 `task`、`arguments`、`options`

airport 对比：普通 catalog 的 non-CLI 为 3/9/10，details 为 2/4/4；non-CLI 与 token 有相关性，但 details-2/3 都是 4 次而 token 差 47K，说明埋点只能定位探索开销，不能单独解释全部方差。

### 覆盖率抽样

- 20 个查询：in-catalog 10/10（top-5），outside-catalog 0/10，整体 50%。
- 30 条覆盖 103 个 supported 候选的 **29.1%**、519 个总候选的 **5.8%**；`src/components/ui` 40 个 supported 全部未登记。
- 结论：目录内检索已够好，下一阶段瓶颈是覆盖；先扩核心 UI 原语，再用同一查询集复测。

### 扩容实验结果（30 → 40 条）

- 新增 `src/components/ui` 根，保留 button/form/overlay 三个文件，登记 10 个核心原语（Button、IconButton、Input、PasswordInput、TextArea、Form、FormField、Dialog、Popup、ActionSheet）；其余 UI 文件 exclude。
- 覆盖：outside-catalog 0/10 → **4/10**，整体 **50% → 70%**；supported 覆盖 29.1% → 38.8%。
- B：40 条 114,586 / 104,914 tokens，相对 30 条 **+14.4% / +19.6%**，相对 source 仍 **−75.2% / −73.5%**；5 个业务任务仍 15/15，search 输出字节没有增加。
- 结论：+10 条换 +20pp 覆盖率、+14% token，交换合理但仍远优于 source；剩余 SearchBar/DatePicker/EmptyState/Tabs/Card/NavBar 分散在多个文件，文件粒度会一次带入多个导出。

### 覆盖饱和实验（40 → 55 条）

- 再加入 date-picker/feedback/layout/navigation 的 15 个导出：outside-catalog 4/10 → **9/10**、整体 **70% → 95%**；仅 UiSearchBar 因工具不支持仍缺失。
- B：55 条 **167,283 / 170,475 tokens**，相对 40 条 **+46.0% 均值 / +62.5% 中位数**，相对 30 条 +67.0%；steps 10 vs 8，output 9,445 vs 5,441。`--limit 3` 只降到 151,929 / 154,178（−9.2%），仍比 40 条高 32.6%。
- 原因：业务查询会带入更多 UI 候选（如“认证恢复弹窗”同时返回 UiDialog/UiPopup），top-1 仍正确但上下文/答案被放大；覆盖率收益不抵 token。
- 结论：无过滤时 55 条不划算；但 **55 + `--layer` 是当前最佳组合**：**94,902 / 92,507 tokens**，95% 覆盖，比 40 条低 17.2%，比无过滤 55 条低 43.3%。
- 关键不是“目录不能大”，而是大目录必须配查询范围：feature 任务用 `--layer feature`，原语任务用 `--layer shared-ui`；无法判断 layer 时 40 条是安全默认。
- **layer 选择稳定性是新的瓶颈**：明确指定 layer 时 94.9K；agent 自选平均 135.8K（+43%），且有一次把“密码输入框”选成 shared-ui 的 `ui.UiPasswordInput` 而不是 `auth.PasswordInput`。`--layer-fallback` 只处理空层；错层仍有 1 条匹配时不会触发（task4 未完成），平均 173.4K。`--layer auto` 按 top-1 推层，平均 137.4K，但三次 task4 都把多意图查询锁定到 feature，漏掉 shared-ui 的 SearchBar/FilterSheet；auto 只适合单意图查询。

## 10. 相关产物

- 基线：`test/baselines/bulletproof-react-2026-10-25/`
- 第一轮优化/审计：`test/audits/2026-10-25-optimization-a/`
- 重复 B：`test/audits/2026-10-25-b-repeated/`
- 第二轮（search/compact propIndex）：`test/audits/2026-10-25-optimization-b/`
- 第三轮（barrel）：`test/audits/2026-10-25-optimization-c/`
- AI 细节与预算：`test/audits/2026-10-25-ai-detail/`
- 分析器：`test/audits/tools/analyze-ai-run.mjs`
- 大规模陌生仓库：`test/audits/2026-10-26-airport-mobile/`
- 机场查询回归：`test/airport-regression.test.mjs`
- 覆盖率抽样：`test/audits/2026-10-26-airport-coverage/`
- 40 条扩容：`test/audits/2026-10-26-airport-ui-expanded/`
- 55 条覆盖饱和：`test/audits/2026-10-26-airport-ui55-expanded/`
- layer 过滤验证：`test/audits/2026-10-26-airport-mobile/raw/catalog-details-u55-layer/`
- layer 选择稳定性：`test/audits/2026-10-26-airport-layer-selection/`
- per-layer 验证：`test/audits/2026-10-26-airport-mobile/raw/catalog-details-u55-per-layer/`
- 覆盖率工具：`test/audits/tools/coverage-sample.mjs`
