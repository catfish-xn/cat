import { createHash } from 'node:crypto';
import { readFile, readdir, lstat, mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import { resolve, join, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureBasisu } from '@gltf-transform/extensions';
import { resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { encodeToKTX2 } from 'ktx2-encoder';
import sharp from 'sharp';
import { withinRoot } from './safe-path.mjs';
import { createPrecache } from './merge-manifests.mjs';
import { realOutput } from './merge-root-output.mjs';

const json = v => Buffer.from(`${JSON.stringify(v, null, 2)}\n`);
const hash = v => createHash('sha256').update(v).digest('hex');
const slash = p => p.replaceAll('\\', '/');
const imageDecoder = async bytes => {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};
export async function compressionIO() {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
  }).setLogger(new Logger(Logger.Verbosity.WARN));
}
/** Reuse the asset-root output policy: real paths anywhere, exclusive file creation. */
async function writeCompressionFile(path, bytes) {
  const target = await realOutput(path, false);
  await mkdir(dirname(target), { recursive: true });
  await realOutput(target, false);
  await writeFile(target, bytes, { flag: 'wx' });
}
/** Offline only. All writes go to an exclusively created, real output directory. */
export async function compressAssets({ from, out, onProgress = () => {} } = {}) {
  if (!from || !out) throw new Error('usage: --from <asset-root> --out <new-root>');
  const source = resolve(from), target = await realOutput(resolve(out));
  // Reject even an empty existing directory, junction, or source descendant.
  try { await lstat(resolve(out)); throw new Error('compression-output-exists'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  // Selected inputs intentionally contain read-only directory junctions.
  // Bound lexical references to the input tree; never write through an input path.
  const inputPath = async p => realpath(withinRoot(source, resolve(source, p), 'unsafe-source-path'));
  const realSource = await inputPath('.');
  for (const root of [source, realSource]) {
    const rel = relative(root, target);
    if (!rel || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\')))
      throw new Error('compression-output-overlaps-source');
  }
  const files = [], documents = new Map(), mapping = new Map(), effectImages = new Set();
  const active = new Set();
  async function walk(dir = '') {
    const realDir = await inputPath(dir || '.');
    if (active.has(realDir)) throw new Error('input-link-cycle');
    const rel = relative(realDir, target);
    if (!rel || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\')))
      throw new Error('compression-output-overlaps-source');
    active.add(realDir);
    for (const entry of await readdir(join(source, dir), { withFileTypes: true })) {
      const path = slash(join(dir, entry.name));
      const actual = await inputPath(path);
      if ((await stat(actual)).isDirectory()) await walk(path); else files.push(path);
    }
    active.delete(realDir);
  }
  await walk(); files.sort();
  const read = async p => readFile(await inputPath(p));
  if (!files.includes('manifest.json')) throw new Error('missing-manifest');
  const manifests = files.filter(p => p === 'manifest.json' || p.endsWith('/manifest.json'));
  function ref(base, p) {
    if (typeof p !== 'string' || !p || /[\\:%?#\x00-\x1f]/.test(p) || p.split('/').some(x => !x || x === '..' || x === '.'))
      throw new Error(`unsafe-compression-reference:${p}`);
    return slash(join(base, p));
  }
  for (const p of manifests) {
    const doc = JSON.parse((await read(p)).toString()); documents.set(p, doc);
    const base = dirname(p) === '.' ? '' : dirname(p);
    for (const model of Object.values(doc.models ?? {})) ref(base, model.path);
    for (const effect of Object.values(doc.effects ?? {})) {
      const ep = ref(base, effect.path), ed = JSON.parse((await read(ep)).toString());
      documents.set(ep, ed);
      for (const e of ed.emitters ?? []) for (const texture of [e.texture, e.distortion?.normalMap].filter(Boolean))
        effectImages.add(ref(base, texture));
    }
  }
  for (const path of effectImages) {
    await read(path);
    if (/\.(png|jpe?g)$/i.test(path)) mapping.set(path, path.replace(/\.[^.]+$/, '.webp'));
  }
  for (const p of files) if (/\.gltf$/i.test(p)) mapping.set(p, p.replace(/\.gltf$/i, '.glb'));
  const dests = new Set();
  for (const p of files.filter(p => !p.endsWith('precache.json'))) {
    const dest = (mapping.get(p) ?? p).toLowerCase();
    if (dests.has(dest)) throw new Error(`compression-path-collision:${dest}`);
    dests.add(dest);
  }
  await mkdir(dirname(target), { recursive: true });
  await mkdir(target); // no recursive: fail closed if another writer created it
  const io = await compressionIO();
  const report = { schemaVersion: 1, ready: false, from, out, beforeBytes: 0, afterBytes: 0,
    modelBytes: { before: 0, after: 0 }, modelTextureBytes: { before: 0, after: 0 },
    effectTextureBytes: { before: 0, after: 0 }, models: [], converted: { etc1s: 0, uastc: 0, webp: 0 }, fallbacks: [] };
  const outputFiles = new Map();
  async function put(p, bytes) {
    await writeCompressionFile(join(target, p), bytes);
    outputFiles.set(p, { bytes: bytes.length, sha256: hash(bytes) });
  }
  function rewrite(value, base) {
    if (typeof value === 'string') {
      const mapped = mapping.get(slash(join(base, value)));
      return mapped ? slash(relative(base || '.', mapped)) : value;
    }
    if (Array.isArray(value)) return value.map(v => rewrite(v, base));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v, base)]));
    return value;
  }
  // Effect reference bases are the containing manifest's directory, not the JSON directory.
  const bases = new Map();
  for (const p of manifests) {
    const base = dirname(p) === '.' ? '' : dirname(p);
    bases.set(p, base);
    for (const e of Object.values(documents.get(p).effects ?? {})) bases.set(ref(base, e.path), base);
  }
  for (const path of files) {
    const bytes = await read(path); report.beforeBytes += bytes.length;
    if (path === 'precache.json' || path.endsWith('/precache.json')) continue;
    let result = bytes;
    if (/\.(glb|gltf)$/i.test(path)) {
      const doc = await io.read(await inputPath(path));
      for (const texture of doc.getRoot().listTextures()) {
        const image = texture.getImage(); if (!image) continue;
        report.modelTextureBytes.before += image.length;
        const edges = texture.getGraph().listParentEdges(texture);
        const normal = edges.some(e => /normalTexture/i.test(e.getName()));
        const color = edges.some(e => /baseColorTexture|emissiveTexture|diffuseTexture|specularColorTexture/i.test(e.getName()));
        if (texture.getMimeType() !== 'image/ktx2') {
          try {
            const encoded = await encodeToKTX2(image, { imageDecoder, isUASTC: normal, isNormalMap: normal,
              generateMipmap: true, qualityLevel: 128, compressionLevel: 2,
              isPerceptual: color && !normal, isSetKTX2SRGBTransferFunc: color && !normal });
            texture.setImage(encoded).setMimeType('image/ktx2').setURI('');
            doc.createExtension(KHRTextureBasisu).setRequired(true);
            report.converted[normal ? 'uastc' : 'etc1s']++;
          } catch (e) { report.fallbacks.push({ path, texture: texture.getName(), reason: e.message }); }
        }
        report.modelTextureBytes.after += texture.getImage().length;
      }
      await doc.transform(resample(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
      result = Buffer.from(await io.writeBinary(doc));
      // Decoding validates meshopt output and glTF references before it is published.
      await io.readBinary(result);
      report.modelBytes.before += bytes.length; report.modelBytes.after += result.length;
      report.models.push({ path, before: bytes.length, after: result.length });
      onProgress({ path, before: bytes.length, after: result.length });
    } else if (effectImages.has(path)) {
      if (mapping.has(path)) {
        try { result = await sharp(bytes).webp({ quality: 90, alphaQuality: 100 }).toBuffer(); report.converted.webp++; }
        catch (e) { mapping.delete(path); report.fallbacks.push({ path, reason: e.message }); }
      }
      report.effectTextureBytes.before += bytes.length; report.effectTextureBytes.after += result.length;
    }
    // JSON rewriting is deferred until all image fallbacks are known.
    if (!documents.has(path)) await put(mapping.get(path) ?? path, result);
  }
  for (const [path, doc] of documents) await put(path, json(rewrite(doc, bases.get(path))));
  // Same payload selection and hashing function as merge-manifests; also handles nested manifests.
  for (const p of manifests) {
    const base = bases.get(p), doc = rewrite(documents.get(p), base), plans = new Map();
    const add = r => {
      const full = ref(base, r), info = outputFiles.get(full);
      if (!info) throw new Error(`missing-output-reference:${full}`);
      plans.set(r, info);
    };
    for (const m of Object.values(doc.models ?? {})) add(m.path);
    for (const e of Object.values(doc.effects ?? {})) {
      add(e.path);
      const ed = JSON.parse(await readFile(join(target, ref(base, e.path)), 'utf8'));
      for (const emitter of ed.emitters ?? []) for (const r of [emitter.texture, emitter.mesh, emitter.distortion?.normalMap].filter(Boolean)) add(r);
    }
    await put(slash(join(base, 'precache.json')), json(createPrecache(plans)));
    if (!base) report.runtimeBytes = [...plans.values()].reduce((s, f) => s + f.bytes, 0);
  }
  report.afterBytes = [...outputFiles.values()].reduce((s, f) => s + f.bytes, 0);
  report.ratio = report.afterBytes / report.beforeBytes;
  report.ready = true;
  // This diagnostic is metadata, excluded from the payload index; total includes its own size.
  for (let i = 0; i < 5; i++) report.afterBytes = [...outputFiles.values()].reduce((s, f) => s + f.bytes, 0) + json(report).length;
  report.ratio = report.afterBytes / report.beforeBytes;
  for (let i = 0; i < 5; i++) report.afterBytes = [...outputFiles.values()].reduce((s, f) => s + f.bytes, 0) + json(report).length;
  await writeCompressionFile(join(target, 'compression-report.json'), json(report));
  return report;
}
export function compressionArguments(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--from', '--out'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || options[args[i].slice(2)]) throw new Error('invalid-compression-arguments');
    options[args[i].slice(2)] = args[i + 1];
  }
  return options;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await compressAssets({ ...compressionArguments(process.argv.slice(2)), onProgress: p => console.error(JSON.stringify(p)) });
    console.log(JSON.stringify(report));
  } catch (e) { console.error(e.stack); process.exitCode = 1; }
}
