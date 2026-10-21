import { loadUnitMap } from './local-config.mjs';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { inspectSkn, inspectSkl, inspectAnm } from './inspect-source.mjs';
import { safeInputPath, withinRoot } from './safe-path.mjs';

export async function verifySource(root, heroes = ['jinx', 'vi'], map) {
  const input = await realpath(root), raw = await safeInputPath(input, join(input, '.local/extracted'));
  const report = JSON.parse(await readFile(await safeInputPath(input, join(input, '.local/extraction.json')), 'utf8'));
  if (report.version !== '14.24.6442327' || !Array.isArray(report.files)) throw new Error('source-version-mismatch');
  if (heroes.some(id => !/^[a-z0-9_]+$/.test(id))) throw new Error('invalid-hero-id');
  // Validate every listed path, including records outside the requested hero selection.
  const paths = new Map();
  for (const entry of report.files) {
    if (!entry || typeof entry.path !== 'string') throw new Error('invalid-source-record');
    const candidate = withinRoot(raw, resolve(raw, entry.path), 'unsafe-source-path');
    const path = await safeInputPath(input, candidate);
    withinRoot(raw, path, 'unsafe-source-path');
    paths.set(entry.path, path);
  }
  map ??= await loadUnitMap();
  const verified = {}, seen = new Set();
  for (const id of heroes) {
    const base = map[id]?.base;
    if (typeof base !== 'string' || !base.includes('/skins/')) throw new Error(`missing-local-source-base:${id}`);
    const prefix = base.slice(0, base.indexOf('/skins/') + 1);
    const entries = report.files.filter(e => typeof e.path === 'string' && e.path.startsWith(prefix));
    if (!entries.length) throw new Error(`missing-source-records:${id}`);
    const unit = { files: 0, bytes: 0, meshes: [], skeletons: [], animations: [], textures: 0 };
    for (const entry of entries) {
      if (seen.has(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0) throw new Error('invalid-source-record');
      seen.add(entry.path);
      const path = paths.get(entry.path);
      const bytes = await readFile(path);
      if (bytes.length !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`source-hash-mismatch:${entry.path}`);
      unit.files++; unit.bytes += bytes.length;
      if (entry.path.endsWith('.skn')) unit.meshes.push({ path: entry.path, ...inspectSkn(bytes) });
      if (entry.path.endsWith('.skl')) { const skeleton = inspectSkl(bytes); unit.skeletons.push({ path: entry.path, bones: skeleton.bones, influences: skeleton.influences.length }); }
      if (entry.path.endsWith('.anm')) unit.animations.push({ path: entry.path, ...inspectAnm(bytes) });
      if (/\.(tex|dds|png)$/.test(entry.path)) unit.textures++;
    }
    verified[id] = unit;
  }
  return { version: report.version, authority: 'local extraction record plus byte hashes; provenance record is not a Riot signature', units: verified };
}
