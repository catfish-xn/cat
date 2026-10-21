import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, ShaderMaterial, Texture } from 'three';
import { ModelCache, ParticleEffect, ParticleMaterialPool, type ParticleBudget } from '../src/rendering3d';
import { createEffectLibrary } from '../src/rendering/three-mode/effect-library';

// Synthetic documents and Three objects only: no canvas, network or asset files.
const emitter = (changes: Record<string, unknown> = {}) => ({ kind: 'quad', emission: { mode: 'burst', count: 1 }, lifetime: 1, ...changes });
const doc = (...emitters: unknown[]) => ({ schemaVersion: 2, limits: { maxParticles: 20, maxDuration: 5 }, emitters });
const v1 = (changes: Record<string, unknown> = {}) => ({ schemaVersion: 1, emitters: [{ kind: 'sprite', count: 1, lifetime: 1, ...changes }] });
const particle = (effect: ParticleEffect, i = 0) => effect.object.children[i] as Mesh<BoxGeometry, ShaderMaterial>;
const manifest = { schemaVersion: 1 as const, models: { toy: { path: 'toy.glb' } }, effects: { a: { path: 'a.json' }, b: { path: 'b.json' } } };

describe('particle material leases', () => {
  it.each([1, 2])('v%i reuses returned materials but isolates simultaneously live uniforms', version => {
    const pool = new ParticleMaterialPool(), texture = new Texture();
    const make = (opacity: number, rgb: number[]) => new ParticleEffect(version === 1
      ? v1({ texture: 'a.png', opacity: [{ time: 0, value: opacity }], color: [{ time: 0, value: rgb }] })
      : doc(emitter({ texture: 'a.png', opacity: [{ time: 0, value: opacity }], color: [{ time: 0, value: rgb }] })),
    { materials: pool, texture: () => texture });
    const a = make(.2, [1, 0, 0]), b = make(.8, [0, 1, 0]);
    const ma = particle(a).material, mb = particle(b).material;
    const da = vi.spyOn(ma, 'dispose'), db = vi.spyOn(mb, 'dispose');
    expect(ma).not.toBe(mb); expect(ma.uniforms).not.toBe(mb.uniforms);
    a.update(.4); b.update(.1);
    expect(ma.uniforms.opacity.value).toBe(.2); expect(mb.uniforms.opacity.value).toBe(.8);
    expect((ma.uniforms.tint.value as Color).toArray()).toEqual([1, 0, 0]);
    expect((mb.uniforms.tint.value as Color).toArray()).toEqual([0, 1, 0]);
    a.dispose(); expect(da).not.toHaveBeenCalled(); expect(ma.uniforms.map.value).toBeNull();
    const c = make(.6, [0, 0, 1]);
    expect(particle(c).material).toBe(ma); expect(ma.uniforms.map.value).toBe(texture);
    expect(ma.uniforms.opacity.value).toBe(.6); expect((ma.uniforms.tint.value as Color).toArray()).toEqual([0, 0, 1]);
    expect(mb.uniforms.opacity.value).toBe(.8); expect((mb.uniforms.tint.value as Color).toArray()).toEqual([0, 1, 0]);
    b.dispose(); c.dispose(); expect(pool.idle).toBe(2);
    pool.dispose(); pool.dispose(); expect(pool.idle).toBe(0);
    expect(da).toHaveBeenCalledTimes(1); expect(db).toHaveBeenCalledTimes(1); texture.dispose();
  });

  it('separates blend, shader version and vertex-color variants; resets texture/atlas uniforms on reuse', () => {
    const pool = new ParticleMaterialPool(), geometry = new BoxGeometry(), texture = new Texture();
    geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 4).fill(.5), 4));
    const a = new ParticleEffect(doc(emitter({ texture: 'a.png', frames: { columns: 2, rows: 2, fps: 8, loop: true } })), { materials: pool, texture: () => texture });
    const original = particle(a).material; a.dispose();
    const blend = new ParticleEffect(doc(emitter({ blend: 'additive' })), { materials: pool });
    const legacy = new ParticleEffect(v1(), { materials: pool });
    const colored = new ParticleEffect(doc(emitter({ kind: 'mesh', mesh: 'toy.glb' })), { materials: pool, mesh: () => geometry });
    for (const fx of [blend, legacy, colored]) expect(particle(fx).material).not.toBe(original);
    expect(particle(colored).material.vertexColors).toBe(true);
    const plain = new ParticleEffect(doc(emitter()), { materials: pool });
    expect(particle(plain).material).toBe(original);
    expect(original.uniforms.map.value).toBeNull(); expect(original.uniforms.hasMap.value).toBe(false);
    expect(original.uniforms.tiles.value).toEqual([1, 1]); expect(original.uniforms.frame.value).toBe(0);
    const disposals = [original, ...[blend, legacy, colored].map(fx => particle(fx).material)].map(m => vi.spyOn(m, 'dispose'));
    for (const fx of [blend, legacy, colored, plain]) fx.dispose();
    pool.dispose(); disposals.forEach(d => expect(d).toHaveBeenCalledTimes(1)); geometry.dispose(); texture.dispose();
  });

  it('disposes overflow and materials returned after pool shutdown, exactly once', () => {
    const pool = new ParticleMaterialPool(1);
    const a = new ParticleEffect(doc(emitter()), { materials: pool }), b = new ParticleEffect(doc(emitter()), { materials: pool });
    const da = vi.spyOn(particle(a).material, 'dispose'), db = vi.spyOn(particle(b).material, 'dispose');
    a.dispose(); b.dispose(); expect(pool.idle).toBe(1); expect(db).toHaveBeenCalledTimes(1);
    const c = new ParticleEffect(doc(emitter()), { materials: pool });
    pool.dispose(); expect(da).not.toHaveBeenCalled(); c.dispose(); c.dispose();
    expect(da).toHaveBeenCalledTimes(1); expect(pool.idle).toBe(0);
  });
});

