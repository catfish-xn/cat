# M8 B2 规则与数据合同（m8-b2-v1）

冻结日期：2026-10-07；基线：`feat/m8-b0-baseline@73f1767bbd9371b8c94b2892b29a3350f3313031`。
本次只交付类型、合同和可序列化的小样例，**没有实现或启用 B3–B9**。当前程序仍执行 M7/M5 规则及版本。未来实现以本合同、B1 数值归档和逐项来源为依据；未列变更沿用 [M5_RULES.md](../M5_RULES.md) R6。

用户批准原 GS-01–04、TG-01 及审计中的另外41条项目约定，共46条；批准不代表官方脚本证明。B-07 红霸符只启用选定3%增伤、不加射程；B-10 飓风暂用无距离上限，均继续待历史核验。原始 effects、原档 hash 和配方不改；来源再生成不能改变 runtimeEligible=false。归档修正见 [项目约定清单](M8_PROJECT_CONVENTIONS_REVIEW.md)。

类型权威是 `src/simulation/m8/contracts.ts`、`ui-contracts.ts`；它们仅被合同样例引用，没有挂到生产入口。原有 `combat-types.ts/ability-types.ts/strategy-types.ts/match-types.ts` 和 M6 版本常量继续描述当前程序，B3–B9 接入时替换相应边界，不保留两套运行规则源。样例 `tests/m8-contracts.test.ts` 只证明字段、类型限制和 JSON 往返，不证明装备已战斗生效。

## 1. G01–G12 接口及消费者

所有金额、tick、Bps、序号使用安全整数；非法值须被未来入口/恢复校验器拒绝。类型别名 `number` 不是运行时验证器。Source 复用 CombatOrigin 六字段，另加可空 parentItemInstanceId；永久装备 source.instanceId 是真实实例ID，窃贼子件使用独立 temporaryId，沿 parentItemInstanceId 追溯本体。

| 编号 | 冻结类型 / 输入→结果 | 必需消费者和最小验收 |
| --- | --- | --- |
| G01 | StatModifier、Condition、Amount；属性基数+来源修饰→最终值；maxHpChanged 与 heal 分离 | 巨杀严格>1750；正义501/500/499；狂徒与血手共享生命基数 |
| G02 | DamageRequest/DamageContext→DamageOutcome | 普攻、技能、反甲、飓风、电刀、离子、burn；三伤害类型、盾/HP/过量分列 |
| G03 | CritEligibility、SpellCritAuthorization | 无尽与珠光统一授权；治疗/护盾/装备包绝不因授权暴击 |
| G04 | StatusApplication/Contribution/Group | 灼烧、重伤、减甲/魔抗、免控；弱来源仍保留，到期后能恢复 |
| G05 | PeriodicTask→有限 Effect | 20tick burn pulse、龙牙、大天使、日炎、救赎；余数、末次、死亡行为可保存 |
| G06 | HealRequest→HealOutcome | 饮血、枪刃、正义共用资格；requested/afterWound/actual/overheal 区分 |
| G07 | ShieldState、SurvivalSample、ShieldEndReason | 饮血、圣盾、冕卫；盾耗尽/到期/死亡清理分开 |
| G08 | ManaRequest→ManaOutcome、CastReceipt | 受击头盔、青龙刀、蓝霸符、离子；actualManaSpent 与 refundedMana 分开 |
| G09 | TriggerDefinition、EffectRuntime→有限 Effect[] | 鬼索、纳什、泰坦、破防者、血手；次数、冷却和幂等标记均入状态 |
| G10 | TargetSelector、RoundDefinition | 六角范围/固定参考点/稳定并列；双方前后排镜像 |
| G11 | untargetable、damage-prevention、cleanse 三个独立 Effect/Status | 夜刃；新选敌、已发包、持续伤害和净化分别判定 |
| G12 | EquipmentRoundRoll、TemporaryEquipment、M8MatchExtension | 窃贼按本体ID+轮次保存组合；转移/重穿/恢复不重抽 |

有限 Effect 只含伤害、属性、状态、治疗、盾、法力、最大生命、技能暴击授权、净化、临时装备；不提供脚本/回调、任意表达式或复活入口。组合由顺序 Effect[] 表达，例如夜刃为净化→不可选中→完全防止，结束后攻速；完整装备系数仍从 B1 对应字段读取，不复制一份新装备目录。

