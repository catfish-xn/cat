/**
 * Whitelisted client views (V2 §5.3). Built field by field; the room's MatchState, rng
 * states, pairings of other seats and other seats' shops are never serialized. Other seats'
 * deployed units and their items are public (C5, `publicBoard`). A seat's own state leaves only
 * as the rules' `toPrivateSeatView` (B7, contract §14.1), its battle as a compact replay (§14.2).
 */
import type { HexCell } from '../../simulation/board';
import type { CombatResult, CombatUnit } from '../../simulation/combat-types';
import type { MatchState } from '../../simulation/match-types';
import {
  toCombatReplay, toPrivateSeatView, type CombatReplay, type CombatViewEvent, type CombatViewState, type PrivateSeatView,
} from '../../server-entry';
import type { PublicBoard, PublicBoardUnit } from '../protocol';
import { findPairing } from './pairing';
import type { PlayerView, PlayerViewFault, PlayerViewPhaseKind, RoomFault, RoomPhase, RoomState, SeatPublic, SeatState } from './types';

const PHASE_VIEW: Readonly<Record<RoomPhase, PlayerViewPhaseKind>> = {
  waiting: 'lobby', preparation: 'preparation', choice: 'choice', frozen: 'combat', battle: 'combat', 'awaiting-settlement': 'settlement', settlement: 'settlement', ended: 'ended',
};

export function toSeatPublic(seat: SeatState): SeatPublic {
  return { seatId: seat.seatId, name: seat.name, kind: seat.kind, hp: seat.hp, level: seat.match.level, alive: seat.alive, rank: seat.rank, connected: seat.connected, controller: seat.controller,
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
  }
}

const flipCell = (cell: HexCell, rows: number): HexCell => ({ col: cell.col, row: rows - 1 - cell.row });
const swapTeam = (team: CombatUnit['team']): CombatUnit['team'] => team === 'player' ? 'enemy' : 'player';
const swapResult = (result: CombatResult | null): CombatResult | null => result === 'playerWin' ? 'enemyWin' : result === 'enemyWin' ? 'playerWin' : result;

/* ---------------- B7: private seat state and compact replay (contract §14) ---------------- */

/** The only shape in which a seat's own MatchState leaves the room (initial, increment, resume, fault, refusal). */
export function toSeatPrivateView(match: MatchState): PrivateSeatView { return toPrivateSeatView(match); }

export interface SeatReplay { readonly battleId: string; readonly replay: CombatReplay }

/**
 * One replay per battle, built on first request and kept with the (immutable) battle result it came from:
 * every later push, resume or second participant reuses it, so the pure re-execution runs once per battle
 * (§14.3). Keys are the room's own result objects, so a finished room's replays go with it.
 */
const replays = new WeakMap<object, CombatReplay>();
const mirroredReplays = new WeakMap<object, CombatReplay>();
function cached(cache: WeakMap<object, CombatReplay>, key: object, build: () => CombatReplay): CombatReplay {
  const hit = cache.get(key);
  if (hit) return hit;
  const replay = build();
  cache.set(key, replay);
  return replay;
}

/**
 * This seat's battle of the current round as a CombatReplay from its own point of view; null outside a
 * resolved round or for a seat without a battle (supply round, mirror source, eliminated). A two-sided battle
 * is replayed from the rules' BattleResult; a PvE battle from its start and finished combat and the full ledger.
 */
export function toCombatReplayFor(room: RoomState, seatId: string): SeatReplay | null {
  for (const battle of room.battles) {
    if (battle.kind === 'placeholder') {
      const outcome = battle.outcomes.find(candidate => candidate.seatId === seatId);
      if (!outcome) continue;
      const combat = outcome.combat;
      if (combat === null) return null;
      return { battleId: battle.battleId, replay: cached(replays, outcome, () => toCombatReplay(combat)) };
    }
    if (!battle.participants.includes(seatId)) continue;
    const replay = cached(replays, battle, () => toCombatReplay(battle.battle));
    if (battle.battle.a.seatId === seatId) return { battleId: battle.battleId, replay };
    if (battle.battle.b.seatId === seatId) return { battleId: battle.battleId, replay: cached(mirroredReplays, battle, () => mirrorCombatReplay(replay)) };
    return null;
  }
  return null;
}

/**
 * Side B's view of a replay (§12.6/§14.2): every unit cell/startingCell of the initial, terminal and key
 * frames, movement from/to, cast completionCell and unitUpdated cell/startingCell flip their row; teams,
 * deployment zones and results swap. Ids, sequence numbers and values stay; nothing is re-run.
 */
export function mirrorCombatReplay(replay: CombatReplay): CombatReplay {
  const rows = replay.initial.board.rows;
  return {
    initial: mirrorViewState(replay.initial, rows),
    ticks: replay.ticks.map(frame => ({ tick: frame.tick, events: frame.events.map(event => mirrorViewEvent(event, rows)),
      ...(frame.keyframe ? { keyframe: mirrorViewState(frame.keyframe, rows) } : {}) })),
    terminal: mirrorViewState(replay.terminal, rows),
  };
}
function mirrorViewState(view: CombatViewState, rows: number): CombatViewState {
  const { player, enemy } = view.board.deploymentZones;
  return {
    ...view,
    board: { ...view.board, deploymentZones: { player: enemy, enemy: player } },
    units: view.units.map(unit => ({ ...unit, team: swapTeam(unit.team), cell: flipCell(unit.cell, rows), ...(unit.startingCell ? { startingCell: flipCell(unit.startingCell, rows) } : {}) })),
    result: swapResult(view.result),
  };
}
function mirrorViewEvent(event: CombatViewEvent, rows: number): CombatViewEvent {
  switch (event.type) {
    case 'movement': return { ...event, from: flipCell(event.from, rows), to: flipCell(event.to, rows) };
    case 'cast': return { ...event, completionCell: flipCell(event.completionCell, rows) };
    case 'combatFinished': return { ...event, result: swapResult(event.result) ?? event.result };
    case 'unitUpdated': {
      const { cell, startingCell, team } = event.changes;
      return { ...event, changes: { ...event.changes, ...(cell ? { cell: flipCell(cell, rows) } : {}), ...(startingCell ? { startingCell: flipCell(startingCell, rows) } : {}), ...(team ? { team: swapTeam(team) } : {}) } };
    }
    default: return event;
  }
}
