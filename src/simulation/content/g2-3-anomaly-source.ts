// G2-3: hash-locked 14.24 source + explicitly documented 14.24b overrides.
import { freezeContent } from './freeze';
export const G23_ANOMALY_SOURCE = freezeContent({
  "fortified": {
    "pointer": "{0ce70b6f}",
    "sourceName": "TFT13_GoopBuff_Fortified",
    "titleKey": "TFT13_GoopBuff_Fortified_Title",
    "descriptionKey": "TFT13_SetMechanic_EvolveBuff_MaxHealth_Temp",
    "name": "Fortified",
    "description": "Gain @HealthPercent*100@% max Health. Every @ReapplyTimer@ seconds, gain another @HealthGrow*100@% (up to @StackCap@ times).",
    "zhName": "坚不可破",
    "zhDescription": "获得@HealthPercent*100@%最大生命值。每@ReapplyTimer@秒，获得另外的@HealthGrow*100@%(至多至@StackCap@次)。",
    "values": {
      "HealthPercent": 0.12,
      "ReapplyTimer": 4.0,
      "HealthGrow": 0.12,
      "StackCap": 5.0
    }
  },
  "comeback-story": {
    "pointer": "{c88fbc1e}",
    "sourceName": "TFT13_GoopBuff_ComebackStory",
    "titleKey": "TFT13_GoopBuff_ComebackStory_Title",
    "descriptionKey": "TFT13_GoopBuff_ComebackStory_Description",
    "name": "Comeback Story",
    "description": "Gain @DamageAmp*100@% Damage Amp for every @PerHealthAmount@ player health you have lost this game.",
    "zhName": "翻盘故事",
    "zhDescription": "你在这局游戏每失去@PerHealthAmount@生命值，就会获得@DamageAmp*100@%伤害增幅。",
    "values": {
      "PerHealthAmount": 10.0,
      "DamageAmp": 0.05
    }
  },
  "titanic-strikes": {
    "pointer": "{12b5bb88}",
    "sourceName": "TFT13_GoopBuff_TitanicStrikes",
    "titleKey": "TFT13_GoopBuff_TitanicStrikes_Title",
    "descriptionKey": "TFT13_GoopBuff_TitanicStrikes_Description",
    "name": "Titanic Strikes",
    "description": "Attacks deal an additional @ADRatio*100@% Attack Damage to the target and adjacent enemies. ",
    "zhName": "泰坦打击",
    "zhDescription": "攻击对目标和邻格敌人们造成@ADRatio*100@%攻击力的额外伤害。 ",
    "values": {
      "ADRatio": 0.4
    }
  },
  "bulwark": {
    "pointer": "{1ff92847}",
    "sourceName": "TFT13_GoopBuff_Bulwark",
    "titleKey": "TFT13_GoopBuff_Bulwark_Title",
    "descriptionKey": "TFT13_SetMechanic_EvolveBuff_Bulwark_TRA",
    "name": "Bulwark",
    "description": "Gain @BonusArmor@ Armor & @BonusMR@ Magic Resist. Triple it when above @HealthThreshold@% health.",
    "zhName": "壁垒",
    "zhDescription": "获得@BonusArmor@护甲和@BonusMR@魔法抗性。生命值高于@HealthThreshold@%时，这个加成变为3倍。",
    "values": {
      "BonusArmor": 40.0,
      "BonusMR": 40.0,
      "HealthThreshold": 50.0
    }
  },
  "defense-expert": {
    "pointer": "{22252ea4}",
    "sourceName": "TFT13_GoopBuff_HardenedMind",
    "titleKey": "TFT13_GoopBuff_HardenedMind_Title",
    "descriptionKey": "TFT13_GoopBuff_HardenedMind_Description",
    "name": "Defense Expert",
    "description": "This champion gains @PctBonusResists@% more Armor and Magic Resist from all sources.",
    "zhName": "防御专家",
    "zhDescription": "这个弈子获得@PctBonusResists@%额外护甲与魔抗(来自所有来源)。",
    "values": {
      "PctBonusResists": 66.0
    }
  },
  "slime-time": {
    "pointer": "{69305384}",
    "sourceName": "TFT13_GoopBuff_SlimeTime",
    "titleKey": "TFT13_GoopBuff_SlimeTime_Title",
    "descriptionKey": "TFT13_GoopBuff_SlimeTime_Description",
    "name": "Slime Time",
    "description": "Every @Period@ seconds, deal @APRatio*100@% (%i:scaleAP%) magic damage in a 1-hex radius and heal this champion for @HealRatio*100@% of damage dealt.",
    "zhName": "史莱姆时间",
    "zhDescription": "每过@Period@秒，对半径1格内的敌人造成@APRatio*100@% (%i:scaleAP%)魔法伤害并为该弈子回复相当于@HealRatio*100@%造成伤害的生命值。",
    "values": {
      "Period": 2.0,
      "APRatio": 1.3,
      "HealRatio": 1.0
    }
  },
  "mage-armor": {
    "pointer": "{37bc263a}",
    "sourceName": "TFT13_GoopBuff_MageArmor",
    "titleKey": "TFT13_GoopBuff_MageArmor_Title",
    "descriptionKey": "TFT13_GoopBuff_MageArmor_Description",
    "name": "Mage Armor",
    "description": "Gain Armor and Magic Resist equal to @PercentAPToDefenses*100@% of Ability Power.",
    "zhName": "法师护甲",
    "zhDescription": "获得相当于@PercentAPToDefenses*100@%法术强度的护甲与魔抗。",
    "values": {
      "PercentAPToDefenses": 0.5
    }
  },
  "freestyling": {
    "pointer": "{3aecae57}",
    "sourceName": "TFT13_GoopBuff_Freestyling",
    "titleKey": "TFT13_GoopBuff_Freestyling_Title",
    "descriptionKey": "TFT13_SetMechanic_EvolveBuff_Freestyling_TRA",
    "name": "Freestyling",
    "description": "Gain @PercentDamage*100@% Damage Amp for each activated non-unique trait you have.",
    "zhName": "即兴发挥",
    "zhDescription": "你每激活一个非唯一的羁绊，就会获得@PercentDamage*100@%伤害增幅。",
    "values": {
      "PercentDamage": 0.045
    }
  },
  "legacy-of-shurima": {
    "pointer": "{407feb18}",
    "sourceName": "TFT13_GoopBuff_LegacyOfShurima",
    "titleKey": "TFT13_GoopBuff_LegacyOfShurima_Title",
    "descriptionKey": "TFT13_GoopBuff_LegacyOfShurima_Description",
    "name": "Legacy Of Shurima",
    "description": "After @Duration@ seconds of combat, ascend, gaining @MaxHPRatio*100@% max Health and @ASRatio*100@% Attack Speed",
    "zhName": "恕瑞玛的传承",
    "zhDescription": "在战斗@Duration@秒后，飞升，从而获得@MaxHPRatio*100@%最大生命值和@ASRatio*100@%攻击速度",
    "values": {
      "Duration": 10.0,
      "MaxHPRatio": 0.5,
      "ASRatio": 0.6
    }
  },
  "power-absorption": {
    "pointer": "{5a58cd97}",
    "sourceName": "TFT13_GoopBuff_PowerAbsorption",
    "titleKey": "TFT13_GoopBuff_PowerAbsorption_Title",
    "descriptionKey": "TFT13_GoopBuff_PowerAbsorption_Description",
    "name": "Power Absorption",
    "description": "Gain @UpfrontAD*100@% Attack Damage. Each time an ally dies, gain @BonusAD*100@% of their Attack Damage.",
    "zhName": "攻击吸收",
    "zhDescription": "获得@UpfrontAD*100@%攻击力。每当一名友方弈子阵亡时，获得其@BonusAD*100@%攻击力。",
    "values": {
      "BonusAD": 0.09,
      "UpfrontAD": 0.3
    }
  },
  "energy-absorption": {
    "pointer": "{632c4258}",
    "sourceName": "TFT13_GoopBuff_EnergyAbsorption",
    "titleKey": "TFT13_GoopBuff_EnergyAbsorption_Title",
    "descriptionKey": "TFT13_GoopBuff_EnergyAbsorption_Description",
    "name": "Energy Absorption",
    "description": "Gain @UpfrontAP@ Ability Power. Each time an ally dies, gain @BonusAP*100@% of their Ability Power.",
    "zhName": "法强吸收",
    "zhDescription": "获得@UpfrontAP@法术强度。每当一名友方弈子阵亡时，获得其@BonusAP*100@%法术强度。",
    "values": {
      "BonusAP": 0.05,
      "UpfrontAP": 30.0
    }
  },
  "arcana-overwhelming": {
    "pointer": "{63474fba}",
    "sourceName": "TFT13_GoopBuff_ArcanaOverwhelming",
    "titleKey": "TFT13_GoopBuff_ArcanaOverwhelming_Title",
    "descriptionKey": "TFT13_GoopBuff_ArcanaOverwhelming_Description",
    "name": "Arcana Overwhelming",
    "description": "Gain %i:scaleAP% Ability Power equal to @MRPercent*100@% of Magic Resist. Gain @BonusMR@ Magic Resist.",
    "zhName": "奥术浩荡",
    "zhDescription": "获得相当于@MRPercent*100@%魔抗的%i:scaleAP%法术强度。获得@BonusMR@魔抗。",
    "values": {
      "MRPercent": 0.25,
      "BonusMR": 65.0
    }
  },
  "avalanche-of-armor": {
    "pointer": "{6360b322}",
    "sourceName": "TFT13_GoopBuff_AvalancheofArmor",
    "titleKey": "TFT13_GoopBuff_AvalancheofArmor_Title",
    "descriptionKey": "TFT13_GoopBuff_AvalancheofArmor_Description",
    "name": "Avalanche of Armor",
    "description": "Gain %i:scaleAD% Attack Damage equal to @ArmorPercent*100@% of Armor. Gain @BonusArmor@ %i:scaleArmor% Armor.",
    "zhName": "护甲山崩",
    "zhDescription": "获得相当于@ArmorPercent*100@%护甲的%i:scaleAD%攻击力。获得@BonusArmor@ %i:scaleArmor%护甲。",
    "values": {
      "ArmorPercent": 0.3,
      "BonusArmor": 50.0
    }
  },
  "giant-sized": {
    "pointer": "{6d87cae9}",
    "sourceName": "TFT13_GoopBuff_GiantSized",
    "titleKey": "TFT13_GoopBuff_GiantSized_Title",
    "descriptionKey": "TFT13_GoopBuff_GiantSized_Description",
    "name": "Giant-Sized",
    "description": "Gain @BonusHP@ Health and grow greatly in size.",
    "zhName": "巨人体型",
    "zhDescription": "获得@BonusHP@生命值并且体型获得极大提升。",
    "values": {
      "BonusHP": 1000.0,
      "{88bfedc3}": 1.8
    }
  },
  "deep-roots": {
    "pointer": "{72825068}",
    "sourceName": "TFT13_GoopBuff_DeepRoots",
    "titleKey": "TFT13_GoopBuff_DeepRoots_Title",
    "descriptionKey": "TFT13_GoopBuff_DeepRoots_Description",
    "name": "Deep Roots",
    "description": "Gain @BonusHealth@ Health, @BonusArmor@ Armor, and @BonusMagicResist@ Magic Resist. They cannot move or be stunned, and pull their target into range.",
    "zhName": "根深蒂固",
    "zhDescription": "获得@BonusHealth@生命值、@BonusArmor@护甲和@BonusMagicResist@魔抗。该弈子无法移动或被晕眩，并且会将其目标拉入攻击距离内。",
    "values": {
      "BonusHealth": 700.0,
      "BonusMagicResist": 25.0,
      "BonusArmor": 25.0
    }
  },
  "eagle-eye": {
    "pointer": "{6f0d7c18}",
    "sourceName": "TFT13_GoopBuff_EagleEye",
    "titleKey": "TFT13_GoopBuff_EagleEye_Title",
    "descriptionKey": "TFT13_SetMechanic_EvolveBuff_EagleEye_TRA",
    "name": "Eagle Eye",
    "description": "Gain +@BonusRange@ Range. Every @Time@ seconds this champion doesn't move, gain @BonusAD*100@% Attack Damage.",
    "zhName": "鹰眼",
    "zhDescription": "获得+@BonusRange@距离。该英雄每静止不动@Time@秒，获得@BonusAD*100@%攻击力。",
    "values": {
      "BonusAD": 0.06,
      "BonusRange": 1.0,
      "Time": 2.0
    }
  },
  "laser-eyes": {
    "pointer": "{92afad54}",
    "sourceName": "TFT13_GoopBuff_LaserEyes",
    "titleKey": "TFT13_GoopBuff_LaserEyes_Title",
    "descriptionKey": "TFT13_GoopBuff_LaserEyes_Description",
    "name": "Laser Eyes",
    "description": "Constantly deal @PercentAP*100@% Ability Power magic damage per second in a 3-hex line and <TFTKeyword>Burn</TFTKeyword> enemies for @BurnDuration@ seconds.",
    "zhName": "镭射眼",
    "zhDescription": "在一个3格长的直线区域内持续造成每秒@PercentAP*100@%法术强度的魔法伤害并对敌人们施加持续@BurnDuration@秒的<TFTKeyword>灼烧</TFTKeyword>。",
    "values": {
      "PercentAP": 1.0,
      "BurnDuration": 3.0,
      "{ba858240}": 700.0
    }
  },
  "magic-training": {
    "pointer": "{940bfd62}",
    "sourceName": "TFT13_GoopBuff_MagicTraining",
    "titleKey": "TFT13_GoopBuff_MagicTraining_Title",
    "descriptionKey": "TFT13_SetMechanic_EvolveBuff_TeamAP_Temp",
    "name": "Magic Training",
    "description": "Gain @BonusAP@ Ability Power. On cast, your team gains @APPerStack@ Ability Power for every @PerManaSpent@ Mana spent.",
    "zhName": "魔法训练",
    "zhDescription": "获得@BonusAP@法术强度。在施放技能时，每消耗@PerManaSpent@法力值，己方弈子们就会获得@APPerStack@法术强度。",
    "values": {
      "BonusAP": 15.0,
      "APPerStack": 2.0,
      "PerManaSpent": 20.0
    }
  },
  "one-thousand-cuts": {
    "pointer": "{a4626aa4}",
    "sourceName": "TFT13_GoopBuff_OneThousandCuts",
    "titleKey": "TFT13_GoopBuff_OneThousandCuts_Title",
    "descriptionKey": "TFT13_GoopBuff_OneThousandCuts_Description",
    "name": "One Thousand Cuts",
    "description": "Attacks deal @BaseTrueDamage@ bonus true damage, plus @BonusTrueDamage@ true damage for each time the target was damaged by this effect.",
    "zhName": "千刀斩",
    "zhDescription": "攻击造成@BaseTrueDamage@额外真实伤害，并且目标每次受到这个效果的伤害时，这个真实伤害的数额就会提升@BonusTrueDamage@。",
    "values": {
      "BonusTrueDamage": 12.0,
      "BaseTrueDamage": 30.0
    }
  },
  "bully": {
    "pointer": "{b910fc7b}",
    "sourceName": "TFT13_GoopBuff_Bully",
    "titleKey": "TFT13_GoopBuff_Bully_Title",
    "descriptionKey": "TFT13_GoopBuff_Bully_Description",
    "name": "Bully",
    "description": "Gain @BonusDamage*100@% Damage Amp, increased to 36% against units with a lower star level.",
    "zhName": "恃强凌弱",
    "zhDescription": "获得@BonusDamage*100@%伤害增幅，在对抗星级更低的弈子时，这个加成会提升至36%。",
    "values": {
      "BonusDamage": 0.12,
      "{7825099b}": 0.24
    }
  },
  "force-of-friendship": {
    "pointer": "{bdc62901}",
    "sourceName": "TFT13_GoopBuff_AllForOne",
    "titleKey": "TFT13_GoopBuff_AllForOne_Title",
    "descriptionKey": "TFT13_GoopBuff_AllForOne_Description",
    "name": "Force of Friendship",
    "description": "Gain @DamageAmp*100@% Damage Amp for each star level on your board. Three-star champions grant @ThreeStarBonus@% Damage Amp instead.",
    "zhName": "友谊之力",
    "zhDescription": "获得伤害增幅，数额为@DamageAmp*100@%x你场上的总星级。3星英雄则转而提供@ThreeStarBonus@%伤害增幅。",
    "values": {
      "DamageAmp": 0.01,
      "ThreeStarBonus": 8.0
    }
  },
  "berserker-rage": {
    "pointer": "{bed1f92f}",
    "sourceName": "TFT13_GoopBuff_BerserkerRage",
    "titleKey": "TFT13_GoopBuff_BerserkerRage_Title",
    "descriptionKey": "TFT13_SetMechanic_EvolveBuff_Blue_FIghterRole_TRA",
    "name": "Berserker Rage",
    "description": "Gain @BonusAP@ Ability Power & @BonusAD@% Attack Damage. Triple it when below @HealthThreshold@% Health.",
    "zhName": "狂战之怒",
    "zhDescription": "获得@BonusAP@法术强度和@BonusAD@%攻击力。生命值低于@HealthThreshold@%时，这个加成变为3倍。",
    "values": {
      "BonusAD": 25.0,
      "BonusAP": 25.0,
      "HealthThreshold": 50.0
    }
  },
  "hypervelocity": {
    "pointer": "{c0c710f6}",
    "sourceName": "TFT13_GoopBuff_Hypervelocity",
    "titleKey": "TFT13_GoopBuff_Hypervelocity_Title",
    "descriptionKey": "TFT13_SetMechanic_EvolveBuff_Blue_CasterRole_TRA",
    "name": "Hypervelocity",
    "description": "Gain @ASBonus*100@% Attack Speed. On cast, gain @ASOnCast*100@% stacking Attack Speed for the rest of combat.",
    "zhName": "超高速",
    "zhDescription": "获得@ASBonus*100@%攻击速度。施放时，获得@ASOnCast*100@%可叠加的攻击速度，持续至战斗环节结束。",
    "values": {
      "ASBonus": 0.1,
      "ASOnCast": 0.15
    }
  },
  "slow-cooker": {
    "pointer": "{c348d5f3}",
    "sourceName": "TFT13_GoopBuff_SlowCooker",
    "titleKey": "TFT13_GoopBuff_SlowCooker_Title",
    "descriptionKey": "TFT13_GoopBuff_SlowCooker_Description",
    "name": "Slow Cooker",
    "description": "Every second, deal magic damage in a @HexRadiusBase@-hex radius equal to @HealthRatio*100@% of their max Health. Radius increases every @Period@ seconds.",
    "zhName": "慢炖",
    "zhDescription": "每秒，在一个半径@HexRadiusBase@格的区域内造成魔法伤害，数额相当于其@HealthRatio*100@%最大生命值。半径每@Period@秒提升一次。",
    "values": {
      "HealthRatio": 0.03,
      "HexRadiusBase": 1.0,
      "Period": 6.0,
      "{52d3e690}": 1.0
    }
  },
  "protective-shielding": {
    "pointer": "{c5853a3c}",
    "sourceName": "TFT13_GoopBuff_ShouldertheBurden",
    "titleKey": "TFT13_GoopBuff_ShoulderTheBurden_Title",
    "descriptionKey": "TFT13_SetMechanic_EvolveBuff_Blue_TankRole",
    "name": "Protective Shielding",
    "description": "Combat Start and every @ShieldTimer@ seconds: Grant @PercentHealth*100@% max Health Shield to self and @AlliesNumber@ lowest health allies for @ShieldDuration@ seconds.",
    "zhName": "防御型护盾",
    "zhDescription": "战斗开始和每@ShieldTimer@秒：为自身以及生命值最低的@AlliesNumber@名友军提供相当于@PercentHealth*100@%最大生命值的护盾值，持续@ShieldDuration@秒。",
    "values": {
      "PercentHealth": 0.12,
      "AlliesNumber": 2.0,
      "ShieldTimer": 8.0,
      "ShieldDuration": 4.0
    }
  },
  "magic-expert": {
    "pointer": "{cce07bcc}",
    "sourceName": "TFT13_GoopBuff_MagicMind",
    "titleKey": "TFT13_GoopBuff_MagicMind_Title",
    "descriptionKey": "TFT13_GoopBuff_MagicMind_Description",
    "name": "Magic Expert",
    "description": "This champion gains @PctBonusAP@% more Ability Power from all sources.",
    "zhName": "魔法专家",
    "zhDescription": "这个弈子获得@PctBonusAP@%额外法术强度(来自所有来源)。",
    "values": {
      "PctBonusAP": 40.0
    }
  },
  "attack-expert": {
    "pointer": "{d2290efa}",
    "sourceName": "TFT13_GoopBuff_SharpenedMind",
    "titleKey": "TFT13_GoopBuff_SharpenedMind_Title",
    "descriptionKey": "TFT13_GoopBuff_SharpenedMind_Description",
    "name": "Attack Expert",
    "description": "This champion gains @PctBonusAD@% more Attack Damage from all sources.",
    "zhName": "物理专家",
    "zhDescription": "这个弈子获得@PctBonusAD@%额外攻击力(来自所有来源)。",
    "values": {
      "PctBonusAD": 55.0
    }
  },
  "strength-training": {
    "pointer": "{e8542136}",
    "sourceName": "TFT13_GoopBuff_StrengthTraining",
    "titleKey": "TFT13_GoopBuff_StrengthTraining_Title",
    "descriptionKey": "TFT13_SetMechanic_EvolveBuff_TeamAD_Temp",
    "name": "Strength Training",
    "description": "Gain @BonusAD@% Attack Damage. Every @NumAttacks@ times they attack, your team gains @ADPerStack@% Attack Damage.",
    "zhName": "力量训练",
    "zhDescription": "获得@BonusAD@%攻击力。每进行@NumAttacks@次攻击，己方弈子们就会获得@ADPerStack@%攻击力。",
    "values": {
      "BonusAD": 20.0,
      "ADPerStack": 4.0,
      "NumAttacks": 3.0
    }
  },
  "kill-streak": {
    "pointer": "{ee8859af}",
    "sourceName": "TFT13_GoopBuff_KillStreak",
    "titleKey": "TFT13_GoopBuff_KillStreak_Title",
    "descriptionKey": "TFT13_SetMechanic_EvolveBuff_Blue_ReaperRole_TRA",
    "name": "Kill Streak",
    "description": "Gain @ManaAmount@ Mana each kill.",
    "zhName": "连杀",
    "zhDescription": "每次击杀获得@ManaAmount@法力值。",
    "values": {
      "ManaAmount": 20.0
    }
  },
  "heavy-hitter": {
    "pointer": "{f15c3e18}",
    "sourceName": "TFT13_GoopBuff_HeavyHitter",
    "titleKey": "TFT13_GoopBuff_HeavyHitter_Title",
    "descriptionKey": "TFT13_GoopBuff_HeavyHitter_Description",
    "name": "Heavy Hitter",
    "description": "Attacks deal bonus physical damage equal to @HealthToDamagePercent*100@% of this champion's max Health. (Cooldown: @Cooldown@ seconds)",
    "zhName": "重量级打击手",
    "zhDescription": "攻击造成额外物理伤害，相当于这个弈子的@HealthToDamagePercent*100@%最大生命值。(冷却时间：@Cooldown@秒)",
    "values": {
      "HealthToDamagePercent": 0.2,
      "Cooldown": 2.5
    }
  }
});
