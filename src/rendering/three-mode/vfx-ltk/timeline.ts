/** The chest locator: 14.24 basic attacks hit here (BasicAttack mHitBoneName), and their missiles fly to it. */
export const CHEST = 'C_BUFFBONE_GLB_CHEST_LOC';
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
   * A projectile that arcs as its missile data says: a gravity height solver (units/s², the spell's heightSolver) and
   * the height added to the aimed point (mOffsetInitialTargetHeight). It still lands after travelSeconds.
   */
  readonly arc?: { readonly gravity: number; readonly targetOffset: number };
  /**
   * A projectile whose caster is its own target still flies (from its bone to its own targetBone), instead of being left
   * out with its landing hits moved to its release (the default for a self-projectile). Off unless set per cue.
   */
  readonly selfFlight?: boolean;
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
  /**
   * A projectile that starts where its target stands and runs along the board row (world X) to `rowCells` cells on the
   * `rowSide` side, instead of flying from the caster to the target: a line missile the original casts at a location
   * (Vi's row shockwave). Both points are taken when it spawns.
   */
  readonly rowSide?: -1 | 1;
  /** With `rowSide`: how many cells the row projectile runs (with `rowToEnd`, at most this many). */
  readonly rowCells?: number;
  /**
   * With `rowSide`: it runs to the end of its row on that side (the board's own geometry: the last cell's centre plus
   * `rowBeyond` cells), capped by `rowCells`.
   */
  readonly rowToEnd?: boolean;
  /** With `rowToEnd`: cells past the last cell's centre the row ends at (0 to 1). */
  readonly rowBeyond?: number;
  /**
   * With `rowSide`: cells per second. The flight then takes its cells / rowSpeed, and the run lasts that plus what the cue
   * keeps after its nominal flight (`duration` − `travelSeconds`), so a short run near the board's edge ends sooner.
   */
  readonly rowSpeed?: number;
  /**
   * Cues of one play with the same key start together or not at all: they wait for room for all of them and are all
   * dropped once overdue, so one half of a pair never shows without the other (Vi's two row shockwaves).
   */
  readonly together?: string;
  /**
   * A projectile that falls onto its target from above instead of flying from the caster: it starts this many cells from
   * where its target stands (along world X, up, along world Z; the camera looks toward −Z, so −X and −Z are the screen's
   * left and top) and lands on the target's `targetBone`. The start is taken when it spawns. For a missile whose launcher
   * the board never shows (Caitlyn's Air Raid comet, dropped from a blimp off screen).
   */
  readonly fromAbove?: readonly [number, number, number];
  /**
   * A projectile that starts where its caster stands and runs on the floor toward where its target stands, through it,
   * `lineCells` cells in all, instead of flying from a caster bone to the target: a line missile the original casts at a
   * location with no start bone (Gangplank's ground-fire line). Both ends are taken when it spawns; it never follows.
   */
  readonly lineCells?: number;
  /** With `lineCells`: how many cells behind the caster (away from the target) the line starts; its length is unchanged. */
  readonly lineBack?: number;
  /**
   * A state its target carries (a curse, a shield): once that target is dead it is not played where the target stood, as a
   * cast's other hits and projectiles are (runtime placeTargets). Fable 11-13: Morgana's curse and Lux's shield.
   */
  readonly livingTarget?: boolean;
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
export function mapSkillTimeline(cues: readonly TimelineCue[], sourceId: string, targets: readonly string[], board?: WorldPoint): TimelineMapping {
  const unique = [...new Set(targets)], spawns: TimelineSpawn[] = [];
  const unsupported: { cue: TimelineCue; reason: 'missing-target' | 'self-projectile' | 'missing-point' }[] = [];
  for (const cue of cues) {
    if (cue.location === 'board') {
      if (!board || board.some(n => !Number.isFinite(n))) unsupported.push({ cue, reason: 'missing-point' });
      else spawns.push({ ...cue, sourceId, point: board });
      continue;
    }
    if (cue.event === 'cast-start') { spawns.push({ ...cue, sourceId, ...(unique[0] !== undefined && unique[0] !== sourceId ? { aimId: unique[0] } : {}) }); continue; }
    if (!unique.length) { if (!cue.optional) unsupported.push({ cue, reason: 'missing-target' }); continue; }
    if (cue.event === 'projectile' && unique[0] === sourceId && !cue.selfFlight) {
      if (cue.optional) continue;
      unsupported.push({ cue, reason: 'self-projectile' }); continue;
    }
    const pool = cue.others ? unique.slice(1) : unique;
    if (!pool.length) { if (!cue.optional) unsupported.push({ cue, reason: 'missing-target' }); continue; }
    for (const targetId of cue.primary ? pool.slice(0, 1) : cue.targetLimit ? pool.slice(0, cue.targetLimit) : cue.event === 'projectile' ? pool.slice(0, 1) : pool) {
      spawns.push({ ...cue, sourceId, targetId });
    }
  }
  // A projectile from the caster to itself is left out (self-projectile). The hit on the caster that lands when it would have
  // landed plays when it would have left instead (Fable 11-13: Lux's shield on herself, Twitch's own cast).
  for (const { cue, reason } of unsupported) if (reason === 'self-projectile') {
    const lands = cue.delay + (cue.travelSeconds ?? cue.duration);
    for (let at = 0; at < spawns.length; at++) {
      const spawn = spawns[at]!;
      if (spawn.event === 'hit' && spawn.targetId === sourceId && Math.abs(spawn.delay - lands) < 1e-6) spawns[at] = { ...spawn, delay: cue.delay };
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
