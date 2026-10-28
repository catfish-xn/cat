import {lootPlan as independentLootPlan} from './fixtures/orb-combo-oracle.cjs';
import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { accepted, battle, configuredPrefix, transferPreparation, players, plan } from './fixtures/t13-loot-public';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });
import anchor from './fixtures/v25-online-rules-transfer-route.json';
const {survivor:SURVIVOR,donor:DONOR,reward:REWARD,tg:TG}=anchor;
const prepared=await transferPreparation();
// These IDs/provenance counts are an archived epoch anchor. Diagnose the epoch
// mismatch before a stale donor/survivor ID can masquerade as a command failure.
expect(prepared.contentDigest, 'v23 transfer anchor requires re-recording for this content epoch').toBe(anchor.contentDigest);
const make=(s:MatchState)=>{const l=battle(s);if(!l.revealed)throw Error('Missing live reveal');return {...l,revealed:l.revealed,selected:l.ended};};
const migration=make(prepared), conflict=make(accepted(api.equipItem(prepared,'item-13',SURVIVOR,0)));
const scenarios=[{name:'TG migrates',live:migration,returned:false},{name:'conflicting TG returns',live:conflict,returned:true}];
function roundTrip(s:MatchState):MatchState {const saved=serializeMatch(s),r=restoreMatch(saved);expect(r).toEqual(s);expect(r).not.toBe(s);expect(serializeMatch(s)).toBe(saved);return r;}
describe('B8 live randomized reward upgrade with equipment, anomaly and G12 transfer',()=>{
 it('pins the real two paid Tristanas, glove recipe, anomaly target and reward identity',()=>{
  expect(players(prepared).filter(u=>u.definitionId==='tristana').map(u=>[u.id,u.starLevel])).toEqual([[DONOR,1],[SURVIVOR,1]]);
  expect(prepared.resourceProvenance.entries.filter(e=>e.kind==='unit-acquired'&&[SURVIVOR,DONOR].includes(e.unitId)).every(e=>e.kind==='unit-acquired'&&e.source.kind==='shop')).toBe(true);
  expect(prepared.resourceProvenance.entries.filter(e=>e.kind==='unit-acquired'&&[DONOR,SURVIVOR].includes(e.unitId))).toEqual(anchor.acquisitions);
  // v18 restores the archived 3-7 Pan atom: 10 direct items + 2 forges + 3 supply items = 15 births.
  const priorDrops=independentLootPlan(4,17).rounds.flatMap(r=>r.encounterPlan.drops);
  expect(priorDrops.filter(d=>d.payload.kind==='item')).toHaveLength(10);
  expect(priorDrops.filter(d=>d.payload.kind==='forge')).toHaveLength(2);
  const pan=priorDrops.find(d=>d.roundId==='3-7'&&d.payload.kind==='item'&&d.payload.definitionId==='frying-pan')!;
  expect(pan).toBeDefined();
  const receipt=prepared.m8.loot.receipts.find(r=>r.dropId===pan.dropId)!;
  expect(prepared.items.find(i=>i.id===receipt.grantedItemIds[0])?.definitionId).toBe('frying-pan');
  expect(prepared.resourceProvenance.entries.filter(e=>e.kind==='item-acquired'&&e.source.kind==='loot'&&e.source.receiptId===receipt.receiptId)).toHaveLength(1);
  expect(['unit-acquired','combat-growth-committed','item-acquired','unit-upgraded','item-combined','unit-sold','item-equipped'].map(kind=>prepared.resourceProvenance.entries.filter(e=>e.kind===kind).length)).toEqual(anchor.provenanceCounts);
  expect(prepared.items.find(i=>i.id===TG)).toEqual({id:TG,definitionId:'thiefs-gloves',location:{kind:'unit',unitId:DONOR,slot:0}});
  // The paid v17 route explicitly acquires slime-time for the donor.
  expect(prepared.anomalyBinding).toEqual({definitionId:'slime-time',unitId:DONOR,choiceId:'round:4-6:anomaly',boundRound:23});
  expect(prepared.equipmentState.rolls).toHaveLength(1);
  expect(prepared.resourceProvenance.entries).toHaveLength(anchor.provenanceLength);
  expect(prepared.nextUnitSerial).toBe(anchor.nextUnitSerial);
  expect(plan(prepared).encounterPlan.drops.map(d=>d.payload)).toEqual(independentLootPlan(4,24).rounds.at(-1)!.encounterPlan.drops.map(d=>d.payload));
 });
 it.each(scenarios)('$name: preserves original Combat and atomically migrates the current projection',({live,returned})=>{
  const {ended,prepared:p}=live,basis=ended.combatInputBasis!;
  expect(basis).toEqual(live.started.combatInputBasis);
  for(const key of ['preparation','items','anomalyBinding','temporaryEquipment'] as const)expect(basis.inputs[key]).toEqual(p[key]);
  expect(ended.combat!.strategy).toEqual(buildStrategySnapshot(basis.inputs));
  expect(ended.combat!.strategy).not.toEqual(buildStrategySnapshot(ended));
  expect(ended.combat!.units.filter(u=>[SURVIVOR,DONOR].includes(u.id)).map(u=>u.starLevel)).toEqual([1,1]);
  expect(ended.combat!.units.some(u=>u.id===REWARD)).toBe(false);
  expect(live.events.filter(e=>e.type==='unitUpgraded')).toEqual([expect.objectContaining({survivorId:SURVIVOR,consumedIds:[REWARD,DONOR].sort(),fromStar:1,toStar:2})]);
  expect(ended.items.find(i=>i.id===TG)!.location).toEqual(returned?{kind:'inventory'}:{kind:'unit',unitId:SURVIVOR,slot:0});
  expect(ended.anomalyBinding).toEqual({...prepared.anomalyBinding,unitId:SURVIVOR});
  expect(ended.temporaryEquipment).toEqual(returned?[]:prepared.temporaryEquipment.map(c=>({...c,holderId:SURVIVOR})));
  expect(ended.equipmentState).toEqual(p.equipmentState);
  const donor=ended.combat!.units.find(u=>u.id===DONOR)!;
  expect(donor.itemPrograms!.find(x=>x.source.instanceId===TG)!.source.ownerId).toBe(DONOR);
  for(const child of prepared.temporaryEquipment)expect(donor.sources!.filter(e=>e.source.sourceInstanceId===child.temporaryId).every(e=>e.source.ownerId===DONOR&&e.source.parentItemInstanceId===TG)).toBe(true);
  const receipt=ended.m8.loot.receipts.find(r=>r.grantedUnitIds.includes(REWARD))!;
  const birth=ended.resourceProvenance.entries.find(e=>e.kind==='unit-acquired'&&e.unitId===REWARD)!;
  expect(birth).toMatchObject({source:{kind:'loot',receiptId:receipt.receiptId}});
  const upgrade=ended.resourceProvenance.entries.find(e=>e.kind==='unit-upgraded'&&e.event.consumedIds.includes(REWARD))!;
  expect(upgrade).toMatchObject({sequence:birth.sequence+1,acquisitionSequence:birth.sequence});
 });
 it.each(scenarios)('$name: restores every boundary and compares full resumed state/events through Continue',({live,returned})=>{
  for(const s of [live.prepared,live.started,live.revealed,live.beforeFinal,live.ended])roundTrip(s);
  let a=live.revealed,b=roundTrip(a);const events=[...live.revealPrefix];
  while(a.phase==='combat'){const x=api.stepMatch(a),y=api.stepMatch(b);expect(y).toEqual(x);events.push(...x.events);a=x.state;b=y.state;}
  expect(events).toEqual(live.events);expect(a).toEqual(live.ended);expect(a.phase).toBe('settlement');
  expect(a.m8.loot.receipts).toHaveLength(prepared.m8.loot.receipts.length+8); // v22: the first 4-7 orb also carries the component anvil
  expect(api.nextRound(roundTrip(a),24)).toEqual(api.nextRound(a,24));
  const next=roundTrip(accepted(api.nextRound(a,24)));expect(next.roundDefinitionId).toBe('5-1');
  expect(next.m8.loot.receipts).toEqual(a.m8.loot.receipts);expect(next.resourceProvenance).toEqual(a.resourceProvenance);
  expect(next.equipmentState.rolls.length).toBe(returned?1:2);
  expect(next.equipmentState.equipment.draws).toBe(returned?2:4);
  expect(next.temporaryEquipment).toHaveLength(returned?0:2);
  expect(next.temporaryEquipment.every(c=>c.holderId===SURVIVOR&&c.roundId==='5-1')).toBe(true);
 });
 it.each(scenarios)('$name: repeated commands cannot reroll, regrant, resettle or consume serials',({live})=>{
  const advanced=accepted(api.nextRound(live.ended,24));
  for(const s of [live.ended,roundTrip(live.ended),advanced]){
   const saved=serializeMatch(s);expect(api.stepMatch(s)).toEqual({state:s,events:[]});expect(serializeMatch(s)).toBe(saved);
   expect(s.resourceProvenance.entries.filter(e=>e.kind==='combat-growth-committed'&&e.combatId==='round-24')).toHaveLength(1);
   expect(s.resourceProvenance.entries.filter(e=>e.kind==='unit-acquired'&&e.unitId===REWARD)).toHaveLength(1);
  }
  expect(api.selectChoice(live.ended,'obsolete-pve-choice',0,'sword')).toEqual({ok:false,state:live.ended,reason:'wrong-phase'});
  expect(api.startMatchCombat(live.ended)).toEqual({ok:false,state:live.ended,reason:'wrong-phase'});
  expect(api.nextRound(advanced,24)).toEqual({ok:false,state:advanced,reason:'wrong-phase'});
 });
});
type Mutable<T> = T extends readonly (infer Value)[] ? Mutable<Value>[]
  : T extends object ? { -readonly [Key in keyof T]: Mutable<T[Key]> } : T;
