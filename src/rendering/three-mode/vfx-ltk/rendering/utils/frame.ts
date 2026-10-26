/** Shared uniform placeholders for the bare renderer. Screen/depth sampling emitters are rejected by the loader. */
import { Texture, Vector2 } from 'three';
export const FRAME = new Texture(), SCENE_DEPTH = new Texture();
export const VIEWPORT = new Vector2(1, 1), DEPTH_RANGE = new Vector2(1, 1);
