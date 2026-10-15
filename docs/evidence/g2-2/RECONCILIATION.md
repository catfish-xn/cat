# G2-2 对账表

48 英雄（新增15）、14 羁绊（新增6）；8 普通散件/36 成装保持不变；不做金铲铲、转职、光明装备。源为锁定的 s13-14.24b/raw/en_us.json.gz；解压 SHA256 `c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3`。

`reconciliation.json` 保留每个英雄全部 stats、技能变量（含未启用分支）、运行时每星值及 JSON pointer；此表展示映射。斯维因完整字段见 [SWAIN.md](SWAIN.md)，缺失属性不填数；同样排除 Jayce/Gangplank 形态模板，用属性完整的 Morgana 补齐。

## 英雄属性与技能字段

|英雄|新增|cost|hp/damage/armor/magicResist|attackSpeed; initialMana/mana; range|源羁绊 → 运行时|源 pointer|
|---|---|---|---|---|---|---|
|akali|是|2|700/45/45/45|0.75; 0/60; 1|Rebel,Quickstriker → rebel|/setData/1/champions/23|
|ambessa|是|4|1100/65/50/50|0.800000011920929; 40/90; 1|Emissary,Conqueror,Quickstriker → emissary,conqueror|/setData/1/champions/61|
|amumu|否|1|600/45/35/35|0.6000000238418579; 0/0; 1|Automata,Watcher → automata,watcher|/setData/1/champions/19|
|blitzcrank|否|3|850/60/50/50|0.6000000238418579; 20/70; 1|Automata,Dominator → automata|/setData/1/champions/15|
|caitlyn|否|5|900/82/40/40|0.550000011920929; 0/50; 13|Enforcer,Sniper → enforcer,sniper|/setData/1/champions/17|
|camille|是|2|700/50/45/45|0.75; 0/25; 1|Enforcer,Ambusher → enforcer|/setData/1/champions/14|
|corki|否|4|850/65/30/30|0.75; 0/60; 4|Scrap,Artillerist → scrap,artillerist|/setData/1/champions/52|
|darius|否|1|600/55/40/40|0.699999988079071; 30/70; 1|Conqueror,Watcher → conqueror,watcher|/setData/1/champions/58|
|draven|是|1|500/55/15/15|0.699999988079071; 30/60; 4|Conqueror,Pit Fighter → conqueror|/setData/1/champions/27|
|ekko|否|4|1100/50/60/60|0.8500000238418579; 0/60; 1|Firelight,Scrap,Ambusher → firelight,scrap|/setData/1/champions/18|
|ezreal|否|3|700/60/25/25|0.75; 0/60; 4|Academy,Rebel,Artillerist → academy,rebel,artillerist|/setData/1/champions/25|
|garen|否|4|1000/65/60/60|0.6000000238418579; 60/125; 1|Emissary,Watcher → emissary,watcher|/setData/1/champions/55|
|heimerdinger|是|4|800/40/30/30|0.75; 0/40; 4|Academy,Visionary → academy|/setData/1/champions/33|
|illaoi|否|4|1100/70/60/60|0.6499999761581421; 65/125; 1|Rebel,Sentinel → rebel,sentinel|/setData/1/champions/26|
|irelia|否|1|700/45/40/40|0.6000000238418579; 30/70; 1|Rebel,Sentinel → rebel,sentinel|/setData/1/champions/59|
|jinx|是|5|900/60/40/40|0.800000011920929; 0/60; 4|Rebel,Ambusher → rebel|/setData/1/champions/48|
|kogmaw|否|3|650/15/25/25|0.699999988079071; 0/40; 4|Automata,Sniper → automata,sniper|/setData/1/champions/67|
|leblanc|否|5|900/50/40/40|0.800000011920929; 45/90; 4|Black Rose,Sorcerer → sorcerer|/setData/1/champions/32|
|leona|否|2|800/55/50/50|0.6000000238418579; 50/90; 1|Academy,Sentinel → academy,sentinel|/setData/1/champions/66|
|loris|否|3|850/50/50/50|0.6499999761581421; 50/90; 1|Enforcer,Sentinel → enforcer,sentinel|/setData/1/champions/41|
|lux|否|1|500/30/20/20|0.699999988079071; 0/50; 4|Academy,Sorcerer → academy,sorcerer|/setData/1/champions/69|
|maddie|否|1|500/50/15/15|0.699999988079071; 20/120; 6|Enforcer,Sniper → enforcer,sniper|/setData/1/champions/43|
|malzahar|否|5|950/45/40/40|0.800000011920929; 30/95; 4|Automata,Visionary → automata|/setData/1/champions/20|
|mordekaiser|是|5|1200/75/70/70|0.550000011920929; 25/100; 1|Conqueror,Dominator → conqueror|/setData/1/champions/70|
|morgana|是|1|500/30/20/20|0.699999988079071; 0/40; 4|Black Rose,Visionary → |/setData/1/champions/71|
|nami|否|3|700/40/25/25|0.699999988079071; 0/60; 4|Emissary,Sorcerer → emissary,sorcerer|/setData/1/champions/51|
|nocturne|否|2|700/65/45/45|0.800000011920929; 0/40; 1|Automata,Quickstriker → automata|/setData/1/champions/57|
|powder|否|1|500/35/15/15|0.699999988079071; 40/120; 4|Family,Scrap,Ambusher → family,scrap|/setData/1/champions/44|
|rell|否|2|800/60/45/45|0.6000000238418579; 40/90; 1|Conqueror,Sentinel,Visionary → conqueror,sentinel|/setData/1/champions/28|
|rumble|否|5|1200/60/70/70|0.800000011920929; 40/120; 1|Junker King,Scrap,Sentinel → scrap,sentinel|/setData/1/champions/37|
|scar|否|3|800/50/50/50|0.6499999761581421; 80/170; 1|Firelight,Watcher → firelight,watcher|/setData/1/champions/46|
|sett|是|2|850/60/50/50|0.6000000238418579; 50/100; 1|Rebel,Bruiser → rebel|/setData/1/champions/24|
|singed|否|1|650/55/40/40|0.6000000238418579; 0/50; 1|Chem-Baron,Sentinel → sentinel|/setData/1/champions/11|
|steb|是|1|650/55/45/45|0.550000011920929; 30/90; 1|Enforcer,Bruiser → enforcer|/setData/1/champions/42|
|tristana|否|2|550/42/20/20|0.75; 20/60; 4|Emissary,Artillerist → emissary,artillerist|/setData/1/champions/72|
|trundle|是|1|650/50/40/40|0.6499999761581421; 30/90; 1|Scrap,Bruiser → scrap|/setData/1/champions/35|
|twistedfate|是|3|700/35/25/25|0.699999988079071; 25/75; 4|Enforcer,Quickstriker → enforcer|/setData/1/champions/68|
|twitch|否|4|800/70/30/30|0.75; 0/60; 6|Experiment,Sniper → sniper|/setData/1/champions/22|
|urgot|否|2|700/50/45/45|0.699999988079071; 20/70; 2|Experiment,Pit Fighter,Artillerist → artillerist|/setData/1/champions/75|
|vander|否|2|800/50/45/45|0.699999988079071; 0/50; 1|Family,Watcher → family,watcher|/setData/1/champions/45|
|vex|是|1|450/30/15/15|0.699999988079071; 0/60; 4|Rebel,Visionary → rebel|/setData/1/champions/56|
|vi|是|4|1100/75/50/50|0.8500000238418579; 40/100; 1|Enforcer,Pit Fighter → enforcer|/setData/1/champions/16|
|violet|否|1|650/50/40/40|0.800000011920929; 20/65; 1|Family,Pit Fighter → family|/setData/1/champions/50|
|vladimir|否|2|800/45/45/45|0.6499999761581421; 0/65; 1|Black Rose,Watcher,Sorcerer → watcher,sorcerer|/setData/1/champions/30|
|zeri|否|2|600/45/20/20|0.75; 0/3; 6|Firelight,Sniper → firelight,sniper|/setData/1/champions/49|
|ziggs|是|2|600/35/20/20|0.699999988079071; 15/60; 4|Scrap,Dominator → scrap|/setData/1/champions/36|
|zoe|否|4|800/40/30/30|0.75; 20/80; 4|Rebel,Sorcerer → rebel,sorcerer|/setData/1/champions/76|
|zyra|否|1|500/30/20/20|0.699999988079071; 10/60; 4|Experiment,Sorcerer → sorcerer|/setData/1/champions/63|

