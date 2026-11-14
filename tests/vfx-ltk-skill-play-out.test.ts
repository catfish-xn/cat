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
import { createLtkRuntime, LONG_BACKGROUND_MAX, LONG_RUN_SECONDS } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { PLAY_OUT_SYSTEMS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { syntheticSystem } from './vfx-ltk-synthetic';

// Fable 11-14: projectiles cut whole as they land, while much of them still showed, play out for at most 1 s as hold
// tails; Viktor's attack plays out its flight half only. Hold tails and long runs in the background share one cap.
const LISTED = 'ee2e840c';
const skills: Record<string, TimelineCue[]> = {
  listed: [{ system: LISTED, event: 'projectile', delay: 0, duration: 0.4, travelSeconds: 0.4, bone: 'ground', targetBone: 'ground' }],
  long: [{ system: 'sample', event: 'cast-start', delay: 0, duration: LONG_RUN_SECONDS }],
};

async function setup() {
  built.length = 0;
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: { sample: 'systems/sample.json', [LISTED]: `systems/${LISTED}.json` }, assets: { 'synthetic.tex': 'texture.png' }, skills }
    : syntheticSystem(),
  readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean }>();
  const find = (id: string) => { let unit = units.get(id); if (!unit) { unit = { root: new Group(), body: null, alive: true }; unit.root.position.set(units.size * 40, 0, 0); scene.add(unit.root); unit.root.updateMatrixWorld(); units.set(id, unit); } return unit; };
  const runtime = createLtkRuntime(library, scene, find);
  for (const champion of Object.keys(skills)) await runtime.warm(champion);
  const camera = new Camera(), step = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) runtime.update(1 / 60, camera); };
  // None plays out on its own here, so each stays to its own end.
  const kept = new WeakSet<object>();
  const keep = () => { for (const fx of built) if (!kept.has(fx)) { kept.add(fx); Object.defineProperty(fx, 'playedOut', { get: () => false }); } };
  return { runtime, step, keep };
}

describe('vfx-ltk projectiles that play out at most 1 s (PLAY_OUT_SYSTEMS, 11-14)', () => {
  it('lists Jayce\'s crystal, Jinx\'s rocket and Zyra\'s E impact as 1 s hold tails, and Viktor\'s attack by its flight half only', () => {
    for (const id of ['ee2e840c', '8b59c09d', '857fe049']) expect(PLAY_OUT_SYSTEMS[id]).toEqual({ seconds: 1, fade: 0.25, hold: true });
    expect(PLAY_OUT_SYSTEMS['87913524']).toEqual({ seconds: 1, fade: 0.25, hold: true, flightOnly: true });
  });

  it('hold tails and long runs in the background share LONG_BACKGROUND_MAX: past it a tail holds its slot', async () => {
    const { runtime, step, keep } = await setup();
    for (let i = 0; i < LONG_BACKGROUND_MAX; i++) expect(runtime.play('long', `long-${i}`, [])).toBe(true);
    step(1.1); keep();
    // The long runs are past their opening: every one of them is out of the count.
    expect(runtime.slots).toBe(0);
    expect(runtime.play('listed', 'a', ['b'])).toBe(true);
    step(1 / 60); keep();
    step(0.45);
    // The listed projectile has landed and plays out, but the shared cap is taken by the earlier long runs: it keeps its slot.
    expect(runtime.active).toBe(LONG_BACKGROUND_MAX + 1);
    expect(runtime.slots).toBe(1);
    runtime.dispose();
  });
});
