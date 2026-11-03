/**
 * Champion light of the board's own data (manifest `boards[key].lighting`, contracts.ts ChampionLighting): the texture
 * times clamp(six-colour ambient cube by the squared world normal × ambientScale + the model's selfIllumination ×
 * selfScale), as the original champion shader does, in place of the scene lights. No specular, no extra pass: the
 * lit term overrides the standard material's output, so skinning, opacity, alpha holes and emissive tints are kept.
 * Only models that carry `selfIllumination` take it (champions); boards, effects and the hover shells never do. One
 * shader program for every champion: the per-model value is a uniform, the cube and scales are shared uniforms.
 */
import { MeshStandardMaterial, Vector3, type Mesh, type Object3D } from 'three';
import { assertChampionLighting, assetUrl, type AssetManifest, type ChampionLighting } from '../../rendering3d';
import type { Quality3d } from './presentation-lighting';

export const CHAMPION_LIGHTING_KEY = 'champion-lighting-v1';
const shared = {
  championCube: { value: Array.from({ length: 6 }, () => new Vector3()) },
  championAmbientScale: { value: 0 },
  championSelfScale: { value: 0 },
};
const patched = new WeakSet<MeshStandardMaterial>();

/** The champion light of the board's entry, or null (no entry, quality off, unreadable or invalid: the old look). */
export async function loadChampionLighting(manifest: AssetManifest, assetBase: string | null, board: string, quality: Quality3d,
  read: (url: string) => Promise<unknown> = async url => {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`lighting-http-${response.status}`);
    return response.json();
  }): Promise<ChampionLightingApplier | null> {
  const path = manifest.boards?.[board]?.lighting?.path;
  if (!assetBase || !path || quality === 'off') return null;
  try {
    const value = await read(assetUrl(assetBase, path));
    assertChampionLighting(value);
    return createChampionLighting(manifest, value);
  } catch { return null; }
}

export interface ChampionLightingApplier {
  /** Patches the model's textured standard materials once (they are the template's, shared by every lease). */
  apply(scene: Object3D, id: string): void;
}

export function createChampionLighting(manifest: AssetManifest, lighting: ChampionLighting): ChampionLightingApplier {
  lighting.ambientCube.forEach((rgb, i) => shared.championCube.value[i].set(rgb[0], rgb[1], rgb[2]));
  shared.championAmbientScale.value = lighting.ambientScale;
  shared.championSelfScale.value = lighting.selfScale;
  return {
    apply(scene, id) {
      const self = Object.hasOwn(manifest.models, id) ? manifest.models[id].selfIllumination : undefined;
      if (self === undefined) return;
      scene.traverse(object => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          if (material instanceof MeshStandardMaterial && material.map && !patched.has(material)) patchMaterial(material, self);
      });
    },
  };
}

export function patchMaterial(material: MeshStandardMaterial, selfIllumination: number): void {
  patched.add(material);
  const self = { value: selfIllumination };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, shared, { championSelf: self });
    shader.vertexShader = 'uniform vec3 championCube[6];\nvarying vec3 vChampionAmbient;\n' + shader.vertexShader.replace('#include <skinnormal_vertex>',
      `#include <skinnormal_vertex>
vec3 championN = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);
vec3 championW = championN * championN;
vChampionAmbient = mix(championCube[0], championCube[1], step(championN.x, 0.0)) * championW.x
  + mix(championCube[2], championCube[3], step(championN.y, 0.0)) * championW.y
  + mix(championCube[4], championCube[5], step(championN.z, 0.0)) * championW.z;`);
    shader.fragmentShader = 'uniform float championAmbientScale;\nuniform float championSelfScale;\nuniform float championSelf;\nvarying vec3 vChampionAmbient;\n'
      + shader.fragmentShader.replace('#include <opaque_fragment>',
        `vec3 championLight = clamp(vChampionAmbient * championAmbientScale + championSelf * championSelfScale, 0.0, 1.0);
outgoingLight = diffuseColor.rgb * pow(championLight, vec3(2.2)) + totalEmissiveRadiance;
#include <opaque_fragment>`);
  };
  // The lit term replaces reflected light, so a metal/rough glTF default no longer darkens or greys the texture.
  material.customProgramCacheKey = () => CHAMPION_LIGHTING_KEY;
  material.needsUpdate = true;
}
