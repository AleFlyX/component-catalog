# Component Catalog

本地组件发现 CLI，面向编码 Agent 和开发者。由 JavaScript/TypeScript 声明与就地 JSDoc 生成完整目录，查询时只输出所需组件或单个 Prop。不启动服务，不进入浏览器运行时。

使用 Node >=22、TypeScript 5.9.3（唯一运行依赖）。GitHub 仓库名、CLI 和本地包名均为 `component-catalog`。尚未发布 npm 包或选择开源许可证。

## 运行

在本工具仓库执行：

```bash
npm ci
node bin/component-catalog.mjs --help
node bin/component-catalog.mjs doctor --installation --expect-version 0.3.0
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

当前 CLI 为 0.3.0，skill 修订号为 8，生成目录格式为 v7。这三者分别标识程序、Agent 指引和数据格式；改交互指引不需要升级目录格式。用下面的命令检查当前入口配套的指引：

```bash
node "<skill-directory>/scripts/bin/component-catalog.mjs" doctor --installation --expect-version 0.3.0 --expect-skill-revision 9
```

`--version` 和 doctor 输出 `skillRevision`。缺失/不匹配时重新安装目标固定来源的完整 skill；旧 CLI 不认识该参数也意味着需要核对安装，不能去掉检查后声称新旧一致。doctor 只检查该可执行入口旁的 SKILL.md，不扫描其他安装副本，也不验证内容哈希。维护者修改行为指引时递增 SKILL.md frontmatter 的 metadata.revision，并同步其期望值和回归测试。

### 只安装 skill（推荐给 Agent 用户）

向 Agent 提供仓库 URL 时，明确安装其中的 `skills/component-catalog` **整个目录**，不要只下载 SKILL.md。该目录已经包含唯一一份 CLI 运行实现、schema 和固定依赖的安装清单，无需另拉完整工具仓库。安装器必须支持复制目录内的 scripts/references；仓库 URL 本身不保证所有客户端采用相同安装流程。

安装到所用 Agent 支持的 skill 位置后，使用实际绝对路径（下方占位路径需替换）：

```bash
npm ci --prefix "<skill-directory>/scripts" --ignore-scripts --no-audit --no-fund
node "<skill-directory>/scripts/bin/component-catalog.mjs" doctor --installation --expect-version 0.3.0
node "<skill-directory>/scripts/bin/component-catalog.mjs" scan "<frontend-directory>" --summary
```

需要 Node >=22，以及 npm registry 网络或已有 npm 缓存。依赖安装在 skill 自己的 scripts/node_modules 内，不写入业务项目的 package.json；扫描、配置、收录仍按用户请求执行。已有安装可先运行 doctor，通过后无需重复安装。升级时整体替换为同一版本的 skill 并重新校验依赖，不混用新 Markdown 与旧脚本。

仓库根 `bin/component-catalog.mjs` 仅转发到 skill 内实现，不维护两套提取器。`test/` 保留在 GitHub 供维护者回归验证，位于 skill 目录外；npm 包也通过 files 白名单排除测试和内部试验材料。完整 git clone 包含测试是正常的，无需让 Agent 删除测试；只安装 skill 时无需复制它们。复制本地已使用的 skill 时排除 node_modules。

### 完整 CLI 仓库或本地包

CLI 与 skill 应来自同一个固定提交或本地安装包。本版为 0.3.0，尚无已发布的 npm 包；请使用明确来源的 checkout，不根据包名自动下载。下面的路径和 commit-sha 需替换为实际选择：

```bash
git clone https://github.com/AleFlyX/component-catalog.git <tool-directory>
cd <tool-directory>
git checkout --detach <commit-sha>
npm ci
node bin/component-catalog.mjs --version
node bin/component-catalog.mjs doctor --installation --expect-version 0.3.0
```

工具目录放在消费项目外。可直接用绝对路径调用 CLI；若希望作为开发依赖集成，在工具目录执行 `npm pack --pack-destination <external-directory>`，再在消费项目使用现有包管理器安装这个明确的本地 tarball，例如 `npm install --save-dev <external-directory>/component-catalog-0.3.0.tgz`。同一 checkout 的 skills/component-catalog 整个目录复制到 Agent 支持的 skill 位置。升级时同步更新 CLI 与 skill，不凭空假定存在版本标签。

```bash
component-catalog doctor --installation --expect-version 0.3.0
component-catalog doctor --config ./component-catalog.config.json --expect-version 0.3.0
```

doctor 只读检查 Node、CLI 版本、工具的 TypeScript 依赖，以及项目配置、路径、tsconfig 和静态模块/类型依赖解析。不安装依赖、不执行消费项目脚本、不生成目录。`--installation` 用于尚未配置项目时，不能与 --config 同用；`--expect-version` 为精确版本，不接受范围，用于发现 skill/CLI 混用。

退出码 0 表示已检查项目无失败，1 表示诊断发现问题，2 表示调用无效或命令无法完成。stdout 为最多 8 KiB 的 JSON，超长消息按字段省略并标明 omitted；每项检查的状态始终保留。首次没有目录时 catalog 为 not_run，仍可判定就绪；doctor 通过不表示完成收录、无漂移、所有类型检查通过或日常检查入口已接好。继续执行 audit、generate、check 和项目检查。Node/CLI 本身不存在时须先安装，doctor 无法在进程启动前诊断。

## 第一次接入：用户选范围，AI 完成配置与标记

安装 skill 本身不会执行扫描或修改项目。对 Agent 发起接入任务后，它先只读盘点候选目录，结合实际使用和项目边界推荐公共组件范围。只告诉它“前端在 src”表示扫描位置，不代表页面和业务私有组件都应收录。

接入验收包含用户选定范围、最多十个代表性任务的前五命中结果、持久命令与日常检查入口。Agent 按实际收录类别补齐项目词表，不仅保留按钮示例。暂无调用者不能作为 internal 忽略理由；缺少示例应补证据或报告待完成。没有项目成熟度依据的新条目使用 experimental，已有调用不直接等于 stable。完整工具 checkout 默认放在业务项目外；已有重复副本先核对引用和本地修改，不自动清理。

需要用户决定范围时，skill 优先使用客户端当前模式支持的选项式提问工具；支持异步提问时，等待期间继续独立的只读检查，收到答案后再执行依赖该选择的配置和标注。业务目录可选择“公共 UI + 可复用业务组件（保留模块边界）”，不等于把整个目录设为全局公共。已有明确选择不会重复确认。选项框是客户端能力，skill 不强行切换计划模式；工具不可用时退回简短编号选项，不把默认选中、超时或未回复当作同意。

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
component-catalog scan ./src/components --brief --limit 50
component-catalog scan ./src --query "Dialog" --limit 20
component-catalog scan --help
```

