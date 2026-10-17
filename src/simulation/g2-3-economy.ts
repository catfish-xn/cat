import { G23_CONQUEROR_CHESTS,G23_BLACK_MARKETS,g23ConquerorReward } from './content/g2-3-policy';
import { G23_TRAIT_SOURCE } from './content/g2-3-trait-source';
import { rollG23BlackMarket,planG23Conquest } from './g2-3-progress';
import type { G23MatchProgress } from './g2-3-match-progress';
import {validateItemGoldPayouts,type ItemGoldPayout} from './g2-4b-item-gold';
export interface G23BattleFacts {
 readonly itemGoldPayouts?:readonly ItemGoldPayout[];
 readonly battleId:string;readonly round:number;readonly roundKind:'pve'|'pvp';readonly result:'win'|'loss'|'draw';
 readonly conquerorTier:number;readonly conquestTakedowns:readonly string[];readonly chemBaronTier:number;
 readonly alliedDeaths:number;readonly rumbleStar:0|1|2|3;readonly highRollerGold:number;
}
export interface G23RewardBundle {readonly id:string;readonly round:number;readonly source:'conqueror'|'black-market';readonly tier:number;readonly reward:Readonly<Record<string,unknown>>}
export interface G23MarketOffer {readonly id:string;readonly tier:number;readonly optionId:string;readonly round:number}
export interface G23ChemProgress {readonly shimmer:number;readonly losses:number;readonly skips:number;readonly offeredThrough:number;readonly offer:G23MarketOffer|null}
export interface G23EconomyAction {readonly kind:'battle';readonly facts:G23BattleFacts;readonly gold:number;readonly bundles:readonly string[]}
export interface G23EconomyDecision {readonly kind:'market';readonly offerId:string;readonly take:boolean;readonly round:number}
export type G23EconomyReceipt=G23EconomyAction|G23EconomyDecision;
export function validateG23BattleFacts(f:G23BattleFacts):void{
 const int=(n:number,max:number)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
 if(!f||Object.keys(f).length!==(f.itemGoldPayouts===undefined?10:11)||typeof f.battleId!=='string'||!f.battleId||!int(f.round,100)||f.round===0||!['pve','pvp'].includes(f.roundKind)||!['win','loss','draw'].includes(f.result)
 ||![0,2,4,6,9].includes(f.conquerorTier)||![0,3,4,5,6,7].includes(f.chemBaronTier)||!int(f.alliedDeaths,30)||!int(f.rumbleStar,3)||!int(f.highRollerGold,10000)||f.highRollerGold%3!==0
 ||!Array.isArray(f.conquestTakedowns)||f.conquestTakedowns.length>30||new Set(f.conquestTakedowns).size!==f.conquestTakedowns.length||f.conquestTakedowns.some(id=>typeof id!=='string'||!id)||!f.conquerorTier&&f.conquestTakedowns.length)throw new RangeError('Invalid G23 battle facts');
 if(f.itemGoldPayouts!==undefined)validateItemGoldPayouts(f.itemGoldPayouts,f.battleId);
}
export const EMPTY_G23_CHEM:G23ChemProgress=Object.freeze({shimmer:0,losses:0,skips:0,offeredThrough:0,offer:null});
export function advanceG23Economy(p:G23MatchProgress,f:G23BattleFacts):{progress:G23MatchProgress;gold:number}{
 validateG23BattleFacts(f);
 if(p.economyReceipts.some(r=>r.kind==='battle'&&r.facts.battleId===f.battleId))return {progress:p,gold:0};
 if(p.economyReceipts.some(r=>r.kind==='battle'&&r.facts.round>=f.round))throw new RangeError('Unordered G23 settlement');
 const conquest=f.conquerorTier?planG23Conquest(p.conquest,f.battleId,f.conquerorTier,f.conquestTakedowns):p.conquest;
 let gold=f.highRollerGold+(f.itemGoldPayouts?.length??0);const rewards=[...p.rewards],ids:string[]=[];
 for(const chest of G23_CONQUEROR_CHESTS.slice(p.conquest.chestsOpened,conquest.chestsOpened)){
  const id=`g23:conqueror:${chest.tier}`,{Gold=0,...reward}=g23ConquerorReward(chest);
  gold+=Gold as number;ids.push(id);rewards.push({id,round:f.round,source:'conqueror',tier:chest.tier,reward});
 }
 let chem=p.chem,rngState=p.rngState,rngDraws=p.rngDraws;
 const losses=f.roundKind==='pvp'?(f.result==='loss'?chem.losses+1:0):chem.losses;
 if(f.chemBaronTier){
  const v=G23_TRAIT_SOURCE['chem-baron'].tiers.find(t=>t.threshold===f.chemBaronTier)!.values;
  const gain=f.roundKind==='pve'?v.ShimmerPerRound_PVE+f.alliedDeaths*v.ShimmerPerDeath_PVE:losses>=v.MinStreakLength?v.ShimmerPerCombatStreaking:v.ShimmerPerCombat;
  const shimmer=chem.shimmer+gain,tier=Math.min(8,Math.floor(shimmer/100));
  chem={...chem,shimmer,losses};
  if(!chem.offer&&tier>chem.offeredThrough){
   const roll=rollG23BlackMarket(tier,rngState);rngState=roll.rngState;rngDraws++;
   chem={...chem,offeredThrough:tier,offer:{id:`g23:market:${f.battleId}:${tier}`,tier,optionId:roll.id,round:f.round}};
  }
 }else chem={...chem,losses};
 const junkerRounds=p.junkerRounds+(f.rumbleStar?1:0);
 const receipt:G23EconomyAction={kind:'battle',facts:structuredClone(f),gold,bundles:ids};
 return {progress:{...p,conquest,chem,junkerRounds,rngState,rngDraws,rewards,economyReceipts:[...p.economyReceipts,receipt]},gold};
}
export function decideG23Market(p:G23MatchProgress,id:string,take:boolean,round:number):G23MatchProgress{
 const offer=p.chem.offer;if(!offer||offer.id!==id||typeof take!=='boolean'||round<offer.round)throw new RangeError('Stale G23 market');
 const option=G23_BLACK_MARKETS[offer.tier-1].options.find(o=>o.id===offer.optionId)!;
 return {...p,chem:{...p.chem,offer:null,shimmer:take?0:p.chem.shimmer,offeredThrough:take?0:p.chem.offeredThrough,skips:p.chem.skips+(take?0:1)},
  rewards:take?[...p.rewards,{id:offer.id,round,source:'black-market',tier:offer.tier,reward:option.reward}]:p.rewards,
  economyReceipts:[...p.economyReceipts,{kind:'market',offerId:id,take,round}]};
}
