# v24 商店 / Batch 5 合并验收（2026-10-27）

【完成】23个冲突文件在工作树解决；双分支功能保留，双重目的唯一实现，P裁决日期2026-10-27。
【完成】指定59个测试文件：2,850通过；补充4,673通过；cannon/sniper种子0..300共602/602通过。
【完成】身份生成及校验、tsc、build通过；GNU gzip-9为617,955字节，低于637,144上限。
【未完成】2项旧v23身份失败留待epoch更新；13项沙盒子进程/监听限制用例需外部环境复跑；未暂存或提交。
【需要我决定】无。
【风险】历史阶段禁选审计仍有5项已知缺口；缺购买事实或shop-history-v1的旧双重目的候选档按严格策略拒绝。
【下一步】复跑环境受限用例、记录v24 epoch，再由用户暂存并提交合并；全部调用点及证据见下文。

工作树：`claude/v24-integration`，起始 HEAD `5b682503e2dda701e3f2eed549217c6839694544`；合入 `origin/codex/v24-b4four`。`.git` 只读，未 add、commit、改分支或改 merge 元数据；23个未合并索引条目由用户最后暂存。以下记录工作树结果。

## 实现选择

两个新增清单仅重叠双重目的。按本地14.24 JSON的 `TFT_Augment_DualPurpose`（`goldtogive=2`、每次购买经验刷新）保留 Batch 5 / Review K 的唯一支付/返金/购买认证，接入商店分支的生成器和版本化历史。锁定商店也强刷、保留锁定开关；每次实际XP刷新判定一次棱彩门票，兼容星夜/操纵商店，免费额度不消费。来源事实与商店历史两层认证同时保留。

耐心与投资+/++仍只有 batch-4 实现；商店表剩七项，Batch 5四项，合并后235条身份。双重目的中英文资料随唯一注册迁入batch5。注册、policy、offer/API名称、manifest、禁选及独立oracle均无重复身份。阶段审计207个pool API名称、160条现有禁选；直接CLI仍只报告预先记录的五项缺口，与测试原断言一致。

精心打造与商店历史新增交互修复：初始消费分配及每个历史操作只读取当时 `resourcePrefix` 之前的合成，后来的同轮合成不能让先前付费刷新变成免费。裁决登记于 `S13_RULES_GAP.md` 的 P-V24-MERGE / P-V24-MERGE-CREDITS，日期均为2026-10-27。

## 全部生产调用点（相对于起始 HEAD，含自动合入的 Batch 5 接线）

| 文件与函数 | 最终接线 |
| --- | --- |
| `src/server/room/room.ts` → `applySeatCommand` / `buyXp` | 所有XP命令调用 `runSharedMatchCommand(pool,state,{type:'buyXp'})`；删除普通/双重目的分流，不在服务器计算规则。 |
| `src/server-entry/index.ts` | 删除已经无调用者的 `dualPurposeOwner` 重导出；`buySharedXp` 保留为兼容入口。 |
| `src/simulation/match.ts` → `buyXp` | 单人转发统一内部入口；共享双重目的直接调用拒绝 `invalid-mechanic-state`。 |
| 同文件 → `buyXpWithShopRefresh` | 记录XP历史、有序购买事实、门票一次判定；共享回调或单人统一商店生成；batch5唯一返金；等级奖励和原子失败。 |
| 同文件 → `nextRound` | batch3入轮之后排入Fate奖励，再执行订阅入轮奖励，保留完整事件盖序。 |
| 同文件 → `advanceMultiplayerRound` | 同时保留Fate入轮奖励与商店入轮处理。 |
| 同文件 → `selectChoice` | Called Shot覆盖连胜；Dual Purpose取得事实；继续调用原商店取得历史与订阅开店。 |
| `src/simulation/shared-pool.ts` → `buySharedXp` | 仅转发统一 `runSharedMatchCommand`，删除第二套买XP/刷新分支。 |
| 同文件 → `runSharedMatchCommand` / 内部 `matchCommand` | 新增buyXp共享回调：释放本席旧预留，再以 `dual-purpose` 原因调用 `drawShop`；将poolEvents传入内部函数，保留订阅取得/超时取得包装。 |
| 同文件 → `restoreSharedOrbSnapshot` | 保留商店历史/商店强化校验，并以batch5持有者、来源事实或收据触发完整奖励认证；删持有者不能绕过。 |
| `src/simulation/shop-augments.ts` → `drawSoloAugmentShop` | Dual Purpose生成保留锁定开关；继续复用星夜/操纵商店。 |
| 同文件 → `validateShopAugments` | 删除第二份Dual Purpose收据规则；旧商店命名空间的伪造双重目的收据拒绝。旧 `dualPurposeOwner` / `grantDualPurposeGold` 实现移除。 |
| `src/simulation/shop-history.ts` → `recordShopAcquisition` / `validateShopHistory` | batch5中的Dual Purpose仍启动并强制验证shop-history-v1；锁店XP也必须有紧随的真实刷新。 |
| 同文件 → `baselineSpends` / `validateShopHistory` 的逐项重演 | 精心打造额度只读取历史来源前缀，阻止同轮未来额度倒灌。 |
| `src/simulation/augment-pool-grants.ts` → `batch1GiftPlan` | 注册batch5取得礼物与Fate动态礼物计划。 |
| 同文件 → `validateBatch1Gifts` | 调用 `validateBatch5Gold`，保留原商店、免费刷新及其他批次认证。 |
| `src/simulation/free-rerolls.ts` → `freeRerollsGranted` | 同时计入精心打造和七项商店强化额度，原批次额度不变。 |
| 同文件 → `validateFreeRerolls` | 每次消费按真实合成事实前缀核对历史可用额度。 |
| `src/simulation/round-settlement.ts` → `applyRoundSettlement` | 没有g23Facts的权威结算也处理Fate到期奖励。 |
| `src/simulation/crown-history.ts` → `needsCrownHistory` / `missingCrownHistory` | Fate已有结算时要求完整离线战斗证据。 |
| `src/simulation/resource-provenance.ts` → `foldResourceProvenance` | 验证Dual Purpose取得/购买事实字段；完整XP认证交batch5。 |
| `src/simulation/serialization-structure.ts` → `restoreMatchWithinCall` | 逐轮与当前轮连胜认证调用 `batch5Streak`，原商店历史校验保留。 |
| `src/simulation/validate-content.ts` → `validateContent` | 计入唯一batch5四项和商店七项，目录总数235。 |

