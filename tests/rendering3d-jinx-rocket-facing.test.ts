// Built on the harness of rendering3d-jayce-forge.test.ts (only the GPU/DOM and asset I/O substituted). Synthetic board and
// events (made-up places and ticks).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PerspectiveCamera, Scene } from 'three';
import type { BoardControls, BoardFeedListener, BoardFrame, BoardPiece } from '../src/rendering/board-feed';
import type { Renderer3d } from '../src/rendering/three-mode/contract';
import type { ModelLease } from '../src/rendering3d';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { JINX_ROCKET_FACING } from '../src/rendering/three-mode/vfx-ltk/champions/jinx';

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

describe("Jinx's rocket: she turns to where it lands while she fires it, in the real mountRenderer3d", () => {
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
    mounted = await renderer.mountRenderer3d({ clientWidth: 800, clientHeight: 600, append() {} } as unknown as HTMLElement, { assetBase: '/memory/' });
    advance(1);
  }
  // Jinx on the left, the unit she targets to her right; her rocket lands at the board's centre cell, up and to her left.
  const jinx = piece({ id: 'jx', definitionId: 'jinx', x: 200, y: 260 }), foe = piece({ id: 'f1', definitionId: 'zeri', team: 'enemy', x: 340, y: 260 });
  const send = async (events: readonly unknown[]) => { listener.events(events as DisplayCombatEvent[]); await Promise.resolve(); advance(1); };
  const headingOf = (id: string) => { const body = scene.getObjectByName(`model-${id}`); if (!body) { const names: string[] = []; scene.traverse(o => { if (o.name) names.push(o.name); }); throw new Error('no body; ' + names.slice(0, 40).join(',')); } return body.parent!.rotation.y; };
  const toward = (x: number, z: number) => Math.atan2(x - 200, z - 260);
  const centre = { x: 50 + Math.sqrt(3) * 34 * (1 + 1 / 2), z: 50 + 34 * 1.5 * 1 };
  const cast = (tick: number, branch: string) => ({ type: 'cast', sourceId: 'jx', eventSeq: tick, tick, actionSeq: tick, completed: true, actualManaSpent: 60,
    refundedMana: 0, targetIds: ['f1'], completionCell: { col: 2, row: 3 }, branch: { branch } });
  const rocket = (type: string, tick: number) => ({ type, tick, eventSeq: tick, sourceId: 'jx', targetId: 'f1', skill: 'jinx-rocket', ordinal: 0, actionSeq: 1, count: 1, arrivalTick: tick + 10, hit: true });
  async function setUp() {
    const leases = new Map([['jinx', model('jinx', { idle: 'idle' }, [['idle', 2]])], ['zeri', model('zeri', { idle: 'idle' }, [['idle', 2]])]]);
    vi.spyOn(core.ModelCache.prototype, 'load').mockImplementation(async id => leases.get(id)!);
    await mount();
    listener.frame(frame([jinx, foe], true)); await Promise.resolve(); await Promise.resolve(); advance(1);
    await vi.waitFor(() => { advance(1); expect(scene.getObjectByName('model-jinx')).toBeDefined(); });
    // She attacks the unit to her right and turns to it.
    await send([{ type: 'attack', attackerId: 'jx', targetId: 'f1', tick: 1, eventSeq: 1 }]); advance(500);
    expect(headingOf('jinx')).toBeCloseTo(toward(340, 260), 3);
  }

  it('turns smoothly to the landing point from her rocket cast, and back to her target once it lands', async () => {
    await setUp();
    await send([cast(10, 'rocket')]);
    advance(100); // part-way: a smooth turn, not a snap
    const midway = headingOf('jinx');
    expect(Math.abs(midway - toward(centre.x, centre.z))).toBeGreaterThan(1e-3);
    advance(500);
    expect(headingOf('jinx')).toBeCloseTo(toward(centre.x, centre.z), 3);
    await send([rocket('abilityProjectileLaunched', 37)]); advance(300);
    expect(headingOf('jinx')).toBeCloseTo(toward(centre.x, centre.z), 3);
    await send([rocket('abilityProjectileLanded', 47)]); advance(500);
    expect(headingOf('jinx')).toBeCloseTo(toward(340, 260), 3);
  }, 30000);

  it('a rocket cast the rules cut short turns her back to her target after a while; a zap cast does not turn her', async () => {
    await setUp();
    await send([cast(10, 'zap')]); advance(500);
    expect(headingOf('jinx')).toBeCloseTo(toward(340, 260), 3);
    await send([cast(20, 'rocket')]); advance(500);
    expect(headingOf('jinx')).toBeCloseTo(toward(centre.x, centre.z), 3);
    advance(JINX_ROCKET_FACING.holdSeconds * 1000); // no launch ever comes
    expect(headingOf('jinx')).toBeCloseTo(toward(340, 260), 3);
  }, 30000);

  it('dying drops the look at the landing point: brought back, she looks at her target again', async () => {
    await setUp();
    await send([cast(10, 'rocket')]); advance(500);
    expect(headingOf('jinx')).toBeCloseTo(toward(centre.x, centre.z), 3);
    listener.frame(frame([{ ...jinx, alive: false }, foe], true)); advance(100);
    listener.frame(frame([jinx, foe], true)); advance(100);
    // Within the rocket's hold, yet she follows her own target again once she attacks it.
    await send([{ type: 'attack', attackerId: 'jx', targetId: 'f1', tick: 30, eventSeq: 30 }]); advance(500);
    expect(headingOf('jinx')).toBeCloseTo(toward(340, 260), 3);
  }, 30000);

  it('a new fight drops the look at the landing point: in it she looks at her target again', async () => {
    await setUp();
    await send([cast(10, 'rocket')]); advance(500);
    expect(headingOf('jinx')).toBeCloseTo(toward(centre.x, centre.z), 3);
    // The fight ends and the next one starts, well within the rocket's hold.
    listener.frame(frame([jinx, foe], false)); advance(100);
    listener.frame(frame([jinx, foe], true)); advance(100);
    await send([{ type: 'attack', attackerId: 'jx', targetId: 'f1', tick: 1, eventSeq: 1 }]); advance(1500);
    // Toward where the two stand now (the new fight may have nudged them), not toward the landing point.
    const me = scene.getObjectByName('model-jinx')!.parent!.position, them = scene.getObjectByName('model-zeri')!.parent!.position;
    expect(headingOf('jinx')).toBeCloseTo(Math.atan2(them.x - me.x, them.z - me.z), 3);
    expect(Math.abs(headingOf('jinx') - Math.atan2(centre.x - me.x, centre.z - me.z))).toBeGreaterThan(0.5);
  }, 30000);
});
