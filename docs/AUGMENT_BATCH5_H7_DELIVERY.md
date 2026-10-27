# B5-42／43／44 实现与接口（2026-10-27）

本批开放三个银色强化。数值来自本地 `augments-research-2026-10-23/data/augments-14.24.json`，边界采用用户确认的 P-B5-H7。没有新增网络命令。历史查询、生命收据和恢复认证均使用 [augment-history-v1](AUGMENT_HISTORY_DESIGN.md)，没有自签名计数器。

| 强化 | 数值与开放节点 | 项目约定 |
| --- | --- | --- |
| B5-42 有用之材 I | `DropChance=0.5, Gold=1`；仅 2-1 | 正式英雄每次真实死亡，按现场 `equipment`（含临时装）和 `combatItemGrants` 判断空装备；排除召唤物／代理，复活后再死独立判定。种子、席位、choiceId、combatId、eventSeq 派生 FNV-1a UTF-16＋lcg32-v1 单词，低于 2³¹ 发 1 金，不推进其它随机流。PvP 双边结算历史提交后支付，PvE 随实际死亡历史支付；唯一收据防止重发。 |
| B5-43 午餐钱 | `Damage=8, Gold=2`；2-1、3-2 | 自取得轮累加已提交的对方实际 HP 扣减，每跨 8 点给 2 金，余数跨战。读取对方 RoundResult.hpLost，已截断过杀、已应用 Mel 保命；镜像不计，后续治疗不抵销。单人敌方玩家账户未知，保留 null、不发此奖励。 |
| B5-44 巨型泰坦 | `Heal=20`；2-1、3-2 | 获取时当前／最大 HP 各加 20，最大值由已认证拥有条目派生为 120，后续治疗封顶新上限。按既有 HP 排序后，仅持有者提前一个原放行批次，首批向前截断；点选模型不模拟移动减速。原服提前量和速度仍未获证实。 |

## API 与失败行为

- `batch5H7GoldPlan(state: MatchState): {receiptId:string;source:string;round:number;amount:number}[]`：通过 `requireAugmentFacts` 读取死亡／实际扣血，缺完整证据抛 `Invalid augment history: missing ...`。
- `drainBatch5H7Gold(state: MatchState): {state:MatchState;events:readonly MatchEvent[]}`：只支付当前轮未领取计划，通过 `grantMechanicGold` 写收据和连续事件序号；重复返回原 state 和空 events。缺历史应付收据抛 `Missing batch5 h7 historical gold receipt`；授予失败沿用 `duplicate-mechanic-receipt / invalid-mechanic-state`。
- `validateBatch5H7Gold(state: MatchState): void`：逐项核对计划和收据的 ID、来源、类型、数额、自然轮／roundId；拒绝重复、遗漏、孤儿或改写，错误 `Invalid batch5 h7 gold authority`。
- `maximumPlayerHp(augments: readonly OwnedAugment[], round?: number): number`：由真实拥有条目派生 100／120，历史查询忽略未来取得；由 server-entry 导出。
- `acquireTitanicTitan(state: MatchState, augment: OwnedAugment): MatchState`：验证取得前 HP，执行 +20 并写唯一 `player-health`；重复原收据无操作。
- `titanicTitanChoiceId(state: MatchState): string | undefined`：读取已认证生命收据中的资格；无持有者返回 undefined，坏收据抛 `Invalid augment history: Titanic Titan health receipt`。
- `h7CarouselRelease(participants, first, interval)`：返回 `releaseAtMs/releaseOrder`；自动选取也按真实放行时间排序。
- 原选择／选秀命令签名和失败枚举不变，`prepareCarouselParticipants/createCarousel/validateCarousel/restoreCarouselSeat` 沿用 `invalid-participants / invalid-carousel`。拒绝事务不消费资源／RNG；房间在请求前同步逻辑时钟可独立发布时间更新。

## 全部生产接线改动

以下路径除特别注明外均相对 `src/simulation/`。

