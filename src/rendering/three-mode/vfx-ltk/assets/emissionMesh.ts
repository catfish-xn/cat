import { readMeshBuffer } from './meshBuffer';
import type { EmissionSampler } from '../engine/simulation/emissionSurface';
/** Static birth mesh, in the original engine space (the draw mesh mirrors X later).
 * Area weighting prevents small triangles from receiving the same births as large ones. */
export function readEmissionMesh(bytes: ArrayBuffer): EmissionSampler {
  const mesh = readMeshBuffer(bytes), triangles: { vertices: number[]; normal: number[]; end: number }[] = [];
  if (mesh.skinIndices || mesh.indices.length % 3) throw Error('emission-mesh-static-triangles');
  let area = 0;
  for (let at = 0; at < mesh.indices.length; at += 3) {
    const vertices = Array.from(mesh.indices.slice(at, at + 3), i => i * 3);
    if (vertices.some(i => i + 2 >= mesh.positions.length)) throw Error('emission-mesh-index');
    const [a, b, c] = vertices, p = mesh.positions;
    const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
    const v = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const size = Math.hypot(...n);
    if (!Number.isFinite(size)) throw Error('emission-mesh-nonfinite');
    if (!size) continue;
    area += size;
    triangles.push({ vertices, normal: n.map(x => x / size), end: area });
  }
  if (!area) throw Error('emission-mesh-empty');
  return { sample(_time, rng, out) {
    const choice = rng.unitFloat() * area;
    let lo = 0, hi = triangles.length - 1;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (choice < triangles[mid].end) hi = mid; else lo = mid + 1; }
    const t = triangles[lo], r = Math.sqrt(rng.unitFloat()), s = rng.unitFloat(), weights = [1 - r, r * (1 - s), r * s];
    for (let axis = 0; axis < 3; axis++) {
      out.position[axis] = t.vertices.reduce((sum, vertex, i) => sum + mesh.positions[vertex + axis] * weights[i], 0);
      out.normal[axis] = t.normal[axis];
    }
    return true;
  } };
}
