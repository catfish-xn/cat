/* B10 helpers: real public route -> validated save; no browser state mutation. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const debug = name => `[data-debug="${name}"]`;
const read = page => page.evaluate(() => window.__CAT_DEBUG__.read());
const identity = () => ({ sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()), node: process.version,
  sourceFingerprint: require('./m5-evidence.cjs').sourceFingerprint() });
async function domain() {
  const { createServer } = await import('vite');
  const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  const load = file => server.ssrLoadModule(file);
  return { server, load, api: await load('/src/simulation/match.ts') };
}
async function prefixFixture(d, output, roundId = '2-7') {
  const { BattleHistory, validateBattleCollection } = await d.load('/src/replay/index.ts');
  const { validateEnvelope } = await d.load('/src/persistence/format.ts');
  const history = new BattleHistory(`b10-${roundId}`), stop = new Error('public prefix captured');
  const combatOnly = events => events.filter(event => event.domain === 'combat');
  let match;
  const api = { ...d.api, startMatchCombat(before) {
    if (before.roundDefinitionId === roundId) { match = before; throw stop; }
    return d.api.startMatchCombat(before);
  } };
  try { await require('./generate-m5-route.cjs').run(api, { build: 'cannon', seed: 42,
    onStep(before, result, command) { history.observe({ before, after: result.state, events: combatOnly(result.events), reason: command ? 'command' : 'tick' }); } });
  } catch (error) { if (error !== stop) throw error; }
  assert(match, `public route reached ${roundId}`);
  const envelope = { kind: 'hex-autobattler-save', saveFormatVersion: 2, replayFormatVersion: 2, runId: history.runId ?? `b10-${roundId}`,
    createdAt: '2026-10-11T00:00:00.000Z', match, battles: history.completedRecords, currentBattle: null };
  await validateEnvelope(JSON.parse(JSON.stringify(envelope)), validateBattleCollection);
  fs.mkdirSync(output, { recursive: true });
  const file = path.join(output, `public-${roundId}.json`); fs.writeFileSync(file, JSON.stringify(envelope));
  return { file, runId: envelope.runId, roundId, match, battles: envelope.battles.length };
}
async function importFixture(page, fixture) {
  await page.locator(debug('m6-import')).setInputFiles(fixture.file);
  await page.waitForFunction(id => window.__CAT_DEBUG__?.read().m6?.mode === 'active' && window.__CAT_DEBUG__.read().m6.runId === id, fixture.runId, { timeout: 60000 });
}
async function appServer(mode = 'preview', outDir = 'dist') {
  const vite = await import('vite');
  const server = mode === 'dev'
    ? await vite.createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } })
    : await vite.preview({ root, logLevel: 'error', build: { outDir }, preview: { host: '127.0.0.1', port: 0 } });
  if (mode === 'dev') await server.listen();
  return { url: server.resolvedUrls.local[0], close: () => mode === 'dev' ? server.close() : new Promise(resolve => server.httpServer.close(resolve)) };
}
async function boot(page, url, seed = 42) {
  await page.goto(url);
  await page.waitForFunction(() => { const b = document.querySelector('[data-debug="m6-fixed-start"]'); return b && !b.disabled; });
  await page.locator(debug('m6-seed-input')).fill(String(seed));
  await page.locator(debug('m6-fixed-start')).click();
  await page.waitForFunction(() => window.__CAT_DEBUG__?.read().m6?.mode === 'active');
}
module.exports = { root, debug, read, identity, domain, prefixFixture, importFixture, appServer, boot };
