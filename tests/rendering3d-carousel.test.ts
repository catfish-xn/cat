import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Texture, Vector3, type Object3D } from 'three';
import { CAROUSEL_CELL, LEGEND_RADIUS, ORBIT_SECONDS, RUN_CELLS, UNIT_RADIUS, createCarouselStage, type CarouselStageContext } from '../src/rendering/three-mode/carousel-stage';
import {
  boardFeedGeneration, provideCarouselControls, provideLegendControls, publishCarousel, publishLegendWalk, subscribeBoardFeed, boardFeed,
  type BoardCarousel, type BoardCarouselSlot, type BoardLegendWalk,
} from '../src/rendering/board-feed';
import {
  CAROUSEL_LEGEND_RADIUS, CAROUSEL_ORBIT_MS, CAROUSEL_UNIT_RADIUS, LEGEND_CELLS_PER_SECOND, carouselHome, carouselUnitPoint,
} from '../src/server/legend-motion';
import type { ModelLease, ParticleEffect } from '../src/rendering3d';

/** Synthetic data only: no asset files. Models are plain boxes and effects stand-in objects; the stage logic is production code. */
const slot = (index: number, changes: Partial<BoardCarouselSlot> = {}): BoardCarouselSlot => ({
  slot: index, definitionId: `unit-${index}`, starLevel: 1, items: [{ id: `item-${index}`, icon: null }], pickedBy: null, takable: false, pending: false, ...changes,
});
/** Eight seats, mine is s2; held until a minute in, or released from the start. */
const seats = (locked: boolean) => Array.from({ length: 8 }, (_, index) => ({ seatId: `s${index}`, me: index === 2, releaseAtMs: locked ? 60_000 : 0 }));
const carousel = (changes: Partial<BoardCarousel> = {}): BoardCarousel => ({
  id: 'c1', slots: Array.from({ length: 9 }, (_, index) => slot(index)), seats: seats(true), elapsedMs: 0, at: 0, ...changes,
});

