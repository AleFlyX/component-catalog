# 大规模陌生仓库 B 测试：airport-internal-mobile

- 日期：2026-10-26
- 项目：`/home/ccb/airport-workspace/airport-internal-mobile`（React + TypeScript + Vite，约 1431 个源文件、136 个 TSX）
- 测试副本：`/tmp/oss-trial/airport-mobile`（安装依赖，未改原仓库）
- 目录范围：`src/components/common` + `src/components/business` + `src/features/auth` + `src/features/flight-delay-compensation` + `src/features/traveler-bookings`
- Catalog：30 条（common 6 + business 11 + auth 3 + flight-delay 7 + bookings 3；9 个 booking 常量显式 ignore），`component-catalog.json` 315,303 B / gzip 22 KB
- 校验：doctor pass、audit pass、check pass（30 条，issues 0）
- 源仓库规模明显大于 bulletproof-react trial（127 → 1431 文件），且是陌生业务域（机场/航班延误/旅客预订）

## 1. 任务

5 个业务查询：

1. 航班延误补偿批次工作区页面：ID、导入路径、必填 props
2. 特殊旅客预订列表：ID、导入路径、必填 props
3. 密码输入框：ID、导入路径、错误如何显示
4. 移动端预订列表的搜索栏 + 筛选面板：两个 ID、导入路径、必填 props
5. 全局认证恢复弹窗：ID、导入路径、挂载方式

## 2. 结果

| 条件 | 正确 | CLI 调用 | 源码读取 | total tokens 均值 / 中位数 | 范围 | steps | tool calls | 耗时 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| catalog | 15/15 | **6** | **0 文件 / 0 B** | **204,896 / 200,600** | 161,961–252,127 | 11 | 13 | 66.8 s |
| catalog-details | 15/15 | **5** | **0 文件 / 0 B** | **100,194 / 87,723** | 78,024–134,834 | 7 | 8 | 28.0 s |
| catalog-details-ui（40 条） | 15/15 | 5.3（5/6/5） | **0 文件 / 0 B** | **114,586 / 104,914** | 86,966–151,877 | 8 | 8 | 33.6 s |
| catalog-details-u55（55 条） | 15/15 | 5.3（6/5/5） | **0 文件 / 0 B** | **167,283 / 170,475** | 151,672–179,703 | 10 | 9 | 57.6 s |
| source | 15/15 | 0 | **14 文件 / 94,227 B** | **462,815 / 396,472** | 355,219–636,755 | 20 | 29 | 67.5 s |

