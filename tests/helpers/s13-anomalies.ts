import { createMatch } from '../../src/simulation/match';
import { createCombatWithEvents, type CombatState } from '../../src/simulation/combat';
import { buildStrategySnapshot } from '../../src/simulation/strategy-snapshot';
import type { Unit } from '../../src/simulation/unit-types';
export const anomalyId = (suffix: string): string => 'TFT13_GoopBuff_' + suffix;
export function startAnomaly(suffix: string, definitionId = 'lux', extra: Unit[] = []): CombatState {
  const base = createMatch(42), preparation = { ...base.preparation, units: [
    { id: 'p', definitionId, starLevel: 1 as const, team: 'player' as const, location: { kind: 'board' as const, cell: { col: 1, row: 4 } } },
    { id: 'e', definitionId: 'garen', starLevel: 3 as const, team: 'enemy' as const, location: { kind: 'board' as const, cell: { col: 1, row: 3 } } }, ...extra] };
  const strategy = buildStrategySnapshot({ ...base, preparation, anomalyBinding: { definitionId: anomalyId(suffix), unitId: 'p', choiceId: 'test', boundRound: 1 } });
  return createCombatWithEvents(preparation, strategy, 'p4-anomaly').state;
}
export function quiet(state: CombatState): CombatState {
  return { ...state, units: state.units.map(u => ({ ...u, cooldownTicks: 1000, moveCooldownTicks: 1000, mana: 0, maxMana: 0 })) };
}
