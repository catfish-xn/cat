# M8 B8 检查点交接：冻结计划、检查点②恢复前提与运行设计

## 1. 当前范围与签收边界

接手基线：`feat/m8-b8@cab8fe2b2ed8c9f2f48901bf4355a360c0ed8248`，2026-10-10。

- 检查点①的实现范围仅为掉落目录、完整计划的纯冻结及其自身的严格恢复验证。`FrozenLootLedger` 是独立冻结产物，不是已启用的 Match 奖励账本；类型存在不等于实际授予、资格揭示或恢复接线完成。
- ①的 `restoreFrozenLootLedger(value, { seed, throughRoundOrdinal })` 从调用方的权威输入独立重演；②接入时参数必须取已验证的 Match seed／round，不得取候选 ledger 自报值。①未修改 Match 或 live `CONTENT_DIGEST`。`makeLootPendingChoice`／`validateLootPendingChoice` 也只是精确检查 generation=0、step=offer、returnPhase=settlement 的纯构造／验证 helper，没有真正打开选择或发奖。
- **检查点②必须实施 combat input basis、成长迁移、消费来源，以及当批启用状态的 own restore。** 这三个恢复前提不能拖到检查点③或 B9 才补；目前均未实现、未通过功能验收。
- 第 3～9 节也列出完整 B8 运行设计和实现门禁，供真实 pipeline 在②／③分批接入。选择、容量、终局等其余路径的②／③排期以用户审计批准为准；本文不把它们全部强制归②，也不把③缩成仅做集成。每条路径一旦启用，须同期交付其自身状态的严格恢复，不能留给后批补洞。
- 本文不改冻结 B2／G12，不调整伤害或成长数值，不发布正式 Match6/save2/replay2。检查点①的实际提交、预算与验证状态以 [checkpoint① evidence](evidence/m8-b8/checkpoint-one/README.md) 为准；本文不复制易过期的测试进度，也不把拟议测试写成已通过。

权威规则只有一份：[LOOT](M8B_LOOT.md) §2–9 决定计划、顺序、RNG、实际计数和经济向量；[ADDENDUM](M8B_CONTRACT_ADDENDUM.md) §2–3、§5–6 决定选择、提交时序、恢复和成长归属；[OPENING](M8B_OPENING.md) 决定阶段 1 资源；[ENCOUNTERS](M8B_ENCOUNTERS.md) 决定 source 身份；[POLICY](M8B_POLICY.md) 记录批准边界。本文只映射这些已批准语义，不建立第二套奖励政策。

## 2. 已查明的恢复耦合

以下是接手基线的实际代码，不是猜测的风险：

1. [`match.ts::startMatchCombat`](../src/simulation/match.ts) 用当时的 `state.preparation` 和 `buildStrategySnapshot(state)` 创建 Combat，但没有独立保存这组原始输入。
2. [`serialization.ts::restoreMatch`](../src/simulation/serialization.ts) 对已结算战斗从**当前** `persistentGrowth` 减去同 ID 的 `combat.runtime.permanentAdBps`，再从**当前** preparation/items/anomaly/temporaryEquipment 重建 `expectedStrategy`。它还要求 Combat ID 集等于当前上场 ID 集，逐单位按当前 roster 校验身份／星级，并把当前 preparation 传给 `validateNeutralCombat`。
3. [`upgrades.ts::planPurchase`](../src/simulation/upgrades.ts) 可以立即消费奖励卡以及旧单位、提升 survivor 星级；`transferUpgradeResources` 会迁移装备与异常。故“掉落先授予，再成长／经济”的合法事务会令完成 Combat 的输入与当前阵容不同。即使原上场 ID 没变，星级、羁绊、装备来源也可能变；只保存 ID 映射不够。
4. `settleRound` 当前直接按 Combat 原单位 ID 加成长。奖励先合并后，这会重新生成已消费单位的成长条目；先迁移存量、再按原 ID 加 delta 也一样错误。旧 `mergeGrowth` 只处理存量，不能独自承担本战未提交 delta。
5. 已结算状态还被要求 `state.gold === last.goldAfter`。B8 启用待容量期间合法出售后，该等式必须改为**可验证的结算后操作差额**，不能简单删除检查，也不能回改历史收入来迁就当前余额。
6. B7 中立恢复使用原站位和原策略验证开场任务、同伴／控制来源。改用奖励后的阵容会连带误判这些已签收校验；不能在 B8 统一跳过 neutral、source 或机制校验。

