/** Which simultaneous visuals may be dropped when the board is already full. Presentation only. */
export type EffectImportance = 'critical' | 'body' | 'decorative' | 'attack';

/** A cast-start on the caster lasting at least this long is the skill's body (channel, shield, aura), not a short windup flash. */
export const CAST_BODY_SECONDS = 1;

/** Seconds a skill body must have played before an incoming critical visual may evict the oldest one. */
export const BODY_YIELD_SECONDS = 1;
/**
 * Share of its own duration a skill body must also have played before it yields (9d7cd268 brawl: a 3.3 s Nunu cloud
 * and Irelia's stance were cut at 1.06 s). A 1–1.4 s body still yields at `BODY_YIELD_SECONDS`.
 */
export const BODY_YIELD_SHARE = 0.7;

/**
 * Damage, projectiles, beams, impacts, ground areas and sustained cast bodies stay. A short caster flourish (cast windup
 * on the source under `CAST_BODY_SECONDS`) is decorative and is the first thing removed to make room.
 */
export function effectImportance(cue: { event?: string; anchor?: string; location?: string; action?: string; variant?: string; main?: boolean; rank?: 'body'; duration?: number }): EffectImportance {
  // 11-06 field recording: every unit's basic-attack hit filled the board's slots, so skill bodies on the caster never got in.
  // An empowered attack (Nocturne, Twitch) is the skill showing, so it keeps the usual ranks.
  if (cue.action === 'attack' && !cue.variant) return 'attack';
  // A decided lower rank (TimelineCue.rank: Steb's frequent heal share) holds before the impact rule.
  if (cue.rank) return cue.rank;
  if (cue.event === 'hit' || cue.event === 'projectile' || cue.event === 'link') return 'critical';
  // The skill's body on the caster (d650fcf2 field: Nunu's cloud was dropped as a flourish while decorative ones held the slots).
  if (cue.main) return 'body';
  if (cue.event === 'cast-start' && (cue.action ?? 'cast') === 'cast' && (cue.duration ?? 0) >= CAST_BODY_SECONDS) return 'body';
  if (cue.anchor === 'target' || cue.anchor === 'projectile') return 'critical';
  // A board-located cue is the skill's area on the ground (slam, settlement), not a flourish.
  if (cue.location === 'board') return 'critical';
  return 'decorative';
}

/**
 * `full` means every live slot is taken. Any skill newcomer first replaces the earliest plain attack;
 * a critical or body one may otherwise replace the earliest decorative slot; a critical one may finally
 * replace the oldest body that has played at least `BODY_YIELD_SECONDS` and `BODY_YIELD_SHARE` of its `spans` entry
 * (its duration; omitted means no share is required). A decorative newcomer waits outside:
 * it never displaces damage, control feedback or a skill body.
 * `evict` is an index into `live`, or -1 when nothing is removed.
 */
export function admitEffect(live: readonly EffectImportance[], incoming: EffectImportance, full: boolean, ages?: readonly number[], spans?: readonly number[]): { admit: boolean; evict: number } {
  if (!full) return { admit: true, evict: -1 };
  // A basic-attack visual is the lowest rank: any skill visual replaces the earliest one, and it never displaces anything.
  if (incoming === 'attack') return { admit: false, evict: -1 };
  let evict = live.indexOf('attack');
  if (evict < 0 && (incoming === 'critical' || incoming === 'body')) evict = live.indexOf('decorative');
  if (evict < 0 && incoming === 'critical') {
    let oldest = -Infinity;
    for (let i = 0; i < live.length; i++) {
      if (live[i] !== 'body') continue;
      const age = ages?.[i] ?? 0;
      const due = Math.max(BODY_YIELD_SECONDS, BODY_YIELD_SHARE * (spans?.[i] ?? 0));
      if (age >= due && age > oldest) { oldest = age; evict = i; }
    }
  }
  return evict < 0 ? { admit: false, evict: -1 } : { admit: true, evict };
}
