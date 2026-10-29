// Offline S13 icon staging. Source images and generated manifests never enter Git.
import { readFile, readdir, realpath, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { safeInputPath } from './safe-path.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const hash = b => createHash('sha256').update(b).digest('hex');
const json = x => JSON.stringify(x, null, 2) + '\n';
const quote = s => `'${s.replaceAll("'", "'\\''")}'`;
export const iconName = source => basename(source).toLowerCase().replace(/\.(tex|dds)$/, '.png');
export const mirrorUrl = source => `https://raw.communitydragon.org/14.24/game/${source.toLowerCase().replace(/\.(tex|dds)$/, '.png')}`;

/** Read exported API-name contracts, never infer the icon from an English name or slug. */
export function collectApiNames(definitions, modules) {
  const names = new Map();
  const add = (id, apiName) => {
    if (!Object.hasOwn(definitions, id)) return;
    if (names.has(id) && names.get(id) !== apiName) throw new Error(`conflicting-augment-api:${id}`);
    names.set(id, apiName);
  };
  for (const module of modules) for (const value of Object.values(module)) {
    if (!value || typeof value !== 'object') continue;
    for (const [id, row] of Object.entries(value)) {
      if (typeof row?.apiName === 'string') add(id, row.apiName);
      if (typeof row === 'string' && row.startsWith('TFT')) add(id, row);
    }
  }
  return names;
}

export async function augmentSpecs() {
  await import('./runtime.mjs');
  const { AUGMENT_DEFINITIONS } = await import('../../src/simulation/content/augments.ts');
  const { S13_AUGMENT_ASSETS } = await import('../../src/presentation/s13-augment-asset-manifest.ts');
  const content = join(repository, 'src/simulation/content');
  const modules = [];
  for (const file of (await readdir(content)).filter(f => /augment|source|v20-traits|d11-fill|s13-p3/.test(f) && f.endsWith('.ts')).sort())
    modules.push(await import(new URL(`../../src/simulation/content/${file}`, import.meta.url)));
  modules.push({ bundled: Object.fromEntries(S13_AUGMENT_ASSETS.map(a => [a.id, a])) });
  const apis = collectApiNames(AUGMENT_DEFINITIONS, modules);
  const raw = JSON.parse(gunzipSync(await readFile(join(content, 'source/s13-14.24b/raw/en_us.json.gz'))));
  return Object.keys(AUGMENT_DEFINITIONS).sort().map(id => {
    const apiName = apis.get(id), item = raw.items.find(i => i.apiName === apiName);
    if (!apiName || !item?.icon || !/^ASSETS\/Maps\/TFT\/Icons\/Augments\/Hexcore\/[\w.-]+\.(tex|dds)$/i.test(item.icon))
      throw new Error(`unresolved-augment-source:${id}`);
    return { id, apiName, source: item.icon, path: `assets/s13/augments/${id}.png`,
      bundled: S13_AUGMENT_ASSETS.some(a => a.id === id) };
  });
}

/** Preserve other batches and all unknown manifest fields; account for every requested ID. */
export function mergeAugmentManifest(base, specs, found, unavailable) {
  if (base?.patch !== '14.24' || !Array.isArray(base.assets)) throw new Error('invalid-base-ui-manifest');
  const ids = new Set(specs.map(s => s.id)), seen = new Set();
  if (ids.size !== specs.length) throw new Error('duplicate-augment-spec');
  for (const a of [...found, ...unavailable]) {
    if (a.kind !== 'augment' || !ids.has(a.id) || seen.has(a.id)) throw new Error('invalid-augment-result');
    seen.add(a.id);
  }
  if (seen.size !== ids.size) throw new Error('incomplete-augment-results');
  for (const a of found) if (a.path !== `assets/s13/augments/${a.id}.png` || !/^[\w-]+$/.test(a.id)) throw new Error('unsafe-augment-path');
  const replaced = new Set(found.map(a => a.id));
  return { ...structuredClone(base), assets: [...base.assets.filter(a => a.kind !== 'augment' || !replaced.has(a.id)), ...found],
    unavailable: [...(base.unavailable ?? []).filter(a => a.kind !== 'augment' || !ids.has(a.id)), ...unavailable] };
}

export function downloadCommands(missing, directory) {
  return ['#!/usr/bin/env bash', 'set -euo pipefail', `mkdir -p ${quote(directory)}`,
    ...missing.flatMap(s => [
      `curl --fail --location --retry 2 --max-time 30 ${quote(mirrorUrl(s.source))} -o ${quote(join(directory, s.id + '.png.part'))}`,
      `mv ${quote(join(directory, s.id + '.png.part'))} ${quote(join(directory, s.id + '.png'))}`,
    ]), ''].join('\n');
}

export async function stageAugmentIcons({ archive, downloads, baseManifest, out }) {
  // assets3d-local is an explicitly supplied local asset mount (a symlink in this worktree).
  // Only one NEW child is writable. No overrides of the shared safe-path boundary.
  if (!/^[\w-]+$/.test(out ?? '')) throw new Error('out-must-be-new-local-directory-name');
  const local = await realpath(join(repository, 'assets3d-local')), output = join(local, out);
  const specs = await augmentSpecs(), archiveRoot = await realpath(archive);
  const { S13_AUGMENT_ASSETS } = await import('../../src/presentation/s13-augment-asset-manifest.ts');
  const bundled = new Map(S13_AUGMENT_ASSETS.map(a => [a.id, a]));
  const receipts = JSON.parse(await readFile(join(archiveRoot, 'icon-results.json')));
  const available = new Map();
  for (const r of receipts) {
    if (r.status !== 'downloaded' || !r.url.startsWith('https://game.gtimg.cn/images/lol/act/img/tft/hex/')) continue;
    const name = basename(r.url).toLowerCase();
    if (available.has(name) && available.get(name).sha256 !== r.sha256) throw new Error(`ambiguous-icon:${name}`);
    available.set(name, r);
  }
  const baseBytes = await readFile(baseManifest), base = JSON.parse(baseBytes);
  if (base.patch !== '14.24' || !Array.isArray(base.assets)) throw new Error('invalid-base-ui-manifest');
  const sharp = (await import('sharp')).default;
  sharp.concurrency(1);
  const found = [], unavailable = [], payloads = [], sources = [];
  for (const spec of specs) {
    let bytes, provenance;
    const original = bundled.get(spec.id);
    if (original) {
      bytes = await readFile(join(repository, 'public', original.path));
      if (bytes.length !== original.bytes || hash(bytes) !== original.sha256) throw new Error(`bundled-icon-hash-mismatch:${spec.id}`);
      provenance = { source: original.source, method: 'verified-bundled-png', sourceSha256: original.sha256 };
    }
    // Download cache is optional, opt-in, and keyed by the exact canonical definition ID.
    if (!bytes && downloads) {
      try {
        bytes = await readFile(await safeInputPath(resolve(downloads), resolve(downloads, spec.id + '.png')));
        provenance = { source: mirrorUrl(spec.source), method: '14.24-mirror' };
      } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    const receipt = available.get(iconName(spec.source));
    if (!bytes && receipt) {
      bytes = await readFile(await safeInputPath(archiveRoot, resolve(archiveRoot, receipt.path)));
      if (bytes.length !== receipt.bytes || hash(bytes) !== receipt.sha256) throw new Error(`archive-icon-hash-mismatch:${spec.id}`);
      provenance = { source: receipt.url, method: 'verified-local-archive', sourceSha256: receipt.sha256 };
    }
    if (!bytes) { unavailable.push({ kind: 'augment', ...spec, reason: 'missing-local-source' }); continue; }
    const png = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
    // The research archive's receipts call some JPEG derivatives image/png.
    // Inspect magic bytes, retain native PNGs, and explicitly record re-encoding.
    if (!png && (provenance.method !== 'verified-local-archive' || bytes.readUInt16BE(0) !== 0xffd8)) throw new Error(`invalid-icon-png:${spec.id}`);
    const decoded = await sharp(bytes, { limitInputPixels: 1048576 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (decoded.info.width !== decoded.info.height || decoded.info.width < 16) throw new Error(`invalid-icon-dimensions:${spec.id}`);
    if (!png) {
      bytes = await sharp(decoded.data, { raw: decoded.info }).png().toBuffer();
      provenance.method = 'verified-local-archive-jpeg-to-png';
    }
    const entry = { kind: 'augment', id: spec.id, apiName: spec.apiName, path: spec.path,
      source: spec.source, bytes: bytes.length, sha256: hash(bytes) };
    found.push(entry); payloads.push([spec.path, bytes]);
    sources.push({ ...spec, ...provenance, width: decoded.info.width, height: decoded.info.height, sha256: entry.sha256 });
  }
  const manifest = mergeAugmentManifest(base, specs, found, unavailable);
  // Validate the entire batch before creating a fresh staging directory.
  await mkdir(output); // exclusive: never mix this run with an earlier partial build
  for (const [path, bytes] of payloads) {
    await mkdir(join(output, 'root', 'assets/s13/augments'), { recursive: true });
    await writeFile(join(output, 'root', path), bytes, { flag: 'wx' });
  }
  const report = { patch: '14.24', total: specs.length, bundled: specs.filter(s => s.bundled).length,
    absentFromBundle: specs.filter(s => !s.bundled).map(s => s.id), ready: found.length, unavailable,
    baseManifestSha256: hash(baseBytes), payloadBytes: found.reduce((n, a) => n + a.bytes, 0), sources };
  await writeFile(join(output, 'root/ui-assets.json'), json(manifest), { flag: 'wx' });
  await writeFile(join(output, 'report.json'), json(report), { flag: 'wx' });
  await writeFile(join(output, 'download-missing.sh'), downloadCommands(unavailable, join(local, 'augment-icon-downloads')), { flag: 'wx' });
  // Optional replacements for the archive's JPEG derivatives use the same exact client paths.
  await writeFile(join(output, 'download-original-pngs.sh'), downloadCommands([
    ...sources.filter(s => s.method === 'verified-local-archive-jpeg-to-png').map(s => specs.find(a => a.id === s.id)), ...unavailable,
  ], join(local, 'augment-icon-downloads')), { flag: 'wx' });
  await writeFile(join(output, 'missing-local.tsv'), ['id\tapiName\tsource\tdownload',
    ...unavailable.map(s => [s.id, s.apiName, s.source, mirrorUrl(s.source)].join('\t')), ''].join('\n'), { flag: 'wx' });
  return { output, total: report.total, ready: report.ready, payloadBytes: report.payloadBytes, unavailable: unavailable.map(s => s.id) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {}, args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, '');
    if (!['archive', 'downloads', 'baseManifest', 'out'].includes(key) || options[key] || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('invalid-argument');
    options[key] = args[++i];
  }
  const report = await stageAugmentIcons(options);
  console.log(json(report));
  if (report.unavailable.length) process.exitCode = 2;
}
