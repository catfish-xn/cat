// Frozen raw 14.24b values; labels from archived 14.24 zh_cn stringtable.
import { freezeContent } from './freeze';
export const S13_P3_SOURCE = freezeContent({
  "defense-call": {
    "apiName": "TFT_Augment_DefenseCall",
    "name": "硬化护盾",
    "description": "While Shielded, your units gain @ReducedDamage*100@% Durability. The first time allies fall below @HealthThreshold*100@% Health, they gain @ShieldAmount1@-@ShieldAmount4@ Shield (based on Stage) for @ShieldDuration@ seconds.<br>",
    "values": {
      "HealthThreshold": 0.5,
      "ReducedDamage": 0.1,
      "ShieldAmount1": 100,
      "ShieldAmount2": 150,
      "ShieldAmount3": 200,
      "ShieldAmount4": 225,
      "ShieldDuration": 3
    },
    "kind": "augment"
  },
  "high-voltage": {
    "apiName": "TFT_Augment_HighVoltage",
    "name": "高压电",
    "description": "Gain an Ionic Spark. Your Ionic Sparks have +@hexincreasetooltip@ hex radius and do @effectincrease*100@% more damage.",
    "values": {
      "effectincrease": 0.25,
      "hexincreasetooltip": 3,
      "{f5a91c3a}": 680
    },
    "kind": "augment"
  },
  "piercing-lotus-i": {
    "apiName": "TFT_Augment_PiercingLotus1",
    "name": "透体莲花 I",
    "description": "Your team gains @critchance@% Critical Strike chance, and their Abilities can critically strike. Critical strikes @ShredSunderPerc*100@% Shred and Sunder the target for @Duration@ seconds.",
    "values": {
      "CritChance": 5,
      "Duration": 3,
      "ShredSunderPerc": 0.2
    },
    "kind": "augment"
  },
  "piercing-lotus-ii": {
    "apiName": "TFT_Augment_PiercingLotus2",
    "name": "透体莲花 II",
    "description": "Your team gains @critchance@% Critical Strike chance, and their Abilities can critically strike. Critical strikes @ShredSunderPerc*100@% Shred and Sunder the target for @Duration@ seconds.",
    "values": {
      "CritChance": 20,
      "Duration": 3,
      "ShredSunderPerc": 0.2
    },
    "kind": "augment"
  },
  "pyromaniac": {
    "apiName": "TFT_Augment_Pyromaniac",
    "name": "嗜火",
    "description": "Gain a Red Buff. Your Burns deal @BurnIncrease*100@% increased damage.",
    "values": {
      "BurnIncrease": 0.5
    },
    "kind": "augment"
  },
  "thorn-plated-armor": {
    "apiName": "TFT_Augment_ThornPlatedArmor",
    "name": "棘刺镀板铠甲",
    "description": "Gain a Bramble Vest. Your Bramble Vests deal @damageamp1*100@-@damageamp4*100@% more damage (based on Stage) and heal the holder for @heal*100@% of the damage dealt.",
    "values": {
      "DamageAmp1": 0.05,
      "DamageAmp2": 0.3,
      "DamageAmp3": 0.7,
      "DamageAmp4": 1,
      "Heal": 0.5
    },
    "kind": "augment"
  },
  "unleash-the-beast": {
    "apiName": "TFT_Augment_UnleashTheBeast",
    "name": "释放野兽",
    "description": "Gain a Sterak's Gage. When its effect triggers, the holder gains @AttackSpeed*100@% Attack Speed for the rest of combat and immunity to crowd control for @CCImmunityDuration@ seconds.",
    "values": {
      "AttackSpeed": 0.35,
      "CCImmunityDuration": 10
    },
    "kind": "augment"
  },
  "the-finisher": {
    "apiName": "TFT13_GoopBuff_TheFinisher",
    "pointer": "{1f13bce0}",
    "name": "终结者",
    "description": "该弈子的普攻和技能会处决生命值为@ExecutePercent*100@%及以下的敌方英雄。",
    "values": {
      "ExecutePercent": 0.15
    },
    "kind": "anomaly"
  },
  "touch-of-frost": {
    "apiName": "TFT13_GoopBuff_TouchofFrost",
    "pointer": "{c1efe0a9}",
    "name": "冰霜触摸",
    "description": "技能对敌人造成20%<TFTKeyword>冰冷</TFTKeyword>效果(降低攻击速度)，持续@Duration@秒。受到<TFTKeyword>冰冷</TFTKeyword>效果的敌人阵亡时，会对距离最近的敌人造成@StunDuration@秒晕眩。",
    "values": {
      "Duration": 4,
      "{01335064}": 1,
      "StunDuration": 1
    },
    "kind": "anomaly"
  },
  "fireball": {
    "apiName": "TFT13_GoopBuff_Fireball",
    "pointer": "{352ff668}",
    "name": "火球",
    "description": "每花费@ManaSpent@法力值，就会投掷一个半径@HexRadius@格的火球，在@Duration@秒里造成@HPRatio*100@%最大生命值的真实伤害和<TFTKeyword>灼烧</TFTKeyword>效果。",
    "values": {
      "HPRatio": 0.06,
      "Duration": 5,
      "HexRadius": 2,
      "ManaSpent": 70
    },
    "kind": "anomaly"
  },
  "dragonsoul": {
    "apiName": "TFT13_GoopBuff_Dragonsoul",
    "pointer": "{6b15e26c}",
    "name": "龙魂",
    "description": "这个弈子对一个新目标打出的第一次攻击会发射一团龙魂震波，造成@PercentHPDamage*100@%最大生命值的真实伤害。",
    "values": {
      "PercentHPDamage": 0.2
    },
    "kind": "anomaly"
  },
  "nothing-wasted": {
    "apiName": "TFT13_GoopBuff_NothingWasted",
    "pointer": "{eb635e48}",
    "name": "绝不浪费",
    "description": "当一名友方弈子阵亡时，获得其@ManaPercent*100@%当前法力值。",
    "values": {
      "ManaPercent": 0.7
    },
    "kind": "anomaly"
  },
  "thornskin": {
    "apiName": "TFT13_GoopBuff_Thornskin",
    "pointer": "{c55c279f}",
    "name": "荆棘满途",
    "description": "获得@BonusArmor@护甲与@BonusMR@魔抗。在受到伤害时，对邻格敌人造成相当于@DamagePercent*100@%已格挡伤害的魔法伤害。 ",
    "values": {
      "BonusArmor": 60,
      "BonusMR": 60,
      "DamagePercent": 0.2,
      "{6c6773d4}": 75
    },
    "kind": "anomaly"
  },
  "knockout": {
    "apiName": "TFT13_GoopBuff_Knockout",
    "pointer": "{062de479}",
    "name": "地下拳王",
    "description": "获得@BonusAD*100@%攻击力。施放技能后的下一次攻击获得@BonusCrit*100@%暴击几率，并造成@TrueDamagePercent*100@%真实伤害。",
    "values": {
      "BonusAD": 0.15,
      "BonusCrit": 0.35,
      "TrueDamagePercent": 0.9
    },
    "kind": "anomaly"
  }
} as const);
