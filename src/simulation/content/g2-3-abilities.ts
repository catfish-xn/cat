// G2-3: hash-locked 14.24 source + explicitly documented 14.24b overrides.
import { freezeContent } from './freeze';
import type { S13AbilityData } from './abilities';
export const G23_ABILITIES: Readonly<Record<string, S13AbilityData>> = freezeContent({
  "renata-ability": {
    "id": "renata-ability",
    "championId": "renata",
    "name": "Loyalty Program",
    "description": "Fire a pair of missiles at target. Allies they pass through gain <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleAP%)</TFTBonus> Shield for @ShieldDuration@ seconds. When they collide, they deal <magicDamage>@ModifiedTargetDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to target and <magicDamage>@ModifiedExplosionDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to adjacent&nbsp;enemies.  ",
    "variables": {
      "Shield": [
        95.0,
        120.0,
        150.0
      ],
      "ShieldDuration": [
        3.0,
        3.0,
        3.0
      ],
      "TargetDamage": [
        310.0,
        465.0,
        700.0
      ],
      "ExplosionDamage": [
        155.0,
        230.0,
        350.0
      ],
      "AdditionalSearchDistance": [
        150.0,
        150.0,
        150.0
      ]
    }
  },
  "silco-ability": {
    "id": "silco-ability",
    "championId": "silco",
    "name": "Canned Monstrosity",
    "description": "Throw a canister at target, dealing <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to them and releasing <scaleLevel>@MinionsSpawned@</scaleLevel> monstrosities. Monstrosities attack @MinionNumAttacks@ times and deal <magicDamage>@ModifiedMinionDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage per&nbsp;attack.",
    "variables": {
      "Damage": [
        100.0,
        200.0,
        1000.0
      ],
      "MinionsSpawned": [
        4.0,
        4.0,
        8.0
      ],
      "MinionsThatAttackCurrentTarget": [
        2.0,
        2.0,
        4.0
      ],
      "MinionDamage": [
        36,
        55,
        100
      ],
      "MinionDuration": [
        12.0,
        12.0,
        12.0
      ],
      "MinionNumAttacks": [
        5.0,
        5.0,
        5.0
      ]
    }
  },
  "drmundo-ability": {
    "id": "drmundo-ability",
    "championId": "drmundo",
    "name": "Maximum Dosage",
    "description": "Become energized and heal <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleHealth%%i:scaleAP%)</scaleHealth> over @Duration@ seconds. While energized, deal <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to a nearby enemy each second. Afterwards, deal <magicDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleHealth%)</magicDamage> magic damage to all enemies within 2&nbsp;hexes.<br><br><spellActive enabled=TFT13_ExperimentActive alternate=rules>Experiment Bonus: <TFTBonus><ShowIfNot.TFT13_ExperimentActive></ShowIfNot.TFT13_ExperimentActive><ShowIf.TFT13_ExperimentActive></ShowIf.TFT13_ExperimentActive></TFTBonus>Gain <scaleHealth enabled=TFT13_ExperimentActive alternate=rules>@TFTUnitProperty.:TFT13_DrMundoBaseHealthExperimentBonus@</scaleHealth> max Health. On each takedown, gain <scaleHealth enabled=TFT13_ExperimentActive alternate=rules>@TFTUnitProperty.:TFT13_DrMundoCurrentExperimentBonus@</scaleHealth> more max&nbsp;Health.</spellActive>",
    "variables": {
      "PercentHealthHeal": [
        0.18,
        0.18,
        0.18
      ],
      "APHeal": [
        650.0,
        750.0,
        2500.0
      ],
      "PercentofHealImmediately": [
        0.4,
        0.4,
        0.4
      ],
      "Duration": [
        2.0,
        2.0,
        2.0
      ],
      "APDamage": [
        120.0,
        180.0,
        1000.0
      ],
      "PercentHealthDamage": [
        0.07,
        0.07,
        0.35
      ],
      "ExperimentHealthGain": [
        60.0,
        60.0,
        60.0
      ],
      "BaseExperimentHealthGain": [
        120.0,
        120.0,
        120.0
      ]
    }
  },
  "cassiopeia-ability": {
    "id": "cassiopeia-ability",
    "championId": "cassiopeia",
    "name": "Thorned Miasma",
    "description": "Blast target for <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage. Every third cast, splash miasma to @BonusNumEnemies@ enemies within @HexRadius@ hexes, dealing <magicDamage>@ModifiedMiasmaDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to&nbsp;each.",
    "variables": {
      "Damage": [
        230.0,
        345.0,
        550.0
      ],
      "MiasmaDamage": [
        160.0,
        240.0,
        385.0
      ],
      "BonusNumEnemies": [
        2.0,
        2.0,
        2.0
      ],
      "NumCasts": [
        3.0,
        3.0,
        3.0
      ],
      "HexRadius": [
        3.0,
        3.0,
        3.0
      ]
    }
  },
  "elise-ability": {
    "id": "elise-ability",
    "championId": "elise",
    "name": "Cocoon",
    "description": "Jump to a nearby hex and web all enemies within @HexRadius@ hexes, Stunning them for @StunDuration@ seconds and dealing <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage. Heal <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleAP%)</scaleHealth>.",
    "variables": {
      "StunDuration": [
        1.75,
        2.0,
        8.0
      ],
      "SearchRange": [
        2.0,
        2.0,
        2.0
      ],
      "Damage": [
        120.0,
        180.0,
        1200.0
      ],
      "HexRadius": [
        2.0,
        2.0,
        2.0
      ],
      "FlatHealth": [
        400.0,
        450.0,
        2000.0
      ]
    }
  },
  "elise-ranged-ability": {
    "id": "elise-ranged-ability",
    "championId": "elise-ranged",
    "name": "Volatile Spiderlings",
    "description": "Send spiderlings towards the @NumOfSpiders@ nearest enemies that explode on contact, dealing <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to the target and <magicDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage around them.",
    "variables": {
      "NumOfSpiders": [
        4.0,
        4.0,
        4.0
      ],
      "MagicDamage": [
        200.0,
        300.0,
        900.0
      ],
      "SecondaryDamage": [
        70.0,
        105.0,
        400.0
      ],
      "DotDuration": [
        6.0,
        6.0,
        6.0
      ]
    }
  },
  "jayce-ability": {
    "id": "jayce-ability",
    "championId": "jayce",
    "name": "Special Delivery",
    "description": "<spellPassive>Passive:</spellPassive> Summon a placeable Hextech Forge. On cast, the @NumAlliesShield@ allies closest to it gain <TFTBonus>@ModifiedShield@&nbsp;(%i:scaleAP%)</TFTBonus> Shield for @ShieldDuration@ seconds. If it's dead, revive it with <TFTBonus>@ReducedSummonHealth*100@%</TFTBonus>&nbsp;Health.<br><br><spellActive>Active:</spellActive> Summon 2 Hexgates and knock target into one of them, dealing <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage and sending them flying back to their original position. While flying, they deal <physicalDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to all other enemies in the&nbsp;path.",
    "variables": {
      "PercentAttackDamage": [
        5.0,
        5.0,
        20.0
      ],
      "PercentADSecondaryDamage": [
        2.25,
        2.25,
        15.0
      ],
      "NumAlliesShield": [
        3.0,
        3.0,
        3.0
      ],
      "Shield": [
        200.0,
        275.0,
        1800.0
      ],
      "ShieldDuration": [
        4.0,
        4.0,
        4.0
      ],
      "InitialGateDistanceBehindTheTarget": [
        480.0,
        480.0,
        480.0
      ],
      "EnemyFlightDuration": [
        0.75,
        0.75,
        0.75
      ],
      "FlyingEnemyDamageRadius": [
        290.0,
        290.0,
        290.0
      ],
      "MaxEnemySpeed": [
        2300.0,
        2300.0,
        2300.0
      ],
      "MinEnemySpeed": [
        1650.0,
        1650.0,
        1650.0
      ],
      "ReducedSummonHealth": [
        1.0,
        1.0,
        1.0
      ]
    }
  },
  "jayce-ranged-ability": {
    "id": "jayce-ranged-ability",
    "championId": "jayce-ranged",
    "name": "Hexcrystal Destruction",
    "description": "<spellPassive>Passive:</spellPassive> Summon a placeable Hextech Forge. On cast, the @NumAlliesAS@ allies closest to it gain <TFTBonus>@ModifiedAttackSpeed@&nbsp;(%i:scaleAP%)</TFTBonus> Attack Speed for @ASDuration@ seconds. If it's dead, revive it with <TFTBonus>@ReducedSummonHealth*100@%</TFTBonus>&nbsp;Health.<br><br><spellActive>Active:</spellActive> Throw unstable crystals at the @NumOfCrystals@ nearest enemies. Deal <physicalDamage>@ModifiedTargetDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to the nearest enemy, causing a chain reaction of explosions that deal <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to enemies within 1 hex of each&nbsp;crystal. Enemies hit by an explosion take @FalloffDamagePct*100@% less damage from subsequent explosions this cast.",
    "variables": {
      "ClosestEnemyPercentAD": [
        6.25,
        6.25,
        12.0
      ],
      "AttackSpeed": [
        0.3,
        0.4,
        3.0
      ],
      "NumOfCrystals": [
        3.0,
        3.0,
        20.0
      ],
      "PercentAttackDamage": [
        4.0,
        4.0,
        10.0
      ],
      "NumAlliesAS": [
        3.0,
        3.0,
        3.0
      ],
      "ASDuration": [
        3.0,
        3.0,
        3.0
      ],
      "ReducedSummonHealth": [
        1.0,
        1.0,
        1.0
      ],
      "FalloffDamagePct": [
        0.5,
        0.5,
        0.5
      ]
    }
  },
  "smeech-ability": {
    "id": "smeech-ability",
    "championId": "smeech",
    "name": "Scrap Hacker",
    "description": "Leap towards the enemy with the fewest items within @LeapHexRange@ hexes. Slash @BaseNumStabs@ times, dealing a total of <physicalDamage>@TotalDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage. If they die, leap again, dealing @DamageReductionOnLeap*100@% less&nbsp;damage.",
    "variables": {
      "PercentAttackDamage": [
        5.0,
        5.0,
        5.0
      ],
      "APDamage": [
        70.0,
        105.0,
        170.0
      ],
      "LeapHexRange": [
        4.0,
        4.0,
        4.0
      ],
      "BaseNumStabs": [
        3.0,
        3.0,
        3.0
      ],
      "DamageReductionOnLeap": [
        0.3,
        0.3,
        0.3
      ]
    }
  },
  "sevika-ability": {
    "id": "sevika-ability",
    "championId": "sevika",
    "name": "Beat the Odds",
    "description": "Randomly cast 1 of 3 spells, with a chance of a Jackpot!<br><br><spellPassive>Flamethrower:</spellPassive> {{Spell_TFT13_LieutenantSpell1_Tooltip}}<br><br><spellPassive>Extendo-Punch:</spellPassive> {{Spell_TFT13_LieutenantSpell2_Tooltip}}<br><br><spellPassive>Chomp:</spellPassive> {{Spell_TFT13_LieutenantSpell3_Tooltip}}",
    "variables": {
      "Spell1_ADPercent": [
        2.4,
        2.4,
        15.0
      ],
      "Spell1_ReducedDamagePercent": [
        0.5,
        0.5,
        0.5
      ],
      "Spell1_MinDuration": [
        2.0,
        2.0,
        2.0
      ],
      "Spell1_Bonus_DamagePercentPerSecond": [
        0.2,
        0.2,
        0.2
      ],
      "Spell1_HighrollBonus": [
        20.0,
        20.0,
        20.0
      ],
      "APBonusDamage": [
        20.0,
        30.0,
        500.0
      ],
      "Spell2_HexRadius": [
        1.0,
        1.0,
        1.0
      ],
      "Spell2_Modifier": [
        3.0,
        3.0,
        3.0
      ],
      "Spell2_SecondaryModifier": [
        1.3,
        1.3,
        1.3
      ],
      "Spell2_HexKnockback": [
        10.0,
        10.0,
        10.0
      ],
      "Spell2_StunDuration": [
        1.5,
        1.5,
        1.5
      ],
      "Spell2_Bonus_KnockbackDamage": [
        4.0,
        4.0,
        10.0
      ],
      "Spell3_Modifier": [
        3.2,
        3.2,
        3.2
      ],
      "Spell3_BleedModifier": [
        0.75,
        0.75,
        0.75
      ],
      "Spell3_StunDuration": [
        1.25,
        1.25,
        1.25
      ],
      "Spell3_NumSlams": [
        2.0,
        2.0,
        2.0
      ],
      "Spell3_BleedDuration": [
        5.0,
        5.0,
        5.0
      ],
      "Spell3_TargetPercentHealthDamage": [
        0.2,
        0.2,
        0.2
      ],
      "Spell3_HexRadius": [
        1.0,
        1.0,
        1.0
      ],
      "Spell3_Bonus_BleedADPercent": [
        4.0,
        4.0,
        10.0
      ],
      "Spell3_Bonus_BleedDuration": [
        20.0,
        20.0,
        20.0
      ],
      "Spell3_ExecutePercentage": [
        0.15,
        0.15,
        1.0
      ],
      "Spell3_ResetDashRange": [
        2.0,
        2.0,
        10.0
      ],
      "Spell3_ResetDamageFalloff": [
        0.8,
        0.8,
        0.8
      ],
      "Spell3_BonusNumChomps": [
        4.0,
        4.0,
        4.0
      ]
    }
  },
  "renni-ability": {
    "id": "renni-ability",
    "championId": "renni",
    "name": "Sludgerunner's Smash",
    "description": "Heal <scaleHealth>@ModifiedHealing@&nbsp;(%i:scaleHealth%%i:scaleAP%)</scaleHealth> over @StunDuration@ seconds. For the duration, raise target into the air, Stunning them, and dealing <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage. Afterwards, slam them down, dealing <physicalDamage>@FinalDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to all adjacent&nbsp;enemies.<br><br>",
    "variables": {
      "APHeal": [
        300.0,
        325.0,
        375.0
      ],
      "MaxHealthHealingPercent": [
        0.15,
        0.15,
        0.15
      ],
      "StunDuration": [
        1.5,
        1.5,
        1.5
      ],
      "ADPercent": [
        5.0,
        5.0,
        5.0
      ],
      "FinalADPercent": [
        2.0,
        2.0,
        2.0
      ]
    }
  },
  "nunu-ability": {
    "id": "nunu-ability",
    "championId": "nunu",
    "name": "ZOMBIE POWER!!\t\t\t\t\t\t",
    "description": "For @DamageDuration@ seconds, gain <TFTBonus>@ModifiedDurability@&nbsp;(%i:scaleAP%)</TFTBonus> Durability and create a 2-hex cloud of noxious fumes that deals <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to enemies within. Afterwards, detonate the cloud and deal <magicDamage>@ModifiedSecondDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to all enemies&nbsp;within.<br><br><spellActive enabled=TFT13_ExperimentActive alternate=rules>Experiment Bonus: <TFTBonus><ShowIfNot.TFT13_ExperimentActive></ShowIfNot.TFT13_ExperimentActive><ShowIf.TFT13_ExperimentActive></ShowIf.TFT13_ExperimentActive></TFTBonus>After dealing damage, deal <magicDamage enabled=TFT13_ExperimentActive alternate=rules>@TFTUnitProperty.:TFT13_NunuCurrentExperimentBonus@%&nbsp;</magicDamage>max&nbsp;%i:scaleHealth% bonus magic&nbsp;damage (@ExperimentICD@s&nbsp;cooldown).</spellActive>",
    "variables": {
      "Durability": [
        0.5,
        0.5,
        0.55
      ],
      "Damage": [
        30.0,
        45.0,
        65.0
      ],
      "DamageTicksPerSecond": [
        2.0,
        2.0,
        2.0
      ],
      "SecondDamage": [
        150.0,
        225.0,
        340.0
      ],
      "DamageDuration": [
        3.0,
        3.0,
        3.0
      ],
      "HexRadius": [
        2.0,
        2.0,
        2.0
      ],
      "ExperimentMaxHealthDamage": [
        0.03,
        0.03,
        0.03
      ],
      "ExperimentICD": [
        1.0,
        1.0,
        1.0
      ]
    }
  },
  "gangplank-ability": {
    "id": "gangplank-ability",
    "championId": "gangplank",
    "name": "Harvest from Flames",
    "description": "Restore <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleAP%)</scaleHealth> Health. Then slash, dealing <physicalDamage>@ModifiedDamage@&nbsp;(%i:scaleAD%)</physicalDamage> physical damage to enemies in a line. If only one enemy is hit, the damage is&nbsp;doubled.",
    "variables": {
      "PercentAttackDamage": [
        3.4,
        3.4,
        3.4
      ],
      "Heal": [
        100.0,
        125.0,
        150.0
      ],
      "SingleTargetDamageIncrease": [
        1.0,
        1.0,
        1.0
      ]
    }
  },
  "gangplank-ranged-ability": {
    "id": "gangplank-ranged-ability",
    "championId": "gangplank-ranged",
    "name": "Sticky Bombs",
    "description": "<spellPassive>Passive:</spellPassive> While gaining Mana, throw out @NumOfBarrels@ sticky bombs. If the enemy they attach to dies, they pass to another nearby&nbsp;enemy.<br><br><spellActive>Active:</spellActive> Detonate them, dealing <physicalDamage>@TotalDamage@&nbsp;(%i:scaleAD%%i:scaleAP%)</physicalDamage> physical damage to the enemy they're attached to and <physicalDamage>@SecondaryDamage@&nbsp;(%i:scaleAD%%i:scaleAP%)</physicalDamage> physical damage to adjacent&nbsp;enemies.",
    "variables": {
      "NumOfBarrels": [
        3.0,
        3.0,
        3.0
      ],
      "APDamage": [
        30.0,
        45.0,
        70.0
      ],
      "PercentAttackDamage": [
        2.75,
        2.75,
        2.9
      ],
      "PercentToAdjacentUnits": [
        0.2,
        0.2,
        0.2
      ]
    }
  },
  "swain-ability": {
    "id": "swain-ability",
    "championId": "swain",
    "name": "Demonic Ascension",
    "description": "Heal <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleAP%)</scaleHealth> and ascend for @Duration@ seconds. While ascended, heal <scaleHealth>@ModifiedHealPerSecond@&nbsp;(%i:scaleAP%)</scaleHealth> and deal <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to adjacent enemies every second. On takedown, the ascension's duration is extended by @BonusDuration@&nbsp;seconds.",
    "variables": {
      "Heal": [
        240.0,
        300.0,
        380.0
      ],
      "HealPerSecond": [
        70.0,
        90.0,
        125.0
      ],
      "DamagePerSecond": [
        40.0,
        60.0,
        95.0
      ],
      "Duration": [
        6.0,
        6.0,
        6.0
      ],
      "BonusDuration": [
        2.0,
        2.0,
        2.0
      ]
    }
  },
  "swain-ranged-ability": {
    "id": "swain-ranged-ability",
    "championId": "swain-ranged",
    "name": "Murder of Crows",
    "description": "Send @NumOfCrows@ crows towards target that deal a total of <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage. They each fly to a nearby enemy and deal <magicDamage>@ModifiedSecondaryDamage@&nbsp;(%i:scaleAP%)</magicDamage>&nbsp;magic damage.",
    "variables": {
      "NumOfCrows": [
        8.0,
        8.0,
        8.0
      ],
      "MagicDamage": [
        310.0,
        465.0,
        700.0
      ],
      "SecondaryDamage": [
        40.0,
        60.0,
        90.0
      ],
      "NumOfNearbyTargets": [
        3.0,
        3.0,
        3.0
      ]
    }
  }
});
