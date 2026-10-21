import { nextRandom, validateSeed } from './rng';
import { G23_CONQUEROR_CHESTS, G23_BLACK_MARKETS, G23_POLICY } from './content/g2-3-policy';

export interface G23ConquestReceipt { readonly battleId:string; readonly tier:number; readonly takedownIds:readonly string[]; readonly stacksAdded:number; readonly chestTiers:readonly number[] }
export interface G23ConquestProgress { readonly stacks:number; readonly chestsOpened:number; readonly receipts:readonly G23ConquestReceipt[]; readonly radiantConversion:boolean }
export const EMPTY_G23_CONQUEST: G23ConquestProgress = Object.freeze({stacks:0,chestsOpened:0,receipts:Object.freeze([]),radiantConversion:false});
const integer=(n:number,min=0)=>{if(!Number.isSafeInteger(n)||n<min)throw new RangeError('Invalid G2-3 progress integer');return n;};
const rate=(tier:number)=>{const n=G23_POLICY.conqueror.stacksPerTakedown[tier as 2|4|6|9];if(!n)throw new RangeError('Inactive Conqueror tier');return n;};
/** battleId is the authoritative settlement identity; replay never consumes rewards twice. */
export function planG23Conquest(progress:G23ConquestProgress,battleId:string,tier:number,takedownIds:readonly string[]):G23ConquestProgress {
  if(!battleId)throw new RangeError('Missing Conqueror battle identity');
  if(progress.receipts.some(r=>r.battleId===battleId))return progress;
  const multiplier=rate(tier),ids=[...new Set(takedownIds)].sort();
  if(ids.some(id=>typeof id!=='string'||!id))throw new RangeError('Invalid Conqueror takedown identity');
  const stacksAdded=integer(ids.length*multiplier),stacks=integer(progress.stacks+stacksAdded);
  const chestsOpened=G23_CONQUEROR_CHESTS.filter(chest=>stacks>=chest.threshold).length;
  const chestTiers=G23_CONQUEROR_CHESTS.slice(progress.chestsOpened,chestsOpened).map(c=>c.tier);
  return {stacks,chestsOpened,radiantConversion:chestsOpened===15,receipts:[...progress.receipts,{battleId,tier,takedownIds:ids,stacksAdded,chestTiers}]};
}
/** Restoration recomputes all progress and enabled rewards; arbitrary counters are rejected. */
export function validateG23Conquest(progress:G23ConquestProgress):void {
  let expected=EMPTY_G23_CONQUEST;
  if(!progress||!Array.isArray(progress.receipts))throw new RangeError('Invalid Conqueror receipts');
  const seen=new Set<string>();
  for(const receipt of progress.receipts){
    if(seen.has(receipt.battleId))throw new RangeError('Duplicate Conqueror settlement');seen.add(receipt.battleId);
    const next=planG23Conquest(expected,receipt.battleId,receipt.tier,receipt.takedownIds);
    const actual=next.receipts.at(-1)!;
    if(Object.keys(receipt).length!==5||actual.stacksAdded!==receipt.stacksAdded||JSON.stringify(actual.takedownIds)!==JSON.stringify(receipt.takedownIds)||JSON.stringify(actual.chestTiers)!==JSON.stringify(receipt.chestTiers))throw new RangeError('Forged Conqueror receipt');
    expected=next;
  }
  if(Object.keys(progress).length!==4||progress.stacks!==expected.stacks||progress.chestsOpened!==expected.chestsOpened||progress.radiantConversion!==expected.radiantConversion)throw new RangeError('Forged Conqueror progress');
}
/** Source growth scales the tier's AD/AP bonus, rather than adding five percentage points. */
export function g23ConquerorBonusBps(baseBps:number,chestsOpened:number):number {
  integer(baseBps);integer(chestsOpened);if(chestsOpened>15)throw new RangeError('Unused Conqueror chest');
  return Math.floor(baseBps*(10000+G23_POLICY.conqueror.growthPerChestBps*chestsOpened)/10000);
}
export function g23WeightedIndex(word:number,weights:readonly number[]):number {
  validateSeed(word);const total=weights.reduce((n,w)=>n+integer(w),0);if(total<=0)throw new RangeError('Empty G2-3 weighted pool');
  const roll=Math.floor(word*total/2**32);let cumulative=0;
  for(let i=0;i<weights.length;i++){cumulative+=weights[i];if(roll<cumulative)return i;}
  throw new RangeError('Invalid G2-3 weighted pool');
}
/** One explicit lcg32-v1 word per candidate, remaining source weights renormalized after each draw. */
export function rollG23BlackMarket(tier:number,rngState:number){
  integer(tier,1);const market=G23_BLACK_MARKETS[tier-1];if(!market)throw new RangeError('Unknown Black Market');
  validateSeed(rngState);
  const remaining=market.options.filter(o=>o.weightBps>0),options:typeof remaining=[];
  let state=rngState;
  while(options.length<G23_POLICY.chemBaron.candidateCount&&remaining.length){
    const draw=nextRandom(state);state=draw.state;
    const index=g23WeightedIndex(draw.word,remaining.map(o=>o.weightBps));
    options.push(remaining.splice(index,1)[0]);
  }
  return {rngState:state,draws:options.length,table:market.table,options,...options[0]};
}
/** One lcg32 draw per Tactician's Crown on a won battle; returns the gold dropped (source PercentGoldChance). */
export function rollG23CrownGold(crowns:number,rngState:number){
  integer(crowns,1);const {chanceBps,gold}=G23_POLICY.crownGold;let state=rngState,dropped=0;
  for(let i=0;i<crowns;i++){const draw=nextRandom(state);state=draw.state;if(g23WeightedIndex(draw.word,[chanceBps,10000-chanceBps])===0)dropped+=gold;}
  return {rngState:state,draws:crowns,gold:dropped};
}
/** Triple's conditional second draw is consumed only when the first draw rolls Triple. */
export type G23HighRollerMod='rocket'|'shield'|'coin'|'blue-flamethrower'|'knockout-punch'|'quadruple-chomp'|'jackpot';
export function rollG23HighRoller(draw:()=>number):{readonly mod:G23HighRollerMod;readonly enhanced:boolean}{
  const first=g23WeightedIndex(draw(),G23_POLICY.highRoller.first);
  const enhanced=first===3,index=enhanced?g23WeightedIndex(draw(),G23_POLICY.highRoller.triple):first;
  return {mod:(enhanced?G23_POLICY.highRoller.tripleMods[index]:G23_POLICY.highRoller.mods[index]) as G23HighRollerMod,enhanced};
}
