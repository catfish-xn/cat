/*! @license GPL-3.0-or-later
 * Derived from ltk-manager. Source: src/modules/workshop/bin/vfx/rendering/components/Passes.tsx
 * Bare host adaptation, 2026-10-26. See NOTICE.md and LICENSE.
 */
/** Bare host for upstream Passes.tsx phase ordering. Restores host state even when a draw fails. */
import { Box3, DoubleSide, MeshBasicMaterial, Vector4, type Camera, type Material, type Mesh, type Object3D, type Scene, type WebGLRenderer } from 'three';
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
 * The play surface the floor's depth is left out on: the footprint (world x and z) and height of the floor's flat meshes,
 * those with no height at all (the arena's battlefield plane). Null when the floor has none (the procedural board).
 */
export interface PlaySurface { minX: number; maxX: number; minZ: number; maxZ: number; y: number }
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
const BOX = new Box3();
/** Height (world units) under which a mesh counts as flat: float rounding only, not a look value. */
const FLAT = 1e-3;
function writesDepth(mesh: Mesh): boolean {
  const material = mesh.material; return (Array.isArray(material) ? material : [material]).some(one => one?.depthWrite);
}
/**
 * The depth-only material the floor is drawn again with after its depth is cleared (11-15): it writes no colour and leaves
 * out every fragment on or under the play surface inside its footprint, so a particle reaching below the board is not cut
 * by the board, while walls, ledges and terrain outside the footprint or above it occlude as before (Viktor's storm stays
 * off the wall faces). `surface.value` is [minX, maxX, minZ, maxZ] and `plane.value` the surface's height; an empty
 * footprint (minX > maxX) leaves nothing out.
 */
export function floorDepthMaterial(): MeshBasicMaterial & { userData: { surface: { value: Vector4 }; plane: { value: number } } } {
  const material = new MeshBasicMaterial({ colorWrite: false, side: DoubleSide }) as MeshBasicMaterial & { userData: { surface: { value: Vector4 }; plane: { value: number } } };
  material.name = 'vfx-floor-depth';
  const surface = { value: new Vector4(1, 0, 1, 0) }, plane = { value: 0 };
  material.userData = { surface, plane };
  material.onBeforeCompile = shader => {
    shader.uniforms.vfxPlaySurface = surface; shader.uniforms.vfxPlayPlane = plane;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFloorWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vec4 floorWorld = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n  floorWorld = instanceMatrix * floorWorld;\n#endif\n  vFloorWorld = (modelMatrix * floorWorld).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFloorWorld;\nuniform vec4 vfxPlaySurface;\nuniform float vfxPlayPlane;')
      .replace('void main() {', `void main() {\n  if (vFloorWorld.x >= vfxPlaySurface.x && vFloorWorld.x <= vfxPlaySurface.y && vFloorWorld.z >= vfxPlaySurface.z && vFloorWorld.z <= vfxPlaySurface.w && vFloorWorld.y <= vfxPlayPlane + ${FLAT.toFixed(4)}) discard;`);
  };
  material.customProgramCacheKey = () => 'vfx-floor-depth-surface';
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
          // The floor keeps its colour but not its depth on and under the play surface: a particle reaching below the board
          // is not cut by it, while walls, ledges and terrain write their depth again (floorDepthMaterial), and units drawn
          // after write theirs. A floor mesh that writes no depth of its own (the arena's cell overlay) is left out.
          gl.clearDepth();
          const play = playSurfaceOf(floorRoots), quiet: Object3D[] = [];
          floorDepth.userData.surface.value.set(play?.minX ?? 1, play?.maxX ?? 0, play?.minZ ?? 1, play?.maxZ ?? 0);
          floorDepth.userData.plane.value = play?.y ?? 0;
          for (const root of floorRoots) root.traverse(node => { const mesh = node as Mesh; if (mesh.isMesh && mesh.visible && !writesDepth(mesh)) { quiet.push(mesh); mesh.visible = false; } });
          const override = scene.overrideMaterial; scene.overrideMaterial = floorDepth;
          try { draw([FLOOR_LAYER], true); } finally { scene.overrideMaterial = override; for (const mesh of quiet) mesh.visible = true; }
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
