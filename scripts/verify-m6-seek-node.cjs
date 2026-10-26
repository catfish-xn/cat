/* Port-free B9 firstSeek reproduction. No browser, budget changes, or rule writes.
 * Generate: node scripts/verify-m6-seek-node.cjs --output /tmp/seek-current
 * Remeasure/profile: node --cpu-prof --cpu-prof-dir=/tmp/seek-current scripts/verify-m6-seek-node.cjs --record /tmp/seek-current/record.json --output /tmp/seek-current/cold
 * Old tree: add --root /tmp/pre-v23 (export git archive there and symlink node_modules).
 */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

async function main() {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i += 2) {
    assert(['--root', '--output', '--record', '--samples'].includes(args[i]) && args[i + 1], `unknown/missing option ${args[i]}`);
    options[args[i].slice(2)] = args[i + 1];
  }
  const root = path.resolve(options.root ?? path.join(__dirname, '..'));
  assert(options.output, '--output is required (generated artifacts stay outside source)');
  const output = path.resolve(options.output), count = Number(options.samples ?? 3);
  assert(Number.isSafeInteger(count) && count > 0, '--samples must be a positive integer');
  fs.mkdirSync(output, { recursive: true });
  const { build } = require(path.join(root, 'node_modules/esbuild'));
  const modulePath = path.join(output, 'seek-modules.mjs');
  await build({ stdin: { contents: `export * from ${JSON.stringify(path.join(root, 'src/simulation/match.ts'))}; export * from ${JSON.stringify(path.join(root, 'src/replay/index.ts'))};`, resolveDir: root },
    bundle: true, platform: 'node', format: 'esm', outfile: modulePath, sourcemap: true });
  const api = await import(pathToFileURL(modulePath));
  const report = { node: process.version, root, routes: [], method: 'B9 catalog-capacity seed42 five public-command routes; largest JSON battle; constructor + seek(endTick), exactly as verify-m6-performance.cjs' };
  let record;
  if (options.record) record = JSON.parse(fs.readFileSync(path.resolve(options.record), 'utf8'));
  else {
    let largest = null;
    for (const build of ['cannon', 'sniper', 'mage', 'sniper-caitlyn', 'full-load']) {
      const history = new api.BattleHistory(`performance-${build}`);
      const runner = require(path.join(root, 'scripts', build === 'full-load' ? 'verify-m6-full-load-helper.cjs' : 'generate-m5-route.cjs'));
      const route = await runner.run(api, { build, seed: 42, ...(build === 'full-load' ? { augmentPriorities: ['going-long'] } : {}),
        onStep(before, result, command) { history.observe({ before, after: result.state, events: result.events.filter(e => e.domain === 'combat'), reason: command ? 'command' : 'tick' }); } });
      assert.equal(route.final.phase, 'gameOver');
      assert.equal(history.completedRecords.length, 33, 'B9 catalog capacity');
      for (const candidate of history.completedRecords) {
        const bytes = Buffer.byteLength(JSON.stringify(candidate));
        if (!largest || bytes > largest.bytes) largest = { bytes, record: candidate, build };
      }
      const row = { build, ticks: route.summary.ticks, battles: history.completedRecords.length };
      report.routes.push(row); console.log(JSON.stringify(row));
    }
    report.selectedBuild = largest.build;
    // Browser fixture transport supplies unbranded data, not recorder ownership.
    record = JSON.parse(JSON.stringify(largest.record));
  }
  const original = JSON.stringify(record);
  fs.writeFileSync(path.join(output, 'record.json'), original);
  Object.assign(report, { combatId: record.combatId, endTick: record.endTick, events: record.events.length, bytes: Buffer.byteLength(original), samples: [] });
  for (let repeat = 0; repeat < count; repeat++) {
    const start = performance.now(), playback = new api.PlaybackSession(record), constructed = performance.now();
    const terminal = playback.seek(record.endTick), end = performance.now();
    // Keep checks, serialization and cached-seek measurements outside firstSeek.
    assert.equal(terminal.tick, record.endTick);
    const terminalBytes = JSON.stringify(terminal.combat);
    if (repeat === 0) fs.writeFileSync(path.join(output, 'terminal.json'), terminalBytes);
    else assert.equal(terminalBytes, fs.readFileSync(path.join(output, 'terminal.json'), 'utf8'));
    const cachedSeekMs = [];
    for (let i = 0; i < 4; i++) {
      const tick = Math.max(0, Math.min(record.endTick - 1, Math.floor(record.endTick * (repeat * 4 + i + 1) / 13)));
      const before = performance.now(); playback.seek(tick); cachedSeekMs.push(performance.now() - before);
    }
    report.samples.push({ constructMs: constructed - start, seekMs: end - constructed, firstSeekMs: end - start, cachedSeekMs });
    playback.dispose();
  }
  assert.equal(JSON.stringify(record), original, 'measurement must not mutate the fixture');
  fs.writeFileSync(path.join(output, 'timings.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
