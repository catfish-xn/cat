/**
 * Keeping the 3D layer's memory bounded (2026-10-22 playtest: about 1.5 GB in the browser by 4-4; the page grew from
 * ~300 MB to ~750 MB, a third of it ArrayBuffers, and the GPU process never gave anything back).
 *
 * Two parts, both display only:
 * - Retention: the ModelCache keeps every template it ever parsed. Here a template nobody holds a lease on (no board,
 *   bench, carousel, scout view or table prop shows it) is evicted once it has gone unused for a while, which frees its
 *   GPU textures and buffers and its CPU geometry and clips. Showing it again reads it back from the local store.
 * - CPU copies after upload: once the renderer has put a model's normals, UVs, tangents and colours, and its textures,
 *   on the GPU, the CPU arrays behind them are emptied. Positions, skin indices and weights and the index stay: picking,
 *   bounds and the animation envelope read them. A template drawn by a second renderer (the lobby's legend picker)
 *   must keep its copies, so the caller chooses which models are stripped.
 */
import type { BufferAttribute, BufferGeometry, CompressedTexture, InterleavedBufferAttribute, Material, Mesh, Object3D, Texture } from 'three';
import type { ModelLease } from '../../rendering3d';

/** An unused template goes after this long; a round is ~75 s, so a unit sold two rounds ago is let go. */
export const MODEL_IDLE_MS = 120_000;

export interface ModelRetention {
  load(id: string): Promise<ModelLease>;
  /** Evicts every template idle for longer than the limit; returns how many went. */
  sweep(): number;
  /** Templates currently kept with no lease on them. */
  readonly idle: number;
}

interface Use { refs: number; last: number }

export function createModelRetention(cache: { load(id: string): Promise<ModelLease>; evict(id: string): void },
  options: { idleMs?: number; pinned?: (id: string) => boolean; now?: () => number } = {}): ModelRetention {
  const idleMs = options.idleMs ?? MODEL_IDLE_MS, now = options.now ?? (() => performance.now());
  const uses = new Map<string, Use>();
  return {
    load(id) {
      let use = uses.get(id);
      if (!use) { use = { refs: 0, last: now() }; uses.set(id, use); }
      use.refs++;
      const held = use, loading = cache.load(id);
      // Hooked on the cache's own promise, ahead of the caller's: the lease reaches the caller no later than before.
      void loading.then(lease => {
        const release = lease.release.bind(lease);
        let released = false;
        lease.release = () => {
          release();
          if (released) return;
          released = true; held.refs--; held.last = now();
        };
      }, () => { held.refs--; held.last = now(); });
      return loading;
    },
    sweep() {
      const at = now();
      let gone = 0;
      for (const [id, use] of uses) {
        if (use.refs > 0 || at - use.last < idleMs || options.pinned?.(id)) continue;
        uses.delete(id); cache.evict(id); gone++;
      }
      return gone;
    },
    get idle() { let count = 0; for (const use of uses.values()) if (use.refs === 0) count++; return count; },
  };
}

/** Attributes the CPU still reads after upload (Mesh.getVertexPosition, raycasts, bounds, the envelope). */
const KEPT = new Set(['position', 'skinIndex', 'skinWeight']);

type Attribute = BufferAttribute | InterleavedBufferAttribute;
// An emptied array of the same type: a raycast that interpolates a UV or normal reads NaN instead of throwing.
const emptied = (owner: { array: ArrayLike<number> }) => {
  owner.array = new (owner.array.constructor as new (length: number) => ArrayLike<number>)(0);
};

/**
 * Empties a template's CPU-side copies once the renderer has uploaded them. Shared geometry, interleaved buffers and
 * texture sources are only emptied when nothing in the template still needs them on the CPU (a buffer interleaving a
 * position with a normal stays whole; a texture source used by two textures, which may upload with different
 * settings, stays). Clones (SkeletonUtils) share the geometry and textures, so this covers every lease.
 */
export function releaseAfterUpload(template: Object3D): void {
  const geometries = new Set<BufferGeometry>(), textures = new Set<Texture>();
  template.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[])
      for (const value of Object.values(material)) if ((value as Texture | null)?.isTexture) textures.add(value as Texture);
  });
  for (const geometry of geometries) {
    const kept = new Set<unknown>(), dropped: Attribute[] = [];
    for (const [name, attribute] of Object.entries(geometry.attributes) as [string, Attribute][]) {
      if (KEPT.has(name)) kept.add((attribute as InterleavedBufferAttribute).isInterleavedBufferAttribute ? (attribute as InterleavedBufferAttribute).data : attribute);
      else dropped.push(attribute);
    }
    for (const attribute of dropped) {
      const owner = (attribute as InterleavedBufferAttribute).isInterleavedBufferAttribute ? (attribute as InterleavedBufferAttribute).data : attribute as BufferAttribute;
      if (kept.has(owner)) continue;
      owner.onUpload(() => emptied(owner));
    }
  }
  const sources = new Map<unknown, number>();
  for (const texture of textures) sources.set(texture.source, (sources.get(texture.source) ?? 0) + 1);
  for (const texture of textures) {
    if (sources.get(texture.source) !== 1) continue;
    const previous = texture.onUpdate;
    texture.onUpdate = (updated: Texture) => {
      previous?.call(updated, updated);
      const compressed = updated as CompressedTexture;
      if (compressed.isCompressedTexture) {
        for (const level of compressed.mipmaps as { data?: ArrayLike<number> }[])
          if (level?.data) level.data = new (level.data.constructor as new (length: number) => ArrayLike<number>)(0);
      } else (updated.image as { close?: () => void } | null)?.close?.();
    };
  }
}
