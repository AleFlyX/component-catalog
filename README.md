# Component Catalog

本地 React/TypeScript 组件发现 CLI，面向编码 Agent 和开发者。它从组件声明与就地 JSDoc 生成目录，查询时只返回所需组件或单个 Prop；不启动服务，也不进入浏览器运行时。

- CLI：`0.3.0`
- Skill revision：`10`
- Catalog schema：`7`
- Node：`>=22`
- 唯一运行依赖：TypeScript `5.9.3`

> 本仓库尚未发布 npm 包，也尚未选择开源许可证。请从明确的 git checkout 或本地 tarball 使用，不要按未发布的包名直接 `npx`。

## 快速开始

```bash
npm ci
node bin/component-catalog.mjs doctor --installation --expect-version 0.3.0 --expect-skill-revision 10
node bin/component-catalog.mjs scan examples/basic/src --summary

node bin/component-catalog.mjs --config examples/basic/component-catalog.config.json generate
node bin/component-catalog.mjs --config examples/basic/component-catalog.config.json check
node bin/component-catalog.mjs --config examples/basic/component-catalog.config.json search 按钮
node bin/component-catalog.mjs --config examples/basic/component-catalog.config.json get demo.ui.Button --prop disabled

npm test
```

`npm run build` 检查 npm 打包清单；源码直接以 ESM 运行，不需要编译。`examples/basic` 只用于验证提取 API，不含 UI 运行依赖。

## 接入新项目

1. 只读扫描候选目录：

   ```bash
   component-catalog scan <frontend-directory> --summary
   component-catalog scan <component-directory> --limit 20
   ```

2. 用 `component-catalog init` 生成配置模板，保存为项目内的 `component-catalog.config.json`。
3. 只给选定的公共组件添加 `@componentCatalog` 与必要 JSDoc。
4. 依次运行 `audit → generate → check`，再用代表性任务验证搜索命中。

```bash
component-catalog --config component-catalog.config.json audit
component-catalog --config component-catalog.config.json generate
component-catalog --config component-catalog.config.json check
```

`audit` 检查候选、收录决定、元数据、示例和替代关系；`check` 额外检查生成目录是否漂移。两者都不修改目录。首次接入允许尚无目录，但存在未处理候选时 `generate` 会失败。

目录生成/检查通过后，可以先生成一版自检查询，再补 mixed/missing 场景：

```bash
component-catalog --config component-catalog.config.json verify --suggest > component-catalog.verify.json
```

它会为每个组件生成导出名查询，并为 primary task 唯一的组件生成 task/vocabulary 查询；mixed 和 missing 查询需要人工补。然后运行：

```json
[
  { "scope": "single", "query": "按钮", "expectedId": "ui.Button" },
  { "scope": "mixed", "query": "登录页 顶部导航栏", "expectedIds": ["auth.SignInPage", "ui.UiNavBar"] },
  { "scope": "outside", "query": "图片查看器", "absentIds": ["ui.UiImageViewer"] }
]
```

```bash
component-catalog --config component-catalog.config.json verify --queries component-catalog.verify.json
```

`expectedIds` 必须全部出现在结果中，`absentIds` 必须不出现，`expectNoResults` 要求空结果；返回非零表示有查询未通过。`verify` 只读已保存目录，先运行 `check` 确认它不是旧快照。

### 配置要点

```json
{
  "configVersion": 2,
  "projectRoot": ".",
  "sourceRoot": "src",
  "tsconfig": "tsconfig.json",
  "catalog": "generated/component-catalog.json",
  "typeScope": "project",
  "componentRoots": [
    {
      "path": "src/components",
      "idPrefix": "ui",
      "importPrefix": "@/components",
      "layer": "shared-ui",
      "enrollment": "public",
      "reuse": { "scope": "project" }
    }
  ],
  "vocabulary": {
    "按钮": { "primary": "button", "related": [] }
  }
}
```

- `componentRoots` 必须互不重叠，`idPrefix` 不重复；`enrollment` 在 v2 必填：`public` 或 `review`。
- `vocabulary` 把用户术语映射到已有英文 task tag；中英混合项目应同时覆盖两种写法。
- `typeScope` 默认 `project`；大型单仓见下节。
- 完整字段、示例和边界见 [setup.md](skills/component-catalog/references/setup.md)。

### 大型仓库：`typeScope`

如果组件导入 server/lib/trpc/Prisma 等完整依赖图，`generate` 可能把无关类型全部载入内存：

| 项目 | 使用 |
| --- | --- |
| 小/中型，只依赖项目内 UI | `typeScope: "project"`（默认） |
| 大型 monorepo，依赖服务端/lib 图 | `typeScope: "componentRoots"` |

