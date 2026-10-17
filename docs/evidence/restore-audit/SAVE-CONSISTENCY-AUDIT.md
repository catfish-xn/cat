# 存档累计状态一致性审查

## 0. 版本、边界与读法

- 审查分支：`codex/save-consistency-audit`。
- 固定受审生产源码：`0c922c4c82c573243e9534e3b2e01de7aab22422`（本轮实际取得的 `origin/multiplayer`）。后续审计提交仅加入文档及复现测试，不改变生产源码。
- 入口：`restoreMatch` / `serializeMatch`，沿 `serialization.ts`、`m8/restore.ts`、`m8/item-restore.ts`、`b8-restore.ts`、`g2-3-match-progress.ts`、`g2-3-state.ts` 及其实际调用的验证器（本基线没有独立的 `g2-3-restore.ts` 文件）检查。文件行号均相对上述固定源码。
- 本轮不修改 `src/`、规则、数值、版本、digest、夹具、门禁或超时；不跑全套。
- 已在修事项只作排除登记：护臂计层（#158/#164）、冠冕金币（#157）、`resistsBps`（#159）、奖励 atom 键序/锻造器领取重演/`g23:` 前缀（#161）、赛恩及莫甘娜 `g22Curse` 延迟任务绑定。本报告发现的普通盾吸收配平、其他技能延迟任务、历史 G23 事实并非把这些已知问题重复计入。
- “可信”指已通过独立验证的开战输入、资源前缀或从它们执行得到的结算事实；同一存档中两个能一起改的字段、收据、事件列表互相吻合，不自动成为独立证据。
- 计数单位是具有同一写入及恢复规则的“语义字段族”。每族列明字段路径；不把动态 Map 的每个键、每一收据或每个单位算成新项目。跨轮 G23 衍生族与通用资源谱系分别计入，但通用收据只计一次。
- 本报告是指定入口的有界源码清点和针对性复现，未形式化证明已穷尽所有嵌套字段/运行路径；“已有校验”不等同该族已获完整安全签收。未复现项明确标静态风险，不冒称已证明利用。

## 1. 证据解释

复现测试先由公开命令构造合法状态并验证生产序列化→恢复正控，再改保存输入。测试中预期当前错误接受的断言是“漏洞仍可复现”的观察，不能作为日后允许篡改的合同；修复时应保留正控并翻转负例为拒绝。

分配类复现使用安全小数量观测分配发生在认证之前，没有制造 OOM，也没有用本轮结果解释旧的退出 137。

相关测试均逐文件执行；同一源码上的测试构造调试记录保留，最终计数以各文件最后一次修正后的日志为准。公开命令正控不得偷换为注入运行态后再保存。


## 2. 总计与按严重程度排序的结论

**清点67组累计量及其关联状态；归并20类缺口：12类有完整存档入口实证，8类仅静态证据待复现。P1为9类，P2为11类。未发现并宣称P0。** 20是修复根因分类数，不是“67组中只有20组有风险”：同一缺口可以影响多个字段族，一个字段族也可以承接多个缺口。未单独编号的残余信任边界已在逐族表中写明。

可复核清点：战斗 C01–C24 共24组；G22/G2表8组（21个明确字段）；G23 G01–G18 共18组；Match M01–M17 共17组；24+8+18+17=67。G23 G19 `experimentCells` 是展示派生字段，不计累计组。G18是 `seatMechanics.receipts`，与M11的 `scheduleReceipts`、M06的资源条目是不同持久字段，不重复计同一字段。历史战斗事实在战斗内收集与跨轮消费是两个边界；MA4的历史胜负/掉落资格与 G23-HISTORY 合并为一类，不重复加计。

|严重度|编号|缺口|证据级别|影响与验证边界|
|---|---|---|---|---|
|P1|MA1|准备期金币/付费XP没有可信事务来源|实证|开局金+100000或免费4XP，双入口接受；未审线上导入权限|
|P1|G23-HISTORY（含MA4）|历史参与/结算facts自报再重演进度|实证+扩展静态|征服者、炼金、Rumble参与篡改接受；历史高赌徒获利、旧掉落资格等扩展未端到端实证|
|P1|G23-ALLOCATION|未认证reward描述符先展开atoms|实证|非法1000单位奖励先分配后拒绝；未测试OOM|
|P1|G-C01|旧延迟任务无真实技能/动作绑定|实证|非Maddie注入Maddie任务后续战实际增加伤害；排除g22Curse已知项|
|P1|G-C05|普通护盾剩余/已吸收可同步配平|实证|真实已吸收普通盾被补回1点；resistsBps=0，非#159重复|
|P1|P1-BOUNDS-01|G22曝光/破盾窗口无真实来源|实证|曝光伪造接受并改变续战HP；reave接受但消费收益未另测|
|P1|G-C06|吸收异常value作为自己的stat预期|静态待证|未跑合法异常长轨迹；不能称已获属性作弊|
|P1|G-C08|G23战斗内命中/击杀/高赌徒只局部自洽|静态待证|缺持有者归因/RNG历史；与跨轮HISTORY按不同入口区分|
|P1|MA3|历史Tristana成长只核单位与125步长|静态待证|历史sourceDeltas缺真实击杀重演；未完成完整篡改轨迹|
|P2|MA2|商店代数/随机游标无生成事实|实证|4流各+1、generation+100000接受；历史购卡伪造未实证|
|P2|MA2b|Match事件序号无事件权威|实证|nextMatchEventSeq+100000接受；不据此声称重复发奖|
|P2|G-C02|触发账本键域及发生事实未认证|实证|无触发器场景接受虚构processed/actionCounts键；实际抑制装备未测|
|P2|G-C03|基础攻击/施法计数仅上限和代数检查|实证|attackCount在0/1间改值接受；特定装备收益后果未测|
|P2|G-C04|伤害参与者及trigger事件序号漏验|实证|不存在actor/victim及9e8序号接受；助攻获利未测|
|P2|P2-BOUNDS-02|G2伤害累计只受固定大上界|实证|tick0三个累计字段分别写99999999接受；特定技能消费静态确认|
|P2|G23-JUNKER-BINDING|升级收据未绑定当时持有者与候选菜单|静态待证|unitId非空/价格正确不证明最强Rumble资格|
|P2|G23-ACADEMY-ELIGIBILITY|学院赠装没重建授予时羁绊资格|静态待证|收据source及阶次自洽不证明当时资格|
|P2|G-C07|周期余数/burn相位仅局部自洽|静态待证|普通periodic时相已有重建；缺口不泛化到全部周期任务|
|P2|G-C09|活动份额/时长未绑定真实技能事件|静态待证|未构造整档channel/redirect伪造|
|P2|BOUNDS-PREFLIGHT|跨单位声明可能在该单位认证前被读取|静态待证|调用顺序风险；没有构造短存档引起巨大分配或OOM|

实证12类 = 战斗5 + G22/G2 2 + G23 2 + Match 3；静态8类 = 战斗4 + G23 2 + Match成长1 + 跨单位preflight1。测试用例数与缺口类数不同：同一类会有双入口或多个字段向量。

所有接受结论仅指固定版本的本地存档恢复入口。未审查服务器权限、网络上传路径或攻击者能否控制线上存档，不能转换成“线上已可作弊”的结论。



## 战斗累计量与动态状态

#### 战斗侧分片（固定 0c922c4c82c573243e9534e3b2e01de7aab22422）

只读生产源码；新增 `tests/restore-audit/combat-accumulators.test.ts`，由主线程统一运行。以下按 **24 个语义字段组** 盘点，不把每个对象成员的 number 都算一个问题；也不把静态覆盖说成每种装备均已有动态验证。护臂 #158/#164、resistsBps #159、g22Curse task binding 已分工处理，不重复计新缺口。

