import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { batchOutputRoot } from './fx-batch1.mjs';
import { batchSizes as sizes } from './fx-batch-sizes.mjs';
import { argumentsFor } from './plan-fetch.mjs';
export async function batchSizes(options = {}) {
 await batchOutputRoot(options.out ?? 'assets3d-local/fx-batch1');
 return sizes(options);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
 console.log(JSON.stringify(await batchSizes(argumentsFor(process.argv.slice(2), ['--out']))));
