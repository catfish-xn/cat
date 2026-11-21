import { describe, expect, it } from 'vitest';
import { createCombat } from '../src/simulation/combat';
import { createMatch, nextRound, readLootView, sellUnit, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { prepareMatchLoot, revealMatchLoot } from '../src/simulation/loot-runtime';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { createRoundEnemies } from '../src/simulation/round-enemies';
import { enterOpeningCrabs, openingCrabCarrier } from '../src/simulation/opening-crabs';

function accepted<T extends { ok: boolean; state: MatchState }>(result: T): MatchState {
  expect(result.ok).toBe(true);
  return result.state;
}
function clearBoard(state: MatchState): MatchState {
  for (const unit of state.preparation.units.filter(entry => entry.team === 'player' && entry.location.kind === 'board')) state = accepted(sellUnit(state, unit.id));
  return state;
}
function fight(state: MatchState): MatchState {
  state = accepted(startMatchCombat(state));
  for (let guard = 0; state.phase === 'combat' && guard < 4000; guard++) state = stepMatch(state).state;
  expect(state.phase === 'combat').toBe(false);
  return state;
}
describe('PvE loot lost on a defeat is paid on the next PvE', () => {
  it('keeps killed loot, parks the rest, and pays that rest once on the next loss', () => {
    let state = fight(clearBoard(createMatch(3)));
    expect(state.roundDefinitionId).toBe('1-2');
    expect(state.roundResults[0].result).not.toBe('playerWin');
    expect(state.playerHp).toBeGreaterThan(0);
    const parked = state.m8.loot.carry ?? [];
    expect(parked.length).toBeGreaterThan(0);
    expect(parked.every(row => row.deliverRoundId === '1-3')).toBe(true);
    expect(state.m8.loot.receipts.some(receipt => parked.some(row => row.dropId === receipt.dropId))).toBe(false);
    const directIds = parked.filter(row => state.m8.loot.direct.some(drop => drop.dropId === row.dropId));
    expect(directIds.every(row => state.m8.loot.direct.find(drop => drop.dropId === row.dropId)?.status === 'carried')).toBe(true);
    expect(restoreMatch(serializeMatch(state)).m8.loot.carry).toEqual(parked);
    const forged = JSON.parse(serializeMatch(state)) as { m8: { loot: { carry: { deliverRoundId: string }[] } } };
    forged.m8.loot.carry[0].deliverRoundId = '2-7';
    expect(() => restoreMatch(JSON.stringify(forged))).toThrow(/pve carry|carry destination/);

    state = accepted(nextRound(state, state.round));
    expect(state.roundDefinitionId).toBe('1-3');
    const preview = readLootView(state);
    expect(directIds.every(row => preview.revealedDrops.some(drop => drop.dropId === row.dropId && drop.status === 'revealed' && (drop.sourceUnitId ?? '').length > 0))).toBe(true);

    state = fight(clearBoard(state));
    expect(state.roundDefinitionId).toBe('1-3');
    for (const row of directIds) {
      const progress = state.m8.loot.direct.find(drop => drop.dropId === row.dropId);
      const receipts = state.m8.loot.receipts.filter(receipt => receipt.dropId === row.dropId);
      expect(progress?.status).toBe('granted');
      expect(receipts).toHaveLength(1);
      expect(receipts[0].claimedRoundId).toBe('1-3');
    }
    const fresh = (state.m8.loot.carry ?? []).filter(row => row.deliverRoundId === '1-4');
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.every(row => state.m8.loot.direct.find(drop => drop.dropId === row.dropId)?.status === 'carried'
      || state.m8.loot.choiceEligibility.find(choice => choice.dropId === row.dropId)?.status === 'carried')).toBe(true);
    expect(restoreMatch(serializeMatch(state)).m8.loot.receipts.map(receipt => receipt.dropId)).toEqual(state.m8.loot.receipts.map(receipt => receipt.dropId));
  });

  it('pays the parked payload on the next PvE even if that combat is also lost, and never twice', () => {
    let state = fight(clearBoard(createMatch(4)));
    const parked = state.m8.loot.carry!.map(row => row.dropId);
    state = accepted(nextRound(state, state.round));
    state = fight(clearBoard(state));
    const frozen = new Map(state.m8.loot.frozen.rounds.flatMap(round => round.encounterPlan.drops).map(drop => [drop.dropId, drop.payload]));
    for (const dropId of parked) {
      const receipts = state.m8.loot.receipts.filter(receipt => receipt.dropId === dropId);
      expect(receipts).toHaveLength(1);
      expect(receipts[0].payload).toEqual(frozen.get(dropId));
      expect(receipts[0].claimedRoundId).toBe('1-3');
    }
    const again = restoreMatch(serializeMatch(state));
    expect(again.m8.loot.receipts.filter(receipt => parked.includes(receipt.dropId))).toHaveLength(parked.length);
    const tampered = JSON.parse(serializeMatch(state)) as { m8: { loot: { earnedEvidence: { dropId: string; death?: { combatId: string; tick: number; eventSeq: number } }[] } } };
    tampered.m8.loot.earnedEvidence.push({ dropId: parked[0], death: { combatId: 'round-1', tick: 1, eventSeq: 0 } });
    expect(() => restoreMatch(JSON.stringify(tampered))).toThrow(/carry kill|pve carry|death history/);
  });

  it('forfeits a lethal loss and the last PvE, and still grants a partial kill immediately', () => {
    const dying = fight(clearBoard({ ...createMatch(5), playerHp: 1 }));
    expect(dying.playerHp).toBe(0);
    expect(dying.m8.loot.carry).toBeUndefined();
    expect(dying.m8.loot.direct.every(drop => drop.status === 'forfeited')).toBe(true);

    const round = getCatalogRoundById('2-7');
    const base = createMatch(6);
    const enemies = createRoundEnemies(round.ordinal);
    const prepared = enterOpeningCrabs({ ...base, round: round.ordinal, roundDefinitionId: round.roundId, phase: 'preparation', combat: null, combatInputBasis: null,
      preparation: { ...base.preparation, units: [...base.preparation.units.filter(unit => unit.team === 'player'), ...enemies] },
      m8: { ...base.m8, round, loot: prepareMatchLoot(base.seed, round.ordinal), preparation: { ...base.m8.preparation, roundId: round.roundId, encounterId: round.encounterId, enemies } } });
    const source = prepared.m8.loot.frozen.rounds.at(-1)!.encounterPlan.drops[0].sourceUnitId;
    const carrier = openingCrabCarrier(prepared, round.roundId, source);
    const initial = createCombat(prepared.preparation);
    const combat = { ...initial, combatId: `round-${round.ordinal}`, status: 'finished' as const, result: 'enemyWin' as const, tick: 4, nextEventSeq: 8,
      units: initial.units.map(unit => unit.id === carrier ? { ...unit, alive: false, hp: 0 } : unit),
      neutralReceipts: { deaths: [{ unitId: carrier, tick: 2, eventSeq: 3 }], controls: [] } };
    const partial = revealMatchLoot(prepared, combat).state;
    const killed = partial.m8.loot.direct.filter(drop => drop.status === 'revealed').map(drop => drop.dropId);
    const parked = partial.m8.loot.carry ?? [];
    expect(killed.length).toBeGreaterThan(0);
    expect(parked.length).toBeGreaterThan(0);
    expect(parked.every(row => row.deliverRoundId === '3-7')).toBe(true);
    expect(killed.every(id => parked.every(row => row.dropId !== id))).toBe(true);

    const last = getCatalogRoundById('6-7');
    const finalRound = { ...prepared, round: last.ordinal, roundDefinitionId: last.roundId, m8: { ...prepared.m8, round: last, loot: prepareMatchLoot(base.seed, last.ordinal) } };
    const finalCombat = { ...combat, combatId: `round-${last.ordinal}`, result: 'enemyWin' as const, neutralReceipts: { deaths: [], controls: [] },
      units: initial.units.map(unit => ({ ...unit, alive: true, hp: 1 })) };
    const missed = revealMatchLoot(finalRound, finalCombat);
    expect(missed.state.m8.loot.carry).toBeUndefined();
    expect(missed.events.every(event => event.type === 'lootForfeited')).toBe(true);
  });
});
