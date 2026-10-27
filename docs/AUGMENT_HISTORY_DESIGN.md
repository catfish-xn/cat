# 强化历史证据设计与实现（方案 A）

基线：`codex/v25-augment-history`，`ee2b019cc8d60fb11679d9ce8c54338f5ea4ea57`，来自 `claude/v24-integration`（PR #456）。本任务只提供历史基础设施，不新增任何强化定义、报价、奖励公式或现有内容数值，不提交 Git。

## 保存边界与版本

唯一新增的持久字段为 `MatchState.augmentHistory?: AugmentHistory`，内部版本严格为 `augment-history-v1`。只有 `augment-history-owners.ts` 登记的持有者才写入；登记的 ID 是后续任务的集成约定，不是开放候选池。未持有者既不写空数组，也不写版本占位。以基线程序独立生成的四个 SHA-256 检查点验证原始保存字节不变，另验证旧档恢复再保存不变。

沿用 MATCH_CONTRACT A2/A4/A5 和 `shop-history-v1` 的条件证据规则：外层 **schema/save/replay/command=12/8/8/7**，规则联机协议 **5**、WebSocket 封套 **6**，rules/content/digest 均不变。没有新增客户端命令；死亡采样不扩展 `CombatState` 或战斗事件 JSON，不改变战斗回放协议。选秀附加收据仍使用现有字段，仅增加有证据绑定的唯一收据 ID 形式。本任务不需要重录原有 epoch。以后实际开放强化、更改战斗输入/数值时，由该任务按版本规则另行处理。

持有者缺字段的错误：`Invalid augment history: missing augment-history-v1; history-dependent augment saves cannot be authenticated`。不推测迁移、不把旧进度补成零。不认识的版本、无持有者却有历史、错席位/回合/资源前缀、增删改事实、无法认证的证据均拒绝。

## 数据与归属

完整 TypeScript 定义在 `src/simulation/augment-history-types.ts`。顶层为 `{version,seatId,facts,proof}`；单人席位 ID 为 `solo`，联机为服务器凭证对应的实际席位 ID。每个 fact 都包含连续 `sequence`、`seatId`、自然轮 `round/roundId` 与 `resourcePrefix`。单位始终使用实例 ID；板上格、备战席槽位、星级、定义 ID、装备实例和位置均保留。位置不是按数组顺序猜测。

| 事实 | 记录时点与含义 | 需求 |
| --- | --- | --- |
| `acquire` | 选择事务中，获得拥有条目后、执行专属获取效果前；冻结选择前金币/玩家 HP、正式单位/装备、choiceId、逻辑准备时间及上一场真实开战阵容的可用性 | B5-10、26/29/30、45；本金不会从战后余额倒算 |
| `round-entry` | 下一自然轮入口：上一轮收入已付，新的被动经验、商店、选秀放置和本轮奖励之前；完整正式棋盘和备战席 | B5-32/33、38、57；多次 Continue 不能重复 |
| `positions` | 成功公共命令或房间原子发布改变正式单位/装备后；覆盖手动部署、购买/合星、售出、装备、选秀后放置 | B5-26/29/30、37 |
| `combat-roster` | 单人真实开战时，包含 PvE 和 PvP；取得时还携带之前一场的冻结快照 | B5-10 的“上一对战”不局限 PvP |
| `pvp-roster` | 联机自动布阵后、锁名单及编译战斗前；全桌八席含已淘汰席，另存本战 ID、mirrorOfSeatId；单人为实际自身阵容 | B5-31、37；镜像源不会作为额外真人重复计数 |
| `table` | 首次取得、后续入轮、整轮淘汰/排名原子提交后；每席 HP、存活、名次、淘汰轮、阵容 | B5-34、37、38；取得时即可读取以前淘汰席，不凭缺行判断存活 |
| `growth` | 未来强化领域事务调用通用 API；唯一 receiptId、choiceId、每普通英雄的 HP flat/Bps、AD Bps、AP **百分之一点** `abilityPowerCenti` | B5-31、38、57；150 centi=1.5 AP，150 Bps=1.5%，没有浮点保存 |
| `carousel` | 每笔真实选取并授予完成后；完整收据、同轮 ordinal、manual/bot/timeout/disconnected/augment 来源、可选来源 choiceId、落位快照、放行逻辑毫秒及持有资格 choiceId 列表 | B5-26/29/30、35/36、44；同席同轮可有多笔且独占不同槽 |
| `preparation-time` | 显式、单调的整数准备期逻辑时间；不读取墙钟，不复用战斗 tick | B5-07 |
| `deaths` | 真实死亡事件产生时保存装备及普通英雄身份；按战斗 ID＋eventSeq 唯一，携带 tick、单位、team、实际 ownerSeatId、原始实例 ID；完整 tick 边界即使零死亡也保存 | B5-42、46；复活后再次死亡不会被 unitId 去重 |
| `player-damage` | 双边结算全部完成后，读取对手 RoundResult.hpBefore/hpAfter/hpLost；后续治疗不抵销已发生扣血 | B5-43、47；过杀已截断，Mel 保命已应用；镜像明确为0 |
| `player-health` | 为 B5-44 的后续领域事务预留强类型事实：choiceId、唯一收据、实际 HP 和最大 HP 的前后值 | 不在本任务实现 +20、提前放行或改变 HP 上限 |

