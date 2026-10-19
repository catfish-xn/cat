import { beforeAll, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { grantMechanicGold } from '../src/simulation/seat-mechanics';
import { accepted, publicPrefix } from './fixtures/t13-loot-public';
import { anomalyId } from './helpers/s13-anomalies';
import type { MatchState } from '../src/simulation/match-types';

let targetPrefix: MatchState;
beforeAll(async () => { targetPrefix = await publicPrefix('4-6', 42, 'cannon'); }, 60000);
function prepared(suffix: string, solo = false): MatchState {
  let state = accepted(grantMechanicGold(structuredClone(targetPrefix), { receiptId: 'review-anomaly-budget', source: 'test', amount: 500 }));
  const owner = state.preparation.units.find(u => u.team === 'player')!;
  let choice = state.pendingChoice!;
  state = accepted(api.selectAnomalyTarget(state, choice.choiceId, choice.generation, owner.id));
  for (let i = 0; state.pendingChoice!.offers[0] !== anomalyId(suffix) && i < 500; i++) {
    choice = state.pendingChoice!;
    state = accepted(api.rerollAnomaly(state, choice.choiceId, choice.generation));
  }
  choice = state.pendingChoice!;
  expect(choice.offers).toEqual([anomalyId(suffix)]);
  state = accepted(api.selectChoice(state, choice.choiceId, choice.generation, anomalyId(suffix)));
  if (solo) {
    for (const unit of state.preparation.units.filter(u => u.team === 'player' && u.id !== owner.id))
      state = accepted(api.sellUnit(state, unit.id));
    state = accepted(api.deployMatchUnit(state, owner.id, { kind: 'board', cell: { col: 3, row: 7 } }));
  }
  return state;
}
function roundTrip(state: MatchState): void {
  const saved = serializeMatch(state);
  expect(restoreMatch(state)).toEqual(state);
  expect(restoreMatch(saved)).toEqual(state);
  expect(serializeMatch(restoreMatch(saved))).toBe(saved);
}
function rejectSingleField(state: MatchState, change: (bad: MatchState) => void, reason = 'authoritative anomaly replay'): void {
  roundTrip(state);
  const saved = serializeMatch(state), bad = structuredClone(state);
  change(bad);
  expect(() => restoreMatch(bad)).toThrow(reason);
  expect(() => restoreMatch(JSON.stringify(bad))).toThrow(reason);
  expect(() => serializeMatch(bad)).toThrow(reason);
  expect(serializeMatch(state)).toBe(saved);
}

it('S1 actual Last Chance revival rejects deleting only revivedAtTick', () => {
  let state = accepted(api.startMatchCombat(prepared('EvenInDeath', true)));
  const id = state.anomalyBinding!.unitId;
  while (state.phase === 'combat' && state.combat!.units.find(u => u.id === id)!.anomalyState?.revivedAtTick === undefined)
    state = api.stepMatch(state).state;
  const owner = state.combat!.units.find(u => u.id === id)!;
  expect(state.phase).toBe('combat');
  expect(owner.alive).toBe(true);
  expect(owner.anomalyState!.revivedAtTick).toBeGreaterThan(0);
  rejectSingleField(state, bad => { delete bad.combat!.units.find(u => u.id === id)!.anomalyState!.revivedAtTick; });
});
it('S1 tick119 Dramatic Entrance rejects changing only the absence deadline', () => {
  let state = accepted(api.startMatchCombat(prepared('DramaticEntrance', true)));
  while (state.phase === 'combat' && state.combat!.tick < 119) state = api.stepMatch(state).state;
  expect(state.phase).toBe('combat'); expect(state.combat!.tick).toBe(119);
  const id = state.anomalyBinding!.unitId;
  expect(state.combat!.units.find(u => u.id === id)!.anomalyState!.absentUntilTick).toBe(120);
  rejectSingleField(state, bad => { bad.combat!.units.find(u => u.id === id)!.anomalyState!.absentUntilTick = 121; });
});
it.each(['ScuttleFamiliar', 'WolfFamiliars', 'DeftHands'])('S1 real %s birth rejects changing only summon ownership', suffix => {
  let state = accepted(api.startMatchCombat(prepared(suffix, suffix === 'ScuttleFamiliar')));
  while (state.phase === 'combat' && !state.combat!.units.some(u => u.anomalySummon)) state = api.stepMatch(state).state;
  const summon = state.combat!.units.find(u => u.anomalySummon)!;
  expect(summon).toBeDefined();
  const other = state.combat!.units.find(u => u.team !== summon.team && !u.anomalySummon)!;
  rejectSingleField(state, bad => { Object.assign(bad.combat!.units.find(u => u.id === summon.id)!.anomalySummon!, { ownerId: other.id }); });
});
it('S1 preparation and next-round preparation restore legally and reject a leaked prior combat', () => {
  const prep = prepared('WolfFamiliars');
  expect(prep.phase).toBe('preparation'); roundTrip(prep);
  let state = accepted(api.startMatchCombat(prep));
  const leaked = structuredClone(state.combat!);
  rejectSingleField(prep, bad => { Object.assign(bad, { combat: leaked }); }, 'missing input basis');
  while (state.phase === 'combat') state = api.stepMatch(state).state;
  expect(state.phase).toBe('settlement');
  const next = accepted(api.nextRound(state, state.round));
  expect(next.phase).toBe('preparation'); expect(next.round).toBe(prep.round + 1);
  expect(next.combat).toBeNull(); roundTrip(next);
  rejectSingleField(next, bad => { Object.assign(bad, { combat: leaked }); }, 'current growth commit count');
});