scan 不需要配置、已有目录、组件标记或前端项目依赖，只需要工具自身已安装。先用 --summary 看按第一层子目录汇总的数量（包含后代，`.` 表示根目录直属文件），再对选定目录展开候选名称、相对路径/行号、标记状态、缺失元数据及不支持的声明原因。不生成额外目录文件。

目录搜索无结果、结果不适合任务或候选被截断时，可先换词或使用 `search --limit 10`，再用 `scan <相关源码目录> --query <词>` 定向发现未收录候选。`--query` 对导出名、路径、JSDoc 摘要和任务标签做 NFKC 规范化、不区分大小写的字面子串匹配，空白分隔的词须全部命中（可命中不同字段），不是正则或自然语言搜索。精确导出名优先，其次名称、任务标签、摘要、路径；同分按路径、行号、名称排序。中文没有额外词表展开，可查源码中的中文说明，或由 Agent 根据项目转换成英文名称／标签。与 `--summary` 互斥；scan 不接受 `--config`，需要使用不注入配置参数的 CLI 入口。

筛选响应的 `matchingCandidates` 和分页只表示匹配项，`counts` 仍表示本次目录扫描的完整计数，`matchedFields` 解释匹配字段。`marked` 只表示存在注释，不证明已生成有效目录条目；未标记、缺文档、被忽略及不支持的声明都可以作为发现线索。先读源码及真实消费者，核对模块边界，不把候选名称伪造成目录 ID，也不因为查到了就自动收录。查询仅减少返回内容，不减少对指定目录的扫描；应选相关目录，而非默认扫描整个仓库。私有声明、export-star 和其他源文件格式仍需源码搜索兜底，不能声称扫描结果覆盖全部组件。

