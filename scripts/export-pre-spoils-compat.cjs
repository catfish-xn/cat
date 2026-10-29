/** Export the pre-Spoils settlement baseline under this checkout's content identity.
 * Usage: git show 808d16ae:src/simulation/g2-3-settlement.ts | node scripts/export-pre-spoils-compat.cjs /tmp/pre-spoils-v25.json
 * Reads Git only. Historical fixtures and epoch evidence are never overwritten.
 */
const { build } = require('esbuild');
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join, dirname } = require('node:path');
const { pathToFileURL } = require('node:url');
const { deepStrictEqual, strictEqual } = require('node:assert');

(async () => {
  if (!process.argv[2]) throw Error('Supply a new output path');
  const output = resolve(process.argv[2]);
  const directory = mkdtempSync(join(tmpdir(), 'pre-spoils-compat-'));
  try {
    const modulePath = resolve('src/simulation/g2-3-settlement.ts');
    const historical = readFileSync(0, 'utf8');
    if (!historical.includes('export function g23BattleFacts') || historical.includes('ownsSpoils'))
      throw Error('stdin must contain the pre-Spoils settlement module from 808d16ae');
    const bundle = join(directory, 'baseline.mjs');
    await build({
      stdin: { resolveDir: process.cwd(), contents: `
        import { createMatch, deployMatchUnit, selectChoice, startMatchCombat, stepMatch } from './src/simulation/match';
        import { restoreMatch, serializeMatch } from './src/simulation/serialization';
        const accept = r => { if (!r.ok) throw Error(r.reason); return r.state; };
        let state = createMatch(42);
        while (state.phase === 'choice') {
          const c = state.pendingChoice;
          state = accept(selectChoice(state, c.choiceId, c.generation, c.offers[0]));
        }
        state = accept(deployMatchUnit(state, 'unit-1', {kind:'board', cell:{col:1,row:4}}));
        state = accept(startMatchCombat(state));
        while (state.phase === 'combat') state = stepMatch(state).state;
        export const text = serializeMatch(state);
        export const restored = restoreMatch(text);
        export { state };
      ` },
      bundle: true, platform: 'node', format: 'esm', outfile: bundle,
      plugins: [{ name: 'pre-spoils-settlement', setup(builder) {
        builder.onLoad({ filter: /[/\\]g2-3-settlement\.ts$/ }, args => {
          strictEqual(args.path, modulePath);
          return { contents: historical, loader: 'ts', resolveDir: dirname(modulePath) };
        });
      } }],
    });
    const baseline = await import(pathToFileURL(bundle).href);
    deepStrictEqual(baseline.restored, baseline.state, 'historical settlement serialize/restore');
    const old = JSON.parse(readFileSync('tests/fixtures/compat/pre-spoils-v24-seed42.json', 'utf8'));
    const current = JSON.parse(baseline.text);
    // Verify ALL gameplay data against the retained fixture. These five identity
    // fields alone may differ; do not patch any digest in the exported bytes.
    const identityPaths = ['rulesVersion', 'contentVersion', 'contentDigest', 'combatInputBasis.contentDigest', 'm8.loot.frozen.replayDigest'];
    for (const path of identityPaths) {
      const keys = path.split('.'), key = keys.pop();
      const a = keys.reduce((v, k) => v[k], old), b = keys.reduce((v, k) => v[k], current);
      if (a[key] === b[key]) throw Error(`Expected a changed identity at ${path}`);
      delete a[key]; delete b[key];
    }
    deepStrictEqual(current, old, 'pre-Spoils v24/v25 gameplay bytes apart from identity');
    writeFileSync(output, baseline.text, { flag: 'wx' });
    console.log(JSON.stringify({ output, settlementRef: '808d16ae', identityPaths }));
  } finally { rmSync(directory, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
