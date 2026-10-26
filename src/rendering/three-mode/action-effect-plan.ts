/** Display staging overrides for reviewed asset bindings; all times are visual, never combat scheduling. */
export interface EffectPlayback { anchor: 'source' | 'target' | 'projectile'; bone?: string; delay: number; maxDuration: number }
export interface PlannedEffect { readonly id: string; readonly playback: EffectPlayback }
const RENATA = 'renata_tft13_renataglasc_base_e_';
export function planActionEffects(unit: string, action: 'attack' | 'cast', effects: readonly { id: string }[], playback: Readonly<Record<string, EffectPlayback>>): PlannedEffect[] {
  const plan = effects.map(({ id }) => ({ id, playback: playback[id] ?? { anchor: 'source' as const, delay: 0, maxDuration: 1 } }));
  // This buff export contains long, fixed-direction ground rays (including the pink honey strip),
  // not a world-history trail. Playing it at a stationary target snapshot paints a broad stripe
  // toward the camera even when neither unit moves. Keep the missile and activation flash;
  // omit this directional layer until we can stage it with its intended host motion/orientation.
  // Apply before skill-feel trimming so ?skillfx=off and shader prewarm use the same safe plan.
  if (unit === 'singed' && action === 'cast') return plan.filter(entry => entry.id !== 'singed_tft13_singed_base_w_ally_buf');
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
