/* Offline full-root identity generation. No build transforms or runtime mode branches. */
const fs = require('node:fs'), assert = require('node:assert/strict');
const target = 'src/simulation/content/identity-constants.ts';
async function main() {
  assert(process.argv.length === 3 && ['--write', '--check'].includes(process.argv[2]),
    'Usage: node scripts/update-content-identities.cjs --write|--check');
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: false, cacheDir: 'artifacts/content-identity-cache',
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false },
    appType: 'custom', logLevel: 'error' });
  try {
    const { recomputeContentDigest } = await server.ssrLoadModule('/scripts/content-digest.ts');
    const { recomputeLootReplayDigest } = await server.ssrLoadModule('/scripts/loot-replay-digest.ts');
    const content = recomputeContentDigest(), loot = recomputeLootReplayDigest();
    const text = '// Generated from the complete archived content, including explanation/provenance columns.\n'
      + '// Recompute: node scripts/update-content-identities.cjs --write\n'
      + `export const CONTENT_DIGEST = '${content}';\nexport const LOOT_REPLAY_DIGEST = '${loot}';\n`;
    if (process.argv[2] === '--write') fs.writeFileSync(target, text);
    else assert.equal(fs.readFileSync(target, 'utf8'), text,
      'Stale content identities. Recompute: node scripts/update-content-identities.cjs --write');
    console.log(JSON.stringify({ contentDigest: content, lootReplayDigest: loot, mode: process.argv[2] }));
  } finally { await server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