function fakeEffect(): ParticleEffect & { disposed: boolean } {
  const effect = { object: new Group(), finished: false, disposed: false, update() {}, dispose() { effect.disposed = true; effect.object.removeFromParent(); } };
  return effect as unknown as ParticleEffect & { disposed: boolean };
}
/** A model whose only mesh is a flat slab whose top is `top` source units above its origin. */
function fakeLease(top = 0, size = 4000): ModelLease & { released: boolean } {
  const scene = new Group(), slab = new Mesh(new BoxGeometry(size, 2, size), new MeshBasicMaterial());
  slab.position.y = top - 1; scene.add(slab);
  const lease = { scene, animations: [], animationNames: {}, placeholder: false, released: false, release() { lease.released = true; scene.removeFromParent(); } };
  return lease as unknown as ModelLease & { released: boolean };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function setup(overrides: Partial<CarouselStageContext> = {}) {
  let clock = 0;
  const stage = createCarouselStage({ championHeight: 92, championWidth: 110, sourceScale: 0.44, legendModel: 'little-legend-default',
    loadModel: null, hasModel: () => false, loadEffect: null, starColor: () => '#ffd34d', now: () => clock, ...overrides });
  stage.resize(16 / 9);
  return { stage, tick: (ms: number) => { clock += ms; } };
}

describe('3D carousel stage', () => {
  it('separates the item sprite description from its hero, with projected boxes and no take', () => {
    const { stage } = setup();
    stage.show(carousel({ slots: [slot(0, { takable: true })] }));
    const area = { left: 30, top: 40, width: 960, height: 540 };
    const holder = stage.scene.getObjectByName('render3d-carousel-units')!.children[0]!;
    holder.updateWorldMatrix(true, true); stage.camera.updateMatrixWorld();
    const sprite = holder.children.find(child => (child as any).isSprite)!;
    expect(sprite).toBeDefined();
    const screen = (point: Vector3) => { point.project(stage.camera); return { x: area.left + (point.x + 1) * area.width / 2, y: area.top + (1 - point.y) * area.height / 2 }; };
    const itemPoint = screen(sprite.getWorldPosition(new Vector3()));
    const item = stage.descriptionAt(itemPoint, area)!;
    expect(item.target).toEqual({ kind: 'item', id: 'item-0' });
    expect(item.box.left).toBeLessThan(itemPoint.x); expect(item.box.right).toBeGreaterThan(itemPoint.x);
    expect(item.box.top).toBeLessThan(itemPoint.y); expect(item.box.bottom).toBeGreaterThan(itemPoint.y);
    const unit = stage.descriptionAt(screen(holder.getWorldPosition(new Vector3()).add(new Vector3(0, 10, 0))), area)!;
    expect(unit.target).toEqual({ kind: 'carousel', unit: slot(0, { takable: true }) });
    expect(stage.debug().fetched).toEqual({}); expect(stage.debug().legends.every(entry => !entry.includes(':walk') && !entry.includes(':chase'))).toBe(true);
    stage.show(null); expect(stage.descriptionAt(itemPoint, area)).toBeUndefined(); stage.dispose();
  });
  it('draws stand-ins without an asset root, including procedural release timer rings', () => {
    const { stage } = setup();
    stage.show(carousel());
    const debug = stage.debug();
    expect(debug.platform).toEqual(['standin']);
    expect(debug.legends).toHaveLength(8);
    expect(debug.legends.every(entry => entry.endsWith(':standin:locked'))).toBe(true);
    expect(debug.units.map(unit => unit.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(debug.units.every(unit => unit.body === 'standin' && unit.items === 1 && unit.ring === 'none')).toBe(true);
    expect(debug.effects.some(entry => entry.includes('timer'))).toBe(false);
    const timers = stage.scene.children.filter(child => child.name === 'render3d-carousel-timer');
    expect(timers).toHaveLength(8);
    expect(timers.every(timer => timer.visible && timer.userData.fraction === 1)).toBe(true);
  });

  it('puts legends on the outer cradles and units on the inner ring, at the doc proportions', () => {
    const { stage } = setup();
    stage.show(carousel());
    const seatsGroup = stage.scene.getObjectByName('render3d-carousel-seats')!, unitsGroup = stage.scene.getObjectByName('render3d-carousel-units')!;
    for (const seat of seatsGroup.children) expect(Math.hypot(seat.position.x, seat.position.z) / CAROUSEL_CELL).toBeCloseTo(7.1, 5);
    for (const unit of unitsGroup.children) expect(Math.hypot(unit.position.x, unit.position.z) / CAROUSEL_CELL).toBeCloseTo(2.5, 5);
    // Legends face the center (models face +z).
    const seat = seatsGroup.children[0]!, forward = new Vector3(0, 0, 1).applyEuler(seat.rotation);
    expect(forward.dot(seat.position.clone().setY(0).negate().normalize())).toBeCloseTo(1, 5);
  });

  it('turns only the unit group, by the time since the carousel opened, never by frames', () => {
    const { stage, tick } = setup();
    stage.show(carousel({ elapsedMs: 12_000, at: 0 }));
    stage.update(1 / 60); stage.update(1 / 60);
    expect(stage.debug().angle).toBeCloseTo(Math.PI / 2, 5); // 12 s of a 48 s turn
    tick(12_000); stage.update(1 / 60);
    expect(stage.debug().angle).toBeCloseTo(Math.PI, 5);
    expect(stage.scene.getObjectByName('render3d-carousel-seats')!.rotation.y).toBe(0);
    expect(stage.scene.getObjectByName('render3d-carousel-platform')!.rotation.y).toBe(0);
  });

  it('rings the units the panel would take, and takes one off the ring only once the view names who took it', async () => {
    const { stage } = setup();
    stage.show(carousel());
    stage.show(carousel({ slots: Array.from({ length: 9 }, (_, index) => slot(index, { takable: true })) }));
    expect(stage.debug().units.every(unit => unit.ring === 'takable')).toBe(true);
    stage.hover(4);
    expect(stage.debug().units.find(unit => unit.slot === 4)!.ring).toBe('hover');
    // Pending: still standing until the server answers.
    stage.show(carousel({ slots: Array.from({ length: 9 }, (_, index) => slot(index, { pending: index === 4 })) }));
    expect(stage.debug().units.find(unit => unit.slot === 4)!.ring).toBe('pending');
    stage.show(carousel({ slots: Array.from({ length: 9 }, (_, index) => slot(index, { pickedBy: index === 4 ? 's5' : null })) }));
    await flush();
    expect(stage.debug().units.find(unit => unit.slot === 4)!.ring).toBe('none');
    expect(stage.scene.getObjectByName('render3d-carousel-units')!.children).toHaveLength(8);
  });

  it('holds locked seats with the restraint (early part only) and plays the first-draft wall until my release', async () => {
    const effects: { id: string; seconds: number; fx: ReturnType<typeof fakeEffect> }[] = [];
    const { stage } = setup({ loadEffect: (id, seconds) => { const fx = fakeEffect(); effects.push({ id, seconds, fx }); return Promise.resolve(fx); } });
    stage.show(carousel());
    await flush();
    const restraint = effects.filter(entry => entry.id.startsWith('carousel-shareddraftplayerrestraint'));
    expect(restraint).toHaveLength(8);
    expect(restraint.filter(entry => entry.id === 'carousel-shareddraftplayerrestraint')).toHaveLength(1); // mine
    expect(restraint.every(entry => entry.seconds <= 1.2)).toBe(true);
    expect(effects.some(entry => entry.id === 'carousel-shareddraft-firstdraftwall-galaxy')).toBe(true);
    expect(effects.some(entry => entry.id === 'carousel-shareddraft-playerindicator')).toBe(true);
    expect(effects.some(entry => /timer|beam|crystal|unittier/.test(entry.id))).toBe(false);
    // My batch is released: my restraint and the wall end, its fade plays once.
    stage.show(carousel({ seats: seats(true).map(seat => seat.me ? { ...seat, releaseAtMs: 0 } : seat) }));
    await flush();
    expect(effects.find(entry => entry.id === 'carousel-shareddraftplayerrestraint')!.fx.disposed).toBe(true);
    expect(effects.find(entry => entry.id === 'carousel-shareddraft-firstdraftwall-galaxy')!.fx.disposed).toBe(true);
    expect(effects.filter(entry => entry.id === 'carousel-shareddraft-firstdraftwall-death-galaxy')).toHaveLength(1);
    expect(stage.debug().legends.filter(entry => entry.endsWith(':locked'))).toHaveLength(7);
  });

  it('rings each unit with the quality effect of its cost, carried by the unit on the turning ring, and drops it with the unit', async () => {
    const effects: { id: string; fx: ReturnType<typeof fakeEffect> }[] = [];
    const { stage } = setup({ loadEffect: id => { const fx = fakeEffect(); effects.push({ id, fx }); return Promise.resolve(fx); } });
    const costs = [1, 2, 3, 4, 5, 9, 0];
    const slots = costs.map((cost, index) => slot(index, cost ? { cost } : {}));
    stage.show(carousel({ slots }));
    await flush();
    const tiers = effects.filter(entry => entry.id.startsWith('carousel-shareddraft-unittier'));
    // cost 9 is capped at tier 6; a slot without a cost gets no ring rather than a guessed one.
    expect(tiers.map(entry => entry.id).sort()).toEqual([1, 2, 3, 4, 5, 6].map(tier => `carousel-shareddraft-unittier${tier}`));
    for (const entry of tiers) expect(entry.fx.object.parent?.name).toBe('render3d-carousel-unit');
    // Taking a unit removes its ring with it.
    stage.show(carousel({ slots: slots.map(entry => entry.slot === 2 ? { ...entry, pickedBy: 's0' } : entry) }));
    await flush();
    expect(tiers.find(entry => entry.id === 'carousel-shareddraft-unittier3')!.fx.disposed).toBe(true);
    expect(tiers.filter(entry => entry.fx.disposed)).toHaveLength(1);
    stage.dispose();
    expect(tiers.every(entry => entry.fx.disposed)).toBe(true);
  });
  it('loads the platform as one group at the shared scale, keeps the skybox as scenery, and stands legends on the cradle surface', async () => {
    const leases = new Map<string, ReturnType<typeof fakeLease>>();
    const platform = ['carousel-center', 'carousel-llplatforms', 'carousel-glassdome-a', 'carousel-skybox'];
    const { stage } = setup({
      hasModel: id => platform.includes(id),
      loadModel: id => { const lease = fakeLease(id === 'carousel-llplatforms' ? 100 : 20); leases.set(id, lease); return Promise.resolve(lease); },
    });
    stage.show(carousel());
    await flush(); await flush();
    expect(stage.debug().platform.sort()).toEqual([...platform].sort());
    for (const lease of leases.values()) expect(lease.scene.scale.x).toBeCloseTo(0.44, 5);
    expect(stage.scene.getObjectByName('render3d-carousel-scenery')!.children.map(child => child.name)).toEqual(['carousel-skybox']);
    expect(stage.scene.getObjectByName('render3d-carousel-standin')!.visible).toBe(false);
    const seat = stage.scene.getObjectByName('render3d-carousel-seats')!.children[0]!;
    expect(seat.position.y).toBeCloseTo(100 * 0.44, 3);
    const unit = stage.scene.getObjectByName('render3d-carousel-units')!.children[0]!;
    expect(unit.position.y).toBeCloseTo(20 * 0.44, 3);
    // Leaving the carousel releases every lease.
    stage.show(null);
    expect([...leases.values()].every(lease => lease.released)).toBe(true);
    expect(stage.active).toBe(false);
  });

  it('picks the unit under the pointer and says whether the panel would take it', () => {
    const { stage } = setup();
    stage.show(carousel({ slots: [slot(0, { takable: true }), slot(1)] }));
    stage.update(0);
    const area = { left: 0, top: 0, width: 1600, height: 900 };
    const point = (index: number) => {
      const holder = stage.scene.getObjectByName('render3d-carousel-units')!.children[index]!;
      const at = holder.getWorldPosition(new Vector3()).setY(holder.position.y + 0.8 * CAROUSEL_CELL).project(stage.camera);
      return { x: (at.x + 1) / 2 * area.width, y: (1 - at.y) / 2 * area.height };
    };
    expect(stage.slotAt(point(0), area)).toEqual({ slot: 0, takable: true });
    expect(stage.slotAt(point(1), area)).toEqual({ slot: 1, takable: false });
    expect(stage.slotAt({ x: 2, y: 2 }, area)).toBeNull();
  });

  it('picks a turning unit by a box at its live position, from its feet up to its star, nearest wins', () => {
    const { stage } = setup();
    stage.show(carousel({ slots: Array.from({ length: 9 }, (_, index) => slot(index, { takable: true })) }));
    const area = { left: 0, top: 0, width: 1600, height: 900 };
    const at = (object: Object3D) => { const p = object.getWorldPosition(new Vector3()).project(stage.camera); return { x: (p.x + 1) / 2 * area.width, y: (1 - p.y) / 2 * area.height }; };
    for (const seconds of [0, 1.7, 3.1]) {
      stage.update(seconds);
      stage.scene.updateMatrixWorld(true);
      stage.scene.getObjectByName('render3d-carousel-units')!.children.slice(0, 9).forEach((holder, index) => {
        const feet = at(holder), star = at(holder.children[2]!); // root, ring, star mark
        // Its feet and the star over its head both take the unit, wherever the ring has turned it.
        expect(stage.slotAt({ x: feet.x, y: feet.y - 2 }, area)?.slot).toBe(index);
        expect(stage.slotAt({ x: star.x, y: star.y + 2 }, area)?.slot).toBe(index);
      });
    }
  });

  it.each(['standin', 'loaded'] as const)('frames every pedestal vertex and legend head without making the %s arena too small', async mode => {
    // Synthetic outer pedestal: no copyrighted assets. Loading it also exercises refitting after async model arrival.
    const { stage } = setup(mode === 'loaded' ? {
      sourceScale: 1,
      hasModel: id => id === 'carousel-llplatforms',
      loadModel: async () => {
        const scene = new Group();
        const pedestal = new Mesh(new CylinderGeometry(8.6 * CAROUSEL_CELL, 8.6 * CAROUSEL_CELL, 0.2 * CAROUSEL_CELL, 96), new MeshBasicMaterial());
        pedestal.position.y = -0.1 * CAROUSEL_CELL;
        scene.add(pedestal);
        return { scene, animations: [], animationNames: {}, placeholder: false, release() {} } as unknown as ModelLease;
      },
    } : {});
    try {
      stage.show(carousel({ seats: seats(false) }));
      await flush();
      stage.update(5); // past the opening push-in
      expect(stage.debug().platform).toEqual([mode === 'loaded' ? 'carousel-llplatforms' : 'standin']);
      // Keep the old offset alive during resize, then install the new one before update, as the host does.
      for (const withOffset of [false, true]) for (const aspect of [4 / 3, 16 / 9, 4 / 3, 21 / 9, 1]) {
        stage.resize(aspect);
        if (withOffset) stage.camera.setViewOffset(aspect * 900, 900, -180, -60, aspect * 900 + 360, 1020);
        else stage.camera.clearViewOffset();
        stage.update(0);
        stage.scene.updateMatrixWorld(true);
        const assertVisibleVertices = (root: Object3D) => {
          let count = 0;
          root.traverse(object => {
            if (!(object instanceof Mesh)) return;
            const vertices = object.geometry.getAttribute('position');
            for (let i = 0; i < vertices.count; i++) {
              const p = new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(object.matrixWorld).project(stage.camera);
              expect(Math.abs(p.x), `${mode}, aspect ${aspect}, offset ${withOffset}, ${object.name}: x`).toBeLessThanOrEqual(0.975);
              expect(Math.abs(p.y), `${mode}, aspect ${aspect}, offset ${withOffset}, ${object.name}: y`).toBeLessThanOrEqual(0.975);
              expect(Math.abs(p.z), 'inside the camera clipping planes').toBeLessThanOrEqual(1);
              count++;
            }
          });
          expect(count).toBeGreaterThan(0); // never pass on an empty fixture
        };
        assertVisibleVertices(stage.scene.getObjectByName(mode === 'loaded' ? 'render3d-carousel-platform' : 'render3d-carousel-standin')!);
        const legends = stage.scene.getObjectByName('render3d-carousel-seats')!;
        assertVisibleVertices(legends); // includes the actual stand-in head geometry, not just its feet
        assertVisibleVertices(stage.scene.getObjectByName('render3d-carousel-units')!);
        const ys = legends.children.map(legend => legend.getWorldPosition(new Vector3()).project(stage.camera).y);
        // Cradle/legend feet span about 1.25 NDC vertically; 1.2 leaves rounding/fixture margin while rejecting a distant, tiny arena.
        // A square viewport is width-limited (about 1.184 vertically); mainstream ratios must still span 1.2.
        // Span is measured in the un-offset board viewport; the host's larger canvas adds surrounding UI space.
        if (!withOffset) expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(aspect === 1 ? 1.15 : 1.2);
      }
    } finally {
      stage.dispose();
    }
  });

  it('frames the entire two-cell pedestal slab across aspect ratios without fitting its deep strut', async () => {
    const radius = 8.6 * CAROUSEL_CELL;
    const scene = new Group(), material = new MeshBasicMaterial();
    const slab = new Mesh(new CylinderGeometry(radius, radius, 2 * CAROUSEL_CELL, 128), material);
    slab.position.y = -CAROUSEL_CELL;
    const strut = new Mesh(new CylinderGeometry(CAROUSEL_CELL, CAROUSEL_CELL, 20 * CAROUSEL_CELL, 16), material);
    strut.position.y = -12 * CAROUSEL_CELL;
    scene.add(slab, strut);
    const { stage } = setup({ sourceScale: 1, hasModel: id => id === 'carousel-llplatforms',
      loadModel: async () => ({ scene, animations: [], animationNames: {}, placeholder: false, release() {} }) as ModelLease });
    try {
      stage.show(carousel({ seats: seats(false) })); await flush(); stage.update(5);
      expect(stage.debug().platform).toEqual(['carousel-llplatforms']);
      for (const aspect of [16 / 9, 4 / 3, 21 / 9, 1]) {
        stage.resize(aspect); stage.update(0); stage.scene.updateMatrixWorld(true);
        const positions = slab.geometry.getAttribute('position'); let checked = 0;
        for (let i = 0; i < positions.count; i++) {
          const point = new Vector3().fromBufferAttribute(positions, i);
          if (Math.hypot(point.x, point.z) < radius * 0.99) continue; // cap centers are not the outer rim
          point.applyMatrix4(slab.matrixWorld).project(stage.camera);
          expect(Math.abs(point.x), `aspect ${aspect}, rim vertex ${i}: x`).toBeLessThanOrEqual(0.975);
          expect(Math.abs(point.y), `aspect ${aspect}, rim vertex ${i}: y`).toBeLessThanOrEqual(0.975);
          expect(Math.abs(point.z)).toBeLessThanOrEqual(1); checked++;
        }
        expect(checked).toBeGreaterThanOrEqual(256);
        // Exclusion is observable: fitting this strut would pull the whole arena far back.
        const tip = new Vector3(0, -22 * CAROUSEL_CELL, 0).project(stage.camera);
        expect(Math.abs(tip.y)).toBeGreaterThan(0.975);
      }
    } finally { stage.dispose(); slab.geometry.dispose(); strut.geometry.dispose(); material.dispose(); }
  });

  it('reuses the fitted distance on stable frames and refits only when the projection key changes', () => {
    const { stage } = setup();
    stage.show(carousel({ seats: seats(false) }));
    stage.update(5); // settle the intro before comparing camera positions
    // The fit projects rim samples during bisection; ordinary stand-in updates do not project anything.
    const project = vi.spyOn(Vector3.prototype, 'project');
    const projection = vi.spyOn(stage.camera, 'updateProjectionMatrix');
    const stableFrames = () => {
      const position = stage.camera.position.clone();
      project.mockClear(); projection.mockClear();
      for (let frame = 0; frame < 60; frame++) stage.update(1 / 60);
      expect(project).not.toHaveBeenCalled();
      expect(projection).not.toHaveBeenCalled();
      expect(stage.camera.position.equals(position)).toBe(true);
    };
    const refits = (change: () => void) => {
      project.mockClear();
      change();
      stage.update(0);
      expect(project).toHaveBeenCalled();
      stableFrames();
    };
    try {
      stableFrames();
      refits(() => stage.resize(4 / 3));
      refits(() => stage.camera.setViewOffset(1200, 900, -180, -60, 1560, 1020));
      // Reinstalling identical values must hit the cache even though Three updates its projection matrix.
      stage.camera.setViewOffset(1200, 900, -180, -60, 1560, 1020);
      stableFrames();
      refits(() => stage.camera.setViewOffset(1200, 900, -200, -60, 1560, 1020));
      refits(() => stage.camera.setViewOffset(1200, 900, -200, -80, 1560, 1020));
      refits(() => stage.camera.setViewOffset(1200, 900, -200, -80, 1600, 1020));
      refits(() => stage.camera.setViewOffset(1200, 900, -200, -80, 1600, 1080));
      // Same aspect, different CSS dimensions still change the full view box key.
      refits(() => stage.camera.setViewOffset(1600, 1200, -200, -80, 1600, 1080));
      refits(() => stage.camera.clearViewOffset());
    } finally {
      project.mockRestore(); projection.mockRestore(); stage.dispose();
    }
  });

  it('rings each unit in its cost color, whether or not the tier effect loads, and drops the ring once the unit is taken', () => {
    const colors: Record<number, string> = { 1: '#808080', 2: '#11aa44', 3: '#2277ee', 4: '#aa33cc', 5: '#ffbb22' };
    const { stage } = setup({ costColor: cost => colors[cost]! });
    stage.show(carousel({ slots: Array.from({ length: 9 }, (_, index) => slot(index, { cost: index % 5 + 1 })) }));
    const rings = () => stage.scene.getObjectByName('render3d-carousel-units')!.children
      .map(unit => unit.getObjectByName('render3d-carousel-cost') as Mesh | undefined);
    const hex = (mesh: Mesh | undefined) => `#${(mesh!.material as MeshStandardMaterial).color.getHexString()}`;
    expect(rings().map(hex)).toEqual(Array.from({ length: 9 }, (_, index) => colors[index % 5 + 1]));
    expect(rings().every(mesh => mesh!.visible)).toBe(true);
    // No cost known: no ring (no guess).
    const { stage: bare } = setup();
    bare.show(carousel());
    expect(bare.scene.getObjectByName('render3d-carousel-cost')).toBeUndefined();
    stage.show(carousel({ slots: Array.from({ length: 9 }, (_, index) => slot(index, { cost: index % 5 + 1, pickedBy: index === 4 ? 's5' : null })) }));
    const taken = stage.scene.getObjectByName('render3d-carousel-taken')!.getObjectByName('render3d-carousel-cost')!;
    expect(taken.visible).toBe(false);
    stage.dispose(); bare.dispose();
  });

  it('attaches a confirmed pick without pulling the legend toward it or sending it home', () => {
    const { stage } = setup();
    stage.show(carousel({ seats: seats(false) }));
    const legend = stage.scene.getObjectByName('render3d-carousel-seats')!.children[5]!;
    legend.position.set(CAROUSEL_CELL, 0, CAROUSEL_CELL);
    const position = legend.position.clone();
    stage.show(carousel({ seats: seats(false), slots: Array.from({ length: 9 }, (_, index) => slot(index, { pickedBy: index === 4 ? 's5' : null })) }));
    expect(stage.debug().fetched).toEqual({ s5: 4 });
    for (let frame = 0; frame < 360; frame++) stage.update(1 / 60);
    expect(legend.position.distanceTo(position)).toBe(0);
    const unit = stage.scene.getObjectByName('render3d-carousel-taken')!.children.find(child => child.name === 'render3d-carousel-unit')!;
    expect(unit.position.distanceTo(position) / CAROUSEL_CELL).toBeCloseTo(1.1, 0);
    expect(stage.debug().units.filter(entry => entry.ring !== 'none').map(entry => entry.slot)).not.toContain(4);
    stage.dispose();
  });

  it('walks my legend on a ground click only once released and with no pick out; my pick sends it running, a refusal stops it', () => {
    const { stage } = setup();
    const area = { left: 0, top: 0, width: 1600, height: 900 }, middle = { x: 800, y: 450 };
    stage.show(carousel());
    stage.update(0);
    expect(stage.walkTo(middle, area)).toBeNull(); // held
    stage.show(carousel({ seats: seats(false) }));
    expect(stage.walkTo(middle, area)).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect(stage.debug().legends[2]).toMatch(/:walk$/);
    const mine = stage.scene.getObjectByName('render3d-carousel-seat-me')!, start = Math.hypot(mine.position.x, mine.position.z);
    for (let frame = 0; frame < 30; frame++) stage.update(1 / 60);
    expect(Math.hypot(mine.position.x, mine.position.z)).toBeLessThan(start - CAROUSEL_CELL);
    // My click on slot 3 is out: running for it, and no more ground walking.
    stage.show(carousel({ seats: seats(false), slots: Array.from({ length: 9 }, (_, index) => slot(index, { pending: index === 3 })) }));
    expect(stage.debug().legends[2]).toMatch(/:chase$/);
    expect(stage.walkTo(middle, area)).toBeNull();
    // Refused (someone else got it first): it stops where it is.
    stage.show(carousel({ seats: seats(false), slots: Array.from({ length: 9 }, (_, index) => slot(index, { pickedBy: index === 3 ? 's6' : null })) }));
    expect(stage.debug().legends[2]).not.toMatch(/:chase$/);
    expect(stage.debug().fetched).toMatchObject({ s6: 3 });
    // Mine is taken: it carries it and may still walk.
    stage.show(carousel({ seats: seats(false), slots: Array.from({ length: 9 }, (_, index) => slot(index, { pickedBy: index === 3 ? 's6' : index === 5 ? 's2' : null })) }));
    expect(stage.debug().legends[2]).toMatch(/:carry$/);
    for (let frame = 0; frame < 360; frame++) stage.update(1 / 60);
    expect(stage.debug().fetched).toMatchObject({ s2: 5, s6: 3 });
    expect(stage.walkTo(middle, area)).not.toBeNull();
    expect(stage.runTo(1)).toBe(false);
  });

  it('puts units already taken on the first view by their legends at home, with nothing to watch', async () => {
    const { stage } = setup();
    stage.show(carousel({ seats: seats(false), slots: Array.from({ length: 9 }, (_, index) => slot(index, { pickedBy: index === 1 ? 's7' : null })) }));
    await flush();
    expect(stage.debug().fetched).toEqual({ s7: 1 });
    expect(stage.debug().effects.some(entry => entry.startsWith('burst'))).toBe(false);
    expect(stage.debug().legends[7]).toMatch(/:carry$/);
  });

  it('releases held seats by the carousel clock, breaking the chains once and calling my release once', async () => {
    const onReleased = vi.fn();
    const { stage, tick } = setup({ onReleased });
    const timed = seats(true).map((seat, index) => ({ ...seat, releaseAtMs: index < 4 ? 3000 : 6000 }));
    stage.show(carousel({ seats: timed }));
    stage.update(1 / 60);
    expect(stage.debug().legends.filter(entry => entry.includes(':locked'))).toHaveLength(8);
    tick(3000); stage.update(1 / 60);
    expect(stage.debug().legends.filter(entry => entry.includes(':locked'))).toHaveLength(4);
    expect(stage.debug().effects.filter(entry => entry.startsWith('burst'))).toHaveLength(5); // four chains and my wall
    expect(onReleased).toHaveBeenCalledTimes(1);
    tick(3000); stage.update(1 / 60); stage.update(1 / 60);
    expect(stage.debug().legends.some(entry => entry.includes(':locked'))).toBe(false);
    expect(onReleased).toHaveBeenCalledTimes(1);
  });

  it('shows item icons from their URLs and disposes everything on a new carousel and on dispose', async () => {
    const texture = new Texture(), loadTexture = vi.fn(() => Promise.resolve(texture));
    const dispose = vi.spyOn(texture, 'dispose');
    const { stage } = setup({ loadTexture });
    stage.show(carousel({ slots: [slot(0, { items: [{ id: 'bf', icon: '/icons/bf.png' }, { id: 'bow', icon: null }] })] }));
    await flush();
    expect(loadTexture).toHaveBeenCalledWith('/icons/bf.png');
    expect(stage.debug().units[0]!.items).toBe(2);
    stage.show(carousel({ id: 'c2', slots: [slot(0, { definitionId: 'other' })] }));
    expect(stage.debug().units).toHaveLength(1);
    stage.dispose();
    await flush();
    expect(dispose).toHaveBeenCalled();
    expect(stage.debug().units).toHaveLength(0);
  });
});

describe('3D carousel legends walk where the room has them', () => {
  it('draws with the room geometry: the same cradles, ring, turn and pace the room aims walks by', () => {
    expect([LEGEND_RADIUS, UNIT_RADIUS, ORBIT_SECONDS * 1000, RUN_CELLS]).toEqual([CAROUSEL_LEGEND_RADIUS, CAROUSEL_UNIT_RADIUS, CAROUSEL_ORBIT_MS, LEGEND_CELLS_PER_SECOND]);
    const { stage } = setup();
    stage.show(carousel({ elapsedMs: 7_000, at: 0 }));
    stage.update(0);
    const seatsGroup = stage.scene.getObjectByName('render3d-carousel-seats')!, unitsGroup = stage.scene.getObjectByName('render3d-carousel-units')!;
    seatsGroup.children.forEach((seat, index) => {
      const home = carouselHome(index, 8);
      expect(seat.position.x / CAROUSEL_CELL).toBeCloseTo(home.x, 5); expect(seat.position.z / CAROUSEL_CELL).toBeCloseTo(home.y, 5);
    });
    unitsGroup.updateWorldMatrix(true, true);
    unitsGroup.children.forEach((unit, index) => {
      const at = unit.getWorldPosition(new Vector3()), point = carouselUnitPoint(index, 9, 7_000);
      expect(at.x / CAROUSEL_CELL).toBeCloseTo(point.x, 5); expect(at.z / CAROUSEL_CELL).toBeCloseTo(point.y, 5);
    });
  });

  it('moves any seat along the room walk, including while carrying a unit', () => {
    const { stage, tick } = setup();
    stage.show(carousel({ seats: seats(false) }));
    const other = stage.scene.getObjectByName('render3d-carousel-seats')!.children[5]!;
    const walk: BoardLegendWalk = { seatId: 's5', scene: 'carousel', from: carouselHome(5, 8), to: { x: 1, y: -2 }, startedAt: 0, arriveAt: 1000, slot: null, who: 'other' };
    stage.walk(walk);
    expect(stage.debug().legends[5]).toMatch(/:walk$/);
    tick(500); stage.update(0.5);
    const half = other.position.clone();
    expect(half.x / CAROUSEL_CELL).toBeCloseTo((carouselHome(5, 8).x + 1) / 2, 3);
    tick(600); stage.update(0.6);
    expect(other.position.x / CAROUSEL_CELL).toBeCloseTo(1, 5); expect(other.position.z / CAROUSEL_CELL).toBeCloseTo(-2, 5);
    expect(stage.debug().legends[5]).not.toMatch(/:walk$/);
    // s5 took slot 0: subsequent walks still move it and its carried unit.
    stage.show(carousel({ seats: seats(false), slots: Array.from({ length: 9 }, (_, index) => slot(index, { pickedBy: index === 0 ? 's5' : null })) }));
    expect(stage.debug().fetched).toMatchObject({ s5: 0 });
    stage.walk({ ...walk, to: { x: -2, y: 1 }, startedAt: 1100, arriveAt: 2000 });
    tick(1000); stage.update(1);
    expect(other.position.x / CAROUSEL_CELL).toBeCloseTo(-2);
    expect(other.position.z / CAROUSEL_CELL).toBeCloseTo(1);
    expect(stage.debug().fetched).toMatchObject({ s5: 0 });
  });

  it('runs my legend to a unit I may take at once, and not before release', () => {
    const { stage } = setup();
    stage.show(carousel());
    expect(stage.runTo(4)).toBe(false);
    stage.show(carousel({ seats: seats(false), slots: Array.from({ length: 9 }, (_, index) => slot(index, { takable: true })) }));
    expect(stage.runTo(4)).toBe(true);
    expect(stage.debug().legends[2]).toMatch(/:chase$/);
    // The room's walk for me takes over from where it is drawn.
    stage.walk({ seatId: 's2', scene: 'carousel', from: { x: 0, y: 0 }, to: { x: 0.5, y: 2 }, startedAt: 0, arriveAt: 800, slot: 4, who: 'me' });
    expect(stage.debug().legends[2]).toMatch(/:walk$/);
  });
});

describe('board-feed legend channel', () => {
  it('hands the room walks to the layer and my walks to the room', () => {
    const got: BoardLegendWalk[] = [];
    const off = subscribeBoardFeed({ frame() {}, events() {}, legendWalk: walk => got.push(walk) });
    const walk: BoardLegendWalk = { seatId: 's1', scene: 'board', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, startedAt: 0, arriveAt: 300, slot: null, who: 'opponent' };
    publishLegendWalk(walk);
    expect(got).toEqual([walk]);
    const sent = vi.fn(() => true);
    const withdraw = provideLegendControls({ walk: sent });
    expect(boardFeed.legendControls?.()?.walk({ scene: 'carousel', slot: 2 })).toBe(true);
    expect(sent).toHaveBeenCalledWith({ scene: 'carousel', slot: 2 });
    withdraw(); off();
    expect(boardFeed.legendControls?.()).toBeNull();
  });
});

describe('board-feed carousel channel', () => {
  it('builds a carousel only for a layer that draws one, and hands the panel click and hover through', () => {
    const before = boardFeedGeneration();
    expect(publishCarousel(() => { throw new Error('not built'); })).toBe(false);
    const shown: (BoardCarousel | null)[] = [];
    const off = subscribeBoardFeed({ frame() {}, events() {}, carousel: view => shown.push(view) });
    expect(boardFeedGeneration()).toBe(before + 1);
    expect(publishCarousel(() => carousel())).toBe(true);
    expect(publishCarousel(() => null)).toBe(true);
    expect(shown.map(view => view?.id ?? null)).toEqual(['c1', null]);
    const pick = vi.fn(), hover = vi.fn();
    const withdraw = provideCarouselControls({ pick, hover });
    boardFeed.carouselControls?.()?.pick(3); boardFeed.carouselControls?.()?.hover(null);
    expect(pick).toHaveBeenCalledWith(3); expect(hover).toHaveBeenCalledWith(null);
    withdraw(); off();
    expect(boardFeed.carouselControls?.()).toBeNull();
    expect(publishCarousel(() => carousel())).toBe(false);
  });
});

describe('carousel pick limits ownership without locking movement', () => {
  it('keeps local and relayed movement after a pick, with the unit behind, and forbids another pick', () => {
    const { stage, tick } = setup();
    const area = { left: 0, top: 0, width: 1600, height: 900 };
    stage.show(carousel({ seats: seats(false) }));
    const mine = stage.scene.getObjectByName('render3d-carousel-seat-me')!;
    const walk: BoardLegendWalk = { seatId: 's2', scene: 'carousel', from: carouselHome(2, 8), to: { x: 0, y: 0 }, startedAt: 0, arriveAt: 2000, slot: null, who: 'me' };
    stage.walk(walk); tick(1000); stage.update(1);
    const halfway = mine.position.clone();
    stage.show(carousel({ seats: seats(false), slots: [slot(0, { pickedBy: 's2' }), slot(1)] }));
    expect(mine.position.equals(halfway)).toBe(true);
    tick(1000); stage.update(1);
    expect(Math.hypot(mine.position.x, mine.position.z)).toBeCloseTo(0);
    expect(stage.debug().fetched).toEqual({ s2: 0 });
    expect(stage.runTo(1)).toBe(false);
    stage.walk({ ...walk, from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, startedAt: 2000, arriveAt: 3000 });
    tick(1000); stage.update(1);
    expect(mine.position.x / CAROUSEL_CELL).toBeCloseTo(1);
    const unit = stage.scene.getObjectByName('render3d-carousel-taken')!.children.find(child => child.name === 'render3d-carousel-unit')!;
    expect(unit.position.x).toBeLessThan(mine.position.x);
    expect(stage.walkTo({ x: 800, y: 450 }, area)).not.toBeNull();
    stage.show(carousel({ seats: seats(false), slots: [slot(1)] }));
    expect(stage.runTo(1)).toBe(false); // receipt remains remembered even if its slot is pruned
    expect(stage.walkTo({ x: 800, y: 450 }, area)).not.toBeNull();
    stage.dispose();
  });
});
