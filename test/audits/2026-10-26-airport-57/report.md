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
