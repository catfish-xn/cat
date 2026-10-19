# S13 剩余强化与异常：通用机制清单

> D1 只读源码盘点；本提交只新增本文。不是内容实现、测试报告、玩法裁决或合并许可。由 dot 在独立云端 clone 亲自完成；用户已批准替代任务书中的 Windows clone 位置。本机 set13 主工作区不改。

## 1. 固定范围与版本

|标记|完整 SHA|用途|
|---|---|---|
|B|`a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53`|固定基线，v12；分支 `docs/s13-mechanism-inventory` 从这里建立|
|P1|`a3c98f2445df3357aa3a9ead56a861a46b5848a9`|只读参考，不合并，不视为已签收|
|P2|`a372263ed3e735b9510b7a89199838a8115ee0b8`|只读参考，不合并，不视为已签收|
|P3|`e703a8d3827e832633490822d4d67d74326ce65f`|只读参考，不合并，不视为已签收|
|P4|`80493ab25f8ec267a49ed9b5acdfd32d229e1504`|只读参考，不合并，不视为已签收|

核查时 `origin/multiplayer` 仍为上述 B。P4 远端已前进至 `dfec3d38f9b90109e84167541734847a4310a99f`，相对指定 80493ab 仅两个生成指纹 JSON 有差异；本报告全部 P4 行号固定为指定 80493ab，不混用运行结论。P1/P2/P3 远端与任务书固定头一致。

**范围纠正：P1 剩余 8 项是 3 个强化 + 5 个异常，并非 8 个强化。** M9 三份文档写于较早开发阶段：`M9_STATUS.md:5` 的“暂停”、旧英雄数量等是历史记录，不能覆盖当前代码；台账主要是英雄/羁绊，并非完整强化/异常目录。四星/关系范围的旧待定记录见 `M9_STATUS.md:30–32`，本任务不替用户新增裁决。

表一共 **59 个去重条目**：P1 剩余 8 项；文档额外具名强化 12 项；补充 raw 未注册异常 39 项。补充 raw 是机制取证候选，不把有名字/有系数等同于 14.24 标准模式一定会出现。模板 `TFT13_GoopBuff_GoopTemplate` 明确剔除。

表一15个强化身份均已逐一核对属于 raw `setData/8`、`TFTSet13_Evolved.augments` 的312成员集合；这只证明源模式归属，不代替已实现判定。

强化覆盖按任务指定文档、各包文档及 W4 排除清单中的明确身份取并集；**未宣称穷尽 raw 标准模式 308/312 个强化的全部未实现项**。未被这些文档具名的 raw 强化不凭关键词自动立项。追加异常候选是为避免漏掉跨轮成长、变形与羁绊基础设施。原始 map22 有97个非Tooltip的 GoopBuff 对象（含模板/残留），不是“97个可上线异常”。

## 2. 排除已存在定义，区分“代码有”与“整合通过”

|范围|实际新增注册量|只读定义/接线证据|本报告处理|
|---|---|---|
|B|强化30、异常30|`content/augments.ts`、`content/anomalies.ts` 及展开的policy/G23表|不重复列为缺失内容|
|P1|强化6、异常1|`content/s13-p1-augments.ts:4–21`、`content/anomalies.ts`、`anomaly-acquisition.ts`|双刀流已有实现，验收问题另算；其余8仍列入|
|P2|强化14、异常3|`content/s13-augments-p2.ts:5–16` 通过source分型；分享能量/剔除弱者/石头皮肤属于异常|文档“17项”不能算17个强化；来源表有字段不等于所有赠品/恢复已闭环|
|P3|强化7、异常7|`content/s13-p3.ts:9–18`、`s13-p3-programs.ts`、`s13-p3-combat.ts`|不重复列火球/龙魂/终结者等已有定义；引用消费者供机制复用|
|P4|异常11|`anomalies/registry.ts:1–14` 与11个模块，注册表真实展开|不再把召唤/位移整个写成空白；未合入B，不能直接当基线接口|

各分支新增定义无交叉时逻辑并集为 **57强化、52异常**，这不是已合并运行目录，也不是本次重新测试数量。P2 明确保留赠品 M5 与联机部署事务缺口；P4 的已实现生命周期也不等于 P1 跨轮暂离已经实现。

### 2.1 可复用与仍须对齐的具体边界
- 已有召唤：B 镜像/分裂/赛恩/炼炉/准备期虚空生物；P4 追加蟹、狼、mini 的source绑定、出生/移除事件。禁止因“可召唤”便声称能复制任意技能/装备/异常。
- 已有护甲继承：P4 `scuttle-familiar.ts:8–12` 排除Shred/Sunder后解析双抗，其余正向增益保留；P2 `startP2Combat` 先取样再分享。裸护甲不能替代这个来源策略。
- P4 文档概述与当前代码须分开：`availability.ts:13–14` 的 `occupiesCell` 是 alive 且非代理，保留缺席者的占格预留；不能照旧文“缺席都不占格”自行改语义。新消费者先确认实际政策。
- B `round-settlement.ts:89–90` 从当前准备棋盘重新 `deriveTraits` 核对征服者与炼金男爵；任何增删羁绊/暂离/升星/人口消费者都必须和开战投影同源。B `trait-snapshot.ts:18,24` 仍只读英雄原生traits。
- 本基线没有 P1 所需的准备期完整命令经济重演。`buyXp` 的扣金/grantXp 与 `validPreparationExperience` 的整除检查不能证明实际购买次数；不得为了新6XP购买改成2整除而称修复完成。
- `room.ts:136` 普通deploy未带共享池事务；`:795–797` 明确live席位后续操作不会进入冻结战斗输入。分别是双排领取、贪财实时余额的联机接线依赖，仅模拟层追加字段不够。

## 3. 表一：逐条目 → 机制依赖

每个机制编号后的“已有/部分/缺失”对应表二的精确代码证据。已有只表示可复用基础设施，**全部下列条目本次仍未实现**；若某项可通过已有机制组合完成，状态也不自动等于内容完成。M00标记取证/准入问题，不能当作已冻结数值。