它是启发式盘点：页面、普通函数、对象常量也可能是候选，类、包装函数和重导出可能列为不支持；不能代替公共组件边界判断。`supportedShape` 只表示当前提取器支持该声明形式，`missingMetadata` 只检查字段是否填写，不验证标签值、类型或示例有效性；最终以 generate 的校验为准。未标记候选不会出现在 search/get 中。

scan 默认最多 20 项，上限 50 项，每页最多 8 KiB UTF-8（含换行）。`--brief` 只返回 `exportName`、`sourcePath`、`line`、`marked`、`supportedShape`（以及 `ignored`），省略元数据细节、shape 原因和 ignore 原因，因此同样的字节上限通常能放下完整的一页 50 项；它适合先分页拿全候选清单，再对少数候选读取详情。`counts` 为本次扫描范围的计数，unsupported 与 marked/unmarked 可重叠，needsMetadata 表示支持的声明中尚缺必填元数据的候选数；`view` 区分目录汇总和候选详情，`totalItems` 表示当前视图的总项数，`items` 为分页内容。必须沿用同一视图/目录并使用实际返回的 `nextOffset` 继续，不能假定每页恰好有 20 项；null 表示结束。多页扫描期间若源码发生改变，应从 offset 0 重扫。路径相对返回的 `root`，不一定相对项目根。nextStep 根据当前标记状态提示补注释或生成验证，不要求已选范围再次确认。

扫描支持 `.js/.jsx/.ts/.tsx`，跳过 `.d.ts`、node_modules、.git 和子级符号链接；不读取目录配置或套用 exclude，所以不接受 --config。想缩小范围时直接指定更窄的目录。Vue、Svelte、MDX 等不在当前扫描范围；返回零候选不表示项目没有组件。

## 配置

`component-catalog init` 只向 stdout 输出 JSON 模板，不创建文件。根据项目实际结构保存为 `component-catalog.config.json`，或用 `--config <path>` 指定其他名称。默认从当前目录向上寻找最近的同名配置；找到但无效时直接报错，不回退到其他项目。

