import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BoardFeedListener, BoardFrame, BoardPiece, BoardWarmHints } from '../src/rendering/board-feed';
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
// This browser's envelope store (envelope-store.ts), as a map the tests fill and read.
const store = vi.hoisted(() => ({ stored: new Map<string, unknown>(), kept: [] as [string, string, unknown][], failing: false, hanging: false }));
vi.mock('../src/rendering/three-mode/envelope-store', async original => ({
  ...await original<typeof import('../src/rendering/three-mode/envelope-store')>(),
  openEnvelopeStore: async () => ({
    load: async (models: ReadonlyMap<string, string>) => {
      if (store.hanging) return new Promise<never>(() => {});
      if (store.failing) throw new Error('store unavailable');
      return new Map([...models].filter(([id, sha]) => store.stored.has(`${id}|${sha}`)).map(([id, sha]) => [id, store.stored.get(`${id}|${sha}`)]));
    },
    keep: (id: string, sha: string, envelope: unknown) => { if (store.failing) throw new Error('quota'); store.kept.push([id, sha, envelope]); },
  }),
}));
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { animationEnvelope, animationEnvelopeSliced, fitModel } from '../src/rendering/three-mode/model-fit';
import { envelopeSource } from '../src/rendering/three-mode/envelope-store';
import * as renderer from '../src/rendering/three-mode/placeholder-renderer';

