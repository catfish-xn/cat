import { Vector3, type Camera, type Material, type Object3D, type Scene, type WebGLRenderer } from 'three';
import { applyStencil, stencilStates, type StencilClaim } from './rendering/utils/stencil';
import { BOARD_CELL, cueSize } from './fx-size';
import { createLtkParticles, measurePeak, pointAnchor, unitAnchor, unitJoints, FX_SCALE, ROOT_PARTICLES, CHILD_PARTICLES, type LtkParticles } from './particles';
import { AXIS_SIGN } from './space';
import type { PreparedVfx, VfxLibrary } from './loader';
import { mapSkillTimeline, selectTimeline, type TimelineAction, type TimelineCue, type TimelineVariant, type TimelineSpawn, type WorldPoint } from './timeline';
import { createVfxPasses } from './rendering/passes';
import { flushDrawBufferPool } from './rendering/utils/drawBufferPool';
import { flushFrameTargetPool } from './rendering/utils/frame';
import { admitEffect, effectImportance, type EffectImportance } from '../effect-budget';
import { ATTACHED_SLOTS, ATTACHED_STATS, type AttachedDraw } from './rendering/components/AttachedMeshes';

/** Bone cues and projectiles follow the caster. A board point or a target hit does not. */
function needsLivingSource(spawn: TimelineSpawn): boolean {
  if (spawn.event === 'hit') return false;
  return !(spawn.point && spawn.event !== 'projectile');
}

/**
 * At most 12 systems at once. Each reserves 150 root + 100 child particle slots on its first play, then what it was
 * seen to need (its peak root count with a quarter of headroom, plus the child room when it has children). The shared
 * budget (1500 live particles) is unchanged, so this lets more small systems play, never more particles (11-07 brawl:
 * every critical drop was on six full 250-slot reservations while most of those systems drew a few dozen particles).
 */
export const MAX_LTK_SYSTEMS = 12, MAX_LTK_QUEUED = 64;
/** LTK systems a plain attack may take without shared fallback room (half of MAX_LTK_SYSTEMS). */
const ATTACK_FREE_SLOTS = 6;
/**
 * Host-body overlay layers on screen at once, across systems: a fuse against runaway stacking, never meant to trip in
 * play (the build before it had no cap). A layer is one live particle of an attached emitter, drawn once per skinned
 * part of its host. Measured 11-11 (asset-root-live c1333710ad8e, dev/castcmp/board-load.cjs, SwiftShader): a whole
 * 8 v 8 3-star combat of attached-heavy champions (Mundo, Vi, Jinx, Leona, Mordekaiser, Ambessa, Jayce, Loris against
 * Kog'Maw and the same) peaks at 13 layers / 61 draws, Mundo's R alone at 5 / 29, cap untouched; frame time within
 * noise of the uncapped build. 24 leaves that peak almost twice over.
 */
export const ATTACHED_LAYER_CAP = 24;
/**
 * Every runtime's overlay counts (the castcmp board-load harness reads them): layers on screen in the latest frame (one
 * per live particle of an attached emitter) and the skinned draws they cost, the peaks, what made the peak layer count
 * (`system@unit+start:emitter` → layers), and how often the cap tripped. Read by dev tools only: every runtime writes
 * to it, so with several runtimes `layers`/`draws` are the last one's.
 */
export const ATTACHED_LAYER_STATS = { layers: 0, draws: 0, peakDraws: 0, peakLayers: 0, peakSystems: {} as Record<string, number>, capEvents: 0, cappedFrames: 0 };
/** Which overlays the screen cap keeps first. */
const LAYER_RANK: Record<EffectImportance, number> = { critical: 3, body: 2, decorative: 1, attack: 0 };
/** The fewest slots a system reserves, whatever its measured peak. */
export const MIN_RESERVE = 24;
/**
 * At this many live systems the extra depth and distortion passes are skipped.
 * Colour particles still draw in the single board pass.
 */
