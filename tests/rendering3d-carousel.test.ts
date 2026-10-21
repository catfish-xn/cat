import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Texture, Vector3 } from 'three';
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

  it("sends another seat's legend dashing for the unit it took, then home with it on the tether", async () => {
    const { stage } = setup();
    stage.show(carousel({ seats: seats(false) }));
    stage.show(carousel({ seats: seats(false), slots: Array.from({ length: 9 }, (_, index) => slot(index, { pickedBy: index === 4 ? 's5' : null })) }));
    const legend = stage.scene.getObjectByName('render3d-carousel-seats')!.children[5]!;
    const home = legend.position.clone();
    expect(stage.debug().legends[5]).toMatch(/:chase$/);
    // The dash takes about 0.8 s from the cradle to the ring, then the grab burst.
    for (let frame = 0; frame < 30; frame++) stage.update(1 / 60);
    expect(stage.debug().fetched).toEqual({});
    for (let frame = 0; frame < 30; frame++) stage.update(1 / 60);
    expect(stage.debug().fetched).toEqual({ s5: 4 });
    expect(stage.debug().legends[5]).toMatch(/:carry$/);
    expect(stage.debug().effects).toContain('burst:standin');
    for (let frame = 0; frame < 240; frame++) stage.update(1 / 60);
    expect(legend.position.distanceTo(home)).toBeLessThan(1);
    const unit = stage.scene.getObjectByName('render3d-carousel-taken')!.children.find(child => child.name === 'render3d-carousel-unit')!;
    expect(unit.position.distanceTo(home) / CAROUSEL_CELL).toBeCloseTo(1.1, 0);
    expect(stage.scene.getObjectByName('render3d-carousel-taken')!.children.filter(child => child.name === 'render3d-carousel-tether' && child.visible)).toHaveLength(1);
    // Off the ring: never picked again.
    expect(stage.debug().units.filter(entry => entry.ring !== 'none').map(entry => entry.slot)).not.toContain(4);
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
    expect(stage.debug().legends[6]).toMatch(/:chase$/);
    // Mine is taken: it carries it home and walks no more.
    stage.show(carousel({ seats: seats(false), slots: Array.from({ length: 9 }, (_, index) => slot(index, { pickedBy: index === 3 ? 's6' : index === 5 ? 's2' : null })) }));
    expect(stage.debug().legends[2]).toMatch(/:chase$/);
    for (let frame = 0; frame < 180; frame++) stage.update(1 / 60);
    expect(stage.debug().fetched).toMatchObject({ s2: 5, s6: 3 });
    expect(stage.walkTo(middle, area)).toBeNull();
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

  it('moves any seat along the room walk and lands it on time; a fetch in progress is left alone', () => {
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
    // s5 took slot 0: it fetches it, and a stray walk for it changes nothing until it is home.
    stage.show(carousel({ seats: seats(false), slots: Array.from({ length: 9 }, (_, index) => slot(index, { pickedBy: index === 0 ? 's5' : null })) }));
    expect(stage.debug().legends[5]).toMatch(/:chase$/);
    stage.walk({ ...walk, startedAt: 1100, arriveAt: 2000 });
    expect(stage.debug().legends[5]).toMatch(/:chase$/);
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
