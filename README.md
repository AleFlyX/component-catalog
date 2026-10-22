# React Component Atlas

本地组件发现 CLI，面向编码 Agent 和开发者。由 TypeScript 声明与就地 JSDoc 生成完整目录，查询时只输出所需组件或单个 Prop。不启动服务，不进入浏览器运行时。

使用 Node >=22、TypeScript 5.9.3（唯一运行依赖）。GitHub 仓库名为 `react-component-atlas`，CLI 和本地包名为 `component-catalog`。尚未发布 npm 包或选择开源许可证。

## 运行

在本工具仓库执行：

```bash
npm ci
node bin/component-catalog.mjs --help
node bin/component-catalog.mjs doctor --installation --expect-version 0.2.0
node bin/component-catalog.mjs scan examples/basic/src
node bin/component-catalog.mjs --config examples/basic/component-catalog.config.json generate
node bin/component-catalog.mjs --config examples/basic/component-catalog.config.json check
node bin/component-catalog.mjs --config examples/basic/component-catalog.config.json search 按钮
node bin/component-catalog.mjs --config examples/basic/component-catalog.config.json get demo.ui.Button --prop disabled
npm run check
npm run build
```

`build` 检查 npm 打包清单；本工具直接运行 ESM，不需要编译。示例 Button 是验证 API 提取的普通 TypeScript 函数，无 UI 运行依赖。

从其他项目调用可使用本地工具入口的绝对路径，或将本仓库作为本地开发依赖安装，再使用 `component-catalog` bin。路径保存在消费方的配置或 package script 中，工具源码不需要修改。不建议以尚未发布的包名直接运行 `npx`。

## 安装、版本与就绪诊断

CLI 与 skill 应来自同一个固定提交或本地安装包。本版为 0.2.0，尚无已发布的 npm 包；请使用明确来源的 checkout，不根据包名自动下载。下面的路径和 commit-sha 需替换为实际选择：

```bash
git clone https://github.com/AleFlyX/react-component-atlas.git <tool-directory>
cd <tool-directory>
git checkout --detach <commit-sha>
npm ci
node bin/component-catalog.mjs --version
node bin/component-catalog.mjs doctor --installation --expect-version 0.2.0
```

工具目录放在消费项目外。可直接用绝对路径调用 CLI；若希望作为开发依赖集成，在工具目录执行 `npm pack --pack-destination <external-directory>`，再在消费项目使用现有包管理器安装这个明确的本地 tarball，例如 `npm install --save-dev <external-directory>/component-catalog-0.2.0.tgz`。同一 checkout 的 skills/component-catalog 整个目录复制到 Agent 支持的 skill 位置。升级时同步更新 CLI 与 skill，不凭空假定存在版本标签。

```bash
component-catalog doctor --installation --expect-version 0.2.0
component-catalog doctor --config ./component-catalog.config.json --expect-version 0.2.0
```

doctor 只读检查 Node、CLI 版本、工具的 TypeScript 依赖，以及项目配置、路径、tsconfig 和静态模块/类型依赖解析。不安装依赖、不执行消费项目脚本、不生成目录。`--installation` 用于尚未配置项目时，不能与 --config 同用；`--expect-version` 为精确版本，不接受范围，用于发现 skill/CLI 混用。

退出码 0 表示已检查项目无失败，1 表示诊断发现问题，2 表示调用无效或命令无法完成。stdout 为最多 8 KiB 的 JSON，超长消息按字段省略并标明 omitted；每项检查的状态始终保留。首次没有目录时 catalog 为 not_run，仍可判定就绪；doctor 通过不表示完成收录、无漂移、所有类型检查通过或日常检查入口已接好。继续执行 audit、generate、check 和项目检查。Node/CLI 本身不存在时须先安装，doctor 无法在进程启动前诊断。

## 第一次接入：用户选范围，AI 完成配置与标记

安装 skill 本身不会执行扫描或修改项目。对 Agent 发起接入任务后，它先只读盘点候选目录，结合实际使用和项目边界推荐公共组件范围。只告诉它“前端在 src”表示扫描位置，不代表页面和业务私有组件都应收录。

范围不明确时，Agent 会先给出目录、数量和推荐理由，再让你选择“推荐公共目录 / 指定子集 / 仅查看扫描”。如果已经明确指定收录目录，它直接执行，不逐组件重复确认。

