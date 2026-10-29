import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FIELDED_LEGS, fieldedRoute } from './augment-stage-helpers';
import { rerollAugment, selectChoice, startMatchCombat, stepMatch, buyUnit, nextRound, buyXp, deployMatchUnit } from '../src/simulation/match';
import { accepted, fieldBench, resolveM5Choices } from './match-helpers';
import { drainBatch5H8Deaths } from '../src/simulation/augment-pool-batch5-h8-deaths';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { AUGMENT_OFFER_RULES, AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { augmentCandidates } from '../src/simulation/augment-offers';
import { AUGMENT_BATCH5_H8 } from '../src/simulation/content/augment-pool-batch5-h8';
import { equipArmyItems } from './fixtures/army-items';
import { grantMechanicUnit } from '../src/simulation/seat-mechanics/grants';
const RESEARCH_FILE='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
it.skipIf(!existsSync(RESEARCH_FILE))('Malicious Monetization archive numbers',()=>{
 const rows=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')) as any[];
 expect(rows.find(r=>r.apiName==='TFT_Augment_MirroredMonetization').effects).toEqual({GoldContained:2,PercCost:2,rounds:3});
 expect(AUGMENT_BATCH5_H8['mirrored-monetization'].source.values).toEqual(rows.find(r=>r.apiName==='TFT_Augment_MirroredMonetization').effects);
 expect((AUGMENT_OFFER_RULES.nodeBans as Readonly<Record<string,readonly string[]>>)[AUGMENT_POOL_API_NAMES['mirrored-monetization']]).toEqual(['2-1','3-2']);
});
it.each(['2-1','3-2','4-2'])('only offers Monetization at the allowed node %s',node=>{
 expect(augmentCandidates('gold',[],[],null,{node,fieldedTraits:[],blocked:[]}).includes('mirrored-monetization')).toBe(node==='4-2');
});
it.each(FIELDED_LEGS)('reaches %s with real commands',leg=>{expect(fieldedRoute(11,leg).roundDefinitionId).toBe(leg);});
let state:import('../src/simulation/match').MatchState;
let checkpoint:string;
it('serializes the 4-2 checkpoint',()=>{
 const grant=grantMechanicUnit(fieldedRoute(11,'4-2'),{receiptId:'h8-kill-witness',source:'test',definitionId:'viktor',starLevel:3});
 expect(grant.ok).toBe(true);if(!grant.ok)throw Error(grant.reason);checkpoint=serializeMatch(grant.state);
});
it('finds and selects the 4-2 offer',()=>{
 let s=restoreMatch(checkpoint);for(let slot=0;slot<3&&!s.pendingChoice!.offers.includes('mirrored-monetization');slot++){const c=s.pendingChoice!;s=accepted(rerollAugment(s,c.choiceId,c.generation,slot));}
 expect(s.pendingChoice!.offers).toContain('mirrored-monetization');
 const c=s.pendingChoice!,gold=s.gold;state=accepted(selectChoice(s,c.choiceId,c.generation,'mirrored-monetization'));expect(state.gold).toBe(gold+2);
});

it('pays 2 for each real enemy champion death after the fight',()=>{
 const acquiredRound=state.round,events:import('../src/simulation/match-types').MatchEvent[]=[];
 for(let n=0;n<3;n++){
  state=resolveM5Choices(state);
  for(let i=0;i<state.shop.slots.length;i++){const r=buyUnit(state,i,state.shop.generation);if(r.ok)state=r.state;}
  while(state.level<8&&state.gold>=4){const r=buyXp(state);if(!r.ok)break;state=r.state;}
  state=resolveM5Choices(state);
  state=equipArmyItems(resolveM5Choices(fieldBench(state)));
  const witness=state.preparation.units.find(u=>u.definitionId==='viktor')!;
  if(witness.location.kind!=='board'){
   const front=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='board')!;
   state=resolveM5Choices(accepted(deployMatchUnit(state,witness.id,front.location)));
  }
  if(state.phase==='preparation'){
   const started=startMatchCombat(state);if(started.ok)events.push(...started.events);state=accepted(started);while(state.phase==='combat'){const step=stepMatch(state);events.push(...step.events);state=step.state;}
  }
  const paid=state.seatMechanics?.receipts.some(r=>r.source==='augment-batch5-h8-monetization');
  if(paid||state.phase==='gameOver'||state.round>=acquiredRound+2)break;
  state=resolveM5Choices(state);state=accepted(nextRound(state,state.round));
 }
 const deaths=requireAugmentFacts(state,'deaths',state.round).flatMap(f=>f.deaths).filter(d=>d.team==='enemy'&&d.ordinaryHero);
 expect(deaths.length,JSON.stringify(requireAugmentFacts(state,'deaths',state.round).flatMap(f=>f.deaths).map(d=>({team:d.team,id:d.definitionId,ordinary:d.ordinaryHero})))).toBeGreaterThan(0);
 const receipts=state.seatMechanics!.receipts.filter(r=>r.source==='augment-batch5-h8-monetization');
 expect(receipts).toHaveLength(1);expect(receipts[0]).toMatchObject({kind:'gold',amount:2*deaths.length});
 expect(events.filter(e=>e.type==='mechanicGranted'&&e.receipt.receiptId===receipts[0].receiptId)).toHaveLength(1);
});
let text:string, restored:import('../src/simulation/match').MatchState;
it('serializes the death payout',()=>{text=serializeMatch(state);});
it('restores the death payout',()=>{restored=restoreMatch(text);});
it('preserves the payout after restore',()=>{expect(serializeMatch(restored)).toBe(text);});
it('rejects edited death evidence at all restore entries',()=>{
 const bad=structuredClone(state),fact=bad.augmentHistory!.facts.find(f=>f.kind==='deaths'&&f.deaths.length)!;
 if(fact.kind==='deaths')(fact.deaths[0] as any).ordinaryHero=false;
 expect(()=>restoreMatch(bad)).toThrow();expect(()=>restoreMatch(JSON.stringify(bad))).toThrow();expect(()=>serializeMatch(bad)).toThrow();
});

