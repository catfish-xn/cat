// Offline only. Source paths, raw data, images, fonts and receipts stay ignored.
import { readFile, stat } from 'node:fs/promises';
import { join, resolve, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';
import { assertEntryPath } from './extract-from-chunks.mjs';
import { selectChunks } from './fetch-chunks.mjs';
import { decodeTexture, encodePng } from './texture.mjs';
import { scanLocal, loadPatch, readDictionary, UiSource, VERSION, PATCH_SHA, sha256, json, cliArguments } from './ui-source.mjs';

const fields = ['hash', 'offset', 'compressedSize', 'size', 'type', 'subchunkCount', 'firstSubchunk'];
async function immutableWrite(path, bytes) {
  await safeOutputPath(path, { force: true });
  try {
    const info = await stat(path);
    if (info.size !== bytes.length || sha256(await readFile(path)) !== sha256(bytes)) throw new Error('existing-ui-file-mismatch');
    return 'skipped';
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  await writeOutputFileAtomic(path, bytes); return 'written';
}
export async function extractUi({ source, paths, plan, out = 'assets3d-local/ui', reportOut = 'assets3d-local/ui-plan' }) {
  await safeOutputPath(out, { directory: true }); await safeOutputPath(reportOut, { directory: true });
  const ready = [], unavailable = [], textures = {}, fonts = {}, archives = new Map();
  // Validate ALL plan paths and range declarations before the first mutation.
  for (const wad of plan.wads) {
    const file = source.manifest.files.find(f => f.name === wad.name);
    if (!file) throw new Error('plan-wad-not-in-manifest');
    for (const e of wad.entries) {
      assertEntryPath(e.path);
      if (paths.get(e.hash) !== e.path) throw new Error('plan-path-dictionary-mismatch');
    }
    if (wad.entries.length) {
      const index = await source.index(file);
      for (const requested of wad.entries) {
        const entry = index.entries.find(e => e.hash === requested.hash);
        if (!entry || fields.some(k => entry[k] !== requested[k])) throw new Error('plan-wad-entry-mismatch');
      }
      archives.set(wad.name, { file, entries: index.entries });
    }
  }
  for (const t of plan.targets) if (!t.wad) unavailable.push({ id: t.path, reason: t.status });
  for (const wad of plan.wads) for (const entry of wad.entries) {
    const { file, entries } = archives.get(wad.name);
    const record = { wad: wad.name, sourcePath: entry.path, hash: entry.hash, role: entry.role };
    let bytes;
    try { bytes = await source.extract(file, entry, entries, paths); }
    catch (e) {
      if (!e.message.startsWith('missing-local-chunk:')) throw e;
      unavailable.push({ id: entry.path, wad: wad.name, reason: e.message }); continue;
    }
    record.rawPath = `raw/${basename(wad.name)}/${entry.path}`;
    record.bytes = bytes.length; record.sha256 = sha256(bytes);
    record.status = await immutableWrite(join(out, record.rawPath), bytes);
    if (/\.(tex|dds|png)$/i.test(entry.path)) {
      let png, width, height;
      try {
        if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
          // Validate the complete PNG decoder path; retain native PNG bytes.
          const sharp = (await import('sharp')).default;
          const decoded = await sharp(bytes, { limitInputPixels: 16777216 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          width = decoded.info.width; height = decoded.info.height; png = bytes;
        } else {
          const decoded = decodeTexture(bytes); width = decoded.width; height = decoded.height; png = encodePng(decoded);
        }
      } catch (e) {
        unavailable.push({ id: entry.path, reason: 'unsupported-or-invalid-texture', detail: e.message });
      }
      if (png) {
        const path = `textures/${sha256(png)}.png`;
        await immutableWrite(join(out, path), png);
        textures[entry.hash] = { path, sourcePath: entry.path, width, height, bytes: png.length, sha256: sha256(png) };
        record.texture = path;
        if (/atlas|healthbar/i.test(entry.path)) unavailable.push({ id: entry.path, reason: 'region-unverified' });
      }
    } else if (/\.(ttf|otf)$/i.test(entry.path)) {
      if (!['00010000', '4f54544f', '74746366'].includes(bytes.subarray(0, 4).toString('hex'))) throw new Error('invalid-font-container');
      const path = `fonts/${entry.hash}${extname(entry.path)}`;
      await immutableWrite(join(out, path), bytes);
      const evidence = plan.references.filter(r => r.path === entry.path && r.localeEvidence).map(r => r.localeEvidence);
      fonts[entry.hash] = { path, sourcePath: entry.path, bytes: bytes.length, sha256: sha256(bytes), localeEvidence: evidence,
        coverageVerified: false };
      unavailable.push({ id: entry.path, reason: 'font-coverage-unverified' });
    }
    ready.push(record);
  }
  const pendingIndexes = plan.wads.filter(w => w.stage !== 'entries').map(w => ({ wad: w.name, stage: w.stage, reason: w.pending }));
  const report = { schemaVersion: 1, sourceVersion: VERSION, sourceManifest: plan.sourceManifest,
    status: !ready.length ? 'blocked' : unavailable.length || pendingIndexes.length ? 'partial' : 'complete',
    sourceComplete: plan.complete && !unavailable.some(u => u.reason.startsWith('missing-local-chunk:')),
    visualReady: false, files: ready, unavailable, pendingIndexes,
    totals: { extracted: ready.length, textures: Object.keys(textures).length, fonts: Object.keys(fonts).length,
      rawBytes: ready.reduce((n, r) => n + r.bytes, 0),
      textureBytes: [...new Map(Object.values(textures).map(t => [t.path, t])).values()].reduce((n, t) => n + t.bytes, 0),
      fontBytes: Object.values(fonts).reduce((n, t) => n + t.bytes, 0) } };
  // A zero-source report is useful evidence; an empty runtime manifest would
  // misrepresent extraction as success, so it is deliberately not produced.
  if (ready.length) {
    const manifest = { schemaVersion: 1, sourceVersion: VERSION, sourceManifestSha256: plan.sourceManifest.sha256,
      textures, sprites: {}, fonts, shopArt: Object.fromEntries(plan.references.filter(r => r.definitionId).flatMap(r => {
        const texture = Object.entries(textures).find(([, t]) => t.sourcePath === (r.resolvedPath ?? r.path));
        return texture ? [[r.definitionId, { texture: texture[0], sourceField: r.sourceField, character: r.character }]] : [];
      })), references: plan.references, unavailable,
      limitations: ['No inferred atlas coordinates, nine-slices, states, font family/weight or Chinese glyph coverage. Runtime integration requires review.'] };
    await writeOutputFileAtomic(join(out, 'extraction.json'), json(report), { force: true });
    await writeOutputFileAtomic(join(out, 'manifest.json'), json(manifest), { force: true });
  }
  await writeOutputFileAtomic(join(reportOut, 'extract-report.json'), json(report), { force: true });
  return report;
}
export async function extractUiFromFiles({ planPath = 'assets3d-local/ui-plan/fetch-plan.json', scanRoots, manifestPath, dictionary, out, reportOut } = {}) {
  const plan = JSON.parse(await readFile(planPath, 'utf8'));
  if (plan.kind !== 'ui-fetch-plan' || plan.sourceVersion !== VERSION || plan.sourceManifest?.sha256 !== PATCH_SHA) throw new Error('invalid-ui-plan');
  const inventory = await scanLocal(scanRoots), patch = await loadPatch(inventory, manifestPath ?? plan.sourceManifest.path);
  selectChunks(plan, patch.manifest);
  const dictionaries = dictionary ? [dictionary] : plan.sourceDictionary;
  const wanted = new Set(plan.wads.flatMap(w => w.entries.map(e => e.hash)));
  // Resolve only planned entries, including any explicitly planned TOC.
  const paths = await readDictionary(dictionaries, () => true, wanted);
  const source = new UiSource(patch.manifest, inventory);
  return extractUi({ source, paths, plan, out, reportOut });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = cliArguments(process.argv.slice(2), ['reportOut']);
    if (options.fetch || options.dryRun) throw new Error('extract-is-offline-use-planner-for-dry-run');
    const report = await extractUiFromFiles(options); console.log(json(report));
    if (report.status !== 'complete') process.exitCode = 2;
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
