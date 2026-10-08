import type { ItemDefinition } from '../strategy-types';
import { always,modifier,hp,filter,enemies,burn,trigger,damage,periodic } from './item-programs';
export const VEST_ITEMS: readonly ItemDefinition[] = [
{
  "id": "bramble-vest",
  "name": "棘刺背心",
  "kind": "completed",
  "apiName": "TFT_Item_BrambleVest",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "A-06",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "vest",
    "vest"
  ],
  "effectDescriptions": ["普攻包减伤8%；每次普通攻击命中（含护盾）向1格内敌人反击100魔法装备伤害，每件冷却2秒。"],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "armor",
      "amount": 65
    },
    {
      "kind": "statPercentBps",
      "stat": "maxHp",
      "bps": 700
    }
  ],
  combatProgram: {modifiers:[modifier('damageReduction',800,'bps',always,filter(['basic-attack']))],triggers:[trigger({event:'incoming-basic-hit',listener:{subject:'target',relationToHolder:'self',withinHexes:null},internalCooldownTicks:40,selector:enemies({radius:1,maxTargets:100}),effects:[damage('magic',{flat:100})]})]}
},
{
  "id": "steadfast-heart",
  "name": "坚定之心",
  "kind": "completed",
  "apiName": "TFT_Item_NightHarvester",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "vest",
    "gloves"
  ],
  "effectDescriptions": ["暴击率+20%；每受伤包之前检查当前生命：严格高于50%减伤15%，其余8%。"],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "armor",
      "amount": 20
    },
    {
      "kind": "statFlat",
      "stat": "maxHp",
      "amount": 200
    }
  ],
  combatProgram: {modifiers:[modifier('critChance',2000,'bps'),modifier('damageReduction',800,'bps',always,filter()),modifier('damageReduction',1500,'bps',hp('gt',5000),filter())]}
},
{
  "id": "sunfire-cape",
  "name": "日炎斗篷",
  "kind": "completed",
  "apiName": "TFT_Item_RedBuff",
  "unique": true,
  "slotCost": 1,
  "conventionIds": [
    "B-02",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "vest",
    "belt"
  ],
  "effectDescriptions": ["每2秒选择2格内优先未受本件灼烧的敌人，施加10秒1%每秒灼烧与33%重伤；同类取强，中立每跳上限100。"],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "armor",
      "amount": 20
    },
    {
      "kind": "statFlat",
      "stat": "maxHp",
      "amount": 150
    },
    {
      "kind": "statPercentBps",
      "stat": "maxHp",
      "bps": 800
    }
  ],
  combatProgram: {periodic:[periodic(40,burn(200),enemies({radius:2,order:'not-burned-by-this-instance-distance-id',sample:'each-pulse'}))]}
}
];
