# Set13 八人联机合同草案

## v20-live-combat（当前正式 epoch，2026-10-22）

父 epoch 为 `v20-xp68`，集成基线 `db04d196e4a12933624add7d61be9081a639607f`（#384、#385、#386、#388）。rules/content 为 `s13-g2-3-v20-live-combat` / `s13-14.24b-g2-3-v20-live-combat`；CONTENT `fnv1a32-utf16:93fad04c`，LOOT_REPLAY `fnv1a32-utf16:49eb9cf0`。
schema/save/replay/command 为 **11/7/5/5**，网络 **NET6**、规则侧多人契约5。继承黑市候选及决策字段，Match 与 SaveEnvelope 结构不再增加，schema/save 保持父版11/7；replay/command 从4/4升5/5，标识实时战斗流及逐 tick 输入边界。所有旧 rules/content/digest/replay/command 身份严格拒绝运行态恢复，无迁移；历史 epoch 原字节保留。
完整保留8→9 / 9→10各68 XP、梅尔救命精确HP核对、B 补丁16具名字段、标准 PvE 不增微光、黑市至多三包 N 选一与保留、迅击/野火/搭档及 #381 预热。流式首遍只改变推进与传输，逐字节对照旧整轮结算；双游标、绝对50ms排拍、客户端四拍缓冲、整拍合并推送、战中买卖利息及空输入挂点见 [LIVE_COMBAT_PHASE1](LIVE_COMBAT_PHASE1.md)。非空逐 tick 装备输入仍报 `battle-input-unsupported`，未安装、不记成功日志。
独立录制与只读核验命令、来源及风险见 [RELEASE_NOTES](evidence/v20-live-combat/RELEASE_NOTES.md)。本节覆盖下文历史身份。

## v19 第二部分（历史规则合同，2026-10-21）

同一v19包含家人5随机任务法球、13.4六人彩蛋回移、六费 warwick / viktor / mel 与22种纹章总基础属性替换。schema/save/replay/command＝**9/5/4/4**；旧身份拒绝，无迁移，50ms和lcg32-v1不变。数值、魔改/未验证清单、导出签名、RNG、失败/恢复、说明底部显示字段及表现层交接以 [V19_PART2](V19_PART2.md) 为准；下文旧“家人预留/六费延期/纹章未改/8-4-3”描述已被本节覆盖。


PR #364 收尾的最终 CONTENT/LOOT_REPLAY 为 `fnv1a32-utf16:242e7562` / `fnv1a32-utf16:df0d757c`。本人座位的 `toPrivateSeatView(state:MatchState)` 提供 `familyReunion.{eligible,participantIds,downgraded,downgradedAtTick}`（准备资格/冻结开场成员及本战实际退星），及 `shopOdds.sixCostBps`（整数基点，10000=100%，按当前回合与等级由规则提供）。只读，不发事件/消耗 RNG；显示端不得重算触发或概率。具体输入输出见 [PR364_CI_REPAIR](PR364_CI_REPAIR.md)。

## v19 第一部分领域合同增补（历史阶段，已被上节覆盖）

当前rules/content=`s13-g2-3-v19` / `s13-14.24b-g2-3-v19`，schema/save/replay/command=8/4/3/4，领域NET4/网络NET5不变。CONTENT=`fnv1a32-utf16:9ba56127`、LOOT_REPLAY=`fnv1a32-utf16:8d45a042`；旧身份拒绝，无迁移。完整规则、推断/约定/魔改与字段见 [V19_MECHANICS](V19_MECHANICS.md)。当前61强化/27羁绊；姐妹对应强化及伙伴门槛由领域快照冻结，服务器不自行补羁绊或计算增益。

`g23Facts.itemGoldPayouts` 沿既有 proposal→receipt 原样转发，`amount:1|3`：新增 `perfected-chainblade` 必须为3金，其他kind仍为1金。战后同一事务按金额合计，通过唯一收据到账；镜像仍不领取额外结算。新增可选动画字段为 `castOutcome.castVariant {actionSeq,move,channelTicks,enhanced,heroAugmentIds}`，由既有 `toCombatViewEvents` 白名单直接投影，服务端不得再抽招/生成英雄强化标记；3D消费说明见COMBAT合同。没有新增客户端命令、失败枚举或网络封套。

`seatMechanics.seat.familyHeist` 只是预留的owner-only存档位置，v19不初始化、不推进、不发奖。服务器继续仅编排领域公共导出。本轮未修改服务器或3D渲染接线，也未声明端到端上线验收完成。

## v17 当前状态（草稿，覆盖下文历史身份）

贪财化身恢复联机池，异常单机56/联机55→56，强化60；两模式按备战席/普通棋盘/可晋升棋盘目标过滤为54/55/56。rules/content 同升 `s13-g2-3-v17` / `s13-14.24b-g2-3-v17`，CONTENT `de829c8a→8a955c10`，LOOT `62c76cb9` 与规则manifest `31950a0f` 保持。schema/save/replay/command=7/3/3/4、领域NET4/网络NET5均不升。CURRENT与新证据切到v17，v15/v16原字节保留。发版排空对局、旧身份无静默迁移；PR保持草稿，等v16发版收口后合。完整约定见 [V17_AVARICE_ONLINE](V17_AVARICE_ONLINE.md)。下文v15身份为历史。

## v15 统一身份（2026-10-20，覆盖下文历史交接状态）

当前 rules/content 为 `s13-g2-3-v15` / `s13-14.24b-g2-3-v15`，commandProtocolVersion=4；schema7/save3/replay3/lcg32-v1/50ms 保持。领域网络目标 MULTIPLAYER_NET_PROTOCOL_VERSION=4，法球合同 multiplayer-orb-claim-v2。旧 v14 身份、旧摘要及 command3 按严格边界拒绝，无迁移。完整 60/54 目录、D11 来源系数与执行约定已进入 CONTENT_DIGEST，preD11 过滤已移除。强化 manifest 为 augment-card-reroll-v15：初次三字、刷新一字，每选择每槽一次，刷掉 ID 本局本席永久移出。

新证据写入 docs/evidence/v15 与 tests/fixtures/v15-*，CURRENT Herald 生成器指向 v15；G2-3/G2-4b 历史数据与审计断言保留。最终 digest、实际录制/测试结果及服务器配套边界见 [V15_RELEASE](V15_RELEASE.md)。下文“待统一、不改 digest/command3”为此前交接记录。服务器 NET 常量与接线仍由 Claude 完成，领域切换不代表端到端上线完成。


## 规则协议与网络协议独立版本

- `src/simulation/m8/version.ts` 的 `MULTIPLAYER_NET_PROTOCOL_VERSION = 5` 表示规则侧多人命令/状态契约版本；该契约发生不兼容变化时递增。
- `src/server/net/messages.ts` 的 `NET_PROTOCOL_VERSION = 6` 表示客户端与服务器之间的网络消息信封契约版本，用于消息的 `protocolVersion` 校验；网络消息（含命令、回执及服务器消息）的结构或语义发生不兼容变化时递增。兼容的视图字段追加不必递增。
- 两者独立演进，可以不同，不要求相等或保持固定差值；修改一侧契约不自动要求另一侧升版，应分别评估兼容性。历史 D11 的 `replay-tail` 只改变网络回放消息契约，当时分别为 4 和 5；v20分别为5和6。网络版本校验比较客户端消息与服务器的 `NET_PROTOCOL_VERSION`，不比较这两个常量。

## D11 接线与实时银行边界（2026-10-20）

当前运行目录60/56；强化共用既有等级、候选和按卡刷新命令。一费奉献 / 三项赛赠送先经唯一 mechanic 收据产生奖励法球，不立即取卡或补金；显式领取时经过同事务 UnitLootPolicy，按法球合同处理战斗排队、战后库存、合星、满席折金和缺货补偿。双方 snapshot 编译新增内容，贪财化身开战携带 bankGold；猎头者基础 / 永久攻速及灵魂连接开战玩家生命均为本席权威输入。

`G23BattleFacts.d11Headhunter?: {combatId:string,holderId:string,kills:readonly {eventSeq:number,victimId:string}[]}` 经已有 proposal.g23Facts 原样转入 settlement.g23Facts。服务器不统计击杀、不另算永久成长；镜像无 facts / 进度，重复拒绝。猎头者已部署时缺失事实、holderId 不是该席当前绑定的战斗命名空间 ID，或 eventSeq 超出账本，均按 invalid-receipt 保持原状态拒绝。

现有 `startTwoSidedBattle` 返回任务的 `sampleBankGold(seatId:string,liveGold:number):boolean`，状态变化且记录样本为true，相同有效银行/未绑定/镜像B为false；非法席位 / 数值 / 样本上限为 `invalid-bank-sample`，完成后为 `wrong-phase`。样本在规则游标t之后、t+1执行前应用，不能称显示下一帧生效。私有 `BattleResult.bankSamples?: readonly {tick:number,team:'player'|'enemy',liveGold:number}[]` 必须随完整结果传给 `proposeSettlement` 与 `toCombatReplay` / `startCombatReplay`，公开 replay 不发这些样本。原有采样缺省路径和旧结果字段不变，不加客户端“报金币”命令。

**实时银行已接通（#254/#258）**：Room按成功命令顺序捕捉权威Match.gold；PvP live轨道记录样本、采用live结果结算，并推送公开replay-tail。PvE先catchUp再操作，stepMatch读取实时银行。`LIVE_BANK_LEAD_TICKS=8`（0.4秒显示前瞻），首次目标超过冻结终战tick不建轨；即使动画未结束也不能保证还有下一规则步。详见v17文档的时间边界与“服务器侧待补测试”6条清单，服务器测试归Claude补。公开statuses/choiceEffects与私有d11Display保持白名单，不公开银行；未扩大静态PublicBoard。

## 强化同轮同级与按卡刷新：待 v15 收口（2026-10-20）

等级派生不变，详见 [Match 合同“强化等级与按卡刷新”](MATCH_CONTRACT.md)。initializeSharedSeat 将 pool.seed 绑定到 augmentTierSeed；每节点八席同级，候选与刷新仍用各席独立 choiceRngState。单机/联机共用每槽免费一次与永久移出规则；移出集合只属于本局本席，不从其他席候选中移除，不改变英雄共享库存。

领域已增加 `SharedMatchCommand` 分支及 `runSharedMatchCommand` 转发：

```ts
{ type: 'rerollAugment', choiceId: string, generation: number, optionIndex: number }
// 例：第 2 张卡
runSharedMatchCommand(pool, state, {
  type: 'rerollAugment', choiceId: 'round:2-1:augment', generation: 0, optionIndex: 1
})
```

公共签名 `rerollAugment(state,choiceId,generation,optionIndex?:number):MatchCommandResult`，有效命令必须有 0..2 安全整数下标；可选类型仅为禁改旧接线的编译过渡，缺参返回 invalid-slot。失败按顺序为 wrong-phase、stale-choice、invalid-slot、augment-rerolls-exhausted、augment-pool-too-small（零候选）。共享包装另沿用 invalid-pool/invalid-seat-state/stale-seat/seat-eliminated 等原事务错误，先验证 pool/seat；失败保留原 pool/state 引用、无事件或 RNG 消耗。

成功由共享事务原子提交 pool+state：可用库存、预留和 holdings 不变，但 pool.revision、该席 revision 按既有事务各 +1，不能把“库存不变”误解成“pool 对象/revision 不变”。成功发一个 choiceOpened，完整候选/槽位状态与正常 eventSeq；每卡刷新恰一字，初次三卡发牌仍三字。

**Claude 待接线，本轮未改 src/server：** SeatCommand/ClientCommand/WireCommand 与 net/messages 的字段白名单增加必填 optionIndex（0..2 安全整数）；原网络 envelope 的身份、round、seatRevision、去重及回执字段保持。ROOM_COMMAND_GATE 沿用 preparation/choice，领域仍要求真实 augment offer；applySeatCommand 改走上面的 runSharedMatchCommand，原样转交下标并原子接收 pool+state。旧三字段消息不得默认槽位，也不得重发为整组刷新；现在无下标的旧调用会失败。前后端在 v15 同批接线发布，NET3 等版本号本轮不动。

私有投影 `pendingChoice.augmentOptions: readonly {optionIndex:number,definitionId:string,rerollAvailable:boolean}[]` 与 `rerolledSlots` 已由 toPrivateSeatView 提供，toSeatPrivateView/网络应原样透传；保留 offers、augmentTier、generation、rerollCount、rerollsRemaining（尚未用过的槽位总数）。只按每卡 rerollAvailable 接按钮，候选耗尽也置 false。不公开 removedAugmentIds/augmentOffers/seed/其他席候选。

basic bot 与超时代选仍选第一个合法项，不主动刷新强化，无需增加刷新策略；bot preflight 已读取可选下标，缺参不会被判为合法。若未来扩展策略，应复用同一 SharedMatchCommand，不能另算候选或计次。

权威 MatchState 的 removedAugmentIds、augmentOffers[].rerolledIndices、pendingChoice.rerolledSlots 必须随席位持久化/恢复，断线重连不能清空。既有 serializeMatch/restoreMatch 不接纳联机完整 Match；本轮共享测试验证 JSON 往返后续刷，未新增服务器磁盘恢复入口。版本与待重录清单见 [v15 交付说明](AUGMENT_CARD_REROLL_V15.md)。


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
- 黑市次级微光复制器（用户2026-10-17 15:20）：仅复制本席场上/备战席已拥有的≤3费炼金男爵；100微光LootA/LootA4及200微光LootB1的权重、数量不变。无目标/满席沿用托管，仍透传同事务UnitLootPolicy。复制器奖励原子新增可选`duplicatorDefinitionId`保留源API身份；现有领取收据、选择指令及自动处理方式不变，征服者第4档小英雄复制器不受影响。完整约束见MATCH_CONTRACT顶部同名条款。本分支暂不升版本，合并时取multiplayer当时版本+1。
- Rumble军械库采用弹出选择，可收起，超时确定性选合法项；付费余额不足时选Spare。每3个Rumble参战回合一次，2个未购升级+Spare，付费5金，全购后Finishing，三星下一菜单Titan；不做常驻商店。使用 pendingChoice.kind=armory、choose/timeoutChoice；超时始终选择0金项（普通Spare、全购Finishing、三星Titan），余额不足的付费选择拒绝并保持原对象。菜单待选期间拒绝卖出Rumble；联机购买合星改变菜单时刷新offers并增加generation，旧选择失效。
- Rumble三星自爆为双抗合计的20000%（2000000Bps），死亡伤害先于最后单位判负；实验Mundo120生命与每唯一击杀+60；Sion/Forge有限实体与技能省略范围见对账，不能把归档文本视为完整执行声明。
- G23进度随机流seed xor 0x67323370，初始赞助1词，黑市每offer1词；HighRoller消耗显式Combat流，只有Triple追加二级词。军械库、试验格、奖励原子使用带独立常量/身份的LCG派生流，不污染商店/开局/战斗种子流。失败命令返回原state，无资源、RNG、收据或事件变化。
- 奖励金币在唯一结算事务发放；已确定物品/英雄/工具同步发放，未决物品选择和满席英雄托管。英雄一律 grantMechanicUnit，并透传同事务 UnitLootPolicy；池空按费用折金，满席在碰池前保留待领奖励；卖出释放空间或 claimLoot 时重试。`readG23RewardItemCatalog()`提供奖励apiName、中文名、约定状态。光明装备 kind=radiant 且 radiantOf 指向唯一普通成装；通用物品读取统一到 g2-3-item-registry，普通recipe/重铸/轮盘/临时装备池不随奖励目录扩大。

- 召唤物结算约定：Sion维持阵营存活，Forge与预留桶id不维持；所有战斗召唤物不增加玩家伤害。Forge生成及复活空格搜索按席位坐标后镜像。
- #134已合入并完成rebase；卡池policy透传、通用机制金币校验、非战斗召唤物判负均已接入，详见 [PR134接入清单](evidence/g2-3/PR134_INTEGRATION.md)。

### G2-3 / Claude 服务器配套交接（本PR不越界）

`src/server/`、`src/rendering/`、`src/server-entry/`不由本PR修改。领域已经接入#134的容器、choose/skip/timeout、召唤帮助函数和事件、radiant种类、金币来源/失败枚举。准备期不创建永久Sion/Forge资产；开战投影经spawnCombatUnit进入Combat，发unitSpawned；Sion发bindingChanged，High Roller发castOutcome。Forge死亡后恢复同一实体发unitRevived，未发生移除/重生，因此不复用已移除id。removeCombatUnit记录废弃id，spawn拒绝复用。

双边`proposeSettlement()`产生`SideProposal.g23Facts`；服务器必须原样转到`RoundSettlementReceipt.g23Facts`，仅实际参与席位结算，镜像无进度/收益。`src/server/room/room.ts`的`buildReceipt`已由#140补上`...(proposal.g23Facts ? {g23Facts:proposal.g23Facts} : {})`，原样转发、不自行算规则，联机PvP的G2-3机制进度已接通（`tests/server/g23-server-facts.test.ts`覆盖原样转发、重复提交只结算一次、镜像不发奖；`projection-wire`断言g23Facts和economyReceipts不外发）。见`docs/UI_REQUESTS.md`的G23-SERVER-FACTS。冻结战斗输入的g23/playerHp由规则快照函数提供，服务器不得另造进度。


## 1 决定的效力

用户已经确定：开局八席；真人不足以机器人补满；首版使用共享有限卡池；6-7 后继续 PvP 加时直到决出最终名次。实现者不得改回独立无限商店或固定末轮按血量直接结束。

以下职责与一致性规则属于实现该目标的技术边界。具体卡池份数、奖励缺货补偿、平局及同轮名次规则标明为建议或待核定，不冒称用户已经逐项批准，也不改写旧 M8 离线合同。

### 1.1 单一匹配队列与隐藏座位凭证（已确认）

网页准入由用户在本仓库外控制；本仓库不实现账号或登录。进入后只有一个“匹配”入口，不提供建房、邀请码、房主或准备键。服务器同一时间只跑一局：点匹配进入唯一队列，任一队列玩家点开始或等待超时即开局，不足八席由机器人补满。队列已有八人时，第九人得到容量错误，不进入候补队列、不新开第二局；对局进行期间也不另开并行队列/对局。

座位凭证由服务器生成，客户端在连接和重连时自动携带，用于防止冒充和恢复原席位；玩家不可见、不需复制或输入。凭证不进入战斗快照、公共 PlayerView 或战斗事件。首版的网络投递与保管由 T5/T6 实现，T2 不实现身份系统。

## 2 对象和权威

- 单局状态拥有八席、共享库存、全局阶段、轮次、截止、配对与排名。B1 的 `RoomState`、`roomId`、`RoomCommandTransaction` 是内部沿用名，分别表示当前唯一对局、对局标识和单局事务，不代表可创建或选择的房间产品。
- SeatState 拥有本席资产、商店预留、HP、经验、待选项与事件位置。
- SharedPoolState 按英雄定义记录初始份数、可用份数及合法占用；不把英雄种类数量误当成每种英雄份数。
- RoomCommandTransaction 是修改卡池和席位资产的唯一提交边界，客户端和机器人都不能直接改字段。
- BattleInput 冻结两方合法阵容、装备和效果；BattleResult 是单次配对的唯一权威结果。
- RoundSettlement 汇总结果后提交资源、排名与淘汰；重复提交不重复生效。
- PlayerView 仅包含可见数据，不下发内部随机流、他人私有商店或全池精确计数。

金币、HP、轮次和卡池占用各有一个权威来源。兼容旧 MatchState 时，其他表现只能派生，不能让对局调度器和单人 Match 分别推进并互相覆盖。

## 3 共享卡池账本

### 3.1 基础单位与守恒

按英雄定义 d，要求初始份数等于可用份数、全部商店预留份数、全部真实持有份数和合法待领取预留份数之和。每项均为非负整数，不能超卖。

普通一星、二星、三星分别承载 1、3、9 份基础棋子；以来源账本保留合成前的份数，不能根据显示单位数量回池。任何特殊直接升星、奖励或额外复制均须有单独的来源规则，不能套显示星级凭空增加库存。

暂不支持的复制类机制不得偷偷绕过库存。战斗召唤物、对手镜像、回放副本和 UI 投影不属于可出售实体，不占用也不归还卡池。

### 3.2 操作行为

| 操作 | 卡池变化 | 同事务的其他变化 |
| --- | --- | --- |
| 生成商店 | 从可用池取出并预留到具体席位、generation、slot | 商店、随机状态、generation |
| 购买 | 商店预留转为真实持有，不再扣一次可用库存 | 金币、单位获取与合成、装备转移 |
| 刷新 | 归还未购买格子的预留，再按规则重新抽取 | 刷新费用、商店、新随机状态 |
| 锁店 | 保持当前预留，不能自然刷新偷偷释放 | 锁店标记 |
| 升星 | 合并持有来源，基础份数不变 | 单位、装备、成长和绑定迁移 |
| 出售 | 按真实持有来源释放份数 | 售价、单位移除、装备归还 |
| 淘汰 | 释放商店与实体单位、按合同处置待领取占用 | 席位状态与名次；只执行一次 |
| 开场或奖励获取 | 必须经过明确的池内取得或特殊来源合同 | 奖励收据、资产、待领取状态 |
| 暂时断线 | 不释放商店或单位 | 只改变连接或控制者状态 |
| 镜像战斗结束 | 不改变镜像原主的卡池占用 | 只结算实际参战席位 |

购买失败、刷新失败和过期请求必须保留原状态，包括金币、卡池、商店占用、随机流、ID 与事件序列。实现时先生成合法事务提案，确认全部可提交后再替换权威状态。

“争最后一张”主要发生在商店生成或其他从可用池获取的时刻，因为已经显示在商店的卡应已有该席位的预留。测试不能只在购买时扣池，导致多人的商店同时承诺同一份卡。

### 3.3 抽取与公平性

费用概率优先复用现有等级表；同一费用层内按可用份数加权，而非对英雄名等概率抽样。层内和跨层缺货行为必须显式定义，不进行无上限重抽。

TP 定稿：在原概率大于零且仍有可用卡的费用层之间归一化；没有合法层则留下明确空格。付费刷新在释放旧店后仍完全无法生成新卡时免费失败，所有状态不变。这是项目缺货规则，详细算法与随机消费见 §12。

全局自然刷新先统一释放应刷新的旧商店，再用可复现的轮次抽签顺序生成新商店，锁定商店不释放。每轮变化顺序，避免永远让固定座位优先取得稀缺卡；手动操作按服务器收件与队列顺序处理。

抽卡随机流属于服务器。每类操作的消费次数写入新联机合同，不能为兼容旧无限商店的固定两次抽样而掩盖缺货分支。

### 3.4 初始份数与内容切片

Riot 的 [14.15 官方更新说明](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-15-notes/)明确列出各费用英雄池份数为 30、25、18、10、9。这是可追溯的历史参考，尚不能仅凭该页面断言整个 14.24b 版本全部细节相同。

用户于 2026-10-12 指定采用上述 30/25/18/10/9，TP 已写入 `shared-pool-v1` 的 `POOL_CAPACITY_BY_COST`，只用于现有 19 位英雄。显式微型库存仅用于测试/配置夹具，不能超出官方每英雄上限。

当前 SHOP_CATALOG_BY_COST 是 19 位英雄，费用种类数量为 5、5、5、3、1。共享池仅覆盖实际支持的英雄；不自动增加目录外单位，不因高费英雄种类少而私自增加份数。

### 3.5 开场与奖励（TP 已定稿）

八席开场各一张 Irelia，先统一占池再生成共享商店。`createMatch` 产生的单人初始店不得发布；初始化入口替换为尚未生成的共享店，见 §12.2。

冻结未来奖励不预留；已赚棋子在实际领取事务首次尝试发放时预留，满备战区保留待领取占用。有货但超时仍不可领取则放弃回池，淘汰同样释放。用户确认缺货时按该英雄一星购买价补等额金币，使用唯一奖励收据，不重复发奖。未赚奖励不预留、不补偿。来源、领取与释放时点见 §12.4。

## 4 多人战斗与结算

1. 双方快照只包含合法上场单位及其完整效果，建立局部 ID 与真实席位资产的映射。
2. 同一次配对冻结一份输入，运行一个 Combat；视角镜像不等于再运行一场单人 Match。
3. A 和 B 的装备、强化、异常与成长均生效，不从固定敌军模板取得 B 的属性。
4. 结果回传带 battleId、roundId 与执行代次，拒绝旧轮次或已作废的工作任务。
5. 结算阶段只提交一次，先获得全轮有效提案，再批量计算资源与淘汰；部分失败不能导致半轮扣血。
6. 确定性重试可以重新运行同一冻结输入，但只能采纳一份结果，不能双发奖励。
7. 真实玩家淘汰归还卡池的事务发生在本轮排名计算后、下一轮商店生成前。
8. 固定 50 ms 逻辑步长、整数规则、完整事件与来源账本保持适用；改变规则须有版本与独立预期。

## 5 阶段与加时

单局区分队列等待、准备、选择、冻结、战斗、结算和终局。旧目录中的 PvE、补给及选择节点保留，PvP 节点改为席位之间对战。

用户已选择 6-7 后继续 PvP 加时。加时不继续调用“6-7 自动胜利或失败”的单人终局路径。建议每轮只做 PvP，保留正常经济与共享商店，PvP 加时从第一场起基础伤害为 17，不额外产生新野怪、强化或奖励。

平局扣血、同时归零和名次破同分规则须在 T3/T4 有固定合同。可采用 v2 的扣血后未截断 HP、轮前 HP、固定席位顺序破同分，但不能把它冒称为已核对的官方规则。

奇数存活者使用其他存活者的冻结镜像；不和自己的镜像打，镜像原主不反向受伤，不被重复发收入、成长或返还卡池。

加时必须能结束。测试覆盖连续平局、双方空阵容与多席同轮归零；执行故障产生明确中断状态，不伪造正常名次。

## 6 命令与同步

客户端只提交意图；actor 取自服务器座位凭证。消息有协议版本、roomId、commandId、轮次阶段和动作相关的 generation 或 revision。响应包含明确成功或失败、原因、回执与更新后的可见版本。

同一对局单写者提交事务，所有对共享卡池的更新与席位资产一起生效。其他玩家刷新导致 poolRevision 改变，不应自动使本玩家对自己已预留商店卡的购买失效；校验依据是实际资源依赖。

重复 commandId 同内容返回原回执；同编号不同内容拒绝。窗口外旧请求拒绝并要求同步，不能遗忘后再执行。

重连恢复原席位，旧连接代次失效。商店和资产不因断网消失；临时机器人接管也不重新 createMatch。服务器进程重启的无缝续局是后续增强，首版必须明确中断原局并让旧凭证得到清楚错误。

PlayerView 以白名单生成。具体哪些公开数据可观战另列表；全池精确可用量、未来奖励和 RNG 不默认公开。客户端不能通过本地导入旧存档替换在线状态。

### 6.1 连接心跳消息（PR #229）

服务器向每条打开的 WebSocket 连接发送文本 JSON `{"type":"heartbeat","intervalMs":10000}`；`intervalMs` 为本服务器配置的心跳间隔（毫秒）。该消息不带 `protocolVersion`、`commandId` 或席位数据，不是命令，也没有应用层回执。服务器同时发送 WebSocket 协议层 ping，浏览器自动回复 pong；客户端无需另发 JSON 心跳或 pong 命令。

`src/server/main.ts` 默认启用每 10 秒一次的心跳，静默阈值为间隔的 2.5 倍，默认 25 秒。任意收到的客户端消息或协议层 pong 都更新该连接的最后活动时间；每次心跳轮询先检查静默是否达到阈值，达到则 `terminate()`，否则向仍为 OPEN 的连接发送 ping 和 heartbeat。**25 秒是判定阈值，不是独立定时器保证的断开时刻**：检查只在心跳轮询时发生，例如从时刻 0 起无回音、轮询在 10/20/30 秒发生时，会在 30 秒断开；事件循环延迟还可能推迟检查。

客户端只在当前 socket 收到首条有效 heartbeat 后启用静默检测（`intervalMs` 必须为有限正数）。此后收到任何 WebSocket 应用消息都会重置检测定时器；连续 `3 × intervalMs` 没有消息，默认 30 秒，客户端以关闭码 `4000`、原因 `heartbeat timeout` 关闭该 socket，并立即进入原有重连调度，不等待旧 socket 的 close 事件。新 socket 必须重新收到首条 heartbeat 才启用检测。

环境变量 `CAT_HEARTBEAT_SEC` 配置整秒间隔：未设置或空字符串用默认 10；`0` 关闭服务器的 ping、heartbeat 消息及静默检查；负数、非整数、非有限数或非数字值在启动时抛出 `RangeError`（沿用非负安全整数解析）。直接调用 `createGameServer` 时，`heartbeat` 省略或为 `null` 也关闭；启用时传入 `{ intervalMs, timeoutMs }`，工厂直接使用这两个值，不另作数值校验。

心跳超时沿用原断线路径：**对局内**仅将原席位标为 disconnected，保留席位、资产和凭证；**尚在匹配队列**则退出队列并撤销凭证，不保座。客户端对局内重连仍带原 token 发送 `resume`，按既有 1/2/4/8/10 秒退避调度（最后一档重复），成功后接收原席位快照。若旧 socket 尚未关闭，服务器先提升 `connectionEpoch`、解除旧连接的席位绑定并通知 `session-superseded`，再绑定新连接；旧连接迟到的 close 不会把新连接的席位标为离线。对局故障释放或新局开始后已撤销的凭证，仍按原逻辑返回 `invalid-token`。

本次 `NET_PROTOCOL_VERSION` 仍为 3：以基线 `a0d42c5` 为准，旧浏览器客户端的接收 switch 对未知消息类型直接忽略，不报错、不主动断开；协议层 ping 仍由浏览器自动响应，所以旧客户端可连新服务器。新客户端连旧服务器（或关闭心跳的新服务器）时，因从未收到 heartbeat，不启用静默检测，也不新增任何客户端命令，所以保留旧连接行为。这是对该基线的兼容结论，不承诺绕过既有版本检查接受其他旧协议版本。

## 7 机器人合同

机器人通过同一对局命令入口使用共享有限卡池。不能读本应隐藏的其他商店来作弊，也不能直接给自己造卡或越过费用。

每步读取最新状态、生成一个或一小组具有独立合法性的意图、执行并检查结果，再继续决策。刷新后重读 generation，升星后重读单位 ID，合成装备后重读实例。

限制每轮决策步数；库存耗尽、买不到想要英雄或无合法动作时可以停止，不能无限刷新。机器人弱是可接受的首版质量残余，无法选择、卡住轮次或打破卡池守恒是验收失败。

## 8 首批验收要点

| 用例 | 独立预期 |
| --- | --- |
| 两席同时争取一份可用卡 | 最多一份有效预留，不能向两人出售同一份 |
| 买下已预留卡 | 可用池不再减少第二次，商店预留减一且持有加一 |
| 三张一星升二星 | 持有基础张数仍为三 |
| 出售二星和重复提交出售 | 只回池三份一次，金币只发一次 |
| 刷新失败 | 原金币、卡池、商店、RNG 与 generation 不变 |
| 锁店跨轮 | 锁店原预留不丢失，未锁店统一按规则刷新 |
| 淘汰与断线分别处理 | 淘汰按规则唯一释放；断线不释放 |
| 镜像复制强阵容 | 虚拟阵容不占池、不返池，不改变原主 HP |
| 奖励缺货或待领取取消 | 按定稿合同兜底或释放，不负库存、不发不存在的卡 |
| 八席自然刷新 | 固定初始种子可复现，不永久固定 seat0 优先 |
| 6-7 后仍三席存活 | 进入加时，正确镜像配对，继续至合法终局 |
| 旧连接或重复命令 | 拒绝或原回执，不破坏资产及有限池 |

T1 已集成；T2 规则入口见第 10 节，T3 提交语义见第 11 节，TP 共享池正式入口与规则见第 12 节。

## 9 服务器规则入口（T1）

本节定稿的是**现有单人规则的 Node 运行边界**。双方战斗见第 10 节，产品流程以第 1.1 节为准；T1 不实现匹配服务或账号。

### 9.1 构建、运行和交付

