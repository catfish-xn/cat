/* Only accept the new B3 semantic digest: all commands, full event hashes and
 * every legacy campaign state (after restoring the old digest) must be identical. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const generate = require('./generate-m5-route.cjs');
const { hash } = require('./m4-evidence.cjs');
const file = 'tests/fixtures/m5/full-match-golden.json';
const baseline = '5bd7968ee31e107e12701145aa4fdac0bec7ea8d';

(async () => {
  // Feed `git show 5bd7968:tests/fixtures/m5/full-match-golden.json` on stdin.
  const input = fs.readFileSync(0, 'utf8');
  assert.equal(createHash('sha256').update(input).digest('hex'), '615f5dcee18cad1bf948216ed766ee2fddb101a9466bccce41611f72f990857d', `${baseline}: fixed source golden`);
  const old = JSON.parse(input);
  const next = structuredClone(old);
  for (const [build, expected] of Object.entries(old.routes)) {
    const normalizedStates = new Map();
    const route = await generate({ build, seed: expected.seed, onStep(before, result) {
      if (before.phase === 'combat' && result.state.phase !== 'combat') {
        normalizedStates.set(before.round, hash({ ...result.state, contentDigest: expected.versions.contentDigest }));
      }
    } });
    assert.deepEqual(route.actions.map(a => a.command), expected.commands, `${build}: unchanged commands`);
    assert.deepEqual(route.rounds.map(r => ({ round: r.round, stateHash: normalizedStates.get(r.round), eventsHash: r.eventsHash })), expected.rounds,
      `${build}: unchanged complete events and states except contentDigest`);
    next.routes[build].versions.contentDigest = route.initial.contentDigest;
    next.routes[build].rounds = route.rounds.map(r => ({ round: r.round, stateHash: r.stateHash, eventsHash: r.eventsHash }));
    console.log(`${build}: 30 complete event/state trajectories unchanged except contentDigest`);
  }
  next.note = (old.note ?? '') + ' B3 opening damage/control ordering revision: only contentDigest and its resulting state hashes change in these legacy campaigns. The guarded update checks all commands, complete event hashes, and state hashes normalized to the previous digest against 5bd7968; independent B3 lethal/surviving opening regressions verify the corrected behavior.';
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
