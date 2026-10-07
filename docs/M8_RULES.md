# M8 B2 规则与数据合同（m8-b2-v3-review，审计修订待复审）

修订日期：2026-10-07；复审基线：`feat/m8-b0-baseline@317186b`。撤回上一版“合同已冻结、可直接接入”的签收表述，本版提交复审。
本次只交付类型、合同和可序列化的小样例，**没有实现或启用 B3–B9**。当前程序仍执行 M7/M5 规则及版本。未来实现以本合同、B1 数值归档和逐项来源为依据；未列变更沿用 [M5_RULES.md](../M5_RULES.md) R6。

用户批准原 GS-01–04、TG-01 及审计中的另外41条项目约定，共46条；批准不代表官方脚本证明。B-07 红霸符只启用选定3%增伤、不加射程；B-10 飓风暂用无距离上限，均继续待历史核验。原始 effects、原档 hash 和配方不改；来源再生成不能改变 runtimeEligible=false。归档修正见 [项目约定清单](M8_PROJECT_CONVENTIONS_REVIEW.md)。

类型权威是 `src/simulation/m8/contracts.ts`、`ui-contracts.ts`；它们仅被合同样例引用，没有挂到生产入口。原有 `combat-types.ts/ability-types.ts/strategy-types.ts/match-types.ts` 和 M6 版本常量继续描述当前程序，B3–B9 接入时替换相应边界，不保留两套运行规则源。样例 `tests/m8-contracts.test.ts`、`tests/m8-audit-contracts.test.ts` 和 `tests/m8-ability-contracts.test.ts` 只证明字段、类型限制、手算验收向量和 JSON 往返，不证明装备已战斗生效。

## 1. G01–G12 接口及消费者

所有金额、tick、Bps、序号使用安全整数；非法值须被未来入口/恢复校验器拒绝。类型别名 `number` 不是运行时验证器。Source 复用 CombatOrigin 六字段，另加可空 parentItemInstanceId；永久装备 source.instanceId 是真实实例ID，窃贼子件使用独立 temporaryId，沿 parentItemInstanceId 追溯本体。

| 编号 | 冻结类型 / 输入→结果 | 必需消费者和最小验收 |
| --- | --- | --- |
| G01 | StatModifier、Condition、Amount；属性基数+来源修饰→最终值；maxHpChanged 与 heal 分离 | 巨杀严格>1750；正义501/500/499；狂徒与血手共享生命基数 |
| G02 | DamageRequest/DamageContext→DamageOutcome | 普攻、技能、反甲、飓风、电刀、离子、burn；三伤害类型、盾/HP/过量分列 |
| G03 | CritEligibility、SpellCritAuthorization | 无尽与珠光统一授权；治疗/护盾/装备包绝不因授权暴击 |
| G04 | StatusApplication/Contribution/Group | 灼烧、重伤、减甲/魔抗、免控；弱来源仍保留，到期后能恢复 |
| G05 | PeriodicTask.program→selector + Effect[] | 20tick burn pulse、龙牙、大天使、日炎、救赎；余数、末次、死亡行为可保存 |
| G06 | HealRequest→HealOutcome | 饮血、枪刃、正义共用资格；requested/afterWound/actual/overheal 区分 |
| G07 | ShieldState、SurvivalSample、ShieldEndReason | 饮血、圣盾、冕卫；盾耗尽/到期/死亡清理分开 |
| G08 | ManaRequest→ManaOutcome、CastReceipt | 受击头盔、青龙刀、蓝霸符、离子；actualManaSpent 与 refundedMana 分开 |
| G09 | TriggerDefinition、EffectRuntime→有限 Effect[] | 鬼索、纳什、泰坦、破防者、血手；次数、冷却和幂等标记均入状态 |
| G10 | TargetSelector、RoundDefinition | 六角范围/固定参考点/稳定并列；双方前后排镜像 |
| G11 | untargetable、damage-prevention、cleanse 三个独立 Effect/Status | 夜刃；新选敌、已发包、持续伤害和净化分别判定 |
| G12 | EquipmentRoundRoll、TemporaryEquipment、M8MatchExtension | 窃贼按本体ID+轮次保存组合；转移/重穿/恢复不重抽 |

有限 Effect 包含伤害、属性、状态、治疗、盾、法力、最大生命、技能暴击授权、净化、临时装备和属性转移；现有技能另用有限 AbilityPlan/ActionTask 表达路径、连锁、强化攻击及调度；不提供脚本/回调、任意表达式或复活入口。组合由顺序 Effect[] 表达，例如夜刃为净化→不可选中→完全防止，结束后攻速；完整装备系数仍从 B1 对应字段读取，不复制一份新装备目录。

身份 key 使用 EffectKeyTuple 的 canonical JSON 数组 `[combatId,ownerId,sourceKind,definitionId,instanceId,effectIndex,parentItemInstanceId,targetId,applicationId]`，不拼接无转义分隔符。状态贡献、周期、盾和触发运行态分别命名空间。duration.kind=combat 对应 expiresAtTick=null，不能用0冒充无期限。RNG、余数、计数、已消费标记以及完整事件序号必须保存；恢复不重跑 combatStart。

## 2. GLOBAL-NUMERIC-01：数值及取样

- 导入比例：先规范到四位小数，再转10000分母Bps；百分数点先除100。金额保持整数；秒×20得到仿真tick。不得将原始 `null` 当0。
- 最大生命唯一公式：`floor((baseHp + sum(flatHp)) * (10000 + sum(hpBps)) / 10000)`。组件合成后只计成装字段一次。基础1000＋狂徒600、12%得到1792；再加血手25%得到2192，增加当前生命400，不是1792×1.25。
- AD平加/百分比、AP、攻速和暴击独立来源累加；AD沿用 `(baseAD+flatAD)*(10000+sum(adBps))/10000`。攻速沿用基础每秒攻击×合计Bps，间隔向上取整且至少1tick，不重写正在等待的剩余冷却。暴击率截断到[0,10000]，无溢出转换。
- 百分比减抗同类取强，平坦抗性修饰相加，最终抗性下限0。物理/魔法按抗性→增伤相加→减伤取强的既有顺序逐包取整；普通正伤害最终至少1。相同数值的 hash/命名字段只启用 B1 所选一次。巨杀条件每包读目标当前maxHp。
- 本项目 true 伤害绕过抗性和常规伤害减免（含坚韧），仍受攻击方增伤、完全伤害防止及护盾影响；完全防止为0，不抬到1。burn 的比例金额最终向下取整，低于1可为0；B-02 中立怪上限100在每次 burn pulse 的增伤后封顶，再进入防止/盾。该真伤资格是 B2 项目执行选择，不声称官方语义。
- Amount 先合并 flat、AD/AP/HP、actualManaSpentBps及actualDamageBps项再取整；后两项必须关联完成施法收据或合资格伤害结果，缺上下文时拒绝，不默认为0。周期保留有理数余数：如1001HP的1%每跳为10.01，连续100跳累计1001，不每个仿真tick丢小数。余数以完整任务来源为外层身份，按稳定program效果序号＋实际目标ID分别保存为PeriodicTask.remainders；禁止跨目标、跨效果或跨来源借用。强弱切换不挪用其他来源余数。封顶/完全防止时丢弃超额整数并清除该账户小数，不能作为下一跳欠账；离圈/死亡/结束规则见§15 R1。
- 正义的AD/AP在动作金额取样时、吸血在治疗阶段开始前取样；恰好50%均不翻倍。坚定之心按稳定包序的虚拟当前HP每包前取样，>50%为15%，否则8%；不把动态条件冻结到开战。
- HP百分比比较用整数交叉相乘；任何中间乘积超安全整数界限拒绝，不静默浮点近似。正式 B3 可用 BigInt 中间运算，但持久化仍保存安全整数/有理数分子分母。