##### 字段组清单

字段前缀 U = `MatchState.combat.units[]`，C = `MatchState.combat`。绑定说明分别检查持有者、装备/来源、已结算事实；“有结构约束”不代表已证明来源事实。

| 编号 | 全路径/成员 | 当前可信依据与绑定 | 数组/循环上界与自报条件 | 结论 |
|---|---|---|---|---|
| C01 | C.tick/maxTicks/status/result | serialization:234–240,289–290，tick≤1200、阵容灭绝及结算摘要一致 | tick先有界；结果依赖候选hp/alive，非完整重演 | 有界但存档事实自洽，单列战斗动态状态根源 ；**映射：部分覆盖：未独立认证终态** |
| C02 | C.rngState/rngDraws/nextActionSeq/nextEventSeq/nextTriggerEventSeq | serialization:234只校前四的种子/非负整数；nextTriggerEventSeq无相应校验 | rngDraws等不用于此处计数分配；未绑定实际随机/动作历史 | G-C04 ；**映射：G-C04（游标部分）** |
| C03 | C.damageContributors[victimId][] | combat-s13:313,342,448–450读该表决定助攻/征服者/Swain；serialization无绑定校验 | 自报任意ID/数组；普通输入长度遍历，无来自棋盘数量的关系校验 | G-C04 ；**映射：G-C04** |
| C04 | U.runtime.attackCount/castCount | serialization:333–334,358，非负且总和≤tick | tick有界；没有按攻击/施法事实重建 | G-C03 ；**映射：G-C03** |
| C05 | U.runtime.attackSpeedBps/rangeBonus | serialization:359–363，从C04与编译mechanics/tick导出 | 常数/时钟有界，仍继承C04信任问题 | G-C03 ；**映射：G-C03** |
| C06 | U.runtime.abilityPowerFlat/nextAttackMagic/nextAttackPhysical | serialization:364–383，周期AP来自tick；事件AP来自ledger；快照伤害是有限候选 | AP/AD候选逐轮去重；护臂来源计数提前界限并重演，已排除 | 一部分强绑定，一部分仅候选可达，不等于真实采样事实 ；**映射：部分覆盖；护臂已排除** |
| C07 | U.runtime.permanentAdBps/buddyTriggered | serialization:334–335,373,384，Tristana步长125且≤castCount×系数；buddy仅“有bulkyBuddies且伙伴已死” | 无计数分配；步长/上限不证明击杀/触发 | G-C03；Sion buddy另有已知修复范围 ；**映射：G-C03** |
| C08 | U.effectRuntime[].count/key | serialization:280–284，对编译trigger key一对一，count≤tick或开局≤1 | 来源绑定强，发生事实不重演，count可范围内漂移 | 与G-C02同类，静态 ；**映射：G-C02（静态扩展）** |
| C09 | U.triggerLedger.runtimes[].triggerCount/stacks/counters/consumedRewards/nextEligibleTick/consumed | m8/triggers:120–129 + item-restore:78–88：声明key、counter cap、maxPerCombat、ICD范围、rewardId | counter cap来自编译声明；无cap计数只safe integer；非护臂持有者不统一重演 | G-C02 ；**映射：G-C02** |
| C10 | U.triggerLedger.processed/actionCounts | m8/triggers:129仅各value integer；护臂重演校整ledger是例外 | key不解析；value无事件/动作界限；可自报key决定之后抑制 | G-C02 ；**映射：G-C02** |
| C11 | U.mechanismState.runtimes/unconsumedSurvivalKeys | item-restore:89–105，所有编译survival key恰一次分区，runtime triggerCount=1 | 数量受编译key集合约束；仍未重演阈值真实发生时间 | 防删消费记录强；历史阈值真实性静态待证 ；**映射：部分覆盖：消费分区已核，阈值事实未证** |
| C12 | U.maxHpBasis/base/flat/bps/bonusBps/maxHp | restore:25–28，基础编译来源 + experimentTakedowns.length×mundo；item-restore:106–118重算周期/阈值bonus | 周期来自≤1200tick和编译period；候选按周期/声明组合，已逐轮有限 | G-C08 的实验击杀事实继承；非简单完全可信 ；**映射：G-C08** |
| C13 | U.mechanismState.statuses[].contributions[]/effectiveMagnitudeBps/effectiveSourceKey；U.statuses | status:92–107重算汇总；restore:32–95来源/镜像；item-restore:48–64读ledger计数或g23Absorb值 | contribution数组来自输入；累计量可只是总量=计数×系数；cap与triggerCount/采样tick约束 | G-C06；status摘要自洽≠授予事实 ；**映射：G-C06 / BOUNDS-PREFLIGHT** |
| C14 | U.mechanismState.periodicTasks[].pulseOrdinal/nextPulseAtTick/remainders | restore:98–113编译任务全等（忽略动态phase），普通periodic pulseOrdinal从tick重建；burn来自活跃status | 普通ordinal不驱动无界分配；remainder只0<n<denom及target存在，未重演精确余数 | G-C07，静态；普通时相绑定较强 ；**映射：G-C07** |
| C15 | U.shieldLayers[].granted/remaining/absorbed/m8State.decayed/expiredDiscarded/decay；U.shield | shield:49–59守恒；restore:130–195来源/声明/数值候选/生命周期；serialization:400–410聚合 | 不按granted分配；一般仅守恒与候选，resists专项排除 | G-C05普通护盾配平 ；**映射：G-C05；resists专项排除** |
| C16 | U.shieldLayers[].endRewardConsumed/endedReason；U.tasks[].shieldEndKey | restore:188–195，已结束护盾的待消费任务一一匹配 | 来源/生命周期绑定，但源护盾吸收事实仍继承C15 | 部分强一致，不单列新问题 ；**映射：部分覆盖：继承G-C05** |
| C17 | U.tasks[].amount/ordinal/total/actionSeq/executeAtTick/source/targetId | serialization:426–460基本数值/目标/来源检查；g2*按字符串分支进一步绑定 | amount≤1e8,execute≤2401；total只≥1，ordinal<total；旧任务无技能kind绑定 | G-C01动态复现；g22Curse排除 ；**映射：G-C01；g22Curse排除** |
| C18 | U.mechanismState.activities[].actionSeq/startsAtTick/expiresAtTick/lifecycle/shareBps/endedAtTick | restore:198–213，来源为本体ability、identity、active镜像和结束原因 | actionSeq<候选nextActionSeq；channel仅固定blocks、redirect份额0..1e4，未核具体技能/时长 | G-C09静态待证 ；**映射：G-C09** |
| C19 | U.g23.cuts/stationaryTicks/lastCell | g2-3-combat:59,63–66，cuts目标存在/总和≤runtime.attackCount且有anomaly；stationary≤tick且有鹰眼 | cuts无按count分配；来源有绑定，命中/移动历史不重建 | G-C08 ；**映射：G-C08** |
| C20 | U.g23.absorbed[].unitId/tick/value | g2-3-combat:67–69，同队死者唯一、时间、异常来源、value≤1e6；item-restore:52又把其value当status预期 | 数组按死队友唯一≤阵容；但value没来自死者当时AD/AP | G-C06，静态双写风险 ；**映射：G-C06** |
| C21 | U.g23.highRoller[].actionSeq/spell/mod/enhanced/gold | g2-3-combat:70–71，Sevika owner、length≤castCount、actionSeq唯一、mod合法、gold由mod决定 | castCount≤tick；未按战斗seed/RNG轨迹重演roll | G-C08，涉及金币，历史结算联动另见主报告 ；**映射：G-C08** |
| C22 | U.g23.ascension.{untilTick,nextPulseTick,actionSeq,takedowns} / conquestTakedowns / experimentTakedowns | g2-3-combat:60–62，英雄/羁绊来源、死敌唯一、tick/actionSeq范围；未绑定actor贡献或发生时刻 | takedowns受敌人集合上界，时钟≤10000；可依据“已死”虚构“由我击杀/助攻” | G-C08；历史征服者另组 ；**映射：G-C08** |
| C23 | C.openingState/plans/committed；C.companionState.bindings/reactions；C.neutralReceipts | neutral-restore:34–136从可信原始阵容重建开局计划、冻结绑定；reaction绑死者receipt，完整性检查 | 受静态neutral/成员数、maxReactions约束；死亡时间仍由候选receipt+alive核自洽 | 静态检查较强；未做联合伪造，不宣称全安全 ；**映射：部分覆盖：结构强、未做联合伪造** |
| C24 | G23 summons（U.definitionId/form等、Forge/Sion alive及内部状态） | serialization:244–265 projectG23Summons(已验开战basis)精确阵容/身份、编译属性；combat-g2-3-summons:6–33状态驱动解绑/复活 | 召唤阵容重编译，棋盘有限；Forge复活/死亡历史非整场重演；Sion修复排除 | 输入绑定强，动态历史真实性待证 ；**映射：部分覆盖：身份编译强、动态历史未证** |
G22 exposure/reave/expansion累计已由主报告现有 `bounds-g22-state.test.ts` 覆盖，不重复计本表24组。