- TypeScript 公共入口：`src/server-entry/index.ts`。后续 `src/server/` 从此入口导入，不复制 simulation，不导入浏览器适配器。
- 构建：`npm ci` 后运行 `npm run build:server`，产物是 `dist-server/index.mjs`、`dist-server/run-battle.mjs` 及它们共用的 `dist-server/chunks/*.mjs`；部署时复制整个 `dist-server/`，不能只复制入口文件。
- 运行环境：Node **22.x，最低 22.12**，使用原生 `structuredClone`、`BigInt` 和 ESM；不为旧 Node 添加替代算法。esbuild 以 `platform=node`、`target=node22.12` 打包省略扩展名的 TS 导入；其默认 JSON loader 会内联 JSON 导入（当前闭包没有 JSON 输入），运行时无需 JSON import assertion、TS loader、Vite、Phaser 或 `node_modules`。
- `esbuild@0.28.2` 从既有锁文件中的传递依赖提升为直接 devDependency，使生产构建不依赖 Vite 是否继续间接安装它；未升级其版本。
- `dist-server/metafile.json` 是构建输入/输出清单；构建及验证均拒绝 rendering、presentation、persistence、replay、`src/server/` 和 Phaser 进入规则闭包。运行时仅加载打包的纯规则，构建文件和产物不含网络服务。
- `node dist-server/run-battle.mjs --seed 42 --max-steps 1201` 在普通 Node 下运行首场战斗并输出 JSON 摘要；加 `--snapshot` 输出完整终态和事件。导入 `index.mjs` 本身不创建对局、不自动运行战斗、不输出日志。
- `npm run test:server-entry` 先重新构建，再运行 `scripts/verify-t1-node-entry.cjs`。无需启动 Vite 或浏览器；报告落在 `artifacts/t1-node-entry/report.json`，产物和临时证据均不提交。

### 9.2 导出函数、输入和输出

下表中 `s` 均为可信 `MatchState`。所有命令复用现有实现和 [Match 合同](MATCH_CONTRACT.md)，不另算规则。`CommandResult` 是表内缩写，对外类型名称为 `MatchCommandResult`。

```ts
type MatchCommandResult =
  | { readonly ok: true; readonly state: MatchState; readonly events: readonly MatchEvent[] }
  | { readonly ok: false; readonly state: MatchState; readonly reason: MatchFailure };
interface MatchStep { readonly state: MatchState; readonly events: readonly MatchEvent[] }
```

| 导出签名 | 输入含义及输出行为 |
| --- | --- |
| `createMatch(seed?: number): MatchState` | uint32 初始种子，含 0；兼容旧入口省略时的固定默认种子 42。服务器必须显式传入 seed。创建现有首轮，非八席初始化。 |
| `deployMatchUnit(s, unitId: string, target: UnitLocation): CommandResult` | `target` 为 `{kind:'board',cell:{col:number,row:number}}` 或 `{kind:'bench',slot:number}`；执行合法部署/移位。 |
| `buyUnit(s, slotIndex: number, expectedGeneration: number): CommandResult` | 当前商店零基格号和 generation，原子购买/合成。 |
| `sellUnit(s, unitId: string): CommandResult` | 出售本方真实单位，复用资源和装备归还规则。 |
| `setShopLock(s, locked: boolean, expectedGeneration: number): CommandResult` | 设置当前商店锁定；同值成功返回原状态和空事件。 |
| `rerollShop(s): CommandResult` | 原规则付费刷新，不接收客户端商店或 RNG。 |
| `buyXp(s): CommandResult` | 原规则付费经验，不接收客户端等级或金币。 |
| `startMatchCombat(s): CommandResult` | 校验当前阶段，冻结既有战斗输入并产生完整开战事件。仍使用现有敌军来源。 |
| `stepMatch(s): MatchStep` | 战斗中推进一个 50 ms 逻辑 tick；非战斗阶段返回原 state 和空事件，不暗自进入下一轮。 |
| `nextRound(s, expectedRound: number): CommandResult` | 当前已结算轮号，校验后进入下一节点，不重复结算。 |
| `combineItems(s, aId: string, bId: string): CommandResult` | 两件库存装备实例按既有配方合成。 |
| `equipItem(s, itemId: string, unitId: string, slot: number): CommandResult` | 将库存装备放到指定单位/装备槽。 |
| `selectAnomalyTarget(s, choiceId: string, generation: number, unitId: string): CommandResult` | 当前异常选择及目标单位。 |
| `rerollAnomaly(s, choiceId: string, generation: number): CommandResult` | 当前异常选择付费刷新。 |
| `selectChoice(s, choiceId: string, generation: number, definitionId: string): CommandResult` | 当前选择中合法定义 ID，包括现有奖励选择。 |
| `getDeploymentCap(s): number` | 当前人口上限。 |
| `validateMatchDeployment(s, unitId: string, target: UnitLocation): MatchFailure \| undefined` | 无写入的部署预检；仍必须检查实际命令结果。 |
| `matchStartFailure(s): MatchFailure \| undefined` | 开战预检；`undefined` 代表可调用 Start。 |
| `needsAnomalyRecruitment(s): boolean` | 当前是否为空阵容且尚未完成异常节点。 |
| `serializeMatch(s): string` | 先执行现有恢复校验，再输出对象键规范排序的完整 JSON；不是可公开的 PlayerView。 |
| `restoreMatch(input: unknown): MatchState` | 接受 JSON 文本或普通 JSON 对象，完整验证版本、digest、输入、资产和账本后返回独立状态；不抽 RNG、不发奖励、不重跑 Start。 |

T1 的运行时导出是以上 21 个；T2 的新增导出见第 10 节。T1 类型导出（编译后擦除）为：

- 状态与命令：`MatchState`、`MatchBase`、`MatchCommandResult`、`MatchFailure`、`MatchStep`、`MatchEvent`、`RunningCombat`、`FinishedCombat`、`RoundResult`、`PersistentGrowth`。
- 单位与战斗：`Unit`、`UnitLocation`、`CombatState`、`CombatResult`、`LedgerCombatEvent`。
- 后续 T2 可引用的现有快照类型：`CombatInputBasis`、`CombatStrategyInputs`、`StrategySnapshot`、`StrategyUnitSnapshot`、`ItemInstance`、`OwnedAugment`、`AnomalyBinding`。它们不等同于 T2 的 `PlayerBattleSnapshot`；双方身份映射与验证见第 10 节，不能把旧类型强转成真人敌军。

仓库内 TS 调用使用源入口取得类型；T1 的 `.mjs` 产物是运行文件，不发布 npm 包或独立声明包。

### 9.3 注入边界与调用示例

种子参数为 `seed: number`（uint32）。之后 RNG 状态全部保存在 `MatchState`，以该状态传入下一次命令/step；不从系统熵源再抽种子。

时间由调用方决定何时执行 `stepMatch(state)`，每次调用恰好一个固定 50 ms tick。引擎没有真实时钟、定时器或 `nowMs` 参数，不接受可变 deltaMs；T4 的准备截止、超时和收件时间由 Claude 的调度层注入和管理。这样重放时只需按同一顺序执行同样步数，不等待真实时间。

计算预算由调用方的 `maxSteps: number`（正安全整数）控制；命令行要求显式 `--max-steps`。单步函数本身不循环。以下调用方循环在耗尽预算时保留未完成状态，报告执行预算不足，绝不伪造成平局/胜负，也不改变引擎已有的战斗超时规则：

```ts
import { createMatch, startMatchCombat, stepMatch } from '../server-entry';
const seed: number = 42;
const maxSteps: number = 1201;
const start = startMatchCombat(createMatch(seed));
if (!start.ok) throw new Error(start.reason);
let state = start.state;
const events = [...start.events];
for (let steps = 0; state.phase === 'combat' && steps < maxSteps; steps++) {
  const next = stepMatch(state);
  state = next.state;
  events.push(...next.events);
}
if (state.phase === 'combat') throw new Error('step-limit-exceeded');
// state 和 events 是服务器私有权威数据；公开投影由 T5 实现。
```

### 9.4 失败原因与异常

所有失败命令均返回 `{ok:false,state,reason}`，其中 `state === 输入 state`，**没有 `events` 属性**，且不改变资源、ID、收据、事件序号或任何 RNG。返回类型要求调用方先判别 `ok`，不能直接读取失败结果的 events。

当前 `MatchFailure` 完整枚举（合并重复项后）：

```ts
type MatchFailure =
  | 'unknown-unit' | 'enemy-unit' | 'invalid-location' | 'outside-deployment-zone' | 'occupied'
  | 'missing-player' | 'missing-enemy' | 'missing-both'
  | 'wrong-phase' | 'invalid-slot' | 'stale-shop' | 'purchased-slot' | 'insufficient-gold'
  | 'bench-full' | 'stale-round' | 'unsettled-round' | 'max-level' | 'population-cap'
  | 'unknown-item' | 'item-not-inventory' | 'invalid-recipe' | 'item-slot-occupied'
  | 'stale-choice' | 'invalid-choice' | 'invalid-target' | 'same-item'
  | 'unique-conflict' | 'exclusive-slots' | 'temporary-item';
```

`createMatch` 的非法 seed 抛 `RangeError`（`Seed must be a uint32 integer`）；`serializeMatch`/`restoreMatch` 保留原始校验异常：非法 JSON 文本可抛 `SyntaxError`，非普通/非有限 JSON 数据可抛 `TypeError`，无效字段可抛 `RangeError` 或校验 `Error`（含 `Invalid Match save: unsupported-version`、`Invalid Match save: content-digest` 等）。这些是可信状态/存档边界的异常，不是命令 `reason` 枚举，错误 message 也不是稳定网络协议。T5 负责验证不可信消息和映射协议错误；不得捕获异常后绕过校验强制恢复。

运行器参数缺失/非法时 stderr 输出 `Usage:` 并以 1 退出；预算不足输出 `step-limit-exceeded: maxSteps=...` 并以 1 退出，无成功 JSON。它们是执行器错误，不新增领域 `MatchFailure`。

### 9.5 T1 一致性证据与范围

先按原锁文件 `npm ci`，在 Node `v24.21.0` / npm `11.19.0` 原样执行既有探针。seed 42 首战基线：164 tick、106 条战斗事件、`playerWin`；终态 Combat digest 为 `fnv1a32-utf16:acf238a8`，战斗事件 digest 为 `fnv1a32-utf16:966105d6`，记录于 `tests/t1-probe-baseline.json`。集成文档同步未改变 `4d51ec95` 的 simulation 源码。

验证重新运行未修改的原探针，并独立以 `platform=browser` 打包浏览器现有的 simulation 导入。将该参考和生产 Node 入口的开战及逐 tick 完整 state、events、全部随机流分别编码为 UTF-8，使用 `Buffer.equals` 逐字节比较；另把同一未改动源码产生的三条完整轨迹 SHA-256 固定在基线文件中，防止参考和生产同时漂移。摘要不能替代完整比较。参考包在普通 Node 中运行，这不是实测浏览器或八席局的宣称。

另断言：旧 generation、金币不足的买卡/刷新/买经验、错误阶段命令保持原对象且无 events/RNG 变化；tick 40 文本/对象两种恢复后每次 step 的整个结果 deepEqual，终态存档字节相同；损坏 digest/版本拒绝；禁用浏览器全局、`Math.random` 和 `Date.now` 后仍可导入并运行；复制完整产物到独立临时目录后能运行，164 步成功、163 步明确失败。验收不增加共享池、机器人、网络或新玩法。

## 10 双方战斗接口（T2）

### 10.1 公共入口与可信边界

以下均从 `src/server-entry/index.ts` 导入；生产 Node 使用整个 `dist-server/` 内的 `index.mjs`。验证环境为 nvm Node **v22.23.3** / npm **10.9.9**，不更改既有单人规则版本、数值或 golden。新增运行时版本常量为 `PLAYER_BATTLE_SNAPSHOT_VERSION = 'two-sided-snapshot-v1'`、`TWO_SIDED_BATTLE_VERSION = 'two-sided-battle-v1'`，以及错误类 `BattleValidationError`。

```ts
snapshotForBattle(state: MatchState, seatId: string): PlayerBattleSnapshot
restorePlayerBattleSnapshot(input: unknown): PlayerBattleSnapshot
compileBattle(a: PlayerBattleSnapshot, b: PlayerBattleSnapshot, battleSeed: number,
              identity?: BattleIdentity): BattleInput
restoreBattleInput(input: unknown): BattleInput
startTwoSidedCombat(input: BattleInput): CombatState
startTwoSidedCombatWithEvents(input: BattleInput): CombatStep
stepCombat(state: CombatState): CombatStep
resolveTwoSidedBattle(input: BattleInput, maxSteps: number): BattleResult
proposeSettlement(result: BattleResult): { readonly a: SideProposal; readonly b: SideProposal }
// BattleIdentity = { readonly battleId: string; readonly mirrorOfSeatId?: string }
// CombatStep = { readonly state: CombatState; readonly events: readonly CombatEvent[] }
```

`snapshotForBattle` 只接受服务器拥有的准备阶段 MatchState，校验现有六个规则/协议版本键、内容 digest、目录轮次及标准 7×8 棋盘/9 格备战区，只取本方合法上场单位和关联效果。它不重放整局资产历史、不校验客户端身份，也不重新掷临时装备；准备态必须已通过原有装备事务生成当前轮临时子装备。备战区单位、库存装备、金币、商店、随机流、座位凭证均不进入快照。异常或成长绑定在备战区单位时被省略。输出是独立深拷贝且递归冻结，输入不变。

两个 restore 接受普通 JSON 对象或 JSON 文本，返回独立、冻结的规则数据。快照采用白名单，拒绝额外字段和自报最终属性；检查部署、人口、星级、装备槽/排他约束、临时子装备父项与轮次、强化/异常定义和成长。`restoreBattleInput` 从两份描述重新编译，并逐字段规范比较派生阵容、效果、映射表，拒绝伪造属性。它们是服务器内部数据边界，**不是客户端资产真实性证明**。`proposeSettlement` 接受本引擎生成的可信结果，只检查必要身份、终态及事件序列一致性，不认证任意外部战报；跨信任边界应恢复冻结输入并重跑，不能接受客户端自报胜负。旧 `restoreMatch` 不接收该格式，其固定敌军校验不放宽。

### 10.2 输入和输出形状

以下字段均为只读；具体公开 TS 类型由入口导出。`Unit`、`ItemInstance`、`TemporaryEquipment`、`OwnedAugment`、`AnomalyBinding` 沿用规则描述类型，不含计算后的战斗属性。

```ts
interface PlayerBattleSnapshot {
  version: 'two-sided-snapshot-v1'; contentDigest: string;
  seatId: string; roundId: string; level: number;
  units: readonly Unit[];                  // team:'player'，仅己方部署区 board
  items: readonly ItemInstance[];          // 仅 location.kind:'unit' 且属于上场单位
  temporaryEquipment: readonly TemporaryEquipment[];
  augments: readonly OwnedAugment[];
  anomalyBinding: AnomalyBinding | null;
  persistentGrowth: readonly PersistentGrowth[];
  augmentProgress: { pumpingRounds: number; investmentHp: number };
  priorPvpWins?: number;                   // 1..7，本席此前 PvP 胜场（外交官）；0 时省略，见 10.11
}
interface BattleIdMapping {
  seatId: string; kind: 'unit' | 'item' | 'temporary-item' | 'augment' | 'anomaly';
  originalId: string; combatId: string;
}
interface BattleInput {                    // 规则输入，区别于 B1 的调度信封
  version: 'two-sided-battle-v1'; battleId: string; battleSeed: number;
  mirrorOfSeatId: string | null;             // null=真实双方；否则必须等于b.seatId
  a: PlayerBattleSnapshot; b: PlayerBattleSnapshot;
  mapping: readonly BattleIdMapping[];
  preparation: GameState; strategy: StrategySnapshot;
}
interface BattleSideResult {
  seatId: string;
  survivors: readonly { unitId: string; definitionId: string; starLevel: 1|2|3; hp: number }[];
  growth: readonly PersistentGrowth[];     // {unitId, attackDamageBps}，仅本战新增长量；镜像为空
}
interface BattleResult {
  version: 'two-sided-battle-v1'; battleId: string; roundId: string; battleSeed: number;
  mirrorOfSeatId: string | null;
  winnerSeatId: string | null;             // null = 平局
  a: BattleSideResult; b: BattleSideResult; mapping: readonly BattleIdMapping[];
  initial: CombatState; terminal: CombatState;
  events: readonly LedgerCombatEvent[];   // 含 tick 0 的开场/立即结束事件
}
interface SideProposal {
  battleId: string; roundId: string; seatId: string; result: 'win'|'loss'|'draw';
  settlementEligible: boolean;             // 镜像false，禁止发收入/经验/奖励或提交收据
  baseDamage: number; opposingSurvivors: number; damage: number;
  growth: readonly PersistentGrowth[];
  events: readonly LedgerCombatEvent[];
}
```

`BattleIdentity`、`BattleSurvivor`、`BattleSideResult`、`BattleIdMapping`、`BattleFailure`、`CombatStep`、`CombatEvent`、`GameState`、`TemporaryEquipment` 也作为类型导出。双方 survivor/growth 中的 unitId 已映射回各自真实原始 ID；事件与 CombatState 内仍是战斗 ID，查 `mapping` 归属，不按字符串切割推断。双方提案的 events 引用同一完整账本，持久化应以 battleId 保存一份。此账本是服务器私有数据，PlayerView 另做白名单投影。

### 10.3 编译、确定性与推进

- A 与 B 必须不同 seatId、同一 roundId；T2 只接受既有目录中的 PvP。PvE、补给和目录外的 6-7 后加时尚不由此入口处理，不把未知轮次伪装成 6-1。
- 各自以本方 player 阵容独立调用现有策略编译器，完整应用装备、羁绊、强化、异常、持久成长和临时装备程序；随后 A 为 player，B 为 enemy。A 坐标不动，B 用 `row = 7 - row`、col 不变。后排、相邻搭档等开场选择先在各自原坐标计算。
- 战斗 ID 编码为 `JSON.stringify(['t2', seatId, kind, originalId])`；同原始 unit/item/choice ID、含标点的席位 ID 均不碰撞。强化和异常是不同 kind；羁绊来源实例另以 kind=`trait` 加席位前缀，来源键重新生成；所有者、搭档、临时装备父项引用随之映射。成长能力来源使用已命名空间化的 unit ID。
- 阵容、装备、强化等输入列表规范排序，复用原 combat 排序/破同顺序。相同内容、版本、输入、显式 uint32 `battleSeed` 与足够预算产出逐字段相等的结果；不读取任何一方 Match RNG，不调用真实时钟或系统随机。交换 a/b 会改变坐标和 player/enemy 视角，**不承诺镜像后的完全对称胜负**。
- 正式调度必须传第四参 `{battleId}`，使用该局/轮次/配对/执行代次的唯一标识。只传三参时生成的 `diagnostic:<digest>` 供离线测试，32 位内容摘要不保证生产唯一性，不能用作收据键。
- `startTwoSidedCombat` 只返回初态；需要完整账本时必须用 `startTwoSidedCombatWithEvents` 并从 start.events 开始收集。每次 `stepCombat` 固定 50 ms；结果事件包含连续 `eventSeq` 和同一 `combatId`，不按动画帧删减。推荐直接用有界的 `resolveTwoSidedBattle`，默认不偷偷提供预算。
- `maxSteps` 为正安全整数，当前引擎最多 1200 ticks，传 1200 足够；耗尽预算而仍 running 是失败，不返回伪造平局。双方空阵容合法，在 tick 0 平局；一方空则另一方 tick 0 胜利。真实战斗达到原 1200 tick 上限仍未分胜负才是 timeout 平局。

### 10.4 未提交的伤害和成长提案

伤害统一调用 `match-rules.ts::selectPlayerBaseDamage(stage, roundKind, roundId?)`，细分版本 `s13-player-damage-overtime-v2`：普通阶段 2/3/4/5/6 分别为 **2/5/8/10/12**；合法 PvP `overtime-n`（包括首场、stage 仍为 6）基础为 **17**。这是项目加时映射到标准 stage 7 的政策，不增 stage 8/150 或新日程。`economy.ts`、`proposeSettlement`、唯一收据验证与恢复战斗输入重演同源，服务器/客户端不得另补 5 点。计算沿用 `economy.ts`：真实参战席位胜方 damage=0，败方或平局方 damage=本阶段基础值+对方存活单位数（不是星级之和）。真实双方空阵容各提案基础伤害；超时双方各按对方存活数计算。镜像方一律 damage=0、growth=[]、settlementEligible=false，详见10.8。damage 是未截断非负安全整数请求值，T2 不读取或修改席位 HP，不计算实际损失/淘汰/名次。

growth 只包含本场新获得的永久 AD 增量，包含已阵亡单位的合法增长，按 seatId 和原始 unitId 归属；开战前累计成长只参与属性，不再次发放。重复调用提案得到相同值且不改资产；**这不等于收据幂等提交已实现**。不发金币、经验、奖励，不推进轮次，T3 才将合法提案原子提交。

### 10.5 失败枚举

T2 验证/运行失败抛 `BattleValidationError extends RangeError`，读取稳定的 `.reason: BattleFailure`，不解析 message。失败不修改任一输入或消耗外部 RNG，预算失败不产生可提交结果。`stepCombat` 沿用其可信 CombatState 前提，不是任意 JSON 恢复器。

| reason | 含义 |
| --- | --- |
| `snapshot-version` | 快照格式版本或源 Match 规则/协议版本不匹配 |
| `content-digest` | 源状态或快照内容摘要不匹配 |
| `invalid-snapshot` | 非法 JSON/描述/额外字段、非法资产、部署、装备、效果或编译失败 |
| `wrong-phase` | 从非 preparation 的 MatchState 提取快照 |
| `seat-collision` | a/b 席位相同 |
| `round-mismatch` | 两方目录轮次不同，或源 Match 轮号与轮次 ID 不符 |
| `round-kind` | 已知目录节点不是 PvP |
| `invalid-seed` | battleSeed 不是 0…4294967295 的整数 |
| `invalid-battle-id` | 显式 battleId 为空或非字符串 |
| `invalid-mirror` | 指定的镜像来源不是 b.seatId（只允许 B 为镜像） |
| `battle-input` | 编译输入格式/版本错误或派生内容与重编译不一致 |
| `invalid-budget` | maxSteps 不是正安全整数 |
| `step-limit-exceeded` | 预算用尽仍 running，不可提交 |
| `invalid-result` | 提案输入版本/轮次、终态、归属、赢家或事件序列不一致 |

恢复编译输入时，内层快照/轮次/种子验证也可产生对应 reason。未知目录 ID 在快照恢复时报 `invalid-snapshot`。`empty-both` **不是**失败：按 10.3/10.4 返回合法平局和伤害提案。

### 10.6 Claude 的 B1 resolver 替换合同

已核对已合入 multiplayer 的 PR #35 的 `src/server/room/battle-resolver.ts` 和 `types.ts`。其调度信封有 `battleId/roomId/round/roundId/roundKind/roomRevision/seats/mirrorOf`；保持为服务器私有编排类型，导入规则类型时可用 `RulesBattleInput`/`RulesBattleResult` 别名避免重名。

**接口调整要求（由 Claude 改 `src/server/`）：**

1. 调度输入增加显式 `battleSeed: number` 和 `maxSteps: number`，在冻结配对时固定，重试不得换种子；保留并回传原 `battleId/round/roomRevision`。调用前核对信封 roundId 与两方准备态轮次一致，调用后仍须拒绝过期执行代次。
2. 普通 PvP 的两席只编译、运行一次。B1 旧返回中的 `outcomes[].state: MatchState` 是已结算状态，要求 T2 填充它会提前做 T3；不得把真实 enemy 的 Combat 强塞入旧单人存档。PvP 输出改为 `{battleId, round, roomRevision, battle: RulesBattleResult, proposals: {a: SideProposal,b: SideProposal}}`，调度层暂存提案，等 T3 的提交入口；不能继续走当前占位的扣血和已结算 MatchState 覆盖路径。
3. 旧 `frames: {state: MatchState,events: MatchEvent[]}[]` 改为战斗视图数据：整场提供 `battle.initial/terminal/events/mapping`，如确需逐 tick 帧，使用开场含事件入口并逐步保存 `{state: CombatState,events: CombatEvent[]}`。生成帧也只运行这一场，B 视角由映射/投影得到。不要再各跑一次 `startMatchCombat`。
4. 奇数镜像使用实际参战席位作为 a，`mirrorOf` 的冻结快照作为 b（必须不同 seatId）；第四参明确传 `mirrorOfSeatId: b.seatId`，完整计算双方效果；规则输出镜像 b 的 growth=[]，其提案 settlementEligible=false、damage=0、growth=[]。该提案不得提交，不给镜像原主重复成长/扣血/收入。席位真身在其他配对上的结果仍独立有效。调度信封应保留真实参与席位列表供 T3 识别。
5. PvE/补给保留原分支，不能调用此 PvP 入口。未来加时轮标识与 T3 的下一轮推进需单独扩展合同，T2 不猜测。

普通 PvP 的替换核心（伪代码中的调度字段由 B1 定义）：

```ts
import { snapshotForBattle, compileBattle, resolveTwoSidedBattle, proposeSettlement } from '../../server-entry';
const a = snapshotForBattle(envelope.seats[0].state, envelope.seats[0].seatId);
const opponent = envelope.mirrorOf ?? envelope.seats[1];
const b = snapshotForBattle(opponent.state, opponent.seatId);
const frozen = compileBattle(a, b, envelope.battleSeed, { battleId: envelope.battleId,
  mirrorOfSeatId: envelope.mirrorOf?.seatId });
const battle = resolveTwoSidedBattle(frozen, envelope.maxSteps);
const proposals = proposeSettlement(battle);
return { battleId: envelope.battleId, round: envelope.round,
  roomRevision: envelope.roomRevision, battle, proposals };
```

服务器捕获规则异常后中断该轮的结果采纳，不提交部分提案；不得回退到固定敌军占位结果。本 PR 只提供规则实现与本合同，B1 适配和 T3 资产提交尚需对应流水线完成。

### 10.7 验收映射与 T3 最小范围

`tests/t2-two-sided-battle.test.ts` 的用例按以下表覆盖派工单；`node scripts/verify-t2-node-entry.cjs` 在普通 Node 的生产包上验证同一手算答案、重复运行、恢复和预算失败。

| 测试标题关键词 | 验收项与独立预期 |
| --- | --- |
| `hand oracle` | #1：三星 Maddie 对一星，四次普攻至 tick 88，A 剩 1380 HP、B 无存活者；8 次 RNG |
| `fixed two-star A` | #1：固定二星 A 对一星 B 胜、对三星 B 负 |
| `all five effect classes` | #2/#3：两方同 ID，同时覆盖装备/羁绊/强化/异常/成长；AP110、护甲87、AD52、攻速加成700Bps |
| `back-row`、`temporary equipment` | #2/#3：镜像前后排/搭档选择与双方临时装备父项、程序所有权 |
| `growth deltas` | #3：交换 a/b 后成长仍归原席位，不重复带入旧成长 |
| `SR-B1-01: mirrors never settle`、`growth deltas`、`real equipped tanks` | SR-B1-01：镜像胜/负/空阵容/超时均无扣血和成长回写，真实方伤害不按HP截断，恢复保留结算资格 |
| `empty sides`、`real equipped tanks` | #1：空方即时负、双空平局、真实装备 Leona 到1200 tick超时；预算不足拒绝 |
| `same frozen input`、`descriptor permutations`、`snapshots omit` | #4：完整结果 deepEqual、手动逐步账本一致、排序规范、显式种子、Match 私有随机流隔离 |
| `round %s uses frozen stage base`（五阶段） | #5：基础伤害2/5/8/10/12，败方加对方存活数、胜方0 |
| `rejects malformed` | #3/#4：版本、摘要、坐标、同席、伪造派生属性、阶段/预算/结果拒绝；旧恢复边界不放宽 |
| typecheck/build/test:server-entry、既有回归 | #6/#8：Node22、原 T1 轨迹哈希不变、旧测试与 golden 零修改 |
| 第10.1–10.6节 | #7：B1接入签名、数据、失败和职责边界 |

T3 最小范围建议：先提供接收全轮冻结 battleId/轮次/执行代次与真实参战席位的结算事务入口，验证一轮提案齐全且未过期，使用唯一收据将未截断伤害和成长增量各提交一次，再由同一提交结果产生 HP/淘汰与可恢复状态；覆盖重复结果、迟到结果、部分失败、镜像只提交真身及同轮归零。经济与轮次推进必须明确复用边界，不能让调度层继续自行扣血或拼装旧 MatchState；卡池仍留给 TP。



### 10.8 SR-B1-01：双方伤害整数与镜像结算资格（T2 已实现）

交付是 `compileBattle` → `resolveTwoSidedBattle` → `proposeSettlement` 的公开组合：BattleResult 保存一场战斗及回映射结果，`{a,b}` 两份 SideProposal 各含自己的 `damage`。damage 保证非负安全整数，不按当前 HP 截断、不把伤害分摊给另一席；具体五阶段数值见10.4。B1 的 `BattleSeatOutcome.damage` 必须直接取相应提案，服务器不能用存活者重算，也不能从 `hpBefore-hpAfter` 反推。旧 `state: MatchState` 字段与 `frames` 的变更仍按10.6执行，最终资产状态由 T3 产出。

普通配对不传 `mirrorOfSeatId`，规则冻结为 null，a/b 的 `settlementEligible` 均为 true。奇数镜像配对固定真实参战席位为 a、镜像来源快照为 b，并传 `{battleId, mirrorOfSeatId: b.seatId}`。只能 B 是镜像；指定 A 或第三席报 `invalid-mirror`。标记进入冻结 BattleInput 和 BattleResult，JSON 恢复/重试保留此标记，不在战斗结束后临时猜测。

镜像仍以原主全部装备、强化、异常和成长参与真实计算；a 的战斗与伤害不变，镜像源状态不变。规则对 b 一律返回 `BattleSideResult.growth=[]` 及 `SideProposal {settlementEligible:false, damage:0, growth:[]}`，包括镜像败北、超时和双方空阵容。为保留完整战斗事实，内部 CombatState/事件可含虚拟单位在本战中的成长，但它们不是持久成长回写来源。原主在其真实配对中的合法提案仍可正常提交。

**禁止把 damage=0 理解为“可发一次获胜收入”。** B1 应只把 `settlementEligible=true` 且在信封真实 seats 列表中的提案交给 T3；镜像提案不能创建收据、发收入/经验/奖励或更新成长。T2 本身对任何席位均不发收入、不写 HP；T3 的事务入口还须按冻结参与席位及镜像标记拒绝误提交，不能仅依赖调度器筛选。这是 SR-B1-02 的提交验收，不冒称 T2 已完成资产结算。

验证：`SR-B1-01: mirrors never settle` 覆盖镜像胜/负/双空平局、真实方伤害大于其1点剩余HP、双方源状态不变、普通与镜像战斗终态/账本一致；`growth deltas` 覆盖有实际成长事件的镜像却无持久回写、镜像输入恢复重跑完全相同；五阶段伤害测试逐方检查非负安全整数和真实席位可结算标志。

### 10.9 SR-B1-06：本席私有视图下发白名单（T2 清单，T5 实现）

以下是当前 MatchState 到**仅本席连接**的字段投影合同，不是完整 MatchState 的删字段版。T5 必须新建 DTO、逐字段拷贝，嵌套对象也不能展开或整体序列化；未列字段默认不下发。字段增量、重连快照、命令回执及错误响应使用同一白名单，不能让 `RoomCommandResult.state` 或调试错误绕过投影。客户端不得将 DTO 强转为 MatchState 调用本地规则，旧 UI_REQUESTS 的“完整 MatchState（本席）”要求由本节替代。

