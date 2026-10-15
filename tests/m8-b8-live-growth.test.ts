import { describe, expect, it } from 'vitest';
import { deployMatchUnit, nextRound, selectChoice, startMatchCombat, stepMatch } from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match';
import type { ResourceProvenanceEntry } from '../src/simulation/resource-provenance';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { accepted, battle, configuredPrefix, plan, reserveExcept } from './fixtures/t13-loot-public';
const copy = <T>(value:T):T => structuredClone(value);
const initial = await configuredPrefix('3-7',{seed:48,build:'cannon',copyLimits:{tristana:2},fieldCopies:['tristana']});
// Public deployment isolates both original growth sources and earns a real current-battle delta.
const prepared = accepted(deployMatchUnit(reserveExcept(initial,['unit-14','unit-15']),'unit-14',{kind:'board',cell:{col:0,row:4}}));
const result = battle(prepared);
if(!result.revealed)throw Error('Expected live reveal before natural final tick');
const live = {...result,revealed:result.revealed,selected:result.ended};
function roundTrip(s:MatchState):MatchState {const saved=serializeMatch(s),r=restoreMatch(saved);expect(r).toEqual(s);expect(r).not.toBe(s);expect(serializeMatch(s)).toBe(saved);return r;}
const currentCommit=(s:MatchState)=>s.resourceProvenance.entries.find((e):e is Extract<ResourceProvenanceEntry,{kind:'combat-growth-committed'}>=>e.kind==='combat-growth-committed'&&e.combatId==='round-17')!;
describe('B8 live growth plus immediate randomized loot merge',()=>{
 it('pins real seed48 prior stock and original-source current delta independently',()=>{
  expect(prepared.persistentGrowth).toEqual([{unitId:'unit-14',attackDamageBps:250},{unitId:'unit-15',attackDamageBps:125}]);
  expect(live.events.filter(e=>e.type==='growth')).toEqual([{type:'growth',tick:68,unitId:'unit-14',amountBps:125,totalBps:125,domain:'combat',combatId:'round-17',eventSeq:74},{type:'growth',tick:201,unitId:'unit-14',amountBps:125,totalBps:250,domain:'combat',combatId:'round-17',eventSeq:179}]);
  const stock=prepared.persistentGrowth.reduce((n,g)=>n+g.attackDamageBps,0);
  const delta=live.ended.combat!.units.filter(u=>['unit-14','unit-15'].includes(u.id)).reduce((n,u)=>n+u.runtime!.permanentAdBps,0);
  expect({stock,delta,total:stock+delta}).toEqual({stock:375,delta:250,total:625});
  expect(live.ended.persistentGrowth).toEqual([{unitId:'unit-14',attackDamageBps:625}]);
  expect(currentCommit(live.ended).sourceDeltas).toEqual([{sourceUnitId:'unit-14',attackDamageBps:250}]);
 });
 it('keeps the consumed reward birth, original stars and frozen combat basis',()=>{
  const receipt=live.ended.m8.loot.receipts.find(r=>r.grantedUnitIds.includes('unit-25'))!;
  expect(receipt.payload).toEqual({kind:'unit',definitionId:'tristana',quantity:1});
  expect(live.events.filter(e=>e.type==='unitUpgraded')).toEqual([expect.objectContaining({survivorId:'unit-14',consumedIds:['unit-15','unit-25'],fromStar:1,toStar:2})]);
  const birth=live.ended.resourceProvenance.entries.find(e=>e.kind==='unit-acquired'&&e.unitId==='unit-25')!;
  expect(birth).toMatchObject({roundId:'3-7',source:{kind:'loot',receiptId:receipt.receiptId}});
  expect(currentCommit(live.ended).sequence).toBeGreaterThan(birth.sequence);
  for(const s of [live.ended,roundTrip(live.ended)]){
   expect(s.preparation.units.find(u=>u.id==='unit-14')?.starLevel).toBe(2);
   expect(s.preparation.units.some(u=>['unit-15','unit-25'].includes(u.id))).toBe(false);
   expect(s.combatInputBasis!.inputs.preparation).toEqual(prepared.preparation);
   expect(s.combatInputBasis!.inputs.persistentGrowth).toEqual(prepared.persistentGrowth);
   expect(s.combat!.units.filter(u=>['unit-14','unit-15'].includes(u.id)).map(u=>u.starLevel)).toEqual([1,1]);
   expect(s.combat!.units.some(u=>u.id==='unit-25')).toBe(false);
   expect(s.combat!.strategy).toEqual(buildStrategySnapshot(s.combatInputBasis!.inputs));
  }
 });
 it('strictly restores every boundary without pre-granting resources',()=>{
  for(const s of [prepared,live.started,live.revealed,live.beforeFinal,live.ended])roundTrip(s);
  expect(live.revealed.combat!.tick).toBe(201);
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
  expect(next.persistentGrowth).toEqual([{unitId:'unit-14',attackDamageBps:625}]);
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
    entry.kind === 'unit-acquired' && entry.unitId === 'unit-25')!;
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
    badCommit(state).sourceDeltas[0].sourceUnitId = 'unit-15';
  }, 'Invalid B8 Match: original combat growth deltas'],
  ['missing delta with a matching forged final stock', state => {
    badCommit(state).sourceDeltas = []; state.persistentGrowth[0].attackDamageBps = 375;
  }, 'Invalid B8 Match: original combat growth deltas'],
  ['inflated delta with a matching forged final stock', state => {
    badCommit(state).sourceDeltas[0].attackDamageBps = 375; state.persistentGrowth[0].attackDamageBps = 750;
  }, 'Invalid B8 Match: original combat growth deltas'],
  ['delta attributed to the new reward outside the original combat prefix', state => {
    badCommit(state).sourceDeltas[0].sourceUnitId = 'unit-25';
  }, 'Invalid resource provenance: combat growth source/step'],
  ['duplicate original delta', state => {
    badCommit(state).sourceDeltas.push(copy(badCommit(state).sourceDeltas[0]));
  }, 'Invalid resource provenance: combat growth source/step'],
  ['final growth resurrected under consumed source', state => {
    state.persistentGrowth = [{unitId:'unit-14',attackDamageBps:500},{unitId:'unit-15',attackDamageBps:125}];
  }, 'Invalid Match save: persistent growth'],
  ['birth bound to the component receipt', state => {
    const receipt = state.m8.loot.receipts.find(value => value.payload.kind === 'item')!;
    badBirth(state).source = {kind:'loot',receiptId:receipt.receiptId};
  }, 'Invalid resource provenance: receipt birth binding'],
  ['birth assigned the consumed old source ID', state => { badBirth(state).unitId = 'unit-15'; },
    'Invalid resource provenance: unit serial'],
  ['missing candidate birth while keeping its upgrade', state => {
    state.resourceProvenance.entries.splice(badBirth(state).sequence,1); reindex(state);
  }, 'Invalid resource provenance: upgrade transaction'],
  ['receipt candidate changed to survivor', state => {
    state.m8.loot.receipts.find(value => value.grantedUnitIds.includes('unit-25'))!.grantedUnitIds = ['unit-14'];
  }, 'Invalid resource provenance: receipt birth binding'],
  ['missing upgrade transaction', state => {
    state.resourceProvenance.entries.splice(badUpgrade(state).sequence,1); reindex(state);
  }, 'Invalid resource provenance: missing upgrade'],
  ['upgrade linked to a different acquisition', state => { badUpgrade(state).acquisitionSequence--; },
    'Invalid resource provenance: upgrade transaction'],
  ['duplicated consumed old source', state => { badUpgrade(state).event.consumedIds = ['unit-15','unit-15']; },
    'Invalid resource provenance: upgrade participants'],
  ['wrong old source in consumption', state => { badUpgrade(state).event.consumedIds = ['unit-24','unit-25']; },
    'Invalid resource provenance: upgrade ownership'],
  ['wrong star for immediate merge', state => { badUpgrade(state).event.fromStar = 2; badUpgrade(state).event.toStar = 3; },
    'Invalid resource provenance: upgrade transaction'],
  ['basis rewritten with reward-upgraded star', state => {
    state.combatInputBasis!.inputs.preparation.units.find(unit => unit.id === 'unit-14')!.starLevel = 2;
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