##### 缺口（类别共9类；与主报告合并时按根因归并、不要直接相加）

**G-C01 P1：旧延迟任务 kind 与真实技能及结算事实未绑定。**
- 文件：`src/simulation/serialization.ts:426–460`，特别434行仅对`kind.startsWith('g2')`进一步校验。
- 现状：只需真实合法ability source和当前存在target，即可给非Maddie英雄加入任意`maddie`任务，amount上限虽1e8但并非真实伤害上限；task.key不要求是派发器生成的规范身份。
- 最小复现：combat-accumulators 第1项，公开battle()正控，给玩家非Maddie加executeTick1/amount1000000任务；对象与JSON恢复接受；stepMatch后敌人HP低于不篡改正控。主线程已确认通过。
- 建议：从已验开战输入重放到当前tick比对延迟队列；若做规则专用核验，须逐kind绑定owner技能/装备实例、原始cast/action、合法ordinal/total、目标与采样amount，不能只把字符串前缀扩成更多if。不得信任候选task.kind决定是否验证其声明。

**G-C02 P2：普通触发账本只验证格式/局部cap，不核事件事实；processed/actionCounts连key域都没核。**
- 文件：`m8/triggers.ts:120–129`、`m8/item-restore.ts:78–88`、`m8/sampled-stat-facts.ts:19–21`。
- 复现：无装备触发器的公开battle写processed['invented-event']=900000000、actionCounts['invented-action']=900000000，双方恢复接受。已确认；尚未展示某个实际装备因篡改抑制触发的续战影响。
- 影响：该例证明额外不可信历史键存活；真正声明键也仅integer，可能提前用掉触发次数/阈值。不能将“可能抑制”写成已动态证明。
- 建议：对所有已编译声明建立完整允许key域；key含combat/source/instance/actor/action/event；counter和processed从真实事实生成，不能互相自证。保留护臂精确重演作为已有正面实践，不重复修改其范围。

**G-C03 P2：基础攻击/施法计数及其派生值只核上限和代数关系。**
- 文件：`serialization.ts:333–384`、effectRuntime:280–284。
- 复现：公开battle走1tick，玩家attackCount在0/1间改为另一值，其余不变；对象/JSON恢复均接受。主线程已确认；本例未展示装备成长后果。
- 影响：rageblade/Kog速度/射程，Tristana增长上限及G23 cuts/highRoller数量沿用自报attack/cast计数；自洽关系不能证明动作发生。
- 建议：可信输入重演动作计数和获得永久成长的真实伤害/击杀事实；不能仅给攻击计数加更小固定上限。

**G-C04 P2：助攻参与者表与nextTriggerEventSeq不在恢复校验中。**
- 文件：`serialization.ts:234–255`；消费端`combat-s13.ts:149,313,342,448–450`。
- 复现测试第4项写不存在的victim/holder及9e8序号，主线程最终5/5已通过，确实接受；未展示真实助攻收益作弊，严禁写成已实现金币绕过。
- 建议：ID必须来自可信双方阵容、来源方合法且目标敌对，参与记录来自真实伤害结算；trigger序号与重演一致。空表/不带字段也不能作为跳过检查条件。

**G-C05 P1已实证：普通护盾剩余/吸收账本配平缺少伤害事实。**
- 文件：`m8/shield.ts:49–59`、`m8/restore.ts:130–195`、`serialization.ts:400–410`。
- 正控必须为公开battle真实产生并吸收部分伤害的普通护盾（resistsBps=0），同步remaining+1/absorbed-1、m8镜像和总盾；新增测试第5项已由主线程确认通过，合法正控及双入口均接受，恢复后护盾凭空增加1。独立于#159“授盾初值来自抗性”的修复。
- 现状：守恒式只能保证账平，不能证明已吸收多少伤害；已确认凭空补回1盾；潜在后续伤害/护盾结束奖励影响尚未独立继续到终局。
- 建议：恢复按真实伤害/衰减/到期/替换事实重建完整盾层账户；初次granted可信仍不足。

**G-C06 P1静态待证：吸收异常金额作为自身派生stat的验证依据。**
- 文件：`g2-3-combat.ts:67–69`、`m8/item-restore.ts:48–64`、生成端`g2-3-combat.ts:39–44`。
- 现状：实际规则value=floor(死队友AD×9%或AP×5%)；恢复只校value≤1e6、dead ally、tick，再statusDeclaration直接读候选absorbed.value作为预期。没有用死者被吸收时的可信属性重建金额。
- 待证最小向量：合法异常公开路径→队友死亡→拿到absorbed记录，联合调value和对应status legacy/canonical投影；必须先获合法正控，不能凭借裸helper接受宣称整档绕过。本轮未写该长轨迹。
- 建议：由可信输入重演到该死亡/吸收时刻，以真实死者历史属性核value，逐个owner/source/吸收对象/时间绑定；不能用候选队友当前数值替代历史采样。

**G-C07 P2静态待证：周期余数和burn时钟仅局部自洽。**
- 文件：`m8/periodic.ts:40–52`、`m8/restore.ts:98–110`、`m8/status.ts:105–106`。
- 普通periodic phase由tick/声明推导，良好；但remainders只分子分母正整数、分子<分母、有效对象，未由真实各pulse结算重建；burn nextPulse仅未来且与status镜像一致。
- 建议：用真实pulse时刻、目标、采样amount及已结算分数重建精确余数；burn由施加/刷新事件确定相位。未动态证明，不称已绕过。

**G-C08 P1静态待证：G23战斗累计事实可由死敌/动作上限自洽，缺归因或RNG证明。**
- 文件：`g2-3-combat.ts:59–71`、`m8/restore.ts:25–28`。
- cuts：count≤自报attackCount，但不是该目标实际正伤害；stationaryTicks≤tick+合法坐标，不是实际移动史；ascension至多10,000tick但不核施法/每次参与击杀延期；experiment/conquest只要求死敌存在/去重/具备技能，不要求由holder杀/助攻；Sevika highRoller gold=mod币值，不证明roll/施法发生。
- 风险：Mundo maxHp直接依experimentTakedowns.length编译，增长和列表可一起配平；Sevika mod改成coin+gold3的局部记录合法性不是随机事实证明，历史结算是否另拦由主报告检查。
- 建议：各类事实统一从已验输入+显式RNG重演提取；绑定actor/被击杀单位/技能或装备实例、事件序号与root action，不能只把名单绑定到“死了的人”。不重复历史征服者主报告向量。

