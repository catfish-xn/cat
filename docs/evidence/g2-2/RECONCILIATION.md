# G2-2 source reconciliation — admission pending

本文件记录候选证据，不代表已经发布 48 英雄 / 14 羁绊。当前运行时仍为 33 英雄 / 8 羁绊；CONTENT digest 未变更。

锁定源解压 SHA256：`c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3`。完整原始候选记录、逐星技能值和 canonical SHA256 见 `source-candidates.json`；每个变量的 1–3 星值取 `ability.variables[].value[1:4]`。

## 新增英雄候选

| 英雄 | CDragon pointer | 费用 | HP / AD / 护甲 / 魔抗 | AS / 射程 / 初始法力 / 总法力 | 技能名 | 准入状态 |
|---|---|---:|---|---|---|---|
| Camille (`TFT13_Camille`) | `/setData/1/champions/14` | 2 | 700.0 / 50.0 / 45.0 / 45.0 | 0.75 / 1.0 / 0 / 25.0 | Adaptive Strike | 源属性完整；尚未实现运行时 |
| Vi (`TFT13_Vi`) | `/setData/1/champions/16` | 4 | 1100.0 / 75.0 / 50.0 / 50.0 | 0.8500000238418579 / 1.0 / 40.0 / 100 | Wrecking Crew | 源属性完整；尚未实现运行时 |
| Akali (`TFT13_Akali`) | `/setData/1/champions/23` | 2 | 700.0 / 45.0 / 45.0 / 45.0 | 0.75 / 1.0 / 0 / 60.0 | Shuriken Flip | 源属性完整；尚未实现运行时 |
| Sett (`TFT13_Sett`) | `/setData/1/champions/24` | 2 | 850.0 / 60.0 / 50.0 / 50.0 | 0.6000000238418579 / 1.0 / 50.0 / 100 | Facebreaker | 源属性完整；尚未实现运行时 |
| Draven (`TFT13_Draven`) | `/setData/1/champions/27` | 1 | 500.0 / 55.0 / 15.0 / 15.0 | 0.699999988079071 / 4.0 / 30.0 / 60.0 | Spinning Axes | 源属性完整；尚未实现运行时 |
| Heimerdinger (`TFT13_Heimerdinger`) | `/setData/1/champions/33` | 4 | 800.0 / 40.0 / 30.0 / 30.0 | 0.75 / 4.0 / 0 / 40.0 | PROGRESSSSS! | 源属性完整；尚未实现运行时 |
| Jayce (`TFT13_Jayce`) | `/setData/1/champions/34` | 5 | 900.0 / 50.0 / 0.0 / 缺 | 0.5 / 1.0 / 0 / 10.0 | Special Delivery | 缺形态属性，暂缓 |
| Trundle (`TFT13_Trundle`) | `/setData/1/champions/35` | 1 | 650.0 / 50.0 / 40.0 / 40.0 | 0.6499999761581421 / 1.0 / 30.0 / 90.0 | Desperate Chomp | 源属性完整；尚未实现运行时 |
| Ziggs (`TFT13_Ziggs`) | `/setData/1/champions/36` | 2 | 600.0 / 35.0 / 20.0 / 20.0 | 0.699999988079071 / 4.0 / 15.0 / 60.0 | Bomb Full of Bombs | 源属性完整；尚未实现运行时 |
| Steb (`TFT13_Fish`) | `/setData/1/champions/42` | 1 | 650.0 / 55.0 / 45.0 / 45.0 | 0.550000011920929 / 1.0 / 30.0 / 90.0 | Field Medicine | 源属性完整；尚未实现运行时 |
| Jinx (`TFT13_Jinx`) | `/setData/1/champions/48` | 5 | 900.0 / 60.0 / 40.0 / 40.0 | 0.800000011920929 / 4.0 / 0 / 60.0 | Ruin Everything | 源属性完整；尚未实现运行时 |
| Vex (`TFT13_Vex`) | `/setData/1/champions/56` | 1 | 450.0 / 30.0 / 15.0 / 15.0 | 0.699999988079071 / 4.0 / 0 / 60.0 | Looming Darkness | 源属性完整；尚未实现运行时 |
| Ambessa (`TFT13_Ambessa`) | `/setData/1/champions/61` | 4 | 1100.0 / 65.0 / 50.0 / 50.0 | 0.800000011920929 / 1.0 / 40.0 / 90.0 | Unrelenting Huntress | 源属性完整；尚未实现运行时 |
| Gangplank (`TFT13_Gangplank`) | `/setData/1/champions/65` | 3 | 700.0 / 50.0 / 0.0 / 缺 | 0.5 / 1.0 / 0 / 10.0 | Harvest from Flames | 缺形态属性，暂缓 |
| Twisted Fate (`TFT13_TwistedFate`) | `/setData/1/champions/68` | 3 | 700.0 / 35.0 / 25.0 / 25.0 | 0.699999988079071 / 4.0 / 25.0 / 75.0 | Wild Cards | 源属性完整；尚未实现运行时 |
| Mordekaiser (`TFT13_Mordekaiser`) | `/setData/1/champions/70` | 5 | 1200.0 / 75.0 / 70.0 / 70.0 | 0.550000011920929 / 1.0 / 25.0 / 100 | Grasp of the Iron Revenant | 源属性完整；尚未实现运行时 |