describe('shared live-particle budget', () => {
  it('drops later v2 births globally in document order and admits new effects after expiry/disposal', () => {
    const budget: ParticleBudget = { live: 0, max: 3 };
    const a = new ParticleEffect(doc(emitter({ emission: { mode: 'burst', count: 2 }, position: [1, 0, 0] })), { budget });
    const b = new ParticleEffect(doc(emitter({ emission: { mode: 'burst', count: 2 }, position: [2, 0, 0] }), emitter({ position: [3, 0, 0] })), { budget });
    expect([a.particleCount, b.particleCount, b.droppedParticles, budget.live]).toEqual([2, 1, 2, 3]);
    expect(particle(b).position.x).toBe(2);
    a.update(1); expect(budget.live).toBe(1);
    const c = new ParticleEffect(doc(emitter({ emission: { mode: 'burst', count: 4 } })), { budget });
    expect([c.particleCount, c.droppedParticles, budget.live]).toEqual([2, 2, 3]);
    for (const fx of [a, b, c]) { fx.dispose(); fx.dispose(); }
    expect(budget.live).toBe(0);
    const d = new ParticleEffect(doc(emitter()), { budget }); expect(d.particleCount).toBe(1); d.dispose(); expect(budget.live).toBe(0);
  });

  it('a previously blocked continuous effect can spawn on later births without starvation', () => {
    const budget: ParticleBudget = { live: 0, max: 1 };
    const blocker = new ParticleEffect(doc(emitter()), { budget });
    const waiting = new ParticleEffect(doc(emitter({ emission: { mode: 'continuous', rate: 10, duration: 2, burst: 1 }, lifetime: .05 })), { budget });
    expect(waiting.particleCount).toBe(0); expect(waiting.droppedParticles).toBe(1);
    waiting.update(.2); expect(waiting.particleCount).toBe(0); expect(waiting.droppedParticles).toBe(3);
    blocker.dispose(); waiting.update(.1);
    expect(waiting.particleCount).toBe(1); expect(budget.live).toBe(1);
    for (let i = 0; i < 10; i++) { waiting.update(.1); expect(budget.live).toBeLessThanOrEqual(1); expect(budget.live).toBe(waiting.particleCount); }
    waiting.dispose(); expect(budget.live).toBe(0);
  });

  it('v1 and v2 share the same ceiling; v1 releases its allocated burst on dispose', () => {
    const budget: ParticleBudget = { live: 0, max: 2 };
    const legacy = new ParticleEffect(v1({ count: 3 }), { budget });
    const blocked = new ParticleEffect(doc(emitter()), { budget });
    expect(legacy.particleCount).toBe(2); expect(blocked.particleCount).toBe(0); expect(budget.live).toBe(2);
    legacy.dispose(); const fresh = new ParticleEffect(doc(emitter()), { budget });
    expect(fresh.particleCount).toBe(1); blocked.dispose(); fresh.dispose(); expect(budget.live).toBe(0);
  });
});

function syntheticReader() {
  const textures: Texture[] = [], geometries: BoxGeometry[] = [];
  return { textures, geometries,
    readJson: vi.fn(async () => doc(emitter({ texture: 'shared.png' }), emitter({ kind: 'mesh', mesh: 'shared.glb', texture: 'shared.png' }))),
    readTexture: vi.fn(async () => { const texture = new Texture(); textures.push(texture); return texture; }),
    readModel: vi.fn(async () => { const scene = new Group(), geometry = new BoxGeometry(); geometries.push(geometry); scene.add(new Mesh(geometry, new MeshBasicMaterial())); return { scene, animations: [] }; }),
  };
}

