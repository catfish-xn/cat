import { expect } from 'vitest';
import type { Room } from '../../src/server/room/room';
import { RouteClock } from './route-clock';
import { makeRoom, claimAllOrbs } from './helpers';
import { clockGroup, routeUntil, type RouteEnvironment } from './slow-route';
import { HUMANS, offerAvarice, chooseAvarice, drainGold, humanVsBot, pvpBattleOf } from './v17-avarice-helpers';

/** The existing public avariceRoom route, with the same runNext groups and 5000-group guard. */
export function* avariceRoute(env: RouteEnvironment, beforeDrain?: (room: Room) => void) {
  const clock = new RouteClock();
  const { room } = makeRoom(env.resolver, { clock, sliceTicks: 25 });
  env.dispose(() => room.dispose()); room.start();
  for (let fired = 0; ; fired++) {
    expect(fired).toBeLessThan(5_000);
    claimAllOrbs(room);
    if (room.state.phase === 'preparation' && room.state.seats.some(seat => seat.match.pendingChoice?.kind === 'anomaly')) break;
    if (room.state.phase === 'ended' || !(yield* clockGroup(room, clock))) throw new Error('no anomaly window');
  }
  for (const seatId of HUMANS) { offerAvarice(room, seatId, 'reroll'); chooseAvarice(room, seatId); yield room.state.round; }
  beforeDrain?.(room); yield room.state.round;
  for (const seatId of HUMANS) { drainGold(room, seatId); yield room.state.round; }
  return { room, clock };
}
export function* nextBattleRoute(room: Room, clock: RouteEnvironment['clock'], roundName: string) {
  return yield* routeUntil(room, clock, state => { claimAllOrbs(room); return state.roundName === roundName && state.phase === 'battle'; });
}
export function* atBattleRoute(env: RouteEnvironment, seatId?: string) {
  const { room, clock } = yield* avariceRoute(env);
  yield* nextBattleRoute(room, clock, '4-6');
  const { a: seat, battle: frozen } = seatId
    ? {a:seatId,battle:pvpBattleOf(room.state,seatId)!} : humanVsBot(room.state);
  expect(pvpBattleOf(room.state, seat)).toBe(frozen);
  return { room, clock, seat, frozen, end: frozen.battle.terminal.tick, startedAt: clock.now() };
}
export function* mirrorBattleRoute(room: Room, clock: RouteClock) {
  let last = room.state.phase === 'battle' ? room.state.roundName : '';
  for (let rounds = 0; rounds < 12; rounds++) {
    const state = yield* routeUntil(room, clock, current => { claimAllOrbs(room); return current.phase === 'battle' && current.roundName !== last; });
    last = state.roundName;
    const battle = state.battles.find((entry): entry is import('../../src/server/room/types').TwoSidedBattleResult => entry.kind === 'two-sided' && entry.participants.length === 1
      && (HUMANS as readonly string[]).includes(entry.battle.a.seatId) && (HUMANS as readonly string[]).includes(entry.battle.b.seatId)
      && pvpBattleOf(state, entry.battle.b.seatId) !== undefined && pvpBattleOf(state, entry.battle.b.seatId) !== entry);
    if (battle) return { a: battle.battle.a.seatId, copy: battle.battle.b.seatId, battle };
  }
  throw new Error('no mirror battle between human seats');
}
