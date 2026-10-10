import { ITEM_DEFINITIONS } from '../../src/simulation/content/items';
import {
  combineItems, createMatch, deployMatchUnit, equipItem, nextRound,
  selectChoice, startMatchCombat, stepMatch,
} from '../../src/simulation/match';
import type { MatchCommandResult, MatchState } from '../../src/simulation/match-types';

function accepted(result: MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(`Public equipment fixture: ${result.reason}`);
  return result.state;
}

function finishBattle(state: MatchState): MatchState {
  state = accepted(startMatchCombat(state));
  for (let tick = 0; tick < 1201 && state.phase === 'combat'; tick++) state = stepMatch(state).state;
  if (state.phase !== 'settlement' && state.phase !== 'choice') {
    throw new Error(`Public equipment fixture did not finish ${state.roundDefinitionId}`);
  }
  return state;
}

function choose(state: MatchState, definitionId: string): MatchState {
  const choice = state.pendingChoice;
  if (state.phase !== 'choice' || !choice) throw new Error(`Expected public choice in ${state.roundDefinitionId}`);
  return accepted(selectChoice(state, choice.choiceId, choice.generation, definitionId));
}

function deployDrop(state: MatchState, definitionId: string, col: number): MatchState {
  const unit = state.preparation.units.find(unit => unit.team === 'player' && unit.definitionId === definitionId);
  if (!unit) throw new Error(`Opening did not grant ${definitionId}`);
  return accepted(deployMatchUnit(state, unit.id, { kind: 'board', cell: { col, row: 7 } }));
}

function benchPlayers(state: MatchState): MatchState {
  for (const unit of state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'board')) {
    const occupied = new Set(state.preparation.units.flatMap(unit => unit.location.kind === 'bench' ? [unit.location.slot] : []));
    const slot = Array.from({ length: state.preparation.benchSize }, (_, index) => index).find(index => !occupied.has(index));
    if (slot === undefined) throw new Error('Public equipment fixture has no bench slot');
    state = accepted(deployMatchUnit(state, unit.id, { kind: 'bench', slot }));
  }
  return state;
}

// Cache only preparation/choice snapshots actually reached by public commands.
// The first request executes the battles; every caller gets an independent graph.
let firstChoice: MatchState | undefined;
const secondChoices = new Map<string, MatchState>();
const preparations = new Map<string, MatchState>();
function openingComponentChoice(): MatchState {
  if (!firstChoice) {
    let state = finishBattle(createMatch(42)); // Original Irelia wins 1-2 and really receives Maddie.
    state = accepted(nextRound(state, state.round));
    state = deployDrop(state, 'maddie', 3);
    firstChoice = structuredClone(finishBattle(state)); // 1-3 really grants Lux and offers component 1.
  }
  return structuredClone(firstChoice);
}

function secondComponentChoice(component: string): MatchState {
  if (!secondChoices.has(component)) {
    let state = choose(openingComponentChoice(), component);
    state = accepted(nextRound(state, state.round));
    state = deployDrop(state, 'lux', 5);
    secondChoices.set(component, structuredClone(finishBattle(state))); // 1-4 offers component 2.
  }
  return structuredClone(secondChoices.get(component)!);
}

function equipmentPreparation(components: readonly string[]): MatchState {
  const key = JSON.stringify(components);
  if (!preparations.has(key)) {
    let state = choose(secondComponentChoice(components[0]), components[1] ?? 'sword');
    state = accepted(nextRound(state, state.round));
    state = choose(state, 'bulky-buddies-i');
    state = benchPlayers(state); // The eventual lone holder has no adjacent ally bonus.
    if (components.length > 2) {
      // Four real components require the scheduled 2-4 and 3-4 choices. Concede
      // intervening rounds publicly; no enemy, HP, receipt or resource is edited.
      while (state.roundDefinitionId !== '3-5') {
        if (state.phase === 'choice') {
          const selection = state.roundDefinitionId === '2-4' ? components[2]
            : state.roundDefinitionId === '3-2' ? 'manaflow-i'
              : state.roundDefinitionId === '3-4' ? components[3] ?? 'sword' : undefined;
          if (!selection) throw new Error(`Unexpected fixture choice in ${state.roundDefinitionId}`);
          state = choose(state, selection);
        }
        if (state.phase === 'preparation') state = finishBattle(state);
        if (state.phase !== 'settlement') throw new Error(`Cannot advance fixture from ${state.roundDefinitionId}/${state.phase}`);
        state = accepted(nextRound(state, state.round));
      }
    }
    preparations.set(key, structuredClone(state));
  }
  return structuredClone(preparations.get(key)!);
}

/** Public provenance-complete equipment fixture: combat is 2-1 (one/two
 * components) or 3-5 (three/four), not the old synthetic 1-2 encounter.
 * unit-1 is the original Irelia; unit-3 is the Lux actually dropped in 1-3.
 * All non-holders stay benched. Front-row placement keeps both selected
 * augments inert, preserving the original independent item/stat assertions.
 */
export function itemMatch(id: string | readonly string[], unitId = 'unit-1'): MatchState {
  const requested = typeof id === 'string' ? [id] : [...id];
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
  return accepted(startMatchCombat(state));
}

/** Public-command component acquisition, before any combine/equip/start. */
export { equipmentPreparation as publicEquipmentPreparation };
