# M4 RULES — 规则、内容与确定性契约

状态：M4 v1 实施契约；实际门禁结果见 [M4_VALIDATION](docs/M4_VALIDATION.md)。基线与范围见 [PLAN P1–P3](M4_PLAN.md#p1-基线与实际仓库审查)，测试及交付门禁见 [ACCEPTANCE](M4_ACCEPTANCE.md)。本文是规则唯一来源；F1冻结语义，F3冻结数值及完整正常游玩路径。所有名称为原创/占位，不代表正式 S13。

## R1. 状态、版本与命令

沿用 Match 长期权威、Combat 隔离 snapshot、50ms tick、1200tick超时。初始100HP/10G/level3/XP0、五名owned单位、七个单位bench格、五个shop格；D=2G，F=4G换4XP，round income=5G、XP=2，星级与出售价格沿用 `docs/M3_RULES.md`。不增加利息、连胜连败、单位池或对手经济。

schema升为4，`rulesVersion=m4-v1`、`contentVersion=m4-slice-v1`；打包内容另有稳定canonical digest，MatchState顶层保存`contentDigest`，独立JSON save与replay header都携带它。新增字段的概念契约（确切 TS 类型见 src/simulation/strategy-types.ts）：

| 字段 | 权威数据及不变量 |
| --- | --- |
| `items[] / nextItemSerial` | Item实例 `{id,definitionId,location}`；location为inventory或`{unitId,slot:0..2}`；单一归属，不在Unit再存另一份权威equipment数组 |
| `augments[]` | `{definitionId,choiceId,acquiredRound}`，同definition不可重复；effects来自锁定content包 |
| `anomalyBinding` | null或`{definitionId,unitId,choiceId,boundRound}`；全Match至多一项；单位升星可迁移 |
| `rngState` | 保留shop stream uint32；初始seed和shop十词规则不变 |
| `choiceRngState/rewardRngState` | 独立uint32流，见R5；拒绝命令不改任何流 |
| `scheduleReceipts[]` | 已执行事件ID与奖励/选择结果，ID唯一；权威幂等账本，按round及事件序排序 |
| `pendingChoice` | 只存在于choice阶段：kind、choiceId、generation、offers、targetId、rerollCount、eventId、子状态 |
| `nextMatchEventSeq` | 接受事务的事件序号；拒绝无领域事件，也不消耗序号；命令日志的输入seq属于外部replay ledger |
| `combat` | 只含本战resolved数值、effects、provenance、runtime counters、eventSeq；不用Match引用或catalog查询 |

phase联合为 preparation / choice / combat / settlement / gameOver。choice时combat=null；settlement/gameOver仍持有finished combat。phase外无隐藏UI选择状态决定规则。准备期的trait preview与装备面板是纯派生结果，不作为权威重复存储。

保留现有buy/deploy/sell/D/F/Start/Continue入口；新增 `combineItems(aId,bId)`、`equipItem(itemId,unitId,slot)`、`selectChoice(choiceId,generation,definitionId)`、`selectAnomalyTarget(choiceId,generation,unitId)`、`rerollAnomaly(choiceId,generation)`。Anomaly确认复用selectChoice。价格/效果/配方不由UI传入；所有参数运行时校验。guard优先级：phase → token/参数形状 → ID/归属/候选 → 容量/资源 → 完整plan → 一次commit。非法内容属于启动/restore错误，不是可消费资源的命令失败。

所有拒绝返回原state引用、稳定reason、无事件；gold/XP/所有RNG/ID/generation/receipt/counters逐字段不变。接受命令只产生一个可观察的新状态；不存在先扣钱后发现不合法的路径。MatchSession不缓存规则结果，命令同步提交。

## R2. 回合与特殊事件时序

round仍单调递增；stage label仅为`1+floor((round-1)/3)`与`1+(round-1)%3`。保留绝对round结算伤害：win=0；loss=`2+2*floor((round-1)/3)+2*存活敌人数`；draw只有base。HP clamp到0后立即Game Over。

| 进入round | 自动奖励（每项有固定eventId） | 阻塞选择 |
| --- | --- | --- |
| 1 / 1-1 | inventory获得 blade、rod 各一件 | 无 |
| 2 / 1-2 | 无 | Augment三选一 #1 |
| 3 / 1-3 | 一个随机组件 | 无 |
| 4 / 2-1 | 一个随机组件 | 无 |
| 5 / 2-2 | 无 | Augment三选一 #2，排除已拥有 |
| 6 / 2-3 | 一个随机组件 | 无 |
| 7 / 3-1 | 固定+2G（供一次reroll）；若没有任何owned单位，公开保底招募一星sentinel到bench | Anomaly：先选单位，再三选一/可reroll |
| 8 / 3-2 | 一个随机组件 | 无 |
| 9 / 3-3 | 无 | 无 |
| 10及以后偶数round | 一个随机组件 | 无 |
| 其他 | 无 | 无 |

初始createMatch：构造M3起始roster与round1敌人 → 初始化三RNG → 初始shop → 执行round1奖励 → preparation。正常Continue单事务：验证settlement/expectedRound/history → round+1 → 替换敌方准备阵容 → 用当前level刷新shop → 按priority、eventId执行自动奖励 → 进入首个pending choice或preparation。固定顺序为shop→reward→choice；不同RNG不等于允许任意事件顺序。

schedule支持同round多个事件：自动grant priority10、Augment20、Anomaly30；同priority按ASCII eventId。当前选择完成写receipt，再处理下一未完成事件，队列空才回preparation。只存pending与receipts，后续队列由锁定schedule推导；不得在渲染中drain。未完成选择期间重复Continue全部拒绝。reward receipt保存实际物品实例ID/金币/保底单位ID，restore不重新发放。

终局结算仍由withCombat边界原子发5G/2XP/扣HP/写RoundResult一次；Continue不再发该结算奖励。HP0不进入新round，故不会发下一round奖励或弹新choice。空阵认输保留；R7空owned保底只解决强制选人软锁，不是通用免费招募，也不能通过卖完反复领取。同round幂等receipt保证仅一次。已有owned但全在bench可以直接选bench单位，之后再部署。

对手：保留R1–R9 M3模板作为初始基线；R10起保留三组轮转，额外以`enemyGrowth`普通statPercent modifier为所有敌人HP/AD加`1000*(round-9)`bps，封顶20000bps（即基础三倍），不修改移动/能力算法。此增长属于明确的敌人snapshot来源，不能混入玩家四类构筑。敌方同样按定义计算trait，M4不给敌方augment/anomaly/items。W4需实测早期难度，尤其新trait改变对手强度；若调整模板或倍率须在F3前同步改本文与oracle。有限内容不承诺每种打法必败；验收必须找到非空阵正常战斗到HP0的路线，不能人为写HP或跳结算。

## R3. Trait 计算边界

`deriveTraits(preparation,team)`只计本队board上的不同definitionId；bench不计、重复同名不计、星级不增加人数。单位可以同时贡献两个trait。每个trait取最高已达阈值；低tier不累加，表中高tier数值是完整替代。没有额外trait计数augment、纹章或动态改trait。

准备期每次成功命令后可纯派生预览，卖出/换bench立即反映。Start先验证阵容，再一次计算两队trait，解析items/augments/anomaly并构造独立CombatSnapshot。snapshot保存trait ID、count、distinct成员definition IDs、tier、目标unit IDs、resolved sources。战斗死亡不降tier，移动不重算，bench绑定/装备不进入Combat。下一场重新按新的准备阵容编译。所有`team`/`traitMembers`目标在此冻结；tick只读resolved effects。

给重复同名的上阵单位都施加已激活的成员效果，但计数只算一个definition。trait overlay在战斗显示冻结值，禁止显示准备数组推导出的“实时失效”。无modifier低层createCombat入口保留用于M3兼容测试；正式Match Start始终显式传入完整resolved strategy input，Combat不隐式读取当前Match。

## R4. 装备事务与单位生命周期

M4共5组件、15成装。组件和成装均可装备，均占一槽；每单位最多3件，同名成装可重复且各实例独立叠加。inventory逻辑无容量上限，UI分页，因此卖出和升星溢出不能被库存满阻塞。每件Item有全局单调实例ID；definitionId不是实例ID。

合成只允许preparation中两件不同ID、均在inventory的组件；无序配方对唯一。成功原子移除两实例、创建一件新成装到inventory、nextItemSerial+1、发`itemCombined`，不消耗G/RNG。不自动在单位身上合成、不允许成装再次合成。同ID两次、已装备组件、未知ID、成装作为材料全拒绝。这样drag装备与合成没有隐式双重含义。

装备只允许preparation、己方owned目标（board或bench）、inventory源、指定空slot0..2。目标满槽/占用slot拒绝，不自动替换；重复pointer提交同item只能成功一次。不提供自由拆卸、单位间转移或装备出售；UI明确提示“出售单位可返还，升星可转移；请在物品栏合成”。取消拖拽不消耗物品。装备不改变出售单位的基础返金。

升星沿用M3 survivor board(row,col,id)→bench(slot,id)→incoming排序，不为了装备或Anomaly改变身份。每次三合一：survivor原槽装备原位保留；consumed按unit ID排序、各自slot升序，将其装备依次填survivor最低空槽；其余移到inventory，稳定按item ID展示。不会自动合成两件装备。连锁升星每一步更新临时账本，最后统一提交buy扣G/shop/serial/roster/items/binding/events，final bench检查失败则所有临时迁移丢弃。

Anomaly在consumed单位则迁移到survivor；原survivor有绑定则保留。全Match至多一绑定，所以多个不同绑定合并是非法restore，不做静默覆盖。迁移保留definition/choice/boundRound，修改owner ID并发事件。单位出售原子返所有装备到inventory、移除单位、按M3价格返G；若绑定在它身上永久销毁，已完成Anomaly receipt保留，不退款、不再开choice。

守恒：除奖励新建和合成二换一，Item实例不凭空新增/消失；任何时刻每实例恰好一个location。升级/出售不改Item ID；合成消耗旧ID且不复用。Combat中的装备是深复制provenance，战斗不消耗或改写Match装备。

## R5. RNG 与 Augment

继续`lcg32-v1`与现有nextRandom。不使用Math.random。开局shop state=seed；choice state=`(seed ^ 0x9e3779b9) >>> 0`；reward state=`(seed ^ 0x85ebca6b) >>> 0`。这是固定domain初始化，不额外draw；schema/rules冻结常数。采用独立流的裁决理由：高频D不应改变下个构筑候选或装备掉落；并非需要更换RNG算法。Combat本轮无随机primitive。

| 操作 | shop流 | choice流 | reward流 |
| --- | --- | --- | --- |
| 初始shop / 成功D / 成功Continue新shop | 各10词，沿用先cost后definition | 0（除该Continue同时开choice） | 0（除该Continue有奖励） |
| 一次三选一生成（含成功选Anomaly目标后生成offers）/ 成功reroll | 0 | 恰好3词 | 0 |
| 一个随机组件奖励 | 0 | 0 | 恰好1词 |
| 固定奖励/确认候选/买卖/F/装备合成/升星/战斗/失败操作 | 0 | 0 | 0 |

抽取：eligible IDs按ASCII排序，partial Fisher–Yates三步，i=0..2，j=i+word%(N-i)，交换并取第i项；三词即使N=3也照常消耗。允许已知模偏，不作不定次数rejection sampling。奖励从按ID排序的5组件以word%5取一。结果及RNG后态写Match，不在render/restore重新生成。

Augment在R2/R5生成三张不同候选；排除已持有ID，其余8项无稀有度/单位条件。选择必须是当前choiceId/generation内的offered ID，免费、无reroll、不可跳过；确认后永久加入Match列表，依R2推进队列。它对以后每次战斗的己方上阵单位生效；不是只影响当时的单位。此切片全是Combat modifier，不引入经济modifier以控制primitive范围。

## R6. Anomaly

仅R7触发一次。进入`choice/anomalyTarget`先选一个己方owned单位，board或bench均可；不是敌方，不存在旧绑定。此阶段不生成offers、不draw。选人成功后target锁定，generation+1，生成三项，进入`choice/anomalyOffer`。不允许换单位或取消来免费刷选项。UI在确认选人前明确“本次锁定对象”。所有8项都适用于全部单位，避免候选不足。

每次reroll固定2G，无次数上限；验证phase、choiceId/generation、target存在、余额，然后排除上一页三个ID，从剩余5项再抽三项；之前更早见过的选项允许重现。不永久移除整个seen集合，保证不会耗尽。一次成功扣2G、draw3词、generation+1、rerollCount+1。余额不足无任何变化；D不映射成Anomaly reroll，使用专用按钮。免费确认任意当前选项即可结束，零G也不软锁。

确认绑定时永久写anomalyBinding与receipt；再处理下一个schedule事件。绑定跟随升级谱系，跨战斗重建同一effect，战内计数器每场归零。后续死亡只影响当战；下一战满HP/初始Mana恢复，绑定仍在。出售规则见R4。JSON restore应恢复当前offers/target/generation，不能重新锁目标或刷新候选。

## R7. 共用有限 Modifier / Effect 层

内容只可声明固定类型数据，无函数、eval、任意表达式、字符串脚本。每source记录`sourceKind/sourceDefinitionId/sourceInstanceId/ownerId/effectIndex`；effect key为这些字段的稳定组合。四类玩家source固定顺序：trait(0)→item(1)→augment(2)→anomaly(3)，在同一个owner内部随后按definitionId、instanceId、effectIndex ASCII/整数排序；跨owner遍历一律先owner ID，再这个source key，包括combatStart。snapshot来源清单同样使用owner-first规范顺序。enemyGrowth另为独立系统source。stat加法本可交换，但仍排序用于一致的provenance。

| Primitive | 字段 / 限制 |
| --- | --- |
| `statFlat` | maxHp、attackDamage、armor、magicResist、initialMana、abilityAmount；amount非负整数 |
| `statPercentBps` | maxHp、attackDamage、armor、magicResist、abilityAmount；bps非负整数；对上述各stat一次汇总 |
| `attackSpeedBps` | 攻速加法bps，仅在snapshot解析固定attackInterval |
| `trigger` | hook=`combatStart / onAttack / onCast / onHpLoss`；everyN正整数；action为下表有限类型 |
| `grantShield` | amount固定整数，durationTicks正整数，只允许combatStart/onAttack/onCast，target=self |
| `gainMana` | amount固定整数，target=self；上述四hook都允许；不是新的施法动作 |
| `dealDamage` | amount固定整数，physical/magic；仅onAttack/onCast，target=该主行动的primaryEnemy；不扩散到全部AOE目标 |

没有治疗、复活、召唤、暴击、随机proc、百分比当前生命伤害、反伤、持续dot、动态buff、击杀归属hook或onDamage递归。组件/trait/augment/anomaly全使用此同一层；既有Ability保留独立行动plan并共同走damage/shield/mana resolution，不强行把11技能改写成通用脚本。

算术：先按M3星级得到baseStat；再flat求和，再percent bps求和，`floor((base+sumFlat)*(10000+sumBps)/10000)`，最后clamp。maxHp>=1、AD/armor/MR/abilityAmount>=0；initialMana取`min(maxMana,base+flat)`；maxMana/range不可由本轮内容修改。攻击间隔=`max(1,ceil(baseInterval*10000/(10000+sumSpeedBps)))`，不对interval加百分比。所有中间乘积必须safe integer；每stat sumBps<=40000、sumSpeedBps<=20000，超过配置上限拒绝content/restore，不能依遍历次序截断。

AbilityAmount只缩放主技能的resolved amount（包括selfShield技能），不缩放Item/trait/augment/anomaly hook的固定amount。AD不隐式增强技能伤害。效果本身不随星级再缩放。例：二星ranger AD126 + blade10 + team flat8，20% AD后为floor(144*1.2)=172；base20tick且+2500bps攻速→ceil(16)=16tick。旧无modifier快照数值与M3相同。

trait/member/team目标在snapshot展开到具体unit；hook只能作用于其owner与primaryEnemy。每个trigger的counter按effect key保存在Combat JSON：相应主行动每发生一次+1，达到everyN整数倍才proc；onHpLoss每tick若实际HP loss>0算一次；combatStart只执行一次、everyN必须1。无内部随机或wallclock cooldown。

## R8. Combat snapshot、hook 与事件顺序

`buildStrategySnapshot(MatchState)`返回纯JSON board-only单位、resolved stats/ability、trait摘要、来源明细、resolved trigger列表。完整深复制，不保存content对象引用；单位阵列按ID排序。初始满HP、mana=resolved initialMana、shield0、counter0，所有旧cooldown/target字段按M3重置。tick只用snapshot，不查catalog或当前Match。

Start：建立snapshot → 若双方都存在，按owner ID→source key排序运行combatStart（盾/mana），设`startEffectsApplied=true` → 返回tick0状态与开战事件。空阵tick0认输不触发任何start效果。Start的命令结果必须携带tick0 Combat事件，不能只在step/advance返回它们。公共事件载体用domain=match/combat区分两个序号域，Combat事件带combatId；MatchSession与observer在命令提交和advance两个入口统一收集，顺序为开战事件再tick事件（tick0直接终局则还有Match结算事件）。该标志、counter与`nextEventSeq`序列化；restore中的已开战snapshot不得再运行start。

每tick必须维持以下阶段屏障，不能在hook里提前扣HP：

1. tick+1；所有存活单位cooldown递减、旧盾到期；事件按unit ID。
2. 按M3共享位置快照规划移动，按ID预约/提交；寻找最近敌人时distance→ID，保留现有BFS方向顺序。
3. 按同一个移动后、伤害前的alive snapshot规划所有主行动。满Mana合法cast优先，排除同tick普攻；当tick所得Mana不能参与本次规划。主行动按source unit ID排序，AOE目标按ID。
4. 提交attack/cast事件、spend Mana、设cooldown；M3主packet/盾intent先生成。收集onAttack/onCast触发器，counter更新，按owner ID→source rank→sourceDefinition/instance ID→effectIndex顺序生成derived intents。伤害型hook只命中主行动primaryEnemy；selfShield cast也可使用行动规划时最近敌人。所有已经规划的行动包括本tick将死者都完成。
5. 提交全部新盾后再伤害。M4多盾统一为单盾模型：本批`shield=max(existing shield, 所有grant amount)`；非零时expiry取existing有效expiry与所有grant expiry的max。不叠加盾量，弱盾不会缩短强盾；逐source记录effectTriggered，聚合后每target至多一个shieldChanged。无modifier且每单位一次自盾时与M3相同。
6. 主/derived packets统一按targetId、sourceId、sourceKind rank（attack/ability在前，四来源随后）、sourceInstanceId、effectIndex、packetOrdinal排序；每包先按M3抗性公式floor/min1，再聚合target。全部HP同时结算，保留physical/magic/absorbed/actual hpDamage。derived damage标记`triggerEligible=false`，不能生成另一层proc。
7. 只对HP>0的存活单位处理onHpLoss（只允许gainMana，观察聚合实际HP loss>0；derived HP damage也可贡献本tick这一次，不能因此发伤害/盾）。汇总基础attackGain10、damageGain=min(20,floor(hpDamage/10))、hookGain；处理上限及overflow。onAttack/onCast gainMana也只在此提交，死者不获Mana。新Mana下tick才能cast。
8. 按ID清死亡字段并发death；elimination优先timeout，最多一个combatFinished；Match只在终止边界结算。

combatStart不产生攻击/伤害；derived intents不触发onAttack/onCast，故整个图有限且无递归。onHpLoss仅mana使上述阶段无向前反馈。same-tick护盾挡伤害、施法者互杀仍命中、伤害回蓝只对幸存者等M3约束必须保留。

事件：保留旧字段，新增provenance与连续`eventSeq`（每战从0，tick0也计入）；Match事件另有自己的序列，跨战由`round/combatId/eventSeq`区分。`effectTriggered`携带source key、action、实际target；`manaChanged`增加hookGain；damage事件保留聚合数值并附规范排序packet贡献明细（raw/mitigated/source），不强行分配overkill给某个来源。静态增益用snapshot resolvedStats breakdown说明，不能伪造proc。完整事件顺序为：expired shield → movement → primary attack/cast → action effectTriggered → granted shields → damage → hpLoss effectTriggered → manaChanged → death → combatFinished；每阶段按上述稳定key。

临时Map/Set仅限函数内，不进入state。交换输入unit/item/catalog枚举顺序不改变规范化输出。finished step返回同对象和空事件；原snapshot/Match deep-freeze后tick仍能运行，不共享可变嵌套effects/counters。

## R9. Authored content vertical slice

目标18单位、6traits、20件装备定义（5组件+15成装）、8augment、8anomaly。所有cost桶有内容，低费即可形成多个tier路径。旧11单位数值/能力原样保留，仅增加trait IDs；新增7单位复用已有能力primitive，完整数值由以下模板确定，避免“名称占位但不可买”。

### R9a 单位与羁绊

| ID / 名称 | cost / 数值与能力 | 两个traits |
| --- | --- | --- |
| sentinel 守卫 | 1，M3原值 | bulwark、conduit |
| ranger 游侠 | 1，M3原值 | marksman、forge |
| mystic 秘术师 | 1，M3原值 | scholar、conduit |
| bulwark 壁垒 | 2，M3原值 | bulwark、forge |
| archer 神射手 | 2，M3原值 | marksman、conduit |
| arcanist 奥术师 | 3，M3原值 | scholar、forge |
| duelist 决斗者 | 3，M3原值 | duelist、forge |
| warden 守望者 | 4，M3原值 | bulwark、scholar |
| tempest 风暴使 | 4，M3原值 | scholar、marksman |
| colossus 巨像 | 5，M3原值 | bulwark、forge |
| oracle 先知 | 5，M3原值 | scholar、conduit |
| squire 侍卫 | 1，复制sentinel数值/能力引用 | bulwark、duelist |
| spark 火花 | 1，复制mystic数值/能力引用 | scholar、forge |
| scout 斥候 | 2，复制archer数值/能力引用 | marksman、duelist |
| binder 织流者 | 2，复制bulwark数值/能力引用 | conduit、duelist |
| striker 突击手 | 3，复制duelist数值/能力引用 | marksman、duelist |
| beacon 灯塔 | 3，复制arcanist数值/能力引用 | bulwark、conduit |
| prism 棱镜 | 4，复制tempest数值/能力引用 | marksman、forge |

新单位必须有自己的ID/name/symbol/color静态记录；数值模板在打包时展开为完整definition，不是运行时继承对象。新ID加入正确cost桶，桶内排序固定ASCII；因此M4商店结果不应假装与M3相同seed完全一致。

| Trait ID / 显示 | 阈值 | 最高tier完整效果 / 目标 |
| --- | --- | --- |
| bulwark 壁阵 | 2 / 4 / 6 | armor、MR各+15/+30/+50；成员 |
| marksman 远射 | 2 / 4 / 6 | 攻速+1500/+3000/+5000bps；成员 |
| scholar 研习 | 2 / 4 / 6 | abilityAmount +1500/+3000/+5000bps；成员 |
| forge 锻盟 | 2 / 4 / 6 | AD+8/+16/+28；全队 |
| conduit 导流 | 2 / 4 / 6 | initialMana+10/+20/+30；成员 |
| duelist 锋舞 | 2 / 4 | 每第3次普攻额外physical 25/55；成员 |

每一最高tier有足够不同可购definition支持；duelist只有5名成员因此不虚设6档。真实路线可由sentinel+squire开壁阵2，再买bulwark/beacon/warden等到4；forge也有低费4名路径。F提高population，重复牌主要用于升星而非刷trait人数。

### R9b 装备

组件：blade刃片(AD+10)、rod晶杆(abilityAmount+20)、vest甲片(armor+15)、tear流滴(initialMana+15)、belt织带(maxHp+100)。ID均稳定小写。成装只使用自身完整效果，**不隐式再加组件属性**；下列覆盖5组件全部15种无序配对。

| 成装ID / 配方 | 完整效果（自身） |
| --- | --- |
| twin-edge = blade+blade | AD+30 |
| spell-edge = blade+rod | AD+15；abilityAmount+30 |
| guard-edge = blade+vest | AD+15；armor+20 |
| pulse-edge = blade+tear | AD+10；每3次普攻gainMana15 |
| heavy-edge = blade+belt | AD+15；maxHp+180 |
| focus-rod = rod+rod | abilityAmount+6000bps |
| ward-rod = rod+vest | armor+20；onCast grantShield120，60ticks |
| echo-rod = rod+tear | onCast对primaryEnemy额外magic70 |
| vital-rod = rod+belt | maxHp+180；abilityAmount+30 |
| fortress = vest+vest | armor+45；MR+20 |
| dawn-ward = vest+tear | combatStart grantShield200，80ticks |
| heavy-plate = vest+belt | maxHp+240；armor+25 |
| flowing-tear = tear+tear | initialMana+30；onHpLoss gainMana3 |
| reservoir = tear+belt | maxHp+180；onCast gainMana10 |
| giant-belt = belt+belt | maxHp+500 |

未注明everyN的hook每次触发；本表grantShield不会被abilityAmount增强。开局固定blade+rod允许普通UI立即合成spell-edge并观察攻击/技能改变。要验证事件型装备，可用后续随机组件完成pulse-edge/echo-rod等，固定验收seed须事先证明可达。

### R9c Augment（全队己方上阵单位）

| ID / 名称 | 永久Match modifier |
| --- | --- |
| iron-line 钢阵 | armor+15、MR+15 |
| vitality 生机 | maxHp+150 |
| heavy-hands 重拳 | AD+12 |
| quick-drill 速训 | 攻速+1500bps |
| study-circle 研讨 | abilityAmount+2000bps |
| charged-start 充能 | initialMana+20 |
| opening-guard 开场屏障 | combatStart grantShield120，60ticks |
| cast-echo 施法余响 | 每2次cast对primaryEnemy额外magic60 |

两次choice可选择不同augment，叠加依R7/R8。不生成金币/组件、不返还reroll费用，避免需要额外经济primitive。

### R9d Anomaly（只作用绑定单位）

| ID / 名称 | 永久单位modifier |
| --- | --- |
| colossal-form 巨化 | maxHp+4000bps |
| tempered-core 淬芯 | armor+35、MR+35 |
| rapid-form 迅变 | 攻速+4000bps |
| arcane-form 灵变 | abilityAmount+5000bps |
| crushing-form 猛变 | AD+3500bps |
| echo-core 回响核心 | onCast对primaryEnemy额外magic100 |
| guarded-form 护壳 | onCast grantShield200，60ticks |
| cycling-core 循环核心 | 每2次普攻gainMana15 |

所有unit均有技能和普攻，因此无候选适配筛选软锁。Anomaly单独effect key，不混同同名装备hook计数。

## R10. 输入、UI 与冲突裁决

native D/F/E每个keydown（含OS repeat）按DOM事件顺序同步提交；不得debounce、动画锁、每帧折叠。继续忽略IME、editable、Ctrl/Meta/Alt。buy仍带shop generation；choice必须带choiceId/generation；drag上下文为显式union `unit`/`item` 与pointerId、gestureEpoch，不能把itemId当unitId。

preparation中：unit drag时E目标为dragged unit，其次hover unit，再selected unit；item drag/物品面板悬停时E不穿透出售背景单位，显示“无出售单位目标”，不改变Match。D/F仍即时执行：成功清理当前所有drag并同步UI；失败保留有效drag。装备/合成只在release/确认处提交一次，重入与迟到release用gestureEpoch拒绝；单位被卖/merge消耗时清除旧ID。动画不参与命令可用性。

choice进入时取消所有拖拽、hover/selected和pointer capture；modal全屏阻止点击穿透。D/F/E、buy、deploy、equip、combine、Start、Continue在Match层统一wrong-phase；UI禁用也必须有simulation测试。Anomaly专用reroll按钮不借用D。选项第一次成功后generation/phase变化，双击/双指/旧卡只能产生一次选择；按住键跨phase不积压重放。

touch提供点击组件→选择第二件→合成确认和点物品→点单位空槽作为拖拽等价操作；一次只允许一个gesture owner，第二pointer不能接管第一pointer物品。触摸取消、滚动、视口改变、choice打开、Scene shutdown、新Match均取消手势。手机显示trait当前/下一阈值、组件配方、槽位、选人锁定提示、reroll价格/余额、当前绑定标记。战斗tooltip显示四来源stat分解、trigger来源与Mana/Ability，不要求每个静态增益产生proc动画。

## R11. JSON restore / replay / content validation

restore是纯函数：解析 → 校验schema/rules/content digest → 校验完整引用/阶段/数值 → 深复制返回；不得consume RNG、生成offer、发奖励或重放combatStart。schema3显式返回unsupported-version，不静默补M4默认值；M3存档迁移/replay UI不属本轮。正常M4的preparation、所有choice子阶段、任意combat tick、settlement、gameOver均可JSON roundtrip。

必校验：Item唯一ID/合法定义/location/最多三槽/无空悬owner；单位ID/位置/星级/serial范围；Augment唯一；绑定唯一且owner存在；choice按子阶段校验：anomalyTarget的offers为空且targetId=null；Augment offer恰好三项合法互异且targetId=null；anomalyOffer恰好三项合法互异且target存在并锁定；receipt不能既完成又pending；RNG uint32；round/history/phase合法；所有tick/counter/seq非负safe integer；effects key唯一、resolved stat上限；combat双方目标/来源引用合法；无NaN/Infinity/undefined/Map/Set/函数。运行时解析不可只用`as MatchState`断言。

replay header保存seed、三版本/digest、RNG算法ID；命令ledger记录逻辑index、全部参数及generation、accepted/reason、领域events与canonical state hash；tick步进是独立记录，不用wallclock推导。reject插入只改变外部输入日志index，不改变领域state/eventSeq；比较时对齐接受命令与tick。JSON对象key canonical排序，数组按语义顺序保留；无localeCompare。

内容ID在unit/trait/item/augment/anomaly/ability各自命名空间内唯一；允许unit与trait同名（如bulwark），引用和source key必须带kind。Unit/Item实例分别使用unit-/item-前缀与各自单调serial，不能以裸definitionId代替实例。

内容启动/CI验证包括：各命名空间ID与引用、每cost桶非空且完整、三档星级技能数值、单位trait无重复、trait阈值递增/最高可达、selector与hook-action白名单、recipe无序对唯一/无循环/全原料可获取、20装备和8+8选择池数量、两次augment排除后>=3、anomaly排除上一页后>=3、reward可达、schedule ID唯一/顺序/合法target回合、整数与最坏合法叠加safe bound。bound验证按单单位三个装备槽（可重复）、两项不同Augment、一个Anomaly、该单位可同时享受的各最高trait tier及最高星级计算，不能把全catalog相加；flat、percent与乘法中间值全部检查。当前ability percent最坏30000bps（3×6000+5000+2000+5000），攻速最坏10500bps（5000+1500+4000），都在R7上限内。新增超界内容应在启动/CI失败，不得让合法装备组合直到Start才报错。局部新增同一primitive内容不需改tick主循环；未知primitive必须拒绝，不能静默忽略。至少有一项测试临时加入一条合法新内容记录并经validation→snapshot→Combat，证明接入不是具体ID硬编码。

content digest锁定确定性；数值修改先更新version/golden变更记录，再重跑完整验收。所有限制是本轮finite schema，未来M5新规则通过扩充primitive及测试进入，不能靠任意内容脚本绕过事件顺序。
