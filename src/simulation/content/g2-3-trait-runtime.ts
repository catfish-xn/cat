// Shared browser/server/dev runtime columns. Archive text: g2-3-trait-runtime.ts.
import { freezeContent } from './freeze';
export const G23_TRAIT_SOURCE = freezeContent({
  "automata": {
    "name": "Automata",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "ConversionDamagePct": 0.25,
          "MagicDamage": 150,
          "Resists": 25,
          "TriggerNumCrystals": 20,
          "{a142f31c}": 1
        }
      },
      {
        "threshold": 4,
        "values": {
          "ConversionDamagePct": 0.25,
          "MagicDamage": 400,
          "Resists": 60,
          "TriggerNumCrystals": 20,
          "{a142f31c}": 1
        }
      },
      {
        "threshold": 6,
        "values": {
          "ConversionDamagePct": 0.25,
          "MagicDamage": 1100,
          "Resists": 140,
          "TriggerNumCrystals": 20,
          "{a142f31c}": 1
        }
      }
    ]
  },
  "sorcerer": {
    "name": "Sorcerer",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "BaseAP": 20,
          "TeamAP": 10
        }
      },
      {
        "threshold": 4,
        "values": {
          "BaseAP": 50,
          "TeamAP": 10
        }
      },
      {
        "threshold": 6,
        "values": {
          "BaseAP": 95,
          "TeamAP": 10
        }
      },
      {
        "threshold": 8,
        "values": {
          "BaseAP": 110,
          "DamageDecrease": 0.25,
          "DamageDecreaseDuration": 3,
          "TeamAP": 10
        }
      }
    ]
  },
  "scrap": {
    "name": "Scrap",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "HPShieldAmount": 25,
          "NumComponents": 1,
          "ShieldDuration": 20,
          "{659aef8d}": null,
          "{7e2474c8}": null
        }
      },
      {
        "threshold": 4,
        "values": {
          "HPShieldAmount": 35,
          "NumComponents": 3,
          "ShieldDuration": 20,
          "{659aef8d}": null,
          "{7e2474c8}": null
        }
      },
      {
        "threshold": 6,
        "values": {
          "HPShieldAmount": 50,
          "NumComponents": 20,
          "ShieldDuration": 20,
          "{659aef8d}": 1,
          "{7e2474c8}": null
        }
      },
      {
        "threshold": 9,
        "values": {
          "HPShieldAmount": 60,
          "NumComponents": 20,
          "ShieldDuration": 20,
          "{659aef8d}": 1,
          "{7e2474c8}": 1
        }
      }
    ]
  },
  "artillerist": {
    "name": "Artillerist",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "AD": 0.1,
          "NumOfAttacks": 5,
          "PercentDamage": 1.25
        }
      },
      {
        "threshold": 4,
        "values": {
          "AD": 0.45,
          "NumOfAttacks": 5,
          "PercentDamage": 1.25
        }
      },
      {
        "threshold": 6,
        "values": {
          "AD": 0.6,
          "NumOfAttacks": 4,
          "PercentDamage": 2.5
        }
      }
    ]
  },
  "form-swapper": {
    "name": "Form Swapper",
    "enabled": false,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "DA": 0.2,
          "DR": 0.15
        }
      },
      {
        "threshold": 4,
        "values": {
          "DA": 0.4,
          "DR": 0.3
        }
      }
    ]
  },
  "emissary": {
    "name": "Emissary",
    "enabled": true,
    "tiers": [
      {
        "threshold": 1,
        "values": {
          "AmbessaArmor": 2,
          "AmbessaArmor_PVE": 4,
          "BonusAS": null,
          "BonusHealth": 200,
          "CCImmuneDuration": 8,
          "GarenHealthPercent": 0.12,
          "NamiMana": 2,
          "SelfishDamageAmp": 0.2,
          "StarAS": 0.06,
          "{3854f478}": 2,
          "{4b20f990}": null,
          "{845be53a}": 4
        }
      },
      {
        "threshold": 4,
        "values": {
          "AmbessaArmor": 2,
          "AmbessaArmor_PVE": 4,
          "BonusAS": null,
          "BonusHealth": 200,
          "CCImmuneDuration": 8,
          "GarenHealthPercent": 0.12,
          "NamiMana": 2,
          "SelfishDamageAmp": 0.2,
          "StarAS": 0.06,
          "{3854f478}": 2,
          "{4b20f990}": null,
          "{845be53a}": 4
        }
      }
    ]
  },
  "sentinel": {
    "name": "Sentinel",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "BonusArmor": 12,
          "{5921fc26}": 2
        }
      },
      {
        "threshold": 4,
        "values": {
          "BonusArmor": 25,
          "{5921fc26}": 2
        }
      },
      {
        "threshold": 6,
        "values": {
          "BonusArmor": 42,
          "{5921fc26}": 2
        }
      }
    ]
  },
  "family": {
    "name": "Family",
    "enabled": true,
    "tiers": [
      {
        "threshold": 3,
        "values": {
          "AttackSpeed": 0.2,
          "DamageReduction": 0.2,
          "ManaReduction": 0.25
        }
      },
      {
        "threshold": 4,
        "values": {
          "AttackSpeed": 0.2,
          "DamageReduction": 0.2,
          "ManaReduction": 0.3
        }
      },
      {
        "threshold": 5,
        "values": {
          "AttackSpeed": 0.2,
          "DamageReduction": 0.2,
          "ManaReduction": 0.4,
          "{01fcc30b}": 0.75,
          "{217874f1}": 2.5,
          "{43cb93dd}": 1.25,
          "{46c3fc24}": 1.5,
          "{6fc9f267}": 17,
          "{8173be81}": 2,
          "{9000fe5b}": 2,
          "{92029cea}": 0.5
        }
      }
    ]
  },
  "ambusher": {
    "name": "Ambusher",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "CritChance": 0.25,
          "CritDamage": 0.1
        }
      },
      {
        "threshold": 3,
        "values": {
          "CritChance": 0.35,
          "CritDamage": 0.2
        }
      },
      {
        "threshold": 4,
        "values": {
          "CritChance": 0.45,
          "CritDamage": 0.25
        }
      },
      {
        "threshold": 5,
        "values": {
          "CritChance": 0.55,
          "CritDamage": 0.25,
          "DamageReductionPct": 0.15
        }
      }
    ]
  },
  "visionary": {
    "name": "Visionary",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "EnlightenedBonusMana": 0.25
        }
      },
      {
        "threshold": 4,
        "values": {
          "EnlightenedBonusMana": 0.5
        }
      },
      {
        "threshold": 6,
        "values": {
          "EnlightenedBonusMana": 0.8
        }
      },
      {
        "threshold": 8,
        "values": {
          "AllyHealing": 0.2,
          "EnlightenedBonusMana": 1
        }
      }
    ]
  },
  "sniper": {
    "name": "Sniper",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "BonusHexRangeIncrease": null,
          "PercentDamageIncrease": 7
        }
      },
      {
        "threshold": 4,
        "values": {
          "BonusHexRangeIncrease": null,
          "PercentDamageIncrease": 16
        }
      },
      {
        "threshold": 6,
        "values": {
          "BonusHexRangeIncrease": 5,
          "PercentDamageIncrease": 35
        }
      }
    ]
  },
  "conqueror": {
    "name": "Conqueror",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "ADAPBase": 0.18,
          "PercentIncreasePerChest": 0.03,
          "StacksPerKill": 1
        }
      },
      {
        "threshold": 4,
        "values": {
          "ADAPBase": 0.25,
          "PercentIncreasePerChest": 0.03,
          "StacksPerKill": 3
        }
      },
      {
        "threshold": 6,
        "values": {
          "ADAPBase": 0.4,
          "PercentIncreasePerChest": 0.03,
          "StacksPerKill": 6
        }
      },
      {
        "threshold": 9,
        "values": {
          "ADAPBase": 1,
          "PercentIncreasePerChest": 0.03,
          "StacksPerKill": 20
        }
      }
    ]
  },
  "high-roller": {
    "name": "High Roller",
    "enabled": true,
    "tiers": [
      {
        "threshold": 1,
        "values": {
          "Bonus1NumRockets": 8,
          "Bonus1RocketDamage": 100,
          "Bonus2ShieldAmount": 500,
          "Bonus2ShieldDuration": 4,
          "Bonus4Gold": 3,
          "Durability": 0.8,
          "Duration": 1.5,
          "{01148678}": 0.35,
          "{267deafa}": 0.35,
          "{52aec87f}": 0.1,
          "{592d23e5}": 0.35,
          "{699f6a87}": 0.2,
          "{9ad9e572}": 0.005,
          "{9b22c5ec}": null,
          "{bcedb441}": 1.5,
          "{e1fc0fa1}": 0.245,
          "{e640e05f}": 0.4
        }
      }
    ]
  },
  "academy": {
    "name": "Academy",
    "enabled": true,
    "tiers": [
      {
        "threshold": 3,
        "values": {
          "BaseValues": 0.05,
          "NumOfItems": 1,
          "PercentIncreaseSponsored": 0.02
        }
      },
      {
        "threshold": 4,
        "values": {
          "BaseValues": 0.05,
          "NumOfItems": 2,
          "PercentIncreaseSponsored": 0.03
        }
      },
      {
        "threshold": 5,
        "values": {
          "BaseValues": 0.05,
          "NumOfItems": 3,
          "PercentIncreaseSponsored": 0.05
        }
      },
      {
        "threshold": 6,
        "values": {
          "BaseValues": 0.05,
          "NumOfItems": 3,
          "PercentIncreaseSponsored": 0.09
        }
      }
    ]
  },
  "chem-baron": {
    "name": "Chem-Baron",
    "enabled": true,
    "tiers": [
      {
        "threshold": 3,
        "values": {
          "HealthPerSkip": 20,
          "MinStreakLength": 3,
          "ShimmerBreakpoint": 100,
          "ShimmerPerCombat": 15,
          "ShimmerPerCombatStreaking": 35,
          "ShimmerPerCombatStreaking_HR": 50,
          "ShimmerPerCombat_HR": 25,
          "ShimmerPerDeath_PVE": 1,
          "ShimmerPerRound_PVE": 15,
          "{ecbc38fd}": 1
        }
      },
      {
        "threshold": 4,
        "values": {
          "HealthPerSkip": 60,
          "MinStreakLength": 3,
          "ShimmerBreakpoint": 100,
          "ShimmerPerCombat": 20,
          "ShimmerPerCombatStreaking": 45,
          "ShimmerPerCombatStreaking_HR": 60,
          "ShimmerPerCombat_HR": 30,
          "ShimmerPerDeath_PVE": 1,
          "ShimmerPerRound_PVE": 20,
          "{ecbc38fd}": 1
        }
      },
      {
        "threshold": 5,
        "values": {
          "HealthPerSkip": 110,
          "MinStreakLength": 3,
          "ShimmerBreakpoint": 100,
          "ShimmerPerCombat": 20,
          "ShimmerPerCombatStreaking": 55,
          "ShimmerPerCombatStreaking_HR": 70,
          "ShimmerPerCombat_HR": 35,
          "ShimmerPerDeath_PVE": 2,
          "ShimmerPerRound_PVE": 30,
          "{ecbc38fd}": 1
        }
      },
      {
        "threshold": 6,
        "values": {
          "HealthPerSkip": 160,
          "MinStreakLength": 3,
          "ShimmerBreakpoint": 100,
          "ShimmerPerCombat": 25,
          "ShimmerPerCombatStreaking": 70,
          "ShimmerPerCombatStreaking_HR": 90,
          "ShimmerPerCombat_HR": 45,
          "ShimmerPerDeath_PVE": 3,
          "ShimmerPerRound_PVE": 40,
          "{ecbc38fd}": 1
        }
      },
      {
        "threshold": 7,
        "values": {
          "HealthPerSkip": 220,
          "MinStreakLength": 3,
          "ShimmerBreakpoint": 100,
          "ShimmerPerCombat": 30,
          "ShimmerPerCombatStreaking": 100,
          "ShimmerPerCombatStreaking_HR": 125,
          "ShimmerPerCombat_HR": 60,
          "ShimmerPerDeath_PVE": 15,
          "ShimmerPerRound_PVE": 65,
          "{ecbc38fd}": 1
        }
      }
    ]
  },
  "rebel": {
    "name": "Rebel",
    "enabled": true,
    "tiers": [
      {
        "threshold": 3,
        "values": {
          "ADAP": 0.2,
          "BurstAS": 0.6,
          "BurstDuration": 5,
          "ForceDuration": null,
          "MaxHealthIncrease": 0.12,
          "PercentHealthTrigger": 0.25,
          "PercentMaxHealthBonus": null,
          "StunDuration": null,
          "{1ec59053}": null
        }
      },
      {
        "threshold": 5,
        "values": {
          "ADAP": 0.4,
          "BurstAS": 0.6,
          "BurstDuration": 5,
          "ForceDuration": null,
          "MaxHealthIncrease": 0.12,
          "PercentHealthTrigger": 0.25,
          "PercentMaxHealthBonus": 0.12,
          "StunDuration": null,
          "{1ec59053}": null
        }
      },
      {
        "threshold": 7,
        "values": {
          "ADAP": 0.45,
          "BurstAS": 0.6,
          "BurstDuration": 5,
          "ForceDuration": null,
          "MaxHealthIncrease": 0.12,
          "PercentHealthTrigger": 0.25,
          "PercentMaxHealthBonus": 0.15,
          "StunDuration": 2,
          "{1ec59053}": null
        }
      },
      {
        "threshold": 10,
        "values": {
          "ADAP": 0.5,
          "BurstAS": 0.6,
          "BurstDuration": 5,
          "ForceDuration": 12,
          "MaxHealthIncrease": 0.12,
          "PercentHealthTrigger": 0.25,
          "PercentMaxHealthBonus": 0.3,
          "StunDuration": 2,
          "{1ec59053}": 1
        }
      }
    ]
  },
  "dominator": {
    "name": "Dominator",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "APPercent": 0.25,
          "ShieldAmount": 350,
          "ShieldDuration": 15
        }
      },
      {
        "threshold": 4,
        "values": {
          "APPercent": 0.45,
          "ShieldAmount": 500,
          "ShieldDuration": 15
        }
      },
      {
        "threshold": 6,
        "values": {
          "APPercent": 0.65,
          "ShieldAmount": 700,
          "ShieldDuration": 15
        }
      }
    ]
  },
  "pit-fighter": {
    "name": "Pit Fighter",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "Duration": 2,
          "HealPercent": 0.1,
          "HealthThreshold": 0.5,
          "OmnivampPercent": 0.15,
          "TrueDamagePercent": 0.06
        }
      },
      {
        "threshold": 4,
        "values": {
          "Duration": 2,
          "HealPercent": 0.25,
          "HealthThreshold": 0.5,
          "OmnivampPercent": 0.15,
          "TrueDamagePercent": 0.12
        }
      },
      {
        "threshold": 6,
        "values": {
          "Duration": 2,
          "HealPercent": 0.4,
          "HealthThreshold": 0.5,
          "OmnivampPercent": 0.15,
          "TrueDamagePercent": 0.2
        }
      },
      {
        "threshold": 8,
        "values": {
          "Duration": 2,
          "HealPercent": 0.8,
          "HealthThreshold": 0.5,
          "OmnivampPercent": 0.15,
          "TrueDamagePercent": 0.4
        }
      }
    ]
  },
  "enforcer": {
    "name": "Enforcer",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "AttackSpeedPerWantedKill": 0.3,
          "BaseDA": 0.12,
          "NumOfWantedEnemies": 1,
          "PercentMaxHealthShield": 0.12,
          "{36b1550f}": null,
          "{9edd4912}": null
        }
      },
      {
        "threshold": 4,
        "values": {
          "AttackSpeedPerWantedKill": 0.3,
          "BaseDA": 0.2,
          "NumOfWantedEnemies": 2,
          "PercentMaxHealthShield": 0.2,
          "{36b1550f}": null,
          "{9edd4912}": null
        }
      },
      {
        "threshold": 6,
        "values": {
          "AttackSpeedPerWantedKill": 0.3,
          "BaseDA": 0.33,
          "NumOfWantedEnemies": 4,
          "PercentMaxHealthShield": 0.3,
          "{36b1550f}": null,
          "{9edd4912}": null
        }
      },
      {
        "threshold": 8,
        "values": {
          "AttackSpeedPerWantedKill": 0.3,
          "BaseDA": 0.5,
          "NumOfWantedEnemies": 5,
          "PercentMaxHealthShield": 0.4,
          "{36b1550f}": null,
          "{9edd4912}": null
        }
      },
      {
        "threshold": 10,
        "values": {
          "AttackSpeedPerWantedKill": 0.3,
          "BaseDA": 1.5,
          "NumOfWantedEnemies": 99,
          "PercentMaxHealthShield": 1,
          "{36b1550f}": null,
          "{9edd4912}": 1
        }
      }
    ]
  },
  "firelight": {
    "name": "Firelight",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "Duration": 6,
          "PercentDamageTakenHeal": 0.2,
          "{0a9a9714}": null,
          "{3c0d594a}": 1
        }
      },
      {
        "threshold": 3,
        "values": {
          "Duration": 6,
          "PercentDamageTakenHeal": 0.33,
          "{0a9a9714}": null,
          "{3c0d594a}": 1
        }
      },
      {
        "threshold": 4,
        "values": {
          "Duration": 6,
          "PercentDamageTakenHeal": 0.4,
          "{0a9a9714}": 3.5,
          "{3c0d594a}": 1
        }
      }
    ]
  },
  "experiment": {
    "name": "Experiment",
    "enabled": true,
    "tiers": [
      {
        "threshold": 3,
        "values": {
          "ExperimentBonusIncrease": null,
          "MaxHealth": 100,
          "NumLaboratory": 2,
          "{a02e81c2}": 1.15
        }
      },
      {
        "threshold": 5,
        "values": {
          "ExperimentBonusIncrease": null,
          "MaxHealth": 300,
          "NumLaboratory": 3,
          "{a02e81c2}": 1.3
        }
      },
      {
        "threshold": 7,
        "values": {
          "ExperimentBonusIncrease": 1,
          "MaxHealth": 300,
          "NumLaboratory": 3,
          "{a02e81c2}": 1.5
        }
      }
    ]
  },
  "bruiser": {
    "name": "Bruiser",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "BonusPercentHealth": 0.2,
          "TeamFlatHealth": 100
        }
      },
      {
        "threshold": 4,
        "values": {
          "BonusPercentHealth": 0.45,
          "TeamFlatHealth": 100
        }
      },
      {
        "threshold": 6,
        "values": {
          "BonusPercentHealth": 0.8,
          "TeamFlatHealth": 100
        }
      }
    ]
  },
  "junker-king": {
    "name": "Junker King",
    "enabled": true,
    "tiers": [
      {
        "threshold": 1,
        "values": {
          "NumRounds1Star": 3,
          "NumRounds1Star_HR": 2,
          "{7b91cfd3}": 2,
          "{da177dfb}": 1,
          "{ea33712c}": 3,
          "{ed4fa85a}": 1
        }
      }
    ]
  },
  "black-rose": {
    "name": "Black Rose",
    "enabled": true,
    "tiers": [
      {
        "threshold": 3,
        "values": {
          "NumCastsToUnlock": 5,
          "PercentHealthPerStarLevel": 0.15,
          "PercentHealthUnlock": 0.65,
          "{2c6be05c}": 0.12,
          "{2e45fc86}": 40,
          "{85b293ec}": 0.35,
          "{92ef9cd7}": 4
        }
      },
      {
        "threshold": 4,
        "values": {
          "NumCastsToUnlock": 5,
          "PercentHealthPerStarLevel": 0.15,
          "PercentHealthUnlock": 0.65,
          "{2c6be05c}": 0.12,
          "{2e45fc86}": 45,
          "{85b293ec}": 0.35,
          "{92ef9cd7}": 4
        }
      },
      {
        "threshold": 5,
        "values": {
          "NumCastsToUnlock": 5,
          "PercentHealthPerStarLevel": 0.15,
          "PercentHealthUnlock": 0.65,
          "{2c6be05c}": 0.12,
          "{2e45fc86}": 50,
          "{85b293ec}": 0.35,
          "{92ef9cd7}": 4
        }
      },
      {
        "threshold": 7,
        "values": {
          "NumCastsToUnlock": 5,
          "PercentHealthPerStarLevel": 0.15,
          "PercentHealthUnlock": 0.65,
          "{2c6be05c}": 0.12,
          "{2e45fc86}": 100,
          "{85b293ec}": 0.35,
          "{92ef9cd7}": 4
        }
      }
    ]
  },
  "quickstriker": {
    "name": "Quickstriker",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "MaxBonusAS": 0.6,
          "MinBonusAS": 0.2,
          "{0e9453af}": null,
          "{bdb9953b}": 200
        }
      },
      {
        "threshold": 3,
        "values": {
          "MaxBonusAS": 0.8,
          "MinBonusAS": 0.3,
          "{0e9453af}": null,
          "{bdb9953b}": 200
        }
      },
      {
        "threshold": 4,
        "values": {
          "MaxBonusAS": 1,
          "MinBonusAS": 0.4,
          "ShieldAmount": 200,
          "ShieldDuration": 3,
          "{0e9453af}": null,
          "{bdb9953b}": 200
        }
      }
    ]
  },
  "watcher": {
    "name": "Watcher",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "BaseDR": 0.15,
          "HealthBreakpoint": 0.5,
          "IncreasedDR": 0.3
        }
      },
      {
        "threshold": 4,
        "values": {
          "BaseDR": 0.25,
          "HealthBreakpoint": 0.5,
          "IncreasedDR": 0.45
        }
      },
      {
        "threshold": 6,
        "values": {
          "BaseDR": 0.35,
          "HealthBreakpoint": 0.5,
          "IncreasedDR": 0.5
        }
      }
    ]
  }
});
