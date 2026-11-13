import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Each particle set the runtime builds, with the options it was built with (anchor, target, attachment, flight).
const built: { options: any; fx: any }[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: unknown) => { const fx = real.createLtkParticles(prepared, options); built.push({ options, fx }); return fx; } };
});
import { createVfxLibrary, parseIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, groundLine } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { FX_SCALE } from '../src/rendering/three-mode/vfx-ltk/particles';
import { BOARD_CELL } from '../src/rendering/three-mode/vfx-ltk/fx-size';
import { AXIS_SIGN } from '../src/rendering/three-mode/vfx-ltk/space';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { syntheticSystem } from './vfx-ltk-synthetic';

const cell = BOARD_CELL;
const line = (lineCells = 2): TimelineCue => ({ system: 'sample', event: 'projectile', delay: 0, duration: 0.7, travelSeconds: 0.7, lineCells });
const index = (cues: readonly TimelineCue[]) => ({ version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills: { gangplank: cues } });
const toSystem = ([x, y, z]: readonly number[]) => [x! * AXIS_SIGN[0] / FX_SCALE, y! / FX_SCALE, z! / FX_SCALE];

async function setup(cues: readonly TimelineCue[]) {
  built.length = 0;
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index(cues) : syntheticSystem(), readTexture: async () => new Texture() });
  const scene = new Scene();
  // The caster's body stands above its feet: a bone there is what the line no longer starts from.
  const units = new Map([['caster', [10, 0, 20]], ['target', [10 + 30, 0, 20 + 40]]].map(([id, [x, y, z]]: any) => {
    const root = new Group(); root.position.set(x, y, z); scene.add(root); root.updateMatrixWorld();
    return [id, { root, body: null, alive: true }];
  }));
  const runtime = createLtkRuntime(library, scene, id => units.get(id), {});
  await runtime.warm('gangplank');
  return { runtime, units, scene };
}

