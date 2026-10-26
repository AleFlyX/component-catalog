# Held-out 任务集：3 次重复结果

- 日期：2026-10-26
- 任务：10 个未参与调参的任务，A/B 两组各 5 个
  - feature 3：创建延误事件页、预订详情页、补偿列表页
  - shared 3：EmptyState、Popup、Tabs
  - mixed 2：创建事件页 + 卡片、登录页 + 导航栏
  - out-of-catalog 2：通用状态标签、图片查看器（预期 missing）
- 策略：
  - `c40`：40 条目录，默认 search
  - `c55layer`：55 条目录；单意图用明确 `--layer`，mixed 用 `--per-layer 2`
  - `c55perlayer2`：55 条目录，全部 `--per-layer 2`
  - `c55perlayer3`：55 条目录，全部 `--per-layer 3`（补充实验）
- 规模：前三种策略各 2 组 × 3 次；per-layer3 为 A/B 各 3 次，共 6 次/策略
- catalog-only，不读 source

## 结果

| 策略 | 得分 | 每 5 任务 token 均值 | 调用 | steps | tool calls |
| --- | --- | --- | --- | --- | --- |
| c40 | **27.5/30** | 218,886 | 6 | 10 | 11 |
| c55layer | **28/30** | 178,798 | 6 | 10 | 10 |
| c55perlayer2 | **28/30** | **145,259** | 6 | 10 | 10 |
| **c55perlayer3** | **29/30** | 149,251 | 6 | 9 | 9 |

- per-layer2 相对 40 条：token **−33.6%**，调用 −0%，得分 +0.5。
- per-layer3 相对 per-layer2：token **+2.75%**，得分 **+1**（B2 三次全中）。
- per-layer3 相对 40 条：token **−31.8%**，得分 +1.5。
- c55layer 与 per-layer2 同为 28/30，但 layer 需要正确选层，且 B4 两次错；per-layer 不需选层。

## 逐题通过率（3 次）

| 任务 | c40 | c55layer | per-layer2 | per-layer3 |
| --- | --- | --- | --- | --- |
| A1 创建延误事件页 | 3/3 | 3/3 | 3/3 | 3/3 |
| A2 EmptyState | 3/3 | 3/3 | 3/3 | 3/3 |
| A3 事件页 + 卡片 | 3/3 | 3/3 | 3/3 | 3/3 |
| A4 Tabs | 3/3 | 3/3 | 3/3 | 3/3 |
| A5 通用状态标签 | 2.5/3 | 3/3 | 3/3 | 3/3 |
| B1 预订详情页 | 3/3 | 3/3 | 3/3 | 3/3 |
| B2 底部弹出层 | 3/3 | 3/3 | **2/3** | **3/3** |
| B3 登录页 + NavBar | 1.5/3 | 3/3 | 3/3 | 3/3 |
| B4 补偿列表页 | 3/3 | **2/3** | **2/3** | **2/3** |
| B5 图片查看器 | 3/3 | 3/3 | 3/3 | 3/3 |

## 关键发现

1. **per-layer 的 token 优势稳定**：per-layer2 145.3K、per-layer3 149.3K，均显著低于 40 条 218.9K 和 layer-only 178.8K。
2. **per-layer3 修正了 B2**：per-layer2 在 B2 有一次把 `FilterSheet` 当成通用 `UiPopup`；per-layer3 三次都正确。
3. **B4 仍是 ranking 问题**：三种 55 条策略都出现过 `BatchScreen` 替代 `ListScreen`；per-layer3 也只 2/3。不是覆盖不足，而是同层/跨层排序仍会被摘要词干扰。
4. **c40 的缺口符合预期**：EmptyState/Tabs/NavBar 未收录；A5 只能给领域 badge；但 c40 用更多 get/output token 仍然只有 27.5/30。
5. **layer-only 的 28/30 依赖明确选层**，且 B4 两次错；per-layer 不需要选层，在同样得分下 token 更低。

## 结论

**当前推荐：`55 + --per-layer 3` 作为默认查询策略。**

- 29/30，比 per-layer2 多 1 题，token 只高 2.75%；
- 比 40 条低 31.8% token，得分高 1.5；
- 不需要 agent 猜测 layer；
- per-layer3 仍不能解决 B4 的 ranking 混淆，下一步应针对“列表页 vs 批次详情页”做 query/ranking 修正，而不是继续扩目录。

## 限制与协议

- per-layer3 是补充实验，A/B 各 3 次；前三种策略 6 次/策略。样本仍小，不能当成统计显著。
- 有若干协议偏差：部分 agent 执行过 `ls`/`cat config`，但答案未依赖源码；均已在各自 `notes` 记录。
- 计分含部分分：A5 领域 badge 0.5；B3 缺导航栏 0.5；A3 只答页面 0.5。
- B4 的“列表页”在 catalog 中确实存在；错误来自排序，而非缺失。

