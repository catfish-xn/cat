import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as api from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match';
import { accepted, freeze } from './match-helpers';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { grantMechanicGold, grantMechanicUnit, grantMechanicConsumable, grantMechanicItem } from '../src/simulation/seat-mechanics';
import { planUnitAcquisition } from '../src/simulation/unit-acquisition';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { resolveAnomalyBinding, reconcileMatchAnomaly } from '../src/simulation/anomaly-ownership';
import { resolveCarouselPreparation } from '../src/simulation/carousel-units';
import { resolveDeferredUpgrades } from '../src/simulation/deferred-upgrades';
import { PORTABLE_ANOMALY_PREFIX } from '../src/simulation/content/augment-pool-batch5-r2';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import { snapshotForBattle, restorePlayerBattleSnapshot } from '../src/simulation/two-sided-snapshot';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { nextRandom } from '../src/simulation/rng';
import { enableMultiplayerSettlement, applyRoundSettlement, ROUND_SETTLEMENT_VERSION } from '../src/simulation/round-settlement';
import { compileBattle, resolveTwoSidedBattle, proposeSettlement } from '../src/simulation/two-sided-battle';
import { readG23Progress } from '../src/simulation/g2-3-state';
import { mechanicGrantEvents } from '../src/simulation/g2-3-runtime';
import { BattleHistory, PlaybackSession, validateBattleRecord } from '../src/replay';
import type { LedgerCombatEvent } from '../src/simulation/combat-types';

// One public-command route, shared by independent immutable branches. No injected
// units, shop offers, selection receipts, currency, stars or provenance in these saves.
let prefix: MatchState | undefined;
const stop = Error('R5 public anomaly prefix');
try {
  await createRequire(import.meta.url)('../scripts/generate-m5-route.cjs').run(api, {
    build: 'sniper', seed: 43,
    augmentPriorities: ['pumping-up-iii','bulky-buddies-iii','pumping-up-ii','bulky-buddies-ii','manaflow-ii','pumping-up-i','bulky-buddies-i','manaflow-i'],
    onStep(_before: MatchState, result: { state: MatchState }) {
      if (result.state.roundDefinitionId === '4-6' && result.state.pendingChoice?.kind === 'anomaly') {
        prefix = result.state; throw stop;
      }
    },
  });
} catch (error) { if (error !== stop) throw error; }
if (!prefix) throw Error('Missing public anomaly prefix');
const grant = (s: MatchState, receiptId: string, definitionId: string, starLevel?: 1 | 2 | 3) =>
  accepted(grantMechanicUnit(s, { receiptId, source: 'r5-test', definitionId, ...(starLevel ? { starLevel } : {}) }));
const funded = accepted(grantMechanicGold(prefix, {receiptId:'r5:budget',source:'r5-test',amount:1000}));
function choose(id: string): MatchState {
  let s = funded;
  const unit = s.preparation.units.find(u => u.team === 'player' && u.definitionId === 'irelia')!;
  s = accepted(api.selectAnomalyTarget(s, s.pendingChoice!.choiceId, s.pendingChoice!.generation, unit.id));
  for (let n = 0; n < 500 && s.pendingChoice!.offers[0] !== id; n++)
    s = accepted(api.rerollAnomaly(s, s.pendingChoice!.choiceId, s.pendingChoice!.generation));
  expect(s.pendingChoice!.offers).toEqual([id]);
  return accepted(api.selectChoice(s, s.pendingChoice!.choiceId, s.pendingChoice!.generation, id));
}
const selected = choose('bulwark');
function dormant(initial = selected): MatchState {
  let s = initial;
  for (const u of s.preparation.units.filter(u => u.team === 'player' && u.definitionId === s.anomalySelection!.championDefinitionId))
    s = accepted(api.sellUnit(s, u.id));
  return s;
}
const sold = dormant();
function roundTrip(s: MatchState): void {
  const text = serializeMatch(s);
  expect(restoreMatch(text)).toEqual(s);
  expect(restoreMatch(s)).toEqual(s);
  expect(serializeMatch(restoreMatch(text))).toBe(text);
}

