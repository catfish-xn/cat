import { freezeContent } from '../../src/simulation/content/freeze';
import { ITEM_DEFINITIONS } from '../../src/simulation/content/items';
import {
  combineItems, deployMatchUnit, equipItem, startMatchCombat,
} from '../../src/simulation/match';
import type { MatchCommandResult, MatchState } from '../../src/simulation/match-types';

function accepted(result: MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(`Public equipment fixture: ${result.reason}`);
  return result.state;
}

// Independent v17 seed 206 selects Irelia and drops Lux as unit-3; all ingredients use real drops/supplies.
// Baseline random rewards genuinely draw Maddie and Lux; no roster or raw state is patched.
import { publicEquipmentPreparation as acquire, advancePublicEquipmentPreparation } from './b8-public-equipment';
// Preserve seed206's independent loot/holder vector. The v24 rerolls take
// Crimson Pact; its Chem-Baron holder stays benched in these equipment combats.
const EQUIPMENT_ROUTE={seed:206,earliestRound:8,augmentPriorities:['mentorship-ii','inspiring-epitaph','clockwork-accelerator'],rerollForAugment:true};
// Keep the original component births; neither chosen card grants items or changes an isolated holder.
const DOUBLE_BLOODTHIRSTER_ROUTE={ seed: 76672, earliestRound:15, augmentPriorities: ['pumping-up-iii', 'bronze-for-life-ii'], rerollForAugment: true };
const equipmentPreparation=(components:readonly string[])=>acquire(components,EQUIPMENT_ROUTE);
function acquisition(requested: readonly string[]) {
  const components = requested.flatMap(definitionId => {
    const definition = ITEM_DEFINITIONS[definitionId];
    if (!definition) throw new Error(`Unknown fixture item ${definitionId}`);
    return definition.recipe ? [...definition.recipe] : [definitionId];
  });
  if (!components.length || components.length > 4) throw new Error('Public equipment fixture requires one to four components');
  const doubleBloodthirster = requested.length === 2 && requested.every(id => id === 'bloodthirster');
  return { components, doubleBloodthirster, options: doubleBloodthirster ? DOUBLE_BLOODTHIRSTER_ROUTE : EQUIPMENT_ROUTE };
}
/** Play itemMatch's public acquisition route through round ordinal `throughRound` only (cached for the
 * later itemMatch call), so a long route can be spread over several test cases. True once acquired. */
export function advanceItemMatchRoute(id: string | readonly string[], throughRound: number): boolean {
  const { components, options } = acquisition(typeof id === 'string' ? [id] : id);
  return advancePublicEquipmentPreparation(components, options, throughRound) !== undefined;
}

// Cache the public route + item compilation. Each caller owns its mutable copy;
// negative/continuation tests cannot contaminate later test fixtures.
const compiledItems = new Map<string, MatchState>();
/** Public provenance-complete equipment fixture: combat is 2-1 (one/two
 * components) or 3-5 (three/four), not the old synthetic 1-2 encounter.
 * unit-1 is the original Irelia; unit-3 is the Lux actually dropped in 1-3.
 * All non-holders stay benched. Selected augments preserve the original
 * independent opening HP/item-stat assertions.
 */
export function itemMatch(id: string | readonly string[], unitId = 'unit-1'): MatchState {
  const requested = typeof id === 'string' ? [id] : [...id];
  const key = JSON.stringify([requested, unitId]), cached = compiledItems.get(key);
  if (cached) {
    const copy = structuredClone(cached);
    freezeContent(copy.m8); freezeContent(copy.resourceProvenance);
    if (copy.combatInputBasis) freezeContent(copy.combatInputBasis);
    return copy;
  }
  const { components, doubleBloodthirster, options } = acquisition(requested);
  let state = acquire(components, options);
  const available = state.items.filter(item => item.location.kind === 'inventory');
  // The second Bloodthirster must use both real supply choices, leaving extra PvE drops intact.
  const supplyItemIds = new Set(state.scheduleReceipts.flatMap(receipt => receipt.kind === 'component' ? receipt.itemIds : []));
  for (const [slot, definitionId] of requested.entries()) {
    const definition = ITEM_DEFINITIONS[definitionId];
    const inputs = (definition.recipe ?? [definitionId]).map(component => {
      const index = available.findIndex(item => item.definitionId === component
        && (!doubleBloodthirster || slot !== 1 || supplyItemIds.has(item.id)));
      if (index < 0) throw new Error(`Public equipment fixture did not acquire ${component}`);
      return available.splice(index, 1)[0].id;
    });
    let itemId = inputs[0];
    if (definition.recipe) {
      const combined = combineItems(state, inputs[0], inputs[1]);
      state = accepted(combined);
      if (!combined.ok) throw new Error(combined.reason);
      const event = combined.events.find(event => event.type === 'itemCombined');
      if (!event || event.type !== 'itemCombined') throw new Error('Public combine omitted its itemCombined event');
      itemId = event.itemId;
    }
    state = accepted(equipItem(state, itemId, unitId, slot));
  }
  state = accepted(deployMatchUnit(state, unitId, { kind: 'board', cell: { col: unitId === 'unit-1' ? 1 : 5, row: 4 } }));
  const compiled = accepted(startMatchCombat(state));
  compiledItems.set(key, structuredClone(compiled));
  return compiled;
}

/** Public-command component acquisition, before any combine/equip/start. */
export { equipmentPreparation as publicEquipmentPreparation };
