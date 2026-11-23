// Submesh graft: the submesh patch's appended primitives carried into an already compressed asset root.
// The patch (submesh-patch.mjs) appends hidden submeshes before compression. A root whose models are already compressed
// (and carry later per-model steps, such as staged cast clips) cannot be patched in place, and rebuilding a model from
// source would drop those steps. This step rebuilds the unit from source, runs the patch on the rebuild, and copies only
// the appended primitives (their vertices, skin weights remapped by joint name, and material) into the root's compressed
// model, which is then compressed again with the pipeline's compressModelGlb. Every clip is checked to come out unchanged
// and every original triangle to stay on the rebuild's surface. The output holds only the files that change: the models,
// manifest.json (submeshVisibility.initiallyHidden), precache.json (their bytes and sha256) and packs.json (the changed
// models taken out of their packs, so they load on their own). Overlay them on a copy of the input root.
import { Matrix4 } from 'three';

const sortedNames = list => [...new Set(list)].sort();
const transform = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];

/** Every clip's channels as target, path, key times and values: the graft must leave them as they were. */
function clipKeys(root) {
  return root.listAnimations().map(a => [a.getName(), a.listChannels().map(c => [c.getTargetNode()?.getName(), c.getTargetPath(),
    Array.from(c.getSampler().getInput().getArray()), Array.from(c.getSampler().getOutput().getArray())])]);
}

/**
 * Largest distance from a vertex of `prim` (mapped by `toRef`) to the nearest vertex of the same triangle in `ref`,
 * triangles matched by centroid (compression may rotate a triangle's vertex order). Vertices are checked per triangle
 * so a vertex moved onto another triangle's corner still counts as moved.
 */
function surfaceDistance(prim, ref, toRef, cell) {
  const triangles = (p, f) => {
    const indices = p.getIndices().getArray(), position = p.getAttribute('POSITION'), list = [];
    for (let k = 0; k < indices.length; k += 3) list.push([0, 1, 2].map(o => f(position.getElement(indices[k + o], []))));
    return list;
  };
  const centroid = t => [0, 1, 2].map(axis => (t[0][axis] + t[1][axis] + t[2][axis]) / 3), key = c => c.map(v => Math.floor(v / cell));
  const grid = new Map();
  for (const t of triangles(ref, p => p)) { const k = key(centroid(t)).join(); (grid.get(k) ?? grid.set(k, []).get(k)).push(t); }
  let worst = 0;
  for (const t of triangles(prim, toRef)) {
    const [x, y, z] = key(centroid(t)); let best = Infinity;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const r of grid.get([x + dx, y + dy, z + dz].join()) ?? [])
        best = Math.min(best, Math.max(...t.map(v => Math.min(...r.map(u => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]))))));
    }
    worst = Math.max(worst, best);
  }
  return worst;
}

/**
 * Copies the primitives named `names` (by material name) from `rebuilt` (an uncompressed model with them appended) into
 * `compressed` (the same unit's compressed model) and compresses the result again. Both must carry the same skeleton by
 * joint name; the rebuild's mesh space is mapped into the compressed model's (quantised) mesh space through the inverse
 * bind matrices, which must agree on one transform for every joint. `tolerance` bounds how far an original triangle may
 * move, as a fraction of the model's height.
 */