**G-C09 P2静态待证：活动累计时间/份额只核通用声明。**
- 文件：`m8/restore.ts:198–213`。
- channel固定blocks但未核owner真实技能有channel与应有时长；redirect份额仅0..10000。activity与legacy状态一起配平时可能虚构活动。
- 建议：由真实施法记录和编译技能冻结声明比对activity种类、时长、redirect份额及生命周期；未动态证明。

##### 分配前上界专项结论
- `serialization.ts:234`先把combat.tick限制1200，`item-restore.ts:107–112,125–128`按编译period/tick生成的历史候选有限，不是直接信任存档triggerCount分配。
- `item-restore.ts:168–185,207–212`护臂kill/assist count已做实际board/tick上界与动作账本检查，外层sampled-stat-facts从可信basis重演；属于排除已有修复。
- `item-restore.ts:219–220`按counter cap枚举，cap来自重新编译声明，不取候选counter数值。候选逐轮(fixed,flat,bps)去重已有实现。
- 不能笼统报告“所有数组安全”：输入本身包含的statuses/tasks/ledger maps/contributions数组无统一来源数量上限，合法性遍历和多层find成本仍可随输入长度增长；但本轮没有构造内存DoS，不把一般大输入成本当已复现分配漏洞。
- `m8/periodic.ts:26–27 splitTotal(total,count)`导出helper本身只integer检查count，无特定战斗界限；当前恢复入口未发现从候选task.total直接调用它，不能以裸helper风险声称restoreMatch可被巨量分配。

##### 实际运行结果
主线程最终 `combat-accumulators.test.ts` 5/5通过，峰值RSS282596KiB；其中前3项旧运行3/3不重复计数。5项是“安全缺口接受”的characterization测试，不是安全验收通过。9类缺口中G-C01至G-C05共5类已有整档公开正控篡改实证；G-C06至G-C09共4类静态待证。C01/C06/C11/C23/C24仍有额外事实真实性边界，未另编缺口编号。24组只覆盖本分片战斗侧，主报告另含经济/历史/奖励等组。


## G22 / G2 累计量与分配前界限

### 存档累计量审计补充：G22 / G2 与分配边界

受审源码：0c922c4c82c573243e9534e3b2e01de7aab22422。只新增 tests/restore-audit/bounds-g22-state.test.ts，没有改 src。

#### 实证结论（root 串行执行）

命令：`npx vitest run --project fast tests/restore-audit/bounds-g22-state.test.ts`（最终精确命令以 root 日志为准）。初轮日志 `logs/bounds.log`：5/5，2.63s，峰值 RSS 287544 KiB；仅修复测试readonly赋值写法后的最终 `logs/bounds-final.log`：5/5，2.36s，RSS279568KiB，计数只取最终一轮。

合法正控由 `tests/match-helpers.ts` 的 battle() 创建：createMatch→公开选择→公开部署→startMatchCombat，未注入英雄/装备/属性。每例先 serializeMatch→restoreMatch 完整相等；再只修改保存对象，并测试对象及 JSON 两入口。测试描述的是现有错误接受行为，不能移作正式安全验收的允许规则。

##### P1-BOUNDS-01：无来源 G22 debuff 可凭自报窗口进入恢复并改变续战

- 文件：`src/simulation/serialization.ts:334–342`，执行消费 `combat-s13.ts:99`、`combat-s13-state.ts:139`，正常写入 `combat-g2-2.ts:33,75–76`。
- 现状：g22存在即只查字段类型、时间范围、bps≤10000；reave/exposure 未绑定真实施法者、来源技能、目标和已结算事件。
- 实测：合法tick0玩家单位凭空加入 exposureFromTick=0、exposureUntilTick=81、exposureBps=10000；两入口均接受，续算至81tick玩家HP与原合法续战确实不同。另加入 reaveUntilTick=200、reaveBps=10000 同样接受（该例未证明原合法路线后续实际授盾，影响由消费代码静态确认）。无需同步篡改其它收据、无需已有Kog/Vex等技能。
- 后果：伪造受到伤害放大/抑制后续护盾；也可能清空现有 debuff字段躲避效果。后者尚未单独运行，不写成实证。
- 修法：从已核实开战依据重演这些技能事件，或以可信回放核对逐目标状态生命周期；用权威source/action/target/开始结束tick核对当前projection。不能仅将数值上界缩小，也不能只补一个“场上有这种英雄”的检查。

##### P2-BOUNDS-02：G2伤害累计只受常数上界约束，可在tick0注入99999999

- 文件：`serialization.ts:344–356`；记账 `combat-g2.ts:184–198`；消费 `combat-g2.ts:41`（辛吉德选择伤害最高友军）、`:175`（野火累计承伤回血）、`:197`（自动机械累计伤害爆发）。
- 实测：分别给合法tick0玩家单位 expansion.damageDealt、damageTaken、crystalDamage 写99999999，其他字段为真实初始 EMPTY_EXPANSION；三例对象/JSON均接受。原状态无任何伤害事实。
- 当前测试证明累计量接受伪造；未声称这三例的初始单英雄局已经触发上述三种特定技能收益。机制消费影响为源码可确定的数据依赖。
- 后果：带对应技能/羁绊的战斗可从被伪造的累计量继续目标选择/回血/爆发；100000000上界是数值安全限，不是历史事实认证。
- 修法：从开战输入重放伤害包→实际HP损失/护盾吸收→按机制窗口折算，核对各单位累计值与窗口清零。damageDealt包含吸收，damageTaken仅HP，crystalDamage排除automata来源，顺序不能混用。

#### 字段清单（21 个字段，按8个审计族归并；给总报告去重）

|族|字段|权威来源/现有验证|持有者/来源/结算绑定|边界与结论|
|---|---|---|---|---|
|G22初始化|g22.initialized|布尔；应来自enforcer开战执行|未检查是否应初始化、是否曾执行|无分配；静态缺口，仅布尔；**映射：部分覆盖：仅布尔，未复现** |
|G22叛逆|g22.rebelTriggered|布尔且需要rebel机制，参与maxHP bonus推导|有机制资格，无团队失血触发事实重演|无分配；静态，未复现；**映射：部分覆盖：触发事实静态未证** |
|G22通缉|g22.wanted、wantedDeaths|列表唯一、敌方ID、长度≤编译wanted；deaths≤列表长度|未重算开战按maxHP/ID排序的通缉名单，也未与名单实际死亡数逐项核对|列表上限可信（自身mechanics先验证）；缺事实绑定，静态；**映射：部分覆盖：名单及死亡事实静态未证** |
|G22技能窗口|mordeUntilTick、reaveUntilTick、reaveBps、exposureFromTick、exposureUntilTick、exposureBps|整数；窗口≤tick+200/81；bps≤10000；morde要求英雄为铁男|reave/exposure无施法来源；morde也无真实施法时点|无按这些值分配数组；reave/exposure已实证，morde静态；**映射：P1-BOUNDS-01；morde静态未证** |
|G2伤害累计|expansion.damageDealt、damageTaken、crystalDamage|整数≤100000000|无已结算伤害事实绑定|无直接数组分配；3字段已实证；**映射：P2-BOUNDS-02** |
|G2水晶计数|expansion.crystals|整数≤100000000且小于编译automata crystals或1|有机制上限，无符合资格的伤害次数验证|无直接分配；静态；**映射：部分覆盖：与P2-BOUNDS-02同类但本字段未复现** |
|G2技能/被动窗口|attacksRemaining、buffUntilTick、lastRetaliationTick|attacksRemaining≤英雄技能上限；buff/retaliation英雄资格与tick界|未重演技能启动、消费攻击次数、反击事实|无直接分配；静态；**映射：部分覆盖：技能消费事实静态未证** |
|G2锁链|chainUntilTick、chainTargets、chainCastSeq、chainKills|窗口≤tick+100；名单唯一敌人且≤技能目标数；kills≤targets长度；非妖姬seq/kills须0|seq未核对真实施法；名单/击杀只局部自洽|无直接分配；静态；**映射：部分覆盖：施法与击杀事实静态未证** |
8族字段数为1+1+2+6+3+1+3+4=21：G22共10、Expansion共11。

