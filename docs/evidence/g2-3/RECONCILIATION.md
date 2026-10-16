# G2-3 来源对账（证据稿）

基线：`multiplayer@94eecbcbfbce72d4740923b8c793c66c483bfd51`；交付分支：`codex/g2-3-reconciliation`，PR 目标 `multiplayer`。只新增本目录两份证据；不代表实现准入或玩法批准。普通成装36件已齐，装备不在范围。

## 来源与口径

- 冻结文件：`src/simulation/content/source/s13-14.24b/raw/en_us.json.gz`。
- Git blob：`a6bbdadfc57a43436a2f4de8ce8606c7ecbc42a6`（本地副本一致）。
- 压缩 SHA256：`7e0e2d41a806833f6f18e5752c0d5eea4fa3a74e75b61c1c54853de74c2ac5d2`。
- 解压 SHA256：`c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3`。
- 只选 `/setData/1` 的 `mutator=TFTSet13`；不混入 Evolved、PVE、双人、狂暴及重复 `sets/13`。英雄按 `TFT13_*`、cost 1–5、非空traits筛选；形态/召唤物cost11不另算英雄。
- JSON结构沿用 g2-augments 的 schemaVersion/sourcePath/hash/selection/sourcePointer/rawEffects 思路，selection 按 champions/traits/anomalies 分组；英雄 rawRecord、全部stats、全部技能变量数组（含value[0]和4–6）、描述和空值都保留；traits保留所有档位，包括自然不可达档。
- 表中技能只展示 value[1:4]（1/2/3星）；精确浮点不做美化或四舍五入。`null`为缺；`0`保持0。JSON中的sourcePointer加字段路径可直达原值。未解码hash键不能自行命名。

## 计数对账与范围差异

|项目|仓库已有|指定源可证明的目标|本次剩余/缺口|
|---|---:|---:|---|
|普通英雄|48|60|12位，其中4位形态模板缺值|
|英雄自然携带羁绊|14|26|12项；不是14项|
|强化解锁Teamup羁绊|本次不纳入|7|保留源记录作排除证据，不拿任意2项凑28|
|异变|3|目标30；raw异变定义0|列27项待核候选；新增0项达到完整源值准入|

`docs/PLAN_GOALS_2026-10-15.md` 的28羁绊目标未被冻结源支持：标准集合共33条=26个英雄羁绊+7个Teamup。JSON逐条列出33项分类、60位英雄与48位库内ID，差集不是凭显示名推测。此稿不改原规划。三名6费英雄也不在此60人集合内，不从其他模式补入。

## 剩余12英雄：属性与技能源值

|候选ID / 名称|apiName / pointer|cost|hp / damage / armor / MR|AS；初始/最大蓝；射程|源羁绊|
|---|---|---:|---|---|---|
|renata / Renata Glasc|`TFT13_RenataGlasc`<br>`/setData/1/champions/12`|2|600.0 / 35.0 / 20.0 / 20.0|0.699999988079071；20.0/80.0；4.0|Chem-Baron, Visionary|
|silco / Silco|`TFT13_Silco`<br>`/setData/1/champions/13`|4|800.0 / 40.0 / 30.0 / 30.0|0.75；30.0/80.0；4.0|Chem-Baron, Dominator|
|drmundo / Dr. Mundo|`TFT13_DrMundo`<br>`/setData/1/champions/21`|4|1100.0 / 60.0 / 60.0 / 60.0|0.6499999761581421；30.0/100；1.0|Experiment, Dominator|
|cassiopeia / Cassiopeia|`TFT13_Cassiopeia`<br>`/setData/1/champions/29`|3|700.0 / 40.0 / 25.0 / 25.0|0.699999988079071；10.0/40.0；4.0|Black Rose, Dominator|
|elise / Elise|`TFT13_Elise`<br>`/setData/1/champions/31`|4|750.0 / 50.0 / 0.0 / null|0.5；0/10.0；1.0|Black Rose, Form Swapper, Bruiser|
|jayce / Jayce|`TFT13_Jayce`<br>`/setData/1/champions/34`|5|900.0 / 50.0 / 0.0 / null|0.5；0/10.0；1.0|Academy, Form Swapper|
|smeech / Smeech|`TFT13_Gremlin`<br>`/setData/1/champions/38`|3|800.0 / 70.0 / 50.0 / 50.0|0.800000011920929；20.0/80.0；1.0|Chem-Baron, Ambusher|
|sevika / Sevika|`TFT13_Lieutenant`<br>`/setData/1/champions/39`|5|1200.0 / 80.0 / 60.0 / 60.0|0.8999999761581421；0/60.0；1.0|High Roller, Chem-Baron, Pit Fighter|
|renni / Renni|`TFT13_Chainsaw`<br>`/setData/1/champions/40`|3|850.0 / 55.0 / 50.0 / 50.0|0.6499999761581421；40.0/100；1.0|Chem-Baron, Bruiser|
|nunu / Nunu & Willump|`TFT13_NunuWillump`<br>`/setData/1/champions/47`|3|800.0 / 50.0 / 50.0 / 50.0|0.6000000238418579；60.0/125.0；1.0|Experiment, Bruiser, Visionary|
|gangplank / Gangplank|`TFT13_Gangplank`<br>`/setData/1/champions/65`|3|700.0 / 50.0 / 0.0 / null|0.5；0/10.0；1.0|Scrap, Form Swapper, Pit Fighter|
|swain / Swain|`TFT13_Swain`<br>`/setData/1/champions/73`|3|650.0 / 50.0 / 0.0 / null|0.5；0/10.0；1.0|Conqueror, Form Swapper, Sorcerer|

