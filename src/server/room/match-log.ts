/**
 * Match facts for later investigation (2026-11-02): every augment a seat takes and every shop it is dealt (round refresh,
 * reroll, …). Server-side log only; the rules are untouched and nothing here reaches another seat. One record per change,
 * found by comparing each published room state with the last one seen (so bots and humans are covered alike), plus the
 * copies left in the shared pool at each preparation entry.
 */
import type { Logger } from '../log';
import type { RoomState } from './types';

interface SeatSeen { readonly augments: Set<string>; generation: number }

export function createMatchLogObserver(log: Logger): (state: RoomState) => void {
  const seen = new Map<string, SeatSeen>();
  let roomId = '', poolRound = -1;
  return state => {
    if (state.roomId !== roomId) { roomId = state.roomId; seen.clear(); poolRound = -1; }
    // Copies left in the shared pool once per preparation: "how many Vanders were still out there" after the fact.
    if (state.phase === 'preparation' && state.round !== poolRound) {
      poolRound = state.round;
      log('info', 'pool.left', { roomId, round: state.round,
        available: Object.entries(state.pool.available).map(([id, n]) => `${id}:${n}`).join(',') });
    }
    for (const seat of state.seats) {
      const match = seat.match;
      let mine = seen.get(seat.seatId);
      if (!mine) { mine = { augments: new Set(), generation: 0 }; seen.set(seat.seatId, mine); }
      for (const augment of match.augments) {
        if (mine.augments.has(augment.choiceId)) continue;
        mine.augments.add(augment.choiceId);
        log('info', 'augment.chosen', { roomId, seatId: seat.seatId, seatKind: seat.kind, round: match.round, augment: augment.definitionId, choiceId: augment.choiceId, acquiredRound: augment.acquiredRound });
      }
      if (match.shop.generation !== mine.generation) {
        mine.generation = match.shop.generation;
        const last = match.shopHistory?.entries.at(-1);
        const cause = last?.kind === 'draw' && last.shop.generation === match.shop.generation ? last.cause : undefined;
        log('info', 'shop.dealt', { roomId, seatId: seat.seatId, seatKind: seat.kind, round: match.round, level: match.level, gold: match.gold,
          generation: match.shop.generation, cause,
          units: match.shop.slots.map(slot => slot.status === 'available' ? `${slot.definitionId}${slot.starLevel === 2 ? '*2' : ''}` : '-').join(',') });
      }
    }
  };
}