结论：需要冻结原始战斗输入，并保存真实授予／消费／成长提交的有序来源证据。完成 Combat、当前运营资源各自有不同的时间边界；两者之间必须由可校验的领域操作连接，不能用“允许不一致”替代。

## 3. 唯一权威与 B8 类型落点

以下 TypeScript 为建议的明确映射，**不是现有代码声明**。落点建议为新的 `combat-input.ts`、`resource-provenance.ts` 及对 `loot-types.ts`／`match-types.ts` 的有限扩展；最终命名可在代码评审调整，权威边界不能改变。

检查点①已经存在的是 `loot-types.ts` 中冻结格式、descriptor、eligibility／resolution 的值类型，以及独立纯函数。下文的 `MatchLootState`、资格证据、basis、来源流和真实写入路径均属待实施提案；其中 basis、成长迁移和消费来源是②必做前提，其余运行路径按批准的②／③范围接入。复用①的计划数据及重演算法，不要求把其独立持久包装原封不动变成最终 Match/save 格式；正式格式可统一由已验证的 Match 提供 seed／round／digest 绑定。

### 3.1 冻结计划与可变状态分离

复用检查点① `FrozenLootLedger`／`FrozenLootRound`，其中计划载荷、source/slot、候选版本及 fallback 永远不随授予改写。`FrozenDirectDrop.status='planned'` 是冻结记录的初始描述，**不是运行资格状态**。B8 新增的运行状态仅引用该唯一计划：

```ts
import type { LootReceipt } from './m8/contracts';
import type {
  FrozenLootLedger, LootChoiceEligibility, LootChoiceResolution,
} from './loot-types';

export type DirectLootProgress = { readonly dropId: string } & (
  | { readonly status: 'planned' | 'revealed' | 'pending-capacity'
        | 'retained-terminal' | 'forfeited'; readonly receiptId: null }
  | { readonly status: 'granted'; readonly receiptId: string }
);

/** 资格证据，不是奖励收据；sourceUnitId 从唯一冻结条目解析。 */
export interface LootEarnedEvidence {
  readonly dropId: string;
  readonly death: {
    readonly combatId: string;
    readonly tick: number;
    readonly eventSeq: number;
  };
}

export interface MatchLootState {
  readonly frozen: FrozenLootLedger;
  readonly direct: readonly DirectLootProgress[];
  readonly choiceEligibility: readonly LootChoiceEligibility[];
  readonly choiceResolutions: readonly LootChoiceResolution[];
  readonly earnedEvidence: readonly LootEarnedEvidence[];
  readonly receipts: readonly LootReceipt[];
  readonly guaranteeCounters: Readonly<Record<string, number>>;
}
```

- `m8.loot.frozen` 是计划与 loot RNG 游标的唯一存储位置；不再同时维护一份可修改的 `m8.rng.loot`、第二个当前轮 plan 或独立 fallback 队列。
- `m8.encounterPlan` 的既有 B7 `null` 占位在正式接线时取消存储权威。需要 B2 `EncounterPlan` 形状的消费者，使用“冻结当前轮 + direct progress”生成只读投影；若兼容适配器保留同名输出字段，它不进入另一份独立可写存档。
- 选择的实际 definitionId 只从所关联的 `LootReceipt.payload` 读出，不复制到 resolution。具体掉落收据的 payload 必须等于冻结载荷；自选收据必须等于合法选择／已冻 fallback。
- `guaranteeCounters` 是由实际收据唯一导出的受检缓存，严格重算比对；不是发奖开关。RNG 重演仅在隔离校验器内验证词序，不改活动 RNG，不补抽或退款。
- `earnedEvidence` 只从本 tick 正式死亡事实写入，每个 drop 恰一项；同一 source 的不同槽可以引用同一死亡身份。当前 Combat 时严格比对 B7 死亡收据与冻结 source，换轮后保留历史资格证据并校验其轮次／战斗／事件边界；有完整历史记录时交叉核对原 death 事件。planned／forfeited 没有此证据，revealed 及之后状态必须有。本版未启用 approved-guarantee，不留一个可伪造的通用保底证据分支。
- 选择路由反查真实 descriptor/eligibility，不只看 ID 前缀。继续沿用 protocol 2；`.4` 的 `ScheduleReceipt` 与 PvE `LootReceipt` 不串线。