范围确定后，Agent 负责填写配置、查找真实用例、补充 JSDoc、生成并验证。先验证一个代表组件后会继续完成选定范围，而不是只交付一个演示。缺少依据、不支持或被排除的项目会在交付中列明，结果区分“发现候选、选定范围、实际收录、跳过及待补证据”。CLI 自身不会自动改写源码或赋予公共 API 身份。

可以直接这样发起任务：

> 使用 component-catalog skill。前端在 `src`，先扫描并推荐公共组件范围，给我选择后再接入。

或者范围已经确定：

> 使用 component-catalog skill，把 `src/components` 内符合条件的公共组件接入目录，由你补齐有依据的标记、配置与验证。不要收录 `src/features`；不支持或缺少证据的组件列出原因。

## 无标记扫描

```bash
component-catalog scan ./src --summary
component-catalog scan ./src/components --limit 20
component-catalog scan ./src/components --offset 20 --limit 20
component-catalog scan --help
```

scan 不需要配置、已有目录、组件标记或前端项目依赖，只需要工具自身已安装。先用 --summary 看按第一层子目录汇总的数量（包含后代，`.` 表示根目录直属文件），再对选定目录展开候选名称、相对路径/行号、标记状态、缺失元数据及不支持的声明原因。不生成额外目录文件。

它是启发式盘点：页面、普通函数、对象常量也可能是候选，类、包装函数和重导出可能列为不支持；不能代替公共组件边界判断。`supportedShape` 只表示当前提取器支持该声明形式，`missingMetadata` 只检查字段是否填写，不验证标签值、类型或示例有效性；最终以 generate 的校验为准。未标记候选不会出现在 search/get 中。

scan 默认最多 20 项，上限 50 项，每页最多 8 KiB UTF-8（含换行）。`counts` 为本次扫描范围的计数，unsupported 与 marked/unmarked 可重叠，needsMetadata 表示支持的声明中尚缺必填元数据的候选数；`view` 区分目录汇总和候选详情，`totalItems` 表示当前视图的总项数，`items` 为分页内容。必须沿用同一视图/目录并使用实际返回的 `nextOffset` 继续，不能假定每页恰好有 20 项；null 表示结束。多页扫描期间若源码发生改变，应从 offset 0 重扫。路径相对返回的 `root`，不一定相对项目根。nextStep 根据当前标记状态提示补注释或生成验证，不要求已选范围再次确认。

扫描跳过 `.d.ts`、node_modules、.git 和子级符号链接；不读取目录配置或套用 exclude，所以不接受 --config。想缩小范围时直接指定更窄的目录。JavaScript/Vue 等不在当前扫描范围；返回零候选不表示项目没有组件。

## 配置

`component-catalog init` 只向 stdout 输出 JSON 模板，不创建文件。根据项目实际结构保存为 `component-catalog.config.json`，或用 `--config <path>` 指定其他名称。默认从当前目录向上寻找最近的同名配置；找到但无效时直接报错，不回退到其他项目。

```json
{
  "configVersion": 2,
  "projectRoot": ".",
  "sourceRoot": "src",
  "tsconfig": "tsconfig.json",
  "catalog": "generated/component-catalog.json",
  "componentRoots": [
    { "path": "src/components", "idPrefix": "ui", "importPrefix": "@/components", "layer": "shared", "enrollment": "public" }
  ],
  "exclude": ["src/api/generated"],
  "previewRoots": ["src/previews"],
  "testRoots": ["src/testing"],
  "vocabulary": {
    "表单": { "primary": "business-form", "related": ["query-form"] },
    "按钮": { "primary": "button", "related": [] }
  }
}
```

`projectRoot` 相对配置文件所在目录解析，可以指向其上级目录；其余文件路径相对 projectRoot，必须留在项目内。查询只要求配置与目录存在，支持脱离源码的离线快照。

