## 2026-10-23 战斗法力与暴击率溢出（待 v22 统一录制）

用户10-23批准第1–4条：受伤每包 `min(4250, pre + 3×post)` 百分之一法力（pre含暴击/增伤，post含护盾与原包延迟伤害），同单位tick末合计取整、余数跨tick；受伤回蓝封顶当前最大法力，其他来源可超过上限。施法消耗最大法力并保留溢出，普通单位施法开始 `manaLockedUntilTick=tick+20`，`tick<截止`阻挡普通法力来源，绑定本次施法退款沿原特例。阿木木/维克托专用资源保持。暴击率超100%部分每2Bps转1Bps暴伤，转换时向下取整，授权和RNG抽取数不变。旧M3/M4独立测试引擎不切换。内部签名、事件字段语义、分摊、恢复与失败枚举见 [法力规则报告](COMBAT_MANA_RULES.md)。本节覆盖下文旧“仅hpLoss×3%/同tick上限20/清空法力”描述；第5条减伤叠加不变。**待 v22 统一录制**，不更新身份常量或golden。

## 2026-10-23 普通单位 AD 星级修正（待 v22 统一录制）

普通单位基础 AD 的 1/2/3 星倍率为 100/150/225%，HP 保留 100/180/324%；来源为 TFT 通用规则，用户 10-23 批准，14.24 源表只有一星属性。两者均由 `resolveUnitStats` 从一星属性乘整数百分比后向下取整，再进入既有装备/羁绊/成长管线。六费 HP 保留 100/180/360%；六费 AD 按各自一星值 × 100/150/225% 后四舍五入（正数半入），沃里克 110/165/248、维克托 100/150/225、梅尔 80/120/180。维克托固定攻击与转法强扣除基线同步使用 100/150/225。此项为用户 10-23 第二批批准的项目决定（P）；来源与元数据语义见 MATCH_CONTRACT 顶部。trainer 百分之一 AD 表、固定属性召唤物和专用四星不变。公开接口及失败行为不变；元数据字段和影响清单见 [MATCH_CONTRACT](MATCH_CONTRACT.md) 顶部与 [AD 星级报告](AD_STAR_SCALING.md)。**待 v22 统一录制**，本次保留旧身份常量与 golden。

## 2026-10-23 五费技能几何 P 补充（待 v22 统一录制）

金克丝仅三星电击采用朝当前目标的14×1穿透矩形；莫德凯撒自身出发枚举 E/SE/SW/W/NW/NE 六条8×3矩形，按命中人数、是否覆盖当前目标、方向序号择优。宽度为全宽，格中心判定，边界闭合，起点后方/终点之外排除；整数平方比较，不新增RNG。伤害、眩晕、最近四人加伤及其他招式均沿原表。玛尔扎哈每次施法合计五层感染，floor(5/N)平分、前5%N名命中者各多一层，命中顺序按ID稳定；沿用五个附着任务和原死亡传播时钟。当前HEAD原已总计五层，本单补明确顺序与1–5人验证。

沿用所有公共签名、失败reason、事件、任务和存档结构；完整事件及认证输入重演仍是恢复依据。杰斯返回起点尚未定义，保留旧路径，仍未完成。本节覆盖下文金克丝三星/莫德凯撒暂停说明；P来源、整数公式和验收见[五费技能几何报告](FIVE_COST_SKILL_GEOMETRY.md)。不录epoch/digest/golden，待v22统一录制。

## 2026-10-23 五费实现修正（v22 候选，待统一 epoch）

赛维卡拳击/落点/大嘴改为火焰伤害基数的 3/1.3/3.2 倍；大嘴按星级 15/15/100% 严格低于阈值斩杀，下一 tick 在 2/2/10 格内连咬最低当前 HP 敌人，每跳保留 80% 原始咬伤；喷火按 20 tick 周期持续至目标死亡，控制/自身死亡取消。玛尔扎哈感染在死亡清理时转给最近存活可选敌人，保留层数和脉冲相位；虚空门按本次用户明确的横线要求取目标行 col±2。金克丝原有 25/30/200 tick 眩晕经独立向量确认。