- 总 token：catalog 比 source 低 **55.7%**（均值）/**49.4%**（中位数）；`catalog-details` 进一步降到 **100,194 / 87,723**，比 catalog 再低 **51.1% / 56.3%**，比 source 低 **78.3% / 77.9%**；范围 78–135K 与 source 的 355–637K 完全不重叠。
- 差异来自 cache read 和 uncached input：catalog-details 为 91,008 / 4,715，source 为 431,360 / 20,513；output 也从 10,944 降到 4,470，因为不再需要补 get/长回答。steps 从 11 降到 7，tool calls 从 13 降到 8。
- 普通 catalog 用 6 次 search/get；`catalog-details` 用 **5 次 search、0 次 get**，每个任务一次 `--limit 5 --details` 即可拿到 ID/importPath/requiredProps/第一条约束。source 需要读 14 个文件（batch-detail-screen 23.9KB、booking-list-screen 13.8KB、ui.css 28.1KB 等）。
- 三个条件都 15/15。任务 2 的“特殊旅客预订列表”没有专用变体，catalog 与 source 都收敛到 `TravelerBookingListScreen`；details 条件明确报告“没有专用变体”，置信度 medium，其余任务 high。
- **约束质量重要**：第一次 details 测试中 `TravelerBookingListScreen` 的约束误写了“initialStatus 必填”，而类型中它是可选的；修正后才重跑。AI 生成的 constraint 必须做类型/源码复核，否则 search 会放大错误。

## 3. 发现

1. **在更大、更陌生的仓库上，catalog 首次出现明确、幅度很大的 token 收益**：普通 catalog 相对 source −55.7% 均值；加上 `--details` 和“不做 config/help/shell 探索”的预算后，进一步到 −78.3% 均值。收益随仓库规模和检索空间增长。
2. **`--details` + 严格非 CLI 预算是本轮最大单项优化**：6→5 次调用、11→7 steps、13→8 tool calls、205K→100K tokens；因为 search 直接给出第一条约束/usage，agent 不再补 get，也不再读 config/help。
3. **目录范围不需要覆盖全仓库也能产生收益**：只登记 30 个业务相关组件（约 2% 源文件），就足以回答 5 个跨模块任务；source 却要在 1431 个文件中定位。
4. **details 能回答约束型问题，但不能替代精确实现**：错误展示/挂载方式可由第一条 constraint 回答；精确 DOM 结构仍需 source。约束必须准确，否则会把错误变成“结构化答案”。
5. **setup 成本**：30 条标注产生 30,947 B patch、284 个新增行（13,035 B，含 JSDoc 与 2 个 preview）；比 bulletproof 的 857 行小，但仍需安装依赖和生成。按 details 相对 source 节省约 363K tokens/5 任务估算，setup 回本更快（约 1 批），但依赖安装/人工选择范围未计入。
6. **任务歧义**：“特殊旅客预订列表”没有专用页面组件；catalog 的 vocabulary/摘要无法凭空创造不存在的变体，最终与 source 一致。目录应记录“没有专用组件”这一事实，而不是强行造 ID。

### AI 埋点（本轮加强）

`test/audits/tools/analyze-ai-run.mjs` 现在额外输出：

- `cli.searchDetails` / `searchBrief` / `searchTruncated` / `searchOmittedByLimit` / `searchOmittedByBytes`
- `cli.getBatchCalls` / `uniqueGetIds`
- `timeline.toolCallsByName`
- `derived.observedToolCalls` / `derived.nonCliToolCalls`
- CLI 失败日志也带 `task`、`arguments`、`options`

airport 的 observed/non-CLI 对比：

| 条件 | CLI 调用 | observed tools | non-CLI | total tokens |
| --- | --- | --- | --- | --- |
| catalog run1/2/3 | 6 | 9 / 15 / 16 | 3 / 9 / 10 | 161,961 / 200,600 / 252,127 |
| details run1/2/3 | 5 | 7 / 9 / 9 | 2 / 4 / 4 | 78,024 / 134,834 / 87,723 |

non-CLI 调用和 token 有相关性，但不是唯一因素（details-2 与 details-3 non-CLI 都是 4，token 差 47K），所以埋点只能定位“探索动作”，不能替代逐任务输出/上下文分析。

### 覆盖率抽样与扩容

[coverage report](../2026-10-26-airport-coverage/report.md)：

- 30 条：in-catalog 10/10、outside-catalog 0/10，整体 50%。
- 扩到 40 条（+10 个核心 UI 原语）：outside-catalog 4/10，整体 **70%**。
- 代价：3 次 details B 从 100,194 升到 114,586 均值（+14.4%），仍比 source 低 75.2%；search 输出字节未增加，token 上升主要来自一次额外 get/方差。
- 30 条只覆盖 103 个 supported 候选的 29.1%、519 个总候选的 5.8%；40 条为 38.8%。详细见 [40 条报告](../2026-10-26-airport-ui-expanded/report.md)。
- 扩到 55 条：outside-catalog **9/10**、整体 **95%**，但 token **167,283 / 170,475**（相对 40 条 +46.0%）；业务查询被 UI 候选放大，不建议默认启用。见 [55 条报告](../2026-10-26-airport-ui55-expanded/report.md)。

## 4. 限制

- Catalog 只覆盖选定 30 条，不是全部 519 个候选；未选范围的查询仍需 source。
- 依赖安装（pnpm）体积大，未计入 setup token；测试副本在 `/tmp`，不影响原仓库。
- 只跑了 3 次/条件、5 个任务；catalog 范围选择会影响收益。
- 未验证运行时渲染/交互；只验证类型、生成、audit/check 与查询答案。
- source 条件允许搜索整个 workspace，但实际读取集中在 mobile；这符合“陌生 monorepo”场景。

## 5. 产物

- `trial-config.json`、`catalog.json.gz`、`annotations.patch`
- `raw/catalog/*.json`、`raw/catalog-details/*.json`、`raw/source/*.json`
- `usage/catalog-*.jsonl`、`usage/details-*.jsonl`
- `analysis/catalog-*`、`analysis/details-*`、`analysis/details-ui-*`、`analysis/details-u55-*`、`analysis/details-u55-limit3-*`（增强后的 AI 埋点）
- `runs.json`、`runs.csv`、`summary.json`
- 查询回归：`test/airport-regression.test.mjs`