```json
{
  "configVersion": 2,
  "projectRoot": ".",
  "sourceRoot": "src",
  "tsconfig": "tsconfig.json",
  "catalog": "generated/component-catalog.json",
  "importPathStyle": "direct",
  "componentRoots": [
    { "path": "src/components", "idPrefix": "ui", "importPrefix": null, "layer": "shared", "enrollment": "public" }
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
| sourceRoot | 扫描 JS/JSX/TS/TSX 声明、示例及使用引用的范围；当前每份配置支持一个源码树 |
| tsconfig | 实际应用的 tsconfig/jsconfig 或目录专用编译配置，支持 extends；必须能解析组件依赖和别名 |
| catalog | 唯一完整目录生成产物；显式 generate 会覆盖此文件，请选择专用输出路径 |
| componentRoots | 多个互不重叠的组件审查范围；path 位于 sourceRoot 内，idPrefix 不重复 |
| enrollment | v2 每个根必填 public/review；已确定的公共范围用 public，混合范围用 review，不根据目录名自动认定 |
| importPrefix | 真实模块别名/包子路径（不能以斜杠结尾），或 null 表示相对调用文件导入；init 默认 null，不创建运行时别名 |
| importExtension | 可选：omit（默认，去掉扩展名）、js（按编译配置使用输出后缀，通常为 .js；jsx: preserve 的 JSX/TSX 为 .jsx）、preserve（保留源码后缀） |
| importPathStyle | 可选：direct（默认，指向组件文件）或 barrel（优先使用组件根内真实 index.* 目录入口，例如 `@/components/ui/form`；仅当该入口确实导出该组件时） |
| layer | 项目自己的架构层名称，工具不强制 shared |
| exclude | sourceRoot 内排除的文件或目录路径（不支持 glob）；不能隐藏整个组件根，源码树外无需登记 |
| previewRoots / testRoots | sourceRoot 内自定义预览/测试目录，二者不可重叠；`.test/.spec`、`.stories` 文件名仍识别为测试/故事 |
| vocabulary | 任意语言术语到已有英文任务标签的映射，primary/related 参与排序，不绑定组件 ID |

可选数组和 vocabulary 默认为空；字段按表中约定填写，未知键拒绝。ID 由 `idPrefix + 根内相对目录 + 导出名` 组成，例如 `ui.forms.BusinessForm`。目录分段支持字母开头的字母、数字、下划线和连字符；导出名目前要求 PascalCase。模块 importPath 默认由 importPrefix 加根内相对文件路径组成，后缀由 importExtension 控制；设置 importPathStyle: "barrel" 时优先使用根内真实 index.* 入口（barrel），入口解析仍由生成校验，不会凭空创建别名。相对模式保存 importPath: null，查询时通过 --from 指定调用文件。

生成时会从已记录示例的位置，按编译配置和示例的静态/动态导入条件解析建议路径，确保该入口导出同一个组件；已有别名或包子路径可以指向转导出文件。不存在或指错目标的别名会失败，不覆盖旧目录。NodeNext ESM 项目常用 importExtension: js；显式 TS 导入需要 allowImportingTsExtensions，或相对导入配合 rewriteRelativeImportExtensions。查询记录的后缀来自生成时的配置，不会实时读取编译选项。验证不覆盖任意调用位置、发布后的包产物或自定义运行时加载器，仍需在真实调用处执行项目检查。

多应用仓库可以每个应用放一份配置，通过 `--config` 明确选择。它不会跨配置合并目录。扫描不递归跟随子目录符号链接；依赖解析由 TypeScript 处理。建议把生成目录放到源码目录外。

Vite 等项目可能使用 `files: []` 加 references 的根配置：应选择真正负责当前源码的 `tsconfig.app.json`，根配置不会继承子配置的 aliases/JSX 设置。CLI 会对此给出明确诊断，不自动猜测所属应用。composite 配置保留完整源码程序的文件集合，避免缩小提取范围造成 TS6307；因此相关诊断可能涉及组件目录以外的应用源码。

JS/JSX 收录需要有效的 `allowJs: true`（jsconfig 默认开启）。可把 `tsconfig` 指向现有 `jsconfig.json`，或在不改变应用编译策略的前提下创建目录专用配置，继承现有配置并开启 allowJs。没有编译配置的纯 JS 项目也可以为目录单独创建，按实际构建器选择 JSX 与模块解析设置。CLI 只分析，始终使用 noEmit，不写入编译产物，不要求迁移源码到 TS。

Props 复用已有 JSDoc `@param/@typedef/@type`、导入类型和 TypeScript 推断。未声明类型可能保留 any/unknown；单字段 schemaStatus 为 partial/unsupported 时不能当成完整 API 契约，空字段列表也不代表不接受 Props。提取解构默认值，不自动解析运行时 propTypes/defaultProps。checkJs: false 下的目录检查不等于完整 JavaScript 类型检查，应保留项目自己的 lint/tests。

关闭 checkJs 也会检查静态 ESM/import() 依赖和星号重导出歧义；构建器提供的模块需要对应的类型声明或配置。当前 CommonJS 导出会报告 `UNSUPPORTED_COMMONJS`，不会把 `module.exports/exports` 当成零组件通过。应如实报告这一覆盖缺口，不为工具改写模块语法或排除可复用组件来消除问题。

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

summary、status、至少一个 task/constraint/example 必填。首个 task 表示主要任务。可选的单个 `@catalogReuse project|unspecified|module:<owner>` 覆盖所在根的复用边界。status 为 experimental/stable/deprecated；stable 必须有 production 或 preview 示例。deprecated 至少提供 `@catalogDeprecatedReason 原因` 或 `@catalogReplacement <id>`：没有继任组件时填写真实弃用原因即可，不虚构替代 ID；原有只填写替代 ID 的注释继续兼容。原因只能用于 deprecated 状态，有替代 ID 时仍检查其存在性和循环。get 始终保留弃用原因、替代 ID 和复用边界，单 Prop 查询也不丢失这些信息。示例路径相对 projectRoot，并且必须在 sourceRoot 内真实引用该导出；kind 可选 production/preview/test/story，需与配置分类一致。

支持命名/default 的顶层具名函数、单个 const 函数表达式，以及成员引用构成的对象 namespace；支持同文件同名 `export { Button }` 和单独的 `export default Button`，注释仍写在声明处。仅默认导出的条目使用声明名组成 ID/exportName，并返回 exportKind: default；同时存在同名 named 导出时优先使用 named API。

直接从 React 导入的 forwardRef/memo 支持内联回调或同文件函数/const 渲染函数引用，包括 `memo(Button)`、`memo(forwardRef(...))` 和嵌套 memo，保留导入别名、命名空间及比较函数。`export default memo(Button)`、`export default memo(function Button() {...})` 的 metadata 写在默认导出语句上，ID 使用引用声明或内联函数的名字；内部渲染函数与包装后的公开值分别处理。支持结果上的 `as typeof Button`、satisfies 等类型表达式。Props 与泛型上下文以公开可调用类型为准，默认值取自解析到的渲染函数，不改写运行时代码。

当前仍不支持跨文件渲染函数引用、任意 HOC 组合、第三方组件别名、仅重命名导出的本地声明或匿名 default；会明确报告，并保留源码发现途径。泛型类型、继承类型上下文保留为文本，复杂函数/对象/元组的 valueSchema 可能 partial/unsupported，不能当完整 JSON Schema 验证器。示例真实绑定与使用量由静态引用分析判定，不表示浏览器行为验证。

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

范围是配置根内的 JS/JSX/TS/TSX PascalCase 值导出、default 导出和显式标记/忽略声明。别名和星号重导出解析到原声明并去重，纯类型导出不算组件；无法解析、歧义或指向范围外的值导出会报告。Vue、Svelte、MDX 等未支持文件和子级符号链接会报告覆盖缺口，不应通过排除可复用组件掩盖限制。检查不保证识别任意框架、动态导出或小写未标记组件，也不代替项目类型检查和运行测试。

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
component-catalog get ui.forms.BusinessForm ui.forms.CustomerPicker ui.forms.AmountInput
component-catalog get ui.forms.BusinessForm --include props,constraints
component-catalog get ui.forms.BusinessForm --prop disabled
component-catalog get ui.forms.BusinessForm --from src/features/orders/Page.tsx
component-catalog generate
component-catalog generate --check
component-catalog check
```

