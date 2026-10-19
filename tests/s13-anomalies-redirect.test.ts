import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { validateG23State } from '../src/simulation/g2-3-combat';
import { packets } from './helpers/replay2-views';
it('a redirected One Thousand Cuts hit records one attack receipt and keeps30/42 damage progression without relaxing restoration', () => {
  const base = createMatch(42), preparation = { ...base.preparation, units: [
    { id: 'p', definitionId: 'lux', starLevel: 1 as const, team: 'player' as const, location: { kind: 'board' as const, cell: { col: 1, row: 4 } } },
    { id: 'e', definitionId: 'garen', starLevel: 3 as const, team: 'enemy' as const, location: { kind: 'board' as const, cell: { col: 1, row: 3 } } },
    { id: 'guard', definitionId: 'loris', starLevel: 3 as const, team: 'enemy' as const, location: { kind: 'board' as const, cell: { col: 2, row: 3 } } },
  ] };
  const strategy = buildStrategySnapshot({ ...base, preparation, anomalyBinding: { definitionId: 'one-thousand-cuts', unitId: 'p', choiceId: 'cuts', boundRound: 1 } });
  let state = createCombatWithEvents(preparation, strategy, 'p4-cuts').state;
  state = { ...state, units: state.units.map(u => ({ ...u, mana: u.id === 'guard' ? u.maxMana : 0, maxMana: u.id === 'guard' ? u.maxMana : 0,
    cooldownTicks: u.id === 'e' ? 1000 : 0, moveCooldownTicks: 1000 })) };
  const first = stepCombat(state); state = first.state;
  expect(packets(first.events).some(p => p.source.definitionId === 'one-thousand-cuts' && p.redirected)).toBe(true);
  expect(state.units.find(u => u.id === 'p')!.g23!.cuts).toEqual({ e: 1 });
  const second = stepCombat({ ...state, units: state.units.map(u => u.id === 'p' ? { ...u, cooldownTicks: 0 } : u) });
  expect(packets(first.events).filter(p => p.source.definitionId === 'one-thousand-cuts' && !p.redirected).map(p => p.raw)).toEqual([30]);
  expect(packets(second.events).filter(p => p.source.definitionId === 'one-thousand-cuts' && !p.redirected).map(p => p.raw)).toEqual([42]);
  const p = second.state.units.find(u => u.id === 'p')!;
  expect(p.runtime!.attackCount).toBe(2); expect(p.g23!.cuts).toEqual({ e: 2 });
  expect(() => validateG23State(p, second.state.units, second.state.tick, second.state.nextActionSeq!)).not.toThrow();
});
