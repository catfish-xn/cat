// G2-4b: ORNNARTIFACTS_SET6 source identities/values (en_us + zh_cn 14.24). Execution subset: g2-4-artifacts.ts.
import {freezeContent} from "./freeze";
export const G24_ARTIFACT_SOURCE=freezeContent({
  "TFT4_Item_OrnnAnimaVisage": {
    "name": "Anima Visage",
    "zhName": "生命盔甲",
    "apiName": "TFT4_Item_OrnnAnimaVisage",
    "description": "Heal @PercentHealthRegen@% max Health every second.",
    "values": {
      "Armor": 20.0,
      "Health": 400.0,
      "MagicResist": 20.0,
      "PercentHealthRegen": 3.5
    },
    "unique": false
  },
  "TFT4_Item_OrnnDeathsDefiance": {
    "name": "Death's Defiance",
    "zhName": "死亡之蔑",
    "apiName": "TFT4_Item_OrnnDeathsDefiance",
    "description": "@IgnorePainPercent@% of the damage the holder receives is instead dealt over @BleedDuration@ seconds as non-lethal damage.<br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules>",
    "values": {
      "AD": 0.10000000149011612,
      "AS": 25.0,
      "Armor": 30.0,
      "BaseHeal": 25.0,
      "BleedDuration": 4.0,
      "IgnorePainPercent": 50.0,
      "StatOmnivamp": 0.25
    },
    "unique": true
  },
  "TFT4_Item_OrnnInfinityForce": {
    "name": "Infinity Force",
    "zhName": "三相之力",
    "apiName": "TFT4_Item_OrnnInfinityForce",
    "description": "<tftitemrules>Tons of EVERYTHING!</tftitemrules>",
    "values": {
      "AD": 0.25,
      "AP": 25.0,
      "AS": 25.0,
      "Armor": 25.0,
      "Health": 250.0,
      "MagicResist": 25.0,
      "Mana": 25.0
    },
    "unique": false
  },
  "TFT4_Item_OrnnMuramana": {
    "name": "Manazane",
    "zhName": "魔蕴",
    "apiName": "TFT4_Item_OrnnMuramana",
    "description": "After casting the first time in combat, gain @ManaRestore@ Mana over @ManaDuration@ seconds.<br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules>",
    "values": {
      "AD": 0.15000000596046448,
      "AP": 10.0,
      "AS": 15.0,
      "Mana": 15.0,
      "ManaDuration": 5.0,
      "ManaRestore": 120.0
    },
    "unique": true
  },
  "TFT4_Item_OrnnTheCollector": {
    "name": "Gold Collector",
    "zhName": "金币收集者",
    "apiName": "TFT4_Item_OrnnTheCollector",
    "description": "Attacks and Abilities execute enemies below @ExecutePercent@% of their maximum Health. Executions have a @GoldChance@% chance to drop %i:goldCoins% 1 gold.<br><br><TFTTrackerLabel>Gold Collected:</TFTTrackerLabel> <TFTHighlight>@TFTUnitProperty.item:TFT_Tracker_Value1@g</TFTHighlight><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules>",
    "values": {
      "AD": 0.30000001192092896,
      "CritChance": 30.0,
      "ExecutePercent": 12.0,
      "GoldChance": 40.0
    },
    "unique": true
  },
  "TFT4_Item_OrnnZhonyasParadox": {
    "name": "Zhonya's Paradox",
    "zhName": "中娅悖论",
    "apiName": "TFT4_Item_OrnnZhonyasParadox",
    "description": "Once per combat at @PercentHealthThreshold@% Health, become invulnerable and untargetable for @InvulnDuration@ seconds.<br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules>",
    "values": {
      "AP": 40.0,
      "Armor": 30.0,
      "InvulnDuration": 3.0,
      "MagicResist": 30.0,
      "PercentHealthThreshold": 40.0
    },
    "unique": true
  },
  "TFT9_Item_OrnnHullbreaker": {
    "name": "Hullcrusher",
    "zhName": "碎舰者",
    "apiName": "TFT9_Item_OrnnHullbreaker",
    "description": "Combat Start: If there are no adjacent allies, gain @ExtraHealth@ Health, @ExtraADandAP@% Attack Damage, and @ExtraADandAP@ Ability Power.",
    "values": {
      "Armor": 35.0,
      "ExtraADandAP": 20.0,
      "ExtraHealth": 600.0,
      "MagicResist": 35.0
    },
    "unique": false
  },
  "TFT9_Item_OrnnDeathfireGrasp": {
    "name": "Deathfire Grasp",
    "zhName": "冥火之拥",
    "apiName": "TFT9_Item_OrnnDeathfireGrasp",
    "description": "Combat start: Blast the current target for @PercentMaxHealthDamage@% of their max Health as magic damage. Repeat this every @RepeatTime@ seconds.",
    "values": {
      "AP": 30.0,
      "Mana": 15.0,
      "PercentMaxHealthDamage": 40.0,
      "RepeatTime": 13.0,
      "{1543aa48}": 0.25
    },
    "unique": false
  },
  "TFT9_Item_OrnnHorizonFocus": {
    "name": "Sniper's Focus",
    "zhName": "狙击手的专注",
    "apiName": "TFT9_Item_OrnnHorizonFocus",
    "description": "Gain %i:scaleRange% @HexRangeIncrease@ Attack Range. Gain @DamageAmpPerHex*100@% Damage Amp against a target for each hex between the holder and the target.",
    "values": {
      "AD": 0.15000000596046448,
      "AP": 15.0,
      "AS": 15.0,
      "DamageAmpPerHex": 0.09000000357627869,
      "HexRangeIncrease": 2.0,
      "PercentDamageIncrease": 9.0
    },
    "unique": false
  },
  "TFT9_Item_OrnnTrickstersGlass": {
    "name": "Trickster's Glass",
    "zhName": "诡术师之镜",
    "apiName": "TFT9_Item_OrnnTrickstersGlass",
    "description": "Summon a clone with @HealthPercent@% max Health and +@ManaIncrease*100@% max Mana. You cannot equip items to the clone.<br><br><tftitemrules>The clone benefits from active traits</tftitemrules><br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules><br>",
    "values": {
      "AS": 10.0,
      "Armor": 10.0,
      "CritChance": 15.0,
      "HealthPercent": 70.0,
      "MagicResist": 10.0,
      "ManaIncrease": 0.10000000149011612
    },
    "unique": true
  },
  "TFT7_Item_ShimmerscaleGamblersBlade": {
    "name": "Gambler's Blade",
    "zhName": "投机者之刃",
    "apiName": "TFT7_Item_ShimmerscaleGamblersBlade",
    "description": "Grant %i:scaleAS% @AttackSpeedPerGold*100@% bonus Attack Speed per %i:goldCoins% gold in your bank (up to %i:goldCoins% @AttackSpeedGoldLimit@ gold).<br><br>Each attack has a @ChanceToProc*100@% chance to drop %i:goldCoins% @GoldPerProc@ gold.<br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules><br><tftitemrules>Gold generated this game: @TFTUnitProperty.item:TFT_Item_GoldGenerated@</tftitemrules>",
    "values": {
      "AP": 10.0,
      "AS": 45.0,
      "AttackSpeedGoldLimit": 30.0,
      "AttackSpeedPerGold": 0.009999999776482582,
      "ChanceToProc": 0.05000000074505806,
      "GoldPerProc": 1.0,
      "{46736b3f}": 4.0,
      "{b38e1643}": 20.0
    },
    "unique": true
  },
  "TFT7_Item_ShimmerscaleMogulsMail": {
    "name": "Mogul's Mail",
    "zhName": "大亨之铠",
    "apiName": "TFT7_Item_ShimmerscaleMogulsMail",
    "description": "Grants @BaseResistsPerStack@ Armor, @BaseResistsPerStack@ Magic Resist, and @BaseHealthPerStack@ Health when taking damage, stacking up to @StackCap@ times.<br><br>At full stacks, grant %i:goldCoins% @GoldAtFullStacks@ gold and continue gaining %i:goldCoins% 1 gold every @GoldInterval@ seconds.<br><br><tftitemrules>Gold generated this game: @TFTUnitProperty.item:TFT_Item_GoldGenerated@<br>[Unique - only 1 per champion]</tftitemrules>",
    "values": {
      "BaseHealthPerStack": 7.0,
      "BaseResistsPerStack": 1.0,
      "GoldAtFullStacks": 1.0,
      "GoldInterval": 8.0,
      "Health": 50.0,
      "StackCap": 35.0
    },
    "unique": true
  },
  "TFT_Item_Artifact_TalismanOfAscension": {
    "name": "Talisman Of Ascension",
    "zhName": "飞升护符",
    "apiName": "TFT_Item_Artifact_TalismanOfAscension",
    "description": "After @Seconds@ seconds gain @MaxHealthPercent@% max Health and @DamageAmp*100@% Damage Amp for the rest of combat.",
    "values": {
      "AD": 0.20000000298023224,
      "AP": 20.0,
      "DamageAmp": 1.2000000476837158,
      "DamageIncreasePercent": 120.0,
      "Health": 300.0,
      "MaxHealthPercent": 100.0,
      "Seconds": 22.0
    },
    "unique": false
  },
  "TFT_Item_Artifact_Fishbones": {
    "name": "Fishbones",
    "zhName": "鱼骨头",
    "apiName": "TFT_Item_Artifact_Fishbones",
    "description": "Doubles the holder's attack range, and causes each of their attacks to target a random enemy.",
    "values": {
      "AD": 0.4000000059604645,
      "AS": 40.0
    },
    "unique": false
  },
  "TFT_Item_Artifact_SuspiciousTrenchCoat": {
    "name": "Suspicious Trench Coat",
    "zhName": "迷离风衣",
    "apiName": "TFT_Item_Artifact_SuspiciousTrenchCoat",
    "description": "Once per combat at @PercentHealthTrigger@% Health, the holder splits into 3 copies of themself each with @PercentHealthOfCopies@% of their max Health.<br><br><tftitemrules>[Unique - only 1 per champion]</tftitemrules>",
    "values": {
      "AS": 15.0,
      "Health": 100.0,
      "PercentHealthOfCopies": 30.0,
      "PercentHealthTrigger": 50.0
    },
    "unique": true
  },
  "TFT_Item_Artifact_HorizonFocus": {
    "name": "Horizon Focus",
    "zhName": "视界专注",
    "apiName": "TFT_Item_Artifact_HorizonFocus",
    "description": "Stunning an enemy causes lightning to strike them, dealing @PercentHealthDamage@% of their max Health as magic damage.<br>",
    "values": {
      "Armor": 20.0,
      "Health": 250.0,
      "MagicResist": 20.0,
      "Mana": 15.0,
      "PercentHealthDamage": 30.0
    },
    "unique": false
  },
  "TFT_Item_Artifact_Mittens": {
    "name": "Mittens",
    "zhName": "连指手套",
    "apiName": "TFT_Item_Artifact_Mittens",
    "description": "Shrinks the holder, granting them increased movement speed and immunity to <TFTKeyword>Chill</TFTKeyword>.<br><br><tftitemrules><tftbold>Chill</tftbold>: reduce Attack Speed</tftitemrules>",
    "values": {
      "AS": 60.0,
      "PercentDR": 25.0,
      "{cd951938}": 0.25
    },
    "unique": false
  },
  "TFT_Item_Artifact_UnendingDespair": {
    "name": "Unending Despair",
    "zhName": "无终恨意",
    "apiName": "TFT_Item_Artifact_UnendingDespair",
    "description": "Whenever a Shield on the holder breaks, @PercentDamage@% of that Shield's initial value is dealt to the nearest enemy as magic damage.",
    "values": {
      "Armor": 40.0,
      "Health": 350.0,
      "PercentDamage": 150.0
    },
    "unique": false
  },
  "TFT_Item_Artifact_RapidFirecannon": {
    "name": "Rapid Firecannon",
    "zhName": "疾射火炮",
    "apiName": "TFT_Item_Artifact_RapidFirecannon",
    "description": "Gain +1 Attack Range, increased by 1 whenever the holder kills an enemy.",
    "values": {
      "AS": 75.0
    },
    "unique": false
  },
  "TFT_Item_Artifact_InnervatingLocket": {
    "name": "Innervating Locket",
    "zhName": "激发之匣",
    "apiName": "TFT_Item_Artifact_InnervatingLocket",
    "description": "The holder gains @PercentMana@% of their total Mana whenever they're hit by an attack.<br><br>Each cast restores @PercentHealth@% of the holder's max Health over @Duration@ seconds.",
    "values": {
      "Duration": 3.0,
      "Health": 150.0,
      "Mana": 15.0,
      "PercentHealth": 20.0,
      "PercentMana": 2.0
    },
    "unique": false
  },
  "TFT_Item_Artifact_LudensTempest": {
    "name": "Luden's Tempest",
    "zhName": "卢登的激荡",
    "apiName": "TFT_Item_Artifact_LudensTempest",
    "description": "@PercentOfOverkill@% of overkill damage plus @BaseDamage@ is dealt as magic damage to the three enemies nearest the target.",
    "values": {
      "AD": 0.44999998807907104,
      "AP": 45.0,
      "BaseDamage": 100.0,
      "PercentOfOverkill": 100.0
    },
    "unique": false
  },
  "TFT_Item_Artifact_SilvermereDawn": {
    "name": "Silvermere Dawn",
    "zhName": "密银黎明",
    "apiName": "TFT_Item_Artifact_SilvermereDawn",
    "description": "Grants immunity to Stuns and the holder's attacks Stun the target for @StunDuration@ seconds.<br><br><TFTShadowItemBonus>The holder's Attack Speed is locked at @AttackSpeedCap@.</TFTShadowItemBonus>",
    "values": {
      "AD": 1.2000000476837158,
      "Armor": 60.0,
      "AttackSpeedCap": 0.5,
      "MagicResist": 60.0,
      "StunDuration": 0.800000011920929
    },
    "unique": false
  },
  "TFT_Item_Artifact_ProwlersClaw": {
    "name": "Prowler's Claw",
    "zhName": "暗行者之爪",
    "apiName": "TFT_Item_Artifact_ProwlersClaw",
    "description": "After killing a target, shed negative effects and dash to the farthest target within @HexRange@ hexes. The next 2 critical attacks deal @CritDamageBonusPercent@% bonus Critical Strike Damage.",
    "values": {
      "AD": 0.4000000059604645,
      "CritChance": 50.0,
      "CritDamageBonusPercent": 60.0,
      "Health": 200.0,
      "HexRange": 4.0
    },
    "unique": false
  },
  "TFT_Item_Artifact_SpectralCutlass": {
    "name": "Spectral Cutlass",
    "zhName": "幽魂弯刀",
    "apiName": "TFT_Item_Artifact_SpectralCutlass",
    "description": "Combat start: Teleport the holder to the mirrored hex on the enemy's side of the board. After @Duration@ seconds, the holder returns to their original location.",
    "values": {
      "AD": 0.4000000059604645,
      "Armor": 40.0,
      "CritChance": 20.0,
      "Duration": 8.0,
      "MagicResist": 40.0
    },
    "unique": false
  },
  "TFT_Item_Artifact_BlightingJewel": {
    "name": "Blighting Jewel",
    "zhName": "枯萎珠宝",
    "apiName": "TFT_Item_Artifact_BlightingJewel",
    "description": "Dealing magic damage reduces the target's Magic Resist by @MRReduction@. If their Magic Resist is 0, grant the holder @ManaGain@ Mana instead.",
    "values": {
      "AP": 40.0,
      "MRReduction": 4.0,
      "Mana": 15.0,
      "ManaGain": 5.0
    },
    "unique": false
  },
  "TFT_Item_Artifact_WitsEnd": {
    "name": "Wit's End",
    "zhName": "智慧末刃",
    "apiName": "TFT_Item_Artifact_WitsEnd",
    "description": "Attacks deal @TFTUnitProperty.item:TFT_Item_Artifact_WitsEnd_Damage@ bonus magic damage.<br><br>Heals the holder for @PercentHealing@% of all magic damage dealt.<br><br><tftitemrules>Damage increases based on Stage.</tftitemrules>",
    "values": {
      "AS": 30.0,
      "MagicResist": 30.0,
      "PercentHealing": 35.0,
      "{54f90860}": 90.0,
      "{55f909f3}": 75.0,
      "{56f90b86}": 100.0,
      "{57f90d19}": 100.0,
      "{58f90eac}": 42.0,
      "{5af911d2}": 60.0,
      "{5bf91365}": 42.0,
      "{61f91cd7}": 100.0
    },
    "unique": false
  },
  "TFT_Item_Artifact_LichBane": {
    "name": "Lich Bane",
    "zhName": "巫妖之祸",
    "apiName": "TFT_Item_Artifact_LichBane",
    "description": "The holder's first attack after each Ability cast deals @TFTUnitProperty.item:TFT_Item_Artifact_LichBane_Damage@ bonus magic damage.<br><br><tftitemrules>Damage increases based on Stage.</tftitemrules>",
    "values": {
      "AP": 30.0,
      "AS": 30.0,
      "{9b6d43b2}": 480.0,
      "{9d6d46d8}": 480.0,
      "{9e6d486b}": 480.0,
      "{9f6d49fe}": 340.0,
      "{a06d4b91}": 410.0,
      "{a16d4d24}": 200.0,
      "{a26d4eb7}": 270.0,
      "{a46d51dd}": 200.0
    },
    "unique": false
  },
  "TFT_Item_Artifact_LightshieldCrest": {
    "name": "Lightshield Crest",
    "zhName": "光盾徽章",
    "apiName": "TFT_Item_Artifact_LightshieldCrest",
    "description": "Every @TriggerRate@ seconds, Shields the lowest percent Health ally for @PercentOfResists@% of the holder's combined Armor and Magic Resist for @ShieldDuration@ seconds.<br><br>On death grants this shield to all allies.",
    "values": {
      "Armor": 55.0,
      "MagicResist": 55.0,
      "PercentOfResists": 70.0,
      "ShieldDuration": 5.0,
      "TriggerRate": 3.0
    },
    "unique": false
  },
  "TFT_Item_Artifact_SeekersArmguard": {
    "name": "Seeker's Armguard",
    "zhName": "探索者的护臂",
    "apiName": "TFT_Item_Artifact_SeekersArmguard",
    "description": "Takedowns increase the holder's Armor, Magic Resist, and Ability Power by @StatsPerTakedown@, increased to @StatsPerKill@ if they score the kill.",
    "values": {
      "AP": 30.0,
      "Armor": 30.0,
      "MagicResist": 30.0,
      "StatsPerKill": 20.0,
      "StatsPerTakedown": 15.0
    },
    "unique": false
  }
});