### Renata Glasc — Loyalty Program

属性完整；导弹穿线路径、友军命中判定与同距排序需项目合同。

|变量（相对 `/ability/variables`）|1/2/3星原值|
|---|---|
|`/0/value` Shield|`[95.0,120.0,150.0]`|
|`/1/value` ShieldDuration|`[3.0,3.0,3.0]`|
|`/2/value` TargetDamage|`[310.0,465.0,700.0]`|
|`/3/value` ExplosionDamage|`[155.0,230.0,350.0]`|
|`/4/value` AdditionalSearchDistance|`[150.0,150.0,150.0]`|

### Silco — Canned Monstrosity

本体属性完整；召唤物模板hp/damage=null。源本体给4/4/8只、每只5次攻击、12秒存续，不能自行捏造独立召唤物生命；B补丁MinionDamage另见冲突。

|变量（相对 `/ability/variables`）|1/2/3星原值|
|---|---|
|`/0/value` Damage|`[100.0,200.0,1000.0]`|
|`/1/value` MinionsSpawned|`[4.0,4.0,8.0]`|
|`/2/value` MinionsThatAttackCurrentTarget|`[2.0,2.0,4.0]`|
|`/3/value` MinionDamage|`[38.0,57.0,100.0]`|
|`/4/value` MinionDuration|`[12.0,12.0,12.0]`|
|`/5/value` MinionNumAttacks|`[5.0,5.0,5.0]`|

### Dr. Mundo — Maximum Dosage

属性完整；18%最大生命+AP治疗，其中40%立即；2秒持续伤害与结束爆炸不能合成单次伤害；实验分支单列。

|变量（相对 `/ability/variables`）|1/2/3星原值|
|---|---|
|`/0/value` PercentHealthHeal|`[0.18000000715255737,0.18000000715255737,0.18000000715255737]`|
|`/1/value` APHeal|`[650.0,750.0,2500.0]`|
|`/2/value` PercentofHealImmediately|`[0.4000000059604645,0.4000000059604645,0.4000000059604645]`|
|`/3/value` Duration|`[2.0,2.0,2.0]`|
|`/4/value` APDamage|`[120.0,180.0,1000.0]`|
|`/5/value` PercentHealthDamage|`[0.07000000029802322,0.07000000029802322,0.3499999940395355]`|
|`/6/value` ExperimentHealthGain|`[60.0,60.0,60.0]`|
|`/7/value` BaseExperimentHealthGain|`[120.0,120.0,120.0]`|

### Cassiopeia — Thorned Miasma

属性完整；每第3次施法及额外2目标、3格范围有源值；目标排序与重复命中口径需合同。

|变量（相对 `/ability/variables`）|1/2/3星原值|
|---|---|
|`/0/value` Damage|`[230.0,345.0,550.0]`|
|`/1/value` MiasmaDamage|`[160.0,240.0,385.0]`|
|`/2/value` BonusNumEnemies|`[2.0,2.0,2.0]`|
|`/3/value` NumCasts|`[3.0,3.0,3.0]`|
|`/4/value` HexRadius|`[3.0,3.0,3.0]`|

### Elise — Cocoon

形态模板：magicResist=null，armor=0、mana=10不可当完整战斗属性；EliseSpider同样缺hp/damage/armor，未给远程技能。

|变量（相对 `/ability/variables`）|1/2/3星原值|
|---|---|
|`/0/value` StunDuration|`[1.75,2.0,8.0]`|
|`/1/value` SearchRange|`[2.0,2.0,2.0]`|
|`/2/value` Damage|`[120.0,180.0,1200.0]`|
|`/3/value` HexRadius|`[2.0,2.0,2.0]`|
|`/4/value` FlatHealth|`[400.0,450.0,2000.0]`|

### Jayce — Special Delivery

形态模板：magicResist=null；锻炉hp/magicResist=null、技能Placeholder；缺远程技能与锻炉摆放合同。

|变量（相对 `/ability/variables`）|1/2/3星原值|
|---|---|
|`/0/value` PercentAttackDamage|`[5.0,5.0,20.0]`|
|`/1/value` PercentADSecondaryDamage|`[2.25,2.25,15.0]`|
|`/2/value` NumAlliesShield|`[3.0,3.0,3.0]`|
|`/3/value` Shield|`[200.0,275.0,1800.0]`|
|`/4/value` ShieldDuration|`[4.0,4.0,4.0]`|
|`/5/value` InitialGateDistanceBehindTheTarget|`[480.0,480.0,480.0]`|
|`/6/value` EnemyFlightDuration|`[0.75,0.75,0.75]`|
|`/7/value` FlyingEnemyDamageRadius|`[290.0,290.0,290.0]`|
|`/8/value` MaxEnemySpeed|`[2300.0,2300.0,2300.0]`|
|`/9/value` MinEnemySpeed|`[1650.0,1650.0,1650.0]`|
|`/10/value` ReducedSummonHealth|`[1.0,1.0,1.0]`|

### Smeech — Scrap Hacker

属性完整；4格内最少装备目标、3段斩击和击杀再跳；最少装备平局及连续再跳衰减口径待约定。

|变量（相对 `/ability/variables`）|1/2/3星原值|
|---|---|
|`/0/value` PercentAttackDamage|`[5.0,5.0,5.0]`|
|`/1/value` APDamage|`[70.0,105.0,170.0]`|
|`/2/value` LeapHexRange|`[4.0,4.0,4.0]`|
|`/3/value` BaseNumStabs|`[3.0,3.0,3.0]`|
|`/4/value` DamageReductionOnLeap|`[0.30000001192092896,0.30000001192092896,0.30000001192092896]`|

