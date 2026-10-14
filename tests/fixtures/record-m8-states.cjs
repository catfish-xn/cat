// Re-record restore-equivalence inputs using public commands; never rewrite saved identities.
// Run from the repository root: node tests/fixtures/record-m8-states.cjs
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const generate = require('../../scripts/generate-m5-route.cjs');

async function record() {
  const folder = path.join(__dirname, 't12-recorded-states');
  fs.mkdirSync(folder, { recursive: true });
  for (const build of ['cannon', 'sniper']) {
    const route = await generate({ build, seed: 42, retainStates: true });
    const states = [...route.rounds.flatMap(round => [round.before, round.after]), route.final];
    assert(states.every(state => state.contentDigest === 'fnv1a32-utf16:44fe9c0e'));
    const recording = { build, seed: 42, contentDigest: 'fnv1a32-utf16:44fe9c0e', actions: route.actions, states };
    fs.writeFileSync(path.join(folder, `${build}.json.gz`), zlib.gzipSync(JSON.stringify(recording), { level: 9 }));
    console.log(`${build}: ${states.length} states, ${route.actions.length} commands, ${route.final.outcome}`);
  }
}
record().catch(error => { console.error(error); process.exitCode = 1; });
