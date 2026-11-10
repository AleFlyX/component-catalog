# 仓库协作入口

Component Catalog 是一个面向编码 Agent 的本地 React/TypeScript 组件发现 CLI：从源码 JSDoc 生成目录，查询时只返回所需组件。本文件只说明各文档的**归属边界**与**单一事实源**，不复述具体规则。

## 文档 owner

| 文件 | 读者 | 负责什么 | 不该写什么 |
| --- | --- | --- | --- |
| [`README.md`](README.md) / [`README.zh.md`](README.zh.md) | 人（新用户、评估者） | 为什么用、安装、最小上手、边界声明 | 完整字段契约、维护流程 |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | 贡献者 | 开发环境、测试与 fixture、发布步骤 | 使用说明 |
| [`llms.txt`](llms.txt) | LLM 爬取器 | 一段式定位、快速开始、状态 | 会漂移的计数（测试数） |
| [`skills/component-catalog/SKILL.md`](skills/component-catalog/SKILL.md) | Agent | 工作流路由、查询预算、决策边界 | 单个配置字段的完整契约 |
| [`references/setup.md`](skills/component-catalog/references/setup.md) | Agent（首次配置） | 安装诊断、盘点、范围决策、`typeScope` 完整契约、标注、验收 | 常规查询细则 |
| [`references/maintenance.md`](skills/component-catalog/references/maintenance.md) | Agent（组件变更） | 生命周期决定、词表覆盖检查、验证入口 | 配置字段契约 |
| [`references/evaluation.md`](skills/component-catalog/references/evaluation.md) | 维护者 | 跨模型评测方法 | 具体 benchmark 数据 |

## 单一事实源

- **`typeScope` 的完整契约只在 `references/setup.md`**。README 与 SKILL 只保留决策表和链接；`test/docs.test.mjs` 会拒绝在别处出现 remediation 原文。
- **版本号只在 `package.json`**。README 的两个语言版本、`llms.txt`、SKILL、setup 里的 pin 由 `test/metadata.test.mjs` 断言与它一致。README 的 Development 节会写测试数，升版时需一并更新。
- **配置字段的语义只在 `references/setup.md`**。`lib/config.mjs` 的 `template` 是运行期默认值，不构成文档。
- **训练/评测数据不进仓库**：`docs/` 与 `test/audits/` 已在 `.gitignore` 中整体忽略。

## 改动约定

- 改版本或 revision：同时更新 `package.json`、两个 lock、SKILL frontmatter、`README.md`、`README.zh.md`、`llms.txt`，然后跑 `npm test`（`metadata.test.mjs` 会逐处校验）。
- 改文档结构：跑 `node --test test/docs.test.mjs`。它固定住四条性质——无行内标题、单行不超过 1300 字符、相对链接与锚点存在、`typeScope` 契约不重复。
- 改查询/生成行为：跑 `npm test`，并确认 `search --help`、SKILL、README 描述的是同一个行为。
- 提交前：`npm test` 全绿；文档改动不需要额外证据包。

## 不采用的整理

不额外建 `docs/` 索引、不做目录重命名、不把 `references/` 下的文件合并成大文件——它们按需加载，合并会让无关内容进入上下文。
