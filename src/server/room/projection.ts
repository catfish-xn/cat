/**
 * Whitelisted client views (V2 §5.3). Built field by field; the room's MatchState, rng
 * states, pairings of other seats and other seats' shops are never serialized. Other seats'
 * deployed units and their items are public (C5, `publicBoard`). A seat's own state leaves only
 * as the rules' `toPrivateSeatView` (B7, contract §14.1), its battle as a compact replay (§14.2).
 */
import type { HexCell } from '../../simulation/board';
import type { CombatResult, CombatUnit } from '../../simulation/combat-types';
import type { MatchEvent, MatchState } from '../../simulation/match-types';
import {
  previewRoundEconomy, startCombatReplay, toCombatReplay, toPrivateSeatView, type CombatReplay, type CombatReplayInput, type CombatReplayTask, type CombatViewEvent, type CombatViewState,
} from '../../server-entry';
import type { CarouselView, ItemSummonView, PublicBoard, PublicBoardUnit, ReplayUnitId, SeatStateView } from '../protocol';
import { carouselPickedSlot, carouselReleased } from './carousel';
import { listCarouselSlots, readItemSummons } from '../../server-entry';
import { findPairing } from './pairing';
import type { BattleResult, PlayerView, PlayerViewFault, PlayerViewPhaseKind, RoomFault, RoomPhase, RoomState, SeatPublic, SeatState } from './types';

