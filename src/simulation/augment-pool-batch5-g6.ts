import { CARRY_GOLEM, CARRY_GOLEM_ID } from './content/augment-pool-batch5-g6';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { appendResourceProvenance } from './resource-provenance';
import { appendMechanicReceipt, grantMechanicItem } from './seat-mechanics';
import type { MatchEvent, MatchState } from './match-types';
import { carryGolemStar } from './augment-pool-batch5-g6-stats';
import type { OwnedAugment } from './strategy-types';
import { canonicalContent } from './content';

export const CARRY_GOLEM_SOURCE = 'augment-pool-batch5-g6';
const receiptId = (owner: OwnedAugment, part: string) => JSON.stringify([CARRY_GOLEM_SOURCE, owner.choiceId, part]);
export { carryGolemGrowth, carryGolemStar, carryGolemEffects } from './augment-pool-batch5-g6-stats';
export function growCarryGolem(state: MatchState): MatchState {
  const owner = state.augments.find(a => a.definitionId === 'im-the-carry-now');
  if (!owner) return state;
  const starLevel = carryGolemStar(state.round, owner.acquiredRound);
  if (!state.preparation.units.some(u => u.definitionId === CARRY_GOLEM_ID && u.starLevel !== starLevel)) return state;
  return { ...state, preparation: { ...state.preparation,
    units: state.preparation.units.map(u => u.definitionId === CARRY_GOLEM_ID ? { ...u, starLevel } : u) } };
}
/** A free board structure, following the trainer golem's placement policy. Fixed offensive equipment is permanent. */
export function grantCarryGolem(state: MatchState): { state: MatchState; events: readonly MatchEvent[] } {
  const owner = state.augments.find(a => a.definitionId === 'im-the-carry-now');
  if (!owner || state.seatMechanics?.receipts.some(r => r.receiptId === receiptId(owner, 'unit'))) return { state, events: [] };
  const cell = [4, 5, 6, 7].flatMap(row => [3, 2, 4, 1, 5, 0, 6].map(col => ({ col, row })))
    .find(c => !state.preparation.units.some(u => u.location.kind === 'board' && u.location.cell.col === c.col && u.location.cell.row === c.row));
  if (!cell) throw new RangeError('Invalid carry golem placement');
  const unitId = `unit-${state.nextUnitSerial}`, id = receiptId(owner, 'unit');
  const receipt = { receiptId: id, source: CARRY_GOLEM_SOURCE, kind: 'unit' as const, round: state.round,
    roundId: state.roundDefinitionId, definitionId: CARRY_GOLEM_ID, resolution: 'held' as const, unitId, gold: 0 };
  state = appendMechanicReceipt({ ...state, nextUnitSerial: state.nextUnitSerial + 1,
    preparation: { ...state.preparation, units: [...state.preparation.units,
      { id: unitId, definitionId: CARRY_GOLEM_ID, team: 'player', starLevel: 1, location: { kind: 'board', cell } }] },
    resourceProvenance: appendResourceProvenance(state.resourceProvenance, state.roundDefinitionId,
      { kind: 'unit-acquired', unitId, source: { kind: 'mechanic', receiptId: id } }),
  }, receipt);
  const events: MatchEvent[] = [{ type: 'mechanicGranted', receipt }];
  for (const [slot, definitionId] of CARRY_GOLEM.items.entries()) {
    const grant = grantMechanicItem(state, { receiptId: receiptId(owner, `item:${slot}`), source: CARRY_GOLEM_SOURCE, definitionId });
    if (!grant.ok || grant.receipt.kind !== 'item') throw new RangeError('Invalid carry golem equipment');
    const itemId = grant.receipt.itemId;
    state = { ...grant.state,
      resourceProvenance: appendResourceProvenance(grant.state.resourceProvenance, state.roundDefinitionId,
        { kind: 'item-equipped', itemId, unitId, slot }),
      items: grant.state.items.map(i => i.id === itemId ? { ...i, location: { kind: 'unit', unitId, slot } } : i),
    };
    events.push(...grant.events, { type: 'itemEquipped', itemId, unitId, slot });
  }
  return { state, events };
}
/** Applies at both offline and shared restore boundaries, including orphaned receipt/unit attempts. */
export function validateCarryGolem(state: MatchState): void {
  const fail = (): never => { throw new RangeError('Invalid carry golem authority'); };
  const owner = state.augments.find(a => a.definitionId === 'im-the-carry-now');
  const receipts = state.seatMechanics?.receipts.filter(r => r.source === CARRY_GOLEM_SOURCE || r.receiptId.startsWith(`["${CARRY_GOLEM_SOURCE}",`)) ?? [];
  const units = state.preparation.units.filter(u => u.definitionId === CARRY_GOLEM_ID);
  if (!owner) { if (receipts.length || units.length) fail(); return; }
  if (receipts.length !== 4 || units.length !== 1) fail();
  const unit = units[0], birth = receipts.find(r => r.receiptId === receiptId(owner, 'unit'));
  if (unit.team !== 'player' || unit.location.kind !== 'board' || unit.starLevel !== carryGolemStar(state.round, owner.acquiredRound)
    || !birth || birth.kind !== 'unit' || birth.resolution !== 'held' || birth.unitId !== unit.id || birth.gold !== 0
    || birth.definitionId !== CARRY_GOLEM_ID || (birth.starLevel ?? 1) !== 1 || birth.orbId !== undefined) fail();
  for (const r of receipts) if (r.source !== CARRY_GOLEM_SOURCE || r.round !== owner.acquiredRound
    || r.roundId !== getMultiplayerRoundByOrdinal(owner.acquiredRound).roundId) fail();
  for (const [slot, definitionId] of CARRY_GOLEM.items.entries()) {
    const r = receipts.find(r => r.receiptId === receiptId(owner, `item:${slot}`));
    if (!r || r.kind !== 'item' || r.definitionId !== definitionId || !state.items.some(i => i.id === r.itemId
      && i.definitionId === definitionId && i.location.kind === 'unit' && i.location.unitId === unit.id && i.location.slot === slot)) fail();
  }
  if (state.items.filter(i => i.location.kind === 'unit' && i.location.unitId === unit.id).length !== 3) fail();
  // The fixed grant has seven ordered resource facts. Receipts alone cannot replace birth/equipment evidence.
  const start = state.resourceProvenance.entries.findIndex(e => e.kind === 'unit-acquired' && e.unitId === unit.id);
  if (unit.id !== `unit-${1 + state.resourceProvenance.entries.slice(0, start).filter(e => e.kind === 'unit-acquired').length}`) fail();
  const facts: import('./resource-provenance').ResourceFact[] = [
    { kind: 'unit-acquired', unitId: unit.id, source: { kind: 'mechanic', receiptId: receiptId(owner, 'unit') } },
  ];
  for (const [slot] of CARRY_GOLEM.items.entries()) {
    const r = receipts.find(r => r.receiptId === receiptId(owner, `item:${slot}`));
    if (!r || r.kind !== 'item') return fail();
    facts.push({ kind: 'item-acquired', itemId: r.itemId, source: { kind: 'mechanic', receiptId: r.receiptId } },
      { kind: 'item-equipped', itemId: r.itemId, unitId: unit.id, slot });
  }
  for (const [offset, fact] of facts.entries()) {
    const actual = state.resourceProvenance.entries[start + offset];
    if (start < 0 || !actual || canonicalContent(actual) !== canonicalContent({ ...fact, sequence: start + offset, roundId: birth!.roundId })) fail();
  }
}
