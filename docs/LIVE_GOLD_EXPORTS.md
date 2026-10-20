# 战中实时金币：领域导出与重放输入

基线：`codex/live-gold-exports`，`2aaa537c02f6675a952ea26894c79996067543b3`。
只补领域接口、输入记录和验证；不改战斗规则、数值、RNG、版本、digest 或指纹。
本文件补充 [D11 接线](D11_WIRING_V15.md) 的 D11-SERVER-LIVE-BANK，覆盖其中 `sampleBankGold():void` 的旧返回类型。
全部接口和所列类型均从 `src/server-entry/index.ts` 导出。

## R1：哪些席位需要实时银行

```ts
interface BattleLiveGoldReader {
  readonly seatId: string;
  readonly team: 'player' | 'enemy';
  readonly readsLiveGold: boolean;
}
readBattleLiveGoldReaders(
  input: Pick<BattleInput, 'a' | 'b' | 'mirrorOfSeatId'>,
): readonly BattleLiveGoldReader[];
```

纯函数，读取可信两侧快照或完整 `BattleInput`，固定返回 A/player、B/enemy 两条。
必须是 `avarice-incarnate` 绑定，且绑定单位在该快照玩家棋盘上，才返回 true。
`mirrorOfSeatId !== null` 时 B 一律 false；A 仍按自身绑定判断。
只持有两侧快照时传 `{a, b, mirrorOfSeatId: null}`，镜像局传镜像来源席位 ID。
此查询不替代 `compileBattle` / `restoreBattleInput` 的输入校验。

## R2：计算一个 tick，同时取得显示帧

```ts
startTwoSidedBattle(input: BattleInput, options: {readonly captureReplay: true}): BattleReplayTask;
interface BattleReplayStep {
  readonly frame: CombatReplayTick | null;
  readonly result: BattleResult | null;
}
interface BattleReplayTask extends BattleTask {
  readonly initial: CombatViewState;
  readonly initialFrame: CombatReplayTick;
  advanceTick(): BattleReplayStep;
  replay(): CombatReplay | null;
}
```

先发 `task.initial` 和 `task.initialFrame`（tick 0）。每个权威 tick 调用一次
`advanceTick()`，返回本次新算出的帧；帧格式与 `toCombatReplay` 相同，包含显示事件、
`unitUpdated`、成员进出及原有关键帧。完成那次同时返回最后一帧和私有 `BattleResult`。
完成后重复调用返回 `{frame:null,result:原结果}`，不重发最后一帧。
tick 0 已结束的战斗第一次调用只返回结果，tick 0 帧已经在 `initialFrame` 中。
`replay()` 在完成前为 null，完成后为本次计算捕获的完整公开录像，无二次战斗计算。
原 `advance(maxTicks)` 保留；流式发送应只用 `advanceTick()`，`advance(n)` 不补发已跨过的帧。

PvE 继续用权威 `stepMatch` 推进（保留收入、结算、掉落等现有链路），使用同一记录器取帧：

```ts
createCombatReplayRecorder(initialState: CombatState,
  initialEvents: readonly LedgerCombatEvent[]): CombatReplayRecorder;
interface CombatReplayRecorder {
  readonly initial: CombatViewState;
  readonly initialFrame: CombatReplayTick;
  record(previousState: CombatState, step: CombatStep): CombatReplayTick;
  finish(terminalState: CombatState): CombatReplay;
}
```

`record` 传入 `stepMatch` 返回的 combat 和过滤 `domain==='combat'` 的事件；记录器不推进规则。
PvP `advanceTick` 与 PvE `record` 使用同一实现，测试比较逐帧 JSON 字节。

## R3：采样是否生效

```ts
BattleTask.sampleBankGold(seatId: string, liveGold: number): boolean;
sampleD11CombatGold(combat: CombatState, team: 'player' | 'enemy', liveGold: number): CombatState;
```

前者 true 表示战斗状态改变且追加私有样本；相同有效银行、未绑定席位、镜像 B 返回 false。
后者保留原签名，返回引用与入参比较即可判断改变，不变返回原对象。
低层 `sampleD11CombatGold` 不知道席位或镜像身份；镜像过滤由双边任务负责。
服务器只传本席权威 `Match.gold`，在金币命令提交后、下个 tick 前采样；不可接受客户端自报。
待结算战斗收益仍由原函数计算并加一次，不能把它们先并入传入的 liveGold。
这些接口不消耗 RNG、不发资源、不产生领域事件。

失败：双边任务错误阶段抛 `BattleValidationError('wrong-phase')`；陌生席位、非法金币、
超过既有 100000 条样本上限抛 `invalid-bank-sample`。低层负数/非安全整数抛 RangeError。
原 `advance` 非正安全整数预算仍抛 `invalid-budget`。

