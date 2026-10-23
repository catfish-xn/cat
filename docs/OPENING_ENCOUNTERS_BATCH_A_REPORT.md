# 开局奇遇 Batch A 实现报告（2026-10-23）

工作目录 `/home/aiapps/workspcae/cat-enc`；分支 `codex/encounters-batch-a`，输入 HEAD `b5a05d1a`（`codex/rules-placebo-overtime`，下含 PR9 `3b8e2c13`）。开工工作区干净。Codex 仅修改 simulation、tests、docs；没有改 rendering、presentation、server、CI/门槛，没有联网、复制原始资料、提交素材或 git commit。

**梅尔、维克托、金币订阅、战利品订阅均已启用。** 使用用户10-23批准表 M1–M4、V1–V3、S1–S7 的“我的推荐”，金币方案甲。普通局六费概率也按V1/V3修订。epoch、identity常量及历史夹具/旧测试断言全部保留，等待 #410 合并后统一处理。

**装备容量的实际边界：** 检查发现现有规则层装备库存没有容量上限，批准表也没给格数。已向用户询问，报告生成时尚无补充答复。因此没有擅自新增10格等数值；本批普通装备奖励统一先保存在待领球，领取沿用引擎库存规则。拥挤库存不会在触发时被自动塞入或丢掉奖励；若要求达到某个格数后连领取也拒绝，仍需明确容量。这一部分不能声称已实现一个有固定格数的装备席上限。锻造器沿既有四选一发装，满弈子备战席则保留弈子待领球。

## 依据与来源等级

只读本机资料：

- `/home/aiapps/workspcae/perf-1022/encounters-decisions.html`：M1–M4、V1–V3、S1–S7。
- `/home/aiapps/workspace/s13-14.24b-supplement-2026-10-23/TFT_S13_14.24b_Research_ZH.md`：第1、2、4、7节。
- 同目录 `TFT_S13_14.24b_Data.json`：金币/战利品的 `client.*`、`runtime.proposed_*`；梅尔参考13分支、B热修冠冕、门槛/抽样；维克托14.24与13.3原始表及采样建议。
- 既有 PR2/PR5、Match/Combat合同、M5规则、奇遇流和收据框架。

来源逐项表已写入 [S13_RULES_GAP.md](S13_RULES_GAP.md)。关键区别：客户端参考表、权重和官方2冠冕覆盖是原版资料；梅尔绑定该表、完整六费q表回推、金额方案甲和所有缺证执行细节是**类推，用户批准**。8阶段以后金币按公式外推仍是建议，不能称作原版已核实。没有把 S18 Large=3s、晚季六费6-1=1.38%或B前3冠冕带入。

## 实现位置

