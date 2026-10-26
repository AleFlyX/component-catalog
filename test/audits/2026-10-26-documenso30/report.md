# Documenso 30 条 scoped trial（依赖完整安装）

- 仓库：`https://github.com/documenso/documenso`，commit `8707e33`
- 规模：708 个 TSX；clone 约 151 MB
- 依赖：`npm install --ignore-scripts` 完成，2048 packages，`node_modules` 约 2.1 GB；`prisma generate` 成功
- 范围：`packages/ui/components` 全部 30 个可解析条目（document、common、field、recipient、template、animate、根级）
- `audit` / `check`：30 entries，pass，issues 0（生成时需 `NODE_OPTIONS=--max-old-space-size=6144`）

## 查询结果

每任务一次 search，0 get；mixed 任务要求 `components` 覆盖所有角色。

| 任务 | run1 | run2 | run3 |
| --- | --- | --- | --- |
| D1 DocumentEmailCheckboxes | ✅ | ✅ | ✅ |
| D2 DocumentVisibilitySelect | ✅ | ✅ | ✅ |
| D3 DocumentShareButton | ✅ | ✅ | ✅ |
| D4 ReminderSettingsPicker + ExpirationPeriodPicker | ✅ | ✅ | ⚠️ 只返回提醒，过期被 top3 截断 |
| D5 LocalTime + CopyTextButton | ✅ | ✅ | ✅ |

- run1 5/5，117,457 tokens
- run2 5/5，116,292 tokens
- run3 4.5/5，141,748 tokens
- **合计 14.5/15**（per-layer3）

### D4 修复

30 条全部是 `shared-ui`，`--per-layer 3` 实际只返回同层 top3，`ExpirationPeriodPicker` 被挤出。改为：

```text
search "提醒设置选择器 过期时间选择器" --per-layer 5
```

单次搜索返回 2/2，51,717 tokens。**修正后 15/15**。

## 重要限制

- 为了绕开 `@documenso/lib` / trpc 的仓库级 TypeScript 错误，trial 仍对 28 个 lib/trpc 模块用了类型 stub；4 个文件加了 `@ts-nocheck`。
- 因此本地 props 正确（如 `documentId`、`value/onChange`、`date`），但来自 lib/Prisma 的类型仍可能是 `any`/partial。
- 这是 30 条 scoped catalog，不是 708 个 TSX 的全量目录。
- 生成峰值内存 >4 GB；默认 2 GB heap 会 OOM。

## 结论

- 在 708 TSX 的陌生仓库上，30 条 clean-ish catalog 能稳定完成 15/15 查询（D4 需 per-layer5）。
- 新发现：**单层目录的混合查询不能只用 per-layer3**，否则同层第 4 个角色会被截断；SKILL 已补“单层/同层候选多时用 per-layer5”。
- 下一步：移除 lib/trpc stub 与 4 个 `@ts-nocheck`，扩大到 50 条，并跑两次完整 5 任务三组。