沿用事件封套。`castVariant.channelTicks=40` 仅为喷火初始活动期限，后续 `activityChanged.refreshed` 更新期限；终止以权威活动结束为准。内部增加 `g23Flame/g23Chomp` 任务及严格的赛维卡来源/取消绑定；恢复仍校验完整重演事实，新增步骤不消费 RNG。新几何缺证部分（金克丝直线、杰斯飞行路径、莫德凯撒最优线）暂停，保留旧实现。依据、手算、工程粒度、接入点与未完成清单见 [五费修正报告](FIVE_COST_3STAR_FIXES.md)。按用户要求不在此分支修改版本/digest/golden，合回 v22 后统一录制；本节覆盖历史赛维卡固定两秒引导描述。

## 开局奇遇 Batch B（2026-10-23，待统一 epoch）

新增正式开战单位首次死亡账本 `CombatState.openingDeaths`；完整重放核对，不截断战斗事件。`g23BattleFacts` 投影敌方正式弈子首次死亡给沃里克，排除野怪、召唤物、后生单位、复活后的重复死亡；镜像无结算资格。普通蟹无普攻，每80tick尝试空邻格；危险巨蟹40tick首跳、每40tick全敌方100×实际跳数魔伤，接受既有控制/抗性/加时规则。魔像4-1/6-1升星，AD采用整数百分之一存基底，最终伤害阶段按原整数规则取整。完整数值、映射、签名与向量见 [Batch B 报告](OPENING_ENCOUNTERS_BATCH_B_REPORT.md)，旧epoch待 #410 合入后统一录制。

## 2026-10-23 安慰剂与战斗加时（项目决定 P，待统一 epoch）

用户 10-23 拍板：安慰剂按获得阶段一次发放 **2阶段8 / 3阶段11 / 4阶段及以后15** 金币；安慰剂+暂按 **15 / 18 / 22**，全队 **1%攻速**不变。S13原版安慰剂并非分阶段，本项目明确采用自定义规则，不改原始来源归档。收据以获得时的 round 认证，不随当前阶段重算或补发。

每战固定50ms/tick、最长 **900 tick（45秒）**；先结算该tick和消灭判定，双方仍有存活单位才 timeout→draw。**tick600（30秒）即时第1层**，之后每20tick加1层；伤害增幅和攻速各+1000Bps/层，无层数上限；受到治疗/护盾与新控制时长各-1000Bps/层，最多-7000Bps。控制持续tick四舍五入（正数半入，至少1tick），旧控制不回改。攻击冷却不追溯重算，模拟速度不变。

层数/增减幅依据用户提供的 [Riot TFT 13.22 补丁说明](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-13-22-notes/)；30/45秒和离散tick边界为本项目执行约定。**本单按要求离线，未联网重新核验来源。** 移速：加时期间（tick600起，不按层叠加）固定+5000Bps（+50%），用户10-23拍板（Riot 13.22只写“固定移速加成”无数值，属项目决定P）。加时前移动不变（5tick，沃里克狂暴ceil(5/1.5)=4）；加时中速度相加，步点落在周期5×10000/速度的固定tick网格上（单独10/3tick，叠加狂暴2.5tick），连续移动间隔为4,3,3循环（狂暴3,2循环），长期正好+50%，不存小数状态；迅击moveTenths每tick累计由3改为4/5交替（均值4.5）。完整数值、调用点和验收见 [规则实现报告](RULES_PLACEBO_OVERTIME.md)。

本节覆盖下文历史60秒/1200tick及固定安慰剂金币描述。按用户要求不录epoch、不更新版本/digest常量或历史golden；待PR #410合并后统一切换。这是开发候选，当前身份不得用于新旧混跑或发布。

## 战斗装备阶段 2（2026-10-22，候选身份；未录制 epoch）

已实现下一未封口 tick 安装、属性/装备程序重编译、PvE/PvP 私有成功日志与来源凭据、重放和恢复；本节覆盖历史 T12 下场生效及 #382 的 `battle-input-unsupported`。命令、完整签名、失败原因、羁绊冻结依据、服务器原子边界、UI 字段及待集成身份见 [LIVE_COMBAT_EQUIPMENT_PHASE2](LIVE_COMBAT_EQUIPMENT_PHASE2.md)。当前工作树采用候选 `v20-battle-equipment`，正式历史 epoch 仍为下节 black-market，须与开局奇遇一起录制后发布。

## v20-black-market 当前正式 epoch（2026-10-22）