it.each(['4-4','4-6'])('rejects an unsettled %s carousel target atomically and allows it after preparation settlement', roundId => {
  // Isolated target-gate vector: receipt metadata marks an already placed hero
  // as deferred; this does not claim a legal carousel occurs in round 4-6.
  const unit = funded.preparation.units.find(u => u.team === 'player' && u.definitionId === 'irelia')!;
  const receipt: import('../src/simulation/carousel-types').CarouselReceipt = {
    id:'r5:target:owner',carouselId:`r5:carousel:${roundId}`,seatId:'owner',slot:0,
    definitionId:unit.definitionId,itemId:'sword',holdingSource:'r5:target',unitId:unit.id,
    itemInstanceId:null,status:'granted',
  };
  const state = freeze({...funded,carousel:{receipts:[receipt],heldCarouselUnits:[],pendingUnits:[],preparationReceipts:[]}});
  const choice = state.pendingChoice!, before = JSON.stringify(state);
  const rejected = api.selectAnomalyTarget(state,choice.choiceId,choice.generation,unit.id);
  expect(rejected).toEqual({ok:false,state,reason:'invalid-target'});
  expect(rejected.state).toBe(state);
  expect(JSON.stringify(state)).toBe(before); // All RNG streams, resources, IDs and history stay unchanged.
  const settled = {...state,carousel:{...state.carousel,preparationReceipts:[receipt.id]}};
  const selected = api.selectAnomalyTarget(settled,choice.choiceId,choice.generation,unit.id);
  expect(accepted(selected).pendingChoice).toMatchObject({step:'offer',targetId:unit.id,generation:choice.generation+1});
  expect(selected.ok && selected.events.filter(e=>e.type==='anomalyTargetSelected')).toEqual([
    {type:'anomalyTargetSelected',choiceId:choice.choiceId,unitId:unit.id,domain:'match',eventSeq:state.nextMatchEventSeq},
  ]);
  expect(accepted(api.selectAnomalyTarget(funded,choice.choiceId,choice.generation,unit.id)).pendingChoice?.targetId).toBe(unit.id);
});

it('keeps a unit-free entitlement on sale, exposes it only to the owner, and authenticates it on restore', () => {
  expect(sold.anomalySelection).toEqual({definitionId:'bulwark',championDefinitionId:'irelia',choiceId:'round:4-6:anomaly',boundRound:23});
  expect(sold.anomalyBinding).toBeNull();
  expect(toPrivateSeatView(sold).anomalySelection).toEqual(sold.anomalySelection);
  expect(snapshotForBattle(sold, 'owner').anomalyBinding).toBeNull();
  expect(snapshotForBattle(sold, 'owner')).not.toHaveProperty('anomalySelection');
  roundTrip(sold);
  for (const mutate of [
    (s: any) => { s.anomalySelection = null; },
    (s: any) => { s.anomalySelection.championDefinitionId = 'darius'; },
    (s: any) => { s.anomalySelection.choiceId = 'forged'; },
    (s: any) => { s.anomalyBinding = selected.anomalyBinding; },
    (s: any) => { s.resourceProvenance.entries = s.resourceProvenance.entries.filter((e: any) => e.kind !== 'anomaly-selected'); },
  ]) {
    const bad = structuredClone(sold); mutate(bad);
    expect(() => restoreMatch(bad)).toThrow();
    expect(() => restoreMatch(JSON.stringify(bad))).toThrow();
    expect(() => serializeMatch(bad)).toThrow();
  }
});

