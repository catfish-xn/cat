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
  let expected = shots.length, landed = 0;
  while ((landed < expected || winding.size > 0) && r.state.status === 'running') {
    r = stepCombat({ ...r.state, units: r.state.units.map(u => shooters.has(u.id) ? { ...u, cooldownTicks: Math.max(u.cooldownTicks, 2000) } : u) });
    events.push(...r.events);
    // A wound-up attack launches one shot per target it hits (each its own landing), on its launch tick.
    for (const id of [...winding]) {
      const launched = r.events.filter(e => e.type === 'attackLaunched' && e.attackerId === id);
      if (launched.length) { winding.delete(id); shooters.add(id); expected += launched.filter(e => e.type === 'attackLaunched' && e.projectile === 'flight').length; }
      else if (r.events.some(e => e.type === 'attackWindupCancelled' && e.attackerId === id)) winding.delete(id);
    }
    landed += r.events.filter(e => e.type === 'attackLanded' && shooters.has(e.attackerId)).length;
  }
  return { state: r.state, events };
}
