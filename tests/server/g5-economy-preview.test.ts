/**
 * G5 / SR-G5-02: the private seat view carries `economyPreview`, the rules' `previewRoundEconomy` of the same state as
 * it returns it (contract §14.4). Over a whole room match into overtime, every seat's last preview before a settlement
 * equals that settlement's `incomeBreakdown` item by item (interest, victory gold, streak gold) and its `streakAfter`,
 * in the branch of the result (a draw settles as a loss), whenever gold and streak did not change in between.
 */
import { describe, expect, it } from 'vitest';
import { toSeatPrivateView } from '../../src/server/room/projection';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { RoomState } from '../../src/server/room/types';
import { createMatch, previewRoundEconomy, type RoundEconomyPreview } from '../../src/server-entry';
import type { MatchState } from '../../src/simulation/match-types';
import { toDisplayMatch, readEconomyPreview } from '../../src/rendering/online/seat-view-adapter';
import { makeRoom } from './helpers';

describe('G5 economyPreview in the private seat view', () => {
  it('is the rules\' previewRoundEconomy of the same state, null outside preparation and combat', () => {
    const match = createMatch(7);
    const view = toSeatPrivateView(match);
    expect(view.economyPreview).toEqual(previewRoundEconomy(match));
    expect(JSON.parse(JSON.stringify(view)).economyPreview).toEqual(previewRoundEconomy(match));
    for (const phase of ['choice', 'settlement', 'gameOver'] as const) expect(toSeatPrivateView({ ...match, phase } as MatchState).economyPreview).toBeNull();
    // The display adapter carries it as sent; the hint reads nothing else.
    expect(readEconomyPreview(toDisplayMatch(JSON.parse(JSON.stringify(view))))).toEqual(view.economyPreview);
  });

  it('equals the settled incomeBreakdown item by item over a match into overtime (1-x opening, 2-1, overtime, 10-gold steps)', () => {
    // Seed 2 runs past 6-7 into overtime (see projection-wire B7 overtime).
    const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 2 });
    /** Per seat: its preview as last projected before its next round record, with the streak it was computed on. */
    const last = new Map<string, { preview: RoundEconomyPreview | null; streak: MatchState['streak']; round: number }>();
    const settled = new Map<string, number>();
    const compared: { roundId: string; gold: number; branch: 'ifWin' | 'ifLoss' }[] = [];
    const mismatches: string[] = [];
    const observe = (state: RoomState) => {
      for (const seat of state.seats) {
        const match = seat.match, records = match.roundResults.length;
        if (records > (settled.get(seat.seatId) ?? 0)) {
          settled.set(seat.seatId, records);
          const result = match.roundResults.at(-1)!, before = last.get(seat.seatId);
          if (before && before.round === result.round) {
            if (result.result === 'supply') expect(before.preview).toBeNull();
            else if (before.preview && before.preview.gold === result.goldBefore && before.streak.kind === result.streakBefore.kind && before.streak.count === result.streakBefore.count) {
              const branch = result.result === 'playerWin' ? 'ifWin' : 'ifLoss', outcome = before.preview[branch];
              const got = { interest: outcome.interest, win: outcome.win, streak: outcome.streakGold, streakAfter: outcome.streakAfter };
              const want = { interest: result.incomeBreakdown.interest, win: result.incomeBreakdown.win, streak: result.incomeBreakdown.streak, streakAfter: result.streakAfter };
              if (JSON.stringify(got) !== JSON.stringify(want)) mismatches.push(`${seat.seatId} ${result.roundId}: ${JSON.stringify(got)} vs ${JSON.stringify(want)}`);
              expect(before.preview.roundId).toBe(result.roundId);
              compared.push({ roundId: result.roundId, gold: before.preview.gold, branch });
            }
          }
        }
        if (!seat.alive || match.phase === 'settlement' || match.phase === 'choice' || match.phase === 'gameOver') continue;
        // The projection the `state` message carries, through the wire.
        const view = JSON.parse(JSON.stringify(toSeatPrivateView(match))) as ReturnType<typeof toSeatPrivateView>;
        last.set(seat.seatId, { preview: view.economyPreview, streak: { ...match.streak }, round: match.round });
      }
    };
    const unsubscribe = room.subscribe(observe);
    room.start();
    for (let fired = 0; fired < 20_000 && room.state.phase !== 'ended'; fired++) if (!clock.runNext()) break;
    unsubscribe();
    expect(room.state.phase).toBe('ended');
    expect(mismatches).toEqual([]);
    const ids = new Set(compared.map(entry => entry.roundId));
    for (const id of ['1-2', '2-1']) expect(ids.has(id), id).toBe(true);
    expect([...ids].some(id => id.startsWith('overtime-'))).toBe(true);
    expect(compared.some(entry => entry.branch === 'ifWin') && compared.some(entry => entry.branch === 'ifLoss')).toBe(true);
    // Both sides of the 10-gold interest steps.
    expect(compared.some(entry => entry.gold < 10) && compared.some(entry => entry.gold >= 10) && compared.some(entry => entry.gold >= 20)).toBe(true);
    expect(compared.length).toBeGreaterThan(100);
  }, 120_000);
});
