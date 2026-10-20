/** Extracted from the retained 14.24b map22 and 14.24 zh_cn string table. Floats normalized to six decimals before integer Bps conversion. */
import { freezeContent } from './freeze';
export const S13_P2_SOURCE = freezeContent({
  "crown-guarded": {
    "apiName": "TFT10_Augment_CrownGuarded",
    "rawKey": "{0a9a1139}",
    "name": "冕已有卫",
    "description": "获得1个【冕卫】。你的【冕卫】的初始效果增强@effectincrease*100@%并且该护盾值持续时间延长@DurationIncrease@秒。",
    "values": {
      "effectincrease": 1.0,
      "DurationIncrease": 5
    },
    "tier": "gold"
  },
  "not-today": {
    "apiName": "TFT9_Augment_NotToday",
    "rawKey": "{44468250}",
    "name": "不是今天",
    "description": "获得1件【夜之锋刃】。携带了此装备的弈子们获得@AS@%攻击速度。",
    "values": {
      "AS": 35.0
    },
    "tier": "gold"
  },
  "all-for-one-ii": {
    "apiName": "TFT_Augment_AllForOneII",
    "rawKey": "{95b6fcf9}",
    "name": "一费奉献 II",
    "description": "你的场上每有一个独特的1费弈子，己方弈子们就会获得@PercHP*100@%最大生命值和@DamageAmp*100@%伤害增幅。获得@NumChampsToGrant@个1费。",
    "values": {
      "Tier": 1.0,
      "NumCopies": 0,
      "{96f9e378}": 0,
      "Durability": 0,
      "DamageAmp": 0.025,
      "NumChampsToGrant": 3.0,
      "{d5279bbe}": 1.0,
      "PercHP": 0.03,
      "{ea12e1ed}": 0
    },
    "tier": "gold"
  },
  "belt-overflow": {
    "apiName": "TFT_Augment_BeltOverflow",
    "rawKey": "{88b512c0}",
    "name": "腰带溢流",
    "description": "获得@NumItems@个【巨人腰带】。你的【巨人腰带】提供+@BonusHealth@额外生命值。",
    "values": {
      "NumItems": 4.0,
      "BonusHealth": 75.0
    },
    "tier": "prismatic"
  },
  "calculated-enhancement": {
    "apiName": "TFT_Augment_CalculatedEnhancement",
    "rawKey": "{830ce47f}",
    "name": "精心赋能",
    "description": "每个战斗环节，你最后两排的@NumUnits@个随机弈子将获得@BonusAD*100@%攻击力和@BonusAP@法术强度。",
    "values": {
      "BonusAD": 0.35,
      "BonusAP": 40.0,
      "NumUnits": 4.0
    },
    "tier": "prismatic"
  },
  "crownguard-spirit": {
    "apiName": "TFT_Augment_CrownguardSpirit",
    "rawKey": "{1d08b362}",
    "name": "王冠意志",
    "description": "获得1个【无用大棒】。你的弈子们获得@AP@法术强度和@Armor@护甲。 ",
    "values": {
      "AP": 10.0,
      "Armor": 10.0
    },
    "tier": "gold"
  },
  "flurry-of-blows": {
    "apiName": "TFT_Augment_FlurryOfBlows",
    "rawKey": "{1eac564f}",
    "name": "连串打击",
    "description": "获得1个【基克的先驱】。被这件装备强化过的弈子们还会获得@CSBonus*100@%暴击几率。",
    "values": {
      "CSBonus": 0.35
    },
    "tier": "prismatic"
  },
  "guardbreaker-spirit": {
    "apiName": "TFT_Augment_GuardbreakerSpirit",
    "rawKey": "{ec448afd}",
    "name": "权杖意志",
    "description": "获得1个【拳套】。己方弈子获得@AS*100@%攻击速度和@CritChance*100@%暴击几率。",
    "values": {
      "AS": 0.08,
      "CritChance": 0.2
    },
    "tier": "gold"
  },
  "pair-of-fours": {
    "apiName": "TFT_Augment_PairOfFours",
    "rawKey": "{f4760f57}",
    "name": "一对4",
    "description": "如果己方正好有@NumCopies@个4费弈子，那么这些弈子将各获得@Health@生命值和@AttackSpeed*100@%攻击速度。获得1个随机4费弈子。",
    "values": {
      "Tier": 4.0,
      "NumCopies": 2.0,
      "Health": 404.0,
      "AttackSpeed": 0.244,
      "{96f9e378}": 1.0,
      "NumChampsToGrant": 1,
      "{d5279bbe}": 4,
      "{ea12e1ed}": 1
    },
    "tier": "gold"
  },
  "immovable-object": {
    "apiName": "TFT_Augment_RanduinsImmovableObject",
    "rawKey": "{883e5ac0}",
    "name": "不可撼动之物",
    "description": "获得1个【兰顿之兆】。它的距离提升1格并且它的效果提升@effectincrease*100@%。",
    "values": {
      "effectincrease": 0.6,
      "{9f11e38f}": 2.0
    },
    "tier": "prismatic"
  },
  "shojin-spirit": {
    "apiName": "TFT_Augment_ShojinSpirit",
    "rawKey": "{c3bfdbb7}",
    "name": "长矛意志",
    "description": "己方弈子们获得@AD*100@%攻击力和@Mana@法力值。获得1个【暴风大剑】。",
    "values": {
      "AD": 0.1,
      "Mana": 10.0
    },
    "tier": "gold"
  },
  "sword-overflow": {
    "apiName": "TFT_Augment_SwordOverflow",
    "rawKey": "{ab673286}",
    "name": "大剑溢流",
    "description": "获得@NumItems@个【暴风大剑】。你的【暴风大剑】提供+@BonusStat*100@%攻击速度。",
    "values": {
      "NumItems": 5.0,
      "BonusStat": 0.025
    },
    "tier": "prismatic"
  },
  "trifecta-ii": {
    "apiName": "TFT_Augment_Trifecta2",
    "rawKey": "{200f217d}",
    "name": "三项赛 II",
    "description": "获得@numunits@个@Tier@费英雄。友军获得@TeamAttackSpeed*100@%攻击速度。战斗开始时：@BuffedNumber@个随机@Tier@费英雄获得@Health@生命值和@AttackSpeed*100@%攻击速度。",
    "values": {
      "Tier": 3.0,
      "NumUnits": 3.0,
      "Health": 330.0,
      "AttackSpeed": 0.24,
      "BuffedNumber": 3.0,
      "TeamAttackSpeed": 0.09
    },
    "tier": "prismatic"
  },
  "wand-overflow": {
    "apiName": "TFT_Augment_WandOverflow",
    "rawKey": "{9474fb13}",
    "name": "法杖溢流",
    "description": "获得@NumItems@个【无用大棒】。你的【无用大棒】提供+@BonusStat*100@%攻击速度。",
    "values": {
      "NumItems": 5.0,
      "BonusStat": 0.025
    },
    "tier": "prismatic"
  },
  "share-your-energy": {
    "apiName": "TFT13_GoopBuff_ShareYourEnergy",
    "rawKey": "{2f74da7e}",
    "name": "分享你的能量",
    "description": "战斗开始时：为邻格弈子们提供这个弈子的@PercentStatsToShare*100@%攻击力、法术强度、生命值、护甲与魔抗。",
    "values": {
      "PercentStatsToShare": 0.15
    }
  },
  "cull-the-weak": {
    "apiName": "TFT13_GoopBuff_CullTheWeak",
    "rawKey": "{5e87c3ec}",
    "name": "剔除弱者",
    "description": "基于目标的已损失生命值，获得至多@CritPercent*100@%暴击几率。每@Period@秒，将距离内百分比生命值最低的那个敌人选为目标。",
    "values": {
      "Period": 3.0,
      "CritPercent": 1.0
    }
  },
  "stoneskin": {
    "apiName": "TFT13_GoopBuff_Stoneskin",
    "rawKey": "{1c016217}",
    "name": "石头皮肤",
    "description": "战斗开始时：获得@BonusArmorMR@护甲与魔抗。每秒，使这个加成降低@ArmorMRLossPerSecond@。",
    "values": {
      "BonusArmorMR": 225.0,
      "ArmorMRLossPerSecond": 10.0
    }
  }
} as const);
