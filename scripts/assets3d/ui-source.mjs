// Offline source discovery and bounded, verified RMAN/WAD reads. No networking.
import { readdir, realpath, stat, readFile, open } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { join, basename, resolve } from 'node:path';
import { readRman, chunksForRange, readCachedRange, MAX_CACHED_RANGE_BYTES } from './rman.mjs';
import { readWadIndex, extractWadEntry } from './wad.mjs';
import { verifyChunk, riotChunkId } from './chunk-hash.mjs';

export const PATCH_SHA = 'c080631bd377f60730d979b48807a49f86070517e85b7bafdc32c8666fee7a14';
export const VERSION = '14.24.6442327';
export const sha256 = b => createHash('sha256').update(b).digest('hex');
export const json = v => JSON.stringify(v, null, 2) + '\n';
export const LOCALES = ['zh_CN', 'zh_TW', 'en_US'];
const virtual = ['/proc', '/sys', '/dev', '/run'];
const beneath = (p, root) => p === root || p.startsWith(root + '/');

/** File names only, except the narrowly selected source files read later.
 * Follow directory links once by realpath; record unreadable locations explicitly.
 */
export async function scanLocal(roots = ['/']) {
  const result = { roots: roots.map(p => resolve(p)), exclusions: [...virtual, '.git (Git metadata)'],
    directories: 0, files: 0, errors: [], manifests: [], dictionaries: [], wads: [], loose: [], chunks: {}, bundles: {} };
  const seen = new Set(), stack = [...result.roots];
  while (stack.length) {
    let dir = stack.pop();
    if (virtual.some(p => beneath(dir, p)) || basename(dir) === '.git') continue;
    try { dir = await realpath(dir); } catch (e) { result.errors.push({ path: dir, reason: e.code }); continue; }
    if (virtual.some(p => beneath(dir, p)) || seen.has(dir)) continue;
    seen.add(dir);
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); }
    catch (e) { result.errors.push({ path: dir, reason: e.code }); continue; }
    result.directories++;
    for (const e of entries) {
      const path = join(dir, e.name);
      if (e.isDirectory()) { stack.push(path); continue; }
      let info = e;
      if (e.isSymbolicLink()) {
        try { info = await stat(path); }
        catch (error) { result.errors.push({ path, reason: error.code }); continue; }
        if (info.isDirectory()) { stack.push(path); continue; }
      }
      if (!info.isFile()) continue;
      result.files++;
      const match = /^([a-f\d]{16})\.zst$/i.exec(e.name);
      if (match) (result.chunks[match[1].toUpperCase()] ??= []).push(path);
      else if (/^[a-f\d]{16}\.bundle$/i.test(e.name)) (result.bundles[e.name.slice(0, 16).toUpperCase()] ??= []).push(path);
      else if (e.name === '14.24.manifest') result.manifests.push(path);
      else if (e.name === 'hashes.game.txt') result.dictionaries.push(path);
      else if (/\.wad\.client$/i.test(e.name)) result.wads.push(path);
      else if (/fontconfig|beaufort|spiegel|fzltch|fzxhyszk|notosanscjk|tft.*(?:atlas|shopcard|emptyshop)/i.test(e.name)) result.loose.push(path);
    }
  }
  for (const name of ['manifests', 'dictionaries', 'wads', 'loose']) result[name].sort();
  return result;
}

export async function loadPatch(inventory, manifestPath) {
  for (const path of manifestPath ? [manifestPath] : inventory.manifests) {
    const bytes = await readFile(path);
    if (sha256(bytes) === PATCH_SHA) return { manifest: readRman(bytes), sourceManifest: { path: resolve(path), sha256: PATCH_SHA } };
  }
  throw new Error('pinned-14.24-manifest-not-found');
}

export async function readDictionary(paths, predicate = () => true, wanted) {
  const result = new Map();
  for (const path of paths) {
    for await (const line of createInterface({ input: createReadStream(path), crlfDelay: Infinity })) {
      if (wanted && !wanted.has(line.slice(0, 16).toLowerCase())) continue;
      const m = /^([a-f\d]{16}) (.+)$/i.exec(line);
      if (m && predicate(m[2].toLowerCase())) {
        const hash = m[1].toLowerCase(), name = m[2].toLowerCase();
        if (result.has(hash) && result.get(hash) !== name) throw new Error('dictionary-hash-conflict');
        result.set(hash, name);
      }
    }
  }
  return result;
}

