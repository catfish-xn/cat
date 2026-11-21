import { stepCombat, type CombatEvent, type CombatState } from '../../src/simulation/combat';

/**
 * Ranged attack landing (test windows only): one combat step, then on until every shot launched in that step has landed
 * (its attackLanded event). The shooters of that step are held (no further attack) meanwhile; everyone else acts as usual.
 * Returns the last state and every event of the window, in order. A step that launches no shot is just stepCombat.
 */
export function stepLanded(state: CombatState): { state: CombatState; events: CombatEvent[] } {
  let r = stepCombat(state);
  const events = [...r.events];
  const shots = r.events.filter(e => e.type === 'attackLaunched' && e.projectile === 'flight');
  const shooters = new Set(shots.map(e => e.type === 'attackLaunched' ? e.attackerId : ''));
  let landed = 0;
  while (landed < shots.length && r.state.status === 'running') {
    r = stepCombat({ ...r.state, units: r.state.units.map(u => shooters.has(u.id) ? { ...u, cooldownTicks: Math.max(u.cooldownTicks, 2000) } : u) });
    events.push(...r.events);
    landed += r.events.filter(e => e.type === 'attackLanded' && shooters.has(e.attackerId)).length;
  }
  return { state: r.state, events };
}
