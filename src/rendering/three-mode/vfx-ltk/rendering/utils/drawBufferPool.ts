/*! @license GPL-3.0-or-later
 * LTK GPU draw-buffer pool: reuse quad, projection, ribbon and mesh instancing buffers by size/key.
 */
import type { BufferGeometry } from 'three';
import {
  meshBuffers,
  projectionBuffers,
  quadBuffers,
  type MeshBuffers,
  type ProjectionBuffers,
  type QuadBuffers,
} from './buffers';
import { ribbonBuffers, type RibbonBuffers } from './ribbon';

/** How many spare buffer sets of one size wait for the next effect of that size. */
export const DRAW_BUFFER_SPARE = 32;

const quadSpare = new Map<number, QuadBuffers[]>();
const projectionSpare = new Map<number, ProjectionBuffers[]>();
const ribbonSpare = new Map<number, RibbonBuffers[]>();
const meshSpare = new Map<string, MeshBuffers[]>();

export interface DrawBufferPoolStats {
  quadAlloc: number;
  quadReuse: number;
  projectionAlloc: number;
  projectionReuse: number;
  ribbonAlloc: number;
  ribbonReuse: number;
  meshAlloc: number;
  meshReuse: number;
}

export const drawBufferPoolStats: DrawBufferPoolStats = {
  quadAlloc: 0,
  quadReuse: 0,
  projectionAlloc: 0,
  projectionReuse: 0,
  ribbonAlloc: 0,
  ribbonReuse: 0,
  meshAlloc: 0,
  meshReuse: 0,
};

export function resetDrawBufferPoolStats(): void {
  for (const key of Object.keys(drawBufferPoolStats) as (keyof DrawBufferPoolStats)[]) drawBufferPoolStats[key] = 0;
}

function take<T>(
  spare: Map<number, T[]>,
  size: number,
  create: () => T,
  stats: { alloc: keyof DrawBufferPoolStats; reuse: keyof DrawBufferPoolStats },
): T {
  const held = spare.get(size)?.pop();
  if (held !== undefined) {
    drawBufferPoolStats[stats.reuse] += 1;
    return held;
  }
  drawBufferPoolStats[stats.alloc] += 1;
  return create();
}

function give<T>(
  spare: Map<number, T[]>,
  size: number,
  value: T,
  reset: (held: T) => void,
  dispose: (held: T) => void,
): void {
  reset(value);
  const stack = spare.get(size) ?? [];
  if (stack.length < DRAW_BUFFER_SPARE) {
    stack.push(value);
    spare.set(size, stack);
    return;
  }
  dispose(value);
}

function resetQuad(buffers: QuadBuffers): void {
  buffers.geometry.instanceCount = 0;
}

function disposeQuad(buffers: QuadBuffers): void {
  buffers.geometry.dispose();
}

function resetProjection(buffers: ProjectionBuffers): void {
  buffers.geometry.instanceCount = 0;
}

function disposeProjection(buffers: ProjectionBuffers): void {
  buffers.geometry.dispose();
}

function resetRibbon(buffers: RibbonBuffers): void {
  buffers.geometry.setDrawRange(0, 0);
  buffers.edgeGeometry.setDrawRange(0, 0);
  buffers.taken.index = -1;
}

function disposeRibbon(buffers: RibbonBuffers): void {
  buffers.geometry.dispose();
  buffers.edgeGeometry.dispose();
}

function resetMesh(_buffers: MeshBuffers): void {
  /* InstancedMesh.count is reset on the mesh; rows are overwritten each frame. */
}

function disposeMesh(buffers: MeshBuffers): void {
  buffers.geometry.dispose();
}

export function borrowQuadBuffers(capacity: number): QuadBuffers {
  return take(quadSpare, capacity, () => quadBuffers(capacity), { alloc: 'quadAlloc', reuse: 'quadReuse' });
}

export function releaseQuadBuffers(buffers: QuadBuffers, capacity: number): void {
  give(quadSpare, capacity, buffers, resetQuad, disposeQuad);
}

export function borrowProjectionBuffers(capacity: number): ProjectionBuffers {
  return take(projectionSpare, capacity, () => projectionBuffers(capacity), {
    alloc: 'projectionAlloc',
    reuse: 'projectionReuse',
  });
}

export function releaseProjectionBuffers(buffers: ProjectionBuffers, capacity: number): void {
  give(projectionSpare, capacity, buffers, resetProjection, disposeProjection);
}

export function borrowRibbonBuffers(vertices: number): RibbonBuffers {
  return take(ribbonSpare, vertices, () => ribbonBuffers(vertices), { alloc: 'ribbonAlloc', reuse: 'ribbonReuse' });
}

export function releaseRibbonBuffers(buffers: RibbonBuffers, vertices: number): void {
  give(ribbonSpare, vertices, buffers, resetRibbon, disposeRibbon);
}

/** `meshKey` is stable for one authored mesh (e.g. a prepared draw definition key). */
export function borrowMeshBuffers(meshKey: string, geometry: BufferGeometry): MeshBuffers {
  const held = meshSpare.get(meshKey)?.pop();
  if (held !== undefined) {
    drawBufferPoolStats.meshReuse += 1;
    return held;
  }
  drawBufferPoolStats.meshAlloc += 1;
  return meshBuffers(geometry);
}

export function releaseMeshBuffers(buffers: MeshBuffers, meshKey: string): void {
  resetMesh(buffers);
  const stack = meshSpare.get(meshKey) ?? [];
  if (stack.length < DRAW_BUFFER_SPARE) {
    stack.push(buffers);
    meshSpare.set(meshKey, stack);
    return;
  }
  disposeMesh(buffers);
}

function flushMap<T>(spare: Map<number, T[]>, dispose: (held: T) => void): void {
  for (const stack of spare.values()) for (const held of stack) dispose(held);
  spare.clear();
}

/** Drop every pooled buffer; call when the LTK runtime shuts down. */
export function flushDrawBufferPool(): void {
  flushMap(quadSpare, disposeQuad);
  flushMap(projectionSpare, disposeProjection);
  flushMap(ribbonSpare, disposeRibbon);
  for (const stack of meshSpare.values()) for (const held of stack) disposeMesh(held);
  meshSpare.clear();
}
