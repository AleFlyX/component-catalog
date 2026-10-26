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

两步扩容：

| 范围 | 30 条 | 40 条 | 55 条 |
| --- | --- | --- | --- |
| in-catalog | 10/10 | 10/10 | 10/10 |
| outside-catalog | 0/10 | 4/10 | **9/10** |
| 合计 | 50% | 70% | **95%** |

- 40 条新增 UiButton/UiInput/UiDialog/UiPopup；55 条再新增 DatePicker/EmptyState/Tabs/Card/NavBar 等。
- 40 条 3 次 details B：114,586 / 104,914 tokens，相对 30 条 +14.4%。
- 55 条 3 次 details B：**167,283 / 170,475 tokens**，相对 40 条 **+46.0%**；覆盖率 +25pp，但无过滤时 token 代价过高。`--limit 3` 只降到 151,929 / 154,178（−9.2%）。
- **55 条 + `--layer`**：**94,902 / 92,507 tokens**，比 40 条低 17.2%，覆盖率仍 95%；这是当前最佳组合。
- 详细结果：[40 条](../2026-10-26-airport-ui-expanded/report.md)、[55 条](../2026-10-26-airport-ui55-expanded/report.md)。

## 建议的下一步

- **推荐 55 条 + `--layer`**：95% 覆盖、94.9K tokens，是当前最佳组合；feature 任务用 `--layer feature`，原语任务用 `--layer shared-ui`。
- 40 条是 **layer 未知/无法判断时的安全默认**：无过滤 55 条会被 UI 候选放大到 167K。
- 下一步不是继续扩目录，而是验证 layer 判断在更真实任务上的稳定性，以及是否还需要 ID 前缀过滤。

## 产物

- `queries.json`：20 个查询及期望
- `coverage.json`：30 条目录的逐查询 top-5
- `coverage-expanded.json`：40 条目录的逐查询 top-5
- `coverage-55.json`：55 条目录的逐查询 top-5
- `coverage-sample.mjs`：可复用工具（`test/audits/tools/`）
