import { afterEach, expect } from 'vitest';
import { LIVE_BANK_LEAD_TICKS } from '../../src/server/room/live-bank';
import type { Room } from '../../src/server/room/room';
import { runUntil } from './helpers';
import { avariceRoom, humanVsBot, nextBattle, pvpBattleOf } from './v17-avarice-helpers';

// Shared by v17-avarice-battle-end*.test.ts.
const disposers: (() => void)[] = [];
/** Registers the per-file cleanup; call once at the top level of a test file. */
export const disposeAfterEach = () => afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); });
export const TICK_MS = 50;

/**
 * 4-6: an avarice seat on side A against a bot (s2 against s5 under seed 42). Returns that seat, the frozen battle, its
 * last tick and the battle start time.
 */
export function atBattle() {
  const { room, clock } = avariceRoom(dispose => disposers.push(dispose));
  nextBattle(room, clock, '4-6');
  const { a: seat, battle: frozen } = humanVsBot(room.state);
  expect(pvpBattleOf(room.state, seat)).toBe(frozen);
  return { room, clock, seat, frozen, end: frozen.battle.terminal.tick, startedAt: clock.now() };
}
/** Moves the battle clock so the live tick (clock tick + lead) is `liveTick`. */
export const liveTickAt = (startedAt: number, liveTick: number) => startedAt + (liveTick - LIVE_BANK_LEAD_TICKS) * TICK_MS;
export const settle = (room: Room, clock: Parameters<typeof runUntil>[1]) => runUntil(room, clock, state => state.roundName === '4-6' && state.phase !== 'battle');
