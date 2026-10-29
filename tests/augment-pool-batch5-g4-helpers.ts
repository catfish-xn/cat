import { createMatch, type MatchState } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { freezeCombatInput, readCombatStrategyInputs } from '../src/simulation/combat-input';
import { createCombatWithEvents } from '../src/simulation/combat';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import type { S13Unit } from '../src/simulation/combat-s13-state';

/** Deliberately small combat vectors, separate from the real room's command/ledger tests. */
export function voidFixture(round = 4, ids = ['voidcaller'], portals = 0) {
  const base = createMatch(0), hero = base.preparation.units[0];
  const state = { ...base, round, augments: ids.map(definitionId => ({ definitionId, choiceId: `fixture:${definitionId}`, acquiredRound: 4 })),
    items: Array.from({length:portals},(_,i)=>({id:`portal-${i}`,definitionId:'TFT5_Item_ZzRotPortalRadiant',location:{kind:'unit',unitId:i%2?'morgana':'rell',slot:0}})),
    preparation: { ...base.preparation, units: [
      { ...hero, id: 'rell', definitionId: 'rell', team: 'player', location: { kind: 'board', cell: { col: 3, row: 4 } } },
      { ...hero, id: 'morgana', definitionId: 'morgana', team: 'player', location: { kind: 'board', cell: { col: 4, row: 5 } } },
      { ...hero, id: 'enemy', definitionId: 'training-dummy', team: 'enemy', location: { kind: 'board', cell: { col: 3, row: 2 } } },
    ] } } as MatchState;
  const inputs = readCombatStrategyInputs(state), compiled = buildStrategySnapshot(inputs);
  // Trusted numerical vector: a stationary 20000-HP target leaves time for actual cast costs to accumulate.
  const strategy = { ...compiled, units: compiled.units.map(u => u.unitId === 'enemy' ? { ...u, stats: { ...u.stats, health: 20000 } } : u) };
  const basis = freezeCombatInput(state, 17, state.resourceProvenance.entries.length);
  const initial = createCombatWithEvents(state.preparation, strategy, basis.combatId, 17);
  const units = structuredClone(initial.state.units) as S13Unit[];
  const ctx: AbilityContext = { tick: 1, combatId: basis.combatId, board: state.preparation.board, units,
    events: [], packets: [], heals: [], draw: () => { throw new Error('Void summon must not draw RNG'); } };
  return { state, inputs, strategy, basis, initial, ctx, rell: units.find(u => u.id === 'rell')!, morgana: units.find(u => u.id === 'morgana')! };
}
