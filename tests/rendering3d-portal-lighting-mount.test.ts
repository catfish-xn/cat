import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Group, Mesh, PerspectiveCamera, Scene } from 'three';
import type { BoardFeedListener, BoardFrame } from '../src/rendering/board-feed';
import type { Renderer3d } from '../src/rendering/three-mode/contract';
import type { createPvpPortal } from '../src/rendering/three-mode/pvp-portal';

const planning: BoardFrame = { rows: 8, columns: 7, hexRadius: 34, origin: { x: 50, y: 50 },
  bench: [], pieces: [], fighting: false, dragging: null };
const combat: BoardFrame = { ...planning, fighting: true, pieces: [
  { id: 'foe', definitionId: 'synthetic', team: 'enemy', starLevel: 1, x: 220, y: 90, visible: true, alive: true },
  { id: 'mine', definitionId: 'synthetic', team: 'player', starLevel: 1, x: 220, y: 340, visible: true, alive: true },
] };

/** Real mount, feed edges, picking and rendering order; GPU/DOM only are synthetic, no assets or rule engine. */
describe('v26 portal/lighting mount integration', () => {
  let mounted: Renderer3d | undefined, listener: BoardFeedListener, tick: FrameRequestCallback, now: number, reduced: boolean;
  let handlers: Map<string, (event: PointerEvent) => void>;
  const commands = { select: vi.fn(), dragStart: vi.fn(), dragMove: vi.fn(), dragEnd: vi.fn(), dragCancel: vi.fn() };
  const debug = () => (window as unknown as { __render3d: {
    portal: ReturnType<typeof createPvpPortal>; pieces: Map<string, { root: Group; target: import('three').Vector3 }>;
    scene: Scene; camera: PerspectiveCamera;
  } }).__render3d;
  beforeEach(() => {
    vi.resetModules(); handlers = new Map(); now = 0; reduced = false;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('window', { devicePixelRatio: 1 }); vi.stubGlobal('location', { search: '?debug3d' });
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('must not request assets'); }));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { tick = callback; return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.doMock('three', async original => ({ ...await original<typeof import('three')>(), WebGLRenderer: class {
      domElement = { className: '', style: {}, addEventListener: (type: string, handler: (event: PointerEvent) => void) => handlers.set(type, handler),
        removeEventListener: (type: string) => handlers.delete(type), remove() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
      setPixelRatio() {} setSize() {} dispose() {} forceContextLoss() {}
      render(scene: Scene, camera: PerspectiveCamera) { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); }
    } }));
  });
  afterEach(() => {
    mounted?.dispose(); mounted = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.doUnmock('three'); vi.resetModules(); vi.clearAllMocks();
  });
  async function mount(search = '?debug3d') {
    vi.stubGlobal('location', { search });
    const module = await import('../src/rendering/three-mode/placeholder-renderer');
    module.useReducedMotion(() => reduced);
    module.useBoardFeed({ subscribe(next) { listener = next; return () => {}; }, controls: () => ({ ...commands, hover() {}, look() {}, describe() {} }) });
    mounted = await module.mountRenderer3d({ clientWidth: 800, clientHeight: 600, append() {} } as unknown as HTMLElement, { assetBase: null });
  }
  function advance(ms = 16) { now += ms; tick(now); }
  function hoverFoe() {
    const { camera, pieces } = debug(), point = pieces.get('foe')!.root.position.clone(); point.y += 30; point.project(camera);
    handlers.get('pointermove')!({ clientX: (point.x + 1) * 400, clientY: (1 - point.y) * 300, pointerType: 'mouse' } as PointerEvent);
  }

  it('plays once at a normal PvP edge, follows live targets and overheads, and keeps commands untouched', async () => {
    await mount(); const before = structuredClone(combat);
    listener.frame(planning); listener.frame(combat); advance();
    const { portal, pieces, scene } = debug(), foe = pieces.get('foe')!;
    expect(portal.active).toBe(true); expect(foe.root.position.y).toBeGreaterThan(0);
    const overheads = scene.children.filter(child => child.name === 'render3d-overhead');
    expect(overheads.some(child => child.position.y > 100)).toBe(true);
    for (let i = 0; i < 5; i++) { listener.frame(combat); advance(200); }
    expect(portal.active).toBe(false); expect(foe.root.position).toEqual(foe.target);
    hoverFoe(); expect(foe.root.getObjectByName('render3d-hover-outline')).toBeDefined();
    handlers.get('pointerleave')!({ pointerType: 'mouse' } as PointerEvent);
    expect(foe.root.getObjectByName('render3d-hover-outline')).toBeUndefined();
    expect(combat).toEqual(before); for (const command of Object.values(commands)) expect(command).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not replay a mounted or watched combat and immediately cancels on scouting or reduced motion', async () => {
    await mount(); listener.frame(combat); advance(); expect(debug().portal.active).toBe(false);
    listener.frame(planning); listener.frame(combat); advance(); expect(debug().portal.active).toBe(true);
    listener.scout!({ seatId: 'other', name: 'Other', watching: true }); expect(debug().portal.active).toBe(false);
    listener.frame(combat); advance(); expect(debug().portal.active).toBe(false);
    listener.scout!(null); listener.frame(planning); listener.frame(combat); advance(); expect(debug().portal.active).toBe(true);
    reduced = true; advance(); expect(debug().portal.active).toBe(false);
    expect(debug().pieces.get('foe')!.root.position).toEqual(debug().pieces.get('foe')!.target);
    reduced = false; advance(); expect(debug().portal.active).toBe(false);
  });

  it('off removes added effects, while low keeps arrivals without per-piece shadows or outlines', async () => {
    await mount('?debug3d&quality3d=off'); listener.frame(planning); listener.frame(combat); advance();
    expect(debug().portal.active).toBe(false);
    expect(debug().scene.getObjectByName('render3d-contact-shadows')!.children).toHaveLength(0);
    hoverFoe(); expect(debug().pieces.get('foe')!.root.getObjectByName('render3d-hover-outline')).toBeUndefined();
    mounted!.dispose(); mounted = undefined;
    await mount('?debug3d&quality3d=low'); listener.frame(planning); listener.frame(combat); advance();
    expect(debug().portal.active).toBe(true);
    expect(debug().scene.getObjectByName('render3d-contact-shadows')!.children).toHaveLength(0);
    listener.frame(planning); advance(); expect(debug().portal.active).toBe(false);
    // No stale effects/handlers survive disposal.
    const portalMesh = debug().portal.object.children[0] as Mesh;
    const dispose = vi.spyOn(portalMesh.geometry, 'dispose');
    mounted!.dispose(); mounted = undefined; expect(dispose).toHaveBeenCalledTimes(1); expect(handlers.has('pointermove')).toBe(false);
  });
});
