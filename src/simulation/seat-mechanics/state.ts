import type { MatchState } from '../match-types';
import { SEAT_MECHANICS_VERSION, type MechanicJson, type MechanicReceipt, type SeatMechanicsState } from './types';

/** Throws RangeError unless value is plain JSON with safe-integer numbers. */
export function assertMechanicJson(value: unknown, path = 'value', depth = 0): asserts value is MechanicJson {
  if (depth > 16) throw new RangeError(`Invalid mechanic state: ${path} too deep`);
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number') { if (!Number.isSafeInteger(value)) throw new RangeError(`Invalid mechanic state: ${path} not an integer`); return; }
  if (Array.isArray(value)) { value.forEach((child, i) => assertMechanicJson(child, `${path}[${i}]`, depth + 1)); return; }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, child] of Object.entries(value)) assertMechanicJson(child, `${path}.${key}`, depth + 1);
    return;
  }
  throw new RangeError(`Invalid mechanic state: ${path} not plain JSON`);
}

export function emptySeatMechanics(): SeatMechanicsState {
  return { version: SEAT_MECHANICS_VERSION, seat: {}, hidden: {}, receipts: [] };
}
const current = (state: MatchState): SeatMechanicsState => state.seatMechanics ?? emptySeatMechanics();

/** Owner-visible value of one mechanic, or undefined. Safe on display states built from the private view. */
export function readSeatMechanic<T extends MechanicJson = MechanicJson>(state: Pick<MatchState, 'seatMechanics'>, key: string): T | undefined {
  return state.seatMechanics?.seat[key] as T | undefined;
}
/** Authority-only value; always undefined on a client display state. */
export function readHiddenMechanic<T extends MechanicJson = MechanicJson>(state: Pick<MatchState, 'seatMechanics'>, key: string): T | undefined {
  return state.seatMechanics?.hidden[key] as T | undefined;
}
/** New state with `seat[key] = value` (undefined deletes). Pure; the caller commits it inside its own command. */
export function writeSeatMechanic(state: MatchState, key: string, value: MechanicJson | undefined): MatchState {
  return writeBucket(state, 'seat', key, value);
}
export function writeHiddenMechanic(state: MatchState, key: string, value: MechanicJson | undefined): MatchState {
  return writeBucket(state, 'hidden', key, value);
}
function writeBucket(state: MatchState, bucket: 'seat' | 'hidden', key: string, value: MechanicJson | undefined): MatchState {
  if (typeof key !== 'string' || !key) throw new RangeError('Invalid mechanic key');
  if (value !== undefined) assertMechanicJson(value, key);
  const mechanics = current(state);
  const next = { ...mechanics[bucket] };
  if (value === undefined) delete next[key]; else next[key] = structuredClone(value);
  return { ...state, seatMechanics: { ...mechanics, [bucket]: next } };
}

export function findMechanicReceipt(state: Pick<MatchState, 'seatMechanics'>, receiptId: string): MechanicReceipt | undefined {
  return state.seatMechanics?.receipts.find(receipt => receipt.receiptId === receiptId);
}
/** Appends one receipt; a duplicate id throws, so a retried step can never pay twice. */
export function appendMechanicReceipt(state: MatchState, receipt: MechanicReceipt): MatchState {
  if (findMechanicReceipt(state, receipt.receiptId)) throw new RangeError('duplicate-mechanic-receipt');
  validateMechanicReceipt(receipt);
  const mechanics = current(state);
  return { ...state, seatMechanics: { ...mechanics, receipts: [...mechanics.receipts, receipt] } };
}

/** Owner-visible projection for toPrivateSeatView: seat + receipts; `hidden` is always sent empty. Undefined when absent. */
export function seatMechanicsView(state: MatchState): SeatMechanicsState | undefined {
  const mechanics = state.seatMechanics;
  if (!mechanics) return undefined;
  return { version: mechanics.version, seat: structuredClone(mechanics.seat), hidden: {}, receipts: structuredClone(mechanics.receipts) };
}

const nonempty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const count = (value: unknown, min = 0): value is number => Number.isSafeInteger(value) && (value as number) >= min;
export function validateMechanicReceipt(receipt: MechanicReceipt): void {
  const ok = nonempty(receipt.receiptId) && count(receipt.round, 1) && nonempty(receipt.roundId) && nonempty(receipt.source) && (() => {
    switch (receipt.kind) {
      case 'gold': return count(receipt.amount, 1);
      case 'unit': return nonempty(receipt.definitionId) && count(receipt.gold)
        && (receipt.resolution === 'held' ? nonempty(receipt.unitId) && receipt.gold === 0 : receipt.resolution === 'gold' && receipt.unitId === null);
      case 'item': return nonempty(receipt.definitionId) && nonempty(receipt.itemId);
      case 'choice': return ['forge', 'blackMarket', 'armory'].includes(receipt.choiceKind) && nonempty(receipt.optionId)
        && typeof receipt.skipped === 'boolean' && count(receipt.price) && typeof receipt.timedOut === 'boolean'
        && (receipt.itemId === null || nonempty(receipt.itemId));
      default: return false;
    }
  })();
  if (!ok) throw new RangeError('Invalid mechanic receipt');
}
/** Structural restore check for saves. Mechanic-specific invariants belong to each mechanic's own validator. */
export function validateSeatMechanicsState(value: unknown): asserts value is SeatMechanicsState {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new RangeError('Invalid mechanic state');
  const mechanics = value as SeatMechanicsState;
  if (mechanics.version !== SEAT_MECHANICS_VERSION || Object.keys(mechanics).sort().join() !== 'hidden,receipts,seat,version')
    throw new RangeError('Invalid mechanic state version');
  for (const bucket of ['seat', 'hidden'] as const) {
    const values = mechanics[bucket];
    if (values === null || typeof values !== 'object' || Array.isArray(values)) throw new RangeError('Invalid mechanic state');
    assertMechanicJson(values, bucket);
  }
  if (!Array.isArray(mechanics.receipts)) throw new RangeError('Invalid mechanic receipts');
  const ids = new Set<string>();
  for (const receipt of mechanics.receipts) {
    validateMechanicReceipt(receipt);
    if (ids.has(receipt.receiptId)) throw new RangeError('duplicate-mechanic-receipt');
    ids.add(receipt.receiptId);
  }
}
