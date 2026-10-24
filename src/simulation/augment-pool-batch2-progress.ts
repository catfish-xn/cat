import type { CombatState } from './combat-types';
import type { Team } from './board';
import type { MatchState } from './match-types';
import type { AugmentGift } from './augment-gift-plan';
import { planAugmentGifts } from './augment-gift-plan';
import { readG23Progress } from './g2-3-state';
import { batch2Values, AUGMENT_BATCH2_ENABLED } from './content/augment-pool-batch2';
import { grantMechanicGold } from './seat-mechanics/grants';
export type Batch2BattleFacts=readonly {readonly definitionId:string;readonly count:number}[];
const counterIds=['rocket-collection','rocket-collection-plus','enforce','welcome-to-the-playground','scrap-recycling','betrayal','blood-brothers','blood-brothers-deaths'];
export function validateBatch2Facts(f:Batch2BattleFacts):void {
 if(!Array.isArray(f)||new Set(f.map(x=>x.definitionId)).size!==f.length||f.some(x=>!x||Object.keys(x).sort().join(',')!=='count,definitionId'||!counterIds.includes(x.definitionId)||!Number.isSafeInteger(x.count)||x.count<0||x.count>100000||['betrayal','welcome-to-the-playground'].includes(x.definitionId)&&x.count>1)||f.some(x=>x.definitionId==='blood-brothers')!==f.some(x=>x.definitionId==='blood-brothers-deaths'))throw new RangeError('Invalid batch2 battle facts');
}
/** Facts are projected from the authoritative combat, including inactive trait members and permanent emblems. */
export function batch2BattleFacts(combat:CombatState,team:Team):Batch2BattleFacts|undefined {
 const units=combat.units.filter(u=>u.team===team),ids=new Set(units.flatMap(u=>u.mechanics?.filter(m=>m.mechanic==='traitAugmentB2').map(m=>m.source.definitionId)??[]));
 const rows=counterIds.filter(id=>ids.has(id==='blood-brothers-deaths'?'blood-brothers':id)).map(definitionId=>{
  const members=units.filter(u=>u.mechanics?.some(m=>m.mechanic==='traitAugmentB2'&&m.source.definitionId===definitionId));let count=0;
  if(definitionId.startsWith('rocket-collection'))count=members.reduce((n,u)=>n+(u.batch2?.rockets??0),0);
  if(definitionId==='enforce')count=new Set(members.flatMap(u=>u.g22?.wanted??[]).filter(id=>(combat.openingDeaths??[]).some(d=>d.unitId===id))).size;
  if(definitionId==='scrap-recycling')count=members.reduce((n,u)=>n+(u.mechanics?.find(m=>m.mechanic==='traitAugmentB2'&&m.source.definitionId===definitionId)?.values.converted??0),0);
  if(definitionId==='welcome-to-the-playground')count=members.some(u=>u.batch2?.familyQualified)||members.filter(u=>u.alive&&u.hp>0).length>=batch2Values(definitionId).MinNumFamilyMembers?1:0;
  // Silco casts and Vander deaths accrue to the player even when the partner was already dead (P-AG5).
  if(definitionId==='blood-brothers')count=units.filter(u=>u.definitionId==='silco'&&u.mechanics?.some(m=>m.mechanic==='traitAugmentB2'&&m.source.definitionId==='blood-brothers')).reduce((n,u)=>n+(u.batch2?.casts??0),0);
  if(definitionId==='blood-brothers-deaths')count=units.filter(u=>u.definitionId==='vander'&&u.mechanics?.some(m=>m.mechanic==='traitAugmentB2'&&m.source.definitionId==='blood-brothers')).reduce((n,u)=>n+(u.batch2?.deaths??0),0);
  if(definitionId==='betrayal')count=members.some(u=>(u.batch2?.kills??0)>=batch2Values(definitionId).NumKills)?1:0;
  return {definitionId,count};
 });return rows.length?rows:undefined;
}
/** P-AG4 (P, 2026-10-24): research does not specify in-combat delivery order.
 * Counter gifts/gold are paid after authoritative settlement; shimmer save is immediate.
 * Reason: reuse authenticated battle facts and existing grant receipts without a
 * second combat reward authority. Family/component draws follow P-AG1.
 * Counter rewards are derived each time from immutable battle receipts; acquisition and reward share one grant ledger. */