## 每英雄技能值（源 ability.variables[].value[1..3] → runtime variables）

### akali: Shuriken Flip

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|Damage|[80,120,185]|[80,120,185]|
|SecondaryDamage|[240,360,550]|[240,360,550]|
|TargetDamageAmp|[0.15000000596046448,0.15000000596046448,0.15000000596046448]|[0.15,0.15,0.15]|
|Duration|[4,4,4]|[4,4,4]|
|FlipBackwardsSpeed|[1300,1300,1300]|[1300,1300,1300]|
|SpeedDuringFinalKick|[1700,1700,1700]|[1700,1700,1700]|
### ambessa: Unrelenting Huntress

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|PercentChainAttackAD|[1.5,1.5,3.5]|[1.5,1.5,3.5]|
|PercentStrikeAD|[2.5,2.5,5]|[2.5,2.5,5]|
|PercentOmnivamp|[0.25,0.25,0.44999998807907104]|[0.25,0.25,0.45]|
|AttackSpeed|[1,1,1]|[1,1,1]|
|SlamDamageAD|[5,5,12]|[5,5,12]|
### amumu: Obsolete Technology

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|FlatDamageReduction|[12,15,25]|[12,15,25]|
|Damage|[10,15,25]|[10,15,25]|
|DamageRefreshDuration|[1,1,1]|[1,1,1]|
|FlatDRCooldownPerAttacker|[1,1,1]|[1,1,1]|
### blitzcrank: Static Field

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|Shield|[470,500,550]|[470,500,550]|
|ShieldDuration|[4,4,4]|[4,4,4]|
|BaseDamage|[40,60,100]|[40,60,100]|
|PassiveDamagePercent|[0.029999999329447746,0.029999999329447746,0.029999999329447746]|[0.03,0.03,0.03]|
|PassiveCooldownSeconds|[1,1,1]|[1,1,1]|
|DamageReduction|[0.10000000149011612,0.10000000149011612,0.10000000149011612]|[0.1,0.1,0.1]|
|NumEnemies|[3,3,3]|[3,3,3]|
### caitlyn: Air Raid

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|RaidDuration|[5,5,5]|[5,5,5]|
|TotalShots|[4,4,20]|[4,4,20]|
|PercentAttackDamage|[1.7999999523162842,1.7999999523162842,7.5]|[1.8,1.8,7.5]|
|APDamage|[20,30,100]|[20,30,100]|
|HeadshotPercentAD|[2.799999952316284,2.799999952316284,13.5]|[2.8,2.8,13.5]|
|BonusSearchRange|[630,630,630]|[630,630,630]|
|PercentShotsFocusedOnFrontline|[0.5,0.5,0.5]|[0.5,0.5,0.5]|
|ResistReduction|[20,20,20]|[20,20,20]|
### camille: Adaptive Strike

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|PercentAttackDamage|[2.299999952316284,2.299999952316284,2.5999999046325684]|[2.3,2.3,2.6]|
|APDamage|[30,45,70]|[30,45,70]|
|HealPercent|[0.33000001311302185,0.33000001311302185,0.33000001311302185]|[0.33,0.33,0.33]|
### corki: Broadside Barrage

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|BaseMissiles|[21,21,35]|[21,21,35]|
|PercentAD|[0.3499999940395355,0.3499999940395355,0.6000000238418579]|[0.35,0.35,0.6]|
|FlatArmorShred|[1,1,1]|[1,1,1]|
|SpecialMissileNum|[7,7,7]|[7,7,7]|
|SpecialMissileMult|[7,7,7]|[7,7,7]|
|MissilesPerLaunchAttack|[5,5,5]|[5,5,5]|
|FlatDamagePerMissile|[6,9,36]|[6,9,36]|
### darius: Decimate

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|BleedDuration|[4,4,4]|[4,4,4]|
|PercentAttackDamage|[2.4000000953674316,2.4000000953674316,2.4000000953674316]|[2.4,2.4,2.4]|
|Heal|[150,175,200]|[150,175,200]|
|BleedPercentAttackDamage|[2,2,2]|[2,2,2]|
### draven: Spinning Axes

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|PercentAD|[1.399999976158142,1.399999976158142,1.399999976158142]|[1.4,1.4,1.4]|
|BaseDamage|[10,15,25]|[10,15,25]|
### ekko: Splitting Seconds

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|NumAfterimages|[12,12,25]|[12,12,25]|
|NumBonusEnemies|[2,2,4]|[2,2,4]|
|TargetDamage|[290,435,1200]|[290,435,1200]|
|SecondaryDamage|[145,215,450]|[145,215,450]|
|SpellTime|[1.5,1.5,1.5]|[1.5,1.5,1.5]|
|ShredAmount|[5,5,5]|[5,5,5]|
### ezreal: Essence Flux

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|PercentAttackDamage|[1.350000023841858,1.350000023841858,1.350000023841858]|[1.35,1.35,1.35]|
|APDamage|[20,30,50]|[20,30,50]|
|PercentCenterDamage|[2.700000047683716,2.700000047683716,2.700000047683716]|[2.7,2.7,2.7]|
### garen: Demacian Justice

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|APShield|[200,220,1500]|[200,220,1500]|
|PercentHealthShield|[0.15000000596046448,0.15000000596046448,0.15000000596046448]|[0.15,0.15,0.15]|
|ShieldDuration|[4,4,4]|[4,4,4]|
|ADRatio|[2.5,2.5,15]|[2.5,2.5,15]|
|SecondaryADRatio|[1.25,1.25,7.5]|[1.25,1.25,7.5]|
|HealPercentHealth|[0.014999999664723873,0.014999999664723873,0.05000000074505806]|[0.015,0.015,0.05]|
|PassiveDamagePercent|缺|未启用/缺|
### heimerdinger: PROGRESSSSS!

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|Damage|[50,75,225]|[50,75,225]|
|StartingRockets|[5,5,7]|[5,5,7]|
|NumOfCastsToIncreaseMissiles|[1,1,1]|[1,1,1]|
|MissileIncreasePerCast|[1,1,1]|[1,1,1]|
|PercentOfMissileToFocusOnTarget|[0.5,0.5,0.5]|[0.5,0.5,0.5]|
|AdditionalTargetRowDifferential|[2,2,2]|[2,2,2]|
### illaoi: Test of Spirit

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|SpellDuration|[3,3,3]|[3,3,3]|
|HealthSteal|[50,75,225]|[50,75,225]|
|NumEnemies|[4,4,10]|[4,4,10]|
|PercentBonusHealthSteal|[0.5,0.5,0.5]|[0.5,0.5,0.5]|
|DR|[0.5,0.5,0.8999999761581421]|[0.5,0.5,0.9]|
|DamageResistRatio|[0.6000000238418579,0.8999999761581421,7]|[0.6,0.9,7]|
### irelia: Defiant Dance

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|ShieldDuration|[3,3,3]|[3,3,3]|
|ShieldHealth|[400,475,575]|[400,475,575]|
|StrikeBaseDamage|[70,100,150]|[70,100,150]|
|PercentShieldDamage|[0.30000001192092896,0.30000001192092896,0.30000001192092896]|[0.3,0.3,0.3]|
|HERODashNum|[2,2,2]|未启用/缺|
|HEROBaseDashDamage|[3.3499999046325684,3.3499999046325684,3.450000047683716]|未启用/缺|
|HEROAttackSpeed|[0.4000000059604645,0.4000000059604645,0.4000000059604645]|未启用/缺|
|HEROSpellAPBase|[40,60,90]|未启用/缺|
### jinx: Ruin Everything

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|NumOfFlameChompers|[3,3,3]|[3,3,3]|
|FlameChompersPercentAD|[2.6500000953674316,2.6500000953674316,20]|[2.65,2.65,20]|
|ZapPercentAD|[2.6500000953674316,2.6500000953674316,20]|[2.65,2.65,20]|
|ZapStunDuration|[1.25,1.5,10]|[1.25,1.5,10]|
|ZapLength|[2500,2500,2500]|[2500,2500,2500]|
|ZapWidth|[180,180,180]|[180,180,180]|
|DeathRocketPercentAD|[7,7,90.01000213623047]|[7,7,90.01]|
|DeathRocketAP|[60,90,300]|[60,90,300]|
|DeathRocketHexes|[6,6,6]|[6,6,6]|
|FalloffPercent|[0.10000000149011612,0.10000000149011612,0.10000000149011612]|[0.1,0.1,0.1]|
### kogmaw: Upgrading Barrage Module

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|MaxAS|[20,20,20]|[20,20,20]|
|AttackSpeed|[0.25,0.25,0.25]|[0.25,0.25,0.25]|
|Duration|[60,60,60]|[60,60,60]|
|DamageOnAttack|[48,72,120]|[48,72,120]|
|RangeIncreaseNumAttacks|[3,3,3]|[3,3,3]|
### leblanc: The Chains of Fate

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|ChainTargets|[4,4,20]|[4,4,20]|
|ChainDuration|[5,5,5]|[5,5,5]|
|Damage|[650,975,5000]|[650,975,5000]|
|AutoDamage|[160,240,900]|[160,240,900]|
|DamageShare|[0.18000000715255737,0.25,1]|[0.18,0.25,1]|
|NumAttacks|[3,3,3]|[3,3,3]|
|AutoKillBonus|[0.5,0.5,0.5]|[0.5,0.5,0.5]|
### leona: Eclipse

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|Duration|[3,3,3]|[3,3,3]|
|Damage|[115,175,270]|[115,175,270]|
|DR|[0.5,0.5,0.5]|[0.5,0.5,0.5]|
### loris: Piltover Bulwark

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|Shield|[525,600,700]|[525,600,700]|
|Damage|[150,225,360]|[150,225,360]|
|PercentDamageRedirect|[0.5,0.5,0.5]|[0.5,0.5,0.5]|
|Duration|[4,4,4]|[4,4,4]|
### lux: Prismatic Barrier

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|Damage|[360,540,900]|[360,540,900]|
|Shield|[160,180,240]|[160,180,240]|
|ShieldDuration|[4,4,4]|[4,4,4]|
|DamageReduction|[0.3499999940395355,0.3499999940395355,0.3499999940395355]|[0.35,0.35,0.35]|
### maddie: Fan the Hammer

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|PercentAttackDamage|[1.25,1.25,1.399999976158142]|[1.25,1.25,1.4]|
|APDamage|[10,15,25]|[10,15,25]|
|NumOfShots|[6,6,6]|[6,6,6]|
|TotalSpellTime|[1.149999976158142,1.149999976158142,1.149999976158142]|[1.15,1.15,1.15]|
|ShotsPerSimulatedLaunchAttack|[3,3,3]|[3,3,3]|
### malzahar: Call of the Machine

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|Damage|[80,120,1000]|[80,120,1000]|
|InfectionDamage|[14,21,400]|[14,21,400]|
|DamageTicksPerSecond|[0.75,0.75,0.75]|[0.75,0.75,0.75]|
|ShredDuration|[4,4,4]|[4,4,4]|
### mordekaiser: Grasp of the Iron Revenant

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|DR|[0.4000000059604645,0.4000000059604645,0.4000000059604645]|[0.4,0.4,0.4]|
|Damage|[160,240,800]|[160,240,800]|
|DamageBonus|[0.25,0.25,0.25]|[0.25,0.25,0.25]|
|NearestEnemies|[4,4,4]|[4,4,4]|
|Displacement|[240,240,240]|[240,240,240]|
|OmnivampPercent|[0.30000001192092896,0.30000001192092896,0.30000001192092896]|[0.3,0.3,0.3]|
|TargetDamage|[330,500,3000]|[330,500,3000]|
|SlamDamage|[85,125,1500]|[85,125,1500]|
|AttackHexRadius|[2,2,2]|[2,2,2]|
|LineRange|[1470,1470,1470]|[1470,1470,1470]|
|LineWidth|[615,615,615]|[615,615,615]|
|NumAttacks|[1,1,1]|[1,1,1]|
|EmpowerDuration|[10,10,10]|[10,10,10]|
### morgana: Tormented Soul

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|Damage|[525,780,1300]|[525,780,1300]|
|ShieldReavePercent|[0.5,0.5,0.5]|[0.5,0.5,0.5]|
|Duration|[10,10,10]|[10,10,10]|
### nami: Ocean's Ebb

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|NumBounces|[3,3,3]|[3,3,3]|
|Damage|[120,180,290]|[120,180,290]|
|SearchRange|[3,3,3]|[3,3,3]|
|TimesHitTarget|[1,1,1]|[1,1,1]|
### nocturne: Overdrive Blades

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|ADPercent|[1.2000000476837158,1.2000000476837158,1.399999976158142]|[1.2,1.2,1.4]|
|Duration|[6,6,6]|[6,6,6]|
|BaseDamage|[15,25,40]|[15,25,40]|
|BleedDuration|[1,1,1]|[1,1,1]|
|BleedTicksRate|[0.25,0.25,0.25]|[0.25,0.25,0.25]|
### powder: Misfit Toy

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|Damage|[350,500,700]|[350,500,700]|
|IgniteDuration|[5,5,5]|[5,5,5]|
|FalloffPercent|[0.30000001192092896,0.30000001192092896,0.25]|[0.3,0.3,0.25]|
|HERODamage|[350,500,700]|[350,500,700]|
|HEROFalloffPercent|[0.20000000298023224,0.20000000298023224,0.20000000298023224]|[0.2,0.2,0.2]|
|HEROFriendlyFire|[0.6000000238418579,0.6000000238418579,0.6000000238418579]|[0.6,0.6,0.6]|
|HeroBigFalloffPerc|[0.5,0.5,0.5]|[0.5,0.5,0.5]|
### rell: Shattering Strike

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|StabDamage|[120,180,270]|[120,180,270]|
|DefenseStealDuration|[60,60,60]|[60,60,60]|
|DefensesSteal|[10,12,15]|[10,12,15]|
|ShieldDuration|[4,4,4]|[4,4,4]|
|Shield|[300,350,400]|[300,350,400]|
### rumble: The Equalizer

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|Damage|[500,750,4000]|[500,750,4000]|
|NumMissile|[5,5,5]|[5,5,5]|
|WoundDuration|[5,5,5]|[5,5,5]|
|ManaPerMissile|[20,20,20]|[20,20,20]|
|Tankbuster_RefreshDuration|[3,3,3]|[3,3,3]|
|Tankbuster_APDamage_Level1|[100,100,100]|[100,100,100]|
|Tankbuster_APDamage_Level2|[150,150,150]|[150,150,150]|
|Tankbuster_APDamage_Level3|[1600,1600,1600]|[1600,1600,1600]|
|SelfDestruct_ResistGainIncrease|[0.25,0.25,0.25]|[0.25,0.25,0.25]|
|SelfDestruct_ResistDamage_Level1|[1.600000023841858,1.600000023841858,1.600000023841858]|[1.6,1.6,1.6]|
|SelfDestruct_ResistDamage_Level2|[2.4000000953674316,2.4000000953674316,2.4000000953674316]|[2.4,2.4,2.4]|
|SelfDestruct_ResistDamage_Level3|[20,20,20]|[20,20,20]|
|SelfDestruct_HexRadius|[2,2,2]|[2,2,2]|
|Flamethrower_Damage_Level1|[30,30,30]|[30,30,30]|
|Flamethrower_Damage_Level2|[45,45,45]|[45,45,45]|
|Flamethrower_Damage_Level3|[600,600,600]|[600,600,600]|
|Flamethrower_TicksPerSecond|[2,2,2]|[2,2,2]|
|RepairingMicrobots_RefreshDuration|[3,3,3]|[3,3,3]|
|ReparingMicrobots_MaxHealthHeal_Level1|[0.05999999865889549,0.05999999865889549,0.05999999865889549]|[0.06,0.06,0.06]|
|ReparingMicrobots_MaxHealthHeal_Level2|[0.05999999865889549,0.05999999865889549,0.05999999865889549]|[0.06,0.06,0.06]|
|ReparingMicrobots_MaxHealthHeal_Level3|[0.4000000059604645,0.4000000059604645,0.4000000059604645]|[0.4,0.4,0.4]|
|PetriciteRod_RefreshDuration|[5,5,5]|[5,5,5]|
|PetriciteRod_APDamage_Level1|[350,350,350]|[350,350,350]|
|PetriciteRod_APDamage_Level2|[525,525,525]|[525,525,525]|
|PetriciteRod_APDamage_Level3|[6000,6000,6000]|[6000,6000,6000]|
|PetriciteRod_DOTDuration|[15,15,15]|[15,15,15]|
### scar: Sumpsnipe Surprise

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|Heal|[220,240,270]|[220,240,270]|
|NumEnemies|[3,3,3]|[3,3,3]|
|StunDuration|[1.5,1.5,1.75]|[1.5,1.5,1.75]|
|Damage|[80,120,180]|[80,120,180]|
### sett: Facebreaker

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|Damage|[180,270,420]|[180,270,420]|
|StunDuration|[1.5,1.5,2]|[1.5,1.5,2]|
|SoloBonus|[0.5,0.5,0.5]|[0.5,0.5,0.5]|
### singed: Dangerous Mutations

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|AttackSpeed|[100,120,160]|[100,120,160]|
|Duration|[4,4,4]|[4,4,4]|
|DR|[0.5,0.5,0.6000000238418579]|[0.5,0.5,0.6]|
|HEROSpellBaseDamage|[140,210,315]|[140,210,315]|
|HEROOmnivamp|[0.20000000298023224,0.20000000298023224,0.20000000298023224]|[0.2,0.2,0.2]|
|HERODuration|[5,5,5]|[5,5,5]|
|HEROCloudDuration|[3,3,3]|[3,3,3]|
|HEROMoveSpeed|[250,250,250]|[250,250,250]|
### steb: Field Medicine

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|PercentAlliedHealShare|[0.25,0.25,0.25]|[0.25,0.25,0.25]|
|NumAlliesToShare|[2,2,2]|[2,2,2]|
|Damage|[260,390,585]|[260,390,585]|
|Heal|[270,310,360]|[270,310,360]|
|HEROOmnivamp|[0.30000001192092896,0.30000001192092896,0.30000001192092896]|[0.3,0.3,0.3]|
|HEROSpellDamageMod|[0.6499999761581421,0.6499999761581421,0.6499999761581421]|[0.65,0.65,0.65]|
|HEROMaxHits|[3,3,3]|[3,3,3]|
### tristana: Draw a Bead

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|PercentAttackDamage|[5.25,5.25,5.25]|[5.25,5.25,5.25]|
|APDamage|[50,75,115]|[50,75,115]|
|ASKillGain|[1.25,1.25,1.25]|[1.25,1.25,1.25]|
|ASKillGainHyperroll|[2.5,2.5,2.5]|未启用/缺|
### trundle: Desperate Chomp

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|PercentAttackDamage|[2.799999952316284,2.799999952316284,2.799999952316284]|[2.8,2.8,2.8]|
|GainHealth|[200,220,250]|[200,220,250]|
|AmountIncreaseMax|[0.75,0.75,0.75]|[0.75,0.75,0.75]|
### twistedfate: Wild Cards

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|BlueHeal|[90,110,140]|[90,110,140]|
|RedDamage|[110,165,255]|[110,165,255]|
|YellowDamage|[230,345,535]|[230,345,535]|
|StunDuration|[1,1,1]|[1,1,1]|
### twitch: Spray and Pray

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|TotalAttacks|[8,8,8]|[8,8,8]|
|AttackSpeed|[0.8500000238418579,0.8500000238418579,0.8500000238418579]|[0.85,0.85,0.85]|
|APDamage|[18,25,120]|[18,25,120]|
|PercentAttackDamage|[1.399999976158142,1.399999976158142,3]|[1.4,1.4,3]|
|DamageReduction|[0.4000000059604645,0.4000000059604645,0.20000000298023224]|[0.4,0.4,0.2]|
|ExperimentDamageTicks|[5,5,5]|[5,5,5]|
|ExperimentMaxHealthDamage|[0.15000000596046448,0.15000000596046448,0.15000000596046448]|[0.15,0.15,0.15]|
### urgot: Corrosive Charge

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|PrimaryDamage|[3,3,3.299999952316284]|[3,3,3.3]|
|SecondaryDamage|[1.5,1.5,1.649999976158142]|[1.5,1.5,1.65]|
|Duration|[6,6,6]|[6,6,6]|
|APDamage|[35,50,75]|[35,50,75]|
|ExperimentPercentHealthShield|[0.07999999821186066,0.07999999821186066,0.07999999821186066]|未启用/缺|
|ExperimentAttackSpeed|[0.20000000298023224,0.20000000298023224,0.20000000298023224]|未启用/缺|
|ExperimentDuration|[5,5,5]|未启用/缺|
### vander: Hound of the Underground

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|TauntDuration|[2.5,2.5,2.5]|[2.5,2.5,2.5]|
|Resists|[100,125,150]|[100,125,150]|
|PercentAttackDamage|[4,4,4]|[4,4,4]|
|BonusDamageADRatio|[1,1,1]|[1,1,1]|
|HEROSpellDuration|[0.5,0.5,0.5]|未启用/缺|
|HEROBonusDamage|[1.850000023841858,1.850000023841858,1.850000023841858]|未启用/缺|
|HEROSplashPerc|[0.25,0.25,0.25]|未启用/缺|
|HEROStunDuration|[0.75,0.75,0.75]|未启用/缺|
|HEROManaIncrease|[60,60,60]|未启用/缺|
### vex: Looming Darkness

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|Damage|[220,330,550]|[220,330,550]|
|SecondaryDamage|[110,165,275]|[110,165,275]|
|DOTDuration|[0.800000011920929,0.800000011920929,0.800000011920929]|[0.8,0.8,0.8]|
### vi: Wrecking Crew

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|Shield|[280,325,1200]|[280,325,1200]|
|PercentAttackDamage|[6,6,12]|[6,6,12]|
|PercentAttackDamage_SecondaryDamage|[1.7999999523162842,1.7999999523162842,5]|[1.8,1.8,5]|
|ShieldDuration|[3,3,3]|[3,3,3]|
|StunDuration|[1.5,1.5,1.5]|[1.5,1.5,1.5]|
### violet: 1-2-3 Combo

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|PercentAttackDamage|[1.350000023841858,1.350000023841858,1.350000023841858]|[1.35,1.35,1.35]|
|StunDuration|[0.25,0.25,0.25]|[0.25,0.25,0.25]|
|APDamage|[20,30,45]|[20,30,45]|
|PercentIncreasedAttackDamage|[3.299999952316284,3.299999952316284,3.299999952316284]|[3.3,3.3,3.3]|
|NumStrikes|[2,2,2]|[2,2,2]|
### vladimir: Transfusion

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|Damage|[140,210,325]|[140,210,325]|
|Heal|[200,240,300]|[200,240,300]|
|HEROBonusDamage|[1.7999999523162842,1.7999999523162842,1.7999999523162842]|[1.8,1.8,1.8]|
|HEROOverkillPerc|[0.5,0.5,0.5]|[0.5,0.5,0.5]|
|HEROOverkillNum|[1,1,1]|[1,1,1]|
|HEROOverkillBaseDamage|[90,135,205]|[90,135,205]|
|TOOLTIPONLYMana|[3,3,3]|[3,3,3]|
|HEROAmpPerCast|[0.10000000149011612,0.10000000149011612,0.10000000149011612]|[0.1,0.1,0.1]|
### zeri: Living Battery

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|NumOfAttacks|[3,3,3]|[3,3,3]|
|NumOfBounces|[2,2,2]|[2,2,2]|
|PercentAttackDamage|[2,2,2]|[2,2,2]|
|APDamage|[10,15,20]|[10,15,20]|
|PercentDealtToBouncedEnemies|[0.5,0.5,0.5]|[0.5,0.5,0.5]|
### ziggs: Bomb Full of Bombs

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|Damage|[180,270,450]|[180,270,450]|
|MinibombDamage|[90,135,200]|[90,135,200]|
|NumBombs|[3,3,3]|[3,3,3]|
### zoe: Paddle Star!

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|Damage|[140,210,450]|[140,210,450]|
|NumRepeats|[2,2,4]|[2,2,4]|
|HexLimiter|[4,4,4]|[4,4,4]|
### zyra: Grasping Roots

