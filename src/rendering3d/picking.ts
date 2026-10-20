import { Plane, Raycaster, Vector2, Vector3, type Camera, type Object3D } from 'three';
export interface HexCell { col: number; row: number }
export interface HexGrid { rows: number; columns: number; radius?: number; origin?: { x: number; y: number }; elevation?: number }
export interface Viewport { left: number; top: number; width: number; height: number }
export type PickResult = { kind: 'unit'; unitId: string } | { kind: 'cell'; cell: HexCell };
export interface PickUnit { unitId: string; object: Object3D }
/** Matches HexLayout's odd-row offset and pointy hexagons; 2D x/y -> world x/z. */
export function hexCenter(cell: HexCell, grid: HexGrid): Vector3 {
  const radius = grid.radius ?? 36, origin = grid.origin ?? { x: 242, y: 146 };
  return new Vector3(origin.x + Math.sqrt(3) * radius * (cell.col + (cell.row % 2) / 2), grid.elevation ?? 0,
    origin.y + radius * 1.5 * cell.row);
}
/** Unit surfaces have priority; otherwise intersect the board plane and exact hex boundary.
 * Screen coordinates and viewport are CSS pixels (not drawing-buffer pixels).
 */
export function pick(screen: { x: number; y: number }, viewport: Viewport, camera: Camera, grid: HexGrid,
  units: readonly PickUnit[] = []): PickResult | undefined {
  const radius = grid.radius ?? 36;
  if (![screen.x, screen.y, viewport.left, viewport.top, viewport.width, viewport.height, radius, grid.rows, grid.columns,
    grid.origin?.x ?? 242, grid.origin?.y ?? 146, grid.elevation ?? 0].every(Number.isFinite)
    || viewport.width <= 0 || viewport.height <= 0 || radius <= 0 || !Number.isInteger(grid.rows) || !Number.isInteger(grid.columns)
    || grid.rows < 0 || grid.columns < 0) throw new Error('invalid-picking-input');
  const x = (screen.x - viewport.left) / viewport.width, y = (screen.y - viewport.top) / viewport.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return undefined;
  camera.updateWorldMatrix(true, false);
  const ray = new Raycaster();
  ray.setFromCamera(new Vector2(x * 2 - 1, 1 - y * 2), camera);
  const visible = (object: Object3D): boolean => object.visible && (!object.parent || visible(object.parent));
  const owners = new Map<Object3D, string>();
  for (const unit of units) {
    unit.object.updateWorldMatrix(true, true);
    if (visible(unit.object)) owners.set(unit.object, unit.unitId);
  }
  for (const hit of ray.intersectObjects([...owners.keys()], true)) {
    if (!visible(hit.object)) continue;
    let object: Object3D | null = hit.object;
    while (object) {
      const id = owners.get(object);
      if (id !== undefined) return { kind: 'unit', unitId: id };
      object = object.parent;
    }
  }
  const point = ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -(grid.elevation ?? 0)), new Vector3());
  if (!point) return undefined;
  // Same row-major boundary tie-breaking as HexLayout.hitTest.
  for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.columns; col++) {
    const cell = { row, col }, center = hexCenter(cell, grid);
    const dx = Math.abs(point.x - center.x), dz = Math.abs(point.z - center.z);
    if (dx <= Math.sqrt(3) * radius / 2 && dz <= radius && dz + dx / Math.sqrt(3) <= radius) return { kind: 'cell', cell };
  }
  return undefined;
}
