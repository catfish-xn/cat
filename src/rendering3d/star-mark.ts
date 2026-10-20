import { Group, Mesh, MeshBasicMaterial, Quaternion, Shape, ShapeGeometry, type Object3D } from 'three';

export interface StarMark {
  readonly object: Object3D;
  setLevel(level: number): void;
  dispose(): void;
}

/** BoardFeed supplies the effective level; this component never derives promotions.
 * One unit-wide star, with 1.2 units between centers. Set position/scale on object.
 * The entire row billboards automatically at render time, including under rotated
 * parents. Resources are private; dispose detaches the row and is idempotent.
 * Non-finite levels throw; finite values truncate/clamp to the theme's 1–4 range.
 * setLevel after disposal is a no-op.
 */
export function createStarMark({ effectiveStarLevel, colorFor }: {
  effectiveStarLevel: number;
  /** Host-provided color for the normalized effective level (1–4). */
  colorFor(level: number): string;
}): StarMark {
  const normalize = (level: number): number => {
    if (!Number.isFinite(level)) throw new RangeError('star-level-must-be-finite');
    return Math.max(1, Math.min(4, Math.trunc(level)));
  };
  let level = normalize(effectiveStarLevel);
  const object = new Group();
  const shape = new Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 5;
    const radius = i % 2 === 0 ? 0.5 : 0.22;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new ShapeGeometry(shape);
  const material = new MeshBasicMaterial({ color: colorFor(level), depthWrite: false, toneMapped: false });
  const cameraRotation = new Quaternion(), parentRotation = new Quaternion();
  let disposed = false;

  const rebuild = () => {
    object.clear();
    material.color.set(colorFor(level));
    for (let i = 0; i < level; i++) {
      const star = new Mesh(geometry, material);
      star.position.x = (i - (level - 1) / 2) * 1.2;
      // Orientation changes during rendering, after the renderer's culling pass.
      star.frustumCulled = false;
      star.onBeforeRender = (_renderer, _scene, camera) => {
        camera.getWorldQuaternion(cameraRotation);
        if (object.parent) {
          object.parent.getWorldQuaternion(parentRotation);
          object.quaternion.copy(parentRotation.invert()).multiply(cameraRotation);
        } else object.quaternion.copy(cameraRotation);
        object.updateMatrixWorld(true);
      };
      object.add(star);
    }
  };
  rebuild();

  return {
    object,
    setLevel(next) {
      if (disposed) return;
      const normalized = normalize(next);
      if (normalized === level) return;
      level = normalized;
      rebuild();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      object.removeFromParent();
      object.clear();
      geometry.dispose();
      material.dispose();
    },
  };
}
