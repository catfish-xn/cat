# 界面数据需求（Claude → Codex）

## v17 当前状态（草稿）

贪财化身恢复联机准入，单机/联机异常均56（联机55→56），强化60。#254/#258实时银行已接通；规则游标t注入后t+1生效，8tick=0.4秒显示前瞻不能称“显示下一帧立即生效”。rules/content同升v17、CONTENT `de829c8a→8a955c10`，LOOT保持`62c76cb9`；格式/协议不升。PR保持草稿，等v16发版收口后才合；发版排空对局。6条服务器待补验收（真实抽选、双真人/镜像、同tick增减、物品/Sevika、末尾操作、重连推帧结算）见 [V17_AVARICE_ONLINE](V17_AVARICE_ONLINE.md#服务器侧待补测试)，交由Claude，本任务不改服务器或界面。下方旧交接身份与未接线描述以各段时间为历史背景。

## LOOT-ORB-CLAIM-v15（Codex → Claude，待服务器/界面接线）

- 规则已批准 2026-10-20 02:20，02:26 补定战斗可点、排队、战后结算；第二轮基线 b1c841e6，合同 `multiplayer-orb-claim-v2`。消息新增 `{type:'claimOrb',round:number,orbId:string}`，round 为操作时当前轮，orbId 可来自历史轮；仅用真实席位 state 转发 runSharedMatchCommand，不重算奖励或售价。
- private 新字段 unclaimedOrbs：`{orbId,roundId,tier,entries:[{kind,definitionId?,quantity,starLevel?}],source:'pve'|'mechanic',queued:boolean}[]`；保留跨轮法球，点一次领取整颗。queued=true 表示已受理，尚未到账；领取结果 `orbClaimReceipts`（LootView 为 claimReceipts）含原 payload、resolution、gold、claimedRoundId、grantedUnitIds；capacity-sold 显示“自动出售 +NG”，gold 为缺货补偿。排队 ACK 不伪造入库回执。
- 公共投影只能读 readPublicOrbSummary 的 `{count,tiers}`，不能转发 orbId/entries/收据。单机/旧预览省略新字段，现有视觉文件无需为类型兼容改动。
- preparation/settlement/choice 可即时领；combat 或冻结 PvP 阵容接受并排队，battle/awaiting-settlement 必须转发。重复排队沿用 already-claimed，失败枚举不新增；另有 unknown-orb / seat-eliminated / stale-round / wrong-phase / multiplayer-required / shared-pool-required / invalid-loot 和池校验；失败不改 state/pool/RNG。接受排队只写席位私有 m8.loot.queuedOrbClaims（string[] FIFO），不改备战席/金币/卡池库存/预留/RNG，无领取事件/收据；包装仅更新 revision。
- 战后在本轮经济/HP/成长、G23 钩子、延迟升星完成之后、战后选择之前按 FIFO 结算（PvE withCombat / PvP applyRoundSettlement）。以此时容量和库存执行同一领取逻辑，每颗后 drain 原机制奖励并同步装备；淘汰先清队列并 forfeited，不补金、不扣池。领取本身 0 RNG；原装备钩子按 FIFO/父装备 ID 顺序消费 equipment 流并记 roll，详见 MATCH_CONTRACT。完整最新席位快照必须持久化队列；重连只投影 queued，不再次排队或自动发奖，不用战前副本覆盖最新状态。
- 服务器 `src/server/net/messages.ts` 的 NET_PROTOCOL_VERSION 必须 3→4，目标值由 simulation/m8/version.ts 的 MULTIPLAYER_NET_PROTOCOL_VERSION 导出；本任务禁改服务器目录，当前该服务器常量仍为 3。
- bot 每次准备阶段入口先调用 claimBotPreparationOrbs，成功整体提交后再进入原操作预算；整局终局对赢家及其他存活席位调用 `forfeitTerminalOrbs(state: MatchState): MatchStep`（server-entry 公共导出），提交返回 state/events；领域已按 Match 规则编号，服务器不得重复编号。无失败枚举、重复调用无新事件或收据；调用者负责确认整局结束，不要求席位已淘汰。淘汰清理已由领域接上。详见 MATCH_CONTRACT 的 #260 / #262 终局入口。
- 验收：战斗点击接受且 queued=true，当时资源不变；重复点击失败无变化；战后才入库/按最终容量折金，先淘汰则 forfeited；排队前后重连/恢复不丢不重发；公共不泄露内容或 queued；截止/跨轮不消失，bot 准备入口领完。约定值：完整星级缺货整条按费用补金一次，奖励法球 gray；跨席竞争沿原结算提交顺序。完整签名、恢复边界和 PR 草稿：[v15 交接](LOOT_ORB_CLAIM_V15.md)。

## D11-SERVER-LIVE-BANK（已接线；v17新增验收待Claude补）

- 领域已交付：`startTwoSidedBattle` 返回任务的 `sampleBankGold(seatId:string,liveGold:number):boolean`。仅服务器权威 Match.gold；在下一规则tick前生效，不扣费、不发资源、不推进RNG。状态变化并记样本为true，相同有效银行/未绑定/镜像B为false。非法席位 / 数值 / 超过100000条有效样本为invalid-bank-sample；终战后wrong-phase。
- 当前状态：#254/#258已将成功交易顺序与live规则轨道接通，采用live结果结算并发送公开replay-tail；PvE先catchUp再操作。仍需按v17六条清单补真实抽选和边界验收；不得事后修改动画或另算增伤公式。
- 字段：私有 `BattleResult.bankSamples?: {tick,team,liveGold}[]`，需原样保留给 proposeSettlement 及 toCombatReplay / startCombatReplay 输入；公开 replay 输出不含银行。已有 g23Facts 整体转发同时承载 d11Headhunter 击杀事实，不要自行计数。
- 验收：同一PvP真实买卖使后续伤害双向变化；物品/Sevika收益相加一次；切片、完整账本、重放一致；镜像不发成长/收益、不公开银行。服务器已接线；现有注入绑定测试不能替代v17新增6条真实闭环验收，本任务不修改src/server/或tests/server/。

## D11-DISPLAY（Codex → Claude，v15）

- 名称 / ID / 等级：`all-for-one-i` 一费奉献 I（silver）、`trifecta-i` 三项赛 I（gold）、`spirit-link` 灵魂连接（gold）；`avarice-incarnate` 贪财化身、`headhunter` 猎头者。目录已有准确 name / description，数值以 d11-fill-source 为准。
- 私有字段：`toPrivateSeatView().d11Display? = {definitions:[{definitionId,name,description,tier?}], headhunterKills?}`。仅已拥有 / 当前提供的 D11 定义；headhunterKills 为已结算永久击杀数，战中变化由战斗事件 / 权威攻速呈现。不得读 hidden.progress 给界面自行聚合。
- 公开字段：战斗 replay 每单位可选 `choiceEffects:[{definitionId,name,description,tier?}]`；只显示已生效效果，不含其他席候选、金币、RNG 或收据。已有 readCombatStats / statChanged / heal / packetDamage / kill 继续提供表现数据；静态 PublicBoard 不增加隐藏信息。
- 缺口：现有 augmentPlayerDescription 只允许六个旧 ID，需适配读取新增权威 description，不能把占位 mechanic d11Fill 当效果文案。灵魂连接说明必须写清开战生命与完整十点组；猎头者说明不得把召唤物 / 助攻算入。
- 图标：现有 `s13-augment-asset-manifest.ts` 无三个新 ID 的映射，本轮无可复用 icon key，未编造路径；沿用当前无图标文字回退，表现层可按自身素材规则补映射，禁止凭等级猜文件名。
- 验收：单机 / 联机选择与已拥有列表显示完整中文名称、说明和正确等级；公开战斗可读同一说明；不用修改规则数值、不额外发资源。没有声称已做浏览器视觉验收。完整交接：[D11_WIRING_V15](D11_WIRING_V15.md)。

按 AGENTS 约定记录界面缺少的数据、命令或接线。每条写明关联任务、优先级、交付阶段、缺少的字段与含义、界面当前替代路径、交付后需要复核的内容和验收条件。界面不自行计算规则；后端交付前，界面只读已有权威字段，并在无法确定含义时使用中性文案。

## AUGMENT-CARD-REROLL（Codex → Claude，v15，2026-10-20）

- 状态：领域、共享命令与私有投影已交付；服务器和界面待 Claude 接线，本轮禁改这些目录。旧“刷新强化 · 同一等级（剩余 1 次）”整组入口不再适用。
- 用户已确认每张卡下面单独刷新、只换该卡且锁级；每槽每次选择各免费一次。被刷掉的 ID 对本局该玩家永久移出，后续任何强化节点都排除，不影响其他玩家。轮次保持 2-1/3-2/4-2。
- 数据：`toPrivateSeatView(state).pendingChoice.augmentOptions[] = {optionIndex,definitionId,rerollAvailable}`，与 offers 同序，optionIndex 为 0..2；每卡按钮只读取 rerollAvailable。`rerolledSlots` 表示各槽是否用过；`rerollsRemaining` 改为尚未使用的槽位总数 0..3，不能用于判断某一张是否可刷。池耗尽时未用槽位按钮同样不可用。单机也可用此投影，不在界面另算候选。
- 单机命令：`rerollAugment(state,choiceId,generation,optionIndex)`；联机消息：`{type:'rerollAugment',choiceId,generation,optionIndex}`，服务器白名单/类型加必填整数下标，按 [联机合同](MULTIPLAYER_CONTRACT.md) 经 runSharedMatchCommand 事务。旧缺参调用明确 invalid-slot，不能默认刷第 0 张。
- 所有卡共用最新 choiceId/generation。任一卡成功都会 generation+1；收到返回/投影后更新全部按钮的命令代次，不连续发送缓存的旧代次。刷新失败保留当前画面并展示回执 reason，不能乐观换卡或消耗按钮。
- 失败：wrong-phase、stale-choice、invalid-slot、augment-rerolls-exhausted（仅该槽）、augment-pool-too-small（同级候选零项）。服务器原身份、revision、轮次失败继续沿用。成功仅目标槽卡改变，其他两张原位保留。
- 持久化：服务器需随权威席位 state 保存 removedAugmentIds、augmentOffers[].rerolledIndices、pendingChoice.rerolledSlots；重连直接恢复投影，不 createMatch 或重置刷新状态。移出账本不对客户端下发。现有联机完整 Match 用户读档仍不支持，本轮没有新增服务器磁盘恢复能力。
- 验收：三槽各刷一次且各按钮独立禁用；新卡不与其余卡/已拥有/永久移出重复；刷新、断线重连、下一节点后均正确；旧代次失败无扣费/RNG；联机保存 pool+state 的 revision 一起提交。basic bot/超时仍首选，不增加刷新行为。
- 发布：与法球、#231 接线统一 v15；本轮版本、digest 和录制指纹不动，见 [收口清单](AUGMENT_CARD_REROLL_V15.md)。

## G23-SERVER-FACTS（Codex → Claude，G2-3配套P1）

- 领域PR基于multiplayer #134 /19aa9f1；不修改src/server/、src/rendering/、src/server-entry/。
- 缺少字段：src/server/room/room.ts约1052行的收据构造把SideProposal转成RoundSettlementReceipt时，需原样转发可选g23Facts。类型和规则均由simulation导出；服务器不计算征服击杀、金币、微光或军械库场次。
- 状态：已由#140接通。`buildReceipt`原样转发可选g23Facts，联机PvP的征服者、化学男爵、军械库与High Roller进度随结算推进；`tests/server/g23-server-facts.test.ts`覆盖原样转发、重复提交只结算一次、镜像不发奖。
- 验收：真实PvP的两席进度/机制奖励各提交一次，重试和镜像不发奖；服务器从proposal原样传facts，八席仍经runSharedMatchCommand事务；复用#134私有视图和选择超时。无需新增服务器调用签名。确认回放支持unitSpawned、bindingChanged、castOutcome及已有unitRevived。

## U6 已揭示掉落、领取与结算（静态阶段盘点）

基线：`feat/m8-b0-baseline` 的 `f18985131c08c729f5bcf8cc8de8bbd3eec59a3d`；分支 `feat/m8-u6-static`。B8（PR #28）尚未签收，`readLootView` 接线排在 B8③。本阶段只做静态界面：渲染函数直接以冻结的 `LootView`／`RevealedDropView`（M8_UI_CONTRACT §5）和 `PendingChoice`（M8B_CONTRACT_ADDENDUM §3.3）为输入类型，样例只在开发服务器的 `/u6-preview.html` 上展示，不进入游戏入口和生产构建。

优先级：P1 = 正式接线前必须明确，否则界面只能猜测或混淆状态；P2 = 影响显示完整度；P3 = 需要确认。

### 已有、可直接使用的形状

| U6 需要 | 权威来源 | 备注 |
| --- | --- | --- |
| 已入库／处理中／等待空位／终局保留 | `RevealedDropView.status/receiptId/reason` | 只有 `granted` 显示“已入库”；不按金币变化或动画猜收据 |
| 奖励内容 | `payload.kind/definitionId/quantity` | 名称、图标沿用 UI 名表和装备图鉴 |
| 继续是否可用及原因 | `LootView.canContinue/reason/pendingClaims` | 界面不另算阻塞 |
| 八组件选择与命令 | `PendingChoice.offers/choiceId/generation` + `selectChoice(choiceId, generation, definitionId)` | 固定 8 项、不可刷新；结果以命令返回为准 |

### UR-U6-01 已解决组件选择的只读投影（P1，B8③，合同增补）

- 现状：ADDENDUM §5.1 要求“新增选择奖励的只读投影……现有 UI 合同缺少的只读形状需作为增补提交”，目前仓库和 PR #28 中都没有这份增补。冻结 `LootView` 只有具体 payload 的 `revealedDrops`，没有说明已解决的选择是否出现在其中、以哪个 `dropId` 出现。
- 需要：明确已解决选择的展示形状。例如作为 `revealedDrops` 中 `status:'granted'` 的 item 行（`dropId` 为选择的 dropId、`receiptId` 为其 LootReceipt），并区分 `player-choice`／`terminal-fallback` 两种解决方式。
- 用途：“已揭示奖励与已解决选择的结果”和“提前终局时自动选定的组件”。
- 当前替代：静态样例按 granted item 行展示，不区分解决方式。
- 验收：玩家选择和终局 fallback 都以唯一收据的已入库行出现；未解决的选择从不显示为已拥有物品；未用到的 fallback 从不出现。

### UR-U6-02 选择期间的继续阻塞原因（P1，B8③，合同增补）

- 现状：`LootView.reason` 只有 `pending-capacity | unsettled-round | game-over | null`。ADDENDUM §5.1 要求未解决自选“须有明确的待选投影与阻塞原因，不能……伪装成英雄容量问题”。
- 需要：在 `phase==='choice'` 时，明确 `readLootView` 返回的 `canContinue/reason`。可以增加例如 `pending-choice` 的原因值，也可以由合同写明 `reason=null` 时以 `PendingChoice` 为准。
- 当前替代：样例为 `canContinue:false, reason:null`，阻塞文案取自 `PendingChoice` 是否存在。
- 验收：选择与满席同时存在时，按 ADDENDUM 的顺序先显示选择、后显示容量，两种原因不相互覆盖。

### UR-U6-03 待选项的来源（P2，B8③）

- 现状：`PendingChoice` 没有 dropId／sourceUnitId 等来源字段；`choiceId` 是编码后的标识，界面按约定不解析它。
- 需要：在 UR-U6-01 的只读投影中给出当前待选项的来源（sourceUnitId 或已解析的怪物定义）。
- 当前替代：选择框只写“本回合野怪奖励”，不写具体怪物。

### UR-U6-04 掉落来源名称的读取路径（P3，确认）

- 计划：用同一回合 `readEncounterPreview(state).units[].unitId` 匹配 `RevealedDropView.sourceUnitId`，再取 `definitionId` 并通过 UI 名表显示怪物名。
- 需要确认：`LootView.roundId` 是否总是当前回合（包括选择期和提前终局），以及 `sourceUnitId` 是否与预览中的 `unitId` 为同一编码。如果不能保证，请在视图中直接给出来源的 `definitionId`。

### UR-U6-05 战中揭示的可见性（P3，确认）

- 现状：冻结表把 `revealed` 写为“领域正在同事务自动处理”；ADDENDUM §3.1 则规定战中只揭示、战后统一授予。
- 需要确认：战斗进行中 `readLootView` 是否返回 `revealed` 行（界面计划在战斗中显示“已揭示 · 战后处理”），还是只在战斗结束后才有数据。

### 正式接线待办（B8③签收后）

1. 在结算、选择、终局三个阶段，策略面板读取 `readLootView(state)` 渲染奖励列表；来源名称按 UR-U6-04 处理。
2. 选择框：根据 UR-U6-01／03 的来源信号（不解析 `choiceId` 前缀）判断是野怪组件选择，改用八组件布局；点击调用现有的 `session.choose(choiceId, generation, definitionId)`，沿用现有的防重复点击和关闭遮罩。
3. Continue 按钮的可用状态与提示改读 `canContinue/reason`；命令失败时显示领域返回的原因。
4. 终局页面显示保留奖励的只读记录，不提供任何领取或折算操作。
5. 奖励英雄出现在棋盘或备战席时，依赖 DOT 在 B8 分支修复的 BoardScene 生命周期提交（`07f269c`），U6 不重复修改该处。
6. 接线后重新实测包体（静态阶段探针：引入三个渲染函数约 +1,416 B），并请 Codex 补充 U6 界面自动回归。

### U6 接线状态（2026-10-10，Claude 接手 B8＋U6 后）

`readLootView` 已在 B8 分支实现（`src/simulation/loot-view.ts`，经 `match.ts` 导出），策略面板已接线。以下记录每项请求的实际处理结果；**没有修改冻结的 `LootView` 形状**，需要改合同的部分已按 2026-10-10 批准的最小增补实施（见 [U6 LootView 增补](M8_U6_LOOT_CONTRACT_PROPOSAL.md)）。

| 项 | 处理结果 | 证据 |
| --- | --- | --- |
| UR-U6-01 | 已解决的组件选择只在其 LootReceipt 存在后以 `status:'granted'` 行出现（dropId 为选择的 dropId，payload 取自收据）；未解决的选择和未用到的终局备用组件不出现。冻结形状无法区分 `player-choice`／`terminal-fallback`，界面不区分；如需区分须另行增补合同 | `tests/m8-b8-loot-view.test.ts` 选择后与终局三场景 |
| UR-U6-02 | **按 2026-10-10 批准的增补已改为 `reason='pending-choice'`**（补给/强化/异常选择仍为 `unsettled-round`），不伪装成 `pending-capacity`；选择与满席并存时，选择完成后才转为 `pending-capacity`。原因顺序与 `nextRound` 守卫一致，测试逐例比对命令结果 | 同上 `agreesWithContinue` |
| UR-U6-03 | **按批准的增补已解决**：`LootView.pendingChoice` 给出待选项身份（含 sourceUnitId）；界面据此判断野怪选择并显示来源名，不再按回合类型推断、不解析 `choiceId` | `strategy-panel.ts` `renderChoice` |
| UR-U6-04 | 已确认：`roundId` 恒为当前回合；`sourceUnitId` 与同回合 `readEncounterPreview().units[].unitId` 同一编码，测试断言每条已揭示掉落恰好匹配一个预览单位 | 测试“mid-combat”用例 |
| UR-U6-05 | 已确认：战斗进行中返回 `revealed` 行，界面显示“已揭示 · 战斗结束后自动入库” | 同上；浏览器实测 1-3 战中截图 |

接线内容：PvE 回合开战后（战斗、选择、结算）显示 `lootPanelSection`，终局显示 `lootTerminalSummary`；战斗中仅在投影变化时刷新。Continue 是否可用、原因及等待入库数量全部来自 `LootView`，界面不发领取命令、不按金币或动画推断收据。

## U5 第一阶段与 `.7` 野怪遭遇预览（开工前接口盘点）

**交付状态（2026-10-10）：U5 已独立审查并合入。** PR #26 已审查 SHA `855430157b6947d4b9710db3b08f6842f1c9347d`（[CI #168](https://github.com/catfish-xn/cat/actions/runs/38019557635) 成功，无 P0–P2），合并提交 `d64c381260c4c862d813da7e8c7c983813ce89e0`，合并后的 tree 与已审查 HEAD 完全一致。预览已改读 UR-U5-01/02 正式字段，不再依赖旧适配层。包体实测 488,964 B，距总上限 552,191 B 余 63,227 B。仍未完成：6-7 先锋的实机导入和完整应用验证由 B9 补验；非阻塞 P3「U5 界面自动回归」登记为 [#27](https://github.com/catfish-xn/cat/issues/27)。独立审查证据：Codex 原审查记录已补记为 [PR #26 评论 6093541375](https://github.com/catfish-xn/cat/pull/26#issuecomment-6093541375)，内含原始 `u5-review-evidence.json` 的完整副本（35,015 B，SHA-256 `12b86d324d5b9d5abaa6a0fff71c1f063a4470d89d33d927bf13ff3b1440662a`）。时间顺序：审查结论先由用户在会话中转达；随后 PR 于 03:50:57Z 合并，本记录首版（`2acb9ac`）于 03:52:24Z 写入，当时 PR 上尚无审查记录；原审查记录于 03:59:55Z 补记（均为 2026-10-10 UTC）。该评论是对原审查（针对 `8554301`、CI #168）的补记，不是重新审查，也不构成对合并提交的新签收。H1 维持 [H1_WARN_ONLY.md](H1_WARN_ONLY.md) 原记录，不因本次 CI 全绿而关闭。

基线：`feat/m8-b0-baseline` 的 `8778269`（B7 PR #21 已合入）。以下为该基线开工前的数据盘点。2026-10-10 更新：用户已批准 M8 专用 JS 新上限及 U5 先沿已有适配路径开工；UR-U5-01/02 已签收、已合并（PR #25，`4acea21818dc8ff2ef1e266d3aed51c78b81d74f`），见 [U5 合同增补](M8_U5_PREVIEW_CONTRACT_ADDENDUM.md)。下述两项的“现状/当前替代”保留为开工前历史，不再表示新字段缺失。

优先级：P1 = U5 第一版必须有，否则显示不准确或只能混用两个数据源；P2 = 第一版可以先用占位，补上后显示更完整；P3 = 可选。

### 已有、可直接使用的字段（无需新增）

| U5 需要 | 权威来源 | 备注 |
| --- | --- | --- |
| 阶段、小回合、类别、是否终局、显示名 | `readRoundInfo(state)` → `RoundDefinition.roundId/ordinal/stage/subround/kind/isFinal/encounterId/displayName` | 现有 HUD 用 `getStageRound(match.round)`，它已读取目录，数值正确；U5 改为直接读 `displayName` |
| 敌方阵容、位置、星级、名字 | `readEncounterPreview(state).units[].unitId/definitionId/name/starLevel/cell` | 补给轮返回 `null` |
| 四项基础属性 | `.units[].stats.maxHp/attackDamage/armor/magicResist` | 来自开战前的 strategy snapshot，PvP 包含装备和羁绊 |
| 能力说明、规则说明 | `.units[].abilityDescription`、`.rulesNote` | 中文玩家文案，界面原样显示 |
| 回放中的回合名 | `readRoundInfo(record.context)` | 回放记录的 `context` 是完整 `MatchState`，无需新增字段 |
| 开战/继续失败原因 | 公共命令的 `reason` | 已有 |

### UR-U5-01 预览单位的分类字段 `unitKind` / `monsterFamily`（P1，B7 后续，修改冻结类型）

