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

// Seed 145424 independently selects Irelia and retains the cloak/rod/gloves/bow/sword component vector.
// Fixed opening rewards provide Maddie and Lux; no roster or raw state is patched.
import { publicEquipmentPreparation as acquire } from './b8-public-equipment';
const equipmentPreparation=(components:readonly string[])=>acquire(components,{seed:145424});

// Cache the public route + item compilation. Each caller owns its mutable copy;
// negative/continuation tests cannot contaminate later test fixtures.
const compiledItems = new Map<string, MatchState>();
/** Public provenance-complete equipment fixture: combat is 2-1 (one/two
 * components) or 3-5 (three/four), not the old synthetic 1-2 encounter.
 * unit-1 is the original Irelia; unit-3 is the Lux actually dropped in 1-3.
 * All non-holders stay benched. Front-row placement keeps both selected
 * augments inert, preserving the original independent item/stat assertions.
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
  const components = requested.flatMap(definitionId => {
    const definition = ITEM_DEFINITIONS[definitionId];
    if (!definition) throw new Error(`Unknown fixture item ${definitionId}`);
    return definition.recipe ? [...definition.recipe] : [definitionId];
  });
  if (!components.length || components.length > 4) throw new Error('Public equipment fixture requires one to four components');
  let state = equipmentPreparation(components);
  const available = state.items.filter(item => item.location.kind === 'inventory');
  for (const [slot, definitionId] of requested.entries()) {
    const definition = ITEM_DEFINITIONS[definitionId];
    const inputs = (definition.recipe ?? [definitionId]).map(component => {
      const index = available.findIndex(item => item.definitionId === component);
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
