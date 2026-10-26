import {lootPlan as independentLootPlan} from './fixtures/orb-combo-oracle.cjs';
import { describe, expect, it } from 'vitest';
import { advanceItemMatchRoute, itemMatch } from './fixtures/m8-b4-match';
import { stepMatch } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';

describe('B8 public equipment fixture provenance', () => {
  // The public acquisition routes (to 2-5 and 3-5) play one round per case, so no case replays a whole route under
  // CI load; the provenance cases below use the cached result (a filtered case plays the route itself).
  for (const [label, id, last] of [['Bloodthirster', 'bloodthirster', 8], ['Hand of Justice', 'hand-of-justice', 15],
    ['double Bloodthirster', ['bloodthirster', 'bloodthirster'], 15]] as const) {
    for (let round = 1; round <= last; round++) it(`public ${label} acquisition plays round ${round}`, () => {
      // Another file in the run may already have published the finished acquisition.
      const acquired = advanceItemMatchRoute(id, round);
      if (round === last) expect(acquired).toBe(true);
    });
  }
  it('wins the real opening, receives its oracle-defined heroes and combines the two real opening components', () => {
    const state = itemMatch('bloodthirster');
    const expected=new Map(independentLootPlan(state.seed,state.round).rounds.flatMap(r=>r.encounterPlan.drops.map(d=>[d.dropId,d.payload] as const)));
    for(const receipt of state.m8.loot.receipts)expect(receipt.payload).toEqual(expected.get(receipt.dropId));
    expect(state.roundDefinitionId).toBe('2-5');
    expect(state.roundResults.slice(0,3).map(result => [result.roundId, result.result])).toEqual([
      ['1-2', 'playerWin'], ['1-3', 'playerWin'], ['1-4', 'playerWin'],
    ]);
    expect(state.preparation.units.filter(unit => ['unit-1','unit-2','unit-3'].includes(unit.id)).map(unit => [unit.id, unit.definitionId, unit.starLevel])).toEqual([
      ['unit-1', 'irelia', 1], ['unit-2', 'tristana', 1], ['unit-3', 'lux', 1],
    ]);
    expect(state.resourceProvenance.entries.filter(entry=>entry.kind==='unit-acquired'&&['unit-1','unit-2','unit-3'].includes(entry.unitId)).map(entry=>entry.kind==='unit-acquired'?[entry.roundId,entry.unitId,entry.source.kind]:[])).toEqual([["1-2","unit-1","opening"],["1-2","unit-2","loot"],["1-3","unit-3","loot"]]);
    expect(state.m8.loot.receipts.filter(r=>r.payload.kind==='item').map(r=>[r.payload,r.grantedItemIds])).toEqual([[{"kind":"item","definitionId":"sword","quantity":1},["item-1"]],[{"kind":"item","definitionId":"cloak","quantity":1},["item-2"]],[{"kind":"item","definitionId":"sword","quantity":1},["item-3"]]]);
    // v24 preserves the seed's independent item/holder vector. The selected
    // trait card cannot affect Irelia; its actual Renni gift remains benched.
    expect(state.augments.map(augment => augment.definitionId)).toEqual(['crimson-pact']);
    expect(state.preparation.units.find(unit=>unit.team==='player'&&unit.definitionId==='renni')?.location.kind).toBe('bench');
    expect(state.resourceProvenance.entries.filter(e=>e.kind==='item-acquired').map(e=>e.kind==='item-acquired'?[e.roundId,e.itemId,e.source.kind]:[])).toEqual([["1-2","item-1","loot"],["1-3","item-2","loot"],["1-4","item-3","loot"],["2-4","item-4","schedule"]]);
    expect(state.resourceProvenance.entries.filter(e=>e.kind==='item-combined').map(e=>e.kind==='item-combined'?e.event:null)).toEqual([{"type":"itemCombined","consumedIds":["item-1","item-2"],"itemId":"item-5","definitionId":"bloodthirster"}]);
    expect(state.items).toEqual([{"id":"item-3","definitionId":"sword","location":{"kind":"inventory"}},{"id":"item-4","definitionId":"sword","location":{"kind":"inventory"}},{"id":"item-5","definitionId":"bloodthirster","location":{"kind":"unit","unitId":"unit-1","slot":0}}]);
    expect(state.combat!.units.filter(unit => unit.team === 'player').map(unit => [unit.id, unit.maxHp])).toEqual([['unit-1', 700]]);
    const restored = restoreMatch(serializeMatch(state));
    expect(restored).toEqual(state);
    expect(stepMatch(restored)).toEqual(stepMatch(state));
  });

  it('equips the actual dropped Lux while preserving the original Irelia on the bench', () => {
    const state = itemMatch('hand-of-justice', 'unit-3');
    expect(state.roundDefinitionId).toBe('3-5');
    expect(state.preparation.units.find(unit => unit.id === 'unit-1')).toMatchObject({ definitionId: 'irelia', location: { kind: 'bench' } });
    expect(state.preparation.units.find(unit => unit.id === 'unit-3')).toMatchObject({ definitionId: 'lux', location: { kind: 'board', cell: { col: 5, row: 4 } } });
    expect(state.combat!.units.filter(unit => unit.team === 'player').map(unit => unit.id)).toEqual(['unit-3']);
    expect(restoreMatch(state)).toEqual(state);
  });

  it('obtains components three and four from real scheduled choices and starts two Bloodthirsters at 3-5', () => {
    const state = itemMatch(['bloodthirster', 'bloodthirster']);
    expect(state.roundDefinitionId).toBe('3-5');
    // Keep the original opening drops and supply choices; Pumping Up III and
    // Bronze For Life II add no items or isolated-holder maximum health.
    expect(state.scheduleReceipts.filter(r=>r.kind==='component').map(r=>[r.definitionId,r.itemIds])).toEqual([["cloak",["item-4"]],["sword",["item-8"]]]);
    expect(state.resourceProvenance.entries.filter(e=>e.kind==='item-acquired').map(e=>e.kind==='item-acquired'?[e.roundId,e.itemId,e.source.kind]:[])).toEqual([["1-2","item-1","loot"],["1-3","item-2","loot"],["1-4","item-3","loot"],["2-4","item-4","schedule"],["2-7","item-5","loot"],["2-7","item-6","loot"],["2-7","item-7","loot"],["3-4","item-8","schedule"]]);
    expect(state.items.map(i=>[i.id,i.definitionId])).toEqual([["item-10","bloodthirster"],["item-3","sword"],["item-5","gloves"],["item-6","bow"],["item-7","sword"],["item-9","bloodthirster"]]);
    expect(state.resourceProvenance.entries.filter(e=>e.kind==='item-combined').map(e=>e.kind==='item-combined'?e.event:null)).toEqual([{"type":"itemCombined","consumedIds":["item-1","item-2"],"itemId":"item-9","definitionId":"bloodthirster"},{"type":"itemCombined","consumedIds":["item-4","item-8"],"itemId":"item-10","definitionId":"bloodthirster"}]);
    expect(state.augments.map(augment => augment.definitionId)).toEqual(['pumping-up-iii','bronze-for-life-ii']);
    expect(state.augmentProgress.investmentHp).toBe(0);
    expect(state.combat!.units.filter(unit => unit.team === 'player').map(unit => [unit.id, unit.maxHp])).toEqual([['unit-1', 700]]);
    const restored = restoreMatch(serializeMatch(state));
    expect(restored).toEqual(state);
    expect(stepMatch(restored)).toEqual(stepMatch(state));
  });

  it('returns detached snapshots and does not reuse caller-mutated resources or provenance', () => {
    const first = itemMatch('bloodthirster'), original = serializeMatch(first);
    Object.assign(first.preparation.units.find(unit => unit.id === 'unit-1')!, { definitionId: 'garen' });
    Object.assign(first.items[0], { definitionId: 'warmog' });
    expect(() => Object.assign(first.resourceProvenance.entries[0], { unitId: 'forged' })).toThrow(TypeError);
    const second = itemMatch('bloodthirster');
    expect(second.resourceProvenance).not.toBe(first.resourceProvenance);
    expect(serializeMatch(second)).toBe(original);
    expect(restoreMatch(second)).toEqual(second);
  });
});