export async function graftSubmeshes({ compressed, rebuilt, names, io, tolerance = 0.001 }) {
  const { dequantize } = await import('@gltf-transform/functions');
  const { compressionIO, compressModelGlb } = await import('./compress.mjs');
  io ??= await compressionIO();
  const read = async bytes => { const doc = await io.readBinary(new Uint8Array(bytes)); await doc.transform(dequantize()); return doc; };
  const live = await read(compressed), reb = await read(rebuilt), L = live.getRoot(), R = reb.getRoot();
  if (L.listMeshes().length !== 1 || R.listMeshes().length !== 1 || L.listSkins().length !== 1 || R.listSkins().length !== 1) throw new Error('submesh-graft-unsupported-model');
  const clipsBefore = JSON.stringify(clipKeys(L));
  const lskin = L.listSkins()[0], rskin = R.listSkins()[0];
  const lj = lskin.listJoints().map(j => j.getName()), rj = rskin.listJoints().map(j => j.getName());
  if (new Set(lj).size !== lj.length) throw new Error('submesh-graft-duplicate-joint');
  const joints = rj.map(name => { const i = lj.indexOf(name); if (i < 0) throw new Error(`submesh-graft-missing-joint:${name}`); return i; });
  // toRebuilt = inverse(IBM_rebuilt) * IBM_compressed, one transform for every joint (the compressed model's quantisation).
  const m = a => new Matrix4().fromArray(a);
  const perJoint = rj.map((_, i) => m(rskin.getInverseBindMatrices().getElement(i, [])).invert()
    .multiply(m(lskin.getInverseBindMatrices().getElement(joints[i], []))).toArray());
  const toRebuilt = perJoint[0], toCompressed = m(toRebuilt).invert().toArray();
  for (const q of perJoint) for (let k = 0; k < 16; k++) if (Math.abs(q[k] - toRebuilt[k]) > 1e-4 * (Math.abs(toRebuilt[k]) + 1)) throw new Error('submesh-graft-skeleton-mismatch');
  const mesh = L.listMeshes()[0], body = mesh.listPrimitives(), sources = R.listMeshes()[0].listPrimitives();
  const buffer = L.listBuffers()[0], template = body[0], grafted = [];
  for (const name of names) {
    const src = sources.find(p => p.getMaterial()?.getName() === name);
    if (!src) throw new Error(`submesh-graft-missing-primitive:${name}`);
    if (body.some(p => p.getMaterial()?.getName() === name)) throw new Error(`submesh-graft-already-present:${name}`);
    const indices = src.getIndices().getArray(), used = [...new Set(indices)].sort((a, b) => a - b), remap = new Map(used.map((v, i) => [v, i]));
    const prim = live.createPrimitive();
    for (const semantic of template.listSemantics()) {
      const from = src.getAttribute(semantic);
      if (!from) throw new Error(`submesh-graft-missing-attribute:${name}:${semantic}`);
      const size = from.getElementSize(), array = new (semantic.startsWith('JOINTS_') ? Uint16Array : Float32Array)(used.length * size);
      used.forEach((v, i) => {
        let element = from.getElement(v, []);
        if (semantic === 'POSITION') element = transform(toCompressed, element);
        else if (semantic.startsWith('JOINTS_')) element = element.map(j => joints[j]);
        array.set(element, i * size);
      });
      prim.setAttribute(semantic, live.createAccessor().setType(from.getType()).setArray(array).setBuffer(buffer));
    }
    prim.setIndices(live.createAccessor().setType('SCALAR').setArray(Uint16Array.from(indices, v => remap.get(v))).setBuffer(buffer));
    const material = src.getMaterial(), texture = material.getBaseColorTexture();
    const copy = live.createMaterial(name).setMetallicFactor(material.getMetallicFactor()).setRoughnessFactor(material.getRoughnessFactor())
      .setBaseColorFactor(material.getBaseColorFactor()).setAlphaMode(material.getAlphaMode()).setDoubleSided(material.getDoubleSided());
    if (texture) {
      copy.setBaseColorTexture(live.createTexture(name).setImage(texture.getImage()).setMimeType(texture.getMimeType()));
      const sampler = template.getMaterial()?.getBaseColorTextureInfo();
      if (sampler) copy.getBaseColorTextureInfo().setWrapS(sampler.getWrapS()).setWrapT(sampler.getWrapT()).setMagFilter(sampler.getMagFilter()).setMinFilter(sampler.getMinFilter());
    }
    prim.setMaterial(copy); mesh.addPrimitive(prim);
    grafted.push({ name, vertices: used.length, triangles: indices.length / 3 });
  }
  const data = await compressModelGlb(Buffer.from(await io.writeBinary(live)), io);
  // Checks on the result: clips as they were, every triangle (original and grafted) on the rebuild's surface.
  const out = await read(data), O = out.getRoot();
  if (JSON.stringify(clipKeys(O)) !== clipsBefore) throw new Error('submesh-graft-clips-changed');
  const oskin = O.listSkins()[0], outToRebuilt = m(rskin.getInverseBindMatrices().getElement(0, [])).invert()
    .multiply(m(oskin.getInverseBindMatrices().getElement(lj.indexOf(rj[0]), []))).toArray();
  const height = (() => { const p = sources[0].getAttribute('POSITION'); return Math.max(1e-6, ...[0, 1, 2].map(a => p.getMax([])[a] - p.getMin([])[a])); })();
  const distances = {};
  for (const prim of O.listMeshes()[0].listPrimitives()) {
    const name = prim.getMaterial()?.getName(), ref = sources.find(p => p.getMaterial()?.getName() === name);
    if (!ref) throw new Error(`submesh-graft-unmatched-primitive:${name}`);
    const distance = surfaceDistance(prim, ref, p => transform(outToRebuilt, p), height / 50);
    if (distance > tolerance * height) throw new Error(`submesh-graft-moved:${name}:${distance}`);
    distances[name] = +distance.toFixed(4);
  }
  return { data, report: { grafted, maxDistance: distances, extent: +height.toFixed(3), clips: O.listAnimations().length } };
}

