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

## 扩容实验（已完成）

新增 `src/components/ui` 根，只保留 button/form/overlay 三个文件，登记 10 个核心原语，30→40 条：

| 范围 | 30 条 | 40 条 |
| --- | --- | --- |
| in-catalog | 10/10 | 10/10 |
| outside-catalog | 0/10 | **4/10** |
| 合计 | 50% | **70%** |

- 新增覆盖：UiButton、UiInput、UiDialog、UiPopup；仍未覆盖 SearchBar/DatePicker/EmptyState/Tabs/Card/NavBar。
- 3 次 details B：15/15，114,586 / 104,914 tokens，相对 30 条 +14.4% 均值，相对 source 仍 −75.2%。
- 详细结果：[expanded report](../2026-10-26-airport-ui-expanded/report.md)。

## 建议的下一步

- 保留“业务 30 + 核心 UI 10”的 40 条目录，不继续无差别扩到全部 40 个 UI 导出。
- 若要覆盖剩余 6 个查询，优先评估真实 UI 查询比例；这些组件分散在 search/date-picker/feedback/layout/navigation，文件粒度会一次带入多个导出，setup 成本高于 10 条。
- 若继续扩，目标 50–60 条，并同时监控 search 输出字节/截断与 B token。

## 产物

- `queries.json`：20 个查询及期望
- `coverage.json`：30 条目录的逐查询 top-5
- `coverage-expanded.json`：40 条目录的逐查询 top-5
- `coverage-sample.mjs`：可复用工具（`test/audits/tools/`）
