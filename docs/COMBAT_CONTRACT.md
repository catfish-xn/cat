# M5 Combat contract v5

## v19 战斗规则与赛薇卡显示扩展（2026-10-21）

当前规则为 `s13-g2-3-v19`；完整来源、整数公式、开场顺序、缺证约定、状态与恢复见 [V19_MECHANICS](V19_MECHANICS.md)。统领使用实际施法收据；盖伦冻结完整实际最大生命后统一广播；双形按startingCell；姐妹按强化/两种伙伴门槛和参与击杀；蓝发10用0/240/480…单一时钟。黑玫4档绑定为**推断**，标记目标的独立×1.08不叠加。链锯刃低于20%处决、400治疗、200tick击杀刷新增益；仅PvP真实敌方英雄掉3金是用户要求的**魔改**，战后唯一收据到账。

`castOutcome` 领域事件及既有 `toCombatViewEvents(events)` 显示投影，新增可选 `castVariant:{actionSeq:number,move:'flamethrower'|'punch'|'chomp',channelTicks:number,enhanced:boolean,heroAugmentIds:readonly string[]}`。赛薇卡每次施法发送最终选招、实际引导tick数（非引导0）及百变铁手强化结果；当前没有已实装赛薇卡专用英雄强化，heroAugmentIds显式为空。3D按unitId/actionSeq关联cast，直接选择动画与时长，继续服从权威生命/控制状态处理打断；不得自行抽招或消费RNG。投影为脱离引用的白名单数据，首遍/重放一致；无需修改网络封套。

可选 `CombatUnit.v19` 存放盖伦采样/共享生命、蓝发信号序号及一次授予标记、黑玫目标队伍标记。相关新动态战斗恢复从认证输入逐tick重建并对比完整状态；不重发任何收益。家人5只有预留契约，没有新增战斗/经济规则。

## v18 炮手 6：14.24b 的 12/17 B 补丁修正

炮手（Cannoneer，内部 id `artillerist`，归档 `TFT13_Martialist`）6 档成员攻击力加成由 60% 修正为 **70%（7000 Bps）**，依据 `M9_DATA_LEDGER.md` 的 B-12/17 `effects.variables.AD` 行。2/4 档仍为 10%/45%；6 档每 4 次普攻触发的 250% AD 范围物理包不变。运行时表供战斗编译和说明共用，原始归档不改；无公共签名、失败原因、tick 或结算顺序变化。

> M8 B2审计修订待复审，目标合同见 [M8_RULES.md](M8_RULES.md) 与 [M8_UI_CONTRACT.md](M8_UI_CONTRACT.md)。本文件仍描述当前M7运行行为；新类型未接入，正式版本切换由B3–B9完成。

Match freezes `buildStrategySnapshot` before creating Combat. `combat-types.ts`, `ability-types.ts` and `strategy-types.ts` define the boundary; [M5_RULES R5–R6](../M5_RULES.md) defines numerical rules and the19 finite abilities. Runtime S13 execution lives in `combat-s13.ts`, `combat-s13-abilities.ts` and `combat-s13-state.ts`. The legacy standalone engine remains for unchanged low-level/historical primitive tests; its max-shield behavior must not be confused with M5 layers.