| 来源 | 本席可以下发的具体字段 | 过滤/权威约束 |
| --- | --- | --- |
| 版本元数据 | `schemaVersion, rulesVersion, contentVersion, contentDigest, commandProtocolVersion, tickMs` | 仅静态版本；不是种子或随机状态 |
| 当前席位进度 | `round, roundDefinitionId, phase, gold, level, xp`，`streak.{kind,count}` | 仅本席已提交状态；phase 只代表本席操作阶段，全局阶段/终局由 Room PlayerView 决定 |
| 玩家血量 | 对外 `playerHp` | 从权威 `SeatState.hp` 投影；T3 保证它与 Match 镜像一致前，不能以占位 MatchState 的 HP 覆盖权威值 |
| 当前商店 | `shop.{generation,locked,slots}`；每格仅 `{status:'available',definitionId}`、`{status:'purchased'}` 或 TP 缺货格 `{status:'purchased',empty:true}` | 仅本人当前已生成商店；不含下轮店、其他席位商店或全池精确计数 |
| 准备棋盘 | `preparation.board.{columns,rows,deploymentZones.{player,enemy}.{firstRow,lastRow}}`、`benchSize`；`units[].{id,definitionId,team,starLevel,location}`，location 仅 `{kind:'board',cell:{col,row}}` 或 `{kind:'bench',slot}` | units 取本席 player（含备战区），另在当前 PvE 轮加入下行公开遭遇预览的 enemy；PvP 不下发旧固定 enemy 模板，真人对手仍用已公布配对的单独战斗/观战投影 |
| 装备 | `items[].{id,definitionId,location}`；location 仅 `{kind:'inventory'}` 或 `{kind:'unit',unitId,slot}` | 仅本席实际已拥有的库存或单位装备；不含预定奖励 |
| 临时装备 | `temporaryEquipment[].{temporaryId,parentItemInstanceId,roundId,holderId,definitionId,slot,expiresAfterRoundId}` | 仅当前轮已生成且父装备/持有者属于本席的子件；不是整个 equipmentState 或历轮 rolls |
| 已拥有强化 | `augments[].{definitionId,choiceId,acquiredRound}` | 不含未来候选或掷骰输入 |
| 当前异常 | `anomalyBinding` 为 null 或 `{definitionId,unitId,choiceId,boundRound}` | 仅当前已绑定结果 |
| 已提交成长 | `persistentGrowth[].{unitId,attackDamageBps}`、`augmentProgress.{pumpingRounds,investmentHp}` | 仅本席持有单位及实际已提交进度；镜像战斗事件不写入 |
| 当前待选项 | `pendingChoice` 为 null 或 `{kind,step,choiceId,generation,offers,targetId,rerollCount}` | 仅 phase=choice 且当前已展示的选择；offers 是已揭示定义 ID 列表，不含下一次刷新、未来选择或兜底答案；不下发 eventId/returnPhase |
| 本轮已揭示掉落（SR-C7-02） | 可选 `revealedLoot.{roundId,revealedDrops}`；条目仅 `dropId,encounterId,sourceUnitId,roundId,payload,status,receiptId,allowedActions,reason?`，payload 仅 `{kind:'gold',quantity}` 或 `{kind:'unit'\|'item',definitionId,quantity}` | 仅本席当前 PvE 轮已揭示内容，具体门槛、状态及排序见 §14.1；不是 m8.loot 账本，不含计划、未来候选或随机流 |
| 已提交本席轮结果 | `roundResults[].{round,roundId,roundKind,result,combatTicks,combatEventCount,baseDamage,survivingEnemyCount,playerDamage,hpLost,hpBefore,hpAfter,goldBefore,goldAfter,income,interestBasis,xpAwarded,levelBefore,levelAfter,xpBefore,xpAfter}`、`incomeBreakdown.{base,win,interest,streak}` | 仅已经实际提交的历史记录；不下发执行中提案或内部 settlementId，不能用单人 outcome 决定全局排名 |
| 本轮已公开 PvE 遭遇预览（SR-B7-02） | `m8.preparation.{roundId,encounterId,enemies}`；enemies 每项按准备单位白名单复制 | 仅 m8.round.kind=pve、轮 ID 与 roundDefinitionId 相同且 preparation.encounterId 与本轮一致时存在；仅 enemy 棋盘单位。相同单位也进入 preparation.units，供站位和 readEncounterPreview 使用；不公开未来计划、掉落或 PvP 模板 |
| 当前公开轮次说明（若 UI 需要） | `m8.round.{roundId,ordinal,stage,subround,kind,encounterId,displayName}` | 保留原 `m8.round` 嵌套（T5R 工单覆盖旧独立 roundInfo 建议），仅当前已公布轮；不带 isFinal（单人末轮不等于多人终局），不下发整个 m8 |

奖励只允许**另外构造已揭示摘要**，沿用 `loot-view.ts` 的现有可见性规则：本轮直接掉落状态为 revealed/pending-capacity/retained-terminal/granted 时，可投影 `dropId, encounterId, sourceUnitId, roundId, status` 与 `payload.{kind,quantity,definitionId?}`；组件选择只有实际领取收据存在后才能投影所获 payload。当前已触发但未选择的奖励仅公开当前 `pendingChoice` 的身份与已展示 offers，绝不公开 `terminalFallbackDefinitionId`。planned/forfeited 条目、未来轮掉落与未揭示候选完全省略，不保留占位数量或数组索引。共享池补偿已到账时 payload 取实际奖励收据（readLootView 已处理），不取被冻结的原棋子计划。不得为投影重新抽卡、推进 RNG 或发奖。

**明确不下发的根字段/子树：** `seed, rngState, battleSeedRngState, choiceRngState, rewardRngState`；整个 `equipmentState`（包括初始化随机流、历史 rolls 的 rngDrawStart/rngDrawEnd）；`combatInputBasis`、`resourceProvenance`、`scheduleReceipts`、`nextUnitSerial/nextItemSerial/nextMatchEventSeq`；`m8.encounterPlan`、`m8.preparation` 中白名单以外的字段、`m8.loot.frozen`（含 seed/rng/rounds/choices）、`m8.loot.guaranteeCounters` 及其余未经上述摘要过滤的 m8 子树；旧单人 `outcome`；`sharedPool` 绑定和整个 SharedPoolState（含来源、精确计数和抽签顺序）。服务器座位凭证不得进入视图（仅连接认证层自动持有，不展示）。

`combat` **不能作为本席字段整体下发**。T2 的 BattleInput/BattleResult、initial/terminal 也是服务器私有对象，内含 battleSeed、rngState、策略和内部执行计划。T5 的战斗帧只能新建显示 DTO：场景基础字段 `combatId,tick,maxTicks,status,result,board`（board 按上表），每单位 `id,definitionId,team,starLevel,cell.{col,row},startingCell?.{col,row},hp,maxHp,mana,maxMana,shield,alive,targetId,attackDamage,attackRange,attackIntervalTicks,armor,magicResist,abilityPower,baseAttackSpeedBps,attackSpeedBonusBps`（可选字段仅在存在时投影）。状态/护盾详情与可见战斗事件另外使用经字段审查的展示投影，不能透传整个 unit/runtime、abilityPlan、tasks、strategy 或带随机输入的 CombatState。完整权威账本继续留在服务器，不因客户端显示抽样而丢弃；本节不把帧 DTO 伪装成能本地 step/restore 的 CombatState。

T5 验收：两个席位分别投影时不能看到对方 shop/pendingChoice/库存；向任意层塞入随机状态或未来计划哨兵值，初始快照、增量、重连和失败回执均不能出现；改变私有 RNG、未来掉落/兜底而保持已揭示字段相同，输出必须 deepEqual；已揭示商店、选择、临时装备可见，未揭示奖励不可见；投影前后服务器状态、RNG、事件序号均不变。T2 最初交付的是清单；T5R 的纯投影与验证见 §14，实际网络发布接线仍由 B7 验证。

### 10.10 其余 SR-B1 请求的后续最小范围

- **SR-B1-02 → T3**：公开 `applyRoundSettlement(state, receipt)` 或等价事务命令，唯一 settlementId 去重；真实 PvP 不走旧单人自动扣血/gameOver 路径，提交 HP、收入、经验、成长与一条 roundResults；拒绝镜像提案、过期代次和不完整整轮，重复无资源/事件变化。
- **SR-B1-03 → T3 合同 + T4 实现**：定稿目录外加时入口、末阶段基础伤害、经济/商店推进、平局扣血与同轮归零破同分；Claude 在调度层按合同接入，覆盖连续平局/双方空阵容/多席归零的有限终局。
- **SR-B1-04 → T3**：提供不花资源的空阵容异常节点放弃/应战，以及 unsettled-round 时已赚奖励自动领取或放弃的权威命令，保证不重复发奖和可推进；不让服务器自己改 pendingChoice/奖励账本。
- **SR-B1-05 → TP**：在排名后、下一轮商店前唯一归还淘汰席位占用；买/刷/卖/升星/奖励的池与席位同事务提交，失败金币/卡池/商店/随机流不变，覆盖八席守恒。

### 10.11 G2-2 外交官胜场历史（2026-10-17）

Ambessa 外交官双抗（每场 2 护甲 + 2 魔抗，最多算 7 场）在联机中与单人同一口径：只数本席**此前**已结算的 PvP 胜场（`roundKind==='pvp'` 且 `result==='playerWin'`；PvE 胜、平局、补给不计）。

```ts
priorPvpWins(roundResults: readonly Pick<RoundResult,'round'|'roundKind'|'result'>[], round: number): number  // 0..7
G22_EMISSARY_WIN_CAP = 7
```

- 纯函数，从 `src/server-entry` 导出；单人编译器读 `roundResults` 时也调用它，单人数值不变。
- `snapshotForBattle(state, seatId)` 以该席服务器权威 MatchState 的 `roundResults`（T3 收据提交写入的记录）调用它，把结果写入 `PlayerBattleSnapshot.priorPvpWins`；为 0 时省略字段，所以无胜场的冻结输入与改动前逐字节相同，旧冻结输入按 0 恢复。双方各从自己的状态取值；镜像对局的 B 方取被镜像席位自己的历史。服务器只经 `snapshotForBattle` 冻结，不另算、不接受客户端上报。
- `restorePlayerBattleSnapshot` 校验：存在时为整数 1..7，且不超过该快照轮次之前目录内 PvP 轮数；`restoreBattleInput` 重新编译后逐字段比较，改动冻结胜场而不重编译会以 `battle-input` 拒绝。
- `compileBattle` 把该值作为编译输入 `CombatStrategyInputs.priorPvpWins`（仅联机）传给策略编译器；单人 `CombatInputBasis.inputs` 永不含此字段，`restoreCombatInput` 遇到即拒绝。
- 加时轮（`overtime-N`）是 PvP 轮，其 `playerWin` 计入胜场；`priorPvpRoundLimit` 同样把加时轮算作 PvP 轮。
- 私有席位投影的 `roundResults[]` 带 `roundKind`（2026-10-17 补，`'pvp'|'pve'|'supply'`，只是已提交记录的原值），界面可直接用 `priorPvpWins(view.roundResults, view.round)` 预显示本席外交官胜场，不必按 roundId 查目录；旧客户端忽略该字段即可，不改协议版本。界面只做显示，战斗数值仍以服务器冻结值为准。
- 不改内容 digest、版本常量或失败枚举。测试：`tests/g2-2-online-emissary.test.ts`、`tests/server/g2-2-emissary-wins.test.ts`、`tests/t5r-private-seat-view.test.ts`。

## 11 T3：单席原子结算、整轮发布与超时规则

本节取代 §10.7/10.10 的 T3 建议接口。2026-10-12 用户确认覆盖派工单旧文字：**超时默认选第一项是项目规则**；已赚且容量足够的金币、组件、棋子自动领取一次，容量不足的部分放弃。“不花资源”指不购买、不付费刷新，不是“不发任何奖励”。

### 11.1 公开类型与模式切换（本次已交付）

所有下列符号从 `src/server-entry/index.ts` 导出，Node 22.x：

```ts
const ROUND_SETTLEMENT_VERSION = 'multiplayer-settlement-v1';
type MultiplayerFailure = MatchFailure
  | 'multiplayer-required' | 'invalid-seat' | 'invalid-receipt'
  | 'duplicate-settlement' | 'mirror-settlement' | 'already-settled'
  | 'seat-eliminated' | 'no-pending-choice' | 'invalid-loot';
type MultiplayerCommandResult =
  | { readonly ok: true; readonly state: MatchState; readonly events: readonly MatchEvent[] }
  | { readonly ok: false; readonly state: MatchState; readonly reason: MultiplayerFailure };
interface MultiplayerProgress {
  readonly version: typeof ROUND_SETTLEMENT_VERSION;
  readonly seatId: string;
  readonly status: 'active' | 'eliminated';
  readonly receipts: readonly RoundSettlementReceipt[];
  readonly forfeitedChoices: readonly string[];
}
function enableMultiplayerSettlement(state: MatchState, seatId: string): MultiplayerCommandResult;
function applyRoundSettlement(state: MatchState, receipt: unknown): MultiplayerCommandResult;
function forfeitPendingChoice(state: MatchState, expectedRound: number,
  expectedChoiceId: string | null, expectedGeneration: number | null): MultiplayerCommandResult;
function claimOrDiscardLoot(state: MatchState, expectedRound: number): MultiplayerCommandResult;
```

`MatchState.multiplayer?: MultiplayerProgress` 是服务器私有扩展。B4 应在 `createMatch` 后立即调用 enable 并保存返回 state；也允许在无战斗的准备/选择/结算态接入，不能在 combat/gameOver/HP0 时首次开启。同 seatId 重复 enable 成功无事件；不同或空 seatId 拒绝 invalid-seat。这个独立结果类型不扩展单人 `MatchFailure`，保留原 UI 的穷举契约。

开启后 PvP 的 `startMatchCombat` 返回旧 API 的 wrong-phase，`stepMatch` 不推进 PvP；只能走 T2 runner → 本节提交。PvE/补给继续既有公共命令，已有 `roundResults` 的唯一收据仍有效；B4 必须暂存整个 PvE 结果，在全轮发布时一起采纳，不再给 PvE 第二次调用 apply。在线 HP0 的等价淘汰状态是 **`multiplayer.status='eliminated', phase='settlement', outcome=null`**；PvE 同样遵守。存活席在 6-7 结算后仍 active；不能读单人 isFinal/outcome 判定多人终局。淘汰席 `nextRound` 返回 wrong-phase，调度层不得再给它派操作/配对。

这些状态不是单人存档格式，旧 `restoreMatch` 明确拒绝带 multiplayer 的输入（multiplayer-state），不得删除该字段绕过验证。服务器可在自身可信存储中原样保存/复制该扩展，收据与超时标记必须一同保留；本 PR **没有提供不可信多人存档的恢复验证器**。战斗仍用 T2 独立快照恢复，不将真人 enemy Combat 塞回旧单人 Match。§10.9 白名单未授权下发 multiplayer、收据及其 ID；继续只投影已提交资源/历史与公开淘汰状态。

### 11.2 收据、经济与失败

```ts
interface RoundSettlementReceipt {
  readonly version: typeof ROUND_SETTLEMENT_VERSION;
  readonly settlementId: string; // 对局/轮次/席位唯一；重试必须相同
  readonly battleId: string;     // 冻结配对的 T2 battleId
  readonly seatId: string;
  readonly round: number;        // 当前目录 ordinal
  readonly roundId: string;      // 当前目录 ID，例如 2-1
  readonly settlementEligible: boolean;
  readonly result: 'win' | 'loss' | 'draw';
  readonly damage: number;       // T2 未截断伤害，不能改成 hpLost
  readonly baseDamage: number;
  readonly opposingSurvivors: number;
  readonly growth: readonly PersistentGrowth[]; // 本席原始 unitId 的增量
  readonly combatTicks: number;
  readonly combatEventCount: number;
}
```

字段必须齐全且无额外字段，ID 非空；非负安全整数，survivors ≤9、ticks ≤1200、eventCount ≥1。提交准备态不能还有 pendingChoice 或未处理的空阵容异常节点；历史须连续到上一轮。接收目录 PvP 及 §11.5 的加时 PvP。收据是**可信服务器从 T2 结果构建的交接对象，不是客户端命令或战斗真实性证明**。规则验证 seat、轮次、资格、数值和重复，但无法从裸 battleId 证明执行代次；B4 负责将其绑定冻结快照、battleId、roomRevision、实际参战席位与本次执行。客户端不能指定 eligibility/growth/结果。

沿用 `planCatalogRoundEconomy` → `planRoundEconomy` → `grantXp`，不接收外部 goldAfter/HP 或第二套收入。PvP 基础收入5、胜利1、利息采样 gold+胜利金币（每10得1，上限5）、连胜败2/4/6得1/2/3、经验2；平局按连败。例：轮前19金币、已有1连胜，本轮胜 → 利息2、连胜1、总收入9、轮后28。9级经验截停。复核 damage 必须等于现有阶段伤害规则（胜0，否则基础+对方存活数）；不允许截断输入。HP1承受9 → HP0、hpLost1，但 roundResults.playerDamage 和收据仍保存9。

同一不可变事务提交金币、经验、等级、连胜败、HP、Tristana 增量成长、pumpingRounds（有强化时+1）、investmentHp（有强化时+8×利息）、一条 roundResults、一份深复制收据和一条有序 roundSettled 事件。不消费任何 RNG。成长只接受本席上场 Tristana，单 unitId 一次，正125倍数，累加不得溢出。T2 的成长保存在 multiplayer 收据中；不伪造单人 combatInputBasis 的成长证据。

| 失败 reason | 条件 |
| --- | --- |
| multiplayer-required | 未开启本模式 |
| duplicate-settlement | 本席已存同 settlementId；即使已推进/淘汰、重试载荷变化仍拒绝 |
| stale-round | round/roundId 与当前不符（缺失则 invalid-receipt） |
| mirror-settlement | settlementEligible=false，零伤害也不能发收入 |
| invalid-receipt | 缺/多字段、非法整数/结果/资格/seat、伤害与规则不符、非法成长、非 PvP 或计算异常 |
| already-settled | 同轮已有结果，或本席已用过 battleId（即便换 settlementId） |
| seat-eliminated | 首次新收据提交给已淘汰席 |
| wrong-phase | 非干净准备态，或空阵容异常还未超时处理 |
| unsettled-round | 历史不连续/漏轮 |

所有失败返回**原 state 引用，无 events 字段、无资源/RNG/序号改变**。去重在阶段/轮次检查前；输入首先经过有限 JSON 数据检查，非 JSON 载荷不享受去重。一个合法获胜收据亦必须写入收入和成长一次，不能把 damage=0 当成无操作。

### 11.3 B4 全轮编排（由 Claude 在 src/server 实现）

1. 冻结本轮 active 席位、配对、battleSeed、battleId、roomRevision；准备截止时先处理 §11.4 与 §15.4 自动上场，随后冻结快照。运行中冻结输入不可修改，live seat 运营按 §15。
2. 收齐本轮所有真实席结果，每个真实席恰一份，普通配对两份、镜像配对仅 a；镜像 b 不进入队列，镜像原主由它的真实配对提交。校验 battleId/round/执行代次与冻结信封完全一致，漏席/重复席/旧代次整轮拒绝。
3. 用原席位 map 建一个临时 map，逐席 apply。任何失败（包括 unexpected duplicate）丢弃整张临时 map 及其事件，不发布已经成功的一席。整轮已提交重试由调度层 round commit ID 去重，不能凭单席 duplicate 推断整轮完成。
4. 全部成功后，一次替换 map、更新 SeatState.hp **取返回 state.playerHp**，再发布事件和版本；不在房间重算伤害/收入/成长。PvE/补给已结算的暂存状态也随本次原子发布采纳。房间自身提交失败，仍用同信封和原始 map 重试，不换随机种子。
5. 使用 §11.5 排名，TP 卡池归还在排名后、下一轮自然商店刷新前。存活席在接入 TP 后通过 §12 的 nextSharedRound 批量推进目录及加时轮次；未接共享池的席位用 §11.5 advanceMultiplayerRound；全局仅剩0/1席时结局由调度层生成。

构建单席收据示意（p、battle 必须来自校验通过的同一冻结信封）：

```ts
const r: RoundSettlementReceipt = {
  version: ROUND_SETTLEMENT_VERSION,
  settlementId: JSON.stringify([matchId, envelope.round, p.seatId]),
  battleId: envelope.battleId, seatId: p.seatId,
  round: envelope.round, roundId: envelope.roundId,
  settlementEligible: p.settlementEligible, result: p.result,
  damage: p.damage, baseDamage: p.baseDamage, opposingSurvivors: p.opposingSurvivors,
  growth: p.growth, combatTicks: battle.terminal.tick, combatEventCount: battle.events.length,
};
const result = applyRoundSettlement(originalSeat.match, r);
// 只写 staged；其余真实席也成功后才发布 staged。
```

### 11.4 超时命令与不重复奖励

`forfeitPendingChoice` 名称沿用派工单，但语义是**自动选择第一项**。传入当前 round、choiceId、generation；没有 pendingChoice 的空阵容异常传 null/null。普通强化/组件调用已有 selectChoice；异常 target 步先选按 unitId 字典序最小的己方单位（含备战区），生成正常候选，再选第一项，不 reroll、不买单位。Placebo 等首选自带金币照常只领一次。正常的候选生成/临时装备可能推进其专属 RNG；不承诺成功时所有随机流不变。

唯一例外：异常节点没有任何己方单位时没有合法第一目标，记录该 eventId 的 forfeitedChoices 标记，跳过异常节点，以空阵容参加本轮 PvP，不创造免费单位。后续不能再领取该异常，重复超时不发奖。普通成功会记原有 schedule/loot 收据并追加 choiceTimedOut（resolution='first-offer'）；空异常为 'empty-anomaly'。若返回新 pendingChoice，使用其新身份再次调用，不能复用旧身份把第二个选项误处理。

`claimOrDiscardLoot` 只在 settlement 或 returnPhase=settlement 的 choice 接收：已赚的组件选择按第一项领取，直接奖励调用既有 grantDirectLoot，棋子可升星释放容量时按正常获取规则领取，仍因满备战区无法领的部分标记 forfeited，不分配奖励 ID/收据。金币和组件没有人为新增容量限制。未揭示/未赚奖励绝不发放。若正在显示已领组件选择，清除该选择并正常进入后续节点；无待奖时成功原 state、events=[]。此前已领取奖励不会重发，整笔中后段失败时前段授予也不采纳。

额外失败：两命令未启用/已淘汰为 multiplayer-required/seat-eliminated；轮次不符 stale-round；choice 身份/代次不符 stale-choice；没有选择且非待处理空异常 no-pending-choice；非法阶段 wrong-phase；选择无合法首项或原选择命令失败为 invalid-choice/invalid-target 等既有 MatchFailure；奖励处理异常 invalid-loot。失败均原样返回。顺序为：处理当前选择 → 本轮战斗与结算 → 领取或放弃已赚奖励 → 处理后续选择 → nextRound。已淘汰席不再推进。不能用无限重试或清 pendingChoice 字段代替规则命令。

### 11.5 SR-B1-03 / SR-B4-01 加时、平局与排名（T5R 规则入口已交付）

- 6-7 后若≥2席存活，进入 `overtime-1`，ordinal=`FINAL_ROUND+1`；之后 `overtime-N` 对应 `FINAL_ROUND+N`，严格递增，不重用6-1/6-7 ID。均为 PvP、从第一场起基础伤害17（日程 stage 保持6）。不开新野怪、补给、强化、异常或掉落计划；既有强化/异常/装备/成长继续生效。
- 每轮仍按既有 PvP 收入、利息、连胜败、经验、强化成长提交；进入下一轮沿用自然刷新/锁店及临时装备生命周期，商店必须通过规则入口生成，TP 后仍受共享池约束。每个加时有独立 settlementId/battleId/roundResults，不能再执行末轮奖励。
- **已导出的推进入口**：`advanceMultiplayerRound(state: MatchState, expectedRound: number): MultiplayerCommandResult`。要求已 enableMultiplayerSettlement、active、settlement、无 pendingChoice/待领取奖励且 roundResults 连续覆盖当前轮；目录内委托 nextRound，6-7 及之后生成加时准备态（`kind='pvp', isFinal=false, stage=6, subround=7+N, encounterId=null`）。返回 state/events 的既有成功形状；失败原 state 引用、无 events、无资源或 RNG 变化。失败枚举：`multiplayer-required`（未启用）、`seat-eliminated`（已淘汰）、`shared-pool-required`（已绑定共享池，应走下一段的批量入口）、`stale-round`（expectedRound 或当前轮 ID 不符）、`wrong-phase`（非 settlement）、`unsettled-round`（待选/待领或历史不连续）、`invalid-round`（非法序号、溢出或无法生成该轮），目录内亦透传 nextRound 的失败原因。
- **B4/B5 接入**：无共享池时用上述入口替换 Room.advanceRound 中 nextRound；同时解除当前 Room.commitPending 在 overtimeRequired 时返回 overtime-unavailable 的依赖中断分支（B4 合入基线 bc35bac 仍存在），正常进入 settlement 再推进；有共享池时必须传全部未释放席给 `nextSharedRound(pool, states, expectedRound)`，它已支持加时：先暂存全部推进，再统一释放未锁商店占用、按原固定顺序轮换抽卡，原子提交池与席位，任一失败整批不变。锁店保留原占用，淘汰归还仍在下一轮前。不要逐席解除 sharedPool 后发布无限商店；解除仅是池事务内部的未发布暂存步骤。不能直接改 round/m8，不能调用旧 nextRound 推进加时；全局0/1席结束及≥2席继续仍由调度器决定。
- T2 snapshot/restore/compile/resolve/propose 与 T3 apply 均识别规范 `overtime-N`（N 正安全整数，且 FINAL_ROUND+N 安全）；临时装备跨轮刷新，买/卖/合成来源账本可追加加时 ID，离线 restore/目录查询仍拒绝加时。加时经济调用 planRoundEconomy 并传入规范 roundId，由同源 selector 取基础伤害17；不生成新掉落计划、选择或奖励。
- 平局（含双方空阵容、1200 tick 超时）：**每个真实席**扣12+对方存活数；普通配对双方各算自己的提案。胜方0、败方12+对方存活数；镜像 b 不扣、不提交，镜像来源真身在其实际配对独立结算。目录内平局用相应阶段基础伤害，规则相同。
- 同轮归零排序沿用 B1 项目规则：比较 **未截断 HP=`hpBefore-damage` 降序 → hpBefore 降序 → 固定 seatIndex 升序**，先者名次更好。不能用截到0的 playerHp 破同分。seatIndex 从开局固定0–7，与断线/重连、数组重排无关。同轮淘汰者排在剩余存活者后，较晚淘汰优于早轮淘汰；如果最后所有席同轮归零，也按此键产生唯一冠军，不能继续等待无人存活的下一轮。
- 有限终局：≥2席每完整加时至少有一场普通配对，该配对至少一个真实席被扣正伤害；总存活 HP 严格下降。无任何恢复玩家 HP 的规则，初始最多8×100 HP，因此加时最多800个已提交轮次即可结束（保守上界，空阵容连续平局通常远少于此）。T4 必测连续平局、双方空阵容、镜像及同轮多人归零的唯一排名；不能以单人 isFinal 或客户端倒计时直接定胜负。

### 11.6 验收边界

`tests/t3-round-settlement.test.ts` 覆盖真实公共开局→T2→T3→下一轮、独立19→28金币算例、XP封顶、成长、HP1承受9、JSON复制后的去重、迟到/镜像/非法字段原样拒绝，以及整轮暂存失败后重试。`tests/t3-timeout-loot.test.ts` 覆盖金币/组件/棋子只领一次、满容量放弃、后段溢出回滚、首项选择/空异常推进（前一个测试文件）、在线 PvE 淘汰和末轮存活。

SR-B1-02 的规则提交与 SR-B1-04 的超时入口已交付；全轮冻结/执行代次/发布、SR-B1-03 目录外实现、多人不可信恢复验证、网络投影、TP 卡池不在本 PR 内。没有修改 src/server、UI、单人数值或 golden，也没有修改既有 m5-replay 超时测试。

交付验证（基于 multiplayer `3cdb7f7`，实际 Node **v22.23.3** / npm **10.9.9**）：typecheck、build、test:server-entry、verify-t2-node-entry、verify-t3-node-entry 均通过；T3 的16例、T2、服务器（含B2网络）、经济/经验/轮目录/奖励/跨轮/Match 集成共 **23文件300例通过**。既有 T1 状态/事件/RNG 轨迹哈希不变。未跑完整测试套件，未改 `m5-replay` 或任何 golden。纯 Node 的子进程校验及 WebSocket 测试在允许这些能力的执行环境验证，不调整断言或超时阈值。


## 12 TP：共享有限卡池（shared-pool-v1）

### 12.1 数值、状态与事务边界

`POOL_CAPACITY_BY_COST = {1:30, 2:25, 3:18, 4:10, 5:9}`，来源为 §3.4 的 Riot 14.15 官方说明，按用户决定应用于当前 S13 内容切片。19 位英雄各费用数量为 5/5/5/3/1，总计 **404** 张；不扩目录、不加容量。新联机版本常量 `SHARED_POOL_VERSION = 'shared-pool-v1'`，不改变单人内容 digest、规则版本、商店算法或 golden。

`SharedPoolState` 包含 `version/poolId/seed/seatCount/revision`、按英雄的 `initial/available`、`seats/shops/holdings/pending/rewards`、`naturalRound/order`。其中：

| 字段 | 记录与含义 |
| --- | --- |
| seats | `{seatId,seatIndex,revision,shop,released}`；登记顺序不决定抢卡优先级 |
| shops | `{seatId,generation,slot,definitionId}`；只记录仍可购买的卡，每格预留一张 |
| holdings | `{seatId,unitId,definitionId,sources:string[]}`；实际获取来源键，升星合并后长度为 1/3/9 |
| pending | `{seatId,dropId,receiptId,definitionId}`；已赚而尚未入库的棋子预留 |
| rewards | pending 的身份字段加 `{resolution:'held'|'gold'|'forfeited',gold}`；历史唯一收据，不重复计入守恒。held 表示当时入库成功，出售后仍保留历史 |
| naturalRound/order | 最后完成全局自然刷新的 ordinal（含加时，初始 0）与固定种子洗牌顺序 |

`MatchState.sharedPool = {poolId,seatId,revision}` 绑定该席池版本；两席本地相同 unitId 不冲突。逐英雄校验 **available + shops 张数 + holdings.sources 张数 + pending 张数 = initial**。商店、持有、待领取的活动来源键不能重复；镜像、召唤物、回放与表现副本不进入 holdings。

所有入口为纯函数，不修改输入。`SharedPoolResult` 成功为 `{ok:true,pool,state,events,poolEvents}`；失败为 `{ok:false,pool,state,reason}`，pool/state 都是输入原引用，且无 events/poolEvents。失败不改变任何金币、库存、商店、RNG、ID、序号、收据或占用。成功有变更时池 revision 与该席 binding revision 各加一；真正无操作（如同值锁店、无待领的重复领取）返回原池/状态及空事件。

批量 `SharedPoolBatchResult` 成功为 `{ok:true,pool,states,events:[{seatId,events}],poolEvents}`；states 保持输入顺序。失败返回原 pool/states 引用及 reason，任何一席失败则整个批次回滚。成功池 revision 只加一，各参与席 binding revision 加一。

`events` 是已盖章 Match 领域事件；`poolEvents` 为独立池账本事件：`sharedShopGenerated{seatId,generation,rngDraws}`、`sharedRefreshOrder{round,seatIds}`、`sharedRewardReserved{seatId,dropId}`、`sharedRewardResolved{receipt}`、`sharedSeatReleased{seatId}`。不要给池事件冒用 Match eventSeq，也不要直接发送给玩家。

这些入口接收服务器拥有的可信池与 MatchState，守恒检查不是不可信存档/身份认证器。B5 仍必须使用单写者、网络 commandId 和席位版本校验，然后一次替换池与席位状态、发布事件。**不要把最新 binding 拼接到旧状态上**。池接口不接 expectedPoolRevision：其他席位改池不会作废本席已经预留的店卡；本席旧快照返回 stale-seat。局部池 revision 不替代网络层 seatRevision。

### 12.2 公开签名与初始化

以下运行时入口及 SharedPool 类型均从 `src/server-entry/index.ts` 导出（Node 使用 `dist-server/index.mjs`）：