|CDragon 字段|源 1/2/3 星|运行时 1/2/3 星|
|---|---|---|
|TargetDamage|[260,390,585]|[260,390,585]|
|StunDuration|[1,1,1]|[1,1,1]|
|AOEDamage|[95,140,215]|[95,140,215]|
|ExperimentTrueDamage|[0.5,0.5,0.5]|未启用/缺|
|ExperimentDuration|[2,2,2]|未启用/缺|
|NumSmallerVines|[2,2,2]|[2,2,2]|

## 羁绊字段

|羁绊|pointer|源 effects|有限实现|
|---|---|---|---|
|automata|/setData/1/traits/0|[{"maxUnits":3,"minUnits":2,"style":1,"variables":{"ConversionDamagePct":0.25,"MagicDamage":150,"Resists":25,"TriggerNumCrystals":20,"{a142f31c}":1}},{"maxUnits":5,"minUnits":4,"style":3,"variables":{"ConversionDamagePct":0.25,"MagicDamage":400,"Resists":60,"TriggerNumCrystals":20,"{a142f31c}":1}},{"maxUnits":25000,"minUnits":6,"style":5,"variables":{"ConversionDamagePct":0.25,"MagicDamage":1100,"Resists":140,"TriggerNumCrystals":20,"{a142f31c}":1}}]|[{"threshold":2,"effects":[{"kind":"statFlat","stat":"armor","amount":25},{"kind":"statFlat","stat":"magicResist","amount":25},{"kind":"mechanic","mechanic":"automata","values":{"crystals":20,"damage":150,"conversionBps":2500}}]},{"threshold":4,"effects":[{"kind":"statFlat","stat":"armor","amount":60},{"kind":"statFlat","stat":"magicResist","amount":60},{"kind":"mechanic","mechanic":"automata","values":{"crystals":20,"damage":400,"conversionBps":2500}}]}]|
|firelight|/setData/1/traits/24|[{"maxUnits":2,"minUnits":2,"style":1,"variables":{"Duration":6,"PercentDamageTakenHeal":0.20000000298023224,"{0a9a9714}":null,"{3c0d594a}":1}},{"maxUnits":3,"minUnits":3,"style":5,"variables":{"Duration":6,"PercentDamageTakenHeal":0.33000001311302185,"{0a9a9714}":null,"{3c0d594a}":1}},{"maxUnits":25000,"minUnits":4,"style":5,"variables":{"Duration":6,"PercentDamageTakenHeal":0.4000000059604645,"{0a9a9714}":3.5,"{3c0d594a}":1}}]|[{"threshold":2,"effects":[{"kind":"mechanic","mechanic":"firelight","values":{"periodTicks":120,"healBps":2000,"attackSpeedBps":0,"dashTicks":20}}]},{"threshold":3,"effects":[{"kind":"mechanic","mechanic":"firelight","values":{"periodTicks":120,"healBps":3300,"attackSpeedBps":0,"dashTicks":20}}]}]|
|family|/setData/1/traits/10|[{"maxUnits":3,"minUnits":3,"style":5,"variables":{"AttackSpeed":0.20000000298023224,"DamageReduction":0.20000000298023224,"ManaReduction":0.25}},{"maxUnits":4,"minUnits":4,"style":5,"variables":{"AttackSpeed":0.20000000298023224,"DamageReduction":0.20000000298023224,"ManaReduction":0.30000001192092896}},{"maxUnits":25000,"minUnits":5,"style":5,"variables":{"AttackSpeed":0.20000000298023224,"DamageReduction":0.20000000298023224,"ManaReduction":0.4000000059604645,"{01fcc30b}":0.75,"{217874f1}":2.5,"{43cb93dd}":1.25,"{46c3fc24}":1.5,"{6fc9f267}":17,"{8173be81}":2,"{9000fe5b}":2,"{92029cea}":0.5}}]|[{"threshold":3,"effects":[{"kind":"mechanic","mechanic":"family","values":{"manaReductionBps":2500,"damageReductionBps":2000,"heist":0}}]}]|
|rebel|/setData/1/traits/19|[{"maxUnits":4,"minUnits":3,"style":1,"variables":{"ADAP":0.20000000298023224,"BurstAS":0.6000000238418579,"BurstDuration":5,"ForceDuration":null,"MaxHealthIncrease":0.11999999731779099,"PercentHealthTrigger":0.25,"PercentMaxHealthBonus":null,"StunDuration":null,"{1ec59053}":null}},{"maxUnits":6,"minUnits":5,"style":3,"variables":{"ADAP":0.4000000059604645,"BurstAS":0.6000000238418579,"BurstDuration":5,"ForceDuration":null,"MaxHealthIncrease":0.11999999731779099,"PercentHealthTrigger":0.25,"PercentMaxHealthBonus":0.11999999731779099,"StunDuration":null,"{1ec59053}":null}},{"maxUnits":9,"minUnits":7,"style":5,"variables":{"ADAP":0.44999998807907104,"BurstAS":0.6000000238418579,"BurstDuration":5,"ForceDuration":null,"MaxHealthIncrease":0.11999999731779099,"PercentHealthTrigger":0.25,"PercentMaxHealthBonus":0.15000000596046448,"StunDuration":2,"{1ec59053}":null}},{"maxUnits":25000,"minUnits":10,"style":6,"variables":{"ADAP":0.5,"BurstAS":0.6000000238418579,"BurstDuration":5,"ForceDuration":12,"MaxHealthIncrease":0.11999999731779099,"PercentHealthTrigger":0.25,"PercentMaxHealthBonus":0.30000001192092896,"StunDuration":2,"{1ec59053}":1}}]|[{"threshold":3,"effects":[{"kind":"statPercentBps","stat":"maxHp","bps":1200},{"kind":"mechanic","mechanic":"rebel","values":{"thresholdBps":2500,"adApBps":2000,"bonusHpBps":0,"stunTicks":0,"attackSpeedBps":6000,"durationTicks":100}}]},{"threshold":5,"effects":[{"kind":"statPercentBps","stat":"maxHp","bps":1200},{"kind":"mechanic","mechanic":"rebel","values":{"thresholdBps":2500,"adApBps":4000,"bonusHpBps":1200,"stunTicks":0,"attackSpeedBps":6000,"durationTicks":100}}]},{"threshold":7,"effects":[{"kind":"statPercentBps","stat":"maxHp","bps":1200},{"kind":"mechanic","mechanic":"rebel","values":{"thresholdBps":2500,"adApBps":4500,"bonusHpBps":1500,"stunTicks":40,"attackSpeedBps":6000,"durationTicks":100}}]}]|
|enforcer|/setData/1/traits/23|[{"maxUnits":3,"minUnits":2,"style":1,"variables":{"AttackSpeedPerWantedKill":0.30000001192092896,"BaseDA":0.11999999731779099,"NumOfWantedEnemies":1,"PercentMaxHealthShield":0.11999999731779099,"{36b1550f}":null,"{9edd4912}":null}},{"maxUnits":5,"minUnits":4,"style":3,"variables":{"AttackSpeedPerWantedKill":0.30000001192092896,"BaseDA":0.20000000298023224,"NumOfWantedEnemies":2,"PercentMaxHealthShield":0.20000000298023224,"{36b1550f}":null,"{9edd4912}":null}},{"maxUnits":7,"minUnits":6,"style":5,"variables":{"AttackSpeedPerWantedKill":0.30000001192092896,"BaseDA":0.33000001311302185,"NumOfWantedEnemies":4,"PercentMaxHealthShield":0.30000001192092896,"{36b1550f}":null,"{9edd4912}":null}},{"maxUnits":9,"minUnits":8,"style":5,"variables":{"AttackSpeedPerWantedKill":0.30000001192092896,"BaseDA":0.5,"NumOfWantedEnemies":5,"PercentMaxHealthShield":0.4000000059604645,"{36b1550f}":null,"{9edd4912}":null}},{"maxUnits":25000,"minUnits":10,"style":6,"variables":{"AttackSpeedPerWantedKill":0.30000001192092896,"BaseDA":1.5,"NumOfWantedEnemies":99,"PercentMaxHealthShield":1,"{36b1550f}":null,"{9edd4912}":1}}]|[{"threshold":2,"effects":[{"kind":"mechanic","mechanic":"damageAmp","values":{"bps":1200}},{"kind":"mechanic","mechanic":"enforcer","values":{"shieldBps":1200,"wanted":1,"attackSpeedBps":3000}}]},{"threshold":4,"effects":[{"kind":"mechanic","mechanic":"damageAmp","values":{"bps":2000}},{"kind":"mechanic","mechanic":"enforcer","values":{"shieldBps":2000,"wanted":2,"attackSpeedBps":3000}}]},{"threshold":6,"effects":[{"kind":"mechanic","mechanic":"damageAmp","values":{"bps":3300}},{"kind":"mechanic","mechanic":"enforcer","values":{"shieldBps":3000,"wanted":4,"attackSpeedBps":3000}}]}]|
|conqueror|/setData/1/traits/15|[{"maxUnits":3,"minUnits":2,"style":1,"variables":{"ADAPBase":0.18000000715255737,"PercentIncreasePerChest":0.029999999329447746,"StacksPerKill":1}},{"maxUnits":5,"minUnits":4,"style":3,"variables":{"ADAPBase":0.25,"PercentIncreasePerChest":0.029999999329447746,"StacksPerKill":3}},{"maxUnits":8,"minUnits":6,"style":5,"variables":{"ADAPBase":0.4000000059604645,"PercentIncreasePerChest":0.029999999329447746,"StacksPerKill":6}},{"maxUnits":25000,"minUnits":9,"style":6,"variables":{"ADAPBase":1,"PercentIncreasePerChest":0.029999999329447746,"StacksPerKill":20}}]|[{"threshold":2,"effects":[{"kind":"statPercentBps","stat":"attackDamage","bps":1800},{"kind":"statFlat","stat":"abilityPower","amount":18}]},{"threshold":4,"effects":[{"kind":"statPercentBps","stat":"attackDamage","bps":2500},{"kind":"statFlat","stat":"abilityPower","amount":25}]}]|
|academy|/setData/1/traits/17|[{"maxUnits":3,"minUnits":3,"style":1,"variables":{"BaseValues":0.05000000074505806,"NumOfItems":1,"PercentIncreaseSponsored":0.019999999552965164}},{"maxUnits":4,"minUnits":4,"style":3,"variables":{"BaseValues":0.05000000074505806,"NumOfItems":2,"PercentIncreaseSponsored":0.029999999329447746}},{"maxUnits":5,"minUnits":5,"style":5,"variables":{"BaseValues":0.05000000074505806,"NumOfItems":3,"PercentIncreaseSponsored":0.05000000074505806}},{"maxUnits":25000,"minUnits":6,"style":5,"variables":{"BaseValues":0.05000000074505806,"NumOfItems":3,"PercentIncreaseSponsored":0.09000000357627869}}]|[{"threshold":3,"effects":[{"kind":"mechanic","mechanic":"academy","values":{"sponsoredBps":200,"memberBaseBps":500}}]},{"threshold":4,"effects":[{"kind":"mechanic","mechanic":"academy","values":{"sponsoredBps":300,"memberBaseBps":500}}]}]|
|scrap|/setData/1/traits/3|[{"maxUnits":3,"minUnits":2,"style":1,"variables":{"HPShieldAmount":25,"NumComponents":1,"ShieldDuration":20,"{659aef8d}":null,"{7e2474c8}":null}},{"maxUnits":5,"minUnits":4,"style":3,"variables":{"HPShieldAmount":35,"NumComponents":3,"ShieldDuration":20,"{659aef8d}":null,"{7e2474c8}":null}},{"maxUnits":8,"minUnits":6,"style":5,"variables":{"HPShieldAmount":50,"NumComponents":20,"ShieldDuration":20,"{659aef8d}":1,"{7e2474c8}":null}},{"maxUnits":25000,"minUnits":9,"style":5,"variables":{"HPShieldAmount":60,"NumComponents":20,"ShieldDuration":20,"{659aef8d}":1,"{7e2474c8}":1}}]|[{"threshold":2,"effects":[{"kind":"mechanic","mechanic":"scrap","values":{"shieldPerComponent":25,"conversions":1,"durationTicks":400,"componentCount":0}}]},{"threshold":4,"effects":[{"kind":"mechanic","mechanic":"scrap","values":{"shieldPerComponent":35,"conversions":3,"durationTicks":400,"componentCount":0}}]},{"threshold":6,"effects":[{"kind":"mechanic","mechanic":"scrap","values":{"shieldPerComponent":50,"conversions":20,"durationTicks":400,"componentCount":0}}]}]|
|emissary|/setData/1/traits/6|[{"maxUnits":1,"minUnits":1,"style":1,"variables":{"AmbessaArmor":2,"AmbessaArmor_PVE":4,"BonusAS":null,"BonusHealth":200,"CCImmuneDuration":8,"GarenHealthPercent":0.11999999731779099,"NamiMana":2,"SelfishDamageAmp":0.20000000298023224,"StarAS":0.05999999865889549,"{3854f478}":2,"{4b20f990}":null,"{845be53a}":4}},{"maxUnits":4,"minUnits":4,"style":5,"variables":{"AmbessaArmor":2,"AmbessaArmor_PVE":4,"BonusAS":null,"BonusHealth":200,"CCImmuneDuration":8,"GarenHealthPercent":0.11999999731779099,"NamiMana":2,"SelfishDamageAmp":0.20000000298023224,"StarAS":0.05999999865889549,"{3854f478}":2,"{4b20f990}":null,"{845be53a}":4}}]|[{"threshold":1,"effects":[{"kind":"mechanic","mechanic":"emissary","values":{"armorPerWin":2,"healthBps":1200,"mana":2,"starSpeedBps":600}}]},{"threshold":4,"effects":[{"kind":"mechanic","mechanic":"emissary","values":{"armorPerWin":2,"healthBps":1200,"mana":2,"starSpeedBps":600}}],"memberEffects":[{"kind":"statFlat","stat":"maxHp","amount":200},{"kind":"mechanic","mechanic":"damageAmp","values":{"bps":2000}}]}]|
|sentinel|/setData/1/traits/8|[{"maxUnits":3,"minUnits":2,"style":1,"variables":{"BonusArmor":12,"{5921fc26}":2}},{"maxUnits":5,"minUnits":4,"style":3,"variables":{"BonusArmor":25,"{5921fc26}":2}},{"maxUnits":25000,"minUnits":6,"style":5,"variables":{"BonusArmor":42,"{5921fc26}":2}}]|[{"threshold":2,"effects":[{"kind":"statFlat","stat":"armor","amount":12},{"kind":"statFlat","stat":"magicResist","amount":12}],"memberEffects":[{"kind":"statFlat","stat":"armor","amount":24},{"kind":"statFlat","stat":"magicResist","amount":24}]},{"threshold":4,"effects":[{"kind":"statFlat","stat":"armor","amount":25},{"kind":"statFlat","stat":"magicResist","amount":25}],"memberEffects":[{"kind":"statFlat","stat":"armor","amount":50},{"kind":"statFlat","stat":"magicResist","amount":50}]}]|
|artillerist|/setData/1/traits/4|[{"maxUnits":3,"minUnits":2,"style":1,"variables":{"AD":0.10000000149011612,"NumOfAttacks":5,"PercentDamage":1.25}},{"maxUnits":5,"minUnits":4,"style":5,"variables":{"AD":0.44999998807907104,"NumOfAttacks":5,"PercentDamage":1.25}},{"maxUnits":25000,"minUnits":6,"style":5,"variables":{"AD":0.6000000238418579,"NumOfAttacks":4,"PercentDamage":2.5}}]|[{"threshold":2,"effects":[{"kind":"statPercentBps","stat":"attackDamage","bps":1000},{"kind":"mechanic","mechanic":"artillery","values":{"everyN":5,"adBps":12500,"radius":1}}]},{"threshold":4,"effects":[{"kind":"statPercentBps","stat":"attackDamage","bps":4500},{"kind":"mechanic","mechanic":"artillery","values":{"everyN":5,"adBps":12500,"radius":1}}]}]|
|sniper|/setData/1/traits/14|[{"maxUnits":3,"minUnits":2,"style":1,"variables":{"BonusHexRangeIncrease":null,"PercentDamageIncrease":7}},{"maxUnits":5,"minUnits":4,"style":5,"variables":{"BonusHexRangeIncrease":null,"PercentDamageIncrease":16}},{"maxUnits":25000,"minUnits":6,"style":5,"variables":{"BonusHexRangeIncrease":5,"PercentDamageIncrease":35}}]|[{"threshold":2,"effects":[{"kind":"mechanic","mechanic":"sniper","values":{"damageBpsPerHex":700}}]}]|
|watcher|/setData/1/traits/32|[{"maxUnits":3,"minUnits":2,"style":1,"variables":{"BaseDR":0.15000000596046448,"HealthBreakpoint":0.5,"IncreasedDR":0.30000001192092896}},{"maxUnits":5,"minUnits":4,"style":3,"variables":{"BaseDR":0.25,"HealthBreakpoint":0.5,"IncreasedDR":0.44999998807907104}},{"maxUnits":25000,"minUnits":6,"style":5,"variables":{"BaseDR":0.3499999940395355,"HealthBreakpoint":0.5,"IncreasedDR":0.5}}]|[{"threshold":2,"effects":[{"kind":"mechanic","mechanic":"watcher","values":{"reductionBps":1500,"healthyReductionBps":3000,"thresholdBps":5000}}]},{"threshold":4,"effects":[{"kind":"mechanic","mechanic":"watcher","values":{"reductionBps":2500,"healthyReductionBps":4500,"thresholdBps":5000}}]}]|
|sorcerer|/setData/1/traits/2|[{"maxUnits":3,"minUnits":2,"style":1,"variables":{"BaseAP":20,"TeamAP":10}},{"maxUnits":5,"minUnits":4,"style":3,"variables":{"BaseAP":50,"TeamAP":10}},{"maxUnits":7,"minUnits":6,"style":5,"variables":{"BaseAP":95,"TeamAP":10}},{"maxUnits":25000,"minUnits":8,"style":5,"variables":{"BaseAP":110,"DamageDecrease":0.25,"DamageDecreaseDuration":3,"TeamAP":10}}]|[{"threshold":2,"effects":[{"kind":"statFlat","stat":"abilityPower","amount":10}],"memberEffects":[{"kind":"statFlat","stat":"abilityPower","amount":10}]},{"threshold":4,"effects":[{"kind":"statFlat","stat":"abilityPower","amount":10}],"memberEffects":[{"kind":"statFlat","stat":"abilityPower","amount":40}]}]|

