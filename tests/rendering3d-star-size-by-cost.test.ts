// Built on the harness of rendering3d-jayce-forge.test.ts (only the GPU/DOM and asset I/O substituted).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PerspectiveCamera, Scene } from 'three';
import type { BoardControls, BoardFeedListener, BoardFrame, BoardPiece } from '../src/rendering/board-feed';
import type { Renderer3d } from '../src/rendering/three-mode/contract';
import type { ModelLease } from '../src/rendering3d';

/** Only the GPU/DOM and asset I/O are substituted. Mounting, actions, mixers and ray picking are production code. */
class Canvas {
  className = '';
  style = { cursor: '' };
  private listeners = new Map<string, EventListener>();
  private captured = new Set<number>();
  addEventListener(type: string, listener: EventListener): void { this.listeners.set(type, listener); }
  removeEventListener(type: string, listener: EventListener): void {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
  setPointerCapture(id: number): void { this.captured.add(id); }
  hasPointerCapture(id: number): boolean { return this.captured.has(id); }
  releasePointerCapture(id: number): void { this.captured.delete(id); }
  remove(): void {}
  pointer(type: string, point: { x: number; y: number }, button = 0): void {
    this.listeners.get(type)?.({ clientX: point.x, clientY: point.y, button, pointerId: 1,
      preventDefault() {} } as PointerEvent);
  }
  has(type: string): boolean { return this.listeners.has(type); }
  fire(type: string, event: Event): void { this.listeners.get(type)?.(event); }
}

const piece = (changes: Partial<BoardPiece> = {}): BoardPiece => ({
  id: 'unit', definitionId: 'model', team: 'player', starLevel: 1, x: 150, y: 130,
  alive: true, visible: true, ...changes,
});
const frame = (pieces: readonly BoardPiece[], fighting = true): BoardFrame => ({
  rows: 4, columns: 4, hexRadius: 34, origin: { x: 50, y: 50 }, bench: [], pieces, fighting, dragging: null,
});

describe('star sizes by cost in the real mountRenderer3d', () => {
  let three: typeof import('three'), core: typeof import('../src/rendering3d');
  let mounted: Renderer3d | undefined, listener: BoardFeedListener, canvas: Canvas;
  let scene: Scene, camera: PerspectiveCamera, controls: BoardControls;
  let now: number, nextId: number, callbacks: Map<number, FrameRequestCallback>;
  const leases: ModelLease[] = [];

  beforeEach(async () => {
    vi.resetModules();
    now = 0; nextId = 0; callbacks = new Map(); canvas = new Canvas();
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.set(++nextId, callback); return nextId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ schemaVersion: 1, models: {} })));
    vi.doMock('three', async importOriginal => ({
      ...await importOriginal<typeof import('three')>(),
      WebGLRenderer: class {
        domElement = canvas;
        setPixelRatio(): void {}
        setSize(): void {}
        render(nextScene: Scene, nextCamera: PerspectiveCamera): void {
          scene = nextScene; camera = nextCamera;
          // A real WebGLRenderer updates these before drawing; ray picking uses their world transforms.
          scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
        }
        dispose(): void {}
        forceContextLoss(): void {}
      },
    }));
    three = await import('three'); core = await import('../src/rendering3d');
    controls = { hover: vi.fn(), select: vi.fn(), dragStart: vi.fn(() => false),
      dragMove: vi.fn(() => ({ allowed: false })), dragEnd: vi.fn(), dragCancel: vi.fn() };
  });
  afterEach(() => {
    mounted?.dispose(); mounted = undefined;
    for (const lease of leases.splice(0)) lease.release();
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.doUnmock('three'); vi.resetModules();
  });

  function advance(milliseconds: number): void {
    // Respect the renderer's 250 ms delta cap without real sleeps or per-test timeouts.
    while (milliseconds > 0) {
      const step = Math.min(milliseconds, 100); now += step; milliseconds -= step;
      const pending = [...callbacks.values()]; callbacks.clear();
      for (const callback of pending) callback(now);
    }
  }
  function model(id: string, names: ModelLease['animationNames'], clips: readonly [string, number][]): ModelLease {
    const body = new three.Group(); body.name = `model-${id}`;
    const geometry = new three.BoxGeometry(20, 46, 20), material = new three.MeshStandardMaterial();
    body.add(new three.Mesh(geometry, material));
    const lease: ModelLease = { scene: body, placeholder: false,
      animations: clips.map(([name, seconds]) => new three.AnimationClip(name, seconds, [])), animationNames: names,
      release: vi.fn(() => { body.removeFromParent(); geometry.dispose(); material.dispose(); }),
    };
    leases.push(lease); return lease;
  }
  async function mount(): Promise<void> {
    const renderer = await import('../src/rendering/three-mode/placeholder-renderer');
    renderer.useBoardFeed({ subscribe(next) { listener = next; return () => {}; }, controls: () => controls, legendControls: () => null });
    renderer.useUnitCost(id => id === 'five-a' ? 5 : id === 'four-b' ? 4 : 1);
    mounted = await renderer.mountRenderer3d({ clientWidth: 800, clientHeight: 600, append() {} } as unknown as HTMLElement, { assetBase: '/memory/' });
    advance(1);
  }
  async function publish(pieces: readonly BoardPiece[], fighting = false): Promise<void> {
    listener.frame(frame(pieces, fighting));
    await Promise.resolve(); await Promise.resolve();
    advance(1);
  }
  const heightOf = (lease: ModelLease) => { lease.scene.updateMatrixWorld(true); const box = new three.Box3().setFromObject(lease.scene); return box.max.y - box.min.y; };

  it.each([
    ['five-a', 2, 3, 1.42],
    ['four-b', 1, 3, 1.33],
    ['five-a', 1, 2, 1.18],
  ] as const)('a %s body grows from %i to %i stars by %f', async (definitionId, from, to, ratio) => {
    const lease = model(definitionId, { idle: 'idle' }, [['idle', 2]]);
    vi.spyOn(core.ModelCache.prototype, 'load').mockResolvedValue(lease);
    await mount();
    await publish([piece({ definitionId, starLevel: from })]);
    await vi.waitFor(() => { advance(1); expect(scene.getObjectByName(`model-${definitionId}`)).toBe(lease.scene); });
    const before = heightOf(lease);
    await publish([piece({ definitionId, starLevel: to })]);
    expect(heightOf(lease) / before).toBeCloseTo(ratio, 6);
  }, 30000);
});
