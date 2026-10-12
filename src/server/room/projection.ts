/**
 * Whitelisted client views (V2 §5.3). Built field by field; the room's MatchState, rng
 * states, pairings of other seats and other seats' shops are never serialized. Other seats'
 * deployed units and their items are public (C5, `publicBoard`).
 */
import type { HexCell } from '../../simulation/board';
import type { CombatResult, CombatState, CombatUnit, LedgerCombatEvent } from '../../simulation/combat-types';
import type { MatchState } from '../../simulation/match-types';
import type { PublicBoard, PublicBoardUnit } from '../protocol';
import { findPairing } from './pairing';
import type { BattleResult, CombatFrame, PlayerView, PlayerViewFault, PlayerViewPhaseKind, RoomFault, RoomPhase, RoomState, SeatPublic, SeatState } from './types';

const PHASE_VIEW: Readonly<Record<RoomPhase, PlayerViewPhaseKind>> = {
  waiting: 'lobby', preparation: 'preparation', choice: 'choice', frozen: 'combat', battle: 'combat', 'awaiting-settlement': 'settlement', settlement: 'settlement', ended: 'ended',
};

export function toSeatPublic(seat: SeatState): SeatPublic {
  return { seatId: seat.seatId, name: seat.name, kind: seat.kind, hp: seat.hp, level: seat.match.level, alive: seat.alive, rank: seat.rank, connected: seat.connected,
    publicBoard: toPublicBoard(seat.match) };
}

/**
 * Public build of one seat (C5): its own units deployed on the board, each with the definition ids of the
 * items it holds. Built field by field from the preparation state; bench, shop, gold, XP, item instance ids
 * and RNG never leave the room. Sorted by cell so equal boards serialize identically.
 */
export function toPublicBoard(match: MatchState): PublicBoard {
  const units: PublicBoardUnit[] = [];
  for (const unit of match.preparation.units) {
    if (unit.team !== 'player' || unit.location.kind !== 'board') continue;
    const held = match.items.filter(item => item.location.kind === 'unit' && item.location.unitId === unit.id)
      .sort((a, b) => (a.location.kind === 'unit' ? a.location.slot : 0) - (b.location.kind === 'unit' ? b.location.slot : 0));
    units.push({ definitionId: unit.definitionId, starLevel: unit.starLevel, cell: { col: unit.location.cell.col, row: unit.location.cell.row }, items: held.map(item => item.definitionId) });
  }
  units.sort((a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col);
  return { units };
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
    fault: room.fault === null ? null : toPlayerFault(room.fault),
  };
}

/** Human-readable fault for the client; the structured RoomFault stays on the server. */
export function toPlayerFault(fault: RoomFault): PlayerViewFault {
  switch (fault.kind) {
    case 'resolver-error': return { kind: fault.kind, detail: `战斗 ${fault.battleId} 结算出错：${fault.reason ?? fault.message}` };
    case 'invalid-results': return { kind: fault.kind, detail: `结算结果无效：${fault.detail}` };
    case 'seat-stuck': return { kind: fault.kind, detail: `席位 ${fault.seatId} 无法推进：${fault.reason}` };
    case 'phase-mismatch': return { kind: fault.kind, detail: `阶段不一致：${fault.detail}` };
    case 'overtime-unavailable': return { kind: fault.kind, detail: `第 ${fault.round} 轮（目录末轮）后仍有 ${fault.survivors.length} 席存活，需要加时；规则侧的加时推进入口尚未交付，房间明确中断而不自造名次` };
  }
}

/** Kept for B1 callers; the shared shape is CombatFrame of src/server/protocol.ts. */
export type CombatFrameView = CombatFrame;

/**
 * This seat's battle frames of the current round, in playback order; empty outside a resolved round.
 * A two-sided battle was run once from side A's point of view; a real side-B participant gets the
 * same frames mirrored (B3, §10.6 item 3). A mirror source is not a participant and gets nothing.
 */
export function toCombatFrames(room: RoomState, seatId: string): readonly CombatFrameView[] {
  for (const battle of room.battles) {
    const frames = framesFor(battle, seatId);
    if (frames) return frames;
  }
  return [];
}
function framesFor(battle: BattleResult, seatId: string): readonly CombatFrameView[] | null {
  if (battle.kind === 'placeholder') return battle.outcomes.find(candidate => candidate.seatId === seatId)?.frames ?? null;
  if (!battle.participants.includes(seatId)) return null;
  if (battle.battle.a.seatId === seatId) return battle.frames;
  if (battle.battle.b.seatId === seatId) return battle.frames.map(mirrorCombatFrame);
  return null;
}

/**
 * Side B's view of a two-sided frame: teams swap and rows flip (`row = rows - 1 - row`, the inverse of
 * the compile-time mirror in §10.3), so B sees its own units as `player` at the bottom. Pure display
 * projection of server data; no unit, number or outcome is recomputed.
 */
export function mirrorCombatFrame(frame: CombatFrame): CombatFrame {
  const rows = frame.state.board.rows;
  return { state: mirrorCombatState(frame.state, rows), events: frame.events.map(event => mirrorEvent(event, rows)) };
}
const flipCell = (cell: HexCell, rows: number): HexCell => ({ col: cell.col, row: rows - 1 - cell.row });
const swapTeam = (team: CombatUnit['team']): CombatUnit['team'] => team === 'player' ? 'enemy' : 'player';
const swapResult = (result: CombatResult | null): CombatResult | null => result === 'playerWin' ? 'enemyWin' : result === 'enemyWin' ? 'playerWin' : result;
function mirrorCombatState(state: CombatState, rows: number): CombatState {
  const { player, enemy } = state.board.deploymentZones;
  return {
    ...state,
    board: { ...state.board, deploymentZones: { player: enemy, enemy: player } },
    units: state.units.map(unit => ({ ...unit, team: swapTeam(unit.team), cell: flipCell(unit.cell, rows), ...(unit.startingCell ? { startingCell: flipCell(unit.startingCell, rows) } : {}) })),
    result: swapResult(state.result),
  };
}
function mirrorEvent(event: LedgerCombatEvent, rows: number): LedgerCombatEvent {
  switch (event.type) {
    case 'movement': return { ...event, from: flipCell(event.from, rows), to: flipCell(event.to, rows) };
    case 'combatFinished': return { ...event, result: swapResult(event.result) ?? event.result };
    case 'cast': return { ...event, receipt: { ...event.receipt, completionCell: flipCell(event.receipt.completionCell, rows) } };
    default: return event;
  }
}
