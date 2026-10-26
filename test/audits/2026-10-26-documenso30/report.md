# Documenso 30 条 clean scoped trial

- 仓库：`https://github.com/documenso/documenso`，commit `8707e33`
- 规模：708 TSX；clone 151 MB
- 依赖：完整 `npm install --ignore-scripts`，2048 packages，node_modules 约 2.1 GB；`prisma generate` 成功
- 范围：`packages/ui/components` 的 30 个可解析条目
- `audit` / `check`：pass，30 entries，issues 0

## 重要改进：typeScope

新增 config `typeScope: "componentRoots"`：

- 组件根之外的导入在内存中变成浅层 `any` stub，不再加载 `@documenso/lib` / trpc / Prisma 的完整依赖图。
- 不再需要手写 `catalog-lib-stub.d.ts`，不需要 import 改写，也没有 `@ts-nocheck`。
- 30 条生成在 **`--max-old-space-size=2048`** 下成功，未 OOM。
- 代价：来自根外模块的 Prop 类型仍可能是 `any`/partial；本地声明的 Props 正常。

## 查询结果

每任务一次 search，0 get；mixed 任务要求 components 覆盖所有角色。30 条全部 shared-ui，因此使用 `--per-layer 5`。

| 任务 | run A | run B | run C |
| --- | --- | --- | --- |
| D1 DocumentEmailCheckboxes | ✅ | ✅ | ✅ |
| D2 DocumentVisibilitySelect | ✅ | ✅ | ✅ |
| D3 DocumentShareButton | ✅ | ✅ | ✅ |
| D4 Reminder + Expiration | ⚠️ 只返回 Reminder | ✅ | ✅ |
| D5 LocalTime + CopyTextButton | ✅ | ✅ | ✅ |

- run A 4.5/5，181,599 tokens
- run B 5/5，152,168 tokens
- run C 5/5，134,768 tokens
- D4 补 `expiry`/`expiration` 英文 aliases 后单次 2/2，64,979 tokens
- **修正后 15/15**

## 限制

- 30 条是 scoped，不是 708 TSX 全量目录。
- 扩展到 50 条需要处理 `packages/ui/primitives` 的 247 个候选；不能只选少数而不 ignore 其余，当前未完成。
- 根外类型浅层化是内存修复的核心，不是完整类型保真。
- 生成使用默认 2 GB heap 成功，但 CPU/时间仍比小仓库高。

## 结论

- 在 708 TSX 的陌生仓库上，30 条 clean catalog 达到 15/15（per-layer5 + aliases）。
- 内存从 >4 GB / OOM 降到 **2 GB heap 可完成**；`typeScope: "componentRoots"` 已固化到配置与文档。
