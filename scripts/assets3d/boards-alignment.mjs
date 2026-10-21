import { carouselPoint } from './carousel-geometry.mjs';

const epsilon = 1e-6;
const check = (ok, reason) => { if (!ok) throw new Error(reason); };

/** Intersect actual material triangles, after their source transforms, with
 * a centre ray at ground height (Z: front/back; X: left/right).
 * Bench_A_MAT includes the side stone borders as well as the benches.
 * No decorative arena bbox or untransformed vertex bounds. */
export function boardGroundSpan(geometry, center, axis = 'z') {
  check(axis === 'x' || axis === 'z', 'invalid-board-ground-axis');
  const along = axis === 'x' ? 0 : 2, across = axis === 'x' ? 2 : 0;
  const reason = suffix => `missing-board-ground-${axis === 'x' ? 'x-' : ''}${suffix}`;
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
        // Permute X/Z so both sections use the same triangle intersection.
        const vs = mesh.indices.slice(i, i + 3).map(j => [points[j][across], points[j][1], points[j][along]]);
        if (ground) {
          if (!vs.every(p => Math.abs(p[1] - center[1]) < epsilon)) continue;
          for (let k = 0; k < 3; k++) {
            const a = vs[k], b = vs[(k + 1) % 3], dx = b[0] - a[0];
            if (Math.abs(dx) < epsilon) {
              if (Math.abs(a[0] - center[across]) < epsilon) floor.push(a[2], b[2]);
            } else {
              const t = (center[across] - a[0]) / dx;
              if (t >= -epsilon && t <= 1 + epsilon) floor.push(a[2] + t * (b[2] - a[2]));
            }
          }
        } else {
          // Barycentric ray intersection with the wall's transverse projection.
          const [a, b, c] = vs;
          const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
          if (Math.abs(det) < epsilon) continue;
          const u = ((b[1] - c[1]) * (center[across] - c[0]) + (c[0] - b[0]) * (center[1] - c[1])) / det;
          const v = ((c[1] - a[1]) * (center[across] - c[0]) + (a[0] - c[0]) * (center[1] - c[1])) / det;
          if ([u, v, 1 - u - v].every(w => w >= -epsilon)) walls.push(u * a[2] + v * b[2] + (1 - u - v) * c[2]);
        }
      }
    }
  }
  const floorMin = Math.min(...floor), floorMax = Math.max(...floor);
  check(floor.length && floorMin < center[along] && center[along] < floorMax, reason('section'));
  const near = walls.filter(z => z > floorMin && z < center[along]);
  const far = walls.filter(z => z < floorMax && z > center[along]);
  check(near.length && far.length, reason('walls'));
  return { min: Math.max(...near), max: Math.min(...far), floor: [floorMin, floorMax],
    policy: 'Source ground/wall intersection at board centre; not recovered native cell centres.' };
}

/** Fit both full envelopes, keeping the runtime grid regular. The staggered
 * seven-column grid occupies 7.5 widths; outer centres are half a width from
 * either side wall, just as the end rows are one radius from front/back walls.
 * Y stays at the locator scale to preserve existing height placement. */
export function alignBoardGroundXZ(alignment, spans, columns = 7, rows = 8) {
  const span = spans.x;
  check(Number.isInteger(columns) && columns > 1 && span && Number.isFinite(span.min)
    && Number.isFinite(span.max) && span.min < span.max, 'invalid-board-ground-x-span');
  const next = alignBoardGroundZ(alignment, spans.z, rows);
  const width = (span.max - span.min) / (columns + 0.5);
  const targetWidth = Math.sqrt(3) * alignment.target.radius;
  const scaleX = targetWidth / width;
  const targetMiddle = alignment.target.origin.x + targetWidth * (columns - 0.5) / 2;
  const xOverZ = scaleX / Math.abs(next.scale[2]);
  return { ...next,
    scale: [scaleX, next.scale[1], next.scale[2]],
    offset: [targetMiddle + scaleX * (span.min + span.max) / 2, next.offset[1], next.offset[2]],
    sourceFirstCell: [span.min + width / 2, next.sourceFirstCell[1], next.sourceFirstCell[2]],
    sourceSteps: [width, next.sourceSteps[1]],
    sourceGroundX: span,
    deformation: { basis: 'locator-estimate', scaleRatios: { x: scaleX / alignment.scale[0], z: next.scale[2] / alignment.scale[2] },
      xOverZ, axisDifferencePercent: (Math.max(xOverZ, 1 / xOverZ) - 1) * 100 },
    policy: 'X/Z fit full hex envelopes to centre ground/wall sections, with zero envelope-to-wall margins. Y unchanged. Native cell centres unavailable. Retarget using BoardFrame radius/origin.' };
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