it('restores through a real paid shop purchase and freezes the new identity in PvE and both PvP sides', () => {
  let s = sold;
  for (let n = 0; n < 300 && !s.shop.slots.some(o => o.status === 'available' && o.definitionId === 'irelia'); n++)
    s = accepted(api.rerollShop(s));
  const slot = s.shop.slots.findIndex(o => o.status === 'available' && o.definitionId === 'irelia');
  expect(slot).toBeGreaterThanOrEqual(0);
  const before = s, bought = api.buyUnit(s, slot, s.shop.generation); s = accepted(bought);
  expect(s.anomalyBinding).toEqual({...selected.anomalyBinding,unitId:`unit-${before.nextUnitSerial}`});
  expect(bought.ok && bought.events.some(e => e.type === 'anomalyRestored')).toBe(true);
  expect(s.choiceRngState).toBe(before.choiceRngState);
  s = accepted(api.deployMatchUnit(s, s.anomalyBinding!.unitId, {kind:'board',cell:{col:6,row:7}}));
  const id = s.anomalyBinding!.unitId;
  expect(buildStrategySnapshot(s).units.filter(u => u.sources.some(e => e.source.sourceKind === 'anomaly')).map(u => u.unitId)).toEqual([id]);
  expect(freezeCombatInput(s,nextRandom(s.battleSeedRngState).word,s.resourceProvenance.entries.length).inputs.anomalyBinding).toEqual(s.anomalyBinding);
  for (const seat of ['a','b']) expect(restorePlayerBattleSnapshot(snapshotForBattle(s,seat)).anomalyBinding).toEqual(s.anomalyBinding);
  roundTrip(s); roundTrip(accepted(api.startMatchCombat(s)));
  expect(api.buyUnit(s,slot,before.shop.generation)).toEqual({ok:false,state:s,reason:'purchased-slot'});
});

it('mechanic gifts and champion duplicators retain one holder and follow the recursive merge survivor', () => {
  let s = grant(sold,'r5:gift','irelia');
  expect(mechanicGrantEvents(sold,s).filter(e=>e.type==='anomalyRestored')).toEqual([{type:'anomalyRestored',...s.anomalyBinding!}]);
  const first = s.anomalyBinding!.unitId;
  s = grant(s,'r5:second','irelia');
  expect(s.anomalyBinding!.unitId).toBe(first);
  s = accepted(grantMechanicConsumable(s,{receiptId:'r5:duplicator',source:'r5-test',definitionId:'TFT_Consumable_NeekosHelp'}));
  const tool = s.consumables.at(-1)!;
  s = accepted(api.useConsumable(s,tool.consumableId,{kind:'unit',unitId:first}));
  expect(s.preparation.units.find(u => u.id === s.anomalyBinding!.unitId)).toMatchObject({definitionId:'irelia',starLevel:2});
  expect(s.anomalySelection).toEqual(selected.anomalySelection);
  const retry = api.useConsumable(s,tool.consumableId,{kind:'unit',unitId:first});
  expect(retry.ok).toBe(false);expect(retry.state).toBe(s);
  roundTrip(s);
});

it.each(['shop','loot','mechanic'] as const)('%s planner restores entitlement without acquisition side effects or RNG', source => {
  const origin = source === 'shop' ? {kind:source,generation:sold.shop.generation,slotIndex:0,definitionId:'irelia'}
    : {kind:source,receiptId:'r5:source'};
  const before = JSON.stringify(sold), plan = planUnitAcquisition(sold,'irelia',origin,sold.resourceProvenance.entries.length);
  expect(plan.ok).toBe(true);if (!plan.ok) return;
  expect(plan.anomalyBinding).toEqual({...selected.anomalyBinding,unitId:plan.unitId});
  expect(plan.facts.map(f => f.kind)).toEqual(['unit-acquired']);
  expect(plan.events.map(e => e.type)).toEqual(['anomalyRestored']);
  expect(JSON.stringify(sold)).toBe(before);
});

