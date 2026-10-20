import { describe, expect, it } from 'vitest';
import { deployMatchUnit, nextRound, selectChoice, startMatchCombat, stepMatch } from '../src/simulation/match';
import type { MatchEvent, MatchState } from '../src/simulation/match';
import type { ResourceProvenanceEntry } from '../src/simulation/resource-provenance';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { accepted, battle, plan, reserveExcept } from './fixtures/t13-loot-public';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });
const copy = <T>(value:T):T => structuredClone(value);
import { run } from '../scripts/generate-m5-route.cjs';
import * as api from '../src/simulation/match';
// Raw S13 Tristana ASKillGain is 1.25 percent at every star (125 bps).
// Count eligible parent killing packets and independently validate the scheduled bounce,
// never derive expected stock from persistentGrowth or the growth event under test.
const GAIN = 125;
function bounceFacts(before:MatchState, after:MatchState, events:readonly MatchEvent[]) {
 const oldKeys=new Set(before.combat?.units.flatMap(u=>(u.tasks??[]).map(t=>t.key))??[]);
 return (after.combat?.units??[]).flatMap(unit=>(unit.tasks??[]).filter(t=>t.kind==='tristanaBounce'&&!oldKeys.has(t.key)).map(task=>{
  const packet=events.find(e=>e.type==='packetDamage'&&e.outcome.killingPacket&&e.outcome.overkill>0&&e.outcome.context.source.ownerId===unit.id&&e.outcome.context.actionSeq===task.actionSeq);
  if(!packet||packet.type!=='packetDamage')throw Error('Bounce without actual parent overkill kill');
  expect(task.amount).toBe(packet.outcome.overkill);
  expect(task.executeAtTick).toBe(packet.tick+1);
  expect(task.targetId).not.toBe(packet.outcome.context.targetId);
  return {type:'growth' as const,unitId:unit.id,tick:packet.tick,amountBps:GAIN,domain:'combat' as const,combatId:packet.combatId,eventSeq:packet.eventSeq!+2};
 }));
}
const priorFacts:ReturnType<typeof bounceFacts>=[];
let captured:MatchState|undefined;
const stop=new Error('captured genuine 3-7 preparation');
try { await run(api,{seed:48,build:'cannon',supplyChoices:['sword','bow'],reservedComponents:['sword','bow'],equipmentTargets:{'giant-slayer':{definitionId:'irelia'}},copyLimits:{tristana:2},fieldCopies:['tristana'],onStep(before,result,command){
 if(command?.type==='start'&&before.roundDefinitionId==='3-7'){captured=before;throw stop;}
 if('events' in result)priorFacts.push(...bounceFacts(before,result.state,result.events));
}}); }catch(error){if(error!==stop)throw error;}
if(!captured)throw Error('Missing genuine preparation');
const initial=captured;
const originals=initial.preparation.units.filter(u=>u.definitionId==='tristana'&&u.starLevel===1).map(u=>u.id).sort();
expect(originals).toHaveLength(2);
const [SURVIVOR,DONOR]=originals;
const REWARD=`unit-${initial.nextUnitSerial}`;
const OTHER=initial.preparation.units.find(u=>!originals.includes(u.id))!.id;
const priorBySource=originals.map(unitId=>({unitId,attackDamageBps:priorFacts.filter(f=>f.unitId===unitId).length*GAIN}));
const STOCK=priorBySource.reduce((n,g)=>n+g.attackDamageBps,0);

