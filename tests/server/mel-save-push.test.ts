/**
 * Playtest 10-22: the own seat's 梅尔 save (`playerSaved`, source mel) goes out with that seat's state push so the
 * client can play the save feedback online; combat-ledger events and other seats' pushes stay out.
 */
import { describe, expect, it } from 'vitest';
import { seatPushEvents } from '../../src/server/room/projection';
import type { SeatState } from '../../src/server/room/types';

const saved = { type: 'playerSaved', battleId: 'b1', playerHp: 1, source: 'mel', domain: 'match', eventSeq: 7 } as const;
const seatWith = (events: readonly unknown[], seatRevision = 3, pushedRevision = 3) =>
  ({ seatId: 's0', seatRevision, serverEvents: { seatRevision: pushedRevision, events } } as unknown as SeatState);

describe('playerSaved push', () => {
  it('pushes the own seat\'s playerSaved with its state push', () => {
    expect(seatPushEvents(seatWith([saved]))).toEqual([saved]);
  });
  it('drops it once the seat has moved on, and never pushes tick-stamped combat events', () => {
    expect(seatPushEvents(seatWith([saved], 4, 3))).toEqual([]);
    expect(seatPushEvents(seatWith([{ type: 'attack', tick: 5 }, saved]))).toEqual([saved]);
  });
});
