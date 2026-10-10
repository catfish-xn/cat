import { describe, expect, it } from 'vitest';
import { createMatch, deployMatchUnit, nextRound, selectChoice, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted, emptyBoard, finish, resolveM5Choices } from './match-helpers';

const copy = <T>(value: T): T => structuredClone(value);
function roundTrip(state: MatchState): MatchState {
  const before = copy(state), restored = restoreMatch(serializeMatch(state));
  expect(restored).toEqual(before); expect(state).toEqual(before);
  return restored;
}
function openingChoice(): MatchState {
  let state = finish(accepted(startMatchCombat(createMatch(42))));
  expect(state.m8.loot.receipts[0].grantedUnitIds).toEqual(['unit-2']);
  state = accepted(nextRound(state,state.round));
  state = accepted(deployMatchUnit(state,'unit-2',{kind:'board',cell:{col:3,row:4}}));
  state = finish(accepted(startMatchCombat(state)));
  expect(state.phase).toBe('choice');
  return state;
}
function reject(state: MatchState, change: (value: any) => void): void {
  const bad = copy(state); change(bad);
  expect(() => restoreMatch(bad),change.toString()).toThrow();
}

describe('B8 default Match own restore', () => {
  it('round-trips preparation, running, reveal, finished choice and choice resolution without issuing anything', () => {
    let state = roundTrip(createMatch(42));
    state = roundTrip(accepted(startMatchCombat(state)));
    while (state.phase === 'combat') {
      state = stepMatch(state).state;
      if (state.m8.loot.earnedEvidence.length || state.phase !== 'combat') roundTrip(state);
    }
    expect(state.m8.loot.direct[0].status).toBe('granted');
    expect(state.combatInputBasis!.inputs.preparation.units.some(unit => unit.id === 'unit-2')).toBe(false);
    expect(state.preparation.units.some(unit => unit.id === 'unit-2')).toBe(true);
    state = roundTrip(openingChoice());
    const choice = state.pendingChoice!;
    state = roundTrip(accepted(selectChoice(state,choice.choiceId,choice.generation,'sword')));
    expect(state.m8.loot.receipts.at(-1)?.payload).toEqual({kind:'item',definitionId:'sword',quantity:1});
    expect(state.scheduleReceipts).toEqual([]);
    state = roundTrip(accepted(nextRound(state,state.round)));
    expect(state.combatInputBasis).toBeNull();
  });
  it('resumed combat has identical complete final state and events to uninterrupted combat', () => {
    let state = accepted(startMatchCombat(createMatch(17)));
    for (let tick=0;tick<17;tick++) state = stepMatch(state).state;
    let uninterrupted = state, resumed = roundTrip(state);
    while (uninterrupted.phase === 'combat') {
      const a = stepMatch(uninterrupted), b = stepMatch(resumed);
      expect(b.events).toEqual(a.events); expect(b.state).toEqual(a.state);
      uninterrupted = a.state; resumed = b.state;
    }
    roundTrip(resumed);
  });
  it('retains input and zero-delta commit for immediate empty-board finishes', () => {
    const state = accepted(startMatchCombat(emptyBoard(createMatch(42))));
    expect(state.combat?.tick).toBe(0); expect(state.combatInputBasis).not.toBeNull();
    expect(state.resourceProvenance.entries.at(-1)).toMatchObject({kind:'combat-growth-committed',sourceDeltas:[]});
    expect(state.m8.loot.direct[0].status).toBe('forfeited'); roundTrip(state);
  });
  it('rejects missing, forged or changed basis and running resources', () => {
    const state = accepted(startMatchCombat(createMatch(42)));
    for (const change of [
      (s:any) => { s.combatInputBasis = null; },
      (s:any) => { s.combatInputBasis.battleSeed++; },
      (s:any) => { s.combatInputBasis.provenancePrefixLength = 0; },
      (s:any) => { s.combatInputBasis.inputs.preparation.units[0].starLevel = 2; },
      (s:any) => { s.combatInputBasis.inputs.items.push({id:'item-1',definitionId:'sword',location:{kind:'inventory'}}); },
      (s:any) => { s.preparation.units[0].location.cell.col++; },
      (s:any) => { s.combat.units[0].sources = [{key:'forged'}]; },
    ]) reject(state,change);
  });
  it('rejects frozen plan, receipt, birth, evidence, counter and source-delta corruption', () => {
    const state = openingChoice();
    for (const change of [
      (s:any) => { s.m8.loot.frozen.seed++; },
      (s:any) => { s.m8.loot.frozen.rng.draws++; },
      (s:any) => { s.m8.loot.direct.pop(); },
      (s:any) => { s.m8.loot.earnedEvidence.pop(); },
      (s:any) => { s.m8.loot.earnedEvidence.at(-1).death.eventSeq++; },
      (s:any) => { s.m8.loot.earnedEvidence[0].death.eventSeq = s.roundResults[0].combatEventCount; },
      (s:any) => { s.m8.loot.earnedEvidence[0].death.tick = s.roundResults[0].combatTicks + 1; },
      (s:any) => { s.m8.loot.receipts[0].payload.definitionId = 'lux'; },
      (s:any) => { s.m8.loot.receipts[0].grantedUnitIds = ['unit-1']; },
      (s:any) => { s.m8.loot.guaranteeCounters[Object.keys(s.m8.loot.guaranteeCounters)[0]]++; },
      (s:any) => { s.resourceProvenance.entries.pop(); },
      (s:any) => { s.resourceProvenance.entries.at(-1).sourceDeltas = [{sourceUnitId:'unit-1',attackDamageBps:125}]; },
      (s:any) => { s.roundResults.at(-1).combatEventCount++; },
    ]) reject(state,change);
  });
  it('keeps receipt schema rejection through the shared lineage validator', () => {
    const state = resolveM5Choices(openingChoice());
    for (const change of [
      (s:any) => { s.m8.loot.receipts.push(copy(s.m8.loot.receipts[0])); },
      (s:any) => { s.m8.loot.receipts[0].receiptId = 'forged'; },
      (s:any) => { s.m8.loot.receipts[0].grantedItemIds = ['item-999']; },
      (s:any) => { s.m8.loot.receipts[0].grantedUnitIds.push('unit-999'); },
      (s:any) => { s.m8.loot.receipts.at(-1).payload.quantity = 2; },
      (s:any) => { s.m8.loot.receipts.at(-1).payload.extra = true; },
      (s:any) => { s.m8.loot.receipts[0].extra = true; },
    ]) reject(state,change);
    roundTrip(state);
  });
  it('rejects an unearned choice, wrong offered state and forged post-settlement resources', () => {
    const state = openingChoice();
    for (const change of [
      (s:any) => { s.pendingChoice.generation++; },
      (s:any) => { s.pendingChoice.offers.reverse(); },
      (s:any) => { s.pendingChoice.returnPhase = 'preparation'; },
      (s:any) => { s.m8.loot.choiceEligibility.at(-1).status = 'forfeited'; },
      (s:any) => { s.gold++; },
      (s:any) => { s.preparation.units.find((u:any) => u.team === 'player').location.cell.col++; },
    ]) reject(state,change);
    const resolved = resolveM5Choices(state);
    reject(resolved,s => { s.m8.loot.choiceResolutions[0].method = 'terminal-fallback'; });
    reject(resolved,s => { s.m8.loot.receipts.at(-1).payload.definitionId = 'not-a-component'; });
  });
});
