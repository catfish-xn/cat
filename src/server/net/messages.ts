/**
 * Wire messages between a client and the game server (work order B2, V2 §5.1–5.4), with
 * hand-written runtime validation. This file has no dependency on ws, node:crypto or the room,
 * so the browser client (C4) can import the same types and validators.
 *
 * Every client message carries `protocolVersion` and `commandId`. A `command` also names the
 * room, the round and the seatRevision it was decided against; buy/shopLock keep the shop
 * generation and choice commands keep choiceId + generation inside the command itself, exactly
 * as the rules expect. Unknown fields are refused: nothing a client adds (gold, seatId, hp)
 * can reach the room.
 */
import type { MatchEvent, MatchFailure } from '../../simulation/match-types';
import type { CombatReplay } from '../../server-entry';
import type { UnitLocation } from '../../simulation/units';
import type { ConsumableTarget, LobbyView, PlayerView, ReplayUnitId, SeatStateView, WireCommand } from '../protocol';
import type { RoomFailure, SharedPoolFailure } from '../room/types';
import type { CarouselFailure } from '../room/carousel';
import type { ConsumableDisplayEvent } from '../room/projection';

/**
 * 2 since T13-B (contract §18.7): R3/R4 projection and the useConsumable receipt; protocol 1 clients are refused.
 * Bumped only when a client message or receipt changes shape or meaning (the server validates client messages strictly).
 * A field added to a server view is not a bump: the client reads views without key validation and ignores what it does
 * not know. G1-P6 stays at 2 on that rule: `PlayerView.opponentCandidates` is additive, and `opponentSeatId` being null
 * until the freeze only means an older client highlights the opponent from the battle on.
 * 3 since G1-P7: the client may send `carousel-pick` (MULTIPLAYER_CONTRACT §21.1), a new command a protocol 2 server would refuse;
 * its receipts carry the rules' CarouselFailure reasons plus `stale-carousel`. A protocol 2 client could not take part either:
 * the match now opens on the `carousel` phase with no unit (it could not pick and would sit through 1-1 not knowing why).
 * `PlayerView.carousel` and the `carousel` phase kind alone would have been additive. A protocol 2 client is refused at its
 * first message with `unsupported-protocol` ("protocolVersion must be 3").
 */
export const NET_PROTOCOL_VERSION = 3;
/** Hard caps on free-text fields; longer input is a validation failure, not a truncation. */
/** Rule ids (choiceId is a nested JSON key of ~110 characters) stay well under idChars. */
export const LIMITS = { nameChars: 24, idChars: 256, tokenChars: 128 } as const;

/* ---------------- client → server ---------------- */

interface ClientEnvelope {
  readonly protocolVersion: number;
  /**
   * Positive safe integer chosen by the client, unique per seat for the whole match; a monotonic
   * counter is expected so the dedupe retention span (see dedupe.ts) can tell a stale id from a new one.
   */
  readonly commandId: number;
}
export interface JoinMessage extends ClientEnvelope { readonly type: 'join'; readonly name: string }
export interface LeaveQueueMessage extends ClientEnvelope { readonly type: 'leaveQueue' }
export interface StartMessage extends ClientEnvelope { readonly type: 'start' }
export interface ResumeMessage extends ClientEnvelope { readonly type: 'resume'; readonly token: string }
export interface CommandMessage extends ClientEnvelope {
  readonly type: 'command';
  readonly roomId: string;
  /** Round the client was looking at; a command for another round is `stale-round`. */
  readonly round: number;
  /** seatRevision the client last received; must equal the seat's current revision. */
  readonly seatRevision: number;
  readonly command: WireCommand;
}
export type ClientMessage = JoinMessage | LeaveQueueMessage | StartMessage | ResumeMessage | CommandMessage;
export type ClientMessageType = ClientMessage['type'];

/* ---------------- server → client ---------------- */

export type ReceiptResult =
  | { readonly kind: 'joined'; readonly seatId: string; readonly token: string; readonly connectionEpoch: number }
  | { readonly kind: 'left' }
  | { readonly kind: 'started'; readonly roomId: string }
  /** `lastCommandId` is the highest id this seat has used; a client that lost its counter continues above it. */
  /**
   * `reclaimed` (B6): a bot had taken this seat over while the player was away and this resume handed it back; absent
   * otherwise. The client shows "已接回席位" from it.
   */
  | { readonly kind: 'resumed'; readonly seatId: string; readonly roomId: string | null; readonly connectionEpoch: number; readonly lastCommandId: number; readonly reclaimed?: true }
  | { readonly kind: 'applied'; readonly seatRevision: number; readonly roomRevision: number; readonly events: readonly MatchEvent[] }
  /** Contract §18.8 03: a successful useConsumable; `events` are the whitelisted seat operation events only. */
  | { readonly kind: 'consumable-used'; readonly seatRevision: number; readonly roomRevision: number; readonly events: readonly ConsumableDisplayEvent[] };