search 默认最多 5 项、上限 10 项，返回 ID、导出名、kind、`importPath`、`layer`、`requiredProps`（组件才有的必填 Prop 名数组）、摘要、任务标签和状态。`--brief` 省略摘要以在 4 KiB 内放入更多候选，适合先做宽泛发现；`--details` 增加第一条约束和 usage 计数，用于避免只为约束/使用次数再 get 一次；`--layer` 只返回指定 layer 的条目，适合在共享 UI 与 feature 组件混合的大目录中缩小范围；`--layer auto` 用排名第一的结果推断 layer，避免手工猜层；`--layer-fallback` 在该层无匹配时自动退回全目录，并在响应中标记 `layerFallback: true`。`truncated` 只表示响应因 4 KiB 字节上限丢弃了字段/条目；匹配数超过 `--limit` 时 `truncated` 为 false，`omitted.byLimit` 给出更多匹配数，`omitted.byBytes` 给出字节裁剪数。常见查找可只用 search 回答“导入路径 + 必填 props”，不必再 get。排名为精确 ID/名称、任务、部分 ID/名称、摘要、精确 API 名、部分 API 名；同等级再考虑任务匹配数、主要任务、stable、ID 字典序。NFKC/大小写归一化，空格分词为 OR 匹配，中文等术语通过配置词表支持；不承诺任意自然语言理解。