let mounted: Renderer3d | undefined, listener: BoardFeedListener;
const ROOT = 'https://assets.test/combat-first-load/', BODY = 'model', ID = 'twitch';
/** The manifest's models (each its own file); the fetch log shows which model files were read, in order. */
let models: string[] = [ID];
/** Extra manifest fields of every model entry (clip settings). */
let entryExtra: Record<string, unknown> = {};
/** The key part the renderer must use for a model: its file sha256 and its manifest entry's clip settings. */
const sourceOf = (id: string) => envelopeSource(SHA, { path: id === ID ? 'model.glb' : `${id}.glb`, ...entryExtra });
const glbReads: string[] = [];
const SHA = '0'.repeat(64);
beforeEach(() => {
  vi.clearAllMocks(); store.stored.clear(); store.kept.length = 0; store.failing = false; store.hanging = false; models = [ID]; entryExtra = {};
  vi.mocked(animationEnvelopeSliced).mockImplementation(async () => ({ radius: 1, ground: 0, feet: 0 }));
  vi.stubGlobal('window', { devicePixelRatio: 1 }); vi.stubGlobal('indexedDB', undefined);
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('crypto', { subtle: { digest: async () => new Uint8Array(32).buffer } });
  vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(async () => {
    const scene = new Group(); scene.add(new Mesh(new BoxGeometry(2, 4, 2), new MeshBasicMaterial()));
    return { scene, animations: [] } as never;
  });
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input);
    const path = (id: string) => id === ID ? 'model.glb' : `${id}.glb`;
    if (url === `${ROOT}manifest.json`) return Response.json({ schemaVersion: 1, models: Object.fromEntries(models.map(id => [id, { path: path(id), unitScale: 1, ...entryExtra }])) });
    if (url === `${ROOT}precache.json`) return Response.json({ schemaVersion: 1, files: models.map(id => ({ path: path(id), bytes: BODY.length, sha256: SHA })) });
    if (url.endsWith('.glb')) { glbReads.push(url.slice(ROOT.length)); return new Response(BODY); }
    return new Response('missing', { status: 404 });
  });
});
afterEach(() => { mounted?.dispose(); mounted = undefined; hints = undefined; glbReads.length = 0; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
afterAll(() => { vi.doUnmock('three'); vi.doUnmock('../src/rendering/three-mode/model-fit'); vi.doUnmock('../src/rendering/three-mode/envelope-store'); vi.resetModules(); });

let hints: BoardWarmHints | undefined;
const mount = async () => {
  let done!: () => void;
  const preloaded = new Promise<void>(resolve => { done = resolve; });
  renderer.useAssetProgress(text => { if (text.startsWith('素材已全部')) done(); });
  renderer.useBoardFeed({ subscribe(next) { listener = next; return () => {}; }, controls: () => null as never, warmHints: () => hints ?? { version: 0, ids: [] } });
  mounted = await renderer.mountRenderer3d({ clientWidth: 800, clientHeight: 600, append() {} } as unknown as HTMLElement, { assetBase: ROOT });
  await preloaded;
  await new Promise(resolve => setTimeout(resolve, 0)); // the renderer marks the preload done just after its last progress line
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
  // Kept in this browser under the model file's sha256, for the next visit.
  expect(store.kept).toEqual([[ID, sourceOf(ID), { radius: 1, ground: 0, feet: 0 }]]);
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

it('a champion this browser measured before is fitted from its stored envelope, with nothing measured', async () => {
  store.stored.set(`${ID}|${sourceOf(ID)}`, { radius: 7, ground: -2, feet: 1 });
  await mount();
  listener.frame(frame(true, [piece('a', 150)]));
  await vi.waitFor(() => expect(championFits()).toHaveLength(1));
  expect(championFits()[0]![1]).toMatchObject({ envelopeRadius: 7, ground: -2, feet: 1 });
  expect(animationEnvelopeSliced).not.toHaveBeenCalled();
  expect(animationEnvelope).not.toHaveBeenCalled();
  expect(store.kept).toEqual([]);
});

it('a stored envelope for another model file is not used', async () => {
  store.stored.set(`${ID}|${envelopeSource('f'.repeat(64), { path: 'model.glb' })}`, { radius: 7, ground: -2, feet: 1 });
  await mount();
  listener.frame(frame(true, [piece('a', 150)]));
  await vi.waitFor(() => expect(championFits()).toHaveLength(1));
  expect(championFits()[0]![1]).toMatchObject({ envelopeRadius: 1, ground: 0, feet: 0 });
  expect(animationEnvelopeSliced).toHaveBeenCalledTimes(1);
});

// The warm-up in preparation (the second layer): what the room says comes next is measured before any combat shows it.
const keptIds = () => store.kept.map(([id]) => id);
it('preparation measures the warm list in order: pinned hints (shop, drawn opponent, scouted board) before every candidate board', async () => {
  models = ['akali', 'garen', 'zoe'];
  hints = { version: 1, ids: ['akali', 'garen'], later: ['zoe'] };
  await mount();
  listener.frame(frame(false, []));
  await vi.waitFor(() => expect(keptIds()).toEqual(['akali', 'garen', 'zoe']), { timeout: 5000 });
  expect(glbReads).toEqual(['akali.glb', 'garen.glb', 'zoe.glb']);
  // Each measured in slices, the warm-up's own (it stops at a combat), never in one long task.
  expect(animationEnvelope).not.toHaveBeenCalled();
  for (const [, , options] of vi.mocked(animationEnvelopeSliced).mock.calls) expect(options?.stop).toBeTypeOf('function');
});

it('a combat stops the warm-up at once and preparation picks it up again; the model then fits from it with nothing measured mid-combat', async () => {
  models = ['zoe'];
  hints = { version: 1, ids: [], later: ['zoe'] };
  let fighting = false;
  // A measurement that hands the thread back between slices and stops when asked (model-fit.ts animationEnvelopeSliced).
  vi.mocked(animationEnvelopeSliced).mockImplementation(async (_body, _clips, options) => {
    for (let slice = 0; slice < 5; slice++) { await new Promise(resolve => setTimeout(resolve, 20)); if (options?.stop?.()) return null; }
    return { radius: 3, ground: 0, feet: 0 };
  });
  await mount();
  listener.frame(frame(false, []));
  await vi.waitFor(() => expect(animationEnvelopeSliced).toHaveBeenCalledTimes(1));
  fighting = true; listener.frame(frame(true, []));
  await new Promise(resolve => setTimeout(resolve, 300));
  expect(keptIds()).toEqual([]); // stopped by the combat, nothing kept, nothing measured meanwhile
  const during = vi.mocked(animationEnvelopeSliced).mock.calls.length;
  await new Promise(resolve => setTimeout(resolve, 600));
  expect(vi.mocked(animationEnvelopeSliced).mock.calls.length).toBe(during); // waits out the whole combat
  fighting = false; listener.frame(frame(false, []));
  await vi.waitFor(() => expect(keptIds()).toEqual(['zoe']), { timeout: 5000 });
  expect(fighting).toBe(false);
  // The next combat shows zoe: fitted from the warm-up's envelope, no mid-combat measurement.
  const before = vi.mocked(animationEnvelopeSliced).mock.calls.length;
  listener.frame(frame(true, [{ ...piece('z', 150), definitionId: 'zoe' }]));
  await vi.waitFor(() => expect(vi.mocked(fitModel).mock.calls.some(([, o]) => o.envelopeRadius === 3)).toBe(true));
  expect(vi.mocked(animationEnvelopeSliced).mock.calls.length).toBe(before);
});

it('a failing envelope store never reaches the game: models are measured and fitted as without one', async () => {
  store.failing = true;
  await mount();
  listener.frame(frame(true, [piece('a', 150)]));
  await vi.waitFor(() => expect(championFits()).toHaveLength(1));
  expect(championFits()[0]![1]).toMatchObject({ envelopeRadius: 1, ground: 0, feet: 0 });
  expect(store.kept).toEqual([]);
});

it('a store that never answers holds nothing back: the mid-combat first load is measured and fitted after the timeout', async () => {
  store.hanging = true;
  await mount();
  listener.frame(frame(true, [piece('a', 150)]));
  await vi.waitFor(() => expect(championFits()).toHaveLength(1), { timeout: 6000 });
  expect(championFits()[0]![1]).toMatchObject({ envelopeRadius: 1, ground: 0, feet: 0 });
}, 10_000);

it('a piece that changes model while its first model is measured never shows the old one', async () => {
  models = [ID, 'zoe'];
  let calls = 0;
  // The first measurement (twitch) is slow; the second (zoe) is quick and tells itself apart by its radius.
  vi.mocked(animationEnvelopeSliced).mockImplementation(async () => {
    const mine = ++calls;
    if (mine === 1) { await new Promise(resolve => setTimeout(resolve, 300)); return { radius: 1, ground: 0, feet: 0 }; }
    return { radius: 5, ground: 0, feet: 0 };
  });
  await mount();
  listener.frame(frame(true, [piece('a', 150)]));
  await vi.waitFor(() => expect(animationEnvelopeSliced).toHaveBeenCalledTimes(1));
  listener.frame(frame(true, [{ ...piece('a', 150), definitionId: 'zoe' }]));
  await vi.waitFor(() => expect(championFits()).toHaveLength(1));
  await new Promise(resolve => setTimeout(resolve, 500)); // past the slow twitch measurement
  expect(championFits().map(([, options]) => options.envelopeRadius)).toEqual([5]);
});

it('the renderer keys the store by the manifest clip settings too: a re-cut clip with the same file is measured again', async () => {
  entryExtra = { animations: { idle: 'idle1' }, clipRanges: { idle1: [0.2, 1.5] } };
  // Stored when the idle was cut differently: same model file (same sha256), other clip settings.
  const before = envelopeSource(SHA, { path: 'model.glb', animations: { idle: 'idle1' }, clipRanges: { idle1: [0, 1.5] } });
  expect(before).not.toBe(sourceOf(ID));
  store.stored.set(`${ID}|${before}`, { radius: 7, ground: -2, feet: 1 });
  await mount();
  listener.frame(frame(true, [piece('a', 150)]));
  await vi.waitFor(() => expect(championFits()).toHaveLength(1));
  expect(championFits()[0]![1]).toMatchObject({ envelopeRadius: 1, ground: 0, feet: 0 });
  expect(animationEnvelopeSliced).toHaveBeenCalledTimes(1);
  expect(store.kept).toEqual([[ID, sourceOf(ID), { radius: 1, ground: 0, feet: 0 }]]);
});