父 epoch `v20-live-combat`，基线 `42d8a404`。rules/content=`s13-g2-3-v20-black-market` / `s13-14.24b-g2-3-v20-black-market`，CONTENT=`fnv1a32-utf16:9a83da50`、LOOT_REPLAY=`fnv1a32-utf16:e0eb43e2`；schema/save/replay/command **11/7/5/5**、NET6 不变，旧身份严格拒绝、无迁移。
黑市从至多三包改为**一个完整奖励包**，沿用源权重的一次加权抽样（原首候选，每 offer 一词）；接受整包、保留及超时 `@skip`，其余规则不变。命令/投影形状、签名及失败枚举不变。依据、RNG影响、唯一收据、恢复边界和 Claude 交接见 [BLACK_MARKET_SINGLE_OFFER](BLACK_MARKET_SINGLE_OFFER.md)。本节优先于下文历史身份和 N=3 描述。

## v20-live-combat 历史身份（2026-10-22）

父 epoch 为 `v20-xp68`（集成基线 `db04d196e4a12933624add7d61be9081a639607f`）；rules/content 为 `s13-g2-3-v20-live-combat` / `s13-14.24b-g2-3-v20-live-combat`，schema/save/replay/command 为 11/7/5/5，NET6。CONTENT `fnv1a32-utf16:93fad04c`，LOOT_REPLAY `fnv1a32-utf16:49eb9cf0`。完整继承8→9 / 9→10各68 XP、梅尔救命精确HP核对及父版战斗规则；只改变推进与传输，保留完整事件账本，旧身份拒绝、无迁移。实时流、逐tick空输入入口与验收见 [LIVE_COMBAT_PHASE1](LIVE_COMBAT_PHASE1.md)，本节覆盖下文历史当前身份。

## v20-xp68 继承经验策略（2026-10-22）

父 epoch rules/content 为 `s13-g2-3-v20-xp68` / `s13-14.24b-g2-3-v20-xp68`，父 v20-chem-baron；schema/save/replay/command 为 11/7/4/4。仅把 8→9 的 76 XP 与 9→10 的 84 XP 分别改为 68（用户 10-22 要求，项目自定），战斗规则和事件结构不变。阈值表、完整 digest、失败边界及 epoch 重录见 [MATCH_CONTRACT](MATCH_CONTRACT.md) 与 [XP68](XP68.md)。本节覆盖下文历史当前身份。

## v20-traits 继承规则覆盖（2026-10-21）

当前规则/内容为 `s13-g2-3-v20-chem-baron` / `s13-14.24b-g2-3-v20-chem-baron`，schema/save/replay/command＝11/7/4/4；父 v20-traits 的 10/6/4/4 历史录制不变。黑市新增持久化字段使 schema/save 各升一；战斗回放与命令协议未变。迅击、野火与五组强化关系按用户批准**魔改**；野火350%攻速标**工程取值**，14.24b原归档不改。导出签名、数值、伙伴冻结、协同资格、RNG及恢复边界见 [V20_TRAITS](V20_TRAITS.md)，覆盖下文旧的关系延期、野火仅回血及v19当前身份描述。无新Match公共命令或失败reason；旧身份严格拒绝，事件枚举与网络协议不变。

# M5 Combat contract v5

## v19 第二部分（当前合同，2026-10-21）

同一v19包含家人5随机任务法球、13.4六人彩蛋回移、六费 warwick / viktor / mel 与22种纹章总基础属性替换。schema/save/replay/command＝**9/5/4/4**；旧身份拒绝，无迁移，50ms和lcg32-v1不变。数值、魔改/未验证清单、导出签名、RNG、失败/恢复、说明底部显示字段及表现层交接以 [V19_PART2](V19_PART2.md) 为准；下文旧“家人预留/六费延期/纹章未改/8-4-3”描述已被本节覆盖。


## v19 战斗规则与赛薇卡显示扩展（2026-10-21）

当前规则为 `s13-g2-3-v19`；完整来源、整数公式、开场顺序、缺证约定、状态与恢复见 [V19_MECHANICS](V19_MECHANICS.md)。统领使用实际施法收据；盖伦冻结完整实际最大生命后统一广播；双形按startingCell；姐妹按强化/两种伙伴门槛和参与击杀；蓝发10用0/240/480…单一时钟。黑玫4档绑定为**推断**，标记目标的独立×1.08不叠加。链锯刃低于20%处决、400治疗、200tick击杀刷新增益；仅PvP真实敌方英雄掉3金是用户要求的**魔改**，战后唯一收据到账。

