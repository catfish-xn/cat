/**
 * v15 server wiring, second part: the match end forfeits the surviving seats' unclaimed orbs through the rules'
 * `forfeitTerminalOrbs` (MATCH_CONTRACT #260 / #262 终局入口), and both sides' battle replays carry the rules' combat
 * `statuses` (UR-I3-01) as the server forwards them, the mirrored side B included.
 */
import { describe, expect, it } from 'vitest';
import type { BattleResolver } from '../../src/server/room/battle-resolver';
import { toCombatReplayFor, toSeatPrivateView } from '../../src/server/room/projection';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { BattleInput, RoomState, SeatState, SharedPoolState, TwoSidedBattleResult } from '../../src/server/room/types';
import type { CombatReplay } from '../../src/server-entry';
import { readLootView } from '../../src/simulation/match';
import type { MatchState } from '../../src/simulation/match-types';
import { claimAllOrbs, DamageResolver, expectUniqueRanking, makeRoom, runUntil } from './helpers';

const seat = (state: RoomState, seatId: string): SeatState => state.seats.find(candidate => candidate.seatId === seatId)!;
const unclaimed = (match: MatchState) => readLootView(match).unclaimedOrbs ?? [];

/** Real battles through 1-4 (the PvE rounds earn orbs), then every seat but s0 takes lethal damage in the first PvP round (placeholder PvP). */
class EndAtFirstPvp implements BattleResolver {
  private readonly real = new TwoSidedBattleResolver();
  private readonly lethal = new DamageResolver(seatId => seatId === 's0' ? 0 : 1_000);
  resolveBattle(input: BattleInput, pool: SharedPoolState) { return input.roundKind === 'pvp' ? this.lethal.resolveBattle(input) : this.real.resolveBattle(input, pool); }
}

describe('v15 match end: terminal orb forfeit', () => {
  it('forfeits the winner\'s unclaimed orbs at the end, with the events the rules numbered', () => {
    const { room, clock } = makeRoom(new EndAtFirstPvp(), { pvpMode: 'placeholder' });
    room.start();
    runUntil(room, clock, state => state.roundKind === 'pvp' && state.phase === 'preparation');
    const before = seat(room.state, 's0');
    const owed = unclaimed(before.match);
    expect(owed.length).toBeGreaterThan(0);
    runUntil(room, clock, state => state.phase === 'ended');
    expect(room.state.fault).toBeNull();
    expectUniqueRanking(room.state);
    const winner = seat(room.state, 's0');
    expect(winner.alive).toBe(true);
    expect(winner.rank).toBe(1);
    // Nothing earned is left unclaimed; each forfeited orb has its receipt, and the events came out of the rules numbered.
    expect(unclaimed(winner.match)).toEqual([]);
    expect(toSeatPrivateView(winner.match).unclaimedOrbs).toEqual([]);
    const forfeited = (readLootView(winner.match).claimReceipts ?? []).filter(receipt => receipt.resolution === 'forfeited');
    expect(forfeited.length).toBeGreaterThanOrEqual(owed.length);
    const pushed = winner.serverEvents?.seatRevision === winner.seatRevision ? winner.serverEvents.events : [];
    const lootEvents = pushed.filter(event => event.type === 'lootForfeited' || event.type === 'lootGranted');
    expect(lootEvents.length).toBeGreaterThan(0);
    const seqs = lootEvents.map(event => (event as { eventSeq?: number }).eventSeq);
    for (const [index, value] of seqs.entries()) { expect(value).toBeTypeOf('number'); if (index > 0) expect(value).toBe(seqs[index - 1]! + 1); }
    expect(winner.match.nextMatchEventSeq).toBe(seqs.at(-1)! + 1);
  }, 20_000);

  it('a winner with every orb claimed is published unchanged at the end', () => {
    const { room, clock } = makeRoom(new EndAtFirstPvp(), { pvpMode: 'placeholder' });
    room.start();
    runUntil(room, clock, state => { claimAllOrbs(room, ['s0']); return state.roundKind === 'pvp' && state.phase === 'preparation'; });
    claimAllOrbs(room, ['s0']);
    expect(unclaimed(seat(room.state, 's0').match)).toEqual([]);
    // The settlement publication (ranking set) is the last state before the end; with nothing to forfeit the end keeps it.
    let settled: MatchState | null = null;
    const stop = room.subscribe(state => { if (state.ranking && settled === null) settled = seat(state, 's0').match; });
    runUntil(room, clock, state => state.phase === 'ended');
    stop();
    expect(room.state.fault).toBeNull();
    expect(settled).not.toBeNull();
    expect(unclaimed(settled!)).toEqual([]);
    expect(seat(room.state, 's0').match).toBe(settled);
  }, 20_000);
});

describe('v15 replay: combat statuses on both sides', () => {
  it('side A and the mirrored side B of a two-sided battle both carry the rules\' statuses', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    const count = (replay: CombatReplay) => {
      const views = [replay.initial, ...replay.ticks.flatMap(frame => frame.keyframe ? [frame.keyframe] : []), replay.terminal];
      const viewed = views.flatMap(view => view.units).reduce((sum, unit) => sum + (unit.statuses?.length ?? 0), 0);
      const diffs = replay.ticks.flatMap(frame => frame.events).filter(event => event.type === 'unitUpdated' && event.changes.statuses !== undefined).length;
      return { viewed, diffs };
    };
    let checked = 0;
    const seen = new Set<number>();
    for (let fired = 0; fired < 3_000 && checked === 0 && room.state.phase !== 'ended'; fired++) {
      claimAllOrbs(room);
      if (room.state.phase === 'battle' && !seen.has(room.state.round)) {
        seen.add(room.state.round);
        const real = room.state.battles.filter((battle): battle is TwoSidedBattleResult => battle.kind === 'two-sided' && battle.participants.length === 2);
        for (const battle of real) {
          const a = toCombatReplayFor(room.state, battle.battle.a.seatId)!.replay, b = toCombatReplayFor(room.state, battle.battle.b.seatId)!.replay;
          const sideA = count(a), sideB = count(b);
          if (sideA.viewed + sideA.diffs === 0) continue;
          // The mirror moves cells and teams only: every status and every status update of side A reaches side B.
          expect(sideB).toEqual(sideA);
          expect(b.initial.units.map(unit => unit.statuses ?? [])).toEqual(a.initial.units.map(unit => unit.statuses ?? []));
          checked++;
        }
      }
      if (!clock.runNext()) break;
    }
    expect(checked).toBeGreaterThan(0);
  }, 20_000);
});