|编号|条目/类别/范围|原版行为或源描述（宏保留，不虚构执行脚本）|所需机制与现状|来源|
|---|---|---|---|---|
|D01|英勇福袋（强化）<br>`TFT10_Augment_HeroicGrabBag`<br>P1剩余|获得@LesserDuplicatorAmount@个【次级英雄复制器】和@gold@金币。   这个物品允许你能复制一个3费或以下的弈子。|M02 部分；M03 缺失|raw en_us `/items/1773` .desc/.effects；map22 `{9226730c}`；中文 `TFT10_Augment_HeroicGrabBag_name`|
|D02|贪财化身（异常）<br>`TFT13_GoopBuff_AvariceIncarnate`<br>P1剩余|获得@GoldCount@金币。获得@FlatPercentDamage@%伤害增幅，并且你每拥有@GoldIncrement@金币就会获得@PercentDamage*100@%额外伤害增幅(至多至@GoldCap@)。|M02 部分；M04 缺失；M10 缺失；M17 部分|raw map22 `{af3697d1}` / `TFT13_GoopBuff_AvariceIncarnate` / `effectAmounts`；文本键 `TFT13_GoopBuff_AvariceIncarnate_Description`|
|D03|名片（异常）<br>`TFT13_GoopBuff_CallingCard`<br>P1剩余|获得一个纹章，且这个纹章与这个弈子的一个非唯一羁绊相匹配。|M01 已有；M02 部分；M09 部分|raw map22 `{b577dcbe}` / `TFT13_GoopBuff_CallingCard` / `effectAmounts`；文本键 `TFT13_GoopBuff_CallingCard_Description`|
|D04|猎头者（异常）<br>`TFT13_GoopBuff_Headhunter`<br>P1剩余|这个弈子获得@StartingAS@%攻击速度。每击杀@NumKills@个弈子，这个弈子会永久获得额外的@StackingAS@%(在【狂暴模式】中翻倍)。 (总计击杀数：@TFTUnitProperty.:TFT13_SetMechanic_EvolveBuff_Headhunter_CurrentKills@)|M05 部分；M06 部分；M14 已有|raw map22 `{950ff929}` / `TFT13_GoopBuff_Headhunter` / `effectAmounts`；文本键 `TFT13_GoopBuff_Headhunter_Description`|
|D05|进入未知（异常）<br>`TFT13_GoopBuff_IntoTheUnknown`<br>P1剩余|该弈子消失@NumRounds@回合。当该弈子归来时，该弈子会获得@GainedAP@法术强度和@GainedAD*100@%攻击力。|M06 部分；M07 缺失；M09 部分；M14 已有|raw map22 `{711fd99c}` / `TFT13_GoopBuff_IntoTheUnknown` / `effectAmounts`；文本键 `TFT13_GoopBuff_IntoTheUnknown_Desc`|
|D06|终极英雄（异常）<br>`TFT13_GoopBuff_UltimateHero`<br>P1剩余|在@NumRounds@回合之后，将1个3星1费弈子升到4星！|M06 部分；M08 缺失；M14 已有|raw map22 `{cf1ee294}` / `TFT13_GoopBuff_UltimateHero` / `effectAmounts`；文本键 `TFT13_GoopBuff_UltimateHero_Description`|
|D07|升级咯！（强化）<br>`TFT6_Augment_MaxLevel10`<br>P1剩余|在你购买经验值的时候，获得额外的@XP@经验值。立刻获得@InitialXP@经验值。|M04 缺失；M09 部分|raw en_us `/items/1727` .desc/.effects；map22 `{782ffaa4}`；中文 `TFT6_Augment_MaxLevel10_Name`|
|D08|双排（强化）<br>`TFT_Augment_DuoQueue`<br>P1剩余|获得@NumUnits@个随机的5费弈子和@NumComponents@件相同的随机基础装备。|M01 已有；M02 部分；M07 缺失；M09 部分|raw en_us `/items/1715` .desc/.effects；map22 `{7315c250}`；中文 `TFT_Augment_DuoQueue_Name`|
|D09|战利品爆炸（强化）<br>`TFT13_Augment_Ambusher`<br>docs/ZH_REVIEW.md:69命名；该文15.6引文不是14.24数值依据|【伏击专家】击杀敌人时有几率掉落战利品，掉落几率受益于暴击几率。所获战利品的价值也可以触发暴击，从而提供更多战利品。获得1个【卡蜜尔】和1个【爆爆】。|M01 已有；M02 部分；M09 部分；M14 已有|raw en_us `/items/20` .desc/.effects；map22 `{5280d1b0}`；中文 `TFT13_Augment_Ambusher_Name`|
|D10|羁绊：背叛（强化）<br>`TFT13_TeamupAugment_Betrayal`<br>M9台账明确关系强化；原范围待决定|【麦迪】的技能和攻击总会瞄准【安蓓萨】的目标。在每一回合中，只要有一方获得至少@NumKills@次击杀，就能获得1个【麦迪】。  获得1个【麦迪】和1个【安蓓萨】。|M02 部分；M05 部分；M06 部分；M14 已有；M19 缺失|raw en_us `/items/17` .desc/.effects；map22 `{3761a31b}`；中文 `TFT13_TeamupAugment_Betrayal`|
|D11|羁绊：本可发生之事（强化）<br>`TFT13_TeamupAugment_BloodBrothers`<br>M9台账明确关系强化；原范围待决定|【希尔科】每次施放技能时，【范德尔】就会获得@MaxHealthGainPerCast@永久最大生命值。【范德尔】每次阵亡时，【希尔科】就会获得@APGainPerDeath@永久法术强度。  获得1个2星【范德尔】、1个【希尔科】和1个【朔极之矛】。|M02 部分；M05 部分；M06 部分；M14 已有；M19 缺失|raw en_us `/items/31` .desc/.effects；map22 `{57242532}`；中文 `TFT_SidekickAugment_BloodBrothers`|
|D12|羁绊：天才（强化）<br>`TFT13_TeamupAugment_Geniuses`<br>M9台账明确关系强化；原范围待决定|当【黑默丁格】施放技能时，【艾克】会释放@NumEkkoAfterImages@个残影，每个残影造成@ReducedEkkoDamage*100@%伤害。当【艾克】施放技能时，【黑默丁格】会发射@NumHeimerMissiles@枚导弹，每枚导弹造成@ReducedHeimerDamage*100@%伤害。  获得1个【黑默丁格】、1个【艾克】和1个【珠光护手】。|M02 部分；M11 部分；M15 部分；M19 缺失|raw en_us `/items/13` .desc/.effects；map22 `{2619c7ea}`；中文 `TFT13_TeamupAugment_Geniuses`|
|D13|羁绊：危险人物（强化）<br>`TFT13_TeamupAugment_Menaces`<br>M9台账明确关系强化；原范围待决定|当【希尔科】在场上时，【爆爆】获得【统领】羁绊但不再受益于【家人】羁绊。当她的猴子爆炸时，它会生成@TOOLTIPONLYNumMonstrosities@个【希尔科】的畸变体。  获得1个2星【爆爆】和1个【希尔科】。|M02 部分；M09 部分；M11 部分；M19 缺失|raw en_us `/items/75` .desc/.effects；map22 `{d7b8a1f5}`；中文 `TFT13_TeamUpAugment_Menaces_name`|
|D14|羁绊：军事管制（强化）<br>`TFT13_TeamupAugment_Mentorship`<br>M9台账明确关系强化；原范围待决定|当【安蓓萨】施放技能时，【凯特琳】对目标进行一次强化攻击，造成@TOOLTIPONLYCAITAD@%伤害。【安蓓萨】获得【凯特琳】的@TOOLTIPONLYADSHARE@%攻击力。  获得1个【凯特琳】和1个【安蓓萨】。|M02 部分；M13 部分；M15 部分；M19 缺失|raw en_us `/items/80` .desc/.effects；map22 `{eb7bdb9c}`；中文 `TFT13_TeamUpAugment_Mentorship`|
|D15|羁绊：重新联合（强化）<br>`TFT13_TeamupAugment_Reunion`<br>M9台账明确关系强化；原范围待决定|当【蔚】施放技能时，【艾克】会朝她的目标释放3个残影，每个残影造成@EkkoAfterImageReducedDamage*100@%伤害。当【艾克】施放技能时，【蔚】会对他的目标打出一道地震波，造成@ViEarthquakeReducedDamage*100@%伤害。  获得1个【蔚】和1个【艾克】。|M02 部分；M11 部分；M15 部分；M19 缺失|raw en_us `/items/0` .desc/.effects；map22 `{00058499}`；中文 `TFT13_TeamupAugment_Reunion`|
|D16|羁绊：姐妹（强化）<br>`TFT13_TeamupAugment_Sisters`<br>M9台账明确关系强化；原范围待决定|获得【姐妹】羁绊。当【蔚】参与一次击杀后，【金克丝】会获得持续@JinxDuration@秒的@ASBuff*100@%额外攻速。当【金克丝】参与一次击杀后，【蔚】会获得持续@ViDuration@秒的@ADBuff*100@%额外攻击力。  获得1个【金克丝】和1个【蔚】。|M02 部分；M14 已有；M19 缺失|raw en_us `/items/33` .desc/.effects；map22 `{59020b98}`；中文 `TFT13_TeamUpAugment_Sisters`|
|D17|羁绊：意外搭档（强化）<br>`TFT13_TeamupAugment_UnlikelyDuo`<br>M9台账明确关系强化；原范围待决定|【金克丝】和【塞薇卡】获得@AD*100@%攻击力和@Health@生命值。当其中一个施放技能时，会给另一个提供@Mana@法力值。【塞薇卡】的钢臂会更加幸运。  获得1个【金克丝】和1个【塞薇卡】。|M02 部分；M13 部分；M15 部分；M19 缺失|raw en_us `/items/4` .desc/.effects；map22 `{10a0e8ec}`；中文 `TFT13_TeamUpAugment_UnlikelyDuo_name`|
|D18|天涯若比邻（强化）<br>`TFT9_Augment_LongDistanceRelationship2`<br>W4排除候选|战斗开始时：你相距最远的那2个弈子会形成一个纽带，分享彼此的@PercentShare*100@%护甲、魔抗、攻击力和法术强度。|M13 部分|raw en_us `/items/1670` .desc/.effects；map22 `{5a31c165}`；中文 `TFT9_Augment_LongDistanceRelationship2_name`|
|D19|月光（强化）<br>`TFT_Augment_Moonlight`<br>W4排除候选|战斗开始时：@NumUnits@个随机的1费弈子在该回合中升为3星，并获得@ADBonus*100@%攻击力和@APBONUS@法术强度。|M01 已有；M08 缺失；M13 部分|raw en_us `/items/1905` .desc/.effects；map22 `{df8a297e}`；中文 `TFT_Augment_Moonlight_name`|
|D20|灵魂连接（强化）<br>`TFT_Augment_SpiritLink1`<br>W4排除候选|己方弈子们每@RegenPeriod@秒治疗自身@BaseRegenBonus*100@%最大生命值。每损失10玩家生命值，这个治疗效果就会提升@RegenPerMissingHP@%。|M13 部分；M14 已有|raw en_us `/items/1646` .desc/.effects；map22 `{4cb3bb7d}`；中文 `TFT_Augment_SpiritLink1_name`|
|D21|皮城学院之灵（异常）<br>`TFT13_GoopBuff_AcademyTrait`<br>raw追加候选；未证明标准报价准入|获得【皮城学院】羁绊、@FlatHealth@ %i:scaleHealth%生命值以及@AttackSpeed*100@% %i:scaleAS%攻击速度。|M09 部分；M13 部分|raw map22 `{a84c6c5a}` / `TFT13_GoopBuff_AcademyTrait` / `effectAmounts`；文本键 `TFT13_GoopBuff_AcademyTrait_Description`|
|D22|刺客（异常）<br>`TFT13_GoopBuff_Assassin`<br>raw追加候选；未证明标准报价准入|战斗开始时：跃至敌方后排并获得@BonusAS*100@%攻击速度。|M00 部分；M12 部分|raw map22 `{9441011c}` / `TFT13_GoopBuff_Assassin` / `effectAmounts`；文本键 `TFT13_SetMechanic_EvolveBuff_Assassin_TRA`|
|D23|Bloodbrawler（未取得官方标题）（异常）<br>`TFT13_GoopBuff_Bloodbrawler`<br>raw待准入/语义核实|未取得可绑定的完整描述；不能仅凭字段猜机制。|M00 部分；M13 部分|raw map22 `{a310c3aa}` / `TFT13_GoopBuff_Bloodbrawler` / `effectAmounts`；文本键 `TFT13_GoopBuff_Bloodbrawler_Description`|
|D24|BountyHunter（未取得官方标题）（异常）<br>`TFT13_GoopBuff_BountyHunter`<br>raw待准入/语义核实|未取得可绑定的完整描述；不能仅凭字段猜机制。|M00 部分；M02 部分；M14 已有|raw map22 `{76e2e174}` / `TFT13_GoopBuff_BountyHunter` / `effectAmounts`；文本键 `TFT13_GoopBuff_BountyHunter_Description`|
|D25|炼金男爵风尚（异常）<br>`TFT13_GoopBuff_ChembaronLifestyle`<br>raw追加候选；未证明标准报价准入|获得【炼金男爵】羁绊。非法装备提供额外的@ItemBonus*100@%最大生命值。|M09 部分；M13 部分|raw map22 `{54a2b5b0}` / `TFT13_GoopBuff_ChembaronLifestyle` / `effectAmounts`；文本键 `TFT13_GoopBuff_ChemBaronLifestyle_Description`|
|D26|星界韵律（异常）<br>`TFT13_GoopBuff_CosmicRhythm`<br>raw追加候选；未证明标准报价准入|不再获得法力值，作为替代，每@NumSeconds@秒施放其技能。|M14 已有；M15 部分|raw map22 `{237cb277}` / `TFT13_GoopBuff_CosmicRhythm` / `effectAmounts`；文本键 `TFT13_GoopBuff_CosmicRhythm_Description`|
|D27|水晶皮肤（异常）<br>`TFT13_GoopBuff_CrystalSkin`<br>raw追加候选；未证明标准报价准入|将所受伤害的最大值限定在@DamageCap@。|M17 部分|raw map22 `{65168b9c}` / `TFT13_GoopBuff_CrystalSkin` / `effectAmounts`；文本键 `TFT13_GoopBuff_CrystalSkin_Description`|
|D28|培养魔法（异常）<br>`TFT13_GoopBuff_CultivatingMagic`<br>raw追加候选；未证明标准报价准入|获得@APUpfront@法术强度。该弈子每造成@DamageBreakpoint@伤害就会获得@OffenseGranted@法术强度。 已造成的伤害：@TFTUnitProperty.:TFT13_Goop_DamageDealtTracker@)|M05 部分；M06 部分；M14 已有|raw map22 `{0c16a51c}` / `TFT13_GoopBuff_CultivatingMagic` / `effectAmounts`；文本键 `TFT13_GoopBuff_CultivatingMagic_Description`|
|D29|源计划速度（异常）<br>`TFT13_GoopBuff_CyberneticEmpowerment`<br>raw追加候选；未证明标准报价准入|获得@UpfrontAS*100@%攻击速度并在回合开始时，额外获得@ASPerComponent*100@%x己方弈子已携带基础装备数量的攻击速度。|M13 部分|raw map22 `{fd7fd68c}` / `TFT13_GoopBuff_CyberneticEmpowerment` / `effectAmounts`；文本键 `TFT13_GoopBuff_CyberneticEmpowerment_Description`|
|D30|DeathDealer（未取得官方标题）（异常）<br>`TFT13_GoopBuff_DeathDealer`<br>raw待准入/语义核实|未取得可绑定的完整描述；不能仅凭字段猜机制。|M00 部分；M14 已有；M17 部分|raw map22 `{9fe50e44}` / `TFT13_GoopBuff_DeathDealer` / `effectAmounts`；文本键 `TFT13_GoopBuff_DeathDealer_Description`|
|D31|紧急传送（异常）<br>`TFT13_GoopBuff_EmergencyTeleport`<br>raw追加候选；未证明标准报价准入|在跌下@HealthThreshold1*100@%和@HealthThreshold2*100@%生命值时，传送至安全处并获得持续@ShieldDuration@秒的@ShieldAmount@护盾值。|M12 部分；M14 已有|raw map22 `{5eb33066}` / `TFT13_GoopBuff_EmergencyTeleport` / `effectAmounts`；文本键 `TFT13_GoopBuff_EmergencyTeleport_Description`|
|D32|纳沃利精华（异常）<br>`TFT13_GoopBuff_EssenceofNavori`<br>raw追加候选；未证明标准报价准入|最大法力值缩减@PercentMana*100@%，并且这个弈子每施放一次技能，这个削减效果就会提升@PercentMana*100@%(至多至@PercentMana*400@%).。|M14 已有；M15 部分|raw map22 `{43cba97f}` / `TFT13_GoopBuff_EssenceofNavori` / `effectAmounts`；文本键 `TFT13_GoopBuff_EssenceofNavori_Description`|
|D33|永燃烈焰（异常）<br>`TFT13_GoopBuff_EverburningFlame`<br>raw追加候选；未证明标准报价准入|这个弈子的魔法伤害会对敌人们造成持续到战斗结束的1%灼烧和33%重伤。|M14 已有；M17 部分|raw map22 `{be5f3294}` / `TFT13_GoopBuff_EverburningFlame` / `effectAmounts`；文本键 `TFT13_GoopBuff_EverburningFlame_Description`|
|D34|终极闪光（异常）<br>`TFT13_GoopBuff_FinalSpark`<br>raw追加候选；未证明标准报价准入|当这个弈子即将阵亡时，会发射@NumSparks@道震波至弈子最密集的区域，对敌人造成@Damage@魔法伤害并为友军提供@Heal@护盾值。|M14 已有；M16 部分|raw map22 `{433fb41c}` / `TFT13_GoopBuff_FinalSpark` / `effectAmounts`；文本键 `TFT13_GoopBuff_FinalSpark_Description`|
|D35|野火王牌（异常）<br>`TFT13_GoopBuff_FirelightAce`<br>raw追加候选；未证明标准报价准入|获得【野火帮】羁绊。在其冲刺后，获得持续@Duration@秒的@BonusAttackSpeed*100@% %i:scaleAS%攻击速度和@BonusAD*100@% %i:scaleAD%攻击力。|M09 部分；M12 部分；M14 已有|raw map22 `{fcf28f79}` / `TFT13_GoopBuff_FirelightAce` / `effectAmounts`；文本键 `TFT13_GoopBuff_FirelightAce_Description`|
|D36|魔法馈赠（异常）<br>`TFT13_GoopBuff_GiftofMagic`<br>raw追加候选；未证明标准报价准入|这个弈子在每次施放技能时，其技能会产生回响。在战斗期间，使其总伤害降低@DamageAmpMultiplier*100@%。|M15 部分；M17 部分|raw map22 `{31ce1751}` / `TFT13_GoopBuff_GiftofMagic` / `effectAmounts`；文本键 `TFT13_GoopBuff_GiftofMagic_Description`|
|D37|玻璃大炮（异常）<br>`TFT13_GoopBuff_GlassCannon`<br>raw追加候选；未证明标准报价准入|获得@DamageAmp*100@%伤害增幅，但削减@DurabilityReduction*100@%伤害减免。|M13 部分；M17 部分|raw map22 `{103a1644}` / `TFT13_GoopBuff_GlassCannon` / `effectAmounts`；文本键 `TFT13_GoopBuff_GlassCannon_Description`|
|D38|主脑（异常）<br>`TFT13_GoopBuff_Hivemind`<br>raw追加候选；未证明标准报价准入|在每个玩家对战回合中，获得这个弈子击杀的第一个弈子的一个1星版本。获得@DamageAmpPct@%伤害增幅。|M02 部分；M06 部分；M14 已有|raw map22 `{fbaecb25}` / `TFT13_GoopBuff_Hivemind` / `effectAmounts`；文本键 `TFT13_GoopBuff_Hivemind_Description`|
|D39|飓风呼啸（异常）<br>`TFT13_GoopBuff_HowlingGale`<br>raw追加候选；未证明标准报价准入|每获得@ManaPerWhirlwind@法力值，就会召唤一道飓风来击飞敌人们。|M14 已有；M15 部分；M16 部分|raw map22 `{0b41ac92}` / `TFT13_GoopBuff_HowlingGale` / `effectAmounts`；文本键 `TFT13_GoopBuff_HowlingGale_Description`|
|D40|身份危机（异常）<br>`TFT13_GoopBuff_IdentityCrisis`<br>raw追加候选；未证明标准报价准入|摧毁这个弈子并获得其每个非唯一羁绊的一个纹章。|M02 部分；M09 部分；M18 缺失|raw map22 `{8a0f7c64}` / `TFT13_GoopBuff_IdentityCrisis` / `effectAmounts`；文本键 `TFT13_GoopBuff_IdentityCrisis_Description`|
|D41|空想家（异常）<br>`TFT13_GoopBuff_Ideologue`<br>raw追加候选；未证明标准报价准入|战斗开始时：获得来自这个弈子两侧友军的@PctSharedStats@%护甲、魔抗、攻击力和法术强度。|M13 部分|raw map22 `{672c2c34}` / `TFT13_GoopBuff_Ideologue` / `effectAmounts`；文本键 `TFT13_GoopBuff_Ideologue_Description`|
|D42|ImmovableObject（未取得官方标题）（异常）<br>`TFT13_GoopBuff_ImmovableObject`<br>raw待准入/语义核实|未取得可绑定的完整描述；不能仅凭字段猜机制。|M00 部分；M13 部分|raw map22 `{867f38b4}` / `TFT13_GoopBuff_ImmovableObject` / `effectAmounts`；文本键 `TFT13_GoopBuff_ImmovableObject_Description`|
|D43|LimitedPower（未取得官方标题）（异常）<br>`TFT13_GoopBuff_LimitedPower`<br>raw待准入/语义核实|未取得可绑定的完整描述；不能仅凭字段猜机制。|M00 部分；M13 部分；M14 已有|raw map22 `{9702ee2e}` / `TFT13_GoopBuff_LimitedPower` / `effectAmounts`；文本键 `TFT13_GoopBuff_LimitedPower_Description`|
|D44|化身怪兽（异常）<br>`TFT13_GoopBuff_MaximumThreat`<br>raw追加候选；未证明标准报价准入|这个弈子失去其羁绊但获得@DamageAmp*100@%伤害增幅和伤害减免。|M09 部分；M13 部分|raw map22 `{50128b5e}` / `TFT13_GoopBuff_MaximumThreat` / `effectAmounts`；文本键 `TFT13_GoopBuff_MaximumThreat_Description`|
|D45|微缩化（异常）<br>`TFT13_GoopBuff_Miniaturize`<br>raw追加候选；未证明标准报价准入|转变成一件装备，该装备可提供其@PercentStats*100@%攻击力、法术强度、护甲与魔抗。已携带的装备会弹出来。|M06 部分；M13 部分；M18 缺失|raw map22 `{9a125f54}` / `TFT13_GoopBuff_Miniaturize` / `effectAmounts`；文本键 `TFT13_GoopBuff_Miniaturize_Description`|
|D46|MoneyIsPower（未取得官方标题）（异常）<br>`TFT13_GoopBuff_MoneyIsPower`<br>raw待准入/语义核实|未取得可绑定的完整描述；不能仅凭字段猜机制。|M00 部分；M04 缺失|raw map22 `{8d775d9c}` / `TFT13_GoopBuff_MoneyIsPower` / `effectAmounts`；文本键 `TFT13_GoopBuff_MoneyIsPower_Description`|
|D47|协作之巨人（异常）<br>`TFT13_GoopBuff_OneForAll`<br>raw追加候选；未证明标准报价准入|获得伤害减免，数额为@DurabilityPerStar*100@%x你场上的总星级，3星英雄则转而提供@ThreeStarBonus@%伤害增幅。|M08 缺失；M09 部分；M13 部分|raw map22 `{07f9c801}` / `TFT13_GoopBuff_OneForAll` / `effectAmounts`；文本键 `TFT13_GoopBuff_OneForAll_Description`|
|D48|攻击上升（异常）<br>`TFT13_GoopBuff_PowerUp`<br>raw追加候选；未证明标准报价准入|获得@UpfrontAD*100@%攻击力。该弈子每造成@DamageBreakpoint@伤害就会获得@OffenseGranted*100@%攻击力。 (已造成的伤害：@TFTUnitProperty.:TFT13_Goop_DamageDealtTracker@)|M05 部分；M06 部分；M14 已有|raw map22 `{26ae2ff3}` / `TFT13_GoopBuff_PowerUp` / `effectAmounts`；文本键 `TFT13_GoopBuff_PowerUp_Description`|
|D49|小拳拳出击（异常）<br>`TFT13_GoopBuff_PunchUp`<br>raw追加候选；未证明标准报价准入|在对抗更高费的目标时获得@DamageAmp@%伤害增幅。|M13 部分；M17 部分|raw map22 `{d0aef77c}` / `TFT13_GoopBuff_PunchUp` / `effectAmounts`；文本键 `TFT13_GoopBuff_PunchUp_Description`|
|D50|叛逆期（异常）<br>`TFT13_GoopBuff_RebelPhase`<br>raw追加候选；未证明标准报价准入|获得【蓝发小队】羁绊。当烟雾信号出现时，获得@BonusCritChance*100@% %i:scaleCrit%暴击几率和@BonusCritDamage*100@% %i:scaleCritMult%暴击伤害。|M09 部分；M14 已有|raw map22 `{7ceeefe1}` / `TFT13_GoopBuff_RebelPhase` / `effectAmounts`；文本键 `TFT13_GoopBuff_RebelPhase_Description`|
|D51|极客城主（异常）<br>`TFT13_GoopBuff_ScrapKeeper`<br>raw追加候选；未证明标准报价准入|获得【极客】羁绊、@BonusCritChance*100@% %i:scaleCrit%暴击几率和@BonusCritDamage*100@% %i:scaleCritMult%暴击伤害。|M09 部分；M13 部分|raw map22 `{23bc9759}` / `TFT13_GoopBuff_ScrapKeeper` / `effectAmounts`；文本键 `TFT13_GoopBuff_ScrapKeeper_Description`|
|D52|缩小射线（异常）<br>`TFT13_GoopBuff_ShrinkRay`<br>raw追加候选；未证明标准报价准入|攻击和技能会使敌人们缩小，从而降低敌人们@DamageReduction*100@%伤害(至多可叠加至@TooltipMaxReduction@%)。|M14 已有；M17 部分|raw map22 `{4458ece4}` / `TFT13_GoopBuff_ShrinkRay` / `effectAmounts`；文本键 `TFT13_GoopBuff_ShrinkRay_Description`|
|D53|碎开能量（异常）<br>`TFT13_GoopBuff_SplinteredPower`<br>raw追加候选；未证明标准报价准入|摧毁这个弈子。友军们永久获得其@PercentGain*100@%生命值、法术强度、攻击力、护甲和魔抗。|M05 部分；M06 部分；M13 部分；M18 缺失|raw map22 `{cafa96cc}` / `TFT13_GoopBuff_SplinteredPower` / `effectAmounts`；文本键 `TFT13_GoopBuff_SplinteredPower_Description`|
|D54|昂首挺立（异常）<br>`TFT13_GoopBuff_StandTall`<br>raw追加候选；未证明标准报价准入|这个弈子在承受来自更高费敌人的伤害时会获得@Durability@%伤害减免。|M13 部分；M17 部分|raw map22 `{e3d871b8}` / `TFT13_GoopBuff_StandTall` / `effectAmounts`；文本键 `TFT13_GoopBuff_StandTall_Description`|
|D55|辅助玩家（异常）<br>`TFT13_GoopBuff_SupportPlayer`<br>raw追加候选；未证明标准报价准入|每@NumAttacks@次普攻，与该英雄相距最近的@NumUnits@名友军获得@ManaGain@法力值。|M14 已有；M15 部分|raw map22 `{b27cafb5}` / `TFT13_GoopBuff_SupportPlayer` / `effectAmounts`；文本键 `TFT13_SetMechanic_EvolveBuff_SupportPlayer_TRA`|
|D56|团队玩家（异常）<br>`TFT13_GoopBuff_TeamPlayer`<br>raw追加候选；未证明标准报价准入|该英雄拥有的每个非唯一羁绊+1。|M09 部分|raw map22 `{11fc7629}` / `TFT13_GoopBuff_TeamPlayer` / `effectAmounts`；文本键 `TFT13_SetMechanic_EvolveBuff_TraitBonus`|
|D57|毒云（异常）<br>`TFT13_GoopBuff_ToxicCloud`<br>raw追加候选；未证明标准报价准入|当这个弈子参与一次击杀后，在该敌人的位置上生成一团毒云，毒云的半径为@HexRadius@格并在@Duration@秒的持续时间里每秒造成@DamagePerSecond@真实伤害。|M14 已有；M16 部分|raw map22 `{3865bf30}` / `TFT13_GoopBuff_ToxicCloud` / `effectAmounts`；文本键 `TFT13_GoopBuff_ToxicCloud_Description`|
|D58|吸血习性（异常）<br>`TFT13_GoopBuff_VampiricAffinity`<br>raw追加候选；未证明标准报价准入|获得@BonusOmnivamp*100@%全能吸血。这个加成会在低于@HealthThreshold*100@%生命值时提升至@BonusLowHealthOmnivamp*100@%全能吸血。|M14 已有；M17 部分|raw map22 `{26c174a4}` / `TFT13_GoopBuff_VampiricAffinity` / `effectAmounts`；文本键 `TFT13_GoopBuff_VampiricAffinity_Description`|
|D59|WellRounded（未取得官方标题）（异常）<br>`TFT13_GoopBuff_WellRounded`<br>raw待准入/语义核实|未取得可绑定的完整描述；不能仅凭字段猜机制。|M00 部分；M13 部分|raw map22 `{0a7614ae}` / `TFT13_GoopBuff_WellRounded` / `effectAmounts`；文本键 `TFT13_GoopBuff_WellRounded_Description`|

