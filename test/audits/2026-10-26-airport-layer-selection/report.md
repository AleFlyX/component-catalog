# Layer 过滤的稳定性实验

- 目录：55 条 airport catalog
- 对比：
  1. **mandated layer**：benchmark 明确告诉每个任务用 feature/shared-ui（3 次）
  2. **self-selected layer**：agent 自己判断 layer，必要时允许一次 fallback（3 次）
  3. **layer-fallback**：agent 自选 layer + 每次带 `--layer-fallback`，空层自动退回全目录（3 次）
- 5 任务相同，details + 严格非 CLI 预算。

## 结果

| 条件 | 有效运行 | total tokens（均值 / 中位数） | 说明 |
| --- | --- | --- | --- |
| mandated layer | 3/3 | **94,902 / 92,507** | 5 次 search；layer 选择 5/5 正确 |
| self-selected | 3/3 | **135,830 / 130,391** | task3 有一次选 shared-ui 得到 `ui.UiPasswordInput`；其余选择正确 |
| layer-fallback | 3/3 | **173,396 / 170,862** | run1 task4 layer 猜错但搜索仍有 1 条结果，fallback 未触发，未能解析搜索栏/筛选面板 |
| layer auto | 3/3 | **137,374 / 132,229** | 三次 task4 都把“预订列表 搜索栏 筛选面板”锁定到 feature 的 booking list，未返回 shared-ui 搜索/筛选组件 |

> self-selected 三次平均 token 比 mandated 高 43%；layer-fallback 更高（+83%），且 run1 有未完成任务。

## 发现

1. **layer 过滤本身有效，但依赖正确的 layer 选择**：明确指定时 94.9K；agent 自选平均 135.8K（+43%）。三次里有一次 task3 选了 shared-ui，得到 `ui.UiPasswordInput` 而不是 app-facing 的 `auth.PasswordInput`。
2. **`--layer-fallback` 只解决“空层”**：task3 的 shared-ui 并非空层（有 UiPasswordInput），所以 fallback 不会触发；task4 的 feature 错层也返回了 1 条通用列表，fallback 同样不触发，导致任务未完成。它不能替代任务语义判断。
3. **任务 #3 本质歧义**：password input 同时有 shared primitive 和 feature wrapper；如果任务是“登录表单如何使用错误”，应优先 feature wrapper；如果任务是“设计系统原语”，才用 shared-ui。当前 skill 的“primitives → shared-ui”规则过于简单。
4. **`--layer auto` 只适合单意图查询**：它按 top-1 的 layer 过滤；task4 的“预订列表 + 搜索栏 + 筛选面板”是多意图，top-1 是 feature 的 booking list，于是 shared-ui 的 SearchBar/FilterSheet 被直接排除，三次都失败。
5. **错层的代价很高**：fallback 组一次 task 未完成，token 反而最高（213K）；真实使用中一次错层可能直接导致任务失败，而不只是多花 token。

## 结论

- **55 + 明确 layer 是最佳性能组合**，但不能假设 agent 能稳定自选 layer；`--layer auto` 对混合意图不可靠。
- **40 条仍是 layer 未知或混合意图时的安全默认**。
- 下一步优化应放在 **layer 选择策略**，而不是继续扩目录：
  - 任务描述出现“页面/工作区/列表/登录表单”等应用行为 → 优先 feature
  - 任务明确要“原语/设计系统/基础组件” → shared-ui
  - 歧义时不要强行加 layer，或先不过滤再按结果筛选
  - 多意图查询应拆成多次单意图查询，或让 search 支持“按层分组返回”，而不是用 auto 锁定单一层

## 产物

- `../2026-10-26-airport-mobile/raw/catalog-layer-self/`
- `../2026-10-26-airport-mobile/raw/catalog-layer-fallback/`
- `../2026-10-26-airport-mobile/usage/layer-self-*.jsonl`
- `../2026-10-26-airport-mobile/usage/layer-fallback-*.jsonl`
- `../2026-10-26-airport-mobile/analysis/layer-self-*`
- `../2026-10-26-airport-mobile/analysis/layer-fallback-*`