// Public deployment isolates both original growth sources and earns a real current-battle delta.
let prepared = accepted(deployMatchUnit(reserveExcept(initial,originals),SURVIVOR,{kind:'board',cell:{col:3,row:4}}));
// A public holder sale releases the genuinely acquired Giant Slayer for this battle.
const giantSlayer=prepared.items.find(i=>i.definitionId==='giant-slayer')!;
if(giantSlayer.location.kind==='unit')prepared=accepted(api.sellUnit(prepared,giantSlayer.location.unitId));
for(const unitId of originals)if(prepared.items.some(i=>i.location.kind==='unit'&&i.location.unitId===unitId)){const remover=prepared.consumables.find(c=>c.definitionId==='magnetic-remover')!;prepared=accepted(api.useConsumable(prepared,remover.consumableId,{kind:'unit',unitId}));}
prepared=accepted(api.equipItem(prepared,giantSlayer.id,SURVIVOR,0));
const currentFacts:ReturnType<typeof bounceFacts>=[];
let probe=accepted(startMatchCombat(prepared));
while(probe.phase==='combat'){const next=stepMatch(probe);currentFacts.push(...bounceFacts(probe,next.state,next.events));probe=next.state;}
const DELTA=currentFacts.length*GAIN,TOTAL=STOCK+DELTA;
expect(priorBySource.every(g=>g.attackDamageBps>0)).toBe(true);
expect(DELTA).toBeGreaterThan(0);
expect(currentFacts).toHaveLength(2);
const result = battle(prepared);
if(!result.revealed)throw Error('Expected live reveal before natural final tick');
const live = {...result,revealed:result.revealed,selected:result.ended};
function roundTrip(s:MatchState):MatchState {const saved=serializeMatch(s),r=restoreMatch(saved);expect(r).toEqual(s);expect(r).not.toBe(s);expect(serializeMatch(s)).toBe(saved);return r;}
const currentCommit=(s:MatchState)=>s.resourceProvenance.entries.find((e):e is Extract<ResourceProvenanceEntry,{kind:'combat-growth-committed'}>=>e.kind==='combat-growth-committed'&&e.combatId==='round-17')!;
describe('B8 live growth plus immediate randomized loot merge',()=>{
 it('pins real v16 seed48 prior stock and original-source current delta independently',()=>{
  expect(prepared.persistentGrowth).toEqual(priorBySource);
  const totals=new Map<string,number>();
  expect(live.events.filter(e=>e.type==='growth')).toEqual(currentFacts.map(f=>{const total=(totals.get(f.unitId)??0)+GAIN;totals.set(f.unitId,total);return {...f,totalBps:total};}));
  const stock=prepared.persistentGrowth.reduce((n,g)=>n+g.attackDamageBps,0);
  const delta=live.ended.combat!.units.filter(u=>[SURVIVOR,DONOR].includes(u.id)).reduce((n,u)=>n+u.runtime!.permanentAdBps,0);
  expect({stock,delta,total:stock+delta}).toEqual({stock:STOCK,delta:DELTA,total:TOTAL});
  expect(live.ended.persistentGrowth).toEqual([{unitId:SURVIVOR,attackDamageBps:TOTAL}]);
  expect(currentCommit(live.ended).sourceDeltas).toEqual([{sourceUnitId:SURVIVOR,attackDamageBps:DELTA}]);
 });
 it('keeps the consumed reward birth, original stars and frozen combat basis',()=>{
  const receipt=live.ended.m8.loot.receipts.find(r=>r.grantedUnitIds.includes(REWARD))!;
  expect(receipt.payload).toEqual({kind:'unit',definitionId:'tristana',quantity:1});
  expect(live.events.filter(e=>e.type==='unitUpgraded')).toEqual([expect.objectContaining({survivorId:SURVIVOR,consumedIds:[DONOR,REWARD].sort(),fromStar:1,toStar:2})]);
  const birth=live.ended.resourceProvenance.entries.find(e=>e.kind==='unit-acquired'&&e.unitId===REWARD)!;
  expect(birth).toMatchObject({roundId:'3-7',source:{kind:'loot',receiptId:receipt.receiptId}});
  expect(currentCommit(live.ended).sequence).toBeGreaterThan(birth.sequence);
  for(const s of [live.ended,roundTrip(live.ended)]){
   expect(s.preparation.units.find(u=>u.id===SURVIVOR)?.starLevel).toBe(2);
   expect(s.preparation.units.some(u=>[DONOR,REWARD].includes(u.id))).toBe(false);
   expect(s.combatInputBasis!.inputs.preparation).toEqual(prepared.preparation);
   expect(s.combatInputBasis!.inputs.persistentGrowth).toEqual(prepared.persistentGrowth);
   expect(s.combat!.units.filter(u=>[SURVIVOR,DONOR].includes(u.id)).map(u=>u.starLevel)).toEqual([1,1]);
   expect(s.combat!.units.some(u=>u.id===REWARD)).toBe(false);
   expect(s.combat!.strategy).toEqual(buildStrategySnapshot(s.combatInputBasis!.inputs));
  }
 });
 it('strictly restores every boundary without pre-granting resources',()=>{
  for(const s of [prepared,live.started,live.revealed,live.beforeFinal,live.ended])roundTrip(s);
  const reveal=live.revealPrefix.find(e=>e.type==='lootRevealed')!;
  expect(reveal.type).toBe('lootRevealed');
  const death=live.revealed.combat!.neutralReceipts!.deaths.find(d=>d.eventSeq===reveal.death.eventSeq&&live.revealed.m8.loot.earnedEvidence.some(e=>e.death.eventSeq===d.eventSeq))!;
  expect(live.revealed.combat!.tick).toBe(death.tick);
  expect(live.revealed.phase).toBe('combat');
  expect(live.ended.phase).toBe('settlement');expect(live.ended.pendingChoice).toBeNull();
  for(const key of ['preparation','persistentGrowth','resourceProvenance','nextUnitSerial'] as const)expect(live.revealed[key]).toEqual(prepared[key]);
  expect(live.revealed.m8.loot.receipts).toEqual(prepared.m8.loot.receipts);
  expect(currentCommit(live.revealed)).toBeUndefined();
 });
 it('resumes every complete event/state batch and Continue identically',()=>{
  expect(startMatchCombat(roundTrip(prepared))).toEqual(startMatchCombat(prepared));
  let a=live.revealed,b=roundTrip(a);const events=[...live.revealPrefix];
  while(a.phase==='combat'){const x=stepMatch(a),y=stepMatch(b);expect(y).toEqual(x);events.push(...x.events);a=x.state;b=y.state;}
  expect(a).toEqual(live.ended);expect(events).toEqual(live.events);
  const combat=events.filter(e=>e.domain==='combat');expect(combat.map(e=>e.eventSeq)).toEqual(combat.map((_,i)=>i));
  expect(combat.filter(e=>e.type==='combatFinished')).toHaveLength(1);
  expect(nextRound(roundTrip(b),17)).toEqual(nextRound(a,17));
  const next=roundTrip(accepted(nextRound(a,17)));expect(next.roundDefinitionId).toBe('4-1');
  expect(next.persistentGrowth).toEqual([{unitId:SURVIVOR,attackDamageBps:TOTAL}]);
 });
 it('repeated step, obsolete choice and Continue cannot duplicate receipts or growth',()=>{
  for(const s of [live.ended,roundTrip(live.ended)]){
   const before=serializeMatch(s);expect(stepMatch(s)).toEqual({state:s,events:[]});
   expect(startMatchCombat(s)).toEqual({ok:false,state:s,reason:'wrong-phase'});
   expect(selectChoice(s,'obsolete-pve-choice',0,'sword')).toEqual({ok:false,state:s,reason:'wrong-phase'});
   expect(serializeMatch(s)).toBe(before);
  }
  const advanced=accepted(nextRound(live.ended,17));
  expect(nextRound(advanced,17)).toEqual({ok:false,state:advanced,reason:'wrong-phase'});
  for(const key of ['nextUnitSerial','nextItemSerial','resourceProvenance'] as const)expect(advanced[key]).toEqual(live.ended[key]);
  expect(advanced.m8.loot.receipts).toEqual(live.ended.m8.loot.receipts);
 });
 it('binds every orb entry to its one natural source death and grants in frozen order',()=>{
  const drops=plan(prepared).encounterPlan.drops,ids=new Set(drops.map(d=>d.dropId));
  for(const d of drops){const evidence=live.ended.m8.loot.earnedEvidence.find(e=>e.dropId===d.dropId)!;
   const death=live.ended.combat!.neutralReceipts!.deaths.filter(x=>x.unitId===d.sourceUnitId);expect(death).toHaveLength(1);
   expect(evidence.death).toEqual({combatId:'round-17',tick:death[0].tick,eventSeq:death[0].eventSeq});}
  expect(live.events.filter(e=>e.type==='lootGranted'&&ids.has(e.receipt.dropId)).map(e=>e.type==='lootGranted'&&e.receipt.dropId)).toEqual(drops.map(d=>d.dropId));
 });
});
type Mutable<T> = T extends readonly (infer Value)[] ? Mutable<Value>[]
  : T extends object ? {-readonly [Key in keyof T]:Mutable<T[Key]>} : T;