it('keeps a sticky holder, uses lexical fallback and removes portable equipment from the restored native holder', () => {
  const selection = selected.anomalySelection!, binding = selected.anomalyBinding!;
  const heroes = [{id:'unit-3',definitionId:'irelia',starLevel:1},{id:'unit-20',definitionId:'irelia',starLevel:2}];
  expect(resolveAnomalyBinding(selection,null,heroes)?.unitId).toBe('unit-20');
  expect(resolveAnomalyBinding(selection,{...binding,unitId:'unit-3'},heroes)?.unitId).toBe('unit-3');
  let s = grant(sold,'r5:portable-holder','irelia');
  s = grant(s,'r5:portable-second','irelia');
  const original = s.anomalyBinding!.unitId, other = s.preparation.units.find(u=>u.team==='player'&&u.definitionId==='irelia'&&u.id!==original)!;
  s = accepted(grantMechanicItem(s,{receiptId:'r5:portable',source:'r5-test',definitionId:PORTABLE_ANOMALY_PREFIX+'bulwark'}));
  const item = s.items.find(i=>i.definitionId===PORTABLE_ANOMALY_PREFIX+'bulwark')!;
  s = accepted(api.equipItem(s,item.id,other.id,0));
  const result = api.sellUnit(s,original);s=accepted(result);
  expect(s.anomalyBinding!.unitId).toBe(other.id);
  expect(s.items.find(i=>i.id===item.id)!.location).toEqual({kind:'inventory'});
  expect(result.ok&&result.events.filter(e=>e.type==='itemsReturned').some(e=>e.itemIds.includes(item.id))).toBe(true);
  expect(api.equipItem(s,item.id,other.id,0)).toEqual({ok:false,state:s,reason:'item-restricted'});
});

it('carousel custody waits for preparation placement, then restores after merge; repeated reconciliation is inert', () => {
  const unitId=`unit-${sold.nextUnitSerial}`, receiptId='r5:carousel';
  // Isolated carousel placement vector; restoration authenticity is tested above
  // with public saves and by the existing shared carousel ledger suite.
  const receipt:any={id:receiptId,carouselId:'r5:carousel:4-4',unitId,definitionId:'irelia'};
  const pending={receiptId,unitId,definitionId:'irelia'};
  const state:MatchState={...sold,carousel:{receipts:[receipt],heldCarouselUnits:[pending],pendingUnits:[pending],preparationReceipts:[]}};
  expect(reconcileMatchAnomaly(state).anomalyBinding).toBeNull();
  const resolved=resolveCarouselPreparation(state);
  expect(resolved.state.anomalyBinding?.unitId).toBe(unitId);
  expect(resolveCarouselPreparation(resolved.state)).toEqual({state:resolved.state,events:[]});
});

it('deferred combat purchases follow the ordinary survivor; physical 1/2-star copies cannot inherit Ultimate Hero', () => {
  let base=grant(sold,'r5:deferred:first','irelia');const first=base.anomalyBinding!.unitId;
  base=accepted(api.deployMatchUnit(base,first,{kind:'board',cell:{col:6,row:7}}));
  const one=planUnitAcquisition(base,'irelia',{kind:'mechanic',receiptId:'r5:deferred:second'},0,true);
  expect(one.ok).toBe(true);if(!one.ok)return;
  const two=planUnitAcquisition({...one},'irelia',{kind:'mechanic',receiptId:'r5:deferred:third'},1,true);
  expect(two.ok).toBe(true);if(!two.ok)return;
  const selection={...base.anomalySelection!,definitionId:'ultimate-hero'};
  expect(resolveAnomalyBinding(selection,null,two.preparation.units)).toBeNull();
  const enabled=enableMultiplayerSettlement({...base,...two},'a');expect(enabled.ok).toBe(true);if(!enabled.ok)return;const state=enabled.state;
  const merged=resolveDeferredUpgrades(state);
  expect(merged.state.anomalyBinding!.unitId).toBe(first);
  expect(readG23Progress(merged.state)).toEqual(readG23Progress(base));
});

it.each(['dual-wielding','avarice-incarnate'])('%s sale/reacquisition never repeats its one-time reward', id => {
  const original=choose(id), empty=dormant(original), s=grant(empty,`r5:reacquire:${id}`,'irelia');
  expect(s.anomalyBinding?.choiceId).toBe(original.anomalyBinding!.choiceId);
  expect(s.items).toEqual(empty.items);
  expect(s.gold).toBe(empty.gold);
  expect(s.seatMechanics!.receipts.filter(r=>r.receiptId.includes('s13-anomaly:')||r.receiptId.includes('avarice-gold')))
    .toEqual(original.seatMechanics!.receipts.filter(r=>r.receiptId.includes('s13-anomaly:')||r.receiptId.includes('avarice-gold')));
  roundTrip(s);
});

