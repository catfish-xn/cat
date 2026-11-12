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
import { createLtkRuntime, PLAY_OUT_CAP } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { CUE_OVERRIDES, PLAY_OUT_SYSTEMS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { syntheticSystem } from './vfx-ltk-synthetic';

// A listed system (PLAY_OUT_SYSTEMS) and an unlisted one, both plain caster-to-target projectiles.
const LISTED = [...PLAY_OUT_SYSTEMS][0]!, PLAIN = 'sample';
const flight = (system: string): TimelineCue => ({ system, event: 'projectile', delay: 0, duration: 0.6, travelSeconds: 0.6, bone: 'ground', targetBone: 'ground' });
const index = { version: 1, systems: { [LISTED]: 'systems/listed.json', [PLAIN]: 'systems/plain.json' }, assets: { 'synthetic.tex': 'texture.png' },
  skills: { gangplank: [flight(LISTED), flight(PLAIN)] } };

async function setup() {
  built.length = 0;
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index : syntheticSystem(), readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map(['caster', 'target'].map((id, i) => {
    const root = new Group(); root.position.set(i * 20 + 5, 0, i * 30); scene.add(root); root.updateMatrixWorld();
    return [id, { root, body: null, alive: true }];
  }));
  const runtime = createLtkRuntime(library, scene, id => units.get(id), {});
  await runtime.warm('gangplank');
  expect(runtime.play('gangplank', 'caster', ['target'])).toBe(true);
  runtime.update(1 / 30, new Camera());
  expect(built).toHaveLength(2);
  const [listed, plain] = built;
  // Never played out on its own here, so only the cap ends it.
  Object.defineProperty(listed, 'playedOut', { get: () => false });
  return { runtime, scene, listed, plain, stop: vi.spyOn(listed, 'stop'), advance: (seconds: number) => { for (let t = 0; t < seconds; t += 1 / 30) runtime.update(1 / 30, new Camera()); } };
}

describe('vfx-ltk projectiles that play out (cue-overrides.ts PLAY_OUT_SYSTEMS)', () => {
  it('lists only systems the live lists fire as projectiles', () => {
    expect(PLAY_OUT_SYSTEMS.size).toBeGreaterThan(0);
    const projectiles = new Set(Object.values(CUE_OVERRIDES).flat().filter(cue => cue.event === 'projectile').map(cue => cue.system));
    for (const system of PLAY_OUT_SYSTEMS) expect(projectiles.has(system), system).toBe(true);
  });

  it('a listed projectile stops at its end and stays until it has played out, PLAY_OUT_CAP at most; an unlisted one ends whole', async () => {
    const { runtime, scene, listed, plain, stop, advance } = await setup();
    advance(0.6);
    expect(plain.object.parent).toBeNull();
    expect(listed.object.parent).toBe(scene);
    expect(stop).toHaveBeenCalledTimes(1);
    // Playing out is no longer playing: the caster's next action is not held up by it.
    expect(runtime.playing('caster')).toBe(false);
    advance(PLAY_OUT_CAP - 0.15);
    expect(listed.object.parent).toBe(scene);
    advance(0.2);
    expect(listed.object.parent).toBeNull();
    runtime.dispose();
  });

  it('a listed projectile whose target dies as it lands still plays out; an unlisted one goes at its end', async () => {
    const { runtime, scene, listed, plain, advance } = await setup();
    advance(0.5);
    runtime.stopUnit('target');
    advance(0.2);
    expect(plain.object.parent).toBeNull();
    expect(listed.object.parent).toBe(scene);
    advance(PLAY_OUT_CAP - 0.3);
    expect(listed.object.parent).toBe(scene);
    advance(0.2);
    expect(listed.object.parent).toBeNull();
    runtime.dispose();
  });
});
