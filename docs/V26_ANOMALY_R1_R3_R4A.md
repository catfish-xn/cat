# v26 异变 R1 / R3 / R4a / R5 与待选禁售统一合同

本轮在 `claude/v26-anomaly-r1r3r4` 的 `0369ee6b` 上合并 R5 `761871a9`，只编辑工作区；六个冲突文件的工作区文本已整合，不执行 git add/commit。规则依据为用户 2026-10-29 批准、[流程审计](V26_ANOMALY_FLOW_AUDIT.md) 和共同简报第16条。R2 首次锁定、R6 字符串 ID 升序默认目标及 P-B5-81 便携异常政策保持原决定；不实现 R4b 阵容权重。

## 时钟、操作和报价

- Room 在 4-6 入轮直接进入 `preparation`，只设一次 75,000ms 总准备截止点。选目标、刷新、部分或全员确认均不重置、延长或提前结束它。测试显式 `preparationMs` 覆盖仍有效。席位 Match 以 `phase='choice'` / `pendingChoice.kind='anomaly'` 表达待选；无新 wire 命令，单人无真实时钟。
- 待选时允许上场、下场、交换、移动及原准备期合法的购买、D/F、锁店、装备操作，继续执行人口、位置和冻结阵容约束。**待选期间所有棋子禁止出售**，包括锁定目标、其他棋子、场上和备战席、锻造器出售转开启快捷入口；返回 `wrong-phase`、原 state、零事件、零金币/卡池/RNG/序号消耗。选秀暂存出售也受 preparation-only 门禁约束。确认后恢复出售权限，席位异变资格按 R5 保留。
- 异变界面打开时锁盘、隐藏后可上下场/移动，由前端接线；领域服务器接受部署/移动、拒绝出售，不以客户端显示状态授权。
- 初始空席仍走 preparation 招募门禁；无自动买牌或发棋。首次购买打开目标选择，不重设房间截止点。保护可买到一项商店卡的 D/F 门禁仍在；确认收据只创建一次。
- 首次免费报价计入初始12项，前12项排全部已见；第13项起只排紧接上一项，允许更早项返回。每次新报价恰耗一个完整 LCG 词，刷新1G；确认免费、不耗词。
- 合星消费待选目标时跟随 survivor，增加 generation，保留报价、历史、已付次数和 RNG。主动换目标仍拒绝。D14 目标下场时保留锁定/报价，刷新或确认返回 `invalid-target`，回合法位置后继续，不免费重抽。
- 超时先执行 `autoDeployToCap`，优先已锁定的 D14 备战席目标，再使用统一资格选目标和确认。**此部署对人类与 bot 席位都执行**；继续受人口上限约束，不挤走已部署单位。bot 自动部署改变了部分后续战斗/死亡路线，测试应按真实新路线验收。

原版证据沿审计 S2（14.24 超时排召唤物）、S4（4-6 planning=75）、S6（前12项保护；13.4 才改滚动窗口）。首次免费项计入12是本次批准口径；不宣称持有同版执行脚本。魔像/假人手动普通异变资格维持旧政策待证；超时排所有 catalog summon，锻造器所有入口排除。

## 统一资格与前端数据

由 `src/simulation/match.ts` 及既有 server-entry 导出；实现集中于 `anomaly-choice.ts`，输入必须是完整权威 MatchState，不可拿私有投影当保存状态。

