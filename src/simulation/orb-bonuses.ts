import { ORB_RULES } from './content/orbs';
import type { OrbTier } from './orb-layout';
import type { ConsumableDefinitionId } from './consumable-types';
import { drawIndex } from './orb-layout';
/** Per-orb namespace, FNV-1a over UTF-16 code units, then lcg32-v1 rejection.
 * Never advances the legacy payload stream. Identity includes the seat-local seed. */
export function orbDuplicatorIndex(seed:number,orbId:string):number {
  const text=JSON.stringify([ORB_RULES.duplicatorStream.namespace,seed,orbId]);
  let hash=2166136261;
  for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619)>>>0;
  return drawIndex({state:hash,draws:0},100).index;
}
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