#### 分配前边界检查

1. `serialization.ts:234,363`：combat.tick先验证≤maxTicks=1200，再执行 Array.from(tick+1)，完整restore路径有可信时间上界。
2. `serialization.ts:260–267,365–371`：Archangel periodTicks来自与expectedStrategy严格相等的mechanics；tick≤1200；本单位完整入口不会由伪造period0制造死循环。导出的底层帮助函数不能等同完整存档入口。
3. `m8/item-restore.ts:106–112,124–127`：HP历史pulse候选来自compileMechanismDefinitions的period/ends与combat tick，不直接按保存pulseOrdinal分配；正常本单位前置已编译身份。maxHpCandidates每轮用Set去重；仍为有限组合，未测到可利用大计数分配。
4. `item-restore.ts:218–220`：counter候选cap来自编译事件定义，缺cap拒绝，不取存档自报counter作为数组长度。`212`护臂新增事实界校验属#158已处理，本轮不重做。
5. `m8/periodic.ts:26–27` splitTotal自身只校验count整数，没有领域上界。但它是执行助手，未发现本次完整恢复调用图直接把未经认证存档count送到此处分配；不得据此宣称可复现存档OOM。
6. 解析/遍历输入数组仍按输入长度占用内存；当前未找到统一存档字节/列表容量上限。但线性处理本来已经存在的巨大JSON与“短存档计数触发巨大分配”不是同一缺口，本报告不混报。

#### 待验证：跨单位恢复顺序会提前读取未验证声明

`serialization.ts:258–276`对unit逐个核对 frozen mechanics/itemPrograms 后立即调用validateMechanisms。`m8/restore.ts:37` 经 isDeclaredStatus→declaredEffects 使用 contribution.source.ownerId 指向别的unit；若该owner排在后面，其 frozen声明尚未走到自身的 :260校验。`item-restore.ts:41`的enforcer wanted循环、compileMechanismDefinitions内部构造可因此先消费自报mechanics；随后拒绝不等于分配前拒绝。

这是静态调用顺序风险，尚未构造通过前置合法状态/状态贡献的完整短存档复现，也未运行巨大数值/OOM。建议先对所有combat.units的冻结身份/声明做只读全量preflight，之后再进行跨单位状态校验；或跨单位查找一律使用expectedStrategy中的可信声明。需专项安全小值访问/调用计数探针确认，不应该为审计制造OOM。

#### 排除重复项

护臂158/164、冠冕157、resists159、forge/atom键序/g23前缀161、Sion/Morgana g22Curse任务机制绑定均按派单排除；本补充未修或重复执行这些问题。


## 跨轮 G23 进度、经济与奖励

### G23 存档累计状态审查分报告

固定源码：0c922c4c82c573243e9534e3b2e01de7aab22422。只新增测试，不改 src。测试由根协调者串行执行，最终结果以其日志为准。

#### 结论与缺口

##### G23-HISTORY，P1：历史战斗 facts 是自报输入，重演经济仍然是循环自证

- src/simulation/b8-restore.ts:169–177：当前单人终局会与当前 combat 比较，跨轮后 combat 清空，历史记录只核 roundKind/result/battleId；并未从已验证的历史战斗输入重建 conquerorTier、conquestTakedowns、chemBaronTier、alliedDeaths、rumbleStar、highRollerGold。
- src/simulation/g2-3-match-progress.ts:38–41、68–83：把这些未独立验证的 facts 喂给 advanceG23Economy，得到 progression 后与存档比较；只能发现没有一起改完的数字。
- src/simulation/g2-3-economy.ts:18–20 的界限只证明形状与范围，conquestTakedowns 只需30个以内非空唯一字符串，未绑定真实敌人/参与击杀者。
- 直接影响：征服者层数/开启宝箱数/成长倍率和永久光明转换；炼金 shimmer、连败收益条件、黑市窗口、随机流及放弃奖励成长；兰博参战轮数、升级商店资格；赛维卡高赌徒金币来源。
- 实证测试 tests/restore-audit/g23-history-facts.test.ts：真实 createMatch42→startMatchCombat→stepMatch 至结算→真实 selectChoice（若有）→nextRound，到第2轮准备期。先生产序列化/恢复正控，再分别改历史征服者参与及不存在受害者、炼金参与、Rumble参与，重新配平progress，检查 object/JSON 都接受。测试不手改运行态建立正控，不使用伪造公共结算receipt作为正控。
- 历史highRollerGold及最终宝箱/黑市货物领取的端到端获利尚未在本测试证明，作为受同一根因影响的代码路径；不要把三项计数通过写成所有收益已独立实证。
- 建议：恢复每场已结算战斗应有受验证的开战资源前缀与战斗重演终态，调用 g23BattleFacts 得到权威事实再比较；多人也不能把同一存档内 multiplayer.g23Facts 当独立证据。缺完整历史证据的旧档按明确政策拒绝/隔离，不依赖自报 ID 前缀决定是否验证。验证完整性要求每个应结算战斗恰一条facts，不只遍历现有条目。

##### G23-ALLOCATION，P1：奖励描述符在认证来源前展开，未验证数量直接决定循环/内存

- src/simulation/g2-3-state.ts:19 立即将存档 rewards 映射为 g23RewardAtoms；b8-restore.ts:162 的 readG23Progress 甚至早于169的 validateG23Progress。
- src/simulation/g2-3-rewards.ts:38–50 读 reward描述符；ThreeCostUnit/FourCostUnit/FiveCostUnit 直接以存档数值循环 add；没有循环前的来源重算或数量上界。普通 safe integer 检查无法限制规模。
- g23RewardAtoms还先 canonicalContent，最后缓存完整生成数组（最多128个键，非总字节界），最终restore拒绝不撤销已分配成本。
- 最小安全复现 tests/restore-audit/g23-reward-allocation.test.ts：真实createMatch正控，在存档塞入未赢得的reward:{ThreeCostUnit:1000}；spy仅观察真实函数返回长度，restore最终拒绝但已构造1000atoms。没有测试巨量致OOM，不能报告已经造成进程被杀。
- 建议先对bundle identity/tier/source关联已验证战斗事实，并用冻结奖励表重新生成reward，拒绝不相等后才展开。数量以受信冻结条目上界，不能使用MAX_SAFE_INTEGER或截断合法值。

##### G23-JUNKER-BINDING，P2 静态缺口，未完成端到端篡改实证

- g2-3-match-progress.ts:42–51 校验升级次数/ID/价格/重复升级，但unitId仅非空字符串；g2-3-state.ts:67回链choice receipt没有unitId字段核对。
- g2-3-junker.ts:11、21 发放时选最强Rumble；23–29应用时仅按receipt.unitId分配成长与机制。历史持有者身份、当时最强选择、3星才能选titan、当时实际菜单候选未在恢复中重建。
- 建议把升级结果绑定已验证的选择前资源前缀/单位实例与星级，按seed+已验证购买序号重建菜单。将收据中的unitId与此结果逐项比对。不能仅把unitId改为“当前存在Rumble”，因为升级/出售/消费可能改变当前阵容。