斯维因完整字段与缺失表见 `SWAIN.md`。上述候选有 14 名属性完整、2 名缺形态属性；补齐第 15 名的选择尚待确认。

## 逐英雄技能值

### Camille

| CDragon 字段（相对英雄 pointer） | 1 星 / 2 星 / 3 星 |
|---|---|
| `ability/variables/0` (PercentAttackDamage) | 2.3 / 2.3 / 2.6 |
| `ability/variables/1` (APDamage) | 30.0 / 45.0 / 70.0 |
| `ability/variables/2` (HealPercent) | 0.33 / 0.33 / 0.33 |

### Vi

| CDragon 字段（相对英雄 pointer） | 1 星 / 2 星 / 3 星 |
|---|---|
| `ability/variables/0` (Shield) | 280.0 / 325.0 / 1200.0 |
| `ability/variables/1` (PercentAttackDamage) | 6.0 / 6.0 / 12.0 |
| `ability/variables/2` (PercentAttackDamage_SecondaryDamage) | 1.8 / 1.8 / 5.0 |
| `ability/variables/3` (ShieldDuration) | 3.0 / 3.0 / 3.0 |
| `ability/variables/4` (StunDuration) | 1.5 / 1.5 / 1.5 |

### Akali

| CDragon 字段（相对英雄 pointer） | 1 星 / 2 星 / 3 星 |
|---|---|
| `ability/variables/0` (Damage) | 80.0 / 120.0 / 185.0 |
| `ability/variables/1` (SecondaryDamage) | 240.0 / 360.0 / 550.0 |
| `ability/variables/2` (TargetDamageAmp) | 0.15 / 0.15 / 0.15 |
| `ability/variables/3` (Duration) | 4.0 / 4.0 / 4.0 |
| `ability/variables/4` (FlipBackwardsSpeed) | 1300.0 / 1300.0 / 1300.0 |
| `ability/variables/5` (SpeedDuringFinalKick) | 1700.0 / 1700.0 / 1700.0 |

### Sett

| CDragon 字段（相对英雄 pointer） | 1 星 / 2 星 / 3 星 |
|---|---|
| `ability/variables/0` (Damage) | 180.0 / 270.0 / 420.0 |
| `ability/variables/1` (StunDuration) | 1.5 / 1.5 / 2.0 |
| `ability/variables/2` (SoloBonus) | 0.5 / 0.5 / 0.5 |

### Draven

| CDragon 字段（相对英雄 pointer） | 1 星 / 2 星 / 3 星 |
|---|---|
| `ability/variables/0` (PercentAD) | 1.4 / 1.4 / 1.4 |
| `ability/variables/1` (BaseDamage) | 10.0 / 15.0 / 25.0 |

### Heimerdinger