it('bench sale may restore a future board Headhunter without changing this frozen PvP battle or its growth receipt', () => {
  let s=choose('headhunter');
  const native=s.anomalyBinding!.unitId, unit=s.preparation.units.find(u=>u.id===native)!;
  const slot=Array.from({length:s.preparation.benchSize},(_,i)=>i).find(i=>!s.preparation.units.some(u=>u.location.kind==='bench'&&u.location.slot===i))!;
  s=accepted(api.deployMatchUnit(s,native,{kind:'bench',slot}));
  s=grant(s,'r5:frozen-copy',unit.definitionId);
  const other=s.preparation.units.find(u=>u.team==='player'&&u.definitionId===unit.definitionId&&u.id!==native)!;
  s=accepted(api.deployMatchUnit(s,other.id,{kind:'board',cell:{col:6,row:7}}));
  const enabled=enableMultiplayerSettlement(s,'a');expect(enabled.ok).toBe(true);if(!enabled.ok)return;s=enabled.state;
  const input=compileBattle(snapshotForBattle(s,'a'),snapshotForBattle(s,'b'),123,{battleId:'r5-frozen'});
  s=accepted(api.lockMatchCombatRoster(s));
  expect(s.multiplayer!.combatAnomaly!.binding).toBeNull();
  s=accepted(api.sellUnit(s,native));
  expect(s.anomalyBinding!.unitId).toBe(other.id);
  const battle=resolveTwoSidedBattle(input,5000), p=proposeSettlement(battle).a;
  expect(p.g23Facts?.d11Headhunter).toBeUndefined();
  const settled=applyRoundSettlement(s,{version:ROUND_SETTLEMENT_VERSION,settlementId:'r5-frozen:a',battleId:p.battleId,seatId:p.seatId,
    round:s.round,roundId:p.roundId,settlementEligible:p.settlementEligible,result:p.result,damage:p.damage,baseDamage:p.baseDamage,
    opposingSurvivors:p.opposingSurvivors,growth:p.growth,g23Facts:p.g23Facts,combatTicks:battle.terminal.tick,combatEventCount:battle.events.length});
  expect(settled.ok).toBe(true);if(!settled.ok)return;
  expect(settled.state.anomalyBinding!.unitId).toBe(other.id);
  expect(settled.state.multiplayer).not.toHaveProperty('combatAnomaly');
});

it('records and replays a restored holder with the same terminal state, events and retained qualification',()=>{
  let s=grant(sold,'r5:replay','irelia');
  s=accepted(api.deployMatchUnit(s,s.anomalyBinding!.unitId,{kind:'board',cell:{col:6,row:7}}));
  const context=restoreMatch(serializeMatch(s)), history=new BattleHistory('r5:replay');
  const observe=(before:MatchState,result:{state:MatchState;events:readonly api.MatchEvent[]},reason:'command'|'tick')=>{
    history.observe({before,after:result.state,events:result.events.filter((e):e is LedgerCombatEvent=>'tick' in e),reason});
    return result.state;
  };
  const opened=api.startMatchCombat(context);expect(opened.ok).toBe(true);if(!opened.ok)return;
  s=observe(context,opened,'command');
  while(s.phase==='combat')s=observe(s,api.stepMatch(s),'tick');
  const record=history.completedRecords[0];expect(record).toBeDefined();
  const verified=validateBattleRecord(JSON.parse(JSON.stringify(record)));
  expect(verified.settledMatch).toEqual(s);
  expect(record.context.anomalySelection).toEqual(selected.anomalySelection);
  expect(record.context.anomalyBinding).toEqual(context.anomalyBinding);
  const playback=new PlaybackSession(record);
  expect(playback.seek(record.endTick).combat).toEqual(s.combat);
  expect(playback.read().events).toEqual(record.events);
  expect(playback.seek(0).combat).toEqual(record.initial);
});