## 3. 同 tick 顺序与保命合同

保持50ms、最多1200tick，以及现有同时行动/同时HP提交。动作规划前快照、包内虚拟状态、伤害后存活快照是三个不同边界。根包稳定顺序：tick→来源单位ID（代码点）→actionSeq→targetId→packetOrdinal；派生包保留 rootActionSeq/parentPacketId。需依赖命中结果的子包在父包后、下个根包前插入有限队列，同父按source key/targetId/packetOrdinal排序；不得按子包ownerId把它排到父包之前。仅同步派生包在同一批HP提交前结算。已提交 ActionTask（包括小炮溢出弹射）必须等 executeAtTick，绝不能为清空派生队列而提前执行；详见§13 A02。

1. tick增加，冷却推进。先结算明确的到期末次任务：burn末跳、水银第360tick最后一层、原Darius有限四跳；再移除到期状态/盾，再执行其他到期周期。末跳只读取该任务原有贡献，不给新动作延长状态。大天使在100tick增加AP，参与当tick规划。
2. 现有控制与免控生效；移动，更新光环与主目标计数。到期不可选中结束后重新选敌；新控制不能取消本tick已规划动作。
3. 动作、目标、成本、计数和RNG规划；完成施法生成 CastReceipt，固定位置和返蓝前实际消耗。施法开始可用现有法力，刚获得的法力下一tick才可发新施法。已规划自盾先于本批承伤生效。CastReceipt.targetIds 在本次技能规划完成时保存原目标列表及 targetsSampledAtTick，保留顺序、重复项和空列表；不等后续弹体命中再补写。
4. 收集动作完成的有限触发伤害（飓风/电刀、离子），执行伤害包；受普攻命中的反甲在命中结果出现后排入有限子包队列。用虚拟盾/HP分配吸收和首个致死包。电刀减魔抗在自己的首个电刀包前；轻语在合资格物理包后；破防者额外增伤在触发包后。因此后续包可看到这些数值修饰，已规划动作不撤销。它们是原“新状态下一tick”规则的显式例外，不把所有新控制改为即时。
5. 同步提交本批HP。**饮血、圣盾、夜刃、挑战护手统一读取本批伤害后、治疗前的 SurvivalSample**：本批receivedPositiveDamage（含盾吸收）且hpAfterDamage>0，并且 ≤ 各自阈值；不是只有从阈值上方穿越才触发。先冻结所有资格和 maxHp，再按来源key执行，防止血手改HP让同批饮血资格随槽位变化。每件每场一次，先记录 consumed 再发效果。血手另在开战取初始样本检查一次（这次豁免receivedPositiveDamage）；其余三件只响应伤害。
6. 仍存活者获得阈值盾/净化/属性，再结算已规划直接治疗与合资格吸血。所有同批吸血比例从治疗阶段入口HP快照计算，不能前一个治疗改变同批后一个正义比例。治疗按source key→targetId→packetId结算封顶。死者不复活，死亡来源不自疗，也不经枪刃治疗队友。
7. 幸存者获得法力；记录击杀/助攻/成长。助攻是本场曾对目标造成正实际伤害（盾也计）的来源ownerId集合，无额外时间窗；装备伤害可留归因，不因此获攻击/施法触发资格。
8. 提交普通延迟控制/属性效果，从下一tick生效，完整持续时间从实际startsAtTick计（已生效同源刷新保留原start，期限按本次请求start＋duration延长，详见R4）。清理死亡目标及其可取消任务，更新光环；先消灭判定，再超时。Match处理掉落和结算后一次原子提交。

明确的既有即时例外（不能推广给所有装备）：开战常驻属性/自盾；技能规划阶段蕾欧娜减伤、范德尔双抗/引导、克格莫本场攻速与射程、洛里斯分担及所有既有引导；已有鬼索攻击后成长；维护阶段大天使/水银周期成长及夜刃自然结束奖励；伤后存活阶段已批准的阈值效果。装备包中的电刀/轻语/破防者见步骤4。除此之外普通新控制/属性下一tick生效，**泰坦满层双抗与纳什攻速没有即时豁免**。同一有限效果不得因为在样例helper中省略字段而获得另一套时序。

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

现有技能的独立伤害部分标`requires-spell-authorization`：Irelia结束爆发、Maddie各射击、Darius直伤/流血、Lux附伤、Zyra各包、Tristana主伤、Urgot、Rell线伤、Leona结束伤、Kog附伤、Scar、Ezreal中心/范围、Loris结束伤、Nami各跳、Corki各导弹、Garen伤害、Zoe各跳、Caitlyn各伤害包。Vander强化攻击替换整个普攻包，保持basic-attack/basic暴击，不新增“技能额外包”。其治疗、盾、控制、属性与法力部分never；Tristana继承已减免溢出的弹射不再次暴击，Loris分担也不重掷。B3逐输出点加标签并测试，不改变系数、目标几何或扩大英雄目录。

每个已规划普攻仍消费1词（即使0%/100%）。每个已规划、获授权且非继承结果的技能伤害包消费1词，按actor/action/target/ordinal顺序，AoE各目标独立；未授权不消费技能暴击词。未来多段任务在实际发射时消费，取消的未来段0词；已计划但被防止的伤害不退随机词。攻击附加技能包独立抽取，不共享主攻击结果。暴击判定使用`word*10000 < chanceBps*2^32`，避免先取整损失概率精度；安全整数内精确。

## 7. 法力、区域与夜刃

G08保留普通攻击10蓝、幸存者每tick合计实际HP损失的`min(20,floor(loss*3/100))`，不是每个伤害包都领20。盾吸收不给基础受伤蓝，但头盔明确以持有者incoming-basic-hit加1，每命中一次；青龙刀每完成普攻另5。均受锁蓝/上限/无蓝单位限制。蓝霸符每次完成施法返10，仅本次返蓝绕过锁蓝。无maxMana单位请求applied=0，不制造资源；overflow、blocked分别记录。

G08兼容边界：首次施法效果提交即视为完成施法，后续多段发射不是新施法。撤回v1强加的常规[t,t+1)锁蓝：现有技能没有该通用锁，同tick伤后回蓝仍按旧管线处理；正常 lockedUntilTick 不晚于当前tick。有明确来源的锁才拦截普通回蓝，本次蓝霸符 cast-refund 可绕过该锁；仍不允许同动作递归二次施法。引导阻止再次施法与“不能获得法力”是不同限制。

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

