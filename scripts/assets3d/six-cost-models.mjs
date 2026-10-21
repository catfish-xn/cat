// Offline model rebuild; source and previous roots are read-only.
import { readFile, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
import { buildAssetRoot } from './build-asset-root.mjs';
import { publishRoot } from './merge-root-output.mjs';
import { argumentsFor } from './plan-fetch.mjs';
import { safeInputPath } from './safe-path.mjs';

export async function rebuildSixCost({ source = 'assets3d-local/six-cost/source', out = 'assets3d-local/six-cost/rebuilt', base = 'assets3d-local/cast-anim', fx = 'assets3d-local/fx-batch7' } = {}) {
  try { await lstat(out); throw new Error('output-exists-use-new-directory'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const converted = join(out, 'converted'), models = join(out, 'models'), root = join(out, 'root');
  // A fresh conversion can share texture/mesh paths across its own systems.
  const result = await build({ units: 'mel,viktor,warwick', source, out: converted, force: true, batch: true, particleMode: 'approximate' });
  if (!result.ready) throw new Error('six-cost-conversion-failed');
  const manifest = JSON.parse(await readFile(join(converted, 'manifest.json'), 'utf8'));
  const files = new Map();
  for (const entry of Object.values(manifest.models)) files.set(entry.path, await readFile(await safeInputPath(resolve(converted), resolve(converted, entry.path))));
  files.set('manifest.json', Buffer.from(JSON.stringify({ schemaVersion: 1, models: manifest.models, effects: {} }, null, 2) + '\n'));
  await publishRoot(models, files, false);
  // Put rebuilt models last so stale FX-root model mappings cannot restore hit.
  return buildAssetRoot({ roots: [base, fx, models], out: root });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { sources, ...report } = await rebuildSixCost(argumentsFor(process.argv.slice(2), ['--source', '--out', '--base', '--fx']));
  console.log(JSON.stringify(report));
}