##### G23-ACADEMY-ELIGIBILITY，P2 静态缺口，未完成端到端篡改实证

- g2-3-match-progress.ts:24–29 正常发放由当时academy羁绊资格决定；59–64恢复只核3→4→5阶次、赞助物seed选择、itemId/轮次和唯一性。
- g2-3-state.ts:31–32按收据source==='academy'决定是否进入学院专项校验；收据与资源出生相互匹配仍不证明当时达到羁绊。
- 建议核验授予时的合法资源/部署快照及派生羁绊，记录并认证取得资格的时点；source字段不能自行决定跳过资格检验。注意与其他收据通用来源绑定审查合并，不重复计缺口。

#### 累计值清单（19组，供主报告去重编号）

|组|持久位置/累计内容|现有依据与绑定|分配前界/自报条件|评价|
|---|---|---|---|---|
|G01|hidden.progress.economyReceipts及battle facts|roundResults轮次/结果+当前terminal比较，历史无战斗重建|事实round<=100、victims<=30，但整个receipt数组未在canonical/prefix扫描前设上界|历史缺口；**映射：G23-HISTORY** |
|G02|conqueror.stacks|takedownIds.length×冻结tier倍率，从receipt累计|每facts<=30，tier枚举；fact本身自报|历史缺口；**映射：G23-HISTORY** |
|G03|conqueror.receipts stacksAdded/takedownIds/chestTiers|planG23Conquest重演，与输入收据相互配平|唯一battleId/受害者；独立validateG23Conquest无受害者总量上界|历史缺口；**映射：G23-HISTORY** |
|G04|conqueror.chestsOpened|按stacks对15档阈值计算|15档固定|受G02污染；**映射：G23-HISTORY** |
|G05|radiantConversion|chestsOpened===15，光明迁移来源取第15档receipt|布尔、冻结映射|受G02污染；**映射：G23-HISTORY** |
|G06|conqueror.rewards待领奖励bundle|advanceG23Economy从table按历史facts生成|认证前先g23RewardAtoms，数量循环未限|历史+分配缺口；**映射：G23-HISTORY / G23-ALLOCATION** |
|G07|rewardClaims copy/实际资源实例/金额|从通用receipt派生并对atom候选/copy序号/实例核对，资源谱系再核出生消费|copy<atom.quantity；认证前派生，受reward描述符影响|不能为伪造reward提供独立真实性；atom键序/forge问题按排除项；**映射：G23-HISTORY / G23-ALLOCATION；#161部分排除** |
|G08|alchemist.shimmer|冻结羁绊收益公式+历史facts累加|输入死亡<=30，tier枚举；无按shimmer分配数组|历史缺口；**映射：G23-HISTORY** |
|G09|alchemist.losses|历史roundKind/result重演|rounds顺序；不按计数分配|历史结果绑定但是否拥有羁绊不可信；**映射：G23-HISTORY** |
|G10|alchemist.skips|market take=false决策计数|offer存在、取走后清空；无原始选择独立证据|依赖历史offer/决定自报；影响HealthPerSkip；**映射：部分覆盖：G23-HISTORY继承，选择决定未另复现** |
|G11|alchemist.offeredThrough/offer(tier/optionId/round)|shimmer阈值+独立seed流重演|tier<=8，冻结池|历史缺口可污染窗口；**映射：G23-HISTORY** |
|G12|hidden.progress.rngState/rngDraws|createG23Progress(seed)+每blackmarket offer一次nextRandom|LCG明确；次数由自报参与facts触发|同seed重演只证自洽；**映射：G23-HISTORY** |
|G13|junkerKing.rounds|每rumbleStar>0历史battle+1|<=历史battle数但该facts自报|历史缺口；**映射：G23-HISTORY** |
|G14|junkerKing.purchases及spare/finish成长累计|每3参战轮允许一次，固定价格、升级唯一项；通用choice receipt核价格/round|长度<=floor(rounds/3)，但unitId只非空|持有者/菜单资格静态缺口；**映射：G23-JUNKER-BINDING** |
|G15|academy赞助列表/已授3/4/5阶item receipts|列表由seed重建；itemId唯一、阶次递进、定义匹配|最多3阶（序列约束），source='academy'专项入口|授予当时资格静态缺口；**映射：G23-ACADEMY-ELIGIBILITY** |
|G16|high-roller金币收据|expectedGold=facts.highRollerGold，与generic金收据amount/round/source配平|highRollerGold<=10000且3倍数|历史受害事实自报；获利未独立实证；**映射：G23-HISTORY（静态扩展）** |
|G17|conqueror-chest金币收据|冻结胸箱金币数+历史开启bundle关联|固定15档，source条件决定反向关联检查|历史开启事实不可信；**映射：G23-HISTORY** |
|G18|seatMechanics通用receipts|结构/唯一ID/当前轮次/资源出生消费，专项source条件|safe integers，未按收据数组长度设领域上界|通用来源由其他审计者合并检查；**映射：部分覆盖：来源专项见上；资源折叠见M06** |
|G19|experimentCells|正常每次updateG23Cells由seed+派生trait生成|不是累计值；保存后未见等值校验；实际有hidden.progress时战斗入口不依赖可见副本|展示衍生字段记录，不计累计缺口；**映射：不计累计组：展示派生** |
相关定位：g2-3-state.ts:40–43；g2-3-match-progress.ts:34–83；g2-3-economy.ts:16–54；g2-3-progress.ts:10–33；g2-3-junker.ts:9–29；strategy-g2-2.ts:34；seat-mechanics/state.ts:66–101。

#### 排除项
探索者护臂#158/#164、冠冕金币#157、resistsBps#159、atom键序/锻造器后结算重演和g23前缀#161、赛恩/莫甘娜curse任务绑定由其他工作处理，不重复审查。G23战斗内absorbed/cuts/highRoller/ascension由战斗子审计合并到主报告，避免双计。

#### 本轮执行证据

根协调者串行执行结果：g23-history-facts.test.ts 3/3通过，说明三类篡改都被当前object/JSON生产恢复接受；g23-reward-allocation.test.ts 1/1通过，说明未认证描述符先生成1000atoms后才被拒。日志分别 logs/g23-4.log、g23-allocation.log；GNU time峰值RSS 298468 / 250940 KiB。没有跑全套。

保留前三次测试准备失误：g23.log错误调用仅多人claim接口（multiplayer-required）；g23-2.log从错误模块导入enableMultiplayerSettlement；g23-3.log用了多人状态却送单人restore（正确拒绝multiplayer-state）。这三次均为测试准备错误，不是产品缺陷。最终改用与match-helpers一致的真实单人start/step/select/nextRound公开命令，未篡改正控运行态。

推荐主报告按两个已证实根因计数：P1历史facts权威缺失（三个被接受的下游计数）；P1未认证reward描述符先展开。另两项P2属于静态待证的来源/持有者绑定缺口，不与已实证通过混记。清单G19为非累计展示派生字段，故累计值组数18+1旁项。


## Match、资源谱系与通用账本

### Match/B8累计值审查分片
固定代码基线 0c922c4c82c573243e9534e3b2e01de7aab22422。只读 src；新增 tests/restore-audit/match-authority.test.ts，root实际运行8/8通过，RSS265904KiB，3.01s；日志logs/match.log。

