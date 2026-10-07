# 中文显示文本人工校对清单

校对规则：

- **以腾讯国服数据为准**；拳头官方 `zh_CN` 数据不一致时只在备注记录，不覆盖国服名称。例如关系羁绊采用“义兄弟”，基础装备采用“暴风大剑”。本次未取得拳头 `zh_CN` 原件，不新增未经验证的拳头译名差异。
- **“无法被选取”“不可被选取”国服两种写法并存**：术语表用前者；逐件还原装备说明时可用官方原文。
- **官方文件为 S13 末期 15.6 快照，只用于名称和用词，数值仍以 14.24b 为准**。不将 15.6 描述中的数值、站位范围、触发条件或机制变化带入现有规则。

状态：名称和术语能在归档中确认的逐项标为“已核对（国服 S13 数据）”；找不到的保留原译名并标为“待核”。名称核对状态不代表整段描述已取得同版本官方中文核对；第 3—7 表的中文描述仍是原 14.24b 英文/项目资料的人工译文，只同步有证据的用词。备注中的“否”只表示没有额外疑点。

中文只用于显示；规则、配方、资源身份及机制匹配仍按英文 `apiName`。本次仅更新本文并归档来源，不改代码、游戏数据、版本、digest 或规则。异常原件未提供 `apiName`，只列现有英文项目 ID，不能把 ID 或临时译名冒充客户端 `apiName`。

来源锁定：

