import { describe, expect, it, vi } from 'vitest';
import { Group, Mesh, Scene, Vector3 } from 'three';
import { createPvpPortal, PORTAL_SECONDS } from '../src/rendering/three-mode/pvp-portal';
import type { BoardFrame, BoardPiece } from '../src/rendering/board-feed';

const enemy = (id: string, extra: Partial<BoardPiece> = {}): BoardPiece => ({
  id, definitionId: 'synthetic', team: 'enemy', starLevel: 1, x: 100, y: 80, visible: true, alive: true, ...extra,
});
const frame = (pieces: readonly BoardPiece[], fighting = true): BoardFrame => ({
  rows: 8, columns: 7, hexRadius: 34, origin: { x: 30, y: 40 }, bench: [], dragging: null, fighting, pieces,
});
function setup(pieces: readonly BoardPiece[]) {
  const scene = new Scene(), portal = createPvpPortal(scene);
  const views = new Map(pieces.map(piece => {
    const root = new Group(), target = new Vector3(piece.x, 0, piece.y); root.position.copy(target); scene.add(root);
    return [piece.id, { root, target, alive: piece.alive }];
  }));
  const step = (seconds: number) => { portal.advance(seconds, true); for (const id of views.keys()) portal.apply(id); };
  return { scene, portal, views, step };
}

describe('3D PvP portal', () => {
  it('arrives on the opponent side and lands on the latest moving target without changing the input frame', () => {
    const input = frame([enemy('foe'), enemy('me', { team: 'player', y: 300 })]), before = structuredClone(input);
    const { portal, views, step } = setup(input.pieces);
    portal.frame(input, views, true, true); step(0);
    const foe = views.get('foe')!, me = views.get('me')!;
    expect(portal.active).toBe(true);
    expect(foe.root.position.x).toBeCloseTo(portal.object.position.x);
    expect(foe.root.position.z).toBeLessThan(input.origin.y + 2 * input.hexRadius);
    expect(foe.root.position.y).toBeGreaterThan(50);
    expect(me.root.position).toEqual(me.target);
    step(PORTAL_SECONDS / 2);
    expect(foe.root.position.y).toBeGreaterThan(0);
    expect(foe.root.position.distanceTo(foe.target)).toBeLessThan(70);
    foe.target.set(180, 0, 120);
    portal.frame(input, views, false, true); // snapshots don't restart it
    step(PORTAL_SECONDS / 2);
    expect(foe.root.position).toEqual(foe.target);
    expect(portal.active).toBe(false); expect(portal.object.visible).toBe(false);
    expect(input).toEqual(before);
    portal.dispose();
  });

  it('bounds stagger even for a large army and disposes its shared resources once', () => {
    const input = frame(Array.from({ length: 30 }, (_, id) => enemy(`foe-${id}`)));
    const { scene, portal, views, step } = setup(input.pieces);
    const mesh = portal.object.children[0] as Mesh;
    const geometry = vi.spyOn(mesh.geometry, 'dispose'), material = vi.spyOn(mesh.material as import('three').Material, 'dispose');
    portal.frame(input, views, true, true); step(PORTAL_SECONDS + 0.181);
    for (const view of views.values()) expect(view.root.position).toEqual(view.target);
    expect(portal.active).toBe(false);
    portal.dispose(); portal.dispose();
    expect(scene.getObjectByName('render3d-pvp-portal')).toBeUndefined();
    expect(geometry).toHaveBeenCalledTimes(1); expect(material).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: 'PvE', pieces: [enemy('monster', { neutral: true })], began: true, enabled: true },
    { name: 'mixed monsters', pieces: [enemy('foe'), enemy('monster', { neutral: true })], began: true, enabled: true },
    { name: 'mount/reconnect/watch', pieces: [enemy('foe')], began: false, enabled: true },
    { name: 'reduced motion/off/scouting', pieces: [enemy('foe')], began: true, enabled: false },
    { name: 'dead foes', pieces: [enemy('foe', { alive: false })], began: true, enabled: true },
  ])('skips $name', ({ pieces, began, enabled }) => {
    const { portal, views, step } = setup(pieces);
    portal.frame(frame(pieces), views, began, enabled); step(0.1);
    expect(portal.active).toBe(false); expect(portal.object.visible).toBe(false);
    for (const view of views.values()) expect(view.root.position).toEqual(view.target);
    portal.dispose();
  });

  it.each(['phase', 'disabled', 'death', 'removal'] as const)('cancels a flight on %s and restores its latest target', reason => {
    const input = frame([enemy('foe')]), { portal, views, step } = setup(input.pieces);
    portal.frame(input, views, true, true); step(0.1);
    const foe = views.get('foe')!; foe.target.set(190, 0, 170);
    if (reason === 'phase') portal.frame({ ...input, fighting: false }, views, false, true);
    if (reason === 'disabled') portal.advance(0.1, false);
    if (reason === 'death') { foe.alive = false; portal.frame(input, views, false, true); }
    if (reason === 'removal') { views.delete('foe'); portal.frame(input, views, false, true); }
    expect(foe.root.position).toEqual(foe.target); expect(portal.active).toBe(false);
    portal.dispose();
  });
});