身份 key 使用 canonical JSON 数组 `[combatId,sourceKind,instanceId,effectIndex,targetId]`，不拼接无转义分隔符。状态贡献、周期、盾和触发运行态分别命名空间。duration.kind=combat 对应 expiresAtTick=null，不能用0冒充无期限。RNG、余数、计数、已消费标记以及完整事件序号必须保存；恢复不重跑 combatStart。

## 2. GLOBAL-NUMERIC-01：数值及取样

- 导入比例：先规范到四位小数，再转10000分母Bps；百分数点先除100。金额保持整数；秒×20得到仿真tick。不得将原始 `null` 当0。
- 最大生命唯一公式：`floor((baseHp + sum(flatHp)) * (10000 + sum(hpBps)) / 10000)`。组件合成后只计成装字段一次。基础1000＋狂徒600、12%得到1792；再加血手25%得到2192，增加当前生命400，不是1792×1.25。
- AD平加/百分比、AP、攻速和暴击独立来源累加；AD沿用 `(baseAD+flatAD)*(10000+sum(adBps))/10000`。攻速沿用基础每秒攻击×合计Bps，间隔向上取整且至少1tick，不重写正在等待的剩余冷却。暴击率截断到[0,10000]，无溢出转换。
- 百分比减抗同类取强，平坦抗性修饰相加，最终抗性下限0。物理/魔法按抗性→增伤相加→减伤取强的既有顺序逐包取整；普通正伤害最终至少1。相同数值的 hash/命名字段只启用 B1 所选一次。巨杀条件每包读目标当前maxHp。
- 本项目 true 伤害绕过抗性和常规伤害减免（含坚韧），仍受攻击方增伤、完全伤害防止及护盾影响；完全防止为0，不抬到1。burn 的比例金额最终向下取整，低于1可为0；B-02 中立怪上限100在每次 burn pulse 的增伤后封顶，再进入防止/盾。该真伤资格是 B2 项目执行选择，不声称官方语义。
- Amount 先合并 flat、AD/AP/HP、actualManaSpentBps及actualDamageBps项再取整；后两项必须关联完成施法收据或合资格伤害结果，缺上下文时拒绝，不默认为0。周期保留有理数余数：如1001HP的1%每跳为10.01，连续100跳累计1001，不每个仿真tick丢小数。余数属于周期来源；强弱切换不挪用其他来源余数。封顶或防止掉的整数不作为下一跳欠账。
- 正义的AD/AP在动作金额取样时、吸血在治疗阶段开始前取样；恰好50%均不翻倍。坚定之心按稳定包序的虚拟当前HP每包前取样，>50%为15%，否则8%；不把动态条件冻结到开战。
- HP百分比比较用整数交叉相乘；任何中间乘积超安全整数界限拒绝，不静默浮点近似。正式 B3 可用 BigInt 中间运算，但持久化仍保存安全整数/有理数分子分母。

## 3. 同 tick 顺序与保命合同

保持50ms、最多1200tick，以及现有同时行动/同时HP提交。动作规划前快照、包内虚拟状态、伤害后存活快照是三个不同边界。根包稳定顺序：tick→来源单位ID（代码点）→actionSeq→targetId→packetOrdinal；派生包保留 rootActionSeq/parentPacketId。需依赖命中结果的子包在父包后、下个根包前插入有限队列，同父按source key/targetId/packetOrdinal排序；不得按子包ownerId把它排到父包之前。所有必需派生伤害在同一批HP提交前结算完毕，不依赖数组插入次序。