export class UiSource {
  constructor(manifest, inventory) {
    this.manifest = manifest; this.inventory = inventory; this.locations = new Map(); this.invalid = [];
  }
  async locate(c, file) {
    const key = c.id;
    if (this.locations.has(key)) return this.locations.get(key);
    for (const path of this.inventory.chunks[key] ?? []) {
      try {
        if ((await stat(path)).size !== c.size) throw new Error('chunk-compressed-size-mismatch');
        verifyChunk(await readFile(path), c);
        const found = { kind: 'chunk', path }; this.locations.set(key, found); return found;
      } catch (e) { this.invalid.push({ path, id: key, reason: e.code ?? e.message }); }
    }
    for (const path of this.inventory.bundles?.[c.bundleId] ?? []) {
      try {
        const packed = await this.readSlice(path, c.offset, c.size);
        verifyChunk(packed, c);
        const found = { kind: 'bundle', path, offset: c.offset }; this.locations.set(key, found); return found;
      } catch (e) { this.invalid.push({ path, id: key, reason: e.code ?? e.message }); }
    }
    // A complete local WAD is reusable only after each touched RMAN block passes
    // the authoritative ID, never on name/size alone. No multi-GB whole-file reads.
    if (file) for (const path of this.inventory.wads.filter(p => basename(p).toLowerCase() === basename(file.name).toLowerCase())) {
      try {
        if ((await stat(path)).size !== file.size) throw new Error('wad-version-size-mismatch');
        const bytes = await this.readWadBlock(path, c);
        if (!this.validBlock(bytes, c)) throw new Error('wad-rman-chunk-id-mismatch');
        const found = { kind: 'wad', path, fileOffset: c.fileOffset }; this.locations.set(key, found); return found;
      } catch (e) { this.invalid.push({ path, id: key, reason: e.code ?? e.message }); }
    }
    this.locations.set(key, null); return null;
  }
  validBlock(bytes, c) {
    return bytes.length === c.targetSize && (riotChunkId(bytes) === c.id || ['sha256', 'sha512'].some(a =>
      createHash(a).update(bytes).digest().readBigUInt64LE().toString(16).padStart(16, '0').toUpperCase() === c.id));
  }
  async readSlice(path, offset, size) {
    if (!Number.isSafeInteger(size) || size < 1 || size > 16 * 1024 * 1024 || !Number.isSafeInteger(offset) || offset < 0) throw new Error('chunk-output-budget');
    const handle = await open(path, 'r');
    try {
      const bytes = Buffer.alloc(size); let at = 0;
      while (at < bytes.length) {
        const n = (await handle.read(bytes, at, bytes.length - at, offset + at)).bytesRead;
        if (!n) throw new Error('truncated-local-source'); at += n;
      }
      return bytes;
    } finally { await handle.close(); }
  }
  async readWadBlock(path, c) { return this.readSlice(path, c.fileOffset, c.targetSize); }
  async range(file, start, size) {
    const chunks = chunksForRange(file, start, size);
    if (size > MAX_CACHED_RANGE_BYTES || chunks.reduce((n, c) => n + c.targetSize, 0) > MAX_CACHED_RANGE_BYTES) throw new Error('cached-range-output-budget');
    const parts = [];
    for (const c of chunks) {
      const local = await this.locate(c, file);
      if (!local) throw new Error(`missing-local-chunk:${c.id}`);
      let bytes;
      if (local.kind === 'wad') {
        bytes = await this.readWadBlock(local.path, { ...c, fileOffset: local.fileOffset });
        if (!this.validBlock(bytes, c)) throw new Error('wad-rman-chunk-id-mismatch');
      } else {
        bytes = await readCachedRange({ size: c.targetSize, chunks: [{ ...c, fileOffset: 0 }] }, 0, c.targetSize, async () => {
          const packed = local.kind === 'bundle' ? await this.readSlice(local.path, local.offset, c.size) : await readFile(local.path);
          verifyChunk(packed, c); return packed;
        });
      }
      parts.push(bytes.subarray(Math.max(start, c.fileOffset) - c.fileOffset, Math.min(start + size, c.fileOffset + c.targetSize) - c.fileOffset));
    }
    const result = Buffer.concat(parts);
    if (result.length !== size) throw new Error('missing-cached-range');
    return result;
  }
  async index(file) {
    const head = await this.range(file, 0, 272), size = 272 + head.readUInt32LE(268) * 32;
    return { size, entries: readWadIndex(await this.range(file, 0, size), file.size) };
  }
  async extract(file, entry, entries, paths) {
    let subchunkToc;
    if (entry.type === 4) {
      const candidates = entries.filter(e => paths.get(e.hash)?.endsWith('.subchunktoc'));
      if (candidates.length !== 1 || candidates[0].type === 4) throw new Error('wad-subchunk-toc-required');
      const toc = candidates[0];
      subchunkToc = extractWadEntry(await this.range(file, toc.offset, toc.compressedSize), { ...toc, offset: 0 });
    }
    return extractWadEntry(await this.range(file, entry.offset, entry.compressedSize), { ...entry, offset: 0 }, { subchunkToc });
  }
}

export function cliArguments(argv, extra = []) {
  const options = {}, names = { '--plan': 'planPath', '--out': 'out', '--manifest': 'manifestPath', '--dictionary': 'dictionary',
    '--locale': 'locale', '--scan-root': 'scanRoots', '--max-bytes': 'maxBytes', ...Object.fromEntries(extra.map(n => [`--${n}`, n])) };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i], flag = ['--dry-run', '--fetch'].includes(arg), key = flag ? (arg === '--dry-run' ? 'dryRun' : 'fetch') : names[arg];
    if (!key || (key !== 'scanRoots' && Object.hasOwn(options, key))) throw new Error(`invalid-argument:${arg}`);
    if (flag) options[key] = true;
    else {
      const value = argv[++i]; if (!value || value.startsWith('--')) throw new Error(`missing-argument:${arg}`);
      if (key === 'scanRoots') (options.scanRoots ??= []).push(value);
      else options[key] = key === 'maxBytes' ? Number(value) : value;
    }
  }
  if (options.locale && !LOCALES.includes(options.locale)) throw new Error('unsupported-locale');
  return options;
}
