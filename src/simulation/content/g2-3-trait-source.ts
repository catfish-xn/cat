// G2-3: hash-locked 14.24 source + explicitly documented 14.24b overrides.
import { freezeContent } from './freeze';
export const G23_TRAIT_SOURCE = freezeContent({
  "automata": {
    "apiName": "TFT13_Hextech",
    "name": "Automata",
    "description": "Automata gain a crystal when they deal damage. At @TriggerNumCrystals@&nbsp;crystals, they blast their current target, dealing magic damage + <magicDamage>@ConversionDamagePct*100@%</magicDamage> of damage dealt since the previous blast and reset. They also gain Armor and Magic&nbsp;Resist.<br><br><expandRow>(@MinUnits@) <magicDamage>@MagicDamage@</magicDamage> damage, @Resists@&nbsp;%i:scaleArmor%%i:scaleMR%</expandRow>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "ConversionDamagePct": 0.25,
          "MagicDamage": 150.0,
          "Resists": 25.0,
          "TriggerNumCrystals": 20.0,
          "{a142f31c}": 1.0
        }
      },
      {
        "threshold": 4,
        "values": {
          "ConversionDamagePct": 0.25,
          "MagicDamage": 400.0,
          "Resists": 60.0,
          "TriggerNumCrystals": 20.0,
          "{a142f31c}": 1.0
        }
      },
      {
        "threshold": 6,
        "values": {
          "ConversionDamagePct": 0.25,
          "MagicDamage": 1100.0,
          "Resists": 140.0,
          "TriggerNumCrystals": 20.0,
          "{a142f31c}": 1.0
        }
      }
    ]
  },
  "sorcerer": {
    "apiName": "TFT13_Sorcerer",
    "name": "Sorcerer",
    "description": "Your team gains @TeamAP@ Ability Power. Sorcerers gain more.<br><br><row>(@MinUnits@) @BaseAP@&nbsp;%i:scaleAP%</row><br><row>(@MinUnits@) @BaseAP@&nbsp;%i:scaleAP%</row><br><row>(@MinUnits@) @BaseAP@&nbsp;%i:scaleAP%</row><br><row>(@MinUnits@) @BaseAP@&nbsp;%i:scaleAP%, Abilities reduce their target's damage by @DamageDecrease*100@% for @DamageDecreaseDuration@&nbsp;seconds</row>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "BaseAP": 20.0,
          "TeamAP": 10.0
        }
      },
      {
        "threshold": 4,
        "values": {
          "BaseAP": 50.0,
          "TeamAP": 10.0
        }
      },
      {
        "threshold": 6,
        "values": {
          "BaseAP": 95.0,
          "TeamAP": 10.0
        }
      },
      {
        "threshold": 8,
        "values": {
          "BaseAP": 110.0,
          "DamageDecrease": 0.25,
          "DamageDecreaseDuration": 3.0,
          "TeamAP": 10.0
        }
      }
    ]
  },
  "scrap": {
    "apiName": "TFT13_Scrap",
    "name": "Scrap",
    "description": "Combat start: Components held by Scrap units temporarily turn into full items. Scrap units gain Shield for @ShieldDuration@ seconds for each component held by your team, including those that make up a full item.<br><br><row>(@MinUnits@) @NumComponents@ component, @HPShieldAmount@ Shield</row><br><row>(@MinUnits@) @NumComponents@ components, @HPShieldAmount@ Shield</row><br><row>(@MinUnits@) All components, and full items become lucky! @HPShieldAmount@ Shield</row><br><row>(@MinUnits@) Generate Radiant items! @HPShieldAmount@ Shield</row><br><br><rules>Shield Amount:&nbsp;@TFTUnitProperty.:TFT13_Trait_Scrap_ShieldTotal@ </rules> <br>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "HPShieldAmount": 25.0,
          "NumComponents": 1.0,
          "ShieldDuration": 20.0,
          "{659aef8d}": null,
          "{7e2474c8}": null
        }
      },
      {
        "threshold": 4,
        "values": {
          "HPShieldAmount": 35.0,
          "NumComponents": 3.0,
          "ShieldDuration": 20.0,
          "{659aef8d}": null,
          "{7e2474c8}": null
        }
      },
      {
        "threshold": 6,
        "values": {
          "HPShieldAmount": 50.0,
          "NumComponents": 20.0,
          "ShieldDuration": 20.0,
          "{659aef8d}": 1.0,
          "{7e2474c8}": null
        }
      },
      {
        "threshold": 9,
        "values": {
          "HPShieldAmount": 60.0,
          "NumComponents": 20.0,
          "ShieldDuration": 20.0,
          "{659aef8d}": 1.0,
          "{7e2474c8}": 1.0
        }
      }
    ]
  },
  "artillerist": {
    "apiName": "TFT13_Martialist",
    "name": "Artillerist",
    "description": "Every @NumOfAttacks@ attacks, Artillerists launch a rocket that deals @PercentDamage*100@% Attack Damage around the target. They also gain Attack Damage.<br><br><row>(@MinUnits@) @AD*100@% %i:scaleAD%</row><br><row>(@MinUnits@) @AD*100@%&nbsp;%i:scaleAD%</row><br><row>(@MinUnits@) @AD*100@%&nbsp;%i:scaleAD%, Launch a rocket every @NumOfAttacks@ attacks that deals double&nbsp;damage.</row>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "AD": 0.1,
          "NumOfAttacks": 5.0,
          "PercentDamage": 1.25
        }
      },
      {
        "threshold": 4,
        "values": {
          "AD": 0.45,
          "NumOfAttacks": 5.0,
          "PercentDamage": 1.25
        }
      },
      {
        "threshold": 6,
        "values": {
          "AD": 0.6,
          "NumOfAttacks": 4.0,
          "PercentDamage": 2.5
        }
      }
    ]
  },
  "form-swapper": {
    "apiName": "TFT13_FormSwapper",
    "name": "Form Swapper",
    "description": "Innate: Form Swappers change their stats and ability based on if they're placed in the front 2 rows or back 2&nbsp;rows.<br><br>Frontline Form Swappers gain Durability. Backline Form Swappers gain Damage&nbsp;Amp.<br><br><expandRow>(@MinUnits@) @DR*100@%&nbsp;%i:scaleDR% or @DA*100@%&nbsp;%i:scaleDA%</expandRow>",
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
    "apiName": "TFT13_Ambassador",
    "name": "Emissary",
    "description": "This trait is active only when you have exactly 1 or 4 unique Emissaries. <br><br><row>(@MinUnits@) Gain that Emissary's bonus</row><br><row>(@MinUnits@) Gain all bonuses. Emissaries gain @BonusHealth@&nbsp;%i:scaleHealth% and @SelfishDamageAmp*100@%&nbsp;%i:scaleDA%</row><br><br><TFTGuildActive enabled=TFT13_Trait_Ambassador_ActiveDomina alternate=TFTGuildInactive>Ambessa: Allies gain @AmbessaArmor@ Armor and Magic Resist for each opponent defeated. (@TFTUnitProperty.trait:TFT13_Ambassador_PlayersDefeated@/7)</TFTGuildActive><br><br><TFTGuildActive enabled=TFT13_Trait_Ambassador_ActiveJarvan alternate=TFTGuildInactive>Garen: On Combat Start, Garen and allies to his left and right gain @GarenHealthPercent*100@% of his max Health.</TFTGuildActive><br><br><TFTGuildActive enabled=TFT13_Trait_Ambassador_ActiveNami alternate=TFTGuildInactive>Nami: Allies' attacks grant @NamiMana@ bonus Mana.</TFTGuildActive><br><br><TFTGuildActive enabled=TFT13_Trait_Ambassador_ActiveTristana alternate=TFTGuildInactive>Tristana: Allies gain @StarAS*100@% Attack Speed per star level.</TFTGuildActive>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 1,
        "values": {
          "AmbessaArmor": 2.0,
          "AmbessaArmor_PVE": 4.0,
          "BonusAS": null,
          "BonusHealth": 200.0,
          "CCImmuneDuration": 8.0,
          "GarenHealthPercent": 0.12,
          "NamiMana": 2.0,
          "SelfishDamageAmp": 0.2,
          "StarAS": 0.06,
          "{3854f478}": 2.0,
          "{4b20f990}": null,
          "{845be53a}": 4.0
        }
      },
      {
        "threshold": 4,
        "values": {
          "AmbessaArmor": 2.0,
          "AmbessaArmor_PVE": 4.0,
          "BonusAS": null,
          "BonusHealth": 200.0,
          "CCImmuneDuration": 8.0,
          "GarenHealthPercent": 0.12,
          "NamiMana": 2.0,
          "SelfishDamageAmp": 0.2,
          "StarAS": 0.06,
          "{3854f478}": 2.0,
          "{4b20f990}": null,
          "{845be53a}": 4.0
        }
      }
    ]
  },
  "sentinel": {
    "apiName": "TFT13_Titan",
    "name": "Sentinel",
    "description": "Your team gains Armor and Magic Resist. Sentinels gain triple.<br><br><expandRow>(@MinUnits@) @BonusArmor@&nbsp;%i:scaleArmor%%i:scaleMR%</expandRow>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "BonusArmor": 12.0,
          "{5921fc26}": 2.0
        }
      },
      {
        "threshold": 4,
        "values": {
          "BonusArmor": 25.0,
          "{5921fc26}": 2.0
        }
      },
      {
        "threshold": 6,
        "values": {
          "BonusArmor": 42.0,
          "{5921fc26}": 2.0
        }
      }
    ]
  },
  "family": {
    "apiName": "TFT13_Family",
    "name": "Family",
    "description": "Family members support each other, reducing their max Mana and gaining extra bonuses.<br><br><row>(@MinUnits@) @ManaReduction*100@% reduction, @DamageReduction*100@%&nbsp;%i:scaleDR%</row><br><row>(@MinUnits@) @ManaReduction*100@% reduction, @AttackSpeed*100@%&nbsp;%i:scaleAS%</row><br><row>(@MinUnits@) @ManaReduction*100@% reduction, heist on topside! After combat, progress the heist, increased for each surviving Family&nbsp;member!</row><br><br><rules>@TFTUnitProperty.trait:TFT13_JunkerKing_SelfDestructTRA@</rules>",
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
          "{6fc9f267}": 17.0,
          "{8173be81}": 2.0,
          "{9000fe5b}": 2.0,
          "{92029cea}": 0.5
        }
      }
    ]
  },
  "ambusher": {
    "apiName": "TFT13_Ambusher",
    "name": "Ambusher",
    "description": "Damage from Ambushers' Abilities can critically strike. They also gain bonus Critical Strike Chance and Critical Strike Damage.<br><br><row>(@MinUnits@) @CritChance*100@%&nbsp;%i:scaleCrit%, @CritDamage*100@%&nbsp;%i:scaleCritMult%</row><br><row>(@MinUnits@) @CritChance*100@%&nbsp;%i:scaleCrit%, @CritDamage*100@%&nbsp;%i:scaleCritMult%</row><br><row>(@MinUnits@) @CritChance*100@%&nbsp;%i:scaleCrit%, @CritDamage*100@%&nbsp;%i:scaleCritMult%</row><br><row>(@MinUnits@) @CritChance*100@%&nbsp;%i:scaleCrit%, @CritDamage*100@%&nbsp;%i:scaleCritMult%; also gain @DamageReductionPct*100@% Durability</row>",
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
    "apiName": "TFT13_Invoker",
    "name": "Visionary",
    "description": "Whenever Visionaries gain Mana, they gain more.<br><br><row>(@MinUnits@) @EnlightenedBonusMana*100@% %i:scaleMana%</row><br><row>(@MinUnits@) @EnlightenedBonusMana*100@%&nbsp;%i:scaleMana%</row><br><row>(@MinUnits@) @EnlightenedBonusMana*100@%&nbsp;%i:scaleMana%</row><br><row>(@MinUnits@) @EnlightenedBonusMana*100@%&nbsp;%i:scaleMana%, Abilities heal an ally for @AllyHealing*100@% of damage dealt</row><br>",
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
          "EnlightenedBonusMana": 1.0
        }
      }
    ]
  },
  "sniper": {
    "apiName": "TFT13_Sniper",
    "name": "Sniper",
    "description": "Snipers deal more damage to targets farther away.<br><br><row>(@MinUnits@) @PercentDamageIncrease@%&nbsp;damage per hex</row><br><row>(@MinUnits@) @PercentDamageIncrease@%&nbsp;damage per hex</row><br><row>(@MinUnits@) @PercentDamageIncrease@%&nbsp;damage per hex and +@BonusHexRangeIncrease@ Attack Range</row>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "BonusHexRangeIncrease": null,
          "PercentDamageIncrease": 7.0
        }
      },
      {
        "threshold": 4,
        "values": {
          "BonusHexRangeIncrease": null,
          "PercentDamageIncrease": 16.0
        }
      },
      {
        "threshold": 6,
        "values": {
          "BonusHexRangeIncrease": 5.0,
          "PercentDamageIncrease": 35.0
        }
      }
    ]
  },
  "conqueror": {
    "apiName": "TFT13_Warband",
    "name": "Conqueror",
    "description": "Conquerors' takedowns grant stacks of Conquest. After gaining enough Conquest, open War Chests full of loot!<br><br>Conquerors gain Attack Damage and Ability Power, increased by @PercentIncreasePerChest*100@% for each War Chest opened.<br><br><expandRow>(@MinUnits@) @ADAPBase*100@%&nbsp;%i:scaleAD%%i:scaleAP%; @StacksPerKill@x&nbsp;Conquest</expandRow><br><br><rules>War Chests Opened: @TFTUnitProperty.trait:TFT13_Warband_ChestsCompleted@</rules><br><rules>Current Stats: @TFTUnitProperty.trait:TFT13_Warband_CurrentADAP@%&nbsp;%i:scaleAD%%i:scaleAP%</rules><br>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "ADAPBase": 0.18,
          "PercentIncreasePerChest": 0.03,
          "StacksPerKill": 1.0
        }
      },
      {
        "threshold": 4,
        "values": {
          "ADAPBase": 0.25,
          "PercentIncreasePerChest": 0.03,
          "StacksPerKill": 3.0
        }
      },
      {
        "threshold": 6,
        "values": {
          "ADAPBase": 0.4,
          "PercentIncreasePerChest": 0.03,
          "StacksPerKill": 6.0
        }
      },
      {
        "threshold": 9,
        "values": {
          "ADAPBase": 1.0,
          "PercentIncreasePerChest": 0.03,
          "StacksPerKill": 20.0
        }
      }
    ]
  },
  "high-roller": {
    "apiName": "TFT13_HighRoller",
    "name": "High Roller",
    "description": "When casting, Sevika rolls a random Jinx modification to her Ability and gains @Durability*100@% Durability for @Duration@ seconds.<br><br>Mods:<br>-Rocket: Launch @Bonus1NumRockets@ rockets that deal @Bonus1RocketDamage@ physical damage each<br>-Shield: Gain @Bonus2ShieldAmount@ Shield for @Bonus2ShieldDuration@ seconds<br>-Coin: Gain @Bonus4Gold@ gold<br>-Triple: Enhance her rolled ability!",
    "enabled": true,
    "tiers": [
      {
        "threshold": 1,
        "values": {
          "Bonus1NumRockets": 8.0,
          "Bonus1RocketDamage": 100.0,
          "Bonus2ShieldAmount": 500.0,
          "Bonus2ShieldDuration": 4.0,
          "Bonus4Gold": 3.0,
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
    "apiName": "TFT13_Academy",
    "name": "Academy",
    "description": "The Academy sponsors 3 items each game.<br><br>Copies of sponsored items grant bonus max Health and Damage Amp. Academy units holding sponsored items gain double the amount, plus an additional @BaseValues*100@% Health and Damage Amp.<br><br><row>(@MinUnits@) @PercentIncreaseSponsored*100@% %i:scaleHealth% %i:scaleDA%;<br>gain 1 sponsored item.</row><br><row>(@MinUnits@) @PercentIncreaseSponsored*100@% %i:scaleHealth% %i:scaleDA%;<br>gain 1 sponsored item.</row><br><row>(@MinUnits@) @PercentIncreaseSponsored*100@% %i:scaleHealth% %i:scaleDA%;<br>gain 1 sponsored item.</row><br><row>(@MinUnits@) @PercentIncreaseSponsored*100@% %i:scaleHealth% %i:scaleDA%</row>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 3,
        "values": {
          "BaseValues": 0.05,
          "NumOfItems": 1.0,
          "PercentIncreaseSponsored": 0.02
        }
      },
      {
        "threshold": 4,
        "values": {
          "BaseValues": 0.05,
          "NumOfItems": 2.0,
          "PercentIncreaseSponsored": 0.03
        }
      },
      {
        "threshold": 5,
        "values": {
          "BaseValues": 0.05,
          "NumOfItems": 3.0,
          "PercentIncreaseSponsored": 0.05
        }
      },
      {
        "threshold": 6,
        "values": {
          "BaseValues": 0.05,
          "NumOfItems": 3.0,
          "PercentIncreaseSponsored": 0.09
        }
      }
    ]
  },
  "chem-baron": {
    "apiName": "TFT13_Crime",
    "name": "Chem-Baron",
    "description": "Gain Shimmer after each player combat. If your loss streak is at least @MinStreakLength@, gain more.<br><br>At each stack of @ShimmerBreakpoint@ Shimmer, the Black Market offers you contraband that only Chem-Barons can use. Chem-Barons gain max Health for each Black Market you pass on.<br><br><expandRow>(@MinUnits@) @ShimmerPerCombat@ or @ShimmerPerCombatStreaking@; @HealthPerSkip@&nbsp;%i:scaleHealth%</expandRow><br><br><rules>Markets Skipped: @TFTUnitProperty.trait:TFT13_Crime_PassedMarkets@</rules><br><rules>Current Health: @TFTUnitProperty.trait:TFT13_Crime_CurrentHealth@&nbsp;%i:scaleHealth%</rules>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 3,
        "values": {
          "HealthPerSkip": 20.0,
          "MinStreakLength": 3.0,
          "ShimmerBreakpoint": 100.0,
          "ShimmerPerCombat": 15.0,
          "ShimmerPerCombatStreaking": 35.0,
          "ShimmerPerCombatStreaking_HR": 50.0,
          "ShimmerPerCombat_HR": 25.0,
          "ShimmerPerDeath_PVE": 1.0,
          "ShimmerPerRound_PVE": 15.0,
          "{ecbc38fd}": 1.0
        }
      },
      {
        "threshold": 4,
        "values": {
          "HealthPerSkip": 60.0,
          "MinStreakLength": 3.0,
          "ShimmerBreakpoint": 100.0,
          "ShimmerPerCombat": 20.0,
          "ShimmerPerCombatStreaking": 45.0,
          "ShimmerPerCombatStreaking_HR": 60.0,
          "ShimmerPerCombat_HR": 30.0,
          "ShimmerPerDeath_PVE": 1.0,
          "ShimmerPerRound_PVE": 20.0,
          "{ecbc38fd}": 1.0
        }
      },
      {
        "threshold": 5,
        "values": {
          "HealthPerSkip": 110.0,
          "MinStreakLength": 3.0,
          "ShimmerBreakpoint": 100.0,
          "ShimmerPerCombat": 20.0,
          "ShimmerPerCombatStreaking": 55.0,
          "ShimmerPerCombatStreaking_HR": 70.0,
          "ShimmerPerCombat_HR": 35.0,
          "ShimmerPerDeath_PVE": 2.0,
          "ShimmerPerRound_PVE": 30.0,
          "{ecbc38fd}": 1.0
        }
      },
      {
        "threshold": 6,
        "values": {
          "HealthPerSkip": 160.0,
          "MinStreakLength": 3.0,
          "ShimmerBreakpoint": 100.0,
          "ShimmerPerCombat": 25.0,
          "ShimmerPerCombatStreaking": 70.0,
          "ShimmerPerCombatStreaking_HR": 90.0,
          "ShimmerPerCombat_HR": 45.0,
          "ShimmerPerDeath_PVE": 3.0,
          "ShimmerPerRound_PVE": 40.0,
          "{ecbc38fd}": 1.0
        }
      },
      {
        "threshold": 7,
        "values": {
          "HealthPerSkip": 220.0,
          "MinStreakLength": 3.0,
          "ShimmerBreakpoint": 100.0,
          "ShimmerPerCombat": 30.0,
          "ShimmerPerCombatStreaking": 100.0,
          "ShimmerPerCombatStreaking_HR": 125.0,
          "ShimmerPerCombat_HR": 60.0,
          "ShimmerPerDeath_PVE": 15.0,
          "ShimmerPerRound_PVE": 65.0,
          "{ecbc38fd}": 1.0
        }
      }
    ]
  },
  "rebel": {
    "apiName": "TFT13_Rebel",
    "name": "Rebel",
    "description": "Rebels gain @MaxHealthIncrease*100@% max Health.<br><br>After your team loses @PercentHealthTrigger*100@% of their Health, a smoke signal appears, granting Rebels @BurstAS*100@% Attack Speed for @BurstDuration@ seconds and extra power for the rest of&nbsp;combat.<br><br><row>(@MinUnits@) @ADAP*100@%&nbsp;%i:scaleAD%%i:scaleAP%</row><br><row>(@MinUnits@) @ADAP*100@%&nbsp;%i:scaleAD%%i:scaleAP%, @PercentMaxHealthBonus*100@%&nbsp;%i:scaleHealth%</row><br><row>(@MinUnits@) @ADAP*100@%&nbsp;%i:scaleAD%%i:scaleAP%, @PercentMaxHealthBonus*100@%&nbsp;%i:scaleHealth%, and Stun all enemies for @StunDuration@&nbsp;seconds</row><br><row>(@MinUnits@) The smoke signal triggers at Combat Start and every @ForceDuration@&nbsp;seconds.</row>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 3,
        "values": {
          "ADAP": 0.2,
          "BurstAS": 0.6,
          "BurstDuration": 5.0,
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
          "BurstDuration": 5.0,
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
          "BurstDuration": 5.0,
          "ForceDuration": null,
          "MaxHealthIncrease": 0.12,
          "PercentHealthTrigger": 0.25,
          "PercentMaxHealthBonus": 0.15,
          "StunDuration": 2.0,
          "{1ec59053}": null
        }
      },
      {
        "threshold": 10,
        "values": {
          "ADAP": 0.5,
          "BurstAS": 0.6,
          "BurstDuration": 5.0,
          "ForceDuration": 12.0,
          "MaxHealthIncrease": 0.12,
          "PercentHealthTrigger": 0.25,
          "PercentMaxHealthBonus": 0.3,
          "StunDuration": 2.0,
          "{1ec59053}": 1.0
        }
      }
    ]
  },
  "dominator": {
    "apiName": "TFT13_Infused",
    "name": "Dominator",
    "description": "Combat start: Dominators gain a Shield for @ShieldDuration@ seconds.<br><br>When Dominators cast, they gain stacking Ability Power based on the Mana spent.<br><br><expandRow>(@MinUnits@) @ShieldAmount@ Shield, @APPercent*100@%&nbsp;%i:scaleAP%</expandRow>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "APPercent": 0.25,
          "ShieldAmount": 350.0,
          "ShieldDuration": 15.0
        }
      },
      {
        "threshold": 4,
        "values": {
          "APPercent": 0.45,
          "ShieldAmount": 500.0,
          "ShieldDuration": 15.0
        }
      },
      {
        "threshold": 6,
        "values": {
          "APPercent": 0.65,
          "ShieldAmount": 700.0,
          "ShieldDuration": 15.0
        }
      }
    ]
  },
  "pit-fighter": {
    "apiName": "TFT13_Pugilist",
    "name": "Pit Fighter",
    "description": "Pit Fighters gain @OmnivampPercent*100@% Omnivamp and deal bonus true damage. Once per combat at @HealthThreshold*100@% Health, they heal a percentage of their max Health over @Duration@ seconds.<br><br><expandRow>(@MinUnits@) @TrueDamagePercent*100@%&nbsp;true damage, @HealPercent*100@%&nbsp;%i:scaleHealth%</expandRow>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "Duration": 2.0,
          "HealPercent": 0.1,
          "HealthThreshold": 0.5,
          "OmnivampPercent": 0.15,
          "TrueDamagePercent": 0.06
        }
      },
      {
        "threshold": 4,
        "values": {
          "Duration": 2.0,
          "HealPercent": 0.25,
          "HealthThreshold": 0.5,
          "OmnivampPercent": 0.15,
          "TrueDamagePercent": 0.12
        }
      },
      {
        "threshold": 6,
        "values": {
          "Duration": 2.0,
          "HealPercent": 0.4,
          "HealthThreshold": 0.5,
          "OmnivampPercent": 0.15,
          "TrueDamagePercent": 0.2
        }
      },
      {
        "threshold": 8,
        "values": {
          "Duration": 2.0,
          "HealPercent": 0.8,
          "HealthThreshold": 0.5,
          "OmnivampPercent": 0.15,
          "TrueDamagePercent": 0.4
        }
      }
    ]
  },
  "enforcer": {
    "apiName": "TFT13_Squad",
    "name": "Enforcer",
    "description": "Combat Start: Enforcers gain Shield and Damage Amp. The highest Health enemy units become <i>WANTED!</i> <br><br>When a Wanted enemy dies, Enforcers gain @AttackSpeedPerWantedKill*100@% Attack Speed.<br><br><row>(@MinUnits@) @NumOfWantedEnemies@&nbsp;unit; @PercentMaxHealthShield*100*100@%&nbsp;%i:scaleHealth%,&nbsp;@BaseDA*100@%&nbsp;%i:scaleDA%</row><br><row>(@MinUnits@) @NumOfWantedEnemies@&nbsp;units; @PercentMaxHealthShield*100*100@%&nbsp;%i:scaleHealth%,&nbsp;@BaseDA*100@%&nbsp;%i:scaleDA%</row><br><row>(@MinUnits@) @NumOfWantedEnemies@&nbsp;units; @PercentMaxHealthShield*100*100@%&nbsp;%i:scaleHealth%,&nbsp;@BaseDA*100@%&nbsp;%i:scaleDA%</row><br><row>(@MinUnits@) @NumOfWantedEnemies@&nbsp;units; @PercentMaxHealthShield*100*100@%&nbsp;%i:scaleHealth%,&nbsp;@BaseDA*100@%&nbsp;%i:scaleDA%</row><br><row>(@MinUnits@) ALL enemies; @PercentMaxHealthShield*100*100@%&nbsp;%i:scaleHealth%, @BaseDA*100@%&nbsp;%i:scaleDA%; Combat Start: Confiscate all enemy&nbsp;items!</row>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "AttackSpeedPerWantedKill": 0.3,
          "BaseDA": 0.12,
          "NumOfWantedEnemies": 1.0,
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
          "NumOfWantedEnemies": 2.0,
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
          "NumOfWantedEnemies": 4.0,
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
          "NumOfWantedEnemies": 5.0,
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
          "NumOfWantedEnemies": 99.0,
          "PercentMaxHealthShield": 1.0,
          "{36b1550f}": null,
          "{9edd4912}": 1.0
        }
      }
    ]
  },
  "firelight": {
    "apiName": "TFT13_Hoverboard",
    "name": "Firelight",
    "description": "Every @Duration@ seconds, Firelights dash. While dashing, they attack with infinite range and heal a percentage of the damage taken since their last dash.<br><br><row>(@MinUnits@) @PercentDamageTakenHeal*100@% of damage taken</row><br><row>(@MinUnits@) @PercentDamageTakenHeal*100@% of damage taken</row><br><row>(@MinUnits@) @PercentDamageTakenHeal*100@% of damage taken. While dashing, gain a massive burst of Attack Speed.</row>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "Duration": 6.0,
          "PercentDamageTakenHeal": 0.2,
          "{0a9a9714}": null,
          "{3c0d594a}": 1.0
        }
      },
      {
        "threshold": 3,
        "values": {
          "Duration": 6.0,
          "PercentDamageTakenHeal": 0.33,
          "{0a9a9714}": null,
          "{3c0d594a}": 1.0
        }
      },
      {
        "threshold": 4,
        "values": {
          "Duration": 6.0,
          "PercentDamageTakenHeal": 0.4,
          "{0a9a9714}": 3.5,
          "{3c0d594a}": 1.0
        }
      }
    ]
  },
  "experiment": {
    "apiName": "TFT13_Experiment",
    "name": "Experiment",
    "description": "Gain Laboratory hexes on your board.<br><br>Combat start: Experiments standing on Laboratory hexes gain the Experiment bonuses of all Experiments on Laboratory hexes, plus max Health.<br><br><row>(@MinUnits@) @NumLaboratory@ Laboratories, @MaxHealth@&nbsp;%i:scaleHealth%</row><br><row>(@MinUnits@) @NumLaboratory@ Laboratories, @MaxHealth@&nbsp;%i:scaleHealth%</row><br><row>(@MinUnits@) Experiment bonuses increase by @ExperimentBonusIncrease*100@%!</row>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 3,
        "values": {
          "ExperimentBonusIncrease": null,
          "MaxHealth": 100.0,
          "NumLaboratory": 2.0,
          "{a02e81c2}": 1.15
        }
      },
      {
        "threshold": 5,
        "values": {
          "ExperimentBonusIncrease": null,
          "MaxHealth": 300.0,
          "NumLaboratory": 3.0,
          "{a02e81c2}": 1.3
        }
      },
      {
        "threshold": 7,
        "values": {
          "ExperimentBonusIncrease": 1.0,
          "MaxHealth": 300.0,
          "NumLaboratory": 3.0,
          "{a02e81c2}": 1.5
        }
      }
    ]
  },
  "bruiser": {
    "apiName": "TFT13_Bruiser",
    "name": "Bruiser",
    "description": "Your team gains @TeamFlatHealth@ max Health. Bruisers gain more.<br><br><expandRow>(@MinUnits@) @BonusPercentHealth*100@%&nbsp;%i:scaleHealth%</expandRow>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "BonusPercentHealth": 0.2,
          "TeamFlatHealth": 100.0
        }
      },
      {
        "threshold": 4,
        "values": {
          "BonusPercentHealth": 0.45,
          "TeamFlatHealth": 100.0
        }
      },
      {
        "threshold": 6,
        "values": {
          "BonusPercentHealth": 0.8,
          "TeamFlatHealth": 100.0
        }
      }
    ]
  },
  "junker-king": {
    "apiName": "TFT13_JunkerKing",
    "name": "Junker King",
    "description": "Every @NumRounds1Star@ rounds, open an armory to purchase permanent upgrades to your strongest Rumble's&nbsp;mech.<br><br><rules>Rounds Until Upgrade: @TFTUnitProperty.trait:TFT13_JunkerKing_RoundsUntilOpening@</rules>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 1,
        "values": {
          "NumRounds1Star": 3.0,
          "NumRounds1Star_HR": 2.0,
          "{7b91cfd3}": 2.0,
          "{da177dfb}": 1.0,
          "{ea33712c}": 3.0,
          "{ed4fa85a}": 1.0
        }
      }
    ]
  },
  "black-rose": {
    "apiName": "TFT13_Cabal",
    "name": "Black Rose",
    "description": "<row>(@MinUnits@) Summon a chained Sion. He is freed after @NumCastsToUnlock@ casts from Black Rose units or when he drops below @PercentHealthUnlock*100@% health.</row><br><row>(@MinUnits@) Sion grows stronger and his enemies take more damage from Black Rose units.</row><br><row>(@MinUnits@) Sion unleashes dark magic and heals to full Health when freed.</row><br><row>(@MinUnits@) When Sion dies, he restores to life with power beyond death!</row><br><br><rules>Each Black Rose champion's star level increases Sion's power</rules>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 3,
        "values": {
          "NumCastsToUnlock": 5.0,
          "PercentHealthPerStarLevel": 0.15,
          "PercentHealthUnlock": 0.65,
          "{2c6be05c}": 0.12,
          "{2e45fc86}": 40.0,
          "{85b293ec}": 0.35,
          "{92ef9cd7}": 4.0
        }
      },
      {
        "threshold": 4,
        "values": {
          "NumCastsToUnlock": 5.0,
          "PercentHealthPerStarLevel": 0.15,
          "PercentHealthUnlock": 0.65,
          "{2c6be05c}": 0.12,
          "{2e45fc86}": 45.0,
          "{85b293ec}": 0.35,
          "{92ef9cd7}": 4.0
        }
      },
      {
        "threshold": 5,
        "values": {
          "NumCastsToUnlock": 5.0,
          "PercentHealthPerStarLevel": 0.15,
          "PercentHealthUnlock": 0.65,
          "{2c6be05c}": 0.12,
          "{2e45fc86}": 50.0,
          "{85b293ec}": 0.35,
          "{92ef9cd7}": 4.0
        }
      },
      {
        "threshold": 7,
        "values": {
          "NumCastsToUnlock": 5.0,
          "PercentHealthPerStarLevel": 0.15,
          "PercentHealthUnlock": 0.65,
          "{2c6be05c}": 0.12,
          "{2e45fc86}": 100.0,
          "{85b293ec}": 0.35,
          "{92ef9cd7}": 4.0
        }
      }
    ]
  },
  "quickstriker": {
    "apiName": "TFT13_Challenger",
    "name": "Quickstriker",
    "description": "Quickstrikers move faster and gain Attack Speed, based on their target's missing Health.<br><br><row>(@MinUnits@) @MinBonusAS*100@-@MaxBonusAS*100@%&nbsp;%i:scaleAS%</row><br><row>(@MinUnits@) @MinBonusAS*100@-@MaxBonusAS*100@%&nbsp;%i:scaleAS%</row><br><row>(@MinUnits@) @MinBonusAS*100@-@MaxBonusAS*100@%&nbsp;%i:scaleAS%. On target death, Quickstrikers dash to a new target and gain @ShieldAmount@ shield for @ShieldDuration@&nbsp;seconds. </row>",
    "enabled": true,
    "tiers": [
      {
        "threshold": 2,
        "values": {
          "MaxBonusAS": 0.6,
          "MinBonusAS": 0.2,
          "{0e9453af}": null,
          "{bdb9953b}": 200.0
        }
      },
      {
        "threshold": 3,
        "values": {
          "MaxBonusAS": 0.8,
          "MinBonusAS": 0.3,
          "{0e9453af}": null,
          "{bdb9953b}": 200.0
        }
      },
      {
        "threshold": 4,
        "values": {
          "MaxBonusAS": 1.0,
          "MinBonusAS": 0.4,
          "ShieldAmount": 200.0,
          "ShieldDuration": 3.0,
          "{0e9453af}": null,
          "{bdb9953b}": 200.0
        }
      }
    ]
  },
  "watcher": {
    "apiName": "TFT13_Watcher",
    "name": "Watcher",
    "description": "Watchers gain Durability, increased while above @HealthBreakpoint*100@%&nbsp;Health.<br><br><expandRow>(@MinUnits@) @BaseDR*100@% or @IncreasedDR*100@%&nbsp;%i:scaleDR%</expandRow><br>",
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