`previousBattle` 显式区分 `recorded / none / unavailable`。运行中的单人命令链和房间会保留上一场阵容，直到取得强化后才把证据写进节。**从旧的、不含历史的准备期快照恢复，无法凭当前棋盘倒推出上一战**；`readPreviousAugmentBattle` 对 unavailable 抛错，未来依赖上一战的选择逻辑须在提交奖励前检查，或使用已有已验证战斗档案补足，不得当作零人。现有无历史旧档本身仍可原样读取。

单人 PvP 是规则生成的敌方阵容，现有模型没有“敌方玩家 HP 账户”。因此单人 `player-damage` 的 opponent/HP/actualDamage 明确为 `null`，不是0。B5-43/47 后续任务不得把这个未知值解释为真实在线玩家扣血，也不得用未截断的 `SideProposal.damage` 代替实际扣血。

## 认证，而非自签名

### 单人

`proof.kind='solo'` 保存无历史持有者的合法起点 `origin`，以及成功公共命令 `{name,args,count}`。连续 stepMatch 可压缩 count。起点不允许嵌套 augmentHistory 或多人状态。命令参数和事实均脱离调用者对象；激活时起点复制并冻结。未持有时的命令跟踪仅在 WeakMap 中，不改变存档字节；恢复旧普通快照则以已经验证的快照为起点。

对象、JSON、`serializeMatch` 三入口最终走同一检查：先界限/结构校验，再认证起点，按固定白名单重演公共命令，重建事实和最终完整 Match，逐字段比较。资源、位置、金币、本金、成长来源、时间、战斗结果必须同时吻合。独立调用 `recordAugmentGrowth` 后拼进保存，不能替代合法规则事务；重演会拒绝。外部战斗档案验证还检查强化历史和命令的已认证前缀只能延长。

这里采用与现有账本一致的规则一致性证明，不是签名。不能识别将整份输入改写为另一条完整合法轨迹的文件作者；也不声称认证旧普通快照格式从未保存过的事实。

### 联机

单席文件无法自行证明其它七席的历史。恢复使用 **独立的服务器权威对象**，不接受候选 JSON 自带的“authority”/摘要。`Room.augmentHistoryAuthority(seatId)` 从当前服务器席位捕获独立副本；`captureAugmentHistoryAuthority` 是服务器持久化集成内部入口。返回的是 WeakMap 品牌句柄，冻结或 JSON 反序列化一个同形对象不构成授权。

`restoreSharedOrbSnapshot(pool,input,authority?)` 先校验权威池、所有既有账本，再比较整个候选 Match 与独立副本。`restoreCarouselSeat(carousel,input,authority?)` 同样认证。持有历史强化时缺 authority 报 `missing independent server authority`；缺历史节先报旧档缺证据。没有相关强化的既有调用无需新增参数。

服务器必须从自身私有检查点/可信执行重建该 authority；**不能把客户端上传的 candidate 传给 capture 当证明**。当前仓库没有房间整局持久化/重启格式，本任务没有假造一个可独立导入的全桌档案。离线 restoreMatch 继续拒绝多人存档。

## 时钟、成长、选秀的通用接口