| CDragon 字段（相对英雄 pointer） | 1 星 / 2 星 / 3 星 |
|---|---|
| `ability/variables/0` (Damage) | 50.0 / 75.0 / 225.0 |
| `ability/variables/1` (StartingRockets) | 5.0 / 5.0 / 7.0 |
| `ability/variables/2` (NumOfCastsToIncreaseMissiles) | 1.0 / 1.0 / 1.0 |
| `ability/variables/3` (MissileIncreasePerCast) | 1.0 / 1.0 / 1.0 |
| `ability/variables/4` (PercentOfMissileToFocusOnTarget) | 0.5 / 0.5 / 0.5 |
| `ability/variables/5` (AdditionalTargetRowDifferential) | 2.0 / 2.0 / 2.0 |

### Jayce

| CDragon 字段（相对英雄 pointer） | 1 星 / 2 星 / 3 星 |
|---|---|
| `ability/variables/0` (PercentAttackDamage) | 5.0 / 5.0 / 20.0 |
| `ability/variables/1` (PercentADSecondaryDamage) | 2.25 / 2.25 / 15.0 |
| `ability/variables/2` (NumAlliesShield) | 3.0 / 3.0 / 3.0 |
| `ability/variables/3` (Shield) | 200.0 / 275.0 / 1800.0 |
| `ability/variables/4` (ShieldDuration) | 4.0 / 4.0 / 4.0 |
| `ability/variables/5` (InitialGateDistanceBehindTheTarget) | 480.0 / 480.0 / 480.0 |
| `ability/variables/6` (EnemyFlightDuration) | 0.75 / 0.75 / 0.75 |
| `ability/variables/7` (FlyingEnemyDamageRadius) | 290.0 / 290.0 / 290.0 |
| `ability/variables/8` (MaxEnemySpeed) | 2300.0 / 2300.0 / 2300.0 |
| `ability/variables/9` (MinEnemySpeed) | 1650.0 / 1650.0 / 1650.0 |
| `ability/variables/10` (ReducedSummonHealth) | 1.0 / 1.0 / 1.0 |

### Trundle

| CDragon 字段（相对英雄 pointer） | 1 星 / 2 星 / 3 星 |
|---|---|
| `ability/variables/0` (PercentAttackDamage) | 2.8 / 2.8 / 2.8 |
| `ability/variables/1` (GainHealth) | 200.0 / 220.0 / 250.0 |
| `ability/variables/2` (AmountIncreaseMax) | 0.75 / 0.75 / 0.75 |

### Ziggs

| CDragon 字段（相对英雄 pointer） | 1 星 / 2 星 / 3 星 |
|---|---|
| `ability/variables/0` (Damage) | 180.0 / 270.0 / 450.0 |
| `ability/variables/1` (MinibombDamage) | 90.0 / 135.0 / 200.0 |
| `ability/variables/2` (NumBombs) | 3.0 / 3.0 / 3.0 |

### Steb

| CDragon 字段（相对英雄 pointer） | 1 星 / 2 星 / 3 星 |
|---|---|
| `ability/variables/0` (PercentAlliedHealShare) | 0.25 / 0.25 / 0.25 |
| `ability/variables/1` (NumAlliesToShare) | 2.0 / 2.0 / 2.0 |
| `ability/variables/2` (Damage) | 260.0 / 390.0 / 585.0 |
| `ability/variables/3` (Heal) | 270.0 / 310.0 / 360.0 |
| `ability/variables/4` (HEROOmnivamp) | 0.3 / 0.3 / 0.3 |
| `ability/variables/5` (HEROSpellDamageMod) | 0.65 / 0.65 / 0.65 |
| `ability/variables/6` (HEROMaxHits) | 3.0 / 3.0 / 3.0 |

### Jinx

