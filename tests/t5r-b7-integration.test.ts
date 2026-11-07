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
import { applyCombatReplayTick } from '../src/server-entry';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { toCombatReplayFor, toSeatPrivateView } from '../src/server/room/projection';
import { readLootView } from '../src/simulation/loot-view';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import { expectUniqueRanking, makeRoom } from './server/helpers';
import { carryByDrop, nextPveRoundId } from '../src/simulation/pve-loot-carry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';

// v26: the 14.24 neutrals (568eeea4), PvE loss damage and targeting P0/P1 shorten room seed 42 to 28 battle rounds (ends at
// round 32), below this complete-match bound of 30. Re-searched room seeds 1..7 under the same assertions: seed 2 is the
// first that keeps 30 battle rounds and every replay/loot/ranking check (seeds 2, 4, 5 and 7 pass; 1, 3, 6 end at 29).
it('SR-B7-01 / SR-C7-02: seed2 eight-seat complete match preserves every replay and current revealed loot', () => {
  const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 2 });
  const rounds = new Set<number>(), wolves = new Set<string>();
  const pveSeats = new Map<string, Set<string>>(), rewardedSeats = new Set<string>(), kinds = new Set<string>();
  const enteredPveSeats = new Map<string, string[]>(), settledPveSeats = new Map<string, Set<string>>();
  const observed = new WeakSet<object>(), carriedDrops = new Set<string>();
  const checkLoot = () => {
    const state = room.state;
    if (state.roundKind === 'pve' && !enteredPveSeats.has(state.roundId)) {
      enteredPveSeats.set(state.roundId, state.seats.filter(seat => seat.alive).map(seat => seat.seatId).sort());
    }
    for (const seat of room.state.seats) {
      const match = seat.match;
      if (observed.has(match)) continue;
      observed.add(match);
      // Exercise the actual server wrapper, including JSON wire serialization.
      const view = JSON.parse(JSON.stringify(toSeatPrivateView(match)));
      kinds.add(match.m8.round.kind);
      expect(view.m8).not.toHaveProperty('loot');
      if (match.m8.round.kind !== 'pve') {
        expect(view).not.toHaveProperty('revealedLoot');
        continue;
      }
      const expected = readLootView(match).revealedDrops;
      expect(view.revealedLoot, `${match.roundDefinitionId}/${seat.seatId}/${match.phase}`)
        .toEqual({ roundId: match.roundDefinitionId, revealedDrops: expected, revealedOrbs: readLootView(match).revealedOrbs });
      // v26 PvE loot carryover (8f794062, docs/CURSOR_pve-loot-carryover.md): loot a lost PvE round would have forfeited is
      // paid with the next PvE round and listed there under its original round/encounter. Every other drop is this round's.
      const carry = carryByDrop(match);
      for (const drop of view.revealedLoot.revealedDrops) {
        if (drop.roundId === match.roundDefinitionId) {
          expect(drop.encounterId).toBe(match.m8.round.encounterId);
          continue;
        }
        // A carried drop appears from its delivery PvE on; after that round only while still outstanding (not yet paid).
        const row = carry.get(drop.dropId)!;
        expect(row, `${match.roundDefinitionId}/${seat.seatId}: ${drop.dropId}`).toBeDefined();
        expect(row.deliverRoundId).toBe(nextPveRoundId(drop.roundId));
        expect(getCatalogRoundById(row.deliverRoundId).ordinal).toBeLessThanOrEqual(match.round);
        if (row.deliverRoundId !== match.roundDefinitionId) expect(['revealed', 'pending-capacity']).toContain(drop.status);
        const frozen = match.m8.loot.frozen.rounds.flatMap(round => round.encounterPlan.drops).find(entry => entry.dropId === drop.dropId)!;
        expect([frozen.roundId, frozen.encounterId]).toEqual([drop.roundId, drop.encounterId]);
        carriedDrops.add(drop.dropId);
      }
      if (expected.length) rewardedSeats.add(seat.seatId);
      const seen = pveSeats.get(match.roundDefinitionId) ?? new Set<string>();
      seen.add(seat.seatId);
      pveSeats.set(match.roundDefinitionId, seen);
      if (match.roundResults.at(-1)?.roundId === match.roundDefinitionId) {
        const settled = settledPveSeats.get(match.roundDefinitionId) ?? new Set<string>();
        settled.add(seat.seatId);
        settledPveSeats.set(match.roundDefinitionId, settled);
      }
    }
  };
  try {
    room.start();
    for (let timers = 0; timers < 20_000 && room.state.phase !== 'ended'; timers++) {
      const state = room.state;
      checkLoot();
      if (state.phase === 'battle' && state.roundKind !== 'supply' && !rounds.has(state.round)) {
        rounds.add(state.round);
        let count = 0;
        for (const seat of state.seats.filter(s => s.alive)) {
          const projected = toCombatReplayFor(state, seat.seatId);
          expect(projected, `${state.roundId}/${seat.seatId}`).not.toBeNull();
          const replay = projected!.replay;
          let view = replay.initial;
          for (const frame of replay.ticks) view = applyCombatReplayTick(view, frame);
          expect(view).toEqual(replay.terminal);
          if (state.roundId === '3-7') wolves.add(seat.seatId);
          count++;
        }
        expect(count).toBeGreaterThan(0);
      }
      if (!clock.runNext()) break;
    }
    expect(room.state.phase).toBe('ended');
    checkLoot();
    expect(room.state.fault).toBeNull();
    expectUniqueRanking(room.state);
    expect(rounds.size).toBeGreaterThanOrEqual(30);
    expect(wolves.size).toBe(8);
    expect([...kinds].sort()).toEqual(['pve', 'pvp', 'supply']);
    expect([...pveSeats.keys()]).toEqual(ROUND_CATALOG.filter(round => round.kind === 'pve' && round.ordinal <= room.state.round).map(round => round.roundId));
    expect(pveSeats.has('5-7')).toBe(true);
    for (const [roundId, seats] of pveSeats) {
      // Eliminated seats stop entering later rounds; every actual participant must be checked after settlement too.
      expect([...seats].sort(), roundId).toEqual(enteredPveSeats.get(roundId));
      expect([...(settledPveSeats.get(roundId) ?? [])].sort(), roundId).toEqual(enteredPveSeats.get(roundId));
    }
    expect(pveSeats.get('1-2')!.size).toBe(8);
    expect(pveSeats.get('3-7')!.size).toBe(8);
    expect(rewardedSeats.size).toBe(8);
  } finally { room.dispose(); }
// T13 eight-seat replay audit measured 62.88s on one worker; preserve the complete run.
}, 120_000);