type MutableMatch = Mutable<MatchState>;
const badCommit = (state: MutableMatch) => state.resourceProvenance.entries.find(
  (entry): entry is Mutable<Extract<ResourceProvenanceEntry,{kind:'combat-growth-committed'}>> =>
    entry.kind === 'combat-growth-committed' && entry.combatId === 'round-17')!;
const badUpgrade = (state: MutableMatch) => state.resourceProvenance.entries.find(
  (entry): entry is Mutable<Extract<ResourceProvenanceEntry,{kind:'unit-upgraded'}>> =>
    entry.kind === 'unit-upgraded' && entry.roundId === '3-7')!;
const badBirth = (state: MutableMatch) => state.resourceProvenance.entries.find(
  (entry): entry is Mutable<Extract<ResourceProvenanceEntry,{kind:'unit-acquired'}>> =>
    entry.kind === 'unit-acquired' && entry.unitId === REWARD)!;
const reindex = (state: MutableMatch) => {
  state.resourceProvenance.entries.forEach((entry,sequence) => { entry.sequence = sequence; });
};
const tamperings: readonly [string, (state:MutableMatch) => void, string][] = [
  ['missing commit with otherwise continuous sequence', state => {
    state.resourceProvenance.entries.splice(badCommit(state).sequence,1); reindex(state);
  }, 'Invalid resource provenance: missing combat growth commit'],
  ['second commit with a valid new sequence', state => {
    state.resourceProvenance.entries.push({...copy(badCommit(state)),sequence:state.resourceProvenance.entries.length});
  }, 'Invalid resource provenance: combat settlement identity/uniqueness'],
  ['altered settlement identity', state => { badCommit(state).settlementId = 'round-16-settled'; },
    'Invalid resource provenance: combat settlement identity/uniqueness'],
  ['start prefix moved beyond a real loot birth', state => { badCommit(state).combatStartProvenancePrefixLength++; },
    'Invalid resource provenance: loot before combat start'],
  ['delta attributed to donor instead of original survivor source, preserving final total', state => {
    badCommit(state).sourceDeltas[0].sourceUnitId = DONOR;
  }, 'Invalid B8 Match: original combat growth deltas'],
  ['missing delta with a matching forged final stock', state => {
    badCommit(state).sourceDeltas = []; state.persistentGrowth[0].attackDamageBps = STOCK;
  }, 'Invalid B8 Match: original combat growth deltas'],
  ['inflated delta with a matching forged final stock', state => {
    badCommit(state).sourceDeltas[0].attackDamageBps = DELTA+GAIN; state.persistentGrowth[0].attackDamageBps = TOTAL+GAIN;
  }, 'Invalid B8 Match: original combat growth deltas'],
  ['delta attributed to the new reward outside the original combat prefix', state => {
    badCommit(state).sourceDeltas[0].sourceUnitId = REWARD;
  }, 'Invalid resource provenance: combat growth source/step'],
  ['duplicate original delta', state => {
    badCommit(state).sourceDeltas.push(copy(badCommit(state).sourceDeltas[0]));
  }, 'Invalid resource provenance: combat growth source/step'],
  ['final growth resurrected under consumed source', state => {
    state.persistentGrowth = [{unitId:SURVIVOR,attackDamageBps:TOTAL-GAIN},{unitId:DONOR,attackDamageBps:GAIN}];
  }, 'Invalid Match save: persistent growth'],
  ['birth bound to the component receipt', state => {
    const receipt = state.m8.loot.receipts.find(value => value.payload.kind === 'item')!;
    badBirth(state).source = {kind:'loot',receiptId:receipt.receiptId};
  }, 'Invalid resource provenance: receipt birth binding'],
  ['birth assigned the consumed old source ID', state => { badBirth(state).unitId = DONOR; },
    'Invalid resource provenance: unit serial'],
  ['missing candidate birth while keeping its upgrade', state => {
    state.resourceProvenance.entries.splice(badBirth(state).sequence,1); reindex(state);
  }, 'Invalid resource provenance: upgrade transaction'],
  ['receipt candidate changed to survivor', state => {
    state.m8.loot.receipts.find(value => value.grantedUnitIds.includes(REWARD))!.grantedUnitIds = [SURVIVOR];
  }, 'Invalid resource provenance: receipt birth binding'],
  ['missing upgrade transaction', state => {
    state.resourceProvenance.entries.splice(badUpgrade(state).sequence,1); reindex(state);
  }, 'Invalid resource provenance: missing upgrade'],
  ['upgrade linked to a different acquisition', state => { badUpgrade(state).acquisitionSequence--; },
    'Invalid resource provenance: upgrade transaction'],
  ['duplicated consumed old source', state => { badUpgrade(state).event.consumedIds = [DONOR,DONOR]; },
    'Invalid resource provenance: upgrade participants'],
  ['wrong old source in consumption', state => { badUpgrade(state).event.consumedIds = [OTHER,REWARD]; },
    'Invalid resource provenance: upgrade ownership'],
  ['wrong star for immediate merge', state => { badUpgrade(state).event.fromStar = 2; badUpgrade(state).event.toStar = 3; },
    'Invalid resource provenance: upgrade transaction'],
  ['basis rewritten with reward-upgraded star', state => {
    state.combatInputBasis!.inputs.preparation.units.find(unit => unit.id === SURVIVOR)!.starLevel = 2;
  }, 'Invalid combat input basis'],
];
describe('B8 live merged-growth corruption', () => {
  it.each(tamperings)('rejects %s at the intended strict boundary', (_label,change,message) => {
    // Only adversarial copies are edited. The positive route never injects state.
    const before = serializeMatch(live.selected), bad: MutableMatch = JSON.parse(before);
    change(bad);
    expect(() => restoreMatch(bad)).toThrow(message);
    expect(serializeMatch(live.selected)).toBe(before);
  });
});