新增恢复校验至少覆盖：来源合法性/parent链/唯一key、整数安全范围、半开期限与末跳、nextPulse/余数、同类贡献/有效值一致、每动作次数/ICD/一次标记、各RNG状态与词数、roll组合/pool等级/临时子件对齐、掉落状态/资源收据/保底对齐、完整单调事件及历史归属。禁止恢复时重抽、重触发、重发奖励。周期账户须按[effectIndex,targetId]唯一、完整任务来源一致，0<=numerator<denominator且denominator>0，效果必须是冻结程序中的金额效果、目标必须属于本战斗；不能把任意JSON往返视为验证成功。

回放BattleRecord保留开战前context、tick0 initial、完整events、endTick/nextEventSeq/result/hash；新增版本元数据和roundId选择同版本校验器。重演核对临时装备、status/周期/法力/伤害来源等完整状态，seek/倍速只影响隔离视图。新伤害事件`outcome`载荷及cast.receipt在replay2启用；其余targetChanged/kill/growth/effectTriggered/movement/attack/death/combatFinished沿用现有字段，旧汇总damage/shieldChanged在M8账本不再发，使用逐包/逐层权威事件，B3/B9同步聚合器与验证器；不得静默给旧事件格式换名字。stats分列physical/magic/true HP伤害、盾吸收、actual治疗/overheal；血手不记治疗。40tick保存、100000事件/战、256MiB、最近3局和现有性能门槛保持。

## 11. 后续实现验收入口

B3需要把本文所有手算边界变成实际执行器测试，尤其同tick致死、shield-only、分担、过量、反甲/飓风触发链、重复暴击授权、弱状态恢复、burn末跳与水银末层。B4逐44装备/36配方核对B1，B5实现TG同轮换人不重抽，B9逐tick往返与回放。现阶段合同样例和TypeScript负例不替代这些验收；13项修订与19技能覆盖见§13–14。

非装备B1五类缺口、中文正式命名、B-07/B-10历史核验和独立M6-MEM-01均保留；B2不把它们写成完成。不合并、不部署。

## 12. 验证记录

以下表格是上一版0759c4b的历史记录，不能作为本次审计修订通过的证据。各轮验证记录分开标注，本次R1–R4结果见文末。环境：Node24.21.0、npm11.19.0；使用与仓库package-lock完全一致的已有依赖。

| 命令/检查 | 结果 |
| --- | --- |
| `npm test -- --maxWorkers=2` | 全量51文件、727项通过，541.02秒；没有跳过或削弱断言 |
| `npm test -- --maxWorkers=2 tests/m8-contracts.test.ts` | 最后样例修订后6项通过；明确仅合同表达/JSON与类型负例 |
| `npm run build` | TypeScript与Vite通过；原有大于500kB chunk提示保留 |
| `python3 scripts/import-m8-source.py --check` | 离线再生成一致，44装备/36配方 |
| `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_import_m8_source.py' -q` | 20项通过；46批准、0待逐项确认，B-07/B-10待核验标志保留 |
| 来源与差异复核 | 44条normalized item记录内容与基线逐项相同；raw未改；git diff --check通过 |

先前两次无最终输出的全量尝试主动中止，不作为通过/失败证据；上述完成运行才是0759c4b的全量结论。未运行B10浏览器/完整性能验收，也未实现B3战斗规则；不以合同样例冒充装备战斗测试。生产运行入口、当前版本和digest均未变，未修改表现层。


上一轮317186b审计修订的历史验证（不是本次R1–R4的验证结果）：

| 命令/检查 | 本次结果 |
| --- | --- |
| `npm test -- --maxWorkers=2` | 53文件、762项全量通过，470.37秒；未改既有战斗断言 |
| `npm test -- --maxWorkers=2 tests/m8-contracts.test.ts tests/m8-audit-contracts.test.ts tests/m8-ability-contracts.test.ts` | 最终合同字段及样例修订后40项通过，含13项审计例和19英雄目录覆盖；789ms |
| `npm run build` | 最终类型/样例工作树TypeScript与Vite通过；Vite7.61秒，保留既有chunk大小提示 |
| `git diff --check` / 生产范围 | 通过；生产差异仅m8目录类型声明，无执行器/表现层/内容/版本常量/digest变化 |

全量运行期间补全的末轮合同字段/样例另经上述40项定向检查及最终build覆盖。B3实际战斗效果、B9旧档导出实现及B10浏览器验收仍未进行；不以本次通过代替复审或运行接入签收。

## 13. A01–A13 审计修订与合同样例

本节规定类型字段的校验和执行语义；**未提供执行器**。逐项可编译数据、独立手算预期和恢复样例见 `tests/m8-audit-contracts.test.ts` 同编号测试；完整19技能计划见 `tests/fixtures/m8-ability-plans.ts`。不允许按装备名字补足缺失的触发、过滤、选敌或幅度语义。

| 审计项 | 主修改位置（类型符号） | 样例位置 |
| --- | --- | --- |
| A01 来源不碰撞 | contracts.ts: EffectKeyTuple / EffectIdentity | m8-audit-contracts.test.ts A01 |
| A02 已减免金额与延迟弹射 | contracts.ts: DamageInput / ActionTask | A02；m8-ability-contracts.test.ts tristana |
| A03 盾衰减 | contracts.ts: ShieldDecayPolicy / ShieldDecayState / ShieldState / grant-shield / shieldLayerChanged | A03；irelia |
| A04 每N次与满层奖励 | contracts.ts: CounterDefinition / TriggerGate / EffectRuntime | A04；kogmaw |
| A05 事件施法者绑定 | contracts.ts: TriggerContext / TriggerListener / TargetSelector | A05 |
| A06 状态自然结束奖励 | contracts.ts: StatusEndEffects / StatusContribution | A06 |
| A07 周期完整动态程序 | contracts.ts: PeriodicProgram / PeriodicTask | A07 |
| A08 每包减伤过滤 | contracts.ts: DamageFilter / StatModifier / StatusApplication | A08 |
| A09 当前人数缩放 | contracts.ts: ModifierValue.unit-count | A09 |
| A10 治疗多来源归属 | contracts.ts: HealContribution / HealShare / HealOutcome；ui-contracts.ts: CombatStatsView | A10；UI合同U4 |
| A11 权威施法目标 | contracts.ts: CastReceipt / M8CombatEvent.cast | A11；maddie；UI合同U4 |
| A12 六角射程 | contracts.ts: Stat / StatModifier / M8CombatEvent.statChanged | A12；kogmaw；UI合同U4 |
| A13 旧记录选择导出 | ui-contracts.ts: LegacyRecordRef / LegacyRecordAccess / M8SaveControlsCallbacks | A13；UI合同U7 |

### A01 完整来源身份

EffectKeyTuple 的九项逐一匹配 Source、目标及施加身份。effectIndex由冻结定义中有限效果树的稳定展开序号给出，状态序列中的不同效果不能共用一个序号；applicationId 为持续的同源效果用固定 `source`，同技能独立施法用 actionSeq（属性转移再绑定受害目标）；同施法独立多段修饰用canonical [actionSeq,task.ordinal,targetId]作为applicationId，不得用数组索引或本地显示名。恢复须重新编码并对比 key；不同命名空间可重用key，同一命名空间不同来源不得合并，重复完整key须遵循其 StackPolicy，否则拒绝。