| 奇遇/模块 | 文件:行 | 实现 |
| --- | --- | --- |
| 梅尔 | `src/simulation/opening-batch-rewards.ts:27`、`:55` | 全局13分支，个人组件/五费，奖励原子与待领球 |
| 梅尔门槛 | `src/simulation/opening-encounter.ts:351` | 第一条符合条件的真实结算历史；救命后检查；一次收据 |
| 维克托/普通六费 | `src/simulation/content/opening-batch-a.ts:12`、`src/simulation/six-cost-shop.ts:8` | 完整四列q表、阶段映射、整店5q及一格替换 |
| 单机/共享商店 | `src/simulation/shop.ts:9`、`src/simulation/shared-pool.ts:118` | 普通五格照常抽，命中后释放该格普通预留并替换一张合法六费 |
| 凯特琳 | `src/simulation/opening-batch-rewards.ts:30`、`:33` | 全局档位、方案甲金额、零权重XL排除 |
| 塞薇卡 | `src/simulation/opening-batch-rewards.ts:55` | 九类、阶段金币、二星费用上限、靴子空奖励 |
| 订阅入口/恢复 | `src/simulation/opening-encounter.ts:155`、`:167`、`:227` | 2-1及后续阶段首轮、先于选择、收据重算认证 |
| 单机/联机加时入口 | `src/simulation/match.ts:520`、`:556`、`src/simulation/shared-pool.ts:269` | 同一奖励入口；共享批次原子提交 |
| 加时阶段钟 | `src/simulation/opening-stage.ts:5` | overtime-1=7-1，overtime-8=8-1；只影响本批奖励/六费概率 |
| 独立随机 | `src/simulation/opening-random.ts:3` | 既有UTF-16 FNV+XOR+lcg32派生与整数累积区间 |
| 领取/锻造器/恢复 | `src/simulation/opening-batch-rewards.ts:128`、`:136`、`:144`、`:150`、`:156` | 来源唯一、待领投影、普通领取、个人四选一、严格认证 |
| 法球接入 | `src/simulation/orb-claim.ts:1`、`src/simulation/b8-restore.ts:1`、`src/simulation/orb-restore.ts:1` | 本人法球、战斗排队、恢复队列识别 |
| 冠冕人口 | `src/simulation/g2-3-state.ts:36`、`:120` | 本批已领取冠冕纳入既有永久人口及资源前缀验证 |
| 加时来源验证 | `src/simulation/resource-provenance.ts:301`、`src/simulation/consumables.ts:157` | 加时中新增奖励/消耗可恢复；不扩大单人回合日程 |
| 启用清单 | `src/simulation/content/opening-encounters.ts:279`、`:320`、`:587`、`:626` | 四项 enabled=true / effectStatus=active；其余权重不变 |
| 本人商店概率 | `src/simulation/private-seat-view.ts:119` | shopOdds.sixCostBps返回含维克托的标称q |
| 测试 | `tests/opening-encounters-batch-a.test.ts:1` | 独立手算表、真实命令、合成边界、恢复及联机 |

## 普通六费的修改前后

旧实现为每格独立采样：`qOld=20+4×(roundOrdinal−23)+(Lv10?160:0)` Bps，4-6解锁，所有实际回合递增，没有维克托效果，也允许整店多张六费。不是本次批准V1表。

| 回合 | 旧Lv1–9 q Bps | 新普通 q Bps | 新Lv10 q Bps | 新维克托Lv1–9 / Lv10 q Bps |
| --- | ---: | ---: | ---: | ---: |
| 4-1～4-5 | 0 | 0 | 0 | 10 / 340 |
| 4-6 | 20 | 16 | 126 | 48 / 378 |
| 4-7 | 24 | 16 | 126 | 48 / 378 |
| 5-1 | 28 | 19 | 129 | 57 / 387 |
| 5-4 / 5-5 | 40 / 44 | 28 | 138 | 84 / 414 |
| 6-1 | 56 | 38 | 148 | 114 / 444 |
| 6-7 | 80 | 58 | 168 | 174 / 504 |
| 7-1（overtime-1） | 84 | 78 | 188 | 234 / 564 |
| 7-7（overtime-7） | 108 | 178 | 288 | 534 / 864 |
| 8-1（overtime-8） | 112 | 400 | 510 | 1200 / 1530 |

运行时数据逐格存储补研第7节全部四列（21行；合并行4-6/4-7、x-4/x-5共用值），新增测试独立写出26个回合节点×4列。第8阶段后维持最后一行，**数值单位q的Bps**。实际整店成功概率 `P=clamp(5q,0,10000)` Bps；例普通4-6：q=16 Bps、P=80 Bps=0.8%；维克托10级4-6：q=378 Bps、P=1890 Bps=18.9%。

每次实际刷新：原普通五格抽样保留；独立席位流给命中词、槽位词、六费身份词，命中一格替换。单机六费身份同层等权；联机沿剩余副本加权、预留/返还守恒。六费库存耗尽保留普通店；普通库存也全空时沿引擎 `pool-empty` 原子失败，不将六费概率强行归一至100%。锁店自然推进不产生新店或新generation；付费刷新锁店仍沿引擎处理。

## 手算向量