- 状态：**已签收、已合并**；Claude Code 复审签收 `d2e7558`，PR #25 合并提交 [`4acea21818dc8ff2ef1e266d3aed51c78b81d74f`](https://github.com/catfish-xn/cat/commit/4acea21818dc8ff2ef1e266d3aed51c78b81d74f)；字段与同源初始化语义见 [U5 合同增补](M8_U5_PREVIEW_CONTRACT_ADDENDUM.md)。
- 现状：`EncounterPreview.units[]` 不能区分英雄和野怪。界面只能回退到 `UNIT_DEFINITIONS[id]`，但其中的野怪条目是 ENCOUNTERS §3 允许的旧类型适配（`cost:1`、`symbol:'兽'`、`color`）。`getHeroIdentity()` 会因此把野怪显示成“1费”，职业行显示为空或“中立”。
- 需要：`units[].unitKind: 'champion' | 'neutral'`，`units[].monsterFamily: MonsterFamily | null`（英雄为 null）。值取自冻结内容，与恢复校验同源，不按 ID 前缀推断。
- 用途：野怪不显示费用、职业行和英雄头像框；按 `monsterFamily` 分组显示（例如“石甲虫 ×3”）。
- 当前替代：开工后先读适配层的 `UNIT_DEFINITIONS[id].unitKind`，并屏蔽野怪费用；字段交付后改读预览。
- 验收：8 场 PvE 的 25 个单位全部为 `neutral`，family 与 ENCOUNTERS §3 表一致；PvP 单位全部为 `champion`，family 为 null。

### UR-U5-02 预览单位的完整开战属性（P1，B7 后续，修改冻结类型）

- 状态：**已签收、已合并**；Claude Code 复审签收 `d2e7558`，PR #25 合并提交 [`4acea21818dc8ff2ef1e266d3aed51c78b81d74f`](https://github.com/catfish-xn/cat/commit/4acea21818dc8ff2ef1e266d3aed51c78b81d74f)；字段与同源初始化语义见 [U5 合同增补](M8_U5_PREVIEW_CONTRACT_ADDENDUM.md)。
- 现状：`stats` 只有生命、攻击力、护甲、魔抗。射程（远程小兵 3、远古龙和先锋 2）、攻击间隔、基础暴击（野怪 25%/1.4 倍）、法力都没有，只有 `rulesNote` 里的一句文字。
- 需要：在 `stats` 中增加 `attackRange`、`attackIntervalTicks`（开战时的值；野怪由 `baseAttackSpeedBps` 按 G01 算出）、`critChanceBps`、`critMultiplierBps`、`abilityPower`、`mana`、`maxMana`。来源与现有四项相同（strategy snapshot），不能另算。
- 用途：遭遇预览卡和敌方单位详情。
- 当前替代：用 `getUnitStats(definitionId, starLevel)` 补齐。野怪的值与预览一致；PvP 单位缺装备和羁绊加成，会与预览的四项属性来源不一致，因此界面对 PvP 只显示现有四项。
- 验收：对 8 场 PvE 和至少一个 PvP 轮，预览值等于 `startMatchCombat` 后 tick 0 对应 `CombatUnit` 的值。

### UR-U5-03 野怪图片（P2，资源管线）

- 现状：`S13_ASSETS` 只有英雄（`kind:'champion'`）。`selected-neutrals.json` 归档了 7 个野怪 apiName 的 icon/squareIcon：TFT_Krug、TFT_Murkwolf、TFT_MurkwolfMini、TFT_Razorbeak、TFT_RazorbeakMini、TFT_ElderDragon、TFT_RiftHerald。五种小兵没有归档记录（ENCOUNTERS §1）。
- 需要：
  1. 内容数据给出 `definitionId → apiName | null` 对照，并附归档记录指针；小兵为 null。
  2. `scripts/fetch-s13-assets.cjs` 支持这 7 个 apiName，生成 `kind:'neutral'`、按 definitionId 编号的清单项（含 source、bytes、sha256）。界面不手绘、不用相似英雄图代替。
- 用途：棋盘野怪棋子、预览卡头像。图片只是外观，不作为 14.24b 机制依据。
- 当前替代：类型色块加名称首字作为占位；小兵永久使用占位。
- 验收：清单补齐后无需改界面代码；7 种野怪显示图片；在 `/cat/` 子路径下可读；受控 404 时回退为占位。

### UR-U5-04 能力短名称（P3，可选）

- 现状：能力 ID 是内部标识（如 `stone-salvage-project-v1`），不能显示；预览只有一段说明文字。
- 需要（可选）：`units[].abilityName`，例如“残骸回收”“狼群扑袭”，由内容提供并核实中文。
- 当前替代：卡片标题用单位名，正文用 `abilityDescription`。

### 需要确认的约定（不是新字段）

- **PvP `encounterId = pvp:<roundId>`**：用户已批准；界面只把它当作不透明的显示键，不用作素材键或掉落键，也不解析前缀。
- **预览范围**：`readEncounterPreview` 只描述当前轮（准备、战斗、结算阶段都能读，`nextRound` 后切换）。U5 第一版不提供“下一轮预告”；如果需要，要新增接口，并由 Codex 判断可公开的范围。

### 体积影响（U5 开工前实测）

同一环境（Node 22.22、zlib 1.3.1，按 `m7-budget` 的方法：每个 `dist/assets/*.js` 先单独 gzip level 9，再求和）：在 `8778269` 上只加入 `readEncounterPreview` 的 import，不加任何界面代码，JS gzip 从 **485,743 B** 增到 **487,353 B**（**+1,610 B**）。按现行上限 488,477 B 计算，留给 U5 全部界面代码的只有 **1,124 B**。其中英雄说明表 `HERO_RULES` 约占 842 B。UR-U5-01/02 会再增加少量字节。U5 是否开工取决于体积新上限。

## U4 通用战斗状态、来源与统计反馈（U4 第一版）

基线：`feat/m8-b0-baseline` 的 `5dce5cd`（B3 三批均已签收）。U4 第一版提交见 PR #12（首版 `2f36e62`，审计 R1–R6 修订在其后）。

优先级：P1 = 影响 U4 第一版显示是否完整、准确；P2 = 统计/回放的完整度；P3 = 后续内容接入时需要。

### 实战事件已携带 / 未携带的权威字段（以 `5dce5cd` 实际发事件路径为准）

| 字段 | 实战状态 | 界面用法 |
| --- | --- | --- |
| `CombatUnit.mechanismState.statuses`（StatusGroup）、`.activities` | 已有 | 当前状态列表、棋子状态小标（经 `combat-status.ts` 的 `statusSource()` 单点读取） |
| `ShieldLayer.m8State`（含完整 `source`、`absorbed/decayed/expiredDiscarded`） | 已有 | 护盾账目与来源（优先 `m8State.source`） |
| `heal.outcome`（`shares[]`、`requested/afterWound/actual/overheal/preventedByWound`） | 已有（`s13-mechanisms.ts` 唯一治疗路径） | 单条治疗事件的来源分项 |
| `statusChanged.group` | **部分**：`applyFrozenStatus`、到期、净化路径有；`applyStatus()`（现有英雄技能）施加、死亡/战斗结束清理路径**没有** | 有 group 读 group；没有时见 UR-U4-05 |
| `statusChanged.activity`、`shieldLayerChanged.endReason` | 已有 | 引导/分担结束原因、护盾结束原因 |
| `packetDamage.outcome` | **未携带**（`combat-s13.ts:280–282` 注明留待 B9/replay2） | 只读旧字段 `damageType/hpDamage/absorbed/critical/redirected`；`prevented/overkill/killingPacket` 显示分支目前不会触发 |
| `manaChanged.outcome` | **部分**：仅有限回蓝请求路径（`combat-s13.ts:390`）携带；普攻/受伤/施法路径只有旧字段 | 有 outcome 显示原因/锁蓝/溢出，否则显示旧字段 |
| `cast.receipt` | **未携带**（只有 `targetIds/manaSpent`） | 只显示选中目标 |

### UR-U4-01 `readCombatStatuses(combat)` 运行实现（P1，B3 补交付）

- 合同：B2 §3、§8；`src/simulation/m8/ui-contracts.ts` 的 `CombatStatusesView` 只有类型，没有运行导出。
- 需要：纯函数 `readCombatStatuses(combat) → {statuses: StatusGroup[], activities: CombatActivity(lifecycle='active')[]}`，不改 state/RNG。
- 适用范围：减伤等带 `damageFilter` 的贡献按每个伤害包筛选后再取强（M8_RULES A08），组内 `effectiveSourceKey` 只是无包上下文的摘要。若希望界面显示“对哪类伤害当前生效”，请在查询中提供权威的按适用范围划分结果；界面不会自行执行过滤。
- 当前替代路径：`combat-status.ts` 的 `statusSource(combat, unitId)` 直接读 store；带 `damageFilter` 的贡献全部显示并列出声明的适用范围，从不标为“被压制”；无过滤的同类最强（灼烧、重伤、击碎等）才依据 `effectiveSourceKey` 标注“同类状态由另一来源提供（本来源保留）”。领域选定的可能是更强来源，也可能是同强度时按 key 选定的一份；界面不比较强弱，文案不暗示大小。
- 交付后复核：替换 `statusSource()` 一处；8% 普攻 + 50% 技能减伤例两行都显示为有效并各带适用范围；查询前后 canonical 状态与 RNG 不变。

### UR-U4-02 M8 统计视图 `readCombatStats(combat)`（P2，B3 补交付）

- 合同：B2 §3，冻结 `CombatStatsView.units[].bySource[]{source,hpDamage,healing,requestedHealing,preventedByWound,overheal}`。现有 `BattleStats` 没有 `bySource`。
- 当前替代路径：统计表沿用 `BattleStats` 总数；单条 `heal` 事件明细直接展示 `outcome.shares[]` 的 `requested/actual/overheal/preventedByWound`（不跨事件聚合）。
- 验收样例（M8_RULES A10，饮血请求 20、枪刃请求 15、缺血 20），两套分开核对：
  - 无重伤：总请求 35、有效 20、过量 15；饮血 有效 11 / 过量 9，枪刃 有效 9 / 过量 6；重伤减少 0 / 0。
  - 33% 重伤：总 35 → 重伤后 23 → 有效 20、过量 3、重伤减少 12；饮血 有效 11 / 过量 2 / 重伤减少 7，枪刃 有效 9 / 过量 1 / 重伤减少 5。
- 额外需求（**不是冻结字段**）：按单位汇总的 `preventedByWound`。冻结合同只有 `bySource[].preventedByWound`；若要加单位总数，需走合同变更，不要直接改冻结正文。界面在没有该字段时不显示单位级重伤总数。
- 交付后复核：统计表按来源显示上述两套数值；seek/切战重建不重复累加；真实伤害单列。

### UR-U4-03 完整事件载荷：`packetDamage.outcome`、`cast.receipt`、`manaChanged.outcome`（P1，B3 开发适配 / B9 replay2）

- `packetDamage.outcome`（`DamageOutcome` 全字段，含 `context.source` 完整来源、`prevented/overkill/killingPacket`）：实战未携带。界面已有读取 `outcome` 的分支，但仍从旧字段 `unitId/hpDamage/absorbed/critical/redirected` 取目标与数值：
  - 若开发期适配**保留旧字段并附加 `outcome`**，界面可直接接入，只需复核显示。
  - 若 B9 切换为冻结的 `packetDamage{outcome}` 结构（无旧字段，`contracts.ts` `M8CombatEvent`），界面消费端（`combat-status.ts`、`combat-feedback-renderer.ts`、统计筛选）仍需适配并小范围复核；请随交付在本文件登记切换提交。
- `cast.receipt{targetIds,targetsSampledAtTick,actualManaSpent,refundedMana,completed,completionCell,actionSeq}`：用于“施法选中 A / 实际命中 B”（A11 麦迪例）和实际耗蓝/返蓝；当前只显示选中目标。
- `manaChanged.outcome`：普攻/受伤/击杀等回蓝路径缺失。冻结 `ManaOutcome` 表示**一笔回蓝请求**的结果，请为每种回蓝请求各自发布对应的 `ManaOutcome`；不要把施法扣蓝或同 tick 净变化塞进 `ManaOutcome`。施法消耗由界面读 `cast.receipt.actualManaSpent`，返蓝读绑定该次施法（`castActionSeq`）的 `cast-refund` outcome。
- 交付后复核：伤害明细出现“被防止/溢出/致命”；临时子件造成的伤害显示“临时子件”标记；麦迪例同时显示选中 A 与命中 B；界面不以法力净变化推算耗蓝。

### UR-U4-04 引导/分担按冻结的 `activityChanged` 接线（P2，B9）

- B2 已冻结引导/分担使用 `activityChanged{activity, reason}`（`M8_UI_CONTRACT.md` §8、`contracts.ts` `M8CombatEvent`）。当前实战以 `statusChanged` 携带 `activity` 发出，只是开发期适配，不等于符合正式回放格式。
- 需要：按冻结结构发布 `activityChanged` 并加入 `CombatEvent` 联合；同时通知界面，界面消费端（事件明细、筛选、飘字、状态小标）同步改读该事件并复核。
- 验收：范德尔 10 开始、20 被眩晕取消，事件明细显示“引导 被控制打断”，状态列表在 20 起不再显示引导，40 眩晕结束后也不恢复。

### UR-U4-05 所有 `statusChanged` 路径携带正式 `group`（P1，B3）

- 问题：兼容锚点 `status.kind` 不能表达正式状态种类与影响属性：
  - 施加（`combat-s13-state.ts` `applyStatus()`，现有英雄技能）：无 `group`。`resistanceFlat` 可能只改护甲（库奇）或双抗（芮尔），`amount` 单位随种类不同（减伤/击碎/攻速为 Bps，抗性/法强为固定值）。
  - 到期：`s13-mechanisms.ts:202` 为无锚点贡献生成 `kind:'resistanceFlat', amount:0`（带 group）。
  - 死亡清理 / 战斗结束（`s13-mechanisms.ts:274`）：所有贡献统一生成 `kind:'stun', amount:0`，**无 group**。实际复现：灼烧、重伤单位阵亡后日志显示“眩晕 0 阵亡清除”。
- 当前替代路径（`combat-status.ts` `LEGACY_ANCHOR`/`trustedAnchor`）：仅当锚点带 `contributionKeys` 或 `activity`（即真实存储的记录）时解读其种类；减伤、护甲击碎、攻速按 Bps 显示百分比；`resistanceFlat` 只显示中性“属性变化 ±N”，不判断是护甲还是双抗；其余无 group、无关联的锚点显示为“状态清理（原因）”。不按英雄名特判，不解析内部 key。
- 需要：施加、刷新、到期、净化、死亡清理、战斗结束各路径的事件都带正式 `group`（至少含结束贡献的完整身份、`application.kind` 与 `modifier`）。
- 验收：厄加特显示“护甲击碎 20%”，蕾欧娜“减伤 50%”，芮尔“属性削弱 护甲 −10 / 魔抗 −10”，库奇“属性削弱 护甲 −1”；灼烧/重伤单位阵亡显示“灼烧 阵亡清除”“重伤 阵亡清除”，不出现“眩晕”。

### UR-U4-06 父装备名称与本场冻结来源名称（P3，B5/B9）

- 已有字段（界面已读取，不需等待）：`Source.parentItemInstanceId` 存在于 `m8State.source`、`heal.outcome.shares[].source`、`StatusContribution.source`、`activity.source`。界面在这些路径显示“临时子件”标记，统计面板与策略面板共用同一来源格式（`originLabel`）。
- 旧字段缺父信息：`ShieldLayer.source`、`packetDamage.source`（outcome 未发前）、无 group 的状态锚点只有 `CombatOrigin`，这些路径暂时显示不出标记（伤害路径随 UR-U4-03 解决）。
- 未交付：父实例 → 父装备定义 / 名称的只读映射；回放使用该记录对应的冻结内容名称（合同 §3）。
- 验收：窃贼手套临时子件来源显示为“某临时装备（来自窃贼手套）”；切换内容版本后旧回放名称不变。

### UR-U4-07 U4 桌面 Chromium 定向验证（P1，Codex 编写；Claude 不改 tests/、CI）

现有 `tests/m6-stats-browser.cjs` 的 17 项只覆盖旧结构事件和无 `mechanismState` 单位，不能发现 U4 语义错误。请补一组桌面 Chromium（1440×1000）组件或路线验证。领域数据应由公开流程或领域函数产生（`applyStatusContribution`、`resolveHeal`、`grantShieldState/maintainShield`、实际 S13 战斗），不要手写与领域不一致的假数据。

| 场景 | 输入 | 预期显示 |
| --- | --- | --- |
| R1 减伤适用范围 | 同一单位：8% 减伤 filter={basic-attack; physical/magic; exclude}，50% 减伤 filter={ability-direct; …}；再受 100 物理普攻。前提：目标护甲 0，无护盾、无暴击，无其他增伤/减伤 | 领域 HP 伤害 92；状态列表两行均无“同类状态由另一来源提供”、无 inactive 样式，各显示“适用：普攻…”“适用：技能直接伤害…” |
| 同类最强（无过滤） | 两个 shred：30% 至 100、50% 至 60；状态快照由领域维护生成（实际战斗推进或领域维护函数），读 tick 59、60、61 | 59：50% 行正常、30% 行“同类状态由另一来源提供（本来源保留）”；60 与 61：仅 30% 行且无该文字 |
| 同类同强度 | 两名同星厄加特对同一目标施法，各施加 20% 护甲击碎（领域按 key 选定一份） | 两行均显示“护甲击碎 20%”；领域未选中的一行显示“同类状态由另一来源提供（本来源保留）”，不出现“更强”等暗示大小的文字；界面不比较或排序 |
| R2 兼容施加锚点 | 厄加特/蕾欧娜/芮尔/库奇技能施加（`applyStatus()` 事件，无 group、带 `contributionKeys`） | 事件日志：“护甲击碎 20%”“减伤 50%”“属性变化 -10”“属性变化 -1”；UR-U4-05 交付 group 后改按“正式 group”预期 |
| R2a 兼容清理锚点 | 输入固定为**无 group、无 `contributionKeys`、无 activity** 的清理事件（当前 `cleanupMechanisms` 形状：`kind:'stun', amount:0`），reason 分别为 `death-cleanup`、`combat-end` | 显示“状态清理（阵亡清除）”“状态清理（战斗结束）”；不猜种类，不出现“眩晕” |
| R2b 正式 group 清理 | 输入固定为**带正式 group** 的清理事件（group.kind 为 burn、wound），reason 为 `death-cleanup`、`combat-end` | 显示“灼烧 … 阵亡清除”“重伤 … 战斗结束”等真实种类加结束原因；后端再次丢失 group 时本场景应失败 |
| R3 来源 | 临时子件护盾（`m8State.source.parentItemInstanceId` 非空、`layer.source` 无该字段）；临时子件状态与治疗 | 事件日志、策略面板盾行、统计面板来源均含“临时子件”，两面板格式一致 |
| R4 治疗分项 | A10 两套：无重伤 / 33% 重伤（`resolveHeal`） | 事件含两来源各自“请求/有效/过量/重伤减少”，数值同 UR-U4-02 |
| 三类伤害 | 物理 10、魔法 20、真实 30 各一包 | 日志“物理/魔法/真实实际生命伤害”；飘字“−10”“−20 魔”“−30 真”；选中单位详情三类分别 10/20/30 |
| 状态与法力筛选 | 统计面板筛选选“状态”“法力”“全部事件（法力单列）” | “状态”只有 statusChanged；“法力”只有 manaChanged；“全部”不含 manaChanged |
| 引导被控取消 | 范德尔例（UR-U4-04） | 日志“引导 被控制打断”；状态列表与棋子“引”小标在取消 tick 消失且不恢复 |
| 护盾 A：衰减后吸收 | 600 盾（线性衰减），自然衰减 100 后吸收 120 | 日志含“自然衰减”“吸收伤害”；剩余 380、已吸收 120、已衰减 100；**本子场景**统计吸收增加 120（衰减不计） |
| 护盾 B：耗尽 | 另一盾受伤害至 0 | 日志含“吸收伤害（耗尽）”；该盾吸收量单独核对，与 A 的 120 分开统计 |
| 护盾 C：清理 | 持盾单位阵亡 / 战斗结束 | 日志“到期（阵亡清除）/（战斗结束）”，统计吸收不增加 |
| 只读 | 以上每个场景渲染、切换筛选、选中单位前后 | `JSON.stringify` 事件、战斗状态与 `BattleStats` 完全相同 |

## UR-U3-B5-01 装备命令拒绝原因临时文案（U3 动态部分）

- 用户明确授权 Codex 仅在 `BoardScene.ts` 既有拒绝原因表补齐四条映射，解决 B5 新失败码导致的构建阻塞；未改其他界面代码、布局或样式。
- 四条均为临时文案，后续由 Claude 在 **U3 动态部分**统一打磨：

| 领域拒绝码 | 当前临时文案 |
| --- | --- |
| `same-item` | 请选择两件不同的组件实例合成 |
| `unique-conflict` | 该单位已装备同一件唯一装备 |
| `exclusive-slots` | 独占装备不能与其他装备同时穿戴 |
| `temporary-item` | 临时装备不能单独操作 |

- 验收：保留四种拒绝原因各自的准确语义，界面读取领域失败码；不自行重新校验装备规则、不改变命令失败原子性。B5 构建与桌面验收结果见 `docs/M8_B5_HANDOFF.md` 最新记录。
- **已由 U3 动态部分接手**：四条临时文案已移入共用映射 `EQUIPMENT_FAILURE_TEXT`（`src/presentation/equipment-feedback.ts`），`BoardScene` 的命令失败提示与预览提示读同一份，四条文案同时打磨。`wrong-phase`、`unknown-unit`、`invalid-slot` 与非装备命令共用，命令提示仍沿用 `BoardScene` 原有分阶段文案。

## U3 静态部分：装备图鉴、合成表、效果说明

基线：`feat/m8-b0-baseline` 的 `97f38a0`（含 B4、体积预算 ×1.15、U4）。数据来源：B4 `readItemCatalog()`（`src/simulation/item-catalog.ts`，直接返回数组），44 件（8 组件 / 36 成装），`contentVersion = s13-14.24b-m8-b4-v3`。界面原样展示 `effectDescriptions`，展示 `unique`、`slotCost`、`evidenceStatus`、`localizationStatus`、`conventionIds`；不判断当前实例能否合成或装备。

优先级：P1 = 玩家可见文本或身份有误；P2 = 等后续 B 任务；P3 = 体验改进。

### UR-U3-01 组件说明夹带内部来源串（P1，B4 数据）

- 现象：7 个组件的 `effectDescriptions` 除属性行外还有一条英文内部串，原样展示给玩家：暴风大剑 `AD: 1000 Bps`、锁子甲 `Armor: 20 resistance-points`、巨人腰带 `Health: 150 health-points`、无用大棒 `AP: 10 ability-power-points`、负极斗篷 `MagicResist: 20 magic-resist-points`、反曲之弓 `AS: 1000 Bps`、女神之泪 `Mana: 15 mana-points`（来源 `src/simulation/content/items-components.ts`）。拳套没有。
- 需要：`effectDescriptions` 只放玩家可读的中文效果；来源核对串如需保留，放到独立字段（不在冻结类型内的，按合同变更流程）。
- 当前替代：界面原样显示，不过滤、不改写。
- 验收：7 个组件浮窗只显示中文属性行；与成装说明格式一致。

### UR-U3-02 窃贼手套说明夹带实施状态备注（P1，B4/B5 数据）

- 现象：`thiefs-gloves.effectDescriptions` 含“TG-01临时装备生成、刷新、清理在B5接入；B4仅本体属性生效。”，属于开发状态说明，不是玩家效果文本。
- 需要：玩家说明写成冻结规则描述；实施进度另行记录（文档或独立字段）。B5 交付临时装备后，由 B5 提供临时件的来源/期限展示数据（`readUnitEquipment().temporaryItems`）。
- 当前替代：原样显示；同时显示目录声明“占用装备槽 3”。
- 验收：浮窗不出现 B4/B5、TG-01 等开发术语。

### UR-U3-03 新增 28 件装备图标（P2，资源管线）

