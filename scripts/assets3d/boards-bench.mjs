import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { readBoardGeometry } from './boards-geometry.mjs';
import { carouselPoint } from './carousel-geometry.mjs';
import { readGlb } from './glb.mjs';
import { boardRoot, boardPlanJson } from './boards-plan.mjs';
import { binField } from './bin.mjs';
import { createPrecache } from './merge-manifests.mjs';
import { packageFiles, verifyBoardPackage } from './boards-package.mjs';
import { safeInputPath, writeOutputFileAtomic } from './safe-path.mjs';

const check = (ok, reason) => { if (!ok) throw new Error(reason); };
const hash = b => createHash('sha256').update(b).digest('hex');
const distance = (a, b) => Math.hypot(...a.map((v, k) => v - b[k]));

/** Coordinates here are already baked GLB coordinates. Never reflect them again. */
export function benchWorld(p, alignment) {
  return p.map((v, k) => alignment.offset[k] + alignment.scale[k] * v);
}

/** Report decorative deviations, rejecting incomplete, unordered or irregular rows.
 * Home is a cross-check, not a presumed midpoint: shipped Home locators can be
 * at an end cell. Spacing comes only from faces/texture seams, never sourceSteps. */
export function validateBench(bench, alignment, home, limits = {}) {
  check(Array.isArray(bench) && bench.length === 9 && bench.every(p =>
    Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)), 'bench-needs-nine-xyz');
  check(alignment.scale?.length === 3 && alignment.scale.every(v => Number.isFinite(v) && v !== 0)
    && alignment.offset?.length === 3 && alignment.offset.every(Number.isFinite)
    && alignment.sourceSteps?.length === 2 && alignment.sourceSteps.every(v => v > 0 && Number.isFinite(v))
    && home?.length === 3 && home.every(Number.isFinite), 'invalid-bench-frame');
  const world = bench.map(p => benchWorld(p, alignment));
  check(world.every((p, i) => !i || p[0] > world[i - 1][0]), 'bench-player-order');
  const gaps = bench.slice(1).map((p, i) => distance(p, bench[i]));
  const meanGap = gaps.reduce((a, b) => a + b) / gaps.length;
  const maxSpacingDeviationRatio = Math.max(...gaps.map(v => Math.abs(v - meanGap))) / meanGap;
  const direction = bench[8].map((v, k) => v - bench[0][k]), length = Math.hypot(...direction);
  const lineDistances = bench.map(p => {
    const v = p.map((x, k) => x - bench[0][k]);
    const t = v.reduce((s, x, k) => s + x * direction[k], 0) / (length * length);
    return distance(v, direction.map(x => x * t));
  });
  const maxLineDeviation = Math.max(...lineDistances);
  check(maxSpacingDeviationRatio <= (limits.spacingRatio ?? .12), 'bench-unequal-spacing');
  check(maxLineDeviation / meanGap <= (limits.lineRatio ?? .08), 'bench-not-collinear');
  const midpoint = bench[0].map((v, k) => (v + bench[8][k]) / 2);
  const anchorDistances = bench.map(p => distance(p, home));
  const nearestAnchorIndex = anchorDistances.indexOf(Math.min(...anchorDistances));
  check(anchorDistances[nearestAnchorIndex] / meanGap <= (limits.anchorRatio ?? .65), 'bench-away-from-home');
  return { count: 9, order: 'increasing runtime X; index 0 = BoardFrame.bench[0]', gaps, meanGap,
    maxSpacingDeviationRatio, lineDistances, maxLineDeviation, midpoint,
    limits: { spacingRatio: limits.spacingRatio ?? .12, lineRatio: limits.lineRatio ?? .08, anchorRatio: limits.anchorRatio ?? .65 },
    homeAnchorGlb: home, midpointMinusHome: midpoint.map((v, k) => v - home[k]),
    midpointDistanceFromHome: distance(midpoint, home), nearestAnchorIndex,
    midpointCloseToHome: distance(midpoint, home) <= meanGap * .65,
    nearestAnchorDistance: anchorDistances[nearestAnchorIndex],
    anchorInterpretation: nearestAnchorIndex === 4 ? 'near-middle-cell' : 'near-end-cell; midpoint assumption contradicted by geometry',
    gapOverSourceColumnStep: meanGap / alignment.sourceSteps[0],
    gapOverSourceRowStep: meanGap / alignment.sourceSteps[1],
    maxGroundHeightRange: Math.max(...bench.map(p => p[1])) - Math.min(...bench.map(p => p[1])) };
}

