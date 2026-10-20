// Offline archive/provenance columns; never imported by runtime modules.
import { freezeContent } from './freeze';
import { restoreArchiveColumns } from './archive-source';
import { G24_SUPPORT_ITEM_SOURCE as runtime } from './g2-4-support-item-runtime';
export const G24_SUPPORT_ITEM_SOURCE_NOTES = freezeContent({
  "TFT_Item_ZekesHerald": {
    "apiName": "TFT_Item_ZekesHerald",
    "description": "Combat start: Grant %i:scaleAS% @AttackSpeed@% Attack Speed to the holder and allies within 2 hexes in the same row.<br><br>​​<tftitemrules>[Support item]</tftitemrules>"
  },
  "TFT_Item_Chalice": {
    "apiName": "TFT_Item_Chalice",
    "description": "Combat start: Grant @ChaliceAP@ Ability Power and @BonusInitialMana@ Mana to the holder and allies within 2 hexes in the same row.<br><br>​​<tftitemrules>[Support item]</tftitemrules>"
  },
  "TFT4_Item_OrnnRanduinsSanctum": {
    "apiName": "TFT4_Item_OrnnRanduinsSanctum",
    "description": "Combat start: Grant %i:scaleArmor% @BonusDefense@ Armor and %i:scaleMR% @BonusDefense@ Magic Resistance to the holder and adjacent allies.<br><br>​​<tftitemrules>[Support item]</tftitemrules>"
  },
  "TFT_Item_Shroud": {
    "apiName": "TFT_Item_Shroud",
    "description": "Combat start: Shoot a beam that @CostIncrease@% <TFTKeyword>Mana Reaves</TFTKeyword> enemies.<br><br>Your team gains @BonusAllyHealth@ Health.<br><br><tftitemrules>[Support item] [Unique - only 1 per champion]<br><tftbold>Mana Reave</tftbold>: increase maximum Mana until the next cast</tftitemrules><br>@TFTUnitProperty.:TFT_BindOnEquipTRA@"
  },
  "TFT_Item_Zephyr": {
    "apiName": "TFT_Item_Zephyr",
    "description": "Combat start: Summon a whirlwind on the opposite side of the arena that removes the closest enemy from combat for @BanishDuration@ seconds. <br><br>Your team gains @AllyBonusAS@% Attack Speed.<br><br><tftitemrules>[Support item]<br>[Ignores crowd control immunity.]<br>[Unique - only 1 per champion]</tftitemrules><br>@TFTUnitProperty.:TFT_BindOnEquipTRA@"
  },
  "TFT5_Item_ZzRotPortalRadiant": {
    "apiName": "TFT5_Item_ZzRotPortalRadiant",
    "description": "Summon a large Voidspawn. Its strength increases with each Stage.<br><br>​​<tftitemrules>[Support item]<br>[Unique - only 1 per champion]</tftitemrules>"
  },
  "TFT_Item_LocketOfTheIronSolari": {
    "apiName": "TFT_Item_LocketOfTheIronSolari",
    "description": "Combat start: The holder and allies within @HexRange@ hexes in the same row gain a @ShieldValue@ Shield, @BonusResists@ Armor, and @BonusResists@ Magic Resist for @ShieldDuration@ seconds.<br><br>​​<tftitemrules>[Support item]</tftitemrules>"
  },
  "TFT4_Item_OrnnObsidianCleaver": {
    "apiName": "TFT4_Item_OrnnObsidianCleaver",
    "description": "Damage dealt @Shred@% <TFTKeyword>Shreds</TFTKeyword> and @Shred@% <TFTKeyword>Sunders</TFTKeyword> enemies for @Duration@ seconds.<br><br>Your team gains @TeamAD*100@% Attack Damage and @TeamAP@ Ability Power.<br><br><tftitemrules>​​[Support item] [Unique - only 1 per champion]<br><tftbold>Shred</tftbold>: Reduce Magic Resist<br><tftbold>Sunder</tftbold>: Reduce Armor</tftitemrules>"
  },
  "TFT_Item_AegisOfTheLegion": {
    "apiName": "TFT_Item_AegisOfTheLegion",
    "description": "Combat start: Grant @ASBuff@% Attack Speed and @BonusResists@ Armor and Magic Resist to the holder, adjacent allies in the same row, and all allies behind them for @BuffDuration@ seconds.<br><br>​​<tftitemrules>[Support item]</tftitemrules>"
  },
  "TFT_Item_RadiantVirtue": {
    "apiName": "TFT_Item_RadiantVirtue",
    "description": "Every @HealTickRate@ seconds, heal your team for @MaxHealthHeal@% of their max Health. When the holder dies, the healing increases to @TOOLTIPEmpoweredHeal@% max Health for @NumBonusHeals@ extra heals.<br><br><TFTTrackerLabel>Healing:</TFTTrackerLabel> <TFTHighlight>@TFTUnitProperty.item:TFT_Tracker_Value1@</TFTHighlight><br><br>​​<tftitemrules>[Support item]</tftitemrules>"
  },
  "TFT7_Item_ShimmerscaleHeartOfGold": {
    "apiName": "TFT7_Item_ShimmerscaleHeartOfGold",
    "description": "Your team gains @BaseBonusDamage*100@% Damage Amp. Each second the holder is alive, your team gains an additional @AmpPerSec*100@% Damage Amp, up to a total of @MaxDamageAmp*100@%.<br><br>​​<tftitemrules>[Support item]</tftitemrules>"
  },
  "TFT_Item_BansheesVeil": {
    "apiName": "TFT_Item_BansheesVeil",
    "description": "Combat start: Grant the holder and allies within @HexRange@ hexes in the same row immunity to crowd control and @BuffAttackSpeed*100@% Attack Speed for @Duration@ seconds.<br><br><tftitemrules>[Support item] [Unique - only 1 per champion]</tftitemrules>"
  },
  "TFT_Item_EternalFlame": {
    "apiName": "TFT_Item_EternalFlame",
    "description": "While the holder is alive, all enemies are @TOOLTIPWoundAmount@% <TFTKeyword>Wounded</TFTKeyword> and all allies gain @DamageAmp*100@% Damage Amp. This effect refreshes every @WoundDuration@ seconds.<br><br><tftitemrules>​​[Support item]<br><tftbold>Wound</tftbold>: Reduces healing received</tftitemrules>"
  },
  "TFT_Item_SupportKnightsVow": {
    "apiName": "TFT_Item_SupportKnightsVow",
    "description": "Combat start: Grant @AllyHealth@ Health and @Omnivamp*100@% Omnivamp to the holder and allies within 1 hex in the same row.<br><br>​​<tftitemrules>[Support item]</tftitemrules>"
  },
  "TFT_Item_Moonstone": {
    "apiName": "TFT_Item_Moonstone",
    "description": "Every @ShieldRate@ seconds, grant a @BaseShieldAmount@-@MaxShield@ Shield (based on Stage) to the @ShieldTargets@ lowest percent health allies for @ShieldDuration@ seconds.<br><br>​​<tftitemrules>[Support item]</tftitemrules>"
  },
  "TFT_Item_Spite": {
    "apiName": "TFT_Item_Spite",
    "description": "Combat start: The holder and all adjacent allies gain @ADIncrease*100@% Attack Damage and @APIncrease@ Ability Power.<br><br>When the holder dies, Stun all enemies within 2-hexes for @Duration@ seconds.<br><br>​​<tftitemrules>[Support item]</tftitemrules>"
  },
  "TFT_Item_UnstableTreasureChest": {
    "apiName": "TFT_Item_UnstableTreasureChest",
    "description": "When the holder dies, the @ItemsGranted@ highest percent health allies gain a temporary completed item.<br><br>​​<tftitemrules>[Support item]</tftitemrules>"
  }
});
export const G24_SUPPORT_ITEM_SOURCE = restoreArchiveColumns(runtime, G24_SUPPORT_ITEM_SOURCE_NOTES);
