import { Camera, Group, Scene, Texture } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RigModel } from '../src/rendering/three-mode/vfx-ltk/engine/model/rig';
import { constant, num, syntheticSystem } from './vfx-ltk-synthetic';

// Jinx's rocket flight through the real render path (createLtkRuntime → particles → driver): the flight the bridge asks for,
// flown in at a steady pace and waiting (TimelineCue.arriveShare), reaches the engine as that movement. Synthetic system and
// index (made-up numbers): only the driver is wrapped, to read the rig it is steered with.
const rigs: RigModel[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/engine/simulation/driver', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/rendering/three-mode/vfx-ltk/engine/simulation/driver')>();
  return { ...actual, createDriver: ((...args: Parameters<typeof actual.createDriver>) => {
    const driver = actual.createDriver(...args), steer = driver.steer.bind(driver);
    driver.steer = (rig: RigModel) => { rigs.push(rig); return steer(rig); };
    return driver;
  }) as typeof actual.createDriver };
});

afterEach(() => { rigs.length = 0; });

describe("Jinx's rocket flight in the runtime", () => {
  it('plays jinx-rocket-flight as a flight that reaches its landing point part-way and waits there', async () => {
    const { createVfxLibrary } = await import('../src/rendering/three-mode/vfx-ltk/loader');
    const { createLtkRuntime } = await import('../src/rendering/three-mode/vfx-ltk/runtime');
    const system = syntheticSystem({ rate: constant(num(30)), lifetime: num(2), particleLifetime: constant(num(1)) });
    const library = createVfxLibrary('/root/', {
      readJson: async url => url.endsWith('index.json')
        ? { version: 1, systems: { '8b59c09d': 'systems/rocket.json' }, assets: { 'synthetic.tex': 'textures/sample.png' }, skills: { jinx: [{ system: '8b59c09d', event: 'cast-start', delay: 0, duration: 1 }] } }
        : system,
      readTexture: async () => new Texture(),
    });
    const scene = new Scene(), camera = new Camera(), root = new Group(), body = new Group(); root.add(body);
    const foeRoot = new Group(), foeBody = new Group(); foeRoot.add(foeBody); foeRoot.position.set(200, 0, 0); foeRoot.updateMatrixWorld(true);
    const runtime = createLtkRuntime(library, scene, id => id === 'jx' ? { root, body, alive: true } : id === 'foe' ? { root: foeRoot, body: foeBody, alive: true } : undefined);
    await runtime.warm('jinx'); await library.load('8b59c09d');
    for (const arriveShare of [0.4, undefined]) {
      rigs.length = 0;
      expect(runtime.play('jinx', 'jx', ['foe'], 'cast', { skill: 'jinx-rocket-flight', flightSeconds: 0.3, board: [200, 50, 0], snapshotTargets: true,
        ...(arriveShare !== undefined ? { arriveShare } : {}) })).toBe(true);
      for (let t = 0; t < 0.2; t += 0.05) runtime.update(0.05, camera);
      const flight = rigs.map(rig => rig.motion).find(motion => motion.kind === 'missile');
      expect(flight, `arriveShare ${arriveShare}`).toBeDefined();
      const movement = (flight as Extract<RigModel['motion'], { kind: 'missile' }>).flight.movement;
      if (arriveShare !== undefined) expect(movement).toEqual({ kind: 'fixedTimeThenHold', travelTime: 0.3, arriveShare });
      else expect(movement.kind).not.toBe('fixedTimeThenHold');
      for (let t = 0; t < 1; t += 0.05) runtime.update(0.05, camera);
    }
    runtime.dispose(); library.dispose();
  });

  it('plays the rocket\'s muzzle flash facing the board point it is aimed at, not the unit it targets', async () => {
    const { createVfxLibrary } = await import('../src/rendering/three-mode/vfx-ltk/loader');
    const { createLtkRuntime } = await import('../src/rendering/three-mode/vfx-ltk/runtime');
    const system = syntheticSystem({ rate: constant(num(30)), lifetime: num(2), particleLifetime: constant(num(1)) });
    const library = createVfxLibrary('/root/', {
      readJson: async url => url.endsWith('index.json')
        ? { version: 1, systems: { '449d6617': 'systems/flash.json' }, assets: { 'synthetic.tex': 'textures/sample.png' }, skills: { jinx: [{ system: '449d6617', event: 'cast-start', delay: 0, duration: 1 }] } }
        : system,
      readTexture: async () => new Texture(),
    });
    const scene = new Scene(), camera = new Camera(), root = new Group(), body = new Group(); root.add(body);
    const foeRoot = new Group(), foeBody = new Group(); foeRoot.add(foeBody); foeRoot.updateMatrixWorld(true);
    const runtime = createLtkRuntime(library, scene, id => id === 'jx' ? { root, body, alive: true } : id === 'foe' ? { root: foeRoot, body: foeBody, alive: true } : undefined);
    await runtime.warm('jinx'); await library.load('449d6617');
    // The basis the flash's anchor faces with, for a play: the unit to its right, the point (or the unit) straight ahead.
    const basisOf = (foeAt: [number, number, number], aimPoint?: [number, number, number]) => {
      foeRoot.position.set(...foeAt); foeRoot.updateMatrixWorld(true); rigs.length = 0;
      expect(runtime.play('jinx', 'jx', ['foe'], 'cast', { skill: 'jinx-rocket-flash', snapshotTargets: true, ...(aimPoint ? { aimPoint } : {}) })).toBe(true);
      runtime.update(0.05, camera);
      const motion = rigs.map(rig => rig.motion).find(m => m.kind === 'bone') as Extract<RigModel['motion'], { kind: 'bone' }>;
      const out = new Float32Array(9);
      motion.anchor.basisInto(0, out);
      for (let t = 0; t < 1.5; t += 0.05) runtime.update(0.05, camera);
      return [...out];
    };
    const aimedAhead = basisOf([200, 0, 0], [0, 0, 200]), unitAhead = basisOf([0, 0, 200]), unitRight = basisOf([200, 0, 0]);
    aimedAhead.forEach((value, index) => expect(value).toBeCloseTo(unitAhead[index]!, 6));
    expect(aimedAhead.some((value, index) => Math.abs(value - unitRight[index]!) > 0.5)).toBe(true);
    runtime.dispose(); library.dispose();
  });
});