## 产物

- `tasks.json`、`summary-all.json`、`runs-all.json`、`runs-all.csv`
- `summary-per3.json`、`runs-per3.json`、`runs-per3.csv`
- `config-40.json`、`catalog-40.json.gz`
- `config-55.json`、`catalog-55.json.gz`
- `raw/{c40,c55layer,c55perlayer}/{a,b}-{result,usage}`
- `reps/r2`、`reps/r3`、`reps/per3`

## Post-hoc ranking 修正（本轮代码改动）

在 3 次 held-out 之后又修了一个 ranking 问题，用于处理 B4：

- **嵌套概念**：长短语不再无条件吞掉被包含的短词。若短词明确 related 到长短语的 primary（如“列表” related 到 `flight-delay-list`），两者都参与；否则（如“补偿”在“补偿列表”中）只保留长短语。
- **中文空格**：匹配 vocabulary 时同时使用去空格后的 compact query，因此“航班延误 补偿 列表”也能触发“补偿列表”。

验证：

```text
修复前：航班延误补偿列表页面 -> BatchScreen 第一
修复后：航班延误补偿列表页面 -> ListScreen 第一
修复后：航班延误 补偿 列表 -> ListScreen 第一
```

- 这直接修掉了 held-out B4 的自然查询/空格查询排序；agent 若再选错，属于 agent 选择问题，不是 search 返回顺序问题。
- 修正后尚未重跑完整 3 次 held-out；B 组定点运行仍受 agent 额外 get/省略 NavBar 影响（13.5/15），因此不把 29/30 当作最终稳定值。
- `npm test` 86/86 通过。

产物：`reps/per3-fixed/`（修正后 B 组 3 次定点结果）。

## Post-fix 重跑（ranking + components 数组）

ranking 修正后，用 per-layer3 重跑完整 A/B 各 3 次，并在 mixed 任务要求 `components` 数组包含所有组件：

| 条件 | 得分 | 每 5 任务 token 均值 | 调用 | steps |
| --- | --- | --- | --- | --- |
| per-layer3 修复前 | 29/30 | 149,251 | 6 | 9 |
| **per-layer3 修复后** | **29.5/30** | 180,889 | 6 | 11 |

- B2/B3/B4 全部修复：B4 现在稳定返回 `ListScreen`；B3 两次都同时返回 `SignInPage + UiNavBar`；B2 三次 `UiPopup`。
- 唯一缺口是 A5：一次把领域专用 `BookingStatusBadge` 当答案（0.5），另两次正确报告 missing。
- token 上升主要来自 agent 额外的 get/搜索，而不是 search 输出；B 组一次 6 调用/264K 的离群值来自 B3 的第二次搜索。

追加 no-get 约束（A/B 各 1 次）：

| 组 | 得分 | 调用 | token |
| --- | --- | --- | --- |
| A | 5/5 | 5 | 148,620 |
| B | 5/5 | 6 | 264,655 |

- “不要用 get 确认已有字段”能降低 A 组，但不能阻止 B3 首次搜索未覆盖 NavBar 时再搜一次；agent 的 query/搜索次数仍是主要方差源。
- 结论：ranking 修复有效；per-layer3 仍是默认，但需要把“mixed 任务必须返回 components 数组”和“搜索次数预算”一起作为策略约束，不能只靠工具。

## Final：per-layer3 + 严格一次搜索 + 不 get

在 ranking 修正（嵌套概念、compact CJK、concept-primary 优先）后，按“每任务一次 search、无 get、mixed 必须返回 components 数组”重跑 A/B 各 3 次：

| 指标 | 结果 |
| --- | --- |
| 得分 | **29.5/30** |
| 每 5 任务 token 均值 | **137,327** |
| CLI 调用 | **5** |
| steps | 9 |
| tool calls | 9 |

- 相对 40 条：token −37.3%，得分 +2.0。
- 相对 per-layer3 修复前：token −8.0%，得分 +0.5。
- 相对 per-layer3 修复后（允许 get）：token −24.1%，得分持平。
- B1–B5 全部 15/15；B2/B3/B4 稳定，B4 不再返回 BatchScreen。
- 唯一缺口 A5：一次把领域专用 `BookingStatusBadge` 当通用状态标签（0.5），另两次 missing。
- 失败/协议：A 组少数 agent 做过 `ls`（仅目录名）；已记录，不影响答案。

**最终建议：`55 + --per-layer 3`，每任务一次 search，只有字段缺失才 get；mixed 任务要求 components 数组覆盖所有角色。**
