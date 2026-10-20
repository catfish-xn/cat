import { freezeContent } from './freeze';
import type { OrbTier } from '../orb-layout';

export const ORB_RULES = freezeContent({
  policy:'s13-orbs-project-v17', sampler:'frozen-cumulative-weights-v1', layout:'s13-orb-layout-v2', freeze:'s13-orb-freeze-v17',
  layoutSeedXor:0x4f524253, lootSeedXor:0xdeadbeef,
  planStream:'orb-stage-plan-v17', boxStream:'orb-box-v17', derivation:'fnv1a32-utf16(JSON([namespace,seed,...identity]))',
  sampling:'lcg32-v1/uint32-rejection-modulo/rejected-words-count',
  componentEquivalent:{component:1,completed:2,gold:0,unit:0,consumable:0},
  order:'sourceUnitId-codepoint/slotOrdinal-numeric/entryOrdinal-numeric',
  orbId:'JSON([orb,roundId,encounterId,sourceUnitId,slotOrdinal])', dropId:'JSON([orbId,entryOrdinal])',
  zero:['six-cost','radiant','emblem','spatula','frying-pan','masterwork','temporary-child','pve-choice','pve-fallback'],
});
export interface OrbStageCombination {
  readonly weight:number; readonly components:number; readonly gray:number; readonly blue:number;
  readonly gold:number; readonly prismatic:number;
}
const row=(weight:number,components:number,gray=0,blue=0,gold=0,prismatic=0):OrbStageCombination=>({weight,components,gray,blue,gold,prismatic});
/** 14.24b map22 integer weights. Bounds/points/retry/carrier rules are approved project conventions. */
export const ORB_STAGE_PLAN = freezeContent({
  highOdds:[630,300,58,10,2], minItems:11,maxItems:15,minBonus:20,maxBonus:79,maxAttempts:64,
  upgradeStage:{gray:3,blue:4,gold:4,prismatic:2},
  points:{gray:[2,3],blue:[6,8],gold:[15,18],prismatic:[40,40]},
  stages:[
    {base:[row(35,3,3),row(35,3,0,1),row(12,2,3,1),row(12,2,0,2),row(6,1,3,2)],
     high:[row(25,5,3),row(25,5,0,1),row(20,4,0,1),row(20,3,0,2),row(20,3,5)]},
    {base:[row(20,3,0,1),row(20,3,1,1),row(20,4),row(15,3,0,2),row(15,2,0,2),row(5,2,0,3),row(5,0,0,3)],
     high:[row(44,5),row(44,2,0,0,1),row(12,2,0,1,1)]},
    {base:[row(20,4,1,1),row(20,3,2,1),row(20,4,2),row(15,3,3),row(15,2,2,2),row(5,3,0,3),row(5,5,0,1)],
     high:[row(36,2,2,0,1),row(34,5),row(15,2,2,0,0,1),row(13,2,0,2,1),row(2,4,0,0,1)]},
    {base:[row(20,2,3),row(20,2,2,1),row(20,3,2),row(15,2,4),row(15,2,1,2),row(5,2,0,3),row(5,4,0,1)],
     high:[row(40,2,2,0,1),row(30,3,2,2),row(21,2,2,0,0,1),row(8,2,0,1,2),row(1,2,0,1,1,1)]},
  ],
  allocation:'components/gray/blue/gold/prismatic;stage1-round-robin-1-2/1-3/1-4;carrier-slotId-codepoint-round-robin',
});
export function orbBoxId(tier:OrbTier,stage:number):'copper'|'copperPlus'|'silver'|'silverPlus'|'gold'|'goldPlus'|'ultraPlus' {
  if(tier==='prismatic')return 'ultraPlus';
  return tier==='gray'?(stage<3?'copper':'copperPlus'):tier==='blue'?(stage<4?'silver':'silverPlus'):(stage<4?'gold':'goldPlus');
}
export const EPIC_SOURCES = freezeContent({'5-7':'d01','6-7':'h01'} as const);
