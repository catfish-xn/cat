import { vi } from 'vitest';

// Rule-side integration fixture: construct actual deferred openings per §18.2.
// Only the constructor option is supplied here; every pool transaction, room timer,
// battle, projection and assertion is real. Production Room wiring is Claude §5.1
// and remains independently exercised (and reported) by the unchanged tests/server.
vi.mock('../src/simulation/match', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/simulation/match')>();
  return { ...actual, createMatch: (seed: number, options?: Parameters<typeof actual.createMatch>[1]) =>
    actual.createMatch(seed, options ?? { mode: 'shared-deferred' }) };
});

import { expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { SEATS, TIMINGS, runUntil } from './server/helpers';
import { Room, ROOM_TIMING_DEFAULTS } from '../src/server/room/room';
import { ManualClock } from '../src/server/room/clock';

it('T11 eight-seat whole game automatically continues x-3 → x-4 supply → x-5 and x-7 → next x-1 without extra battles', () => {
  const clock=new ManualClock();
  // Real seed 0 with eight active bots reaches overtime-2 under randomized loot.
  // v26 rule changes (14.24 neutrals 568eeea4, PvE loss damage ef0490c4, targeting P0/P1, D5 offers) end seed 0 at 6-6;
  // seed 20 is the first seed from 1 whose eight-bot game reaches overtime (overtime-3), so every x-7 → next transition is exercised.
  const room=new Room(SEATS.map(s=>({...s,kind:'bot'})),{...ROOM_TIMING_DEFAULTS,...TIMINGS,roomId:'t11-flow',seed:20,clock,resolver:new TwoSidedBattleResolver()});
  const rounds: string[] = [];
  const phases = new Map<string, Set<string>>();
  const battleEntries = new Map<string, number>();
  let lastPhase = '';
  let lastRound = '';
  room.subscribe(state => {
    if (!state.roundId) return;
    if (state.phase === 'battle' && (lastPhase !== 'battle' || lastRound !== state.roundId))
      battleEntries.set(state.roundId, (battleEntries.get(state.roundId) ?? 0) + 1);
    lastPhase = state.phase; lastRound = state.roundId;
    if (rounds.at(-1) !== state.roundId) rounds.push(state.roundId);
    const seen = phases.get(state.roundId) ?? new Set<string>();
    seen.add(state.phase); phases.set(state.roundId, seen);
  });
  room.start();
  runUntil(room, clock, state => state.phase === 'ended', 20_000);
  expect(room.state.fault).toBeNull();
  expect(room.state.ranking).toHaveLength(8);
  expect(new Set(room.state.settlements).size).toBe(room.state.settlements.length);
  expect(room.state.settlements).toHaveLength(rounds.length);
  expect(rounds.slice(0, 38)).toEqual(['1-2', '1-3', '1-4',
    ...[2, 3, 4, 5, 6].flatMap(stage => [1, 2, 3, 4, 5, 6, 7].map(r => `${stage}-${r}`))]);
  expect(rounds[38]).toBe('overtime-1');
  for (const [index, id] of rounds.entries()) {
    const [stage, subround] = id.split('-').map(Number);
    const supply = stage! >= 2 && stage! <= 6 && subround === 4;
    expect(battleEntries.get(id) ?? 0, `${id}: actual battle phase entries`).toBe(supply ? 0 : 1);
    if (stage! >= 2 && stage! <= 6 && subround === 4) {
      expect(rounds.slice(index - 1, index + 2)).toEqual([`${stage}-3`, `${stage}-4`, `${stage}-5`]);
      expect(phases.get(id)).toContain('choice');
      expect(phases.get(id)).not.toContain('battle');
      expect(phases.get(`${stage}-5`)).toContain('preparation');
    }
    if (subround === 7 && index + 1 < rounds.length) {
      expect(rounds[index + 1]).toBe(stage === 6 ? 'overtime-1' : `${stage! + 1}-1`);
      expect(phases.get(rounds[index + 1]!)).toContain('preparation');
    }
  }
}, 60_000);
