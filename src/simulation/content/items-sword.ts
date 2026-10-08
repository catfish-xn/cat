import type { ItemDefinition } from '../strategy-types';
import { modifier,stat,status,shield,survival,vamp } from './item-programs';
export const SWORD_ITEMS: readonly ItemDefinition[] = [
{
  "id": "bloodthirster",
  "name": "饮血剑",
  "kind": "completed",
  "apiName": "TFT_Item_Bloodthirster",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "A-04",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "sword",
    "cloak"
  ],
  "effectDescriptions": ["20%全能吸血；受伤后存活且生命≤40%时每战一次获得25%最大生命护盾，持续5秒。"],
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
      "stat": "magicResist",
      "amount": 20
    }
  ],
  combatProgram: {vamp:[vamp(2000)],survival:[survival(4000,[shield(2500,100)])]}
},
{
  "id": "edge-of-night",
  "name": "夜之锋刃",
  "kind": "completed",
  "apiName": "TFT_Item_GuardianAngel",
  "unique": true,
  "slotCost": 1,
  "conventionIds": [
    "A-14",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "sword",
    "vest"
  ],
  "effectDescriptions": ["受伤后存活且生命≤60%时每战一次清除可移除的敌方控制、持续伤害和减益；1秒无法选中并防止伤害，结束后获得15%攻速。"],
  "effects": [
    {
      "kind": "statPercentBps",
      "stat": "attackDamage",
      "bps": 1000
    },
    {
      "kind": "statFlat",
      "stat": "armor",
      "amount": 20
    }
  ],
  combatProgram: {survival:[survival(6000,[{kind:'cleanse',remove:'removable-hostile-control-dot-debuff',retarget:true},status('untargetable',10000,20,{activation:'immediate',onEnd:{reasons:['expired'],timing:'expiry-before-actions',effects:[stat(modifier('attackSpeed',1500,'bps'))]}}),status('damage-prevention',10000,20,{activation:'immediate'})])]}
},
{
  "id": "infinity-edge",
  "name": "无尽之刃",
  "kind": "completed",
  "apiName": "TFT_Item_InfinityEdge",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "A-17",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "sword",
    "gloves"
  ],
  "effectDescriptions": ["暴击率+35%；技能伤害可暴击，重复技能暴击授权每次加10%暴伤。"],
  "effects": [
    {
      "kind": "statPercentBps",
      "stat": "attackDamage",
      "bps": 3500
    }
  ],
  combatProgram: {modifiers:[modifier('critChance',3500,'bps')],effects:[{kind:'authorize-spell-crit',duplicateBonusBps:1000}]}
},
{
  "id": "giant-slayer",
  "name": "巨人杀手",
  "kind": "completed",
  "apiName": "TFT_Item_MadredsBloodrazor",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "GLOBAL-STAT-01",
    "GS-01"
  ],
  "recipe": [
    "sword",
    "bow"
  ],
  "effectDescriptions": ["基础增伤5%；每包目标当前最大生命严格超过1750时另加20%。"],
  "effects": [
    {
      "kind": "statPercentBps",
      "stat": "attackDamage",
      "bps": 2500
    },
    {
      "kind": "statFlat",
      "stat": "abilityPower",
      "amount": 25
    },
    {
      "kind": "attackSpeedBps",
      "bps": 1000
    }
  ],
  combatProgram: {modifiers:[modifier('damageAmp',500,'bps'),modifier('damageAmp',2000,'bps',{kind:'target-max-hp',op:'gt',hp:1750})]}
},
{
  "id": "steraks-gage",
  "name": "斯特拉克的挑战护手",
  "kind": "completed",
  "apiName": "TFT_Item_SteraksGage",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "sword",
    "belt"
  ],
  "effectDescriptions": ["开场或受伤后存活且生命≤60%时每战一次增加25%最大生命及等量当前生命、35%攻击力，持续本战。"],
  "effects": [
    {
      "kind": "statPercentBps",
      "stat": "attackDamage",
      "bps": 1500
    },
    {
      "kind": "statFlat",
      "stat": "maxHp",
      "amount": 150
    }
  ],
  combatProgram: {survival:[survival(6000,[{kind:'change-max-hp',bonusBps:2500,currentHp:'add-max-delta',countsAsHeal:false},stat(modifier('attackDamage',3500,'bps'))],true)]}
}
];