/** Failures decided by the network layer before the room or the rules see the message. */
export type NetFailure =
  | 'invalid-message' | 'unsupported-protocol'
  | 'not-authenticated' | 'already-joined' | 'invalid-token'
  | 'commandId-conflict' | 'resync-required'
  | 'no-room' | 'wrong-room' | 'stale-round' | 'seat-revision-mismatch'
  | 'rate-limited';
export type LobbyFailure = 'full' | 'in-progress' | 'empty' | 'not-queued';
/** SharedPoolFailure (B5) already contains every MatchFailure; MatchFailure stays listed for readers. */
export type ReceiptFailure = NetFailure | LobbyFailure | RoomFailure | MatchFailure | SharedPoolFailure | CarouselFailure;

export type ReceiptMessage =
  | { readonly type: 'receipt'; readonly commandId: number; readonly ok: true; readonly result: ReceiptResult }
  | { readonly type: 'receipt'; readonly commandId: number; readonly ok: false; readonly reason: ReceiptFailure; readonly detail: string | null };

/** Connection-level errors; `commandId` is set when the offending message had a usable one. */
export type ErrorCode = 'invalid-json' | 'invalid-message' | 'unsupported-protocol' | 'message-too-large' | 'rate-limited' | 'session-superseded' | 'server-closing';

export type ServerMessage =
  | { readonly type: 'lobby'; readonly view: LobbyView }
  | { readonly type: 'view'; readonly roomId: string; readonly roomRevision: number; readonly view: PlayerView }
  /**
   * My seat's private state as the rules' whitelist projection (contract §14.1) plus the rules' round economy preview
   * (`economyPreview`, SR-G5-02 §14.4; see SeatStateView): not a MatchState, never restorable, no RNG, plans or ledgers.
   * Not sent any more once my seat is eliminated (then only view/replay).
   */
  | { readonly type: 'state'; readonly roomId: string; readonly round: number; readonly seatRevision: number; readonly state: SeatStateView;
    /**
     * Events of the server's own transaction that produced this revision (T10): the deadline's automatic deployment
     * (`unitDeployed`) and the post-battle merges of the settlement (`unitUpgraded`). Absent when there were none.
     */
    readonly events?: readonly MatchEvent[] }
  /**
   * My battle of this round as a compact replay from my point of view (contract §14.2): initial view, one record
   * per tick with keyframes, terminal view. The only battle message (C6); a whole match stays far below the frame cap.
   * `unitIds` (C15): which battle id is which of MY units, from the rules' mapping; empty for PvE. The client reads it
   * through `readReplayUnitIds` and never parses a battle id.
   */
  | { readonly type: 'replay'; readonly roomId: string; readonly round: number; readonly battleId: string; readonly replay: CombatReplay; readonly unitIds: readonly ReplayUnitId[] }
  | ReceiptMessage
  | { readonly type: 'error'; readonly code: ErrorCode; readonly message: string; readonly commandId: number | null };

/* ---------------- validation ---------------- */

export type ParseFailureCode = 'invalid-json' | 'invalid-message' | 'unsupported-protocol';
export type ParseResult =
  | { readonly ok: true; readonly message: ClientMessage }
  | { readonly ok: false; readonly code: ParseFailureCode; readonly detail: string; readonly commandId: number | null };

type Shape = Readonly<Record<string, unknown>>;
class Invalid extends Error {}
const bad = (detail: string): never => { throw new Invalid(detail); };

function isRecord(value: unknown): value is Shape { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function onlyKeys(value: Shape, allowed: readonly string[], where: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) bad(`${where}: unexpected field "${key}"`);
}
function str(value: unknown, where: string, max: number = LIMITS.idChars, allowEmpty = false): string {
  if (typeof value !== 'string') return bad(`${where} must be a string`);
  if (!allowEmpty && value.length === 0) return bad(`${where} must not be empty`);
  if (value.length > max) return bad(`${where} longer than ${max} characters`);
  return value;
}
function int(value: unknown, where: string, min = Number.MIN_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return bad(`${where} must be an integer`);
  if (value < min) return bad(`${where} must be >= ${min}`);
  return value;
}
function bool(value: unknown, where: string): boolean { return typeof value === 'boolean' ? value : bad(`${where} must be a boolean`); }

