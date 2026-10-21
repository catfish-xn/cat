/**
 * Particle effects for one 3D renderer, built from resources read once (2026-10-21 playtest: the board stuttered from
 * 3-6 and badly from 4-1). Every attack used to read its effect file again, decode each texture (a fresh GPU upload),
 * parse each mesh's GLB, and dispose all of it when the effect ended; every particle built and disposed its own material.
 *
 * Here each effect document, texture and mesh is read the first time an effect asks for it and kept until the renderer
 * goes (a failed read stays failed, as it played nothing before either); effects borrow them. Particle materials come
 * from one pool, and all effects share one live-particle budget, so a crowded late-game fight sheds particles instead of
 * frames. Nothing about how an effect looks changes: same documents, same scale, same uniforms.
 */
import type { BufferGeometry, Texture } from 'three';
import { ParticleMaterialPool, loadParticleEffect, readParticleMesh, type AssetManifest, type ParticleBudget, type ParticleEffect } from '../../rendering3d';
import type { AssetReader } from './asset-reader';

/** Live particles across every effect on the renderer at most; past it new particles are not born. */
export const MAX_LIVE_PARTICLES = 1500;

export interface EffectLibrary {
  load(id: string, maxDuration: number): Promise<ParticleEffect>;
  readonly budget: ParticleBudget;
  readonly pool: ParticleMaterialPool;
  /** Reads so far, by kind (each resource once). */
  readonly reads: { readonly json: number; readonly texture: number; readonly mesh: number };
  dispose(): void;
}

export function createEffectLibrary(manifest: AssetManifest, root: string, reader: Pick<AssetReader, 'readJson' | 'readTexture' | 'readModel'>,
  maxParticles = MAX_LIVE_PARTICLES): EffectLibrary {
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
  const budget: ParticleBudget = { live: 0, max: maxParticles };
  const pool = new ParticleMaterialPool();
  return {
    budget, pool, reads,
    load(id, maxDuration) {
      if (closed) return Promise.reject(new Error('effect-library-closed'));
      return loadParticleEffect(manifest, id, { root, scale: 1, maxDuration, readJson, readTexture, readMesh, borrowed: true, materials: pool, budget });
    },
    dispose() {
      if (closed) return;
      closed = true; pool.dispose();
      for (const texture of textures.values()) void texture.then(value => value.dispose(), () => {});
      for (const mesh of meshes.values()) void mesh.then(value => value.dispose(), () => {});
      json.clear(); textures.clear(); meshes.clear();
    },
  };
}
