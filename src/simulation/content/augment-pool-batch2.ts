import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';
interface TraitAugmentContent {
 readonly apiName:string;readonly tier:'silver'|'gold'|'prismatic';
 readonly traits:readonly string[];readonly source:{readonly patch:string;readonly archive:string;readonly values:Readonly<Record<string,number|null>>};
 readonly gifts:readonly AugmentGiftSpec[];readonly enabled:boolean;
}
/** The exact 26 classification.json class-B / batch-2 records. Disabled rows are evidence inventory only, never offers. */
export const AUGMENT_BATCH2:Readonly<Record<string,TraitAugmentContent>>=freezeContent({
  "academic-research": {
    "apiName": "TFT13_Augment_Academy",
    "tier": "gold",
    "traits": [
      "academy"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumItems": 1.0,
        "NumOptions": 2.0
      }
    },
    "gifts": [],
    "enabled": false
  },
  "loot-explosion": {
    "apiName": "TFT13_Augment_Ambusher",
    "tier": "gold",
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
      }
    },
    "gifts": [],
    "enabled": false
  },
  "rocket-collection": {
    "apiName": "TFT13_Augment_Artillerist",
    "tier": "gold",
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
      }
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
    "tier": "gold",
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
      }
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
    "tier": "gold",
    "traits": [
      "automata"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Percentage": 0.699999988079071
      }
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
    "tier": "gold",
    "traits": [
      "bruiser"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "RefreshSeconds": 4.0,
        "SlamPercentHealth": 0.07000000029802322
      }
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
    "tier": "gold",
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
      }
    },
    "gifts": [],
    "enabled": false
  },
  "crimson-pact": {
    "apiName": "TFT13_Augment_Chembaron",
    "tier": "gold",
    "traits": [
      "chem-baron"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Gold": 6.0,
        "Heal": 4.0
      }
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
    "tier": "gold",
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
      }
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
    "tier": "gold",
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
      }
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
    "tier": "gold",
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
      }
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
    "tier": "gold",
    "traits": [
      "experiment"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Health": 0.11999999731779099,
        "{1b889d1c}": 100.0
      }
    },
    "gifts": [],
    "enabled": false
  },
  "welcome-to-the-playground": {
    "apiName": "TFT13_Augment_Family",
    "tier": "gold",
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
      }
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
    "tier": "gold",
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
      }
    },
    "gifts": [],
    "enabled": false
  },
  "why-not-both": {
    "apiName": "TFT13_Augment_Formswapper",
    "tier": "gold",
    "traits": [
      "form-swapper"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "BonusStats": 24.0
      }
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "swain"
      },
      {
        "kind": "unit",
        "definitionId": "gangplank"
      }
    ],
    "enabled": true
  },
  "pit-fighter-prizefighter": {
    "apiName": "TFT13_Augment_PitFighter",
    "tier": "gold",
    "traits": [
      "pit-fighter"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "ADPerLoss": 0.014999999664723873,
        "HealthPerWin": 45.0
      }
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
    "tier": "gold",
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
      }
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
    "tier": "gold",
    "traits": [
      "rebel"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "NumOfUnits": 5.0,
        "ReducedHealth": 400
      }
    },
    "gifts": [],
    "enabled": false
  },
  "scrap-recycling": {
    "apiName": "TFT13_Augment_Scrap",
    "tier": "gold",
    "traits": [
      "scrap"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "MaxComponents": 5.0,
        "NumScrapItemsConverted": 6.0
      }
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
    "tier": "gold",
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
      }
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
    "tier": "gold",
    "traits": [
      "sniper"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "DamageAmp": 8.0,
        "MaxAmp": 32.0
      }
    },
    "gifts": [],
    "enabled": false
  },
  "sorcerer-explosion": {
    "apiName": "TFT13_Augment_Sorcerer",
    "tier": "gold",
    "traits": [
      "sorcerer"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "DeathPercentage": 3.0
      }
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
    "tier": "gold",
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
      }
    },
    "gifts": [],
    "enabled": false
  },
  "watcher-growth": {
    "apiName": "TFT13_Augment_Watcher",
    "tier": "gold",
    "traits": [
      "watcher"
    ],
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "IncreaseADByTakeAttack": 2.0,
        "IncreaseAPByTakeSpell": 4.0
      }
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
    "tier": "gold",
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
      }
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
    "tier": "prismatic",
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
      }
    },
    "gifts": [
      {
        "kind": "unit",
        "definitionId": "vander",
        "starLevel": 2
      },
      {
        "kind": "unit",
        "definitionId": "silco"
      },
      {
        "kind": "item",
        "definitionId": "shojin"
      }
    ],
    "enabled": true
  }
});
export const AUGMENT_BATCH2_ENABLED=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH2).filter(([,row])=>row.enabled)));
export const AUGMENT_BATCH2_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH2_ENABLED).map(([id])=>[id,{
 id,name:id,description:id,effects:[{kind:'mechanic',mechanic:'traitAugmentB2',values:{enabled:1}}],
}])));
export const AUGMENT_BATCH2_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH2_ENABLED).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH2_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH2_ENABLED).map(([id,row])=>[id,row.apiName])));
export function batch2Values(id:string):Readonly<Record<string,number>> {return AUGMENT_BATCH2[id]?.source.values as Readonly<Record<string,number>>??{};}

/** Disabled rows never enter definitions, tiers, gifts or API offer mappings.
 * Rechecked 2026-10-24 against augments-14.24.json (zero-based record indices),
 * selection-augment-fields.json and the matching map22 node; unknown hashes are
 * preserved as raw values, never guessed into a missing formula or unit stat. */
export const AUGMENT_BATCH2_BLOCKED=freezeContent({
  "loot-explosion": "R[132]：缺暴击率→掉落概率公式、战利品奖励表/权重及战利品暴击的倍率/递归上限；不是只有一个待填掉落率。",
  "forbidden-magic": "R[115]：三名黑玫瑰弈子的具体候选/费用/抽样权重未给出；还缺跨战 Sion takedown→永久成长的独立认证接线。现有 g23-sion 已存在，不能沿用旧分类“没有 Sion”的过时原因。",
  "natural-selection": "R[188]：只有 Health=0.12；缺新增牺牲实验格的位置/选取规则、无合法格/空格处理，以及牺牲来源加成的传播目标规则。",
  "aerial-warfare": "R[73]：9%AD/9AP 与 Bonus=3 齐；缺“每格另外3%”作用于基础值还是累积值的精确定义，以及该战移动格数是否含普通移动/冲刺/传送、冲刺过程如何计格。",
  "rebel-resurgence": "R[144]：5名/减400HP齐；缺一星死亡后的目标星级（原文低一星）、最低生命下限及召唤复制继承装备/永久成长/强化、是否能再触发复制的完整口径。",
  "snipers-nest": "R[178]：每次8%、上限32%齐；缺首战是否即有一层、换格/备战席/离场/重新购买时的层数重置规则及合星继承规则。",
  "visionary-voidlings": "R[208]：275法力、最多5只、阶段2–6生命400/450/500/550/600齐；缺虚灵基础AD/攻速/双抗/射程/技能与出生位置/无空格政策，不能只造一个有HP但其余数值自定的单位。"
});
