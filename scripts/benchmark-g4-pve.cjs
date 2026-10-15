#!/usr/bin/env node
// Differential PvE probe: actual public shared-pool commands, hashes every result.
// Timing excludes hashing/immutability assertions; no thresholds or source patching.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const root = path.resolve(process.argv[2] ?? path.join(__dirname, '..'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'g4-pve-'));
const accept = result => { assert.equal(result.ok, true, result.reason); return result; };
try {
  const outfile = path.join(temp, 'rules.cjs');
  require('esbuild').buildSync({ absWorkingDir: root, entryPoints: ['src/server-entry/index.ts'],
    outfile, bundle: true, platform: 'node', format: 'cjs', target: 'node22', logLevel: 'error' });
  const api = require(outfile), rows = [];
  for (const seed of [42, 9, 11]) {
    let pool = api.createSharedPool('g4-pve', seed), states = [];
    for (let i = 0; i < 8; i++) {
      const result = accept(api.initializeSharedSeat(pool, api.createMatch(5 + i, { mode: 'shared-deferred' }), `s${i}`, i));
      pool = result.pool; states.push(result.state);
    }
    const initial = accept(api.refreshSharedShops(pool, states, 1)); pool = initial.pool; states = initial.states;
    const hashes = { state: createHash('sha256'), events: createHash('sha256') };
    let commandMs = 0, ticks = 0, rewards = 0;
    const run = (index, command) => {
      const state = states[index], before = JSON.stringify({ pool, state }), started = performance.now();
      const result = api.runSharedMatchCommand(pool, state, command);
      commandMs += performance.now() - started;
      assert.equal(JSON.stringify({ pool, state }), before, 'input mutated');
      accept(result); pool = result.pool; states[index] = result.state;
      hashes.state.update(JSON.stringify({ pool, state: result.state }));
      hashes.events.update(JSON.stringify([result.events, result.poolEvents]));
      rewards += result.poolEvents.filter(e => e.type === 'sharedRewardResolved').length;
    };
    for (let i = 0; i < 8; i++) {
      run(i, { type: 'startCombat' });
      while (states[i].phase === 'combat') { assert(ticks++ < 10000); run(i, { type: 'step' }); }
    }
    assert(rewards > 0, 'must include real PvE unit rewards');
    const started = performance.now();
    for (let i = 0; i < 1000; i++) api.assertSharedPoolConservation(pool, states);
    rows.push({ seed, ticks, rewards, commandMs, validation1000Ms: performance.now() - started,
      stateSha256: hashes.state.digest('hex'), eventSha256: hashes.events.digest('hex') });
  }
  console.log(JSON.stringify({ node: process.version, rows }, null, 2));
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
