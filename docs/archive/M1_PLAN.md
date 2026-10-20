# M1「最小自动战斗」执行计划

## 0. 本轮范围与结论

- 目标仓库：`catfish-xn/cat`。
- 本轮仅阅读规格、检查仓库与基线、运行已有测试和构建、保存本计划、独立审查计划；**不开始功能实现**。
- 后续 Goal：完成 M1「最小自动战斗」，直到所有成功条件都有实际证据才可宣布完成。本文是执行计划，不是完成报告。
- 规格内部没有必须改变目标的硬冲突；公共接口冻结与并行开发按依赖顺序执行即可。
- **当前存在前置阻塞：最新远端 main 尚不包含用户要求的全部基础功能与 CI。不得在该基线上直接启动 M1，也不得擅自将缺失前置功能纳入本轮实现。**
- 继续条件：所需前置功能进入 `main` 后，重新 fetch、核对 SHA、检查实际代码、运行基线测试和构建。若需改用其他基线或改变前置范围，应先由用户明确调整要求。

## 1. 基线检查证据

检查日期：2026-10-04（Asia/Taipei）。

| 项目 | 实际结果 |
| --- | --- |
| repository 根目录 | `/workspace/cat` |
| origin fetch / push | `https://github.com/catfish-xn/cat.git` |
| 当前 branch | `work` |
| 检查前 working tree | 干净，无待提交或未跟踪文件 |
| HEAD | `b963f61180ba43c3bc5c9d4f4eb547818e215a1e` |
| 最新 main | `git fetch origin main` 成功；`git ls-remote origin refs/heads/main` 与 HEAD、`origin/main` 均为上述 SHA |
| Node / npm | `v24.19.0` / `11.9.0` |
| `npm test` | 成功，1 个测试文件、8/8 测试通过 |
| `npm run build` | 成功，TypeScript typecheck 与 Vite build 均通过 |
| 已有构建提示 | Vite 提示部分压缩后 chunk 大于 500 kB；非构建失败，本轮不调整依赖或打包架构 |
| GitHub CI 证据 | main 文件树无 CI 工作流；GitHub combined status 查询返回 `statuses: []`，不能认定 CI 通过 |
| 浏览器验证 | 未验证；本轮仅计划与基线检查，尚未探测浏览器能力或执行 M1 UI 流程 |

前置条件逐项核对：

| 必须已在最新 main 中存在 | 状态与代码证据 |
| --- | --- |
| 7×8 战场 | **缺失**：`src/simulation/board.ts:4` 的 `DEFAULT_BOARD` 为 7 列 × 6 行 |
| player / enemy 阵营 | **缺失**：`src/simulation/units.ts:10` 的 `Unit` 只有 ID、definitionId、location；`game.ts` 无双方阵营初始化 |
| 准备阶段部署限制 | **缺失**：`src/simulation/game.ts:8` 起的 `moveUnit` 仅检查单位、边界、占用，无阵营部署区限制 |
| hex neighbours | **缺失**：`board.ts` 只有坐标类型、边界及同格判断，当前源文件中没有邻格规则 |
| hex distance | **缺失**：当前源文件中没有六边形距离规则 |
| 现有测试 | **已有**：`tests/simulation.test.ts`，8 个测试通过 |
| 现有 CI | **未满足**：`git ls-tree -r --name-only origin/main` 未包含 `.github/workflows` 或其他 CI 配置，未取得通过证据 |

本轮不重新初始化项目，不重写架构，不升级依赖；只新增本计划。构建生成的 `dist/` 已被仓库忽略。本轮不提交、push 或创建 M1 PR。

## 2. 范围与工作原则

沿用现有 TypeScript + Vite + Phaser 架构：simulation 为独立规则层，rendering 为显示与交互层。战斗规则不得依赖 Phaser、DOM 或浏览器；渲染不得重新实现规则。

不实现：shop、economy、XP / level、interest、streak、champion skills、mana、traits、items、augments、anomalies、S13 champion data、React、3D、正式 Riot assets。不得顺手增加这些功能，也不进行无关依赖升级。

主 agent 负责协调、公共 Combat API、公共类型、集成决策、最终验证及报告。主动使用 subagents，**最多同时运行 3 个子代理**。独立任务并行；有依赖的工作串行。

## 3. 执行阶段与门禁

### 阶段 0：合格 main 基线

