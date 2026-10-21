import { carouselPoint } from './carousel-geometry.mjs';

const epsilon = 1e-6;
const check = (ok, reason) => { if (!ok) throw new Error(reason); };

/** Intersect actual material triangles, after their source transforms, with
 * the vertical section through the board centre. No decorative arena bbox. */
export function boardGroundSpan(geometry, center) {
  const floor = [], walls = [];
  for (const mesh of geometry.meshes) {
    const points = mesh.vertices.map(v => {
      const p = carouselPoint(v.p, mesh.matrix, [0, 0, 0]);
      return [-p[0], p[1], p[2]]; // native space, before the GLB X reflection
    });
    for (const range of mesh.ranges) {
      const ground = /\/BattleField_A_MAT$/i.test(range.material);
      const wall = /\/Bench_A_MAT$/i.test(range.material);
      if (!ground && !wall) continue;
      for (let i = range.start; i < range.start + range.count; i += 3) {
        const vs = mesh.indices.slice(i, i + 3).map(j => points[j]);
        if (ground) {
          if (!vs.every(p => Math.abs(p[1] - center[1]) < epsilon)) continue;
          for (let k = 0; k < 3; k++) {
            const a = vs[k], b = vs[(k + 1) % 3], dx = b[0] - a[0];
            if (Math.abs(dx) < epsilon) {
              if (Math.abs(a[0] - center[0]) < epsilon) floor.push(a[2], b[2]);
            } else {
              const t = (center[0] - a[0]) / dx;
              if (t >= -epsilon && t <= 1 + epsilon) floor.push(a[2] + t * (b[2] - a[2]));
            }
          }
        } else {
          // Barycentric intersection of a Z ray with the wall's XY projection.
          const [a, b, c] = vs;
          const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
          if (Math.abs(det) < epsilon) continue;
          const u = ((b[1] - c[1]) * (center[0] - c[0]) + (c[0] - b[0]) * (center[1] - c[1])) / det;
          const v = ((c[1] - a[1]) * (center[0] - c[0]) + (a[0] - c[0]) * (center[1] - c[1])) / det;
          if ([u, v, 1 - u - v].every(w => w >= -epsilon)) walls.push(u * a[2] + v * b[2] + (1 - u - v) * c[2]);
        }
      }
    }
  }
  const floorMin = Math.min(...floor), floorMax = Math.max(...floor);
  check(floor.length && floorMin < center[2] && center[2] < floorMax, 'missing-board-ground-section');
  const near = walls.filter(z => z > floorMin && z < center[2]);
  const far = walls.filter(z => z < floorMax && z > center[2]);
  check(near.length && far.length, 'missing-board-ground-walls');
  return { min: Math.max(...near), max: Math.min(...far), floor: [floorMin, floorMax],
    policy: 'Source ground/wall intersection at board centre; not recovered native cell centres.' };
}

/** Fit the full pointy-hex envelope between the observed ground walls.
 * Eight rows occupy (7 * 1.5 + 2) radii, including both end hex tips.
 * X alignment is retained. This is an explicit display fit, not evidence that
 * BoardLocator is cell (0,0), or that the native client used these centres. */
export function alignBoardGroundZ(alignment, span, rows = 8) {
  check(Number.isInteger(rows) && rows > 1 && Number.isFinite(span.min) && Number.isFinite(span.max)
    && span.min < span.max, 'invalid-board-ground-span');
  const radius = (span.max - span.min) / ((rows - 1) * 1.5 + 2);
  const scaleZ = alignment.target.radius / radius;
  const targetMiddle = alignment.target.origin.y + alignment.target.radius * 1.5 * (rows - 1) / 2;
  return { ...alignment, status: 'ground-span-aligned',
    scale: [alignment.scale[0], alignment.scale[1], -scaleZ],
    offset: [alignment.offset[0], alignment.offset[1], targetMiddle + scaleZ * (span.min + span.max) / 2],
    sourceLocator: alignment.sourceFirstCell,
    sourceFirstCell: [alignment.sourceFirstCell[0], alignment.sourceFirstCell[1], span.min + radius],
    sourceSteps: [alignment.sourceSteps[0], radius * 1.5],
    sourceGround: span,
    gridMapping: 'fitted source (col,row) -> runtime (6-col,7-row); odd-row offset',
    policy: 'X from locators; Z fits full hex envelope to ground/wall section. Native cell centres unavailable. Retarget using BoardFrame radius/origin.' };
}
