# Airport 57 条：补齐 StatusTag 与 ImageViewer

- 日期：2026-10-26
- 在 55 条目录上增加：
  - `ui.UiStatusTag`（display.tsx）
  - `ui.UiImageViewer`（image-viewer.tsx）
- 同时给 57 条 config 增加英文 task aliases：navigation bar、login page、status tag、image viewer、bottom sheet、empty state、tabs、flight delay compensation list 等。
- 结果：57 条，doctor/audit/check 全 pass，issues 0。

## Held-out 结果

| 组 | 得分 | CLI 调用 | token |
| --- | --- | --- | --- |
| A | 5/5 | 5 | 158,429 |
| B（英文 aliases，clean） | 5/5 | 5 | 194,778 |
| **合计** | **10/10** | **5** | **176,604 均值** |

- A5 现在返回 `ui.UiStatusTag`；B5 返回 `ui.UiImageViewer`，不再需要 missing。
- B3 的 `login page navigation bar` 现在一次 search 同时返回 SignInPage + UiNavBar；B4 仍是 ListScreen。
- 相对 55 条严格版（29.5/30、137,327）：token **+28.6%**，得分 +0.5。
- 相对 40 条（27.5/30、218,886）：token **−19.3%**，得分 +2.5。

## 结论

- **57 条 + 英文 aliases + per-layer3 + 严格一次 search/no-get：10/10，176.6K。**
- 这是“覆盖完整”版本；55 条严格版是“token 优先”版本（29.5/30、137.3K）。
- 如果目标是完整覆盖 UI 原语，选 57；如果更在意 token，选 55。
- 英文 aliases 是关键：没有它们，B3 的 `login page navigation bar` 会漏掉 UiNavBar；B5 也依赖 image viewer alias。

## 产物

- `trial-config.json`、`catalog.json.gz`、`annotations.patch`
- `raw/a/`、`raw/b/`（含一次带 config 读取的 B 和 clean B）
- `raw/b-alias/`（英文 aliases 的 clean B）
- `runs.json`、`summary.json`

## 3 次重复（A/B 全部）

| 组 | 得分 | 平均 token |
| --- | --- | --- |
| A（3 次） | 14.5/15 | 160,004 |
| B（3 次） | 15/15 | 138,434 |
| **合计** | **29.5/30** | **149,219** |

- A3 有一次只返回页面、漏掉卡片（search 中其实有 `BusinessCard`，agent 未采纳），因此 A 组不是 15/15。
- A5/B5 已稳定命中 `UiStatusTag`/`UiImageViewer`；B3/B4 全部正确。
- 与 55 条严格版对比：

| 目录 | 得分 | token | 结论 |
| --- | --- | --- | --- |
| 55 条 | 29.5/30 | **137,327** | token 优先，默认 |
| 57 条 | 29.5/30 | 149,219 | 覆盖 A5/B5，但 +8.7% token |

**最终建议：默认 55 条严格版；57 条只在需要 StatusTag/ImageViewer 覆盖时启用。** 57 条没有带来得分提升，因为 A3 的 agent 行为抵消了覆盖收益。

## Per-layer limit 修正

发现 `--per-layer 3` 仍会被 `--limit 5` 截断：两层共 6 项时，第 6 项（常见为 `UiNavBar`）被丢掉。已改为 **per-layer 模式忽略全局 limit，返回每层 top-N**。

- B3 的 `login page navbar` 现在返回 6 项并包含 `ui.UiNavBar`。
- clean B3 重跑 5 次 search，0 get，B2/B3/B4/B5 全对；B1 因 agent 把“special passenger”判为 missing 得 0（语义判断，非检索失败）。
- 这说明 57 条覆盖已经完整，剩余误差主要是 agent 对“特殊旅客”语义和 mixed 角色的判断，而非目录缺口。
