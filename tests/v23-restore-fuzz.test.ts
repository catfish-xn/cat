import { describe, expect, it } from 'vitest';
import { randomWalk, seeded, RestoreProbe } from './fixtures/restore-fuzz';
import { readFileSync } from 'node:fs';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { Room, ROOM_TIMING_DEFAULTS } from '../src/server/room/room';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { ManualClock } from '../src/server/room/clock';
import { createMatch, stepMatch, type MatchState } from '../src/simulation/match';

describe('v23 deterministic legitimate save/restore fuzz', () => {
  it('sampling RNG repeats exactly and does not use the match stream', () => {
    const a = seeded(42), b = seeded(42);
    expect(Array.from({ length: 100 }, () => a(997))).toEqual(Array.from({ length: 100 }, () => b(997)));
  });
  it('detects a continuation RNG divergence rather than silently resynchronizing', () => {
    const state = createMatch(42), probe = new RestoreProbe(42, 'checker');
    probe.checkpoint(state);
    const expected = stepMatch(state);
    expect(() => probe.observe(state, expected, s => {
      const result = stepMatch(s);
      return { ...result, state: { ...result.state, rngState: (result.state.rngState ^ 1) >>> 0 } };
    })).toThrow(/continuation bytes/);
  });
  for (const seed of [1, 7, 42, 2025, 0xffffffff]) {
    it(`three entrances and every continuation byte agree: seed=${seed}`, () => {
      const { probe } = randomWalk(seed, 45, true, 5);
      expect(probe.failures).toEqual([]);
      expect(probe.checkpoints).toBeGreaterThan(1);
      expect(probe.continuations).toBeGreaterThan(0);
      expect(probe.coverage.preparation).toBeGreaterThan(0);
      expect(probe.coverage.combat).toBeGreaterThan(0);
    });
  }
});

// Minimized from full public-command walks. Only the last known-good predecessor is
// stored: the production step itself creates each rejected legitimate state.
// Reproduce: --replay-step 1282 --from-step 1281 --seed 2036 --build random
//            --replay-step 7138 --from-step 7137 --seed 1039 --build random

for (const [seed, step, tick, reason] of [
  [2036, 1282, 109, 'status display identity'],
  [1039, 7138, 122, 'status source/timing projection'],
] as const) {
  const fixture = JSON.parse(readFileSync(new URL(`./fixtures/restore-fuzz/seed-${seed}.json`, import.meta.url), 'utf8')) as { seed: number; step: number; previous: MatchState };
  const entrances = {
    json: (state: MatchState) => restoreMatch(JSON.stringify(state)),
    object: (state: MatchState) => restoreMatch(state),
    serialized: (state: MatchState) => restoreMatch(serializeMatch(state)),
  };
  it(`public predecessor is accepted and deterministically produces seed=${seed} step=${step}`, () => {
    expect([fixture.seed, fixture.step]).toEqual([seed, step]);
    const live = stepMatch(fixture.previous);
    expect(live.state.combat!.tick).toBe(tick);
    for (const restore of Object.values(entrances)) expect(stepMatch(restore(fixture.previous))).toEqual(live);
  });
  for (const [entry, restore] of Object.entries(entrances)) {
    it.fails(`${entry} accepts legal seed=${seed} step=${step} (${reason})`, () => {
      const state = stepMatch(fixture.previous).state;
      const restored = restore(state);
      expect(restored).toEqual(state);
      expect(stepMatch(restored)).toEqual(stepMatch(state));
    });
  }
}

it('real Room seats are explicitly outside the Match save contract (seed=42, step=0)', () => {
  const room = new Room(Array.from({ length: 8 }, (_, i) => ({ seatId: `b${i}`, name: `bot${i}`, kind: 'bot' as const })),
    { ...ROOM_TIMING_DEFAULTS, roomId: 'restore-fuzz-contract', seed: 42, clock: new ManualClock(), resolver: new TwoSidedBattleResolver() });
  try {
    room.start();
    const state = room.state.seats[0].match;
    expect(() => restoreMatch(state)).toThrow('multiplayer-state');
    expect(() => restoreMatch(JSON.stringify(state))).toThrow('multiplayer-state');
    expect(() => serializeMatch(state)).toThrow('multiplayer-state');
  } finally { room.dispose(); }
});
