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
