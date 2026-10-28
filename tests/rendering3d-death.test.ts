import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { Group, PerspectiveCamera, Scene } from 'three';
import type { BoardControls, BoardFeedListener, BoardFrame, BoardPiece, LegendControls } from '../src/rendering/board-feed';
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

describe('real mountRenderer3d death lifecycle and picking', () => {
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
  function model(id = 'unit', duration = 2): ModelLease {
    const body = new three.Group(); body.name = `model-${id}`;
    const geometry = new three.BoxGeometry(20, 46, 20), material = new three.MeshStandardMaterial();
    body.add(new three.Mesh(geometry, material));
    const lease: ModelLease = { scene: body, placeholder: false,
      animations: [new three.AnimationClip('rest', 1, []), new three.AnimationClip('fall', duration, [])],
      animationNames: { idle: 'rest', death: 'fall' },
      release: vi.fn(() => { body.removeFromParent(); geometry.dispose(); material.dispose(); }),
    };
    leases.push(lease); return lease;
  }
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
  function root(lease: ModelLease): Group { return lease.scene.parent as Group; }
  function latestState(): string { return apply.mock.calls.at(-1)![0].state; }
  function latestMixer(): UnitAnimationMixer { return apply.mock.contexts.at(-1) as UnitAnimationMixer; }
  function screen(x: number, y: number, z: number): { x: number; y: number } {
    const point = new three.Vector3(x, y, z).project(camera);
    return { x: (point.x + 1) * 400, y: (1 - point.y) * 300 };
  }

  it('finishes a pawn death when its still-loading model resolves to a missing-model placeholder', async () => {
    let arrive!: (value: ModelLease) => void;
    const lease = { ...model(), placeholder: true, animations: [], animationNames: {} };
    vi.spyOn(core.ModelCache.prototype, 'load').mockReturnValue(new Promise(done => { arrive = done; }));
    await mount(); await publish([piece()]);
    const pawn = scene.getObjectByName('render3d-pawn')!, unit = pawn.parent!;
    await publish([piece({ alive: false })]);
    expect(unit.visible).toBe(true);
    arrive(lease); await Promise.resolve(); await Promise.resolve();
    advance(1300);
    expect(unit.visible).toBe(false);
    expect(lease.scene.parent).toBeNull();
  });

  it('draws meters and items over a piece, and releases an item icon that arrives after the renderer is gone', async () => {
    const lease = model(); vi.spyOn(core.ModelCache.prototype, 'load').mockResolvedValue(lease);
    let arrive!: (texture: InstanceType<typeof three.Texture>) => void;
    const load = vi.spyOn(three.TextureLoader.prototype, 'loadAsync').mockReturnValue(new Promise(done => { arrive = done; }));
    await mount();
    await publish([piece({ meters: { hp: 300, maxHp: 600, mana: 0, maxMana: 50, shield: 0 }, items: [{ id: 'sword', icon: 'icons/sword.png' }] })]);
    const overhead = scene.getObjectByName('render3d-overhead')!;
    expect(overhead.visible).toBe(true);
    expect(overhead.getObjectByName('render3d-overhead-bar')!.visible).toBe(true);
    expect(overhead.getObjectByName('render3d-overhead-item-sword')).toBeDefined();
    expect(load).toHaveBeenCalledExactlyOnceWith('icons/sword.png');
    mounted!.dispose(); mounted = undefined;
    const late = new three.Texture(), dispose = vi.spyOn(late, 'dispose');
    arrive(late); await vi.waitFor(() => expect(dispose).toHaveBeenCalled());
  });

  it('plays death while visible, hides, revives with a fresh action, and times a second death independently', async () => {
    const lease = model(); vi.spyOn(core.ModelCache.prototype, 'load').mockResolvedValue(lease);
    await mount(); await publish([piece()]);
    const unit = root(lease);
    expect(unit.visible).toBe(true); expect(latestState()).toBe('idle');
    await publish([piece({ alive: false })]);
    expect(latestState()).toBe('death'); expect(unit.visible).toBe(true);
    const death = latestMixer().mixer.existingAction(lease.animations[1])!;
    expect(death.isRunning()).toBe(true);
    advance(1800); expect(unit.visible).toBe(true); expect(death.time).toBeGreaterThan(1.7);
    advance(250); expect(unit.visible).toBe(false);
    await publish([piece({ alive: false })]); expect(unit.visible).toBe(false);
    await publish([piece()]);
    expect(unit.visible).toBe(true); expect(latestState()).toBe('idle');
    expect(latestMixer().mixer.existingAction(lease.animations[0])?.isRunning()).toBe(true);
    await publish([piece({ alive: false })]);
    expect(latestState()).toBe('death'); expect(unit.visible).toBe(true);
    expect(latestMixer().mixer.existingAction(lease.animations[1])!.time).toBeLessThan(0.01);
    advance(1800); expect(unit.visible).toBe(true);
    advance(250); expect(unit.visible).toBe(false);
  });

  it('resets death on revival before the still-visible death action has finished', async () => {
    const lease = model(); vi.spyOn(core.ModelCache.prototype, 'load').mockResolvedValue(lease);
    await mount(); await publish([piece()]);
    await publish([piece({ alive: false })]); advance(300);
    const oldMixer = latestMixer(); expect(root(lease).visible).toBe(true);
    await publish([piece()]);
    expect(root(lease).visible).toBe(true); expect(latestState()).toBe('idle');
    expect(latestMixer()).not.toBe(oldMixer);
    advance(2200); expect(root(lease).visible).toBe(true);
  });

  it('restores hidden units and resets actions when returning to preparation and entering the next combat', async () => {
    const lease = model(); vi.spyOn(core.ModelCache.prototype, 'load').mockResolvedValue(lease);
    await mount(); await publish([piece()]);
    await publish([piece({ alive: false })]); advance(2200);
    expect(root(lease).visible).toBe(false);
    await publish([piece()], false);
    expect(root(lease).visible).toBe(true); expect(latestState()).toBe('idle');
    await publish([piece()], true);
    expect(root(lease).visible).toBe(true); expect(latestState()).toBe('idle');
    await publish([piece({ alive: false })]); advance(1800);
    expect(root(lease).visible).toBe(true);
    advance(250); expect(root(lease).visible).toBe(false);
  });

  it('hides a unit already dead on the first board frame, including when its model arrives later', async () => {
    const lease = model(); let resolve!: (lease: ModelLease) => void;
    const pending = new Promise<ModelLease>(done => { resolve = done; });
    vi.spyOn(core.ModelCache.prototype, 'load').mockReturnValue(pending);
    await mount(); await publish([piece({ alive: false })]);
    // The only piece root holds its ring and the team pawn while the model is pending.
    const roots = scene.children.filter(object => object instanceof three.Group && !!object.getObjectByName('render3d-pawn'));
    expect(roots).toHaveLength(1); const unit = roots[0] as Group;
    expect(unit).toBeDefined(); expect(unit.visible).toBe(false);
    resolve(lease); await pending; advance(1);
    expect(root(lease)).toBe(unit); expect(unit.visible).toBe(false);
    advance(2500); expect(unit.visible).toBe(false);
  });

  it('waits for a late model, consumes death without a mixer, then uses the mapped death clip duration', async () => {
    const lease = model('unit', 3); let resolve!: (lease: ModelLease) => void;
    const pending = new Promise<ModelLease>(done => { resolve = done; });
    vi.spyOn(core.ModelCache.prototype, 'load').mockReturnValue(pending);
    await mount(); await publish([piece()]); await publish([piece({ alive: false })]);
    const roots = scene.children.filter(object => object instanceof three.Group && !!object.getObjectByName('render3d-pawn'));
    expect(roots).toHaveLength(1); const unit = roots[0] as Group;
    advance(5000); expect(unit.visible).toBe(true); expect(apply).not.toHaveBeenCalled();
    resolve(lease); await pending; advance(1);
    expect(root(lease)).toBe(unit); expect(latestState()).toBe('death');
    const death = latestMixer().mixer.existingAction(lease.animations[1])!;
    expect(death.isRunning()).toBe(true); expect(death.time).toBeLessThan(0.01);
    advance(1300); expect(unit.visible).toBe(true); // exceeds the 1.2 s pawn fallback
    advance(1500); expect(unit.visible).toBe(true); expect(death.time).toBeGreaterThan(2.7);
    advance(250); expect(unit.visible).toBe(false);
  });

  it('uses the fallback countdown for a pawn with no model assets', async () => {
    await mount(null); await publish([piece()]);
    const unit = scene.getObjectByName('render3d-pawn')!.parent as Group;
    await publish([piece({ alive: false })]); advance(1000);
    expect(unit.visible).toBe(true);
    advance(250); expect(unit.visible).toBe(false);
    await publish([piece()]); expect(unit.visible).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([[null, 'other'], ['other', 'third'], ['other', null]] as const)(
    'clears live, loading and queued effects and resets actions on battle switch %s -> %s', async (from, to) => {
      const manifest = { schemaVersion: 1, models: { model: { path: 'model.glb' } },
        effects: Object.fromEntries(['live', 'loading', 'delayed'].map(id => [id, { path: `${id}.json` }])),
        actionEffects: { model: { attack: ['live', 'loading', 'delayed'] } } };
      vi.mocked(fetch).mockImplementation(async input => {
        const url = String(input);
        if (url.endsWith('manifest.json')) return Response.json(manifest);
        if (url.endsWith('action-bindings.json')) return Response.json({ playback: {
          live: { anchor: 'source', delay: 0, maxDuration: 10 },
          loading: { anchor: 'source', delay: 0, maxDuration: 10 },
          delayed: { anchor: 'source', delay: 2, maxDuration: 10 },
        } });
        return new Response('missing', { status: 404 });
      });
      const lease = model();
      lease.animations.push(new three.AnimationClip('swing', 4, []));
      lease.animationNames.attack = 'swing';
      vi.spyOn(core.ModelCache.prototype, 'load').mockResolvedValue(lease);
      const makeEffect = () => new core.ParticleEffect({ schemaVersion: 1, emitters: [{ kind: 'sprite', count: 1, lifetime: 10 }] });
      const live = makeEffect(), loading = makeEffect();
      const disposedLive = vi.spyOn(live, 'dispose'), disposedLoading = vi.spyOn(loading, 'dispose');
      let resolveLoading!: (effect: typeof loading) => void;
      const pending = new Promise<typeof loading>(resolve => { resolveLoading = resolve; });
      const load = vi.spyOn(core, 'loadParticleEffect').mockImplementation(async (_manifest, id) => {
        if (id === 'live') return live;
        if (id === 'loading') return pending;
        throw new Error('queued effect should have been cancelled');
      });
      await mount(); await publish([piece()]);
      const scout = (seatId: string | null) => listener.scout!(seatId ? { seatId, name: seatId, board: { units: [] }, watching: true } : null);
      scout(from);
      listener.events([{ type: 'attack', attackerId: 'unit', targetId: 'unit', tick: 1, eventSeq: 1 }]);
      const oldMixer = latestMixer();
      expect(latestState()).toBe('attack');
      advance(50);
      await vi.waitFor(() => expect(live.object.parent).toBe(root(lease)));
      expect(load.mock.calls.map(([, id]) => id).sort()).toEqual(['live', 'loading']);
      expect(disposedLive).not.toHaveBeenCalled(); expect(disposedLoading).not.toHaveBeenCalled();

      scout(to);
      expect(disposedLive).toHaveBeenCalledOnce();
      expect(live.object.parent).toBeNull();
      expect(latestState()).toBe('idle');
      expect(latestMixer()).not.toBe(oldMixer);
      resolveLoading(loading);
      await vi.waitFor(() => expect(disposedLoading).toHaveBeenCalledOnce());
      expect(loading.object.parent).toBeNull();
      advance(2500);
      expect(load.mock.calls.map(([, id]) => id).sort()).toEqual(['live', 'loading']);
      expect(latestState()).toBe('idle');
    });

  it.each(['player', 'enemy'] as const)('excludes a visible dead %s from select, hover and feed picking without blocking a live unit behind it', async team => {
    const front = model('front'), back = model('back');
    vi.spyOn(core.ModelCache.prototype, 'load').mockImplementation(async id => id === 'front' ? front : back);
    await mount();
    const frontPiece = piece({ id: 'front', definitionId: 'front', team, y: 150 });
    const backPiece = piece({ id: 'back', definitionId: 'back', y: 130 });
    await publish([frontPiece, backPiece]);
    const point = screen(150, 46, 130), grid = { ...frame([]), radius: 34 };
    // Prove the ray actually intersects the nearer body, using the real production picker.
    expect(core.pick(point, canvas.getBoundingClientRect(), camera, grid,
      [{ unitId: 'front', object: root(front) }, { unitId: 'back', object: root(back) }]))
      .toEqual({ kind: 'unit', unitId: 'front' });
    await publish([{ ...frontPiece, alive: false }, backPiece]);
    expect(root(front).visible).toBe(true); // still in its death action
    expect(listener.unitAt!(point)).toBe('back');
    canvas.pointer('pointermove', point); expect(controls.hover).toHaveBeenLastCalledWith('back');
    canvas.pointer('pointerdown', point); canvas.pointer('pointerup', point);
    expect(controls.select).toHaveBeenCalledExactlyOnceWith('back');
    await publish([{ ...frontPiece, alive: false }]);
    expect(listener.unitAt!(point)).toBeUndefined();
    canvas.pointer('pointermove', point); expect(controls.hover).toHaveBeenLastCalledWith(null);
    canvas.pointer('pointerdown', point); canvas.pointer('pointerup', point);
    expect(controls.select).toHaveBeenCalledTimes(1);
  });

  it('opens no browser menu over the game root or the canvas (links, text fields and selected text keep it), and right-click walks my legend', async () => {
    const app = new Canvas();
    vi.stubGlobal('document', { getElementById: (id: string) => (id === 'app' ? app : null), body: null, createElement: () => ({ getContext: () => null, dataset: {}, style: {}, classList: { add() {}, remove() {} }, append() {}, remove() {}, textContent: '' }) });
    const walk = vi.fn(() => true);
    await mount(null, { walk });
    await publish([], false);
    const menu = (target: { closest(selector: string): unknown } | null) => { const event = { target, preventDefault: vi.fn() }; return event; };
    const plain = menu({ closest: () => null }), link = menu({ closest: (selector: string) => (selector.includes('a[href]') ? {} : null) });
    app.fire('contextmenu', plain as unknown as Event); app.fire('contextmenu', link as unknown as Event);
    expect(plain.preventDefault).toHaveBeenCalled(); expect(link.preventDefault).not.toHaveBeenCalled();
    vi.stubGlobal('getSelection', () => ({ toString: () => '选中的字' }));
    const selected = menu({ closest: () => null });
    canvas.fire('contextmenu', selected as unknown as Event);
    expect(selected.preventDefault).not.toHaveBeenCalled();
    vi.stubGlobal('getSelection', () => ({ toString: () => '' }));
    const onCanvas = menu({ closest: () => null });
    canvas.fire('contextmenu', onCanvas as unknown as Event);
    expect(onCanvas.preventDefault).toHaveBeenCalled();
    // Right button on the board: my legend walks there, and the room is told in board cells.
    canvas.pointer('pointerdown', screen(100, 0, 100), 2);
    expect(walk).toHaveBeenCalledWith(expect.objectContaining({ scene: 'board', from: expect.any(Object), to: expect.any(Object) }));
    expect(controls.select).not.toHaveBeenCalled();
    mounted!.dispose(); mounted = undefined;
    expect(app.has('contextmenu')).toBe(false); expect(canvas.has('contextmenu')).toBe(false);
  });
});