### 3.2 CombatInputBasis：存输入，不再存第二份策略答案

```ts
import type { MatchBase } from './match-types';

/** buildStrategySnapshot 实际读取的完整且有限的字段。 */
export type CombatStrategyInputs = Pick<MatchBase,
  | 'round' | 'preparation' | 'items' | 'temporaryEquipment'
  | 'augments' | 'anomalyBinding' | 'persistentGrowth' | 'augmentProgress'
>;

export interface CombatInputBasis {
  readonly version: 'm8-b8-combat-input-v1';
  readonly combatId: string;
  readonly roundId: string;
  readonly contentDigest: string;
  readonly battleSeed: number;
  readonly playerLevel: number;
  readonly nextUnitSerial: number;
  readonly nextItemSerial: number;
  readonly equipmentRollPrefixLength: number;
  readonly provenancePrefixLength: number;
  readonly inputs: CombatStrategyInputs;
}

// MatchBase 的拟议增量：
// readonly combatInputBasis: CombatInputBasis | null;
// readonly resourceProvenance: ResourceProvenance;
```

`buildStrategySnapshot` 的入参须收窄为 `CombatStrategyInputs`，函数体继续使用现有唯一编译管线。MatchState 结构上兼容该输入；恢复直接编译 `basis.inputs`，不构造“看似 MatchState”的类型强转或拼造状态。basis 不再保存一份 `StrategySnapshot`；`combat.strategy` 是从该输入和同版本目录得到的既有投影，恢复时逐字段严格比对。

为什么这些字段都不能省：

- preparation 保存原 board、benchSize 和完整 roster。上场单位用于战斗身份、羁绊与开场位置；备战席用于重演战后奖励合并。`RoundPreparation.enemies` 仅有敌军，不能充当完整 basis。
- 原 items／临时装备／异常和原成长是属性及 source 的输入，不能用当前归属反推。所有输入是独立深拷贝并冻结，不共享可变对象。
- 原 augmentProgress 消除结算后减一轮增长的反推；例如投资策略用开战时 H，不使用结算后 H'。
- level、serial 和两个 prefix 是校验边界，约束原人口、永久实例及操作／G12 记录前缀；不是第二个可推进游标。实际后续 ID 仍只由 Match 的 next serial 分配。
- `battleSeed` 记录本次唯一 battle-seed 抽样结果；绑定合法 seed 序列和战斗序号，只验证，不触发第二次开战。loot、equipment、shop RNG 不从它派生。

basis 生命周期：新局和未开战准备期为 null；成功 Start 在使用输入前一次写入；整个 running Combat、战后选择、容量等待和 gameOver 均保持原值；Continue 清除，下一次成功 Start 新建。无上场单位而立即结束的合法战斗也必须在 `withCombat` 结算前已有 basis。无 Combat 的 supply 不造 basis。不得在每次 step、奖励授予或恢复时刷新它。

### 3.3 资源来源：一个有序事实流，不另存可独立修改的最终余额

下列有限 provenance 只记录 B8 恢复需要的永久身份、消费及成长提交，不建立通用命令／事件引擎。完整领域事件仍照常输出；这里保留的是与资源同事务提交的最小来源证据。

