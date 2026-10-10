import {
  createMatch, deployMatchUnit, nextRound, selectChoice, startMatchCombat, stepMatch,
} from '../../src/simulation/match';
import type { MatchCommandResult, MatchEvent, MatchState } from '../../src/simulation/match-types';
import type { CombatEvent } from '../../src/simulation/combat';
import type { BattleHistory } from '../../src/replay';

function accepted(result: MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(`Public B8 equipment fixture: ${result.reason}`);
  return result.state;
}

function observe(history: BattleHistory | undefined, before: MatchState, after: MatchState,
  events: readonly MatchEvent[], reason: 'command' | 'tick'): void {
  history?.observe({ before, after, reason, events: events.filter((event): event is CombatEvent => event.domain === 'combat') });
}

/** Record the real opening, including every combat step, when an archive is requested. */
export function finishPublicEquipmentBattle(input: MatchState, history?: BattleHistory): MatchState {
  const started = startMatchCombat(input);
  let state = accepted(started);
  if (!started.ok) throw new Error(started.reason);
  observe(history, input, state, started.events, 'command');
  for (let tick = 0; tick < 1201 && state.phase === 'combat'; tick++) {
    const next = stepMatch(state);
    observe(history, state, next.state, next.events, 'tick');
    state = next.state;
  }
  if (state.phase !== 'settlement' && state.phase !== 'choice') {
    throw new Error(`Public B8 equipment fixture did not finish ${state.roundDefinitionId}: ${state.phase}`);
  }
  return state;
}

function choose(state: MatchState, definitionId: string): MatchState {
  const choice = state.pendingChoice;
  if (state.phase !== 'choice' || !choice) throw new Error(`Missing public choice in ${state.roundDefinitionId}`);
  return accepted(selectChoice(state, choice.choiceId, choice.generation, definitionId));
}

export function resolvePublicEquipmentChoices(input: MatchState, component = 'gloves'): MatchState {
  let state = input;
  while (state.phase === 'choice') {
    const choice = state.pendingChoice!;
    if (choice.kind === 'anomaly') throw new Error('Public equipment fixture does not select anomalies');
    const id = choice.kind === 'component' ? component
      : ['bulky-buddies-i', 'manaflow-i'].find(id => choice.offers.includes(id))
        ?? choice.offers.find(id => id !== 'placebo' && id !== 'glass-cannon-i')!;
    state = choose(state, id);
  }
  return state;
}

export function benchPublicEquipmentPlayers(input: MatchState): MatchState {
  let state = input;
  for (const unit of state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'board')) {
    const used = new Set(state.preparation.units.flatMap(unit => unit.location.kind === 'bench' ? [unit.location.slot] : []));
    const slot = Array.from({ length: state.preparation.benchSize }, (_, index) => index).find(index => !used.has(index));
    if (slot === undefined) throw new Error('Public B8 equipment fixture has no bench slot');
    state = accepted(deployMatchUnit(state, unit.id, { kind: 'bench', slot }));
  }
  return state;
}

function deployDrop(state: MatchState, definitionId: string, col: number): MatchState {
  const unit = state.preparation.units.find(unit => unit.team === 'player' && unit.definitionId === definitionId);
  if (!unit) throw new Error(`Public opening did not grant ${definitionId}`);
  return accepted(deployMatchUnit(state, unit.id, { kind: 'board', cell: { col, row: 7 } }));
}

const preparations = new Map<string, MatchState>();
/** All assets come from public opening kills and scheduled component choices.
 * One/two components return at 2-1; three/four return at 3-5. Items are still in
 * inventory and all players are benched. Cached snapshots are always detached.
 * Supplying history bypasses the cache so no opening event is omitted.
 */
export function publicEquipmentPreparation(components: readonly string[],
  options: { seed?: number; history?: BattleHistory } = {}): MatchState {
  if (!components.length || components.length > 4) throw new Error('Public equipment fixture requires one to four components');
  const seed = options.seed ?? 42, key = JSON.stringify([seed, components]);
  if (!options.history && preparations.has(key)) return structuredClone(preparations.get(key)!);
  let state = finishPublicEquipmentBattle(createMatch(seed), options.history);
  state = accepted(nextRound(state, state.round));
  state = deployDrop(state, 'maddie', 3);
  state = finishPublicEquipmentBattle(state, options.history);
  state = choose(state, components[0]);
  state = accepted(nextRound(state, state.round));
  state = deployDrop(state, 'lux', 5);
  state = finishPublicEquipmentBattle(state, options.history);
  state = choose(state, components[1] ?? 'sword');
  state = accepted(nextRound(state, state.round));
  state = benchPublicEquipmentPlayers(resolvePublicEquipmentChoices(state));
  if (components.length > 2) {
    while (state.roundDefinitionId !== '3-5') {
      if (state.phase === 'choice') state = resolvePublicEquipmentChoices(state,
        state.roundDefinitionId === '2-4' ? components[2] : components[3] ?? 'sword');
      if (state.phase === 'preparation') state = finishPublicEquipmentBattle(state, options.history);
      if (state.phase !== 'settlement') throw new Error(`Cannot advance public fixture from ${state.roundDefinitionId}/${state.phase}`);
      state = accepted(nextRound(state, state.round));
    }
  }
  if (!options.history) preparations.set(key, structuredClone(state));
  return state;
}
