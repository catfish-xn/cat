// Compatibility wrapper retains batch-one defaults and output boundary.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { batch1Tables } from './fx-bindings/batch1.mjs';
import { fxBatch, batchActionBindings as bind, batchOutputRoot as root } from './fx-batch.mjs';
import { withinRoot } from './safe-path.mjs';
import { argumentsFor } from './plan-fetch.mjs';
export const batchActionBindings = (manifest, rows, bones, tables = batch1Tables) => bind(manifest, rows, bones, tables);
export async function batchOutputRoot(out) {
 withinRoot(resolve('assets3d-local/fx-batch1'), resolve(out), 'batch1-output-only');
 return root(out);
}
export async function fxBatch1({ units = Object.keys(batch1Tables).join(','), out = 'assets3d-local/fx-batch1', force = false } = {}) {
 if (units.split(',').some(u => !Object.hasOwn(batch1Tables,u))) throw new Error('unsupported-batch-units');
 await batchOutputRoot(out);
 return fxBatch({ units, out, force });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
 console.log(JSON.stringify(await fxBatch1(argumentsFor(process.argv.slice(2), ['--units','--out']))));
