import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { accepted, battle, transferPreparation, players, plan } from './fixtures/t13-loot-public';
const SURVIVOR='unit-9',DONOR='unit-13',REWARD='unit-24',TG='item-9';
const prepared=await transferPreparation();
const make=(s:MatchState)=>{const l=battle(s);if(!l.revealed)throw Error('Missing live reveal');return {...l,revealed:l.revealed,selected:l.ended};};
const migration=make(prepared), conflict=make(accepted(api.equipItem(prepared,'item-6',SURVIVOR,0)));
const scenarios=[{name:'TG migrates',live:migration,returned:false},{name:'conflicting TG returns',live:conflict,returned:true}];
function roundTrip(s:MatchState):MatchState {const saved=serializeMatch(s),r=restoreMatch(saved);expect(r).toEqual(s);expect(r).not.toBe(s);expect(serializeMatch(s)).toBe(saved);return r;}
describe('B8 live randomized reward upgrade with equipment, anomaly and G12 transfer',()=>{
 it('pins the real two paid Ezreals, glove recipe, anomaly target and reward identity',()=>{
  expect(players(prepared).filter(u=>u.definitionId==='ezreal').map(u=>[u.id,u.starLevel])).toEqual([[DONOR,1],[SURVIVOR,1]]);
  expect(prepared.resourceProvenance.entries.filter(e=>e.kind==='unit-acquired'&&[SURVIVOR,DONOR].includes(e.unitId)).every(e=>e.kind==='unit-acquired'&&e.source.kind==='shop')).toBe(true);
  expect(prepared.resourceProvenance.entries.filter(e=>e.kind==='unit-acquired'&&[DONOR,SURVIVOR].includes(e.unitId))).toEqual([
   {kind:'unit-acquired',unitId:SURVIVOR,source:{kind:'shop',generation:14,slotIndex:4,definitionId:'ezreal'},sequence:29,roundId:'3-3'},
   {kind:'unit-acquired',unitId:DONOR,source:{kind:'shop',generation:20,slotIndex:3,definitionId:'ezreal'},sequence:34,roundId:'3-3'},
  ]);
  // W4 public-route accounting: 23 births + 20 growth + 10 item births + 5 upgrades + 3 combines + 2 sales + 4 placements = 67.
  expect(['unit-acquired','combat-growth-committed','item-acquired','unit-upgraded','item-combined','unit-sold','item-equipped'].map(kind=>prepared.resourceProvenance.entries.filter(e=>e.kind===kind).length)).toEqual([23,20,10,5,3,2,4]);
  expect(prepared.items.find(i=>i.id===TG)).toEqual({id:TG,definitionId:'thiefs-gloves',location:{kind:'unit',unitId:DONOR,slot:0}});
  expect(prepared.anomalyBinding).toEqual({definitionId:'slime-time',unitId:DONOR,choiceId:'round:4-6:anomaly',boundRound:23});
  expect(prepared.equipmentState.rolls).toHaveLength(10);
  expect(prepared.resourceProvenance.entries).toHaveLength(67);
  expect(prepared.nextUnitSerial).toBe(24);
  expect(plan(prepared).encounterPlan.drops.map(d=>d.payload)).toEqual([{kind:'item',definitionId:'cloak',quantity:1},{kind:'item',definitionId:'rod',quantity:1},{kind:'gold',quantity:4},{kind:'unit',definitionId:'ezreal',quantity:1},{kind:'consumable',definitionId:'magnetic-remover',quantity:1}]);
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
  expect(a.m8.loot.receipts).toHaveLength(prepared.m8.loot.receipts.length+5);
  expect(api.nextRound(roundTrip(a),24)).toEqual(api.nextRound(a,24));
  const next=roundTrip(accepted(api.nextRound(a,24)));expect(next.roundDefinitionId).toBe('5-1');
  expect(next.m8.loot.receipts).toEqual(a.m8.loot.receipts);expect(next.resourceProvenance).toEqual(a.resourceProvenance);
  expect(next.equipmentState.rolls.length).toBe(returned?10:11);
  expect(next.equipmentState.equipment.draws).toBe(returned?20:22);
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
const corruptions: readonly [string, (state: MutableMatch) => void, string][] = [
  ['basis equipment roll prefix', state => { state.combatInputBasis!.equipmentRollPrefixLength--; }, 'Invalid combat input basis'],
  ['basis TG parent moved without its children', state => {
    state.combatInputBasis!.inputs.items.find(item => item.id === TG)!.location = { kind: 'unit', unitId: SURVIVOR, slot: 0 };
  }, 'Invalid combat input basis'],
  ['basis temporary holder rewritten after upgrade', state => {
    state.combatInputBasis!.inputs.temporaryEquipment.forEach(child => { child.holderId = SURVIVOR; });
  }, 'Invalid combat input basis'],
  ['basis one-star origin rewritten after upgrade', state => {
    state.combatInputBasis!.inputs.preparation.units.find(unit => unit.id === DONOR)!.starLevel = 2;
  }, 'Invalid combat input basis'],
  ['basis anomaly target rewritten after upgrade', state => { state.combatInputBasis!.inputs.anomalyBinding!.unitId = SURVIVOR; },
    'Invalid Match save: resolved strategy'],
  ['current TG parent falsely returned with matching empty children', state => {
    state.items.find(item => item.id === TG)!.location = { kind: 'inventory' }; state.temporaryEquipment = [];
  }, 'Invalid B8 Match: finished resource projection'],
  ['current anomaly silently removed', state => { state.anomalyBinding = null; }, 'Invalid B8 Match: finished resource projection'],
  ['current child moved back to consumed donor', state => { state.temporaryEquipment.forEach(child => { child.holderId = DONOR; }); },
    'Invalid current temporary equipment projection'],
  ['original finished Combat star rewritten', state => { state.combat!.units.find(unit => unit.id === DONOR)!.starLevel = 2; },
    'Invalid Match save: combat unit identity'],
  ['original finished Combat child source parent rewritten', state => {
    state.combat!.units.find(unit => unit.id === DONOR)!.sources!.find(effect => effect.source.parentItemInstanceId === TG)!.source.parentItemInstanceId = 'item-3';
  }, 'Invalid Match save: resolved effect source/trigger'],
  ['reward receipt rewritten to survivor', state => {
    state.m8.loot.receipts.find(receipt => receipt.grantedUnitIds.includes(REWARD))!.grantedUnitIds = [SURVIVOR];
  }, 'Invalid resource provenance: receipt birth binding'],
  ['neutral death identity rewritten', state => { state.combat!.neutralReceipts!.deaths[0].eventSeq++; },
    'Invalid B8 Match: current death evidence'],
];
describe('B8 strict live transfer corruption boundaries', () => {
  it.each(corruptions)('rejects %s without changing the live route', (_label, change, message) => {
    const saved = serializeMatch(migration.selected), bad: MutableMatch = JSON.parse(saved);
    change(bad);
    expect(() => restoreMatch(bad)).toThrowError(new RegExp(`^${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    expect(serializeMatch(migration.selected)).toBe(saved);
  });
});