- `recordAugmentAcquisition(before,after): MatchState`：初始化节及获取证据；已接 selectChoice，专属效果调用通用 API 时节已存在。
- `prepareAugmentAcquisition(state,previousBattle,elapsedMs): void`：房间在手选/机器人/超时选取前注入自身私有上一战与时钟上下文，仅写 WeakMap；取得效果执行期间已经可读，不能延迟到发布后才提供。非房间调用不可把候选档当可信上下文。
- `recordAugmentRoundEntry(state): MatchState`、`recordAugmentTransition(before,after,events?): MatchState`：只记录成功事务；失败保持原 state，不发事件、不用 RNG。
- `requireAugmentFacts(state,kind,round)`：返回指定族的脱离对象副本；没有该轮记录即抛 `missing <kind> for round <n>`。空 `deaths:[]` 是有完整性边界的零，缺失一整行不是零。
- `readPreviousAugmentBattle(state,choiceId)`：读取取得前上一战证据；不把 unavailable 当 none。
- `recordAugmentGrowth(state,choiceId,receiptId,deltas)`：只允许持有来源、普通英雄、非负安全整数；同收据同内容返回原对象，冲突报错。`readAugmentGrowth(state,unitId)` 沿资源账本合星血缘累计，不接管 Tristana 旧 AD 账本。此任务只提供持久成长证据和读取器；最终战斗面板应用属于实际强化任务。
- `recordAugmentPlayerHealth(state,change)`：领域事务完成后记录真实 HP/最大 HP 前后值，绑定持有来源与唯一收据，当前 HP 必须等于 hpAfter；不执行治疗、不决定上限。重复收据同内容幂等，冲突拒绝。
- `appendAugmentFact(state,fact)`：内部领域扩展入口，不向网络开放。未来 player-health 等事实必须在可重演的真实领域事务内产生，不能把此函数当认证器。
- `advanceAugmentPreparationTime(state,elapsedMs): MatchState`：仅 preparation 或返回 preparation 的选择阶段；累计毫秒0～600000、单调，重复同值无动作，倒退/越界/错阶段抛错。单人驱动可直接调用并进入重演证据；房间只对 Shop Glitch 持有者在命令前、冻结前和50ms计时回调采样注入。取得事实记录选择时的准备期偏移，未来刷新效果从该偏移计算；不实现免费刷新本身。暂停时调用方不推进逻辑时钟；战斗/选秀时钟不能冒充它。
- `grantAdditionalCarouselPick(pool,carousel,match,seatId,slot,choiceId)`：未来奖励路由指定剩余槽，要求全部正常领取已结束且真实持有来源；复用保留/授予/卡池守恒与满席 held 流程，不负责抽签或选择获奖者。正常领取仍一人一次。额外 ID 为 `<carouselId>:<seatId>:extra:<1..8>`，来源、序号写在同一个 augmentHistory 节中，没有第二个版本节。关闭后已归还的剩余卡先重新保留再授予；失败返回原 pool/carousel/state，无 RNG 消耗。
- `recordAugmentTable`、`recordAugmentPvpRoster`：房间冻结和结算调用的规则接口，不供客户端提交事实。

记录 API 的错误统一前缀 `Invalid augment history:`。选秀事务沿用现有 `CarouselFailure`（invalid-match、stale-pool、slot-taken、invalid-slot、pool-exhausted、receipt-mismatch 等），不新增 wire reason。普通成功命令原事件/资源序号不变。

## 界限与保存所有权

v1 明确拒绝超过256自然轮、65536 facts、16384命令条、230400重演步、8席、每快照128单位/1024装备、单死亡批115328行、600000准备毫秒或16MiB证据预算的输入；递归深度小于64、节点不超过100万。先界限检查再重演，不用候选 count 分配战斗或无限循环。该预算只约束新增证据，不更改任何已开放内容的规则。实际启用持续产生日志的强化前，应按整局长度核算其预算，不能静默截断账本。

事实、命令参数、authority 和查询返回均有明确的独立所有权。死亡现场的旁路样本只用 WeakMap 关联真实事件，不向 `CombatState`、事件 JSON、回放帧或 UI 投影塞入新字段。房间只有在整轮结果被验证、排名确定后才发布事实；同 ID 重复结算沿既有逻辑拒绝。普通存档/无相关席位的房间不新增空字段。

死亡装备快照同时保留带槽位的 `equipment`（含临时标记）和没有装备槽的 `combatItemGrants`（不稳定财宝箱生成物，含真实来源、序号和取得 tick），不会漏掉战中获得的装备，也不为它们虚构槽位。

## 本次变更的全部接线点

