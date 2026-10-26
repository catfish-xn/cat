/*! @license GPL-3.0-or-later
 * Derived from ltk-manager. Source: src/modules/workshop/bin/vfx/rendering/components/Passes.tsx
 * Bare host adaptation, 2026-10-26. See NOTICE.md and LICENSE.
 */
/** Bare host for upstream Passes.tsx phase ordering. Restores host state even when a draw fails. */
import type { Camera, Material, Mesh, Object3D, Scene, WebGLRenderer } from 'three';
import { bindFrameTargets, grabDepth, grabFrame, releaseFrame, SCENE_LAYER, UNDER_LAYER, PARTICLE_LAYER, EARLY_DISTORTION_LAYER, DISTORTION_LAYER, FLOOR_LAYER, GROUND_LAYER } from './utils/frame';

export function createVfxPasses(gl: WebGLRenderer, floors?: () => readonly Object3D[]) {
  return {
    render(scene: Scene, camera: Camera, needs: { early: boolean; late: boolean; soft: boolean }) {
      const layers = camera.layers.mask, autoClear = gl.autoClear, background = scene.background, target = gl.getRenderTarget();
      const masks = new Map<Object3D, number>(), ground = new Map<Material, Pick<Material, 'depthWrite' | 'polygonOffset' | 'polygonOffsetFactor' | 'polygonOffsetUnits'>>();
      const draw = (held: readonly number[], over = false) => {
        camera.layers.disableAll(); for (const layer of held) camera.layers.enable(layer);
        gl.autoClear = over ? false : autoClear; scene.background = over ? null : background; gl.render(scene, camera);
      };
      try {
        bindFrameTargets(gl);
        if (needs.soft) grabDepth(gl, scene, camera);
        const first = needs.late ? [UNDER_LAYER] : [UNDER_LAYER, PARTICLE_LAYER];
        scene.traverse(node => {
          if (!node.layers.isEnabled(GROUND_LAYER)) return;
          const material = (node as Mesh).material;
          for (const one of material ? Array.isArray(material) ? material : [material] : [])
            if (!ground.has(one)) ground.set(one, { depthWrite: one.depthWrite, polygonOffset: one.polygonOffset,
              polygonOffsetFactor: one.polygonOffsetFactor, polygonOffsetUnits: one.polygonOffsetUnits });
        });
        if (ground.size && floors) {
          // Separate calls avoid Three's opaque/transparent sorting putting ground
          // beneath opaque hexes or beneath the arena's transparent cell overlay.
          for (const root of floors()) root.traverse(node => { masks.set(node, node.layers.mask); node.layers.set(FLOOR_LAYER); });
          scene.traverse(node => {
            if ((node as { isLight?: boolean }).isLight) { masks.set(node, node.layers.mask); node.layers.enable(FLOOR_LAYER); }
          });
          draw([FLOOR_LAYER]);
          if (needs.early) { grabFrame(gl); draw([EARLY_DISTORTION_LAYER], true); }
          // Keep the authored depth test so arena walls still occlude ground. A small
          // polygon offset avoids coplanar hex/floor flicker; no ground depth can hide units.
          for (const one of ground.keys()) { one.depthWrite = false; one.polygonOffset = true; one.polygonOffsetFactor = -1; one.polygonOffsetUnits = -1; }
          draw([GROUND_LAYER], true);
          for (const [one, state] of ground) Object.assign(one, state);
          draw([SCENE_LAYER, ...first], true);
        } else if (needs.early) {
          draw([SCENE_LAYER]); grabFrame(gl); draw([EARLY_DISTORTION_LAYER], true); draw(first, true);
        } else draw([SCENE_LAYER, ...first]);
        if (needs.late) { grabFrame(gl); draw([DISTORTION_LAYER], true); draw([PARTICLE_LAYER], true); }
      } finally {
        for (const [node, mask] of masks) node.layers.mask = mask;
        for (const [one, state] of ground) Object.assign(one, state);
        camera.layers.mask = layers; gl.autoClear = autoClear; scene.background = background; gl.setRenderTarget(target);
      }
    },
    dispose() { releaseFrame(gl); },
  };
}