1. tick增加，冷却推进。先结算明确的到期末次任务：burn末跳、水银第360tick最后一层、原Darius有限四跳；再移除到期状态/盾，再执行其他到期周期。末跳只读取该任务原有贡献，不给新动作延长状态。大天使在100tick增加AP，参与当tick规划。
2. 现有控制与免控生效；移动，更新光环与主目标计数。到期不可选中结束后重新选敌；新控制不能取消本tick已规划动作。
3. 动作、目标、成本、计数和RNG规划；完成施法生成 CastReceipt，固定位置和返蓝前实际消耗。施法开始可用现有法力，刚获得的法力下一tick才可发新施法。已规划自盾先于本批承伤生效。
4. 收集动作完成的有限触发伤害（飓风/电刀、离子），执行伤害包；受普攻命中的反甲在命中结果出现后排入有限子包队列。用虚拟盾/HP分配吸收和首个致死包。电刀减魔抗在自己的首个电刀包前；轻语在合资格物理包后；破防者额外增伤在触发包后。因此后续包可看到这些数值修饰，已规划动作不撤销。它们是原“新状态下一tick”规则的显式例外，不把所有新控制改为即时。
5. 同步提交本批HP。**饮血、圣盾、夜刃、挑战护手统一读取本批伤害后、治疗前的 SurvivalSample**：本批receivedPositiveDamage（含盾吸收）且hpAfterDamage>0，并且 ≤ 各自阈值；不是只有从阈值上方穿越才触发。先冻结所有资格和 maxHp，再按来源key执行，防止血手改HP让同批饮血资格随槽位变化。每件每场一次，先记录 consumed 再发效果。血手另在开战取初始样本检查一次（这次豁免receivedPositiveDamage）；其余三件只响应伤害。
6. 仍存活者获得阈值盾/净化/属性，再结算已规划直接治疗与合资格吸血。所有同批吸血比例从治疗阶段入口HP快照计算，不能前一个治疗改变同批后一个正义比例。治疗按source key→targetId→packetId结算封顶。死者不复活，死亡来源不自疗，也不经枪刃治疗队友。
7. 幸存者获得法力；记录击杀/助攻/成长。助攻是本场曾对目标造成正实际伤害（盾也计）的来源ownerId集合，无额外时间窗；装备伤害可留归因，不因此获攻击/施法触发资格。
8. 提交普通延迟控制/属性效果，从下一tick生效，完整持续时间从实际startsAtTick计。清理死亡目标及其可取消任务，更新光环；先消灭判定，再超时。Match处理掉落和结算后一次原子提交。

**手算边界**：1000maxHp、700HP，单包300后400HP，饮血触发250盾；两包同tick400＋400后0HP，四种保命均不触发，不能让中途300HP的临时盾救活。两包200＋200后300HP，两件饮血各250盾，供后续tick使用。血手1000maxHp/600HP触发变1250/850；这是maxHpChanged，不受重伤、不产生heal事件。血手与饮血同时合格时，饮血使用变化前maxHp算盾。

盾按最早expiresAtTick→source key吸收；同源刷新取较大剩余量/较晚到期，不额外触发旧盾结束；异源独立。冕卫仅 `depleted | expired` 且本批存活时给25AP，每件一次；death-cleanup/replaced/combat-end不给。耗尽和到期同tick只通知一次。圣盾的100tick盾与战斗全程20双抗是两个生命周期，不绑在同一盾对象上。

## 4. GLOBAL-PROC-01：伤害来源→允许触发的效果

“正实际伤害”=absorbed+hpDamage>0，排除过量、生命成本、完全防止。下表为资格，不保证已装备或触发条件成立。普攻完成是独立事件，不能从每个伤害包反推一次普攻。技能持续伤害包括Darius流血，装备灼烧另列。

| 伤害来源 | 暴击 | 鬼书/红霸符施加 | 轻语 | 防守泰坦/阈值 | 饮血/正义/枪刃自疗及枪刃友疗 | 破防者 | 基础受伤回蓝 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 普攻 basic-attack | 普攻资格 | 是 | 正物理 | 正实际伤害/伤害后存活 | 是 | 正盾伤 | HP损失 |
| 技能 ability-direct | 技能授权 | 是 | 正物理 | 同上 | 是 | 正盾伤 | HP损失 |
| 技能持续 ability-periodic | 技能授权 | 是 | 正物理 | 同上 | 是 | 正盾伤 | HP损失 |
| 羁绊/异常攻击附加 attack-extra | 否 | 否 | 正物理 | 同上 | 是 | 正盾伤 | HP损失 |
| 装备追加 equipment-proc（飓风/电刀/离子/反甲） | 否 | 否 | **正物理允许** | **允许** | **全部否** | 正盾伤允许 | HP损失 |
| 装备 item-burn | 否 | 否 | 不适用：真伤 | 正实际伤害/存活允许 | 全部否 | 正盾伤允许 | HP损失 |
| redirected 分担包 | 不重掷 | 否 | 否 | 实际承伤者允许 | 沿原包资格，只计拆分后实际量一次 | 否 | 实际HP损失 |
| 自身生命成本/零伤害 | 否 | 否 | 否 | 否 | 否 | 否 | 否 |

