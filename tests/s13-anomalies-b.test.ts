import { expect, it } from 'vitest';
import { stepCombat } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';
import { isPresent, isSelectable } from '../src/simulation/anomalies/availability';
import { P4_SOURCE } from '../src/simulation/anomalies/source';
import { startAnomaly, quiet } from './helpers/s13-anomalies';
import { vampRates } from '../src/simulation/m8/s13-mechanisms';
import type { S13Unit } from '../src/simulation/combat-s13-state';
import { packets } from './helpers/replay2-views';

it('Repulsor has 35% attack speed and knocks a nearby cast target outward by two hexes', () => {
  let state = startAnomaly('Repulsor');
  const initial = state.units.find(u => u.id === 'p')!;
  expect(initial.attackSpeedBonusBps).toBe(3500);
  state = { ...state, units: state.units.map(u => ({ ...u, mana: u.id === 'p' ? u.maxMana : 0, cooldownTicks: 1000, moveCooldownTicks: 1000 })) };
  const step = stepCombat(state), movement = step.events.find(e => e.type === 'movement' && e.unitId === 'e');
  expect(movement).toMatchObject({ from: { col: 1, row: 3 }, to: { col: 0, row: 1 } });
});
it('Diving In first cast stuns a radius of two for 1.5 seconds, grants 25% AS and 20% omnivamp once', () => {
  let state = quiet(startAnomaly('CertainDeath'));
  state = { ...state, units: state.units.map(u => u.id === 'p' ? { ...u, maxMana: 50, mana: 50 } : u) };
  const step = stepCombat(state); state = step.state;
  const p = state.units.find(u => u.id === 'p')!, e = state.units.find(u => u.id === 'e')!;
  expect(p.anomalyState?.firstCastTick).toBe(1);
  expect(e.statuses?.find(s => s.source.definitionId === P4_SOURCE.CertainDeath.id)).toMatchObject({ startsAtTick: 2, expiresAtTick: 32 });
  expect(p.baseAttackSpeedBps).toBe(7000);
  expect(readCombatStats(p, state).attackIntervalTicks).toBe(23); // ceil(20 / (0.7 * 1.25))
  expect(vampRates(p as S13Unit, p.hp).find(r => r.source.definitionId === P4_SOURCE.CertainDeath.id)?.bps).toBe(2000);
  const again = stepCombat({ ...state, units: state.units.map(u => u.id === 'p' ? { ...u, mana: u.maxMana } : u) });
  expect(again.state.units.find(u => u.id === 'p')!.anomalyState?.firstCastTick).toBe(1);
});
it('Dramatic Entrance is absent through tick119, returns at120 with 55% HP and a two-second team stun', () => {
  let state = quiet(startAnomaly('DramaticEntrance'));
  const initial = state.units.find(u => u.id === 'p')!;
  expect(isPresent(initial, 0)).toBe(false); expect(isSelectable(initial, 0)).toBe(false);
  for (let i = 0; i < 119; i++) state = stepCombat(state).state;
  expect(state.status).toBe('running'); expect(state.units.find(u => u.id === 'p')!.maxHp).toBe(500);
  const step = stepCombat(state); state = step.state;
  expect(state.units.find(u => u.id === 'p')).toMatchObject({ maxHp: 775, hp: 775, anomalyState: { enteredAtTick: 120 } });
  expect(state.units.find(u => u.id === 'e')!.statuses).toContainEqual(expect.objectContaining({ startsAtTick: 121, expiresAtTick: 161 }));
  expect(packets(step.events).filter(p => p.unitId === 'p')).toHaveLength(0);
});
it('Unstoppable Force credits an assist, charges the next target, stuns 30ticks and heals 10% HP once', () => {
  let state = quiet(startAnomaly('UnstoppableForce', 'lux', [
    { id: 'ally', definitionId: 'darius', starLevel: 1, team: 'player', location: { kind: 'board', cell: { col: 2, row: 4 } } },
    { id: 'next', definitionId: 'garen', starLevel: 3, team: 'enemy', location: { kind: 'board', cell: { col: 5, row: 0 } } },
  ]));
  state = { ...state, damageContributors: { e: ['p'] }, units: state.units.map(u => u.id === 'p' ? { ...u, hp: 300 }
    : u.id === 'e' ? { ...u, hp: 1 } : u.id === 'ally' ? { ...u, cooldownTicks: 0 } : u) };
  const step = stepCombat(state), p = step.state.units.find(u => u.id === 'p')!;
  expect(step.events.some(e => e.type === 'kill' && e.unitId === 'e')).toBe(true);
  expect(p.hp).toBe(350); expect(p.anomalyState?.takedowns).toEqual(['e']);
  expect(step.state.units.find(u => u.id === 'next')!.statuses).toContainEqual(expect.objectContaining({ startsAtTick: 2, expiresAtTick: 32 }));
  expect(step.events.some(e => e.type === 'movement' && e.unitId === 'p')).toBe(true);
});
it('availability keeps untargetable present and absence out of the same selection boundary', () => {
  const p = startAnomaly('Repulsor').units.find(u => u.id === 'p')!;
  expect(isPresent({ ...p, anomalyState: { invisibleUntilTick: 20 } }, 19)).toBe(true);
  expect(isSelectable({ ...p, anomalyState: { invisibleUntilTick: 20 } }, 19)).toBe(false);
  expect(isSelectable({ ...p, anomalyState: { invisibleUntilTick: 20 } }, 20)).toBe(true);
});
