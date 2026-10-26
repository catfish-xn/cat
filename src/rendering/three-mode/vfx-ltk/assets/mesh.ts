/*! @license GPL-3.0-or-later
 * Derived from ltk-manager. Source: src/modules/workshop/bin/vfx/rendering/hooks/useVfxMeshes.ts
 * Bare asset reader adaptation, 2026-10-26. See NOTICE.md and LICENSE.
 */
/** Converted LTKG/LTKS/LTKA assets; geometry and palettes keep the upstream mirrored coordinate contract. */
import { BufferAttribute, BufferGeometry } from 'three';
import type { MeshModel } from '../engine/model/model';
import { AXIS_SIGN } from '../space';
import { readMeshBuffer } from './meshBuffer';
import { readSkeletonBuffer } from './skeletonBuffer';
import { readClipBuffer } from './clipBuffer';
import { createPose, type Pose } from './pose';
import { drawnIndices } from './submeshes';
import { skinWeights } from '../rendering/utils/meshPose';
import { fnv1a32 } from '../binHash';

export interface ConvertedMesh { geometry: BufferGeometry; pose: Pose | null }
export async function readConvertedMesh(model: MeshModel, read: (path: string) => Promise<ArrayBuffer>, key = ''): Promise<ConvertedMesh> {
  if (!model.path) throw new Error('mesh-path');
  // Same definition-level variant choice as upstream useVfxMeshes, stable across casts.
  const animation = model.animationVariants.length ? model.animationVariants[fnv1a32(`${model.path}:${key}`) % model.animationVariants.length] : model.animation;
  const [bytes, skeletonBytes, clipBytes] = await Promise.all([
    read(model.path), model.skinned && model.skeleton ? read(model.skeleton.path) : null,
    model.skinned && animation ? read(animation.path) : null,
  ]);
  const mesh = readMeshBuffer(bytes), geometry = new BufferGeometry();
  if (mesh.indices.some(index => index >= mesh.positions.length / 3)) throw new Error('mesh-index');
  const mirrored = (values: Float32Array) => values.map((n, at) => n * AXIS_SIGN[at % 3]);
  geometry.setAttribute('position', new BufferAttribute(mirrored(mesh.positions), 3));
  if (mesh.uvs) geometry.setAttribute('uv', new BufferAttribute(mesh.uvs, 2));
  geometry.setAttribute('vertexColor', new BufferAttribute(mesh.colors ?? new Uint8Array(mesh.positions.length / 3 * 4).fill(255), 4, true));
  const indices = drawnIndices(mesh, model.submeshes, model.submeshesAlways).slice();
  for (let at = 0; at + 2 < indices.length; at += 3) [indices[at + 1], indices[at + 2]] = [indices[at + 2], indices[at + 1]];
  geometry.setIndex(new BufferAttribute(indices, 1));
  if (mesh.normals) geometry.setAttribute('normal', new BufferAttribute(mirrored(mesh.normals), 3));
  else geometry.computeVertexNormals();
  let pose: Pose | null = null;
  try {
    if (model.skinned) {
      if (!skeletonBytes || !mesh.skinIndices || !mesh.skinWeights) throw new Error('mesh-skin-missing');
      const skeleton = readSkeletonBuffer(skeletonBytes);
      geometry.setAttribute('skinIndex', new BufferAttribute(mesh.skinIndices, 4));
      geometry.setAttribute('skinWeight', new BufferAttribute(skinWeights(mesh, skeleton.influences.length), 4));
      pose = createPose(skeleton, clipBytes ? readClipBuffer(clipBytes) : null);
    }
    geometry.computeBoundingSphere();
    return { geometry, pose };
  } catch (error) { geometry.dispose(); throw error; }
}
