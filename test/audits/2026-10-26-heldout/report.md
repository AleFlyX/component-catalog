# Held-out 任务集第一轮：40 vs 55+layer vs 55+per-layer

- 日期：2026-10-26
- 目的：用**未参与调参**的 10 个任务检验策略是否过拟合
- 任务：10 个，分 A/B 两组各 5 个：
  - feature 3：创建延误事件页、预订详情页、补偿列表页
  - shared 3：EmptyState、Popup、Tabs
  - mixed 2：创建事件页 + 卡片、登录页 + 导航栏
  - out-of-catalog 2：通用状态标签、图片查看器（预期 missing）
- 策略：
  - `c40`：40 条目录，默认 search
  - `c55layer`：55 条目录；单意图用明确 `--layer`，mixed 用 `--per-layer 2`
  - `c55perlayer`：55 条目录，全部 `--per-layer 2`
- 规模：每策略 2 组 × 1 次，共 6 个 agent；catalog-only，不读 source

## 结果

| 策略 | 得分 | CLI 调用/组 | total tokens 均值 | output tokens | steps | tool calls |
| --- | --- | --- | --- | --- | --- | --- |
| c40 | **9/10** | 8 | 219,348 | 17,326 | 9 | 14 |
| c55layer | **9/10** | 6 | **136,945** | 6,112 | 10 | 9 |
| **c55perlayer** | **10/10** | **5** | 138,446 | 4,110 | 11 | 10 |

- per-layer 相对 40 条：**token −36.9%**，调用 −37.5%，多答对 1 题。
- per-layer 相对 layer-only：token 基本持平（+1.1%），但 **10/10 vs 9/10**，且不需要 agent 猜层。
- per-layer 的唯一代价是 steps 略高（11 vs 9），但 output token 更低。

## 逐题结论

| 任务 | c40 | c55layer | c55perlayer |
| --- | --- | --- | --- |
| A1 创建延误事件页 | ✅ | ✅ | ✅ |
| A2 EmptyState | ✅ missing | ✅ | ✅ |
| A3 事件页 + 卡片 | ✅ BusinessCard | ✅ UiCard | ✅ UiCard |
| A4 Tabs | ✅ missing | ✅ | ✅ |
| A5 通用状态标签 | ⚠️ 仅领域 badge | ✅ missing | ✅ missing |
| B1 预订详情页 | ✅ | ✅ | ✅ |
| B2 Popup | ✅ | ✅ | ✅ |
| B3 登录页 + NavBar | ⚠️ 缺 NavBar | ✅ | ✅ |
| B4 补偿列表页 | ✅ | ❌ 返回 BatchScreen | ✅ |
| B5 图片查看器 | ✅ missing | ✅ missing | ✅ missing |

- c55layer 的 B4 是唯一硬错误：feature layer 下“列表页面”把 BatchScreen 排到 ListScreen 前，说明**明确 layer 也不能消除 ranking 歧义**。
- per-layer 在 B4 同时看到 feature 的 ListScreen 和 shared 结果，反而稳定命中。
- c40 的缺口正好对应未收录的 UI 原语（EmptyState/Tabs/NavBar）和领域专用 badge。

## 结论

1. **第一轮 held-out 支持 `--per-layer 2` 作为默认策略**：10/10、138.4K、5 次调用、不需要选层。
2. **40 条不是性能差，而是覆盖率差**：9/10，但 token 219K，且缺失 UI 原语/导航栏。
3. **明确 layer 的性能上限最好，但仍是 9/10**：ranking 会出错；per-layer 更稳健。
4. 仍需扩大样本：本轮每策略只有 2 组、每组 1 次，不能替代 3 次重复；但已经比原来的 5 个调参任务更有说服力。

## 协议与限制

- 所有 agent 都是 catalog-only，不读 source；A5/B5 预期 missing。
- c55layer-a 运行前读了 config（6.4KB），c55perlayer-b 运行前 `ls` 了根目录；答案未依赖这些读取，但已记录，评分不因此加分。
- c40-a 有 3 次 harness 工具校验失败，未产生 catalog 调用；usage log 的 8 次是 5 search + 3 get。
- 计分规则：缺失任务正确报告 missing 得 1；领域专用 badge 但说明无通用组件得 0.5；缺一个混合组件得 0.5。

## 产物

- `tasks.json`、`runs.json`、`runs.csv`、`summary.json`
- `config-40.json`、`catalog-40.json.gz`
- `config-55.json`、`catalog-55.json.gz`
- `raw/{c40,c55layer,c55perlayer}/{a,b}-result.json`、`a/b-usage.jsonl`