| CDragon 字段（相对英雄 pointer） | 1 星 / 2 星 / 3 星 |
|---|---|
| `ability/variables/0` (NumOfFlameChompers) | 3.0 / 3.0 / 3.0 |
| `ability/variables/1` (FlameChompersPercentAD) | 2.65 / 2.65 / 20.0 |
| `ability/variables/2` (ZapPercentAD) | 2.65 / 2.65 / 20.0 |
| `ability/variables/3` (ZapStunDuration) | 1.25 / 1.5 / 10.0 |
| `ability/variables/4` (ZapLength) | 2500.0 / 2500.0 / 2500.0 |
| `ability/variables/5` (ZapWidth) | 180.0 / 180.0 / 180.0 |
| `ability/variables/6` (DeathRocketPercentAD) | 7.0 / 7.0 / 90.01 |
| `ability/variables/7` (DeathRocketAP) | 60.0 / 90.0 / 300.0 |
| `ability/variables/8` (DeathRocketHexes) | 6.0 / 6.0 / 6.0 |
| `ability/variables/9` (FalloffPercent) | 0.1 / 0.1 / 0.1 |

### Vex

| CDragon 字段（相对英雄 pointer） | 1 星 / 2 星 / 3 星 |
|---|---|
| `ability/variables/0` (Damage) | 220.0 / 330.0 / 550.0 |
| `ability/variables/1` (SecondaryDamage) | 110.0 / 165.0 / 275.0 |
| `ability/variables/2` (DOTDuration) | 0.8 / 0.8 / 0.8 |

### Ambessa

| CDragon 字段（相对英雄 pointer） | 1 星 / 2 星 / 3 星 |
|---|---|
| `ability/variables/0` (PercentChainAttackAD) | 1.5 / 1.5 / 3.5 |
| `ability/variables/1` (PercentStrikeAD) | 2.5 / 2.5 / 5.0 |
| `ability/variables/2` (PercentOmnivamp) | 0.25 / 0.25 / 0.45 |
| `ability/variables/3` (AttackSpeed) | 1.0 / 1.0 / 1.0 |
| `ability/variables/4` (SlamDamageAD) | 5.0 / 5.0 / 12.0 |

### Gangplank

| CDragon 字段（相对英雄 pointer） | 1 星 / 2 星 / 3 星 |
|---|---|
| `ability/variables/0` (PercentAttackDamage) | 3.4 / 3.4 / 3.4 |
| `ability/variables/1` (Heal) | 100.0 / 125.0 / 150.0 |
| `ability/variables/2` (NumBarrels) | 缺 |
| `ability/variables/3` (SingleTargetDamageIncrease) | 1.0 / 1.0 / 1.0 |

### Twisted Fate

| CDragon 字段（相对英雄 pointer） | 1 星 / 2 星 / 3 星 |
|---|---|
| `ability/variables/0` (BlueHeal) | 90.0 / 110.0 / 140.0 |
| `ability/variables/1` (RedDamage) | 110.0 / 165.0 / 255.0 |
| `ability/variables/2` (YellowDamage) | 230.0 / 345.0 / 535.0 |
| `ability/variables/3` (StunDuration) | 1.0 / 1.0 / 1.0 |

### Mordekaiser

| CDragon 字段（相对英雄 pointer） | 1 星 / 2 星 / 3 星 |
|---|---|
| `ability/variables/0` (DR) | 0.4 / 0.4 / 0.4 |
| `ability/variables/1` (Damage) | 160.0 / 240.0 / 800.0 |
| `ability/variables/2` (DamageBonus) | 0.25 / 0.25 / 0.25 |
| `ability/variables/3` (NearestEnemies) | 4.0 / 4.0 / 4.0 |
| `ability/variables/4` (Displacement) | 240.0 / 240.0 / 240.0 |
| `ability/variables/5` (OmnivampPercent) | 0.3 / 0.3 / 0.3 |
| `ability/variables/6` (TargetDamage) | 330.0 / 500.0 / 3000.0 |
| `ability/variables/7` (SlamDamage) | 85.0 / 125.0 / 1500.0 |
| `ability/variables/8` (AttackHexRadius) | 2.0 / 2.0 / 2.0 |
| `ability/variables/9` (LineRange) | 1470.0 / 1470.0 / 1470.0 |
| `ability/variables/10` (LineWidth) | 615.0 / 615.0 / 615.0 |
| `ability/variables/11` (NumAttacks) | 1.0 / 1.0 / 1.0 |
| `ability/variables/12` (EmpowerDuration) | 10.0 / 10.0 / 10.0 |