| 接口 | 签名、结果和失败边界 |
| --- | --- |
| 资格 | `isEligibleAnomalyTarget(state: MatchState, unit: Unit \| undefined, offers?: readonly string[], purpose?: 'manual' \| 'timeout'): boolean`；拒绝非己方/未知定义/锻造器、已有 binding、已有 selection（休眠也拒绝）及轮盘收据未准备期结算的实例；所有 offers 都须满足 R2 和 D14 目标要求。timeout 额外排全部 catalog summon。无副作用。 |
| 本人名单 | `readAnomalyTargetIds(state: MatchState): readonly string[]`；仅合法 anomaly target 步骤返回 roster 顺序名单，淘汰、冻结、offer 步骤及其他阶段返回空；不是主动换目标授权。手动选择、本人名单、刷新/确认与超时挑选共用资格谓词。 |
| 历史 | `readAnomalyOfferHistory(state: MatchState): readonly string[]`；返回已发生的报价 ID，无 RNG/事件。历史只在权威 state 中认证，不给客户端作预测。 |
| 私有视图 | `toPrivateSeatView` 增加 `anomalyTargetIds` 和四字段 `anomalySelection`；保留严格白名单，不公开 RNG、未来计划或证明。对手公开板只读当前 binding。 |

`selectAnomalyTarget` 非法目标为 `invalid-target`；陈旧选择为 `stale-choice`，非 target 步骤为 `invalid-choice`，阶段或阵容冻结为 `wrong-phase`。刷新另可返回 `insufficient-gold`。失败保留原 state/pool，不产生资源、事件或 RNG 消耗。超时没有候选则按既有 empty-anomaly/forfeitedChoices 兜底，不制造第二次选择。

## R5 所有权、恢复和防伪

`anomalySelection={definitionId,championDefinitionId,choiceId,boundRound}` 保存席位资格，不含 unitId；`anomalyBinding` 只表示当前一个真实持有实例。选择事务写唯一 `anomaly-selected` 资源事实和 schedule receipt，原 unitId 是历史身份，出售后不改写。

当前持有者优先、合星随 survivor；出售/移除/永久变形后才找同英雄替补，按字符串 unitId 升序，只恢复一个原生实例；没有候选时 binding=null，selection 保留。轮盘托管或收据未结算卡等归位、合星后才参与，不能抢占。便携异常是独立复制例外；恢复到便携持有者时原物品退库存，保留 itemId/成长账本，随后装备预览和提交均为 `item-restricted`。

