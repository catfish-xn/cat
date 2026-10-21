import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Object3D, PerspectiveCamera, Scene } from 'three';
import type { BoardControls, BoardFeedListener, BoardFrame } from '../src/rendering/board-feed';
import type { Renderer3d } from '../src/rendering/three-mode/contract';
import type { BoardAlignment, ModelLease } from '../src/rendering3d';

// Synthetic source-space cells: a raised strip, deliberately far from the 2D bench.
const cells = Array.from({ length: 9 }, (_, i) => [50 + i * 60, 60, 520] as const);
const alignment: BoardAlignment = {
  scale: [1, 1, 1], offset: [0, 0, 0], target: { radius: 34, origin: { x: 0, y: 0 } }, bench: cells,
};
const bench = Array.from({ length: 9 }, (_, i) => ({ x: 40 + i * 60, y: 650 }));
const frame: BoardFrame = {
  columns: 7, rows: 8, hexRadius: 34, origin: { x: 0, y: 0 }, bench, fighting: false, dragging: null,
  pieces: bench.map((point, i) => ({ ...point, id: `unit-${i}`, definitionId: 'unit', team: 'player',
    starLevel: 1, alive: true, visible: true })),
};

class Canvas {
  className = '';
  style = { cursor: '' };
  private listeners = new Map<string, EventListener>();
  private captured = new Set<number>();
  addEventListener(type: string, listener: EventListener) { this.listeners.set(type, listener); }
  removeEventListener(type: string) { this.listeners.delete(type); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
  setPointerCapture(id: number) { this.captured.add(id); }
  hasPointerCapture(id: number) { return this.captured.has(id); }
  releasePointerCapture(id: number) { this.captured.delete(id); }
  remove() {}
  pointer(type: string, point: { x: number; y: number }) {
    this.listeners.get(type)?.({ clientX: point.x, clientY: point.y, button: 0, buttons: 1,
      pointerId: 1, pointerType: 'mouse', preventDefault() {} } as PointerEvent);
  }
}

describe('#351 arena bench placement and drag mapping', () => {
  let three: typeof import('three'), core: typeof import('../src/rendering3d');
  let arenaModule: typeof import('../src/rendering/three-mode/board-arena');
  let mounted: Renderer3d | undefined, listener: BoardFeedListener, canvas: Canvas;
  let scene: Scene, camera: PerspectiveCamera, controls: BoardControls;
  let draw: FrameRequestCallback, now: number;
  let units: Object3D[];

  beforeEach(async () => {
    vi.resetModules(); canvas = new Canvas(); now = 0; units = [];
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { draw = callback; return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.doMock('three', async importOriginal => ({
      ...await importOriginal<typeof import('three')>(),
      WebGLRenderer: class {
        domElement = canvas;
        setPixelRatio() {} setSize() {} dispose() {} forceContextLoss() {}
        render(nextScene: Scene, nextCamera: PerspectiveCamera) {
          scene = nextScene; camera = nextCamera;
          scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
        }
      },
    }));
    three = await import('three'); core = await import('../src/rendering3d');
    arenaModule = await import('../src/rendering/three-mode/board-arena');
    controls = { hover: vi.fn(), select: vi.fn(), dragStart: vi.fn(() => true),
      dragMove: vi.fn(() => ({ allowed: true })), dragEnd: vi.fn(), dragCancel: vi.fn() };
  });
  afterEach(() => {
    mounted?.dispose(); mounted = undefined;
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.doUnmock('three'); vi.resetModules();
  });

  function lease(): ModelLease {
    return { scene: new three.Group(), animations: [], animationNames: {}, placeholder: false, release() {} };
  }
  function render() { draw(now += 100); }
  async function publish(next = frame) {
    listener.frame(next);
    await Promise.resolve(); // immediate model leases and the arena's onReady rebuild
    render();
  }
  async function mount(benchData: unknown = cells, pending = false) {
    const rawAlignment = { ...alignment, bench: benchData };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('manifest.json')
      ? Response.json({ schemaVersion: 1, models: { 'board-default': { path: 'board.glb' }, unit: { path: 'unit.glb' } },
        boards: { 'board-default': { alignment: rawAlignment, grid: { columns: 7, rows: 8 } } } })
      : new Response(null, { status: 404 })));
    let resolve!: (value: ModelLease) => void;
    const board = lease(), waiting = new Promise<ModelLease>(done => { resolve = done; });
    const load = vi.spyOn(core.ModelCache.prototype, 'load').mockImplementation(async id => {
      if (id === 'board-default') return pending ? waiting : board;
      const unit = lease(); units.push(unit.scene); return unit;
    });
    const renderer = await import('../src/rendering/three-mode/placeholder-renderer');
    renderer.useBoardFeed({ subscribe(next) { listener = next; return () => {}; }, controls: () => controls });
    mounted = await renderer.mountRenderer3d({ clientWidth: 800, clientHeight: 600, append() {} } as unknown as HTMLElement,
      { assetBase: '/synthetic/' });
    expect(mounted.status).toBe('assets');
    return { load, resolve: () => resolve(board) };
  }
  function expect2d() {
    expect(units).toHaveLength(9);
    units.forEach((unit, i) => expect(unit.parent!.position.toArray()).toEqual([bench[i].x, 0, bench[i].y]));
  }
  function screen(x: number, y: number, z: number) {
    const point = new three.Vector3(x, y, z).project(camera);
    return { x: (point.x + 1) * 400, y: (1 - point.y) * 300 };
  }

  it.each([
    ['nine nulls', Array(9).fill(null)],
    ['nine strings', Array(9).fill('invalid')],
    ['eight cells', cells.slice(0, 8)],
  ])('rejects %s and leaves every piece on its 2D bench coordinate', async (_label, data) => {
    // Runtime JSON can violate the static BoardAlignment type.
    expect(arenaModule.arenaBench({ ...alignment, bench: data } as unknown as BoardAlignment, frame)).toBeNull();
    await mount(data); await publish(); await publish();
    expect(scene.getObjectByName('render3d-board-arena')?.visible).toBe(true);
    expect2d();
  });

  it('keeps benchSlots empty when a 7x8 arena is shown on a 6x8 grid', async () => {
    const slots = vi.spyOn(arenaModule, 'arenaBench');
    const { load } = await mount();
    await publish({ ...frame, columns: 6 });
    expect(load.mock.calls.some(([id]) => id === 'board-default')).toBe(false);
    expect(slots).not.toHaveBeenCalled(); expect2d();
    // Prove this fixture has usable slots when the dimensions match.
    await publish(); await publish();
    expect(slots).toHaveBeenCalled();
    units.forEach((unit, i) => expect(unit.parent!.position.y).toBe(cells[i][1]));
    slots.mockClear();
    await publish({ ...frame, columns: 6 });
    expect(slots).not.toHaveBeenCalled();
    units.forEach(unit => expect(unit.parent!.position.y).toBe(0));
  });

  it('keeps benchSlots empty until the arena is ready', async () => {
    const slots = vi.spyOn(arenaModule, 'arenaBench');
    const { resolve } = await mount(cells, true);
    await publish();
    expect(slots).not.toHaveBeenCalled(); expect2d();
    resolve();
    await vi.waitFor(() => expect(scene.getObjectByName('render3d-board-arena')).toBeDefined());
    await publish();
    expect(slots).toHaveBeenCalled();
    units.forEach(unit => expect(unit.parent!.position.y).toBe(60));
  });

  it('maps dragMove and dragEnd over each raised y=60 cell center to its corresponding 2D slot', async () => {
    await mount(); await publish(); await publish();
    for (let i = 0; i < 30; i++) render(); // settle the real FOLLOW_SECONDS movement interpolation
    units.forEach((unit, i) => unit.parent!.position.toArray().forEach((value, axis) => expect(value).toBeCloseTo(cells[i][axis])));
    for (let i = 0; i < cells.length; i++) {
      const start = screen(cells[0][0], 30 + cells[0][1], cells[0][2]);
      expect(listener.unitAt!(start)).toBe('unit-0');
      const target = screen(...cells[i]);
      canvas.pointer('pointerdown', start);
      canvas.pointer('pointermove', target);
      expect(controls.dragStart).toHaveBeenLastCalledWith('unit-0');
      expect(controls.dragMove).toHaveBeenLastCalledWith(bench[i]);
      canvas.pointer('pointerup', target);
      expect(controls.dragEnd).toHaveBeenLastCalledWith(bench[i], target);
    }
    expect(controls.dragMove).toHaveBeenCalledTimes(9);
    expect(controls.dragEnd).toHaveBeenCalledTimes(9);
  });
});