- 腾讯国服：`15.6-2025.S13`，五份文件由用户本地下载提供；原四份下载时间为 2026-10-07 17:03:47（UTC+08:00），job.js 为用户报告的约 17:12。逐文件下载时间（job.js 为约略时间）、字节数及 SHA-256 见 [归档 manifest](evidence/zh-review/tencent-15.6-2025.S13/manifest.txt)，原四份用户 manifest 另存为 [manifest.user.txt](evidence/zh-review/tencent-15.6-2025.S13/manifest.user.txt)。已重新计算原四份文件的字节数及 SHA-256，与用户 manifest 全部一致。job.js 未附本地校验值，按用户补充指示直接计算字节数及 SHA-256 并记录，不能宣称与用户本地值一致；五份原始文件字节均未改写。文件内 `time` 是官网数据生成时间，不是下载时间。
- 英文 `apiName` 对应字段：`chess.js` 的 `hero_EN_name` → `displayName` / `skillName`；`equip.js` 的 `englishName` → `name`；`race.js` / `job.js` 的 `characterid` → `name`；`hex.js` 的 `augments` → `name`。精确匹配，不按中文名、图片、数字 ID 或英雄职业关系推测身份。用词依据来自这些记录的技能/装备/羁绊/强化描述；术语表逐行记录字段和证据。
- 名称补充来源：[国服 14.24 公告](https://lol.qq.com/gicp/news/662/37055498.html)“异常突变”章节确认“泰坦打击”“法师护甲”“连杀”；该公告不提供客户端 apiName，名称状态与身份字段缺口分开记录。[LOL 国服艾瑞莉娅官方数据](https://game.gtimg.cn/images/lol/act/img/js/hero/39.js)（2026-10-07 查阅，数据 version 为 `16.19`）中 `hero.alias=Irelia`、`spells[spellKey=w].name=距破之舞`，与 S13 chess.js 的技能名一致；仅核实名称，不引入 LOL 技能数值或机制。
- 原英文/规则基线 `main`：`5aff440c702e7c8c665f05f0b419a9edbf9ea00f`。19 英雄的英文名称、技能名、技能原文，以及 5 羁绊和 6 强化原文，取自 `src/simulation/content/source/s13-14.24.json`；3 异常的当前效果取自 `src/simulation/content/anomalies.ts`。
- M8 B1：`feat/m8-b0-baseline` @ `877c59b2babc4c6abfccc62452075f3b0cbbd688`。44 项装备身份取自 `docs/M8_ITEM_NAMES_REVIEW.md` / `normalized/items.json`；效果描述取自 `raw/selected-items.json`，基础属性另列 B1 可读摘要。中文名现按腾讯归档核对。
- M9：`data/m9-champions` @ `74616d26780add9b52b321cd2844ba8b56e3e6ee` 的 `docs/M9_DATA_LEDGER.md` §6、§7：63 英雄、37 羁绊（29 常规/专属 + 8 强化解锁关系）。仅核对名称；§8 的 Rammus 排除项和召唤物不计入。

读法：英文原文去除字体、颜色等样式标签，将原 `<br>` 保留为换行；中文保留 `@...@`、`%i:...%` 等变量，不计算、改名或删掉动态值。中文条件段注明源条件，不把未启用的试验品加成写成当前已实现效果。羁绊原文保留全部原档位，不据此扩充 main 的已实现档位；技能的位移等也只是原文翻译，不能当作现有引擎能力承诺。每表存疑/待核项在前。

## 1. 术语表（统一译法）

| 英文原文 | 中文译文 | 是否存疑 | 官方依据 / 备注 |
| --- | --- | --- | --- |
| front two rows / back two rows / back row | 前两排 / 后两排 / 后排 · 已核对（国服 S13 数据）<br>14.24b 描述中的 back row 范围保留原版本解释，不据 15.6 扩大。 | 存疑：back row 的跨版本范围见第 5 表 | `equip.js` → `TFT_Item_AdaptiveHelm` → `effect`：“前两排”；前两排 / 后两排已核对；back row 国服用“后排”；法力流 I 有跨版本范围差异，见第 5 表 |
| Durability | 伤害减免 · 已核对（国服 S13 数据）<br>不与护甲、魔抗或独立普攻减伤混算。 | 否 | `chess.js` → `TFT13_Singed` → `skillIntroduce`：“伤害减免”；该国服描述支持“伤害减免”，解除本表原存疑的“耐久性”译法；救赎 effect 也明确写“伤害减免” |
| Armor | 护甲 · 已核对（国服 S13 数据）<br>一般降低护甲可称“护甲削减”；Sunder 统一用“护甲击碎”。 | 否 | `equip.js` → `TFT_Item_ChainVest` → `effect`：“护甲” |
| Magic Resist / MR | 魔抗 · 已核对（国服 S13 数据）<br>与护甲分开表达。 | 否 | `equip.js` → `TFT_Item_NegatronCloak` → `effect`：“魔抗”；部分装备原文也使用“魔法抗性”，术语表统一用“魔抗” |
| Ability Power / AP | 法术强度 · 已核对（国服 S13 数据）<br>描述不混用“法强”。 | 否 | `equip.js` → `TFT_Item_ArchangelsStaff` → `effect`：“法术强度” |
| Attack Damage / AD | 攻击力 · 已核对（国服 S13 数据）<br>与“物理伤害”区分。 | 否 | `equip.js` → `TFT_Item_Bloodthirster` → `effect`：“攻击力” |
| Attack Speed / AS | 攻击速度 · 已核对（国服 S13 数据）<br>描述不混用“攻速”。 | 否 | `equip.js` → `TFT_Item_GuinsoosRageblade` → `effect`：“攻击速度” |
| Health / HP | 生命值 · 已核对（国服 S13 数据）<br>按语境写当前生命值或生命值百分比。 | 否 | `equip.js` → `TFT_Item_Redemption` → `effect`：“生命值” |
| max Health | 最大生命值 · 已核对（国服 S13 数据）<br>不省略“最大”。 | 否 | `equip.js` → `TFT_Item_Bloodthirster` → `effect`：“最大生命值” |
| missing Health | 已损失生命值 · 已核对（国服 S13 数据）<br>最大生命值减当前生命值。 | 否 | `equip.js` → `TFT_Item_Redemption` → `effect`：“已损失生命值” |
| Mana | 法力值 · 已核对（国服 S13 数据）<br>不改为最大法力值。 | 否 | `equip.js` → `TFT_Item_SpearOfShojin` → `effect`：“法力值” |
| starting Mana | 初始法力值 · 已核对（国服 S13 数据）<br>基础装备 Mana 摘要按此译。 | 否 | `equip.js` → `TFT4_Item_OrnnInfinityForce` → `effect`：“初始法力值” |
| max Mana | 最大法力值 · 已核对（国服 S13 数据）<br>与初始法力值分开。 | 否 | `race.js` → `TFT13_Family` → `introduce`：“最大法力值” |
| Attack Range / Range | 攻击距离 · 已核对（国服 S13 数据）<br>单位使用“格”。 | 否 | `chess.js` → `TFT13_KogMaw` → `skillIntroduce`：“攻击距离” |
| Damage Amp | 伤害增幅 · 已核对（国服 S13 数据）<br>原文 more damage 按句式译“造成的伤害提高”。 | 否 | `race.js` → `TFT13_Academy` → `introduce`：“伤害增幅” |
| Omnivamp | 全能吸血 · 已核对（国服 S13 数据）<br>不将旧字段 LifeSteal 直接当正式显示名。 | 否 | `equip.js` → `TFT_Item_Bloodthirster` → `effect`：“全能吸血” |
| Critical Strike Chance | 暴击几率 · 已核对（国服 S13 数据）<br>不替换为暴击伤害。 | 否 | `equip.js` → `TFT_Item_InfinityEdge` → `effect`：“暴击几率”；窃贼手套也写“暴击率”，术语表统一用“暴击几率” |
| Critical Strike Damage | 暴击伤害 · 已核对（国服 S13 数据）<br>不替换为暴击几率。 | 否 | `equip.js` → `TFT_Item_InfinityEdge` → `effect`：“暴击伤害” |
| critically strike | 暴击 · 已核对（国服 S13 数据）<br>“技能可以暴击”。 | 否 | `equip.js` → `TFT_Item_InfinityEdge` → `effect`：“技能可以暴击” |
| physical damage | 物理伤害 · 已核对（国服 S13 数据）<br>AD 缩放图标原样保留。 | 否 | `chess.js` → `TFT13_Darius` → `skillIntroduce`：“物理伤害” |
| magic damage | 魔法伤害 · 已核对（国服 S13 数据）<br>AP 缩放图标原样保留。 | 否 | `chess.js` → `TFT13_Lux` → `skillIntroduce`：“魔法伤害” |
| true damage | 真实伤害 · 已核对（国服 S13 数据）<br>不改为魔法伤害。 | 否 | `chess.js` → `TFT13_Zyra` → `skillIntroduce`：“真实伤害” |
| Shield | 护盾 · 已核对（国服 S13 数据）<br>按原文区分护盾量和持续时间。 | 否 | `chess.js` → `TFT13_Lux` → `skillIntroduce`：“护盾”；国服也写“护盾值”，保留每条语境 |
| Heal / healing | 治疗 / 治疗量 · 已核对（国服 S13 数据）<br>数值描述使用“治疗自身/友军……生命值”。 | 否 | `chess.js` → `TFT13_Fish` → `skillIntroduce`：“治疗量”；该记录同时有“受到治疗”和“回复……生命值”，不强制替换逐件原文 |
| Sunder | 护甲击碎 · 已核对（国服 S13 数据）<br>降低护甲；按原文区分百分比削减与固定值降低。 | 否 | `chess.js` → `TFT13_Urgot` → `skillIntroduce`：“护甲击碎”；skillIntroduce 明确解释“护甲击碎：降低护甲值”；薄暮法袍 effect 仍写“护甲削减” |
| Shred | 魔抗击碎 · 已核对（国服 S13 数据）<br>降低魔抗。 | 否 | `equip.js` → `TFT_Item_IonicSpark` → `effect`：“魔抗击碎” |
| Wound / Wounds | 重伤 · 已核对（国服 S13 数据）<br>降低受到的治疗效果。 | 否 | `equip.js` → `TFT_Item_RapidFireCannon` → `effect`：“重伤” |
| Burn | 灼烧 · 已核对（国服 S13 数据）<br>每秒造成相当于目标最大生命值一定百分比的真实伤害。 | 否 | `equip.js` → `TFT_Item_RapidFireCannon` → `effect`：“灼烧” |
| bleed | 流血 · 已核对（国服 S13 数据）<br>伤害类型遵照每条原文，不与灼烧混同。 | 否 | `chess.js` → `TFT13_Darius` → `skillIntroduce`：“流血” |
| Stun / Stunning | 晕眩 · 已核对（国服 S13 数据）<br>不从变量名推导额外控制。 | 否 | `chess.js` → `TFT13_Zyra` → `skillIntroduce`：“晕眩” |
| crowd control immunity | 控制免疫 · 已核对（国服 S13 数据）<br>按原文持续时间。 | 否 | `equip.js` → `TFT_Item_Quicksilver` → `effect`：“控制免疫” |
| untargetable | 无法被选取 · 已核对（国服 S13 数据）<br>不等同无敌。 | 否 | `equip.js` → `TFT4_Item_OrnnZhonyasParadox` → `effect`：“无法被选取”；夜之锋刃 effect 写“不可被选取”；两种写法并存，按开头规则处理 |
| negative effects | 负面效果 · 已核对（国服 S13 数据）<br>清除负面效果。 | 否 | `equip.js` → `TFT_Item_GuardianAngel` → `effect`：“负面效果”；原文写“摆脱负面效果” |
| attack / Attacks | 普攻 · 已核对（国服 S13 数据）<br>描述中的普通攻击触发。 | 否 | `chess.js` → `TFT13_KogMaw` → `skillIntroduce`：“普攻”；国服也写“攻击”，按原文语境 |
| cast / casting | 施放技能 · 已核对（国服 S13 数据）<br>保持原文主动/被动区分。 | 否 | `chess.js` → `TFT13_Urgot` → `skillIntroduce`：“施放技能” |
| Passive / Active | 被动 / 主动 · 已核对（国服 S13 数据）<br>不删除任一段。 | 否 | `chess.js` → `TFT13_Garen` → `skillIntroduce`：“被动”；同字段也明确写“主动” |
| Combat start | 战斗开始时 · 已核对（国服 S13 数据）<br>不改成获得装备时。 | 否 | `equip.js` → `TFT_Item_Quicksilver` → `effect`：“战斗开始时” |
| Once per combat | 每场战斗一次 · 已核对（国服 S13 数据）<br>次数限制必须保留。 | 否 | `equip.js` → `TFT_Item_Bloodthirster` → `effect`：“每场战斗一次” |
| takedown | 参与击杀 · 已核对（国服 S13 数据）<br>与 kill（击杀）分开。 | 否 | `chess.js` → `TFT13_DrMundo` → `skillIntroduce`：“参与击杀”；蓝霸符 effect 也写“参与一次击杀” |
| kill | 击杀 · 已核对（国服 S13 数据）<br>用于连杀异常。 | 否 | `hex.js` → `TFT13_Augment_Ambusher` → `description`：“击杀” |
| stack / stacking | 层 / 可叠加 · 已核对（国服 S13 数据）<br>保留叠加上限。 | 否 | `equip.js` → `TFT_Item_TitansResolve` → `effect`：“层数”；同字段包含“可叠加” |
| Cooldown | 冷却时间 · 已核对（国服 S13 数据）<br>单位为秒。 | 否 | `chess.js` → `TFT13_NunuWillump` → `skillIntroduce`：“冷却时间” |
| hex / adjacent | 格 / 相邻 · 已核对（国服 S13 数据）<br>相邻为棋盘相邻格。 | 否 | `hex.js` → `TFT_Augment_Mentorship2` → `description`：“相邻”；格：救赎 effect 写“1格内”；邻格也见厄加特 skillIntroduce |
| unique / item slots | 唯一 / 装备格 · 已核对（国服 S13 数据）<br>每英雄件数和占栏要求原样表达。 | 否 | `equip.js` → `TFT_Item_ThiefsGloves` → `effect`：“装备格”；唯一：水银 effect 明确写“唯一” |
| permanently | 永久 · 已核对（国服 S13 数据）<br>不省略为战斗内加成。 | 否 | `chess.js` → `TFT13_Tristana` → `skillIntroduce`：“永久” |
| gold / interest | 金币 / 利息 · 已核对（国服 S13 数据）<br>利息按收入金额表述。 | 否 | `hex.js` → `TFT_Augment_InvestmentStrategy1` → `description`：“利息”；金币：百变铁手 introduce 写“获得3金币” |
| Experiment Bonus | 试验品加成 · 已核对（国服 S13 数据）<br>条件效果，不代表 main 已启用。 | 否 | `chess.js` → `TFT13_Zyra` → `skillIntroduce`：“【试验品】加成” |

## 2. 现有英雄名字（19）

| 英文原文 | 中文译文 | 是否存疑 |
| --- | --- | --- |
| `TFT13_Irelia`<br>名称：Irelia | **艾瑞莉娅** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Shooter`<br>名称：Maddie | **麦迪** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Darius`<br>名称：Darius | **德莱厄斯** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Lux`<br>名称：Lux | **拉克丝** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Zyra`<br>名称：Zyra | **婕拉** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Tristana`<br>名称：Tristana | **崔丝塔娜** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Urgot`<br>名称：Urgot | **厄加特** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Rell`<br>名称：Rell | **芮尔** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Leona`<br>名称：Leona | **蕾欧娜** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Prime`<br>名称：Vander | **范德尔** · 已核对（国服 S13 数据） | 否 |
| `TFT13_KogMaw`<br>名称：Kog'Maw | **克格莫** · 已核对（国服 S13 数据） | 否 |
| `TFT13_FlyGuy`<br>名称：Scar | **刀疤** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Ezreal`<br>名称：Ezreal | **伊泽瑞尔** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Beardy`<br>名称：Loris | **洛里斯** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Nami`<br>名称：Nami | **娜美** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Corki`<br>名称：Corki | **库奇** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Garen`<br>名称：Garen | **盖伦** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Zoe`<br>名称：Zoe | **佐伊** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Caitlyn`<br>名称：Caitlyn | **凯特琳** · 已核对（国服 S13 数据） | 否 |

## 3. 现有英雄技能名及技能描述（19）

含全部 14.24b 原文效果段；英雄名和技能名的核对状态分别标注，描述保留原版本变量和效果，只同步术语表用词。

| 英文原文 | 中文译文 | 是否存疑 |
| --- | --- | --- |
| `TFT13_Zyra`<br>英雄：Zyra<br>技能：Grasping Roots<br>描述：Send vines towards the current target, Stunning them for @StunDuration@ second and dealing @ModifiedTargetDamage@ (%i:scaleAP%) magic damage. Then smaller vines seek out the @NumSmallerVines@ nearest enemies and deal @ModifiedAOEDamage@ (%i:scaleAP%) magic damage to them.<br><br>Experiment Bonus: Ability damage bleeds enemies for @TFTUnitProperty.:TFT13_ZyraCurrentExperimentBonus@% bonus true damage over @ExperimentDuration@ seconds. | 英雄：婕拉 · 已核对（国服 S13 数据）<br>技能：**缠绕之根** · 已核对（国服 S13 数据）<br>描述：向当前目标发射藤蔓，使其晕眩 @StunDuration@ 秒，并造成 @ModifiedTargetDamage@（%i:scaleAP%）魔法伤害。随后，较小的藤蔓追踪最近的 @NumSmallerVines@ 个敌人，各造成 @ModifiedAOEDamage@（%i:scaleAP%）魔法伤害。<br><br>【条件段：TFT13_ExperimentActive；试验品加成】技能伤害使敌人流血，在 @ExperimentDuration@ 秒内额外造成 @TFTUnitProperty.:TFT13_ZyraCurrentExperimentBonus@% 的真实伤害。 | 存疑：原文保留试验品条件段，main 未启用此加成 |
| `TFT13_Urgot`<br>英雄：Urgot<br>技能：Corrosive Charge<br>描述：Fire an explosive charge, dealing @ModifiedPrimaryDamage@ (%i:scaleAD%) physical damage to target and @ModifiedSecondaryDamage@ (%i:scaleAD%) physical damage to adjacent enemies. 20% Sunder all enemies hit for @Duration@ seconds.<br><br>Sunder: Reduce Armor<br><br>Experiment Bonus: Dash to targets. On cast, gain @TFTUnitProperty.:TFT13_UrgotCurrentExperimentBonusShield@% max Health Shield and @TFTUnitProperty.:TFT13_UrgotCurrentExperimentBonusAS@% Attack Speed for @ExperimentDuration@ seconds. | 英雄：厄加特 · 已核对（国服 S13 数据）<br>技能：**腐蚀电荷** · 已核对（国服 S13 数据）<br>描述：发射爆炸弹，对目标造成 @ModifiedPrimaryDamage@（%i:scaleAD%）物理伤害，对相邻敌人造成 @ModifiedSecondaryDamage@（%i:scaleAD%）物理伤害。对所有命中的敌人施加 20% 护甲击碎，持续 @Duration@ 秒。<br><br>护甲击碎：降低护甲。<br><br>【条件段：TFT13_ExperimentActive；试验品加成】冲向目标。施放技能时，获得相当于最大生命值 @TFTUnitProperty.:TFT13_UrgotCurrentExperimentBonusShield@% 的护盾，以及 @TFTUnitProperty.:TFT13_UrgotCurrentExperimentBonusAS@% 攻击速度，持续 @ExperimentDuration@ 秒。 | 存疑：原文保留试验品条件段，main 未启用此加成 |
| `TFT13_Irelia`<br>英雄：Irelia<br>技能：Defiant Dance<br>描述：Enter a defensive stance and gain @ModifiedShield@ (%i:scaleAP%) Shield that rapidly decays over @ShieldDuration@ seconds. When it expires, deal @ModifiedBaseStrikeDamage@ (%i:scaleAP%) magic damage + @PercentShieldDamage*100@% of the damage absorbed to enemies around and in front of Irelia. | 英雄：艾瑞莉娅 · 已核对（国服 S13 数据）<br>技能：**距破之舞** · 已核对（国服 S13 数据）<br>描述：进入防御姿态，获得 @ModifiedShield@（%i:scaleAP%）护盾；护盾在 @ShieldDuration@ 秒内快速衰减。护盾结束时，对艾瑞莉娅周围及前方的敌人造成 @ModifiedBaseStrikeDamage@（%i:scaleAP%）魔法伤害，另加已吸收伤害的 @PercentShieldDamage*100@%。 | 否；[LOL 国服艾瑞莉娅官方数据](https://game.gtimg.cn/images/lol/act/img/js/hero/39.js)中 `spells[spellKey=w].name` 同为“距破之舞”，已解除用字疑点 |
| `TFT13_Shooter`<br>英雄：Maddie<br>技能：Fan the Hammer<br>描述：Fire @NumOfShots@ shots towards the farthest enemy that deal @TotalDamage@ (%i:scaleAD%) physical damage to the first enemy they hit. | 英雄：麦迪 · 已核对（国服 S13 数据）<br>技能：**连拨击锤** · 已核对（国服 S13 数据）<br>描述：朝最远的敌人射击 @NumOfShots@ 次，每发对子弹命中的首个敌人造成 @TotalDamage@（%i:scaleAD%）物理伤害。 | 否 |
| `TFT13_Tristana`<br>英雄：Tristana<br>技能：Draw a Bead<br>描述：Fire a cannonball at target, dealing @TotalDamage@ (%i:scaleAD%) physical damage. If they die, the cannonball ricochets to the nearest enemy, dealing the overkill damage. When it does, permanently gain @TFTUnitProperty.:TFT13_TristanaASPerStack@% Attack Damage.<br><br>(Current Bonus: @TFTUnitProperty.:TFT13_TristanaASGain@% %i:scaleAD%) | 英雄：崔丝塔娜 · 已核对（国服 S13 数据）<br>技能：**瞄准** · 已核对（国服 S13 数据）<br>描述：向目标发射炮弹，造成 @TotalDamage@（%i:scaleAD%）物理伤害。如果目标死亡，炮弹会弹射至最近的敌人，造成溢出伤害。发生弹射时，永久获得 @TFTUnitProperty.:TFT13_TristanaASPerStack@% 攻击力。<br><br>（当前加成：@TFTUnitProperty.:TFT13_TristanaASGain@% %i:scaleAD%） | 否 |
| `TFT13_Rell`<br>英雄：Rell<br>技能：Shattering Strike<br>描述：Gain @ModifiedShield@ (%i:scaleAP%) Shield for @ShieldDuration@ seconds. Lance enemies in a line for @ModifiedDamage@ (%i:scaleAP%) magic damage and steal @DefensesSteal@ Armor and Magic Resist from enemies hit. | 英雄：芮尔 · 已核对（国服 S13 数据）<br>技能：**裂阵** · 已核对（国服 S13 数据）<br>描述：获得 @ModifiedShield@（%i:scaleAP%）护盾，持续 @ShieldDuration@ 秒。刺击直线上的敌人，造成 @ModifiedDamage@（%i:scaleAP%）魔法伤害，并从命中的敌人处偷取 @DefensesSteal@ 护甲和魔抗。 | 否 |
| `TFT13_Prime`<br>英雄：Vander<br>技能：Hound of the Underground<br>描述：Stop attacking and brace for @TauntDuration@ seconds, gaining @ModifiedDefenses@ (%i:scaleAP%) Armor and Magic Resist. Vander's next attack is replaced with a strike that deals @ModifiedDamage@ (%i:scaleAD%) physical damage, increased by @ModifiedBonusDamage@ (%i:scaleAD%) physical damage for each 1 or 2 cost champion on your team. | 英雄：范德尔 · 已核对（国服 S13 数据）<br>技能：**地下猎犬** · 已核对（国服 S13 数据）<br>描述：停止普攻并摆出防御姿态，持续 @TauntDuration@ 秒，获得 @ModifiedDefenses@（%i:scaleAP%）护甲和魔抗。范德尔的下一次普攻替换为重击，造成 @ModifiedDamage@（%i:scaleAD%）物理伤害；己方队伍每有一名 1 费或 2 费英雄，该伤害额外增加 @ModifiedBonusDamage@（%i:scaleAD%）物理伤害。 | 否 |
| `TFT13_KogMaw`<br>英雄：Kog'Maw<br>技能：Upgrading Barrage Module<br>描述：Passive: Attacks deal @ModifiedDamage@ (%i:scaleAP%) bonus magic damage.<br><br>Active: Gain @AttackSpeed*100@% stacking Attack Speed for the rest of combat. After every @RangeIncreaseNumAttacks@ casts, gain +1 Range. | 英雄：克格莫 · 已核对（国服 S13 数据）<br>技能：**升级弹幕模块** · 已核对（国服 S13 数据）<br>描述：被动：普攻额外造成 @ModifiedDamage@（%i:scaleAP%）魔法伤害。<br><br>主动：获得可叠加的 @AttackSpeed*100@% 攻击速度，持续至战斗结束。每施放 @RangeIncreaseNumAttacks@ 次技能，攻击距离增加 1 格。 | 否 |
| `TFT13_FlyGuy`<br>英雄：Scar<br>技能：Sumpsnipe Surprise<br>描述：Lob bombs at the nearest @NumEnemies@ enemies, Stunning them for @StunDuration@ seconds and dealing @ModifiedDamage@ (%i:scaleAP%) magic damage to each. Heal @ModifiedHeal@ (%i:scaleAP%). | 英雄：刀疤 · 已核对（国服 S13 数据）<br>技能：**水坑狙击惊喜** · 已核对（国服 S13 数据）<br>描述：向最近的 @NumEnemies@ 个敌人投掷炸弹，使其晕眩 @StunDuration@ 秒，并各造成 @ModifiedDamage@（%i:scaleAP%）魔法伤害。治疗自身 @ModifiedHeal@（%i:scaleAP%）生命值。 | 备注：国服 skillName 为“水坑狙击惊喜”，原样采用 |
| `TFT13_Beardy`<br>英雄：Loris<br>技能：Piltover Bulwark<br>描述：Gain @ModifiedShield@ (%i:scaleAP%) Shield for @Duration@ seconds. It redirects @PercentDamageRedirect*100@% of damage taken by adjacent allies. When it expires, deal @ModifiedDamage@ (%i:scaleAP%) magic damage in a cone. | 英雄：洛里斯 · 已核对（国服 S13 数据）<br>技能：**皮城坚盾** · 已核对（国服 S13 数据）<br>描述：获得 @ModifiedShield@（%i:scaleAP%）护盾，持续 @Duration@ 秒。护盾会转移相邻友军所受伤害的 @PercentDamageRedirect*100@%。护盾结束时，对锥形范围内的敌人造成 @ModifiedDamage@（%i:scaleAP%）魔法伤害。 | 否 |
| `TFT13_Nami`<br>英雄：Nami<br>技能：Ocean's Ebb<br>描述：Launch a wave at target that bounces @NumBounces@ times to enemies within @SearchRange@ hexes and deals @ModifiedDamage@ (%i:scaleAP%) magic damage. | 英雄：娜美 · 已核对（国服 S13 数据）<br>技能：**潮落** · 已核对（国服 S13 数据）<br>描述：向目标发射一道波浪，在 @SearchRange@ 格内的敌人之间弹射 @NumBounces@ 次，造成 @ModifiedDamage@（%i:scaleAP%）魔法伤害。 | 否 |
| `TFT13_Corki`<br>英雄：Corki<br>技能：Broadside Barrage<br>描述：Lock onto target and strafe to a nearby position, unleashing @BaseMissiles@ missiles split between the target and all enemies within two hexes. Each missile deals @ModifiedDamage@ (%i:scaleAD%) physical damage and reduces Armor by @FlatArmorShred@.<br><br>Every @SpecialMissileNum@th missile deals @ModifiedSpecialDamage@ (%i:scaleAD%) physical damage and reduces Armor by @SpecialMissileArmorReduction@. | 英雄：库奇 · 已核对（国服 S13 数据）<br>技能：**侧舷弹幕** · 已核对（国服 S13 数据）<br>描述：锁定目标并横向移动到附近位置，发射 @BaseMissiles@ 枚导弹，分配给目标及其 2 格范围内的所有敌人。每枚导弹造成 @ModifiedDamage@（%i:scaleAD%）物理伤害，并降低 @FlatArmorShred@ 护甲。<br><br>每第 @SpecialMissileNum@ 枚导弹造成 @ModifiedSpecialDamage@（%i:scaleAD%）物理伤害，并降低 @SpecialMissileArmorReduction@ 护甲。 | 否 |
| `TFT13_Caitlyn`<br>英雄：Caitlyn<br>技能：Air Raid<br>描述：Enter a sniper's stance and call in an airship that circles the battlefield for @RaidDuration@ seconds, dropping @TotalShots@ bombs at a random cluster of enemies over the duration. Bombs deal @TotalDamage@ (%i:scaleAD% %i:scaleAP%) physical damage in a one-hex circle.<br><br>Whenever an enemy is caught in the epicenter of an Air Raid blast, reduce their Armor and Magic Resist by @ResistReduction@ and fire a shot towards them, dealing @HeadshotDamage@ (%i:scaleAD%) physical damage. | 英雄：凯特琳 · 已核对（国服 S13 数据）<br>技能：**空袭** · 已核对（国服 S13 数据）<br>描述：进入狙击姿态，呼叫一艘飞艇在战场上空盘旋 @RaidDuration@ 秒；期间向随机的敌人密集区域投下 @TotalShots@ 枚炸弹。炸弹在1 格的圆形范围内造成 @TotalDamage@（%i:scaleAD% %i:scaleAP%）物理伤害。<br><br>敌人每次处于空袭爆炸中心时，降低其 @ResistReduction@ 护甲和魔抗，并向其射击，造成 @HeadshotDamage@（%i:scaleAD%）物理伤害。 | 否 |
| `TFT13_Darius`<br>英雄：Darius<br>技能：Decimate<br>描述：Spin, dealing @ModifiedDamage@ (%i:scaleAD%) physical damage to adjacent enemies and healing @ModifiedHeal@ (%i:scaleAP%). Apply a @ModifiedBleedDamage@ (%i:scaleAD%) physical damage bleed to target over @BleedDuration@ seconds. | 英雄：德莱厄斯 · 已核对（国服 S13 数据）<br>技能：**大杀四方** · 已核对（国服 S13 数据）<br>描述：旋转武器，对相邻敌人造成 @ModifiedDamage@（%i:scaleAD%）物理伤害，并治疗自身 @ModifiedHeal@（%i:scaleAP%）生命值。使目标流血，在 @BleedDuration@ 秒内造成 @ModifiedBleedDamage@（%i:scaleAD%）物理伤害。 | 否 |
| `TFT13_Lux`<br>英雄：Lux<br>技能：Prismatic Barrier<br>描述：Grant @ModifiedShield@ (%i:scaleAP%) Shield to the lowest current Health ally. Lux's next attack deals @ModifiedDamage@ (%i:scaleAP%) bonus magic damage. | 英雄：拉克丝 · 已核对（国服 S13 数据）<br>技能：**曲光屏障** · 已核对（国服 S13 数据）<br>描述：为当前生命值最低的友军提供 @ModifiedShield@（%i:scaleAP%）护盾。拉克丝的下一次普攻额外造成 @ModifiedDamage@（%i:scaleAP%）魔法伤害。 | 否 |
| `TFT13_Leona`<br>英雄：Leona<br>技能：Eclipse<br>描述：Fortify for @Duration@ seconds, gaining @ModifiedDurability@ (%i:scaleAP%) Durability. Afterwards, deal @ModifiedDamage@ (%i:scaleAP%) magic damage to adjacent enemies. | 英雄：蕾欧娜 · 已核对（国服 S13 数据）<br>技能：**魔法坦克** · 已核对（国服 S13 数据）<br>描述：进入防御状态，持续 @Duration@ 秒，获得 @ModifiedDurability@（%i:scaleAP%）伤害减免。结束后，对相邻敌人造成 @ModifiedDamage@（%i:scaleAP%）魔法伤害。 | 备注：国服 skillName 为“魔法坦克”，与英文 Eclipse 字面不同；按国服名称，描述保留 14.24b |
| `TFT13_Ezreal`<br>英雄：Ezreal<br>技能：Essence Flux<br>描述：Fire a shot towards current target that deals @TotalDamage@ (%i:scaleAD%) physical damage to all enemies within 1 hex. Then, deal @ModifiedDamage@ (%i:scaleAD%) physical damage to the unit in the center of the blast.<br><br><br> | 英雄：伊泽瑞尔 · 已核对（国服 S13 数据）<br>技能：**精华跃动** · 已核对（国服 S13 数据）<br>描述：向当前目标射出一发弹丸，对 1 格范围内的所有敌人造成 @TotalDamage@（%i:scaleAD%）物理伤害。随后，对爆炸中心的单位造成 @ModifiedDamage@（%i:scaleAD%）物理伤害。 | 否 |
| `TFT13_Garen`<br>英雄：Garen<br>技能：Demacian Justice<br>描述：Passive: After dealing damage, heal @ModifiedHeal@ (%i:scaleHealth%).<br><br>Active: Gain @ModifiedShield@ (%i:scaleHealth%%i:scaleAP%) Shield for @ShieldDuration@ seconds. Slam a massive sword on target, dealing @ModifiedDamage@ (%i:scaleAD%) physical damage to them and @ModifiedSecondaryDamage@ (%i:scaleAD%) physical damage to enemies within 2 hexes. | 英雄：盖伦 · 已核对（国服 S13 数据）<br>技能：**德玛西亚正义** · 已核对（国服 S13 数据）<br>描述：被动：造成伤害后，治疗自身 @ModifiedHeal@（%i:scaleHealth%）生命值。<br><br>主动：获得 @ModifiedShield@（%i:scaleHealth%%i:scaleAP%）护盾，持续 @ShieldDuration@ 秒。向目标挥落巨剑，对其造成 @ModifiedDamage@（%i:scaleAD%）物理伤害，对其 2 格范围内的敌人造成 @ModifiedSecondaryDamage@（%i:scaleAD%）物理伤害。 | 否 |
| `TFT13_Zoe`<br>英雄：Zoe<br>技能：Paddle Star!<br>描述：Launch a star at target that deals @ModifiedDamage@ (%i:scaleAP%) magic damage. It bounces to the farthest enemy within @HexLimiter@ hexes, then bounces back to the target. This effect repeats @NumRepeats@ times, hitting a different enemy each time. | 英雄：佐伊 · 已核对（国服 S13 数据）<br>技能：**飞星乱入！** · 已核对（国服 S13 数据）<br>描述：向目标发射一颗星星，造成 @ModifiedDamage@（%i:scaleAP%）魔法伤害。星星弹射至 @HexLimiter@ 格内最远的敌人，再弹回原目标。此效果重复 @NumRepeats@ 次，每次命中一个不同的敌人。 | 否 |

## 4. 现有羁绊名及描述（5）

档位变量未展开；原文完整范围与 main 当前有限实现分开理解。

| 英文原文 | 中文译文 | 是否存疑 |
| --- | --- | --- |
| `TFT13_Sorcerer`<br>名称：Sorcerer<br>描述：Your team gains @TeamAP@ Ability Power. Sorcerers gain more.<br><br>(@MinUnits@) @BaseAP@ %i:scaleAP%<br>(@MinUnits@) @BaseAP@ %i:scaleAP%<br>(@MinUnits@) @BaseAP@ %i:scaleAP%<br>(@MinUnits@) @BaseAP@ %i:scaleAP%, Abilities reduce their target's damage by @DamageDecrease*100@% for @DamageDecreaseDuration@ seconds | **法师** · 已核对（国服 S13 数据）<br>描述：己方队伍获得 @TeamAP@ 法术强度。法师获得更多。<br><br>（@MinUnits@）@BaseAP@ %i:scaleAP%<br>（@MinUnits@）@BaseAP@ %i:scaleAP%<br>（@MinUnits@）@BaseAP@ %i:scaleAP%<br>（@MinUnits@）@BaseAP@ %i:scaleAP%；技能使目标造成的伤害降低 @DamageDecrease*100@%，持续 @DamageDecreaseDuration@ 秒。 | 否；依据：`job.js` → `characterid=TFT13_Sorcerer` → `name` |
| `TFT13_Martialist`<br>名称：Artillerist<br>描述：Every @NumOfAttacks@ attacks, Artillerists launch a rocket that deals @PercentDamage*100@% Attack Damage around the target. They also gain Attack Damage.<br><br>(@MinUnits@) @AD*100@% %i:scaleAD%<br>(@MinUnits@) @AD*100@% %i:scaleAD%<br>(@MinUnits@) @AD*100@% %i:scaleAD%, Launch a rocket every @NumOfAttacks@ attacks that deals double damage. | **炮手** · 已核对（国服 S13 数据）<br>描述：炮手每进行 @NumOfAttacks@ 次普攻，发射一枚火箭，对目标周围造成相当于 @PercentDamage*100@% 攻击力的伤害。他们还会获得攻击力。<br><br>（@MinUnits@）@AD*100@% %i:scaleAD%<br>（@MinUnits@）@AD*100@% %i:scaleAD%<br>（@MinUnits@）@AD*100@% %i:scaleAD%；每进行 @NumOfAttacks@ 次普攻发射一枚火箭，火箭造成双倍伤害。 | 否；依据：`job.js` → `characterid=TFT13_Martialist` → `name` |
| `TFT13_Titan`<br>名称：Sentinel<br>描述：Your team gains Armor and Magic Resist. Sentinels gain triple.<br><br>(@MinUnits@) @BonusArmor@ %i:scaleArmor%%i:scaleMR% | **哨兵** · 已核对（国服 S13 数据）<br>描述：己方队伍获得护甲和魔抗。哨兵获得三倍加成。<br><br>（@MinUnits@）@BonusArmor@ %i:scaleArmor%%i:scaleMR% | 否；依据：`job.js` → `characterid=TFT13_Titan` → `name` |
| `TFT13_Sniper`<br>名称：Sniper<br>描述：Snipers deal more damage to targets farther away.<br><br>(@MinUnits@) @PercentDamageIncrease@% damage per hex<br>(@MinUnits@) @PercentDamageIncrease@% damage per hex<br>(@MinUnits@) @PercentDamageIncrease@% damage per hex and +@BonusHexRangeIncrease@ Attack Range | **狙神** · 已核对（国服 S13 数据）<br>描述：狙神对距离更远的目标造成更多伤害。<br><br>（@MinUnits@）每相距 1 格，伤害提高 @PercentDamageIncrease@%<br>（@MinUnits@）每相距 1 格，伤害提高 @PercentDamageIncrease@%<br>（@MinUnits@）每相距 1 格，伤害提高 @PercentDamageIncrease@%，攻击距离增加 @BonusHexRangeIncrease@ 格。 | 否；依据：`job.js` → `characterid=TFT13_Sniper` → `name` |
| `TFT13_Watcher`<br>名称：Watcher<br>描述：Watchers gain Durability, increased while above @HealthBreakpoint*100@% Health.<br><br>(@MinUnits@) @BaseDR*100@% or @IncreasedDR*100@% %i:scaleDR%<br> | **监察** · 已核对（国服 S13 数据）<br>描述：监察获得伤害减免；生命值高于 @HealthBreakpoint*100@% 时，加成提高。<br><br>（@MinUnits@）@BaseDR*100@% 或 @IncreasedDR*100@% %i:scaleDR% | 否；依据：`job.js` → `characterid=TFT13_Watcher` → `name` |

## 5. 现有强化名及描述（6）

| 英文原文 | 中文译文 | 是否存疑 |
| --- | --- | --- |
| `TFT_Augment_Manaflow1`<br>名称：Manaflow I<br>描述：Your units that start combat in the back row gain @ManaPerAttack@ additional Mana per attack. | **法力流 I** · 已核对（国服 S13 数据）<br>描述：战斗开始时位于最后一排的己方单位，每次普攻额外获得 @ManaPerAttack@ 法力值。 | 存疑：国服 15.6 description 为“后2排”，14.24 英文为 back row；只核对名称，不据此改为后两排 |
| `TFT9_Augment_PumpingUp`<br>名称：Pumping Up I<br>描述：Your team gains @BaseAS@% Attack Speed now. Each round after, they gain @IncreasePerRound@% more. (current Attack Speed: @TFTUnitProperty.item:TFT9_PumpingUpRounds@%) | **打气 I** · 已核对（国服 S13 数据）<br>描述：己方队伍立即获得 @BaseAS@% 攻击速度。此后每过一轮，再增加 @IncreasePerRound@%。（当前攻击速度加成：@TFTUnitProperty.item:TFT9_PumpingUpRounds@%） | 否 |
| `TFT_Augment_InvestmentStrategy1`<br>名称：Investment Strategy I<br>描述：Your champions gain @HealthPerInterest@ permanent max health per interest you earn. | **投资策略 I** · 已核对（国服 S13 数据）<br>描述：你每赚取一次利息收入，己方英雄按收入金额每 1 金币永久增加 @HealthPerInterest@ 最大生命值。 | 备注：国服 description 为“每获得1利息”，支持按利息金额表述；数值和变量保留 14.24b |
| `TFT_Augment_BulkyBuddies1`<br>名称：Bulky Buddies I<br>描述：Allies that start combat next to exactly 1 other ally gain @HealthBonus@ Health. When that champion dies, the other gains a @ShieldAmount*100@% max Health Shield for @ShieldDuration@ seconds. | **巨大伙伴 I** · 已核对（国服 S13 数据）<br>描述：战斗开始时恰好与 1 名其他友军相邻的友军获得 @HealthBonus@ 生命值。当这对友军中的一名死亡时，另一名获得相当于最大生命值 @ShieldAmount*100@% 的护盾，持续 @ShieldDuration@ 秒。 | 否 |
| `TFT_Augment_Placebo`<br>名称：Placebo<br>描述：Gain @Gold@ gold. Your team gains @AttackSpeed*100@% Attack Speed. | **安慰剂** · 已核对（国服 S13 数据）<br>描述：获得 @Gold@ 金币。己方队伍获得 @AttackSpeed*100@% 攻击速度。 | 否 |
| `TFT_Augment_GlassCannonI`<br>名称：Glass Cannon I<br>描述：Units that start combat in the back row begin combat at @Health*100@% health but gain @DamageAmp*100@% Damage Amp. | **玻璃大炮 I** · 已核对（国服 S13 数据）<br>描述：战斗开始时位于最后一排的单位，以 @Health*100@% 生命值开始战斗，但获得 @DamageAmp*100@% 伤害增幅。 | 备注：国服用“后排”，14.24 英文为 back row；本文描述保留原版本的“最后一排” |

## 6. 现有异常名及描述（3）

异常中文名称已由 [国服 14.24 公告](https://lol.qq.com/gicp/news/662/37055498.html)“异常突变”章节确认，逐项标为“已核对（国服 14.24 公告）”；仅核对名称，客户端 apiName 仍缺。英文效果由 2026-10-07 查阅网页补齐，与 main 当前效果数值一致；来源见各行。Wiki 页标识版本 oldid=3848901（源模块引用版本），但它是社区资料而非客户端原件；MOBAFire 是 14.24 补丁解读。译文与项目额外执行条件分开列出，后者取自 `anomalies.ts`，本文不改变规则。Wiki 小段文字的中译由本清单提供，原作者见其页面历史，按该页 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) 标示来源。

| 英文原文 | 中文译文 | 是否存疑 |
| --- | --- | --- |
| `titanic-strikes`（项目 ID）<br>名称：Titanic Strikes<br>描述：Attacks deal an additional 40% Attack Damage to the target and adjacent enemies.<br>来源：[Wiki 异常表](https://wiki.leagueoflegends.com/en-us/TFT:Anomaly) | **泰坦打击** · 已核对（国服 14.24 公告）<br>普攻对目标及相邻敌人额外造成相当于 40% 攻击力的伤害。<br>项目显示补充：伤害类型为物理伤害，范围按现有 1 格邻域规则。 | 备注：名称依据 [国服 14.24 公告](https://lol.qq.com/gicp/news/662/37055498.html)“异常突变”章节；客户端 apiName 仍缺；项目显示补充不是公告原文 |
| `mage-armor`（项目 ID）<br>名称：Mage Armor<br>描述：Gain Armor and Magic Resist equal to 50% of Ability Power.<br>来源：[MOBAFire 14.24 摘录](https://www.mobafire.com/league-of-legends/news/tft-14-24) | **法师护甲** · 已核对（国服 14.24 公告）<br>获得护甲和魔抗，数值分别相当于法术强度的 50%。<br>项目显示补充：以转换前最终法术强度计算。 | 备注：名称依据 [国服 14.24 公告](https://lol.qq.com/gicp/news/662/37055498.html)“异常突变”章节；客户端 apiName 仍缺；英文描述来自原补丁解读网页，非客户端归档 |
| `kill-streak`（项目 ID）<br>名称：Kill Streak<br>描述：Gain 20 Mana each kill.<br>来源：[Wiki 异常表](https://wiki.leagueoflegends.com/en-us/TFT:Anomaly) | **连杀** · 已核对（国服 14.24 公告）<br>每次击杀获得 20 法力值。<br>项目显示补充：仅在当前模拟步仍存活时获得。 | 备注：名称依据 [国服 14.24 公告](https://lol.qq.com/gicp/news/662/37055498.html)“异常突变”章节；客户端 apiName 仍缺；同模拟步存活判断为现有项目补充 |

## 7. M8 装备名及效果描述（44：8 组件 + 36 成装）

效果原文完整翻译，含唯一性、次数、占栏和追踪标签。基础属性摘要单独标记为 B1 字段摘要，单位沿用 B1，不能混入英文 desc 或宣称官方中文 tooltip。死亡之刃和死亡之帽的 desc 只有风味文本，因此摘要补列 B1 采纳的伤害增幅；红霸符同样沿用 B1 的冲突裁决。成装通过英文 apiName 匹配 B1 清单，中文名称另按国服 equip.js 的 englishName 精确核对；名称已核对不代表效果已采用 15.6。

| 英文原文 | 中文译文 | 是否存疑 |
| --- | --- | --- |
| `TFT_Item_SparringGloves`<br>名称：Sparring Gloves<br>描述：+@CritChance@ Critical Strike Chance<br>基础属性摘要（B1字段；非英文 desc）：CritChance: 20% Critical Strike Chance | **拳套** · 已核对（国服 S13 数据）<br>描述：+@CritChance@ 暴击几率<br>基础属性摘要：20% 暴击几率。 | 存疑：原文 @CritChance@ 未带 %，原样保留；基础摘要按 B1 单位为 20% |
| `TFT_Item_ThiefsGloves`<br>名称：Thief's Gloves<br>描述：Each round: Equip 2 random items.<br><br>[Consumes 3 item slots.]<br>@TFTUnitProperty.:TFT_BindOnEquipTRA@<br>基础属性摘要（B1字段；非英文 desc）：Health: 150 Health; CritChance: 20% Critical Strike Chance | **窃贼手套** · 已核对（国服 S13 数据）<br>描述：每轮：装备 2 件随机装备。<br><br>【占用 3 个装备格】<br>@TFTUnitProperty.:TFT_BindOnEquipTRA@<br>基础属性摘要：150 生命值；20% 暴击几率。 | 存疑：保留未解析的绑定宏 @TFTUnitProperty.:TFT_BindOnEquipTRA@，其显示内容待核对 |
| `TFT_Item_RapidFireCannon`<br>名称：Red Buff<br>描述：Attacks and Abilities @BurnPercent@% Burn and @HealingReductionPct@% Wound enemies for @Duration@ seconds.<br><br>Burn: Deals a percent of the target's max Health as true damage every second<br>Wound: Reduces healing received<br>基础属性摘要（B1字段；非英文 desc）：AS: 35% Attack Speed; B1 adopted Damage Amp: 3% | **红霸符** · 已核对（国服 S13 数据）<br>描述：普攻和技能对敌人施加 @BurnPercent@% 灼烧和 @HealingReductionPct@% 重伤，持续 @Duration@ 秒。<br><br>灼烧：每秒造成相当于目标最大生命值一定百分比的真实伤害。<br>重伤：降低受到的治疗效果。<br>基础属性摘要：35% 攻击速度；3% 伤害增幅（B1采纳值）。 | 备注：legacy apiName 对应 Red Buff（红霸符），勿改为 TFT_Item_RedBuff；15.6 effect 为 6% 额外伤害，摘要仍沿用 B1 采纳 3% |
| `TFT_Item_RedBuff`<br>名称：Sunfire Cape<br>描述：Gain @BonusPercentHP*100@% max Health. <br><br>Every @ICD@ seconds, deal @BurnPercent@% Burn and @GrievousWoundsPercent@% Wound to an enemy within @HexRange@ hexes for @BurnDuration@ seconds.<br><br>[Unique - only 1 per champion]<br>Burn: Deals a percent of the target's max Health as true damage every second<br>Wound: Reduces healing received<br>基础属性摘要（B1字段；非英文 desc）：Armor: 20 Armor; Health: 150 Health | **日炎斗篷** · 已核对（国服 S13 数据）<br>描述：获得 @BonusPercentHP*100@% 最大生命值。<br><br>每 @ICD@ 秒，对 @HexRange@ 格内的一名敌人施加 @BurnPercent@% 灼烧和 @GrievousWoundsPercent@% 重伤，持续 @BurnDuration@ 秒。<br><br>【唯一：每名英雄限 1 件】<br>灼烧：每秒造成相当于目标最大生命值一定百分比的真实伤害。<br>重伤：降低受到的治疗效果。<br>基础属性摘要：20 护甲；150 生命值。 | 备注：legacy apiName 对应 Sunfire Cape（日炎斗篷），勿与 Red Buff（红霸符）混用 |
| `TFT_Item_Redemption`<br>名称：Redemption<br>描述：Heal allies within 1 hex for @MissingHealthHeal@% of their missing Health every @HealTickRate@ seconds. They also gain @AoEDamageReduction@% Durability for @HealTickRate@ seconds (this does not stack).<br><br>Healing: @TFTUnitProperty.item:TFT_Tracker_Value1@<br>基础属性摘要（B1字段；非英文 desc）：Mana: 15 starting Mana; Health: 150 Health | **救赎** · 已核对（国服 S13 数据）<br>描述：每 @HealTickRate@ 秒，治疗 1 格内的友军，治疗量相当于其已损失生命值的 @MissingHealthHeal@%。他们还会获得 @AoEDamageReduction@% 伤害减免，持续 @HealTickRate@ 秒（此效果不叠加）。<br><br>治疗量：@TFTUnitProperty.item:TFT_Tracker_Value1@<br>基础属性摘要：15 初始法力值；150 生命值。 | 备注：国服明确使用“伤害减免”并包括单体和群体目标伤害；不按旧字段名缩窄为范围减伤 |
| `TFT_Item_AdaptiveHelm`<br>名称：Adaptive Helm<br>描述：Combat start: Gain different bonuses based on starting position.<br><br>Front Two Rows: @FrontRowBonusResists@ Armor and Magic Resist. Gain @FrontLineManaPerHit@ Mana when struck by an attack.<br><br>Back Two Rows: @BackRowBonusAP@ Ability Power. Gain @ManaPerTickrate@ Mana every @ManaTickrate@ seconds.<br><br>基础属性摘要（B1字段；非英文 desc）：AP: 10 Ability Power; MagicResist: 20 Magic Resist; Mana: 15 starting Mana | **适应性头盔** · 已核对（国服 S13 数据）<br>描述：战斗开始时：根据初始站位获得不同加成。<br><br>前两排：获得 @FrontRowBonusResists@ 护甲和魔抗。受到普攻命中时获得 @FrontLineManaPerHit@ 法力值。<br><br>后两排：获得 @BackRowBonusAP@ 法术强度。每 @ManaTickrate@ 秒获得 @ManaPerTickrate@ 法力值。<br>基础属性摘要：10 法术强度；20 魔抗；15 初始法力值。 | 否 |
| `TFT_Item_ArchangelsStaff`<br>名称：Archangel's Staff<br>描述：Combat start: Gain @APPerInterval@ Ability Power every @IntervalSeconds@ seconds in combat.<br>基础属性摘要（B1字段；非英文 desc）：AP: 20 Ability Power; Mana: 15 starting Mana | **大天使之杖** · 已核对（国服 S13 数据）<br>描述：战斗开始时：战斗中每 @IntervalSeconds@ 秒获得 @APPerInterval@ 法术强度。<br>基础属性摘要：20 法术强度；15 初始法力值。 | 否 |
| `TFT_Item_BFSword`<br>名称：B.F. Sword<br>描述：%i:scaleAD% +@AD*100@% Attack Damage<br>基础属性摘要（B1字段；非英文 desc）：AD: 10% Attack Damage | **暴风大剑** · 已核对（国服 S13 数据）<br>描述：%i:scaleAD% +@AD*100@% 攻击力<br>基础属性摘要：10% 攻击力。 | 否 |
| `TFT_Item_Bloodthirster`<br>名称：Bloodthirster<br>描述：Once per combat at @HealthThreshold@% Health, gain a @ShieldHealthPercent@% max Health Shield that lasts up to @ShieldDuration@ seconds.<br>基础属性摘要（B1字段；非英文 desc）：AD: 15% Attack Damage; AP: 15 Ability Power; MagicResist: 20 Magic Resist; StatOmnivamp: 20% Omnivamp | **饮血剑** · 已核对（国服 S13 数据）<br>描述：每场战斗一次：生命值达到 @HealthThreshold@% 时，获得相当于最大生命值 @ShieldHealthPercent@% 的护盾，最多持续 @ShieldDuration@ 秒。<br>基础属性摘要：15% 攻击力；15 法术强度；20 魔抗；20% 全能吸血。 | 否 |
| `TFT_Item_BlueBuff`<br>名称：Blue Buff<br>描述：Gain @ManaRefund@ Mana after casting. <br><br>When the holder gets a takedown, they deal @DamageAmp*100@% more damage for @TakedownTimer@ seconds.<br><br>[Unique - only 1 per champion]<br>基础属性摘要（B1字段；非英文 desc）：AD: 15% Attack Damage; AP: 15 Ability Power; Mana: 30 starting Mana | **蓝霸符** · 已核对（国服 S13 数据）<br>描述：施放技能后获得 @ManaRefund@ 法力值。<br><br>携带者参与击杀后，造成的伤害提高 @DamageAmp*100@%，持续 @TakedownTimer@ 秒。<br><br>【唯一：每名英雄限 1 件】<br>基础属性摘要：15% 攻击力；15 法术强度；30 初始法力值。 | 否 |
| `TFT_Item_BrambleVest`<br>名称：Bramble Vest<br>描述：Gain @PercentMaxHP*100@% max health.<br><br>Take @AutoDamageReduction*100@% reduced damage from attacks. When struck by any attack, deal @1StarAoEDamage@ magic damage to all adjacent enemies.<br><br>Cooldown: @ICD@ seconds<br>基础属性摘要（B1字段；非英文 desc）：Armor: 65 Armor | **棘刺背心** · 已核对（国服 S13 数据）<br>描述：获得 @PercentMaxHP*100@% 最大生命值。<br><br>受到的普攻伤害降低 @AutoDamageReduction*100@%。受到任何普攻命中时，对所有相邻敌人造成 @1StarAoEDamage@ 魔法伤害。<br><br>冷却时间：@ICD@ 秒。<br>基础属性摘要：65 护甲。 | 否 |
| `TFT_Item_ChainVest`<br>名称：Chain Vest<br>描述：%i:scaleArmor% +@Armor@ Armor<br>基础属性摘要（B1字段；非英文 desc）：Armor: 20 Armor | **锁子甲** · 已核对（国服 S13 数据）<br>描述：%i:scaleArmor% +@Armor@ 护甲<br>基础属性摘要：20 护甲。 | 否 |
| `TFT_Item_Crownguard`<br>名称：Crownguard<br>描述：Combat start: Gain a @ShieldSize@% max Health Shield for @ShieldDuration@ seconds.<br>When the shield expires, gain @ShieldBonusAP@ Ability Power.<br><br>基础属性摘要（B1字段；非英文 desc）：AP: 20 Ability Power; Armor: 20 Armor; Health: 100 Health | **冕卫** · 已核对（国服 S13 数据）<br>描述：战斗开始时：获得相当于最大生命值 @ShieldSize@% 的护盾，持续 @ShieldDuration@ 秒。护盾结束时，获得 @ShieldBonusAP@ 法术强度。<br>基础属性摘要：20 法术强度；20 护甲；100 生命值。 | 否 |
| `TFT_Item_Deathblade`<br>名称：Deathblade<br>描述：Perfect peace and calm for the holder - and all who face it.<br>基础属性摘要（B1字段；非英文 desc）：AD: 55% Attack Damage; B1 adopted Damage Amp: 8% | **死亡之刃** · 已核对（国服 S13 数据）<br>描述：让携带者——以及所有面对它的人——得到彻底的安宁与平静。<br>基础属性摘要：55% 攻击力；8% 伤害增幅（B1采纳值）。 | 否 |
| `TFT_Item_DragonsClaw`<br>名称：Dragon's Claw<br>描述：Gain @PercentMaxHP*100@% max health.<br><br>Every @HealthRegenInterval@ seconds, heal @PercentHealthDamage@% max Health.<br>基础属性摘要（B1字段；非英文 desc）：MagicResist: 75 Magic Resist | **巨龙之爪** · 已核对（国服 S13 数据）<br>描述：获得 @PercentMaxHP*100@% 最大生命值。<br><br>每 @HealthRegenInterval@ 秒，治疗自身相当于最大生命值 @PercentHealthDamage@% 的生命值。<br>基础属性摘要：75 魔抗。 | 否 |
| `TFT_Item_FrozenHeart`<br>名称：Protector's Vow<br>描述：Once per combat at @HealthThreshold@% Health, gain a @ShieldHealthPercent@% max Health Shield that lasts @ShieldDuration@ seconds and gain @Stats@ Armor and @Stats@ Magic Resist.<br>基础属性摘要（B1字段；非英文 desc）：Armor: 20 Armor; Mana: 30 starting Mana | **圣盾使的誓约** · 已核对（国服 S13 数据）<br>描述：每场战斗一次：生命值达到 @HealthThreshold@% 时，获得相当于最大生命值 @ShieldHealthPercent@% 的护盾，持续 @ShieldDuration@ 秒，并获得 @Stats@ 护甲和 @Stats@ 魔抗。<br>基础属性摘要：20 护甲；30 初始法力值。 | 否 |
| `TFT_Item_GargoyleStoneplate`<br>名称：Gargoyle Stoneplate<br>描述：Gain @ArmorPerEnemy@ Armor and @MRPerEnemy@ Magic Resist for each enemy targeting the holder.<br>基础属性摘要（B1字段；非英文 desc）：Armor: 25 Armor; MagicResist: 25 Magic Resist; Health: 100 Health | **石像鬼石板甲** · 已核对（国服 S13 数据）<br>描述：每有一名敌人以携带者为目标，就获得 @ArmorPerEnemy@ 护甲和 @MRPerEnemy@ 魔抗。<br>基础属性摘要：25 护甲；25 魔抗；100 生命值。 | 否 |
| `TFT_Item_GiantsBelt`<br>名称：Giant's Belt<br>描述：%i:scaleHealth% +@Health@ Health<br>基础属性摘要（B1字段；非英文 desc）：Health: 150 Health | **巨人腰带** · 已核对（国服 S13 数据）<br>描述：%i:scaleHealth% +@Health@ 生命值<br>基础属性摘要：150 生命值。 | 否 |
| `TFT_Item_GuardianAngel`<br>名称：Edge of Night<br>描述：Once per combat: At @HealthThreshold@% Health, briefly become untargetable and shed negative effects. Then, gain @AttackSpeed@% bonus Attack Speed.<br><br>[Unique - only 1 per champion]<br>基础属性摘要（B1字段；非英文 desc）：AD: 10% Attack Damage; Armor: 20 Armor | **夜之锋刃** · 已核对（国服 S13 数据）<br>描述：每场战斗一次：生命值达到 @HealthThreshold@% 时，短暂变为无法被选取，并清除负面效果。随后获得 @AttackSpeed@% 额外攻击速度。<br><br>【唯一：每名英雄限 1 件】<br>基础属性摘要：10% 攻击力；20 护甲。 | 备注：国服该件 effect 写“不可被选取”；术语表统一用“无法被选取”，逐件还原可照录原文 |
| `TFT_Item_GuinsoosRageblade`<br>名称：Guinsoo's Rageblade<br>描述：Attacks grant @AttackSpeedPerStack@% stacking Attack Speed.<br>基础属性摘要（B1字段；非英文 desc）：AS: 10% Attack Speed; AP: 10 Ability Power | **鬼索的狂暴之刃** · 已核对（国服 S13 数据）<br>描述：每次普攻获得可叠加的 @AttackSpeedPerStack@% 攻击速度。<br>基础属性摘要：10% 攻击速度；10 法术强度。 | 否 |
| `TFT_Item_HextechGunblade`<br>名称：Hextech Gunblade<br>描述：Heal the lowest percent Health ally for @AllyHealing*100@% of damage dealt.<br><br>Ally Healing: @TFTUnitProperty.item:TFT_Tracker_Value1@<br>基础属性摘要（B1字段；非英文 desc）：AD: 20% Attack Damage; AP: 20 Ability Power; StatOmnivamp: 15% Omnivamp | **海克斯科技枪刃** · 已核对（国服 S13 数据）<br>描述：治疗生命值百分比最低的友军，治疗量相当于携带者所造成伤害的 @AllyHealing*100@%。<br><br>友军治疗量：@TFTUnitProperty.item:TFT_Tracker_Value1@<br>基础属性摘要：20% 攻击力；20 法术强度；15% 全能吸血。 | 否 |
| `TFT_Item_InfinityEdge`<br>名称：Infinity Edge<br>描述：Abilities can critically strike.<br><br>If the holder's abilities can already critically strike, gain @CritDamageToGive*100@% Critical Strike Damage instead.<br>基础属性摘要（B1字段；非英文 desc）：AD: 35% Attack Damage; CritChance: 35% Critical Strike Chance | **无尽之刃** · 已核对（国服 S13 数据）<br>描述：技能可以暴击。<br><br>如果携带者的技能已经可以暴击，则改为获得 @CritDamageToGive*100@% 暴击伤害。<br>基础属性摘要：35% 攻击力；35% 暴击几率。 | 否 |
| `TFT_Item_IonicSpark`<br>名称：Ionic Spark<br>描述：@MRShred@% Shred enemies within @HexRange@ hexes. When enemies cast an Ability, deal magic damage equal to @ManaRatio@% of the Mana spent.<br><br>Shred: Reduce Magic Resist<br>基础属性摘要（B1字段；非英文 desc）：AP: 15 Ability Power; MagicResist: 25 Magic Resist; Health: 100 Health | **离子火花** · 已核对（国服 S13 数据）<br>描述：对 @HexRange@ 格内的敌人施加 @MRShred@% 魔抗击碎。敌人施放技能时，对其造成相当于所消耗法力值 @ManaRatio@% 的魔法伤害。<br><br>魔抗击碎：降低魔抗。<br>基础属性摘要：15 法术强度；25 魔抗；100 生命值。 | 否 |
| `TFT_Item_JeweledGauntlet`<br>名称：Jeweled Gauntlet<br>描述：Abilities can critically strike.<br><br>If the holder's abilities can already critically strike, gain @CritDamageToGive*100@% Critical Strike Damage instead.<br>基础属性摘要（B1字段；非英文 desc）：AP: 35 Ability Power; CritChance: 35% Critical Strike Chance | **珠光护手** · 已核对（国服 S13 数据）<br>描述：技能可以暴击。<br><br>如果携带者的技能已经可以暴击，则改为获得 @CritDamageToGive*100@% 暴击伤害。<br>基础属性摘要：35 法术强度；35% 暴击几率。 | 否 |
| `TFT_Item_LastWhisper`<br>名称：Last Whisper<br>描述：Physical damage @ArmorReductionPercent@% Sunders the target for @ArmorBreakDuration@ seconds. This effect does not stack.<br><br>[Unique - only 1 per champion]<br>Sunder: Reduce Armor<br>基础属性摘要（B1字段；非英文 desc）：AD: 15% Attack Damage; AS: 20% Attack Speed; CritChance: 20% Critical Strike Chance | **最后的轻语** · 已核对（国服 S13 数据）<br>描述：物理伤害对目标施加 @ArmorReductionPercent@% 护甲击碎，持续 @ArmorBreakDuration@ 秒。此效果不叠加。<br><br>【唯一：每名英雄限 1 件】<br>护甲击碎：降低护甲。<br>基础属性摘要：15% 攻击力；20% 攻击速度；20% 暴击几率。 | 否 |
| `TFT_Item_Leviathan`<br>名称：Nashor's Tooth<br>描述：After casting an Ability, gain @AttackSpeedToGive@% Attack Speed for @ASDuration@ seconds.<br>基础属性摘要（B1字段；非英文 desc）：AS: 10% Attack Speed; AP: 10 Ability Power; Health: 150 Health | **纳什之牙** · 已核对（国服 S13 数据）<br>描述：施放技能后获得 @AttackSpeedToGive@% 攻击速度，持续 @ASDuration@ 秒。<br>基础属性摘要：10% 攻击速度；10 法术强度；150 生命值。 | 否 |
| `TFT_Item_MadredsBloodrazor`<br>名称：Giant Slayer<br>描述：Gain @DamageAmp*100@% additional Damage Amp against enemies with more than @HealthThreshold@ max Health.<br>基础属性摘要（B1字段；非英文 desc）：AD: 25% Attack Damage; AS: 10% Attack Speed; AP: 25 Ability Power | **巨人杀手** · 已核对（国服 S13 数据）<br>描述：对最大生命值超过 @HealthThreshold@ 的敌人，额外获得 @DamageAmp*100@% 伤害增幅。<br>基础属性摘要：25% 攻击力；10% 攻击速度；25 法术强度。 | 否 |
| `TFT_Item_Morellonomicon`<br>名称：Morellonomicon<br>描述：Attacks and Abilities deal @BurnPercent@% Burn and @GrievousWoundsPercent@% Wound to enemies for @BurnDuration@ seconds.<br><br>[Unique - only 1 per champion]<br>Burn: Deals a percent of the target's max Health as true damage every second<br>Wound: Reduces healing received<br>基础属性摘要（B1字段；非英文 desc）：AS: 10% Attack Speed; AP: 25 Ability Power; Health: 150 Health | **莫雷洛秘典** · 已核对（国服 S13 数据）<br>描述：普攻和技能对敌人施加 @BurnPercent@% 灼烧和 @GrievousWoundsPercent@% 重伤，持续 @BurnDuration@ 秒。<br><br>【唯一：每名英雄限 1 件】<br>灼烧：每秒造成相当于目标最大生命值一定百分比的真实伤害。<br>重伤：降低受到的治疗效果。<br>基础属性摘要：10% 攻击速度；25 法术强度；150 生命值。 | 否 |
| `TFT_Item_NeedlesslyLargeRod`<br>名称：Needlessly Large Rod<br>描述：%i:scaleAP% +@AP@ Ability Power<br>基础属性摘要（B1字段；非英文 desc）：AP: 10 Ability Power | **无用大棒** · 已核对（国服 S13 数据）<br>描述：%i:scaleAP% +@AP@ 法术强度<br>基础属性摘要：10 法术强度。 | 否 |
| `TFT_Item_NegatronCloak`<br>名称：Negatron Cloak<br>描述：%i:scaleMR% +@MagicResist@ Magic Resist<br>基础属性摘要（B1字段；非英文 desc）：MagicResist: 20 Magic Resist | **负极斗篷** · 已核对（国服 S13 数据）<br>描述：%i:scaleMR% +@MagicResist@ 魔抗<br>基础属性摘要：20 魔抗。 | 否 |
| `TFT_Item_NightHarvester`<br>名称：Steadfast Heart<br>描述：Gain @BaseDurability*100@% Durability. While above @ThresholdForEmpower*100@% Health, instead gain @EmpoweredDurability*100@% Durability.<br>基础属性摘要（B1字段；非英文 desc）：Armor: 20 Armor; Health: 200 Health; CritChance: 20% Critical Strike Chance | **坚定之心** · 已核对（国服 S13 数据）<br>描述：获得 @BaseDurability*100@% 伤害减免。生命值高于 @ThresholdForEmpower*100@% 时，改为获得 @EmpoweredDurability*100@% 伤害减免。<br>基础属性摘要：20 护甲；200 生命值；20% 暴击几率。 | 否 |
| `TFT_Item_PowerGauntlet`<br>名称：Guardbreaker<br>描述：After damaging a Shield, gain @DamageAmp*100@% additional Damage Amp for @Duration@ seconds.<br>基础属性摘要（B1字段；非英文 desc）：AS: 20% Attack Speed; AP: 10 Ability Power; Health: 150 Health; CritChance: 20% Critical Strike Chance | **破防者** · 已核对（国服 S13 数据）<br>描述：对护盾造成伤害后，额外获得 @DamageAmp*100@% 伤害增幅，持续 @Duration@ 秒。<br>基础属性摘要：20% 攻击速度；10 法术强度；150 生命值；20% 暴击几率。 | 否 |
| `TFT_Item_Quicksilver`<br>名称：Quicksilver<br>描述：Combat start: Gain immunity to crowd control for @SpellShieldDuration@ seconds. During this time, gain @ProcAttackSpeed*100@% Attack Speed every @ProcInterval@ seconds.<br><br>[Unique - only 1 per champion]<br>基础属性摘要（B1字段；非英文 desc）：AS: 30% Attack Speed; MagicResist: 20 Magic Resist; CritChance: 20% Critical Strike Chance | **水银** · 已核对（国服 S13 数据）<br>描述：战斗开始时：获得控制免疫，持续 @SpellShieldDuration@ 秒。期间每 @ProcInterval@ 秒获得 @ProcAttackSpeed*100@% 攻击速度。<br><br>【唯一：每名英雄限 1 件】<br>基础属性摘要：30% 攻击速度；20 魔抗；20% 暴击几率。 | 否 |
| `TFT_Item_RabadonsDeathcap`<br>名称：Rabadon's Deathcap<br>描述：This humble hat can help you make, or unmake, the world itself.<br>基础属性摘要（B1字段；非英文 desc）：AP: 50 Ability Power; B1 adopted Damage Amp: 15% | **灭世者的死亡之帽** · 已核对（国服 S13 数据）<br>描述：这顶不起眼的帽子，能帮你创造世界，或将其毁灭。<br>基础属性摘要：50 法术强度；15% 伤害增幅（B1采纳值）。 | 否 |
| `TFT_Item_RecurveBow`<br>名称：Recurve Bow<br>描述：%i:scaleAS% +@AS@% Attack Speed<br>基础属性摘要（B1字段；非英文 desc）：AS: 10% Attack Speed | **反曲之弓** · 已核对（国服 S13 数据）<br>描述：%i:scaleAS% +@AS@% 攻击速度<br>基础属性摘要：10% 攻击速度。 | 否 |
| `TFT_Item_RunaansHurricane`<br>名称：Runaan's Hurricane<br>描述：Attacks fire a bolt at a nearby enemy, dealing @MultiplierForDamage@% Attack Damage %i:scaleAD% as physical damage.<br>基础属性摘要（B1字段；非英文 desc）：AD: 25% Attack Damage; AS: 10% Attack Speed; MagicResist: 20 Magic Resist | **卢安娜的飓风** · 已核对（国服 S13 数据）<br>描述：普攻会向附近的一名敌人发射弩箭，造成相当于 @MultiplierForDamage@% 攻击力 %i:scaleAD% 的物理伤害。<br>基础属性摘要：25% 攻击力；10% 攻击速度；20 魔抗。 | 否 |
| `TFT_Item_SpearOfShojin`<br>名称：Spear of Shojin<br>描述：Attacks grant @FlatManaRestore@ bonus Mana.<br>基础属性摘要（B1字段；非英文 desc）：AD: 15% Attack Damage; AP: 15 Ability Power; Mana: 15 starting Mana | **朔极之矛** · 已核对（国服 S13 数据）<br>描述：每次普攻额外获得 @FlatManaRestore@ 法力值。<br>基础属性摘要：15% 攻击力；15 法术强度；15 初始法力值。 | 否 |
| `TFT_Item_SpectralGauntlet`<br>名称：Evenshroud<br>描述：@ARReductionAmount@% Sunder enemies within @HexRange@ hexes. Gain @BonusResists@ Armor and Magic Resist for the first @BonusResistDuration@ seconds of combat.<br><br>Sunder: Reduce Armor<br>基础属性摘要（B1字段；非英文 desc）：MagicResist: 20 Magic Resist; Health: 150 Health | **薄暮法袍** · 已核对（国服 S13 数据）<br>描述：对 @HexRange@ 格内的敌人施加 @ARReductionAmount@% 护甲击碎。战斗开始后的前 @BonusResistDuration@ 秒，获得 @BonusResists@ 护甲和魔抗。<br><br>护甲击碎：降低护甲。<br>基础属性摘要：20 魔抗；150 生命值。 | 备注：国服该件 effect 写“护甲削减”；术语表统一 Sunder 为“护甲击碎”，逐件还原原文时可保留前者 |
| `TFT_Item_StatikkShiv`<br>名称：Statikk Shiv<br>描述：Every 3rd attack deals @Damage@ magic damage and @MRShred@% Shreds @1StarBounces@ enemies for @MRShredDuration@ seconds.<br><br>Shred: Reduce Magic Resist<br>基础属性摘要（B1字段；非英文 desc）：AS: 15% Attack Speed; AP: 15 Ability Power; Mana: 15 starting Mana | **斯塔缇克电刃** · 已核对（国服 S13 数据）<br>描述：每第 3 次普攻，对 @1StarBounces@ 名敌人造成 @Damage@ 魔法伤害，并施加 @MRShred@% 魔抗击碎，持续 @MRShredDuration@ 秒。<br><br>魔抗击碎：降低魔抗。<br>基础属性摘要：15% 攻击速度；15 法术强度；15 初始法力值。 | 否 |
| `TFT_Item_SteraksGage`<br>名称：Sterak's Gage<br>描述：Once per combat at @HealthThreshold@% Health, gain @BonusMaxHealthPerc@% max Health and @BonusADToGive@% Attack Damage.<br>基础属性摘要（B1字段；非英文 desc）：AD: 15% Attack Damage; Health: 150 Health | **斯特拉克的挑战护手** · 已核对（国服 S13 数据）<br>描述：每场战斗一次：生命值达到 @HealthThreshold@% 时，获得 @BonusMaxHealthPerc@% 最大生命值和 @BonusADToGive@% 攻击力。<br>基础属性摘要：15% 攻击力；150 生命值。 | 否 |
| `TFT_Item_TearOfTheGoddess`<br>名称：Tear of the Goddess<br>描述：%i:scaleMana% +@Mana@ Mana<br>基础属性摘要（B1字段；非英文 desc）：Mana: 15 starting Mana | **女神之泪** · 已核对（国服 S13 数据）<br>描述：%i:scaleMana% +@Mana@ 法力值<br>基础属性摘要：15 初始法力值。 | 否 |
| `TFT_Item_TitansResolve`<br>名称：Titan's Resolve<br>描述：Gain @StackingAD*100@% Attack Damage and @StackingSP@ Ability Power when attacking or taking damage, stacking up to @StackCap@ times.  <br><br>At full stacks, gain @BonusResistsAtStackCap@ Armor and @BonusResistsAtStackCap@ Magic Resist.<br>基础属性摘要（B1字段；非英文 desc）：AS: 10% Attack Speed; Armor: 20 Armor | **泰坦的坚决** · 已核对（国服 S13 数据）<br>描述：普攻或受到伤害时，获得 @StackingAD*100@% 攻击力和 @StackingSP@ 法术强度，最多叠加 @StackCap@ 层。<br><br>叠满后，获得 @BonusResistsAtStackCap@ 护甲和 @BonusResistsAtStackCap@ 魔抗。<br>基础属性摘要：10% 攻击速度；20 护甲。 | 否 |
| `TFT_Item_UnstableConcoction`<br>名称：Hand Of Justice<br>描述：Gain 2 effects:<br>• @AD_NotStatBar*100@% Attack Damage and @AP_NotStatBar@ Ability Power.<br>• @StatOmnivamp_NotStatBar*100@% Omnivamp.<br><br>While above @HealthThreshold*100@% health, double the Attack Damage and Ability Power. While below @HealthThreshold*100@% Health, double the Omnivamp.<br>基础属性摘要（B1字段；非英文 desc）：Mana: 15 starting Mana; CritChance: 20% Critical Strike Chance | **正义之手** · 已核对（国服 S13 数据）<br>描述：获得 2 项效果：<br>1. @AD_NotStatBar*100@% 攻击力和 @AP_NotStatBar@ 法术强度。<br>2. @StatOmnivamp_NotStatBar*100@% 全能吸血。<br><br>生命值高于 @HealthThreshold*100@% 时，攻击力和法术强度加成翻倍；低于 @HealthThreshold*100@% 时，全能吸血加成翻倍。<br>基础属性摘要：15 初始法力值；20% 暴击几率。 | 否 |
| `TFT_Item_WarmogsArmor`<br>名称：Warmog's Armor<br>描述：Gain @BonusPercentHP*100@% max health.<br>基础属性摘要（B1字段；非英文 desc）：Health: 600 Health | **狂徒铠甲** · 已核对（国服 S13 数据）<br>描述：获得 @BonusPercentHP*100@% 最大生命值。<br>基础属性摘要：600 生命值。 | 否 |

## 8. M9 全英雄名字（63，仅名称）

包含 main 已有的 19 名及其余 44 名；同一英文 apiName 的中文译名与第 2 表保持一致。

| 英文原文 | 中文译文 | 是否存疑 |
| --- | --- | --- |
| `TFT13_Fish`<br>名称：Steb | **斯特卜** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Red`<br>名称：Violet | **蔚奥莱** · 已核对（国服 S13 数据） | 备注：国服名称为“蔚奥莱”；与 Vi（蔚）分开 |
| `TFT13_Chainsaw`<br>名称：Renni | **荏妮** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Amumu`<br>名称：Amumu | **阿木木** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Blue`<br>名称：Powder | **爆爆** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Darius`<br>名称：Darius | **德莱厄斯** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Draven`<br>名称：Draven | **德莱文** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Irelia`<br>名称：Irelia | **艾瑞莉娅** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Lux`<br>名称：Lux | **拉克丝** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Morgana`<br>名称：Morgana | **莫甘娜** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Shooter`<br>名称：Maddie | **麦迪** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Singed`<br>名称：Singed | **辛吉德** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Trundle`<br>名称：Trundle | **特朗德尔** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Vex`<br>名称：Vex | **薇古丝** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Zyra`<br>名称：Zyra | **婕拉** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Akali`<br>名称：Akali | **阿卡丽** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Camille`<br>名称：Camille | **卡蜜尔** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Leona`<br>名称：Leona | **蕾欧娜** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Nocturne`<br>名称：Nocturne | **魔腾** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Prime`<br>名称：Vander | **范德尔** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Rell`<br>名称：Rell | **芮尔** · 已核对（国服 S13 数据） | 否 |
| `TFT13_RenataGlasc`<br>名称：Renata Glasc | **烈娜塔** · 已核对（国服 S13 数据） | 备注：国服 displayName 为“烈娜塔”，采用该显示名，不扩写全名 |
| `TFT13_Sett`<br>名称：Sett | **瑟提** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Tristana`<br>名称：Tristana | **崔丝塔娜** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Urgot`<br>名称：Urgot | **厄加特** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Vladimir`<br>名称：Vladimir | **弗拉基米尔** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Zeri`<br>名称：Zeri | **泽丽** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Ziggs`<br>名称：Ziggs | **吉格斯** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Beardy`<br>名称：Loris | **洛里斯** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Blitzcrank`<br>名称：Blitzcrank | **布里茨** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Cassiopeia`<br>名称：Cassiopeia | **卡西奥佩娅** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Ezreal`<br>名称：Ezreal | **伊泽瑞尔** · 已核对（国服 S13 数据） | 否 |
| `TFT13_FlyGuy`<br>名称：Scar | **刀疤** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Gangplank`<br>名称：Gangplank | **普朗克** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Gremlin`<br>名称：Smeech | **史密奇** · 已核对（国服 S13 数据） | 否 |
| `TFT13_KogMaw`<br>名称：Kog'Maw | **克格莫** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Nami`<br>名称：Nami | **娜美** · 已核对（国服 S13 数据） | 否 |
| `TFT13_NunuWillump`<br>名称：Nunu & Willump | **努努和威朗普** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Swain`<br>名称：Swain | **斯维因** · 已核对（国服 S13 数据） | 否 |
| `TFT13_TwistedFate`<br>名称：Twisted Fate | **崔斯特** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Ambessa`<br>名称：Ambessa | **安蓓萨** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Corki`<br>名称：Corki | **库奇** · 已核对（国服 S13 数据） | 否 |
| `TFT13_DrMundo`<br>名称：Dr. Mundo | **蒙多医生** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Ekko`<br>名称：Ekko | **艾克** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Elise`<br>名称：Elise | **伊莉丝** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Garen`<br>名称：Garen | **盖伦** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Heimerdinger`<br>名称：Heimerdinger | **黑默丁格** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Illaoi`<br>名称：Illaoi | **俄洛伊** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Silco`<br>名称：Silco | **希尔科** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Twitch`<br>名称：Twitch | **图奇** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Vi`<br>名称：Vi | **蔚** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Zoe`<br>名称：Zoe | **佐伊** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Caitlyn`<br>名称：Caitlyn | **凯特琳** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Jayce`<br>名称：Jayce | **杰斯** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Jinx`<br>名称：Jinx | **金克丝** · 已核对（国服 S13 数据） | 否 |
| `TFT13_LeBlanc`<br>名称：LeBlanc | **乐芙兰** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Lieutenant`<br>名称：Sevika | **塞薇卡** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Malzahar`<br>名称：Malzahar | **玛尔扎哈** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Mordekaiser`<br>名称：Mordekaiser | **莫德凯撒** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Rumble`<br>名称：Rumble | **兰博** · 已核对（国服 S13 数据） | 否 |
| `TFT13_MissMage`<br>名称：Mel | **梅尔** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Viktor`<br>名称：Viktor | **维克托** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Warwick`<br>名称：Warwick | **沃里克** · 已核对（国服 S13 数据） | 否 |

## 9. M9 全羁绊名字（37，仅名称）

包含 29 常规/专属羁绊及 8 强化解锁关系；后者按台账保留，不表示已解锁或已实现。5 个已有羁绊与第 4 表同名。

| 英文原文 | 中文译文 | 是否存疑 |
| --- | --- | --- |
| `TFT13_Ambusher`<br>名称：Ambusher | **伏击专家** · 已核对（国服 S13 数据） | 否；依据：`job.js` → `characterid=TFT13_Ambusher` → `name` |
| `TFT13_Bruiser`<br>名称：Bruiser | **格斗家** · 已核对（国服 S13 数据） | 否；依据：`job.js` → `characterid=TFT13_Bruiser` → `name` |
| `TFT13_Challenger`<br>名称：Quickstriker | **迅击战士** · 已核对（国服 S13 数据） | 否；依据：`job.js` → `characterid=TFT13_Challenger` → `name` |
| `TFT13_FormSwapper`<br>名称：Form Swapper | **双形战士** · 已核对（国服 S13 数据） | 否；依据：`job.js` → `characterid=TFT13_FormSwapper` → `name` |
| `TFT13_Infused`<br>名称：Dominator | **统领** · 已核对（国服 S13 数据） | 否；依据：`job.js` → `characterid=TFT13_Infused` → `name` |
| `TFT13_Invoker`<br>名称：Visionary | **先知** · 已核对（国服 S13 数据） | 否；依据：`job.js` → `characterid=TFT13_Invoker` → `name` |
| `TFT13_Martialist`<br>名称：Artillerist | **炮手** · 已核对（国服 S13 数据） | 否；依据：`job.js` → `characterid=TFT13_Martialist` → `name` |
| `TFT13_Pugilist`<br>名称：Pit Fighter | **搏击手** · 已核对（国服 S13 数据） | 否；依据：`job.js` → `characterid=TFT13_Pugilist` → `name` |
| `TFT13_Sniper`<br>名称：Sniper | **狙神** · 已核对（国服 S13 数据） | 否；依据：`job.js` → `characterid=TFT13_Sniper` → `name` |
| `TFT13_Sorcerer`<br>名称：Sorcerer | **法师** · 已核对（国服 S13 数据） | 否；依据：`job.js` → `characterid=TFT13_Sorcerer` → `name` |
| `TFT13_Titan`<br>名称：Sentinel | **哨兵** · 已核对（国服 S13 数据） | 否；依据：`job.js` → `characterid=TFT13_Titan` → `name` |
| `TFT13_Watcher`<br>名称：Watcher | **监察** · 已核对（国服 S13 数据） | 否；依据：`job.js` → `characterid=TFT13_Watcher` → `name` |
| `TFT13_BloodHunter`<br>名称：Blood Hunter | **祖安怒兽** · 已核对（国服 S13 数据） | 否 |
| `TFT13_MachineHerald`<br>名称：Machine Herald | **机械先驱** · 已核对（国服 S13 数据） | 否 |
| `TFT13_MissMageTrait`<br>名称：Banished Mage | **放逐法师** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Teamup_Betrayal`<br>名称：Betrayal | **背叛** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Teamup_BloodBrothers`<br>名称：What Could Have Been | **义兄弟** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Teamup_Geniuses`<br>名称：Geniuses | **天才** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Teamup_Menaces`<br>名称：Menaces | **危险人物** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Teamup_Mentorship`<br>名称：Martial Law | **军事管制** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Teamup_Reunion`<br>名称：Reunion | **重新联合** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Teamup_Sisters`<br>名称：Sisters | **姐妹** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Teamup_UnlikelyDuo`<br>名称：Unlikely Duo | **意外搭档** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Academy`<br>名称：Academy | **皮城学院** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Ambassador`<br>名称：Emissary | **外交官** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Cabal`<br>名称：Black Rose | **黑色玫瑰** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Crime`<br>名称：Chem-Baron | **炼金男爵** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Experiment`<br>名称：Experiment | **试验品** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Family`<br>名称：Family | **家人** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Hextech`<br>名称：Automata | **海克斯机械** · 已核对（国服 S13 数据） | 否 |
| `TFT13_HighRoller`<br>名称：High Roller | **百变铁手** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Hoverboard`<br>名称：Firelight | **野火帮** · 已核对（国服 S13 数据） | 否 |
| `TFT13_JunkerKing`<br>名称：Junker King | **机械公敌** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Rebel`<br>名称：Rebel | **蓝发小队** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Scrap`<br>名称：Scrap | **极客** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Squad`<br>名称：Enforcer | **执法官** · 已核对（国服 S13 数据） | 否 |
| `TFT13_Warband`<br>名称：Conqueror | **铁血征服者** · 已核对（国服 S13 数据） | 否 |

## 10. 校对结果与交付边界

- 名称覆盖：19 现有英雄、19 技能、5 羁绊、6 强化、3 异常、44 装备、63 M9 英雄、37 M9 羁绊；不扩展 M9 技能或羁绊效果。
- 精确匹配：63 个不同英雄 apiName（第 2、8 表共 82 行）、19 个技能、44 件装备、6 个强化均已核对；37 个 M9 羁绊已全部核对：25 个在 race.js、12 个在 job.js 精确匹配；第 4 表的 5 个已有羁绊也已按 job.js 核对。47 条术语逐条附描述字段证据；复合术语另记其他记录依据和版本疑点。
- 第 6 表的 3 个异常名已由国服 14.24 公告核对；客户端 apiName 仍缺，保留项目 ID，不以名称核对状态冒充精确身份匹配。全部 196 行名称均已核对（193 行国服 S13 数据、3 行国服 14.24 公告），仍存疑的是部分描述/身份字段，不是这些中文名称。
- 名称已核对与描述存疑可同时存在。英文描述、占位符、动态图标、百分比及 B1 摘要仍取原版本；15.6 描述只作名称/用词证据，不改现有规则、版本或 digest。
- 已检查文档覆盖、精确身份匹配、名称状态、术语证据、原文/占位符/数值保留，以及归档字节数和 SHA-256；依据 AGENTS.md，纯文档任务不运行完整游戏验收。

## 11. 官方文件缺失项与疑点

### 11.1 补充来源与异常身份字段边界

12 个职业羁绊均已在 job.js 的 characterid 精确找到，名称与原译名一致；第 4、9 表的待核名称已全部解除。race.js 的 25 个种族/专属/关系羁绊与 job.js 的 12 个职业羁绊合计覆盖 37 个 M9 羁绊。job.js 的额外“召唤物”记录 characterid 为空，不扩入清单。

以下三个异常的中文名称已由 [国服 14.24 公告](https://lol.qq.com/gicp/news/662/37055498.html)“异常突变”章节确认；公告未给客户端 apiName，仍用项目 ID，不将名称已核对误作身份字段已补齐。

| 项目 ID | 中文名称 / 状态 | 仍缺少的证据 |
| --- | --- | --- |
| `titanic-strikes` | 泰坦打击 · 已核对（国服 14.24 公告） | 客户端 apiName；项目附加执行条件并非公告原文 |
| `mage-armor` | 法师护甲 · 已核对（国服 14.24 公告） | 客户端 apiName；原英文效果仍取已标来源 |
| `kill-streak` | 连杀 · 已核对（国服 14.24 公告） | 客户端 apiName；项目附加执行条件并非公告原文 |

### 11.2 名称已核对，描述或用法仍需留意

| 条目 | 官方证据 / 疑点 | 本文处理 |
| --- | --- | --- |
| `TFT13_Leona` 技能 | skillName 为“魔法坦克”，不同于英文 Eclipse 的字面 | 按国服名称；14.24b 描述保持原效果 |
| `TFT_Augment_Manaflow1` | hex.js description 写“后2排”，14.24 英文写 back row | 名称“法力流 I”已核对；站位范围仍待同版本原件核对，不扩为后两排 |
| `TFT_Augment_GlassCannonI` / back row | 国服写“后排”，本次描述原译为“最后一排” | 术语表采用“后排”；具体 14.24b 范围解释保持原文档，不扩大 |
| `TFT_Item_SpectralGauntlet` / Sunder | 薄暮法袍 effect 写“护甲削减”，厄加特 skillIntroduce、最后的轻语 effect 写“护甲击碎” | 术语表和本表人工译文统一“护甲击碎”；还原逐件官方原文时可保留其写法 |
| `TFT_Item_GuardianAngel` / untargetable | 夜之锋刃 effect 写“不可被选取”，`TFT4_Item_OrnnZhonyasParadox` effect 写“无法被选取” | 术语表用后者；逐件官方原文可用前者 |
| `TFT_Item_RapidFireCannon` / `TFT_Item_RedBuff` | legacy 标识实际对应红霸符 / 日炎斗篷；红霸符 15.6 effect 写“6%额外伤害” | 保持正确标识对应，B1 采纳的 3% 不改 |
| `TFT_Item_SparringGloves` | 14.24 原文 @CritChance@ 未带 % | 变量原样保留；摘要仍按 B1 的 20% |
| `TFT_Item_ThiefsGloves` | 14.24 原文有未解析绑定宏；国服 effect 没有可供对应的宏文本 | 名称已核对；绑定宏显示内容仍待核，不删除或猜测 |
| 15.6 与 14.24b 的其他效果差异 | 蓝霸符写降低技能法力消耗；朔极之矛写每第 3 次攻击回复；莫雷洛秘典写用技能造成伤害时触发 | 不迁入描述或规则；此归档仅用于名称/用词，其他数值同理 |