2哨兵和2法师同享目标u1，instanceId均为player:2、effectIndex均为0：
`["c1","u1","trait","sentinel-2","player:2",0,null,"u1","source"]` 与
`["c1","u1","trait","sorcerer-2","player:2",0,null,"u1","source"]` 不相等。改变ownerId或applicationId也必须产生不同key。

### A02 继承已减免伤害与下一tick队列

DamageInput 是互斥联合：raw进入系数→暴击→抗性→增减伤；after-mitigation携带非负整数、父packetId、父结算tick、overkill/redirect-share及已判暴击事实，跳过上述所有阶段。保留原damageType/delivery/source，不能伪装true伤害。继承包仍检查到达时伤害防止、合法的一次分担、护盾与HP。outcome.raw记录本包入口金额（继承包即继承整数），不重复累计父包raw；critical沿继承事实，绝不再抽暴击词。恢复验证两个parentPacketId一致、父包存在、金额与父overkill/分担份额相符、时间合法及equipmentDepth不提升资格。

小炮tick10主包减免后150，目标A仅100HP且无盾：hpDamage100、overkill50，死亡提交后A死亡。该动作首次合法溢出在提交时冻结后继B，创建executeAtTick=11、onSourceDeath=persist、onControl=continue的ActionTask，并立即记录125Bps成长（已有行为），每动作最多一次；无合法B则既不建任务也不成长。tick10不对B结算。tick11 B有100护甲、20盾、100HP：继承物理50直接吸盾20、扣HP30，HP70；不是再次减为25。父包身份保留且mayCreateOverkill=false，不递归弹射；B死去则skip，不重选、不回滚已发成长。475继承包遇Loris合法分担仍为238/237，不能重复减免或再分担。

### A03 自然衰减盾

grant-shield声明decay及endTiming/endTargeting/endEffects；ShieldState保存basisGranted/grantedAtTick/durationTicks/lastDecayAtTick及累计decayed、absorbed、expiredDiscarded。持续时间D内累计应自然减少量为floor(basisGranted×elapsed/D)，本tick损失为相邻累计值差与remaining的较小者；到期未耗尽余量记expiredDiscarded。每层满足granted=remaining+absorbed+decayed+expiredDiscarded。自然减少发shieldLayerChanged(reason=decayed)，只增加decayed，不增加absorbed；终止时另发depleted或expired。零盾层在结束任务消费前保留。

600盾/60tick：无伤tick10 remaining500、decayed100、absorbed0；此后实际承伤120，remaining380、absorbed120。保存恢复后tick11继续减10，remaining370、decayed110、absorbed仍120。结束伤害中的shieldAbsorbedBps=3000只得到额外36，不把自然损失110计入。效果定义及结束选敌随AbilityPlan保存，恢复需验证盾key能唯一关联授盾定义；已消费标记不能丢失。

兼容刀妹：无伤到期结束与提前耗尽均可触发，但结束任务在next-action-planning检查。伤害阶段耗尽→下一tick规划；维护阶段自然归零→本tick规划。源死亡/战斗清理不给爆发。同源重授盾沿旧行为取max(新盾,旧remaining)、较晚到期，重设衰减基数/时点和absorbed=0，替换旧结束任务；不能把旧盾承伤再次带入奖励。

### A04 通用计数、everyN与满层奖励

CounterDefinition指定计数事件、每事件listener、资格、source-instance范围、combat-start重置和cap。计数身份为canonical [combatId,ownerId,sourceKind,definitionId,instanceId,parentItemInstanceId,counterId]，同实例跨effectIndex共享一个命名计数，其唯一声明者的EffectRuntime保存权威值；ModifierValue.counter按该实例身份引用，不另复制计数。同一TriggerContext.eventSeq对该计数只增一次（共享声明先校验一致），不因多目标效果重复计数。先计数，再检查gate，计数与奖励消费同事务保存；counter-updated派生事件的actorId与targetId均为计数所属持有者，cast=null；取消事件不计数，达到cap后的事件不增数也不再发counter-updated。every-n满足count>=firstAt且(count-firstAt)%everyN=0；ICD或无目标不会回退计数，不积攒补发。每次新Combat归零，读档不归零。

电刀attacks监听本人attack-completed（完成但被格挡也计），cap=null、firstAt=3/everyN=3。攻击1/2/3/4/5/6的计数分别1/2/3/4/5/6，发效果为否/否/是/否/否/是。selector.primary=first-required先加入仍合法的主目标，再以主目标为距离参照选至多3个其他不同目标；主目标失效整次跳过。固定集合上每目标先立即施加3000Bps shred100tick，再35魔伤。

泰坦同一实例stacks计本人完成攻击和本人受到正实际伤害，cap25；ModifierValue.counter表达每层200Bps AD及2AP。counter-updated的stack-threshold-once(at25,rewardId=cap-resists)发双抗20至本场，先存consumedRewards。第24/25/26次合资格事件：层数24/25/25，AD4800/5000/5000Bps，AP48/50/50，新增双抗奖励请求0/20/0，奖励下一tick生效，不能保护同批后续包（R4）。读档保留25及消费标记，不重发；多件分别计数。

### A05 事件主体、目标与施法收据绑定

TriggerContext.actorId是事件发起者，targetId是该事件承受者（可空）；cast-completed必须有匹配actor/actionSeq/tick的CastReceipt，其他事件cast=null。listener先以subject指定actor或target，按相对持有者敌我/六角距离过滤；完成施法用receipt.completionCell，不用后来移动位置。self精确匹配ownerId；ally含自身，enemy不含友军。selector.candidates=event-actor/event-target只产生该事件的唯一主体候选，之后过滤，不能退回全棋盘；空target则空集。actualManaSpentBps读取这一收据，DamageContext保存其actionSeq。

持有者(3,4)，A(3,3)未施法，B(3,2)完成耗蓝80：离子监听actor/enemy/withinHexes2，选择event-actor B，仅B获得80×160%=128原始魔伤；更近A不是候选。纳什监听actor/self且选self，只在持有者自己的完成施法时请求6000Bps攻速100tick，下一tick生效，同件刷新、不叠加（R4）。两者不共享“附近敌人任选”的选择器，也无需装备名分支。

### A06 有限状态结束效果

StatusApplication.onEnd附在一个明确的状态贡献key上，StatusContribution.endRewardConsumed随存档保存。结束时仅允许声明reasons的效果，先标消费再发；被替换/净化/死亡/战斗清理不能冒充自然expired。状态结束效果作用于该贡献targetId，并保留原source，不能无来源发属性。

夜刃阈值触发tick10：立即净化→不可选中→伤害防止，两个状态到期30，只有damage-prevention的onEnd绑定expired奖励1500Bps攻速至本场；另一个onEnd=null。tick10、29攻速奖励0，tick30维护时结束、消费标记=true、奖励1500，再开始动作。tick29保存恢复在30只发一次；tick30已消费记录恢复不得补发。tick20死亡或战斗结束清理均奖励0，即使稍后经过30也不再支付。

