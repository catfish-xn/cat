import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PerspectiveCamera, Scene } from 'three';
import type { BoardControls, BoardFeedListener, BoardFrame, BoardPiece } from '../src/rendering/board-feed';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import type { Renderer3d } from '../src/rendering/three-mode/contract';
import type { ModelLease } from '../src/rendering3d';

/** Only the GPU/DOM and asset I/O are substituted. Mounting, events, actions and mixers are production code. */
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

describe('timed form in the real mountRenderer3d', () => {
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
  /** Swain's model: his body and his wings (one submesh per material), the wings hidden until his form shows them. */
  function swainModel(): ModelLease {
    const body = new three.Group(); body.name = 'model-swain';
    const meshes = ['Body', 'wings'].map(name => {
      const material = new three.MeshStandardMaterial(); material.name = name;
      const mesh = new three.Mesh(new three.BoxGeometry(20, 46, 20), material); body.add(mesh); return mesh;
    });
    meshes[1]!.visible = false;
    const lease: ModelLease = { scene: body, placeholder: false,
      animations: [['s_idle', 2], ['s_cast', 1]].map(([name, seconds]) => new three.AnimationClip(name as string, seconds as number, [])),
      animationNames: { idle: 's_idle', cast: 's_cast' }, submeshVisibility: { initiallyHidden: ['wings'] }, timedForm: { show: ['wings'], hide: [] },
      release: vi.fn(() => { body.removeFromParent(); for (const mesh of meshes) { mesh.geometry.dispose(); (mesh.material as { dispose(): void }).dispose(); } }),
    };
    leases.push(lease); return lease;
  }
  const wingsShown = (lease: ModelLease) => lease.scene.children.find(o => ((o as { material?: { name: string } }).material?.name) === 'wings')!.visible;
  async function mount(): Promise<void> {
    const renderer = await import('../src/rendering/three-mode/placeholder-renderer');
    renderer.useBoardFeed({ subscribe(next) { listener = next; return () => {}; }, controls: () => controls, legendControls: () => null });
    mounted = await renderer.mountRenderer3d({ clientWidth: 800, clientHeight: 600, append() {} } as unknown as HTMLElement, { assetBase: '/memory/' });
    advance(1);
  }
  async function publish(pieces: readonly BoardPiece[], fighting = true): Promise<void> {
    listener.frame(frame(pieces, fighting));
    await Promise.resolve(); // resolve an immediately available model lease
    advance(1);
  }

  // The renderer resets every piece's action with a new mixer when a combat starts or ends, when the board changes battle
  // and on a rewind (resetAction after clearEffects), and a new mixer starts with the form off: no form outlives its combat.
  it('a new combat turns a form that was on off at once, and its next cast turns it on again', async () => {
    const lease = swainModel();
    vi.spyOn(core.ModelCache.prototype, 'load').mockResolvedValue(lease);
    await mount();
    const swain = piece({ id: 's', definitionId: 'swain', form: 'melee' });
    await publish([swain]);
    expect(scene.getObjectByName('model-swain')).toBe(lease.scene);
    expect(wingsShown(lease)).toBe(false);
    listener.events([{ type: 'cast', tick: 10, eventSeq: 10, sourceId: 's', targetIds: ['foe'] } as unknown as DisplayCombatEvent]);
    advance(200);
    expect(wingsShown(lease)).toBe(true);
    // The combat ends mid-form (no ascension end event): back to planning, then a new combat.
    await publish([swain], false);
    expect(wingsShown(lease)).toBe(false);
    await publish([swain]); advance(500);
    expect(wingsShown(lease)).toBe(false);
    listener.events([{ type: 'cast', tick: 10, eventSeq: 10, sourceId: 's', targetIds: ['foe'] } as unknown as DisplayCombatEvent]);
    advance(200);
    expect(wingsShown(lease)).toBe(true);
  });
});
