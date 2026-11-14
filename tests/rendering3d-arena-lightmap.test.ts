import { describe, expect, it } from 'vitest';
import { BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, ShaderLib, Texture, type WebGLProgramParametersWithUniforms } from 'three';
import { ARENA_LIGHTMAP_UV, applyArenaLightmap } from '../src/rendering/three-mode/arena-lightmap';
import { assertManifest } from '../src/rendering3d/contracts';

// Synthetic arena: one lit mesh (uv1), one unlit mesh sharing its material, one untextured mesh.
const decode = { gamma: 0.5, scale: 2.3 };
const lit = () => { const g = new PlaneGeometry(); g.setAttribute('uv1', new BufferAttribute(new Float32Array(g.attributes.uv.count * 2), 2)); return g; };
const compile = (material: MeshBasicMaterial) => {
  const shader = { uniforms: {}, vertexShader: ShaderLib.basic.vertexShader, fragmentShader: ShaderLib.basic.fragmentShader } as unknown as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, undefined as never);
  return shader as unknown as { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string };
};
const board = { alignment: { scale: [1, 1, 1], offset: [0, 0, 0], target: { radius: 1, origin: { x: 0, y: 0 } } } };

describe('3D arena baked lightmap', () => {
  it('validates the optional manifest field and keeps roots without it valid', () => {
    const root = (lightmap?: unknown) => ({ schemaVersion: 1, models: { b: { path: 'b.glb' } }, boards: { b: { ...board, ...(lightmap === undefined ? {} : { lightmap }) } } });
    expect(() => assertManifest(root())).not.toThrow();
    expect(() => assertManifest(root({ path: 'lighting/a.png', ...decode }))).not.toThrow();
    expect(() => assertManifest(root({ path: 'lighting/a.ktx2', ...decode }))).not.toThrow();
    expect(() => assertManifest(root({ path: 'lighting/a.png', gamma: 0.5, scale: [2.5, 2.3, 1.9] }))).not.toThrow();
    expect(() => assertManifest(root({ path: 'lighting/a.png', gamma: 0.5, scale: 2, tint: [1.2, 1, 0.8] }))).not.toThrow();
    for (const bad of [{ path: 'a.json', ...decode }, { path: 'a.png', gamma: 0, scale: 1 }, { path: 'a.png', gamma: 1, scale: -1 },
      { path: 'a.png', gamma: 1, scale: 17 }, { path: 'a.png', gamma: '1', scale: 1 }, { path: 'a.png', gamma: 1, scale: [1, 1] },
      { path: 'a.png', gamma: 1, scale: [1, 0, 1] }, { path: 'a.png', gamma: 1, scale: 1, tint: [1, 1] },
      { path: 'a.png', gamma: 1, scale: 1, tint: [1, 0, 1] }, { path: 'a.png', gamma: 1, scale: 1, tint: 1 }, null])
      expect(() => assertManifest(root(bad))).toThrow('invalid-board-lightmap');
    expect(() => assertManifest(root({ path: '../a.png', ...decode }))).toThrow('invalid-asset-path');
  });

  it('multiplies the lightmap into the lit meshes only and restores them on dispose', () => {
    const shared = new MeshBasicMaterial({ map: new Texture() });
    const scene = new Group(), litMesh = new Mesh(lit(), shared), plainMesh = new Mesh(new PlaneGeometry(), shared);
    const untextured = new Mesh(lit(), new MeshBasicMaterial()), standard = new Mesh(lit(), new MeshStandardMaterial({ map: new Texture() }));
    scene.add(litMesh, plainMesh, untextured, standard);
    const texture = new Texture(); texture.flipY = true;
    const applied = applyArenaLightmap(scene, texture, decode)!;
    expect(applied.meshes).toBe(1);
    // The mesh without lightmap UVs keeps the original; the lit one draws a patched clone.
    expect(plainMesh.material).toBe(shared);
    expect(litMesh.material).not.toBe(shared);
    expect(untextured.material).toBeInstanceOf(MeshBasicMaterial);
    expect(litMesh.geometry.getAttribute(ARENA_LIGHTMAP_UV)).toBe(litMesh.geometry.getAttribute('uv1'));
    expect(texture.flipY).toBe(false);
    const shader = compile(litMesh.material as MeshBasicMaterial);
    expect(shader.uniforms.arenaLightmap.value).toBe(texture);
    expect(shader.uniforms.arenaLightmapGamma.value).toBe(0.5);
    expect((shader.uniforms.arenaLightmapScale.value as { toArray(): number[] }).toArray()).toEqual([2.3, 2.3, 2.3]);
    expect(shader.vertexShader).toContain(`vArenaLightmapUv = ${ARENA_LIGHTMAP_UV};`);
    expect(shader.fragmentShader).toMatch(/#include <map_fragment>\s*\{\s*vec3 bakedLight/);
    expect((litMesh.material as MeshBasicMaterial).customProgramCacheKey()).toBe('arena-lightmap');
    applied.dispose();
    expect(litMesh.material).toBe(shared);
    expect(litMesh.geometry.getAttribute(ARENA_LIGHTMAP_UV)).toBeUndefined();
  });

  it('patches a material in place when no unlit mesh shares it, and leaves arenas without lightmap UVs alone', () => {
    const material = new MeshBasicMaterial({ map: new Texture() }), scene = new Group(), mesh = new Mesh(lit(), material);
    scene.add(mesh);
    const applied = applyArenaLightmap(scene, new Texture(), { gamma: 0.5, scale: [2.5, 2.3, 1.9] })!;
    expect(mesh.material).toBe(material);
    expect((compile(material).uniforms.arenaLightmapScale.value as { toArray(): number[] }).toArray()).toEqual([2.5, 2.3, 1.9]);
    expect(material.customProgramCacheKey()).toBe('arena-lightmap');
    applied.dispose();
    expect(Object.hasOwn(material, 'onBeforeCompile')).toBe(false);
    const none = new Group(); none.add(new Mesh(new PlaneGeometry(), new MeshBasicMaterial({ map: new Texture() })));
    expect(applyArenaLightmap(none, new Texture(), decode)).toBeNull();
  });

  it('tints the other textured meshes except the skybox, keeps lit clones apart, and restores them on dispose', () => {
    const shared = new MeshBasicMaterial({ map: new Texture() }), sky = new MeshBasicMaterial({ map: new Texture() });
    sky.name = 'Maps/KitPieces/TFT/Materials/Default/Default/Skybox_A_MAT';
    const scene = new Group(), litMesh = new Mesh(lit(), shared), tree = new Mesh(new PlaneGeometry(), shared), skyMesh = new Mesh(new PlaneGeometry(), sky);
    const plain = new Mesh(new PlaneGeometry(), new MeshBasicMaterial());
    scene.add(litMesh, tree, skyMesh, plain);
    const applied = applyArenaLightmap(scene, new Texture(), { gamma: 0.5, scale: 2, tint: [1.2, 1, 0.8] })!;
    expect([applied.meshes, applied.tinted]).toEqual([1, 1]);
    expect(tree.material).toBe(shared);
    expect(litMesh.material).not.toBe(shared);
    expect(shared.customProgramCacheKey()).toBe('arena-tint');
    expect((litMesh.material as MeshBasicMaterial).customProgramCacheKey()).toBe('arena-lightmap');
    expect(Object.hasOwn(sky, 'onBeforeCompile')).toBe(false);
    expect(Object.hasOwn(plain.material as MeshBasicMaterial, 'onBeforeCompile')).toBe(false);
    const shader = compile(shared);
    expect((shader.uniforms.arenaTint.value as { toArray(): number[] }).toArray()).toEqual([1.2, 1, 0.8]);
    expect(shader.fragmentShader).toMatch(/#include <map_fragment>\s*diffuseColor\.rgb = sRGBTransferEOTF\(.*\* arenaTint/);
    applied.dispose();
    expect(litMesh.material).toBe(shared);
    expect(Object.hasOwn(shared, 'onBeforeCompile')).toBe(false);
    expect(Object.hasOwn(shared, 'customProgramCacheKey')).toBe(false);
  });

  it('tints nothing without a tint', () => {
    const shared = new MeshBasicMaterial({ map: new Texture() }), scene = new Group();
    scene.add(new Mesh(lit(), shared), new Mesh(new PlaneGeometry(), shared));
    expect(applyArenaLightmap(scene, new Texture(), decode)!.tinted).toBe(0);
    expect(Object.hasOwn(shared, 'onBeforeCompile')).toBe(false);
  });
});