新增 `src/simulation/augment-pool-batch5-progress.ts` 内部调用链：`batch5XpPurchases`读取事实；`validateXpPurchases`逐轮校验取得、购买、免费结算XP和跨轮起点；`batch5RerollsGranted`读取真实合成；`batch5Streak`覆盖取得轮连胜；`batch5FateRound`读取入轮银行和真实PvP胜利；`batch5RewardPlan`调用既有礼物计划；`goldPlan` → `drainBatch5Gold`调用唯一金币收据；`validateBatch5Gold`验证XP、连胜及返金。没有新服务器/界面规则副本。

内容注册调用点：`content/augments.ts`、`augment-policy.ts`、`augment-offer-rules.ts`、`rules-manifest.ts`分别展开唯一batch5表；`augment-stage-bans.ts`增加三个不重叠项，Dual Purpose原标签只保留一次；`augment-pool-shop.ts`删除重复Dual Purpose。`shared-pool-types.ts`增加已有协议买XP的领域事务variant。`scripts/augment-content-archive.ts`和`augment-pool-batch5-archive.ts`保留独立归档文案；`identity-constants.ts`只由指定脚本生成。

独立oracle调用点：`tests/fixtures/m5/oracle.g2.cjs`的目录/位阶/金币/禁选/免费刷新，以及`Ledger.apply`的XP商店与连胜检查、`shopTransition`的锁店刷新；`augment-rewards-oracle.cjs`的`rewardPlan`、`validateRewards`增加batch5礼物和命令推导的唯一双重目的返金，检查取得/购买事实，合并来源白名单。原商店与batch5的双份返金推导已移除。

## 验收记录

用户指定的59个文件已分批执行，按每个文件最后一次结果统计：

| 批次 | 文件数 | 通过 | 未通过 |
| --- | ---: | ---: | ---: |
| augment | 30 | 881 | 12 |
| g2 | 5 | 282 | 0 |
| shop | 3 | 70 | 0 |
| restore | 7 | 393 | 0 |
| room | 14 | 1224 | 3 |

合计2,850通过、15未通过：2项旧epoch身份、13项环境限制，具体清单如下。所有Vitest命令显式 `--maxWorkers=4`；没有删断言、提高测试/hook超时或改写v23 epoch fixture。种子搜索依次完成后，602条炮手/狙神oracle扫描使用单一Node进程、四个worker线程运行；最终602/602通过、0失败；逐条核对0..300（含端点）×cannon/sniper的602个键，每个恰好一次，无遗漏、无重复，未重跑全范围。扫描期间生产源码没有变化。

补充回归：合并后的独立oracle账本43项、production-size语义/身份6项及批次四完整防篡改矩阵4,624项全部通过。精心打造＋星夜+通过真实公开路线（seed648，2-1选精心打造、3-2选星夜+）验证先付费、后合成、再免费刷新及JSON/object/serialized三入口认证。


