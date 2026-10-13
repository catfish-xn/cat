/* T11 evidence recorder, never a numerical oracle. Capture both real command-only
 * routes; audit before applying by audit SHA. Historical B9/T1/T10 files stay intact.
 * --capture /tmp/t11-review; --audit /tmp/t11-review; --apply /tmp/t11-review <audit-sha>
 */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const BASE = '67b22b9848beb18b84a2cf716113ea833a44de43';
const BUILDS = ['cannon', 'sniper', 'mage', 'sniper-caitlyn'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const frozen = route => ({ versions: Object.fromEntries(['schemaVersion', 'rulesVersion', 'contentVersion', 'contentDigest', 'commandProtocolVersion', 'rngAlgorithm', 'tickMs'].map(k => [k, route.initial[k]])), seed: 42,
  commands: route.actions.map(a => a.command), rounds: route.rounds.map(r => ({ round: r.round, stateHash: r.stateHash, eventsHash: r.eventsHash })) });

async function captureChild(root, build, out) {
  const { createServer } = await import('vite');
  const server = await createServer({ root, configFile: false, server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' });
  try {
    const api = await server.ssrLoadModule('/src/simulation/match.ts');
    // The unchanged driver checks every transaction against the independent handwritten oracle.
    const route = await require(path.join(root, 'scripts/generate-m5-route.cjs')).run(api, { build, seed: 42 });
    const initial = api.createMatch(42), first = api.startMatchCombat(initial); assert(first.ok);
    const states = [first.state]; let state = first.state;
    while (state.phase === 'combat') { state = api.stepMatch(state).state; states.push(state); }
    write(out, { frozen: frozen(route), ledger: route.ledger, checkpoints: route.checkpoints,
      summary: { outcome: route.summary.outcome, battles: route.rounds.length, rounds: route.final.roundResults.length,
        formedBattles: route.summary.formedBattles, caitlynBattles: route.summary.caitlynBattles },
      firstBattleStates: states, replayDigest: initial.m8.loot.frozen.replayDigest });
  } finally { await server.close(); }
}
function capture(folder) {
  fs.mkdirSync(folder, { recursive: true });
  assert(!fs.existsSync(path.join(folder, 'capture.json')), 'Use a fresh capture directory');
  const oldRoot = fs.mkdtempSync(path.join(os.tmpdir(), 't11-base-'));
  const archive = path.join(oldRoot, 'base.tar');
  execFileSync('git', ['archive', BASE, '--output', archive], { cwd: ROOT, stdio: 'inherit' });
  execFileSync('tar', ['-xf', archive, '-C', oldRoot], { stdio: 'inherit' });
  fs.unlinkSync(archive);
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(oldRoot, 'node_modules'));
  const files = {};
  for (const [kind, root] of [['old', oldRoot], ['new', ROOT]]) for (const build of BUILDS) {
    const name = `${kind}-${build}.json`;
    execFileSync(process.execPath, [__filename, '--child', root, build, path.join(folder, name)], { cwd: ROOT, stdio: 'inherit' });
    files[name] = sha(fs.readFileSync(path.join(folder, name)));
  }
  write(path.join(folder, 'capture.json'), { base: BASE, files });
}
function audit(folder) {
  const capture = read(path.join(folder, 'capture.json'));
  assert.equal(capture.base, BASE);
  for (const [name, hash] of Object.entries(capture.files)) assert.equal(sha(fs.readFileSync(path.join(folder, name))), hash);
  const candidate = { note: 'T11 user-signed 1-4 XP +2; independent oracle checks all command/resource transactions. B9 historical golden remains full-match-golden.json.', routes: {} };
  const report = { base: BASE, builds: {} }; let baseline;
  for (const build of BUILDS) {
    const previous = read(path.join(folder, `old-${build}.json`)), current = read(path.join(folder, `new-${build}.json`));
    for (const route of [previous, current]) {
      assert.equal(route.summary.outcome, 'victory'); assert.equal(route.summary.rounds, 38); assert.equal(route.summary.battles, 33);
      assert(route.summary.formedBattles >= 3);
    }
    assert.deepEqual(previous.ledger.rounds.slice(0, 3).map(r => [r.roundId, r.incomeBreakdown.base, r.xpRequested]), [['1-2', 2, 2], ['1-3', 3, 2], ['1-4', 5, 0]]);
    assert.deepEqual(current.ledger.rounds.slice(0, 3).map(r => [r.roundId, r.incomeBreakdown.base, r.xpRequested]), [['1-2', 2, 2], ['1-3', 3, 2], ['1-4', 5, 2]]);
    const normalize = (key, value) => key === 'contentDigest' && value === current.frozen.versions.contentDigest ? previous.frozen.versions.contentDigest
      : key === 'replayDigest' && value === current.replayDigest ? previous.replayDigest : value;
    assert.equal(JSON.stringify(current.firstBattleStates, normalize), JSON.stringify(previous.firstBattleStates), 'Every first-battle state byte is unchanged except the two content identities');
    const t10 = require('../tests/t10-content-baseline.json');
    assert.equal(sha(JSON.stringify(previous.firstBattleStates)), t10.stateTraceHash, 'Reproduce the pinned T10 probe');
    baseline = { openingRulesVersion: 'm8b-opening-project-v2', previousContentDigest: t10.contentDigest,
      contentDigest: current.frozen.versions.contentDigest, previousLootReplayDigest: previous.replayDigest,
      lootReplayDigest: current.replayDigest, stateTraceHash: sha(JSON.stringify(current.firstBattleStates)) };
    candidate.routes[build] = current.frozen;
    const changes = current.ledger.rounds.flatMap((r, i) => {
      const before = previous.ledger.rounds[i];
      const changed = Object.keys(r).filter(k => JSON.stringify(r[k]) !== JSON.stringify(before[k]));
      return changed.length ? [{ roundId: r.roundId, fields: Object.fromEntries(changed.map(k => [k, [before[k], r[k]]])) }] : [];
    });
    report.builds[build] = { ...current.summary, commandsBefore: previous.frozen.commands.length, commandsAfter: current.frozen.commands.length,
      commandsUnchanged: JSON.stringify(previous.frozen.commands) === JSON.stringify(current.frozen.commands),
      changedStateRounds: current.frozen.rounds.filter((r, i) => r.stateHash !== previous.frozen.rounds[i].stateHash).map(r => r.round),
      changedEventRounds: current.frozen.rounds.filter((r, i) => r.eventsHash !== previous.frozen.rounds[i].eventsHash).map(r => r.round), changes };
  }
  write(path.join(folder, 'candidate.json'), candidate); write(path.join(folder, 'baseline.json'), baseline);
  write(path.join(folder, 'audit.json'), { ...report, candidateSha256: sha(fs.readFileSync(path.join(folder, 'candidate.json'))), baselineSha256: sha(fs.readFileSync(path.join(folder, 'baseline.json'))), updaterSha256: sha(fs.readFileSync(__filename)), capture });
  console.log('Reviewed audit SHA:', sha(fs.readFileSync(path.join(folder, 'audit.json'))));
}
function apply(folder, reviewedSha) {
  const auditBytes = fs.readFileSync(path.join(folder, 'audit.json'));
  assert.equal(sha(auditBytes), reviewedSha, 'Exact reviewed audit required');
  const report = JSON.parse(auditBytes);
  assert.equal(sha(fs.readFileSync(__filename)), report.updaterSha256);
  for (const [source, target, digest] of [
    ['candidate.json', 'tests/fixtures/m5/full-match-golden.t11.json', report.candidateSha256],
    ['baseline.json', 'tests/t11-content-baseline.json', report.baselineSha256],
  ]) { const bytes = fs.readFileSync(path.join(folder, source)); assert.equal(sha(bytes), digest); fs.writeFileSync(path.join(ROOT, target), bytes); }
  fs.mkdirSync(path.join(ROOT, 'docs/evidence/t11'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'docs/evidence/t11/golden-audit.json'), auditBytes);
}
const [mode, a, b, c] = process.argv.slice(2);
Promise.resolve().then(() => mode === '--child' ? captureChild(a, b, c)
  : mode === '--capture' ? capture(path.resolve(a)) : mode === '--audit' ? audit(path.resolve(a))
  : mode === '--apply' ? apply(path.resolve(a), b) : assert.fail('Use --capture, --audit, --apply')).catch(e => { console.error(e); process.exitCode = 1; });
