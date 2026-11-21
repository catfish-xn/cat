import { describe, expect, it, vi } from 'vitest';
import { Group, Mesh, MeshBasicMaterial, Scene, SphereGeometry, Vector3 } from 'three';
import { createStarUpFx } from '../src/rendering/three-mode/star-up-fx';
import type { BoardMerge } from '../src/rendering/board-feed';

const merge: BoardMerge = { definitionId: 'unit', fromStar: 1, toStar: 2,
  to: { id: 'a', x: 200, y: 200 }, from: [{ id: 'b', x: 0, y: 0 }, { id: 'c', x: 100, y: 0 }] };
function setup(reduced = false) {
  const scene = new Scene(), target = new Group(); target.position.set(200, 0, 200); scene.add(target);
  const source = new Group(); source.position.set(0, 50, 0);
  const geometry = new SphereGeometry(10), material = new MeshBasicMaterial(); source.add(new Mesh(geometry, material)); scene.add(source);
  const release = vi.fn(() => source.removeFromParent()), models = new Map([['b', { object: source, release }]]);
  const fx = createStarUpFx({ scene, reduced: () => reduced, color: () => '#ffd34d',
    take: id => { const model = models.get(id); models.delete(id); return model; },
    target: id => id === 'a' ? target : undefined,
    point: p => new Vector3(p.x, p.benchSlot === undefined ? 0 : 60, p.y),
  });
  return { fx, scene, source, target, release, geometry, material };
}
describe('3D star-up model ownership and timing', () => {
  it('retains a consumed model, clones a never-drawn purchase, converges at the moving target and releases once', () => {
    const ctx = setup(), disposeGeometry = vi.spyOn(ctx.geometry, 'dispose'), disposeMaterial = vi.spyOn(ctx.material, 'dispose');
    ctx.fx.play([merge]); ctx.fx.update(.15);
    const group = ctx.scene.getObjectByName('render3d-star-up')!;
    const ghosts = group.children.filter(child => child instanceof Group);
    expect(ghosts).toHaveLength(2); expect(ghosts[0]).toBe(ctx.source);
    expect(ctx.source.position.x).toBeGreaterThan(0); expect(ctx.source.position.y).toBeGreaterThan(0); // raised bench → airborne
    expect(ctx.fx.level('a', 2)).toBe(1); expect(ctx.release).not.toHaveBeenCalled();
    ctx.target.position.set(300, 0, 250); ctx.fx.update(.15);
    expect(ctx.fx.level('a', 2)).toBe(2); expect(ghosts.every(ghost => !ghost.visible)).toBe(true);
    expect(ctx.source.position.toArray()).toEqual([300, 0, 250]);
    expect(group.getObjectByName('merge-flash')?.visible).toBe(true);
    ctx.fx.update(.15); expect(ctx.fx.scale('a')).toBeGreaterThan(1); expect(ctx.target.scale.toArray()).toEqual([1, 1, 1]);
    ctx.fx.update(.24); expect(ctx.scene.getObjectByName('render3d-star-up')).toBeUndefined();
    expect(ctx.release).toHaveBeenCalledTimes(1); expect(disposeGeometry).not.toHaveBeenCalled(); expect(disposeMaterial).not.toHaveBeenCalled();
    ctx.fx.dispose(); ctx.fx.dispose(); expect(ctx.release).toHaveBeenCalledTimes(1);
  });
  it('serializes a 1→2→3 cascade and releases everything when the view is cleared midway', () => {
    const ctx = setup(); ctx.fx.play([merge, { ...merge, fromStar: 2, toStar: 3, from: [{ id: 'd', x: 20, y: 10 }, { id: 'e', x: 30, y: 10 }] }]);
    ctx.fx.update(.29); expect(ctx.fx.level('a', 3)).toBe(1);
    ctx.fx.update(.02); expect(ctx.fx.level('a', 3)).toBe(2);
    ctx.fx.update(.3); expect(ctx.fx.level('a', 3)).toBe(3);
    ctx.fx.clear(); expect(ctx.release).toHaveBeenCalledTimes(1); expect(ctx.fx.scale('a')).toBe(1);
    expect(ctx.fx.level('a', 4)).toBe(4); ctx.fx.update(10); expect(ctx.release).toHaveBeenCalledTimes(1); ctx.fx.dispose();
  });
  it('reduced motion skips flight; missing models use disposable light silhouettes and never request assets', () => {
    const ctx = setup(true); ctx.fx.play([merge]); expect(ctx.source.visible).toBe(false);
    ctx.fx.update(.01); expect(ctx.fx.level('a', 2)).toBe(2); ctx.fx.update(.24); expect(ctx.release).toHaveBeenCalledTimes(1); ctx.fx.dispose();
    const empty = setup(); empty.fx.play([{ ...merge, from: [{ id: 'x', x: 0, y: 0 }, { id: 'y', x: 1, y: 0 }] }]);
    empty.fx.update(.15); expect(empty.scene.getObjectByName('render3d-star-up')!.children.filter(child => child instanceof Group)).toHaveLength(2);
    empty.fx.dispose(); expect(empty.release).not.toHaveBeenCalled();
  });
});
