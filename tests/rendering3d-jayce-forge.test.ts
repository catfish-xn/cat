import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { Group, PerspectiveCamera, Scene } from 'three';
import type { BoardControls, BoardFeedListener, BoardFrame, BoardPiece, LegendControls } from '../src/rendering/board-feed';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import type { Renderer3d } from '../src/rendering/three-mode/contract';
import type { ModelLease, UnitAnimationMixer } from '../src/rendering3d';

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

describe('Hextech Forge summon in the real mountRenderer3d', () => {
  let three: typeof import('three'), core: typeof import('../src/rendering3d');
  let mounted: Renderer3d | undefined, listener: BoardFeedListener, canvas: Canvas;
  let scene: Scene, camera: PerspectiveCamera, controls: BoardControls;
  let apply: MockInstance<UnitAnimationMixer['apply']>;
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
    apply = vi.spyOn(core.UnitAnimationMixer.prototype, 'apply'); // call through, including the real AnimationMixer
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
  const forgeModel = () => model('g23-forge', { idle: 'f_idle', cast: 'f_cast', death: 'f_death', spawn: 'f_spawn' },
    [['f_idle', 4], ['f_cast', 0.9], ['f_death', 1.3], ['f_spawn', 1.5]]);
  const jayceModel = () => model('jayce', { idle: 'j_idle', cast: 'j_cast' }, [['j_idle', 2], ['j_cast', 1]]);
  /** The forge's mixer and its last applied output. */
  const forgeCalls = (lease: ModelLease) => apply.mock.calls.filter((_, i) => (apply.mock.contexts[i] as unknown as { root: unknown }).root === lease.scene);
  const forgeClip = (lease: ModelLease) => { const output = forgeCalls(lease).at(-1)![0]; return output.playback?.clips[0] ?? output.state; };
  async function mount(assetBase: string | null = '/memory/', legendControls: LegendControls | null = null): Promise<void> {
    const renderer = await import('../src/rendering/three-mode/placeholder-renderer');
    renderer.useBoardFeed({ subscribe(next) { listener = next; return () => {}; }, controls: () => controls, legendControls: () => legendControls });
    mounted = await renderer.mountRenderer3d({ clientWidth: 800, clientHeight: 600,
      append() {} } as unknown as HTMLElement, { assetBase });
    advance(1);
  }
  async function publish(pieces: readonly BoardPiece[], fighting = true): Promise<void> {
    listener.frame(frame(pieces, fighting));
    await Promise.resolve(); // resolve an immediately available model lease
    advance(1);
  }

  const jayce = (changes: Partial<BoardPiece> = {}) => piece({ id: 'j', definitionId: 'jayce', ...changes });
  const forge = (changes: Partial<BoardPiece> = {}) => piece({ id: 'j:g23-forge', definitionId: 'g23-forge', x: 220, ...changes });
  function useModels(): { forgeLease: ModelLease; jayceLease: ModelLease } {
    const forgeLease = forgeModel(), jayceLease = jayceModel();
    vi.spyOn(core.ModelCache.prototype, 'load').mockImplementation(async id => id === 'g23-forge' ? forgeLease : jayceLease);
    return { forgeLease, jayceLease };
  }
  const cast = (tick: number) => listener.events([{ type: 'cast', tick, eventSeq: tick, sourceId: 'j', targetIds: ['foe'] } as unknown as DisplayCombatEvent]);

  it('keeps a missing trainer golem as a team pawn across combat resets, death and revival', async () => {
    await mount();
    const golem = piece({ definitionId: 'trainer-golem' });
    await publish([golem], false);
    await vi.dynamicImportSettled();
    await publish([golem]);
    await publish([{ ...golem, alive: false }]); advance(2000);
    await publish([golem], false);
    await publish([golem]);
    expect(scene.getObjectByName('rendering3d-placeholder')).toBeUndefined();
    const magenta: unknown[] = [], pawns: unknown[] = [];
    scene.traverse(object => {
      if (!(object instanceof three.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if ('color' in material && material.color instanceof three.Color) {
          if (material.color.getHex() === 0xff00ff) magenta.push(object);
          if (object.geometry.type === 'CylinderGeometry') pawns.push(object);
        }
      }
    });
    expect(magenta).toEqual([]); expect(pawns.length).toBeGreaterThan(0);
    expect(apply.mock.contexts.some(mixer => (mixer as unknown as { root: Group }).root.name === 'rendering3d-placeholder')).toBe(false);
  });

  it.each(['TFT_ArmoryKeyComponent', 'TFT_ArmoryKeyCompleted'])('loads %s by its own manifest key and hides champion stars', async definitionId => {
    const renderer = await import('../src/rendering/three-mode/placeholder-renderer');
    renderer.useAnvilTest(id => id.startsWith('TFT_ArmoryKey'));
    const lease = model(definitionId, { idle: 'anvil_idle' }, [['anvil_idle', 2]]);
    const load = vi.spyOn(core.ModelCache.prototype, 'load').mockResolvedValue(lease);
    await mount(); await publish([piece({ definitionId })], false);
    expect(load).toHaveBeenCalledWith(definitionId);
    expect(scene.getObjectByName(`model-${definitionId}`)).toBe(lease.scene);
    expect(scene.getObjectByName('render3d-stars')).toBeUndefined();
  });

  it('rises with its spawn clip when it appears in combat, then stands in idle', async () => {
    const { forgeLease } = useModels();
    await mount(); await publish([jayce()], false); await publish([jayce(), forge()]);
    expect(forgeClip(forgeLease)).toBe('f_spawn');
    advance(1600);
    expect(forgeClip(forgeLease)).toBe('idle');
  });

  it('shows a forge already standing without its spawn clip when the view joins a battle midway', async () => {
    const { forgeLease } = useModels();
    await mount(); await publish([jayce(), forge()]); // the first frame after mounting is a running combat
    expect(forgeClip(forgeLease)).toBe('idle');
  });

  it("does not replay the spawn clip when switching to another seat's battle in progress", async () => {
    const { forgeLease } = useModels();
    await mount(); await publish([jayce({ id: 'mine' })], false);
    await publish([jayce({ id: 'mine' })]); // my battle begins: nothing of mine rises
    const scout = { seatId: 'B', name: 'B', board: { units: [] }, orbs: [], watching: true as const };
    listener.scout!(scout as unknown as Parameters<NonNullable<BoardFeedListener['scout']>>[0]);
    await publish([jayce(), forge()]); // its battle as the stream shows it: the forge was placed at its start
    expect(forgeClip(forgeLease)).toBe('idle');
    // Even when my board had gone back to preparation before the watched battle reached the frames.
    listener.scout!(null);
    await publish([jayce({ id: 'mine' })], false);
    listener.scout!({ ...scout, seatId: 'C' } as unknown as Parameters<NonNullable<BoardFeedListener['scout']>>[0]);
    await publish([jayce({ id: 'c' }), forge({ id: 'c:g23-forge' })]);
    expect(forgeClip(forgeLease)).toBe('idle');
  });

  it('rises when a current unitSpawned event brings it in during a battle', async () => {
    const { forgeLease } = useModels();
    await mount(); await publish([jayce()]);
    listener.events([{ type: 'unitSpawned', tick: 12, eventSeq: 12, unitId: 'j:g23-forge', definitionId: 'g23-forge', team: 'player',
      sourceId: 'j', cell: { col: 1, row: 1 } } as unknown as DisplayCombatEvent]);
    await publish([jayce(), forge()]);
    expect(forgeClip(forgeLease)).toBe('f_spawn');
  });

  it("does not rise for an alive flip without a revive event (another battle's unit under the same id)", async () => {
    const { forgeLease } = useModels();
    await mount(); await publish([jayce()], false); await publish([jayce(), forge()]); advance(1600);
    await publish([jayce(), forge({ alive: false })]); advance(1500);
    await publish([jayce(), forge()]);
    expect(forgeClip(forgeLease)).toBe('idle');
  });

  it("plays its own cast clip when Jayce casts, and nothing for another unit's cast", async () => {
    const { forgeLease } = useModels();
    await mount(); await publish([jayce(), forge()]); advance(1600);
    listener.events([{ type: 'cast', tick: 3, eventSeq: 3, sourceId: 'foe', targetIds: ['j'] } as unknown as DisplayCombatEvent]);
    expect(forgeClip(forgeLease)).toBe('idle');
    cast(4);
    expect(forgeClip(forgeLease)).toBe('f_cast');
  });

  it("is revived by Jayce's cast with its spawn clip, not the cast clip", async () => {
    const { forgeLease } = useModels();
    await mount(); await publish([jayce(), forge()]); advance(1600);
    await publish([jayce(), forge({ alive: false })]);
    expect(forgeClip(forgeLease)).toBe('death');
    advance(1500);
    cast(40); // dead: no cast clip
    expect(forgeClip(forgeLease)).toBe('death');
    listener.events([{ type: 'unitRevived', tick: 40, eventSeq: 41, unitId: 'j:g23-forge', hp: 1000 } as unknown as DisplayCombatEvent]);
    await publish([jayce(), forge()]);
    expect(forgeClip(forgeLease)).toBe('f_spawn');
    expect((forgeLease.scene.parent as Group).visible).toBe(true);
  });

  it('keeps a summon without a spawn clip in idle when it appears', async () => {
    const lease = model('model', { idle: 'rest' }, [['rest', 1]]);
    vi.spyOn(core.ModelCache.prototype, 'load').mockResolvedValue(lease);
    await mount(); await publish([piece()]);
    expect(forgeClip(lease)).toBe('idle');
  });

  it('accepts a spawn clip name in the asset manifest', () => {
    expect(() => core.assertManifest({ schemaVersion: 1, models: { 'g23-forge': { path: 'models/g23-forge/model.glb',
      animations: { idle: 'f_idle', spawn: 'f_spawn' } } } })).not.toThrow();
  });

  it('draws no star mark over the forge', async () => {
    useModels();
    const starMeshes = () => { let n = 0; scene.traverse(o => { if ((o as { geometry?: { type?: string } }).geometry?.type === 'ShapeGeometry') n++; }); return n; };
    await mount(); await publish([jayce()]);
    const jayceOnly = starMeshes();
    expect(jayceOnly).toBeGreaterThan(0);
    await publish([jayce(), forge()]);
    expect(starMeshes()).toBe(jayceOnly);
  });

  it('records a caught-up Viktor cast before the current landing without replaying its old warning', async () => {
    const runtimeModule = await import('../src/rendering/three-mode/vfx-ltk/runtime');
    const createRuntime = runtimeModule.createLtkRuntime;
    let play: MockInstance<ReturnType<typeof createRuntime>['play']> | undefined;
    vi.spyOn(runtimeModule, 'createLtkRuntime').mockImplementation((...args) => {
      const runtime = createRuntime(...args);
      play = vi.spyOn(runtime, 'play').mockReturnValue(true);
      return runtime;
    });
    const lease = model('viktor', { idle: 'idle', cast: 'cast' }, [['idle', 2], ['cast', 1]]);
    vi.spyOn(core.ModelCache.prototype, 'load').mockResolvedValue(lease);
    await mount();
    await publish([piece({ id: 'v', definitionId: 'viktor' }), piece({ id: 'target', team: 'enemy' })]);
    const cast: DisplayCombatEvent = { type: 'cast', eventSeq: 1, tick: 1, sourceId: 'v', targetIds: ['target'], actionSeq: 1,
      completed: true, actualManaSpent: 0, refundedMana: 0, completionCell: { col: 0, row: 0 } };
    const landing: DisplayCombatEvent = { type: 'packetDamage', eventSeq: 2, tick: 41, sourceId: 'v', targetId: 'target',
      damageType: 'magic', hit: true, hpDamage: 100, absorbed: 0, critical: false, killingPacket: false };
    listener.events([cast, landing]);
    expect(play).toHaveBeenCalledTimes(1);
    expect(play!.mock.calls[0]).toMatchObject(['viktor', 'v', ['target'], 0, 'cast', { skill: 'viktor-slam' }]);
    listener.events([{ ...landing, eventSeq: 3, tick: 42 }]);
    expect(play).toHaveBeenCalledTimes(1);
  });
});
