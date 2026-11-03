import { carouselPoint } from './carousel-geometry.mjs';

const epsilon = 1e-6;
const check = (ok, reason) => { if (!ok) throw new Error(reason); };

/** Intersect ground / wall triangles with a centre ray at sample height.
 * Coordinates are native mapgeo space (before GLB X reflection). */
export function boardGroundSpan(geometry, sample, axis = 'z', materials = {}) {
  const groundRe = materials.ground ?? /\/BattleField_A_MAT$/i;
  const wallRe = materials.wall ?? /\/Bench_A_MAT$/i;
  check(axis === 'x' || axis === 'z', 'invalid-board-ground-axis');
  const along = axis === 'x' ? 0 : 2, across = axis === 'x' ? 2 : 0;
  const reason = suffix => `missing-board-ground-${axis === 'x' ? 'x-' : ''}${suffix}`;
  const floor = [], walls = [];
  for (const mesh of geometry.meshes) {
    const points = mesh.vertices.map(v => {
      const p = carouselPoint(v.p, mesh.matrix, [0, 0, 0]);
      return [-p[0], p[1], p[2]];
    });
    for (const range of mesh.ranges) {
      const ground = groundRe.test(range.material);
      const wall = wallRe.test(range.material);
      if (!ground && !wall) continue;
      for (let i = range.start; i < range.start + range.count; i += 3) {
        const vs = mesh.indices.slice(i, i + 3).map(j => [points[j][across], points[j][1], points[j][along]]);
        if (ground) {
          if (!vs.every(p => Math.abs(p[1] - sample[1]) < (materials.groundYTolerance ?? epsilon))) continue;
          for (let k = 0; k < 3; k++) {
            const a = vs[k], b = vs[(k + 1) % 3], dx = b[0] - a[0];
            if (Math.abs(dx) < epsilon) {
              if (Math.abs(a[0] - sample[across]) < epsilon) floor.push(a[2], b[2]);
            } else {
              const t = (sample[across] - a[0]) / dx;
              if (t >= -epsilon && t <= 1 + epsilon) floor.push(a[2] + t * (b[2] - a[2]));
            }
          }
        } else if (wall) {
          const [a, b, c] = vs;
          const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
          if (Math.abs(det) < epsilon) continue;
          const u = ((b[1] - c[1]) * (sample[across] - c[0]) + (c[0] - b[0]) * (sample[1] - c[1])) / det;
          const v = ((c[1] - a[1]) * (sample[across] - c[0]) + (a[0] - c[0]) * (sample[1] - c[1])) / det;
          if ([u, v, 1 - u - v].every(w => w >= -epsilon)) walls.push(u * a[2] + v * b[2] + (1 - u - v) * c[2]);
        }
      }
    }
  }
  const floorMin = Math.min(...floor), floorMax = Math.max(...floor);
  check(floor.length && floorMin < sample[along] && sample[along] < floorMax, reason('section'));
  const near = walls.filter(z => z > floorMin && z < sample[along]);
  const far = walls.filter(z => z < floorMax && z > sample[along]);
  check(near.length && far.length, reason('walls'));
  const innerMin = Math.max(...near), innerMax = Math.min(...far);
  return { min: innerMin, max: innerMax, floor: [floorMin, floorMax],
    sourceWidth: innerMax - innerMin,
    policy: 'Ground floor ray at sample height; inner wall material intersections on axis x.' };
}