```ts
createSharedPool(poolId: string, seed: number,
  options?: {seatCount?: number; capacities?: Readonly<Record<string, number>>}): SharedPoolState
initializeSharedSeat(pool: SharedPoolState, state: MatchState,
  seatId: string, seatIndex: number): SharedPoolResult
generateSharedShop(pool: SharedPoolState, state: MatchState,
  expectedGeneration: number): SharedPoolResult
buySharedUnit(pool: SharedPoolState, state: MatchState,
  slot: number, expectedGeneration: number): SharedPoolResult
rerollSharedShop(pool: SharedPoolState, state: MatchState,
  expectedGeneration: number): SharedPoolResult
setSharedShopLock(pool: SharedPoolState, state: MatchState,
  locked: boolean, expectedGeneration: number): SharedPoolResult
sellSharedUnit(pool: SharedPoolState, state: MatchState, unitId: string): SharedPoolResult
releaseSeatOnElimination(pool: SharedPoolState, state: MatchState): SharedPoolResult
runSharedMatchCommand(pool: SharedPoolState, state: MatchState,
  command: SharedMatchCommand): SharedPoolResult
refreshSharedShops(pool: SharedPoolState, states: readonly MatchState[],
  expectedRound: number): SharedPoolBatchResult
nextSharedRound(pool: SharedPoolState, states: readonly MatchState[],
  expectedRound: number): SharedPoolBatchResult
assertSharedPoolConservation(pool: SharedPoolState, states?: readonly MatchState[]): void
```

生产创建池省略 options，默认 8 席/官方容量。夹具可指定 1–8 席及部分 capacities（未指定英雄为 0）；每英雄必须是非负安全整数且不超过官方上限，不接受目录外英雄。seed 为 uint32。构造器/只读断言无事务 result，非法配置抛异常（非法 seed 为 RangeError；池校验异常的 reason 为 invalid-pool，提供 states 时可为 invalid-seat-state/stale-seat），不要将异常消息作为网络协议。

B5 初始化流程：先 createSharedPool；对八份未发布的 `createMatch(seed)` 逐席 initializeSharedSeat，全部成功后调用 `refreshSharedShops(pool,states,1)`，最后一次性发布初始化结果。中途失败丢弃整个未发布提案。seatIndex 是固定 0–7，不随注册次序变化。

初始化只导入 round1、preparation、无历史/奖励收据、唯一开场 Irelia/unit-1/一星且只有一条 opening 来源事实的状态，不能拿已购物/奖励/合成的局导入。它启用 multiplayer，预留开场 Irelia，建立 opening 来源；丢弃从未发布的单人商店及其 shop RNG 消费，把 `rngState` 还原为 seed，改为 generation0 五个空格。八席初始化后 Irelia 可用为 22，首次 40 格共享店生成后全池可用总数为 356。

`generateSharedShop` 是首次单席生成的低层入口：仅 round1/generation0，且要求全部席位先注册，不能当自然刷新/免付费刷新使用；全部首次店生成完后 naturalRound=1。生产首次生成推荐批量 refreshSharedShops，保证抽签公平。generate 的逐席调用顺序即优先顺序，不自动代表公平批次。

### 12.3 商店、随机流与自然刷新

购买只是把该格预留转为持有，不再次扣 available；复用既有金币/容量/升星/装备事务。付费刷新成本仍为 2，先暂存归还旧店，再抽新店；若一张也抽不到则 `pool-empty` 免费失败，旧店、锁定、金币、RNG 和 generation 全保留。部分缺货允许成功，保留五格。锁店沿用旧命令语义，同值设置无操作。

**明确空格采用 `{status:'purchased',empty:true}`**（保留现有 ShopSlot 联合的兼容形状）；正常已购买格是 `{status:'purchased'}`，有卡格为 `{status:'available',definitionId}`。空格无 definitionId、无池占用，购买返回 empty-slot。T5 按 §10.9 白名单投影 empty 标记；界面可将两者都画为空格，不能生成虚构英雄。

抽取使用既有 `getShopOdds(level)`：过滤原赔率为零或无剩余卡的费用层，保留其原权重重新归一；层内按 available 份数加权、沿现有 SHOP_CATALOG_BY_COST 顺序扫描。每个非空格恰用两个 lcg32-v1 word：先 `floor(word * 可用费用权重总和 / 2^32)` 选费用，再 `floor(word * 层内剩余张数 / 2^32)` 选英雄。即使只有一个合法候选也用两次；每个空格用零次。没有重抽循环。只有成功提交消费 RNG。

自然刷新要求传入所有未 released 登记席位，每席同 expectedRound、不重复/遗漏，登记总数必须等于 seatCount。`refreshSharedShops` 用于初始或调用方已准备好下一轮的状态：目标轮必须恰好 naturalRound+1，phase 为 preparation/choice。不要先用旧 nextRound 生成无限店再调用它。正常目录推进直接用 `nextSharedRound(pool,states,currentRound)`：内部复用 nextRound 的轮次、装备、奖励生命周期，只丢弃尚未发布的无限店提案及其 shop RNG，再以共享店替换；任一席 unsettled-round 等失败则全批次不变。目录外加时仍是 §11.5 的 T4 接入边界，本 PR 不新增目录外推进。

批量先归还**所有未锁店**的剩余预留，再生成任何一席的新店；锁店保留预留、generation、shop RNG。初次批量按固定 seatIndex 排序，以 pool.seed 做 Fisher–Yates，N 席消耗 N−1 个独立顺序抽签 word；此顺序保存于 pool.order，不改任何席位 RNG。之后过滤已释放席位，按 `(目标轮号−1) % 存活席数` 循环移位，故存活集合固定时每轮优先级轮换；锁店席仍在顺序中但不抽卡。仅首次洗牌消费顺序流，后续轮换不再抽随机数。各席抽店只消费自己的 shop RNG。手动操作按服务器单写队列顺序竞争，不做同时抢卡的第二套规则。

### 12.4 获取来源、奖励与淘汰（SR-B1-05）

来源键分别为 opening(seatId)、shop(seatId,generation,slot)、loot(seatId,receiptId)，使用 JSON 元组编码避免拼接碰撞。完整星级奖励为每份追加 copyOrdinal 来源键。持有账本按**实际** resourceProvenance 的 unit-acquired/unit-upgraded/unit-sold 事实折叠；二星三份、三星九份。出售只归还实际持有来源，沿用既有售价；出售不会自动领取联机法球。任何校验失败整个事务回滚。

开场占池时点见 §12.2。**v15（用户批准 2026-10-20 02:20）**：野怪计划冻结、战斗揭示和机制奖励法球均不占池。法球留在棋盘，跨轮待领，点法球才按 entryOrdinal 一次领取全部内容。英雄在领取时按完整星级取 1/3/9 份；先用 planUnitAcquisition 合成腾格，能入库才扣池。有货但无容量时按未修改的 getUnitSellPrice 自动出售，池份额视为未取出，resolution=capacity-sold 并记 gold。未杀死载体照旧 forfeited，无补偿；淘汰/终局将已赚未领条目记一次 forfeited 收据，断线不作废。

**缺货规则**：领取时库存不足所需完整份数，则整条按费用补一次金币，resolution=gold；此处完整星级不足的处理为暂定扩展，不部分取货、不按份数倍增。缺货优先于容量出售，两者不叠加。补偿在领取命令到账，不回改既有利息。收据 payload 保留原英雄/starLevel，resolution/gold/grantedUnitIds 明确区别入库、缺货与自动出售；私有 claimReceipts 可显示“自动出售 +NG”。单人路径不变。

所有可能发棋子奖励的 Match 路径必须使用以下统一包装，不得直接调用旧入口跳过池：

```ts
type SharedMatchCommand =
  | {type:'startCombat'} | {type:'step'}
  | {type:'choose'; choiceId:string; generation:number; definitionId:string}
  | {type:'timeoutChoice'; round:number; choiceId:string|null; generation:number|null}
  | {type:'claimLoot'; round:number}
  | {type:'claimOrb'; round:number; orbId:string};
```

对应 startMatchCombat/stepMatch/selectChoice/forfeitPendingChoice/claimOrDiscardLoot/claimOrb，内部注入事务局部 UnitLootPolicy；该回调不存入 MatchState，不是客户端可配置玩法。timeoutChoice 保留原选择默认值，claimLoot 仅处理原有组件自选等选择，不领取、不丢弃法球；nextRound 不因未领法球阻塞。`claimOrb(state,orbId,expectedRound)` 允许 preparation/combat/settlement/choice，集中于 ORB_CLAIM_PHASES；combat 或 PvP combatRosterLocked 接受并排队，其余允许阶段即时领取（用户 10-20 02:26 已定）。expectedRound 为当前操作轮；失败 already-claimed（含重复排队）/ unknown-orb / seat-eliminated，另保留 stale-round / wrong-phase / multiplayer-required / shared-pool-required / invalid-loot 及原池校验枚举；失败原 state/pool、无事件、无 RNG 或池变化。其他 TP 包装与 PvP/T2/T3 路径保持。服务器应将 `{type:'claimOrb',round,orbId}` 原样转发包装，网络协议目标 4（服务器禁改目录由 Claude 接线）。

私有投影增加 `unclaimedOrbs:{orbId,roundId,tier,entries:[{kind,definitionId?,quantity,starLevel?}],source:'pve'|'mechanic',queued:boolean}[]`，提供所有已揭示、已赚且未领的跨轮法球；`claimReceipts` / private `orbClaimReceipts` 含 resolution、gold、claimedRoundId。公共只给 `{count,tiers}`，不暴露 queued。P2/征服者/黑市英雄先写 resolution=orb 的机制收据，再走同一领取命令；完整星级占一格并沿用升星。bot 准备入口调用 claimBotPreparationOrbs，按 orbId 代码点顺序领完；终局调用下述 forfeitTerminalOrbs。合同版本 `multiplayer-orb-claim-v2`，网络目标仍为 4，完整签名、恢复边界、约定值及服务器交接见 [v15 实现说明](LOOT_ORB_CLAIM_V15.md)。

**#260 → #262 终局入口**：`forfeitTerminalOrbs(state: MatchState): MatchStep`，从 `src/server-entry/index.ts` 导出，返回 `{state, events}`，无失败枚举。服务器确定整局结束后逐席调用并提交返回状态和事件，含赢家及其他仍 active 的存活席位；不要求席位已转 gameOver/eliminated，也不自行更改 phase/status。此可信钩子不接入客户端白名单、普通轮次截止或共享池命令包装。清空领取队列，按原计划顺序对已赚未领条目各写一张 forfeited/gold=0/claimedRoundId=当前轮的唯一收据，逐条发 lootForfeited 再 lootGranted；事件带 domain=match、从该席 nextMatchEventSeq 连续编号并推进状态计数，服务器不得再编号。已领及未赚 planned 条目保留；无扣池、发钱、入库、RNG 消耗或其他获取/选择钩子。单机为空操作；重复调用或快照恢复后再调用不产生新事件/收据，空队列时保留原 state 引用。旧 forfeitUnclaimedOrbs 仅作未编号计划器保留；完整语义见 [Match 合同](MATCH_CONTRACT.md#联机整局终局法球清理260--262)。

排队持久字段为席位私有 `m8.loot.queuedOrbClaims?:readonly string[]`（缺省空，按提交顺序），队列中的 direct 仍为 revealed。接受排队无领取事件或收据，不改军队/金币/库存/预留/RNG；包装仍更新 pool/seat revision。PvE withCombat 与 PvP applyRoundSettlement 在收入/利息、XP/HP/成长、G23 钩子、延迟升星之后，战后选择之前统一处理：淘汰先作废全部已赚未领并清空队列；存活按 FIFO、颗内 entryOrdinal 调用同一领取逻辑，以结算时备战席和卡池决定入库/折金/缺货。每颗后 drain 机制奖励、同步临时装备，新法球不自动排队。收据和清空队列与本轮结算原子提交；失败整体回滚，重连/恢复/重复结算不重发。

领取本身消耗 0 RNG，不重抽 payload；若原临时装备钩子需新 roll，仅按 FIFO、每颗后父装备 ID/roundId 代码点顺序消费 equipment 流的两个 uniformIndex（含拒绝采样）并记 roll，战斗/商店 RNG 不因领取改变。跨席卡池竞争沿服务器现有结算原子提交顺序；不保证全局点击先后。服务器必须从 latest seat 结算，不能用战前 resolver 副本覆盖队列；battle/awaiting-settlement 也转发 claimOrb，ACK 仅表示 queued，战后投影收据才表示到账。恢复保留队列原序，validateMultiplayerOrbLedger 校验唯一性、已赚/揭示、未领取、战斗生命周期及未结算。详见 [Match 排队合同](MATCH_CONTRACT.md)。

`releaseSeatOnElimination` 只接受 multiplayer.status=eliminated 且 HP=0，在 **本轮排名已计算后、下一轮自然店生成前** 调用。归还所有店卡、持有来源和待领预留，清空店格，将 pending 标记为 forfeited 并产生一次 Match/pool 事件，不发出售金币。released=true 后第二次返回 duplicate-release，其他池命令返回 seat-eliminated。终态 preparation 军队保留为只读展示档案，已无真实所有权；不可再卖/获取/返还，镜像不能以此档案创建新实体。

SR-B1-05 接入结论：RoomState.poolRevision 取本次提交的 pool.revision，不能自行加减模拟；单席事务同时提交 pool+state，全局自然刷新同时提交 pool+states；淘汰钩子按上述排序调用且去重；八席开场、购买、升级、售出、奖励与跨轮的守恒由 tp 测试及 Node smoke 覆盖。src/server 的实际切换留 B5。

### 12.5 失败原因、恢复与投影

`SharedPoolFailure = MultiplayerFailure |` 下表新增枚举；继承 MatchFailure 完整枚举见 §9.4，MultiplayerFailure 完整枚举见 §11.1。命令返回实际失败，不吞错后继续发布半个事务。

| 原因 | 含义 |
| --- | --- |
| invalid-pool | 版本/容量/池结构/来源/守恒非法，或内部池校验异常 |
| invalid-seat-state | Match 与池绑定、商店、持有、待领不匹配，或初始化不是原始开场 |
| stale-seat | 本席 sharedPool.revision 已过期 |
| pool-empty | 无开场份数，或付费刷新释放旧店后仍抽不到任何卡 |
| empty-slot | 购买明确缺货空格 |
| already-generated | 初始化/首次生成已结束，或首次批量混入已生成店 |
| duplicate-release | 已归还淘汰席 |
| incomplete-seats | 注册未满或批量没有提供所有未释放席位 |
| stale-refresh | 目标自然刷新轮不是 naturalRound+1 |
| not-eliminated | 尚未被 T3 判为 eliminated/HP0 的席位请求归还 |
| invalid-command | SharedMatchCommand 的 type 非法 |

常见继承原因：stale-shop（generation）、invalid-slot、purchased-slot、insufficient-gold、bench-full、wrong-phase、stale-round、unsettled-round、invalid-seat、seat-eliminated、invalid-choice、invalid-loot。重复购买不再次消费；重复刷新携原 generation 失败；重复自然批次 stale-refresh；重复超时按 §11.4 无操作或拒绝，不能重发奖励。

`assertSharedPoolConservation` 可只检查全池，传 states 时再校验所给席位的绑定/店/实际持有/待领；它不要求调用方提供全部席位（批量入口另行要求）。released 席位只检查终态，不把展示军队再次算成持有。

整个 SharedPoolState、MatchState.sharedPool、sources、奖励/结算收据、RNG、order、全池精确计数不在 §10.9 下发白名单中；只下发本人已生成店（含 empty）、可见资产和已赚奖励视图。旧单人 restoreMatch 拒绝带 sharedPool 的状态（multiplayer-state）；不得剥离绑定绕过验证。本 PR 不提供跨进程多人存档恢复器。

### 12.6 B3 补充回应：帧与第二视角

**SR-B3-02：接受当前二次执行取帧方案。** 同一冻结 BattleInput（含显式 seed、battleId、版本/content digest）、同一引擎版本及足够且相同的执行预算下，resolveTwoSidedBattle 与 startTwoSidedCombatWithEvents→逐 tick stepCombat 的初态、终态和完整有序事件必然一致。第二次执行只是纯计算，不能二次提交结算或派发奖励；成本是两次 CPU 执行。无须在 TP 增加新帧运行器，B3 的 frame-divergence 防线应保留。

`toLedgerEvents` 对已盖 domain/combatId/eventSeq 的 M8 事件做边界校验，返回相同事件对象，不改名、不排序、不丢弃事件；legacy damage/shieldChanged/cast/mana 形状会被拒绝。当前 T2 编译的 M8 战斗满足该边界。B3 从权威 battle.events 按 tick 分桶并配上第二次执行的状态是可接受做法；必须保留 tick0 开场事件以及每 tick 内原 eventSeq 顺序，不能因帧节流删除账本。此内部转换器不是新增 server-entry 导出。

**SR-B3-03：当前 LedgerCombatEvent（M8CombatEvent）的全部坐标字段如下。**

| 事件判别 type | 含 HexCell 的完整字段路径 | 含义 |
| --- | --- | --- |
| movement | event.from、event.to | 移动前后格 |
| cast | event.receipt.completionCell | 施法完成格；不是 event.completionCell |

targetChanged/kill/growth/effectTriggered/attack/death/combatFinished/activityChanged/packetDamage/heal/manaChanged/statusChanged/shieldLayerChanged/statChanged/maxHpChanged 均无坐标字段；其嵌套 source、outcome、activity、group、layer 也无 HexCell。unitId/targetId/key 是标识符，before/after 的数值或 ID 不属于坐标。独立于事件，可见单位快照另有 `units[].cell` 和可选 `units[].startingCell`，均需镜像；内部 AbilityPlan 等运行时对象不在帧 DTO 白名单内。

B 席位只对 DTO 做 `row = board.rows - 1 - row`、col 保持，互换 player/enemy 队伍与 playerWin/enemyWin 结果，draw 不变；包括 combatFinished.result。保留原战斗单位 ID（按映射指向同一实体）、combatId、tick、eventSeq 和数值/账本先后；坐标做独立拷贝，不修改规则状态、冻结输入或权威事件。镜像投影不能回灌模拟，也不能给镜像原主生成扣血/成长/卡池归还。未来事件新增坐标必须同步本清单与 T5 镜像验收。


### 12.7 验收证据与范围

最终同步基线为 `origin/multiplayer@25f1c29`（含 B3 PR #40、C4 PR #41）。实际 nvm Node **v22.23.3** / npm **10.9.9**：typecheck（build 内执行）、build、test:server-entry、verify-t2-node-entry、verify-t3-node-entry、verify-tp-node-entry 均通过，T1 既有状态/事件/RNG 轨迹哈希不变。

TP 两文件 **23 例**；连同 T2/T3、B3/C4 服务器/网络、商店/升星、单人经济/奖励/来源/跨轮/存档，最终一次回归 **33 文件 497 例全部通过**。新增八席集成例包含 24 场 PvE 与 4 场双方 PvP，单独设 20 秒预算，不改既有测试限额。独立 oracle 校验 404 张总量、8 张开场、40 格预留及按剩余份数加权的明确 RNG 数字；混合八席命令序列每步检查守恒且可重放。

未改 src/server、界面、golden、单人无限商店行为或既有 m5-replay 超时；既有 Match 发奖路径只增加默认不启用的池策略依赖。未执行完整浏览器/性能验收。B5 服务编排接入、T5 网络 DTO/镜像验收、T4 目录外加时和 T7 机器人不在 TP 范围。

## 13 T7：基础机器人纯策略（basic-bot-v1）

### 13.1 导出、上下文与返回

从 `src/server-entry/index.ts`（Node 为 `dist-server/index.mjs`）导入：

```ts
const BOT_POLICY_VERSION = 'basic-bot-v1';
const BOT_MAX_STEPS = 64;
function decideBotAction(state: MatchState, context: BotContext, rng: number): BotDecision;
interface BotDecision { readonly action: ClientCommand | 'done'; readonly rng: number }
interface BotContext {
  readonly difficulty: 'basic';
  readonly stepsTaken: number;
  readonly maxSteps: number;
  readonly self: { readonly seatId: string; readonly hp: number; readonly round: number };
  readonly opponents?: readonly {
    readonly seatId: string; readonly hp: number; readonly level: number;
    readonly units: readonly {
      readonly definitionId: string; readonly starLevel: number;
      readonly cell: {readonly col:number; readonly row:number};
    }[];
  }[];
  readonly lastFailure?: { readonly action: ClientCommand; readonly reason: string };
}
```

ClientCommand 是 `src/server/protocol.ts` 的既有联合类型，策略只做 `import type`，没有 server 运行时依赖。BotContext/Decision 在 server-entry 导出类型，ClientCommand 沿用协议文件。`state` 为服务器拥有的本席最新合法 MatchState，不接受客户端上传状态。context.self 使用同一已提交版本的公开 HP/轮次/seatId；单人验证可任意固定 seatId。opponents 仅允许公开的已上场阵容；basic 首版不使用侦察信息。不得把其他席位商店、备战区、装备库存、RNG、未来计划、全池计数放进 context。

返回只有**一个意图或 done**及下一份机器人 RNG，不带修改后的 MatchState、池、事件或收据。输入不变，候选排序不读未来商店/奖励/选择结果，不根据敌人私有资产决策。内部复用规则预检：站位用 validateMatchDeployment，装备用 previewCombine/previewEquip，其余用既有纯公开命令的成功/失败结果；所有试算 state/events/RNG 均丢弃，不得由 B6 提交这些试算结果。实际动作必须由 B6 再执行一次权威入口。

`rng` 为房间持有的独立 uint32 lcg32-v1 流，不是任何 Match RNG。只有“最高购买优先分数完全相同的多个**合法**槽位”消耗一个 word，按稳定槽号排序后取 `floor(word * 候选数 / 2^32)`。唯一候选、其他动作、done 消耗零 word；无随机站位、无隐式时钟、无 Math.random。例：输入 RNG0，两个并列合法槽 → word1013904223，选择首槽。游戏抽店/装备/选择的 RNG 仍仅在实际规则命令成功时提交。

### 13.2 basic 的动作优先级

1. **先停止检查**：stepsTaken 达到 `min(maxSteps,64)`、带 lastFailure、self 与 state 轮次/HP 不符、多人 seatId 不符、HP0/已淘汰，或 phase 非 preparation/choice，返回 done。stepsTaken 每次尝试都计数，不以成功次数代替。预算0直接 done。
2. **所有选择节点**：choice 阶段按 offers 原顺序选第一个合法项，覆盖强化、补给组件、已赚野怪组件和异常 offer；异常 target 按本席单位 ID 代码点序选第一个合法目标。使用当前 choiceId/generation，不付费刷新异常，不选择未来候选。无合法目标返回 done，由截止兜底处理。
3. **阵容与站位**：按 `starLevel*100 + cost*10` 排序、同分按 ID，选前 level 个棋子。弱上场单位先移备战区；满备战区无法腾位时，只出售未入选单位中售价最低者（同价按 ID），不超过人口。射程≤1放本方部署区前排，其他放后排，先中列再两侧。固定目标映射，目标格互占时借空余非目标格中转，避免反复横跳；每一步均由部署校验放行，敌方单位不移动。
4. **装备**：稳定库存 ID 顺序，先合成第一个合法配方；再给已上场的强单位找合法装备槽。复用装备规则，遵守 unique、exclusive、已占槽及临时子件限制，不移动已经穿戴的装备。单个未配对组件在常态留库存等配方；低血/后期允许直接穿戴。装备数值与规则不变。
5. **经济与购买**：常态保留当前整十金币利息档，上限50，即 `reserve=min(50,floor(gold/10)*10)`；HP≤30、stage≥5，或空异常正在招募时 reserve=0。只从当前已显示且可负担的槽位买卡；已有三星不再买同英雄。满人口时，新英雄须强于当前入选末位才值得买，已有英雄可继续追星。购买优先分为“已有至少两张一星10000 / 其他已有同英雄1000 / 新英雄0”加 `cost*10`，先凑三张，再追对子/已有英雄，再比较费用；升星完全由原购买命令处理。
6. **容量、经验与刷新**：想买但 bench-full 时，先卖备战区里非该目标英雄、且弱于目标一星的最低售价棋子；没有合适替换就保留资产。不靠预测售价购买当前买不起的卡。无可买目标则在保留金额内买 XP，至现有等级上限9；再考虑付费刷新。空异常招募期间不买 XP、不刷新，避免耗尽必要资金。
7. **共享池刷新**：不读全池；只有本席当前店里存在可归还且本级赔率大于0的卡，才提议 reroll，保证释放后至少能抽到一张。全部已买/空格时即使隐藏池可能有货也停止刷新，等下一次自然刷新。非共享单人路径允许原无限商店刷新。仍受金币与步数预算约束。最终停止购物时解锁遗留锁店一次，避免断线接管永久停在旧店。

上述分数、经济阈值和装备偏好是 **机器人策略**，不是经济/战斗数值修改；不承诺最佳羁绊、胜率或最优装备分配。决定只保证当前可信快照下的规则合法性；快照到执行间状态变化、并发版本、淘汰及网络授权仍由 B6 验证。共享池返还库存的保证以 §12 的单写者和正常登记状态为前提。

### 13.3 有限步、错误与 B6 编排

输入 rng 非 uint32，或 difficulty 非 basic、stepsTaken/maxSteps 非非负安全整数，抛 RangeError；不把异常文本作为网络 reason。合法输入无新失败枚举：策略无可用动作或预算耗尽就 done。原动作失败枚举仍见 §9/§11/§12。本策略不是不可信存档校验器，非法 MatchState 导致的规则异常由调用方按内部错误处理，不能通过篡改状态修复。

B6 每席每轮默认预算为 BOT_MAX_STEPS（64），配置 maxSteps 可降低预算，实际不超过 `min(maxSteps, BOT_MAX_STEPS)`，且遵守以下顺序：

1. 创建/接管机器人时，在服务器为该席建立并保存显式 botRng；独立于 shop/battle/choice/reward 流。断线接管复用原 MatchState、共享池、资产与收据，不 createMatch 重开。重连后撤销机器人执行权限和任何旧排程。
2. 在单写队列里读取当前 state，构造同版 context，调用一次策略；先核对本次仍处于该席可操作阶段和有效控制代次。机器人不能拿 frozen/battle 的状态发准备操作。
3. 返回 action 时保存返回的 botRng、增加 stepsTaken（包括执行失败），再按下表执行该意图；同一次意图重试不得再次抽 botRng。即便规则拒绝，规则池/资产/RNG 都不变；已消耗的独立策略 word 仍保留，不伪装为一次成功游戏命令。
4. 成功一次性提交规则返回的 state（有池时连 pool 一起），发布合法事件；下一次决策重新读取已提交版本。非控制权拒绝的动作失败回传 `{action,reason}` 为 lastFailure；basic 收到该反馈后返回 done，B6 本轮停止重试并保留反馈到换轮。`seat-controlled` / `control-revoked` 表示执行权限已失效，不作为规则失败写入 lastFailure（见 §13.5）。每轮计数不可在准备/选择/断线重连之间清零；只在真正进入新轮时清零并清除 lastFailure。
5. 普通 done 只结束本席的**本次阶段进入**，不关闭整轮；同轮后续重新进入可操作阶段（如战后选择窗口），在无失败且预算未用尽时再次调用策略，继续使用该轮累计步数。失败或预算用尽则关闭整轮，直到下一轮才重置；done 本身不计入动作尝试次数。done 不代表可以调用旧单人开战，不代表奖励已处理完，也不推进时间。B6 仍负责准备截止、T2/T3 战斗/结算、非 PvP 包装、超时及下一轮。准备结束用规则校验核对人口等前提；在线 PvP 的旧 matchStartFailure/startMatchCombat 正常返回 wrong-phase，须走 T2，不能为了开战关闭 multiplayer。
6. 预算不足、满备战区待领、空异常或无合法选择时，由既有截止流程调用 T3/TP timeoutChoice 与 claimLoot，按项目规则默认选第一项/可领则领、不可领则放弃，不能无限延长或由机器人造资源。选择可能在战后同一轮出现；仍沿用该轮预算，截止兜底负责最终进度。

| 意图 | B6 共享池执行入口 |
| --- | --- |
| buy | buySharedUnit(pool,state,slot,generation) |
| sell | sellSharedUnit(pool,state,unitId) |
| reroll | rerollSharedShop(pool,state,本次读取的 state.shop.generation)；协议原意图不新增字段 |
| shopLock | setSharedShopLock(pool,state,locked,generation) |
| choose | runSharedMatchCommand(pool,state,{type:'choose',choiceId,generation,definitionId}) |
| deploy / buyXp / combine / equip / anomalyTarget | 原公开命令 deployMatchUnit / buyXp / combineItems / equipItem / selectAnomalyTarget；保留 sharedPool 绑定 |
| done | 普通 done 停止本次阶段进入；失败反馈或预算耗尽时关闭整轮。调度器照常处理截止和阶段推进 |

basic 不发 start/nextRound/扣血/发奖/池编辑意图，也不发 anomalyReroll。上表不允许服务器自己计算购买、升星、售价或装备结果。B6 的控制代次、定时器、连接切换、配对、网络消息、超时和全轮提交不在 T7 实现范围。

### 13.4 验证方式

`t7-bot-policy` 覆盖确定性、输入冻结、独立 RNG 手算、隐藏流不影响同一公开决策、步骤上限/失败反馈、经济/升级/容量/人口/站位/装备冲突，以及全部选择节点。`t7-integration` 从 seed42 真实开局连走20轮，所有动作通过原公开命令；另用八席真实 TP 包装跨三个开场轮次，逐命令检查守恒，微型库存覆盖空店不猜隐藏池与自有预留可保证刷新。

`verify-t7-node-entry.cjs` 用生产 ESM、Node22、封锁浏览器全局/隐式随机/时钟，从 seed42 的 createMatch 自动打至 gameOver，不替换金币、HP、奖励或战斗结果。脚本检查至少20轮、全程每条意图均被实际命令接受、每轮≤64步；构建脚本另外检查 server-entry 运行时依赖图不含 src/server、UI 或 Phaser。现有单人数值、golden 和既有超时测试不修改。

交付验证基线 `origin/multiplayer@96d9ccb`：实际 nvm **Node v22.23.3 / npm 10.9.9**，typecheck（build 内）、build、test:server-entry、verify-t7-node-entry、verify-tp-node-entry 通过。T7 **25 例**，连同 T2/T3/TP、单人商店/升星/经验/经济/奖励/装备和纯依赖检查，共 **17 文件 357 例通过**。完整 Node 冒烟 seed42：38 轮、239 条合法意图、10698 个真实战斗 tick，单轮最多27步，最终 gameOver/victory；这是一条固定种子证据，不是胜率保证。未运行完整浏览器/性能套件，B6 调度与网络接管尚待 Claude 接入。

### 13.5 SR-B6-01：控制权、重连回执与调度约定（B6 已接入）

本节记录 PR #51 已交付的服务器协议，补充 §13.3；不新增规则侧命令或修改策略数值。字段以 `src/server/protocol.ts`、`src/server/net/messages.ts` 为准，控制权检查与调度分别由 `src/server/room/room.ts`、`src/server/room/bot-driver.ts` 执行。

**公开控制者。** `SeatPublic.controller: 'human' | 'bot' | 'takeover'` 表示当前由谁发出本席操作，与席位的固定 `kind`、当前连接状态 `connected` 分开：

| controller | 含义与切换 |
| --- | --- |
| `human` | 真人控制的席位。短暂断线、尚未达到接管时限时仍为 human，connected=false；成功重连后可继续操作 |
| `bot` | 开局补位机器人，kind=bot，整局保持 bot；不对应玩家重连接回 |
| `takeover` | 真人席（kind 仍为 human）在进行中的对局存活且持续断线达到 `CAT_TAKEOVER_SEC` 后被机器人接管，默认60秒。成功重连立即回到 human，不等下一轮或准备阶段 |

任一时刻只有一个控制者。接管使用原席位的 MatchState、共享池、资产与收据，不重开角色或重发资源。服务器内部 `controlEpoch` 在控制者切换时递增；重连接回同时撤销旧机器人排程，已经排队的旧代次步骤也不得执行。`controlEpoch` 不是新增的 SeatPublic 字段，也不同于连接回执中的 `connectionEpoch`。

**重连成功回执。** `ReceiptResult` 的 resumed 分支为：

```ts
{ readonly kind: 'resumed'; readonly seatId: string; readonly roomId: string | null;
  readonly connectionEpoch: number; readonly lastCommandId: number;
  readonly reclaimed?: true }
```

只有本次成功 resume 确实把本席从 takeover 交还 human，才携带 `reclaimed: true`，供客户端显示“已接回席位”。普通重连、未发生接管等其余情况**省略此字段**，不发送 false。字段是本次回执的事实，不是持续控制状态；当前控制者以 SeatPublic.controller 为准。服务器在发出该回执前已完成接回与控制代次更新，后续快照仍按既有投影下发。

**RoomFailure 新增拒绝原因。** 原有 unknown-seat、seat-eliminated、room-phase 保留：