来源sourceKind不能代替delivery；Kog/Lux等技能附伤属于ability-direct，能按技能伤害施加鬼书/红霸符，暴击需技能授权，不继承主普攻暴击结果，也不生成另一次普攻完成。attack-extra只用于羁绊/异常附加包，无技能资格。Loris分担不二次减伤/递归分担，仍受实际承伤者完全防止和盾；自疗基数只汇总拆分后的真实吸收/HP损失，不能再加未拆分原包。伤害统计只记hpDamage，盾伤另列。

| 非伤害事件 | 合资格效果 | 排除项 |
| --- | --- | --- |
| attack-completed | 鬼索、青龙刀、电刀计数、飓风、攻击方泰坦 | 取消攻击；技能/追加弹不生成该事件；已完成但格挡仍计数 |
| incoming-basic-hit | 前排自适应头盔额外1蓝、反甲（各自ICD） | 必须持有者被普通攻击命中，完全盾吸收也算；追加包/分担不重复计 |
| cast-completed | 纳什、蓝返蓝、范围内离子惩罚 | 取消未完成施法；装备包不是一次施法 |
| kill-or-assist | 蓝霸符500Bps刷新160tick | 不创建额外伤害递归，死亡持有者不领奖 |

装备追加伤害不引发新的装备伤害；上表特许的轻语/泰坦/破防者是有限状态监听。伤害型装备触发最多一层equipmentDepth=1，每实例每根动作有maxPerAction限制；周期burn是独立定时任务，不是同步递归回调。阈值、法力、治疗和状态不会再生成攻击完成事件。超过声明界限表示非法计划/恢复错误，应拒绝整个事务并保留原state，不能截断事件或吞掉已计划伤害。

吸血和枪刃治疗使用同一资格与`absorbed+hpDamage`基数，不额外惩罚AoE；各来源吸血Bps相加后自疗一次，枪刃每件友疗独立。200合资格伤害、饮血20%得40请求；300请求受33%重伤得201，缺血100则actual100/overheal101/preventedByWound99。最弱生命比例友军排除自身、死者，比例并列按ID；无队友不转给自身。重伤只减少治疗，不减盾/最大生命调整。

## 5. GLOBAL-STACK-01：同件、异件、同类

普通装备一槽；unique=true禁止同持有者同apiName重复，source unique=false不擅改。窃贼占三槽形成有效单件限制。基础属性按每实例相加，装备ID/槽顺序不产生复利。

| 分类 | key与行为 | 装备/例外 |
| --- | --- | --- |
| 同件刷新 | 同source实例/effect/target刷新期限，幅度不加，period phase保留 | 纳什100tick、蓝击杀增伤160tick、破防者60tick、轻语60tick、同源burn/wound |
| 同件累计层 | 同key增层，cap/上限奖励标记保存 | 鬼索无上限、大天使每100tick30AP、水银九层、泰坦25层且满层双抗一次 |
| 多件独立 | 不同item instance key，计数/ICD/盾/治疗/增益各自存在 | 两件纳什各6000Bps、两件离子各自惩罚、反甲各40tickICD、饮血/圣盾/夜刃/血手每件一次、冕卫各自结束奖励；救赎多件治疗独立 |
| 同类最强 | 保留每来源强度/期限，仅有效强度取max；并列source key；强者结束弱者若仍在则恢复 | burn、wound、sunder、shred、常规减伤（含救赎坚韧）；非相加/连乘 |
| 开战/动态属性 | 开战站位冻结，其他动态条件按指定边界重算 | 头盔分支锁定；石像鬼按存活敌方主目标计数；正义/坚定之心按当前HP |
| 技能暴击授权 | 先合并非装备授权，再数装备授权；见§6 | 无尽/珠光共用，不按“先穿谁”增减收益 |

