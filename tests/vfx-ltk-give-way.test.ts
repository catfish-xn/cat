import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

const built: any[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: unknown) => { const fx = real.createLtkParticles(prepared, options); built.push(fx); return fx; } };
});
import { createVfxLibrary, parseIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, LTK_RUN_STATS, MAX_LTK_SYSTEMS } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { CUE_EXTRA_SKILLS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { syntheticSystem } from './vfx-ltk-synthetic';

// A give-way cue (TimelineCue.giveWay, Fable 11-21: Mel's bolt arcs) starts only in free room and never takes room another
// run holds; while it runs, any newcomer short of room ends it. Both count as LTK_RUN_STATS.gaveWay, never as drops.
const hit = (system: string, duration: number, action?: TimelineCue['action']): TimelineCue => ({ system, event: 'hit', delay: 0, duration, ...(action ? { action } : {}) });
const skills: Record<string, TimelineCue[]> = {
  long: [hit('filler', 5)], arc: [{ ...hit('arc', 3), giveWay: true }], swing: [hit('late', 0.6, 'attack')], body: [hit('late', 0.6)],
};
async function setup() {
  built.length = 0;
  for (const key of ['started', 'dropped', 'gaveWay', 'yielded'] as const) for (const id of Object.keys(LTK_RUN_STATS[key])) delete (LTK_RUN_STATS[key] as Record<string, number>)[id];
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: { filler: 'systems/filler.json', arc: 'systems/arc.json', late: 'systems/late.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills }
    : syntheticSystem(), readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean }>();
  const find = (id: string) => { let unit = units.get(id); if (!unit) { unit = { root: new Group(), body: null, alive: true }; units.set(id, unit); scene.add(unit.root); } return unit; };
  const runtime = createLtkRuntime(library, scene, find);
  for (const champion of Object.keys(skills)) await runtime.warm(champion);
  const camera = new Camera(), step = (seconds: number) => { for (let t = 0; t < seconds; t += 1 / 60) runtime.update(1 / 60, camera); };
  const live = (system: string) => built.filter(fx => fx.object.userData.ltkSystem === system && fx.object.parent === scene).length;
  return { runtime, step, live };
}

describe('give-way cues', () => {
  it('a full board: a give-way cue does not start, ends nothing, and counts as gave-way, not dropped', async () => {
    const { runtime, step, live } = await setup();
    for (let i = 0; i < MAX_LTK_SYSTEMS; i++) expect(runtime.play('long', `c${i}`, [`t${i}`])).toBe(true);
    step(0.1);
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS);
    runtime.play('arc', 'mel', ['foe']);
    step(0.1);
    expect(live('arc')).toBe(0); expect(live('filler')).toBe(MAX_LTK_SYSTEMS);
    expect(LTK_RUN_STATS.gaveWay.arc).toBe(1); expect(LTK_RUN_STATS.dropped.arc).toBeUndefined();
    runtime.dispose();
  });
  it('running give-way runs end for a plain attack short of room, oldest first, and the attack starts', async () => {
    const { runtime, step, live } = await setup();
    for (let i = 0; i < MAX_LTK_SYSTEMS - 2; i++) expect(runtime.play('long', `c${i}`, [`t${i}`])).toBe(true);
    runtime.play('arc', 'mel', ['a']); step(0.05); runtime.play('arc', 'mel', ['b']); step(0.05);
    expect(live('arc')).toBe(2); expect(runtime.active).toBe(MAX_LTK_SYSTEMS);
    expect(runtime.play('swing', 'hitter', ['victim'], 'attack')).toBe(true);
    step(1 / 60);
    expect(live('late')).toBe(1); expect(live('arc')).toBe(1); expect(live('filler')).toBe(MAX_LTK_SYSTEMS - 2);
    expect(LTK_RUN_STATS.gaveWay.arc).toBe(1); expect(LTK_RUN_STATS.dropped.late).toBeUndefined();
    runtime.dispose();
  });
  it('with room, it plays as any cue', async () => {
    const { runtime, step, live } = await setup();
    runtime.play('arc', 'mel', ['foe']); step(0.1);
    expect(live('arc')).toBe(1); expect(LTK_RUN_STATS.gaveWay.arc).toBeUndefined();
    runtime.dispose();
  });
  it('the index takes giveWay as a boolean only; Mel\'s bolt arc gives way', () => {
    const index = (giveWay: unknown) => ({ version: 1, systems: { a: 'a.json' }, assets: {}, skills: { jinx: [{ system: 'a', event: 'hit', delay: 0, duration: 1, giveWay }] } });
    expect(() => parseIndex(index(true))).not.toThrow();
    expect(() => parseIndex(index('yes'))).toThrow();
    expect(CUE_EXTRA_SKILLS['mel-bolt']!.every(cue => cue.giveWay === true)).toBe(true);
    expect(CUE_EXTRA_SKILLS['mel-bolt-hit']!.some(cue => cue.giveWay)).toBe(false);
  });
});
