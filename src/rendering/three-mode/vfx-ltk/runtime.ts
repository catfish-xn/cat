import type { Camera, Object3D } from 'three';
import { applyStencil, stencilStates } from './rendering/utils/stencil';
import { createLtkParticles, unitAnchor, unitJoints, ROOT_PARTICLES, CHILD_PARTICLES, type LtkParticles } from './particles';
import type { VfxLibrary } from './loader';
import { mapSkillTimeline, selectTimeline, type TimelineSpawn } from './timeline';

/** Per-renderer reservation: at most 6 x (150 root + 100 child) particle slots. */
export const MAX_LTK_SYSTEMS = 6, MAX_LTK_QUEUED = 64;
export interface VfxUnit { root: Object3D; body: Object3D | null; alive: boolean; disposed?: boolean }
interface Waiting { at: number; spawn: TimelineSpawn }
interface Running { source: string; target?: string; fx: LtkParticles }
export function createLtkRuntime(library: VfxLibrary, scene: Object3D, findUnit: (id: string) => VfxUnit | undefined, options: { budget?: { live: number; max: number } } = {}) {
  let clock = 0, closed = false, seed = 1;
  const waiting: Waiting[] = [], running = new Set<Running>(), warming = new Set<string>();
  const slots = ROOT_PARTICLES + CHILD_PARTICLES;
  const release = (run: Running) => { run.fx.dispose(); if (options.budget) options.budget.live -= slots; };
  const clear = () => { waiting.length = 0; for (const run of running) release(run); running.clear(); };
  const warm = (champion: string) => {
    if (closed || !['jinx', 'vi'].includes(champion) || warming.has(champion)) return;
    warming.add(champion);
    void library.ready.then(index => {
      if (closed) return;
      const cues = index?.skills[champion as 'jinx' | 'vi'] ?? [];
      return Promise.all(cues.map(cue => library.load(cue.system)));
    }).catch(() => { /* No replacement until every system is usable. */ });
  };
  return {
    warm,
    /** True means the converted cast owns this event; false means execute the existing fallback. */
    play(champion: string, sourceId: string, targetIds: readonly string[]): boolean {
      if (closed) return false;
      warm(champion);
      const cues = selectTimeline(champion, library.index?.skills[champion as 'jinx' | 'vi'], id => !!library.get(id));
      if (!cues || !findUnit(sourceId)?.alive) return false;
      const spawns = mapSkillTimeline(cues, sourceId, targetIds);
      if (!spawns.length || waiting.length + spawns.length > MAX_LTK_QUEUED) return false;
      // All targets are required before suppressing the old cast; later disappearance cancels its visual.
      if (spawns.some(spawn => spawn.targetId && !findUnit(spawn.targetId)?.alive)) return false;
      for (const spawn of spawns) waiting.push({ at: clock + spawn.delay, spawn });
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
        if (run.fx.finished) { release(run); running.delete(run); }
      }
      let starts = 0;
      for (let at = 0; at < waiting.length;) {
        const { at: when, spawn } = waiting[at];
        if (when > clock) { at++; continue; }
        if (starts >= 6) break;
        waiting.splice(at, 1);
        if (clock - when > 0.3 || running.size >= MAX_LTK_SYSTEMS || (options.budget && options.budget.live + slots > options.budget.max)) continue;
        const source = findUnit(spawn.sourceId), target = spawn.targetId ? findUnit(spawn.targetId) : undefined;
        if (!source?.alive || source.disposed || (spawn.targetId && (!target?.alive || target.disposed))) continue;
        const prepared = library.get(spawn.system); if (!prepared) continue;
        const host = spawn.event === 'hit' ? target! : source;
        let fx: LtkParticles | undefined;
        try {
          fx = createLtkParticles(prepared, { anchor: unitAnchor(host.root, host.body, spawn.bone),
            target: target ? unitAnchor(target.root, target.body) : null, joints: unitJoints(host.root, host.body),
            duration: spawn.duration, projectileSeconds: spawn.event === 'projectile' ? spawn.travelSeconds : undefined,
            stopAfter: spawn.stopAfter, seed: seed++ });
          scene.add(fx.object); fx.update(0, camera);
          if (options.budget) options.budget.live += slots;
          running.add({ source: spawn.sourceId, target: spawn.targetId, fx }); starts++;
        } catch { fx?.dispose(); /* Prepared definitions were checked; context loss/resource failure drops only this visual. */ }
      }
      const claims = [...running].flatMap(run => run.fx.stencils);
      const states = stencilStates(claims);
      claims.forEach((claim, index) => applyStencil(claim.material, states[index]));
    },
    clear,
    get active() { return running.size; },
    get queued() { return waiting.length; },
    dispose() { if (closed) return; closed = true; clear(); library.dispose(); },
  };
}