| 文件／函数 | 改动 |
| --- | --- |
| `content/augment-pool-batch5-h7.ts`（新） | 三条数值、原文、身份、等级和内容定义。 |
| `augment-pool-batch5-h7.ts`（新） | 历史奖励计划、随机词、唯一授予和收据验证。 |
| `augment-pool-batch5-h7-health.ts`（新） | 最大生命、获取收据、历史生命解释和选秀提前。 |
| `augment-history.ts / traceHistoryCommand, findAugmentFacts, requireAugmentFacts` | 成功公共命令记录事实后发奖并追加规则事件；可选收据／进行中边界读取器返回脱离副本，完成战斗仍要求完整边界。原 `match.ts` 包装无需再改。 |
| `src/server/room/augment-history.ts / recordRoomBattleFacts` | 双边死亡／实际扣血事实写入后调用 `drainBatch5H7Gold`，返回 Match 和 events 给原子提交；服务器不算概率、金币或伤害。 |
| `src/server-entry/index.ts` | 导出 `drainBatch5H7Gold`、`maximumPlayerHp`。 |
| `augment-acquisition.ts / grantAugmentAcquisition` | Titanic Titan 获取事务。 |
| `augment-pool-grants.ts / validateBatch1Gifts`；`shared-pool.ts / restoreSharedOrbSnapshot` | H7 金币计划验证；联机仍先验证独立 authority。 |
| `carousel-types.ts / CarouselParticipant` | 可选 `titanicTitanChoiceId`，由服务器准备的已认证收据提供。 |
| `carousel.ts / prepareCarouselParticipants, createCarousel, validateCarousel, restoreCarouselSeat` | 真实生命上限、冻结资格、提前排程及恢复时的参与者／实际放行时间校验。 |
| `augment-xp.ts / applyLevelUpHealth, settlementLevelUpHealth, preparationLevelUpHealth`；`g2-3-runtime.ts / finishG23Choice` | Upward Mobility 和 Crimson Pact 治疗封顶真实上限。 |
| `augment-pool-batch2-health.ts / healBetween, batch2HpBeforeBattle`；`player-hp.ts / explainedHp` | 历史上限和获取 +20 的恢复及房间 HP 账本解释。 |
| `economy.ts / planRoundEconomy`；`serialization-structure.ts / restoreMatchWithinCall` | 经济／保存生命边界按拥有条目验证。 |
| `combat-input.ts / restoreCombatInput`；`two-sided-snapshot.ts / restorePlayerBattleSnapshotSteps` | 战斗输入生命边界按取得轮和拥有条目验证。 |
| `d11-fill.ts / compileD11Augment`；`strategy-snapshot.ts / buildStrategySnapshotSteps` | Spirit Link／Comeback Story 使用真实缺失生命，避免 >100 HP 的负加成。 |
| `opening-encounter.ts / isMelBlessingCrossing, expectedMelThresholdReceipts`；`opening-monkey.ts / validateMonkeyGrants` | 奇遇 HP 验证支持新上限。 |
| `round-settlement.ts / applyRoundSettlement` | 对手 HP 收据结构上界支持 120，真实性仍由双边快照／结算认证。 |
| `content/{augments,augment-policy,augment-offer-rules,augment-stage-bans,rules-manifest}.ts`；`validate-content.ts / validateContent` | 最小导入、合并、阶段禁用和数量注册。 |
| `m8/{version,contracts}.ts`；`content/identity-constants.ts` | v25 rules/content 和重算双摘要；schema/save/replay/command＝12/8/8/7、网络版本保持。 |

复用且未改文件的联机链：`Room.apply → selectChoice → grantAugmentAcquisition`；`Room.planSteps → recordRoomBattleFacts → commitSettlement`；`Room.openCarousel → CAROUSEL_RULES_BINDING.prepareCarouselParticipants/createCarousel`；`Room.pickCarousel → pickCarouselForSeat`；`Room.replace → explainedHp`。机器人和超时选择复用原入口，没有新 wire command。新增服务端代码未引入时钟或 DOM API；既有 `real-clock.ts`／`net/test-client.ts` 未改。

## 测试与保存边界

- 新增 `tests/augment-pool-batch5-h7{,-health}.test.ts` 及 helper：研究数值、候选阶段、真实命令、PvP／PvE 房间、重复／失败不变、发金／余数／120 HP／选秀提前，以及历史和资源篡改。
- 单人三入口为 `restoreMatch(object/JSON/serializeMatch(...))`；联机通过 `restoreSharedOrbSnapshot`／`restoreCarouselSeat` 接收对象、JSON 文本或 UTF-8 序列化检查点，并必须附独立 `Room.augmentHistoryAuthority`。离线 serializer／restore 对多人状态仍拒绝 `multiplayer-state`，没有伪造离线多人格式。
- 新增 `tests/fixtures/m5/augment-h7-oracle.cjs`，独立抄录 50%／1／8／2，用 bigint LCG 对照真实房间奖励；`augment-rewards-oracle.cjs` 接入独立应付计划，`oracle.g2.cjs` 补身份／阶段表和 238 条精确数量断言。
- `tests/augment-stage-helpers.ts` 默认扫描限为 0..100；本任务没有扩大扫描。`g2-augments-choice`／`m5-oracle-augment-ledger` 精确数量同步 238；`scripts/tests/production-size.test.ts` 同步双摘要。
- `tests/augment-history.test.ts` 保留原四个无持有者 SHA-256，只将有意推进的版本／摘要归一回原身份再比较，不重录正文或 epoch。
- `tests/server/carousel-room.test.ts`：238 条新候选池改变固定 seed 24 的自动选择路线；精确淘汰向量从 5-6／距选秀两战同步为实际 6-5／一战，保留全部持卡和卡池归还断言，并新增剩余 HP 被实际扣尽断言。未删除断言、未提高超时、未录 epoch。

## 最终验证

- 三项新增测试共 **92 项通过**（B5-42 28、B5-43 24、B5-44 39、共享研究源 1）；研究文件存在，本次未跳过源数值核对。
- 定向回归 **258 项通过**：augment-history、p7-carousel、server/carousel-room、server/round-commit、m5-oracle-augment-ledger、match-economy、production-size。选秀文件修正固定路线后独立重跑 20 项全过，重复执行不累加。
- 独立候选目录检查 **5 项通过**；其余未选用例由 `-t` 排除，未执行 1000-seed 的旧全目录扫描。全部 Vitest 命令使用 `--configLoader runner --maxWorkers=3`，未跑全套。
- `npm run build -- --configLoader runner`（含 typecheck）、`npm run build:game`、`node scripts/update-content-identities.cjs --write/--check`、三个 CJS oracle 的语法检查及 `git diff --check` 通过。
- rules/content 为 v25；content=`fnv1a32-utf16:c8390321`，loot=`fnv1a32-utf16:4fffc2c3`。生产体积测试已同步双摘要。未重录 epoch、未提交 Git、未改界面或素材。

交付摘要见根目录 `-o`。没有未实现或跳过的本单强化；联机验证为真实 Room／TwoSidedBattleResolver 和公共命令，未运行浏览器或真实 WebSocket 端到端。旧身份不能续玩，新候选池合并其它并行分支后需统一重算摘要。
