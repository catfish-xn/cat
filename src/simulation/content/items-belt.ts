import type { ItemDefinition } from '../strategy-types';
import { modifier,stat,trigger } from './item-programs';
export const BELT_ITEMS: readonly ItemDefinition[] = [
{
  "id": "guardbreaker",
  "name": "破防者",
  "kind": "completed",
  "apiName": "TFT_Item_PowerGauntlet",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "B-04",
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "belt",
    "gloves"
  ],
  "effectDescriptions": ["暴击率+20%、基础增伤10%；对护盾造成正伤害后另增伤15%持续3秒，同件刷新不叠加，触发包不享受新增益。"],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "abilityPower",
      "amount": 10
    },
    {
      "kind": "attackSpeedBps",
      "bps": 2000
    },
    {
      "kind": "statFlat",
      "stat": "maxHp",
      "amount": 150
    }
  ],
  combatProgram: {modifiers:[modifier('critChance',2000,'bps'),modifier('damageAmp',1000,'bps')],triggers:[trigger({event:'shield-hit',effects:[stat(modifier('damageAmp',1500,'bps'),60)]})]}
}
];
