/** Visual timeline only. The server's cast event remains the sole gameplay fact. */
export interface TimelineCue {
  readonly system: string;
  readonly action?: 'cast' | 'attack';
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
/** Cast start attaches to caster, projectile flies to primary target, hit fans out to unique targets. */
export function mapSkillTimeline(cues: readonly TimelineCue[], sourceId: string, targets: readonly string[], castIndex = 0): TimelineSpawn[] {
  const unique = [...new Set(targets)].filter(id => id !== sourceId);
  return cues.filter(cue => cue.phase === undefined || cue.phase === castIndex % 3).flatMap(cue => cue.event === 'cast-start' ? [{ ...cue, sourceId }]
    : cue.event === 'projectile' || cue.primary ? unique.slice(0, 1).map(targetId => ({ ...cue, sourceId, targetId }))
    : unique.map(targetId => ({ ...cue, sourceId, targetId })));
}
/** Replacement is atomic: a missing/not-yet-loaded system keeps the entire old action.
 * Legacy callers know the two built-in timelines; catalogues explicitly register other champions. */
export function selectTimeline(champion: string, cues: readonly TimelineCue[] | undefined, ready: (id: string) => boolean, registered = ['jinx', 'vi'].includes(champion)): readonly TimelineCue[] | null {
  if (!registered || !cues?.length || cues.some(cue => !ready(cue.system))) return null;
  return cues;
}
