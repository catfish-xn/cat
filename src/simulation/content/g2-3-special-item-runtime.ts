// Shared browser/server/dev runtime columns. Archive text: g2-3-special-item-runtime.ts.
import { freezeContent } from './freeze';
import { CHEM_BARON_B_OVERRIDES } from './chem-baron-b-overrides';
export const G23_ARCHIVED_SPECIAL_ITEM_SOURCE = freezeContent({
  "TFT13_Crime_Bronze_ChemGrips": {
    "name": "Salvaged Contraption",
    "values": {
      "Armor": 10,
      "Health": 200,
      "MagicResist": 10,
      "ReducedDamage": 10
    },
    "unique": false
  },
  "TFT13_Crime_Bronze_MageGuard": {
    "name": "Salvaged Revolver",
    "values": {
      "AP": 20,
      "APPerTick": 10,
      "Mana": 15,
      "TickRate": 5
    },
    "unique": false
  },
  "TFT13_Crime_Bronze_MiningGauntlet": {
    "name": "Salvaged Gauntlet",
    "values": {
      "AD": 0.25,
      "AS": 10,
      "BonusDamageOnAttack": 15
    },
    "unique": false
  },
  "TFT13_Crime_Gold_DestabilizedChemtank": {
    "name": "Destabilized Chemtank II",
    "values": {
      "Armor": 25,
      "Health": 350,
      "HealthThreshold": 0.5,
      "InitialPercentShield": 0.3499999940395355,
      "MagicResist": 25,
      "PercentShield": 0.10000000149011612,
      "TickRate": 8,
      "{473a431b}": 0.20000000298023224
    },
    "unique": false
  },
  "TFT13_Crime_Gold_ExecutionersVorpalblade": {
    "name": "Executioner's Chainblade II",
    "values": {
      "AD": 0.4000000059604645,
      "AS": 15,
      "Duration": 5,
      "ExecuteThreshold": 0.15000000596046448,
      "OnKillDA": 0.15000000596046448,
      "OnKillDR": 0.15000000596046448
    },
    "unique": false
  },
  "TFT13_Crime_Gold_FleshRipper": {
    "name": "Flesh Ripper II",
    "values": {
      "AD": 0.25,
      "CritChance": 35,
      "EnhancedAD": 0.20000000298023224,
      "EnhancedOmnivamp": 0.15000000596046448,
      "HealthThreshold": 0.4000000059604645,
      "PercentHeal": 0.4000000059604645,
      "{e6cef574}": 1
    },
    "unique": true
  },
  "TFT13_Crime_Gold_PiltovenHexplating": {
    "name": "Piltoven Hexarmor II",
    "values": {
      "Armor": 40,
      "ArmorPerStack": 5,
      "Cooldown": 2,
      "Health": 175,
      "HexRange": 1,
      "MagicResist": 40,
      "MaxStacks": 15,
      "ResistancePercentageDamage": 0.75,
      "{992e2747}": 5
    },
    "unique": false
  },
  "TFT13_Crime_Gold_ShimmerBloom": {
    "name": "Shimmer Bloom II",
    "values": {
      "AP": 35,
      "Cadence": 8,
      "Health": 250,
      "IncreasedHealShieldPercent": 0.3499999940395355,
      "NumAllies": 2,
      "ShieldAmount": 525,
      "ShieldDuration": 10
    },
    "unique": false
  },
  "TFT13_Crime_Gold_UnleashedToxins": {
    "name": "Unleashed Toxins II",
    "values": {
      "AP": 25,
      "ExtraManaOnAttack": 5,
      "FlatDamage": 175,
      "Mana": 15,
      "NumMissiles": 3
    },
    "unique": false
  },
  "TFT13_Crime_Gold_VirulentVirus": {
    "name": "Virulent Virus II",
    "values": {
      "AP": 40,
      "AS": 25,
      "DoTPercentDamage": 0.25,
      "Duration": 3
    },
    "unique": false
  },
  "TFT13_Crime_Gold_VoltaicSaber": {
    "name": "Voltaic Saber II",
    "values": {
      "AD": 0.25,
      "AP": 25,
      "JoltDamage": 250,
      "NumDamageInstances": 6,
      "NumEnemies": 2,
      "StatOmnivamp": 0.3499999940395355
    },
    "unique": false
  },
  "TFT13_Crime_OmegaPrismatic_DimensionalHeirloom": {
    "name": "Dimensional Heirloom",
    "values": {
      "Cadence": 4,
      "Health": 5000
    },
    "unique": true
  },
  "TFT13_Crime_Prismatic_DestabilizedChemtank": {
    "name": "Perfected Destabilized Chemtank",
    "values": {
      "Armor": 45,
      "Health": 600,
      "HealthThreshold": 0.5,
      "InitialPercentShield": 0.6000000238418579,
      "MagicResist": 45,
      "PercentShield": 0.10000000149011612,
      "PrismaticDamagePercent": 0.10000000149011612,
      "PrismaticNumChampions": 3,
      "TickRate": 4,
      "{473a431b}": 0.20000000298023224
    },
    "unique": false
  },
  "TFT13_Crime_Prismatic_ExecutionersVorpalblade": {
    "name": "Perfected Executioner's Chainblade",
    "values": {
      "AD": 0.75,
      "AS": 30,
      "Duration": 10,
      "ExecuteThreshold": 0.20000000298023224,
      "OnKillDA": 0.20000000298023224,
      "OnKillDR": 0.20000000298023224,
      "PrismaticGold": 3,
      "PrismaticHeal": 400
    },
    "unique": false
  },
  "TFT13_Crime_Prismatic_FleshRipper": {
    "name": "Perfected Flesh Ripper",
    "values": {
      "AD": 0.44999998807907104,
      "CritChance": 60,
      "EnhancedAD": 0.6000000238418579,
      "EnhancedOmnivamp": 0.25,
      "HealthThreshold": 0.4000000059604645,
      "PercentHeal": 1,
      "PrismaticReviveHeal": 1,
      "{02712a6d}": 2,
      "{e6cef574}": 1
    },
    "unique": true
  },
  "TFT13_Crime_Prismatic_PiltovenHexplating": {
    "name": "Perfected Piltoven Hexarmor",
    "values": {
      "Armor": 75,
      "ArmorPerStack": 10,
      "Cooldown": 2,
      "Health": 300,
      "HexRange": 4,
      "MagicResist": 75,
      "MaxStacks": 15,
      "ResistancePercentageDamage": 0.5,
      "{11af8281}": 0.5,
      "{992e2747}": 10
    },
    "unique": false
  },
  "TFT13_Crime_Prismatic_ShimmerBloom": {
    "name": "Perfected Shimmer Bloom",
    "values": {
      "AP": 60,
      "Cadence": 6,
      "Health": 450,
      "IncreasedHealShieldPercent": 0.6000000238418579,
      "NumAllies": 3,
      "PrismaticAllyAP": 30,
      "PrismaticAllyAS": 0.30000001192092896,
      "PrismaticCooldownTime": 1,
      "ShieldAmount": 600,
      "ShieldDuration": 10
    },
    "unique": false
  },
  "TFT13_Crime_Prismatic_UnleashedToxins": {
    "name": "Perfected Unleashed Toxins",
    "values": {
      "AP": 45,
      "ExtraManaOnAttack": 10,
      "FlatDamage": 250,
      "Mana": 30,
      "NumMissiles": 5,
      "PrismaticWaveDamage": 450,
      "PrismaticWaveStunDuration": 1.5
    },
    "unique": false
  },
  "TFT13_Crime_Prismatic_VirulentVirus": {
    "name": "Perfected Virulent Virus",
    "values": {
      "AP": 75,
      "AS": 45,
      "DoTPercentDamage": 0.44999998807907104,
      "Duration": 3,
      "PrismaticReducedDamage": 0.25,
      "PrismaticZombieDecayDuration": 8,
      "PrismaticZombieHealth": 1600
    },
    "unique": false
  },
  "TFT13_Crime_Prismatic_VoltaicSaber": {
    "name": "Perfected Voltaic Saber",
    "values": {
      "AD": 0.44999998807907104,
      "AP": 45,
      "JoltDamage": 300,
      "NumDamageInstances": 4,
      "NumEnemies": 3,
      "PrismaticASPerTrigger": 0.20000000298023224,
      "StatOmnivamp": 0.6000000238418579
    },
    "unique": false
  },
  "TFT13_Crime_Silver_DestabilizedChemtank": {
    "name": "Destabilized Chemtank",
    "values": {
      "Armor": 15,
      "Health": 200,
      "HealthThreshold": 0.5,
      "InitialPercentShield": 0.20000000298023224,
      "MagicResist": 15,
      "PercentShield": 0.10000000149011612,
      "TickRate": 8,
      "{473a431b}": 0.10000000149011612
    },
    "unique": false
  },
  "TFT13_Crime_Silver_ExecutionersVorpalblade": {
    "name": "Executioner's Chainblade",
    "values": {
      "AD": 0.25,
      "AS": 10,
      "Duration": 5,
      "ExecuteThreshold": 0.10000000149011612,
      "OnKillDA": 0.10000000149011612,
      "OnKillDR": 0.10000000149011612
    },
    "unique": false
  },
  "TFT13_Crime_Silver_FleshRipper": {
    "name": "Flesh Ripper",
    "values": {
      "AD": 0.15000000596046448,
      "CritChance": 20,
      "EnhancedAD": 0.10000000149011612,
      "EnhancedOmnivamp": 0.10000000149011612,
      "HealthThreshold": 0.4000000059604645,
      "PercentHeal": 0.25,
      "{e6cef574}": 1
    },
    "unique": true
  },
  "TFT13_Crime_Silver_PiltovenHexplating": {
    "name": "Piltoven Hexarmor",
    "values": {
      "Armor": 25,
      "ArmorPerStack": 3,
      "Cooldown": 2,
      "Health": 100,
      "HexRange": 1,
      "MagicResist": 25,
      "MaxStacks": 15,
      "ResistancePercentageDamage": 0.5,
      "{992e2747}": 3
    },
    "unique": false
  },
  "TFT13_Crime_Silver_ShimmerBloom": {
    "name": "Shimmer Bloom",
    "values": {
      "AP": 20,
      "Cadence": 8,
      "Health": 150,
      "IncreasedHealShieldPercent": 0.20000000298023224,
      "NumAllies": 2,
      "ShieldAmount": 300,
      "ShieldDuration": 10
    },
    "unique": false
  },
  "TFT13_Crime_Silver_UnleashedToxins": {
    "name": "Unleashed Toxins",
    "values": {
      "AP": 15,
      "ExtraManaOnAttack": 5,
      "FlatDamage": 100,
      "Mana": 10,
      "NumMissiles": 3
    },
    "unique": false
  },
  "TFT13_Crime_Silver_VirulentVirus": {
    "name": "Virulent Virus",
    "values": {
      "AP": 25,
      "AS": 15,
      "DoTPercentDamage": 0.15000000596046448,
      "Duration": 3
    },
    "unique": false
  },
  "TFT13_Crime_Silver_VoltaicSaber": {
    "name": "Voltaic Saber",
    "values": {
      "AD": 0.15000000596046448,
      "AP": 15,
      "JoltDamage": 150,
      "NumDamageInstances": 6,
      "NumEnemies": 2,
      "StatOmnivamp": 0.20000000298023224
    },
    "unique": false
  },
  "TFT5_Item_AdaptiveHelmRadiant": {
    "name": "Jak'sho the Protean",
    "values": {
      "AP": 25,
      "BackRowBonusAP": 40,
      "FrontLineManaPerHit": 2,
      "FrontRowBonusResists": 60,
      "MagicResist": 30,
      "Mana": 15,
      "ManaPerTickrate": 20,
      "ManaTickrate": 3,
      "TotalAPBonus": 40
    },
    "unique": false
  },
  "TFT5_Item_ArchangelsStaffRadiant": {
    "name": "Urf-Angel's Staff",
    "values": {
      "AP": 50,
      "APPerInterval": 40,
      "IntervalSeconds": 4,
      "Mana": 15
    },
    "unique": false
  },
  "TFT5_Item_BloodthirsterRadiant": {
    "name": "Blessed Bloodthirster",
    "values": {
      "AD": 0.4000000059604645,
      "AP": 40,
      "HealthThreshold": 40,
      "LifeSteal": 40,
      "MagicResist": 20,
      "ShieldDuration": 5,
      "ShieldHealthPercent": 40,
      "StatOmnivamp": 0.4000000059604645
    },
    "unique": false
  },
  "TFT5_Item_BlueBuffRadiant": {
    "name": "Blue Blessing",
    "values": {
      "AD": 0.5,
      "AP": 50,
      "DamageAmp": 0.20000000298023224,
      "Mana": 30,
      "ManaRefund": 10,
      "TakedownTimer": 12
    },
    "unique": true
  },
  "TFT5_Item_BrambleVestRadiant": {
    "name": "Rosethorn Vest",
    "values": {
      "1StarAoEDamage": 175,
      "2StarAoEDamage": 175,
      "3StarAoEDamage": 175,
      "Armor": 100,
      "AutoDamageReduction": 0.25,
      "ICD": 2,
      "PercentMaxHP": 0.15000000596046448,
      "{b5c2a66b}": 175
    },
    "unique": false
  },
  "TFT5_Item_CrownguardRadiant": {
    "name": "Royal Crownshield",
    "values": {
      "AP": 40,
      "Armor": 40,
      "ChillDuration": 4,
      "Health": 200,
      "HexRange": 5,
      "ShieldBonusAP": 50,
      "ShieldDuration": 8,
      "ShieldSize": 50
    },
    "unique": false
  },
  "TFT5_Item_DeathbladeRadiant": {
    "name": "Luminous Deathblade",
    "values": {
      "AD": 1.0499999523162842,
      "BonusDamage": 0.11999999731779099,
      "{1543aa48}": 0.11999999731779099
    },
    "unique": false
  },
  "TFT5_Item_DragonsClawRadiant": {
    "name": "Dragon's Will",
    "values": {
      "HealthRegenInterval": 2,
      "ICD": 0.5,
      "MagicResist": 115,
      "MaxHealthRegen": 2,
      "PercentHealthDamage": 10,
      "PercentMaxHP": 0.15000000596046448
    },
    "unique": false
  },
  "TFT5_Item_FrozenHeartRadiant": {
    "name": "Bulwark's Oath",
    "values": {
      "Armor": 40,
      "HealthThreshold": 40,
      "Mana": 30,
      "ShieldDuration": 10,
      "ShieldHealthPercent": 50,
      "Stats": 60
    },
    "unique": false
  },
  "TFT5_Item_GargoyleStoneplateRadiant": {
    "name": "Dvarapala Stoneplate",
    "values": {
      "Armor": 50,
      "ArmorPerEnemy": 15,
      "Health": 250,
      "HealthRegenInterval": 1,
      "MRPerEnemy": 15,
      "MagicResist": 50,
      "MaxHealthRegen": 1.5
    },
    "unique": false
  },
  "TFT5_Item_GiantSlayerRadiant": {
    "name": "Demonslayer",
    "values": {
      "AD": 0.5,
      "AP": 50,
      "AS": 10,
      "DamageAmp": 0.30000001192092896,
      "HealthThreshold": 1750,
      "LargeBonusPct": 60,
      "{1543aa48}": 0.20000000298023224
    },
    "unique": false
  },
  "TFT5_Item_GuardianAngelRadiant": {
    "name": "Brink of Dawn",
    "values": {
      "AD": 0.30000001192092896,
      "Armor": 30,
      "AttackSpeed": 85,
      "DamageReduction": 100,
      "HealthThreshold": 60,
      "HealthThreshold2": 30,
      "MissingHealthRestore": 1,
      "StealthDuration": 1
    },
    "unique": true
  },
  "TFT5_Item_GuinsoosRagebladeRadiant": {
    "name": "Guinsoo's Reckoning",
    "values": {
      "AP": 10,
      "AS": 20,
      "AttackSpeedPerStack": 10
    },
    "unique": false
  },
  "TFT5_Item_HandOfJusticeRadiant": {
    "name": "Fist of Fairness",
    "values": {
      "AD_NotStatBar": 0.3499999940395355,
      "AP_NotStatBar": 35,
      "CritChance": 40,
      "HealthThreshold": 0.5,
      "Mana": 15,
      "StatOmnivamp_NotStatBar": 0.20000000298023224,
      "{f23e83fc}": 2
    },
    "unique": false
  },
  "TFT5_Item_HextechGunbladeRadiant": {
    "name": "Hextech Lifeblade",
    "values": {
      "AD": 0.4000000059604645,
      "AP": 40,
      "AllyHealing": 0.4000000059604645,
      "Omnivamp": 35,
      "StatOmnivamp": 0.30000001192092896
    },
    "unique": false
  },
  "TFT5_Item_InfinityEdgeRadiant": {
    "name": "Zenith Edge",
    "values": {
      "AD": 0.6499999761581421,
      "CritChance": 75,
      "CritDamageToGive": 0.10000000149011612
    },
    "unique": false
  },
  "TFT5_Item_IonicSparkRadiant": {
    "name": "Covalent Spark",
    "values": {
      "AP": 15,
      "Health": 200,
      "HealthRegenInterval": 1,
      "HexRange": 3,
      "MRShred": 30,
      "MagicResist": 40,
      "ManaRatio": 200,
      "MaxHealthRegen": 1.5
    },
    "unique": false
  },
  "TFT5_Item_JeweledGauntletRadiant": {
    "name": "Glamorous Gauntlet",
    "values": {
      "AP": 55,
      "CritChance": 75,
      "CritDamageToGive": 0.10000000149011612
    },
    "unique": false
  },
  "TFT5_Item_LastWhisperRadiant": {
    "name": "Eternal Whisper",
    "values": {
      "AD": 0.44999998807907104,
      "AS": 25,
      "ArmorBreakDuration": 50,
      "ArmorReductionPercent": 30,
      "CritChance": 55
    },
    "unique": true
  },
  "TFT5_Item_LeviathanRadiant": {
    "name": "The Baron's Gift",
    "values": {
      "AP": 30,
      "AS": 20,
      "ASDuration": 8,
      "AttackSpeedToGive": 120,
      "Health": 200
    },
    "unique": false
  },
  "TFT5_Item_MorellonomiconRadiant": {
    "name": "More More-ellonomicon",
    "values": {
      "AP": 50,
      "AS": 25,
      "BurnDuration": 30,
      "BurnPercent": 2,
      "GrievousWoundsPercent": 33,
      "Health": 150,
      "MonsterCap": 150,
      "TicksPerSecond": 1
    },
    "unique": true
  },
  "TFT5_Item_NightHarvesterRadiant": {
    "name": "Legacy of the Colossus",
    "values": {
      "Armor": 40,
      "BaseDamageReduction": 16,
      "BaseDurability": 0.1599999964237213,
      "CritChance": 20,
      "EmpowerDamageReduction": 30,
      "EmpoweredDurability": 0.30000001192092896,
      "Health": 500,
      "ThresholdForEmpower": 0.4000000059604645
    },
    "unique": false
  },
  "TFT5_Item_QuicksilverRadiant": {
    "name": "Quickestsilver",
    "values": {
      "AS": 50,
      "ASTotalDuration": 18,
      "CritChance": 40,
      "MagicResist": 30,
      "ProcAttackSpeed": 0.07000000029802322,
      "ProcInterval": 2,
      "SpellShieldDuration": 45
    },
    "unique": true
  },
  "TFT5_Item_RabadonsDeathcapRadiant": {
    "name": "Rabadon's Ascended Deathcap",
    "values": {
      "AP": 70,
      "BonusDamage": 0.5,
      "{1543aa48}": 0.33000001311302185
    },
    "unique": false
  },
  "TFT5_Item_RapidFirecannonRadiant": {
    "name": "Crest of Cinders",
    "values": {
      "AS": 60,
      "BonusDamage": 0.10000000149011612,
      "BurnPercent": 2,
      "Duration": 5,
      "HealingReductionPct": 33,
      "HexRangeIncrease": 2,
      "{1543aa48}": 0.10000000149011612
    },
    "unique": false
  },
  "TFT5_Item_RedemptionRadiant": {
    "name": "Absolution",
    "values": {
      "AoEDamageReduction": 10,
      "HealTickRate": 5,
      "Health": 400,
      "HexRadius": 2,
      "Mana": 15,
      "MaxHeal": 2000,
      "MissingHealthHeal": 25
    },
    "unique": false
  },
  "TFT5_Item_RunaansHurricaneRadiant": {
    "name": "Runaan's Tempest",
    "values": {
      "AD": 0.3499999940395355,
      "AS": 20,
      "AdditionalTargets": 1,
      "MagicResist": 20,
      "MultiplierForDamage": 110
    },
    "unique": false
  },
  "TFT5_Item_SpearOfShojinRadiant": {
    "name": "Spear of Hirana",
    "values": {
      "AD": 0.3499999940395355,
      "AP": 35,
      "FlatManaRestore": 10,
      "Mana": 20
    },
    "unique": false
  },
  "TFT5_Item_SpectralGauntletRadiant": {
    "name": "Equinox",
    "values": {
      "ARReductionAmount": 30,
      "BonusResistDuration": 20,
      "BonusResists": 70,
      "Health": 500,
      "HexRange": 3,
      "MagicResist": 30
    },
    "unique": false
  },
  "TFT5_Item_StatikkShivRadiant": {
    "name": "Statikk's Favor",
    "values": {
      "1StarBounces": 8,
      "AP": 50,
      "AS": 20,
      "Damage": 95,
      "MRShred": 30,
      "MRShredDuration": 5,
      "Mana": 15,
      "{12a15e9e}": 8,
      "{15144cec}": 8,
      "{79e2ec7b}": 8
    },
    "unique": false
  },
  "TFT5_Item_SteraksGageRadiant": {
    "name": "Sterak's Megashield",
    "values": {
      "AD": 0.30000001192092896,
      "BonusADToGive": 60,
      "BonusMaxHealthPerc": 40,
      "Health": 400,
      "HealthThreshold": 60
    },
    "unique": false
  },
  "TFT5_Item_SunfireCapeRadiant": {
    "name": "Sunlight Cape",
    "values": {
      "Armor": 40,
      "BonusPercentHP": 0.11999999731779099,
      "BurnDuration": 30,
      "BurnPercent": 2,
      "GrievousWoundsPercent": 33,
      "Health": 300,
      "HealthRegenInterval": null,
      "HexRange": 3,
      "ICD": 1.5,
      "MaxHealthRegen": null,
      "MonsterCap": 150
    },
    "unique": true
  },
  "TFT5_Item_ThiefsGlovesRadiant": {
    "name": "Rascal's Gloves",
    "values": {
      "CritChance": 20,
      "Health": 150
    },
    "unique": false
  },
  "TFT5_Item_TitansResolveRadiant": {
    "name": "Titan's Vow",
    "values": {
      "AS": 30,
      "Armor": 35,
      "BonusResistsAtStackCap": 50,
      "StackCap": 25,
      "StackingAD": 0.029999999329447746,
      "StackingSP": 3
    },
    "unique": false
  },
  "TFT5_Item_TrapClawRadiant": {
    "name": "Willbreaker",
    "values": {
      "AP": 30,
      "AS": 30,
      "CritChance": 20,
      "DamageAmp": 0.30000001192092896,
      "Duration": 3,
      "Health": 150,
      "{1543aa48}": 0.20000000298023224
    },
    "unique": false
  },
  "TFT5_Item_WarmogsArmorRadiant": {
    "name": "Warmog's Pride",
    "values": {
      "BonusPercentHP": 0.20000000298023224,
      "Health": 1000,
      "HealthRegenInterval": 1,
      "MaxHealthRegen": 1.5
    },
    "unique": false
  },
  "TFT_Item_ForceOfNature": {
    "name": "Tactician's Crown",
    "values": {
      "MaxArmySizeIncrease": 1,
      "PercentGoldChance": 10
    },
    "unique": false
  }
});
/** Adopted 12/17 B balance values; the archive mirror continues to read the unchanged table above. */
export const G23_SPECIAL_ITEM_SOURCE = freezeContent(Object.fromEntries(
 Object.entries(G23_ARCHIVED_SPECIAL_ITEM_SOURCE).map(([id, source]) => [id, {
  ...source, values:{...source.values,...CHEM_BARON_B_OVERRIDES[id]},
 }]),
)) as typeof G23_ARCHIVED_SPECIAL_ITEM_SOURCE;
export const G23_SPECIAL_ITEM_POOLS=freezeContent({
  "RADIANTITEMS_SET5": [
    "TFT5_Item_ThiefsGlovesRadiant",
    "TFT5_Item_FrozenHeartRadiant",
    "TFT5_Item_ArchangelsStaffRadiant",
    "TFT5_Item_RedemptionRadiant",
    "TFT5_Item_CrownguardRadiant",
    "TFT5_Item_WarmogsArmorRadiant",
    "TFT5_Item_TrapClawRadiant",
    "TFT5_Item_LeviathanRadiant",
    "TFT5_Item_BrambleVestRadiant",
    "TFT5_Item_DragonsClawRadiant",
    "TFT5_Item_GuardianAngelRadiant",
    "TFT5_Item_IonicSparkRadiant",
    "TFT5_Item_GargoyleStoneplateRadiant",
    "TFT5_Item_SunfireCapeRadiant",
    "TFT5_Item_TitansResolveRadiant",
    "TFT5_Item_SpectralGauntletRadiant",
    "TFT5_Item_NightHarvesterRadiant",
    "TFT5_Item_DeathbladeRadiant",
    "TFT5_Item_BloodthirsterRadiant",
    "TFT5_Item_SteraksGageRadiant",
    "TFT5_Item_InfinityEdgeRadiant",
    "TFT5_Item_RapidFirecannonRadiant",
    "TFT5_Item_RunaansHurricaneRadiant",
    "TFT5_Item_GuinsoosRagebladeRadiant",
    "TFT5_Item_StatikkShivRadiant",
    "TFT5_Item_LastWhisperRadiant",
    "TFT5_Item_QuicksilverRadiant",
    "TFT5_Item_HandOfJusticeRadiant",
    "TFT5_Item_SpearOfShojinRadiant",
    "TFT5_Item_AdaptiveHelmRadiant",
    "TFT5_Item_MorellonomiconRadiant",
    "TFT5_Item_RabadonsDeathcapRadiant",
    "TFT5_Item_BlueBuffRadiant",
    "TFT5_Item_JeweledGauntletRadiant",
    "TFT5_Item_HextechGunbladeRadiant",
    "TFT5_Item_GiantSlayerRadiant"
  ],
  "ORNNARTIFACTS_SET6": [
    "TFT4_Item_OrnnAnimaVisage",
    "TFT4_Item_OrnnDeathsDefiance",
    "TFT4_Item_OrnnInfinityForce",
    "TFT4_Item_OrnnMuramana",
    "TFT4_Item_OrnnTheCollector",
    "TFT4_Item_OrnnZhonyasParadox",
    "TFT9_Item_OrnnHullbreaker",
    "TFT9_Item_OrnnDeathfireGrasp",
    "TFT9_Item_OrnnHorizonFocus",
    "TFT9_Item_OrnnTrickstersGlass",
    "TFT7_Item_ShimmerscaleGamblersBlade",
    "TFT7_Item_ShimmerscaleMogulsMail",
    "TFT_Item_Artifact_TalismanOfAscension",
    "TFT_Item_Artifact_Fishbones",
    "TFT_Item_Artifact_SuspiciousTrenchCoat",
    "TFT_Item_Artifact_HorizonFocus",
    "TFT_Item_Artifact_Mittens",
    "TFT_Item_Artifact_UnendingDespair",
    "TFT_Item_Artifact_RapidFirecannon",
    "TFT_Item_Artifact_InnervatingLocket",
    "TFT_Item_Artifact_LudensTempest",
    "TFT_Item_Artifact_SilvermereDawn",
    "TFT_Item_Artifact_ProwlersClaw",
    "TFT_Item_Artifact_SpectralCutlass",
    "TFT_Item_Artifact_BlightingJewel",
    "TFT_Item_Artifact_WitsEnd",
    "TFT_Item_Artifact_LichBane",
    "TFT_Item_Artifact_LightshieldCrest",
    "TFT_Item_Artifact_SeekersArmguard"
  ],
  "SUPPORTITEMS": [
    "TFT_Item_ZekesHerald",
    "TFT_Item_Chalice",
    "TFT4_Item_OrnnRanduinsSanctum",
    "TFT_Item_Shroud",
    "TFT_Item_Zephyr",
    "TFT5_Item_ZzRotPortalRadiant",
    "TFT_Item_LocketOfTheIronSolari",
    "TFT4_Item_OrnnObsidianCleaver",
    "TFT_Item_AegisOfTheLegion",
    "TFT_Item_RadiantVirtue",
    "TFT7_Item_ShimmerscaleHeartOfGold",
    "TFT_Item_BansheesVeil",
    "TFT_Item_EternalFlame",
    "TFT_Item_SupportKnightsVow",
    "TFT_Item_Moonstone",
    "TFT_Item_Spite",
    "TFT_Item_UnstableTreasureChest"
  ],
  "Tier0": [
    "TFT13_Crime_Bronze_ChemGrips",
    "TFT13_Crime_Bronze_MageGuard",
    "TFT13_Crime_Bronze_MiningGauntlet"
  ],
  "Tier1": [
    "TFT13_Crime_Silver_DestabilizedChemtank",
    "TFT13_Crime_Silver_ExecutionersVorpalblade",
    "TFT13_Crime_Silver_FleshRipper",
    "TFT13_Crime_Silver_PiltovenHexplating",
    "TFT13_Crime_Silver_ShimmerBloom",
    "TFT13_Crime_Silver_UnleashedToxins",
    "TFT13_Crime_Silver_VirulentVirus",
    "TFT13_Crime_Silver_VoltaicSaber"
  ],
  "Tier2": [
    "TFT13_Crime_Gold_DestabilizedChemtank",
    "TFT13_Crime_Gold_ExecutionersVorpalblade",
    "TFT13_Crime_Gold_FleshRipper",
    "TFT13_Crime_Gold_PiltovenHexplating",
    "TFT13_Crime_Gold_ShimmerBloom",
    "TFT13_Crime_Gold_UnleashedToxins",
    "TFT13_Crime_Gold_VirulentVirus",
    "TFT13_Crime_Gold_VoltaicSaber"
  ],
  "Tier3": [
    "TFT13_Crime_Prismatic_DestabilizedChemtank",
    "TFT13_Crime_Prismatic_ExecutionersVorpalblade",
    "TFT13_Crime_Prismatic_FleshRipper",
    "TFT13_Crime_Prismatic_PiltovenHexplating",
    "TFT13_Crime_Prismatic_ShimmerBloom",
    "TFT13_Crime_Prismatic_UnleashedToxins",
    "TFT13_Crime_Prismatic_VirulentVirus",
    "TFT13_Crime_Prismatic_VoltaicSaber"
  ],
  "Tier4": [
    "TFT13_Crime_OmegaPrismatic_DimensionalHeirloom"
  ]
});
export const G23_RADIANT_MAPPING=freezeContent({
  "crownguard": "TFT5_Item_CrownguardRadiant",
  "ionic-spark": "TFT5_Item_IonicSparkRadiant",
  "jeweled-gauntlet": "TFT5_Item_JeweledGauntletRadiant",
  "morellonomicon": "TFT5_Item_MorellonomiconRadiant",
  "quicksilver": "TFT5_Item_QuicksilverRadiant",
  "evenshroud": "TFT5_Item_SpectralGauntletRadiant",
  "adaptive-helm": "TFT5_Item_AdaptiveHelmRadiant",
  "blue-buff": "TFT5_Item_BlueBuffRadiant",
  "protectors-vow": "TFT5_Item_FrozenHeartRadiant",
  "redemption": "TFT5_Item_RedemptionRadiant",
  "hand-of-justice": "TFT5_Item_HandOfJusticeRadiant",
  "guardbreaker": "TFT5_Item_TrapClawRadiant",
  "last-whisper": "TFT5_Item_LastWhisperRadiant",
  "nashors-tooth": "TFT5_Item_LeviathanRadiant",
  "red-buff": "TFT5_Item_RapidFirecannonRadiant",
  "runaans-hurricane": "TFT5_Item_RunaansHurricaneRadiant",
  "statikk-shiv": "TFT5_Item_StatikkShivRadiant",
  "titans-resolve": "TFT5_Item_TitansResolveRadiant",
  "rageblade": "TFT5_Item_GuinsoosRagebladeRadiant",
  "deathblade": "TFT5_Item_DeathbladeRadiant",
  "shojin": "TFT5_Item_SpearOfShojinRadiant",
  "archangel": "TFT5_Item_ArchangelsStaffRadiant",
  "deathcap": "TFT5_Item_RabadonsDeathcapRadiant",
  "warmog": "TFT5_Item_WarmogsArmorRadiant",
  "dragons-claw": "TFT5_Item_DragonsClawRadiant",
  "gargoyle": "TFT5_Item_GargoyleStoneplateRadiant",
  "gunblade": "TFT5_Item_HextechGunbladeRadiant",
  "bloodthirster": "TFT5_Item_BloodthirsterRadiant",
  "edge-of-night": "TFT5_Item_GuardianAngelRadiant",
  "infinity-edge": "TFT5_Item_InfinityEdgeRadiant",
  "giant-slayer": "TFT5_Item_GiantSlayerRadiant",
  "steraks-gage": "TFT5_Item_SteraksGageRadiant",
  "thiefs-gloves": "TFT5_Item_ThiefsGlovesRadiant",
  "bramble-vest": "TFT5_Item_BrambleVestRadiant",
  "steadfast-heart": "TFT5_Item_NightHarvesterRadiant",
  "sunfire-cape": "TFT5_Item_SunfireCapeRadiant"
});