- **梅尔区间**：按 `_1,_2,_4,_5,_6,_7,_8,_9,_10,_11,_12,_13,_14`，累计百分比边界 `0,7,22,32,47,57,72,82,84,94,95,96,97,100`；每段上下界独立测 `ceil(percent×2^32/100)`，零权重 `_3` 不进入池。`_12`恰好2冠冕，`_8`普通五费1星，`_14`8次有放回组件，固定种子确有重复。
- **梅尔生命**：41→40、41→39领取；41→0不领取；40→39、39→40不构成首次跨越。每席一份收据，重复结算/调用/恢复不再加金或造工具；真实空场命令路线到达门槛并严格恢复。共享与单机使用同根seed/相同席位名时payload逐项相等。
- **金币档区间**：`0,15,50,75,98,98,100`，XL零宽。2～7阶段XS=`1/1/2/2/3/3`，S=`2/3/4/5/6/7`，M=`4/6/8/10/12/14`，L=`10/15/20/25/30/35`，Giga=`16/24/32/40/48/56`。第8阶段=`4/8/16/40/64`，为公式外推建议。
- **塞薇卡区间**：靴子/铲/金币/辅助锻造器/神器锻造器/二星/组件/重铸/冠冕，累计 `0,3,17,31,44,58,72,86,99,100`。阶段2～7金币=`10/15/20/25/30/35`；二星费用=`1/2/3/4/5/5`，8阶段仍5费；8组件各12.5%，不含铲/锅。靴子只产生 `openingEffectApplied + openingRewardResolved`，金币/物品/工具/阵容/其他RNG均不变。
- **六费5倍界限**：q=16，`word=34359738`命中、`34359739`失败；q=10，`21474836`命中、`21474837`失败。槽位边界按 `ceil(k×2^32/5)`，k=0..5，均匀覆盖五格。P=0永不命中，P被clamp到1后最大词也命中。400个根seed的实际单机店均最多一张六费；40次共享晚期刷新与独立预期slot逐次一致，卡池守恒。
- **容量/库存**：满9格弈子备战席的梅尔五费保留待领；释放一格后领一次、再领拒绝。二星赠卡需要3副本，只有2副本时按既有引擎转该弈子费用金币，不超发副本。20件库存的装备拥挤向量：触发8散件不增加库存，保留8球；恢复不重发，显式领取按现有无限库存规则成为28件（不是新增28格上限）。
- **调度**：1-2/1-3/1-4无订阅；2-1首发、强化之前；阶段中间不发。真实联机命令走到overtime-8，收据节点恰为 `2-1,3-1,4-1,5-1,6-1,overtime-1,overtime-8`。
- **随机/回放**：独立BigInt FNV/LCG oracle比较1024根seed及shared/seat流；效果前后旧shop/choice/reward/battle/reforge流不变。金币、锻造器订阅、梅尔奖励边界前严格存档恢复，重放相同公开命令，完整state与events深等；不使用重新录制golden作答案。

## 接口与恢复合同

没有新增网络命令，也不要求服务器自行算规则。公共导出仍来自 `match` / 原有共享池入口。

