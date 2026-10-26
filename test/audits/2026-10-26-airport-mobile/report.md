# 大规模陌生仓库 B 测试：airport-internal-mobile

- 日期：2026-10-26
- 项目：`/home/ccb/airport-workspace/airport-internal-mobile`（React + TypeScript + Vite，约 1431 个源文件、136 个 TSX）
- 测试副本：`/tmp/oss-trial/airport-mobile`（安装依赖，未改原仓库）
- 目录范围：`src/components/common` + `src/components/business` + `src/features/auth` + `src/features/flight-delay-compensation` + `src/features/traveler-bookings`
- Catalog：30 条（26 个组件 + 4 个页面级组件；9 个 booking 常量显式 ignore），`component-catalog.json` 315,303 B / gzip 22 KB
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
| source | 15/15 | 0 | **14 文件 / 94,227 B** | **462,815 / 396,472** | 355,219–636,755 | 20 | 29 | 67.5 s |

- 总 token：catalog 比 source 低 **55.7%**（均值）/**49.4%**（中位数）；两组范围不重叠（catalog 最高 252K < source 最低 355K）。
- output token 基本相同（10,944 vs 10,943），差异来自 cache read（185,728 vs 431,360）和 uncached input（8,224 vs 20,513）；source 多出 9 个 steps、16 次 tool calls。
- Catalog 的 30 条目录让 5 个任务全部由 6 次 search/get 回答，零源码读取；source 需要读 14 个文件（其中 batch-detail-screen 23.9KB、booking-list-screen 13.8KB、ui.css 28.1KB 等）。
- 两次结果都 15/15。任务 2 的“特殊旅客预订列表”没有专用变体，catalog 与 source 都收敛到 `TravelerBookingListScreen`；catalog 部分任务（错误展示/挂载方式）来自 summary，置信度标为 medium，但答案正确。

## 3. 发现

1. **在更大、更陌生的仓库上，catalog 首次出现明确、幅度很大的 token 收益**：−55.7% 均值、−49.4% 中位数，且两组分布不重叠；这与 bulletproof-react（小且熟悉）上“基本打平”的结论不同，说明收益随仓库规模和检索空间增长。
2. **收益来自步骤/上下文，而不是输出更少**：output token 相同，差异几乎全部是 cache read 和 uncached input；catalog 用 6 次调用/11 steps，source 用 20 steps/29 tool calls。
3. **目录范围不需要覆盖全仓库也能产生收益**：只登记 30 个业务相关组件（约 2% 源文件），就足以回答 5 个跨模块任务；source 却要在 1431 个文件中定位。
4. **代价是细节置信度**：catalog 的 summary/constraint 足以回答“错误如何显示/如何挂载”这类问题，但精确 DOM 结构与挂载位置仍需要 source；catalog 条件将这些标为 medium 是合理的。
5. **setup 成本**：30 条标注产生 31 KB patch、308 个新增行（含 JSDoc 与 2 个 preview）；比 bulletproof 的 857 行小，但仍需安装依赖和生成。按本轮 5 任务节省约 258K tokens 估算，setup 回本很快（约 1 批），但依赖安装/人工选择范围未计入。
6. **任务歧义**：“特殊旅客预订列表”没有专用页面组件；catalog 的 vocabulary/摘要无法凭空创造不存在的变体，最终与 source 一致。目录应记录“没有专用组件”这一事实，而不是强行造 ID。

## 4. 限制

- Catalog 只覆盖选定 30 条，不是全部 519 个候选；未选范围的查询仍需 source。
- 依赖安装（pnpm）体积大，未计入 setup token；测试副本在 `/tmp`，不影响原仓库。
- 只跑了 3 次/条件、5 个任务；catalog 范围选择会影响收益。
- 未验证运行时渲染/交互；只验证类型、生成、audit/check 与查询答案。
- source 条件允许搜索整个 workspace，但实际读取集中在 mobile；这符合“陌生 monorepo”场景。

## 5. 产物

- `trial-config.json`、`catalog.json.gz`、`annotations.patch`
- `raw/catalog/*.json`、`raw/source/*.json`
- `usage/catalog-*.jsonl`
- `runs.json`、`runs.csv`、`summary.json`
- 查询回归：`test/airport-regression.test.mjs`
