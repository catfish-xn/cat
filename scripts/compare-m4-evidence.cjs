const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { hash } = require('./m4-evidence.cjs');
const [devDir = 'artifacts/m4-dev', previewDir = 'artifacts/m4-preview'] = process.argv.slice(2);
const read = directory => JSON.parse(fs.readFileSync(path.join(directory, 'report.json'), 'utf8'));
const dev = read(devDir), preview = read(previewDir);
assert(dev.passed && preview.passed, 'both complete browser gates must pass');
assert.equal(dev.mode, 'dev'); assert.equal(preview.mode, 'preview');
assert.deepEqual(dev.versions, preview.versions);
assert.equal(dev.seed, preview.seed);
assert.deepEqual(dev.rounds, preview.rounds, 'all desktop/touch round states, events, Mana and casts');
const checkpoints = report => report.checkpoints.filter(point => !point.volatile);
assert.deepEqual(checkpoints(dev), checkpoints(preview), 'all deterministic UI checkpoints');
const result = { passed: true, seed: dev.seed, versions: dev.versions,
  rounds: dev.rounds.length, checkpoints: checkpoints(dev).length,
  roundLedgerHash: hash(dev.rounds), checkpointHash: hash(checkpoints(dev)),
  dev: { sha: dev.sha, durationSeconds: dev.durationSeconds },
  preview: { sha: preview.sha, durationSeconds: preview.durationSeconds } };
for (const directory of [devDir, previewDir]) fs.writeFileSync(path.join(directory, 'oracle-report.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