同类贡献各保存，不能删除被压制者。例：30%shred至tick100，50%至tick60；tick59有效50%，60起恢复30%，100归零。光环离圈/源死亡立即删该贡献而非全部同类。控制同源取较晚到期，异源剩余任一控制即受控；免控阻止新控制，不净化已有状态。

burn组的首次时钟为施加tick+20；有活跃贡献时重复施加、换更强来源不延后nextPulseAtTick。被压制来源不付款、不累计应发整数，仅保留自身已有余数；组时钟仍按周期推进。同强刷新本来源期限，源列表保留日炎“由本件灼烧”的判定，不能只读全局burn标志。每跳按当前最强贡献归因；同强按key；已附着burn/wound/减抗期限不因来源死亡消失，光环与源周期则停止。目标死亡移除其任务；战斗结束全清，不补未来跳数。

鬼书2000maxHP目标，t施加后 t+20、40…200 各20，共10次200；名称统一 **burn pulse，每1秒／20个仿真tick结算一次**。日炎tick40首次施加，tick60首次burn pulse；选敌定时器40tick与burn20tick不能合并。中立100上限按每burn pulse计算。水银tick40、80…360共九次300Bps，累计2700；360先末层、后移除免控，新控制在360已可生效，已有攻速持续本场。大天使额外AP在0/100/200为0/30/60，基础AP另计。

救赎开战至tick99无坚韧；tick100首次治疗后施加100tick坚韧，同tick已经规划/结算的伤害不追溯减免；动作延迟状态从101至201（半开）。200下一次治疗刷新该来源保持覆盖，无其他目标则不刷新。范围伤害以外的物理/魔法也享受坚韧，true按§2排除。

## 6. 无尽与珠光：统一技能暴击授权

非装备来源只提供一个先验布尔授权，不互相凭空加暴伤。设装备授权件数N、非装备授权存在A：enabled=A或N>0；重复装备奖励次数为 `A ? N : max(0,N-1)`，每次额外1000Bps暴击倍率。基础暴击率/倍率和每件静态暴击属性独立合计。槽排序仅决定展示来源，不决定总倍率。

| 来源 | 技能授权 | 重复授权额外倍率 |
| --- | --- | --- |
| 无来源 | 否 | 0 |
| 无尽一件 或 珠光一件 | 是 | 0 |
| 无尽＋珠光（互换槽位） | 是 | 1000Bps，互换不变 |
| 已有非装备授权＋无尽 | 是 | 1000Bps |
| 已有非装备授权＋无尽＋珠光 | 是 | 2000Bps |

现有19技能的伤害部分统一标`requires-spell-authorization`：Irelia结束爆发、Maddie各射击、Darius直伤/流血、Lux附伤、Zyra各包、Tristana主伤、Urgot、Rell线伤、Leona结束伤、Vander强化额外伤、Kog附伤、Scar、Ezreal中心/范围、Loris结束伤、Nami各跳、Corki各导弹、Garen伤害、Zoe各跳、Caitlyn各伤害包。其治疗、盾、控制、属性与法力部分never；Tristana继承已减免溢出的弹射不再次暴击，Loris分担也不重掷。B3逐输出点加标签并测试，不改变系数、目标几何或扩大英雄目录。

每个已规划普攻仍消费1词（即使0%/100%）。每个已规划、获授权且非继承结果的技能伤害包消费1词，按actor/action/target/ordinal顺序，AoE各目标独立；未授权不消费技能暴击词。未来多段任务在实际发射时消费，取消的未来段0词；已计划但被防止的伤害不退随机词。攻击附加技能包独立抽取，不共享主攻击结果。暴击判定使用`word*10000 < chanceBps*2^32`，避免先取整损失概率精度；安全整数内精确。

## 7. 法力、区域与夜刃

G08保留普通攻击10蓝、幸存者每tick合计实际HP损失的`min(20,floor(loss*3/100))`，不是每个伤害包都领20。盾吸收不给基础受伤蓝，但头盔明确以持有者incoming-basic-hit加1，每命中一次；青龙刀每完成普攻另5。均受锁蓝/上限/无蓝单位限制。蓝霸符每次完成施法返10，仅本次返蓝绕过锁蓝。无maxMana单位请求applied=0，不制造资源；overflow、blocked分别记录。