export const LTK_PASS_DEGRADE_AT = 4;
export interface LtkPassFlags { readonly early: boolean; readonly late: boolean; readonly soft: boolean }
export function ltkRenderNeeds(systems: readonly { readonly passes: LtkPassFlags }[]): { early: boolean; late: boolean; soft: boolean } {
  if (systems.length >= LTK_PASS_DEGRADE_AT) return { early: false, late: false, soft: false };
  const needs = { early: false, late: false, soft: false };
  for (const fx of systems) {
    needs.early ||= fx.passes.early; needs.late ||= fx.passes.late; needs.soft ||= fx.passes.soft;
  }
  return needs;
}
export interface VfxUnit { root: Object3D; body: Object3D | null; alive: boolean; disposed?: boolean }
export interface LtkPlayOptions {
  /** Exact display branch in this champion's catalogue; each branch retains the 12-cue limit. */
  skill?: string;
  board?: WorldPoint;
  /** Explicit board stage only, e.g. a confirmed storm after all recipients died. */
  boardOnly?: boolean;
  /** Only a confirmed post-death effect (devoured) may capture a dead victim's position. */
  snapshotTargets?: boolean;
  /** Observed channel duration; soft-stopped emitters end at this offset from cast. */
  channelSeconds?: number;
  /** Only independent board effects (Mel's settlement receipt) may outlive a combat phase. */
  persistAcrossPhase?: boolean;
  /** Seconds (0..2) added to every cue's delay: a receipt the board times itself (Renata's shield as her rocket passes). */
  delay?: number;
  /** Timeline variant (empowered, a form), as the string argument would name it. */
  variant?: TimelineVariant;
  /** The cast event's rule branch (`branch.branch`); never inferred from a cast count. Branched cues need it. */
  branch?: string;
  /**
   * Seconds (held to −2..2) every attack cue moves by, none earlier than the start: the original release lands `windupRatio`
   * of the interval after the swing starts, while the exported cues assume the clip's release frame at 1× (AttackRelease).
   * Only the default ltk.play path takes it; heroes whose attacks go through the batch2 bridge do not move.
   */
  releaseShift?: number;
  /**
   * Segment mapping of the attack cues to a swing the mixer retimed to its release (AttackRelease; takes precedence over
   * releaseShift): a cue before the clip's release frame `clipSeconds` scales to `t × atSeconds / clipSeconds` (the head
   * plays sped up), a cue at or after it lands at `atSeconds + (t − clipSeconds) / tailSpeed`; a projectile or hit cue after
   * the release only moves with it (its flight and impact are not part of the recovery the tail speeds up). Each cue still
   * moves at most 2 s either way and never before the start. The default ltk.play path and the batch2 bridge take it.
   */
  release?: { atSeconds: number; clipSeconds: number; tailSpeed: number };
  /** Every cue not yet started is dropped if the caster dies first, hits included: the rules never deliver it (Sevika's slot wait). */
  cancelWithSource?: boolean;
}
interface Waiting { at: number; spawn: TimelineSpawn; library: VfxLibrary; snapshot?: WorldPoint; persistent?: boolean; group?: string; withSource?: boolean;
  /** TimelineCue.together, made unique to one play() call: the rows that start together or not at all. */
  together?: string }
interface Running { reserved: number; system: string; stopped?: boolean; source: string; target?: string; action: TimelineAction; until: number; started: number; span: number; fx: LtkParticles; persistent?: boolean; boundToSource: boolean; group?: string; importance: EffectImportance;
  /** Its unit died or left: the host-body overlays go at once, while the rest of the system's tail plays out. */
  bodyGone?: boolean }
/**
 * A row projectile's two ends: `from` and `cells` cells along the board row on `side`. Rows run along world X on both
 * halves of the board: a piece stands at (x, 0, y) of its 2D layout (placeholder-renderer), and hex-layout.ts puts a cell's
 * x by its column and its y by its row alone, so one row is one world Z for either player.
 */
export function rowPath(from: WorldPoint, side: -1 | 1, cells: number, cell = BOARD_CELL): [WorldPoint, WorldPoint] {
  return [from, [from[0] + side * cells * cell, from[1], from[2]]];
}
/** The board's cell geometry (board-feed BoardFrame: columns, hexRadius, origin), in the units pieces stand in. */
export interface RowBoard { readonly columns: number; readonly radius: number; readonly origin: { readonly x: number; readonly y: number } }
/**
 * Cells from `at` to the centre of the last cell of its row on `side` (0 at that cell or past it). Its row is the one its
 * world Z falls in; odd rows sit half a cell to the right (hex-layout.ts).
 */
