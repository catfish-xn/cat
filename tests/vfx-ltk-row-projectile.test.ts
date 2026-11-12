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
import { createLtkRuntime, MIN_RESERVE, rowPath, rowReach, standingPoint } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { FX_SCALE } from '../src/rendering/three-mode/vfx-ltk/particles';
import { BOARD_CELL } from '../src/rendering/three-mode/vfx-ltk/fx-size';
import { BOARD_LAYOUT } from '../src/rendering/layout-config';
import { AXIS_SIGN } from '../src/rendering/three-mode/vfx-ltk/space';
import { S13_TIMELINES, VI_ROW_SHOCKWAVE } from '../src/rendering/three-mode/vfx-ltk/s13-timelines';
import { syntheticSystem } from './vfx-ltk-synthetic';

const cell = BOARD_CELL;
const row = (rowSide: -1 | 1, rowCells = 2): TimelineCue =>
  ({ system: 'sample', event: 'projectile', delay: 0, duration: 0.6, travelSeconds: 0.3, bone: 'ground', targetBone: 'ground', primary: true, rowSide, rowCells });
const index = (cues: readonly TimelineCue[]) => ({ version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills: { vi: cues } });

describe('vfx-ltk row projectile (TimelineCue.rowSide)', () => {
  it('a board cell is the cell of the board layout: √3 × its hex radius', () => {
    expect(BOARD_CELL).toBeCloseTo(Math.sqrt(3) * BOARD_LAYOUT.hexRadius, 12);
  });

  it('runs from a point along the board row (world X), rowCells cells to either side', () => {
    expect(rowPath([12, 3, -40], 1, 2.5)).toEqual([[12, 3, -40], [12 + 2.5 * cell, 3, -40]]);
    expect(rowPath([12, 3, -40], -1, 1)).toEqual([[12, 3, -40], [12 - cell, 3, -40]]);
  });

  it('measures to the last cell centre of the row on each side, odd rows half a cell over, never below 0', () => {
    const board = { columns: 7, radius: BOARD_LAYOUT.hexRadius, origin: BOARD_LAYOUT.origin }, at = (col: number, row: number) =>
      [board.origin.x + cell * (col + (row % 2) / 2), 0, board.origin.y + 1.5 * board.radius * row] as const;
    for (const row of [0, 1, 2, 5]) for (const col of [0, 3, 6]) {
      expect(rowReach(at(col, row), -1, board)).toBeCloseTo(col, 9);
      expect(rowReach(at(col, row), 1, board)).toBeCloseTo(6 - col, 9);
    }
    expect(rowReach([board.origin.x - cell, 0, board.origin.y], -1, board)).toBe(0);
  });

  it('runs to the end of its row on each side at rowSpeed, so a landing by the edge runs further one way', async () => {
    built.length = 0;
    const board = { columns: 7, radius: BOARD_LAYOUT.hexRadius, origin: BOARD_LAYOUT.origin };
    const cues = [-1, 1].map(side => ({ ...row(side as -1 | 1, 7), rowToEnd: true, rowBeyond: 0.5, rowSpeed: 10, travelSeconds: 0.7, duration: 1, together: 'pair' }));
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index(cues) : syntheticSystem(), readTexture: async () => new Texture() });
    const scene = new Scene(), target = new Group(); target.position.set(board.origin.x + cell * 5, 0, board.origin.y + 1.5 * board.radius * 2);
    const units = new Map([['caster', { root: new Group(), body: null, alive: true }], ['target', { root: target, body: null, alive: true }]]);
    const runtime = createLtkRuntime(library, scene, id => units.get(id), { board: () => board });
    await runtime.warm('vi');
    expect(runtime.play('vi', 'caster', ['target'])).toBe(true);
    runtime.update(1 / 30, new Camera());
    expect(built).toHaveLength(2);
    const [left, right] = built.map(entry => entry.options);
    const toSystem = (x: number) => x * AXIS_SIGN[0] / FX_SCALE;
    expect(left.target.originAt(0)[0]).toBeCloseTo(toSystem(target.position.x - 5.5 * cell), 6);
    expect(right.target.originAt(0)[0]).toBeCloseTo(toSystem(target.position.x + 1.5 * cell), 6);
    expect(left.projectileSeconds).toBeCloseTo(0.55, 9); expect(right.projectileSeconds).toBeCloseTo(0.15, 9);
    expect(left.duration).toBeCloseTo(0.55 + 0.3, 9); expect(right.duration).toBeCloseTo(0.15 + 0.3, 9);
    runtime.dispose();
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
    expect(() => parseIndex(index([{ ...row(1), rowToEnd: true, rowBeyond: 0.5, rowSpeed: 8 }]))).not.toThrow();
    expect(() => parseIndex(index([{ ...row(1), rowSpeed: 0.5 }]))).toThrow();
    expect(() => parseIndex(index([{ ...row(1), rowBeyond: 0.5 }]))).toThrow(); // only with rowToEnd
    expect(() => parseIndex(index([{ ...row(1), rowToEnd: true, rowBeyond: 2 }]))).toThrow();
    expect(() => parseIndex(index([{ system: 'sample', event: 'hit', delay: 0, duration: 1, rowToEnd: true }]))).toThrow();
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
      // Room for one run beside the filler, not two: warm measured each synthetic system below the floor (MIN_RESERVE).
      const budget = { live: 0, max: 2.5 * MIN_RESERVE }, runtime = createLtkRuntime(library, scene, id => units.get(id), { budget });
      await runtime.warm('vi');
      return { runtime, scene, budget };
    };
    const live = (scene: Scene) => scene.children.filter(o => o.userData.ltkSystem === 'sample').length;
    // The filler holds its room until it ends at 0.2 s: the pair waits, then both start in the same frame.
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
      expect(cue).toMatchObject({ event: 'projectile', delay: VI_ROW_SHOCKWAVE.delay, rowCells: VI_ROW_SHOCKWAVE.cells, rowToEnd: true,
        rowBeyond: VI_ROW_SHOCKWAVE.beyond, rowSpeed: VI_ROW_SHOCKWAVE.speed, primary: true, together: 'row' });
      expect(cue.travelSeconds).toBeCloseTo(VI_ROW_SHOCKWAVE.cells / VI_ROW_SHOCKWAVE.speed, 12);
      expect(cue.duration).toBeCloseTo(cue.travelSeconds! + VI_ROW_SHOCKWAVE.linger, 12);
    }
  });
});
