# M5 Match contract v5

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
- 黑市按map22权重单次抽样，拒领保留微光并累积跳过次数，领取清零；源HealthPerSkip按当前档×次数给成员。跨多断点保留最高一次offer为有限约定。
- Rumble军械库采用弹出选择，可收起，超时确定性选合法项；付费余额不足时选Spare。每3个Rumble参战回合一次，2个未购升级+Spare，付费5金，全购后Finishing，三星下一菜单Titan；不做常驻商店。使用 pendingChoice.kind=armory、choose/timeoutChoice；超时始终选择0金项（普通Spare、全购Finishing、三星Titan），余额不足的付费选择拒绝并保持原对象。菜单待选期间拒绝卖出Rumble；联机购买合星改变菜单时刷新offers并增加generation，旧选择失效。
- Rumble三星自爆为双抗合计的20000%（2000000Bps），死亡伤害先于最后单位判负；实验Mundo120生命与每唯一击杀+60；Sion/Forge有限实体与技能省略范围见对账，不能把归档文本视为完整执行声明。
- G23进度随机流seed xor 0x67323370，初始赞助1词，黑市每offer1词；HighRoller消耗显式Combat流，只有Triple追加二级词。军械库、试验格、奖励原子使用带独立常量/身份的LCG派生流，不污染商店/开局/战斗种子流。失败命令返回原state，无资源、RNG、收据或事件变化。
- 奖励金币在唯一结算事务发放；已确定物品/英雄/工具同步发放，未决物品选择和满席英雄托管。英雄一律 grantMechanicUnit，并透传同事务 UnitLootPolicy；池空按费用折金，满席在碰池前保留待领奖励；卖出释放空间或 claimLoot 时重试。`readG23RewardItemCatalog()`提供奖励apiName、中文名、约定状态。光明装备 kind=radiant 且 radiantOf 指向唯一普通成装；通用物品读取统一到 g2-3-item-registry，普通recipe/重铸/轮盘/临时装备池不随奖励目录扩大。

- 召唤物结算约定：Sion维持阵营存活，Forge与预留桶id不维持；所有战斗召唤物不增加玩家伤害。Forge生成及复活空格搜索按席位坐标后镜像。
- #134已合入并完成rebase；卡池policy透传、通用机制金币校验、非战斗召唤物判负均已接入，详见 [PR134接入清单](evidence/g2-3/PR134_INTEGRATION.md)。

### G2-3 / Claude 服务器配套交接（本PR不越界）

`src/server/`、`src/rendering/`、`src/server-entry/`不由本PR修改。领域已经接入#134的容器、choose/skip/timeout、召唤帮助函数和事件、radiant种类、金币来源/失败枚举。准备期不创建永久Sion/Forge资产；开战投影经spawnCombatUnit进入Combat，发unitSpawned；Sion发bindingChanged，High Roller发castOutcome。Forge死亡后恢复同一实体发unitRevived，未发生移除/重生，因此不复用已移除id。removeCombatUnit记录废弃id，spawn拒绝复用。

双边`proposeSettlement()`产生`SideProposal.g23Facts`；服务器必须原样转到`RoundSettlementReceipt.g23Facts`，仅实际参与席位结算，镜像无进度/收益。当前`src/server/room/room.ts`的`buildReceipt`（约1052行）仍只复制旧字段；Claude需补`...(proposal.g23Facts ? {g23Facts:proposal.g23Facts} : {})`，不自行算规则。该转发未完成前不能宣称G2-3联机机制已上线。见`docs/UI_REQUESTS.md`的G23-SERVER-FACTS。冻结战斗输入的g23/playerHp由规则快照函数提供，服务器不得另造进度。


> M8 B2审计修订待复审，目标合同见 [M8_RULES.md](M8_RULES.md) 与 [M8_UI_CONTRACT.md](M8_UI_CONTRACT.md)。本文件仍描述当前M7运行行为；新类型未接入，正式版本切换由B3–B9完成。