## 近似项（不是 CDragon 等价声明）

|英雄|项目约定|
|---|---|
|akali|Dash collapsed to two same-tick hits; second applies 15% exposure, others from next tick; no movement.|
|ambessa|Starts chain stance; odd casts chain AoE, even fists; no dash movement, brief stun fixed5ticks; fists omnivamp scales AP.|
|amumu|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|blitzcrank|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|caitlyn|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|camille|Adaptive physical iff armor < MR; ties magic. Heal actual HP damage.|
|corki|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|darius|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|draven|After first cast all basics empowered; returning axe flight/catches not modeled.|
|ekko|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|ezreal|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|garen|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|heimerdinger|Uniform seeded target per missile; repeated hits allowed; cast count increases missiles.|
|illaoi|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|irelia|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|jinx|Three-cast cycle; hex-line zap, nearest three chomp centers with union damage, rocket board center additive hex falloff; no travel.|
|kogmaw|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|leblanc|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|leona|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|loris|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|lux|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|maddie|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|malzahar|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|mordekaiser|Line damage, nearest four source bonus; empowered10s magic attacks/radius2 splash; no movement; DR lasts project1s.|
|morgana|Nearest unmarked target, ten one-second pulses preserve total; same-caster refresh; shield reave affects new shields; dot persists caster death.|
|nami|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|nocturne|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|powder|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|rell|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|rumble|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|scar|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|sett|Nearest two enemies, solo 1.5x damage/control; no physical pickup relocation.|
|singed|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|steb|Share actual healing to nearest two allies; shares never recurse.|
|tristana|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|trundle|Missing-health fraction sampled once at cast, source 75% upper bonus; heal then packet commit.|
|twistedfate|Blue lowest absolute HP; red largest occupied radius1 cluster; yellow current target; cards instant.|
|twitch|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|urgot|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|vander|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|vex|Initial hit then fixed target-cell radius1 zone at DOTDuration; no travel.|
|vi|Primary punch and same-row secondary packets instant; secondary knockup = project 5 ticks.|
|violet|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|vladimir|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|zeri|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|ziggs|Primary single hit plus three seeded mini-bombs; no projectile travel.|
|zoe|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|
|zyra|Existing G2-1 skill implementation: docs/evidence/g2-1/RECONCILIATION.md; membership expanded only.|

