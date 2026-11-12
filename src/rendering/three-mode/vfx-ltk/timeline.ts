/** Visual timeline only. The server's cast event remains the sole gameplay fact. */
export type TimelineAction = 'cast' | 'attack' | 'passive' | 'end';
export type TimelineVariant = 'empowered' | 'self';
export interface TimelineCue {
  readonly system: string;
  readonly action?: TimelineAction;
  /** Observed presentation form; untagged cues belong only to the default form. */
  readonly variant?: TimelineVariant;
  readonly event: 'cast-start' | 'projectile' | 'hit' | 'link';
  readonly delay: number;
  readonly duration: number;
  readonly bone?: string;
  readonly targetBone?: string;
  /** The rule's branch for this cast (cast event `branch`, written where the rule picks it); a branched cue plays only when the cast names it. */
  readonly branch?: string;
  /** Zero-based cast rotation, selected from observed cast events, including catch-up events. */
  readonly phase?: 0 | 1 | 2;
  readonly primary?: boolean;
  readonly travelSeconds?: number;
  /** Soft stop emission and let existing particles linger until duration. */
  readonly stopAfter?: number;
  /**
   * With `stopAfter`: from the stop, ease the cue's particles to nothing by `duration` instead of the cue cutting them
   * off at full strength (11-07: Zyra's long-lived single-particle roots never reach their own authored fade).
   */
  readonly fadeOut?: boolean;
  /** The skill's own body, kept like an impact though it plays on the caster (Nunu's cloud on himself). */
  readonly main?: boolean;
  /** A single world point supplied by the board, never an invented unit target. */
  readonly location?: 'board';
  /** Fan out projectiles/impacts only to this many actual receipt targets. */
  readonly targetLimit?: number;
  /** Only the receipt targets after the primary one (Zyra's short vines reach the others, not the one already rooted). */
  readonly others?: boolean;
  /** A beam keeps its source bone while aiming at the actual target; it does not fly. */
  readonly stationary?: boolean;
  /**
   * Uniform size of this system about its anchor. Omitted means 1.
   *
   * Multiplies the system's own offsets, particle size and velocity. It does not move the
   * anchor, a hanger, a projectile's endpoints or its flight path, and it does not change
   * `FX_SCALE`.
   */
  readonly scale?: number;
  /**
   * A target cue the cast can do without: with no living recipient it is left out instead of
   * refusing the whole plan (Darius's spin with nobody adjacent, Nunu's cloud whose receipt names no one).
   */
  readonly optional?: boolean;
  /**
   * Emitters of the system this cue leaves undrawn, by name (at most 8): the same system shown without a part another
   * cue covers (a Sevika spell's right reel under the rolled mod, which the mod's own layer draws there).
   */
  readonly hide?: readonly string[];
  /**
   * A cast-start buff that a recast refreshes rather than stacks: when this cue starts while the same system from the
   * same source still runs, that run is retired at once and this one takes its place (Mordekaiser's empower aura).
   */
  readonly refresh?: boolean;
}
export type WorldPoint = readonly [number, number, number];
export interface TimelineSpawn extends TimelineCue {
  readonly sourceId: string; readonly targetId?: string; readonly point?: WorldPoint;
  /** A cast-start's primary target other than the caster: the way the cast faces, though the model may still be turning. */
  readonly aimId?: string;
}
export interface TimelineMapping {
  readonly spawns: readonly TimelineSpawn[];
  /** A partial plan is diagnostic only; never enqueue it or suppress the old action. */
  readonly unsupported: readonly { cue: TimelineCue; reason: 'missing-target' | 'self-projectile' | 'missing-point' }[];
}
/** Hits preserve authoritative self/ally targets. Projectiles need a distinct primary
 * endpoint; never skip self and silently retarget to a later member of the list. */
export function mapSkillTimeline(cues: readonly TimelineCue[], sourceId: string, targets: readonly string[], castIndex = 0, board?: WorldPoint): TimelineMapping {
  const unique = [...new Set(targets)], spawns: TimelineSpawn[] = [];
  const unsupported: { cue: TimelineCue; reason: 'missing-target' | 'self-projectile' | 'missing-point' }[] = [];
  for (const cue of cues) {
    if (cue.phase !== undefined && cue.phase !== castIndex % 3) continue;
    if (cue.location === 'board') {
      if (!board || board.some(n => !Number.isFinite(n))) unsupported.push({ cue, reason: 'missing-point' });
      else spawns.push({ ...cue, sourceId, point: board });
      continue;
    }
    if (cue.event === 'cast-start') { spawns.push({ ...cue, sourceId, ...(unique[0] !== undefined && unique[0] !== sourceId ? { aimId: unique[0] } : {}) }); continue; }
    if (!unique.length) { if (!cue.optional) unsupported.push({ cue, reason: 'missing-target' }); continue; }
    if (cue.event === 'projectile' && unique[0] === sourceId) {
      if (cue.optional) continue;
      unsupported.push({ cue, reason: 'self-projectile' }); continue;
    }
    const pool = cue.others ? unique.slice(1) : unique;
    if (!pool.length) { if (!cue.optional) unsupported.push({ cue, reason: 'missing-target' }); continue; }
    for (const targetId of cue.primary ? pool.slice(0, 1) : cue.targetLimit ? pool.slice(0, cue.targetLimit) : cue.event === 'projectile' ? pool.slice(0, 1) : pool) {
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
