# 14.24b 本地原件摘录

离线读取；不修改归档与运行时数值表。下面的数组仅摘取原件索引 1/2/3（星级），保留原始浮点值。gz 的行号指解压后的原始文本；JSON Pointer 用于消除同名条目歧义。

原件：`src/simulation/content/source/s13-14.24b/raw/en_us.json.gz`，SHA256 `7e0e2d41a806833f6f18e5752c0d5eea4fa3a74e75b61c1c54853de74c2ac5d2`。

## TFT13_Lieutenant

原件 Pointer：`/setData/1/champions/39/ability`。

Randomly cast 1 of 3 spells, with a chance of a Jackpot!<br><br><spellPassive>Flamethrower:</spellPassive> {{Spell_TFT13_LieutenantSpell1_Tooltip}}<br><br><spellPassive>Extendo-Punch:</spellPassive> {{Spell_TFT13_LieutenantSpell2_Tooltip}}<br><br><spellPassive>Chomp:</spellPassive> {{Spell_TFT13_LieutenantSpell3_Tooltip}}

- `Spell1_ADPercent`: `[2.4000000953674316, 2.4000000953674316, 15.0]`
- `Spell1_ReducedDamagePercent`: `[0.5, 0.5, 0.5]`
- `Spell1_MinDuration`: `[2.0, 2.0, 2.0]`
- `Spell1_Bonus_DamagePercentPerSecond`: `[0.20000000298023224, 0.20000000298023224, 0.20000000298023224]`
- `Spell1_HighrollBonus`: `[20.0, 20.0, 20.0]`
- `APBonusDamage`: `[20.0, 30.0, 500.0]`
- `Spell2_HexRadius`: `[1.0, 1.0, 1.0]`
- `Spell2_Modifier`: `[3.0, 3.0, 3.0]`
- `Spell2_SecondaryModifier`: `[1.2999999523162842, 1.2999999523162842, 1.2999999523162842]`
- `Spell2_HexKnockback`: `[10.0, 10.0, 10.0]`
- `Spell2_StunDuration`: `[1.5, 1.5, 1.5]`
- `Spell2_Bonus_KnockbackDamage`: `[4.0, 4.0, 10.0]`
- `Spell3_Modifier`: `[3.200000047683716, 3.200000047683716, 3.200000047683716]`
- `Spell3_BleedModifier`: `[0.75, 0.75, 0.75]`
- `Spell3_StunDuration`: `[1.25, 1.25, 1.25]`
- `Spell3_NumSlams`: `[2.0, 2.0, 2.0]`
- `Spell3_BleedDuration`: `[5.0, 5.0, 5.0]`
- `Spell3_TargetPercentHealthDamage`: `[0.20000000298023224, 0.20000000298023224, 0.20000000298023224]`
- `Spell3_HexRadius`: `[1.0, 1.0, 1.0]`
- `Spell3_Bonus_BleedADPercent`: `[4.0, 4.0, 10.0]`
- `Spell3_Bonus_BleedDuration`: `[20.0, 20.0, 20.0]`
- `Spell3_ExecutePercentage`: `[0.15000000596046448, 0.15000000596046448, 1.0]`
- `Spell3_ResetDashRange`: `[2.0, 2.0, 10.0]`
- `Spell3_ResetDamageFalloff`: `[0.800000011920929, 0.800000011920929, 0.800000011920929]`
- `Spell3_BonusNumChomps`: `[4.0, 4.0, 4.0]`

## TFT13_Malzahar

原件 Pointer：`/setData/1/champions/20/ability`。

Summon a gate in a 5-hex line across target. Enemies hit take <magicDamage>@ModifiedDamage@ (%i:scaleAP%)</magicDamage> magic damage and are 20% <TFTKeyword>Shredded</TFTKeyword> for @ShredDuration@ seconds. Malzahar spreads 5 stacks of infection between enemies hit.<br><br>Infection deals <magicDamage>@ModifiedInfectionDamage@ (%i:scaleAP%)</magicDamage> magic damage per second for the rest of combat. This effect can stack infinitely. When an infected target dies, they spread their stacks to nearby enemies.<br><br><rules><tftbold>Shred:</tftbold> Reduce Magic Resist</rules>

- `Damage`: `[80.0, 120.0, 1000.0]`
- `InfectionDamage`: `[14.0, 21.0, 400.0]`
- `DamageTicksPerSecond`: `[0.75, 0.75, 0.75]`
- `ShredDuration`: `[4.0, 4.0, 4.0]`

## TFT13_Jinx

原件 Pointer：`/setData/1/champions/48/ability`。