get 接受 1–5 个精确 ID；单个 ID 保持原有 `component` 响应，多个 ID 返回 `components` 数组并在 16 KiB 总预算内独立压缩、必要时从尾部丢弃并计入 `omitted.components`。多个 ID 不能与 `--prop`/`--from` 组合；`--include` 对所有条目生效。单 ID 默认返回定位信息、Props 或 namespace members、约束和最多两个示例。`--include` 替换默认详情字段，接受 props/members/constraints/examples/usage。`--prop` 精确且区分大小写地选择单个 Prop，保留泛型/继承上下文和约束，与 --include 互斥；不是完整组件契约。继承大量 DOM 属性的组件（例如 `React.ButtonHTMLAttributes`）可能使完整 props 超出 16 KiB；默认响应此时给出很小的 `propsSummary`（`total`、`inheritedTypes`、提示），并把 `props` 记入 `omitted.fields`；显式 `--include props` 时返回 `propIndex`（`names` 全部 Prop 名、`required` 必填名、`total`、inheritedTypes 的紧凑索引），若仍放不下则退化为 `propsOmitted`。按需用 `--prop` 取单个属性，或用 `--include constraints` 避开属性列表。`propIndex` 不是完整类型契约，读源码才能确认继承类型的细节。

相对模式下，不传 --from 时 importPath 为 null；传入相对 projectRoot 的调用文件后，返回例如 `../../components/forms/BusinessForm`，并用 importContext 保留调用位置和后缀规则。调用文件可以尚未创建，路径不以当前 shell 目录为基准。查询只按快照计算，不读取源码、检查新鲜度或验证跨模块权限。模块别名模式不会被 --from 改成相对路径；使用默认导出还是 named 导出由 exportKind 决定。

数据命令的 stdout 为 JSON（--help 和无参数帮助除外）；搜索最多 4 KiB，详情最多 16 KiB，含换行，按 UTF-8 字节计算。响应带 schemaVersion、sourceDigest、truncated、omitted；按完整条目或字段裁剪。单 Prop 的必需上下文无法容纳时失败，不返回误导性残片。字节限制不是 token 实测收益。用 npm/pnpm scripts 调用时加 `--silent`，避免包管理器横幅混入 JSON。

设置 `COMPONENT_CATALOG_LOG=<path>` 可开启本地、仅追加的 JSONL 使用审计：每次命令成功时记录时间、命令、查询/ID/目录、`outputBytes`、`durationMs`、`status`、`truncated`、`omitted` 以及 limit/offset/include/prop/from/brief/details/layer 等选项；失败时保留 command、task、arguments、options 和 error；search 记录 `resultIds`，get 记录 `componentIds`，可选的 `COMPONENT_CATALOG_TASK` 会写入 `task` 标签。它不记录源码内容，不改变 stdout，也不联网；日志写入失败会被忽略，不能作为安全审计或计费依据。未设置该环境变量时 CLI 不产生任何日志。

查询不生成、不检查仓库漂移；`generate --check` 重新计算并比较字节，无写入。目录缺失、损坏、参数错误或版本不兼容时 stderr 提示并非零退出。本版生成目录格式 **7**，支持可为空的 importPath、importExtension、JS/JSX 路径及 reuse/deprecationReason；查询仍支持 v3/v4/v5/v6 快照，其中 v3/v4 的复用范围显示为 unspecified。迁移通过重新生成完成，不直接修改版本号。旧版 CLI 无法读取 v7，需与 skill 同步升级；配置版本仍为 1/2。

## Agent skill

将 [skills/component-catalog](skills/component-catalog/SKILL.md) 整个目录复制到消费项目的 `.agents/skills/component-catalog/` 或所用 Agent 支持的 skill 目录。入口提供通用配置、发现和维护工作流。

