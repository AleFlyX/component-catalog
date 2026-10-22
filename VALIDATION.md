# 独立仓库验证记录

此页保留首次提取的验证快照；后续首次接入流程与 scan 改进见 [UX-VALIDATION.md](UX-VALIDATION.md)，生命周期闭环见 [LIFECYCLE-VALIDATION.md](LIFECYCLE-VALIDATION.md)。

日期：2026-10-22。环境：Linux、Node 24.21.0、TypeScript 5.9.3。

## 自动检查

- `npm run check`：PASS，10 组测试。覆盖配置发现/显式路径、跨 cwd、离线查询、不同源码布局、多组件根、别名、中文词表、排序与数量限制、单 Prop 上下文、字段选择、有效 JSON/UTF-8 上限、错误输入、目录版本/损坏、泛型与默认值、namespace、真实示例绑定、生成漂移、查询/检查无写入、符号链接输出越界及组件目录内部预览计数。
- `npm run build`：PASS。ESM 无编译步骤，此命令检查发布包清单；12 个文件，压缩包约 21.5 kB，不含 node_modules、测试、临时文件或 OJ 工作区。
- `npm pack` 后在隔离消费目录离线安装：PASS。通过安装后的 bin 从 `/tmp` 执行示例 `generate --check` 和 `get --prop disabled`，确认 schema、库和 CLI 都随包可用。
- `uv run --offline --with pyyaml python .../skill-creator/scripts/quick_validate.py skills/component-catalog`：PASS。最初在线获取 PyYAML 超时，改用已有缓存完成，未增加项目依赖。

未声明其他 Node 版本、Windows 或 macOS 已通过。本轮不涉及 UI 运行或生产部署。

## Skill 独立接入试跑

独立 Agent 在隔离项目中按 skill 接入：源码位于 `client/source`，组件位于 `ui-kit`，预览位于 `demos`，使用 `@sample/ui/*` 别名和 `sample.ui` ID 前缀。完成 help/init、配置、生成、search/get/--prop/check，均从另一个 cwd 运行；项目 TypeScript 检查、构建和示例执行通过，查询未改变目录哈希或修改时间。

试跑发现两处说明不够明确：排除路径必须在 sourceRoot 内；experimental 也必须填写约束。已在 skill 明确这两点，并同步配置文档。试跑中修正配置/注释后成功，未发现实现缺陷。临时证据目录：`/tmp/component-catalog-forward-test.JbnGNY`。

## OJ 真实组件兼容性

在临时目录放置指向 OJ 的配置，使用独立生成库在内存中构建目录；没有向 OJ 写入配置或生成产物。设置 `web/src`、`web/tsconfig.app.json`、组件根 `web/src/shared/ui`、ID 前缀 `shared.ui`、导入前缀 `@/shared/ui`，并配置原有预览/测试/排除目录和中文词表。

生成结果的 `components` 数组与原有 v2 目录逐项深比较：**21 项完全一致**。协议版本与来源摘要因独立格式和配置输入而不同，不比较这两项。额外验证了 DataTable.rowKey 的完整类型（包括泛型 key 和函数形式）被保留。

13 个真实任务的预期入口都位于第 1 项：

| 查询 | 首项 | UTF-8 字节数，含换行 |
| --- | --- | ---: |
| 表单 | BusinessForm | 1343 |
| 筛选 | QueryForm | 829 |
| 表格 | DataTable | 437 |
| 分页 | Pager | 647 |
| 弹窗 | FormDialog | 382 |
| 抽屉 | FormDrawer | 389 |
| 加载 | LoadingState | 628 |
| 错误 | ErrorState | 626 |
| 权限 | ForbiddenState | 394 |
| 上传 | FilePicker | 378 |
| 编辑器 | CodeEditor | 381 |
| rowKey | DataTable | 437 |
| useWatch | FormFields | 397 |

原完整 JSON 为 48,242 字节；单独查询 DataTable.rowKey 为 1,170 字节。这是输出字节测量，不是模型 token 或总体任务成本测量。

验证前后 OJ 目录字节一致；OJ 已有未提交改动保持不变。本轮仅在新的本地仓库实施，未运行 OJ 的 make check/build，未替换其集成入口。

## 边界

支持范围见 README。直接标记 memo/forwardRef/HOC 仍拒绝，复杂类型的 valueSchema 不保证完整，示例绑定检查不替代浏览器测试。独立版输出 v3，不直接读取 OJ 专用 v2，需要明确生成迁移。当前没有远端仓库、提交、推送或发布。
