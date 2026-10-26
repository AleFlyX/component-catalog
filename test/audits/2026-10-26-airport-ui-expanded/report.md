# Airport catalog 扩容实验：30 → 40 条

- 日期：2026-10-26
- 在 airport trial 的 30 条业务目录上，新增 `src/components/ui` 根，只保留 `button.tsx`、`form.tsx`、`overlay.tsx` 三个文件，登记其中 10 个核心原语：
  - UiButton、UiIconButton
  - UiInput、UiPasswordInput、UiTextArea、UiForm、UiFormField
  - UiDialog、UiPopup、UiActionSheet
- 其余 UI 文件通过 `exclude` 排除；`ui.contract.test.tsx` 等测试/常量也不进入目录。
- 结果：30 → **40 条**；doctor/audit/check 全 pass（40 条，issues 0）；catalog 50 KB gzip。
- 限制：这是“核心 10”而不是原计划的 10 个名字；受文件粒度限制，选择 button/form/overlay 三个文件才能只新增 10 条。

## 1. 覆盖率变化

| 范围 | 30 条 | 40 条 |
| --- | --- | --- |
| in-catalog | 10/10 | 10/10 |
| outside-catalog | 0/10 | **4/10** |
| 合计 | 50% | **70%** |

新增覆盖：UiButton、UiInput、UiDialog、UiPopup；仍未覆盖：UiSearchBar、UiDatePicker、UiEmptyState、UiTabs、UiCard、UiNavBar。

## 2. Token 变化（5 任务 × 3 次，details 条件）

| 目录 | 正确 | CLI 调用 | total tokens 均值 / 中位数 | 范围 | steps | tool calls |
| --- | --- | --- | --- | --- | --- | --- |
| 30 条 | 15/15 | 5 | **100,194 / 87,723** | 78,024–134,834 | 7 | 8 |
| 40 条 | 15/15 | 5.3（5/6/5） | **114,586 / 104,914** | 86,966–151,877 | 8 | 8 |

- 相对 30 条：均值 **+14.4%**、中位数 **+19.6%**；相对 source 仍低 **75.2% / 73.5%**。
- 40 条的三次 search 输出字节与 30 条基本相同（约 10.1 KB vs 10.7 KB），没有新增截断；token 上升主要来自一次额外的 get 和输出/上下文方差，而不是 search 结果膨胀。
- 5 个业务任务的答案仍全部正确；没有因为 UI 条目引入排序回退。

## 3. 结论

- **+10 条换来 +20pp 覆盖率，代价约 +14% token**；如果 UI 原语查询常见，这个交换是合理的，但仍远优于 source。
- 本次仍未覆盖 SearchBar、DatePicker、EmptyState、Tabs、Card、NavBar；它们分散在 search/date-picker/feedback/layout/navigation 文件里，文件粒度会一次带入多个导出，setup 成本高于 10 条。
- 建议保留“核心 10 + 业务 30”作为可用目录，不继续无差别扩到全部 40 个 UI 导出；下一步先用真实 UI 查询比例判断是否值得扩到 50–60 条。

## 4. 产物

- `trial-config.json`、`catalog.json.gz`、`annotations.patch`
- `../2026-10-26-airport-mobile/raw/catalog-details-ui/`
- `../2026-10-26-airport-mobile/usage/details-ui-*.jsonl`
- `../2026-10-26-airport-mobile/analysis/details-ui-*`
- `../2026-10-26-airport-coverage/coverage-expanded.json`
