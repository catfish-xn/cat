/**
 * Whitelisted client views (V2 §5.3). Built field by field; the room's MatchState, rng
 * states, pairings of other seats and other seats' shops are never serialized.
 */
import type { LedgerCombatEvent } from '../../simulation/combat-types';
import type { CombatFrame } from '../protocol';
import { findPairing } from './pairing';
import type { BattleFrame, PlayerView, PlayerViewPhaseKind, RoomPhase, RoomState, SeatPublic, SeatState } from './types';

const PHASE_VIEW: Readonly<Record<RoomPhase, PlayerViewPhaseKind>> = {
  waiting: 'lobby', preparation: 'preparation', choice: 'choice', frozen: 'combat', battle: 'combat', settlement: 'settlement', ended: 'ended',
};

export function toSeatPublic(seat: SeatState): SeatPublic {
  return { seatId: seat.seatId, name: seat.name, kind: seat.kind, hp: seat.hp, level: seat.match.level, alive: seat.alive, rank: seat.rank, connected: seat.connected };
}

export function toPlayerView(room: RoomState, seatId: string, serverNow: number): PlayerView {
  if (!room.seats.some(seat => seat.seatId === seatId)) throw new RangeError(`unknown seat ${seatId}`);
  const pairing = findPairing(room.pairings, seatId);
  // The mirrored seat is shown its source as the opponent; the view has no separate mirror field yet.
  const opponentSeatId = pairing === null ? null : pairing.opponent.kind === 'seat' ? pairing.opponent.seatId : pairing.opponent.sourceSeatId;
  const seats = room.seats.map(toSeatPublic);
  const ranking = room.ranking === null ? null
    : room.ranking.map(entry => seats.find(seat => seat.seatId === entry.seatId)!);
  return {
    mySeatId: seatId,
    seats,
    phase: { kind: PHASE_VIEW[room.phase], round: room.round, roundName: room.roundName, endsAt: room.deadlineAt, serverNow },
    opponentSeatId,
    ranking,
  };
}

/** The shared CombatFrame of src/server/protocol.ts; the old name stays for existing callers. */
export type CombatFrameView = CombatFrame;

/** This seat's own battle frames of the current round, in playback order; empty outside a resolved round. */
export function toCombatFrames(room: RoomState, seatId: string): readonly CombatFrameView[] {
  for (const battle of room.battles) {
    const outcome = battle.outcomes.find(candidate => candidate.seatId === seatId);
    if (outcome) return outcome.frames.map(toCombatFrame);
  }
  return [];
}
function toCombatFrame(frame: BattleFrame): CombatFrameView {
  return { state: frame.state, events: frame.events.filter((event): event is LedgerCombatEvent => 'tick' in event) };
}
