/*! @license GPL-3.0-or-later
 * catfish-xn/cat, 2026-11-15 (not derived from ltk-manager). See NOTICE.md and LICENSE.
 */
/**
 * The board's play surface as the particle passes see it (11-15): the footprint (world x and z) and height of the floor's
 * flat meshes. The floor writes no depth on and under it (passes.ts), so a camera-facing quad reaching below the board is
 * drawn whole; every other particle (a mesh, a ribbon, an arbitrary quad or a ray) is clipped below it here, as the floor's
 * depth clipped it before. Which primitives the floor leaves alone is fitted, not the original's: inferred from footage
 * (Gangplank's ground glow, a camera quad, shows whole; Garen's falling light column, a mesh, stops at the board).
 * An emitter that turns its depth test off is never clipped (clipsUnderPlay): the floor's depth never clipped it.
 */
import { Box3, Vector4, type Mesh, type Object3D, type ShaderMaterial } from 'three';
import type { EmitterModel } from '../../engine/model/model';
import { fragmentTests } from './blend';

export interface PlaySurface { minX: number; maxX: number; minZ: number; maxZ: number; y: number }

/** Shared by every material that reads the play surface; the passes set it each frame. An empty footprint (minX > maxX) clips nothing. */
export const PLAY_SURFACE = { surface: { value: new Vector4(1, 0, 1, 0) }, plane: { value: 0 } };

/** Height (world units) under which a mesh counts as flat, and the tolerance at the plane: float rounding only, not a look value. */
export const FLAT = 1e-3;

export function writesDepth(mesh: Mesh): boolean {
  const material = mesh.material; return (Array.isArray(material) ? material : [material]).some(one => one?.depthWrite);
}

const BOX = new Box3();
/** The footprint and height of the floor's flat depth-writing meshes (the arena's battlefield plane), or null for none. */
export function playSurfaceOf(roots: readonly Object3D[]): PlaySurface | null {
  let found: PlaySurface | null = null;
  for (const root of roots) root.traverse(node => {
    const mesh = node as Mesh; if (!mesh.isMesh || !mesh.visible || !writesDepth(mesh)) return;
    BOX.setFromObject(mesh);
    if (BOX.isEmpty() || BOX.max.y - BOX.min.y > FLAT) return;
    found = found ? { minX: Math.min(found.minX, BOX.min.x), maxX: Math.max(found.maxX, BOX.max.x), minZ: Math.min(found.minZ, BOX.min.z),
      maxZ: Math.max(found.maxZ, BOX.max.z), y: Math.max(found.y, BOX.max.y) } : { minX: BOX.min.x, maxX: BOX.max.x, minZ: BOX.min.z, maxZ: BOX.max.z, y: BOX.max.y };
  });
  return found;
}

/**
 * The play surface and the floor meshes that write no depth of their own, worked out once per floor (11-15: a walk of every
 * floor mesh each frame cost frame time) and again only when a floor root is added or dropped, one of its children
 * changes, or a root moves (the arena placed on a new grid).
 */
export function createFloorSurvey() {
  let key: unknown[] = [], held: { play: PlaySurface | null; quiet: Mesh[] } = { play: null, quiet: [] };
  const keyOf = (roots: readonly Object3D[]) => roots.flatMap(root => [root, ...root.children, ...root.matrixWorld.elements]);
  return {
    survey(roots: readonly Object3D[]) {
      const next = keyOf(roots);
      if (next.length === key.length && next.every((one, i) => one === key[i])) return held;
      key = next; const quiet: Mesh[] = [];
      for (const root of roots) root.traverse(node => { const mesh = node as Mesh; if (mesh.isMesh && !writesDepth(mesh)) quiet.push(mesh); });
      held = { play: playSurfaceOf(roots), quiet };
      return held;
    },
  };
}

/** Sets the shared play surface (null: none, nothing is clipped or left out). */
export function setPlaySurface(play: PlaySurface | null): void {
  PLAY_SURFACE.surface.value.set(play?.minX ?? 1, play?.maxX ?? 0, play?.minZ ?? 1, play?.maxZ ?? 0);
  PLAY_SURFACE.plane.value = play?.y ?? 0;
}

const INSIDE = 'vPlayWorld.x >= vfxPlaySurface.x && vPlayWorld.x <= vfxPlaySurface.y && vPlayWorld.z >= vfxPlaySurface.z && vPlayWorld.z <= vfxPlaySurface.w';
/**
 * How far under the play surface (world units) a particle fragment must be to be clipped. Fitted, not the original's: a
 * small margin so a particle lying on the surface (a flat quad at a unit's feet) is never clipped, well under any
 * authored depth below the board.
 */
export const PLAY_MARGIN = 0.05;
/** The GLSL test a fragment at `vPlayWorld` is under the play surface by (strictly, past PLAY_MARGIN). */
export const UNDER_PLAY = `(${INSIDE} && vPlayWorld.y < vfxPlayPlane - ${PLAY_MARGIN.toFixed(4)})`;
/** The GLSL test a fragment at `vPlayWorld` is on or under the play surface by. */
export const ON_OR_UNDER_PLAY = `(${INSIDE} && vPlayWorld.y <= vfxPlayPlane + ${FLAT.toFixed(4)})`;

/**
 * Whether `emitter`'s particles are clipped under the play surface (clipUnderPlay): not a ground-layer draw, and tested
 * against depth. One that turns its depth test off (`DISABLE_ZBUFFER`) drew over the floor while the floor still wrote
 * depth there, so it stays whole below the board (11-15: Garen's R impact Shockwave1, a mesh wholly under the board with
 * the test off, vanished once it was clipped). Kinds the floor leaves alone (a camera-facing quad) are the caller's.
 */
export function clipsUnderPlay(emitter: EmitterModel): boolean {
  return !emitter.groundLayer && fragmentTests(emitter).depthTest;
}

/**
 * Clips `material`'s fragments under the play surface. Its vertex stage writes the world position itself under
 * `PLAY_CLIP` (quad, mesh and ribbon shaders: any corner placing and push-pull applied), so no position is rebuilt from
 * the clip position: that rebuild's float error dropped particles lying on the play surface (11-15: Mel's R hit, three
 * flat quads at her targets' feet). The fragment's `main` runs after a test that discards under the surface.
 */
export function clipUnderPlay<T extends ShaderMaterial>(material: T): T {
  if (material.defines?.PLAY_CLIP !== undefined) return material;
  if (!material.vertexShader.includes('PLAY_CLIP')) throw new Error('clipUnderPlay: the vertex shader writes no vPlayWorld under PLAY_CLIP');
  material.defines = { ...material.defines, PLAY_CLIP: '' };
  material.fragmentShader = `varying vec3 vPlayWorld;\nuniform vec4 vfxPlaySurface;\nuniform float vfxPlayPlane;\n${material.fragmentShader.replace(/void\s+main\s*\(\s*\)/, 'void vfxPlayMain()')}
void main() {
  if ${UNDER_PLAY} discard;
  vfxPlayMain();
}
`;
  material.uniforms.vfxPlaySurface = PLAY_SURFACE.surface; material.uniforms.vfxPlayPlane = PLAY_SURFACE.plane;
  material.needsUpdate = true;
  return material;
}
