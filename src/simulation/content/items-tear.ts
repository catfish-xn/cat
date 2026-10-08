import type { ItemDefinition } from '../strategy-types';
import { modifier,hp,rows,amount,selector,stat,status,shield,trigger,survival,mana,periodic,vamp } from './item-programs';
export const TEAR_ITEMS: readonly ItemDefinition[] = [
{
  "id": "adaptive-helm",
  "name": "自适应头盔",
  "kind": "completed",
  "apiName": "TFT_Item_AdaptiveHelm",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "A-01",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "cloak",
    "tear"
  ],
  "effectDescriptions": ["开战锁定己方前两排：40双抗、每次普通攻击命中额外回1蓝；后两排：15法强、每3秒回10蓝。移动不切换分支。"],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "abilityPower",
      "amount": 10
    },
    {
      "kind": "statFlat",
      "stat": "magicResist",
      "amount": 20
    },
    {
      "kind": "statFlat",
      "stat": "initialMana",
      "amount": 15
    }
  ],
  combatProgram: {modifiers:[modifier('armor',40,'flat',rows('front-two')),modifier('magicResist',40,'flat',rows('front-two')),modifier('abilityPower',15,'flat',rows('back-two'))],triggers:[trigger({event:'incoming-basic-hit',listener:{subject:'target',relationToHolder:'self',withinHexes:null},condition:rows('front-two'),effects:[mana(1,'incoming-basic-hit')]})],periodic:[periodic(60,[mana(10,'periodic')],selector({sample:'each-pulse'}),{condition:rows('back-two')})]}
},
{
  "id": "blue-buff",
  "name": "蓝霸符",
  "kind": "completed",
  "apiName": "TFT_Item_BlueBuff",
  "unique": true,
  "slotCost": 1,
  "conventionIds": [
    "A-05",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "tear",
    "tear"
  ],
  "effectDescriptions": ["完成施法回复10法力，可绕过该次施法锁蓝；参与击杀后增伤5%持续8秒，同件刷新不叠加。"],
  "effects": [
    {
      "kind": "statPercentBps",
      "stat": "attackDamage",
      "bps": 1500
    },
    {
      "kind": "statFlat",
      "stat": "abilityPower",
      "amount": 15
    },
    {
      "kind": "statFlat",
      "stat": "initialMana",
      "amount": 30
    }
  ],
  combatProgram: {triggers:[trigger({id:'refund',event:'cast-completed',effects:[mana(10,'cast-refund')]}),trigger({id:'takedown',event:'kill-or-assist',effects:[stat(modifier('damageAmp',500,'bps'),160)]})]}
},
{
  "id": "protectors-vow",
  "name": "圣盾使的誓约",
  "kind": "completed",
  "apiName": "TFT_Item_FrozenHeart",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "A-11",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "vest",
    "tear"
  ],
  "effectDescriptions": ["受伤后存活且生命≤40%时每战一次获得25%最大生命护盾5秒及20双抗至战斗结束。"],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "armor",
      "amount": 20
    },
    {
      "kind": "statFlat",
      "stat": "initialMana",
      "amount": 30
    }
  ],
  combatProgram: {survival:[survival(4000,[shield(2500,100),stat(modifier('armor',20)),stat(modifier('magicResist',20))])]}
},
{
  "id": "redemption",
  "name": "救赎",
  "kind": "completed",
  "apiName": "TFT_Item_Redemption",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "B-09",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "belt",
    "tear"
  ],
  "effectDescriptions": ["每5秒治疗1格内存活友军（包括自身）15%已损生命，每次每目标上限1000；同时获得10%常规减伤5秒，同类不叠加。"],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "initialMana",
      "amount": 15
    },
    {
      "kind": "statFlat",
      "stat": "maxHp",
      "amount": 150
    }
  ],
  combatProgram: {periodic:[periodic(100,[{kind:'heal',amount:amount({missingHpBps:1500,hpBasis:'target',sample:'each-pulse',cap:1000})},status('damage-reduction',1000,100)],selector({relation:'ally',radius:1,maxTargets:100,sample:'each-pulse'}))]}
},
{
  "id": "hand-of-justice",
  "name": "正义之手",
  "kind": "completed",
  "apiName": "TFT_Item_UnstableConcoction",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "gloves",
    "tear"
  ],
  "effectDescriptions": ["暴击率+20%；基础15%攻击力、15法强、12%全能吸血；生命严格高于50%攻击/法强翻倍，严格低于50%吸血翻倍，恰50%不翻倍。"],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "initialMana",
      "amount": 15
    }
  ],
  combatProgram: {modifiers:[modifier('critChance',2000,'bps'),modifier('attackDamage',1500,'bps'),modifier('abilityPower',15),modifier('attackDamage',1500,'bps',hp('gt',5000)),modifier('abilityPower',15,'flat',hp('gt',5000))],vamp:[vamp(1200),vamp(1200,hp('lt',5000))]}
}
];
