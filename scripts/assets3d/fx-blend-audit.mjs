// Read-only audit of local sidecars, including skipped/rejected emitters.
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pngHasEffectiveAlpha } from './texture-alpha.mjs';

async function files(root) {
  const result = [];
  for (const e of await readdir(root, { withFileTypes: true })) {
    if (e.isDirectory()) result.push(...await files(join(root, e.name)));
    else if (e.isFile()) result.push(join(root, e.name));
  }
  return result;
}
const canonical = p => p.toLowerCase().replaceAll('\\', '/').replaceAll('.tft_set13', '').replace(/\.(dds|tex)$/, '.png');
export async function auditBlends() {
  const result = {};
  for (const name of ['fx-trial', 'fx-batch1', 'fx-batch2', 'fx-all']) {
    const root = resolve('assets3d-local', name), all = name === 'fx-all'
      ? [...await files(join(root, 'effects', 'global')), ...await files(join(root, 'global'))] : await files(root);
    let reports = all.filter(p => p.endsWith('.report.json') && p.includes(`${join(root, 'effects')}`));
    if (name === 'fx-all') reports = reports.filter(p => p.startsWith(join(root, 'effects', 'global')));
    // Batches copy the shared hit byte-for-byte, without its sidecar.
    if (name.startsWith('fx-batch')) reports.push(resolve('assets3d-local/fx-trial/effects/global/tft_global_ba_hit.report.json'));
    const pngs = all.filter(p => p.endsWith('.png')), cache = new Map(), modes = {}, rows = [];
    for (const path of reports) {
      const report = JSON.parse(await readFile(path, 'utf8'));
      for (const row of report.emitters) {
        const source = row.originalFields, mode = String(source.blendMode ?? 'missing');
        const group = modes[mode] ??= { total: 0, effectiveAlpha: 0, opaque: 0, noTexture: 0, unavailable: 0 };
        group.total++;
        let alpha = 'noTexture', png;
        if (source.texture) {
          const suffix = '/' + canonical(source.texture);
          png = pngs.find(p => canonical(p).endsWith(suffix));
          alpha = 'unavailable';
          if (png) {
            if (!cache.has(png)) cache.set(png, pngHasEffectiveAlpha(await readFile(png)));
            alpha = cache.get(png) ? 'effectiveAlpha' : 'opaque';
          }
        }
        group[alpha]++;
        rows.push({ sourcePath: row.sourcePath, name: source.emitterName, mode, alpha, texture: source.texture, png });
      }
    }
    result[name] = { modes, total: rows.length, uniquePNGsRead: cache.size, rows };
  }
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await auditBlends();
  console.log(JSON.stringify(result, null, 2));
}
