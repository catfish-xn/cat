import { Camera, Group, Matrix4, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// The anchor each particle set the runtime builds was given.
const built: any[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: any) => { built.push(options); return real.createLtkParticles(prepared, options); } };
});
import { pointAnchor } from '../src/rendering/three-mode/vfx-ltk/particles';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { syntheticSystem } from './vfx-ltk-synthetic';
import { AXIS_SIGN } from '../src/rendering/three-mode/vfx-ltk/space';

// A board point's effect faces a given point as a unit standing there and looking at it would (Powder's explosion faced
// back toward her on each enemy it hit; on its cell it lost that turn and its upright layers turned their backs to the camera).
const basis = (anchor: ReturnType<typeof pointAnchor>) => Array.from(anchor.basisInto(0, new Float32Array(9) as never) as ArrayLike<number>);
const turned = (yaw: number) => { const e = new Matrix4().makeRotationY(yaw).elements, out: number[] = [];
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) out.push(e[column * 4 + row]! * AXIS_SIGN[row]! * AXIS_SIGN[column]!);
  return out; };

describe('board points that face', () => {
  it('without a facing point (or facing straight up or down on itself) it keeps the world axes', () => {
    expect(basis(pointAnchor([1, 0, 2]))).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(basis(pointAnchor([1, 0, 2], [1, 5, 2]))).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });
  it('facing a point it turns about the vertical, the way a unit there looking at it is turned', () => {
    const at = [10, 0, 10] as const, toward = [4, 0, 30] as const;
    const got = basis(pointAnchor(at, toward)), want = turned(Math.atan2(toward[0] - at[0], toward[2] - at[2]));
    got.forEach((v, k) => expect(v).toBeCloseTo(want[k]!, 6));
    // Toward +z it is the world axes; toward -z, half a turn.
    basis(pointAnchor([0, 0, 0], [0, 0, 5])).forEach((v, k) => expect(v).toBeCloseTo([1, 0, 0, 0, 1, 0, 0, 0, 1][k]!, 6));
    basis(pointAnchor([0, 0, 0], [0, 0, -5])).forEach((v, k) => expect(v).toBeCloseTo(turned(Math.PI)[k]!, 6));
  });
  it('its place is the same either way', () => {
    expect(pointAnchor([3, 1, 2], [0, 0, 0]).originAt(0)).toEqual(pointAnchor([3, 1, 2]).originAt(0));
  });
});

describe('the runtime: LtkPlayOptions.boardFacing', () => {
  it('a board cue faces the given point; without it, the world axes', async () => {
    built.length = 0;
    const boom: TimelineCue = { system: 'boom', action: 'passive', event: 'hit', location: 'board', delay: 0, duration: 0.6 };
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
      ? { version: 1, systems: { boom: 'systems/boom.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills: { arrive: [boom] } }
      : syntheticSystem(), readTexture: async () => new Texture() });
    const scene = new Scene(), root = new Group(); scene.add(root);
    const runtime = createLtkRuntime(library, scene, id => id === 'pw' ? { root, body: null, alive: true } : undefined);
    await runtime.warm('arrive');
    const camera = new Camera();
    expect(runtime.play('arrive', 'pw', [], 'passive', { board: [10, 0, 10], boardFacing: [10, 0, -10] })).toBe(true);
    runtime.update(1 / 60, camera);
    expect(runtime.play('arrive', 'pw', [], 'passive', { board: [10, 0, 10] })).toBe(true);
    runtime.update(1 / 60, camera);
    expect(built).toHaveLength(2);
    basis(built[0].anchor).forEach((v, k) => expect(v).toBeCloseTo(turned(Math.PI)[k]!, 6));
    expect(basis(built[1].anchor)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    runtime.dispose();
  });
});
