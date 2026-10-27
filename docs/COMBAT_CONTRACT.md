## 2026-10-27 v25 H7 历史强化

B5-42 从 `augment-history-v1` 的死亡现场装备判定资格，复活后的独立 death event 另判定；不改战斗 tick、事件封套或回放事实。B5-43 仅使用双方已结算的实际玩家 HP 扣减。B5-44 扩展玩家生命上限后，Spirit Link／Comeback Story 按真实缺失生命计算，输入和恢复按拥有条目验证上限。当前版本及接口见 [MATCH_CONTRACT](MATCH_CONTRACT.md) 和 [H7 合同](AUGMENT_BATCH5_H7_DELIVERY.md)；未重录 epoch。

## 2026-10-27 v25-h8：吸血与死亡收据

吸血生机编译为既有 `wealthyRehab` 全能吸血机制，数值1200 Bps，使用同一伤害／治疗流水线，保留来源与完整 heal 事件；不新增战斗字段。恶意货币化使用 augment-history 的真实死亡旁路样本，按 eventSeq 计次，复活再死独立计数，正式英雄身份来自死亡现场。两项玩家层奖励在战后处理，不回写战斗回放；具体事务、来源与认证见 [MATCH_CONTRACT v25-h8](MATCH_CONTRACT.md#2026-10-27-v25-h8三项历史依赖强化)。

## 2026-10-27 B5-60 狙神之巢（H10）

P-B5-60：取得后每个实际参战的狙神（含正式装备纹章）首次以某格开战即获得 800 Bps，连续相同开战格每战 +800，封顶 3200；换开战格或离场后重上回到 800，合星继承主实例，出售重买清零。PvE/PvP 均计，供给轮／未参战不加层，准备期移格再移回不改变开战格。

`augment-pool-batch5-h10-sniper.ts` 只读已认证历史，`readCombatStrategyInputs` 和 `snapshotForBattleSteps` 冻结可选 `sniperOpening`；`compileSideSteps` 按各席单位命名空间映射，`buildStrategySnapshotSteps` 为相应玩家单位绑定已有 `damageAmp` mechanic。战斗沿用整数增伤及伤害流水线，没有新 tick 逻辑。每场只算一次，同轮开战后的 positions 不改写冻结输入；`restoreCombatInput` 以历史重推值精确认证，双边 snapshot 校验拥有者、单位 ID 和 800/1600/2400/3200 范围。结构化双边 snapshot 不是客户端历史认证接口，联机保存仍需独立服务器 authority。
## 2026-10-27 H11 临时成装（候选；不重录 epoch）

开放拾荒者／白蹭，分别在真实死亡清理后和tick0开场执行。永久装备由历史roster API冻结，死亡使用 `augment-history-v1` 同源采样；临时成装复用现有装备载荷、事件和收据，完整重演认证，下一轮不进入永久物品账本。无新命令或wire类型；内部函数签名、失败原因及完整联机调用点见 [H11合同补充](AUGMENT_BATCH5_H11.md)。本次内容摘要重算，旧摘要拒绝；用户要求保留历史epoch录制。

## 2026-10-27 v25 B5-56／B5-58

规则／内容为 `s13-g2-3-v25-online-rules`／`s13-14.24b-g2-3-v25-online-rules`；schema/save/replay/command 保持 12/8/8/7，网络规则协议 5。金色收获（4-2）与禁忌魔法（3-2、黑玫棋盘）按 P-B5-56／58 开放。唯一历史证据为按持有者写入的 `augment-history-v1`：开战异常绑定、真实致死来源、实际参与者与玩家级赛恩成长。每三杀发二金和每三次参与击杀 +150 AD 基点／10 生命均由规则层战后唯一收据执行，成长从下一战生效。无新增玩家命令，旧身份拒绝续玩，未重录 epoch。接口、失败语义与全部接线点以 [强化历史合同](AUGMENT_HISTORY_DESIGN.md) 的 B5-56／B5-58 节为准。

## 2026-10-25 v23 当前战斗与恢复合同

本节以发布基线 `2b434e28` 至候选 `0797f3fe` 的实际实现为准，优先于下文保留的历史版本／WIP 说明；Match、经验、资源发放、历史门槛和单人按需包见 [MATCH_CONTRACT 的 v23 节](MATCH_CONTRACT.md#2026-10-25-v23-当前合同索引基线-2b434e28--0797f3fe)。当前 schema/save/replay/command＝**12/8/8/7**，rules/content＝`s13-g2-3-v23-online-rules` / `s13-14.24b-g2-3-v23-online-rules`，NET5、50 ms、lcg32-v1；精确摘要必须一致，旧身份拒绝，无迁移。本次文档更新不改变这些版本，epoch 重录／验收由独立任务负责。[src/simulation/m8/version.ts:3](../src/simulation/m8/version.ts#L3)。

### Replay 8：击飞、位移和赛恩事实

`StatusApplication.knockup?:true` 仅可附在 stun 上，普通眩晕省略，`false` 或非 stun 标记非法；禁行动／打断及加时控制时长仍用原 stun 管线。`CombatViewStatus` 按 `[kind,harmful]` 汇总，同组只要一份带 knockup 就输出 true；因此显示汇总不能反向充当完整控制贡献证据。领域 `statusChanged` 沿用 application，回放保留标记，首遍与重演一致。[src/simulation/m8/contracts.ts:177](../src/simulation/m8/contracts.ts#L177)、[src/simulation/m8/status.ts:34](../src/simulation/m8/status.ts#L34)、[src/simulation/combat-replay-view.ts:21](../src/simulation/combat-replay-view.ts#L21)。

`movement.reason?` 完整枚举仍为 `ambessa-chain | ambessa-fist-retreat | mordekaiser-pull | sett-grab | sevika-knockback`，普通移动、赛恩冲锋／复活换格不另造 reason。只在实际换格时发送 `{type:'movement',tick,unitId,from,to,reason?}`，领域封套 combatId/eventSeq 保持，公开回放白名单保留 reason，终态 cell 仍随 unitUpdated/keyframe；动画不得回写位移或抽随机数。[src/simulation/combat-types.ts:136](../src/simulation/combat-types.ts#L136)、[src/simulation/combat-replay-view.ts:67](../src/simulation/combat-replay-view.ts#L67)、[src/simulation/combat-g2-3-summons.ts:79](../src/simulation/combat-g2-3-summons.ts#L79)。

强制位移是同 tick 瞬时操作，无 RNG；目标须存活、有 HP、可位移且非固定对象（包括海克斯熔炉、未解缚赛恩、酒桶）。占格读取 occupiesCell 与本 tick movementReservations；成功落点加入保留集，不能穿过单位／越界。莫德凯撒只拉爪击线命中的目标，源 Displacement=240 按 HexToRangeMap 映为 1 格，向自己最近一步（距离降 1，平局 row/col）；瑟提抓最近两人到自己邻格，第二人优先邻接第一人，平局按目标到落点距离、row/col；赛薇卡拳击沿源→目标直线逐格推出，遇阻即止，精确 cube 取整与 nudge 见实现。无落点只取消位移，技能原伤害／控制仍执行。[src/simulation/combat-displacement.ts:14](../src/simulation/combat-displacement.ts#L14)、[src/simulation/combat-displacement.ts:30](../src/simulation/combat-displacement.ts#L30)、[src/simulation/combat-displacement.ts:75](../src/simulation/combat-displacement.ts#L75)。这些落点／阻挡细则沿用已记录 P；安蓓萨的既有 BFS 与撤步口径保留下文。

黑玫 3/4/5/7 召唤赛恩；归属用 **numeric-aware unit ID**（unit-9 在 unit-10 前），不是普通字典序，也不因输入数组顺序变化。星级总和、阶段／档位倍率及双抗按开战输入编译；基础 HP750、AD50、0 双抗、120/120 Mana、AS7000Bps，双抗档位 40/45/50/100，完整阶段表及盾／冲锋／复活源值见 [src/simulation/content/g2-3-summons.ts:4](../src/simulation/content/g2-3-summons.ts#L4)、[src/simulation/strategy-snapshot.ts:215](../src/simulation/strategy-snapshot.ts#L215)、[src/simulation/g2-3-summons.ts:19](../src/simulation/g2-3-summons.ts#L19)、[src/simulation/unit-id-order.ts:1](../src/simulation/unit-id-order.ts#L1)。

- 绑定期间可受伤但不行动；黑玫有效成员累计施法达到 5，或赛恩 HP **严格低于 65%**，或仍绑定时已复活，首次设置 `runtime.buddyTriggered=true` 并发 bindingChanged。5 档以上先排满血治疗并给 +100 AP，再冲锋；实际治疗仍受原存活／重伤规则约束。[src/simulation/combat-g2-3-summons.ts:44](../src/simulation/combat-g2-3-summons.ts#L44)。
- 解缚冲锋选最近敌人（距离、ID），按 hex path 命中路径敌人，每个 100% AD 物理包和 10 tick 击飞；只有这些实际命中者获得黑玫受伤标记。落点为目标邻格中距冲锋起点最远的空格，平局 row/col；无空位原地。主动技能仍 300% AD 路径伤害＋20 tick 普通眩晕、60 tick 护盾；盾在 3/4 档为 175% AP，5/7 档为 75% AP。[src/simulation/combat-g2-3-summons.ts:63](../src/simulation/combat-g2-3-summons.ts#L63)、[src/simulation/combat-g2-3.ts:57](../src/simulation/combat-g2-3.ts#L57)。
- 7 档首次致死屏障写 `g23Sion:{reviveAtTick:deathTick+20,revived:false}`，HP 设 `max(1,floor(maxHp*7500/10000))`，清 target／冷却／可取消任务；保持 alive 但缺席，不行动／不占格／不可被选中，仍阻止己方被判全灭。返回时找最近空格（必要时 movement），保留时钟并设 revived=true，发 unitRevived；清可移除敌对控制／DOT／减益、获得免控和 +300% AS，复活后 40% 全能吸血持续本场。不能再次复活。[src/simulation/combat-g2-3-summons.ts:81](../src/simulation/combat-g2-3-summons.ts#L81)、[src/simulation/anomalies/availability.ts:14](../src/simulation/anomalies/availability.ts#L14)、[src/simulation/m8/s13-mechanisms.ts:341](../src/simulation/m8/s13-mechanisms.ts#L341)。
- 缺席赛恩与其他出生单位合并 roster 时不再重复追加相同 ID；待复活不会丢单位或生成两份单位事件。ability effectIndex 0＝主动，1＝冲锋伤害／击飞，2＝高档 AP，3＝复活清除／免控／攻速；不得把 effectIndex=1 的合法来源扩成所有技能任意索引准入。[src/simulation/combat-s13.ts:727](../src/simulation/combat-s13.ts#L727)、[src/simulation/combat-runtime-facts.ts:52](../src/simulation/combat-runtime-facts.ts#L52)。

### 恢复认证：输入决定应有事实，包括缺失／零值

独立实现先认证完整 `CombatInputBasis`、资源／装备前缀和重编译 strategy，再从该输入重建到候选 tick；不能以候选“带了某字段”来决定是否验证。恢复计算只作比较，不把其事件、RNG 或奖励提交给 Match。普通结构路径也认证完整 task 队列、openingDeaths、damageContributors、触发／动作／事件序号、RNG state/draws、Mana／余数、黑玫施法数、buddyTriggered、g23Sion（包括完全无字段）、所有 stun 分组和贡献（包括普通 stun、knockup 存在性）、burn／periodic／activity 历史。不同 HP 或合法范围内的计数不能作为等价证明。[src/simulation/combat-runtime-facts.ts:30](../src/simulation/combat-runtime-facts.ts#L30)、[src/simulation/restore-combat-replay.ts:8](../src/simulation/restore-combat-replay.ts#L8)。

技能声明状态另用 `validateAbilityStatusFacts(combat,replay,same):ReadonlySet<string>`：逐单位对比**全部 ability 来源贡献**及非 activity 的 `unit.statuses` 显示／移除锚点，包含来源、effectIndex、applicationId、系数、叠层、刷新、时序、贡献键及无状态情况；仅把独立证据中的键交给声明投影／运行态校验。channel／redirect 仍由 activity 历史认证；既有 `null → 1201` 到期显示投影保持。失败为 `Invalid Match save: ability status fact tick` / `ability status binding facts`，不接受候选自报键或 effectIndex；`abilityContributions/abilityStatuses` 仅为恢复内存证据，不是新增存档字段。[src/simulation/combat-runtime-facts.ts:7](../src/simulation/combat-runtime-facts.ts#L7)、[src/simulation/restore-combat-replay.ts:63](../src/simulation/restore-combat-replay.ts#L63)、[src/simulation/m8/restore.ts:22](../src/simulation/m8/restore.ts#L22)。

以下路径必须比对**完整战斗**，不能只验声明边界：Batch 2／战术家效果，Batch 3/B4 的动态机制（明确包括 corrosion、longDistancePals、categoryFive、overheal、satedSpellweaver、blazingSoul、nobleSacrifice、wealthyRehab、badLuck、goldForDummies、towerDefense/Live、heroCarry/Live、forming），假人／魔像，以及既有 Zephyr、Trench、Experiment clone、异常等。**腐蚀由可信 strategy 选中重演，即使候选把全部减抗贡献都删光也要拒绝。** Powder/Rumble 的 ignite 从可信英雄能力判断整场认证：旧 burn 和 wound 共用 ability identity／显示锚点的合法格式保留，不能放松通用 status 唯一键校验来接纳伪造重复项。[src/simulation/g2-4b-gold-restore.ts:12](../src/simulation/g2-4b-gold-restore.ts#L12)、[src/simulation/g2-4b-gold-restore.ts:48](../src/simulation/g2-4b-gold-restore.ts#L48)。这覆盖下文“非金币存档不重演”和“恢复不执行 combatStart”的历史概括：**不重发开战副作用，但可在私有证据中重新执行开战／战斗**。

重演缓存只存认证输入生成的证据；完整 version＋basis＋strategy 的 canonical 内容绑定身份，摘要命中还要整段内容相等；返回证据脱离引用，每次仍比较当前候选。Zephyr／改变 roster／异常路径保留冷重演，战中装备日志按 effectiveTick/seq 原顺序注入并认证 pending，不能丢日志或消费候选 RNG。[src/simulation/restore-combat-replay.ts:75](../src/simulation/restore-combat-replay.ts#L75)、[src/simulation/g2-4b-gold-restore.ts:30](../src/simulation/g2-4b-gold-restore.ts#L30)。

### Batch 3：冻结声明、运行态与战后事实

Batch 3 继续复用 `CombatUnit.batch2` 和原 mechanismState／shieldLayers／tasks／runtime，不另建规则引擎。可选 `batch2.blazingLast/nobleSpent/healed/dummyGold/vladCasts/primeSplash` 分别保留转移受益者、已牺牲、实际治疗、假人金币脉冲、弗拉基米尔施法和范德尔溅射门控；完整重演必须认证它们的存在和数值。[src/simulation/augment-pool-batch2-combat.ts:10](../src/simulation/augment-pool-batch2-combat.ts#L10)。

| 机制 | 同结果所需的顺序与计量 |
| --- | --- |
| 腐蚀 | 每队 tick40/80/…，取 ID 最小的存活拥有者，给**开战 startingCell 在己方前两排**的存活敌人各 -3 双抗；每脉冲／属性有独立 applicationId，永久叠加，本轮站位移动不改变资格。 |
| 炽热灵魂 I/II | tick1 起每 60 tick；每队 ID 最小存活拥有者给攻速最高（最短 interval、再 ID）的另一受益者 +20/35 AP、+2000/3000 AS Bps，60 tick。排除上一受益者并把 blazingLast 写在全部拥有者上；无可选者不发。 |
| 高贵牺牲 | 全部死亡先结算，第一批本队合资格死者取最小 ID，一次给存活友军 `25+floor(死者开场双抗*1000/10000)`；同 tick 死者不能受益，所有拥有者记 nobleSpent。 |
| 健康就是财富 I/II | 全队 1000/1500Bps 全能吸血，战斗累计的是 actual healing received，非请求值／过量；战后跨战首次累计 10000 给 8/15 金。 |
| 厄运保护 | 禁止暴击，暴击率按源比例换 AD；仍保留普通攻击计划原 RNG 消耗，不能因必不暴击跳过抽词。初始拳套按 Match 礼物收据。 |
| 训练假人／塔防／forming | 召唤目录声明固定不移动／普通假人不攻击，塔防按阶段3/5派生强化，永久纹章仍影响冻结羁绊；formation HP/AD 从来源总和编译，不读取候选战斗面板作基底。 |

周期、同 tick 死亡与来源标识：[src/simulation/combat-augment-effects.ts:49](../src/simulation/combat-augment-effects.ts#L49)、[src/simulation/combat-augment-effects.ts:109](../src/simulation/combat-augment-effects.ts#L109)；计量与派生：[src/simulation/combat-s13-state.ts:105](../src/simulation/combat-s13-state.ts#L105)、[src/simulation/m8/s13-mechanisms.ts:346](../src/simulation/m8/s13-mechanisms.ts#L346)、[src/simulation/augment-effects.ts:76](../src/simulation/augment-effects.ts#L76)、[src/simulation/content/batch3-summons.ts:1](../src/simulation/content/batch3-summons.ts#L1)。战后事实分别为 `batch3Healing`、`batch3Dummy`、`batch3DamageDealt` 和 Spoils 专用 batch2 行，零数值按既有条件省略；Match 在唯一结算后才发奖励，视图不自行累计。[src/simulation/g2-3-settlement.ts:33](../src/simulation/g2-3-settlement.ts#L33)。

六个英雄强化是 `field-medic/steb`、`blade-dance/irelia`、`shocking-troll/trundle`、`savage-revenge/renni`、`all-out/vander`、`blood-pact/vladimir`。开战从本队同名棋子中按星级降序、永久装备数降序、ID 升序选“最强者”，仅该实例得到 `heroCarryLive`，星级系数提前冻结；不是每次施法重新选最强。精确系数集（含零字段）、星级映射与开战范围／Mana 改写见 [src/simulation/content/augment-pool-batch3.ts:1353](../src/simulation/content/augment-pool-batch3.ts#L1353)、[src/simulation/augment-effects.ts:97](../src/simulation/augment-effects.ts#L97)。斯特卜三次技能伤害替代治疗；艾瑞莉娅向远目标／原目标各打一包且不改 cell；特朗德尔施法攻速／永久 AD、范德尔强化普攻及溅射、弗拉基米尔施法增伤计数均用既有任务／来源／runtime。荏妮按两格内最远目标（无则原目标）计划沿线额外包，**不实际改变荏妮 cell**，保留原治疗与眩晕；不能按“猛扑”文案自行加位移事件。[src/simulation/combat-g2-3.ts:87](../src/simulation/combat-g2-3.ts#L87)、[src/simulation/combat-s13-abilities.ts:1](../src/simulation/combat-s13-abilities.ts#L1)。未确认时点／几何仍为既有 P，本文不将其提升为原服事实。

### Batch 4 B4Combat：四条共享原战斗状态

| 强化 | 当前权威执行与持久化事实 |
| --- | --- |
| 天涯若比邻 `longDistancePals` | tick1、在普通周期／动作前，按起始坐标取最远两个存活非 proxy 友军；ID 排序遍历，距离平局保留首对，少于两人无贡献。双方先同时采 AD/AP/护甲/魔抗，再各给对方对应值的 2200Bps 向下取整 flat 贡献，effectIndex 分别偏移 0–3，不反馈放大，不改冻结羁绊。 |
| 五级飓风 `categoryFive` | 初始给普通飓风；每个普通／光明飓风实例分别派生原触发声明：maxTargets＋1，原 attackDamageBps×8500/10000 后 floor，保留实例来源、选目标及 proc permissions；不是只改第一件或改普攻本体。 |
| 过量治疗 `overheal` | 每第三次普攻按原 attackCount 门控，额外 `floor(AD*11500/10000)` 物理 attack-extra 包、不能暴击；只按**本强化额外包实际伤害**的 50% 发自疗。转盾只取该来源在 HealOutcome.shares 的过量，不把普通攻击回血并入。 |
| 满意的织法者 `satedSpellweaver` | 施法成功授 2000Bps 全能吸血 60 tick，按有效贡献判断窗口，重复施法续窗不叠成倍吸血。窗口内对本单位 HealOutcome 的总过量转盾；与过量治疗并持时两条各自处理。 |

两种转盾先用经重伤处理的过量，再走正常护盾削减（含加时）；每来源一层，未到期剩余＋本次过量，上限300，期限当前 tick＋60；零过量／死亡不造新盾。原 shieldLayers、来源、计数及 timed modifier 就是全部保存事实，恢复从可信输入完整重演，不能只验盾≤300或攻次可整除。实现和实际接入顺序：[src/simulation/augment-pool-batch4-b4combat.ts:14](../src/simulation/augment-pool-batch4-b4combat.ts#L14)、[src/simulation/augment-pool-batch4-b4combat.ts:34](../src/simulation/augment-pool-batch4-b4combat.ts#L34)、[src/simulation/augment-pool-batch4-b4combat.ts:45](../src/simulation/augment-pool-batch4-b4combat.ts#L45)、[src/simulation/augment-pool-batch4-b4combat.ts:56](../src/simulation/augment-pool-batch4-b4combat.ts#L56)、[src/simulation/combat-s13.ts:269](../src/simulation/combat-s13.ts#L269)。数值归一化来自 `round(raw*10000)`、秒×20；原始 float／null 仍保留于 [src/simulation/content/augment-pool-batch4-b4combat.ts:69](../src/simulation/content/augment-pool-batch4-b4combat.ts#L69)。

### 同基线以来的召唤、极客与执法边界

实验格上的纹章携带者把复制能力分享给该队所有实验格上的试验品；复制在战斗全部开场效果后保存 `experimentClone:{openingMaxHp,triggeredAtTick:null,cloneId:null}`；tick160 或首次死亡先到者只触发一次，在死亡清理后、淘汰判定前按 numeric-aware ID 顺序处理。复制体同星／同形态，HP 用开场样本×声明比例（60%×档位 Scaling 1.15/1.3/1.5＝69/78/90%，7档不再翻倍），0 Mana；不继承装备／强化／实验室或复制能力，不重算羁绊计数，不发永久成长／战后存活伤害。先选原格、再最近空格（距离/row/col），无空格也消耗触发并保留 cloneId:null。复制体的 `itemSummon.kind='experiment'`、origin、出生 tick、HP 基底、roster 和触发事实均由冷重演认证，不能从快照导入战斗专用召唤。[src/simulation/g2-3-experiment.ts:11](../src/simulation/g2-3-experiment.ts#L11)、[src/simulation/g2-3-experiment.ts:26](../src/simulation/g2-3-experiment.ts#L26)、[src/simulation/combat-experiment-clone.ts:20](../src/simulation/combat-experiment-clone.ts#L20)、[src/simulation/combat-experiment-clone.ts:62](../src/simulation/combat-experiment-clone.ts#L62)、[src/simulation/g2-4b-gold-restore.ts:55](../src/simulation/g2-4b-gold-restore.ts#L55)。

极客6按携带者源角色推荐表的客户端顺序选第一个合法成装，否则按 seed/round/itemId 独立词从合法候选选；极客9再映射到光明，无映射保留普通；6+ 排除锅／铲，不影响永久装备或护盾组件计数。执法10在战斗快照编译时先没收敌方英雄除纹章外所有装备作用（含临时／神器／光明／辅助），早于极客转换／光环／装备召唤；双方独立没收，不转移或销毁永久装备，不更改原羁绊成员，战中后来装入的装备在该战仍无效。恢复按冻结编译结果认证，不接受候选客户端重选。[src/simulation/content/scrap-lucky.ts:3](../src/simulation/content/scrap-lucky.ts#L3)、[src/simulation/strategy-g2-2.ts:38](../src/simulation/strategy-g2-2.ts#L38)、[src/simulation/content/enforcer-confiscation.ts:8](../src/simulation/content/enforcer-confiscation.ts#L8)。以上未核实抽样／顺序继续沿用已有 P-EX 与极客／执法 P，不在本次文档任务中新增玩法。

投机者之刃开战银行数修正与法球领取时序见 MATCH_CONTRACT：单人终战 goldBefore 必须减本场战后直发金才可认证 bankGold，战中已认证装备安装也用该余额；金币机会包括成功／失败词和序号，独立 itemRandomStreams／itemGoldReceipts 逐项认证。战斗内金币增加只更新同队合法银行持有者的当前采样，Match 到唯一结算才发资源，不能据动画提前发金。[src/simulation/b8-restore.ts:183](../src/simulation/b8-restore.ts#L183)、[src/simulation/g2-4b-gold-restore.ts:112](../src/simulation/g2-4b-gold-restore.ts#L112)、[src/simulation/combat-s13.ts:177](../src/simulation/combat-s13.ts#L177)。

## 2026-10-23 战斗法力与暴击率溢出（已随 v22 录制）

用户10-23批准第1–4条：受伤每包 `min(4250, pre + 3×post)` 百分之一法力（pre含暴击/增伤，post含护盾与原包延迟伤害），同单位tick末合计取整、余数跨tick；受伤回蓝封顶当前最大法力，其他来源可超过上限。施法消耗最大法力并保留溢出，普通单位施法开始 `manaLockedUntilTick=tick+20`，`tick<截止`阻挡普通法力来源，绑定本次施法退款沿原特例。阿木木/维克托专用资源保持。暴击率超100%部分每2Bps转1Bps暴伤，转换时向下取整，授权和RNG抽取数不变。旧M3/M4独立测试引擎不切换。内部签名、事件字段语义、分摊、恢复与失败枚举见 [法力规则报告](COMBAT_MANA_RULES.md)。本节覆盖下文旧“仅hpLoss×3%/同tick上限20/清空法力”描述；第5条减伤叠加不变。已随 v22-online-rules 纪元录制。

## 2026-10-23 普通单位 AD 星级修正（已随 v22 录制）

普通单位基础 AD 的 1/2/3 星倍率为 100/150/225%，HP 保留 100/180/324%；来源为 TFT 通用规则，用户 10-23 批准，14.24 源表只有一星属性。两者均由 `resolveUnitStats` 从一星属性乘整数百分比后向下取整，再进入既有装备/羁绊/成长管线。六费 HP 保留 100/180/360%；六费 AD 按各自一星值 × 100/150/225% 后四舍五入（正数半入），沃里克 110/165/248、维克托 100/150/225、梅尔 80/120/180。维克托固定攻击与转法强扣除基线同步使用 100/150/225。此项为用户 10-23 第二批批准的项目决定（P）；来源与元数据语义见 MATCH_CONTRACT 顶部。trainer 百分之一 AD 表、固定属性召唤物和专用四星不变。公开接口及失败行为不变；元数据字段和影响清单见 [MATCH_CONTRACT](MATCH_CONTRACT.md) 顶部与 [AD 星级报告](AD_STAR_SCALING.md)。**已随 v22 录制**，本次保留旧身份常量与 golden。

## 2026-10-23 五费技能几何 P 补充（已随 v22 录制）

金克丝仅三星电击采用朝当前目标的14×1穿透矩形；莫德凯撒自身出发枚举 E/SE/SW/W/NW/NE 六条8×3矩形，按命中人数、是否覆盖当前目标、方向序号择优。宽度为全宽，格中心判定，边界闭合，起点后方/终点之外排除；整数平方比较，不新增RNG。伤害、眩晕、最近四人加伤及其他招式均沿原表。玛尔扎哈每次施法合计五层感染，floor(5/N)平分、前5%N名命中者各多一层，命中顺序按ID稳定；沿用五个附着任务和原死亡传播时钟。当前HEAD原已总计五层，本单补明确顺序与1–5人验证。

沿用所有公共签名、失败reason、事件、任务和存档结构；完整事件及认证输入重演仍是恢复依据。杰斯返回起点尚未定义，保留旧路径，仍未完成。本节覆盖下文金克丝三星/莫德凯撒暂停说明；P来源、整数公式和验收见[五费技能几何报告](FIVE_COST_SKILL_GEOMETRY.md)。不录epoch/digest/golden，已随 v22 录制。

## 2026-10-23 五费实现修正（v22 候选，待统一 epoch）

赛维卡拳击/落点/大嘴改为火焰伤害基数的 3/1.3/3.2 倍；大嘴按星级 15/15/100% 严格低于阈值斩杀，下一 tick 在 2/2/10 格内连咬最低当前 HP 敌人，每跳保留 80% 原始咬伤；喷火按 20 tick 周期持续至目标死亡，控制/自身死亡取消。玛尔扎哈感染在死亡清理时转给最近存活可选敌人，保留层数和脉冲相位；虚空门按本次用户明确的横线要求取目标行 col±2。金克丝原有 25/30/200 tick 眩晕经独立向量确认。

沿用事件封套。`castVariant.channelTicks=40` 仅为喷火初始活动期限，后续 `activityChanged.refreshed` 更新期限；终止以权威活动结束为准。内部增加 `g23Flame/g23Chomp` 任务及严格的赛维卡来源/取消绑定；恢复仍校验完整重演事实，新增步骤不消费 RNG。新几何缺证部分（金克丝直线、杰斯飞行路径、莫德凯撒最优线）暂停，保留旧实现。依据、手算、工程粒度、接入点与未完成清单见 [五费修正报告](FIVE_COST_3STAR_FIXES.md)。按用户要求不在此分支修改版本/digest/golden，合回 v22 后统一录制；本节覆盖历史赛维卡固定两秒引导描述。

## 开局奇遇 Batch B（2026-10-23，待统一 epoch）

新增正式开战单位首次死亡账本 `CombatState.openingDeaths`；完整重放核对，不截断战斗事件。`g23BattleFacts` 投影敌方正式弈子首次死亡给沃里克，排除野怪、召唤物、后生单位、复活后的重复死亡；镜像无结算资格。普通蟹无普攻，每80tick尝试空邻格；危险巨蟹40tick首跳、每40tick全敌方100×实际跳数魔伤，接受既有控制/抗性/加时规则。魔像4-1/6-1升星，AD采用整数百分之一存基底，最终伤害阶段按原整数规则取整。完整数值、映射、签名与向量见 [Batch B 报告](OPENING_ENCOUNTERS_BATCH_B_REPORT.md)，旧epoch待 #410 合入后统一录制。

## 2026-10-23 安慰剂与战斗加时（项目决定 P，待统一 epoch）

用户 10-23 拍板：安慰剂按获得阶段一次发放 **2阶段8 / 3阶段11 / 4阶段及以后15** 金币；安慰剂+暂按 **15 / 18 / 22**，全队 **1%攻速**不变。S13原版安慰剂并非分阶段，本项目明确采用自定义规则，不改原始来源归档。收据以获得时的 round 认证，不随当前阶段重算或补发。

每战固定50ms/tick、最长 **900 tick（45秒）**；先结算该tick和消灭判定，双方仍有存活单位才 timeout→draw。**tick600（30秒）即时第1层**，之后每20tick加1层；伤害增幅和攻速各+1000Bps/层，无层数上限；受到治疗/护盾与新控制时长各-1000Bps/层，最多-7000Bps。控制持续tick四舍五入（正数半入，至少1tick），旧控制不回改。攻击冷却不追溯重算，模拟速度不变。

层数/增减幅依据用户提供的 [Riot TFT 13.22 补丁说明](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-13-22-notes/)；30/45秒和离散tick边界为本项目执行约定。**本单按要求离线，未联网重新核验来源。** 移速：加时期间（tick600起，不按层叠加）固定+5000Bps（+50%），用户10-23拍板（Riot 13.22只写“固定移速加成”无数值，属项目决定P）。加时前移动不变（5tick，沃里克狂暴ceil(5/1.5)=4）；加时中速度相加，步点落在周期5×10000/速度的固定tick网格上（单独10/3tick，叠加狂暴2.5tick），连续移动间隔为4,3,3循环（狂暴3,2循环），长期正好+50%，不存小数状态；迅击moveTenths每tick累计由3改为4/5交替（均值4.5）。完整数值、调用点和验收见 [规则实现报告](RULES_PLACEBO_OVERTIME.md)。

本节覆盖下文历史60秒/1200tick及固定安慰剂金币描述。按用户要求不录epoch、不更新版本/digest常量或历史golden；待PR #410合并后统一切换。这是开发候选，当前身份不得用于新旧混跑或发布。

## 战斗装备阶段 2（2026-10-22，候选身份；未录制 epoch）

已实现下一未封口 tick 安装、属性/装备程序重编译、PvE/PvP 私有成功日志与来源凭据、重放和恢复；本节覆盖历史 T12 下场生效及 #382 的 `battle-input-unsupported`。命令、完整签名、失败原因、羁绊冻结依据、服务器原子边界、UI 字段及待集成身份见 [LIVE_COMBAT_EQUIPMENT_PHASE2](LIVE_COMBAT_EQUIPMENT_PHASE2.md)。当前工作树采用候选 `v20-battle-equipment`，正式历史 epoch 仍为下节 black-market，须与开局奇遇一起录制后发布。

## v20-black-market 当前正式 epoch（2026-10-22）

父 epoch `v20-live-combat`，基线 `42d8a404`。rules/content=`s13-g2-3-v20-black-market` / `s13-14.24b-g2-3-v20-black-market`，CONTENT=`fnv1a32-utf16:9a83da50`、LOOT_REPLAY=`fnv1a32-utf16:e0eb43e2`；schema/save/replay/command **11/7/5/5**、NET6 不变，旧身份严格拒绝、无迁移。
黑市从至多三包改为**一个完整奖励包**，沿用源权重的一次加权抽样（原首候选，每 offer 一词）；接受整包、保留及超时 `@skip`，其余规则不变。命令/投影形状、签名及失败枚举不变。依据、RNG影响、唯一收据、恢复边界和 Claude 交接见 [BLACK_MARKET_SINGLE_OFFER](BLACK_MARKET_SINGLE_OFFER.md)。本节优先于下文历史身份和 N=3 描述。

## v20-live-combat 历史身份（2026-10-22）

父 epoch 为 `v20-xp68`（集成基线 `db04d196e4a12933624add7d61be9081a639607f`）；rules/content 为 `s13-g2-3-v20-live-combat` / `s13-14.24b-g2-3-v20-live-combat`，schema/save/replay/command 为 11/7/5/5，NET6。CONTENT `fnv1a32-utf16:93fad04c`，LOOT_REPLAY `fnv1a32-utf16:49eb9cf0`。完整继承8→9 / 9→10各68 XP、梅尔救命精确HP核对及父版战斗规则；只改变推进与传输，保留完整事件账本，旧身份拒绝、无迁移。实时流、逐tick空输入入口与验收见 [LIVE_COMBAT_PHASE1](LIVE_COMBAT_PHASE1.md)，本节覆盖下文历史当前身份。

## v20-xp68 继承经验策略（2026-10-22）

父 epoch rules/content 为 `s13-g2-3-v20-xp68` / `s13-14.24b-g2-3-v20-xp68`，父 v20-chem-baron；schema/save/replay/command 为 11/7/4/4。仅把 8→9 的 76 XP 与 9→10 的 84 XP 分别改为 68（用户 10-22 要求，项目自定），战斗规则和事件结构不变。阈值表、完整 digest、失败边界及 epoch 重录见 [MATCH_CONTRACT](MATCH_CONTRACT.md) 与 [XP68](XP68.md)。本节覆盖下文历史当前身份。

## v20-traits 继承规则覆盖（2026-10-21）

当前规则/内容为 `s13-g2-3-v20-chem-baron` / `s13-14.24b-g2-3-v20-chem-baron`，schema/save/replay/command＝11/7/4/4；父 v20-traits 的 10/6/4/4 历史录制不变。黑市新增持久化字段使 schema/save 各升一；战斗回放与命令协议未变。迅击、野火与五组强化关系按用户批准**魔改**；野火350%攻速标**工程取值**，14.24b原归档不改。导出签名、数值、伙伴冻结、协同资格、RNG及恢复边界见 [V20_TRAITS](V20_TRAITS.md)，覆盖下文旧的关系延期、野火仅回血及v19当前身份描述。无新Match公共命令或失败reason；旧身份严格拒绝，事件枚举与网络协议不变。

# M5 Combat contract v5

## v19 第二部分（当前合同，2026-10-21）

同一v19包含家人5随机任务法球、13.4六人彩蛋回移、六费 warwick / viktor / mel 与22种纹章总基础属性替换。schema/save/replay/command＝**9/5/4/4**；旧身份拒绝，无迁移，50ms和lcg32-v1不变。数值、魔改/未验证清单、导出签名、RNG、失败/恢复、说明底部显示字段及表现层交接以 [V19_PART2](V19_PART2.md) 为准；下文旧“家人预留/六费延期/纹章未改/8-4-3”描述已被本节覆盖。


## v19 战斗规则与赛薇卡显示扩展（2026-10-21）

当前规则为 `s13-g2-3-v19`；完整来源、整数公式、开场顺序、缺证约定、状态与恢复见 [V19_MECHANICS](V19_MECHANICS.md)。统领使用实际施法收据；盖伦冻结完整实际最大生命后统一广播；双形按startingCell；姐妹按强化/两种伙伴门槛和参与击杀；蓝发10用0/240/480…单一时钟。黑玫4档绑定为**推断**，标记目标的独立×1.08不叠加。链锯刃低于20%处决、400治疗、200tick击杀刷新增益；仅PvP真实敌方英雄掉3金是用户要求的**魔改**，战后唯一收据到账。

`castOutcome` 领域事件及既有 `toCombatViewEvents(events)` 显示投影，新增可选 `castVariant:{actionSeq:number,move:'flamethrower'|'punch'|'chomp',channelTicks:number,enhanced:boolean,heroAugmentIds:readonly string[]}`。赛薇卡每次施法发送最终选招、实际引导tick数（非引导0）及百变铁手强化结果；当前没有已实装赛薇卡专用英雄强化，heroAugmentIds显式为空。3D按unitId/actionSeq关联cast，直接选择动画与时长，继续服从权威生命/控制状态处理打断；不得自行抽招或消费RNG。投影为脱离引用的白名单数据，首遍/重放一致；无需修改网络封套。

可选 `CombatUnit.v19` 存放盖伦采样/共享生命、蓝发信号序号及一次授予标记、黑玫目标队伍标记。相关新动态战斗恢复从认证输入逐tick重建并对比完整状态；不重发任何收益。家人5任务/奖励法球及六人战斗星级覆盖已由第二部分实现，见V19_PART2。

## v18 炮手 6：14.24b 的 12/17 B 补丁修正

炮手（Cannoneer，内部 id `artillerist`，归档 `TFT13_Martialist`）6 档成员攻击力加成由 60% 修正为 **70%（7000 Bps）**，依据 `M9_DATA_LEDGER.md` 的 B-12/17 `effects.variables.AD` 行。2/4 档仍为 10%/45%；6 档每 4 次普攻触发的 250% AD 范围物理包不变。运行时表供战斗编译和说明共用，原始归档不改；无公共签名、失败原因、tick 或结算顺序变化。

> M8 B2审计修订待复审，目标合同见 [M8_RULES.md](M8_RULES.md) 与 [M8_UI_CONTRACT.md](M8_UI_CONTRACT.md)。本文件仍描述当前M7运行行为；新类型未接入，正式版本切换由B3–B9完成。

Match freezes `buildStrategySnapshot` before creating Combat. `combat-types.ts`, `ability-types.ts` and `strategy-types.ts` define the boundary; [M5_RULES R5–R6](../M5_RULES.md) defines numerical rules and the19 finite abilities. Runtime S13 execution lives in `combat-s13.ts`, `combat-s13-abilities.ts` and `combat-s13-state.ts`. The legacy standalone engine remains for unchanged low-level/historical primitive tests; its max-shield behavior must not be confused with M5 layers.

- Fixed50ms ticks, maximum900ticks, movement every5ticks. Existing hex geometry, E/SE/SW/W/NW/NE neighbor ordering and shared occupancy/reservations remain. Nearest-target ties use code-point ID. Input permutations cannot alter semantic ordering.
- Snapshot excludes bench and freezes distinct-definition trait tiers, equipment, augment/anomaly sources, ability variables, AP, base/percentage AD, precise attack speed, initial state and mechanics. Later catalog/Match/UI changes cannot change a running battle. Glass Cannon starts qualifying units at80%HP. No hidden enemy growth is added.
- Combat owns explicit RNG state/draw count and action/event sequences. Each planned ordinary attack consumes one word even at0% or100%crit; Caitlyn consumes one word per bombardment center. Consumption follows tick, actor ID and action index. No visual action consumes RNG.
- Tick barriers: cooldown/expiration/periodic work; existing control; movement; target/action planning; costs/counters/RNG/new shields; stable packet mitigation, redirect and shield absorption; simultaneous HP; surviving-target healing; surviving Mana/kill credit/growth; delayed status effects; death cleanup; elimination before timeout. New control cannot cancel an already planned action in the same tick.
- Ability coefficients are normalized to integer basis points. HP, damage, healing, shields and Mana are integers. Sum coefficient terms then floor once. Physical/magic resistance applies per packet, then additive amplification and strongest reduction, with positive damage at least1. Percentage shred takes the strongest source; flat changes sum; resistance clamps at0. See R6 for exact equations.
- Ordinary attacks gain10Mana. Actual HP damage grants surviving recipients `min(20,floor(hpLoss*3/100))`; shield absorption and overkill grant none. Mana earned this tick can cast next tick. Attack crit25%/140%; skills do not crit. No real damage type is needed by the slice.
- Target selection uses hex cells, never rendering coordinates. Lowest percentage compares integer cross products; Lux uses absolute currentHP. Line/path and cone approximations are explicitly defined in R6. Channel tasks stop on caster death/control; packets already planned land. Attached bleed persists after source death.
- Packet order is source-unit ID, action sequence, target ID, packet ordinal. Virtual remainingHP assigns actual damage and the first killing packet. Loris redirect uses the original target's mitigated amount, floors the50% share and skips a second resistance calculation; its shield still absorbs. Redirect cannot recurse, and multiple eligible Loris sources choose smallest ID.
- Shields are independent source layers. Same-source refresh uses larger remaining amount/later expiry; different sources add. Absorption consumes earliest expiry then source key and records source-specific totals. Irelia decays linearly in integers and tracks absorbed damage independently of remaining shield. Defensive duration records survive shield exhaustion so end effects are not lost.
- Status keys include source/definition/target. Newly delayed statuses start next tick; a1second control blocks20ticks before overtime, then uses the application-tick overtime duration documented above. Same-source refresh cannot create a gap; different-source semantics follow the finite mechanic. Periodic tasks explicitly track due tick and remaining shots. Darius' four primary-target bleed packets preserve the integer total including remainders.
- Healing caps at maximumHP and never revives a same-tick dead unit. Gunblade consumes actual damage and cannot recurse. Derived damage does not invent extra attack/cast triggers. Full future tasks and source provenance are part of the serializable state, not hidden closures.
- Tristana's once-per-cast lethal bounce is committed for next tick, and growth occurs only when a secondary bounce actually exists. Growth affects the current battle and is returned to Match once at settlement, including defeated battles. Match alone persists, merges or destroys growth.
- `targetChanged`, `packetDamage`, `heal`, `shieldLayerChanged`, `statusChanged`, `statChanged`, `kill` and `growth` supplement attack/cast/movement/death/finish events. Events retain actor, target, source, action/packet identity and numerical outcomes; actualHP, absorption, requested/actual healing and status changes remain distinguishable. UI can aggregate visual text but cannot truncate the authoritative ledger.
- Dead units remain in state withHP0/alive=false and no active target/action resources. Finished steps are idempotent. Empty/single-sided low-level combats end at tick0; Match owns the permitted empty-player concession and all economic effects.
- Restoration validates frozen and runtime state, including sources, layer aggregates, statuses, task timing, counters and sequences; it does not rerun combatStart. Tests distinguish independent numerical answers from replay/browser consistency using production calculations.


M5审计修订：alreadyMitigated伤害仍允许一次洛里斯分担；redirected实际分担直接在吸收阶段结算，不进入递归或弹射触发。恢复校验按来源/tick/计数验证动态字段和运算上界，schema5死亡单位周期AP只接受有限可达累计值，不声称重建未存储的死亡时刻。

## G2-1 candidate finite extensions

The existing `stepCombat(state) → { state, events }` interface and explicit `lcg32-v1` stream remain unchanged. Optional detached `CombatUnit.expansion` stores cumulative damage, Automata crystals, empowered attacks, chain cast/kills, cooldowns and target IDs. These values and the six `g2*` task kinds are JSON, copied by stepping and range-checked on restore. Amumu is a zero-max-mana passive champion; Zeri never casts. No wall clock or external lookup enters combat.

Every cast coefficient and star rank comes from `content/g2-abilities.ts`, generated from hash-gated normalized records. Twitch draws one random target per enhanced attack and one shared crit result per piercing bolt; secondary Zeri packets follow the existing non-critical extra-attack convention. LeBlanc initial kills scale subsequent empowered attacks. Attached Malzahar infections continue after caster death and transfer from dead targets; other non-attached tasks require a living owner. Trait blast, chain share and retaliation packets resolve on the following tick to avoid recursive same-tick damage.

Source/runtime tables and explicit limitations are in [G2-1 reconciliation](evidence/g2-1/RECONCILIATION.md). This is a candidate with33 heroes; Swain and source/emblem tiers not reachable from this inventory remain outside runtime. This section does not assert full14.24b equivalence.

## G2-4b WIP: Death’s Defiance

`allocateDamage(context, prepared, hp, shields, deferBps=0)` returns an optional
`outcome.deferred` after shield absorption. Packet conservation includes this
amount: mitigated = absorbed + deferred + hpDamage + overkill. Defaults preserve
existing callers. A holder stores `deferredItemDamage` debts with original packet
identity, start tick, total, paid and elapsed ticks. Payments occur before new
packets at the damage barrier over80ticks and never lower HP below1; excess is
consumed. Each positive payment emits `packetDamage` with existing equipment-proc
delivery plus `deferredPayment:true`; proc permissions are empty. No mana, vamp,
shield, redirect or further deferral applies. Debt is cleared on death.
These ordering details are pending project convention G24-DEFIANCE-ORDER-01,
not asserted as verified original script order. Restore rejects missing/foreign
item debt, duplicate or malformed packet provenance, and inconsistent progress.

### G2-4b WIP: mirror membership

`appendMirrorSummons(preparation,strategy)` appends canonical strategy units with
`itemSummon` origin derived from an actual on-board Mirror source.
`projectItemSummons(preparation,strategy)` projects these into combat only.
Restore independently recompiles the strategy and compares origin, identity,
starting cell, frozen form, sources and complete roster. Item summons never enter
permanent inventory/growth or survivor player damage. Trait counts are frozen
before copies; active trait targets extend to copies. `scaleItemSummonHp` applies
the clone multiplier to initial and dynamic health. Inheritance/placement are
pending conventions and this WIP does not claim complete native summon behavior.

### G2-4b WIP: Collector and gold authority

`CombatState.itemGoldReceipts` retains failed and successful rolls. Collector
uses an independent explicit stream and only produces a gold opportunity after
its own execution. The post-packet strict12% check, bypass of shields/Defiance
and exclusion of natural lethal hits are pending convention G24-COLLECTOR-EXECUTE-01.
Gold-item save verification has one explicit exception to structural-only combat
restore: it independently simulates the bounded combat from validated input and
compares receipts/RNG. This is read-only verification; it grants no resources and
does not advance candidate state. No-gold saves incur no combat replay.

### G2-4b WIP: Mogul stacking

`CombatUnit.itemMogulHits` retains at most35 packet/tick identities. Positive
shield-or-HP packets add one stack; deferred repayments do not. Resists affect
later packets. Max HP grows after the fixed-max survival sampling barrier,
preserves missing HP and cannot revive a lethal hit. Gold is1at full, then1
every160ticks while alive. These ordering details are convention
G24-MOGUL-STACK-01. Gold replay independently validates the hit ledger; max-HP
restore accounts for its historical stack count when checking shield samples.

### G2-4b WIP Zephyr absence

`CombatUnit.itemBanish?: {ownerId:string;itemInstanceId:string;untilTick:number}`
is frozen from original starting cells. For tick<untilTick the unit is absent
from active action, target and passive processing; it remains alive in roster
and prevents elimination. At tick100 it returns, relocating to the nearest free
cell if occupied. This is not a stun and ignores CC immunity. Combat start
programs precede suspension; missed periodic opportunities and opening jumps
are not replayed. Those ordering/collision details are pending convention
G24-ZEPHYR-ABSENCE-01, not verified original script semantics.
`CombatViewUnit.banished?:boolean` exposes presence without changing UI code.
Zephyr save authority is exact independent combat reconstruction from validated
frozen inputs; it does not accept candidate-supplied clocks as authority.

## S13 P2 开场事实与实例覆盖

`CombatUnit.s13P2Opening?: { selected: readonly string[]; shared: readonly ({source:CombatOrigin;attackDamage:number;abilityPower:number;health:number;armor:number;magicResist:number})[] }` 记录经过种子选择的强化身份和一次冻结的分享贡献，仅在真正获得开场加成的单位上存在。它不写回准备棋盘、不影响羁绊计数。恢复先从已认证 `CombatInputBasis` 独立重建开场，再逐单位核对此字段；保留所有原有动态事实、HP 基底和 RNG 校验。没有这些效果时不允许伪造该字段。

`startP2Combat(ctx: AbilityContext): void` 在既有开场初始化、羁绊与光环后使用现有 Combat lcg32 流；两个随机强化共用无放回抽样。先完成随机加成，再冻结所有分享者的五项属性及邻格名单，最后统一广播，禁止广播间的反馈放大。`validateP2Opening(combat: CombatState, replay: RestoreCombatReplay): void` 对比独立开场，错误抛出 `Invalid/Unexpected S13 P2 opening`。当前已有的 `readCombatStats` 统一读取这些经过认证的数值；调用参数只需 `Pick<CombatState,'units'|'tick'>`，原来传完整 CombatState 的调用兼容。

冕卫／夜之锋刃／基克／兰顿的覆盖绑定具体装备实例。普通物品目录不变；宝箱战斗中新发放的冕卫／夜之锋刃也按接收者已冻结的强化来源覆盖，由同一程序恢复。石头皮肤按战斗时钟确定剩余双抗，剔除弱者按实际目标失血比例决定暴击率、每 60 tick 在射程内按百分比生命选择目标。

P2 审查修正：开场护盾仍按既有机制初始化时的生命采样，随后执行 P2 随机增益及冻结后广播。恢复在 tick 0 精确扣除已认证的 P2 生命贡献，重建护盾产生前的生命基底；tick > 0 使用生效后的基底，不增加任意候选。P2 生命写入统一经过 `scaleItemSummonHp`。镜像在 P2 全部广播完成后再次冻结持有者的最终开场生命，镜像自身接收的 P2 生命作为 flat 保留，并统一按其 healthBps 缩放。精心赋能仅给后两排非召唤英雄生成候选，先过滤再排序抽样。
# S13 P3 补充合同

当前分支新增7个强化和7个异常，来源、接口、逐项数值证明与两项缺脚本数据的**项目约定**见 [S13_AUGMENTS_P3.md](S13_AUGMENTS_P3.md)。公开战斗入口和伤害管线保持一致；仅增加可序列化的 `CombatUnit.s13P3?` 调度/门控记录，以及伤害准备阶段的只读 `blockedByMitigation` 观察值。版本由合并时统一升级。
## First-pass combat replay capture (optional PvP / PvE)

All interfaces below are exported from the sole server rules entry, `src/server-entry`.
No rule values, versions, content digests or settlement authority change.

```ts
interface BattleReplayOptions { readonly captureReplay?: boolean }
interface BattleTask { advance(maxTicks: number): BattleResult | null }
interface BattleReplayTask extends BattleTask { replay(): CombatReplay | null }
startTwoSidedBattle(input: BattleInput): BattleTask;
startTwoSidedBattle(input: BattleInput, options: { readonly captureReplay: true }): BattleReplayTask;
startTwoSidedBattle(input: BattleInput, options: BattleReplayOptions): BattleTask | BattleReplayTask;

interface CombatReplayRecorder {
  record(previousState: CombatState, step: CombatStep): CombatReplayTick;
  finish(terminalState: CombatState): CombatReplay;
}
createCombatReplayRecorder(initialState: CombatState,
  initialEvents: readonly LedgerCombatEvent[]): CombatReplayRecorder;
// CombatStep = { readonly state: CombatState; readonly events: readonly CombatEvent[] }
// CombatReplay = { readonly initial: CombatViewState;
//   readonly ticks: readonly CombatReplayTick[]; readonly terminal: CombatViewState }
```

- **PvP lifecycle:** opt in with `startTwoSidedBattle(input, { captureReplay: true })`.
  Continue calling advance with the usual tick budgets. replay() returns null until
  the advance that returns BattleResult, then returns the same deeply frozen replay
  on every call. BattleResult has no added fields; its canonicalContent and the
  proposeSettlement output equal those with capture disabled.
- **Default path:** omitted options and explicit false create no recorder, views or
  replay accessor. The task retains its original shape and advance return value.
  A dynamic boolean option returns the union type; narrow with `'replay' in task`.
- **Budgets:** recording never calls stepCombat or consumes RNG. advance still calls
  stepCombat at most maxTicks times. Invalid budgets throw BattleValidationError
  ('invalid-budget') before advancing, including after completion. The synchronous
  resolveTwoSidedBattle wrapper is unchanged: insufficient total budget still
  throws step-limit-exceeded. A tick-zero finished battle requires one advance call
  before replay() is available.
- **PvE lifecycle:** after successful startMatchCombat, construct the recorder with
  state.combat and ALL opening events whose domain is 'combat'. initialState must
  be tick zero. initial.nextEventSeq separates already applied opening events from
  later events, rather than their tick: wolves' deferred tick-zero jumps belong to
  the first step frame, not the initial frame.
  For every `const next = stepCombat(previousState)`, call
  `recorder.record(previousState, next)` exactly once before further stepping or
  changing next. record returns the deeply frozen frame for that tick. Once finished,
  call `recorder.finish(next.state)`. If already finished at creation, call
  finish(initialState) directly. Repeated finish with the same terminal view returns
  the same replay object; record after finish is prohibited.
- **Trusted boundary and errors:** this recorder collects trusted rules outputs;
  it does not replay combat or authenticate the full ledger/hidden state. Supply
  the initial state, complete opening ledger and consecutive real CombatStep
  outputs from the same battle; never use it to validate untrusted input.
  A nonzero initial tick, or a non-finished/out-of-range terminal throws
  RangeError('invalid-replay-input'). Repeated/skipped ticks, mismatched combatId,
  record after finish, or a terminal view different from the last recorded view
  throw RangeError('replay-divergence'). These rejected calls append no new frame;
  fix the call sequence before continuing. Projection/identity-alignment exceptions
  propagate unchanged. The recorder does not verify non-visible terminal fields.
- **Ownership and equivalence:** every view and animation event is projected into
  detached whitelist data and deeply frozen immediately. The recorder retains only
  frozen views/frames and a task-local freezer; it adds no global freeze-table
  registrations. First-pass and replay paths share identity alignment, unitUpdated
  deltas, membership events and keyframes (every 20 ticks, order change or finish).
  For the same trusted initial state, terminal and complete ledger, their resulting
  CombatReplay canonicalContent is byte-identical, with identical deep immutability.
- **Replay/audit compatibility:** startCombatReplay(input) and toCombatReplay(input)
  retain combat re-execution, ordered visible-event comparison, terminal comparison
  and replay-divergence errors. Old callers and server spot checks may continue
  using them. Capturing a replay does not imply that a spot check has run, and never
  authorizes another settlement. Server integration/spot-check policy is separate.
  See also [MULTIPLAYER_CONTRACT.md](MULTIPLAYER_CONTRACT.md).

## v18 纹章与高档位扩展（2026-10-21）

来源、数值与延期项见 [V18_TRAIT_EXPANSION](V18_TRAIT_EXPANSION.md)。沿用v18身份。迅击战士按目标缺失生命计算攻速、当前目标死亡获得4档护盾；搏击手触发治疗分40个tick发放；法师8技能命中弱化输出25%、持续60tick、不叠加；先知8按技能实际生命伤害的20%治疗友军。全程整数/基点、50ms tick、显式RNG；完整来源/事件账本与恢复验证保留。

## v19 回归修复边界

宝箱战中发装备重算最大生命时，必须保留盖伦已授予的实际共享生命，仍置于百分比乘区外；不改变召唤物/建筑永久禁装备、击杀归属或助攻条件。普通 v19 恢复复用由完整认证输入绑定的独立回放证据，每次仍比较完整候选；Zephyr/Trench/异常路径保留每次冷重演。细节与回归证据见 [PR364_CI_REPAIR](PR364_CI_REPAIR.md)。


## PR #382：逐 tick 输入与认证日志预留（阶段1）

`BattleReplayOptions.beforeTick?: (effectiveTick:number)=>readonly BattleTickInput[]` 在推进的每一 tick 前调用（包括 `advance(n)` 内部多步与 `advanceTick()`），effectiveTick 为当前游标 + 1；终局后不调用。
`BattleTickInput = BattleEquipmentInput`：`{kind:'equipment',seq,effectiveTick,seatId,itemId,unitId,slot}`，序号与生效 tick 由服务器单写队列认证，不接受客户端自报历史时刻。
`BattleResult.inputLog?:readonly BattleTickInput[]` 预留成功安装日志，空时省略；不进入 CombatView/网络公共帧。阶段2须将安装效果与成功日志原子提交，在恢复/重演中按相同 tick/seq 注入，失败不记入日志或消费 RNG。
本阶段没有 applyBattleEquipment：输入源返回空批次时无副作用；非空批次在 stepCombat 前抛 `battle-input-unsupported`，不会推进该 tick；外部 BattleResult 的结算与回放也拒绝非空/畸形 inputLog，防止静默丢弃日志。
既有单人 Match 的成功装备操作继续写 `BattleRecord.equipmentCommands`（共享类型 `BattleEquipmentCommand`），按原游标 tick 重演并与资源账本逐项认证；日志缺失、伪造或时序不符仍拒绝恢复。

## 安蓓萨施法位移（P，2026-10-23，已随 v22 录制）

沿用奇数锁链/偶数拳击。锁链伤害前移到目标身边距自己最近的可达空格；已与目标相邻时原地不动、不发位移事件（不相邻且无可达空格时也原地，见 S13_RULES_GAP 同名条目），距离平局沿普通 BFS；拳击在本 tick HP/存活屏障后向己方半场且远离施法时目标坐标后撤 1 格，几何首选格不可用则原地。复用占格、移动限制及本 tick 保留格；不增加 RNG 调用，不改伤害/短晕/耗蓝。精确口径、独立向量和回退见 [AMBESSA_DASH](AMBESSA_DASH.md)，原档缺距离来源见 [证据](AMBESSA_DASH_EVIDENCE.md)。

既有 `CombatEventData` 的 movement 增加可选 `reason?: 'ambessa-chain' | 'ambessa-fist-retreat' | 'mordekaiser-pull' | 'sett-grab' | 'sevika-knockback'`；其余 `{type:'movement',tick,unitId,from,to}` 不变。只有实际换格才发；普通移动不带 reason。领域封套仍是 domain/combatId/eventSeq；公开 `CombatViewEvent` 保留 reason，终态 cell 仍由 unitUpdated/keyframe 下发。无新命令/失败 reason；无落点只取消位移，原施法照常。此为 P 项目决定，已随 v22-online-rules 录制。

## 单场初始化协作切片（2026-10-23；不变更 epoch）

新增 `Generator<void, T, void>` 入口。每次 `next()` 只继续初始化，`yield` 不携带状态或事件；只有 `done: true` 返回完整结果。同步入口 drain 同一生成器，保留校验次序、错误归属、RNG 次序、JSON 字段及数组顺序。调用方必须在 continuation 存活期间保持输入不变；服务器用原有冻结写入/FIFO 屏障满足此约束。取消可调用 `return()`，未发布的任务直接丢弃，重新创建不消费调用方 RNG，不补发奖励。

| 导出（规则模块） | 签名 / 返回值 |
| --- | --- |
| `two-sided-snapshot.ts` | `snapshotForBattleSteps(state: MatchState, seatId: string): Generator<void, PlayerBattleSnapshot, void>`；`restorePlayerBattleSnapshotSteps(input: unknown)` 同返回类型 |
| `two-sided-battle.ts` | `compileBattleSteps(a: PlayerBattleSnapshot, b: PlayerBattleSnapshot, battleSeed: number, identity?: BattleIdentity): Generator<void, BattleInput, void>`；`restoreBattleInputSteps(input: unknown)` 同返回类型 |
| `two-sided-battle.ts` | `startTwoSidedBattleSteps(input: BattleInput, options?: BattleReplayOptions)` 返回 `Generator<void, BattleTask, void>`；`captureReplay: true` 重载返回 `Generator<void, BattleReplayTask, void>`；联合选项返回联合任务 |
| `strategy-snapshot.ts` | `buildStrategySnapshotSteps(state: CombatStrategyInputs, catalog?: StrategyCatalog, context?: TraitProjectionContext, equipmentBasis?: StrategySnapshot): Generator<void, StrategySnapshot, void>` |
| `combat.ts` | `createCombatWithEventsSteps(preparation: GameState, strategy: StrategySnapshot, combatId: string, rngState?: number, context?: TraitProjectionContext): Generator<void, CombatStep, void>` |
| `match.ts` | `openMatchCombatStreamSteps(state: MatchState): Generator<void, MatchCommandResult & { readonly streamInitial?: CombatState }, void>` |
| `setup-work.ts` | `drainSetup<T>(work: Generator<void, T, void>): T` |

`buildStrategySnapshot` 同步入口向生成器原样传递 PR9 的 `equipmentBasis`；战斗中装备重编译沿用冻结羁绊与非装备来源，不重新计算开战选择。PvP 内部 `compileSide` 同步入口同样 drain `compileSideSteps`，供 PR9 的 `queueEquipment` 首次准备收据使用。

PvP 快照/编译/任务入口由 `server-entry` 一并导出。内部 JSON 校验与冻结按至多64个未命中缓存的对象节点分段；G23 经济历史按收据重演、逐字段比较；策略编译和战斗单位创建按原单位顺序分段。字符串解析、单个对象/数组枚举、原生 clone、单次 combatStart 等仍是不可抢占步骤。`freezeContentSteps` 只用于调用方拥有的数据图，可能在暂停前冻结已完成子树；它不保证取消时撤销冻结。canonical 同步/切片共用遍历器，切片模式不保留短命快照文本缓存，不跳过任何校验。

失败枚举不新增：快照/编译/任务沿用 `BattleFailure` / `BattleValidationError`，包括 `snapshot-version`、`content-digest`、`invalid-snapshot`、`wrong-phase`、`round-mismatch`、`round-kind`、`seat-collision`、`invalid-seed`、`invalid-battle-id`、`invalid-mirror`、`battle-input`。PvE 仍返回原有 `MatchFailure`，失败保持原 state 引用，无事件、资源及 RNG 变更。异常可能在后续 `next()` 才抛出；服务器 `guardedSteps` 沿用 `BattleResolveError` 包装。

服务器 `startLiveTaskSteps(envelope, beforeTick?)` 依次委派快照、编译、任务初始化；`openStreamSteps` 委派 PvE 初始化。所有流仍私有暂存，全部完成才原子发布并启动共同 tick0 时钟。`runSettlementSlice` 用注入的 `sliceNow`，初始化工作窗口为 `min(5ms, sliceMs/2)`，保留余量给下一不可抢占子步骤；同时遵守 `sliceTicks`。未配置 `sliceMs` 时沿用无时间预算语义。结算窗口、50ms 战斗 tick、RNG、内容身份、账本及录像格式不变；真实 GC/系统调度暂停不构成跨硬件硬实时保证。

## v23 控制与赛恩存档恢复（P，2026-10-25）

`StatusApplication.knockup?: true` 只给击飞的 stun 贡献附加标记；普通眩晕省略。两者仍按原 stun 规则禁行动、打断，不改变伤害或持续时间。恢复从认证开战输入独立重放，比较全部 stun 分组和贡献（含来源、目标、时序与 knockup 的存在性）；添加、删除或伪造标记均拒绝。

`CombatUnit.g23Sion?: { reviveAtTick: number; revived: boolean }` 保持现有可选格式。只有黑玫档位至少7的 `g23-sion` 可持有；首次致死屏障记录返回 tick（死亡 tick + 20），等待时仍为存活但缺席单位。`revived=false` 时返回 tick 必须在当前 tick 之后、最多20 tick；`revived=true` 时返回 tick 不得晚于当前 tick，记录保留以禁止二次复活。字段结构、类型、持有者及完整历史事实（包括无字段的状态）均认证，不从候选 HP 或标记推断死亡史。

赛恩 ability 来源 effectIndex：0 为主动技能，1 为解缚冲锋伤害/击飞，2 为高档解缚 AP，3 为复活清除/免控/攻速。旧状态来源校验仅对赛恩冲锋 stun 接纳 effectIndex=1，并用独立重放认证真实贡献；不普遍放宽其他技能、护盾或任务的 effectIndex。以上仅补存档支持与认证，不更改合法状态的格式、事件、回放或战斗推进。

### Batch 4 B4Combat（P，2026-10-25）

四条机制与推断边界见 [P-B4COMBAT](S13_RULES_GAP.md#p-b4combatp2026-10-25batch-4-四条战斗强化)。只增加声明与既有战斗事件，不增加存档字段/事件类型/公共命令/失败 reason；全程服务器权威，前端不得另算属性、弩箭、吸血或护盾。`augment-pool-batch4-b4combat.ts` 内部入口 `openingB4Combat(ctx):void`、`castB4Combat(ctx,unit,seq):void`、`attackB4Combat(ctx,unit,target,seq):void`、`damageB4Combat(ctx,owner,packet,dealt):void`、`overhealB4Combat(ctx,target,outcome):void` 使用冻结来源及既有状态；`b4Vamp(unit,tick):VampRate[]` 只返回当前窗口贡献，`categoryFiveTrigger(unit,definition):TriggerDefinition` 只派生飓风声明。恢复仍从可信 combatInputBasis 重放，对象/JSON/序列化入口不接受候选自报贡献。


## B5-67 炼金术士（v25，2026-10-27）

依据 `research/report_data.json` 的 B5-67（总量、AP 与回蓝公式已证实）及 P-B5-67 / P-B5-67-EXEC（约定）。最强辛吉德不再普攻，也不派生普攻计数/普攻回蓝；奔跑继续服从既有控制、存活、落点占用与共享预留。朝最近可选敌人跑，等距按 ID；接敌穿过目标格并落在另一侧可用格，沿途格各留下宽1格的毒云，不扩成邻格范围。云留存60 tick，同格只刷新；云接触按 `areaEnemies` 的在场资格判定，隐身/不可选中仍可接触，死亡/缺席/攻击代理不接触；寻敌保持可选目标资格。每个目标只保留一份同源毒伤，重入不重置跳相位或叠层。

1–4星5秒总毒伤140/210/315/420，乘首次接触时AP/100后取整；每10 tick跳一次，首跳接触+10，末跳+100，用累计差分分摊整数余数。云与既存毒伤在来源死亡后持续，来源不能再移动、落新云或回蓝。毒伤走既有 `ability-periodic` 魔法包、抗性/盾/技能暴击授权/吸血链，绝不直接扣HP。回蓝在幸存者法力屏障逐tick提交10×当前原始攻速/20，携带有界整数余数，遵守施法锁蓝；施法仅以自己为目标，持续80 tick的20%全能吸血与平坦+250移速替换原始减伤和友军攻速。网格映射细节见 P-B5-67-EXEC，未声称原版逐帧路径已证实。

附着毒伤服从既有 G11 净化：净化同步移除该目标的所有敌方辛吉德附着毒伤，来源已死亡时也移除；不清除云、其他目标的毒伤或友方来源，不回滚本 tick 已规划的包。若后续仍接触云，可重新附着，首跳从新接触后10 tick开始。夜之锋刃的不可选中与伤害防止仍各自判定，不代替净化。

现有签名 `advanceS13Tick(state) → CombatStep`、`planS13Cast(ctx,unit,target,seq) → string[]` 不变；新增规则内部入口为 `compileMadChemist(state,unit,board,effect) → Effect[]`、`moveMadChemist(ctx,unit,occupied) → readonly HexCell[] | undefined`、`advanceMadChemist(ctx,unit,nextSeq) → void`。本强化战斗必须按可信输入完整重演验证；删除/插入毒云、改跳次/伤害/目标/回蓝余数/施法到期、改冻结 mechanic 均不能通过恢复。保持 v25 候选规则/格式号，R4 内部清单版本升为 `augment-pool-batch5-r4-v25-r1`，重算内容和战利品身份；不重录历史 epoch。
## Batch 5 G2 死亡与复制体（P，2026-10-27）

老友幽魂使用实际死亡事件而非击杀归属；坦克／其他角色给5生命，AD类给80 Bps AD，AP类给1 AP。非英雄召唤物不贡献；英雄复制体及同实例复活后的再次死亡贡献。死亡屏障更新同队当前单位，死亡单位不被该加成复活；后续战斗的当前／未来英雄从强化历史获得全队永久累计，合星不重复相加这份全队值。后出生的英雄复制体继承本战已累积的AD／AP；复制体已把原单位当前最大生命写入基础时，不再次叠入同一份生命成长。

爆蓝之城每队每战前5次原始蓝发英雄死亡各消耗一次：按低一星（最低1星）重编译非装备／非异常声明，再减400最大生命、保底100。保留冻结有效羁绊和永久强化；已触发的蓝发羁绊继承永久收益及剩余爆发时长，不重新对全队发奖。复制体不继承原单位临时施法、装备、异常或冷却状态；原格优先，冲突按六角距离／行／列取最近空格；满盘时消费该次额度而不出生。复制体不占五次额度、不递归，但其死亡进入其他死亡触发链。

出生使用既有 `unitSpawned`／回放 `unitEntered`；在本 tick 死亡效果结算后、胜负判断前加入，下一 tick 才行动。无随机抽取。`rebelCopy`、`batch5RebelSummons`、`ghostFriends` 和必要的蓝发脉冲时点均为规则内部战斗状态，由整份 Match 的独立服务器 authority 及外部战斗的完整冷重演认证，不靠候选收据自证。数字及证据分级以 S13_RULES_GAP 的 P-B5-63-G2／P-B5-70-G2 为准。
## 2026-10-27 Batch 5 G3 战斗接线

P-B5-68-G3 的空战：每次野火帮起飞调用 `startAerialDash(ctx,unit):void`；所有 S13 行走、技能、强制位移、传送及开场移动提交后、下一个动作前调用 `recordAerialMovement(ctx,unit,to,from?):void`。只对已编译 `aerialWarfare` 的成员生效。`CombatUnit.aerialWarfare?:{hexes:number,dashes:number}` 是本战可重演状态，hexes 封顶 99，两个计数分别派生 AD Bps／AP 后参与原有加法属性池；每次变化发已有 `statChanged`，没有新事件类别或时钟。

P-B5-71-G3 的物竞天择：`mutationSacrificeCell(team?:Team,board?:Board):HexCell` 返回固定献祭坐标；`mutationDonor(state:CombatStrategyInputs,traits:readonly TraitSnapshot[]):Unit|undefined` 用开战前的正式成员快照判断资格（无持有者、空格或非成员均 undefined）。`compileMutationEffect` 编译 1200 Bps HP 和仅献祭者的 `mutationSacrifice` 标记；`mutationEquipmentProjection` 过滤战斗投影的装备／异常，保留原输入供加成分享。`addMutationDonation` 把额外自身试验品加成叠到普通实验室成员；7 档加倍；原生／纹章成员和克隆能力沿用既有羁绊规则。

召唤描述的身份与占格先按献祭前的正式阵容投影，与策略编译使用同一依据；献祭最早获得的黑玫瑰成员时，仍保留以它命名且已经编译的唯一赛恩，不按剩余成员重命名或追加第二个赛恩。单边、双边及镜像均沿用此顺序。`excludeMutationSacrifice(units:readonly Unit[],strategy?:StrategySnapshot):readonly Unit[]` 随后在实际战斗单位生成及任何开战钩子前排除明确标记的献祭者及其 Jayce Forge；没有死亡、单位资源移除或奖励。双边 `sideResult` 仅允许 `isMutationSacrifice(strategy,id)` 明确认可的原始单位缺席，其余缺席仍报 `invalid-result`，献祭者不进入存活者与成长结算。新辅助函数只供已验证领域数据内部调用，无新增公共失败枚举或客户端参数。相关 Match 战斗恢复及双边结果使用已有 `invalid-result`／权威 replay 拒绝错误的计数、捐赠、增删字段或缺席。服务器无需增加规则或编排调用。
## Batch 5 G4 虚灵（P，2026-10-27）

`augment-pool-batch5-g4.ts` 内部入口 `castB5Voidcaller(ctx,caster,spent,counters,pending):void` 只接成功施法实际扣蓝；冻结有效先知成员（含纹章，无需激活2档）共享每队池，每275扣除阈值、结转余数；每战累计成功出生最多5只，死亡不返名额，满格不召唤且该阈值已消费。`spawnB5Voidlings(ctx,state,pending):void` 在原演员规划动作后发布既有unitSpawned事件，新生儿下一tick行动。生命2–6+为400/450/500/550/600，AD60、AS0.8、双抗30、近战无技能；不进入永久资源或卡池，不计玩家伤害。

`augment-pool-batch5-g4-swarm.ts / b5PortalEffects(state,itemId,effects):readonly Effect[]` 只给持有本强化的已装备、未被执法没收传送门编译开战声明；`startB5VoidSwarm(ctx,state):void` 在完整双方开战阵容就绪后按持有者前方最近空格生成，HP1000/1500/2000/2500/3000、AD80/80/115/150/180（2–6+），基础AS0.8／双抗30／射程1，无空格跳过。2格开战嘲讽为目标锁（最近召唤物、同距ID），目标失效即释放；`b5VoidSwarmTarget(unit,units,tick)` 供既有目标入口调用；不编造持续秒数。`b5VoidSwarmVamp(unit):VampRate[]` 通过原伤害／治疗管线给大小虚灵4000Bps全能吸血，AS额外4000Bps，小虚灵不继承大型数表／嘲讽，普通英雄不获这两项加成。无本强化的旧传送门继续原规则。

可选 `CombatState.voidcaller` 为每队 `{team,remainder,summoned}` 数组；`CombatUnit.voidSwarmTaunt?:string` 为开战锁定目标。可信strategy包含voidcaller／voidSwarm／b5VoidPortal时，恢复从可信开战输入完整重演到保存tick，比较全部单位、属性、计数、目标锁、事件序号及RNG；删除字段／虚构合法范围内数值／少一个出生同样拒绝，无该来源却添字段亦拒绝。没有新增战斗事件类型、tick长度或随机词；失败仍为既有恢复异常及规则入口失败语义。保存／协议纪元不重录；本任务末统一重算content／loot identities。