- Fixed50ms ticks, maximum1200ticks, movement every5ticks. Existing hex geometry, E/SE/SW/W/NW/NE neighbor ordering and shared occupancy/reservations remain. Nearest-target ties use code-point ID. Input permutations cannot alter semantic ordering.
- Snapshot excludes bench and freezes distinct-definition trait tiers, equipment, augment/anomaly sources, ability variables, AP, base/percentage AD, precise attack speed, initial state and mechanics. Later catalog/Match/UI changes cannot change a running battle. Glass Cannon starts qualifying units at80%HP. No hidden enemy growth is added.
- Combat owns explicit RNG state/draw count and action/event sequences. Each planned ordinary attack consumes one word even at0% or100%crit; Caitlyn consumes one word per bombardment center. Consumption follows tick, actor ID and action index. No visual action consumes RNG.
- Tick barriers: cooldown/expiration/periodic work; existing control; movement; target/action planning; costs/counters/RNG/new shields; stable packet mitigation, redirect and shield absorption; simultaneous HP; surviving-target healing; surviving Mana/kill credit/growth; delayed status effects; death cleanup; elimination before timeout. New control cannot cancel an already planned action in the same tick.
- Ability coefficients are normalized to integer basis points. HP, damage, healing, shields and Mana are integers. Sum coefficient terms then floor once. Physical/magic resistance applies per packet, then additive amplification and strongest reduction, with positive damage at least1. Percentage shred takes the strongest source; flat changes sum; resistance clamps at0. See R6 for exact equations.
- Ordinary attacks gain10Mana. Actual HP damage grants surviving recipients `min(20,floor(hpLoss*3/100))`; shield absorption and overkill grant none. Mana earned this tick can cast next tick. Attack crit25%/140%; skills do not crit. No real damage type is needed by the slice.
- Target selection uses hex cells, never rendering coordinates. Lowest percentage compares integer cross products; Lux uses absolute currentHP. Line/path and cone approximations are explicitly defined in R6. Channel tasks stop on caster death/control; packets already planned land. Attached bleed persists after source death.
- Packet order is source-unit ID, action sequence, target ID, packet ordinal. Virtual remainingHP assigns actual damage and the first killing packet. Loris redirect uses the original target's mitigated amount, floors the50% share and skips a second resistance calculation; its shield still absorbs. Redirect cannot recurse, and multiple eligible Loris sources choose smallest ID.
- Shields are independent source layers. Same-source refresh uses larger remaining amount/later expiry; different sources add. Absorption consumes earliest expiry then source key and records source-specific totals. Irelia decays linearly in integers and tracks absorbed damage independently of remaining shield. Defensive duration records survive shield exhaustion so end effects are not lost.
- Status keys include source/definition/target. Newly delayed statuses start next tick and retain their complete duration: a1second control blocks20ticks. Same-source refresh cannot create a gap; different-source semantics follow the finite mechanic. Periodic tasks explicitly track due tick and remaining shots. Darius' four primary-target bleed packets preserve the integer total including remainders.
- Healing caps at maximumHP and never revives a same-tick dead unit. Gunblade consumes actual damage and cannot recurse. Derived damage does not invent extra attack/cast triggers. Full future tasks and source provenance are part of the serializable state, not hidden closures.
- Tristana's once-per-cast lethal bounce is committed for next tick, and growth occurs only when a secondary bounce actually exists. Growth affects the current battle and is returned to Match once at settlement, including defeated battles. Match alone persists, merges or destroys growth.
- `targetChanged`, `packetDamage`, `heal`, `shieldLayerChanged`, `statusChanged`, `statChanged`, `kill` and `growth` supplement attack/cast/movement/death/finish events. Events retain actor, target, source, action/packet identity and numerical outcomes; actualHP, absorption, requested/actual healing and status changes remain distinguishable. UI can aggregate visual text but cannot truncate the authoritative ledger.
- Dead units remain in state withHP0/alive=false and no active target/action resources. Finished steps are idempotent. Empty/single-sided low-level combats end at tick0; Match owns the permitted empty-player concession and all economic effects.
- Restoration validates frozen and runtime state, including sources, layer aggregates, statuses, task timing, counters and sequences; it does not rerun combatStart. Tests distinguish independent numerical answers from replay/browser consistency using production calculations.


M5审计修订：alreadyMitigated伤害仍允许一次洛里斯分担；redirected实际分担直接在吸收阶段结算，不进入递归或弹射触发。恢复校验按来源/tick/计数验证动态字段和运算上界，schema5死亡单位周期AP只接受有限可达累计值，不声称重建未存储的死亡时刻。

## G2-1 candidate finite extensions

The existing `stepCombat(state) → { state, events }` interface and explicit `lcg32-v1` stream remain unchanged. Optional detached `CombatUnit.expansion` stores cumulative damage, Automata crystals, empowered attacks, chain cast/kills, cooldowns and target IDs. These values and the six `g2*` task kinds are JSON, copied by stepping and range-checked on restore. Amumu is a zero-max-mana passive champion; Zeri never casts. No wall clock or external lookup enters combat.