| 配置 | 含义 |
| --- | --- |
| sourceRoot | 扫描 TS/TSX 声明、示例及使用引用的范围；当前每份配置支持一个源码树 |
| tsconfig | 实际应用的 TypeScript 配置，支持 extends；必须能解析组件依赖和别名 |
| catalog | 唯一完整目录生成产物；显式 generate 会覆盖此文件，请选择专用输出路径 |
| componentRoots | 多个互不重叠的组件审查范围；path 位于 sourceRoot 内，idPrefix 不重复 |
| enrollment | v2 每个根必填 public/review；已确定的公共范围用 public，混合范围用 review，不根据目录名自动认定 |
| importPrefix | 与真实 TS/打包配置一致的模块别名或包子路径，不能以斜杠结尾；不自动创建别名 |
| layer | 项目自己的架构层名称，工具不强制 shared |
| exclude | sourceRoot 内排除的文件或目录路径（不支持 glob）；不能隐藏整个组件根，源码树外无需登记 |
| previewRoots / testRoots | sourceRoot 内自定义预览/测试目录，二者不可重叠；`.test/.spec`、`.stories` 文件名仍识别为测试/故事 |
| vocabulary | 任意语言术语到已有英文任务标签的映射，primary/related 参与排序，不绑定组件 ID |

可选数组和 vocabulary 默认为空；其他字段必填，未知键拒绝。ID 由 `idPrefix + 根内相对目录 + 导出名` 组成，例如 `ui.forms.BusinessForm`。目录分段支持字母开头的字母、数字、下划线和连字符；导出名目前要求 PascalCase。importPath 由 importPrefix 加根内相对文件路径（去扩展名）组成，当前不推导 barrel 导出。

多应用仓库可以每个应用放一份配置，通过 `--config` 明确选择。它不会跨配置合并目录。扫描不递归跟随子目录符号链接；依赖解析由 TypeScript 处理。建议把生成目录放到源码目录外。

## 标记组件

只收录显式 `@componentCatalog` 的公开声明，不自动将所有组件提升为公共 API：

```ts
/**
 * 简短说明组件适用场景。
 * @componentCatalog
 * @catalogStatus stable
 * @catalogTask business-form
 * @catalogConstraint 提交状态由调用方管理。
 * @catalogExample preview src/previews/form.tsx | 最小使用示例
 */
export function BusinessForm(props: { disabled?: boolean }) { /* implementation */ }
```

summary、status、至少一个 task/constraint/example 必填。首个 task 表示主要任务。status 为 experimental/stable/deprecated；stable 必须有 production 或 preview 示例。deprecated 至少提供 `@catalogDeprecatedReason 原因` 或 `@catalogReplacement <id>`：没有继任组件时填写真实弃用原因即可，不虚构替代 ID；原有只填写替代 ID 的注释继续兼容。原因只能用于 deprecated 状态，有替代 ID 时仍检查其存在性和循环。get 始终保留弃用原因与替代 ID，单 Prop 查询也不丢失这些信息。示例路径相对 projectRoot，并且必须在 sourceRoot 内真实引用该导出；kind 可选 production/preview/test/story，需与配置分类一致。

支持命名/default 的顶层具名函数、单个 const 函数表达式，以及成员引用构成的对象 namespace；支持同文件同名 `export { Button }` 导出，注释仍写在声明处。支持直接从 React 导入的 `forwardRef`（含导入别名、React 命名空间）调用，参数必须是内联箭头/函数表达式；Props 从导出的可调用类型提取，保留 ref 与回调中的默认值。当前不支持任意 memo/HOC 组合、第三方组件别名、仅重命名导出的本地声明或匿名 default；会明确报错，不改写运行时代码。泛型类型、继承类型上下文保留为文本，复杂函数/对象/元组的 valueSchema 可能 partial/unsupported，不能当完整 JSON Schema 验证器。示例真实绑定与使用量由静态引用分析判定，不表示浏览器行为验证。

## 新增到删除的维护闭环

在已授权实现任务中，Agent 对 public 范围的新公共组件主动补标记、真实元数据和示例，不逐个询问是否收录。review 范围根据架构和实际用途决定，只有归属无法判断时才询问。CLI 不替 Agent 做公共 API 决策，但会报出所有尚未处理的候选，避免“漏标记 → 没生成 → 漂移检查仍通过”。

不收录的候选用就地注释记录原因，不建立第二份注册表：

```ts
/** @componentCatalogIgnore internal: 仅供父组件内部布局使用 */
export function FieldAdapter() { /* existing implementation */ }
```

类别为 `internal: 原因`、`non-component: 原因`、`unsupported: 原因`。原因不能为空，与 @componentCatalog 互斥；unsupported 表示提取器暂不支持，检查通过也不表示该组件已可检索。工具校验格式，理由是否真实仍需 Agent/开发者审查。不得把已收录组件悄悄改成 ignore 来消除报错。

