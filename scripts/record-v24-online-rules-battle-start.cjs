/* Recreate #402's public one-human/seven-bot scenario at the current epoch.
 * No restored old room or patched identity is used as generation input. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readProcessOutput } = require('./offline-process-output.cjs');
const sha = x => createHash('sha256').update(x).digest('hex');
const base = 'c71854917e9995e5e2d0ec7dc3a023c813a936ac';
const target = 'tests/server/fixtures/battle-start.json';
async function main() {
  assert(process.argv.slice(2).every(x => x === '--check'));
  const built = await require('esbuild').build({ stdin: { contents: `
    export { Room, ROOM_TIMING_DEFAULTS } from './src/server/room/room';
    export { ManualClock } from './src/server/room/clock';
    export { BotDriver } from './src/server/room/bot-driver';
    export { TwoSidedBattleResolver } from './src/server/room/two-sided-resolver';
    export { CAROUSEL_RULES_BINDING } from './src/server/room/carousel';
  `, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', write: false });
  const dir = path.resolve('artifacts/v24-online-rules-recording'); fs.mkdirSync(dir, { recursive: true });
  const bundle = path.join(dir, 'battle-start.cjs'); fs.writeFileSync(bundle, built.outputFiles[0].contents);
  const { Room, ROOM_TIMING_DEFAULTS, ManualClock, BotDriver, TwoSidedBattleResolver, CAROUSEL_RULES_BINDING } = require(bundle);
  // First seed from 20261012 whose real round-23 checkpoint has an odd alive
  // roster and at least seven fielded units per survivor (mirror and full-board tests).
  const seed = 20261013, clock = new ManualClock();
  const seats = Array.from({ length: 8 }, (_, i) => ({ seatId: i ? `bot-${i}` : 'seat-1', name: `s${i}`, kind: i ? 'bot' : 'human' }));
  const options = clock => ({ ...ROOM_TIMING_DEFAULTS, roomId: 'room-1', seed, clock,
    resolver: new TwoSidedBattleResolver(), combatStreaming: true, sliceTicks: 100, sliceMs: 20,
    sliceNow: () => 0, assertPoolConservation: true, carousel: CAROUSEL_RULES_BINDING });
  const room = new Room(seats, options(clock)), bots = new BotDriver(room, seed), checkpoints = [];
  const freeze = room.freezeAndResolve.bind(room);
  room.freezeAndResolve = () => {
    if ([3, 9, 23].includes(room.state.round)) {
      checkpoints.push({ seed, time: clock.now(), state: structuredClone(room.state) });
      console.log(JSON.stringify({ captured: room.state.round, time: clock.now() }));
    }
    freeze();
  };
  try {
    room.start();
    for (let n = 0; checkpoints.length < 3 && n < 200000; n++) {
      assert.equal(room.state.fault, null); assert.notEqual(room.state.phase, 'ended');
      const human = room.state.seats[0];
      if (room.state.phase === 'preparation' && human.alive && human.match.phase === 'preparation') {
        while (room.state.seats[0].match.gold >= 4 && room.state.seats[0].match.level < 10)
          assert.equal(room.handle('seat-1', { type: 'buyXp' }).ok, true);
      }
      assert(clock.fireNext());
    }
    assert.equal(checkpoints.length, 3);
  } finally { bots.dispose(); room.dispose(); }
  const alive = checkpoints[2].state.seats.filter(s => s.alive);
  assert(alive.length >= 5 && alive.length % 2 === 1, 'Round 23 must include a mirror');
  assert(alive.every(s => s.match.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').length >= 7), 'Round 23 survivors have full boards');
  function fingerprint(r) {
    return sha(JSON.stringify({ state: r.state, inputs: r.frozenInputs,
      streams: [...r.streams].map(([id, s]) => ({ id, initial: s.initial, frames: s.frames,
        terminal: s.terminal, ledger: s.ledger, mapping: s.mapping })) }));
  }
  function replay(cp, synchronous) {
    const c = new ManualClock(cp.time), r = new Room(cp.state.seats, options(c));
    r.current = structuredClone(cp.state);
    // Drain the very same initialization generator in one call; scheduler yields
    // carry no state changes. Compare all state/input/frame/ledger bytes below.
    if (synchronous) {
      const open = r.openStreamSteps.bind(r);
      r.openStreamSteps = function* () { const steps = open(); while (!steps.next().done) {} };
    }
    try {
      r.freezeAndResolve();
      for (let n = 0; r.combatInitializationPending && n < 1000; n++) assert(c.fireNext());
      assert.equal(r.state.phase, 'battle'); assert.equal(r.state.fault, null);
      assert.equal(c.now(), cp.time);
      const initialHash = fingerprint(r);
      while (r.committedBattleTick === 0) assert(c.fireNext());
      assert.equal(c.now(), cp.time + 50);
      return { initialHash, firstHash: fingerprint(r) };
    } finally { r.dispose(); }
  }
  for (const cp of checkpoints) {
    cp.expected = replay(cp, true);
    assert.deepEqual(replay(cp, false), cp.expected, `round ${cp.state.round}: sliced/unsliced tick0/1`);
    cp.expected.boardCounts = cp.state.seats.filter(s => s.alive).map(s => s.match.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').length);
  }
  const bytes = JSON.stringify({ source: `v24-online-rules, integrated source ${base}; scripts/record-v24-online-rules-battle-start.cjs. Natural public Room progression, seed ${seed}, one human buying XP and seven BotDriver seats; tick0/1 independently compared against synchronous initialization. Replaces historical 9d9ea671 baseline without using its snapshots as input.`, checkpoints }) + '\n';
  const previous = readProcessOutput('git', ['show', `${base}:${target}`]);
  let first = 0; const current = Buffer.from(bytes); while (first < Math.min(previous.length, current.length) && previous[first] === current[first]) first++;
  const sources = ['scripts/record-v24-online-rules-battle-start.cjs', ...readProcessOutput('git', ['ls-files', 'src/simulation', 'src/server']).toString().trim().split('\n')];
  const audit = { baseCommit: base, sourceDigests: Object.fromEntries(sources.map(p => [p, sha(fs.readFileSync(p))])), previousBytes: previous.length, currentBytes: current.length, previousSha256: sha(previous), currentSha256: sha(current), firstDifferentByte: first,
    checkpoints: checkpoints.map(cp => ({ round: cp.state.round, time: cp.time, ...cp.expected, slicedEqualsSynchronous: true })) };
  for (const [p, data] of [[target, bytes], ['docs/evidence/v24-online-rules/battle-start-audit.json', JSON.stringify(audit, null, 2) + '\n']]) {
    if (process.argv.includes('--check')) assert.equal(fs.readFileSync(p, 'utf8'), data, p);
    else { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); }
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
