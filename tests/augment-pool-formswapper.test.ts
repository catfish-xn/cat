import type { MatchState } from '../src/simulation/match-types';
import { grantMechanicConsumable } from '../src/simulation/seat-mechanics/grants';
import { room, accept, conserved } from './tp-helpers';
import { runSharedMatchCommand } from '../src/simulation/shared-pool';
import { expect, it } from 'vitest';
import { createMatch, selectChoice, buyUnit, rerollShop, buyXp, sellUnit, useConsumable } from '../src/simulation/match';
import { accepted, reachRound, freeze } from './match-helpers';
import { generateChoices } from '../src/simulation/choices';
import { augmentCandidates, resolveAugmentTier } from '../src/simulation/augment-offers';
import { appendResourceProvenance } from '../src/simulation/resource-provenance';
import { formSwapperGiftPlan, validateFormSwapperSelection } from '../src/simulation/augment-pool-formswapper';
import { drainBatch1Gifts } from '../src/simulation/augment-pool-grants';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';

// First matching cheap 2-1 draw from the former bounded search; assert both the predicate and public offer.
let acquired: ReturnType<typeof createMatch> | undefined;
function acquire(){
 if(acquired)return acquired;
 const seed=4,id='why-not-both',initial=createMatch(seed);
 expect(generateChoices(augmentCandidates(resolveAugmentTier(initial,'round:2-1:augment'),[],[],null,{node:'2-1',fieldedTraits:[],blocked:[]}),initial.choiceRngState).offers).toContain(id);
 const before=reachRound('2-1',false,seed),c=before.pendingChoice!;
 expect(c.offers).toContain(id);
 return acquired=freeze(accepted(selectChoice(before,c.choiceId,c.generation,id)));
}
const upgrade=(id='swain',toStar=3 as 2|3)=>({type:'unitUpgraded' as const,definitionId:id,survivorId:'a',consumedIds:['b','c'],fromStar:(toStar-1) as 1|2,toStar,location:{kind:'bench' as const,slot:0}});
it('public selection records its exact position, grants source champions and restores; missing/duplicate/misbound marker fails',()=>{
 const s=acquire();validateFormSwapperSelection(s);
 expect(s.preparation.units.map(u=>u.definitionId)).toEqual(expect.arrayContaining(['swain','gangplank']));
 expect(restoreMatch(serializeMatch(s))).toEqual(s);
 for(const mutation of ['missing','duplicate','choice','round']){
  const forged=structuredClone(s) as any,entries=forged.resourceProvenance.entries,i=entries.findIndex((e:any)=>e.kind==='form-swapper-selected');
  if(mutation==='missing'){entries.splice(i,1);entries.forEach((e:any,n:number)=>e.sequence=n);}
  if(mutation==='duplicate')entries.push({...entries[i],sequence:entries.length});
  if(mutation==='choice')entries[i].choiceId='forged';
  if(mutation==='round')entries[i].roundId='1-4';
  expect(()=>restoreMatch(serializeMatch(forged))).toThrow();
 }
});
it('ordered upgrade facts exclude same-round pre-selection triples and direct 3-star births, count each real later triple once',()=>{
 // Deliberately isolated provenance projection vectors, not fabricated valid saves.
 const base=createMatch(42),a={definitionId:'why-not-both',choiceId:'test',acquiredRound:1};
 let p=appendResourceProvenance(base.resourceProvenance,base.roundDefinitionId,{kind:'unit-upgraded',acquisitionSequence:0,event:upgrade()});
 p=appendResourceProvenance(p,base.roundDefinitionId,{kind:'form-swapper-selected',choiceId:'test'});
 const s={...base,augments:[a],resourceProvenance:p};expect(formSwapperGiftPlan(s)).toEqual([]);
 p=appendResourceProvenance(p,base.roundDefinitionId,[
  {kind:'unit-upgraded',acquisitionSequence:0,event:upgrade('swain',2)},
  {kind:'unit-upgraded',acquisitionSequence:0,event:upgrade('darius')},
  {kind:'unit-acquired',unitId:'direct',source:{kind:'mechanic',receiptId:'3-star-birth'}},
  {kind:'unit-upgraded',acquisitionSequence:0,event:upgrade()},
  {kind:'carousel-preparation-settled',receiptIds:[],claimedUnitIds:[],upgrades:[upgrade('gangplank')]},
 ]);
 const gifts=formSwapperGiftPlan({...s,resourceProvenance:p});
 expect(gifts.map(g=>[g.definitionId,g.starLevel])).toEqual([['swain',2],['gangplank',2]]);
 expect(new Set(gifts.map(g=>g.receiptId)).size).toBe(2);
 expect(formSwapperGiftPlan({...s,resourceProvenance:p})).toEqual(gifts);
});
function purchaseVector(){
 const s=acquire();
 return {...s,gold:1000,preparation:{...s.preparation,units:[0,1,2,3,4].map(i=>({id:`v${i}`,definitionId:'swain',team:'player' as const,starLevel:2 as const,location:{kind:'bench' as const,slot:i}}))},shop:{...s.shop,slots:[{status:'available' as const,definitionId:'swain'}]}};
}
it('buying a real triple rewards a 2-star copy, drains resulting chained triples and never pays twice',()=>{
 const before=purchaseVector();
 // Make the shop birth 1-star and complete a 1->2->3 chain with two other 1-stars.
 const s={...before,preparation:{...before.preparation,units:[...before.preparation.units,...[5,6].map(i=>({id:`v${i}`,definitionId:'swain',team:'player' as const,starLevel:1 as const,location:{kind:'bench' as const,slot:i}}))]}};
 const after=accepted(buyUnit(s,0,s.shop.generation));
 const gifts=formSwapperGiftPlan(after);expect(gifts).toHaveLength(2);
 expect(gifts.every(g=>g.starLevel===2)).toBe(true);
 expect(after.preparation.units.filter(u=>u.starLevel===3)).toHaveLength(2);
 expect(after.preparation.units.filter(u=>u.starLevel===2)).toHaveLength(2);
 expect(drainBatch1Gifts(after)).toBe(after);
 expect([after.rngState,after.choiceRngState,after.rewardRngState]).toEqual([s.rngState,s.choiceRngState,s.rewardRngState]);
 const rejected=buyUnit(after,0,after.shop.generation);expect(rejected.ok).toBe(false);expect(rejected.state).toBe(after);
});
it('different frozen forms of the same champion get exactly 24 AP/armor/MR and 24% AD; same form and different champions do not',()=>{
 const base=createMatch(42);
 function snapshot(other:string,row:number,enabled:boolean){
  const preparation={...base.preparation,units:[{id:'front',definitionId:'swain',team:'player' as const,starLevel:1 as const,location:{kind:'board' as const,cell:{col:0,row:4}}},{id:'back',definitionId:other,team:'player' as const,starLevel:1 as const,location:{kind:'board' as const,cell:{col:1,row}}}]};
  return buildStrategySnapshot({...base,preparation,augments:enabled?[{definitionId:'why-not-both',choiceId:'test',acquiredRound:1}]:[]}).units;
 }
 for(const [other,row,applied] of [['swain',7,true],['swain',5,false],['gangplank',7,false]] as const){
  const before=snapshot(other,row,false),after=snapshot(other,row,true);
  for(let i=0;i<2;i++){
   expect(after[i].abilityPower!-before[i].abilityPower!).toBe(applied?24:0);
   expect(after[i].stats.armor-before[i].stats.armor).toBe(applied?24:0);
   expect(after[i].stats.magicResist-before[i].stats.magicResist).toBe(applied?24:0);
   expect(after[i].stats.attack).toBe(applied?Math.floor(before[i].stats.attack*1.24):before[i].stats.attack);
  }
 }
});
it('real shop acquisitions restore after a triple, reject altered reward stars, and sale never reissues it',()=>{
 // Funded preparation vector: shop/XP/purchase/upgrade commands are real;
 // this verifies resource authentication, not a full-match economy route.
 let s={...acquire(),gold:1500};
 while(s.level<6)s=accepted(buyXp(s));
 for(let attempts=0;!formSwapperGiftPlan(s).length&&attempts<400;attempts++){
  for(let slot=0;slot<5;slot++){const offer=s.shop.slots[slot];if(offer.status==='available'&&offer.definitionId==='swain')s=accepted(buyUnit(s,slot,s.shop.generation));}
  if(!formSwapperGiftPlan(s).length)s=accepted(rerollShop(s));
 }
 expect(formSwapperGiftPlan(s)).toHaveLength(1);expect(restoreMatch(serializeMatch(s))).toEqual(s);
 const gift=formSwapperGiftPlan(s)[0],receipt=s.seatMechanics!.receipts.find(r=>r.receiptId===gift.receiptId)!;
 expect(receipt).toMatchObject({kind:'unit',starLevel:2,definitionId:'swain'});
 const changed=structuredClone(s) as any;changed.seatMechanics.receipts.find((r:any)=>r.receiptId===gift.receiptId).starLevel=1;
 expect(()=>restoreMatch(serializeMatch(changed))).toThrow();
 if(receipt.kind!=='unit'||!receipt.unitId)throw Error('missing reward unit');
 const after=accepted(sellUnit(s,receipt.unitId));expect(drainBatch1Gifts(after)).toBe(after);expect(restoreMatch(serializeMatch(after))).toEqual(after);
});
it('full bench escrows a fixed 2-star plan and freeing capacity pays it once',()=>{
 const base=acquire(),p=appendResourceProvenance(base.resourceProvenance,base.roundDefinitionId,{kind:'unit-upgraded',acquisitionSequence:0,event:upgrade()});
 const units=Array.from({length:9},(_,i)=>({id:`full${i}`,definitionId:'darius',team:'player' as const,starLevel:3 as const,location:{kind:'bench' as const,slot:i}}));
 const full={...base,resourceProvenance:p,preparation:{...base.preparation,units}};
 const gift=formSwapperGiftPlan(full)[0];expect(drainBatch1Gifts(full)).toBe(full);
 const freed={...full,preparation:{...full.preparation,units:units.slice(1)}},after=drainBatch1Gifts(freed);
 expect(after.seatMechanics!.receipts.find(r=>r.receiptId===gift.receiptId)).toMatchObject({definitionId:'swain',starLevel:2});
 expect(drainBatch1Gifts(after)).toBe(after);
});
it('online triple reward reserves three shared copies on orb claim and preserves pool conservation',()=>{
 // Isolated projection/claim vector; no claim of a complete multiplayer route.
 const initial=room(undefined,2,42),base=initial.states[0],choiceId='online-vector';
 const p=appendResourceProvenance(base.resourceProvenance,base.roundDefinitionId,[{kind:'form-swapper-selected',choiceId},{kind:'unit-upgraded',acquisitionSequence:0,event:upgrade()}]);
 let s=drainBatch1Gifts({...base,phase:'preparation',pendingChoice:null,augments:[{definitionId:'why-not-both',choiceId,acquiredRound:1}],resourceProvenance:p} as MatchState);
 const gift=formSwapperGiftPlan(s)[0],receipt=s.seatMechanics!.receipts.find(r=>r.receiptId===gift.receiptId)!;
 expect(receipt).toMatchObject({resolution:'orb',starLevel:2});
 if(receipt.kind!=='unit'||receipt.resolution!=='orb')throw Error('missing orb');
 const before=initial.pool.available.swain;
 const result=accept(runSharedMatchCommand(initial.pool,s,{type:'claimOrb',round:s.round,orbId:receipt.orbId!}));
 expect(result.pool.available.swain).toBe(before-3);conserved(result.pool,[result.state,initial.states[1]]);
 expect(drainBatch1Gifts(result.state)).toBe(result.state);
});

it('a consumed champion duplicator triggers the same authenticated triple plan once',()=>{
 const base=purchaseVector(),units=[...base.preparation.units,...[5,6].map(i=>({id:`one${i}`,definitionId:'swain',team:'player' as const,starLevel:1 as const,location:{kind:'bench' as const,slot:i}}))];
 const granted=grantMechanicConsumable({...base,preparation:{...base.preparation,units}},{receiptId:'test-copy-tool',source:'test',definitionId:'TFT_Consumable_NeekosHelp'});
 if(!granted.ok)throw Error(granted.reason);
 const tool=granted.state.consumables.at(-1)!;
 const after=accepted(useConsumable(granted.state,tool.consumableId,{kind:'unit',unitId:'one5'}));
 expect(formSwapperGiftPlan(after)).toHaveLength(2);expect(drainBatch1Gifts(after)).toBe(after);
 const duplicate=useConsumable(after,tool.consumableId,{kind:'unit',unitId:'one5'});
 expect(duplicate.ok).toBe(false);expect(duplicate.state).toBe(after);
});
