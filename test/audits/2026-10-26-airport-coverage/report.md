# Airport catalog 覆盖率抽样

- 日期：2026-10-26
- Catalog：airport trial 的 30 条（common 6 + business 11 + auth 3 + flight-delay 7 + bookings 3）
- 项目：`airport-internal-mobile`，扫描 519 个候选：416 unsupported、103 supported/needsMetadata
- 抽样：20 个查询，10 个在 catalog 内、10 个是未登记的 UI primitive（`src/components/ui`，40 个 supported）
- 工具：`test/audits/tools/coverage-sample.mjs`，取 search top-5

## 结果

| 范围 | 查询数 | top-5 命中 | 命中率 |
| --- | --- | --- | --- |
| in-catalog | 10 | 10 | **100%** |
| outside-catalog | 10 | 0 | **0%** |
| 合计 | 20 | 10 | **50%** |

未登记查询全部是 UI primitive：

`UiButton`、`UiInput`、`UiDialog`、`UiSearchBar`、`UiDatePicker`、`UiEmptyState`、`UiTabs`、`UiPopup`、`UiCard`、`UiNavBar`。

## 解读

1. **目录内检索不是瓶颈**：10/10 在 top-5 命中，且其中 9 个排第一；`--details` 后 5 个业务任务全部一次 search 回答。
2. **覆盖率是下一阶段的主要瓶颈**：30 条只占 103 个 supported 候选的 **29.1%**、519 个总候选的 **5.8%**；`src/components/ui` 的 40 个 supported 组件完全未登记。
3. **未登记 UI 原语是高复用、查询频率高的部分**：Button/Input/Dialog/SearchBar/DatePicker/EmptyState/Tabs/Popup/Card/NavBar 都是业务页面常用入口；这类查询目前只能退回 source 或 scan。
4. **不是“越多越好”**：全量 40 个 UI 会显著增加 setup 和 search 输出；建议先扩 top 10，按 coverage sample + B 复测验证边际收益，再决定是否扩到 40。

## 建议的下一步

- 建一个 `src/components/ui` 根，先登记 top 10：Button、Input、Dialog、SearchBar、DatePicker、EmptyState、Tabs、Popup、Card、NavBar。
- 预计条数 30→40，supported 覆盖 29.1%→38.8%；setup 约 10 条 annotation。
- 用同一 20 查询重跑 coverage，目标 outside-catalog 从 0/10 提升到至少 6/10；再跑 3 次 B 观察 search 输出膨胀/截断和 token 是否仍优于 source。
- 若 10 个有效，再评估扩到 40；不要一次性全量标注。

## 产物

- `queries.json`：20 个查询及期望
- `coverage.json`：逐查询 top-5 结果
- `coverage-sample.mjs`：可复用工具（`test/audits/tools/`）
