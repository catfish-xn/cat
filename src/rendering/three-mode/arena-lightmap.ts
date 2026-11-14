/**
 * The original arena's baked lightmap (Map22 `BakedLight`). The converter keeps each lit mesh's lightmap UVs, already
 * placed on the shared atlas, as TEXCOORD_1 (`uv1`); meshes without it stay as they are. The arena is unlit, so the
 * light is multiplied into the diffuse colour in sRGB space: diffuse × pow(lightmap.rgb, gamma) × scale (per channel)
 * (BoardLightmap in contracts.ts; gamma/scale are our fit to TFT footage of the same arena, not original data).
 * The other textured arena meshes (trees, outer rocks, props), except the skybox, are multiplied by `tint` in the same
 * space when the board gives one: a colour grade of our own choice, so the whole island shares the lit ground's warmth.
 */
import { MeshBasicMaterial, NoColorSpace, Vector3, type Material, type Mesh, type Object3D, type Texture } from 'three';
import type { BoardLightmap } from '../../rendering3d';

/** An alias of `uv1` under our own name, so the patched shader never collides with three's own `uv1` declaration. */
export const ARENA_LIGHTMAP_UV = 'arenaLightmapUv';

export interface ArenaLightmap {
  /** Meshes that now draw the lightmap. */
  readonly meshes: number;
  /** Other meshes drawn with the board's tint (0 without one). */
  readonly tinted: number;
  /** Restores the materials and frees the clones; the texture belongs to the caller. */
  dispose(): void;
}

const patchable = (material: Material | Material[]): material is MeshBasicMaterial =>
  !Array.isArray(material) && material instanceof MeshBasicMaterial && material.map !== null;

/** The skybox (Skybox_A/B materials) keeps its own colours under the tint. */
const SKYBOX = /skybox/i;
const vec3 = (v: number | readonly [number, number, number]) => typeof v === 'number' ? new Vector3(v, v, v) : new Vector3(...v);

/** Patches every unlit, textured mesh of `scene` that carries `uv1`. Returns null when none does (no lightmap data). */
export function applyArenaLightmap(scene: Object3D, texture: Texture, decode: Pick<BoardLightmap, 'gamma' | 'scale' | 'tint'>): ArenaLightmap | null {
  const lit: Mesh[] = [], tinted: Mesh[] = [], unlit = new Set<Material>();
  scene.traverse(node => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry.getAttribute('uv1') && patchable(mesh.material)) { lit.push(mesh); return; }
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) unlit.add(material);
    if (decode.tint && patchable(mesh.material) && !SKYBOX.test(mesh.material.name)) tinted.push(mesh);
  });
  if (!lit.length) return null;
  // Atlas data, not colour: sampled as stored. A PNG must not be flipped (glTF UV origin is the top-left).
  texture.colorSpace = NoColorSpace; texture.flipY = false; texture.needsUpdate = true;
  const uniforms = {
    arenaLightmap: { value: texture }, arenaLightmapGamma: { value: decode.gamma },
    arenaLightmapScale: { value: vec3(decode.scale) },
  };
  const tint = { arenaTint: { value: vec3(decode.tint ?? 1) } };
  const patched = new Map<MeshBasicMaterial, MeshBasicMaterial>(), restore: [Mesh, Material][] = [], clones: Material[] = [];
  const patch = (source: MeshBasicMaterial): MeshBasicMaterial => {
    let material = patched.get(source);
    if (material) return material;
    // A material also drawn by a mesh without lightmap UVs would sample garbage there: that mesh keeps the original.
    material = unlit.has(source) ? source.clone() : source;
    if (material !== source) clones.push(material);
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = `attribute vec2 ${ARENA_LIGHTMAP_UV};\nvarying vec2 vArenaLightmapUv;\n`
        + shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\n\tvArenaLightmapUv = ${ARENA_LIGHTMAP_UV};`);
      shader.fragmentShader = 'uniform sampler2D arenaLightmap;\nuniform float arenaLightmapGamma;\nuniform vec3 arenaLightmapScale;\n'
        + 'varying vec2 vArenaLightmapUv;\n' + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
	{
		vec3 bakedLight = pow( texture2D( arenaLightmap, vArenaLightmapUv ).rgb, vec3( arenaLightmapGamma ) ) * arenaLightmapScale;
		vec3 shaded = sRGBTransferOETF( vec4( diffuseColor.rgb, 1.0 ) ).rgb * bakedLight;
		diffuseColor.rgb = sRGBTransferEOTF( vec4( clamp( shaded, 0.0, 1.0 ), 1.0 ) ).rgb;
	}`);
    };
    material.customProgramCacheKey = () => 'arena-lightmap';
    material.needsUpdate = true;
    patched.set(source, material);
    return material;
  };
  // Tinted meshes keep their source material (a lit mesh sharing it drew a clone above): the tint is patched in place.
  const tintedSources = new Set<MeshBasicMaterial>();
  const patchTint = (material: MeshBasicMaterial) => {
    if (tintedSources.has(material)) return;
    tintedSources.add(material);
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, tint);
      shader.fragmentShader = 'uniform vec3 arenaTint;\n' + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
	diffuseColor.rgb = sRGBTransferEOTF( vec4( clamp( sRGBTransferOETF( vec4( diffuseColor.rgb, 1.0 ) ).rgb * arenaTint, 0.0, 1.0 ), 1.0 ) ).rgb;`);
    };
    material.customProgramCacheKey = () => 'arena-tint';
    material.needsUpdate = true;
  };
  for (const mesh of lit) {
    const source = mesh.material as MeshBasicMaterial;
    mesh.geometry.setAttribute(ARENA_LIGHTMAP_UV, mesh.geometry.getAttribute('uv1'));
    restore.push([mesh, source]);
    mesh.material = patch(source);
  }
  for (const mesh of tinted) patchTint(mesh.material as MeshBasicMaterial);
  return {
    meshes: lit.length, tinted: tinted.length,
    dispose() {
      for (const [mesh, source] of restore) { mesh.material = source; mesh.geometry.deleteAttribute(ARENA_LIGHTMAP_UV); }
      const unpatch = (material: MeshBasicMaterial) => {
        const own = material as unknown as Record<string, unknown>;
        delete own.onBeforeCompile; delete own.customProgramCacheKey; material.needsUpdate = true;
      };
      for (const material of patched.keys()) if (!clones.includes(patched.get(material)!)) unpatch(material);
      for (const material of tintedSources) unpatch(material);
      for (const clone of clones) clone.dispose();
      restore.length = 0; clones.length = 0; patched.clear(); tintedSources.clear();
    },
  };
}