## 六个阵营

| 阵营 | CDragon pointer | 已有成员 | 新增候选 |
|---|---|---|---|
| Scrap | `/setData/1/traits/3` | corki, ekko, powder, rumble | Trundle, Ziggs, Gangplank |
| Emissary | `/setData/1/traits/6` | garen, nami, tristana | Ambessa |
| Conqueror | `/setData/1/traits/15` | darius, rell | Draven, Ambessa, Mordekaiser |
| Academy | `/setData/1/traits/17` | ezreal, leona, lux | Heimerdinger, Jayce |
| Rebel | `/setData/1/traits/19` | ezreal, illaoi, irelia, zoe | Akali, Sett, Jinx, Vex |
| Enforcer | `/setData/1/traits/23` | caitlyn, loris, maddie | Camille, Vi, Steb, Twisted Fate |

### Scrap 逐档数值

| CDragon 字段（相对羁绊 pointer） | 源值 |
|---|---|
| `/effects/0/maxUnits` | 3 |
| `/effects/0/minUnits` | 2 |
| `/effects/0/style` | 1 |
| `/effects/0/variables/HPShieldAmount` | 25.0 |
| `/effects/0/variables/NumComponents` | 1.0 |
| `/effects/0/variables/ShieldDuration` | 20.0 |
| `/effects/0/variables/{659aef8d}` | 缺 |
| `/effects/0/variables/{7e2474c8}` | 缺 |
| `/effects/1/maxUnits` | 5 |
| `/effects/1/minUnits` | 4 |
| `/effects/1/style` | 3 |
| `/effects/1/variables/HPShieldAmount` | 35.0 |
| `/effects/1/variables/NumComponents` | 3.0 |
| `/effects/1/variables/ShieldDuration` | 20.0 |
| `/effects/1/variables/{659aef8d}` | 缺 |
| `/effects/1/variables/{7e2474c8}` | 缺 |
| `/effects/2/maxUnits` | 8 |
| `/effects/2/minUnits` | 6 |
| `/effects/2/style` | 5 |
| `/effects/2/variables/HPShieldAmount` | 50.0 |
| `/effects/2/variables/NumComponents` | 20.0 |
| `/effects/2/variables/ShieldDuration` | 20.0 |
| `/effects/2/variables/{659aef8d}` | 1.0 |
| `/effects/2/variables/{7e2474c8}` | 缺 |
| `/effects/3/maxUnits` | 25000 |
| `/effects/3/minUnits` | 9 |
| `/effects/3/style` | 5 |
| `/effects/3/variables/HPShieldAmount` | 60.0 |
| `/effects/3/variables/NumComponents` | 20.0 |
| `/effects/3/variables/ShieldDuration` | 20.0 |
| `/effects/3/variables/{659aef8d}` | 1.0 |
| `/effects/3/variables/{7e2474c8}` | 1.0 |

### Emissary 逐档数值

| CDragon 字段（相对羁绊 pointer） | 源值 |
|---|---|
| `/effects/0/maxUnits` | 1 |
| `/effects/0/minUnits` | 1 |
| `/effects/0/style` | 1 |
| `/effects/0/variables/AmbessaArmor` | 2.0 |
| `/effects/0/variables/AmbessaArmor_PVE` | 4.0 |
| `/effects/0/variables/BonusAS` | 缺 |
| `/effects/0/variables/BonusHealth` | 200.0 |
| `/effects/0/variables/CCImmuneDuration` | 8.0 |
| `/effects/0/variables/GarenHealthPercent` | 0.11999999731779099 |
| `/effects/0/variables/NamiMana` | 2.0 |
| `/effects/0/variables/SelfishDamageAmp` | 0.20000000298023224 |
| `/effects/0/variables/StarAS` | 0.05999999865889549 |
| `/effects/0/variables/{3854f478}` | 2.0 |
| `/effects/0/variables/{4b20f990}` | 缺 |
| `/effects/0/variables/{845be53a}` | 4.0 |
| `/effects/1/maxUnits` | 4 |
| `/effects/1/minUnits` | 4 |
| `/effects/1/style` | 5 |
| `/effects/1/variables/AmbessaArmor` | 2.0 |
| `/effects/1/variables/AmbessaArmor_PVE` | 4.0 |
| `/effects/1/variables/BonusAS` | 缺 |
| `/effects/1/variables/BonusHealth` | 200.0 |
| `/effects/1/variables/CCImmuneDuration` | 8.0 |
| `/effects/1/variables/GarenHealthPercent` | 0.11999999731779099 |
| `/effects/1/variables/NamiMana` | 2.0 |
| `/effects/1/variables/SelfishDamageAmp` | 0.20000000298023224 |
| `/effects/1/variables/StarAS` | 0.05999999865889549 |
| `/effects/1/variables/{3854f478}` | 2.0 |
| `/effects/1/variables/{4b20f990}` | 缺 |
| `/effects/1/variables/{845be53a}` | 4.0 |