| 函数/字段 | 输入与输出 | 失败/边界 |
| --- | --- | --- |
| `planOpeningRound(context, roundId)` | 返回 `{context,facts}`；增加订阅阶段fact及合法 `overtime-n` 支持 | 非法轮次 `invalid-opening-effect`；根上下文不一致 `opening-context-mismatch` |
| `applyOpeningEffects(state,facts,shared?)` | 返回既有MatchCommandResult；订阅收据按阶段追加，重试返回原state、空events | 非准备入口、死人、非法fact/缺失旧收据拒绝；原state和全部资源/RNG保持 |
| `applyOpeningRoundEntry(state)` | 领域内部生命周期助手；单机及暂时移除pool binding的共享推进，在进入选择前应用 | 返回既有MatchCommandResult；不作为服务器命令调用 |
| `commitOpeningEncounterHealth(state, events=[])` | 结算内部钩子；返回MatchState，向调用者事件数组追加门槛/结果事件 | 缺失旧观察或历史不匹配抛 `OpeningEncounterError('opening-context-mismatch')`；事务外层原子回滚 |
| `sixCostOddsBps(roundOrdinal,level,viktor=false)` | 返回标称q整数Bps；等级1～9同表，10级另列 | 非整数/越界等级抛RangeError；不是整店P |
| `generateShop(rng,generation,level,round,context?)` | 新增可选 `{seed,seatId,viktor}`；Match始终传根身份；返回shop与原shop流结果 | standalone缺省仅用于已有纯函数调用；无状态修复 |
| `readOpeningMelProgress(state)` | `thresholdReached, rewardStatus, triggeredRound, hpBefore, hpAfter` | `rewardStatus='waiting-threshold'|'granted'`；granted表示已发一次权益，待领球可能未入库存 |
| `openingRewardOrbs(state)` | 从已认证opening收据减去已领取mechanic收据投影本人待领球 | 不持有第二份可修改奖池，不暴露未来阶段、根seed或随机词 |
| `claimOrb(state,orbId,round)` / 共享同名命令 | 本批prefix `opening-reward:`；领取金/物品/弈子或打开锻造器；沿现有返回结构 | `unknown-orb, already-claimed, stale-round, wrong-phase, shared-pool-required, seat-eliminated`；满弈子席成功no-op保留球；共享库存不足转金币 |
| `choose/timeoutChoice` | 本人forge四个不同候选，超时首项；来源 `opening-encounter-batch-a` | 沿现有选择失败枚举，无新增客户端扣费/结算 |

随机路径（均在 `opening-encounter-v1/` 下，根为全局augmentTierSeed）：

- `shared/mels-blessing/outcome`：一个全局分支词；每席到门槛只领取同一分支。
- `shared/<gold-subscription|loot-subscription>/stage/<stage>`：每阶段全局类别词。
- `seat/<seatId>/<encounterId>/<reward|stage/<stage>>`：个人具体奖励词，有放回组件、普通费用层等权弈子。
- `seat/<seatId>/forge/<atomId>`：个人锻造器四词、排序池部分Fisher–Yates、四个不同候选。
- `seat/<seatId>/six-cost-shop/<generation>`：命中/槽位/六费身份三词；只在实际生成新商店时使用。

独立子流是纯确定性派生：同一全局键永远绑定同一结果，重算仅用于验证，不推进任何保存的旧流，不是给每席另抽类别。solo席位名为`solo`。共享round计划向所有席位应用，整个批次任一席失败则返回原pool/states。

订阅factID为 `JSON(['opening-batch-a', opaqueInstanceId, encounterId, effectKey, nodeId])`，instance使用已有`opening-instance/rootSeed`哈希，不在订阅公开收据中放根seed。订阅receiptID为 `JSON(['opening-receipt',factId,seatId])`。梅尔沿既有门槛history receipt身份。每个奖励原子为 `opening-reward:` 加 `JSON([openingReceiptId,index])`，且mechanic receipt使用同一ID。重复领取无新资源。所有金币/工具必须有完整收据；物品/弈子/forge可未领，已领必须匹配重新推导的payload、来源、时点、星级及provenance。缺失/篡改收据恢复拒绝，不补发。冠冕已领取后沿既有永久人口规则，重铸/移动不扣回人口。

## 给 Claude 的 UI 接点

1. 四项 `enabled/effectStatus` 已变为启用；保留固定16项奇遇选择权重。梅尔文案应为“生命首次降至40或以下且仍存活时获得一次赐福”，不能继续显示奖励未启用。
2. 本人 `openingMelProgress.rewardStatus` 现为 `waiting-threshold/granted`；`granted`与待领球同时存在正常。只从状态读取，不在UI扣血或发奖。
3. 新领域事件 `openingRewardResolved={receiptId,encounterId,outcome,nodeId}`。梅尔outcome=`Blessing_High_<分支号>`；订阅outcome=`<encounterId>/stage/<阶段>/<0起档位>`。金币档0/1/2/3/5对应XS/S/M/L/Giga；战利品档0..8按上文九类顺序，档0只播靴子表现，不能造Boot装备/金币。
4. `mechanicGranted`与本人已有 `loot.unclaimedOrbs`/法球字段提供具体物品、星级及待领；本批新prefix无需UI计算随机结果。锻造器继续读 `pendingChoice`，发送既有选择/超时回调。**单人也要接现有claimOrb入口**，否则本批装备会一直在球中。
5. 本人 `shopOdds.sixCostBps` 是q，不是整店命中率；4-1维克托10Bps、10级340Bps等直接显示领域值。若显示整店概率，可显示文档说明P=5q，但不能在界面抽卡。
6. 加时订阅事件带计算后的stage，界面仍可沿引擎显示“加时n”，不必改战斗/经济日程。类别/奖励均已由规则层结算，服务器与UI禁止再次发放。

