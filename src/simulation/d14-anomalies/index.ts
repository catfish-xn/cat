/** Independent D14 lifecycle. NOT imported by production Match, catalogs or restoreMatch. */
import { canonicalContent } from '../content';
import { createOwnershipState, transactOwnership, assertOwnershipConservation } from '../owned-resources';
import { UNIT_DEFINITIONS } from '../units';
import { getMultiplayerRoundById } from '../multiplayer-round';
import { sourceKey } from '../shared-pool-ledger';
import { D14_FOURTH_ABILITY } from './fourth-ability';
import type { OwnershipOperation } from '../owned-resources';
import type { D14State, D14Boundary, D14Authority, D14Command, D14Record, D14Event, D14Failure, D14Result } from './types';
export type * from './types';
export { projectD14Unit } from './projection';

export const D14_ACTIVATION = 'unwired-d14' as const;
class D14Error extends RangeError { constructor(readonly reason: D14Failure) { super(reason); } }
function check(value: unknown, reason: D14Failure = 'invalid-state'): asserts value {
  if (!value) throw new D14Error(reason);
}
const same = (a: unknown, b: unknown) => canonicalContent(a) === canonicalContent(b);
const identity = (s: unknown) => typeof s === 'string' && s.length > 0;

export function createD14State(boundary: D14Boundary): D14State {
  return { activation: D14_ACTIVATION, ownership: createOwnershipState(boundary), records: [], commands: [] };
}
function assertState(state: D14State, authority: D14Authority): void {
  canonicalContent(state); canonicalContent(authority);
  check(state.activation === D14_ACTIVATION);
  assertOwnershipConservation(state.ownership);
  check(new Set(state.commands.map(c => c.id)).size === state.commands.length);
  check(new Set(state.records.map(r => r.selection.seatId)).size === state.records.length);
  check(new Set(authority.selections.map(s => s.choiceId)).size === authority.selections.length);
  for (const r of state.records) {
    check(authority.selections.some(s => same(s, r.selection)), 'unauthorized-choice');
    check(r.dueOrdinal === r.selection.atOrdinal + 3 && Number.isSafeInteger(r.dueOrdinal));
    check(identity(r.unitId) && ['waiting', 'promoted', 'absent', 'returned', 'retired'].includes(r.phase));
    check(r.selection.anomalyId === 'ultimate-hero'
      ? ['waiting', 'promoted', 'retired'].includes(r.phase) : ['absent', 'returned', 'retired'].includes(r.phase));
  }
}
function ownership(state: D14State, commandId: string, operations: readonly OwnershipOperation[], authority: D14Authority): D14State {
  const result = transactOwnership(state.ownership, { id: sourceKey('d14', commandId), operations }, authority.ownership);
  if (!result.ok) throw new D14Error(result.reason);
  return { ...state, ownership: result.state };
}
/** Advance certificates from actual resource state. Return buff is granted only on physical return.
 * Q3 fallback: D3 settles every real ordinal (carousel and overtime included), bench first,
 * then legal board within cap. Full seats retain the exact held instance with no bonus yet. */
