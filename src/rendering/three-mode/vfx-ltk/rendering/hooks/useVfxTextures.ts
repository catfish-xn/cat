/*! @license GPL-3.0-or-later
 * Derived from ltk-manager (GPL-3.0-or-later).
 * Source: src/modules/workshop/bin/vfx/rendering/hooks/useVfxTextures.ts
 * Port/adaptation: catfish-xn/cat, 2026-10-26. See NOTICE.md and LICENSE.
 */
import type { Texture } from "three";
export interface EmitterSamplers {
  readonly base: Texture | null;
  readonly mult: Texture | null;
  readonly color: Texture | null;
  readonly palette: Texture | null;
  readonly erosion: Texture | null;
  /** `normalMapTexture`, whose direction a distorting emitter warps the screen along. */
  readonly normal: Texture | null;
  /** `reflectionMapTexture`, the cube map a mesh reflects. */
  readonly reflection: Texture | null;
}

