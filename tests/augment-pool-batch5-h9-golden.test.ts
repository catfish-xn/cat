import { beforeAll, expect, it } from 'vitest';
import { buyXp, deployMatchUnit, equipItem, nextRound, rerollShop, selectChoice, selectAnomalyTarget, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { equipArmyItems } from './fixtures/army-items';
import { grantMechanicUnit } from '../src/simulation/seat-mechanics/grants';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { freeRerollsAvailable } from '../src/simulation/free-rerolls';
import { goldenFindGoldPlan, GOLDEN_FIND_SOURCE, settleBatch5H9History } from '../src/simulation/augment-pool-batch5-h9';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { accepted, fieldBench, resolveM5Choices } from './match-helpers';
import { offerFor } from './augment-stage-helpers';
import { augmentPool, freeRerollCredits } from './fixtures/m5/oracle.g2.cjs';

let state: MatchState, acquired: MatchState, paid: MatchState, priorCredits: number;
let paidSerialized: string;
let anomalyTarget:string;
let deployment: MatchState['preparation']['units'];
beforeAll(() => {
  // A genuine legacy checkpoint bounds the authenticated trace to this acquisition onward.
  const before=offerFor('a-golden-find');
  const grant=grantMechanicUnit(before,{receiptId:'h9-kill-witness',source:'test',definitionId:'viktor',starLevel:3});
  expect(grant.ok).toBe(true);if(!grant.ok)throw Error(grant.reason);
  const open = restoreMatch(serializeMatch(grant.state)), c = open.pendingChoice!;
  anomalyTarget=open.preparation.units.find(u=>u.definitionId==='viktor')!.id;
  expect(c.offers).toContain('a-golden-find');
  priorCredits = freeRerollsAvailable(open);
  state = acquired = accepted(selectChoice(open,c.choiceId,c.generation,'a-golden-find'));
});
it('offers Golden Find only at 4-2 in the production and independent pools',()=>{
  for(const node of ['2-1','3-2','4-2']){
    expect(augmentOfferAllowed('a-golden-find',[],{node,fieldedTraits:[],blocked:[]})).toBe(node==='4-2');
    expect(augmentPool('gold',[],[],`round:${node}:augment`,[]).includes('a-golden-find')).toBe(node==='4-2');
  }
});
it('grants ten spendable shop rerolls immediately, survives restore and refuses duplicate selection',()=>{
  expect(freeRerollsAvailable(acquired)).toBe(priorCredits+10);expect(freeRerollCredits(acquired)).toBe(priorCredits+10);
  let spent=acquired;
  for(let i=0;i<10;i++){const before=spent;spent=accepted(rerollShop(spent));expect(spent.gold).toBe(before.gold);}
  expect(freeRerollsAvailable(spent)).toBe(priorCredits);expect(restoreMatch(serializeMatch(spent))).toEqual(spent);
  const failed=selectChoice(acquired,acquired.augments.at(-1)!.choiceId,0,'a-golden-find');expect(failed.ok).toBe(false);expect(failed.state).toBe(acquired);
});
it('prepares a real army using paid XP and inventory equipment',()=>{
  while(state.gold>=4&&state.level<8)state=accepted(buyXp(state));
  state=fieldBench(state);
  state=equipArmyItems(state,anomalyTarget);
  for(const item of state.items.filter(i=>i.location.kind==='inventory'))for(const unit of state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board').sort((a,b)=>Number(b.id===anomalyTarget)-Number(a.id===anomalyTarget))){
    let done=false;for(let slot=0;slot<3;slot++){const equipped=equipItem(state,item.id,unit.id,slot);if(equipped.ok){state=equipped.state;done=true;break;}}if(done)break;
  }
  deployment=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board');
});
for(const node of ['4-2','4-3','4-4','4-5','4-6','4-7'])it(`executes real ${node} combat and pays only original anomaly-holder kills`,()=>{
  expect(state.roundDefinitionId).toBe(node);
  if(node==='4-6'){
    const c=state.pendingChoice!;expect(c.step).toBe('target');
    state=accepted(selectAnomalyTarget(state,c.choiceId,c.generation,anomalyTarget));
  }
  state=resolveM5Choices(state);
  if(node==='4-2'||node==='4-3')for(const unit of deployment)if(state.preparation.units.find(u=>u.id===unit.id)?.location.kind!=='board')state=accepted(deployMatchUnit(state,unit.id,unit.location));
  if(state.phase==='preparation')state=accepted(startMatchCombat(state));
  while(state.phase==='combat')state=stepMatch(state).state;
  state=resolveM5Choices(state);
  const plan=goldenFindGoldPlan(state);
  if(node<'4-6')expect(plan).toEqual([]);
  else {
    const deaths=state.augmentHistory!.facts.filter(f=>f.kind==='deaths'&&f.round>=23).flatMap(f=>f.kind==='deaths'?f.deaths:[]);
    const kills=deaths.filter(d=>d.team==='enemy'&&d.killer?.ownerId===anomalyTarget).length;
    expect(kills).toBeGreaterThanOrEqual(3);
    expect(plan.reduce((n,p)=>n+p.amount,0)).toBe(2*Math.floor(kills/3));
    expect(state.seatMechanics!.receipts.filter(r=>r.source===GOLDEN_FIND_SOURCE).map(r=>r.kind==='gold'?r.amount:0)).toEqual(plan.map(p=>p.amount));
    expect(settleBatch5H9History(state).state).toBe(state);
    expect(stepMatch(state).state).toBe(state);
    paid=state;
  }
  state=accepted(nextRound(state,state.round));
});
it('serializes the awarded state through the validating save entry',()=>{ paidSerialized=serializeMatch(paid); expect(JSON.parse(paidSerialized)).toEqual(paid); });
for(const entry of ['object','JSON','serialized'] as const){
 const restore=(s:MatchState)=>entry==='object'?restoreMatch(s):entry==='JSON'?restoreMatch(JSON.stringify(s)):restoreMatch(s===paid?paidSerialized:JSON.stringify(s));
 it(`${entry}: round-trips awarded gold, bindings, cross-battle remainder and command continuation`,()=>{
   expect(restore(paid)).toEqual(paid);
   expect(requireAugmentFacts(paid,'combat-binding',23)[0].binding?.unitId).toBe(anomalyTarget);
   expect(rerollShop(restore(acquired))).toEqual(rerollShop(acquired));
 });
 for(const kind of ['missing-history','killer','binding','death-removal','gold','receipt-removal','free-spend'] as const)it(`${entry}: rejects tampered ${kind}`,()=>{
   const bad:any=structuredClone(paid);
   if(kind==='missing-history')delete bad.augmentHistory;
   if(kind==='killer')bad.augmentHistory.facts.find((f:any)=>f.kind==='deaths'&&f.round===23&&f.deaths.some((d:any)=>d.killer?.ownerId===anomalyTarget)).deaths.find((d:any)=>d.killer?.ownerId===anomalyTarget).killer.ownerId='unit-1';
   if(kind==='binding')bad.augmentHistory.facts.find((f:any)=>f.kind==='combat-binding'&&f.round===23).binding.unitId='unit-1';
   if(kind==='death-removal')bad.augmentHistory.facts.find((f:any)=>f.kind==='deaths'&&f.round===23&&f.deaths.length).deaths.pop();
   if(kind==='gold')bad.seatMechanics.receipts.find((r:any)=>r.source===GOLDEN_FIND_SOURCE).amount+=2;
   if(kind==='receipt-removal')bad.seatMechanics.receipts=bad.seatMechanics.receipts.filter((r:any)=>r.source!==GOLDEN_FIND_SOURCE);
   if(kind==='free-spend')bad.seatMechanics.seat['free-shop-rerolls']={used:1};
   expect(()=>restore(bad)).toThrow();
 });
}
