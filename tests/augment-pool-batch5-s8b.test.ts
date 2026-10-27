import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { AUGMENT_BATCH5_S8B } from '../src/simulation/content/augment-pool-batch5-s8b';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { createMatch, selectChoice, sellUnit, buyUnit, rerollShop, startMatchCombat, stepMatch, nextRound, type MatchState, type MatchEvent } from '../src/simulation/match';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { gloriousEvolutionRewardPlan, gloriousEvolutionProgress } from '../src/simulation/augment-pool-batch5-s8b';
import { grantMechanicUnit, grantMechanicGold } from '../src/simulation/seat-mechanics/grants';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { accepted, fieldBench, resolveM5Choices } from './match-helpers';
import { ownBattleRecord, deepFreeze, recordVersion, replayBattleRecord } from '../src/simulation/battle-record-validation';
import { digestContent } from '../src/simulation/content';
import type { BattleRecord } from '../src/m6/contracts';
import { enableMultiplayerSettlement } from '../src/simulation/round-settlement';
import { STAGE_SEEDS } from './augment-stage-helpers';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { rewardPlan } from './fixtures/m5/augment-rewards-oracle.cjs';
import { CATALOG, COST, ROUNDS, xp, entryXp, benchXp } from './fixtures/m5/oracle.g2.cjs';

const id='glorious-evolution';
it.skipIf(!existsSync(RESEARCH_FILE))('source numbers match the 14.24 research archive',()=>{
 const row=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName===AUGMENT_BATCH5_S8B[id].apiName);
 expect(AUGMENT_BATCH5_S8B[id].source.values).toEqual(row.effects);
});
it('only the 4-2 node permits Glorious Evolution',()=>{
 for(const node of ['2-1','3-2','4-2']) expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe(node==='4-2');
});

// The integrated-pool seed offers this 4-2 card. Split the real route into
// rounds so ordinary Vitest limits apply to each battle, and retain replay evidence.
let route=createMatch(STAGE_SEEDS[id].seed); const battles:BattleRecord[]=[];
function fight(context:MatchState):MatchState {
 const start=startMatchCombat(context);let s=accepted(start);const initial=s.combat!,events:MatchEvent[]=[...(start.ok?start.events:[])];
 while(s.phase==='combat'){const step=stepMatch(s);s=step.state;events.push(...step.events);}
 const terminal=s.combat!,ledger=events.filter((e):e is BattleRecord['events'][number]=>e.domain==='combat');
 const record=ownBattleRecord(deepFreeze({version:recordVersion(context),roundId:context.roundDefinitionId,runId:'s8b',combatId:terminal.combatId!,context,initial,events:ledger,endTick:terminal.tick,nextEventSeq:terminal.nextEventSeq!,result:terminal.result,stateHash:digestContent(terminal),eventHash:digestContent(ledger)}));
 replayBattleRecord(record);battles.push(record);return resolveM5Choices(s);
}
for(const stop of ['1-2','1-3','2-1','2-2','2-3','2-4','2-5','2-6','2-7','3-1','3-2','3-3','3-4','3-5','3-6','3-7','4-1','4-2'])it(`public route to ${stop}`,()=>{
 while(route.roundDefinitionId!==stop){route=resolveM5Choices(route);if(route.phase==='preparation')route=fight(fieldBench(route));route=resolveM5Choices(route);route=accepted(nextRound(route,route.round));}
 if(stop==='4-1'){
  const funded=grantMechanicGold(route,{receiptId:'s8b-public-shop-budget',source:'test',amount:300});expect(funded.ok).toBe(true);if(!funded.ok)throw Error(funded.reason);
  route=restoreMatch(serializeMatch(funded.state,battles),battles);
 }
});
let selected:MatchState, offered:MatchState;
it('selects the real offered augment and grants exactly one Adaptive Helm',()=>{
 const c=route.pendingChoice!;
 expect(c.offers).toContain(id);offered=route;
 selected=resolveM5Choices(accepted(selectChoice(route,c.choiceId,c.generation,id)));
 expect(selected.items.filter(i=>i.definitionId==='adaptive-helm').length-route.items.filter(i=>i.definitionId==='adaptive-helm').length).toBe(1);
 expect(gloriousEvolutionRewardPlan(selected)).toEqual([]);expect(gloriousEvolutionProgress(selected).count).toBe(0);
 const text=serializeMatch(selected,battles);expect(restoreMatch(text,battles)).toEqual(selected);expect(restoreMatch(selected,battles)).toEqual(selected);
});
let completed:MatchState,merging:MatchState;
it('prepares a public shop witness with no earlier one-cost copies',()=>{
 let s=selected;
 // Free bench slots and ensure the chosen witness has no earlier copies.
 for(const u of [...s.preparation.units].filter(u=>u.team==='player' && (u.location.kind==='bench'||u.definitionId==='maddie'))) {
  const r=sellUnit(s,u.id);if(r.ok)s=resolveM5Choices(r.state);
 }
 for(const u of s.preparation.units.filter(u=>u.team==='player'&&UNIT_DEFINITIONS[u.definitionId]?.cost===1)){const r=sellUnit(s,u.id);if(r.ok)s=r.state;}
 merging=s;
});
for(let i=0;i<9;i++)it(`public shop merge ${i+1} counts once and pays only at nine`,()=>{
 let s=merging;
 for(let roll=0;roll<100&&gloriousEvolutionProgress(s).count===i;roll++){
  for(let slot=0;slot<5&&gloriousEvolutionProgress(s).count===i;slot++){
   const offer=s.shop.slots[slot];if(offer.status!=='available'||UNIT_DEFINITIONS[offer.definitionId].cost!==1)continue;
   let bought=buyUnit(s,slot,s.shop.generation);
   if(!bought.ok&&bought.reason==='bench-full'){
    s=fieldBench(s);bought=buyUnit(s,slot,s.shop.generation);
   }
   if(bought.ok)s=resolveM5Choices(bought.state);
  }
  s=resolveM5Choices(fieldBench(s));
  if(gloriousEvolutionProgress(s).count===i)s=accepted(rerollShop(s));
 }
 const merged=s.preparation.units.find(u=>u.team==='player'&&UNIT_DEFINITIONS[u.definitionId]?.cost===1&&u.starLevel===2)!;expect(merged).toBeTruthy();
 s=accepted(sellUnit(s,merged.id));
 expect(gloriousEvolutionProgress(s).count).toBe(i+1);expect(gloriousEvolutionRewardPlan(s).length).toBe(i===8?2:0);
 merging=s;
});
it('nine real permanent merges award Viktor and Jeweled Gauntlet once',()=>{
 const s=completed=merging;
 const gifts=gloriousEvolutionRewardPlan(s);expect(gifts.map(g=>g.definitionId)).toEqual(['jeweled-gauntlet','viktor']);
 for(const gift of gifts)expect(s.seatMechanics!.receipts.filter(r=>r.receiptId===gift.receiptId)).toHaveLength(1);
 const oracle=rewardPlan(s,{CATALOG,COST,ROUNDS,xp,entryXp,benchXp});
 for(const definitionId of ['adaptive-helm','jeweled-gauntlet','viktor']) expect(oracle.gifts.filter((g:{definitionId:string})=>g.definitionId===definitionId)).toHaveLength(1);
});
for(const mode of ['object','json','serialize'] as const)it(`completed quest ${mode} round trip and tamper rejection`,()=>{
 const text=serializeMatch(completed,battles);
 const read=(x:any)=>mode==='object'?restoreMatch(x,battles):mode==='json'?restoreMatch(JSON.stringify(x),battles):restoreMatch(serializeMatch(x,battles),battles);
 expect(read(JSON.parse(text))).toEqual(completed);
 for(const mutate of [
  (x:any)=>{x.seatMechanics.receipts.find((r:any)=>r.definitionId==='adaptive-helm').definitionId='blue-buff';},
  (x:any)=>{x.seatMechanics.receipts.find((r:any)=>r.definitionId==='jeweled-gauntlet').definitionId='blue-buff';},
  (x:any)=>{x.seatMechanics.receipts.find((r:any)=>r.definitionId==='viktor').definitionId='mel';},
  (x:any)=>{x.resourceProvenance.entries.find((e:any)=>e.kind==='unit-upgraded').event.toStar=3;},
 ]){const x=JSON.parse(text);mutate(x);expect(()=>read(x)).toThrow();}
});