Every cast coefficient and star rank comes from `content/g2-abilities.ts`, generated from hash-gated normalized records. Twitch draws one random target per enhanced attack and one shared crit result per piercing bolt; secondary Zeri packets follow the existing non-critical extra-attack convention. LeBlanc initial kills scale subsequent empowered attacks. Attached Malzahar infections continue after caster death and transfer from dead targets; other non-attached tasks require a living owner. Trait blast, chain share and retaliation packets resolve on the following tick to avoid recursive same-tick damage.

Source/runtime tables and explicit limitations are in [G2-1 reconciliation](evidence/g2-1/RECONCILIATION.md). This is a candidate with33 heroes; Swain and source/emblem tiers not reachable from this inventory remain outside runtime. This section does not assert full14.24b equivalence.

## G2-4b WIP: Death’s Defiance

`allocateDamage(context, prepared, hp, shields, deferBps=0)` returns an optional
`outcome.deferred` after shield absorption. Packet conservation includes this
amount: mitigated = absorbed + deferred + hpDamage + overkill. Defaults preserve
existing callers. A holder stores `deferredItemDamage` debts with original packet
identity, start tick, total, paid and elapsed ticks. Payments occur before new
packets at the damage barrier over80ticks and never lower HP below1; excess is
consumed. Each positive payment emits `packetDamage` with existing equipment-proc
delivery plus `deferredPayment:true`; proc permissions are empty. No mana, vamp,
shield, redirect or further deferral applies. Debt is cleared on death.
These ordering details are pending project convention G24-DEFIANCE-ORDER-01,
not asserted as verified original script order. Restore rejects missing/foreign
item debt, duplicate or malformed packet provenance, and inconsistent progress.

### G2-4b WIP: mirror membership

`appendMirrorSummons(preparation,strategy)` appends canonical strategy units with
`itemSummon` origin derived from an actual on-board Mirror source.
`projectItemSummons(preparation,strategy)` projects these into combat only.
Restore independently recompiles the strategy and compares origin, identity,
starting cell, frozen form, sources and complete roster. Item summons never enter
permanent inventory/growth or survivor player damage. Trait counts are frozen
before copies; active trait targets extend to copies. `scaleItemSummonHp` applies
the clone multiplier to initial and dynamic health. Inheritance/placement are
pending conventions and this WIP does not claim complete native summon behavior.

### G2-4b WIP: Collector and gold authority

`CombatState.itemGoldReceipts` retains failed and successful rolls. Collector
uses an independent explicit stream and only produces a gold opportunity after
its own execution. The post-packet strict12% check, bypass of shields/Defiance
and exclusion of natural lethal hits are pending convention G24-COLLECTOR-EXECUTE-01.
Gold-item save verification has one explicit exception to structural-only combat
restore: it independently simulates the bounded combat from validated input and
compares receipts/RNG. This is read-only verification; it grants no resources and
does not advance candidate state. No-gold saves incur no combat replay.

### G2-4b WIP: Mogul stacking

`CombatUnit.itemMogulHits` retains at most35 packet/tick identities. Positive
shield-or-HP packets add one stack; deferred repayments do not. Resists affect
later packets. Max HP grows after the fixed-max survival sampling barrier,
preserves missing HP and cannot revive a lethal hit. Gold is1at full, then1
every160ticks while alive. These ordering details are convention
G24-MOGUL-STACK-01. Gold replay independently validates the hit ledger; max-HP
restore accounts for its historical stack count when checking shield samples.

### G2-4b WIP Zephyr absence

`CombatUnit.itemBanish?: {ownerId:string;itemInstanceId:string;untilTick:number}`
is frozen from original starting cells. For tick<untilTick the unit is absent
from active action, target and passive processing; it remains alive in roster
and prevents elimination. At tick100 it returns, relocating to the nearest free
cell if occupied. This is not a stun and ignores CC immunity. Combat start
programs precede suspension; missed periodic opportunities and opening jumps
are not replayed. Those ordering/collision details are pending convention
G24-ZEPHYR-ABSENCE-01, not verified original script semantics.
`CombatViewUnit.banished?:boolean` exposes presence without changing UI code.
Zephyr save authority is exact independent combat reconstruction from validated
frozen inputs; it does not accept candidate-supplied clocks as authority.

