/*! @license GPL-3.0-or-later
 * Derived from ltk-manager. Source: src/modules/workshop/bin/vfx/rendering/components/AttachedMeshes.tsx
 * Bare Three.js adaptation, 2026-10-26. See NOTICE.md and LICENSE.
 */
import { BackSide, DetachedBindMode, DoubleSide, FrontSide, Matrix4, MeshBasicMaterial, SkinnedMesh, type Material, type Object3D } from 'three';
import { nameHash } from '../../binHash';
import type { EmitterModel } from '../../engine/model/model';
import { age01, appearance, erosionDrive, type Source } from '../../engine/simulation/particleRead';
import type { EmitterSamplers } from '../hooks/useVfxTextures';
import type { ParticleDraw } from '../lifetime';
import { attachedMaterial } from '../utils/materials';
import { layersOf } from '../utils/uniforms';
import { fragmentTests, premultiplyInto } from '../utils/blend';
import { layerOf, uvDraw, uvTransformInto } from '../utils/uvTransform';
import { sourcesScrollInto } from '../utils/palette';

/**
 * Overlays one attached emitter keeps per host skin: its live particles beyond this draw nothing (11-11, Fable: 4 for now,
 * raised only on field data; `ATTACHED_STATS.peakAlive` is that data).
 */
export const ATTACHED_SLOTS = 4;
/** Field data for the slot and screen caps: most live particles one attached emitter held, and frames it held more than its slots. */
export const ATTACHED_STATS = { peakAlive: 0, overSlotFrames: 0 };
export function resetAttachedStats() { ATTACHED_STATS.peakAlive = 0; ATTACHED_STATS.overSlotFrames = 0; }
/** Marks an overlay draw, so the runtime can count and cap them across systems. */
export interface AttachedDraw extends ParticleDraw { readonly attached: true }
export const isAttachedDraw = (draw: ParticleDraw): draw is AttachedDraw => (draw as Partial<AttachedDraw>).attached === true;

const materialsOf = (mesh: SkinnedMesh): readonly Material[] => Array.isArray(mesh.material) ? mesh.material : [mesh.material];
/**
 * Which materials of `skin` a part filter keeps, or null when the emitter has no filter (the whole body draws).
 * A part is matched by its material's name, or for a single-material skin by the node's own name, hashed as the bin hashes it.
 */
function partsKept(skin: SkinnedMesh, filter: EmitterModel['attachedSubmeshes']): boolean[] | null {
  if (!filter) return null;
  const wanted = new Set([...filter.draw, ...filter.always].map(hash => hash.toLowerCase()));
  const held = materialsOf(skin);
  const named = (name: string) => !!name && wanted.has(nameHash(name));
  return held.map(material => named(material.name) || (held.length === 1 && named(skin.name)));
}
const missingParts = new Set<string>();

/**
 * Each avatar overlay borrows the live skeleton and geometry. Neither is disposed by the effect.
 *
 * An emitter that names parts (a weapon, a dress) draws only those; when the host's model holds none of them it draws
 * nothing and says so once, never the whole body instead (11-11, Fable: a whole-body glow is worse than none).
 */
export function createAttachedMeshes(emitter: EmitterModel, sources: readonly Source[], samplers: EmitterSamplers,
  rank: number, parent: Object3D, attachment?: { root: Object3D; body: Object3D | null; disposed?: boolean }): AttachedDraw[] {
  const skins: { source: SkinnedMesh; kept: boolean[] | null }[] = [];
  attachment?.body?.traverse(node => {
    if (!(node as SkinnedMesh).isSkinnedMesh || !node.visible) return;
    const source = node as SkinnedMesh, kept = partsKept(source, emitter.attachedSubmeshes);
    if (!kept || kept.some(Boolean)) skins.push({ source, kept });
  });
  if (emitter.attachedSubmeshes && !skins.length) {
    const key = `${emitter.name}\n${attachment?.body?.name ?? ''}`;
    if (!missingParts.has(key)) { missingParts.add(key); console.warn(`vfx-ltk:attached-parts-missing:${emitter.name}:${attachment?.body?.name ?? ''}`); }
    return [];
  }
  return skins.flatMap(({ source, kept }) => Array.from({ length: ATTACHED_SLOTS }, (_, slot): AttachedDraw => {
    const material = attachedMaterial(emitter.blendMode, samplers.base, emitter.depthBias,
      layersOf(emitter, samplers, { ramp: false, sheen: true, fade: false }), fragmentTests(emitter),
      emitter.backfaceCull ? emitter.flipWinding ? BackSide : FrontSide : DoubleSide);
    const skipped = new MeshBasicMaterial({ visible: false });
    const draws = (held: Material, at: number) => held.visible && (!kept || kept[at]);
    const mesh = new SkinnedMesh(source.geometry, Array.isArray(source.material)
      ? source.material.map((held, at) => draws(held, at) ? material : skipped) : material);
    mesh.bindMode = DetachedBindMode; mesh.bind(source.skeleton, source.bindMatrix);
    // DetachedBindMode resets the inverse during scene traversal. The source's live inverse
    // must be installed after that traversal, before uniforms are uploaded.
    mesh.onBeforeRender = () => { mesh.bindMatrixInverse.copy(source.bindMatrixInverse); };
    mesh.name = `${emitter.name}#${emitter.index}.${slot}`; mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.renderOrder = rank;
    const drawn = { scale: new Float32Array(3), color: new Float32Array(4) }, uv = uvDraw();
    const inverse = new Matrix4(), origin = new Matrix4(), scale = new Matrix4();
    let closed = false;
    return { object: mesh, material, attached: true,
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
        if (slot === 0) {
          let alive = 0;
          for (const held of sources) for (let at = 0; at < held.pool.count; at++) if (held.pool.emitter[at] === emitter.index) alive++;
          if (alive > ATTACHED_STATS.peakAlive) ATTACHED_STATS.peakAlive = alive;
          if (alive > ATTACHED_SLOTS) ATTACHED_STATS.overSlotFrames++;
        }
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
