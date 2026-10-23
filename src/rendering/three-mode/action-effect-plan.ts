/** Display staging overrides for reviewed asset bindings; all times are visual, never combat scheduling. */
export interface EffectPlayback { anchor: 'source' | 'target' | 'projectile'; bone?: string; delay: number; maxDuration: number }
export interface PlannedEffect { readonly id: string; readonly playback: EffectPlayback }
const RENATA = 'renata_tft13_renataglasc_base_e_';
export function planActionEffects(unit: string, action: 'attack' | 'cast', effects: readonly { id: string }[], playback: Readonly<Record<string, EffectPlayback>>): PlannedEffect[] {
  const plan = effects.map(({ id }) => ({ id, playback: playback[id] ?? { anchor: 'source' as const, delay: 0, maxDuration: 1 } }));
  if (unit !== 'renata' || action !== 'cast' || !effects.some(e => e.id === `${RENATA}mis_child_01`)) return plan;
  // Reference frames show one readable purple projectile, not two separated flight paths. Keep both canister
  // ignition assets, but launch the textured child once from the centre. Never also launch its parent.
  return plan.flatMap(entry => entry.id === `${RENATA}mis` ? [] : entry.id === `${RENATA}mis_child_01`
    ? [{ id: entry.id, playback: { anchor: 'projectile' as const, bone: 'C_Canister', delay: 0.3, maxDuration: 0.6 } }]
    : entry.id === `${RENATA}aoe` ? [{ id: entry.id, playback: { anchor: 'target' as const, delay: 0.9, maxDuration: 1 } }] : [entry]);
}