const PHASE_VIEW: Readonly<Record<RoomPhase, PlayerViewPhaseKind>> = {
  waiting: 'lobby', carousel: 'carousel', preparation: 'preparation', choice: 'choice', frozen: 'combat', battle: 'combat', 'awaiting-settlement': 'settlement', settlement: 'settlement', ended: 'ended',
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
  // G2-4b (§26): a board position is public, so are the summons standing on it; only what the board shows, nothing of the holder.
  for (const summon of readItemSummons(match)) {
    const { unit } = summon;
    if (unit.team !== 'player' || unit.location.kind !== 'board') continue;
    units.push({ definitionId: unit.definitionId, starLevel: unit.starLevel, cell: { col: unit.location.cell.col, row: unit.location.cell.row }, items: [], summon: true });
  }
  units.sort((a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col);
  return { units };
}

export function toPlayerView(room: RoomState, seatId: string, serverNow: number): PlayerView {
  if (!room.seats.some(seat => seat.seatId === seatId)) throw new RangeError(`unknown seat ${seatId}`);
  const pairing = findPairing(room.pairings, seatId);
  // The mirrored seat is shown its source as the opponent; the view has no separate mirror field yet. Null until the freeze draws the pairings (G1-P6).
  const opponentSeatId = pairing === null ? null : pairing.opponent.kind === 'seat' ? pairing.opponent.seatId : pairing.opponent.sourceSeatId;
  const seats = room.seats.map(toSeatPublic);
  const ranking = room.ranking === null ? null
    : room.ranking.map(entry => seats.find(seat => seat.seatId === entry.seatId)!);
  return {
    mySeatId: seatId,
    seats,
    // P7-1: a carousel runs inside its own x-4 round, so the round's name is also the carousel's.
    phase: { kind: PHASE_VIEW[room.phase], round: room.round, roundName: room.roundName, endsAt: room.deadlineAt, serverNow },
    opponentSeatId,
    opponentCandidates: toOpponentCandidates(room, seatId),
    carousel: toCarouselView(room, seatId),
    ranking,
    fault: room.fault === null ? null : toPlayerFault(room.fault),
  };
}

/**
 * G1-P6: before the freeze of a PvP round (choice or preparation), the seats this seat may fight, in seat order, alive
 * only, never itself; empty once the pairings are drawn, outside PvP rounds and for an eliminated seat.
 */
export function toOpponentCandidates(room: RoomState, seatId: string): string[] {
  if (room.roundKind !== 'pvp' || room.pairings.length > 0 || (room.phase !== 'choice' && room.phase !== 'preparation')) return [];
  const alive = new Set(room.seats.filter(seat => seat.alive).map(seat => seat.seatId));
  if (!alive.has(seatId)) return [];
  const listed = new Set(room.opponentCandidates[seatId] ?? []);
  return room.seats.filter(seat => seat.seatId !== seatId && alive.has(seat.seatId) && listed.has(seat.seatId)).map(seat => seat.seatId);
}

/**
 * G1-P7 (MULTIPLAYER_CONTRACT §21.1): the public part of the rules' carousel, field by field and copied for every view, plus
 * this seat's own `eligible`/`pickedSlot`/`receiptId`. No pool, RNG, full receipts or other seats' assets. Null outside the
 * carousel phase. Reading it never advances the carousel.
 */
export function toCarouselView(room: RoomState, seatId: string): CarouselView | null {
  const carousel = room.carousel;
  if (room.phase !== 'carousel' || carousel === null) return null;
  const { state } = carousel;
  const seat = room.seats.find(candidate => candidate.seatId === seatId);
  const pickedSlot = carouselPickedSlot(state, seatId);
  const receipt = state.receipts.find(candidate => candidate.seatId === seatId && candidate.status !== 'released');
  return {
    id: state.id, roundId: state.roundId, roundName: state.roundId, revision: state.revision, status: state.status,
    slots: listCarouselSlots(state).map(slot => ({ slot: slot.slot, definitionId: slot.definitionId, starLevel: slot.starLevel, items: [...slot.items], pickedBy: slot.pickedBy })),
    releaseOrder: [...state.releaseOrder], releaseAtMs: { ...state.releaseAtMs }, elapsedMs: state.elapsedMs, deadlineMs: state.deadlineMs, startedAt: carousel.startedAt,
    eligible: seat !== undefined && seat.alive && state.status === 'open' && pickedSlot === null && state.elapsedMs < state.deadlineMs && carouselReleased(state, seatId),
    pickedSlot, receiptId: receipt?.id ?? null,
    autoPicked: state.releaseOrder.filter(id => carousel.auto[id] !== undefined),
  };
}

/** Human-readable fault for the client; the structured RoomFault stays on the server. */
export function toPlayerFault(fault: RoomFault): PlayerViewFault {
  switch (fault.kind) {
    case 'resolver-error': return { kind: fault.kind, detail: `战斗 ${fault.battleId} 结算出错：${fault.reason ?? fault.message}` };
    case 'invalid-results': return { kind: fault.kind, detail: `结算结果无效：${fault.detail}` };
    case 'seat-stuck': return { kind: fault.kind, detail: `席位 ${fault.seatId} 无法推进：${fault.reason}` };
    case 'phase-mismatch': return { kind: fault.kind, detail: `阶段不一致：${fault.detail}` };
    case 'stalled': return { kind: fault.kind, detail: `对局卡在 ${fault.phase} 阶段 ${Math.round(fault.idleMs / 1000)} 秒无进展，已关闭` };
    case 'abandoned': return { kind: fault.kind, detail: `所有玩家掉线 ${Math.round(fault.idleMs / 1000)} 秒，对局已关闭` };
    case 'carousel-error': return { kind: fault.kind, detail: `选秀无法进行${fault.seatId ? `（席位 ${fault.seatId}）` : ''}：${fault.reason}` };
  }
}

const flipCell = (cell: HexCell, rows: number): HexCell => ({ col: cell.col, row: rows - 1 - cell.row });
const swapTeam = (team: CombatUnit['team']): CombatUnit['team'] => team === 'player' ? 'enemy' : 'player';
const swapResult = (result: CombatResult | null): CombatResult | null => result === 'playerWin' ? 'enemyWin' : result === 'enemyWin' ? 'playerWin' : result;

/* ---------------- B7: private seat state and compact replay (contract §14) ---------------- */

/**
 * The only shape in which a seat's own MatchState leaves the room (initial, increment, resume, fault, refusal): the rules'
 * `toPrivateSeatView` plus `economyPreview` (SR-G5-02, contract §14.4), the rules' `previewRoundEconomy` of the same state
 * as it returns it. It is set in preparation and while my battle runs (a PvP seat stays in preparation under the roster
 * lock, a PvE seat is in combat) and null in choice, settlement, supply rounds, game over and for an eliminated seat.
 */
export function toSeatPrivateView(match: MatchState): SeatStateView {
  return { ...toPrivateSeatView(match), economyPreview: previewRoundEconomy(match), itemSummons: toItemSummonViews(match) };
}
/**
 * G2-4b (§26): my movable preparation summons as the rules' `readItemSummons` places them, copied field by field; empty
 * outside preparation (they exist in a battle only as its own units). Never minted, moved or scaled here.
 */
export function toItemSummonViews(match: MatchState): readonly ItemSummonView[] {
  if (match.phase !== 'preparation') return [];
  return readItemSummons(match).filter(origin => origin.unit.team === 'player').map(origin => ({
    kind: origin.kind, ownerId: origin.ownerId, itemInstanceId: origin.itemInstanceId,
    unit: { id: origin.unit.id, definitionId: origin.unit.definitionId, team: origin.unit.team, starLevel: origin.unit.starLevel,
      location: origin.unit.location.kind === 'board' ? { kind: 'board', cell: { col: origin.unit.location.cell.col, row: origin.unit.location.cell.row } } : { ...origin.unit.location } },
  }));
}

/**
 * Server-originated events a seat's client may see with its state push: own-unit moves and merges (T10), the own seat's
 * G2-3 mechanic grants, key changes and hook failures (§25), nothing else of the ledger.
 */
const PUSHED_EVENT_TYPES: ReadonlySet<string> = new Set(['unitDeployed', 'unitUpgraded', 'mechanicGranted', 'seatMechanicChanged', 'mechanicFailed']);
export function seatPushEvents(seat: SeatState): readonly MatchEvent[] {
  const pushed = seat.serverEvents;
  if (!pushed || pushed.seatRevision !== seat.seatRevision) return [];
  return pushed.events.filter(event => PUSHED_EVENT_TYPES.has(event.type) && !('tick' in event));
}

/** Contract §18.8 03: the three seat operation events a `consumable-used` receipt may carry. */
export type ConsumableDisplayEvent = Extract<MatchEvent, { readonly type: 'consumableUsed' | 'itemReforged' | 'itemsRemoved' }>;
/**
 * The receipt copy of a successful useConsumable (§18.8 03): only those three events, field by field (domain, eventSeq and
 * the listed fields; a target keeps only its kind and id), in the rules' order. No provenance or RNG, nothing recomputed.
 */
export function consumableReceiptEvents(events: readonly MatchEvent[]): ConsumableDisplayEvent[] {
  const meta = (event: ConsumableDisplayEvent) => ({ ...(event.domain ? { domain: event.domain } : {}), ...(event.eventSeq !== undefined ? { eventSeq: event.eventSeq } : {}) });
  return events.flatMap((event): ConsumableDisplayEvent[] => {
    switch (event.type) {
      case 'itemsRemoved': return [{ type: event.type, unitId: event.unitId, itemIds: [...event.itemIds], ...meta(event) }];
      case 'itemReforged': return [{ type: event.type, itemId: event.itemId, definitionId: event.definitionId, outputItemId: event.outputItemId,
        outputDefinitionId: event.outputDefinitionId, consumableId: event.consumableId, ...meta(event) }];
      case 'consumableUsed': return [{ type: event.type, consumableId: event.consumableId, definitionId: event.definitionId,
        target: event.target.kind === 'unit' ? { kind: 'unit', unitId: event.target.unitId } : { kind: 'item', itemId: event.target.itemId },
        effect: event.effect, affectedItemIds: [...event.affectedItemIds], outputItemId: event.outputItemId, ...meta(event) }];
      default: return [];
    }
  });
}

/**
 * `unitIds` (C15): my own units of this battle, battle id → original id, from the rules' BattleIdMapping (`kind: 'unit'`,
 * my seatId only). Empty for a PvE battle, whose replay already names my units by their original ids.
 */
export interface SeatReplay { readonly battleId: string; readonly replay: CombatReplay; readonly unitIds: readonly ReplayUnitId[] }

/**
 * One replay per battle, built on first request and kept with the (immutable) battle result it came from:
 * every later push, resume or second participant reuses it, so the pure re-execution runs once per battle
 * (§14.3). Keys are the room's own result objects, so a finished room's replays go with it.
 */
const replays = new WeakMap<object, CombatReplay>();
const mirroredReplays = new WeakMap<object, CombatReplay>();
/**
 * A replay the rules refused, kept with the same key: the refusal is a pure function of the immutable battle, so it is
 * rethrown as is instead of re-running the whole battle inside every later push, resume or second participant.
 */
const failedReplays = new WeakMap<object, unknown>();
function cached(cache: WeakMap<object, CombatReplay>, key: object, build: () => CombatReplay): CombatReplay {
  const hit = cache.get(key);
  if (hit) return hit;
  if (failedReplays.has(key)) throw failedReplays.get(key);
  let replay: CombatReplay;
  try { replay = build(); }
  catch (error) { failedReplays.set(key, error); throw error; }
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
    const replay = replayOf(battle, seatId);
    if (replay !== undefined) return replay;
  }
  return null;
}
/** This seat's replay of one battle; undefined when the seat is not in it, null when it is but has nothing to replay. */
function replayOf(battle: BattleResult, seatId: string): SeatReplay | null | undefined {
  if (battle.kind === 'placeholder') {
    const outcome = battle.outcomes.find(candidate => candidate.seatId === seatId);
    if (!outcome) return undefined;
    const combat = outcome.combat;
    if (combat === null) return null;
    return { battleId: battle.battleId, replay: cached(replays, outcome, () => toCombatReplay(combat)), unitIds: [] };
  }
  if (!battle.participants.includes(seatId)) return undefined;
  const replay = cached(replays, battle, () => toCombatReplay(battle.battle));
  if (battle.battle.a.seatId === seatId) return { battleId: battle.battleId, replay, unitIds: ownUnitIds(battle, seatId) };
  if (battle.battle.b.seatId === seatId) return { battleId: battle.battleId, replay: cached(mirroredReplays, battle, () => mirrorCombatReplay(replay)), unitIds: ownUnitIds(battle, seatId) };
  return null;
}
/** C15: the rules' own mapping, filtered to this seat's units; read as given, never derived from the battle id string. */
function ownUnitIds(battle: Extract<BattleResult, { kind: 'two-sided' }>, seatId: string): readonly ReplayUnitId[] {
  return battle.battle.mapping.filter(entry => entry.kind === 'unit' && entry.seatId === seatId)
    .map(entry => ({ combatId: entry.combatId, originalId: entry.originalId }));
}
/**
 * Builds and caches the replays of one freshly resolved battle for the given seats ahead of the push (B8), so the
 * re-execution runs in its own slice instead of inside the push of the whole round. A failure is not reported here:
 * its refusal is kept and the push reports it as before.
 */
