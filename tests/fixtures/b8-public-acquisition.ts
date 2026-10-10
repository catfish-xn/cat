import { ITEM_DEFINITIONS } from '../../src/simulation/content/items';
import { buyUnit, combineItems, deployMatchUnit, rerollShop, sellUnit } from '../../src/simulation/match';
import type { MatchCommandResult, MatchState } from '../../src/simulation/match-types';
import { publicEquipmentPreparation } from './b8-public-equipment';

function accepted(result: MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(`Public acquisition fixture: ${result.reason}`);
  return result.state;
}

/** Acquire each requested permanent item from real component choices and recipes.
 * Returned IDs are selected from the public inventory / itemCombined event, never injected. */
export function publicInventory(definitions: readonly string[], late = false): { state: MatchState; itemIds: string[] } {
  const components = definitions.flatMap(id => {
    const definition = ITEM_DEFINITIONS[id];
    if (!definition) throw new Error(`Unknown item ${id}`);
    return [...(definition.recipe ?? [id])];
  });
  if (late) while (components.length < 4) components.push('sword');
  let state = publicEquipmentPreparation(components);
  const available = [...state.items], itemIds: string[] = [];
  for (const id of definitions) {
    const definition = ITEM_DEFINITIONS[id];
    const inputs = (definition.recipe ?? [id]).map(component => {
      const index = available.findIndex(item => item.definitionId === component && item.location.kind === 'inventory');
      if (index < 0) throw new Error(`Missing acquired ${component}`);
      return available.splice(index, 1)[0].id;
    });
    if (!definition.recipe) { itemIds.push(inputs[0]); continue; }
    const result = combineItems(state, inputs[0], inputs[1]);
    state = accepted(result);
    if (!result.ok) throw new Error(result.reason);
    const combined = result.events.find(event => event.type === 'itemCombined');
    if (!combined || combined.type !== 'itemCombined') throw new Error('Missing public combine event');
    itemIds.push(combined.itemId);
  }
  return { state, itemIds };
}

/** Nine paid one-star Irelia purchases: stop at eight with a real ninth offer ready.
 * The opening/drop roster is sold first so no starting card counts as a purchase. */
export function publicRecursivePurchase(state: MatchState): {
  state: MatchState; slot: number; survivorId: string; secondId: string; incomingId: string; purchaseIds: string[];
} {
  for (const unit of state.preparation.units.filter(unit => unit.team === 'player')) state = accepted(sellUnit(state, unit.id));
  const purchaseIds: string[] = [];
  while (true) {
    const slot = state.shop.slots.findIndex(offer => offer.status === 'available' && offer.definitionId === 'irelia');
    if (slot < 0) { state = accepted(rerollShop(state)); continue; }
    if (purchaseIds.length === 8) return { state, slot, survivorId: purchaseIds[0], secondId: purchaseIds[3], incomingId: purchaseIds[6], purchaseIds };
    const id = `unit-${state.nextUnitSerial}`;
    state = accepted(buyUnit(state, slot, state.shop.generation));
    purchaseIds.push(id);
    if (purchaseIds.length === 1) state = accepted(deployMatchUnit(state, id, { kind: 'board', cell: { col: 1, row: 4 } }));
  }
}