<tftrules>Jinx alternates between Zap, Flame Chompers, and Death Rocket for her&nbsp;ability.</tftrules><br><br><spellActive>Zap:</spellActive> Deal <physicalDamage>@ZapModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to enemies in a line and Stun them for <scaleLevel>@ZapStunDuration@</scaleLevel>&nbsp;seconds.<br><spellActive>Flame Chompers:</spellActive> Deal <physicalDamage>@FlameChompersModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to @NumOfFlameChompers@ 1-hex circles of&nbsp;enemies.<br><spellActive>Death Rocket:</spellActive> Fire a rocket at the center of the board that <physicalDamage>@DeathRocketModifiedDamage@&nbsp;(%i:scaleAD%%i:scaleAP%)</physicalDamage> physical damage to ALL enemies, reduced by @FalloffPercent*100@% for each hex they are away from the epicenter.

- `NumOfFlameChompers`: `[3.0, 3.0, 3.0]`
- `FlameChompersPercentAD`: `[2.6500000953674316, 2.6500000953674316, 20.0]`
- `ZapPercentAD`: `[2.6500000953674316, 2.6500000953674316, 20.0]`
- `ZapStunDuration`: `[1.25, 1.5, 10.0]`
- `ZapLength`: `[2500.0, 2500.0, 2500.0]`
- `ZapWidth`: `[180.0, 180.0, 180.0]`
- `DeathRocketPercentAD`: `[7.0, 7.0, 90.01000213623047]`
- `DeathRocketAP`: `[60.0, 90.0, 300.0]`
- `DeathRocketHexes`: `[6.0, 6.0, 6.0]`
- `FalloffPercent`: `[0.10000000149011612, 0.10000000149011612, 0.10000000149011612]`

## TFT13_Jayce

原件 Pointer：`/setData/1/champions/34/ability`。

<spellPassive>Passive:</spellPassive> Summon a placeable Hextech Forge. On cast, the @NumAlliesShield@ allies closest to it gain <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleAP%)</TFTBonus> Shield for @ShieldDuration@ seconds. If it's dead, revive it with <TFTBonus>@ReducedSummonHealth*100@%</TFTBonus>&nbsp;Health.<br><br><spellActive>Active:</spellActive> Summon 2 Hexgates and knock target into one of them, dealing <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage and sending them flying back to their original position. While flying, they deal <physicalDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to all other enemies in the&nbsp;path.

- `PercentAttackDamage`: `[5.0, 5.0, 20.0]`
- `PercentADSecondaryDamage`: `[2.25, 2.25, 15.0]`
- `NumAlliesShield`: `[3.0, 3.0, 3.0]`
- `Shield`: `[200.0, 275.0, 1800.0]`
- `ShieldDuration`: `[4.0, 4.0, 4.0]`
- `InitialGateDistanceBehindTheTarget`: `[480.0, 480.0, 480.0]`
- `EnemyFlightDuration`: `[0.75, 0.75, 0.75]`
- `FlyingEnemyDamageRadius`: `[290.0, 290.0, 290.0]`
- `MaxEnemySpeed`: `[2300.0, 2300.0, 2300.0]`
- `MinEnemySpeed`: `[1650.0, 1650.0, 1650.0]`
- `ReducedSummonHealth`: `[1.0, 1.0, 1.0]`

## TFT13_Mordekaiser

原件 Pointer：`/setData/1/champions/70/ability`。

Briefly gain <TFTBonus>@DR*100@%</TFTBonus> Durability and summon a massive claw, dealing <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to the most enemies in a line. The @NearestEnemies@ closest enemies take <TFTBonus>@DamageBonus*100@%</TFTBonus> more damage and are pulled towards&nbsp;Mordekaiser.<br><br>For the next @EmpowerDuration@ seconds, gain <TFTBonus>@OmnivampPercent*100@%</TFTBonus> Omnivamp, +1 Attack Range, and replace every attack with a slam that deals <magicDamage>@ModifiedTargetDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to target and <magicDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to all other enemies within @AttackHexRadius@&nbsp;hexes.

- `DR`: `[0.4000000059604645, 0.4000000059604645, 0.4000000059604645]`
- `Damage`: `[160.0, 240.0, 800.0]`
- `DamageBonus`: `[0.25, 0.25, 0.25]`
- `NearestEnemies`: `[4.0, 4.0, 4.0]`
- `Displacement`: `[240.0, 240.0, 240.0]`
- `OmnivampPercent`: `[0.30000001192092896, 0.30000001192092896, 0.30000001192092896]`
- `TargetDamage`: `[330.0, 500.0, 3000.0]`
- `SlamDamage`: `[85.0, 125.0, 1500.0]`
- `AttackHexRadius`: `[2.0, 2.0, 2.0]`
- `LineRange`: `[1470.0, 1470.0, 1470.0]`
- `LineWidth`: `[615.0, 615.0, 615.0]`
- `NumAttacks`: `[1.0, 1.0, 1.0]`
- `EmpowerDuration`: `[10.0, 10.0, 10.0]`