### Conqueror 逐档数值

| CDragon 字段（相对羁绊 pointer） | 源值 |
|---|---|
| `/effects/0/maxUnits` | 3 |
| `/effects/0/minUnits` | 2 |
| `/effects/0/style` | 1 |
| `/effects/0/variables/ADAPBase` | 0.18000000715255737 |
| `/effects/0/variables/PercentIncreasePerChest` | 0.029999999329447746 |
| `/effects/0/variables/StacksPerKill` | 1.0 |
| `/effects/1/maxUnits` | 5 |
| `/effects/1/minUnits` | 4 |
| `/effects/1/style` | 3 |
| `/effects/1/variables/ADAPBase` | 0.25 |
| `/effects/1/variables/PercentIncreasePerChest` | 0.029999999329447746 |
| `/effects/1/variables/StacksPerKill` | 3.0 |
| `/effects/2/maxUnits` | 8 |
| `/effects/2/minUnits` | 6 |
| `/effects/2/style` | 5 |
| `/effects/2/variables/ADAPBase` | 0.4000000059604645 |
| `/effects/2/variables/PercentIncreasePerChest` | 0.029999999329447746 |
| `/effects/2/variables/StacksPerKill` | 6.0 |
| `/effects/3/maxUnits` | 25000 |
| `/effects/3/minUnits` | 9 |
| `/effects/3/style` | 6 |
| `/effects/3/variables/ADAPBase` | 1.0 |
| `/effects/3/variables/PercentIncreasePerChest` | 0.029999999329447746 |
| `/effects/3/variables/StacksPerKill` | 20.0 |

### Academy 逐档数值

| CDragon 字段（相对羁绊 pointer） | 源值 |
|---|---|
| `/effects/0/maxUnits` | 3 |
| `/effects/0/minUnits` | 3 |
| `/effects/0/style` | 1 |
| `/effects/0/variables/BaseValues` | 0.05000000074505806 |
| `/effects/0/variables/NumOfItems` | 1.0 |
| `/effects/0/variables/PercentIncreaseSponsored` | 0.019999999552965164 |
| `/effects/1/maxUnits` | 4 |
| `/effects/1/minUnits` | 4 |
| `/effects/1/style` | 3 |
| `/effects/1/variables/BaseValues` | 0.05000000074505806 |
| `/effects/1/variables/NumOfItems` | 2.0 |
| `/effects/1/variables/PercentIncreaseSponsored` | 0.029999999329447746 |
| `/effects/2/maxUnits` | 5 |
| `/effects/2/minUnits` | 5 |
| `/effects/2/style` | 5 |
| `/effects/2/variables/BaseValues` | 0.05000000074505806 |
| `/effects/2/variables/NumOfItems` | 3.0 |
| `/effects/2/variables/PercentIncreaseSponsored` | 0.05000000074505806 |
| `/effects/3/maxUnits` | 25000 |
| `/effects/3/minUnits` | 6 |
| `/effects/3/style` | 5 |
| `/effects/3/variables/BaseValues` | 0.05000000074505806 |
| `/effects/3/variables/NumOfItems` | 3.0 |
| `/effects/3/variables/PercentIncreaseSponsored` | 0.09000000357627869 |

