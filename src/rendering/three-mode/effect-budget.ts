/** Which simultaneous visuals may be dropped when the board is already full. Presentation only. */
export type EffectImportance = 'critical' | 'decorative' | 'attack';

/** A cast-start on the caster lasting at least this long is the skill's body (channel, shield, aura), not a short windup flash. */
export const CAST_BODY_SECONDS = 1;

/**
 * Damage, projectiles, beams, impacts, ground areas and sustained cast bodies stay. A short caster flourish (cast windup
 * on the source under `CAST_BODY_SECONDS`) is decorative and is the first thing removed to make room.
 */
export function effectImportance(cue: { event?: string; anchor?: string; location?: string; action?: string; variant?: string; main?: boolean; duration?: number }): EffectImportance {
  // 11-06 field recording: every unit's basic-attack hit filled the board's slots, so skill bodies on the caster never got in.
  // An empowered attack (Nocturne, Twitch) is the skill showing, so it keeps the usual ranks.
  if (cue.action === 'attack' && !cue.variant) return 'attack';
  if (cue.event === 'hit' || cue.event === 'projectile' || cue.event === 'link') return 'critical';
  // The skill's body on the caster (d650fcf2 field: Nunu's cloud was dropped as a flourish while decorative ones held the slots).
  if (cue.main) return 'critical';
  if (cue.event === 'cast-start' && (cue.action ?? 'cast') === 'cast' && (cue.duration ?? 0) >= CAST_BODY_SECONDS) return 'critical';
  if (cue.anchor === 'target' || cue.anchor === 'projectile') return 'critical';
  // A board-located cue is the skill's area on the ground (slam, settlement), not a flourish.
  if (cue.location === 'board') return 'critical';
  return 'decorative';
}

/**
 * `full` means every live slot is taken. Any skill newcomer first replaces the earliest plain attack;
 * a critical one may otherwise replace the earliest decorative slot. A decorative newcomer waits outside: it never displaces damage or control feedback.
 * `evict` is an index into `live`, or -1 when nothing is removed.
 */
export function admitEffect(live: readonly EffectImportance[], incoming: EffectImportance, full: boolean): { admit: boolean; evict: number } {
  if (!full) return { admit: true, evict: -1 };
  // A basic-attack visual is the lowest rank: any skill visual replaces the earliest one, and it never displaces anything.
  if (incoming === 'attack') return { admit: false, evict: -1 };
  let evict = live.indexOf('attack');
  if (evict < 0 && incoming === 'critical') evict = live.indexOf('decorative');
  return evict < 0 ? { admit: false, evict: -1 } : { admit: true, evict };
}
