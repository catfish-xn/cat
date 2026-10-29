/** Visual timeline only. The server's cast event remains the sole gameplay fact. */
export type TimelineAction = 'cast' | 'attack' | 'passive' | 'end';
export type TimelineVariant = 'empowered' | 'self';
export interface TimelineCue {
  readonly system: string;
  readonly action?: TimelineAction;
  /** Observed presentation form; untagged cues belong only to the default form. */
  readonly variant?: TimelineVariant;
  readonly event: 'cast-start' | 'projectile' | 'hit';
  readonly delay: number;
  readonly duration: number;
  readonly bone?: string;
  readonly targetBone?: string;
  /** Zero-based cast rotation, selected from observed cast events, including catch-up events. */
  readonly phase?: 0 | 1 | 2;
  readonly primary?: boolean;
  readonly travelSeconds?: number;
  /** Soft stop emission and let existing particles linger until duration. */
  readonly stopAfter?: number;
}
export interface TimelineSpawn extends TimelineCue { readonly sourceId: string; readonly targetId?: string }
export interface TimelineMapping {
  readonly spawns: readonly TimelineSpawn[];
  /** A partial plan is diagnostic only; never enqueue it or suppress the old action. */
  readonly unsupported: readonly { cue: TimelineCue; reason: 'missing-target' | 'self-projectile' }[];
}
/** Hits preserve authoritative self/ally targets. Projectiles need a distinct primary
 * endpoint; never skip self and silently retarget to a later member of the list. */
export function mapSkillTimeline(cues: readonly TimelineCue[], sourceId: string, targets: readonly string[], castIndex = 0): TimelineMapping {
  const unique = [...new Set(targets)], spawns: TimelineSpawn[] = [];
  const unsupported: { cue: TimelineCue; reason: 'missing-target' | 'self-projectile' }[] = [];
  for (const cue of cues) {
    if (cue.phase !== undefined && cue.phase !== castIndex % 3) continue;
    if (cue.event === 'cast-start') { spawns.push({ ...cue, sourceId }); continue; }
    if (!unique.length) { unsupported.push({ cue, reason: 'missing-target' }); continue; }
    if (cue.event === 'projectile' && unique[0] === sourceId) {
      unsupported.push({ cue, reason: 'self-projectile' }); continue;
    }
    for (const targetId of cue.event === 'projectile' || cue.primary ? unique.slice(0, 1) : unique) {
      spawns.push({ ...cue, sourceId, targetId });
    }
  }
  return { spawns, unsupported };
}
/** Replacement is atomic: a missing/not-yet-loaded system keeps the entire old action.
 * Legacy callers know the two built-in timelines; catalogues explicitly register other champions. */
export function selectTimeline(champion: string, cues: readonly TimelineCue[] | undefined, ready: (id: string) => boolean, registered = ['jinx', 'vi'].includes(champion)): readonly TimelineCue[] | null {
  if (!registered || !cues?.length || cues.some(cue => !ready(cue.system))) return null;
  return cues;
}
