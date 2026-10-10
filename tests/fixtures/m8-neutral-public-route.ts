import * as api from '../../src/simulation/match';
import { restoreMatch, serializeMatch } from '../../src/simulation/serialization';
import { ITEM_DEFINITIONS } from '../../src/simulation/content/items';
import { run } from '../../scripts/generate-m5-route.cjs';

function accepted(result: api.MatchCommandResult): api.MatchState {
  if (!result.ok) throw new Error(`Public neutral fixture: ${result.reason}`);
  return result.state;
}
const preparations = new Map<string, api.MatchState>();
let equipmentFork: api.MatchState | undefined;
// Execute the command-only driver once, retaining only the actual preparation
// prefixes. No golden, injected result, resource, birth, star or receipt is used.
// Generate once per test module; consumers restore independent graphs before use.
const route = await run(api, { build: 'sniper', seed: 42, onStep(before, result, command) {
  if (command?.type === 'start' || command?.type === 'continue' && before.m8.round.kind === 'supply')
    preparations.set(before.roundDefinitionId, before);
  if (before.roundDefinitionId === '4-4' && before.phase === 'choice') equipmentFork ??= before;
  if (result.state.phase === 'preparation') preparations.set(result.state.roundDefinitionId, result.state);
} });
if (route.final.phase !== 'gameOver' || route.final.roundDefinitionId !== '6-7' || route.final.outcome !== 'victory')
  throw new Error('Public neutral fixture did not complete the actual 33-battle route');

/** Each consumer receives a provenance-complete, restored independent prefix. */
export function publicNeutralPreparation(roundId: string): api.MatchState {
  const state = preparations.get(roundId);
  if (!state) throw new Error(`Missing public route preparation: ${roundId}`);
  return restoreMatch(serializeMatch(state));
}

/** A genuine unresolved 4-4 supply choice, before reserving any late items. */
export function publicNeutralEquipmentChoice(): api.MatchState {
  if (!equipmentFork) throw new Error('Missing public 4-4 equipment prefix');
  return restoreMatch(serializeMatch(equipmentFork));
}

/** Keep the legitimately acquired original Irelia as the single charge target.
 * The original synthetic Garen was only a durable target, not a Garen-stat oracle.
 * Public bench commands preserve all acquired heroes and permanent equipment. */
export function publicHeraldTarget(initial = publicNeutralPreparation('6-7')): api.MatchState {
  let state = initial;
  for (const unit of state.preparation.units.filter(unit => unit.team === 'player' && unit.id !== 'unit-1' && unit.location.kind === 'board')) {
    const occupied = new Set(state.preparation.units.flatMap(unit => unit.location.kind === 'bench' ? [unit.location.slot] : []));
    const slot = Array.from({ length: state.preparation.benchSize }, (_, index) => index).find(index => !occupied.has(index));
    if (slot === undefined) throw new Error('No public bench slot for Herald fixture');
    state = accepted(api.deployMatchUnit(state, unit.id, { kind: 'bench', slot }));
  }
  return accepted(api.deployMatchUnit(state, 'unit-1', { kind: 'board', cell: { col: 3, row: 4 } }));
}

const equipmentPreparations = new Map<string, api.MatchState>();
/** Fork the genuine 4-4 component choice and reserve subsequent real choices for
 * the requested items. Fight every intervening round normally with the acquired
 * army, then combine/equip the actual component instances before 6-7. */
export function publicHeraldEquipment(definitions: readonly string[]): api.MatchState {
  if (!definitions.length) return publicHeraldTarget();
  const key = JSON.stringify(definitions);
  if (!equipmentPreparations.has(key)) {
    let state = publicNeutralEquipmentChoice();
    const required = definitions.flatMap(id => [...ITEM_DEFINITIONS[id].recipe!]);
    const inventory = () => state.items.filter(item => item.location.kind === 'inventory');
    function missingComponent(): string {
      const available = inventory().map(item => item.definitionId);
      for (const component of required) {
        const index = available.indexOf(component);
        if (index < 0) return component;
        available.splice(index, 1);
      }
      return 'sword';
    }
    while (state.roundDefinitionId !== '6-7') {
      while (state.phase === 'choice') {
        const choice = state.pendingChoice!;
        state = accepted(choice.step === 'target'
          ? api.selectAnomalyTarget(state, choice.choiceId, choice.generation, state.preparation.units.find(u => u.definitionId === 'kogmaw')!.id)
          : api.selectChoice(state, choice.choiceId, choice.generation, choice.kind === 'component' ? missingComponent() : choice.offers[0]));
      }
      if (state.phase === 'preparation') {
        while (state.level < 8 && state.gold >= 4) state = accepted(api.buyXp(state));
        for (const unit of state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench')) {
          if (state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').length >= state.level) break;
          const free = [{ col: 3, row: 4 }, { col: 5, row: 4 }, { col: 0, row: 4 }, { col: 6, row: 4 }, { col: 3, row: 7 }]
            .find(cell => !state.preparation.units.some(u => u.location.kind === 'board' && u.location.cell.col === cell.col && u.location.cell.row === cell.row));
          if (!free) throw new Error('No public deployment cell');
          state = accepted(api.deployMatchUnit(state, unit.id, { kind: 'board', cell: free }));
        }
        state = accepted(api.startMatchCombat(state));
        while (state.phase === 'combat') state = api.stepMatch(state).state;
      }
      if (state.phase === 'choice') continue;
      if (state.phase !== 'settlement') throw new Error(`Equipment route stopped at ${state.roundDefinitionId}/${state.phase}`);
      state = accepted(api.nextRound(state, state.round));
    }
    for (const [slot, definitionId] of definitions.entries()) {
      const available = [...inventory()];
      const inputs = ITEM_DEFINITIONS[definitionId].recipe!.map(component => {
        const index = available.findIndex(item => item.definitionId === component);
        if (index < 0) throw new Error(`Public route did not acquire ${component} for ${definitionId}`);
        return available.splice(index, 1)[0].id;
      });
      const combined = api.combineItems(state, inputs[0], inputs[1]);
      state = accepted(combined);
      if (!combined.ok) throw new Error(combined.reason);
      const event = combined.events.find(event => event.type === 'itemCombined');
      if (!event || event.type !== 'itemCombined') throw new Error('Missing public item combination');
      state = accepted(api.equipItem(state, event.itemId, 'unit-1', slot));
    }
    equipmentPreparations.set(key, publicHeraldTarget(state));
  }
  return restoreMatch(serializeMatch(equipmentPreparations.get(key)!));
}