| reason | 触发与结果 |
| --- | --- |
| `seat-controlled` | 玩家命令到达仍由 takeover 控制的真人席，Room.handle 拒绝；成功 resume 接回后才可继续玩家操作 |
| `control-revoked` | Room.handleBot 收到的控制代次不符，或本席已回到 human；即使带当前代次，human 席也不接受机器人步骤 |

两种拒绝均发生在规则执行前，返回原席位状态，不修改资产、池、规则 RNG 或收据。它们属于房间授权失败，不是策略玩法失败；BotDriver 结束失效步骤，不将其写入 lastFailure，也不借此重试旧控制代次。

**策略调用生命周期。** 每个有效步骤在单写队列中重读最新已提交状态与控制代次，调用一次 `decideBotAction`，最多提交一个意图。每席每轮共享同一份 BOT_MAX_STEPS 预算（默认64，可配置更低）；实际意图尝试包括执行失败都会计数，done 不计数。步数、失败反馈及整轮关闭状态跨准备/选择阶段、断线接管与重连保留，只在真正进入新轮时清零；独立 botRng 跨接管保留，不作为轮计数重置。

普通 done 只标记**本次进入房间 preparation/choice 阶段**已结束尝试，同阶段的重复状态发布不会重新启动。该轮战后再进入选择窗口时，会在预算尚有余额且无失败反馈的前提下重新询问策略。若动作失败已写入 lastFailure 或预算已耗尽，策略返回 done 后关闭整轮，后续选择窗口也不恢复；直到下一轮清除计数与失败反馈。选择超时、战斗、结算及阶段推进仍由房间负责，预算关闭不能阻止既有超时兜底。

本次为文档同步：逐项对照上述协议/实现及 `tests/server/bot-driver.test.ts` 的现有接管、失败与预算用例，不新增代码或测试。§13.4 的“T7 交付时 B6 尚待接入”是历史验证记录，本节覆盖当前 B6 接入状态。

## 14 T5R：本席白名单与紧凑战斗回放

### 14.1 SR-B1-06：本席私有投影

公开 `toPrivateSeatView(state: MatchState): PrivateSeatView`（`src/server-entry` 导出）。输入是服务器可信状态，输出为独立、递归冻结的纯显示对象，不修改输入、不执行命令/抽签/发奖。无正常业务失败枚举；不接收或验证客户端伪造的 Match。字段逐层按 §10.9 构造，新增未知属性不会自动下发；所有 RNG、未来计划、来源账本、combatInputBasis、multiplayer/sharedPool 与整个 combat 均省略。

`PrivateSeatView` 的 MatchState 同名字段保持**递归结构子集**：相同字段名与嵌套，`m8` 保留 `round` 白名单，并在本轮公开 PvE 时保留 `preparation.{roundId,encounterId,enemies}` 白名单；另有下述独立的 `revealedLoot` 显示摘要。不是浅层 `Partial<MatchState>`、存档、命令状态或可以 restore/step 的权威状态。`playerHp` 直接读已提交 Match 值；B4 发布时 SeatState.hp 须与之相等。`shop.empty:true` 保留；未选择阶段 pendingChoice=null；装备仅库存及己方单位，临时件须为当前轮且父件仍装备于本席持有者，成长只含现有己方单位。历史新增 `roundResults[].interestBasis`，直接取已提交轮结果的计息金币基数，不用当前 gold 或 interest 金额反推；另新增 `roundResults[].roundKind`（已提交记录的原值，供界面预显示外交官胜场，见 §10.11）；仍不含 settlementId 或执行代次。已揭示掉落摘要按 §10.9 单独构造，不能把 m8.loot 填回网络状态。

**SR-C7-02 本轮掉落摘要。** `toPrivateSeatView` 的签名与失败约定不变，返回值新增可选字段：

```ts
revealedLoot?: {
  readonly roundId: string;
  readonly revealedDrops: readonly RevealedDropView[];
};
```

`RevealedDropView` 沿用 `simulation/m8/ui-contracts.ts` 的显示结构：每项仅 `dropId, encounterId, sourceUnitId, roundId, payload, status, receiptId, allowedActions` 及下表的可选 reason。`sourceUnitId` 为 string 或 null；payload 只含 `{kind:'gold',quantity}` 或 `{kind:'unit'|'item',definitionId,quantity}`。`allowedActions` 固定空数组，不能作为领奖命令入口。

| status | receiptId | reason |
| --- | --- | --- |
| granted | 实际收据 ID | 省略 |
| revealed | null | auto-grant-in-domain |
| pending-capacity | null | bench-full |
| retained-terminal | null | terminal-bench-full |

只有本席 `m8.round.kind='pve'`、roundId/ordinal 分别与 `roundDefinitionId/round` 相同、且存在同 roundId/encounterId 的掉落账本轮计划时才有此字段；条目还须各自匹配当前 roundId/encounterId。有效 PvE 轮尚无已揭示条目时返回 `{roundId,revealedDrops:[]}`；PvP（含加时）、补给、元数据过期或缺少本轮计划时**省略整个字段**，不传 null、旧轮摘要、占位条目或未揭示数量。“当前”以输入本席 Match 的轮次为准；本函数不接收全局对局轮次，淘汰席保留的最后轮次由 PlayerView 的淘汰状态解释。

对合法当前 PvE 状态，`revealedDrops` 与 `readLootView(state).revealedDrops` 深相等，排序相同：直接掉落先按原槽位顺序，已领取组件选择再按原选择顺序；不暴露排序槽位本身。planned/forfeited 完全省略；组件选择仅在实际 resolution/receipt 存在后出现，未领取时不公开兜底。共享池缺货补偿按实际金币收据显示，不按原棋子计划；满备战区可显示 pending-capacity，超时放弃后条目消失。摘要来自账本，不依赖战前客户端快照、单位 ID 差分或当前金币，重连也能直接显示。

只复制这两个 LootView 字段；不下发其 `canContinue/reason/pendingClaims/pendingChoice` 控制提示，不用单人继续条件判断联机流程。每层对象/数组均逐字段新建并递归冻结，不共享输入引用，不发奖、不改状态/RNG/事件序号。`readLootView` 的 payload 同样按白名单复制，未知嵌套字段不会被传递或连带冻结。客户端直接读 `privateView.revealedLoot?.revealedDrops`，无需伪造 m8.loot 后调用 readLootView；本次不改 UI 或服务器调度。

Claude 可在本地显示适配器给缺失字段填占位，但只允许以下已审查用途；占位不得流回服务器或本地规则命令：

| 可复用选择器 | 真正依赖的数据 |
| --- | --- |
| getDeploymentCap | level |
| getPlayerDeploymentCount | preparation（只计 player 上场单位） |
| deriveTraits(preparation, 'player') | 己方 preparation 与静态内容 |
| readItemInventory | items 中库存部分 |
| readUnitEquipment(state, ownUnitId) | 己方 preparation/items/temporaryEquipment；不能用 enemy 分支 |
| getUnitStats、getUnitSellPrice、getXpToNextLevel、getShopOdds、getInterestGold | 已显示定义/星级/等级/金币与静态内容 |
| readEncounterPreview（仅本轮 PvE） | m8.round、m8.preparation 的公开 enemies 与 preparation.units 中同一组野怪；必要时仅为缺失 version/contentStatus 填静态显示占位，不回填计划/掉落。PvP 不可用此选择器冒充真实对手 |
| readRoundInfo 的可见字段 | m8.round；缺失 isFinal 可填 false，绝不可用来判断全局胜负 |

**不能靠占位保真**：needsAnomalyRecruitment 依赖 scheduleReceipts/forfeitedChoices；previewEquip/previewCombine 的过期临时 ID 判断依赖 equipmentState.rolls；readLootView 依赖已揭示掉落账本，客户端改读上述 revealedLoot；PvP 的 readEncounterPreview 仍依赖未下发的固定敌军模板；战斗状态/状态效果选择器依赖 Combat runtime。B7 使用服务器回执处理合法性，战斗走下节。不要把“类型能强转”当成这些选择器语义仍然成立。

### 14.2 SR-B1-07：回放接口与显示更新规则

以下均为纯函数，由 `src/server-entry` 导出：

```ts
const COMBAT_REPLAY_KEYFRAME_INTERVAL = 20;
toCombatViewState(state: CombatState): CombatViewState;
// CombatAnimationEvent 是 CombatViewEvent 中不含 unitUpdated 的动画子集。
toCombatViewEvents(events: readonly LedgerCombatEvent[]): CombatAnimationEvent[];
type CombatReplayInput = Pick<BattleResult, 'initial' | 'terminal' | 'events'>;
toCombatReplay(battle: CombatReplayInput): CombatReplay;
// CombatReplay = { initial, ticks: CombatReplayTick[], terminal }
// CombatReplayTick = { tick, events: CombatViewEvent[], keyframe?: CombatViewState }
applyCombatReplayTick(view: CombatViewState, frame: CombatReplayTick): CombatViewState;
```

输入为同一场完整可信战斗的首帧、已结束末帧和完整有序账本。PvP 直接传 BattleResult；PvE 传 start 后的 CombatState、最终 CombatState、含 tick0 的完整 LedgerCombatEvent[]。**不传 MatchState，不把 Match 奖励事件混入 events**。投影只读，不结算、不分配 ID、不消耗 Match 的任何随机流；内部对冻结初态做一次最多1200 tick 的纯重执行，生成权威显示差分。B7 替换原 B3 的逐 tick 重执行取帧，避免再多跑第三遍。

**SR-C6-01 共用事件投影。** `toCombatViewEvents` 从 `src/server-entry` 与纯模块 `combat-replay-view.ts` 导出，返回类型 `CombatAnimationEvent[]` 可赋给 `CombatViewEvent[]`，但类型与运行时均不包含 unitUpdated。输入为可信的完整账本或局部批次，按输入顺序逐条应用下表白名单，保留原 tick/eventSeq（包括延后发出的 tick0 和过滤后留下的序号间隔），不排序、不重编号；activityChanged/effectTriggered 被省略，空输入返回空数组。嵌套坐标、targetIds 等也复制，不共享输入对象或数组，不修改输入，不执行战斗、推进随机流或结算；返回独立数组，函数本身不冻结它，完整回放仍由 toCombatReplay 递归冻结。无正常业务失败枚举；不校验不可信网络输入，非法结构导致的底层异常原样传播。

回放生成内部直接调用此函数。任一可信完整战斗满足 `toCombatViewEvents(battle.events)` 与 `toCombatReplay(battle).ticks.flatMap(frame => frame.events).filter(event => event.type !== 'unitUpdated')` 完全相等。该函数只给动画事实，不产生单位差分或终态，不能替代 applyCombatReplayTick。客户端 `src/presentation/combat-display.ts` 删除复写白名单，直接调用此导出；离线仅额外保留原位置的 effectTriggered 标签（tick/eventSeq、ownerId/sourceKind/sourceDefinitionId/targetId），不携带执行程序，不把离线标签并入联机回放。

CombatViewState 按 §10.9 combat 白名单构造，不传 sources/tasks/runtime/strategy/ability/机制定义/RNG/中立奖励收据。attackDamage、abilityPower、attackIntervalTicks、attackRange、armor、magicResist 是 readCombatStats 的**当前有效值**；客户端直接显示，不再套用静态装备/状态计算。

原始事件没有完整的战后数值，且状态到期/动态防御等不能单靠伤害事件推回。因此协议采用 **每20 tick（1秒）一个权威关键帧 + 帧间精简动画事件 + unitUpdated 显示差分**。末 tick 必有关键帧（tick0结束时 initial=terminal，无需重复帧）。每 tick 都有一条 ticks 记录，包括无动作的 tick；首记录 tick0 只包含 `eventSeq < initial.nextEventSeq`（缺失游标视为0）的已应用开局事件。**事件 tick 不是发出边界**：例如3-7狼群的5条 tick0 跳跃事件由第一次 step 发出，仍保留原 tick/eventSeq，但放在 tick1 记录、其 unitUpdated 之前，与对应权威状态一起消费，不能在 tick0 重复播放。后续重执行按 `eventSeq >= initial.nextEventSeq` 与输入动画账本严格比对；缺失、篡改或重复的可见事件仍报 replay-divergence，不是忽略所有 tick0 差异。

客户端从 initial 开始按 tick 顺序：先读动画事实播放表现；再把该 tick 末尾 `unitUpdated {unitId, changes}` 的字段按值覆盖到单位；有 keyframe 则整体替换当前视图。提供的 applyCombatReplayTick 实现状态部分，可不解析动画。差分字段仅来自 CombatViewUnit 白名单，包括绝对 hp/maxHp/mana/maxMana/shield/alive/targetId/cell 及当前有效属性；不是增减指令。**不要再根据 packetDamage、heal、manaChanged、cast、shieldLayerChanged 重复加减数值**。每 tick 的状态均与权威显示视图一致，最终与 terminal 完全一致。跳转到最新关键帧后只需应用其后的帧。

所有原始投影动画事件保留 tick/eventSeq（原顺序，省略内部事件会留下序号间隔）；unitUpdated 是显示事件，没有权威 eventSeq、不能计入结算事件总数。完整领域账本继续留在服务器，未截断、未替换。事件白名单：

| type | 展示字段（另含 tick/eventSeq）与用途 |
| --- | --- |
| movement | unitId, from, to；移动动画 |
| attack | attackerId, targetId；普攻动画 |
| targetChanged | unitId, before, after；目标标记 |
| death / kill / growth | unitId；kill 另有 sourceId，growth 另有 amountBps/totalBps；表现事实 |
| packetDamage | sourceId, targetId, damageType, hit, hpDamage, absorbed, critical, killingPacket；伤害飘字，不执行规则 |
| heal | targetId, actual, shares: {sourceId, actual}[]；实际治疗与施加者份额 |
| manaChanged | targetId, before, after；表现事实 |
| cast | sourceId, actionSeq, completed, actualManaSpent, refundedMana, targetIds, completionCell |
| shieldLayerChanged | reason, key, targetId, remaining；单层提示，不累加为总盾 |
| statusChanged | reason, targetId, kind, effectiveMagnitudeBps；无内部贡献/定时执行程序 |
| statChanged / maxHpChanged | unitId, stat, before, after / unitId, beforeMax, afterMax, beforeHp, afterHp |
| combatFinished | result, reason；全局胜负仍由对局调度决定 |

activityChanged/effectTriggered 的执行程序不下发，可见数值后果在 unitUpdated。当前视图不承诺完整的状态图标/持续时间选择器；若 C 需要这些，应另提具体白名单字段，不能回填 runtime。B 视角沿用 §12.6 的纯显示镜像：所有首末/关键帧 unit.cell/startingCell、movement.from/to、cast.completionCell，以及新增 unitUpdated.changes.cell/startingCell 都要翻转 row；队伍/胜负互换、ID/seq/数值不变。对 changes.team（若存在）与 combatFinished.result 同样转换，不镜像 RNG 或重跑战斗。

toCombatReplay 失败以 RangeError 抛出：`invalid-replay-input`（非 tick0 初态、末态未结束或 tick 超界）；`replay-divergence`（重执行未逐 tick 推进、单位集合变化、末视图或投影动画序列不符）。底层非法引擎输入异常原样传播；这些都是服务器故障，不能据此伪造平局/结算。该函数不是不可信战斗验证器，不能用其接受动画序列来证明战斗真实性。toCombatViewState/显示 reducer 无业务失败枚举；只用于可信状态/本协议 DTO。

**SR-G5-01 治疗来源。** heal 保留单条领域事件及原 tick/eventSeq，不拆分或重复序号；actual 为目标实际获得的总治疗，新增 `shares: {sourceId: string, actual: number}[]`，按 outcome.shares 原顺序逐条复制 ownerId 与 actual。包括零份额，同一 owner 的多个来源不合并。权威机制已完成重伤、取整与生命上限裁剪，不得重新按比例分配；可信账本满足 `sum(shares.actual) === actual`。不下发完整 Source、contributions 或执行计划。B 视角保持 sourceId/targetId/份额数值不变。重执行、终态与动画序列校验保持，新增来源和份额同样纳入 replay-divergence 比对。历史无 shares 的缓存回放需从完整账本重新生成才能使用来源统计；本包不改版本号或 digest。

**G5 战斗统计权威入口**（simulation/combat-summary.ts 与 server-entry 导出）：

```ts
summarizeBattle(replay: CombatReplay): readonly UnitBattleSummary[];
interface UnitBattleSummary {
  readonly unitId: string;
  readonly definitionId: string;
  readonly team: 'player' | 'enemy';
  readonly starLevel: 1 | 2 | 3;
  readonly damageDealt: number;
  readonly damageTaken: number;
  readonly shieldAbsorbed: number;
  readonly healingDone: number;
  readonly healingReceived: number;
  readonly kills: number;
  readonly alive: boolean;
}
```

输入是当前合同生成的一场完整可信回放（包括 tick0），不是增量帧或不可信客户端 JSON。沿 initial.units 顺序每单位一行，包括零贡献单位；空战斗返回空数组。只读原始回放，返回独立数组/对象，不推进战斗、不结算、不消费 RNG。无正常业务失败枚举，结构错误的底层异常原样传播。

- damageDealt：packetDamage 的 hpDamage+absorbed 按 sourceId 求和；damageTaken：同一和按 targetId 求和。shieldAbsorbed 单列其中 absorbed，不计护盾授予、衰减、过期或清理。
- healingDone：heal.shares.actual 按 sourceId 求和；healingReceived：heal.actual 按 targetId 求和，不计 overheal/requested，不把全部治疗归给第一条来源。
- kills：kill 事件按 sourceId 计数，不重复统计 death/killingPacket。alive：terminal 的单位 alive，不由伤害推测。
- unitUpdated/关键帧不重复累计统计量。没有本场单位行的外部来源不虚构单位行。镜像席不可结算不影响完整战斗展示。

`src/presentation/battle-ranking.ts` 应改用此函数作为本场排行口径；治疗主列用 healingDone，受治疗提示用 healingReceived，跨场累计展示由界面负责。B 视角只交换单位队伍，所有 ID/统计量不变。本包不改服务器投影与界面接线。字节变化见 [G5 验收证据](evidence/g5/REPORT.md)。

### 14.3 体积、验证与交接

Node v22.23.3 / npm 10.9.9，seed42，同一场真实战斗；比较**逐 tick CombatState 数组**与完整 CombatReplay 的 UTF-8 JSON（未含 WebSocket 包装）：

| 固定样例 | ticks | 原始 JSON | 回放 JSON | 比例 | 原始 / 回放 gzip |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1v1 Maddie | 262 | 1,390,764 B | 38,624 B | 2.78% | 14,897 / 2,678 B |
| 6v6（含装备、护盾、治疗与技能） | 585 | 40,593,642 B | 403,090 B | 0.99% | 1,663,402 / 19,443 B |

由 `node scripts/verify-t5r-node-entry.cjs` 可复现（先 build:server），报告输出 artifacts/t5r-projections/report.json；gzip 是样例字节测量，不等于 WebSocket permessage-deflate 线路实测，不承诺所有对局固定比例。仍需一次纯重执行的 CPU，B7 不应在每次广播/重连重复生成，应按 battleId 缓存不可变回放。

B4：接 §11.5 推进/失败处理；B5：用 nextSharedRound 全席批量推进。B7：所有初次 state、增量全态、重连、失败快照统一调用 toPrivateSeatView；战斗改送 CombatReplay，并按上述事件和坐标清单接入显示。规则投影通过不等于网络已经去除所有旧完整状态，B7 必须检查所有实际发布路径。T5R 不修改 src/server、界面、单人 golden，也不实施全局排名。

交付验证：实际 nvm Node **v22.23.3** / npm **10.9.9**；T5R 3文件14例，连同 T2/T3/TP/T7、单人经济/命令/序列化/跨轮/来源账本与纯依赖回归共 **21文件336例通过**。typecheck、build、test:server-entry、verify-t2/t3/tp/t7/t5r-node-entry 均通过；T1 的既有状态/事件/RNG 轨迹哈希不变。未运行完整浏览器/公网性能套件，网络发布和客户端播放尚待 B7 接入验证。

同步最新 `origin/multiplayer@bc35bac`（B4）后，重新 build/typecheck 与 T5R Node 测量通过，并追加 `tests/server/{room,round-commit,projection,two-sided-resolver,local-room-client}.test.ts` **5文件42例通过**；合计已验证26文件378例。同步只处理 docs/UI_REQUESTS.md 末尾追加冲突，完整保留 B4 新需求；PR 相对该集成基线无服务器/界面改动。

### 14.4 SR-G5-02 当前回合经济预估

从 simulation/economy-preview.ts 与 server-entry 导出：

```ts
interface RoundEconomyPreviewOutcome {
  readonly base: number;
  readonly interest: number;
  readonly win: number;
  readonly streakGold: number;
  readonly streakAfter: { readonly kind: 'win' | 'loss' | null; readonly count: number };
}
interface RoundEconomyPreview {
  readonly roundId: string;
  readonly gold: number;
  readonly ifWin: RoundEconomyPreviewOutcome;
  readonly ifLoss: RoundEconomyPreviewOutcome;
}
previewRoundEconomy(state: MatchState): RoundEconomyPreview | null;
```

输入是权威席位 MatchState。preparation/combat 返回基于当前金币与 streak 的两组假设；choice/settlement/gameOver、已淘汰席、supply 回合返回 null。不读取敌方阵容、幸存人数、战斗结果、商店或 RNG，不预测掉落。输入不变，返回的 streakAfter 为独立对象。无正常业务失败枚举，非法权威状态导致的底层规划异常原样传播。

`resolveRoundEconomy` 是预估与真实结算的共用分流：目录回合调用 planCatalogRoundEconomy（1-x 走 OPENING_ECONOMY_RULES，利息/胜利/连胜金币为 0），加时调用原 planRoundEconomy PvP 规划。Match 的离线/PvE 结算与 applyRoundSettlement 均走该入口。预估传入己方 HP/等级/经验及固定 enemySurvivors=0，伤害参数不参与返回经济字段，无须读对手。

ifWin 假设 playerWin，ifLoss 假设 enemyWin；PvP 平局经济与失败相同。gold 是调用时金币，不含基础收入或掉落；正常 PvP 利息基数含胜利金币，streakAfter 是胜负更新后的 streak。若金币/streak 直到结算未变，对应分支的 base/interest/win/streakGold 精确等于 roundResults 最后一条 incomeBreakdown.base/interest/win/streak，streakAfter 也相等。base 是本回合结算的基础金币，1-2/1-3/1-4 分别为 2/3/5，后续普通战斗及加时为 5；两种胜负分支相同，直接读取共用经济规划器，不含掉落或额外奖励。不承诺掉落、XP、HP 或敌方奖励。此字段仅为只读预览输出，不改变结算、存档或协议版本；无新增失败原因。

Claude 负责接入私有席位投影及经济提示，界面不得重写开局/目录/加时和 streak 公式。本包不增加 toPrivateSeatView 字段，不改 wire 版本、digest 或玩法。

## 15 T10：战斗运营与准备截止自动上场（2026-10-13）

本节按用户本次确认的 TFT 行为定稿，覆盖 §9 的旧 preparation-only 限制、§11.3 的“运行中拒绝修改席位”和 §12.4 的 PvP 直接结算接法。只允许更新本席当前运营资产，绝不改写已冻结的本场战斗输入。Codex 交付 simulation、纯 Node 导出、测试和合同；`src/server/room/room.ts` 阶段闸门、截止调用及服务器并发编排由 Claude 接入，本次不修改 `src/server/` 或 `src/rendering/`。

### 15.1 本席 (phase, command) 允许矩阵

以下仅适用于 `multiplayer.status='active'` 的席位；preparation 一列指未锁定棋盘的准备态。T12 装备子矩阵同时适用于单人；其它单人阶段限制保持原样（包括既有 settlement 满备战区待领奖让位出售特例）。gameOver、淘汰席一律不能执行这些运营命令。接口签名沿用 §9.2/§12.2；`combine`、`equip` 是线上 ClientCommand 名称，分别调用 combineItems/equipItem。

| 命令 / 目标 | preparation | combat（含下述 PvP 阵容锁） | choice | settlement |
| --- | --- | --- | --- | --- |
| buy、reroll、buyXp、shopLock | 允许 | 允许 | 允许 | 允许 |
| sell 备战席己方单位 | 允许 | 允许 | 允许 | 允许 |
| sell 棋盘单位 | 允许 | wrong-phase | wrong-phase | wrong-phase |
| deploy bench→bench 空槽移动 / 己方互换 | 允许 | 允许 | 允许 | 允许 |
| deploy bench→board、board→bench、board→board（含互换） | 允许 | wrong-phase | wrong-phase | wrong-phase |
| combine 两件库存组件 | 允许 | 允许 | 允许 | 允许 |
| equip 库存装备给己方备战席单位合法槽 | 允许 | 允许 | 允许 | 允许 |
| equip 库存装备给己方棋盘单位合法槽 | 允许 | 允许 | 允许 | 允许 |
| equip 库存组件 + 己方单位已穿永久组件，原子合成并穿戴 | 允许 | 允许 | 允许 | 允许 |
| choose、anomalyTarget、anomalyReroll | wrong-phase | wrong-phase | 按现有 pendingChoice 校验 | wrong-phase |

startCombat / step / timeoutChoice / claimLoot / settleRound / 推进下一轮仅属服务器调度，沿用对应入口阶段前提，不属于客户端新增白名单。

“允许”仍须通过所属、槽位、库存、费用、generation、人口、卡池等原有校验，不代表无条件成功。运营不改变当前 phase，不推进战斗，不修改 `combatInputBasis`、当前 `combat` 或两方 `PlayerBattleSnapshot/BattleInput`；买经验只增加当前运营等级/经验，人口变化不向本场战斗补人。刷新只消费既有 shop RNG；装备父件生成临时装备仍按既有独立 equipment RNG，不能消费 battleSeed/Combat RNG。正常物品/棋子 ID、事件序号、来源、装备与成长迁移、商店和共享池事务同样必须保留，不能只改显示金币。

购买的新棋子进入最左空备战槽；合成仍检查**最终**备战席容量。战斗中只以备战席棋子加本次购买候选做递归三合一，棋盘单位在每一星级均不参与：棋盘一张 A、备战席两张 A 暂不合并；备战席买到第三张 A 立即合并。三合一能腾出空间时沿用既有购买成功规则；无法容纳的购买返回 `bench-full`，不扣钱、不占新池、不消耗 ID/RNG。choice/settlement 没有进行中的战斗锁时，购买沿用正常全阵容升星；已冻结的旧战斗仍不受影响。

### 15.2 Claude 的 room.ts 阶段闸门与原子提交要求

`RoomPhase` 实际名称是 battle，界面投影才叫 combat；本席 MatchPhase 与 RoomPhase 不能混用。room.ts 原第 251 行的 allowed 应按下表准入，再由规则执行 §15.1 的目标校验。`OPS` 精确枚举为 `buy | sell | reroll | buyXp | shopLock | deploy | combine | equip`；`CHOICES` 为 `choose | anomalyTarget | anomalyReroll`。不新增客户端命令、锁字段或自动上场按钮。

| RoomPhase | 可送入规则的 ClientCommand.type | 说明 |
| --- | --- | --- |
| preparation | OPS、CHOICES | 各席 choice/preparation 不同；规则继续验证本席阶段 |
| choice | OPS、CHOICES | 非选择操作不关闭/跳过选择窗口 |
| frozen | 无 | 这是截止、自动部署、快照冻结的不可交错原子边界，完成后进入 battle |
| battle | OPS | 出售/部署仍按 §15.1 限制为备战席；装备允许己方棋盘与备战席合法目标。即使内部 PvP Match.phase 仍是 preparation 也必须锁定阵容 |
| awaiting-settlement | OPS | 使用本席仍有效的战斗锁，等待结果期间可运营；真正提交整轮事务时不允许命令插入 |
| settlement | OPS | 按本席阶段校验；若本席尚有 choice，先进入既有 choice 窗口才接受 CHOICES |
| waiting、ended，或 disposed | 无 | wrong-phase |

现有身份/席位/连接代次/commandId/轮次/seatRevision/generation 检查继续生效；淘汰、接管和旧控制代次分别沿用 `seat-eliminated`、`seat-controlled`、`control-revoked`，阶段拒绝用 `wrong-phase`，不新增 room 错误枚举。失败不发布新版本/状态。成功按现有单写队列提交 pool + 最新 live seat，并递增可见版本。

**不能用战前的 state/pool 覆盖运营结果。** 冻结信封只作为战斗输入/身份依据，最新 live seat 是购物、装备、金币、经验、商店、来源的权威。PvP 收据在最新 live seat 上应用；PvE start/step/奖励事务同样必须沿最新 seat/pool 推进或由规则产生最新结算，不能把 resolver 预先计算的整份旧 MatchState 在播放结束时直接覆盖回来。利息/经验沿用规则在实际结算提交时读取的 gold/level/xp，不回滚期间花费，不重复奖励。多席原子 staging 仍遵循 §11.3：从当前提交版本开始，任何一席失败则整批不发布；旧执行代次拒绝，冻结 battleSeed 不重抽。

### 15.3 PvP 阵容锁、战后合并与共享池入口

既有 T2/T3 用 preparation + combat=null 表示 PvP 本席，不能伪造 RunningCombat，也不能仅开放 RoomPhase 后把它当普通准备态调用。新增公共导出：

```ts
// src/simulation/match.ts 和 src/server-entry/index.ts
lockMatchCombatRoster(state: MatchState): MatchCommandResult;
```

输入必须是 active 联机、PvP、preparation、pendingChoice=null；否则 `{ok:false,state,reason:'wrong-phase'}`。服务器先按 §15.4 完成部署并冻结两方/镜像快照，再对**live seat**调用本函数；冻结快照保留锁前独立对象。成功仅设置服务器私有 `multiplayer.combatRosterLocked?: true`，无事件、无资源/RNG/序号变化；重复锁定成功返回同一 state、空事件。它仅限制棋盘出售/部署和战中升星参与者（购买只做备战席升星），装备按 §17 允许，买刷经验等继续允许；`snapshotForBattle` 对已锁 live state 返回 `BattleValidationError('wrong-phase')`，防止拿运营后状态重编译当前战斗。此字段不下发，也不接受客户端指定。

PvE 使用真实 combat 阶段，自带同等锁定语义。正常战后合并已接入 `stepMatch`/`startMatchCombat` 的战斗结束路径与 `applyRoundSettlement`：先提交本场合法成长，再按原升星保留顺序（棋盘优先、棋盘行列、备战席槽位、ID）递归合并。产生既有 `unitUpgraded` 与装备迁移事件，迁移 latest live seat 的 persistentGrowth/anomalyBinding/最新装备及三合一来源；不发新棋子、不消耗单位 ID、不再次扣池。装备临时子项沿原父实例 roll 复用。延迟合并不重跑本场战斗，冻结快照与 Combat 账本仍保留旧星级。PvP 合法结算原子移除 `combatRosterLocked`；重复收据仍 `duplicate-settlement`，不会再次合并/发资源。

延迟合并新增私有来源事实 `{kind:'unit-upgraded-after-combat', event:UnitUpgradedEvent}`，不伪造新的购买 acquisitionSequence；共享池按真实 consumedIds 合并原有 sources。单人不生成此事实，旧单人恢复边界保持拒绝 multiplayer 状态。

**共享池 PvP 必须使用新增 settleRound 包装**，因为战后合并会改变持有 ID，不能再直接 applyRoundSettlement 后只替换 Match：

```ts
type SharedMatchCommand = /* §12.4 原有分支 */
  | { readonly type: 'settleRound'; readonly receipt: RoundSettlementReceipt };
runSharedMatchCommand(pool: SharedPoolState, state: MatchState,
  command: SharedMatchCommand): SharedPoolResult;
// 每席 staging 串接前一席成功返回的 pool；全部成功后一次发布。
const result = runSharedMatchCommand(latestPool, latestSeat,
  {type:'settleRound', receipt});
```

返回/失败沿用 §12.5 + §11.2，含守恒、stale-seat、seat-eliminated、invalid-receipt、duplicate-settlement 等；失败 pool/state 均保持输入引用。无共享池的规则用例仍可直接 applyRoundSettlement。PvE 已使用的 startCombat/step 共享包装会自动折叠战后合并，无需新增单独的 merge 命令。