当原本标记 unsupported 的声明变成可支持形式时，audit/check 报 `IGNORE_REVIEW_REQUIRED`，generate 也会阻止直接跳过。Agent 应重新检查源码与归属，补齐公共组件元数据，或记录真正的私有/非组件理由；不自动删标记或改写理由来绕过。语法形式可支持不保证类型或完整提取成功，其他提取限制仍需具体报告。internal/non-component 的业务归属无法由 CLI 自动判断是否过期。

```bash
component-catalog audit
# 完成标记、元数据和真实示例；确认预期的删除/迁移
component-catalog generate
component-catalog check
```

audit 只读检查完整配置范围的导出候选、收录决定、元数据/示例、替代关系和旧目录中的失效 ID。首次接入允许尚无目录；check 在此基础上还要求目录存在且无漂移。v2 generate 先检查源码决定，再生成；可以修复已确认过时或损坏的快照。Props 变化后重新生成；移动/改名时检查 ID、导入和示例；删除时清理失效替代关系。最后一个组件删除后允许生成空目录，但存在未处理候选时仍失败。

audit/check 默认显示 20 条问题、最多请求 50 条，单页最多 8 KiB UTF-8（含换行）。沿 nextOffset 翻页，status/counts 始终依据全部问题判定；截断或空页不会掩盖失败。错误信息超长时完整省略 message 并列入 omitted.fields。退出码：0 无问题；1 有发现（stdout JSON）；2 参数/配置错误或命令无法完成（stderr）。这两个命令均不修改目录。

`discovery` 单独报告当前源码生成的可检索条目数和 unsupported 排除数：有问题时为 needs-attention，无问题但存在 unsupported 排除时为 partial，否则按生成数量为 available/empty。它不代表磁盘快照已更新，也不替代代表性搜索验证。合法忽略不会导致非零退出，但检查通过不等于接入完成：完整接入还需验证所选范围的常见任务能找到预期组件、提供持久 CLI 入口，并让日常检查实际调用目录 check。只完成试用或部分收录时须明确说明范围，保留源码搜索兜底。

范围是配置根内的 TS/TSX PascalCase 值导出、default 导出和显式标记/忽略声明。别名和星号重导出解析到原声明并去重，纯类型导出不算组件；无法解析、歧义或指向范围外的值导出会报告。JS/Vue 等未支持文件和子级符号链接会报告覆盖缺口，可在确认边界后配置排除。检查不保证识别任意框架、动态导出或小写未标记组件，也不代替项目类型检查和运行测试。

v1 的 search/get/generate 及 generate --check 继续兼容，但不具备新收录审计。迁移时把 configVersion 改为 2，为每个根明确选择 enrollment，再 audit、补齐决定、generate、check；不修改生成目录的 schemaVersion。`init` 默认给出保守的 review 模板。

消费项目可配置以下 scripts，并把 component:check 接入已有日常检查；不要让检查自动生成来掩盖漂移：

```json
{
  "component": "component-catalog --config component-catalog.config.json",
  "component:generate": "component-catalog --config component-catalog.config.json generate",
  "component:check": "component-catalog --config component-catalog.config.json check"
}
```

路径和命令按实际安装位置调整；无需 Git 或额外服务。skill 的[维护流程](skills/component-catalog/references/maintenance.md)包含项目 AGENTS 入口示例、迁移及异常处理。

## 查询与漂移

```bash
component-catalog search "表单" --limit 5
component-catalog search rowKey
component-catalog get ui.forms.BusinessForm
component-catalog get ui.forms.BusinessForm --include props,constraints
component-catalog get ui.forms.BusinessForm --prop disabled
component-catalog generate
component-catalog generate --check
component-catalog check
```

search 默认最多 5 项、上限 10 项，仅返回 ID、导出名、kind、摘要、任务标签和状态。排名为精确 ID/名称、任务、部分 ID/名称、摘要、精确 API 名、部分 API 名；同等级再考虑任务匹配数、主要任务、stable、ID 字典序。NFKC/大小写归一化，空格分词为 OR 匹配，中文等术语通过配置词表支持；不承诺任意自然语言理解。

