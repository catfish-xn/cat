import {recordG23GrantEvidence} from './g2-3-grant-evidence';
import {findMechanicReceipt,grantMechanicItem} from './seat-mechanics';
import {readG23Progress} from './g2-3-state';
import {canonicalContent} from './content';
import type {G23RewardClaim} from './g2-3-rewards';
import {g23RewardAtoms} from './g2-3-rewards';
import type {G23JunkerPurchase} from './g2-3-junker';
import { EMPTY_G23_CHEM,advanceG23Economy,decideG23Market,type G23ChemProgress,type G23RewardBundle,type G23EconomyReceipt } from './g2-3-economy';
import type { MatchState,MatchEvent } from './match-types';
import { nextRandom } from './rng';
import { G23_POLICY } from './content/g2-3-policy';
import { G23_ACADEMY_LISTS } from './content/g2-3-academy';
import { EMPTY_G23_CONQUEST,validateG23Conquest,type G23ConquestProgress } from './g2-3-progress';
import { freezeContent } from './content/freeze';
import { deriveTraits } from './trait-snapshot';
export interface G23ItemReceipt {readonly id:string;readonly kind:'academy';readonly tier:number;readonly round:number;readonly itemId:string;readonly definitionId:string}
export interface G23MatchProgress {readonly epicCrowns?:readonly {readonly receiptId:string;readonly round:number}[];readonly version:'g2-3-progress-v1';readonly seed:number;readonly rngState:number;readonly rngDraws:number;readonly sponsored:readonly string[];readonly conquest:G23ConquestProgress;readonly chem:G23ChemProgress;readonly junkerRounds:number;readonly junkerPurchases:readonly G23JunkerPurchase[];readonly rewards:readonly G23RewardBundle[];readonly economyReceipts:readonly G23EconomyReceipt[];readonly rewardClaims:readonly G23RewardClaim[];readonly itemReceipts:readonly G23ItemReceipt[]}
export function createG23Progress(seed:number):G23MatchProgress{
 const draw=nextRandom((seed^G23_POLICY.seedXor)>>>0),sponsored=G23_ACADEMY_LISTS[Math.floor(draw.word*G23_ACADEMY_LISTS.length/2**32)];
 return {version:'g2-3-progress-v1',seed,rngState:draw.state,rngDraws:1,sponsored,conquest:EMPTY_G23_CONQUEST,chem:EMPTY_G23_CHEM,junkerRounds:0,junkerPurchases:[],rewards:[],economyReceipts:[],rewardClaims:[],itemReceipts:[]};
}
export function grantG23Academy(initial:MatchState):{state:MatchState;events:MatchEvent[]}{
 if(initial.phase!=='preparation'||!readG23Progress(initial))return {state:initial,events:[]};
 const tier=deriveTraits(initial.preparation,'player',undefined,undefined,initial.items).find(t=>t.traitId==='academy')?.tier??0;
 let state:MatchState=initial;const events:MatchEvent[]=[];
 for(const milestone of [3,4,5]){
  const id=`g23:academy:${milestone}`;
  if(tier<milestone||findMechanicReceipt(state,id))continue;
  const granted=grantMechanicItem(state,{receiptId:id,source:'academy',definitionId:readG23Progress(state)!.sponsored[milestone-3]});
  if(!granted.ok){events.push({type:'mechanicFailed',hook:'academy',reason:granted.reason});return {state,events};}
  state=recordG23GrantEvidence(state,granted.state,id);events.push(...granted.events);
 }
 return {state,events};
}
export function validateG23Progress(progress:G23MatchProgress,seed:number,round:number):void{
 const fail=(v:unknown)=>{if(!v)throw new RangeError('Invalid G2-3 match progression');};
 fail(progress&&Object.keys(progress).length===(progress.epicCrowns?14:13)&&progress.version==='g2-3-progress-v1'&&progress.seed===seed);
 if(progress.epicCrowns)fail(Array.isArray(progress.epicCrowns)&&progress.epicCrowns.length>0&&new Set(progress.epicCrowns.map(r=>r.receiptId)).size===progress.epicCrowns.length&&progress.epicCrowns.every(r=>typeof r.receiptId==='string'&&Number.isSafeInteger(r.round)&&r.round>=1&&r.round<=round));
 const initial=createG23Progress(seed);fail(JSON.stringify(progress.sponsored)===JSON.stringify(initial.sponsored));
 fail(Array.isArray(progress.economyReceipts));
 for(const r of progress.economyReceipts)fail(r.kind==='battle'?r.facts.round<=round:r.kind==='market'&&r.round<=round);
 const replay=replayG23Economy(seed,progress.economyReceipts);
 for(const k of ['rngState','rngDraws','chem','junkerRounds','rewards','economyReceipts','conquest'] as const)fail(canonicalContent(progress[k])===canonicalContent(replay[k]));
 fail(Array.isArray(progress.junkerPurchases)&&progress.junkerPurchases.length<=Math.floor(progress.junkerRounds/3));
 const paid=new Set<string>();
 for(let i=0;i<progress.junkerPurchases.length;i++){
 const r=progress.junkerPurchases[i];
 const eligible=progress.economyReceipts.filter(e=>e.kind==='battle'&&e.facts.round<r.round&&e.facts.rumbleStar>0).length;
 fail(eligible>=3*(i+1)&&(!i||r.round>=progress.junkerPurchases[i-1].round));
 fail(Object.keys(r).length===5&&r.id===`g23:junker:${i+1}`&&Number.isSafeInteger(r.round)&&r.round>=1&&r.round<=round&&typeof r.unitId==='string'&&r.unitId);
 const ids=['flamethrower','petricite-rod','repairing-microbots','self-destruct','tankbuster'];
 fail([...ids,'spare-parts','finishing-touch','junkyard-titan'].includes(r.upgrade)&&r.cost===(ids.includes(r.upgrade)?5:0));
 if(ids.includes(r.upgrade)||r.upgrade==='junkyard-titan'){fail(!paid.has(r.upgrade));paid.add(r.upgrade);}
 }
 fail(Array.isArray(progress.rewardClaims));const claimIds=new Set<string>();
 for(const r of progress.rewardClaims){
 const bundle=progress.rewards.find(b=>b.id===r.bundleId),atom=bundle&&g23RewardAtoms(bundle,seed).find(a=>a.id===r.atomId);
 fail(Object.keys(r).length===9&&bundle&&atom&&(r.id===`${r.atomId}:copy:${r.copy}`||bundle?.source==='black-market'&&r.id===bundle.id&&r.copy===0)&&!claimIds.has(r.id)&&Number.isSafeInteger(r.copy)&&r.copy>=0&&r.copy<atom!.quantity&&Number.isSafeInteger(r.round)&&r.round>=bundle!.round&&r.round<=round&&r.copy===progress.rewardClaims.slice(0,progress.rewardClaims.indexOf(r)).filter(c=>c.atomId===r.atomId).length&&r.kind===atom!.kind&&r.gold===atom!.gold&&(r.kind==='gold'?r.definitionId===''&&r.instanceId===null:atom!.options.includes(r.definitionId)));
 claimIds.add(r.id);
 }
 validateG23Conquest(progress.conquest);fail(Array.isArray(progress.itemReceipts));
 let previous=2;
 for(const receipt of progress.itemReceipts){
  fail(Object.keys(receipt).length===6&&receipt.kind==='academy'&&receipt.tier===previous+1&&receipt.tier<=5&&receipt.id===`g23:academy:${receipt.tier}`&&Number.isSafeInteger(receipt.round)&&receipt.round>=1&&receipt.round<=round&&/^item-[1-9][0-9]*$/.test(receipt.itemId)&&receipt.definitionId===initial.sponsored[receipt.tier-3]);previous=receipt.tier;
 }
 fail(new Set(progress.itemReceipts.map(r=>r.itemId)).size===progress.itemReceipts.length);
}

const economyReplayCache=new Map<string,G23MatchProgress>();
export function replayG23Economy(seed:number,receipts:readonly G23EconomyReceipt[]):G23MatchProgress{
 const key=`${seed}:${canonicalContent(receipts)}`,cached=economyReplayCache.get(key);
 if(cached)return cached;
 let replay=createG23Progress(seed),start=0;
 for(let n=receipts.length-1;n>0;n--){
  const prefix=economyReplayCache.get(`${seed}:${canonicalContent(receipts.slice(0,n))}`);
  if(prefix){replay=prefix;start=n;break;}
 }
 for(const r of receipts.slice(start)){
  if(r.kind==='battle')replay=advanceG23Economy(replay,r.facts).progress;
  else if(r.kind==='market')replay=decideG23Market(replay,r.offerId,r.take,r.round);
  else throw new RangeError('Invalid G2-3 match progression');
 }
 if(economyReplayCache.size>=128)economyReplayCache.delete(economyReplayCache.keys().next().value!);
 // Market reward descriptors can be shared content; never retain caller-owned receipts.
 const result=freezeContent(structuredClone(replay));economyReplayCache.set(key,result);return result;
}
