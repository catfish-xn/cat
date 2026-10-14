import { freezeContent } from './freeze';
import type { OrbTier } from '../orb-layout';
export const ORB_RULES = freezeContent({
  policy:'s13-orbs-project-v1', layout:'s13-orb-layout-v1', freeze:'s13-orb-freeze-v1',
  layoutSeedXor:0x4f524253, lootSeedXor:0xdeadbeef, equipmentWeights:[90,9,1], openingWeights:[50,50],
  grayToolWeights:[80,10,10], goldBonus:4, prismaticGold:8, openingGold:3,
  componentEquivalent:{component:1,completed:2,gold:0,unit:0,consumable:0},
  order:'sourceUnitId-codepoint/slotOrdinal-numeric/entryOrdinal-numeric',
  orbId:'JSON([orb,roundId,encounterId,sourceUnitId,slotOrdinal])', dropId:'JSON([orbId,entryOrdinal])',
  zero:['five-cost','six-cost','artifact','radiant','emblem','spatula','frying-pan','temporary-child','pve-choice','pve-fallback'],
});
export interface OrbSlot { readonly sourceSlotId:string; readonly slotOrdinal:number; readonly tier:OrbTier; readonly templateId:string }
const s=(sourceSlotId:string,slotOrdinal:number,tier:OrbTier,templateId:string):OrbSlot=>({sourceSlotId,slotOrdinal,tier,templateId});
export const ORB_SLOTS: Readonly<Record<string,readonly OrbSlot[]>> = freezeContent({
  '1-2':[s('m01',0,'gray','opening-unit')],
  '1-3':[s('m01',0,'gray','opening-unit'),s('r01',0,'blue','component')],
  '1-4':[s('m01',0,'gray','remover'),s('r01',0,'blue','component'),s('r02',0,'blue','opening-bonus')],
  '2-7':[s('k01',0,'blue','equipment'),s('k01',1,'gray','gray-1')],
  '3-7':[s('w00',0,'blue','equipment'),s('w00',1,'gray','gray-2')],
  '4-7':[s('r00',0,'blue','equipment'),s('r00',1,'gray','gray-3')],
  '5-7':[s('d01',0,'blue','equipment'),s('d01',1,'gray','gray-4')],
  '6-7':[s('h01',0,'gray','terminal')],
});
