import * as api from '../../../src/simulation/match';
import { ITEM_DEFINITIONS } from '../../../src/simulation/content/items';

/** Version the actual command recipe, independently of generated save bytes. */
export const HERALD_RAW_GENERATION_VERSION = 'm8-herald-public-commands-v1';
export const HERALD_RAW_CASES = [
  { name: 'ionic-spark', definitions: ['ionic-spark'] },
  { name: 'evenshroud', definitions: ['evenshroud'] },
  { name: 'ionic-spark--evenshroud', definitions: ['ionic-spark', 'evenshroud'] },
  { name: 'quicksilver', definitions: ['quicksilver'] },
  { name: 'edge-of-night', definitions: ['edge-of-night'] },
] as const;
export type HeraldCommandObserver = (before: api.MatchState, result: api.MatchCommandResult | api.MatchStep,
  operation: string, args: readonly unknown[]) => void;

function accepted(result: api.MatchCommandResult): api.MatchState {
  if (!result.ok) throw new Error(`Public neutral fixture: ${result.reason}`);
  return result.state;
}
function commandApi(observer?: HeraldCommandObserver): typeof api {
  if (!observer) return api;
  return new Proxy(api, { get(target, property) {
    const value = Reflect.get(target, property);
    if (typeof value !== 'function') return value;
    return (...args: unknown[]) => {
      const result = Reflect.apply(value, target, args) as api.MatchCommandResult | api.MatchStep;
      observer(args[0] as api.MatchState, result, String(property), args.slice(1));
      return result;
    };
  } });
}

/** Keep the legitimately acquired original Irelia as the single charge target.
 * The original synthetic Garen was only a durable target, not a Garen-stat oracle.
 * Public bench commands preserve all acquired heroes and permanent equipment. */
export function fieldHeraldTarget(initial: api.MatchState, observer?: HeraldCommandObserver): api.MatchState {
  const commands = commandApi(observer);
  let state = initial;
  for (const unit of state.preparation.units.filter(unit => unit.team === 'player' && unit.id !== 'unit-1' && unit.location.kind === 'board')) {
    const occupied = new Set(state.preparation.units.flatMap(unit => unit.location.kind === 'bench' ? [unit.location.slot] : []));
    const slot = Array.from({ length: state.preparation.benchSize }, (_, index) => index).find(index => !occupied.has(index));
    if (slot === undefined) throw new Error('No public bench slot for Herald fixture');
    state = accepted(commands.deployMatchUnit(state, unit.id, { kind: 'bench', slot }));
  }
  return accepted(commands.deployMatchUnit(state, 'unit-1', { kind: 'board', cell: { col: 3, row: 4 } }));
}

/** Raw command construction only: no import or call of restoreMatch/serializeMatch.
 * The supplied genuine unresolved 4-4 prefix is independently copied. Every
 * intervening battle and item acquisition remains the original public route. */
export function buildRawHeraldEquipment(initial: api.MatchState, definitions: readonly string[],
  observer?: HeraldCommandObserver): api.MatchState {
  if (initial.roundDefinitionId !== '4-4' || initial.phase !== 'choice') throw new Error('Missing public 4-4 equipment prefix');
  const commands = commandApi(observer);
  let state: api.MatchState = structuredClone(initial);
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
        ? commands.selectAnomalyTarget(state, choice.choiceId, choice.generation, state.preparation.units.find(u => u.definitionId === 'kogmaw')!.id)
        : commands.selectChoice(state, choice.choiceId, choice.generation, choice.kind === 'component' ? missingComponent() : choice.offers[0]));
    }
    if (state.phase === 'preparation') {
      while (state.level < 8 && state.gold >= 4) state = accepted(commands.buyXp(state));
      for (const unit of state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench')) {
        if (state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').length >= state.level) break;
        const free = [{ col: 3, row: 4 }, { col: 5, row: 4 }, { col: 0, row: 4 }, { col: 6, row: 4 }, { col: 3, row: 7 }]
          .find(cell => !state.preparation.units.some(u => u.location.kind === 'board' && u.location.cell.col === cell.col && u.location.cell.row === cell.row));
        if (!free) throw new Error('No public deployment cell');
        state = accepted(commands.deployMatchUnit(state, unit.id, { kind: 'board', cell: free }));
      }
      state = accepted(commands.startMatchCombat(state));
      while (state.phase === 'combat') state = commands.stepMatch(state).state;
    }
    if (state.phase === 'choice') continue;
    if (state.phase !== 'settlement') throw new Error(`Equipment route stopped at ${state.roundDefinitionId}/${state.phase}`);
    state = accepted(commands.nextRound(state, state.round));
  }
  for (const [slot, definitionId] of definitions.entries()) {
    const available = [...inventory()];
    const inputs = ITEM_DEFINITIONS[definitionId].recipe!.map(component => {
      const index = available.findIndex(item => item.definitionId === component);
      if (index < 0) throw new Error(`Public route did not acquire ${component} for ${definitionId}`);
      return available.splice(index, 1)[0].id;
    });
    const combined = commands.combineItems(state, inputs[0], inputs[1]);
    state = accepted(combined);
    if (!combined.ok) throw new Error(combined.reason);
    const event = combined.events.find(event => event.type === 'itemCombined');
    if (!event || event.type !== 'itemCombined') throw new Error('Missing public item combination');
    state = accepted(commands.equipItem(state, event.itemId, 'unit-1', slot));
  }
  return fieldHeraldTarget(state, observer);
}
