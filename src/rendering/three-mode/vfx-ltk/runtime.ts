import type { Camera, Material, Object3D, Scene, WebGLRenderer } from 'three';
import { applyStencil, stencilStates, type StencilClaim } from './rendering/utils/stencil';
import { createLtkParticles, pointAnchor, unitAnchor, unitJoints, FX_SCALE, ROOT_PARTICLES, CHILD_PARTICLES, type LtkParticles } from './particles';
import { AXIS_SIGN } from './space';
import type { VfxLibrary } from './loader';
import { mapSkillTimeline, selectTimeline, type TimelineAction, type TimelineVariant, type TimelineSpawn, type WorldPoint } from './timeline';
import { createVfxPasses } from './rendering/passes';
import { flushDrawBufferPool } from './rendering/utils/drawBufferPool';
import { flushFrameTargetPool } from './rendering/utils/frame';
import { admitEffect, effectImportance, type EffectImportance } from '../effect-budget';

/** Bone cues and projectiles follow the caster. A board point or a target hit does not. */
function needsLivingSource(spawn: TimelineSpawn): boolean {
  if (spawn.event === 'hit') return false;
  return !(spawn.point && spawn.event !== 'projectile');
}

/** Per-renderer reservation: at most 6 x (150 root + 100 child) particle slots. */
export const MAX_LTK_SYSTEMS = 6, MAX_LTK_QUEUED = 64;
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
}
interface Waiting { at: number; spawn: TimelineSpawn; library: VfxLibrary; snapshot?: WorldPoint; persistent?: boolean; group?: string }
interface Running { source: string; target?: string; action: TimelineAction; until: number; fx: LtkParticles; persistent?: boolean; boundToSource: boolean; group?: string; importance: EffectImportance }
export function createLtkRuntime(library: VfxLibrary, scene: Object3D, findUnit: (id: string) => VfxUnit | undefined, options: { budget?: { live: number; max: number }; renderer?: WebGLRenderer; floors?: () => readonly Object3D[] } = {}) {
  let clock = 0, closed = false, seed = 1;
  const waiting: Waiting[] = [], running = new Set<Running>(), warming = new Map<string, Promise<void>>(), catalogs = new Map<string, VfxLibrary>();
  const claimBuf: (StencilClaim & { material: Material })[] = [];
  const liveFx: { passes: LtkPassFlags }[] = [];
  const slots = ROOT_PARTICLES + CHILD_PARTICLES;
  const passes = options.renderer ? createVfxPasses(options.renderer, options.floors) : null;
  /** Finished systems wait here, keyed like their next cast, instead of rebuilding buffers. */
  const spareFx: LtkParticles[] = [];
  const SPARE_FX = 8;
  const release = (run: Running, retire = false) => {
    run.fx.object.removeFromParent();
    if (options.budget) options.budget.live -= slots;
    if (!retire && spareFx.length < SPARE_FX) { spareFx.push(run.fx); return; }
    run.fx.dispose();
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
    }).catch(() => { /* No replacement until every system of the action is usable. */ });
    warming.set(champion, pending); return pending;
  };
  const enqueue = (champion: string, variant: string, sourceId: string, targetIds: readonly string[], castIndex: number, action: 'cast' | 'attack', group?: string, partialTargets = false): boolean => {
      if (closed) return false;
      void warm(champion);
      const catalog = catalogs.get(champion) ?? library;
      const available = catalog.index?.skills[variant];
      const cues = selectTimeline(champion, available?.filter(cue => (cue.action ?? 'cast') === action), id => !!catalog.get(id), !!available);
      const source = findUnit(sourceId);
      if (!cues || !source?.alive || source.disposed) return false;
      const { spawns, unsupported } = mapSkillTimeline(cues, sourceId, targetIds, castIndex);
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
      return enqueue(champion, variant, sourceId, targetIds, 0, 'cast', group, true);
    },
    stopGroup(group: string) {
      for (let at = waiting.length - 1; at >= 0; at--) if (waiting[at].group === group) waiting.splice(at, 1);
      for (const run of running) if (run.group === group) { run.fx.stop(); run.until = Math.min(run.until, clock + .5); }
    },
    /** True means every active cue is covered and queued. Partial/unsupported actions
     * return false without enqueueing anything, so the host runs its entire fallback. */
    play(champion: string, sourceId: string, targetIds: readonly string[], castIndex = 0, action: TimelineAction = 'cast', extra?: TimelineVariant | LtkPlayOptions): boolean {
      if (closed) return false;
      void warm(champion);
      const context: LtkPlayOptions = extra !== undefined && typeof extra !== 'string' ? extra : {};
      const form = typeof extra === 'string' ? extra : undefined;
      const catalog = catalogs.get(champion) ?? library;
      const skill = context.skill ?? champion;
      if (skill !== champion && !skill.startsWith(champion + '-')) return false;
      const available = catalog.index?.skills[skill];
      let selected = available?.filter(cue => (cue.action ?? 'cast') === action
        && cue.variant === form
        && (cue.phase === undefined || cue.phase === castIndex % 3)
        && (!context.boardOnly || cue.location === 'board'));
      if (context.channelSeconds !== undefined) {
        if (!Number.isFinite(context.channelSeconds) || context.channelSeconds <= 0 || context.channelSeconds > 10) return false;
        const end = context.channelSeconds;
        selected = selected?.map(cue => cue.stopAfter === undefined ? cue : { ...cue,
          duration: Math.min(10, Math.max(0, end - cue.delay) + .5), stopAfter: Math.max(0, end - cue.delay) });
      }
      const cues = selectTimeline(champion, selected, id => !!catalog.get(id), !!available);
      const source = findUnit(sourceId);
      if (!cues) return false;
      const { spawns, unsupported } = mapSkillTimeline(cues, sourceId, targetIds, castIndex, context.board);
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
      for (const spawn of spawns) {
        let snapshot: WorldPoint | undefined;
        if (context.snapshotTargets && spawn.targetId) {
          const p = unitAnchor(findUnit(spawn.targetId)!.root, findUnit(spawn.targetId)!.body, spawn.event === 'hit' ? spawn.bone : spawn.targetBone);
          // Snapshot as a world point, rather than retaining the dead object's bones.
          const engine = p.originAt(0);
          snapshot = [engine[0] * AXIS_SIGN[0] * FX_SCALE, engine[1] * FX_SCALE, engine[2] * FX_SCALE];
        }
        waiting.push({ at: clock + spawn.delay, spawn, library: catalog, snapshot, persistent: independent && context.persistAcrossPhase });
      }
      return true;
    },
    /** End/recast releases a buff's slots before its replacement or explosion starts. */
    stopAction(sourceId: string, action: TimelineAction) {
      for (let at = waiting.length - 1; at >= 0; at--) if (waiting[at].spawn.sourceId === sourceId && (waiting[at].spawn.action ?? 'cast') === action) waiting.splice(at, 1);
      for (const run of running) if (run.source === sourceId && run.action === action) { release(run, true); running.delete(run); }
    },
    stopUnit(id: string) {
      for (let at = waiting.length - 1; at >= 0; at--) {
        const row = waiting[at];
        if ((needsLivingSource(row.spawn) && row.spawn.sourceId === id) || (!row.snapshot && row.spawn.targetId === id)) waiting.splice(at, 1);
      }
      for (const run of running) if ((run.boundToSource && run.source === id) || run.target === id) {
        run.fx.stop();
        if (run.group) run.until = Math.min(run.until, clock + .5);
      }
      const uuid = findUnit(id)?.root.uuid;
      if (uuid) for (let index = spareFx.length - 1; index >= 0; index--) {
        const key = spareFx[index]!.object.userData.poolKey;
        if (typeof key === 'string' && key.endsWith(`\n${uuid}`)) spareFx.splice(index, 1)[0]!.dispose();
      }
    },
    update(seconds: number, camera: Camera) {
      if (closed || !Number.isFinite(seconds) || seconds < 0) return;
      clock += seconds;
      // Finish last frame's systems before reserving capacity for new ones.
      for (const run of running) {
        run.fx.update(seconds, camera);
        if (run.fx.finished || clock + 1e-9 >= run.until) { release(run); running.delete(run); }
      }
      let starts = 0;
      for (let at = 0; at < waiting.length;) {
        const { at: when, spawn, library: catalog, snapshot, persistent, group } = waiting[at];
        if (when > clock) { at++; continue; }
        if (starts >= 6) break;
        waiting.splice(at, 1);
        // One-shots miss their moment after 0.3s. A grouped cue is a persistent skill
        // the controller still has registered; catch-up must start it while its
        // display duration remains. The 0.3s window and the six-start cap stay.
        const overdue = clock - when > 0.3 && !(group && clock < when + spawn.duration);
        if (overdue) continue;
        const source = findUnit(spawn.sourceId), target = spawn.targetId ? findUnit(spawn.targetId) : undefined;
        if ((needsLivingSource(spawn) && (!source?.alive || source.disposed)) || (spawn.targetId && !snapshot && (!target?.alive || target.disposed))) continue;
        const prepared = catalog.get(spawn.system); if (!prepared || prepared.empty) continue;
        // A full board keeps damage and beams by retiring the earliest caster flourish. Decorative newcomers are dropped.
        const importance = effectImportance(spawn);
        const blocked = () => running.size >= MAX_LTK_SYSTEMS || !!(options.budget && options.budget.live + slots > options.budget.max);
        while (blocked()) {
          const decision = admitEffect([...running].map(run => run.importance), importance, true);
          if (!decision.admit) break;
          const victim = [...running][decision.evict];
          if (!victim) break;
          release(victim); running.delete(victim);
        }
        if (blocked()) continue;
        const host = spawn.event === 'hit' ? target : source;
        const fixed = snapshot ?? spawn.point;
        const anchor = fixed && spawn.event !== 'projectile' ? pointAnchor(fixed) : unitAnchor(host!.root, host!.body, spawn.bone);
        const attachment = fixed && spawn.event !== 'projectile' ? undefined : host;
        const nextOptions = { anchor, attachment,
          target: fixed ? pointAnchor(fixed) : target ? unitAnchor(target.root, target.body, spawn.targetBone) : null,
          joints: fixed && spawn.event !== 'projectile' ? () => anchor : unitJoints(host!.root, host!.body),
          duration: spawn.duration, projectileSeconds: spawn.event === 'projectile' && !spawn.stationary ? spawn.travelSeconds : undefined,
          stopAfter: spawn.stopAfter, seed: seed++ };
        const poolKey = `${spawn.system}\n${attachment?.root.uuid ?? ''}`;
        const spared = spareFx.findIndex(item => item.object.userData.poolKey === poolKey);
        let fx: LtkParticles | undefined = spared >= 0 ? spareFx.splice(spared, 1)[0] : undefined;
        try {
          if (fx) fx.reuse(nextOptions);
          else { fx = createLtkParticles(prepared, nextOptions); fx.object.userData.poolKey = poolKey; }
          // Scheduling is frame-quantized; the visual still expires at its planned
          // timeline end, so a late flight start cannot displace its landing cue.
          fx.object.userData.ltkSystem = spawn.system;
          scene.add(fx.object); fx.update(clock - when, camera);
          if (options.budget) options.budget.live += slots;
          running.add({ source: spawn.sourceId, target: snapshot ? undefined : spawn.targetId, action: spawn.action ?? 'cast', until: when + spawn.duration, fx, persistent, boundToSource: needsLivingSource(spawn), group, importance }); starts++;
        } catch { fx?.dispose(); /* Prepared definitions were checked; context loss/resource failure drops only this visual. */ }
      }
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
    get queued() { return waiting.length; },
    dispose() { if (closed) return; closed = true; clear(); warming.clear(); catalogs.clear(); passes?.dispose(); flushDrawBufferPool(); flushFrameTargetPool(); library.dispose(); },
  };
}