get 精确匹配 ID，默认返回定位信息、Props 或 namespace members、约束和最多两个示例。`--include` 替换默认详情字段，接受 props/members/constraints/examples/usage。`--prop` 精确且区分大小写地选择单个 Prop，保留泛型/继承上下文和约束，与 --include 互斥；不是完整组件契约。

数据命令的 stdout 为 JSON（--help 和无参数帮助除外）；搜索最多 4 KiB，详情最多 16 KiB，含换行，按 UTF-8 字节计算。响应带 schemaVersion、sourceDigest、truncated、omitted；按完整条目或字段裁剪。单 Prop 的必需上下文无法容纳时失败，不返回误导性残片。字节限制不是 token 实测收益。用 npm/pnpm scripts 调用时加 `--silent`，避免包管理器横幅混入 JSON。

查询不生成、不检查仓库漂移；`generate --check` 重新计算并比较字节，无写入。目录缺失、损坏、参数错误或版本不兼容时 stderr 提示并非零退出。本版生成目录格式 **4**，增加 deprecationReason；查询仍支持 v3 快照。迁移通过重新生成完成，不直接修改版本号。旧版 CLI 无法读取 v4，需与 skill 同步升级；配置版本仍为 1/2。

## Agent skill

将 [skills/component-catalog](skills/component-catalog/SKILL.md) 整个目录复制到消费项目的 `.agents/skills/component-catalog/` 或所用 Agent 支持的 skill 目录。入口提供通用配置、发现和维护工作流。

初次接入可对 Agent 说：

> 使用 component-catalog skill，先只读扫描本项目前端并推荐公共组件范围。选定范围后，由你配置、补齐有依据的注释、生成和验证，完成全部可支持项，并报告未收录原因。不要改变运行时代码来迁就提取器。

已知位置的小修复可以直接读源码；发现公共组件时 search → get → 按需 --prop/源码/示例，常规流程不整体读取 JSON。新增、修改、移动、删除组件时按需加载维护流程，检查收录决定并保持目录更新。项目 AGENTS 指引帮助 Agent 找到 skill，日常 check 负责捕获漏收；仅复制 skill 不能保证所有 Agent 自动调用它。

## 常见接入问题

| 看到的情况 | 下一步 |
| --- | --- |
| 只有 skill，找不到 CLI | 使用本地工具 checkout 或安装明确来源的本地包；skill 不附带独立二进制 |
| doctor 报 cli-version 不匹配 | 从同一固定提交/安装包更新 CLI 和 skill，不修改期望版本来掩盖混用 |
| doctor 报依赖缺失 | 工具依赖在工具安装目录恢复；消费项目模块/类型依赖在消费项目恢复 |
| IGNORE_REVIEW_REQUIRED | 原 unsupported 声明现在有可支持的形式，按真实归属复查决定并补元数据 |
| init 后没有文件 | init 只输出模板；让 Agent 适配路径并保存配置 |
| Config missing | 先 scan 盘点，再配置；已有配置则显式传 --config |
| No @componentCatalog declarations | 仅设置 componentRoots 不会收录；让 Agent 在选定范围补齐真实元数据 |
| UNREGISTERED_COMPONENT / UNREVIEWED_CANDIDATE | Agent 按 public/review 策略补收录或有依据的忽略决定；不要反复 generate |
| STALE_ENTRY / CATALOG_STALE | 检查是否为预期移动、删除或 API 改动，更新引用后 generate，再 check |
| audit/check require configVersion 2 | 为每个根明确 public/review 策略后迁移；旧查询不受影响 |
| Catalog missing / stale | 使用错误中带当前配置路径的 generate 命令；只读任务可报告缺失或查源码 |
| scan 找到但 search 找不到 | scan 是候选；检查是否已标记、生成、位于配置范围，或尝试实际任务标签/导出名 |
| 中文查不到 | vocabulary 需要映射到实际 task 标签；也可先查导出名 |
| namespace 没有 props | 用 --include members,constraints；单 Prop 查询只适用于组件 |
| 不支持的 wrapper/组件别名 | 仅支持直接 React forwardRef 内联回调；其他形式报告未收录原因，保留运行时代码 |

直接运行 CLI 不带参数会显示上手流程；每个子命令支持 `--help`。正常数据输出保持 JSON，错误输出到 stderr 并非零退出。