当前身份由 `node scripts/update-content-identities.cjs --write` 生成，`--check`通过：content=`fnv1a32-utf16:4ba5d785`，loot=`fnv1a32-utf16:18c876b2`；`scripts/tests/production-size.test.ts`已同步。`npx tsc --noEmit -p .`、`npm run build`及`git diff --check`通过。顶层`dist/assets/*.js`独立gzip-9按GNU `gzip -n -9c`累计617,955字节（限637,144，余19,189）；不把子目录JS计入这个口径。Python/zlib level 9的同文件累计为616,935；压缩器实现不同造成1,020字节差异，最终采用上述GNU gzip命令口径，两者都低于上限。

已独立确认的纯旧身份失败：`tests/augment-pool-batch3-progress.test.ts` 中 “pre-Spoils baseline bytes restore and continue round 1/2 with full history”。重新从公开命令构建并逐路径比较，差异只有 `$.contentDigest`、`$.combatInputBasis.contentDigest`（旧d61a28f2→新4ba5d785）及 `$.m8.loot.frozen.replayDigest`（旧3a378e3e→新18c876b2）；没有更改原fixture或断言。

环境限制：`tests/augment-stage-bans-audit.test.ts` 10项均由沙盒拒绝`spawnSync(node)`，错误EPERM；独立最小子进程命令复现，直接执行审计CLI确认207/160/165与五项旧缺口符合保留的断言。`tests/server/g2-4b-artifact-forge-room.test.ts`、`g2-4b-support-forge-room.test.ts`的resumed-seat网络用例，以及`v23-room-command-robustness.test.ts`的stale/spoof/dedupe网络用例，由沙盒拒绝`listen 127.0.0.1`（EPERM）。这些不是epoch失败，原测试保持不变，需在允许子进程/本地监听的测试环境复跑。

## 种子重选记录

阶段表严格沿用原来的空板/上场路线，从0顺序搜索；Call to Chaos附加原XP分支要求，首个符合者为576。Batch3公共验证保留“2-1排除Trainer Golem、后续按reachNode路线”的规则；G2保留首个非Trainer Golem公开选择规则。房间使用真实Room/TwoSidedBattleResolver，首次满足s1初始2-1持有双重目的的房间种子为16。商店历史沿用排除先前商店强化的原路线，操纵商店+首个3-2种子为63。

`augment-stage-helpers.ts`：`bad-luck-protection` 14→8；`big-grab-bag` 8→26；`call-to-chaos` 512→576；`duo-queue` 163→78；`final-polish` 8→2；`geniuses` 2→16；`magic-roll` 8→51；`sisters` 22→30；`the-golden-egg` 27→99；`wealthy-rehab-i` 22→38。

`augment-batch3-verify-public.test.ts`：`blade-dance` 8→86；`eye-for-an-eye` 31→78；`field-medic` 296→62；`latent-forge` 61→170；`shocking-troll` 241→116；`spoils-of-war-i` 94→22；`superstars-i` 22→62；`support-mining` 100→46；`team-building` 55→70；`wealthy-rehab-i` 22→38。

其他原断言调用点：G2真实战斗选择Blistering Strikes 163→61、Lone Hero 8→94；B4战斗及刷新用例更新公开种子；batch5在线双重目的0→16；shop-history操纵商店+22→63。上述修正只换有效公开输入，不改玩法断言。`v23-tamper-batch4.test.ts`保留原真实战斗、奖励与全部叶子/容器攻击矩阵，更新七个后期公开见证种子：lategame-specialist 87→6、slammin-plus 19→14、invested-plus 54→29、invested++ 8→0、long-distance-pals 31→18、sated-spellweaver 19→36、overheal 37→11。

## 最终扫描与证据

`generate-m5-route.cjs.run` 使用当前 `src/simulation/match.ts` 的esbuild bundle；单进程内四个worker线程分配602条任务，保留现有Ledger、经济/奖励/商店/事件顺序/战斗上限断言。cannon 301/301、sniper 301/301；种子端点均包含。完整明细：`/tmp/v24-merge/oracle-scan.jsonl`；汇总：`/tmp/v24-merge/oracle-summary.json`；每文件最后一次Vitest结果聚合：`/tmp/v24-merge/test-summary.json`。

体积逐文件（顶层JS，GNU `gzip -n -9c`）：`index-DFKf4Zkn.js` 462,049字节，`phaser-jkS6OZ2f.js` 155,906字节，总计617,955，余19,189。`/tmp/v24-merge/build-final.log`、`tsc-final.log`、`size.json`留存构建证据；`identity-differences.json`留存两项旧身份失败的逐字段对照。临时日志与dist/素材未加入仓库。

最终工作树检查：HEAD仍为起始5b682503，分支仍为claude/v24-integration；冲突标记为零、`git diff --check`通过。因遵守`.git`只读约束，索引仍显示23个U条目，由用户执行暂存；这不代表文件中仍有未解决的冲突。没有add、commit或部署。
