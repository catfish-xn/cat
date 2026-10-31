import { describe, expect, it, vi } from 'vitest';
import { AnimationClip, BoxGeometry, Group, Mesh, MeshBasicMaterial, NumberKeyframeTrack, Vector3, type BufferAttribute, type Object3D } from 'three';
import { CarouselLeash } from '../src/rendering/three-mode/carousel-leash';
import { CAROUSEL_CELL as CELL, createCarouselStage, type CarouselStageContext } from '../src/rendering/three-mode/carousel-stage';
import type { BoardCarousel, BoardLegendWalk } from '../src/rendering/board-feed';
import type { ModelLease } from '../src/rendering3d';

const view = (picked = false): BoardCarousel => ({
  id: 'leash', elapsedMs: 0, at: 0,
  seats: Array.from({ length: 8 }, (_, i) => ({ seatId: `s${i}`, me: i === 2, releaseAtMs: 0 })),
  slots: Array.from({ length: 9 }, (_, i) => ({ slot: i, definitionId: `unit-${i}`, starLevel: 1, items: [],
    pickedBy: picked && i < 8 ? `s${i}` : null, takable: true, pending: false })),
});
const area = { left: 0, top: 0, width: 1600, height: 900 };
function setup(overrides: Partial<CarouselStageContext> = {}) {
  let clock = 0;
  const stage = createCarouselStage({ championHeight: 92, championWidth: 110, sourceScale: 0.44, legendModel: 'little-legend-default',
    loadModel: null, hasModel: () => false, loadEffect: null, starColor: () => '#ffd34d', now: () => clock, ...overrides });
  stage.resize(16 / 9);
  return { stage, tick: (ms: number) => { clock += ms; } };
}
const walk = (seat: Object3D, index: number, to: { x: number; y: number }, startedAt = 0): BoardLegendWalk => ({
  seatId: `s${index}`, scene: 'carousel', from: { x: seat.position.x / CELL, y: seat.position.z / CELL }, to,
  startedAt, arriveAt: startedAt + 1000, slot: null, who: index === 2 ? 'me' : 'other',
});
function ringCenter(mesh: Mesh, row: number): Vector3 {
  const position = mesh.geometry.getAttribute('position'), center = new Vector3();
  // Six vertices around the tube; omit the duplicated seam vertex.
  for (let col = 0; col < 6; col++) center.add(new Vector3().fromBufferAttribute(position, row * 7 + col));
  return mesh.localToWorld(center.divideScalar(6));
}

