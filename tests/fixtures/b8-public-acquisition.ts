import { shop as independentShop, COST } from './m5/oracle.g2.cjs';
import { ITEM_DEFINITIONS } from '../../src/simulation/content/items';
import { nextRound, buyUnit, combineItems, deployMatchUnit, rerollShop, sellUnit } from '../../src/simulation/match';
import type { MatchCommandResult, MatchState } from '../../src/simulation/match-types';
import { publicEquipmentPreparation, finishPublicEquipmentBattle, resolvePublicEquipmentChoices } from './b8-public-equipment';

function accepted(result: MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(`Public acquisition fixture: ${result.reason}`);
  return result.state;
}

/** Acquire each requested permanent item from real component choices and recipes.
 * Returned IDs are selected from the public inventory / itemCombined event, never injected. */
export function publicInventory(definitions: readonly string[], late = false, seed?: number): { state: MatchState; itemIds: string[] } {
  const components = definitions.flatMap(id => {
    const definition = ITEM_DEFINITIONS[id];
    if (!definition) throw new Error(`Unknown item ${id}`);
    return [...(definition.recipe ?? [id])];
  });
  if (late) while (components.length < 4) components.push('sword');
  // v16 independent loot oracle: seed16 earns two real gloves by2-7;
  // seed3 earns two tears by2-7. Supply choices complete the duplicate recipes
  // by3-4, before the anomaly window, with all extra rewards retained.
  const routeSeed=seed??(components.filter(id=>id==='gloves').length>=2?16:
    components.length===4&&components.every(id=>id==='tear')?3:undefined);
  // Reserve the two genuine seed16 glove drops; use earlier supply choices
  // for the other recipe inputs instead of accidentally buying a third glove.
  const acquisitionComponents=routeSeed===16?[...components].sort((a,b)=>Number(a==='gloves')-Number(b==='gloves')):components;
  let state = publicEquipmentPreparation(acquisitionComponents, routeSeed === undefined ? {} : { seed: routeSeed });
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

/** Nine paid one-star one-cost purchases: stop at eight with a real ninth offer ready.
 * The opening/drop roster is sold first so no starting card counts as a purchase. */
export function publicRecursivePurchase(state: MatchState): {
  state: MatchState; slot: number; definitionId: string; survivorId: string; secondId: string; incomingId: string; purchaseIds: string[];
} {
  const fundingState = state;
  for (const unit of state.preparation.units.filter(unit => unit.team === 'player')) state = accepted(sellUnit(state, unit.id));
  // Expanded bags make nine fixed Irelias unaffordable. Select the cheapest
  // nine-card paid route using the independent shop oracle; never grant gold,
  // rewrite RNG or edit offers. All actual operations below remain public.
  const candidates = Object.keys(COST).filter(id=>COST[id]===1);
  const routeCost = (id: string) => {
    let count = 0, spent = 0, shop = state.shop, rng = state.rngState;
    for (let rolls = 0; rolls < 1000; rolls++) {
      for (const offer of shop.slots) if (offer.status === 'available' && offer.definitionId === id) {
        spent++; if (++count === 9) return spent;
      }
      spent += 2; const next = independentShop(rng, shop.generation + 1, state.level);
      rng = next.rngState; shop = next.shop;
    }
    throw Error('Nine-card public route search exhausted');
  };
  const costs = new Map(candidates.map(id => [id, routeCost(id)]));
  const definitionId = candidates.sort((a,b) => costs.get(a)! - costs.get(b)! || a.localeCompare(b))[0];
  if (costs.get(definitionId)! > state.gold) {
    // Empty-board losses exchange real HP for ordinary income and a free shop refresh.
    const settled = finishPublicEquipmentBattle(fundingState);
    const advanced = resolvePublicEquipmentChoices(accepted(nextRound(settled,state.round)));
    return publicRecursivePurchase(advanced);
  }
  if (COST[definitionId] !== 1) throw Error('Recursive fixture requires a one-cost hero');
  const purchaseIds: string[] = [];
  while (true) {
    const slot = state.shop.slots.findIndex(offer => offer.status === 'available' && offer.definitionId === definitionId);
    if (slot < 0) { state = accepted(rerollShop(state)); continue; }
    if (purchaseIds.length === 8) return { state, slot, definitionId, survivorId: purchaseIds[0], secondId: purchaseIds[3], incomingId: purchaseIds[6], purchaseIds };
    const id = `unit-${state.nextUnitSerial}`;
    state = accepted(buyUnit(state, slot, state.shop.generation));
    purchaseIds.push(id);
    if (purchaseIds.length === 1) state = accepted(deployMatchUnit(state, id, { kind: 'board', cell: { col: 1, row: 4 } }));
  }
}