```ts
import type { UnitUpgradedEvent } from './unit-types';
import type { StrategyEvent } from './strategy-types';

type UnitAcquisitionSource =
  | { readonly kind: 'opening' }
  | { readonly kind: 'shop'; readonly generation: number;
      readonly slotIndex: number; readonly definitionId: string }
  | { readonly kind: 'loot'; readonly receiptId: string };

type ItemAcquisitionSource =
  | { readonly kind: 'schedule'; readonly eventId: string }
  | { readonly kind: 'loot'; readonly receiptId: string };

export interface CombatGrowthDelta {
  readonly sourceUnitId: string;
  readonly attackDamageBps: number;
}

type ResourceFact =
  | { readonly kind: 'unit-acquired'; readonly unitId: string;
      readonly source: UnitAcquisitionSource }
  | { readonly kind: 'unit-upgraded';
      readonly acquisitionSequence: number;
      readonly event: UnitUpgradedEvent }
  | { readonly kind: 'unit-sold'; readonly unitId: string;
      readonly context: 'preparation' | 'settlement-capacity';
      readonly goldGranted: number }
  | { readonly kind: 'item-acquired'; readonly itemId: string;
      readonly source: ItemAcquisitionSource }
  | { readonly kind: 'item-combined';
      readonly event: Extract<StrategyEvent, { readonly type: 'itemCombined' }> }
  | { readonly kind: 'combat-growth-committed';
      readonly combatId: string; readonly settlementId: string;
      readonly combatStartProvenancePrefixLength: number;
      readonly sourceDeltas: readonly CombatGrowthDelta[] };

export type ResourceProvenanceEntry = ResourceFact & {
  readonly sequence: number;
  readonly roundId: string;
};

export interface ResourceProvenance {
  readonly version: 'm8-b8-resource-provenance-v1';
  readonly entries: readonly ResourceProvenanceEntry[];
}
```

约束与含义：

- sequence 从 0 连续递增，等于 entries 索引；不另存一个可能不一致的 next sequence。roundId 单调按实际目录推进，不按字符串排序推断先后。
- `unit-acquired` 是新永久 ID 的出生事实，初始一星／成长 0。opening 只允许 OPENING 的唯一初始单位；loot 的 definitionId 与候选 ID 从对应 unit receipt 读出，不能自行覆盖；shop 来源保存当时 generation/slot/definition。其完整历史命令真实性仍属于既有结构校验边界，不声称凭自报 shop 字段证明玩家确实点击过。
- `unit-upgraded.event` 原样来自本次 `planPurchase.events`，不另算 survivor。`acquisitionSequence` 必须指向同一成功授予／购买事务的出生记录；一次级联合并可以有多个按实际顺序排列的 upgrade。使用实际事件数据而不是仅存一个 consumed→survivor 的无时序字典。
- `unit-sold` 只登记真实成功出售；根据出售前身份／星级重算 `goldGranted`，删除其存量成长，并按原规则返还装备／清除异常。后续 capacity grant 与同一命令原子提交。
- `item-acquired` 的定义和 ID 由实际 ScheduleReceipt／LootReceipt 解析；合成产物只从 `item-combined` 出生，不再记一次领取。两件消耗项必须有合法出生来源、尚未消费且配方精确匹配。
- `combat-growth-committed` 是唯一 combatId／settlementId 的成长提交事实，即使 sourceDeltas 为空也恰一条；supply 不生成。sourceDeltas 只记录原 Combat 的正 delta、按原 ID 稳定排序，不混存已迁移总值或存量。
- current `persistentGrowth`、当前 roster／items 是运营状态。provenance 是可折叠并严格比对的来源证明，恢复绝不把它重新应用到已保存状态，不产生第二次授予。不得同时再保存一个可独立修改的 `growthBySurvivor`／`consumedUnitIds` 权威表。
- provenance 必须从新局初始化起记录；新局以外不准从当前 roster 猜补缺失历史，也不能给旧档贴上新版本后默认为合法。正式旧档策略仍交 B9/D2，但②自己的开发期格式必须严格拒绝缺项／不匹配。

## 4. 写入点与原子提交

本表是完整 B8 运行写入门禁，不是把每行都排入②。basis、成长迁移和消费来源先在②实现；表中具体路径按批准批次启用时，来源写入、原子提交和 own restore 必须一起完成。

