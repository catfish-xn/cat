import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, LONG_RUN_OPEN, LONG_RUN_SECONDS, MAX_LTK_SYSTEMS, MIN_RESERVE, OFF_SLOT_MAX } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { syntheticSystem } from './vfx-ltk-synthetic';

// A fan-out (one play()'s cue on several targets, a row each) takes one system slot: its rows after the first draw in the
// shared OFF_SLOT_MAX room. Each row still holds its own particles and still counts toward the pass degrade.
const body = (duration: number): TimelineCue => ({ system: 'sample', event: 'cast-start', delay: 0, duration });
const skills: Record<string, TimelineCue[]> = {
  short: [body(LONG_RUN_SECONDS - 0.5)], long: [body(LONG_RUN_SECONDS + 0.5)],
  nami: [{ system: 'sample', event: 'hit', delay: 0, duration: 0.6 }],
  twice: [{ system: 'sample', event: 'hit', delay: 0, duration: 0.6 }, { system: 'sample', event: 'hit', delay: 0, duration: 0.6 }],
};
const targets = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);

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
  const fill = (skill: string, count: number) => { for (let i = 0; i < count; i++) expect(runtime.play(skill, `${skill}-${i}`, [])).toBe(true); };
  return { runtime, budget, step, fill };
}

describe('vfx-ltk fan-out rows', () => {
  it('a hit on five targets takes one system slot beside MAX_LTK_SYSTEMS − 1 runs, and every row still counts for the passes', async () => {
    const { runtime, step, fill } = await setup();
    fill('short', MAX_LTK_SYSTEMS - 1);
    step(Math.ceil(MAX_LTK_SYSTEMS / 6) / 60);
    expect(runtime.slots).toBe(MAX_LTK_SYSTEMS - 1);
    expect(runtime.play('nami', 'nami', targets(5))).toBe(true);
    step(1 / 60);
    expect(runtime.queued).toBe(0); expect(runtime.active).toBe(MAX_LTK_SYSTEMS - 1 + 5);
    expect(runtime.slots).toBe(MAX_LTK_SYSTEMS);
    expect(runtime.passSlots).toBe(MAX_LTK_SYSTEMS - 1 + 5);
    runtime.dispose();
  });

  it('each row of a fan-out still holds its own particles in the budget', async () => {
    // Room for MAX_LTK_SYSTEMS + 1 runs: beside MAX_LTK_SYSTEMS − 1 runs only two of the five rows fit, whatever the slots.
    const { runtime, budget, step, fill } = await setup((MAX_LTK_SYSTEMS + 1) * MIN_RESERVE);
    fill('short', MAX_LTK_SYSTEMS - 1);
    step(Math.ceil(MAX_LTK_SYSTEMS / 6) / 60);
    expect(runtime.play('nami', 'nami', targets(5))).toBe(true);
    step(1 / 60);
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS + 1); expect(runtime.queued).toBe(3);
    expect(budget.live).toBe((MAX_LTK_SYSTEMS + 1) * MIN_RESERVE);
    runtime.dispose();
  });

  it('a fan-out shares the OFF_SLOT_MAX room with long runs: once it is full, each further row takes a slot', async () => {
    const { runtime, step, fill } = await setup();
    // OFF_SLOT_MAX long runs past their opening fill the room; short runs take every slot but one.
    fill('long', OFF_SLOT_MAX);
    step(LONG_RUN_OPEN + 0.1);
    fill('short', MAX_LTK_SYSTEMS - 1);
    step(Math.ceil(MAX_LTK_SYSTEMS / 6) / 60);
    expect(runtime.slots).toBe(MAX_LTK_SYSTEMS - 1);
    expect(runtime.play('nami', 'nami', targets(3))).toBe(true);
    step(1 / 60);
    // The first row takes the last slot; the other two find no room, in the slots or off them.
    expect(runtime.active).toBe(OFF_SLOT_MAX + MAX_LTK_SYSTEMS); expect(runtime.queued).toBe(2);
    runtime.dispose();
  });

  it('two rows on the same target are not a fan-out: each takes a slot', async () => {
    const { runtime, step, fill } = await setup();
    fill('short', MAX_LTK_SYSTEMS - 1);
    step(Math.ceil(MAX_LTK_SYSTEMS / 6) / 60);
    expect(runtime.play('twice', 'caster', ['t0'])).toBe(true);
    step(1 / 60);
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS); expect(runtime.queued).toBe(1);
    runtime.dispose();
  });
});