| 文件/函数 | 改动 |
| --- | --- |
| `src/simulation/match-types.ts / MatchBase` | 唯一可选 augmentHistory 字段 |
| `src/simulation/match.ts / createMatch` | 初始化不序列化的单人命令追踪 |
| `match.ts / selectChoice` | 在取得后、专属效果前初始化获取历史 |
| `match.ts / nextRound, advanceMultiplayerRound` | 正常轮和加时入口快照 |
| `match.ts / deployMatchUnit, buyUnit, openAnvil, sellUnit, setShopLock, rerollShop, buyXp` | 外层成功命令追踪；位置/交易变更同事务记录 |
| `match.ts / startMatchCombat, stepMatch, lockMatchCombatRoster, autoDeployToCap` | 开战、死亡完整性与自动布阵边界 |
| `match.ts / openMatchCombatStream, stepMatchCombatStream, revealMatchCombatStreamTerminal, settleMatchCombatStream` | 流式 PvE 执行/终战交接；终战样本不会因 state 原先停在前一 tick 而丢失 |
| `match.ts / useConsumable, combineItems, equipItem, selectAnomalyTarget, rerollAugment, rerollAnomaly` | 操作历史 |
| `match.ts / forfeitPendingChoice, forfeitTerminalOrbs, claimOrb, claimOrDiscardLoot, chooseG23Junker, chooseG23BlackMarket, claimG23Reward` | 系统超时、领取和已有薄适配入口；嵌套调用只记外层一次 |
| `src/simulation/combat-s13.ts, combat-tick.ts / 死亡清理` | 现场装备/英雄身份样本 |
| `combat-effects.ts / stampCombatStep` | 样本关联到 stamped event，事件本身不新增字段 |
| `combat.ts / stepCombat` | 传递执行过程死亡样本，含复活后的再死 |
| `serialization-structure.ts / restoreMatchWithinCall` | 三离线入口同一 preflight、命令重演、恢复后追踪交接 |
| `battle-record-validation.ts / checkHistoryCarry` | 既有战斗档案的强化历史/命令前缀认证 |
| `shared-pool.ts / restoreSharedOrbSnapshot` | 独立服务器 authority 参数与校验 |
| `carousel.ts / planGrantCarouselPick, grantCarouselPick, pickCarouselForSeat, autoPickCarouselForSeat` | 正常/自动领取来源与落位证据；内部可指定具体附加收据 |
| `carousel.ts / grantAdditionalCarouselPick, restoreCarouselSeat` | 多收据事务及权威恢复 |
| `carousel-units.ts / validateCarouselMetadata` | 附加收据必须有同节来源证据 |
| `shared-pool-ledger.ts / assertSharedPoolConservation` | 认可有界附加收据 ID，既有单份库存守恒不变 |
| `src/server/room/room.ts / apply, freezeAndResolve, replace, dispose` | 准备期逻辑时间；完整全桌冻结；发布时获取/入轮表；条件计时器释放 |
| `room.ts / planSteps, commitSettlement` | 先取得双方实际结算，再写死亡/实际扣血；整轮排名确定后写表 |
| `room.ts / commitSeat, augmentHistoryAuthority` | 历史附加后的原子提交识别及独立恢复句柄 |
| `room.ts / prepareAugmentAcquisition, applyTimeouts, onChoiceDeadline` | 取得事务开始前提供私有上一战与逻辑时间，覆盖手选、机器人和超时 |
| `src/server/room/augment-history.ts`（新增） | 全桌采样、冻结名单、真实死亡映射、扣血记录及发布适配；不计算奖励 |
| `src/server-entry/index.ts` | 导出内部历史接口、类型、选秀额外授予入口 |
| `src/simulation/augment-history*.ts, augment-death-samples.ts`（新增） | 类型、归属登记、记录/读取、只读认证与旁路采样 |
| `tests/augment-history.test.ts`（新增） | 基线字节、单人三入口、篡改矩阵、通用成长、真实房间、多选秀收据 |

无 `src/rendering/`、`src/presentation/`、素材或客户端协议修改；没有把规则搬进房间。具体执行结果及剩余限制见根目录 `-o`。

## 验证记录

- 相关回归批次：13 文件、252 项通过，覆盖商店历史、Match 保存、双边战斗、结算、选秀、房间流式战斗、Mel 保命和实时金币。最后补充与接线修正后，4 文件、98 项通过（其中新增历史测试69项，生产身份/体积6项，准备期与选秀房间23项；批次有重叠，不累加）。Vitest 全部 `--maxWorkers=4`，只因共享 node_modules 的只读缓存使用 `--configLoader runner`；未删断言、未提高超时。
- `npm run build -- --configLoader runner` 通过，包含 `tsc --noEmit`；双摘要 `--check` 与 `git diff --check` 通过。content=`fnv1a32-utf16:db662e0b`，loot=`fnv1a32-utf16:18c876b2` 未变。
- `tests/server/lifecycle.test.ts` 的监听端口用例被沙盒 `listen EPERM 127.0.0.1` 阻断；该文件其余5项已通过。未声称真实网络端到端通过。
- `npm run build:server` 的打包完成，但既有目录边界检查失败：`combat-replay-view.ts` 导入 `src/presentation/combat-status.ts`。对 HEAD `ee2b019c` 独立解包并构建也命中同一依赖；本任务未修改该依赖或放宽断言，不将其记为新增历史回归。
