/** Which simultaneous visuals may be dropped when the board is already full. Presentation only. */
export type EffectImportance = 'critical' | 'decorative';

/**
 * Damage, projectiles, beams, impacts and ground areas stay. A caster flourish (cast windup
 * on the source) is decorative and is the first thing removed to make room.
 */
export function effectImportance(cue: { event?: string; anchor?: string; location?: string }): EffectImportance {
  if (cue.event === 'hit' || cue.event === 'projectile' || cue.event === 'link') return 'critical';
  if (cue.anchor === 'target' || cue.anchor === 'projectile') return 'critical';
  // A board-located cue is the skill's area on the ground (slam, settlement), not a flourish.
  if (cue.location === 'board') return 'critical';
  return 'decorative';
}

/**
 * `full` means every live slot is taken. A critical newcomer may replace the earliest decorative
 * slot. A decorative newcomer waits outside: it never displaces damage or control feedback.
 * `evict` is an index into `live`, or -1 when nothing is removed.
 */
export function admitEffect(live: readonly EffectImportance[], incoming: EffectImportance, full: boolean): { admit: boolean; evict: number } {
  if (!full) return { admit: true, evict: -1 };
  if (incoming !== 'critical') return { admit: false, evict: -1 };
  const evict = live.indexOf('decorative');
  return evict < 0 ? { admit: false, evict: -1 } : { admit: true, evict };
}
