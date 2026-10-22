// Offline eight-bot reproduction. Baseline comes from local Git objects, never a checkout/network request.
// node scripts/settlement-slices-probe.cjs [baseline-ref=2de5e26d] [output=artifacts/settlement-slices]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const execFile = require('node:util').promisify(require('node:child_process').execFile);
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const ref = process.argv[2] || '2de5e26d';
const output = path.resolve(process.argv[3] || path.join(root, 'artifacts/settlement-slices'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const slowSummary = rows => ({ count: rows.length, maxMs: Math.max(0, ...rows.map(r => r.ms)),
  top10: [...rows].sort((a, b) => b.ms - a.ms).slice(0, 10) });
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'settlement-slices-'));
let context = null;
async function run(label, source) {
  const file = path.join(temp, label + '.cjs');
  // Instrument only the probe bundle: production source never reads a real clock in the rules.
  await esbuild.build({ stdin: { contents: `
    export { ManualClock } from './src/server/room/clock';
    export { Room, ROOM_TIMING_DEFAULTS } from './src/server/room/room';
    export { BotDriver } from './src/server/room/bot-driver';
    export { TwoSidedBattleResolver } from './src/server/room/two-sided-resolver';
  `, resolveDir: source }, bundle: true, platform: 'node', format: 'cjs', outfile: file,
    plugins: [{ name: 'settlement-timing', setup(build) {
      build.onLoad({ filter: /simulation\/shared-pool\.ts$/ }, args => {
        const text = fs.readFileSync(args.path, 'utf8').replace('export function runSharedMatchCommand(', 'function measuredSharedMatchCommand(');
        return { contents: text + `\nexport function runSharedMatchCommand(...args: Parameters<typeof measuredSharedMatchCommand>) {
          const start = performance.now();
          try { return measuredSharedMatchCommand(...args); }
          finally { globalThis.__settlementProbe?.(args[2].type, performance.now() - start); }
        }`, loader: 'ts' };
      });
    } }], logLevel: 'warning' });
  const { Room, ManualClock, ROOM_TIMING_DEFAULTS, BotDriver, TwoSidedBattleResolver } = require(file);
  const clock = new ManualClock(), timings = new Map(), callbacks = [], checkpoints = [], steps = [];
  const row = round => {
    if (!timings.has(round)) timings.set(round, { round, stepMs: 0, stepCalls: 0, planMs: 0, liveMs: 0, commitMs: 0, advanceMs: 0 });
    return timings.get(round);
  };
  globalThis.__settlementProbe = (type, ms) => {
    if (context && type === 'step' && ['plan', 'planSteps', 'settleLive', 'settleLiveSteps'].includes(context.name)) {
      const r = row(context.round); r.stepMs += ms; r.stepCalls++;
    }
  };
  for (const [name, key] of [['plan','planMs'], ['planSteps','planMs'], ['settleLive','liveMs'], ['settleLiveSteps','liveMs'], ['commitSettlement','commitMs'], ['advanceRound','advanceMs']]) {
    const original = Room.prototype[name]; if (!original) continue;
    Room.prototype[name] = function(...args) {
      const round = this.state.round;
      const measured = fn => { const previous = context, started = performance.now(); context = { name, round };
        try { return fn(); } finally { row(round)[key] += performance.now() - started; context = previous; } };
      if (name.endsWith('Steps')) {
        const iterator = original.apply(this, args);
        return { next: () => measured(() => iterator.next()), [Symbol.iterator]() { return this; } };
      }
      // Current plan() drains planSteps(); only measure the generator on that build.
      return name === 'plan' && Room.prototype.planSteps ? original.apply(this, args) : measured(() => original.apply(this, args));
    };
  }
  const seats = Array.from({ length: 8 }, (_, i) => ({ seatId: `b${i}`, name: `bot${i}`, kind: 'bot' }));
  const room = new Room(seats, { ...ROOM_TIMING_DEFAULTS, roomId: 'probe', seed: 42, clock,
    resolver: new TwoSidedBattleResolver(), sliceTicks: 100, sliceMs: 20, sliceNow: () => performance.now() });
  const bots = new BotDriver(room, 42, { onStep: record => steps.push(record) });
  let operated = -1, recorded = 0;
  room.subscribe(state => {
    if (state.settlements.length > recorded) { recorded = state.settlements.length; checkpoints.push(state); }
  });
  const started = performance.now();
  try {
    room.start();
    for (let n = 0; room.state.phase !== 'ended' && n < 200000; n++) {
      if (room.state.phase === 'battle' && room.state.roundKind === 'pve' && operated !== room.state.round) {
        operated = room.state.round;
        const seat = room.state.seats.find(s => s.alive);
        assert(room.handle(seat.seatId, { type: 'shopLock', locked: !seat.match.shop.locked, generation: seat.match.shop.generation }).ok);
      }
      const round = room.state.round, phase = room.state.phase, start = performance.now();
      assert(clock.fireNext());
      callbacks.push({ round, phase, ms: performance.now() - start });
    }
    assert.equal(room.state.phase, 'ended'); assert.equal(room.state.fault, null); assert(room.state.round >= 31);
    const durationMs = performance.now() - started;
    // Serialization is deliberately outside the measured callbacks. All global fields, all seats, every
    // round's complete battle events and receipts are compared as bytes; no scheduling fields are stripped.
    const checkpointHash = createHash('sha256');
    for (const state of checkpoints) checkpointHash.update(JSON.stringify(state) + '\n');
    const result = { label, seed: 42, round: room.state.round, durationMs,
      terminalSha256: sha(JSON.stringify(room.state)), checkpointsSha256: checkpointHash.digest('hex'),
      botStepsSha256: sha(JSON.stringify(steps)),
      timings: [...timings.values()].map(r => ({ ...r,
        longestBattleCallbackMs: Math.max(0, ...callbacks.filter(t => t.round === r.round && t.phase === 'battle').map(t => t.ms)) })),
      // Keep unrelated compilation/GC outliers visible; do not claim the whole process has a hard 50 ms bound.
      otherSlowCallbacks: callbacks.filter(t => t.phase !== 'battle' && t.ms > 50) };
    fs.writeFileSync(path.join(output, label + '.json'), JSON.stringify(result, null, 2));
    console.error(JSON.stringify({ label, round: result.round, timings: result.timings.filter(r => [2,10,17,24,31].includes(r.round)) }));
    return result;
  } finally { bots.dispose(); room.dispose(); delete globalThis.__settlementProbe; }
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const baselineRoot = path.join(temp, 'baseline'); fs.mkdirSync(baselineRoot);
  const archive = path.join(temp, 'baseline.tar');
  await execFile('git', ['archive', '--output=' + archive, ref, 'src'], { cwd: root });
  await execFile('tar', ['-xf', archive, '-C', baselineRoot]);
  const before = await run('before', baselineRoot), after = await run('after', root);
  for (const key of ['terminalSha256', 'checkpointsSha256', 'botStepsSha256']) assert.equal(after[key], before[key], key);
  fs.writeFileSync(path.join(output, 'comparison.json'), JSON.stringify({ baseline: ref, node: process.version,
    cpu: os.cpus()[0].model, deterministic: true, terminalSha256: after.terminalSha256,
    checkpointsSha256: after.checkpointsSha256, botStepsSha256: after.botStepsSha256,
    otherSlowCallbacks: { before: slowSummary(before.otherSlowCallbacks), after: slowSummary(after.otherSlowCallbacks) },
    rounds: [2,10,17,24,31].map(round => ({ round, before: before.timings.find(r => r.round === round), after: after.timings.find(r => r.round === round) })) }, null, 2));
  console.log('PASS: terminal, every global settlement checkpoint (including full battle ledgers), and bot intentions are byte-identical.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => fs.rmSync(temp, { recursive: true, force: true }));