## 已获准有限发布；后续完整实现待批清单

用户已允许征服者/学院有限实现与缺失清单不阻塞本次发布。以下不是源数据补全：

- 征服者：仅2/4档基础18/25 AD%与AP；征服层数、战争宝箱、宝箱成长全部未实现，待独立玩法批准。
- 学院：固定赞助池 archangel/deathblade/warmog；不发装备；每持有者仅计一次。源装备随机抽选、阶段发放、叠加方式缺完整规则，待批。
- 极客：按散件实例 ID 排序，取字典序第一种合法普通合成；战斗临时替换、不改变背包；幸运装备未建模。
- 外交官：Ambessa 按已有 PvP 胜场上限7算双抗；单人无独立对手身份，敌方无历史按0；当前联机投影不提供胜场历史，联机该项也按0，待服务器合同扩展；Garen邻位为同排左右，生命取基础星级+4外交官200，未计装备/其他羁绊。
- 蓝发小队：按全队最大生命总量损失25%触发，一次；执法官按初始最大生命排序通缉，死亡逐个叠加攻速。无转职时不可达档位不准入。
- 显示：纯函数值是每个 tooltip 数值，不把多发/持续伤害无条件相加；Rumble 升级名称字符串占位符不是数值输出。
- UI 新英雄颜色/短名/图标注册由界面负责人接入，现有 fallback 保持可用。

图标下载与 SHA256 状态见 assets-manifest.json。重建：`python3 scripts/import-m8-source.py --g2-2 --check`、`python3 scripts/generate-g2-content.py --g2-2 --check`、`node scripts/generate-g2-audit.cjs --g2-2 --check`。