| 写入点 | 写入内容 | 不得出现的副作用 |
| --- | --- | --- |
| `createMatch` | 初始单位出生事实、空成长；首轮冻结计划 | 重发旧 2-1 起手包 |
| 成功 `nextRound`／首进准备期 | 在唯一 frozen ledger 追加本轮完整计划及 RNG 游标，清除旧 basis | 同轮重抽、先发未揭示资源 |
| 成功 `startMatchCombat` | 冻结 basis，消费一次 battle seed，使用同一 basis 编译／开战 | 失败 Start 改 basis、serial、RNG 或 provenance |
| `stepMatch` 的新死亡批次 | 仅揭示资格并绑定正式死亡来源 | 改 roster／growth、战中开 choice |
| 最后 tick 的 `withCombat` | 固定 delta；最后揭示／forfeit；直接授予与 provenance；终局 fallback；一次经济／XP／成长提交 | 拆成可保存的“已授予却无 receipt”中间态 |
| 成功 `buyUnit`／英雄掉落 | `planPurchase`、装备／异常迁移、出生与全部升级事实、存量／待提交 delta 迁移 | 第二套 survivor 或三槽规则 |
| `selectChoice` 的 loot 分支 | item grant + LootReceipt + resolution + counter + item 出生事实 | ScheduleReceipt、重新 settle、再抽 fallback |
| 成功 `sellUnit` | 出售事实、余额变化、成长删除；若有资格且已清选择则自动 capacity grant | 补算上一轮利息／投资成长、无阻塞时扩大结算运营权限 |
| `combineItems` | 现有成功 `itemCombined` 事实与产物 | 将合成或装备流转计入永久组件授予总数 |
| `restoreMatch`／只读查询 | 验证、独立拷贝及投影 | 追加任何事实、重发资源、执行 combatStart、推进 RNG |

需同时更新 `serializeMatch`、Match 公共命令返回状态、局部 fixture／构造器及同版本恢复。不能仅让新类型可 JSON.stringify，就把恢复宣称完成。

## 5. 本战成长的唯一算法

完成 Combat 后，使用原 Combat 冻结 `pendingDelta`；包括已死玩家单位，排除敌军与 0 值。`runtime.permanentAdBps` 是本战增量，不含 basis 的已存成长。

1. `stock` 从完成战斗前的当前 `persistentGrowth` 复制；此时须等于 basis 对应存量，没有战中运营。
2. 依冻结 source/slot 顺序处理直接英雄。每个成功 `planPurchase` 的每条 upgrade，分别对 stock 和 pendingDelta 做同一操作：把 survivor＋全部 consumed 的值相加写入 survivor，删除 consumed。新候选卡两个账本均为 0。
3. 级联合并按事件顺序继续，不能把第一层映射一次性套用后停止。不得按幸存 Combat 单位过滤 delta。
4. 掉落阶段完成后，将已迁移 pendingDelta 一次加入 stock；保存最终 `persistentGrowth`，同时保存唯一 `combat-growth-committed`、RoundResult 与本轮其他收据。不能随后又执行当前旧版“遍历原 Combat ID 加一次”的循环。
5. 成长事实保存原 `sourceDeltas`；恢复只在隔离折叠中用本战 `combatStartProvenancePrefixLength` 至提交事实之前的真实 upgrade 后缀迁移这些 delta，严格比对保存值。
6. 后续出售或 capacity retry 发生在成长提交之后。它们只处理当前已存成长；不得创建第二条本战成长事实或把 sourceDeltas 再加一次。

独立算例，来自 ADDENDUM §6：A/B 存量 100/200 Bps，delta 30/40，奖励 R 为 0，A 消费 B/R 后为 **370**；B/R 不保留成长。若 A 又被 C 消费，300 存量和 70 delta 都继续归 C。此为通用整数迁移 helper 的代数向量，**不是合法 Tristana 存档数值**；当前真实 Tristana 成长按 125 Bps 步长验证，该约束不因本例放宽。对应领域合法向量可用 A/B 存量 250/375，delta 125/250，最终 **1000 Bps**。

同一 unit receipt 的 `grantedUnitIds` 记录真实分配的候选 R，即使它在本次合并立即被消费。不能改写为 survivor A，也不能因当前阵容中没有 R 而重发。R 必须有一次出生事实和紧随真实升级链的消费事实；后续 survivor 被出售时沿出售事实终止，原领取事实仍保留。

## 6. B8 恢复不变量

输入 basis、成长迁移和消费来源的恢复前提属于②，不能推迟；以下完整运行不变量随相应路径在②／③启用时同期执行，不要求尚未启用的选择／容量／终局路径提前冒称完成。

### 6.1 输入与完成 Combat