1. 重新检查 repository、remote、branch、working tree，不覆盖已有用户修改。
2. fetch 最新 `main`，记录 SHA；核实第 1 节全部前置能力及 CI。
3. 运行 `npm test`、`npm run build`，保存真实结果。
4. 任一前置条件缺失或基线失败，记录 blocker 与解除条件，停止依赖它的实现。
5. 基线合格后，从该 SHA 建立新的 feature branch；不直接在 main 开发。

### 阶段 1：主 agent 先冻结公共 Combat Contract

先建立并验证以下公开接口和类型，再开始并行实现：

- `CombatState`
- `CombatUnit`
- `CombatEvent`
- `CombatResult`
- `createCombat(preparationState)`
- `stepCombat(combatState)`

公共 Contract 必须明确的内容：

| 项目 | 必须约定的语义 |
| --- | --- |
| CombatState | 战场、单位、逻辑 tick、运行/结束状态、结果及最大持续 tick；与准备阶段 `GameState` 隔离 |
| CombatUnit | 稳定且唯一 ID、阵营、hex 坐标、HP / max HP、存活状态、攻击数值、范围、攻击间隔与 cooldown、必要的寻敌状态；不包含 bench 单位 |
| CombatEvent | 至少支持 movement、attack、damage、death、combat finished；明确 tick、源/目标 ID、坐标/数值及事件稳定输出顺序 |
| CombatResult | `playerWin`、`enemyWin`、`draw`；明确运行中尚无结果、全灭、超时等状态语义 |
| createCombat | 只从棋盘单位创建本场快照，复制所需嵌套数据，初始化 HP、死亡状态和 cooldown；不修改准备阶段状态 |
| stepCombat | 每次只推进一个固定 tick；明确新状态和本 tick 事件的返回结构，不修改输入状态；已结束时返回不变终态且不产生新战斗事件 |
| 时间 | 固定 **20 tick / second、50 ms / tick**；interval、cooldown、maximum duration 用明确的 tick 单位表达 |

以上为语义计划，不是已实现或已冻结的 TypeScript 定义。主 agent 在阶段 1 确定确切字段、返回类型、事件名称、数值及边界，并用基础测试验证。A/B 不得各自假设或更改公共协议。

基础测试至少覆盖：不带入 bench、准备状态与输入快照不变、嵌套对象隔离、固定 tick、事件返回边界、终态不再推进。基础测试和 build 通过、独立审查公共接口后，记录冻结版本作为 A/B 的共同基线。

### 阶段 2：并行实现与独立审查

| 角色 | 所有权及职责 | 限制 |
| --- | --- | --- |
| 主 agent | 公共类型/API、集成、共享文件协调、合并与验证 | 审查实际 diff、代码及测试，不仅采信完成声明 |
| Subagent A：combat simulation | simulation 私有实现及对应测试 | 只改 simulation 相关文件，不改 rendering 或冻结公共 Contract |
| Subagent B：combat rendering / interaction | rendering、交互及对应生命周期/时间累积测试 | 不重新实现规则，不改 simulation 逻辑或公共类型 |
| Subagent C：independent review / testing | 只读检查真实代码、diff、测试输出及复核修复 | 默认不实现主要功能；问题交回主 agent 修复 |

并行修改时从冻结 Contract 的同一提交建立 A/B 独立 branch 与 worktree。先列明各自允许修改的文件；公共类型及核心集成文件归主 agent，不能多人同时修改同一核心文件。C 使用固定 SHA/明确 diff 的只读审查视图。

A/B 在隔离 worktree 内并行；主 agent 检查后串行集成。出现共享协议问题时先暂停受影响工作，由主 agent 更新协议、测试并同步共同基线后恢复。C 可并行审查已成形代码，但最终审查必须基于集成版本及其测试证据。测试配置、依赖及 CI 等共享文件由主 agent 统一管理。

### 阶段 3：集成、修复、复核与 UI 验证

主 agent 检查实际改动、运行全部验收测试和 build；C 报告问题后，由主 agent 修复，C 再次核实。循环直到没有 unresolved blocker。若环境支持真实浏览器，执行第 8 节完整流程并记录证据；不支持则准确记录未验证范围。

### 阶段 4：Git 与最终 CI

所有功能完成并经 reviewer 复核后，整理提交历史，push 新 feature branch，创建到 main 的 PR，**不自动合并**。本地验证和 reviewer 复核在 push 前完成；GitHub CI 在 push/PR 后检查，不以“先有 CI 才能 push”形成循环。

必须等待最终 PR HEAD 的 CI 通过。CI 失败则修复、重跑相关检查并复核；整理历史、追加修复或改动 HEAD 后，旧 SHA 的 CI 不能作为最终证据。

