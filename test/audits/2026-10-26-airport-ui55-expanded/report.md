# Airport catalog 55 条：覆盖率饱和实验

- 日期：2026-10-26
- 在 40 条目录上继续加入 `date-picker.tsx`、`feedback.tsx`、`layout.tsx`、`navigation.tsx` 的 15 个导出：
  - UiDatePicker、UiLoading、UiEmptyState、UiErrorState、UiNoticeBar
  - UiCard、UiGrid、UiGridItem、UiSpace、UiTabs、UiSteps
  - UiNavBar、UiTabBar、UiList、UiCell
- 结果：**55 条**；doctor/audit/check 全 pass（55 条 issues 0）；catalog 53 KB gzip。
- 仍缺 UiSearchBar（该导出不受当前工具支持），因此 outside-catalog 不是 10/10。

## 1. 覆盖率

| 范围 | 30 条 | 40 条 | 55 条 |
| --- | --- | --- | --- |
| in-catalog | 10/10 | 10/10 | 10/10 |
| outside-catalog | 0/10 | 4/10 | **9/10** |
| 合计 | 50% | 70% | **95%** |

## 2. Token 代价（5 任务 × 3 次，details）

| 目录 | 正确 | CLI 调用 | total tokens 均值 / 中位数 | 范围 | steps | tool calls |
| --- | --- | --- | --- | --- | --- | --- |
| 30 条 | 15/15 | 5 | **100,194 / 87,723** | 78,024–134,834 | 7 | 8 |
| 40 条 | 15/15 | 5.3（5/6/5） | **114,586 / 104,914** | 86,966–151,877 | 8 | 8 |
| 55 条 | 15/15 | 5.3（6/5/5） | **167,283 / 170,475** | 151,672–179,703 | 10 | 9 |
| 55 条 + `--limit 3` | 15/15 | 5.3（6/5/5） | **151,929 / 154,178** | 145,909–155,699 | 10 | 9 |
| 55 条 + `--layer` | 15/15 | 5.3（5/6/5） | **94,902 / 92,507** | 76,435–115,763 | 7 | 8 |

- 相对 40 条：**+46.0% 均值 / +62.5% 中位数**
- 相对 30 条：**+67.0% 均值 / +94.3% 中位数**
- 相对 source：仍低 63.8% 均值 / 57.0% 中位数
- `--limit 3` 回收：167,283 → **151,929**（−9.2%），仍比 40 条高 **+32.6%**，不足以抵消扩容代价
- **`--layer` 才是解法**：167,283 → **94,902**（−43.3% 均值 / −45.7% 中位数），比 40 条还低 **17.2%**，覆盖率保持 95%
- search 输出字节均值 11,838（40 条 10,127，+17%）；output token 9,445（40 条 5,441，+74%）；steps 10 vs 8。

## 3. 结论

- **覆盖率从 70% 提到 95%，但 token 增加 46%**；在这 5 个业务任务上，55 条目录不划算。
- 增加的主要是 UI 原语，业务查询的 search 会带入更多 UI 候选（例如“认证恢复弹窗”同时返回 UiDialog/UiPopup），agent 需要读更多结果/写更长答案；虽然 top-1 仍正确，token 已被上下文放大。
- 之前 40 条的 +14% 已接近可接受边界；55 条无过滤确实越界。
- **但 55 条 + `--layer` 是当前最佳组合**：95% 覆盖率、94,902 / 92,507 tokens，比 40 条低 17.2% / 11.8%，比无过滤 55 条低 43.3% / 45.7%。
- 关键不是“目录不能大”，而是**大目录必须配查询范围**：feature 任务用 `--layer feature`，原语任务用 `--layer shared-ui`。如果 agent 无法判断 layer，40 条仍是安全默认。

## 4. 产物

- `trial-config.json`、`catalog.json.gz`、`annotations.patch`
- `../2026-10-26-airport-mobile/raw/catalog-details-u55/`
- `../2026-10-26-airport-mobile/usage/details-u55-*.jsonl`
- `../2026-10-26-airport-mobile/analysis/details-u55-*`
- `../2026-10-26-airport-coverage/coverage-55.json`
- layer 选择稳定性：[../2026-10-26-airport-layer-selection/report.md](../2026-10-26-airport-layer-selection/report.md)
- `../2026-10-26-airport-mobile/raw/catalog-details-u55-layer/`
- `../2026-10-26-airport-mobile/raw/catalog-details-u55-limit3/`
- `../2026-10-26-airport-mobile/usage/details-u55-layer-*.jsonl`
- `../2026-10-26-airport-mobile/usage/details-u55-limit3-*.jsonl`
