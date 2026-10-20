/**
 * v17 server acceptance 5 (docs/V17_AVARICE_ONLINE.md): gold changes near the end of a battle. The live run follows the
 * battle clock LIVE_BANK_LEAD_TICKS ahead; a change whose live tick is past the frozen end is not sampled, one exactly at
 * the end has no rules step left to read it, and a change after a live run finished leaves its result alone. None of
 * these faults or re-settles; the economy command itself still changes only the seat's real gold.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { LIVE_BANK_LEAD_TICKS } from '../../src/server/room/live-bank';
import type { Room } from '../../src/server/room/room';
import { runUntil } from './helpers';
import { avariceRoom, nextBattle, pvpBattleOf, seatOf, spendGold } from './v17-avarice-helpers';

const disposers: (() => void)[] = [];
afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); });
const TICK_MS = 50;

/** Seed 42, 4-6: s0 (avarice, side A) fights bot s5. Returns the frozen battle, its last tick and the battle start time. */
function atBattle() {
  const { room, clock } = avariceRoom(dispose => disposers.push(dispose));
  nextBattle(room, clock, '4-6');
  const frozen = pvpBattleOf(room.state, 's0')!;
  expect(frozen.battle.a.seatId).toBe('s0');
  return { room, clock, frozen, end: frozen.battle.terminal.tick, startedAt: clock.now() };
}
/** Moves the battle clock so the live tick (clock tick + lead) is `liveTick`. */
const liveTickAt = (startedAt: number, liveTick: number) => startedAt + (liveTick - LIVE_BANK_LEAD_TICKS) * TICK_MS;
const settle = (room: Room, clock: Parameters<typeof runUntil>[1]) => runUntil(room, clock, state => state.roundName === '4-6' && state.phase !== 'battle');

describe('v17 avarice: gold changes at the end of a battle', () => {
  it('one tick before the frozen end is still sampled and adopted', () => {
    const { room, clock, frozen, end, startedAt } = atBattle();
    expect(end).toBeGreaterThan(LIVE_BANK_LEAD_TICKS + 1);
    clock.advance(liveTickAt(startedAt, end - 1) - clock.now());
    const gold = spendGold(room, 's0');
    settle(room, clock);
    expect(room.state.fault).toBeNull();
    const published = pvpBattleOf(room.state, 's0')!;
    expect(published).not.toBe(frozen);
    expect(published.battle.bankSamples).toEqual([{ tick: end - 1, team: 'player', liveGold: gold }]);
  }, 120_000);

  it('exactly at the frozen end, or past it, the change is not sampled and the frozen battle settles; no fault', () => {
    for (const offset of [0, 1, 40]) {
      const { room, clock, frozen, end, startedAt } = atBattle();
      const hp = seatOf(room.state, 's0').hp;
      clock.advance(liveTickAt(startedAt, end + offset) - clock.now());
      expect(room.state.phase).toBe('battle');
      const before = seatOf(room.state, 's0').match.gold;
      const gold = spendGold(room, 's0');
      // The economy command itself went through: only the seat's real gold changed.
      expect(gold).toBeLessThan(before);
      expect(room.liveFrames(frozen.battleId)).toBeNull();
      settle(room, clock);
      expect(room.state.fault, `offset ${offset}`).toBeNull();
      expect(pvpBattleOf(room.state, 's0'), `offset ${offset}`).toBe(frozen);
      expect(seatOf(room.state, 's0').hp).toBe(Math.max(0, hp - frozen.proposals.a.damage));
      room.dispose();
    }
  }, 300_000);

  it('after a live run finished, a later change leaves its result; the battle phase lasts as long as the live run', () => {
    const { room, clock, frozen, end, startedAt } = atBattle();
    clock.advance(400);
    const sampled = spendGold(room, 's0');
    // Let the live run finish (it runs at most LIVE_BANK_LEAD_TICKS ahead of the clock), but stay inside the battle.
    runUntil(room, clock, state => { const battle = pvpBattleOf(state, 's0')!; return battle !== frozen || state.phase !== 'battle'; });
    expect(room.state.phase).toBe('battle');
    const adopted = pvpBattleOf(room.state, 's0')!;
    expect(adopted.battle.bankSamples!.map(sample => sample.liveGold)).toEqual([sampled]);
    // The phase now ends after the adopted run's last tick, whatever the frozen end was.
    expect(room.state.deadlineAt).toBeGreaterThanOrEqual(startedAt + (adopted.battle.terminal.tick + 1) * TICK_MS);
    if (adopted.battle.terminal.tick !== end) expect(room.state.deadlineAt).not.toBe(startedAt + (end + 1) * TICK_MS);
    const published = room.state.battles;
    spendGold(room, 's0');
    settle(room, clock);
    expect(room.state.fault).toBeNull();
    expect(pvpBattleOf(room.state, 's0')).toBe(adopted);
    expect(room.state.battles).toEqual(published);
  }, 120_000);
});
