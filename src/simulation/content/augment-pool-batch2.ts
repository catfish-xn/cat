import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';
interface TraitAugmentContent {
 readonly apiName:string;readonly name:string;readonly tier:'silver'|'gold'|'prismatic';readonly description:string;
 readonly traits:readonly string[];readonly source:{readonly patch:string;readonly archive:string;readonly values:Readonly<Record<string,number|null>>;readonly description_en_us:string};
 readonly gifts:readonly AugmentGiftSpec[];readonly enabled:boolean;
}
/** The exact 26 classification.json class-B / batch-2 records. Disabled rows are evidence inventory only, never offers. */
export const AUGMENT_BATCH2:Readonly<Record<string,TraitAugmentContent>>=freezeContent({
  "academic-research": {
    "apiName": "TFT13_Augment_Academy",
    "name": "学术研究",
    "tier": "gold",
    "description": "每当你合成一件装备时，转而获得1个【成装锻造器】。该锻造器总是提供一件【皮城学院】装备以及已合成的装备。获得1件随机基础装备。获得1个【拉克丝】和1个【伊泽瑞尔】。",
    "traits": [
      "academy"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumItems": 1.0,
        "NumOptions": 2.0
      },
      "description_en_us": "Whenever you build an item, gain a completed item anvil instead. That anvil always offers an Academy item and the item built. Gain 1 random components. Gain a Lux and an Ezreal."
    },
    "gifts": [],
    "enabled": false
  },
  "loot-explosion": {
    "apiName": "TFT13_Augment_Ambusher",
    "name": "战利品爆炸",
    "tier": "gold",
    "description": "【伏击专家】击杀敌人时有几率掉落战利品，掉落几率受益于暴击几率。所获战利品的价值也可以触发暴击，从而提供更多战利品。获得1个【卡蜜尔】和1个【爆爆】。",
    "traits": [
      "ambusher"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "{51972fee}": 2.0,
        "{a59e2760}": 0.5,
        "{c209103c}": 0.10999999940395355,
        "{ca332ec1}": 0.5,
        "{d89481f4}": 1.75
      },
      "description_en_us": "Ambusher kills have a chance to drop loot, scaling with Critical Strike Chance. The value of the loot given can also critically strike, granting even more loot. Gain a Camille and a Powder."
    },
    "gifts": [],
    "enabled": false
  },
  "rocket-collection": {
    "apiName": "TFT13_Augment_Artillerist",
    "name": "火箭收藏",
    "tier": "gold",
    "description": "【炮手】火箭的伤害提升15%。你的【炮手】每发射75枚火箭，就会获得一个【收集者】(最多2个)。获得1个【崔丝塔娜】和1个【厄加特】。(已发射火箭的数量：〔对局动态值〕)",
    "traits": [
      "artillerist"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "IncreasedRocketDamage": 0.15000000596046448,
        "MaxItems": 2,
        "RocketDamageThreshold": 75.0
      },
      "description_en_us": "Artillerist rockets deal 15% increased damage. Every 75 rockets your Artillerists fire, gain a Collector (max 2). Gain a Tristana and Urgot. (Rockets Fired: 〔对局动态值〕)"
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "tristana"
      },
      {
        "kind": "unit",
        "definitionId": "urgot"
      }
    ],
    "enabled": true
  },
  "rocket-collection-plus": {
    "apiName": "TFT13_Augment_ArtilleristPlus",
    "name": "火箭收藏+",
    "tier": "gold",
    "description": "【炮手】火箭的伤害提升15%。你的【炮手】每发射65枚火箭，就会获得一个【收集者】(最多2个)。获得1个【崔丝塔娜】和1个【厄加特】。(已发射火箭的数量：〔对局动态值〕)",
    "traits": [
      "artillerist"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "IncreasedRocketDamage": 0.15000000596046448,
        "MaxItems": 2,
        "RocketDamageThreshold": 65.0
      },
      "description_en_us": "Artillerist rockets deal 15% increased damage. Every 65 rockets your Artillerists fire, gain a Collector (max 2). Gain a Tristana and Urgot. (Rockets Fired: 〔对局动态值〕)"
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "tristana"
      },
      {
        "kind": "unit",
        "definitionId": "urgot"
      }
    ],
    "enabled": true
  },
  "fractured-crystals": {
    "apiName": "TFT13_Augment_Automata",
    "name": "碎裂水晶",
    "tier": "gold",
    "description": "【海克斯机械】弈子发射其震波时，会向相距最近的那个敌人发射第二道震波，造成70%原伤害。获得1个【阿木木】和1个【魔腾】。",
    "traits": [
      "automata"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Percentage": 0.699999988079071
      },
      "description_en_us": "When an Automata champion fires their blast, they fire a second blast at the closest enemy dealing 70% of the original damage. Gain an Amumu and Nocturne."
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "amumu"
      },
      {
        "kind": "unit",
        "definitionId": "nocturne"
      }
    ],
    "enabled": true
  },
  "heavy-hitters": {
    "apiName": "TFT13_Augment_Bruiser",
    "name": "强力重击",
    "tier": "gold",
    "description": "每4秒，【格斗家】的下一次攻击会造成7%额外最大生命值的额外物理伤害。获得1个【斯特卜】和1个【特朗德尔】。",
    "traits": [
      "bruiser"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "RefreshSeconds": 4.0,
        "SlamPercentHealth": 0.07000000029802322
      },
      "description_en_us": "Every 4 seconds, Bruisers deal 7% bonus max Health bonus physical damage on their next attack. Gain a Steb and a Trundle."
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "steb"
      },
      {
        "kind": "unit",
        "definitionId": "trundle"
      }
    ],
    "enabled": true
  },
  "forbidden-magic": {
    "apiName": "TFT13_Augment_Cabal",
    "name": "禁忌魔法",
    "tier": "gold",
    "description": "【黑色玫瑰】弈子或【赛恩】每参与击杀3次，【赛恩】就会永久获得1.5%攻击力和10最大生命值。获得3个【黑色玫瑰】弈子。(层数：〔对局动态值〕)",
    "traits": [
      "black-rose"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumTakedownsPerStack": 3.0,
        "SionADPercentPerStack": 0.014999999664723873,
        "SionHealthPerStack": 10.0
      },
      "description_en_us": "Every 3 takedowns by Black Rose champions or Sion grant Sion permanent 1.5% Attack Damage and 10 Max Health. Gain 3 Black Rose champions. (Stacks: 〔对局动态值〕)"
    },
    "gifts": [],
    "enabled": false
  },
  "crimson-pact": {
    "apiName": "TFT13_Augment_Chembaron",
    "name": "底城争夺战",
    "tier": "gold",
    "description": "每当你在黑市上选择【保留微光】时，都会回复4玩家生命值并获得6金币。获得1个【荏妮】。",
    "traits": [
      "chem-baron"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Gold": 6.0,
        "Heal": 4.0
      },
      "description_en_us": "Everytime you choose to save your Shimmer on a Black Market, heal 4 player health and gain 6 gold. Gain a Renni."
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "renni"
      }
    ],
    "enabled": true
  },
  "noxian-guillotine": {
    "apiName": "TFT13_Augment_Conqueror",
    "name": "诺克萨斯断头台",
    "tier": "gold",
    "description": "【铁血征服者】处决生命值低于12%的敌人。在他们触发此效果时，他们会获得持续至战斗结束的5护甲与魔抗。获得1个【德莱厄斯】和1个【德莱文】。",
    "traits": [
      "conqueror"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "ArmorandMagicResist": 5.0,
        "BaseExecuteThreshold": 12.0,
        "NumKills": 1.0
      },
      "description_en_us": "Conquerors execute enemies below 12% Health. When they do, they gain 5 Armor and Magic Resist for the rest of combat. Gain a Darius and Draven."
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "darius"
      },
      {
        "kind": "unit",
        "definitionId": "draven"
      }
    ],
    "enabled": true
  },
  "dominate": {
    "apiName": "TFT13_Augment_Dominator",
    "name": "统领全场",
    "tier": "gold",
    "description": "【统领】们在有护盾值时获得10%攻击速度。一名【统领】完成击杀时，所有【统领】都将获得持续3秒的100护盾值。获得1个【卡西奥佩娅】。",
    "traits": [
      "dominator"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "ShieldAmount": 100.0,
        "ShieldDuration": 3,
        "ShieldPercentAS": 0.10000000149011612
      },
      "description_en_us": "Dominators gain 10% Attack Speed while shielded. When a Dominator gets a kill, all Dominators gain 100 Shield for 3 seconds. Gain a Cassiopeia."
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "cassiopeia"
      }
    ],
    "enabled": true
  },
  "enforce": {
    "apiName": "TFT13_Augment_Enforcer",
    "name": "执法",
    "tier": "gold",
    "description": "【执法官】们获得10%攻击力。每有6个被通缉的敌人阵亡，就会获得6金币。获得1个【斯特卜】和1个【麦迪】。",
    "traits": [
      "enforcer"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "BonusAD": 0.10000000149011612,
        "BonusGoldAmount": 6.0,
        "WantedEnemyBreakpoint": 6.0
      },
      "description_en_us": "Enforcer champions gain 10% Attack Damage. Every 6 Wanted enemy deaths grant 6 gold. Gain a Steb and Maddie."
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "steb"
      },
      {
        "kind": "unit",
        "definitionId": "maddie"
      }
    ],
    "enabled": true
  },
  "natural-selection": {
    "apiName": "TFT13_Augment_Experiment",
    "name": "物竞天择",
    "tier": "gold",
    "description": "【试验品】弈子们获得12%生命值并提供一个特殊格子。这个格子内的【试验品】弈子在战斗开始时会被击杀，从而将其【试验品】加成提供给其它的试验格。获得3个【试验品】弈子。",
    "traits": [
      "experiment"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Health": 0.11999999731779099,
        "{1b889d1c}": 100.0
      },
      "description_en_us": "Experiments gain 12% Health and grant a special hex. The Experiment in the hex is killed on combat start, granting their Experiment bonus to other laboratory hexes. Gain 3 Experiment champions."
    },
    "gifts": [],
    "enabled": false
  },
  "welcome-to-the-playground": {
    "apiName": "TFT13_Augment_Family",
    "name": "欢迎来到游乐场",
    "tier": "gold",
    "description": "如果在战斗17秒后或战斗结束时还有至少2个【家人】存活，则随机获得【范德尔】、【爆爆】或【蔚奥莱】的一个弈子。获得1个【爆爆】和1个【蔚奥莱】。",
    "traits": [
      "family"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "MinNumFamilyMembers": 2.0,
        "NumCopies": 1.0,
        "TimeRequirement": 17.0
      },
      "description_en_us": "If at least 2 Family members are alive after 17 seconds in combat or at the end of combat, gain a random copy of a Vander, Powder, or Violet. Gain a Powder and Violet."
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "powder"
      },
      {
        "kind": "unit",
        "definitionId": "violet"
      }
    ],
    "enabled": true
  },
  "aerial-warfare": {
    "apiName": "TFT13_Augment_Firelight",
    "name": "空战",
    "tier": "gold",
    "description": "在【野火帮】弈子们开始一次【野火帮】冲刺时，会获得9%攻击力和9法术强度。他们在该战斗中每移动一格还会获得另外的3%。获得1个【刀疤】和1个【泽丽】。",
    "traits": [
      "firelight"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Bonus": 3.0,
        "FirelightBonusAD": 0.09000000357627869,
        "FirelightBonusAP": 9.0,
        "{445a9cb6}": 99.0
      },
      "description_en_us": "Firelight champions gain 9% Attack Damage and 9 Ability Power when they start a Firelight dash. They gain another 3% for every hex traveled that combat. Gain a Scar and Zeri."
    },
    "gifts": [],
    "enabled": false
  },
  "why-not-both": {
    "apiName": "TFT13_Augment_Formswapper",
    "name": "为何不上两个？",
    "tier": "gold",
    "description": "当你派2名相同但却处于不同形态的【双形战士】上场时，两者都会获得24法术强度、护甲和魔抗，以及24%攻击力。当你将一名【双形战士】升到3星时，获得该弈子的1个2星版本。获得1个【斯维因】和1个【普朗克】。",
    "traits": [
      "form-swapper"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "BonusStats": 24.0
      },
      "description_en_us": "While you field 2 of the same Form Swapper in different forms, both gain 24 Ability Power, Armor, and Magic Resist, and 24% Attack Damage. When you 3-star a Form Swapper, gain a 2-star copy. Gain a Swain and Gangplank."
    },
    "gifts": [{"kind":"unit","definitionId":"swain"},{"kind":"unit","definitionId":"gangplank"}],
    "enabled": true
  },
  "pit-fighter-prizefighter": {
    "apiName": "TFT13_Augment_PitFighter",
    "name": "训练篇",
    "tier": "gold",
    "description": "如果【搏击手】输掉了上一场战斗，他们将永久获得1.5%攻击力。如果赢了，则转而获得45生命值。获得1个【厄加特】。",
    "traits": [
      "pit-fighter"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "ADPerLoss": 0.014999999664723873,
        "HealthPerWin": 45.0
      },
      "description_en_us": "Pit Fighters permanently gain 1.5% Attack Damage if they lost the last combat. If they won, gain 45 Health instead. Gain an Urgot."
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "urgot"
      }
    ],
    "enabled": true
  },
  "quickstriker-boost": {
    "apiName": "TFT13_Augment_Quickstriker",
    "name": "肾上腺爆发",
    "tier": "gold",
    "description": "战斗开始和之后每6秒，全体【迅击战士】的攻击变快85%，持续2.5秒。获得1个【魔腾】和1个【阿卡丽】。",
    "traits": [
      "quickstriker"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "AttackSpeed": 0.8500000238418579,
        "BuffDuration": 2.5,
        "TimeBetweenProcs": 6.0
      },
      "description_en_us": "Combat start and every 6 seconds, all Quickstrikers attack 85% faster for 2.5 seconds. Gain a Nocturne and Akali."
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "nocturne"
      },
      {
        "kind": "unit",
        "definitionId": "akali"
      }
    ],
    "enabled": true
  },
  "rebel-resurgence": {
    "apiName": "TFT13_Augment_Rebel",
    "name": "爆蓝之城",
    "tier": "gold",
    "description": "每场对战中的前5个【蓝发小队】阵亡时，召唤该弈子的一个比自身低一星级、生命值少400的版本。获得1个【阿卡丽】和1个【艾瑞莉娅】。",
    "traits": [
      "rebel"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumOfUnits": 5.0,
        "ReducedHealth": 400
      },
      "description_en_us": "When the first 5 Rebels die each combat, summon a copy of themselves that is one-star lower with 400 less Health. Gain an Akali and an Irelia."
    },
    "gifts": [],
    "enabled": false
  },
  "scrap-recycling": {
    "apiName": "TFT13_Augment_Scrap",
    "name": "极客宝藏之顶",
    "tier": "gold",
    "description": "【极客】们每转化6次基础装备，就会获得一件随机基础装备(最多5件)。获得1个【爆爆】和1个【特朗德尔】。\n\n已转化：〔对局动态值〕/6次",
    "traits": [
      "scrap"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "MaxComponents": 5.0,
        "NumScrapItemsConverted": 6.0
      },
      "description_en_us": "Every 6 components Scrap champions convert, gain a random component (max 5). Gain a Powder and a Trundle.\n\nConverted: 〔对局动态值〕/6"
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "powder"
      },
      {
        "kind": "unit",
        "definitionId": "trundle"
      }
    ],
    "enabled": true
  },
  "sentinel-slam": {
    "apiName": "TFT13_Augment_Sentinel",
    "name": "护盾猛击",
    "tier": "gold",
    "description": "【哨兵】们获得5%额外护甲与魔抗。每过4秒，他们的下一次攻击将造成其75%总双抗的魔法伤害。获得1个【洛里斯】。",
    "traits": [
      "sentinel"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Interval": 4.0,
        "PercGain": 0.05000000074505806,
        "ResistToDamageRatio": 0.75
      },
      "description_en_us": "Sentinels gain 5% bonus Armor and Magic Resist. Every 4 seconds, their next attack deals 75% of their total resistances as magic damage. Gain a Loris."
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "loris"
      }
    ],
    "enabled": true
  },
  "snipers-nest": {
    "apiName": "TFT13_Augment_Sniper",
    "name": "狙神之巢",
    "tier": "gold",
    "description": "【狙神】们每在相同的初始格战斗过一回合，就会获得+8%伤害增幅 (最多+32%)。获得1个【泽丽】。",
    "traits": [
      "sniper"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "DamageAmp": 8.0,
        "MaxAmp": 32.0
      },
      "description_en_us": "Snipers gain +8% Damage Amp for each round fought from the same starting hex (Maximum +32%). Gain a Zeri."
    },
    "gifts": [],
    "enabled": false
  },
  "sorcerer-explosion": {
    "apiName": "TFT13_Augment_Sorcerer",
    "name": "奥术之惩",
    "tier": "gold",
    "description": "当【法师】阵亡时，对所有邻格的弈子们造成其300%法术强度的魔法伤害。获得1个【弗拉基米尔】和1个【拉克丝】。",
    "traits": [
      "sorcerer"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "DeathPercentage": 3.0
      },
      "description_en_us": "When Sorcerers die, they deal 300% of their Ability Power as magic damage to all adjacent units. Gain a Vladimir and Lux."
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "vladimir"
      },
      {
        "kind": "unit",
        "definitionId": "lux"
      }
    ],
    "enabled": true
  },
  "visionary-voidlings": {
    "apiName": "TFT13_Augment_Visionary",
    "name": "虚空召唤者",
    "tier": "gold",
    "description": "战斗期间，【先知】们每消耗275法力值，就会召唤一个虚灵，至多至5个虚灵。获得1个【芮尔】和1个【莫甘娜】。\n\n虚灵拥有400-600生命值(基于阶段)。",
    "traits": [
      "visionary"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Mana": 275.0,
        "MaxVoidlings": 5.0,
        "Stage2Health": 400.0,
        "Stage3Health": 450.0,
        "Stage4Health": 500.0,
        "Stage5Health": 550.0,
        "Stage6Health": 600.0,
        "{3bc62dd2}": 60.0
      },
      "description_en_us": "For every 275 Mana Visionaries spend during combat, summon a Voidling, up to 5 Voidlings. Gain a Rell and Morgana.\n\nThe Voidling has 400-600 Health based on Stage."
    },
    "gifts": [],
    "enabled": false
  },
  "watcher-growth": {
    "apiName": "TFT13_Augment_Watcher",
    "name": "战斗伤疤",
    "tier": "gold",
    "description": "【监察】们每次受到攻击时，就会获得2%攻击力。【监察】每次被技能命中时，就会获得4法术强度。获得1个【范德尔】。",
    "traits": [
      "watcher"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "IncreaseADByTakeAttack": 2.0,
        "IncreaseAPByTakeSpell": 4.0
      },
      "description_en_us": "Every time Watchers are attacked, they gain 2% Attack Damage. Every time Watchers are hit by an ability, they gain 4 Ability Power. Gain a Vander."
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "vander"
      }
    ],
    "enabled": true
  },
  "betrayal": {
    "apiName": "TFT13_TeamupAugment_Betrayal",
    "name": "羁绊：背叛",
    "tier": "gold",
    "description": "【麦迪】的技能和攻击总会瞄准【安蓓萨】的目标。在每一回合中，只要有一方获得至少2次击杀，就能获得1个【麦迪】。\n\n获得1个【麦迪】和1个【安蓓萨】。",
    "traits": [
      "enforcer",
      "sniper",
      "quickstriker",
      "conqueror",
      "emissary"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumKills": 2.0
      },
      "description_en_us": "Maddie always targets Ambessa's target with her Ability and attacks. Every round where either gets at least 2 kills, gain a Maddie.\n\nGain a Maddie and Ambessa."
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "maddie"
      },
      {
        "kind": "unit",
        "definitionId": "ambessa"
      }
    ],
    "enabled": true
  },
  "blood-brothers": {
    "apiName": "TFT13_TeamupAugment_BloodBrothers",
    "name": "羁绊：本可发生之事",
    "tier": "prismatic",
    "description": "【希尔科】每次施放技能时，【范德尔】就会获得30永久最大生命值。【范德尔】每次阵亡时，【希尔科】就会获得6永久法术强度。\n\n获得1个2星【范德尔】、1个【希尔科】和1个【朔极之矛】。",
    "traits": [
      "dominator",
      "family",
      "watcher"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "APGainPerDeath": 6.0,
        "MaxHealthGainPerCast": 30.0
      },
      "description_en_us": "Vander gains 30 permanent max Health each time Silco casts. Silco gains 6 permanent Ability Power each time Vander dies.\n\nGain a 2-star Vander, a Silco, and a Spear of Shojin."
    },
    "gifts": [],
    "enabled": false
  }
});
export const AUGMENT_BATCH2_ENABLED=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH2).filter(([,row])=>row.enabled)));
export const AUGMENT_BATCH2_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH2_ENABLED).map(([id,row])=>[id,{
 id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'traitAugmentB2',values:{enabled:1}}],
}])));
export const AUGMENT_BATCH2_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH2_ENABLED).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH2_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH2_ENABLED).map(([id,row])=>[id,row.apiName])));
export function batch2Values(id:string):Readonly<Record<string,number>> {return AUGMENT_BATCH2[id]?.source.values as Readonly<Record<string,number>>??{};}

