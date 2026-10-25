# 优化第三轮：barrel 导入入口

- 日期：2026-10-25
- 代码：`skills/component-catalog/scripts/lib/config.mjs`、`lib/generate.mjs`
- 基线：`test/baselines/bulletproof-react-2026-10-25/`
- 上一轮：`test/audits/2026-10-25-optimization-b/`

## 1. 改了什么

新增配置项：

```json
{ "importPathStyle": "direct" }
```

- `direct`（默认）：`importPath = importPrefix + 组件文件相对路径`，行为与旧版一致。
- `barrel`：在组件根内查找真实的 `index.ts/tsx/js/jsx`，若该入口确实导出该组件，则使用目录入口；选择离根最近的 barrel（例如 `ui/form/index.ts` 优先于更深层 index）。仅使用真实存在的入口，并由生成阶段从示例位置验证可解析；不凭空创建别名。

trial 配置已设为 `barrel` 并重新生成 74 条：

| 组件 | 旧 importPath | barrel 后 |
| --- | --- | --- |
| Button | `@/components/ui/button/button` | `@/components/ui/button` |
| Input | `@/components/ui/form/input` | `@/components/ui/form` |
| ConfirmationDialog | `.../dialog/confirmation-dialog/confirmation-dialog` | `@/components/ui/dialog` |
| MDPreview | `@/components/ui/md-preview/md-preview` | `@/components/ui/md-preview` |
| TablePagination | `.../table/pagination` | `.../table/pagination`（barrel 不导出，保持直接） |
| Notification | `.../notifications/notification` | 保持直接（notifications/index 不导出它） |

`check` 仍 pass（74 条、issues 0）；测试 78/78 通过。

## 2. 审计 A

| 指标 | 上一轮 | 本轮 barrel |
| --- | --- | --- |
| 总输出 | 77,208 B | **76,931 B** |
| 13 查询 | 17,372 B / 13/13 | **17,140 B / 13/13** |
| `get Button --include props` | 5,051 B | 5,044 B |
| `get Input --prop registration` | 1,146 B | 1,140 B |

固定查询的字节略降（import 路径更短），但变化很小。

## 3. B 复测（catalog 条件 3 次）

| run | 正确 | CLI 调用 | CLI 输出 | total tokens | output | uncached | cache read | steps | 耗时 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5/5 | 23 | 53,116 | 238,897 | 7,843 | 18,958 | 212,096 | 10 | 111,888 |
| 2 | 5/5 | 18 | 22,310 | 219,224 | 9,813 | 11,139 | 198,272 | 11 | 89,844 |
| 3 | 5/5 | 18 | 30,108 | 172,998 | 5,743 | 10,711 | 156,544 | 10 | 59,835 |
| 均值 | 15/15 | **20** | **35,178** | **210,373** | **7,800** | **13,603** | **188,971** | 10 | 87,189 |

对比：

| 条件 | total tokens 均值 | CLI 调用 | CLI 输出 | 答案导入路径 |
| --- | --- | --- | --- | --- |
| 本轮 barrel | 210,373 | 20 | 35,178 | 全部为项目惯用 barrel/direct |
| 上一轮（direct + 紧凑 index） | **198,647** | 16.3 | 27,339 | 直接模块路径 |
| pristine source | 231,028 | 0 | 0 | barrel（源码里就是这样写的） |

**结论：barrel 让答案的导入路径更符合项目习惯，但本组没有带来 token 收益，均值反而比上一轮高 5.9%**（210.4K vs 198.6K），调用数也更多（20 vs 16.3）。范围 173.0K–238.9K 与上一轮 175.7K–234.0K 高度重叠，差异在噪声内。可能原因：

- barrel 路径不会减少 agent 需要执行的 search/get 次数；本轮仍有 8–13 次 search 和 8–11 次 get。
- 路径更短对单次输出影响只有几字节，远小于探索性调用的波动。
- 部分 agent 仍选择 feature 级 `DeleteDiscussion`，没有统一到 `ConfirmationDialog`，任务 1 的歧义依旧存在。

因此 `importPathStyle` 保持**默认 `direct`**，作为可选的项目约定增强；trial 中保留 `barrel` 以展示效果。若默认启用，需要在 skill/配置迁移说明中明确行为变化。

## 4. 下一步建议

1. 继续压缩探索调用：barrel 已把“导入路径”问题解决，但 8–13 次 search 仍是主要成本。可考虑在 search 中增加**受控的任务别名**（由项目配置提供，不是自然语言猜测），或让 agent 先按 `@catalogTask` 精确搜索再按导出名直达。
2. 对任务 1 这类“通用 primitive vs feature wrapper”的歧义，考虑在 catalog 中标记 primary entrypoint（例如 `@catalogTask confirmation` 的通用与 feature 级组件排序规则），或在 search 结果中显示 `layer`/`reuse` 以帮助选择；不要为了排名修改 ID。
3. 若要证明 barrel 的收益，应在“导入路径正确性/编译通过率”上评估，而不是 token；本轮 15/15 两种路径都能解析。

## 5. 产物

- `metrics-after.json`、`summary.json`、`usage.jsonl`：本轮 A
- `catalog-runs/raw/`、`catalog-runs/usage/`、`catalog-runs/runs.csv`、`catalog-runs/summary.json`：本轮 B
- 代码提交：见仓库对应 commit；默认 `importPathStyle: direct`，trial 配置为 `barrel`
