/** Display staging overrides for reviewed asset bindings; all times are visual, never combat scheduling. */
export interface EffectPlayback { anchor: 'source' | 'target' | 'projectile'; bone?: string; delay: number; maxDuration: number }
export interface PlannedEffect { readonly id: string; readonly playback: EffectPlayback }
const RENATA = 'renata_tft13_renataglasc_base_e_';
export function planActionEffects(unit: string, action: 'attack' | 'cast', effects: readonly { id: string }[], playback: Readonly<Record<string, EffectPlayback>>): PlannedEffect[] {
  const plan = effects.map(({ id }) => ({ id, playback: playback[id] ?? { anchor: 'source' as const, delay: 0, maxDuration: 1 } }));
  if (unit !== 'renata' || action !== 'cast' || !effects.some(e => e.id === `${RENATA}mis_child_01`)) return plan;
  // The extracted sidecar independently launched a parent missile AND its child down the same center line.
  // The child contains the textured head, meshes and trails. Launch that visual once from each real canister,
  // converging at the target at .9s, when the sidecar's target flash begins. Keep the cast and impact assets.
  return plan.flatMap(entry => entry.id === `${RENATA}mis` ? [] : entry.id === `${RENATA}mis_child_01`
    ? ['L_Canister', 'R_Canister'].map(bone => ({ id: entry.id, playback: { anchor: 'projectile' as const, bone, delay: 0.3, maxDuration: 0.6 } }))
    : [entry]);
}