## 赛维卡子技能原文

原件：`src/simulation/content/source/s13-14.24b/raw/en_us.tft.stringtable.json.gz`，SHA256 `1a96281672670a865cea018b7b2c447ead04e74b7a6800984749cb0f71732e8e`。

`/entries/spell_tft13_lieutenantspell1_tooltip`；解压行 1：

Deal <trueDamage>@ModifiedSpell1Damage@&nbsp;(%i:scaleAD%)</trueDamage> true damage to target every second until death. Enemies in a cone around them take @Spell1_ReducedDamagePercent*100@% less as physical&nbsp;damage.

`/entries/spell_tft13_lieutenantspell2_tooltip`；解压行 1：

Deal <physicalDamage>@ModifiedSpell2Damage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to target and knock them away. Then, dash to them and deal <physicalDamage>@ModifiedSecondarySpell2Damage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage in a @Spell2_HexRadius@ hex radius around&nbsp;them.

`/entries/spell_tft13_lieutenantspell3_tooltip`；解压行 1：

Deal <physicalDamage>@ModifiedSpell3Damage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to target. If they are left with less than <scaleLevel>@Spell3_ExecutePercentage*100@%</scaleLevel> Health, execute them and cast again on the lowest Health target within @Spell3_ResetDashRange@ hexes, dealing <scaleLevel>@Spell3_ResetDamageFalloff*100@%</scaleLevel>&nbsp;damage.

`/entries/generatedtip_spelltft_tft13_lieutenantspell_tooltipextended`；解压行 1：

<titleLeft>Beat the Odds</titleLeft><mainText>Randomly cast 1 of 3 spells, with a chance of a Jackpot!<br><br><spellPassive>Flamethrower:</spellPassive> {{Spell_TFT13_LieutenantSpell1_Tooltip}}<br><br><spellPassive>Extendo-Punch:</spellPassive> {{Spell_TFT13_LieutenantSpell2_Tooltip}}<br><br><spellPassive>Chomp:</spellPassive> {{Spell_TFT13_LieutenantSpell3_Tooltip}}</mainText><postScriptLeft>Flamethrower Damage: <trueDamage>@ModifiedSpell1Damage@</trueDamage> = @Spell1_ADPercent*100@% %i:scaleAD% + @APBonusDamage@% %i:scaleAP%<br>Extendo-Punch Damage: <physicalDamage>@ModifiedSpell2Damage@</physicalDamage> = @Spell2_Modifier*100@% of <trueDamage>@ModifiedSpell1Damage@</trueDamage><br>Dash Damage: <physicalDamage>@ModifiedSecondarySpell2Damage@</physicalDamage> = @Spell2_SecondaryModifier*100@% of <trueDamage>@ModifiedSpell1Damage@</trueDamage><br>Chomp Damage: <physicalDamage>@ModifiedSpell3Damage@</physicalDamage> = @Spell3_Modifier*100@% of <trueDamage>@ModifiedSpell1Damage@</trueDamage></postScriptLeft><postScriptRight>[ @APBonusDamage1Prefix@@APBonusDamage1@%@APBonusDamage1Postfix@ / @APBonusDamage2Prefix@@APBonusDamage2@%@APBonusDamage2Postfix@ / @APBonusDamage3Prefix@@APBonusDamage3@%@APBonusDamage3Postfix@ ]<br>&nbsp;<br>&nbsp;<br>&nbsp;</postScriptRight>

## 原版射程映射（不是几何坐标比例尺）

原件：`src/simulation/content/source/s13-14.24b/raw/map22.bin.json.gz`，SHA256 `743bf3668141be28d44b39160dcfc0da0aca0e919e6aa14513a0b3feb666b2b0`；解压行 1，Pointer `/{9fcfd7a6}/HexToRangeMap`。

- HexNumber 1: RawRange 180.0
- HexNumber 2: RawRange 420.0
- HexNumber 3: RawRange 610.0
- HexNumber 4: RawRange 890.0
- HexNumber 5: RawRange 1130.0
- HexNumber 6: RawRange 1370.0
- HexNumber 7: RawRange 1610.0
- HexNumber 8: RawRange 1850.0
- HexNumber 9: RawRange 2090.0
- HexNumber 10: RawRange 2330.0

此表非线性（1/2/3/4 格对应 180/420/610/890），不能替代棋盘格中心间距或技能碰撞几何。2500 大于表内最大 2330（10 格），只证明超过映射的十格射程，不能确定精确端点、线宽或格覆盖。
