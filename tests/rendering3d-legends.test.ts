import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from 'three';
import { createTabletop, LEGEND_MODEL } from '../src/rendering/three-mode/tabletop';
import { createCarouselStage } from '../src/rendering/three-mode/carousel-stage';
import { boardFeed, setBoardLegends, type BoardCarousel, type BoardFrame } from '../src/rendering/board-feed';
import type { ModelLease } from '../src/rendering3d';

/** Synthetic data only: models are plain boxes keyed by made-up ids; the choice logic is production code. */
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
function recorder() {
  const loaded: string[] = [], leases: (ModelLease & { released: boolean })[] = [];
  const loadModel = (id: string) => {
    loaded.push(id);
    const scene = new Group(); scene.add(new Mesh(new BoxGeometry(10, 20, 10), new MeshBasicMaterial()));
    const lease = { scene, animations: [], animationNames: {}, placeholder: false, released: false, release() { lease.released = true; scene.removeFromParent(); } };
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

  it('defaults to the 河灵 model without a legend choice', async () => {
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
    const stage = createCarouselStage({ championHeight: 92, championWidth: 110, sourceScale: 0.44, legendModel: 'little-legend-default',
      loadModel, hasModel: id => present.has(id), loadEffect: null, starColor: () => '#ffd34d', now: () => 0 });
    const view: BoardCarousel = { id: 'c1', slots: [], elapsedMs: 0, at: 0,
      seats: [{ seatId: 's0', me: true, releaseAtMs: 0, legend: 'a' }, { seatId: 's1', me: false, releaseAtMs: 0, legend: 'missing' }, { seatId: 's2', me: false, releaseAtMs: 0 }] };
    stage.show(view);
    await flush();
    expect(loaded.filter(id => id.startsWith('little-legend-'))).toEqual(['little-legend-a', 'little-legend-default', 'little-legend-default']);
    stage.dispose();
  });

  it('board-feed hands the layer the online legends, and this browser\'s pick (default here) without a view', () => {
    setBoardLegends({ me: 'a', opponent: 'b' });
    expect(boardFeed.legends?.()).toEqual({ me: 'a', opponent: 'b' });
    setBoardLegends(null);
    expect(boardFeed.legends?.()).toEqual({ me: 'default', opponent: null });
  });
});