`castOutcome` 领域事件及既有 `toCombatViewEvents(events)` 显示投影，新增可选 `castVariant:{actionSeq:number,move:'flamethrower'|'punch'|'chomp',channelTicks:number,enhanced:boolean,heroAugmentIds:readonly string[]}`。赛薇卡每次施法发送最终选招、实际引导tick数（非引导0）及百变铁手强化结果；当前没有已实装赛薇卡专用英雄强化，heroAugmentIds显式为空。3D按unitId/actionSeq关联cast，直接选择动画与时长，继续服从权威生命/控制状态处理打断；不得自行抽招或消费RNG。投影为脱离引用的白名单数据，首遍/重放一致；无需修改网络封套。

可选 `CombatUnit.v19` 存放盖伦采样/共享生命、蓝发信号序号及一次授予标记、黑玫目标队伍标记。相关新动态战斗恢复从认证输入逐tick重建并对比完整状态；不重发任何收益。家人5任务/奖励法球及六人战斗星级覆盖已由第二部分实现，见V19_PART2。

## v18 炮手 6：14.24b 的 12/17 B 补丁修正

炮手（Cannoneer，内部 id `artillerist`，归档 `TFT13_Martialist`）6 档成员攻击力加成由 60% 修正为 **70%（7000 Bps）**，依据 `M9_DATA_LEDGER.md` 的 B-12/17 `effects.variables.AD` 行。2/4 档仍为 10%/45%；6 档每 4 次普攻触发的 250% AD 范围物理包不变。运行时表供战斗编译和说明共用，原始归档不改；无公共签名、失败原因、tick 或结算顺序变化。

> M8 B2审计修订待复审，目标合同见 [M8_RULES.md](M8_RULES.md) 与 [M8_UI_CONTRACT.md](M8_UI_CONTRACT.md)。本文件仍描述当前M7运行行为；新类型未接入，正式版本切换由B3–B9完成。

Match freezes `buildStrategySnapshot` before creating Combat. `combat-types.ts`, `ability-types.ts` and `strategy-types.ts` define the boundary; [M5_RULES R5–R6](../M5_RULES.md) defines numerical rules and the19 finite abilities. Runtime S13 execution lives in `combat-s13.ts`, `combat-s13-abilities.ts` and `combat-s13-state.ts`. The legacy standalone engine remains for unchanged low-level/historical primitive tests; its max-shield behavior must not be confused with M5 layers.

- Fixed50ms ticks, maximum900ticks, movement every5ticks. Existing hex geometry, E/SE/SW/W/NW/NE neighbor ordering and shared occupancy/reservations remain. Nearest-target ties use code-point ID. Input permutations cannot alter semantic ordering.
- Snapshot excludes bench and freezes distinct-definition trait tiers, equipment, augment/anomaly sources, ability variables, AP, base/percentage AD, precise attack speed, initial state and mechanics. Later catalog/Match/UI changes cannot change a running battle. Glass Cannon starts qualifying units at80%HP. No hidden enemy growth is added.
- Combat owns explicit RNG state/draw count and action/event sequences. Each planned ordinary attack consumes one word even at0% or100%crit; Caitlyn consumes one word per bombardment center. Consumption follows tick, actor ID and action index. No visual action consumes RNG.
- Tick barriers: cooldown/expiration/periodic work; existing control; movement; target/action planning; costs/counters/RNG/new shields; stable packet mitigation, redirect and shield absorption; simultaneous HP; surviving-target healing; surviving Mana/kill credit/growth; delayed status effects; death cleanup; elimination before timeout. New control cannot cancel an already planned action in the same tick.
- Ability coefficients are normalized to integer basis points. HP, damage, healing, shields and Mana are integers. Sum coefficient terms then floor once. Physical/magic resistance applies per packet, then additive amplification and strongest reduction, with positive damage at least1. Percentage shred takes the strongest source; flat changes sum; resistance clamps at0. See R6 for exact equations.
- Ordinary attacks gain10Mana. Actual HP damage grants surviving recipients `min(20,floor(hpLoss*3/100))`; shield absorption and overkill grant none. Mana earned this tick can cast next tick. Attack crit25%/140%; skills do not crit. No real damage type is needed by the slice.
- Target selection uses hex cells, never rendering coordinates. Lowest percentage compares integer cross products; Lux uses absolute currentHP. Line/path and cone approximations are explicitly defined in R6. Channel tasks stop on caster death/control; packets already planned land. Attached bleed persists after source death.
- Packet order is source-unit ID, action sequence, target ID, packet ordinal. Virtual remainingHP assigns actual damage and the first killing packet. Loris redirect uses the original target's mitigated amount, floors the50% share and skips a second resistance calculation; its shield still absorbs. Redirect cannot recurse, and multiple eligible Loris sources choose smallest ID.
- Shields are independent source layers. Same-source refresh uses larger remaining amount/later expiry; different sources add. Absorption consumes earliest expiry then source key and records source-specific totals. Irelia decays linearly in integers and tracks absorbed damage independently of remaining shield. Defensive duration records survive shield exhaustion so end effects are not lost.
- Status keys include source/definition/target. Newly delayed statuses start next tick; a1second control blocks20ticks before overtime, then uses the application-tick overtime duration documented above. Same-source refresh cannot create a gap; different-source semantics follow the finite mechanic. Periodic tasks explicitly track due tick and remaining shots. Darius' four primary-target bleed packets preserve the integer total including remainders.
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

