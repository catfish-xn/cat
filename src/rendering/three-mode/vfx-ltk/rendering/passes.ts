/*! @license GPL-3.0-or-later
 * Derived from ltk-manager. Source: src/modules/workshop/bin/vfx/rendering/components/Passes.tsx
 * Bare host adaptation, 2026-10-26. See NOTICE.md and LICENSE.
 */
/** Bare host for upstream Passes.tsx phase ordering. Restores host state even when a draw fails. */
import { DoubleSide, MeshBasicMaterial, type Camera, type Material, type Mesh, type Object3D, type Scene, type WebGLRenderer } from 'three';
import { bindFrameTargets, grabDepth, grabFrame, releaseFrame, SCENE_LAYER, UNDER_LAYER, PARTICLE_LAYER, EARLY_DISTORTION_LAYER, DISTORTION_LAYER, FLOOR_LAYER, GROUND_LAYER, sealCanvasAlpha } from './utils/frame';

/** Visit `node` and its descendants, skipping bone hierarchies under skinned units. */
function walkDrawable(node: Object3D, visit: (node: Object3D) => void): void {
  const skinned = node as { isBone?: boolean; isSkinnedMesh?: boolean };
  if (skinned.isBone) return;
  visit(node);
  if (skinned.isSkinnedMesh) return;
  for (const child of node.children) walkDrawable(child, visit);
}
/**
 * World height (board units, the floor at 0) under which the floor writes no depth: a particle that reaches below the board
 * is drawn whole over it, as a camera-facing glow half sunk into the ground (Gangplank's ground tar, 11-14) showed a
 * straight cut. Walls, stands and terrain above it still occlude. A fitted value (11-14), not the original's: the original
 * is inferred not to cut particles at its floor from one ground glow seen whole in its footage.
 */
export const FLOOR_DEPTH_FROM = 5;
/**
 * The depth-only material the floor is drawn again with after its depth is cleared: it writes no colour and keeps only
 * the fragments at or above `from` world height (FLOOR_DEPTH_FROM).
 */
export function floorDepthMaterial(from = FLOOR_DEPTH_FROM): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ colorWrite: false, side: DoubleSide });
  material.name = 'vfx-floor-depth';
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vFloorY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vec4 floorWorld = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n  floorWorld = instanceMatrix * floorWorld;\n#endif\n  vFloorY = (modelMatrix * floorWorld).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFloorY;')
      .replace('void main() {', `void main() {\n  if (vFloorY < ${from.toFixed(3)}) discard;`);
  };
  material.customProgramCacheKey = () => `vfx-floor-depth-${from}`;
  return material;
}
export function createVfxPasses(gl: WebGLRenderer, floors?: () => readonly Object3D[]) {
  const floorDepth = floorDepthMaterial();
  const masks = new Map<Object3D, number>(), ground = new Map<Material, Pick<Material, 'depthWrite' | 'polygonOffset' | 'polygonOffsetFactor' | 'polygonOffsetUnits'>>();
  return {
    render(scene: Scene, camera: Camera, needs: { early: boolean; late: boolean; soft: boolean }) {
      const layers = camera.layers.mask, autoClear = gl.autoClear, background = scene.background, target = gl.getRenderTarget();
      masks.clear(); ground.clear();
      const draw = (held: readonly number[], over = false) => {
        camera.layers.disableAll(); for (const layer of held) camera.layers.enable(layer);
        gl.autoClear = over ? false : autoClear; scene.background = over ? null : background; gl.render(scene, camera);
      };
      try {
        bindFrameTargets(gl);
        if (needs.soft) grabDepth(gl, scene, camera);
        const first = needs.late ? [UNDER_LAYER] : [UNDER_LAYER, PARTICLE_LAYER];
        walkDrawable(scene, node => {
          if (!node.layers.isEnabled(GROUND_LAYER)) return;
          const material = (node as Mesh).material;
          for (const one of material ? Array.isArray(material) ? material : [material] : [])
            if (!ground.has(one)) ground.set(one, { depthWrite: one.depthWrite, polygonOffset: one.polygonOffset,
              polygonOffsetFactor: one.polygonOffsetFactor, polygonOffsetUnits: one.polygonOffsetUnits });
        });
        const floorRoots = floors?.() ?? [];
        if (floorRoots.length) {
          // The floor draws first, on its own. Separate calls avoid Three's opaque/transparent sorting putting ground
          // beneath opaque hexes or beneath the arena's transparent cell overlay.
          for (const root of floorRoots) root.traverse(node => { masks.set(node, node.layers.mask); node.layers.set(FLOOR_LAYER); });
          walkDrawable(scene, node => {
            if ((node as { isLight?: boolean }).isLight) { masks.set(node, node.layers.mask); node.layers.enable(FLOOR_LAYER); }
          });
          draw([FLOOR_LAYER]);
          // The floor keeps its colour but not its depth below FLOOR_DEPTH_FROM: a particle reaching below the board is not
          // cut by it, while walls, stands and terrain above write their depth again, and units drawn after write theirs.
          gl.clearDepth();
          const override = scene.overrideMaterial; scene.overrideMaterial = floorDepth;
          try { draw([FLOOR_LAYER], true); } finally { scene.overrideMaterial = override; }
          if (needs.early) { grabFrame(gl); draw([EARLY_DISTORTION_LAYER], true); }
          // Keep the authored depth test so arena walls still occlude ground. A small
          // polygon offset avoids coplanar hex/floor flicker; no ground depth can hide units.
          if (ground.size) {
            for (const one of ground.keys()) { one.depthWrite = false; one.polygonOffset = true; one.polygonOffsetFactor = -1; one.polygonOffsetUnits = -1; }
            draw([GROUND_LAYER], true);
            for (const [one, state] of ground) Object.assign(one, state);
          }
          draw([SCENE_LAYER, ...first], true);
        } else if (needs.early) {
          draw([SCENE_LAYER]); grabFrame(gl); draw([EARLY_DISTORTION_LAYER], true); draw(first, true);
        } else draw([SCENE_LAYER, ...first]);
        if (needs.late) { grabFrame(gl); draw([DISTORTION_LAYER], true); draw([PARTICLE_LAYER], true); }
        // A subtract (and every mode that writes alpha down) leaves holes in the canvas's alpha.
        sealCanvasAlpha(gl);
      } finally {
        for (const [node, mask] of masks) node.layers.mask = mask;
        for (const [one, state] of ground) Object.assign(one, state);
        camera.layers.mask = layers; gl.autoClear = autoClear; scene.background = background; gl.setRenderTarget(target);
      }
    },
    dispose() { releaseFrame(gl); floorDepth.dispose(); },
  };
}