## S13 P2 开场事实与实例覆盖

`CombatUnit.s13P2Opening?: { selected: readonly string[]; shared: readonly ({source:CombatOrigin;attackDamage:number;abilityPower:number;health:number;armor:number;magicResist:number})[] }` 记录经过种子选择的强化身份和一次冻结的分享贡献，仅在真正获得开场加成的单位上存在。它不写回准备棋盘、不影响羁绊计数。恢复先从已认证 `CombatInputBasis` 独立重建开场，再逐单位核对此字段；保留所有原有动态事实、HP 基底和 RNG 校验。没有这些效果时不允许伪造该字段。

`startP2Combat(ctx: AbilityContext): void` 在既有开场初始化、羁绊与光环后使用现有 Combat lcg32 流；两个随机强化共用无放回抽样。先完成随机加成，再冻结所有分享者的五项属性及邻格名单，最后统一广播，禁止广播间的反馈放大。`validateP2Opening(combat: CombatState, replay: RestoreCombatReplay): void` 对比独立开场，错误抛出 `Invalid/Unexpected S13 P2 opening`。当前已有的 `readCombatStats` 统一读取这些经过认证的数值；调用参数只需 `Pick<CombatState,'units'|'tick'>`，原来传完整 CombatState 的调用兼容。

冕卫／夜之锋刃／基克／兰顿的覆盖绑定具体装备实例。普通物品目录不变；宝箱战斗中新发放的冕卫／夜之锋刃也按接收者已冻结的强化来源覆盖，由同一程序恢复。石头皮肤按战斗时钟确定剩余双抗，剔除弱者按实际目标失血比例决定暴击率、每 60 tick 在射程内按百分比生命选择目标。

P2 审查修正：开场护盾仍按既有机制初始化时的生命采样，随后执行 P2 随机增益及冻结后广播。恢复在 tick 0 精确扣除已认证的 P2 生命贡献，重建护盾产生前的生命基底；tick > 0 使用生效后的基底，不增加任意候选。P2 生命写入统一经过 `scaleItemSummonHp`。镜像在 P2 全部广播完成后再次冻结持有者的最终开场生命，镜像自身接收的 P2 生命作为 flat 保留，并统一按其 healthBps 缩放。精心赋能仅给后两排非召唤英雄生成候选，先过滤再排序抽样。
# S13 P3 补充合同

当前分支新增7个强化和7个异常，来源、接口、逐项数值证明与两项缺脚本数据的**项目约定**见 [S13_AUGMENTS_P3.md](S13_AUGMENTS_P3.md)。公开战斗入口和伤害管线保持一致；仅增加可序列化的 `CombatUnit.s13P3?` 调度/门控记录，以及伤害准备阶段的只读 `blockedByMitigation` 观察值。版本由合并时统一升级。
## First-pass combat replay capture (optional PvP / PvE)

All interfaces below are exported from the sole server rules entry, `src/server-entry`.
No rule values, versions, content digests or settlement authority change.

```ts
interface BattleReplayOptions { readonly captureReplay?: boolean }
interface BattleTask { advance(maxTicks: number): BattleResult | null }
interface BattleReplayTask extends BattleTask { replay(): CombatReplay | null }
startTwoSidedBattle(input: BattleInput): BattleTask;
startTwoSidedBattle(input: BattleInput, options: { readonly captureReplay: true }): BattleReplayTask;
startTwoSidedBattle(input: BattleInput, options: BattleReplayOptions): BattleTask | BattleReplayTask;

interface CombatReplayRecorder {
  record(previousState: CombatState, step: CombatStep): CombatReplayTick;
  finish(terminalState: CombatState): CombatReplay;
}
createCombatReplayRecorder(initialState: CombatState,
  initialEvents: readonly LedgerCombatEvent[]): CombatReplayRecorder;
// CombatStep = { readonly state: CombatState; readonly events: readonly CombatEvent[] }
// CombatReplay = { readonly initial: CombatViewState;
//   readonly ticks: readonly CombatReplayTick[]; readonly terminal: CombatViewState }
```

