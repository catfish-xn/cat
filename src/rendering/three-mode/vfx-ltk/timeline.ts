/** The chest locator: basic attacks hit here (the bone their attack data names for a hit), and their missiles fly to it. */
export const CHEST = 'C_BUFFBONE_GLB_CHEST_LOC';
/** Visual timeline only. The server's cast event remains the sole gameplay fact. */
export type TimelineAction = 'cast' | 'attack' | 'passive' | 'end';
/** `empowered-alt`: an empowered attack thrown from the other hand (Draven's every second empowered attack). */
export type TimelineVariant = 'empowered' | 'empowered-alt' | 'self' | 'single';
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
  /**
   * Flight by distance (fitted, not original data): the flight takes max(min, ceil(cells × perCell)) rule ticks of 50 ms,
   * cells being the board distance between caster and target where they stand when the play starts. On a projectile it
   * sets travelSeconds, keeping what the cue holds past its nominal flight; on a hit the cue's delay counts from that
   * landing. A cue without a target, or whose caster or target is gone, keeps its own times.
   */
  readonly flightTicks?: { readonly perCell: number; readonly min: number };
  /**
   * Lasts the rule's flight (LtkPlayOptions.flightSeconds, from abilityProjectileLaunched): duration counts what the cue keeps
   * after the landing, so a ground band laid at launch clears on the landing frame plus that tail.
   */
  readonly spanFlight?: boolean;
  /** Soft stop emission and let existing particles linger until duration. */
  readonly stopAfter?: number;
  /**
   * With `stopAfter`: from the stop, ease the cue's particles to nothing by `duration` instead of the cue cutting them
   * off at full strength (11-07: Zyra's long-lived single-particle roots never reach their own authored fade).
   */
  readonly fadeOut?: boolean;
  /** The skill's own body, kept like an impact though it plays on the caster (Nunu's cloud on himself). */
  readonly main?: boolean;
  /**
   * A decided rank instead of the event's own (effect-budget.ts effectImportance): 'body' for a hit or projectile that must
   * not crowd skill impacts out (Steb's heal share) or a cast-start that draws the skill itself; 'critical' for a cast-start
   * body that must never yield its slot (Mordekaiser's aura, LeBlanc's channel: Fable 11-19); 'decorative' for a flourish a
   * plain attack or a place's run may end (cue-ranks.ts), a visual that must give way to every skill and basic-attack visual
   * (Heimerdinger's rocket hits, Fable 11-19), or a layer shown all fight long as decoration (cue-overrides.ts SUSTAIN_RANKS).
   * A display priority decision, not original data.
   */
  readonly rank?: 'body' | 'critical' | 'decorative';
  /** A single world point supplied by the board, never an invented unit target. */
  readonly location?: 'board';
  /** Fan out projectiles/impacts only to this many actual receipt targets. */
  readonly targetLimit?: number;
  /** Only the receipt targets after the primary one (Zyra's short vines reach the others, not the one already rooted). */
  readonly others?: boolean;
  /** A beam keeps its source bone while aiming at the actual target; it does not fly. */
  readonly stationary?: boolean;
  /**
   * A projectile that arcs: a gravity height solver (units/s²) and a lift added to the aimed point. It still lands after
   * travelSeconds.
   */
  readonly arc?: { readonly gravity: number; readonly targetOffset: number };
  /**
   * A projectile's flight as a fixed curve instead of a straight line (the engine's fixed-time Hermite spline, as a perStrike
   * fan's strikes fly): its start and end tangents in the target-facing frame, as shares of the distance. Its ends and its
   * flight time stay the cue's own. A perStrike fan's own curve takes its place.
   */
  readonly curve?: StrikeCurve;
  /**
   * One row per strike: for a cast whose rules strike several times (its targets list keeps one entry a strike, repeats
   * included; Heimerdinger's rockets), this cue plays once per entry instead of once per distinct target. The k-th of n
   * starts `strikeOffsetTicks(k, n, …)` rule ticks after the cue's delay, and a projectile row with `fan` flies a curve that
   * leaves to the side and climbs before it turns onto its own target (`strikeCurve`). Designed display values, not original
   * data. Entries naming the caster are left out. `shown` and `tickCap` bound how many projectile rows a volley draws.
   */
  readonly perStrike?: {
    readonly staggerTicks: number; readonly spreadTicks: number; readonly fan?: StrikeFan;
    /** Rows only for the first `shown` strikes of a cast; later strikes play nothing of this cue (their damage still shows). */
    readonly shown?: number;
    /** At most this many of this system's rows queued on one rule tick across every caster (runtime); the rest are left out. */
    readonly tickCap?: number;
  };
  /**
   * Hits of one play on one target merge: a row of this cue lands nothing when an earlier row of the same play at the same
   * target lands under this many rule ticks before (1: the same tick only). It applies to the rows a cue plays once per
   * strike (perStrike) or once per receipt (everyReceipt), whose targets may repeat. Several copies of one burst on one
   * spot at once can add up to a flat white block. A display rule of our own, not original data.
   */
  readonly mergeTicks?: number;
  /**
   * A projectile whose caster is its own target still flies (from its bone to its own targetBone), instead of being left
   * out with its landing hits moved to its release (the default for a self-projectile). Off unless set per cue.
   */
  readonly selfFlight?: boolean;
  /**
   * At its end the cue stops emitting and lets the particles already out finish their own lives, for at most this many
   * seconds, instead of being cut there (cue-overrides.ts PLAY_OUT_AT_DEADLINE; per cue, Fable 11-19).
   */
  readonly playOut?: number;
  /**
   * The cue only gives way (Fable 11-21, Mel's bolt arcs): it starts only in free room, never ending, displacing or waiting
   * on another run, and while it runs any newcomer may end it. Both are counted in LTK_RUN_STATS.gaveWay, never as drops.
   */
  readonly giveWay?: boolean;
  /**
   * Uniform size of this system about its anchor. Omitted means 1.
   *
   * Multiplies the system's own offsets, particle size and velocity. It does not move the
   * anchor, a hanger, a projectile's endpoints or its flight path, and it does not change
   * `FX_SCALE`.
   */
  readonly scale?: number;
  /**
   * Each particle's red, green and blue times this when drawn, for this cue only (particleRead withDrawFade gain). Omitted
   * means 1. A display choice per cue (Heimerdinger's rockets, Fable 11-19), never a value from the original.
   */
  readonly brightness?: number;
  /**
   * It plays as long as its system does on its own (runtime.ts ownSeconds, read from the asset) and is not cut short:
   * `duration` is only what it keeps where the asset gives no end. Never with `stopAfter`.
   */
  readonly ownLife?: boolean;
  /**
   * One row for each receipt target after the first, in receipt order and repeats kept: one per projectile the rules sent
   * (Ziggs's split bombs may strike one enemy twice, or his primary target again). Not with `others`, `primary` or `targetLimit`.
   */
  readonly everyReceipt?: boolean;
  /** A projectile that starts where the play's primary target (its first receipt target) stands when the play comes, not at
   * its caster: Ziggs's split bombs leave his main bomb's crater. It plays even once that target is gone. */
  readonly fromPrimary?: boolean;
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
  /** Which strike of a perStrike cue this row is (0-based), and its flight curve when the cue fans out. */
  readonly strike?: number;
  readonly curve?: StrikeCurve;
  /** A board point's spawn faces this point, as a hit faces from its target toward the caster (LtkPlayOptions.boardFacing). */
  readonly facing?: WorldPoint;
  /** A cast-start's primary target other than the caster: the way the cast faces, though the model may still be turning. */
  readonly aimId?: string;
  /** TimelineCue.fromPrimary: the unit whose place the projectile starts from. */
  readonly fromId?: string;
}
/** How far a perStrike projectile's curve swings: `side` at most to either side and `lift` up, as shares of its flight. */
export interface StrikeFan { readonly side: number; readonly lift: number }
/** One strike's start and end tangents (engine fixedTimeSpline, target-facing frame: right, up, forward; shares of distance). */
export interface StrikeCurve { readonly control1: readonly [number, number, number]; readonly control2: readonly [number, number, number] }
/** Rule ticks are 50 ms. */
export const STRIKE_TICK_SECONDS = 0.05;
/**
 * Ticks after the first strike that the k-th of n strikes comes: `stagger` apart, squeezed so the whole volley fits in
 * `spread` ticks, rounded to whole ticks. Designed, not original data.
 */
