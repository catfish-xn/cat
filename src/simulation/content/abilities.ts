import { freezeContent } from './freeze';
/** Historical coefficients: three entries are 1/2/3-star. Ratios are fractions (1.25 = 125%); durations are seconds; amounts scale with AP/100 as described in source. Runtime must convert ratios to integer basis points before arithmetic. */
export interface S13AbilityData { readonly id: string; readonly championId: string; readonly variables: Readonly<Record<string, readonly [number,number,number]>>; readonly description: string }
export const S13_ABILITY_DATA: Readonly<Record<string,S13AbilityData>> = freezeContent({
  "irelia-ability": {
    "id": "irelia-ability",
    "championId": "irelia",
    "variables": {
      "ShieldDuration": [
        3,
        3,
        3
      ],
      "ShieldHealth": [
        400,
        475,
        575
      ],
      "StrikeBaseDamage": [
        70,
        100,
        150
      ],
      "PercentShieldDamage": [
        0.3,
        0.3,
        0.3
      ]
    },
    "description": "Enter a defensive stance and gain <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleAP%)</TFTBonus> Shield that rapidly decays over @ShieldDuration@ seconds. When it expires, deal <magicDamage>@ModifiedBaseStrikeDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage + <magicDamage>@PercentShieldDamage*100@%</magicDamage> of the damage absorbed to enemies around and in front of&nbsp;Irelia."
  },
  "maddie-ability": {
    "id": "maddie-ability",
    "championId": "maddie",
    "variables": {
      "PercentAttackDamage": [
        1.25,
        1.25,
        1.4
      ],
      "APDamage": [
        10,
        15,
        25
      ],
      "NumOfShots": [
        6,
        6,
        6
      ],
      "TotalSpellTime": [
        1.15,
        1.15,
        1.15
      ],
      "ShotsPerSimulatedLaunchAttack": [
        3,
        3,
        3
      ]
    },
    "description": "Fire @NumOfShots@ shots towards the farthest enemy that deal <physicalDamage>@TotalDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to the first enemy they&nbsp;hit."
  },
  "darius-ability": {
    "id": "darius-ability",
    "championId": "darius",
    "variables": {
      "BleedDuration": [
        4,
        4,
        4
      ],
      "PercentAttackDamage": [
        2.4,
        2.4,
        2.4
      ],
      "Heal": [
        150,
        175,
        200
      ],
      "BleedPercentAttackDamage": [
        2,
        2,
        2
      ]
    },
    "description": "Spin, dealing <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to adjacent enemies and healing <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleAP%)</scaleHealth>. Apply a <physicalDamage>@ModifiedBleedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage bleed to target over @BleedDuration@&nbsp;seconds."
  },
  "lux-ability": {
    "id": "lux-ability",
    "championId": "lux",
    "variables": {
      "Damage": [
        360,
        540,
        900
      ],
      "Shield": [
        160,
        180,
        240
      ],
      "ShieldDuration": [
        4,
        4,
        4
      ],
      "DamageReduction": [
        0.35,
        0.35,
        0.35
      ]
    },
    "description": "Grant <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleAP%)</TFTBonus> Shield to the lowest current Health ally. Lux's next attack deals <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> bonus magic&nbsp;damage."
  },
  "zyra-ability": {
    "id": "zyra-ability",
    "championId": "zyra",
    "variables": {
      "TargetDamage": [
        260,
        390,
        585
      ],
      "StunDuration": [
        1,
        1,
        1
      ],
      "AOEDamage": [
        95,
        140,
        215
      ],
      "NumSmallerVines": [
        2,
        2,
        2
      ]
    },
    "description": "Send vines towards the current target, Stunning them for @StunDuration@ second and dealing <magicDamage>@ModifiedTargetDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic&nbsp;damage. Then smaller vines seek out the @NumSmallerVines@ nearest enemies and deal <magicDamage>@ModifiedAOEDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to them.<br><br><spellActive enabled=TFT13_ExperimentActive alternate=rules>Experiment Bonus:<TFTBonus><ShowIfNot.TFT13_ExperimentActive></ShowIfNot.TFT13_ExperimentActive><ShowIf.TFT13_ExperimentActive></ShowIf.TFT13_ExperimentActive></TFTBonus> Ability damage bleeds enemies for <trueDamage enabled=TFT13_ExperimentActive alternate=rules>@TFTUnitProperty.:TFT13_ZyraCurrentExperimentBonus@%</trueDamage> bonus true damage over @ExperimentDuration@&nbsp;seconds.</spellActive>"
  },
  "tristana-ability": {
    "id": "tristana-ability",
    "championId": "tristana",
    "variables": {
      "PercentAttackDamage": [
        5.25,
        5.25,
        5.25
      ],
      "APDamage": [
        50,
        75,
        115
      ],
      "ASKillGain": [
        1.25,
        1.25,
        1.25
      ]
    },
    "description": "Fire a cannonball at target, dealing <physicalDamage>@TotalDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage. If they die, the cannonball ricochets to the nearest enemy, dealing the overkill damage. When it does, permanently gain <TFTBonus>@TFTUnitProperty.:TFT13_TristanaASPerStack@%</TFTBonus>&nbsp;Attack Damage.<br><br><TFTTrackerLabel>(Current Bonus:&nbsp;@TFTUnitProperty.:TFT13_TristanaASGain@% %i:scaleAD%) </TFTTrackerLabel> "
  },
  "urgot-ability": {
    "id": "urgot-ability",
    "championId": "urgot",
    "variables": {
      "PrimaryDamage": [
        3,
        3,
        3.3
      ],
      "SecondaryDamage": [
        1.5,
        1.5,
        1.65
      ],
      "Duration": [
        6,
        6,
        6
      ],
      "APDamage": [
        35,
        50,
        75
      ]
    },
    "description": "Fire an explosive charge, dealing <physicalDamage>@ModifiedPrimaryDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to target and <physicalDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to adjacent enemies. 20% <TFTKeyword>Sunder</TFTKeyword> all enemies hit for @Duration@&nbsp;seconds.<br><br><rules><tftbold>Sunder:</tftbold> Reduce Armor</rules><br><br><spellActive enabled=TFT13_ExperimentActive alternate=rules>Experiment Bonus:<TFTBonus><ShowIfNot.TFT13_ExperimentActive></ShowIfNot.TFT13_ExperimentActive><ShowIf.TFT13_ExperimentActive></ShowIf.TFT13_ExperimentActive></TFTBonus> Dash to targets. On cast, gain <TFTBonus enabled=TFT13_ExperimentActive alternate=rules>@TFTUnitProperty.:TFT13_UrgotCurrentExperimentBonusShield@%</TFTBonus> max Health Shield and <TFTBonus enabled=TFT13_ExperimentActive alternate=rules>@TFTUnitProperty.:TFT13_UrgotCurrentExperimentBonusAS@%</TFTBonus>&nbsp;Attack Speed for @ExperimentDuration@&nbsp;seconds.</spellActive>"
  },
  "rell-ability": {
    "id": "rell-ability",
    "championId": "rell",
    "variables": {
      "StabDamage": [
        120,
        180,
        270
      ],
      "DefenseStealDuration": [
        60,
        60,
        60
      ],
      "DefensesSteal": [
        10,
        12,
        15
      ],
      "ShieldDuration": [
        4,
        4,
        4
      ],
      "Shield": [
        300,
        350,
        400
      ]
    },
    "description": "Gain <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleAP%)</TFTBonus> Shield for @ShieldDuration@ seconds. Lance enemies in a line for <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage and steal <TFTBonus>@DefensesSteal@</TFTBonus> Armor and Magic Resist from enemies&nbsp;hit."
  },
  "leona-ability": {
    "id": "leona-ability",
    "championId": "leona",
    "variables": {
      "Duration": [
        3,
        3,
        3
      ],
      "Damage": [
        115,
        175,
        270
      ],
      "DR": [
        0.5,
        0.5,
        0.5
      ]
    },
    "description": "Fortify for @Duration@ seconds, gaining <TFTBonus>@ModifiedDurability@&nbsp;(%i:scaleAP%)</TFTBonus> Durability. Afterwards, deal <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to adjacent enemies."
  },
  "vander-ability": {
    "id": "vander-ability",
    "championId": "vander",
    "variables": {
      "TauntDuration": [
        2.5,
        2.5,
        2.5
      ],
      "Resists": [
        100,
        125,
        150
      ],
      "PercentAttackDamage": [
        4,
        4,
        4
      ],
      "BonusDamageADRatio": [
        1,
        1,
        1
      ]
    },
    "description": "Stop attacking and brace for @TauntDuration@ seconds, gaining <TFTBonus>@ModifiedDefenses@&nbsp;(%i:scaleAP%)</TFTBonus> Armor and Magic Resist. Vander's next attack is replaced with a strike that deals <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage, increased by <physicalDamage>@ModifiedBonusDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage for each 1 or 2 cost champion on your&nbsp;team. "
  },
  "kogmaw-ability": {
    "id": "kogmaw-ability",
    "championId": "kogmaw",
    "variables": {
      "MaxAS": [
        20,
        20,
        20
      ],
      "AttackSpeed": [
        0.25,
        0.25,
        0.25
      ],
      "Duration": [
        60,
        60,
        60
      ],
      "DamageOnAttack": [
        48,
        72,
        120
      ],
      "RangeIncreaseNumAttacks": [
        3,
        3,
        3
      ]
    },
    "description": "<spellPassive>Passive:</spellPassive> Attacks deal <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> bonus magic&nbsp;damage.<br><br><spellActive>Active:</spellActive> Gain <TFTBonus>@AttackSpeed*100@%</TFTBonus> stacking Attack Speed for the rest of combat. After every @RangeIncreaseNumAttacks@ casts, gain&nbsp;+1&nbsp;Range."
  },
  "scar-ability": {
    "id": "scar-ability",
    "championId": "scar",
    "variables": {
      "Heal": [
        220,
        240,
        270
      ],
      "NumEnemies": [
        3,
        3,
        3
      ],
      "StunDuration": [
        1.5,
        1.5,
        1.75
      ],
      "Damage": [
        80,
        120,
        180
      ]
    },
    "description": "Lob bombs at the nearest @NumEnemies@ enemies, Stunning them for <scaleLevel>@StunDuration@</scaleLevel> seconds and dealing <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to each. Heal <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleAP%)</scaleHealth>."
  },
  "ezreal-ability": {
    "id": "ezreal-ability",
    "championId": "ezreal",
    "variables": {
      "PercentAttackDamage": [
        1.35,
        1.35,
        1.35
      ],
      "APDamage": [
        20,
        30,
        50
      ],
      "PercentCenterDamage": [
        2.7,
        2.7,
        2.7
      ]
    },
    "description": "Fire a shot towards current target that deals <physicalDamage>@TotalDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to all enemies within 1 hex. Then, deal <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to the unit in the center of the&nbsp;blast.<br><br><br>"
  },
  "loris-ability": {
    "id": "loris-ability",
    "championId": "loris",
    "variables": {
      "Shield": [
        525,
        600,
        700
      ],
      "Damage": [
        150,
        225,
        360
      ],
      "PercentDamageRedirect": [
        0.5,
        0.5,
        0.5
      ],
      "Duration": [
        4,
        4,
        4
      ]
    },
    "description": "Gain <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleAP%)</TFTBonus> Shield for @Duration@ seconds. It redirects <TFTBonus>@PercentDamageRedirect*100@%</TFTBonus> of damage taken by adjacent allies. When it expires, deal <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage in a&nbsp;cone."
  },
  "nami-ability": {
    "id": "nami-ability",
    "championId": "nami",
    "variables": {
      "NumBounces": [
        3,
        3,
        3
      ],
      "Damage": [
        120,
        180,
        290
      ],
      "SearchRange": [
        3,
        3,
        3
      ],
      "TimesHitTarget": [
        1,
        1,
        1
      ]
    },
    "description": "Launch a wave at target that bounces @NumBounces@ times to enemies within @SearchRange@ hexes and deals <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic&nbsp;damage."
  },
  "corki-ability": {
    "id": "corki-ability",
    "championId": "corki",
    "variables": {
      "BaseMissiles": [
        21,
        21,
        35
      ],
      "PercentAD": [
        0.35,
        0.35,
        0.6
      ],
      "FlatArmorShred": [
        1,
        1,
        1
      ],
      "SpecialMissileNum": [
        7,
        7,
        7
      ],
      "SpecialMissileMult": [
        7,
        7,
        7
      ],
      "MissilesPerLaunchAttack": [
        5,
        5,
        5
      ],
      "FlatDamagePerMissile": [
        6,
        9,
        36
      ]
    },
    "description": "Lock onto target and strafe to a nearby position, unleashing <scaleLevel>@BaseMissiles@</scaleLevel> missiles split between the target and all enemies within two hexes. Each missile deals <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage and reduces Armor by&nbsp;@FlatArmorShred@.<br><br>Every @SpecialMissileNum@th missile deals <physicalDamage>@ModifiedSpecialDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage and reduces Armor by&nbsp;@SpecialMissileArmorReduction@."
  },
  "garen-ability": {
    "id": "garen-ability",
    "championId": "garen",
    "variables": {
      "APShield": [
        200,
        220,
        1500
      ],
      "PercentHealthShield": [
        0.15,
        0.15,
        0.15
      ],
      "ShieldDuration": [
        4,
        4,
        4
      ],
      "ADRatio": [
        2.5,
        2.5,
        15
      ],
      "SecondaryADRatio": [
        1.25,
        1.25,
        7.5
      ],
      "HealPercentHealth": [
        0.015,
        0.015,
        0.05
      ]
    },
    "description": "<spellPassive>Passive:</spellPassive> After dealing damage, heal <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleHealth%).</scaleHealth><br><br><spellActive>Active:</spellActive> Gain <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleHealth%%i:scaleAP%)</TFTBonus> Shield for @ShieldDuration@ seconds. Slam a massive sword on target, dealing <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to them and <physicalDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to enemies within 2&nbsp;hexes. "
  },
  "zoe-ability": {
    "id": "zoe-ability",
    "championId": "zoe",
    "variables": {
      "Damage": [
        140,
        210,
        450
      ],
      "NumRepeats": [
        2,
        2,
        4
      ],
      "HexLimiter": [
        4,
        4,
        4
      ]
    },
    "description": "Launch a star at target that deals <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage. It bounces to the farthest enemy within @HexLimiter@ hexes, then bounces back to the target. This effect repeats @NumRepeats@ times, hitting a different enemy each&nbsp;time."
  },
  "caitlyn-ability": {
    "id": "caitlyn-ability",
    "championId": "caitlyn",
    "variables": {
      "RaidDuration": [
        5,
        5,
        5
      ],
      "TotalShots": [
        4,
        4,
        20
      ],
      "PercentAttackDamage": [
        1.8,
        1.8,
        7.5
      ],
      "APDamage": [
        20,
        30,
        100
      ],
      "HeadshotPercentAD": [
        2.8,
        2.8,
        13.5
      ],
      "BonusSearchRange": [
        630,
        630,
        630
      ],
      "PercentShotsFocusedOnFrontline": [
        0.5,
        0.5,
        0.5
      ],
      "ResistReduction": [
        20,
        20,
        20
      ]
    },
    "description": "Enter a sniper's stance and call in an airship that circles the battlefield for @RaidDuration@ seconds, dropping @TotalShots@ bombs at a random cluster of enemies over the duration. Bombs deal <physicalDamage>@TotalDamage@&nbsp;(%i:scaleAD%&nbsp;%i:scaleAP%)</physicalDamage> physical damage in a one-hex&nbsp;circle.<br><br>Whenever an enemy is caught in the epicenter of an Air Raid blast, reduce their Armor and Magic Resist by @ResistReduction@ and fire a shot towards them, dealing <physicalDamage>@HeadshotDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical&nbsp;damage."
  }
});
