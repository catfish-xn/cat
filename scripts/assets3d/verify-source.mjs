import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { createHash } from 'node:crypto';
import { inspectSkn, inspectSkl, inspectAnm } from './inspect-source.mjs';

export async function verifySource(root, heroes = ['jinx', 'vi']) {
  const input = await realpath(root), raw = await realpath(join(input, '.local/extracted'));
  const report = JSON.parse(await readFile(join(input, '.local/extraction.json'), 'utf8'));
  if (report.version !== '14.24.6442327' || !Array.isArray(report.files)) throw new Error('source-version-mismatch');
  if (heroes.some(id => !/^[a-z0-9_]+$/.test(id))) throw new Error('invalid-hero-id');
  const verified = {}, seen = new Set();
  for (const id of heroes) {
    const prefix = `assets/characters/tft13_${id}/`;
    const entries = report.files.filter(e => typeof e.path === 'string' && e.path.startsWith(prefix));
    if (!entries.length) throw new Error(`missing-source-records:${id}`);
    const unit = { files: 0, bytes: 0, meshes: [], skeletons: [], animations: [], textures: 0 };
    for (const entry of entries) {
      if (seen.has(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0) throw new Error('invalid-source-record');
      seen.add(entry.path);
      const path = await realpath(resolve(raw, entry.path)), rel = relative(raw, path);
      if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('unsafe-source-path');
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
