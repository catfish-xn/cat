/**
 * Particle effects for one 3D renderer, built from resources read once (2026-10-21 playtest: the board stuttered from
 * 3-6 and badly from 4-1). Every attack used to read its effect file again, decode each texture (a fresh GPU upload),
 * parse each mesh's GLB, and dispose all of it when the effect ended; every particle built and disposed its own material.
 *
 * Here each effect document, texture and mesh is read the first time an effect asks for it and kept until the renderer
 * goes (a failed read stays failed, as it played nothing before either); effects borrow them. Particle materials come
 * from one pool, and all effects share one live-particle budget, so a crowded late-game fight sheds particles instead of
 * frames. Nothing about how an effect looks changes: same documents, same scale, same uniforms.
 *
 * A resource no live effect uses is let go once it has gone unused for EFFECT_IDLE_MS (sweep(); 2026-10-22: the page
 * kept every champion's effect textures from 1-1 on); the next effect that needs it reads it again.
 */
import type { BufferGeometry, Texture } from 'three';
import { ParticleMaterialPool, loadParticleEffect, readParticleMesh, type AssetManifest, type ParticleBudget, type ParticleEffect } from '../../rendering3d';
import type { AssetReader } from './asset-reader';

/** Live particles across every effect on the renderer at most; past it new particles are not born. */
export const MAX_LIVE_PARTICLES = 1500;
/** An effect resource no live effect uses is released after this long. */
export const EFFECT_IDLE_MS = 120_000;

export interface EffectLibrary {
  /** `maxParticles` tightens this one effect's own live-particle limit (the shared budget applies either way). */
  load(id: string, maxDuration: number, maxParticles?: number): Promise<ParticleEffect>;
  readonly budget: ParticleBudget;
  readonly pool: ParticleMaterialPool;
  /** Reads so far, by kind (each resource once). */
  readonly reads: { readonly json: number; readonly texture: number; readonly mesh: number };
  /** Releases every resource that no live effect uses and that has gone unused for EFFECT_IDLE_MS; returns how many. */
  sweep(): number;
  dispose(): void;
}

export function createEffectLibrary(manifest: AssetManifest, root: string, reader: Pick<AssetReader, 'readJson' | 'readTexture' | 'readModel'>,
  maxParticles = MAX_LIVE_PARTICLES, options: { idleMs?: number; now?: () => number } = {}): EffectLibrary {
  const idleMs = options.idleMs ?? EFFECT_IDLE_MS, now = options.now ?? (() => performance.now());
  const reads = { json: 0, texture: 0, mesh: 0 };
  const json = new Map<string, Promise<unknown>>(), textures = new Map<string, Promise<Texture>>(), meshes = new Map<string, Promise<BufferGeometry>>();
  let closed = false;
  // After dispose nothing new is read, and a read still in flight is disposed when it lands (an effect that was loading
  // at the time then fails and plays nothing).
  const once = <T>(cache: Map<string, Promise<T>>, url: string, read: () => Promise<T>, release?: (value: T) => void): Promise<T> => {
    if (closed) return Promise.reject(new Error('effect-library-closed'));
    let value = cache.get(url);
    if (!value) {
      value = read().then(result => {
        if (closed) { release?.(result); throw new Error('effect-library-closed'); }
        return result;
      });
      cache.set(url, value); value.catch(() => {});
    }
    return value;
  };
  const readJson = (url: string) => once(json, url, () => { reads.json++; return reader.readJson(url); });
  const readTexture = (url: string) => once(textures, url, () => { reads.texture++; return reader.readTexture(url); }, texture => texture.dispose());
  // readParticleMesh parses its own template and disposes it, keeping a static copy: that copy is the one kept.
  const readMesh = (url: string) => once(meshes, url, () => { reads.mesh++; return readParticleMesh(url, reader.readModel); }, mesh => mesh.dispose());
  // Live effects using each resource (by URL), and when the last of them ended.
  const uses = new Map<string, { refs: number; last: number }>();
  const used = (url: string) => { let use = uses.get(url); if (!use) uses.set(url, use = { refs: 0, last: now() }); return use; };
  const budget: ParticleBudget = { live: 0, max: maxParticles };
  const pool = new ParticleMaterialPool();
  return {
    budget, pool, reads,
    load(id, maxDuration, maxParticles) {
      if (closed) return Promise.reject(new Error('effect-library-closed'));
      // The resources this effect reads are held from the read until it ends (a sweep meanwhile leaves them); a failed
      // load lets them go at once.
      const urls = new Set<string>();
      const track = <T>(read: (url: string) => Promise<T>) => (url: string) => {
        if (!urls.has(url)) { urls.add(url); used(url).refs++; }
        return read(url);
      };
      const letGo = () => { for (const url of urls) { const use = used(url); use.refs--; use.last = now(); } };
      return loadParticleEffect(manifest, id, { root, scale: 1, maxDuration, readJson: track(readJson), readTexture: track(readTexture),
        readMesh: track(readMesh), borrowed: true, materials: pool, budget, ...(maxParticles === undefined ? {} : { maxParticles }) }).then(effect => {
        // Closed while it loaded: a mesh that landed late was released (and its emitter skipped), so this effect fails too.
        if (closed) { effect.dispose(); letGo(); throw new Error('effect-library-closed'); }
        const dispose = effect.dispose.bind(effect);
        let ended = false;
        effect.dispose = () => {
          dispose();
          if (ended) return;
          ended = true; letGo();
        };
        return effect;
      }, error => { letGo(); throw error; });
    },
    sweep() {
      const at = now();
      let gone = 0;
      for (const [url, use] of uses) {
        if (use.refs > 0 || at - use.last < idleMs) continue;
        uses.delete(url);
        const texture = textures.get(url), mesh = meshes.get(url);
        if (texture) void texture.then(value => value.dispose(), () => {});
        if (mesh) void mesh.then(value => value.dispose(), () => {});
        if (texture || mesh || json.has(url)) gone++;
        textures.delete(url); meshes.delete(url); json.delete(url);
      }
      return gone;
    },
    dispose() {
      if (closed) return;
      closed = true; pool.dispose();
      for (const texture of textures.values()) void texture.then(value => value.dispose(), () => {});
      for (const mesh of meshes.values()) void mesh.then(value => value.dispose(), () => {});
      json.clear(); textures.clear(); meshes.clear(); uses.clear();
    },
  };
}
