# Component Catalog — 面向编码 Agent 的 React/TypeScript 组件发现

[![test](https://github.com/AleFlyX/component-catalog/actions/workflows/test.yml/badge.svg)](https://github.com/AleFlyX/component-catalog/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/@codecantbuild/component-catalog.svg)](https://www.npmjs.com/package/@codecantbuild/component-catalog)
[![license](https://img.shields.io/npm/l/@codecantbuild/component-catalog.svg)](LICENSE)

[English](README.md) · **简体中文**

本地、有界的组件目录 CLI，用于 React/TypeScript 代码库。它从组件声明与就地 JSDoc 生成目录，查询时只返回所需组件的 ID、导入路径、Props、约束和用法，不需要读取整个仓库。

它**不是** UI 文档站、运行时组件库或 MCP 服务，而是围绕一份已保存 JSON 目录的 shell CLI。

| | |
| --- | --- |
| CLI | `0.5.0` |
| Skill revision | `14` |
| Config schema | `2` |
| Catalog schema | `7` |
| Node | `>=22` |
| 唯一运行依赖 | TypeScript `5.9.3` |
| License | [MIT](LICENSE) |

<details>
<summary><b>目录</b></summary>

- [为什么用](#为什么用)
- [安装](#安装)
- [5 分钟上手](#5-分钟上手)
- [查询组件](#查询组件)
- [标记组件](#标记组件)
- [接入 Agent](#接入-agent)
- [大型仓库：`typeScope`](#大型仓库typescope)
- [常见问题](#常见问题)
- [已知限制](#已知限制)
- [开发](#开发)
- [License](#license)

</details>

## 为什么用

编码 Agent 擅长写组件，却在反复重新发现既有设计系统上花费很大。Component Catalog 给它们一份有界、与本项目相关的索引：

- **先找已有组件，避免重复造** —— 按导出名、task tag、词表别名或 Prop 搜索。
- **只取集成所需的事实，不读整个文件** —— ID、导出名、导入路径、必填 Props、约束和引用计数。
- **大型单仓不炸上下文** —— 查询输出有上限；`typeScope: "componentRoots"` 避免载入 server/lib/Prisma 类型图。
- **索引可被验证** —— `audit`、`check`、`verify` 分别覆盖收录决定、新鲜度和代表性查询。

设计的典型检索场景：*React component catalog*、*component discovery for AI agents*、*TypeScript component search*、*find component import path and props*、*bounded codebase context*。

## 安装

已发布到 npmjs registry（公开 scoped 包）：

```bash
npm install @codecantbuild/component-catalog
npx @codecantbuild/component-catalog --version
```

也可以安装 GitHub Release 分发的 tarball，内容与 npm 包一致，不依赖 registry：

```bash
npm install https://github.com/AleFlyX/component-catalog/releases/download/v0.5.0/codecantbuild-component-catalog-0.5.0.tgz
./node_modules/.bin/component-catalog --version
```

CI 在 `v*` tag 上运行测试、校验 tag 与包版本一致、打包并创建 Release；npm 包从主分支手动发布。

## 5 分钟上手

从 checkout 到可查询目录。`examples/basic` 是最小示例，不需要浏览器运行时。

```bash
npm ci
node bin/component-catalog.mjs doctor --installation --expect-version 0.5.0 --expect-skill-revision 14
node bin/component-catalog.mjs scan examples/basic/src --summary
node bin/component-catalog.mjs --config examples/basic/component-catalog.config.json generate
node bin/component-catalog.mjs --config examples/basic/component-catalog.config.json search 按钮
```

`search` 返回一个有界的 JSON 对象，每条结果都标明命中的信号：

```json
{
  "items": [
    {
      "id": "demo.ui.Button",
      "exportName": "Button",
      "importPath": "@demo/ui/Button",
      "layer": "shared",
      "matched": "task",
      "requiredProps": ["label"],
      "tasks": ["button"],
      "status": "stable",
      "reuse": { "scope": "project" }
    }
  ],
  "truncated": false,
  "omitted": { "items": 0, "byLimit": 0, "byBytes": 0 }
}
```

`matched` 是关键字段：`task` 表示命中 task tag，`name` 表示命中 ID 或导出名，`prop` 表示命中 Prop 名，`summary` 只表示这个词在描述里出现过。`summary` 是最弱信号。

需要单个 API 细节时，直接取那个字段，不要取整个组件：

```bash
node bin/component-catalog.mjs --config examples/basic/component-catalog.config.json \
  get demo.ui.Button --prop disabled
```

```json
{
  "component": {
    "id": "demo.ui.Button",
    "importPath": "@demo/ui/Button",
    "constraints": ["Supply a short, actionable label."],
    "prop": {
      "name": "disabled",
      "displayType": "boolean | undefined",
      "required": false,
      "defaultValue": "false",
      "schemaStatus": "complete"
    }
  },
  "selection": { "kind": "prop", "name": "disabled", "partial": true }
}
```

## 查询组件

```bash
component-catalog search "表单" --limit 5
component-catalog search rowKey --details
component-catalog get ui.forms.BusinessForm
component-catalog get ui.forms.BusinessForm ui.forms.CustomerPicker
component-catalog get ui.forms.BusinessForm --prop disabled
component-catalog get ui.forms.BusinessForm --from src/features/orders/Page.tsx
```

让查询既便宜又诚实的规则：

- 先跑一次 `search`。`--details` 已给出 `importPath`、`requiredProps` 和首条约束时，不要再 `get` 确认。
- 只有需要 constraints、示例或完整 Prop 上下文时才 `get`。多个 ID 放在一次 `get`，但不要和 `--prop`/`--from` 组合。
- 混合意图用 `--per-layer 3`；单层目录会把该默认值扩到 5。多层级且同层候选很多时才显式用 `--per-layer 5`。
- `--layer auto` 只适合单意图。混合查询必须返回 `components` 数组覆盖每个角色，缺失角色要显式标记。
- 没有专用组件但同域通用组件可承担角色时，返回通用组件并说明 caveat；只有连通用角色都不存在时才标 `missing`。
- 弱结果或空结果时，换词、用 `--brief` 或 `--limit 10`，或退回 `scan`。不要用猜的 ID 调 `get`。

输出上限：search 4 KiB，`get` 16 KiB。`truncated` 只表示字节裁剪，匹配数超出 limit 看 `omitted.byLimit`。设置 `COMPONENT_CATALOG_LOG=<path>` 可写本地 JSONL 使用日志，日志不记录源码内容。

## 标记组件

```ts
/**
 * 订单模块使用的表单外壳。
 * @componentCatalog
 * @catalogStatus experimental
 * @catalogTask business-form
 * @catalogConstraint 提交状态由调用方管理。
 * @catalogExample production src/features/orders/Form.tsx | 订单表单
 */
export function BusinessForm(props: { disabled?: boolean }) { /* ... */ }
```

- `summary`、`status`、至少一个 task、constraint 和 example 必填。
- `experimental` 可以没有稳定示例；`stable` 需要 production 或 preview 示例。
- 不收录的候选使用 `@componentCatalogIgnore internal|non-component|unsupported: 原因`，不要静默删除标记。
- 新增、修改、移动或删除组件后，运行 `audit → generate → check`。完整生命周期见 [maintenance.md](skills/component-catalog/references/maintenance.md)。

## 接入 Agent

把 [skills/component-catalog](skills/component-catalog/SKILL.md) **整个目录**复制到 Agent 的 skill 位置，不要只复制 `SKILL.md`。该目录包含 CLI、schema、references 与依赖清单。

```bash
npm ci --prefix "<skill-directory>/scripts" --ignore-scripts --no-audit --no-fund
node "<skill-directory>/scripts/bin/component-catalog.mjs" \
  doctor --installation --expect-version 0.5.0 --expect-skill-revision 14
```

skill 按意图分流：普通查询不会加载 setup 流程，缺失配置不等于允许自动初始化。范围不明确时，Agent 先给出候选目录、数量和推荐理由，再询问。

用户日常用中文提问的项目，用 `init --locale zh-CN` 生成模板；summary 与 task tag 始终是英文。`init` 不会猜测语言。

机器可读的项目摘要：[llms.txt](llms.txt)。

## 大型仓库：`typeScope`

在第一次 `generate` 前选定 `typeScope`；它是配置决策，不是查询参数。

| 项目形态 | 使用 |
| --- | --- |
| 小/中型，组件只依赖项目内 UI | `typeScope: "project"`（默认） |
| 大型 monorepo，组件依赖 server/lib/trpc/Prisma 图 | `typeScope: "componentRoots"` |

`componentRoots` 只加载组件根内的类型图，根外导入变为浅层 `any`。本地声明的 Props 仍是完整类型，继承来的可能是 `any`/partial。

完整的处置契约——抑制规则、`typeCheck` 语义和 `suppressedType*` 报告字段——由 [setup.md § Large-repository type scope](skills/component-catalog/references/setup.md#large-repository-type-scope) 唯一持有。生成出现 OOM 时切换 `typeScope` 重新生成，而不是提高 heap，并在交付中说明类型保真度的取舍。

## 常见问题

**这是 Storybook 或组件文档站吗？**

不是。Storybook 是 UI 浏览与文档界面。Component Catalog 是把选定的组件声明转成紧凑 JSON 索引的 CLI，不渲染组件，也不替代运行时检查。

**这是 MCP 服务吗？**

不是。它是一个使用本地文件和有界 JSON 输出的 shell CLI，任何能执行命令的 Agent 或脚本都能调用；不捆绑编辑器扩展或 MCP 传输层。

**能配合 Claude Code、Cursor、Codex 等 Agent 使用吗？**

与 Agent 无关：集成面就是 CLI 加随附的 [SKILL.md](skills/component-catalog/SKILL.md)。具体安装和权限由宿主管理。

**能减少 token 消耗吗？**

本地 airport 基准（5 个任务、3 次运行）中，直接读源码约 **462.8K total tokens**，`catalog-details` 约 **100.2K**，该场景下约少 **78%**。这是 30 条 scoped 目录的本地基准，不是通用保证；setup 成本和任务形态都有影响。基准数据刻意不进入公开仓库。

**会索引整个仓库吗？**

不会。它只索引显式配置的 component roots 内受支持的 JS/JSX/TS/TSX 声明，并要求对候选作出收录决定。路由、页面、不支持的格式和未选中的组件可能被排除；`discovery.status=partial` 表示已声明的缺口。

**查询会修改源码或目录吗？**

不会。`search` 和 `get` 是只读的。`generate` 写目录；`audit`、`check`、`verify` 都不重新生成。

**为什么组件收录了，用中文却搜不到？**

因为收录和词表是两件事。组件一收录就能用英文 task tag 搜到，而日常语言的查询需要一条 `vocabulary` 词条把说法映射到该 tag。`audit` 会在 `discovery.unreachablePrimaryTasks` 报出这类任务；它只是提示，所以不会有任何命令失败。

## 已知限制

- 只扫描 JS/JSX/TS/TSX 的 PascalCase 值导出、default 导出和显式标记的声明。Vue、Svelte、MDX、跨文件 HOC、匿名 default 可能不支持。
- Props 提取依赖 TypeScript。复杂泛型、联合与继承可能为 `partial`/`unsupported`；`any` 或空字段不代表组件没有 Props。
- `typeScope: "componentRoots"` 是内存与类型保真度的显式权衡，不是完整类型检查。
- 组件目录是发现辅助；项目架构、运行时代码和项目自身检查仍是权威。

更完整的安装、配置契约、边界和故障排查见 [setup.md](skills/component-catalog/references/setup.md)。

## 开发

```bash
npm test        # 117 个测试
npm run check   # 语法 + 测试
npm run build   # 打包清单
```

贡献规则、fixture 布局与发布步骤见 [CONTRIBUTING.md](CONTRIBUTING.md)。文档归属与单一事实源见 [AGENTS.md](AGENTS.md)。

跨 Agent 评测方法：[evaluation.md](skills/component-catalog/references/evaluation.md)。具体任务、答案和 fixture 路径不写入 SKILL；评测数据放在已 gitignore 的 `test/audits/`。

## License

[MIT](LICENSE) © 2026 AleFlyX
