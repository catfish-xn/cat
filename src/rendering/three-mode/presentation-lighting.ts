/** Bounded, single-pass 3D polish. Blob contacts avoid shadow maps; only one hovered body gets shells. */
import {
  BackSide, DataTexture, Group, HemisphereLight, LinearFilter, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry,
  RGBAFormat, SkinnedMesh, Vector2, type Object3D, type Scene, type Vector3,
} from 'three';

export type Quality3d = 'off' | 'low' | 'balanced' | 'high';
export function readQuality3d(search: string): Quality3d {
  const value = new URLSearchParams(search).get('quality3d');
  return value === 'off' || value === 'low' || value === 'high' ? value : 'balanced';
}
interface LitPiece {
  readonly root: Group;
  readonly body: Object3D | null;
  readonly target: Vector3;
  readonly alive: boolean;
  readonly team: 'player' | 'enemy';
}
const TEAM = { player: '#3d8fd1', enemy: '#d1504a' } as const;

export function createPresentationLighting(scene: Scene, quality: Quality3d) {
  const contacts = quality === 'balanced' || quality === 'high';
  const group = new Group(); group.name = 'render3d-contact-shadows'; scene.add(group);
  const hemisphere = new HemisphereLight('#c9e6ff', '#65515d', quality === 'off' ? 0 : 0.55);
  if (quality !== 'off') scene.add(hemisphere);
  // One shared radial alpha texture, no DOM canvas or extra render target. Created only when enabled.
  const size = quality === 'high' ? 64 : 32;
  const texture = contacts ? (() => {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const distance = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
      data[(y * size + x) * 4 + 3] = Math.round(Math.max(0, 1 - distance) ** 2 * 190);
    }
    const map = new DataTexture(data, size, size, RGBAFormat); map.magFilter = map.minFilter = LinearFilter; map.needsUpdate = true; return map;
  })() : null;
  const geometry = new PlaneGeometry(1, 1);
  const shadowMaterial = new MeshBasicMaterial({ color: '#000000', map: texture, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const shadows = new Map<Group, Mesh>();
  const resolution = new Vector2(1, 1);
  const outlineMaterial = new MeshStandardMaterial({ color: '#000000', emissive: TEAM.player, emissiveIntensity: 1,
    side: BackSide, depthWrite: false, roughness: 1 });
  // Standard's normal pipeline includes morphing and skinning. Offset the back faces in clip space by CSS pixels.
  // FLIP_SIDED flips transformedNormal for BackSide, so negate it to expand rather than shrink the shell.
  outlineMaterial.onBeforeCompile = shader => {
    shader.uniforms.outlineResolution = { value: resolution };
    shader.vertexShader = 'uniform vec2 outlineResolution;\n' + shader.vertexShader.replace('#include <project_vertex>',
      `#include <project_vertex>\nvec2 edge = -transformedNormal.xy;\nfloat edgeLength = length(edge);\nif (edgeLength > 0.0001) gl_Position.xy += edge / edgeLength * ${(quality === 'high' ? 3 : 2).toFixed(1)} * 2.0 / outlineResolution * gl_Position.w;`);
  };
  outlineMaterial.customProgramCacheKey = () => `team-outline-${quality}`;
  let hovered: LitPiece | null = null, outlinedBody: Object3D | null = null, closed = false;
  const shells: Mesh[] = [];
  const clearOutline = () => { for (const shell of shells) shell.removeFromParent(); shells.length = 0; outlinedBody = null; };
  const outline = (piece: LitPiece | null) => {
    if (!contacts || !piece?.alive || !piece.root.visible || !piece.body) { clearOutline(); return; }
    outlineMaterial.emissive.set(TEAM[piece.team]);
    if (outlinedBody === piece.body) return;
    clearOutline(); outlinedBody = piece.body;
    const sources: Mesh[] = [];
    piece.body.traverseVisible(node => { if (node instanceof Mesh && node.geometry.hasAttribute('normal')) sources.push(node); });
    for (const source of sources) {
      const shell = source instanceof SkinnedMesh ? new SkinnedMesh(source.geometry, outlineMaterial) : new Mesh(source.geometry, outlineMaterial);
      if (shell instanceof SkinnedMesh && source instanceof SkinnedMesh) {
        shell.skeleton = source.skeleton; shell.bindMode = source.bindMode;
        shell.bindMatrix.copy(source.bindMatrix); shell.bindMatrixInverse.copy(source.bindMatrixInverse);
      }
      shell.morphTargetInfluences = source.morphTargetInfluences; shell.morphTargetDictionary = source.morphTargetDictionary;
      shell.name = 'render3d-hover-outline'; shell.renderOrder = source.renderOrder + 1;
      shell.raycast = () => {}; source.add(shell); shells.push(shell);
    }
  };
  return {
    hemisphere, group,
    resize(width: number, height: number) { resolution.set(Math.max(1, width), Math.max(1, height)); },
    hover(piece: LitPiece | null) { hovered = piece; outline(piece); },
    /** Detach borrowed skeletons/geometry before the owner releases or replaces its body. Keep the hover identity. */
    detachBody(piece: LitPiece) { if (hovered === piece) clearOutline(); },
    update(piece: LitPiece) {
      if (closed) return;
      if (contacts) {
        let shadow = shadows.get(piece.root);
        if (!shadow) {
          shadow = new Mesh(geometry, shadowMaterial); shadow.rotation.x = -Math.PI / 2;
          shadows.set(piece.root, shadow); group.add(shadow);
        }
        shadow.visible = piece.root.visible && piece.alive;
        shadow.position.set(piece.root.position.x, piece.target.y + 1.5, piece.root.position.z);
        // Lifted/arriving pieces have a smaller contact; this shares one material across the whole army.
        const lift = Math.max(0, piece.root.position.y - piece.target.y);
        shadow.scale.setScalar(64 / (1 + lift / 50));
      }
      if (hovered === piece) outline(piece); // also replaces shells after an asynchronous model attaches
    },
    remove(root: Group) {
      shadows.get(root)?.removeFromParent(); shadows.delete(root);
      if (hovered?.root === root) { hovered = null; clearOutline(); }
    },
    dispose() {
      if (closed) return;
      closed = true; hovered = null; clearOutline(); shadows.clear(); group.clear(); group.removeFromParent(); hemisphere.removeFromParent();
      geometry.dispose(); texture?.dispose(); shadowMaterial.dispose(); outlineMaterial.dispose();
    },
  };
}