it('counts separate deaths after revival, excludes summons and allies, and pays once',()=>{
 const s=structuredClone(state) as any;
 s.seatMechanics.receipts=s.seatMechanics.receipts.filter((r:any)=>r.source!=='augment-batch5-h8-monetization');
 const rows=s.augmentHistory.facts.filter((f:any)=>f.kind==='deaths'&&f.round===s.round);
 const original=rows.flatMap((f:any)=>f.deaths).find((d:any)=>d.team==='enemy'&&d.ordinaryHero);
 expect(original).toBeDefined();
 for(const row of rows)row.deaths=[];
 rows[rows.length-1].deaths=[{...original,eventSeq:100}, {...original,eventSeq:101},
  {...original,eventSeq:102,ordinaryHero:false}, {...original,eventSeq:103,team:'player'}];
 const paid=drainBatch5H8Deaths(s);
 expect(paid.gold).toBe(s.gold+4);
 expect(paid.seatMechanics!.receipts.filter(r=>r.source==='augment-batch5-h8-monetization')).toMatchObject([{kind:'gold',amount:4}]);
 expect(drainBatch5H8Deaths(paid)).toBe(paid);
});

it('does not pay for deaths on the fourth natural round',()=>{
 const s=structuredClone(state) as any,owner=s.augments.find((a:any)=>a.definitionId==='mirrored-monetization');
 owner.acquiredRound=s.round-3;
 s.seatMechanics.receipts=s.seatMechanics.receipts.filter((r:any)=>r.source!=='augment-batch5-h8-monetization');
 const rows=s.augmentHistory.facts.filter((f:any)=>f.kind==='deaths');
 const template=rows.find((f:any)=>f.deaths.length),death=template.deaths.find((d:any)=>d.team==='enemy'&&d.ordinaryHero);
 for(const row of rows)row.deaths=[];
 for(const r of s.roundResults.filter((r:any)=>r.round>=owner.acquiredRound&&r.round<s.round&&r.roundKind!=='supply'))
  if(!rows.some((f:any)=>f.round===r.round))s.augmentHistory.facts.push({...template,round:r.round,roundId:r.roundId,deaths:[]});
 s.augmentHistory.facts.push({...template,round:s.round,roundId:s.roundDefinitionId,deaths:[death]});
 expect(drainBatch5H8Deaths(s)).toBe(s);
});
