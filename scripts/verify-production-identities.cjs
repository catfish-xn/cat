/* Offline equivalence check for the production-only catalog projection. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
async function main() {
  const { createServer } = await import('vite');
  const options = { configFile: false, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error' };
  const original = await createServer({ ...options, cacheDir: 'artifacts/identity-verify-original' });
  let projected;
  try {
    const { productionIdentities } = await original.ssrLoadModule('/scripts/production-identities.ts');
    const plugin = productionIdentities();
    await plugin.buildStart.call({ info() {}, error(message) { throw Error(message); } });
    projected = await createServer({ ...options, cacheDir: 'artifacts/identity-verify-projected',
      plugins: [{ name: 'verify-production-projection', transform: plugin.transform }] });
    const checked = [];
    for (const [path, names] of [
      ['content/index.ts', ['CONTENT_DIGEST', 'ITEM_DEFINITIONS', 'TRAIT_DEFINITIONS', 'AUGMENT_DEFINITIONS', 'ANOMALY_DEFINITIONS']],
      ['units.ts', ['UNIT_DEFINITIONS']], ['combat-abilities.ts', ['ABILITY_DEFINITIONS']],
      ['loot-freeze.ts', ['LOOT_REPLAY_DIGEST']], ['content/consumables.ts', ['REFORGE_POOLS']],
    ]) {
      const left = await original.ssrLoadModule('/src/simulation/' + path);
      const right = await projected.ssrLoadModule('/src/simulation/' + path);
      for (const name of names) { assert.deepEqual(right[name], left[name], name); checked.push(name); }
    }
    const a = await original.ssrLoadModule('/src/simulation/match.ts');
    const b = await projected.ssrLoadModule('/src/simulation/match.ts');
    for (const seed of [42, 7216, 6240]) {
      let left = a.createMatch(seed), right = b.createMatch(seed);
      assert.deepEqual(right, left);
      left = a.startMatchCombat(left).state; right = b.startMatchCombat(right).state;
      while (left.phase === 'combat') {
        const x = a.stepMatch(left), y = b.stepMatch(right);
        assert.deepEqual(y, x); left = x.state; right = y.state;
      }
    }
    const report = { checked, firstBattleSeeds: [42, 7216, 6240], equal: true };
    fs.mkdirSync('artifacts/premerge-265', { recursive: true });
    fs.writeFileSync('artifacts/premerge-265/production-equivalence.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally { await projected?.close(); await original.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