### A07 周期程序、动态选区与完整序列

PeriodicTask.program包含冻结definitionId、selector与有序effects[]，targetSnapshot=once-per-pulse。每次到期先选一次存活合法目标集，按稳定序对每目标执行完整序列；不能治疗一次选敌、坚韧再选敌。每跳的Amount.sample=each-pulse在该跳入口取样。任务targetId对持有者时钟是持有者，不限制program的动态多目标；对burn附着时钟则为受害者且候选bound-target。恢复保存整个程序、相位和按实际目标/金额效果分开的remainders，并校验与冻结内容一致（R1）。

救赎period100，首次100；selector ally/holder/radius1/includeSelf，先治疗缺血15%上限1000再施加坚韧1000Bps100tick。99时B入圈、C在圈外，100的集合[u1,B]；199时B出圈、C入圈，200的集合[u1,C]。B离圈不撤销100施加的状态，其101起至201前有效；200不再给B治疗/续期。若来源150死亡，onSourceDeath=cancel阻止200及以后pulse，已施加于B的状态仍存续至201；死亡清理不追溯撤销别人的附着状态。多件救赎各自时钟与治疗，坚韧贡献仍按同类取强。

### A08 每包适用的减伤过滤

StatModifier.damageFilter及StatusApplication.damageFilter仅用于减伤贡献（其他效果必须null）；减伤必须显式填写DamageFilter。先按delivery/damageType/redirected及Condition筛选本包适用贡献，再在适用项中取强，不能先全局取强再过滤。true和after-mitigation按其管线绕过常规减伤。

反甲800Bps贡献filter={deliveries:[basic-attack],damageTypes:[physical,magic],redirected:exclude}。无其他减伤时，进入减伤阶段的普攻100→92，电刀equipment-proc35→35；不能将电刀变32，也不能用事后incoming-basic-hit修改父包。状态组effectiveMagnitude只是无包上下文的展示摘要，不得直接作为所有包的减免值。

### A09 当前单位计数缩放属性

ModifierValue.unit-count的population=alive-enemies-targeting-holder，perUnit=10、sample=current、distinctBy=unitId；对armor和magicResist各一份修饰。仅计当前主目标为持有者的存活敌人，每单位一次，不把副弹目标、同一单位多个来源或重复数组项重复计数。选敌改变、死亡提交后、下个属性读数前即时重算和撤回；恢复从权威单位/主目标校验计数，不能用累计触发层代替。

一件石像鬼固定双抗25加动态10×N：锁定者3→2→0时为55→45→25；双件独立来源分别同样变化，合计110→90→50。无目标者、友军、死者均不贡献。此动态幅度通用，不识别gargoyle字符串执行特判。

### A10 一次HP修改、完整多来源治疗归属

HealRequest用healId和contributions[]替代单source；每项保存完整Source及精确有理数numerator/denominator（治疗金额，非Bps），同source合并。先按来源精确金额求和向下取整得到requested，再整体重伤floor(requested×(10000-wound)/10000)得afterWound，最后按缺血封顶得actual；overheal=afterWound-actual。只修改HP一次。

领域归属分配规则：requested按精确贡献权重分配，afterWound按各来源requested整数权重分配，actual按各来源afterWound整数权重分配。每步先向下取整，剩余整数按小数余数从大到小分给来源，并列按canonical Source tuple代码点顺序；0总权重则全部0，不除0。各share.preventedByWound=requested-afterWound，share.overheal=afterWound-actual。各项非负、每项和等于总项，shares来源必须与contributions完全对应。恢复必须验证分配，UI只读shares，不自行反算或制造多条HP修改。

100合资格伤害，饮血20%、枪刃15%，请求合计35、缺血20：饮血requested20/actual11/overheal9，枪刃15/9/6，总actual20/overheal15。再有33%重伤：总35→23→20，分项afterWound13/10、actual11/9、overheal2/1、prevented7/5；合计分别23/20/3/12。分配取整只影响归属，不改变总治疗。

### A11 权威施法目标

CastReceipt.targetIds在本次技能规划完成、后续伤害解析前采样，targetsSampledAtTick记该时点；列表保留现有规划器返回顺序、重复项和空项语义（空列表合法，不含空ID）。麦迪tick10选远处A，receipt.targetIds=[A]；同tick射线先碰B，DamageContext.targetId=B，两者actionSeq关联但目标不覆盖。后续A死亡可按技能规定重选射击目标，不能改写原cast事件。UI展示选中A、命中B，禁止从普攻目标或伤害事件反推施法选敌。

### A12 六角射程属性与事件

旧statChanged的attackSpeedBps映射为新attackSpeed，before/after仍用Bps，不变成每秒攻击数；abilityPower原名原单位保留。Stat.range与旧statChanged.stat='range'一对一映射，StatModifier.unit=hexes，正整数格数；不能改成像素或借用攻速字段。克格莫每第三次完成施法通过every-n(casts,3,3)发range+1至本场：第三次施法前3→后4，领域发statChanged{stat:range,before:3,after:4,source}；UI直接消费事件，不计施法次数补造。每次施法攻速、普攻魔伤被动仍分别表达，不混成一次范围事件。

### A13 旧记录选择及导出

