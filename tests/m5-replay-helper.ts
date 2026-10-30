import { gzipSync, gunzipSync } from 'node:zlib';
import { beforeAll, describe, it } from 'vitest';
import assert from './fixtures/m5/assert-equal.cjs';
import * as api from '../src/simulation/match';
import { restoreMatch } from '../src/simulation/serialization';
import { prepareAugmentHistoryReplay } from '../src/simulation/augment-history-restore';
import { run, dispatch } from '../scripts/generate-m5-route.cjs';
import { routeOptions } from '../scripts/v25-online-rules-route.cjs';

// A file owns one ordinary, oracle-checked route. Store only compressed chunk
// boundaries and inputs, never restore/validation results. Each case can run on
// its own (including -t filtering); no case depends on a previous case passing.
const STEPS_PER_CASE = 8;
type Command = Parameters<typeof dispatch>[2];
interface Chunk {
  first: number;
  before: Buffer;
  after: Buffer;
  inputs: (Command | undefined)[];
}
let checkpointMilliseconds = 0;
function pack(state: api.MatchState): Buffer {
  const started = performance.now();
  const packed = gzipSync(JSON.stringify(state), { level: 1 });
  checkpointMilliseconds += performance.now() - started;
  return packed;
}
function unpack(bytes: Buffer): api.MatchState {
  return JSON.parse(gunzipSync(bytes).toString());
}

export async function defineReplayTests(build: string) {
  const started = performance.now();
  const previousCheckpointMilliseconds = checkpointMilliseconds;
  console.log(`M5 replay ${build}: cache oracle route`);
  const chunks: Chunk[] = [];
  let commands = 0, ticks = 0, steps = 0;
  let chunk: Chunk | undefined;
  let last: api.MatchState = api.createMatch(42);
  // Collection builds this route once per file, outside all test/hook timeouts.
  // run still performs its independent ledger/shop/RNG assertions on every step.
  // Match the v25 recorder/browser route's public rerolls. The default policy
  // selects history-only augments (cannon: scavenger; mage: trait-tracker).
  // JSON checkpoints reset the pre-acquisition solo trace, changing proof origin
  // and commands even when every gameplay field is equal.
  await run(api, { build, seed: 42, ...routeOptions(build, 42), onStep(before, result, command) {
    if (!chunk) chunk = { first: steps, before: pack(before), after: Buffer.alloc(0), inputs: [] };
    chunk.inputs.push(command);
    last = result.state;
    steps++;
    if (command) commands++; else ticks++;
    if (chunk.inputs.length === STEPS_PER_CASE) {
      chunk.after = pack(last);
      chunks.push(chunk);
      chunk = undefined;
    }
  } });
  if (chunk) {
    chunk.after = pack(last);
    chunks.push(chunk);
  }
  assert.equal(last.phase, 'gameOver');
  assert(commands > 100); assert(ticks > 1000);
  assert.equal(chunks.reduce((sum, entry) => sum + entry.inputs.length, 0), commands + ticks);
  assert.equal(chunks.reduce((sum, entry) => sum + entry.inputs.filter(Boolean).length, 0), commands);
  assert.equal(chunks.reduce((sum, entry) => sum + entry.inputs.filter(input => !input).length, 0), ticks);
  console.log(JSON.stringify({ replay: build, commands, ticks, cases: chunks.length,
    routeSeconds: (performance.now() - started) / 1000,
    checkpointSeconds: (checkpointMilliseconds - previousCheckpointMilliseconds) / 1000 }));

  for (const entry of chunks) {
    describe(`independent replay fixture at ${entry.first + 1}`, () => {
      let preparation: ReturnType<typeof prepareAugmentHistoryReplay> | undefined, ready = false;
      beforeAll(() => { preparation = prepareAugmentHistoryReplay(unpack(entry.before)); });
      // A filtered late case still needs its cold historical fixture. Resume
      // the real validator in bounded setup slices; do not replay the whole
      // match synchronously inside a 5 s assertion case. No live route result
      // or candidate admission seeds the production evidence cache.
      for (let part = 0; part <= Math.ceil(entry.first / 256); part++) beforeAll(() => {
        if (!ready) ready = preparation!.next().done === true;
      });
      beforeAll(() => { assert(ready, 'independent historical fixture completed'); preparation = undefined; });
      it(`M5 ${build} steps ${entry.first + 1}-${entry.first + entry.inputs.length}: restore and rejected insertions preserve every field`, () => {
        // The reference advances through ordinary commands from the exact cached
        // route boundary. The restored path advances separately through restoreMatch.
        const first = entry.first === 0, last = entry === chunks.at(-1);
        let before = unpack(entry.before);
        // Assign the preceding segment's final restore to this case. This keeps
        // every rejected insertion on a real restored state (including frozen
        // metadata), with exactly one restore per original command/tick overall.
        let restored = first ? api.createMatch(42) : restoreMatch(JSON.stringify(before));
        for (const [index, command] of entry.inputs.entries()) {
          const result = command ? dispatch(api, before, command) : api.stepMatch(before);
          assert.deepEqual(restored, before);
          const frozen = JSON.stringify(restored);
          const failures = [api.buyUnit(restored, -1, restored.shop.generation), api.sellUnit(restored, 'absent'),
            api.selectChoice(restored, 'stale', -1, 'absent'), api.nextRound(restored, -1)];
          for (const failed of failures) {
            assert.equal(failed.ok, false); assert.equal(failed.state, restored); assert.equal('events' in failed, false);
          }
          assert.equal(JSON.stringify(restored), frozen);
          const second = command ? dispatch(api, restored, command) : api.stepMatch(restored);
          assert.deepEqual(second, result);
          if (index === entry.inputs.length - 1 && !last) {
            // The next case restores these exact bytes, independently of this
            // case passing. Bind its cached candidate to the dispatched result.
            assert.equal(JSON.stringify(second.state), gunzipSync(entry.after).toString());
            restored = second.state;
          } else {
            restored = restoreMatch(JSON.stringify(second.state));
            assert.deepEqual(restored, second.state);
          }
          before = result.state;
        }
        // Bind the independently replayed chunk back to the original oracle route.
        assert.deepEqual(before, unpack(entry.after));
        assert.deepEqual(restored, unpack(entry.after));
        if (last) {
          assert.equal(restored.phase, 'gameOver'); assert(commands > 100); assert(ticks > 1000);
          console.log(JSON.stringify({ replay: build, commands, ticks,
            durationSeconds: (performance.now() - started) / 1000, passed: true }));
        }
      });
    });
  }
}
