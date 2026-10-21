// Offline archive/provenance columns; never imported by runtime modules.
import { freezeContent } from './freeze';
import { restoreArchiveColumns } from './archive-source';
import { G23_ARCHIVED_SPECIAL_ITEM_SOURCE as runtime } from './g2-3-special-item-runtime';
export { G23_SPECIAL_ITEM_POOLS, G23_RADIANT_MAPPING } from './g2-3-special-item-runtime';
export const G23_SPECIAL_ITEM_SOURCE_NOTES = freezeContent({
  "TFT13_Crime_Bronze_ChemGrips": {
    "apiName": "TFT13_Crime_Bronze_ChemGrips",
    "description": "Reduce all incoming damage by @ReducedDamage@.<br><rules>Recommended users: Renni and Singed</rules>"
  },
  "TFT13_Crime_Bronze_MageGuard": {
    "apiName": "TFT13_Crime_Bronze_MageGuard",
    "description": "Gain @APPerTick@ Ability Power every @TickRate@ seconds.<br><rules>Recommended users: Silco and Renata Glasc</rules>"
  },
  "TFT13_Crime_Bronze_MiningGauntlet": {
    "apiName": "TFT13_Crime_Bronze_MiningGauntlet",
    "description": "Attacks deal an additional @BonusDamageOnAttack@ true damage.<br><rules>Recommended users: Smeech and Sevika</rules>"
  },
  "TFT13_Crime_Gold_DestabilizedChemtank": {
    "apiName": "TFT13_Crime_Gold_DestabilizedChemtank",
    "description": "At @HealthThreshold*100@% Health, gain a @InitialPercentShield*100@% max Health Shield. Every @TickRate@ seconds afterwards, gain a @PercentShield*100@% max Health Shield.<br><rules>Recommended users: Renni and Singed</rules>"
  },
  "TFT13_Crime_Gold_ExecutionersVorpalblade": {
    "apiName": "TFT13_Crime_Gold_ExecutionersVorpalblade",
    "description": "Attacks and Abilities execute enemies under @ExecuteThreshold*100@% Health. On kill, gain @OnKillDR*100@% Durability and @OnKillDA*100@% Damage Amp for @Duration@ seconds (refreshes on kills).<br><rules>Recommended users: Smeech and Sevika</rules>"
  },
  "TFT13_Crime_Gold_FleshRipper": {
    "apiName": "TFT13_Crime_Gold_FleshRipper",
    "description": "After dropping below @HealthThreshold*100@% Health, become briefly untargetable, restore @PercentHeal*100@% max Health, and gain @EnhancedAD*100@% Attack Damage and @EnhancedOmnivamp*100@%&nbsp;Omnivamp.<br><br>{{TFT13_ChemBaronOnlyItem}}<br><rules>Recommended users: Smeech and Sevika</rules>"
  },
  "TFT13_Crime_Gold_PiltovenHexplating": {
    "apiName": "TFT13_Crime_Gold_PiltovenHexplating",
    "description": "Gain @ArmorPerStack@ Armor and Magic Resist when taking damage, stacking up to @MaxStacks@ times.<br><br>At max stacks, deal @ResistancePercentageDamage*100@% %i:scaleArmor%%i:scaleMR% as magic damage to enemies in a @HexRange@-hex radius after being attacked. (Cooldown: @Cooldown@ seconds)<br><rules>Recommended users: Renni and Singed</rules>"
  },
  "TFT13_Crime_Gold_ShimmerBloom": {
    "apiName": "TFT13_Crime_Gold_ShimmerBloom",
    "description": "Increase healing and shielding by <TFTBonus>@IncreasedHealShieldPercent*100@%</TFTBonus>. Every @Cadence@ seconds, gain <TFTBonus>@ShieldAmount@</TFTBonus> Shield for @ShieldDuration@ seconds and grant the same Shield to the @NumAllies@ lowest Health allies.<br><rules>Recommended users: Renni and Renata Glasc</rules>"
  },
  "TFT13_Crime_Gold_UnleashedToxins": {
    "apiName": "TFT13_Crime_Gold_UnleashedToxins",
    "description": "Attacks grant @ExtraManaOnAttack@ bonus Mana. After casting, launch @NumMissiles@ missiles at the current target that deal @FlatDamage@ magic damage.<br><rules>Recommended users: Silco and Renata Glasc</rules>"
  },
  "TFT13_Crime_Gold_VirulentVirus": {
    "apiName": "TFT13_Crime_Gold_VirulentVirus",
    "description": "After dealing ability damage, enemies affected take an extra @DoTPercentDamage*100@% damage over @Duration@ seconds as true damage.<br><rules>Recommended users: Silco and Renata Glasc</rules>"
  },
  "TFT13_Crime_Gold_VoltaicSaber": {
    "apiName": "TFT13_Crime_Gold_VoltaicSaber",
    "description": "After every @NumDamageInstances@ instances of damage, send jolts towards the @NumEnemies@ lowest health enemies, dealing <physicalDamage>@JoltDamage@</physicalDamage> physical damage.<br><rules>Recommended users: Sevika and Smeech</rules>"
  },
  "TFT13_Crime_OmegaPrismatic_DimensionalHeirloom": {
    "apiName": "TFT13_Crime_OmegaPrismatic_DimensionalHeirloom",
    "description": "Combat start: Creates a pocket Anomaly that summons powerful allies from across the Convergence every @Cadence@ seconds.<br><br>{{TFT13_ChemBaronOnlyItem}}"
  },
  "TFT13_Crime_Prismatic_DestabilizedChemtank": {
    "apiName": "TFT13_Crime_Prismatic_DestabilizedChemtank",
    "description": "At @HealthThreshold*100@% Health, gain a @InitialPercentShield*100@% max Health Shield. Every @TickRate@ seconds afterwards, gain a @PercentShield*100@% max Health Shield.<br><br><scaleShimmer>Perfected Bonus:</scaleShimmer> After gaining Shield, fire a vial of chemicals at @PrismaticNumChampions@ nearby enemies that deals @PrismaticDamagePercent*100@% max Health magic damage.<br><rules>Recommended users: Renni and Singed</rules>"
  },
  "TFT13_Crime_Prismatic_ExecutionersVorpalblade": {
    "apiName": "TFT13_Crime_Prismatic_ExecutionersVorpalblade",
    "description": "Attacks and Abilities execute enemies under @ExecuteThreshold*100@% Health. On kill, gain @OnKillDR*100@% Durability and @OnKillDA*100@% Damage Amp for @Duration@ seconds (refreshes on kills).<br><br><scaleShimmer>Perfected Bonus:</scaleShimmer> Executes drop @PrismaticGold@ Gold and heals the holder for @PrismaticHeal@.<br><rules>Recommended users: Smeech and Sevika</rules>"
  },
  "TFT13_Crime_Prismatic_FleshRipper": {
    "apiName": "TFT13_Crime_Prismatic_FleshRipper",
    "description": "After dropping below @HealthThreshold*100@% Health, become briefly Untargetable, restore @PercentHeal*100@% max Health, and gain @EnhancedAD*100@% Attack Damage and @EnhancedOmnivamp*100@% Omnivamp.<br><br><scaleShimmer>Perfected Bonus:</scaleShimmer> Upon dying for the first time, revive with @PrismaticReviveHeal*100@% max Health!<br><br>{{TFT13_ChemBaronOnlyItem}}<br><rules>Recommended users: Smeech and Sevika</rules>"
  },
  "TFT13_Crime_Prismatic_PiltovenHexplating": {
    "apiName": "TFT13_Crime_Prismatic_PiltovenHexplating",
    "description": "Gain @ArmorPerStack@ Armor and Magic Resist when taking damage, stacking up to @MaxStacks@ times.<br><br><scaleShimmer>Perfected Bonus:</scaleShimmer> At max stacks, deal @ResistancePercentageDamage*100@% %i:scaleArmor%%i:scaleMR% as <TFTRadiantItemBonus>true damage</TFTRadiantItemBonus> to enemies in a <TFTRadiantItemBonus>@HexRange@-hex radius</TFTRadiantItemBonus> after being attacked. (Cooldown: @Cooldown@ seconds)<br><rules>Recommended users: Renni and Singed</rules>"
  },
  "TFT13_Crime_Prismatic_ShimmerBloom": {
    "apiName": "TFT13_Crime_Prismatic_ShimmerBloom",
    "description": "Increase healing and shielding by <TFTBonus>@IncreasedHealShieldPercent*100@%</TFTBonus>. Every @Cadence@ seconds, gain <TFTBonus>@ShieldAmount@</TFTBonus> Shield for @ShieldDuration@ seconds and grant the same Shield to the @NumAllies@ lowest Health allies.<br><br><scaleShimmer>Perfected Bonus:</scaleShimmer> Shielding or healing allies grants them @PrismaticAllyAP@ Ability Power and @PrismaticAllyAS*100@% Attack Speed. (Cooldown: @PrismaticCooldownTime@s)<br><rules>Recommended users: Renni and Renata Glasc</rules>"
  },
  "TFT13_Crime_Prismatic_UnleashedToxins": {
    "apiName": "TFT13_Crime_Prismatic_UnleashedToxins",
    "description": "Attacks grant @ExtraManaOnAttack@ bonus Mana. After casting, launch @NumMissiles@ missiles at the current target that deal @FlatDamage@ magic damage.<br><br><scaleShimmer>Perfected Bonus:</scaleShimmer> Casts also launch a wave of toxins that deals @PrismaticWaveDamage@ magic damage and Stuns enemies hit for @PrismaticWaveStunDuration@ seconds.<br><rules>Recommended users: Silco and Renata Glasc</rules>"
  },
  "TFT13_Crime_Prismatic_VirulentVirus": {
    "apiName": "TFT13_Crime_Prismatic_VirulentVirus",
    "description": "After dealing ability damage, enemies affected take an extra @DoTPercentDamage*100@% damage over @Duration@ seconds as true damage.<br><br><scaleShimmer>Perfected Bonus:</scaleShimmer> Infected enemies deal @PrismaticReducedDamage*100@% less damage. When they die, they join your side with <TFTBonus>@PrismaticZombieHealth@</TFTBonus> Health that decays over @PrismaticZombieDecayDuration@&nbsp;seconds.<br><rules>Recommended users: Silco and Renata Glasc</rules>"
  },
  "TFT13_Crime_Prismatic_VoltaicSaber": {
    "apiName": "TFT13_Crime_Prismatic_VoltaicSaber",
    "description": "After every @NumDamageInstances@ instances of damage, send jolts towards the @NumEnemies@ lowest health enemies, dealing <physicalDamage>@JoltDamage@</physicalDamage> physical damage.<br><br><scaleShimmer>Perfected Bonus:</scaleShimmer> Every time the holder fires bolts, they gain @PrismaticASPerTrigger*100@% Attack Speed.<br><rules>Recommended users: Sevika and Smeech</rules>"
  },
  "TFT13_Crime_Silver_DestabilizedChemtank": {
    "apiName": "TFT13_Crime_Silver_DestabilizedChemtank",
    "description": "At @HealthThreshold*100@% Health, gain a @InitialPercentShield*100@% max Health Shield. Every @TickRate@ seconds afterwards, gain a @PercentShield*100@% max Health Shield.<br><rules>Recommended users: Renni and Singed</rules>"
  },
  "TFT13_Crime_Silver_ExecutionersVorpalblade": {
    "apiName": "TFT13_Crime_Silver_ExecutionersVorpalblade",
    "description": "Attacks and Abilities execute enemies under @ExecuteThreshold*100@% Health. On kill, gain @OnKillDR*100@% Durability and @OnKillDA*100@% Damage Amp for @Duration@ seconds (refreshes on kills).<br><rules>Recommended users: Smeech and Sevika</rules>"
  },
  "TFT13_Crime_Silver_FleshRipper": {
    "apiName": "TFT13_Crime_Silver_FleshRipper",
    "description": "After dropping below @HealthThreshold*100@% Health, become briefly untargetable, restore @PercentHeal*100@% max Health, and gain @EnhancedAD*100@% Attack Damage and @EnhancedOmnivamp*100@%&nbsp;Omnivamp.<br><br>{{TFT13_ChemBaronOnlyItem}}<br><rules>Recommended users: Smeech and Sevika</rules>"
  },
  "TFT13_Crime_Silver_PiltovenHexplating": {
    "apiName": "TFT13_Crime_Silver_PiltovenHexplating",
    "description": "Gain @ArmorPerStack@ Armor and Magic Resist when taking damage, stacking up to @MaxStacks@ times.<br><br>At max stacks, deal @ResistancePercentageDamage*100@% %i:scaleArmor%%i:scaleMR% as magic damage to enemies in a @HexRange@-hex radius after being attacked. (Cooldown: @Cooldown@ seconds)<br><rules>Recommended users: Renni and Singed</rules>"
  },
  "TFT13_Crime_Silver_ShimmerBloom": {
    "apiName": "TFT13_Crime_Silver_ShimmerBloom",
    "description": "Increase healing and shielding by <TFTBonus>@IncreasedHealShieldPercent*100@%</TFTBonus>. Every @Cadence@ seconds, gain <TFTBonus>@ShieldAmount@</TFTBonus> Shield for @ShieldDuration@ seconds and grant the same Shield to the @NumAllies@ lowest Health allies.<br><rules>Recommended users: Renni and Renata Glasc</rules>"
  },
  "TFT13_Crime_Silver_UnleashedToxins": {
    "apiName": "TFT13_Crime_Silver_UnleashedToxins",
    "description": "Attacks grant @ExtraManaOnAttack@ bonus Mana. After casting, launch @NumMissiles@ missiles at the current target that deal @FlatDamage@ magic damage.<br><rules>Recommended users: Silco and Renata Glasc</rules>"
  },
  "TFT13_Crime_Silver_VirulentVirus": {
    "apiName": "TFT13_Crime_Silver_VirulentVirus",
    "description": "After dealing ability damage, enemies affected take an extra @DoTPercentDamage*100@% damage over @Duration@ seconds as true damage.<br><rules>Recommended users: Silco and Renata Glasc</rules>"
  },
  "TFT13_Crime_Silver_VoltaicSaber": {
    "apiName": "TFT13_Crime_Silver_VoltaicSaber",
    "description": "After every @NumDamageInstances@ instances of damage, send jolts towards the @NumEnemies@ lowest health enemies, dealing <physicalDamage>@JoltDamage@</physicalDamage> physical damage.<br><rules>Recommended users: Sevika and Smeech</rules>"
  },
  "TFT5_Item_AdaptiveHelmRadiant": {
    "apiName": "TFT5_Item_AdaptiveHelmRadiant",
    "description": "Combat start: Gain different bonuses based on starting position.<br><br>Front Two Rows: <TFTRadiantItemBonus>@FrontRowBonusResists@</TFTRadiantItemBonus> Armor and Magic Resist. Gain <TFTRadiantItemBonus>@FrontLineManaPerHit@</TFTRadiantItemBonus> Mana when struck by an attack.<br><br>Back Two Rows: <TFTRadiantItemBonus>@BackRowBonusAP@</TFTRadiantItemBonus> Ability Power. Gain <TFTRadiantItemBonus>@ManaPerTickrate@</TFTRadiantItemBonus> Mana every @ManaTickrate@ seconds.<br>"
  },
  "TFT5_Item_ArchangelsStaffRadiant": {
    "apiName": "TFT5_Item_ArchangelsStaffRadiant",
    "description": "Combat start: Gain <TFTRadiantItemBonus>@APPerInterval@</TFTRadiantItemBonus> Ability Power every <TFTRadiantItemBonus>@IntervalSeconds@</TFTRadiantItemBonus> seconds in combat."
  },
  "TFT5_Item_BloodthirsterRadiant": {
    "apiName": "TFT5_Item_BloodthirsterRadiant",
    "description": "Once per combat: At @HealthThreshold@% Health, gain a <TFTRadiantItemBonus>@ShieldHealthPercent@%</TFTRadiantItemBonus> max Health Shield that lasts up to @ShieldDuration@ seconds."
  },
  "TFT5_Item_BlueBuffRadiant": {
    "apiName": "TFT5_Item_BlueBuffRadiant",
    "description": "Gain @ManaRefund@ Mana after casting. <br><br>When the holder gets a takedown, they deal <TFTRadiantItemBonus>@DamageAmp*100@%</TFTRadiantItemBonus> more damage for <TFTRadiantItemBonus>@TakedownTimer@</TFTRadiantItemBonus> seconds.<br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules><br><br>"
  },
  "TFT5_Item_BrambleVestRadiant": {
    "apiName": "TFT5_Item_BrambleVestRadiant",
    "description": "Gain <TFTRadiantItemBonus>@PercentMaxHP*100@%</TFTRadiantItemBonus> max health.<br><br>Take <TFTRadiantItemBonus>@AutoDamageReduction*100@%</TFTRadiantItemBonus> reduced damage from attacks. When struck by any attack, deal <TFTRadiantItemBonus>@1StarAoEDamage@</TFTRadiantItemBonus> magic damage to all adjacent enemies.<br><br><tftitemrules>Cooldown: @ICD@ seconds</tftitemrules>"
  },
  "TFT5_Item_CrownguardRadiant": {
    "apiName": "TFT5_Item_CrownguardRadiant",
    "description": "Combat start: Gain a <TFTRadiantItemBonus>@ShieldSize@%</TFTRadiantItemBonus> max Health Shield for @ShieldDuration@ seconds. <br>When the shield expires, gain <TFTRadiantItemBonus>@ShieldBonusAP@ Ability Power</TFTRadiantItemBonus>."
  },
  "TFT5_Item_DeathbladeRadiant": {
    "apiName": "TFT5_Item_DeathbladeRadiant",
    "description": "<tftitemrules>It glows in the presence of enemies. Or friends. Or anything alive, really.</tftitemrules>"
  },
  "TFT5_Item_DragonsClawRadiant": {
    "apiName": "TFT5_Item_DragonsClawRadiant",
    "description": "Gain <TFTRadiantItemBonus>@PercentMaxHP*100@%</TFTRadiantItemBonus> max health.<br><br>Every @HealthRegenInterval@ seconds, heal <TFTRadiantItemBonus>@PercentHealthDamage@%</TFTRadiantItemBonus> max Health.<br>"
  },
  "TFT5_Item_FrozenHeartRadiant": {
    "apiName": "TFT5_Item_FrozenHeartRadiant",
    "description": "Once per combat at @HealthThreshold@% Health, gain a <TFTRadiantItemBonus>@ShieldHealthPercent@%</TFTRadiantItemBonus> max Health Shield that lasts <TFTRadiantItemBonus>@ShieldDuration@</TFTRadiantItemBonus> seconds and gain <TFTRadiantItemBonus>@Stats@</TFTRadiantItemBonus> Armor and <TFTRadiantItemBonus>@Stats@</TFTRadiantItemBonus> Magic Resist.<br>"
  },
  "TFT5_Item_GargoyleStoneplateRadiant": {
    "apiName": "TFT5_Item_GargoyleStoneplateRadiant",
    "description": "Gain <TFTRadiantItemBonus>@ArmorPerEnemy@</TFTRadiantItemBonus> Armor and <TFTRadiantItemBonus>@MRPerEnemy@</TFTRadiantItemBonus> Magic Resist for each enemy targeting the holder.<br><br><TFTRadiantItemBonus>Also, heal @MaxHealthRegen@% max Health each second.</TFTRadiantItemBonus>"
  },
  "TFT5_Item_GiantSlayerRadiant": {
    "apiName": "TFT5_Item_GiantSlayerRadiant",
    "description": "Gain <TFTRadiantItemBonus>@DamageAmp*100@%</TFTRadiantItemBonus> additional Damage Amp against enemies with more than @HealthThreshold@ max Health."
  },
  "TFT5_Item_GuardianAngelRadiant": {
    "apiName": "TFT5_Item_GuardianAngelRadiant",
    "description": "Once per combat: At @HealthThreshold@% Health, briefly become untargetable and shed negative effects. Then, <TFTRadiantItemBonus>heal @MissingHealthRestore*100@% missing health and gain @AttackSpeed@% bonus Attack Speed</TFTRadiantItemBonus>. <br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules>"
  },
  "TFT5_Item_GuinsoosRagebladeRadiant": {
    "apiName": "TFT5_Item_GuinsoosRagebladeRadiant",
    "description": "Attacks grant <TFTRadiantItemBonus>@AttackSpeedPerStack@%</TFTRadiantItemBonus> stacking Attack Speed."
  },
  "TFT5_Item_HandOfJusticeRadiant": {
    "apiName": "TFT5_Item_HandOfJusticeRadiant",
    "description": "Gain 2 effects:<li><TFTRadiantItemBonus>@AD_NotStatBar*100@%</TFTRadiantItemBonus> Attack Damage and <TFTRadiantItemBonus>@AP_NotStatBar@</TFTRadiantItemBonus> Ability Power.<li><TFTRadiantItemBonus>@StatOmnivamp_NotStatBar*100@%</TFTRadiantItemBonus> Omnivamp.<br><br>While above @HealthThreshold*100@% health, double the Attack Damage and Ability Power. While below @HealthThreshold*100@% Health, double the Omnivamp."
  },
  "TFT5_Item_HextechGunbladeRadiant": {
    "apiName": "TFT5_Item_HextechGunbladeRadiant",
    "description": "Heal the lowest percent Health ally for <TFTRadiantItemBonus>@AllyHealing*100@%</TFTRadiantItemBonus> of damage dealt.<br><br><TFTTrackerLabel>Ally Healing:</TFTTrackerLabel> <TFTHighlight>@TFTUnitProperty.item:TFT_Tracker_Value1@</TFTHighlight>"
  },
  "TFT5_Item_InfinityEdgeRadiant": {
    "apiName": "TFT5_Item_InfinityEdgeRadiant",
    "description": "Abilities can critically strike.<br><br>If the holder's abilities can already critically strike, gain @CritDamageToGive*100@% Critical Strike Damage instead."
  },
  "TFT5_Item_IonicSparkRadiant": {
    "apiName": "TFT5_Item_IonicSparkRadiant",
    "description": "@MRShred@% <TFTKeyword>Shred</TFTKeyword> enemies within <TFTRadiantItemBonus>@HexRange@</TFTRadiantItemBonus> hexes. When enemies cast an Ability, deal magic damage equal to <TFTRadiantItemBonus>@ManaRatio@%</TFTRadiantItemBonus> of the Mana spent..<br><br><TFTRadiantItemBonus>Also, heal @MaxHealthRegen@% max Health per second.</TFTRadiantItemBonus><br><br><tftitemrules>[Direct damage item]<br><tftbold>Shred</tftbold>: Reduce Magic Resist</tftitemrules>"
  },
  "TFT5_Item_JeweledGauntletRadiant": {
    "apiName": "TFT5_Item_JeweledGauntletRadiant",
    "description": "Abilities can critically strike.<br><br>If the holder's abilities can already critically strike, gain @CritDamageToGive*100@% Critical Strike Damage instead."
  },
  "TFT5_Item_LastWhisperRadiant": {
    "apiName": "TFT5_Item_LastWhisperRadiant",
    "description": "Physical damage @ArmorReductionPercent@% <TFTKeyword>Sunders</TFTKeyword> the target for <TFTRadiantItemBonus>the rest of combat.</TFTRadiantItemBonus> This effect does not stack.<br><br><tftitemrules>[Unique - only 1 per champion]<br><tftbold>Sunder</tftbold>: Reduce Armor</tftitemrules>"
  },
  "TFT5_Item_LeviathanRadiant": {
    "apiName": "TFT5_Item_LeviathanRadiant",
    "description": "After casting an Ability, gain <TFTRadiantItemBonus>@AttackSpeedToGive@% Attack Speed</TFTRadiantItemBonus> for <TFTRadiantItemBonus>@ASDuration@ seconds</TFTRadiantItemBonus>."
  },
  "TFT5_Item_MorellonomiconRadiant": {
    "apiName": "TFT5_Item_MorellonomiconRadiant",
    "description": "Attacks and Abilities deal <TFTRadiantItemBonus>@BurnPercent@%</TFTRadiantItemBonus> <TFTKeyword>Burn</TFTKeyword> and @GrievousWoundsPercent@% <TFTKeyword>Wound</TFTKeyword> to enemies for <TFTRadiantItemBonus>@BurnDuration@</TFTRadiantItemBonus> seconds.<br><br><tftitemrules>[Unique - only 1 per champion]<br><tftbold>Burn</tftbold>: Deals a percent of the target's max Health as true damage every second<br><tftbold>Wound</tftbold>: Reduces healing received</tftitemrules>"
  },
  "TFT5_Item_NightHarvesterRadiant": {
    "apiName": "TFT5_Item_NightHarvesterRadiant",
    "description": "Gain <TFTRadiantItemBonus>@BaseDurability*100@%</TFTRadiantItemBonus> durability. While above <TFTRadiantItemBonus>@ThresholdForEmpower*100@%</TFTRadiantItemBonus> Health, instead gain <TFTRadiantItemBonus>@EmpoweredDurability*100@%</TFTRadiantItemBonus> Durability."
  },
  "TFT5_Item_QuicksilverRadiant": {
    "apiName": "TFT5_Item_QuicksilverRadiant",
    "description": "Combat start: Gain immunity to crowd control for <TFTRadiantItemBonus>@SpellShieldDuration@</TFTRadiantItemBonus> seconds. <TFTRadiantItemBonus>For @ASTotalDuration@ seconds, gain @ProcAttackSpeed*100@% Attack Speed every @ProcInterval@ seconds.</TFTRadiantItemBonus><br><br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules>"
  },
  "TFT5_Item_RabadonsDeathcapRadiant": {
    "apiName": "TFT5_Item_RabadonsDeathcapRadiant",
    "description": "<tftitemrules>It's witnessed - and unleashed - miracles and calamities both.</tftitemrules>"
  },
  "TFT5_Item_RapidFirecannonRadiant": {
    "apiName": "TFT5_Item_RapidFirecannonRadiant",
    "description": "Attacks and Abilities <TFTRadiantItemBonus>@BurnPercent@%</TFTRadiantItemBonus> <TFTKeyword>Burn</TFTKeyword> and <TFTRadiantItemBonus>@HealingReductionPct@%</TFTRadiantItemBonus> <TFTKeyword>Wound</TFTKeyword> enemies for @Duration@ seconds.<br><br><tftitemrules><tftbold>Burn</tftbold>: Deals a percent of the target's max Health as true damage every second<br><tftbold>Wound</tftbold>: Reduces healing received</tftitemrules><br>"
  },
  "TFT5_Item_RedemptionRadiant": {
    "apiName": "TFT5_Item_RedemptionRadiant",
    "description": "Heal allies within <TFTRadiantItemBonus>@HexRadius@</TFTRadiantItemBonus> hexes for <TFTRadiantItemBonus>@MissingHealthHeal@%</TFTRadiantItemBonus> of their missing Health every @HealTickRate@ seconds. They also gain @AoEDamageReduction@% Durability for @HealTickRate@ seconds (this does not stack).<br><br><TFTTrackerLabel>Healing:</TFTTrackerLabel> <TFTHighlight>@TFTUnitProperty.item:TFT_Tracker_Value1@</TFTHighlight>"
  },
  "TFT5_Item_RunaansHurricaneRadiant": {
    "apiName": "TFT5_Item_RunaansHurricaneRadiant",
    "description": "Attacks fire a bolt at a nearby enemy, dealing <TFTRadiantItemBonus>@MultiplierForDamage@%</TFTRadiantItemBonus> Attack Damage %i:scaleAD% as physical damage.<br>"
  },
  "TFT5_Item_SpearOfShojinRadiant": {
    "apiName": "TFT5_Item_SpearOfShojinRadiant",
    "description": "Attacks grant <TFTRadiantItemBonus>@FlatManaRestore@ bonus Mana</TFTRadiantItemBonus>."
  },
  "TFT5_Item_SpectralGauntletRadiant": {
    "apiName": "TFT5_Item_SpectralGauntletRadiant",
    "description": "@ARReductionAmount@% <TFTKeyword>Sunder</TFTKeyword> enemies within @HexRange@ hexes. Gain <TFTRadiantItemBonus> @BonusResists@ Armor and Magic Resist</TFTRadiantItemBonus> for the first <TFTRadiantItemBonus>@BonusResistDuration@ seconds</TFTRadiantItemBonus> of combat.<br><br><tftitemrules><tftbold>Sunder</tftbold>: Reduce Armor</tftitemrules>"
  },
  "TFT5_Item_StatikkShivRadiant": {
    "apiName": "TFT5_Item_StatikkShivRadiant",
    "description": "Every 3rd attack deals <TFTRadiantItemBonus>@Damage@</TFTRadiantItemBonus> magic damage and @MRShred@% <TFTKeyword>Shreds</TFTKeyword> <TFTRadiantItemBonus>@1StarBounces@</TFTRadiantItemBonus> enemies for @MRShredDuration@ seconds.<br><br><tftitemrules><tftbold>Shred</tftbold>: Reduce Magic Resist</tftitemrules>"
  },
  "TFT5_Item_SteraksGageRadiant": {
    "apiName": "TFT5_Item_SteraksGageRadiant",
    "description": "Once per combat at @HealthThreshold@% Health, gain <TFTRadiantItemBonus>@BonusMaxHealthPerc@% max Health</TFTRadiantItemBonus> and <TFTRadiantItemBonus>@BonusADToGive@% Attack Damage</TFTRadiantItemBonus>."
  },
  "TFT5_Item_SunfireCapeRadiant": {
    "apiName": "TFT5_Item_SunfireCapeRadiant",
    "description": "Gain <TFTRadiantItemBonus>@BonusPercentHP*100@%</TFTRadiantItemBonus> max Health.<br><br>Every <TFTRadiantItemBonus>@ICD@</TFTRadiantItemBonus> seconds, deal <TFTRadiantItemBonus>@BurnPercent@%</TFTRadiantItemBonus> <TFTKeyword>Burn</TFTKeyword> and @GrievousWoundsPercent@% <TFTKeyword>Wound</TFTKeyword> to an enemy within <TFTRadiantItemBonus>@HexRange@</TFTRadiantItemBonus> hexes for <TFTRadiantItemBonus>@BurnDuration@</TFTRadiantItemBonus> seconds.<br><br><tftitemrules>[Unique - only 1 per champion]<br><tftbold>Burn</tftbold>: Deals a percent of the target's max Health as true damage every second<br><tftbold>Wound</tftbold>: reduces healing received</tftitemrules>"
  },
  "TFT5_Item_ThiefsGlovesRadiant": {
    "apiName": "TFT5_Item_ThiefsGlovesRadiant",
    "description": "Each round: Equip 2 random <TFTRadiantItemBonus>Radiant</TFTRadiantItemBonus> items.<br><br><tftitemrules>[Consumes 3 item slots.]</tftitemrules><br>@TFTUnitProperty.:TFT_BindOnEquipTRA@"
  },
  "TFT5_Item_TitansResolveRadiant": {
    "apiName": "TFT5_Item_TitansResolveRadiant",
    "description": "Gain <TFTRadiantItemBonus>@StackingAD*100@%</TFTRadiantItemBonus> Attack Damage and <TFTRadiantItemBonus>@StackingSP@</TFTRadiantItemBonus> Ability Power when attacking or taking damage, stacking up to @StackCap@ times.<br><br>At full stacks, gain <TFTRadiantItemBonus>@BonusResistsAtStackCap@</TFTRadiantItemBonus> Armor and <TFTRadiantItemBonus>@BonusResistsAtStackCap@</TFTRadiantItemBonus> Magic Resist."
  },
  "TFT5_Item_TrapClawRadiant": {
    "apiName": "TFT5_Item_TrapClawRadiant",
    "description": "After damaging a Shield, gain <TFTRadiantItemBonus>@DamageAmp*100@%</TFTRadiantItemBonus> additional Damage Amp for @Duration@ seconds."
  },
  "TFT5_Item_WarmogsArmorRadiant": {
    "apiName": "TFT5_Item_WarmogsArmorRadiant",
    "description": "Gain <TFTRadiantItemBonus>@BonusPercentHP*100@%</TFTRadiantItemBonus> max health.<br><br><TFTRadiantItemBonus>Heal @MaxHealthRegen@% max Health per second.</TFTRadiantItemBonus>"
  },
  "TFT_Item_ForceOfNature": {
    "apiName": "TFT_Item_ForceOfNature",
    "description": "Your team gains +@MaxArmySizeIncrease@ max team size.<br><br>@PercentGoldChance@% chance to drop 1 gold when you win combat.<br><br><tftitemrules>\"...the Heart of a hero...\"</tftitemrules>"
  }
});
export const G23_SPECIAL_ITEM_SOURCE = restoreArchiveColumns(runtime, G23_SPECIAL_ITEM_SOURCE_NOTES);
