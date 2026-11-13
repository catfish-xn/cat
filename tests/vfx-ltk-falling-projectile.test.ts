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
import { createVfxLibrary, parseIndex, withCueOverrides } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, dropStart } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { FX_SCALE, projectileFlight } from '../src/rendering/three-mode/vfx-ltk/particles';
import { flightTime } from '../src/rendering/three-mode/vfx-ltk/engine/model/rig';
import { BOARD_CELL } from '../src/rendering/three-mode/vfx-ltk/fx-size';
import { AXIS_SIGN } from '../src/rendering/three-mode/vfx-ltk/space';
import { CAITLYN_COMET, CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { syntheticSystem } from './vfx-ltk-synthetic';

const cell = BOARD_CELL;
const drop: TimelineCue = { system: 'sample', event: 'projectile', delay: 0, duration: 0.5, travelSeconds: 0.25, targetBone: 'ground', primary: true, fromAbove: [-1, 5, -1.5] };
const index = (cues: readonly TimelineCue[]) => ({ version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills: { caitlyn: cues } });
const toSystem = (x: number, y: number, z: number) => [x * AXIS_SIGN[0] / FX_SCALE, y / FX_SCALE, z / FX_SCALE];

async function setup(cues: readonly TimelineCue[]) {
  built.length = 0;
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index(cues) : syntheticSystem(), readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map(['caster', 'target'].map((id, i) => {
    const root = new Group(); root.position.set(i * 200 + 5, 0, i * 90); scene.add(root); root.updateMatrixWorld();
    return [id, { root, body: null, alive: true }];
  }));
  const runtime = createLtkRuntime(library, scene, id => units.get(id), {});
  await runtime.warm('caitlyn');
  return { runtime, units };
}

describe('vfx-ltk falling projectile (TimelineCue.fromAbove)', () => {
  it('starts its offset in cells from where the target stands', () => {
    expect(dropStart([10, 0, -20], [-1, 5, -1.5])).toEqual([10 - cell, 5 * cell, -20 - 1.5 * cell]);
  });

  it('lands its travelSeconds after launch though most of its path is a drop (the engine\'s missile speed is horizontal)', () => {
    const from = [-cell / FX_SCALE, 5 * cell / FX_SCALE, -1.5 * cell / FX_SCALE] as const, to = [0, 0, 0] as const;
    for (const seconds of [0.15, 0.3]) expect(flightTime({ kind: 'missile', from, to, flight: projectileFlight(seconds) } as any)).toBeCloseTo(seconds, 2);
    // A level shot lands on time as well.
    expect(flightTime({ kind: 'missile', from: [200, 100, 0], to: [0, 100, 0], flight: projectileFlight(0.3) } as any)).toBeCloseTo(0.3, 2);
  });

  it('falls from above its target onto it, unattached and never from the caster', async () => {
    const { runtime, units } = await setup([drop]);
    expect(runtime.play('caitlyn', 'caster', ['target'])).toBe(true);
    runtime.update(1 / 30, new Camera());
    expect(built).toHaveLength(1);
    const { options } = built[0], at = units.get('target')!.root.position, from = units.get('caster')!.root.position;
    expect(options.attachment).toBeUndefined();
    expect(options.projectileSeconds).toBe(0.25);
    expect(options.anchor.originAt(0)).toEqual(toSystem(at.x - cell, at.y + 5 * cell, at.z - 1.5 * cell));
    expect(options.anchor.originAt(0)).not.toEqual(toSystem(from.x, from.y, from.z));
    expect(options.target.originAt(0)).toEqual(toSystem(at.x, at.y, at.z));
    runtime.dispose();
  });

  it('a dead target: from above its snapshot point when the cast keeps it, else not at all', async () => {
    let { runtime, units } = await setup([drop]);
    units.get('target')!.alive = false;
    expect(runtime.play('caitlyn', 'caster', ['target'], 'cast', { snapshotTargets: true })).toBe(true);
    runtime.update(1 / 30, new Camera());
    expect(built).toHaveLength(1);
    expect(built[0].options.anchor.originAt(0)).toEqual(toSystem(205 - cell, 5 * cell, 90 - 1.5 * cell));
    runtime.dispose();
    ({ runtime, units } = await setup([{ ...drop, delay: 0.1 }]));
    expect(runtime.play('caitlyn', 'caster', ['target'])).toBe(true);
    units.get('target')!.alive = false;
    for (let f = 0; f < 10; f++) runtime.update(1 / 30, new Camera());
    expect(built).toHaveLength(0);
    runtime.dispose();
  });

  it('parses only on a projectile, not with a row, as three finite numbers 1-10 cells up and at most 4 across', () => {
    expect(() => parseIndex(index([drop]))).not.toThrow();
    expect(() => parseIndex(index([{ ...drop, event: 'hit' }]))).toThrow();
    expect(() => parseIndex(index([{ ...drop, rowSide: 1, rowCells: 2 }]))).toThrow();
    expect(() => parseIndex(index([{ ...drop, fromAbove: [0, 5] as unknown as [number, number, number] }]))).toThrow();
    expect(() => parseIndex(index([{ ...drop, fromAbove: [0, 0.5, 0] }]))).toThrow();
    expect(() => parseIndex(index([{ ...drop, fromAbove: [0, 11, 0] }]))).toThrow();
    expect(() => parseIndex(index([{ ...drop, fromAbove: [5, 5, 0] }]))).toThrow();
    expect(() => parseIndex(index([{ ...drop, fromAbove: [0, 5, Number.NaN] }]))).toThrow();
  });
});

describe('Caitlyn Air Raid override', () => {
  it('keeps no boneless cast-start (the exported comet stood on her feet); her comets fall per shot (vfx-ltk-caitlyn-shots)', () => {
    expect(CUE_OVERRIDES.caitlyn.filter(cue => cue.event === 'cast-start' && !cue.bone)).toEqual([]);
    expect(CUE_EXTRA_SKILLS['caitlyn-shot'].find(cue => cue.system === '92bbeaf7')).toMatchObject({ event: 'projectile', fromAbove: CAITLYN_COMET.from });
  });

  it('applies over the exported list when every system is loaded', () => {
    const systems = Object.fromEntries([...CUE_OVERRIDES.caitlyn, { system: '92bbeaf7' }].map(cue => [cue.system, `systems/${cue.system}.json`]));
    const exported: TimelineCue[] = [{ system: '92bbeaf7', action: 'cast', event: 'cast-start', delay: 0.5, duration: 0.5 }];
    expect(withCueOverrides(parseIndex({ version: 1, systems, assets: {}, skills: { caitlyn: exported } })).skills.caitlyn).toEqual(CUE_OVERRIDES.caitlyn);
  });
});
