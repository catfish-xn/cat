/* Opt-in, fresh-process seed-230 comparison against a read-only Git revision.
 * node scripts/compare-augment-history.cjs [--base=bc818fd8] [--runs=3]
 * Keeps every assertion in generate-m5-route.cjs. Records serializeMatch SHA-256
 * after EVERY completed round (including supply), plus initial/final saves.
 * Separate timed runs replay exactly that public-command transcript and all
 * combat steps; their complete round JSON hashes must match the audited route.
 * Serialization/restore and evidence hashing are outside production timings.
 * Does not write Git, fixtures, golden files, or any production source.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const root = path.resolve(__dirname, '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const git = args => execFileSync('git', args, { cwd: root, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, maxBuffer: 64 * 1024 * 1024 });
const directory = path.join(root, 'artifacts', 'augment-history-rounds');
const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2) + '\n');

async function worker(mode, phase, run) {
  const api = require(path.join(directory, `${mode}.cjs`));
  const driver = require('./generate-m5-route.cjs');
  const reference = mode === 'after' || phase === 'timing' ? read('before-evidence.json') : undefined;
  const rounds = [], transcript = [];
  let commandMs = 0, evidenceMs = 0, ticks = 0;
  const measured = Object.fromEntries(Object.entries(api).map(([key, fn]) => [key, typeof fn !== 'function' ? fn : (...args) => {
    const started = performance.now();
    try { return fn(...args); } finally { commandMs += performance.now() - started; }
  }]));
  function checkpoint(state, label) {
    const started = performance.now();
    const row = { label, round: state.round, roundId: state.roundDefinitionId, phase: state.phase,
      facts: state.augmentHistory?.facts.length ?? 0, jsonSha256: sha(JSON.stringify(state)) };
    if (phase === 'evidence') row.serializeSha256 = sha(api.serializeMatch(state));
    rounds.push(row);
    if (phase === 'evidence') console.error(JSON.stringify({ mode, checkpoint: label, roundId: row.roundId, facts: row.facts, serializeSha256: row.serializeSha256 }));
    evidenceMs += performance.now() - started;
  }
  function observe(before, result, command) {
    assert.notEqual(result.ok, false, result.reason);
    if (command) transcript.push(command); else {
      ticks++;
      if (reference) assert(ticks <= reference.ticks, 'replay exceeded the complete reference step count');
    }
    for (let index = before.roundResults.length; index < result.state.roundResults.length; index++) {
      assert.equal(index, result.state.roundResults.length - 1, 'one completed round per public command');
      checkpoint(result.state, `completed:${index + 1}`);
    }
  }
  const started = performance.now();
  let state;
  if (phase === 'evidence') {
    // The driver retains its economic, growth, event, RNG and shop oracles.
    checkpoint(api.createMatch(230), 'initial');
    const route = await driver.run(measured, { seed: 230, build: 'cannon', onStep: observe });
    state = route.final;
    assert.equal(ticks, route.summary.ticks);
    assert.equal(transcript.length, route.actions.length);
  } else {
    state = measured.createMatch(230);
    checkpoint(state, 'initial');
    const finish = () => {
      while (state.phase === 'combat') {
        const result = measured.stepMatch(state);
        observe(state, result);
        state = result.state;
      }
    };
    for (const command of reference.transcript) {
      finish();
      const result = driver.dispatch(measured, state, command);
      observe(state, result, command);
      state = result.state;
    }
    finish();
  }
  checkpoint(state, 'final');
  const elapsedMs = performance.now() - started - evidenceMs;
  assert.equal(state.phase, 'gameOver');
  assert.equal(state.roundDefinitionId, '6-7');
  assert.equal(state.roundResults.length, require('../tests/fixtures/m5/oracle.g2.cjs').ROUNDS.length, 'all scheduled rounds completed');
  assert.equal(rounds.filter(row => row.label.startsWith('completed:')).length, state.roundResults.length);
  assert(state.augmentHistory.facts.some(fact => fact.kind === 'deaths'), 'actual recorded combat boundaries');
  assert(ticks > 0, 'actual combat steps');
  const result = { mode, phase, run, seed: 230, node: process.version, elapsedMs, commandMs, evidenceMs, ticks,
    commands: transcript.length, rounds, ...(phase === 'evidence' ? { transcript } : {}) };
  if (mode === 'after' || phase === 'timing') {
    const expected = reference;
    assert.equal(result.ticks, expected.ticks);
    assert.equal(result.commands, expected.commands);
    assert.deepEqual(rounds, expected.rounds.map(row => phase === 'evidence' ? row : (({ serializeSha256, ...plain }) => plain)(row)),
      'every completed round: complete state bytes and (in evidence runs) serializeMatch SHA-256');
    assert.deepEqual(transcript, expected.transcript, 'identical public commands');
  }
  write(`${mode}-${phase}${phase === 'timing' ? `-${run}` : ''}.json`, result);
  console.log(JSON.stringify({ mode, phase, run, elapsedMs, commandMs, evidenceMs, ticks, commands: transcript.length,
    checkpoints: rounds.length, facts: state.augmentHistory.facts.length }));
}

async function main() {
  if (process.argv[2] === '--worker') return worker(process.argv[3], process.argv[4], Number(process.argv[5]));
  const options = process.argv.slice(2);
  assert(options.every(arg => /^--(base=.+|runs=\d+)$/.test(arg)), 'usage: [--base=bc818fd8] [--runs=3]');
  const base = git(['rev-parse', '--verify', options.find(arg => arg.startsWith('--base='))?.slice(7) ?? 'bc818fd8']).toString().trim();
  const runs = Number(options.find(arg => arg.startsWith('--runs='))?.slice(7) ?? 3);
  assert(Number.isInteger(runs) && runs >= 1);
  fs.mkdirSync(directory, { recursive: true });
  fs.rmSync(path.join(directory, 'comparison.json'), { force: true });
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'augment-history-base-'));
  try {
    execFileSync('tar', ['-x', '-C', temporary], { input: git(['archive', base, 'src']) });
    const esbuild = require('esbuild');
    for (const [mode, source] of [['before', temporary], ['after', root]]) {
      await esbuild.build({ stdin: { contents: `export * from './src/simulation/match.ts';\nexport { serializeMatch } from './src/simulation/serialization.ts';`, resolveDir: source },
        outfile: path.join(directory, `${mode}.cjs`), bundle: true, platform: 'node', format: 'cjs', logLevel: 'warning' });
    }
    const simulationDiff = git(['diff', base, '--', 'src/simulation']);
    const metadata = { base, productionChanged: simulationDiff.length > 0, head: git(['rev-parse', 'HEAD']).toString().trim(), node: process.version, runs,
      simulationDiffSha256: sha(simulationDiff),
      driverSha256: sha(fs.readFileSync(path.join(root, 'scripts/generate-m5-route.cjs'))) };
    write('metadata.json', metadata);
    const execute = (mode, phase, run = 0) => execFileSync(process.execPath,
      [__filename, '--worker', mode, phase, String(run)], { cwd: root, stdio: 'inherit' });
    execute('before', 'evidence');
    execute('after', 'evidence');
    for (let run = 1; run <= runs; run++) for (const mode of run % 2 ? ['before', 'after'] : ['after', 'before']) execute(mode, 'timing', run);
    const median = values => {
      const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    };
    const timings = Object.fromEntries(['before', 'after'].map(mode => [mode,
      Array.from({ length: runs }, (_, index) => read(`${mode}-timing-${index + 1}.json`).commandMs)]));
    const beforeMs = median(timings.before), afterMs = median(timings.after);
    const report = { ...metadata, serializeCheckpoints: read('before-evidence.json').rounds.length,
      allRoundSerializeSha256Equal: true, timings, medianBeforeMs: beforeMs, medianAfterMs: afterMs,
      reductionPercent: (beforeMs - afterMs) * 100 / beforeMs,
      medianElapsedBeforeMs: median(Array.from({ length: runs }, (_, index) => read(`before-timing-${index + 1}.json`).elapsedMs)),
      medianElapsedAfterMs: median(Array.from({ length: runs }, (_, index) => read(`after-timing-${index + 1}.json`).elapsedMs)) };
    if (!metadata.productionChanged) report.timingInterpretation = 'A/A control: no production changes; timing differences are noise, not an optimization.';
    write('comparison.json', report);
    console.log(JSON.stringify(report, null, 2));
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
