import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from 'three';
import { createTabletop, LEGEND_FALLBACK_MODEL, LEGEND_MODEL, resolveDefaultLegend } from '../src/rendering/three-mode/tabletop';
import { createCarouselStage } from '../src/rendering/three-mode/carousel-stage';
import { loadLegendLease } from '../src/rendering/three-mode/legend-load';
import { boardFeed, setBoardLegends, type BoardCarousel, type BoardFrame } from '../src/rendering/board-feed';
import type { ModelLease } from '../src/rendering3d';
import { readLegendChoice, writeLegendChoice } from '../src/rendering/legend-choice';

/** Synthetic data only: models are plain boxes keyed by made-up ids; the choice logic is production code. */
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
function recorder(broken: Readonly<Record<string, 'reject' | 'placeholder'>> = {}) {
  const loaded: string[] = [], leases: (ModelLease & { released: boolean })[] = [];
  const loadModel = (id: string) => {
    loaded.push(id);
    if (broken[id] === 'reject') return Promise.reject(new Error('broken'));
    const scene = new Group(); scene.add(new Mesh(new BoxGeometry(10, 20, 10), new MeshBasicMaterial()));
    const lease = { scene, animations: [], animationNames: {}, placeholder: broken[id] === 'placeholder', released: false, release() { lease.released = true; scene.removeFromParent(); } };
    leases.push(lease as unknown as ModelLease & { released: boolean });
    return Promise.resolve(lease as unknown as ModelLease);
  };
  return { loaded, leases, loadModel };
}
const frame = (changes: Partial<BoardFrame> = {}): BoardFrame => ({
  rows: 8, columns: 7, hexRadius: 34, origin: { x: 35, y: 50 }, bench: [], pieces: [], fighting: false, dragging: null, orbs: [], openedOrbs: [], hit: null, ...changes,
});
const enemy = { id: 'e', definitionId: 'unit-a', team: 'enemy' as const, starLevel: 1, x: 150, y: 80, alive: true, visible: true };