- 现状：`S13_ASSETS` 只有 16 件装备图标。缺图的 28 件：adaptive-helm、bloodthirster、blue-buff、bramble-vest、crownguard、protectors-vow、edge-of-night、infinity-edge、ionic-spark、jeweled-gauntlet、last-whisper、nashors-tooth、giant-slayer、morellonomicon、steadfast-heart、guardbreaker、quicksilver、red-buff、sunfire-cape、redemption、runaans-hurricane、gloves、evenshroud、statikk-shiv、steraks-gage、thiefs-gloves、titans-resolve、hand-of-justice（apiName 见目录）。
- 需要：按 `apiName` 对照官方 14.24 资源，经 `scripts/fetch-s13-assets.cjs` 生成清单项（含 source、bytes、sha256），提交到 `public/assets/` 与 `s13-asset-manifest.ts`。界面不手绘、不生成近似图标。
- 当前替代：统一占位标识——类型色块（组件蓝灰 / 成装棕金）+ 名称前两字；有图时图片覆盖在占位上，加载失败自动露出占位。
- 验收：清单补齐后无需改界面代码；图鉴 44 件都显示图片；在 `/cat/` 子路径下可读；受控 404 时回退为占位。

### UR-U3-04 中文译名核实（P2，内容）

- 现状：44 件 `localizationStatus` 全部为 `temporary-unverified`。
- 当前替代：每个名称旁显示“暂译”标记，浮窗写“临时译名（待核实）”；值变为 `verified` 后标记自动消失，无需改界面。
- 验收：核实后图鉴、库存、合成表、浮窗的名称一致，且不再显示暂译标记。

### UR-U3-05 动态合法性与临时装备（P2，B5 已交付；界面接线见下，送审中）

- 需要：`previewCombine`、`previewEquip`、`readUnitEquipment` 运行实现（冻结类型见 `ui-contracts.ts`），与公开命令同一校验器。
- 当前状态：U3 静态图鉴与合成表只展示配方，文案注明“不代表当前可合成 / 可装备”。**既有 U1 行为**：策略面板“合成”按钮仍按静态配方匹配决定是否可点，最终以 `session.combine` 结果为准；本次未扩大该逻辑，也未使用 `planCombine/planEquip`。B5 交付后改为读 `previewCombine(...).allowed/reason`，装备槽改读 `previewEquip`。
- 验收：B5 交付后，拒绝组合（含 `same-item`、`unique-conflict`、`exclusive-slots`、`temporary-item`）在点击前显示后端原因，与命令拒绝一致。

- **U3 动态部分接线（`feat/m8-u3-dynamic`；B5 已经 PR #16 合入基线 `5bd7968`，本分支已合并该基线后送审）**：合成按钮改读 `previewCombine`（移除静态配方匹配）；选中物品后各槽读 `previewEquip` 标出可装备/拒绝原因/冲突装备，三槽装备显示“将占用槽 1、2、3”；槽位与单位详情读 `readUnitEquipment`，独占预留槽与临时子件只读显示（来源父装备、有效轮次、不可操作）；拖到棋盘单位时取第一个预览允许的槽。拒绝文案集中在 `src/presentation/equipment-feedback.ts`，预览提示与 `BoardScene` 命令失败提示共用。（B5 合入后以 merge 方式同步基线，未 rebase。）

### UR-U3-06 约定编号的可读说明（P3，文档/内容）

- 现状：浮窗原样显示 `conventionIds`（如 `A-01`、`GLOBAL-STAT-01`），玩家看不懂。
- 可选需要：提供编号 → 简短中文说明或文档锚点的只读映射；不提供时界面保持原样显示。

### UR-U3-07 U3 静态部分桌面 Chromium 验证（P1，Codex 编写；Claude 不改 tests/、CI）

视口 1440×1000，生产 preview；数据全部来自 `readItemCatalog()`。

| 场景 | 输入 | 预期 |
| --- | --- | --- |
| 图鉴数量 | 展开“装备图鉴与合成表” | 44 个图鉴项；筛选按钮计数：全部 44、组件 8、成装 36、唯一 6、占多槽 1、暂定 2 |
| 筛选 | 依次点各筛选 | 组件 8 件；成装 36 件；唯一为 blue-buff、edge-of-night、last-whisper、morellonomicon、quicksilver、sunfire-cape；占多槽仅 thiefs-gloves；暂定为 red-buff、runaans-hurricane |
| 合成表 | 8×8 表 | 64 个非空交点、36 个不同结果；每个交点结果与目录 `recipe` 一致（无序、允许同种）；暂定结果交点带标记 |
| 说明浮窗 | 悬停与键盘聚焦任一图鉴项、合成表交点、库存物品、已装备槽 | 浮窗效果条目与 `effectDescriptions` 逐条完全相同，顺序不变；显示唯一/占槽声明、规则依据、暂译状态；Escape、移出、失焦后隐藏 |
| 暂定与占槽 | 红霸符、卢安娜的飓风、窃贼手套 | 前两者显示“暂定”及“批准暂行，待历史核验”；窃贼手套显示“占3槽”“占用装备槽 3” |
| 缺图占位 | 28 件无清单图标；另对已有图标做受控 404 | 显示类型色块 + 名称前两字，无破图；404 后回退为同一占位 |
| 快捷键隔离 | 在图鉴搜索框输入 d、f、e | 金币、商店代次、单位不变 |
| 只读 | 展开、筛选、搜索、悬停前后 | `MatchState` 序列化完全相同，无新事件 |

### UR-U3-08 U3 动态部分桌面 Chromium 验证（P1，Codex 编写；Claude 不改 tests/、CI）

视口 1440×1000。状态由公开 `createMatch` + 选择命令得到；与 `tests/m8-b5-*.test.ts` 相同，可把永久装备实例放入库存作为夹具，此后只走 `equipItem`/`combineItems` 公开命令。说明：`same-item` 与 `temporary-item` 无法通过正常点击产生（再次点击同一物品会取消选中；临时件不在库存、槽位不可操作），这两项按领域码 + 面板文案核对。

| 场景 | 输入 | 预期 |
| --- | --- | --- |
| unique-conflict | 蓝霸符装到 u1；再选第二件蓝霸符 | u1 各槽 `data-preview=unique-conflict`，已装蓝霸符的槽标冲突；行提示含唯一冲突文案与“冲突：蓝霸符”；其他单位为 allowed；点击 u1 槽命令同样拒绝 `unique-conflict`，状态与提示文案一致 |
| exclusive-slots（TG 加入） | u1 有蓝霸符；选窃贼手套 | u1 三槽均 `exclusive-slots`，蓝霸符标冲突；空单位提示“可装备 · 将占用槽 1、2、3” |
| TG 穿戴与临时件 | 窃贼手套点 u2 的槽 3 | 命令成功，本体规范到槽 1；槽 2/3 显示“临时 · 名称”、虚线、禁用；行内与单位详情各 2 行“来自 窃贼手套 · 槽 N · 仅 2-1 本轮有效 · 不可操作” |
| exclusive-slots（已有 TG） | u2 持窃贼手套；选普通装备 | u2 槽 1 为 `exclusive-slots`，窃贼手套标冲突，提示含“冲突：窃贼手套” |
| temporary-item | 领域：`previewEquip/previewCombine/equipItem` 传临时 ID | 三者均 `temporary-item`；状态序列化不变；文案取共用表 |
| same-item | 领域：`previewCombine/combineItems(a,a)`；面板选中 `[a,a]` | 领域均 `same-item`；面板 `combine-preview` 显示共用文案，合成按钮禁用 |
| invalid-recipe / 允许合成 | 选大剑+成装；再选两把大剑 | 前者 `invalid-recipe` 提示；后者按钮“合成 死亡之刃”可点，命令成功 |
| 拖放到棋盘单位 | 把物品拖到持 TG 的单位 / 普通单位 | 前者显示 `exclusive-slots` 文案、不发命令；后者装到第一个预览允许的槽 |
| 只读 | 每次选中、预览、渲染前后 | `MatchState` 序列化完全相同，RNG 与 `equipmentState` 不变 |

**待 Codex 补测（拖放到棋盘单位）**：U3 动态部分的拖放路径（`strategy-panel.ts` 释放物品时未命中装备槽、落在棋盘单位上）只在代码中改为读 `previewEquip`，Claude 本地未做真实指针拖放验证。请在桌面 Chromium（1440×1000）用原生指针拖放补测：
- 拖到持窃贼手套的我方单位：不发出装备命令，状态行显示共用表的 `exclusive-slots` 文案，`MatchState` 不变。
- 拖到槽 1 已有装备的普通我方单位：命令装到第一个预览允许的槽（槽 2），成功事件 `itemEquipped.slot=1`。
- 拖到三槽已满的单位：状态行“该单位的 3 个装备槽已满”，不发命令。
- 拖到敌方单位：显示 `unknown-unit` 共用文案，不发命令。（Codex 审计 `51704a0` P2：原棋盘命中只返回我方单位，敌方拖放显示的是“物品未装备”通用提示；已改为命中任意可见单位、由 `previewEquip` 判定 `unknown-unit`。）
- 把窃贼手套拖到空单位：装备成功且本体规范到槽 1，生成两件临时装备。

## B10 补充验证状态（2026-10-11，Codex 接替收尾）

用户已授权 Codex 接替 Claude 完成收尾与必要显示修复；本段更新历史请求的实际交付状态，不改变冻结领域合同。

- **UR-U3-07**：补交 `scripts/verify-m8-u3-static.cjs`，生产 preview 的真实应用、1440×1000，读取权威目录，并通过原生导入加载经生产校验器验证的公开操作存档。最终结果见 `M8_VALIDATION.md`，尚未独立签收。
- **UR-U4-07**：`8d87e74` 已交付 `scripts/verify-m8-u4-status.cjs`，`9fa8a63` 修正一次施加多项状态的日志遗漏。本轮复核得到 15 场景、181 检查通过；这是实际组件验证，不冒称整局浏览器路线。最终候选绑定见 `M8_VALIDATION.md`。
- U4 的旧 R2a 无 group 清理输入已被 B9 正式账本排除，改验真实清理事件都有 group；R3 父实例也已进入旧 shield 投影；状态筛选按 UR-U4-04 包含 activityChanged；盾的 absorbed/depleted 与 death-cleanup/combat-end 按各自正式原因显示。脚本 manifest 保留五项差异及依据，不通过手写非法事件恢复过时形状。


**B10 固定候选补充（2026-10-11）**：`d901b3f` 的 U3静态8组、U4 15场景/181检查、桌面27项通过。`b4ca11c` 新增 `verify-m8-br4-public.cjs` 并在干净工作区通过 dev/preview 10组公开存档验证，补足总计划BR4；原 `verify-m8-u3-dynamic` 的显式装备夹具仍按原范围保留。数据/显示技术检查通过不等于节点三签收：9v9压力超预算、硬件帧率、独立审查及用户试玩仍待完成。证据见 `M8_VALIDATION.md`。

## 八人联机界面数据需求（2026-10-12，流水线 C → 流水线 A/B）

界面已按 `src/rendering/online/protocol.ts` 的形状先行实现（开发期的 `fake-server.ts` 已在 C4 删除，现由浏览器内真房间 `server=local` 或 WebSocket `server=ws` 驱动）。T4/T5 的真实服务器与网络层需按同样形状下发；字段如有调整，请改 `protocol.ts` 并同步此表。

| 对象 | 字段 | 含义 | 用途 | 验收 |
| --- | --- | --- | --- | --- |
| `LobbyView` | `queue[{name,kind,me}]`、`capacity=8`、`joined`、`canStart`、`error` | 匹配队列 | 匹配页列表、开始按钮、第 9 人报错 | 第 9 人加入时 `error` 非空且队列不变 |
| `PlayerView.seats[]` | `seatId,name,kind(human/bot),hp,level,alive,rank,connected` | 八席公开信息 | 右侧血条栏、淘汰置灰、断线标记 | 每次 HP、等级、淘汰变化都推送一次 |
| `PlayerView.seats[].publicBoard` | `units[{definitionId,starLevel,cell,items[]}]`（C5）；`bench[{definitionId,starLevel,slot,items[]}]`、`looseItems[]`、`augments[]`、单位上的 `anomaly?`（2026-10-20，合同 §27） | 该席场上与备战席单位、所持与未装备的装备定义、单位异常、已有强化（公开信息） | 右栏头像、点击席位弹出的只读"对方阵容"面板、羁绊由界面用 `deriveTraits` 读（只算棋盘） | 不含连胜/连败、商店、金币、经验、待选强化、实例 id、随机流（`tests/server/projection.test.ts`、`net/server.test.ts`） |
| `PlayerView.phase` | `kind(preparation/choice/combat/settlement/ended)`、`round`、`roundName`、`endsAt`、`serverNow` | 房间阶段与截止 | 顶部阶段徽章与倒计时 | 倒计时以服务器时钟为准，客户端只做显示 |
| `PlayerView.opponentSeatId` | 本轮对手席位 | PvP 对手 | 血条栏高亮对手、准备阶段状态栏提示 | PvE/补给回合为 null |
| `PlayerView.ranking` | 终局后的完整名次 | 排名页 | 终局覆盖层 | 八席名次唯一完整 |
| 私有状态 | 本席字段白名单（见 `MULTIPLAYER_CONTRACT.md` §10.9） | 商店、棋盘、装备、选择 | 复用现有策略面板与棋盘渲染 | 不含他人商店与内部随机流 |
| 战斗帧 | `CombatFrame[{state,events}]` | 服务器算完的一场战斗 | 客户端按 50 ms/tick 播放 | 完整事件账本，不因播放截断 |
| 命令 | `ClientCommand`（买卖、刷新、经验、站位、装备、选择） | 意图 | 现有按钮直接发送 | 失败返回原因，不改本地状态 |

界面侧明确不做的事：不调用 `startMatchCombat`/`nextRound`/`stepMatch`（联机模式下 `RemoteSession.start/continue` 直接拒绝），不本地算金币和胜负。

需要服务器定稿、界面只显示结果的规则：选择节点超时的代选规则；准备截止时阵容非法的处理；断线接管的提示文案来源（`connected=false` 即显示"断线"）。假服务器对这些只做了标注的临时兜底。

真网络接入（T8）时的已知改动点：`GameClient.send` 已在 C4 改为"待确认"回执再确认（WebSocket），本地房间仍同步返回。

## src/server 需要规则侧提供的接口（B1，2026-10-12，Claude 流水线 B）

`src/server/room/` 已交付房间状态机骨架（八席、阶段与截止、配对、一次性结算、排名、白名单投影；见 `docs/CLAUDE_WORK_ORDERS.md` 派工单 B1）。房间只编排、不算规则：每席各持一份 `MatchState`，只经 `src/simulation/match.ts` 公开命令变化；战斗经 `BattleResolver` 接口注入，当前为占位实现（每席跑自己的单人 `startMatchCombat` + `stepMatch`）。接真实双方战斗与共享卡池前，需要规则侧提供下列接口。编号 SR-B1-xx。

### SR-B1-01 双方战斗输入与结果类型（P0，T2/T3）

- 需要：`resolvePvpBattle(input): BattleResult` 或同等公开函数。输入为两席冻结快照（合法上场单位、装备、强化、异常、持久成长）、规则版本、独立战斗随机输入；输出含 `battleId`、胜负/平局、双方存活者、双方成长增量、完整事件账本、以及**双方各自的未截断伤害整数**。
- 用途：替换 `src/server/room/battle-resolver.ts` 的占位实现。房间侧已冻结的字段见 `src/server/room/types.ts` 的 `BattleInput`/`BattleResult`/`BattleSeatOutcome`：房间只消费 `damage`（未截断、≥0 整数）和 `state`，自己不算伤害。
- 镜像：奇数存活者时 `BattleInput.mirrorOf` 携带来源席位快照（来源不是参战方）；规则侧需保证镜像一方不被扣血、不发收入、不成长。
- 验收：相同冻结输入重跑得到完全相同的结果；输入中席位/单位身份不碰撞。

