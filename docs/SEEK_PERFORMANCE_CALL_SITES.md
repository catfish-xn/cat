# Seek 性能修复：调用点核对（2026-10-27）

本轮基线 `codex/seek-perf-2@c2a61d8765b6`；该 HEAD 已包含上一轮 `1cbbd076` 之后的优化。本轮未提交。下表包含前后两轮所改函数及新增内部函数在 `src/`、`scripts/`、`tests/` 中的全部直接调用表达式，同一行的多次调用合并；按导入来源区分同名 `mechanic` / `isSelectable`。公开原签名、异常、格式、规则与 digest 常量不变。

## 逐函数直接调用点

| 函数 | 全部直接调用点 | 核对结论 |
| --- | --- | --- |
| `equalContent` | [src/replay/history.ts](../src/replay/history.ts#L41): 41, 42, 44, 45<br>[src/replay/playback-session.ts](../src/replay/playback-session.ts#L44): 44<br>[src/simulation/battle-record-validation.ts](../src/simulation/battle-record-validation.ts#L75): 75, 87, 91, 92, 94, 97, 113, 125, 178, 183, 187, 231, 235, 237, 240, 255, 259, 260<br>[tests/m6-replay-equality.test.ts](../tests/m6-replay-equality.test.ts#L19): 19, 22, 23, 25, 27, 36, 40, 44 | 已核对：完整比较与特殊数据回退不变；未改验证缓存边界 |
| `equalPlainContent` | [src/simulation/battle-record-validation.ts](../src/simulation/battle-record-validation.ts#L58): 58, 65 | 已核对：完整递归比较不变 |
| `copyCombatUnitForTick` | [src/simulation/combat-s13.ts](../src/simulation/combat-s13.ts#L177): 177<br>[tests/m6-seek-tick-ownership.test.ts](../tests/m6-seek-tick-ownership.test.ts#L22): 22<br>[tests/mp-sim-perf.test.ts](../tests/mp-sim-perf.test.ts#L88): 88, 98, 116, 118 | 已核对：可写运行态仍隔离；新增只读 P2 开场事实的脱离/冻结复用 |
| `cloneTickRecord` | [src/simulation/combat-static.ts](../src/simulation/combat-static.ts#L91): 91 | 已核对：保留原生特殊图回退和访问器语义 |
| `immutableTickRecord` | [src/simulation/combat-static.ts](../src/simulation/combat-static.ts#L122): 122, 123 | 已核对：只共享已脱离的只读值；不保存验证结果 |
| `updateG23Cells` | [src/simulation/match.ts](../src/simulation/match.ts#L117): 117 | 已核对：上一轮 Family/Experiment 投影优化保留 |
| `advanceS13Tick` | [src/simulation/combat-tick.ts](../src/simulation/combat-tick.ts#L38): 38 | 已核对：动作/伤害/回蓝分段，顺序、RNG、事件及结算不变 |
| `p2Target` | [src/simulation/combat-s13.ts](../src/simulation/combat-s13.ts#L312): 312, 344<br>[tests/s13-augments-p2-combat.test.ts](../tests/s13-augments-p2-combat.test.ts#L126): 126, 193 | 已核对：线性选择；普通目标不构造完整候选数组；距离和 ID 决胜不变 |
| `refreshMechanismAuras` | [src/simulation/combat-effects.ts](../src/simulation/combat-effects.ts#L76): 76<br>[src/simulation/combat-s13.ts](../src/simulation/combat-s13.ts#L322): 322<br>[src/simulation/m8/s13-mechanisms.ts](../src/simulation/m8/s13-mechanisms.ts#L418): 418<br>[tests/m6-seek-tick-ownership.test.ts](../tests/m6-seek-tick-ownership.test.ts#L71): 71, 75 | 已核对：仅一次刷新内复用投影；效果/贡献移除后立即失效；仍执行贡献扫描 |
| `move` | [src/simulation/combat-s13.ts](../src/simulation/combat-s13.ts#L314): 314 | 已核对：同一 BFS 内延迟求一次不变攻击范围，邻居顺序不变 |
| `rollPlannedPackets` | [src/simulation/combat-s13.ts](../src/simulation/combat-s13.ts#L352): 352, 353, 407 | 已核对：每单位仍认证暴击授权；无 packet 时省去空排序/Map；穿透共享暴击与抽签顺序不变 |
| `planActions` | [src/simulation/combat-s13.ts](../src/simulation/combat-s13.ts#L410): 410 | 已核对：仅提取原动作阶段，tick 内闭包，无跨 tick 状态 |
| `resolvePackets` | [src/simulation/combat-s13.ts](../src/simulation/combat-s13.ts#L653): 653 | 已核对：仅提取原伤害阶段，保留每条 packet 与其派生事件 |
| `settleMana` | [src/simulation/combat-s13.ts](../src/simulation/combat-s13.ts#L743): 743 | 已核对：仅提取原回蓝阶段，零增量的原验证也完整执行 |
| `mechanic` | [src/simulation/combat-g2.ts](../src/simulation/combat-g2.ts#L188): 188, 193<br>[src/simulation/combat-s13-abilities.ts](../src/simulation/combat-s13-abilities.ts#L134): 134<br>[src/simulation/combat-s13-state.ts](../src/simulation/combat-s13-state.ts#L134): 134<br>[src/simulation/combat-s13.ts](../src/simulation/combat-s13.ts#L83): 83, 144, 202, 405, 616, 623, 706, 712, 725, 730, 732<br>[src/simulation/serialization-structure.ts](../src/simulation/serialization-structure.ts#L481): 481, 484, 491, 514, 533, 586, 587, 595, 599<br>[tests/g2-4b-unstable-chest.test.ts](../tests/g2-4b-unstable-chest.test.ts#L395): 395 | 已核对：按原顺序累加所有匹配项，无 filter/reduce 中间数组 |
| `isControlled` | [src/simulation/combat-movement.ts](../src/simulation/combat-movement.ts#L20): 20<br>[src/simulation/combat-s13.ts](../src/simulation/combat-s13.ts#L296): 296 | 已核对：保留 legacy stun 检查，仅查询相关冻结状态类型 |
| `isSelectable` | [src/simulation/anomalies/summons.ts](../src/simulation/anomalies/summons.ts#L51): 51<br>[src/simulation/combat-replay-view.ts](../src/simulation/combat-replay-view.ts#L81): 81<br>[src/simulation/combat-s13-state.ts](../src/simulation/combat-s13-state.ts#L159): 159<br>[src/simulation/m8/s13-targeting.ts](../src/simulation/m8/s13-targeting.ts#L10): 10<br>[src/simulation/s13-augments-p2-combat.ts](../src/simulation/s13-augments-p2-combat.ts#L85): 85<br>[tests/s13-anomalies-b.test.ts](../tests/s13-anomalies-b.test.ts#L35): 35, 59, 60<br>[tests/s13-anomalies-c.test.ts](../tests/s13-anomalies-c.test.ts#L22): 22, 77<br>[tests/s13-anomalies-review.test.ts](../tests/s13-anomalies-review.test.ts#L76): 76<br>[tests/v23-review-sion.test.ts](../tests/v23-review-sion.test.ts#L118): 118 | 已核对：presence/proxy/invisible 条件不变，仅查询 untargetable 状态 |
| `hasEffectiveStatus` | [src/simulation/anomalies/availability.ts](../src/simulation/anomalies/availability.ts#L22): 22<br>[src/simulation/combat-movement.ts](../src/simulation/combat-movement.ts#L10): 10<br>[tests/m6-seek-tick-ownership.test.ts](../tests/m6-seek-tick-ownership.test.ts#L40): 40, 72, 76 | 已核对：只对指定类型求有效来源；无验证缓存 |
| `statusMagnitude` | [src/simulation/combat-s13.ts](../src/simulation/combat-s13.ts#L86): 86<br>[src/simulation/m8/s13-mechanisms.ts](../src/simulation/m8/s13-mechanisms.ts#L383): 383<br>[tests/m6-seek-tick-ownership.test.ts](../tests/m6-seek-tick-ownership.test.ts#L41): 41<br>[tests/m8-b4-integration.test.ts](../tests/m8-b4-integration.test.ts#L50): 50, 52, 59<br>[tests/m8-b4-tear.test.ts](../tests/m8-b4-tear.test.ts#L27): 27 | 已核对：仍从当前 tick 贡献求最大有效幅度，保留零幅度有效状态 |
| `summarizeGroup` | [src/simulation/m8/s13-mechanisms.ts](../src/simulation/m8/s13-mechanisms.ts#L257): 257, 288<br>[src/simulation/m8/status.ts](../src/simulation/m8/status.ts#L21): 21, 25, 31, 80, 98, 122 | 已核对：逐贡献重算；未改变时保留只读值，不信任旧摘要 |
| `removeStatusContributions` | [src/simulation/m8/s13-mechanisms.ts](../src/simulation/m8/s13-mechanisms.ts#L327): 327, 399<br>[src/simulation/m8/status.ts](../src/simulation/m8/status.ts#L103): 103, 106<br>[tests/m6-seek-tick-ownership.test.ts](../tests/m6-seek-tick-ownership.test.ts#L44): 44 | 已核对：所有 predicate 仍依次调用；发生移除才复制贡献列表，仍重算有效摘要 |
| `maintainMechanisms` | [src/simulation/combat-s13.ts](../src/simulation/combat-s13.ts#L277): 277<br>[tests/m8-b3-second-integration.test.ts](../tests/m8-b3-second-integration.test.ts#L116): 116 | 已核对：过期、末次 pulse、shield、排序与 nextSeq 调用保留 |
| `replaceStatuses` | [src/simulation/m8/s13-mechanisms.ts](../src/simulation/m8/s13-mechanisms.ts#L288): 288, 302, 328 | 已核对：仅保持相同只读条目数组的身份，保留现有 tick 内 modifier 索引 |
| `targetingEnvironment` | [src/simulation/combat-s13-abilities.ts](../src/simulation/combat-s13-abilities.ts#L235): 235, 258<br>[src/simulation/m8/s13-mechanisms.ts](../src/simulation/m8/s13-mechanisms.ts#L38): 38 | 已核对：显式提供当前投影时避免先生成一个即被覆盖的投影；其他环境字段不变 |

共 132 个“函数/文件/行”调用位置；扫描同时核对了具名导入别名与命名空间导入，以上函数没有漏列的别名或命名空间调用。
内部闭包：`cloneTickRecord.clone` 仅在该函数内递归；`equalPlainContent.scalar` 仅检查两侧；`refreshMechanismAuras.sourceKey` 仅在本次刷新扫描贡献与查重时调用。`planActions`、`resolvePackets`、`settleMana` 每 tick 各执行一次；均不跨 tick、PlaybackSession 或 restoreMatch 保留计划/验证结果。

## 单人、在线客户端及服务器

- 单人：`src/m6/application.ts:265` 构造 `PlaybackSession(record, preceding)`；`src/replay/playback-session.ts:25` 调用完整 `validateBattlePlayback`，`:43,44` 继续通过 `stepCombat` 推进并完整比较事件。原检查点复用只属于该实例的验证结果。
- 在线客户端：`src/rendering/online/remote-session.ts:120,191,212,230,245` 调用 `applyCombatReplayTick` 消费服务器帧；`ws-client.ts:222,381,429` 组合/修订已传输帧。没有新增客户端战斗规则，也不构造 `PlaybackSession`。上述文件未改。
- 服务器 PvP：`src/server/room/two-sided-resolver.ts:99,116` 创建 `startTwoSidedBattle`/`startTwoSidedBattleSteps`，`:70` 推进任务；`src/simulation/two-sided-battle.ts:317,325` 调用 `stepCombat`，`:209` 为独立重演核对。服务器目录未改。
- 服务器 PvE：`src/server/room/combat-stream.ts:103` 调用 `stepMatchCombatStream`；`src/simulation/match.ts:524,555` 推进 `stepCombat`；`src/simulation/combat.ts:138` → `advanceCombatTick` → `src/simulation/combat-tick.ts:38` → `advanceS13Tick`，使用相同 tick 实现。
- 展示属性仍由 `readCombatStats` 公开只读投影派生，其 `mechanic` 求和顺序不变；没有修改界面布局或展示代码。
- 已运行 `tests/t5r-combat-replay.test.ts` 和 `tests/yieldable-battle-setup.test.ts`，覆盖服务器生成 PvP/PvE 帧与分片推进一致性；没有运行浏览器脚本。

## v23 源码证据失效范围

本轮相对 HEAD 共 9 个 `src/simulation` 文件有改动，完整清单：

- `src/simulation/anomalies/availability.ts`
- `src/simulation/combat-movement.ts`
- `src/simulation/combat-s13-state.ts`
- `src/simulation/combat-s13.ts`
- `src/simulation/combat-static.ts`
- `src/simulation/m8/s13-mechanisms.ts`
- `src/simulation/m8/s13-targeting.ts`
- `src/simulation/m8/status.ts`
- `src/simulation/s13-augments-p2-combat.ts`

上一轮已在 HEAD 修改、此次未再次修改的文件（Claude 重录时同样纳入）：

- `src/simulation/battle-record-validation.ts`
- `src/simulation/g2-3-state.ts`

两轮合计 11 个唯一源码文件。以下审计均需 Claude 重录对应 sourceDigests；本轮没有修改任何审计 JSON、历史 fixture、格式、版本或内容 digest：

- `docs/evidence/v23-online-rules/battle-start-audit.json`：两轮共 11 个源码 digest（本轮 9 个）。
- `docs/evidence/v23-online-rules/input-fixture-audit.json`：两轮共 11 个源码 digest（本轮 9 个）。
- `docs/evidence/v23-online-rules/live-reveal-audit.json`：两轮共 11 个源码 digest（本轮 9 个）。
- `docs/evidence/v23-online-rules/release-audit.json`：两轮共 11 个源码 digest（本轮 9 个）。
