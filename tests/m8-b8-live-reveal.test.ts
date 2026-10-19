import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { revealMatchLoot } from '../src/simulation/loot-runtime';
import { run } from '../scripts/generate-m5-route.cjs';
import { accepted } from './match-helpers';
import {simultaneousB8Preparation,partialB8Preparation} from './fixtures/g2-3-b8-public';
import { configuredPrefix } from './fixtures/t13-loot-public';

// This is a command-only domain prefix, stopped at the required encounter.
// No retained JSON, golden state, injected deaths, or invented resource facts.
let preparation: api.MatchState | undefined;
const reached = new Error('Reached actual 4-7 preparation');
try {
  // Keep the original defensive anomaly; spend the 4-7 shop budget to complete the roster.
  await run(api, { build: 'mage', seed: 42, goldReserves: { '4-7': 0 }, anomalyDefinitionId: 'protective-shielding', onStep(before, _result, command) {
    if (command?.type === 'start' && before.roundDefinitionId === '4-7') {
      preparation = before; throw reached;
    }
  } });
} catch (error) { if (error !== reached) throw error; }
if (!preparation) throw Error('Public mage route did not reach 4-7');
const prefix = preparation;
// This public seed retains the original three augments and Zyra's tick-152
// source death under the v13 57-augment offer pool.
const zyraPrefix = await configuredPrefix('4-7', { build: 'mage', seed: 166883,
  augmentPriorities: ['bronze-for-life-i', 'pumping-up-ii', 'bronze-for-life-ii'],
  anomalyDefinitionId: 'protective-shielding' });
// Seed 42 can no longer be offered pumping-up-ii under v13; this public seed keeps the
// original three augments and Loris's single tick-381 r00 death with four direct receipts.
const lorisPrefix = await configuredPrefix('4-7', { build: 'mage', seed: 31731, goldReserves: { '4-7': 0 },
  augmentPriorities: ['bronze-for-life-i', 'pumping-up-ii', 'bronze-for-life-ii'],
  anomalyDefinitionId: 'protective-shielding' });
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
  it('reveals four orb entries while two neutral sources die on the same tick, then restores and grants each exactly once', () => {
    let state = accepted(api.startMatchCombat(clone(simultaneousB8Preparation(prefix))));
    while (state.phase === 'combat' && state.combat.tick < 43) state = api.stepMatch(state).state;
    expect(state.phase).toBe('combat');
    expect(state.combat!.tick).toBe(43);
    const before = state, resumedBefore = clone(before);
    const transition = api.stepMatch(before), resumedTransition = api.stepMatch(resumedBefore);
    expect(resumedTransition).toEqual(transition);
    state = transition.state;
    expect(state.phase).toBe('combat');
    const revealed = transition.events.filter(event => event.type === 'lootRevealed');
    expect(revealed).toHaveLength(4);
    const plan = state.m8.loot.frozen.rounds.find(round => round.encounterPlan.roundId === '4-7')!;
    expect(revealed.map(event => event.dropId)).toEqual([
      ...plan.encounterPlan.drops.map(drop => drop.dropId), ...plan.choices.map(choice => choice.dropId),
    ]);
    const deaths = state.combat!.neutralReceipts!.deaths;
    expect(deaths).toEqual([
      // G23 lawful Lux/Nami position swap: both sources die in the same tick-44 action batch.
      { unitId: '["pve","4-7","razorbeaks-v1","r00"]', tick: 44, eventSeq: 382 },
      { unitId: '["pve","4-7","razorbeaks-v1","r01"]', tick: 44, eventSeq: 383 },
    ]);
    expect(transition.events.filter(event => event.type === 'death').map(event => [event.type === 'death' && event.unitId, event.tick, event.eventSeq])).toEqual(deaths.map(death => [death.unitId, death.tick, death.eventSeq]));
    expect(revealed.map(event => event.death.eventSeq)).toEqual([382, 382, 382, 382]); // All four frozen drops belong to r00.
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
    forged.m8.loot.earnedEvidence.at(-1).death.eventSeq = 383; // Substitute r01's real death identity for r00's drop evidence.
    expect(() => restoreMatch(forged)).toThrow('Invalid B8 Match: source death conflict');
    let resumed = restoredReveal;
    while (state.phase === 'combat') {
      const a = api.stepMatch(state), b = api.stepMatch(resumed);
      expect(b).toEqual(a); state = a.state; resumed = b.state;
    }
    expect(state.phase).toBe('settlement');
    expect(state.pendingChoice).toBeNull();expect(clone(state)).toEqual(state);
    const ids=new Set(plan.encounterPlan.drops.map(drop=>drop.dropId));
    expect(state.m8.loot.receipts.filter(receipt=>ids.has(receipt.dropId))).toHaveLength(4);
    unchangedStep(state);
    rejected(state,()=>api.selectChoice(state,'obsolete-pve-choice',0,'tear'),'wrong-phase');
    expect(api.nextRound(clone(state),state.round)).toEqual(api.nextRound(state,state.round));
  });

  it.each([
    ['loris', 'r00', 381, 'settlement', 4],
    ['zyra', 'r01', 152, 'settlement', 0],
  ] as const)('earns only killed source rewards after an actual partial defeat with %s', (survivor, source, deathTick, phase, directReceipts) => {
    let state = clone(partialB8Preparation(survivor === 'zyra' ? zyraPrefix : lorisPrefix, survivor));
    const targetId=state.preparation.units.find(u=>u.team==='player'&&u.definitionId===survivor)!.id;
    expect(state.preparation.units.find(unit => unit.id === targetId)).toMatchObject({
      definitionId: survivor, starLevel: 2, team: 'player',
    });
    state = clone(state);
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
    expect(state.m8.loot.direct.slice(-4).map(drop => drop.status)).toEqual(directReceipts ? Array(4).fill('granted') : Array(4).fill('forfeited'));
    expect(state.m8.loot.choiceEligibility).toEqual([]);
    expect(state.nextUnitSerial).toBe(unitSerial);
    expect(state.nextItemSerial).toBe(beforeItemSerial + (directReceipts ? 2 : 0));
    expect(state.m8.loot.frozen).toBe(frozen);
    expect(clone(state)).toEqual(state);
    const forged = JSON.parse(serializeMatch(state));
    forged.m8.loot.direct.at(-1).status = directReceipts ? 'forfeited' : 'revealed';
    forged.m8.loot.direct.at(-1).receiptId = null;
    expect(() => restoreMatch(forged)).toThrow(/qualification evidence/);
    unchangedStep(state);
    expect(api.nextRound(clone(state), state.round)).toEqual(api.nextRound(state, state.round));
  });

});