describe('little legends in the 3D layer', () => {
  it('shows pengu until a legend is picked, and keeps an explicit 河灵 pick', () => {
    const store = new Map<string, string>();
    const previous = (globalThis as { localStorage?: Storage }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
    try {
      expect(readLegendChoice()).toBe('pengu');
      writeLegendChoice('default'); expect(readLegendChoice()).toBe('default');
    } finally { (globalThis as { localStorage?: unknown }).localStorage = previous; }
  });

  it('stands each side\'s own legend on the tabletop and rebuilds one whose legend changed', async () => {
    const { loaded, leases, loadModel } = recorder();
    const sides: Record<'me' | 'opponent', string> = { me: 'little-legend-a', opponent: 'little-legend-b' };
    const tabletop = createTabletop({ scene: new Scene(), camera: new PerspectiveCamera(), championHeight: 92, effectScale: 0.44, loadModel, loadEffect: null,
      own: resource => resource, legendModel: side => sides[side] });
    tabletop.frame(frame({ fighting: true, pieces: [enemy] }));
    await flush();
    expect(loaded).toEqual(['little-legend-a', 'little-legend-b']);
    expect(tabletop.debug().legends).toEqual(['legend:me:model', 'legend:opponent:model']);
    sides.opponent = 'little-legend-c';
    tabletop.frame(frame({ fighting: true, pieces: [enemy] }));
    await flush();
    expect(loaded).toEqual(['little-legend-a', 'little-legend-b', 'little-legend-c']);
    expect(leases[1]!.released).toBe(true);
    expect(leases[0]!.released).toBe(false);
    tabletop.dispose();
  });

  it('defaults to the preferred little legend without a legend choice', async () => {
    const { loaded, loadModel } = recorder();
    const tabletop = createTabletop({ scene: new Scene(), camera: new PerspectiveCamera(), championHeight: 92, effectScale: 0.44, loadModel, loadEffect: null, own: resource => resource });
    tabletop.frame(frame());
    await flush();
    expect(loaded).toEqual([LEGEND_MODEL]);
    tabletop.dispose();
  });

  it('gives each carousel seat its own legend, and the default where the root lacks that model', async () => {
    const { loaded, loadModel } = recorder();
    const present = new Set(['little-legend-default', 'little-legend-a']);
    const stage = createCarouselStage({ championHeight: 92, championWidth: 110, sourceScale: 0.44, legendModel: resolveDefaultLegend(id => present.has(id)),
      loadModel, hasModel: id => present.has(id), loadEffect: null, starColor: () => '#ffd34d', now: () => 0 });
    const view: BoardCarousel = { id: 'c1', slots: [], elapsedMs: 0, at: 0,
      seats: [{ seatId: 's0', me: true, releaseAtMs: 0, legend: 'a' }, { seatId: 's1', me: false, releaseAtMs: 0, legend: 'missing' }, { seatId: 's2', me: false, releaseAtMs: 0 }] };
    stage.show(view);
    await flush();
    expect(loaded.filter(id => id.startsWith('little-legend-'))).toEqual(['little-legend-a', 'little-legend-default', 'little-legend-default']);
    stage.dispose();
  });

  it('board-feed hands the layer the online legends, and this browser\'s pick (unset: pengu) without a view', () => {
    setBoardLegends({ me: 'a', opponent: 'b' });
    expect(boardFeed.legends?.()).toEqual({ me: 'a', opponent: 'b' });
    setBoardLegends(null);
    expect(boardFeed.legends?.()).toEqual({ me: 'pengu', opponent: null });
  });

  it('falls back to the default legend when the picked one is refused or a placeholder, releasing the broken lease', async () => {
    for (const mode of ['reject', 'placeholder'] as const) {
      const { loaded, leases, loadModel } = recorder({ 'little-legend-x': mode });
      const lease = await loadLegendLease(loadModel, 'little-legend-x');
      expect(loaded).toEqual(['little-legend-x', LEGEND_MODEL]);
      expect(lease.placeholder).toBe(false);
      if (mode === 'placeholder') expect(leases[0]!.released).toBe(true);
    }
    // The default failing too: its own answer (a placeholder here), so callers keep their stand-in.
    const both = recorder({ 'little-legend-x': 'reject', [LEGEND_MODEL]: 'placeholder', [LEGEND_FALLBACK_MODEL]: 'placeholder' });
    expect((await loadLegendLease(both.loadModel, 'little-legend-x')).placeholder).toBe(true);
  });

  it('draws the default pengu on the tabletop and the carousel when a seat\'s legend fails to load', async () => {
    const { loaded, loadModel } = recorder({ 'little-legend-a': 'reject', 'little-legend-b': 'placeholder' });
    const tabletop = createTabletop({ scene: new Scene(), camera: new PerspectiveCamera(), championHeight: 92, effectScale: 0.44, loadModel, loadEffect: null,
      own: resource => resource, legendModel: side => side === 'me' ? 'little-legend-a' : 'little-legend-b' });
    tabletop.frame(frame({ fighting: true, pieces: [enemy] }));
    await flush(); await flush();
    expect(tabletop.debug().legends).toEqual(['legend:me:model', 'legend:opponent:model']);
    expect(loaded.filter(id => id === LEGEND_MODEL)).toHaveLength(2);
    expect(loaded.filter(id => id === LEGEND_FALLBACK_MODEL)).toHaveLength(0);
    tabletop.dispose();

    const carousel = recorder({ 'little-legend-a': 'placeholder' });
    const stage = createCarouselStage({ championHeight: 92, championWidth: 110, sourceScale: 0.44, legendModel: LEGEND_MODEL,
      loadModel: carousel.loadModel, hasModel: id => id === LEGEND_MODEL || id === LEGEND_FALLBACK_MODEL || id === 'little-legend-a', loadEffect: null, starColor: () => '#ffd34d', now: () => 0 });
    stage.show({ id: 'c1', slots: [], elapsedMs: 0, at: 0, seats: [{ seatId: 's0', me: true, releaseAtMs: 0, legend: 'a' }] });
    await flush(); await flush();
    expect(carousel.loaded.filter(id => id.startsWith('little-legend-'))).toEqual(['little-legend-a', LEGEND_MODEL]);
    expect(stage.debug().legends[0]).toMatch(/^s0:model/);
    stage.dispose();
  });

  it('keeps the stand-in when even the default fails', async () => {
    const { loadModel } = recorder({ 'little-legend-a': 'reject', [LEGEND_MODEL]: 'reject', [LEGEND_FALLBACK_MODEL]: 'reject' });
    const tabletop = createTabletop({ scene: new Scene(), camera: new PerspectiveCamera(), championHeight: 92, effectScale: 0.44, loadModel, loadEffect: null,
      own: resource => resource, legendModel: () => 'little-legend-a' });
    tabletop.frame(frame());
    await flush(); await flush();
    expect(tabletop.debug().legends).toEqual(['legend:me:standin']);
    tabletop.dispose();
  });
});
