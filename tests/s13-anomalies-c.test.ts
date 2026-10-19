import { expect, it } from 'vitest';
import { stepCombat } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';
import { startAnomaly, quiet } from './helpers/s13-anomalies';
import { isPresent, isSelectable } from '../src/simulation/anomalies/availability';
import { vampRates } from '../src/simulation/m8/s13-mechanisms';
import type { S13Unit } from '../src/simulation/combat-s13-state';
import { countsG23SurvivorDamage } from '../src/simulation/g2-3-summons';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { packets } from './helpers/replay2-views';

it('Invisibility every six seconds is unselectable for exactly20ticks and gives one guaranteed critical attack', () => {
  let state = quiet(startAnomaly('Invisibility'));
  for (let i = 0; i < 119; i++) state = stepCombat(state).state;
  state = { ...state, units: state.units.map(u => u.id === 'p' ? { ...u, cooldownTicks: 0 } : u) };
  const step = stepCombat(state); state = step.state;
  const p = state.units.find(u => u.id === 'p')!;
  expect(p.anomalyState).toMatchObject({ invisibleUntilTick: 140, critReady: false });
  expect(packets(step.events).filter(p => p.source.ownerId === 'p' && p.source.sourceKind === 'attack').map(p => p.critical)).toEqual([true]);
  expect(state.rngDraws).toBe(1); expect(isPresent(p, 120)).toBe(true);
  expect(isSelectable(p, 139)).toBe(false); expect(isSelectable(p, 140)).toBe(true);
  expect(state.units.find(u => u.id === 'e')!.targetId).toBeNull();
});
it('Last Chance intercepts the first death at full HP with50% AS/20% vamp, then loses12.5% maxHP each second', () => {
  let state = quiet(startAnomaly('EvenInDeath'));
  state = { ...state, units: state.units.map(u => u.id === 'p' ? { ...u, hp: 1 } : { ...u, cooldownTicks: 0 }) };
  let step = stepCombat(state); state = step.state;
  let p = state.units.find(u => u.id === 'p')!;
  expect(p).toMatchObject({ hp: 500, alive: true, anomalyState: { revivedAtTick: 1 } });
  expect(step.events.filter(e => e.type === 'unitRevived')).toHaveLength(1);
  expect(step.events.filter(e => e.type === 'death' && e.unitId === 'p')).toHaveLength(0);
  expect(readCombatStats(p, state).attackIntervalTicks).toBe(20);
  expect(vampRates(p as S13Unit, p.hp).find(r => r.source.definitionId.endsWith('EvenInDeath'))?.bps).toBe(2000);
  state = quiet(state);
  for (let i = 0; i < 20; i++) { step = stepCombat(state); state = step.state; }
  p = state.units.find(u => u.id === 'p')!;
  expect(p.hp).toBe(438); // floor(500*12.5%) =62, first loss at tick21.
  expect(packets(step.events).filter(p => p.source.definitionId.endsWith('EvenInDeath')).map(p => p.hpDamage)).toEqual([62]);
  state = { ...state, units: state.units.map(u => u.id === 'p' ? { ...u, hp: 1 } : { ...u, cooldownTicks: 0 }) };
  step = stepCombat(state);
  expect(step.state.units.find(u => u.id === 'p')!.alive).toBe(false);
  expect(step.events.filter(e => e.type === 'unitRevived')).toHaveLength(0);
});
it('Scuttle Familiar spawns once with100% resolved HP/armor/MR and a membership event before elimination', () => {
  let state = quiet(startAnomaly('ScuttleFamiliar'));
  state = { ...state, units: state.units.map(u => u.id === 'p' ? { ...u, hp: 1 } : { ...u, cooldownTicks: 0 }) };
  const step = stepCombat(state), crab = step.state.units.find(u => u.anomalySummon?.kind === 'crab')!;
  expect(crab).toMatchObject({ hp: 500, maxHp: 500, armor: 20, magicResist: 20, anomalySummon: { ownerId: 'p', bornAtTick: 1 } });
  expect(step.events.filter(e => e.type === 'unitSpawned')).toHaveLength(1);
  expect(step.state.status).toBe('running'); expect(countsG23SurvivorDamage(crab)).toBe(false);
  expect(UNIT_DEFINITIONS[crab.definitionId]).toMatchObject({ traits: [], summon: { countsTowardPopulation: false } });
  const next = stepCombat(step.state);
  expect(next.events.filter(e => e.type === 'unitSpawned')).toHaveLength(0);
});
it('two untargetable wolves attack at1.0AS for50% owner AD using derived streams, then disappear with owner', () => {
  let state = startAnomaly('WolfFamiliars');
  const wolves = state.units.filter(u => u.anomalySummon?.kind === 'wolf');
  expect(wolves).toHaveLength(2);
  for (const w of wolves) {
    expect(w.baseAttackSpeedBps).toBe(10000); expect(isSelectable(w, 0)).toBe(false);
    expect(countsG23SurvivorDamage(w)).toBe(false); expect(UNIT_DEFINITIONS[w.definitionId].traits).toEqual([]);
  }
  state = { ...state, units: state.units.map(u => u.anomalySummon ? u : { ...u, mana: 0, maxMana: 0, cooldownTicks: 1000, moveCooldownTicks: 1000 }) };
  const seed = state.rngState, step = stepCombat(state); state = step.state;
  expect(packets(step.events).filter(p => p.source.definitionId.endsWith('WolfFamiliars')).map(p => p.raw)).toEqual([15, 15]);
  expect(state.rngState).toBe(seed); expect(state.rngDraws).toBe(0);
  expect(state.units.filter(u => u.anomalySummon).map(u => u.anomalyState!.attackStream!.draws)).toEqual([1, 1]);
  for (let i = 0; i < 20; i++) state = stepCombat(state).state;
  expect(state.units.filter(u => u.anomalySummon).map(u => u.anomalyState!.attackStream!.draws)).toEqual([2, 2]);
  const ended = stepCombat({ ...state, units: state.units.map(u => u.id === 'p' ? { ...u, hp: 1 } : u.id === 'e' ? { ...u, cooldownTicks: 0 } : u) });
  expect(ended.events.filter(e => e.type === 'unitRemoved')).toHaveLength(2);
  expect(ended.state.units.filter(u => u.anomalySummon)).toHaveLength(0);
});
it('Hunger for Power freezes donor values and ID tie-breaks; consuming does not change preparation or frozen traits', () => {
  const state = startAnomaly('HungerForPower', 'lux', [
    { id: 'a', definitionId: 'darius', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 0, row: 4 } } },
    { id: 'z', definitionId: 'tristana', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 2, row: 4 } } },
  ]), p = state.units.find(u => u.id === 'p')!;
  expect(p.anomalyState?.consumed).toEqual({ unitId: 'a', health: 360, attackDamage: 33 });
  expect(p.maxHp).toBe(860); expect(readCombatStats(p, state).attackDamage).toBe(63);
  expect(state.units.find(u => u.id === 'a')).toMatchObject({ hp: 0, alive: false });
  expect(state.strategy!.traits.find(t => t.traitId === 'conqueror' && t.team === 'player')!.count).toBe(1);
});
