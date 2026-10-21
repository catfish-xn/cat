import { describe, expect, it } from 'vitest';
import { Group, Vector3 } from 'three';
import { arenaTransform, createBoardArena } from '../src/rendering/three-mode/board-arena';
import { assertManifest, hexCenter, type BoardAlignment, type ModelLease } from '../src/rendering3d';

/** Synthetic alignment only: a source grid with 10-unit steps mapped onto a reference hex grid of radius 34. */
const alignment: BoardAlignment = { scale: [0.5, 0.5, -0.5], offset: [12, 0, 40], target: { radius: 34, origin: { x: 35, y: 50 } } };
const place = (point: Vector3, t: { position: Vector3; scale: Vector3 }) => point.clone().multiply(t.scale).add(t.position);

describe('3D board arena', () => {
  it('keeps the offline placement on the reference grid and retargets it to any radius and origin', () => {
    const source = new Vector3(46, 0, 20);
    const reference = place(source, arenaTransform(alignment, { hexRadius: 34, origin: { x: 35, y: 50 } }));
    expect(reference.toArray()).toEqual([35, 0, 30]);
    // On a grid twice the size and elsewhere, the same source point stays on the same cell-relative spot.
    const live = { hexRadius: 68, origin: { x: 200, y: -10 } };
    const moved = place(source, arenaTransform(alignment, live));
    const cell = hexCenter({ col: 2, row: 3 }, { rows: 8, columns: 7, radius: 34, origin: { x: 35, y: 50 } });
    const liveCell = hexCenter({ col: 2, row: 3 }, { rows: 8, columns: 7, radius: 68, origin: live.origin });
    expect(moved.x - liveCell.x).toBeCloseTo((reference.x - cell.x) * 2);
    expect(moved.z - liveCell.z).toBeCloseTo((reference.z - cell.z) * 2);
  });

  it('adds the model once it loads, re-places it per frame, and releases it on dispose', async () => {
    const parent = new Group(), scene = new Group();
    let released = 0, ready = 0;
    const lease = { scene, animations: [], animationNames: {}, placeholder: false, release: () => { released++; } } as unknown as ModelLease;
    const arena = createBoardArena(parent, alignment, async () => lease, () => { ready++; });
    arena.place({ hexRadius: 34, origin: { x: 35, y: 50 } });
    await new Promise(done => setTimeout(done, 0));
    expect(arena.ready).toBe(true); expect(ready).toBe(1);
    const root = parent.getObjectByName('render3d-board-arena')!;
    expect(root.children).toContain(scene);
    arena.place({ hexRadius: 68, origin: { x: 35, y: 50 } });
    expect(root.scale.toArray()).toEqual([1, 1, -1]);
    arena.dispose();
    expect(released).toBe(1); expect(parent.children).toHaveLength(0);
  });

  it('leaves no arena for a placeholder model or a failed load', async () => {
    const parent = new Group();
    let released = 0;
    const placeholder = { scene: new Group(), animations: [], animationNames: {}, placeholder: true, release: () => { released++; } } as unknown as ModelLease;
    const a = createBoardArena(parent, alignment, async () => placeholder, () => { throw new Error('not-ready'); });
    const b = createBoardArena(parent, alignment, async () => { throw new Error('synthetic-missing'); }, () => { throw new Error('not-ready'); });
    await new Promise(done => setTimeout(done, 0));
    expect(a.ready || b.ready).toBe(false); expect(released).toBe(1); expect(parent.children).toHaveLength(0);
  });

  it('validates board entries in the asset manifest', () => {
    const base = { schemaVersion: 1, models: { 'board-sample': { path: 'models/board.glb' } } };
    expect(() => assertManifest({ ...base, boards: { 'board-sample': { alignment } } })).not.toThrow();
    expect(() => assertManifest({ ...base, boards: { 'board-missing': { alignment } } })).toThrow('invalid-board-model');
    for (const broken of [{ ...alignment, scale: [1, 1] }, { ...alignment, offset: [0, Number.NaN, 0] },
      { ...alignment, target: { radius: 0, origin: { x: 0, y: 0 } } }, { ...alignment, target: { radius: 34 } }]) {
      expect(() => assertManifest({ ...base, boards: { 'board-sample': { alignment: broken } } })).toThrow('invalid-board-alignment');
    }
  });
});
