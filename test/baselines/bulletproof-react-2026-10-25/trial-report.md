# component-catalog 开源项目实测报告

- 被测项目：`alan2207/bulletproof-react`，应用 `apps/react-vite`（React 18 + TypeScript + Vite，业务域为团队协作：登录/注册、团队、讨论、评论、用户管理）
- 克隆位置：`/tmp/oss-trial/bulletproof-react`（浅克隆，未提交、未推送）
- Skill 版本：CLI 0.3.0，instruction revision 8
- 日期：2026-10-25
- **基线说明：本报告及同目录数据采集于优化前（tool commit `2a9b6c4`），用于后续对比；优化与 A/B 审计结果见 `test/audits/2026-10-25-optimization-a/audit-report.md`。**

## 1. 范围与配置

`apps/react-vite/component-catalog.config.json`（configVersion 2）：

| root | 层 | enrollment | reuse | 条目 |
| --- | --- | --- | --- | --- |
| `src/components/ui` | shared-ui | public | project | 60 |
| `src/features/auth/components` | feature | review | module: auth | 2 |
| `src/features/comments/components` | feature | review | module: comments | 4 |
| `src/features/discussions/components` | feature | review | module: discussions | 5 |
| `src/features/users/components` | feature | review | module: users | 3 |

- `importPrefix` 使用项目真实别名：`@/components/ui`、`@/features/<feature>/components`；`importExtension: omit`
- 未登记布局、页面路由、SEO 与测试目录；路由文件仅作为业务组件的 production 示例
- `catalog: component-catalog.json`（项目根，位于 `src` 外）

## 2. 覆盖与产物

| 指标 | 数值 |
| --- | --- |
| 扫描候选（roots 内） | 122 |
| 已标注条目 | 74（60 shared-ui + 14 feature） |
| `@componentCatalogIgnore` | 48 |
| 不支持但已显式排除 | 15（Radix Root/Trigger/Portal/Close/Group/Sub 等别名、`FormProvider` 别名） |
| 未决定 | 0 |
| 生成条目 | 74 |
| audit / check | pass（issues 0） |
| discovery 状态 | **partial**（存在 15 个 unsupported 排除；searchable 74） |

说明：48 个 ignore 中 33 个是 Storybook story 导出（`non-component`），15 个是外部别名重导出（`unsupported`）。README/SKILL 指引要求对这类声明记录真实原因，而不是删除或隐藏。

## 3. 标注内容

- 每个条目包含：summary、`@componentCatalog`、`@catalogStatus experimental`、至少一个 `@catalogTask`、至少一条 caller obligation 约束、至少一个真实示例。
- 示例来源：8 个 Storybook story 文件、真实页面与业务组件；测试文件未作为示例。
- 9 个无现有消费者的原语（`FormField`、`FormItem`、`FormLabel`、`FormControl`、`FormDescription`、`FormMessage`、`TableFooter`、`TableCaption`、`DropdownMenuShortcut`）没有可用示例；按现有 Storybook 约定补充了 3 个 story（`WithFormField`、`LowLevel`、`WithShortcut`），类型检查与 lint 通过。
- 复合组件的内部组成（`DialogOverlay`、`TableElement`、`PaginationItem` 等）以组合文件本身作为 production 示例；这是真实使用，但对使用者不是最佳示例，报告中列为限制。

## 4. 查询验证

13 个代表查询，期望条目均进入 top 5（位置为 1-based）：

| 查询 | 期望条目 | 位置 |
| --- | --- | --- |
| 按钮 | `ui.button.Button` | 1 |
| 加载中 | `ui.spinner.Spinner` | 1 |
| 确认框 | `ui.dialog.confirmation-dialog.ConfirmationDialog` | 1 |
| 抽屉 | `ui.drawer.DrawerContent` | 1 |
| 下拉菜单 | `ui.dropdown.DropdownMenuContent` | 2 |
| 表格 | `ui.table.Table` | 1 |
| 分页 | `ui.table.TablePagination` | 1 |
| 输入框 | `ui.form.Input` | 1 |
| 登录 | `auth.LoginForm` | 1 |
| 评论 | `comments.CommentsList` | 2 |
| 创建讨论 | `discussions.CreateDiscussion` | 1 |
| 用户列表 | `users.UsersList` | 1 |
| markdown 预览 | `ui.md-preview.MDPreview` | 1 |

