import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PerspectiveCamera, Scene } from 'three';
import type { BoardControls, BoardFeedListener, BoardFrame, LegendControls } from '../src/rendering/board-feed';
import type { ScoutStage } from '../src/rendering/three-mode/scout-stage';
import type { Tabletop } from '../src/rendering/three-mode/tabletop';
import type { Renderer3d } from '../src/rendering/three-mode/contract';

/** Run the real mount, feed, picking and walk paths; substitute only GPU/DOM and forbid asset requests. */
describe('3D scouting input boundary', () => {
  let mounted: Renderer3d | undefined, listener: BoardFeedListener;
  let tick: FrameRequestCallback, now: number;
  let handlers: Map<string, (event: PointerEvent) => void>;
  let controls: BoardControls, walk: ReturnType<typeof vi.fn<LegendControls['walk']>>, fetchAsset: ReturnType<typeof vi.fn>;
  type Debug = { scene: Scene; camera: PerspectiveCamera; scout: ScoutStage; tabletop: Tabletop };
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
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    vi.stubGlobal('location', { search: '?debug3d' });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { tick = callback; return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    fetchAsset = vi.fn(() => { throw new Error('unexpected asset request'); }); vi.stubGlobal('fetch', fetchAsset);
    controls = { hover: vi.fn(), select: vi.fn(), dragStart: vi.fn(), dragMove: vi.fn(), dragEnd: vi.fn(), dragCancel: vi.fn(), claimOrb: vi.fn() };
    walk = vi.fn(() => true);
    vi.doMock('three', async importOriginal => ({
      ...await importOriginal<typeof import('three')>(),
      WebGLRenderer: class {
        domElement = { className: '', style: { cursor: '' },
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

  it('hides home, cancels an in-flight orb walk, and restores home and orb clicks on return', () => {
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
    click(0, at.x, at.y);
    expect(controls.claimOrb).toHaveBeenCalledExactlyOnceWith('mine');
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
