import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { revealMatchLoot } from '../src/simulation/loot-runtime';
import { run } from '../scripts/generate-m5-route.cjs';
import { accepted } from './match-helpers';

// This is a command-only domain prefix, stopped at the required encounter.
// No retained JSON, golden state, injected deaths, or invented resource facts.
let preparation: api.MatchState | undefined;
const reached = new Error('Reached actual 4-7 preparation');
try {
  await run(api, { build: 'mage', seed: 42, onStep(before, _result, command) {
    if (command?.type === 'start' && before.roundDefinitionId === '4-7') {
      preparation = before; throw reached;
    }
  } });
} catch (error) { if (error !== reached) throw error; }
if (!preparation) throw Error('Public mage route did not reach 4-7');
const prefix = preparation;
function unchangedStep(state: api.MatchState): void {
  const saved = serializeMatch(state), result = api.stepMatch(state);
  expect(result).toEqual({ state, events: [] }); expect(result.state).toBe(state);
  expect(serializeMatch(state)).toBe(saved);
}
function rejected(state: api.MatchState, call: () => api.MatchCommandResult, reason: string): void {
  const saved = serializeMatch(state), result = call();
  expect(result).toEqual({ ok: false, state, reason }); expect(result.state).toBe(state);
  expect(serializeMatch(state)).toBe(saved);
}
const clone = (state: api.MatchState): api.MatchState => {
  const saved = serializeMatch(state), restored = restoreMatch(saved);
  expect(restored).toEqual(state); expect(restored).not.toBe(state);
  expect(serializeMatch(state)).toBe(saved);
  return restored;
};

