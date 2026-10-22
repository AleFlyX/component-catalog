# 组件生命周期闭环验证

日期：2026-10-22。环境：Linux、Node 24.21.0、TypeScript 5.9.3。
本记录接续 [首次提取](VALIDATION.md) 与 [首次接入体验](UX-VALIDATION.md)，不替换历史证据。

## 实现结果

- configVersion 2 要求每个组件根显式配置 public/review。public 范围由 Agent 主动维护，review 根据项目归属决定；不根据目录名默认为公共 API。
- 就地 @componentCatalogIgnore 记录 internal/non-component/unsupported 原因，与收录标记互斥。没有第二份注册表或摘要产物。
- audit 检查完整配置范围的候选、决定、元数据、示例和替代关系；check 同时检查目录存在性和漂移。两者只读。
- v2 generate 先做源码审计，不会因重新生成而隐藏漏标记组件；支持删除最后一个组件后的合法空目录。
- v1 查询及生成继续工作，audit/check 要求先明确策略再迁移。目录 schemaVersion 仍为 3。
- skill 新增按需维护文档，覆盖新增、API 变化、移动、改名、弃用、删除及消费项目检查入口。主入口为 53 行，初次接入和维护细节分开加载。

## 自动化验证

`npm run check`：PASS，26 项测试，无失败或跳过。含原有查询/配置/生成/首次接入测试及新增 10 项生命周期测试：

| 场景 | 验证结果 |
| --- | --- |
| 已有目录后新增未标记组件 | audit/check 报漏收，generate 拒绝写入；补元数据后完整通过 |
| public/review 与显式忽略 | 区分未收录和未审查候选；冲突和空原因会失败，unsupported 单独统计 |
| Props 变化、改名、删除最后一项 | 发现漂移/旧 ID；重新生成后查询反映新 API，删除全部后查询为空 |
| 别名、星号与类型重导出 | 解析原声明并去重；类型星号及传递类型星号不误报，另有值路径时仍检查 |
| 默认导出、无效别名、歧义及循环 barrel | 发现未处理的默认导出、未解析别名、歧义；循环 barrel 不产生重复候选 |
| 元数据、示例和替代关系 | 无关示例、非法标签、缺失替代目标和替代循环均失败 |
| 缺失/损坏快照 | check 报错；audit 不改损坏文件，显式 generate 可修复后通过 |
| 大输出与分页 | 65 个漏收候选分批返回且无遗漏；每页 ≤8 KiB，空页不使失败变通过；超长 message 按字段省略 |
| v1 迁移 | 旧查询/生成继续可用；未设置根策略不能宣称完成新审计 |
| 未支持格式、符号链接、语法与配置错误 | 覆盖缺口可见；配置无法解析时退出 2，不能误报为空目录通过 |

查询、audit/check 和被拒绝的 generate 均验证了目录内容/修改时间不变。CLI 还验证命令名与查询内容区分：查询参数为 check 不会错误套用审计退出码。

本轮修复了两个实测边界：non-component 常量不再计入 ignoredUnsupported；仅类型 export-star 不再误判为范围外值导出。

## 打包和跨目录运行

- `npm run build`：PASS。执行 npm pack --dry-run，18 个文件，压缩包 40,248 字节，包含 audit/inventory/project 及 skill 的 setup/maintenance 引用，无新增运行依赖。
- 实际 npm pack 后，在 `/tmp/component-catalog-release-check-qoeDw4` 离线安装，安装后 bin 的 audit、check、中文 search、get --prop 全部通过。
- 消费目录没有 Git；使用显式配置指向其他目录的示例项目，查询/检查没有改变目录内容或修改时间。
- skill-creator quick_validate.py：PASS，使用已缓存 PyYAML，不增加项目依赖。

安装入口输出的 UTF-8 字节数（包含换行）：

| 命令 | 字节数 |
| --- | ---: |
| audit | 521 |
| check | 521 |
| search 按钮 | 348 |
| get demo.ui.Button --prop disabled | 887 |

字节数随配置路径与内容变化，不是模型 token 或总体任务成本测量。

## 独立 Agent 实际维护试跑

按 skill-creator 的独立验证流程，在 `/tmp/component-catalog-agent-lifecycle-raDMru` 提供真实请求：新增 Badge view-model、为 Button 添加 disabled 默认值、更新演示并验证。只给出 skill、隔离项目和需求，没有给出预期维护步骤。

项目使用 client/widgets、client/demos、@widgets 别名和 widgets ID 前缀，配置 public 策略，无 Git/OJ 依赖。实际产物：

- 新增 Badge.ts 与真实 badges.ts 演示，主动补齐有依据的元数据，状态沿用 experimental。
- Button.ts 新增 optional disabled:boolean，默认 false，更新按钮演示。
- 通过 CLI 重新生成唯一目录，结果为 2 个候选、2 个收录、0 忽略、0 未处理、0 问题。
- search/get 验证 Badge 的必填 text、tone 联合类型与默认值，以及 Button.disabled 的可选性和默认值。
- audit → generate → check、消费项目 npm run check（含 TypeScript）全部通过；6 个运行断言覆盖默认值及显式选项。
- 未重复询问已确定的收录策略，没有更改工具/OJ 源码，没有提交或发布。

主 Agent 复核了源码、真实演示和目录结果。本轮未执行真人参与的 review 归属歧义多轮对话；这部分验证由策略测试与 skill 指令审查覆盖，不宣称所有 Agent 都能自动选择正确的公共边界。

## OJ 兼容性与保全

只在内存中使用原有临时 v1 配置生成 OJ 目录：21 个组件的 components 数组与原目录逐项深比较完全一致。没有写入 OJ 配置或目录。

重跑历史记录的 13 个真实选择任务，预期入口全部为第 1 项；UTF-8 字节数与 [首次记录的查询表](VALIDATION.md#oj-真实组件兼容性)一致，单次搜索为 378–1,343 字节（含 rowKey/useWatch 查询）。

OJ 的 git diff --binary 与未跟踪文件名单和本轮开始时一致，已有未提交改动保留。本轮实现仅位于独立仓库，因此执行其 npm check/build，没有运行或声称通过 OJ 的 make check/build。

## 仍然保留的边界

审计覆盖配置根内 TS/TSX PascalCase 值/default 导出和显式决定，不保证识别任意框架、动态导出或小写未标记组件。memo/forwardRef/HOC 等仍是明确的提取限制；unsupported 忽略通过不代表它们可检索。元数据约束与归属理由的真实性仍需源码/人工审查。

已验证既有 public 策略下的 Agent 维护与检查兜底；仅复制 skill 无法保证所有 Agent 调用，应按维护文档把 component:check 接入消费项目日常检查。未实测其他 Node 版本、Windows/macOS、浏览器交互或生产部署。没有新增远程仓库、提交、推送或发布。
