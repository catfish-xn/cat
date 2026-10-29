// Compare two mp-sim-perf-probe runs from separate source trees/processes.
// Native JSON bytes (including property/event order) must match. Room scheduling
// revisions are already excluded by the probe; no rules fields are excluded here.
// Actual public replay generation is intentionally outside the timed match run.
// Usage: node scripts/compare-bot-perf-evidence.cjs BEFORE_ROOT BEFORE_RUN AFTER_ROOT AFTER_RUN REPORT [42,7]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createGunzip, gunzipSync } = require('node:zlib');
const { createInterface } = require('node:readline');
const { build } = require('esbuild');

const sha = text => createHash('sha256').update(text).digest('hex');
const read = (directory, seed, kind) => gunzipSync(fs.readFileSync(path.join(directory, `seed-${seed}-${kind}.json.gz`)));
async function replayApi(root, output) {
  await build({ stdin: { resolveDir: path.resolve(root), contents:
    "export { toCombatReplay } from './src/simulation/combat-replay-view';" },
    bundle: true, platform: 'node', format: 'cjs', outfile: output });
  return require(output).toCombatReplay;
}
function lines(directory, seed) {
  const input = fs.createReadStream(path.join(directory, `seed-${seed}-ledger.ndjson.gz`)).pipe(createGunzip());
  return createInterface({ input, crlfDelay: Infinity });
}
function receiptBytes(terminal) {
  return JSON.stringify({ settlements: terminal.settlements, carouselLedger: terminal.carouselLedger,
    rewards: terminal.pool.rewards, carouselReceipts: terminal.pool.carouselReceipts,
    seats: terminal.seats.map(({ seatId, match }) => ({ seatId, roundResults: match.roundResults,
      resources: match.resourceProvenance, loot: match.m8.loot, mechanics: match.seatMechanics,
      history: match.augmentHistory })) });
}
async function main() {
  const [beforeRoot, beforeRun, afterRoot, afterRun, reportName, seedList = '42'] = process.argv.slice(2);
  assert(reportName, 'Usage: compare-bot-perf-evidence.cjs BEFORE_ROOT BEFORE_RUN AFTER_ROOT AFTER_RUN REPORT [42,7]');
  const report = path.resolve(reportName), directory = path.dirname(report);
  fs.mkdirSync(directory, { recursive: true });
  const beforeBundle = path.join(directory, 'before-replay.cjs'), afterBundle = path.join(directory, 'after-replay.cjs');
  const replayBefore = await replayApi(beforeRoot, beforeBundle);
  const replayAfter = await replayApi(afterRoot, afterBundle);
  const comparisons = [];
  for (const seed of seedList.split(',').map(Number)) {
    const terminal = read(beforeRun, seed, 'terminal'), terminalAfter = read(afterRun, seed, 'terminal');
    assert(terminal.equals(terminalAfter), `seed ${seed}: terminal bytes differ`);
    const matchEvents = read(beforeRun, seed, 'match-events');
    assert(matchEvents.equals(read(afterRun, seed, 'match-events')), `seed ${seed}: match event bytes differ`);
    const intentions = read(beforeRun, seed, 'steps');
    assert(intentions.equals(read(afterRun, seed, 'steps')), `seed ${seed}: intention bytes differ`);
    const beforeState = JSON.parse(terminal), afterState = JSON.parse(terminalAfter);
    const receipts = receiptBytes(beforeState);
    assert.equal(receiptBytes(afterState), receipts, `seed ${seed}: receipts differ`);
    const ledgerHash = createHash('sha256'), replayHash = createHash('sha256');
    const leftLines = lines(beforeRun, seed), rightLines = lines(afterRun, seed);
    const left = leftLines[Symbol.asyncIterator](), right = rightLines[Symbol.asyncIterator]();
    let battles = 0, replays = 0, events = 0, ticks = 0, initialUnitTicks = 0;
    const replaySummaries = [];
    try {
      for (;;) {
        const a = await left.next(), b = await right.next();
        assert.equal(a.done, b.done, `seed ${seed}: battle count differs`);
        if (a.done) break;
        assert.equal(a.value, b.value, `seed ${seed}: battle ${battles} bytes differ`);
        ledgerHash.update(a.value + '\n');
        const before = JSON.parse(a.value), after = JSON.parse(b.value);
        const inputs = result => result.kind === 'two-sided' ? [result.battle]
          : result.outcomes.flatMap(outcome => outcome.combat ? [outcome.combat] : []);
        const beforeInputs = inputs(before), afterInputs = inputs(after);
        for (let i = 0; i < beforeInputs.length; i++) {
          const input = beforeInputs[i];
          events += input.events.length; ticks += input.terminal.tick;
          initialUnitTicks += input.initial.units.length * input.terminal.tick;
          // Both APIs authenticate the complete ledger/terminal, then generate
          // all public frames. Compare their bytes, not just final frame hashes.
          const replay = JSON.stringify(replayBefore(input));
          assert.equal(JSON.stringify(replayAfter(afterInputs[i])), replay,
            `seed ${seed}: battle ${battles} replay ${i} differs`);
          replayHash.update(replay + '\n'); replays++;
          replaySummaries.push({ battleId: before.battleId, combatId: input.initial.combatId,
            ticks: input.terminal.tick, bytes: Buffer.byteLength(replay), sha256: sha(replay) });
        }
        battles++;
      }
    } finally { leftLines.close(); rightLines.close(); }
    comparisons.push({ seed, equivalent: true, round: beforeState.round, battles, replays, events, ticks, initialUnitTicks,
      matchEvents: JSON.parse(matchEvents).reduce((n, row) => n + row.events.length, 0), matchEventsSha256: sha(matchEvents),
      terminalBytes: terminal.length, terminalSha256: sha(terminal), ledgerSha256: ledgerHash.digest('hex'),
      intentionsSha256: sha(intentions), receiptsSha256: sha(receipts), replaySha256: replayHash.digest('hex'), replaySummaries });
    console.log(JSON.stringify({ seed, equivalent: true, battles, replays, events, ticks }));
  }
  fs.writeFileSync(report, JSON.stringify({ comparisons }, null, 2) + '\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