### Sevika — Beat the Odds

属性完整；3技能子文案是未展开模板；High Roller概率为未解码hash字段，不能猜成等概率或固定轮换；随机合同和金币收据须另批。

|变量（相对 `/ability/variables`）|1/2/3星原值|
|---|---|
|`/0/value` Spell1_ADPercent|`[2.4000000953674316,2.4000000953674316,15.0]`|
|`/1/value` Spell1_ReducedDamagePercent|`[0.5,0.5,0.5]`|
|`/2/value` Spell1_MinDuration|`[2.0,2.0,2.0]`|
|`/3/value` Spell1_Bonus_DamagePercentPerSecond|`[0.20000000298023224,0.20000000298023224,0.20000000298023224]`|
|`/4/value` Spell1_HighrollBonus|`[20.0,20.0,20.0]`|
|`/5/value` APBonusDamage|`[20.0,30.0,500.0]`|
|`/6/value` Spell2_HexRadius|`[1.0,1.0,1.0]`|
|`/7/value` Spell2_Modifier|`[3.0,3.0,3.0]`|
|`/8/value` Spell2_SecondaryModifier|`[1.2999999523162842,1.2999999523162842,1.2999999523162842]`|
|`/9/value` Spell2_HexKnockback|`[10.0,10.0,10.0]`|
|`/10/value` Spell2_StunDuration|`[1.5,1.5,1.5]`|
|`/11/value` Spell2_Bonus_KnockbackDamage|`[4.0,4.0,10.0]`|
|`/12/value` Spell3_Modifier|`[3.200000047683716,3.200000047683716,3.200000047683716]`|
|`/13/value` Spell3_BleedModifier|`[0.75,0.75,0.75]`|
|`/14/value` Spell3_StunDuration|`[1.25,1.25,1.25]`|
|`/15/value` Spell3_NumSlams|`[2.0,2.0,2.0]`|
|`/16/value` Spell3_BleedDuration|`[5.0,5.0,5.0]`|
|`/17/value` Spell3_TargetPercentHealthDamage|`[0.20000000298023224,0.20000000298023224,0.20000000298023224]`|
|`/18/value` Spell3_HexRadius|`[1.0,1.0,1.0]`|
|`/19/value` Spell3_Bonus_BleedADPercent|`[4.0,4.0,10.0]`|
|`/20/value` Spell3_Bonus_BleedDuration|`[20.0,20.0,20.0]`|
|`/21/value` Spell3_ExecutePercentage|`[0.15000000596046448,0.15000000596046448,1.0]`|
|`/22/value` Spell3_ResetDashRange|`[2.0,2.0,10.0]`|
|`/23/value` Spell3_ResetDamageFalloff|`[0.800000011920929,0.800000011920929,0.800000011920929]`|
|`/24/value` Spell3_BonusNumChomps|`[4.0,4.0,4.0]`|

### Renni — Sludgerunner's Smash

属性完整；保留普通技能，Hero/HERO字段为强化分支候选，不自动启用。抬起、眩晕、持续治疗及落地范围需合同。

|变量（相对 `/ability/variables`）|1/2/3星原值|
|---|---|
|`/0/value` APHeal|`[300.0,325.0,375.0]`|
|`/1/value` MaxHealthHealingPercent|`[0.15000000596046448,0.15000000596046448,0.15000000596046448]`|
|`/2/value` StunDuration|`[1.5,1.5,1.5]`|
|`/3/value` ADPercent|`[5.0,5.0,5.0]`|
|`/4/value` FinalADPercent|`[2.0,2.0,2.0]`|
|`/5/value` HeroAbilityDamage|`[1.100000023841858,1.100000023841858,1.100000023841858]`|
|`/6/value` HeroManaReduction|`[10.0,10.0,10.0]`|
|`/7/value` HeroHexDistance|`[2.0,2.0,2.0]`|
|`/8/value` HeroChargePercent|`[0.30000001192092896,0.30000001192092896,0.30000001192092896]`|
|`/9/value` HeroStunDuration|`[0.5,0.5,0.5]`|
|`/10/value` HEROMaxHealthHealingPercent|`[0.05999999865889549,0.05999999865889549,0.05999999865889549]`|

### Nunu & Willump — ZOMBIE POWER!!

属性完整；3秒内每秒2次伤害、结束爆炸；Experiment分支需与实验格一起批准，不能静默丢弃。

|变量（相对 `/ability/variables`）|1/2/3星原值|
|---|---|
|`/0/value` Durability|`[0.5,0.5,0.550000011920929]`|
|`/1/value` Damage|`[30.0,45.0,65.0]`|
|`/2/value` DamageTicksPerSecond|`[2.0,2.0,2.0]`|
|`/3/value` SecondDamage|`[150.0,225.0,340.0]`|
|`/4/value` DamageDuration|`[3.0,3.0,3.0]`|
|`/5/value` HexRadius|`[2.0,2.0,2.0]`|
|`/6/value` ExperimentMaxHealthDamage|`[0.029999999329447746,0.029999999329447746,0.029999999329447746]`|
|`/7/value` ExperimentICD|`[1.0,1.0,1.0]`|

### Gangplank — Harvest from Flames

形态模板：magicResist=null；NumBarrels.value=null，缺桶/远程技能；源damage=50不同于B补丁近战65。

