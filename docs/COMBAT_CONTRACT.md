# M5 Combat contract v5

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
