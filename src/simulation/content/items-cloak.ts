import type { ItemDefinition } from '../strategy-types';
import { combat,modifier,selector,enemies,stat,status,periodic } from './item-programs';
export const CLOAK_ITEMS: readonly ItemDefinition[] = [
{
  "id": "quicksilver",
  "name": "水银",
  "kind": "completed",
  "apiName": "TFT_Item_Quicksilver",
  "unique": true,
  "slotCost": 1,
  "conventionIds": [
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "cloak",
    "gloves"
  ],
  "effectDescriptions": ["暴击率+20%；开战免控18秒，每2秒获得3%攻速，共9次；攻速持续本战，18秒末次加速后免控到期。"],
  "effects": [
    {
      "kind": "attackSpeedBps",
      "bps": 3000
    },
    {
      "kind": "statFlat",
      "stat": "magicResist",
      "amount": 20
    }
  ],
  combatProgram: {modifiers:[modifier('critChance',2000,'bps')],effects:[status('control-immunity',10000,360)],periodic:[periodic(40,[{kind:'modify-stat',modifier:modifier('attackSpeed',300,'bps'),activation:'immediate',duration:combat,stackPolicy:{kind:'add-stacks',cap:null}}],selector({sample:'each-pulse'}),{endsAtTick:360,finalPulse:'before-expiry'})]}
},
{
  "id": "evenshroud",
  "name": "薄暮法袍",
  "kind": "completed",
  "apiName": "TFT_Item_SpectralGauntlet",
  "unique": false,
  "slotCost": 1,
  "conventionIds": [
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "belt",
    "cloak"
  ],
  "effectDescriptions": ["开战获得25双抗10秒；2格内敌人护甲降低30%，移动、离开或持有者死亡即时移除光环，同类取最强。"],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "magicResist",
      "amount": 20
    },
    {
      "kind": "statFlat",
      "stat": "maxHp",
      "amount": 150
    }
  ],
  combatProgram: {effects:[stat(modifier('armor',25),200),stat(modifier('magicResist',25),200)],periodic:[periodic(1,[status('sunder',3000,1)],enemies({radius:2,maxTargets:100,sample:'each-tick'}))]}
}
];