|变量（相对 `/ability/variables`）|1/2/3星原值|
|---|---|
|`/0/value` PercentAttackDamage|`[3.4000000953674316,3.4000000953674316,3.4000000953674316]`|
|`/1/value` Heal|`[100.0,125.0,150.0]`|
|`/2/value` NumBarrels|`null`|
|`/3/value` SingleTargetDamageIncrease|`[1.0,1.0,1.0]`|

### Swain — Demonic Ascension

形态模板：magicResist=null；恶魔记录技能为Placeholder，缺远程形态。G2-2已阻止准入。

|变量（相对 `/ability/variables`）|1/2/3星原值|
|---|---|
|`/0/value` Heal|`[240.0,300.0,380.0]`|
|`/1/value` HealPerSecond|`[70.0,90.0,125.0]`|
|`/2/value` DamagePerSecond|`[40.0,60.0,95.0]`|
|`/3/value` Duration|`[6.0,6.0,6.0]`|
|`/4/value` BonusDuration|`[2.0,2.0,2.0]`|

### 形态与召唤物旁证

|辅助记录|pointer|关键缺口|
|---|---|---|
|TFT13_EliseSpider|`/setData/1/champions/54`|ability/desc, ability/name, role, stats/armor, stats/damage, stats/hp|
|TFT13_Sion|`/setData/1/champions/60`|role, stats/magicResist|
|TFT13_Silco_Monstrosity|`/setData/1/champions/62`|icon, role, squareIcon, stats/critChance, stats/damage, stats/hp|
|TFT13_SwainDemonForm|`/setData/1/champions/74`|ability/icon, icon, role, squareIcon, stats/armor, stats/damage, stats/hp|
|TFT13_JayceSummon|`/setData/1/champions/77`|ability/icon, role, stats/hp, stats/magicResist|

四位 Form Swapper 都不能仅凭本源做完整双形态。Elise不能算作普通已齐英雄；SwainDemonForm/EliseSpider的20魔抗不能自动覆盖本体null，JayceSummon不是远程Jayce。源Form Swapper描述已给出「前2排/后2排」选择条件（`/setData/1/traits/5/desc`），但缺两套完整数值与技能；这一点补充了G2-2 SWAIN.md中“站位选择条件缺”的结论。

|形态英雄|可提交用户评估的近似方案（未获准）|仍阻塞准入的资料|
|---|---|---|
|Elise|固定近战Cocoon：2格跳跃群控、伤害与治疗按源；省略后排技能与换形|完整战斗属性及跳跃目标/落点合同；不得由蜘蛛模板借MR|
|Swain|固定近战Demonic Ascension：6秒持续治疗/邻格DOT，击杀延长2秒；省略后排技能与换形|完整战斗属性、持续施法重入规则；不得由恶魔模板借MR|
|Gangplank|固定近战治疗+直线斩击，孤立目标翻倍；省略桶与远程技能|完整战斗属性、直线宽度；近战AD65可由B补丁支持，其余不能据此填齐|
|Jayce|固定近战击退+路径伤害；若无锻炉完整源，建议继续暂缓|完整属性与锻炉属性、可摆放/复活合同；省略锻炉会丢被动，必须单独批准|

## 剩余羁绊：源实际12项

所有档位的 minUnits/maxUnits/style/variables 精确值见下表及JSON；自然可达档按完整60人集合中不同英雄计数，未考虑当前形态阻塞。无转职时高于该人数的档位只保留证据，不推定可用。另有征服者/学院2项已有有限实现的复核，所以本稿共审阅14个羁绊对象（12新增+2已有待补），不称14个新增。

|羁绊 / apiName|pointer|成员数；自然可达档|对账与缺口|
|---|---|---|---|
|Form Swapper / `TFT13_FormSwapper`|`/setData/1/traits/5`|4；[2,4]|前2排/后2排切形态及2/4档DR/DA有文案；4英雄完整形态属性和后排技能缺失，阻塞完整实现。|
|Ambusher / `TFT13_Ambusher`|`/setData/1/traits/11`|5；[2,3,4,5]|技能可暴击、暴击率/暴伤及5档坚韧有源值；须约定技能暴击与既有装备重复开启语义。|
|Visionary / `TFT13_Invoker`|`/setData/1/traits/13`|7；[2,4,6]|所有法力获得放大25/50/80/100%；8档技能伤害治疗友军20%；不能仅放大普攻回蓝，受益友军选择需约定。|
|High Roller / `TFT13_HighRoller`|`/setData/1/traits/16`|1；[1]|80%坚韧1.5秒；火箭8×100、盾500/4秒、金币3；概率hash键未解码，三倍技能规则仍需子文案。|
|Chem-Baron / `TFT13_Crime`|`/setData/1/traits/18`|6；[3,4,5,6]|3/4/5/6/7档；连败>=3、微光100阈值有源值；黑市奖励池/跳过/永久生命账本缺完整合同；不能当普通静态生命羁绊。|
|Dominator / `TFT13_Infused`|`/setData/1/traits/20`|6；[2,4,6]|开战盾350/500/700，15秒；消耗法力转AP25/45/65%；按实际花费/上限及取整时点需合同。|
|Pit Fighter / `TFT13_Pugilist`|`/setData/1/traits/21`|6；[2,4,6]|15%全能吸血；50%生命触发一次2秒治疗；各档真伤/治疗有源值；额外真伤基数和触发伤害递归需合同。|
|Experiment / `TFT13_Experiment`|`/setData/1/traits/26`|5；[3,5]|3/5/7档实验格2/3/3、生命100/300/300、7档额外100%实验增益；格位与各英雄实验属性要另批，null不可填0。|
|Bruiser / `TFT13_Bruiser`|`/setData/1/traits/27`|6；[2,4,6]|全队100固定生命；成员额外20/45/80%最大生命；固定生命与百分比取值顺序需约定。|
|Junker King / `TFT13_JunkerKing`|`/setData/1/traits/28`|1；[1]|每3轮开机甲升级军械库；只含部分周期/hash参数，升级菜单、价格、叠加缺完整合同。|
|Black Rose / `TFT13_Cabal`|`/setData/1/traits/29`|5；[3,4,5]|3/4/5/7档；5次施法或65%血量解锁Sion，15%星级生命参数；Sion及阶段缩放需额外取证。|
|Quickstriker / `TFT13_Challenger`|`/setData/1/traits/30`|4；[2,3,4]|2/3/4档按目标缺血在20–60/30–80/40–100%攻速间变化；4档死亡转目标盾200/3秒；移动与插值取整需合同。|

