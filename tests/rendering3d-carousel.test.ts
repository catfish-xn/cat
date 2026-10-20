import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Texture, Vector3 } from 'three';
import { CAROUSEL_CELL, createCarouselStage, type CarouselStageContext } from '../src/rendering/three-mode/carousel-stage';
import { boardFeedGeneration, provideCarouselControls, publishCarousel, subscribeBoardFeed, boardFeed, type BoardCarousel, type BoardCarouselSlot } from '../src/rendering/board-feed';
import type { ModelLease, ParticleEffect } from '../src/rendering3d';

/** Synthetic data only: no asset files. Models are plain boxes and effects stand-in objects; the stage logic is production code. */
const slot = (index: number, changes: Partial<BoardCarouselSlot> = {}): BoardCarouselSlot => ({
  slot: index, definitionId: `unit-${index}`, starLevel: 1, items: [{ id: `item-${index}`, icon: null }], picked: false, takable: false, pending: false, ...changes,
});
const seats = (locked: boolean, picked: readonly string[] = []) => Array.from({ length: 8 }, (_, index) => ({
  seatId: `s${index}`, me: index === 2, locked, picked: picked.includes(`s${index}`),
}));
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
  it('draws stand-ins without an asset root: platform, eight seat legends, the units with their items and no timer ring', () => {
    const { stage } = setup();
    stage.show(carousel());
    const debug = stage.debug();
    expect(debug.platform).toEqual(['standin']);
    expect(debug.legends).toHaveLength(8);
    expect(debug.legends.every(entry => entry.endsWith(':standin:locked'))).toBe(true);
    expect(debug.units.map(unit => unit.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(debug.units.every(unit => unit.body === 'standin' && unit.items === 1 && unit.ring === 'none')).toBe(true);
    expect(debug.effects.some(entry => entry.includes('timer'))).toBe(false);
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

  it('rings the units the panel would take, and removes one only once the view says it was taken', async () => {
    const { stage } = setup();
    stage.show(carousel());
    stage.show(carousel({ slots: Array.from({ length: 9 }, (_, index) => slot(index, { takable: true })) }));
    expect(stage.debug().units.every(unit => unit.ring === 'takable')).toBe(true);
    stage.hover(4);
    expect(stage.debug().units.find(unit => unit.slot === 4)!.ring).toBe('hover');
    // Pending: still standing until the server answers.
    stage.show(carousel({ slots: Array.from({ length: 9 }, (_, index) => slot(index, { pending: index === 4 })) }));
    expect(stage.debug().units.find(unit => unit.slot === 4)!.ring).toBe('pending');
    stage.show(carousel({ slots: Array.from({ length: 9 }, (_, index) => slot(index, { picked: index === 4 })) }));
    await flush();
    expect(stage.debug().units.map(unit => unit.slot)).not.toContain(4);
    expect(stage.debug().effects).toContain('burst:standin');
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
    stage.show(carousel({ seats: seats(true).map(seat => seat.me ? { ...seat, locked: false } : seat) }));
    await flush();
    expect(effects.find(entry => entry.id === 'carousel-shareddraftplayerrestraint')!.fx.disposed).toBe(true);
    expect(effects.find(entry => entry.id === 'carousel-shareddraft-firstdraftwall-galaxy')!.fx.disposed).toBe(true);
    expect(effects.filter(entry => entry.id === 'carousel-shareddraft-firstdraftwall-death-galaxy')).toHaveLength(1);
    expect(stage.debug().legends.filter(entry => entry.endsWith(':locked'))).toHaveLength(7);
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
