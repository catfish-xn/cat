import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Each particle set the runtime builds, in build order.
const built: any[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: unknown) => { const fx = real.createLtkParticles(prepared, options); built.push(fx); return fx; } };
});
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, LONG_BACKGROUND_MAX, LONG_RUN_SECONDS, MAX_LTK_SYSTEMS } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { PLAY_OUT_SYSTEMS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { syntheticSystem } from './vfx-ltk-synthetic';

// Fable 11-14: skill layers that were cut whole at their cue's end while much of them still showed now play out, whatever
// their event: emission stops at the cue's end, the run stays at most its own seconds, and as a hold tail it takes no
// system slot, sharing LONG_BACKGROUND_MAX with the long runs in the background.
const LISTED = 'fb4ea008', END = PLAY_OUT_SYSTEMS[LISTED]!;
const cue = (system: string, duration: number, event: TimelineCue['event'] = 'cast-start'): TimelineCue => ({ system, event, delay: 0, duration });
const skills: Record<string, TimelineCue[]> = {
  listed: [cue(LISTED, 0.6, 'hit')], plain: [cue('sample', 0.6, 'hit')],
  short: [cue('sample', LONG_RUN_SECONDS - 0.5)], long: [cue('sample', LONG_RUN_SECONDS)],
};

async function setup() {
  built.length = 0;
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: { sample: 'systems/sample.json', [LISTED]: `systems/${LISTED}.json` }, assets: { 'synthetic.tex': 'texture.png' }, skills }
    : syntheticSystem(),
  readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean }>();
  const find = (id: string) => { let unit = units.get(id); if (!unit) { unit = { root: new Group(), body: null, alive: true }; scene.add(unit.root); units.set(id, unit); } return unit; };
  const runtime = createLtkRuntime(library, scene, find);
  for (const champion of Object.keys(skills)) await runtime.warm(champion);
  const camera = new Camera(), step = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) runtime.update(1 / 60, camera); };
  // None plays out on its own here, so each stays to its own end.
  const kept = new WeakSet<object>();
  const keep = () => { for (const fx of built) if (!kept.has(fx)) { kept.add(fx); Object.defineProperty(fx, 'playedOut', { get: () => false }); } };
  return { runtime, scene, step, keep };
}
const fill = (runtime: Awaited<ReturnType<typeof setup>>['runtime'], skill: string, count: number) => {
  for (let i = 0; i < count; i++) expect(runtime.play(skill, `${skill}-${i}`, [`${skill}-${i}-target`])).toBe(true);
};

describe('vfx-ltk skill layers that play out at their cue end (PLAY_OUT_SYSTEMS)', () => {
  it('lists the layer as a hold tail of at most 1 s; Viktor\'s attack plays out its flight half only', () => {
    expect(END).toEqual({ seconds: 1, fade: 0.25, hold: true });
    expect(PLAY_OUT_SYSTEMS['87913524']).toEqual({ seconds: 1, fade: 0.25, hold: true, flightOnly: true });
  });

  it('a listed hit layer stops at its cue end and stays at most its own seconds; an unlisted one ends whole', async () => {
    const { runtime, scene, step, keep } = await setup();
    expect(runtime.play('listed', 'a', ['b'])).toBe(true);
    expect(runtime.play('plain', 'c', ['d'])).toBe(true);
    step(1 / 60); keep();
    const listed = built.find(fx => fx.object.userData.ltkSystem === LISTED), plain = built.find(fx => fx.object.userData.ltkSystem === 'sample');
    const stop = vi.spyOn(listed, 'stop'), ends = vi.spyOn(listed, 'endWithin');
    step(0.62);
    expect(plain.object.parent).toBeNull();
    expect(listed.object.parent).toBe(scene);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(ends).toHaveBeenCalledWith(END.seconds, END.fade);
    step(END.seconds - 0.1);
    expect(listed.object.parent).toBe(scene);
    step(0.15);
    expect(listed.object.parent).toBeNull();
    runtime.dispose();
  });

  it('playing out it takes no system slot', async () => {
    const { runtime, step, keep } = await setup();
    fill(runtime, 'short', MAX_LTK_SYSTEMS - 1);
    expect(runtime.play('listed', 'a', ['b'])).toBe(true);
    step(5 / 60); keep();
    expect(runtime.slots).toBe(MAX_LTK_SYSTEMS);
    step(0.6);
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS);
    expect(runtime.slots).toBe(MAX_LTK_SYSTEMS - 1);
    runtime.dispose();
  });

  it('hold tails and long runs in the background share LONG_BACKGROUND_MAX: past it a tail holds its slot', async () => {
    const { runtime, step, keep } = await setup();
    fill(runtime, 'long', LONG_BACKGROUND_MAX);
    step(1.1); keep();
    // The long runs are past their opening: every one of them is out of the count.
    expect(runtime.slots).toBe(0);
    expect(runtime.play('listed', 'a', ['b'])).toBe(true);
    step(1 / 60); keep();
    step(0.62);
    // The tail plays out, but the shared cap is taken by the earlier long runs: it keeps its slot.
    expect(runtime.active).toBe(LONG_BACKGROUND_MAX + 1);
    expect(runtime.slots).toBe(1);
    runtime.dispose();
  });
});