export function dominantGroundHeight(geometry, groundRe = /\/BattleField_A_MAT$/i) {
  const buckets = new Map();
  for (const mesh of geometry.meshes) {
    const points = mesh.vertices.map(v => carouselPoint(v.p, mesh.matrix, [0, 0, 0]));
    for (const range of mesh.ranges) {
      if (!groundRe.test(range.material)) continue;
      for (let i = range.start; i < range.start + range.count; i += 3)
        for (const j of mesh.indices.slice(i, i + 3)) {
          const y = Math.round(points[j][1] * 20) / 20;
          buckets.set(y, (buckets.get(y) ?? 0) + 1);
        }
    }
  }
  check(buckets.size, 'missing-board-ground-height');
  return [...buckets.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Front combat row in source space: runtime row 3 (home front line in layout screenshots). */
export function walkableMeasureSample(first, center, sourceSteps, runtimeFrontRow = 3) {
  const sourceRow = 7 - runtimeFrontRow;
  return [center[0], first[1], first[2] + sourceSteps[1] * sourceRow];
}

export function groundFloorSliceX(geometry, sample, groundRe, tolerance = 0.05, zBandRatio = 0.45, sourceStepZ = 1) {
  const xs = [];
  for (const mesh of geometry.meshes) {
    const points = mesh.vertices.map(v => {
      const p = carouselPoint(v.p, mesh.matrix, [0, 0, 0]);
      return [-p[0], p[1], p[2]];
    });
    for (const range of mesh.ranges) {
      if (!groundRe.test(range.material)) continue;
      for (let i = range.start; i < range.start + range.count; i += 3) {
        for (const j of mesh.indices.slice(i, i + 3)) {
          const p = points[j];
          if (Math.abs(p[1] - sample[1]) > tolerance) continue;
          if (Math.abs(p[2] - sample[2]) > sourceStepZ * zBandRatio) continue;
          xs.push(p[0]);
        }
      }
    }
  }
  check(xs.length, 'missing-board-ground-floor-slice');
  xs.sort((a, b) => a - b);
  return { min: xs[0], max: xs[xs.length - 1], sourceWidth: xs[xs.length - 1] - xs[0] };
}

export function measureWalkableWidth(geometry, first, center, options = {}) {
  const sourceStepX = (center[0] - first[0]) / 3.25;
  const sourceStepZ = (center[2] - first[2]) / 3.5;
  check(sourceStepX > 0 && sourceStepZ > 0, 'invalid-board-locators');
  const materials = options.walkableMaterials ?? {};
  const groundRe = materials.ground ?? /\/BattleField_A_MAT$/i;
  const groundY = options.groundY ?? dominantGroundHeight(geometry, groundRe);
  const sample = walkableMeasureSample(first, center, [sourceStepX, sourceStepZ], options.runtimeFrontRow ?? 3);
  sample[1] = groundY;
  const mode = options.measureMode ?? 'inner-walls';
  let span, method = 'boardGroundSpan-x-at-front-row';
  if (mode === 'ground-floor-slice') {
    span = groundFloorSliceX(geometry, sample, groundRe, options.groundYTolerance ?? 0.05, 0.45, sourceStepZ);
    method = 'ground-floor-slice-x-at-front-row';
  } else {
    span = boardGroundSpan(geometry, sample, 'x', { ...materials, groundYTolerance: options.groundYTolerance ?? 0.05 });
  }
  const impliedWalkableCells = span.sourceWidth / sourceStepX;
  return {
    schemaVersion: 1,
    method,
    measureMode: mode,
    runtimeFrontRow: options.runtimeFrontRow ?? 3,
    samplePoint: sample,
    groundY,
    sourceSteps: [sourceStepX, sourceStepZ],
    walkableInnerSpan: { min: span.min, max: span.max, sourceWidth: span.sourceWidth },
    impliedWalkableCellsAtLocatorScale: impliedWalkableCells,
    walkableMaterials: { ground: String(groundRe), wall: materials.wall ? String(materials.wall) : null },
  };
}

/** When front-row ground is discontinuous, infer locator-scale span from default inner-wall measure and screenshot ratio. */
export function inferWalkableCellsFromDefaultRatio(defaultImplied, defaultScreenshotCells, skinScreenshotCells) {
  check(defaultImplied > 0 && defaultScreenshotCells > 0 && skinScreenshotCells > 0, 'invalid-walkable-ratio');
  return defaultImplied * (skinScreenshotCells / defaultScreenshotCells);
}

/** alignmentScale multiplies locator-aligned sx/sz so implied cells match targetCells. */
export function alignmentScaleFromWalkable(measurement, targetCells) {
  check(targetCells > 0, 'invalid-alignment-target');
  return measurement.impliedWalkableCellsAtLocatorScale / targetCells;
}
