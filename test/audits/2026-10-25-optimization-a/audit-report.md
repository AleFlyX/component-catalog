# 优化与审计报告（A + B）

- 基线：`test/baselines/bulletproof-react-2026-10-25/`（tool commit `2a9b6c4`，优化前）
- 优化代码：工作区当前未提交改动（`query.mjs`、`scan.mjs`、CLI、测试、README）
- 被测项目：`alan2207/bulletproof-react` @ `9506629`，`apps/react-vite`，74 个 catalog 条目
- 日期：2026-10-25

## 1. 做了什么优化

| 问题（来自基线报告） | 优化 | 行为变化 |
| --- | --- | --- |
| 46/74 个条目 props 超过 16 KiB，`get` 直接丢弃整个 props | 默认 `get` 返回极小的 `propsSummary`（`total` + 提示）；显式 `--include props` 返回 `propIndex`（全部 Prop 名称 + required） | 默认详情不再“静默无 API”，显式请求仍受 16 KiB 上限保护；不再需要为了看名称而读 3.9 MB catalog |
| `scan --limit 50` 因 8 KiB 上限每页只回 23–35 项 | 新增 `--brief`：只返回 `exportName/sourcePath/line/marked/supportedShape` | 113 个候选从 4 页 30.9 KB 降到 3 页 16.5 KB |
| `isLoading` 查询因词汇项 `loading` 的纯子串匹配把 Spinner 排在 Button 前 | ASCII 词汇项改为词边界匹配，CJK 保持子串匹配 | `search isLoading` 现在首先返回 `ui.button.Button` |
| 没有本地使用数据，无法做审计 | `COMPONENT_CATALOG_LOG=<path>` 输出 JSONL（命令、参数、输出字节、耗时、truncated/omitted、错误） | 默认关闭；不改变 stdout，写入失败被忽略 |

说明：

- 未改 catalog schema、生成逻辑、版本号；`check` 对既有 74 条 catalog 仍为 pass。
- `--brief` 与 `--summary` 互斥；`propsSummary` 只用于默认视图，`--include props` 才拿完整名称索引。
- skill 的 `SKILL.md`/setup 文档未改（revision 8 不变），新选项先记录在工具 README；若要进入 skill 指引需同步升 revision。

验证：`npm test` 77/77 通过（`node --test --test-concurrency=1 test/*.test.mjs`，约 116 s）；`node --check` 通过；恢复后的 trial `check` pass（74 条、issues 0）；13/13 查询命中。`search-isloading.json` 记录了基线/优化后的排序：`before: [Spinner, Button]` → `after: [Button]`。

## 2. 审计 A：本地使用与输出量

在恢复后的 trial 项目上，用 `COMPONENT_CATALOG_LOG` 记录 27 次调用（13 个查询 + 6 个 get + 7 个 scan + 1 个 check）：

| 指标 | 数值 |
| --- | --- |
| 调用数 | 27 |
| 总输出 | 80,779 B（约 20.2K tokens，按 4 B/token 估） |
| search | 13 次 / 13,651 B / 6 次 truncated |
| get | 6 次 / 18,879 B / 2 次 `props` 被省略 |
| scan | 7 次（4 次完整 + 3 次 brief）/ 47,411 B |
| check | 1 次 / 838 B / pass |
| 13 个查询命中 | 13/13，输出字节与基线完全一致（13,651 B） |

关键对比（同一 trial、同一 catalog）：

| 场景 | 基线 | 优化后 | 结论 |
| --- | --- | --- | --- |
| `get ui.button.Button`（默认） | 895 B，props 静默丢失 | 1,027 B，含 `propsSummary.total=281` + 提示 | 多 132 B，换来可发现性 |
| `get ui.button.Button --include props` | 605 B，无 props | 12,343 B，281 个名称 | 明确请求才付成本；仍远小于 3.9 MB catalog |
| `get ui.button.Button --prop isLoading` | 1,477 B | 1,477 B | 不变 |
| `get ui.table.Table` | 1,276 B | 1,276 B | 不变 |
| `scan src/components` 完整视图 | 4 页 / 30,884 B | 4 页 / 30,884 B | 不变 |
| `scan src/components --brief` | 无此选项 | 3 页 / 16,527 B | 省 14,357 B（约 3.6K tokens）和 1 次调用 |
| `search isLoading` | Spinner 第一 | Button 第一 | 词汇边界修复 |

审计 A 的局限：字节数不是模型实际 token；未计入系统提示、工具 schema 和 agent 推理。`propsSummary.inheritedTypes` 目前对 forwardRef 包装组件为空（生成阶段未记录），这是仍存在的元数据缺口。

## 3. 审计 B：子 agent 对照实验

> 本节是单次运行、字节估算的结果。重复 3 次并用真实模型 usage 复核的结论见 [重复实验报告](../2026-10-25-b-repeated/report.md)：catalog 与 pristine 源码总 token 基本打平（−0.75%），**不能证明省 token**；单次字节数高估了 catalog 的成本。

同一组 5 个任务，三个独立子 agent（无共享上下文）：

