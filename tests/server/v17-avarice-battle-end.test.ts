/**
 * v17 server acceptance 5 (docs/V17_AVARICE_ONLINE.md): gold changes near the end of a battle. The live run follows the
 * battle clock LIVE_BANK_LEAD_TICKS ahead; a change whose live tick is past the frozen end is not sampled, one exactly at
 * the end has no rules step left to read it, and a change after a live run finished leaves its result alone. None of
 * these faults or re-settles; the economy command itself still changes only the seat's real gold.
 */
import { describe, expect, it } from 'vitest';
import { LIVE_BANK_LEAD_TICKS } from '../../src/server/room/live-bank';
import { runUntil } from './helpers';
import { pvpBattleOf, spendGold } from './v17-avarice-helpers';
import { TICK_MS, atBattle, disposeAfterEach, liveTickAt, settle } from './v17-avarice-battle-end-helpers';

disposeAfterEach();

describe('v17 avarice: gold changes at the end of a battle', () => {
  it('one tick before the frozen end is still sampled and adopted', () => {
    const { room, clock, seat, frozen, end, startedAt } = atBattle();
    expect(end).toBeGreaterThan(LIVE_BANK_LEAD_TICKS + 1);
    clock.advance(liveTickAt(startedAt, end - 1) - clock.now());
    const gold = spendGold(room, seat);
    settle(room, clock);
    expect(room.state.fault).toBeNull();
    const published = pvpBattleOf(room.state, seat)!;
    expect(published).not.toBe(frozen);
    expect(published.battle.bankSamples).toEqual([{ tick: end - 1, team: 'player', liveGold: gold }]);
  }, 120_000);

  it('after a live run finished, a later change leaves its result; the battle phase lasts as long as the live run', () => {
    const { room, clock, seat, frozen, end, startedAt } = atBattle();
    clock.advance(400);
    const sampled = spendGold(room, seat);
    // Let the live run finish (it runs at most LIVE_BANK_LEAD_TICKS ahead of the clock), but stay inside the battle.
    runUntil(room, clock, state => { const battle = pvpBattleOf(state, seat)!; return battle !== frozen || state.phase !== 'battle'; });
    expect(room.state.phase).toBe('battle');
    const adopted = pvpBattleOf(room.state, seat)!;
    expect(adopted.battle.bankSamples!.map(sample => sample.liveGold)).toEqual([sampled]);
    // The phase now ends after the adopted run's last tick, whatever the frozen end was.
    expect(room.state.deadlineAt).toBeGreaterThanOrEqual(startedAt + (adopted.battle.terminal.tick + 1) * TICK_MS);
    if (adopted.battle.terminal.tick !== end) expect(room.state.deadlineAt).not.toBe(startedAt + (end + 1) * TICK_MS);
    const published = room.state.battles;
    spendGold(room, seat);
    settle(room, clock);
    expect(room.state.fault).toBeNull();
    expect(pvpBattleOf(room.state, seat)).toBe(adopted);
    expect(room.state.battles).toEqual(published);
  }, 120_000);
});
