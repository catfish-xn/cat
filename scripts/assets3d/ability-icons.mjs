// Offline 14.24 UI delta builder. All source data, art and receipts stay git-ignored.
import { readFile, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readRman, readCachedRange, chunksForRange } from './rman.mjs';
import { readWadIndex, extractWadEntry } from './wad.mjs';
import { verifyChunk } from './chunk-hash.mjs';
import { fetchChunks } from './fetch-chunks.mjs';
import { parseBin, binField, binIs } from './bin.mjs';
import { decodeTexture, encodePng } from './texture.mjs';
import { safeInputPath, safeOutputPath, writeOutputFile } from './safe-path.mjs';

const PATCH_MANIFEST_SHA256 = 'c080631bd377f60730d979b48807a49f86070517e85b7bafdc32c8666fee7a14';
const hash = b => createHash('sha256').update(b).digest('hex');
const json = v => JSON.stringify(v, null, 2) + '\n';
// Raw property hashes from the pinned 14.24 TFTCharacterRecord → TFT client data.
// The client data's ability icon is distinct from its square, splash and mobile portraits.
const CLIENT_DATA = 0xe4e7426c, ABILITY_ICON = 0xdf0ad83b;
const field = (entry, key) => entry?.fields?.find(f => f.hash === key)?.value;

/** Exact character link only. Never match texture names or choose a different spell icon. */
export function mapAbilities(definitions, abilities, heroIds, unitMap, document) {
  const entries = new Map(document.entries.map(e => [e.hash, e]));
  const characters = document.entries.filter(e => binIs(e, 'TFTCharacterRecord'));
  return [...heroIds].sort().filter(id => abilities[definitions[id]?.abilityId]).map(id => {
    const ability = abilities[definitions[id].abilityId], character = unitMap[id]?.sourceName ?? `tft13_${id}`;
    const record = characters.find(e => binField(e, 'mCharacterName')?.toLowerCase() === character.toLowerCase());
    const client = entries.get(field(record, CLIENT_DATA)?.hash);
    const source = ability.icon ?? ability.iconPath ?? field(client, ABILITY_ICON);
    return { id: definitions[id].abilityId, championId: id, character,
      source: typeof source === 'string' && source.length ? source : null,
      ...(source ? {} : { reason: record ? 'character-ability-icon-missing' : 'character-record-missing' }) };
  });
}

/** Replace only this batch's ability keys; keep every other live-root field and entry. */
export function mergeAbilityManifest(base, specs, found, unavailable) {
  if (base?.patch !== '14.24' || !Array.isArray(base.assets)) throw new Error('invalid-base-ui-manifest');
  const ids = new Set(specs.map(s => s.id));
  if (ids.size !== specs.length) throw new Error('duplicate-content-ability');
  const seen = new Set();
  for (const a of found) {
    if (a.kind !== 'ability' || !ids.has(a.id) || seen.has(a.id) || !/^assets\/s13\/abilities\/[\w-]+\.png$/.test(a.path)) throw new Error('invalid-ability-entry');
    seen.add(a.id);
  }
  for (const a of unavailable) {
    if (!ids.has(a.id) || seen.has(a.id)) throw new Error('invalid-unavailable-entry');
    seen.add(a.id);
  }
  if (seen.size !== ids.size) throw new Error('incomplete-ability-results');
  const keep = a => a.kind !== 'ability' || !ids.has(a.id);
  return { ...structuredClone(base), assets: [...base.assets.filter(keep), ...found],
    unavailable: [...(base.unavailable ?? []).filter(keep), ...unavailable] };
}

export function abilityEntry(id, source, png) {
  if (!/^[\w-]+$/.test(id)) throw new Error('unsafe-ability-id');
  return { kind: 'ability', id, path: `assets/s13/abilities/${id}.png`, source, bytes: png.length, sha256: hash(png) };
}