Public entrypoint: `src/simulation/match.ts`; public state: `match-types.ts` and `strategy-types.ts`. [M5_RULES](../M5_RULES.md) defines exact values and ordering. Match is the sole authority for economy, resources, schedule, progression and terminal state. The historical M4 contract is available in Git at the M4 baseline; this document describes the current API.

- `createMatch(seed=42)` accepts uint32 including zero. It returns schema5/rules `m5-14.24b-v1`/content `s13-14.24b-slice-v1`/protocol2, a complete content digest, 100HP/10G/level3 and the three starting units. Opening component choices precede the first augment. Round1 means2-1; round35 means6-7.
- Successful commands return `{ok:true,state,events}`. Failure returns `{ok:false,state,reason}` with the identical original state, no events, and no partial gold, shop generation, RNG, ID, receipt, growth or sequence mutation. `setShopLock` with the current value is a successful unchanged-state no-op.
- Preparation permits buy/sell/reroll/XP/deploy/item/lock commands. Buy validates generation and purchased status before resources, plans recursive triples atomically and checks final bench capacity. New candidate IDs consumed in upgrades are never reused. Price and sell value come from definitions, never UI.
- F costs4G/4XP, rejects wrong-phase then max-level then insufficient-gold, and never changes the current shop. Level9 caps XP at0. Requested and applied XP are separately recorded. D costs2G and keeps the lock flag. Natural Continue refreshes only unlocked shops; every generated shop consumes ten shop words and increments generation.
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
  receipts: MechanicReceipt[];           // 只追加的收据，本席可见
}
readSeatMechanic(state, key) / readHiddenMechanic(state, key)
writeSeatMechanic(state, key, value | undefined) / writeHiddenMechanic(...)   // 纯函数，undefined 删除
appendMechanicReceipt(state, receipt) / findMechanicReceipt(state, receiptId)
```

- 值只能是纯 JSON，数字必须是安全整数（百分比用 bps），写入和恢复都会校验，不合格抛 RangeError。
- 预留键：`conqueror`、`academy`、`alchemist`、`junkerKing`、`experimentCells`、`radiantConversion`。G2-3实际形状（全部owner-only；这里只列结构，数值口径见顶部）：
  - conqueror `{stacks, chestsOpened, receipts, rewards}`：永久征服进度/战斗去重事实、已获得奖励包；15档阈值从内容表查询
  - academy `{sponsored: string[3]}`；已发物品从source=academy的MechanicReceipt读取
  - alchemist `{shimmer, losses, skips, offeredThrough, offer}`；offer是已抽出的当前机会，不是未来候选
  - junkerKing `{rounds, purchases:[{id,round,unitId,upgrade,cost}]}`；购买映射必须与对应choice收据一致
  - experimentCells `{col,row}[]`
  - radiantConversion `boolean`（第15档生效后true）
- 凡是影响界面显示或客户端选择器（羁绊、属性、previewCombine、previewEquip、getDeploymentCap）的状态都放 `seat`；客户端拿不到 `hidden`，选择器不能读它。
- 需要界面播提示时，同一命令里发 `{type:'seatMechanicChanged', key}` 事件。
- `restoreMatch` 只做结构校验（`validateSeatMechanicsState`），各机制自己的不变量由 Codex 补进恢复校验。

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
- 超时：`forfeitPendingChoice` 选 `payload.timeoutOption`，事件 `choiceTimedOut{resolution:'default-option'}`，收据 `timedOut:true`。军械库的 timeoutOption 价格必须是 0（免费"备用零件"），打开时校验，所以超时永不扣钱；黑市可以用 `@skip` 当超时项。源表的无物品奖励包（LootA4）使用blackMarket的可选`grantItem:false`，offers为源奖励包apiName；通用层只记接受/跳过收据，不造占位物品，领域层发包内英雄/有限复制奖励。默认不带此字段仍按物品选择运行。
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
