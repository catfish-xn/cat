import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PerspectiveCamera, Scene } from 'three';
import type { BoardControls, BoardFeedListener, BoardFrame, LegendControls } from '../src/rendering/board-feed';
import type { ScoutStage } from '../src/rendering/three-mode/scout-stage';
import type { Tabletop } from '../src/rendering/three-mode/tabletop';
import type { Renderer3d } from '../src/rendering/three-mode/contract';
import type { CarouselStage } from '../src/rendering/three-mode/carousel-stage';
import { Vector3 } from 'three';

/** Run the real mount, feed, picking and walk paths; substitute only GPU/DOM and forbid asset requests. */
describe('3D scouting input boundary', () => {
  let mounted: Renderer3d | undefined, listener: BoardFeedListener;
  let tick: FrameRequestCallback, now: number;
  let handlers: Map<string, (event: PointerEvent) => void>;
  let controls: BoardControls, walk: ReturnType<typeof vi.fn<LegendControls['walk']>>, fetchAsset: ReturnType<typeof vi.fn>;
  type Debug = { scene: Scene; camera: PerspectiveCamera; scout: ScoutStage; tabletop: Tabletop; stage: CarouselStage };
  const debug = () => (window as unknown as { __render3d: Debug }).__render3d;
  const frame: BoardFrame = { rows: 8, columns: 7, hexRadius: 34, origin: { x: 100, y: 100 },
    fighting: false, dragging: null, pieces: [], bench: [], orbs: [{ orbId: 'mine', tier: 'gold', queued: false }] };
  const advance = (seconds: number) => {
    for (let i = 0; i < seconds * 20; i++) { now += 50; tick(now); }
  };
  const click = (button: number, x: number, y: number) => {
    const preventDefault = vi.fn();
    handlers.get('pointerdown')!({ button, clientX: x, clientY: y, pointerId: 1, preventDefault } as unknown as PointerEvent);
    return preventDefault;
  };
  const screenPoint = (point: import('three').Vector3) => {
    debug().camera.updateMatrixWorld();
    const ndc = point.clone().project(debug().camera);
    return { x: (ndc.x + 1) * 400, y: (1 - ndc.y) * 300 };
  };
  beforeEach(async () => {
    vi.resetModules(); handlers = new Map(); now = performance.now();
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    vi.stubGlobal('location', { search: '?debug3d' });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { tick = callback; return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    fetchAsset = vi.fn(() => { throw new Error('unexpected asset request'); }); vi.stubGlobal('fetch', fetchAsset);
    controls = { hover: vi.fn(), look: vi.fn(), describe: vi.fn(), select: vi.fn(), dragStart: vi.fn(), dragMove: vi.fn(), dragEnd: vi.fn(), dragCancel: vi.fn(), claimOrb: vi.fn() };
    walk = vi.fn(() => true);
    vi.doMock('three', async importOriginal => ({
      ...await importOriginal<typeof import('three')>(),
      WebGLRenderer: class {
        domElement = { className: '', style: { cursor: '' },
          setPointerCapture() {},
          releasePointerCapture: (pointerId: number) => handlers.get('lostpointercapture')?.({ pointerId } as PointerEvent),
          addEventListener: (type: string, handler: (event: PointerEvent) => void) => handlers.set(type, handler),
          removeEventListener: (type: string) => handlers.delete(type), remove() {},
          getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
        setPixelRatio() {} setSize() {} render() {} dispose() {} forceContextLoss() {}
      },
    }));
    const renderer = await import('../src/rendering/three-mode/placeholder-renderer');
    renderer.useBoardFeed({ subscribe(next) { listener = next; return () => {}; }, controls: () => controls,
      legendControls: () => ({ walk }), legends: () => ({ me: 'pengu', opponent: null }) });
    mounted = await renderer.mountRenderer3d({ clientWidth: 800, clientHeight: 600, append() {} } as unknown as HTMLElement, { assetBase: null });
    listener.frame(frame);
  });
  afterEach(() => {
    mounted?.dispose(); mounted = undefined;
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.doUnmock('three'); vi.resetModules();
  });

  const pointer = (type: string, point: { x: number; y: number }, pointerType = 'mouse') => {
    handlers.get(type)!({ button: 0, buttons: type === 'pointermove' ? 0 : 1, clientX: point.x, clientY: point.y,
      pointerId: 1, pointerType, preventDefault: vi.fn() } as unknown as PointerEvent);
  };
  const noCommands = () => {
    for (const command of [controls.select, controls.dragStart, controls.dragMove, controls.dragEnd, controls.claimOrb, walk]) expect(command).not.toHaveBeenCalled();
  };

  it('reports scout identities and projected boxes, including bench units, with no command', () => {
    listener.frame({ ...frame, bench: [{ x: 100, y: 550 }] });
    listener.scout!({ seatId: 'other', name: 'Other', board: {
      units: [{ definitionId: 'lux', starLevel: 2, items: ['bf-sword'], cell: { col: 2, row: 4 } }],
      bench: [{ definitionId: 'vi', starLevel: 1, items: [], slot: 0 }],
    } });
    vi.clearAllMocks();
    for (const id of ['scout:other:2,4:lux:2', 'scout:other:bench-0:vi:1']) {
      const root = debug().scout.inspectRoot(id)!;
      const point = screenPoint(root.position.clone().setY(20));
      pointer('pointermove', point);
      expect(controls.describe).toHaveBeenLastCalledWith({ kind: 'unit', id }, listener.screenBox!(id));
      expect(listener.unitAt!(point)).toBe(id);
      const box = listener.screenBox!(id)!;
      expect(box.left).toBeLessThan(point.x); expect(box.right).toBeGreaterThan(point.x);
      expect(box.top).toBeLessThan(point.y); expect(box.bottom).toBeGreaterThan(point.y);
    }
    noCommands();
    pointer('pointerleave', { x: 0, y: 0 });
    expect(controls.describe).toHaveBeenLastCalledWith(null, undefined);
  });

  it('describes a watched combat unit without making it interactive', () => {
    listener.scout!({ seatId: 'other', name: 'Other', watching: true });
    listener.frame({ ...frame, fighting: true, pieces: [{ id: 'watched', definitionId: 'lux', starLevel: 2,
      team: 'player', x: 200, y: 300, visible: true, alive: true }] });
    const point = screenPoint(new Vector3(200, 20, 300));
    vi.clearAllMocks(); pointer('pointermove', point); pointer('pointerdown', point); pointer('pointerup', point);
    expect(controls.describe).toHaveBeenLastCalledWith({ kind: 'unit', id: 'watched' }, listener.screenBox!('watched'));
    noCommands();
  });

  it('describes my orb, but reports only public count and tiers when scouting', () => {
    const orb = debug().scene.getObjectByName('render3d-orb-gold')!;
    vi.clearAllMocks(); pointer('pointermove', screenPoint(orb.position.clone().setY(16)));
    expect(controls.describe).toHaveBeenLastCalledWith({ kind: 'orb', id: 'mine' }, expect.objectContaining({ left: expect.any(Number), top: expect.any(Number) }));
    noCommands();
    listener.scout!({ seatId: 'other', name: 'Other', board: { units: [] }, orbs: { count: 2, tiers: ['gold', 'blue'] } });
    const publicOrb = debug().scout.group.getObjectByName('render3d-scout-orb-gold')!;
    pointer('pointermove', screenPoint(publicOrb.position));
    expect(controls.describe).toHaveBeenLastCalledWith({ kind: 'public-orbs', count: 2, tiers: ['gold', 'blue'] }, expect.any(Object));
    noCommands();
  });

  it('carousel touch holds for 450 ms describe without walking, and a short tap keeps the original walk', () => {
    listener.carousel!({ id: 'carousel', slots: [{ slot: 0, definitionId: 'lux', starLevel: 1, items: [], pickedBy: null, takable: true, pending: false }],
      seats: [{ seatId: 'me', me: true, releaseAtMs: 0 }], elapsedMs: 0, at: now });
    const stage = debug().stage, root = stage.scene.getObjectByName('render3d-carousel-units')!.children[0]!;
    const world = root.getWorldPosition(new Vector3()).add(new Vector3(0, 15, 0)).project(stage.camera);
    const point = { x: (world.x + 1) * 400, y: (1 - world.y) * 300 };
    expect(stage.slotAt(point, { left: 0, top: 0, width: 800, height: 600 })?.slot).toBe(0);
    vi.clearAllMocks(); pointer('pointerdown', point, 'touch');
    advance(.4); expect(controls.describe).not.toHaveBeenCalled(); noCommands();
    advance(.05);
    expect(controls.describe).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'carousel' }), expect.any(Object));
    pointer('pointerup', point, 'touch'); noCommands();
    pointer('pointerdown', point, 'touch'); pointer('pointerup', point, 'touch');
    expect(walk).toHaveBeenCalledExactlyOnceWith({ scene: 'carousel', slot: 0 });
    expect(controls.claimOrb).not.toHaveBeenCalled();
  });

  it('picks my overhead item sprite for hover and touch tap without selecting or moving its unit', () => {
    listener.frame({ ...frame, pieces: [{ id: 'mine-unit', definitionId: 'lux', starLevel: 1, team: 'player',
      x: 200, y: 300, visible: true, alive: true, items: [{ id: 'sword', icon: null }] }] });
    advance(.05);
    const sprite = debug().scene.getObjectByName('render3d-overhead-item-sword')!;
    const point = screenPoint(sprite.getWorldPosition(new Vector3()));
    vi.clearAllMocks(); pointer('pointermove', point);
    expect(controls.describe).toHaveBeenLastCalledWith({ kind: 'item', id: 'sword' }, expect.any(Object));
    const box = vi.mocked(controls.describe!).mock.lastCall![1]!;
    expect(box.left).toBeLessThan(point.x); expect(box.right).toBeGreaterThan(point.x);
    expect(box.top).toBeLessThan(point.y); expect(box.bottom).toBeGreaterThan(point.y);
    pointer('pointerdown', point, 'touch'); pointer('pointerup', point, 'touch');
    pointer('pointerleave', point, 'touch');
    expect(controls.describe).toHaveBeenLastCalledWith({ kind: 'item', id: 'sword' }, expect.any(Object));
    noCommands();
  });

  it('orb long press is look-only; movement and cancellation cannot turn it into a walk', () => {
    const orb = debug().scene.getObjectByName('render3d-orb-gold')!;
    const point = screenPoint(orb.position.clone().setY(16));
    vi.clearAllMocks(); pointer('pointerdown', point, 'touch'); advance(.45);
    expect(controls.describe).toHaveBeenLastCalledWith({ kind: 'orb', id: 'mine' }, expect.any(Object));
    pointer('pointerup', point, 'touch'); noCommands();
    pointer('pointerdown', point, 'touch');
    pointer('pointermove', { x: point.x + 30, y: point.y }, 'touch'); advance(.5);
    pointer('pointerup', point, 'touch'); noCommands();
    expect(controls.describe).toHaveBeenLastCalledWith(null, undefined);
    pointer('pointerdown', point, 'touch'); pointer('pointercancel', point, 'touch'); advance(.5);
    pointer('pointerup', point, 'touch'); noCommands();
  });

  it('hides home, cancels an in-flight orb walk, and restores home and orb walks on return', () => {
    const { scene, tabletop, scout } = debug();
    const home = scene.getObjectByName('render3d-legend-me')!;
    const start = home.position.clone();
    const orb = scene.getObjectByName('render3d-orb-gold')!;
    const at = screenPoint(orb.position.clone().setY(16));
    expect(tabletop.orbAt(at, { left: 0, top: 0, width: 800, height: 600 })).toBe('mine');
    // Positive control: this exact pointer starts a home walk through the network callback.
    expect(click(2, at.x, at.y)).toHaveBeenCalledOnce();
    expect(walk).toHaveBeenCalledOnce();
    expect(tabletop.debug().legends).toContain('legend:me:standin:walk');
    listener.scout!({ seatId: 'other', name: 'Other', board: { units: [] } });
    expect(home.visible).toBe(false);
    expect(scout.debug().visitor).toBe('standin');
    expect(tabletop.debug().legends).not.toContain('legend:me:standin:walk');
    listener.frame(frame); // ordinary frame refresh must not revive the home legend
    expect(home.visible).toBe(false);
    expect(tabletop.walkTo({ x: orb.position.x, y: orb.position.z }, 'mine')).toBeNull();
    vi.clearAllMocks();
    click(0, at.x, at.y); click(2, at.x, at.y);
    advance(5);
    expect(controls.claimOrb).not.toHaveBeenCalled();
    expect(walk).not.toHaveBeenCalled();
    listener.scout!(null);
    expect(home.visible).toBe(true);
    expect(home.position).toEqual(start);
    expect(scout.debug().visitor).toBe('none');
    expect(scout.group.visible).toBe(false);
    expect(scout.group.children).toHaveLength(0);
    expect(scout.walkVisitor({ x: 100, y: 100 })).toBe(false);
    // Back home, a click on my orb sends my legend onto it (it claims on arrival), never a claim from afar.
    click(0, at.x, at.y);
    expect(walk).toHaveBeenCalledOnce();
    expect(controls.claimOrb).not.toHaveBeenCalled();
    expect(tabletop.debug().legends).toContain('legend:me:standin:walk');
    expect(fetchAsset).not.toHaveBeenCalled();
  });

  it('right-click moves the visitor in display space without any board or network command', () => {
    const { scout, scene } = debug();
    const home = scene.getObjectByName('render3d-legend-me')!;
    const homeStart = home.position.clone();
    listener.scout!({ seatId: 'other', name: 'Other', board: { units: [] } });
    expect(scout.active).toBe(true);
    const before = scout.group.children.map(object => ({ object, position: object.position.clone() }));
    const target = home.position.clone().set(200, 0, 200), at = screenPoint(target);
    vi.clearAllMocks();
    expect(click(2, at.x, at.y)).toHaveBeenCalledOnce();
    advance(5);
    const moved = before.filter(({ object, position }) => !object.position.equals(position));
    expect(moved).toHaveLength(1);
    // The board owner's legend stays at the home corner; the moving figure is the visitor.
    expect(moved[0]!.position).not.toEqual(homeStart);
    expect(before.find(({ position }) => position.equals(homeStart))?.object.position).toEqual(homeStart);
    expect(moved[0]!.object.position.x).toBeCloseTo(target.x);
    expect(moved[0]!.object.position.z).toBeCloseTo(target.z);
    expect(home.position).toEqual(homeStart);
    for (const callback of Object.values(controls)) expect(callback).not.toHaveBeenCalled();
    expect(walk).not.toHaveBeenCalled();
    listener.scout!(null);
    expect(scout.debug().visitor).toBe('none');
    expect(scout.group.children).toHaveLength(0);
    advance(1);
    expect(home.visible).toBe(true);
    expect(controls.claimOrb).not.toHaveBeenCalled();
  });
});