## v19 回归修复边界

宝箱战中发装备重算最大生命时，必须保留盖伦已授予的实际共享生命，仍置于百分比乘区外；不改变召唤物/建筑永久禁装备、击杀归属或助攻条件。普通 v19 恢复复用由完整认证输入绑定的独立回放证据，每次仍比较完整候选；Zephyr/Trench/异常路径保留每次冷重演。细节与回归证据见 [PR364_CI_REPAIR](PR364_CI_REPAIR.md)。


## PR #382：逐 tick 输入与认证日志预留（阶段1）

`BattleReplayOptions.beforeTick?: (effectiveTick:number)=>readonly BattleTickInput[]` 在推进的每一 tick 前调用（包括 `advance(n)` 内部多步与 `advanceTick()`），effectiveTick 为当前游标 + 1；终局后不调用。
`BattleTickInput = BattleEquipmentInput`：`{kind:'equipment',seq,effectiveTick,seatId,itemId,unitId,slot}`，序号与生效 tick 由服务器单写队列认证，不接受客户端自报历史时刻。
`BattleResult.inputLog?:readonly BattleTickInput[]` 预留成功安装日志，空时省略；不进入 CombatView/网络公共帧。阶段2须将安装效果与成功日志原子提交，在恢复/重演中按相同 tick/seq 注入，失败不记入日志或消费 RNG。
本阶段没有 applyBattleEquipment：输入源返回空批次时无副作用；非空批次在 stepCombat 前抛 `battle-input-unsupported`，不会推进该 tick；外部 BattleResult 的结算与回放也拒绝非空/畸形 inputLog，防止静默丢弃日志。
既有单人 Match 的成功装备操作继续写 `BattleRecord.equipmentCommands`（共享类型 `BattleEquipmentCommand`），按原游标 tick 重演并与资源账本逐项认证；日志缺失、伪造或时序不符仍拒绝恢复。

## 安蓓萨施法位移（P，2026-10-23，已录入 v22）

沿用奇数锁链/偶数拳击。锁链伤害前移到目标身边距自己最近的可达空邻格，距离平局沿普通 BFS；已与目标相邻时原地不动（当前格就是最近落点），不发位移事件；不相邻且无可达空格时也原地；拳击在本 tick HP/存活屏障后向己方半场且远离施法时目标坐标后撤 1 格，几何首选格不可用则原地。复用占格、移动限制及本 tick 保留格；不增加 RNG 调用，不改伤害/短晕/耗蓝。精确口径、独立向量和回退见 [AMBESSA_DASH](AMBESSA_DASH.md)，原档缺距离来源见 [证据](AMBESSA_DASH_EVIDENCE.md)。

既有 `CombatEventData` 的 movement 增加可选 `reason?: 'ambessa-chain' | 'ambessa-fist-retreat'`；其余 `{type:'movement',tick,unitId,from,to}` 不变。只有实际换格才发；普通移动不带 reason。领域封套仍是 domain/combatId/eventSeq；公开 `CombatViewEvent` 保留 reason，终态 cell 仍由 unitUpdated/keyframe 下发。无新命令/失败 reason；无落点只取消位移，原施法照常。此为 P 项目决定，已随 v22-online-rules 录制。

## 单场初始化协作切片（2026-10-23；不变更 epoch）

