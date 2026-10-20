// Unwired D11 pack: archive identities and coefficients, never imported by production catalogs.
import { freezeContent } from './freeze';
export const D11_FILL_SOURCE = freezeContent({
  "all-for-one-i": {
    "kind": "augment",
    "apiName": "TFT_Augment_AllForOneI",
    "pointer": "{f5b94eaa}",
    "name": "一费奉献 I",
    "nameKey": "tft_augment_allforonei_name",
    "description": "你的场上每有一个独特的1费弈子，己方弈子们就会获得@PercHP*100@%最大生命值和@DamageAmp*100@%伤害增幅。获得@NumChampsToGrant@个1费。",
    "descriptionKey": "tft_augments_allforone_desc",
    "tier": "silver",
    "values": {
      "DamageAmp": 0.015,
      "NumChampsToGrant": 2.0,
      "PercHP": 0.02,
      "Tier": 1.0,
      "{d5279bbe}": 1.0
    },
    "standardPool": {
      "mutator": "TFTSet13_Evolved",
      "field": "augments",
      "alsoInBaseSet13": true
    }
  },
  "trifecta-i": {
    "kind": "augment",
    "apiName": "TFT_Augment_Trifecta1",
    "pointer": "{1d0f1cc4}",
    "name": "三项赛 I",
    "nameKey": "tft_augment_trifecta1_name",
    "description": "获得@numunits@个@Tier@费英雄。战斗开始时：@BuffedNumber@个随机@Tier@费英雄获得@Health@生命值和@AttackSpeed*100@%攻击速度。",
    "descriptionKey": "tft_augment_trifecta1_dsc",
    "tier": "gold",
    "values": {
      "AttackSpeed": 0.18,
      "BuffedNumber": 3.0,
      "Health": 250.0,
      "NumUnits": 2.0,
      "Tier": 3.0
    },
    "standardPool": {
      "mutator": "TFTSet13_Evolved",
      "field": "augments",
      "alsoInBaseSet13": true
    }
  },
  "spirit-link": {
    "kind": "augment",
    "apiName": "TFT_Augment_SpiritLink1",
    "pointer": "{4cb3bb7d}",
    "name": "灵魂连接",
    "nameKey": "tft_augment_spiritlink1_name",
    "description": "己方弈子们每@RegenPeriod@秒治疗自身@BaseRegenBonus*100@%最大生命值。每损失10玩家生命值，这个治疗效果就会提升@RegenPerMissingHP@%。",
    "descriptionKey": "tft_augment_spiritlink_dsc",
    "tier": "gold",
    "values": {
      "BaseRegenBonus": 0.05,
      "RegenPerMissingHP": 0.5,
      "RegenPeriod": 5.0
    },
    "standardPool": {
      "mutator": "TFTSet13_Evolved",
      "field": "augments",
      "alsoInBaseSet13": true
    }
  },
  "avarice-incarnate": {
    "kind": "anomaly",
    "apiName": "TFT13_GoopBuff_AvariceIncarnate",
    "pointer": "{af3697d1}",
    "name": "贪财化身",
    "nameKey": "tft13_goopbuff_avariceincarnate_title",
    "description": "获得@GoldCount@金币。获得@FlatPercentDamage@%伤害增幅，并且你每拥有@GoldIncrement@金币就会获得@PercentDamage*100@%额外伤害增幅(至多至@GoldCap@)。",
    "descriptionKey": "tft13_goopbuff_avariceincarnate_description",
    "values": {
      "PercentDamage": 0.01,
      "GoldIncrement": 2.0,
      "GoldCap": 40.0,
      "GoldCount": 5.0,
      "FlatPercentDamage": 15.0
    },
    "standardPool": {
      "setPointer": "Maps/Shipping/Map22/Sets/TFTSet13_Evolved",
      "poolField": "{e6c62bd9}",
      "poolPointer": "{cc0b6cb2}",
      "entriesField": "{9a7587b2}",
      "entryPointerField": "{16c534fd}",
      "weightField": "{bc58e0e5}",
      "explicitWeight": null
    }
  },
  "headhunter": {
    "kind": "anomaly",
    "apiName": "TFT13_GoopBuff_Headhunter",
    "pointer": "{950ff929}",
    "name": "猎头者",
    "nameKey": "tft13_goopbuff_headhunter_title",
    "description": "这个弈子获得@StartingAS@%攻击速度。每击杀@NumKills@个弈子，这个弈子会永久获得额外的@StackingAS@%(在【狂暴模式】中翻倍)。<TFTTrackerLabel>(总计击杀数：@TFTUnitProperty.:TFT13_SetMechanic_EvolveBuff_Headhunter_CurrentKills@)</TFTTrackerLabel> ",
    "descriptionKey": "tft13_goopbuff_headhunter_description",
    "values": {
      "NumKills": 1.0,
      "StartingAS": 15.0,
      "StackingAS": 1.0,
      "{cdc2c7be}": 2.0
    },
    "standardPool": {
      "setPointer": "Maps/Shipping/Map22/Sets/TFTSet13_Evolved",
      "poolField": "{e6c62bd9}",
      "poolPointer": "{cc0b6cb2}",
      "entriesField": "{9a7587b2}",
      "entryPointerField": "{16c534fd}",
      "weightField": "{bc58e0e5}",
      "explicitWeight": null
    }
  }
} as const);