初次接入可对 Agent 说：

> 使用 component-catalog skill，先只读扫描本项目前端并推荐公共组件范围。选定范围后，由你配置、补齐有依据的注释、生成和验证，完成全部可支持项，并报告未收录原因。不要改变运行时代码来迁就提取器。

已知位置的小修复可以直接读源码；发现公共组件时 search → get → 按需 --prop/源码/示例，常规流程不整体读取 JSON。新增、修改、移动、删除组件时按需加载维护流程，检查收录决定并保持目录更新。项目 AGENTS 指引帮助 Agent 找到 skill，日常 check 负责捕获漏收；仅复制 skill 不能保证所有 Agent 自动调用它。

skill 入口按查询、维护、接入分流：日常查询无需加载完整接入说明。无关业务工作不会自动触发接入、升级或迁移；缺少配置时也不会自行初始化。用户可在会话中明确暂停目录维护，但已有工程检查仍有效：若业务改动引起目录过期，Agent 应报告未通过项，不擅自删除检查或声称整体通过。这是任务范围约束，不是新增配置开关。

## 常见接入问题

### 业务组件与复用边界

目录可收录公共业务组件和模块内复用组件，不局限于基础 UI。在相应 componentRoots 项中增加：

```json
"reuse": { "scope": "module", "owner": "billing" }
```

| scope | 含义 |
| --- | --- |
| project | 项目内可复用候选，仍须遵守项目依赖规则 |
| module | 仅在所属模块内复用，必须提供 owner |
| unspecified | 尚未声明边界，不能推断为全局可用 |

owner 是项目已有的模块标识，不是人员姓名或文件路径；支持小写字母、数字以及点、下划线、短横线分隔。project/unspecified 也可在根配置中保留 owner 记录归属。未配置 reuse 的旧项目继续可用，默认 unspecified。`enrollment: public` 表示收录策略，不代表跨模块公开；layer 也不替代复用边界。

search 与所有 get 选择（包括 --prop）始终保留 reuse；输出超限时不会单独丢弃边界。CLI 不根据调用位置过滤搜索，也不检测非法跨模块引用，Agent 必须结合目标模块和项目规则判断。单页私有组件、路由默认不收录。组件默认继承所在根的边界；混合目录可在已收录声明上用单个 `@catalogReuse project`、`@catalogReuse unspecified` 或 `@catalogReuse module:<owner>` 覆盖。优先按真实目录拆分根，只有边界确实不同且移动源码不合理时才使用声明覆盖。修改边界后重新 generate、check。

| 看到的情况 | 下一步 |
| --- | --- |
| 只有 skill，找不到 CLI | 用 Node 调用 skill 内 scripts/bin/component-catalog.mjs；缺少 scripts 表示安装不完整，重新安装整个 skill 目录 |
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
| 中文查不到 | vocabulary 需要覆盖实际 task 标签及常用同义词；也可先查导出名。匹配到较长词组时，不重复计入其包含的短词；互不包含的词仍可组合 |
| 子组件挤占搜索结果 | 完整入口与结构子组件使用符合实际职责的不同主任务标签，普通查询优先映射完整入口；不要改稳定状态或 ID 调排名 |
| CLI check 通过，但日常检查没有目录检查 | 核对最终 scripts/Make 入口的调用链并实际运行；doctor 不验证工程集成 |
| 示例引用合法，但弹窗/抽屉行为异常 | 优先保留真实使用示例；检查包装组件是否已包含 Portal/Overlay，类型检查不替代交互验证 |
| namespace 没有 props | 用 --include members,constraints；单 Prop 查询只适用于组件 |
| 不支持的 wrapper/组件别名 | 仅支持直接 React forwardRef 内联回调；其他形式报告未收录原因，保留运行时代码 |

直接运行 CLI 不带参数会显示上手流程；每个子命令支持 `--help`。正常数据输出保持 JSON，错误输出到 stderr 并非零退出。

真实项目上的调用/token 测量、已完成的优化与后续方向见 [优化记录](docs/optimization-notes.md)。
