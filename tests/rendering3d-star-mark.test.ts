import { describe, expect, it, vi } from 'vitest';
import { Color, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Quaternion, Scene, ShapeGeometry, type WebGLRenderer } from 'three';
import { createStarMark } from '../src/rendering3d/index';
import { starColor } from '../src/presentation/theme';

const colorFor = (level: number): string => ['#ff0000', '#00ff00', '#0000ff', '#ff00ff'][level - 1];
const stars = (mark: ReturnType<typeof createStarMark>) => mark.object.children as Mesh<ShapeGeometry, MeshBasicMaterial>[];
const expectLevel = (mark: ReturnType<typeof createStarMark>, level: number) => {
  expect(stars(mark)).toHaveLength(level);
  for (const star of stars(mark)) {
    expect(star.geometry).toBeInstanceOf(ShapeGeometry);
    expect(star.material.color).toEqual(new Color(colorFor(level)));
  }
  expect(stars(mark).reduce((sum, star) => sum + star.position.x, 0)).toBeCloseTo(0);
};

describe('3D overhead star marks', () => {
  it.each([1, 2, 3, 4])('draws %i stars using the injected color', level => {
    const mark = createStarMark({ effectiveStarLevel: level, colorFor });
    expectLevel(mark, level);
    mark.dispose();
  });

  it('supports the real theme: three gold stars and four teal stars', () => {
    const mark = createStarMark({ effectiveStarLevel: 3, colorFor: starColor });
    for (const [level, color] of [[3, '#ffd34d'], [4, '#a6f2e6']] as const) {
      mark.setLevel(level);
      expect(stars(mark)).toHaveLength(level);
      for (const star of stars(mark)) expect(star.material.color).toEqual(new Color(color));
    }
    mark.dispose();
  });

  it('updates the entire row in both directions without replacing caller transforms', () => {
    const mark = createStarMark({ effectiveStarLevel: 3, colorFor });
    mark.object.position.set(1, 2, 3);
    mark.object.scale.setScalar(0.25);
    for (const level of [4, 2, 1, 3]) {
      mark.setLevel(level);
      expectLevel(mark, level);
    }
    expect(mark.object.position.toArray()).toEqual([1, 2, 3]);
    expect(mark.object.scale.toArray()).toEqual([0.25, 0.25, 0.25]);
    mark.dispose();
  });

  it('billboards the whole row below a rotated parent for each camera', () => {
    const mark = createStarMark({ effectiveStarLevel: 4, colorFor });
    const parent = new Group(), scene = new Scene(), camera = new PerspectiveCamera();
    parent.rotation.set(0.4, 0.8, 0.2);
    parent.add(mark.object);
    scene.add(parent);
    for (const angle of [0.3, -0.7]) {
      camera.rotation.set(angle, 0.6, 0.1);
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      const star = stars(mark)[0];
      star.onBeforeRender({} as WebGLRenderer, scene, camera, star.geometry, star.material, null!);
      const rotation = mark.object.getWorldQuaternion(new Quaternion());
      expect(rotation.angleTo(camera.getWorldQuaternion(new Quaternion()))).toBeLessThan(1e-7);
      // Row offsets rotate with the camera, not with the model's parent.
      const first = stars(mark)[0], last = stars(mark)[3];
      const direction = last.getWorldPosition(last.position.clone()).sub(first.getWorldPosition(first.position.clone())).normalize();
      expect(direction.distanceTo(first.position.clone().set(1, 0, 0).applyQuaternion(rotation))).toBeLessThan(1e-7);
    }
    mark.dispose();
  });

  it('reuses and releases all owned geometry/material exactly once after updates', () => {
    const mark = createStarMark({ effectiveStarLevel: 3, colorFor });
    const { geometry, material } = stars(mark)[0];
    const disposeGeometry = vi.spyOn(geometry, 'dispose'), disposeMaterial = vi.spyOn(material, 'dispose');
    const parent = new Group();
    parent.add(mark.object);
    mark.setLevel(4);
    expect(stars(mark).every(star => star.geometry === geometry && star.material === material)).toBe(true);
    mark.dispose();
    mark.dispose();
    mark.setLevel(2);
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(disposeMaterial).toHaveBeenCalledTimes(1);
    expect(mark.object.children).toHaveLength(0);
    expect(parent.children).toHaveLength(0);
  });

  it('clamps finite input and rejects non-finite updates without changing the row', () => {
    const mark = createStarMark({ effectiveStarLevel: 9, colorFor });
    expectLevel(mark, 4);
    mark.setLevel(2.9);
    expectLevel(mark, 2);
    for (const level of [NaN, Infinity, -Infinity]) {
      expect(() => mark.setLevel(level)).toThrow(RangeError);
      expectLevel(mark, 2);
      expect(() => createStarMark({ effectiveStarLevel: level, colorFor })).toThrow(RangeError);
    }
    mark.setLevel(0);
    expectLevel(mark, 1);
    mark.dispose();
  });
});

describe('star mark draw order', () => {
  it('renders after models without depth testing so later models cannot cover it', async () => {
    const { createStarMark, STAR_RENDER_ORDER } = await import('../src/rendering3d/star-mark');
    const mark = createStarMark({ effectiveStarLevel: 4, colorFor: () => '#00ffcc' });
    try {
      const stars = mark.object.children as any[];
      expect(stars).toHaveLength(4);
      for (const star of stars) {
        expect(star.renderOrder).toBe(STAR_RENDER_ORDER);
        expect(star.renderOrder).toBeGreaterThan(0);
        expect(star.material.transparent).toBe(true);
        expect(star.material.depthTest).toBe(false);
        expect(star.material.depthWrite).toBe(false);
      }
    } finally { mark.dispose(); }
  });
});
