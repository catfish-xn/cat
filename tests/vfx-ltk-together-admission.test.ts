import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, LTK_PASS_DEGRADE_AT, ltkRenderNeeds, MAX_LTK_SYSTEMS, MIN_RESERVE } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { syntheticSystem } from './vfx-ltk-synthetic';

// A together group (Vi's two row shockwaves, a beam beside its flight) takes one system slot, and a group that has waited
// for room gets the room that frees before a newcomer of no higher importance (11-13 admission audit: Vi's pair never
// started in an 8 v 8 because it needed two slots in one frame and single rows took every slot that freed).
const hit = (duration: number): TimelineCue => ({ system: 'sample', event: 'hit', delay: 0, duration });
const pair: TimelineCue[] = [-1, 1].map(() => ({ system: 'sample', event: 'projectile', delay: 0, duration: 0.6, travelSeconds: 0.3, together: 'pair' }));
const skills: Record<string, TimelineCue[]> = { long: [hit(1)], short: [hit(0.2)], mid: [hit(0.25)], newcomer: [hit(0.6)], pair };

async function setup(max: number) {
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills } : syntheticSystem(),
  readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean }>();
  const find = (id: string) => { let unit = units.get(id); if (!unit) { unit = { root: new Group(), body: null, alive: true }; units.set(id, unit); } return unit; };
  const budget = { live: 0, max }, runtime = createLtkRuntime(library, scene, find, { budget });
  // Warm measures each synthetic system below the floor: every run reserves MIN_RESERVE.
  for (const champion of Object.keys(skills)) await runtime.warm(champion);
  const camera = new Camera(), step = (frames = 1) => { for (let f = 0; f < frames; f++) runtime.update(1 / 60, camera); };
  return { runtime, scene, budget, step };
}

describe('vfx-ltk together admission', () => {
  it('a together group takes one system slot: a pair starts beside MAX_LTK_SYSTEMS − 1 runs', async () => {
    const { runtime, budget, step } = await setup(100000);
    for (let i = 0; i < MAX_LTK_SYSTEMS - 1; i++) expect(runtime.play('long', `c${i}`, [`t${i}`])).toBe(true);
    step(Math.ceil(MAX_LTK_SYSTEMS / 6));
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS - 1);
    expect(runtime.play('pair', 'vi', ['foe'])).toBe(true);
    step();
    // Both rows run (MAX_LTK_SYSTEMS + 1 runs in MAX_LTK_SYSTEMS slots), and each still holds its own particles.
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS + 1); expect(runtime.queued).toBe(0);
    expect(budget.live).toBe((MAX_LTK_SYSTEMS + 1) * MIN_RESERVE);
    // With every slot taken, a single critical row still waits.
    expect(runtime.play('long', 'late', ['t-late'])).toBe(true);
    step();
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS + 1); expect(runtime.queued).toBe(1);
    runtime.dispose();
  });

  it('room that frees goes to the group that has waited before a newcomer of the same importance', async () => {
    // Budget for 3.5 runs: two long hits and one short hit hold 3; the pair (2 runs) waits.
    const { runtime, scene, step } = await setup(3.5 * MIN_RESERVE);
    const shown = () => scene.children.filter(object => object.visible).length;
    expect(runtime.play('long', 'a', ['ta'])).toBe(true);
    expect(runtime.play('mid', 'b', ['tb'])).toBe(true);
    expect(runtime.play('short', 'c', ['tc'])).toBe(true);
    step();
    expect(runtime.active).toBe(3);
    expect(runtime.play('pair', 'vi', ['foe'])).toBe(true);
    step(2);
    expect(runtime.queued).toBe(2); expect(runtime.active).toBe(3);
    // The short hit ends at 0.2 s: room for one run, not the pair. A newcomer due that frame must not take it.
    while (runtime.active === 3) step();
    expect(runtime.play('newcomer', 'n', ['tn'])).toBe(true);
    step();
    expect(runtime.active).toBe(2); expect(runtime.queued).toBe(3);
    // The mid hit ends at 0.25 s: now the pair fits, and both of its rows start in that frame, before the newcomer.
    while (runtime.active === 2 && runtime.queued === 3) step();
    expect(runtime.active).toBe(3); expect(runtime.queued).toBe(1);
    expect(shown()).toBeGreaterThan(0);
    runtime.dispose();
  });

  it('a waiting group holds back newcomers of its own importance, never one that outranks it', async () => {
    const body = (together?: string): TimelineCue => ({ system: 'sample', event: 'cast-start', delay: 0, duration: 3, ...(together ? { together } : {}) });
    const run = async (newcomer: 'long' | 'body') => {
      const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
        ? { version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'texture.png' },
          skills: { bodypair: [body('pair'), body('pair')], body: [body()], long: [hit(1)], short: [hit(0.21)] } } : syntheticSystem(),
      readTexture: async () => new Texture() });
      const units = new Map<string, { root: Group; body: null; alive: boolean }>();
      const find = (id: string) => { let unit = units.get(id); if (!unit) { unit = { root: new Group(), body: null, alive: true }; units.set(id, unit); } return unit; };
      // Room for 2.5 runs: a long and a short hit hold 2, so the pair of skill bodies (2 runs) waits.
      const runtime = createLtkRuntime(library, new Scene(), find, { budget: { live: 0, max: 2.5 * MIN_RESERVE } });
      for (const champion of ['bodypair', 'body', 'long', 'short']) await runtime.warm(champion);
      const camera = new Camera(), step = () => runtime.update(1 / 60, camera);
      expect(runtime.play('long', 'a', ['ta'])).toBe(true); expect(runtime.play('short', 'b', ['tb'])).toBe(true);
      expect(runtime.play('bodypair', 'caster', [])).toBe(true);
      for (let f = 0; f < 12; f++) step();
      expect(runtime.active).toBe(2); expect(runtime.queued).toBe(2);
      // Due in the frame the short hit ends (0.21 s): room for one run, not the pair.
      expect(runtime.play(newcomer, 'n', newcomer === 'long' ? ['tn'] : [])).toBe(true);
      step();
      return runtime;
    };
    // A hit outranks the waiting bodies: it takes the room.
    let runtime = await run('long');
    expect(runtime.active).toBe(2); expect(runtime.queued).toBe(2);
    runtime.dispose();
    // Another skill body does not: the room stays for the pair that has waited.
    runtime = await run('body');
    expect(runtime.active).toBe(1); expect(runtime.queued).toBe(3);
    runtime.dispose();
  });

  it('counts a together group once for the pass degrade threshold, while early stays on', () => {
    const fx = { passes: { early: true, late: false, soft: true } };
    const systems = Array.from({ length: LTK_PASS_DEGRADE_AT }, () => fx);
    expect(ltkRenderNeeds(systems)).toEqual({ early: true, late: false, soft: false });
    // The same runs, one of them the second row of a pair: one slot fewer, under the threshold.
    expect(ltkRenderNeeds(systems, LTK_PASS_DEGRADE_AT - 1)).toEqual({ early: true, late: false, soft: true });
    const withLate = Array.from({ length: LTK_PASS_DEGRADE_AT }, () => ({ passes: { early: true, late: true, soft: false } }));
    expect(ltkRenderNeeds(withLate)).toEqual({ early: true, late: false, soft: false });
    expect(ltkRenderNeeds(withLate, LTK_PASS_DEGRADE_AT - 1)).toEqual({ early: true, late: true, soft: false });
  });
});