### Form Swapper：各档原值

|minUnits–maxUnits；style|variables（源原值）|
|---|---|
|2–3；1|`{"DA":0.20000000298023224,"DR":0.15000000596046448}`|
|4–25000；5|`{"DA":0.4000000059604645,"DR":0.30000001192092896}`|

源成员：Elise, Jayce, Gangplank, Swain。

### Ambusher：各档原值

|minUnits–maxUnits；style|variables（源原值）|
|---|---|
|2–2；1|`{"CritChance":0.25,"CritDamage":0.10000000149011612}`|
|3–3；3|`{"CritChance":0.3499999940395355,"CritDamage":0.20000000298023224}`|
|4–4；3|`{"CritChance":0.44999998807907104,"CritDamage":0.25}`|
|5–25000；5|`{"CritChance":0.550000011920929,"CritDamage":0.25,"DamageReductionPct":0.15000000596046448}`|

源成员：Camille, Ekko, Smeech, Powder, Jinx。

### Visionary：各档原值

|minUnits–maxUnits；style|variables（源原值）|
|---|---|
|2–3；1|`{"EnlightenedBonusMana":0.25}`|
|4–5；3|`{"EnlightenedBonusMana":0.5}`|
|6–7；5|`{"EnlightenedBonusMana":0.800000011920929}`|
|8–25000；5|`{"AllyHealing":0.20000000298023224,"EnlightenedBonusMana":1.0}`|

源成员：Renata Glasc, Malzahar, Rell, Heimerdinger, Nunu & Willump, Vex, Morgana。

### High Roller：各档原值

|minUnits–maxUnits；style|variables（源原值）|
|---|---|
|1–25000；4|`{"Bonus1NumRockets":8.0,"Bonus1RocketDamage":100.0,"Bonus2ShieldAmount":500.0,"Bonus2ShieldDuration":4.0,"Bonus4Gold":3.0,"Durability":0.800000011920929,"Duration":1.5,"{01148678}":0.3499999940395355,"{267deafa}":0.3499999940395355,"{52aec87f}":0.10000000149011612,"{592d23e5}":0.3499999940395355,"{699f6a87}":0.20000000298023224,"{9ad9e572}":0.004999999888241291,"{9b22c5ec}":null,"{bcedb441}":1.5,"{e1fc0fa1}":0.24500000476837158,"{e640e05f}":0.4000000059604645}`|

源成员：Sevika。

### Chem-Baron：各档原值

|minUnits–maxUnits；style|variables（源原值）|
|---|---|
|3–3；1|`{"HealthPerSkip":20.0,"MinStreakLength":3.0,"ShimmerBreakpoint":100.0,"ShimmerPerCombat":15.0,"ShimmerPerCombatStreaking":35.0,"ShimmerPerCombatStreaking_HR":50.0,"ShimmerPerCombat_HR":25.0,"ShimmerPerDeath_PVE":1.0,"ShimmerPerRound_PVE":15.0,"{ecbc38fd}":1.0}`|
|4–4；3|`{"HealthPerSkip":60.0,"MinStreakLength":3.0,"ShimmerBreakpoint":100.0,"ShimmerPerCombat":20.0,"ShimmerPerCombatStreaking":45.0,"ShimmerPerCombatStreaking_HR":60.0,"ShimmerPerCombat_HR":30.0,"ShimmerPerDeath_PVE":1.0,"ShimmerPerRound_PVE":20.0,"{ecbc38fd}":1.0}`|
|5–5；5|`{"HealthPerSkip":110.0,"MinStreakLength":3.0,"ShimmerBreakpoint":100.0,"ShimmerPerCombat":20.0,"ShimmerPerCombatStreaking":55.0,"ShimmerPerCombatStreaking_HR":70.0,"ShimmerPerCombat_HR":35.0,"ShimmerPerDeath_PVE":2.0,"ShimmerPerRound_PVE":30.0,"{ecbc38fd}":1.0}`|
|6–6；5|`{"HealthPerSkip":160.0,"MinStreakLength":3.0,"ShimmerBreakpoint":100.0,"ShimmerPerCombat":25.0,"ShimmerPerCombatStreaking":70.0,"ShimmerPerCombatStreaking_HR":90.0,"ShimmerPerCombat_HR":45.0,"ShimmerPerDeath_PVE":3.0,"ShimmerPerRound_PVE":40.0,"{ecbc38fd}":1.0}`|
|7–25000；5|`{"HealthPerSkip":220.0,"MinStreakLength":3.0,"ShimmerBreakpoint":100.0,"ShimmerPerCombat":30.0,"ShimmerPerCombatStreaking":100.0,"ShimmerPerCombatStreaking_HR":125.0,"ShimmerPerCombat_HR":60.0,"ShimmerPerDeath_PVE":15.0,"ShimmerPerRound_PVE":65.0,"{ecbc38fd}":1.0}`|

