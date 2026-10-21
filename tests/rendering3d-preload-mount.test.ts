import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardFeedListener, BoardFrame } from '../src/rendering/board-feed';
import type { Renderer3d } from '../src/rendering/three-mode/contract';

/**
 * The real mount path (mountRenderer3d → openModels → openAssetStore → AssetPreloader) with IndexedDB unusable.
 * Only the GPU, the network and GLB parsing are substituted; the asset bytes are synthetic.
 */
const ROOT = 'https://assets.test/a3d/';
const BODY = 'synthetic-model-bytes';
const SHA = '0'.repeat(64);

describe('3D mount keeps assets when IndexedDB is unusable', () => {
  let mounted: Renderer3d | undefined, listener: BoardFeedListener | undefined, requests: string[], parsed: string[];
  beforeEach(() => {
    vi.resetModules(); requests = []; parsed = [];
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input); requests.push(url.slice(ROOT.length));
      if (url === `${ROOT}manifest.json`) return Response.json({ schemaVersion: 1, models: { sample: { path: 'models/sample/model.glb' } } });
      if (url === `${ROOT}precache.json`) return Response.json({ schemaVersion: 1, files: [{ path: 'models/sample/model.glb', bytes: BODY.length, sha256: SHA }] });
      if (url === `${ROOT}models/sample/model.glb`) return new Response(BODY);
      return new Response('missing', { status: 404 });
    }));
    // Synthetic hash: the list's sha256 matches the synthetic body.
    vi.stubGlobal('crypto', { subtle: { digest: async () => new Uint8Array(32).buffer } });
    vi.doMock('three', async importOriginal => ({
      ...await importOriginal<typeof import('three')>(),
      WebGLRenderer: class {
        domElement = { className: '', style: { cursor: '' }, addEventListener() {}, removeEventListener() {}, remove() {},
          getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
        setPixelRatio(): void {} setSize(): void {} render(): void {} dispose(): void {} forceContextLoss(): void {}
      },
    }));
  });
  afterEach(() => {
    mounted?.dispose(); mounted = undefined; listener = undefined;
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.doUnmock('three'); vi.resetModules();
  });

  async function mountWith(indexedDB: unknown): Promise<string[]> {
    vi.stubGlobal('indexedDB', indexedDB);
    const three = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(async (data) => {
      parsed.push(new TextDecoder().decode(data as ArrayBuffer));
      return { scene: new three.Group(), animations: [] } as never;
    });
    const renderer = await import('../src/rendering/three-mode/placeholder-renderer');
    const progress: string[] = [];
    let finished!: () => void;
    const done = new Promise<void>(resolve => { finished = resolve; });
    renderer.useAssetProgress(text => { progress.push(text); if (text.startsWith('素材已全部')) finished(); });
    renderer.useBoardFeed({ subscribe(next) { listener = next; return () => {}; }, controls: () => null as never });
    mounted = await renderer.mountRenderer3d({ clientWidth: 800, clientHeight: 600, append() {} } as unknown as HTMLElement, { assetBase: ROOT });
    await done;
    return progress;
  }
  const frame: BoardFrame = { rows: 4, columns: 4, hexRadius: 34, origin: { x: 50, y: 50 }, bench: [], dragging: null, fighting: false,
    pieces: [{ id: 'u1', definitionId: 'sample', team: 'player', starLevel: 1, x: 150, y: 130, alive: true, visible: true }] };

  const failingOpen = { open: () => {
    const request: Record<string, unknown> = { error: new Error('denied') };
    queueMicrotask(() => (request.onerror as () => void)());
    return request;
  } };

  it.each([['missing', undefined], ['failing to open', failingOpen]])('IndexedDB %s: stays on assets, downloads once, reads the model from the preload', async (_, idb) => {
    const progress = await mountWith(idb);
    expect(mounted!.status).toBe('assets');
    expect(progress.at(-1)).toMatch(/^素材已全部下载（1 个文件，本次下载 /); // not "缓存到本地": nothing persisted
    listener!.frame(frame);
    await vi.waitFor(() => expect(parsed).toEqual([BODY]));
    expect(requests.filter(path => path.endsWith('.glb'))).toEqual(['models/sample/model.glb']);
  });
});