1. Combat 非 null 当且仅当该 phase 应保留 Combat；此时必须存在同轮／同 combatId basis。preparation、未开战 choice、supply 的 basis 必须为 null。
2. 验证 basis 是 plain JSON，版本、digest、round 目录、board、阵容身份、原人口、serial、装备来源、异常、growth／augment 前缀均合法；不能相信任意附加的快照。
3. 基于 basis 原始输入调用唯一 `buildStrategySnapshot`；对 `combat.strategy`、Combat roster／星级／原来源逐项保持严格相等。中立恢复使用 `basis.inputs.preparation`，原开场站位、G12 source／临时子件和控制 once 收据继续严格验证。
4. running Combat 尚未发生资源变动，当前编译输入须等于 basis.inputs，provenance 长度须等于冻结前缀。finished Combat 的差异只允许由本战真实 loot、升级、选择及已批准容量出售解释。
5. finished Combat 的原单位可以在当前 roster 消失，但只能由合法 upgrade／sale 路径解释。不能改写原 Combat 的 unitId、starLevel、source、death/growth 事件以匹配当前阵容；不能删掉 roster/source 检查。
6. basis 前缀在来源流中唯一且不超界；按该前缀折叠的持久成长与玩家身份必须匹配 basis。原装备／临时装备须关联实际永久来源及 equipment roll 前缀，不接受孤立的“可信 basis”。

### 6.2 出生、消费、迁移与成长

1. unit/item serial 在出生事实中唯一且连续，初始序号遵循 OPENING；失败购买、pending、forfeited、retained-terminal 不出生、不消耗 serial。活跃资产不能多出无来源 ID。
2. 升级时恰有三个当前可用的同定义／同星级单位；survivor 不能同时被消费，两个 consumed 不重复，不允许再消费已退出 ID，不允许环或跨定义迁移；fromStar→toStar 只允许 1→2、2→3。
3. 对当前 Combat 的奖励后缀从 basis 完整 roster 依次调用既有纯 `planPurchase`，要求升级事件、retention 顺序及结果精确相同；不能只检查 consumed 的字符串格式。装备／异常用原 `transferUpgradeResources` 校验同一链。
4. 从来源事实折叠 stock：出生为 0，升级合并，出售删除，每个 combat growth commit 恰一次。当前 `persistentGrowth` 必须等于最终折叠值，只有当前持有的 Tristana 可以有正值且保持 125 Bps 步长。
5. 当前完成 Combat 的 sourceDeltas 必须精确等于其全部原玩家 runtime delta，不能漏死亡单位、重复源、增加不存在的源。running Combat 无本战 growth commit；finished Combat 恰一条且关联唯一 RoundResult。
6. 历史成长事实保留原源身份及战斗／结算身份，在换轮后仍检查结构、所有权时序、一次性和守恒；存在历史 BattleRecord 时再对原事件／输入校验。仅有当前 Match 的同版本校验不冒称能认证联合伪造的整段历史。
7. 领取 ID 可以已被消费，但要证明出生→零个或多个升级／合成→仍存在或合法出售的唯一链。删除消费事实、凭空加墓碑、伪造“已经升级”标记都拒绝；此规则对组件合成同样成立。

### 6.3 掉落、经济与操作边界

1. frozen round、direct progress、choice eligibility 恰好覆盖已进入的固定槽位；无孤儿、无重复、不漏项。资格依据已验证的 B7 正式死亡事实，不从动画／当前怪物数组顺序推断。
2. receipt 与每条真实授予、item/unit 出生事实一一对应。choice resolution 恰一份 item receipt；具体 payload、数量、canonical ID、source/slot 及 counter 精确关联。pending／retained-terminal／forfeited 不带 receipt。
3. `PendingChoice` 必须是 dropId 代码点顺序的第一条 revealed 且 unresolved 选择，全部八候选、generation=0、returnPhase=settlement；战中及 gameOver 不留可操作选择。
4. `RoundResult.goldBefore/interestBasis` 是直接奖励到账后、收入前的取样；恢复仍用原经济 planner 校验。投资策略进度仍从唯一历史利息推导，不能按英雄名义费用计息。
5. 结算后余额为 `last.goldAfter + 本轮成长提交之后合法 settlement-capacity 出售事实的 goldGranted 之和`。当前批准的延后掉落只有英雄，组件选择也不加金币，因此不能容纳任意其它差額；以后新增类型要另扩有来源的算式。level/xp 仍须等于本轮结算后值。
6. settlement-capacity 出售事实必须发生于已结算、无未解决选择且当时确有 pending-capacity 的边界；按保存的有序来源与纯入库规划校验每次出售后的重试。阻塞清完后不继续开放普通结算运营；Continue 也不得绕过未清选择或容量。
7. 所有校验只读。恢复不能为了补齐计数、缺失 lineage 或平衡余额修改资源；非法档案拒绝时不影响当前活动局。