## 4. Simulation 实现要求

Subagent A 实现：

- 自动选择最近存活敌人；同距离使用明确的 deterministic tie-break。
- 使用 hex movement、BFS 或等价确定性寻路。
- 单位不能重叠，不能进入任何存活单位占据的 hex。
- 战斗移动允许跨越准备阶段部署区边界；只复用 hex 几何和战场边界，不复用部署许可规则。
- attack range、attack interval / cooldown、普攻伤害、HP、death。
- target death 后重新寻敌。
- `playerWin`、`enemyWin`、`draw`、maximum combat duration。
- 不使用 `Math.random()`；规则不读取真实时间、动画状态或其他非确定性输入。

每 tick 按以下顺序结算：

1. target selection / movement。
2. 根据移动后、伤害前的状态生成攻击。
3. 汇总本 tick damage。
4. 同时应用 damage。
5. death resolution。
6. result resolution。

本 tick 有资格攻击的单位，即使被同 tick 伤害击杀，其已经生成的攻击仍参与结算。双方同 tick 全部死亡为 `draw`。finished 后 `stepCombat` 不再推进 tick，不生成移动、攻击、伤害或重复 finished 事件。

同一初始 CombatState 必须产生完全相同的 CombatEvent 序列、最终 CombatState 与战斗结果；不能因原始 `units` 数组顺序产生不合理先手。

## 5. 必须在 Contract 冻结时明确的执行约定

这些约定用于消除歧义，不扩大功能范围：

1. **稳定顺序**：使用稳定 unit ID 比较与固定 hex 邻居遍历顺序；目标并列、等长路径、移动争抢、事件排序均不得依赖数组插入顺序。对输入数组重排做额外验证。
2. **移动争抢**：规划阶段读取同一占用快照，冲突按明确的稳定优先级决定唯一落点；其他单位等待或按已冻结策略确定性重规划。不得用顺序更新绕过占用限制，不允许交换进入对方仍占据的格。
3. **寻路终点**：到达攻击范围内的合法空格即可，不能要求走入敌人格。最近目标被阻挡、无路径或完全包围时，明确等待/重规划策略；不得重叠、无限搜索或崩溃，并由最大时长保证结束。
4. **数值边界**：攻击范围、间隔、移动节奏、普攻伤害公式、护甲是否参与计算、最大持续时间、首次攻击时机，在阶段 1 用简单常量/规则明确并测试。原规格未给具体数值，本轮不将猜测视为已确认实现。
5. **终局与超时**：先根据本 tick 同时伤害与死亡判断全灭/单方胜利；若仍未分胜负且达到最大 tick，则 `draw`。冻结空阵容/单方无单位的初始终局语义。
6. **Reset 快照**：恢复本场点击 Start 时的准备阶段站位与完整单位，包括 bench。第二场重新部署后产生新的本场快照，不能总回到应用首次加载状态。
7. **帧率边界**：逐帧只累积 delta，按剩余时间每满 50 ms 推进一次；低帧率可补多个 tick。若设置单帧工作上限，保留未处理时间，不静默丢弃逻辑 tick。测试等总时长不同 delta 分片获得同样结果。
8. **验证口径**：浏览器不可用不等于 UI 通过；应保留“未验证”。如果端到端成功条件仍缺证据，不宣布完整 Goal 已完成。

## 6. Rendering / interaction 实现要求

Subagent B 实现流程：

`准备阶段 → Start Combat → combat → Victory / Defeat / Draw → Reset to Preparation`

- Phaser `update(delta)` 仅累计真实时间，再按固定 50 ms tick 调用 simulation。
- 帧率不能直接决定移动、攻击或伤害；动画完成回调不能决定战斗结果。
- 根据 CombatState / CombatEvent 显示移动、HP bar、普攻反馈、受击反馈、death、battle result。
- 动画保持简单，可用 tween、flash、简单 projectile / line、HP bar；不做复杂 VFX、3D 或正式资产。
- combat 期间禁止部署，禁止重复 Start，防止多个 simulation loop。
- 状态切换同时约束按钮、拖拽事件处理入口和迟到回调，防止拖拽中点击 Start 等路径修改准备状态。

Reset 必须：

- 恢复本场原始准备阶段站位和完整单位。
- 清除 combat HP、death、cooldown。
- 清除 projectile、tween、combat events、时间累积及可能的旧回调。
- 恢复部署操作，允许重新 Start。
- 第二场由当前准备状态重新 `createCombat`，不继承第一场任何战斗状态。

## 7. 独立 review 与自动测试

