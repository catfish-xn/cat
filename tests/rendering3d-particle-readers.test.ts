import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, SkinnedMesh, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadParticleEffect, readParticleMesh } from '../src/rendering3d';

const manifest = { schemaVersion: 1 as const, models: {}, effects: { sample: { path: 'effects/sample.json' } } };
const document = { schemaVersion: 2, limits: { maxParticles: 10, maxDuration: 10 }, emitters: [
  { kind: 'mesh', mesh: 'meshes/sample.glb', texture: 'textures/sample.png',
    emission: { mode: 'burst', count: 1 }, lifetime: 1 },
] };
afterEach(() => { vi.restoreAllMocks(); });
function model() {
  const scene = new Group(), geometry = new BoxGeometry(2, 2, 2), material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material); mesh.position.x = 10; scene.add(mesh);
  return { scene, animations: [], geometry, material };
}

describe('particle cached readers', () => {
  it('loads JSON, mesh and texture through hooks without fetch and releases owned resources once', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected-network'));
    const source = model(), geometryDispose = vi.spyOn(source.geometry, 'dispose');
    const materialDispose = vi.spyOn(source.material, 'dispose');
    const readModel = vi.fn(async () => source);
    const readJson = vi.fn(async () => document), texture = new Texture();
    const textureDispose = vi.spyOn(texture, 'dispose'), readTexture = vi.fn(async () => texture);
    const effect = await loadParticleEffect(manifest, 'sample', { root: '/synthetic/', readJson, readTexture,
      readMesh: url => readParticleMesh(url, readModel) });
    expect(readJson).toHaveBeenCalledExactlyOnceWith('/synthetic/effects/sample.json');
    expect(readModel).toHaveBeenCalledExactlyOnceWith('/synthetic/meshes/sample.glb');
    expect(readTexture).toHaveBeenCalledExactlyOnceWith('/synthetic/textures/sample.png');
    expect(fetch).not.toHaveBeenCalled(); expect(effect.particleCount).toBe(1);
    const geometry = (effect.object.children[0] as Mesh).geometry;
    expect(geometry).not.toBe(source.geometry);
    geometry.computeBoundingBox(); expect(geometry.boundingBox!.min.x).toBe(9);
    expect(geometryDispose).toHaveBeenCalledTimes(1); expect(materialDispose).toHaveBeenCalledTimes(1);
    const dispose = vi.spyOn(geometry, 'dispose');
    effect.dispose(); effect.dispose();
    expect(dispose).toHaveBeenCalledTimes(1); expect(textureDispose).toHaveBeenCalledTimes(1);
  });
  it('rejects failed or invalid JSON before requesting dependent resources', async () => {
    const readMesh = vi.fn(), readTexture = vi.fn();
    for (const readJson of [async () => { throw new Error('json-failed'); }, async () => ({ schemaVersion: 10 })]) {
      await expect(loadParticleEffect(manifest, 'sample', { readJson, readMesh, readTexture })).rejects.toThrow();
    }
    expect(readMesh).not.toHaveBeenCalled(); expect(readTexture).not.toHaveBeenCalled();
  });
  it('preserves default JSON HTTP errors and omitted-mesh skipping', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(Response.json(document));
    await expect(loadParticleEffect(manifest, 'sample', { root: '/synthetic/' })).rejects.toThrow('particle-http-404');
    const readTexture = vi.fn();
    const effect = await loadParticleEffect(manifest, 'sample', { root: '/synthetic/', readTexture });
    expect(fetch).toHaveBeenCalledTimes(2); expect(fetch).toHaveBeenLastCalledWith('/synthetic/effects/sample.json');
    expect(effect.skipped.mesh).toBe(1); expect(readTexture).not.toHaveBeenCalled(); effect.dispose();
  });
  it('keeps a particle mesh\'s vertex colours when the adapter reads it from a model', async () => {
    const source = model();
    const count = source.geometry.getAttribute('position').count;
    source.geometry.setAttribute('color', new Float32BufferAttribute(new Array(count * 3).fill(0.5), 3));
    const geometry = await readParticleMesh('/synthetic/meshes/coloured.glb', async () => source);
    try {
      expect(geometry.getAttribute('color')?.count).toBe(count);
      expect(geometry.getAttribute('color')?.getX(0)).toBeCloseTo(0.5);
    } finally { geometry.dispose(); }
  });
  it('defaults the static mesh adapter to the existing GLB reader', async () => {
    const source = model();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new ArrayBuffer(10)));
    const parse = vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockResolvedValue(source as never);
    const geometry = await readParticleMesh('/synthetic/meshes/sample.glb');
    expect(parse).toHaveBeenCalledWith(expect.any(ArrayBuffer), '/synthetic/meshes/');
    expect(geometry).not.toBe(source.geometry); geometry.dispose();
  });
  it('rejects ambiguous mesh documents and still disposes the source', async () => {
    const source = model(); source.scene.add(new Mesh(source.geometry, source.material));
    const dispose = vi.spyOn(source.geometry, 'dispose');
    await expect(readParticleMesh('/synthetic/sample.glb', async () => source)).rejects.toThrow('particle-mesh-requires-single-static-mesh');
    expect(dispose).toHaveBeenCalledTimes(1);
  });
  it.each(['multiple meshes', 'skinned mesh', 'no mesh'])('isolates adapter rejection for %s from the remaining effect', async kind => {
    const source = model();
    if (kind === 'multiple meshes') source.scene.add(new Mesh(source.geometry, source.material));
    if (kind === 'skinned mesh') {
      source.scene.clear(); source.scene.add(new SkinnedMesh(source.geometry, source.material));
    }
    if (kind === 'no mesh') {
      source.scene.clear(); source.geometry.dispose(); source.material.dispose();
    }
    const readTexture = vi.fn(async () => { throw new Error('synthetic-unused-texture'); });
    const effect = await loadParticleEffect(manifest, 'sample', { maxParticles: 1,
      readJson: async () => ({ ...document, emitters: [...document.emitters,
        { kind: 'quad', emission: { mode: 'burst', count: 1 }, lifetime: 1 }] }),
      readMesh: url => readParticleMesh(url, async () => source), readTexture,
    });
    try {
      expect(effect.skipped.mesh).toBe(1); expect(effect.particleCount).toBe(1);
      expect(effect.object.children[0].visible).toBe(true); expect(effect.droppedParticles).toBe(0);
      expect(readTexture).not.toHaveBeenCalled();
    } finally { effect.dispose(); }
  });
  it.each([
    ['an adapter error code', async () => { throw new Error('ambiguous-particle-mesh'); }, 'mesh-resource-unavailable:ambiguous-particle-mesh'],
    ['an HTTP failure', async () => { throw new Error('particle-http-404'); }, 'mesh-resource-unavailable:http-404'],
    ['an uncoded failure', async () => { throw new Error('Something odd happened'); }, 'mesh-resource-unavailable:read-failed'],
  ] as const)('carries the error code for %s in the mesh skip reason', async (_label, readMesh, reason) => {
    const effect = await loadParticleEffect(manifest, 'sample', { readJson: async () => document, readMesh, readTexture: vi.fn() });
    try {
      expect(effect.skipped.mesh).toBe(1);
      expect(effect.skippedReasons).toEqual([{ emitterIndex: 0, kind: 'mesh', reason }]);
    } finally { effect.dispose(); }
  });
  it('names the missing mesh reader when none is supplied', async () => {
    const effect = await loadParticleEffect(manifest, 'sample', { readJson: async () => document, readTexture: vi.fn() });
    try { expect(effect.skippedReasons.map(s => s.reason)).toEqual(['mesh-resource-unavailable:no-mesh-reader']); }
    finally { effect.dispose(); }
  });
});