/** Disabled rows never enter definitions, tiers, gifts or API offer mappings.
 * Rechecked 2026-10-24 against augments-14.24.json (zero-based record indices),
 * selection-augment-fields.json and the matching map22 node; unknown hashes are
 * preserved as raw values, never guessed into a missing formula or unit stat. */
export const AUGMENT_BATCH2_BLOCKED=freezeContent({
  "academic-research": "R[70]：源值 NumOptions=2、NumItems=1 齐；缺赞助装备在三件 sponsor 中的选项抽样/权重及“所合成装备本身已是赞助装”时的去重与补位规则。现有通用四选锻造器不能冒充本项二选定制锻造器。",
  "loot-explosion": "R[132]：缺暴击率→掉落概率公式、战利品奖励表/权重及战利品暴击的倍率/递归上限；不是只有一个待填掉落率。",
  "forbidden-magic": "R[115]：三名黑玫瑰弈子的具体候选/费用/抽样权重未给出；还缺跨战 Sion takedown→永久成长的独立认证接线。现有 g23-sion 已存在，不能沿用旧分类“没有 Sion”的过时原因。",
  "natural-selection": "R[188]：只有 Health=0.12；缺新增牺牲实验格的位置/选取规则、无合法格/空格处理，以及牺牲来源加成的传播目标规则。",
  "aerial-warfare": "R[73]：9%AD/9AP 与 Bonus=3 齐；缺“每格另外3%”作用于基础值还是累积值的精确定义，以及该战移动格数是否含普通移动/冲刺/传送、冲刺过程如何计格。",
  "rebel-resurgence": "R[144]：5名/减400HP齐；缺一星死亡后的目标星级（原文低一星）、最低生命下限及召唤复制继承装备/永久成长/强化、是否能再触发复制的完整口径。",
  "snipers-nest": "R[178]：每次8%、上限32%齐；缺首战是否即有一层、换格/备战席/离场/重新购买时的层数重置规则及合星继承规则。",
  "visionary-voidlings": "R[208]：275法力、最多5只、阶段2–6生命400/450/500/550/600齐；缺虚灵基础AD/攻速/双抗/射程/技能与出生位置/无空格政策，不能只造一个有HP但其余数值自定的单位。",
  "blood-brothers": "R[301]：30永久HP/6永久AP、二星范德尔/希尔科/朔极之矛齐；缺多副本时的配对/受益实例范围及死亡/复活/出售/合星后永久成长归属；尚无本项的跨战成长认证字段与接线。"
});
