import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Each particle set the runtime builds, with the options it was built with.
const built: { options: any; fx: any }[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: unknown) => {
    const fx = real.createLtkParticles(prepared, options); built.push({ options, fx }); return fx;
  } };
});
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, MIN_RESERVE, rowGatePoints } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { FX_SCALE } from '../src/rendering/three-mode/vfx-ltk/particles';
import { BOARD_CELL } from '../src/rendering/three-mode/vfx-ltk/fx-size';
import { BOARD_LAYOUT } from '../src/rendering/layout-config';
import { AXIS_SIGN } from '../src/rendering/three-mode/vfx-ltk/space';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { syntheticSystem } from './vfx-ltk-synthetic';

// TimelineCue.rowGate (11-16, Malzahar's gate): a hit played once on every cell of its primary target's board row.
const cell = BOARD_CELL;
const board = { columns: 7, radius: BOARD_LAYOUT.hexRadius, origin: BOARD_LAYOUT.origin };
const at = (col: number, row: number) => [board.origin.x + cell * (col + (row % 2) / 2), 0, board.origin.y + 1.5 * board.radius * row] as [number, number, number];
const toSystem = (p: readonly number[]) => p.map((v, axis) => v * AXIS_SIGN[axis]! / FX_SCALE);

describe('vfx-ltk row gate (TimelineCue.rowGate)', () => {
  it('names the centre of each cell of the row a point stands in, odd rows half a cell over, at its height, own cell first then nearest, left first', () => {
    for (const row of [0, 1, 2, 3]) for (const col of [0, 2, 6]) {
      const stand = at(col, row); stand[1] = 3; stand[0] += 4; // off the centre within its cell
      const points = rowGatePoints(stand, board);
      expect(points).toHaveLength(board.columns);
      const columns = points.map(point => Math.round((point[0] - at(0, row)[0]) / cell));
      // The order room is given in when it is short: the target's cell, then by distance, the left (lower x) one first.
      const order = Array.from({ length: board.columns }, (_, c) => c).sort((a, b) => Math.abs(a - col) - Math.abs(b - col) || a - b);
      expect(columns).toEqual(order);
      points.forEach((point, i) => { const want = at(columns[i]!, row); expect(point[0]).toBeCloseTo(want[0], 9); expect(point[1]).toBe(3); expect(point[2]).toBeCloseTo(want[2], 9); });
    }
    // A reach keeps the cells within that many columns of the target's own (clipped at the board's edge).
    expect(rowGatePoints(at(3, 2), board, 2).map(point => Math.round((point[0] - at(0, 2)[0]) / cell))).toEqual([3, 2, 4, 1, 5]);
    expect(rowGatePoints(at(0, 1), board, 2).map(point => Math.round((point[0] - at(0, 1)[0]) / cell))).toEqual([0, 1, 2]);
  });

  it('plays once per cell of the first target\'s row, empty cells too, not once per target; without the board, on its targets', async () => {
    const cue: TimelineCue = { system: 'sample', action: 'cast', event: 'hit', delay: 0, duration: 0.5, bone: 'ground', rowGate: true };
    const make = async (withBoard: boolean) => {
      built.length = 0;
      const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
        ? { version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills: { vi: [cue] } } : syntheticSystem(),
      readTexture: async () => new Texture() });
      const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean }>();
      units.set('caster', { root: new Group(), body: null, alive: true });
      for (const [id, col] of [['a', 1], ['b', 4]] as const) { const root = new Group(); root.position.set(...at(col, 2)); units.set(id, { root, body: null, alive: true }); }
      const runtime = createLtkRuntime(library, scene, id => units.get(id), withBoard ? { board: () => board } : {});
      await runtime.warm('vi');
      return runtime;
    };
    let runtime = await make(true);
    expect(runtime.play('vi', 'caster', ['a', 'b'])).toBe(true);
    for (let f = 0; f < 3; f++) runtime.update(1 / 30, new Camera());
    expect(built).toHaveLength(board.columns);
    const origins = built.map(entry => entry.options.anchor.originAt(0) as number[]).sort((p, q) => p[0]! - q[0]! || p[2]! - q[2]!);
    const want = Array.from({ length: board.columns }, (_, column) => toSystem(at(column, 2))).sort((p, q) => p[0]! - q[0]! || p[2]! - q[2]!);
    origins.forEach((origin, i) => origin.forEach((v, axis) => expect(v).toBeCloseTo(want[i]![axis]!, 6)));
    runtime.dispose();
    runtime = await make(false);
    expect(runtime.play('vi', 'caster', ['a', 'b'])).toBe(true);
    for (let f = 0; f < 3; f++) runtime.update(1 / 30, new Camera());
    expect(built).toHaveLength(2);
    runtime.dispose();
  });

  it('when room is short the copies that play are the target\'s own cell and its nearest, left first, never evicting others', async () => {
    const cue: TimelineCue = { system: 'sample', action: 'cast', event: 'hit', delay: 0, duration: 0.5, bone: 'ground', rowGate: true };
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
      ? { version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills: { vi: [cue] } } : syntheticSystem(),
    readTexture: async () => new Texture() });
    built.length = 0;
    const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean }>();
    units.set('caster', { root: new Group(), body: null, alive: true });
    const target = new Group(); target.position.set(...at(4, 2)); units.set('a', { root: target, body: null, alive: true });
    // Room for three runs in all.
    const budget = { live: 0, max: 3 * MIN_RESERVE };
    const runtime = createLtkRuntime(library, scene, id => units.get(id), { board: () => board, budget });
    await runtime.warm('vi');
    expect(runtime.play('vi', 'caster', ['a'])).toBe(true);
    for (let f = 0; f < 3; f++) runtime.update(1 / 30, new Camera());
    const columns = built.map(entry => Math.round(((entry.options.anchor.originAt(0)[0] * FX_SCALE / AXIS_SIGN[0]) - at(0, 2)[0]) / cell));
    expect(columns).toEqual([4, 3, 5]);
    expect(budget.live).toBeLessThanOrEqual(budget.max);
    runtime.dispose();
  });

  it('Malzahar\'s portal is the row gate; his bolt still flies to each enemy hit', () => {
    const cues = CUE_OVERRIDES.malzahar!;
    expect(cues.find(cue => cue.system === '10e4e326')).toMatchObject({ event: 'hit', rowGate: true });
    expect(cues.find(cue => cue.system === '7d0f4b1e')?.rowGate).toBeUndefined();
  });
});