U7使用LegacyRecordAccess.listLegacyRecords()/exportLegacy(request)，稳定LegacyRecordRef、成功/失败分支及回调见 [M8_UI_CONTRACT.md §6](M8_UI_CONTRACT.md#6-保存与回放能力)。合同样例同时保留new-m8活动局，选择old-run/fingerprint=old-content历史记录；导出响应必须带原requestId和recordRef，成功返回旧format1字节，失败stale-reference明确归属所选旧记录，活动局revision9保持不变。禁止退回无参数onExport而误导出当前M8局。B9负责实现。

## 14. 现有19技能表达自查

初版机制名录及代表性字段检查如下；这不是“完整行为等价”证明。复审发现并修正的排序遗漏、直接调用旧代码的验收向量见§15 R2。逐项对照现有 `combat-s13-abilities.ts`、`combat-s13.ts`、`combat-s13-state.ts` 及内容目录；不修改这些生产文件。下面的代表性已取样数据是机制样例，不是第二套星级/平衡数值目录。实际数值及星级继续从原内容取样。`tests/m8-ability-contracts.test.ts`校验目录19项完整覆盖，并逐项断言特有机制。

AbilityPlan保留施法收据、取样数据、有限operations/triggers；ActionTask记录绝对执行tick、source/actionSeq/ordinal、消费标记、取消规则及replaceGroup。replaceGroup非空时同组新计划替换尚未执行的旧任务。到期任务仅执行一次，保存恢复不再创建/重排任务。task.targeting每次执行选一次，payload内bound-selection引用该集合/中心，不能二次选敌或抽RNG；非任务中的选区在该operation规划时固定。无嵌套schedule。ArmedAttack同来源新授予覆盖尚未消费的一次强化，不叠加额外攻击；控制结束引导但不清除已授予的强化。源死亡/战斗清理移除强化。除明确persist的已提交任务外来源死亡不产生新效果。当前19技能的控制、路径与引导取消语义沿旧规则；新增装备技能暴击授权是已批准的独立M8变更，不改变技能系数、目标、阶段或任务时间。

| 英雄 | 合同组合与必须保留的既有行为 |
| --- | --- |
| 刀妹 | 线性衰减盾60tick；真实吸收独立；耗尽/到期下一规划阶段近身爆发，参见A03 |
| 麦迪 | 最远选中目标，path首个敌人拦截；24tick引导，射击偏移0/4/9/13/18/23；原目标失效再选最远，控制/死亡取消未来段 |
| 德莱厄斯 | 近身范围物理+自疗；主目标有限流血20/40/60/80，源死亡/控制不取消；101分成26/25/25/25，同源同目标新施法替换旧跳组 |
| 拉克丝 | 绝对HP升序→距持有者距离升序→ID升序的友军（含自己）80tick盾；ArmedAttack追加下一次普攻魔法包，一次消费 |
| 婕拉 | 主目标魔伤和20tick控制；另2个按距持有者选，excludePrimary，保留列表顺序 |
| 崔丝塔娜 | 物理主包；继承溢出下一tick固定目标、不递归、每动作一次，提交弹射时成长，参见A02 |
| 厄加特 | 主目标与其1格副目标物理伤害、2000Bps减甲120tick，减甲下一tick激活 |
| 芮尔 | 自盾+路径所有敌人魔伤；transfer-stat双抗10（星级取样），1200tick、下一tick生效；action-target身份，敌人死亡不撤回持有者正收益 |
| 蕾欧娜 | 即时减伤60tick；独立结束任务近身爆发，同源替换，控制不取消、死亡取消 |
| 范德尔 | 50tick引导及即时双抗；冻结低费友军数；下一次强化攻击替换整个普攻并用普攻暴击，消费前阻止再施法 |
| 克格莫 | 被动普攻额外魔伤；每次施法2500Bps攻速，本场累计；每3次range+1hex，参见A12 |
| 斯卡 | 最近3敌魔伤和眩晕30tick（第三星35），并自疗 |
| 伊泽瑞尔 | 主目标1格范围包与主目标追加包分列，目标列表允许主目标重复 |
| 洛里斯 | 80tick盾/1格50%分担，保护者最低ID，一次分担不重减伤；80tick后以当时最近敌为中心1格爆发，盾提前耗尽不提前爆发 |
| 娜美 | 主目标再3跳，每次以上一目标为中心3格取最近未命中者，无重复 |
| 库奇 | 21/21/35导弹，偏移n；原冻结瞄准目标优先＋其2格内其余敌人ID升序轮转，原目标失效才按持有者距离→ID回退；每第7颗×7，下一tick仅平减护甲1/7，持续1200tick |
| 盖伦 | AP+自身HP盾；主目标和2格副目标物理；按owner/action聚合positive-hp-damage，仍存活才自疗一次，仅打盾不给自疗 |
| 佐伊 | 主目标→距主目标4格内最远未命中者→返回主目标，循环2（第三星4）次，保留重复主目标 |
| 凯特琳 | 100tick引导、4/4/20射击，偏移floor(n×100/总数)；每发1战斗词按word%存活敌ID排序列表选中心，1格范围+中心额外包共用中心，中心AD在发射时取样，双抗负修饰下一tick生效 |

原凯特琳中心选择仍用现有modulo映射，不受§8“新增流拒绝采样”替换；每发中心只消费1词。AbilityTargeting.chain的nearest-previous逐跳更新参照；farthest-from-primary-return-primary固定参照，副目标去重但主目标允许每次返回。有限目标枚举不依据英雄名分支决定这些规则。


## 15. 317186b复审修订 R1–R4（待复审）

修改索引：R1 `PeriodicRemainder/PeriodicTask`；R2 `TargetSelector/AbilityTargeting/AbilityOperation` 与19计划；R3 `CombatActivity/M8CombatEvent.activityChanged/M8CombatExtension.activities`、UI `CombatStatusesView`；R4 `Effect.modify-stat.stackPolicy` 与装备/英雄声明样例。字段位于 `src/simulation/m8/contracts.ts` 和 `ui-contracts.ts`；本节是执行语义，验收数据位于 `tests/m8-rereview-contracts.test.ts`、`m8-target-order-contracts.test.ts`、`m8-effect-policy-contracts.test.ts`。没有新增M8战斗执行器。

### R1 每个金额效果、每个实际目标独立余数

PeriodicTask移除单一remainderNumerator/Denominator，改为remainders[]：每项effectIndex是冻结program.effects数组中的稳定零起始序号（区别于外层Source.effectIndex），targetId为本跳实际受益/承伤者，numerator/denominator保存小数。完整身份为[task.key,effectIndex,targetId]；救赎外层targetId仍是持有者，不能用它代替受益者。program.effects顺序在同版本不可重排；同一效果不能因目标排序变化改变序号。嵌套结束效果属于其独立生命周期，不挤占当前周期账户。

每跳先一次性取样目标集合及金额基数，对每个金额效果/实际目标计算“本跳精确金额＋自己已有余数”，取整数请求并保存小数，再做金额cap/治疗重伤/HP封顶等阶段。适用范围仍包含周期治疗与周期伤害，不默默缩窄为仅burn。顺序或输入数组置换不得影响各账户。

| 边界 | 账户政策 |
| --- | --- |
| 目标暂时离圈或本跳不合资格 | 保留已有小数，不积累漏过的跳数；再入圈只接自己的余数 |
| 新目标入圈 | 缺省0；禁止继承刚离圈者或其他效果的余数 |
| 目标死亡 | 删除此任务中该targetId的全部效果账户；本合同无复活，不重用单位ID |
| 来源死亡 | onSourceDeath=cancel的任务与全部账户一起清理；persist-attached按原目标继续 |
| 效果/任务结束、移除或战斗清理 | 删除相应效果或全部任务账户，不结算未来跳；到期末跳先结算再清理 |
| 同源刷新并保留phase | 同冻结program的同账户保留；不同程序不能把旧账户迁移过去 |
| Amount.cap、治疗缺血上限或完全防止丢弃金额 | 清除此账户余数；包括取样缺血0的治疗，避免以后出现欠账治疗 |
| 重伤 | 对整数请求统一处理；它本身不把别人的余数转入，也不产生补偿余额 |

封顶示例：1000.15请求在cap1000时最终请求1000且余数0；已有0.15余数的满血目标在下次pulse取样缺血0时清零。若只是离圈，0.15保留。被压制burn来源的账户继续按§5休眠，其他来源不能取走它；强者消失后的下一有效跳才继续自己的余额。

双目标救赎，没有其他伤害/治疗/重伤：

| tick | 跳前缺血A/B | 入账前余数A/B | 整数治疗A/B | 保存余数A/B |
| --- | --- | --- | --- | --- |
| 100 | 1 / 9 | 0 / 0 | 0 / 1 | 1500/10000 / 3500/10000 |
| 200 | 1 / 8 | 1500 / 3500（分母均10000） | 0 / 1 | 3000 / 5500 |
| 300 | 1 / 7 | 3000 / 5500 | 0 / 1 | 4500 / 6000 |

200后保存恢复，第三跳仍为0/1。若A在200离圈、C进入，则A停在1500，B变5500，C从0到1500；300时A返回，缺血仍1，只得到0治疗、余数3000。B死亡只清B，不能转给A/C。一个程序里第二个治疗效果若有25%系数，同目标A可同时保存[effect0,A,1500/10000]和[effect1,A,2500/10000]。

恢复验证：不得有重复[effectIndex,targetId]，不得有越界/已删除/非金额效果的序号、陌生或死亡目标、跨task/source账户，分子分母须为安全整数且0<=分子<分母、分母>0；必须与冻结程序及事件/检查点历史一致。目标当前离圈不构成拒绝理由。JSON往返样例只证明数据可保存，不冒充上述校验器已实现。

### R2 全19英雄选敌排序复核

公共前提：advanceS13Tick在进入技能规划前将单位按唯一ID代码点升序排列；主目标为持有者六角距离升序→ID升序，无HP键、行列键或第三隐含键。技能对该单位数组filter而不sort时，结果就是ID升序，不能改成距离优先。ID唯一使最后键不再并列。直接测试旧planS13Cast时必须提供这一前置排序，不能把任意数组顺序误说成旧规则。

TargetSelector.hp-absolute-distance-id明确定义绝对HP升序→距anchor（拉克丝为holder）六角距离升序→ID升序；distance-id是距离升序→ID升序，farthest-id是距离降序→ID升序，绝不把整个结果反转。id只有一个升序键；不存在未列的第二/第三键。技能附着固定目标失效时的skip或fallback按下面逐项规定，不借用当前普攻目标。

| 英雄 | 完整选择、并列键与输出顺序 | 旧依据 |
| --- | --- | --- |
| 刀妹 | 自盾self无排序；结束近身1格集合按ID升序 | planS13Cast irelia；executeTask ireliaEnd；neighborsOf |
| 麦迪 | 开始及失效后重选：持有者距离降序→ID升序；固定路径上最先遇到的敌人，非距终点最近 | planS13Cast maddie；executeTask maddie；byDistance/path |
| 诺手 | 近身集合ID升序；自疗self；流血冻结原主目标，失效skip，不重选 | planS13Cast darius；executeTask bleed；neighborsOf |
| 拉克丝 | 存活同队含自己，绝对HP升序→距施法者距离升序→ID升序；附伤沿下一次普攻目标 | lowestAlly(current=true)；planS13Attack |
| 婕拉 | 主目标先；排除主目标的副目标按距持有者升序→ID升序取2个 | planS13Cast zyra |
| 小炮 | 主包原主目标；溢出候选须虚拟HP>0，按距被击杀者距离升序→ID升序选1，冻结后失效skip | combat-s13.ts ricochetActions分支 |
| 厄加特 | 原主目标为中心1格全体ID升序，主目标没有输出优先权；primary-and-area按身份选主/副幅度 | planS13Cast urgot |
| 芮尔 | 自盾先；路径成员按ID升序输出全部，不是沿路径顺序输出 | planS13Cast rell |
| 蕾欧娜 | 施法列表为空；结束近身1格集合ID升序 | planS13Cast leona；executeTask leonaEnd |
| 范德尔 | 施法列表self；强化普攻消费时当前主目标（距离升序→ID升序） | planS13Cast vander；planS13Attack |
| 克格莫 | 施法列表self；普攻附伤沿同次普攻目标（距离升序→ID升序） | planS13Cast kogmaw；planS13Attack |
| 斯卡 | 距持有者距离升序→ID升序取3，自疗self不加入伤害目标列表 | planS13Cast scar |
| 伊泽瑞尔 | 主目标中心1格集合ID升序，再追加原主目标一次，允许目标ID重复 | planS13Cast ezreal |
| 洛里斯 | 施法self；结束中心按当时距持有者距离升序→ID升序，范围成员ID升序；分担保护者只按ID升序，无距离次级优先 | executeTask lorisEnd；combat-s13.ts protector |
| 娜美 | 主目标先；每跳距上一命中者距离升序→ID升序，从3格内未命中者取1 | planS13Cast nami |
| 库奇 | 固定施法瞄准目标存活则保持；否则按距持有者升序→ID升序回退；choices=[瞄准目标,其2格内其余敌人ID升序]，ordinal取模，不能把瞄准目标也参与ID排序 | executeTask corki |
| 盖伦 | 自盾先；原主目标中心2格全体ID升序；primary-and-area按身份分幅度，不把主目标强行提前 | planS13Cast garen |
| 佐伊 | 原主目标→距原主目标最远未命中者（距离降序→ID升序）→原主目标；重复，副目标去重 | planS13Cast zoe |
| 凯特琳 | cast列表保留原主目标；每射击存活敌ID升序表word%count选中心，中心1格范围ID升序，再追加中心；不额外按距离排序或抽词 | executeTask caitlyn |

路径的第二层确定性来自board.getNeighbors固定E、SE、SW、W、NW、NE；每步取第一个严格靠近终点的合法邻格，不因占用绕路。麦迪按路径位置取首敌（每格唯一单位，无ID并列）；芮尔先判成员再ID升序。AbilityTargeting.path显式保存pathOrder/hitOrder；chain显式tieBreak=id，random-enemy-center显式areaOrder=id，area-around-selected显式order=id。新增primary-and-area在同一ID有序集合中按primaryId选效果序列，修正前版把厄加特/盖伦主目标总是置前的样例。

拉克丝反例验收：自己900HP，A100HP距2，B100HP距1，C100HP距1且B<C，则选B；颠倒输入仍选B。自己降为100HP时因距离0选自己，99HP时也选自己。该向量直接调用旧lowestAlly，合同同时断言hp-absolute-distance-id，避免只验枚举名。

全19旧代码向量使用持有者U(3,4)，敌A(5,4)、B(4,4)、C(3,3)、D(2,4)、E(1,4)：最近序B/C/D/A/E，最远序A/E/B/C/D；普通主目标B。厄加特cast A/B/C，盖伦U/A/B/C/D，伊泽瑞尔A/B/C/B，娜美B/A/C/D，佐伊B/E/B/D/B。芮尔若瞄准A，路径是B→A但cast为U/A/B；麦迪同一路径命中B。库奇前四发B/A/C/D，B死亡后回退C；凯特琳词0的伤害目标A/B/A。测试对全部19项逐一列出独立目标预期，并检查合同中的排序声明，不声称已经跑过尚不存在的M8执行器。

### R3 引导与分担的领域状态、事件、恢复

AbilityOperation.channel/redirect只是创建操作，成功提交必须产生独立CombatActivity：完整EffectIdentity、actionSeq、startsAtTick、expiresAtTick，以及channel的blocks/cancelOnControl或redirect的范围/比例/选择/非递归规则。每个活动key绑定施法身份；生命周期为active（endedAtTick/endReason为null）或ended（记录实际结束tick和原因）。M8CombatExtension.activities持久化这些记录；后续同来源施法以新actionSeq建立身份，旧记录标replaced，不把旧引导“复活”。

新增M8CombatEvent.activityChanged，payload为权威记录，reason=applied/refreshed或expired/control-cancelled/replaced/death-cleanup/combat-end。reason与lifecycle/endReason必须一致；control-cancelled仅适用于channel，控制不暂停或移除redirect；自然到期endedAtTick=expiresAtTick，提前结束不得晚于计划到期。事件仍有domain/combatId/tick/eventSeq，作用于活动targetId；UI不重新评估控制或区域资格。旧M7的statusChanged(channel/redirect)在新B3产生状态时明确映射为对应activityChanged(applied/expired)，并绑定该次施法actionSeq；这是新版本映射，不是对旧档补造字段。旧实现没有控制取消事件，本合同的control-cancelled是未来M8账本新增事实，不宣称旧事件已存在。

readCombatStatuses返回CombatStatusesView={statuses:StatusGroup[],activities:ActiveCombatActivity[]}；只有领域已判定仍有效的active条目，ended只保留在持久态/事件账本，不进入当前投影。恢复须校验活动来源、施法收据、半开期限及结束记录与事件/检查点一致；恢复不从AbilityPlan重建已取消活动、不重跑取消规则、也不重新开始引导。缺少权威活动态不能靠计划期限“修复”为active。

范德尔tick10引导，期限[10,60)；tick20眩晕已生效（至40）时，活动标ended/endReason=control-cancelled/endedAtTick20，当前查询立即不含channel，已取消的可取消后续任务也不重新安排。tick40眩晕结束查询仍无引导，40或之后保存恢复仍无；既有下一击强化未被取消，不因缺引导而清掉。tick60不再为同活动发自然结束或奖励。洛里斯tick10分担[10,90)，盾可能早已耗尽，tick89查询仍有redirect；90维护发expired、投影去除分担，盾生命周期不驱动这个删除。

### R4 所有样例activation与叠加政策自查

StatusContribution.appliedAtTick明确为实际生效start，申请时间取来源事件；普通shred样例也已修正为申请0→生效1→到期101，另一来源申请20、持续40→[21,61)，不保留持续长度不一致的旧向量。Effect.modify-stat现在必须显式携带activation和stackPolicy；样例stats helper不再提供即时或独立叠加默认值。TriggerDefinition.stackPolicy控制触发运行态，不能代替每个持续属性自己的政策；有限Effect[]中每项政策明确。strongest-category保留各来源，但同key刷新替换该贡献并延长到期，不把同源重施变成多份；refresh-same-instance保留原有效start、幅度replace/max及较晚期限；多件的完整来源key不同。

| 检查范围 | activation / 叠加结论 |
| --- | --- |
| 泰坦满层奖励 | next-tick；每实例已消费标记只发一次；双抗是独立一次贡献，不插入同批承伤 |
| 纳什 | next-tick；触发声明及属性效果均refresh-same-instance、replace、phase preserve；异件独立相加 |
| 电刀减魔抗 | immediate，主时序步骤4已有例外；strongest-category，同源刷新贡献 |
| 夜刃防止/不可选中 | 伤后存活阶段immediate，每实例一次；只有指定状态自然结束奖励immediate，列入维护阶段例外 |
| 救赎坚韧 / 普通shred样例 | next-tick、strongest-category；治疗取样/封顶在此前，不回溯减伤 |
| 婕拉/斯卡控制 | next-tick、refresh-same-instance，延长控制到期；异源任一仍有效即受控 |
| 厄加特减甲 | next-tick、strongest-category；同源刷新，不产生无限独立副本 |
| 蕾欧娜减伤 | 旧代码immediate保留、strongest-category；同来源重施刷新 |
| 范德尔双抗 | 旧代码immediate保留、refresh-same-instance；不可误改为同件相加 |
| 克格莫攻速/射程 | 旧代码immediate保留、add-stacks且无上限；每3施法射程依旧独立计数 |
| 芮尔双抗转移 | next-tick、action-target施加身份；不同施法/受害者独立贡献 |
| 库奇护甲 / 凯特琳双抗负修饰 | next-tick、independent-instances；同施法每task.ordinal独立身份，避免覆盖前一发 |
| 全部授盾、引导、分担与一次强化 | 使用显式操作的既有即时语义；盾同源max剩余/较晚到期，引导/分担同源替换刷新，一次强化覆盖未消费值，不从modify-stat默认推导 |
| 石像鬼、反甲、正义等静态/条件StatModifier样例 | 是幅度/过滤声明而非事件新增属性；静态贡献开战存在，current条件按已定边界重算，不能把动态撤回延迟一tick |
| 其他纯伤害/治疗/法力/生命调整样例 | 沿主管线所属阶段，不新增普通属性的即时豁免；伤害继承不重走减免、阈值最大生命与heal仍分离 |

泰坦数值边界：固定初始护甲0、HP1000、24层，tick10两个合资格物理包各120。第一包使计数25并记录奖励已消费，但双抗startsAtTick11；第二包仍120，伤后HP760。tick11同样原始120在护甲20下为100。若错误即时则第二包100、HP780，验收明确拒绝该解释。其余属性贡献在此向量固定不变，避免把两个问题混在一起。

纳什tick10施法首次[11,111)：10无增益、11至110为6000Bps、111为0。若50未到期再次施法，同key保留start11，expiry=max(111,51+100)=151，50/110/111/150均只有6000Bps，151归零；不是12000，也不能在50先撤掉再51恢复。另一真实实例才独立增加6000。保存/恢复保留有效start、延长期限和单份来源。

验收不再只看gate或listener：共享装备声明放入 `tests/fixtures/m8-audit-definitions.ts`，原A04/A05与R4向量引用同一对象；`m8-effect-policy-contracts.test.ts`递归检查全部19技能计划（包括所有延期任务和结束效果）中的activation/stackPolicy，与逐英雄预期表逐项比较。原6条合同样例的burn、阈值血手、普通shred、直接heal、离子、授权及存档/掉落签名也已逐一核查：不含额外modify-stat即时默认或错误周期账户。

### 本次R1–R4验证记录

基线317186b，验证对象为本次待提交工作树；Node24.21.0/npm11.19.0，依赖锁未改。

| 检查 | 结果 |
| --- | --- |
| `npm test -- --maxWorkers=2` | 56文件、817项全量通过，462.88秒；既有战斗测试未删减/改写断言 |
| 六个M8合同测试文件定向运行 | 95项通过，1.13秒；包含19项旧规划器目标列表证据、排序反例及19计划全部显式activation/stackPolicy检查 |
| 最后补强R3持久态/眩晕投影后单独运行 `tests/m8-rereview-contracts.test.ts` | 7项通过，340ms；说明全量运行期间末轮样例修订另有复测，不拿JSON往返冒充恢复校验器 |
| `npm run build` | 最终工作树TypeScript/Vite通过，Vite7.60秒；既有大chunk提示保留 |
| `git diff --check` / 改动范围 | 通过；生产差异只有m8类型声明，未改战斗执行器/内容/运行版本/digest/界面，构建资源hash与基线一致 |

B2仍待复审，未签收为可直接接入。R1金额、R3活动和R4时序向量是合同验收数据；R2直接调用已有选敌/技能规划代码作为行为证据，未新增另一套M8选敌或战斗执行器。