B2锁蓝项目边界：首次施法效果提交即视为完成施法，后续多段发射不是新施法；本片常规锁蓝区间为该次施法tick的[t,t+1)，ManaState.lockedUntilTick=t+1。同tick普通回蓝blocked，蓝霸符以该actionSeq的cast-refund例外回蓝；不会让一个动作递归再次施法。未来若引入不同锁蓝长度必须有独立规则版本，不由UI猜测。

施法消耗80、返10：CastReceipt.actualManaSpent=80、refundedMana=10，离子DamageContext.triggeringCastActionSeq指向该敌人施法收据，离子按80×归档160%=128原始魔伤，不取净70×160%=112；免费施法actualManaSpent=0，离子为0且不抬到最小1。离子完成施法时距离>2不触发；两件独立判定。取消未完成施法不返蓝也不惩罚。

六角距离沿用board.ts；并列代码点ID，无视觉坐标/RNG。自适应玩家前排row4/5、后排6/7，敌方前排row2/3、后排0/1；combatStart锁定，移动不切换。光环每tick移动和目标变化后重算，源死亡立即撤除。

- 飓风：以持有者为距离参照，完成攻击时排除主目标、死亡及不可选中敌人，选最近1个；无半径上限是B-10暂行玩法取舍，不是“缺半径字段证明无限”。
- 电刀：完成第3/6/9次普攻时固定主目标在首位，额外候选按**与主目标的六角距离**、ID一次性排序，最多再取3名不同存活可选敌人；不逐跳改参照点，无额外半径。主目标死亡/不可选中则不发本次电刀，不把别的敌人冒充主目标。每个目标先加shred再受35魔伤。
- 固定站位例：持有者(3,4)，主目标p(3,3)，候选a(3,2)、b(4,3)、c(3,1)、d(6,3)，距p分别1/1/2/3；序列p,a,b,c。交换a/b输入数组顺序仍按ID，选择过程不耗RNG。
- 日炎：持有者2格内，优先没有本item instance活跃burn贡献的目标，再距离/ID；即便别人已灼烧也可能成为本件优先目标。无目标跳过本轮，不补偿随机选择。
- 救赎：周期取样自身及1格内存活友军，每目标缺失HP15%，先封顶1000、再重伤和当前maxHp封顶；治疗来源独立。

夜刃三动作各有语义：①净化可移除敌方stun、burn/wound、sunder/shred、负属性并取消被清除的附着DoT任务，不清有益状态、装备、本体层数、法力锁或自己的成本；源光环下tick可重新施加减益；②不可选中持续20tick，阻止新的敌方单体/连锁/攻击候选，现有仇恨清除并在下一规划重选；③完全伤害防止20tick，包括已发弹体、AoE、未被净化的DoT、true和分担伤害。未选中不自行取消已经发射的包，包到达后独立由完全防止判0；同批已结算包不回滚。净化不撤销敌人已规划动作。触发后t..t+19有效，t+20先结束再行动，结束给1500Bps攻速至本场，死亡/战斗清理不给结束收益。

## 8. G12 与 RNG 冻结

Match保留现有shop/choice/reward/battleSeed流初始化和消费；新增流各自保存state/draws，初态是下表 `(seed XOR salt) >>> 0`，初始化本身0词。LCG仍`(imul(state,1664525)+1013904223)>>>0`，seed0合法。

| 流 | salt | 唯一消费边界 |
| --- | --- | --- |
| equipment | 0x243f6a88 | 尚无本体ID+roundId组合的有效生成事务 |
| encounter | 0xb7e15162 | 首次进入本轮准备期，冻结已批准候选的遭遇；单一固定遭遇0词 |
| loot | 0xdeadbeef | 遭遇冻结后同事务，按来源单位ID/掉落槽序固定完整计划；确定项0词 |

新增均匀抽样采用拒绝采样：U=4294967296，limit=floor(U/n)*n；读词w，w>=limit则消耗并重试，否则index=w%n。被拒词也计draws，保证TG等权而非把缩放微小偏差称严格等概率。n=35时limit=4294967285，末11词拒绝；n=8时无拒绝。所有池按apiName代码点排序；有权重时用已批准正整数权重总和同法取桶，未知表不能参与抽取。