重获不重新报价、不重发金币/双刀流装备/便携异常、不改变 choiceId/boundRound 或推进 RNG。终极英雄仍须实体三星一费，原三次真实结算期限不重开；进入未知不重复离场/归来，出售已归来者后恢复原效果。实例成长出售删除，Headhunter 原生累计沿原 boundRound 席位账本；战斗冻结本场原生身份，战斗中恢复只影响未来输入。详见 [R5 所有入口和事件合同](V26_ANOMALY_R5.md)、[Match 合同](MATCH_CONTRACT.md#v26-r5--出售后保留异变2026-10-29-用户批准)。

报价证明只记录选择窗口，不开启普通对局的永久强化/战斗历史。solo 从独立复制的 origin 重演公开命令和准备时间推进；确认后封存报价、资格、唯一收据及资源前缀。`validateB8Resources` 先独立折叠出生/出售/移除/变形/合星/选择事实，认证当前资格和持有者；报价证明再比对已重演的 **anomalySelection**，不再用“原实例出售后血缘归零”推导资格销毁。`anomalyRestored` 是真实获取/协调事件，候选事件不能自行授权新绑定。恢复缓存只保留独立重演成功的私有规范文本，最多4个且合计不超过4 MiB（UTF-16）；负零证据不复用缓存。

联机/本地房间从4-6起（含空席或候选删历史），`restoreSharedOrbSnapshot(pool,input,authority)` 与 `restoreCarouselSeat(carousel,input,authority)` 须提供独立 `room.augmentHistoryAuthority(seatId)` 或 `captureAugmentHistoryAuthority(authoritativeState)`；候选 JSON 不能自签。选秀入口另外在无强化历史的多人席上，只要存在异变资格、绑定、选择收据、`anomaly-selected` 事实或报价历史，就同样要求该句柄，避免把 `round` 改到 4-6 之前绕过检查。历史装备折叠从候选收据重建 definitionId，不能单独证明异变定义。缺失沿 `Invalid augment history: missing independent server authority`，内容不一致沿 `server facts/state mismatch`。对象/JSON/文本同样拒绝伪造已售旧实例、乱改资格/原英雄/选择身份、同步改写 selection/binding/选择收据（及最后一条报价）的异变定义、乱挪到另一副本或删除选择事实。

## 全部生产调用点

| 入口 | 领域权威与适配边界 |
| --- | --- |
| WebSocket | `net/messages` → `Room.handle/apply` → `applySeatCommand` → Match 公共 API；出售 `sellSharedUnit → sellUnit`，部署 `deployMatchUnit`，共享选择/超时 `runSharedMatchCommand` 原子提交。 |
| 房间超时 | 唯一 preparation deadline → 注入 Clock → `freezeAndResolve/applyTimeouts` → `resolveSeatTimeouts` → timeoutChoice/forfeit → 同一部署、资格、报价和确认。无新增真实时钟/计时 API。 |
| bot | bot-driver/decideBotAction 使用公共名单及命令；主动命令沿 manual，截止点沿 timeout（含先自动部署）。 |
| 本地房间 | `local-room-client` → Lobby/Room 与同一权威时钟/规则；本人视图沿 `toPrivateSeatView`。 |
| 单人、2D、3D | match-session/BoardScene/通用策略面板调用相同 Match API；3D 无独立异变规则，侦察只读公开绑定；视觉接线归 Claude。 |
| R5 所有获取 | 普通/共享购买、PvE/机制球领取、强化/机制英雄、复制器、轮盘归位、延迟合星、永久变形/移除均走统一资格协调；完整文件表在 R5 交接。 |
| 保存、恢复、回放 | serialization → 结构/强化/报价证明及权威资源折叠；共享与选秀快照同做历史所有权检查；Replay 仍调用 Match 公共命令。 |

## 返修与需同步的证据

| 位置 | 最终处理与重录边界 |
| --- | --- |
| `tests/fixtures/m5/oracle.t13.cjs` | **还原并永久保持已发布原字节**，SHA-256=`0b11a6cc60f3d31e59553d5121acb8a1fdc22ce3c6091ae3065ff0f8c35ad6ca`，与 `docs/evidence/t13/golden-audit.json.oracleSha256` 一致。唯一使用者是 t13-golden 的 SHA 锁，不改历史证据。只有当前 `oracle.cjs`、`oracle.g2.cjs` 独立累计观察到的前12项，不能从生产历史取预期。 |
| `m5-audit-boundaries` | 保留禁售/封存/全部篡改断言；增加出售后真实获取同英雄、合法保存恢复，休眠和恢复后都拒绝把已售旧实例写回 binding。 |
| `server/v17-avarice-battle-end-frozen` | 不能计为身份漂移。改用同一真实房间的 s3 对 s4（tick222），保留 offset=0/1/40，推进前后均精确要求4-6/battle，采样点早于本轮 deadline；保留冻结对象、liveFrames、花钱和实扣血断言。s2 的新终点546不再适合 offset40。相关路线证据须按新真实战斗同步。 |
| `server/carousel-room:489` | 不能计为身份漂移。真实路线锁 s0 死于5-5、最近选秀5-4、fightsSinceCarousel=1；继续要求致死 hpLost=hpBefore、最新 pick 仍持有、granted 收据完整、淘汰返还及卡池守恒。相关整局死亡/选秀证据须同步。 |
| `restoreCarouselSeat` 异变定义 | 不能计为身份漂移。seed=24 的 5-4 上，s2/s3/s7 无强化历史时，同步改写 selection、binding、选择收据定义（以及连最后一条报价一起改）且不传 authority，对象和 JSON 都必须拒绝。带房间 authority 的原快照仍须逐字恢复；错配 authority 报 `server facts/state mismatch`。 |
| `augment-pool-batch5-g4-swarm:47` | 完整序列化 SHA 受 v26 身份和 R5 null 字段影响，保留原精确哈希，待统一 v26 重录。 |
| `m8-b7-match-wiring` | 5项 Herald 真实路线的旧输入档 `unsupported-version`；保留失败，不把它们改为“旧档能拒绝”或放行旧档，另录 v26 输入再走原机制断言。 |
| `m8-b8-live-transfer` | 先命中旧 v25 transfer-anchor 的内容摘要收集门禁；通过新纪元锚点后，还须更新唯一 anomaly-selected 增加的账本长度（88→89），不能漏报。其两项防伪原因已按更早权威检查精确调整。 |
| `augment-pool-batch3-progress` | pre-spoils-v25 全量字节含身份及 R5 新 null 结构，保留原精确字节，另录 v26；不称为纯规则数值变化。 |
| 旧 v25 内容/路线/回放 | `m5-route`、`m6-integration*`、`m6-playback-checkpoints`、`m8-content-equivalence`、`opening-random-identity`、`server/battle-start-slices`、`epic-loot-reforger`、`v19-part2`、`match-contract`、`augment-history:449` 及旧源码审计等逐项列于最终测试清单；不覆写已发布 v25 证据。 |
| 内容根检查 | `content-identity-constants`、`opening-encounters`、`augment-text-identity`、`d11-wiring-bank`、`d14-anomalies-source`、`scripts/tests/production-size` 需分清“实时常量应一致”和“历史摘要锚点”；实时身份常量本轮已计算，保留的历史锚点另交统一重录。 |

原有 G-C06/C08 真实吸收/切割/鹰眼/Mirror replay、`m5-growth` 不开启永久历史、`b8-late-claim-receipt-order`、`m4-ledger-bound`、`s13-anomalies-restore-review` 的断言继续保留。R4a 的独立完整词采样向量、v15 全候选检查、d11 seed25 真实预算与 Eagle Eye seed49 的真实收入预留同样保留，不以弱断言或增时通过。

## 验证与剩余漂移

统一身份：rules=`s13-g2-3-v26-online-rules`，content=`s13-14.24b-g2-3-v26-online-rules`；CONTENT=`fnv1a32-utf16:038b00ca`，LOOT=`fnv1a32-utf16:9af7b4d0`。外层 schema/save/replay/command=12/8/8/7、NET=5，旧身份拒绝续玩。摘要用只读计算后编辑常量并执行 `--check`；未执行 `--write`。

本轮使用 `--maxWorkers=4 --configLoader runner --cache=false`，保留项目原 workers/setup、sequencer、用例时限与断言；临时后端配置只移除启动浏览器的 globalSetup。本任务无浏览器测试需要。bench 运行后从 HEAD 原内容恢复工作区文件，不写 Git 元数据。

最终按文件去重为 **159文件：139文件全过，17,737项通过，315项断言失败，另1文件在旧摘要锚点收集失败**。失败文件共20个；没有剩余已观测的非身份/纪元规则失败。每项原断言、触发位置和连带原因见 [完整159文件与315项逐条清单](V26_ANOMALY_MERGE_TEST_RESULTS.md)。不能把被旧门禁阻塞的后续场景算作通过。

- 真实贪欲冻结终点路线1,921项、选秀房间20项全部通过；offset40、前后4-6/battle、实扣血、持有物与卡池断言均保留。
- `v26-anomaly-choice` 16项、R5 15项、`m5-audit-boundaries` 21项、反向替换独立审计4项全过。审计只替换版本/摘要并删除新增null资格字段，pre-Spoils全文、四无历史SHA、首战全文/事件、Void Swarm全文SHA精确恢复旧证据；原严格失败断言没有替换。
- 奖励获取、Head Start、Max Cap、订阅服务、延迟合星及晚期恢复补充检查通过。t10旧操作版本字面量更新为已批准v26策略，并新增禁售策略精确断言，10项复测全过。m8-b6的6-5/6-6/6-7恢复约3.0/3.5/3.5秒，保留原20秒上限。
- fast项目排除的炮手回放另跑原timing分组，1,074项通过；其他三组逐tick回放也全部通过。未提高任何时限。
- bench已实际运行并还原HEAD原字节，SHA-256=`41ef6b4235c364ff02d724d186044b833957a0c5acec9383842f4a151b6793c6`；T13已发布oracle SHA锁通过。没有重录旧JSON/golden/epoch，也没有素材变动。

剩余漂移概览（均逐项保留，未skip、未弱化）：

| 文件 | 断言失败 | 分类与核实依据 |
| --- | ---: | --- |
| `scripts/tests/production-size.test.ts` | 1 | **纯身份/纪元漂移**；压缩领域包的实时内容根038b00ca/战利品根9af7b4d0与旧硬编码f671ab88/36ebfac2不符；保留历史锚点，当前常量--check通过。 |
| `tests/augment-history.test.ts` | 2 | **纯身份/纪元漂移**；旧 v24 哈希的归一化只识别 v25；v26 版本和新增 null 资格字段仍进入完整字节。独立 v26-anomaly-identity-audit 的四存档与完整战斗/事件反向替换均逐字/逐哈希恢复原证据。本轮复跑仍是这两项，未改期望哈希：四无历史归一化 SHA 为 8a8c5f23…、93f40351…、085db605…、e7bab395…；战斗账本/终局归一化 SHA 为 ab08e5d6…（基线仍为 99174cbf…）。 |
| `tests/augment-pool-batch3-progress.test.ts` | 2 | **纯身份/纪元漂移**；pre-spoils-v25 原文保留；独立反向替换仅版本/摘要及删除新 null 字段即恢复原全文，无数值或资源差异。 |
| `tests/augment-pool-batch5-g4-swarm.test.ts` | 1 | **纯身份/纪元漂移**；旧完整序列化 SHA 保留；独立反向替换恢复 8dedd866… 原完整 SHA，未改玩法字节。 |
| `tests/d11-wiring-bank.test.ts` | 1 | **纯身份/纪元漂移**；实时 CONTENT_DIGEST=038b00ca 与旧 f671ab88 锚点不符；原 bank/ledger 检查保留。 |
| `tests/d14-anomalies-source.test.ts` | 1 | **纯身份/纪元漂移**；当前内容根变为038b00ca，原 current-baseline 锚点 f671ab88 保留。 |
| `tests/epic-loot-reforger.test.ts` | 3 | **纯身份/纪元漂移**；两份旧5-7/6-7档被 unsupported-version 拒绝，一项仍要求旧 v25 rulesVersion；不迁移旧档。 |
| `tests/m5-route.test.ts` | 4 | **纯身份/纪元漂移**；四条真实路线先命中 v25 golden rulesVersion 门禁；后续旧命令/状态/事件指纹应另用 v26 录制，当前门禁后的断言不能计为通过。 |
| `tests/m6-integration-mage.test.ts` | 2 | **纯身份/纪元漂移**；主例在旧 golden rulesVersion 处停止，尚未写 fullEnvelopes；B9 因缺失封套连带失败。 |
| `tests/m6-integration-sniper-caitlyn.test.ts` | 2 | **纯身份/纪元漂移**；主例在旧 golden rulesVersion 处停止，尚未写 fullEnvelopes；B9 因缺失封套连带失败。 |
| `tests/m6-integration-sniper.test.ts` | 2 | **纯身份/纪元漂移**；主例在旧 golden rulesVersion 处停止，尚未写 fullEnvelopes；B9 因缺失封套连带失败。 |
| `tests/m6-integration.test.ts` | 3 | **纯身份/纪元漂移**；主例在 assertGolden(route) 的旧 rulesVersion 处停止，尚未赋值 cannonTransition/fullEnvelopes；另外两项分别因 undefined/缺失封套连带失败，不是通过了后续机制检查。 |
| `tests/m6-playback-checkpoints.test.ts` | 3 | **纯身份/纪元漂移**；旧 B9 战斗档案版本在入口拒绝；一项预期事件篡改错误也因此先得到不支持版本，保留原鉴权断言。 |
| `tests/m8-b7-match-wiring.test.ts` | 5 | **纯身份/纪元漂移**；5个 Herald 公共路线输入仍为旧身份，在 unsupported-version 入口拒绝；其余25项通过。 |
| `tests/m8-b8-live-transfer.test.ts` | 收集失败 | **纯身份/纪元漂移**；旧 v25 transfer anchor 在模块收集时比较 f671ab88，当前为038b00ca，整文件后续场景未收集。更新统一 v26 锚点后，还须另核唯一 anomaly-selected 事实导致的长度88→89，当前不计为通过。 |
| `tests/m8-content-equivalence.test.ts` | 134 | **纯身份/纪元漂移**；134份旧 v25 checkpoint 入口 unsupported-version，其他4项通过。须另录新纪元并切换 loader，不改历史文件。 |
| `tests/match-contract.test.ts` | 1 | **纯身份/纪元漂移**；Match 初始契约仍硬编码旧 v25 rules/content 身份；外层12/8/8/7不变。 |
| `tests/opening-random-identity.test.ts` | 136 | **纯身份/纪元漂移**；1项旧内容根、134份旧 checkpoint 准入、1项含完整 Match 元数据的首战状态序列 SHA。该首战 ticks/完整事件/战斗体哈希断言在序列 SHA 之前已通过；独立反向替换审计也通过，未改首战数值。 |
| `tests/server/battle-start-slices.test.ts` | 11 | **纯身份/纪元漂移**；11项直接注入旧 battle-start.json（round3/9/23均v25、f671ab88且无anomalySelection）：命中 invalid-seat-state / battle-validation:content-digest，导致阶段、延迟队列、第二次故障注入和预算切片数连带失败。新建当前身份房间的第一项通过；不能把旧夹具连带失败说成计时断言已通过。 |
| `tests/v19-part2.test.ts` | 1 | **纯身份/纪元漂移**；仍要求 rulesVersion=v25，当前统一为v26；schema/save/replay仍12/8/8。 |


Git索引仍保留6个UU条目，这是上一轮不写`.git`、不执行add的记录；对应工作区文件已经没有冲突标记。旧v26摘要或v25及更早身份均不可继续复用；前端锁盘/隐藏调阵没有在上一轮做浏览器验收。

上一轮最终构建（含类型检查）、双摘要`--check`和`git diff --check`全部通过；2D顶层JS gzip-9=**632,031字节**，低于637,144上限。无新增lazy chunk；服务器、界面和素材无上一轮修改。

## 选秀快照篡改返修（本轮）

`restoreCarouselSeat` 在无强化历史时不再接受自洽改写的异变定义。seed=24、阶段 5-4 的 s2/s3/s7 覆盖对象与 JSON：原快照带房间 authority 仍相等；不带 authority、以及同步改写 selection/binding/选择收据（另含最后一条报价）都不带 authority 或带原 authority，分别拒绝为缺独立权威和状态不一致。共享池入口对同一输入保持相同结果。

本轮相关集合 26 个文件（选秀恢复调用方、异变选择/R5/准备期、m5 审计边界、carousel-room、上述新篡改测试）：25 个文件通过，504 项通过，2 项跳过。唯一失败文件是 `tests/augment-history.test.ts` 的 2 项，仍是上表那条纯身份/纪元漂移，未 --write、未改断言。上表其余文件本轮未重跑，维持原分类，留给执行端统一重录。未改规则版本、内容摘要或已发布证据。`tsc --noEmit` 通过。2D 顶层 JS gzip-9 仍为 **632,031** 字节（`rendering3d-isolation`），低于 637,144；无新 chunk。服务器、界面和素材无本轮修改。
