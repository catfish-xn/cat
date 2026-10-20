import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera, Vector3, type Camera } from 'three';
import { HexLayout } from '../src/rendering/hex-layout';
import { DEFAULT_BOARD } from '../src/simulation/board';
import { hexCenter, pick, type HexGrid } from '../src/rendering3d/picking';
const viewport = { left: 50, top: 20, width: 800, height: 600 };
const grid: HexGrid = { rows: 3, columns: 3 };
function project(point: Vector3, camera: Camera) {
  camera.updateMatrixWorld(true);
  const ndc = point.clone().project(camera);
  return { x: viewport.left + (ndc.x + 1) * viewport.width / 2, y: viewport.top + (1 - ndc.y) * viewport.height / 2 };
}
function camera(perspective = true) {
  const camera = perspective ? new PerspectiveCamera(50, 4 / 3, 0.1, 3000) : new OrthographicCamera(-300, 300, 225, -225, 0.1, 3000);
  camera.position.set(300, 600, 210); camera.up.set(0, 0, -1); camera.lookAt(300, 0, 210); camera.updateProjectionMatrix();
  return camera;
}
describe('3D hex and unit ray picking', () => {
  it('matches every HexLayout center, default origin and odd-row offsets', () => {
    const layout = new HexLayout({ ...DEFAULT_BOARD, rows: 3, columns: 3 });
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const center = layout.center({ row, col }), actual = hexCenter({ row, col }, grid);
      expect(actual.toArray()).toEqual([center.x, 0, center.y]);
    }
  });
  it.each([true, false])('picks each cell through projected CSS coordinates (perspective=%s)', perspective => {
    const cam = camera(perspective);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const cell = { row, col };
      expect(pick(project(hexCenter(cell, grid), cam), viewport, cam, grid)).toEqual({ kind: 'cell', cell });
    }
  });
  it('matches exact HexLayout boundary containment for off-center samples', () => {
    const cam = camera(), layout = new HexLayout({ ...DEFAULT_BOARD, rows: 3, columns: 3 });
    for (const offset of [[0, 30], [28, 0], [28, 25], [40, 20], [-30, -30], [0, -50]]) {
      const point = { x: 242 + offset[0], y: 146 + offset[1] }, expected = layout.hitTest(point);
      expect(pick(project(new Vector3(point.x, 0, point.y), cam), viewport, cam, grid))
        .toEqual(expected ? { kind: 'cell', cell: expected } : undefined);
    }
  });
  it('picks nearest child geometry as a unit ahead of the underlying cell', () => {
    const cam = camera(), root = new Group(), geometry = new BoxGeometry(20, 20, 20), material = new MeshBasicMaterial();
    const far = new Mesh(geometry, material), near = new Mesh(geometry, material);
    far.position.copy(hexCenter({ row: 1, col: 1 }, grid)); near.position.copy(far.position); near.position.y = 50; root.add(near);
    const screen = project(near.position, cam);
    expect(pick(screen, viewport, cam, grid, [{ unitId: 'far', object: far }, { unitId: 'near', object: root }])).toEqual({ kind: 'unit', unitId: 'near' });
    root.visible = false;
    expect(pick(screen, viewport, cam, grid, [{ unitId: 'near', object: root }])).toEqual({ kind: 'cell', cell: { row: 1, col: 1 } });
    geometry.dispose(); material.dispose();
  });
  it('ignores invisible descendants and invisible ancestors', () => {
    const cam = camera(), root = new Group(), parent = new Group(), geometry = new BoxGeometry(20, 20, 20), material = new MeshBasicMaterial(), unit = new Mesh(geometry, material);
    unit.position.copy(hexCenter({ row: 0, col: 0 }, grid)); unit.position.y = 20; root.add(unit); parent.add(root);
    const screen = project(unit.position, cam);
    unit.visible = false;
    expect(pick(screen, viewport, cam, grid, [{ unitId: 'u', object: root }])?.kind).toBe('cell');
    unit.visible = true; parent.visible = false;
    expect(pick(screen, viewport, cam, grid, [{ unitId: 'u', object: root }])?.kind).toBe('cell');
    geometry.dispose(); material.dispose();
  });
  it('supports configured radius/origin/elevation', () => {
    const custom = { rows: 2, columns: 2, radius: 10, origin: { x: 300, y: 200 }, elevation: 12 }, cam = camera();
    const cell = { row: 1, col: 1 }, center = hexCenter(cell, custom);
    expect(center.y).toBe(12); expect(pick(project(center, cam), viewport, cam, custom)).toEqual({ kind: 'cell', cell });
  });
  it('returns undefined for off-board, off-viewport, empty board and parallel/backward rays', () => {
    const cam = camera();
    expect(pick({ x: 0, y: 0 }, viewport, cam, grid)).toBeUndefined();
    expect(pick(project(new Vector3(100, 0, 100), cam), viewport, cam, grid)).toBeUndefined();
    expect(pick(project(hexCenter({ row: 0, col: 0 }, grid), cam), viewport, cam, { rows: 0, columns: 0 })).toBeUndefined();
    cam.position.set(300, 600, 210); cam.lookAt(300, 600, 0);
    expect(pick({ x: 450, y: 320 }, viewport, cam, grid)).toBeUndefined();
    cam.lookAt(300, 1000, 210); expect(pick({ x: 450, y: 320 }, viewport, cam, grid)).toBeUndefined();
  });
  it('rejects invalid viewport or grid dimensions', () => {
    const cam = camera();
    expect(() => pick({ x: 450, y: 320 }, { ...viewport, width: 0 }, cam, grid)).toThrow('invalid-picking-input');
    expect(() => pick({ x: NaN, y: 320 }, viewport, cam, grid)).toThrow();
    expect(() => pick({ x: 450, y: 320 }, viewport, cam, { ...grid, radius: -1 })).toThrow();
  });
});
