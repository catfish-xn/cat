# S13 14.24b 强化符文扩展：来源核对

本清单新增24项，另保留已有6项，总计30项。新增层级：{'silver': 9, 'gold': 12, 'prismatic': 3}。只新增证据文档；不代表运行实现已验收。

原始文件：`src/simulation/content/source/s13-14.24b/raw/en_us.json.gz`；压缩SHA256：`7e0e2d41a806833f6f18e5752c0d5eea4fa3a74e75b61c1c54853de74c2ac5d2`。所有24项已验证属于set13 augments名单；精确JSON pointer、effects原值、desc和icon见`source-selection.json`。

官方补丁：[14.24 / December 17 B patch](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)。Built Different 必须覆盖为stage2/3/4/5+ HP 300/400/500/600、AS 45/55/65/75%。其余已选项未发现本页B补丁数值修改。Pumping Up II 的8%基础AS已包含于raw，不能再次扣减。

## 24项映射
|项目ID|apiName|层级|实现范围与完整语义|
|---|---|---|---|
|manaflow-ii|TFT_Augment_Manaflow2|gold|reuse：开战最后一排；每次普攻额外4法力。|
|glass-cannon-ii|TFT_Augment_GlassCannonII|gold|reuse：开战最后一排；80%初始生命，20%增伤。|
|pumping-up-ii|TFT9_Augment_PumpingUp2|gold|reuse：基础8%攻速；获得后每轮再加1个百分点。|
|pumping-up-iii|TFT9_Augment_PumpingUp3|prismatic|reuse：基础12%攻速；获得后每轮再加2个百分点。|
|bulky-buddies-ii|TFT_Augment_BulkyBuddies2|gold|reuse：恰邻接一个友军：175HP；该友军死亡给15%最大HP盾10秒。|
|bulky-buddies-iii|TFT_Augment_BulkyBuddies3|prismatic|reuse：恰邻接一个友军：330HP；该友军死亡给18%最大HP盾10秒。|
|placebo-plus|TFT_Augment_PlaceboPlus|silver|reuse-acquisition：15金币仅获得时发放一次；全队1%攻速，不改变经济规则。|
|mentorship-i|TFT_Augment_Mentorship1|silver|snapshot-selector：邻接至少一个更高费友军：12%AS和150HP；不是按邻居数叠加。|
|mentorship-ii|TFT_Augment_Mentorship2|gold|snapshot-selector：邻接至少一个更高费友军：18%AS和220HP；不是按邻居数叠加。|
|item-collector-i|TFT_Augment_ItemCollector1|silver|snapshot-count：全队基础10HP；每种不同穿戴物品全队2HP、1%AD、1AP。原文不限定成装。|
|item-collector-ii|TFT_Augment_ItemCollector2|gold|snapshot-count-fraction：全队基础20HP；每种不同穿戴物品全队5HP、1.5%AD、1.5AP。|
|bronze-for-life-i|TFT_Augment_BronzeForLifeI|gold|snapshot-trait-style：每个当前铜级羁绊全队3%增伤；不是所有最低阈值。|
|bronze-for-life-ii|TFT_Augment_BronzeForLife2|prismatic|snapshot-trait-style：每个当前铜级羁绊全队3.5%增伤和1.5%坚韧。|
|little-buddies|TFT10_Augment_LittleBuddies|gold|snapshot-count：每个1/2费上场友军，使4/5费友军增加65HP和7%AS；不可误扩到6费。|
|backup|TFT_Augment_Backup|silver|snapshot-selector：后两排至少4个友军，全队10%AS。|
|lineup|TFT_Augment_Lineup|silver|snapshot-count-fraction：前两排每个友军，全队2.5护甲和魔抗。|
|find-your-center|TFT_Augment_FindYourCenter|silver|snapshot-selector：中心格开战单位15%增伤和15%最大HP；中心坐标需项目约定。|
|built-different|TFT6_Augment_Traitless2|gold|snapshot-trait-stage：无任何激活羁绊的单位；B补丁stage2/3/4/5+为300/400/500/600HP和45/55/65/75%AS。|
|blistering-strikes|TFT9_Augment_RedBuff|silver|combat-attack-trigger：全队攻击给目标5秒共5%最大HP灼烧和33%重伤；每秒1%最大HP，50ms/tick下持续100ticks。仅攻击触发，不能扩展为所有伤害触发。|
|clockwork-accelerator|TFT_Augment_ClockworkAccelerator|gold|combat-timer：每3秒全队增加10%AS；不是开战即加。|
|lone-hero|TFT_Augment_LoneHero|silver|combat-survivor：最后存活单位140%AS与35%坚韧；持续条件与召唤物计数需约定。|
|climb-the-ladder-i|TFT_Augment_ClimbTheLadder1|silver|combat-death：每个友军死亡，和死者共享至少一个羁绊的存活友军+3%AD、3AP、3双抗。|
|climb-the-ladder-ii|TFT_Augment_ClimbTheLadder2|gold|combat-death：每个友军死亡，和死者共享至少一个羁绊的存活友军+5%AD、5AP、5双抗。|
|inspiring-epitaph|TFT10_Augment_InspiringEpitaph|gold|combat-death：单位死亡，最近友军获得20%最大HP盾及可叠10%AS；raw未给盾持续时间。|