#### 口径及边界
本分片将同一权威链的多个字段合为一组，共17组，不与G23专项或战斗item专项重复计组。这里的接受伪造指本地 restoreMatch 对输入的验证不足；未审查服务端导入权限，不能据此宣称线上可作弊。sourceDeltas、历史掉落及shop采购链的缺口为静态证据，未声称已完成全轨迹伪造。

|组|累计字段|可信依据/身份绑定|边界及自报分支|状态|
|---|---|---|---|---|
|M01|gold；历史goldBefore/goldAfter/income/interestBasis/incomeBreakdown|serialization.ts:194-209按存档goldBefore调用planCatalogRoundEconomy；229仅已结算当前gold核对last.goldAfter+saleGold+G23；准备期没有金币命令支出链|95仅非负safeInteger；未按gold分配数组|缺口MA1；**映射：MA1** |
|M02|level/xp；历史levelBefore/After/xpBefore/After/xpRequested/xpAwarded|serialization.ts:68-75,201,205,223保证规范化及XP差额为4倍数或等级封顶；无买经验命令/金币支出绑定|等级1..9与XP阈值界；没有计数大数组|缺口MA1；**映射：MA1** |
|M03|roundResults胜负/HP/survivingEnemyCount/playerDamage/streak|serialization.ts:194-212用目录、前轮HP、streak链重算；历史result和survivor数自身非重演战斗事实|round<=FINAL_ROUND且history长度精确；combatTicks<=1200；combatEventCount仅safeInteger|历史结算事实静态不足MA4；**映射：G23-HISTORY（合并MA4，静态扩展）** |
|M04|augmentProgress.pumpingRounds/investmentHp|serialization.ts:215-218按已拥有强化取得轮次及roundResults轮数/利息×8重算；combat-input.ts对应冻结编译|pumping有目录轮数上限；investment依赖M01历史利息；无计数分配|派生计算正确，上游历史真实性继承MA1/MA4；**映射：MA1 / G23-HISTORY上游继承** |
|M05|persistentGrowth.attackDamageBps、combat-growth-committed.sourceDeltas|resource-provenance.ts:432-460绑定原Tristana单位及125步长，迁移/销售守恒；b8-restore.ts:224-228只对当前战斗核actual runtime|prefix<=entries长度；safeInteger；历史sourceDeltas未绑定历史真实击杀，按数组自身遍历而非按增长值分配|静态缺口MA3；**映射：MA3** |
|M06|resourceProvenance.entries.sequence/nextSequence；消费合成/升星/出售事实|resource-provenance.ts:272-474按序号、roundId、出生收据、实例守恒折叠；合成配方、升星消费实例、出售价格核对|前缀受entries长度约束，单位/物品map按实际条目；无基于未核实累计值生成大数组|局部消费守恒强；shop和历史增长原始事实不足；**映射：部分覆盖：MA2 / MA3上游，消费守恒已核** |
|M07|nextUnitSerial/nextItemSerial及实例出生|b8-restore.ts:187-190将完整资源fold与当前units/items/growth/serial比较；resource-provenance.ts按出生依次分配|不是仅maxId；连续serial与消费保留；遍历真实账本长度|可信链完整性取决于M06来源；**映射：部分覆盖：M06上游继承** |
|M08|shop.generation/slots，历史shop采购generation/slotIndex/definitionId|serialization.ts:113-117仅generation>=1、5slot及已知英雄；resource-provenance.ts:328-335防同slot重复购、generation非减，但不重演商店随机及付款|slotIndex<shopSize，generation无实际刷新次数上限；不按generation分配|缺口MA2；**映射：MA2** |
|M09|rngState/choiceRngState/rewardRngState/battleSeedRngState|serialization.ts:94仅seed格式；当前存在combat时combat-input.ts:94-101按seed与目录推battleSeed并b8-restore.ts:206绑定当前cursor；准备期其余游标无重演|32位seed界；无按cursor分配|缺口MA2（准备期含battleSeed游标）；**映射：MA2** |
|M10|nextMatchEventSeq|serialization.ts:95仅非负safeInteger；没有保存完整Match命令事件账本可比|无实际事件数上界；无按seq分配|缺口MA2b；**映射：MA2b** |
|M11|scheduleReceipts/augments/anomalyBinding及choice rerollCount/generation|serialization.ts:127-153目录日程、eventId唯一、物品/金币数与definition映射；160-173校验generation=rerollCount+1与候选合法性；未重放choice RNG和reroll付款|augments<=3、offers3；历史日程轮次界；rerollCount非负整数|收据/选择结构自洽；随机及付费事实依赖MA1/MA2；**映射：MA1 / MA2（静态扩展）** |
|M12|frozen loot ledger rounds/rng/throughRoundOrdinal/layoutBinding|b8-restore.ts:70-77 restoreFrozenLootLedger按seed/目录/layout完整计划重演，dropId覆盖顺序等于冻结计划|轮次有FINAL_ROUND；有限规划目录；不是按存档随机计数直接生成|冻结计划重建链已在入口使用；**映射：未发现本轮新缺口：冻结计划有重演，非安全签收** |
|M13|loot earnedEvidence、direct/choiceEligibility进度|b8-restore.ts:79-91身份/死亡tick,eventSeq范围/同source唯一；117-127当前轮绑定neutralReceipts.deaths；旧轮只看result边界|死亡tick<=history.combatTicks；eventSeq<history.combatEventCount（后者只safeInteger）|静态缺口MA4：旧轮掉落资格真实性；**映射：G23-HISTORY（合并MA4，静态扩展）** |
|M14|loot.receipts、choiceResolutions、guaranteeCounters|b8-restore.ts:95-115冻结payload与候选/唯一receipt绑定；147-151计组件实际收据重算；232-338当前结算授予/升星/出售完整重演|slot coverage有限；fallback是否必须由phase等状态决定且有相应终局约束|当前链强；历史获奖资格继承M13；**映射：部分覆盖：继承M13，当前重演较强** |
|M15|combatInputBasis.provenancePrefixLength/equipmentRollPrefixLength/mechanicReceiptPrefixLength/nextSerial/battleSeed|b8-restore.ts:193-206原始prefix分别<=账本length；combat-input.ts:75-140由目录、资源fold、schedule/history及seed重新编译|prefix界实际数组长度；JSON同输入复用完整prefix仅当前调用；object及短prefix重新fold|相对经验证账本强；历史起始事实仍受MA3/MA4限制；**映射：部分覆盖：MA3 / G23-HISTORY上游继承** |
|M16|equipmentState.rolls/equipment RNG、temporaryEquipment|temporary-equipment.ts:50-71调用restoreEquipmentState及validateTemporaryEquipment，父装备/轮次/等级绑定；combat-input校冻结rollprefix|roll按实际条目；目录/父实例与三个槽位校验|详尽装备候选上界见item专项，本分片不重计；**映射：部分覆盖：装备roll身份核验，非全装备动态审查** |
|M17|consumables/nextConsumableSerial/reforgeState及consumable-used消耗|consumables.ts:97-132 grantreceipt连续serial，seedXor重演独立重铸RNG，每笔引用唯一consumable，output候选/affectedItems/target绑定；resource fold重放消耗|固定池候选；serial来自已授予实际条目；不是按未核实rng.draws分配|来源收据自身真实性继承G23/loot；局部消费/RNG链完整；**映射：部分覆盖：G23-HISTORY / M13上游继承** |
#### 缺口及建议