export function strikeOffsetTicks(k: number, n: number, stagger: number, spread: number): number {
  if (n <= 1 || k <= 0) return 0;
  return Math.round(k * Math.min(stagger, spread / (n - 1)));
}
/**
 * The k-th of n strikes' curve: the volley's start directions spread evenly from -side to +side across the caster's
 * facing, taken alternately from either end so consecutive rockets leave on opposite sides; each climbs about `lift`
 * (varied a little by k) and comes down onto its target from above. Designed, not traced from any original path.
 */
export function strikeCurve(k: number, n: number, fan: StrikeFan): StrikeCurve {
  const slot = k % 2 === 0 ? k / 2 : n - 1 - (k - 1) / 2;
  const across = n <= 1 ? 0 : -1 + (2 * slot) / (n - 1);
  const lift = fan.lift * (0.85 + 0.3 * ((k * 0.6180339887) % 1));
  return { control1: [fan.side * across, lift, 0.35], control2: [0, -lift * 0.75, 1] };
}
export interface TimelineMapping {
  readonly spawns: readonly TimelineSpawn[];
  /** A partial plan is diagnostic only; never enqueue it or suppress the old action. */
  readonly unsupported: readonly { cue: TimelineCue; reason: 'missing-target' | 'self-projectile' | 'missing-point' }[];
}
/** TimelineCue.mergeTicks for one play: whether a row landing on `targetId` at rule tick `at` merges into an earlier one. */
function hitMerge(mergeTicks: number | undefined): (targetId: string, at: number) => boolean {
  const landed = new Map<string, number>();
  return (targetId, at) => {
    const last = landed.get(targetId);
    if (mergeTicks !== undefined && last !== undefined && at - last < mergeTicks) return true;
    landed.set(targetId, at); return false;
  };
}
/** Hits preserve authoritative self/ally targets. Projectiles need a distinct primary
 * endpoint; never skip self and silently retarget to a later member of the list. */