## 层级证据
层级取raw icon后缀：I银、II金、III彩；名称中的I/II不是通用层级。Investment Strategy I和Bronze For Life I是金，Bronze For Life II是彩。Lone Hero的raw图标为LoneSurvivor_I；官方14.24页却把其数值修改放在GOLD AUGMENTS标题下。保留raw的银色标记并披露此标题冲突。

## 铜级羁绊源style映射
铜级判定为当前激活effects档位style=1；精确min/max范围在JSON。以下列出所有源trait，空表示无铜档。
|apiName|显示名|铜档单位数范围|
|---|---|---|
|TFT13_Hextech|Automata|2–3|
|TFT13_Teamup_Menaces|Menaces|无|
|TFT13_Sorcerer|Sorcerer|2–3|
|TFT13_Scrap|Scrap|2–3|
|TFT13_Martialist|Artillerist|2–3|
|TFT13_FormSwapper|Form Swapper|2–3|
|TFT13_Ambassador|Emissary|1–1|
|TFT13_Teamup_Mentorship|Martial Law|无|
|TFT13_Titan|Sentinel|2–3|
|TFT13_Teamup_Reunion|Reunion|无|
|TFT13_Family|Family|无|
|TFT13_Ambusher|Ambusher|2–2|
|TFT13_Teamup_Sisters|Sisters|无|
|TFT13_Invoker|Visionary|2–3|
|TFT13_Sniper|Sniper|2–3|
|TFT13_Warband|Conqueror|2–3|
|TFT13_HighRoller|High Roller|无|
|TFT13_Academy|Academy|3–3|
|TFT13_Crime|Chem-Baron|3–3|
|TFT13_Rebel|Rebel|3–4|
|TFT13_Infused|Dominator|2–3|
|TFT13_Pugilist|Pit Fighter|2–3|
|TFT13_Teamup_BloodBrothers|What Could Have Been|无|
|TFT13_Squad|Enforcer|2–3|
|TFT13_Hoverboard|Firelight|2–2|
|TFT13_Teamup_UnlikelyDuo|Unlikely Duo|无|
|TFT13_Experiment|Experiment|3–4|
|TFT13_Bruiser|Bruiser|2–3|
|TFT13_JunkerKing|Junker King|无|
|TFT13_Cabal|Black Rose|3–3|
|TFT13_Challenger|Quickstriker|2–2|
|TFT13_Teamup_Geniuses|Geniuses|无|
|TFT13_Watcher|Watcher|2–3|

## 必须标注的项目约定与边界
- 所有百分比先转换整数基点；2.5双抗和1.5AP等小数flat应使用整数定点，汇总全部同stat贡献后再统一floor，不逐项floor；精确舍入未由原文规定，标注项目约定，非官方证据。
- 源style=1解释为铜级；仅匹配当前实际激活档位。Family所有档位style=5，不可按首档算铜；Emissary一人档style=1，四人档style=5；唯一羁绊style=4，不算铜。
- 中心格坐标、同距最近友军平局、死亡同时发生时处理顺序、永久盾是否持续至战斗结束，原文不完整，应列项目约定。
- Inspiring Epitaph raw没有盾时长，不能把虚构的10秒说成官方值；建议战斗内不自然过期，并清楚标注项目约定。
- Climb the Ladder按单位自身trait集合交集判定，不要求共享羁绊已经激活。Item Collector去重按物品definition身份，临时装备与组件统计口径须显式约定。
- 不要修改经济/XP/选秀/回合规则；Placebo+仅复用既有一次性acquisitionGold，Pumping仅复用既有成长钩子。

- Blistering Strikes沿既有burn/wound状态时序：仅攻击完成触发，100ticks，100Bps最大HP/秒和3300Bps重伤；不可照搬Red Buff物品的所有damage-dealt触发。

## 排除候选
- TFT_Augment_SpiritLink1：联机PlayerBattleSnapshot不含playerHP或roundResults，无法忠实推导缺血加成；不新增公开合同输入，故排除。
- TFT_Augment_InvestmentStrategy2：提高最大利息，超出范围。
- TFT9_Augment_LongDistanceRelationship2：双向最终AD/AP/双抗分享涉及快照及反馈顺序，本次排除。
- TFT_Augment_CalculatedEnhancement：随机四单位选择需新增RNG选择合同，本次排除。
- TFT_Augment_Moonlight：临时升星且14.24正文与raw值不同，本次排除。
- TFT_Augment_GuardbreakerSpirit：新增物品发放及暴击属性通路，本次排除。

## 验收建议
覆盖每项效果的适用与不适用情况、最高/最低阶段、三档层级供给、同时持有同族效果、死亡同tick去重、定点小数最终floor、恢复与重复结算。新动态效果不能仅作为静态加成伪实现。
