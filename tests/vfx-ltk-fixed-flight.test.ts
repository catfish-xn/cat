import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Each particle set the runtime builds, with the options it was built with.
const built: { options: any }[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: unknown) => { built.push({ options }); return real.createLtkParticles(prepared, options); } };
});
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { FIRST_FLIGHT, flightTime } from '../src/rendering/three-mode/vfx-ltk/engine/model/rig';
import { projectileFlight } from '../src/rendering/three-mode/vfx-ltk/particles';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { syntheticSystem } from './vfx-ltk-synthetic';

// 11-15 (Fable): Ziggs's bomb flies its travelSeconds whatever the distance, so it lands as his explosion starts; every
// other projectile keeps its speed taken from the distance at spawn.
const shot = (fixedFlight?: boolean): TimelineCue => ({ system: 'sample', event: 'projectile', delay: 0, duration: 0.5, travelSeconds: 0.5, targetBone: 'C_BUFFBONE_GLB_CHEST_LOC', ...(fixedFlight === undefined ? {} : { fixedFlight }) });

/** Builds one projectile from a caster to a target `apart` units away (height `rise` apart); returns its flight time. */
async function flight(cue: TimelineCue, apart: number, rise = 0) {
  built.length = 0;
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills: { ziggs: [cue] } } : syntheticSystem(),
  readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map(['caster', 'target'].map((id, i) => {
    const root = new Group(); root.position.set(i * apart, i * rise, 0); scene.add(root); root.updateMatrixWorld();
    return [id, { root, body: null, alive: true }];
  }));
  const runtime = createLtkRuntime(library, scene, id => units.get(id), {});
  await runtime.warm('ziggs');
  expect(runtime.play('ziggs', 'caster', ['target'])).toBe(true);
  runtime.update(1 / 60, new Camera());
  const { options } = built[0]!;
  const from = options.anchor.originAt(0), to = options.target.originAt(0);
  const distance = Math.hypot(...from.map((v: number, i: number) => v - to[i]));
  const motion = { kind: 'missile', from, to, flight: options.fixedTime ? projectileFlight(options.projectileSeconds)
    : { ...FIRST_FLIGHT, movement: { kind: 'fixedSpeed', speed: distance / options.projectileSeconds } } } as never;
  runtime.dispose();
  return { fixed: !!options.fixedTime, arrival: flightTime(motion) };
}

describe('vfx-ltk fixed-time projectile flights (TimelineCue.fixedFlight)', () => {
  it('a fixedFlight cue arrives its travelSeconds after launch at any distance or height', async () => {
    for (const [apart, rise] of [[60, 0], [240, 0], [240, 120]]) {
      const run = await flight(shot(true), apart, rise);
      expect(run.fixed).toBe(true);
      expect(run.arrival).toBeCloseTo(0.5, 2);
    }
  });

  it('a cue without it keeps the speed taken from the distance (unchanged)', async () => {
    for (const cue of [shot(), shot(false)]) {
      const run = await flight(cue, 240, 120);
      expect(run.fixed).toBe(false);
    }
  });

  it('only Ziggs\'s bomb is a fixed flight among the overrides', () => {
    const fixed = Object.entries(CUE_OVERRIDES).flatMap(([champion, cues]) => cues.filter(cue => cue.fixedFlight).map(cue => `${champion}:${cue.system}`));
    expect(fixed).toEqual(['ziggs:52963b0a']);
  });
});