##### MA1 P1：准备期金币、付费XP无已结算事实/命令支出链
位置serialization.ts:94-95、68-75、201、223、229。准备期gold只非负整数；XP允许任意4点增量但不要求扣费。历史goldBefore被直接用作income计算输入，故“收入公式对”不证明余额有来源。
最小复现 tests/restore-audit/match-authority.test.ts前2项：合法createMatch(42)→serialize/restore正控，然后gold+100000或grantXp(level,xp,4)只写level/xp且gold不变，分别object/JSON恢复。已实际通过，证明上述两种篡改均被object/JSON入口接受。
建议：将buyXP/reroll/buy/sell及reward入账纳入可验证命令/经济事务账本，按seed开局与可信结算序列重演；不能只补一个gold范围常量。历史经济回放需消费同一套已验证奖励事实，禁止用伪造结果反证来源。

##### MA2 P2：商店/随机游标仅格式、未绑定生成事实
位置serialization.ts:94-95、113-117；resource-provenance.ts:328-335。准备期任意合法32位RNG游标、shop generation可通过现有格式约束（nextMatchEventSeq独立见MA2b）；历史商店采购仅槽位去重，并无该代商店真的生成此英雄和已付款的证明。
最小复现测试其中5项：createMatch正控后4个RNG各+1、generation+100000，检查object/JSON恢复；eventSeq另1项只计入MA2b。已实际通过；未构造历史购卡完整伪造，不能把单游标复现当作该链已实证。
建议：由seed及已验证命令序列重演对应独立随机流与商店代数。保留战斗seed已有目录重建。

##### MA2b P2：nextMatchEventSeq 缺独立事件计数权威
位置serialization.ts:95。独立于随机流/商店问题；下一事件序号仅safeInteger，通过测试eventSeq+100000也被接受。影响后续事件身份连续性，尚未演示重复奖励。建议从已验证完整命令事件历史计数派生，或将其明确限定为不参与安全校验的展示游标；不可借RNG重演声称该计数也已认证。

##### MA3 P1（静态未实证）：历史Tristana成长来源只核单位及步长
位置resource-provenance.ts:432-460，b8-restore.ts:224-228。历史commit sourceDeltas只验证拥有者Tristana、125倍数、次序及资源前缀，随后merge入persistentGrowth；当前战斗有runtime比对，但进入下一准备期combat=null后无历史combat重演。可协调修改历史sourceDeltas及现有persistentGrowth/后续basis获得自洽增长的路径值得独立复现；本轮没有宣称已绕过。
建议：仿照独立已验证开战basis+历史战斗结果重演每轮实际成长触发，锁定sourceUnitId及击杀事实，再迁移消费谱系；不以castCount上界或125倍数替代事实相等。

##### MA4 P1（静态未实证）：旧轮战斗结算/掉落获得事实边界自洽
位置serialization.ts:197-211，b8-restore.ts:79-91、117-127。历史胜负、幸存者数量用于派生HP、连胜、收入，但无历史开战输入重演；历史掉落earnedEvidence只在combatTicks/combatEventCount范围内。当前轮比neutral死亡收据，旧轮没有对应历史死亡记录认证。与G23征服者历史事实属于相同上游根因，应主报告合并风险，不重复计漏洞。
建议：历史battle records与每轮冻结basis按轮完整绑定，重建result/deaths/growth/coin触发；缺历史证据拒绝相关历史状态（旧档策略另需批准），并验证掉落sourceUnitId的真实死亡tick/eventSeq，避免仅比较可共同伪造的summary。

未发现本分片gold/XP等标量直接驱动Array.from大分配；输入本身的provenance/receipt数组仍需总大小预算，不能因此宣称整库无大分配风险，详见bounds专项。


## 运行证据及限制

最终新测文件：

|文件（tests/restore-audit/）|结果|GNU time墙钟|峰值RSS KiB|日志|
|---|---:|---:|---:|---|
|combat-accumulators.test.ts|5/5|2.65s|282596|[combat-final.log](logs/combat-final.log)|
|bounds-g22-state.test.ts|5/5|2.36s|279568|[bounds-final.log](logs/bounds-final.log)|
|g23-history-facts.test.ts|3/3|2.92s|298468|[g23-4.log](logs/g23-4.log)|
|g23-reward-allocation.test.ts|1/1|2.17s|250940|[g23-allocation.log](logs/g23-allocation.log)|
|match-authority.test.ts|8/8|3.01s|265904|[match.log](logs/match.log)|

合计5个文件、22项新测试；通过表示文中所述的当前行为可重复观察，不表示存档安全通过。

|相关旧测试文件|结果|GNU time墙钟|峰值RSS KiB|日志|
|---|---:|---:|---:|---|
|tests/m5-serialization.test.ts|33/33|2.93s|307284|[相关序列化](logs/related-m5-serialization.log)|
|tests/m8-b8-restore.test.ts|7/7|3.31s|358136|[相关B8恢复](logs/related-m8-b8-restore.log)|
|tests/g2-3-identity.test.ts|14/14|7.96s|552908|[相关G23身份](logs/related-g2-3-identity.log)|
|tests/g2-2-skills.test.ts|19/19|1.63s|237700|[相关G22技能](logs/related-g2-2-skills.log)|

相关旧测试4文件73项通过，合计9文件95项；不是全套。`npm run typecheck` 最终成功，见 [typecheck-final.log](logs/typecheck-final.log)。初轮typecheck暴露新测试对readonly字段的直接赋值，已仅在测试中改为篡改保存副本的Object.assign，再复测bounds5/5；保留 [typecheck.log](logs/typecheck.log) 与 [bounds.log](logs/bounds.log)。其余最终受测测试未因这项测试写法修正而变化。

G23前几轮未达预期准备阶段/测试构造的失败、combat前一轮结果均保留原始日志，最终只按表中测试计算一次，不把初轮失败隐藏、不重复累加通过数。没有全套结果或CI签收结论。

环境：Node 24.19.0 / npm 11.9.0。使用官方 Debian `time` 包提取的 GNU time（没有改系统工具或测试门槛）；日志内 Vitest 本地时钟可能与 UTC 相差两小时，统计使用持续时间，不用显示的起始钟点计算耗时。旧准备脚本错误及原始测试类型错误若出现，保留日志并与最后成功运行区分，不将其解释为生产实现通过或失败。

## 建议修复优先顺序（本轮不实施）

1. 先处理可直接改变经济/战斗结果的实证P1：MA1、G23-HISTORY、G-C01、G-C05、P1-BOUNDS-01；同时将G23-ALLOCATION的来源认证前置，避免拒绝前放大分配。
2. 随后统一动作、随机流、触发账本和参与者权威：MA2/MA2b、G-C02/03/04、P2-BOUNDS-02。不能只给每个标量补任意常数上限。
3. 对8类静态候选先建立真实公开路径正控，再做协调篡改复现；跨单位preflight与历史输入重演可作为共同修复基础，但具体实现需要单独开发与审查。本轮没有修改规则代码。

## 修复建议的共同原则

1. 先认证所有单位/装备/技能的冻结声明及资源前缀，再进行跨单位状态检查；不能因对方还未轮到验证而提前消费它的自报声明。
2. 事实来源优先是受认证开战输入与显式RNG的重演。最终HP、计数、收据、事件互相吻合只证明账内一致，不证明战斗真实发生。
3. 待领奖励必须先由可信来源重建冻结描述符，再展开为atoms；枚举上界来自棋盘、时钟、编译cap或冻结奖励表，不用MAX_SAFE_INTEGER，不截断合法计数。
4. 恢复验证必须按完整字段域和应发生的事实检查缺项与多项，不能让存档自报的source、kind、ID前缀、系数是否为0决定哪些校验被跳过。
5. 修复后保留每项公开合法正控、续战一致性，翻转对应篡改断言为拒绝；仍须按真实受测SHA另做相关回归。涉及旧档证据缺失的处理属于产品/合同决定，不能在本只读审计中擅自放宽或拒绝全部历史档。