**T2 回应（Codex）**：已交付真实双方战斗与双方非负、未截断伤害提案；新增冻结 `mirrorOfSeatId` 和 `settlementEligible`，镜像方 damage=0、growth=[] 且不可提交收入/经验/奖励。接口映射、失败与测试见 [合同 §10.8](MULTIPLAYER_CONTRACT.md#108-sr-b1-01双方伤害整数与镜像结算资格t2-已实现)。B1 由 Claude 按 §10.6 适配，实际写回由 T3 实现。

### SR-B1-02 房间结算收据：把外部 HP、收入、成长写回席位状态（P0，T3）

- 现状：单人 `settleRound` 在 `withCombat` 内部自动扣血、发收入并在 HP 归零或 6-7 时置 `gameOver`。房间的权威 HP 是 `SeatState.hp`，`MatchState.playerHp` 只能是派生镜像；占位实现靠"规则自己算的 `RoundResult.playerDamage`"保持两者相等，真实 PvP 后会分叉。
- 需要：一个公开命令（例如 `applyRoundSettlement(state, receipt)`），由房间在收齐全轮结果后调用，一次性提交该席的收入、经验、持久成长和由房间给定的 HP；带唯一 `settlementId`，重复提交返回原 state 与 `duplicate-settlement`，不重发任何奖励。要求 `startMatchCombat`/`stepMatch` 的 PvP 路径不再内部扣血、不再自行进入 `gameOver`。
- 验收：同一收据提交两次，第二次无事件、无资源变化；`roundResults` 恰好一条。

**T3 回应（Codex）**：已导出 enableMultiplayerSettlement/applyRoundSettlement，单席原子提交未截断伤害、收入、经验、成长和唯一收据，镜像拒绝、重复原样返回、HP0 为 eliminated；B4 全轮暂存/执行代次/统一发布按 [合同 §11](MULTIPLAYER_CONTRACT.md#11-t3单席原子结算整轮发布与超时规则) 接入。房间 HP 必须取规则返回值，不自行计算。

### SR-B1-03 加时与目录末轮（P1，T3/T4 合同）

- 现状：目录 6-7 为 `isFinal`，引擎在该轮结算时对所有席位置 `gameOver`（`outcome` 为 victory/defeat）。房间在 `planSettlement` 中以 `isFinal` 结束对局，按存活者 HP 定名次，代码注释标明"建议规则，待 T3/T4 合同定稿"。
- 需要：PvP 加时轮的公开入口（继续经济与商店、沿用末阶段基础伤害、不新增野怪/强化/奖励），以及 `nextRound` 在目录末尾之后的合法推进方式；平局扣血、同轮归零破同分规则定稿（房间当前实现：扣血后未截断 HP → 轮前 HP → 席位序号小者优先）。
- 验收：连续平局、双方空阵容、多席同轮归零都能在有限轮内产生唯一名次。

**T3 回应（Codex）**：合同 §11.5 已定稿加时 ID/ordinal、基础伤害12、经济/商店推进、双方平局扣血和未截断HP→轮前HP→固定座位序的唯一排名。目录外规则入口留 T4 接入前由规则线补齐，当前不冒称加时已可运行；在线目录末轮不再触发单人 gameOver。

### SR-B1-04 超时兜底的权威定义（P1）

- 现状：准备/选择截止时仍停在 `choice` 的席位，房间用 `src/server/room/choice-fallback.ts` 的占位策略（第一个选项 / 第一个己方单位）经公开命令兜底。
- 缺口：
  1. 异常节点且阵容为空时 `needsAnomalyRecruitment` 阻止开战（`missing-player`），兜底不能花钱买单位；当前占位 resolver 抛错导致整房 `fault` 结束。需要规则侧提供"超时放弃本轮/视为空阵容应战"的公开命令或等价规则。
  2. `nextRound` 因 `unsettled-round`（待领奖励、待选项或奖励容量不足）拒绝时，房间只能有限次延长结算截止，然后 `seat-stuck` 中断。需要超时自动领取/放弃奖励的公开命令，且不得重复发奖。
- 验收：任一席位在任何节点超时都能在不花费资源的前提下推进到下一轮。

**T3 回应（Codex，按用户确认）**：forfeitPendingChoice 默认选第一项（项目规则），只有无合法目标的空异常跳过；claimOrDiscardLoot 领取已赚且可容纳奖励，容量不足部分放弃。两者不付费、不重复发奖；签名、代次、失败和推进顺序见合同 §11.4。覆盖首项金币/组件、空异常、满备战区及领取事务回滚。

### SR-B1-05 淘汰归还卡池与共享卡池版本（P1，TP）

- 现状：`RoomState.poolRevision` 预留、恒为 0；商店各自独立。
- 需要：淘汰席位归还卡池的事务钩子（在本轮排名计算后、下一轮商店生成前调用），以及买/刷/卖/升星/奖励与席位资产同一事务提交的公开入口；失败时库存、占用、金币、商店、随机流均不变。
- 验收：八席全程卡池守恒；淘汰后该席占用全部归还。

**TP 回应（Codex）**：已交付池与席位同事务入口、淘汰唯一归还钩子和池 revision，详见合同 §12.1–12.5；开场与奖励统一占池，缺货按用户决定补英雄一星价格金币，八席跨轮守恒覆盖。B5 需将买/刷/锁/卖、发奖与跨轮切到 TP 包装，排名后、自然刷新前调用 releaseSeatOnElimination；src/server 接入由 Claude 完成。

### SR-B1-06 本席私有投影不含随机流（P2）

- 现状：`toPlayerView` 只输出白名单公开数据；本席私有状态（商店、待选项、棋盘）目前只能由适配器直接读 `SeatState.match`，而 `MatchState` 含 `rngState`、`battleSeedRngState`、`choiceRngState`、`rewardRngState`、未来掉落计划。
- 需要：规则侧提供"去随机流与未来计划"的本席私有视图构造函数（或列出可安全下发的字段清单），供 T5 网络层发送。

**T2 回应（Codex）**：已在 [合同 §10.9](MULTIPLAYER_CONTRACT.md#109-sr-b1-06本席私有视图下发白名单t2-清单t5-实现) 列出逐层字段白名单、当前已揭示奖励条件、随机流/未来计划禁发项及 T5 验收要求；覆盖初始、增量、重连与命令错误回执，不可透传完整 MatchState/CombatState。T2 只交清单，T5 由 Claude 实现投影；其余 SR-B1-02~05 归属与最小范围见合同 §10.10。

## 联机客户端消息说明（B2，2026-10-12，Claude 流水线 B → 流水线 C / C4）

`src/server/net/` 已交付单房间 WebSocket 服务器（`createGameServer`）、座位凭证、commandId 去重、单写队列与 Node 测试客户端（`src/server/net/test-client.ts`）。C4 的浏览器客户端只需实现下面的消息流；类型与校验函数在 `src/server/net/messages.ts`（无 ws / node 依赖，可直接在浏览器 import），共享视图类型在 `src/server/protocol.ts`。协议版本 `NET_PROTOCOL_VERSION = 1`。

### 消息一览

| 方向 | 消息 | 关键字段 | 说明 |
| --- | --- | --- | --- |
| C→S | `join` | `name` | 进队列。回执 `joined{seatId, token, connectionEpoch}`；`token` 只保存在本地（例如 `sessionStorage`），不显示、不上传到别处 |
| C→S | `leaveQueue` / `start` | — | 需已入队。`start` 由任一入队玩家发，机器人补满 8 席 |
| C→S | `resume` | `token` | 新连接凭 token 回到原席；回执 `resumed{seatId, roomId, connectionEpoch, lastCommandId}` |
| C→S | `command` | `roomId`、`round`、`seatRevision`、`command: ClientCommand` | `command` 内 buy/shopLock 带 `generation`，choose/anomaly 带 `choiceId+generation`，与规则一致 |
| S→C | `lobby` | `view: LobbyView` | 连接建立即发一次，队列变化再发 |
| S→C | `view` | `roomId`、`roomRevision`、`view: PlayerView` | 房间任何变化都发（白名单公开数据） |
| S→C | `state` | `roomId`、`round`、`seatRevision`、`state: MatchState` | 只发本席私有状态；`seatRevision` 是下一条 `command` 必须带的值 |
| S→C | `combat` | `roomId`、`round`、`battleId`、`frames: CombatFrame[]`，可选 `part`、`total` | 本席本轮战斗帧，每轮一场。整条超过 1 MiB 时按 200 帧一包连续发送，`part` 为 1..`total`，客户端按序拼回（C4） |
| S→C | `receipt` | `commandId`、`ok`、`result` 或 `reason`+`detail` | 每条客户端消息恰好一条回执 |
| S→C | `error` | `code`、`message`、`commandId\|null` | 无法对应到回执的连接级错误 |

每条客户端消息带 `protocolVersion` 与 `commandId`（正整数，本席本局内唯一，建议递增计数器）。服务器严格拒绝未知字段（`seatId`、`gold`、`hp` 之类一律 `invalid-message`），操作者只取自连接绑定的席位。

### 待确认回执（界面要显示"待确认"）

1. 发出 `command` 后该操作处于"待确认"，界面不得先改本地金币或商店；收到同 `commandId` 的 `receipt` 才结束。
2. `ok:true` 的 `applied` 回执带 `seatRevision`、`roomRevision`、`events`；紧接着服务器推送新的 `state`（同 `seatRevision`）和 `view`。
3. `ok:false` 时本地状态不变，`reason` 为下表错误码或规则失败原因（`insufficient-gold`、`stale-shop`、`wrong-phase` 等，见 `MatchFailure`）。
4. 丢回执重试：用**相同 `commandId` 和完全相同内容**（含同一个 `seatRevision`）重发，得到原回执；内容不同会被 `commandId-conflict` 拒绝。
5. 顺序发送可以流水线化：第 n 条命令带 `seatRevision = 基准 + n - 1`（假设前面全部成功）；任何一条失败后，后续会收到 `seat-revision-mismatch`，客户端等最新 `state` 后重发。

### 重连流程

1. 连接断开时界面显示"连接中断"，保留最后一份 `view`/`state`；房间侧只把该席 `connected=false`，资产、配对、名次不动。
2. 新建 WebSocket，发 `resume{token}`。成功后依次收到：`receipt(resumed)` → `view` → `state` →（若本轮已有战斗）`combat`，这是快照；之后才是增量推送。客户端把本地 `commandId` 计数器调到 `lastCommandId + 1` 以上。
3. 旧连接若还活着会收到 `error{code:'session-superseded'}`，随后被服务器关闭（关闭码 4001）；旧连接再发命令只会得到 `not-authenticated`。
4. 排队阶段断线视为离队（token 失效，需重新 `join`）；开局后断线可随时重连直到对局结束。服务器进程重启后旧 token 一律 `invalid-token`（首版不做跨进程恢复）。

### 错误码表

| 码 | 出现于 | 含义 / 界面处理 |
| --- | --- | --- |
| `invalid-json`、`invalid-message` | error / receipt | 消息格式或字段非法（含多余字段）；属客户端 bug，记日志 |
| `unsupported-protocol` | receipt | `protocolVersion` 不是 1；提示刷新页面 |
| `message-too-large`（关闭码 1009） | 连接关闭 | 单条消息超 16 KiB |
| `rate-limited` | error | 每连接每秒超过 60 条；丢弃本条，稍后重试 |
| `not-authenticated` | receipt | 连接未绑定席位（未 join / 已被取代）；回到匹配页或重连 |
| `already-joined`、`not-queued` | receipt | 重复入队 / 未入队就 leave、start |
| `full`、`in-progress`、`empty` | receipt | 队列满 8 人 / 对局进行中 / 空队列开始 |
| `invalid-token` | receipt | 凭证无效或已失效；回到匹配页 |
| `session-superseded` | error | 本连接被新连接取代；停止发送 |
| `commandId-conflict` | receipt | 同 id 不同内容；客户端 bug |
| `resync-required` | receipt | id 早于最近 256 条保留窗口；等最新 `state` 后用新 id 重发 |
| `no-room`、`wrong-room` | receipt | 本席不在进行中的房间 / `roomId` 不符 |
| `stale-round`、`seat-revision-mismatch` | receipt | 命令针对旧轮次 / 旧席位版本；等最新 `view`/`state` 后重发 |
| `unknown-seat`、`seat-eliminated`、`wrong-phase` 及其余 `MatchFailure` | receipt | 房间或规则拒绝，文案沿用现有离线映射 |

### 需要用户决定 / Codex 配合的事项

- **战斗帧体积（P0，影响 C4 是否可用）**：`CombatFrame.state` 是每 tick 一份完整 `MatchState`。真实测量（`tests/server/net/server.test.ts` 整局用例）：一局空闲对局下发给单席约 105 MB，单条 `combat` 最大 13.5 MB，17 场战斗共 2873 帧。局域网可跑通，公网不可接受。建议：由规则侧（SR-B1-07）提供"战斗回放投影"——首帧完整状态 + 每 tick 只含 `combat` 子状态或事件账本，客户端按 `LedgerCombatEvent` 播放；或至少去掉帧内与战斗无关的字段。决定前 C4 不要按当前帧格式上线。
- **C4 实测（压缩已开启）**：服务器开启 `permessage-deflate`（阈值 1 KiB，保留上下文）。整局空闲对局下发给单席：未压缩 103.9 MB → 线路上 7.3 MB；最大一场战斗 12.5 MB（拆成 3 包，最大单包 8.8 MB）。压缩后局域网与普通宽带可用，但浏览器仍要解析完整 JSON，SR-B1-07 的回放投影仍有必要。
- **SR-B1-06 仍未实现**：`state` 消息目前是完整 `MatchState`（含本席随机流）。B2 按工单只发本席自己的状态；去随机流的私有投影仍需规则侧提供。
- 启动方式：`npm run serve:game`（esbuild 打包到 `dist-server/game/main.mjs`，环境变量 `PORT`、`CAT_HOST`、`CAT_SEED`、`CAT_PREP_SEC`、`CAT_CHOICE_SEC`、`CAT_SETTLE_SEC`、`CAT_QUEUE_TIMEOUT_SEC`）；`npm run client:game -- ws://127.0.0.1:8787 名字` 跑一局空闲对局。TLS 由反向代理终止（T9）。

## src/server 接入 T2 后的规则侧缺口（B3，2026-10-12，Claude 流水线 B）

B3 已按合同 §10.6 让房间的 PvP 走 `snapshotForBattle → compileBattle → resolveTwoSidedBattle → proposeSettlement`（`src/server/room/two-sided-resolver.ts`），提案暂存在 `RoomState.pendingProposals`，房间进入 `awaiting-settlement` 后以 `settlement-unavailable` 中断；默认 `pvpMode` 仍为 `placeholder`。以下是接入时发现的缺口，编号续 SR-B3-xx。

### SR-B3-01 结算提交入口与房间阶段推进（P0，T3）

- 现状：`Room.parkProposals` 已把每场的 `settlementEligible=true` 且属于真实参战席位的 `SideProposal` 按 battleId 暂存（含 `round/roundId/roomRevision/participants`）；镜像提案不进入队列。房间不扣血、不发收入、不进入下一轮。
- 需要：合同 §10.10 的 `applyRoundSettlement(state, receipt)` 或等价事务命令。房间侧期望的调用方式：收齐全轮 `pendingProposals` 后，对每个真实席位用其提案构造唯一收据提交一次，由同一提交结果产出 HP/淘汰/`roundResults` 一条，再回到现有 `settlement → nextRound` 流程。请在合同里写明：收据字段、`settlementId` 的构成（房间建议 `${roomId}:round-${round}:${seatId}`）、拒绝枚举（重复、过期代次、镜像、不完整整轮）。
- 验收：同一收据提交两次第二次无事件、无资源变化；提交后 `MatchState.playerHp` 与 `SeatState.hp` 一致。

### SR-B3-02 战斗帧的逐 tick 账本入口（P2，T2 补充）

- 现状：`resolveTwoSidedBattle` 只返回 `initial/terminal/events`；逐 tick 播放帧由房间用 `startTwoSidedCombatWithEvents + stepCombat` 重放同一冻结输入生成，再把 `battle.events` 按 `tick` 分配到各帧，并校验终态与事件总数一致（不一致即 `frame-divergence` 中断）。这意味着每场战斗实际执行两次（一次结算、一次取帧）。
- 需要（可选）：一个同时返回逐 tick 状态序列与结果的入口，或说明 `stepCombat` 的事件与 `toLedgerEvents` 的对应关系可被服务器直接使用，以避免二次执行。若规则侧认为二次执行可接受，请在合同注明，房间保持现状。

### SR-B3-03 第二视角的战斗投影（P2，T5 前确认）

- 现状：双方战斗只运行一次，A 视角为 `player`；B 席位的帧由 `src/server/room/projection.ts` 的 `mirrorCombatFrame` 做纯显示镜像（队伍互换、`row = rows - 1 - row`、结果互换、`movement`/`cast.completionCell` 坐标翻转）。它不重算任何数值。
- 需要：T5 做帧 DTO（合同 §10.9）时确认这一镜像规则就是客户端应看到的视角，或由规则侧给出带坐标字段的事件完整清单，避免遗漏其他含 `HexCell` 的事件字段。


**TP 对 SR-B3-02 的回应（Codex）**：选择保留二次纯执行取帧；同一冻结输入、规则/内容版本和足够预算保证相同终态及完整有序事件，不能重复提交结算。toLedgerEvents 不转换字段，保留 tick0 和 eventSeq 次序；详见合同 §12.6。

**TP 对 SR-B3-03 的回应（Codex）**：LedgerCombatEvent 坐标清单为 movement.from、movement.to、cast.receipt.completionCell；单位快照另有 cell/startingCell。B 视角只镜像 DTO，行翻转、列不变，互换队伍/胜负，保持标识与事件顺序；详见合同 §12.6。未修改 src/server 的投影实现。

## src/server 接入 T3 后的规则侧缺口（B4，2026-10-12，Claude 流水线 B）

B4 已按合同 §11.3 让房间收齐全轮后在临时 map 上逐席 `applyRoundSettlement`，全部成功才一次发布（`Room.planSettlement` / `commitSettlement`），`SeatState.hp` 取返回 `state.playerHp`；超时按 §11.4 用 `forfeitPendingChoice` / `claimOrDiscardLoot`（`choice-fallback.ts` 已删除）；同轮归零按 §11.5 键排名；`pvpMode` 默认 `two-sided`。编号续 SR-B4-xx。

### SR-B4-01 目录末轮后的加时推进入口（P0，T4 依赖）

- 现状：合同 §11.5 约定由规则线补 `advanceMultiplayerRound(state, expectedRound): MultiplayerCommandResult`（目录内委托 `nextRound`，6-7 后生成 `overtime-N` 准备态，沿用第 6 阶段基础伤害 12），`src/server-entry` 尚未导出；当前 `nextRound` 在目录末尾返回 `wrong-phase`。房间在 6-7 结算发布后若仍有 ≥2 席存活，以 `fault: { kind: 'overtime-unavailable', round, survivors }` 明确中断，不自造名次（`Room.commitPending`）。空闲八席对局在 seed 42 下于 6-5 决出唯一名次，不触发此中断。
- 需要：导出该入口，并保证 T2 `snapshotForBattle`/`compileBattle` 与 T3 `applyRoundSettlement` 接受 `overtime-N` 轮次标识（`roundId` 不在目录内时 `getCatalogRoundById` 的行为、基础伤害 12、经济与经验照常）。房间侧接入点只有一处：`Room.advanceRound` 把 `nextRound` 换成该入口，`Room.enterRound` 用返回状态的 `m8.round` 读取 `ordinal/roundId/kind`。
- 验收：连续平局、双方空阵容、镜像与同轮多人归零在有限加时内产生唯一名次（§11.5 "有限终局"）。

### SR-B4-02 PvE 结果的房间侧一致性校验（P2，说明）

- 现状：PvE/补给回合仍由各席单人公共命令结算（`startMatchCombat`/`stepMatch`），房间只做 §11.3 第 4 条的原子发布，并校验规则返回的 `playerHp === max(0, hpBefore - roundResults.playerDamage)`，不一致即 `invalid-results` 整轮丢弃。测试用的占位结果（`state` 未结算）才由房间自行扣血（`pvpMode: 'placeholder'`）。
- 需要（可选）：若规则侧希望 PvE 也走收据提交（统一入口），请在合同注明；否则维持现状。

## T5R 规则侧交付（Codex，2026-10-12）

- **SR-B4-01（P0）**：已导出 `advanceMultiplayerRound`，贯通 T2/T3 加时 ID、伤害12和既有经济，`nextSharedRound` 支持全席加时释放/轮换刷新；合同 §11.5 给出签名、失败枚举及 B4/B5 接入。B4 除替换 Room.advanceRound 调用外，还须解除 Room.commitPending 的 overtime-unavailable 依赖中断（bc35bac 当前仍存在）。规则不替调度器判断剩余席位或排全局名次。
- **SR-B1-06（P0）**：已导出 `toPrivateSeatView`，逐层白名单，保持 MatchState 原字段名/嵌套，去全部随机流、未来计划、来源账本及战斗输入。合同 §14.1 列出安全复用的显示选择器和无法用占位保真的选择器。B7 尚须替换所有网络 state 发布路径。
- **SR-B1-07（P1）**：已导出 `toCombatReplay` / `toCombatViewState` / `applyCombatReplayTick`，每20 tick关键帧＋精简动画事件＋权威单位显示差分，逐 tick/终态均与权威视图相同；白名单、B视角坐标、失败与体积测量见 §14.2–14.3。仍保留完整服务器账本与一次纯重执行，不重复结算；B7 替换旧逐 tick 完整帧输出。

## src/server 接入共享卡池后的规则侧缺口（B5，2026-10-12，Claude 流水线 B）

B5 已按合同 §12 让房间开局建池（`createSharedPool` → 八席按 seatIndex `initializeSharedSeat` → `refreshSharedShops(…, 1)` → 一次发布），买/卖/刷/锁走池事务，选择、超时代选、领奖与 PvE 战斗（startCombat/step）走 `runSharedMatchCommand`，跨轮用 `nextSharedRound`，淘汰在排名后、下一轮自然刷新前调用 `releaseSeatOnElimination`。编号续 SR-B5-xx。

### SR-B5-01 加时推进的共享池批量入口（P1，与 SR-B4-01 同批）

- 现状：`nextSharedRound` 内部委托 `nextRound`，目录末轮后返回失败；房间在 6-7 后仍有 ≥2 席存活时照旧以 `overtime-unavailable` 明确中断（B4 行为不变）。
- 需要：交付 SR-B4-01 的 `advanceMultiplayerRound` 时，同时给接入共享池的席位一个批量入口（例如 `nextSharedRound` 接受加时，或新增 `advanceSharedMultiplayerRound(pool, states, expectedRound): SharedPoolBatchResult`），保证加时轮同样先归还未锁店、再按轮换顺序生成共享店（§11.5 第二条"TP 后仍受共享池约束"）。房间侧接入点仍只有 `Room.advanceRound` 一处。
- 验收：加时轮的商店来自共享池，`assertSharedPoolConservation` 在加时前后成立。

## src/server 接入 T5R 后的规则侧缺口（B7，2026-10-12，Claude 流水线 B）

B7 已把 `Room.advanceRound` 换成 `advanceMultiplayerRound` 并删除 `overtime-unavailable` 中断；网络与本地所有 `state` 改送 `toPrivateSeatView`（客户端经 `src/rendering/online/seat-view-adapter.ts` 填占位后显示）；每场战斗按结果对象缓存一份 `toCombatReplay`，B 视角镜像后以 `replay` 消息下发，旧 `combat` 帧默认保留（`combatTransport: 'both'`）。编号续 SR-B7-xx。

### SR-B7-01 PvE 回放输入：首步补发的 tick0 事件导致 `replay-divergence`（P0，C6 切换 `replay` 前必须修）

- 现状：按 §14.2 对 PvE 传 `startMatchCombat` 后的 CombatState、`stepMatch` 末帧和逐帧完整 Ledger 事件。seed 42 空闲八席整局中，除 **3-7（wolves-v1）** 外所有 PvE/PvP 回放都生成成功；3-7 八席全部抛 `RangeError('replay-divergence')`。原因：该遭遇的 5 条 tick0 事件（`movement`，eventSeq 0–4）不是 `startMatchCombat` 返回的，而是第一次 `stepMatch`/`stepCombat` 从 tick0 状态推进时才发出（tick 仍记为 0）。`toCombatReplay` 内部重执行的 `generated` 包含这 5 条，却与 `battle.events.filter(tick > 0)` 比较，必然不等。逐帧 `stepCombat` 与房间帧逐 tick 完全一致，终态视图也一致，只是这条比较的分界不对。
- 需要：规则侧修正 `toCombatReplay` 的 tick0 处理（例如重执行时把首步产生的 tick0 事件并入 `ticks[0]`，或比较时用全部事件），或在合同里给出 PvE 的正确输入构造方式。两边路径（`startTwoSidedCombatWithEvents` 是否也可能把 tick0 事件留到首步）请一并确认。
- 房间侧现状：生成失败只记日志（服务器故障，不伪造结果），该席仍收旧 `combat` 帧；若默认改为 `replay`，3-7 将没有战斗播放。
- 验收：seed 42 空闲整局所有回合 `toCombatReplay` 成功，且回放折叠结果等于 terminal。

### SR-B7-02 私有投影下的显示缺口（P2，界面体验）

- 现状：`toPrivateSeatView` 去掉了敌方单位与 `m8.encounterPlan`、`m8.loot`，`roundResults` 也去掉了 `interestBasis`、`xpRequested`、`streakBefore/After`、`roundKind`。联机界面因此：PvE 准备阶段看不到野怪站位与预览；掉落只能靠事件；收入明细省略"利息基数"和"经验请求"。
- 需要（可选）：按 §10.9/§14.1 另给已揭示的遭遇预览摘要（敌方定义、星级、站位）与已揭示掉落摘要的白名单字段；`roundResults` 是否可加回 `interestBasis`/`xpRequested`。界面只显示，不用于规则。

## src/server 连局资源释放与准备 RTT（B8，2026-10-12，Claude 流水线 B）

B8 已让房间在新局开始时 `dispose()` 上一局（定时器、监听、冻结输入、在算的战斗、暂存结算），结束时只留战斗结果去掉逐 tick 帧；准备截止后的战斗改成按时钟切片计算（`RoomOptions.sliceTicks`，服务器默认 100 tick 一片，每片是一个写队列任务），回放在单独一片预先生成，战斗帧每帧只序列化一次。堆快照（强制 GC 后、每局结束时）显示：B8 前已结束的房间多留约 12 MiB 逐 tick 帧（约 9.5 万字符串、5.9 万对象），B8 后释放；两版连续两局之间都没有对象增长（只有 JIT 代码），即旧房间在下一局开始时已被释放，RSS 的上升主要来自 GC 时机与 V8 堆预留。编号续 SR-B8-xx。

### SR-B8-01 压测脚本与 B5/B8 的接口对齐（P1，scripts/loadtest-room.cjs）

- 现状：worker 里的 `TwoSidedBattleResolver.prototype.resolveBattle=function(input){…resolve.call(this,input)…}` 丢掉了 B5 加的第二个参数 `pool`，当前 `multiplayer` 上运行即在第 1 回合 `resolver-error … invalid-pool` 退出 1。B8 后房间走 `startBattle(input, pool)` 返回的分片任务（`advance(maxTicks)`），`resolveBattle` 不再被房间调用，`freezeAndResolve` 只剩冻结部分。
- 需要：包装器转发全部参数；战斗计算样本改为包 `startBattle` 返回任务的每次 `advance`（累计 wall/CPU，记最大单片耗时）；结束 RSS 取样前可选 `--expose-gc` 下先 `gc()`（不 GC 时同一服务器的 heapUsed 在 24–488 MiB 间摆动，RSS 曲线主要反映 GC 时机）。B8 的前后数据用的是只改这三处的临时副本，见 PR 说明。
- 验收：`node scripts/loadtest-room.cjs --seats 2 --rounds 3` 在 `multiplayer` 上退出 0，battles 样本非空。

### SR-B8-02 一场战斗被完整执行三次，单次规则调用决定准备 RTT 下限（P1，T2/T5R 性能）

- 现状：每场 PvP 依次跑 `resolveTwoSidedBattle`（权威结果）、服务器为旧 `combat` 帧用 `startTwoSidedCombatWithEvents`+`stepCombat` 重放、`toCombatReplay` 内部再重执行一次；PvE 同样由 `toCombatReplay` 重跑。服务器已把后两者切片或单独成片，但 `resolveTwoSidedBattle` 与 `toCombatReplay` 各自是不可分的单次调用，后期回合单次 300–650 ms，是 B8 后 p99 的主要来源。C6 切到 `replay` 后服务器的帧重放会去掉。
- 需要（二选一或都要）：`resolveTwoSidedBattle` 可选直接产出 `CombatReplay`（权威执行时顺带记录，免第三次执行）；或给出可分步的入口，例如 `startTwoSidedBattle(input) → { advance(maxTicks): BattleResult | null }`、`toCombatReplay` 同理，结果与一次性调用逐字节相同。
- 验收：同一输入下分步与一次性结果相等；单次调用不超过约 50 ms。

### SR-B8-03 PvE 每 tick 的共享池守恒检查开销（P2，TP 性能）

- 现状：PvE 战斗按 §12.4 走 `runSharedMatchCommand(pool, state, { type: 'step' })`，每 tick 都做 `assertSharedPoolConservation` 与 `canonicalContent`；seed 42 空闲整局约 11 s PvE 计算里 4.6 s 在守恒检查。另 `advanceS13Tick` 内的 `structuredClone` 约占整局 14 s。
- 需要（可选）：战斗进行中（无奖励发放的 tick）不需要逐 tick 校验池的路径，或更便宜的增量守恒检查；`structuredClone` 是否可以换成结构共享。不影响规则结果。
## B7 接入反馈：T5R 规则侧修正（Codex）

- **SR-B7-01（P0）**：`toCombatReplay` 以 `initial.nextEventSeq` 区分已经发出的开局事件与 step 事件，不再用 `tick > 0`。3-7 狼群第一次 step 发出的5条 tick0 跳跃放入 tick1 回放记录，保留原 tick/eventSeq，避免遗漏和重复；显示差分仍对应每步权威状态。严格比较后续动画序列，缺失/篡改/重复均继续报 `replay-divergence`。没有改战斗引擎或账本归属，详见合同 §14.2。
- **SR-B7-02（P2）**：白名单新增本轮公开 PvE 的 `m8.preparation.{roundId,encounterId,enemies}`，enemies 的 id/definitionId/team/starLevel/location 逐层复制，同一组野怪进入 `preparation.units` 供棋盘和 `readEncounterPreview` 显示。须当前 PvE 轮 ID/遭遇 ID 匹配；PvP、补给、过期预览均不下发此子树。新增 `roundResults[].interestBasis`，直接使用历史已提交计息金币基数。保持 MatchState 递归结构子集，不公开 RNG、未来遭遇/掉落、PvP 固定模板或结算收据；字段与适配说明见合同 §10.9、§14.1。
- **验证覆盖**：目录全部33个战斗回合（38轮减5个补给轮）的逐 tick/终态回放；狼群8个种子的事件恰好一次及缺失/篡改/重复拒绝；全部8种 PvE 预览的站位/属性保真、递归哨兵与无引用共享、旧/未来预览屏蔽、利息基数。仅修改规则投影、测试和合同文档，未修改 src/server、界面或 golden。

验证环境：Node v22.23.3 / npm 10.9.9；75个 T5R/B7 用例（含 seed42 八席整局、全部战斗回放折叠与狼群八席检查）、全仓类型检查、五个 Node 入口校验（T1/T2/T3/TP/T5R）通过，T1 固定 state/event/RNG trace 哈希保持不变。

B7 显示接线提示：`toDisplayMatch` 当前把 m8.preparation 固定填为空敌军；应消费上述已公开 preparation 字段才能显示完整预览。此处只补规则投影，界面适配仍由 Claude 修改；xpRequested 与掉落摘要不在本次用户指定增补范围。

## C6 客户端改用紧凑回放后的需求（2026-10-12，Claude 流水线 C）

C6 已让离线与联机共用一条战斗渲染路径：棋盘、单位条、特效、飘字都读 `CombatViewState` 与 §14.2 白名单事件；服务器只发 `replay`，旧 `combat` 帧、分包与 `combatTransport`/`CAT_COMBAT_TRANSPORT` 已删除；PvE 结果只保留开战态、末态与完整账本（不再逐 tick 保存 MatchState）。SR-B7-02 的野怪预览与利息基数已在 `seat-view-adapter.ts` 接入。

### SR-C6-01 导出单条事件的显示投影（P2，去重）

- 现状：`combat-replay-view.ts` 的 `animationEvent` 未导出。离线模式需要把本地账本转成同一白名单事件，客户端在 `src/presentation/combat-display.ts` 的 `toDisplayEvent` 里逐字段复写了一份；`tests/server/replay-client.test.ts` 用真实 PvP/PvE 战斗断言两者完全相等，防止漂移。
- 需要：从 `src/server-entry`（或 `combat-replay-view.ts`）导出 `toCombatViewEvents(events: readonly LedgerCombatEvent[]): CombatViewEvent[]`（不含 unitUpdated，语义与回放中的动画事件逐条相同）。导出后客户端删除复写，只保留离线专用的 `effectTriggered` 标签。
- 验收：对任一可信战斗，`toCombatViewEvents(battle.events)` 等于 `toCombatReplay(battle).ticks` 展平后去掉 unitUpdated 的事件序列。

**SR-C6-01 交付回应（Codex）**：已导出 `toCombatViewEvents`（server-entry 与纯投影模块），返回更精确的 `CombatAnimationEvent[]`，是排除 unitUpdated 的 CombatViewEvent 子集。回放生成与客户端共用同一白名单；客户端仅保留离线 effectTriggered 标签，已删除其余逐字段复写。签名、输入输出、顺序/隐私约束和失败口径见合同 §14.2；目录33场战斗、PvP大小阵容、tick0终局及 C6 播放回归覆盖与回放展平序列相等。实际 Node v22.23.3：55个相关用例、typecheck、前端构建、build:server 与 T5R Node 入口校验通过；两个固定回放样例的 JSON/gzip 字节数保持不变。此项不涉及 SR-C6-02 的可选状态图标或护盾层扩展。

### SR-C6-02 联机状态图标与护盾层（P3，可选）

- 现状：§14.2 不承诺状态图标/持续时间；联机棋子不显示状态条，策略面板与统计面板隐藏护盾层、状态行、效果来源与按来源治疗（离线仍完整显示）。
- 需要（可选）：若要联机也显示，给 `CombatViewUnit` 增加只读白名单字段，例如 `statuses: {kind, harmful, expiresAtTick}[]` 与 `shieldLayers: {remaining, expiresAtTick}[]`；客户端只显示，不回填 runtime。
## src/server 接入 B6 后的合同缺口（B6，2026-10-12，Claude 流水线 B）

### SR-B6-01 合同 §13 补写机器人接管字段与拒绝原因（P1，只改文档）

B6（PR #51）已实现，合同文档尚未记载，请 Codex 在 `docs/MULTIPLAYER_CONTRACT.md` §13 补一节，不改代码：
- `SeatPublic.controller: 'human' | 'bot' | 'takeover'`：补位机器人恒为 `bot`；真人席断线超过 `CAT_TAKEOVER_SEC`（默认 60 s）后为 `takeover`，重连即刻回到 `human`。
- `resumed` 回执可选字段 `reclaimed?: true`：本次重连从机器人手里接回了席位；其余情况不出现该字段。
- `RoomFailure` 新增 `seat-controlled`（接管期间玩家命令被拒）与 `control-revoked`（旧控制代次的机器人步骤被拒，席位不变）。
- 策略调用约定：每席每轮预算 `BOT_MAX_STEPS`；`done` 只结束本次阶段进入，同一轮战后再出现选择窗口会再问一次；失败或预算用尽则整轮关闭，下一轮清零。
- 验收：合同描述与 `src/server/room/bot-driver.ts`、`src/server/net/messages.ts` 一致即可，不需要新测试。

## SR-B8-01～03 回应（Codex，d5df11e 基线）

- **SR-B8-01 已修正**：压测改包 `startBattle(...args)` 返回任务的每次 `advance(...args)`，保留 pool、接收者及返回/抛错语义，累计 wall/CPU 并记录最大 advance。另测 `Room.resolveSlice`，涵盖 B8 独立回放预热片及最后结算/发布，避免漏算服务器最长阻塞；`freezeAndResolve` 仅记冻结。重叠计数使用实际切片区间，去除片间等待与旧整批/逐 tick 帧口径。`--expose-gc` 时在结束采样前 GC，报告实际 GC 模式。验收数据见 `MULTIPLAYER_RELEASE_NOTES.md` §10。
- **SR-B8-02 仅评估**：C6 已删除旧帧重放；当前有接收者的 PvP 通常是权威执行一次 + `toCombatReplay` 重执行一次，双方共用回放缓存，B 侧镜像不重跑。默认100 tick 切片不会拆开这两个纯规则整场调用，`twoSidedSteps` 的一次 yield 也不保证两次 advance。建议先做可恢复的纯规则战斗/回放任务，保持同步 API 作为跑完任务的兼容包装；预计规则、合同与逐字节等价/时间预算测试 **2～3 个工程日**，Claude 调度接线另约 **0.5～1 日**。若追加权威执行时记录回放以消除重执行，再约 **1～2 日**，需让 PvE 同样复用记录、保留 tick0 归属、初末态/事件一致性校验和镜像缓存语义。50ms 应在约定目标机与最大合法阵容上验收；固定 tick 数无法保证 GC 或单 tick 本身不超时。这里只估量，不改接口或服务器。
- **SR-B8-03 仅评估**：无池资产变化 tick 的快速事务/增量守恒路径约 **2～3 个工程日**（含 TP/PvE/失败原子性回归）。不能简单按“尚未终局”跳检查：野怪死亡过程中可发奖，必须通过奖励策略与持有/待领取变化识别事务；保留输入合法性、席位版本、唯一奖励收据及失败时原 pool/state 不变。`transact` 的 canonicalContent 只在 state 引用不变时进入整池等价分支，守恒检查内部仍比较商店等字段，应先分开剖析。`structuredClone` 改结构共享是另一项 **4～7 个工程日**的高风险改造，需检查每类技能/状态的写入、旧状态不可变及事件/RNG/结果一致性；建议独立 PR，先做池路径再用剖析决定是否值得扩展。上述均为初步工程量，不承诺提速幅度，本 PR 不实施。

## 真机试玩反馈的规则侧需求（2026-10-12，用户确认）

### SR-C7-01 备战席与场上单位可互换（P1，规则改动，用户已拍板）

- 现状：`validateDeployment` 对已占用的目标格子返回 `occupied`，单机与联机都不能把单位拖到另一个单位身上。TFT 原版允许：棋盘↔备战席、备战席↔备战席、棋盘↔棋盘互换位置。
- 需要：`deploy`（或新增 `swap` 命令，由 Codex 决定并写进 `docs/MATCH_CONTRACT.md`）在目标被己方单位占用时交换两者位置；人口上限照常校验（备战席单位换上场时若超人口则拒绝 `deployment-cap`）；战斗阶段照旧拒绝。失败返回原 state。
- 联机：`ClientCommand` 若新增命令需同步 `src/server/protocol.ts`（Claude 接线），`applySeatCommand` 走原公开命令即可，不涉及共享池。
- 验收：新增用例覆盖三种互换与人口上限拒绝；T1 固定哈希若因命令集变化而变动，在合同里说明；不改 golden 以外的数值。

**SR-C7-01 规则侧回应（Codex）**：扩展现有 `deploy`，无需新增命令：`{type:'deploy',unitId,target:{kind:'board',cell:{col,row}}}` 或 `{type:'deploy',unitId,target:{kind:'bench',slot}}`。目标被另一己方单位占用时原子交换位置，三种区域组合均支持；按最终场上总人数校验，满人口换人可成功，超人口报现有 `population-cap`（本需求原文 `deployment-cap` 为描述用语，不新增别名）。战斗/选择/结算/终局仍拒绝，失败原 state 无事件/资源/RNG变更；ID、装备/成长绑定、共享池资产不变。完整签名、拒绝优先级、旧存档 digest 兼容和 T1 指纹差异见 `MATCH_CONTRACT.md` 的 SR-C7-01 一节。Claude 可按旧 deploy 形状接 UI 占位拖放与预览，无需 protocol 新增成员，勿拆成两次移动。本 PR 不改 src/server、界面或数值 golden。

SR-C7-01 验证：实际 Node v22.23.3 / npm 10.9.9；11文件182个部署/经济/序列化/共享池/机器人用例通过，再补1个互换后保存恢复与开战续算用例（最新互换文件15个用例全部通过，合计183个不同用例）。typecheck、T1 Node/browser 入口与指纹归一化校验通过。额外四构筑完整单人逐 tick 恢复套件运行约10分钟仍未结束，已中止，不计为通过；本次无完整单人回放套件通过声明。UI真机拖放待Claude接线后验收。
## C7 真机试玩修复后的需求（2026-10-12，Claude 流水线 C）

**已被 C9 替换（PR #61，2026-10-13 合入 multiplayer，7cdbf66）。** C7 原先通过 `src/rendering/online/round-gains.ts` 对比战前与当前本席状态，显示「本轮获得」；该差分及基线接线已删除。联机结算现在直接读取合同 §14.1 SR-C7-02 的 `privateView.revealedLoot`，与单机共用已揭示掉落行渲染；无字段时不显示掉落行，不推断 canContinue、pendingClaims，不发奖。原差分存在的战后重连无基线、掉落英雄立即升星漏列、战后扣费抵掉金币掉落三类失真不再依赖客户端快照差来处理。

### SR-C7-02 私有投影公开本轮已揭示掉落（P2，界面体验）

- 现状：`toPrivateSeatView` 不含 `m8.loot`，`readLootView` 在联机只能得到空账本；客户端不能区分「野怪掉落」和「补给/选择所得」，也无法显示「等待空位」（`pending-capacity`）这类状态。
- 需要：白名单增加**当前回合**已揭示掉落的摘要，例如 `m8.loot.revealed: { dropId, sourceUnitId, payload: { kind: 'unit'|'item'|'gold', definitionId?, quantity }, status: 'revealed'|'granted'|'pending-capacity', receiptId|null }[]`，只含已揭示条目，不含未来计划或随机流；或直接导出 `readLootView(state)` 的可序列化结果。字段名由 Codex 定并写入合同 §14.1。
- 用途：联机结算面板改用权威掉落收据（与单机 `lootPanelSection` 同一渲染），删除 `round-gains.ts` 的差分。
- 验收：seed 42 八席整局，每个 PvE 回合的摘要与该席 `readLootView` 的 `revealedDrops` 相同；PvP、补给和过期回合不下发。

**SR-C7-02 规则侧回应（Codex）**：`toPrivateSeatView` 新增可选顶层 `revealedLoot: {roundId, revealedDrops}`，精确字段/状态/省略条件见 `MULTIPLAYER_CONTRACT.md` §14.1。有效当前 PvE 的数组与 `readLootView(state).revealedDrops` 深相等，无已揭示掉落时为空数组；PvP、补给、轮次/遭遇不匹配或缺少本轮计划时省略整个字段。仅本轮直接掉落及实际领取后的组件选择，保持现有排序与四种可见状态；共享池补偿展示实际金币收据，满备战区展示 pending-capacity，超时放弃后省略。未揭示/未来计划、随机流、未领取选择兜底、单人 canContinue 等控制提示不下发。所有嵌套字段复制后冻结，不发奖、不改权威状态；不回填 m8.loot。

Claude 接线直接读 `privateView.revealedLoot?.revealedDrops`，可据此替换 `round-gains.ts` 差分，不需战前基线，也不需将私有 DTO 强转 MatchState 再调用 readLootView。现有服务器 `toSeatPrivateView` 自动透传本字段，无需修改 src/server；本 PR 不改界面、服务器或 golden。

SR-C7-02 验证：实际 Node v22.23.3 / npm 10.9.9；8 文件 110 个不同用例通过（最终补测的 2 文件 25 用例全部通过），typecheck、T1 与 T5R Node 入口校验通过，现有 T1 状态/事件/RNG 指纹保持不变。seed 42 八席闲置对局从开局跑到自然终局，逐次检查本席状态的 JSON 投影；实际经过的每个 PvE 轮（至 5-7）所有参战席在准备及结算后均与 readLootView 相等，八席均有真实已揭示奖励，PvP/补给无摘要。淘汰席不再进入后续回合；另用目录全部 8 个 PvE 轮的投影夹具覆盖 6-7，并覆盖共享池缺货补偿、容量等待/放弃、未知字段与未来计划隔离。本测试没有启用机器人调度，不代替真机 UI 或网络压测。

### SR-C8-01：swap-checks 第 5 步在 15 秒准备期内可能被阶段切换打断，建议 Claude 在断言前核对 state.phase 仍为 preparation，或把 CAT_PREP_SEC 提到 25

- 状态：**已处理**；2026-10-13 Codex 交叉验货 PR #63（`a37b4f0348ab4245cc1abf796d0ccfa594f852a4`）通过，已合入 `multiplayer`（`9c13d7a496efb02b792f0c2bb201067e315a99f6`）。此项属于 C8 测试时序，与 C9 无关；以下保留原复现记录。
- 处理：`swap-checks.mjs` 在每次拖动和断言前检查同一回合的 `preparation`，等待失败时也核对阶段，记录 roundId/phase/累计毫秒/ISO 时间；阶段变化抛出前置条件失败。`c7-playtest.mjs` 仅将测试服务器的 `CAT_PREP_SEC` 从 15 改为 25，保留全部五步及满人口拒绝/布局不变断言，产品默认计时和玩法未改。
- 复验：Node v24.21.0 / npm 11.19.0 / Chromium 1243，原慢环境未改源码和测试计时。`npm run typecheck`、`npx vitest run tests/server`（21 文件、140 用例）、`npm run build:game && node tests/server/e2e/c13-dead-tokens.mjs`、`node tests/server/e2e/c7-playtest.mjs` 均退出 0。第 5 步断言日志为 `round 1-3 phase preparation +14874ms 2026-10-13T04:06:35.009Z`，hover/after 均为“人口已满 · 按 F 升级或先移回一个单位”，布局未变；C13 正常/跳过 PvP 回放及两轮结算 3/3 恢复均通过。服务器测试首次受沙箱 `listen EPERM` 限制中止，允许本地端口后完整重跑通过；日志保存在本地 `artifacts/pr63-review/`，不提交。
- 复现：在不含 C9 的固定基线 `6088a11427535beaebef48236911df5ce41296f9` 上执行 `npm run build:game && node tests/server/e2e/c7-playtest.mjs`（Node 24.21.0，CHROMIUM 指向本机 Chromium 1243），第 5 步同样失败；未修改基线源码、15 秒准备期或断言。
- C9 原失败行：`bench → empty cell at the cap refused (hover "人口已满 · 按 F 升级或先移回一个单位", after "")`。原日志未记录时间戳及阶段切换，不能还原该次 ok→失败间隔或 1-3 preparation→battle 的准确时间。
- 基线失败行：`bench → empty cell at the cap refused (hover "战斗与回合结算期间构筑已锁定", after "人口已满 · 按 F 升级或先移回一个单位")`。同次输出中，`ok  bench unit-2 ↔ bench unit-4 swapped` 为 10:28:09.534，错误输出为 10:28:13.784（UTC+8），相隔 4.250 秒；这是输出接收间隔，包含错误上抛前的浏览器清理，非精确断言耗时。服务器默认日志未记录逐次 phase 切换，锁定提示表明已离开可构筑阶段，不能据此补造切换时刻。
- 建议：测试操作及断言前核对 `state.phase === 'preparation'` 并记录 roundId/phase/时间；或仅将此 E2E 启动参数 `CAT_PREP_SEC` 从 15 提到 25，给买入、部署、截图和五步鼠标检查留足时间。遇到阶段切换应明确报测试前置条件失败，不跳过满人口拒绝断言、不更改产品默认计时或规则。
- 验收：在原慢环境重复运行，保留满人口拖到空格的拒绝提示与布局不变断言；失败日志能区分阶段切换和拒绝逻辑回归。content-digest 的既存基线失败单独跟进，不计入 C9 结论。

## 真机试玩反馈：开局"1-1、没有牌库、先打野怪"（2026-10-13，Claude 流水线 C 排查）

### SR-C14-01 首个准备期 0 金币，商店买不了任何卡（P1，需用户拍板，规则 P-O01 待实战验收项）

- 反馈：两台电脑 `?mode=online&server=ws` 试玩，"进来是 1-1，没有牌库，也会打一局野怪"。
- 排查（`multiplayer@67b22b9`，`npm run serve:game` + `npx vite --host`，真人 1～2 席 + 机器人，1366×768 / 1600×900 / 1280×620 均复核）：
  - 回合标签：顶部倒计时"1-2 · 准备阶段"、右侧列表"1-2"、左侧面板"1-2 · 野怪"、结算后"1-2 奖励"；服务器首个推送 `view.phase = {round:1, roundName:'1-2'}`，私有状态 `roundDefinitionId:'1-2'`、`round:1`。界面和 `src/server/room/` 的标签都取 `RoundDefinition.displayName`，`round`（序号，从 1 起）不作标签显示。未复现"1-1"。
  - 商店：首个推送即含 5 张可买卡（`generation:1`，全部 `status:'available'`，无 `empty` 槽），金币 0，卡面带 `unaffordable` 样式。服务器开局顺序为 `createSharedPool` → 8 席 `initializeSharedSeat` → 一次 `refreshSharedShops(…,1)` → 发布，首轮发牌正常，客户端也收到了。
  - 野怪：1-2 在 `ROUND_CATALOG` 中是 PvE（`minions-a-v1`），按表执行。
- 结论：不是界面标签或服务器发牌问题。"没有牌库"来自 `M8B_OPENING.md` §2–§4 / `M8B_POLICY.md` P-O01："1-1 只做初始化，直接进入 1-2 准备期，0G、等级 1，只给刀妹；1-2 的基准金币为 0，不承诺玩家无需出售就能购买英雄"。玩家第一轮看得到商店但一张也买不了，体感等同没有商店；首轮只有一个刀妹去打两只小兵，体感像 TFT 的 1-1。
- 需要用户在以下选项中决定，再由 Codex 按合同改规则：
  - A（维持）：保持 P-O01，界面只加提示"首轮 0 金币，1-2 战后到账 2 金币"（Claude 可单独做，不改规则）。
  - B（开局给钱）：1-2 准备期即发放少量金币（如 2G，可买一张 1 费卡），后续 2/3/5G 相应调整，保证进入 2-1 时仍对齐 10G/3 级；需改 `opening-economy`、合同、digest 与 golden。
  - C（补 1-1 选秀）：新增 1-1 共享选秀轮（TFT 原版流程）；改动最大，涉及日程、共享池和服务器阶段机，不建议在 T9 前做。
- 建议：A 先行；用户若仍嫌首轮空，再做 B。
- **用户决定（2026-10-13）：选 A。** 规则不改，Codex 无需动作。Claude 在联机面板状态行的首个准备期（`view.phase.round === 1`）追加"首轮 0 金币，1-2 战后到账 2 金币"，只改 `src/rendering/online/online-application.ts`。若以后 P-O01 的 1-2 收入改动，需同步这句文案。
- 验收（B）：seed 42 单人与八席各一局，1-2 准备期金币等于新约定，可买一张 1 费卡；进入 2-1 时无操作基准仍为 10G、3 级、0XP；合同、版本号与 digest 同步更新。

## C15 PvP 回放中我方单位的装备图标（2026-10-13，Claude 流水线 B/C）

### SR-C15-01 回放推送附带本席单位映射（已解决，服务器侧，无规则改动）

- 状态：**已解决**（分支 `claude/c15-replay-equipment`，基线 `multiplayer@25dae94`）。只改 `src/server/`、`src/rendering/`、`src/presentation/`，不改 `src/simulation/`，不需要 Codex 动作。
- 现象：PvP 回放的 `CombatViewState` 用战斗 ID（合同 §10.2：`JSON.stringify(['t2', seatId, kind, originalId])`）命名单位，客户端按它在本席 `items` 里查不到装备，我方回放单位不显示装备图标。合同要求查 `mapping`、不按字符串切割推断，客户端不解析战斗 ID。
- 字段形状：`replay` 推送新增 `unitIds: readonly { combatId: string; originalId: string }[]`（类型 `ReplayUnitId`，`src/server/protocol.ts`）；同一字段在 `SeatReplay`（`toCombatReplayFor` 的返回值）上。
  - 来源：`BattleResult.battle.mapping`（`BattleIdMapping`），只取 `kind === 'unit'` 且 `seatId` 为本席的条目，原样取 `combatId`/`originalId`。
  - A 侧和镜像 B 侧都只拿自己的条目；镜像源席不是参与者，收不到这场回放。PvE（placeholder）回放本来就用原 ID，给空数组。
  - 不下发对手条目，也不下发 item / temporary-item / augment / anomaly 条目。回放的 tick、事件、结果不变。
- 客户端：`readReplayUnitIds`（`src/server/net/messages.ts`）做结构校验，只接受 `{combatId, originalId}` 非空字符串数组，缺失或格式错时返回 null，这时这一场回放不显示装备，战斗照常播放。`RemoteSession.equipmentOwnerId(id)` 把映射到的战斗 ID 换成原 ID，其他 ID 原样返回（查不到装备）；状态换到下一回合时映射随回放一起清空。`BoardScene` 按换出的原 ID 读本席 `items` 画装备。
- 验收：`tests/server/c15-replay-unit-ids.test.ts`（A/B 侧各只拿到自己的单位映射、镜像战只给真实席、PvE 为空、对手及装备条目不出现、校验函数、RemoteSession 映射生命周期）；`projection-wire.test.ts` 核对线上 `unitIds` 与投影一致；`tests/server/e2e/c15-replay-equipment.mjs`：两名真人各给一个单位装一件装备进入 PvP，回放期间各自的战斗单位画出自己的装备，敌方单位不画。

## T12 对 Claude 的接线说明（2026-10-14）

规则与接口以 [MULTIPLAYER_CONTRACT §17](MULTIPLAYER_CONTRACT.md#17-t12战斗中装备永不锁定r22026-10-14) 为准。`src/server/room/room.ts` 的 `ROOM_COMMAND_GATE` 在 battle/awaiting-settlement/settlement 已放行 `equip`/`combine`，服务器不需改闸门；线上 equip 字段不变，继续在最新 live seat 提交事件，不覆盖冻结信封。

界面改读 `previewEquip`：它在 preparation/combat/choice/settlement 均给出己方棋盘/备战席真实合法结果，含永久单位本场已阵亡的情况；组件对组件的成功预览可返回 `combination`，失败继续展示真实槽位/唯一/独占/配方原因。不要复用 deploy 的棋盘锁判断装备拖放。同步更新 `strategy-panel.ts` 两处“战斗中构筑/棋盘单位锁定”文案及拖放目标判断，清楚提示战中新装备下场生效。

本场属性、血量、触发与回放继续读 CombatView；运营装备读现有 items/temporaryEquipment，不能把新装备加到本场伤害显示。未新增“本场使用装备 vs 运营装备”的权威投影字段，§14 白名单不变。无布局、颜色或视觉要求；买卖/部署的原锁定提示与规则保留。

## C18-B R3/R4 掉落界面预接线的合同缺口（2026-10-14，Claude 流水线 B/C）

界面已按 [MULTIPLAYER_CONTRACT §18.4](MULTIPLAYER_CONTRACT.md#184-revealedloot-与工具投影草案) 草案字段先做好（分支 `claude/c18b-loot-ui`，`?fakeLoot=1` 用本地假数据预览；T13 PR #79 合入后换真字段再提 PR）：

- `src/presentation/orb-loot.ts` 渲染宝珠卡（四品质、珠聚合状态、条目状态、放弃原因）、消耗品架，以及拖放提示文案。
- `src/rendering/online/fake-loot.ts` 优先读服务器字段 `revealedLoot.revealedOrbs` / `consumables`，没有时才用假数据。
- 消耗品能否用在某个目标上，界面只问一个占位函数 `previewConsumable(state, consumableId, target)`。它目前对所有目标都返回 `{ ok: 'pending' }`，不会自称合法，接线时只替换这一处。
- 拖放和点击都不发命令。

下列是接真字段前需要 Codex 定下来的内容。

### SR-C18-01 客户端可用的消耗品目标预览（P1，阻塞"拖到目标"的合法提示）

- 缺口：§18.1 规定 `previewUseConsumable` 只接受可信权威状态，"客户端不能在残缺私有投影上运行这个权威预览"。但 §18.3 要求客户端"显示库存工具和可选目标"。现在界面拿不到任何目标合法性，只能写死"拆卸器→单位、重铸器→装备"的说明文字，不能把非法目标标灰。
- 需要（二选一，由 Codex 定）：
  - A（推荐）：私有投影新增 `consumableTargets: readonly { consumableId: string; targets: readonly { target: ConsumableTarget; allowed: true } | { target: ConsumableTarget; allowed: false; reason: ConsumableFailure } }[]`，由服务器对每件工具和本席全部可见单位、永久物品调用 `previewUseConsumable` 得出。只列本席持有的目标；不泄漏重铸结果，不消耗 RNG。
  - B：导出一个只读结构判断函数，签名形如 `previewConsumableOnSeatView(view: PrivateSeatView, consumableId, target): ConsumablePreview`。合同里写明它只看投影上已有的字段，结论与权威预览一致（失败原因相同，执行时仍会重新校验）。
- 用途：拖动工具时把合法目标高亮，把非法目标标灰并显示原因；松手前就预告"将拆下 N 件 / 将重铸 X"。
- 验收：对 §18.5 每个失败原因（错误目标类型、临时子件、敌方/野怪、空身单位、已消费工具）各给一个用例，A 字段或 B 函数的结果都与 `previewUseConsumable(权威状态)` 相同；四个阶段都覆盖；读取前后 RNG、ID 分配和 revision 不变。

### SR-C18-02 导出消耗品内容表（P2）

- 字段：`CONSUMABLE_DEFINITIONS: Record<ConsumableDefinitionId, { id; name; description; targetKind: 'unit' | 'item' }>`，放在 `src/simulation/content/consumables.ts`（设计稿 §2 已列为拟新增）。
- 用途：消耗品架、宝珠条目、事件记录里的名称和说明。目前界面在 `CONSUMABLE_TEXT` 里写死了"磁力拆卸器 / 组件重铸器 / 成装重铸器"和用途说明，带 TODO。
- 验收：三个定义都在表里并纳入 digest；界面改读这张表后，不再写死名称。

### SR-C18-03 useConsumable 的回执、事件与失败文案（P2）

- 需要合同写明：wire 回执 `result.kind`（建议 `'consumable-used'`）；成功时私有投影里会变的字段（`consumables` 少一件，`items` 新增或回到库存）；显示事件 `consumableUsed` / `itemReforged` / `itemsRemoved` 是否进入 §14.2 白名单（界面要在记录页写"重铸：A → B"）。
- 失败文案建议（界面照此显示，Codex 可修改）：`unknown-consumable` 该消耗品已不存在，请重新选择；`invalid-consumable-target` 这件消耗品不能用在该目标上；`no-removable-items` 该单位身上没有可拆下的装备；`temporary-item` 临时装备由本轮自动生成，不能拆卸或重铸；`wrong-phase` 当前阶段不能使用消耗品。
- 服务器侧（Claude，已在 `claude/c18b-loot-ui` 先做好，字段名按 §18 草案）：
  - `src/server/protocol.ts` 新增 `ConsumableTarget`、`ConsumableFailure`、`ConsumableCommand`，以及 `WireCommand = ClientCommand | ConsumableCommand`。`net/messages.ts` 对命令层和目标层逐层做 onlyKeys 校验：item 目标只认 kind/itemId，unit 目标只认 kind/unitId；空 ID、混合字段或未知 kind 一律返回 `invalid-message`。
  - `useConsumable` 已加入 `ROOM_COMMAND_GATE` 的 OPS，在 preparation、choice、battle、awaiting-settlement、settlement 放行，frozen、waiting、ended 不放行。
  - 房间把命令交给 `src/server/room/consumables.ts` 的 `useSeatConsumable` 处理。规则入口导出前，它一律以 `unknown-consumable` 原样拒绝：返回输入时的同一份 pool 和 state，不产生事件，revision 不变。T13-B 合入后，这里只换成 `runSharedMatchCommand(pool, state, { type: 'useConsumable', … })`。
  - 客户端新增 `RemoteSession.useConsumable` 发送路径。面板只在预览答复 `ok: true` 时才发命令，所以接线前不会发出。
  - 验收：`tests/server/c18b-use-consumable.test.ts`，以及 e2e `tests/server/e2e/c18b-use-consumable.mjs`。e2e 现在跑假数据阶段；私有状态一出现 `consumables` 字段，就自动转为真实验收：战斗中对场上单位用拆卸器，装备按原 ID 回到库存，工具少一件，再用同一件返回 `unknown-consumable`。
- 请 Codex 在 T13-B 顺带处理：`useConsumable` 暂时没并进 `ClientCommand`。原因是 `src/simulation/bot/preflight.ts` 的 `legal()` 和 `tests/t7-helpers.ts` 的 `execute()` 都对 `ClientCommand` 做穷举 switch，加进去会编译失败，而这两个文件归 Codex。T13-B 在这两处补上 `useConsumable` 分支（机器人可以先一律视为不合法）后，告诉 Claude，Claude 再把 `ConsumableCommand` 并入 `ClientCommand`，`WireCommand` 改为别名。另外，`ConsumableTarget`、`ConsumableFailure` 导出后，`src/server/protocol.ts` 会改为从 `src/server-entry` 引用。
- 验收：一条 e2e，战斗中对场上单位使用拆卸器，装备回到库存、工具少一件，本场图标不变（沿用 C18-A 的"下场生效"显示），记录页出现一行事件。

### SR-C18-04 revealedLoot v2 的显示约定确认（P3，只改文档）

- 界面目前的做法，请在 §18.4 里确认或修正：
  - 宝珠卡按 `revealedOrbs` 的顺序排列；每张卡只列它 `entryDropIds` 引用到的条目；没被任何珠引用的条目归入"其他"卡。
  - 珠的状态只显示服务器给的聚合值，不按条目重新计算。
  - `forfeited` 条目显示为划线，`timeout-forfeited` / `eliminated-forfeited` 各有一句原因说明。
  - 掉落来源名沿用 `readEncounterPreview` 的 `sourceUnitId → name` 映射。
- 联机显示时机（界面决定，告知即可）：准备阶段和本席战斗回放播放期间隐藏（防止击杀前剧透），回放播完后显示，包括断线重连时服务器重新推送回放、并把状态覆盖成 combat 的情况。所以 `revealedLoot` 必须在本轮结算期间一直下发，重连后的首次推送也要带上。
- 验收：重连 e2e（`tests/server/e2e/c18b-loot-preview.mjs` 换接真字段后）中，结算期刷新页面，回放播完后宝珠卡再次出现，内容与刷新前相同。

## T13 对 Claude 的接线说明

T13-A：界面不再需要自己选合成槽。将玩家请求的合法 slot 原样交给 equipItem；previewEquip 成功时按 occupiedSlots 高亮真实落槽，按原 combination 显示配方结果。单位身上已有散件时，拖到空槽或成装槽也会在原散件槽合成；旧状态多个散件优先最低槽。三槽父件仍按 occupiedSlots=[0,1,2] 显示。无需新命令或新失败码，四阶段及下场生效文案沿用 T12。


### T13 对 Claude 的接线说明：R3/R4（C18-B）

D1–D8 已选 A；完整签名、阶段、失败码、投影见 MULTIPLAYER_CONTRACT §18。T13-A 界面不再需要自己选合成槽，成功 preview.occupiedSlots 表示真实落槽。

- 对局创建：先 createSharedPool(poolId, roomSeed)，逐席 createMatch(seatSeed, {mode:'shared-deferred'}) 后 initializeSharedSeat(pool, seat, seatId, index)，每次接住返回 pool/state；随后走既有共享商店初始化。禁止 createMatch(seed) 的 solo 状态传共享初始化。
- 换轮只调 nextSharedRound(pool, latestSeats, expectedRound)，原子接住所有返回；pool.orbLayout 私有，界面不能计算或存储颜色。
- ClientCommand 增加 useConsumable：consumableId 加 target={kind:'unit',unitId}（拆卸器）或 {kind:'item',itemId}（两重铸器）。服务器逐层 onlyKeys，沿原信封去重、round/revision 权限，转 runSharedMatchCommand。成功保存最新席位与 pool，不能覆写冻结战斗输入。
- 新私有字段 consumables；revealedLoot 新 revealedOrbs，entry 新 orbId/entryOrdinal；payload 新 consumable。已授予英雄缺货时展示实际 receipt 的金币。已揭示后放弃仍显示，未揭示奖励仍隐藏。列表无点击开珠/领取入口。
- 新失败文案建议：unknown-consumable「该工具已使用或不存在」；invalid-consumable-target「该工具不能用于此目标」；no-removable-items「该单位没有可拆卸装备」。wrong-phase/temporary-item/unknown-item/unknown-unit 沿现有码；layout 三失败属于服务器权威错误，不要求玩家挑颜色。
- 已放弃状态与工具名称为占位，由 Claude C18-B 正式接线。已授权的 presentation/loot-view.ts、loot-preview/fixtures.ts 仅做最小兼容；未实现工具交互或宝珠布局。
- 联合部署切换网络协议到 2，拒绝旧协议；旧格式 2 存档只读保全导出、新开局，不迁移。当前 src/server/ 未修改；其原 solo 初始化调用是 C18-B 必须处理的接线依赖。


### T13-B 对 SR-C18-01～04 的接线回应

以 multiplayer@9774682 四项需求为准，正式合同见 MULTIPLAYER_CONTRACT §18.8。
- 01 选 A：读 privateView.consumableTargets；allowed:true 的 affectedItemIds 可给“将拆下 N 件/重铸 X”。无行/无候选即不可用；提交时仍重新校验，不在私有投影上调用 previewUseConsumable。
- 02 已从 server-entry 导出 CONSUMABLE_DEFINITIONS，含 name/description/targetKind；正式名称“拆卸器”，删除本地占位文字表。
- 03 useConsumable 成功 wire result.kind='consumable-used'，带 seatRevision/roomRevision 与三个运营事件的字段白名单；不并入战斗回放。七项失败码与文案见 §18.8。协议校验、四阶段 gate、回执与 e2e 由 Claude 接线。
- 04 已确认卡片分组/状态/来源/放弃原因及本轮结算重连期间持续下发；播放时的隐藏由界面处理。

已放弃状态与工具名称为占位，由 Claude C18-B 正式接线。此次仅增加数据与合同，不改界面交互或布局。T13-A 先行 #80；R3/R4 在 codex/t13-loot 的 #81 按里程碑推送草稿，发布身份独立于 A。


SR-C18-03（8968c8a）补充回应：ClientCommand 已纳入 useConsumable；Codex 的 legal() 暂恒拒绝此机器人动作，execute() 转发真实领域命令。用户另准许 applySeatCommand 一行直通 runSharedMatchCommand 以保持当前基线可编译；C18-B 合入时 Claude 将这行替换为 useSeatConsumable。gate、网络 onlyKeys、consumables.ts 均未改，继续使用 Claude 分支实现；不得两次消费同一命令。

## C18-B 换接真字段后的状态与新缺口（2026-10-14，Claude 流水线 B/C，基线 codex/t13-loot@ad72928）

### C18-B 接线完成情况（回应 §18.2、§18.8，无需 Codex 动作）

- 服务器（§18.2）：`Room` 构造时逐席调用 `createMatch(seatSeed, { mode: 'shared-deferred' })` 后再 `initializeSharedSeat`，不再先建 solo。换轮仍只走 `nextSharedRound`。结算批次失败时，为了在故障信息里指出卡住的席位，会对每席试跑一次 solo `nextRound`；这次试跑已加异常保护，结果只用于诊断，不代替批事务。
- 服务器（§18.3、§18.8 03）：`applySeatCommand` 改为只经 `useSeatConsumable` 调用 `runSharedMatchCommand`，Codex 原来那行直通已删除，不会两次分发。`WireCommand` 改为 `ClientCommand` 的别名。成功回执的 `result.kind` 为 `'consumable-used'`，其中只按白名单逐字段复制 `itemsRemoved`、`itemReforged`、`consumableUsed` 三类事件（保留 domain 和 eventSeq），不含来源账本或 RNG。`NET_PROTOCOL_VERSION` 改为 2，协议 1 的客户端会被拒绝。
- 界面：假数据和 `?fakeLoot=1` 已删除。宝珠卡读私有投影的 `revealedLoot.revealedOrbs`，离线读 `readLootView`。工具名称和说明读 `CONSUMABLE_DEFINITIONS`。目标是否可用，联机读 `consumableTargets`（缺行或缺目标一律视为不可用），离线直接在完整状态上调用 `previewUseConsumable`。拖放只在答复可用时发命令。记录页显示"重铸：A → B""拆卸：X 卸下 …"。单人模式经 `MatchSession.useConsumable` 调用领域 `useConsumable`。

### SR-C18-05 共享池守恒校验每笔事务都重算全部席位的掉落冻结，房间运行慢 2～3 倍（P1，性能，规则侧）

- 现象：`tests/server` 有 3 条用例超出原有时间预算。对比 T13 之前：选择窗口用例 1.8 s → 5.6 s（超过 vitest 默认的 5 s），整局淘汰用例 18 s → 42 s（预算 30 s），8 机器人整局 37 s → 65 s（预算 60 s）。这些预算没有放宽。
- 定位（CPU profile，seed 42 跑到第 12 轮共 13.4 s）：`canonicalContent` 自身约 6.3 s，`structuredClone` 约 1.8 s，`assertSharedPoolConservation` 约 0.9 s。调用链为 `runSharedMatchCommand → transact / active → assertSharedPoolConservation`。T13-B 在其中新增了逐席比对 `canonicalContent(state.m8.loot.frozen) === canonicalContent(freezeLootThroughRound(seed, ordinal, pool.orbLayout))`，即每笔共享事务（含 PvE 战斗中的每一步 `ownCombatSteps`）都要把每个席位的掉落从头重建并序列化一遍。
- 需要：在不削弱恢复校验的前提下，把这项比对移到真正需要它的边界，例如初始化、换轮批事务、恢复入口，或改为增量/缓存比对。不能以放宽测试时间预算代替。
- 验收：上述 3 条用例在原预算内通过；`assertSharedPoolConservation` 对掉落被篡改的席位仍报 `invalid-seat-state`（沿用现有篡改用例）。

#### SR-C18-05 / SR-B8-03 窗口 1 实施（2026-10-14）

`restoreOrbLayout` 只信任确定性构造器产生的深冻结布局；逐席掉落比较按 `(冻结账本对象, 布局对象)` 弱引用缓存，仍逐次核对席位 seed、轮次和绑定。初始化/新布局/换轮第一次比较建立缓存；外部 JSON 或可变副本不会进入缓存，恢复验证未删减。篡改后仍返回 `invalid-seat-state`，失败返回原 pool/state 且无事件。

SR-B8-03 与 C18-05 重叠的是每 tick 共享事务的重复冻结重放，此路径同时受益；池资产总量、席位版本、商店/持有/待领奖励仍逐 tick 校验。来源账本 append 只共享已深冻结历史记录，新增事实仍复制冻结，可变输入仍复制；未改战斗 `structuredClone` 或引入“未终局跳检查”。因此不把更广的增量池事务或战斗克隆优化宣称为已完成。

Blue Buff 超时走单人公共夹具，并不调用 shared-pool。为四泪/四剑向量分别选 seed 17/4 的真实开局组件，减少无关后期战斗，未注入物品或改变断言。所有时间预算保持原值；验收、冷热路径逐 tick 等价和篡改覆盖见 `docs/evidence/t13/WINDOW1.md`。

## SR-B8-02 交付接线说明（窗口 2）

正式签名、失败及预算语义见 `MULTIPLAYER_CONTRACT.md` §19。Node 入口新增 `startTwoSidedBattle` / `BattleTask` 与 `startCombatReplay` / `CombatReplayTask`，原同步入口兼容。

Claude 在 `room.ts` / resolver 为每场保存一个任务：冻结输入后创建 `startTwoSidedBattle(input)`，每次 `resolveSlice` 调 `advance(100)`；返回 null 时保留同一任务并让出事件循环，下一片继续，不能每片重新创建任务。返回 BattleResult 后沿原路径生成结算提案；不要对 null 进行结算。回放阶段同样只创建一次 `startCombatReplay(result)`，每片 `advance(100)`，直到得到完整回放才发布。若目标机100 tick 超过约50ms，可调小 tick 预算，勿在同一片 while 跑完任务。

PvE 使用原权威执行生成的 initial/terminal/events 创建同一种回放任务；不要从最后状态推测开局账本。双方共用原回放缓存，B 侧镜像继续只转换视角，不创建第二个回放任务。重复终局调用不产生新结果；房间取消/过期代次清理任务，异常沿现有 resolver-error 处理。服务器权限和镜像缓存键均不变。

本次未修改 `src/server/`，调度接线仍由窗口 3 完成。权威执行时直接记录回放留作后续独立工作：需同时覆盖 PvE、tick0、初末态与事件校验，不以仅 PvP 的缓存旁路替代本次合同。

窗口 2 验证（`e82afa5` 基线，Node v24.21.0，Intel Xeon Skylake，单 worker）：指定 two-sided-resolver、replay-client、t5r*、m8-b7* 与新增 `b8-resumable-battle` 合计15文件201用例通过。新增15例包含改动前实现采集的0/1/9单位阵容战斗/回放JSON SHA-256、1/7/100/1201切片、镜像、PvE狼群tick0、非法预算、终局幂等及可变输入隔离。9v9、889 tick、预算1的实测：战斗启动4.90ms/最长advance 5.74ms，回放启动9.41ms/最长advance 17.91ms；50ms断言未放宽。该采样不替代目标部署机的满装备/完整房间RTT验收。

`npm run test:server-entry` 通过（首次沙箱 spawnSync EPERM，沙箱外同命令通过）：165个起始/逐tick状态比较、106事件，T1 state/event指纹保持 `acf238a8` / `966105d6`，Node入口新增导出白名单同步；未跑全套、未修改既有预算。

## C19 窗口 3 发现的规则缺口（2026-10-14，Claude 流水线 B，基线 `multiplayer@fa36a27`）

### SR-C19-01 日炎斗篷灼烧漏掉一次周期脉冲，整局以 resolver-error 中断（P0，阻塞整局，规则侧）

- **现象**：房间以 `fault = { kind: 'resolver-error', message: 'Missed periodic pulse; never backfill' }` 异常结束，没有排名。报错来自 `src/simulation/m8/periodic.ts:33` `advancePeriodicTask`。都发生在第 6 阶段的 PvP 战斗（seed 4：6-1 `r32:b1`；seed 9：6-1 `r32:b0`；seed 11：6-2 `r33:b0`）。另外 C19 e2e 用 seed 12（2 真人 + 6 机器人）时在 5-1 同样异常结束。8 机器人的进程内整局抽查 16 个种子，有 3 个出现（约 1/5），会直接卡住 T9 真机整局。
- **共同点**（三例相同）：抛错时一个**日炎斗篷（`sunfire-cape`）灼烧**周期任务挂在存活目标上，字段为 `pulseOrdinal 0`、`periodTicks 20`、`finalPulse 'before-expiry'`、`endsAtTick = nextPulseAtTick + 200`，`nextPulseAtTick` 为 T（80 / 160 / 200）。tick T 的脉冲没有被处理，推进到 T+1 时抛错。看起来像在 tick T 当拍新建或刷新的灼烧任务把首个脉冲定在 T，而这一拍的周期任务已经推进过了。根因与修法由 Codex 判断。
- **复现**（纯进程内，无浏览器或网络，每个种子约 1 分钟）：`node tests/server/e2e/repro-missed-pulse.mjs 9`（不带参数时跑 9、4、11）。脚本用 `ManualClock` + 8 个 `BotDriver` + `TwoSidedBattleResolver` 打完整局。遇到 resolver-error 时用公共入口 `snapshotForBattle → compileBattle` 重新编译出错的配对，把规则输入写到 `artifacts/repro-missed-pulse/seed-<n>.json`，再单独调用 `resolveTwoSidedBattle(input, 5000)` 复现同一异常，最后逐 tick `stepCombat`，打印抛错的 tick 和滞后的周期任务。seed 9 的输出：`step to tick 161 throws … late task on irelia (alive true): item sunfire-cape …, nextPulseAtTick 160, period 20, ends 360, pulse 0, finalPulse before-expiry`。
- **验收条件**：上述三个种子的规则输入 `resolveTwoSidedBattle` 不抛错；在 tick T 当拍新建（或刷新）、首脉冲在 T 的周期任务有单测，不补发、不漏发；`repro-missed-pulse.mjs` 三个种子都打到唯一排名，没有 fault；有内容或规则变化时按惯例同步 digest。服务器侧不做绕过（不吞异常、不跳过该场战斗）。

### SR-C19-01 窗口 4 规则修复回应

已定位为新贡献创建时的首跳对齐问题：tick 160 目标的旧 burn 已处理，后处理的日炎来源却读到尚未统一推进的组时钟 160，创建出 `pulseOrdinal=0` 的滞后任务。新贡献现在对齐 180；已有任务、刷新余数与组相位不变，`advancePeriodicTask` 的 never-backfill 抛错原样保留。周期入口冻结的本拍归因不被新来源替换，不增加当拍伤害。

seed-9 已缩减为 2 对 2 的直接编译输入 `tests/fixtures/c19-seed-9-minimal.json`，修复后 244 tick 完成；原始输入 355 tick 完成。新增 10 例涵盖两种单位顺序、首跳、刷新、200 tick 的 10 次含末跳付款、非到期拍相位以及真正漏拍的拒绝。既有 golden 与 digest 未改，玩法沿现有 B-01/B-08。

指定目标集 16 文件 / 223 用例通过，typecheck 与 Node 入口通过（165 状态 / 106 事件）；整局三种子结果、数值依据与复现 SHA 见 [窗口 4 证据](evidence/c19/MISSED_PULSE.md)。不需要服务器绕过或新增字段，C19 可在本修复合入后按窗口 3 续单 rebase、完成界面整局验收。

## G1-P6 配对预告与侦察（2026-10-15，Claude 流水线 B/C，分支 `claude/g1-pairing-scouting`）

### 已交付（服务器 + 界面，无需 Codex 动作即可运行）

- `src/server/room/pairing.ts`：`candidateOpponents(aliveSeatIds, seatId, history, policy)`、`planCandidates(aliveSeatIds, history, policy)`、`planPairings(aliveSeatIds, rngState, battleIdPrefix, history?, policy?)`、`recordPairings(history, pairings)`。history 为每席过去 PvP 轮的对手（旧在前，最多 8 条）；镜像只记在打镜像的那一席、记为 `sourceSeatId`，来源席只记自己的真实对手；PvE/补给轮不记。
- 候选：排除最近 `avoidRecentRounds` 轮对手；为空则窗口减 1，直到 0（全部存活席）。若各席候选互不相容、凑不出完整配对，全体同时减 1 再试（2 → 1 → 0），保证开战抽到的对手一定在准备期展示的候选里。不消耗 RNG。
- 时机：回合进入时只算候选（`RoomState.opponentCandidates`）；配对与全部 `battleSeeds` 挪到准备截止冻结时抽取，抽取顺序仍是"洗牌 → 奇数镜像来源 → 每场种子"。空历史时与原先无约束洗牌逐位相同。配对历史 `RoomState.pairingHistory` 在房间状态里，断线、接管、重连后候选不变。
- 投影：`PlayerView.opponentCandidates?: string[]`（选择/准备期、PvP 轮，按座位序，只含存活、不含自己；其它时候为空）；`opponentSeatId` 在冻结前为 null。`NET_PROTOCOL_VERSION` 保持 2（只增视图字段，依据写在 `messages.ts`）。
- 侦察：右侧玩家列表点击即开对方公开阵容（C5 已有：单位、星级、装备、羁绊激活数，全部来自 `SeatPublic.publicBoard`），Esc 或再点一次关闭。没有新增字段需求。2026-10-20 起另显示对方强化、异常、备战席和未装备装备，不显示连胜/连败（合同 §27）。

### SR-G1-01 请 Codex 用 §10 规则替换占位数值（P2，只改参数）

- **现状**：`DEFAULT_PAIRING_POLICY = { avoidRecentRounds: 2 }` 是占位。
- **需要**：`docs/S13_RULES_GAP.md` §10 给出 14.24b 的定义与推荐值；若 14.24b 的放宽顺序不是"全体逐轮减 1"，或奇数镜像应受约束/计入来源席历史，请在合同写明，服务器按合同改 `pairing.ts`。
- **验收**：§10 的 6–8 组向量能直接写成 `tests/server/pairing.test.ts` 的用例并通过。


## SR-G1-02 规则侧逐项答复（P7，2026-10-15）

正式接口和失败全集见 MATCH_CONTRACT P7，逐项映射表及初始化顺序见 MULTIPLAYER_CONTRACT §21.4–21.5；server-entry 同名导出已补齐。
- opensCarousel / schedule / prepareCarouselParticipants / createCarousel 均由规则提供；六轮时间均 6000/6000/6000ms，每批 2 人、HP 低先、平血座位先，含 1-1；全选也等固定截止，未选者自动选。
- 服务器选取用 pickCarouselForSeat，自动选用 autoPickCarouselForSeat，单事务返回 pool/carousel/state/events；底层 pickFromCarousel、grantCarouselPick、autoPickFromCarousel 亦导出。机器人优先同名可升级，再高费用、低 slot，不额外耗 RNG。
- 公开列表 listCarouselSlots；1-1 不加 catalog 行/不移动 ordinal，使用 createCarouselMatch 空阵容与 0 金币/0 组件开局，选秀给一单位一组件；之后才生成首店。
- x-4 不保留旧组件 supply 选择；completeCarouselForSeat 在固定截止后结算一次自然经济，nextSharedRound 接续。
- 满备战席进入本席 pendingUnits（计 holdings）；resolvePendingCarouselUnits 归位/合法合成，sellPendingCarouselUnit 显式出售，不自动卖出。
- 池 v3 内含预留/收据，assertSharedPoolConservation 无需盘面参数；可传 states 核对单位与队列。淘汰用 releaseCarouselParticipant。
- 占位失败映射：carousel-slot-taken→slot-taken，carousel-already-picked→already-picked，carousel-unknown-slot→invalid-slot，carousel-not-participant→unknown-seat；carousel-closed 同名，未放行 seat-locked，过期池 stale-pool。完整枚举见 MATCH P7。
- 恢复先 restoreCarousel 后 restoreCarouselSeat（可信服务器快照边界），不重建、不发奖；网络 carouselPick 可由服务器绑定层沿现有信封适配。

本分支只交付规则/合同/测试，未修改 src/server 或界面；G1 的八席 1-1/2-4 e2e 由其接线后验收。

## G5 战后统计与经济提示（2026-10-15，Claude 流水线 C，分支 `claude/g5-stats-replay`）

### 已交付（纯界面，无需 Codex 动作即可运行）

- 战后排行（本场）：我的战斗结束（结算期）起，右侧玩家列表下方显示该场双方全部单位的 伤害 / 承伤 / 治疗 排行，每回合刷新，持续到下一场战斗开始。~~数据由界面按事件自行聚合~~（G5 接线后改为规则的 `summarizeBattle(replay)`，见下方"G5 数据接线"）。
- 本局累计：同一面板的"本局累计"页签按 阵营 + `definitionId` + 星级 把本局每一场（每回合一场，客户端内存里已收到的回放）逐场相加，并给出出场场数；之后出售或被淘汰的单位保留记录。断线重连或刷新页面后，只累计重连后收到的回放。
- 经济提示：~~准备期显示 利息（`getInterestGold` 估算）/ 连胜连败计数 / 上轮连胜败金币~~（G5 接线后改读 `economyPreview`，见下方）。
- "回看"按用户决定删除（云顶无此功能）。

### SR-G5-01 §14.2 `heal` 事件不带治疗来源（P3，可选）

- **现状**：`combat-replay-view.ts` 的 `heal` 只白名单了 `targetId` 与 `actual`，没有施加者。联机排行的"治疗"因此只能是"单位受到的治疗量"，不能像 TFT 那样按治疗者统计。
- **需要（可选）**：`heal` 视图事件增加 `sourceId`（`outcome.shares[0].source.ownerId` 或按份额拆分的施加者列表，按合同选定），不暴露执行计划。
- **用途**：排行"治疗"页改为按治疗者统计；受治疗量保留在悬停提示。
- **验收**：同一场战斗中按 `sourceId` 汇总的治疗总和等于按 `targetId` 汇总的总和；镜像回放两侧对称；`replay-divergence` 校验不变。

**Codex G5 交付回应**：heal 保留单条 targetId/actual/tick/eventSeq，新增 `shares: {sourceId, actual}[]`，逐份额复制权威实际治疗，不传执行计划。`summarizeBattle(replay: CombatReplay): readonly UnitBattleSummary[]` 从 simulation/combat-summary 与 server-entry 导出；每行含 unitId/definitionId/team/starLevel、damageDealt（hpDamage+absorbed）、damageTaken（同口径）、shieldAbsorbed、healingDone（份额 sourceId）、healingReceived（targetId）、kills（kill.sourceId）、alive（terminal）。`src/presentation/battle-ranking.ts` 请改用此函数，主治疗列使用 healingDone；B 视角只换 team，ID/统计量不变。完整合同见 MULTIPLAYER_CONTRACT §14.2；服务器与界面接入由 Claude 完成。

### SR-G5-02 准备期经济预估投影（P2）

- **现状**：私有席位视图没有"本回合结算预估"。界面的利息只能用 `getInterestGold(当前金币)`，它不含胜利金币对计息基数的影响，也不知道开局回合（1-x 走 `OPENING_ECONOMY_RULES`，利息 0）与加时轮；下回合连胜/连败金币需要知道胜负后的连胜规则，界面不能自己推（`planCatalogRoundEconomy`/加时分支的选择属于规则）。
- **需要**：`toPrivateSeatView` 在准备期（及 PvP 战斗进行中）增加只读字段，例如
  `economyPreview: { roundId, gold, ifWin: { interest, win, streakGold, streakAfter }, ifLoss: { interest, win, streakGold, streakAfter } } | null`
  （补给轮可为 null 或只给一组），由与结算相同的规划函数按当前金币、连胜计算；不含 RNG、敌方信息或掉落。
- **用途**：经济提示直接显示"利息 +N（胜 +M）· 连败 2 · 再败 +1 金币"，替换 `getInterestGold` 估算。
- **验收**：对 1-2、2-1、加时轮和一组跨 10 金币边界的胜/负，`economyPreview.ifWin/ifLoss` 与随后结算的 `roundResults[].incomeBreakdown`（金币未再变化时）逐项相等；G5 e2e 改为逐项比对。
**Codex G5 交付回应**：`previewRoundEconomy(state: MatchState): RoundEconomyPreview | null` 从 simulation/economy-preview 与 server-entry 导出。返回 `{roundId,gold,ifWin:{interest,win,streakGold,streakAfter},ifLoss:{...}}`；preparation/combat 使用当前己方资源，补给/其他阶段/已淘汰席返回 null。与结算共用 resolveRoundEconomy → planCatalogRoundEconomy/加时规划，含开局利息 0；不读 RNG/敌方信息，不预测掉落。请由 Claude 接入私有投影；签名、空值及精确比较条件见 MULTIPLAYER_CONTRACT §14.4。

### G5 数据接线（2026-10-15，Claude，分支 `claude/g5-data-wiring-4rm9vm`）

- **服务器**：网络 `state` 消息与本地房间的私有席位视图改为 `SeatStateView = PrivateSeatView & { economyPreview }`（`src/server/protocol.ts`、`src/server/room/projection.ts` 的 `toSeatPrivateView`）。`economyPreview` 原样取 `previewRoundEconomy(match)`：准备期与本席战斗中（PvP 席在阵容锁下仍为 preparation，PvE 席为 combat）有值，选择/结算/补给/已淘汰/结束为 null。服务器不做任何经济计算；wire 版本不变（只增字段）。
- **经济提示**：倒计时条显示"利息 +N（胜 +M）· 连胜/连败 X · 再胜/再败 +Y"。N = `ifLoss.interest`，M = `ifWin.interest`，Y = 当前连胜取 `ifWin.streakGold`、连败取 `ifLoss.streakGold`（无连胜/连败时不显示）；X 为私有视图 `streak`。悬停给出两分支完整拆分。准备期与战斗中显示，删除 `getInterestGold` 估算。
- **排行**：`src/presentation/battle-ranking.ts` 只调 `summarizeBattle`，自算聚合已删除；"治疗"页按 `healingDone`（治疗者），悬停行显示受治疗 `healingReceived` 与击杀；本局累计按 阵营+definitionId+星级 对同一口径逐场相加。
- **单位悬停卡**（联机棋盘/备战席/战斗中单位）：新增一行"伤害/承伤/治疗 · 本场 a/b/c · 累计 x/y/z"，取自同一 `summarizeBattle` 行与累计行；正在回放的这一场在播完前不计入，避免提前剧透。
- **验收**：`tests/server/g5-economy-preview.test.ts` 跑完整一局（含 1-2、2-1、加时、10/20 金币两侧，胜负两分支），每席结算前最后一次投影的 `economyPreview` 与结算 `incomeBreakdown.interest/win/streak` 及 `streakAfter` 逐项相等（金币与 streak 未变时）；`tests/server/e2e/g5-stats-economy.mjs` 改为逐项比对并独立按 `heal.shares` 校验治疗。

## G2 前置界面：羁绊面板与技能/装备说明（2026-10-15，Claude 流水线 C，分支 `claude/g5-traits-tooltips`）

### 已交付（纯展示，只读 content 公开导出）

- 左栏顶部常驻羁绊列（`src/rendering/trait-column.ts`）：行数、人数、档位来自规则的 `deriveTraits`（与羁绊页签、侦察面板同一选择器），激活行在前，断点高亮当前档，未激活灰显；hover 显示每档效果（`describeTraitTier`，已移到 `src/presentation/effect-text.ts`）与该羁绊全部英雄（场上者标出）。侦察面板改用同一组件渲染对方羁绊列。
- 单位说明卡（`src/presentation/unit-card.ts`）：商店卡、部署页名册、棋盘/备战席上的棋子、侦察面板单位都可 hover；内容为费用、羁绊、技能（`S13_ABILITY_DATA.description` 按星级把 `@Var@`/`@Var*N@` 换成 `variables` 中的值，去掉 Riot 标签）、法力与 `getUnitStats` 的星级属性。
- 装备说明：沿用 `item-codex` 的说明弹层（效果 + 配方/可用于配方），新增挂到侦察面板。
- 缺图标：羁绊用名称首字作占位；英雄沿用 `symbol` 首字母徽标，新英雄无需改代码。

### SR-G2-01 技能说明缺两类展示数据（P2，界面已按"原样显示"处理）

- **技能名**：content 公开导出里没有技能名（只在 `source/s13-14.24.json` 原档的 `ability.name`）。请在 `S13_ABILITY_DATA` 增加 `name`（最好再给中文名），界面直接显示。
- **计算后的数值**：模板里的 `@ModifiedShield@`、`@ModifiedDamage@`、`@TotalDamage@` 等是规则按法强/攻击力换算的总值，`variables` 里没有，目前原样显示。请导出只读选择器，例如 `abilityDisplayValues(definitionId, starLevel): Record<string, number>`（按基础法强/攻击力，不含装备与羁绊），界面用它补全这些占位。
- **验收**：19 名现有英雄 1–3 星的说明文字里不再出现 `@...@`；界面不自行换算。

## G1-P7 选秀：服务器与界面接线（2026-10-15，Claude 流水线 B/C）

### 已交付（绑定 Codex P7 规则，无需 Codex 动作）

- 端口：`src/server/room/carousel.ts` 的 `CAROUSEL_RULES_BINDING` 直接绑定 server-entry 的 P7 导出（createCarouselMatch / opensCarousel / prepareCarouselParticipants / createCarousel / advanceCarousel / pickCarouselForSeat / autoPickCarouselForSeat / completeCarouselForSeat / releaseCarouselParticipant / resolvePendingCarouselUnits / sellPendingCarouselUnit / listCarouselSlots）；测试用假规则已删除。
- 房间：开启选秀时八席用 `createCarouselMatch` 开局，1-1 前奏关闭后才 `refreshSharedShops` 发首店；x-4 由 `completeCarouselForSeat` 结算后走原有结算/推进；每笔 pick/autoPick 的返回事件与新盘、池、席位状态同一次发布（席位 serverEvents + 房间选秀账本）。准备期进入时及每次准备期命令后调用 `resolvePendingCarouselUnits`；对排队单位的 `sell` 走 `sellPendingCarouselUnit`。
- 网络：`NET_PROTOCOL_VERSION` 3，命令 `{type:'carousel-pick', carouselId, revision, slot}`；`PlayerView.carousel` 公开槽取自 `listCarouselSlots`，另有本席 `eligible/pickedSlot/receiptId` 与公开 `autoPicked`。`main.ts` 默认开启（`CAT_CAROUSEL=0` 仅供旧 e2e）。
- 界面：选秀圆盘、批次与倒计时、放行时可选单位高亮、他人已选灰显并标注、自动选提示、满备战席排队条（可出售）。

### 说明（无需动作）

- `releaseCarouselParticipant` 已绑定但房间当前没有调用点：淘汰只在战斗结算提交时发生，而选秀阶段只在回合进入时开、截止+2 秒后关，二者不重叠；盘关闭后的淘汰沿用 `releaseSeatOnElimination`（八席整局单测与 e2e 跑到终局无守恒错误）。若规则侧认为关闭后的盘仍需经它释放，请在合同写明。
- **回应（2026-10-16，规则侧结论：无需调用）**：盘关闭后的淘汰只走 `releaseSeatOnElimination` 即保持卡池守恒，房间现有做法正确，无需改动。选秀单位在发放时已登记为普通 holdings，淘汰释放会连同其他棋子一并归还；该席池收据保持 `granted` 是历史出生记录，不是遗漏，不必改成 released。关闭后的旧 CarouselState 已与当前池脱节，再用它调 `releaseCarouselParticipant` 会以 `invalid-match` 拒绝。`releaseCarouselParticipant` 仅用于盘开着时淘汰参与席（房间当前不会发生）。合同见 MULTIPLAYER_CONTRACT §21.5 `releaseCarouselSeat` 条目下「盘关闭后的淘汰」与 MATCH_CONTRACT P7「适用窗口」；回归用例见 `tests/p7-1-carousel-rules.test.ts`。

### SR-G2-01 G2-2 完整回应

`S13_ABILITY_DATA[abilityId].name` 已有锁定源英文技能名；`src/simulation/ability-display.ts` 的 `abilityDisplayName(definitionId)` 与 `abilityDisplayValues(definitionId, starLevel, stats?)` 均为纯函数。默认基础星级AD、100AP，返回冻结的数值键映射；支持48名英雄，47名全模板三档星级覆盖，Rumble唯一升级字符串分支由界面隐藏未启用项。完整签名/失败语义见 MATCH_CONTRACT 的 SR-G2-01 节。6新增阵营和15英雄的源名/数值已供内容选择器读取；新增英雄视觉身份与六阵营已开放标签映射请界面负责人接入。图标下载受环境代理403阻断，见 evidence/g2-2/assets-manifest.json。

### G2-2 联机外交官胜场历史缺口（有限实现清单）

规则编译器可读 `CombatStrategyInputs.roundResults` 中此前 PvP 胜场，用于 Ambessa 外交官双抗；当前联机冻结输入没有这段历史，因此该项按 0 处理。后续服务器应在冻结战斗输入时提供经过权威账本验证的胜场历史（双方分别绑定），不能由客户端推算。当前有限版本不阻塞；更改须补联机数值与冻结/恢复测试。完整近似清单见 `evidence/g2-2/RECONCILIATION.md`。
- **回应（2026-10-17，已实现）**：`snapshotForBattle` 用纯函数 `priorPvpWins()` 从本席权威 roundResults 推出此前 PvP 胜场（上限 7），写入 `PlayerBattleSnapshot.priorPvpWins`（0 时省略），双方各自绑定，恢复时重编译比对；服务器沿用现有冻结调用，无需另传。合同见 MULTIPLAYER_CONTRACT §10.11，测试 `tests/g2-2-online-emissary.test.ts`、`tests/server/g2-2-emissary-wins.test.ts`。
# P7-1 给 Opus 的接线交接（规则 PR，2026-10-15）

请从本规则分支 head 叠加服务器 PR；按用户确认，两份一起验、按顺序合，规则不单独发布。规范见 MULTIPLAYER_CONTRACT §21.6 与 MATCH_CONTRACT「P7-1 正式修订」。

- createCarouselMatch 同签名，改为免费艾瑞莉娅的 shared-deferred 开局。openingPending 从运行时状态删除，TS 可选成员仅供当前服务器编译；删除 room.ts/carousel.ts 的 1-1 专用分支。开局直接初始化共享池与商店；仅 opensCarousel 为 true 的五个 x-4 开盘，1-1 create/schedule 拒绝。
- 私有投影 pendingCarouselUnits 删除、改为 heldCarouselUnits。新 Match 字段 carousel.heldCarouselUnits；旧 pendingUnits 暂为严格镜像的废弃别名，供当前出售/resolve 入口过渡。界面 readHeldCarouselUnits 改读新投影。两处满才保管，场上未满时卡已直接放进 preparation 的合法格，照常参战。
- nextSharedRound 已自动在下一准备期（choice 之前）迁入并合星、同步 holdings；不要服务器另算。之后准备期卖出/部署腾空、buyXp 升级后调用保留名 resolvePendingCarouselUnits，原子发布 pool/state/events；临时位出售仍用保留名 sellPendingCarouselUnit。事件新增 carouselPreparationSettled，旧 carouselPendingClaimed 名字保留。
- tests/server/carousel-room.test.ts 的 1-1 开局、放行、断线、计时追赶、全选等待、拒绝开盘故障断言会失效；2-4 全局用例也依赖先完成 1-1，需移除旧前奏驱动。e2e/p7-carousel.mjs 的 1-1 段（包括切棋盘/空格/断线恢复）应迁到 2-4，并改查新开局与临时位三路落点。规则 PR 不修改这些文件。
# 黑市次级微光复制器显示交接（2026-10-17，Codex → Claude）

用户15:20批准：黑市100微光LootA/LootA4与200微光LootB1发“次级微光复制器”，只复制≤3费炼金男爵。领域继续自动领取/无目标托管，不新增可拖放工具或弹窗；征服者仍发“次级英雄复制器”。

- `G23RewardAtom.duplicatorDefinitionId?`及`readG23MechanismState(state).rewards[*].duplicatorDefinitionId`保留源身份：黑市为`TFT13_Crime_Consumable_LesserShimmerDuplicator`，征服者为`TFT_Consumable_ChampionDuplicator_III`。名称分别在`G23_POLICY.duplicators`中；这是领域元数据，不要求界面自行重算资格或候选。
- 已有正确名称：`src/presentation/s13-g23-manifest.ts:167`；已有图标：`src/presentation/s13-g23-asset-checks.ts:113`及`public/assets/s13/g23/loot/tft13_crime_consumable_lessershimmerduplicator.png`。不应改成通用小复制器或大微光的名称/图标。
- 若展示托管奖励，请按上述身份区分名称/图标，并使用服务端返回的候选；现有`src/rendering/online/loot-fields.ts:31`、`src/rendering/strategy-panel.ts:593`、`src/presentation/orb-loot.ts:125`处理的是库存工具，不应为此凭空创建`consumableId`或拖放入口。Codex本次未修改界面目录。
- 验收：黑市显示“次级微光复制器（≤3费炼金男爵）”，征服者显示“次级英雄复制器（≤3费）”；无合格目标仍保留托管，界面不自行授予英雄。

## G24-FORGE / 神器锻造器交接（Codex → Claude，2026-10-17）

领域分支codex/g2-4b-artifact-forge基于#147 d3112d6。第10/14档自动产生通用forge窗口，4个offers是神器definitionId，source为conqueror，超时项为offers[0]，选择/收据/私有投影沿用既有接口。按物品注册表和神器ID集合区分神器标题，不依赖kind=completed或字符串前后缀猜类别。展示需求仅为四件物品和说明、当前候选与超时项；布局沿用现有通用弹窗。

辅助锻造器和第11/13档尚未开放，等待#149与后续领域批。源归档确有TFT_ArmoryKeySupport及“辅助装锻造器”文本，请后续修正choice-fallback中“14.24 has no support anvil”的断言；继续采用用户指定名称。领域合同见MATCH_CONTRACT的G2-4B段，不在服务器/客户端重算奖励或候选池。本批未做联机UI验收。


### G2-4b WIP — Zephyr combat presence (Codex data contract)

`toCombatViewState` / compact replay units expose optional `banished:boolean`.
Absent means ordinary presence. `true` means the unit is alive but temporarily
outside combat; `false` marks its return. Combat frames already carry this
field as ordinary unitUpdated changes. Claude's display adapter should consume
it without changing HP, death, targeting, or economy. Acceptance: tick0–99
shows the temporary absence; tick100 returns at the authoritative cell; no death
or new inventory unit is inferred. Codex has not changed UI/server files.

### G2-4b WIP — movable preparation Voidspawn (domain API ready)

`simulation/match` exports `readItemSummons(state)` and
`moveItemSummon(state,itemInstanceId,cell)`. Read returns derived origin records
with the owning item/unit and projected Unit location. Use this for preparation
summon presence; it is not an inventory unit and takes no population. Movement
returns the standard MatchCommandResult and is locked with the combat roster.
The same item retains its chosen cell across rounds/save; stage changes update
combat stats. Claude needs to wire presentation and server-entry/command dispatch
without computing stage values, creating assets or changing economy. Acceptance:
move during preparation, freeze for battle, restore the position, mirror seat B
once, reject movement while roster locked. Codex changed no UI/server files.

## S13-P1：收入显示与未完成接线（2026-10-18）

- 已有 `previewRoundEconomy` 已按遥遥领先/对冲基金/投资策略II返回真实利息预估；`src/rendering/strategy-panel.ts` 直接使用旧 `getInterestGold` 的展示仍需Claude切到此查询，避免无利息显示5G或100G只显示5G。领域结算已正确，界面未改。
- 双刀流是一次获得2件库存成装，沿用物品投影。无自动穿戴或覆盖旧装备。其余未实现异常不得展示为可选。
- 双排待接：满席时选择事务须创建真实单位所有权、占共享池；腾位后的领取/升星需要shared command事务。当前room的plain deploy与PvP锁定不经过该事务，原型未注册。
- 贪财化身待接：联机冻结战斗必须接纳战中合法买卖/刷新/买XP的真实经济事件，恢复须重演同一事件输入。当前仅开战余额快照不能表示原版实时持有金币效果，原型未注册。
- 进入未知、终极英雄待接：需跨轮暂离持有者及4星单位完整投影/共享池/恢复，当前不提供半实现选择。

## UR-I3-01：联机战斗帧带上单位当前状态种类（已实现，v15 第四块，2026-10-20）

需求原文（来自 PR #246 分支）：

- 字段：`CombatViewUnit` 增加可选 `statuses?: readonly { kind: StatusKind | 'channel' | 'redirect'; harmful: boolean }[]`，按当前快照取"生效中"的状态（跳过未生效和被同类更强来源压制的贡献，与 `readUnitStatusRows` 的 state 判断一致），同种类同极性去重；变化时随 `unitUpdated` 下发。
- 用途：联机帧现在只有护盾数值，联机界面只能画护盾图标；眩晕、灼烧、重伤等看不到。界面不能从 statusChanged 事件顺序自己推算。
- 验收：联机一场含眩晕/灼烧的战斗，图标出现与消失的 tick 与单机同一场一致；关键帧/断线重连后正确；不改任何规则结果。

实现：领域只读回放投影直接复用纯函数 `readUnitStatusRows`，仅保留 `effective` / `active` 行，复制 `kind/harmful`，按二者去重。顺序固定为 kind 的 ASCII 字符升序，同 kind 下 `harmful:false` 在前；无状态显式发 `[]`，最后一项消失也会产生 tick 末 `unitUpdated.changes.statuses:[]`。初始帧、关键帧、终态、`unitEntered.unit` 均带完整数组。护盾沿用 `shield` 数值，不加入 statuses。类型 `CombatViewStatus` / `StatusKind` 已经 server-entry 导出。

本轮未修改 presentation/server/UI，直接复用避免在禁改文件外复制状态判定；该读取函数没有 DOM/Phaser 运行时依赖。netProtocol 与 claimOrb 共用目标 4，不另升版本。只读帧及关键帧恢复测试已通过；实际联机图标接线/浏览器验收留 Claude。旧帧指纹本轮不重录，清单和测试结果见 [v15 第四块](LOOT_ORB_CLAIM_V15.md#v15-第四块ur-i3-01-联机战斗状态种类)。

## V16-UI-01：史诗奖励与统一工具适配（领域完成，界面待Claude）

本任务明确禁止Codex修改presentation/rendering。当前编译阻塞位于 src/presentation/loot-view.ts:48 和 orb-loot.ts:43/48：旧工具名/图标枚举缺少reforger、两种复制器，失败映射缺少bench-full（共6条tsc诊断）。另外两个payloadLabel必须处理新增forge分支，复制器成功预览必须显示复制目标，不能走“重铸—”文案。现有consumableTargetHint已读取targetKind，领域四种工具均为unit；界面不得自算合法性。

字段与来源：CONSUMABLE_DEFINITIONS[id].name / description / targetKind；ConsumablePreview.effect='remove-all'|'reforge-all'|'duplicate-unit'，affectedItemIds表示永久装备；failure='bench-full'；LootPayload.kind='forge'与definitionId，名称由EPIC_REWARD_NAMES提供（成装锻造器、神器装备锻造器）；冠冕显示金铲铲冠冕。RevealedOrbView.tier/entryDropIds保持领域冻结值，不重算颜色/概率。

用途：准确展示新工具、满席拒绝与锻造器领取内容。继续调用useConsumable/claimOrb/selectChoice；不改变排版、动画或规则。

验收：tsc无旧枚举错误；两种复制器/重铸器/拆卸器名称与14.24 zh_cn一致；forge不进入英雄渲染回退；复制预览、bench-full拒绝可读；单位整装重铸目标正确；联机领取后四选一及重连收据展示正确。未获越界修改授权前，Codex只提交领域和此需求，保留明确编译阻塞。

## V16-UI-250：终极英雄与进入未知

对手公共棋盘目前保留物理 3 星；有效 4 星已在战斗录像中提供。原版侦察是否公开四星 **尚未核实**，不能将当前回退描述成原版隐藏规则。#265 离线核对的 14.24 map22 元数据含升级描述和 NumRounds=3，但两个执行引用未收录，也没有客户端星级显示/网络复制字段；技能 rank 4 表不能证明对手可见性。证据见 [侦察可见性审计](evidence/v16/scouting-visibility-audit.json)，可用 `node scripts/audit-d14-scouting.cjs` 复核。当前禁止联网且不改服务器，因此不凭推断新增公共标记；后续取得本地原版客户端执行/同步证据或可核验录像后再决定。此项保留证据缺口。

领域生产合同（Codex，2026-10-20）：同一 v16 注册两个异常，单机56/联机55；现有选择目标/选择/付费刷新命令签名不变，不另增界面规则计算。

- `PrivateSeatView.d14Display?`：`anomalyId, choiceId, unitId, phase(waiting/promoted/absent/returned/retired), dueOrdinal, remainingSettlements, effectiveStarLevel, physicalStarLevel`。进入未知 absent 时另有仅本席可见的 `heldUnit, heldItems`；它们已从 `preparation.units/items` 移出，不提供出售/装备/复制控件。满席到期显示等待空位，不能当成已获得增益。
- 终极英雄私有单位行在 promoted 时有 `starLevel:3, effectiveStarLevel:4, sellGold, poolCopies:9`；`d14Display` 也提供同一 sellGold/poolCopies。sellGold 直接查询该英雄三星售价（1费9、2费17），出售说明写 **“与该英雄三星同价（专用永久晋升，物理9份）”**，不可写死9金或按通用四星27份推导售价/退池数；目标准入仍仅一费。
- 公共 `CombatViewUnit.effectiveStarLevel?`：晋升单位为4，其余省略并读取已有 starLevel；`choiceEffects` 包含两个异常的名称/说明。物理 starLevel 仍1–3，UI 不能把它写回4。
- 私有 `d11Display.definitions` 现在也提供两个 D14 异常的名称/说明；待选择的报价也可读取。`remainingSettlements` 是权威数据，不按动画、计时器或 Continue 点击次数另算。
- 验收：3星1费目标能看到终极英雄、其它目标不提供；选择后3次真实结算晋升显示四星且卖9金；进入未知携装备离场，倒数归零满席仍等待，腾位归来显示永久+50%AD/+50AP；读档/重连不重复发放。其它席的候选和托管装备不进入公共投影。

只定义数据和行为，不规定视觉布局；服务器/表现层接入由其负责人完成。本轮实际 `tsc --noEmit` 通过，无额外编译阻塞。前一节 V16-UI-01 的编译诊断是史诗奖励交接时记录。

全套检查另发现 `g23AnomalyApiName` 缺少两个 D14 名称映射；基线还缺 D11 的贪财化身/猎头者映射。最小待审补丁为 `artifacts/v16-recording/UI_ADAPTER_250.patch`，只补四个已由本地来源证实的 apiName，不改布局、素材或规则；未写入表现层源码。该补丁不包含四星、售价、离场倒数等控件接线，仍须完成上面的验收。准备阶段四星基础/技能应读取领域导出的 `d14UnitBase(unit, true)`，上场后的含装备/羁绊数值读取 `buildStrategySnapshot(state)`；战斗中读取现有 `CombatViewUnit` 数值，不能在界面自行续推星级倍率。

### #265 / #270：有效四星技能说明（已提供）

`src/simulation/ability-display.ts` 导出纯查询 `ultimateHeroAbilityDisplayValues(definitionId: string, stats?: AbilityDisplayStats): Readonly<Record<string, number>>`。仅供已认证 `effectiveStarLevel===4` 的终极英雄使用；返回已替换派生值与表达式的只读 token 映射，直接交给现有模板。默认 AD 取专用四星基础值、AP=100；传入快照 AD/AP 时沿用普通技能说明的整数边界（0–1000000），无效英雄/数值抛 `RangeError`。函数不授予晋升，不改变物理星级或玩法。

来源复用 `d14UnitBase` 的实际 rank 4 表及 14.24b 辛吉德 DR=60% 覆盖，不能外推三星。`src/presentation/ability-text.ts` 仅做显示映射：`abilityText(id,4,stats)` 调用此查询，普通 1–3 星沿用原函数。Lux 默认伤害1260/护盾300，150AP时1890/450；辛吉德减伤60%。14个一费英雄模板无未替换 token，原有1–3星显示回归通过。

## V16-UI-251：侦察显示终极英雄有效四星（Claude → Codex，2026-10-20）

决定来源：用户 2026-10-20 14:38 确认侦察里显示四星；四星样式为四颗铂金色偏青绿的星（不是三颗金星再加一颗）。卖价、卡池份数仍不进侦察。这一条覆盖上节 V16-UI-250 中"对手公共棋盘保留物理 3 星"的回退。

需要的公共导出（`src/simulation/`，Codex）：

- `d14PublicUnitMark(state: MatchState, unitId: string): { readonly effectiveStarLevel: 4 } | null`
- 含义：该席的终极英雄已晋升，且 `unitId` 就是晋升单位时，返回 `{ effectiveStarLevel: 4 }`；其余情况（未选、waiting、retired、换了单位、进入未知）一律返回 null。判定与 `toPrivateSeatView` 中给私有单位行加 `effectiveStarLevel:4` 的条件完全一致，并由同一处实现共用，不再内联两份。
- 不返回 `sellGold`、`poolCopies`、`remainingSettlements`、`phase`，这些都是私有信息。
- 纯查询，不改 state，不消耗 RNG；对不存在的 unitId 返回 null，不抛错。

用途：

- 服务器侧（Claude）`src/server/room/projection.ts` 的公共阵容投影，给场上和备战席中命中的单位加 `effectiveStarLevel: 4`；物理 `starLevel` 保持 3，不写回 4。
- 界面侧（Claude）`src/rendering/online/opponent-board.ts` 侦察棋盘和标题优先读 `effectiveStarLevel` 画四星，没有这个字段时沿用 `starLevel`。

验收：

1. 晋升前（waiting）调用返回 null；3 次真实结算晋升后，对该单位返回 `{effectiveStarLevel:4}`，对同席其它单位返回 null。
2. 晋升单位卖掉或离开棋盘和备战席后返回 null；读档、重连后结果相同。
3. 结果与 `toPrivateSeatView(state)` 中该单位的 `effectiveStarLevel` 一致（有 4 就是 4，没有就是 null）。
4. 其它席的投影里只多出 `effectiveStarLevel`，不出现卖价、卡池份数和倒数。

## v19 第二部分领域交付（2026-10-21）

- 本人羁绊说明底部：seatMechanics.seat.familyHeist 为 CurrentReward / CurrentProgress / CurrentRewardValue / currentRewardName / progressText / policy；readG23MechanismState 返回同一显示投影。presentation/trait-text 导出 familyTraitFooter(display)，只格式化领域字段。Claude把这些行接到现有说明底部，界面不累计/抽奖。
- 准备跳舞：familyReunionView 返回六实例ID、原星级/战斗星级、eligible、回移标记及未验证阵亡政策；单位战斗 effectiveStarLevel 与 familyReunion 由领域冻结，动画只消费。4星缺证参数明确占位；PBE退星分支已按用户批准启用，仍标未验证。
- 奖励：现有 claimOrb 支持 source=family 的可部分领取法球；readLootView().unclaimedOrbs / 本人私有视图给出剩余原子。联机战斗点击仍排队，结算后统一领取；不额外执行claimG23Reward自动发放。
- 六费id严格 warwick/viktor/mel。三人的模型/骨骼/动作/特效素材由另一任务提取，当前任务未包含素材，也未修改3D或渲染器。
- 纹章：readItemCatalog 已提供22种批准属性、16配方和不可合成信息；现有物品说明消费该查询。
- 服务端原样透传 g23Facts.family 和 melCasts，规则自行进度/保命；schema/save/replay升9/5/4。公开命令封套版本不变，发布前排空旧对局。详见 V19_PART2.md。

## PR #364 / #365 只读字段交付（2026-10-21）

- `toPrivateSeatView(state).familyReunion.{eligible,participantIds,downgraded,downgradedAtTick}`：准备期资格及当前战斗权威成员/退星事实。战中即使出售/转装也读取冻结开场；`readG23MechanismState(state).familyReunion` 提供等价字段。
- `toPrivateSeatView(state).shopOdds.sixCostBps`：当前每格六费档位概率，整数基点（10000=100%）；不以界面等级/时间另算。六费空池回退由规则处理。
- 字段类型、数值锚点及 CI 逐条根因见 [PR364_CI_REPAIR](PR364_CI_REPAIR.md)。六费现有头像缺省使用代码图形；没有加入素材映射或复制外部资源。


## 开局奇遇 PR1 → PR8 数据交付（Codex，2026-10-22）

规则公共查询 `readOpeningEncounterView(state)`，由 `src/simulation/match.ts` 与 `src/server-entry/index.ts` 导出；本人 `toPrivateSeatView(state).openingEncounter` 已有同一字段。公共 PlayerView/网络协议的接线留给 Claude PR8，本 PR 未修改服务器或界面。完整签名/失败/存储约束见 [MATCH_CONTRACT](MATCH_CONTRACT.md#开局奇遇-pr1规则框架2026-10-22开发身份尚未录制-epoch)。

| 字段 | 含义与用途 |
| --- | --- |
| configVersion / encounterId | 已选配置/稳定规则 ID，全体一致；重连读原值，不重新抽选 |
| sourceEncounterId / portalId | 研究原始 Encounter/Portal ID；用于后续素材映射，不能当第二个规则 |
| champion | `{name_zh,name_en}` 或 null；没有奇遇没有角色，不虚构角色 |
| nameZh / nameEn | 官方中英文 UI 名，用于开局中央角色说明与顶部横幅 |
| descriptionZh | 研究原文效果说明，非“本局已生效”承诺 |
| enabled / effectStatus / statusTextZh | none 为 true/no-additional-rules；其余 false/not-implemented，必须同时显示“效果尚未启用”，不能显示已发奖或替换成没有奇遇 |
| readiness | ready-for-followup 或 blocked-evidence，只说明实现准备情况，不是玩法开关 |
| revealedFacts | PR1 固定空数组；后续只追加已发生的共享结果，未来分支不公开 |

验收：同一根 seed 的八席（含机器人）与单人结果一致；刷新视图/恢复不发奖；任何公共 payload 均无 seed、selectionRng、未来奖励和个人候选。shared-deferred 仅为服务器建席前内部状态，查询返回 null，不应向已开始玩家展示。模式/布局/颜色/动画由 Claude 决定；此处只定义显示内容与数据源。演出计时由服务器展示阶段控制，不进入 simulation 时钟。



## 开局奇遇 PR6 → PR8：梅尔本人门槛进度（2026-10-22，Codex交付）

集成命名：锻造器使用独立 `openingForgeProgress` / `readOpeningForgeProgress`；梅尔使用下述字段；不再发送旧 `openingEncounterProgress`。

来源：`toPrivateSeatView(state).openingMelProgress` / `readOpeningMelProgress(state)`（simulation/match导出；新reader的server-entry重导出留接口负责人PR8）。现有公共 `openingEncounter` 白名单不变。仅定义显示内容与数据来源，不指定布局/配色/动画。

| 字段 | 含义 / 使用 |
| --- | --- |
| 整个值为null | 非梅尔奇遇或尚未绑定；没有个人门槛展示 |
| encounterId / thresholdHp | mels-blessing / 40；展示奇遇与个人门槛 |
| thresholdReached | 本人已记录首次存活跨越门槛，**不代表发奖** |
| rewardStatus | 当前恒为blocked-evidence；奖池缺证，奖励关闭 |
| triggeredRound | 首次观察的回合ordinal；未触发为null，显示回合标签沿现有目录映射 |
| hpBefore / hpAfter | 首次跨越前/救命后最终HP；未触发均null |

验收：41→40与41→39均达门槛，0HP不达门槛；已触发后重连/Continue/重发不重记，不由UI扣血、抽奖或生成选择；只给本人，不广播对手进度。公共enabled=false与“效果尚未启用”继续保留；个人应明确区分“已达门槛，奖励未启用”和“未达门槛”，不能显示已领取/待领取，不展示固定两冠冕。内部收据ID、seed、RNG、全局context不透传。

沃里克仍只展示公开身份及关闭状态，不给掉率、奖池、保底/上限占位数值或击杀奖励动画。其预留接口统一拒绝发奖，不接成客户端按钮。梅尔没有上场梅尔要求；六费梅尔救命事件沿用现有playerSaved，与奇遇进度分开读取。

存储位置为 `SharedPoolState.openingEncounter`（已有 room.pool 的全局领域上下文），席位 `MatchState.openingEncounter` 仅绑定；不要在 Room 复制一份可变 RNG。PR2 的激活/锻造器收据、当前候选及本人进度投影已启用，接线见下方 PR2 节；PR5 猴子及工具选择已启用，见下方 PR5 节；PR6 梅尔门槛观察已启用但奖励关闭，沃里克关闭；PR3/7 其余效果尚未启用，魔像训练师保持关闭，见 PR4 节。

## 开局奇遇 PR2 → Claude（2026-10-22）

六项已启用：范德尔全黄金、艾克全棱彩、黑默丁格首次/末次棱彩，蔚1-2两个基础装备锻造器、杰斯1-2一个神器锻造器。PR5猴子另已启用，其余8项效果仍关闭；没有奇遇沿用无附加规则。完整领域签名、来源与失败语义见 MATCH_CONTRACT / MULTIPLAYER_CONTRACT 顶部 PR2 节。

- 公共字段：既有 `openingEncounter` 白名单形状不变，启用项 `enabled=true`、`effectStatus=active`、`statusTextZh=本局奇遇效果已启用`。前奏/终章其余档位是已批准等权项目约定，不能显示成“其余必不棱彩”。
- 本人字段：`openingForgeProgress?={source,effectsApplied,forgesGranted,forgesResolved,forgesPending}`，来自 `toPrivateSeatView`。pending数量包含当前待选，组件最初2→1→0，神器1→0；仅组件/神器锻造器有授予收据时出现；强化、猴子和梅尔不出现此字段。仅本人可见。
- 本人选择：已有 `pendingChoice.kind=forge`、`offers`（恰好4项）、`choiceId`、`generation`、`payload.source=opening-encounter`、`payload.timeoutOption`。用既有choose回调；领域依次开下一份，界面不能生成候选或扣减数量。现有强化 `augmentTier` 和逐槽 `augmentOptions.rerollAvailable` 已按奇遇处理。
- 本人结果：`seatMechanics.receipts` 中 source=opening-encounter 的choice记录含optionId/itemId/timedOut；`openingEffectApplied` 是授予/激活事件，`mechanicGranted` 是实际选择完成事件，不要把前者当装备已入库。
- 服务器接线：initializeSharedSeat已授予，不能另发一次。timeoutChoice每次处理一个choiceId；处理后若还有新待选，应继续依据新ID处理，重连只读当前state。PR8如需要新helper，可在server-entry按合同重导出；本PR未修改该目录或服务器。
- 验收：八席同奇遇/同强化档位、候选仍各自独立；两个锻造器先后选择，不被其他面板覆盖；超时选第一候选、重连不重抽不重发；其他玩家收不到本人待选/后续候选/seed/RNG。布局、颜色和动画由Claude决定。

## 开局奇遇 PR5 → Claude：猴子结果与杰作升级（2026-10-22）

规则已启用发条猴子四分支；不改本文件前部历史记录，当前合同以 MATCH_CONTRACT / MULTIPLAYER_CONTRACT 首节 PR2+PR4+PR5+PR6 集成说明及各奇遇专节为准。本节只规定数据和回调，不规定布局、颜色、动画。

| 字段/入口 | 含义、用途与验收 |
| --- | --- |
| `openingEncounter.enabled/effectStatus` | wind-up-monkey=true/active；角色爆爆，nameZh=发条猴子；权重500 Bps不变 |
| `openingEncounter.revealedFacts` | 3-5前为空；触发后 `[{nodeId:'3-5',outcome:'damage'|'gold'|'masterwork'|'components'}]`；显示已发生结果，无seed/RNG/未来分支。观战投影用 `readOpeningEncounterView(match,pool.openingEncounter)` |
| `nextSharedRound(...).openingResolution` | 全局结果及同批`eliminated[{seatId,rank,hpBefore,hpAfterRaw}]`、`ended`、`survivorRanks`；Room应一次同步hp/alive/rank并处理终局。pool已经返还新淘汰者的卡牌；不要再返池、扣血或重新算名次 |
| `openingMonkeyResolved` | 伤害事件，含receiptId/hpBefore/hpAfterRaw/hpAfter；10点可致死，负数raw供名次依据，显示HP读领域playerHp |
| `consumables`、`consumableTargets` | 杰作工具definitionId=`masterwork-upgrade`，姓名/说明读CONSUMABLE_DEFINITIONS；目标列表及allowed/reason读现有本人视图。调用useConsumable的unit目标，不直接发item目标 |
| `pendingChoice` | armory/source=masterwork-upgrade，payload.masterwork={consumableId,unitId}，offers是物品**实例ID**，不是装备定义ID；工具此时尚未消耗 |
| 本人可选 `masterworkOptions` | `[{itemId,definitionId,radiantDefinitionId}]`，当前装备→光明版。亦可用match导出的readMasterworkOptions；不要由UI另写映射或筛选规则 |
| `choose` / `timeoutChoice` | 选择时definitionId参数传offers中的实例ID；超时默认第一项。成功后工具耗尽、仅选中件变光明并进库存；重复/无效选择不扣工具。候选窗口期间交易、装备操作与战利品法球领取按领域wrong-phase处理 |
| `seatMechanics.receipts` | 金币/组件/工具授予source=opening-encounter-monkey，选择source=masterwork-upgrade；不得把来源误显示为征服者或PvE |

**工具图标接线（当前工作树已补键，保留验收要求）：**`src/presentation/orb-loot.ts:48` 的 `TOOL_MARK: Record<ConsumableDefinitionId,...>` 已含`masterwork-upgrade`键；源API名`TFT_Consumable_MasterworkUpgrade`在本地 `src/simulation/content/g2-3-loot-source.ts` 已有记录。图标/缺图降级由Claude决定，不要求下载资源。PR5 独立报告记录过该缺项的 TS2741；当前是否通过以集成后的 typecheck 为准。本次冲突处理未修改界面或放宽类型。

PR8另接server-entry新增readMasterworkOptions/相关类型重导出、网络本人字段、Room全体淘汰/唯一幸存者终局，且协调领域command6与网络协议版本。验收八席同一分支、组件身份各人独立、工具候选只给本人、失败不耗工具、恢复不重抽不重发、先淘汰观战仍见全局结果；全体死亡与并列HP按领域返回名次发布。公开站点/服务器上线前须完成接线；不以已有自动nextSharedRound钩子代替Room状态同步验收。

## 开局奇遇 PR4 → Claude：魔像训练师保持关闭（2026-10-22）

- 数据继续取 `readOpeningEncounterView(state)` / `toPrivateSeatView(state).openingEncounter`；未增加界面字段，未改服务器传输。`encounterId='trainer-golems'`、`nameZh='魔像训练师'`、`champion`为安蓓萨；必须同时使用 `enabled=false`、`readiness='blocked-evidence'`、`statusTextZh='本局抽中此奇遇，效果尚未启用'`，`revealedFacts=[]`。
- `descriptionZh` 是来源说明，不代表已发魔像。验收：抽中时保留安蓓萨身份和关闭提示，重连不触发奖励，不生成假单位/装备/羁绊/人口，不创建魔像移动、出售或工具目标。
- 未提供魔像实例ID、属性/成长、人口/位置、永久纹章ID或个人抽样结果：完整纹章池、魔像属性成长、人口及出生/移动规则仍待补证。现有普通召唤物与纹章机制不能证明这些规则。
- `TRAINER_GOLEMS_POLICY`、`validateTrainerGolemEmblems`、`applyTrainerGolemsOpening` 从 simulation/match 导出，属于关闭状态领域接口；后者永远失败，不能接成正常初始化动作。PR8 如需服务器诊断接口，由边界维护方重导出；不向客户端传入全局seed/RNG。完整签名/失败枚举见 [Match合同 PR4节](MATCH_CONTRACT.md)。
