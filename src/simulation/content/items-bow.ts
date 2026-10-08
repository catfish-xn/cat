import type { ItemDefinition } from '../strategy-types';
import { modifier,enemies,stat,status,burn,trigger,damage } from './item-programs';
export const BOW_ITEMS: readonly ItemDefinition[] = [
{
  "id": "last-whisper",
  "name": "最后的轻语",
  "kind": "completed",
  "apiName": "TFT_Item_LastWhisper",
  "unique": true,
  "slotCost": 1,
  "conventionIds": [
    "A-20",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "bow",
    "gloves"
  ],
  "effectDescriptions": ["暴击率+20%；正物理伤害（含护盾伤害）之后施加30%削甲3秒，同类取最强，刷新不叠乘。"],
  "effects": [
    {
      "kind": "statPercentBps",
      "stat": "attackDamage",
      "bps": 1500
    },
    {
      "kind": "attackSpeedBps",
      "bps": 2000
    }
  ],
  combatProgram: {modifiers:[modifier('critChance',2000,'bps')],triggers:[trigger({event:'damage-dealt',selector:enemies({candidates:'event-target'}),effects:[status('sunder',3000,60)]})]}
},
{
  "id": "nashors-tooth",
  "name": "纳什之牙",
  "kind": "completed",
  "apiName": "TFT_Item_Leviathan",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "A-21",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "belt",
    "bow"
  ],
  "effectDescriptions": ["完成施法后下一tick获得60%攻速5秒，同件刷新不叠加。"],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "abilityPower",
      "amount": 10
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
  combatProgram: {triggers:[trigger({event:'cast-completed',effects:[stat(modifier('attackSpeed',6000,'bps'),100,'next-tick')]})]}
},
{
  "id": "red-buff",
  "name": "红霸符",
  "kind": "completed",
  "apiName": "TFT_Item_RapidFireCannon",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "B-07",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "bow",
    "bow"
  ],
  "effectDescriptions": ["基础增伤3%；正普攻和技能伤害施加5秒灼烧与33%重伤，每秒灼烧1%当前最大生命。"],
  "effects": [
    {
      "kind": "attackSpeedBps",
      "bps": 3500
    }
  ],
  combatProgram: {modifiers:[modifier('damageAmp',300,'bps')],triggers:[trigger({event:'damage-dealt',selector:enemies({candidates:'event-target'}),effects:burn(100)})]}
},
{
  "id": "runaans-hurricane",
  "name": "卢安娜的飓风",
  "kind": "completed",
  "apiName": "TFT_Item_RunaansHurricane",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "cloak",
    "bow"
  ],
  "effectDescriptions": ["每次完成普攻向最近的另一敌人发射55%当前攻击力的物理装备箭矢；不暴击、不附带攻击特效。"],
  "effects": [
    {
      "kind": "statPercentBps",
      "stat": "attackDamage",
      "bps": 2500
    },
    {
      "kind": "attackSpeedBps",
      "bps": 1000
    },
    {
      "kind": "statFlat",
      "stat": "magicResist",
      "amount": 20
    }
  ],
  combatProgram: {triggers:[trigger({selector:enemies({excludePrimary:true,maxTargets:1}),effects:[damage('physical',{attackDamageBps:5500})]})]}
},
{
  "id": "statikk-shiv",
  "name": "斯塔缇克电刃",
  "kind": "completed",
  "apiName": "TFT_Item_StatikkShiv",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "B-13",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "bow",
    "tear"
  ],
  "effectDescriptions": ["每第3次完成普攻，对主目标及最近最多3个不同敌人先施加30%减魔抗5秒，再造成35魔法装备伤害，不暴击。"],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "abilityPower",
      "amount": 15
    },
    {
      "kind": "attackSpeedBps",
      "bps": 1500
    },
    {
      "kind": "statFlat",
      "stat": "initialMana",
      "amount": 15
    }
  ],
  combatProgram: {triggers:[trigger({counters:[{id:'attacks',events:[{event:'attack-completed',listener:{subject:'actor',relationToHolder:'self',withinHexes:null},qualifies:'completed-event'}],scope:'source-instance',reset:'combat-start',cap:null}],gate:{kind:'every-n',counterId:'attacks',everyN:3,firstAt:3},selector:enemies({primary:'first-required',anchor:'primary-target',maxTargets:4}),effects:[status('shred',3000,100),damage('magic',{flat:35})]})]}
},
{
  "id": "titans-resolve",
  "name": "泰坦的坚决",
  "kind": "completed",
  "apiName": "TFT_Item_TitansResolve",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "vest",
    "bow"
  ],
  "effectDescriptions": [
    "AS: 1000 Bps",
    "Armor: 20 armor-points",
    "BonusResistsAtStackCap: 20 resist-points",
    "StackCap: 25 count",
    "StackingAD: 200 Bps",
    "StackingSP: 2 ability-power-points"
  ],
  "effects": [
    {
      "kind": "attackSpeedBps",
      "bps": 1000
    },
    {
      "kind": "statFlat",
      "stat": "armor",
      "amount": 20
    }
  ],
  combatProgram: {triggers:[trigger({id:'growth',event:'counter-updated',counters:[{id:'stacks',events:[{event:'attack-completed',listener:{subject:'actor',relationToHolder:'self',withinHexes:null},qualifies:'completed-event'},{event:'damage-taken',listener:{subject:'target',relationToHolder:'self',withinHexes:null},qualifies:'positive-actual-damage'}],scope:'source-instance',reset:'combat-start',cap:25}],effects:['attackDamage','abilityPower'].map((s,i)=>stat({...modifier(s as 'attackDamage'|'abilityPower',0,i===0?'bps':'flat'),value:{kind:'counter',counterId:'stacks',perCount:i===0?200:2}},null,'next-tick'))}),trigger({id:'cap',event:'counter-updated',counters:[{id:'stacks',events:[{event:'attack-completed',listener:{subject:'actor',relationToHolder:'self',withinHexes:null},qualifies:'completed-event'},{event:'damage-taken',listener:{subject:'target',relationToHolder:'self',withinHexes:null},qualifies:'positive-actual-damage'}],scope:'source-instance',reset:'combat-start',cap:25}],gate:{kind:'stack-threshold-once',counterId:'stacks',at:25,rewardId:'resists'},effects:[stat(modifier('armor',20),null,'next-tick'),stat(modifier('magicResist',20),null,'next-tick')]})]}
}
];
