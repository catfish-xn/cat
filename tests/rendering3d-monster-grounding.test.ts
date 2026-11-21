import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BoardFeedListener, BoardFrame } from '../src/rendering/board-feed';
import type { Renderer3d } from '../src/rendering/three-mode/contract';

vi.mock('three', async original => ({
  ...await original<typeof import('three')>(),
  WebGLRenderer: class {
    domElement = { className: '', style: { cursor: '' }, addEventListener() {}, removeEventListener() {}, remove() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
    setPixelRatio() {} setSize() {} render() {} dispose() {} forceContextLoss() {} initTexture() {}
    async compileAsync() {}
  },
}));
vi.mock('../src/rendering/three-mode/model-fit', async original => {
  const actual = await original<typeof import('../src/rendering/three-mode/model-fit')>();
  return { ...actual, fitModel: vi.fn(actual.fitModel),
  animationEnvelope: vi.fn(() => ({ radius: 1, ground: 0, feet: 0 })),
  animationEnvelopeSliced: vi.fn(async () => ({ radius: 1, ground: 0, feet: 0 })),
  };
});
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { animationEnvelope, animationEnvelopeSliced, fitModel } from '../src/rendering/three-mode/model-fit';
import * as renderer from '../src/rendering/three-mode/placeholder-renderer';

let mounted: Renderer3d | undefined, listener: BoardFeedListener;
const ROOT = 'https://assets.test/grounding/', BODY = 'model';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', { devicePixelRatio: 1 }); vi.stubGlobal('indexedDB', undefined);
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('crypto', { subtle: { digest: async () => new Uint8Array(32).buffer } });
  vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(async () => {
    const scene = new Group(); scene.add(new Mesh(new BoxGeometry(2, 4, 2), new MeshBasicMaterial()));
    return { scene, animations: [] } as never;
  });
});
afterEach(() => { mounted?.dispose(); mounted = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
afterAll(() => { vi.doUnmock('three'); vi.doUnmock('../src/rendering/three-mode/model-fit'); vi.resetModules(); });

it.each(['pve-rift-herald', 'pve-elder-dragon'])('%s first mount uses slices or skips the unused envelope entirely', async id => {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === `${ROOT}manifest.json`) return Response.json({ schemaVersion: 1, models: { [id]: { path: 'model.glb', unitScale: 1 } } });
    if (url === `${ROOT}precache.json`) return Response.json({ schemaVersion: 1, files: [{ path: 'model.glb', bytes: BODY.length, sha256: '0'.repeat(64) }] });
    return url.endsWith('model.glb') ? new Response(BODY) : new Response('missing', { status: 404 });
  });
  let done!: () => void;
  const preloaded = new Promise<void>(resolve => { done = resolve; });
  renderer.useAssetProgress(text => { if (text.startsWith('素材已全部')) done(); });
  renderer.useBoardFeed({ subscribe(next) { listener = next; return () => {}; }, controls: () => null as never });
  mounted = await renderer.mountRenderer3d({ clientWidth: 800, clientHeight: 600, append() {} } as unknown as HTMLElement, { assetBase: ROOT });
  await preloaded;
  const frame: BoardFrame = { rows: 4, columns: 4, hexRadius: 34, origin: { x: 50, y: 50 }, bench: [], dragging: null, fighting: false,
    pieces: [{ id: 'monster', definitionId: id, team: 'enemy', starLevel: 1, x: 150, y: 130, alive: true, visible: true }] };
  listener.frame(frame);
  await vi.waitFor(() => expect(fitModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ height: Infinity, unitScale: 1 })));
  expect(animationEnvelope).not.toHaveBeenCalled();
  if (id === 'pve-elder-dragon') expect(animationEnvelopeSliced).not.toHaveBeenCalled();
  else {
    expect(animationEnvelopeSliced).toHaveBeenCalled();
    expect(vi.mocked(animationEnvelopeSliced).mock.calls[0]![2]?.budgetMs).toBe(3);
  }
});
