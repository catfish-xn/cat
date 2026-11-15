import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, OFF_SLOT_MAX, LONG_RUN_OPEN, LONG_RUN_SECONDS, MAX_LTK_SYSTEMS, MIN_RESERVE } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { syntheticSystem } from './vfx-ltk-synthetic';

// A long run (LONG_RUN_SECONDS or more) gives up its system slot after LONG_RUN_OPEN seconds and keeps playing; it still
// holds its particles and still counts toward the pass degrade, and only OFF_SLOT_MAX of them are out at once.
const body = (duration: number): TimelineCue => ({ system: 'sample', event: 'cast-start', delay: 0, duration });
const skills: Record<string, TimelineCue[]> = { long: [body(LONG_RUN_SECONDS)], short: [body(LONG_RUN_SECONDS - 0.5)],
  hit: [{ system: 'sample', event: 'hit', delay: 0, duration: 0.6 }] };

async function setup(max = 100000) {
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills } : syntheticSystem(),
  readTexture: async () => new Texture() });
  const units = new Map<string, { root: Group; body: null; alive: boolean }>();
  const find = (id: string) => { let unit = units.get(id); if (!unit) { unit = { root: new Group(), body: null, alive: true }; units.set(id, unit); } return unit; };
  const budget = { live: 0, max }, runtime = createLtkRuntime(library, new Scene(), find, { budget });
  // Warm measures the synthetic system below the floor: every run reserves MIN_RESERVE.
  for (const champion of Object.keys(skills)) await runtime.warm(champion);
  const camera = new Camera(), step = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) runtime.update(1 / 60, camera); };
  return { runtime, budget, step };
}
const fill = (runtime: Awaited<ReturnType<typeof setup>>['runtime'], skill: string, count: number) => {
  for (let i = 0; i < count; i++) expect(runtime.play(skill, `${skill}-${i}`, [])).toBe(true);
};

describe('vfx-ltk long runs in the background', () => {
  it('a long run stops taking a system slot after LONG_RUN_OPEN seconds and keeps playing; a shorter one does not', async () => {
    const { runtime, step } = await setup();
    fill(runtime, 'long', MAX_LTK_SYSTEMS);
    step(Math.ceil(MAX_LTK_SYSTEMS / 6) / 60);
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS); expect(runtime.slots).toBe(MAX_LTK_SYSTEMS);
    // Before its opening is over a long run still holds its slot: a hit waits.
    expect(runtime.play('hit', 'caster', ['victim'])).toBe(true);
    step(1 / 60);
    expect(runtime.queued).toBe(1);
    runtime.clear();
    // Past the opening the long runs leave the count (at most OFF_SLOT_MAX of them) and keep playing.
    fill(runtime, 'long', MAX_LTK_SYSTEMS);
    step(LONG_RUN_OPEN + 0.1);
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS);
    expect(runtime.slots).toBe(MAX_LTK_SYSTEMS - OFF_SLOT_MAX);
    // A run under LONG_RUN_SECONDS holds its slot all along.
    runtime.clear();
    fill(runtime, 'short', 3);
    step(LONG_RUN_OPEN + 0.1);
    expect(runtime.active).toBe(3); expect(runtime.slots).toBe(3);
    runtime.dispose();
  });

  it('room a long run left in the background lets a hit start beside it, and the long run plays to its end', async () => {
    const { runtime, step } = await setup();
    fill(runtime, 'long', MAX_LTK_SYSTEMS);
    step(LONG_RUN_OPEN + 0.1);
    expect(runtime.play('hit', 'caster', ['victim'])).toBe(true);
    step(1 / 60);
    expect(runtime.queued).toBe(0); expect(runtime.active).toBe(MAX_LTK_SYSTEMS + 1);
    // Nothing was evicted for it, and the long runs end on their own time.
    step(LONG_RUN_SECONDS - LONG_RUN_OPEN - 0.3);
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS);
    step(0.5);
    expect(runtime.active).toBe(0);
    runtime.dispose();
  });

  it('a long run in the background still holds its particles in the budget', async () => {
    // Budget for exactly MAX_LTK_SYSTEMS runs: the slots a long run gave up do not free particle room.
    const { runtime, budget, step } = await setup(MAX_LTK_SYSTEMS * MIN_RESERVE);
    fill(runtime, 'long', MAX_LTK_SYSTEMS);
    step(LONG_RUN_OPEN + 0.1);
    expect(runtime.slots).toBe(MAX_LTK_SYSTEMS - OFF_SLOT_MAX);
    expect(budget.live).toBe(MAX_LTK_SYSTEMS * MIN_RESERVE);
    expect(runtime.play('hit', 'caster', ['victim'])).toBe(true);
    step(1 / 60);
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS); expect(runtime.queued).toBe(1);
    runtime.dispose();
  });

  it('long runs in the background still count toward the pass degrade', async () => {
    const { runtime, step } = await setup();
    fill(runtime, 'long', 5);
    step(LONG_RUN_OPEN + 0.1);
    expect(runtime.slots).toBe(0);
    expect(runtime.passSlots).toBe(5);
    runtime.dispose();
  });

  it('only OFF_SLOT_MAX long runs leave the count at once; the rest hold their slots as before', async () => {
    const { runtime, step } = await setup();
    fill(runtime, 'long', OFF_SLOT_MAX + 4);
    step(LONG_RUN_OPEN + 0.1);
    expect(runtime.active).toBe(OFF_SLOT_MAX + 4);
    expect(runtime.slots).toBe(4); expect(runtime.passSlots).toBe(OFF_SLOT_MAX + 4);
    runtime.dispose();
  });
});