type MutableMatch = Mutable<MatchState>;
// This separate public route preserves the transfer but avoids history-dependent
// augments. Some tampered states otherwise fail solo replay before the specific
// B8/resource checks below are reached.
async function corruptionRoute() {
  let state=await configuredPrefix('4-7',{
    seed:25,build:'cannon',augmentRerollPriorities:{
      '2-1':['pumping-up-i','manaflow-i','backup','bronze-for-life-i','bulky-buddies-i','placebo','lineup','little-buddies','bulky-buddies-ii','blistering-strikes'],
      '4-2':['pumping-up-ii','blistering-strikes','bronze-for-life-ii','item-collector-ii','mentorship-ii','little-buddies','bulky-buddies-ii','lineup','backup','manaflow-ii','glass-cannon-ii'],
    },equipItems:false,goldReserves:{'4-5':40},copyLimits:{tristana:2,corki:1},fieldCopies:['tristana'],
    supplyChoices:['gloves','gloves','vest'],equipmentTargets:{'thiefs-gloves':{definitionId:'tristana',copy:0}},
    reservedComponents:['gloves','vest'],anomalyTargetDefinitionId:'tristana',anomalyTargetCopy:0,anomalyDefinitionId:'slime-time',
    goldReserveByRound:{'4-5':19,'4-7':0},
  });
  expect(state.augmentHistory).toBeUndefined();
  const donor=state.anomalyBinding!.unitId;
  const survivor=players(state).find(u=>u.definitionId==='tristana'&&u.id!==donor)!.id;
  const tg=state.items.find(item=>item.definitionId==='thiefs-gloves')!.id;
  expect(state.anomalyBinding!.definitionId).toBe('slime-time');
  expect(players(state).filter(u=>u.definitionId==='tristana').map(u=>u.starLevel)).toEqual([1,1]);
  state=accepted(api.equipItem(state,tg,donor,0));
  const live=make(state);
  const upgrade=live.events.find(e=>e.type==='unitUpgraded'&&e.survivorId===survivor);
  expect(upgrade).toMatchObject({survivorId:survivor,consumedIds:[donor,'unit-38'].sort(),fromStar:1,toStar:2});
  expect(live.selected.anomalyBinding).toMatchObject({definitionId:'slime-time',unitId:survivor});
  expect(live.selected.items.find(item=>item.id===tg)!.location).toEqual({kind:'unit',unitId:survivor,slot:0});
  expect(live.selected.temporaryEquipment).toHaveLength(2);
  expect(restoreMatch(serializeMatch(live.selected))).toEqual(live.selected);
  return {live,donor,survivor,tg,reward:'unit-38'};
}
const alternate=await corruptionRoute();
const {donor:CORRUPT_DONOR,survivor:CORRUPT_SURVIVOR,tg:CORRUPT_TG,reward:CORRUPT_REWARD}=alternate;
// Isolate the finished-combat authenticator from unrelated campaign augments.
// Mechanic grants retain real provenance; the Mirror Jayce creates its own forge
// through normal combatStart, and the Tristana owns actual TG child sources.
function mirrorForgeBoundary() {
  let state=api.createMatch(42);
  state=battle(state).ended;
  state=accepted(api.nextRound(state,state.round));
  const starter=players(state)[0];
  state=accepted(api.deployMatchUnit(state,starter.id,{kind:'bench',slot:0}));
  const holders: string[]=[];
  for(const definitionId of ['tristana','jayce']) {
    state=accepted(grantMechanicUnit(state,{receiptId:`mirror-boundary:${definitionId}`,source:'test',definitionId}));
    const holder=players(state).find(u=>u.definitionId===definitionId)!;
    holders.push(holder.id);
    state=accepted(api.deployMatchUnit(state,holder.id,{kind:'board',cell:{col:holders.length*2,row:4}}));
  }
  for(const [index,definitionId]of ['thiefs-gloves','TFT9_Item_OrnnTrickstersGlass'].entries()) {
    state=accepted(grantMechanicItem(state,{receiptId:`mirror-boundary:${definitionId}`,source:'test',definitionId}));
    state=accepted(api.equipItem(state,state.items.at(-1)!.id,holders[index],0));
  }
  const donor=holders[0],tg=state.items.find(i=>i.definitionId==='thiefs-gloves')!.id;
  state=battle(state).ended;
  expect(state.augmentHistory).toBeUndefined();
  expect(state.combat!.status).toBe('finished');
  expect(state.combat!.strategy!.units.some(u=>u.itemSummon?.kind==='mirror'&&u.itemSummon.unit.definitionId==='jayce')).toBe(true);
  expect(restoreMatch(serializeMatch(state))).toEqual(state);
  return {state,donor,tg};
}
const mirror=mirrorForgeBoundary();
const corruptions: readonly [string, (state: MutableMatch) => void, string][] = [
  ['basis equipment roll prefix', state => { state.combatInputBasis!.equipmentRollPrefixLength--; }, 'Invalid combat input basis'],
  ['basis TG parent moved without its children', state => {
    state.combatInputBasis!.inputs.items.find(item => item.id === CORRUPT_TG)!.location = { kind: 'unit', unitId: CORRUPT_SURVIVOR, slot: 0 };
  }, 'Invalid combat input basis'],
  ['basis temporary holder rewritten after upgrade', state => {
    state.combatInputBasis!.inputs.temporaryEquipment.forEach(child => { child.holderId = CORRUPT_SURVIVOR; });
  }, 'Invalid combat input basis'],
  ['basis one-star origin rewritten after upgrade', state => {
    state.combatInputBasis!.inputs.preparation.units.find(unit => unit.id === CORRUPT_DONOR)!.starLevel = 2;
  }, 'Invalid combat input basis'],
  ['basis anomaly target rewritten after upgrade', state => { state.combatInputBasis!.inputs.anomalyBinding!.unitId = CORRUPT_SURVIVOR; },
    'Invalid Match save: resolved strategy'],
  ['current TG parent falsely returned with matching empty children', state => {
    state.items.find(item => item.id === CORRUPT_TG)!.location = { kind: 'inventory' }; state.temporaryEquipment = [];
  }, 'Invalid B8 Match: finished resource projection'],
  ['current anomaly silently removed', state => { state.anomalyBinding = null; }, 'Invalid B8 Match: finished resource projection'],
  ['current child moved back to consumed donor', state => { state.temporaryEquipment.forEach(child => { child.holderId = DONOR; }); },
    'Invalid current temporary equipment projection'],
  ['original finished Combat star rewritten', state => { state.combat!.units.find(unit => unit.id === mirror.donor)!.starLevel = 2; },
    'Invalid authoritative Mirror forge replay'],
  ['original finished Combat child source parent rewritten', state => {
    state.combat!.units.find(unit => unit.id === mirror.donor)!.sources!.find(effect => effect.source.parentItemInstanceId === mirror.tg)!.source.parentItemInstanceId = 'item-3';
  }, 'Invalid authoritative Mirror forge replay'],
  ['reward receipt rewritten to survivor', state => {
    state.m8.loot.receipts.find(receipt => receipt.grantedUnitIds.includes(CORRUPT_REWARD))!.grantedUnitIds = [CORRUPT_SURVIVOR];
  }, 'Invalid resource provenance: receipt birth binding'],
  ['neutral death identity rewritten', state => { state.combat!.neutralReceipts!.deaths[0].eventSeq++; },
    'Invalid B8 Match: current death evidence'],
];
describe('B8 strict live transfer corruption boundaries', () => {
  it('does not retain or freeze a candidate command target in replay evidence', () => {
    const occupied=new Set(players(prepared).flatMap(u=>u.location.kind==='board'?[JSON.stringify(u.location.cell)]:[]));
    const cell=Array.from({length:28},(_,i)=>({col:i%7,row:4+Math.floor(i/7)})).find(c=>!occupied.has(JSON.stringify(c)))!;
    const moved=accepted(api.deployMatchUnit(prepared,DONOR,{kind:'board',cell}));
    const saved=JSON.stringify(moved),input:MutableMatch=JSON.parse(saved),proof=input.augmentHistory!.proof;
    if(proof.kind!=='solo')throw Error('Expected solo proof');
    expect(proof.commands.at(-1)!.name).toBe('deployMatchUnit');
    const target=proof.commands.at(-1)!.args[1] as {kind:'board';cell:{col:number;row:number}};
    expect(restoreMatch(input)).toEqual(moved);
    expect(Object.isFrozen(target)).toBe(false);
    expect(Object.isFrozen(target.cell)).toBe(false);
    target.cell.col=target.cell.col===0?1:0;
    expect(restoreMatch(saved)).toEqual(moved);
  });
  it.each(['facts','commands'] as const)('keeps warm historical replay evidence independent of candidate %s and detached origins', field => {
    const saved=serializeMatch(migration.beforeFinal),restored=restoreMatch(saved);
    expect(restored).toEqual(migration.beforeFinal);
    const bad:MutableMatch=JSON.parse(saved);
    if(field==='facts')Object.assign(bad.augmentHistory!.facts.at(-1)!,{invented:true});
    else {
      const proof=bad.augmentHistory!.proof;
      expect(proof.kind).toBe('solo');
      if(proof.kind!=='solo')throw Error('Expected solo proof');
      expect(proof.commands.at(-1)!.name).toBe('stepMatch');
      proof.commands.at(-1)!.count--;
    }
    expect(()=>restoreMatch(bad)).toThrow('Invalid augment history: replayed facts/state mismatch');
    const detached=restored.augmentHistory!.proof;
    if(detached.kind!=='solo')throw Error('Expected detached solo proof');
    Object.assign(detached.origin,{gold:detached.origin.gold+1});
    expect(restoreMatch(saved)).toEqual(migration.beforeFinal);
    expect(serializeMatch(migration.beforeFinal)).toBe(saved);
  });
  // The two original-route cases retain v25 history; Mirror Forge has its own
  // boundary route, and the remaining cases use the no-history alternate route.
  it.each(corruptions)('rejects %s without changing its source state', (label, change, message) => {
    const state=label.startsWith('original finished Combat')?mirror.state
      :label==='current child moved back to consumed donor'||label==='neutral death identity rewritten'?migration.selected:alternate.live.selected;
    const saved = serializeMatch(state), bad: MutableMatch = JSON.parse(saved);
    change(bad);
    expect(() => restoreMatch(bad)).toThrowError(new RegExp(`^${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    expect(serializeMatch(state)).toBe(saved);
  });
});
