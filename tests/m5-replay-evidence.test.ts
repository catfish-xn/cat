import assert from 'node:assert/strict';
import { afterEach, expect, it, vi } from 'vitest';
import * as commands from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { prepareAugmentHistoryReplay } from '../src/simulation/augment-history-restore';
import { advanceAugmentPreparationTime } from '../src/simulation/augment-history';
import { packReplayFacts, unpackReplayFacts } from '../src/simulation/augment-replay-facts';
import type { AugmentHistoryFact } from '../src/simulation/augment-history-types';
import { accepted, fieldBench, reachRound } from './match-helpers';

afterEach(() => vi.restoreAllMocks());

it('losslessly compresses empty death boundaries without changing any journal field or native bytes', () => {
  const facts: AugmentHistoryFact[] = Array.from({ length: 15000 }, (_, sequence) => ({
    kind: 'deaths', battleId: 'battle', completeThroughTick: sequence, deaths: [], sequence,
    seatId: 'solo', round: 4, roundId: '2-1', resourcePrefix: 10,
  }));
  // Every boundary that cannot form a consecutive run must remain separate.
  facts[10] = { ...facts[10], resourcePrefix: 11 };
  facts[20] = { ...facts[20], round: 5, roundId: '2-2' };
  Object.assign(facts[30], { battleId: 'other' });
  Object.assign(facts[40], { completeThroughTick: 400 });
  Object.assign(facts[50], { extra: 'preserved' });
  for (const i of [60, 61]) {
    Object.assign(facts[i], { extra: `preserved-${i}` });
    delete (facts[i] as any).resourcePrefix; // Same key count must not disguise an extra field.
  }
  const before = JSON.stringify(facts), packed = packReplayFacts(facts);
  expect(JSON.stringify(packed).length).toBeLessThan(before.length / 100);
  assert.deepEqual(unpackReplayFacts(packed), facts);
  expect(JSON.stringify(unpackReplayFacts(packed))).toBe(before);
  expect(JSON.stringify(facts)).toBe(before);
});

function running() {
  const open = reachRound('2-1', false);
  const choice = open.pendingChoice!;
  expect(choice.offers).toContain('snipers-nest');
  let state = accepted(commands.selectChoice(open, choice.choiceId, choice.generation, 'snipers-nest'));
  state = accepted(commands.startMatchCombat(fieldBench(state)));
  for (let i = 0; i < 12; i++) state = commands.stepMatch(state).state;
  expect(state.phase).toBe('combat');
  expect(state.augmentHistory!.facts.filter(f => f.kind === 'deaths' && !f.deaths.length).length).toBeGreaterThan(5);
  return state;
}

it('reuses independent compressed prefixes, checks every candidate, and detaches restored journals', () => {
  const state = running(), text = JSON.stringify(state);
  expect(restoreMatch(text)).toEqual(state);
  const step = vi.spyOn(commands, 'stepMatch');
  const restored = restoreMatch(text);
  expect(step).not.toHaveBeenCalled();
  expect(restored).toEqual(state);
  const next = commands.stepMatch(state).state;
  step.mockClear();
  expect(restoreMatch(JSON.stringify(next))).toEqual(next);
  expect(step).toHaveBeenCalledTimes(1);
  for (const edit of [
    (s: any) => { s.augmentHistory.facts.find((f: any) => f.kind === 'deaths').completeThroughTick++; },
    (s: any) => { s.augmentHistory.facts.find((f: any) => f.kind === 'deaths').deaths.push({ forged: true }); },
    (s: any) => { s.augmentHistory.facts.pop(); },
    (s: any) => { s.augmentHistory.facts.at(-1).extra = 1; },
    (s: any) => { s.augmentHistory.proof.commands.at(-1).count++; },
    (s: any) => { s.augmentHistory.proof.commands.find((c: any) => c.name === 'selectChoice').args[2] = 'forged'; },
    (s: any) => { s.augmentHistory.proof.origin.gold++; },
    (s: any) => { s.combat.units[0].hp--; },
  ]) {
    const bad = JSON.parse(text); edit(bad);
    expect(() => restoreMatch(JSON.stringify(bad))).toThrow();
    expect(() => restoreMatch(bad)).toThrow();
    expect(() => serializeMatch(bad)).toThrow();
    expect(restoreMatch(text)).toEqual(state);
  }
  (restored.augmentHistory!.facts as AugmentHistoryFact[]).pop();
  expect(restoreMatch(text)).toEqual(state);
  const changing = JSON.parse(text), shop = changing.shop;
  let read = false;
  Object.defineProperty(changing, 'shop', { enumerable: true, get() {
    read = true;
    changing.augmentHistory.facts.at(-1).resourcePrefix = -1;
    return shop;
  } });
  expect(() => restoreMatch(changing)).toThrow(/resource prefix/);
  expect(read).toBe(true);
  expect(JSON.stringify(state)).toBe(text);
});

it('prepares only independent evidence in bounded slices and never admits a changed candidate', () => {
  let state = reachRound('2-1', true, 42, ['snipers-nest']);
  for (let elapsed = 1; elapsed <= 350; elapsed++) state = advanceAugmentPreparationTime(state, elapsed);
  const text = JSON.stringify(state);
  const preparation = prepareAugmentHistoryReplay(state);
  expect(preparation.next().done).toBe(false);
  // Mutating the external candidate after preparation starts cannot change its
  // privately owned replay or become an admission certificate.
  Object.assign(state.augmentHistory!.facts.at(-1)!, { externalMutation: true });
  const bad = JSON.parse(text);
  bad.augmentHistory.facts.at(-1).extra = 1;
  const rejected = prepareAugmentHistoryReplay(bad);
  expect(() => { for (const _ of rejected) { /* complete validation */ } }).toThrow(/augment history/);
  for (const _ of preparation) { /* complete validation */ }
  expect(restoreMatch(text)).toEqual(JSON.parse(text));
  expect(() => restoreMatch(state)).toThrow(/augment history/);
  expect(() => restoreMatch(JSON.stringify(bad))).toThrow(/augment history/);
});
