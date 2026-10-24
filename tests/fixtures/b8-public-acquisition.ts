import {lootPlan as independentLootPlan} from './orb-combo-oracle.cjs';
import { shop as independentShop, COST } from './m5/oracle.g2.cjs';
import { ITEM_DEFINITIONS } from '../../src/simulation/content/items';
import { createOpeningEncounter } from '../../src/simulation/opening-encounter';
import { nextRound, buyUnit, combineItems, deployMatchUnit, rerollShop, sellUnit } from '../../src/simulation/match';
import type { MatchCommandResult, MatchState } from '../../src/simulation/match-types';
import { isSellableUnit } from '../../src/simulation/seat-mechanics/forms';
import { isAnvil } from '../../src/simulation/content/anvils';
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
  // Restore the v15 funded routes: scheme A preserves original drops and shop draws.
  // The earlier replacement seeds can exhaust HP/income before nine paid copies.
  // Independent v17 oracle chooses a real route requiring at most two scheduled components.
  let routeSeed=seed??1;
  for(;routeSeed<100000;routeSeed++){
    // v23 fmix32 opening word: the default search keeps the crab-rave opening every small seed drew before
    // (Trainer Golem and anvil openings occupy board/bench cells); explicit caller seeds are kept as chosen.
    if(seed===undefined&&createOpeningEncounter(routeSeed).selection.encounterId!=='crab-rave')continue;
    const drops=independentLootPlan(routeSeed,10).rounds.flatMap(r=>r.encounterPlan.drops);
    const available=drops.flatMap(d=>d.payload.kind==='item'?[d.payload.definitionId]:[]);
    let missing=0;for(const id of components){const i=available.indexOf(id);if(i<0)missing++;else available.splice(i,1);}
    if(missing<=2&&drops.filter(d=>d.payload.kind==='unit').length>=2)break;
  }
  if(routeSeed===100000)throw Error('No bounded independent component route');
  let state = publicEquipmentPreparation(components, {seed:routeSeed});
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
  // v22/v23 opening structures (Trainer Golem) and anvils are not cards: they cannot be sold, so they stay.
  // Selling frees bench space, so loot heroes waiting for space can arrive mid-loop (v23 openings): sell until none remain.
  const sellable = (s: MatchState) => s.preparation.units.find(unit => unit.team === 'player' && isSellableUnit(unit.definitionId) && !isAnvil(unit.definitionId));
  for (let unit = sellable(state); unit; unit = sellable(state)) state = accepted(sellUnit(state, unit.id));
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
    let advanced = resolvePublicEquipmentChoices(accepted(nextRound(settled,state.round)));
    while(advanced.phase==='settlement')advanced=resolvePublicEquipmentChoices(accepted(nextRound(advanced,advanced.round)));
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