源成员：Singed, Renata Glasc, Silco, Smeech, Sevika, Renni。

### Dominator：各档原值

|minUnits–maxUnits；style|variables（源原值）|
|---|---|
|2–3；1|`{"APPercent":0.25,"ShieldAmount":350.0,"ShieldDuration":15.0}`|
|4–5；3|`{"APPercent":0.44999998807907104,"ShieldAmount":500.0,"ShieldDuration":15.0}`|
|6–25000；5|`{"APPercent":0.6499999761581421,"ShieldAmount":700.0,"ShieldDuration":15.0}`|

源成员：Silco, Blitzcrank, Dr. Mundo, Cassiopeia, Ziggs, Mordekaiser。

### Pit Fighter：各档原值

|minUnits–maxUnits；style|variables（源原值）|
|---|---|
|2–3；1|`{"Duration":2.0,"HealPercent":0.10000000149011612,"HealthThreshold":0.5,"OmnivampPercent":0.15000000596046448,"TrueDamagePercent":0.05999999865889549}`|
|4–5；3|`{"Duration":2.0,"HealPercent":0.25,"HealthThreshold":0.5,"OmnivampPercent":0.15000000596046448,"TrueDamagePercent":0.11999999731779099}`|
|6–7；5|`{"Duration":2.0,"HealPercent":0.4000000059604645,"HealthThreshold":0.5,"OmnivampPercent":0.15000000596046448,"TrueDamagePercent":0.20000000298023224}`|
|8–25000；5|`{"Duration":2.0,"HealPercent":0.800000011920929,"HealthThreshold":0.5,"OmnivampPercent":0.15000000596046448,"TrueDamagePercent":0.4000000059604645}`|

源成员：Vi, Draven, Sevika, Violet, Gangplank, Urgot。

### Experiment：各档原值

|minUnits–maxUnits；style|variables（源原值）|
|---|---|
|3–4；1|`{"ExperimentBonusIncrease":null,"MaxHealth":100.0,"NumLaboratory":2.0,"{a02e81c2}":1.149999976158142}`|
|5–6；5|`{"ExperimentBonusIncrease":null,"MaxHealth":300.0,"NumLaboratory":3.0,"{a02e81c2}":1.2999999523162842}`|
|7–25000；5|`{"ExperimentBonusIncrease":1.0,"MaxHealth":300.0,"NumLaboratory":3.0,"{a02e81c2}":1.5}`|

源成员：Dr. Mundo, Twitch, Nunu & Willump, Zyra, Urgot。

### Bruiser：各档原值

|minUnits–maxUnits；style|variables（源原值）|
|---|---|
|2–3；1|`{"BonusPercentHealth":0.20000000298023224,"TeamFlatHealth":100.0}`|
|4–5；3|`{"BonusPercentHealth":0.44999998807907104,"TeamFlatHealth":100.0}`|
|6–25000；5|`{"BonusPercentHealth":0.800000011920929,"TeamFlatHealth":100.0}`|

源成员：Sett, Elise, Trundle, Renni, Steb, Nunu & Willump。

### Junker King：各档原值

|minUnits–maxUnits；style|variables（源原值）|
|---|---|
|1–25000；4|`{"NumRounds1Star":3.0,"NumRounds1Star_HR":2.0,"{7b91cfd3}":2.0,"{da177dfb}":1.0,"{ea33712c}":3.0,"{ed4fa85a}":1.0}`|

源成员：Rumble。

### Black Rose：各档原值

|minUnits–maxUnits；style|variables（源原值）|
|---|---|
|3–3；1|`{"NumCastsToUnlock":5.0,"PercentHealthPerStarLevel":0.15000000596046448,"PercentHealthUnlock":0.6499999761581421,"{2c6be05c}":0.11999999731779099,"{2e45fc86}":40.0,"{85b293ec}":0.3499999940395355,"{92ef9cd7}":4.0}`|
|4–4；3|`{"NumCastsToUnlock":5.0,"PercentHealthPerStarLevel":0.15000000596046448,"PercentHealthUnlock":0.6499999761581421,"{2c6be05c}":0.11999999731779099,"{2e45fc86}":45.0,"{85b293ec}":0.3499999940395355,"{92ef9cd7}":4.0}`|
|5–6；5|`{"NumCastsToUnlock":5.0,"PercentHealthPerStarLevel":0.15000000596046448,"PercentHealthUnlock":0.6499999761581421,"{2c6be05c}":0.11999999731779099,"{2e45fc86}":50.0,"{85b293ec}":0.3499999940395355,"{92ef9cd7}":4.0}`|
|7–25000；5|`{"NumCastsToUnlock":5.0,"PercentHealthPerStarLevel":0.15000000596046448,"PercentHealthUnlock":0.6499999761581421,"{2c6be05c}":0.11999999731779099,"{2e45fc86}":100.0,"{85b293ec}":0.3499999940395355,"{92ef9cd7}":4.0}`|

源成员：Cassiopeia, Vladimir, Elise, LeBlanc, Morgana。

### Quickstriker：各档原值

|minUnits–maxUnits；style|variables（源原值）|
|---|---|
|2–2；1|`{"MaxBonusAS":0.6000000238418579,"MinBonusAS":0.20000000298023224,"{0e9453af}":null,"{bdb9953b}":200.0}`|
|3–3；3|`{"MaxBonusAS":0.800000011920929,"MinBonusAS":0.30000001192092896,"{0e9453af}":null,"{bdb9953b}":200.0}`|
|4–25000；5|`{"MaxBonusAS":1.0,"MinBonusAS":0.4000000059604645,"ShieldAmount":200.0,"ShieldDuration":3.0,"{0e9453af}":null,"{bdb9953b}":200.0}`|

