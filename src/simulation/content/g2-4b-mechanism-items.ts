import { freezeContent } from './freeze';
import type { ItemDefinition } from '../strategy-types';
import {modifier} from './item-programs';

/** Only complete mechanisms are admitted here. Values: archived 14.24 map22,
 * Maps/Shipping/Map22/Items/TFT_Item_Artifact_Fishbones; source pins in normalized
 * g2-4b-mechanism-items.json. Only the entries below are current runtime claims.
 */
export const G24_MECHANISM_ITEMS: Readonly<Record<string, ItemDefinition>> = freezeContent({
  TFT_Item_Artifact_Fishbones: {
    id: 'TFT_Item_Artifact_Fishbones', apiName: 'TFT_Item_Artifact_Fishbones', name: '鱼骨头',
    kind: 'completed', unique: false, slotCost: 1, evidenceStatus: 'approved-provisional',
    conventionIds: ['G24-FISHBONES-TARGET-01'],
    effects: [
      {kind: 'statPercentBps', stat: 'attackDamage', bps: 4000},
      {kind: 'attackSpeedBps', bps: 4000},
      {kind: 'mechanic', mechanic: 'g24Fishbones', values: {rangeMultiplier: 2}},
    ],
    effectDescriptions: ['攻击距离翻倍，每次攻击从有效攻击距离内的敌人中随机选取目标（目标范围为待确认约定）。'],
  },
  TFT_Item_Artifact_SpectralCutlass: {
    id:'TFT_Item_Artifact_SpectralCutlass',apiName:'TFT_Item_Artifact_SpectralCutlass',name:'幽魂弯刀',
    kind:'completed',unique:false,slotCost:1,evidenceStatus:'approved-provisional',
    conventionIds:['G24-CUTLASS-CELL-01'],
    effects:[{kind:'statPercentBps',stat:'attackDamage',bps:4000},
      {kind:'statFlat',stat:'armor',amount:40},{kind:'statFlat',stat:'magicResist',amount:40},
      {kind:'mechanic',mechanic:'g24SpectralCutlass',values:{durationTicks:160}}],
    combatProgram:{modifiers:[modifier('critChance',2000,'bps')]},
    effectDescriptions:['开局传送到敌方镜像格，8秒后返回。占位时选最近空格（待确认约定）。'],
  },
  TFT_Item_Shroud: {
    id:'TFT_Item_Shroud',apiName:'TFT_Item_Shroud',name:'静止法衣',kind:'completed',unique:true,slotCost:1,
    evidenceStatus:'approved-provisional',conventionIds:['G24-SHROUD-BEAM-01'],
    effects:[{kind:'statFlat',stat:'maxHp',amount:150},
      {kind:'mechanic',mechanic:'g24Shroud',values:{costIncreaseBps:3000,allyHealth:60}}],
    effectDescriptions:['开局光束使敌人最大法力增加30%直到首次施法。全队获得60生命。光束宽度为待确认约定。'],
  },
});