export function isValidCommandId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function location(value: unknown, where: string): UnitLocation {
  if (!isRecord(value)) return bad(`${where} must be an object`);
  switch (value.kind) {
    case 'bench': onlyKeys(value, ['kind', 'slot'], where); return { kind: 'bench', slot: int(value.slot, `${where}.slot`, 0) };
    case 'board': {
      onlyKeys(value, ['kind', 'cell'], where);
      if (!isRecord(value.cell)) return bad(`${where}.cell must be an object`);
      onlyKeys(value.cell, ['col', 'row'], `${where}.cell`);
      return { kind: 'board', cell: { col: int(value.cell.col, `${where}.cell.col`), row: int(value.cell.row, `${where}.cell.row`) } };
    }
    default: return bad(`${where}.kind must be "bench" or "board"`);
  }
}

/** §18.3: each target kind carries exactly its own id (onlyKeys per layer); anything else is invalid-message. */
function consumableTarget(value: unknown, where: string): ConsumableTarget {
  if (!isRecord(value)) return bad(`${where} must be an object`);
  switch (value.kind) {
    case 'item': onlyKeys(value, ['kind', 'itemId'], where); return { kind: 'item', itemId: str(value.itemId, `${where}.itemId`) };
    case 'unit': onlyKeys(value, ['kind', 'unitId'], where); return { kind: 'unit', unitId: str(value.unitId, `${where}.unitId`) };
    default: return bad(`${where}.kind must be "item" or "unit"`);
  }
}
/** Rebuilds the command field by field: anything not in the union is refused. */
export function validateClientCommand(value: unknown): WireCommand {
  if (!isRecord(value)) return bad('command must be an object');
  const w = 'command';
  switch (value.type) {
    case 'deploy': onlyKeys(value, ['type', 'unitId', 'target'], w); return { type: 'deploy', unitId: str(value.unitId, `${w}.unitId`), target: location(value.target, `${w}.target`) };
    case 'buy': onlyKeys(value, ['type', 'slot', 'generation'], w); return { type: 'buy', slot: int(value.slot, `${w}.slot`, 0), generation: int(value.generation, `${w}.generation`, 0) };
    case 'sell': onlyKeys(value, ['type', 'unitId'], w); return { type: 'sell', unitId: str(value.unitId, `${w}.unitId`) };
    case 'shopLock': onlyKeys(value, ['type', 'locked', 'generation'], w); return { type: 'shopLock', locked: bool(value.locked, `${w}.locked`), generation: int(value.generation, `${w}.generation`, 0) };
    case 'reroll': onlyKeys(value, ['type'], w); return { type: 'reroll' };
    case 'buyXp': onlyKeys(value, ['type'], w); return { type: 'buyXp' };
    case 'combine': onlyKeys(value, ['type', 'a', 'b'], w); return { type: 'combine', a: str(value.a, `${w}.a`), b: str(value.b, `${w}.b`) };
    case 'useConsumable': onlyKeys(value, ['type', 'consumableId', 'target'], w);
      return { type: 'useConsumable', consumableId: str(value.consumableId, `${w}.consumableId`), target: consumableTarget(value.target, `${w}.target`) };
    case 'equip': onlyKeys(value, ['type', 'itemId', 'unitId', 'slot'], w); return { type: 'equip', itemId: str(value.itemId, `${w}.itemId`), unitId: str(value.unitId, `${w}.unitId`), slot: int(value.slot, `${w}.slot`, 0) };
    case 'choose': onlyKeys(value, ['type', 'choiceId', 'generation', 'definitionId'], w);
      return { type: 'choose', choiceId: str(value.choiceId, `${w}.choiceId`), generation: int(value.generation, `${w}.generation`, 0), definitionId: str(value.definitionId, `${w}.definitionId`) };
    case 'anomalyTarget': onlyKeys(value, ['type', 'choiceId', 'generation', 'unitId'], w);
      return { type: 'anomalyTarget', choiceId: str(value.choiceId, `${w}.choiceId`), generation: int(value.generation, `${w}.generation`, 0), unitId: str(value.unitId, `${w}.unitId`, LIMITS.idChars, true) };
    case 'anomalyReroll': onlyKeys(value, ['type', 'choiceId', 'generation'], w);
      return { type: 'anomalyReroll', choiceId: str(value.choiceId, `${w}.choiceId`), generation: int(value.generation, `${w}.generation`, 0) };
    case 'carousel-pick': onlyKeys(value, ['type', 'carouselId', 'revision', 'slot'], w);
      return { type: 'carousel-pick', carouselId: str(value.carouselId, `${w}.carouselId`), revision: int(value.revision, `${w}.revision`, 0), slot: int(value.slot, `${w}.slot`, 0) };
    default: return bad(`command.type ${JSON.stringify(value.type)} is not a client command`);
  }
}