`componentRoots` 只保留组件根内的类型图，根外导入使用内存内浅层 stub。它把 Documenso 30 条目录的生成从 >4 GB/OOM 降到默认 2 GB heap 可完成。代价是根外继承的 Prop 类型可能为 `any`/partial；本地声明的 Props 不受影响。`generate`、`audit` 和 `check` 会报告 `typeScope`、`typeCheck`、`suppressedTypeDiagnostics` 和可选的 `suppressedTypeCodes`。只会抑制**导入了根外 stub 的文件中的语义诊断**；语法错误、未解析导入以及没有 stub 依赖的文件错误仍然失败。`typeCheck: "partial"` 仍表示不能当作完整类型检查通过。

出现 OOM 时不要用 `--max-old-space-size` 掩盖，也不要添加 `@ts-nocheck`、手写 stub 或改写 import；切换 `typeScope` 后重新 `generate`、`audit`、`check`，并在交付中说明类型范围。

## 查询

```bash
component-catalog search "表单" --limit 5
component-catalog search rowKey --details
component-catalog get ui.forms.BusinessForm
component-catalog get ui.forms.BusinessForm ui.forms.CustomerPicker
component-catalog get ui.forms.BusinessForm --prop disabled
component-catalog get ui.forms.BusinessForm --from src/features/orders/Page.tsx
```

常用规则：

- 先一次 `search`；`--details` 已给出 `importPath`、`requiredProps` 和首条约束时，不要再 `get` 确认。
- 只有需要 constraints、示例、完整 Prop 上下文时才 `get`；多个 ID 可放在一次 `get`，但不要和 `--prop`/`--from` 组合。
- 混合意图用 `--per-layer 3`；单层目录会自动扩到 5。多层级且同层候选很多时才显式用 `--per-layer 5`。
- `--layer auto` 只适合单意图；mixed 查询要求 `components` 数组覆盖每个角色，缺失角色要显式标记。
- 没有专用组件但同域通用组件可承担角色时，返回通用组件并说明 caveat；只有连通用角色都不存在时才 `missing`。
- 空结果或结果不佳时再换词/`--brief`/`--limit 10`/`scan`，不要用无依据的 ID 调 `get`。

输出上限：search 4 KiB，get 16 KiB；`truncated` 只表示字节裁剪，匹配数超出 limit 看 `omitted.byLimit`。设置 `COMPONENT_CATALOG_LOG=<path>` 可写本地 JSONL 使用日志；日志不记录源码内容。

## 标记组件

```ts
/**
 * 简短说明组件适用场景。
 * @componentCatalog
 * @catalogStatus experimental
 * @catalogTask business-form
 * @catalogConstraint 提交状态由调用方管理。
 * @catalogExample production src/features/orders/Form.tsx | 订单表单
 */
export function BusinessForm(props: { disabled?: boolean }) { /* ... */ }
```

- `summary`、`status`、至少一个 task/constraint/example 必填。
- `experimental` 可以没有稳定示例；`stable` 需要 production 或 preview 示例。
- 不收录的候选使用 `@componentCatalogIgnore internal|non-component|unsupported: 原因`，不要静默删除标记。
- 新增、修改、移动或删除组件时，运行 `audit → generate → check`；详细流程见 [maintenance.md](skills/component-catalog/references/maintenance.md)。

## Agent skill

把 [skills/component-catalog](skills/component-catalog/SKILL.md) **整个目录**复制到 Agent 的 skill 位置，不要只复制 SKILL.md。该目录包含 CLI、schema、references 与依赖清单。

```bash
npm ci --prefix "<skill-directory>/scripts" --ignore-scripts --no-audit --no-fund
node "<skill-directory>/scripts/bin/component-catalog.mjs" \
  doctor --installation --expect-version 0.3.0 --expect-skill-revision 10
```

skill 按查询、维护、接入分流：普通查询不需要加载完整 setup 说明；缺失配置不等于允许自动初始化。范围不明确时，先给出候选目录、数量和推荐理由，再让用户选择。

跨 agent/模型评测方法见 [evaluation.md](skills/component-catalog/references/evaluation.md)。具体任务、答案和 fixture 路径不写入 SKILL；测试数据保留在本地 `test/audits/`（已 gitignore）。

## 测试与开发

```bash
npm test
npm run check
npm run build
```

- `test/fixtures/` 只保留最小查询回归 fixture。
- `test/baselines/` 保留开源基线目录。
- `test/audits/`、`docs/optimization-notes.md` 和 `.trial/` 是本地评测/试验材料，不提交到公开仓库。
- 修改查询行为、`typeScope` 或配置字段时，补充对应回归测试并同步 skill/references。

## 已知限制

- 只扫描 JS/JSX/TS/TSX 的 PascalCase 值导出、default 导出和显式目录标记；Vue、Svelte、MDX、跨文件 HOC、匿名 default 等可能不支持。
- Props 提取依赖 TypeScript；复杂泛型/联合类型/继承可能为 partial/unsupported，`any` 或空字段不代表组件没有 Props。
- `typeScope: "componentRoots"` 是内存与类型保真度的显式权衡，不是完整类型检查。
- 组件目录是发现辅助；项目架构、运行时代码和项目自身检查仍是权威。

更完整的安装、配置、边界和故障排查见 [setup.md](skills/component-catalog/references/setup.md)。