## R4：样本、收据及从头重跑

```ts
interface CombatBankSample {
  readonly tick: number; // tick t 完成后、推进 t+1 前应用，tick 0 也有效
  readonly team: 'player' | 'enemy';
  readonly liveGold: number; // 权威银行，不含本战待结算收益
}
// PvP：BattleResult.bankSamples?: readonly CombatBankSample[];
// 联机 PvE：CombatState.bankSamples?: readonly CombatBankSample[];
// PvE 结算：RoundResult.bankSamples?: readonly CombatBankSample[];
type CombatReplayInput = Pick<BattleResult, 'initial' | 'terminal' | 'events' | 'bankSamples'>
  & Partial<Pick<BattleResult, 'mirrorOfSeatId'>>;
startCombatReplay(input: CombatReplayInput): CombatReplayTask;
toCombatReplay(input: CombatReplayInput): CombatReplay;
```

联机 PvE 的 `stepMatch` 沿原采样位置，只在采样真的改变战斗状态时把 `{tick,team:'player',liveGold}`
追加到 combat；样本随每个 tick 保留，终战复制到本轮 `RoundResult.bankSamples`。
新战斗从全新 combat 开始，无前一战样本。单机路径不增加采样、不改变旧逻辑。
PvP 继续由 `BattleTask` 记录到 `BattleResult`，`proposeSettlement` 从原始状态重跑验证该轨迹，
并拒绝镜像 B 的样本。完整双边样本保存在服务器私有战斗记录，不复制到对手的席位收据。

从头回放用 `{initial,terminal,events,bankSamples}`；保留完整 PvP 结果时直接传结果即可。
PvE 也可从 `terminal.bankSamples` 读取，显式 bankSamples 与 terminal 中的记录必须一致。
按原数组顺序在对应 tick、下一次 `stepCombat` 前注入；同 tick 多次更改保留提交顺序。
省略样本且 terminal 也无样本时严格走旧路径，不增加字段，旧无贪财化身结果/录像字节保持。

校验覆盖：非空数组、至多 100000 条、严格字段、非负安全整数金币、tick 非递减且小于终战 tick、
合法 team、对应初始贪财持有者；镜像身份存在时拒绝 enemy 样本；无效/重复不改变状态的样本拒绝。
重跑核对可见事件、终战视图；有样本时额外核对完整终战领域状态（扣除 PvE 样本元数据）。
非法结构抛 RangeError，轨迹不符抛 `replay-divergence`；结算轨迹不符抛 `invalid-result`。
这验证样本与可信战斗结果的一致性，不能认证任意伪造的整套输入；没有增加密码学签名或外部银行流水认证。

### 隐私边界

`bankSamples`、`initial/terminal CombatState`、`BattleResult`、含样本的 PvE `RoundResult`
均为服务器私有重跑证据，不能向玩家或观战者原样发送，也不接受客户端上传覆盖权威值。
尤其不能把 `advanceTick()` 的整个返回对象发出去，`result` 含双方私有数据。
只发送白名单 `initial:CombatViewState` / `initialFrame` / `frame:CombatReplayTick` / `CombatReplay`。
公开录像没有 bankSamples/liveGold/currentItemBankGold/openingItemBankGold；私有席位投影也不携带这些样本。
伤害等实际战斗结果仍公开，不承诺玩家无法从战斗结果推断增伤区间。
不扩展联机完整 Match 的离线读档能力，不修改服务器或浏览器展示层。

## 验证

所有测试逐文件运行：`npx.cmd vitest run <file> --configLoader runner`；新测试不设单条时限。
`npx.cmd tsc --noEmit` 通过；以下 **7 文件 / 121 项** 全部通过，未跑全套或端到端：

| 文件（tests/） | 通过数 |
| --- | ---: |
| live-gold-exports.test.ts | 13 |
| combat-first-pass-frames.test.ts | 11 |
| b8-resumable-battle.test.ts | 15 |
| t5r-combat-replay.test.ts | 46 |
| d11-wiring-online.test.ts | 10 |
| d11-wiring-match.test.ts | 5 |
| t2-two-sided-battle.test.ts | 21 |

`b8-resumable-battle` 原有 v15 结果/录像指纹断言通过，未修改任何指纹、fixture、版本或 digest。
`combat-first-pass-frames` 的旧任务键名断言同步包含基线已有的 sampleBankGold，其余验收不变。
`git diff --check` 通过。所有改动留工作区，未修改 Git 元数据、安装依赖、联网或运行独立 exe。

建议提交信息：`feat(simulation): expose live gold combat frames and replay bank samples`