export async function buildAbilityIcons({ cache = 'assets3d-local/trial/local', cacheFrom,
  unitMap = 'assets3d-local/unit-map.local.json', baseManifest = 'assets3d-local/base-ui-assets.json',
  out = 'assets3d-local/ability-icons-delta', download = false } = {}) {
  const output = await safeOutputPath(out, { directory: true });
  const local = await safeOutputPath(cache, { directory: true });
  const read = async (root, path) => readFile(await safeInputPath(resolve(root), resolve(root, path)));
  const write = (p, b) => writeOutputFile(join(output, p), b);
  // Exclusive output; reruns must use a new directory, never merge stale art silently.
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output, { recursive: false });
  await mkdir(join(local, 'chunks'), { recursive: true });
  async function cached(path) {
    let bytes;
    try { bytes = await read(local, path); }
    catch (e) {
      if (e.code !== 'ENOENT' || !cacheFrom) throw e;
      bytes = await read(cacheFrom, path);
      await writeOutputFile(join(local, path), bytes);
    }
    return bytes;
  }
  const raw = await cached('14.24.manifest');
  if (hash(raw) !== PATCH_MANIFEST_SHA256) throw new Error('14.24-manifest-sha256-mismatch');
  const manifest = readRman(raw), file = manifest.files.find(f => f.name === 'DATA/FINAL/UI.wad.client');
  if (!file) throw new Error('14.24-ui-wad-missing');
  const copied = new Set(), downloaded = new Set();
  async function range(start, length) {
    const chunks = chunksForRange(file, start, length);
    return readCachedRange(file, start, length, async id => {
      const c = chunks.find(c => c.id === id), path = `chunks/${id}.zst`;
      let bytes;
      try { bytes = await cached(path); copied.add(id); }
      catch (e) {
        if (e.code !== 'ENOENT' || !download) throw e;
        const report = await fetchChunks({ plan: { chunks: [c] }, manifest, cache: join(local, 'chunks'),
          out: join(local, 'fetch'), concurrency: 1, timeoutMs: 15000 });
        if (report.failed.length) throw new Error(`riot-chunk-download-failed:${id}`);
        downloaded.add(id); bytes = await read(local, path);
      }
      if (bytes.length !== c.size) throw new Error('cached-chunk-size-mismatch');
      verifyChunk(bytes, c); return bytes;
    });
  }
  const head = await range(0, 272), index = readWadIndex(await range(0, 272 + head.readUInt32LE(268) * 32), file.size);
  await cached('hashes/hashes.game.txt');
  const wanted = new Set(index.map(e => e.hash)), paths = new Map();
  for await (const line of createInterface({ input: createReadStream(join(local, 'hashes/hashes.game.txt')), crlfDelay: Infinity })) {
    if (line[16] === ' ' && wanted.has(line.slice(0, 16).toLowerCase())) paths.set(line.slice(0, 16).toLowerCase(), line.slice(17));
  }
  const byPath = new Map(index.filter(e => paths.has(e.hash)).map(e => [paths.get(e.hash).toLowerCase(), e]));
  let toc;
  async function extract(path) {
    const entry = byPath.get(path.toLowerCase());
    if (!entry) throw new Error('icon-path-not-in-14.24-ui-wad');
    if (entry.type === 4 && !toc) {
      const candidates = [...byPath].filter(([p]) => p.endsWith('.subchunktoc'));
      if (candidates.length !== 1 || candidates[0][1].type === 4) throw new Error('invalid-ui-subchunktoc');
      const e = candidates[0][1]; toc = extractWadEntry(await range(e.offset, e.compressedSize), { ...e, offset: 0 });
    }
    return extractWadEntry(await range(entry.offset, entry.compressedSize), { ...entry, offset: 0 }, { subchunkToc: toc });
  }
  // The UI planner carries both the authoritative character link and the referenced client data.
  const planner = await extract('data/tftteamplanner/characters.bin');
  await import('./runtime.mjs');
  const { UNIT_DEFINITIONS, M5_UNIT_IDS } = await import('../../src/simulation/units.ts');
  const { S13_ABILITY_DATA } = await import('../../src/simulation/content/abilities.ts');
  const map = JSON.parse(await readFile(unitMap, 'utf8'));
  const specs = mapAbilities(UNIT_DEFINITIONS, S13_ABILITY_DATA, M5_UNIT_IDS, map, parseBin(planner));
  const found = [], unavailable = [], sources = [];
  const sharp = (await import('sharp')).default;
  sharp.concurrency(1);
  for (const spec of specs) {
    try {
      if (!spec.source) throw new Error(spec.reason);
      const source = await extract(spec.source), decoded = decodeTexture(source);
      let png = encodePng(decoded);
      if (decoded.width > 64 || decoded.height > 64) png = await sharp(png).resize(64, 64, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
      const entry = abilityEntry(spec.id, spec.source, png);
      await write(`ui/${entry.path}`, png); found.push(entry);
      sources.push({ ...spec, sourceBytes: source.length, sourceSha256: hash(source), nativeWidth: decoded.width, nativeHeight: decoded.height });
    } catch (e) {
      // Missing data is explicit; corruption and programming errors fail the build.
      if (!['icon-path-not-in-14.24-ui-wad', 'character-record-missing', 'character-ability-icon-missing', 'ENOENT'].includes(e.code ?? e.message)) throw e;
      unavailable.push({ kind: 'ability', ...spec, reason: e.code === 'ENOENT' ? 'missing-local-chunk' : e.message });
    }
  }
  const baseBytes = await readFile(baseManifest), base = JSON.parse(baseBytes);
  const merged = mergeAbilityManifest(base, specs, found, unavailable), uiBytes = Buffer.from(json(merged));
  await write('ui/ui-assets.json', uiBytes);
  const report = { patch: '14.24', manifestSha256: hash(raw), baseManifestSha256: hash(baseBytes),
    plannerSource: 'data/tftteamplanner/characters.bin', plannerSha256: hash(planner),
    heroes: specs.length, found: found.length, unavailable, pngBytes: found.reduce((n, a) => n + a.bytes, 0),
    deltaBytes: found.reduce((n, a) => n + a.bytes, uiBytes.length), manifestBytes: uiBytes.length,
    cachedChunks: copied.size, downloadedChunks: downloaded.size, sources };
  await write('report.json', json(report));
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, '');
    if (!['cache', 'cacheFrom', 'unitMap', 'baseManifest', 'out', 'download'].includes(key) || Object.hasOwn(options, key)) throw new Error('invalid-argument');
    options[key] = key === 'download' ? true : args[++i];
    if (!options[key]) throw new Error('missing-argument');
  }
  const report = await buildAbilityIcons(options);
  console.log(json({ ...report, sources: undefined }));
}