choice 开放买卖后，若已选异常目标被升星消费，pendingChoice.targetId 跟随 survivor；被出售则回到 target 步骤。两者 generation +1、发 choiceOpened，旧 generation 得到 stale-choice；保留已抽 offers/rerollCount，重新指定目标不再抽 RNG、不免费刷新。备战席目标卖空后沿用既有超时“空异常”处理。这是避免运营使选择卡死的必要接续，不改变异常价格或候选算法。

### 15.4 准备截止自动上场签名、顺序与事件

```ts
// src/simulation/match.ts 和 src/server-entry/index.ts
function autoDeployToCap(state: MatchState): MatchCommandResult;
// 新增 MatchEvent 分支，线上手动 deploy 与自动 deploy 共用：
{ readonly type:'unitDeployed'; readonly unitId:string;
  readonly from:UnitLocation; readonly to:UnitLocation;
  readonly domain:'match'; readonly eventSeq:number }
```

输入是可信 active 联机 preparation、尚未锁定的本席状态。己方棋盘人数少于 `getDeploymentCap(state)` 时，按**备战席槽位从左到右**依次取己方单位；不区分类型，不读射程。落点从**最靠近敌方的前排**开始，每行先中间、再向两侧；同距先左。默认 7 列的列顺序精确定为 `3,2,4,1,5,0,6`，己方行顺序 `4,5,6,7`。这是用户后续确认的落点规则，取代最初“左下角按行从左到右”的描述。跳过所有已占格，绝不交换/挤走棋盘单位；行满后退一排，填到人口上限或备战席空（几何无空格也停止）。不排序/移动原有棋盘阵容。

每次实际部署复用 deployMatchUnit，输出 unitDeployed；手动互换中每个实际移动单位各有一条，序号连续。未移动不发事件。成功返回新 preparation 和累积事件序号，其余金币、经验、商店、装备、成长、来源、ID 与**所有 RNG**完全不变。已满人口/空备战席成功返回原 state 和空 events；重复调用不会重复事件。单人 startMatchCombat、PvP snapshotForBattle 都**不会隐式调用**此函数。

失败原子返回原 state、无 events：非联机/已淘汰/非 preparation/已经锁定 → `wrong-phase`；输入已超过人口 → `population-cap`。内部正常部署若拒绝，整次回滚并透传 `unknown-unit | enemy-unit | invalid-location | outside-deployment-zone | occupied | population-cap | wrong-phase`；可信合法输入不会出现单位/几何失败。不消费 RNG，不产生部分部署。

Claude 准备截止时按以下顺序接入，客户端命令不能插入中间：

1. 按 §11.4 处理已到期 choice/待领资源；需要等待选择的席位仍按原窗口推进，不能强行改 phase。
2. 对所有本轮存活 preparation 席位调用 autoDeployToCap，暂存返回 state/events；失败整轮停止，不能拿部分部署结果开战。纯部署不改变共享持有来源，pool 不变，保留 sharedPool 绑定。
3. 所有席位部署完成后统一冻结 PvP 双方及奇数镜像来源快照；先全部冻结再锁 live seat，避免镜像来源已经被锁。PvE 在自动部署结果上调用共享 startCombat；其 combatInputBasis 必须包含这些落点。
4. PvP 对 live seat 调用 lockMatchCombatRoster，保留已冻结信封；切入 battle、发布新的席位/房间版本与部署事件。后续运营始终作用于 live seat，不替换冻结输入。

### 15.5 失败原因、版本与验证

运营白名单没有新增失败枚举；下表是调用方须处理的规则失败，共享入口还可能返回 §12.5 的结构/绑定/事务失败：

| 命令 | 失败 reason |
| --- | --- |
| 所有运营 | wrong-phase（阶段、棋盘目标限制或 Match 淘汰保护）；共享入口淘汰为 seat-eliminated |
| buy | invalid-slot、stale-shop、purchased-slot、insufficient-gold、bench-full；共享缺货格另有 empty-slot |
| sell | unknown-unit、enemy-unit；共享返回原池/状态 |
| reroll | insufficient-gold；共享另有 stale-shop、pool-empty |
| buyXp | max-level、insufficient-gold |
| shopLock | invalid-choice（非 boolean）、stale-shop |
| deploy | unknown-unit、enemy-unit、invalid-location、outside-deployment-zone、occupied、population-cap |
| combine | temporary-item、unknown-item、same-item、item-not-inventory、invalid-recipe |
| equip | temporary-item、unknown-item、unknown-unit、item-not-inventory、invalid-slot、item-slot-occupied、invalid-recipe、unique-conflict、exclusive-slots |

阶段限制先于资源校验；棋盘目标限制仅适用于出售/部署，equip 的组件目标成功时返回 itemCombined 后接 itemEquipped（详见 §17）。合法阶段内沿用身份/槽位/放置校验顺序；未知单位继续由对应命令报告所属/身份错误。失败不变金币、商店、pool/seat revision、任何随机流、ID 或事件序号。原已消费商店格不是 bench-full；不能把其它失败统一翻译成容量失败。

沿用 SR-C7-01 的规则修订流程：固定 M8 schema6/rules/content/protocol 标识保持，新增细分规则版本并加入 `content/index.ts` 的 canonical digest：`multiplayer-combat-ops-v1`、`bench-during-combat-deferred-v1`、`front-center-left-first-v1`。digest 从 `fnv1a32-utf16:20b58a63` 更新为 **`fnv1a32-utf16:a0b38123`**；旧 digest 存档明确拒绝、不迁移。新证据保存于 `tests/t10-content-baseline.json`；T1 验证新 identity，替换**仅 digest**后必须逐字节匹配原离线战斗状态轨迹，原事件/RNG/战斗数值基线不改。

新增回归位于 `tests/t10-auto-deploy.test.ts`、`tests/t10-combat-ops.test.ts`、`tests/t10-deferred-upgrades.test.ts`：独立落点序列、填满/空席/幂等/无 RNG、单人不自动上场、三阶段白名单与棋盘拒绝、失败原子性、共享卡池守恒、满备战席、战斗中备战席独立升星、PvE/PvP 战后合并与成长/装备迁移、选择目标失效接续、冻结战斗逐 tick/完整两方结果不变、旧 digest 拒绝。服务器闸门、播放期间运营不被旧 resolver state 覆盖及真实多人 UI 接线须由 Claude 按 §15.2–15.4 验收。

## 16. T11：开局经验与自动接续（2026-10-13）

用户签字见 [S13_RULES_GAP 顶部](S13_RULES_GAP.md)。仅实施 R1、验证 R6；§15 操作矩阵及 combatInputBasis 冻结保持原合同，R2 后续单独实施。

- `OPENING_ECONOMY_RULES.version = m8b-opening-project-v2`；1-2/1-3/1-4 自然 XP 为 2/2/2，基础金币仍为 2/3/5。阈值表 `1:2,2:2,3:6,4:10,5:20,6:36,7:48,8:76` 不变。
- XP 由现有唯一结算收据发放，胜、败、平相同。不能在进入 2-1 时补发，也不能重置玩家合法买 XP 的成长。无买卖/刷新/买 XP、seed 42 的单人及八席，在进入 2-1 强化选择前每席均为 **10G、等级 3、2/6 XP**。
- `planOpeningEconomy(input: OpeningEconomyInput): OpeningEconomyPlan` 和 Match/Room 既有公共签名、失败原因均不新增。重复 step/继续及保存恢复不增加结算次数；失败返回原对象、不发事件、不消耗 RNG。
- 外层 schema6 / rules `m8-14.24b-v1` / content `s13-14.24b-m8-v1` / save2 / replay2 / commandProtocol2 / NET_PROTOCOL_VERSION=1 不变。细分开局版本进入 `CONTENT_DIGEST`，`LOOT_REPLAY_DIGEST` 的 openingPolicy 同步引用它；因此即使第一场战斗的数值未变，其冻结身份也改变。旧 digest 存档/快照由既有严格校验拒绝，不迁移或补写旧账本；上线须在活动局结束后切换。
- 自动日程保持 x-3 战斗结算 → x-4 供给选择/结算 → x-5 准备，x-7 野怪结算 → 下一阶段 x-1（如有强化先完成选择再准备）。供给轮不进入 battle、不多开一场；每推进轮只结算一次。**6-7 后联机使用 `overtime-1` 并继续纯 PvP 加时**；不是常规 7-1 野怪/供给日程，单人仍在 6-7 终局。T11 只增加整局定时器接续测试，不改 round-catalog 或服务器调度。

本次为批准的项目修订；14.24b 原档缺逐轮 XP/完整日程执行脚本的历史证据限制仍见设计来源台账。

T11 固定身份：CONTENT_DIGEST `fnv1a32-utf16:b4a5c2e2`；LOOT_REPLAY_DIGEST `fnv1a32-utf16:7b14bfba`。变更与 golden 逐项说明见 [T11 审计](evidence/t11/README.md)。


## 17. T12：战斗中装备永不锁定（R2，2026-10-14）

