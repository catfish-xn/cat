import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Each particle set the runtime builds, with the options it was built with (anchor, target, attachment, flight).
const built: { options: any }[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: unknown) => {
    const fx = real.createLtkParticles(prepared, options), entry = { options };
    built.push(entry); const reuse = fx.reuse.bind(fx); fx.reuse = (next: unknown) => { entry.options = next; return reuse(next); };
    return fx;
  } };
});
import { createVfxLibrary, parseIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, rowPath, standingPoint } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { FX_SCALE } from '../src/rendering/three-mode/vfx-ltk/particles';
import { ARENA_UNIT_SCALE, CELL_LEAGUE_UNITS } from '../src/rendering/three-mode/vfx-ltk/fx-size';
import { AXIS_SIGN } from '../src/rendering/three-mode/vfx-ltk/space';
import { S13_TIMELINES, VI_ROW_SHOCKWAVE } from '../src/rendering/three-mode/vfx-ltk/s13-timelines';
import { syntheticSystem } from './vfx-ltk-synthetic';

const cell = CELL_LEAGUE_UNITS * ARENA_UNIT_SCALE;
const row = (rowSide: -1 | 1, rowCells = 2): TimelineCue =>
  ({ system: 'sample', event: 'projectile', delay: 0, duration: 0.6, travelSeconds: 0.3, bone: 'ground', targetBone: 'ground', primary: true, rowSide, rowCells });
const index = (cues: readonly TimelineCue[]) => ({ version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills: { vi: cues } });