窃贼低档先35成装再8组件，高档先35成装、移除该项后再34成装；各轮所有本体按永久实例ID排序，通常2个接受词，拒词额外计数。N个本体互不借用商店、遭遇、掉落或战斗词。低档280个组合/高档595个无序对的等权是项目TG-01，不声称历史抽样表。

`EquipmentRoundRoll`以 `[parentItemInstanceId, roundId]` 唯一，保存当时等级、poolVersion、两件definitionId及drawStart/end。进入准备期对已穿戴本体生成；库存本体本轮首次穿戴才生成，取当时等级；之后F升级、出售单位返还、升星转移、同轮重穿与读档均恢复相同组合，0词。旧holder不是key的一部分。

子件temporaryId=`JSON.stringify([parentId,roundId,childOrdinal])`，只有parent+round组合存在才能重建。转移结束旧持有者效果，重建新持有者效果；本体仍保留组合账本。升星时先满足普通唯一/三槽规则，冲突本体返库存，不拆子件返还。临时件不能单独出售、合成、转移或获永久ID。三槽0本体、1/2子件；本体的150HP/2000Bps暴击另计一次。新轮撤销旧临时件再生成新key，旧组合供历史校验保留；战斗快照复制当轮结果，不引用可变Match。

所有查询、预览、失败命令、重复step/Continue、同轮转移、恢复消费0词。回放仅隔离副本按原轨迹重演，绝不修改活动局任何流。失败返回同一state引用、无事件、无ID/收据消耗。

## 9. 轮次与掉落合同（接口冻结，数值待B1）

RoundDefinition给出roundId/ordinal/stage/subround/kind/isFinal/encounterId；UI和收据不从旧round算阶段。阶段1编号、起手资源、遭遇和具体掉落/保底表仍未知，不能以空数组、0概率或旧M5补给冒充已核准。B6–B8必须另交这些来源/项目政策。若最终三次开场PvE，容量为38推进轮/33战；正式上限从最终目录推导。

首次进入准备期在领域事务中冻结遭遇和完整掉落计划；已存在plan则复用。计划的revealCondition只能是source-killed或引用已批准政策的approved-guarantee。掉落ID为 `[roundId,encounterId,sourceUnitId,slotOrdinal]` 的canonical tuple；收据ID为 `[dropId,"grant"]`。数量>1的英雄拆成数量1的独立计划条目，禁止一份收据部分授予。保证每条状态可判定，未揭示计划不进UI。

状态机：planned→revealed→granted（实际资源与receipt同提交），或英雄备战席满→pending-capacity；非终局卖出/合并释放空间后，领域成功命令自动按dropId排队入库，无新领取命令，protocol保持2。未清pending-capacity不能Continue，允许准备/结算的既有卖出命令释放空间；gameOver拒绝运营。计划未满足资格在战斗结束→forfeited。击杀揭示不依赖战斗胜利；部分击杀、平局或失败保留已得，不授予未击杀计划。

终局（6-7或玩家HP归零）先处理已揭示金币/装备/可入库英雄；剩余容量受阻英雄→retained-terminal，无receipt、不计已领取、不换金币、无可用动作，从pendingClaims移除，不阻止gameOver。保底计数只按已发LootReceipt，保留奖励不冒充已领取；具体计数类别/阈值等待B1核准。死亡/战斗完成→掉落揭示/授予→经济成长收据→终局判定在同一个Match step提交全部状态和RNG；不靠UI回调补发。

## 10. 版本、恢复、回放

| 字段 | 当前运行 | 冻结的M8目标 |
| --- | --- | --- |
| Match schema | 5 | 6 |
| rulesVersion | m5-14.24b-v1 | m8-14.24b-v1 |
| contentVersion | s13-14.24b-slice-v1 | s13-14.24b-m8-v1 |
| save/replay format | 1/1 | 2/2 |
| commandProtocolVersion | 2 | 2；无新领取命令，公开载荷保持 |
| RNG/tick | lcg32-v1/50ms | 保持，新增流由新rules定义 |
| contentDigest | 现有值 | B9由最终运行内容/规则自动计算，不手填 |