**源字段数值索引**：下表仅转录源值供后续找字段，比例保持原单位；二进制浮点最多显示六位小数。不是额外采纳决定，已批准B补丁覆盖优先。null/缺值保留，不能当0。无描述字段不会由此升级为已知语义。

|条目|raw字段与原始值显示|
|---|---|
|D01|`Gold`=9；`LesserDuplicatorAmount`=2|
|D02|`PercentDamage`=0.01；`GoldIncrement`=2；`GoldCap`=40；`GoldCount`=5；`FlatPercentDamage`=15|
|D03|无公开effectAmounts/未取得可绑定数值；见描述|
|D04|`NumKills`=1；`StartingAS`=15；`StackingAS`=1；`{cdc2c7be}`=2|
|D05|`GainedAD`=0.5；`GainedAP`=50；`NumRounds`=3|
|D06|`NumRounds`=3|
|D07|`InitialXP`=12；`XP`=2|
|D08|`NumComponents`=2；`NumUnits`=2|
|D09|`{51972fee}`=2；`{a59e2760}`=0.5；`{c209103c}`=0.11；`{ca332ec1}`=0.5；`{d89481f4}`=1.75|
|D10|`NumKills`=2|
|D11|`APGainPerDeath`=6；`MaxHealthGainPerCast`=30|
|D12|`NumEkkoAfterImages`=3；`NumHeimerMissiles`=3；`ReducedEkkoDamage`=0.33；`ReducedHeimerDamage`=1.2|
|D13|`TOOLTIPONLYNumMonstrosities`=3|
|D14|`TOOLTIPONLYADSHARE`=25；`TOOLTIPONLYCAITAD`=225|
|D15|`EkkoAfterImageReducedDamage`=0.5；`ViEarthquakeReducedDamage`=1.5|
|D16|`ADBuff`=0.4；`ASBuff`=0.75；`JinxDuration`=5；`ViDuration`=7|
|D17|`AD`=0.1；`Health`=100；`Mana`=10；`{1e90fa01}`=0.1|
|D18|`PercentShare`=0.22|
|D19|`ADBonus`=0.25；`APBonus`=25；`ItemBonus`=null/未绑定；`NumUnits`=1；`{51b72188}`=null/未绑定|
|D20|`BaseRegenBonus`=0.05；`RegenPerMissingHP`=0.5；`RegenPeriod`=5|
|D21|`FlatHealth`=200；`PercentHealth`=未赋值；`AttackSpeed`=0.2；`AD`=未赋值；`AP`=未赋值；`Armor`=未赋值；`MR`=未赋值；`DamageAmp`=未赋值；`Durability`=未赋值；`Omnivamp`=未赋值；`CritChance`=未赋值；`CritDamage`=未赋值|
|D22|`BonusAS`=0.2|
|D23|`BonusAD`=0.15；`{e22422d8}`=1；`RangeBonus`=0.15；`BonusAS`=0.15；`BonusOmnivamp`=0.15|
|D24|`NumKills`=3；`NumGold`=1|
|D25|`ItemBonus`=1|
|D26|`NumSeconds`=4|
|D27|`DamageCap`=100|
|D28|`DamageBreakpoint`=10000；`OffenseGranted`=10；`APUpfront`=20|
|D29|`ASPerComponent`=0.025；`UpfrontAS`=0.5|
|D30|`PercentDamage`=0.35；`DotDuration`=5|
|D31|`HealthThreshold1`=0.7；`HealthThreshold2`=0.4；`ShieldAmount`=500；`ShieldDuration`=6|
|D32|`PercentMana`=0.1；`StackCap`=4|
|D33|`Duration`=60|
|D34|`Damage`=300；`Heal`=250；`NumSparks`=3|
|D35|`Duration`=4；`BonusAttackSpeed`=0.25；`BonusAD`=0.25|
|D36|`DamageAmpMultiplier`=0.3|
|D37|`DamageAmp`=0.25；`DurabilityReduction`=0.15|
|D38|`DamageAmpPct`=25|
|D39|`ManaPerWhirlwind`=150；`{67abbfa8}`=360；`StunDuration`=1.5|
|D40|无公开effectAmounts/未取得可绑定数值；见描述|
|D41|`PctSharedStats`=10|
|D42|`BonusHealth`=1000；`BonusArmor`=100；`BonusMR`=100|
|D43|`APToGain`=70；`APReductionPerCast`=5|
|D44|`DamageAmp`=0.4；`Durability`=0.4|
|D45|`PercentStats`=0.75|
|D46|`SellCostMultiplier`=5|
|D47|`DurabilityPerStar`=0.01；`ThreeStarBonus`=5|
|D48|`DamageBreakpoint`=10000；`OffenseGranted`=0.1；`UpfrontAD`=0.2|
|D49|`DamageAmp`=25|
|D50|`BonusCritChance`=0.5；`BonusCritDamage`=0.2|
|D51|`BonusCritChance`=0.2；`BonusCritDamage`=0.2|
|D52|`DamageReduction`=0.1；`{3061f32c}`=0.06；`MaxStacks`=4；`TooltipMaxReduction`=40|
|D53|`PercentGain`=0.08|
|D54|`Durability`=20|
|D55|`NumAttacks`=5；`ManaGain`=10；`NumUnits`=2|
|D56|无公开effectAmounts/未取得可绑定数值；见描述|
|D57|`HexRadius`=1；`DamagePerSecond`=100；`Duration`=4|
|D58|`BonusOmnivamp`=0.15；`BonusLowHealthOmnivamp`=0.4；`HealthThreshold`=0.5|
|D59|`BonusAS`=0.25；`DamageAmp`=0.2|