export function batch2RewardPlan(state:MatchState):AugmentGift[] {
 const battles=readG23Progress(state)?.economyReceipts.filter(r=>r.kind==='battle')??[];
 return state.augments.flatMap(a=>{
  if(!AUGMENT_BATCH2_ENABLED[a.definitionId])return [];
  const v=batch2Values(a.definitionId),gifts:AugmentGift[]=[];let total=0,awarded=0;
  for(const r of battles){if(r.kind!=='battle'||r.facts.round<a.acquiredRound)continue;
   const count=r.facts.batch2?.find(x=>x.definitionId===a.definitionId)?.count??0;total+=count;
   const earned=a.definitionId.startsWith('rocket-collection')?Math.min(v.MaxItems,Math.floor(total/v.RocketDamageThreshold))
    :a.definitionId==='scrap-recycling'?Math.min(v.MaxComponents,Math.floor(total/v.NumScrapItemsConverted)):total;
   for(;awarded<earned;awarded++){
    const spec=a.definitionId.startsWith('rocket-collection')?{kind:'item' as const,definitionId:'TFT4_Item_OrnnTheCollector'}
     :a.definitionId==='scrap-recycling'?{kind:'random-item' as const,pool:'component' as const,count:1}
     :a.definitionId==='betrayal'?{kind:'unit' as const,definitionId:'maddie'}
     :a.definitionId==='welcome-to-the-playground'?{kind:'random-unit-pool' as const,definitions:['vander','powder','violet'],count:1}:null;
    if(spec)gifts.push(...planAugmentGifts(state,{...a,choiceId:JSON.stringify([a.choiceId,'batch2-reward',awarded]),acquiredRound:r.facts.round},[spec]));
   }
  }return gifts;
 });
}
function goldPlan(state:MatchState){
 const market=state.augments.find(a=>a.definitionId==='crimson-pact');
 const marketPlan=(state.seatMechanics?.receipts??[]).flatMap(r=>market&&r.kind==='choice'&&r.choiceKind==='blackMarket'&&r.source==='black-market'&&r.skipped&&r.round>=market.acquiredRound?[{receiptId:JSON.stringify(['augment-pool-batch2',market.choiceId,'market',r.receiptId]),source:'augment-pool-batch2',amount:batch2Values(market.definitionId).Gold,round:r.round}]:[]);
 const a=state.augments.find(a=>a.definitionId==='enforce');if(!a)return marketPlan;
 let total=0,awarded=0;const plan:{receiptId:string;source:string;amount:number;round:number}[]=[];const v=batch2Values('enforce');
 for(const r of readG23Progress(state)?.economyReceipts??[]){if(r.kind!=='battle'||r.facts.round<a.acquiredRound)continue;
  total+=r.facts.batch2?.find(x=>x.definitionId==='enforce')?.count??0;
  while(awarded<Math.floor(total/v.WantedEnemyBreakpoint))plan.push({receiptId:JSON.stringify(['augment-pool-batch2',a.choiceId,'enforce',awarded++]),source:'augment-pool-batch2',amount:v.BonusGoldAmount,round:r.facts.round});
 }return [...marketPlan,...plan];
}
export function drainBatch2Gold(initial:MatchState):MatchState {
 let state=initial;for(const p of goldPlan(state)){
  if(state.seatMechanics?.receipts.some(r=>r.receiptId===p.receiptId))continue;
  const result=grantMechanicGold(state,p);if(!result.ok)throw new RangeError(result.reason);state=result.state;
 }return state;
}
export function validateBatch2Gold(state:MatchState):void {
 const plan=goldPlan(state),receipts=state.seatMechanics?.receipts??[];
 for(const r of receipts.filter(r=>r.source==='augment-pool-batch2'||r.receiptId.startsWith('["augment-pool-batch2",'))){
  const p=plan.find(p=>p.receiptId===r.receiptId);
  if(!p||r.kind!=='gold'||r.source!==p.source||r.amount!==p.amount||r.round!==p.round)throw new RangeError('Invalid batch2 gold authority');
 }
 for(const p of plan)if(!receipts.some(r=>r.receiptId===p.receiptId))throw new RangeError('Missing batch2 gold receipt');
}