M8A/M8B内部批次不发布短命格式；本次不改旧常量/运行digest。首次接入新运行规则时必须携带开发期规则修订及相应digest，最终B9/B10一次正式切换以上标识；不将新增类型当成旧档可读依据。digest覆盖生效装备、G规则策略、RNG盐/抽样算法、最终日程/遭遇/掉落；仅来源文字/批准记录修正不改变当前运行内容。`No spell critical strikes`只对当前M7仍有效，B3接入技能暴击时必须撤销该简化并升级digest，不在B2假称已撤销实现。

D2-A：M7 format1/schema5只读保全、可原样导出，不在M8恢复或回放，不迁移、不重标版本。新IndexedDB名称冻结为`hex-autobattler-m8`，独立物理schema1；旧库使用原版本只读导出器，不能以新版materialize包装旧内容。M8新局/最近3局淘汰不触碰旧库。文件识别先版本路由，再相应校验；失败保留活动会话、槽、epoch/revision。

新增恢复校验至少覆盖：来源合法性/parent链/唯一key、整数安全范围、半开期限与末跳、nextPulse/余数、同类贡献/有效值一致、每动作次数/ICD/一次标记、各RNG状态与词数、roll组合/pool等级/临时子件对齐、掉落状态/资源收据/保底对齐、完整单调事件及历史归属。禁止恢复时重抽、重触发、重发奖励。有限有理数须0<=remainderNumerator<denominator，denominator>0；不能把任意JSON往返视为验证成功。

回放BattleRecord保留开战前context、tick0 initial、完整events、endTick/nextEventSeq/result/hash；新增版本元数据和roundId选择同版本校验器。重演核对临时装备、status/周期/法力/伤害来源等完整状态，seek/倍速只影响隔离视图。新伤害事件`outcome`载荷及cast.receipt在replay2启用；其余targetChanged/kill/growth/effectTriggered/movement/attack/death/combatFinished沿用现有字段，旧汇总damage/shieldChanged在M8账本不再发，使用逐包/逐层权威事件，B3/B9同步聚合器与验证器；不得静默给旧事件格式换名字。stats分列physical/magic/true HP伤害、盾吸收、actual治疗/overheal；血手不记治疗。40tick保存、100000事件/战、256MiB、最近3局和现有性能门槛保持。

## 11. 后续实现验收入口

B3需要把本文所有手算边界变成实际执行器测试，尤其同tick致死、shield-only、分担、过量、反甲/飓风触发链、重复暴击授权、弱状态恢复、burn末跳与水银末层。B4逐44装备/36配方核对B1，B5实现TG同轮换人不重抽，B9逐tick往返与回放。现阶段6个合同样例和TypeScript负例不替代这些验收。

非装备B1五类缺口、中文正式命名、B-07/B-10历史核验和独立M6-MEM-01均保留；B2不把它们写成完成。不合并、不部署。

## 12. 本次 B2 验证记录

环境：Node24.21.0、npm11.19.0；使用与仓库package-lock完全一致的已有依赖。基线73f1767，验证对象为本次提交前工作树，提交仅封装该内容；未声称新的CI或浏览器验收已经完成。

| 命令/检查 | 结果 |
| --- | --- |
| `npm test -- --maxWorkers=2` | 全量51文件、727项通过，541.02秒；没有跳过或削弱断言 |
| `npm test -- --maxWorkers=2 tests/m8-contracts.test.ts` | 最后样例修订后6项通过；明确仅合同表达/JSON与类型负例 |
| `npm run build` | TypeScript与Vite通过；原有大于500kB chunk提示保留 |
| `python3 scripts/import-m8-source.py --check` | 离线再生成一致，44装备/36配方 |
| `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_import_m8_source.py' -q` | 20项通过；46批准、0待逐项确认，B-07/B-10待核验标志保留 |
| 来源与差异复核 | 44条normalized item记录内容与基线逐项相同；raw未改；git diff --check通过 |

先前两次无最终输出的全量尝试主动中止，不作为通过/失败证据；上述完成运行才是全量结论。未运行B10浏览器/完整性能验收，也未实现B3战斗规则；不以合同样例冒充装备战斗测试。生产运行入口、当前版本和digest均未变，未修改表现层。
