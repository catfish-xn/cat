import { performance } from 'node:perf_hooks';
import { expect, it } from 'vitest';
import { AUGMENT_HISTORY_OWNERS } from '../src/simulation/augment-history-owners';
import { canonicalContent } from '../src/simulation/content';
import { createMatch, nextRound, startMatchCombat } from '../src/simulation/match';
import { restoreMatch } from '../src/simulation/serialization';
import { accepted, finish, resolveM5Choices } from './match-helpers';
import { expectWallClockBelow } from './fixtures/wallclock';
import type { MatchState } from '../src/simulation/match-types';

// Final Polish skips history owners and re-origins the proof at 4-1, so a save
// whose solo proof still starts at round 1 is restored on its own route.
// v26 re-pin: d5-register (3ce71065, four augment registrations and stage bans) changes seed 2's
// offers on this route to Shojin Spirit + Recombobulator (one history acquire; was Shop Glitch then
// Lunch Money). Seed 0 is the first seed whose route acquires two history owners from a round-1
// origin by 3-3: Pandora's Items III then Prismatic Pipeline, 2074 replay steps (seed 2 had 2919).
// The bench stays benched: fielding every fight replays ~3900 steps by the
// second acquire and lands the cold restore next to the 5s budget. Leaving
// units on the bench still loses each round for real and reaches 3-3 with the
// opening origin, both acquires, and well over 1000 replay steps.
const SEED = 0;
const HISTORY = Object.keys(AUGMENT_HISTORY_OWNERS);
const STOP = '3-3';
const LEGS = ['2-2', '2-5', '2-7', STOP] as const;
const entries = new Map<string, MatchState>();
let last = createMatch(SEED);
let openingBytes = '';
let detachedSave: MatchState | undefined;

function longRoute(roundId: string): MatchState {
  let state = entries.get(roundId) ?? last;
  while (state.roundDefinitionId !== roundId) {
    state = resolveM5Choices(state, HISTORY);
    if (state.phase === 'preparation') state = finish(accepted(startMatchCombat(state)));
    state = resolveM5Choices(state, HISTORY);
    if (state.phase !== 'settlement') throw new Error(`Long history route stopped at ${state.roundDefinitionId}/${state.phase}`);
    state = accepted(nextRound(state, state.round));
    entries.set(state.roundDefinitionId, state);
    last = state;
  }
  return state;
}

it.each(LEGS.map(leg => [SEED, leg] as const))('long augment-history route (seed %s) reaches %s from the opening', (_seed, leg) => {
  const state = longRoute(leg);
  expect(state.roundDefinitionId).toBe(leg);
  if (leg !== STOP) return;
  const history = state.augmentHistory;
  expect(history?.proof.kind).toBe('solo');
  if (history?.proof.kind !== 'solo') throw new Error('expected a solo proof from the opening');
  expect(history.proof.origin.round).toBe(1);
  expect(history.facts.filter(fact => fact.kind === 'acquire').length).toBeGreaterThanOrEqual(2);
  expect(history.proof.commands.reduce((steps, command) => steps + command.count, 0)).toBeGreaterThan(1000);
  expect(state.augments.filter(augment => Object.hasOwn(AUGMENT_HISTORY_OWNERS, augment.definitionId)).map(augment => augment.definitionId))
    .toEqual(['pandoras-items-iii', 'prismatic-pipeline']);
  openingBytes = canonicalContent(state);
  detachedSave = structuredClone(state);
});

it('cold restore of the round-1 proof through 3-3 matches the opening bytes', () => {
  const save = detachedSave ?? structuredClone(longRoute(STOP));
  const before = openingBytes || canonicalContent(longRoute(STOP));
  const started = performance.now();
  const cold = restoreMatch(save);
  const coldMs = performance.now() - started;
  console.log(JSON.stringify({ seed: SEED, round: STOP, kind: 'cold', coldMs: Number(coldMs.toFixed(1)), facts: cold.augmentHistory?.facts.length }));
  expectWallClockBelow('augment-history cold restore from round 1 through 3-3', coldMs, 5_000);
  expect(canonicalContent(cold)).toBe(before);
});

it('a second restore of that same save matches the opening bytes', () => {
  const started = performance.now();
  const second = restoreMatch(structuredClone(longRoute(STOP)));
  const secondMs = performance.now() - started;
  console.log(JSON.stringify({ seed: SEED, round: STOP, kind: 'second', secondMs: Number(secondMs.toFixed(1)) }));
  expect(canonicalContent(second)).toBe(openingBytes || canonicalContent(longRoute(STOP)));
});

it('rejects a tampered acquire fact in that long save', () => {
  const state = structuredClone(longRoute(STOP));
  const acquire = state.augmentHistory?.facts.find(fact => fact.kind === 'acquire');
  expect(acquire?.kind).toBe('acquire');
  if (acquire?.kind !== 'acquire') throw new Error('missing acquire fact');
  (acquire as { goldBefore: number }).goldBefore += 1;
  const started = performance.now();
  expect(() => restoreMatch(state)).toThrow(/augment history/);
  const tamperMs = performance.now() - started;
  console.log(JSON.stringify({ seed: SEED, round: STOP, kind: 'tamper', tamperMs: Number(tamperMs.toFixed(1)) }));
});
