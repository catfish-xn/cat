/** Display staging overrides for reviewed asset bindings; all times are visual, never combat scheduling. */
export interface EffectPlayback { anchor: 'source' | 'target' | 'projectile'; bone?: string; delay: number; maxDuration: number }
export interface PlannedEffect { readonly id: string; readonly playback: EffectPlayback }
const RENATA = 'renata_tft13_renataglasc_base_e_';
export function planActionEffects(unit: string, action: 'attack' | 'cast', effects: readonly { id: string }[], playback: Readonly<Record<string, EffectPlayback>>): PlannedEffect[] {
  const plan = effects.map(({ id }) => ({ id, playback: playback[id] ?? { anchor: 'source' as const, delay: 0, maxDuration: 1 } }));
  if (unit !== 'renata' || action !== 'cast') return plan;
  // The procedural missile and ground ring own flight/area. Reuse only ignition and the short
  // textured target flash; stop the central ignition before launch. Side canister exports include duplicate projectile meshes.
  const staging: Record<string, EffectPlayback> = {
    cas_center: { anchor: 'source', bone: 'C_Canister', delay: 0.1, maxDuration: 0.2 },
    tar: { anchor: 'target', delay: 0.9, maxDuration: 0.35 },
  };
  return plan.flatMap(entry => {
    if (!entry.id.startsWith(RENATA)) return [entry];
    const spec = staging[entry.id.slice(RENATA.length)];
    return spec ? [{ id: entry.id, playback: spec }] : [];
  });
}

/**
 * An attack's asset effects timed by the rules' landing (attackLaunched) instead of their fixed delays: a projectile leaves at
 * its own delay and lands on the arrival, flying at least minFlight (its maxDuration is its flight); target-anchored effects (the
 * hit) start when it lands. A beam (0 s) plays its projectile and hit on the attack event. Without a projectile the plan is
 * returned as it is. Fitted, not original (the same rule as vfx-ltk landingCues).
 */
export function landingPlan(plan: readonly PlannedEffect[], landing: { readonly seconds: number; readonly beam?: boolean }, minFlight: number, beamFlight: number): PlannedEffect[] {
  if (!plan.some(entry => entry.playback.anchor === 'projectile')) return [...plan];
  const arrive = Math.max(0, landing.seconds);
  let lands = arrive;
  const moved = plan.map(entry => {
    if (entry.playback.anchor !== 'projectile') return entry;
    const delay = landing.beam ? arrive : entry.playback.delay, travel = landing.beam ? beamFlight : Math.max(minFlight, arrive - delay);
    lands = Math.max(lands, landing.beam ? arrive : delay + travel);
    return { id: entry.id, playback: { ...entry.playback, delay, maxDuration: travel } };
  });
  return moved.map(entry => entry.playback.anchor === 'target' ? { id: entry.id, playback: { ...entry.playback, delay: lands } } : entry);
}
