import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Each particle set the runtime builds, with the options it was built with (anchor, target, attachment, flight).
const built: { options: any; fx: any }[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: unknown) => {
    const fx = real.createLtkParticles(prepared, options), entry = { options, fx };
    built.push(entry); const reuse = fx.reuse.bind(fx); fx.reuse = (next: unknown) => { entry.options = next; return reuse(next); };
    return fx;
  } };
});
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { FX_SCALE } from '../src/rendering/three-mode/vfx-ltk/particles';
import { AXIS_SIGN } from '../src/rendering/three-mode/vfx-ltk/space';
import { syntheticSystem } from './vfx-ltk-synthetic';

const toSystem = (x: number, y: number, z: number) => [x * AXIS_SIGN[0] / FX_SCALE, y / FX_SCALE, z / FX_SCALE];
const split: TimelineCue = { system: 'sample', action: 'cast', event: 'projectile', everyReceipt: true, fromPrimary: true, delay: 0, duration: 0.5, travelSeconds: 0.5, targetBone: 'ground' };
const index = (cues: readonly TimelineCue[]) => ({ version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills: { caitlyn: cues } });
async function setup(cues: readonly TimelineCue[]) {
  built.length = 0;
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index(cues) : syntheticSystem(), readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map(['caster', 'primary', 'other'].map((id, i) => {
    const root = new Group(); root.position.set(i * 200 + 5, 0, i * 90); scene.add(root); root.updateMatrixWorld();
    return [id, { root, body: null, alive: true, disposed: false }];
  }));
  const runtime = createLtkRuntime(library, scene, id => units.get(id), {});
  await runtime.warm('caitlyn');
  return { runtime, units };
}

describe('vfx-ltk projectile from the primary target (TimelineCue.fromPrimary, C71 split bombs)', () => {
  it('starts where the primary target stood when the play came, flies to each later receipt target, unattached', async () => {
    const { runtime, units } = await setup([split]);
    const at = units.get('primary')!.root.position.clone();
    expect(runtime.play('caitlyn', 'caster', ['primary', 'other'])).toBe(true);
    // The main bomb kills the primary target and the caster dies too: the split bomb still leaves the crater.
    units.get('primary')!.alive = false; units.get('caster')!.alive = false;
    runtime.update(1 / 30, new Camera());
    expect(built).toHaveLength(1);
    const { options } = built[0], to = units.get('other')!.root.position;
    expect(options.attachment).toBeUndefined();
    expect(options.anchor.originAt(0)).toEqual(toSystem(at.x, at.y, at.z));
    expect(options.target.originAt(0)).toEqual(toSystem(to.x, to.y, to.z));
    runtime.dispose();
  });
  it('a bomb striking the primary target again flies from its place to it; without that unit nothing plays', async () => {
    let { runtime } = await setup([split]);
    expect(runtime.play('caitlyn', 'caster', ['primary', 'other', 'primary'])).toBe(true);
    runtime.update(1 / 30, new Camera());
    expect(built).toHaveLength(2);
    runtime.dispose();
    ({ runtime } = await setup([split]));
    runtime.play('caitlyn', 'caster', ['gone', 'other']);
    runtime.update(1 / 30, new Camera());
    expect(built).toHaveLength(0);
    runtime.dispose();
  });
});