function weights(p, triangle) {
  const [a, b, c] = triangle, det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(det) < 1e-12) return null;
  const u = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / det;
  const v = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / det;
  return [u, v, 1 - u - v].every(v => v >= -1e-7) ? [u, v, 1 - u - v] : null;
}

/** A tile is bounded by independently observed UV seams, not an inferred pitch. */
export function benchFromUvTiles(triangles, tiles, alignment, home) {
  check(tiles.length === 9, 'bench-needs-nine-tiles');
  const cells = tiles.map(tile => {
    check(tile.min?.length === 2 && tile.max?.length === 2 && [...tile.min, ...tile.max].every(Number.isFinite)
      && tile.min.every((v, k) => v < tile.max[k]), 'invalid-bench-uv-tile');
    const uv = tile.min.map((v, k) => (v + tile.max[k]) / 2);
    const hits = triangles.flatMap(t => {
      const w = weights(uv, t.vs.map(v => v.uv));
      return w ? [{ triangle: t.i, point: [0, 1, 2].map(k => t.vs.reduce((s, v, i) => s + v.p[k] * w[i], 0)), vertices: t.vs }] : [];
    });
    check(hits.length > 0, 'bench-uv-outside-ground');
    check(hits.every(h => distance(h.point, hits[0].point) < .05), 'bench-uv-ambiguous-ground');
    return { uvBounds: tile, uvCenter: uv, point: hits[0].point, hits };
  }).sort((a, b) => benchWorld(a.point, alignment)[0] - benchWorld(b.point, alignment)[0]);
  const bench = cells.map(c => c.point);
  return { bench, cells, checks: validateBench(bench, alignment, home) };
}

/** Prefer authored individual rectangular ground faces when they exist. Pair
 * both triangles and require all four corners, so a diagonal alone is no tile. */
export function benchFromGroundQuads(triangles, alignment, home) {
  const groups = new Map();
  for (const t of triangles) {
    const min = [0, 1, 2].map(k => Math.min(...t.vs.map(v => v.p[k])));
    const max = [0, 1, 2].map(k => Math.max(...t.vs.map(v => v.p[k])));
    if (max[1] - min[1] > .01 || [0, 2].some((k, i) => max[k] - min[k] < alignment.sourceSteps[i] * .7
      || max[k] - min[k] > alignment.sourceSteps[i] * 1.5)) continue;
    const key = [...min, ...max].map(v => Math.round(v * 100)).join(',');
    if (!groups.has(key)) groups.set(key, { min, max, hits: [] });
    groups.get(key).hits.push({ triangle: t.i, vertices: t.vs });
  }
  const cells = [...groups.values()].filter(g => {
    if (g.hits.length !== 2) return false;
    const corners = g.hits.flatMap(h => h.vertices.map(v => v.p));
    if (!corners.every(p => [0, 2].every(k => Math.min(Math.abs(p[k] - g.min[k]), Math.abs(p[k] - g.max[k])) < .01))) return false;
    return new Set(corners.map(p => p.map(v => Math.round(v * 100)).join(','))).size === 4;
  }).map(g => ({ ...g, point: g.min.map((v, k) => (v + g.max[k]) / 2) }))
    .sort((a, b) => benchWorld(a.point, alignment)[0] - benchWorld(b.point, alignment)[0]);
  const bench = cells.map(c => c.point);
  return { bench, cells, checks: validateBench(bench, alignment, home) };
}

/** Visually selected seam windows are local evidence. Pick the measured ridge /
 * trough within each window and retain its score; never synthesize missing seams. */
