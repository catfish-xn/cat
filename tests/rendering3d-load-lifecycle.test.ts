import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardFeedListener, BoardFrame } from '../src/rendering/board-feed';
import type { Renderer3d } from '../src/rendering/three-mode/contract';
import type { LoadReport } from '../src/rendering/three-mode/model-warmup';
import type { ModelLease } from '../src/rendering3d';
import { SHOP_CATALOG_BY_COST } from '../src/simulation/match-rules';

/** Real mount, reader, preloader, cache, warm-up and reporting; only HTTP/GLB decoding/GPU are synthetic. */
describe('3D model warm-up and first-batch mount lifecycle', () => {
  let mounted: Renderer3d | undefined, listener: BoardFeedListener;
  let idle: (() => void)[], raf: Map<number, FrameRequestCallback>, nextRaf: number, wall: number, clock: number;
  let reads: string[], parses: string[], uploads: string[], compiles: string[];
  let manifest: { schemaVersion: 1; models: Record<string, { path: string; unitScale?: number }> };
  let renderer: typeof import('../src/rendering/three-mode/placeholder-renderer');
  let board: typeof import('../src/rendering/board-feed');
  let waitForParse: ((id: string) => Promise<void>) | undefined;
  let waitForCompile: (() => Promise<void>) | undefined;
  let gpu: { remove: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>; lose: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>; canvas: EventTarget }[];
  let shell: { dispose(): void } | undefined;
  let releases: { id: string; release: ReturnType<typeof vi.fn> }[];
  const report = () => (window as unknown as { __render3dLoad?: LoadReport }).__render3dLoad;
  const firstLines = () => vi.mocked(console.info).mock.calls.filter(([message]) => String(message).startsWith('[3D] 首批'));
  const frame: BoardFrame = { rows: 4, columns: 4, hexRadius: 34, origin: { x: 50, y: 50 }, bench: [], dragging: null, fighting: false,
    pieces: [{ id: 'a', definitionId: 'toy', team: 'player', starLevel: 1, x: 150, y: 130, alive: true, visible: true }] };
  async function flush() { for (let i = 0; i < 60; i++) await Promise.resolve(); }
  async function stepIdle() { expect(idle.length).toBeGreaterThan(0); idle.shift()!(); await flush(); }
  async function draw() { wall += 16; const pending = [...raf.values()]; raf.clear(); pending.forEach(cb => cb(wall)); await flush(); }

  beforeEach(async () => {
    vi.resetModules(); vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    idle = []; raf = new Map(); nextRaf = 0; wall = 0; clock = 0;
    reads = []; parses = []; uploads = []; compiles = []; waitForParse = undefined; waitForCompile = undefined;
    gpu = []; releases = [];
    manifest = { schemaVersion: 1, models: {} };
    // In browsers window === globalThis; preserve that identity for the public timing hook.
    vi.stubGlobal('window', globalThis); vi.stubGlobal('__render3dLoad', undefined); vi.stubGlobal('indexedDB', undefined);
    browserMode('active');
    vi.stubGlobal('requestIdleCallback', (step: () => void) => { idle.push(step); return idle.length; });
    vi.stubGlobal('requestAnimationFrame', (step: FrameRequestCallback) => { raf.set(++nextRaf, step); return nextRaf; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => raf.delete(id));
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/manifest.json')) return Response.json(manifest);
      if (url.endsWith('/precache.json')) return Response.json({ schemaVersion: 1, files: [] });
      if (url.endsWith('/packs.json')) return new Response('', { status: 404 });
      if (url.endsWith('.glb')) { const id = url.split('/').at(-1)!.slice(0, -4); reads.push(id); clock += 7; return new Response(id); }
      throw new Error(`Unexpected synthetic request: ${url}`);
    }));
    vi.doMock('three', async original => ({ ...await original<typeof import('three')>(), WebGLRenderer: class {
      canvas = new EventTarget();
      state = { remove: vi.fn(), dispose: vi.fn(), lose: vi.fn(), render: vi.fn(), canvas: this.canvas };
      constructor() { gpu.push(this.state); }
      domElement = { className: '', style: {}, addEventListener: this.canvas.addEventListener.bind(this.canvas),
        removeEventListener: this.canvas.removeEventListener.bind(this.canvas), remove: this.state.remove,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
      setPixelRatio() {} setSize() {} dispose() { this.state.dispose(); } forceContextLoss() { this.state.lose(); }
      render(scene: import('three').Object3D) { this.state.render(scene); clock += 5; }
      initTexture(texture: import('three').Texture) { uploads.push(texture.name); }
      async compileAsync(scene: import('three').Object3D) { compiles.push(scene.name); await waitForCompile?.(); clock += 3; }
    } }));
    const three = await import('three'), { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(async data => {
      const id = new TextDecoder().decode(data as ArrayBuffer); parses.push(id); await waitForParse?.(id); clock += 11;
      const scene = new three.Group(), texture = new three.Texture(); scene.name = id; texture.name = id;
      scene.add(new three.Mesh(new three.BoxGeometry(20, 40, 20), new three.MeshBasicMaterial({ map: texture })));
      return { scene, animations: [] } as never;
    });
    const { ModelCache } = await import('../src/rendering3d/assets');
    const load = ModelCache.prototype.load;
    vi.spyOn(ModelCache.prototype, 'load').mockImplementation(async function (this: InstanceType<typeof ModelCache>, id: string): Promise<ModelLease> {
      const lease = await load.call(this, id), release = vi.fn(lease.release);
      releases.push({ id, release });
      return { ...lease, release };
    });
    renderer = await import('../src/rendering/three-mode/placeholder-renderer');
    board = await import('../src/rendering/board-feed'); board.setBoardLegends({ me: 'mine', opponent: 'theirs' });
    renderer.useBoardFeed({ ...board.boardFeed, subscribe(next) { listener = next; return board.boardFeed.subscribe(next); } });
  });
  afterEach(async () => {
    shell?.dispose(); shell = undefined;
    mounted?.dispose(); mounted = undefined; await flush(); vi.clearAllTimers(); vi.useRealTimers();
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.doUnmock('three'); vi.resetModules();
  });

  it('remounts the same layer on context restoration, rereads stored models and discards a stale mount completion', async () => {
    // IndexedDB is substituted at its public store seam; preloading, reading, parsing, caching and mounting remain real.
    const preload = await import('../src/rendering/three-mode/asset-preload');
    const key = 'https://example.test/synthetic/|toy.glb', sha256 = '0'.repeat(64);
    const get = vi.fn(async (requested: string) => requested === key ? { key, sha256, blob: new Blob(['toy']) } : undefined);
    const open = vi.spyOn(preload, 'openAssetStore').mockResolvedValue({ persistent: true, get,
      put: vi.fn(), delete: vi.fn(), keys: async () => [key] });
    const fetcher = vi.mocked(fetch), fallback = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (input, init) => String(input).endsWith('/precache.json')
      ? Response.json({ schemaVersion: 1, files: [{ path: 'toy.glb', bytes: 3, sha256 }] }) : fallback(input, init));
    manifest.models = { toy: { path: 'toy.glb' } };
    class Node extends EventTarget {
      dataset: Record<string, string> = {}; style = {}; children: unknown[] = [];
      clientWidth = 800; clientHeight = 600; textContent = ''; className = ''; hidden = false;
      parentElement: Node | null = null;
      append(...children: unknown[]) { for (const child of children) {
        this.children.push(child); if (child instanceof Node) child.parentElement = this;
      } }
      remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); }
      getContext() { return null; }
      getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
    }
    const host = new Node(), observe = vi.fn(), disconnect = vi.fn();
    vi.stubGlobal('location', { href: 'https://example.test/cat/', search: '' });
    vi.stubGlobal('history', { state: null, replaceState: vi.fn() });
    vi.stubGlobal('document', { body: { dataset: { m6Mode: 'active' } }, getElementById: () => null, createElement: () => new Node() });
    vi.stubGlobal('ResizeObserver', class { observe = observe; disconnect = disconnect; });
    const realMount = renderer.mountRenderer3d;
    let finishOld!: (value: Renderer3d) => void, stale: Renderer3d | undefined;
    const late = new Promise<Renderer3d>(resolve => { finishOld = resolve; });
    const mountSpy = vi.spyOn(renderer, 'mountRenderer3d').mockImplementation(async (layer, options) => {
      const result = await realMount(layer, options);
      if (gpu.length === 2) { stale = { ...result, detail: 'stale generation' }; return late; }
      return result;
    });
    const { mountThreeMode } = await import('../src/rendering/three-mode/three-loader');
    shell = mountThreeMode(host as unknown as HTMLElement, '?render=3d&assets3d=/synthetic/');
    await vi.dynamicImportSettled(); await flush();
    const layer = host.children[0] as Node;
    expect(layer.dataset.state).toBe('assets');
    board.publishBoardFrame(() => frame);
    await vi.waitFor(() => expect(parses).toEqual(['toy'])); await flush(); await draw();
    expect(parses).toEqual(['toy']); expect(gpu[0].render).toHaveBeenCalled();
    const storedReads = get.mock.calls.length;
    gpu[0].canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(gpu[0].remove).toHaveBeenCalledTimes(1); expect(layer.dataset.state).toBe('loading');
    await vi.dynamicImportSettled(); await flush();
    expect(stale).toBeDefined();
    // Restore again while generation two's mount promise is still pending.
    gpu[1].canvas.dispatchEvent(new Event('webglcontextrestored'));
    await vi.dynamicImportSettled(); await flush();
    expect(mountSpy).toHaveBeenCalledTimes(3); expect(open).toHaveBeenCalledTimes(3);
    for (const [target] of mountSpy.mock.calls) expect(target).toBe(layer);
    expect(host.children).toEqual([layer]); expect(layer.dataset.state).toBe('assets');
    const status = (layer.children[0] as Node).children[0] as Node, currentLabel = status.textContent;
    const observations = observe.mock.calls.length;
    finishOld(stale!); await flush();
    expect(gpu[1].remove).toHaveBeenCalledTimes(1); expect(gpu[1].dispose).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledTimes(observations); expect(status.textContent).toBe(currentLabel);
    expect(gpu[2].dispose).not.toHaveBeenCalled();
    board.publishBoardFrame(() => frame);
    await vi.waitFor(() => expect(parses).toEqual(['toy', 'toy'])); await flush(); await draw();
    expect(get.mock.calls.length).toBeGreaterThan(storedReads);
    expect(get.mock.calls.every(([requested]) => requested === key)).toBe(true);
    expect(parses).toEqual(['toy', 'toy']); expect(reads).toEqual([]);
    expect(gpu[2].render).toHaveBeenCalled();
    const scene = gpu[2].render.mock.calls.at(-1)![0] as import('three').Object3D;
    expect(scene.getObjectByName('toy')).toBeDefined();
    expect(layer.dataset.state).toBe('assets');
  });
  async function mount(ids: string[], warm: string[] = [], scaled = false) {
    manifest.models = Object.fromEntries(ids.map(id => [id, { path: `${id}.glb`, ...(scaled ? { unitScale: 1 } : {}) }]));
    renderer.useWarmModels(warm);
    mounted = await renderer.mountRenderer3d({ clientWidth: 800, clientHeight: 600, append() {} } as unknown as HTMLElement, { assetBase: '/synthetic/' });
    await flush(); expect(mounted.status).toBe('assets');
  }
  async function leaveGame() {
    // OnlineApplication.backToLobby/syncMode publishes these browser-facing signals.
    // main.ts keeps the renderer mounted for the lifetime of the page.
    board.setBoardLegends(null);
    browserMode('online-lobby');
    listener.frame({ ...frame, pieces: [] }); await draw();
  }
  function browserMode(mode: 'online-lobby' | 'active') {
    vi.stubGlobal('document', { body: { dataset: { m6Mode: mode === 'active' ? 'active' : 'startup', onlineMode: mode } }, getElementById: () => null,
      createElement: () => ({ width: 0, height: 0, dataset: {}, style: {}, remove() {}, getContext: () => null }) });
  }

  it.each(['board', 'bench', 'scout', 'carousel'] as const)('keeps a model referenced by the real mounted %s consumer across idle sweeps', async consumer => {
    const { ModelCache } = await import('../src/rendering3d/assets');
    const evict = vi.spyOn(ModelCache.prototype, 'evict');
    await mount(['toy']); listener.frame({ ...frame, pieces: [] });
    if (consumer === 'board') listener.frame(frame);
    if (consumer === 'bench') listener.frame({ ...frame, bench: [{ x: 40, y: 650 }], pieces: [{ ...frame.pieces[0], x: 40, y: 650 }] });
    if (consumer === 'scout') listener.scout!({ seatId: 'other', name: 'Synthetic', board: {
      units: [{ definitionId: 'toy', starLevel: 1, cell: { col: 2, row: 2 }, items: [] }], bench: [], looseItems: [], augments: [],
    } });
    if (consumer === 'carousel') listener.carousel!({ id: 'synthetic', slots: [{ slot: 0, definitionId: 'toy', starLevel: 1,
      items: [], pickedBy: null, takable: false, pending: false }], seats: [], elapsedMs: 0, at: clock });
    await flush(); expect(parses).toEqual(['toy']);
    clock += 240_000; wall += 240_000; await draw();
    expect(evict).not.toHaveBeenCalledWith('toy'); expect(parses).toEqual(['toy']);
    listener.frame({ ...frame, pieces: [] }); listener.scout!(null); listener.carousel!(null); await flush();
    clock += 120_000; wall += 120_000; await draw();
    expect(evict.mock.calls.filter(([id]) => id === 'toy')).toHaveLength(1);
  });

  it('keeps a current shop warm hint resident after warm-up and the 120-second idle limit', async () => {
    const { ModelCache } = await import('../src/rendering3d/assets');
    const evict = vi.spyOn(ModelCache.prototype, 'evict');
    board.setBoardWarmHints(['shop']); await mount(['shop']); listener.frame({ ...frame, pieces: [] });
    await stepIdle(); expect(parses).toEqual(['shop']);
    clock += 120_000; wall += 120_000; await draw();
    // The hint remains current: selling an unrelated board piece must not evict the model offered in the shop.
    expect(evict).not.toHaveBeenCalledWith('shop');
  });

  it('queues changed hints only after preload and in a match, preserving hint order and cancelling on leave', async () => {
    let finish!: () => void;
    const gate = new Promise<void>(resolve => { finish = resolve; });
    const { AssetPreloader } = await import('../src/rendering/three-mode/asset-preload');
    const start = AssetPreloader.prototype.start;
    vi.spyOn(AssetPreloader.prototype, 'start').mockImplementation(function (this: InstanceType<typeof AssetPreloader>) {
      return gate.then(() => start.call(this));
    });
    browserMode('online-lobby'); board.setBoardWarmHints(['shop', 'opponent', 'scout']);
    await mount(['shop', 'opponent', 'scout', 'next']);
    const empty = { ...frame, pieces: [] };
    listener.frame(empty); expect(idle).toHaveLength(0);
    browserMode('active'); listener.frame(empty); expect(idle).toHaveLength(0);
    finish(); await flush(); listener.frame(empty);
    await stepIdle(); await stepIdle(); await stepIdle();
    expect(reads).toEqual(['shop', 'opponent', 'scout']);
    listener.frame(empty); expect(idle).toHaveLength(0);
    board.setBoardWarmHints(['next']); listener.frame(empty);
    board.setBoardWarmHints([]); await leaveGame();
    if (idle.length) await stepIdle();
    expect(reads).toEqual(['shop', 'opponent', 'scout']);
    board.setBoardWarmHints(['next']); listener.frame(empty); expect(idle).toHaveLength(0);
    browserMode('active'); listener.frame(empty); await stepIdle();
    expect(reads).toEqual(['shop', 'opponent', 'scout', 'next']);
  });

  it.each(['complete', 'combat interruption', 'mount races warmup'] as const)('shares only completed envelopes with mounting: %s', async situation => {
    const fit = await import('../src/rendering/three-mode/model-fit');
    let finish!: (envelope: import('../src/rendering/three-mode/model-fit').Envelope | null) => void;
    const sliced = vi.spyOn(fit, 'animationEnvelopeSliced').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const sync = vi.spyOn(fit, 'animationEnvelope').mockReturnValue({ radius: 91, ground: 0 });
    const fitted = vi.spyOn(fit, 'fitModel');
    await mount(['toy'], ['toy'], true); await stepIdle();
    expect(sliced).toHaveBeenCalledTimes(1); expect(sync).not.toHaveBeenCalled();
    if (situation === 'complete') { finish({ radius: 12, ground: 0 }); await flush(); }
    if (situation === 'combat interruption') {
      listener.frame({ ...frame, pieces: [], fighting: true });
      expect(sliced.mock.calls[0][2]!.stop!()).toBe(true);
      finish(null); await flush();
    }
    listener.frame(frame); await flush();
    const radius = situation === 'complete' ? 12 : 91;
    expect(fitted.mock.calls.at(-1)![1].envelopeRadius).toBe(radius);
    expect(sync).toHaveBeenCalledTimes(situation === 'complete' ? 0 : 1);
    if (situation === 'mount races warmup') { finish({ radius: 12, ground: 0 }); await flush(); }
    // A later lease must use the same cache entry; a late warm-up cannot overwrite the synchronous result.
    listener.frame({ ...frame, pieces: [] }); listener.frame({ ...frame, pieces: [{ ...frame.pieces[0], id: 'later' }] }); await flush();
    expect(fitted.mock.calls.at(-1)![1].envelopeRadius).toBe(radius);
    expect(sync).toHaveBeenCalledTimes(situation === 'complete' ? 0 : 1);
  });

  it('warms legends before cost 1–3, one read/parse/upload/compile at a time', async () => {
    const cheap = [SHOP_CATALOG_BY_COST[1][0], SHOP_CATALOG_BY_COST[2][0], SHOP_CATALOG_BY_COST[3][0]];
    const legends = ['little-legend-default', 'little-legend-mine', 'little-legend-theirs'];
    await mount([...legends, ...cheap, SHOP_CATALOG_BY_COST[4][0]],
      [...SHOP_CATALOG_BY_COST[1], ...SHOP_CATALOG_BY_COST[2], ...SHOP_CATALOG_BY_COST[3]]);
    expect(reads).toEqual([]);
    let finish!: () => void; waitForCompile = () => new Promise<void>(done => { finish = done; });
    await stepIdle(); expect(reads).toEqual([legends[0]]); expect(compiles).toEqual([legends[0]]); expect(idle).toHaveLength(0);
    finish(); waitForCompile = undefined; await flush();
    for (let i = 1; i < legends.length + cheap.length; i++) await stepIdle();
    expect(reads).toEqual([...legends, ...cheap]); expect(parses).toEqual(reads); expect(uploads).toEqual(reads); expect(compiles).toEqual(reads);
    expect(idle).toHaveLength(0);
  });

  it('does no warm-up in combat and continues the remaining queue after preparation resumes', async () => {
    await mount(['one', 'two'], ['one', 'two']);
    listener.frame({ ...frame, pieces: [], fighting: true }); await stepIdle(); expect(reads).toEqual([]);
    await vi.advanceTimersByTimeAsync(500); await stepIdle(); expect(reads).toEqual([]);
    listener.frame({ ...frame, pieces: [] }); await vi.advanceTimersByTimeAsync(500); await stepIdle(); expect(reads).toEqual(['one']);
    listener.frame({ ...frame, pieces: [], fighting: true }); await stepIdle(); expect(reads).toEqual(['one']);
    listener.frame({ ...frame, pieces: [] }); await vi.advanceTimersByTimeAsync(500); await stepIdle(); expect(reads).toEqual(['one', 'two']);
  });

  it('keeps the intentional lobby preload before the first match', async () => {
    browserMode('online-lobby');
    await mount(['one', 'two'], ['one', 'two']);
    await stepIdle(); await stepIdle();
    expect(reads).toEqual(['one', 'two']); expect(compiles).toEqual(reads);
    expect(report()).toBeUndefined(); expect(firstLines()).toHaveLength(0);
  });

  it('defers an upload when combat starts during parsing, then retries the cached model before the rest', async () => {
    await mount(['one', 'two'], ['one', 'two']);
    let finish!: () => void;
    waitForParse = () => new Promise<void>(done => { finish = done; });
    await stepIdle();
    listener.frame({ ...frame, pieces: [], fighting: true });
    waitForParse = undefined; finish(); await flush();
    expect(uploads).toEqual([]); expect(compiles).toEqual([]);
    expect(releases[0].release).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 10; i++) {
      expect(vi.getTimerCount()).toBe(1);
      await vi.advanceTimersByTimeAsync(499); expect(idle).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1); await stepIdle();
      expect(reads).toEqual(['one']); expect(uploads).toEqual([]);
    }
    listener.frame({ ...frame, pieces: [] });
    await vi.advanceTimersByTimeAsync(500); await stepIdle(); await stepIdle();
    expect(reads).toEqual(['one', 'two']); expect(parses).toEqual(reads);
    expect(uploads).toEqual(reads); expect(compiles).toEqual(reads);
    expect(releases).toHaveLength(3);
    for (const lease of releases) expect(lease.release).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0); expect(idle).toHaveLength(0);
  });

  it.each(['resolve', 'reject'] as const)('removes the old canvas immediately, waits for compile to %s and releases its lease across a remount', async outcome => {
    await mount(['one', 'two'], ['one', 'two']);
    let finish!: () => void, fail!: (error: Error) => void;
    waitForCompile = () => new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
    await stepIdle(); expect(compiles).toEqual(['one']);
    const old = gpu[0], oldLease = releases[0];
    expect(oldLease.release).not.toHaveBeenCalled();
    expect(() => mounted!.dispose()).not.toThrow(); mounted = undefined;
    expect(old.remove).toHaveBeenCalledTimes(1);
    expect(old.dispose).not.toHaveBeenCalled(); expect(old.lose).not.toHaveBeenCalled();
    expect(oldLease.release).not.toHaveBeenCalled();
    waitForCompile = undefined;
    await mount(['second'], ['second']); await stepIdle();
    expect(compiles).toEqual(['one', 'second']);
    if (outcome === 'resolve') finish(); else fail(new Error('synthetic compile failure'));
    await flush();
    expect(oldLease.release).toHaveBeenCalledTimes(1);
    expect(old.dispose).toHaveBeenCalledTimes(1); expect(old.lose).toHaveBeenCalledTimes(1);
    expect(gpu[1].dispose).not.toHaveBeenCalled(); expect(gpu[1].lose).not.toHaveBeenCalled();
    listener.frame({ ...frame, pieces: [{ ...frame.pieces[0], definitionId: 'second' }] }); await flush(); await draw();
    expect(report()).toMatchObject({ pieces: 1, shown: 1 });
    expect(reads).toEqual(['one', 'second']); expect(idle).toHaveLength(0);
  });

  it.each(['queued', 'parsing'] as const)('destroying the renderer cancels %s warm-up and sends no more requests', async phase => {
    await mount(['one', 'two'], ['one', 'two']);
    let finish!: () => void;
    if (phase === 'parsing') {
      waitForParse = () => new Promise<void>(done => { finish = done; });
      await stepIdle(); expect(parses).toEqual(['one']);
    }
    mounted!.dispose(); mounted = undefined;
    if (phase === 'parsing') finish(); else await stepIdle();
    await flush(); await vi.advanceTimersByTimeAsync(2000);
    expect(reads).toEqual(phase === 'parsing' ? ['one'] : []); expect(compiles).toEqual([]); expect(uploads).toEqual([]); expect(idle).toHaveLength(0);
  });

  it('publishes one window report and one console line after the first drawing frame, counting a shared model once', async () => {
    await mount(['toy']);
    listener.frame({ ...frame, pieces: [frame.pieces[0], { ...frame.pieces[0], id: 'b', x: 200 }] }); await flush();
    expect(report()).toBeUndefined(); expect(firstLines()).toHaveLength(0);
    await draw();
    expect(report()).toEqual({ pieces: 2, shown: 2, wallMs: 18, readMs: 7, parseMs: 11, uploadMs: 5, warmed: 0 });
    expect(firstLines()).toHaveLength(1);
    expect(firstLines()[0][0]).toBe('[3D] 首批 2/2 个棋子模型 18 ms 后出现；各模型合计：读取 7 ms，解析 11 ms，首帧上传与编译 5 ms；其中 0 个已预热');
    listener.frame(frame); await draw(); await draw(); expect(firstLines()).toHaveLength(1);
    expect(reads).toEqual(['toy']); expect(parses).toEqual(['toy']);
  });

  it('a new renderer entering the game gets a fresh report and logs its first batch once', async () => {
    await mount(['toy']); listener.frame(frame); await flush(); await draw();
    const previous = report(); expect(firstLines()).toHaveLength(1);
    mounted!.dispose(); mounted = undefined;
    await mount(['toy']); expect(report()).toBeUndefined();
    listener.frame({ ...frame, pieces: [{ ...frame.pieces[0], id: 'next-game' }] }); await flush(); await draw();
    expect(report()).not.toBe(previous); expect(report()).toMatchObject({ pieces: 1, shown: 1, readMs: 7, parseMs: 11, uploadMs: 5 });
    await draw(); expect(firstLines()).toHaveLength(2);
  });

  it('leaving active clears queued warm-up and re-entering active queues only the remaining models', async () => {
    await mount(['one', 'two'], ['one', 'two']); await stepIdle(); expect(reads).toEqual(['one']);
    await leaveGame();
    // A callback already queued before leaving is allowed to run, but must not start a read.
    if (idle.length) await stepIdle();
    await vi.advanceTimersByTimeAsync(2000); expect(reads).toEqual(['one']);
    browserMode('active'); await draw(); await stepIdle();
    expect(reads).toEqual(['one', 'two']); expect(compiles).toEqual(reads);
    expect(idle).toHaveLength(0);
  });

  it('resets the report before a second batch delivered after the mode edge has been observed', async () => {
    await mount(['toy', 'second']); listener.frame(frame); await flush(); await draw();
    const previous = structuredClone(report()); expect(firstLines()).toHaveLength(1);
    await leaveGame(); clock += 5000;
    browserMode('active'); await draw(); expect(report()).toBeUndefined();
    listener.frame({ ...frame, pieces: [{ ...frame.pieces[0], id: 'second-a', definitionId: 'second' },
      { ...frame.pieces[0], id: 'second-b', definitionId: 'second' }] });
    await flush(); await draw();
    expect(report()).toEqual({ pieces: 2, shown: 2, wallMs: 18, readMs: 7, parseMs: 11, uploadMs: 5, warmed: 0 });
    expect(previous).toEqual({ pieces: 1, shown: 1, wallMs: 18, readMs: 7, parseMs: 11, uploadMs: 5, warmed: 0 });
    expect(firstLines()).toHaveLength(2);
    expect(firstLines()[1][0]).toContain('2/2');
    await draw(); expect(firstLines()).toHaveLength(2);
  });

  it('entering another match on the same page resets first-batch timing and logs the new batch once', async () => {
    await mount(['toy', 'second']); listener.frame(frame); await flush(); await draw();
    const previous = report(); expect(firstLines()).toHaveLength(1);
    await leaveGame();
    browserMode('active');
    board.setBoardLegends({ me: 'mine', opponent: 'theirs' });
    // BoardScene and the renderer have separate RAF callbacks. A board frame may arrive before followMatch runs.
    const next = { ...frame, pieces: [{ ...frame.pieces[0], id: 'next-game', definitionId: 'second' }] };
    listener.frame(next);
    await flush(); await draw();
    // A later board frame must not leave the already attached first batch unreported forever.
    listener.frame(next); await draw();
    expect(reads).toEqual(['toy', 'second']); expect(firstLines()).toHaveLength(2);
    expect(report()).not.toBe(previous);
    expect(report()).toMatchObject({ pieces: 1, shown: 1, readMs: 7, parseMs: 11, uploadMs: 5 });
    await draw(); expect(firstLines()).toHaveLength(2);
  });
});
