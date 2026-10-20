// Offline archive/provenance columns; never imported by runtime modules.
import { freezeContent } from './freeze';
import { restoreArchiveColumns } from './archive-source';
import { G24_ARTIFACT_SOURCE as runtime } from './g2-4-artifact-runtime';
export const G24_ARTIFACT_SOURCE_NOTES = freezeContent({
  "TFT4_Item_OrnnAnimaVisage": {
    "name": "Anima Visage",
    "apiName": "TFT4_Item_OrnnAnimaVisage",
    "description": "Heal @PercentHealthRegen@% max Health every second."
  },
  "TFT4_Item_OrnnDeathsDefiance": {
    "name": "Death's Defiance",
    "apiName": "TFT4_Item_OrnnDeathsDefiance",
    "description": "@IgnorePainPercent@% of the damage the holder receives is instead dealt over @BleedDuration@ seconds as non-lethal damage.<br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules>"
  },
  "TFT4_Item_OrnnInfinityForce": {
    "name": "Infinity Force",
    "apiName": "TFT4_Item_OrnnInfinityForce",
    "description": "<tftitemrules>Tons of EVERYTHING!</tftitemrules>"
  },
  "TFT4_Item_OrnnMuramana": {
    "name": "Manazane",
    "apiName": "TFT4_Item_OrnnMuramana",
    "description": "After casting the first time in combat, gain @ManaRestore@ Mana over @ManaDuration@ seconds.<br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules>"
  },
  "TFT4_Item_OrnnTheCollector": {
    "name": "Gold Collector",
    "apiName": "TFT4_Item_OrnnTheCollector",
    "description": "Attacks and Abilities execute enemies below @ExecutePercent@% of their maximum Health. Executions have a @GoldChance@% chance to drop %i:goldCoins% 1 gold.<br><br><TFTTrackerLabel>Gold Collected:</TFTTrackerLabel> <TFTHighlight>@TFTUnitProperty.item:TFT_Tracker_Value1@g</TFTHighlight><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules>"
  },
  "TFT4_Item_OrnnZhonyasParadox": {
    "name": "Zhonya's Paradox",
    "apiName": "TFT4_Item_OrnnZhonyasParadox",
    "description": "Once per combat at @PercentHealthThreshold@% Health, become invulnerable and untargetable for @InvulnDuration@ seconds.<br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules>"
  },
  "TFT9_Item_OrnnHullbreaker": {
    "name": "Hullcrusher",
    "apiName": "TFT9_Item_OrnnHullbreaker",
    "description": "Combat Start: If there are no adjacent allies, gain @ExtraHealth@ Health, @ExtraADandAP@% Attack Damage, and @ExtraADandAP@ Ability Power."
  },
  "TFT9_Item_OrnnDeathfireGrasp": {
    "name": "Deathfire Grasp",
    "apiName": "TFT9_Item_OrnnDeathfireGrasp",
    "description": "Combat start: Blast the current target for @PercentMaxHealthDamage@% of their max Health as magic damage. Repeat this every @RepeatTime@ seconds."
  },
  "TFT9_Item_OrnnHorizonFocus": {
    "name": "Sniper's Focus",
    "apiName": "TFT9_Item_OrnnHorizonFocus",
    "description": "Gain %i:scaleRange% @HexRangeIncrease@ Attack Range. Gain @DamageAmpPerHex*100@% Damage Amp against a target for each hex between the holder and the target."
  },
  "TFT9_Item_OrnnTrickstersGlass": {
    "name": "Trickster's Glass",
    "apiName": "TFT9_Item_OrnnTrickstersGlass",
    "description": "Summon a clone with @HealthPercent@% max Health and +@ManaIncrease*100@% max Mana. You cannot equip items to the clone.<br><br><tftitemrules>The clone benefits from active traits</tftitemrules><br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules><br>"
  },
  "TFT7_Item_ShimmerscaleGamblersBlade": {
    "name": "Gambler's Blade",
    "apiName": "TFT7_Item_ShimmerscaleGamblersBlade",
    "description": "Grant %i:scaleAS% @AttackSpeedPerGold*100@% bonus Attack Speed per %i:goldCoins% gold in your bank (up to %i:goldCoins% @AttackSpeedGoldLimit@ gold).<br><br>Each attack has a @ChanceToProc*100@% chance to drop %i:goldCoins% @GoldPerProc@ gold.<br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules><br><tftitemrules>Gold generated this game: @TFTUnitProperty.item:TFT_Item_GoldGenerated@</tftitemrules>"
  },
  "TFT7_Item_ShimmerscaleMogulsMail": {
    "name": "Mogul's Mail",
    "apiName": "TFT7_Item_ShimmerscaleMogulsMail",
    "description": "Grants @BaseResistsPerStack@ Armor, @BaseResistsPerStack@ Magic Resist, and @BaseHealthPerStack@ Health when taking damage, stacking up to @StackCap@ times.<br><br>At full stacks, grant %i:goldCoins% @GoldAtFullStacks@ gold and continue gaining %i:goldCoins% 1 gold every @GoldInterval@ seconds.<br><br><tftitemrules>Gold generated this game: @TFTUnitProperty.item:TFT_Item_GoldGenerated@<br>[Unique - only 1 per champion]</tftitemrules>"
  },
  "TFT_Item_Artifact_TalismanOfAscension": {
    "name": "Talisman Of Ascension",
    "apiName": "TFT_Item_Artifact_TalismanOfAscension",
    "description": "After @Seconds@ seconds gain @MaxHealthPercent@% max Health and @DamageAmp*100@% Damage Amp for the rest of combat."
  },
  "TFT_Item_Artifact_Fishbones": {
    "name": "Fishbones",
    "apiName": "TFT_Item_Artifact_Fishbones",
    "description": "Doubles the holder's attack range, and causes each of their attacks to target a random enemy."
  },
  "TFT_Item_Artifact_SuspiciousTrenchCoat": {
    "name": "Suspicious Trench Coat",
    "apiName": "TFT_Item_Artifact_SuspiciousTrenchCoat",
    "description": "Once per combat at @PercentHealthTrigger@% Health, the holder splits into 3 copies of themself each with @PercentHealthOfCopies@% of their max Health.<br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules>"
  },
  "TFT_Item_Artifact_HorizonFocus": {
    "name": "Horizon Focus",
    "apiName": "TFT_Item_Artifact_HorizonFocus",
    "description": "Stunning an enemy causes lightning to strike them, dealing @PercentHealthDamage@% of their max Health as magic damage.<br>"
  },
  "TFT_Item_Artifact_Mittens": {
    "name": "Mittens",
    "apiName": "TFT_Item_Artifact_Mittens",
    "description": "Shrinks the holder, granting them increased movement speed and immunity to <TFTKeyword>Chill</TFTKeyword>.<br><br><tftitemrules><tftbold>Chill</tftbold>: reduce Attack Speed</tftitemrules>"
  },
  "TFT_Item_Artifact_UnendingDespair": {
    "name": "Unending Despair",
    "apiName": "TFT_Item_Artifact_UnendingDespair",
    "description": "Whenever a Shield on the holder breaks, @PercentDamage@% of that Shield's initial value is dealt to the nearest enemy as magic damage."
  },
  "TFT_Item_Artifact_RapidFirecannon": {
    "name": "Rapid Firecannon",
    "apiName": "TFT_Item_Artifact_RapidFirecannon",
    "description": "Gain +1 Attack Range, increased by 1 whenever the holder kills an enemy."
  },
  "TFT_Item_Artifact_InnervatingLocket": {
    "name": "Innervating Locket",
    "apiName": "TFT_Item_Artifact_InnervatingLocket",
    "description": "The holder gains @PercentMana@% of their total Mana whenever they're hit by an attack.<br><br>Each cast restores @PercentHealth@% of the holder's max Health over @Duration@ seconds."
  },
  "TFT_Item_Artifact_LudensTempest": {
    "name": "Luden's Tempest",
    "apiName": "TFT_Item_Artifact_LudensTempest",
    "description": "@PercentOfOverkill@% of overkill damage plus @BaseDamage@ is dealt as magic damage to the three enemies nearest the target."
  },
  "TFT_Item_Artifact_SilvermereDawn": {
    "name": "Silvermere Dawn",
    "apiName": "TFT_Item_Artifact_SilvermereDawn",
    "description": "Grants immunity to Stuns and the holder's attacks Stun the target for @StunDuration@ seconds.<br><br><TFTShadowItemBonus>The holder's Attack Speed is locked at @AttackSpeedCap@.</TFTShadowItemBonus>"
  },
  "TFT_Item_Artifact_ProwlersClaw": {
    "name": "Prowler's Claw",
    "apiName": "TFT_Item_Artifact_ProwlersClaw",
    "description": "After killing a target, shed negative effects and dash to the farthest target within @HexRange@ hexes. The next 2 critical attacks deal @CritDamageBonusPercent@% bonus Critical Strike Damage."
  },
  "TFT_Item_Artifact_SpectralCutlass": {
    "name": "Spectral Cutlass",
    "apiName": "TFT_Item_Artifact_SpectralCutlass",
    "description": "Combat start: Teleport the holder to the mirrored hex on the enemy's side of the board. After @Duration@ seconds, the holder returns to their original location."
  },
  "TFT_Item_Artifact_BlightingJewel": {
    "name": "Blighting Jewel",
    "apiName": "TFT_Item_Artifact_BlightingJewel",
    "description": "Dealing magic damage reduces the target's Magic Resist by @MRReduction@. If their Magic Resist is 0, grant the holder @ManaGain@ Mana instead."
  },
  "TFT_Item_Artifact_WitsEnd": {
    "name": "Wit's End",
    "apiName": "TFT_Item_Artifact_WitsEnd",
    "description": "Attacks deal @TFTUnitProperty.item:TFT_Item_Artifact_WitsEnd_Damage@ bonus magic damage.<br><br>Heals the holder for @PercentHealing@% of all magic damage dealt.<br><br><tftitemrules>Damage increases based on Stage.</tftitemrules>"
  },
  "TFT_Item_Artifact_LichBane": {
    "name": "Lich Bane",
    "apiName": "TFT_Item_Artifact_LichBane",
    "description": "The holder's first attack after each Ability cast deals @TFTUnitProperty.item:TFT_Item_Artifact_LichBane_Damage@ bonus magic damage.<br><br><tftitemrules>Damage increases based on Stage.</tftitemrules>"
  },
  "TFT_Item_Artifact_LightshieldCrest": {
    "name": "Lightshield Crest",
    "apiName": "TFT_Item_Artifact_LightshieldCrest",
    "description": "Every @TriggerRate@ seconds, Shields the lowest percent Health ally for @PercentOfResists@% of the holder's combined Armor and Magic Resist for @ShieldDuration@ seconds.<br><br>On death grants this shield to all allies."
  },
  "TFT_Item_Artifact_SeekersArmguard": {
    "name": "Seeker's Armguard",
    "apiName": "TFT_Item_Artifact_SeekersArmguard",
    "description": "Takedowns increase the holder's Armor, Magic Resist, and Ability Power by @StatsPerTakedown@, increased to @StatsPerKill@ if they score the kill."
  }
});
export const G24_ARTIFACT_SOURCE = restoreArchiveColumns(runtime, G24_ARTIFACT_SOURCE_NOTES);