export async function measureBenchSeams(png, islands) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const tiles = [], measurements = [];
  for (const island of islands) {
    const { axis, band, windows, ends, crossBounds, polarity } = island;
    check([0, 1].includes(axis) && ['dark', 'bright'].includes(polarity), 'invalid-bench-seam-profile');
    const size = [info.width, info.height], other = 1 - axis;
    check(ends.length === 2 && ends[0] >= 0 && ends[0] < ends[1] && ends[1] <= size[axis]
      && band[0] >= 0 && band[0] < band[1] && band[1] <= size[other]
      && crossBounds[0] < crossBounds[1] && crossBounds[0] >= 0 && crossBounds[1] <= size[other], 'invalid-bench-seam-bounds');
    const score = i => {
      let total = 0, count = 0;
      for (let j = band[0]; j < band[1]; j++) for (let o = -1; o <= 1; o++) {
        const [x, y] = axis === 0 ? [i + o, j] : [j, i + o], at = (y * info.width + x) * 4;
        total += .2126 * data[at] + .7152 * data[at + 1] + .0722 * data[at + 2]; count++;
      }
      return total / count;
    };
    const samples = windows.map(([lo, hi], index) => {
      check(Number.isInteger(lo) && Number.isInteger(hi) && lo > ends[0] && hi < ends[1] && lo <= hi
        && lo >= 1 && hi < size[axis] - 1 && (!index || lo > windows[index - 1][1]), 'invalid-bench-seam-window');
      const scores = Array.from({ length: hi - lo + 1 }, (_, n) => ({ pixel: lo + n, luminance: score(lo + n) }));
      const sign = polarity === 'bright' ? 1 : -1;
      const best = scores.reduce((a, b) => sign * a.luminance >= sign * b.luminance ? a : b);
      check(Math.max(...scores.map(s => s.luminance)) - Math.min(...scores.map(s => s.luminance)) >= 1, 'bench-seam-no-contrast');
      return { window: [lo, hi], ...best, scores };
    });
    const seams = [ends[0], ...samples.map(s => s.pixel), ends[1]];
    for (let i = 1; i < seams.length; i++) {
      const min = [], max = [];
      min[axis] = seams[i - 1] / size[axis]; max[axis] = seams[i] / size[axis];
      min[other] = crossBounds[0] / size[other]; max[other] = crossBounds[1] / size[other];
      tiles.push({ min, max });
    }
    measurements.push({ ...island, seams, samples, textureSize: size });
  }
  return { tiles, measurements };
}

function groundTriangles(mesh, home, steps) {
  const result = [], ps = mesh.vertices.map(v => carouselPoint(v.p, mesh.matrix, [0, 0, 0]));
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const vs = mesh.indices.slice(i, i + 3).map(j => ({ p: ps[j], uv: mesh.vertices[j].uv }));
    if (vs.some(v => Math.abs(v.p[2] - home[2]) > steps[1] || Math.abs(v.p[1] - home[1]) > steps[1])) continue;
    const [a, b, c] = vs.map(v => v.p), u = b.map((v, k) => v - a[k]), v = c.map((v, k) => v - a[k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.abs(n[1]) / Math.hypot(...n) >= .995) result.push({ i, vs });
  }
  return result;
}

function glbEvidence(bytes, nodeName) {
  const { document: d, binary: b } = readGlb(bytes), node = d.nodes.find(n => n.name === nodeName);
  check(node && !node.matrix && !node.translation && !node.rotation && !node.scale, 'bench-glb-node-not-baked');
  const primitive = d.meshes[node.mesh].primitives[0];
  check(d.meshes[node.mesh].primitives.length === 1 && primitive.indices === undefined && (primitive.mode ?? 4) === 4, 'unsupported-bench-glb-layout');
  function attribute(id, width) {
    const a = d.accessors[id], view = d.bufferViews[a.bufferView];
    check(a.componentType === 5126 && !a.sparse, 'unsupported-bench-glb-accessor');
    const offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = view.byteStride ?? width * 4;
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: width }, (_, k) => b.readFloatLE(offset + i * stride + k * 4)));
  }
  const positions = attribute(primitive.attributes.POSITION, 3), uv = attribute(primitive.attributes.TEXCOORD_0, 2);
  const triangles = [];
  for (let i = 0; i < positions.length; i += 3) triangles.push({ i, vs: [0, 1, 2].map(k => ({ p: positions[i + k], uv: uv[i + k] })) });
  const material = d.materials[primitive.material], image = d.images[d.textures[material.pbrMetallicRoughness.baseColorTexture.index].source], view = d.bufferViews[image.bufferView];
  return { triangles, texture: b.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength), material: material.name };
}

/** Evidence config contains local material identities and measured pixel windows.
 * Copyrighted geometry, textures, and derived coordinates stay in ignored roots. */