/**
 * The step over a compressed root: per unit, rebuild from `source` into `<out>/rebuild`, patch the rebuild with the
 * geometry switch on, graft what the patch appended into the root's model, and write the changed files to
 * `<out>/overlay` with a report. A unit the patch appends nothing to is reported and left alone.
 */
export async function buildSubmeshGraft({ from, source = 'assets3d-local/trial/local', units, out = 'assets3d-local/submesh-graft' } = {}) {
  const { readFile } = await import('node:fs/promises');
  const { join, resolve } = await import('node:path');
  const { createHash } = await import('node:crypto');
  const { buildAll } = await import('./build-all.mjs');
  const { patchModels } = await import('./submesh-patch.mjs');
  const { loadUnitMap } = await import('./local-config.mjs');
  const { safeInputPath, writeOutputFileAtomic } = await import('./safe-path.mjs');
  const { contracts } = await import('./runtime.mjs');
  if (!from || !units?.length) throw new Error('usage: --from <compressed-root> --units <id,...> [--source <cache>] [--out <dir>]');
  const hash = b => createHash('sha256').update(b).digest('hex'), json = v => `${JSON.stringify(v, null, 2)}\n`;
  const root = resolve(from), read = async (r, p) => readFile(await safeInputPath(r, resolve(r, p)));
  const manifest = JSON.parse(await read(root, 'manifest.json')), precache = JSON.parse(await read(root, 'precache.json'));
  const packs = await read(root, 'packs.json').then(b => JSON.parse(b), e => { if (e.code === 'ENOENT') return null; throw e; });
  const map = await loadUnitMap(), rebuildOut = join(out, 'rebuild'), report = { schemaVersion: 1, from: root, units: {} }, changed = new Map();
  const built = await buildAll({ units: units.join(','), source, out: rebuildOut, force: true });
  if (!built.ready) throw new Error('submesh-graft-rebuild-failed');
  for (const id of units) {
    const entry = manifest.models[id];
    if (!entry) throw new Error(`submesh-graft-unknown-model:${id}`);
    const rebuiltManifest = JSON.parse(await read(resolve(rebuildOut, 'units', id), 'manifest.json'));
    const rebuiltBytes = await read(resolve(rebuildOut, 'units', id), rebuiltManifest.models[id].path);
    const patched = (await patchModels({ models: new Map([[id, { entry: rebuiltManifest.models[id], data: rebuiltBytes }]]), source, map, appendGeometry: true }))[id];
    const names = (patched?.report.appended ?? []).map(a => a.name);
    if (!names.length) { report.units[id] = { grafted: [], skipped: patched?.report.skipped ?? 'no-source' }; continue; }
    const before = await read(root, entry.path);
    const { data, report: row } = await graftSubmeshes({ compressed: before, rebuilt: patched.data, names });
    changed.set(entry.path, data);
    manifest.models[id] = { ...entry, submeshVisibility: { ...entry.submeshVisibility, initiallyHidden: sortedNames([...(entry.submeshVisibility?.initiallyHidden ?? []), ...names]) } };
    report.units[id] = { ...row, before: hash(before), after: hash(data), path: entry.path };
  }
  const { assertManifest } = await contracts(); assertManifest(manifest);
  const overlay = join(out, 'overlay');
  for (const [path, data] of changed) await writeOutputFileAtomic(join(overlay, path), data, { force: true });
  if (changed.size) {
    for (const file of precache.files) if (changed.has(file.path)) { const data = changed.get(file.path); file.bytes = data.length; file.sha256 = hash(data); }
    await writeOutputFileAtomic(join(overlay, 'manifest.json'), json(manifest), { force: true });
    await writeOutputFileAtomic(join(overlay, 'precache.json'), json(precache), { force: true });
    if (packs) {
      for (const pack of packs.packs) pack.files = pack.files.filter(f => !changed.has(f.path));
      await writeOutputFileAtomic(join(overlay, 'packs.json'), JSON.stringify(packs), { force: true });
    }
  }
  await writeOutputFileAtomic(join(out, 'submesh-graft-report.json'), json(report), { force: true });
  return report;
}

if (process.argv[1] && (await import('node:path')).resolve(process.argv[1]) === (await import('node:url')).fileURLToPath(import.meta.url)) {
  const { argumentsFor } = await import('./plan-fetch.mjs');
  const args = argumentsFor(process.argv.slice(2), ['--from', '--source', '--out', '--units']);
  const report = await buildSubmeshGraft({ ...args, units: args.units?.split(',') });
  console.log(JSON.stringify(Object.fromEntries(Object.entries(report.units).map(([id, u]) => [id, u.grafted.length ? { after: u.after.slice(0, 12), maxDistance: u.maxDistance } : u]))));
}
