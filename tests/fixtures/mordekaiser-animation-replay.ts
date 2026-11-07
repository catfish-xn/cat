import { createMatch } from '../../src/simulation/match';
import { buildStrategySnapshot } from '../../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState } from '../../src/simulation/combat';
import { toLedgerEvents } from '../../src/simulation/combat-ledger';
import { toCombatViewEvents } from '../../src/simulation/combat-replay-view';

/** Real seed-42 events; a durable, inactive opponent keeps the visual regression observable. */
export function mordekaiserAnimationReplay() {
  const base = createMatch(42);
  const match = { ...base, preparation: { ...base.preparation, units: [
    { id: 'a', definitionId: 'mordekaiser', starLevel: 1 as const, team: 'player' as const,
      location: { kind: 'board' as const, cell: { col: 1, row: 3 } } },
    { id: 'target', definitionId: 'garen', starLevel: 3 as const, team: 'enemy' as const,
      location: { kind: 'board' as const, cell: { col: 2, row: 3 } } },
  ] } };
  const initial = createCombatWithEvents(match.preparation, buildStrategySnapshot(match), 'morde-animation-42', 42).state;
  let state: CombatState = { ...initial, units: initial.units.map(unit => unit.id === 'a' ? { ...unit, mana: unit.maxMana }
    : { ...unit, hp: 100_000, maxHp: 100_000, cooldownTicks: 10_000, attackDamage: 0 }) };
  const ticks = [];
  for (let i = 0; i < 240 && state.status === 'running'; i++) {
    const next = stepCombat(state);
    state = next.state;
    ticks.push({ tick: state.tick, events: toCombatViewEvents(toLedgerEvents(next.events)) });
  }
  return ticks;
}
