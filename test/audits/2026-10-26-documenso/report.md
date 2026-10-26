# Documenso 大型仓库 trial（scoped）

- 仓库：`https://github.com/documenso/documenso`，commit `8707e33`
- 规模：clone 151 MB；`apps`+`packages` 共 708 个 TSX
- 范围：`packages/ui/components/document`（14）+ `packages/ui/components/common`（3），共 17 个 shared-ui 条目
- 生成结果：audit/check pass，17 entries，issues 0

## 查询 smoke test

5 个任务、每任务一次 search、0 get、mixed 任务返回 components：

| 任务 | 结果 |
| --- | --- |
| D1 DocumentEmailCheckboxes | ✅ |
| D2 DocumentVisibilitySelect | ✅ |
| D3 DocumentShareButton | ✅ |
| D4 ReminderSettingsPicker + ExpirationPeriodPicker | ✅ 2/2 |
| D5 LocalTime + CopyTextButton | ✅ 2/2 |

- 5/5，5 次 search，117,048 tokens
- 查询命中率 100%，无需第二搜索或 get

## 重要限制

这次不是“干净的大型仓库全量 setup”：

- `npm install` 在 tmpfs 上长时间停滞，node_modules 只到约 1 GB；为完成类型提取，trial 使用了 **stub 外部模块 + @ts-nocheck + 包路径改写**。
- 因此 `requiredProps` 中来自 `@documenso/lib`/Prisma 的类型多为 `any`/partial；对于纯本地 props 仍正确（如 CopyTextButton.value、DocumentShareButton.documentId）。
- 示例统一指向 trial-only `catalog-examples.tsx`，不是真实业务页面。
- 17 条是**有意收窄的范围**，不代表 Documenso 全部 708 个 TSX 或全部组件。

## 结论

- 在 708 TSX 的陌生仓库上，17 条 scoped catalog 可以 5/5 完成文档/共享 UI 查询。
- 但不能据此宣称“Documenso 全量 setup 成功”；需要先解决 npm install/磁盘/依赖，再移除 stubs 与 import 改写，扩大到 30–50 条并跑 3 次。
