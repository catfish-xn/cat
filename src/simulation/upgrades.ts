import { contains, isDeploymentCell } from './board';
import { checkEquipmentPlacement } from './equipment-policy';
import type { GameState } from './game';
import type { PurchasePlanResult } from './match-types';
import type { AnomalyBinding, ItemInstance, StrategyEvent } from './strategy-types';
import { UNIT_DEFINITIONS, type StarLevel, type Unit, type UnitLocation, type UnitUpgradedEvent } from './units';

type Candidate = Omit<Unit, 'location'> & { readonly location: UnitLocation | null };
const compareIds = (a: { readonly id: string }, b: { readonly id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const copyLocation = (location: UnitLocation): UnitLocation => location.kind === 'board'
  ? { kind: 'board', cell: { ...location.cell } } : { ...location };

function compareRetention(a: Candidate, b: Candidate): number {
  const rank = (unit: Candidate) => unit.location?.kind === 'board' ? 0 : unit.location?.kind === 'bench' ? 1 : 2;
  const rankDifference = rank(a) - rank(b);
  if (rankDifference) return rankDifference;
  if (a.location?.kind === 'board' && b.location?.kind === 'board') {
    return a.location.cell.row - b.location.cell.row || a.location.cell.col - b.location.cell.col || compareIds(a, b);
  }
  if (a.location?.kind === 'bench' && b.location?.kind === 'bench') return a.location.slot - b.location.slot || compareIds(a, b);
  return compareIds(a, b);
}

function validateRoster(preparation: GameState): void {
  const ids = new Set<string>(), positions = new Set<string>();
  for (const unit of preparation.units) {
    const location = unit.location;
    const position = location.kind === 'board' ? `board:${location.cell.row}:${location.cell.col}` : `bench:${location.slot}`;
    const validLocation = location.kind === 'board'
      ? contains(preparation.board, location.cell) && isDeploymentCell(preparation.board, unit.team, location.cell)
      : Number.isInteger(location.slot) && location.slot >= 0 && location.slot < preparation.benchSize;
    if (ids.has(unit.id) || positions.has(position) || !validLocation) throw new Error('Invalid preparation roster');
    ids.add(unit.id); positions.add(position);
  }
}

/** Plan first, commit in Match only after success; the pending card occupies no slot. */
export function planPurchase(preparation: GameState, definitionId: string, candidateId: string): PurchasePlanResult {
  if (!Object.hasOwn(UNIT_DEFINITIONS, definitionId)) throw new RangeError(`Unknown unit definition: ${definitionId}`);
  validateRoster(preparation);
  if (preparation.units.some(unit => unit.id === candidateId)) throw new Error(`Duplicate unit ID: ${candidateId}`);
  let units: Candidate[] = [...preparation.units, { id: candidateId, definitionId, team: 'player', starLevel: 1, location: null }];
  const events: UnitUpgradedEvent[] = [];
  for (const fromStar of [1, 2] as const) {
    while (true) {
      const group = units.filter(unit => unit.team === 'player' && unit.definitionId === definitionId && unit.starLevel === fromStar).sort(compareRetention);
      if (group.length < 3) break;
      const [survivor, ...consumed] = group.slice(0, 3);
      // At most one unplaced candidate exists, so every triple has a placed survivor.
      if (survivor.location === null) throw new Error('Upgrade survivor has no location');
      const toStar = (fromStar + 1) as StarLevel;
      const consumedIds = consumed.map(unit => unit.id).sort();
      const consumedSet = new Set(consumedIds);
      units = units.filter(unit => !consumedSet.has(unit.id)).map(unit => unit.id === survivor.id ? { ...unit, starLevel: toStar } : unit);
      events.push({ type: 'unitUpgraded', survivorId: survivor.id, consumedIds, definitionId,
        fromStar, toStar, location: copyLocation(survivor.location) });
    }
  }
  const pending = units.find(unit => unit.location === null);
  if (pending) {
    const occupied = new Set(units.flatMap(unit => unit.location?.kind === 'bench' ? [unit.location.slot] : []));
    let slot = 0;
    while (slot < preparation.benchSize && occupied.has(slot)) slot++;
    if (slot === preparation.benchSize) return { ok: false, reason: 'bench-full' };
    units = units.map(unit => unit.id === pending.id ? { ...unit, location: { kind: 'bench', slot } } : unit);
  }
  const next: GameState = { ...preparation, units: units.map(unit => {
    if (unit.location === null) throw new Error('Unplaced purchase candidate');
    return { ...unit, location: copyLocation(unit.location) };
  }).sort(compareIds) };
  validateRoster(next);
  return { ok: true, preparation: next, events };
}

/** Apply every upgrade to a temporary resource ledger before Match commits the purchase. */
export function transferUpgradeResources(
  items: readonly ItemInstance[], binding: AnomalyBinding | null, upgradeEvents: readonly UnitUpgradedEvent[],
): { readonly items: readonly ItemInstance[]; readonly anomalyBinding: AnomalyBinding | null; readonly events: readonly StrategyEvent[] } {
  let nextItems = [...items], anomalyBinding = binding;
  const events: StrategyEvent[] = [];
  for (const upgrade of upgradeEvents) {
    for (const consumedId of [...upgrade.consumedIds].sort()) {
      const consumedItems = nextItems.filter(item => item.location.kind === 'unit' && item.location.unitId === consumedId)
        .sort((a, b) => {
          if (a.location.kind !== 'unit' || b.location.kind !== 'unit') throw new Error('Expected equipped item');
          return a.location.slot - b.location.slot || compareIds(a, b);
        });
      const returnedIds: string[] = [];
      for (const item of consumedItems) {
        let slot = 0;
        while (slot < 3 && !checkEquipmentPlacement(nextItems, item, upgrade.survivorId, slot).allowed) slot++;
        const location: ItemInstance['location'] = slot < 3
          ? { kind: 'unit', unitId: upgrade.survivorId, slot } : { kind: 'inventory' };
        nextItems = nextItems.map(candidate => candidate.id === item.id ? { ...candidate, location } : candidate);
        if (slot < 3) {
          events.push({ type: 'itemEquipped', itemId: item.id, unitId: upgrade.survivorId, slot });
        } else returnedIds.push(item.id);
      }
      if (returnedIds.length) events.push({ type: 'itemsReturned', itemIds: returnedIds.sort(), unitId: consumedId });
    }
    if (anomalyBinding && upgrade.consumedIds.includes(anomalyBinding.unitId)) {
      events.push({ type: 'anomalyTransferred', fromId: anomalyBinding.unitId, toId: upgrade.survivorId });
      anomalyBinding = { ...anomalyBinding, unitId: upgrade.survivorId };
    }
  }
  return { items: nextItems.sort(compareIds), anomalyBinding, events };
}