export function warmCombatReplays(battle: BattleResult, seatIds: Iterable<string>): void {
  for (const seatId of seatIds) {
    try { replayOf(battle, seatId); } catch { /* reported by the push */ }
  }
}

/** Sliced warm-up of one resolved battle's replays; `advance` is true once every wanted replay is cached (or failed). */
export interface ReplayWarmup { advance(maxTicks: number): boolean }
/**
 * warmCombatReplays cut into slices (§19): one `startCombatReplay` task per replay the given seats will be pushed and
 * the cache does not hold yet, advanced by at most `maxTicks` per call and never recreated; a finished replay goes into
 * the same cache toCombatReplayFor reads. Side B's mirror is still derived from that replay, never re-run. A task that
 * throws is dropped and its refusal kept: the push reports it as before, without re-running the battle.
 */
export function startReplayWarmup(battle: BattleResult, seatIds: Iterable<string>): ReplayWarmup {
  const wanted = [...seatIds];
  const pending: { readonly key: object; readonly input: CombatReplayInput; task: CombatReplayTask | null }[] = [];
  if (battle.kind === 'placeholder') {
    for (const outcome of battle.outcomes) if (wanted.includes(outcome.seatId) && outcome.combat && !replays.has(outcome) && !failedReplays.has(outcome)) pending.push({ key: outcome, input: outcome.combat, task: null });
  } else if (battle.participants.some(seatId => wanted.includes(seatId)) && !replays.has(battle) && !failedReplays.has(battle)) pending.push({ key: battle, input: battle.battle, task: null });
  return {
    advance(maxTicks: number): boolean {
      const head = pending[0];
      if (head) {
        try {
          head.task ??= startCombatReplay(head.input);
          // The room passes Infinity when it does not slice; the rules take a positive safe integer.
          const replay = head.task.advance(Number.isSafeInteger(maxTicks) ? maxTicks : Number.MAX_SAFE_INTEGER);
          if (!replay) return false;
          replays.set(head.key, replay);
        } catch (error) { failedReplays.set(head.key, error); /* reported by the push, which rethrows it without re-running */ }
        pending.shift();
        if (pending.length) return false;
      }
      warmCombatReplays(battle, wanted);
      return true;
    },
  };
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
    units: view.units.map(unit => mirrorViewUnit(unit, rows)),
    result: swapResult(view.result),
  };
}
function mirrorViewUnit(unit: CombatViewState['units'][number], rows: number): CombatViewState['units'][number] {
  return { ...unit, team: swapTeam(unit.team), cell: flipCell(unit.cell, rows), ...(unit.startingCell ? { startingCell: flipCell(unit.startingCell, rows) } : {}) };
}
function mirrorViewEvent(event: CombatViewEvent, rows: number): CombatViewEvent {
  switch (event.type) {
    case 'movement': return { ...event, from: flipCell(event.from, rows), to: flipCell(event.to, rows) };
    case 'cast': return { ...event, completionCell: flipCell(event.completionCell, rows) };
    case 'combatFinished': return { ...event, result: swapResult(event.result) ?? event.result };
    // G2-3 mid-combat units: the entered view and the spawn fact carry a cell and a team.
    case 'unitEntered': return { ...event, unit: mirrorViewUnit(event.unit, rows) };
    case 'unitSpawned': return { ...event, team: swapTeam(event.team), cell: flipCell(event.cell, rows) };
    case 'unitUpdated': {
      const { cell, startingCell, team } = event.changes;
      return { ...event, changes: { ...event.changes, ...(cell ? { cell: flipCell(cell, rows) } : {}), ...(startingCell ? { startingCell: flipCell(startingCell, rows) } : {}), ...(team ? { team: swapTeam(team) } : {}) } };
    }
    default: return event;
  }
}
