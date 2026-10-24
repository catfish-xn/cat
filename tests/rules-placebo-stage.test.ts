import { describe, expect, it } from 'vitest';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { choiceAcquisitionGold } from '../src/simulation/choice-acquisition';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { selectChoice, nextRound, startMatchCombat, createMatch, deployMatchUnit, stepMatch, sellUnit, type MatchState } from '../src/simulation/match';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { accepted, reachRound, resolveM5Choices, emptyBoard } from './match-helpers';
import { openingEncounter } from './fixtures/m5/oracle.g2.cjs';

// v22 crab openings can fill all nine bench slots with loot heroes (e.g. seed 56);
// then the board unit is sold instead of benched before conceding the round.
function concede(state: MatchState): MatchState {
  for (const unit of state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board')) {
    const used = new Set(state.preparation.units.flatMap(u => u.location.kind === 'bench' ? [u.location.slot] : []));
    const slot = Array.from({ length: state.preparation.benchSize }, (_, i) => i).find(i => !used.has(i));
    state = accepted(slot === undefined ? sellUnit(state, unit.id) : deployMatchUnit(state, unit.id, { kind: 'bench', slot }));
  }
  return state;
}
function reachChoice(roundId: string, seed: number) {
  if (roundId !== '4-2') return reachRound(roundId, false, seed);
  // Win the opening PvE rounds using the supplied opening champion, then concede later
  // rounds. This retains enough real HP to reach 4-2 without injected resources.
  let state = createMatch(seed);
  while (state.roundDefinitionId !== roundId) {
    state = resolveM5Choices(state);
    if (state.phase === 'preparation') {
      if (state.roundDefinitionId.startsWith('1-')) {
        const hero = state.preparation.units.find(u => u.team === 'player')!;
        state = accepted(deployMatchUnit(state, hero.id, { kind: 'board', cell: { col: 3, row: 4 } }));
        state = accepted(startMatchCombat(state));
        while (state.phase === 'combat') state = stepMatch(state).state;
      } else state = accepted(startMatchCombat(concede(state)));
    }
    state = resolveM5Choices(state);
    if (state.phase !== 'settlement') throw Error(`Cannot reach ${roundId}: ${state.roundDefinitionId}/${state.phase}`);
    state = accepted(nextRound(state, state.round));
  }
  return state;
}
const vectors = [
  ['2-1', 8, 15], ['3-2', 11, 18], ['4-2', 15, 22], ['5-1', 15, 22], ['5-7', 15, 22],
] as const;
describe('10-23 project Placebo acquisition amounts', () => {
  it.each(vectors)('%s has independent stage amounts %i / %i', (roundId, ordinary, plus) => {
    const round = getCatalogRoundById(roundId).ordinal;
    expect(choiceAcquisitionGold(AUGMENT_DEFINITIONS.placebo, round)).toBe(ordinary);
    expect(choiceAcquisitionGold(AUGMENT_DEFINITIONS['placebo-plus'], round)).toBe(plus);
    for (const id of ['placebo', 'placebo-plus']) {
      expect(AUGMENT_DEFINITIONS[id].effects[0]).toEqual({ kind: 'attackSpeedBps', bps: 100 });
    }
  });
  it.each(vectors.slice(0, 3).flatMap(([roundId, ordinary, plus]) => [
    [roundId, 'placebo', ordinary], [roundId, 'placebo-plus', plus],
  ] as const))('%s %s public choice grants exactly %i once and authenticates its receipt', (roundId, id, gold) => {
    // Real public routes and offers; no forged schedule node or injected resources.
    let state = reachChoice(roundId, 0), found = false;
    for (let seed = 0; seed < 300; seed++) {
      // v23 fmix32 openings: Trainer Golem seeds are skipped; the golem can be neither benched nor sold to concede.
      if (openingEncounter(seed) === 'trainer-golems') continue;
      // Seed 56 (now Component Anvils) leaves pending loot capacity at 1-4 on the 4-2 route, which never sells; Placebo is at 59/98.
      if (roundId === '4-2' && seed === 56) continue;
      state = reachChoice(roundId, seed);
      if (state.pendingChoice?.offers.includes(id)) { found = true; break; }
    }
    expect(found).toBe(true);
    const c = state.pendingChoice!, before = serializeMatch(state);
    const rejected = selectChoice(state, c.choiceId, c.generation + 1, id);
    expect(rejected.ok).toBe(false); expect(rejected.state).toBe(state);
    const after = accepted(selectChoice(state, c.choiceId, c.generation, id));
    expect(after.gold - state.gold).toBe(gold);
    expect(after.choiceRngState).toBe(state.choiceRngState);
    expect(serializeMatch(state)).toBe(before);
    expect(after.scheduleReceipts.filter(r => r.eventId === c.eventId)).toMatchObject([{ gold }]);
    expect(restoreMatch(serializeMatch(after))).toEqual(after);
    const duplicate = selectChoice(after, c.choiceId, c.generation, id);
    expect(duplicate.ok).toBe(false); expect(duplicate.state).toBe(after);
    const forged = JSON.parse(serializeMatch(after));
    forged.scheduleReceipts.find((r: { eventId: string }) => r.eventId === c.eventId).gold++;
    expect(() => restoreMatch(forged)).toThrow();
    // The acquisition's original round remains authoritative after continuing.
    const settled = resolveM5Choices(accepted(startMatchCombat(emptyBoard(resolveM5Choices(after)))));
    let continued = settled.phase === 'gameOver' ? settled : accepted(nextRound(settled, settled.round));
    if (roundId === '2-1') {
      while (continued.roundDefinitionId !== '3-1') {
        continued = resolveM5Choices(continued);
        if (continued.phase === 'preparation') continued = accepted(startMatchCombat(emptyBoard(continued)));
        continued = resolveM5Choices(continued);
        continued = accepted(nextRound(continued, continued.round));
      }
    }
    expect(continued.scheduleReceipts.find(r => r.eventId === c.eventId)?.gold).toBe(gold);
    expect(restoreMatch(serializeMatch(continued))).toEqual(continued);
  }, 60000);
});
