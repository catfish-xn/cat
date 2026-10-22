import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, ShaderMaterial, Texture } from 'three';
import { type ModelTemplate, type ParticleEffect } from '../src/rendering3d';
import { createEffectLibrary, EFFECT_IDLE_MS } from '../src/rendering/three-mode/effect-library';

const manifest = { schemaVersion: 1 as const, models: {}, effects: { a: { path: 'a.json' }, b: { path: 'b.json' } } };
const document = (texture: string | undefined = 'shared.png') => ({ schemaVersion: 2, limits: { maxParticles: 20, maxDuration: 5 }, emitters: [
  { kind: 'mesh', mesh: 'shared.glb', texture, emission: { mode: 'burst', count: 1 }, lifetime: 1 },
] });
const particle = (effect: ParticleEffect) => effect.object.children[0] as Mesh<BoxGeometry, ShaderMaterial>;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve };
}
async function flush() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
function model() {
  const scene = new Group(), geometry = new BoxGeometry(), material = new MeshBasicMaterial(); scene.add(new Mesh(geometry, material));
  return { scene, animations: [], geometry, disposed: [vi.spyOn(geometry, 'dispose'), vi.spyOn(material, 'dispose')] };
}
function fixture() {
  const textures: Texture[] = [], models: ReturnType<typeof model>[] = [];
  const reader = {
    readJson: vi.fn(async () => document()),
    readTexture: vi.fn(async () => { const texture = new Texture(); textures.push(texture); return texture; }),
    readModel: vi.fn(async (): Promise<ModelTemplate> => { const value = model(); models.push(value); return value; }),
  };
  return { reader, textures, models, library: createEffectLibrary(manifest, '/synthetic/', reader) };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('effect library idle resource sweep', () => {
  it('waits 120 seconds after the last borrower, disposes shared resources once and rebuilds after eviction', async () => {
    expect(EFFECT_IDLE_MS).toBe(120_000);
    const { library, reader, models } = fixture();
    const [a, b] = await Promise.all([library.load('a', 2), library.load('b', 2)]);
    const geometry = particle(a).geometry, texture = particle(a).material.uniforms.map.value as Texture;
    const gd = vi.spyOn(geometry, 'dispose'), td = vi.spyOn(texture, 'dispose');
    expect(particle(b).geometry).toBe(geometry); expect(library.reads).toEqual({ json: 2, texture: 1, mesh: 1 });
    models[0].disposed.forEach(disposed => expect(disposed).toHaveBeenCalledTimes(1));
    a.dispose(); a.dispose(); vi.advanceTimersByTime(240_000);
    // a.json alone is idle: the other document and shared GPU resources are still borrowed by b.
    expect(library.sweep()).toBe(1); await flush(); expect(gd).not.toHaveBeenCalled(); expect(td).not.toHaveBeenCalled();
    b.dispose(); b.dispose(); expect(library.budget.live).toBe(0);
    vi.advanceTimersByTime(119_999); expect(library.sweep()).toBe(0);
    vi.advanceTimersByTime(1); expect(library.sweep()).toBe(3); await flush();
    expect(gd).toHaveBeenCalledTimes(1); expect(td).toHaveBeenCalledTimes(1); expect(library.sweep()).toBe(0);
    const fresh = await library.load('a', 2);
    expect(reader.readJson).toHaveBeenCalledTimes(3); expect(reader.readModel).toHaveBeenCalledTimes(2); expect(reader.readTexture).toHaveBeenCalledTimes(2);
    expect(particle(fresh).geometry).not.toBe(geometry); expect(particle(fresh).material.uniforms.map.value).not.toBe(texture);
    fresh.dispose(); library.dispose(); library.dispose(); await flush();
    expect(gd).toHaveBeenCalledTimes(1); expect(td).toHaveBeenCalledTimes(1);
  });

  it('reborrowing idle resources resets their timeout without extra reads', async () => {
    const { library } = fixture(), a = await library.load('a', 2); a.dispose();
    vi.advanceTimersByTime(119_999); const b = await library.load('a', 2); b.dispose();
    vi.advanceTimersByTime(119_999); expect(library.sweep()).toBe(0);
    expect(library.reads).toEqual({ json: 1, texture: 1, mesh: 1 });
    vi.advanceTimersByTime(1); expect(library.sweep()).toBe(3); library.dispose(); await flush();
  });

  it.each(['json', 'mesh', 'texture'] as const)('protects resources while %s is loading, then sweeps after the effect releases', async phase => {
    const { library, reader } = fixture(); const pendingJson = deferred<ReturnType<typeof document>>(), pendingMesh = deferred<ModelTemplate>(), pendingTexture = deferred<Texture>();
    if (phase === 'json') reader.readJson.mockReturnValue(pendingJson.promise);
    if (phase === 'mesh') reader.readModel.mockReturnValue(pendingMesh.promise);
    if (phase === 'texture') reader.readTexture.mockReturnValue(pendingTexture.promise);
    const pending = library.load('a', 2); await flush();
    vi.advanceTimersByTime(240_000); expect(library.sweep()).toBe(0);
    if (phase === 'json') pendingJson.resolve(document());
    if (phase === 'mesh') pendingMesh.resolve(model());
    if (phase === 'texture') pendingTexture.resolve(new Texture());
    const effect = await pending; expect(library.sweep()).toBe(0); effect.dispose();
    vi.advanceTimersByTime(120_000); expect(library.sweep()).toBe(3); library.dispose(); await flush();
  });

  it('can trim failed reads and retry them instead of retaining rejected promises forever', async () => {
    const { library, reader } = fixture(); reader.readTexture.mockRejectedValueOnce(new Error('bad texture'));
    await expect(library.load('a', 2)).rejects.toThrow('bad texture');
    vi.advanceTimersByTime(119_999); expect(library.sweep()).toBe(0);
    vi.advanceTimersByTime(1); expect(library.sweep()).toBe(3); await flush();
    const effect = await library.load('a', 2); expect(effect.particleCount).toBe(1);
    expect(reader.readTexture).toHaveBeenCalledTimes(2); effect.dispose(); library.dispose(); await flush();
  });

  it('sweep and owner shutdown release a late texture exactly once (#370), including after an earlier sweep', async () => {
    const { library, reader } = fixture(), first = await library.load('a', 2); first.dispose();
    vi.advanceTimersByTime(120_000); expect(library.sweep()).toBe(3); await flush();
    const late = deferred<Texture>(); reader.readTexture.mockReturnValue(late.promise);
    const pending = library.load('a', 2); await flush(); expect(reader.readTexture).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(240_000); expect(library.sweep()).toBe(0);
    library.dispose(); library.dispose(); expect(library.sweep()).toBe(0);
    const texture = new Texture(), disposed = vi.spyOn(texture, 'dispose'); late.resolve(texture);
    await expect(pending).rejects.toThrow('effect-library-closed'); await flush();
    vi.advanceTimersByTime(120_000); expect(library.sweep()).toBe(0); expect(disposed).toHaveBeenCalledTimes(1);
    expect(library.budget.live).toBe(0); expect(library.pool.idle).toBe(0);
    await expect(library.load('a', 2)).rejects.toThrow('effect-library-closed');
  });

  it('rejects a mesh-only effect closed during mesh loading and disposes the late template and extracted geometry (#370)', async () => {
    const { library, reader } = fixture(), late = deferred<ModelTemplate>();
    reader.readJson.mockResolvedValue({ ...document(), emitters: document().emitters.map(({ texture: _texture, ...emitter }) => emitter) } as ReturnType<typeof document>);
    reader.readModel.mockReturnValue(late.promise);
    const pending = library.load('a', 2); await flush(); expect(reader.readModel).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(240_000); expect(library.sweep()).toBe(0); library.dispose();
    const value = model(), clone = value.geometry.clone(), disposed = vi.spyOn(clone, 'dispose');
    vi.spyOn(value.geometry, 'clone').mockReturnValue(clone); late.resolve(value);
    // Mesh decode failures are normally skipped, but owner shutdown must not produce a successful live effect.
    const outcome = await pending.then(effect => { effect.dispose(); return 'resolved'; }, error => (error as Error).message);
    await flush(); value.disposed.forEach(spy => expect(spy).toHaveBeenCalledTimes(1)); expect(disposed).toHaveBeenCalledTimes(1);
    expect(outcome).toBe('effect-library-closed');
  });
});
