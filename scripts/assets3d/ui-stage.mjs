// Produce a self-contained, verified runtime /ui/ directory. No raw WAD payloads or backups are uploaded.
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeInputPath, safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';
import { VERSION, PATCH_SHA, sha256, json, cliArguments } from './ui-source.mjs';

export async function stageUi({ input = 'assets3d-local/ui', out = 'assets3d-local/ui-delivery' } = {}) {
  const bytes = await readFile(await safeInputPath(input, join(input, 'manifest.json'))), manifest = JSON.parse(bytes);
  if (manifest.schemaVersion !== 1 || manifest.sourceVersion !== VERSION || manifest.sourceManifestSha256 !== PATCH_SHA) throw new Error('ui-stage-version');
  const files = new Map(), rows = [];
  // Validate everything, including source paths and sprites, before the first output mutation.
  for (const entry of [...Object.values(manifest.textures), ...Object.values(manifest.fonts)]) {
    const path = await safeInputPath(input, join(input, entry.path));
    if (entry.path.startsWith('/') || entry.path.split(/[\\/]/).some(p => !p || p === '.' || p === '..')) throw new Error('ui-stage-path');
    const data = await readFile(path);
    if (data.length !== entry.bytes || sha256(data) !== entry.sha256) throw new Error(`ui-stage-hash:${entry.path}`);
    if (files.has(entry.path) && !files.get(entry.path).equals(data)) throw new Error('ui-stage-conflict');
    files.set(entry.path, data);
  }
  for (const sprite of Object.values(manifest.sprites)) {
    const t = manifest.textures[sprite.texture], r = sprite.rect;
    if (!t || !Array.isArray(r) || r.length !== 4 || !r.every(Number.isSafeInteger) || r[0] < 0 || r[1] < 0 || r[2] <= 0 || r[3] <= 0
      || r[0] + r[2] > t.width || r[1] + r[3] > t.height) throw new Error('ui-stage-region');
    if (sprite.states && Object.values(sprite.states).some(id => !manifest.sprites[id])) throw new Error('ui-stage-state');
  }
  const evidence = [...Object.values(manifest.regionReviews ?? {}), manifest.batchReview?.sheet, manifest.batchReview?.fonts, manifest.batchReview?.viewer].filter(Boolean);
  for (const path of evidence) {
    if (typeof path !== 'string' || path.startsWith('/') || path.split(/[\\/]/).some(p => !p || p === '.' || p === '..')) throw new Error('ui-stage-review-path');
    files.set(path, await readFile(await safeInputPath(input, join(input, path))));
  }
  files.set('manifest.json', bytes);
  for (const path of files.keys()) await safeOutputPath(join(out, 'ui', path), { force: true });
  for (const [path, data] of files) {
    await writeOutputFileAtomic(join(out, 'ui', path), data, { force: true });
    rows.push({ path, bytes: data.length, sha256: sha256(data) });
  }
  const report = { sourceVersion: VERSION, manifestSha256: sha256(bytes), files: rows, totalBytes: rows.reduce((n, r) => n + r.bytes, 0),
    sprites: Object.keys(manifest.sprites).length, shopArt: Object.keys(manifest.shopArt).length,
    unavailable: manifest.unavailable, limitations: manifest.limitations,
    // JSON/HTML indexes become visible only after every image/font payload arrived.
    // Keep && in the generated command: a failed payload transfer must stop publication.
    upload: 'rsync -av --protect-args --exclude=\'*.json\' --exclude=\'*.html\' assets3d-local/ui-delivery/ui/ "${UI_UPLOAD_TARGET:?set upload target}" &&\n'
      + 'rsync -av --protect-args --include=\'*/\' --include=\'*.json\' --include=\'*.html\' --exclude=\'*\' assets3d-local/ui-delivery/ui/ "${UI_UPLOAD_TARGET:?set upload target}"' };
  await writeOutputFileAtomic(join(out, 'stage-report.local.json'), json(report), { force: true });
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = cliArguments(process.argv.slice(2), ['input']);
    if (options.fetch || options.dryRun) throw new Error('ui-stage-is-offline');
    console.log(json(await stageUi(options)));
  }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