export function mapSkillTimeline(cues: readonly TimelineCue[], sourceId: string, targets: readonly string[], board?: WorldPoint): TimelineMapping {
  const unique = [...new Set(targets)], spawns: TimelineSpawn[] = [];
  const unsupported: { cue: TimelineCue; reason: 'missing-target' | 'self-projectile' | 'missing-point' }[] = [];
  for (const cue of cues) {
    if (cue.perStrike && cue.event !== 'cast-start' && cue.location !== 'board') {
      const strikes = targets.filter(id => id !== sourceId), { staggerTicks, spreadTicks, fan } = cue.perStrike;
      if (!strikes.length) { if (!cue.optional) unsupported.push({ cue, reason: 'missing-target' }); continue; }
      const { shown } = cue.perStrike, merged = hitMerge(cue.mergeTicks);
      strikes.forEach((targetId, k) => {
        if (shown !== undefined && k >= shown) return;
        const at = strikeOffsetTicks(k, strikes.length, staggerTicks, spreadTicks);
        if (merged(targetId, at)) return;
        spawns.push({ ...cue, sourceId, targetId, strike: k, delay: cue.delay + at * STRIKE_TICK_SECONDS,
          ...(cue.event === 'projectile' && fan ? { curve: strikeCurve(k, strikes.length, fan) } : {}) });
      });
      continue;
    }
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
    if (cue.everyReceipt) {
      const each = targets.slice(1);
      if (!each.length) { if (!cue.optional) unsupported.push({ cue, reason: 'missing-target' }); continue; }
      // Every row of a receipt cue lands at the same time (its delay), so mergeTicks keeps one row per target.
      const merged = hitMerge(cue.mergeTicks);
      for (const targetId of each) if (!merged(targetId, 0)) spawns.push({ ...cue, sourceId, targetId, ...(cue.fromPrimary ? { fromId: targets[0] } : {}) });
      continue;
    }
    const pool = cue.others ? unique.slice(1) : unique;
    if (!pool.length) { if (!cue.optional) unsupported.push({ cue, reason: 'missing-target' }); continue; }
    for (const targetId of cue.primary ? pool.slice(0, 1) : cue.targetLimit ? pool.slice(0, cue.targetLimit) : cue.event === 'projectile' ? pool.slice(0, 1) : pool) {
      spawns.push({ ...cue, sourceId, targetId, ...(cue.fromPrimary ? { fromId: unique[0] } : {}) });
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
