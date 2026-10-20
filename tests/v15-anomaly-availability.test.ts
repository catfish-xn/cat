import { expect, it } from 'vitest';
import { ANOMALY_DEFINITIONS, anomalyCandidates } from '../src/simulation/content/anomalies';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { selectAnomalyTarget, rerollAnomaly, selectChoice } from '../src/simulation/match';
import { enableMultiplayerSettlement } from '../src/simulation/round-settlement';
import { accepted } from './t10-helpers';
import { catalogPreparation } from './t5r-helpers';

it('keeps 60 augments and 54 solo anomalies, and defers only Avarice from the 53 online anomalies', () => {
  const all = Object.keys(ANOMALY_DEFINITIONS).sort();
  expect(Object.keys(AUGMENT_DEFINITIONS)).toHaveLength(60);
  expect(all).toHaveLength(54);
  expect(anomalyCandidates(false).sort()).toEqual(all);
  expect(anomalyCandidates(true).sort()).toEqual(all.filter(id => id !== 'avarice-incarnate'));
  expect(anomalyCandidates(true)).toHaveLength(53);
});

// Invert the documented LCG with BigInt to exercise every candidate interval,
// rather than relying on a seed sample that might miss an excluded entry.
function stateForWord(word: number): number {
  return Number(BigInt.asUintN(32, (BigInt(word) - 1013904223n) * 4276115653n));
}
it.each([false, true])('initial and rerolled offers exhaust the exact admitted pool (online=%s)', online => {
  const solo = catalogPreparation('4-6');
  const base = online ? accepted(enableMultiplayerSettlement(solo, 'A')) : solo;
  const choiceId = 'round:4-6:anomaly';
  const state = { ...base, phase: 'choice' as const, combat: null,
    pendingChoice: { kind: 'anomaly' as const, step: 'target' as const, choiceId, eventId: choiceId,
      generation: 0, offers: [], targetId: null, rerollCount: 0, returnPhase: 'preparation' as const } };
  const target = state.preparation.units.find(u => u.team === 'player')!.id;
  const expected = Object.keys(ANOMALY_DEFINITIONS).filter(id => !online || id !== 'avarice-incarnate').sort();
  for (const [index, id] of expected.entries()) {
    const word = Math.ceil(index * 0x100000000 / expected.length);
    const offered = accepted(selectAnomalyTarget({ ...state, choiceRngState: stateForWord(word) }, choiceId, 0, target));
    expect(offered.pendingChoice!.offers).toEqual([id]);
    expect(offered.choiceRngState).toBe(word);
    if (id === 'avarice-incarnate') {
      const chosen = accepted(selectChoice(offered, choiceId, 1, id));
      expect(chosen.gold).toBe(offered.gold + 5);
      expect(chosen.anomalyBinding?.definitionId).toBe(id);
    }
  }
  const rerollPool = expected.filter(id => id !== 'mage-armor');
  const input = { ...state, gold: 2, pendingChoice: { ...state.pendingChoice,
    step: 'offer' as const, targetId: target, generation: 1, offers: ['mage-armor'] } };
  for (const [index, id] of rerollPool.entries()) {
    const word = Math.ceil(index * 0x100000000 / rerollPool.length);
    const offered = accepted(rerollAnomaly({ ...input, choiceRngState: stateForWord(word) }, choiceId, 1));
    expect(offered.pendingChoice).toMatchObject({ offers: [id], generation: 2, rerollCount: 1 });
    expect(offered.gold).toBe(1);
    expect(offered.choiceRngState).toBe(word);
  }
});
