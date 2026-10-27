## 2026-10-27 v25-h8：三项历史依赖强化

本分支新增 B5-45/46/47，原分支 rules/content 为 `s13-g2-3-v25-h8-rules` / `s13-14.24b-g2-3-v25-h8-rules`，schema/save/replay/command 保持 **12/8/8/7**，NET=5。三项均已开放；旧身份不迁移，epoch 不重录。P 约定与全部内部接口见 [历史设计的 B5-45／46／47 调用约定](AUGMENT_HISTORY_DESIGN.md#b5-454647-调用约定2026-10-27)。

| 强化／节点 | 权威事务与事实 |
| --- | --- |
| 前瞻思维／黄金3-2 | choose 冻结 `acquire.goldBefore` 后仅一次清零；第6次真实 PvP 结算（含取得轮）凭 `pvp-roster` 与 RoundResult 给本金+70；本金不生息，后续收入照常，choiceId 收据防重 |
| 恶意货币化／黄金4-2 | choose 给2金；取得轮起3个自然轮的 `deaths` 中正式敌方英雄每次死亡给2金，复活再死另计，排除召唤物；战后一次支付，供给轮也消耗期限 |
| 吸血生机／黄金3-2 | 单位12%全能吸血；双方结算后用 `player-damage.actualDamage` 的20%向下取整治疗存活持有者，封顶当前最大HP，`player-health` 收据防重；镜像不治疗，不能挽回淘汰 |

无新客户端命令。房间沿 `Room.handle → runSharedMatchCommand` 选择，`Room.planSteps → recordRoomBattleFacts` 只记录事实、调用 simulation 并同步 HP/事件，全部奖励公式在新的 `augment-pool-batch5-h8*.ts` 中。三种离线入口沿命令重演；联机恢复必须持有独立 `AugmentHistoryAuthority`，不能用候选JSON自证。单人未知敌方玩家HP保持 null，吸血生机不据此虚构玩家治疗。

## 2026-10-27 v25 H7 历史强化

B5-42／43／44 已开放；函数签名、失败原因和全部接线见 [H7 交付合同](AUGMENT_BATCH5_H7_DELIVERY.md)。使用 `augment-history-v1` 认证死亡、实际玩家扣血、生命与选秀收据。最大生命由 Titanic Titan 已认证拥有条目派生为 120，后续治疗及战斗输入采用新上限。rules/content 升为 `s13-g2-3-v25-online-rules`／`s13-14.24b-g2-3-v25-online-rules`；schema/save/replay/command 仍为 12/8/8/7，规则网络 5、WebSocket 封套 6。无新客户端命令，未重录 epoch；旧身份拒绝续玩。

## 2026-10-27 Batch5 S3B

学术研究、潘朵拉的装备 II、打捞桶已接入现有命令和保存封套；具体数值、内部签名、触发边界、失败与恢复认证见 [S3B合同](AUGMENT_BATCH5_S3B_CONTRACT.md)。`src/server` 无改动，schema/save/replay/command 仍为12/8/8/7。

## 2026-10-27 B5-60 / B5-61（H10）

按 [P-B5-60/61](S13_RULES_GAP.md) 开放黄金狙神之巢（2-1/3-2/4-2，后两节点需狙神成员）和羁绊追踪者（仅 3-2，沿用源互斥表）。没有新 wire 命令或失败枚举；原命令失败保留原 state/pool、无事件和 RNG 消耗。

- `readSniperOpening(state: Pick<MatchBase,'augments'|'augmentHistory'|'round'|'preparation'|'items'>): Readonly<Record<string,number>> | undefined`：无持有者返回 undefined；持有时按已认证历史生成实例 ID → 开战增伤 Bps，首次 800，最高 3200。缺历史／取得证据抛 `RangeError('Invalid augment history: ...')`。取得的泽丽通过原 `batch1GiftPlan`、联机奖励法球及共享池领取，满席保持原待领行为。
- `trackerActiveTraits(roster: HistoryRoster): readonly string[]`：正式棋盘原生／装备纹章羁绊，按同名英雄去重；单层 1 门槛的唯一羁绊排除，使者计入。
- `completeTraitTrackerCommand(name: string,state: MatchState): {state:MatchState;events:readonly MatchEvent[]}`：仅由成功公共命令／房间派发调用；未持有、不在准备期、已锁阵容、自然入轮／自动布阵／战斗／时钟入口、未达 8 或已完成均返回原对象与空事件。首次达标记录 `trait-activation` 后从 22 纹章等权无放回发 6 件，返回连续编号的六条 mechanicGranted 事件。无新网络参数；内部不合法历史／发奖错误统一 `Invalid augment history:`。
- `trackerGiftPlan(state:MatchState): AugmentGift[]`：未完成返回空；完成后按首次事实和独立 LCG 子流重推六份唯一收据，不按已持有纹章过滤。重试和恢复不重发。`Room.apply / claimBotOrbs → completeAugmentCommand` 经 `src/server-entry/index.ts` 调同一规则覆盖共享刷新／经验等入口，服务器仅合并结果与事件。

历史与存档认证见 [AUGMENT_HISTORY_DESIGN](AUGMENT_HISTORY_DESIGN.md#2026-10-27-h10-使用与扩展)。object、JSON、序列化文本均经同一恢复检查；联机文本用 canonicalContent，restoreSharedOrbSnapshot 仍要求独立 authority，离线 serializeMatch/restoreMatch 仍拒绝联机档。
## 2026-10-27 H11 强化接入（候选）

`scavenger`（黄金，2-1／3-2／4-2）和 `sponging`（棱彩，3-2／4-2）经已有 `selectChoice`／共享池choose开放；无新Match或服务器命令。两项均需 `augment-history-v1`，缺失不迁移；联机恢复仍要求独立服务器authority。精确内容摘要由本分支重算，不修改历史epoch。数值、约定、内部API及所有接线点见 [H11实现与验收](AUGMENT_BATCH5_H11.md)。

## 2026-10-27 v25 B5-H13 装备强化

规则/content 身份为 `s13-g2-3-v25-online-rules` / `s13-14.24b-g2-3-v25-online-rules`；精确摘要以生成常量为准。外层 schema/save/replay/command=12/8/8/7，NET=5 不变，不重录旧 epoch。P-B5-H13-EXEC 授权以下实际开放行为。

| 强化 | 报价与效果 |
| --- | --- |
| 打捞桶+ `salvage-bin-plus` | 黄金，3-2/4-2；立即1随机普通成装，选择轮起第4场已结算PvP后1组件。出售只拆普通永久成装为配方两组件，特殊装备原样归库存，临时件不产资源。 |
| 神器工厂 `artifactory` | 棱彩，3-2/4-2；1神器锻造器+2拆卸器；后续每自然轮入口将普通库存成装转现有29件神器池。原始Health=50不解释为加血。 |
| 潘朵拉III `pandoras-items-iii` | 棱彩，全部三个节点；取得即1随机光明装备；后续入轮只重掷普通库存8组件/36成装，类别保持、允许原样。特殊装备/工具及已装备物品不变。 |

本批不新增命令或失败枚举。`selectChoice`、`sellUnit`、`nextRound/advanceMultiplayerRound` 使用原参数和失败原子性；联机已有 `Room.handle` → `applySeatCommand` → 公共规则/共享池事务执行。锻造器沿用 `openAnvil` 与 `selectChoice`，拆卸器沿用 `useConsumable`，无需修改 `src/server`。服务器推进结算与入轮，奖励和转换全部在 simulation。

新增规则内部接口（不向客户端暴露）：

- `recordH13Settlements(state: MatchState): MatchState`、`salvageRewardPlan(state: MatchState): AugmentGift[]`：记录已结算事实并派生第四场奖励；无持有者无动作，重复结算无新收据。
- `salvageRecipe(definitionId: string): readonly [string,string] | null`、`salvageSoldItems(before: MatchState, after: MatchState, unitId: string): MatchState`：识别普通配方并在合法出售返回装备后转换。
- `enterH13ItemRound(state: MatchState): MatchState`：只能接在已记录入轮快照后、其他本轮资源授予前；以历史完成标记保证幂等，取得当轮无动作。
- `h13RoundItemPool(augmentId: string, definitionId: string): readonly string[] | null`、`h13ItemDraw(state: MatchState, choiceId: string, itemId: string, pool: readonly string[]): string`：显式类别白名单和独立确定性随机流，算法见P条目。
- `transformH13Item(state: MatchState, choiceId: string, input: ItemInstance, definitions: readonly string[]): MatchState`：原实例消耗、1/2个新实例与历史/资源行同事务；重复同收据返回原对象，冲突抛错。`replayH13Transform(items, nextItemSerial, fact)` 仅供恢复折叠有序物品。

历史扩展仍归 `augment-history-v1`，新增 `settled-combat`、`augment-item-transform`、`inventory-transform-entry`，详见 `AUGMENT_HISTORY_DESIGN.md`。内部不满足边界时抛 `RangeError('Invalid augment history: ...')`：空池、错误持有者/输出数、收据冲突、输入所有权/位置、输出序号、结算收据、结构界限；恢复缺历史或缺独立服务器authority继续拒绝，不迁移、不自签。公开失败沿用原reason，不消费资源/RNG。

## 2026-10-27 v25 B5-56／B5-58

规则／内容为 `s13-g2-3-v25-online-rules`／`s13-14.24b-g2-3-v25-online-rules`；schema/save/replay/command 保持 12/8/8/7，网络规则协议 5。金色收获（4-2）与禁忌魔法（3-2、黑玫棋盘）按 P-B5-56／58 开放。唯一历史证据为按持有者写入的 `augment-history-v1`：开战异常绑定、真实致死来源、实际参与者与玩家级赛恩成长。每三杀发二金和每三次参与击杀 +150 AD 基点／10 生命均由规则层战后唯一收据执行，成长从下一战生效。无新增玩家命令，旧身份拒绝续玩，未重录 epoch。接口、失败语义与全部接线点以 [强化历史合同](AUGMENT_HISTORY_DESIGN.md) 的 B5-56／B5-58 节为准。
## 2026-10-27 B5-69 战利品爆炸（P-B5-69，数值待最终确认）

新增黄金强化 `loot-explosion`（`TFT13_Augment_Ambusher`）。取得时发卡蜜尔、爆爆各1，联机英雄使用既有共享奖励法球。规则、权重、档位映射和11%基础值以 [P-B5-69](S13_RULES_GAP.md#p-b5-69p2026-10-27战利品爆炸用户纠正版) 为准，按用户决定在 **2-1／3-2 开放、4-2 禁出**；3-2 保留伏击专家阵容过滤。没有新增网络命令、战斗事件或外层版本；精确内容摘要随本次脚本重算，历史epoch不重录。

| 内部领域入口（`augment-pool-batch5-g7.ts`） | 输入、输出与拒绝 |
| --- | --- |
| `rollLootExplosion(stage:number, critChanceBps:number, draw:()=>number): LootExplosionDrop \| null` | 阶段2–8、0–10000整数暴击率、合法32位字；返回基础档、最终档、价值暴击标记和金币/物品奖励，未掉落返回null；越界抛 `Invalid augment history: loot explosion stage/crit chance/random word`。只用指定子流。 |
| `lootExplosionRewardPlan(state:MatchState)` | 从持有者与 `requireAugmentFacts(state,'deaths',round)` 推导已结算非供给战斗的奖励（现有PvE野怪不满足英雄资格）；每个死亡事件、每个奖励槽拥有唯一receiptId。缺完整死亡边界、重复death eventSeq、错战斗ID抛 `Invalid augment history: ...`；不从候选收据推导奖励。 |
| `drainLootExplosionRewards(state:MatchState):MatchState` | 结算期调用既有 `grantMechanicGold/Item`；已发收据保持原对象，禁止补发遗漏的旧轮奖励；在 `applyRoundSettlement` 内失败仍返回原state及 `invalid-receipt`，无事件、资源、RNG消耗。 |
| `validateLootExplosionRewards(state:MatchState):void` | 按独立死亡历史重新规划，逐项核对数量、唯一身份、来源、轮次、金币/装备和item-acquired来源；伪造、缺失、孤儿或冲突收据抛 `Invalid augment history: loot explosion ...`。联机恢复仍须另外提供独立服务器authority。 |

服务器 `recordRoomBattleDeaths(match,results)` 只映射实际执行的双边死亡/击杀席位与原始实例ID，在共享 `settleRound` 事务前写入已验证的历史API；战后 `recordRoomBattleFacts` 不重复写此批死亡。金币/装备仍只在领域模块计算。`sampleAugmentDeath` 的第三个可选参数只承接击杀现场观察，既有事件JSON不增加字段。Match单人路径保持可执行；验收以联机为目标。

审查修复：Match 在发奖前记录与终局 tick 相等的完整 `deaths` 边界；空阵容 tick 0 的 `deaths:[]` 同样必须显式保存，不能把缺行当作零死亡。已有边界和死亡 eventSeq 不重复记录。`restoreSharedOrbSnapshot(pool,input,authority?)` 依据可信 pool 的 pending／rewards 内初始赠礼命名空间判断相关历史认证要求：候选删除拥有者、历史或赠礼收据，仍须独立服务器 authority；缺失抛 `Invalid augment history: missing independent server authority`，状态不符抛 `server facts/state mismatch`。初始 gift 的 source 或 `receiptId` 命名空间命中 `augment-pool-batch1` 时，始终运行拥有者／来源／礼物计划校验，孤儿或伪装来源抛 `Invalid augment batch1 gift authority`。恢复保持只读，不补发资源。回归与通用 Oracle 覆盖见 [G7 审查修复报告](V25_G7_REVIEW_FIXES.md)。

## 2026-10-27 v24 纪元身份（历史记录）

当时 rules/content 为 `s13-g2-3-v24-online-rules` / `s13-14.24b-g2-3-v24-online-rules`，schema/save/replay/command 仍为 **12/8/8/7**，规则联机协议 5、WebSocket 封套 6。商店强化的 `shop-history-v1` 为按需认证证据，依 A2/A4/A5：未触发不产生空字段，相关旧档缺证据则拒绝，不猜测迁移；不改变外层保存封套。此批没有新增战斗回放事实或公共命令，故 replay 与 command 不升。身份及 digest 精确匹配；v23 和更早证据只读保留，不能用于新身份续玩。

## 2026-10-25 v23 当前合同索引（基线 2b434e28 → 0797f3fe）（历史记录；当前身份以 v25 节为准）

本节描述 `codex/v23-contract` 的实际行为，优先于下文保留的 v17–v22“当前／候选／待录制”身份说明；历史章节与既有接口结构保留。文档口径见 [P-CONTRACT-V23](S13_RULES_GAP.md#p-contract-v23p2026-10-25契约覆盖关系)。本次仅更新合同，不修改玩法、保存格式或录制。当时规则／内容身份为 `s13-g2-3-v23-online-rules` / `s13-14.24b-g2-3-v23-online-rules`，schema/save/replay/command＝**12/8/8/7**，NET＝**5**，`lcg32-v1`、50 ms/tick；精确内容摘要仍须与本分支生成常量相等，不能凭相同版本名接纳旧摘要。v23 epoch fixtures 正由独立任务重录，本节不宣布录制已验收。[src/simulation/m8/version.ts:3](../src/simulation/m8/version.ts#L3)、[src/simulation/content/identity-constants.ts:3](../src/simulation/content/identity-constants.ts#L3)。战斗事实、控制、位移、召唤及恢复细节见 [COMBAT_CONTRACT 的 v23 节](COMBAT_CONTRACT.md#2026-10-25-v23-当前战斗与恢复合同)。

### 保存、历史与服务器权威

`restoreMatch(input: unknown, battles?: readonly BattleRecord[]): MatchState`、`serializeMatch(state: MatchState, battles?: readonly BattleRecord[]): string` 不新增参数。结构合法不等于历史有证：提供 `battles` 时始终验证完整历史；需要历史却省略时抛 `Invalid Match save: missing historical evidence / ...`，不能从候选收据推断“已验证”，不能恢复时补发资源。[src/simulation/serialization.ts:12](../src/simulation/serialization.ts#L12)。

| 持久化位置 | v23 使用的事实与认证要求 |
| --- | --- |
| `augments[]` 的 `definitionId/choiceId/acquiredRound`；`seatMechanics.receipts` | 决定拥有者、起算轮和唯一奖励身份；Batch 1/2/3/4 共用礼物派生和发放。初始、阈值、重复奖励逐项比对种类、数量、星级、来源、回合，拒绝遗漏、孤儿或伪造收据。英雄满席可待发，不能把暂未发出误作缺奖；非英雄礼物必须有收据。[src/simulation/augment-pool-grants.ts:20](../src/simulation/augment-pool-grants.ts#L20)、[src/simulation/augment-pool-grants.ts:48](../src/simulation/augment-pool-grants.ts#L48) |
| `seatMechanics.seat['augment-acquisition-levels']` | `{[choiceId]: level}`，记录新强化自身取得 XP 后的等级，供按升级、扣血和 Batch 4 等级奖励使用；键集合必须恰好等于相关拥有条目，值为 1 至当前等级的整数。单人经验链再核对取得轮的真实等级，不能只做范围检查。[src/simulation/augment-xp.ts:10](../src/simulation/augment-xp.ts#L10)、[src/simulation/augment-xp.ts:100](../src/simulation/augment-xp.ts#L100)、[src/simulation/serialization-structure.ts:126](../src/simulation/serialization-structure.ts#L126) |
| `seatMechanics.seat['free-shop-rerolls']` | 仅存 `{used:number}`；额度由拥有条目、等级、轮次、结算及购买历史重推，永久累计。每次成功免费刷新另存 `resourceProvenance` 的 `free-reroll {generation}`；计数必须与事实数相等且每笔在当轮已有额度，generation 必须早于当前商店。不得删除 counter 或提前借用未来额度。[src/simulation/free-rerolls.ts:10](../src/simulation/free-rerolls.ts#L10)、[src/simulation/free-rerolls.ts:27](../src/simulation/free-rerolls.ts#L27) |
| `augmentProgress.forming` / `augmentProgress.magicRoll` | 前者为 `dummify/golemify` 各自 `{health,attack}` 基础总和；后者为三颗骰子。分别由完整移除来源事实和种子重建，不接受自报值；联机战斗快照也携带它们。见下述 Batch 3。[src/simulation/augment-pool-batch3-progress.ts:235](../src/simulation/augment-pool-batch3-progress.ts#L235)、[src/simulation/b8-restore.ts:397](../src/simulation/b8-restore.ts#L397) |
| `roundResults[]` / G23 `economyReceipts` 的 `battle.facts` | 保存经验请求／实得、升级前后、金币方案、HP 与已认证的击杀／治疗／假人／玩家伤害事实；持续计数由这些事实派生，无第二套客户端进度。B4XP 的可选经验子集校验只作结构预检，必须另有历史证据。[src/simulation/serialization-structure.ts:278](../src/simulation/serialization-structure.ts#L278)、[src/simulation/g2-3-settlement.ts:18](../src/simulation/g2-3-settlement.ts#L18) |
| 已有 `battles: BattleRecord[]` | 本可发生之事取得后任一非供给结算、B4XP 取得后任一 PvP 结算均要求历史，**零计数／零额外 XP 也要求**。战争财宝的单人旧战斗同样要求历史；当前仍保留终战的那场不单独触发此要求。冠冕、猎头者、家人、梅尔等原历史条件继续有效。[src/simulation/crown-history.ts:6](../src/simulation/crown-history.ts#L6) |

完整历史必须与所有非供给 `roundResults` 一一对应，按同局、同顺序重演；逐场认证既有结算前缀、资源／装备延续、经济事实前缀、终态和结算结果，最后核对当前后缀。少战、重战、改战、删除零值事实都不能作为合法捷径。`validateBattleRecord(record, battles?)` 使用同一历史门槛；SaveEnvelope 已携带历史，无迁移。[src/simulation/battle-record-validation.ts:97](../src/simulation/battle-record-validation.ts#L97)、[src/simulation/battle-record-validation.ts:187](../src/simulation/battle-record-validation.ts#L187)。联机 PvP 的战斗事实由可信 resolver 提供，Match 只验收并提交；客户端不能通过索奖参数、投影或自报计数生成权威收据。`applyRoundSettlement` 失败保持原 state，无事件、资源或 RNG 消耗。[src/simulation/round-settlement.ts:90](../src/simulation/round-settlement.ts#L90)。

### augment-xp：经验、等级、生命与战后金币

| 内部 id | 当前执行口径 |
| --- | --- |
| `patient-study` | 从取得轮的玩家对战起，胜 +2 XP，负／平 +3 XP，**下一轮入口**发；PvE 不计。 |
| `epoch` / `epoch-plus` | 取得即 6 XP＋2 刷新／8 XP＋3 刷新；取得后的每个阶段 x-1 入口再一份，取得轮不双发。 |
| `level-up` | 取得即 12 XP；每次购买经验由 4 XP 变 6 XP，普通费用仍 4 金。 |
| `shopping-spree` | 取得即 4 金；此后每升到 L 级给 L 次刷新，多级逐级求和；原匿名值 8 不作触发上限。 |
| `upward-mobility` | 买经验减 1 金；取得后每升一级 +2 HP、+3 刷新。仅存活玩家回血，上限 100；入轮升级回血在开局奇遇扣血之后。 |
| `kingslayer` | 取得即 1 金；取得轮起每次 PvP 胜利 1 金，可信对手开战 HP 高于本席该场 `hpBefore` 时改为 4 金；单人无对手 HP，只给 1。 |
| `risky-moves` | 选择时扣 20 HP，最低留 1、已死亡不扣；取得轮起第 7 场 PvP（任意结果）结算给一次 30 金。 |

数值和已有 P 边界：[src/simulation/content/augment-pool-batch3-xp.ts:31](../src/simulation/content/augment-pool-batch3-xp.ts#L31)。`batch3EntryXp(augments, history, round):number`、`xpPurchaseAmount(augments, round):number`、`xpPurchaseCost(augments, round):number` 为规则内部派生入口。入轮 XP 与自然经验一起授予；选择先给取得 XP、按升级回血，再扣选择 HP，之后记取得等级。所有升级点统一处理多级、封顶和回血；恢复按当轮购买增量而非固定 4 XP 校验，封顶另按正规化经验链处理。[src/simulation/augment-xp.ts:18](../src/simulation/augment-xp.ts#L18)、[src/simulation/augment-xp.ts:57](../src/simulation/augment-xp.ts#L57)、[src/simulation/match.ts:898](../src/simulation/match.ts#L898)、[src/simulation/serialization-structure.ts:118](../src/simulation/serialization-structure.ts#L118)。

`buyXp(state, unitLootPolicy?)` 仍按 wrong-phase → max-level → insufficient-gold 校验；联机的 HP 账本只同步可解释来源，不接受任意升降。弑君突刺持有者的 `RoundSettlementReceipt.opponentHp` 必须存在且为 0–100 整数，非持有者不得携带；历史金币按 `augment-kingslayer` / `augment-risky-moves` 唯一收据精确认证。[src/simulation/match.ts:376](../src/simulation/match.ts#L376)、[src/simulation/round-settlement.ts:149](../src/simulation/round-settlement.ts#L149)、[src/simulation/augment-settlement-gold.ts:9](../src/simulation/augment-settlement-gold.ts#L9)、[src/simulation/player-hp.ts:1](../src/simulation/player-hp.ts#L1)。

### Batch 3：调度、随机、战斗事实与资源延续

本节覆盖实际已注册的组；旧批次报告里的“未做”不覆盖当前定义。逐条 apiName、等级、数量、阈值及源 `null` 保留在 [src/simulation/content/augment-pool-batch3.ts:1](../src/simulation/content/augment-pool-batch3.ts#L1)，战斗数值／时序见 COMBAT_CONTRACT。既有 Batch 1/2 奖励、双形来源标记与本可发生之事仍沿用下文合同。

| 组／内部 id | 独立实现必须保留的计数与发放条件 |
| --- | --- |
| 玩家战斗调度：`team-building`、`latent-forge`、`phreaky-friday` / `-plus`、`dark-alley-dealings`、`living-forge`、`what-doesnt-kill-you`、`prizefighter`、`shimmerscale-essence` | 取得轮战斗起算；仅 PvP 场数／胜／负；平局不算负。按配置阈值、重复与上限派生每份奖励，不能用当前胜败连段代替累计值。 |
| 阵亡调度：`eye-for-an-eye` / `-plus` | 读 `alliedDeaths`，PvE 也计，余数跨战保留，单战可跨多个阈值；+ 版初始 1 件与阵亡上限 3 件分开。 |
| 刷新：`rolling-for-days-i`、`superstars-i` / `-ii`、`trade-sector` | 取得额度 11／2／4；DD 街区取得即 1 金，取得轮起每个自然轮加 1 次，未用保留。超级巨星开战按场上三星数量冻结增伤。 |
| 入轮／阶段：`building-a-collection-iii`、`worth-the-wait` / `-ii`、`flexible` | 初始份与后续份分开；值得等待复制初抽的同名英雄，普通版第 2 次入轮起、II 次轮起；英雄在供给轮应发的一份顺延到下个非供给入口，保留原奖励序号。物品仍当轮发，灵活摇摆后续只在 x-1 发纹章。 |
| 假人：`support-mining` / `-plus`、`scapegoat`、`wandering-trainer-i` / `-ii`、`gold-for-dummies`、`tower-defense` | 假人身份来自取得礼物的 unit 收据，不能任选同名假人。战斗事实 `batch3Dummy:{deaths:string[],first:string|null,gold:number}` 记录本队假人终战死亡、按 eventSeq 的本队首亡及金币脉冲数；挖矿第 7／4 死后发辅助装并退休。纹章直接绑定自己的假人槽位，专用来源 `augment-pool-batch3-dummy`，不进库存；恢复必须同时验证退休事实和单位确已移除。 |
| 转换：`dummify`、`golemify` | 取得事务先移除场上及备战席全部非召唤英雄，装备归库存、异常绑定和永久 AD 成长结束、共享池归还所有份数，然后发新假人／魔像。`unit-removed` 带 definitionId/starLevel/receiptId，基础星级 HP/AD 总和重建 `forming`；不得少移、重移或保留幽灵弈子。后续新买英雄不再移除。 |
| 金蛋／任务：`the-golden-egg`、`an-exalted-adventure` | 金蛋 11 次入轮计时，取得轮起 PvP 胜利额外减 1，首次达零的非供给入口孵化。冒险初抽三个不同 2 费并给次级复制器、后续阶段给复制器；取得轮起两个不同目标英雄升到三星后的下一非供给入口发一档奖励。升级事实兼容普通、战后和两类选秀内嵌 upgrades，不得只扫普通 unit-upgraded。 |
| 玩家伤害：`warpath` | PvP 胜利的阶段基础伤害＋合资格存活单位数累计到 60；打镜像也计进攻方进度，镜像来源席不受伤／不结算。阈值一次发 4 个一星 5 费、1 个二星 4 费、1 成装锻造器。 |
| 结果抽样：`magic-roll`、`call-to-chaos` | 前者三骰保存在 `augmentProgress.magicRoll` 并由种子认证，先判断有序 6-2-6 金蛋、再豹子、再总和区间；低豹子给 3 次级复制器＋6 金。后者十分支按已记录 P 等权，64 XP／40 刷新分别进取得经验链／刷新账本，假人装备走独立绑定来源。不能在重试或打开界面时重抽。 |
| 战斗组：`corrosion`、`blazing-soul-i` / `-ii`、`noble-sacrifice`、`wealthy-rehab-i` / `-ii`、`bad-luck-protection` 及六个 `heroCarry` 强化 | 脉冲、受益者、已触发、实际治疗及施法事实留在战斗运行态；战后仅从权威战斗派生奖励，具体见 COMBAT_CONTRACT。 |

调度判定及顺延：[src/simulation/augment-pool-batch3-progress.ts:24](../src/simulation/augment-pool-batch3-progress.ts#L24)；金蛋／三星任务：[src/simulation/augment-pool-batch3-progress.ts:96](../src/simulation/augment-pool-batch3-progress.ts#L96)；假人身份／装备／退休及 forming：[src/simulation/augment-pool-batch3-progress.ts:157](../src/simulation/augment-pool-batch3-progress.ts#L157)、[src/simulation/augment-pool-batch3-progress.ts:200](../src/simulation/augment-pool-batch3-progress.ts#L200)；玩家伤害和治疗／假人事实：[src/simulation/g2-3-settlement.ts:42](../src/simulation/g2-3-settlement.ts#L42)。

随机不是另一个可变全局流。礼物 spec 子流用 `JSON.stringify(['augment-pool-batch1',seatId??'solo',choiceId,definitionId,specIndex])` 的 FNV-1a UTF-16（2166136261，逐字符 XOR 后 imul 16777619 取 uint32）与 seed XOR，再用显式 LCG；每抽 `floor(word*N/2^32)`。费用英雄池和明确名单排序，默认有放回；`distinct` 删除已选项；`identical` 复用首选但每份仍按现有算法抽词。礼物收据为 `JSON.stringify(['augment-pool-batch1',choiceId,definitionId,specIndex,copy])`。调度礼物用嵌套 choiceId `[原choiceId,'batch3',scheduleIndex,ordinal]`，重试身份不变。[src/simulation/augment-gift-plan.ts:21](../src/simulation/augment-gift-plan.ts#L21)、[src/simulation/augment-pool-batch3-progress.ts:148](../src/simulation/augment-pool-batch3-progress.ts#L148)。

金蛋／冒险档位独立使用 `['augment-pool-batch3','loot',seat,choiceId,definitionId]` 命名空间；权重先 `round(weight*1e8)`，单词映射到总权重后按原表顺序累减。骰子／混沌命名空间分别用 `'dice'` / `'chaos'`，XOR 后先 fmix32，再 LCG；每骰 `floor(word*6/2^32)+1`，混沌按固定十项顺序映射。假人纹章对排序纹章池做部分洗牌、无放回；以上均不推进商店／战斗／掉落主流，沿用已记录 P 而非声称原服概率。[src/simulation/augment-pool-batch3-progress.ts:123](../src/simulation/augment-pool-batch3-progress.ts#L123)、[src/simulation/augment-pool-batch3-progress.ts:166](../src/simulation/augment-pool-batch3-progress.ts#L166)、[src/simulation/augment-pool-batch3-progress.ts:326](../src/simulation/augment-pool-batch3-progress.ts#L326)、[src/simulation/content/augment-pool-batch3.ts:1329](../src/simulation/content/augment-pool-batch3.ts#L1329)。

`batch3RewardPlan(state):AugmentGift[]` 只派生计划；`drainBatch3RoundEntry(state, policy?)` 发当前入口的礼物／金币，其余阈值走共同 drain。普通单人英雄满席等待，联机英雄走共享池奖励法球；发放后重新派生以支持连锁合星。金币收据 `['augment-pool-batch3',choiceId,scheduleIndex,ordinal]` 严格比对来源、金额、发生轮次，不能恢复时补造。共同 drain 的顺序是 forming → 循环礼物 → Batch 2 金币 → Batch 3 金币 → 弑君／冒险举动金币 → Batch 4 金币 → 假人装备／退休。[src/simulation/augment-pool-batch3-progress.ts:276](../src/simulation/augment-pool-batch3-progress.ts#L276)、[src/simulation/augment-pool-batch3-progress.ts:301](../src/simulation/augment-pool-batch3-progress.ts#L301)、[src/simulation/augment-pool-grants.ts:26](../src/simulation/augment-pool-grants.ts#L26)。

### 战争财宝：专用击杀事实和连续序号

`spoils-of-war-i/ii/iii` 只有可信开战 strategy 的本席原开场单位来源含该强化时才投影专用 `batch2:[...,{definitionId:'spoils-of-war',count}]`，零击杀不写此行。数的是 `combat.openingDeaths` 中敌方开场非召唤单位首次死亡：**普通 PvE（石甲虫、狼、河蟹等）也计**；排除 item/anomaly/content summon、战中出生者及 PvP neutral。与沃里克的 `facts.openingDeaths` 资格不同，不可借用该字段计数；不持有者与取得前战斗不新增 Spoils 字节。双方分别投影，不向镜像来源席发奖。[src/simulation/g2-3-settlement.ts:33](../src/simulation/g2-3-settlement.ts#L33)。

每席每强化用 `['augment-pool-batch3','spoils',seat,choiceId,definitionId]` 的 FNV XOR seed 后一个 LCG 词，从对应等级七张原表等权选一；取得后第 k 次敌人死亡查 key `3*((k-1)%83+1)`，缺 key 为 0，有则给原表金币，并以 k 作奖励 ordinal。不能每击杀再按 tooltip 的 25/30/40% 抽 Bernoulli，也不能按每场重置 k。无奖／零击杀的旧战仍属于连续序号认证范围，历史门槛见上表。[src/simulation/augment-pool-batch3-progress.ts:47](../src/simulation/augment-pool-batch3-progress.ts#L47)、[src/simulation/augment-pool-batch3-progress.ts:86](../src/simulation/augment-pool-batch3-progress.ts#L86)、[src/simulation/content/augment-pool-batch3-loot.ts:219](../src/simulation/content/augment-pool-batch3-loot.ts#L219)。

### Batch 4：四个已交付组的持久化与权威

等级奖励组的既有接口保留，补充完整行为如下；所有组继续使用现有字段，不新增保存格式或客户端索奖入口。

| 组 | 规则／存储／认证 |
| --- | --- |
| 等级奖励 5 条 | `caretakers-ally` 初始随机 2 费，之后每升级复制同名；`lategame-specialist` 9 级 33 金；`caretakers-favor` 5/6/7/8 级各组件锻造器；`birthday-presents` 取得后每升 L 给 `max(1,L-4)` 费二星（10 级为 6 费）；`caretakers-chosen` 4/6/7 级分别组件／成装／五选光明锻造器。阈值型选择时补已达阈值，逐级型只数取得后升级。用取得等级与 `roundResults.levelBefore/After` 推首次发生轮次，礼物 choiceId 为 `[原choiceId,'batch4-level',L]`；后期专家金币独立来源 `augment-pool-batch4`，重复／遗漏／孤儿／错轮均拒绝。无新增奖励 counter。[src/simulation/content/augment-pool-batch4.ts:13](../src/simulation/content/augment-pool-batch4.ts#L13)、[src/simulation/augment-pool-batch4-progress.ts:11](../src/simulation/augment-pool-batch4-progress.ts#L11) |
| B4XP 4 条 | `clear-mind` 空英雄席 +3 XP；`cluttered-mind` 满英雄席 +3 XP、初始 4 随机 1 费；`slammin` / `slammin-plus` 空装备库存 +2 XP、初始 1 组件，+ 版另立即 10 XP。**取得轮起 PvP 胜／负／平均检查实时席位**，早于战后奖励、法球、延迟合星和下一轮收入；不用开战快照替代。bench 仅数 player 非 summon 英雄，0 为空、等于 benchSize 为满；只查 items.inventory，consumables／未领法球不算装备库存。与普通结算 XP 一次 grantXp，统一跨级／封顶／回血。总 XP 仍写原 RoundResult；零奖励也要求 battles 重演当时条件。[src/simulation/content/augment-pool-batch4-b4xp.ts:12](../src/simulation/content/augment-pool-batch4-b4xp.ts#L12)、[src/simulation/augment-pool-batch4-b4xp-progress.ts:7](../src/simulation/augment-pool-batch4-b4xp-progress.ts#L7) |
| B4Reroll 3 条 | `patience-is-a-virtue` 前一整轮无成功商店购买给 2 刷新；购买后出售／合星仍算买，失败购买与赠送不算。`invested-plus/plus-plus` 初始 26/45 金，后续入轮 `floor(max(0,min(bank,80)-50)/10)` 次刷新（50–59=0，60–69=1，70–79=2，80+=3）。首次均在选择后下一自然轮，PvE/PvP/供给/加时轮都计。bank＝前轮 goldAfter＋其机制收据前缀之后的同轮金币／折金／选择费净额＋结算容量出售金；在新轮选秀／奇遇／其他入轮奖之前取样。无需保存新 bank 或购买 flag，直接重推；额度／消费认证复用 free-shop-rerolls。[src/simulation/augment-pool-batch4-b4reroll-progress.ts:7](../src/simulation/augment-pool-batch4-b4reroll-progress.ts#L7)、[src/simulation/content/augment-pool-batch4-b4reroll.ts:5](../src/simulation/content/augment-pool-batch4-b4reroll.ts#L5) |
| B4Combat 4 条 | `long-distance-pals`、`category-five`、`overheal`、`sated-spellweaver`；初始飓风走共同礼物收据，其余来源／贡献／普攻计数／窗口／护盾使用既有战斗状态，完整重演认证；无新增战后 counter 或 history 例外。详见 COMBAT_CONTRACT。[src/simulation/content/augment-pool-batch4-b4combat.ts:6](../src/simulation/content/augment-pool-batch4-b4combat.ts#L6)、[src/simulation/g2-4b-gold-restore.ts:12](../src/simulation/g2-4b-gold-restore.ts#L12) |

`batch4B4xpSettlementXp(state):number`、`withBatch4B4xp(state,plan,extra):RoundEconomyPlan`、`batch4B4xpRecordedExtra(state,result,base):number`、`needsBatch4B4xpHistory(state):boolean` 是内部结算／恢复入口；非法经验差抛 `RangeError('Invalid batch4 b4xp settlement XP')`，合法子集也不能代替战斗历史。两条结算路径分别在 [src/simulation/match.ts:400](../src/simulation/match.ts#L400)、[src/simulation/round-settlement.ts:131](../src/simulation/round-settlement.ts#L131)。等级奖励战斗锁定时只立即排金币，英雄／锻造器在解锁发奖入口处理；神选五选光明使用排序光明池部分洗牌，原四选不变，30 秒超时第一项。[src/simulation/match.ts:376](../src/simulation/match.ts#L376)、[src/simulation/augment-gift-plan.ts:55](../src/simulation/augment-gift-plan.ts#L55)。

### 全池阶段禁令

14.24 三个未解码 ItemTags `{d02ae323}/{d12ae4b6}/{d22ae649}` 按已有 **P** 分别读作“不得在 2-1／3-2／4-2 出现”；不是允许节点。统一由 apiName 映射合并全池表与 Batch 3-XP、Batch 3、B4XP、B4Reroll、B4Combat 局部表；不能只套新强化或只在初次展示过滤。原有节点开场冻结羁绊过滤、seen 排除、对内互斥、跨席唯一仍同时成立，刷新继续使用该节点约束。[src/simulation/content/augment-stage-bans.ts:3](../src/simulation/content/augment-stage-bans.ts#L3)、[src/simulation/content/augment-offer-rules.ts:54](../src/simulation/content/augment-offer-rules.ts#L54)。

例：耐心学习／新纪元仅 2-1，新纪元+ 仅 3-2；B4 等级奖励除后期专家仅 3-2 外均仅 2-1；B4XP 前三条仅 2-1、物尽其用+ 仅 3-2；耐心 2-1、投资+ 3-2、投资++ 4-2；五级飓风禁 4-2、过量治疗／满意织法者禁 2-1、天涯若比邻无本组节点禁令；`watcher-growth` 三节点全禁，存在定义不等于可出牌。[src/simulation/content/augment-stage-bans.ts:9](../src/simulation/content/augment-stage-bans.ts#L9)、[src/simulation/content/augment-pool-batch3-xp.ts:75](../src/simulation/content/augment-pool-batch3-xp.ts#L75)、[src/simulation/content/augment-pool-batch4-b4combat.ts:85](../src/simulation/content/augment-pool-batch4-b4combat.ts#L85)。

### 次级微光复制器（Lesser Shimmer Duplicator）

`TFT13_Crime_Consumable_LesserShimmerDuplicator` 是独立消耗品，黑市奖励保留源身份；不是普通装备或替代金币。沿用 `previewUseConsumable`／`useConsumable` 的 unit 目标：己方、商店目录内、**原生 chem-baron 且费用≤3** 的英雄（纹章不授予目标资格），获得一张一星同名复制，不继承目标星级／装备／异常／成长。战斗名单锁定拒绝，备战席无空位即 `bench-full`，即使潜在合星也不绕过预检；非法英雄／召唤／锻造器用 `invalid-consumable-target`，未知实例用原 unknown-consumable／unknown-unit。失败不消耗工具、金币或 RNG。[src/simulation/content/consumables.ts:13](../src/simulation/content/consumables.ts#L13)、[src/simulation/consumables.ts:23](../src/simulation/consumables.ts#L23)、[src/simulation/consumables.ts:42](../src/simulation/consumables.ts#L42)、[src/simulation/content/g2-3-policy.ts:39](../src/simulation/content/g2-3-policy.ts#L39)。

成功先写 `consumable-used` 来源事实，后按 `['consumable-copy',consumableId]` 唯一收据授予，单人 held、联机 orb（领取再走共享池）；消耗品列表、nextConsumableSerial、use record、复制英雄来源均复用原保存结构。恢复从授予收据及使用时有序资源事实认证目标存在、原生羁绊／费用和唯一复制收据，`rngBefore/After` 无额外复制抽签。[src/simulation/consumables.ts:105](../src/simulation/consumables.ts#L105)、[src/simulation/consumables.ts:141](../src/simulation/consumables.ts#L141)。

### 投机者之刃开战金币与法球收据顺序

`CombatInputBasis.inputs.bankGold` 与 `openingItemBankGold` 必须认证**战斗时点**余额。单人已结算状态的 `RoundResult.goldBefore` 已含本场直发 PvE 掉落，因此恢复先减去实际在本轮领取的非 forfeited 掉落金币（优先 receipt.gold，旧单人纯金币取 payload.quantity）；有 claimedRoundId 按领取轮，无则按本场 frozen drop 集合。联机领取发生于经济结算之后，不减。该余额也用于逐 tick 装备历史来源复核；不能相信候选 bankGold，也不能把战后掉落当成投机者之刃本场开战攻速基数。[src/simulation/b8-restore.ts:183](../src/simulation/b8-restore.ts#L183)、[src/simulation/b8-restore.ts:240](../src/simulation/b8-restore.ts#L240)、[src/simulation/combat-input.ts:105](../src/simulation/combat-input.ts#L105)。

`m8.loot.receipts` 是**事务追加顺序**：排序／认证用 `claimedRoundId ?? 源掉落roundId` 的轮序，必须不早于源轮、不早于前一收据；旧球晚领可排在新球之后，不能重新按源轮排序。各次 grantDirectLoot 批内仍用 frozen slot 顺序；身份、payload、death evidence、资源账本、组件保底及本场事务顺序检查全部保留。`forfeited` 不发任何资源，不能伪造为已领或把已领改 forfeited。[src/simulation/b8-restore.ts:289](../src/simulation/b8-restore.ts#L289)、[src/simulation/b8-restore.ts:332](../src/simulation/b8-restore.ts#L332)、[src/simulation/b8-restore.ts:598](../src/simulation/b8-restore.ts#L598)、[src/simulation/loot-runtime.ts:108](../src/simulation/loot-runtime.ts#L108)。

### 开局确定性与单人按需加载

开局选择先对 seed XOR selectionStream 的 FNV hash 作 **fmix32**，再将 `floor(word*10000/2^32)` 映射到完整权重表（不跳过 disabled 区间）；`selectionRng` 记混合词、draws=1，这不是推进商店 RNG。恢复按原 seed 和配置精确重建，不以客户端投影为证据。[src/simulation/opening-encounter.ts:85](../src/simulation/opening-encounter.ts#L85)。杰斯售出／合星消耗后删其 `g24ItemPositions` 的 unit 键；D14 暂存仍属持有，item 键保留。[src/simulation/forge-positions.ts:3](../src/simulation/forge-positions.ts#L3)。

`loadSoloApplication():Promise<void>` 并发调用共用 pending，加载失败清 pending 以允许重试；`createSoloApplication(...ConstructorParameters<typeof MatchApplication>):MatchApplication` 在未加载时抛 `Solo application must be loaded before scene construction`。单人必须先 await，再创建场景；之后命令保持同步。在线启动／首次匹配无需单人保存、恢复和历史重演应用，仍消费服务器权威状态／回放；分包不改变规则、版本、保存或认证语义。生产动态包为 `assets/solo/application-[hash].js`，发布须完整部署该目录。[src/m6/application-loader.ts:1](../src/m6/application-loader.ts#L1)、[src/main.ts:21](../src/main.ts#L21)、[vite.config.ts:66](../vite.config.ts#L66)。

## 2026-10-25 V23-T1：本可发生之事历史事实认证

`restoreMatch(input: unknown, battles?: readonly BattleRecord[]): MatchState` 与 `serializeMatch(state: MatchState, battles?: readonly BattleRecord[]): string` 的签名、返回值、存档格式和规则不变。本可发生之事的施法／范德尔死亡历史计数（包括零）必须由既有完整 `battles` 重演认证；取得该强化后有非补给结算时，即使两条事实都被删除，也必须提供历史。裸 Match 不携带独立历史时抛既有 `Invalid Match save: missing historical evidence / ...`；少战／重战、战斗档案或经济收据前缀不一致时由 `validateMatchHistory` 拒绝，不补计数或重发奖励。持久化封套已有 `battles`，无需迁移。兼容内部名称 `needsCrownHistory(state: MatchState): boolean` 的适用范围扩大；它只判断证据要求，不执行结算。决定见 `S13_RULES_GAP.md` 的 P-V23-T1-HISTORY；回归见 `tests/v23-tamper-mechanics.test.ts`。

## 2026-10-24 增强池奖励抽样与支付：项目约定 P（S2）

来源：`/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json`。奖励数量、费用、指定对象与阈值按研究；下列研究未给出的语义明确标为 **P，2026-10-24**，理由是沿用已有项目池、确定性子流与唯一发奖账本，不宣称原服概率或精确支付顺序已获证。验收口径为“奖励数值匹配，抽样与时点按项目约定”。

| 编号 | 项目约定与适用范围 | 缺失证据 / 沿用理由 |
|---|---|---|
| P-AG1 | batch 1 的所有 random-item/random-unit：既有组件/成装/辅助装池、指定费用商店目录排序后等权有放回；不按剩余共享卡池重加权。Duo Queue 从一次组件抽样复制两份；学院之冕从当前三件 sponsor 等权取一。Branching Out / Kitchen 从现有22纹章等权取一。batch 2 游乐场的 Vander/Powder/Violet 等权独立有放回；极客组件同前。 | 研究只列随机、费用、数量或名单，未列权重/有放回性/学院三者概率。沿用现有内容池及独立 seat/choice/spec LCG，避免改变可变 RNG 流。 |
| P-AG2 | 本批奖励的四选锻造器沿用已有组件/成装/辅助装池，等权无放回选四个不同选项。 | 四选数量有描述/ArmoryChoiceCount；具体权重与抽样算法未给，沿用既有锻造器策略。不是学院研究的二选定制锻造器。 |
| P-AG3 | 天降金币/天降金币+（研究记录[157]/[158]，零基索引）：立即8/18金；每回合1金随该回合基础收入冻结、下一准备入口支付，不增加本次利息基数。 | 8/18/1有源；相对利息与准备入口的支付顺序无源。沿用项目延迟基础收入与唯一结算收据。 |
| P-AG4 | batch 1 初始物品/英雄在选中事务发放，容量不足走既有单人待发/联机法球。batch 2 火箭、执法、游乐场、极客、背叛奖励在权威战斗结算后按累计事实发放；底城争夺战保留微光成功/超时选择同次立即回4HP、6金。双形升三星复制随既有未锁定准备/结算发奖入口发放，战斗锁定期间延后。 | 描述给触发条件、数量，未给战斗帧内/结算内精确支付顺序；复用已认证事实、容量与收据，防止重复发奖。 |

子流稳定性只承诺修改一个 spec 的抽样数量不影响其它 spec；插入/重排 spec 会改变 index 和对应抽样（N1）。上述约定不解除其它禁用项的证据门槛；未知战利品表、未知召唤物数值等仍禁用。

## v23候选：增强池续批（2026-10-24）

本节接续batch 1，详见[续批报告](AUGMENT_POOL_BATCH2_REPORT.md)。Branching Out、Kitchen与Coronation开放，batch 1现为67项；本分支再开放本可发生之事（blood-brothers），batch 2的26项现为18项开放、8项完整禁用（[src/simulation/content/augment-pool-batch2.ts:589](../src/simulation/content/augment-pool-batch2.ts#L589)、[src/simulation/content/augment-pool-batch2.ts:623](../src/simulation/content/augment-pool-batch2.ts#L623)）。`AUGMENT_BATCH2`保存来源与原值，`AUGMENT_BATCH2_BLOCKED`保存缺字段。此内容进RULES_GAP_MANIFEST；正式身份仍待v23集成统一切换。

新增Shield/Cape源值来自仓库保留raw map22与双语stringtable：人口各+1，Shield实际死亡10%掉1金，Cape第200tick存活10%掉1金；配方锅+锅/铲+锅，人口沿用既有冠冕取得后永久授予政策。Coronation每件Crown/Shield/Cape给携带者3000AD Bps/3000AS Bps/40AP。成功与失败抽取均在ItemGoldLedger留存，复用collector物品独立流；相关存档完整重演，不修改其他RNG流。

Match公共命令、失败reason不变。内部新增：

- `batch2BattleFacts(combat:CombatState, team:Team):Batch2BattleFacts|undefined`：只由权威战斗投影，每条`{definitionId:string,count:number}`，绑定火箭数、实际极客转换、通缉死亡、游乐场资格、伙伴击杀资格；无相关成员时无字段。`validateBatch2Facts(f)`拒绝未知id、额外字段、重复id、越界/非整数计数，抛`RangeError`。该可选字段纳入已有G23BattleFacts与完整战斗重演认证，不消费经济RNG。
- `batch2RewardPlan(state:MatchState):AugmentGift[]`：从取得后battle事实逐场累计阈值/上限，收据choice namespace含奖励序号；重复派生相同。`batch1GiftPlan`/`drainBatch1Gifts`/`validateBatch1Gifts`统一包含本批的初始与阈值物品/英雄，继续容量待发及联机共享池，不接受客户端索奖参数。
- `drainBatch2Gold(state:MatchState):MatchState` / `validateBatch2Gold(state):void`：通缉每6次6金与黑市保留6金，唯一来源`augment-pool-batch2`，逐份认证身份/金额/发生轮次；重复排放原状态，非法来源或缺收据抛RangeError。已有机械金币统计与下一轮余额链照常读取收据。
- `batch2HpAfterSettlement(state,round,hp)` / `batch2HpBeforeBattle(state,roundId,hp)`：认证过的黑市保留收据每次回4HP、上限100；战后治疗先于下一轮开局猴子扣血，准备期治疗再计入下一场hpBefore，不倒写已结算战损。成功选择/超时选择走相同finishG23Choice回调；重复命令仍按旧选择错误拒绝，无治疗或金币副作用。
- `traitAugmentB2`仅编译给当前原生/纹章成员；战斗动态`CombatUnit.batch2`保留周期消耗、击中成长、处决、火箭、家人生存与伙伴击杀事实。相关战斗的恢复从已认证CombatInputBasis独立重演完整状态，比对全部运行态/事件序号；不信任候选counter，也不另设客户端战斗规则。随机发奖复用seat/choice/spec独立流，新增固定名单`random-unit-pool`，只用于解析文案明确列出的Vander/Powder/Violet。

### 双形战士接线（v23候选，2026-10-24）

研究 `/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json` 零基记录[215]（`TFT13_Augment_Formswapper`）已给全部所需奖励与属性值。`why-not-both`开放：初始给Swain/Gangplank；同一英雄两种形态同时上场时，两者各+24AP/护甲/魔抗、+2400AD Bps。形态沿现有已批准的开战前后两排行号规则，不新增形态算法。

`selectChoice`在发初始英雄之前原子追加 `ResourceFact {kind:'form-swapper-selected',choiceId:string}`；其`sequence`是选择时点。provenance fold拒绝额外字段、错误强化/choiceId/回合或重复标记；奖励验证要求拥有该强化时恰好一条标记，不拥有时无标记。`formSwapperGiftPlan(state:MatchState):AugmentGift[]`仅扫描标记之后的真实`unit-upgraded`及选秀内嵌升级事实，天然双形英雄实际升至三星才按事件sequence/子序号生成二星复制；直接获得三星或选择前升级不触发。不满足条件返回空计划，不报客户端错误；`validateFormSwapperSelection(state):void`违反边界时抛`RangeError('Invalid form swapper selection authority')`。

发放沿`drainBatch1Gifts`唯一收据，单人满席保留待发，联机法球领取占共享池3张。每次发奖后重派生计划，支持奖励本身促成的连锁合星；商店购买、复制器、选秀与法球升级共用provenance事实，战斗锁定期间继续按既有准备/结算边界处理。恢复先验证收据与完整资源事实，不接受客户端自报升星计数。该改变只属于v23候选，M1/M2身份与候选变化由后续v23纪元统一处理。

## v23 候选：增强池 batch 1（2026-10-24）

本节只为下一版扩池；不改 v22 身份常量、不重录、不提交历史证据。实现/阻塞清单与验证见 [batch 1 报告](AUGMENT_POOL_BATCH1_REPORT.md)。64 个新条目（20 个 A、22 个之徽、22 个之冕）在 `content/augment-pool-batch1.ts` 保留 14.24 apiName、等级、原始 effectAmounts、解析后的中英文奖励描述及可执行发奖计划。内容和通用抽样策略已加入 `RULES_GAP_MANIFEST.augmentPoolBatch1`，摘要自然变化；整体正式 v23 epoch 仍待集成发布时切换。

现有 Match 命令签名、失败原因不变。无新增客户端“索奖”命令。`acquisitionXp {amount}` 在强化选择原子事务中调用 `grantXp`，与获得金币同次授予，最大等级仍为 10；恢复按获得回合补入免费经验基数，再验证付费经验的四点步长。`incomePolicy` 新增可选非负整数 `roundGold`，默认 0；在选中后的各回合结算计入 `incomeBreakdown.base`，随既有唯一结算收据冻结、下一准备入口支付，预览与单人/联机/加时共用相同经济函数，不增加本次利息基数。

内部接口（不是客户端命令）：

- `grantMechanicConsumable(state:MatchState, request:MechanicGrantRequest & {definitionId:string}):MechanicGrantResult`：支持已注册的拆卸器、重铸器、杰作升级、次级/普通复制器，沿用 `consumable` 收据和 `mechanicGranted` 事件；失败 `duplicate-mechanic-receipt` / `invalid-mechanic-state`，原状态、无事件/序号消耗。
- `planAugmentGifts(state:Pick<MatchState,'seed'|'multiplayer'>, augment:OwnedAugment, specs:readonly AugmentGiftSpec[]):AugmentGift[]`：纯计划，不修改状态。支持指定物品/单位/消耗品、多份奖励、1–5 费随机单位/指定星级、指定费用全英雄、随机基础/成装/辅助/学院赞助装备，双排的两份散件复用同一次候选。随机单位/装备沿用项目已准入的排序池和均匀有放回抽样，不声称掌握原服未公开权重。赞助池由 `createG23Progress(seed).sponsored` 重建，沿用现有学院项目池，不另造赞助版本物品。
- `batch1GiftPlan(state:MatchState):AugmentGift[]` / `drainBatch1Gifts(state:MatchState, policy?:UnitLootPolicy):MatchState`：来源固定 `augment-pool-batch1`。收据 ID 为 JSON 元组 `[source,choiceId,augmentId,specIndex,copyIndex]`。重复调用不重发；单人单位与锻造器满席时不记领取收据，按现有 P2 容量待发机制于出售/部署/购买合星/下一次奖励排放重试；不是另一份库存。普通联机英雄直接排入现有奖励法球，领取时才处理共享池，二/三星分别占 3/9 张；缺池沿用现有折算规则。锻造器作为无池召唤物直接入席，满席待发。
- `augmentAnvilOffers(seed:number,receiptId:string,definitionId:keyof typeof G24_FORGE_POOLS):readonly string[]`：支持 Component/Completed/Support/Ornn，排序池内四选一、无放回。新发的多锻造器各占一个单位；打开顺序/当前回合不影响选项。打开仍用 `openAnvil` / `sellUnit`，30 秒超时首项，选完仍用 `selectChoice`。旧 Portable Forge 四选与 Radiant Relics 五选即时选择保持原语义。
- `validateBatch1Gifts(state:MatchState):void`：按已选增强和不可变种子重建来源，验证物品/消耗品/单位身份、星级、取得回合、折算；物品和消耗品不得缺失来源收据，单位允许容量待发。错误抛 `RangeError('Invalid augment batch1 gift authority')`，外层恢复拒绝。锻造器出生/打开/选择另由既有 `validateAnvils` 对账。杰作升级的猴子专属校验只豁免这个已经单独认证的新增来源，未知来源仍拒绝。

随机流：UTF-16 FNV-1a32（初值 0x811c9dc5，乘数 0x01000193）散列 `[source,seatId或solo,choiceId,augmentId,specIndex]`，以 `seed xor hash` 初始化 lcg32-v1；每个 spec 独立。多份随机装备/单位按 `floor(word*pool.length/2^32)` 取样。锻造器另用 `seed xor 0x61323366`、逐 receiptId 字符 FNV 混合后作四次 Fisher–Yates 前缀抽样。不推进商店、强化候选、奖励、战斗或奇遇的可变 RNG。

出牌沿用已批准 v22 数据规则：新 ID 映射到 14.24 apiName，自动应用同羁绊徽/冕、卓尔不群等静态互斥；3-2/4-2 使用节点开启时的场上羁绊快照，2-1 不定制；黑色玫瑰徽/冕仍禁止 2-1。不补造随机纹章池，不将源表空常量猜成奖励值。

## 2026-10-23 六费 AD（P；覆盖历史六费 AD 3.6 倍说明）

来源：本地 `perf-1022/rules-1023/approved-1023-batch2.md`，用户 10-23 批准的项目决定（P）。沃里克 **110/165/248**、维克托 **100/150/225**、梅尔 **80/120/180**；从一星值乘 `STAR_ATTACK_PERCENT` 后正数四舍五入，`floor((基础AD×整数百分比+50)/100)`，不是从二星递推。普通 AD 仍向下取整；六费 HP 与专用四星不变。`S13_COMBAT_RULES.starAttackPercent` 同时适用于普通/六费，`sixCostStarPercent` 仅用于六费 HP，新增 `sixCostAttackRounding:'half-up'` 标明取整语义。维克托固定 AD 与转 AP 的基础 AD 扣除均改用 100/150/225，额外 AD 的原有计算顺序不变。公共函数签名、输入输出形状、失败原因不变；无新命令、事件或 RNG 抽取。**待 v22 统一录制**；不更新 epoch/digest/golden。手算与验证见 [六费 AD 报告](SIX_COST_AD_STAR_SCALING.md)。

## 2026-10-23 经济与阶段流程（项目决定 P；待 v22 统一录制）

来源：本地 `perf-1022/rules-1023/approved-1023-batch2.md`，用户 10-23 批准第10/11/12/13/15条；本单离线，不扩展其他条目。本节覆盖下文旧连胜档、PvE不计连胜败和开局2/3/5基础金的历史描述。

- PvP、PvE（含1-2/1-3/1-4）胜负都更新同一连胜败；平局沿已有规则算败。结算后2–4连+1、5连+2、6连及以上+3；供给轮既不更新也不支付连胜败。PvE仍无胜利金，开局仍无利息，HP/XP规则不改。
- 兼容 #406：1-3/1-4/2-1 **准备入口基础金为2/3/4**，由上一轮1-2/1-3/1-4结算冻结应收额；2-2起基础金仍5。连胜败金同基础金一起下一入口支付；PvP胜利金仍即付。`RoundResult.goldAfter`是方案值，`state.gold`才是可花余额。三场全败且无操作/战利品时，入口余额0→2→6→11（基础9+连败2），2-1强化前已到账。恢复/重复推进不重付。
- 新只读查询 `getRoundPreparationMs(roundId:string):number`（`simulation/round-schedule`）：1-2=6000、1-3=15000、1-4及其他PvE=20000、4-6=75000，其余（含`overtime-n`）=30000毫秒；无效ID抛`RangeError`，无状态/RNG变化。服务器 `Room.afterChoiceWindow` 统一调用；选择阶段计时不变。既有`preparationMs`=30000使用规则表，显式非默认值仍作为全部回合的调试/加速覆盖。4-6选择完成后进入准备时使用75秒。
- 棱彩前奏、棱彩终章、发条猴子的`descriptionZh`改成玩家可读效果；内部来源、概率、触发、抽取和其他说明不改。无新Match命令、状态字段或失败原因枚举。

**待 v22 统一录制**：不改身份常量、epoch、历史fixture/golden/身份断言；规则表仍由既有content digest脚本采集。验收与旧失败清单见 [经济阶段报告](ECONOMY_FLOW_1023.md)。

## 2026-10-23 战斗法力规则（待 v22 统一录制）

Match公共命令/失败原因不变。战斗新增可选 `CombatUnit.damageManaRemainderCenti`（0–99），`mana`可因非受伤来源超过`maxMana`；施法后`manaLockedUntilTick`为开始tick+20。恢复从认证输入核对法力、余数、锁蓝时间，JSON保存和完整重放保持，拒绝伪造（`mana binding facts`或动态战斗既有authoritative错误）。阿木木零蓝条与维克托专用资源保持。完整公式、溢出/退款/锁蓝与暴击转换见 [COMBAT_CONTRACT](COMBAT_CONTRACT.md) 顶部及[本单报告](COMBAT_MANA_RULES.md)。**待 v22 统一录制**；本单不录epoch，不改版本/digest常量/历史golden。

## 2026-10-23 普通单位攻击力星级倍率修正（待 v22 统一录制）

用户 10-23 批准采用 TFT 通用规则：普通单位 1/2/3 星 HP 为 100/180/324%，AD 改为 100/150/225%，分别从一星基础值乘百分比后向下取整。14.24 源数据只有一星属性，不将倍率声称为源表中的三档数值。`getUnitStats(definitionId,starLevel)` / `resolveUnitStats(definition,starLevel)` 签名、输出形状和失败原因不变；无新命令。普通倍率唯一来源为 `content/unit-star-scaling.ts`，`S13_COMBAT_RULES` 元数据改为 `starHealthPercent` / `starAttackPercent`，六费用 `sixCostStarPercent`，均为星级键到整数百分比的只读表；原 `starStatPercent` 无调用方，移除。六费 HP 保留 100/180/360%；六费 AD 按各自一星值 × 100/150/225% 后四舍五入（正数半入），见下述 P 决定。魔像自定表、fixedStarStats 召唤物及专用四星值保持不变。来源、六费逐项现状、检查范围与测试清单见 [AD 星级报告](AD_STAR_SCALING.md)。不更新身份常量、epoch 或历史 golden；**待 v22 统一录制**。

## 2026-10-23 五费技能候选集成

[五费技能修正](FIVE_COST_3STAR_FIXES.md) 仅调整战斗实现：无新 Match 公共函数、输入输出、失败 reason 或网络事件种类。内部新增赛维卡持续/连咬任务，存档结构校验限定来源和取消语义，完整事实仍由认证战斗输入重演核对。按用户要求保留当前候选版本/digest/golden，随 v22 与攻击力星级倍率等改动统一录 epoch 后才能发布；不要将新旧战斗状态混用。后续项目决定P已完成金克丝三星电击和莫德凯撒最优直线，并明确玛尔扎哈五层平分；杰斯缺返回起点定义，仍未完成。见[五费技能几何报告](FIVE_COST_SKILL_GEOMETRY.md)，无新增公共签名、失败原因、事件或存档结构；待v22统一录制。

## v22 候选：全桌强化等级组合（2026-10-23 用户批准；待 v22 统一录制）

本节覆盖下文 v14/v15/PR2 的逐节点等权等级派生描述及上一版 Wiki V12.9 表。来源为用户批准第 6 条的本地 `augments-research-2026-10-23/data/odds-all27.csv`，14.24 客户端 `TFT9_AugmentArmoryConfiguration_Table`（`RandomizeProbabilityTableGlobally=true`）。按 CSV 顺序保留原整数权重，18 个非零组合，权重合计/分母 **109**；9 个零权重组合不会从基础表抽出。完整有序表冻结在 `AUGMENT_OFFER_POLICY.tierCombinations`，随既有 `scripts/content-digest.ts` 的 augmentPolicy 输入进入内容 digest；策略版本仍为候选 `augment-tier-table-v22`，整体 epoch/digest/golden **待 v22 统一录制**。

| 三次强化等级（银/金/彩，按 CSV 顺序） | 原权重 |
| --- | --- |
| 银银金 / 银银彩 / 银金金 / 银金彩 / 银彩彩 | 5 / 5 / 12 / 5 / 1 |
| 金银金 / 金银彩 / 金金金 / 金金彩 | 18 / 2 / 22 / 12 |
| 金彩银 / 金彩金 / 金彩彩 | 6 / 10 / 1 |
| 彩银金 / 彩银彩 / 彩金金 / 彩金彩 / 彩彩金 / 彩彩彩 | 4 / 1 / 2 / 1 / 1 / 1 |

每局逻辑上只取一个组合，三个日程节点索引同一次样本。沿既有 UTF-16 FNV-1a32 算法（初值 `0x811c9dc5`、乘数 `0x01000193`、逐步 uint32），固定流名 `augment-tier-sequence-v1` 替代节点 ID；输入 `(rootSeed xor 0x61756774 xor streamHash) >>> 0`，lcg32-v1 仅取首词，`word % 109` 对应有序累计权重的半开区间。单机根为 Match.seed，联机根为 initializeSharedSeat 绑定的 SharedPoolState.seed（augmentTierSeed），与席位种子、调用顺序、候选或换牌次数无关。纯函数按不可变根重推同一组合，不新增可变 RNG/存档字段；不推进商店、候选、奖励、战斗、奇遇等任何现有流。恢复与回放共用此算法，私有投影仍不公开未来等级。

奇遇仍先覆盖指定位置，不重抽组合、不按奇遇重新归一化：`golden-gala`（范德尔/PR2 augment-policy）三节点全金；`prismatic-party`（艾克/PR2）三节点全彩；`prismatic-prelude`（黑默丁格/PR2）仅 2-1 彩；`prismatic-finale`（黑默丁格/PR2）仅 4-2 彩。其余位置保留基础组合，其他奇遇无等级覆盖；激活收据语义不变。

同批批准第 7、8 条：`geniuses`（羁绊：天才）从金改彩，其他强化档位、能力/赠卡数值不变；服务器 `ROOM_TIMING_DEFAULTS.choiceMs` 曾为 48_000；海克斯并入 50 秒准备阶段后回到 30_000（海克斯在 50 秒准备阶段内选，其他选择 30 秒），`CAT_CHOICE_SEC` 和显式 `RoomOptions.choiceMs` 仍可覆盖。该时长沿用既有统一 choice 阶段（强化及其他选择），不新增按类型分流或领域时钟。期限前不自动选取，到期沿既有 `timeoutChoice`；不消耗新的 RNG。天才改彩/48 秒为项目决定 P，来源为用户 10-23 批准的 `perf-1022/rules-1023/approved-1023-batch2.md` 第 7、8 条。界面本地演示默认覆盖仍为 30 秒，需 Claude 同步；在线服务器默认已为 48 秒。

接口：既有 Match/server-entry 导出的 `deriveAugmentTier(seed:number,choiceId:string):AugmentTier` 保留签名，只接受 `round:2-1:augment` / `round:3-2:augment` / `round:4-2:augment`，返回组合第 1/2/3 项；非法节点抛 `Error('Unknown augment tier node')`。`resolveAugmentTier` 签名不变、先用奇遇覆盖。领域内部/测试新增 `augment-offers.ts` 导出 `deriveAugmentTierSequence(seed:number):readonly [AugmentTier,AugmentTier,AugmentTier]`，返回未覆盖的基础组合；配置权重不覆盖票值时抛 `Error('Invalid augment tier combination weights')`。没有新增命令或失败原因枚举；命令失败仍原 state、无事件/资源/RNG 变化。旧规则历史录制不迁移、不改断言，本批恢复一致性针对当前实现新生成的状态。

## 2026-10-23 锻造器单位覆盖合同（待 v22 统一录制）

本节覆盖下文以及 Batch A/B 报告中锻造器“自动弹窗/终局自动选择”的旧语义。四种 `TFT_ArmoryKeyCompleted/Component/Ornn/Support` 为备战席单位：不占人口、不可上阵/合星/装备、可挪位并跨回合保存。满席锻造器保留在未领取法球，其他条目可部分领取。蔚给 2 基础、杰斯给 1 神器；法球、史诗奖励、订阅/梅尔/巨蟹和 G2-3 forge atom 均改发单位。光明遗物 5 选 1、便携锻炉 4 选 1 仍立即选择。

新增 `openAnvil(state, unitId): MatchCommandResult`，共享/线上命令 `{type:'openAnvil',unitId}`；出售锻造器等价打开且不加金币。新 `pendingChoice.payload={kind:'forge',source:'anvil-unit',timeoutMs:30000,timeoutOption:offers[0]}`；仍用 choose 和 timeoutChoice，4 选 1，保留原采样器/种子流，超时首项。本人 `preparation.units[].anvil` 提供名称、出售/悬停文字及时间；公开观战不暴露选项。命令失败枚举、字段、发放接口、收据/恢复、Claude 计时器接入点见 [锻造器报告](ANVIL_UNITS.md)。规则不使用墙钟，打开后的独立 30 秒计时尚待 Claude 接线，不能复用准备期剩余秒数。

4-7 野怪回合固定额外给 1 个基础装备锻造器（项目决定 **P**，用户 2026-10-23 批准）；原有 2–4 个散件掉落照常，不替换、不减少。固定 forge payload 追加到冻结计划首个法球末尾，不新增 RNG 消耗；领取入备战席，满席留球，沿用原收据、恢复和回放路径，单机/联机同源。14.24 原版数据未找到 4-7 必出散件锻造器的证据，仅有一张未被引用的 `EpicNPCLootComponentAnvil` 表，不能据此标为原版确认。候选规则/content 身份已变更，schema12/save8/replay7/command7；digest 随 manifest 计算，历史 epoch/golden 不改，**待 v22 统一录制**。

## 2026-10-23 黑市开市固定装备（待 v22 统一录制）

用户 10-23 批准“改”：黑市仍按原始权重、同一经济流的一词抽一个完整奖励包；开市时用既有奖励 atom 派生流，将包内直接发放的装备确定为 definitionId，保存在 `G23MarketOffer.concreteItems: readonly {atomId:string;definitionId:string}[]`（无装备为 `[]`）。具体装备包含固定装备，锻造器的后续选择、复制器目标、弈子及其他奖励不改。领取复制该数组到 `G23RewardBundle.concreteItems`，发装备只读取所存结果，不再抽取。

私有界面入口为 `toPrivateSeatView(state).seatMechanics.seat.alchemist.offer.concreteItems`，例如 `[{atomId:'g23:market:round-12:1:atom:0',definitionId:'TFT13_Crime_Bronze_MageGuard'}]`（仅形状示例）。`offer.optionId/optionIds` 和 `pendingChoice.offers` 仍是原奖励包 apiName；界面按 definitionId 查已有装备名称，不得将其当作 choose 参数。拿走仍用 `selectChoice(state,choiceId,generation,offer.optionId)`，保留/超时仍为 `@skip`；没有新增命令或失败枚举，原有 stale/invalid-choice 原子失败不变。接口由既有 owner-only seatMechanics 投影直接带出，界面及服务器文件未改。

派生仍为 `sampleG24Reward(pool, \`${seed}:${offer.id}:atom:${index}\`, 1)`，相同 seed/offer/源顺序的装备与旧领取时结果一致；无新增子流，不消耗市场、王冠或其他全局 RNG 游标。恢复/战斗输入/回放按原经济收据重建 offer 与领取包，严格比较包括具体装备的完整结构，缺失、重复、改序、跨 offer 或同池换装均拒绝；不迁移旧存档。保留微光、跳过成长、整包及唯一发奖语义不变。规则身份已记入 `G23_POLICY.chemBaron.equipment`；epoch/version/digest 常量及历史 golden 留待 v22 统一录制，候选不得混跑发布。验收见 [黑市报告](BLACK_MARKET_CONCRETE_OFFERS.md)。

## v22 候选：奇遇展示读取兼容投影

`openingEncounterId`、`readOpeningEncounterView`、`readOpeningMelProgress` 的只读输入扩为 `OpeningEncounterReadState`，接受完整奇遇状态、公开白名单或 null/缺字段；奖励读取只认权威 selection/receipts，不从投影重建。权威恢复校验及规则结果不变。完整签名、返回/失败语义、客户端回归及旧基线失败见 [V22_VIEW_FIX_REPORT](V22_VIEW_FIX_REPORT.md)。

用户 10-23 批准采用 TFT 通用规则：普通单位 1/2/3 星 HP 为 100/180/324%，AD 改为 100/150/225%，分别从一星基础值乘百分比后向下取整。14.24 源数据只有一星属性，不将倍率声称为源表中的三档数值。`getUnitStats(definitionId,starLevel)` / `resolveUnitStats(definition,starLevel)` 签名、输出形状和失败原因不变；无新命令。普通倍率唯一来源为 `content/unit-star-scaling.ts`，`S13_COMBAT_RULES` 元数据改为 `starHealthPercent` / `starAttackPercent`，六费用 `sixCostStarPercent`，均为星级键到整数百分比的只读表；原 `starStatPercent` 无调用方，移除。六费原有 100/180/360%、维克托固定 AD/转法强基线、魔像自定表、fixedStarStats 召唤物及专用四星值保持不变。来源、六费逐项现状、检查范围与测试清单见 [AD 星级报告](AD_STAR_SCALING.md)。不更新身份常量、epoch 或历史 golden；**待 v22 统一录制**。

## 2026-10-23 Batch A 覆盖合同（待统一 epoch）

梅尔、维克托、金币订阅、战利品订阅已启用，覆盖历史关闭/只观察说明。普通六费商店也改为批准的完整q表、整店一次5q判定。接口、收据、恢复、加时阶段钟和UI字段见 [Batch A报告](OPENING_ENCOUNTERS_BATCH_A_REPORT.md#接口与恢复合同)。公开命令不新增；装备与弈子待领使用既有 `claimOrb`，锻造器使用既有 `choose/timeoutChoice`。本批装备统一待领，不引入批准表外的库存格数。

## 开局奇遇 Batch B（2026-10-23，待统一 epoch）

四项已启用，覆盖下文 PR4/PR6 停用语义。`createMatch`/`initializeSharedSeat` 自动授予魔像，`nextRound` 自动升星及替换蟹编组；`commitG23Settlement` 接收权威首次死亡事实后一次发奖，客户端不得提交死亡来索奖。新增 `readOpeningBatchBRewards(state)` 只读本人已结算奖励；联机弈子仍用 `claimOrb` 与共享池事务。公开签名、输入/输出、失败原因、永久纹章、收据、恢复、箱子及UI字段见 [报告§3](OPENING_ENCOUNTERS_BATCH_B_REPORT.md#3-接口与恢复合同)。不更改当前epoch/digest常量或历史夹具。

## 2026-10-23 安慰剂与战斗加时（项目决定 P，待统一 epoch）

用户 10-23 拍板：安慰剂按获得阶段一次发放 **2阶段8 / 3阶段11 / 4阶段及以后15** 金币；安慰剂+暂按 **15 / 18 / 22**，全队 **1%攻速**不变。S13原版安慰剂并非分阶段，本项目明确采用自定义规则，不改原始来源归档。收据以获得时的 round 认证，不随当前阶段重算或补发。

每战固定50ms/tick、最长 **900 tick（45秒）**；先结算该tick和消灭判定，双方仍有存活单位才 timeout→draw。**tick600（30秒）即时第1层**，之后每20tick加1层；伤害增幅和攻速各+1000Bps/层，无层数上限；受到治疗/护盾与新控制时长各-1000Bps/层，最多-7000Bps。控制持续tick四舍五入（正数半入，至少1tick），旧控制不回改。攻击冷却不追溯重算，模拟速度不变。

层数/增减幅依据用户提供的 [Riot TFT 13.22 补丁说明](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-13-22-notes/)；30/45秒和离散tick边界为本项目执行约定。**本单按要求离线，未联网重新核验来源。** 移速固定加成缺明确数值，`OVERTIME_MOVE_SPEED_BONUS_BPS=0`，保留TODO，本单不改变移动间隔。完整数值、调用点和验收见 [规则实现报告](RULES_PLACEBO_OVERTIME.md)。

本节覆盖下文历史60秒/1200tick及固定安慰剂金币描述。按用户要求不录epoch、不更新版本/digest常量或历史golden；待PR #410合并后统一切换。这是开发候选，当前身份不得用于新旧混跑或发布。

## 联机终局流法球（2026-10-23）

`revealMatchCombatStreamTerminal(state, terminal): MatchCommandResult` 在可信 PvE 首遍终局登记可选 `pendingCombatTerminal`，提前揭示最后一击的掉落；保留 combat 阶段和领取 FIFO，结算时移除临时字段并按唯一收据发放。签名、`wrong-phase` 失败语义、校验、恢复边界和客户端字段见 [联机合同](MULTIPLAYER_CONTRACT.md#终局流法球揭示2026-10-23)。不改规则数值、RNG、网络命令或最终结算顺序。

## 战斗装备阶段 2（2026-10-22，候选身份；未录制 epoch）

已实现下一未封口 tick 安装、属性/装备程序重编译、PvE/PvP 私有成功日志与来源凭据、重放和恢复；本节覆盖历史 T12 下场生效及 #382 的 `battle-input-unsupported`。命令、完整签名、失败原因、羁绊冻结依据、服务器原子边界、UI 字段及待集成身份见 [LIVE_COMBAT_EQUIPMENT_PHASE2](LIVE_COMBAT_EQUIPMENT_PHASE2.md)。当前工作树已与开局奇遇合成候选 `v21-opening-encounters-battle-equipment`，正式历史 epoch 仍为下节 black-market，留 PR9 统一录制后发布。

本次合并同时保留奇遇状态、效果、独立随机子流和战斗中装备的下一未封口 tick 安装、`beforeTick`、私有 `inputLog`、`queueEquipment`。`CombatStream` 构造器同时接收保留为成员的 `beforeTick?: BattleTickInputSource` 与可选的已分步创建 `liveTask`；#402 的 `open` 生成器继续完整创建后才发布，不同步重建任务，装备继续注入同一任务。没有新增失败枚举或改写两边玩法。

身份数值取两边需求的最大值：装备侧 11/7/5/5、奇遇侧 12/8/6/6 → schema/save/replay/command=**12/8/6/6**；运行时与 `M8Version` 字面量一致。schema/save 覆盖奇遇状态，replay/command 覆盖杰作两步选择；装备语义由合成 rules/content 与双摘要区分。网络协议保持既有值；不迁移旧身份、不录 epoch、不改 golden。下方各 PR 节的旧版本与摘要仅为阶段记录，当前身份以本节为准。

## 开局奇遇 PR2 + PR4 + PR5 + PR6 集成（2026-10-22）

当前候选以已录制的 `v20-black-market` 为父 epoch，已合入 multiplayer `933e0840`（含 #402 开战切片）；rules/content=`s13-g2-3-v21-opening-encounters-battle-equipment` / `s13-14.24b-g2-3-v21-opening-encounters-battle-equipment`，schema/save/replay/command=12/8/6/6，未录制 epoch，留 PR9 统一处理。黑市继承下方单包规则。

当前配置身份为 `opening-encounters-14.24b-pr2-pr4-pr5-pr6-v1`：保留 PR2 四种强化约束、两种锻造器及独立子流、PR4 魔像关闭接口、PR5 发条猴子四分支及杰作两步选择，合入 PR6 梅尔门槛观察与沃里克关闭接口。梅尔/沃里克/魔像奖励仍关闭，不补发、不重抽。rules/content 沿用未发布 v21，schema/save/replay/command=12/8/6/6；网络协议及接线由 PR8 协调，epoch 留 PR9 统一验收。

合并后双摘要：CONTENT=`fnv1a32-utf16:ef26ec2b`，LOOT_REPLAY=`fnv1a32-utf16:af60008c`；由 `node scripts/update-content-identities.cjs --write` 离线生成，`--check` 核验。各独立 PR 报告中的旧身份仅记录当时交付。

本次合并验收：`npx --no-install tsc --noEmit`、双摘要脚本 `--check` 和 `git diff --check` 通过。Vitest 用 `--configLoader runner --no-file-parallelism` 绕过共享 node_modules 的只读配置缓存，覆盖 grep 命中的全部 `.test.ts`、所有奇遇集成测试、装备服务器/网络测试、combat-stream 两组通配、3D 隔离及旧 epoch 检查：22 文件 / 627 项，346 通过、281 项预期旧身份失败；16 文件全过。失败逐项汇总：`opening-random-identity` 136（摘要/旧存档/事件哈希）、`m8-content-equivalence` 134（unsupported-version）、`v19-part2` 1、`match-contract` 1（旧版本号）、`m8-contracts` 1（硬编码合并前 v21-opening-encounters）、`server/battle-start-slices` 8（旧 black-market fixture；实测 round3 为 invalid-pool，round9/23 为 battle-validation:content-digest，导致后续切片断言失败）。其余全部通过；#402 当前身份的实时流和 PvE/PvP 装备注入/重放由通过的 combat-stream、server/battle-equipment-phase2 等覆盖。保留所有测试与历史 fixture，PR9 再统一录制身份证据。 浏览器脚本 `tests/battle-equipment-browser.mjs` 的 2D/3D 两种模式均通过，tick0 提交、tick1 生效，pageerror=0；仅在内存中把已占用的本地端口 5188 改为 5199，以 Node 原生 TypeScript 配置加载和 /tmp 缓存运行，未改脚本或构建配置，浏览器拒绝外部请求。

本人进度拆为 `readOpeningForgeProgress(state:MatchState):OpeningForgeProgress` → 可选 `openingForgeProgress`（仅组件/神器锻造器有收据时存在），及 `readOpeningMelProgress(state:Pick<MatchState,'openingEncounter'>):OpeningMelProgress` → `openingMelProgress`（非梅尔或未绑定为 null）。两种类型、reader 均从 simulation/match 导出；旧同名 reader/字段不保留。字段内容见各奇遇专节，公共投影不带个人进度。

`validateOpeningEncounterState` 先认证绑定与事实，再严格比较完整 receipts 与「到期效果收据 + 首次梅尔观察收据」；最后沿用 `validateOpeningForges`、`validateMonkeyGrants` 的选择/资源来源认证。各奇遇互斥，未适用分量为空；缺失、重复、篡改、跨奇遇混入均拒绝，不靠过滤丢弃未知收据。效果收据仅猴子伤害允许 hpBefore；梅尔观察另含 hpBefore/hpAfter。`commitOpeningEncounterHealth` 仅处理梅尔，其他奇遇原引用返回，不能清空或拒绝 PR2/PR5 合法收据。

# 开局奇遇 PR6：梅尔门槛收据与沃里克关闭接口（2026-10-22）

本节覆盖下方 PR1 的“全部 receipts 必须为空”与“无个人进度”描述，其余 PR1 合同沿用。方案第3/4/6/9节已获用户批准；仅使用本地调研 JSON/Markdown，不联网。梅尔、沃里克权重仍各800 Bps，**表内 enabled=false**，不移除、不重抽、不重归一化。梅尔奖池/权重、沃里克概率/奖池/保底/上限继续为 null；没有发奖执行器。六费梅尔救命与六费沃里克吞噬均为独立既有机制，不充当奇遇奖励。

## 门槛、收据与恢复

梅尔只在个人首次 `oldHp > 40 && 0 < newHp <= 40` 时记录观察收据，每席一次。正常结算顺序为伤害计算→六费梅尔救命判定与提交→最终HP/淘汰状态→奇遇门槛收据。单人 `settleRound` 与多人 `applyRoundSettlement` 都调用同一钩子。0 HP不触发、不被奇遇复活；旧HP≤40不触发。即使后来回血再跨越，也不产生第二条。关闭状态下只有门槛记录：不发金币、物品、工具或选择，不发奖励事件，不形成待领取权益，将来启用不会据此追发。

`OpeningMelThresholdReceipt extends OpeningEffectReceipt`：

```ts
{
  kind: 'mel-threshold'; receiptId: string; factId: string; seatId: string; nodeId: string;
  round: number; hpBefore: number; hpAfter: number; rewardStatus: 'blocked-evidence';
}
```

保存在 `MatchState.openingEncounter.receipts`，不混入六费梅尔的 `mel-save`、G23奖励或共享 `facts`。`instanceId=JSON.stringify(['solo',seed])` 或 `JSON.stringify(['shared',poolId])`，`seatId='solo'` 或共享绑定席位；`nodeId=首个合格RoundResult.settlementId`；`receiptId=factId=JSON.stringify([instanceId,'mel-threshold',seatId,nodeId])`。seed包含在内部单人键内，键本身绝不公开投影。

`validateOpeningEncounterState` 从 `roundResults` 重建首个合格收据并严格比较，包括字段白名单、原始HP、席位/节点/实例和奖励关闭状态。效果收据与梅尔观察收据统一严格认证；梅尔/沃里克共享 facts 仍为空，PR2/PR5 沿用各自事实约定。离线 `restoreMatch/serializeMatch` 同时沿用完整HP链、伤害/救命和历史认证；共享 `restoreSharedOrbSnapshot/assertSharedPoolConservation` 用同一奇遇校验及既有共享恢复边界（不新增完整战斗重演）。缺失、重复、篡改、跨席复制及无历史收据拒绝，不在恢复时补抽/补登记。后续 `applyOpeningEffects(state,[])` 与钩子重入保持原引用、无事件。

梅尔奇遇的当前HP变更来源是结算历史；PR5猴子回合外伤害由其效果收据独立认证，两种奇遇互斥。未来若允许梅尔叠加回合外伤害，须先扩展同一门槛收据重建器，不能单改playerHp后调用钩子或另造奖励引擎。当前单次标准/加时PvP伤害最多27，41→致死的救命顺序采用独立策略向量测试；实际救命结算另测低HP致死，不修改伤害表凑边界。

## 新增导出与失败枚举

`src/simulation/opening-encounter.ts` 导出以下全部接口；前三个查询/关闭入口和类型由 `src/simulation/match.ts` 再导出。`commitOpeningEncounterHealth` 仅为领域结算钩子，不是客户端命令。本PR按目录权限**未改 src/server-entry/**；PR8接线时由接口负责人增加新函数/类型的重导出。已有 `toPrivateSeatView` 公共导出直接带新增本人字段。

```ts
isMelBlessingCrossing(oldHp: number, newHp: number): boolean
readOpeningMelProgress(state: Pick<MatchState,'openingEncounter'>): OpeningMelProgress
applyWarwickHunger(state: MatchState, facts: readonly OpeningWarwickKillFact[],
  shared?: OpeningEncounterContext): MatchCommandResult
commitOpeningEncounterHealth(state: MatchState): MatchState
```

`OpeningWarwickKillFact={battleId:string,eventSeq:number,victimId:string,victimKind:'champion'|'summon'|'monster',settlementEligible:boolean}` 是未来权威resolver输入形状，只预留接口，当前不消费或认证击杀，不建立抽奖/保底/次数状态。空数组、重复事件、野怪、召唤物及镜像均不抽奖。未来合格击杀排除野怪/召唤物、以battleId和死亡事件序号去重、镜像不重复授予的执行与恢复认证都仍待奖池配置完整后实现。

| 失败 | 本PR含义 |
| --- | --- |
| `RangeError('Invalid opening encounter HP')` | 门槛输入不是0–100安全整数；纯函数无副作用 |
| `opening-context-mismatch` | 选择/绑定不合法，或观察收据与首个门槛历史不一致；校验/钩子抛OpeningEncounterError，命令返回失败 |
| `invalid-opening-effect` | 对非沃里克选择调用沃里克入口；既有apply仍拒绝非空共享facts |
| `opening-config-incomplete` | 沃里克选择和绑定合法，但所有掉落配置缺证，因此任何输入均失败；修改enabled的配置断言同样被拒绝 |
| `invalid-receipt` | 多人结算内部钩子失败时沿用applyRoundSettlement的原子失败枚举 |
| `duplicate-settlement` / `mirror-settlement` | 沿用多人结算重发/镜像拒绝；不会重复记门槛 |
| `invalid-seat-state` | 共享快照内奇遇收据校验失败；非法全局上下文仍为invalid-pool |

没有新增失败枚举字面量；命令失败保持原state引用，无events、不消耗资源/RNG。观察重复是成功无副作用，不引入opening-effect-already-applied。

## 界面白名单、随机与身份

新增 `toPrivateSeatView(state).openingMelProgress`（亦由独立reader返回）：非梅尔或shared-deferred为null；梅尔为 `{encounterId:'mels-blessing',thresholdHp:40,thresholdReached:boolean,rewardStatus:'blocked-evidence',triggeredRound:number|null,hpBefore:number|null,hpAfter:number|null}`。未触发时后三项为null。它是本人只读投影，不得给其他玩家；不含收据ID、seed、RNG、未来奖励。公共 `readOpeningEncounterView` 形状不变，仍显示真实身份与“效果尚未启用”，不能将thresholdReached显示为“已获奖”。

本PR新随机子流数/抽词数均为**0**。仍只有PR1的 `opening-encounter-v1/select` 一次抽选；门槛/收据纯确定性，沃里克拒绝入口不使用其他流。未启用时不提前抽未来奖励；将来奖励子流须从已有 `opening-encounter-v1/seat/<seatId>/<effectKey>` 另行命名并写合同。B补丁 `melBOverride.crownsInAffectedBranch=2` 覆盖归档该分支的3，继续只是证据/配置约束；没有完整奖池时不发冠冕，不能据此给所有人固定两冠冕。

配置身份为 `opening-encounters-14.24b-pr2-pr4-pr5-pr6-v1`，门槛及关闭约定纳入同一个rules manifest和双digest。rules/content仍为未发布v21-opening-encounters，schema/save/replay/command保持12/8/6/6；旧PR1配置/digest也不能恢复为PR6。双digest由既有离线脚本重算，精确值见PR6报告。epoch/golden留PR9统一录制，本PR不改旧身份断言。

## 开局奇遇 PR5：爆爆「发条猴子」（2026-10-22）

本节规定 PR5 猴子效果，不覆盖 PR2 强化/锻造器或 PR4 魔像关闭约束。`wind-up-monkey` 已 `enabled=true/effectStatus=active`；固定权重500 Bps及全部16项区间不变。配置 `opening-encounters-14.24b-pr2-pr4-pr5-pr6-v1`；rules/content 仍为开发 v21，schema/save=12/8；按批准方案将 replay/command 升至 **6/6**（工具两步选择语义），网络协议编号仍由PR8另行协调。不录制epoch，不更新旧golden；双digest由现有脚本重算。

**来源与触发：**只读批准方案第3/4/6/9节及本地 `tft_s13_opening_encounters_14.24b.json` 的 encounters[10]，不联网。3-5准备入口一次、全局四分支各2500 Bps：存活席位各受10伤害／各得25金币／各得1个杰作升级／各得4件普通基础装备。此前淘汰者不发奖、不复活。八席含机器人一致。具体准备入口、全局抽样及个人身份独立为批准项目约定；调研原始null仍保留。杰作复用现存 `G23_RADIANT_MAPPING` 全36项和对应14.24b光明定义，不新增或调整装备数值；原有限光明运行时的已知约定不因本PR改写。

**随机：**两个新流均以单人seed／共享pool.seed为根，对完整流名按UTF-16 code unit做FNV-1a32，`rng=(rootSeed XOR hash)>>>0`，lcg32-v1。

| 子流 | 消费与结果 |
| --- | --- |
| `opening-encounter-v1/shared/wind-up-monkey/outcome` | 1词，`floor(word*4/2^32)`，依次damage/gold/masterwork/components。单人也用该名称。精确四等分，没有第五分支、补抽或重归一化 |
| `opening-encounter-v1/seat/<seatId>/wind-up-monkey/components` | 每席4词，对按ID排序的现有八普通组件池，逐词`floor(word*8/2^32)`；有放回，可重复。solo席位名为`solo` |

工具选择完全个人操作，不需要随机词；超时选第一候选。上述流不读写商店、强化、奖励、装备、重铸、战斗、掉落或选秀流。恢复重推只认证，绝不补发或再推进。

**权威状态与收据：**`OpeningEffectFact` 新增可选 `outcome: 'damage'|'gold'|'masterwork'|'components'`（仅猴子存在），`nodeId='3-5'`、`effectKey='monkey/<outcome>'`，factId沿原公式而节点改为3-5。`planOpeningRound`在3-5返回新context并将唯一fact写入context.facts；其他节点不揭示，不可仅丢弃返回的context。重复规划保留已有context。单人完整context、共享pool唯一context的权威位置不变。

每席独立 `openingEncounter.receipts` 沿用原receiptId公式；伤害收据额外含 `hpBefore`，其余分支禁止该字段。金币/工具的 `seatMechanics.receipts.receiptId` 等于效果收据ID；四组件分别加 `/component/0..3`。来源统一 `opening-encounter-monkey`，物品另写既有 `item-acquired` mechanic provenance。工具为 `consumable-N`／`definitionId='masterwork-upgrade'`（源API名已存在于本地奖励源表：`TFT_Consumable_MasterworkUpgrade`）。工具和组件不塞进征服者箱或PvE掉落账本。重复完整apply成功返回原state、events=[]；缺收据、错误分支、错误数量/来源、重复、篡改候选/映射或已消费工具的恢复均拒绝，不修复。

**生命周期及多人原子边界：**单人`nextRound`自动在3-5准备入口应用；多人必须用全存活席位 `nextSharedRound`，不可逐席发奖/扣血。该事务先准备所有席位，冻结一个全局fact，完成所有效果，再在内部统一返回淘汰者卡池、最后刷存活者商店；任何席位失败返回原pool和原states、无events。存活席位若有既有待选，仍遵循原推进准入，不覆盖它。3-5没有额外收入或伪造战斗结算，HP链在3-5准备节点扣一次，后续战斗另正常结算。

伤害 `hpAfterRaw=hpBefore-10`，`playerHp=max(0,hpAfterRaw)`，可致死。非战斗伤害不调用六费梅尔战斗救命被动。名次沿§11.5：未截断HP降序→受伤前HP降序→固定seatIndex升序（较优者名次较小）；同批统一排名，不依赖输入/到达顺序。全员死亡仍确定第1名，无存活冠军；存活≤1时ended=true。既有未领取奖励按淘汰规则forfeit，库存卡池仅返还一次。

```ts
// 既有shared-pool.ts入口签名不变，成功结果新增可选openingResolution。
nextSharedRound(pool: SharedPoolState, states: readonly MatchState[], expectedRound: number): SharedPoolBatchResult
interface OpeningRoundResolution {
  nodeId: '3-5'; outcome: 'damage'|'gold'|'masterwork'|'components';
  eliminated: readonly {seatId:string; rank:number; hpBefore:number; hpAfterRaw:number}[];
  ended: boolean;
  survivorRanks: readonly {seatId:string; rank:number}[];
}
// 返回states保留本批新淘汰席位；后续调用只传仍存活者。
// ended时合并eliminated、survivorRanks及Room以前已固定的名次，最后统一发布。
// 不重复调用releaseSeatOnElimination；它已在事务内完成。
```

**杰作升级命令与本人投影：**复用`useConsumable(state, consumableId, {kind:'unit',unitId})`，仅准备阶段、无其他待选、非战斗锁定时可开。第一次不消耗工具；打开 `pendingChoice.kind='armory'`、`payload.source='masterwork-upgrade'`、`payload.masterwork={consumableId,unitId}`、`returnPhase='preparation'`、`choiceId=JSON(['masterwork',consumableId])`、generation=0、所有prices=0。offers是该单位永久装备中可升级的**物品实例ID**，按装备槽递增；组件、神器、辅助装、纹章、光明、临时装备均不进入。候选必须是普通36成装中有recipe且有对应光明映射者。弹窗期间交易/装备编辑/战利品法球领取暂停，避免目标变化；选择超时不会花金币。

第二步复用`selectChoice(state, choiceId, generation, itemInstanceId)`／shared `choose`，超时复用`timeoutChoice`并选offers[0]。一次事务消费工具、消费被选普通装备实例、生成下一个item-N的对应光明版并放库存；其他装备保留，窃贼手套的临时子装备正常撤销。写 `consumable-used` provenance（effect=`masterwork-upgrade`，target含unitId及itemId、affectedItems只1件、outputs只1件、重铸RNG前后相同）和既有armory选择收据。外部`useConsumable`不得直接传itemId绕过第一步。

```ts
// match.ts公共重导出；不暴露未来结果。
readMasterworkOptions(state: MatchState, unitId: string): readonly {
  itemId:string; definitionId:string; radiantDefinitionId:string;
}[]
// 既有签名增可选权威shared参数；淘汰观战传pool.openingEncounter也可看到全局已揭示结果。
readOpeningEncounterView(state: Pick<MatchState,'openingEncounter'>,
  shared?: OpeningEncounterContext): OpeningEncounterView
// 现有openingEncounter.revealedFacts现在仅白名单：[{nodeId:'3-5',outcome}]；3-5前=[]。
// toPrivateSeatView新增可选masterworkOptions（仅本人打开杰作选择时）；其他玩家不接收。
```

领域内部/测试模块导出：`opening-monkey.ts` 的 `MONKEY_NODE/MONKEY_ROUND/MONKEY_OUTCOMES`、`MonkeyOutcome`、`selectMonkeyOutcomeFromWord(word:number):MonkeyOutcome`、`monkeyOutcome(seed:number):MonkeyOutcome`、`monkeyComponents(seed:number,seatId:string):readonly string[]`、`monkeyReceipt(state):OpeningEffectReceipt|undefined`、`applyMonkey(state,fact,receipt):{state,events}`、`validateMonkeyGrants(state,fact?):void`、`openingHpBeforeRound(state,roundId,hp):number`。这些不单独构成客户端命令，applyMonkey只允许在已验证的opening事务内使用。`masterwork-choice.ts` 导出 `openMasterworkChoice(state,consumableId,target):MatchCommandResult`、`completeMasterworkChoice(state,optionId,timedOut):MatchCommandResult`、`validateMasterworkChoice(state):void`；`consumables.ts` 新增 `masterworkCandidates(state:Readonly<MatchState>,unitId:string):readonly ItemInstance[]`。调用方使用Match入口；所有输入状态仍须来自可信领域/严格恢复。

**事件、失败与恢复：**除原 `openingEffectApplied`、`mechanicGranted`、`choiceOpened/Selected/TimedOut`、`consumableUsed`、`itemReforged`及`itemsRemoved`外，新增伤害事件 `{type:'openingMonkeyResolved',receiptId,outcome:'damage',hpBefore,hpAfterRaw,hpAfter}`。完整事件序号连续，不用动画截断账本。没有新增失败字符串：奇遇用`opening-config-incomplete/opening-context-mismatch/invalid-opening-effect`；工具沿用`wrong-phase/unknown-consumable/unknown-unit/invalid-consumable-target/temporary-item`，选择沿用`stale-choice/invalid-choice/duplicate-mechanic-receipt/invalid-mechanic-state`；共享前置准入沿`invalid-pool/invalid-seat-state/stale-seat/incomplete-seats/stale-round/stale-refresh/unsettled-round`等既有SharedPoolFailure。非法操作原state/pool、无events、不耗工具/物品/金币/RNG；读/恢复验证异常沿原Error/RangeError边界。

PR8必须接收新的openingResolution并在刷出3-5准备画面前同步Room的alive/hp/rank/ended；Room不能再按战斗结算方式自行重复扣血、返池或排序。server-entry重导出、服务器消息/UI回调及工具图标表由Claude接线；本PR不修改这些目录。PR5 原报告中的工具图标缺项在当前工作树已补有 `TOOL_MARK['masterwork-upgrade']`；保留 UI_REQUESTS 中的接线及验收要求。PR9统一epoch录制、历史字节核验与完整验收后再发布。

## 开局奇遇 PR2：强化约束与 1-2 锻造器（2026-10-22）

本节覆盖下方 PR1 中“15 项关闭、facts/receipts 为空、apply 无效果”的历史描述。按用户批准方案第3、4、6、9节实现；14.24b、不联网、不补造缺证数值。配置身份为 `opening-encounters-14.24b-pr2-pr4-pr5-pr6-v1`；沿用未发布的 v21 rules/content、schema12/save8/replay6/command6，重算双 digest，不录制 epoch，PR9 统一录制。

| enabled=true 的新增结果 | 效果 |
| --- | --- |
| `golden-gala`（范德尔） | 2-1／3-2／4-2 全 gold |
| `prismatic-party`（艾克） | 三节点全 prismatic |
| `prismatic-prelude`（黑默丁格） | 2-1 强制 prismatic |
| `prismatic-finale`（黑默丁格） | 4-2 强制 prismatic |
| `component-anvils`（蔚） | 1-2 每席两个基础装备锻造器，依次选择 |
| `artifact-anvil`（杰斯） | 1-2 每席一个神器锻造器 |

PR5 另启用发条猴子，其余8项效果保持关闭（none 仍启用且无附加规则）；16项抽选顺序、权重合计10000及所有原始 null 不变。未强制强化节点现按本文 v22 组合表派生；以下其余 PR2 语义保持。四种强化只覆盖正常三节点，初抽、逐槽换牌、本人按钮和恢复重演共用 `resolveAugmentTier`。候选仍使用各席既有 `choiceRngState`，初抽3词、换牌1词；不额外消费这个流。排除已持有、永久移除和换牌时当前候选；这六项调研中的强化禁用引用均为空，不编造新增互斥组，也不启用魔像/沃里克的关闭效果。初抽少于3项、换牌没有候选均失败，不降档、不跨档、不重置排除记录。

PR2 新增随机子流仅为 `opening-encounter-v1/seat/<seatId>/anvil/<index>`：单人 seatId=`solo`，联机为真实 seatId；index从0起。根 seed 单人取 `state.seed`，共享取已绑定 `state.augmentTierSeed=pool.seed`。对完整流名做 UTF-16 FNV-1a32，seed XOR hash 后 uint32，lcg32-v1 连取4词；对排序后的现有 G24 组件/神器池执行前4步 Fisher–Yates，`j=i+word%(pool.length-i)`。每个锻造器内4项不同，锻造器之间及与已持有装备不互斥；独立抽样不保证不同锻造器结果绝不重复。不读写商店、强化候选、奖励、PvE掉落、装备、战斗或选秀 RNG。PR2 没有新增 shared 或 display 随机流；PR5 的共享分支流与个人组件流见上节。未来第二个锻造器的候选不投影。

生命周期与凭据：

- `createMatch` 在首次准备返回前应用；`initializeSharedSeat` 在原始开局准入、多人绑定完成后立即应用，正常/选秀开局相同，八席/机器人相同数量。shared-deferred 状态不授予；共享调用方不需要再次发奖。
- PR2 奇遇的 `planOpeningRound(context,'1-2')` 返回固定事实列表，其他合法目录轮次返回空列表；猴子另在3-5返回事实。PR2 没有可变全局随机结果，返回的 context 原引用及其 facts=[] 保持不变；重复规划结果相同。
- 强化策略有一个 `effectKey='augment-policy'` 的激活收据；组件分别是 `anvil/0`、`anvil/1`，神器是 `anvil/0`；nodeId均为1-2。它们是独立 `openingEncounter.receipts`，不是 PvE loot.receipts，也不放进 G23 奖励箱。
- 实例标记为对 `opening-instance/<rootSeed>` 做 FNV-1a32 后的8位小写hex（非身份凭证）；`factId=JSON(['opening-effect',configVersion,instanceTag,encounterId,effectKey,'1-2'])`，`receiptId=JSON(['opening-receipt',factId,seatId])`。收据字段形状仍是 `{receiptId,factId,seatId,nodeId}`；原始seed/RNG不进入投影或选择ID。
- 每个新收据发 `MatchEvent {type:'openingEffectApplied',receipt}`，普通 match 事件序号递增；首个锻造器另发既有 `choiceOpened`。`applyOpeningEffects` 返回事件已盖章；initializeSharedSeat原样返回，调用者不可重复盖章。
- 锻造器选择 `choiceId=receiptId`、`kind='forge'`、`payload.source='opening-encounter'`、`timeoutOption=offers[0]`，复用既有 `selectChoice` / shared `choose`。物品授予用现有永久物品执行器、mechanic来源资源账本和 `seatMechanics.receipts`；后者记录真实选择、itemId、timedOut。前一选择完成后再开后一选择，优先于其他机制锻造器，不覆盖 pendingChoice。
- 超时复用 `forfeitPendingChoice` / shared `timeoutChoice`，一次只处理当前选择，默认第一候选；若新选择仍存在，服务端须继续按新choiceId处理。旧choiceId/代次重试原子失败；重复apply返回原state引用、events=[]。
- 恢复重推绑定、精确效果收据、4候选、选择顺序、默认超时结果及物品来源；不补抽、不补发、不迁移。单人走既有完整资源历史认证；共享快照走 `restoreSharedOrbSnapshot(pool,input)`，另重演强化档位/候选历史。原始context不能替代pool权威或向客户端透传。

公共接口（纯函数，无新网络命令）：

```ts
// match.ts 新增重导出；deriveAugmentTier 基础算法现见本文 v22 组合表
resolveAugmentTier(state: Pick<MatchState,'openingEncounter'|'augmentTierSeed'>,
  choiceId: string): 'silver'|'gold'|'prismatic'
readOpeningForgeProgress(state: MatchState): null | {
  source: 'opening-encounter'; effectsApplied: number;
  forgesGranted: number; forgesResolved: number; forgesPending: number;
}
// opening-encounter.ts 新增模块导出（领域内部与测试使用）
openingEncounterId(state: Pick<MatchState,'openingEncounter'>): OpeningEncounterId | null
pendingOpeningForges(state: MatchState): readonly OpeningEffectReceipt[]
openingForgeOffers(state: MatchState, receiptId: string): readonly string[]
openOpeningForge(state: MatchState): {state: MatchState; events: readonly MatchEvent[]}
validateOpeningForges(state: MatchState): void
```

`planOpeningRound`、`applyOpeningEffects`、`validateOpeningEncounterState` 签名不变；`readOpeningEncounterView` 的可选共享上下文见 PR5 节。对 PR2 奇遇，`apply` 的 facts 只接受空列表或与所选1-2事实完全相同的列表；有尚未应用的效果时必须在首次1-2准备入口提供完整列表。成功首次应用为新state与事件，完整已应用时为原state与空事件；无效输入返回原state和reason，无events、资源/RNG消耗。`openOpeningForge` 是未盖章内部队列钩子，不是服务器授予命令。`openingForgeOffers` 是私有恢复/规则工具，不可用来提前展示后续候选。新helper没有扩展 `src/server-entry`；本PR权限不含该目录，PR8按需重导出；现有网络流程用已导出的命令和本人投影即可。

| 失败枚举 | PR2 含义 |
| --- | --- |
| `opening-config-incomplete` | 配置身份错误或锻造器池不足4项（内容缺证不能替代为部分候选） |
| `opening-context-mismatch` | 根seed/选择/绑定/激活收据/选择来源及恢复历史不一致 |
| `invalid-opening-effect` | 非目录节点、伪事实/receiptId、缺少完整事实、错误授予阶段 |
| `augment-pool-too-small` | nextRound初抽不足3项或rerollAugment过滤后空池，原state且无events |
| `stale-choice` / `invalid-choice` / `wrong-phase` | 沿用旧选择ID或代次、非法选项、阶段错误；超时也沿用stale-round等既有枚举 |
| `invalid-pool` / `invalid-seat-state` | 共享池绑定或席位恢复不一致，沿用外层失败；具体校验工具仍可能抛已有RangeError/Error |

`OpeningEncounterFailure` 没有新增成员；不引入“重复领取失败”，正常重复生命周期是成功空操作。公共 openingEncounter 字段形状不变，新增启用项 `effectStatus='active'`、`statusTextZh='本局奇遇效果已启用'`。本人 `toPrivateSeatView` 按需新增 `openingForgeProgress`（仅组件/神器锻造器有授予收据时存在），不公开其他席候选、收据或进度；`pendingChoice` 和 `seatMechanics.receipts` 继续承载本人选择/已完成结果。UI字段及接线验收见 UI_REQUESTS 的 PR2 节。

## 开局奇遇 PR4：魔像训练师关闭接口（2026-10-22）

此节补充 PR1 与上方 PR2；关闭约束仅针对魔像训练师，不影响 PR2 已启用的六项效果。安蓓萨 `trainer-golems` 仍为 **enabled=false**、`readiness=blocked-evidence`，保留400 Bps（4%）抽选资格；本 PR 没有新增可运行奇遇。依据只读调研 `encounters[9]`（D01–D03、14.24 排除金色炊具说明）和批准方案 §§3、4、6、9：可确认每席1只魔像、3个永久纹章；各席独立、三个不同、首轮1-2授予是批准项目约定。完整纹章池、魔像定义/属性/成长、人口以及出生/移动规则缺证，不能借用亡灵战神、锻炉、虚空生物或野怪魔像的参数。

新增公共导出位于 `src/simulation/trainer-golems.ts`，由 `src/simulation/match.ts` 重导出；**本 PR 未修改 server-entry 或网络接口**。PR8 如需使用，由边界维护方添加重导出。既有 PR1 的 `planOpeningRound/applyOpeningEffects/readOpeningEncounterView` 继续直接可用。

```ts
TRAINER_GOLEMS_POLICY // 冻结的只读内容元数据；不是运行态、授予事实或 UnitDefinition
// version='trainer-golems-blocked-v1', encounterId='trainer-golems', enabled=false
// golemsPerSeat=1, emblemsPerGolem=3, permanentEmblems=true
// grantRound='1-2', samplingScope='seat', distinctEmblems=true（批准约定）
// emblemPool/unitDefinitionId/statsAndGrowth/countsTowardPopulation/placementAndMovement=null
// missingEvidence: 纹章池、属性成长、人口、出生与移动四个缺口键
// emblemStream: 仅预留名称；effectKey='trainer-golems'
type TrainerGolemEmblems = readonly [string, string, string]
validateTrainerGolemEmblems(input: unknown): TrainerGolemEmblems
applyTrainerGolemsOpening(state: MatchState, shared?: OpeningEncounterContext): MatchCommandResult
```

`validateTrainerGolemEmblems` 仅校验恰好三个字符串、均为 `EMBLEM_ITEMS` 自有定义、物品ID和 `emblemTrait` 各不相同，返回冻结且脱离输入的三元组。拒绝重复、空洞、非纹章、原型属性及未知ID。**通过不代表来自真实奇遇池，也不认证采样、永久附着或授予来源**；不得据此发装备、额外羁绊或生成魔像。现有纹章包含 `approved-provisional` 项目数值，不能视为完整原版池。

`applyTrainerGolemsOpening` 是显式授予准入接口：先验证当前上下文/席位绑定，再检查选中ID，最后因核心参数与执行器未就绪拒绝；没有接受外部配置/候选/收据的通道。选中魔像训练师时，正常生命周期仍使用 `applyOpeningEffects(state, [])` 成功返回原state和空events；不要在开局路径调用该显式失败接口阻断对局。

| 失败原因（沿用枚举，不增加协议项） | 条件与行为 |
| --- | --- |
| `opening-context-mismatch` | 显式授予时上下文/收据不合法、shared-deferred未绑定、缺少或传错共享上下文；返回失败 |
| `invalid-opening-effect` | 显式授予时选中的不是trainer-golems；或三元组校验失败（校验抛OpeningEncounterError）；魔像训练师上下文的通用apply拒绝所有非空facts；PR2合法效果按上方合同接受 |
| `opening-config-incomplete` | 显式授予遇到有效trainer-golems上下文仍拒绝；或通用配置校验收到启用标志、补造参数等非当前完整配置 |

所有失败保持原state引用、无events，不扣工具、不推进任何RNG、不产生事实或成功收据。反复调用与恢复后调用同样拒绝，不用“已领取”假收据冒充幂等。`opening-effect-already-applied` 本 PR 未新增。共享快照伪造仍沿用 `invalid-pool/invalid-seat-state`；离线伪造奇遇仍报 `Invalid Match save: opening-context-mismatch`。普通准备/战斗恢复继续执行既有单位定义校验与策略重编译，关闭状态不接收魔像注入。

预留 `opening-encounter-v1/seat/<seatId>/trainer-golems/emblems`，**未创建、未抽取子流，无新增随机消耗**；采样池和算法需补证/冻结后实现。未来真实效果必须独立收据（包含奇遇实例、effectKey、seatId、节点），与资源来源原子提交；魔像训练师的 facts/receipts 仍为空；PR2 激活/锻造器收据按上方合同保留。

尚未实现：真实魔像三纹章羁绊、人口/移动、禁售与永久装备防拆卸/重铸/复制/额外装备、强化初抽/换牌禁用以及带魔像的恢复重编译。现有召唤物 `sellable/countsTowardPopulation`、纹章成员投影可复用，但拆卸/重铸不会自动识别永久纹章，不能直接挂三个普通ItemInstance。关闭状态不局部过滤金色炊具/Portal引用（其中有效映射有 `built-different`），也不新增历史强化。

魔像训练师的公共视图沿用PR1全部字段，没有新增seed、候选或工具字段；必须同时展示 `encounterId/nameZh/champion` 与 `enabled=false/readiness/statusTextZh`，`revealedFacts=[]`，不得将说明当作已授予。界面不生成占人口的假魔像。配置身份更新为 `opening-encounters-14.24b-pr2-pr4-pr5-pr6-v1`，`OPENING_ENCOUNTER_CONFIG.trainerGolems` 和四个缺口纳入既有manifest及双digest。沿用未发布v21 rules/content、schema/save=12/8、replay/command=6/6（PR5 工具两步选择）；PR4 本身未增加持久化结构/命令，不录epoch，不修改旧golden。PR4 独立交付摘要及验证结果见 [PR4报告](OPENING_ENCOUNTERS_PR4_REPORT.md)；合并身份与当前摘要以上方集成说明为准。

## 开局奇遇 PR1：规则框架（2026-10-22，开发身份，尚未录制 epoch）

用户批准方案及唯一只读调研源：`/home/aiapps/workspace/s13-ui-atlas/encounters/开局奇遇实现方案.md` §§2–6、9，及同目录 `tft_s13_opening_encounters_14.24b.json/.md`。未联网。此节覆盖下文旧正式身份的当前开发态描述；不宣称已发布。

- 16 项顺序与权重固定合计 10000 Bps；`enabled` **仅控制效果，不控制抽选资格**。“没有奇遇”1000 Bps 为显式结果且 enabled=true；其余15项 enabled=false、effectStatus=not-implemented。关闭项保留选中 ID/角色/原文说明并公开“效果尚未启用”，不改成 none、不重抽、不重归一化。
- `content/opening-encounters.ts` 的 `sourcePath` 指向研究 JSON 对象；`researchParameters` 保留原始 null。`readiness` 区分后续可实现与缺证阻塞；`projectConventions` 是用户批准的工程约定，不能冒充官方参数。历史强化禁用引用只留证据，不扩大强化池。梅尔冠冕分支3→2单列 B 补丁覆盖，不拼造奖池。
- 开局流 `opening-encounter-v1/select`：UTF-16 FNV-1a32（offset=0x811c9dc5，prime=0x01000193），`initial=(matchSeed XOR hash)>>>0`；当前 v23 用 Murmur3 fmix32 混合该 initial：`x=imul(x^(x>>>16),0x85ebca6b)>>>0`，再 `x=imul(x^(x>>>13),0xc2b2ae35)>>>0`，最后 `word=(x^(x>>>16))>>>0`（覆盖旧 PR1 的单步 lcg32-v1 描述，不推进其他 LCG 流）。`selectionRng={state:word,draws:1}`，`floor(word*10000/4294967296)` 按表顺序累计区间。商店、掉落、战斗、强化、选秀、开局弈子流不参与。预留 `opening-encounter-v1/shared/<effectKey>`、`opening-encounter-v1/seat/<seatId>/<effectKey>`、`opening-encounter-v1/display`，PR1 不生成它们。

状态与恢复：

```ts
// 必填 MatchState.openingEncounter
{ mode: 'solo', context: OpeningEncounterContext, receipts: OpeningEffectReceipt[] }
| { mode: 'shared-deferred' }
| { mode: 'shared', poolId: string, seatId: string,
    selection: OpeningEncounterSelection, receipts: OpeningEffectReceipt[] }
// SharedPoolState.openingEncounter 为多人全局唯一权威（PR1 复用已有根 seed 的领域容器）
OpeningEncounterContext = {
  selection: { configVersion: 'opening-encounters-14.24b-batch-a-v2', encounterId: OpeningEncounterId },
  seed: uint32, selectionRng: { state: uint32, draws: 1 }, facts: OpeningEffectFact[]
}
OpeningEffectFact = { factId: string, effectKey: string, nodeId: string }
OpeningEffectReceipt = { receiptId: string, factId: string, seatId: string, nodeId: string }
```

`createMatch(seed)` 在首次准备前选定；`createMatch(seed,{mode:'shared-deferred'})` / `createCarouselMatch(seed)` 不按席位 seed 抽选。`createSharedPool(poolId,rootSeed)` 建立全局上下文；`initializeSharedSeat` 通过原始开局准入后绑定，再由已有共享准备流程推进。八席（含机器人）只有 selection、poolId/seatId 与应用收据，不复制全局 RNG。此 PR 不改 `RoomState`：PR8 可从已有 `room.pool.openingEncounter` 读取，不应另造第二份可变权威。

PR1 facts/receipts 必须为空；关闭效果不会伪造“已触发”收据或事件。后续收据须含实例/效果节点/席位，订阅追加阶段、击杀追加 battleId/事件序号；在有真实执行器与历史认证前，不接受任何非空记录。

单人 `serializeMatch`/`restoreMatch` 包含完整上下文，按 match.seed 重推选择与一次 RNG 轨迹并严格比较全部字段；验证不写回、不补抽。联机 `assertSharedPoolConservation` 校验 root seed/全局上下文/席位绑定；`restoreSharedOrbSnapshot` 依赖同一权威 pool。旧身份、缺字段、篡改 ID/RNG/收据一律拒绝，不迁移成 none。网络重连使用既有内存状态；不增加进程恢复或数据库。

公共导出（`src/simulation/opening-encounter.ts`，下列接口及类型也由 `src/simulation/match.ts`、既有公共边界 `src/server-entry/index.ts` 导出）：

```ts
createOpeningEncounter(seed: number, config?: unknown): OpeningEncounterContext
validateOpeningEncounterConfig(config: unknown): void
validateOpeningEncounterContext(input: unknown, seed: number): void
validateOpeningEncounterState(state: MatchState, shared?: OpeningEncounterContext): void
planOpeningRound(shared: OpeningEncounterContext, roundId: string): {
  readonly context: OpeningEncounterContext; readonly facts: readonly OpeningEffectFact[]
}
applyOpeningEffects(state: MatchState, facts: readonly OpeningEffectFact[],
  shared?: OpeningEncounterContext): MatchCommandResult
readOpeningEncounterView(state: Pick<MatchState,'openingEncounter'>): OpeningEncounterView
```

`config` 是完整配置身份断言，只接受本版本默认表或内容完全相同的副本，不是热启用开关；不能靠传参开启缺证或未实现规则。`planOpeningRound` 只接收真实目录节点（无1-1），返回原 context 引用与空 facts。`applyOpeningEffects` 验证后返回原 state 引用与空 events；重入相同。未来才增加授予 policy 参数/执行器/历史重演；PR1 不预装虚假奖励逻辑。

| 失败 | 触发条件/返回 |
| --- | --- |
| `opening-config-incomplete` | 非当前完整配置（缺行、换顺序、改权重/版本/enabled）；纯构造/校验抛 `OpeningEncounterError`，含 `reason` |
| `opening-context-mismatch` | seed/选择/版本/RNG/全局绑定/收据不一致或缺失；校验抛同类错误，apply 返回失败 |
| `invalid-opening-effect` | plan 的轮次不存在；或 apply 收到任何非空 facts；前者抛同类错误，后者返回失败 |
| `RangeError` | create/select 的输入不是 uint32 seed/word；已有 RNG 输入惯例 |
| `invalid-pool` / `invalid-seat-state` | 共享池入口沿用原有失败枚举：全局上下文损坏 / 席位绑定损坏 |
| `Invalid Match save: opening-context-mismatch` | 离线恢复奇遇认证失败；旧版本更早以 `unsupported-version` 拒绝 |

apply 失败保持原 state 引用，无 events、不消费 RNG/资源；共享事务失败同时保持原 pool/state。`opening-effect-already-applied` 暂未引入：PR1 无可应用效果，重复空调用成功且无副作用；PR2–7 真正引入收据时再冻结重复语义。既有 choice 的 stale-choice/invalid-choice 不变。

公开查询是逐字段白名单：`configVersion, encounterId`（稳定规则 ID）、`sourceEncounterId`（研究 Encounter ID）、`portalId, champion:{name_zh,name_en}|null, nameZh, nameEn, enabled, effectStatus, readiness, descriptionZh, statusTextZh, revealedFacts`。`descriptionZh` 为原始效果说明，必须结合 enabled/statusTextZh 展示。PR1 revealedFacts=[]，shared-deferred 返回 null。`toPrivateSeatView(state).openingEncounter` 使用完全相同投影；不输出 seed、selectionRng、未来事实、收据/个人选择。后续个人进度另加本人字段。

`src/server-entry/index.ts` 仅追加上述领域接口重导出；Room/网络消息/客户端未改，PR8 须将 `readOpeningEncounterView` 结果逐字段接入公共 PlayerView，不能把原始 Match/SharedPool 上下文传给客户端。当前交付的是可直接调用的领域公共投影，尚未接通服务器传输。

开发版本：rules/content=`s13-g2-3-v21-opening-encounters` / `s13-14.24b-g2-3-v21-opening-encounters`，schema/save=12/8。PR1 无新命令、选择工具或回放操作，replay/command 暂为5/5；方案建议6/6留待出现相关语义时切换。NET 与规则侧多人协议常量不改；发布联动在PR8/9。完整表、证据缺口、批准约定、B覆盖、命名空间和触发次序均进入 rules manifest 与双 digest。**已合入 multiplayer `9d9ea671`，父 epoch 为已录制的 v20-black-market；候选仍未录制，历史 fixtures/golden 保留原字节，由 PR9 统一录制。**


## v20-black-market 当前正式 epoch（2026-10-22）

父 epoch `v20-live-combat`，基线 `42d8a404`。rules/content=`s13-g2-3-v20-black-market` / `s13-14.24b-g2-3-v20-black-market`，CONTENT=`fnv1a32-utf16:9a83da50`、LOOT_REPLAY=`fnv1a32-utf16:e0eb43e2`；schema/save/replay/command **11/7/5/5**、NET6 不变，旧身份严格拒绝、无迁移。
黑市从至多三包改为**一个完整奖励包**，沿用源权重的一次加权抽样（原首候选，每 offer 一词）；接受整包、保留及超时 `@skip`，其余规则不变。命令/投影形状、签名及失败枚举不变。依据、RNG影响、唯一收据、恢复边界和 Claude 交接见 [BLACK_MARKET_SINGLE_OFFER](BLACK_MARKET_SINGLE_OFFER.md)。本节优先于下文历史身份和 N=3 描述。

## v20-live-combat（历史 epoch，2026-10-22）

父 epoch 为 `v20-xp68`，集成基线 `db04d196e4a12933624add7d61be9081a639607f`（#384、#385、#386、#388）。rules/content 为 `s13-g2-3-v20-live-combat` / `s13-14.24b-g2-3-v20-live-combat`；CONTENT `fnv1a32-utf16:93fad04c`，LOOT_REPLAY `fnv1a32-utf16:49eb9cf0`。
schema/save/replay/command 为 **11/7/5/5**，网络 **NET6**、规则侧多人契约5。继承黑市候选及决策字段，Match 与 SaveEnvelope 结构不再增加，schema/save 保持父版11/7；replay/command 从4/4升5/5，标识实时战斗流及逐 tick 输入边界。所有旧 rules/content/digest/replay/command 身份严格拒绝运行态恢复，无迁移；历史 epoch 原字节保留。
完整保留8→9 / 9→10各68 XP、梅尔救命精确HP核对、B 补丁16具名字段、标准 PvE 不增微光、黑市至多三包 N 选一与保留、迅击/野火/搭档及 #381 预热。流式首遍只改变推进与传输，逐字节对照旧整轮结算；双游标、绝对50ms排拍、客户端四拍缓冲、整拍合并推送、战中买卖利息及空输入挂点见 [LIVE_COMBAT_PHASE1](LIVE_COMBAT_PHASE1.md)。非空逐 tick 装备输入仍报 `battle-input-unsupported`，未安装、不记成功日志。
独立录制与只读核验命令、来源及风险见 [RELEASE_NOTES](evidence/v20-live-combat/RELEASE_NOTES.md)。本节覆盖下文历史身份。

## v20-xp68 继承升级经验（2026-10-22，项目自定）

按用户 10-22 要求，8→9 从 76 改为 68 XP，9→10 从 84 改为 68 XP；原版来源与项目适配标注见 [XP68](XP68.md)。父 epoch 为 v20-chem-baron（`2de5e26d`），rules/content 为 `s13-g2-3-v20-xp68` / `s13-14.24b-g2-3-v20-xp68`，schema/save/replay/command 保持 11/7/4/4，旧身份拒绝、无迁移。CONTENT `fnv1a32-utf16:3512a559`，LOOT_REPLAY `fnv1a32-utf16:d18f985e`。

| 当前等级 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 到下一级 XP（非累计） | 2 | 2 | 6 | 10 | 20 | 36 | 48 | **68** | **68** | null（满级） |

买经验仍为 4 金/4 XP，自然经验、溢出处理、最高 10 级及商店概率不变。`getXpToNextLevel` 返回本级阈值，非满级的“距离下一级”为阈值减当前 XP；10 级返回 null，界面沿现有满级禁用逻辑。`buyXp` 失败顺序仍为 wrong-phase → max-level → insufficient-gold，失败原 state、零事件、不耗资源或 RNG。progression policy 为 `project-xp68-user-2026-10-22-v1`。本节经验表继续生效；当前身份以顶部 v20-live-combat 为准。黑市及其他玩法完整继承父版，公共签名和失败枚举不变。

## v20-traits 继承规则覆盖（2026-10-21）

父 epoch 规则/内容为 `s13-g2-3-v20-traits` / `s13-14.24b-g2-3-v20-traits`，schema/save/replay/command＝10/6/4/4；当前身份以下文 v20-chem-baron 为准。迅击、野火与五组强化关系按用户批准**魔改**；野火350%攻速标**工程取值**，14.24b原归档不改。导出签名、输入输出、失败/跳过语义、强化赠卡唯一收据与恢复边界见 [V20_TRAITS](V20_TRAITS.md)，覆盖下文旧关系延期与v19当前身份描述。无新Match公共命令或失败reason；旧身份严格拒绝，事件枚举与网络协议不变。

# M5 Match contract v5

## v20-chem-baron 继承炼金男爵规则（2026-10-21）

本 epoch 的父版本为 v20-traits（multiplayer `ce60a8b9`），完整保留迅击、野火、五组搭档、共用移动禁止判定、66 强化及 v19 账本。本节覆盖下文历史版本/黑市单候选/每 offer 一词及标准 PvE 微光描述。规则/内容为 `s13-g2-3-v20-chem-baron` / `s13-14.24b-g2-3-v20-chem-baron`；CONTENT `fnv1a32-utf16:2d1eafb8`，LOOT_REPLAY `fnv1a32-utf16:7fd08770`；schema/save/replay/command 为 11/7/4/4（父 10/6/4/4；新增存档候选与领取决策字段，各升 schema/save 一版），旧身份拒绝、无迁移。独立 epoch、来源、导出签名与失败语义见 [CHEM_BARON_FIX](CHEM_BARON_FIX.md)，保持项见 [S13_RULES_GAP](S13_RULES_GAP.md)。

12/17 B 公告 15 条（16 具名字段）在规则内容层采纳覆盖，raw/archive mirror 不变。标准模式只在玩家对战后获取微光，野怪不增加且不触发新 offer。黑市 N=3 为项目自定（用户要求多选一），按该档源权重无放回抽取，不足三包时全部列出，每候选一词 lcg32-v1。`choiceId/generation/options` 投影与 choose 命令不变，optionId 为完整奖励包 apiName；只发选中包，`@skip`/超时即“保留”，本轮不领且微光不清空。既有跨档/领取清空/跳过生命规则保持。

## v19 第二部分（继承合同，2026-10-21）

同一v19包含家人5随机任务法球、13.4六人彩蛋回移、六费 warwick / viktor / mel 与22种纹章总基础属性替换。schema/save/replay/command＝**9/5/4/4**；旧身份拒绝，无迁移，50ms和lcg32-v1不变。数值、魔改/未验证清单、导出签名、RNG、失败/恢复、说明底部显示字段及表现层交接以 [V19_PART2](V19_PART2.md) 为准；下文旧“家人预留/六费延期/纹章未改/8-4-3”描述已被本节覆盖。


## v19 规则与数据合同（历史身份）（2026-10-21）

当前 rules/content 为 `s13-g2-3-v19` / `s13-14.24b-g2-3-v19`，CONTENT=`fnv1a32-utf16:242e7562`、LOOT_REPLAY=`fnv1a32-utf16:df0d757c`；schema/save/replay/command 为9/5/4/4。旧身份拒绝，无迁移。该 epoch 的录制入口为 `scripts/verify-v19-epoch.cjs` 与 `record-v19-*.cjs`；当前入口与 CURRENT Herald 已推进至 v20-chem-baron，v19 及更早保持历史字节。

实际耗蓝统领、完整生命盖伦、双形、强化/伙伴门槛的姐妹、蓝发10循环、黑玫伤害标记、链锯刃唯一收益及全部明确约定见 [V19_MECHANICS](V19_MECHANICS.md)。姐妹内部强化ID=`sisters`，归档API=`TFT13_TeamupAugment_Sisters`；当前61强化/30羁绊。公开命令签名、失败枚举和失败原state/零资源零RNG语义不变。

`g23Facts.itemGoldPayouts[].amount` 扩为 `1|3`；`perfected-chainblade` 必须为3，其他kind必须为1。服务器原样透传，不自行拆分或即时发金。真实结算按amount求和，通过既有唯一mechanic收据一次到账。单人相关新动态战斗从认证输入完整重演验证，不信任候选标记/采样/收据。

`seatMechanics.seat.familyHeist` 为本人显示投影，权威任务/RNG在hidden.progress.family；第二部分已接入随机任务、奖励法球和唯一收据，详见V19_PART2。赛薇卡投影合同见 [COMBAT_CONTRACT](COMBAT_CONTRACT.md) 和v19说明。

## v18 当前等级规则（2026-10-21，覆盖下文历史等级/身份）

S13 上限10级，9→10需要84XP；10级商店概率5/10/20/40/25，1–9级不变，不开放11级。progression policy 为 `s13-14.24b-ten-levels-v1`；rules/content 为 `s13-g2-3-v18` / `s13-14.24b-g2-3-v18`，schema/save/replay/command 保持8/4/3/4。与拆卸器、纹章/高档羁绊及炮手修正合并后的完整根为 CONTENT `fnv1a32-utf16:213ae9e4`、LOOT `fnv1a32-utf16:ffebff3f`；旧版本/摘要拒绝，无迁移。机器人、满级购买、输入/存档校验均使用权威 maxLevel；数值来源、测试、录制和界面交接见 [v18 RELEASE_NOTES](evidence/v18/RELEASE_NOTES.md)。

v18 使用独立 `scripts/verify-v18-epoch.cjs`、`record-v18-*.cjs` 与 `docs/evidence/v18/`、`tests/fixtures/v18-*`；CURRENT Herald 指向 `record-v18-herald.cjs`。v17 及更早证据保持历史字节，不作为当前规则录制目录。

## v18 PvE 固定装备拆卸器（与 10 级同版）

每个按仓库目录判定为 PvE 的回合，在本回合法球之外，给每个结算后仍存活的玩家固定 1 个装备拆卸器，不检查原有数量，不要求胜利或击杀载体。来源：**原版 14.23 起的规则（本任务用户确认）**。当前为 1-2、1-3、1-4、2-7、3-7、4-7、5-7、6-7；之后只有 PvP 加时。箱子/法球表中的原拆卸器行、权重、顺序及显式 lcg32-v1 随机流不变。

| 原版规则值 | 值 | 来源 |
| --- | --- | --- |
| 每个 PvE 额外拆卸器 | 每存活玩家 1 个，无持有数量门槛 | 原版 14.23 起 |

| 项目约定值 | 约定 |
| --- | --- |
| 发放时点/存活 | PvE 原子结算后 hpAfter > 0；淘汰席不发；单人 6-7 存活终局仍发 |
| 唯一收据 | seatMechanics.receipts；source=pve-remover；receiptId=pve-remover:<roundId>，独立于法球领取收据 |
| 库存/事件 | 每份独立 consumableId，沿用 mechanicGranted；随结算提交，不消费 RNG；重复 step、Continue、恢复不重发 |

内部 `grantPveRemover(state: MatchState): MatchState` 只授予当前已结算 PvE；不适用或收据已存在则返回原对象。`validatePveRemover(state: MatchState): void` 从已结算回合和 hpAfter 重建应有收据，缺失、重复、错误来源/轮次/类型抛 `RangeError('Invalid PvE remover receipt')`。恢复只验证，不发奖励。公开 Match/服务器命令签名和失败枚举不变，失败保持原 state，不产生事件。

规则层没有消耗品格位/容量限制：`ConsumableInstance`（`src/simulation/consumable-types.ts`）只有 consumableId/definitionId；`consumables.ts` 校验每份 ID 与唯一收据。界面建议按 definitionId 聚合显示数量，使用时提交组内一个真实 consumableId；不改变领域库存结构。

## v17 当前身份（2026-10-20，草稿，覆盖下文历史交接状态）

#265 生成流程保持：`CONTENT_DIGEST` 与 `LOOT_REPLAY_DIGEST` 由 `content/identity-constants.ts` 导出同一份生成常量，浏览器、开发与服务器共用。完整根表达式保存在 `scripts/content-digest.ts` / `scripts/loot-replay-digest.ts`，四张归档表的说明来源列仍参与完整内容根。执行 `node scripts/update-content-identities.cjs --write` 后 `--check`；CI fast 从完整表重算核对。v17 法球组合本次 CONTENT 从 `fnv1a32-utf16:8a955c10` 变为 `fnv1a32-utf16:05439fc4`，LOOT 从 `fnv1a32-utf16:62c76cb9` 变为 `fnv1a32-utf16:132ae758`，规则 manifest 随阶段/RNG 政策更新。

当前 rules/content 为 `s13-g2-3-v17` / `s13-14.24b-g2-3-v17`；schema/save/replay/command 为 **8/4/3/4**（schema 7→8、save 3→4），领域NET4、服务器网络NET5、法球合同 multiplayer-orb-claim-v2、lcg32-v1、50ms保持。旧v15/v16及改前v17存档身份/摘要严格拒绝，无静默迁移；发版须排空当前对局。PR保持草稿，等v16发版收口后才合入。法球规则与迁移说明见 [V17_ORB_COMBO](V17_ORB_COMBO.md)，贪财化身见 [V17_AVARICE_ONLINE](V17_AVARICE_ONLINE.md)，v16历史见 [EPIC_LOOT_V16](EPIC_LOOT_V16.md)。

### v17 法球、独立随机流及存档

第 1–4 阶段用 14.24b 阶段 Base/High 表一次派生整局组合，11–15 组件、20–79 价值点，最多 64 次拒绝后使用四个 Base 第一行（12 组件、30 点）；第 1 阶段按组件→灰→蓝轮流分给 1-2/1-3/1-4，其余落在 x-7，轮内按各色顺序轮流挂载 slotId 代码点排序的中立槽位。仅被击杀载体揭示。组件为独立 blue 珠，templateId=component；其他颜色按阶段选铜/铜Plus、银/银Plus、金/金Plus、UltraPlus 箱。前四阶段复制器只来自箱子行，删除 v16 追加流。未实现奖励只删对应原子，同行余项与权重不变。

`sampleOrbStagePlan(seed:number):OrbStagePlan` 是 `simulation/orb-stage-plan` / `orb-layout` 的纯函数导出：返回 stages、highStages、attempts、fallback、rng；非法 uint32 seed 抛 RangeError，不是客户端接口。现有 create/freeze/restore 的函数参数与失败枚举不变，`OrbLayoutLedger` / shared binding 版本改 `s13-orb-layout-v2`；冻结 ledger 改 `s13-orb-freeze-v17`。计划在可信领域临时计算，账本仅展开已进入轮次；未来数量、颜色和高额阶段不写入视图、公开摘要或任何 ledger。

组合流为 FNV1a32_UTF16(JSON(['orb-stage-plan-v17',layoutSeed]))：先 k(1000)、再字典序 C(4,k) 子集（k=0/4 不抽），再 1..4 行权重；拒绝整局时续用同一局部游标。每珠流 FNV1a32_UTF16(JSON(['orb-box-v17',seatSeed,orbId]))：先箱子行(100)，再行内英雄；组件珠只抽八组件索引。两者均 lcg32-v1 拒绝取模、拒绝词计数。旧 layout 游标保持初态/0；旧 loot 流只供 5-7/6-7，前四阶段不推进，史诗抽取顺序不变。商店、重铸、装备、战斗流不参与组合/开箱；领取和失败命令不重抽。

新增 `TFT_ArmoryKeyComponent` 基础装备锻造器，八普通组件按 id 排序、四选一，沿现有 G24 派生流与唯一收据。箱子英雄覆盖费用完整商店池，可出 5 费；不出 6 费。金箱的 2 星 3 费用既有 starLevel=2，入库需完整 3 份卡池；不足份数按当前基础费用补金，满席按 2 星卖价补金。领取、排队、跨轮保留、补给和史诗算法沿用现行公共命令。具体箱子行顺序、数值来源等级与测试见 [M8B_LOOT §12](M8B_LOOT.md#12-v17-前四阶段每局随机组合)。

v17恢复贪财化身联机准入：`anomalyCandidates(multiplayer:boolean):string[]` 两模式均返回56项（联机55→56），强化仍60；按备战席/普通场上/可晋升场上目标过滤后均54/55/56。初次 `selectAnomalyTarget` 与 `rerollAnomaly` 共用该入口，权重、签名及失败枚举不变；重选目标保留已有候选且不消耗RNG。候选政策进入CONTENT根。#254/#258已接通权威实时银行，获取+5金走唯一收据。`BattleTask.sampleBankGold(seatId:string,liveGold:number):boolean` 在规则游标t之后、t+1执行前注入；相同有效银行、未绑定、镜像B返回false。服务器显示前瞻8tick=0.4秒，不能承诺显示下一帧立即变伤害；末尾操作边界及6条服务器待补验收见v17说明。

新证据只写 docs/evidence/v17 与 tests/fixtures/v17-*，CURRENT Herald生成器指向v17；v15/v16证据与历史身份断言保留原字节。下文D11/v15/v16段落为历史交接记录，其旧身份、目录数与“服务器待接”不再表示当前状态。历史v15见 [V15_RELEASE](V15_RELEASE.md)。本草稿不修改服务器或表现层，不代表端到端上线验收完成。


## D11 领域接线，等待统一 v15（2026-10-20）

运行目录为 60 强化 / 54 异常；新增一费奉献 I（银）、三项赛 I（金）、灵魂连接（金）、贪财化身与猎头者。具体数值、开战 / 赠送 RNG 约定、恢复证据与版本清单见 [D11_WIRING_V15](D11_WIRING_V15.md)。D11 单支交付保留 v14；本次合并沿用法球分支既有 v15 身份，不再升级版本、改变 digest 或重录指纹。目录 digest 输入仍有显式临时 preD11 边界，后续统一身份与指纹验收必须移除，不能据此声称与旧 v14 存档等价或直接发布。

灵魂连接以开战玩家生命的完整十点缺失组计算治疗，每 100 tick 生效。一费奉献 / 三项赛的赠送经唯一 mechanic 收据：单机沿用满席托管，联机先产生奖励法球，再按下节法球合同领取（战斗排队、战后分配共享库存或折金）；不重发、不重抽、不消耗四条 Match 流。贪财化身获取 +5 金一次，伤害按实时金币取样；战斗收益只通过既有结算入账。猎头者当战击杀即时加攻速，永久成长以 g23Facts.d11Headhunter 的完整 kill eventSeq 事实结算，排除召唤物、野怪、助攻与友军。

单机 `serializeMatch(state,battles?)` / `restoreMatch(input,battles?)` 签名不变；历史含猎头者事实（即使零击杀）必须提供完整可信 battles 重放。当前异常战斗逐 tick 重算，礼物与 +5 金校验来源及唯一收据，不从保存的自报计数恢复。联机完整 Match 读档仍不支持。私有视图可选 d11Display 和公开战斗 replay 单位可选 choiceEffects 提供当前条目名称、说明与等级，无新图标路径，也不公开银行或未来候选。

双边任务 `sampleBankGold(seatId:string,liveGold:number):boolean`，私有 bankSamples 记录生效 tick，结果校验 / 回放重演同一经济输入。实际改变返回 true；相同有效银行、未绑定席位与镜像 B 返回 false。服务器仅可传权威 Match.gold。原 D11 交接时服务器先完整计算再播放，**战中买卖样本接线仍需服务器验收**；不能用开战冻结数替代完整实现。新增读取席位、逐 tick 帧、PvE 样本收据和隐私边界见 [LIVE_GOLD_EXPORTS](LIVE_GOLD_EXPORTS.md)，服务器配套见 [UI_REQUESTS](UI_REQUESTS.md)。

## 联机法球领取：v15（用户批准 2026-10-20 02:20）

只在 state.multiplayer 存在时替换自动发奖/满席托管。`claimOrb(state:MatchState,orbId:string,expectedRound:number,unitLootPolicy?:UnitLootPolicy):MultiplayerCommandResult`；共享席位经 `runSharedMatchCommand(pool,state,{type:'claimOrb',round,orbId})`，客户端不提供 policy。允许 preparation/combat/settlement/choice，判断集中在 ORB_CLAIM_PHASES/planOrbClaim。用户 2026-10-20 02:26 已定：combat 或 PvP combatRosterLocked 时接受领取并排队，其他允许阶段即时领取。expectedRound 是当前操作轮，法球来源 roundId 可为历史轮。

席位私有 `m8.loot.queuedOrbClaims?:readonly string[]` 按权威提交顺序保存 orbId（缺省为空），不存 payload 或回调；排队保持 direct=revealed，无领取事件/收据，不改备战席、金币、卡池库存、预留或任何 RNG。共享包装仅更新池/席位 revision 以提交新状态。重复排队沿用 already-claimed，原 state/pool 引用、无事件。私有 unclaimedOrbs 每颗增加 queued:boolean；公共仍仅 count/tiers，不暴露 queued 或队列。

确定性结算位置：PvE `withCombat`、PvP `applyRoundSettlement` 在本轮收入/利息、XP、HP、成长、G23 结算钩子及延迟升星完成后，打开任何战后选择之前，执行 `settleQueuedOrbClaims`。先判淘汰：淘汰者清空队列并由 forfeitUnclaimedOrbs 作废所有已赚未领条目（forfeited/gold=0，无扣池）；存活者逐颗 FIFO、颗内 entryOrdinal 执行同一 planOrbClaim/grantDirectLoot，按此时容量/库存合成、入库、满席折金或缺货补偿，产生同样的唯一收据。每颗之后 drain 原机制奖励并同步临时装备；新解锁法球不自动排队。队列与收据/池在同一事务提交，任一异常整体回滚；不会把领取金额计入本轮 interestBasis/goldAfter。

RNG：排队、出队、领取、折金、缺货与扣池本身各消耗 0 词，不重抽冻结 payload；仍保留原 G23/装备钩子规则。临时装备如需新 roll，按法球 FIFO、每颗后父装备 ID/roundId 代码点顺序，仅消费 equipment 流（两个 uniformIndex 抽取，含原拒绝采样），记录 equipmentRolled；战斗流和商店流不因领取改变。跨席竞争沿服务器原子结算提交顺序，无全局点击时间优先保证。JSON 快照/重连保留队列原序；validateMultiplayerOrbLedger 拒绝重复/未知/未赚/已领取队列项、非战斗生命周期和已结算/淘汰残留，恢复后只处理一次。完整签名与约定值见 [v15 交接](LOOT_ORB_CLAIM_V15.md)。

失败：multiplayer-required / seat-eliminated / stale-round / wrong-phase / unknown-orb / already-claimed / shared-pool-required / invalid-loot；包装另保留原卡池校验失败。失败原 state/pool 引用、无事件、资源、RNG 变化。成功按 entryOrdinal 一次领取完整法球；英雄完整星级走 planUnitAcquisition，满席按 getUnitSellPrice 自动出售（2 费 1/2/3 星 +2/+5/+17、1 费 2 星 +3），卡池份额视为未取出。有货且入库才扣 1/3/9 份；不足完整份数暂按整条一次费用折金，优先于容量出售，不叠加。

P2/征服者/黑市英雄先产生奖励法球；其 MechanicReceipt 为 resolution=orb，含 orbId/starLevel、unitId=null、gold=0；最终领取记 LootReceipt resolution=held/gold/capacity-sold/forfeited、gold、claimedRoundId，原 payload 保留星级。私有 LootView/PrivateSeatView 加 `unclaimedOrbs:{orbId,roundId,tier,entries:[{kind,definitionId?,quantity,starLevel?}],source:'pve'|'mechanic',queued:boolean}[]`，领取回执位于 claimReceipts / orbClaimReceipts；公共只给 count/tiers。claimLoot 截止不丢弃法球，nextRound 不阻塞；淘汰/终局作废一次，断线保留。bot 准备入口函数 claimBotPreparationOrbs 按 orbId 代码点顺序领取。单机、冻结表、售价公式及 5-7/6-7 不变。完整恢复边界、服务器协议 4 接线与约定值见 [实现交接](LOOT_ORB_CLAIM_V15.md)。

### 联机整局终局法球清理（#260 / #262）

`forfeitTerminalOrbs(state: MatchState): MatchStep` 从 `simulation/match` 和 `server-entry` 公共导出，返回 `{state, events}`，无失败枚举。这是服务器确认**整局终局**后对每席调用的可信领域钩子，不是客户端命令；房间终局不等于席位淘汰，因此不要求 `phase=gameOver` 或 `multiplayer.status=eliminated`，赢家及其他 active 存活席位同样要调用。调用者负责终局判定及提交返回的 state/事件，不能在普通轮次截止调用。

清空 queuedOrbClaims；将所有已揭示、已赚但未领的 PvE/机制法球条目一次性作废。每条按原法球/条目顺序写唯一 `LootReceipt`（resolution=forfeited、gold=0、claimedRoundId=当前轮、无获得英雄/物品），依次发 `lootForfeited`、`lootGranted`。事件统一走 Match 编号器：`domain='match'`，eventSeq 从输入 nextMatchEventSeq 连续递增，返回状态推进相同数量。不执行获取、选择或装备钩子，不扣共享池，不消耗资源或 RNG，不触碰已领及未赚的 planned 条目，不改变席位 phase/status。单机为空操作；重复调用（包括 JSON 快照恢复后）无新事件或收据，队列也为空时返回原 state 引用。原 `forfeitUnclaimedOrbs` 保留为内部未编号计划器；服务器终局应使用此新入口，不能重复编号。

## 强化等级与按卡刷新：待 v15 收口（用户确认 2026-10-20）

本节覆盖旧整组刷新与“精选混合池”描述。用户明确“三个海克斯下面各一个刷新”及“刷掉的海克斯永远刷不回来了”。每个槽位在本次选择各免费一次是本轮任务约定；旧实现/合同实际为整组共一次，没有既有按卡计次依据。不声称是已核实的原版 14.24b 行为。本轮不升版本、不改 digest、不重录指纹；与法球及 #231 接线统一升 v15，清单见 [交付说明](AUGMENT_CARD_REROLL_V15.md)。

- 日程保持 **2-1、3-2、4-2**；用户以 3-1/4-1 举例表达永久排除，不改选择轮次。每节点确定一次 silver/gold/prismatic，同次三张同级，联机同轮八席同级。不改强化数值、等级身份或等级权重。
- `deriveAugmentTier(seed, choiceId)` 不变：choiceId 按 UTF-16 code unit 算 FNV-1a32（初值 0x811c9dc5，乘数 0x01000193，逐步 uint32）；以 `(seed xor 0x61756774 xor nodeHash) >>> 0` 派生一个 lcg32-v1 字，`word % 3` 对应 `[silver,gold,prismatic]`。单人取 Match.seed，联机取 initializeSharedSeat 绑定的 SharedPoolState.seed。此私有派生不推进席位随机流。
- 初始发牌按节点等级过滤，排除已持有与 `removedAugmentIds`；ID 默认 `.sort()` 升序，以既有 generateChoices 的部分 Fisher–Yates 抽三项，固定消费 choiceRngState 三字。第 i 字取 `j=i+word%(pool.length-i)`，交换 i/j，i=0,1,2。
- 刷新按槽位 `optionIndex=0|1|2`，只替换目标卡，等级和其余两张的位置/ID 不变。每槽每节点一次；新卡所在槽位已经用过，不能再次刷新。`augmentRerollLimit(augments)` 保留导出，现返回**每槽上限 1**；原 ExtraRolls 定义未注册，旧未来扩展约定被本次每槽一次覆盖，不新增内容。
- 刷新候选排除当前三张、已持有及永久移出 ID；先完整校验，再对候选按 ID 默认 `.sort()` 升序，推进 choiceRngState **一字**，用 `word % pool.length` 取唯一新卡。至少一项即可成功；零项原子拒绝，不跨级、不回退、不消耗槽位额度。所有命令按提交顺序执行，历史保留顺序；例如 2→0→1 不能排序成 0→1→2。商店、奖励、战斗等流不变。
- 成功时把**旧卡**加入本局该玩家的 `removedAugmentIds`，以后任何节点发牌/刷新均排除；未选中但没有刷掉的卡不移出。不影响其他玩家，不跨新对局继承。

### 命令、状态与失败

```ts
rerollAugment(state: MatchState, choiceId: string, generation: number, optionIndex?: number): MatchCommandResult
```

match.ts 与既有 server-entry 继续导出。有效调用必须传下标；TS 参数暂时可省略仅为保持禁改的旧界面/服务器可编译，缺参绝不默认刷第 0 张，而是 `invalid-slot`。接线完成后可把类型收紧为必填。

校验/失败优先顺序：`wrong-phase`（非 choice/augment/offer，PvP 阵容冻结或已淘汰）→ `stale-choice`（choiceId/generation 不符）→ `invalid-slot`（缺参、非安全整数或越界）→ `augment-rerolls-exhausted`（该槽已用）→ `augment-pool-too-small`（同级合法候选为零，沿用原 reason 字面值）。失败返回 `{ok:false,state,reason}`，state 保持原引用，没有 events，不改变资源、任何 RNG、移出集合或历史。成功返回完整新 state 与一个 `choiceOpened`，沿用正常 match eventSeq；不另造第二份结算事件。

| 字段 | 含义 |
| --- | --- |
| `MatchState.removedAugmentIds: readonly string[]` | 成功刷掉的 ID，按发生顺序存储的唯一集合；新局为空 |
| `augmentOffers[].rerolledIndices: readonly number[]` | 此节点成功刷新的槽位，按命令顺序；选择完成后仍保留 |
| `PendingChoice.rerolledSlots?: readonly boolean[]` | 仅强化有 `[false,false,false]`，对应槽刷新后置 true；后续节点重置 |
| `rerollCount / generation` | 此节点累计成功次数，均为 0..3；任一槽成功均 +1，全选择共用 generation |
| `rerollsRemaining` | 3-rerollCount，表示尚未使用的槽位数，不保证候选足够 |
| `toPrivateSeatView(...).pendingChoice.augmentOptions[]` | `{optionIndex,definitionId,rerollAvailable}`，按 offers 顺序；已用、阶段不符或候选耗尽为 false |

私有投影还复制 `rerolledSlots`，保留 offers/augmentTier/choiceId/generation。`augmentOptions` 为展示 DTO，不是可写权威。界面通过每卡 rerollAvailable 接按钮，不用总剩余数推断某一卡可刷新；不公布移出账本、seed、未来等级或其他席候选。单机也可调用 toPrivateSeatView 读取同一权威展示字段。

### 持久化与恢复

`serializeMatch/restoreMatch` 保存并严格校验以上权威字段。validateAugmentOfferHistory 从 `seed xor 0x9e3779b9` 的 choice 流开始，逐节点重演初始三字及有序下标对应的单字刷新，从重演的旧卡重建移出集合；核对槽位唯一/范围、计数/代次/剩余数、当前候选、已选 ID、永久移出集合及顺序。异常尚未抽取前还核对 choiceRngState。不能信任保存的候选或 RNG 检查点；不重新授奖。

单人仍校验 augmentTierSeed=seed。联机与单人共用候选/刷新规则；联机完整 Match 的用户导入/导出原本不支持（含 sharedPool 状态），本轮不新增该入口。服务器重连复用席位权威 state；若服务器持久化整局，必须原样保存并恢复 pool 与各 MatchState（含新增字段），不能仅存私有投影或重新 createMatch。测试覆盖共享 pool/state 的 JSON 往返及恢复后续命令，不声称新增服务器磁盘恢复验证。

当前身份仍为 schema7/save3/replay3/command3、rules `s13-g2-3-v14` / content `s13-14.24b-g2-3-v14`，digest 和 manifest 策略对象暂留 v14 原值。这是未发布的 v15 工作区，旧 v14 存档缺少新字段会严格拒绝，不能把同版本兼容或旧录制已更新作为完成结论。统一发布前必须完成版本、manifest 和指纹收口。


## G2-3 当前实现与接入合同（2026-10-16）

本节与 [G2-3 实现对账](evidence/g2-3/RECONCILIATION.md) 优先于本文历史切片中的48英雄、3异变、学院不发奖、征服者无宝箱等描述。已 rebase 到 multiplayer 的 #134（19aa9f1），领域侧通用接口已接入；服务器转发与最终验收边界见下文。

- 版本统一为 rules `s13-g2-3-v1` / content `s13-14.24b-g2-3-v1`，schema7、存档3、回放3保持；digest包含新内容、奖励过渡政策及有限规则manifest。旧存档/回放拒绝，无迁移或静默回退。开局沿用#126的一费随机英雄，不回退旧的固定开局。
- 准入60位商店英雄，1–5费14/13/13/12/8种，共享库存1171份；原始26个非Teamup羁绊启用25个，FormSwapper与7个Teamup不开放；30个异变，排除Cosmic Rhythm。远程形态和召唤物不加入商店/合成/共享池。
- Elise/Swain/Gangplank/Jayce按开战初始站位选属性与技能：己方前两排近战、后两排远程；敌方对称，整战不切换。永久资产保持canonical ID，Combat ability championId/初始属性记录当前形态，移动/恢复不重选。射程4格和Forge1000生命是约定值。
- `seatMechanics` 是唯一持久机制容器；本席进度在 seat 的六个预留键，RNG/进度重演历史在 hidden.progress；发物、发英雄、金币和选择只有 MechanicReceipt，来源事实统一 mechanic，事件统一 mechanicGranted。MatchState.g23 和 g23ItemGranted 已删除。恢复从种子重演进度、核对通用收据和当前终局事实，不发奖、不抽签。CombatInputBasis/PlayerBattleSnapshot 的 g23 仅是从容器重建的冻结编译输入 DTO，不是第二个可修改的 MatchState 权威。
- 征服者仅15个启用箱，第10档650，超过1500继续积层；唯一战斗/受害者收据防重，2/4/6/9档每击杀或助攻1/3/6/20层。每箱使羁绊基础AD/AP加成成长5%。各档只取非零权重Option1。
- 征服者延后神器、辅助装、冠、窃贼手套、锻造器、复制器。仅受影响档删除这些物品，保留其余奖励，Gold=max(原Gold,map22整档估值)。已有拆卸器、重铸器保留，第5档不触发折金。第14档60金+光明装备+拆卸器；第15档200金+永久光明转化。逐档源/过渡对照在RECONCILIATION，均标约定值，下一批恢复原奖励。
- 光明转化开出时转换场上/备战席英雄穿戴的普通成装；随后仅新合成成装自动转光明。每件转换记录原ID、目标apiName和`g23:conqueror:15`唯一来源；不会转换未穿戴库存或普通新赠成装。
- 学院按独立LCG抽一组有序三件项目赞助池（29组ID/均匀权重为约定值）。首次成功准备命令跨越3/4/5档逐档发奖到库存，receipt防重；同ID永久穿戴复制品叠加，学院成员额外5%只一次。Jayce使5档可达。
- 黑市按map22权重无放回抽最多3个候选，选中一个完整包；拒领保留微光并累积跳过次数，领取清零；源HealthPerSkip按当前档×次数给成员。跨多断点保留最高一次offer为有限约定。
- 黑市复制器（用户2026-10-17 15:20批准）：100微光的LootA/LootA4（25%/10%）及200微光的LootB1（20%）各发1个`TFT13_Crime_Consumable_LesserShimmerDuplicator`，14.24 zh_cn名“次级微光复制器”。仅复制场上或备战席已拥有的≤3费炼金男爵；目标按既有种子派生候选顺序取首个。无合格目标或备战席满则保留托管，不消费、重抽或改发其他英雄。征服者第4档`TFT_Consumable_ChampionDuplicator_III`仍可复制≤3费任意英雄。`G23RewardAtom.duplicatorDefinitionId?`在复制器原子上保留上述API身份，`readG23MechanismState(state).rewards`原样投影它；领取记录仍为现有`kind:'duplicator'`/英雄收据，不新增命令或手动消耗品。当前分支不升版本，合并时取multiplayer届时版本+1；digest按实际策略自动重算。大小两种大复制器均不准入。
- Rumble军械库采用弹出选择，可收起，超时确定性选合法项；付费余额不足时选Spare。每3个Rumble参战回合一次，2个未购升级+Spare，付费5金，全购后Finishing，三星下一菜单Titan；不做常驻商店。使用 pendingChoice.kind=armory、choose/timeoutChoice；超时始终选择0金项（普通Spare、全购Finishing、三星Titan），余额不足的付费选择拒绝并保持原对象。菜单待选期间拒绝卖出Rumble；联机购买合星改变菜单时刷新offers并增加generation，旧选择失效。
- Rumble三星自爆为双抗合计的20000%（2000000Bps），死亡伤害先于最后单位判负；实验Mundo120生命与每唯一击杀+60；Sion/Forge有限实体与技能省略范围见对账，不能把归档文本视为完整执行声明。
- G23进度随机流seed xor 0x67323370，初始赞助1词，黑市每候选1词（每offer最多3词）；HighRoller消耗显式Combat流，只有Triple追加二级词。军械库、试验格、奖励原子使用带独立常量/身份的LCG派生流，不污染商店/开局/战斗种子流。失败命令返回原state，无资源、RNG、收据或事件变化。
- 奖励金币在唯一结算事务发放；已确定物品/英雄/工具同步发放，未决物品选择和满席英雄托管。英雄一律 grantMechanicUnit，并透传同事务 UnitLootPolicy；池空按费用折金，满席在碰池前保留待领奖励；卖出释放空间或 claimLoot 时重试。`readG23RewardItemCatalog()`提供奖励apiName、中文名、约定状态。光明装备 kind=radiant 且 radiantOf 指向唯一普通成装；通用物品读取统一到 g2-3-item-registry，普通recipe/重铸/轮盘/临时装备池不随奖励目录扩大。

- 召唤物结算约定：Sion维持阵营存活，Forge与预留桶id不维持；所有战斗召唤物不增加玩家伤害。Forge生成及复活空格搜索按席位坐标后镜像。
- #134已合入并完成rebase；卡池policy透传、通用机制金币校验、非战斗召唤物判负均已接入，详见 [PR134接入清单](evidence/g2-3/PR134_INTEGRATION.md)。

### G2-3 / Claude 服务器配套交接（本PR不越界）

`src/server/`、`src/rendering/`、`src/server-entry/`不由本PR修改。领域已经接入#134的容器、choose/skip/timeout、召唤帮助函数和事件、radiant种类、金币来源/失败枚举。准备期不创建永久Sion/Forge资产；开战投影经spawnCombatUnit进入Combat，发unitSpawned；Sion发bindingChanged，High Roller发castOutcome。Forge死亡后恢复同一实体发unitRevived，未发生移除/重生，因此不复用已移除id。removeCombatUnit记录废弃id，spawn拒绝复用。

双边`proposeSettlement()`产生`SideProposal.g23Facts`；服务器必须原样转到`RoundSettlementReceipt.g23Facts`，仅实际参与席位结算，镜像无进度/收益。当前`src/server/room/room.ts`的`buildReceipt`（约1052行）仍只复制旧字段；Claude需补`...(proposal.g23Facts ? {g23Facts:proposal.g23Facts} : {})`，不自行算规则。该转发未完成前不能宣称G2-3联机机制已上线。见`docs/UI_REQUESTS.md`的G23-SERVER-FACTS。冻结战斗输入的g23/playerHp由规则快照函数提供，服务器不得另造进度。


> M8 B2审计修订待复审，目标合同见 [M8_RULES.md](M8_RULES.md) 与 [M8_UI_CONTRACT.md](M8_UI_CONTRACT.md)。本文件仍描述当前M7运行行为；新类型未接入，正式版本切换由B3–B9完成。

Current progression: rules/content `s13-g2-3-v20-xp68` / `s13-14.24b-g2-3-v20-xp68`, policy `project-xp68-user-2026-10-22-v1`. Schema11/save7/replay4/command4 are unchanged; old identity/digest saves are rejected without migration. `getXpToNextLevel(level:number):number|null`, `getShopOdds(level:number):readonly[number,number,number,number,number]` and `grantXp(level:number,xp:number,amount:number):ProgressionResult` accept levels1–10; invalid levels/unnormalized XP throw `RangeError`. `buyXp(state:MatchState):MatchCommandResult` retains failure order wrong-phase → max-level → insufficient-gold and original-state atomic rejection. `RoundSettlementReceipt.opposingSurvivors` accepts0–10 (the surviving enemy hero count, not bench size), otherwise `invalid-receipt`; damage formula is unchanged.

Public entrypoint: `src/simulation/match.ts`; public state: `match-types.ts` and `strategy-types.ts`. [M5_RULES](../M5_RULES.md) defines exact values and ordering. Match is the sole authority for economy, resources, schedule, progression and terminal state. The historical M4 contract is available in Git at the M4 baseline; this document describes the current API.

- `createMatch(seed=42)` accepts uint32 including zero. It returns schema5/rules `m5-14.24b-v1`/content `s13-14.24b-slice-v1`/protocol2, a complete content digest, 100HP/10G/level3 and the three starting units. Opening component choices precede the first augment. Round1 means2-1; round35 means6-7.
- Successful commands return `{ok:true,state,events}`. Failure returns `{ok:false,state,reason}` with the identical original state, no events, and no partial gold, shop generation, RNG, ID, receipt, growth or sequence mutation. `setShopLock` with the current value is a successful unchanged-state no-op.
- Preparation permits buy/sell/reroll/XP/deploy/item/lock commands. Buy validates generation and purchased status before resources, plans recursive triples atomically and checks final bench capacity. New candidate IDs consumed in upgrades are never reused. Price and sell value come from definitions, never UI.
- F costs4G/4XP, rejects wrong-phase then max-level then insufficient-gold, and never changes the current shop. Level10 caps XP at0; levels8 and9 each require68XP to reach the next level. Level10 shop odds are5/10/20/40/25, with levels1–9 unchanged and level11 rejected. Requested and applied XP are separately recorded. D costs2G and keeps the lock flag. Natural Continue refreshes only unlocked shops; every generated shop consumes ten shop words and increments generation.
- Deployment shares `validateMatchDeployment` between preview and commit. Geometry is unchanged; nine bench slots and population cap `getDeploymentCap(state)` = level + granted Tactician's Crowns (G2-4a, see below). Moving a deployed unit does not consume an extra slot. Start rejects over-cap preparations. Empty player boards can concede immediately at tick0.
- Tactician's Crown (金铲铲冠冕, `TFT_Item_ForceOfNature`, source `MaxArmySizeIncrease` 1; user rule 2026-10-17): every G2-3 reward claim with `kind:'item'` and `definitionId:'TFT_Item_ForceOfNature'` adds +1 to `getDeploymentCap` permanently, wherever the crown sits (inventory, board or bench unit) and even after its holder is sold, it is removed or the instance is gone. A grant that fails records no claim and adds nothing. Saves, frozen combat inputs and PvP snapshots add no field: each validates population against the claims in the G2-3 progress it already carries, and a frozen input's claims must be a prefix of the authoritative claims. In this slice crowns come only from Conqueror tiers 12/15 (no spatula, no recipe).
- Crown win gold (`TFT_Item_ForceOfNature`, source `PercentGoldChance=10`): user conventions G24-CROWN-GOLD-01..05 count only crowns equipped on deployed units at combat start (dead holders still count, inventory/bench excluded). Each crown independently rolls 10% for 1 gold on PvE/PvP wins; losses/draws do not roll. The G23 lcg32-v1 stream consumes one draw per crown after the battle's black-market draw. Gold is credited directly, after high-roller/chest payouts, once under `g23:crown:<battleId>` with source `tacticians-crown`; no pickup orb. `G23BattleFacts.crowns?:number` is omitted when zero (otherwise 1..84, the structural 7×4 deployment cells × 3 equipment slots bound); `G23EconomyAction.crownGold?:number` exists when rolled, including zero. Restore validates deterministic economy replay, mechanic receipt linkage, frozen combat input and terminal facts; repeated step/settlement/Continue never pays again. Rules/content v5 and policy `g2-4a-v5`; schema/save/replay unchanged; previous identity rejected, no migration. Evidence and convention provenance: `docs/evidence/g2-3/RECONCILIATION.md`.

- `combineItems` and `equipItem` are atomic. Two inventory components become one new item ID; only the nine supported recipes are legal. Three equipment slots, deterministic upgrade transfer, overflow return and sale return remain authoritative in Match. Tristana growth sums into an upgrade survivor; selling destroys that unit's growth and anomaly binding.
- Choice is a real phase; all ordinary commands reject until it resolves. Choices validate ID/generation. Seven-way component choices consume no RNG; augment three-way offers consume three words; anomaly single offers consume one word, with1G rerolls excluding only the previous offer. Target binding precedes offers. Confirmation is free. Upgrades migrate bindings.
- Choice may carry a finished Combat snapshot during post-PvE rewards, and `returnPhase` distinguishes preparation from settlement. Restore verifies it against the scheduled timing (supply always returns settlement) and rejects forged return phases. Rendering must refresh on every transition out of Combat, including Combat→choice. A supply round has no Combat: selecting its component atomically settles income and XP. No early Continue can bypass rewards.
- Shop, choice, reward and battle-seed streams are independent. Successful Start consumes one battle-seed word and freezes a separate Combat RNG. A random component consumes one reward word. Other command/choice/settlement operations consume no words unless explicitly specified by R4.
- `stepMatch` advances exactly one50ms tick. A terminal Combat transaction calculates result/survivors, HP, streak, income, XP, persistent growth and augment progress; creates one settlement identity/history/event sequence; then determines terminal state or post-battle rewards. Duplicate terminal steps cannot settle again. Supply uses the same economic planner without a Combat result.
- `nextRound(state,expectedRound)` accepts only the current completed settlement. It advances schedule/enemies, handles the shop lock, discards the old Combat and drains ordered before-round events. Receipts prevent duplicate grants. Income was already committed at settlement and is never repeated here.
- HP0 ends in defeat. At round35, final PvE victory ends in victory; other results end in defeat. All normal commands reject in gameOver. New Match discards the entire prior session. `stepMatch` outside Combat returns unchanged state and no events.
- `MatchSession` delegates synchronously, retains the complete current battle event ledger and uses a fixed-step accumulator. Phase changes and New Match clear time remainder. Native D/F/E commit in event order, independently of pointer-dismissal protection. The UI never settles, repairs state or calculates a parallel economy.
- `serializeMatch`/`restoreMatch` validate exact versions/digest, IDs and ownership, receipts/history, terminal and phase boundaries, normalized economy, RNG, growth/augment state, frozen Combat sources and dynamic layers/statuses/tasks. Crown history additionally uses isolated deterministic replay as specified below; it never advances the active match or pays its rewards again. Old schema4 and unknown content versions are explicitly rejected. Validation is not cryptographic proof of command history.
- 战斗存档 C/D 一致性：对象恢复、JSON 恢复与 `serializeMatch` 共用从已认证 `CombatInputBasis` 和策略重建的单次 `RestoreCombatReplay`。`atSaveTick()` 的同一结果核对所有持有者完整 triggerLedger（含 processed/actionCounts 的全部键）、完整 runtime（含所有攻击/施法计数及其攻速/射程/成长）、damageContributors/nextTriggerEventSeq、战斗游标 rngState/rngDraws/nextActionSeq/nextEventSeq、全部普通/抗性 shieldLayers 和汇总 shield、G23 absorbed.value 及整个 g23/maxHp/maxHpBasis、periodicTasks 全部余数和相位与 burn 状态组、activities 全部时长/份额、G22 exposure 三字段、G2 damageDealt/damageTaken/crystalDamage。零值、缺失和无触发器持有者也必须比对，不能用候选记录挑选比对范围。抗性护盾沿用已有拒绝原因，但复用这次重演，不另走第二条轨迹。校验不写回重演状态、事件或 RNG，不改变版本、规则或数值。
- Sevika 的 `g23.highRoller` 收据固定为 actionSeq、spell、mod、enhanced、gold 五字段，按完整字段集合严格校验；不接受第六个未知字段。其随机结果与全体 G23 运行事实一样由可信重演逐字段认证。
- Match event sequences and Combat `combatId/tick/eventSeq` are distinct and monotonic. Start events at tick0 are retained. Replay verifies every command/tick state and all events, including failed-command noninterference. Canonical evidence hashes use SHA-256; the content drift digest is not a security primitive.


M5审计修订：4-6无自有目标时保持preparation招募窗口，首个正常购买原子打开异常target选择；D/F保留至少一项可购买的卡，Start在该窗口拒绝。耗尽的锁店使用换轮正常免费刷新。确认收据幂等，确认后再卖空不重启异常。抽样使用完整32位词缩放候选区间，每次仍一词。

## M8 B5 开发期装备实例补充

本节覆盖上文旧 M5 装备条目的对应部分；正式 M8 存档版本仍待 B9。B4 已开放八组件/36配方。B5 依据冻结 M8 合同执行同持有者同 apiName 唯一性、三槽独占；三槽本体固定在0槽，预留1/2槽。合成同实例返回 `same-item`，装备非自有目标返回 `unknown-unit`。失败仍返回原状态且无事件/消耗。升星转移复用通用放置校验，冲突返回库存；恢复严格检查相同约束。开发规则修订纳入内容digest，旧开发档不自动迁移。阶段范围与验证见 [M8_B5_HANDOFF.md](M8_B5_HANDOFF.md)。

B5 第3阶段新增开发期必需字段 `equipmentState` 和 `temporaryEquipment`：独立装备RNG与父实例/轮次roll账本由Match成功事务管理，同轮组合跨等级/出售重穿/升星转移保持，新轮首次穿戴刷新。临时装备以独立temporaryId投影并传入现有战斗程序，不能转为永久库存；保存恢复严格重放装备随机流和验证当前父/子绑定。`item-selectors.ts`提供共享命令校验的预览及不会生成装备的只读视图。正式M8版本/持久化格式仍不在本阶段切换。


## M8 B7 中立战斗观察收据补充

本节仅补充已接入 B7 的 `combat.neutralReceipts`，不改冻结 M8 规则／UI 合同、G12 或 B8 掉落边界。含目录中立实例的 Combat 从开战起必有 `{ deaths: [], controls: [] }`；不含这些实例时该字段必须缺省。收据随 Combat 快照保存，由 `recordNeutralReceipts` 仅观察已提交的正式战斗事件，不施加效果、不改事件、不消费 RNG。

- `deaths[]` 每个中立死者至多一笔：`unitId`、正式死亡 `tick`、Combat 局部 `eventSeq`。恢复要求死者属于本场可信遭遇且确已死亡；每个已死亡中立都必须有收据。该身份绑定同伴反应的 `registeredAtTick` 与 `deathEventId`，防止删除／重定时后再次消费。
- `controls[]` 记录中立来源眩晕：`key` 是完整机制身份，`targetId` 是受控目标，`appliedEventSeq` 是施加事件序号。仍挂载时 `removedAtTick`、`removedEventSeq`、`removedReason` 全为 null；移除后填写对应正式事件的 tick、序号与原因。
- 恢复校验施加身份与可信开场任务／目标一致，状态应用来自同版本声明。起点由任务 `executeAtTick` 加声明的 next-tick 偏移计算，终点再加声明 `duration.ticks`；当前先锋为 `[2,12)`。活动收据须有对应存活目标和状态；移除收据须无活动状态，原因限有效的 `expired`、`death-cleanup`、`combat-end` 或有已消费装备净化依据的 `cleansed`。到期必须匹配声明终点；移除事件序号晚于施加序号。收据事件序号在本 Combat 的 `nextEventSeq` 范围内且不重复。
- B7 观察收据本身执行上述同版本结构和一次消费一致性检查；冠冕历史另按下节在独立副本上重放。这些观察收据不是 B8 `LootReceipt`、资产／掉落键，也不是对联合伪造整段历史的密码学认证；不替代完整恢复／回放验收。

## G2-4a 冠冕历史恢复 API（M1，方案 A）

本节覆盖上文仅结构恢复的历史描述，MatchState 资源账本增加 `equipmentHistory: 'ordered'` 与普通 `item-equipped` 事实；BattleRecord 增加可选 `equipmentCommands`（穿戴／原位合成为 `{tick,itemId,unitId,slot}`，背包合成为 `{tick,consumedIds:[aId,bId]}`，消耗品使用为 `{tick,consumableId,target}`（`target` 为 `{kind:'unit',unitId}` 或 `{kind:'item',itemId}`），按执行顺序排列，缺省为空），SaveEnvelope 字段不变。不改变规则、数值、内容 digest。G24-CROWN-GOLD-01…05 保持：开战场上装备、阵亡仍算、PvE/PvP 赢才掷、每顶独立、直接到账、G23 黑市掷骰之后。征服者／化学男爵仍由现有结算逻辑按当前棋盘取档位；历史验证不引入另一套结算规则。

- `restoreMatch(input: unknown, battles?: readonly BattleRecord[]): MatchState`：文本／对象输入均先检查结构和资源来源折叠。存在冠冕战斗声明（包括零命中或败／平局的 `crowns`）时必须提供本局从首战至最新已结算战斗的完整回放；否则抛出 `Invalid Match save: missing historical evidence / 缺少冠冕历史证据，请提供完整 battles 回放`。提供历史时，无论有没有冠冕，均验证整段历史。没有冠冕声明的孤立 Match 保留原结构恢复合同，不代表其完整战斗历史已获认证。
- `serializeMatch(state: MatchState, battles?: readonly BattleRecord[]): string`：与恢复相同的验证条件，仍只输出原 Match JSON。调用方必须另外保留现有 `SaveEnvelope.battles`，不能只存该字符串后丢弃历史。
- 逐轮验证 `BattleRecord.context` 的来源账本（真实获得／合成记录）、开战输入及全部事件／终局 hash；正常 `startMatchCombat`／`stepMatch` 在副本上重建胜负、开战冠冕资格、经济 RNG 和金币收据。后续开战上下文和最终 Match 必须继承已验证的经济、机制收据和资源来源前缀；所有装备实例必须延续上一场已验证的持有者与槽位，仅按普通穿戴、既有拆卸、出售、合成、升星迁移和转化资源事实更新；同时核对下一场开战输入和最终候选（包括无当前战斗的准备阶段）。不能用候选自报的 `crowns` 或 RNG 自洽代替历史证据。缺战、乱序、跨局、前缀改写或重建不符均整份拒绝，错误说明对应历史证据／经济收据／获得合成记录问题。
- `validateBattleRecord(record, battles?)` 与 `new PlaybackSession(record, battles?)` 的第二参数是**该记录之前**的完整已完成回放。上下文含冠冕历史而省略参数时同样拒绝。`BattleHistory` 恢复当前前缀及 `MatchApplication` 打开回放已传入相应历史。单条记录的结构兼容检查 `checkRecordCompatibility` 不授予恢复权限。
- `validateBattleCollection[Sync](envelope)` 按顺序验证全部已完成战斗、最终经济／资源前缀及当前战斗；`validateEnvelope`／`validateFile` 强制调用这项验证，调用方提供的附加回调不能取代它。`routeSaveFile` 只是版本／结构分流，返回 `view:null` 不表示可续玩；应调用完整验证入口或 `readCompatibility`。归档准入也使用完整集合校验。
- 首场之前从空装备状态、可信开局单位及经验证的出生事实重演装备事务（`planEquip` 等生产规划器），核对首场开战和当前候选的位置；无战斗及 `battles: []` 也不跳过。战中穿戴／原位合成、背包合成和消耗品使用由记录器按命令顺序记录 tick，重演时分别调用生产 `equipItem`／`combineItems`／`useConsumable` 后再推进 tick；背包合成或重铸生成的新实例可供紧接着的穿戴使用。生产命令在对应 `item-equipped`／`item-combined`／`consumable-used` 资源事实写入当时的 `tick`，战斗外操作不带该字段。重演生成的全部资源事实按原顺序逐条严格比较（包含 tick），不能过滤为仅装备子序列；临时成装掷骰、经济收据及机制收据（含冠冕金币）的前缀也须一致，使装备进入正确的授予、成长、结算顺序。
- 装备历史的认证边界（M9）：单独修改命令或资源事实的 tick 会被拒绝。若同时把两处 tick 改为另一合法战斗时刻，且命令、其他资源事实、临时成装及金币收据的顺序与结果完全不变，则无法独立识别这个时刻声明：永久装备本场不生效，此时只认证顺序与重演结果，不认证真实操作时刻。除账本记录的 tick 元数据外，恢复后的完整对局状态及后续逐 tick 结果完全相同；回归同时与在新时刻执行生产命令的真实对局比较完整状态。
- 格式迁移：缺少 `equipmentHistory` 的旧账本直接报 `Invalid resource provenance: ordered equipment history required`，不迁移、不从最终位置猜测历史；须保留原文件并开始新局。当前版本常量暂不调整，合并前统一升版要求见 [M4 复审说明](G2_4A_M4_REVIEW.md#合并版本事项本提交暂不升)。
- 调用方迁移：把 `restoreMatch(text)` 改成 `restoreMatch(text, envelope.battles)`，序列化相应传同一历史；产品导入／继续优先使用 `validateFile(file, validateBattleCollection)`／`validateEnvelope(envelope, validateBattleCollection)`。单场回放传入同局按轮排序的先前记录。缺少所需历史的旧孤立冠冕 Match 无法补证，不迁移、不猜测装备或胜负，应保留原文件并开始新局。
- 验证只在独立副本重演，不修改调用者状态、发奖或推进活跃对局 RNG。缓存仅复用 recorder 私有标记且深冻结记录的单场重演结果；每次仍重新校验历史前缀，外部对象／自行 freeze 的输入不获得该信任。完整回放的耗时随历史长度增加，性能门槛与超时保持原值。

详见 [M8B_CONTRACT_ADDENDUM §5.1](M8B_CONTRACT_ADDENDUM.md#51-b7-已接入的中立观察收据) 与 [B7 交接](M8_B7_HANDOFF.md)。

## SR-C7-01 准备阶段单位互换（2026-10-12）

用户已确认采用 TFT 的己方位置互换规则。本节覆盖上文 Deployment 的占位行为，单人与联机共用；不改棋盘尺寸、部署区、人口/经济/战斗数值。

沿用公开函数与现有命令，**不新增 swap 命令或目标单位 ID**：

```ts
validateMatchDeployment(state: MatchState, unitId: string, target: UnitLocation): MatchFailure | undefined
deployMatchUnit(state: MatchState, unitId: string, target: UnitLocation): MatchCommandResult
// 现有联机 ClientCommand 形状：
{ type: 'deploy', unitId: string, target: { kind: 'board', cell: { col: number, row: number } } }
{ type: 'deploy', unitId: string, target: { kind: 'bench', slot: number } }
```

- 空目标仍是移动；目标仅被另一个己方单位占用时，一次事务交换两者 location，支持棋盘↔备战席（两个方向）、备战席↔备战席、棋盘↔棋盘。目标单位按提交时的当前状态决定，联机仍走原有回合/席位版本校验。拖回自己的位置成功但布局不变，再发相同目标也不会把互换反转。
- 双方 ID、定义、星级、装备持有者、成长、异常绑定均跟随单位保留，只变位置；不买卖、不升星、不生成奖励或账本事件，不消耗金币、RNG、ID/事件序号。满备战席可以交换。输入与目标坐标不被修改，两端位置分别复制，没有中途重叠的可见状态。
- `validateDeployment(GameState,...)` 是几何/所属校验，允许己方占位交换，不承担人口或阶段判断。界面人口预览应调用 `validateMatchDeployment`；提交与预览共享校验。
- `validateMatchDeployment` / `deployMatchUnit` 首先要求 preparation，再检查部署区、合法坐标及己方所属；交换的反向目标（原位置）也必须合法。最后检查**完成移动/交换后的玩家棋盘单位总数 ≤ getDeploymentCap(state)**。例如 level3、场上3人、备战席1人，备战席换场上人仍为3人，允许；去空棋盘格会变4人，拒绝。若输入已超人口，交换不降低人数，仍拒绝；移到空备战席且恢复到上限内可以成功。
- 失败名沿用现有枚举：`wrong-phase`、`unknown-unit`、`enemy-unit`（拖动敌方）、`invalid-location`、`outside-deployment-zone`、`occupied`（目标有非己方单位或多个占用者）、`population-cap`。SR-C7-01 原文的 `deployment-cap` 指人口拒绝，**实际线上错误仍为 population-cap**，不新增同义错误。敌军合法部署区外优先报 outside-deployment-zone。失败返回 `{ok:false,state:原对象,reason}`，无 events，无部分位置/资源/RNG写入。
- Claude 接线：发送上述一个 deploy 到目标位置即可，不能先把另一人移走再移动两次。现有 `ClientCommand` / `applySeatCommand` 已覆盖，无需新增协议成员；不涉及共享池持有数、池版本或占用调整。UI 的己方占位阻挡逻辑及鼠标预览由 Claude 按此合同接入。本 PR 不改服务器和界面。

规则身份：新增子规则版本 `DEPLOYMENT_RULES_VERSION = 'preparation-swap-v1'` 纳入 CONTENT_DIGEST；digest 从 `fnv1a32-utf16:c7ac9b0c` 变为 `fnv1a32-utf16:20b58a63`。M8 schema、命令 protocol2 与内容数值不变，旧 digest 的存档/回放按现有规则明确拒绝，不做静默迁移。

T1 首战没有互换命令。完整状态 trace SHA-256 因 Match 及 combatInputs 的 contentDigest 改为 `05d9283c62258433146e564bb0d7a78b22d9d51baf49fa652f59094d7ef4cb1f`；把这些指纹恢复为旧值后，逐状态字节仍匹配原 trace `2750307d4dea28641853737163d3621a6b3cce3901cfd184a0dc8c4178689167`。原 `tests/t1-probe-baseline.json` 保留，新增 `tests/t1-deployment-baseline.json`，校验器同时断言新 trace 与仅指纹归一化的原 trace；事件/RNG trace、164 tick、106条战斗事件以及首战 Combat 终态 hash 均保持原固定值，不改任何数值 golden。

## T10 联机运营与截止自动部署（2026-10-13）

联机 opt-in 覆盖上文普通命令只能 preparation 的限制，完整允许矩阵、失败原因、服务器调用顺序见 [MULTIPLAYER_CONTRACT §15](MULTIPLAYER_CONTRACT.md#15-t10战斗运营与准备截止自动上场2026-10-13)。combat/choice/settlement 允许买刷经验锁店、备战席出售/互换/装备与库存合成，禁止棋盘出售/部署；T12 装备例外见下节，冻结战斗不回写。战斗中三合一只使用备战席，涉及棋盘的合并在战后提交成长后自动执行。

新增 `autoDeployToCap(state): MatchCommandResult` 仅供服务器准备截止显式调用：最左备战槽依次上场，前排起逐行按列 `3,2,4,1,5,0,6` 找空格，不耗 RNG；线上普通与自动部署共用 `unitDeployed {unitId,from,to,domain,eventSeq}`，离线部署事件行为保持。PvP 冻结两方快照后用 `lockMatchCombatRoster` 锁 live seat，结算自动解锁；共享 PvP 用 `runSharedMatchCommand(pool,state,{type:'settleRound',receipt})` 原子迁移来源，不能只提交旧 Match。单人不调用自动上场，既有操作阶段和行为保持；新细分规则版本进入 digest，旧 digest 存档拒绝。

## T11 开局自然经验修订（2026-10-13）

用户批准 [S13_RULES_GAP R1/R6](S13_RULES_GAP.md)：[OPENING §3.1](M8B_OPENING.md#31-基础收入与失败规则) 的 1-4 自然 XP 从 0 改为 2，开局政策升级 `m8b-opening-project-v2`。此前 B6 的 2/2/0 XP、进入 2-1 三级 0 XP 文字由本条覆盖；现在 2/2/2 XP，无经济操作的 seed 42 进入 2-1 强化前为 10G、三级 2/6 XP。XP 阈值不变，买 XP 按累计值推进，不强制回填基准。

发放仍发生在唯一结算事务；重复 step/继续/恢复不重发。公共 API 签名、失败原因、外层 M8 格式和 RNG 算法均不改变。内容 digest 与掉落回放 digest 随开局版本改变；旧身份存档拒绝，不做迁移。联机接续及加时边界见 [联机合同 §16](MULTIPLAYER_CONTRACT.md#16-t11开局经验与自动接续2026-10-13)。本次不开放战中棋盘单位装备、不新增宝珠/消耗品，也不扩展野怪回血。


## T12 单人装备权限与单位身上合成（2026-10-14）

本节覆盖旧文中装备 preparation-only、choice 禁止普通装备命令的说法；当前 M8 身份见 [联机合同 §17](MULTIPLAYER_CONTRACT.md#17-t12战斗中装备永不锁定r22026-10-14)。单人和 active 联机相同：preparation/combat/choice/settlement 均可库存合成、装备己方永久棋盘/备战席单位合法槽，包括本场已经阵亡的永久单位。gameOver、淘汰、敌方/镜像/召唤物拒绝。独立 `canOperateEquipment` 不放宽单人 buy/sell/deploy/reroll/buyXp/shopLock；原 settlement 满备战区待领奖出售特例保留。

既有 `equipItem(state,itemId,unitId,slot)` 输入库存组件、目标槽为永久组件时，按最终槽位校验后消费两件并生成一件新永久物品，顺序 `itemCombined → itemEquipped → 必需的临时装备规划`。窃贼独占三槽且父实例归一槽 0；不拆卸、不跨单位取件、不替换成装。失败原 state、无 events、无 ID/RNG/序号变化。预览可选 `combination`、全部导出签名和失败枚举见 §17.1。

战中新装备下场生效，当前 combat/combatInputBasis、HP/护盾/数值/触发器/战斗随机流完全不变。冻结前缀保存已被运营合成消费的旧物品身份。结算使用 latest live state、只提交本场合法成长与唯一奖励，装备不得反向计入本场收益；战后合并迁移最新装备。

单人四阶段 serializeMatch→restoreMatch→续算仍通过 b8-restore 与 resource-provenance，允许合法组合 suffix，保留出生/配方/所有权/序号/奖励顺序/冻结非装备数据约束。新 CONTENT_DIGEST `fnv1a32-utf16:44fe9c0e`；LOOT_REPLAY_DIGEST `fnv1a32-utf16:7b14bfba` 不变。旧 content digest 拒绝，不迁移或补账；外层格式不变。联机恢复仅采用用户已选 B 的冻结输入恢复与未中断席位结算，不新增联机存档合同。

## T13-A 单位全槽自动合成

库存普通组件装备到已有永久普通组件的己方单位时，无论请求空槽、散件槽或成装槽，均与最低槽号的散件合成。普通成装留在该槽；窃贼父件沿用三槽独占与 0 槽规范。旧状态有两件散件时也按最低槽号选取，每次只消耗一件已穿散件及一件库存组件。

`equipItem`/`previewEquip` 签名、失败枚举、combination 字段不变；成功预览的 occupiedSlots 表示实际落槽。输入 slot 仍须合法。四阶段权限、失败原子性、仅一个新永久 ID、来源 fold 与冻结战斗恢复沿用 T12。按用户后续拆分决定，A 以独立 equipment v4 digest 先行发布，保持 schema6/save2/replay2；旧 digest 拒绝、不迁移，R3/R4 后续另发，见 MULTIPLAYER_CONTRACT §17.7。


## T13 R3/R4 同步合同

D1–D8 按推荐 A 签署；公共签名、失败枚举和 shared-deferred 调用时机以 MULTIPLAYER_CONTRACT §18 为准。PvE 按 M8B_LOOT §11 随机宝珠，五次 .4 自选保留；消耗品在 T12 四阶段操作，修改运营装备且下场生效，失败无事件且保留原 state/RNG/ID。单人完整恢复校验工具授予/消费时序与独立重铸流；联机沿 T12 B 冻结输入恢复，不支持完整 Match 存档恢复。T13-A 与 R3/R4 一次升级到 schema 7、save/replay 3；旧格式 2 仅保全导出、新开局，不迁移。


## P3-A/P4-A/P5-A 合并规则发布（2026-10-14）

普通 stage 2–6 的基础扣血 2/5/8/10/12 与存活敌人每个 1 保持。`selectPlayerBaseDamage(stage, roundKind, roundId?)` 是基础扣血唯一来源，版本 `s13-player-damage-overtime-v2`；`planRoundEconomy` 的计算输入可带 roundId，PvP `overtime-n` 从首场起基础 17，经济时点/日程 stage6 不变。proposal、唯一收据校验同源；重演恢复编译 BattleInput 后重新 proposal 用相同 selector。胜方零扣血、平局基础+存活数、镜像零结算、HP clamp 不变，禁止服务端/客户端单补 5。

现表符合 14.24b，68 为 16.1 值，不开 10 级。`progression.test.ts` 的逐级阈值测试明确覆盖 8级75+1→9；`match-economy.test.ts` 的 “F preserves a valid old-generation offer and checks max-level before money” 检查满级买经验拒绝、原 state 身份与全部字段（资源/事件/RNG）无副作用。

球数保持 1/2/3/2/2/2/2/1，开场 bonus 50/50、装备珠 90/9/1；仅采样改读冻结 ORB_RULES 权重表（项目政策 `s13-orbs-project-v2`，采样 `frozen-cumulative-weights-v1`）。同局各席同模板、部分击杀、重连/重复推进零额外 RNG 沿原契约。

规则/内容版本改为 s13-rules-gap-v2 / s13-14.24b-rules-gap-v2；schema7/save3/replay3/command3、NET2 不变。CONTENT_DIGEST 与 LOOT_REPLAY_DIGEST 由共同 manifest 同批 canonical 计算；旧原档仅只读保全导出，拒绝旧 digest 续玩。普通阶段轨迹比较记录在 docs/evidence/p3p4p5/release-audit.json，T13 与全部历史原件保留。


## P7 共享选秀规则 API（2026-10-15）

玩法/证据/分布以 [S13_RULES_GAP §11](S13_RULES_GAP.md#11-p7共享选秀规则2026-10-15) 为唯一数值来源，联机调用见 MULTIPLAYER_CONTRACT §21。本节接口从 server-entry 导出；服务器接线仍由 G1 完成。所有对象为 JSON 数据；输入不变、失败返回原对象、零事件、RNG 不推进。

```ts
type CarouselRoundId = '1-1'|'2-4'|'3-4'|'4-4'|'5-4'|'6-4';
type CarouselRng = { algorithm: 'lcg32-v1'; state: number };
type CarouselParticipant = { seatId: string; seatIndex: number; hp: number };
type CarouselSlot = {
  slot: number; definitionId: string; itemId: string;
  reservationId: string; pickedBy: string|null;
};
type CarouselReceipt = {
  id: string; carouselId: string; seatId: string; slot: number;
  definitionId: string; itemId: string; holdingSource: string;
  unitId: string|null; itemInstanceId: string|null;
  status: 'reserved'|'granted'|'released';
};
type CarouselState = {
  version: 'carousel-v1'; id: string; roundId: CarouselRoundId;
  pool: SharedPoolState; initialAvailable: Record<string,number>; participants: CarouselParticipant[];
  status: 'open'|'closed'; revision: number; elapsedMs: number;
  slots: CarouselSlot[]; releaseOrder: string[];
  releaseAtMs: Record<string,number>; deadlineMs: number;
  rngBefore: CarouselRng; rngAfter: CarouselRng;
  receipts: CarouselReceipt[];
};
type CarouselFailure =
  | 'invalid-pool' | 'invalid-round' | 'invalid-rng'
  | 'invalid-participants' | 'pool-exhausted' | 'carousel-exists'
  | 'invalid-carousel' | 'carousel-closed' | 'unknown-seat'
  | 'seat-eliminated' | 'seat-locked' | 'already-picked'
  | 'invalid-slot' | 'slot-taken' | 'invalid-time'
  | 'receipt-mismatch' | 'stale-pool' | 'invalid-match';
type CarouselEvent =
  | { type:'carousel-created'; carouselId:string; roundId:CarouselRoundId }
  | { type:'carousel-picked'; receipt:CarouselReceipt }
  | { type:'carousel-closed'; carouselId:string; returnedSlots:number[] }
  | { type:'carousel-seat-released'; carouselId:string; seatId:string };
type CarouselResult =
  | { ok:true; state:CarouselState; events:CarouselEvent[] }
  | { ok:false; state:CarouselState; reason:CarouselFailure; events:[] };
// SharedPoolState v3 增加显式 carouselParticipants（冻结存活席与 HP）
// 和 carouselReservations、carouselReceipts、carouselRounds；不可由 pool.seats 猜 HP。
function createCarousel(pool: SharedPoolState, roundId: CarouselRoundId,
  rng: CarouselRng):
  | { ok:true; state:CarouselState; events:CarouselEvent[] }
  | { ok:false; pool:SharedPoolState; rng:CarouselRng;
      reason:CarouselFailure; events:[] };
function pickFromCarousel(state:CarouselState, seatId:string,
  slot:number):CarouselResult;
// match 为本席资产快照，仅供本席自动策略评分；不在此发资产。
function autoPickFromCarousel(state:CarouselState, seatId:string,
  match:MatchState):CarouselResult;
// 单调逻辑时间；到 deadline 时只更新时间/可选资格，服务器随后逐席自动选取。
function advanceCarousel(state:CarouselState, elapsedMs:number):CarouselResult;
// 发布一个席位的资产与共享账本必须同一事务提交。
function grantCarouselPick(state:CarouselState, match:MatchState,
  seatId:string):
  | { ok:true; state:CarouselState; match:MatchState; events:MatchEvent[] }
  | { ok:false; state:CarouselState; match:MatchState;
      reason:CarouselFailure; events:[] };
```

`SharedPoolState` v3 的 `carouselParticipants` 由规则入口 `prepareCarouselParticipants(pool, states: readonly {seatId:string;state:MatchState}[])` 从完整存活 Match 集合生成，返回 `{ok:true,pool}` 或 `{ok:false,pool,reason:'invalid-participants'|'invalid-pool'}`；禁止信任客户端 HP。校验唯一席、seatIndex 与 pool 对齐、非 released、HP>0，完整覆盖全部未淘汰席。`createCarousel` 要求该快照；私自漏席拒绝。只允许当前自然轮对应的五个 x-4 roundId（1-1 返回 invalid-round），一次性 carouselId=`poolId:carousel:roundId`，不得依调用次数生成新身份。已存在任意创建收据即 `carousel-exists`，关闭也不能重建。

创建按 slot 顺序，各槽先用一词定费用、一词按池剩余份数定单位、一词定装备，共 27 词；即使费用概率 100% 也消费对应词。所有单位候选先 definitionId 代码点排序。槽选择先通过只读可用性预检，全池不足 9 份零消费失败；相应费用为空时按 §11.2 回退，不额外抽 RNG。不使用 Math.random、真实时钟或重连次数。RNG 为独立 carousel 流，父级服务器将独立 RNG 游标传入，本端不再额外派生种子；恢复只接受已持久化前后状态，不重新调用 create。

`pick` 校验顺序：结构 → closed → seat 存在/存活 → 已选 → 是否放行 → slot 整数范围 → 被占。因此同席重选返回 `already-picked`，其他席抢走槽返回 `slot-taken`。人工截止闸门由服务器在更新逻辑时间前/后按 §21 排序；deadline 后人工不得直接 pick。成功生成唯一 `receipt.id=carouselId:seatId`，`holdingSource=receipt.id`；选择只把槽绑定收据并保留池预留，不生成第二份 holdings。自动函数除评分外调用同一个 pick，RNG 不变；非法本席资产返回 `invalid-match`，不以空资产悄悄兜底。

每个 definitionId 必须逐份满足：`initial = available + shops + holdings基础份数 + pending奖励预留 + 未granted的carouselReservations`。创建 available→carouselReservations，pick 不再扣 available；grant 将预留→该席 holdings 并给 Match 创建新 unit/item ID，收据原子转 granted，不能先发单位再补共享池。固定 deadline 到达且全部参与者选完才关闭，未选单位恰好归还一次；已选但未 grant 的预留继续存在，不随关闭归还。关闭轮仍允许 grant；再次 grant **成功无事件且原对象返回**，以便超时重试，不重建单位/装备。receipt 与实际资产不匹配返回 `receipt-mismatch`，不能把伪造 receipt 当幂等。

P7-1 领取位置：备战席空 → 最小空 slot；备战席满且场上人数 < level → 玩家部署区 row/col 升序首个空格（参战）；两处满 → `carousel.heldCarouselUnits`（不参战、可出售）。领取只生一张 1 星单位和一件库存装备，绝不合星；合星和迁入在下一准备期入口结算，详见下方 P7-1 修订。临时位始终计入 holdings，淘汰只归还一次。

不允许选秀期间的商店/出售/装备等资产变更和其他共享池写入；集成事务以 pool.revision 匹配，过期为 `stale-pool`。本次规则实现须提供 `releaseCarouselSeat(state,seatId)` 与 pool 淘汰入口同一事务的适配，返回 CarouselResult；无未释放资产时成功零事件。恢复验证槽、预留、收据、holdings、物品与 pending 队列的双向一一对应，并完整守恒；不运行 grant、自动选择或重新计时。资产变更事件沿 Match 正式账本，新增事件类型须实现时导出并纳入 digest，不能仅靠投影凭空补资产。


P7 方案 B 覆盖（2026-10-15）：P7-1 后仅五次 x-4，全部按 HP 每批两人放行，firstBatchMs/batchIntervalMs/tailMs 均 6000ms；不提前关闭。全选完也等待 deadline，未选席到期自动选取。SR-G1-02 端口与逐项答复见 MULTIPLAYER_CONTRACT §21.4。


P7 实现端口补充（SR-G1-02）：完整原子 wrapper 签名、初始化顺序、队列与淘汰见 MULTIPLAYER_CONTRACT §21.4–21.5。`schedule(roundId:string):{firstBatchMs:number,batchIntervalMs:number,tailMs:number}` 对非法回合抛 `RangeError('invalid-round')`；三个值均 6000。`opensCarousel(match:MatchState):boolean` 只对启用 P7 的 Match 返回选秀资格。

`restoreCarousel(input:unknown):CarouselState` 校验并复制盘/池，`restoreCarouselSeat(carousel:CarouselState,input:unknown):MatchState` 复制已持久化的服务器席位快照，核对当前 digest、池绑定/冻结掉落、收据、选秀出生事实、仍持有的选秀资产定义与排队单位，不发奖、不抽随机数。两者遇损坏输入抛错，不能当命令失败继续。淘汰席保留原 granted 历史收据，池中对应收据为 released，资产只作归档、不再占池。此端口用于**可信服务器快照的 P7 一致性检查**，不是任意客户端上传 Match 的完整恢复/认证；房间其他阶段、经济和战斗历史仍由原服务器持久化边界验证。离线 restoreMatch 明确拒绝 carousel/sharedPool/multiplayer。

本次发布仅将 carousel-v1/shared-pool-v3 政策加入共同 manifest：CONTENT_DIGEST `77f80fec → f95bdcf8`（完整前缀 fnv1a32-utf16），LOOT_REPLAY_DIGEST 不变；schema7/save3/replay3/command3 保持。新旧快照不可混用；没有静默迁移。

```ts
type CarouselSeatResult =
  | {ok:true;pool:SharedPoolState;carousel:CarouselState;state:MatchState;events:readonly (MatchEvent|CarouselEvent)[]}
  | {ok:false;pool:SharedPoolState;carousel:CarouselState;state:MatchState;reason:CarouselFailure;events:readonly (MatchEvent|CarouselEvent)[]};
createCarouselMatch(seed?:number):MatchState;
opensCarousel(state:MatchState):boolean;
schedule(roundId:string):{firstBatchMs:number;batchIntervalMs:number;tailMs:number};
pickCarouselForSeat(pool:SharedPoolState,carousel:CarouselState,match:MatchState,seatId:string,slot:number):CarouselSeatResult;
autoPickCarouselForSeat(pool:SharedPoolState,carousel:CarouselState,match:MatchState,seatId:string,reason:'bot'|'disconnected'|'timeout'):CarouselSeatResult;
listCarouselSlots(state:CarouselState):{slot:number;definitionId:string;starLevel:1;items:string[];pickedBy:string|null}[];
restoreCarousel(input:unknown):CarouselState;
restoreCarouselSeat(carousel:CarouselState,input:unknown):MatchState;
resolvePendingCarouselUnits(pool:SharedPoolState,match:MatchState):SharedPoolResult;
sellPendingCarouselUnit(pool:SharedPoolState,match:MatchState,unitId:string):SharedPoolResult;
```

`completeCarouselForSeat` 和 `releaseCarouselParticipant` 均为 `(state:CarouselState,match:MatchState,seatId:string)`，返回 `{ok:true,state:CarouselState,match:MatchState,events:readonly MatchEvent[]}` 或 `{ok:false,state:原盘,match:原席,reason:CarouselFailure,events:[]}`。`releaseCarouselSeat(state:CarouselState,seatId:string):CarouselResult` 只处理尚未授予的预留。`validateCarousel(state:CarouselState):void` 为抛错的只读校验。队列两个 SharedPoolResult 入口沿已有共享池失败枚举，阶段不合法时 resolve 返回 invalid-seat-state，sell 返回 unknown-unit；不会借此开放战斗期出售。

原子 pick/autoPick wrapper 的 events 按顺序包含完整 CarouselEvent（picked、可能的 closed）及带 Match 序号的发奖事件，不丢弃底层关闭/池返还事件；服务器同时保存这些事件和返回状态。complete/release 的返回仍按上文声明。

`releaseCarouselParticipant` 另返回 `poolEvents:readonly SharedPoolEvent[]`，events 为 `readonly (MatchEvent|CarouselEvent)[]`，保留 sharedSeatReleased 和 carousel-seat-released；重复淘汰返回两个空事件数组。失败也返回空 poolEvents。

适用窗口（2026-10-16 澄清，规则代码未变）：`releaseCarouselParticipant` 只在盘仍为当前池的事务基准时使用，即盘 `open` 期间的参与席淘汰。盘关闭且收据全为 granted、池已经 complete/nextSharedRound 推进后发生的淘汰，只调用 `releaseSeatOnElimination(pool,match)`：选秀单位已在 holdings 中，随该席全部归还，池守恒成立；该席池收据保持 `granted` 作为历史出生记录，不改为 released，不另发 carousel-seat-released。此时以旧 CarouselState 调 `releaseCarouselParticipant` 会因旧池与当前席状态不一致返回 `invalid-match`，不改变任何状态。回归见 `tests/p7-1-carousel-rules.test.ts`「eliminated after the 2-4 carousel closed」。

### SR-G2-01：技能展示纯函数（G2-2 工作分支）

模块 `src/simulation/ability-display.ts`：

```ts
interface AbilityDisplayStats {
  readonly abilityPower?: number;
  readonly attackDamage?: number;
}
function abilityDisplayName(definitionId: string): string;
function abilityDisplayValues(
  definitionId: string,
  starLevel: StarLevel,
  stats?: AbilityDisplayStats,
): Readonly<Record<string, number>>;
```

`abilityDisplayName` 返回锁定 CDragon 原始英文技能名，不猜中文译名。
`abilityDisplayValues` 返回源变量及计算后占位符的值；键不含两端 `@`，包括
`PercentShieldDamage*100` 等完整表达式键，界面无需乘法。默认攻击力来自
`getUnitStats(definitionId, starLevel)`，法强为 100；可显式传入整数 AD/AP（0–1000000）。
不含装备、羁绊、永久成长、护甲减伤或暴击；生命值仍为该星级基础生命值。
技能系数先按规则量化，再将 AD/AP/生命项合并向下取整；未纳入内容的单位不支持。

本次已实现原有19名与新增内容共48名英雄的1–3星数值占位符。Rumble 的升级名称字符串占位符不属于数值函数。`TotalDamage` 遵守源文案的
单发/单目标含义，例如麦迪是每颗子弹，不能再次乘发数后填回同一占位符。
范德的额外伤害为每个低费队友的增量；小炮累计成长默认 0。
婕拉和厄加特的实验体字段仅供原始文案解析，数值来自源字段，**不表示该羁绊已启用**；
界面应将相应 `enabled=TFT13_ExperimentActive` 分支标为未启用或隐藏。
`S13_ABILITY_DATA[abilityId].name: string` 同步公开锁定源技能名。47名英雄全模板占位测试覆盖三档星级；Rumble保留未启用的专属升级字符串分支。

失败统一抛出 `RangeError`，原因包括未知/暂缓准入单位、无效星级、无效 AD/AP、
已声明公式缺源变量。不以 0 填补缺失源数据。返回对象冻结；函数不修改状态、
不消耗 RNG、不读真实时间。

### G2-2 有限内容合同（历史，已由顶部G2-3节覆盖）

48英雄/14羁绊，15新英雄名单、每源字段与全部近似见 `docs/evidence/g2-2/RECONCILIATION.md`。学院不发永久装备；征服者不产生宝箱。极客只在战斗编译时临时替换散件，不改装备账本、不消耗 RNG；外交官仅恰好1或4名生效。CombatInputBasis.inputs.roundResults 保存开战前胜场权威历史，恢复与已验证历史前缀逐项相等。联机由 `snapshotForBattle` 从本席权威 roundResults 冻结 `priorPvpWins`（同一 `priorPvpWins()` 口径），见 MULTIPLAYER_CONTRACT §10.11。旧身份拒绝恢复，历史夹具只读保留。

### P7-1 正式修订（覆盖本节旧开局/排队语义）

来源和规则见 S13_RULES_GAP §11.4。`createCarouselMatch(seed?:number):MatchState` 恢复 shared-deferred 的免费艾瑞莉娅与既有经济；不再创建 1-1 前奏。`opensCarousel(state:MatchState):boolean` 仅对五个 x-4、启用选秀且本轮尚无领取收据返回 true；`schedule('1-1')` 抛 `RangeError('invalid-round')`，`createCarousel` 对该 ID 原子返回 `invalid-round`。`CarouselRoundId` 暂保留 `'1-1'` 输入类型，以便未叠服务器 PR 的代码可编译，但它不是合法运行时回合；不用于生成概率或日程。

字段和导出变更：

| 项 | 本次处理与接线要求 |
| --- | --- |
| `carousel.openingPending` | 从新运行时状态删除；不生成 true/false，不再以它判断选秀。仅保留可选 TS 成员供旧服务器读取时编译，恢复若出现此字段即拒绝。Opus 删除 1-1 专用分支，改按 `opensCarousel` 判断。 |
| `carousel.heldCarouselUnits: readonly HeldCarouselUnit[]` | 新规范状态；每项 `{receiptId:string,unitId:string,definitionId:string}`，只包含两处都满的临时位。单位无 location、恒为 1 星，不进 preparation/combat 阵容。 |
| `PrivateSeatView.heldCarouselUnits` | 新本席投影，独立复制上述三字段；其他席不发送。 |
| `PrivateSeatView.pendingCarouselUnits` | **本次删除并改名为 heldCarouselUnits**，旧客户端需同步更新读取处。 |
| `carousel.pendingUnits` / `PendingCarouselUnit` | 为尚未叠加的服务器出售/自动迁入适配暂留的废弃别名；分别严格等于 heldCarouselUnits / HeldCarouselUnit，绝不是“备战席一满就排队”。恢复和池检查拒绝两个数组分叉；Opus 应改读规范字段，后续可删别名。 |
| `carousel.preparationReceipts: readonly string[]` | 新字段，记录已进入下一准备期处理的 carousel receipt ID；唯一且与 provenance 事实一一对应，包括仍无位置/已经售出的选秀卡。 |
| `resolvePendingCarouselUnits` / `sellPendingCarouselUnit` | **保留导出名与函数签名**，为现有服务器接口兼容；分别改为迁入临时位/出售临时位。无导出函数删除。 |

`nextRound`/`nextSharedRound` 自动在下一准备期入口（choice 之前）迁入并结算合星；共享池按同一事务折叠升级来源，事件/池/全部席位一并提交。之后准备期出售腾空、部署腾空或 `buyXp` 升级人口，服务器调用 `resolvePendingCarouselUnits(pool,match):SharedPoolResult`，并发布返回 pool/state/events。同轮 x-4 的 receipt 未离场时该调用成功原对象零事件，不提前合星；战斗锁定或非 preparation 为 `invalid-seat-state`。无位置成功原对象，不自动出售。顺序 receiptId；先迁入，再沿既有递归合星与装备/异常/成长转移规则释放位置，继续可迁入者。

`sellPendingCarouselUnit(pool,match,unitId):SharedPoolResult` 只在 preparation 且未锁定时出售 held 单位，按既有 1 星费用发金并归池一次，装备留库存。未知/已售/非 preparation/锁定为 `unknown-unit`；输入池/席位损坏为 `invalid-seat-state`。`resolvePendingCarouselUnits` 损坏或无选秀元数据为 `invalid-seat-state`。两者失败必须返回原 pool/state、不消费资源/RNG；SharedPoolResult 的失败分支沿既有类型无 events 属性。

新增 Match 事件 `{type:'carouselPreparationSettled',receiptIds:readonly string[],claimedUnitIds:readonly string[]}`；保留 `carouselPendingClaimed` 作为兼容的迁入事件名，另有既有 unitUpgraded/装备转移事件。它们统一加 domain/eventSeq。来源事实 `{kind:'carousel-preparation-settled',receiptIds,claimedUnitIds,upgrades}` 与元数据收据一起持久化；收据只能在原 x-4 之后的 round ordinal 出现且不得重复，晚迁入不再次发行选秀结算收据。重复 step、恢复、grant/resolve 均无二次出生/结算。可信 `restoreCarouselSeat` 增加别名一致、临时位身份及 preparationReceipts/事实的唯一性核对；离线 restoreMatch 仍拒绝服务器元数据。

CONTENT `22f31569 → bb66f4f8`（均 fnv1a32-utf16），LOOT_REPLAY 保持 `028e5593`；规则字符串 s13-g2-2-v1 与 schema/save/replay/command 7/3/3/3 保持，选秀政策 revision=p7-1 纳入 CONTENT。旧客户端字段不兼容，由服务器/界面配套 PR 接线后共同发布。

## W4：30 强化目录（2026-10-16）

本批由用户批准扩容原六项到30项，完整来源、14.24b覆盖及未入库候选见
[evidence/g2-augments/RECONCILIATION.md](evidence/g2-augments/RECONCILIATION.md)。
旧六项保留，原目录历史证据不覆盖。新规则身份为 `s13-g2-2-aug30-v1`、
内容身份为 `s13-14.24b-g2-2-aug30-v1`；仅 CONTENT digest 改变。
LOOT_REPLAY、schema/save/replay/command 7/3/3/3、NET_PROTOCOL 3 不变。

- 仍在2-1、3-2、4-2提供三选一，使用现有排序池无放回抽取，精确消耗3个LCG字。
  没有取得可锁定14.24b普通模式的官方分层概率，证据等级 **U**：沿用等权候选池；
  tier只标注内容级别，不擅造银/金/彩概率。算法及tier表冻结在content并进入digest。
- 非法choiceId、generation、definitionId失败返回原state，不耗RNG、不发事件或收据。
  Placebo+使用与Placebo同一通用acquisitionGold效果与唯一schedule receipt，选择时一次入账；
  step、重复命令或恢复不再次运行授予，恢复逐项验证receipt.gold与对应内容效果。
  不改基础收入、经验、商店、选秀或日程。
- 静态条件从已有冻结开战输入编译。Pumping I沿用经校验的pumpingRounds；II/III从各自acquiredRound到当前轮之前的
  已完成战斗日程计数（排除supply、包括联机加时），单人/双边共用，无历史副本。
  Blistering Strikes仅普攻命中目标施加5秒灼烧（每秒1%最大HP）及33%重伤。
- Item Collector对全队上场单位实际穿戴的唯一definitionId计数（含散件、成装、
  临时装备；板凳/库存不计，重复definition只计一次）。Lineup与Collector的半点数值
  用整数百分之一保存，先汇总所有flat贡献，再合并百分比并最终向下取整，不能每项先舍入。
- Bronze For Life仅计CDragon `style=1`档位；Family无铜档，Emissary 1人为铜/4人为金，
  不把最低实现门槛一律视为铜。Built Different只有自身所属羁绊均未激活才生效。
- 未给精确几何/时长的部分为项目约定（U）：Find Your Center为己方4行区域前向中间格
  `(col=3,row=5)`；最近友军等距离按unitId排序；
  Inspiring Epitaph盾持续本场至tick1201，独立死者可叠盾及攻速。
- Clockwork在60、120…tick生效，tick0不额外触发；Lone Hero只有一名存活友军时生效。
  Climb/Inspiring由实际死亡批次驱动，同批先确认全部死者再挑存活收件者，重复处理不重发。
  动态效果使用既有来源绑定status/shield持久态，不增加跨调用缓存；恢复验证来源、系数、
  时间及适用资格，不重新执行钩子。

UI继续消费现有ChoiceDefinition字段；无新增预览或界面字段，本批不修改表现层。

恢复边界：沿用现有快照结构校验，不宣称完整命令历史证明。死亡强化会拒绝来源、系数、
数量、四项/两项贡献完整性及时间不一致；但快照未保存独立死亡时刻收据，联合把同一死者
全部贡献改为另一个合法较早tick，结构校验不能独立排除。本批不新增死亡日志权威。

同族组合（U）：Glass Cannon初始损失生命百分比按相同统计口径相加，I+II均损失20%，
合计从60%最大生命开始，增伤12%+20%=32%；Bulky各来源独立发盾，Manaflow额外法力相加。


### OPENING-R1 奖励随机口径（2026-10-16）

按用户 2026-10-16 决定维持随机：1-2/1-3 的英雄奖励各从原五个老一费 `darius/irelia/lux/maddie/zyra` 等权抽取；恢复 multiplayer 基线的掉落随机流、候选顺序、拒绝采样及消耗次数。1-1 每席随机一费起手保持 PR #126 现状，费用相同、允许重复。沿用本 PR 首次提交的 CONTENT/LOOT_REPLAY digest 和版本号，本次不再 bump。

## G2-3 机制通用接口（2026-10-16，Claude 一次性代做，供 Codex 接入）

用户 2026-10-16 决定：联机所需的通用接口由 Claude 先做，Codex 在 G2-3 里把征服者、学院、炼金男爵、机械公敌、试验格、光明转化、形态英雄、召唤物接上。本节只定接口，不加任何英雄、羁绊、异常或装备；现有内容下对局结果、CONTENT digest、版本号和夹具都不变。统一导入点 `src/simulation/seat-mechanics/index.ts`。联机视图与回放线格式见 MULTIPLAYER_CONTRACT §25。

### 1 席位机制容器

```ts
MatchState.seatMechanics?: SeatMechanicsState   // 没有机制写过时不存在
interface SeatMechanicsState {
  version: 'g2-3-seat-mechanics-v1';
  seat: Record<string, MechanicJson>;    // 本席可见，原样进入联机视图
  hidden: Record<string, MechanicJson>;  // 只在权威侧，永不发给客户端（RNG 字、未来候选）
  receipts: MechanicReceipt[];           // 只追加的收据，本席按 kind 白名单投影
}
readSeatMechanic(state, key) / readHiddenMechanic(state, key)
writeSeatMechanic(state, key, value | undefined) / writeHiddenMechanic(...)   // 纯函数，undefined 删除
appendMechanicReceipt(state, receipt) / findMechanicReceipt(state, receiptId)
```

- 值只能是纯 JSON，数字必须是安全整数（百分比用 bps），写入和恢复都会校验，不合格抛 RangeError。
- 预留键：`conqueror`、`academy`、`alchemist`、`junkerKing`、`experimentCells`、`radiantConversion`。G2-3实际形状（全部owner-only；这里只列结构，数值口径见顶部）：
  - conqueror `{stacks, chestsOpened, receipts, rewards}`：永久征服进度/战斗去重事实、已获得奖励包；15档阈值从内容表查询
  - academy `{sponsored: string[3]}`；已发物品按`g23:academy:*`身份或source=academy读取；身份与来源必须同时匹配，改source不能跳过资格校验
  - alchemist `{shimmer, losses, skips, offeredThrough, offer}`；offer是已抽出的当前机会，不是未来候选
  - junkerKing `{rounds, purchases:[{id,round,unitId,upgrade,cost}]}`；购买映射必须与对应choice收据一致
  - experimentCells `{col,row}[]`
  - radiantConversion `boolean`（第15档生效后true）
- 凡是影响界面显示或客户端选择器（羁绊、属性、previewCombine、previewEquip、getDeploymentCap）的状态都放 `seat`；客户端拿不到 `hidden`，选择器不能读它。
- 需要界面播提示时，同一命令里发 `{type:'seatMechanicChanged', key}` 事件。
- `restoreMatch` 只做结构校验（`validateSeatMechanicsState`），各机制自己的不变量由 Codex 补进恢复校验。

私有视图的 `seatMechanicsView(state: MatchState): SeatMechanicsState | undefined` 保留 `seat` 的公开 JSON，`hidden` 固定为空；收据只复制 `receiptId/round/roundId/source/kind` 和各类型已定义字段：gold 的 amount；unit 的 definitionId/resolution/unitId/gold/可选 orbId、starLevel；consumable 的 definitionId/consumableId；item 的 definitionId/itemId；choice 的 choiceKind/optionId/skipped/price/itemId/timedOut。PvE 拆卸器同样走 consumable 分支，额外字段不投影。返回数据与输入无共享可变引用；不改命令签名、失败原因或存档收据。

### 2 发放与收据（每个 receiptId 只发一次）

```ts
grantMechanicGold(state, {receiptId, source, amount})
grantMechanicItem(state, {receiptId, source, definitionId})
grantMechanicUnit(state, {receiptId, source, definitionId}, unitLootPolicy?)
  -> {ok:true, state, events, receipt, upgradeEvents} | {ok:false, state, reason}
reason: 'duplicate-mechanic-receipt' | 'bench-full' | 'invalid-mechanic-state'
```

- `source` 是自由文本的来源名，例如 `conqueror-chest`、`high-roller`、`academy`。保留拆卸器/重铸器的收据为`{kind:"consumable",consumableId,definitionId,...identity}`；其库存序号与消耗事实同样按唯一收据验证。收据记录 round、roundId、source，这就是战斗中金币和开箱金币的"金币来源"，界面按 round 分组显示。`incomeBreakdown` 不改。
- events 未盖序号，含 `mechanicGranted{receipt}` 和英雄入席时的升级事件，由调用方所在命令的 accept 统一盖 eventSeq。
- 物品和英雄的来源事实是 `{kind:'mechanic', receiptId}`，单人存档恢复按收据核对出生。
- **共享卡池**：原有给玩家发英雄的路径只有商店购买和 PvE 掉落（rewardPolicy），没有通用路径，所以新增 `grantMechanicUnit`。联机时必须传入命令闭包里的 `policy`（`runSharedMatchCommand` 给每个命令的那个 UnitLootPolicy）：池里有副本就扣一张并入席，池空就按英雄费用折成金币（收据 `resolution:'gold'`），与 PvE 英雄掉落一致。备战席满时在动卡池前就返回 `bench-full`，什么都不变。成功结果必须在同一命令里提交，否则卡池守恒校验会失败。
  - 只能发商店目录里的英雄或带 `summon` 标记的召唤物。
  - 注意：`settleRound` 已在shared-pool.ts把同一闭包policy传入applyRoundSettlement，再传到commitG23Settlement的逐副本grantMechanicUnit；满席保留托管，池空金币写unit收据。
- 单人存档：`RoundResult.mechanicReceiptPrefixLength`冻结进入经济结算前的通用收据前缀，且与CombatInputBasis同名字段核对。结算当前gold=goldAfter+掉落容量售出金币+前缀后本轮机制净金币（gold.amount、unit.gold、减choice.price）。准备期费用/金币已在goldBefore，不再加减一次。恢复同时核对经济历史与机制收据关联。

- 存档一致性 A2/A4/A5：首次构造 G23 DTO/atoms 之前，先按经济收据中的轮次、结算身份与事实重推完整奖励包，核对 id、round、source、tier、reward；atoms 只遍历匹配的冻结表项，不按存档数量展开。
- 学院赠装和拾荒者选择成功后，在 `seatMechanics.hidden.grantEvidence` 逐条记录 `{receiptId,round,resourcePrefixLength,mechanicPrefixLength,economyPrefixLength,level,units}`。快照取授予/选择前，units 为当时持有者的实例、定义、星级、队伍与部署位置；不投影给客户端。
- 恢复时独立折叠资源前缀并核对快照，校验轮次、前缀顺序、部署合法性、位置唯一性与容量。学院须满足当时 3/4/5 羁绊资格且下一资源事实恰为该物品出生；拾荒者用 seed、已验证购买前缀和当时最强 Rumble 重建菜单，核对 unitId、选项、3 星 titan 及超时默认项。当前单位售出/合星不改历史资格；冻结战斗 DTO 的购买记录须与已验证记录一致。
  - 含学院授予证据的普通存档也必须重放历史装备绑定并检查授予时的部署资格；已有结算、未携带外部战斗回放或没有 D14 进度均不能跳过此项。对象、JSON 和序列化入口执行相同检查。
- 相关收据缺少上述新证据即拒绝读取，不迁移、不补造；未触发这些授予的存档不需要空证据字段。规则数值、内容 digest 和各版本不变。
- 已知边界（约定）：拾荒者购买没有资源出生事实，`resourcePrefixLength` 只要求落在该轮资源窗口内且单调；选择期间允许交易，窗口内任一前缀都对应一条合法操作顺序。没有经验购买账本，`level` 只限在 `[上一轮 levelAfter, 本轮 levelBefore 或当前等级]`。部署位置只要求合法、互不相同且不超容量。

### 3 新的选择类型：锻造器、黑市、军械库

```ts
PendingChoice.kind += 'forge' | 'blackMarket' | 'armory';   PendingChoice.payload?: MechanicChoicePayload
openMechanicChoice(state, {choiceId, offers, payload, returnPhase}) -> {ok, state, events} | {ok:false, reason}
CHOICE_SKIP_OPTION = '@skip'
```

| kind | offers | payload | 选中效果 |
| --- | --- | --- | --- |
| forge | 物品 definitionId | `{kind, source, timeoutOption}` | 该物品进库存 |
| blackMarket | 物品 definitionId | `{kind, source, skippable, skipReward:{kind,amount}\|null, timeoutOption}` | 选物品则进库存；`@skip` 不给物品，收据 `skipped:true` |
| armory | 机制选项 id（不是物品） | `{kind, source, prices:{[option]:gold}, timeoutOption}` | 扣 `prices[option]` 金币，只记收据 |

- 打开：和强化一样是阻塞选择（用户已定军械库也这样），界面可以先收起，不选完不能离开选择阶段。`returnPhase` 必须等于当前阶段：`preparation` 在准备阶段开，`settlement` 在结算阶段开并保留战斗结果。补给回合和已有待选时拒绝（`wrong-phase`）。choiceId 不能和已有收据重复。
- 玩家操作复用 `choose`（`selectChoice(state, choiceId, generation=0, optionId)`）。黑市跳过就是 `optionId='@skip'`，不可跳过时返回 `choice-not-skippable`。军械库钱不够返回 `insufficient-gold`。失败返回原 state，不耗资源和 RNG。
- 选完写一条收据 `{kind:'choice', receiptId:choiceId, choiceKind, optionId, skipped, price, itemId, timedOut}`，发 `choiceSelected` 和 `mechanicGranted`，然后按 returnPhase 继续本回合日程（与强化选完后一样）。效果由机制自己读收据：已购升级就是 armory 收据列表；跳过收益由炼金男爵按 skipped 收据计算。
- 超时：`forfeitPendingChoice` 选 `payload.timeoutOption`，事件 `choiceTimedOut{resolution:'default-option'}`，收据 `timedOut:true`。军械库的 timeoutOption 价格必须是 0（免费"备用零件"），打开时校验，所以超时永不扣钱；黑市可以用 `@skip` 当超时项。所有领域黑市候选使用blackMarket的`grantItem:false`，offers为各源奖励包apiName；通用层只记接受/跳过收据，不造占位物品，领域层发包内英雄/有限复制奖励。默认不带此字段仍按物品选择运行。
- 机器人：`decideBotAction` 对新 kind 直接选 timeoutOption。Codex 可以以后换成更好的策略。
- 存档：`restoreMatch` 接受待选的新 kind（`validateMechanicPendingChoice`）。

### 4 形态英雄与召唤物标记

- `UnitDefinition.formSwap?: true`。`resolveUnitForm(definition, team, location, board?)` 和 `getUnitForm(unit)` 返回 `'melee' | 'ranged' | null`：本方部署区离敌方最近的两排是近战，后两排是远程；备战席和普通英雄为 null。用户已定：开战时按站位定形态，战斗中不切换。
- `CombatUnit.form?`：Codex 在开战快照里按 `getUnitForm` 填写并据此选那套属性和技能；回放单位视图带 `form`。
- `UnitDefinition.summon?: {sellable, countsTowardPopulation}`。`sellable:false` 时卖出返回 `unit-not-sellable`；`countsTowardPopulation:false` 时 `getPlayerDeploymentCount` 不计它，人口上限检查随之放宽。召唤物不进共享卡池：守恒校验的棋盘名单和 reconcileHoldings 会跳过它。若机制创建准备资产，必须用grantMechanicUnit；本批Sion/Forge仅在Combat入口由spawnCombatUnit生成，不进入准备资产、卡池或备战席。三只同名召唤物会被现有合星逻辑合并，Codex 需要用不同 definitionId 或别的放置方式避免。

### 5 物品

- `ItemDefinition.kind += 'radiant'`，并加 `radiantOf: <成装 id>`。内容校验要求光明装备没有配方、`radiantOf` 指向成装、每件成装最多一件光明版。`radiantVersionOf(id)` 和 `isRadiantItem(id)` 供转化与界面使用。重铸、选秀、临时装备池默认不含光明装备。
- `ItemDefinition.restriction?: {kind:'trait', traitId}`。穿给没有该羁绊的单位时，`previewEquip` 和 `equipItem` 返回 `item-restricted`（黑市装备只给炼金男爵）。
- 按用户决定，神器、辅助装、战术家之冠、窃贼手套、锻造器、复制器这批不做；征服者奖励里这些先按源表金币估值折成金币，用 `grantMechanicGold` 发，对账表标"约定值"。

### 6 战斗中途出现的单位与新战斗事件

```ts
spawnCombatUnit(state, unit, source, tick) / removeCombatUnit(state, unitId, reason, tick)
castOutcomeEvent(tick, unitId, abilityKey, outcome, subOutcomes?) / bindingChangedEvent(tick, unitId, bound, reason)
```

- 新账本事件（已并入 CombatEventData 和 M8CombatEvent）：`unitSpawned{unitId, definitionId, team, cell, source}`、`unitRemoved{unitId, reason}`、`castOutcome{unitId, abilityKey, outcome, subOutcomes}`（High Roller 的火箭、护盾、金币、三连）、`bindingChanged{unitId, bound, reason}`（赛恩束缚和挣脱）。帮助函数返回未盖序号的事件，放进当前 tick 的事件列表，由 `stampCombatStep` 统一盖号。
- `spawnCombatUnit` 只把已算好属性的单位追加到 `state.units` 末尾，并检查 id 不重复、格子在棋盘内且没有存活单位。回放按这个顺序比对，插到中间会抛 `replay-divergence`。
- 回放每 tick 自动比对单位名单，生成 `unitEntered{unit}` 和 `unitLeft{unitId}`，`applyCombatReplayTick` 接受新单位，不用等关键帧。
- `eliminationResult` 仍按存活单位判胜负。火药桶这类不该撑住阵营的召唤物，Codex 需要在判定里排除或战斗结束前移除。
- High Roller 掷到金币时，Codex 在战斗结算处用 `grantMechanicGold`（source `high-roller`，receiptId 带 combatId 和施法序号）发放，保证重复 step 不重发。

### 7 新失败原因

`MatchFailure += 'unit-not-sellable' | 'item-restricted' | 'choice-not-skippable' | 'duplicate-mechanic-receipt' | 'invalid-mechanic-state'`；`EquipmentFailure += 'item-restricted'`（界面已有中文）。

### G2-3 收尾修订（v2）

Power Absorption 吸收的固定 AD 在普通百分比 AD（含永久成长及动态贡献）之后相加，不再被放大；来源为14.24官方公告 bugfix，链接及原文见 `docs/evidence/g2-3/EXTERNAL_SOURCES.md`。每个已死友军仍只吸收一次。征服者保持基础羁绊加成 ×(1+5%×箱数) 的线性实现。

取得 Junkyard Titan 后后续军械库只给免费 Finishing Touch，不再付费购买已包含的升级。刷新当前军械库须同时匹配 kind='armory' 和 choiceId；其他待选奖励不能覆盖它。形态统一使用 `seat-mechanics/forms.resolveUnitForm`。

恢复时先校验机制收据结构；损坏统一拒绝为 `Invalid Match save`。`combat.removedUnitIds` 如存在必须为无重复字符串数组，并与现役 combat.units 的 ID 分离。自动钩子失败事件及隐藏输入边界见 MULTIPLAYER_CONTRACT §25。schema/save/replay/protocol 不变；rules/content 升至 G2-3 v2，旧 digest 严格拒绝，不迁移。

## G2-4B 神器锻造器领域合同（2026-10-17）

本节覆盖历史征服者延后清单与版本号。基于 #147 `d3112d6` 开发，合入 multiplayer `0cdd6eb`（含 #149 辅助装、#153 不稳定宝箱、#157 冠冕胜利掉金）后 rules/content 升至 `s13-g2-3-v8` / `s13-14.24b-g2-3-v8`；policy `g2-4b-artifact-forge-v8`。schema7、存档3、回放3、命令3不变；旧版本/digest 拒绝，无迁移。

- 第10档650：神器锻造器，移除14过渡金。第14档1200：随机光明装备1件（沿用35件池）、50金、神器锻造器、拆卸器。第11档仍15金、第13档仍拆卸器+50金（辅助装锻造器与指定辅助装仍延后）；第12/15档冠冕已由G2-4a恢复。
- `g23RewardAtoms(bundle, seed)` 对 `TFT_ArmoryKeyOrnn` 使用源29件与已实现21件交集；四选一、按ID排序等权无放回、不同窗口可重复、不排除已拥有物品。`TFT_ArmoryKeySupport` 仍拒绝，禁止落入任意其他池。全池与排除项、算法声明进入内容digest。
- `openG23Choice(state)` → `{state,events}` 复用 `pendingChoice.kind='forge'`，`payload.source='conqueror'`、`timeoutOption=offers[0]`。第10档choiceId为 `g23:conqueror:10:atom:0:copy:0`；第14档为 `g23:conqueror:14:atom:1:copy:0`。光明装备不是锻造器，不新增光明选择。
- `selectChoice(state, choiceId, generation, definitionId, policy?)` 与 `forfeitPendingChoice(state, round, choiceId, generation, policy?)` 签名不变。选择免费，发一件永久库存物品并写唯一 `MechanicReceipt{kind:'choice',choiceKind:'forge',source:'conqueror',price:0,skipped:false,timedOut,...}`，资源来源为该receiptId。超时只领取首项，不再抽签。
- `claimG23Reward(state, atomId, definitionId, policy?)` 不绕过forge：多选item原子返回 `stale-choice`，无状态、资源或RNG变化；非准备阶段仍优先 `wrong-phase`。选择命令的 `wrong-phase` / `stale-choice` / `invalid-choice` 等既有失败语义不变，枚举以领域类型为准。
- `validateG23Restoration(state, parsedJsonInput=false): void` 抽出既有G23恢复链供 `validateB8Resources` 调用，重演来源奖励/进度并重建完整pending choice；校验选择收据类型、来源、免费/未跳过、超时首项、合法选项与副本序号，异常抛RangeError。调用方仍须验证外围结构和资源账本。恢复不发奖、不修改活跃随机流；它不让单人 `restoreMatch` 接受联机状态。
- `completed-reforger` 仍只允许普通36件成装，拒绝神器/辅助装；无需更改现有池成员保护。辅助锻造器只有计划接口，本批没有装备消耗品、时间参数或第二份选择账本。

来源、约定编号与依赖见 [实施计划](evidence/g2-4/G2-4B-FORGES-PLAN.md)，验证边界见 [交付记录](evidence/g2-4/G2-4B-ARTIFACT-FORGE.md)。

### G2-4b 不稳定的宝箱：战斗中途获得装备（v6）

约定值与来源见 [SUPPORT_ITEMS.md](evidence/g2-4/SUPPORT_ITEMS.md) 的 G24-CHEST-01…04。随 #149 的 rules/content `s13-g2-3-v6` / `s13-14.24b-g2-3-v6`、policy `g2-4b-support-v6` 合入，本项不另升版本，只改内容摘要；schema7、存档3、回放3不变，旧 digest 严格拒绝。

- 新战斗事件 `combatItemGranted{tick, unitId, definitionId, source}`：`unitId` 是受益者，`definitionId` 是获得的成装，`source` 是宝箱来源（持有者、物品实例、效果序号）。已并入 CombatEventData 和回放视图（回放里 `sourceId` 为持有者）。同一 tick 紧随其后可能有该受益者的 `maxHpChanged`、`manaChanged`（原因 `item-granted`）和开战类效果事件。
- 新单位字段 `CombatUnit.combatItemGrants?: {chest: Source, ordinal, definitionId, grantedAtTick}[]`：只记获得事实，装备程序由冻结池派生，不进 `itemPrograms`、不占装备格、不进库存，战斗结束即失效。
- 新声明词汇：效果 `grant-combat-item`（`policyId: 'G24-CHEST-01'`, `lifetime: 'combat'`），选择器排序 `hp-ratio-desc-id`（生命比从高到低，并列按 id）和选择器开关 `excludeSummons: true`（不选召唤物和建筑），法力请求原因 `item-granted`。
- 恢复：先核对获得记录（形状、池内装备、tick、持有者已阵亡且宝箱触发过、同一宝箱序号 0…n−1 且受益者不重复、不超过 4 件、不发给召唤物），再按记录重新编译受益者的机制并照常逐项核对；任何损坏统一拒绝为 `Invalid Match save`。
- 界面与服务器暂不消费此事件；装备图标另做。

### G2-4b WIP item-gold settlement bridge

`G23BattleFacts.itemGoldPayouts?` contains validated positive item receipts with
`{receiptId, source:'g24-item-gold', amount:1}`. Identity encodes battle, combat
owner, item instance, trigger kind and ordinal. `advanceG23Economy` accounts for
these payouts; `commitG23Settlement` grants each through the generic mechanic
receipt exactly once. `validateG23MechanicLinks` checks both directions between
facts and grant receipts. Trigger authenticity/RNG reconstruction belongs to
the combat adapter, still WIP; arbitrary input facts are not an authority.

Gambler adds optional `CombatStrategyInputs.bankGold` and private
`PlayerBattleSnapshot.bankGold` only when its item is present. The former is
validated against the current balance or current settlement's goldBefore;
the latter is captured from the owning seat by snapshotForBattle.
`StrategyUnitSnapshot.openingItemBankGold` is capped30; combat's current bank
adds own-side earned receipts up to that cap. No combat payout is spendable
until the existing settlement transaction commits it.

### G2-4b WIP — movable portal summon

`readItemSummons(state:MatchState):ItemSummonOrigin[]` derives owner-visible
preparation summons from equipped portals. `moveItemSummon(state,itemInstanceId,
cell:HexCell):MatchCommandResult` persists a portal's desired cell in the seat
mechanic `g24ItemPositions`; it accepts only an unlocked live preparation,
owned active summon and unoccupied friendly cell. Failures return unchanged
state, no event/RNG: wrong-phase, unknown-unit, outside-deployment-zone, occupied.
Success emits seatMechanicChanged. Ordinary hero movement into a projected cell
makes the summon relocate on next projection; a full half omits it. No permanent
unit or population is minted. Frozen solo inputs and two-sided snapshots capture
positions; restore rejects invalid/future item identities or frozen/current
position disagreement. UI/server command dispatch adapters are not implemented.


## G2-4B 辅助装锻造器预演合同（2026-10-17）

仅适用于 `codex/g2-4b-support-forge-trial`，覆盖上节11/13延后和Support拒绝描述；正式版本与夹具待合并顺序确定后统一更新。

- `resolveG24ForgePool(api: string): readonly string[]` 新准入 `TFT_ArmoryKeySupport`：固定源17件与已实现13件交集。`g23RewardAtoms(bundle, seed)` 沿用现有四选一采样；`openG23Choice(state)` 返回通用forge，不增命令或第二份账本。未知selector抛RangeError；内容初始化时池少于4件或重复ID抛RangeError，不降档、不折金。
- 第11档750只发辅助装锻造器，choiceId/receiptId=`g23:conqueror:11:atom:0:copy:0`；offers四个不同辅助装ID，超时首项，选择免费且只发一件。`selectChoice` / `forfeitPendingChoice` 参数和失败枚举不变；后者仍要求联机席位（否则 `multiplayer-required`）。多选原子不能用 `claimG23Reward` 绕过（`stale-choice`）。
- 第13档1000依源字段顺序发 `TFT_Item_ZekesHerald`、`TFT_Item_LocketOfTheIronSolari`、`TFT_Item_Chalice`，item收据依次为 `g23:conqueror:13:atom:0/1/2:copy:0`；拆卸器是atom3的consumable收据，20金为 `g23:conqueror:13:gold`。三件固定辅助装自动发放，不开三个选择窗口。移除11档15金及13档额外30金；其他档位不新增变更。
- 沿用 `validateG23Restoration(state, parsedJsonInput=false): void` 重建源奖励、选择及收据；旧折金、错池/错来源/错副本/空itemId收据拒绝，重复选择或结算不重发。联机领域恢复测试验证机制账本及G23边界；完整单人 `serializeMatch/restoreMatch` 测试另验证获取、装备、战斗中恢复与后续逐tick状态/事件一致，不放宽单人恢复对联机状态的限制。
- 普通36件成装重铸器继续拒绝辅助装输入，失败保持原state、资源、事件、RNG。复用G24-FORGE-01…08；界面约定名“辅助装锻造器”，联机和界面仍由Claude接。

详见 [预演记录](evidence/g2-4/G2-4B-SUPPORT-FORGE-TRIAL.md)。

## S13 P1 增补（部分交付，版本在集成时统一升）

本分支只增加六个强化和双刀流；余项未完成且不进入候选池，见
[evidence/s13-p1/RECONCILIATION.md](evidence/s13-p1/RECONCILIATION.md)。

- `readAugmentIncome(augments)` 纯查询返回 `{interestCap,roundXp,healthPerInterest}`；无利息优先于提高上限，提高上限取最大。遥遥领先选择一次15G，下一轮开始4XP，结算仍只发原自然XP，终局不提前支付未来轮次。
- `investmentGrowth(augments,roundResults)` 只累计获取后已结算的利息乘对应生命系数。I与II共用一份真实累计生命，不重复编译两次。
- `grantAugmentAcquisition(state,ownedAugment)` 返回状态与真实授予事件；重复调用固定收据不重复授予。便携4选1、光明5选1，经现有真实forge选择路由。未解决forge阻塞开战，G23既有待选优先，解决后再开forge。
- `augmentForgeOffers(seed,ownedAugment)` 使用独立显式派生LCG，不消费原三字强化选择流。池和抽样为项目既定有限目录约定，无新增官方分层概率。
- `grantAnomalyAcquisition(state)` 对双刀流授予两个真实成装；按原始目标角色固定候选、独立拒绝采样且无放回。项目约定：物品入库存、不改原装备。完整来源、额外legacy/召唤物角色约定及恢复边界见对账表。
- `traceBoundUnitIdentity(originalId,verifiedFacts)` 返回最终幸存者id或售出后的null。调用方必须先认证全部事实；它不独立证明击杀或增长，也不增加跨调用缓存。
- 失败命令保留原对象、ID、事件、金币与RNG；获取收据和资源出生同事务。新目录改变CONTENT digest，规则/内容版本仍按用户要求由Claude集成时统一升级。
## S13 强化 P2（14.24，B 补丁 raw 数值）

当前强化目录新增 14 项、异常目录新增 3 项；官方 API 身份与中文名对照见 [S13 P2 报告](evidence/s13-augments-p2/REPORT.md)。共 44 强化／33 异常，仍沿用现有三词强化抽样和单词异常抽样。此次不升版本，合并时统一升版；内容 digest 自动包含新增归一化源与赠品声明。

无新增客户端命令。`selectChoice(state, choiceId, generation, definitionId, unitLootPolicy?)` 的成功事务经现有来源账本发放赠品；`unitLootPolicy` 必须与同事务共享池策略相同。赠送物品到库存；赠送英雄正常合星，满席托管、池空按费用折金。后续卖出、领取与既有奖励重试复用同一确定计划，不重抽、不重发。失败命令沿用原对象／无副作用合同，新增内部赠品校验不改变失败枚举。

规则内部导出 `p2GiftPlan(state: Pick<MatchState,'seed'|'augments'|'multiplayer'>): Gift[]`、`drainP2Gifts(state: MatchState, policy?: UnitLootPolicy): MatchState`、`validateP2Gifts(state: MatchState): void`。赠品收据 `source='s13-augments-p2'`，ID 为 `[source,choiceId,'item'|'unit',index]` 的 JSON 编码；校验失败抛出 `Invalid/Missing S13 P2 ... gift ...`。这些不是新的客户端授权入口。

精心赋能、三项赛 II 与分享你的能量只修改战斗副本。联机冻结前的准备棋盘是双方羁绊和结算档位的共同依据；征服者／化学男爵收据仍逐项匹配当前棋盘档位，错误档位仍返回 `invalid-receipt`。服务器继续原样转发已有 `g23Facts`。

P2 赠品重试补充：`drainP2Gifts(state, policy?)` 按固定赠品计划循环，直到一整轮没有新增收据，因而后续赠品合星释放容量后会回头补发先前满席的赠品。单机成功部署后立即重试；成功购买后（包括购买合星）立即重试，`buyUnit(state, slotIndex, expectedGeneration, unitLootPolicy?: UnitLootPolicy): MatchCommandResult` 新增可选事务策略，`buySharedUnit` 透传同一次事务的策略。失败命令不重试、不写入。共享池部署目前没有策略入口，因此继续保留待领，不绕过卡池发英雄；需要服务器改为事务入口后才能即时重试。恢复不要求“有空位就必须收据齐全”。赠品恢复校验本次保持原样（M5 暂停）。

本包承诺数值与主要效果对齐；原版互斥（一费奉献 II ↔ 一对4、冕已有卫 ↔ 不是今天）不在本 PR 范围。

购买触发的 P2 重试与卖出入口沿用同一冻结边界：`phase === 'combat'` 或 `isCombatRosterLocked(state)` 时不重试；这些阶段释放的备战席容量不会触发可能合并棋盘英雄的赠品。下一次合法准备操作仍按原计划重试。

## v16：史诗奖励、复制器、统一重铸器（2026-10-20）

#265 方案 A：1–4阶段原法球先完成全部原内容抽取，再追加独立复制器抽签。派生种子为 `JSON.stringify(['orb-duplicator-v16', state.seed, orbId])` 的 FNV-1a UTF-16（初值2166136261，逐字符 XOR 后乘16777619取uint32），随后使用全新 lcg32-v1 拒绝采样 `%100`；各珠独立，棱彩及5阶段以后不执行。原 loot/layout/shop/choice 流均不推进，1-3/1-4原掉落保持v15；新增entry排在原珠内容之后。完整次序及抽样界限见 M8B_LOOT §11。

本节覆盖旧 R4 的两个重铸器及旧 5-7/6-7 奖励说明。完整冻结表、预算、RNG 次序、约定值与验收记录见 [EPIC_LOOT_V16](EPIC_LOOT_V16.md) 和 [M8B_LOOT §11](M8B_LOOT.md#11)。规则身份为 s13-g2-3-v16，内容身份为 s13-14.24b-g2-3-v16；旧存档严格拒绝，不迁移。schema7/save3/replay3/command4 保持。

公共命令 useConsumable(state:MatchState,consumableId:string,target:ConsumableTarget):MatchCommandResult 与 previewUseConsumable(state:Readonly<MatchState>,consumableId:string,target:ConsumableTarget):ConsumablePreview 签名不变。definitionId 仅 magnetic-remover、reforger、TFT_Consumable_ChampionDuplicator_III、TFT_Consumable_NeekosHelp；客户端传唯一实例 consumableId。target 的兼容联合仍接受 item 形状，但本版四种工具都只接受己方 unit 目标。成功 effect 是 remove-all / reforge-all / duplicate-unit；预览不抽随机结果、不授予资源。

失败全集：wrong-phase、unknown-consumable、temporary-item、unknown-item、unknown-unit、invalid-consumable-target、no-removable-items、bench-full；后两种旧兼容身份保留，空装备重铸返回 invalid-consumable-target，空装备拆卸返回 no-removable-items。复制器目标不合法/超过费用上限返回 invalid-consumable-target；满席一律 bench-full，包含本可能合星的情况。失败保持原对象、事件/资源/RNG/ID 全不变。满席约束仅复制器使用；普通奖励仍按原容量路径处理。

重铸按永久装备槽号升序处理全部装备，产物全部进库存；普通组件/成装分别从8/36池排除自身后等权抽样，光明/神器/辅助从各自已上线池抽，纹章或未知/无其他候选原物原ID退回且不抽RNG。临时战斗装备不进此数组；窃贼父件移除仍遵守原临时子件生命周期。成功每件随机换物分配新永久ID；原样退回不分配ID。收据 outputs[] 保存全部输出，output 保留首件兼容字段；copiedUnit 保存复制目标出生ID与定义，非复制用途为null；恢复重新验证来源、槽序、随机游标、输出和出生事实。

LootPayload 新增 {kind:'forge',definitionId:'TFT_ArmoryKeyCompleted'|'TFT_ArmoryKeyOrnn',quantity:1}。领域内部 epicForgeOffers(seed:number,receiptId:string,selector:string):readonly string[] 返回既有 G24 独立流的四个不同候选；openEpicForge(state:MatchState):{state:MatchState;events:readonly MatchEvent[]} 只开启现有 forge choice。客户端继续 selectChoice，不新增发奖入口。收据ID为 JSON ['epic-forge',lootReceiptId]，source=epic-loot；恢复必须绑定原锻造器领取收据与合法候选。单机6-7终局无法打开选择时沿用现有首候选策略，英雄保持 retained-terminal；重复step/恢复不重发。冠冕沿用现有永久人口+1路径，当前战斗只读冻结前缀中已存在的收据。

英雄复制器费用上限null，次级上限3；复制获得1星，随后沿用现有正常升星路径。单机直接授予；联机创建现有机制英雄法球，claimOrb时同一共享池事务扣库存，缺货折费用金币、满席按getUnitSellPrice折金。useConsumable仅消费工具并产生唯一来源事实，不另算卡池。

### v16 D14 专用异常

`selectAnomalyTarget(state,choiceId,generation,unitId)` / `selectChoice(state,choiceId,generation,definitionId,unitLootPolicy?)` / `rerollAnomaly` 签名不变。`ultimate-hero` 仅场上三星一费普通英雄；`into-the-unknown` 仅场上普通英雄。不合法目标返回 `invalid-target`、原 state，无事件/资源/RNG变化。v16历史目录56、联机排除avarice-incarnate后55；v17已恢复联机56，见顶部当前合同。报价按目标资格过滤，旧权重不变。

`MatchBase.d14?:D14Progress` 是私有持久状态；生产证书只由已接纳选择收据、资源事实与结算历史认证，不单凭存档 phase 授权。`readCombatStrategyInputs` 和 `PlayerBattleSnapshot` 可含 `d14Combat:{unitId,anomalyId,phase:'waiting'|'promoted'|'returned'}`，仅对可见绑定有效；离场单位不编入人口/羁绊/战斗。`restorePlayerBattleSnapshot` 结构校验，来源认证仍由上游可信 Match 完成；offline `restoreMatch` 继续拒绝联机完整存档。

真实结算三次后准备边界生效，满席进入未知继续托管；解锁的 deploy/sell/claim 等资源命令后重试。新 `d14Promoted` / `d14Returned` Match 事件只表示阶段转换；资源账本的 `d14-selected`（含已验证装备清单）/`d14-returned`（含真实结算 ordinal）不产生资源奖励。物理三星不改，专用有效四星基础58320Bps、售价与该英雄三星同价、退池9份是明确项目约定；出售及私有 sellGold 均复用 `getUnitSellPrice({definitionId,starLevel:3})`（1费9、2费17），不保留写死售价，不扩大仅一费的目标准入；不提供通用四星合成接口。完整来源、时序和显示字段见 EPIC_LOOT_V16 与 UI_REQUESTS V16-UI-250。

调用方继续使用 Match 公共命令与 `snapshotForBattle(state:MatchState,seatId:string):PlayerBattleSnapshot`；不应直接调用下面的规则内部接线函数。既有命令失败枚举不增加：目标资格失败为 `invalid-target`，过期 choice/generation、阶段错误与金币不足沿用原合同。内部恢复失败抛出 `RangeError`，不是可提交的部分成功。

| 内部导出（`d14-runtime.ts`，除特别标注） | 输入与输出 |
| --- | --- |
| `eligibleD14Target(unit:Unit\|undefined,id:string):boolean` / `isD14(id:string):boolean` | 纯资格/身份检查，无资源与 RNG 变化；非 D14 的目标资格交还原合同。 |
| `acquireD14(state:MatchState):MatchState` / `reconcileD14(state:MatchState,events?:MatchEvent[]):MatchState` | 成功选择后的唯一证书/托管转换及结算重试；事件追加到调用方事务数组；无变化返回原引用。 |
| `d14OwnedUnits(state):readonly Unit[]` / `d14OwnedItems(state):readonly ItemInstance[]` | 合并可见与托管资源，仅用于资源守恒/共享池；不能据此生成战斗阵容。 |
| `d14Certificate(state):D14CombatCertificate\|undefined` / `d14PrivateDisplay(state:MatchState)` | 最小战斗证书及本席展示 DTO；完整字段见 V16-UI-250。 |
| `validateD14(state:MatchState,context:ResourceProvenanceContext):void` | 使用已认证账本/选择收据校验全快照；缺失、篡改或时序不符抛出异常。 |
| `d14HeldAtPrefix(state:MatchState,prefix:number)` / `d14CertificateAtCombat(state:MatchState)` | 由当前战斗的已认证来源前缀重建隐藏资源 ID 与当时证书，不信任候选战斗字段。 |
| `d14UnitBase(unit:Pick<Unit,'definitionId'\|'starLevel'>,promoted:boolean)`（`d14-anomalies/projection.ts`） | 返回 `{base:ResolvedUnitStats,ability:ResolvedAbility}`；调用方先认证证书，非法专用晋升抛出 `RangeError`。全部效果源随后仅解析一次。 |

`restoreD14` 保留为独立 D3/D14 事务包 API；生产 `restoreMatch` 使用上述 Match/B8 账本认证，不要求另传或信任独立包的候选命令日志。两个恢复入口的可信边界不同，不能混用。

## v18 纹章与高档位扩展（2026-10-21）

实现、导出签名、输入输出/失败语义、来源覆盖与明确延期项见 [V18_TRAIT_EXPANSION](V18_TRAIT_EXPANSION.md)。沿用v18身份，等级与固定拆卸器规则保持。`deriveTraits` 第五参数可传当前 `items`；`buildStrategySnapshot` 自动编译冻结装备身份。公开合成/装备/重铸命令签名和失败枚举不变。

## v19 座位只读字段（PR #364 收尾）

`toPrivateSeatView(state:MatchState)` 返回 `familyReunion.{eligible,participantIds,downgraded,downgradedAtTick}` 和 `shopOdds.sixCostBps`；`readG23MechanismState(state).familyReunion` 同退星事实。它们只投影规则，不发事件或消耗资源/RNG；精确类型、基点口径和逐项回归见 [PR364_CI_REPAIR](PR364_CI_REPAIR.md)。六费加入可购买英雄集合（63），常规赠卡/素材渠道的费用限制仍由各自合同约束。

## 单场初始化的可让出入口（2026-10-23）

`openMatchCombatStreamSteps(state: MatchState): Generator<void, MatchCommandResult & { readonly streamInitial?: CombatState }, void>` 是现有 PvE 开流的协作入口；`openMatchCombatStream` 同步 drain 同一生成器。暂停不发布 Match，不提前结算或消费调用方的 RNG；最终结果和失败 reason/原 state 引用保持不变。调用方须保持输入不变，取消丢弃 continuation。逐单位编译、初态创建及 PvP 对应接口、失败枚举和服务器调度约定见 [COMBAT_CONTRACT 的单场初始化协作切片](COMBAT_CONTRACT.md#单场初始化协作切片2026-10-23不变更-epoch)。本改动不变更规则/内容 digest，不录 epoch。

## 10-22 第二轮试玩：回合收入时序（next-preparation-income-v1）

本节覆盖旧“战后收入即时到账”描述，不改 14.24b 收入表、利息档、战中操作权限或自然 XP 时点。

- 战斗结束后，`settleRound`（单人/PvE/供给）与 `applyRoundSettlement`（PvP）用最终权威 `state.gold` 计算同一个 `resolveRoundEconomy` 方案；PvP 胜利金先计入利息基数，并立即到账。基础金、利息、连胜败金只冻结为本轮应收额，不能购买或显示为已到账。战中买卖/经验/刷新仍影响该最终基数。
- `RoundResult.income/incomeBreakdown/interestBasis/goldBefore/goldAfter` 保留方案字段：`goldAfter` 是 **goldBefore + 本轮全部应收收入的方案值**，不是 settlement 余额。`state.gold` 始终是实际可花余额；结算期间还可能有机制奖励/容量出售，不能直接用方案值覆盖余额。`previewRoundEconomy` 仍是预测，不发钱。
- 成功 `nextRound(state, expectedRound, layout?)`，或目录末尾的 `advanceMultiplayerRound(state, expectedRound, layout?)`，在商店刷新/下一轮强化和其他选择之前，将上一条唯一结算记录的 `income - incomeBreakdown.win` 加到实际余额；投资策略只在这个入口按上一轮已锁定利息和上一轮持有强化发成长。`nextSharedRound(pool, states, expectedRound)` 原子复用上述入口，不另加钱。
- 本节的“下一准备阶段入口”包括下一轮前置强化选择；下一轮是供给也照常支付。淘汰或单人终局没有下一入口，不发未来收入。HP、战斗成长、连胜败状态、自然 XP 仍在战后唯一结算提交。
- 无新存档字段；“本轮已有结算且仍在原轮”表示待付。成功推进会换 round，重复 step/Continue、旧 expectedRound 和恢复都不能再支付。恢复完整重算收入方案，settlement 实际余额等式减去待付额；投资成长只重建 `round < state.round` 的已付利息，不放宽任何来源或金额校验。
- 公共签名、返回类型与失败原因枚举保持：`nextRound` 用 `MatchCommandResult/MatchFailure`；联机推进用 `MultiplayerCommandResult/MultiplayerFailure`，共享池仍用原池事务结果。旧 wrong-phase/stale-round/unsettled-round/seat-eliminated/shared-pool-required 等失败仍返回原 state，无事件、无资源/RNG 消耗。新增 `deferredRoundIncome(result)`、`payPreviousRoundIncome(state)` 为领域内部帮助函数，不导出 server-entry，不允许服务器单独调用。
- `content/round-income-policy.ts` 的细分版本参与共同规则 manifest，自动改变 content/loot digest；外层候选身份仍按 PR9 统一录制，不录 epoch、不迁移旧存档。

梅尔核对：归档 `raw/map22.bin.json.gz` 的 `{85892f99}` / `TFT13_MissMageTrait` 明确 `MinimumCasts=12`、`ProcDamageAmp≈0.1`；英文 stringtable 说明整局玩家战斗施法累计。现有 `melCanSave` 包含本场第12次、排除PvE/镜像、整局仅一次。动画消费现有 `playerSaved{battleId,playerHp:1,source:'mel'}`（带 match eventSeq），累计进度读 `seatMechanics.seat.melRescue`；不自行累计、回血或触发扣血。

## 2026-10-25 Batch 4 等级奖励（v23候选）

新增开放 `caretakers-ally` / `lategame-specialist` / `caretakers-favor` / `birthday-presents` / `caretakers-chosen`。源值为14.24，时序与随机口径见 S13_RULES_GAP.md P-B4。不新增存档字段，不新增客户端索奖命令。

- `buyXp(state:MatchState, unitLootPolicy?:UnitLootPolicy):MatchCommandResult`：原费用/XP校验不变；成功升级后同事务发放本组奖励和 mechanicGranted 事件。失败原因仍为 wrong-phase / max-level / insufficient-gold，失败保持原state。可选policy仅传递现有容量策略。
- `batch4RewardPlan(state:MatchState):AugmentGift[]`：纯派生初始英雄及达到等级的奖励；复用既有取得等级、roundResults、Batch1 namespace。无拥有条目或未满足阈值返回空；满席由原有drain等待，联机英雄入法球。
- `batch4LevelRound(state:MatchState, augment:OwnedAugment, level:number):number`：返回取得时已达等级的取得回合，或历史/当前首次达到该等级的回合；仅供已认证拥有条目及等级轨迹使用。
- `drainBatch4Gold(state:MatchState):MatchState`：后期专家达到9级发33金，来源 augment-pool-batch4，唯一收据；重复排放无副作用。
- `validateBatch4Gold(state:MatchState):void`：错误来源、金额、回合、重复/遗漏/孤儿收据抛 RangeError；通过原有 validateBatch1Gifts 进入恢复认证。英雄/锻造器礼物与取得等级继续通过既有验证；restoreSharedOrbSnapshot 对本组拥有条目及收据命名空间同样调用该验证，删除拥有者不能放过孤儿收据。
- `TFT_ArmoryKeyRadiant` 为神选专属五选光明锻造器单位；openAnvil / selectChoice / timeoutChoice 公共命令不变，30秒超时第一项。选项由认证奖励收据重建，不能自行声明五选。其他锻造器仍四选。
## Batch 4：每轮金币／购买记录免费刷新（2026-10-25，P-B4R）

本组仅三条：`patience-is-a-virtue`（2-1）、`invested-plus`（3-2）、`invested-plus-plus`（4-2）。14.24 原值、入轮取样与累计约定见 [S13_RULES_GAP.md 的 P-B4R](S13_RULES_GAP.md#p-b4r2026-10-25每轮按金币或购买记录发免费刷新)。不新增存档字段或公共命令。

- `batch4RerollsGranted(state: MatchState): number`（`augment-pool-batch4-b4reroll-progress.ts`）：纯推导本组从取得后下一自然轮起的已到账累计免费刷新；耐心读前轮成功商店获取记录，投资读前轮结算余额与结算后收据。无 RNG、副作用或新失败 reason。
- `batch4RerollEntryGold(state: MatchState, round: number): number`：返回该轮延期收入到账后、其他入轮奖励前的金币。缺少前轮结算记录抛 `RangeError('Missing batch4 reroll entry history')`。
- 既有 `freeRerollsGranted` 的输入由局部 Pick 扩为 `MatchState`，汇总本组及旧额度。`rerollShop` / `rerollSharedShop` 优先扣免费额度、额度耗尽后沿用原金币费用与失败顺序；失败仍返回原 state，无事件、资源或 RNG 消耗。
- 恢复在现有 `validateFreeRerolls` 内重推累计额度，并按每条免费刷新资源事实的轮次检查当时额度，不能提前消费未来轮奖励。非法账本仍抛 RangeError；JSON、对象、序列化三入口共用该认证。

### Batch 3 review B 进度事实（2026-10-25）

- `g23BattleFacts(combat: CombatState, team: Team, round: number, roundKind: 'pve'|'pvp', openingUnits: readonly {id: string; team: Team}[]): G23BattleFacts` 签名不变。战争财宝开战敌方非召唤单位死亡（含石甲虫、狼、河蟹）作为专用 `{definitionId:'spoils-of-war',count:number}` 放入现有 `batch2` 数组；仅非零写入，`openingDeaths` 不变。双方分别提取，镜像结算沿既有契约。`validateG23BattleFacts` 对负数、非整数、超界、重复标识以 `RangeError('Invalid batch2 battle facts')` 拒绝；终战事实与真实战斗比较。持有战争财宝的已结算旧回合需现有 `battles` 历史参数以认证连续序号（连零击杀也不可伪造）；缺失仍走 `missing historical evidence`，提供历史后按完整事实重放比较。
- `batch3RewardPlan(state: MatchState): AugmentGift[]` 与发放/验证接口签名不变；冒险任务从 `unit-upgraded`、`unit-upgraded-after-combat`、`carousel-unit-claimed.upgrades`、`carousel-preparation-settled.upgrades` 读取完成事实。只计取得后不同英雄的三星，第二名达标后的首个非选秀入口发一次；收据认证与资源来源认证保持分离，无新增保存字段、奖励或规则数值。

## 2026-10-25 技能声明状态恢复认证

存档格式、公共 Match 命令与玩法数值不变。普通结构恢复在检查声明投影前，使用同一份已认证战斗输入的独立重放事实认证全部技能贡献及其非活动显示状态；既有完整战斗重放路径继续比较完整战斗。channel／redirect 仍由活动历史认证。

内部接口 `validateAbilityStatusFacts(combat: CombatState, replay: RestoreCombatReplay, same: (a: unknown, b: unknown) => boolean): ReadonlySet<string>`：逐单位完整比较技能来源贡献、应用／叠层／时间与显示锚点，返回独立证据中的贡献键；无状态也必须一致。失败抛 `Invalid Match save: ability status fact tick` 或 `Invalid Match save: ability status binding facts`，不消费候选 RNG、不修改候选。`CombatReplayFacts.units[]` 仅在恢复内存事实中增加 `abilityContributions` 与 `abilityStatuses`，不进入保存结构。`validateMechanisms`、`validateM5Runtime` 末尾新增可选 `abilityStatuses: ReadonlySet<string>`（默认空集），只能传上述重放核对结果；前者据此验证声明身份键、唯一覆盖、来源、语义及既有 `null → 1201` 到期投影，后者据此准入技能来源的真实 effectIndex。其余校验与失败原因不变。

## 2026-10-25 强化日程收据单位认证

`restoreMatch(input: unknown, battles?: readonly BattleRecord[]): MatchState` 与 `serializeMatch(state: MatchState, battles?: readonly BattleRecord[]): string` 的输入输出、保存格式不变。强化日程收据 `unitId` 必须为 `null`；格式合法或真实存在的奖励单位 ID 也不允许写入，失败抛 `Invalid Match save: augment receipt unit`。来源账本的收据验证边界独立拒绝同类伪造（`Invalid resource provenance: augment receipt unit`）。实际奖励单位仍通过机制／法球收据与有序 `unit-acquired` 出生的 ID、来源、回合及连续序号认证，不要求单位仍存活于当前阵容；不重发、不修复坏档。三恢复入口一致，决定见 `S13_RULES_GAP.md` 的 P-V23-AUGMENT-RECEIPT-UNIT，回归见 `tests/v23-restore-fuzz.test.ts`、`tests/v23-tamper-batch4.test.ts`。


### v24 商店强化移植（P-SHOPPORT，2026-10-25）

新增公共事务 `buySharedXp(pool:SharedPoolState,state:MatchState):SharedPoolResult`；输入为当前有效席位和共享池，成功输出新的 `pool/state/events/poolEvents`；失败沿用 `SharedPoolFailure`（含 `wrong-phase`、`max-level`、`insufficient-gold`、`invalid-seat-state`、`invalid-pool`），保持原 pool/state、不发事件、不消费随机。房间的 buyXp 只在 `dualPurposeOwner(state:MatchState):OwnedAugment|undefined` 返回拥有者时转到该共享事务；费用和经验仍由 Match 的 buyXp 决定。首次每轮2金币收据由 Match 发放并盖事件序号，共享事务只编排真实商店的卡池释放和重新保留。

`ShopSlot` available 报价可带 `starLevel?:2`；缺省1星，2星花费原费用乘3、保留3张卡。`shopOfferCost(offer:{definitionId:string;starLevel?:2}):number` 返回权威购买价，私有投影保留报价星级。`buyUnit` 的来源账本保存同一可选星级；共享保留/释放/购买/淘汰按3张守恒，失败不得扣金币或改池。存档版本不变；门票累计和刷新数、操纵商店锚点、四费增援购买标记使用既有 seatMechanics 扩展机制。耐心及两档投资只有 batch-4 实现，不新增余额快照。阶段与时序按 `S13_RULES_GAP.md` 的 P-SHOPPORT。

只读选择器 `starryChanceBps(state:Pick<MatchState,'augments'|'level'>):number` 输入有效等级及拥有条目，无持有者返回0，持有者返回14.24等级表的 Bps（1800至10000）；不改变状态、随机流或事件。显示层直接调用该选择器，不另算概率。

商店赠品容量：单人火爆甩卖/四费增援满备战席时，复用既有 `rewardOrbs` mechanic 封装和 `resolution: orb` 收据；`claimOrb(state, orbId, expectedRound)` 在非战斗可领取，仍满席返回原 state 和空事件，重复领取为 `already-claimed`。不新增存档版本或字段，旧 PvE 冻结账本不接受未绑定商店收据的额外条目。

`restoreSharedOrbSnapshot(pool:SharedPoolState,input:unknown):MatchState` 亦执行商店强化计数与收据校验，无持有者的 credits/rolls/rigAnchor/reinforced 或伪造收据抛出 `Invalid shop augment authority: …`；仍只接受与权威共享池匹配的快照，签名和保存格式不变。

## 2026-10-27 Review-Q：条件式商店历史认证（用户方案 A）

本节覆盖上节仅凭 `shop-augments.rolls/credits` 与购买 `starLevel` 恢复的口径。新增可选的 `MatchState.shopHistory`，内部版本严格为 `shop-history-v1`。首次通过 `selectChoice` 取得 `AUGMENT_SHOP` 八项之一时，在同一事务开始记录；其余强化取得、XP 购买、锁店、真实生成、购买、Firesale、入轮、异常刷新费用和联机淘汰清店继续追加。失败命令不追加、不消费资源或 RNG。没有持有这八项的对局不创建空字段，旧无商店强化存档仍原样读取、序列化。

历史初始点保存取得前的商店、商店 RNG、回合、等级/XP、金币、持有强化 choiceId 顺序及资源/机制/掉落/日程/经济前缀。单人取得发生在选择阶段、交易之前，初始金币及 XP 另与上一轮已校验结算绑定。`entries` 的每个点保存上述上下文前缀；每次生成记录原因 `natural | subscription | reroll | dual-purpose`、生成结果、RNG、各槽星夜随机命中布尔值，以及消费的 `{choiceId, ordinal}` 免费额度或金币价格。免费额度按持有强化顺序、该强化额度序号分配；这只为认证既有总余额确定唯一来源，不改变可用次数。Ticket 的命中在触发刷新后才可消费。共享池生成另保存释放旧商店之后、预留新卡之前的库存；恢复按相同有限池抽取算法重演，池不足三张时仍为一星。

`validateShopHistory(state:MatchState):void` 是只读检查，抛 `RangeError('Invalid shop history: …')`。它重演持有边界、入轮/经验、刷新原因、逐次额度消费、Ticket 命中和累计、Rigged 锚点、星夜生成与购买星级；将生成及购买与当前商店、RNG、唯一资源序号、免费消费事实、Firesale 收据绑定。金币变化另由已有机制/掉落/出售/日程/收入收据折叠，不能仅在历史中写一个“已付款”。有战斗档案时，还必须延续已经重演认证的商店历史前缀。联机 `restoreSharedOrbSnapshot` 先通过外部权威池守恒，再检查同一历史；它仍不等同于离线 `restoreMatch`。

兼容规则：同 rules/content/digest 的旧档，若持有 `AUGMENT_SHOP` 八项之一而没有历史，一律报 `Invalid shop history: missing shop-history-v1; legacy shop augment saves cannot be authenticated`，不猜测、不补造、不迁移；须保留原文件并开始新局。未知历史版本、丢失/重排/联合伪造记录均不接纳。没有星夜的二星报价，以及没有生成/购买证据的二星购买，三个离线入口与联机快照入口均拒绝。历史是与现有资源/战斗账本一致的确定性规则证明，不是文件签名；不能声称识别将全部输入改写成另一条完整合法轨迹的文件作者。

外层 **schema/save/replay/command = 12/8/8/7，规则联机版本=5，WebSocket 封套版本=6** 不变，rules/content/digest 不变：这是按需附加的认证证据，沿用本合同 A2/A4/A5 的“相关收据缺证据拒绝、未触发不增加空字段、各版本不变”规则，而非替换封套或战斗事实格式。此次无需重录无商店强化的 golden、oracle、回放；以前持有这些商店强化且缺历史的保存及其战斗 context 必须经真实命令重新录制。候选 v24 内容本身的统一 epoch 录制仍按原发布计划执行，本修复不宣布其已完成。

生产调用点核对（所有新记录均在领域层，服务器和界面没有新命令）：

| 调用点 | 改动及确认 |
| --- | --- |
| `src/simulation/match.ts:938`（selectChoice） | 全部强化取得在首次商店强化后追加 acquire；订阅即时生成共用记录；超时选择仍调用此入口。 |
| `src/simulation/match.ts:333`（buyUnit） | 在出生事实后、ReinFOURcement 追加奖励前记录购买槽位、实际星级和价格；单人及 `buySharedUnit` 共用。 |
| `src/simulation/match.ts:375`（rerollShop） | 在扣费/免费消费前取上下文，记录 paid/free 来源；锁店位保留。 |
| `src/simulation/match.ts:388`（buyXp） | 记录购买前 XP/费用；Dual Purpose 的真实刷新另记一次；锁店时只有 XP 事件。 |
| `src/simulation/match.ts:369`、`:759`（setShopLock / rerollAnomaly） | 记录成功锁店和异常刷新费用；无操作锁店不追加。 |
| `src/simulation/match.ts:592`、`:639`（nextRound / advanceMultiplayerRound） | 在被动 XP 后记录入轮；自然/订阅生成共用记录；共享模式丢弃的无限池提案不写生成历史。 |
| `src/simulation/shop-augments.ts:225`、`:151`（drawSoloAugmentShop / stealFiresaleUnit） | 保存真实单人抽取、槽位随机命中及赠送所取槽位；只读重演关闭记录。 |
| `src/simulation/shared-pool.ts:131`、`:173`（drawShop / drawSubscriptionShop） | 初次、自然、主动、Dual Purpose、订阅取得及阶段开始均保存真实池库存/结果；同一函数供只读重演。 |
| `src/simulation/shared-pool.ts:297`（releaseSeatOnElimination） | 清空商店与释放库存的原事务内追加 release。 |
| `src/simulation/serialization-structure.ts:313`、`src/simulation/shared-pool.ts:50` | 对象、JSON、序列化和权威共享快照均执行历史认证。 |
| `src/simulation/battle-record-validation.ts:178`（checkHistoryCarry） | 已重演的历史初始点和事件前缀不可被后续存档改写。 |
| `src/server/room/room.ts:171`、`:178`、`:180`、`:183`、`:541`（分派/handle） | 无源码改动；choose、buy、reroll、buyXp、shopLock 既有分派已核对，并通过真实 Room.handle 和共享池续算测试。 |
| `src/server/protocol.ts`、`src/server/net/messages.ts:249`（validateClientCommand） | 无新 wire 命令、参数或协议版本；既有 command 校验/分派保持。已逐项核对 buy、shopLock、reroll、buyXp、choose 严格参数白名单。 |
| 单人 `src/m6` / `src/rendering/match-session.ts:86` | 无源码改动；既有公共命令写入历史，M6 封套 export/validateFile 经完整战斗历史验证往返。 |

内部记录/重演接口（不是客户端可调用的新游戏命令）：`recordShopAcquisition(before,after)`、`recordShopXp(before,after)`、`recordShopLock(before,after)`、`recordShopRelease(before,after)`、`recordShopAnomalyReroll(before,after)` 的参数和返回值均为 `MatchState`；`recordShopRound(state)` 同理；`recordShopBuy(before,after,slot:number)`、`recordShopFiresale(before,after,slot:number,receiptId:string)`、`recordShopDraw(before,after,cause:ShopDrawCause,stock?:Readonly<Record<string,number>>)` 返回附加证据的 `MatchState`，无历史时保持原 after。调用方只在成功事务内提交。`freeRerollGrants(state:MatchState):readonly {choiceId:string;count:number}[]` 提供稳定额度分配顺序。`replaySharedShop(state:MatchState,stock:Readonly<Record<string,number>>,subscription:boolean):MatchState` 在副本池上重演，绝不改变传入池/状态。`drawSoloAugmentShop(initial,context,subscription=false,cause=subscription?'subscription':'natural',before=initial,audit=true):MatchState` 的后三个参数仅供领域接线和只读重演，既有三个参数调用保持原行为；历史类型和输入输出完整定义见 `src/simulation/shop-history-types.ts:4`。这些内部入口使用原有合法领域前置条件，不新增公共失败 reason；恢复错误前缀及旧档策略如上。

### v24 Batch 5：四条资料已闭合强化（P-B5，2026-10-25）

- 内容注册：`content/augment-pool-batch5.ts`；`called-shot`／`crafted-crafting`（银）、`dual-purpose`（彩）仅2-1，`a-change-of-fate`（彩）仅4-2。保留14.24原始 effects，行为适配详见 `S13_RULES_GAP.md` 的 P-B5。没有存档 schema/协议变更；新增内容使旧 digest 失效。
- 既有 `buyXp(state, unitLootPolicy?) -> MatchCommandResult`：双重目的成功支付后按新等级强刷商店、不消耗免费次数、保留锁定，每轮首次返2G；失败保留原state/RNG/事件原子性。共享席持有双重目的时，普通入口拒绝 `invalid-mechanic-state`，应使用下述事务，不能把本地商店与旧共享预留一起发布。
- `runSharedMatchCommand(pool: SharedPoolState, state: MatchState, {type:'buyXp'}) -> SharedPoolResult`：成功返回新 pool/state、领域events及poolEvents；事务内先检验普通买经验资格，再释放本席旧商店预留、以共享剩余权重生成新商店、结算返金及等级奖励。失败返回原 pool/state；reason 沿用 `SharedPoolFailure`，包括 `wrong-phase`、`insufficient-gold`、`max-level`、池/席绑定校验失败。服务器只需改变buyXp分派入口，不自行计算规则。
- Review K 修复（P-B5-K，2026-10-26）：`applySeatCommand(pool,state,{type:'buyXp'})` 已接上述共享事务。`batch5XpPurchases(state:MatchState,round:number):number` 读取该轮取得后成功购买的有序来源事实，包含所有合法操作阶段。取得时写 `dual-purpose-selected{choiceId,level,xp}`，购买时写 `dual-purpose-xp-purchased{levelBefore,xpBefore,generation,settled}`（均沿用 `sequence/roundId`）；generation为强刷后的值，settled为本轮是否已有结算记录。`validateBatch5Gold(state:MatchState):void` 逐轮认证购买、结算免费经验与次轮起点，再核对唯一2G收据；失败抛 `Invalid batch5 XP authority`／`Invalid batch5 gold authority`（经验非法值也可由既有 progression 校验拒绝）。离线三恢复入口及共享 `restoreSharedOrbSnapshot(pool,input)` 均执行认证；删除持有者与收据也不能绕过来源事实检查。失败购买不记录事实。缺新事实的旧双重目的候选存档不做推测迁移；没有顶层格式版本、内容身份或 epoch 证据变更。
- 精心打造：既有 `combineItems` 和 `equipItem` 产生的真实合成事实，每件给2次额度；`freeRerollsAvailable` 读取，`rerollShop`／`rerollSharedShop` 消费。恢复拒绝伪造合成、消费计数、缺失消费记录及借用后续合成额度。
- 进攻宣告：既有 `selectChoice` 取得时设胜4、给4G；结算与恢复使用同一连胜入口，之后不重复设置。
- 扭转命运：取得给蓝霸符；取得后入轮银行至少60与取得轮起PvP胜利可任意顺序完成。`batch5RewardPlan(state: MatchState) -> AugmentGift[]` 只从既有历史推导枪刃/梅尔的唯一礼物计划，沿用批次1收据、满席重试、共享orb和卡池政策。界面可读取既有 owned augment／收据；本任务不新增展示字段。离线历史用现有 `restoreMatch(input,battles?)`／`serializeMatch(state,battles?)` 完整回放认证，不从当前余额或自报任务计数发奖。

### v24 商店 / Batch 5 合并（P-V24-MERGE，2026-10-27）

本节覆盖上述历史商店合同中“双重目的锁店时只有XP事件”的约定。唯一内容行在 `content/augment-pool-batch5.ts`；返金及有序购买认证使用 Batch 5 / Review K，商店生成和 `shop-history-v1` 使用商店分支。每笔成功XP购买（含锁店）强刷一次，保留锁店开关，判定一次棱彩门票，按同一生成器应用操纵商店/星夜；每轮仅第一笔返2G，不消费免费次数。

`buyXpWithShopRefresh(state:MatchState,unitLootPolicy?:UnitLootPolicy,refreshShop?:(leveled:MatchState)=>MatchState):MatchCommandResult` 是领域内部接线入口。共享事务传入真实有限池生成回调；失败仍返回原state与原reason。单人 `buyXp` 使用同一实现，直接对共享双重目的调用 `buyXp` 仍拒绝 `invalid-mechanic-state`。

`buySharedXp(pool:SharedPoolState,state:MatchState):SharedPoolResult` 只转发 `runSharedMatchCommand(pool,state,{type:'buyXp'})`，不存在第二套返金/刷新逻辑；房间所有 `buyXp` 直接使用后者。共享事务保留订阅取得和超时取得的即时开店包装。其他签名、失败reason、外层schema、客户端命令和网络封套不变；内容身份按指定脚本统一重算，历史epoch尚未重录。

## 2026-10-27 条件式强化历史（方案 A，基础设施）

新增唯一可选 `MatchState.augmentHistory`，版本 `augment-history-v1`；完整模型、上下界、触发时点、失败规则和全部接线点见 [AUGMENT_HISTORY_DESIGN.md](AUGMENT_HISTORY_DESIGN.md)。只在取得登记的历史依赖强化时写入，其余存档不增加字段、保持基线字节。登记仅是后续任务的 ID 合同，本次不开放任何强化、不修改既有规则/数值。外层 schema/save/replay/command 仍 **12/8/8/7**，规则联机/WebSocket 仍 **5/6**，rules/content/digest 不变，沿用商店历史 A2/A4/A5 的按需证据规则。

事实覆盖取得前本金与上一战阵容、入轮棋盘/备战席/装备、PvP 全桌名单、累计淘汰和排名、普通英雄永久 HP/AD/AP 成长、多笔选秀收据及来源/落位/资格、准备期逻辑时间、每次真实死亡及当刻装备（复活再死不去重）、对手实际玩家扣血，以及最大 HP 变更的扩展事实类型。`abilityPowerCenti` 是百分之一 AP，百分比仍为 Bps。单人没有敌方玩家 HP 账本时实际扣血为 null；缺失历史行不能作0。旧普通准备期档也不能凭当前棋盘补造前一战；取得事实的 previousBattle 明确标记 unavailable，读取时拒绝。

`restoreMatch` 的对象/JSON入口和 `serializeMatch` 共用 `validateAugmentHistory`：以无相关持有者的已认证 origin 重演白名单成功公共命令，重建完整事实和最终 Match。外部战斗档案另认证事实及命令前缀。`restoreSharedOrbSnapshot(pool,input,authority?)` 与 `restoreCarouselSeat(carousel,input,authority?)` 对相关联机席位要求独立服务器 authority；通过 `Room.augmentHistoryAuthority(seatId)` 从真实房间捕获，不能把候选 JSON 自己当证明。恢复不认证完整未知作者身份，也不新增全桌重启存档协议。

缺节统一拒绝：`Invalid augment history: missing augment-history-v1; history-dependent augment saves cannot be authenticated`；缺联机权威对象为 `missing independent server authority`，其它错误使用同一前缀。无自动迁移。`requireAugmentFacts(state,kind,round)` 没有记录即抛错；带完整 tick 边界的 `deaths:[]` 才代表零死亡。

后续强化只调用领域内部的 `recordAugmentGrowth`/`readAugmentGrowth`、`recordAugmentPlayerHealth`、`readPreviousAugmentBattle`、`requireAugmentFacts`、`advanceAugmentPreparationTime`、`appendAugmentFact` 或 `grantAdditionalCarouselPick`。这些接口不向客户端开放，不自行决定受益人/数值/随机选择。普通选秀仍一席一次；附加授予要求正常领取已完成、独占剩余槽、明确持有来源，ID 为 `<carouselId>:<seatId>:extra:<1..8>`，按现有保留/领取/held/返池流程守恒。失败沿用 CarouselFailure、返回原状态。具体函数签名及成功/失败语义以设计文档接口表和导出 TypeScript 类型为准。

### Batch 5 H3：历史成长和单位锁（P，2026-10-27）

开放 `no-scout-no-pivot` 与 `cooking-pot`，均为黄金强化，仅在 2-1 提供；以上基础设施段中“不开放任何强化”和“digest 不变”仅描述当时的基础设施提交。前者在真实 PvP 冻结本人棋盘普通英雄，结算每名参战者永久获得 20 平面生命、150 Bps 攻击力和 150 centi 法强，按合星血缘继承；之后不可出售或因布阵交换回备战席，拒绝理由为已有 `unit-not-sellable`，失败返回原 state、无事件和消耗。场内换格、装备及自动合星仍合法。

后者取得时按标准奖励收据给一个 `frying-pan`；取得后的每个自然轮入口，以 `round-entry` 的棋盘普通英雄和原始 `frying-pan`/`spatula` 为准，每名携带者向最近的另一棋盘英雄给 50 平面永久生命，六角距离相等按单位 ID 排序，多个携带者可叠加；单名携带者多件不倍增，没有目标则无成长，备战席不参与六角距离。无额外 AP。入口在上轮收入之后、本轮被动经验、商店、选秀和奖励之前；唯一成长收据使重复执行幂等。

`readAugmentFacts<K>(state,kind)` 返回脱离原对象的该类历史事实，缺历史节报 `Invalid augment history:`；`requireAugmentFacts` 仍按轮查询并在缺行时拒绝。`recordAugmentGrowth`/`readAugmentGrowth` 继续负责有来源的整数成长及合星继承。单人战斗输入和服务器私有双边快照条件携带已认证成长；离线恢复对照开战前历史，联机席位恢复依然要求独立服务器 authority。房间复用既有冻结名单与结算调用，无新增网络命令或服务器自行计算规则；外层协议版本不变，内容身份已重新计算，历史 epoch 未重录。

### B5-H5：共享选秀强化（P，2026-10-27）

`table-scraps` 取得时给 1 金；从取得后的前四次共享选秀，每次正常选取全部结束后按固定席位顺序从仍剩余的槽等权无放回取一，空槽不足不补造也不顺延。用户决定覆盖 14.24 阶段标签：只在 2-1 报价，3-2 和 4-2 禁出。`young-and-wild-and-free` 取得时给 2 金；共享选秀阶段的逻辑时间从 arrival 结束计起，持有者从 0 ms 可领取，同一槽仍由原子领取事务独占。两者不在单人或无共享选秀的联机模式报价。历史事实均使用 `augment-history-v1`，没有新增客户端命令。

- `prepareCarouselParticipants(pool, states)` 从持有者的 `acquire` 历史核对提前放行资格并冻结 `CarouselParticipant.priorityChoiceId?: string`；缺少取得事实返回原 pool 和 `invalid-participants`。`createCarousel`、`validateCarousel` 按冻结席位计算并校验 `releaseAtMs`，`pickCarouselForSeat` 再核对对应 Match 的取得事实，不符返回原 pool、carousel、state、空事件和 `invalid-match`。不持有者沿用原有放行时间。
- `tableScrapsPick(state, carousel): {choiceId:string;slot:number}|null` 在关闭的共享选秀规划一个剩余槽；它读取每次正常领取的历史，并由 `completeCarouselForSeat` 调用现有 `grantAdditionalCarouselPick(pool,carousel,match,seatId,slot,choiceId)` 原子授予单位和装备。`completeCarouselForSeat` 已由房间按固定席位顺序调用；非法历史或额外授予失败返回原状态及现有 `CarouselFailure`，不引入新网络原因。额外领取的 `carousel-picked` 与 `carouselGranted` 按顺序写入带连续序号的 match 事件；空槽不足和四次后无额外授予。
- 在线单席恢复仍须独立服务器权威句柄；`restoreCarouselSeat`、`restoreSharedOrbSnapshot` 检查历史和状态。`restoreMatch`／`serializeMatch` 的离线边界仍不接受多人档，在线对象、JSON 及规范序列化文本由上述两联机入口恢复。

### Batch 5 S3a：库存转换（P，2026-10-27）

B5-13 `component-buffet`、B5-15 `fine-vintage`、B5-16 `pandoras-items` 的内容在 `content/augment-pool-batch5-s3a.ts`，规则在 `augment-pool-batch5-s3a*.ts`。来源和项目边界见 `S13_RULES_GAP.md` 的 P-B5-S3A。基础装备自助餐仅 2-1 可选；潘朵拉三个节点可选；精致古董按用户确认的 P-FINE-VINTAGE-STAGE 仅在 2-1 提供，保留对原始三个禁选标签的审计。

内部纯接口 `batch5InventoryPlan(state: MatchState): InventoryPlan` 从原始物品收据、按序装备/合成/消耗品/合星事实及自然轮号派生转换和锻造器权益。`projectBatch5Items(items, plan, prefix, round, afterPrefix?, afterRound?)` 只应用指定历史区间的删除/换型；`drainBatch5Inventory(state): MatchState` 支付可放入备战席的锻造器并更新库存；`validateBatch5Inventory(state, plan?)` 对非法收据、序号、出生覆盖和转换权益抛出 `RangeError`。上述函数均为规则内部接口，服务器继续只调用 Match/shared-pool 公共命令。

无需新命令或保存字段。选择仍走 `selectChoice`/在线 `choose`，领取仍走 `claimOrb`，开锻造器仍走 `openAnvil`（或出售锻造器）及原四选一选择；失败枚举、原 state 返回和失败不耗 RNG 的语义不变。`nextRound`、联机 `applyRoundSettlement`、选秀发放及成功操作统一接入规则；`src/server/` 无需修改。锻造器满席时保留可推导的待发权益；战斗锁定和选秀轮不创建备战席单位，之后有空位即发，原组件/成装不能继续使用。原物品出生收据不删除，现有 mechanic unit/anvil choice 收据认证新锻造器与选出物品。

精致古董按每一次装备操作后的库存连续性计龄，故同轮装备后卖出也清零；取得前已在库存的成装从取得轮开始计龄。普通组件移动/拆卸不是新组件；重铸新实例是新组件。潘朵拉只对取得后的自然轮入口、入轮前已有的库存普通组件/普通配方成装抽样，允许抽中原物品；保持实例 ID、类别及物品序号，按 `seed xor FNV1a32(JSON([source, seat, choice, round, item]))` 后一个 `lcg32-v1` 字抽取有序池，不推进任何 live RNG。普通重掷不触发基础装备自助餐；两个原有互斥强化仍按既有源表过滤。

单人 `restoreMatch(JSON)`、`restoreMatch(object)`、`serializeMatch(candidate)` 以及在线 `restoreSharedOrbSnapshot(pool, input)` 均重放库存规则。共享入口另外核对所有物品出生收据的覆盖及串号，不把 PvP 的服务器结算收据冒充单人战斗 growth commit。历史战斗装备认证沿用 `battle-record-validation.ts` 调用的 `validateHistoricalEquipment`，不新增 epoch 或复录 golden。

### H6 审查修复（2026-10-27）

`readAugmentGrowth(state: MatchState, unitId: string, provenancePrefixLength?: number): AugmentGrowth` 沿给定来源前缀追溯合星血缘，包含 `unit-upgraded`、`unit-upgraded-after-combat` 及 `carousel-preparation-settled.upgrades`、`carousel-unit-claimed.upgrades`。来源记录与嵌套合星事件都逆序读取，先找到被最终三星消耗的二星，再展开其一星来源；同一来源 ID 仅计一次，不把出售后重新购买的同名英雄当作同一实例。两张分别有 150 Bps AD／150 centi AP 成长的英雄合星后累计 300。返回结构、失败原因和成长数值约定不变；本次补齐既定合星继承行为，不新增内容或改变 schema、内容版本和 digest。

独立测试 oracle 从结算前的 `pvp-roster` 计算纷争金币，并要求既有历史事实前缀不可改写。冲榜战士按后续自然轮的入轮排名与正式阵容推导成长：5–8 名每名普通英雄 150 Bps AD／150 centi AP，唯一收据绑定强化选择与轮次；1–4 名仅有本轮 1000 Bps HP，不写入永久成长。备战席包含在正式阵容中，召唤物和未落位选秀单位不包含；新入轮阵容还与命令前正式阵容核对。战斗输入／联机快照另外核对累积成长、合星继承和临时 HP。oracle 不导入生产成长计算器，联合篡改、缺失／重复／错主收据和无操作伪造 999999 成长均须拒绝。
## 2026-10-27 Batch 5 H12（P-B5-80/84/86）

`head-start`（白银，仅 2-1）：选择事务先通过 `requireAugmentFacts(state,'acquire',acquiredRound)` 读取冻结阵容，按普通出售的价格、装备归还、异常解绑、永久成长删除和 `unit-sold` 账本批量出售，再发四份随机二星一费。沿用普通出售资格：不可出售的召唤物与锻造器不冒充英雄出售。随机按既有礼物子流有放回；联机使用原有待领取奖励球和共享池守恒。取得轮及随后两自然轮，`buyUnit` / `buySharedUnit` / `rerollShop` / `rerollSharedShop` 返回原 state（共享入口也返回原 pool）、`wrong-phase`，不消耗金币、刷新次数或 RNG；自然刷新、锁店、买经验、收入和非商店奖励继续。第四轮恢复商店资格，仍受该轮普通阶段操作限制。

新增内部规则接口：`applyHeadStart(state: MatchState): {state: MatchState; events: MatchEvent[]}`（只在选择事务调用）；`headStartShopDisabled(state: MatchState): boolean`（缺取得历史抛 `Invalid augment history`）；`sellPreparedUnit(state: MatchState, unit: Unit, capacity?: boolean)` 是普通出售和批量出售共用的已验证事务，不是客户端命令。没有新增网络命令或失败枚举。服务器调用路径仍为 `Room.handle/apply → buySharedUnit/rerollSharedShop/runSharedMatchCommand → Match`，手选与超时共用 `selectChoice`；`src/server` 无需修改。

`max-cap`（棱彩，仅 4-2）：当前等级≤7且未持有 Level Up 才提供，两者双向互斥；选择事务再次校验，旧报价已因买经验升至8级时返回原状态与 invalid-choice。取得支付60金币、授予1个 `TFT_Item_TacticiansScepter`（金锅锅冠冕，队伍+1）；七级时清除剩余经验，不降级、不退经验。`augmentLevelCap(augments:readonly OwnedAugment[],round?:number):number` 返回该历史轮的等级上限；`grantMatchXp(state:Pick<MatchState,'augments'|'level'|'xp'>,amount:number):ProgressionResult` 统一购买、选择奖励及入轮经验，普通/条件战后经验也传同一上限。七级买经验返回 max-level，失败无扣费、无刷新、无RNG。`h12OfferAllowed(id,owned,level?)` / `h12SelectionAllowed(state,id)` 为内部过滤，不是网络命令。报价等级证据及触发前购买认证见 AUGMENT_HISTORY_DESIGN.md 的 H12 节。

`subscription-service`（棱彩，仅 2-1）：取得时立即支付6金币并用4个不同四费替换普通商店（第五槽空）；后续每阶段首轮再替换一次并支付6金币。按4金币正常购买，刷新按原有费用/免费额度离开特殊店，锁店开关保留但不能阻止下一阶段强刷；无足够不同库存时余槽为空，不扩充有限池、不免费发英雄。`subscriptionAcquired(before,after):boolean`、`subscriptionStageStart(state,round):boolean` 使用 acquire/round-entry 事实；`drawSubscriptionSlots(state,available,take):{slots,rngState,rngDraws}` 对每个非空槽使用一次现有LCG抽取并经 take 保留1张；`enterShopAugmentRound(state):MatchState` 在阶段入口复用唯一金币收据，重复正确收据返回原对象，冲突收据抛错。订阅源数据与规则迁入 H12 文件，`content/augment-pool-shop.ts` 引用同一内容行，`shop-augments.ts` 保留转导出以兼容原调用者。

### H12 全部实际改动的接线点

| 路径／函数 | 改动 |
|---|---|
| `content/augment-pool-batch5-h12.ts`；`augment-pool-batch5-h12.ts`、`-progression.ts`、`-subscription.ts` | 三项源数值、出售/禁店、上限/过滤、阶段订阅规则 |
| `content/augments.ts`、`augment-policy.ts`、`augment-offer-rules.ts`、`augment-stage-bans.ts`、`rules-manifest.ts`、`validate-content.ts` | 定义/品级/API身份/阶段限制/规则身份/数量校验；`content/augment-pool-shop.ts` 引用订阅同一行 |
| `augment-pool-grants.ts / batch1GiftPlan` | 四个二星一费与金锅锅冠冕接已有礼物、法球、唯一收据路线 |
| `match.ts / execute_selectChoice, execute_sellUnit, execute_buyUnit, execute_rerollShop` | 选择前校验，冻结阵容出售及返装备，共用普通出售事务，禁店失败原样返回 |
| `match.ts / buyXpWithShopRefresh, execute_nextRound, execute_advanceMultiplayerRound, execute_forfeitPendingChoice` | 统一上限；超时跳过八级失效的最大规模报价；原订阅取得/入轮接线复用 |
| `match.ts / enterScheduledEvents, execute_rerollAugment`；`augment-offers.ts / opening/filter/view/history` | 实时等级过滤、记录每次报价等级、恢复逐次重建 |
| `progression.ts / grantXp`；`economy.ts / planRoundEconomy`；`augment-pool-batch4-b4xp-progress.ts / withBatch4B4xp` | 参数化等级上限，普通与条件结算XP一起封顶 |
| `augment-pool-batch5-progress.ts / validateXpPurchases` | 双重目的购买序列和结算恢复按取得前后上限认证，历史通过 requireAugmentFacts 读取 |
| `serialization-structure.ts / validPreparationExperience, preparationExperience, restoreMatchWithinCall`；`shop-history.ts / validateShopHistory` | 当前/历史XP、获得封顶及商店购买链同步校验 |
| `shared-pool.ts / buySharedUnit, rerollSharedShop` | 联机禁买/禁手刷；既有 runSharedMatchCommand/drawSubscriptionShop/refreshBatch 复用迁入 H12 的订阅接口 |
| `shop-augments.ts` | 订阅实现迁出并转导出，保留其它商店规则 |
| `augment-history-types.ts`、`augment-history-owners.ts`、`augment-history.ts`、`augment-history-restore.ts` | H12持有者、offer-level、条件激活、预检及既有重演/独立权威认证 |
| `src/server/`（无源码改动） | `room/room.ts / applySeatCommand, Room.handle/apply/applyTimeouts/onChoiceDeadline` 经原公共领域命令处理 choose/buy/reroll/buyXp/shopLock；入轮经 nextSharedRound；augmentHistoryAuthority 复用原接口。服务器不计算奖励，无新增命令/定时器 |
| `tests/augment-stage-helpers.ts`；`tests/fixtures/m5/oracle.g2.cjs`、`augment-rewards-oracle.cjs` | 固定有界路线种子；独立候选/互斥/阶段/出售返金/礼物/上限XP校验 |
| `tests/augment-pool-batch5-h12-*.test.ts`、`tests/server/h12-subscription.test.ts`；相关 shop/history 测试 | 真实命令、房间、池守恒、三入口恢复/篡改；旧固定种子夹具改合法重抽，保留断言与超时 |
| `content/identity-constants.ts`、`scripts/tests/production-size.test.ts` | 最后用指定脚本同步完整内容摘要，历史epoch不动 |
### v25：盗墓者 I／II（B5-39／40，P，2026-10-27）

`tomb-raider-1`（黄金，原始 `NumDead=3`）与 `tomb-raider-2`（棱彩，原始 `NumDead=9`）只在4-2报价，沿原始互斥关系双向排除。I处理取得后的接下来3名淘汰者，空候选也占一名；II处理取得后的每名淘汰者，9不作为上限。两者都不追溯取得前淘汰者，也不向同时已被淘汰的持有者发奖励。候选只来自淘汰席正式棋盘／备战席普通英雄持有的普通成装；背包、临时装备、纹章、光明、神器、辅助装、召唤物及选秀暂存英雄不参与。同回合按名次从低到高，各件全部展示，包括同名副本，不抽样、不消耗 RNG。证据等级和用户约定见 `S13_RULES_GAP.md` P-B5-39／40。

- `hasTombRaider(state: MatchState): boolean`：服务器可查询是否需要这组结算编排，不自行判候选或次数。
- `recordTombRaiderEliminations(state: MatchState, table: readonly HistorySeat[]): MatchStep`：仅服务器权威结算调用，排名确定后、共享池资源回收前传入整桌正式快照；复用 `recordAugmentTable(state,'settlement',table)`，按 `acquire` 后的全桌历史推导机会并打开第一项。无持有者返回原状态和空事件；同轮同表重试不重发，冲突表抛 `Invalid tomb raider settlement conflict`。打开事件在同一事务中取得连续 match eventSeq，房间按原 seatRevision 发布，不接受客户端上传表。
- `publishTombRaiderChoice(state: MatchState): MatchStep`：服务器在已有 `table/entry` 发布后调用，使入轮淘汰也进入同一队列；补给／共享选秀期间沿用现有选择限制，保留历史机会，在后续可打开选择时处理。
- `openTombRaiderChoice(state: MatchState): MatchStep`：Match成功命令的通用接受点调用；已有选择优先，完成一项后立即打开下一名。沿用 `PendingChoice.kind='forge'`，`payload.source='augment-pool-batch5-r1'`，`offers` 为全量装备定义ID；该来源允许同名副本重复展示。唯一 choiceId／receiptId 为 `JSON.stringify(['augment-pool-batch5-r1', ownerChoiceId, eliminatedSeatId])`。每项使用既有 `selectChoice`／网络 `choose` 或 `forfeitPendingChoice`／超时命令；授予1件永久库存装备、1条 mechanic item-acquired 来源和1张 choice 收据，默认超时选首项。失效ID／代次、非法候选沿用 `stale-choice`／`invalid-choice`，失败保持原 state／pool 引用，不发事件、不用资源或 RNG。
- `validateTombRaider(state: MatchState): void`：从历史重建全部合法机会、顺序、候选、收据身份和装备出生来源，错项抛 `Invalid tomb raider authority`。已接入普通恢复、`restoreSharedOrbSnapshot`、`restoreCarouselSeat`；多人对象、JSON与规范文本恢复均仍要求 `captureAugmentHistoryAuthority`／`Room.augmentHistoryAuthority` 的独立品牌句柄，缺节、伪造权威、修改历史／候选／装备／收据全部拒绝。

规则与内容位于 `augment-pool-batch5-r1*.ts` 和同名 content 文件。`src/server/room/augment-history.ts` 只冻结／传递全桌和发布事件，`room.ts` 只增加回收前一次调用；没有新增网络命令、真实时钟或服务器奖励公式。独立 M5 oracle 按原始全桌事实、独立英雄费用表和普通成装转录重建预期，不以生产奖励收据决定资格或奖品。单人取得不产生淘汰奖励且保持可运行；沿用同版12/8/8/7格式，重算内容与loot身份，不重录epoch。
## Batch 5 R2（P，2026-10-27；沿用 v25）

开放 `anger-issues`（棱彩，3-2/4-2）和 `another-anomaly`（黄金，4-2）；规则、研究状态及完整内部签名见 [AUGMENT_BATCH5_R2](AUGMENT_BATCH5_R2.md)。沿用现有 `selectChoice`、装备、合成、消耗品和重掷命令/失败枚举，不增加客户端提交事实的命令。普通成装转换追加有选择来源绑定的 `anger-item-converted` 资源事实；便携异常以不可变物品定义携带复制身份，共用唯一 apiName，4-6选择事务内即时授予，失败仍返回原 state、无事件和 RNG 消耗。

强化历史 API 新增 `recordAugmentCopyKills(state,fact)` / `readAugmentCopyKills(state,itemId,beforeRound?)`，同 `augment-history-v1` 保存 `anomaly-copy-kills`，复制品独立于原英雄的历史。联机采样入口 `recordR2PortableBattle(state,combat,team,mapping?)` 只接受服务器已经认证的终战及既有身份映射；房间只编排调用。持有者的对象/JSON恢复仍必须取得独立 authority；伪造选择、来源、复制定义、位置、成长、旧手套收据或历史节均拒绝。无 epoch 重录。

## B5-67 炼金术士（v25，2026-10-27）

`mad-chemist` / `TFT13_Augment_SingedCarry` 为 2-1 白银强化；3-2/4-2 禁止，沿用 AssociatedTraits 与互斥表。`selectChoice`、联机 `runSharedMatchCommand(...,{type:'choose',...})` 共用既有 `batch1GiftPlan → drainBatch1Gifts`，选择事务只授予一次一星辛吉德；在线使用共享卡池奖励法球，`claimOrb` 领取后可正常部署、合星。失败、重试和重复旧 choice 不发第二份奖励，不新增公共命令或 wire reason。

开战编译只给本方最强的一个棋盘辛吉德附加 `madChemist`（星级降序、正式装备数降序、实例 ID 升序），不从当前余额推测历史。其运行状态仅在 `CombatUnit.madChemist?: MadChemistRuntime`：整数回蓝余数、技能到期 tick、唯一格毒云和同源目标毒伤。完整结构见 `augment-pool-batch5-r4.ts`；数值和离散语义见 COMBAT_CONTRACT 与 S13_RULES_GAP P-B5-67。

`restoreSharedOrbSnapshot(pool,input,authority?) → MatchState` 与 `restoreCarouselSeat(carousel,input,authority?) → MatchState` 保留签名。独立服务器共享池（选秀入口使用 `carousel.pool`）中的本席 B5-67 待发奖励或已结算奖励收据要求现有独立 `AugmentHistoryAuthority`；该要求不随候选档删除强化、选择记录、奖励收据或法球而消失，奖励合星、卖出、折金或放弃后仍成立。候选仍带 B5-67 强化/奖励/战斗标记时也要求认证。句柄由 `Room.augmentHistoryAuthority(seatId)` 从服务器私有席位捕获，不能从候选 JSON 自签；只要提供句柄，无论是否持有本卡或历史节，都必须认证完整席位。缺失/伪造句柄报 `Invalid augment history: missing independent server authority`，任何完整席位差异报 `Invalid augment history: server facts/state mismatch`；额外复核既有奖励计划。B5-67 无跨回合历史事实，不新增空 `augmentHistory` 节。离线战斗恢复按已认证输入完整重演并比较毒云/毒伤/回蓝/移动状态；离线入口仍拒绝多人文件。无服务器编排或接口接线变化。

展示数据沿现有 `d11ChoiceDisplay(definitionId)` / `d11PrivateDisplay(state)` 提供公开的中文名称、描述和白银级别，内容取自 R4 定义；既有界面无需新增规则计算，不改表现目录。
### B5-R5：星夜与星夜+（2026-10-27）

- 内容位于 `content/augment-pool-batch5-r5.ts`，通过 `AUGMENT_SHOP` 的既有 definitions/tier/API-name 聚合注册，避免重复候选。普通版获取6金且仅2-1提供；+版获取8金且仅3-2提供；彼此互斥。阶段标签不变。
- `starryChanceBps(state: Pick<MatchState,'augments'|'level'>): number`：返回整数基点；未持有返回0；等级1–10分别为0/0/1800/2000/2200/2500/3000/5000/8000/10000。两版及1/2费同率。
- `starryUpgrade(state: Pick<MatchState,'augments'|'level'|'seed'|'multiplayer'>, generation: number, slot: number, definitionId: string): boolean`：对有效领域输入纯计算，不修改状态或主RNG；3费及以上返回false。调用方仍须检查是否能预留3份共享库存。既有 `shop-augments.ts` 保留兼容导出。
- `generateSharedShop` / `rerollSharedShop` / 自然换轮沿用共享池事务：命中且至少3份库存则生成二星报价、一次预留3份，否则保留一星；刷新/淘汰退回所有未买份额，锁店自然换轮保留预留。`buySharedUnit` 支付3倍基础费用，将3份来源转为自有持有份额，不二次扣池；既有合星按一星等价份额守恒，9份可合三星。失败沿用 `stale-shop`、`insufficient-gold`、`bench-full`、`purchased-slot`、`empty-slot` 等原枚举，原state/pool引用、事件和RNG不变。
- `validateBatch5R5ShopAcquisition(state: MatchState): void`：`shop-history.ts` 恢复入口调用；按内容核对唯一获取收据及金币、选择身份、回合，错误抛 `RangeError('Invalid Starry Night acquisition')`。其余抽取/星级/库存/购买由现有 `shop-history-v1` 重演；不新建事实格式，缺历史不推测迁移。有其它历史强化的联机档仍须使用 `Room.augmentHistoryAuthority(seatId)` 与既有恢复API。
- 服务器调用链复用 `Room.handle` → `applySeatCommand` → 共享池领域入口，无 `src/server` 改动；规则身份纳入 `rules-manifest.ts` 的 `augmentPoolBatch5R5` 和重算digest，外层schema/save/replay/command及历史epoch不变。证据状态与明确约定见 `S13_RULES_GAP.md` 的 P-B5-08/09。

## Batch 5 R6：潘朵拉的备战席与变形重组器（2026-10-27）

只新增 `pandoras-bench`（白银，三个节点，取得2金）和 `recombobulator`（白银，3-2/4-2，取得2拆卸器）。数值、研究状态和用户批准的继承／库存边界见 `S13_RULES_GAP.md` 的 P-B5-27-R6、P-B5-28-R6。规则和内容分别在 `augment-pool-batch5-r6.ts`、`content/augment-pool-batch5-r6.ts`。联机为执行目标；单人选择保留基础金币／工具并正常运行，不模拟无限卡池变形。

| 规则接口／接线 | 输入、输出与失败语义 |
| --- | --- |
| `transformPandorasBench(state: MatchState, stock?: Readonly<Record<string,number>>): {state: MatchState; events: readonly MatchEvent[]}` | 在 `nextRound` 与加时 `advanceMultiplayerRound` 的历史入轮快照后、经验／商店／选秀迁入前调用；共享推进传入事务草稿库存。读取 `requireAugmentFacts(state,'round-entry',round)`；无拥有者／取得轮／已完成／非联机返回原对象。 |
| `transformRecombobulator(state: MatchState, policy?: UnitLootPolicy): {state: MatchState; events: readonly MatchEvent[]}` | `selectChoice` 记录 acquire 后、礼物发放前调用；读取同次取得历史。`rewardPolicy` 经 `bindBatch5R6Stock` 在WeakMap提供草稿库存，无保存字段／客户端参数；共享席缺策略抛错，外层共享事务回退。 |
| 事务与账本 | 在私有库存副本上选定全部替换，再统一合星；资源事实为 `unit-transformed {choiceId,unitId,from,to,starLevel}`，末尾 `augment-transform-completed {choiceId}`（即使空棋盘或缺货）。实例ID不变，成长和装备按既有合星血缘转移；异常仅在成功变形时清除。`reconcileHoldings` 按同序事实扣返，保留来源份额身份并检查完整星级；失败不发布任何席位／卡池变化。 |
| `validateBatch5R6Transforms(state): void` / 保存 | `restoreSharedOrbSnapshot` 在既有校验链中检查变形所有者／历史，两个强化注册为 `augment-history-v1` 持有者；整个候选必须匹配独立服务器authority。`restoreCarouselSeat` 沿现有同一history authority认证。缺历史、伪造来源／星级／成长／工具、缺失完成事实均拒绝；无需新封套或重录旧epoch。 |
| 卡池失败枚举 | 无完整候选是成功事务中的单位不变，不补金、不降星；不增加wire reason。共享事务仍返回既有 `invalid-pool`／`invalid-seat-state` 等失败并保留原pool/state。 |

`src/server/` 无改动：`Room.apply` 的 choose／timeoutChoice、入轮的 `nextSharedRound`、独立 `augmentHistoryAuthority` 继续调用现有公共规则入口；服务器不计算费用、库存或变形。战斗快照仅在持有上述变形强化时允许普通英雄继承原Tristana永久AD；新增成长来源仍只能由既有Tristana战斗事件认证。两个卡片测试的变形、星级库存和合星预期由独立M5 oracle根据变形前阵容、真实库存与种子推导，不读取生产收据作为预期；工具数量另用独立礼物计划核验。

## Batch 5 G1：幸运手套 / 幸运手套+（P，2026-10-27）

现有公共命令 `selectChoice(state,choiceId,generation,definitionId,unitLootPolicy?)`、`combineItems(state,aId,bId)`、`equipItem(state,itemId,unitId,slot,options?)`、`deployMatchUnit`、`useConsumable` 与自然入轮完成全部执行；网络命令和失败原因不变，失败保持原state、无事件/资源/RNG变化。B5-53仅2-1可选，给2拳套并在取得轮+5入口给1拳套；B5-54禁2-1，立即给3拳套，无延迟；二者互斥。数值/证据/选装约定见 `S13_RULES_GAP.md` P-B5-53/54。

新增规则内部接口（均在 `augment-pool-batch5-g1*.ts`，不新增服务器命令）：

| 签名 | 输入/输出与拒绝 |
| --- | --- |
| `luckyGlovesRewardPlan(state: MatchState): AugmentGift[]` | 从已取得来源和自然轮推导唯一延迟礼物；未到期或+版返回空数组，不读取收到的收据推测应得数值。 |
| `luckyGlovesSelection(state: Pick<MatchState,'augments'\|'preparation'>, parent: ItemInstance): EquipmentRoundRoll['lucky']` | 读取当前合法持有者及形态；无该强化/普通英雄则undefined，不伪造英雄角色。 |
| `selectLuckyGlovesPair(role: string, radiant: boolean, draw: () => number): readonly [string,string]` | 推荐池8选2，拒绝采样等权、无放回；光明逐件映射。非法角色/池/映射抛RangeError。 |
| `equipmentRollFor(rolls,roundId,parent,context): EquipmentRoundRoll \| undefined` | 从不可变roll中取对应英雄/形态/父装备的缓存；冻结战斗使用自身冻结阵容与roll前缀。 |
| `generateLuckyGlovesRolls(state,requests,pool): EquipmentState` | 校验已有账本，按父装备ID排序追加缺少的缓存；复用不耗RNG，无额外墙钟。 |
| `validateLuckyGlovesEquipment(state,pool): void` | 从原始装备种子独立重放普通/推荐抽样，校验角色、持有来源、两个结果、抽数和游标；篡改抛 `Invalid Lucky Gloves equipment authority`。 |

`EquipmentRoundRoll.poolVersion`增加`lucky-gloves-v1`，仅该分支带`lucky:{choiceId,holderId,definitionId,role,radiant}`选择上下文；不新增顶层保存节。旧普通roll字节不变，普通roll和推荐roll可同轮共存；战斗冻结与战中装备重建按对应上下文选取。`temporaryEquipment`沿原槽位、身份、撤销协议，临时装备不能变永久库存。两项登记为`augment-history-v1`持有者，通过通用API保留取得/位置/阵容事实；联机三种输入形式均调用 `restoreSharedOrbSnapshot(pool,input,independentAuthority?)`，缺节或缺独立authority拒绝，不推测恢复。服务器已有通用编排直接生效，本任务未改`src/server/`。
## Batch 5 G2 联机接口（P，2026-10-27）

`src/simulation/augment-pool-batch5-g2.ts` 导出 `ghostFriendsGrowth(state: MatchState): GhostFriendsGrowth | undefined`；`GhostFriendsGrowth={healthFlat:number,attackDamageBps:number,abilityPower:number}`，均为非负整数。未持有老友幽魂返回 undefined；持有者缺强化历史按现有 API 抛 `Invalid augment history: missing augment-history-v1`，不得补零。永久值仅从当前席位已完成前序自然轮的真实死亡事实推导，战斗输入冻结为 `ghostFriendsGrowth`，不接受客户端提交成长。形态及英雄复制体证据见 AUGMENT_HISTORY_DESIGN。

报价／选择沿用现有命令，不新增 wire failure：老友幽魂为棱彩且仅 2-1，爆蓝之城为黄金、无额外阶段禁令，3-2／4-2 沿用蓝发羁绊筛选。爆蓝之城通过既有强化奖励法球各授予一个阿卡丽、艾瑞莉娅，重复选择保持失败原子性；战斗复制体不进入资源谱系、正式棋盘或共享卡池。服务器继续只编排 `snapshotForBattle`、双边战斗和原有死亡采样，无新服务器规则或计时器。

两条 G2 均为 deaths 历史持有者，恢复继续使用独立服务器 authority 认证整份 Match，并核对原有资源／奖励；外部双边结果按冻结输入冷重演核对完整数值、复制体、额度和事件。错误沿用 Match 验证错误及 `BattleValidationError('invalid-result'|'battle-input-invalid')`，不新增客户端失败枚举。内容身份重算，现有 schema/save/replay/command 和 epoch 均不重录。

## 2026-10-27 Batch 5 G3：空战与物竞天择

正式内部 ID 为 `aerial-warfare`（B5-68）与 `natural-selection`（B5-71），来源与约定分别见 S13_RULES_GAP 的 P-B5-68-G3／P-B5-71-G3。两者为金色；前者三节点按原规则报价，后者保留 14.24 的 2-1 禁令，后两节点均按对应羁绊过滤。新内容位于 `content/augment-pool-batch5-g3.ts`，其礼物由既有 `batch1GiftPlan → drainBatch1Gifts` 的共享池奖励事务发放和独立计划验证，不新增公共命令、金币来源或第二套服务器结算。

`restoreSharedOrbSnapshot(pool,input,authority?)` 对 G3 持有者调用同一礼物计划验证；即使没有持有者，只要收据来源为 `augment-pool-batch1` 或身份处于该 JSON 数组命名空间，也必须认证。非法礼物索引、孤儿收据或来源不符抛 `RangeError('Invalid augment batch1 gift authority')`；同步篡改关联法球、掉落、领取收据及资源来源不能绕过此认证。对象、JSON 和规范 JSON 文本遵循相同入口，合法档恢复后重复发奖仍保持原收据数。

这两项不需要跨轮事实，不登记 augmentHistory 持有者，也不读候选存档重造历史。既有持有者仍只通过 `augment-history.ts` API 获取历史。物竞天择的献祭单位和装备始终留在正式准备阵容；战斗投影缺席不构成资源售出、阵亡或卡池返还。`readG23MechanismState(state)` 的 owner-only 视图可额外返回 `mutationSacrificeCell:{col:3,row:6}`；`laboratories` 保留普通实验室的含义。不新增布局或视觉实现。外层 schema/save/replay/command 和 NET 版本沿用基线；新内容摘要必须精确匹配，不重录旧 epoch。

## Batch 5 G4：B5-72／73（P，2026-10-27）

内部赠物入口继续为 `batch1GiftPlan(state:MatchState):AugmentGift[]`、`drainBatch1Gifts(state,policy?):MatchState`，新增规则计划 `b5VoidSwarmGiftPlan(state:MatchState):AugmentGift[]`。B5-72取得时赠芮尔、莫甘娜各1名；在线沿已有有限共享卡池奖励法球，满席继续沿已有领取／held策略。B5-73取得时赠传送门，此后从取得当轮起每11个已结算PvP再赠1个；读取 `roundResults` 并由 `requireAugmentFacts` 认证每个 `pvp-roster`，不计PvE／选秀。阈值收据绑定原choiceId及第几次11战，原资源／赠物校验器重算应发结果。

两张卡使用现有 `augment-history-v1`：voidcaller登记acquire，void-swarm登记pvp-roster；事实全部通过已有API记录，联机恢复须由 `Room.augmentHistoryAuthority(seatId)` 提供独立authority。没有新增网络命令、wire失败reason、第二套保存版本或服务器规则；源文件 `augment-pool-batch5-g4*.ts`。缺历史／缺PvP边界／无独立authority沿历史合同拒绝；赠物仍沿原失败枚举和失败原state／无事件／无资源及RNG消耗规则。候选：B5-72三节点、后两次按冻结先知成员过滤；B5-73仅2-1，保留原14.24禁用语义。数值证据和运行约定见S13_RULES_GAP的P-B5-72、P-B5-73。

G4 出生修订 `augment-pool-batch5-g4-v25-spawn-1`：内部 `castB5Voidcaller(ctx,caster,spent,counters,pending):void` 消费实际耗蓝阈值、冻结触发者格子并排队，累计成功数加同队待出生数共同限制上限；`spawnB5Voidlings(ctx,state,pending,counters):void` 在所有既有行动者完成规划后，逐只按触发格和当时占格重选最近空格（距离／row／col），包含更早成功出生的虚灵。无空格则跳过余下出生，阈值已消费但不累计召唤数、不发布出生事件；成功后才累计并初始化，首次行动仍为下一 tick。没有新增命令失败原因，合法的同 tick 跳跃占格不再抛 `Spawn cell unavailable`。
## G5：B5-82／B5-85 奖励接口（2026-10-27，P）

公共命令、传输与存档外层版本不变；新规则由 `src/simulation/augment-pool-batch5-g5*.ts` 实现，静态内容为 `content/augment-pool-batch5-g5.ts`。三次掷骰接到现有 `selectChoice` 和自然轮入口，管道接到通用 `claimOrb`／结算 FIFO；服务器继续只调用现有共享池事务，无 `src/server/` 调用点变更。

| 导出 | 输入／输出与失败 |
| --- | --- |
| `expectedUnexpectednessRolls(state: MatchState)` | 从已拥有来源重算已到期的阶段、round、三骰、档位、奖励和唯一金币键；无来源返回空数组。`expectedDiceBand(dice: readonly number[]): ExpectedDiceBand` 对非三个 1–6 整数抛 `RangeError('Invalid expected dice')`。 |
| `expectedUnexpectednessRerolls(state: MatchState): number` | 只返回该强化已确定的免费刷新额度，不读取生产奖励收据；现有账本负责消费。 |
| `pipelineExtraOrbs(state: MatchState): OrbPlan[]` | 联机下一 PvE 到期后重算一球；选择前／尚未到期／单人返回空数组。标准球内容使用现有 `sampleOrbBox(...,'ultraPlus')`。 |
| `pipelineBonusPlan(state: MatchState)` | 经 `readAugmentFacts` 读取已实际完全开球的证据，重算 `round/orbId/reward/giftOwner/receiptId`；无来源返回空数组，缺历史沿用历史 API 的明确拒绝。 |
| `batch5G5GiftPlan(state: MatchState): AugmentGift[]` | 合并三次骰子和已开棱彩球的礼物，复用 P-AG1；英雄排入现有共享池奖励球，锻造器仍受备战席容量约束。 |
| `drainBatch5G5Gold(state: MatchState): MatchState` | 由已确定计划调用 `grantMechanicGold`，同键不重发；内部非法授权抛 RangeError。`validateBatch5G5Rewards(state): void` 检查完整金币计划、唯一性、金额、回合、礼物覆盖和历史，篡改抛 RangeError。 |

`claimOrb` 失败原因继续使用原枚举 `stale-round / unknown-orb / already-claimed / wrong-phase / shared-pool-required / seat-eliminated / invalid-loot`，失败返回原状态和原池，无事件与随机消耗。额外球未杀载体时不可领取；部分领取返回原有成功语义并保留未领条目，全部领取后才产生一次管道历史事实和加奖。金币收据 namespace 为 `augment-pool-batch5-g5`；物品／英雄／工具沿用独立礼物计划的 `augment-pool-batch1` namespace。全部数值、证据级别和主表保留项见 S13_RULES_GAP 的 P-B5-82／P-B5-85。
### B5-G6：我成C位了（P-B5-83，2026-10-27）

- 正常报价保留14.24阶段禁表：本卡无2-1/3-2/4-2禁令。公共命令仍是 `selectChoice`，无新增客户端命令、失败枚举或服务器专用奖励公式；房间现有共享选择/入轮路径直接调用领域规则，无 `src/server` 修改。
- `augment-pool-batch5-g6.ts` 内部生命周期：`grantCarryGolem(state: MatchState): {state: MatchState; events: readonly MatchEvent[]}` 在取得事务中固定授予一次免费棋盘魔像及三件装备；重复调用返回原对象和空事件。没有可用出生格、无效装备内容为内部 `RangeError`；合法匹配的部署区有空位。`growCarryGolem(state: MatchState): MatchState` 接正常入轮与联机加时，按取得轮与当前轮推导星级，同阶段重复调用不写状态。
- `augment-pool-batch5-g6-stats.ts`：`carryGolemGrowth(round: number, acquiredRound: number): number` 返回经过的阶段数；`carryGolemStar(round, acquiredRound): StarLevel` 返回1～4；`carryGolemEffects(round: number, owner: OwnedAugment, unit: Unit): Effect[]` 只对carry-golem产生475×阶段数平面生命和2000×阶段数AD基点；`carryGolemBaseStats(starLevel: StarLevel): ResolvedUnitStats` 读取原型星级面板。非法轮/星级抛 `RangeError`，其它单位返回空效果。2-1取得的2/3/4/5+阶段星级为1/2/3/4，晚取得从1星起、不追认之前阶段；加时仍第6阶段。
- `validateCarryGolem(state: MatchState): void` 在离线与共享恢复入口执行：核对持有者、唯一单位、推导星级、四张获取收据、固定装备位置与7条连续资源来源事实；魔像坐标必须为默认棋盘己方部署区内无重叠的整数格。从资源流起点独立累计装备获取、合成、消耗品替换产生的分配，核对每次连续序号及最终 `nextItemSerial`，不依赖收据或当前装备ID反推起始值。无持有者的残留单位/收据同样拒绝。对象、JSON、规范文本及传入房间 authority 的恢复均检查；失败为 `RangeError('Invalid carry golem authority')`，沿各恢复入口原有错误封装；不修补缺失凭证。
- 存活伤害沿用训练师魔像政策：附赠魔像不进入 `countsG23SurvivorDamage` 的伤害人数，10英雄加魔像全存活时 `opposingSurvivors=10`，正常进入 `applyRoundSettlement`，不修改伤害上限。`applyG23Radiant(state, newItemIds?)` 的全量与后续新增装备转换均跳过魔像固定套装；消耗品拒绝原子保留state与空事件，精工候选查询返回空列表。普通英雄的同款装备仍正常转换。
- 正式 `StarLevel` 类型可表达4，但 `getUnitStats`、`resolveAbility` 和资源结构检查仅允许carry-golem的正式四星，普通英雄仍一至三星；既有战斗临时四星规则不变。无新增历史事实或保存节，内容身份脚本重算，旧epoch不重录。研究状态及取整/装备/人口政策详见 `S13_RULES_GAP.md` P-B5-83。