## 4. 表二：按机制汇总、纯模块边界与工作量

依赖数按表一条目去重计算，一个条目可依赖多个机制；统计含明确标出的 raw 研究候选，所以是机制覆盖潜力，不是已批准开发数量。工作量“小/中/大”是静态估计，不是工期承诺。所有新增字段还需版本化存档政策，当前不改版本。

|机制|依赖条目数|现状与已有证据|建议边界、状态与恢复/收据约束（均为设计建议）|量级|
|---|---:|---|---|---|
|M00 准入/源数据与执行语义|8|部分；[B `docs/M9_DATA_LEDGER.md:24`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/docs/M9_DATA_LEDGER.md#L24)；[B `docs/M9_DATA_LEDGER.md:32`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/docs/M9_DATA_LEDGER.md#L32)|content/source/：区分标准/Evolved成员、模板/残留字段与可运行目录；resolveSource(apiId,version)返回证据和未定项，不凭显示名启用。保留sourceId、patchOverrides、eligibility证据；不新增运行状态。|小至中|
|M01 确定性抽样与真实选择|4|已有；[B `src/simulation/choices.ts:1`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/choices.ts#L1)；[B `src/simulation/g2-4b-item-kernel.ts:14`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/g2-4b-item-kernel.ts#L14)|复用显式RNG/choiceId/generation，新增消费者单独命名空间；保存draw前后与候选身份，恢复由seed及已核验输入重演。缺的只是新消费者规则，不能混用商店流。|小|
|M02 唯一获取、单位所有权与共享池|16|部分；[B `src/simulation/seat-mechanics/grants.ts:64`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/seat-mechanics/grants.ts#L64)；[B `src/simulation/shared-pool-ledger.ts:191`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/shared-pool-ledger.ts#L191)；[P2 `src/simulation/s13-augments-p2-grants.ts:30`](https://github.com/catfish-xn/cat/blob/a372263ed3e735b9510b7a89199838a8115ee0b8/src/simulation/s13-augments-p2-grants.ts#L30)|rewards/acquisition.ts：planGrant(source,policy)→原子receipt+资源事实+pool变化；选择当刻创建强制所有权，满席是同一已拥有实例待放置，不是缺receipt即可重领。连接claim/deploy/sell/upgrade公共事务；pool-empty转换需冻结政策。|中至大|
|M03 可持有且可择时使用的英雄复制器|1|缺失；[B `src/simulation/consumables.ts:16`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/consumables.ts#L16)；[B `docs/evidence/g2-3/RECONCILIATION.md:44`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/docs/evidence/g2-3/RECONCILIATION.md#L44)|consumables/champion-duplicator.ts：preview/use(instance,target,UnitLootPolicy)；新增工具definition/库存instance、单次useReceipt、出生及合星消费谱系。现有G23自动复制不能代替手动工具；失败原state/RNG不变，恢复重演合法目标和池扣减。|中|
|M04 可变经验购买的准备命令经济重演|3|缺失；[B `src/simulation/match.ts:295`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/match.ts#L295)；[B `src/simulation/serialization-structure.ts:98`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/serialization-structure.ts#L98)|preparation-history/：recordAcceptedCommand/replayPreparation(seed,validatedBoundary,commands)；记录成功买卖/刷新/XP/奖励/选择及顺序，验证gold/xp/shop/RNG，绑定获得强化时点。仅增加purchaseCount或改整除数不足；快照不是第二份权威。|大|
|M05 跨轮单位成长的事实账本|6|部分；[B `src/simulation/resource-provenance.ts:143`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/resource-provenance.ts#L143)；[B `src/simulation/round-settlement.ts:104`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/round-settlement.ts#L104)；[B `src/simulation/restore-combat-replay.ts:74`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/restore-combat-replay.ts#L74)|growth/：reduceVerifiedGrowth(battleFacts,source,identity)；新增按类型区分AS/AP/HP/AD的事实记录，键含battleId、原持有者、来源choice、动作/受害者；仅可信重演输入写入，当前候选逐项核对，有战斗tick上界。现有Tristana AD不能当通用成长。|大|
|M06 绑定单位的升星/出售身份迁移|10|部分；[B `src/simulation/upgrades.ts:100`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/upgrades.ts#L100)；[P1 `src/simulation/bound-unit-identity.ts:1`](https://github.com/catfish-xn/cat/blob/a3c98f2445df3357aa3a9ead56a861a46b5848a9/src/simulation/bound-unit-identity.ts#L1)|identity/：复用traceBoundUnitIdentity(originalId,verifiedFacts)；choiceId+originalUnitId不可变，存活身份由已验证消费谱系推出；补暂离/变形/四星的迁移类型。P1 helper仅遍历已验证事实，不认证原始候选、不生成成长。|中|
|M07 跨轮暂离与通用待部署容器|2|缺失；[B `src/simulation/carousel-units.ts:14`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/carousel-units.ts#L14)；[B `src/simulation/shared-pool-ledger.ts:139`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/shared-pool-ledger.ts#L139)；[B `src/server/room/room.ts:136`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/server/room/room.ts#L136)|owned-units/holding.ts：hold/return/claim(source,policy)；真实unitId+装备+来源+boundRound/returnRound，仍计所有权/卡池，不计在场羁绊/人口。选择时就有强制所有权；倒计时从真实结算轮次推出，满席只延放同一实例；需Claude接共享事务。carousel专用结构不能伪装来源。|大|
|M08 四星/临时星级投影|3|缺失；[B `src/simulation/unit-types.ts:3`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/unit-types.ts#L3)；[B `docs/M9_DATA_LEDGER.md:34`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/docs/M9_DATA_LEDGER.md#L34)；[B `docs/M9_BATCH_PROPOSAL.md:416`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/docs/M9_BATCH_PROPOSAL.md#L416)|progression/star-policy.ts：effectiveBattleStar/planPermanentPromotion；永久与临时分离，四星技能/基础属性/出售/池份额/恢复均需一致。保存promotionReceipt和原始消耗事实；临时升星不得改永久池份额。七槽数组不是完整四星规则。|大|
|M09 动态羁绊成员/纹章/人口统一投影|15|部分；[B `src/simulation/trait-snapshot.ts:12`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/trait-snapshot.ts#L12)；[B `src/simulation/deployment-cap.ts:10`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/deployment-cap.ts#L10)；[B `src/simulation/strategy-snapshot.ts:63`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/strategy-snapshot.ts#L63)；[B `src/simulation/round-settlement.ts:89`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/round-settlement.ts#L89)|traits/effective-membership.ts：deriveEffectiveTraits(preparation,verifiedSources)供preview/compile/settle同用；新增add/remove/double-count与纹章装备来源，唯一羁绊排除、重复叠加优先级待定。人口仍统一getDeploymentCap；不得在服务器另算。必须验征服者/炼金男爵跨档收据。|大|
|M10 战中实时金币输入与重放|1|缺失；[B `src/simulation/combat-input.ts:24`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/combat-input.ts#L24)；[B `src/simulation/g2-4b-item-gold.ts:53`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/g2-4b-item-gold.ts#L53)；[B `src/server/room/room.ts:795`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/server/room/room.ts#L795)|combat-external-input/：applyEconomyDelta(tick,acceptedCommandSeq,verifiedBalance)；把合法战中买卖/XP/刷新及战斗掉金串入唯一时间线，保存来源/次序/余额依据并随回放重演；冻结bankGold只够开战快照，不能当实时余额。需服务器接线，不能只改模拟层。|大|
|M11 召唤/复制体/代理生命周期|3|部分；[B `src/simulation/g2-4b-summons.ts:14`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/g2-4b-summons.ts#L14)；[B `src/simulation/combat-g2-3-summons.ts:17`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/combat-g2-3-summons.ts#L17)；[P4 `src/simulation/anomalies/summons.ts:17`](https://github.com/catfish-xn/cat/blob/80493ab25f8ec267a49ed9b5acdfd32d229e1504/src/simulation/anomalies/summons.ts#L17)|复用战斗spawn/removed身份；继承白名单、ownerId/source/ordinal/bornTick必须可重演，战斗代理不进人口/卡池。P4蟹/狼/mini及基线镜像有具体实现，但不是任意英雄技能复制器；新物种需明确技能/装备/成长继承。|中|
|M12 在场、可选中、占格与权威位移|3|部分；[P4 `src/simulation/anomalies/availability.ts:8`](https://github.com/catfish-xn/cat/blob/80493ab25f8ec267a49ed9b5acdfd32d229e1504/src/simulation/anomalies/availability.ts#L8)；[P4 `src/simulation/anomalies/shared.ts:13`](https://github.com/catfish-xn/cat/blob/80493ab25f8ec267a49ed9b5acdfd32d229e1504/src/simulation/anomalies/shared.ts#L13)；[B `src/simulation/g2-4b-item-kernel.ts:117`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/g2-4b-item-kernel.ts#L117)|anomalies/availability与shared可复用；状态含untilTick/originalCell/return身份，movement事件记录；无空格不挤占、眩晕免疫/缺席/死亡分开。基线短刀/灵风是特例，P4未合，跨回合暂离仍属M07。|中|
|M13 属性取样、共享与护甲继承|21|部分；[B `src/simulation/combat-s13.ts:70`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/combat-s13.ts#L70)；[P2 `src/simulation/s13-augments-p2-combat.ts:40`](https://github.com/catfish-xn/cat/blob/a372263ed3e735b9510b7a89199838a8115ee0b8/src/simulation/s13-augments-p2-combat.ts#L40)；[P4 `src/simulation/anomalies/scuttle-familiar.ts:8`](https://github.com/catfish-xn/cat/blob/80493ab25f8ec267a49ed9b5acdfd32d229e1504/src/simulation/anomalies/scuttle-familiar.ts#L8)|stats/opening-samples.ts：先冻结捐赠者完整输入再广播，避免反馈放大；记录来源贡献，不新增未经认证的最终值。对临时debuff排除/正增益保留制定采样策略；恢复从已验证opening重算。|中|
|M14 触发去重、层数、周期任务与死亡事实|26|已有；[B `src/simulation/m8/triggers.ts:20`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/m8/triggers.ts#L20)；[B `src/simulation/m8/triggers.ts:56`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/m8/triggers.ts#L56)；[B `src/simulation/restore-combat-replay.ts:74`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/restore-combat-replay.ts#L74)；[P4 `src/simulation/anomalies/runtime.ts:34`](https://github.com/catfish-xn/cat/blob/80493ab25f8ec267a49ed9b5acdfd32d229e1504/src/simulation/anomalies/runtime.ts#L34)|复用source完整身份、action/target边界与唯一触发账本。计数从事件事实得出，不是数值=count×系数自证；金额累计与次数分开，分担/附包不重复；新消费者需明确kill与assist资格。|小至中|
|M15 法力替代、施法调度与回响|9|部分；[B `src/simulation/combat-s13.ts:128`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/combat-s13.ts#L128)；[B `src/simulation/m8/mana.ts:1`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/m8/mana.ts#L1)；[P3 `src/simulation/s13-p3-combat.ts:31`](https://github.com/catfish-xn/cat/blob/e703a8d3827e832633490822d4d67d74326ce65f/src/simulation/s13-p3-combat.ts#L31)|combat/cast-policy.ts：canGainMana/nextCast/consumeCharge；保存nextCastTick、manaSpent或manaGained余量、回响父actionId；区分普通施法与回响防递归，不伪造蓝满或跳过锁定；恢复核对实际事件。|中至大|
|M16 空间区域、弹体与逐tick碰撞|3|部分；[B `src/simulation/combat-s13-abilities.ts:1`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/combat-s13-abilities.ts#L1)；[P4 `src/simulation/anomalies/center-of-the-universe.ts:1`](https://github.com/catfish-xn/cat/blob/80493ab25f8ec267a49ed9b5acdfd32d229e1504/src/simulation/anomalies/center-of-the-universe.ts#L1)|combat/zones.ts：createZone/advanceZone，保存center、来源、出生/到期、lastHit及目标去重；借P4定点轨道/已有AoE，不把特效轨迹当规则。缺脚本几何/多云叠加需用户决策，历史短前缀照验。|中|
|M17 伤害拦截、限制、反伤与减益|10|部分；[B `src/simulation/m8/damage.ts:18`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/m8/damage.ts#L18)；[P3 `src/simulation/s13-p3-combat.ts:89`](https://github.com/catfish-xn/cat/blob/e703a8d3827e832633490822d4d67d74326ce65f/src/simulation/s13-p3-combat.ts#L89)；[B `src/simulation/g2-4b-item-kernel.ts:78`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/g2-4b-item-kernel.ts#L78)|damage/policies.ts：复用统一伤害阶段，新增cap/反伤/属性负修正消费者明确盾/分担/延期/真伤顺序；保存必要来源而不是独立第二套HP扣减，反伤不反馈递归。|中|
|M18 永久单位销毁、变物品与资源转换|3|缺失；[B `src/simulation/resource-provenance.ts:35`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/resource-provenance.ts#L35)；[B `src/simulation/upgrades.ts:100`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/upgrades.ts#L100)|resource-transform/：planConsumeUnitAndGrant(source,target)；原单位消费、装备弹回、池释放/保留、纹章或动态物品出生、继承数值一次原子提交；恢复重演源目标及消费，禁止保留单位又领输出。|大|
|M19 关系强化解锁与跨英雄技能协作|8|缺失；[B `docs/M9_DATA_LEDGER.md:5061`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/docs/M9_DATA_LEDGER.md#L5061)；[B `docs/M9_BATCH_PROPOSAL.md:417`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/docs/M9_BATCH_PROPOSAL.md#L417)；[B `src/simulation/content/traits.ts:1`](https://github.com/catfish-xn/cat/blob/a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53/src/simulation/content/traits.ts#L1)|teamup/：compileUnlockedRelation(choice,board)/planLinkedAction；记录解锁来源、配对身份、父动作和有限传播深度；复用普通技能/召唤/回蓝，但不能两英雄在场就自动启用关系。拒绝互触发无限循环，永久协作成长走M05。|大|

## 5. 建议机制包顺序与并行边界

以下只提出方案，不启动实现。不能按表二依赖数简单承诺一次解锁全部条目：每个条目必须满足所有依赖且来源/玩法已定。
1. **先做共享资格/取样/事件消费者整合（M13/M14/M17，复用P2/P3/P4）**：对齐已存在模块而非另造引擎。可优先解锁灵魂连接、天涯若比邻、空想家、辅助玩家、源计划速度、纯条件攻防等；完全缺脚本的候选仍暂缓。独立consumer文件可并行，统一damage/stat读取入口由一条线负责。
2. **先建设资源所有权事务包（M02/M03/M07）**：泛化一次获取与已拥有待部署容器，补共享deploy/claim/sell事务和UI投影。先闭环英勇福袋、双排，再支持进入未知/主脑/关系强化发英雄；一次占池、后续不重生。所有权/serial/fold/shared-pool文件集中串行，不分给多个包同时改。
3. **准备经济重演 + 战中经济时间线（M04/M10）**：前者先闭环升级咯，后者才能让贪财实时生效；同一公共命令来源向持久账本和战斗runner供给，不能出现两本竞争金币账本。需Claude服务器接线，模拟层不能独立宣称联机完整。
4. **统一动态羁绊投影（M09）**：纹章完整效果、增删/双计成员、一套getDeploymentCap与derivedTraits供预览/开战/结算。解锁名片、各羁绊异常和关系强化基础。必须以当前棋盘跨征服者/炼金男爵阈值的真实结算验收。
5. **绑定身份与持久成长包（M05/M06）**：利用资源事务和可信战斗事件，先猎头者，再培养魔法/攻击上升和关系永久成长。进入未知复用M07，终极英雄还要M08；不要将战斗内层数直接保存成跨轮成长。
6. **星级/永久变形包（M08/M18）**：四星、临时星级、摧毁转纹章/装备/团队属性是不同消费事务；先定人口/共享池/出售政策，再实现终极英雄、月光、身份危机、微缩化、碎开能量。
7. **空间/调度与关系技能包（M11/M12/M15/M16/M19）**：在P4稳定接口上补飓风、毒云、回响/周期施法、伙伴协作；纯模块消费者可独立写，最终统一start/tick/death及restore重演入口串行集成。

并行建议：A线资源/经济/跨轮状态；B线战斗纯消费者（属性、伤害、区域）；Claude接服务器与界面。A与B只通过冻结的来源/事实/事件接口衔接。注册表、内容digest、版本及当前夹具最后由集成方统一处理；不能将“没有文本冲突”视作语义不冲突。

## 6. 必须保留的恢复与验收要求（本任务不执行测试）

- 先从真实选择/命令/开战依据重演，再比候选；不能用未经核验的receipt、bank、role、count或快照证明自身。删除已领奖记录后再次领取、同角色换目标、卖出/升星后的来源迁移必须有反例。
- 满席/池空/无合法目标/失败命令不消耗ID、RNG、金币或收据；已取得所有权的待部署实例与尚未发奖要不同类型。消费和成长当批可保存恢复，不留给之后统一补。
- 所有累计值在分配数组前由真实战斗数/tick/参与者数量推导有界规模；不得把MAX_SAFE_INTEGER当业务上界。缓存只重用完整依赖一致且已验证的结果，候选仍逐次比较。
- 任何影响棋盘、人口、英雄定义、羁绊的机制，须覆盖阈值升/降、准备/战中/结算保存恢复、重复命令、同tick多来源以及object/JSON/续战事件和RNG一致。
- 旧目录与新目录测试身份分开；目录扩池会改变固定seed选择，不可统称golden噪声。保留失败记录，主效果用独立源值/手算断言。
- 这里没有新增或运行任何测试、没有测性能、没有重新评价P1–P4签收。既有CI或作者结论只保留其原版本归属。

## 7. 需要用户决定的玩法/范围问题（只列问题与选项，不作决定）

|问题|可选方向/影响|
|---|---|
|额外raw候选是否属于本轮可出现目录？|只纳入已有正式标准池证据；或先补14.24报价/互斥取证再排期。残留/模板/无描述项不能凭字段自动启用。|
|4星范围与库存份额|只支持终极英雄指定目标的专用永久晋升；或扩为全目录通用四星。需明确原九份所有权、出售价格、基础属性与技能4星系数，不从1/2/3星外推。|
|进入未知归来无位、暂离期间交互|持有实例继续托管直到可放置；或其他已考证规则。是否可卖/可卸装、是否合星、回合数遇轮选/加时如何算需明确来源；本报告不擅自禁止所有操作。|
|纹章与关系强化启用范围|完整22纹章连副效果一起做；或明确有限可发子集并作项目约定。关系8项按M9 Q15重新明确本轮是否启用，不能因台账存在直接实现。|
|战中金币语义与排序|按合法命令被接纳的tick实时同步；或经用户批准的快照近似。后者不能称原版实时；金币cap总增幅/额外部分的歧义需取证后裁决。|
|法力替代/技能回响/飓风几何|原脚本取证；或显式有限项目约定。哪些技能允许回响、是否耗蓝/算cast、伤害波位置/速度/触发资格需逐项列出。|
|永久销毁/转装备的池与资源规则|返回池/保留已消费份额、装备弹回/转移、团队增益对象与升星继承。必须给所有权闭环，不能只删准备棋子。|
|已批准基线约定是否沿用到新消费者|例如自动复制、战斗召唤占格、代理不进存活伤害；可以沿用有明确适用范围的旧政策，不能把旧特例自动扩到新机制。|

## 8. 证据与交付自检

- 本次操作：独立clone、fetch只读分支、git show/文本搜索/raw解压；只提交本文件，不修改源码/测试/脚本/历史夹具，不安装依赖、不运行任何测试、不推送。
- 依据优先级沿 `M9_DATA_LEDGER.md:32–37`：14.24b已批准覆盖 > 14.24公告 > 客户端值；表中raw索引不是对已有覆盖的回退。未得到官方中文时保留原ID或英文，不造官方译名。
- 本报告的“建议模块/预计量级/可解锁”均为静态推断；“已有”都有固定SHA文件行号。P4代码与旧文占格差异按代码列出，未擅自调整。
- 完整HEAD与bundle哈希在dot任务结果区给出，避免本文自引用自身提交SHA造成循环。原任务书不改。

### raw文件指纹（本次只读核验）

- `src/simulation/content/source/s13-14.24b/raw/en_us.json.gz` SHA256 `7e0e2d41a806833f6f18e5752c0d5eea4fa3a74e75b61c1c54853de74c2ac5d2`
- `src/simulation/content/source/s13-14.24b/raw/map22.bin.json.gz` SHA256 `743bf3668141be28d44b39160dcfc0da0aca0e919e6aa14513a0b3feb666b2b0`
- `src/simulation/content/source/s13-14.24b/raw/zh_cn.tft.stringtable.json.gz` SHA256 `ae17b0ce7ebc199e3b3c8dbc7fc906cfb0a83a1c45a9d6ce2d4a78e1526ebca4`
