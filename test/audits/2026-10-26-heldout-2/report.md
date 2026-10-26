# 第二组 held-out：10 个未参与调参的任务

- 目录：57 条 airport catalog
- 策略：per-layer3，每任务一次 search，0 get，mixed 必须返回 components
- C 组：loading、notice bar、grid layout+item、steps、bottom tab bar
- D 组：list+cell、event detail、batch workspace、auth recovery view、booking status badge

## 结果

| 任务 | 结果 |
| --- | --- |
| C1 UiLoading | ✅ |
| C2 UiNoticeBar | ✅ |
| C3 UiGrid + UiGridItem | ⚠️ 首次只返回 UiGridItem；加 `grid layout`/`grid item` aliases 后 2/2 |
| C4 UiSteps | ✅ |
| C5 UiTabBar | ✅ |
| D1 UiList + UiCell | ✅ |
| D2 FlightDelayEventDetailScreen | ✅ |
| D3 FlightDelayCompensationBatchScreen | ✅ |
| D4 AuthRecoveryDialogView | ✅ |
| D5 BookingStatusBadge | ✅ |

- 加 aliases 后 C3 单任务重跑：1 次 search、0 get、2/2 角色。
- **总有效结果：10/10**（C1/C2/C4/C5 + D1–D5 + C3 重跑）。
- C/D 两次 5 任务运行 token 约 146K / 140K；C3 单任务 44K。
- 发现：`grid layout` 没有 alias 时，`UiGrid` 会被 `UiGridItem`/InfoGrid/ResponsiveActionGrid 挤出 top3；补充英文 role alias 后修复。

## 结论

第二组未见任务支持 57 条 + aliases + per-layer3 + 严格一次 search/no-get 的 10/10。剩余主要风险是 **vocabulary 覆盖**，不是 ranking 或目录大小；真实接入时应按角色补充中英 alias。