### Rebel 逐档数值

| CDragon 字段（相对羁绊 pointer） | 源值 |
|---|---|
| `/effects/0/maxUnits` | 4 |
| `/effects/0/minUnits` | 3 |
| `/effects/0/style` | 1 |
| `/effects/0/variables/ADAP` | 0.20000000298023224 |
| `/effects/0/variables/BurstAS` | 0.6000000238418579 |
| `/effects/0/variables/BurstDuration` | 5.0 |
| `/effects/0/variables/ForceDuration` | 缺 |
| `/effects/0/variables/MaxHealthIncrease` | 0.11999999731779099 |
| `/effects/0/variables/PercentHealthTrigger` | 0.25 |
| `/effects/0/variables/PercentMaxHealthBonus` | 缺 |
| `/effects/0/variables/StunDuration` | 缺 |
| `/effects/0/variables/{1ec59053}` | 缺 |
| `/effects/1/maxUnits` | 6 |
| `/effects/1/minUnits` | 5 |
| `/effects/1/style` | 3 |
| `/effects/1/variables/ADAP` | 0.4000000059604645 |
| `/effects/1/variables/BurstAS` | 0.6000000238418579 |
| `/effects/1/variables/BurstDuration` | 5.0 |
| `/effects/1/variables/ForceDuration` | 缺 |
| `/effects/1/variables/MaxHealthIncrease` | 0.11999999731779099 |
| `/effects/1/variables/PercentHealthTrigger` | 0.25 |
| `/effects/1/variables/PercentMaxHealthBonus` | 0.11999999731779099 |
| `/effects/1/variables/StunDuration` | 缺 |
| `/effects/1/variables/{1ec59053}` | 缺 |
| `/effects/2/maxUnits` | 9 |
| `/effects/2/minUnits` | 7 |
| `/effects/2/style` | 5 |
| `/effects/2/variables/ADAP` | 0.44999998807907104 |
| `/effects/2/variables/BurstAS` | 0.6000000238418579 |
| `/effects/2/variables/BurstDuration` | 5.0 |
| `/effects/2/variables/ForceDuration` | 缺 |
| `/effects/2/variables/MaxHealthIncrease` | 0.11999999731779099 |
| `/effects/2/variables/PercentHealthTrigger` | 0.25 |
| `/effects/2/variables/PercentMaxHealthBonus` | 0.15000000596046448 |
| `/effects/2/variables/StunDuration` | 2.0 |
| `/effects/2/variables/{1ec59053}` | 缺 |
| `/effects/3/maxUnits` | 25000 |
| `/effects/3/minUnits` | 10 |
| `/effects/3/style` | 6 |
| `/effects/3/variables/ADAP` | 0.5 |
| `/effects/3/variables/BurstAS` | 0.6000000238418579 |
| `/effects/3/variables/BurstDuration` | 5.0 |
| `/effects/3/variables/ForceDuration` | 12.0 |
| `/effects/3/variables/MaxHealthIncrease` | 0.11999999731779099 |
| `/effects/3/variables/PercentHealthTrigger` | 0.25 |
| `/effects/3/variables/PercentMaxHealthBonus` | 0.30000001192092896 |
| `/effects/3/variables/StunDuration` | 2.0 |
| `/effects/3/variables/{1ec59053}` | 1.0 |

### Enforcer 逐档数值