export function rowReach(at: WorldPoint, side: -1 | 1, board: RowBoard): number {
  const cell = Math.sqrt(3) * board.radius, row = Math.round((at[2] - board.origin.y) / (1.5 * board.radius));
  const first = board.origin.x + cell * (((row % 2) + 2) % 2) / 2, last = first + cell * (board.columns - 1);
  return Math.max(0, side < 0 ? (at[0] - first) / cell : (last - at[0]) / cell);
}
/** Where a unit stands: its root, which a knock-up does not move (the renderer lifts the body under it). */
export function standingPoint(root: Object3D): WorldPoint {
  const at = root.getWorldPosition(new Vector3()); return [at.x, at.y, at.z];
}
/** An attack cue's delay on a swing retimed to its release (LtkPlayOptions.release), moved at most 2 s and never below 0. */
export function releaseDelay(t: number, at: number, clip: number, tail: number): number {
  // Written as a shift from t so a tail at 1× gives exactly releaseShift's `at − clip` (Malzahar stays bit-identical).
  const shift = t < clip ? t * at / clip - t : at - clip + (t - clip) * (1 / tail - 1);
  return Math.max(0, t + Math.min(2, Math.max(-2, shift)));
}
/** One attack cue on a retimed swing: projectile and hit cues after the release only shift with it (tail speed 1). */
export function releaseCueDelay(cue: Pick<TimelineCue, 'delay' | 'event'>, release: NonNullable<LtkPlayOptions['release']>): number {
  const tail = cue.event === 'projectile' || cue.event === 'hit' ? 1 : release.tailSpeed;
  return releaseDelay(cue.delay, release.atSeconds, release.clipSeconds, tail);
}
/** A loaded system with the named top-level emitters, and everything under them, left out of the draw; one per list. */
const HIDDEN = new WeakMap<PreparedVfx, Map<string, PreparedVfx>>();
function withHidden(prepared: PreparedVfx, names: readonly string[]): PreparedVfx {
  const key = names.join(','); let views = HIDDEN.get(prepared);
  if (!views) { views = new Map(); HIDDEN.set(prepared, views); }
  let view = views.get(key);
  if (!view) {
    const roots = new Set(prepared.model.emitters.filter(e => names.includes(e.name)).map(e => e.index));
    view = { ...prepared, drawn: prepared.drawn.filter(d => !roots.has(d.root)) }; views.set(key, view);
  }
  return view;
}
export function createLtkRuntime(library: VfxLibrary, scene: Object3D, findUnit: (id: string) => VfxUnit | undefined, options: { budget?: { live: number; max: number }; renderer?: WebGLRenderer; floors?: () => readonly Object3D[];
  /** The board's cell geometry, for a row projectile that runs to the end of its row (TimelineCue.rowToEnd). */
  board?: () => RowBoard | null;
  /** The nearest live foe of a caster, for a cast on itself (Irelia's W): its cast-start then faces that foe. */
  foe?: (sourceId: string) => Object3D | null;
  /** False hides every host-body overlay (attached mesh): reduced motion, `?skillfx=off`. Omitted means shown. */
  attachedLayers?: () => boolean;
  /** Tests only: a lower screen cap than ATTACHED_LAYER_CAP, to exercise what happens over it. */
  layerCap?: number } = {}) {
  let clock = 0, closed = false, seed = 1, plays = 0;
  const layerCap = options.layerCap ?? ATTACHED_LAYER_CAP;
  const waiting: Waiting[] = [], running = new Set<Running>(), warming = new Map<string, Promise<void>>(), catalogs = new Map<string, VfxLibrary>();
  const claimBuf: (StencilClaim & { material: Material })[] = [];
  const layerBuf: { key: string; draws: AttachedDraw[]; rank: number; started: number; system: string }[] = [];
  const attachedStats = { capEvents: 0, cappedFrames: 0, peakLayers: 0 };
  let capped = false;
  const liveFx: { passes: LtkPassFlags }[] = [];
  const slots = ROOT_PARTICLES + CHILD_PARTICLES;
  /**
   * Slots each system needs: measured in place when its champion warms (measurePeak), then raised by what each finished
   * play held. A first play used to reserve the full 250 instead: six systems filled the shared 1500, so a first cast
   * dropped whatever came seventh (Vi's row shockwave, 11-12).
   */
  const needs = new Map<string, number>();
  const reserveOf = (peak: number, children: boolean) => Math.min(slots, Math.max(MIN_RESERVE, Math.ceil(peak * 1.25) + (children ? CHILD_PARTICLES : 0)));
  const reserveFor = (system: string) => needs.get(system) ?? slots;
  const reservedNow = () => { let sum = 0; for (const run of running) sum += run.reserved; return sum; };
  const passes = options.renderer ? createVfxPasses(options.renderer, options.floors) : null;
  /** Finished systems wait here, keyed like their next cast, instead of rebuilding buffers. */
  const spareFx: LtkParticles[] = [];
  const SPARE_FX = 8;
  const release = (run: Running, retire = false) => {
    run.fx.object.removeFromParent();
    if (options.budget) options.budget.live -= run.reserved;
    // A play that ran to its end shows what the system needs; a cut-short play may not have peaked yet. The need only
    // grows: a low-peaking seed or a shorter cue on a shared system (Zyra's 857fe049 at 0.6 and 0.7 s) never lowers it.
    if (run.fx.finished) needs.set(run.system, Math.max(needs.get(run.system) ?? 0, reserveOf(run.fx.peak, run.fx.children)));
    if (retire) { run.fx.dispose(); return; }
    // Least recently parked goes first: a full pool keeps the newest finished systems.
    while (spareFx.length >= SPARE_FX) spareFx.shift()!.dispose();
    spareFx.push(run.fx);
  };
  const drainSpare = () => { for (const fx of spareFx) fx.dispose(); spareFx.length = 0; };
  const clear = (preserveWorldEffects = false) => {
    for (let at = waiting.length - 1; at >= 0; at--) if (!preserveWorldEffects || !waiting[at].persistent) waiting.splice(at, 1);
    for (const run of running) if (!preserveWorldEffects || !run.persistent) { release(run, true); running.delete(run); }
    if (!preserveWorldEffects) drainSpare();
  };
  const warm = (champion: string) => {
    if (closed) return Promise.resolve();
    const held = warming.get(champion); if (held) return held;
    const pending = library.champion(champion).then(async catalog => {
      if (closed || !catalog) return;
      catalogs.set(champion, catalog);
      const cues = Object.entries(catalog.index?.skills ?? {}).filter(([key]) => key === champion || key.startsWith(champion + '-')).flatMap(([, list]) => list ?? []);
      await Promise.allSettled([...new Set(cues.map(cue => cue.system))].map(id => catalog.load(id)));
      // Each system's first play reserves what it was measured to hold over its longest cue (stopped where that cue stops).
      // One system per task: a champion's whole set took up to about 50 ms on the 11-12 Linux box, so it never runs in one go.
      for (const id of new Set(cues.map(cue => cue.system))) {
        await new Promise(resolve => setTimeout(resolve, 0));
        const prepared = catalog.get(id);
        if (closed || needs.has(id) || !prepared || prepared.empty) continue;
        const longest = cues.filter(cue => cue.system === id).reduce((best, cue) => cue.duration > best.duration ? cue : best);
        needs.set(id, reserveOf(measurePeak(prepared, Math.min(longest.duration, 10), longest.fadeOut ? undefined : longest.stopAfter),
          prepared.drawn.some(definition => !!definition.path)));
      }
    }).catch(() => { /* No replacement until every system of the action is usable. */ });
    warming.set(champion, pending); return pending;
  };
  const enqueue = (champion: string, variant: string, sourceId: string, targetIds: readonly string[], action: 'cast' | 'attack', group?: string, partialTargets = false): boolean => {
      if (closed) return false;
      void warm(champion);
      const catalog = catalogs.get(champion) ?? library;
      const available = catalog.index?.skills[variant];
      const cues = selectTimeline(champion, available?.filter(cue => (cue.action ?? 'cast') === action), id => !!catalog.get(id), !!available);
      const source = findUnit(sourceId);
      if (!cues || !source?.alive || source.disposed) return false;
      const { spawns, unsupported } = mapSkillTimeline(cues, sourceId, targetIds);
      if (unsupported.length || !spawns.length) return false;
      const living = (spawn: TimelineSpawn) => {
        if (spawn.targetId === undefined) return true;
        const target = findUnit(spawn.targetId);
        return !!target?.alive && !target.disposed;
      };
      // The legacy action stays atomic: one dead target keeps the handwritten fallback.
      // A variant takeover drops only that target and keeps the caster's windup plus living targets.
      if (!partialTargets && spawns.some(spawn => !living(spawn))) return false;
      const chosen = partialTargets ? spawns.filter(living) : spawns;
      if (!chosen.length || waiting.length + chosen.length > MAX_LTK_QUEUED) return false;
      for (const spawn of chosen) waiting.push({ at: clock + spawn.delay, spawn, library: catalog, group });
      return true;
  };
  return {
    warm,
    /** Variants live inside the champion's own catalogue; no global ID flattening. */
    playVariant(champion: string, variant: string, sourceId: string, targetIds: readonly string[] = [], group?: string): boolean {
      return enqueue(champion, variant, sourceId, targetIds, 'cast', group, true);
    },
    stopGroup(group: string) {
      for (let at = waiting.length - 1; at >= 0; at--) if (waiting[at].group === group) waiting.splice(at, 1);
      for (const run of running) if (run.group === group) { run.fx.stop(); run.until = Math.min(run.until, clock + .5); }
    },
    /** True means every active cue is covered and queued. Partial/unsupported actions
     * return false without enqueueing anything, so the host runs its entire fallback. The fourth argument is no longer
     * read: which cues a cast plays comes from the rule's cast event (`branch`), never from a count (the slot stays only so
     * the callers keep their argument order). */
    play(champion: string, sourceId: string, targetIds: readonly string[], _castIndex = 0, action: TimelineAction = 'cast', extra?: TimelineVariant | LtkPlayOptions): boolean {
      if (closed) return false;
      void warm(champion);
      const context: LtkPlayOptions = extra !== undefined && typeof extra !== 'string' ? extra : {};
      const form = typeof extra === 'string' ? extra : context.variant;
      const catalog = catalogs.get(champion) ?? library;
      const skill = context.skill ?? champion;
      if (skill !== champion && !skill.startsWith(champion + '-')) return false;
      const available = catalog.index?.skills[skill];
      let selected = available?.filter(cue => (cue.action ?? 'cast') === action
        && cue.variant === form
        && (cue.branch === undefined || cue.branch === context.branch)
        && (!context.boardOnly || cue.location === 'board'));
      if (context.channelSeconds !== undefined) {
        if (!Number.isFinite(context.channelSeconds) || context.channelSeconds <= 0 || context.channelSeconds > 10) return false;
        const end = context.channelSeconds;
        selected = selected?.map(cue => cue.stopAfter === undefined ? cue : { ...cue,
          duration: Math.min(10, Math.max(0, end - cue.delay) + .5), stopAfter: Math.max(0, end - cue.delay) });
      }
      if (context.release !== undefined) {
        const { atSeconds: at, clipSeconds: clip, tailSpeed: tail } = context.release;
        if (![at, clip, tail].every(Number.isFinite) || at < 0 || clip <= 0 || tail <= 0) return false;
        selected = selected?.map(cue => (cue.action ?? 'cast') === 'attack' ? { ...cue, delay: releaseCueDelay(cue, { atSeconds: at, clipSeconds: clip, tailSpeed: tail }) } : cue);
      } else if (context.releaseShift !== undefined) {
        if (!Number.isFinite(context.releaseShift)) return false;
        const shift = Math.min(2, Math.max(-2, context.releaseShift));
        selected = selected?.map(cue => (cue.action ?? 'cast') === 'attack' ? { ...cue, delay: Math.max(0, cue.delay + shift) } : cue);
      }
      if (context.delay !== undefined) {
        if (!Number.isFinite(context.delay) || context.delay < 0 || context.delay > 2) return false;
        const shift = context.delay;
        selected = selected?.map(cue => ({ ...cue, delay: cue.delay + shift }));
      }
      const cues = selectTimeline(champion, selected, id => !!catalog.get(id), !!available);
      const source = findUnit(sourceId);
      if (!cues) return false;
      const mapped = mapSkillTimeline(cues, sourceId, targetIds, context.board), { unsupported } = mapped;
      // An optional target cue whose recipient is already gone (often killed by this very cast) is dropped, not fatal.
      const spawns = mapped.spawns.filter(spawn => {
        if (!spawn.optional || spawn.targetId === undefined || context.snapshotTargets) return true;
        const target = findUnit(spawn.targetId);
        return !!target && !target.disposed && target.alive;
      });
      if (unsupported.length || !spawns.length || waiting.length + spawns.length > MAX_LTK_QUEUED) return false;
      const independent = spawns.every(s => s.point && s.event !== 'projectile');
      // A dead caster drops only cues anchored on that caster. Target hits and board points still enqueue.
      if (spawns.some(needsLivingSource) && (!source?.alive || source.disposed)) return false;
      // All targets are required before suppressing the old cast; later disappearance cancels its visual.
      if (spawns.some(spawn => {
        if (spawn.targetId === undefined) return false;
        const target = findUnit(spawn.targetId);
        return !target || target.disposed || (!target.alive && !context.snapshotTargets);
      })) return false;
      const play = ++plays;
      for (const spawn of spawns) {
        let snapshot: WorldPoint | undefined;
        if (context.snapshotTargets && spawn.targetId) {
          const p = unitAnchor(findUnit(spawn.targetId)!.root, findUnit(spawn.targetId)!.body, spawn.event === 'hit' ? spawn.bone : spawn.targetBone);
          // Snapshot as a world point, rather than retaining the dead object's bones.
          const engine = p.originAt(0);
          snapshot = [engine[0] * AXIS_SIGN[0] * FX_SCALE, engine[1] * FX_SCALE, engine[2] * FX_SCALE];
        }
        waiting.push({ at: clock + spawn.delay, spawn, library: catalog, snapshot, persistent: independent && context.persistAcrossPhase, ...(context.cancelWithSource ? { withSource: true } : {}),
          ...(spawn.together ? { together: `${play}:${spawn.together}` } : {}) });
      }
      return true;
    },
    /** End/recast releases a buff's slots before its replacement or explosion starts. */
    stopAction(sourceId: string, action: TimelineAction) {
      for (let at = waiting.length - 1; at >= 0; at--) if (waiting[at].spawn.sourceId === sourceId && (waiting[at].spawn.action ?? 'cast') === action) waiting.splice(at, 1);
      for (const run of running) if (run.source === sourceId && run.action === action) { release(run, true); running.delete(run); }
    },
    /** True while a cue of this action from the source is queued or running. */
    playing(sourceId: string, action: TimelineAction = 'cast'): boolean {
      for (const row of waiting) if (row.spawn.sourceId === sourceId && (row.spawn.action ?? 'cast') === action) return true;
      for (const run of running) if (run.source === sourceId && run.action === action && !run.stopped) return true;
      return false;
    },
    stopUnit(id: string) {
      for (let at = waiting.length - 1; at >= 0; at--) {
        const row = waiting[at];
        if (((needsLivingSource(row.spawn) || row.withSource) && row.spawn.sourceId === id) || (!row.snapshot && row.spawn.targetId === id)) waiting.splice(at, 1);
      }
      for (const run of running) if ((run.boundToSource && run.source === id) || run.target === id) {
        // Its tail still plays, but the finished system belongs to a gone unit: retire, never park. An overlay drawn on
        // that unit's body is not a tail: it goes now (Fable 11-11, Mordekaiser's aura on death).
        run.fx.stop(); run.stopped = true; run.bodyGone = true;
        for (const draw of run.fx.attached) draw.object.visible = false;
        if (run.group) run.until = Math.min(run.until, clock + .5);
      }
      // By unit id, not a lookup: the host may already have dropped the unit from its map.
      for (let index = spareFx.length - 1; index >= 0; index--) {
        if (spareFx[index]!.object.userData.poolUnit === id) spareFx.splice(index, 1)[0]!.dispose();
      }
    },
    update(seconds: number, camera: Camera) {
      if (closed || !Number.isFinite(seconds) || seconds < 0) return;
      clock += seconds;
      // Finish last frame's systems before reserving capacity for new ones.
      for (const run of running) {
        run.fx.update(seconds, camera);
        if (run.fx.finished || clock + 1e-9 >= run.until) { release(run, run.stopped); running.delete(run); }
      }
      let starts = 0;
      for (let at = 0; at < waiting.length;) {
        const row = waiting[at], { at: when, spawn, library: catalog, snapshot, persistent, group } = row;
        if (when > clock) { at++; continue; }
        if (starts >= 6) break;
        waiting.splice(at, 1);
        // A full board keeps damage and beams by retiring the earliest caster flourish. Decorative newcomers are dropped.
        // A persistent board run outlives the phase on purpose; it is never a flourish to evict.
        const importance: EffectImportance = persistent ? 'critical' : effectImportance(spawn);
        // One-shots miss their moment after 0.3s (a skill body waits up to half its duration). A grouped cue is a persistent skill
        // the controller still has registered; catch-up must start it while its
        // display duration remains. The 0.3s window and the six-start cap stay.
        // A critical or body cue past its window is dropped only when it still finds no room: a slot or budget freed this
        // frame by a finished run takes it (9d7cd268 brawl: 33 of 115 critical drops were declared overdue at 0.32–0.36 s
        // while four runs held 1000 of 1500 slots, because the lateness test ran before the room test). It may still retire
        // plain attacks and flourishes that slipped into room it was waiting for, never a skill body (eab51a1e brawl: 247
        // attack runs were live at critical drops). A late attack or flourish is simply dropped: replayed late, a hit spark
        // reads as lag (eab51a1e: 0f2af66b replayed 9 times).
        const overdue = clock - when > (importance === 'body' ? spawn.duration / 2 : 0.3) && !(group && clock < when + spawn.duration);
        if (overdue && (clock - when >= spawn.duration || (importance !== 'critical' && importance !== 'body'))) continue;
        const source = findUnit(spawn.sourceId), target = spawn.targetId ? findUnit(spawn.targetId) : undefined;
        if ((needsLivingSource(spawn) && (!source?.alive || source.disposed)) || (spawn.targetId && !snapshot && (!target?.alive || target.disposed))) continue;
        const loaded = catalog.get(spawn.system); if (!loaded || loaded.empty) continue;
        const prepared = spawn.hide ? withHidden(loaded, spawn.hide) : loaded;
        // A refreshing buff replaces its own earlier run from the same caster instead of drawing a second layer over it,
        // and frees that run's room before this one asks for its own.
        if (spawn.refresh) for (const run of running) if (run.system === spawn.system && run.source === spawn.sourceId) { release(run, true); running.delete(run); }
        // A row projectile (TimelineCue.rowSide) runs between two board points taken now: where its target stands (its
        // snapshot point once it is dead) and rowCells along the row. With neither it does not play: it never falls back
        // to a flight from the caster.
        const rowStart = spawn.event === 'projectile' && spawn.rowSide ? snapshot ?? (target ? standingPoint(target.root) : undefined) : undefined;
        if (spawn.event === 'projectile' && spawn.rowSide && !rowStart) continue;
        // How far it runs: to the end of its row when asked (and the board is known), at most rowCells; nothing to run, no run.
        const board = rowStart && spawn.rowToEnd ? options.board?.() ?? null : null;
        const rowCells = rowStart ? Math.min(spawn.rowCells ?? Infinity, board ? rowReach(rowStart, spawn.rowSide!, board) + (spawn.rowBeyond ?? 0) : spawn.rowCells ?? 0) : 0;
        if (rowStart && !(rowCells > 0.05)) continue;
        const flight = rowStart && spawn.rowSpeed ? rowCells / spawn.rowSpeed : spawn.travelSeconds;
        const runFor = rowStart && spawn.rowSpeed ? flight! + spawn.duration - (spawn.travelSeconds ?? 0) : spawn.duration;
        // Fallback particles spawn one at a time up to the shared cap, so they fill whatever is free and a whole system
        // (250 slots at once) never finds room again (11-06 field: 537 drops, all on the budget, live 1499–1500 with 4 running).
        // A skill system is all-or-nothing while fallback particles shed one by one, so a skill only has to fit beside the
        // other LTK reservations; fallback then stops spawning until it drains. A plain attack still waits for shared room.
        // A plain attack may also take a free LTK slot while at most half of them are live, so a calm board still shows hits
        // (11-07 brawl: attack drops 413 -> 919 once it always waited for shared room); a skill evicts it as before.
        const shared = importance === 'attack' && running.size >= ATTACK_FREE_SLOTS;
        // Rows that start together (TimelineCue.together) wait for room for all of them and start in one frame, or are
        // all dropped once overdue: one side of a pair never plays without the other.
        const partners = row.together ? waiting.filter(other => other.together === row.together) : [];
        const own = reserveFor(spawn.system), need = own + partners.reduce((sum, other) => sum + reserveFor(other.spawn.system), 0);
        const blocked = () => running.size + partners.length >= MAX_LTK_SYSTEMS || starts + partners.length >= 6 || !!(options.budget
          && (shared ? options.budget.live : reservedNow()) + need > options.budget.max);
        while (blocked()) {
          // Overdue, ages are withheld so no skill body yields to a cue that has already missed its moment.
          const decision = admitEffect([...running].map(run => run.persistent ? 'critical' : run.importance), importance, true,
            overdue ? undefined : [...running].map(run => clock - run.started), [...running].map(run => run.span));
          if (!decision.admit) break;
          const victim = [...running][decision.evict];
          if (!victim) break;
          release(victim); running.delete(victim);
        }
        if (blocked()) {
          // Six damage/projectile runs fill the board: a critical or body cue waits in line instead of being dropped (11-07 brawl:
          // every remaining critical drop was on six critical slots, half of them ending within 0.5 s). The overdue
          // rule above still bounds the wait, and the catch-up update below keeps it on its timeline.
          if (!overdue && (importance === 'critical' || importance === 'body')) { waiting.splice(at, 0, row); at++; }
          else for (const other of partners) waiting.splice(waiting.indexOf(other), 1);
          continue;
        }
        const host = spawn.event === 'hit' ? target : source;
        const fixed = snapshot ?? spawn.point;
        // A cast faces its primary target; a cast on itself faces the nearest foe, though the model may still look elsewhere
        // (11-07 field: Irelia's W swipe, 1.5 s after a self-cast, cut toward the camera or away from her attackers).
        const aim = spawn.aimId ? () => { const unit = findUnit(spawn.aimId!); return unit?.alive && !unit.disposed ? unit.root : null; }
          : spawn.event === 'cast-start' && (spawn.action ?? 'cast') === 'cast' && options.foe ? () => options.foe!(spawn.sourceId) : undefined;
        const rowEnds = rowStart ? rowPath(rowStart, spawn.rowSide!, rowCells, board ? Math.sqrt(3) * board.radius : BOARD_CELL) : null;
        const anchor = rowEnds ? pointAnchor(rowEnds[0]) : fixed && spawn.event !== 'projectile' ? pointAnchor(fixed) : unitAnchor(host!.root, host!.body, spawn.bone, aim);
        const attachment = rowEnds || (fixed && spawn.event !== 'projectile') ? undefined : host;
        // Systems draw at the arena's own unit scale, weapon-held ones at the body's (fx-size.ts); a cue scale multiplies that.
        const scale = (spawn.scale ?? 1) * cueSize(spawn);
        const tail = Math.min(0.25, runFor / 4);
        // A hand-set stop near the end is a deliberate cut (Viktor's slam board, 2.1 s of 2.2): the tail fade never starts
        // before it, so the cue stays at full strength up to its stop.
        const fadeFrom = spawn.fadeOut ? spawn.stopAfter : (!persistent && spawn.event !== 'projectile' && !(spawn.action === 'attack' && !spawn.variant))
          ? Math.max(runFor - tail, spawn.stopAfter ?? 0) : undefined;
        const nextOptions = { anchor, attachment,
          target: rowEnds ? pointAnchor(rowEnds[1]) : fixed ? pointAnchor(fixed) : target ? unitAnchor(target.root, target.body, spawn.targetBone) : null,
          joints: rowEnds || (fixed && spawn.event !== 'projectile') ? () => anchor : unitJoints(host!.root, host!.body),
          duration: runFor, projectileSeconds: spawn.event === 'projectile' && !spawn.stationary ? flight : undefined,
          stopAfter: spawn.stopAfter, fadeOut: spawn.fadeOut, fadeFrom, seed: seed++, scale };
        // The body is part of the key: after a model swap or star-up an attached system must rebuild for the new mesh.
        // Scale is part of it too: a parked system must not be replayed at another size.
        const poolKey = `${spawn.system}\n${spawn.hide?.join(',') ?? ''}\n${attachment?.root.uuid ?? ''}\n${attachment?.body?.uuid ?? ''}\n${scale}`;
        const spared = spareFx.findIndex(item => item.object.userData.poolKey === poolKey);
        let fx: LtkParticles | undefined = spared >= 0 ? spareFx.splice(spared, 1)[0] : undefined;
        try {
          if (fx) fx.reuse(nextOptions);
          else { fx = createLtkParticles(prepared, nextOptions); fx.object.userData.poolKey = poolKey; }
          // Scheduling is frame-quantized; the visual still expires at its planned
          // timeline end, so a late flight start cannot displace its landing cue.
          fx.object.userData.ltkSystem = spawn.system;
          fx.object.userData.poolUnit = attachment ? (spawn.event === 'hit' ? spawn.targetId : spawn.sourceId) : undefined;
          scene.add(fx.object); fx.update(clock - when, camera);
          if (options.budget) options.budget.live += own;
          running.add({ reserved: own, system: spawn.system, source: spawn.sourceId, target: snapshot ? undefined : spawn.targetId, action: spawn.action ?? 'cast', until: when + runFor, started: clock, span: runFor, fx, persistent, boundToSource: needsLivingSource(spawn), group, importance }); starts++;
        } catch { fx?.dispose(); /* Prepared definitions were checked; context loss/resource failure drops only this visual. */ }
      }
      // Host-body overlays across every running system: off when the host says so, else at most ATTACHED_LAYER_CAP on screen.
      // A layer is one live particle of an attached emitter: it draws once per skinned part of its host (Mundo's model is
      // 7 parts), and is kept or hidden whole, so the cap never leaves a body half covered.
      // Over the cap the lowest importance goes first (attack, flourish, body, then damage), the newest of a rank before
      // the oldest, so what is already showing stays. Only the overlay is hidden; the system's other emitters still draw.
      const showAttached = options.attachedLayers?.() ?? true;
      layerBuf.length = 0; let drawsOn = 0;
      for (const run of running) {
        const first = layerBuf.length;
        for (const draw of run.fx.attached) if (draw.object.visible) {
          if (!showAttached || run.bodyGone) { draw.object.visible = false; continue; }
          drawsOn++;
          let layer: (typeof layerBuf)[number] | undefined;
          for (let at = first; at < layerBuf.length && !layer; at++) if (layerBuf[at].key === draw.object.name) layer = layerBuf[at];
          if (layer) layer.draws.push(draw);
          else layerBuf.push({ key: draw.object.name, draws: [draw], rank: LAYER_RANK[run.persistent ? 'critical' : run.importance], started: run.started,
            system: `${run.system}@${run.source}+${run.started}:${draw.object.name.split('#')[0]}` });
        }
      }
      attachedStats.peakLayers = Math.max(attachedStats.peakLayers, layerBuf.length);
      ATTACHED_LAYER_STATS.layers = layerBuf.length; ATTACHED_LAYER_STATS.draws = drawsOn;
      ATTACHED_LAYER_STATS.peakDraws = Math.max(ATTACHED_LAYER_STATS.peakDraws, drawsOn);
      if (layerBuf.length > ATTACHED_LAYER_STATS.peakLayers) {
        ATTACHED_LAYER_STATS.peakLayers = layerBuf.length; ATTACHED_LAYER_STATS.peakSystems = {};
        for (const layer of layerBuf) ATTACHED_LAYER_STATS.peakSystems[layer.system] = (ATTACHED_LAYER_STATS.peakSystems[layer.system] ?? 0) + 1;
      }
      if (layerBuf.length > layerCap) {
        layerBuf.sort((a, b) => b.rank - a.rank || a.started - b.started);
        for (let at = layerCap; at < layerBuf.length; at++) for (const draw of layerBuf[at].draws) draw.object.visible = false;
        attachedStats.cappedFrames++; ATTACHED_LAYER_STATS.cappedFrames++;
        if (!capped) {
          // The cap is a fuse: it should never trip in play, so the first trip of each runtime says so in the console.
          if (attachedStats.capEvents === 0) console.warn(`vfx-ltk:attached-cap:${layerBuf.length}>${layerCap}`);
          attachedStats.capEvents++; ATTACHED_LAYER_STATS.capEvents++;
        }
        capped = true;
      } else capped = false;
      claimBuf.length = 0;
      for (const run of running) for (const claim of run.fx.stencils) claimBuf.push(claim);
      if (claimBuf.length) {
        const states = stencilStates(claimBuf);
        for (let index = 0; index < claimBuf.length; index++) applyStencil(claimBuf[index].material, states[index]);
      }
    },
    clear,
    render(camera: Camera) {
      if (!passes) return;
      // The optional engine must leave the ordinary board draw untouched while idle
      // (including missing-data fallback); no frame/depth target is needed then.
      if (!running.size) { options.renderer!.render(scene as Scene, camera); return; }
      liveFx.length = 0;
      for (const { fx } of running) liveFx.push(fx);
      passes.render(scene as Scene, camera, ltkRenderNeeds(liveFx));
    },
    get active() { return running.size; },
    /** Field data for the overlay caps (11-11, Fable): times and frames the screen cap hid overlays, the most wanted at once. */
    get attachedStats() { return { ...attachedStats, layerCap, slots: ATTACHED_SLOTS, peakAlive: ATTACHED_STATS.peakAlive, overSlotFrames: ATTACHED_STATS.overSlotFrames }; },
    get queued() { return waiting.length; },
    dispose() { if (closed) return; closed = true; clear(); warming.clear(); catalogs.clear(); passes?.dispose(); flushDrawBufferPool(); flushFrameTargetPool(); library.dispose(); },
  };
}
