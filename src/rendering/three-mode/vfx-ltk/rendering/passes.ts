/*! @license GPL-3.0-or-later
 * Derived from ltk-manager. Source: src/modules/workshop/bin/vfx/rendering/components/Passes.tsx
 * Bare host adaptation, 2026-10-26. See NOTICE.md and LICENSE.
 */
/** Bare host for upstream Passes.tsx phase ordering. Restores host state even when a draw fails. */
import type { Camera, Scene, WebGLRenderer } from 'three';
import { bindFrameTargets, grabDepth, grabFrame, releaseFrame, SCENE_LAYER, UNDER_LAYER, PARTICLE_LAYER, EARLY_DISTORTION_LAYER, DISTORTION_LAYER } from './utils/frame';

export function createVfxPasses(gl: WebGLRenderer) {
  return {
    render(scene: Scene, camera: Camera, needs: { early: boolean; late: boolean; soft: boolean }) {
      const layers = camera.layers.mask, autoClear = gl.autoClear, background = scene.background, target = gl.getRenderTarget();
      const draw = (held: readonly number[], over = false) => {
        camera.layers.disableAll(); for (const layer of held) camera.layers.enable(layer);
        gl.autoClear = over ? false : autoClear; scene.background = over ? null : background; gl.render(scene, camera);
      };
      try {
        bindFrameTargets(gl);
        if (needs.soft) grabDepth(gl, scene, camera);
        const first = needs.late ? [UNDER_LAYER] : [UNDER_LAYER, PARTICLE_LAYER];
        if (needs.early) {
          draw([SCENE_LAYER]); grabFrame(gl); draw([EARLY_DISTORTION_LAYER], true); draw(first, true);
        } else draw([SCENE_LAYER, ...first]);
        if (needs.late) { grabFrame(gl); draw([DISTORTION_LAYER], true); draw([PARTICLE_LAYER], true); }
      } finally {
        camera.layers.mask = layers; gl.autoClear = autoClear; scene.background = background; gl.setRenderTarget(target);
      }
    },
    dispose() { releaseFrame(gl); },
  };
}
