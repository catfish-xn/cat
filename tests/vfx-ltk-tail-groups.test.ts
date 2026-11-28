import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Each particle set the runtime builds, in build order, with the cue system it was built for.
const built: any[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: unknown) => { const fx = real.createLtkParticles(prepared, options); built.push(fx); return fx; } };
});
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, MAX_LTK_SYSTEMS, MIN_RESERVE } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { syntheticSystem } from './vfx-ltk-synthetic';

// A tail (a run playing out past its end) in a together group gives way the way crowded() counts room: its group is one
// system slot and leaves whole, a partner row still in its own time included. Giving way must free exactly what the
// test for it counted, so the run it gave way to then starts.
const hit = (system: string, duration: number): TimelineCue => ({ system, event: 'hit', delay: 0, duration });
const row = (rowSide: -1 | 1, duration: number): TimelineCue => ({ system: 'row', event: 'projectile', delay: 0, duration, travelSeconds: 0.3,
  rowSide, rowCells: 2, together: 'pair' });
const skills: Record<string, TimelineCue[]> = {
  long: [hit('filler', 5)], pair: [row(-1, 0.4), row(1, 3)], newcomer: [{ ...hit('late', 0.6), delay: 0 }],
  swing: [{ ...hit('late', 0.6), action: 'attack' }],
  trio: [0, 1, 2].map(() => ({ ...hit('late', 0.6), together: 'trio' })),
};

async function setup(budget?: { live: number; max: number }) {
  built.length = 0;
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: { filler: 'systems/filler.json', row: 'systems/row.json', late: 'systems/late.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills }
    : syntheticSystem(), readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean }>();
  const find = (id: string) => { let unit = units.get(id); if (!unit) { unit = { root: new Group(), body: null, alive: true }; units.set(id, unit); scene.add(unit.root); } return unit; };
  const runtime = createLtkRuntime(library, scene, find, budget ? { budget } : {});
  for (const champion of Object.keys(skills)) await runtime.warm(champion);
  const camera = new Camera(), step = (seconds: number) => { for (let t = 0; t < seconds; t += 1 / 60) runtime.update(1 / 60, camera); };
  return { runtime, scene, step, budget };
}

// Every system slot taken by MAX_LTK_SYSTEMS − 1 long hits and the row pair, its short row playing out (never on its own).
async function tailOnFullBoard(budget?: { live: number; max: number }) {
  const ctx = await setup(budget);
  for (let i = 0; i < MAX_LTK_SYSTEMS - 1; i++) expect(ctx.runtime.play('long', `c${i}`, [`t${i}`])).toBe(true);
  expect(ctx.runtime.play('pair', 'vi', ['foe'])).toBe(true);
  ctx.step(0.1);
  const rows = built.filter(fx => fx.object.userData.ltkSystem === 'row');
  for (const fx of rows) Object.defineProperty(fx, 'playedOut', { get: () => false });
  ctx.step(0.4);
  expect(ctx.runtime.active).toBe(MAX_LTK_SYSTEMS + 1);
  return { ...ctx, rows };
}

describe('vfx-ltk tails give way by group', () => {
  it('a tail whose together partner still runs gives way to a run that its whole group lets in, and that run starts', async () => {
    const { runtime, scene, step } = await setup();
    // Every system slot taken: MAX_LTK_SYSTEMS − 1 long hits and the row pair (one slot for its two runs).
    for (let i = 0; i < MAX_LTK_SYSTEMS - 1; i++) expect(runtime.play('long', `c${i}`, [`t${i}`])).toBe(true);
    expect(runtime.play('pair', 'vi', ['foe'])).toBe(true);
    step(0.1);
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS + 1);
    const rows = built.filter(fx => fx.object.userData.ltkSystem === 'row');
    expect(rows).toHaveLength(2);
    // The short row reaches its end and plays out (never on its own here); the long row is still in its own time.
    for (const fx of rows) Object.defineProperty(fx, 'playedOut', { get: () => false });
    step(0.4);
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS + 1);
    // A critical hit with no slot: the pair's slot is what lets it in, so the tail gives way and takes its partner along.
    expect(runtime.play('newcomer', 'x', ['y'])).toBe(true);
    step(1 / 60);
    for (const fx of rows) expect(fx.object.parent).toBeNull();
    const late = built.filter(fx => fx.object.userData.ltkSystem === 'late');
    expect(late).toHaveLength(1);
    expect(late[0].object.parent).toBe(scene);
    expect(built.filter(fx => fx.object.userData.ltkSystem === 'filler' && fx.object.parent === scene)).toHaveLength(MAX_LTK_SYSTEMS - 1);
    expect(runtime.queued).toBe(0);
    runtime.dispose();
  });

  it('a plain attack never takes a tail: it is dropped and the tail plays on', async () => {
    const { runtime, scene, step, rows } = await tailOnFullBoard();
    expect(runtime.play('swing', 'x', ['y'], 'attack')).toBe(true);
    step(1 / 60);
    for (const fx of rows) expect(fx.object.parent).toBe(scene);
    expect(built.filter(fx => fx.object.userData.ltkSystem === 'late')).toHaveLength(0);
    runtime.dispose();
  });

  it('a tail stays when giving its group up would not let the newcomer in either (particle budget)', async () => {
    // Budget for exactly the board: freeing the pair's two runs is less room than the newcomer asks.
    const { runtime, scene, step, rows, budget } = await tailOnFullBoard({ live: 0, max: (MAX_LTK_SYSTEMS + 1) * MIN_RESERVE });
    // Three critical hits that start together or not at all: one slot, three reserves; the tail's group frees two.
    expect(runtime.play('trio', 'x', ['y'])).toBe(true);
    step(1 / 60);
    for (const fx of rows) expect(fx.object.parent).toBe(scene);
    expect(budget!.live).toBeLessThanOrEqual(budget!.max);
    runtime.dispose();
  });
});
