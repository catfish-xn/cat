import { expect } from 'vitest';
import type { Room } from '../../src/server/room/room';

/** Establish a fixture's actual offer using the existing three public per-slot rerolls. */
export function roomOfferFor(room: Room, seatId: string, definitionId: string) {
  const seat = () => room.state.seats.find(candidate => candidate.seatId === seatId)!;
  for (let slot = 0; slot < 3 && !seat().match.pendingChoice?.offers.includes(definitionId); slot++) {
    const current = seat(), choice = current.match.pendingChoice!;
    const command = { type: 'rerollAugment' as const, choiceId: choice.choiceId, generation: choice.generation, optionIndex: slot };
    const result = current.controller === 'bot'
      ? room.handleBot(seatId, current.controlEpoch, command) : room.handle(seatId, command);
    expect(result).toMatchObject({ ok: true });
  }
  expect(seat().match.pendingChoice?.offers).toContain(definitionId);
  return seat();
}
