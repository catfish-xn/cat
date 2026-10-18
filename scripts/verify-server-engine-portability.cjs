/* Bounded architecture probe: ordinary Node bundle, no Vite/browser/server.
 * One existing public battle only. Not a performance or multiplayer acceptance.
 */
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'artifacts/server-authority-audit');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const bundle = path.join(out, 'engine-probe.mjs');
  const built = await require('esbuild').build({ absWorkingDir: root, stdin: {
    sourcefile: 'server-portability-probe.ts', resolveDir: root, loader: 'ts', contents: `
import assert from 'node:assert/strict';
import * as api from './src/simulation/match';
import { serializeMatch, restoreMatch } from './src/simulation/serialization';
import { BattleHistory, validateBattleRecord } from './src/replay/history';
import { PlaybackSession } from './src/replay/playback-session';
assert.equal(typeof window, 'undefined');
assert.equal(typeof document, 'undefined');
assert.equal(typeof indexedDB, 'undefined');
const initial = api.createMatch(42);
const rejected = api.buyUnit(initial, 0, initial.shop.generation + 1);
assert.equal(rejected.ok, false);
assert.equal(rejected.reason, 'stale-shop');
assert.equal(rejected.state, initial);
const start = api.startMatchCombat(initial);
assert.equal(start.ok, true);
const history = new BattleHistory('node-portability');
const combatEvents = events => events.filter(e => 'tick' in e);
history.observe({ before: initial, after: start.state, events: combatEvents(start.events), reason: 'command' });
let state = start.state;
const steps = [];
const checkpoints = new Map([[0, state]]);
while (state.phase === 'combat') {
  assert(state.combat.tick < 1201);
  const before = state, next = api.stepMatch(state);
  state = next.state; steps.push(next);
  history.observe({ before, after: state, events: combatEvents(next.events), reason: 'tick' });
  if ([39,40,41].includes(state.combat.tick)) checkpoints.set(state.combat.tick, state);
}
for (const [tick, checkpoint] of checkpoints) {
  const text = serializeMatch(checkpoint, []);
  const restored = restoreMatch(text, []);
  assert.deepStrictEqual(restored, checkpoint);
  assert.deepStrictEqual(restoreMatch(JSON.parse(text), []), checkpoint);
  let continued = restored;
  for (let i = tick; i < steps.length; i++) {
    const next = api.stepMatch(continued);
    assert.deepStrictEqual(next, steps[i]);
    continued = next.state;
  }
  assert.deepStrictEqual(continued, state);
}
assert.deepStrictEqual(restoreMatch(serializeMatch(state, history.completedRecords), history.completedRecords), state);
const bad = structuredClone(start.state); bad.contentDigest = 'forged';
assert.throws(() => restoreMatch(bad, history.completedRecords));
const record = history.completedRecords[0]; assert(record);
const verified = validateBattleRecord(record);
assert.deepStrictEqual(verified.terminal, state.combat);
assert.deepStrictEqual(verified.settledMatch, state);
assert.throws(() => validateBattleRecord({ ...record, events: record.events.slice(1) }));
const playback = new PlaybackSession(record);
assert.equal(playback.seek(40).tick, 40);
assert.deepStrictEqual(playback.seek(record.endTick).combat, state.combat);
playback.dispose();
console.log(JSON.stringify({ passed: true, node: process.version, browserGlobalsRequired: false,
  seed:42, ticks:state.combat.tick, events:record.events.length, result:state.combat.result,
  checkpoints:[...checkpoints.keys(),'end'], fullContinuationStateAndEvents:true,
  saveTextAndObject:true, rejectedStaleCommand:true, rejectedBadDigest:true,
  rejectedDroppedReplayEvent:true, replayValidationAndSeek:true,
  stateHash:record.stateHash, eventHash:record.eventHash }));
` }, bundle: true, platform: 'node', target: 'node22', format: 'esm', outfile: bundle, metafile: true, logLevel: 'error' });
  const inputs = Object.keys(built.metafile.inputs).sort();
  if (inputs.some(p => /src\/(rendering|presentation)\/|node_modules\/phaser\//.test(p))) throw Error('Browser implementation reached by engine probe');
  const result = JSON.parse(execFileSync(process.execPath, [bundle], { cwd: root, encoding: 'utf8', timeout: 60000 }));
  const report = { ...result, sha: git('rev-parse','HEAD'), srcTree:git('rev-parse','HEAD:src'),
    trackedSourceDiff:git('diff','HEAD','--','src'), dirty:git('status','--porcelain'),
    method:'esbuild platform=node target=node22; child node runs ordinary ESM; no Vite, browser, HTTP listener or network service',
    scope:'one existing public M8 battle; not multiplayer, load, production-server packaging or full historical acceptance',
    inputCount:inputs.length, bundledInputs:inputs };
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(out,'metafile.json'),JSON.stringify(built.metafile,null,2)+'\n');
  console.log(JSON.stringify({ ...result, inputCount:inputs.length, report:path.join(out,'report.json') },null,2));
})().catch(error => { console.error(error); process.exitCode = 1; });
