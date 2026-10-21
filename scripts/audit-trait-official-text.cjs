// Offline verification: archived wording, numeric differences, and unchanged v18 digest roots.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
async function main() {
  const { createServer } = await import('vite');
  const server = await createServer({ root: path.resolve(__dirname, '..'), configFile: false,
    server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' });
  try {
    const load = file => server.ssrLoadModule('/' + file);
    const { TRAIT_DEFINITIONS: definitions } = await load('src/simulation/content/traits.ts');
    const { TRAIT_OFFICIAL_TEXT: texts } = await load('src/presentation/trait-official-text.ts');
    const { traitDisplayValues, traitSummary, traitTierText } = await load('src/presentation/trait-text.ts');
    const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.resolve(__dirname, '../src/simulation/content/source/s13-14.24b/raw/en_us.json.gz'))));
    const zh = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.resolve(__dirname, '../src/simulation/content/source/s13-14.24b/raw/zh_cn.tft.stringtable.json.gz')))).entries;
    const archived = raw.setData.find(s => s.mutator === 'TFTSet13').traits;
    const differences = [], translated = [], round = n => Math.round(n * 10000) / 10000;
    let tiers = 0;
    assert.deepEqual(Object.keys(texts).sort(), Object.keys(definitions).sort());
    for (const [id, definition] of Object.entries(definitions)) {
      const text = texts[id], source = archived.find(t => t.apiName === text.apiName);
      const name = zh[`tft_trait_displayname_${text.apiName.toLowerCase()}`] ?? definition.name;
      if (text.locale === 'en_us') translated.push({ id, name, apiName: text.apiName });
      const tokens = [...new Set([...text.description.matchAll(/@([^@]+)@/g)].map(m => m[1]))];
      for (const tier of definition.tiers) {
        tiers++;
        const display = traitDisplayValues(id, tier.threshold);
        const original = source.effects.find(t => t.minUnits === tier.threshold).variables;
        const summary = traitSummary(id, tier.threshold), row = traitTierText(definition, tier);
        assert(summary && row.startsWith(`(${tier.threshold}) `), `${id}/${tier.threshold}: missing official text`);
        assert(!/@|<|%i:|undefined|NaN/.test(summary + row), `${id}/${tier.threshold}: unresolved text`);
        for (const token of tokens) {
          const [key, ...factors] = token.split('*');
          if (typeof original[key] !== 'number' || !factors.every(n => /^\d+$/.test(n)) || typeof display[token] !== 'number') continue;
          const official = round(round(original[key]) * factors.reduce((a, b) => a * Number(b), 1));
          const current = round(display[token]);
          if (official !== current) differences.push({ id, name, threshold: tier.threshold, token, official, current });
        }
      }
    }
    const { CONTENT_DIGEST } = await load('src/simulation/content/index.ts');
    const { LOOT_REPLAY_DIGEST } = await load('src/simulation/loot-freeze.ts');
    const { recomputeContentDigest } = await load('scripts/content-digest.ts');
    const { recomputeLootReplayDigest } = await load('scripts/loot-replay-digest.ts');
    assert.equal(recomputeContentDigest(), CONTENT_DIGEST);
    assert.equal(recomputeLootReplayDigest(), LOOT_REPLAY_DIGEST);
    const release = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../docs/evidence/v18/release-audit.json'), 'utf8'));
    // The recorded v18 epoch must still name the same content root.
    assert(JSON.stringify(release).includes(CONTENT_DIGEST), 'v18 release epoch content digest differs');
    assert(JSON.stringify(release).includes(LOOT_REPLAY_DIGEST), 'v18 release epoch loot replay digest differs');
    const report = { version: '14.24', traits: Object.keys(definitions).length, tiers, translated, differences,
      contentDigest: CONTENT_DIGEST, lootReplayDigest: LOOT_REPLAY_DIGEST, digestRecomputationPassed: true, v18RerecordRequired: false };
    const target = path.resolve(__dirname, '../docs/evidence/v18/trait-official-text-audit.json');
    const output = JSON.stringify(report, null, 2) + '\n';
    if (process.argv.includes('--check')) assert.equal(fs.readFileSync(target, 'utf8'), output);
    else fs.writeFileSync(target, output);
    console.log(output);
  } finally { await server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