其他已验证行为：

- `get ui.button.Button --prop isLoading` 返回单个 Prop 及其 `valueSchema`；`--prop variant`、`--prop onClick`（继承属性）均可用
- `get ui.form.FormDrawer --from src/features/users/components/update-profile.tsx` 可用；项目使用非空 `importPrefix`，`--from` 主要用于相对导入场景
- 从 `/tmp` 以显式 `--config` 执行 search/get 正常；查询前后 catalog 的 sha256 不变（查询不修改快照）
- `search isLoading` 会命中 Button（通过 prop 名），但 **Spinner 排在 Button 前面**，见限制 5

## 5. 工程校验

| 检查 | 结果 |
| --- | --- |
| `doctor --installation --expect-version 0.3.0 --expect-skill-revision 8` | pass |
| `doctor --config ... --expect-version 0.3.0` | pass（catalog 生成后） |
| `pnpm run catalog:check` | pass，exit 0 |
| `pnpm run check`（`tsc --noEmit` + catalog check） | pass，exit 0 |
| `tsc --noEmit` | pass |
| `eslint`（46 个改动源文件） | pass |
| `git diff --check` | pass |
| `vitest run` | 失败：被测项目缺少 env 配置（`src/config/env.ts` 要求 VITE_* 变量），与 catalog 改动无关；因此新增 story 的运行时渲染未验证 |

负向测试（验证日常检查确实生效）：

1. 新建未标注组件 `src/components/ui/tmp-widget/tmp-widget.tsx` → `catalog:check` 返回 `UNREGISTERED_COMPONENT` + `CATALOG_STALE`，exit 1；删除后恢复。
2. 修改 Button summary 但不重新生成 → `CATALOG_STALE`，exit 1；还原并重新 generate 后 pass。

集成产物：

- `apps/react-vite/package.json` 新增 `catalog`、`catalog:generate`、`catalog:check`、`check` 脚本
- `AGENTS.md` 新增 “Component catalog” 短指引，指向 `pnpm run check`
- CLI 入口为当前机器绝对路径（`/home/ccb/component-catalog/...`），属于显式本地试用，不可移植到团队环境；正式接入应改为 devDependency/固定路径

## 6. 成本与体积

| 指标 | 数值 |
| --- | --- |
| 一次性标注改动 | 46 个源文件，+842 / -2 行；121 处 JSDoc 插入 + 1 处手工 |
| 生成 catalog 体积 | **3,929,651 B（约 3.93 MB）**，74 条目 |
| 条目 props 体积 | 2,196,709 B；**46/74 条目 props > 12 KB**（Button 49,708 B，Input 51,415 B，Link 54,879 B） |
| 登记范围源码体积 | 35 个文件，104,440 B |
| 搜索/详情输出上限 | search 4 KiB；scan 8 KiB；get 16 KiB |

## 7. 限制与发现（按影响排序）