describe('B8 real simultaneous loot-source deaths', () => {
  it('reveals three slots from two actual same-tick sources, then restores and grants each exactly once', () => {
    let state = accepted(api.startMatchCombat(clone(prefix)));
    while (state.phase === 'combat' && state.combat.tick < 51) state = api.stepMatch(state).state;
    expect(state.phase).toBe('combat');
    expect(state.combat!.tick).toBe(51);
    const before = state, resumedBefore = clone(before);
    const transition = api.stepMatch(before), resumedTransition = api.stepMatch(resumedBefore);
    expect(resumedTransition).toEqual(transition);
    state = transition.state;
    expect(state.phase).toBe('combat');
    const revealed = transition.events.filter(event => event.type === 'lootRevealed');
    expect(revealed).toHaveLength(3);
    const plan = state.m8.loot.frozen.rounds.find(round => round.encounterPlan.roundId === '4-7')!;
    expect(revealed.map(event => event.dropId)).toEqual([
      ...plan.encounterPlan.drops.map(drop => drop.dropId), ...plan.choices.map(choice => choice.dropId),
    ]);
    const deaths = state.combat!.neutralReceipts!.deaths;
    expect(deaths).toEqual([
      { unitId: '["pve","4-7","razorbeaks-v1","r00"]', tick: 52, eventSeq: 158 },
      { unitId: '["pve","4-7","razorbeaks-v1","r01"]', tick: 52, eventSeq: 159 },
    ]);
    expect(revealed.map(event => event.death.eventSeq)).toEqual([158, 158, 159]);
    for (const field of ['gold', 'items', 'preparation', 'persistentGrowth', 'nextUnitSerial', 'nextItemSerial',
      'resourceProvenance', 'rngState', 'choiceRngState', 'rewardRngState', 'equipmentState'] as const)
      expect(state[field]).toEqual(before[field]);
    expect(state.m8.loot.frozen).toBe(before.m8.loot.frozen);
    expect(state.m8.loot.receipts).toBe(before.m8.loot.receipts);
    const restoredReveal = clone(state);
    const duplicate = revealMatchLoot(restoredReveal, restoredReveal.combat!);
    expect(duplicate).toEqual({ state: restoredReveal, events: [] });
    expect(duplicate.state).toBe(restoredReveal);
    const forged = JSON.parse(serializeMatch(state));
    forged.m8.loot.earnedEvidence.at(-1).death.eventSeq = 158;
    expect(() => restoreMatch(forged)).toThrow(/duplicate death identity|current death evidence/);
    let resumed = restoredReveal;
    while (state.phase === 'combat') {
      const a = api.stepMatch(state), b = api.stepMatch(resumed);
      expect(b).toEqual(a); state = a.state; resumed = b.state;
    }
    expect(state.phase).toBe('choice');
    expect(clone(state)).toEqual(state);
    const ids = new Set(plan.encounterPlan.drops.map(drop => drop.dropId));
    expect(state.m8.loot.receipts.filter(receipt => ids.has(receipt.dropId))).toHaveLength(2);
    rejected(state, () => api.nextRound(state, state.round), 'wrong-phase');
    const choice = state.pendingChoice!;
    const selected = api.selectChoice(state, choice.choiceId, choice.generation, 'tear');
    expect(api.selectChoice(clone(state), choice.choiceId, choice.generation, 'tear')).toEqual(selected);
    const settled = accepted(selected);
    expect(clone(settled)).toEqual(settled);
    expect(settled.m8.loot.receipts.filter(receipt => ids.has(receipt.dropId) || receipt.dropId === plan.choices[0].dropId)).toHaveLength(3);
    unchangedStep(settled);
    rejected(settled, () => api.selectChoice(settled, choice.choiceId, choice.generation, 'tear'), 'wrong-phase');
    expect(api.nextRound(clone(settled), settled.round)).toEqual(api.nextRound(settled, settled.round));
  });

  it.each([
    ['unit-10', 'r00', 344, 'settlement', 2],
    ['unit-21', 'r01', 218, 'choice', 0],
  ] as const)('earns only killed source rewards after an actual partial defeat with %s', (survivor, source, deathTick, phase, directReceipts) => {
    let state = clone(prefix), slot = 0;
    for (const unit of state.preparation.units.filter(unit => unit.team === 'player' && unit.id !== survivor))
      state = accepted(api.deployMatchUnit(state, unit.id, { kind: 'bench', slot: slot++ }));
    state = clone(state);
    const plan = state.m8.loot.frozen.rounds.find(round => round.encounterPlan.roundId === '4-7')!;
    const beforeReceipts = state.m8.loot.receipts.length, beforeItemSerial = state.nextItemSerial;
    const unitSerial = state.nextUnitSerial, frozen = state.m8.loot.frozen;
    state = accepted(api.startMatchCombat(state));
    while (state.phase === 'combat' && state.combat.tick < deathTick) state = api.stepMatch(state).state;
    expect(state.phase).toBe('combat');
    expect(state.combat!.neutralReceipts!.deaths.map(death => [death.unitId, death.tick])).toEqual([
      [JSON.stringify(['pve', '4-7', 'razorbeaks-v1', source]), deathTick],
    ]);
    expect(state.m8.loot.receipts).toHaveLength(beforeReceipts);
    expect(state.nextItemSerial).toBe(beforeItemSerial); expect(state.nextUnitSerial).toBe(unitSerial);
    let resumed = clone(state);
    const events: api.MatchEvent[] = [], resumedEvents: api.MatchEvent[] = [];
    while (state.phase === 'combat') {
      const a = api.stepMatch(state), b = api.stepMatch(resumed);
      events.push(...a.events); resumedEvents.push(...b.events); state = a.state; resumed = b.state;
    }
    expect(resumedEvents).toEqual(events); expect(resumed).toEqual(state);
    expect(state.phase).toBe(phase); expect(state.combat!.result).toBe('enemyWin');
    expect(state.combat!.neutralReceipts!.deaths).toHaveLength(1);
    expect(state.m8.loot.receipts).toHaveLength(beforeReceipts + directReceipts);
    expect(state.m8.loot.direct.slice(-2).map(drop => drop.status)).toEqual(directReceipts ? ['granted', 'granted'] : ['forfeited', 'forfeited']);
    expect(state.m8.loot.choiceEligibility.at(-1)!.status).toBe(directReceipts ? 'forfeited' : 'revealed');
    expect(state.nextUnitSerial).toBe(unitSerial);
    expect(state.nextItemSerial).toBe(beforeItemSerial + (directReceipts ? 1 : 0));
    expect(state.m8.loot.frozen).toBe(frozen);
    expect(clone(state)).toEqual(state);
    const forged = JSON.parse(serializeMatch(state));
    if (directReceipts) forged.m8.loot.choiceEligibility.at(-1).status = 'revealed';
    else forged.m8.loot.direct.at(-1).status = 'revealed';
    expect(() => restoreMatch(forged)).toThrow(/qualification evidence/);
    if (state.phase === 'choice') {
      const choice = state.pendingChoice!;
      state = accepted(api.selectChoice(state, choice.choiceId, choice.generation, 'tear'));
      expect(state.m8.loot.receipts.at(-1)!.dropId).toBe(plan.choices[0].dropId);
      expect(state.nextItemSerial).toBe(beforeItemSerial + 1);
      expect(clone(state)).toEqual(state);
    }
    unchangedStep(state);
    expect(api.nextRound(clone(state), state.round)).toEqual(api.nextRound(state, state.round));
  });

});
