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
    for (const bad of [{ path: 'a.json', ...decode }, { path: 'a.png', gamma: 0, scale: 1 }, { path: 'a.png', gamma: 1, scale: -1 },
      { path: 'a.png', gamma: 1, scale: 17 }, { path: 'a.png', gamma: '1', scale: 1 }, null])
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
    expect(shader.uniforms.arenaLightmapScale.value).toBe(2.3);
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
    const applied = applyArenaLightmap(scene, new Texture(), decode)!;
    expect(mesh.material).toBe(material);
    expect(material.customProgramCacheKey()).toBe('arena-lightmap');
    applied.dispose();
    expect(Object.hasOwn(material, 'onBeforeCompile')).toBe(false);
    const none = new Group(); none.add(new Mesh(new PlaneGeometry(), new MeshBasicMaterial({ map: new Texture() })));
    expect(applyArenaLightmap(none, new Texture(), decode)).toBeNull();
  });
});
