import type { ItemDefinition } from '../strategy-types';
import { modifier,enemies,stat,status,burn,shield,trigger,damage,periodic } from './item-programs';
export const ROD_ITEMS: readonly ItemDefinition[] = [
{
  "id": "crownguard",
  "name": "冕卫",
  "kind": "completed",
  "apiName": "TFT_Item_Crownguard",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "A-08",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "vest",
    "rod"
  ],
  "effectDescriptions": ["开战获得25%最大生命护盾8秒；护盾耗尽或自然到期后获得25法强至战斗结束，死亡清除不奖励。"],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "abilityPower",
      "amount": 20
    },
    {
      "kind": "statFlat",
      "stat": "armor",
      "amount": 20
    },
    {
      "kind": "statFlat",
      "stat": "maxHp",
      "amount": 100
    }
  ],
  combatProgram: {effects:[shield(2500,160,[stat(modifier('abilityPower',25))])]}
},
{
  "id": "ionic-spark",
  "name": "离子火花",
  "kind": "completed",
  "apiName": "TFT_Item_IonicSpark",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "A-18",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "rod",
    "cloak"
  ],
  "effectDescriptions": ["2格内存活敌人魔抗降低30%；范围内敌人完成施法时受实际消耗法力×160%的魔法装备伤害，不暴击。"],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "abilityPower",
      "amount": 15
    },
    {
      "kind": "statFlat",
      "stat": "magicResist",
      "amount": 25
    },
    {
      "kind": "statFlat",
      "stat": "maxHp",
      "amount": 100
    }
  ],
  combatProgram: {periodic:[periodic(1,[status('shred',3000,1,{activation:'immediate'})],enemies({radius:2,maxTargets:100,sample:'each-tick'}))],triggers:[trigger({event:'cast-completed',listener:{subject:'actor',relationToHolder:'enemy',withinHexes:2},selector:enemies({candidates:'event-actor'}),effects:[damage('magic',{actualManaSpentBps:16000})]})]}
},
{
  "id": "jeweled-gauntlet",
  "name": "珠光护手",
  "kind": "completed",
  "apiName": "TFT_Item_JeweledGauntlet",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "A-19",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "rod",
    "gloves"
  ],
  "effectDescriptions": ["暴击率+35%；技能伤害可暴击，重复技能暴击授权每次加10%暴伤。"],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "abilityPower",
      "amount": 35
    }
  ],
  combatProgram: {modifiers:[modifier('critChance',3500,'bps')],effects:[{kind:'authorize-spell-crit',duplicateBonusBps:1000}]}
},
{
  "id": "morellonomicon",
  "name": "莫雷洛秘典",
  "kind": "completed",
  "apiName": "TFT_Item_Morellonomicon",
  "unique": true,
  "slotCost": 1,
  "conventionIds": [
    "B-01",
    "B-02",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "belt",
    "rod"
  ],
  "effectDescriptions": ["正普攻和技能伤害施加10秒灼烧与33%重伤，每秒灼烧1%当前最大生命；中立每跳上限100。"],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "abilityPower",
      "amount": 25
    },
    {
      "kind": "attackSpeedBps",
      "bps": 1000
    },
    {
      "kind": "statFlat",
      "stat": "maxHp",
      "amount": 150
    }
  ],
  combatProgram: {triggers:[trigger({event:'damage-dealt',selector:enemies({candidates:'event-target'}),effects:burn(200)})]}
}
];
