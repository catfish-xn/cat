import { ORB_RULES } from './content/orbs';
import type { OrbTier } from './orb-layout';
import type { ConsumableDefinitionId } from './consumable-types';
/** The index is a single independent rejection-sampled word over 100. */
export function sampleOrbDuplicatorBonus(tier:OrbTier,stage:number,index:number):readonly ConsumableDefinitionId[]{
  if(!Number.isSafeInteger(stage)||stage<1||!Number.isSafeInteger(index)||index<0||index>=100)throw new RangeError('Invalid duplicator bonus index');
  if(stage>4||tier==='prismatic')return [];
  const early=stage<4;
  const weights=tier==='gray'?ORB_RULES.duplicatorBonus.gray:tier==='blue'?(early?ORB_RULES.duplicatorBonus.blueEarly:ORB_RULES.duplicatorBonus.blueLate):(early?ORB_RULES.duplicatorBonus.goldEarly:ORB_RULES.duplicatorBonus.goldLate);
  const lesser='TFT_Consumable_ChampionDuplicator_III',full='TFT_Consumable_NeekosHelp';
  if(index<weights[0])return [];
  if(tier==='gray')return [lesser];
  if(tier==='blue')return early&&index<weights[0]+weights[1]?[lesser]:[full];
  return early&&index>=weights[0]+weights[1]?[full,lesser]:[full];
}