describe('vfx-ltk row projectile (TimelineCue.rowSide)', () => {
  it('runs from a point along the board row (world X), rowCells cells to either side', () => {
    expect(rowPath([12, 3, -40], 1, 2.5)).toEqual([[12, 3, -40], [12 + 2.5 * cell, 3, -40]]);
    expect(rowPath([12, 3, -40], -1, 1)).toEqual([[12, 3, -40], [12 - cell, 3, -40]]);
  });

  it('starts where its target stands: a knocked-up body under the root does not lift the start', () => {
    const root = new Group(), body = new Group(); root.add(body); root.position.set(5, 0, 7);
    body.position.y = 40; // the renderer lifts the body, never the root (placeholder-renderer setLiftOffset)
    expect(standingPoint(root)).toEqual([5, 0, 7]);
  });

  it('parses only on a projectile, with a side of -1 or 1 and 0.5-8 cells', () => {
    expect(() => parseIndex(index([row(1)]))).not.toThrow();
    expect(() => parseIndex(index([row(-1, 0.5)]))).not.toThrow();
    expect(() => parseIndex(index([{ ...row(1), event: 'hit' }]))).toThrow();
    expect(() => parseIndex(index([{ ...row(1), rowSide: 2 as unknown as 1 }]))).toThrow();
    expect(() => parseIndex(index([{ ...row(1), rowCells: 0.2 }]))).toThrow();
    expect(() => parseIndex(index([{ ...row(1), rowCells: 9 }]))).toThrow();
    expect(() => parseIndex(index([{ ...row(1), rowCells: undefined }]))).toThrow();
  });

  it('builds each run between two fixed board points taken at the spawn, unattached, flying its travelSeconds', async () => {
    built.length = 0;
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index([row(-1), row(1)]) : syntheticSystem(), readTexture: async () => new Texture() });
    const scene = new Scene(), units = new Map(['caster', 'target'].map((id, i) => {
      const root = new Group(); root.position.set(i * 20 + 5, 0, i * 30); scene.add(root); root.updateMatrixWorld();
      return [id, { root, body: null, alive: true }];
    }));
    const runtime = createLtkRuntime(library, scene, id => units.get(id), {});
    await runtime.warm('vi');
    expect(runtime.play('vi', 'caster', ['target'])).toBe(true);
    runtime.update(1 / 30, new Camera());
    expect(built).toHaveLength(2);
    const at = units.get('target')!.root.position, toSystem = (x: number, y: number, z: number) => [x * AXIS_SIGN[0] / FX_SCALE, y / FX_SCALE, z / FX_SCALE];
    for (const [entry, side] of built.map((entry, i) => [entry, i === 0 ? -1 : 1] as const)) {
      expect(entry.options.attachment).toBeUndefined();
      expect(entry.options.projectileSeconds).toBe(0.3);
      expect(entry.options.anchor.originAt(0)).toEqual(toSystem(at.x, at.y, at.z));
      expect(entry.options.target.originAt(0)).toEqual(toSystem(at.x + side * 2 * cell, at.y, at.z));
    }
    // Taken at the spawn: the target moving afterwards leaves both runs where they were.
    units.get('target')!.root.position.x += 50; units.get('target')!.root.updateMatrixWorld();
    expect(built[1].options.target.originAt(0)).toEqual(toSystem(at.x - 50 + 2 * cell, at.y, at.z));
    runtime.dispose();
  });

  it('a dead target: from its snapshot point when the cast keeps it, else not at all, never from the caster', async () => {
    const setup = async (delay: number) => {
      built.length = 0;
      const cues = [row(-1), row(1)].map(cue => ({ ...cue, delay }));
      const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index(cues) : syntheticSystem(), readTexture: async () => new Texture() });
      const scene = new Scene(), units = new Map(['caster', 'target'].map((id, i) => { const root = new Group(); root.position.set(i * 40, 0, i * 10); return [id, { root, body: null, alive: true }]; }));
      const runtime = createLtkRuntime(library, scene, id => units.get(id), {});
      await runtime.warm('vi');
      return { runtime, units };
    };
    const toSystem = (x: number, y: number, z: number) => [x * AXIS_SIGN[0] / FX_SCALE, y / FX_SCALE, z / FX_SCALE];
    // Killed by this very cast, its place kept (snapshotTargets): both runs start at that place.
    let { runtime, units } = await setup(0);
    units.get('target')!.alive = false;
    expect(runtime.play('vi', 'caster', ['target'], 0, 'cast', { snapshotTargets: true })).toBe(true);
    runtime.update(1 / 30, new Camera());
    expect(built).toHaveLength(2);
    for (const entry of built) expect(entry.options.anchor.originAt(0)).toEqual(toSystem(40, 0, 10));
    runtime.dispose();
    // Dead before it starts, no place kept: neither run plays.
    ({ runtime, units } = await setup(0.1));
    expect(runtime.play('vi', 'caster', ['target'])).toBe(true);
    units.get('target')!.alive = false;
    for (let f = 0; f < 10; f++) runtime.update(1 / 30, new Camera());
    expect(built).toHaveLength(0);
    runtime.dispose();
  });

  it('a pair (together) waits for room for both and starts in one frame, or is dropped whole once overdue', async () => {
    const pair = [{ ...row(-1), together: 'pair' }, { ...row(1), together: 'pair' }];
    const make = async () => {
      built.length = 0;
      const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? { ...index(pair), systems: { sample: 'systems/sample.json', other: 'systems/other.json' },
        skills: { vi: pair, 'vi-filler': [{ system: 'other', event: 'cast-start', delay: 0, duration: 0.2, main: true }],
        'vi-long': [{ system: 'other', event: 'cast-start', delay: 0, duration: 1, main: true }] } } : syntheticSystem(), readTexture: async () => new Texture() });
      const scene = new Scene(), units = new Map(['caster', 'target'].map((id, i) => { const root = new Group(); root.position.set(i * 20, 0, 0); scene.add(root); return [id, { root, body: null, alive: true }]; }));
      // Room for one 250-slot run beside the filler, not two (each first play reserves 250).
      const budget = { live: 0, max: 600 }, runtime = createLtkRuntime(library, scene, id => units.get(id), { budget });
      await runtime.warm('vi');
      return { runtime, scene, budget };
    };
    const live = (scene: Scene) => scene.children.filter(o => o.userData.ltkSystem === 'sample').length;
    // The filler holds 250 of 600 until it ends at 0.2 s: the pair waits, then both start in the same frame.
    let { runtime, scene } = await make();
    expect(runtime.play('vi', 'caster', ['target'], 0, 'cast', { skill: 'vi-filler' })).toBe(true);
    runtime.update(1 / 30, new Camera());
    expect(runtime.play('vi', 'caster', ['target'])).toBe(true);
    runtime.update(1 / 30, new Camera());
    expect(live(scene)).toBe(0); expect(runtime.queued).toBe(2);
    for (let f = 0; f < 6 && !live(scene); f++) { runtime.update(1 / 30, new Camera()); expect([0, 2]).toContain(live(scene)); }
    expect(live(scene)).toBe(2);
    runtime.dispose();
    // A filler that outlasts the pair's 0.3 s window: neither half ever starts.
    ({ runtime, scene } = await make());
    expect(runtime.play('vi', 'caster', ['target'], 0, 'cast', { skill: 'vi-long' })).toBe(true);
    runtime.update(1 / 30, new Camera());
    expect(runtime.play('vi', 'caster', ['target'])).toBe(true);
    for (let f = 0; f < 30; f++) { runtime.update(1 / 30, new Camera()); expect(live(scene)).toBe(0); }
    expect(runtime.queued).toBe(0);
    runtime.dispose();
  });

  it('Vi: Landing_Mis is her row shockwave, both ways from the landing, and nothing else of hers flies it', () => {
    const cues = S13_TIMELINES.vi.filter(cue => cue.system === '84b969e0');
    expect(cues.map(cue => cue.rowSide)).toEqual([-1, 1]);
    for (const cue of cues) {
      expect(cue).toMatchObject({ event: 'projectile', delay: VI_ROW_SHOCKWAVE.delay, travelSeconds: VI_ROW_SHOCKWAVE.travel,
        rowCells: VI_ROW_SHOCKWAVE.cells, primary: true, together: 'row' });
      expect(cue.duration).toBeCloseTo(VI_ROW_SHOCKWAVE.travel + VI_ROW_SHOCKWAVE.linger, 12);
    }
  });
});
