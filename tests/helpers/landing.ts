import { stepCombat, type CombatEvent, type CombatState } from '../../src/simulation/combat';

/**
 * Ranged attack landing (test windows only): one combat step, then on until every shot launched in that step has landed
 * (its attackLanded event). The shooters of that step are held (no further attack) meanwhile; everyone else acts as usual.
 * Returns the last state and every event of the window, in order. A step that launches no shot (and starts no wind-up) is just
 * stepCombat.
 */
export function stepLanded(state: CombatState): { state: CombatState; events: CombatEvent[] } {
  let r = stepCombat(state);
  const events = [...r.events];
  // Ranged attack wind-up (#791): an attack that starts winding up in this step launches its shot later; wait for that launch
  // too (unless the wind-up is cancelled), then for the landing, as for a shot launched in this step.
  const winding = new Set(r.events.flatMap(e => e.type === 'attackWindup' ? [e.attackerId] : []));
  const shots = r.events.filter(e => e.type === 'attackLaunched' && e.projectile === 'flight');
  const shooters = new Set(shots.map(e => e.type === 'attackLaunched' ? e.attackerId : ''));
  let expected = shots.length + winding.size, landed = 0;
  while (landed < expected && r.state.status === 'running') {
    r = stepCombat({ ...r.state, units: r.state.units.map(u => shooters.has(u.id) ? { ...u, cooldownTicks: Math.max(u.cooldownTicks, 2000) } : u) });
    events.push(...r.events);
    for (const e of r.events) {
      if (e.type === 'attackLaunched' && winding.has(e.attackerId)) { winding.delete(e.attackerId); shooters.add(e.attackerId); if (e.projectile !== 'flight') expected--; }
      if (e.type === 'attackWindupCancelled' && winding.has(e.attackerId)) { winding.delete(e.attackerId); expected--; }
    }
    landed += r.events.filter(e => e.type === 'attackLanded' && shooters.has(e.attackerId)).length;
  }
  return { state: r.state, events };
}