describe('carousel leash display', () => {
  it('curves below the chest-to-chest line, keeps both endpoints, and reuses a finite outward-facing tube through turns', () => {
    const material = new MeshBasicMaterial(), leash = new CarouselLeash(material, CELL), mesh = leash.mesh;
    const positions = mesh.geometry.getAttribute('position') as BufferAttribute;
    const dispose = vi.spyOn(mesh.geometry, 'dispose'), materialDispose = vi.spyOn(material, 'dispose');
    for (const to of [new Vector3(70, 85, -20), new Vector3(-40, 60, 90), new Vector3(10, 100, 20)]) {
      const from = new Vector3(10, 40, 20);
      leash.update(from, to); mesh.updateMatrixWorld(true);
      expect(mesh.visible).toBe(true);
      expect(mesh.geometry.getAttribute('position')).toBe(positions);
      expect(ringCenter(mesh, 0).distanceTo(from)).toBeLessThan(1e-5);
      expect(ringCenter(mesh, 12).distanceTo(to)).toBeLessThan(1e-5);
      const middle = ringCenter(mesh, 6), straight = from.clone().lerp(to, 0.5);
      expect(middle.y).toBeLessThan(straight.y);
      expect(straight.y - middle.y).toBeLessThanOrEqual(CELL * 0.18 + 1e-5);
      expect([...positions.array].every(Number.isFinite)).toBe(true);
      const indices = mesh.geometry.index!, normals = mesh.geometry.getAttribute('normal');
      for (let i = 0; i < indices.count; i += 3) {
        const a = indices.getX(i), b = indices.getX(i + 1), c = indices.getX(i + 2);
        const p = new Vector3().fromBufferAttribute(positions, a);
        const normal = new Vector3().fromBufferAttribute(positions, b).sub(p)
          .cross(new Vector3().fromBufferAttribute(positions, c).sub(p)).normalize();
        expect(normal.dot(new Vector3().fromBufferAttribute(normals, a))).toBeGreaterThan(0.5);
      }
    }
    leash.update(new Vector3(), new Vector3()); expect(mesh.visible).toBe(false);
    leash.dispose(); expect(dispose).toHaveBeenCalledTimes(1); expect(materialDispose).not.toHaveBeenCalled();
    material.dispose();
  });

  it('shows all eight confirmed picks, smoothly follows relayed walks, and keeps the ropes attached during a turn', () => {
    const { stage, tick } = setup();
    const initial = view(), picked = view(true), unchanged = structuredClone(picked);
    stage.show(initial);
    const legends = [...stage.scene.getObjectByName('render3d-carousel-seats')!.children];
    const holders = [...stage.scene.getObjectByName('render3d-carousel-units')!.children];
    stage.show(picked);
    for (let frame = 0; frame < 120; frame++) stage.update(1 / 60);
    expect(stage.debug().fetched).toEqual(Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`s${i}`, i])));
    const ropes = stage.scene.getObjectByName('render3d-carousel-taken')!.children.filter(child => child.name === 'render3d-carousel-tether') as Mesh[];
    expect(ropes).toHaveLength(8);
    const before = holders.map(holder => holder.position.clone());
    legends.forEach((legend, i) => stage.walk(walk(legend, i, { x: legend.position.x / CELL + 1, y: legend.position.z / CELL + 0.5 })));
    tick(200); stage.update(0.2);
    const targets = legends.map(legend => legend.position.clone().addScaledVector(new Vector3(0, 0, -1).applyEuler(legend.rotation), 1.1 * CELL));
    holders.slice(0, 8).forEach((holder, i) => {
      expect(holder.position.distanceTo(before[i]!)).toBeGreaterThan(1);
      // The follower approaches its offset rather than snapping there on receipt or on a turn.
      expect(holder.position.distanceTo(targets[i]!)).toBeGreaterThan(1);
      expect(holder.parent?.name).toBe('render3d-carousel-taken');
      const rope = ropes[i]!; rope.updateWorldMatrix(true, false);
      expect(rope.visible).toBe(true);
      expect(ringCenter(rope, 0).distanceTo(legends[i]!.position.clone().add(new Vector3(0, 92 * 0.5 * 0.55, 0)))).toBeLessThan(1e-4);
      expect(ringCenter(rope, 12).distanceTo(holder.position.clone().add(new Vector3(0, 92 * 1.7 * 0.45, 0)))).toBeLessThan(1e-4);
    });
    const atTurn = holders[2]!.position.clone();
    stage.walk(walk(legends[2]!, 2, { x: legends[2]!.position.x / CELL - 1, y: legends[2]!.position.z / CELL }, 200));
    stage.update(0); expect(holders[2]!.position.equals(atTurn)).toBe(true);
    tick(50); stage.update(0.05);
    expect(holders[2]!.position.distanceTo(atTurn)).toBeGreaterThan(0);
    expect(holders[2]!.position.distanceTo(atTurn)).toBeLessThan(CELL);
    stage.hover(8);
    expect(stage.debug().units.filter(unit => unit.cue !== 'none').map(unit => unit.slot)).toEqual([8]);
    expect(picked).toEqual(unchanged); // rendering never alters the public snapshot
    stage.dispose();
  });

  it('draws an opponent pick when that seat arrives in a later snapshot, without inventing a local pick', () => {
    const { stage } = setup();
    const picked = view(true);
    stage.show({ ...picked, seats: picked.seats.slice(0, 4) });
    expect(stage.debug().fetched.s7).toBeUndefined();
    stage.show(picked); stage.update(0);
    expect(stage.debug().fetched.s7).toBe(7);
    expect(stage.scene.getObjectByName('render3d-carousel-taken')!.children.filter(child => child.name === 'render3d-carousel-unit')).toHaveLength(8);
    stage.dispose();
  });

  it('keeps a moving pair in place when the platform finishes loading', async () => {
    let resolve!: (lease: ModelLease) => void;
    const pending = new Promise<ModelLease>(done => { resolve = done; });
    const { stage, tick } = setup({ hasModel: id => id === 'carousel-llplatforms', loadModel: () => pending });
    const snapshot = view(true);
    stage.show({ ...snapshot, slots: snapshot.slots.map(slot => slot.slot === 8 ? { ...slot, pending: true, cost: 5 } : slot) });
    const offered = stage.scene.getObjectByName('render3d-carousel-units')!.children[0]!;
    const pendingHeight = offered.position.y;
    const legend = stage.scene.getObjectByName('render3d-carousel-seats')!.children[5]!;
    stage.walk(walk(legend, 5, { x: 1, y: -2 })); tick(500); stage.update(0.5);
    const before = legend.position.clone();
    const scene = new Group(); scene.add(new Mesh(new BoxGeometry(2000, 2, 2000), new MeshBasicMaterial()));
    resolve({ scene, animations: [], animationNames: {}, placeholder: false, release: () => scene.removeFromParent() } as unknown as ModelLease);
    await pending; await Promise.resolve();
    expect(legend.position.x).toBeCloseTo(before.x, 8); expect(legend.position.z).toBeCloseTo(before.z, 8);
    expect(offered.position.y).toBeCloseTo(pendingHeight);
    expect(stage.debug().units.find(unit => unit.slot === 8)!.cue).toBe('pending');
    expect(offered.getObjectByName('render3d-carousel-quality')!.visible).toBe(true);
    expect(stage.scene.getObjectByName('render3d-carousel-takable')).toBeUndefined();
    expect(stage.scene.getObjectByName('render3d-carousel-cost')).toBeUndefined();
    tick(500); stage.update(0.5);
    expect(legend.position.x / CELL).toBeCloseTo(1); expect(legend.position.z / CELL).toBeCloseTo(-2);
    expect(stage.debug().fetched.s5).toBe(5);
    stage.dispose();
  });

  it('hides release timers during departure even when a seat has not picked yet', () => {
    const { stage } = setup();
    const snapshot = view(true);
    stage.show({ ...snapshot,
      slots: snapshot.slots.map(slot => slot.slot === 7 ? { ...slot, pickedBy: null } : slot),
      seats: snapshot.seats.map(seat => seat.seatId === 's7' ? { ...seat, releaseAtMs: 6000 } : seat),
    });
    const timers = stage.scene.children.filter(child => child.name === 'render3d-carousel-timer');
    expect(timers.some(timer => timer.visible)).toBe(true);
    stage.show(null);
    expect(stage.departing).toBe(true);
    expect(timers.every(timer => !timer.visible)).toBe(true);
    stage.update(0.6);
    expect(timers.every(timer => timer.parent === null)).toBe(true);
    stage.dispose();
  });

  it('leaves as pairs after the carousel ends, resumes board input immediately, and releases every tube', () => {
    const { stage } = setup(); stage.show(view(true)); stage.update(0);
    const legends = [...stage.scene.getObjectByName('render3d-carousel-seats')!.children];
    const pairs = stage.scene.getObjectByName('render3d-carousel-taken')!.children.filter(child => child.name === 'render3d-carousel-unit');
    const ropes = stage.scene.getObjectByName('render3d-carousel-taken')!.children.filter(child => child.name === 'render3d-carousel-tether') as Mesh[];
    const disposals = ropes.map(rope => vi.spyOn(rope.geometry, 'dispose'));
    stage.show(null);
    expect(stage.active).toBe(false); expect(stage.departing).toBe(true); expect(stage.scene.background).toBeNull();
    expect(stage.scene.getObjectByName('render3d-carousel-units')!.children).toHaveLength(0);
    legends.forEach((legend, i) => {
      expect(legend.parent?.name).toBe(`render3d-carousel-depart-s${i}`);
      expect(pairs[i]!.parent).toBe(legend.parent); expect(ropes[i]!.parent).toBe(legend.parent);
      expect(ropes[i]!.visible).toBe(true);
    });
    stage.walk(walk(legends[2]!, 2, { x: 99, y: 99 }));
    expect(stage.walkTo({ x: 800, y: 450 }, area)).toBeNull();
    expect(stage.slotAt({ x: 800, y: 450 }, area)).toBeNull();
    expect(stage.descriptionAt({ x: 800, y: 450 }, area)).toBeUndefined();
    stage.update(0.2); stage.show(null); stage.update(0.2); // repeated empty snapshots never restart departure
    expect(stage.departing).toBe(true);
    expect(legends[2]!.parent!.scale.x).toBeLessThan(1);
    expect(disposals.every(spy => spy.mock.calls.length === 0)).toBe(true);
    stage.update(0.2);
    expect(stage.departing).toBe(false); expect(stage.debug().fetched).toEqual({});
    expect(disposals.every(spy => spy.mock.calls.length === 1)).toBe(true);
    expect(stage.scene.children.some(child => child.name.startsWith('render3d-carousel-depart-'))).toBe(false);
    stage.dispose(); expect(disposals.every(spy => spy.mock.calls.length === 1)).toBe(true);
  });

  it('cancels departure cleanly for a new carousel and for renderer disposal', () => {
    const { stage } = setup(); stage.show(view(true)); stage.show(null); stage.update(0.1);
    stage.show({ ...view(), id: 'next' });
    expect(stage.active).toBe(true); expect(stage.departing).toBe(false); expect(stage.scene.background).not.toBeNull();
    expect(stage.debug().fetched).toEqual({}); expect(stage.debug().units).toHaveLength(9);
    expect(stage.scene.children.some(child => child.name.startsWith('render3d-carousel-depart-'))).toBe(false);
    stage.show({ ...view(true), id: 'next' }); stage.show(null); stage.dispose();
    expect(stage.departing).toBe(false); expect(stage.active).toBe(false); expect(stage.debug().legends).toEqual([]);
  });

  it('hides immediately when viewing the board during carousel, then restores every confirmed pair on return', () => {
    const { stage } = setup(); stage.show(view(true)); stage.show(null, true);
    expect(stage.active).toBe(false); expect(stage.departing).toBe(false); expect(stage.debug().legends).toEqual([]);
    stage.show(view(true), true); stage.update(0);
    expect(stage.active).toBe(true); expect(Object.keys(stage.debug().fetched)).toHaveLength(8);
    stage.dispose();
  });

  it('releases a stale platform arriving after departure and a new carousel, without resurfacing the new seats', async () => {
    const loads: ((lease: ModelLease) => void)[] = [];
    const { stage } = setup({ hasModel: id => id === 'carousel-llplatforms', loadModel: () => new Promise(done => loads.push(done)) });
    stage.show(view(true)); stage.show(null); stage.show({ ...view(), id: 'next' });
    expect(loads).toHaveLength(2);
    const scene = new Group(); scene.add(new Mesh(new BoxGeometry(2000, 200, 2000), new MeshBasicMaterial()));
    const release = vi.fn(() => scene.removeFromParent());
    loads[0]!({ scene, animations: [], animationNames: {}, placeholder: false, release } as unknown as ModelLease);
    await Promise.resolve(); await Promise.resolve();
    expect(release).toHaveBeenCalledTimes(1);
    expect(stage.scene.getObjectByName('render3d-carousel-platform')!.children).toHaveLength(0);
    expect(stage.scene.getObjectByName('render3d-carousel-seat-me')!.position.y).toBeCloseTo(0.25 * CELL);
    stage.dispose();
    loads[1]!({ scene: new Group(), animations: [], animationNames: {}, placeholder: false, release } as unknown as ModelLease);
    await Promise.resolve(); expect(release).toHaveBeenCalledTimes(2);
  });

  it.each(['mapped-move', 'explicit-run', 'missing-run'] as const)('plays an existing legend movement clip (%s), then returns to idle', async mode => {
    const probes: Group[] = [];
    const clip = (name: string, amount: number) => new AnimationClip(name, 1, [new NumberKeyframeTrack('strideProbe.position[x]', [0, 1], [0, amount])]);
    const { stage, tick } = setup({ hasModel: id => id === 'little-legend-default', loadModel: async () => {
      const scene = new Group(), probe = new Group(); probe.name = 'strideProbe';
      probe.add(new Mesh(new BoxGeometry(10, 10, 10), new MeshBasicMaterial())); scene.add(probe); probes.push(probe);
      return { scene, animations: [clip('idle', 0), clip('walk', 2), clip('run_ufo', 20)],
        animationNames: { idle: 'idle', move: mode === 'mapped-move' ? 'run_ufo' : 'walk',
          ...(mode !== 'mapped-move' ? { run: mode === 'explicit-run' ? 'run_ufo' : 'absent' } : {}) },
        placeholder: false, release: () => scene.removeFromParent() } as unknown as ModelLease;
    } });
    stage.show(view()); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(probes).toHaveLength(8);
    const mine = stage.scene.getObjectByName('render3d-carousel-seat-me')!;
    stage.walk(walk(mine, 2, { x: 0, y: 0 })); tick(250); stage.update(0.25);
    expect(probes[2]!.position.x).toBeCloseTo(mode === 'missing-run' ? 0.5 : 5, 5);
    tick(1000); stage.update(1); stage.update(0.2);
    expect(probes[2]!.position.x).toBeCloseTo(0, 5);
    stage.dispose();
  });
});