function reconcile(state: D14State, events: D14Event[]): D14State {
  const records = state.records.map((r): D14Record => {
    if (r.phase === 'retired') return r;
    const seat = state.ownership.seats.find(s => s.seatId === r.selection.seatId)!;
    const binding = seat.anomalyBinding;
    const id = binding?.choiceId === r.selection.choiceId ? binding.unitId : r.unitId;
    const live = seat.preparation.units.find(u => u.id === id && u.team === 'player');
    const held = state.ownership.held.some(h => h.seatId === seat.seatId && h.kind === 'unit' && h.unit.id === id);
    let phase: D14Record['phase'] = r.phase;
    if (!live && !held) phase = 'retired';
    else if (phase === 'waiting' && state.ownership.settledOrdinal >= r.dueOrdinal) phase = 'promoted';
    else if (phase === 'absent' && live) {
      check(state.ownership.settledOrdinal >= r.dueOrdinal);
      phase = 'returned';
    }
    if (phase !== r.phase) events.push({ type: phase === 'promoted' ? 'd14Promoted' : phase === 'returned' ? 'd14Returned' : 'd14Retired',
      receiptId: r.selection.choiceId, unitId: id });
    return { ...r, unitId: id, phase };
  });
  return { ...state, records };
}
/** All failures preserve state identity and emit no events; retries cannot regrant effects. */
export function transactD14(state: D14State, command: D14Command, authority: D14Authority): D14Result {
  try {
    assertState(state, authority); canonicalContent(command);
    check(identity(command.id), 'invalid-transaction');
    const prior = state.commands.find(c => c.id === command.id);
    if (prior) { check(same(prior, command), 'receipt-conflict'); return { ok: true, state, events: [] }; }
    let next = state;
    const events: D14Event[] = [];
    if (command.kind === 'select') {
      const s = command.selection;
      check(authority.selections.some(f => same(f, s)), 'unauthorized-choice');
      check(['ultimate-hero', 'into-the-unknown'].includes(s.anomalyId), 'invalid-target');
      check(identity(s.choiceId) && Number.isSafeInteger(s.atOrdinal) && s.atOrdinal === state.ownership.settledOrdinal, 'invalid-round');
      check(!state.records.some(r => r.selection.seatId === s.seatId), 'already-acquired');
      const seat = state.ownership.seats.find(seat => seat.seatId === s.seatId); check(seat, 'unknown-seat');
      const unit = seat.preparation.units.find(u => u.id === s.unitId && u.team === 'player'); check(unit, 'unknown-unit');
      const definition = UNIT_DEFINITIONS[unit.definitionId];
      check(definition && !definition.summon && definition.unitKind !== 'neutral' && unit.location.kind === 'board', 'invalid-target');
      check(seat.anomalyBinding === null, 'invalid-target');
      if (s.anomalyId === 'ultimate-hero') check(definition.cost === 1 && unit.starLevel === 3
        && Object.hasOwn(D14_FOURTH_ABILITY, unit.definitionId), 'invalid-target');
      const record: D14Record = { selection: structuredClone(s), unitId: unit.id, dueOrdinal: s.atOrdinal + 3,
        phase: s.anomalyId === 'ultimate-hero' ? 'waiting' : 'absent' };
      check(Number.isSafeInteger(record.dueOrdinal), 'invalid-round');
      next = { ...next, ownership: { ...next.ownership, seats: next.ownership.seats.map(x => x !== seat ? x : {
        ...seat, anomalyBinding: { definitionId: s.anomalyId, unitId: unit.id, choiceId: s.choiceId, boundRound: s.atOrdinal } }) },
        records: [...next.records, record] };
      if (s.anomalyId === 'into-the-unknown') next = ownership(next, command.id, [{ kind: 'hold-unit', seatId: s.seatId, unitId: s.unitId, rounds: 3 }], authority);
      events.push({ type: 'd14Selected', receiptId: s.choiceId, unitId: s.unitId });
    } else if (command.kind === 'settle') {
      const ordinal = getMultiplayerRoundById(command.roundId).ordinal;
      check(ordinal === state.ownership.settledOrdinal || ordinal === state.ownership.settledOrdinal + 1, 'invalid-round');
      next = ownership(state, command.id, [{ kind: 'settle', roundId: command.roundId }], authority);
    } else if (command.kind === 'resources') {
      // Prevent a caller from bypassing the anomaly clock using the generic D3 hold/settle seam.
      check(command.operations.every(op => ['acquire', 'claim', 'duplicate', 'deploy', 'sell', 'merge-live', 'equip'].includes(op.kind)), 'unsupported-operation');
      next = ownership(state, command.id, command.operations, authority);
    } else check(false, 'invalid-transaction');
    if (!same({ ...state.ownership, transactions: [] }, { ...next.ownership, transactions: [] })) events.push({ type: 'ownershipCommitted', receiptId: command.id, unitId: null });
    next = reconcile(next, events);
    next = { ...next, commands: [...state.commands, structuredClone(command)] };
    assertState(next, authority);
    return { ok: true, state: next, events };
  } catch (error) {
    return { ok: false, state, reason: error instanceof D14Error ? error.reason : 'invalid-state' };
  }
}
/** INDEPENDENT restore API. Caller must authenticate all three inputs apart from the candidate.
 * Never pass candidate.commands as verifiedCommands. This API does not call production restoreMatch. */
export function restoreD14(input: unknown, boundary: D14Boundary, authority: D14Authority,
  verifiedCommands: readonly D14Command[]): D14State {
  const candidate = (typeof input === 'string' ? JSON.parse(input) : input) as D14State;
  canonicalContent(candidate);
  check(same(candidate.commands, verifiedCommands));
  let state = createD14State(boundary);
  for (const command of verifiedCommands) {
    const result = transactD14(state, command, authority); check(result.ok);
    state = result.state;
  }
  check(same(candidate, state));
  return state;
}
export function serializeD14(state: D14State, boundary: D14Boundary, authority: D14Authority,
  verifiedCommands: readonly D14Command[]): string {
  return canonicalContent(restoreD14(state, boundary, authority, verifiedCommands));
}