依据为用户已签 [S13_RULES_GAP §2.2–2.4](S13_RULES_GAP.md#22-拟替换-151-的装备子矩阵)，不是新的战斗数值或 TFT 历史行为还原。§15.1 装备四行适用于单人及 active 联机席位的 preparation/combat/choice/settlement，含 `combatRosterLocked`。己方目标指本席持有的永久单位，含本场已死亡而运营阵容仍存在的单位；不含敌方、镜像、召唤物或野怪。gameOver、淘汰、非本人资产拒绝；选择与报价不因穿戴而重开或重抽。买卖/部署/经验/刷新矩阵不变。

### 17.1 导出、输入输出与失败

```ts
// src/simulation/match.ts；既有 src/server-entry/index.ts 导出，wire 形状不变
combineItems(state: MatchState, aId: string, bId: string): MatchCommandResult;
equipItem(state: MatchState, itemId: string, unitId: string, slot: number): MatchCommandResult;
// src/simulation/item-selectors.ts；客户端读预览，无 ID、事件或 RNG 消耗
previewCombine(state: Readonly<MatchState>, aId: string, bId: string): CombinePreview;
previewEquip(state: Readonly<MatchState>, itemId: string, unitId: string, slot: number): EquipPreview;
// src/simulation/operation-policy.ts；装备专用许可，独立于 canOperateMatch
canOperateEquipment(state: Readonly<MatchState>): boolean;
```

`combineItems` 只接受两件库存组件。`equipItem` 空合法槽沿原穿戴；输入为库存普通组件且目标槽已穿永久普通组件时，原子合成并留在该槽。预览与执行共用 `validateEquip`：先按移除两组件后的最终槽位集合验证配方、唯一性和独占，再分配一个永久 ID，发 `itemCombined`、`itemEquipped`，最后规划临时装备。窃贼本体仍归一到槽 0 并独占三槽，仅新父实例本轮规划一次，沿独立 equipment RNG。预览成功额外可有 `combination: {resultDefinitionId, consumedItemIds: readonly [string,string]}`；其余 `allowed/reason/occupiedSlots/conflictingItemIds` 语义沿用原类型。该可选结果不是新增网络投影字段。

成功 `{ok:true,state,events}`，Match 事件序号连续；普通 equip 不消耗永久 ID，合成恰消耗一个。失败 `{ok:false,state,reason}` 保留原引用且无 events，所有 RNG、ID、序号、共享池不变。失败枚举：

- combine：`wrong-phase | temporary-item | unknown-item | same-item | item-not-inventory | invalid-recipe`。
- equip：`wrong-phase | temporary-item | unknown-item | unknown-unit | item-not-inventory | invalid-slot | item-slot-occupied | invalid-recipe | unique-conflict | exclusive-slots`。

非组件占槽仍拒绝 `item-slot-occupied`；组件目标不合法配方拒绝 `invalid-recipe`；其它永久装备占用时两拳套合成窃贼拒绝 `exclusive-slots`。不跨两个单位取装备、不免费拆卸、不替换成装、不把冲突物品暗中推回库存。内部纯 `planEquip(items,preparation,itemId,unitId,slot,nextItemSerial)` 成功增加返回 `nextItemSerial`；不是新的 wire 命令。

### 17.2 冻结、结算、共享池与恢复边界

只提交 latest live seat 的永久装备、合成来源、装备 roll/临时投影和 Match 事件。禁止改写 `combatInputBasis`、当前 Combat、两方 PlayerBattleSnapshot/BattleInput 或镜像来源；当前 HP/护盾/属性/触发器、战斗 RNG 与 battleSeed 不变，不重编译已锁 live seat。战中新装备下场生效，本场已消费的旧组件继续留在冻结来源前缀。本场成长/唯一奖励只按旧冻结战斗提交到最新席位；战后合并迁移最新装备，新物品不得追溯领取本场装备触发或计数收益。

装备/合成不消费 loot/shop/battle RNG，不改变共享池资产。现有 room 的 plain Match 装备事务保持 pool 引用和 sharedPool 绑定；不额外新增 runSharedMatchCommand 分支。战后升星仍通过共享 start/step/settleRound 包装合并真实 sources 并检查守恒。冻结及整轮结算仍是不可交错事务，过期命令沿现有 revision/round 检查明确拒绝，不改参数重放。

用户在 PR #71 选择 **B**：本次不新增联机完整存档恢复器，**§12.5 不变**。单人 PvE/PvP 在四阶段装备/单位身上合成后必须 serializeMatch→restoreMatch→同样续算；来源 fold 仍校验出生、配方、消费、序号、奖励顺序及成长。冻结按 `provenancePrefixLength` 和 `equipmentRollPrefixLength` 重建旧身份；只放开合法 item-combined suffix 和库存至合法槽的变化，冻结已穿装备不得无偿脱离，非装备输入仍精确检查。结算装备 roll 的等级上界包含真实 levelAfter，冻结本场 roll 仍受冻结等级约束。

联机只恢复冻结描述并确定性重算：PlayerBattleSnapshot 可描述 PvE 玩家侧；PvE 配原已冻结目录遭遇重算，BattleInput/compileBattle 按现有合同仅适用于 PvP。PvP 双方/镜像用 restorePlayerBattleSnapshot/restoreBattleInput；随后在未中断的可信 latest live seat 上续算、结算、迁移。此证据不宣称联机进程重启恢复，restoreMatch 继续拒绝 multiplayer/sharedPool。

### 17.3 版本、证据与 Claude 接线

| 身份 | T11 基线 | T12 |
| --- | --- | --- |
| 装备操作细分版本 | 无 | equipment-ops-next-battle-v1 |
| MULTIPLAYER_OPERATION_RULES.version | multiplayer-combat-ops-v1 | multiplayer-combat-ops-v2 |
| EQUIPMENT_RULES_VERSION | m8-b5-instances-v2 | m8-b5-instances-v3 |
| CONTENT_DIGEST | fnv1a32-utf16:b4a5c2e2 | **fnv1a32-utf16:44fe9c0e** |
| LOOT_REPLAY_DIGEST | fnv1a32-utf16:7b14bfba | **fnv1a32-utf16:7b14bfba**（掉落规则未改） |

三项细分身份进入 canonical digest。外层 schema6 / rules `m8-14.24b-v1` / content `s13-14.24b-m8-v1` / save2 / replay2 / commandProtocol2 / NET_PROTOCOL_VERSION=1 不变。旧 content digest 存档明确拒绝，不迁移、不补旧账、不重写已冻结战斗。

独立依据、每个 golden 的原因和实际测试结果见 [T12 证据](evidence/t12/README.md)。T1 原事件/RNG/战斗数值锚点不变，只替换 T12 digest 后 165 个状态逐字节匹配 T11；继续历史归一化匹配原 T1。room 闸门已放行 equip/combine，Claude 只需按 [UI_REQUESTS 的 T12 说明](UI_REQUESTS.md#t12-对-claude-的接线说明2026-10-14) 调整预览、拖放目标与提示。不新增 §14 投影字段，不规定布局和视觉。

### 17.7 T13-A 单位全槽自动合成

`equipItem(state: MatchState, itemId: string, unitId: string, slot: number): MatchCommandResult`
与 `previewEquip(state: Readonly<MatchState>, itemId: string, unitId: string, slot: number): EquipPreview`
沿用原签名及失败枚举。库存普通组件遇到该单位任意槽的永久普通组件，必定优先合成；请求槽只在没有已穿组件时决定落点。合法 slot 仍为 0/1/2，非法值返回 invalid-slot。

旧状态若持有多个散件，按槽号从小到大选第一件，不按数组顺序或请求槽挑选。普通成装留在被消耗散件所在槽；三槽窃贼父件继续规范到 0 槽并占用 0/1/2。`combination` 形状不变；成功预览 `occupiedSlots` 是**实际**落槽，客户端不可再使用请求槽推断。

配方、唯一性及独占冲突沿用 invalid-recipe / unique-conflict / exclusive-slots 等现有码。失败保留原状态、无事件、无资源/RNG/ID 消耗；成功合成仅分配一个永久 item ID。窃贼 roll、B8 来源 fold 和 T12 四阶段/冻结战斗边界全部沿用。

本变更属于玩法变化；按 2026-10-14 用户后续拆分决定，T13-A 独立先行，EQUIPMENT_RULES_VERSION 升为 m8-b5-instances-v4 ，CONTENT_DIGEST 为 fnv1a32-utf16:96c9126d（原 44fe9c0e）；LOOT_REPLAY_DIGEST 保持 7b14bfba。R3/R4 后续另用新身份发布。A 保持 schema6/save2/replay2，不读取 T12 旧 digest，不迁移、不补账。T1 相同冻结 BattleInput 的战斗事件/RNG应保持；包含新增自动合成命令的运营轨迹会改变物品 ID、装备及后续战斗，不得仅归一化 digest 声称无行为差异。既有四条不触发新分支的路线另与 297143e 做完整状态/事件/命令轨迹比对，证据见 T13_A_RELEASE.md。

## 18. T13 R3+R4 掉落系统正式合同（D1–D8：A）

本节按用户签署的 D1–D8 推荐 A 实施，基线为 origin/multiplayer@297143e（T12 已合入）。规则数值以 [M8B_LOOT §11](M8B_LOOT.md) 为准，均为项目限定包及项目掉率，不声称复刻完整历史掉率。本节覆盖旧 §12/§14/§15 中与新宝珠、工具、初始化和放弃项展示冲突的约定。合同签署不等于联合发布通过；运行证据与尚待 Claude 接线见 [T13_RELEASE](T13_RELEASE.md)。

### 18.1 公共命令签名

以下类型及函数从 simulation 对应模块与 src/server-entry/index.ts 导出；参数只接受服务器可信权威状态，禁止把 PrivateSeatView 传入命令。签名中的 MatchCommandResult/SharedPoolResult 沿用既有成功/失败形状，仅扩展状态、事件和失败联合。

~~~ts
type ConsumableDefinitionId =
  | 'magnetic-remover' | 'component-reforger' | 'completed-reforger';
type ConsumableTarget =
  | { readonly kind:'item'; readonly itemId:string }
  | { readonly kind:'unit'; readonly unitId:string };

function useConsumable(state: MatchState, consumableId: string,
  target: ConsumableTarget): MatchCommandResult;

type ConsumablePreview =
  | { readonly ok:true; readonly effect:'remove-all'|'reforge-component'|'reforge-completed';
      readonly affectedItemIds:readonly string[];
      readonly destination:'inventory'; readonly affectsCurrentBattle:false }
  | { readonly ok:false; readonly reason:ConsumableFailure };
function previewUseConsumable(state: Readonly<MatchState>, consumableId:string,
  target:ConsumableTarget): ConsumablePreview;

// 扩展 §12.4 / §15.3，不新增另一套共享池提交函数。
type SharedMatchCommand = /* 原有所有分支保留 */
  | { readonly type:'useConsumable'; readonly consumableId:string;
      readonly target:ConsumableTarget };
function runSharedMatchCommand(pool: SharedPoolState, state: MatchState,
  command: SharedMatchCommand): SharedPoolResult;
~~~

输入 consumableId 是实例 ID，不是 definitionId 或数量；客户端不能提供重铸结果、seed、候选池或输出 ID。成功重铸给新永久物品 ID，产物进库存；拆卸保留原物品 ID。preview 与执行共用合法性校验，但不抽结果、不扣资源、不分配 ID；不得从预览泄漏下一次重铸结果。客户端只据服务器回执确认成功，不能在残缺私有投影上运行这个权威预览。

成功事件新增 consumableUsed（consumableId/definitionId/target/effect/affectedItemIds/outputItemId|null）、itemReforged（旧新物品 ID/定义、消耗工具 ID）、itemsRemoved（unitId、原 itemIds）。沿现有 Match 事件序号记录；失败无事件。消费来源与 RNG 前后值只入私有 provenance，不进入显示事件。装备移除/重铸之后的完整结果必须一次提交；事件不构成第二个发奖入口。

既有 equipItem(state,itemId,unitId,slot)、combineItems(state,a,b) 和 wire equip/combine 不在 R4 改名：T12 负责身上合成及四阶段权限。R4 复用其 latest live seat、窃贼 roll 和冻结前缀合同。startMatchCombat/stepMatch/claimOrDiscardLoot 及共享 startCombat/step/claimLoot 负责自动按 entry 发奖，签名不因“开珠”增加客户端领取入口；.4 choose/timeoutChoice 保留。

### 18.2 同局模板的权威入口与初始化

初始化使用以下模式。服务器必须在构造每席时选 shared-deferred，禁止先构造 solo 再覆盖颜色：

~~~ts
type LootInitialization =
  | { readonly mode:'solo' }
  | { readonly mode:'shared-deferred' };
function createMatch(seed?:number, loot?:LootInitialization):MatchState;

interface OrbRoundLayout {
  readonly roundId:string;
  readonly encounterId:string;
  readonly orbs:readonly {
    readonly sourceUnitId:string; readonly slotOrdinal:number;
    readonly tier:'gray'|'blue'|'gold'|'prismatic'; readonly templateId:string;
  }[];
}
interface OrbLayoutLedger {
    readonly version:'s13-orb-layout-v2';
  readonly seed:number;
  readonly throughRoundOrdinal:number;
  readonly rng:{readonly state:number;readonly draws:number};
  readonly rounds:readonly OrbRoundLayout[];
}
type OrbLayoutResult =
  | {readonly ok:true;readonly layout:OrbLayoutLedger}
  | {readonly ok:false;readonly layout:OrbLayoutLedger;readonly reason:OrbLayoutFailure};
function createOrbLayout(roomSeed:number):OrbLayoutLedger;
function freezeOrbLayoutThroughRound(layout:OrbLayoutLedger,
  throughRoundOrdinal:number):OrbLayoutResult;

// 现行函数增加明确 layout 输入；只读、确定性重建本席内容，不修改 layout。
function freezeLootThroughRound(seed:number, throughRoundOrdinal:number,
  layout?:OrbLayoutLedger):FrozenLootLedger;

// 签名沿用，内部按以下规则绑定/推进 pool.orbLayout。
function createSharedPool(poolId:string, seed:number,
  options?:{seatCount?:number;capacities?:Readonly<Record<string,number>>}):SharedPoolState;
function initializeSharedSeat(pool:SharedPoolState, state:MatchState,
  seatId:string, seatIndex:number):SharedPoolResult;
function nextSharedRound(pool:SharedPoolState, states:readonly MatchState[],
  expectedRound:number):SharedPoolBatchResult;
~~~

poolId 保留既有对局池 ID 语义，options 沿 §12.2，仅夹具可覆盖容量，不引入房间产品。solo 默认保持旧调用形式，在创建/换轮事务内冻结自己的 layout，layout seed 等于 match seed；shared-deferred 只供共享初始化，暂不冻结首轮 loot、不消费 loot/layout RNG，未绑定状态不得 start/step/serialize 为可玩存档。initializeSharedSeat 仅接受该原始未绑定模式，沿既有原始开场校验；拒绝把已有 solo 掉落或进行中的局改绑。

SharedPoolState 新增私有 orbLayout，createSharedPool 只建其初态，首次 initializeSharedSeat 进入当前 PvE 时冻结首轮模板，后续席复用。绑定保存 poolId/layout 版本及当前模板身份；每席只冻结内容，保留自己的 loot RNG。solo 席在私有状态保留自身 layout；多人以 pool.orbLayout 为唯一模板权威，不保存可各自推进的副本。

nextSharedRound 在原未发布批事务中推进 layout 到目标轮、给所有未释放席冻结该轮内容，再执行既有轮次/商店流程；若中间涉及无战斗供给轮，遵循实际进入的 catalog 边界，不跳到未来 PvE。任一席失败连同 layout、pool 和 states 全部回滚。初始化及跨轮成功的 revision 仍按 §12.1，每笔事务只增加一次【L1/P】，不因增加模板再额外加一次。

freezeOrbLayoutThroughRound 只接收合法目录 ordinal 和可信 ledger；同边界重试返回原 layout，不补抽；较早边界拒绝 stale-orb-layout，超过目录/非法 ordinal 拒绝 invalid-orb-round，版本/RNG/已有模板身份非法拒绝 invalid-orb-layout。PvP/supply 只推进边界、不新增珠或 draws；加时不调用目录外冻结、不额外生成奖励。createOrbLayout 对非法 uint32 seed 抛 RangeError（同既有 seed 构造校验）；freezeLootThroughRound 在恢复验证路径遇到缺失/错位模板抛验证错误，绝不静默按席 seed 补抽颜色。重建函数的局部 draws 用于验证，不提交第二份 RNG 消耗。

freezeLootThroughRound 的 layout 省略形式仅用于独立单人重建；共享路径必须显式传 pool.orbLayout。服务器只通过 initializeSharedSeat / nextSharedRound 绑定和推进，不能自行调用每席 nextRound 来代替批事务。上述变更是规则职责；Claude 只传可信状态并保存原子返回值，不在 room.ts 计算颜色或奖品。

### 18.3 ClientCommand 与阶段接线

~~~ts
type ClientCommand = /* 原有分支保留 */
  | { readonly type:'useConsumable'; readonly consumableId:string;
      readonly target:ConsumableTarget };
~~~

沿既有 command 信封：protocolVersion、commandId、roomId、round、seatRevision、command；不增加可由客户端指定的 seatId。wire validator 对联合类型逐层 onlyKeys：item 目标仅 kind/itemId，unit 目标仅 kind/unitId；拒绝额外字段、空 ID 或不合类型值。ID 长度使用现有限制【L1/P】，不另给工具特殊上限。

在 preparation、battle、awaiting-settlement、settlement 及对应 choice 中转发工具命令。领域按 R2 四阶段判断，PvP combatRosterLocked 也允许修改运营装备；frozen/整轮结算提交是不可交错边界，先后由单写队列线性化。边界后仍校验原 round/seatRevision，过期拒绝并刷新，不改参数重放。

重复 commandId+同内容沿既有缓存回执，不调用领域第二次；同 ID 不同内容沿既有冲突规则拒绝。拿新 commandId 再用已消费工具得到 unknown-consumable。成功同时提交 pool+latest seat+事件，不能在 resolver 战前副本上执行或用它覆盖最新席位。客户端显示库存工具和可选目标；本节不规定布局、动画或颜色表现。

### 18.4 revealedLoot 与工具投影

SR-C18-04 已确认：本轮结算期（含重连首次推送）持续保留 revealedLoot，重发回放不清空；按珠顺序及 entryDropIds 分组，不重算聚合状态。来源映射、放弃原因和显示时机详见 §18.8。SR-C18-01 的 consumableTargets 扩展也见 §18.8。

toPrivateSeatView(state):PrivateSeatView、readLootView(state):LootView 签名不变；前者仍逐层白名单构造和递归冻结。下列 v2 投影替换 §14.1 的掉落子结构，需网络版本一起切换；不是旧客户端可无条件忽略的兼容字段：

~~~ts
type OrbTier = 'gray'|'blue'|'gold'|'prismatic';
type LootPayloadView =
  | {readonly kind:'gold';readonly quantity:number}
  | {readonly kind:'unit'|'item';readonly definitionId:string;readonly quantity:number}
  | {readonly kind:'consumable';readonly definitionId:ConsumableDefinitionId;
     readonly quantity:number};
type OrbDropView = {
  readonly orbId:string; readonly entryOrdinal:number;
  readonly dropId:string; readonly encounterId:string;
  readonly sourceUnitId:string; readonly roundId:string;
  readonly payload:LootPayloadView;
  readonly status:'revealed'|'pending-capacity'|'retained-terminal'|'granted'|'forfeited';
  readonly receiptId:string|null; readonly allowedActions:readonly [];
  readonly reason?:'auto-grant-in-domain'|'bench-full'|'terminal-bench-full'
    |'timeout-forfeited'|'eliminated-forfeited';
};
type RevealedOrbView = {
  readonly orbId:string; readonly tier:OrbTier;
  readonly status:'revealed'|'partially-claimed'|'claimed'|'forfeited';
  readonly entryDropIds:readonly string[];
};
// PrivateSeatView 的字段：
revealedLoot?: {
  readonly roundId:string;
  readonly revealedDrops:readonly OrbDropView[];
  readonly revealedOrbs:readonly RevealedOrbView[];
};
consumables:readonly {
  readonly consumableId:string;readonly definitionId:ConsumableDefinitionId;
}[];
~~~

revealedLoot 的出现门槛保持 §14.1：本席当前 PvE、roundId/ordinal/encounterId/计划一致。合法尚未揭示时两个数组均为空；PvP、supply、加时、元数据错位或缺计划时省略整个字段。consumables 为本席当前未消费工具实例（跨轮保留），空库存为空数组；终态只读显示，不代表仍能使用。

revealedDrops 保留旧字段，新增 orbId/entryOrdinal、consumable 载荷和已揭示后的 forfeited 状态。revealedOrbs 只按已揭示 entry 组装，一珠一行；entryDropIds 只引用同珠可见条目，不构成另一份奖励来源。组件/成装均 kind:item，品质来自父珠，不能从装备名称推断。已授予 payload 必须读实际 receipt；共享缺货英雄显示实际金币，不能显示为获得英雄。grant 后 receiptId 非空；其他状态为空。allowedActions 仍固定空数组，没有点击开珠/领取命令。

**D7-A 明确修订旧 forfeited 隐藏政策（项目自定）**：保留“已揭示、后因超时/淘汰放弃”的 entry，并给对应 reason；未击杀/未揭示而作废的珠及 entry 始终省略。这样部分打开后重连可解释剩余英雄去向。单人 retained-terminal 仍显示且不算已领取；这些终局项不会阻塞终局。

珠聚合状态（不保存独立可写 claimed 标记）：全部 entry granted→claimed；全部 entry forfeited→forfeited；存在 granted 且未全 granted→partially-claimed；其余已揭示→revealed。granted+forfeited 组合仍 partially-claimed，但全部已处置，不再 pending；客户端判断等待必须看 entry 状态而非珠名。只展示本轮，旧轮收据不混入。

排序沿源代码点、数值 slot、数值 entry；slotOrdinal 仍不下发。entryOrdinal 仅用于包内稳定展示，不暴露未揭示珠数。consumables 按实例授予序号稳定排序，只复制 ID/定义，不下发来源或 nextSerial。readLootView 与 private revealedLoot 对应数组必须深相等。roomSeed、layout/未来颜色、未揭示内容、RNG/draws、完整 receipt/provenance、共享池精确余量及冻结输入仍私有；已揭示 drop 的 receiptId 延续旧白名单，不等于暴露收据内容。

### 18.5 失败枚举与原子性

~~~ts
type ConsumableFailure =
  | 'wrong-phase' | 'unknown-consumable' | 'temporary-item'
  | 'unknown-item' | 'unknown-unit'
  | 'invalid-consumable-target' | 'no-removable-items';
type OrbLayoutFailure =
  | 'invalid-orb-layout' | 'stale-orb-layout' | 'invalid-orb-round';
~~~

MatchFailure 增加上述尚不存在的消耗品分支；SharedPoolFailure 继承 MatchFailure，另纳入 OrbLayoutFailure。对合法输入不返回表外泛化错误来掩盖业务原因。

| 校验顺序 / reason | 精确定义 |
| --- | --- |
| 共享外层：invalid-pool / invalid-seat-state / stale-seat / seat-eliminated | 先校验池结构、席绑定与持有来源、revision、释放/淘汰；沿 §12.5，返回原 pool/state |
| wrong-phase | 非允许运营阶段、gameOver 或直接 Match 路径淘汰；不以 combat/PvP 锁本身拒绝 |
| unknown-consumable | 本席未持有该实例，含已消费、其他席实例；不泄漏别席持有信息 |
| invalid-consumable-target（结构） | 工具和目标 kind 不匹配；magnetic-remover 只认 unit，两种 reforger 只认 item |
| temporary-item | 目标为窃贼临时子件，包括可由历史 roll 识别的过期临时 ID |
| unknown-item / unknown-unit | 在本席资产和可识别临时记录中找不到目标；跨席 ID 同样不查别席 |
| invalid-consumable-target（类别/所有权） | 找到目标但不是所需永久普通组件/成装，或可见单位是敌人/野怪/镜像/召唤物而非本席持有永久单位 |
| no-removable-items | 合法本人单位身上没有永久装备；不能用临时子件冒充可拆目标 |
| invalid-orb-layout / stale-orb-layout / invalid-orb-round | 模板入口的结构/版本/身份、边界倒退、轮次非法；业务含义见 §18.2 |
| 既有 invalid-loot / invalid-receipt / duplicate-settlement 等 | 授予及唯一结算继续走原入口校验；不是工具命令新增返奖规则 |

网络 invalid-message/unsupported-protocol、信封 stale-round/seat-revision-mismatch、room 的 room-phase/seat-controlled/control-revoked、凭证和 commandId 错误留在原层，不混入 ConsumableFailure；这些沿既有 wire/room 类型，不能新增同义错误。预览采用与直接 Match 相同的顺序；共享外层在执行时另检。

失败没有 events/poolEvents 字段，返回输入原引用，金币/工具/装备/全部 RNG/ID/序号/收据/revision 均不变。事务后段失败也不得保留前段抽样或迁移。没有“失败也消耗工具”路径。工具类别/候选目录损坏应在内容装载校验中阻止启动，不临时删候选或退回原件。

### 18.6 共享池与原子收据

- 英雄池容量、商店占用和来源守恒沿 §12；工具/装备不是卡池份数。useConsumable 共享成功时 available/shops/holdings/pending/rewards、共享商店 RNG 全部不变；poolEvents=[]。因本席资产已变，pool.revision 与本席绑定 revision 沿既有事务各加一次【L1/P】，不可误把“无卡池转移”理解为无并发版本变化。
- 开局英雄按 §24 占池；按用户 2026-10-16 决定维持随机，1-2/1-3 的英雄奖励仍逐 entry 走 UnitLootPolicy。计划冻结/击杀揭示不预留；战后首次授予尝试才预留。有货但满席先预留并 pending；缺货直接按一星购买价补金币，无论是否满席。不按珠整体扣池，不让一个 pending 英雄阻断同珠工具/金币。
- 每个 entry 使用唯一 dropId/receiptId，卡池来源继续以 JSON 元组带 seatId。重试不重复预留/补偿；已预留后来入库转 holdings，不再扣池；超时/淘汰归还一次。未赚到的 entry 不预留、不补偿。断线不释放，淘汰按原整轮排序释放。
- 首次授予可能竞争最后一份英雄；仍按现有全轮稳定席序串接最新 pool，不能按消息到达顺序各自从旧池发奖后合并。颜色数量公平不承诺英雄库存竞争也同结果。
- 一珠部分领取是合法成功，不是半事务提交；本次可授予 entry、预留和 pending 进度一起原子提交。若校验真正失败，整个命令（全轮则整个未发布批次）回滚，包括 layout 与内容流。金币/工具无容量上限【项目自定/P】，不存在因英雄 bench-full 而丢弃同珠金币的路径。
- 工具重铸/拆卸不触发英雄获取、返池、免费升星或旧轮收入。战后升级按 T12 搬迁最新装备，来源账本保留冻结战斗曾引用的旧物品。共享命令入口校验 pool.orbLayout 与每席模板绑定。恢复边界沿 T12 最终 B：单人支持完整 Match 保存/恢复；联机仅冻结 PlayerBattleSnapshot/BattleInput 恢复与不中断 latest-seat 的结算。serializeMatch/restoreMatch 拒绝 multiplayer/shared/shared-deferred，不提供联机完整局存档恢复。

### 18.7 版本与旧格式 2 存档

按用户后续拆分决定，T13-A 以独立 equipment v4 digest 先行发布；本次 R3、R4 统一采用 schema 7、save/replay 3、commandProtocolVersion 3；rulesVersion=s13-rules-gap-v1，contentVersion=s13-14.24b-rules-gap-v1。CONTENT_DIGEST 与 LOOT_REPLAY_DIGEST 都引用 content/rules-manifest.ts；B 与先行 A 的规则身份不同，不得让 A 身份读取 B。RNG 算法和 50ms tick 不变。NET_PROTOCOL_VERSION=2 由 Claude 在服务器与客户端联合接线。

旧格式 2、schema 6、m8-14.24b-v1 只识别为 legacy-preserved：canResume=false、canReplay=false、canExportOriginal=true、reason=new-match-required。没有自动迁移，不重抽、不补工具、不改标签冒充格式 3；直接 restoreMatch 拒绝旧身份。旧 m6/m8 IndexedDB 命名空间仅只读列举/保全导出，新局写 hex-autobattler-s13-rules-gap-v1；物理数据库结构版本不变。未知/未来格式拒绝，不覆盖好档。

Node 入口另外导出 readComponentEquivalent(state:Readonly<MatchState>):number，仅统计历史已授予组件价值（普通组件 1、普通成装 2，加五次供给自选），重铸不重复计入。工具不占装备槽、不计组件价值。


### 18.8 SR-C18-01～04 正式回应（multiplayer@9774682）

**01 采用 A：权威目标投影。** `toPrivateSeatView(state: MatchState): PrivateSeatView` 增加：

```ts
consumableTargets: readonly {
  readonly consumableId: string;
  readonly targets: readonly (
    | { readonly target: ConsumableTarget; readonly allowed: true;
        readonly affectedItemIds: readonly string[] }
    | { readonly target: ConsumableTarget; readonly allowed: false;
        readonly reason: ConsumableFailure }
  )[];
}[];
```

每个未消费工具对应一行；候选依次为本席持有单位（含备战席）、本席永久物品（含已穿/库存），顺序沿相应投影数组。每项直接调用权威 `previewUseConsumable`，允许项的 affectedItemIds 给出本次移除/重铸的原物品，可显示“将拆下 N 件 / 将重铸 X”。不得推测新物品或随机结果。错误目标类型和空身单位会显式返回禁止原因。敌方/野怪、临时子件不属于候选，已消费工具不属于行；客户端对缺行/缺目标一律视为不可用，不在残缺投影上调用权威预览。若旧客户端仍提交，权威入口依 §18.5 返回 invalid-consumable-target / temporary-item / unknown-consumable；不存在的 ID 返回 unknown-unit / unknown-item。四阶段均重新投影；gameOver 的现存候选返回 wrong-phase。

输出逐字段独立复制、递归冻结，无 state 引用，无 RNG/序号/revision/资源变化。目标是否合法最终以执行时最新席位为准；投影不是锁定目标或预留工具。空工具库存对应空数组。不包含来源、候选池或未来 RNG。

**02 内容表已导出。** 从 `src/simulation/content/consumables.ts` 与 `src/server-entry/index.ts` 导出 `CONSUMABLE_DEFINITIONS`；类型为只读 `Record<ConsumableDefinitionId, {id:ConsumableDefinitionId;name:string;description:string;targetKind:'unit'|'item';target:'unit'|'item';effect:ConsumableEffect}>`，各 key 的类型进一步收窄为对应字面量。`target` 是保留的规则字段，与 targetKind 相同。表及其文案均纳入 canonical content/rules manifest 的 digest，深冻结。正式名称为“拆卸器 / 组件重铸器 / 成装重铸器”；界面删占位 CONSUMABLE_TEXT 后读取 name/description/targetKind，不自行维护第二张表。

**03 wire 回执与显示事件。** Claude 网络层须为 useConsumable 成功新增下列 ReceiptResult 分支；领域 `MatchCommandResult` 的 ok/state/events 签名不变：

```ts
{ readonly kind: 'consumable-used'; readonly seatRevision: number;
  readonly roomRevision: number; readonly events: readonly ConsumableDisplayEvent[] }
```

外层仍是 `{type:'receipt',commandId,ok:true,result}`，失败仍为 `{type:'receipt',commandId,ok:false,reason,detail}`；去重沿 §18.3。ConsumableDisplayEvent 是以下三个 Match 事件的逐字段白名单，并保留 `domain:'match'`、原 eventSeq：

| type | 字段 |
| --- | --- |
| itemsRemoved | unitId, itemIds（原永久 ID） |
| itemReforged | itemId, definitionId, outputItemId, outputDefinitionId, consumableId |
| consumableUsed | consumableId, definitionId, target（只 kind 与对应 ID）, effect, affectedItemIds, outputItemId（拆卸为 null） |

顺序沿领域输出：itemsRemoved 或 itemReforged 在前，consumableUsed 在后。**不加入 §14.2 CombatViewEvent 白名单**：它们是席位运营事件，不带 combat tick，不送 toCombatViewEvents/toCombatReplay，也不能覆盖当前战斗图标。Claude 在成功回执的上述白名单复制事件，记录页可将 itemReforged 显示为“重铸：A → B”；不得下发 provenance、rngBefore/rngAfter。无需新领域事件转换函数；网络层仅按白名单复制，无规则计算。

成功后私有投影 consumables 少一件；consumableTargets 同步重算；拆卸使原 items 的 location 回到库存，重铸移除旧 item 并增加新永久 ID 的库存 item；涉及窃贼时 temporaryEquipment 可移除。冻结本场 combat/replay 不变，待下场生效。客户端以新投影为库存真值，不根据事件重复扣除/发放。

ConsumableFailure 完整枚举只有 §18.5 的七项（共享包装另有既有池/席位失败；畸形 wire 结构由网络 invalid-message 拒绝）：

| reason | 建议文案 |
| --- | --- |
| unknown-consumable | 该消耗品已不存在，请重新选择 |
| invalid-consumable-target | 这件消耗品不能用在该目标上 |
| no-removable-items | 该单位身上没有可拆下的装备 |
| temporary-item | 临时装备由本轮自动生成，不能拆卸或重铸 |
| wrong-phase | 当前阶段不能使用消耗品 |
| unknown-unit | 该单位已不存在，请重新选择 |
| unknown-item | 该装备已不存在，请重新选择 |

失败原 state/pool，无事件、资源/RNG/ID/revision 消耗。网络 onlyKeys、ROOM_COMMAND_GATE 四阶段放行以及战中拆卸 e2e 由 Claude 接线验收；本合同不代表服务器已实现。

**04 只确认显示约定。** 按 revealedOrbs 顺序显示宝珠卡，仅取 entryDropIds 引用的可见条目；未引用的可见条目放“其他”。使用服务器聚合 status，不重新计算。forfeited 可划线；timeout-forfeited 表示操作窗口超时放弃，eliminated-forfeited 表示本席淘汰放弃。sourceUnitId → name 沿 readEncounterPreview 的本轮来源映射。

准备与回放播放期间隐藏、回放结束显示由界面决定。权威 revealedLoot 在**整个当前 PvE 结算期**持续下发，重连首次投影也包含相同已揭示内容；重发回放或将显示层 phase 覆盖成 combat 不得清空它。toPrivateSeatView 不按 settlement/combat 展示阶段裁剪此字段；进入新轮后才按 §18.4 的本轮门槛更新/省略。Claude 的重连 e2e 应比较刷新前后回放播完的宝珠内容；不需要新增规则命令。


SR-C18-03 穷举接线补充（multiplayer@8968c8a）：`ClientCommand` 已并入 `useConsumable`，目标类型直接引用 server-entry 导出的 ConsumableTarget。`src/simulation/bot/preflight.ts` 的 legal 暂对该动作恒返回 false，不改变现有机器人策略或消耗随机流；`tests/t7-helpers.ts` 的 execute 调用真实 useConsumable。四阶段用例确认预检无状态变化、执行与领域回执一致。

经用户单行例外授权，当前 `src/server/room/room.ts` 的 applySeatCommand 增加 `case 'useConsumable': return runSharedMatchCommand(pool, state, command)`，只补穷举转发，未修改 gate/网络 onlyKeys/consumables.ts。Claude 的 claude/c18b-loot-ui 已有相应接线，C18-B 合入时由 Claude 用 useSeatConsumable 替换该行，并将其 WireCommand 收敛为 ClientCommand 别名；不保留两次分发或双重消费。

版本、受影响文件、测试与待签清单见 [R3R4_LOOT_DESIGN](R3R4_LOOT_DESIGN.md)。本节无已通过的运行验收；§18.1–18.6 全部是草案，不能按正文中的函数声明直接认为 Node 导出可用。

## 19. SR-B8-02 可恢复战斗与回放任务

从 `src/server-entry` 导出（纯规则，无时钟、调度器或 Match 结算）：

```ts
interface BattleTask { advance(maxTicks: number): BattleResult | null }
startTwoSidedBattle(input: BattleInput): BattleTask
interface CombatReplayTask { advance(maxTicks: number): CombatReplay | null }
startCombatReplay(input: CombatReplayInput): CombatReplayTask
// 原签名保留：
resolveTwoSidedBattle(input: BattleInput, maxSteps: number): BattleResult
toCombatReplay(input: CombatReplayInput): CombatReplay
```

- `startTwoSidedBattle` 校验并重编译输入、建立开战态与开局账本；`startCombatReplay` 复制输入，适用于 PvP 与 PvE 的 `{initial, terminal, events}`。任务不持有调用者可变引用；调用者切片间修改原输入不会改变任务结果。
- 每次 `advance` 至多执行 `maxTicks` 次 `stepCombat`，未结束返回 `null`，可以继续原任务；终局返回深冻结结果，重复有效调用返回同一个结果引用，不重复 step、事件或结算。tick0 已终局时首个有效调用直接返回结果。任务仅为进程内续算，不是可序列化存档；取消时释放任务引用即可。
- `maxTicks` 必须为正安全整数；非法值在推进前抛出 `invalid-budget`（终局后也检查），任务进度不变。无隐藏总步数预算，Combat 自身 tick 上限不变。同步 `resolveTwoSidedBattle` 是一次 `advance(maxSteps)` 的兼容包装，仍把总预算不足转换为 `step-limit-exceeded`；`toCombatReplay` 一次跑完有界回放任务。
- 战斗启动保留 `restoreBattleInput` 的 `BattleValidationError.reason`：`snapshot-version`、`content-digest`、`invalid-snapshot`、`wrong-phase`、`seat-collision`、`round-mismatch`、`round-kind`、`invalid-seed`、`invalid-battle-id`、`invalid-mirror`、`battle-input`；推进的 `invalid-budget`、结果构造的 `invalid-result` 类型同前。回放启动沿用 `RangeError('invalid-replay-input')`，推进沿用 `RangeError('replay-divergence')`，新增 `RangeError('invalid-budget')`。除非法预算可修正后重试外，发生校验错误应丢弃任务，不发布部分结果。
- 回放按 `initial.nextEventSeq` 区分开局与第一次 step 发出的 tick0 事件；单位差分、20 tick 关键帧、最后状态和动画事件序列校验沿 §14.2。分片不截断完整领域账本、不更改事件顺序，结果 `JSON.stringify` 与改动前同步入口逐字节一致。输入仍是可信规则结果，校验边界未扩展成任意存档恢复。
- tick 预算不是毫秒预算：启动的校验/复制、单 tick、完成时的校验/冻结以及 GC 仍不可中断。50 ms 在目标机与约定阵容实测；本接口不承诺任意硬件/100 tick 分片都小于 50 ms。调度层可减小预算并在两次调用间让出事件循环，规则层不读取真实时钟。
- 本节只增加续算入口；不改变玩法、digest、BattleResult/CombatReplay wire 形状或镜像语义。本次没有把回放嵌入权威执行，仍需一次可切片的回放重执行；同步调用旧 API 的服务器行为不会自动提速。

## P3/P4/P5 一次发布（2026-10-14）

`rulesVersion=s13-rules-gap-v2`、`contentVersion=s13-14.24b-rules-gap-v2`。共享 manifest 同批含扣血、经验政策、宝珠权重执行政策；最终摘要由 canonical 生成，见 `tests/p3p4p5-content-baseline.json`。schema7/save3/replay3/command3 与 NET_PROTOCOL 2 保持，未增加序列化或网络字段。

P4-A：现表符合 14.24b，68 为 16.1 值，不开 10 级；阈值 2/2/6/10/20/36/48/76，最高 9 级。P5-A：球数与品质表保持项目批准值，`s13-orbs-project-v2` / `frozen-cumulative-weights-v1` 从 ORB_RULES 的 openingWeights=[50,50]、equipmentWeights=[90,9,1] 按顺序累计选取，drawIndex 以权重总和无偏拒绝采样；不宣称完整历史掉落表还原。载体顺序、载荷、RNG 流与结构不变。旧 digest 只读保全/导出，拒绝续玩、不迁移重抽。联机完整 Match 仍拒绝 restore，沿既有冻结 BattleInput 恢复重演与服务器账本提交，不承诺新增恢复入口。


## 20. P6 配对候选交接合同（2026-10-15；服务器实现由 G1 交付）

来源、历史 U 与项目 P 的区分及向量见 [S13_RULES_GAP §10](S13_RULES_GAP.md#10-p6准备期可能的对手与开战配对2026-10-15)。本节定义新增投影契约；没有在本文 PR 中实现或改变网络版本。G1 按协议现有兼容规则决定 NET_PROTOCOL_VERSION 并记录依据。

- `opponentCandidates: string[]`：每次投影独立复制；稳定代码点升序、去重，仅存活席位、不含自己。PvP 准备期为 §10 的全局可行级别下本席候选保守集合；PvE/淘汰/终局为 `[]`。准备期 `opponentSeatId: null`，不得泄漏预抽的唯一对手。
- 推荐项目 policy 为 `{ avoidRecentRounds: 2, fallbackOrder: [2, 1, 0] }`。按最近 PvP 历史过滤；非空但全房无法配对时也必须全局放宽，普通配对双向受约束，奇数镜像只检查接收方候选。冻结前先公布任何放宽结果，保证开战的 opponentSeatId 属于最后公布候选。候选不是概率表，也不承诺候选中的每条边均可独立选取。
- 开战后 `opponentSeatId` 为真实对手或镜像 sourceSeatId，`opponentCandidates=[]`，镜像沿既有标记区分。每轮配对和 battleSeeds 只在准备截止后的冻结边界抽取一次；恢复复用冻结值。历史在全轮唯一提交后各席追加一次；镜像仅给接收方记源，源方不因借镜像多记一轮。PvE 不记，跨 stage 保留，淘汰不重置。
- 重连准备期按同份 alive/history/policy 重建相同候选，读取投影不推进 RNG。仅向客户端公开候选与已冻结的对手，不发送其他席的私有历史或随机状态。

配对规则实现属于服务器 G1；此设计 PR 不触及 simulation、不更新 CONTENT/LOOT_REPLAY digest。G1 对房间 RNG 时序变化须按原脚本重录受影响夹具，不能把文档向量当历史 14.24b 精确还原证据。


## 21. P7 共享选秀接线（2026-10-15）

数值及来源等级见 [S13_RULES_GAP §11](S13_RULES_GAP.md#11-p7共享选秀规则2026-10-15)，完整导出签名、状态和失败枚举见 [MATCH_CONTRACT P7](MATCH_CONTRACT.md#p7-共享选秀规则-api2026-10-15)。后者是规则唯一权威，服务器不自算费用、装备、选取或共享池扣减；以下规则接口已实现并导出，房间/网络接线由 G1 完成。

### 21.1 阶段、公开投影与命令

新增 room phase `carousel`：P7-1 撤销 1-1 前奏，仅五次 x-4 替换旧 supply；`roundId` 不重新编号。单次选秀一个权威 CarouselState，使用服务器冻结存活 Match 集合调用 `prepareCarouselParticipants`，再 `createCarousel(pool,roundId,rng)`；共享池和创建收据必须一次发布。在 carousel 期间冻结其他共享池及本席资产写命令，准备/战斗命令返回现有 `wrong-phase`，不另开第二套供给领取路径。

新增 `ClientCommand {type:'carousel-pick'; carouselId:string; revision:number; slot:number}`。seatId 取连接凭证，不能取客户端字段。服务器校验 carouselId/revision（不一致 `stale-carousel`）、整数 slot，推进已到期逻辑时间/自动选取，再调用 `pickFromCarousel` 和 `grantCarouselPick` 原子发布；若 grant 失败，**整个 pick 事务回滚**，不留下已占槽但未发布的网络半事务。机器人与离线玩家调用 `autoPickFromCarousel`，不在 server 重写评分算法。失败沿现行 command-result 带规则 reason；身份/协议失败沿现行边界，领域枚举完整转发，不改成泛化 success。

公共 `carousel` 投影为 null 或 `{id,roundId,revision,status,slots:[{slot,definitionId,itemId,pickedBy}],releaseOrder,releaseAtMs,elapsedMs,deadlineMs}`；所有席看到同一槽与放行计划，本席额外 `{eligible,pickedSlot,receiptId,heldCarouselUnits}`。不发送 pool.available、其他席私有资产、RNG、完整收据或种子。公开 HP 本已公开，不能用 carousel 投影扩大私有权限。字段由规则状态派生，每次投影独立复制，不能因 UI 拉取而消耗 RNG 或触发自动选取。

### 21.2 权威时钟、同时动作与恢复

服务器只将 clock 经过值作为 `advanceCarousel(state,elapsedMs)` 的整数单调输入；规则不读取 Date.now。放行计划在创建时冻结，后续不随 HP/重连排序。每个时刻先处理到期放行；deadline 先按冻结 releaseOrder 对所有未选存活席调用自动函数并 grant，再拒绝同刻/迟到人工请求 `carousel-closed`。deadline 前同槽竞争按服务器命令序号先到先得，不使用客户端时间戳；锁席不能提前缓存点击待放行执行。早已放行的未选席继续可选，不被后组挤出。机器人在放行即自动；离线真人在截止兜底；重连仍用原状态和截止时间。

到达固定 deadline 且全部选完后规则关闭并返还未选槽，服务器等待 2000ms 离场后进入下一准备期；一次性推进收据防止双刷新/双收入。开局直接按免费艾瑞莉娅进入既有 1-2；x-4 原本自然轮经济/刷新恰一次，旧 supply 不再发。规则逻辑状态与池、所有席 Match、receipt、elapsedMs、deadline 和阶段推进收据一起持久化；恢复安装剩余计时器，不重新 create、pick 或 grant，已过截止则按相同冻结顺序补执行尚未提交者。保存中存在内部 reserved 收据时按同一原子 grant 事务完成，严禁发过的 granted 再发；损坏恢复拒绝，不靠重新随机修补。

### 21.3 验收和交付边界

规则实现由 Codex 在合同合入后交付；房间与网络接线由窗口 2 在 src/server 完成。客户端只显示公开槽、锁定/放行、倒计时与本人结果，不自己随机或结算。heldCarouselUnits 应明确投影给本席，满备战席不能使全房卡住。

必测：同 seed/pool/round 完全相同；9 槽创建、每次 pick/grant/close/淘汰/卖出守恒；同席重选/抢同槽拒绝且无消费；五次 x-4 的 HP 两席分组、奇数席、平血；每个时间边界及同刻截止；机器人/断线兜底确定性；备战席/场上/临时位三路落点；断线/恢复与阶段重试不重发；旧 supply 与开局 Irelia 不双发。作者跑全套清零贴通过数、typecheck、test:server-entry。规则/content digest 仅实现发布时更新一次；网络版本由接线方依实际字段变更更新，不能用合同文档修改冒充运行时兼容。此合同 PR 不改任何 golden。

### 21.4 SR-G1-02 逐项答复（方案 B，2026-10-15）

用户明确选择方案 B：**P7-1 后仅五次 x-4 每批 2 人，按 HP 升序、平血 seatIndex 升序；不得提前关闭，截止才自动补选并关闭。** `schedule(roundId)` 对五个合法 ID 均返回 `{firstBatchMs:6000,batchIntervalMs:6000,tailMs:6000}`；首批 t=6000，八席后续 t=12000/18000/24000，deadline=30000；奇数最后一批仅一席，deadline=firstBatchMs+(ceil(alive/2)-1)*batchIntervalMs+tailMs。离场仍 2000ms。此处时序已同步至 §11 正文。

| SR-G1-02 项 | 权威答复/端口 |
| --- | --- |
| 1-1 回合行 | **撤销前奏，不加 catalog 行**。createCarouselMatch 恢复免费艾瑞莉娅与既有经济；openingPending 不再输出，opensCarousel 开局 false。删服务器 1-1 专用分支。 |
| x-4 补给 | **不保留旧 supply 的组件选择/领取**。共享选秀替换该轮组件，经济和免费商店刷新仍恰一次。规则接入将屏蔽该轮 component schedule choice；服务器不得在选秀之后再走旧补给领取。 |
| 满备战席 | 先看场上人口，未满直接上场；两处满才进 heldCarouselUnits，不参战可出售。下一准备期才合星。pendingUnits 为废弃存储别名，pendingCarouselUnits 投影已删除，详见 §21.6。 |
| 池守恒 | `assertSharedPoolConservation(pool, states?)` **无需另传盘面**，pool v3 自带 carouselReservations/Receipts/Rounds；可传 Match 状态额外核对持有与排队单位。create 时扣 available→预留，pick 不二次扣减，grant 转 holdings，关闭只归还剩余未选槽。 |
| 创建 | `prepareCarouselParticipants(pool, [{seatId,state}])` → pool；再 `createCarousel(pool,roundId,{algorithm:'lcg32-v1',state:rngState})` → `{ok:true,state:CarouselState,events}`。新池=`state.pool`，新房间随机状态=`state.rngAfter.state`；不得额外抽随机数。 |
| 玩家原子选取 | 核心 `pickFromCarousel(carousel,seatId,slot)` 绑定槽；`grantCarouselPick(carousel,match,seatId)` 发资产。服务器推荐直接 `pickCarouselForSeat(pool,carousel,match,seatId,slot)`，返回 `{ok:true,pool,carousel,state:MatchState,events}`；任一失败整笔原对象返回。 |
| 自动选取 | 核心 `autoPickFromCarousel(carousel,seatId,match)`；推荐原子 `autoPickCarouselForSeat(pool,carousel,match,seatId,reason)`，reason=`bot/disconnected/timeout`，输出同上，全部调用同一纯评分。 |
| 公共槽列表 | `listCarouselSlots(carousel)` → `[{slot,definitionId,starLevel:1,items:[itemId],pickedBy}]`，返回独立容器。 |
| 逻辑时间/关闭 | `advanceCarousel(carousel,elapsedMs)`；全选也保持 open 到 deadline。截止先 advance，再依 releaseOrder 为尚未选席 autoPick+grant；最后一笔补选使盘关闭。全已选时 advance 到 deadline 关闭。人工在截止后由房间拒绝。 |
| 失败占位替换 | `carousel-slot-taken→slot-taken`，`carousel-already-picked→already-picked`，`carousel-unknown-slot→invalid-slot`，`carousel-not-participant→unknown-seat`，`carousel-closed→carousel-closed`；尚未放行为 `seat-locked`。其余完整枚举见 MATCH P7；不得把领域失败变 success。 |

以上端口在规则实现完成时统一加入 server-entry 白名单；服务端只编排，不在绑定层算费用、选择、概率或池守恒。`restoreCarousel(serialized)` 校验盘/池/收据后返回独立状态，不发奖励、不消费 RNG；Match 资产与它一起恢复，已 granted 的 grant 重试为成功无事件。


### 21.5 P7 规则实现补充端口

`CarouselState.initialAvailable` 固定记录创建前的可用数量，恢复据此逐槽重算 27 词的费用/单位/装备；后续淘汰归还不会改变建盘依据。它与当前 pool 一起保存，不能只恢复显示槽。

- `completeCarouselForSeat(carousel,match,seatId)` → `{ok:true,state:CarouselState,match,events}`，或 `{ok:false,state,match,reason,events:[]}`。仅 fixed deadline 关闭后接受；五次 x-4 执行既有 supply 的自然经济结算一次并进入 settlement。下一轮使用原 nextSharedRound；服务器不得自己发收入。状态改变同步更新 pool/seat revision，必须发布返回的盘和 Match。
- `resolvePendingCarouselUnits(pool,match)` → SharedPoolResult：准备期依 receiptId 将临时位单位优先搬入备战席、否则未满人口的场上；只在原选秀的下一准备期或之后合星；已拥有单位不另记出生、不推进单位序列。返回 pool/state/events 必须同事务发布。服务器在进入 preparation 及腾出空位后调用；其他阶段不自动清空队列。
- `sellPendingCarouselUnit(pool,match,unitId)` → SharedPoolResult：准备期显式出售队列单位，按现有 1 星售价发金、池归还一次，组件/成装已在物品栏，保留。普通阵容单位仍走 sellSharedUnit。
- `releaseCarouselSeat(carousel,seatId)` → CarouselResult：只释放当前盘未授予的预留，不用于已经发到 Match 的资产。淘汰使用原子 `releaseCarouselParticipant(carousel,match,seatId)` → `{ok:true,state:CarouselState,match,events}` 或同原输入失败；要求权威 Match 已标 eliminated/HP=0，组合池淘汰释放和盘收据，重复为成功零事件。存在活动盘时，不得绕过它直接释放该参与席。
  - **盘关闭后的淘汰（2026-10-16 澄清）**：盘按 deadline 关闭且该席收据为 granted 后，选秀单位已是普通 `holdings`（来源为收据 id），装备已在物品栏；之后的淘汰**只调用** `releaseSeatOnElimination(pool,match)`，无需也不应再调用 `releaseCarouselParticipant`。前者已归还该席全部 holdings（含选秀单位）、店格和待领预留，`assertSharedPoolConservation` 成立。池账本中该收据保持 `granted`（含原 unitId/itemInstanceId），表示已发生的出生记录，不表示当前所有权；所有权以 holdings 与 `seat.released` 为准，`restoreCarouselSeat` 对已释放席同时接受 granted 与 released 两种形态。关闭后的 CarouselState 冻结的是关闭时的池，此后以它调用 `releaseCarouselParticipant` 会因旧池与当前席状态不一致，以 `invalid-match` 原样拒绝。`releaseCarouselParticipant` 只用于盘 `open` 期间的参与席；盘关闭后一律只走 `releaseSeatOnElimination`。反过来，池里仍有任何选秀预留（即当前盘尚未关闭）、该席为参与席且其最近一盘收据未标 released 时，`releaseSeatOnElimination` 以 `wrong-phase` 拒绝，即使该席收据已是 granted 也一样，二者不会重复释放。
- `listCarouselSlots` 各项和 `toPrivateSeatView.heldCarouselUnits` 均为新容器；公开槽不带池、随机流或其他席备战席。后者仅在已启用 P7 的本席视图出现。

新联机初始化顺序（P7-1）：八席 createCarouselMatch（免费艾瑞莉娅）→ initializeSharedSeat（每席扣真实一份 Irelia 并记 opening holdings）→ refreshSharedShops → 1-2 准备；不调用 createCarousel(1-1)，不消费开局 carousel RNG。之后五次 x-4 才 prepareCarouselParticipants/createCarousel。

恢复调用：先 `restoreCarousel(serializedCarousel)`，再逐席 `restoreCarouselSeat(carousel,serializedMatch)`，全部成功后原子安装；不在恢复路径发奖。该席位端口是可信服务器持久化的 P7 资产一致性检查，其他房间/经济/战斗恢复边界沿原有实现；不接收客户端上传 Match。

网络命令允许 G1 按 SR-G1-02 使用 `{type:'carouselPick',slot}`，carouselId/revision 由既有服务器命令信封校验；不要求将此服务器编排命令加进普通 `ClientCommand`。§21.1 的 `carousel-pick` 为旧提案命名，以本行和 G1 实际协议为准。公开槽投影使用 `listCarouselSlots` 的 starLevel/items，不能发送原始 CarouselState。

### 21.6 P7-1 字段迁移与准备期唯一结算（2026-10-15）

本节覆盖 §21 旧的 1-1/队列/即时合星文字，完整类型、导出和失败枚举见 MATCH_CONTRACT「P7-1 正式修订」。依据 DISPATCH「真机反馈 P7-1」1–3 与 S13_RULES_GAP §11.4。

- 删除运行时 `carousel.openingPending`；可选 TS 成员仅保留给旧服务器编译。服务器删 room.ts 的 1-1 启动与 carousel.ts 的 openingPending 分支，统一调用 opensCarousel；不自行补单位/金币/商店。
- 本席投影 `pendingCarouselUnits` **删除/改名**为 `heldCarouselUnits`，规范 Match 状态是 `carousel.heldCarouselUnits`，每项 `{receiptId,unitId,definitionId}`。只有备战席与场上人口同时满才保管；不参战、不可部署/装备、可在准备期明确出售；组件/成装已经在物品栏。备战席满但场上未满的卡直接在合法格参战。
- `carousel.pendingUnits` 与类型 PendingCarouselUnit 暂作废弃兼容别名，严格镜像规范临时位字段，不能独立写；旧公共导出 resolvePendingCarouselUnits/sellPendingCarouselUnit 保留。接线应改读规范字段及新投影。createCarouselMatch 同签名、改为免费艾瑞莉娅的 shared-deferred 开局。
- 新 `carousel.preparationReceipts:string[]` 与 provenance 的 carousel-preparation-settled 收据仅在选秀之后的准备期追加一次。nextSharedRound 自动迁入/合星，含空位检查、合星后装备/异常/成长转移、池 holding 来源合并；服务器不再自行推断有三张就合。准备期出现备战席空格/场上人口空缺（含 buyXp 升级）后调用 resolvePendingCarouselUnits 并原子发布结果；无位置则保持临时位。
- 迁入事件沿兼容名 carouselPendingClaimed；新增 carouselPreparationSettled（receiptIds、claimedUnitIds）和既有升级事件，都由规则分配 eventSeq。重复 resolve/step/恢复无重发，晚迁入不重复发该次选秀收据。
- resolve 失败枚举 invalid-seat-state；sell 为 unknown-unit（含非准备期/锁定/已售）或 invalid-seat-state（池/席位损坏）；create/pick/grant 等 CarouselFailure 枚举不变，1-1 为 invalid-round。失败原对象无资源/RNG 消费。

服务器与界面配套接线需随本规则 PR 叠加验收，单独不发布。需更新 tests/server/carousel-room 的开局/时序用例和 e2e/p7-carousel 的 1-1 段；规则 PR 不修改这些目录。CONTENT bb66f4f8，LOOT_REPLAY 028e5593；旧快照不静默迁移。


## 24. 随机一费起手（2026-10-16 用户决定，覆盖旧固定 Irelia 条款）

公共导出签名保持兼容：

```ts
createMatch(seed?: number, loot?: LootInitialization): MatchState
createCarouselMatch(seed?: number): MatchState
initializeSharedSeat(pool: SharedPoolState, state: MatchState, seatId: string, seatIndex: number): SharedPoolResult
```

服务器继续只调用公共导出。先 `createMatch(seatSeed,{mode:'shared-deferred'})`（或选秀模式的 `createCarouselMatch(seatSeed)`），再 `initializeSharedSeat(pool,state,seatId,index)`，八席导入完成后才刷新共享商店。签名无变更，Claude 无需自行抽样或改调用参数。`initializeSharedSeat` 校验未操作初始状态后，以 **pool.seed + seatId** 生成最终起手，原子替换 unit-1 与 opening 来源事实，并扣池一张；失败保持原 pool/state，无 RNG 或资源消费。既有失败枚举不变，包括 `invalid-seat`、`invalid-seat-state`、`pool-empty`、`already-generated`。不得因小型自定义卡池缺卡而改抽其他英雄。

规则选择器 `src/simulation/opening-unit.ts` 导出 `selectOpeningUnit(seed: number, seatId?: string): string`（seatId 默认 `solo`），非法 uint32 seed 或空席位抛 RangeError。服务器不需要直接调用该选择器。单人 `createMatch(seed)` 与同 seed、seatId=`solo` 的共享席位选择一致。

- 候选为按目录顺序的 `SHOP_CATALOG_BY_COST[1]`，14 个英雄等权；独立抽取，允许同英雄，扣一基础副本。总共扣八张，不能写死 Irelia 可用 22。
- 流命名：`opening-unit-v1/<seatId>`，按 JS UTF-16 code unit 顺序 FNV-1a32（初值 0x811c9dc5，乘数 0x01000193，逐步 uint32 截断）。初态 `(gameSeed ^ namespaceHash ^ 0x6f706844) >>> 0`；执行一次 lcg32-v1，`floor(word * catalog.length / 4294967296)` 取下标。不是共享商店 RNG 的一部分，也不消费选秀、掉落、装备、选择或 battle-seed 流。
- `OPENING_INITIAL_STATE.unit.definitionId` 现在是冻结的生成规则描述，不再是某英雄 ID。实际 ID 只从已创建 state 的单位读取。opening 来源事实变为 `{kind:'opening',seed:gameSeed,seatId}`，恢复由该规则重算；共享守恒校验核对 pool.seed 和席位身份。不得把新来源格式补写到旧存档上。
- 其余初始化仍为 0G/等级1/0XP/100HP，unit-1/一星/(1,4)/nextUnitSerial=2。按用户 2026-10-16 决定维持随机：1-2/1-3 各从原五个老一费 `darius/irelia/lux/maddie/zyra` 等权抽取，随机流、候选顺序、拒绝采样及消耗次数与 multiplayer 基线完全一致；重复英雄按原合星规则处理，起手专用流绝不借用掉落流。
- rules=`s13-opening-random-1cost-v1`，content=`s13-14.24b-opening-random-1cost-v1`；CONTENT_DIGEST=`fnv1a32-utf16:299ec0d0`，LOOT_REPLAY_DIGEST=`fnv1a32-utf16:b9250813`。schema7/save3/replay3/commandProtocol3/50ms/lcg32-v1 保持。旧存档、对局快照和旧回放身份作废，严格拒绝，不迁移；活动局结束后切换。

执行者测试与迁移字节证据见 [随机起手交付](OPENING_RANDOM_1COST_RELEASE.md)。

## 25. G2-3 联机通用接口（2026-10-16）

规则侧接口见 MATCH_CONTRACT「G2-3 机制通用接口」。本节写联机视图、指令和回放线格式。NET_PROTOCOL、schema、save、replay、commandProtocol 版本号都不变；G2-3 当前对局会初始化机制容器，并可能增加形态、选择、单位及事件字段；线数据已变化，不承诺与 G2-3 前逐字节相同。兼容性由当前 rules/content/digest 身份及合同字段约束。具体说：`createMatch` 对每局（单人和联机）开局即写入 `seatMechanics`（G2-3 进度的六个 seat 键和 `hidden.progress`），所以新对局的私有视图、存档和回放都带这个容器；G2-3 之前的数据一律拒绝，不做迁移，也不会出现"没有容器的当前版本对局"：存档（`restoreMatch`）先比 rules/content 版本，按 `unsupported-version` 拒绝；双边快照（`restorePlayerBattleSnapshot`）和由它们重新编译的回放/战斗输入（`restoreBattleInput`）只带快照/战斗格式版本，这两个版本号没变，因此按内容摘要不符以 `BattleValidationError('content-digest')` 拒绝。

**私有视图（toPrivateSeatView）**
- `seatMechanics?: {version, seat, hidden:{}, receipts}`：`seat` 是显式本席公开 JSON，按约定复制；`hidden` 永远发空对象。`receipts` 按 MechanicReceipt 的 kind 逐字段白名单投影，包含 PvE 固定拆卸器收据；不透传额外字段（如 futurePlan、rngState）。键名与 MatchState 相同，`toDisplayMatch` 直接透传，客户端选择器用 `readSeatMechanic(display, key)` 读。
- `pendingChoice.payload?`：锻造器、黑市、军械库三种选择的载荷原样发送（候选、价格、可否跳过、跳过收益、超时选项）。
- `preparation.units[].form?`：形态英雄在棋盘上时给出当前站位对应的形态；备战席和普通英雄没有这个字段。

**指令**：不新增 ClientCommand。三种新选择都用现有 `choose`，黑市跳过是 `definitionId:'@skip'`。房间阶段门、超时（`timeoutChoice` → `forfeitPendingChoice`）、机器人（`decideBotAction`）都已覆盖新 kind，服务器不用改分派。新的失败原因（`unit-not-sellable`、`item-restricted`、`choice-not-skippable` 等）走现有失败回执。

**推送事件**：`PUSHED_EVENT_TYPES` 加入 `mechanicGranted`（带收据，用于开箱结果、金币来源、军械库购买提示）和 `seatMechanicChanged`（带 key）。只推给本席。之后又加入 `mechanicFailed`（见本节末段）。

**战斗回放线格式**（`CombatViewEvent` 新增）
- 动画事件：`unitSpawned{unitId, definitionId, team, cell, sourceId}`、`unitRemoved{unitId, reason}`、`unitRevived{unitId, hp, sourceId}`、`castOutcome{unitId, abilityKey, outcome, subOutcomes}`、`bindingChanged{unitId, bound, reason}`。
- 状态事件：`unitEntered{unit}`（完整单位视图）、`unitLeft{unitId}`，由回放按 tick 比对单位名单自动生成，排在该 tick 的 `unitUpdated` 之前。
- 单位视图新增可选字段 `form`。
- 敌方视角镜像：`mirrorCombatReplay` 翻转 `unitEntered.unit` 的格子和阵营，以及 `unitSpawned` 的 `cell` 和 `team`。

**共享卡池**：机制发英雄（征服者宝箱等）借用 PvE 掉落的预留路径，伪掉落 id 为 `["mechanic",receiptId]`；`reconcileHoldings` 认来源 `mechanic` 的出生事实。池空时按英雄费用折成金币。召唤物（`UnitDefinition.summon`）不进卡池，守恒校验的棋盘名单跳过它们。

**本次服务器目录改动**：`src/server/room/projection.ts` 的镜像分支和推送白名单，此外不变。界面仍需按 g2-3-ui-server-needs 盘点逐项接显示；PR #132 的选择弹窗兜底可以用 `payload.skippable` 打开"跳过"按钮。

`CombatInputBasis.inputs.g23`（领域 DTO，亦称 CombatInputBasis.g23）和 `PlayerBattleSnapshot.g23` 重建自权威 `seatMechanics`，包含 `hidden.progress` 中的 seed/rngState/rngDraws/economyReceipts。这些仅用于冻结输入、服务器计算和可信存档/回放校验，**禁止投影到任何私有、公开、观战或战斗视图**；不能因为字段名是 g23 就当成可公开数据。

G2-3 自动钩子的已知失败通过领域事件 `mechanicFailed{hook:'rewards'|'choice'|'academy',reason:MatchFailure}` 可观测。失败的单次发放保留其输入，不创建收据、不扣资源、不消耗 RNG；已成功的独立收据保留。奖励仍在 escrow，可重试。

**mechanicFailed 推送（2026-10-17）**：服务器已把 `mechanicFailed` 加入 `PUSHED_EVENT_TYPES`（`src/server/room/projection.ts`）。服务器自发的转移（截止自动上阵、结算、回合进入等）里本席产生的该事件随本席 `state` 推送的 `events` 发出；玩家自己的命令里产生的仍照旧随该命令的 `applied` 回执 `events` 发出。线上字段只有 `type:'mechanicFailed'`、`hook`（`'rewards'|'choice'|'academy'`）、`reason`（`MatchFailure` 枚举字符串），加规则统一盖的 `domain:'match'`、`eventSeq`；不带收据、奖励内容、RNG、种子或任何别席数据，`projection-wire` 禁发名单里的键一个都不含。它只进本席私有推送，公共视图 `toPlayerView` 不含此事件，别的席位收不到。界面可据此给本席提示"这次发放失败、奖励保留待重试"。用例：`tests/server/mechanic-failed-push.test.ts`。

## G2-4B / 神器锻造器（领域交接）

本批基于 #147 d3112d6，恢复征服者10/14，11/13等待#149。领域规则/content版本v5；choice数据仍使用既有forge结构和choose/timeout命令，不新增服务器消息。接口、失败语义、收据ID和恢复函数完整约定见 [MATCH_CONTRACT 的 G2-4B 段](MATCH_CONTRACT.md#g2-4b-神器锻造器领域合同2026-10-17)。神器四项来自21件已实现池，不得在服务器再次抽取或替换；超时取payload.timeoutOption。结算g23Facts必须继续由领域提供并原样转发。

本批不修改src/server/与界面，不能将领域交付称为联机端到端上线。服务器恢复应验证外层房间/席位结构；单人restoreMatch仍拒绝multiplayer字段，G23恢复辅助函数不替代整房恢复流程。

## 26. G2-4b 兹若特传送门虚空生物：准备期移动（2026-10-17）

规则侧接口与恢复证据见 `docs/evidence/g2-3/G2-4B-RESTORE-AUDIT.md`（`readItemSummons` / `moveItemSummon`，`src/simulation/match.ts`）。本节只写联机接线；NET_PROTOCOL、schema、save、replay 版本号都不变，规则、数值和 digest 不变。

**公共导出**：`src/server-entry` 新增 `readItemSummons`、`moveItemSummon` 和类型 `ItemSummonOrigin`，与 `match.ts` 的同名导出相同，服务器不另做逻辑。

**指令**：新增线指令 `{type:'moveItemSummon', itemInstanceId:string, cell:{col:int,row:int}}`（`MoveItemSummonCommand`，属于 `WireCommand`，不进 `ClientCommand`，机器人不会发）。每层 onlyKeys；`itemInstanceId` 非空，`cell` 两个整数，其它形状一律 `invalid-message`。
- 房间阶段门：只在 `preparation` 和 `choice` 两个房间阶段放行（与 deploy 同窗口但不进战斗/结算的 OPS）；其余阶段 `wrong-phase`。
- 分派：`moveItemSummon(state, itemInstanceId, cell)` 原样调用，成功时只发 `seatMechanicChanged{key:'g24ItemPositions'}`，不碰共享池、物品、人口；失败原因沿用规则侧：`wrong-phase`（不在准备、PvP 阵容已锁、不可操作）、`unknown-unit`（本席没有该物品实例的召唤物）、`outside-deployment-zone`、`occupied`。失败返回原 pool 和原 state 引用。
- 客户端：`RemoteSession.moveItemSummon` 发送后等回执和下一次 state 推送，本地不先移动；战斗回放期间不发。

**私有状态推送**：`SeatStateView` 新增 `itemSummons: ItemSummonView[]`，由 `toSeatPrivateView` 调规则的 `readItemSummons(match)` 得到，逐字段复制 `kind / ownerId / itemInstanceId / unit{id, definitionId, team, starLevel, location}`，只取 `team:'player'`；本席阶段不是 `preparation` 时为空数组。不含阶段数值（生命、攻击），客户端不计算、不铸造单位、不按缺席推断死亡。保存的格子仍只在 `seatMechanics.seat.g24ItemPositions`（已随机制容器整体下发），界面不直接读它，以 `itemSummons[].unit.location` 为准。

**界面**：准备阶段且棋盘上没有战斗时，`itemSummons` 画成我方可拖动棋子；只能拖到我方空格，放下即发 `moveItemSummon`；不能进备战席、不能出售、不能装备，不计人口。拖动提示只是显示判断，结果以规则回执为准。

**公开棋盘（观战/查看他人阵容）**：棋盘站位是公开信息，`toPublicBoard` 对每个席位调 `readItemSummons`，把站在棋盘上的召唤物追加为 `PublicBoardUnit{definitionId, starLevel, cell, items:[], summon:true}`；`starLevel` 是规则按阶段给的外观星级。只带棋盘上可见的这四项加标记，不带持有者 id、物品实例 id、战斗 id、生命比例或 `g24ItemPositions`。界面把它画在对应格子，不计羁绊、不当头像、不显示英雄数值卡。

**机器人**：不发 `moveItemSummon`，召唤物停在规则默认位置（持有者所在列的前排，或最近空格；移动过的保持已存位置）。

## 27. 侦察公开阵容扩展（2026-10-20 用户决定）

用户决定：点开别的玩家时能看到对方的强化、装备、异常、场上和备战席棋子，**看不到连胜/连败**。只改服务器投影和界面；规则、数值、NET_PROTOCOL（只增视图字段，不改客户端消息或回执，依据同 `messages.ts` 中 G1-P6 的说明）、schema、save、replay、digest 都不变。

**投影**：`SeatPublic.publicBoard`（`PublicBoard`）在原 `units` 之外由 `toPublicBoard` 逐字段新增三个字段，均为可选类型、房间总是填写：
- `bench: PublicBenchUnit[]`：本席 `preparation.units` 中 `team:'player'`、位于备战席的单位，`{definitionId, starLevel, slot, items[]}`，按 slot 升序；`items` 为该单位所持装备定义 id，按装备槽序。
- `looseItems: string[]`：`location.kind === 'inventory'`（未装备）的装备定义 id，按 `MatchState.items` 原顺序。
- `augments: string[]`：已拥有强化的定义 id，按 `MatchState.augments` 顺序（获得顺序）。
- `anomaly?: string`（加在 `units[]` 与 `bench[]` 的单位上）：`anomalyBinding.unitId` 指向该单位时为其异常定义 id，否则省略该键。不带 `choiceId`、`boundRound`、单位 id。

不公开：连胜/连败（`streak`）、金币、经验、商店、待选强化与刷新次数（`pendingChoice`）、`choiceId`/`acquiredRound`/`boundRound`、单位与装备实例 id、随机流。测试：`tests/server/projection.test.ts`、`tests/server/net/server.test.ts`。

**界面**：右栏点击席位打开的只读面板依次显示强化、棋盘、备战席、未装备装备和羁绊，带异常的单位头像上有异常标记；羁绊仍只按棋盘单位计算。面板和右栏都不显示他人连胜/连败。

### First-pass replay capture supplement

`startTwoSidedBattle(input, { captureReplay: true })` returns BattleReplayTask with
an independent `replay(): CombatReplay | null` accessor. Capture defaults off and
BattleResult is unchanged. PvE callers can use the public
`createCombatReplayRecorder(initialState, initialEvents)` once per battle and
record each tick. Signatures, sequencing, errors and freeze guarantees are specified
in [COMBAT_CONTRACT.md](COMBAT_CONTRACT.md#first-pass-combat-replay-capture-optional-pvp--pve).
First-pass output and re-executed replay have byte-identical canonicalContent;
startCombatReplay retains re-execution and divergence checks for spot audits.
This supplement allows capture in place of SR-B3-02's second frame-generation run;
server integration and spot-check policy are implemented separately.

## UR-I3-01 / v15：战斗单位当前状态种类（2026-10-20）

`CombatViewUnit` 新增可选字段（server-entry 同时导出 `CombatViewStatus` 与 `StatusKind`）：

```ts
interface CombatViewStatus {
  readonly kind: StatusKind | 'channel' | 'redirect';
  readonly harmful: boolean;
}
// CombatViewUnit
readonly statuses?: readonly CombatViewStatus[];
```

`toCombatViewState(state: CombatState): CombatViewState`、`createCombatReplayRecorder(initialState, initialEvents)` 与 `toCombatReplay(input)` 签名、输入校验及失败原因保持原状。新生成的单位视图总有 `statuses`（空时为 `[]`）；可选类型兼容既有视图对象，旧对象缺失时按空数组展示。数组只有状态种类和极性，不含来源、持续时间、执行计划或隐藏数据。

投影直接调用单机纯只读函数 `readUnitStatusRows(state, unitId)`，排除 `state:'pending'|'suppressed'`，保留 `effective|active`；不比较数值、不再执行叠加规则。沿用该函数的 filtered contribution（没有伤害包上下文时不判压制）、active activity、targetId 过滤、legacy fallback 语义。现代快照由引擎清理到期贡献/活动，投影不从历史事件重建、不改权威状态。

同 `(kind,harmful)` 去重，固定 ASCII kind 升序：`burn, channel, control-immunity, damage-prevention, damage-reduction, redirect, shred, stat-buff, stat-debuff, stun, sunder, untargetable, wound`；同 kind 下 `false` 在 `true` 前，不依赖 locale、贡献遍历顺序或来源 ID。护盾继续读 `shield`，不伪造 shield 状态种类。

`initial.units`、`keyframe.units`、`terminal.units` 和 `unitEntered.unit` 提供完整数组。tick 末现有单位字段差量比较在数组变化时发送 `unitUpdated{unitId,changes:{statuses:[...]}}`，与其他 changes 可同包；最后一项消失必须发送 `statuses:[]`。客户端整体替换数组；`statusChanged` 仅供动画事实，不用于推算图标。`applyCombatReplayTick` 的既有合并逻辑已覆盖该字段，重连用关键帧加后续 unitUpdated 即可恢复；镜像只翻格子/阵营，statuses 不变。

netProtocol 目标仍为 **4**，与本分支 claimOrb 共用一次升级，不增加到 5；不改 rules/content、save/replay 版本或 digest。本轮禁改 `src/server/`，其当前网络常量仍为 3，由 Claude 在 v15 统一接线至 4，不能据此称已联机上线。视图字节/回放指纹的变化和本轮测试结果见 [v15 第四块](LOOT_ORB_CLAIM_V15.md#v15-第四块ur-i3-01-联机战斗状态种类)。

## v16：史诗奖励与统一消耗品（2026-10-20）

本节覆盖 §18 中旧 component-reforger/completed-reforger 身份、装备单件目标和5-7/6-7旧宝珠表。公共签名与失败全集见 [MATCH_CONTRACT v16](MATCH_CONTRACT.md#v16史诗奖励复制器统一重铸器2026-10-20)，完整冻结/RNG合同见 [EPIC_LOOT_V16](EPIC_LOOT_V16.md)。本轮不修改 src/server/；服务器继续调用已有共享池命令，不自行选择英雄、抽重铸、生成装备或算折金。

runSharedMatchCommand(pool:SharedPoolState,state:MatchState,command:SharedMatchCommand):SharedPoolResult 签名不变；useConsumable分支仍为 {type:'useConsumable',consumableId:string,target:ConsumableTarget}。四种工具均目标己方单位；成功effect=remove-all/reforge-all/duplicate-unit；新增失败bench-full。失败返回原池原状态且无事件，预览不改变任何游标。客户端显示名取CONSUMABLE_DEFINITIONS，不能按旧三个枚举硬编码。

共享房间布局仅冻结载体与早期颜色，5-7/6-7为epic-reward占位；每席显式loot种子扩展为3或4颗冻结法球，顺序为成装锻造器/可选神器锻造器/铜箱/银箱，冠冕变体为冠冕/银箱/银箱。只有载体死亡才揭示，隐藏计划不投影。铜箱gray、银箱blue，锻造器/冠冕gold；一组一颗，箱内多条entry保持冻结顺序。两席共享早期颜色不共享箱内内容或随机游标。

联机沿用claimOrb，不在揭示或结算时直接发英雄。铜/银箱对应费用的已上线英雄池独立抽1星，银箱双英雄独立可重复，不直接产2星。缺货折费用金币，满席折getUnitSellPrice；金币/工具/锻造器领取收据与英雄收据同一事务。锻造器领取后进入既有四选一forge，selectChoice成功才有装备出生；重连和重试复用唯一收据。复制器使用时先检查真实备战席空位，成功后创建机制英雄法球，领取时才扣共享池。旧版本存档和快照被v16严格拒绝，不迁移；schema7/save3/replay3/command4、netProtocol目标4不再递增。

## B 方案第 1 阶段：权威战斗流（v20 / NET6，2026-10-21）

本节覆盖旧的「冻结整轮→预模拟完毕→整段 replay 播放」以及 D11 双跑替换尾段的生产调度。
`createGameServer` 默认启用流式；显式注入旧 resolver 的故障/对照测试默认保留旧路径，可用 `combatStreaming:true` 运行新路径。
准备截止只自动部署、配对、冻结 seed/输入并初始化 tick0，随即进入 battle。
每个 PvP 配对一个 `BattleReplayTask`，PvE 每席一个公共 Match 流；固定 50ms 逻辑边界，每场每边界只推进一 tick。
一批最多 8 场各一步，`sliceTicks` 可缩小，`sliceMs`（生产 20ms）在每一步之后检查；单 tick 不能抢占。
全体未结束战斗完成同一边界后，按 `battleStartedAt+(tick+1)×tickMs` 的绝对时刻安排下一拍，计算和切片耗时不再逐拍累加。落后时最多连续补两拍，再让出一个 tick；不跳过领域 tick，持续过载时允许整体落后。
`Room.committedBattleTick` 为全轮已提交边界；chunk 的 throughTick 为该场权威水位。

所有字段均为公开显示白名单，完整领域事件账本保留在首遍任务中，绝不随网络裁剪。
open/end 以及 chunk 内每条增量均带 `{roomId,round,battleId,revision,seatId,watch}`，本阶段 revision=1，独立于连接、控制和存档 activationEpoch。`watch:false` 永远是本人流；`watch:true` 是所订阅席位的公开流：

| 消息 | 字段及含义 |
| --- | --- |
| `combat-open` | `initial:CombatViewState, frame:CombatReplayTick, unitIds:ReplayUnitId[]`；tick0 或最近已提交关键帧。frame.tick=initial.tick。晚加入的关键帧不重播旧动画。 |
| `combat-chunk` | `{chunks:CombatChunk[]}`；每条增量含上面的信封和 `fromTick,throughTick,ticks:CombatReplayTick[]`。闭区间逐 tick 连续，只追加。本人与观战各至多一条非空增量合并为一个包，每连接每拍最多一个 chunk 消息；先 open，再 chunk，最后 end。 |
| `combat-end` | `throughTick,terminal:CombatViewState`；只在真实终局后发送，terminal.tick=throughTick。只有收到 end 且播到该 tick，客户端才完成。 |

客户端本人、观战各自保留 4 tick（200ms）抖动缓冲，按自己的时间余额推进；到达可播前沿保持画面，不清零 accumulator。
追加不重建已播前缀或重播事件。收到 end 后释放最后四拍，播到真实终局才完成。服务器终局播放尾段至少 800ms，覆盖缓冲；真实时钟只留在 server/显示层。
`resume` 可带本人 `combat:{battleId,revision,nextTick,seatId}`、观战 `watchCombat:{...}` 以及 `watchSeatId:string|null`。
两条游标独立校验、独立续传。本人 cursor.seatId 必须等于凭证席位；观战 cursor.seatId 必须等于订阅席位；显式 null 停止观战。
匹配当前源且 `1<=nextTick<=已录帧数` 时只发送缺失后缀及 end；游标不匹配时重发最近关键帧及尾段。未完成整拍时等整拍封口后推送。
断线/慢客户端不暂停战斗；每连接 bufferedAmount 超过 1MiB 即记录 `warn connection.backpressure`（连接、席位、积压字节）并断开保留席位。
客户端丢弃旧 battle/revision、重复 chunk/end；任一流发现缺口后用两条保留游标重连。游标不能结算或改写战斗，也不能读取他人私有 state。

#376 的观战接线沿用 `ClientListeners.watched(seatId,replay)` → `RemoteSession.watchReplay`，本人仍走 replay/replayRevised。
观战不得写 finished/lastBattle，自己的流和播放继续推进。生产流式双方只使用同一 recorder 的 open/chunk/end，不另外发 watch-replay/watch-tail；#376 原消息仅供显式注入旧 resolver 的兼容路径，使用同一 watchSeatId 与 watched 回调。
`watch:{roomId,seatId:string|null}` 每次都有 `{kind:'watching',seatId}` 回执，客户端按 commandId 消除 pending；请求本人席位归一为 null。
同席重复订阅不重置任何游标；切换/停止仅重置 watchCursor。失败为 `not-authenticated`（含连接 epoch 失效）、`no-room`、`wrong-room`、`unknown-seat`，不改变订阅。
B 方仅镜像投影已录帧，观战的 unitIds 为空。每席缓存 CombatStreamView，unitIds 建流时一次计算；未新增模拟或视觉控件。
`Room.subscribeStreams(listener:()=>void):()=>void` 每个完整边界只通知一次；取消函数与 dispose 均解除监听。
PvE 的事件/私有 state 更新先汇集到拍末，再统一发布一次；服务器将该发布和流通知合并为一次连接遍历。
旧 resolver 路径的 `subscribeLive((battleId:string)=>void)` 不变。本 PR 尚未发布的 NET6 草案内调整，不重录 epoch。

PvE 的运行帧、掉落揭示来自 `openMatchCombatStream` / `stepMatchCombatStream`（规则层）；真实终局先暂存。
全轮实际结束后按席位 index 顺序，在最新共享池上用 `runSharedMatchCommand(...,{type:'settleCombatStream',terminal})` 暂存奖励/收入/成长，
PvP 使用现有 SideProposal / 唯一结算收据。统一规划并原子提交；提交时复用终局计划，仅当 poolRevision/seatRevisions 基础变化才从最新资产重规划，纯暂存不会提前发奖。
重复提交由既有 settlementId 拒绝；失败仍为原 state/pool/reason，不新增服务器规则。
完成录像来自同一次 recorder，D11 金币直接采样当前流任务，不再预模拟再重算。既有 replay/replay-tail 仅供旧测试路径。
抽检只在完整结果产生后启动，并继续使用 #371 同样的有界后台切片。

规则公共接口（位于 `src/simulation/match.ts`；不依赖服务器/时钟）：

- `openMatchCombatStream(state): MatchCommandResult & {streamInitial?:CombatState}`：成功冻结开局输入、发开局事件；不提交 tick0 终局奖励。沿用 `matchStartFailure` 失败枚举。
- `stepMatchCombatStream(state): MatchStep & {terminal:CombatState|null}`：推进一个 tick；运行帧更新 Match，终局保留前一合法 Match，并返回可信 terminal 供稍后结算。非法阶段抛 `wrong-phase`（内部调度错误）。
- `settleMatchCombatStream(state,terminal,unitLootPolicy?): MatchCommandResult`：只接可信首遍终局，提交原有 withCombat 路径；重复回合、无开局输入或错误终局身份返回原 state / `wrong-phase`。共享池调用必须经过新 `settleCombatStream` 命令，不能直接越过卡池。

战斗中允许买、卖备战席单位和刷新，利息按最终结算时的权威金币计算；PvP 沿用胜利金币先计入 interestBasis 的次序，不冻结开战金币。

第 2 阶段 `applyBattleEquipment` 尚未实现，装备仍只改变资产；挂点为 `Room.nextBattleInputTick`（下一未封口边界）、
`CombatStream.nextEffectiveTick`（该场下一步）和规则层 `BattleReplayOptions.beforeTick(effectiveTick:number):readonly BattleTickInput[]`。
该回调在 `advance(n)` 内每个 tick 以及 `advanceTick()` 前执行，`startLiveTask(envelope,beforeTick?)` / `CombatStream(envelope,pve?,beforeTick?)` 向原 PvP 任务传递。
`BattleTickInput = BattleEquipmentInput`，字段 `{kind:'equipment',seq:number,effectiveTick:number,seatId:string,itemId:string,unitId:string,slot:number}`；
`BattleResult.inputLog?:readonly BattleTickInput[]` 是私有成功日志，缺省为空，绝不放进公共帧。阶段2由单写队列认证席位与命令，按 effectiveTick/seq 注入，成功安装后原子追加；失败不记日志、不消耗资源或 RNG。
阶段1只支持空批次/空日志；非空输入在 stepCombat 前抛 `BattleValidationError('battle-input-unsupported')`，外部结果的 proposeSettlement 和 startCombatReplay 也拒绝非空/畸形 inputLog。
本阶段不保存未执行装备意图、不静默重解释旧 equipmentCommands.tick。已有成功 Match 装备命令仍记入 `BattleRecord.equipmentCommands`，经公共命令重演及资源账本认证；漏记会拒绝恢复。

正式身份为 `s13-g2-3-v20-live-combat` / `s13-14.24b-g2-3-v20-live-combat`，父 epoch 为 `v20-xp68`；CONTENT=`fnv1a32-utf16:93fad04c`、LOOT=`fnv1a32-utf16:49eb9cf0`，schema/save/replay/command 为 **11/7/5/5**，NET6。manifest 保留 `combatStreaming:live-tick-v1`，继承XP68与梅尔救命精确HP核对及全部 Chem-Baron 规则。
golden、B8/C19/Herald 与 recorded states 已在新目录独立生成；旧身份严格拒绝恢复，所有历史字节保持。录制及只读核验入口见 [RELEASE_NOTES](evidence/v20-live-combat/RELEASE_NOTES.md)。
本仓库无服务器房间持久化，本阶段不新增数据库；运行中单人 Match 前缀沿既有序列化重执行校验后续进，网络恢复使用已提交关键帧/尾段。