it('direct two-star grant is excluded and a cascading real merge counts each upgrade',()=>{
 let s=selected;
 for(const u of [...s.preparation.units].filter(u=>u.team==='player'&&(u.location.kind==='bench'||u.definitionId==='maddie'))) {const r=sellUnit(s,u.id);if(r.ok)s=resolveM5Choices(r.state);}
 const high=grantMechanicUnit(s,{receiptId:'s8b-direct-high',source:'test',definitionId:'maddie',starLevel:2});expect(high.ok).toBe(true);if(!high.ok)throw Error(high.reason);s=high.state;
 expect(gloriousEvolutionProgress(s).count).toBe(0);s=resolveM5Choices(accepted(sellUnit(s,s.preparation.units.find(u=>u.definitionId==='maddie')!.id)));
 for(let n=0;n<9;n++){const r=grantMechanicUnit(s,{receiptId:`s8b-chain-${n}`,source:'test',definitionId:'maddie'});expect(r.ok).toBe(true);if(!r.ok)throw Error(r.reason);s=r.state;}
 expect(gloriousEvolutionProgress(s).count).toBe(4);
 expect(s.preparation.units.find(u=>u.definitionId==='maddie')?.starLevel).toBe(3);
});

it('a merge before the choice in online preparation is not retroactive',()=>{
 const enabled=enableMultiplayerSettlement(offered,'s8b-seat');expect(enabled.ok).toBe(true);if(!enabled.ok)throw Error(enabled.reason);let s=enabled.state;
 for(const u of [...s.preparation.units].filter(u=>u.team==='player'&&(u.location.kind==='bench'||u.definitionId==='maddie'))) {const r=sellUnit(s,u.id);if(r.ok)s=r.state;}
 for(let n=0;n<3;n++){const r=grantMechanicUnit(s,{receiptId:`s8b-before-${n}`,source:'test',definitionId:'maddie',immediate:true});expect(r.ok).toBe(true);if(!r.ok)throw Error(r.reason);s=r.state;}
 expect(s.resourceProvenance.entries.some(e=>e.kind==='unit-upgraded'&&e.event.definitionId==='maddie')).toBe(true);
 const c=s.pendingChoice!;s=accepted(selectChoice(s,c.choiceId,c.generation,id));expect(gloriousEvolutionProgress(s).count).toBe(0);
});