1. **catalog**：只能用 `search`/`get`，catalog 不足时才读源码；
2. **source（带标注）**：禁止 CLI/catalog JSON，用 `rg` + 源码，仓库包含本次标注的 JSDoc；
3. **source-pristine**：同上，但使用未标注的 upstream 克隆。

| 条件 | 读取源码 | CLI 调用 | 输出读取量 | ≈tokens | 正确性 |
| --- | --- | --- | --- | --- | --- |
| catalog | 0 个文件 | 28 次（24 成功 + 4 次失败） | 46,895 B | 11.7K | 5/5 |
| source（带标注） | 17 个文件 | 0 | 34,788 B | 8.7K | 5/5 |
| source-pristine | 18 个文件 | 0 | 29,500 B | 7.4K | 5/5 |

子 agent 回答的一致性：

- 5 个任务的核心组件在三种条件下都答对：`ConfirmationDialog` / `Input` / `TablePagination` / `MDPreview` / `CreateDiscussion`。
- 任务 1 存在合理歧义：source 条件报了 feature 级 `DeleteDiscussion`（仅 `id`，内部包 `ConfirmationDialog`）；catalog 与 pristine 条件报了 `ConfirmationDialog`（`triggerButton/confirmButton/title`）。两个答案都给出了另一个候选。
- 导入路径差异：catalog 常给直接模块路径（`@/components/ui/dialog/confirmation-dialog/confirmation-dialog`），source 常给 barrel（`@/components/ui/dialog`）；两者都能解析。

解释与限制：

- **本组任务没有体现 token 节省**：catalog 条件比 pristine source 多约 59% 字节、比带标注 source 多约 35%。原因是 28 次探索性 search/get（含 4 次 `--from` 误试）和一次 13 KB 的 `get Input --include props`；这些调用本身也产生了可观的 JSON 输出。
- **catalog 的价值不在“更少字节”**：它零源码读取、直接给出约束/必填项/模块边界和统一 ID，任务 3 还明确指出了 barrel 不导出 `TablePagination` 这一易错点。
- **样本很小且带标注**：source 条件读的是本次注入 JSDoc 的源码，天然比 pristine 好读；pristine 条件才是不用 catalog 的真实基线。单次运行、不同 agent 策略差异很大，字节代理不等于模型 token。
- **一次性成本未摊销**：基线中 +842 行标注（约 8–15K 输出 tokens，另加 setup 期读源码成本）尚未计入；按本次每任务 0 字节节省，无法回本。只有在多次查询、或源码搜索需要读大量文件时，catalog 才可能产生净节省。
- 若要得到可信的“省 token”结论，建议下一步：用真实 tokenizer/模型 usage、每个条件重复 3 次、任务覆盖更多目录，并记录搜索/命令输出字节（本次 source 条件未统计 `rg` 输出）。

## 4. 结论与建议

1. 三项优化均可验证：`propsSummary/propIndex` 解决了“API 完全不可见”，`--brief` 把候选盘点从 4 页降到 3 页（-46.5% 字节），ASCII 词汇边界修复了 `isLoading` 排序；使用日志为后续审计提供了稳定数据源。
2. 本组小样本中 catalog 没有省 token，反而因探索调用增加了输出量；**不能据此宣称整体省 token**。更大、更陌生的代码库和更熟练的调用策略可能改变结论，但需要 B 的重复实验验证。
3. 若目标是降低实际 token，优先做：减少探索性 search（更准确的词汇/ID 直达）、默认不拉 `--include props`、把 `--brief` 写进 skill 盘点流程、对 `TablePagination` 这类未从 barrel 导出的组件在 catalog 中显式标注导入路径（现已通过 `importPath` 提供）。
4. 仍需修复：forwardRef 条目的 `inheritedTypes` 为空；`propsSummary` 只能提示数量，不能替代类型；别名重导出（15 个）仍不可登记。

## 5. 复现

```bash
# 恢复 trial（基线目录含 config/catalog/annotations.patch）
git clone https://github.com/alan2207/bulletproof-react.git /tmp/oss-trial/bulletproof-react
cd /tmp/oss-trial/bulletproof-react
git apply /home/ccb/component-catalog/test/baselines/bulletproof-react-2026-10-25/annotations.patch
cd apps/react-vite
cp /home/ccb/component-catalog/test/baselines/bulletproof-react-2026-10-25/config.json component-catalog.config.json
gzip -dc /home/ccb/component-catalog/test/baselines/bulletproof-react-2026-10-25/catalog.json.gz > component-catalog.json
pnpm install --ignore-scripts

# 审计 A（需先恢复 /tmp 下的 queries.json 或直接使用基线 queries.json）
COMPONENT_CATALOG_LOG=/tmp/audit-a/usage.jsonl \
  node /home/ccb/component-catalog/skills/component-catalog/scripts/bin/component-catalog.mjs \
  --config component-catalog.config.json check

# 审计 B 的原始输出
cat test/audits/2026-10-25-optimization-a/catalog.json
cat test/audits/2026-10-25-optimization-a/source.json
cat test/audits/2026-10-25-optimization-a/source-pristine.json
```
