/** Area weighted sampling in original League coordinates; mirroring happens only at draw time. */
import type { EmissionSampler } from '../engine/simulation/emissionSurface';
import type { MeshGeometry } from './meshBuffer';
import { drawnIndices } from './submeshes';
export function meshEmission(mesh: MeshGeometry, submeshes: readonly string[] = []): EmissionSampler {
  const indices = drawnIndices(mesh, submeshes, []), triangles: number[] = [], areas: number[] = [];
  const p = mesh.positions;
  if (p.length > 3_000_000 || indices.length > 3_000_000 || !p.every(Number.isFinite)) throw Error('surface-budget');
  let total = 0;
  for (let at = 0; at + 2 < indices.length; at += 3) {
    const a = indices[at] * 3, b = indices[at + 1] * 3, c = indices[at + 2] * 3;
    if (Math.max(a, b, c) + 2 >= p.length) throw Error('surface-index');
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const area = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    if (area > 0) { total += area; triangles.push(at); areas.push(total); }
  }
  if (!(total > 0) || !Number.isFinite(total)) throw Error('surface-empty');
  return { sample(_time, rng, out) {
    const pick = rng.unitFloat() * total;
    let low = 0, high = areas.length - 1;
    while (low < high) { const mid = (low + high) >>> 1; if (pick < areas[mid]) high = mid; else low = mid + 1; }
    const at = triangles[low], a = indices[at] * 3, b = indices[at + 1] * 3, c = indices[at + 2] * 3;
    const root = Math.sqrt(rng.unitFloat()), v = rng.unitFloat(), weights = [1 - root, root * (1 - v), root * v];
    for (let axis = 0; axis < 3; axis++) out.position[axis] = weights[0] * p[a + axis] + weights[1] * p[b + axis] + weights[2] * p[c + axis];
    const n = mesh.normals;
    if (n) for (let axis = 0; axis < 3; axis++) out.normal[axis] = weights[0] * n[a + axis] + weights[1] * n[b + axis] + weights[2] * n[c + axis];
    else {
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      out.normal.set([uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]);
    }
    const length = Math.hypot(...out.normal);
    if (!(length > 0) || !Number.isFinite(length)) out.normal.set([0, 1, 0]);
    else for (let axis = 0; axis < 3; axis++) out.normal[axis] /= length;
    return true;
  } };
}
