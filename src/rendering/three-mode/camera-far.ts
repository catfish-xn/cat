import type { Box3, Vector3 } from 'three';

/** The camera's default far plane, kept when nothing larger has to be drawn. */
export const DEFAULT_FAR = 5000;
/** Head room over the farthest drawn point. */
export const FAR_MARGIN = 1.2;

/**
 * A far plane that just covers `box` from `eye`: its farthest corner plus a margin, never below DEFAULT_FAR.
 * The original arena carries its skybox (the cloud sea under the island) a few thousand units below the board;
 * with the fixed 5000 the whole skybox fell behind the far plane and only the dark scene background showed.
 */
export function farToCover(eye: Vector3, box: Box3): number {
  if (box.isEmpty()) return DEFAULT_FAR;
  let farthest = 0;
  for (let i = 0; i < 8; i++) {
    const dx = (i & 1 ? box.max.x : box.min.x) - eye.x;
    const dy = (i & 2 ? box.max.y : box.min.y) - eye.y;
    const dz = (i & 4 ? box.max.z : box.min.z) - eye.z;
    farthest = Math.max(farthest, Math.hypot(dx, dy, dz));
  }
  return Math.max(DEFAULT_FAR, Math.ceil(farthest * FAR_MARGIN));
}