未改任何表现层文件，没有加入视觉布局/颜色/动画规定。

## 验证结果

最终测试数字、旧测试清单及构建测量见下方收尾记录。仅运行本批和直接相关17个测试文件、typecheck、生产构建与只读digest检查；没有跑全套、浏览器E2E、完整路线golden录制或部署。

## 风险与交付边界

- #410未合，本批与父分支的安慰剂/45秒战斗加时都没有统一epoch。identity常量仍为旧值；新旧存档/回放不能混用，当前不得直接发布。
- 固定装备格数未定义；本批采取统一装备待领球，未引入未批准数值。严格满装备席拒领规则需另定容量。
- 单机装备待领、新梅尔进度状态及靴子事件需要Claude接线；未跑真实界面交互。
- 已测实际共享调度、卡池、恢复/命令回放；未做八人全局浏览器联机E2E。三倍与5q为批准类推模型，不宣称掌握原服务器采样脚本。
- 只报告本批生产JS增量，不冒充已执行完整CI预算/首屏交互验收；未改任何门槛。

## 收尾实测记录

相关 Vitest 共 **17文件、720例：438通过、282失败、0跳过**。本批新增 **94/94通过**；最终又单独复核新增文件的13分支全部数量手算断言。282个旧断言失败分为 **270个identity/digest/历史录制** 和 **12个旧规则预期**，没有改断言或历史夹具。

| 文件 | 通过 / 总数 |
| --- | ---: |
| `m6-persistence.test.ts` | 52 / 52 |
| `m6-replay.test.ts` | 9 / 9 |
| `m8-content-equivalence.test.ts` | 4 / 138 |
| `match-contract.test.ts` | 12 / 12 |
| `opening-encounters-batch-a.test.ts` | 94 / 94 |
| `opening-encounters-integration.test.ts` | 42 / 42 |
| `opening-encounters-pr2.test.ts` | 30 / 31 |
| `opening-encounters-pr5.test.ts` | 31 / 31 |
| `opening-encounters-pr6.test.ts` | 34 / 42 |
| `opening-encounters.test.ts` | 4 / 6 |
| `opening-random-identity.test.ts` | 16 / 151 |
| `shop.test.ts` | 22 / 22 |
| `t3-round-settlement.test.ts` | 11 / 11 |
| `t5r-private-seat-view.test.ts` | 16 / 16 |
| `tp-rewards-and-rounds.test.ts` | 9 / 9 |
| `tp-shared-pool.test.ts` | 14 / 14 |
| `v19-part2.test.ts` | 38 / 40 |

### 未改动的旧测试失败清单

