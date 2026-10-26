import type { Camera, Object3D, Scene, WebGLRenderer } from 'three';
import { applyStencil, stencilStates } from './rendering/utils/stencil';
import { createLtkParticles, unitAnchor, unitJoints, ROOT_PARTICLES, CHILD_PARTICLES, type LtkParticles } from './particles';
import type { VfxLibrary } from './loader';
import { mapSkillTimeline, selectTimeline, type TimelineSpawn } from './timeline';
import { createVfxPasses } from './rendering/passes';

/** Per-renderer reservation: at most 6 x (150 root + 100 child) particle slots. */
export const MAX_LTK_SYSTEMS = 6, MAX_LTK_QUEUED = 64;
export interface VfxUnit { root: Object3D; body: Object3D | null; alive: boolean; disposed?: boolean }
interface Waiting { at: number; spawn: TimelineSpawn; library: VfxLibrary }
interface Running { source: string; target?: string; until: number; fx: LtkParticles }
export function createLtkRuntime(library: VfxLibrary, scene: Object3D, findUnit: (id: string) => VfxUnit | undefined, options: { budget?: { live: number; max: number }; renderer?: WebGLRenderer; floors?: () => readonly Object3D[] } = {}) {
  let clock = 0, closed = false, seed = 1;
  const waiting: Waiting[] = [], running = new Set<Running>(), warming = new Map<string, Promise<void>>(), catalogs = new Map<string, VfxLibrary>();
  const slots = ROOT_PARTICLES + CHILD_PARTICLES;
  const passes = options.renderer ? createVfxPasses(options.renderer, options.floors) : null;
  const release = (run: Running) => { run.fx.dispose(); if (options.budget) options.budget.live -= slots; };
  const clear = () => { waiting.length = 0; for (const run of running) release(run); running.clear(); };
  const warm = (champion: string) => {
    if (closed) return Promise.resolve();
    const held = warming.get(champion); if (held) return held;
    const pending = library.champion(champion).then(async catalog => {
      if (closed || !catalog) return;
      catalogs.set(champion, catalog);
      const cues = catalog.index?.skills[champion] ?? [];
      await Promise.allSettled([...new Set(cues.map(cue => cue.system))].map(id => catalog.load(id)));
    }).catch(() => { /* No replacement until every system of the action is usable. */ });
    warming.set(champion, pending); return pending;
  };
  return {
    warm,
    /** True means every active cue is covered and queued. Partial/unsupported actions
     * return false without enqueueing anything, so the host runs its entire fallback. */
    play(champion: string, sourceId: string, targetIds: readonly string[], castIndex = 0, action: 'cast' | 'attack' = 'cast'): boolean {
      if (closed) return false;
      void warm(champion);
      const catalog = catalogs.get(champion) ?? library;
      const available = catalog.index?.skills[champion];
      const cues = selectTimeline(champion, available?.filter(cue => (cue.action ?? 'cast') === action), id => !!catalog.get(id), !!available);
      const source = findUnit(sourceId);
      if (!cues || !source?.alive || source.disposed) return false;
      const { spawns, unsupported } = mapSkillTimeline(cues, sourceId, targetIds, castIndex);
      if (unsupported.length || !spawns.length || waiting.length + spawns.length > MAX_LTK_QUEUED) return false;
      // All targets are required before suppressing the old cast; later disappearance cancels its visual.
      if (spawns.some(spawn => {
        if (spawn.targetId === undefined) return false;
        const target = findUnit(spawn.targetId);
        return !target?.alive || target.disposed;
      })) return false;
      for (const spawn of spawns) waiting.push({ at: clock + spawn.delay, spawn, library: catalog });
      return true;
    },
    stopUnit(id: string) {
      for (let at = waiting.length - 1; at >= 0; at--) if (waiting[at].spawn.sourceId === id || waiting[at].spawn.targetId === id) waiting.splice(at, 1);
      for (const run of running) if (run.source === id || run.target === id) run.fx.stop();
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
        const { at: when, spawn, library: catalog } = waiting[at];
        if (when > clock) { at++; continue; }
        if (starts >= 6) break;
        waiting.splice(at, 1);
        if (clock - when > 0.3 || running.size >= MAX_LTK_SYSTEMS || (options.budget && options.budget.live + slots > options.budget.max)) continue;
        const source = findUnit(spawn.sourceId), target = spawn.targetId ? findUnit(spawn.targetId) : undefined;
        if (!source?.alive || source.disposed || (spawn.targetId && (!target?.alive || target.disposed))) continue;
        const prepared = catalog.get(spawn.system); if (!prepared || prepared.empty) continue;
        const host = spawn.event === 'hit' ? target! : source;
        let fx: LtkParticles | undefined;
        try {
          fx = createLtkParticles(prepared, { anchor: unitAnchor(host.root, host.body, spawn.bone),
            attachment: host,
            target: target ? unitAnchor(target.root, target.body, spawn.targetBone) : null, joints: unitJoints(host.root, host.body),
            duration: spawn.duration, projectileSeconds: spawn.event === 'projectile' ? spawn.travelSeconds : undefined,
            stopAfter: spawn.stopAfter, seed: seed++ });
          // Scheduling is frame-quantized; the visual still expires at its planned
          // timeline end, so a late flight start cannot displace its landing cue.
          fx.object.userData.ltkSystem = spawn.system;
          scene.add(fx.object); fx.update(clock - when, camera);
          if (options.budget) options.budget.live += slots;
          running.add({ source: spawn.sourceId, target: spawn.targetId, until: when + spawn.duration, fx }); starts++;
        } catch { fx?.dispose(); /* Prepared definitions were checked; context loss/resource failure drops only this visual. */ }
      }
      const claims = [...running].flatMap(run => run.fx.stencils);
      const states = stencilStates(claims);
      claims.forEach((claim, index) => applyStencil(claim.material, states[index]));
    },
    clear,
    render(camera: Camera) {
      if (!passes) return;
      // The optional engine must leave the ordinary board draw untouched while idle
      // (including missing-data fallback); no frame/depth target is needed then.
      if (!running.size) { options.renderer!.render(scene as Scene, camera); return; }
      const needs = { early: false, late: false, soft: false };
      for (const { fx } of running) { needs.early ||= fx.passes.early; needs.late ||= fx.passes.late; needs.soft ||= fx.passes.soft; }
      passes.render(scene as Scene, camera, needs);
    },
    get active() { return running.size; },
    get queued() { return waiting.length; },
    dispose() { if (closed) return; closed = true; clear(); warming.clear(); catalogs.clear(); passes?.dispose(); library.dispose(); },
  };
}
