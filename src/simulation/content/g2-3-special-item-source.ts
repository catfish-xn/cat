// Source reward identities/stat parameters; non-stat finite execution is documented separately.
import {freezeContent} from "./freeze";
export const G23_SPECIAL_ITEM_SOURCE=freezeContent({
  "TFT13_Crime_Bronze_ChemGrips": {
    "name": "Salvaged Contraption",
    "apiName": "TFT13_Crime_Bronze_ChemGrips",
    "description": "Reduce all incoming damage by @ReducedDamage@.<br><rules>Recommended users: Renni and Singed</rules>",
    "values": {
      "Armor": 10.0,
      "Health": 200.0,
      "MagicResist": 10.0,
      "ReducedDamage": 10.0
    },
    "unique": false
  },
  "TFT13_Crime_Bronze_MageGuard": {
    "name": "Salvaged Revolver",
    "apiName": "TFT13_Crime_Bronze_MageGuard",
    "description": "Gain @APPerTick@ Ability Power every @TickRate@ seconds.<br><rules>Recommended users: Silco and Renata Glasc</rules>",
    "values": {
      "AP": 20.0,
      "APPerTick": 10.0,
      "Mana": 15.0,
      "TickRate": 5.0
    },
    "unique": false
  },
  "TFT13_Crime_Bronze_MiningGauntlet": {
    "name": "Salvaged Gauntlet",
    "apiName": "TFT13_Crime_Bronze_MiningGauntlet",
    "description": "Attacks deal an additional @BonusDamageOnAttack@ true damage.<br><rules>Recommended users: Smeech and Sevika</rules>",
    "values": {
      "AD": 0.25,
      "AS": 10.0,
      "BonusDamageOnAttack": 15.0
    },
    "unique": false
  },
  "TFT13_Crime_Gold_DestabilizedChemtank": {
    "name": "Destabilized Chemtank II",
    "apiName": "TFT13_Crime_Gold_DestabilizedChemtank",
    "description": "At @HealthThreshold*100@% Health, gain a @InitialPercentShield*100@% max Health Shield. Every @TickRate@ seconds afterwards, gain a @PercentShield*100@% max Health Shield.<br><rules>Recommended users: Renni and Singed</rules>",
    "values": {
      "Armor": 25.0,
      "Health": 350.0,
      "HealthThreshold": 0.5,
      "InitialPercentShield": 0.3499999940395355,
      "MagicResist": 25.0,
      "PercentShield": 0.10000000149011612,
      "TickRate": 8.0,
      "{473a431b}": 0.20000000298023224
    },
    "unique": false
  },
  "TFT13_Crime_Gold_ExecutionersVorpalblade": {
    "name": "Executioner's Chainblade II",
    "apiName": "TFT13_Crime_Gold_ExecutionersVorpalblade",
    "description": "Attacks and Abilities execute enemies under @ExecuteThreshold*100@% Health. On kill, gain @OnKillDR*100@% Durability and @OnKillDA*100@% Damage Amp for @Duration@ seconds (refreshes on kills).<br><rules>Recommended users: Smeech and Sevika</rules>",
    "values": {
      "AD": 0.4000000059604645,
      "AS": 15.0,
      "Duration": 5.0,
      "ExecuteThreshold": 0.15000000596046448,
      "OnKillDA": 0.15000000596046448,
      "OnKillDR": 0.15000000596046448
    },
    "unique": false
  },
  "TFT13_Crime_Gold_FleshRipper": {
    "name": "Flesh Ripper II",
    "apiName": "TFT13_Crime_Gold_FleshRipper",
    "description": "After dropping below @HealthThreshold*100@% Health, become briefly untargetable, restore @PercentHeal*100@% max Health, and gain @EnhancedAD*100@% Attack Damage and @EnhancedOmnivamp*100@%&nbsp;Omnivamp.<br><br>{{TFT13_ChemBaronOnlyItem}}<br><rules>Recommended users: Smeech and Sevika</rules>",
    "values": {
      "AD": 0.25,
      "CritChance": 35.0,
      "EnhancedAD": 0.20000000298023224,
      "EnhancedOmnivamp": 0.15000000596046448,
      "HealthThreshold": 0.4000000059604645,
      "PercentHeal": 0.4000000059604645,
      "{e6cef574}": 1.0
    },
    "unique": true
  },
  "TFT13_Crime_Gold_PiltovenHexplating": {
    "name": "Piltoven Hexarmor II",
    "apiName": "TFT13_Crime_Gold_PiltovenHexplating",
    "description": "Gain @ArmorPerStack@ Armor and Magic Resist when taking damage, stacking up to @MaxStacks@ times.<br><br>At max stacks, deal @ResistancePercentageDamage*100@% %i:scaleArmor%%i:scaleMR% as magic damage to enemies in a @HexRange@-hex radius after being attacked. (Cooldown: @Cooldown@ seconds)<br><rules>Recommended users: Renni and Singed</rules>",
    "values": {
      "Armor": 40.0,
      "ArmorPerStack": 5.0,
      "Cooldown": 2.0,
      "Health": 175.0,
      "HexRange": 1.0,
      "MagicResist": 40.0,
      "MaxStacks": 15.0,
      "ResistancePercentageDamage": 0.75,
      "{992e2747}": 5.0
    },
    "unique": false
  },
  "TFT13_Crime_Gold_ShimmerBloom": {
    "name": "Shimmer Bloom II",
    "apiName": "TFT13_Crime_Gold_ShimmerBloom",
    "description": "Increase healing and shielding by <TFTBonus>@IncreasedHealShieldPercent*100@%</TFTBonus>. Every @Cadence@ seconds, gain <TFTBonus>@ShieldAmount@</TFTBonus> Shield for @ShieldDuration@ seconds and grant the same Shield to the @NumAllies@ lowest Health allies.<br><rules>Recommended users: Renni and Renata Glasc</rules>",
    "values": {
      "AP": 35.0,
      "Cadence": 8.0,
      "Health": 250.0,
      "IncreasedHealShieldPercent": 0.3499999940395355,
      "NumAllies": 2.0,
      "ShieldAmount": 525.0,
      "ShieldDuration": 10.0
    },
    "unique": false
  },
  "TFT13_Crime_Gold_UnleashedToxins": {
    "name": "Unleashed Toxins II",
    "apiName": "TFT13_Crime_Gold_UnleashedToxins",
    "description": "Attacks grant @ExtraManaOnAttack@ bonus Mana. After casting, launch @NumMissiles@ missiles at the current target that deal @FlatDamage@ magic damage.<br><rules>Recommended users: Silco and Renata Glasc</rules>",
    "values": {
      "AP": 25.0,
      "ExtraManaOnAttack": 5.0,
      "FlatDamage": 175.0,
      "Mana": 15.0,
      "NumMissiles": 3.0
    },
    "unique": false
  },
  "TFT13_Crime_Gold_VirulentVirus": {
    "name": "Virulent Virus II",
    "apiName": "TFT13_Crime_Gold_VirulentVirus",
    "description": "After dealing ability damage, enemies affected take an extra @DoTPercentDamage*100@% damage over @Duration@ seconds as true damage.<br><rules>Recommended users: Silco and Renata Glasc</rules>",
    "values": {
      "AP": 40.0,
      "AS": 25.0,
      "DoTPercentDamage": 0.25,
      "Duration": 3.0
    },
    "unique": false
  },
  "TFT13_Crime_Gold_VoltaicSaber": {
    "name": "Voltaic Saber II",
    "apiName": "TFT13_Crime_Gold_VoltaicSaber",
    "description": "After every @NumDamageInstances@ instances of damage, send jolts towards the @NumEnemies@ lowest health enemies, dealing <physicalDamage>@JoltDamage@</physicalDamage> physical damage.<br><rules>Recommended users: Sevika and Smeech</rules>",
    "values": {
      "AD": 0.25,
      "AP": 25.0,
      "JoltDamage": 250.0,
      "NumDamageInstances": 6.0,
      "NumEnemies": 2.0,
      "StatOmnivamp": 0.3499999940395355
    },
    "unique": false
  },
  "TFT13_Crime_OmegaPrismatic_DimensionalHeirloom": {
    "name": "Dimensional Heirloom",
    "apiName": "TFT13_Crime_OmegaPrismatic_DimensionalHeirloom",
    "description": "Combat start: Creates a pocket Anomaly that summons powerful allies from across the Convergence every @Cadence@ seconds.<br><br>{{TFT13_ChemBaronOnlyItem}}",
    "values": {
      "Cadence": 4.0,
      "Health": 5000.0
    },
    "unique": true
  },
  "TFT13_Crime_Prismatic_DestabilizedChemtank": {
    "name": "Perfected Destabilized Chemtank",
    "apiName": "TFT13_Crime_Prismatic_DestabilizedChemtank",
    "description": "At @HealthThreshold*100@% Health, gain a @InitialPercentShield*100@% max Health Shield. Every @TickRate@ seconds afterwards, gain a @PercentShield*100@% max Health Shield.<br><br><scaleShimmer>Perfected Bonus:</scaleShimmer> After gaining Shield, fire a vial of chemicals at @PrismaticNumChampions@ nearby enemies that deals @PrismaticDamagePercent*100@% max Health magic damage.<br><rules>Recommended users: Renni and Singed</rules>",
    "values": {
      "Armor": 45.0,
      "Health": 600.0,
      "HealthThreshold": 0.5,
      "InitialPercentShield": 0.6000000238418579,
      "MagicResist": 45.0,
      "PercentShield": 0.10000000149011612,
      "PrismaticDamagePercent": 0.10000000149011612,
      "PrismaticNumChampions": 3.0,
      "TickRate": 4.0,
      "{473a431b}": 0.20000000298023224
    },
    "unique": false
  },
  "TFT13_Crime_Prismatic_ExecutionersVorpalblade": {
    "name": "Perfected Executioner's Chainblade",
    "apiName": "TFT13_Crime_Prismatic_ExecutionersVorpalblade",
    "description": "Attacks and Abilities execute enemies under @ExecuteThreshold*100@% Health. On kill, gain @OnKillDR*100@% Durability and @OnKillDA*100@% Damage Amp for @Duration@ seconds (refreshes on kills).<br><br><scaleShimmer>Perfected Bonus:</scaleShimmer> Executes drop @PrismaticGold@ Gold and heals the holder for @PrismaticHeal@.<br><rules>Recommended users: Smeech and Sevika</rules>",
    "values": {
      "AD": 0.75,
      "AS": 30.0,
      "Duration": 10.0,
      "ExecuteThreshold": 0.20000000298023224,
      "OnKillDA": 0.20000000298023224,
      "OnKillDR": 0.20000000298023224,
      "PrismaticGold": 3.0,
      "PrismaticHeal": 400
    },
    "unique": false
  },
  "TFT13_Crime_Prismatic_FleshRipper": {
    "name": "Perfected Flesh Ripper",
    "apiName": "TFT13_Crime_Prismatic_FleshRipper",
    "description": "After dropping below @HealthThreshold*100@% Health, become briefly Untargetable, restore @PercentHeal*100@% max Health, and gain @EnhancedAD*100@% Attack Damage and @EnhancedOmnivamp*100@% Omnivamp.<br><br><scaleShimmer>Perfected Bonus:</scaleShimmer> Upon dying for the first time, revive with @PrismaticReviveHeal*100@% max Health!<br><br>{{TFT13_ChemBaronOnlyItem}}<br><rules>Recommended users: Smeech and Sevika</rules>",
    "values": {
      "AD": 0.44999998807907104,
      "CritChance": 60.0,
      "EnhancedAD": 0.6000000238418579,
      "EnhancedOmnivamp": 0.25,
      "HealthThreshold": 0.4000000059604645,
      "PercentHeal": 1.0,
      "PrismaticReviveHeal": 1.0,
      "{02712a6d}": 2.0,
      "{e6cef574}": 1.0
    },
    "unique": true
  },
  "TFT13_Crime_Prismatic_PiltovenHexplating": {
    "name": "Perfected Piltoven Hexarmor",
    "apiName": "TFT13_Crime_Prismatic_PiltovenHexplating",
    "description": "Gain @ArmorPerStack@ Armor and Magic Resist when taking damage, stacking up to @MaxStacks@ times.<br><br><scaleShimmer>Perfected Bonus:</scaleShimmer> At max stacks, deal @ResistancePercentageDamage*100@% %i:scaleArmor%%i:scaleMR% as <TFTRadiantItemBonus>true damage</TFTRadiantItemBonus> to enemies in a <TFTRadiantItemBonus>@HexRange@-hex radius</TFTRadiantItemBonus> after being attacked. (Cooldown: @Cooldown@ seconds)<br><rules>Recommended users: Renni and Singed</rules>",
    "values": {
      "Armor": 75.0,
      "ArmorPerStack": 10.0,
      "Cooldown": 2.0,
      "Health": 300.0,
      "HexRange": 4.0,
      "MagicResist": 75.0,
      "MaxStacks": 15.0,
      "ResistancePercentageDamage": 0.5,
      "{11af8281}": 0.5,
      "{992e2747}": 10.0
    },
    "unique": false
  },
  "TFT13_Crime_Prismatic_ShimmerBloom": {
    "name": "Perfected Shimmer Bloom",
    "apiName": "TFT13_Crime_Prismatic_ShimmerBloom",
    "description": "Increase healing and shielding by <TFTBonus>@IncreasedHealShieldPercent*100@%</TFTBonus>. Every @Cadence@ seconds, gain <TFTBonus>@ShieldAmount@</TFTBonus> Shield for @ShieldDuration@ seconds and grant the same Shield to the @NumAllies@ lowest Health allies.<br><br><scaleShimmer>Perfected Bonus:</scaleShimmer> Shielding or healing allies grants them @PrismaticAllyAP@ Ability Power and @PrismaticAllyAS*100@% Attack Speed. (Cooldown: @PrismaticCooldownTime@s)<br><rules>Recommended users: Renni and Renata Glasc</rules>",
    "values": {
      "AP": 60.0,
      "Cadence": 6.0,
      "Health": 450.0,
      "IncreasedHealShieldPercent": 0.6000000238418579,
      "NumAllies": 3.0,
      "PrismaticAllyAP": 30.0,
      "PrismaticAllyAS": 0.30000001192092896,
      "PrismaticCooldownTime": 1.0,
      "ShieldAmount": 600.0,
      "ShieldDuration": 10.0
    },
    "unique": false
  },
  "TFT13_Crime_Prismatic_UnleashedToxins": {
    "name": "Perfected Unleashed Toxins",
    "apiName": "TFT13_Crime_Prismatic_UnleashedToxins",
    "description": "Attacks grant @ExtraManaOnAttack@ bonus Mana. After casting, launch @NumMissiles@ missiles at the current target that deal @FlatDamage@ magic damage.<br><br><scaleShimmer>Perfected Bonus:</scaleShimmer> Casts also launch a wave of toxins that deals @PrismaticWaveDamage@ magic damage and Stuns enemies hit for @PrismaticWaveStunDuration@ seconds.<br><rules>Recommended users: Silco and Renata Glasc</rules>",
    "values": {
      "AP": 45.0,
      "ExtraManaOnAttack": 10.0,
      "FlatDamage": 250.0,
      "Mana": 30.0,
      "NumMissiles": 5.0,
      "PrismaticWaveDamage": 450.0,
      "PrismaticWaveStunDuration": 1.5
    },
    "unique": false
  },
  "TFT13_Crime_Prismatic_VirulentVirus": {
    "name": "Perfected Virulent Virus",
    "apiName": "TFT13_Crime_Prismatic_VirulentVirus",
    "description": "After dealing ability damage, enemies affected take an extra @DoTPercentDamage*100@% damage over @Duration@ seconds as true damage.<br><br><scaleShimmer>Perfected Bonus:</scaleShimmer> Infected enemies deal @PrismaticReducedDamage*100@% less damage. When they die, they join your side with <TFTBonus>@PrismaticZombieHealth@</TFTBonus> Health that decays over @PrismaticZombieDecayDuration@&nbsp;seconds.<br><rules>Recommended users: Silco and Renata Glasc</rules>",
    "values": {
      "AP": 75.0,
      "AS": 45.0,
      "DoTPercentDamage": 0.44999998807907104,
      "Duration": 3.0,
      "PrismaticReducedDamage": 0.25,
      "PrismaticZombieDecayDuration": 8.0,
      "PrismaticZombieHealth": 1600.0
    },
    "unique": false
  },
  "TFT13_Crime_Prismatic_VoltaicSaber": {
    "name": "Perfected Voltaic Saber",
    "apiName": "TFT13_Crime_Prismatic_VoltaicSaber",
    "description": "After every @NumDamageInstances@ instances of damage, send jolts towards the @NumEnemies@ lowest health enemies, dealing <physicalDamage>@JoltDamage@</physicalDamage> physical damage.<br><br><scaleShimmer>Perfected Bonus:</scaleShimmer> Every time the holder fires bolts, they gain @PrismaticASPerTrigger*100@% Attack Speed.<br><rules>Recommended users: Sevika and Smeech</rules>",
    "values": {
      "AD": 0.44999998807907104,
      "AP": 45.0,
      "JoltDamage": 300.0,
      "NumDamageInstances": 4.0,
      "NumEnemies": 3.0,
      "PrismaticASPerTrigger": 0.20000000298023224,
      "StatOmnivamp": 0.6000000238418579
    },
    "unique": false
  },
  "TFT13_Crime_Silver_DestabilizedChemtank": {
    "name": "Destabilized Chemtank",
    "apiName": "TFT13_Crime_Silver_DestabilizedChemtank",
    "description": "At @HealthThreshold*100@% Health, gain a @InitialPercentShield*100@% max Health Shield. Every @TickRate@ seconds afterwards, gain a @PercentShield*100@% max Health Shield.<br><rules>Recommended users: Renni and Singed</rules>",
    "values": {
      "Armor": 15.0,
      "Health": 200.0,
      "HealthThreshold": 0.5,
      "InitialPercentShield": 0.20000000298023224,
      "MagicResist": 15.0,
      "PercentShield": 0.10000000149011612,
      "TickRate": 8.0,
      "{473a431b}": 0.10000000149011612
    },
    "unique": false
  },
  "TFT13_Crime_Silver_ExecutionersVorpalblade": {
    "name": "Executioner's Chainblade",
    "apiName": "TFT13_Crime_Silver_ExecutionersVorpalblade",
    "description": "Attacks and Abilities execute enemies under @ExecuteThreshold*100@% Health. On kill, gain @OnKillDR*100@% Durability and @OnKillDA*100@% Damage Amp for @Duration@ seconds (refreshes on kills).<br><rules>Recommended users: Smeech and Sevika</rules>",
    "values": {
      "AD": 0.25,
      "AS": 10.0,
      "Duration": 5.0,
      "ExecuteThreshold": 0.10000000149011612,
      "OnKillDA": 0.10000000149011612,
      "OnKillDR": 0.10000000149011612
    },
    "unique": false
  },
  "TFT13_Crime_Silver_FleshRipper": {
    "name": "Flesh Ripper",
    "apiName": "TFT13_Crime_Silver_FleshRipper",
    "description": "After dropping below @HealthThreshold*100@% Health, become briefly untargetable, restore @PercentHeal*100@% max Health, and gain @EnhancedAD*100@% Attack Damage and @EnhancedOmnivamp*100@%&nbsp;Omnivamp.<br><br>{{TFT13_ChemBaronOnlyItem}}<br><rules>Recommended users: Smeech and Sevika</rules>",
    "values": {
      "AD": 0.15000000596046448,
      "CritChance": 20.0,
      "EnhancedAD": 0.10000000149011612,
      "EnhancedOmnivamp": 0.10000000149011612,
      "HealthThreshold": 0.4000000059604645,
      "PercentHeal": 0.25,
      "{e6cef574}": 1.0
    },
    "unique": true
  },
  "TFT13_Crime_Silver_PiltovenHexplating": {
    "name": "Piltoven Hexarmor",
    "apiName": "TFT13_Crime_Silver_PiltovenHexplating",
    "description": "Gain @ArmorPerStack@ Armor and Magic Resist when taking damage, stacking up to @MaxStacks@ times.<br><br>At max stacks, deal @ResistancePercentageDamage*100@% %i:scaleArmor%%i:scaleMR% as magic damage to enemies in a @HexRange@-hex radius after being attacked. (Cooldown: @Cooldown@ seconds)<br><rules>Recommended users: Renni and Singed</rules>",
    "values": {
      "Armor": 25.0,
      "ArmorPerStack": 3.0,
      "Cooldown": 2.0,
      "Health": 100.0,
      "HexRange": 1.0,
      "MagicResist": 25.0,
      "MaxStacks": 15.0,
      "ResistancePercentageDamage": 0.5,
      "{992e2747}": 3.0
    },
    "unique": false
  },
  "TFT13_Crime_Silver_ShimmerBloom": {
    "name": "Shimmer Bloom",
    "apiName": "TFT13_Crime_Silver_ShimmerBloom",
    "description": "Increase healing and shielding by <TFTBonus>@IncreasedHealShieldPercent*100@%</TFTBonus>. Every @Cadence@ seconds, gain <TFTBonus>@ShieldAmount@</TFTBonus> Shield for @ShieldDuration@ seconds and grant the same Shield to the @NumAllies@ lowest Health allies.<br><rules>Recommended users: Renni and Renata Glasc</rules>",
    "values": {
      "AP": 20.0,
      "Cadence": 8.0,
      "Health": 150.0,
      "IncreasedHealShieldPercent": 0.20000000298023224,
      "NumAllies": 2.0,
      "ShieldAmount": 300.0,
      "ShieldDuration": 10.0
    },
    "unique": false
  },
  "TFT13_Crime_Silver_UnleashedToxins": {
    "name": "Unleashed Toxins",
    "apiName": "TFT13_Crime_Silver_UnleashedToxins",
    "description": "Attacks grant @ExtraManaOnAttack@ bonus Mana. After casting, launch @NumMissiles@ missiles at the current target that deal @FlatDamage@ magic damage.<br><rules>Recommended users: Silco and Renata Glasc</rules>",
    "values": {
      "AP": 15.0,
      "ExtraManaOnAttack": 5.0,
      "FlatDamage": 100.0,
      "Mana": 10.0,
      "NumMissiles": 3.0
    },
    "unique": false
  },
  "TFT13_Crime_Silver_VirulentVirus": {
    "name": "Virulent Virus",
    "apiName": "TFT13_Crime_Silver_VirulentVirus",
    "description": "After dealing ability damage, enemies affected take an extra @DoTPercentDamage*100@% damage over @Duration@ seconds as true damage.<br><rules>Recommended users: Silco and Renata Glasc</rules>",
    "values": {
      "AP": 25.0,
      "AS": 15.0,
      "DoTPercentDamage": 0.15000000596046448,
      "Duration": 3.0
    },
    "unique": false
  },
  "TFT13_Crime_Silver_VoltaicSaber": {
    "name": "Voltaic Saber",
    "apiName": "TFT13_Crime_Silver_VoltaicSaber",
    "description": "After every @NumDamageInstances@ instances of damage, send jolts towards the @NumEnemies@ lowest health enemies, dealing <physicalDamage>@JoltDamage@</physicalDamage> physical damage.<br><rules>Recommended users: Sevika and Smeech</rules>",
    "values": {
      "AD": 0.15000000596046448,
      "AP": 15.0,
      "JoltDamage": 150.0,
      "NumDamageInstances": 6.0,
      "NumEnemies": 2.0,
      "StatOmnivamp": 0.20000000298023224
    },
    "unique": false
  },
  "TFT5_Item_AdaptiveHelmRadiant": {
    "name": "Jak'sho the Protean",
    "apiName": "TFT5_Item_AdaptiveHelmRadiant",
    "description": "Combat start: Gain different bonuses based on starting position.<br><br>Front Two Rows: <TFTRadiantItemBonus>@FrontRowBonusResists@</TFTRadiantItemBonus> Armor and Magic Resist. Gain <TFTRadiantItemBonus>@FrontLineManaPerHit@</TFTRadiantItemBonus> Mana when struck by an attack.<br><br>Back Two Rows: <TFTRadiantItemBonus>@BackRowBonusAP@</TFTRadiantItemBonus> Ability Power. Gain <TFTRadiantItemBonus>@ManaPerTickrate@</TFTRadiantItemBonus> Mana every @ManaTickrate@ seconds.<br>",
    "values": {
      "AP": 25.0,
      "BackRowBonusAP": 40.0,
      "FrontLineManaPerHit": 2.0,
      "FrontRowBonusResists": 60.0,
      "MagicResist": 30.0,
      "Mana": 15.0,
      "ManaPerTickrate": 20.0,
      "ManaTickrate": 3.0,
      "TotalAPBonus": 40.0
    },
    "unique": false
  },
  "TFT5_Item_ArchangelsStaffRadiant": {
    "name": "Urf-Angel's Staff",
    "apiName": "TFT5_Item_ArchangelsStaffRadiant",
    "description": "Combat start: Gain <TFTRadiantItemBonus>@APPerInterval@</TFTRadiantItemBonus> Ability Power every <TFTRadiantItemBonus>@IntervalSeconds@</TFTRadiantItemBonus> seconds in combat.",
    "values": {
      "AP": 50.0,
      "APPerInterval": 40.0,
      "IntervalSeconds": 4.0,
      "Mana": 15.0
    },
    "unique": false
  },
  "TFT5_Item_BloodthirsterRadiant": {
    "name": "Blessed Bloodthirster",
    "apiName": "TFT5_Item_BloodthirsterRadiant",
    "description": "Once per combat: At @HealthThreshold@% Health, gain a <TFTRadiantItemBonus>@ShieldHealthPercent@%</TFTRadiantItemBonus> max Health Shield that lasts up to @ShieldDuration@ seconds.",
    "values": {
      "AD": 0.4000000059604645,
      "AP": 40.0,
      "HealthThreshold": 40.0,
      "LifeSteal": 40.0,
      "MagicResist": 20.0,
      "ShieldDuration": 5.0,
      "ShieldHealthPercent": 40.0,
      "StatOmnivamp": 0.4000000059604645
    },
    "unique": false
  },
  "TFT5_Item_BlueBuffRadiant": {
    "name": "Blue Blessing",
    "apiName": "TFT5_Item_BlueBuffRadiant",
    "description": "Gain @ManaRefund@ Mana after casting. <br><br>When the holder gets a takedown, they deal <TFTRadiantItemBonus>@DamageAmp*100@%</TFTRadiantItemBonus> more damage for <TFTRadiantItemBonus>@TakedownTimer@</TFTRadiantItemBonus> seconds.<br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules><br><br>",
    "values": {
      "AD": 0.5,
      "AP": 50.0,
      "DamageAmp": 0.20000000298023224,
      "Mana": 30.0,
      "ManaRefund": 10.0,
      "TakedownTimer": 12.0
    },
    "unique": true
  },
  "TFT5_Item_BrambleVestRadiant": {
    "name": "Rosethorn Vest",
    "apiName": "TFT5_Item_BrambleVestRadiant",
    "description": "Gain <TFTRadiantItemBonus>@PercentMaxHP*100@%</TFTRadiantItemBonus> max health.<br><br>Take <TFTRadiantItemBonus>@AutoDamageReduction*100@%</TFTRadiantItemBonus> reduced damage from attacks. When struck by any attack, deal <TFTRadiantItemBonus>@1StarAoEDamage@</TFTRadiantItemBonus> magic damage to all adjacent enemies.<br><br><tftitemrules>Cooldown: @ICD@ seconds</tftitemrules>",
    "values": {
      "1StarAoEDamage": 175.0,
      "2StarAoEDamage": 175.0,
      "3StarAoEDamage": 175.0,
      "Armor": 100.0,
      "AutoDamageReduction": 0.25,
      "ICD": 2.0,
      "PercentMaxHP": 0.15000000596046448,
      "{b5c2a66b}": 175.0
    },
    "unique": false
  },
  "TFT5_Item_CrownguardRadiant": {
    "name": "Royal Crownshield",
    "apiName": "TFT5_Item_CrownguardRadiant",
    "description": "Combat start: Gain a <TFTRadiantItemBonus>@ShieldSize@%</TFTRadiantItemBonus> max Health Shield for @ShieldDuration@ seconds. <br>When the shield expires, gain <TFTRadiantItemBonus>@ShieldBonusAP@ Ability Power</TFTRadiantItemBonus>.",
    "values": {
      "AP": 40.0,
      "Armor": 40.0,
      "ChillDuration": 4.0,
      "Health": 200.0,
      "HexRange": 5.0,
      "ShieldBonusAP": 50.0,
      "ShieldDuration": 8.0,
      "ShieldSize": 50.0
    },
    "unique": false
  },
  "TFT5_Item_DeathbladeRadiant": {
    "name": "Luminous Deathblade",
    "apiName": "TFT5_Item_DeathbladeRadiant",
    "description": "<tftitemrules>It glows in the presence of enemies. Or friends. Or anything alive, really.</tftitemrules>",
    "values": {
      "AD": 1.0499999523162842,
      "BonusDamage": 0.11999999731779099,
      "{1543aa48}": 0.11999999731779099
    },
    "unique": false
  },
  "TFT5_Item_DragonsClawRadiant": {
    "name": "Dragon's Will",
    "apiName": "TFT5_Item_DragonsClawRadiant",
    "description": "Gain <TFTRadiantItemBonus>@PercentMaxHP*100@%</TFTRadiantItemBonus> max health.<br><br>Every @HealthRegenInterval@ seconds, heal <TFTRadiantItemBonus>@PercentHealthDamage@%</TFTRadiantItemBonus> max Health.<br>",
    "values": {
      "HealthRegenInterval": 2.0,
      "ICD": 0.5,
      "MagicResist": 115.0,
      "MaxHealthRegen": 2.0,
      "PercentHealthDamage": 10.0,
      "PercentMaxHP": 0.15000000596046448
    },
    "unique": false
  },
  "TFT5_Item_FrozenHeartRadiant": {
    "name": "Bulwark's Oath",
    "apiName": "TFT5_Item_FrozenHeartRadiant",
    "description": "Once per combat at @HealthThreshold@% Health, gain a <TFTRadiantItemBonus>@ShieldHealthPercent@%</TFTRadiantItemBonus> max Health Shield that lasts <TFTRadiantItemBonus>@ShieldDuration@</TFTRadiantItemBonus> seconds and gain <TFTRadiantItemBonus>@Stats@</TFTRadiantItemBonus> Armor and <TFTRadiantItemBonus>@Stats@</TFTRadiantItemBonus> Magic Resist.<br>",
    "values": {
      "Armor": 40.0,
      "HealthThreshold": 40.0,
      "Mana": 30.0,
      "ShieldDuration": 10.0,
      "ShieldHealthPercent": 50.0,
      "Stats": 60.0
    },
    "unique": false
  },
  "TFT5_Item_GargoyleStoneplateRadiant": {
    "name": "Dvarapala Stoneplate",
    "apiName": "TFT5_Item_GargoyleStoneplateRadiant",
    "description": "Gain <TFTRadiantItemBonus>@ArmorPerEnemy@</TFTRadiantItemBonus> Armor and <TFTRadiantItemBonus>@MRPerEnemy@</TFTRadiantItemBonus> Magic Resist for each enemy targeting the holder.<br><br><TFTRadiantItemBonus>Also, heal @MaxHealthRegen@% max Health each second.</TFTRadiantItemBonus>",
    "values": {
      "Armor": 50.0,
      "ArmorPerEnemy": 15.0,
      "Health": 250.0,
      "HealthRegenInterval": 1.0,
      "MRPerEnemy": 15.0,
      "MagicResist": 50.0,
      "MaxHealthRegen": 1.5
    },
    "unique": false
  },
  "TFT5_Item_GiantSlayerRadiant": {
    "name": "Demonslayer",
    "apiName": "TFT5_Item_GiantSlayerRadiant",
    "description": "Gain <TFTRadiantItemBonus>@DamageAmp*100@%</TFTRadiantItemBonus> additional Damage Amp against enemies with more than @HealthThreshold@ max Health.",
    "values": {
      "AD": 0.5,
      "AP": 50.0,
      "AS": 10.0,
      "DamageAmp": 0.30000001192092896,
      "HealthThreshold": 1750.0,
      "LargeBonusPct": 60.0,
      "{1543aa48}": 0.20000000298023224
    },
    "unique": false
  },
  "TFT5_Item_GuardianAngelRadiant": {
    "name": "Brink of Dawn",
    "apiName": "TFT5_Item_GuardianAngelRadiant",
    "description": "Once per combat: At @HealthThreshold@% Health, briefly become untargetable and shed negative effects. Then, <TFTRadiantItemBonus>heal @MissingHealthRestore*100@% missing health and gain @AttackSpeed@% bonus Attack Speed</TFTRadiantItemBonus>. <br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules>",
    "values": {
      "AD": 0.30000001192092896,
      "Armor": 30.0,
      "AttackSpeed": 85.0,
      "DamageReduction": 100.0,
      "HealthThreshold": 60.0,
      "HealthThreshold2": 30.0,
      "MissingHealthRestore": 1.0,
      "StealthDuration": 1.0
    },
    "unique": true
  },
  "TFT5_Item_GuinsoosRagebladeRadiant": {
    "name": "Guinsoo's Reckoning",
    "apiName": "TFT5_Item_GuinsoosRagebladeRadiant",
    "description": "Attacks grant <TFTRadiantItemBonus>@AttackSpeedPerStack@%</TFTRadiantItemBonus> stacking Attack Speed.",
    "values": {
      "AP": 10.0,
      "AS": 20.0,
      "AttackSpeedPerStack": 10.0
    },
    "unique": false
  },
  "TFT5_Item_HandOfJusticeRadiant": {
    "name": "Fist of Fairness",
    "apiName": "TFT5_Item_HandOfJusticeRadiant",
    "description": "Gain 2 effects:<li><TFTRadiantItemBonus>@AD_NotStatBar*100@%</TFTRadiantItemBonus> Attack Damage and <TFTRadiantItemBonus>@AP_NotStatBar@</TFTRadiantItemBonus> Ability Power.<li><TFTRadiantItemBonus>@StatOmnivamp_NotStatBar*100@%</TFTRadiantItemBonus> Omnivamp.<br><br>While above @HealthThreshold*100@% health, double the Attack Damage and Ability Power. While below @HealthThreshold*100@% Health, double the Omnivamp.",
    "values": {
      "AD_NotStatBar": 0.3499999940395355,
      "AP_NotStatBar": 35.0,
      "CritChance": 40.0,
      "HealthThreshold": 0.5,
      "Mana": 15.0,
      "StatOmnivamp_NotStatBar": 0.20000000298023224,
      "{f23e83fc}": 2.0
    },
    "unique": false
  },
  "TFT5_Item_HextechGunbladeRadiant": {
    "name": "Hextech Lifeblade",
    "apiName": "TFT5_Item_HextechGunbladeRadiant",
    "description": "Heal the lowest percent Health ally for <TFTRadiantItemBonus>@AllyHealing*100@%</TFTRadiantItemBonus> of damage dealt.<br><br><TFTTrackerLabel>Ally Healing:</TFTTrackerLabel> <TFTHighlight>@TFTUnitProperty.item:TFT_Tracker_Value1@</TFTHighlight>",
    "values": {
      "AD": 0.4000000059604645,
      "AP": 40.0,
      "AllyHealing": 0.4000000059604645,
      "Omnivamp": 35.0,
      "StatOmnivamp": 0.30000001192092896
    },
    "unique": false
  },
  "TFT5_Item_InfinityEdgeRadiant": {
    "name": "Zenith Edge",
    "apiName": "TFT5_Item_InfinityEdgeRadiant",
    "description": "Abilities can critically strike.<br><br>If the holder's abilities can already critically strike, gain @CritDamageToGive*100@% Critical Strike Damage instead.",
    "values": {
      "AD": 0.6499999761581421,
      "CritChance": 75.0,
      "CritDamageToGive": 0.10000000149011612
    },
    "unique": false
  },
  "TFT5_Item_IonicSparkRadiant": {
    "name": "Covalent Spark",
    "apiName": "TFT5_Item_IonicSparkRadiant",
    "description": "@MRShred@% <TFTKeyword>Shred</TFTKeyword> enemies within <TFTRadiantItemBonus>@HexRange@</TFTRadiantItemBonus> hexes. When enemies cast an Ability, deal magic damage equal to <TFTRadiantItemBonus>@ManaRatio@%</TFTRadiantItemBonus> of the Mana spent..<br><br><TFTRadiantItemBonus>Also, heal @MaxHealthRegen@% max Health per second.</TFTRadiantItemBonus><br><br><tftitemrules>[Direct damage item]<br><tftbold>Shred</tftbold>: Reduce Magic Resist</tftitemrules>",
    "values": {
      "AP": 15.0,
      "Health": 200.0,
      "HealthRegenInterval": 1.0,
      "HexRange": 3.0,
      "MRShred": 30.0,
      "MagicResist": 40.0,
      "ManaRatio": 200.0,
      "MaxHealthRegen": 1.5
    },
    "unique": false
  },
  "TFT5_Item_JeweledGauntletRadiant": {
    "name": "Glamorous Gauntlet",
    "apiName": "TFT5_Item_JeweledGauntletRadiant",
    "description": "Abilities can critically strike.<br><br>If the holder's abilities can already critically strike, gain @CritDamageToGive*100@% Critical Strike Damage instead.",
    "values": {
      "AP": 55.0,
      "CritChance": 75.0,
      "CritDamageToGive": 0.10000000149011612
    },
    "unique": false
  },
  "TFT5_Item_LastWhisperRadiant": {
    "name": "Eternal Whisper",
    "apiName": "TFT5_Item_LastWhisperRadiant",
    "description": "Physical damage @ArmorReductionPercent@% <TFTKeyword>Sunders</TFTKeyword> the target for <TFTRadiantItemBonus>the rest of combat.</TFTRadiantItemBonus> This effect does not stack.<br><br><tftitemrules>[Unique - only 1 per champion]<br><tftbold>Sunder</tftbold>: Reduce Armor</tftitemrules>",
    "values": {
      "AD": 0.44999998807907104,
      "AS": 25.0,
      "ArmorBreakDuration": 50.0,
      "ArmorReductionPercent": 30.0,
      "CritChance": 55.0
    },
    "unique": true
  },
  "TFT5_Item_LeviathanRadiant": {
    "name": "The Baron's Gift",
    "apiName": "TFT5_Item_LeviathanRadiant",
    "description": "After casting an Ability, gain <TFTRadiantItemBonus>@AttackSpeedToGive@% Attack Speed</TFTRadiantItemBonus> for <TFTRadiantItemBonus>@ASDuration@ seconds</TFTRadiantItemBonus>.",
    "values": {
      "AP": 30.0,
      "AS": 20.0,
      "ASDuration": 8.0,
      "AttackSpeedToGive": 120.0,
      "Health": 200.0
    },
    "unique": false
  },
  "TFT5_Item_MorellonomiconRadiant": {
    "name": "More More-ellonomicon",
    "apiName": "TFT5_Item_MorellonomiconRadiant",
    "description": "Attacks and Abilities deal <TFTRadiantItemBonus>@BurnPercent@%</TFTRadiantItemBonus> <TFTKeyword>Burn</TFTKeyword> and @GrievousWoundsPercent@% <TFTKeyword>Wound</TFTKeyword> to enemies for <TFTRadiantItemBonus>@BurnDuration@</TFTRadiantItemBonus> seconds.<br><br><tftitemrules>[Unique - only 1 per champion]<br><tftbold>Burn</tftbold>: Deals a percent of the target's max Health as true damage every second<br><tftbold>Wound</tftbold>: Reduces healing received</tftitemrules>",
    "values": {
      "AP": 50.0,
      "AS": 25.0,
      "BurnDuration": 30.0,
      "BurnPercent": 2.0,
      "GrievousWoundsPercent": 33.0,
      "Health": 150.0,
      "MonsterCap": 150.0,
      "TicksPerSecond": 1.0
    },
    "unique": true
  },
  "TFT5_Item_NightHarvesterRadiant": {
    "name": "Legacy of the Colossus",
    "apiName": "TFT5_Item_NightHarvesterRadiant",
    "description": "Gain <TFTRadiantItemBonus>@BaseDurability*100@%</TFTRadiantItemBonus> durability. While above <TFTRadiantItemBonus>@ThresholdForEmpower*100@%</TFTRadiantItemBonus> Health, instead gain <TFTRadiantItemBonus>@EmpoweredDurability*100@%</TFTRadiantItemBonus> Durability.",
    "values": {
      "Armor": 40.0,
      "BaseDamageReduction": 16.0,
      "BaseDurability": 0.1599999964237213,
      "CritChance": 20.0,
      "EmpowerDamageReduction": 30.0,
      "EmpoweredDurability": 0.30000001192092896,
      "Health": 500.0,
      "ThresholdForEmpower": 0.4000000059604645
    },
    "unique": false
  },
  "TFT5_Item_QuicksilverRadiant": {
    "name": "Quickestsilver",
    "apiName": "TFT5_Item_QuicksilverRadiant",
    "description": "Combat start: Gain immunity to crowd control for <TFTRadiantItemBonus>@SpellShieldDuration@</TFTRadiantItemBonus> seconds. <TFTRadiantItemBonus>For @ASTotalDuration@ seconds, gain @ProcAttackSpeed*100@% Attack Speed every @ProcInterval@ seconds.</TFTRadiantItemBonus><br><br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules>",
    "values": {
      "AS": 50.0,
      "ASTotalDuration": 18.0,
      "CritChance": 40.0,
      "MagicResist": 30.0,
      "ProcAttackSpeed": 0.07000000029802322,
      "ProcInterval": 2.0,
      "SpellShieldDuration": 45.0
    },
    "unique": true
  },
  "TFT5_Item_RabadonsDeathcapRadiant": {
    "name": "Rabadon's Ascended Deathcap",
    "apiName": "TFT5_Item_RabadonsDeathcapRadiant",
    "description": "<tftitemrules>It's witnessed - and unleashed - miracles and calamities both.</tftitemrules>",
    "values": {
      "AP": 70.0,
      "BonusDamage": 0.5,
      "{1543aa48}": 0.33000001311302185
    },
    "unique": false
  },
  "TFT5_Item_RapidFirecannonRadiant": {
    "name": "Crest of Cinders",
    "apiName": "TFT5_Item_RapidFirecannonRadiant",
    "description": "Attacks and Abilities <TFTRadiantItemBonus>@BurnPercent@%</TFTRadiantItemBonus> <TFTKeyword>Burn</TFTKeyword> and <TFTRadiantItemBonus>@HealingReductionPct@%</TFTRadiantItemBonus> <TFTKeyword>Wound</TFTKeyword> enemies for @Duration@ seconds.<br><br><tftitemrules><tftbold>Burn</tftbold>: Deals a percent of the target's max Health as true damage every second<br><tftbold>Wound</tftbold>: Reduces healing received</tftitemrules><br>",
    "values": {
      "AS": 60.0,
      "BonusDamage": 0.10000000149011612,
      "BurnPercent": 2.0,
      "Duration": 5.0,
      "HealingReductionPct": 33.0,
      "HexRangeIncrease": 2.0,
      "{1543aa48}": 0.10000000149011612
    },
    "unique": false
  },
  "TFT5_Item_RedemptionRadiant": {
    "name": "Absolution",
    "apiName": "TFT5_Item_RedemptionRadiant",
    "description": "Heal allies within <TFTRadiantItemBonus>@HexRadius@</TFTRadiantItemBonus> hexes for <TFTRadiantItemBonus>@MissingHealthHeal@%</TFTRadiantItemBonus> of their missing Health every @HealTickRate@ seconds. They also gain @AoEDamageReduction@% Durability for @HealTickRate@ seconds (this does not stack).<br><br><TFTTrackerLabel>Healing:</TFTTrackerLabel> <TFTHighlight>@TFTUnitProperty.item:TFT_Tracker_Value1@</TFTHighlight>",
    "values": {
      "AoEDamageReduction": 10.0,
      "HealTickRate": 5.0,
      "Health": 400.0,
      "HexRadius": 2.0,
      "Mana": 15.0,
      "MaxHeal": 2000.0,
      "MissingHealthHeal": 25.0
    },
    "unique": false
  },
  "TFT5_Item_RunaansHurricaneRadiant": {
    "name": "Runaan's Tempest",
    "apiName": "TFT5_Item_RunaansHurricaneRadiant",
    "description": "Attacks fire a bolt at a nearby enemy, dealing <TFTRadiantItemBonus>@MultiplierForDamage@%</TFTRadiantItemBonus> Attack Damage %i:scaleAD% as physical damage.<br>",
    "values": {
      "AD": 0.3499999940395355,
      "AS": 20.0,
      "AdditionalTargets": 1.0,
      "MagicResist": 20.0,
      "MultiplierForDamage": 110.0
    },
    "unique": false
  },
  "TFT5_Item_SpearOfShojinRadiant": {
    "name": "Spear of Hirana",
    "apiName": "TFT5_Item_SpearOfShojinRadiant",
    "description": "Attacks grant <TFTRadiantItemBonus>@FlatManaRestore@ bonus Mana</TFTRadiantItemBonus>.",
    "values": {
      "AD": 0.3499999940395355,
      "AP": 35.0,
      "FlatManaRestore": 10.0,
      "Mana": 20.0
    },
    "unique": false
  },
  "TFT5_Item_SpectralGauntletRadiant": {
    "name": "Equinox",
    "apiName": "TFT5_Item_SpectralGauntletRadiant",
    "description": "@ARReductionAmount@% <TFTKeyword>Sunder</TFTKeyword> enemies within @HexRange@ hexes. Gain <TFTRadiantItemBonus> @BonusResists@ Armor and Magic Resist</TFTRadiantItemBonus> for the first <TFTRadiantItemBonus>@BonusResistDuration@ seconds</TFTRadiantItemBonus> of combat.<br><br><tftitemrules><tftbold>Sunder</tftbold>: Reduce Armor</tftitemrules>",
    "values": {
      "ARReductionAmount": 30.0,
      "BonusResistDuration": 20.0,
      "BonusResists": 70.0,
      "Health": 500.0,
      "HexRange": 3.0,
      "MagicResist": 30.0
    },
    "unique": false
  },
  "TFT5_Item_StatikkShivRadiant": {
    "name": "Statikk's Favor",
    "apiName": "TFT5_Item_StatikkShivRadiant",
    "description": "Every 3rd attack deals <TFTRadiantItemBonus>@Damage@</TFTRadiantItemBonus> magic damage and @MRShred@% <TFTKeyword>Shreds</TFTKeyword> <TFTRadiantItemBonus>@1StarBounces@</TFTRadiantItemBonus> enemies for @MRShredDuration@ seconds.<br><br><tftitemrules><tftbold>Shred</tftbold>: Reduce Magic Resist</tftitemrules>",
    "values": {
      "1StarBounces": 8.0,
      "AP": 50.0,
      "AS": 20.0,
      "Damage": 95.0,
      "MRShred": 30.0,
      "MRShredDuration": 5.0,
      "Mana": 15.0,
      "{12a15e9e}": 8.0,
      "{15144cec}": 8.0,
      "{79e2ec7b}": 8.0
    },
    "unique": false
  },
  "TFT5_Item_SteraksGageRadiant": {
    "name": "Sterak's Megashield",
    "apiName": "TFT5_Item_SteraksGageRadiant",
    "description": "Once per combat at @HealthThreshold@% Health, gain <TFTRadiantItemBonus>@BonusMaxHealthPerc@% max Health</TFTRadiantItemBonus> and <TFTRadiantItemBonus>@BonusADToGive@% Attack Damage</TFTRadiantItemBonus>.",
    "values": {
      "AD": 0.30000001192092896,
      "BonusADToGive": 60.0,
      "BonusMaxHealthPerc": 40.0,
      "Health": 400.0,
      "HealthThreshold": 60.0
    },
    "unique": false
  },
  "TFT5_Item_SunfireCapeRadiant": {
    "name": "Sunlight Cape",
    "apiName": "TFT5_Item_SunfireCapeRadiant",
    "description": "Gain <TFTRadiantItemBonus>@BonusPercentHP*100@%</TFTRadiantItemBonus> max Health.<br><br>Every <TFTRadiantItemBonus>@ICD@</TFTRadiantItemBonus> seconds, deal <TFTRadiantItemBonus>@BurnPercent@%</TFTRadiantItemBonus> <TFTKeyword>Burn</TFTKeyword> and @GrievousWoundsPercent@% <TFTKeyword>Wound</TFTKeyword> to an enemy within <TFTRadiantItemBonus>@HexRange@</TFTRadiantItemBonus> hexes for <TFTRadiantItemBonus>@BurnDuration@</TFTRadiantItemBonus> seconds.<br><br><tftitemrules>[Unique - only 1 per champion]<br><tftbold>Burn</tftbold>: Deals a percent of the target's max Health as true damage every second<br><tftbold>Wound</tftbold>: reduces healing received</tftitemrules>",
    "values": {
      "Armor": 40.0,
      "BonusPercentHP": 0.11999999731779099,
      "BurnDuration": 30.0,
      "BurnPercent": 2.0,
      "GrievousWoundsPercent": 33.0,
      "Health": 300.0,
      "HealthRegenInterval": null,
      "HexRange": 3.0,
      "ICD": 1.5,
      "MaxHealthRegen": null,
      "MonsterCap": 150.0
    },
    "unique": true
  },
  "TFT5_Item_ThiefsGlovesRadiant": {
    "name": "Rascal's Gloves",
    "apiName": "TFT5_Item_ThiefsGlovesRadiant",
    "description": "Each round: Equip 2 random <TFTRadiantItemBonus>Radiant</TFTRadiantItemBonus> items.<br><br><tftitemrules>[Consumes 3 item slots.]</tftitemrules><br>@TFTUnitProperty.:TFT_BindOnEquipTRA@",
    "values": {
      "CritChance": 20.0,
      "Health": 150.0
    },
    "unique": false
  },
  "TFT5_Item_TitansResolveRadiant": {
    "name": "Titan's Vow",
    "apiName": "TFT5_Item_TitansResolveRadiant",
    "description": "Gain <TFTRadiantItemBonus>@StackingAD*100@%</TFTRadiantItemBonus> Attack Damage and <TFTRadiantItemBonus>@StackingSP@</TFTRadiantItemBonus> Ability Power when attacking or taking damage, stacking up to @StackCap@ times.<br><br>At full stacks, gain <TFTRadiantItemBonus>@BonusResistsAtStackCap@</TFTRadiantItemBonus> Armor and <TFTRadiantItemBonus>@BonusResistsAtStackCap@</TFTRadiantItemBonus> Magic Resist.",
    "values": {
      "AS": 30.0,
      "Armor": 35.0,
      "BonusResistsAtStackCap": 50.0,
      "StackCap": 25.0,
      "StackingAD": 0.029999999329447746,
      "StackingSP": 3.0
    },
    "unique": false
  },
  "TFT5_Item_TrapClawRadiant": {
    "name": "Willbreaker",
    "apiName": "TFT5_Item_TrapClawRadiant",
    "description": "After damaging a Shield, gain <TFTRadiantItemBonus>@DamageAmp*100@%</TFTRadiantItemBonus> additional Damage Amp for @Duration@ seconds.",
    "values": {
      "AP": 30.0,
      "AS": 30.0,
      "CritChance": 20.0,
      "DamageAmp": 0.30000001192092896,
      "Duration": 3.0,
      "Health": 150.0,
      "{1543aa48}": 0.20000000298023224
    },
    "unique": false
  },
  "TFT5_Item_WarmogsArmorRadiant": {
    "name": "Warmog's Pride",
    "apiName": "TFT5_Item_WarmogsArmorRadiant",
    "description": "Gain <TFTRadiantItemBonus>@BonusPercentHP*100@%</TFTRadiantItemBonus> max health.<br><br><TFTRadiantItemBonus>Heal @MaxHealthRegen@% max Health per second.</TFTRadiantItemBonus>",
    "values": {
      "BonusPercentHP": 0.20000000298023224,
      "Health": 1000.0,
      "HealthRegenInterval": 1.0,
      "MaxHealthRegen": 1.5
    },
    "unique": false
  }
});
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
