import { CARRY_GOLEM, CARRY_GOLEM_ID } from './content/augment-pool-batch5-g6';
import { appendResourceProvenance } from './resource-provenance';
import { appendMechanicReceipt, grantMechanicItem } from './seat-mechanics';
import type { MatchEvent, MatchState } from './match-types';
import { carryGolemStar } from './augment-pool-batch5-g6-stats';
import type { OwnedAugment } from './strategy-types';
import { CARRY_GOLEM_SOURCE } from './augment-pool-batch5-g6-equipment';

export { CARRY_GOLEM_SOURCE } from './augment-pool-batch5-g6-equipment';
export const receiptId = (owner: OwnedAugment, part: string) => JSON.stringify([CARRY_GOLEM_SOURCE, owner.choiceId, part]);
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