| CDragon 字段（相对羁绊 pointer） | 源值 |
|---|---|
| `/effects/0/maxUnits` | 3 |
| `/effects/0/minUnits` | 2 |
| `/effects/0/style` | 1 |
| `/effects/0/variables/AttackSpeedPerWantedKill` | 0.30000001192092896 |
| `/effects/0/variables/BaseDA` | 0.11999999731779099 |
| `/effects/0/variables/NumOfWantedEnemies` | 1.0 |
| `/effects/0/variables/PercentMaxHealthShield` | 0.11999999731779099 |
| `/effects/0/variables/{36b1550f}` | 缺 |
| `/effects/0/variables/{9edd4912}` | 缺 |
| `/effects/1/maxUnits` | 5 |
| `/effects/1/minUnits` | 4 |
| `/effects/1/style` | 3 |
| `/effects/1/variables/AttackSpeedPerWantedKill` | 0.30000001192092896 |
| `/effects/1/variables/BaseDA` | 0.20000000298023224 |
| `/effects/1/variables/NumOfWantedEnemies` | 2.0 |
| `/effects/1/variables/PercentMaxHealthShield` | 0.20000000298023224 |
| `/effects/1/variables/{36b1550f}` | 缺 |
| `/effects/1/variables/{9edd4912}` | 缺 |
| `/effects/2/maxUnits` | 7 |
| `/effects/2/minUnits` | 6 |
| `/effects/2/style` | 5 |
| `/effects/2/variables/AttackSpeedPerWantedKill` | 0.30000001192092896 |
| `/effects/2/variables/BaseDA` | 0.33000001311302185 |
| `/effects/2/variables/NumOfWantedEnemies` | 4.0 |
| `/effects/2/variables/PercentMaxHealthShield` | 0.30000001192092896 |
| `/effects/2/variables/{36b1550f}` | 缺 |
| `/effects/2/variables/{9edd4912}` | 缺 |
| `/effects/3/maxUnits` | 9 |
| `/effects/3/minUnits` | 8 |
| `/effects/3/style` | 5 |
| `/effects/3/variables/AttackSpeedPerWantedKill` | 0.30000001192092896 |
| `/effects/3/variables/BaseDA` | 0.5 |
| `/effects/3/variables/NumOfWantedEnemies` | 5.0 |
| `/effects/3/variables/PercentMaxHealthShield` | 0.4000000059604645 |
| `/effects/3/variables/{36b1550f}` | 缺 |
| `/effects/3/variables/{9edd4912}` | 缺 |
| `/effects/4/maxUnits` | 25000 |
| `/effects/4/minUnits` | 10 |
| `/effects/4/style` | 6 |
| `/effects/4/variables/AttackSpeedPerWantedKill` | 0.30000001192092896 |
| `/effects/4/variables/BaseDA` | 1.5 |
| `/effects/4/variables/NumOfWantedEnemies` | 99.0 |
| `/effects/4/variables/PercentMaxHealthShield` | 1.0 |
| `/effects/4/variables/{36b1550f}` | 缺 |
| `/effects/4/variables/{9edd4912}` | 1.0 |

## 近似项与尚未具备的规则证据

- 数值展示将源浮点系数四舍五入到四位小数，与既有技能内容量化一致；AD/AP 换算随后使用整数基点与最终向下取整。
- `abilityDisplayValues` 仅展示基础属性/显式 AD/AP；未模拟目标抗性、暴击、队友数量或已累计的小炮成长。范德按每名队友增量展示，小炮累计成长为 0。
- 实验体字段取源值供解析；实验体尚未启用，不能把显示值作为运行时生效证据。
- Swain / Jayce / Gangplank 形态属性缺失，不以其他形态或其他英雄的属性替代。
- Conqueror 的羁绊记录包含 ADAPBase、StacksPerKill、PercentIncreasePerChest，但不包含宝箱阈值、掉落表及奖励抽取规则。是否允许仅战斗加成的有限实现需明确决定；本分支尚未启用。
- Academy 的羁绊记录有赞助装备个数和属性加成，没有赞助装备抽样池和发放时点。不能把整个普通装备池默认当成官方赞助池。
- Scrap 高档包含光明装备，按任务范围排除；不能为凑齐断点加入光明装备或转职。
- 本文件未声明任何新英雄或新阵营已经通过战斗验收。

## 可复现

`python3 scripts/audit-g2-2-source.py`：先校验原始字节长度和解压 SHA256，再生成源候选、Swain 全字段和展示源。
`npm test -- tests/g2-2-ability-display.test.ts`：SR-G2-01 原有 19 英雄 × 3 星占位符覆盖及独立公式样例。