| 文件 / 用例集合 | 失败数 | 本次原因 |
| --- | ---: | --- |
| `opening-encounters.test.ts` / includes the full table and conventions in both freshly recomputed digests | 1 | 按要求保留identity常量；新配置与旧digest不相等 |
| `m8-content-equivalence.test.ts` / recorded cannon state 0～66、recorded sniper state 0～66：restore from text equals restore from the parsed object | 134 | 历史v21奇遇configVersion不匹配；未录新epoch、不重写历史状态 |
| `opening-random-identity.test.ts` / cannon checkpoint 0～66、sniper checkpoint 0～66：survives strict text/object restore | 134 | 同上，旧checkpoint的opening上下文不匹配 |
| `opening-random-identity.test.ts` / recomputes the first battle terminal and every event hash from public commands | 1 | 新奇遇配置使冻结state身份/哈希与旧录制不同；首战tick未改 |
| `opening-encounters.test.ts` / preserves all sixteen official 14.24b intervals and explicit disabled identities | 1 | 旧启用清单不包含新增四项；16项权重本身未改 |
| `opening-encounters-pr2.test.ts` / exactly six PR2 effects become enabled; unimplemented effects retain original weights and null evidence | 1 | 旧启用/未实现清单 |
| `opening-encounters-pr6.test.ts` / 41→40、41→39、100→40、41→1 crosses after save: true | 4 | 旧测试断言仅观察无奖励；当前应发奖励权益/工具/事件 |
| 同上 / keeps all rewards closed and preserves only the evidenced B-patch branch override | 1 | 梅尔现在启用，沃里克仍关闭 |
| 同上 / authenticates every receipt field and rejects duplicates, missing records, and foreign encounters | 1 | 旧奖励关闭测试期望PR6拒绝路径；新已启用batch的非法fact先返回invalid-opening-effect；仍拒绝、原state不变 |
| 同上 / multiplayer settlement records 41→39 atomically, rejects retries and mirrors without RNG or grants | 1 | 现在追加本批已授权领域事件/收据，旧断言只有roundSettled |
| 同上 / owner-only progress is detached and explicitly blocked; public view contains no personal receipt | 1 | 本人rewardStatus现在为waiting-threshold/granted，旧断言blocked-evidence |
| `v19-part2.test.ts` / freezes stage/level odds and preserves two words per shop slot | 1 | 旧4-6=20/180、4-7=24/184Bps；新V1=16/126且4-7不增长 |
| 同上 / shared six-cost reservations are finite, can merge, sell and fall back after exhaustion; locks and failures are inert | 1 | 旧极小池向量假定“只剩六费就必出”，V3仍需整店判定；无普通库存且判定未中时沿现有pool-empty失败 |

以上明确列出实际运行失败；没有把未运行的golden文件称作实测失败。旧内容/epoch断言保留；新增94例给新批准规则独立数值与事务答案。相关既有PR5、集成、普通shop、共享池、结算、私有投影、Match合同、持久化、回放均全通过。

### 构建、identity与范围审计

- `npm run typecheck`：**通过（退出码0）**；日志 `/tmp/batch-a-typecheck-done.log`。
- Vite生产构建通过，产物仅在 `/tmp/encounters-batch-a-final-dist`。同依赖、同配置、HEAD归档离线对照构建 `/tmp/encounters-batch-a-head-dist`。
- 按 `scripts/m7-budget.cjs` 的口径（顶层assets/*.js分别gzip level9后求和，不计独立3D目录），**HEAD 654,241 B → 本批657,214 B，+2,973 B，+0.4544%**。没有修改构建/CI门槛；没有运行完整CI交互预算。资料长文没有进入新运行时代码，q表为紧凑整数二维数组。
- 只读 `node scripts/update-content-identities.cjs --check` 按预期失败：旧CONTENT=`35273c97`、LOOT_REPLAY=`ef359464`；当前内容重算候选=`32d2b85c` / `415e17ae`（均带`fnv1a32-utf16:`前缀）。**未执行--write，未录epoch**；候选包括父规则分支变化，后续合流再统一计算。
- `git diff --check`通过；没有修改tests/fixtures、historical、epoch、identity常量、渲染/表现层、src/server、.github或CI配置。没有git commit。
- 日志：`/tmp/batch-related-final.json`、`/tmp/batch-related-final.log`、`/tmp/batch-a-done.json`、`/tmp/batch-a-typecheck-done.log`、`/tmp/batch-a-final-build.log`、`/tmp/batch-a-digest-check.log`。

建议Claude按接口检查三件事：已测（上述范围）、未越界（仅规则/测试/文档）、玩法变更仅批准的四奇遇与普通六费概率。随后接单人法球/梅尔进度/靴子结果；#410合并后统一epoch、严格历史回放与发布验收。装备固定容量另待用户明确。
