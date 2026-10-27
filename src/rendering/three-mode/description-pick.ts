/** Small look-only picks. Never intersect champion meshes (skinning is costly). */
import { Box3, Raycaster, Vector2, Vector3, type Camera, type Object3D, type Sprite } from 'three';
import type { BoardScreenBox } from '../board-feed';
export interface ScreenArea { left: number; top: number; width: number; height: number }
export const contains = (box: BoardScreenBox, point: { x: number; y: number }) => point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
export function projectedBox(root: Object3D, camera: Camera, area: ScreenArea): BoardScreenBox | undefined {
  if (!root.visible || area.width <= 0 || area.height <= 0) return;
  camera.updateMatrixWorld(); root.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(root), point = new Vector3();
  if (box.isEmpty()) return;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    point.set(x, y, z).project(camera);
    if (point.z > 1) return;
    const cx = area.left + (point.x + 1) / 2 * area.width, cy = area.top + (1 - point.y) / 2 * area.height;
    left = Math.min(left, cx); right = Math.max(right, cx); top = Math.min(top, cy); bottom = Math.max(bottom, cy);
  }
  if (right < area.left || left > area.left + area.width || bottom < area.top || top > area.top + area.height) return;
  return { left, top, right, bottom };
}
export function spritePick(sprites: readonly Sprite[], client: { x: number; y: number }, camera: Camera, area: ScreenArea) {
  if (area.width <= 0 || area.height <= 0) return;
  camera.updateMatrixWorld();
  for (const sprite of sprites) sprite.updateWorldMatrix(true, false);
  const ray = new Raycaster();
  ray.setFromCamera(new Vector2((client.x - area.left) / area.width * 2 - 1, 1 - (client.y - area.top) / area.height * 2), camera);
  const hit = ray.intersectObjects([...sprites], false).find(hit => hit.object.visible);
  if (!hit) return;
  const sprite = hit.object as Sprite, position = sprite.getWorldPosition(new Vector3()), size = sprite.getWorldScale(new Vector3());
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const corner = (x: number, y: number) => position.clone().addScaledVector(right, x * size.x).addScaledVector(up, y * size.y).project(camera);
  const a = corner(-sprite.center.x, 1 - sprite.center.y), b = corner(1 - sprite.center.x, -sprite.center.y);
  return { index: sprites.indexOf(sprite), box: { left: area.left + (a.x + 1) / 2 * area.width, right: area.left + (b.x + 1) / 2 * area.width,
    top: area.top + (1 - a.y) / 2 * area.height, bottom: area.top + (1 - b.y) / 2 * area.height } };
}