新增 `Generator<void, T, void>` 入口。每次 `next()` 只继续初始化，`yield` 不携带状态或事件；只有 `done: true` 返回完整结果。同步入口 drain 同一生成器，保留校验次序、错误归属、RNG 次序、JSON 字段及数组顺序。调用方必须在 continuation 存活期间保持输入不变；服务器用原有冻结写入/FIFO 屏障满足此约束。取消可调用 `return()`，未发布的任务直接丢弃，重新创建不消费调用方 RNG，不补发奖励。

| 导出（规则模块） | 签名 / 返回值 |
| --- | --- |
| `two-sided-snapshot.ts` | `snapshotForBattleSteps(state: MatchState, seatId: string): Generator<void, PlayerBattleSnapshot, void>`；`restorePlayerBattleSnapshotSteps(input: unknown)` 同返回类型 |
| `two-sided-battle.ts` | `compileBattleSteps(a: PlayerBattleSnapshot, b: PlayerBattleSnapshot, battleSeed: number, identity?: BattleIdentity): Generator<void, BattleInput, void>`；`restoreBattleInputSteps(input: unknown)` 同返回类型 |
| `two-sided-battle.ts` | `startTwoSidedBattleSteps(input: BattleInput, options?: BattleReplayOptions)` 返回 `Generator<void, BattleTask, void>`；`captureReplay: true` 重载返回 `Generator<void, BattleReplayTask, void>`；联合选项返回联合任务 |
| `strategy-snapshot.ts` | `buildStrategySnapshotSteps(state: CombatStrategyInputs, catalog?: StrategyCatalog, context?: TraitProjectionContext, equipmentBasis?: StrategySnapshot): Generator<void, StrategySnapshot, void>` |
| `combat.ts` | `createCombatWithEventsSteps(preparation: GameState, strategy: StrategySnapshot, combatId: string, rngState?: number, context?: TraitProjectionContext): Generator<void, CombatStep, void>` |
| `match.ts` | `openMatchCombatStreamSteps(state: MatchState): Generator<void, MatchCommandResult & { readonly streamInitial?: CombatState }, void>` |
| `setup-work.ts` | `drainSetup<T>(work: Generator<void, T, void>): T` |

`buildStrategySnapshot` 同步入口向生成器原样传递 PR9 的 `equipmentBasis`；战斗中装备重编译沿用冻结羁绊与非装备来源，不重新计算开战选择。PvP 内部 `compileSide` 同步入口同样 drain `compileSideSteps`，供 PR9 的 `queueEquipment` 首次准备收据使用。

PvP 快照/编译/任务入口由 `server-entry` 一并导出。内部 JSON 校验与冻结按至多64个未命中缓存的对象节点分段；G23 经济历史按收据重演、逐字段比较；策略编译和战斗单位创建按原单位顺序分段。字符串解析、单个对象/数组枚举、原生 clone、单次 combatStart 等仍是不可抢占步骤。`freezeContentSteps` 只用于调用方拥有的数据图，可能在暂停前冻结已完成子树；它不保证取消时撤销冻结。canonical 同步/切片共用遍历器，切片模式不保留短命快照文本缓存，不跳过任何校验。

失败枚举不新增：快照/编译/任务沿用 `BattleFailure` / `BattleValidationError`，包括 `snapshot-version`、`content-digest`、`invalid-snapshot`、`wrong-phase`、`round-mismatch`、`round-kind`、`seat-collision`、`invalid-seed`、`invalid-battle-id`、`invalid-mirror`、`battle-input`。PvE 仍返回原有 `MatchFailure`，失败保持原 state 引用，无事件、资源及 RNG 变更。异常可能在后续 `next()` 才抛出；服务器 `guardedSteps` 沿用 `BattleResolveError` 包装。

服务器 `startLiveTaskSteps(envelope, beforeTick?)` 依次委派快照、编译、任务初始化；`openStreamSteps` 委派 PvE 初始化。所有流仍私有暂存，全部完成才原子发布并启动共同 tick0 时钟。`runSettlementSlice` 用注入的 `sliceNow`，初始化工作窗口为 `min(5ms, sliceMs/2)`，保留余量给下一不可抢占子步骤；同时遵守 `sliceTicks`。未配置 `sliceMs` 时沿用无时间预算语义。结算窗口、50ms 战斗 tick、RNG、内容身份、账本及录像格式不变；真实 GC/系统调度暂停不构成跨硬件硬实时保证。