1. **大体量组件的 props 在 `get` 中被整体丢弃。** 46/74 个条目继承 `React.*HTMLAttributes`，默认 `get` 超过 16 KiB 后把整个 `props` 字段移除（Button 默认响应仅约 600 B，`truncated: true`，`omitted.fields: ["props"]`）。`--prop` 可精确取单个属性，但 agent 无法一次看到组件自有 API 列表。建议：过滤继承的 DOM 属性、只返回显式声明 + 关键继承项，或返回带计数的 prop 名称索引并支持分页。
2. **search 4 KiB、scan 8 KiB 的输出上限会让分页小于 `--limit`。** `scan src/components --limit 50` 在 8 KiB 限制下每页实际只返回 23–35 个候选，113 个候选需要 4 次调用。这抵消了部分“少读”收益。建议为 scan 返回紧凑的 name/path 列表，或允许更大的结构化分页（优化后已加入 `--brief`，同一组候选 3 次调用、约 16.5 KB）。
3. **Radix/shadcn 风格的别名重导出大量不可登记。** 15/122（12%）为 `const Dialog = DialogPrimitive.Root` 或 `export { FormProvider }` 形式，只能标 `unsupported` ignore；真正的 Radix 组合入口（Dialog/Drawer/DropdownMenu 根）因此不在 catalog 中。建议支持“别名到外部组件”的命名空间成员建模，或在文档中明确该边界。
4. **示例证据存在空档。** 9 个导出原语在仓库内无消费者；复合部件的示例只能是自身组合文件。建议生成器对“示例 == 源文件”给出提示，或在 setup 指引中优先建议 story/test，而不是把内部组合当作最佳示例。
5. **词汇/排序对配置敏感。**
   - `分页` 初始只命中 `Pagination`，`TablePagination` 排在第 8；把 `分页` 的 primary 改为 `table-pagination` 后才排到第 1。
   - `isLoading` 查询 Button 时，因词汇项 `loading` 以子串形式命中查询，Spinner 排在 Button 前（rank 5 vs rank 1）。
   - `创建讨论` 未配置具体短语时先返回 `DiscussionsList`；加入 `创建讨论` 映射后 `CreateDiscussion` 第 1，但 `form-layout` 相关条目也会进入 top 5。
   建议：词汇匹配使用词边界/最长短语优先，并输出排名解释，降低调参成本。
6. **catalog 产物过大（3.93 MB / 74 条）。** 继承的 DOM 事件与 aria 属性占据绝大部分字节，生成、diff、审阅都偏重。建议提供 `--compact`/`--omit-inherited` 生成模式，或按需生成。
7. **运行时验证缺口。** 新增 story 只做了 tsc + eslint 验证；Storybook 未启动，vitest 因项目 env 缺失无法运行。按 skill 要求应披露“运行时行为未验证”。
8. **`reuse` 只是元数据，不是访问控制。** 4 个 feature root 标为 `module` 作用域，但工具不检查调用方；跨模块复用仍需项目架构约束。
9. **忽略标记的位置需要谨慎。** `FormProvider` 的 ignore 加在 `export { ... }` 块上可让 audit 通过，且 74 条生成条目包含全部 Form 组件，未观察到误伤；但这是较宽的锚点，后续应优先支持在导出说明符级别记录决策。

## 8. 复现命令

```bash
# 安装 skill 依赖（已含 typescript 时跳过）
node /home/ccb/component-catalog/skills/component-catalog/scripts/bin/component-catalog.mjs \
  doctor --installation --expect-version 0.3.0 --expect-skill-revision 8

cd /tmp/oss-trial/bulletproof-react/apps/react-vite
pnpm run catalog:generate
pnpm run catalog:check
pnpm run check

# 查询示例
node /home/ccb/component-catalog/skills/component-catalog/scripts/bin/component-catalog.mjs \
  search --config component-catalog.config.json "确认框" --limit 5
node /home/ccb/component-catalog/skills/component-catalog/scripts/bin/component-catalog.mjs \
  get --config component-catalog.config.json ui.button.Button --prop isLoading
```

## 9. 结论

在真实开源业务项目上完成了 setup → 标注 → audit → generate → 查询 → 工程集成 → 负向验证的完整链路：74 个条目可检索，13/13 代表查询命中 top 5，`doctor`/`check`/`tsc`/`eslint` 全部通过，日常 `pnpm run check` 能拦截未登记组件和过期快照。主要短板集中在“大组件详情被截断”“8 KiB 分页导致多次调用”“别名重导出与示例来源不足”“词汇排序需要人工调参”四个方面；这些是工具可用性/成本问题，不影响本次链路成立。