const ENVELOPE = ['type', 'protocolVersion', 'commandId'] as const;

function validateEnvelopeBody(value: Shape, commandId: number): ClientMessage {
  const protocolVersion = NET_PROTOCOL_VERSION;
  switch (value.type) {
    case 'join': onlyKeys(value, [...ENVELOPE, 'name'], 'join'); return { type: 'join', protocolVersion, commandId, name: str(value.name, 'join.name', LIMITS.nameChars, true) };
    case 'leaveQueue': onlyKeys(value, ENVELOPE, 'leaveQueue'); return { type: 'leaveQueue', protocolVersion, commandId };
    case 'start': onlyKeys(value, ENVELOPE, 'start'); return { type: 'start', protocolVersion, commandId };
    case 'resume': onlyKeys(value, [...ENVELOPE, 'token'], 'resume'); return { type: 'resume', protocolVersion, commandId, token: str(value.token, 'resume.token', LIMITS.tokenChars) };
    case 'command': onlyKeys(value, [...ENVELOPE, 'roomId', 'round', 'seatRevision', 'command'], 'command');
      return { type: 'command', protocolVersion, commandId, roomId: str(value.roomId, 'command.roomId'), round: int(value.round, 'command.round', 0),
        seatRevision: int(value.seatRevision, 'command.seatRevision', 0), command: validateClientCommand(value.command) };
    default: return bad(`type ${JSON.stringify(value.type)} is not a client message`);
  }
}

/** Parses one text frame. The failure keeps the commandId when it was usable so the server can answer with a receipt. */
export function parseClientMessage(raw: string): ParseResult {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { return { ok: false, code: 'invalid-json', detail: 'message is not valid JSON', commandId: null }; }
  if (!isRecord(value)) return { ok: false, code: 'invalid-message', detail: 'message must be a JSON object', commandId: null };
  const commandId = isValidCommandId(value.commandId) ? value.commandId : null;
  if (commandId === null) return { ok: false, code: 'invalid-message', detail: 'commandId must be a positive integer', commandId: null };
  if (value.protocolVersion !== NET_PROTOCOL_VERSION) {
    return { ok: false, code: 'unsupported-protocol', detail: `protocolVersion must be ${NET_PROTOCOL_VERSION}`, commandId };
  }
  try { return { ok: true, message: validateEnvelopeBody(value, commandId) }; }
  catch (error) {
    if (error instanceof Invalid) return { ok: false, code: 'invalid-message', detail: error.message, commandId };
    throw error;
  }
}

/**
 * Structure check of the replay push's `unitIds` (C15), for the client: an array of `{combatId, originalId}` non-empty
 * strings and nothing else. Null when the field is missing or malformed; the client then shows no equipment in the replay.
 */
export function readReplayUnitIds(value: unknown): readonly ReplayUnitId[] | null {
  if (!Array.isArray(value)) return null;
  const ids: ReplayUnitId[] = [];
  try {
    value.forEach((entry: unknown, index) => {
      const where = `unitIds[${index}]`;
      if (!isRecord(entry)) bad(`${where} must be an object`);
      const record = entry as Shape;
      onlyKeys(record, ['combatId', 'originalId'], where);
      ids.push({ combatId: str(record.combatId, `${where}.combatId`, 4 * LIMITS.idChars), originalId: str(record.originalId, `${where}.originalId`) });
    });
  } catch (error) {
    if (error instanceof Invalid) return null;
    throw error;
  }
  return ids;
}

/** Deterministic JSON with sorted keys: the content identity a commandId is compared against. */

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

/** Content of a client message without its envelope ids; equal contents may share a commandId. */
export function commandContent(message: ClientMessage): string {
  const { commandId: _id, protocolVersion: _version, ...content } = message;
  return canonicalJson(content);
}
