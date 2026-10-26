# Seek 性能修复：调用点核对（2026-10-27）

基线 `codex/seek-perf-2@1cbbd076`。下面穷举当前 `src/`、`scripts/`、`tests/` 内所改函数及新内部函数的直接调用表达式；同一行的多次调用合并列出。所有公开签名、异常消息、格式、digest 与规则版本不变。

| 函数 | 直接调用点 | 核对结论 |
| --- | --- | --- |
| `equalContent` | [src/replay/history.ts:41](../src/replay/history.ts#L41) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/replay/history.ts:42](../src/replay/history.ts#L42) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/replay/history.ts:44](../src/replay/history.ts#L44) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/replay/history.ts:45](../src/replay/history.ts#L45) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/replay/playback-session.ts:44](../src/replay/playback-session.ts#L44) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:75](../src/simulation/battle-record-validation.ts#L75) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:87](../src/simulation/battle-record-validation.ts#L87) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:91](../src/simulation/battle-record-validation.ts#L91) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:92](../src/simulation/battle-record-validation.ts#L92) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:94](../src/simulation/battle-record-validation.ts#L94) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:97](../src/simulation/battle-record-validation.ts#L97) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:113](../src/simulation/battle-record-validation.ts#L113) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:125](../src/simulation/battle-record-validation.ts#L125) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:178](../src/simulation/battle-record-validation.ts#L178) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:183](../src/simulation/battle-record-validation.ts#L183) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:187](../src/simulation/battle-record-validation.ts#L187) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:231](../src/simulation/battle-record-validation.ts#L231) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:235](../src/simulation/battle-record-validation.ts#L235) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:237](../src/simulation/battle-record-validation.ts#L237) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:240](../src/simulation/battle-record-validation.ts#L240) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:255](../src/simulation/battle-record-validation.ts#L255) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:259](../src/simulation/battle-record-validation.ts#L259) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [src/simulation/battle-record-validation.ts:260](../src/simulation/battle-record-validation.ts#L260) | 已核对：结构、版本、事件、历史及结算仍逐项比较；特殊数据回退原编码器 |
| `equalContent` | [tests/m6-replay-equality.test.ts:19](../tests/m6-replay-equality.test.ts#L19) | 已核对：测试调用；原有断言保留，新增边界/逐帧断言 |
| `equalContent` | [tests/m6-replay-equality.test.ts:22](../tests/m6-replay-equality.test.ts#L22) | 已核对：测试调用；原有断言保留，新增边界/逐帧断言 |
| `equalContent` | [tests/m6-replay-equality.test.ts:23](../tests/m6-replay-equality.test.ts#L23) | 已核对：测试调用；原有断言保留，新增边界/逐帧断言 |
| `equalContent` | [tests/m6-replay-equality.test.ts:25](../tests/m6-replay-equality.test.ts#L25) | 已核对：测试调用；原有断言保留，新增边界/逐帧断言 |
| `equalContent` | [tests/m6-replay-equality.test.ts:27](../tests/m6-replay-equality.test.ts#L27) | 已核对：测试调用；原有断言保留，新增边界/逐帧断言 |
| `equalContent` | [tests/m6-replay-equality.test.ts:36](../tests/m6-replay-equality.test.ts#L36) | 已核对：测试调用；原有断言保留，新增边界/逐帧断言 |
| `equalContent` | [tests/m6-replay-equality.test.ts:40](../tests/m6-replay-equality.test.ts#L40) | 已核对：测试调用；原有断言保留，新增边界/逐帧断言 |
| `equalContent` | [tests/m6-replay-equality.test.ts:44](../tests/m6-replay-equality.test.ts#L44) | 已核对：测试调用；原有断言保留，新增边界/逐帧断言 |
| `equalPlainContent` | [src/simulation/battle-record-validation.ts:58](../src/simulation/battle-record-validation.ts#L58) | 已核对：递归遍历完整数据；无跨调用验证缓存 |
| `equalPlainContent` | [src/simulation/battle-record-validation.ts:65](../src/simulation/battle-record-validation.ts#L65) | 已核对：递归遍历完整数据；无跨调用验证缓存 |
| `copyCombatUnitForTick` | [src/simulation/combat-s13.ts:159](../src/simulation/combat-s13.ts#L159) | 已核对：只读记录复制/冻结；可写 runtime 隔离；特殊值保留原生复制回退 |
| `copyCombatUnitForTick` | [tests/mp-sim-perf.test.ts:88](../tests/mp-sim-perf.test.ts#L88) | 已核对：测试调用；原有断言保留，新增边界/逐帧断言 |
| `copyCombatUnitForTick` | [tests/mp-sim-perf.test.ts:98](../tests/mp-sim-perf.test.ts#L98) | 已核对：测试调用；原有断言保留，新增边界/逐帧断言 |
| `copyCombatUnitForTick` | [tests/mp-sim-perf.test.ts:116](../tests/mp-sim-perf.test.ts#L116) | 已核对：测试调用；原有断言保留，新增边界/逐帧断言 |
| `copyCombatUnitForTick` | [tests/mp-sim-perf.test.ts:118](../tests/mp-sim-perf.test.ts#L118) | 已核对：测试调用；原有断言保留，新增边界/逐帧断言 |
| `cloneTickRecord` | [src/simulation/combat-static.ts:91](../src/simulation/combat-static.ts#L91) | 已核对：只读记录复制/冻结；可写 runtime 隔离；特殊值保留原生复制回退 |
| `immutableTickRecord` | [src/simulation/combat-static.ts:122](../src/simulation/combat-static.ts#L122) | 已核对：只读记录复制/冻结；可写 runtime 隔离；特殊值保留原生复制回退 |
| `immutableTickRecord` | [src/simulation/combat-static.ts:123](../src/simulation/combat-static.ts#L123) | 已核对：只读记录复制/冻结；可写 runtime 隔离；特殊值保留原生复制回退 |
| `updateG23Cells` | [src/simulation/match.ts:117](../src/simulation/match.ts#L117) | 已核对：只投影 Family/Experiment；仍使用同一成员与 tier 实现 |
| `advanceS13Tick` | [src/simulation/combat-tick.ts:38](../src/simulation/combat-tick.ts#L38) | 已核对：50 ms tick、事件顺序、RNG、结算均不变 |
| `p2Target` | [src/simulation/combat-s13.ts:294](../src/simulation/combat-s13.ts#L294) | 已核对：距离与 ID 决胜不变；移动冷却未就绪时不做无用目标计算 |
| `p2Target` | [src/simulation/combat-s13.ts:323](../src/simulation/combat-s13.ts#L323) | 已核对：距离与 ID 决胜不变；移动冷却未就绪时不做无用目标计算 |
| `p2Target` | [tests/s13-augments-p2-combat.test.ts:126](../tests/s13-augments-p2-combat.test.ts#L126) | 已核对：测试调用；原有断言保留，新增边界/逐帧断言 |
| `p2Target` | [tests/s13-augments-p2-combat.test.ts:193](../tests/s13-augments-p2-combat.test.ts#L193) | 已核对：测试调用；原有断言保留，新增边界/逐帧断言 |
| `refreshMechanismAuras` | [src/simulation/combat-effects.ts:76](../src/simulation/combat-effects.ts#L76) | 已核对：每次刷新重建来源索引；不跨 tick 保存，不跳过贡献移除/状态归纳 |
| `refreshMechanismAuras` | [src/simulation/combat-s13.ts:304](../src/simulation/combat-s13.ts#L304) | 已核对：每次刷新重建来源索引；不跨 tick 保存，不跳过贡献移除/状态归纳 |
| `refreshMechanismAuras` | [src/simulation/m8/s13-mechanisms.ts:396](../src/simulation/m8/s13-mechanisms.ts#L396) | 已核对：每次刷新重建来源索引；不跨 tick 保存，不跳过贡献移除/状态归纳 |

内部闭包也已核对：`cloneTickRecord` 内的 `clone` 仅在 `src/simulation/combat-static.ts:77,84` 递归和入口调用；`equalPlainContent` 内的 `scalar` 仅在 `src/simulation/battle-record-validation.ts:40` 检查两侧；aura 的 `sourceKey` 仅在 `src/simulation/m8/s13-mechanisms.ts:310,316` 使用。均没有外部调用或跨调用验证结果缓存。

## 应用、在线回放及服务器

- 单人回放：`src/m6/application.ts:265` 构造 `PlaybackSession(record, preceding)`；构造验证、检查点和 `read/seek/advance` API 未改。`src/replay/playback-session.ts:24,44` 分别进入完整验证和逐步事件比较。
- 在线客户端：`src/rendering/online/remote-session.ts:120,191,212,230,245` 调用 `applyCombatReplayTick` 应用服务器帧，不构造 `PlaybackSession`，也不重新计算战斗。`src/rendering/online/ws-client.ts:222,381,429` 组合/修订已传输帧。上述文件均未改。
- 服务器 PvP：`src/server/room/two-sided-resolver.ts:99,116` 创建 `startTwoSidedBattle`/`startTwoSidedBattleSteps`，`:70` 推进任务；`src/simulation/two-sided-battle.ts:317,325` 调用 `stepCombat`，`:209` 为独立重演核对。服务器目录未改。
- 服务器 PvE：`src/server/room/combat-stream.ts:103` 调用 `stepMatchCombatStream`；`src/simulation/match.ts:524,555` 的 `stepMatchCombatStream`/`stepMatch` 调用 `stepCombat`；`src/simulation/combat.ts:138` → `advanceCombatTick` → `src/simulation/combat-tick.ts:38` → `advanceS13Tick`，使用同一复制、目标和 aura 实现。
- 在线帧接收路径已作只读核对；`tests/t5r-combat-replay.test.ts`、`tests/yieldable-battle-setup.test.ts` 对服务器生成的 PvP/PvE 帧、回放字节与分片推进做自动验证。没有运行浏览器或网络端到端测试。

## v23 源码证据失效范围

- `src/simulation/battle-record-validation.ts`
- `src/simulation/combat-s13.ts`
- `src/simulation/combat-static.ts`
- `src/simulation/g2-3-state.ts`
- `src/simulation/m8/s13-mechanisms.ts`
- `src/simulation/s13-augments-p2-combat.ts`

以上六个文件使以下审计中的对应 `sourceDigests` 失效；未改这些录制证据、内容身份常量或历史 fixture，交由 Claude 重录：

- `docs/evidence/v23-online-rules/battle-start-audit.json`：6 个修改源码 digest。
- `docs/evidence/v23-online-rules/input-fixture-audit.json`：6 个修改源码 digest。
- `docs/evidence/v23-online-rules/live-reveal-audit.json`：6 个修改源码 digest。
- `docs/evidence/v23-online-rules/release-audit.json`：6 个修改源码 digest。