export async function locateBoardBenches(evidencePath) {
  const base = resolve('assets3d-local/boards');
  const configBytes = await readFile(await safeInputPath(base, resolve(evidencePath)));
  const config = JSON.parse(configBytes), results = [];
  const plan = JSON.parse(await readFile(join(base, 'boards-plan.json')));
  for (const pick of plan.picks) {
    const key = pick.key, evidence = config[key], root = join(base, boardRoot(key));
    const report = { key, schemaVersion: 1, evidenceConfigSha256: hash(configBytes), status: 'unresolved' };
    try {
      check(evidence, 'missing-local-bench-evidence');
      const buildReport = JSON.parse(await readFile(join(base, 'reports', `${key}.json`)));
      const source = buildReport.sourceFiles.find(f => f.path.endsWith('.mapgeo'));
      const sourceBytes = await readFile(await safeInputPath(base, join(base, source.path)));
      check(hash(sourceBytes) === source.sha256, 'bench-source-hash-mismatch');
      report.source = source;
      report.scbSources = buildReport.sourceFiles.filter(f => f.path.endsWith('.scb')).map(f => ({ path: f.path, source: f.source,
        role: 'not needed for extraction: bench surface positively located in mapgeo and arena GLB' }));
      const manifest = JSON.parse(await readFile(join(root, 'manifest.json'))), entry = manifest.boards[key];
      const scene = JSON.parse(await readFile(join(root, entry.path))), alignment = entry.alignment;
      const homeSource = binField(scene.locators.find(l => binField(l, 'name') === 'BenchHomeLocator'), 'transform').slice(12, 15);
      const home = [-homeSource[0], homeSource[1], homeSource[2]];
      const mesh = readBoardGeometry(sourceBytes).meshes[evidence.mesh];
      check(mesh?.ranges.length === 1, 'unsupported-bench-material-ranges');
      const glbPath = join(root, manifest.models[key].path), glbBytes = await readFile(glbPath);
      const glb = glbEvidence(glbBytes, `${key}-static-${evidence.mesh}-0`);
      report.geometry = { mesh: evidence.mesh, material: glb.material, glbPath, glbSha256: hash(glbBytes),
        textureSha256: hash(glb.texture), method: evidence.method };
      check(glb.material === evidence.material && mesh.ranges[0].material === evidence.material, 'bench-material-mismatch');
      const measured = await measureBenchSeams(glb.texture, evidence.islands ?? [evidence]);
      report.seams = measured.measurements;
      const sourceTriangles = groundTriangles(mesh, home, alignment.sourceSteps);
      const extract = triangles => evidence.geometryQuads
        ? benchFromGroundQuads(triangles, alignment, home)
        : benchFromUvTiles(triangles, measured.tiles, alignment, home);
      const sourceResult = extract(sourceTriangles);
      const used = new Set(sourceResult.cells.flatMap(c => c.hits.map(h => h.triangle)));
      // Conversion reverses each source triangle's winding, retaining its index.
      const glbResult = extract(glb.triangles.filter(t => used.has(t.i)));
      report.sourceGlbMaxCenterDeviation = Math.max(...sourceResult.bench.map((p, i) => distance(p, glbResult.bench[i])));
      check(report.sourceGlbMaxCenterDeviation < .01, 'bench-source-glb-mismatch');
      report.bench = glbResult.bench; report.cells = glbResult.cells; report.checks = glbResult.checks;
      report.visualReview = evidence.visualReview ?? null;
      report.status = 'geometry-verified';
      report.roots = [];
      for (const kind of ['boards', 'boards-compressed']) {
        const target = resolve('assets3d-local', kind, boardRoot(key)), files = await packageFiles(target);
        const m = JSON.parse(files.get('manifest.json')), s = JSON.parse(files.get(m.boards[key].path));
        check(JSON.stringify(m.boards[key].alignment.sourceSteps) === JSON.stringify(alignment.sourceSteps), 'bench-root-frame-mismatch');
        m.boards[key].alignment.bench = glbResult.bench;
        s.alignment.bench = glbResult.bench;
        files.set('manifest.json', Buffer.from(boardPlanJson(m)));
        files.set(m.boards[key].path, Buffer.from(boardPlanJson(s)));
        const plans = new Map([...files].filter(([p]) => !['manifest.json', 'precache.json', 'compression-report.json'].includes(p))
          .map(([p, bytes]) => [p, { bytes: bytes.length, sha256: hash(bytes) }]));
        const precache = createPrecache(plans); files.set('precache.json', Buffer.from(boardPlanJson(precache)));
        const effects = Object.fromEntries(Object.entries(m.effects).map(([id, e]) => [id, JSON.parse(files.get(e.path))]));
        const verified = verifyBoardPackage(m, precache, files, effects);
        for (const p of ['manifest.json', m.boards[key].path, 'precache.json'])
          await writeOutputFileAtomic(join(target, p), files.get(p), { force: true });
        report.roots.push({ root: target, ...verified });
      }
    } catch (error) { report.status = 'unresolved'; report.reason = error.message; }
    await writeOutputFileAtomic(join(base, 'reports', `bench-locators-${key}.json`), Buffer.from(boardPlanJson(report)), { force: true });
    results.push({ key, status: report.status, reason: report.reason, checks: report.checks });
  }
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  check(process.argv[2] === '--evidence' && process.argv.length === 4, 'usage: boards-bench.mjs --evidence <local-json>');
  const results = await locateBoardBenches(process.argv[3]);
  console.log(JSON.stringify(results, null, 2));
  if (results.some(r => r.status !== 'geometry-verified')) process.exitCode = 1;
}