源成员：Akali, Nocturne, Ambessa, Twisted Fate。

## 异变3→30：27项待核候选与逐项源值边界

指定文件根节点只有 items/setData/sets，标准set只有 augments/champions/items/mutator/name/number/traits；没有异变定义集合。2055条items里的Another Anomaly、Guided Anomaly是强化，Portable Anomaly是道具，其effects不能冒充异变源值。现有3项英文名也没有匹配的raw定义。旧 `source/s13-14.24.json` 仅有 provenance/champions/traits/items/augments。

仓库 `source-manifest.ts.anomalySource` 指向 [Wiki旧版](https://wiki.leagueoflegends.com/en-us/TFT:Anomaly?oldid=3848901)，本次无法读取该固定版本；[当前Wiki索引](https://wiki.leagueoflegends.com/en-us/TFT:Anomaly)只为最后3项提供名称线索，不作为14.24b数值证据。另参考[官方14.24补丁（含12月10日与17日更新）](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)的部分变更参数。以下各项raw值及pointer均缺；补丁部分参数不等于完整描述、完整源值或获准实现。

|已有异变|仓库当前值|raw值 / pointer|官方补丁可证明部分|
|---|---|---|---|
|titanic-strikes|AD 4000Bps；半径1|缺 / 缺|AD溅射40%|
|mage-armor|转换前最终AP的5000Bps转双抗|缺 / 缺|AP转双抗50%|
|kill-streak|击杀且本tick存活时20蓝|缺 / 缺|击杀20蓝|

已有项的半径、观察时点、同tick存活条件属于仓库语义，补丁没有证明全部细节。

|新增候选（27项）|指定源值 / pointer|补充来源的已知部分|还需取证|
|---|---|---|---|
|Arcana Overwhelming|缺 / 缺|官方补丁 `{"bonusMagicResist":65}`|补充MR→AP完整转换口径|
|Avalanche of Armor|缺 / 缺|官方补丁 `{"armorToAttackDamageRatio":0.3}`|补充基础护甲与转换顺序|
|Center of the Universe|缺 / 缺|官方仅述轨道变快|需轨道周期、伤害、目标与几何|
|Berserker Rage|缺 / 缺|官方补丁 `{"baseAttackDamagePercent":25,"baseAbilityPower":25}`|补充低血阈值和增幅完整语义|
|Bully|缺 / 缺|官方补丁 `{"baseDamageAmpPercent":12,"lowerStarTargetDamageAmpPercent":36}`|补充目标星级取值合同|
|Comeback Story|缺 / 缺|官方补丁 `{"damageAmpPercentPer10PlayerHealthLost":5}`|12月10日微补丁覆盖正文6；需玩家累计损血输入|
|Dramatic Entrance|缺 / 缺|官方补丁 `{"stunSeconds":2,"bonusHealthPercent":55}`|补充离场/返回时间与生命计算|
|Fireball|缺 / 缺|官方补丁 `{"targetMaxHealthDamagePercent":6}`|补充法力累计、范围与灼烧语义|
|Fortified|缺 / 缺|官方补丁 `{"stackPeriodSeconds":4}`|补充基础生命、每层量和上限|
|Hardened Mind|缺 / 缺|官方补丁 `{"bonusArmorAndMagicResistPercent":66}`|官方使用此名称；与Defense Expert名称关系未证实，不合并|
|Heavy Hitter|缺 / 缺|官方补丁 `{"cooldownSeconds":2.5}`|补充每击生命系数与触发时机|
|Laser Eyes|缺 / 缺|官方补丁 `{"abilityPowerRatio":1}`|补充频率、长度、灼烧与伤害分包|
|Legacy of Shurima|缺 / 缺|官方补丁 `{"maxHealthPercent":50}`|补充启动时间与攻速|
|Magic Training|缺 / 缺|官方补丁 `{"baseAbilityPower":15}`|补充团队施法成长与耗蓝计数|
|Power Absorption|缺 / 缺|官方补丁 `{"allyAttackDamageAbsorbPercent":9}`|官方限制AD二次百分比放大；需基础AD与死亡快照|
|Protective Shielding|缺 / 缺|官方补丁 `{"maxHealthShieldPercent":12,"shieldSeconds":4}`|补充周期、友军选择与重复施加|
|Nothing Wasted|缺 / 缺|官方补丁 `{"manaGainPercent":70}`|补充死亡时当前法力继承与法力上限|
|One Thousand Cuts|缺 / 缺|官方补丁 `{"trueDamagePerAttackIncrement":12}`|补充基础伤害与目标独立叠层口径|
|Scuttle Familiar|缺 / 缺|官方补丁 `{"inheritedStatPercent":100}`|官方清除减双抗后取值；需召唤物完整规则|
|Share Your Energy|缺 / 缺|官方补丁 `{"statSharePercent":15}`|补充属性集合、邻格与转换反馈顺序|
|Slime Time|缺 / 缺|官方补丁 `{"abilityPowerRatio":1.3}`|补充周期、范围、治疗口径|
|Slow Cooker|缺 / 缺|官方补丁 `{"maxHealthDamagePercent":3}`|补充周期、范围成长及生命取值|
|Ultimate Hero|缺 / 缺|官方补丁 `{"delayRounds":3}`|需要4星/升星资格及离散成长合同；复杂候选后置|
|Wolf Familiars|缺 / 缺|官方补丁 `{"attackSpeed":1}`|需狼数量/伤害/存活与不可选中规则|
|Attack Expert|缺 / 缺|未冻结Wiki名称线索；数值不采用|仅名称线索，缺14.24b锁定完整源值|
|Magic Expert|缺 / 缺|未冻结Wiki名称线索；数值不采用|仅名称线索，缺14.24b锁定完整源值|
|Bulwark|缺 / 缺|未冻结Wiki名称线索；数值不采用|仅名称线索，缺14.24b锁定完整源值|

Cosmic Rhythm 被官方14.24明确停用，排除，不用于凑数。Hardened Mind按官方拼写保留；不能未经取证就与Defense Expert合并。27项是可审阅的候选池，不是已经选定且数据齐全的上线清单；提供完整异变源前，3→30的逐项raw对账仍未完成，不能制造27个sourcePointer或用强化effects代替。

## 冻结源与B补丁冲突（只列证据，不覆盖）

目录名14.24b不保证每个字段包含12月17日B补丁；本表保留raw，并分列补丁。

|对象|raw|官方B补丁|影响|
|---|---|---|---|
|Silco MinionDamage|38/57/100|36/55/100|未来实现须显式补丁覆盖，不能称raw原值|
|Gangplank近战AD|模板50|60→65|不能仅补65便宣称四名形态英雄属性齐全|
|Conqueror每箱成长|3%|5%|当前未做宝箱；补齐时必须明确版本|

更广的已有内容B补丁差异不在本稿扩展范围；本稿没有做全库14.24b合规声明。

## 需用户批准的项目约定

下列是后续实现前的决策清单，非本次提交已执行的约定。征服者/学院现有有限发布已获G2-2批准，不重复索要既有授权；新增档位、完整机制与形态准入仍需决定。

### G23-FORM：Elise/Swain/Jayce/Gangplank形态准入（pending-user-approval）

1. 推荐：维持暂缓，另补四英雄完整前后排属性/技能及形态覆盖源，再批准实现。
2. 有限方案：批准只做固定近战技能；四人完整属性表必须另行定稿，不允许本次把null补0、跨形态借值或用50AD/0甲/10蓝模板冒充正式属性。

可近似技能：Elise近身跳跃群控+治疗；Swain持续变身治疗/DOT/击杀延长；Jayce主目标击退+路径伤害；Gangplank直线斩击+孤立翻倍。不支持后排技能和形态切换；不启用Form Swapper羁绊。Jayce还需单独批准如何处理可摆放锻炉及死亡复活，建议缺源前继续暂缓Jayce。

### G23-CONQUEROR：征服者有限实现及扩档（pending-extension-only）

既有授权：依据 [docs/evidence/g2-2/RECONCILIATION.md 的「已获准有限发布」小节](../g2-2/RECONCILIATION.md#已获准有限发布后续完整实现待批清单)：2/4档仅基础18/25% AD与18/25 AP，用户已允许有限发布。

1. 推荐：保留已批准有限实现；6档基础40%/40AP、9档自然不可达及宝箱整链另议。
2. 补齐：先提供征服累计阈值、宝箱池、永久进度/恢复/重复结算合同，明确B补丁每宝箱5%成长后另批。

本次不撤销已有授权，也不把「有限发布」当作完整玩法批准；raw每宝箱3%与官方B补丁5%冲突。

### G23-ACADEMY：学院固定赞助及随机发装扩展（pending-extension-only）

既有授权：G2-2已批准固定archangel/deathblade/warmog、不发装备、每持有者计一次，现有3/4档。

1. 推荐：保留现有有限合同；补齐Jayce后若要5档5%或6档9%须单独批准，6档自然不可达。
2. 完整方案：另批赞助物抽样池/权重、发放时点、升降档是否补发、叠加口径与收据。

raw说明每局3类赞助，NumOfItems为1/2/3/3；不能由此推定固定池、全程免费发3件或穿多件只计一次。

### G23-COUNTS：剩余14个羁绊目标与源实际12个差异（pending-scope-correction）

1. 推荐：按源26总数、14已有、12剩余记录；保留7项Teamup为强化解锁单独范围。
2. 坚持28总数：请先指定额外2项及来源/玩法，不从7项Teamup任挑2项凑数。

目标文档的28（13阵营+15职业）未被本冻结源支持；本次证据不修改原规划。

### G23-ANOMALY-SOURCE：异变3→30的冻结来源（pending-source-policy）

1. 推荐：另补14.24b版本可下载且可hash的27项完整定义；本清单27项仅待核候选。
2. 用户提供并批准明确的项目自定义数值与缺失语义；须标为项目约定，不能声称来自本压缩源。

现有Wiki oldid无法读取；现行页面索引混有后续补丁，不能反填14.24b。官方补丁只证明部分参数。

### G23-COMPLEX：新英雄及复杂羁绊的有限近似（pending-finite-mechanics）

1. 推荐：先处理属性/主要系数齐全项，召唤物、随机/金币、实验格、黑市、Sion、机甲升级各自另批合同。
2. 批准逐项有限近似，但必须明确省略效果、数值来源和随机/收据规则。

Silco不能把全部小怪压成一次必中伤害冒充原技能；Sevika不能猜概率；Chem-Baron/Junker King不能仅保留一个静态buff便算完成。

## 交付边界

本稿仅含 RECONCILIATION.md 与 source-selection.json。未添加实现、参数覆盖、内容版本或digest迁移。完整英雄/羁绊raw记录、字段位置、库内差集、辅助模板、异变缺源及补丁部分证据都在JSON中；没有宣称剩余内容已可运行。
