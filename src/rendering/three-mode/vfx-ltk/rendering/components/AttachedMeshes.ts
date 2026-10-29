/*! @license GPL-3.0-or-later
 * Derived from ltk-manager. Source: src/modules/workshop/bin/vfx/rendering/components/AttachedMeshes.tsx
 * Bare Three.js adaptation, 2026-10-26. See NOTICE.md and LICENSE.
 */
import { BackSide, DetachedBindMode, DoubleSide, FrontSide, Matrix4, MeshBasicMaterial, SkinnedMesh, type Object3D } from 'three';
import type { EmitterModel } from '../../engine/model/model';
import { age01, appearance, erosionDrive, type Source } from '../../engine/simulation/particleRead';
import type { EmitterSamplers } from '../hooks/useVfxTextures';
import type { ParticleDraw } from '../lifetime';
import { attachedMaterial } from '../utils/materials';
import { layersOf } from '../utils/uniforms';
import { fragmentTests, premultiplyInto } from '../utils/blend';
import { layerOf, uvDraw, uvTransformInto } from '../utils/uvTransform';
import { sourcesScrollInto } from '../utils/palette';

/** Each avatar overlay borrows the live skeleton and geometry. Neither is disposed by the effect. */
export function createAttachedMeshes(emitter: EmitterModel, sources: readonly Source[], samplers: EmitterSamplers,
  rank: number, parent: Object3D, attachment?: { root: Object3D; body: Object3D | null; disposed?: boolean }): ParticleDraw[] {
  const skins: SkinnedMesh[] = [];
  attachment?.body?.traverse(node => { if ((node as SkinnedMesh).isSkinnedMesh && node.visible) skins.push(node as SkinnedMesh); });
  return skins.flatMap(source => Array.from({ length: 8 }, (_, slot): ParticleDraw => {
    const material = attachedMaterial(emitter.blendMode, samplers.base, emitter.depthBias,
      layersOf(emitter, samplers, { ramp: false, sheen: true, fade: false }), fragmentTests(emitter),
      emitter.backfaceCull ? emitter.flipWinding ? BackSide : FrontSide : DoubleSide);
    const skipped = new MeshBasicMaterial({ visible: false });
    const mesh = new SkinnedMesh(source.geometry, Array.isArray(source.material)
      ? source.material.map(held => held.visible ? material : skipped) : material);
    mesh.bindMode = DetachedBindMode; mesh.bind(source.skeleton, source.bindMatrix);
    // DetachedBindMode resets the inverse during scene traversal. The source's live inverse
    // must be installed after that traversal, before uniforms are uploaded.
    mesh.onBeforeRender = () => { mesh.bindMatrixInverse.copy(source.bindMatrixInverse); };
    mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.renderOrder = rank;
    const drawn = { scale: new Float32Array(3), color: new Float32Array(4) }, uv = uvDraw();
    const inverse = new Matrix4(), origin = new Matrix4(), scale = new Matrix4();
    let closed = false;
    return { object: mesh, material,
      update() {
        if (closed) return;
        let ancestor: Object3D | null = source;
        while (ancestor && ancestor !== attachment?.body) ancestor = ancestor.parent;
        // A model swap/removal may release the borrowed skeleton while particles linger.
        if (attachment?.disposed || !attachment?.body || !ancestor) { mesh.visible = false; return; }
        let wanted = slot, found = false;
        const tint = material.uniforms.particleTint.value as number[];
        const turn = material.uniforms.particleTurn.value as number[];
        const turnMult = material.uniforms.particleTurnMult.value as number[];
        const shift = material.uniforms.particleShift.value as number[];
        const shiftMult = material.uniforms.particleShiftMult.value as number[];
        for (const held of sources) {
          const pool = held.pool, time = held.time;
          for (let at = 0; at < pool.count; at++) {
            if (pool.emitter[at] !== emitter.index || wanted-- !== 0) continue;
            appearance(pool, at, emitter, time, drawn); premultiplyInto(emitter, drawn.color);
            tint[0] = drawn.color[0]; tint[1] = drawn.color[1]; tint[2] = drawn.color[2]; tint[3] = drawn.color[3];
            material.uniforms.particleErode.value = erosionDrive(pool, at, emitter, time);
            for (let layer = 0; layer < 2; layer++) {
              const over = layerOf(emitter, layer); if (!over) continue;
              uvTransformInto(pool, at, over, layer, time - pool.birthTime[at], age01(pool, at, time), time, uv);
              const turnOut = layer ? turnMult : turn, shiftOut = layer ? shiftMult : shift;
              turnOut[0] = uv.turn; turnOut[1] = uv.scaleU; turnOut[2] = uv.scaleV;
              shiftOut[0] = uv.offsetU; shiftOut[1] = uv.offsetV; shiftOut[2] = uv.cellU; shiftOut[3] = uv.cellV;
            }
            sourcesScrollInto(emitter, sources, material.uniforms.paletteScroll.value);
            source.updateWorldMatrix(true, false); attachment!.root.updateWorldMatrix(true, false); parent.updateWorldMatrix(true, false);
            origin.copy(attachment!.root.matrixWorld); inverse.copy(origin).invert(); scale.makeScale(drawn.scale[0], drawn.scale[1], drawn.scale[2]);
            mesh.matrix.copy(parent.matrixWorld).invert().multiply(origin).multiply(scale).multiply(inverse).multiply(source.matrixWorld);
            mesh.bindMatrixInverse.copy(source.bindMatrixInverse); mesh.matrixWorldNeedsUpdate = true;
            found = true; break;
          }
          if (found) break;
        }
        mesh.visible = found && source.visible;
      },
      dispose() { if (closed) return; closed = true; mesh.removeFromParent(); material.dispose(); skipped.dispose(); },
    };
  }));
}