- **PvP lifecycle:** opt in with `startTwoSidedBattle(input, { captureReplay: true })`.
  Continue calling advance with the usual tick budgets. replay() returns null until
  the advance that returns BattleResult, then returns the same deeply frozen replay
  on every call. BattleResult has no added fields; its canonicalContent and the
  proposeSettlement output equal those with capture disabled.
- **Default path:** omitted options and explicit false create no recorder, views or
  replay accessor. The task retains its original shape and advance return value.
  A dynamic boolean option returns the union type; narrow with `'replay' in task`.
- **Budgets:** recording never calls stepCombat or consumes RNG. advance still calls
  stepCombat at most maxTicks times. Invalid budgets throw BattleValidationError
  ('invalid-budget') before advancing, including after completion. The synchronous
  resolveTwoSidedBattle wrapper is unchanged: insufficient total budget still
  throws step-limit-exceeded. A tick-zero finished battle requires one advance call
  before replay() is available.
- **PvE lifecycle:** after successful startMatchCombat, construct the recorder with
  state.combat and ALL opening events whose domain is 'combat'. initialState must
  be tick zero. initial.nextEventSeq separates already applied opening events from
  later events, rather than their tick: wolves' deferred tick-zero jumps belong to
  the first step frame, not the initial frame.
  For every `const next = stepCombat(previousState)`, call
  `recorder.record(previousState, next)` exactly once before further stepping or
  changing next. record returns the deeply frozen frame for that tick. Once finished,
  call `recorder.finish(next.state)`. If already finished at creation, call
  finish(initialState) directly. Repeated finish with the same terminal view returns
  the same replay object; record after finish is prohibited.
- **Trusted boundary and errors:** this recorder collects trusted rules outputs;
  it does not replay combat or authenticate the full ledger/hidden state. Supply
  the initial state, complete opening ledger and consecutive real CombatStep
  outputs from the same battle; never use it to validate untrusted input.
  A nonzero initial tick, or a non-finished/out-of-range terminal throws
  RangeError('invalid-replay-input'). Repeated/skipped ticks, mismatched combatId,
  record after finish, or a terminal view different from the last recorded view
  throw RangeError('replay-divergence'). These rejected calls append no new frame;
  fix the call sequence before continuing. Projection/identity-alignment exceptions
  propagate unchanged. The recorder does not verify non-visible terminal fields.
- **Ownership and equivalence:** every view and animation event is projected into
  detached whitelist data and deeply frozen immediately. The recorder retains only
  frozen views/frames and a task-local freezer; it adds no global freeze-table
  registrations. First-pass and replay paths share identity alignment, unitUpdated
  deltas, membership events and keyframes (every 20 ticks, order change or finish).
  For the same trusted initial state, terminal and complete ledger, their resulting
  CombatReplay canonicalContent is byte-identical, with identical deep immutability.
- **Replay/audit compatibility:** startCombatReplay(input) and toCombatReplay(input)
  retain combat re-execution, ordered visible-event comparison, terminal comparison
  and replay-divergence errors. Old callers and server spot checks may continue
  using them. Capturing a replay does not imply that a spot check has run, and never
  authorizes another settlement. Server integration/spot-check policy is separate.
  See also [MULTIPLAYER_CONTRACT.md](MULTIPLAYER_CONTRACT.md).

## v18 纹章与高档位扩展（2026-10-21）

来源、数值与延期项见 [V18_TRAIT_EXPANSION](V18_TRAIT_EXPANSION.md)。沿用v18身份。迅击战士按目标缺失生命计算攻速、当前目标死亡获得4档护盾；搏击手触发治疗分40个tick发放；法师8技能命中弱化输出25%、持续60tick、不叠加；先知8按技能实际生命伤害的20%治疗友军。全程整数/基点、50ms tick、显式RNG；完整来源/事件账本与恢复验证保留。