describe('renderer-owned borrowed effect resources', () => {
  it('deduplicates concurrent/repeated reads across spells and keeps borrowed resources until owner cleanup', async () => {
    const reader = syntheticReader(), library = createEffectLibrary(manifest, '/synthetic/', reader);
    const [a, b, other] = await Promise.all([library.load('a', 2), library.load('a', 2), library.load('b', 2)]);
    expect(library.reads).toEqual({ json: 2, texture: 1, mesh: 1 });
    expect(reader.readJson).toHaveBeenCalledTimes(2); expect(reader.readTexture).toHaveBeenCalledTimes(1); expect(reader.readModel).toHaveBeenCalledTimes(1);
    const texture = reader.textures[0], geometry = particle(a, 1).geometry;
    const td = vi.spyOn(texture, 'dispose'), gd = vi.spyOn(geometry, 'dispose');
    expect(particle(b, 1).geometry).toBe(geometry); expect(particle(other).material.uniforms.map.value).toBe(texture);
    a.dispose(); expect(td).not.toHaveBeenCalled(); expect(gd).not.toHaveBeenCalled();
    b.update(.5); expect(particle(b).material.uniforms.map.value).toBe(texture);
    b.dispose(); other.dispose(); expect(library.budget.live).toBe(0);
    // This cache intentionally retains resources even with zero borrowers; it has no per-effect refcount.
    expect(td).not.toHaveBeenCalled(); expect(gd).not.toHaveBeenCalled();
    const again = await library.load('a', 2); expect(particle(again, 1).geometry).toBe(geometry); again.dispose();
    const materials = vi.spyOn(library.pool, 'dispose'); library.dispose(); library.dispose(); await Promise.resolve();
    expect(materials).toHaveBeenCalledTimes(1); expect(td).toHaveBeenCalledTimes(1); expect(gd).toHaveBeenCalledTimes(1); expect(library.pool.idle).toBe(0);
    await expect(library.load('a', 2)).rejects.toThrow('effect-library-closed');
    const replacement = createEffectLibrary(manifest, '/synthetic/', reader), fresh = await replacement.load('a', 2);
    expect(reader.readTexture).toHaveBeenCalledTimes(2); expect(reader.readModel).toHaveBeenCalledTimes(2);
    expect(particle(fresh).material.uniforms.map.value).not.toBe(texture); expect(particle(fresh, 1).geometry).not.toBe(geometry);
    fresh.dispose(); replacement.dispose(); await Promise.resolve();
  });

  it('disposes a pending cached texture when its owner closes before the texture arrives', async () => {
    const reader = syntheticReader(); let resolve!: (texture: Texture) => void;
    reader.readTexture.mockImplementation(() => new Promise<Texture>(done => { resolve = done; }));
    const library = createEffectLibrary(manifest, '/synthetic/', reader), pending = library.load('a', 2);
    await vi.waitFor(() => expect(reader.readTexture).toHaveBeenCalledTimes(1));
    library.dispose(); const texture = new Texture(), disposed = vi.spyOn(texture, 'dispose'); resolve(texture);
    await expect(pending).rejects.toThrow('effect-library-closed');
    await Promise.resolve(); expect(disposed).toHaveBeenCalledTimes(1);
    expect(library.budget.live).toBe(0);
    await expect(library.load('a', 2)).rejects.toThrow('effect-library-closed');
    expect(reader.readTexture).toHaveBeenCalledTimes(1);
  });

  it('closing while JSON is pending rejects the load before starting any texture or mesh reads', async () => {
    const reader = syntheticReader(); let resolve!: (document: ReturnType<typeof doc>) => void;
    reader.readJson.mockImplementation(() => new Promise(done => { resolve = done; }));
    const library = createEffectLibrary(manifest, '/synthetic/', reader), pending = library.load('a', 2);
    expect(reader.readJson).toHaveBeenCalledTimes(1);
    library.dispose();
    resolve(doc(emitter({ texture: 'late.png' }), emitter({ kind: 'mesh', mesh: 'late.glb' })));
    await expect(pending).rejects.toThrow('effect-library-closed');
    expect(reader.readTexture).not.toHaveBeenCalled(); expect(reader.readModel).not.toHaveBeenCalled();
    expect(library.reads).toEqual({ json: 1, texture: 0, mesh: 0 }); expect(library.budget.live).toBe(0);
  });

  it('model cache retirement waits for the last lease, then reloads an evicted model', async () => {
    const reader = syntheticReader(), cache = new ModelCache(manifest, '/synthetic/', reader.readModel);
    const [a, b] = await Promise.all([cache.load('toy'), cache.load('toy')]);
    const geometry = reader.geometries[0], disposed = vi.spyOn(geometry, 'dispose');
    expect(reader.readModel).toHaveBeenCalledTimes(1); cache.evict('toy');
    a.release(); a.release(); expect(disposed).not.toHaveBeenCalled();
    b.release(); expect(disposed).toHaveBeenCalledTimes(1);
    const fresh = await cache.load('toy'); expect(reader.readModel).toHaveBeenCalledTimes(2);
    expect((fresh.scene.children[0] as Mesh).geometry).not.toBe(geometry);
    const freshDisposed = vi.spyOn(reader.geometries[1], 'dispose'); cache.dispose(); expect(freshDisposed).not.toHaveBeenCalled();
    fresh.release(); expect(freshDisposed).toHaveBeenCalledTimes(1); await expect(cache.load('toy')).rejects.toThrow('model-cache-disposed');
  });
});