C 必须基于真实代码、diff 和实际测试结果重点检查：simulation/rendering 耦合、state mutation、部署规则被误用于战斗移动、同格争抢、blocked path、target death、simultaneous kill、timeout、重复 Start、combat 中拖拽、Reset 后 HP/cooldown/dead state 残留、第二场状态串联、tick/FPS 耦合、非确定性行为。

问题报告需包含文件/位置、可复现条件、影响和证据；修复由主 agent 处理，C 再次检查关闭。无证据的完成声明不能代替 review。

以下测试全部为后续必做，当前均未实现/未验收：

- [ ] createCombat 不包含 bench。
- [ ] preparation state 不会被 combat 修改，含嵌套引用隔离。
- [ ] 1v1 可以完整结束。
- [ ] 2v2 可以完整结束。
- [ ] 远距离单位能够接近敌人。
- [ ] 所有 tick 内单位不会占据相同 hex，覆盖两单位争抢同一格。
- [ ] 目标死亡后重新选择目标。
- [ ] 同距离 target selection 可复现。
- [ ] 同长度 path selection 可复现。
- [ ] same-tick mutual kill 得到 draw。
- [ ] timeout 得到 draw。
- [ ] finished combat 不再推进或产生新事件。
- [ ] 相同初始状态运行两次得到相同事件序列、最终状态及结果。
- [ ] Reset 后恢复本场 Start 前站位及完整单位。
- [ ] 第二场不继承第一场 HP、death、cooldown。
- [ ] 原有全部测试继续通过，原有部署功能无 regression。

补充边界测试：数组重排、blocked path、跨部署区移动、攻击范围/间隔边界、超时临界 tick、重复 Start、combat 拖拽、Reset 清理、等总时长不同帧 delta。UI/controller 测试与真实浏览器验证分开报告。

## 8. 浏览器验证

实现阶段实际检查当前环境能否运行真实浏览器；若支持，必须执行并记录：

1. 准备阶段拖动 player 单位。
2. 点击 Start Combat。
3. 单位自动移动并攻击。
4. HP 正确下降。
5. 单位死亡。
6. 显示 Victory / Defeat / Draw 中对应结果。
7. 点击 Reset。
8. 本场原始站位恢复。
9. 再次改变站位。
10. 第二次 Start Combat 正常完成。

同时检查 combat 中拖拽被禁止、重复 Start 不产生额外循环。记录浏览器、版本/运行方式、测试代码 SHA、操作结果及截图/日志等可复核证据；正常流程不得只靠直接修改内部状态模拟。

若不支持真实浏览器，明确记“未验证”、具体环境限制及需要的能力；不得把 unit tests 描述为实际 UI 已验证。

## 9. 成功条件与证据门禁

只有全部成立才宣布 M1 Goal 完成：

- [ ] `npm test` 全部通过，有最终版本日志。
- [ ] `npm run build` 成功，有最终版本日志。
- [ ] GitHub CI 通过，记录对应最终 PR HEAD SHA 与 run/check URL。
- [ ] simulation / rendering 保持分层，有代码与 reviewer 证据。
- [ ] 没有明显 state mutation，有隔离测试及 review 证据。
- [ ] reviewer 没有 unresolved blocker，记录复核结论。
- [ ] 一场战斗从准备阶段完整进入结果阶段，有对应流程证据。
- [ ] 能 Reset 回准备阶段，有站位与清理证据。
- [ ] 能再次开始并完成第二场战斗，有状态隔离证据。
- [ ] deterministic tests 通过。
- [ ] 原有部署功能无 regression。

不能把基线的 8 个通过测试、无 CI 状态或计划审查当作 M1 已验收。任何条件未满足，继续检查、修复和验证；遇到当前环境无法解决的 blocker，停止进一步破坏性修改，报告 blocker、已验证证据和恢复工作所需条件。

## 10. 最终交付报告模板

实现完成后最终报告必须提供：

- 使用哪些 subagents，以及每个 subagent 的实际工作。
- 修改文件摘要。
- architecture decisions，包括公共 Contract、确定性规则、状态隔离、固定 tick 和 Reset 设计。
- 测试结果及对应版本。
- 浏览器验证结果；未验证项目须明确保留。
- reviewer 发现的问题、修复内容及复核证据。
- unresolved issues，不能隐藏 blocker。
- final commit SHA。
- PR URL；PR 指向 main，不自动合并。

本轮子代理记录：`plan_review` 负责只读规格冲突审查与基线/计划复核，没有实现功能。后续 A/B/C 的实现与验收工作尚未启动。