describe('vfx-ltk ground line (TimelineCue.lineCells)', () => {
  it('runs on the floor from one point toward another, lineCells cells in all, and has no line on one spot', () => {
    const [from, to] = groundLine([10, 0, 20], [40, 0, 60], 2)!;
    expect(from).toEqual([10, 0, 20]);
    // 30 × 40 is a 3-4-5 direction.
    expect(to[0]).toBeCloseTo(10 + 2 * cell * 0.6, 9);
    expect(to[1]).toBe(0);
    expect(to[2]).toBeCloseTo(20 + 2 * cell * 0.8, 9);
    // The height of the start is kept even when the other point stands higher.
    expect(groundLine([0, 3, 0], [5, 9, 0], 1)![1]).toEqual([cell, 3, 0]);
    expect(groundLine([1, 0, 1], [1, 5, 1], 2)).toBeNull();
    // Starting back cells behind the first point, away from the second; the length stays cells.
    const [start, end] = groundLine([10, 0, 20], [40, 0, 60], 2, 0.5)!;
    expect(start[0]).toBeCloseTo(10 - 0.5 * cell * 0.6, 9); expect(start[2]).toBeCloseTo(20 - 0.5 * cell * 0.8, 9);
    expect(Math.hypot(end[0] - start[0], end[2] - start[2])).toBeCloseTo(2 * cell, 9);
  });

  it('is checked when loaded: a projectile only, not with a row or a fall, half a cell to eight', () => {
    expect(() => parseIndex(index([line()]))).not.toThrow();
    expect(() => parseIndex(index([line(0.5)]))).not.toThrow();
    expect(() => parseIndex(index([line(8)]))).not.toThrow();
    expect(() => parseIndex(index([{ ...line(), event: 'hit' }]))).toThrow();
    expect(() => parseIndex(index([line(0.2)]))).toThrow();
    expect(() => parseIndex(index([line(9)]))).toThrow();
    expect(() => parseIndex(index([{ ...line(), rowSide: 1, rowCells: 2 }]))).toThrow();
    expect(() => parseIndex(index([{ ...line(), fromAbove: [0, 3, 0] }]))).toThrow();
    expect(() => parseIndex(index([{ ...line(), lineBack: 0.5 }]))).not.toThrow();
    expect(() => parseIndex(index([{ ...line(), lineBack: 3 }]))).toThrow();
    expect(() => parseIndex(index([{ system: 'sample', event: 'projectile', delay: 0, duration: 0.7, travelSeconds: 0.7, lineBack: 0.5 } as TimelineCue]))).toThrow();
  });

  it('starts where the caster stands, runs through where the target stands, on neither unit, and stays put after', async () => {
    const { runtime, units, scene } = await setup([{ ...line(2), bone: 'Buffbone_Glb_Weapon_2' }]);
    expect(runtime.play('gangplank', 'caster', ['target'])).toBe(true);
    runtime.update(1 / 30, new Camera());
    expect(built).toHaveLength(1);
    const { options, fx } = built[0]!;
    const [from, to] = groundLine([10, 0, 20], [40, 0, 60], 2)!;
    expect(options.anchor.originAt(0)).toEqual(toSystem(from));
    expect(options.target.originAt(0)).toEqual(toSystem(to));
    expect(options.attachment).toBeUndefined();
    expect(options.projectileSeconds).toBe(0.7);
    expect(fx.object.parent).toBe(scene);
    // Taken at the spawn: either unit moving afterwards leaves the line where it was.
    units.get('target')!.root.position.x += 50; units.get('caster')!.root.position.z -= 30;
    for (const unit of units.values()) unit.root.updateMatrixWorld();
    expect(options.anchor.originAt(0)).toEqual(toSystem(from));
    expect(options.target.originAt(0)).toEqual(toSystem(to));
    runtime.dispose();
  });

  it('starts lineBack cells behind the caster, away from the target', async () => {
    const { runtime } = await setup([{ ...line(2), lineBack: 0.5 }]);
    expect(runtime.play('gangplank', 'caster', ['target'])).toBe(true);
    runtime.update(1 / 30, new Camera());
    const [from, to] = groundLine([10, 0, 20], [40, 0, 60], 2, 0.5)!;
    const close = (got: number[], want: readonly number[]) => got.forEach((value, axis) => expect(value).toBeCloseTo(toSystem(want)[axis]!, 6));
    close(built[0]!.options.anchor.originAt(0), from);
    close(built[0]!.options.target.originAt(0), to);
    runtime.dispose();
  });

  it('a dead target: toward its snapshot point when the cast keeps it, else not at all, never from the caster\'s bone', async () => {
    let { runtime, units } = await setup([line(2)]);
    units.get('target')!.alive = false;
    expect(runtime.play('gangplank', 'caster', ['target'], 'cast', { snapshotTargets: true })).toBe(true);
    runtime.update(1 / 30, new Camera());
    expect(built).toHaveLength(1);
    const end = toSystem(groundLine([10, 0, 20], [40, 0, 60], 2)![1]);
    built[0]!.options.target.originAt(0).forEach((value: number, axis: number) => expect(value).toBeCloseTo(end[axis]!, 6));
    runtime.dispose();
    ({ runtime, units } = await setup([{ ...line(2), delay: 0.1 }]));
    expect(runtime.play('gangplank', 'caster', ['target'])).toBe(true);
    units.get('target')!.alive = false;
    for (let f = 0; f < 10; f++) runtime.update(1 / 30, new Camera());
    expect(built).toHaveLength(0);
    runtime.dispose();
  });

  it("Gangplank's ground-fire line plays as a ground line, from no bone", () => {
    const cue = CUE_OVERRIDES.gangplank!.find(entry => entry.system === '20cd67dc')!;
    expect(cue.event).toBe('projectile');
    expect(cue.lineCells).toBeGreaterThan(0);
    expect(cue.lineBack).toBeGreaterThan(0);
    expect(cue.bone).toBeUndefined();
  });
});
