import { expect, it } from 'vitest';
import { stepCombat } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';
import { startAnomaly, quiet } from './helpers/s13-anomalies';
import { orbitPoint } from '../src/simulation/anomalies/center-of-the-universe';
import { packets } from './helpers/replay2-views';
import { ORBIT_PARAMETERS } from '../src/simulation/anomalies/orbit-parameters';

it('Center of the Universe sweeps six separate stars for75magic per hit, rather than a once-per-second area pulse', () => {
  let state = quiet(startAnomaly('CenteroftheUniverse'));
  const hits: { tick: number; star: number; target: string; raw: number }[] = [];
  for (let i = 0; i < 40; i++) {
    const step = stepCombat(state); state = step.state;
    hits.push(...packets(step.events).filter(p => p.source.definitionId.endsWith('CenteroftheUniverse'))
      .map(p => ({ tick: p.tick, star: p.packetOrdinal, target: p.unitId, raw: p.raw })));
  }
  expect(hits[0]).toMatchObject({ tick: 1, raw: 75 });
  expect(new Set(hits.map(h => h.star)).size).toBe(6);
  expect(hits.every(h => h.raw === 75)).toBe(true);
  expect(hits.some(h => h.tick > 1 && h.tick < 20)).toBe(true);
  for (let i = 0; i < hits.length; i++) {
    const last = hits.slice(0, i).filter(h => h.star === hits[i].star && h.target === hits[i].target).at(-1);
    if (last) expect(hits[i].tick - last.tick).toBeGreaterThanOrEqual(4);
  }
  expect(ORBIT_PARAMETERS).toMatchObject({ classification: '项目约定', revolutionTicks: 32, phaseStepsPerTick: -3 });
});
it('the discrete orbit expands by250millihex/tick toward the current target and only hits its swept path', () => {
  let state = quiet(startAnomaly('CenteroftheUniverse'));
  state = { ...state, units: state.units.map(u => u.id === 'e' ? { ...u, cell: { col: 6, row: 0 } } : u) };
  const step = stepCombat(state); state = step.state;
  expect(state.units.find(u => u.id === 'p')!.anomalyState?.orbit?.radiusMilli).toBe(1250);
  expect(packets(step.events).filter(p => p.source.definitionId.endsWith('CenteroftheUniverse'))).toHaveLength(0);
  expect(orbitPoint({ col: 1, row: 4 }, 1000, 0)).toEqual({ q: 0, r: 4000 });
  expect(orbitPoint({ col: 1, row: 4 }, 1000, 16)).toEqual({ q: -1000, r: 5000 });
});
it('Mini Mees counts every third owner attack: three traced30% AD hits after10ticks, stacking permanent5armor reductions', () => {
  let state = quiet(startAnomaly('DeftHands'));
  const armor = readCombatStats(state.units.find(u => u.id === 'e')!, state).armor;
  const fire = () => {
    const step = stepCombat({ ...state, units: state.units.map(u => u.id === 'p' ? { ...u, cooldownTicks: 0 } : u) });
    state = step.state; return step;
  };
  expect(state.units.filter(u => u.anomalySummon?.kind === 'mini')).toHaveLength(3);
  fire(); fire();
  expect(state.units.filter(u => u.anomalySummon).every(u => !u.anomalyState?.pendingAttacks?.length)).toBe(true);
  fire();
  expect(state.units.find(u => u.id === 'p')!.runtime!.attackCount).toBe(3);
  for (const proxy of state.units.filter(u => u.anomalySummon))
    expect(proxy.anomalyState?.pendingAttacks).toEqual([{ targetId: 'e', executeAtTick: 13, rootActionSeq: 2, raw: 9 }]);
  state = quiet(state);
  const damage: number[] = [];
  for (let i = 0; i < 10; i++) {
    const step = stepCombat(state); state = step.state;
    damage.push(...packets(step.events).filter(p => p.source.definitionId.endsWith('DeftHands')).map(p => p.raw));
  }
  expect(damage).toEqual([9, 9, 9]);
  expect(readCombatStats(state.units.find(u => u.id === 'e')!, state).armor).toBe(armor - 15);
  const reductions = state.units.find(u => u.id === 'e')!.statuses!.filter(s => s.source.definitionId.endsWith('DeftHands'));
  expect(reductions.map(s => s.amount)).toEqual([-5, -5, -5]);
  expect(reductions.map(s => s.expiresAtTick)).toEqual([1201, 1201, 1201]);
  expect(state.units.find(u => u.id === 'p')!.runtime!.attackCount).toBe(3);
  expect(state.rngDraws).toBe(3);
});
it('Mini Mees never retargets a frozen projectile when its inherited target is dead or invisible', () => {
  let state = quiet(startAnomaly('DeftHands'));
  for (let i = 0; i < 3; i++) state = stepCombat({ ...state, units: state.units.map(u => u.id === 'p' ? { ...u, cooldownTicks: 0 } : u) }).state;
  state = quiet({ ...state, units: state.units.map(u => u.id === 'e' ? { ...u, anomalyState: { invisibleUntilTick: 100 } } : u) });
  const damage: number[] = [];
  for (let i = 0; i < 10; i++) {
    const step = stepCombat(state); state = step.state;
    damage.push(...packets(step.events).filter(p => p.source.definitionId.endsWith('DeftHands')).map(p => p.raw));
  }
  expect(damage).toEqual([]);
  expect(state.units.filter(u => u.anomalySummon).every(u => u.anomalyState?.pendingAttacks?.length === 0)).toBe(true);
});
