# 优化第二轮：search 直接返回导入/必填信息 + 紧凑 propIndex

- 日期：2026-10-25
- 基线：`test/baselines/bulletproof-react-2026-10-25/`（优化前）
- 前一轮优化/审计：`test/audits/2026-10-25-optimization-a/`
- 重复 B：`test/audits/2026-10-25-b-repeated/`
- 本轮代码：`skills/component-catalog/scripts/lib/query.mjs`（未提交前的当前工作区改动）

## 1. 改了什么

| 问题 | 优化 | 预期收益 |
| --- | --- | --- |
| agent 常为拿 importPath/必填 props 再 `get` 一次 | `search` 结果新增 `importPath` 和 `requiredProps`（组件必填 Prop 名数组） | 常见“找组件 + 导入 + 必填 props”可用一次 search 完成，少一次 get |
| `--include props` 返回 281–299 个 `{name, required}` 对象，约 12–13 KB | `propIndex` 改为 `{total, inheritedTypes, names: string[], required: string[]}` | 同样信息，对象开销去掉；Input 从 13.2 KB 降到 5.2 KB（−61%） |
| 默认 get 仍可能被大 props 拖累 | 保持上一轮的 `propsSummary` 默认行为，只有显式 `--include props` 才返回完整名称索引 | 默认仍为约 1 KB |

未改 schema、生成逻辑、版本号；`check` 对既有 74 条 catalog 仍 pass。

## 2. 审计 A（固定 27 次调用）

| 指标 | 上一轮优化后 | 本轮 | 变化 |
| --- | --- | --- | --- |
| 总调用 | 27 | 27 | 不变 |
| 总输出 | 80,779 B | **77,208 B** | −4.4% |
| 13 个查询 | 13,651 B / 13/13 | **17,372 B / 13/13** | +3,721 B（新增字段） |
| `get Button --include props` | 12,343 B | **5,051 B** | −59% |
| `get Input --include props`（B 日志） | 13,275 B | **5,202 B** | −61% |
| `scan --brief` | 3 页 / 16,527 B | 3 页 / 16,527 B | 不变 |

单看固定查询集，search 变大；但在 agent 工作流里，search 直接给 `importPath + requiredProps` 可以省掉一次 get，下面的 B 复测验证了这一点。

## 3. B 复测（仅 catalog 条件，相同 5 任务）

用与上一轮完全相同的 catalog prompt，重新跑 3 次：

| run | 正确 | CLI 调用 | CLI 输出 | total tokens | output | uncached input | cache read | steps | 耗时 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5/5 | 20 | 40,435 | 233,969 | 8,086 | 14,043 | 211,840 | 12 | 93,747 |
| 2 | 5/5 | 15 | 21,001 | 186,281 | 8,059 | 10,798 | 167,424 | 10 | 72,498 |
| 3 | 5/5 | 14 | 20,581 | 175,692 | 6,181 | 10,023 | 159,488 | 10 | 62,223 |
| 均值 | 15/15 | **16.3** | **27,339** | **198,647** | **7,442** | **11,621** | **179,584** | 10.7 | 76,156 |

与其它条件的均值对比：

| 条件 | total tokens 均值 | output 均值 | CLI 调用 | 源码读取 |
| --- | --- | --- | --- | --- |
| catalog（本轮优化后） | **198,647** | 7,442 | 16.3 | 0 B |
| catalog（上一轮） | 229,299 | 8,230 | 22 | 0 B |
| source（带标注） | 285,559 | 8,899 | 0 | 42,319 B |
| source-pristine | 231,028 | 9,986 | 0 | 31,420 B |

本轮 catalog 相对上一轮：总 token −13.4%，output −9.6%，uncached input −29.5%，CLI 输出 −38.5%，调用数 −27%；相对 pristine：总 token −14.0%；相对带标注 source：−30.4%。正确率仍为 15/15。

**但不能据此宣称已经普遍省 token**：

- 只有 3 次，范围 175.7K–234.0K；pristine 范围 192.3K–282.0K，二者重叠，单次 run 1 仍接近 pristine 的中位数以上。
- 任务仍是同 5 个、同一模型/agent preset；没有换到陌生仓库。
- 一次性的标注 + catalog 生成成本仍未计入；按 output 差值粗估，约需 20–30 个同类任务才可能摊销，且差异在噪声范围内。
- 对比“带标注源码”不是上游基线；只能说明标注让源码读取变贵，catalog 绕过了这部分。

## 4. 结论

1. “search 直接返回 importPath + requiredProps”是有效优化：catalog 调用从均值 22 次降到 16.3 次，CLI 输出从 44.5 KB 降到 27.3 KB。
2. “紧凑 propIndex”把显式 props 查询从约 12–13 KB 降到约 5 KB，且没有丢名称/required 信息。
3. 在本组 5 任务上，优化后的 catalog 总 token 首次低于 pristine 约 14%，但样本小、方差大，**只能作为正向信号，不能作为普适结论**。
4. 下一步若继续优化，优先减少“探索性 search”的剩余 9–14 次：可考虑在 search 结果中增加 `sourcePath`/任务别名，或让 skill 指引推荐“先按任务 tag 搜，再按 export name 直达”；但每增加字段都会增加固定查询的输出，需要用同样的 B 复测验证净值。

## 5. 产物

- 本轮 A：`metrics-after.json`、`summary.json`、`usage.jsonl`
- 本轮 catalog B：`catalog-runs/raw/`、`catalog-runs/usage/`、`catalog-runs/runs.csv`、`catalog-runs/summary.json`
- 真实 usage：DSH `~/.dsh/storages/session_projcache/sessions/<id>.json` 的 `rows.tokenUsage.val.totals`
- 复测 prompt 与上一轮 B 相同；工作目录 `apps/react-vite`，仅 search/get，0 源码读取
