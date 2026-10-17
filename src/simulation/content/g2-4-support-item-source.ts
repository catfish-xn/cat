// G2-4b support item identities/parameters (en_us 14.24 archive); execution is declared in g2-4-support-items.ts.
import {freezeContent} from "./freeze";
export const G24_SUPPORT_ITEM_SOURCE=freezeContent({
  "TFT_Item_ZekesHerald": {
    "name": "Zeke's Herald",
    "apiName": "TFT_Item_ZekesHerald",
    "description": "Combat start: Grant %i:scaleAS% @AttackSpeed@% Attack Speed to the holder and allies within 2 hexes in the same row.<br><br>​​<tftitemrules>[Support item]</tftitemrules>",
    "values": {
      "AttackSpeed": 30.0,
      "Health": 150.0,
      "HexRange": 2.0
    },
    "unique": false
  },
  "TFT_Item_Chalice": {
    "name": "Chalice of Power",
    "apiName": "TFT_Item_Chalice",
    "description": "Combat start: Grant @ChaliceAP@ Ability Power and @BonusInitialMana@ Mana to the holder and allies within 2 hexes in the same row.<br><br>​​<tftitemrules>[Support item]</tftitemrules>",
    "values": {
      "BonusInitialMana": 10.0,
      "ChaliceAP": 25.0,
      "Health": 150.0,
      "HexRange": 2.0,
      "{9fd37c1c}": 60.0
    },
    "unique": false
  },
  "TFT4_Item_OrnnRanduinsSanctum": {
    "name": "Randuin's Omen",
    "apiName": "TFT4_Item_OrnnRanduinsSanctum",
    "description": "Combat start: Grant %i:scaleArmor% @BonusDefense@ Armor and %i:scaleMR% @BonusDefense@ Magic Resistance to the holder and adjacent allies.<br><br>​​<tftitemrules>[Support item]</tftitemrules>",
    "values": {
      "BonusDefense": 30.0,
      "Health": 150.0
    },
    "unique": false
  },
  "TFT_Item_Shroud": {
    "name": "Shroud of Stillness",
    "apiName": "TFT_Item_Shroud",
    "description": "Combat start: Shoot a beam that @CostIncrease@% <TFTKeyword>Mana Reaves</TFTKeyword> enemies.<br><br>Your team gains @BonusAllyHealth@ Health.<br><br><tftitemrules>[Support item] [Unique - only 1 per champion]<br><tftbold>Mana Reave</tftbold>: increase maximum Mana until the next cast</tftitemrules><br>@TFTUnitProperty.:TFT_BindOnEquipTRA@",
    "values": {
      "BonusAllyHealth": 60.0,
      "CostIncrease": 30.0,
      "Health": 150.0,
      "{4516a18d}": 60.0
    },
    "unique": true
  },
  "TFT_Item_Zephyr": {
    "name": "Zephyr",
    "apiName": "TFT_Item_Zephyr",
    "description": "Combat start: Summon a whirlwind on the opposite side of the arena that removes the closest enemy from combat for @BanishDuration@ seconds. <br><br>Your team gains @AllyBonusAS@% Attack Speed.<br><br><tftitemrules>[Support item]<br>[Ignores crowd control immunity.]<br>[Unique - only 1 per champion]</tftitemrules><br>@TFTUnitProperty.:TFT_BindOnEquipTRA@",
    "values": {
      "AllyBonusAS": 2.0,
      "BanishDuration": 5.0,
      "Health": 150.0
    },
    "unique": true
  },
  "TFT5_Item_ZzRotPortalRadiant": {
    "name": "Zz'Rot Portal",
    "apiName": "TFT5_Item_ZzRotPortalRadiant",
    "description": "Summon a large Voidspawn. Its strength increases with each Stage.<br><br>​​<tftitemrules>[Support item]<br>[Unique - only 1 per champion]</tftitemrules>",
    "values": {
      "Health": 150.0,
      "SummonedStatReduction": 25.0,
      "{50a0dbb5}": 1.0,
      "{ef0bb7c2}": 1.0
    },
    "unique": true
  },
  "TFT_Item_LocketOfTheIronSolari": {
    "name": "Locket of the Iron Solari",
    "apiName": "TFT_Item_LocketOfTheIronSolari",
    "description": "Combat start: The holder and allies within @HexRange@ hexes in the same row gain a @ShieldValue@ Shield, @BonusResists@ Armor, and @BonusResists@ Magic Resist for @ShieldDuration@ seconds.<br><br>​​<tftitemrules>[Support item]</tftitemrules>",
    "values": {
      "BonusResists": 20.0,
      "Health": 150.0,
      "HexRange": 2.0,
      "ShieldDuration": 20.0,
      "ShieldValue": 250.0
    },
    "unique": false
  },
  "TFT4_Item_OrnnObsidianCleaver": {
    "name": "Obsidian Cleaver",
    "apiName": "TFT4_Item_OrnnObsidianCleaver",
    "description": "Damage dealt @Shred@% <TFTKeyword>Shreds</TFTKeyword> and @Shred@% <TFTKeyword>Sunders</TFTKeyword> enemies for @Duration@ seconds.<br><br>Your team gains @TeamAD*100@% Attack Damage and @TeamAP@ Ability Power.<br><br><tftitemrules>​​[Support item] [Unique - only 1 per champion]<br><tftbold>Shred</tftbold>: Reduce Magic Resist<br><tftbold>Sunder</tftbold>: Reduce Armor</tftitemrules>",
    "values": {
      "Duration": 15.0,
      "Health": 150.0,
      "Shred": 30.0,
      "TeamAD": 0.07999999821186066,
      "TeamAP": 8.0
    },
    "unique": true
  },
  "TFT_Item_AegisOfTheLegion": {
    "name": "Aegis of the Legion",
    "apiName": "TFT_Item_AegisOfTheLegion",
    "description": "Combat start: Grant @ASBuff@% Attack Speed and @BonusResists@ Armor and Magic Resist to the holder, adjacent allies in the same row, and all allies behind them for @BuffDuration@ seconds.<br><br>​​<tftitemrules>[Support item]</tftitemrules>",
    "values": {
      "ASBuff": 25.0,
      "BonusResists": 15.0,
      "BuffDuration": 12.0,
      "Health": 150.0
    },
    "unique": false
  },
  "TFT_Item_RadiantVirtue": {
    "name": "Virtue of the Martyr",
    "apiName": "TFT_Item_RadiantVirtue",
    "description": "Every @HealTickRate@ seconds, heal your team for @MaxHealthHeal@% of their max Health. When the holder dies, the healing increases to @TOOLTIPEmpoweredHeal@% max Health for @NumBonusHeals@ extra heals.<br><br><TFTTrackerLabel>Healing:</TFTTrackerLabel> <TFTHighlight>@TFTUnitProperty.item:TFT_Tracker_Value1@</TFTHighlight><br><br>​​<tftitemrules>[Support item]</tftitemrules>",
    "values": {
      "HealTickRate": 5.0,
      "Health": 150.0,
      "MaxHeal": 1000.0,
      "MaxHealthHeal": 7.0,
      "NumBonusHeals": 2.0,
      "PostDeathDuration": 15.0,
      "TOOLTIPEmpoweredHeal": 14.0,
      "{484836f3}": 200.0
    },
    "unique": false
  },
  "TFT7_Item_ShimmerscaleHeartOfGold": {
    "name": "Needlessly Big Gem",
    "apiName": "TFT7_Item_ShimmerscaleHeartOfGold",
    "description": "Your team gains @BaseBonusDamage*100@% Damage Amp. Each second the holder is alive, your team gains an additional @AmpPerSec*100@% Damage Amp, up to a total of @MaxDamageAmp*100@%.<br><br>​​<tftitemrules>[Support item]</tftitemrules>",
    "values": {
      "AmpPerSec": 0.009999999776482582,
      "BaseBonusDamage": 0.05000000074505806,
      "Health": 150.0,
      "MaxDamageAmp": 0.20000000298023224,
      "ProcTimeInSeconds": 15.0
    },
    "unique": false
  },
  "TFT_Item_BansheesVeil": {
    "name": "Banshee's Veil",
    "apiName": "TFT_Item_BansheesVeil",
    "description": "Combat start: Grant the holder and allies within @HexRange@ hexes in the same row immunity to crowd control and @BuffAttackSpeed*100@% Attack Speed for @Duration@ seconds.<br><br><tftitemrules>[Support item] [Unique - only 1 per champion]</tftitemrules>",
    "values": {
      "BuffAttackSpeed": 0.25,
      "Duration": 18.0,
      "Health": 150.0,
      "HexRange": 1.0
    },
    "unique": true
  },
  "TFT_Item_EternalFlame": {
    "name": "The Eternal Flame",
    "apiName": "TFT_Item_EternalFlame",
    "description": "While the holder is alive, all enemies are @TOOLTIPWoundAmount@% <TFTKeyword>Wounded</TFTKeyword> and all allies gain @DamageAmp*100@% Damage Amp. This effect refreshes every @WoundDuration@ seconds.<br><br><tftitemrules>​​[Support item]<br><tftbold>Wound</tftbold>: Reduces healing received</tftitemrules>",
    "values": {
      "BonusDamage": 0.07999999821186066,
      "DamageAmp": 0.07999999821186066,
      "Health": 150.0,
      "TOOLTIPWoundAmount": 33.0,
      "WoundDuration": 5.0
    },
    "unique": false
  },
  "TFT_Item_SupportKnightsVow": {
    "name": "Knight's Vow",
    "apiName": "TFT_Item_SupportKnightsVow",
    "description": "Combat start: Grant @AllyHealth@ Health and @Omnivamp*100@% Omnivamp to the holder and allies within 1 hex in the same row.<br><br>​​<tftitemrules>[Support item]</tftitemrules>",
    "values": {
      "AllyHealth": 200.0,
      "Health": 50.0,
      "HexRange": 1.0,
      "Omnivamp": 0.15000000596046448,
      "Resists": null
    },
    "unique": false
  },
  "TFT_Item_Moonstone": {
    "name": "Moonstone Renewer",
    "apiName": "TFT_Item_Moonstone",
    "description": "Every @ShieldRate@ seconds, grant a @BaseShieldAmount@-@MaxShield@ Shield (based on Stage) to the @ShieldTargets@ lowest percent health allies for @ShieldDuration@ seconds.<br><br>​​<tftitemrules>[Support item]</tftitemrules>",
    "values": {
      "BaseShieldAmount": 55.0,
      "Health": 150.0,
      "MaxShield": 325.0,
      "ShieldDuration": 4.0,
      "ShieldRate": 4.0,
      "ShieldTargets": 2.0,
      "{f4f7ff53}": 45.0
    },
    "unique": false
  },
  "TFT_Item_Spite": {
    "name": "Spite",
    "apiName": "TFT_Item_Spite",
    "description": "Combat start: The holder and all adjacent allies gain @ADIncrease*100@% Attack Damage and @APIncrease@ Ability Power.<br><br>When the holder dies, Stun all enemies within 2-hexes for @Duration@ seconds.<br><br>​​<tftitemrules>[Support item]</tftitemrules>",
    "values": {
      "ADIncrease": 0.15000000596046448,
      "APIncrease": 20.0,
      "Duration": 2.0,
      "Health": 150.0
    },
    "unique": false
  },
  "TFT_Item_UnstableTreasureChest": {
    "name": "Unstable Treasure Chest",
    "apiName": "TFT_Item_UnstableTreasureChest",
    "description": "When the holder dies, the @ItemsGranted@ highest percent health allies gain a temporary completed item.<br><br>​​<tftitemrules>[Support item]</tftitemrules>",
    "values": {
      "Health": 150.0,
      "ItemsGranted": 4.0
    },
    "unique": false
  }
});
