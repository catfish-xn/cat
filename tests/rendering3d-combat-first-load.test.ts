import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BoardFeedListener, BoardFrame, BoardPiece } from '../src/rendering/board-feed';
import type { Renderer3d } from '../src/rendering/three-mode/contract';

// A champion whose model first arrives during a shown combat is measured then (sliced, before it replaces the stand-in
// pawn) and fitted with its envelope, instead of its bind box until the next preparation (playtest 11-25: such pieces
// stood up to 0.4 cell off their cell for the whole combat).
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
const ROOT = 'https://assets.test/combat-first-load/', BODY = 'model', ID = 'twitch';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', { devicePixelRatio: 1 }); vi.stubGlobal('indexedDB', undefined);
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('crypto', { subtle: { digest: async () => new Uint8Array(32).buffer } });
  vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(async () => {
    const scene = new Group(); scene.add(new Mesh(new BoxGeometry(2, 4, 2), new MeshBasicMaterial()));
    return { scene, animations: [] } as never;
  });
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === `${ROOT}manifest.json`) return Response.json({ schemaVersion: 1, models: { [ID]: { path: 'model.glb', unitScale: 1 } } });
    if (url === `${ROOT}precache.json`) return Response.json({ schemaVersion: 1, files: [{ path: 'model.glb', bytes: BODY.length, sha256: '0'.repeat(64) }] });
    return url.endsWith('model.glb') ? new Response(BODY) : new Response('missing', { status: 404 });
  });
});
afterEach(() => { mounted?.dispose(); mounted = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
afterAll(() => { vi.doUnmock('three'); vi.doUnmock('../src/rendering/three-mode/model-fit'); vi.resetModules(); });

const mount = async () => {
  let done!: () => void;
  const preloaded = new Promise<void>(resolve => { done = resolve; });
  renderer.useAssetProgress(text => { if (text.startsWith('素材已全部')) done(); });
  renderer.useBoardFeed({ subscribe(next) { listener = next; return () => {}; }, controls: () => null as never });
  mounted = await renderer.mountRenderer3d({ clientWidth: 800, clientHeight: 600, append() {} } as unknown as HTMLElement, { assetBase: ROOT });
  await preloaded;
};
const piece = (id: string, x: number): BoardPiece => ({ id, definitionId: ID, team: 'enemy', starLevel: 1, x, y: 130, alive: true, visible: true });
const frame = (fighting: boolean, pieces: BoardPiece[]): BoardFrame =>
  ({ rows: 4, columns: 4, hexRadius: 34, origin: { x: 50, y: 50 }, bench: [], dragging: null, fighting, pieces });
const championFits = () => vi.mocked(fitModel).mock.calls.filter(([, options]) => options.unitScale === 1 && options.height !== Infinity);

it('a champion first loaded mid-combat is measured in frame-spaced slices and fitted with its envelope at once', async () => {
  await mount();
  listener.frame(frame(true, [piece('a', 150), piece('b', 220)]));
  await vi.waitFor(() => expect(championFits()).toHaveLength(2));
  // Both pieces fitted with the measured envelope (not the bind box), from one shared measurement, never a long task.
  for (const [, options] of championFits()) expect(options).toMatchObject({ envelopeRadius: 1, ground: 0, feet: 0 });
  expect(animationEnvelope).not.toHaveBeenCalled();
  expect(animationEnvelopeSliced).toHaveBeenCalledTimes(1);
  const options = vi.mocked(animationEnvelopeSliced).mock.calls[0]![2]!;
  expect(options.budgetMs).toBe(2);
  // Slices are spaced about a frame apart (a timeout, so a hidden page still finishes).
  vi.useFakeTimers();
  try {
    let resumed = false; void options.pause!().then(() => { resumed = true; });
    await vi.advanceTimersByTimeAsync(10); expect(resumed).toBe(false);
    await vi.advanceTimersByTimeAsync(10); expect(resumed).toBe(true);
  } finally { vi.useRealTimers(); }
  // Already calibrated: the next preparation does not re-attach them.
  listener.frame(frame(false, [piece('a', 150), piece('b', 220)]));
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(championFits()).toHaveLength(2);
});

it('a measurement that cannot finish still shows the model from its bind box and re-fits it at the next preparation', async () => {
  vi.mocked(animationEnvelopeSliced).mockResolvedValueOnce(null);
  await mount();
  listener.frame(frame(true, [piece('a', 150)]));
  await vi.waitFor(() => expect(championFits()).toHaveLength(1));
  expect(championFits()[0]![1]).toMatchObject({ envelopeRadius: undefined, feet: null });
  listener.frame(frame(false, [piece('a', 150)]));
  await vi.waitFor(() => expect(championFits()).toHaveLength(2));
  expect(championFits()[1]![1]).toMatchObject({ envelopeRadius: 1, ground: 0, feet: 0 });
});