## 7. B8 最小独立实现与验收门禁

以下是完整 B8 的门禁，均待实施运行，不能凭文档、类型或更新 golden 签收。②须实际完成三个恢复前提及当批启用态的对应向量；其余路径在经批准的②／③批次启用时完成相应门禁，不凭这张表改动批次排期：

| 门禁 | 独立预期与必须拒绝的篡改 |
| --- | --- |
| 奖励合并后 finished Combat 往返 | 原 A/B Combat 保持原 ID／星级／装备来源；当前 roster 合并后仍恢复成功；basis 任一原星级、growth、装备 source 或前缀篡改须拒绝 |
| 成长 370 代数与 1000 领域向量 | 各测 stock/delta 分账、级联 survivor 改变和死亡单位 delta；不能以非法 30/40 Bps 放宽真实存档步长 |
| 奖励候选立即消费 | receipt 仍指候选 R；恢复接受合法出生／升级链，拒绝删链、改为 A、重复授予／消费、环及跨定义链 |
| 成长提交唯一性 | 删除／复制 commit、改 combatId／settlementId／source delta、复活 consumed growth 均拒绝；重复 step、选择、Continue、恢复均不增长 |
| 装备／异常／G12 | 同一奖励链的原装备保留在 basis，当前装备／异常正确迁移，临时子件按原规则投影；原 Combat 中立开场／控制恢复仍严格通过 |
| 延后入库及出售 | 先完成全部组件选择，再卖出释放容量，pending 英雄自动入库；不重复成长／经济；receipt 来源与实际序号一致；删除或伪造出售差额拒绝 |
| 合成消费来源 | 两个真实领取组件合成后旧 receipt 合法；合成不加 C_loot；缺失 consumed 证据、重复消费及错误 recipe 拒绝 |
| A3 与投资策略 | G=9/49/50、L=1 → 16/60/61G，H=80 → 88/120/120；英雄奖励未出售 → 14/58/60G，H=80/112/120；延后卖出 1G 不回算利息 |
| 生命周期 | 保存于 combat reveal、finished choice、choice 后满席、延后入库、早终局 fallback、6-7 gameOver；全部恢复 0 活动随机词且无新收据 |
| 拒绝原子性 | 错 choice、重复／过期命令、Start 失败、非法 Continue、入库容量失败不改资源、事件、provenance、serial 或 RNG；无未来轮计划 |
| 普通路径回归 | 真实新局经 1-2～1-4 到 2-1：无运营全清 10G／3级0XP／三指定英雄／两组件；保留 B7 独立中立恢复向量 |

fixture 可用于精确 helper 边界，但至少一组 Match 向量必须经真实公开命令取得奖励和生成谱系，不能仅拼造一个最终 state 后证明它能往返。完整终态与事件流对比使用不中断路径和保存／恢复续算路径；expected 数值独立写出，不调用被测实现生成。

## 8. 实施顺序与检查点③边界

检查点②先收窄策略输入并接 basis 生命周期／原校验替换，实际实现 stock／delta 迁移与消费来源，并验证当批启用状态的 own restore。真实揭示／授予／选择／容量／终局 pipeline 按用户审计批准的②／③范围接入；后续启用路径必须沿用这三个已实现前提，不能另起权威或到③才补做前提。每条真实写入路径同期补恢复及独立拒绝向量，不得先启用奖励再留下已知会拒绝合法存档的恢复器。

检查点③可以承担经批准的其余真实 pipeline 与验证，不限于集成。B9 继续完整应用包装、历史回放、正式版本与旧 M7 保全等原有职责；后批不能代替前批对已启用 Match 状态的严格恢复，也不能把②三个恢复前提记成“等 B9 就自然解决”。UI 只读 selectors 并调用公共命令，不另存隐藏计划或执行奖励／成长。

## 9. 本文交付说明

本文件是文档交接，不修改代码。已核对现行 Match、serialization、strategy-snapshot、upgrades、temporary-equipment、neutral-restore、inventory 及 M8B 权威文档；未运行上述 B8 功能门禁，也未把①纯 freeze 的自恢复等同于 live Match 恢复。后续交付须逐项列出实际代码、独立向量、验证结果和剩余范围。
