/* Review b13373c6's manifest refresh and the new v16-only recording, without Git writes. */
const fs = require('node:fs'), cp = require('node:child_process'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto'), { gunzipSync } = require('node:zlib');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const archived = (commit, path) => cp.execFileSync('git', ['show', commit + ':' + path], { maxBuffer: 16 * 1024 * 1024 });
const path = 'tests/fixtures/v16-herald-raw/manifest.json';
const beforeBytes = archived('b13373c6^', path), refreshedBytes = archived('b13373c6', path), currentBytes = fs.readFileSync(path);
const before = JSON.parse(beforeBytes), refreshed = JSON.parse(refreshedBytes), current = JSON.parse(currentBytes);
const changes = (a, b) => Object.keys(b).filter(key => JSON.stringify(a[key]) !== JSON.stringify(b[key]));
assert.deepEqual(changes(before, refreshed), ['sourceSha256', 'sources']);
assert.deepEqual(changes(refreshed, current), ['sourceSha256', 'sources']);
const oldAudit = JSON.parse(archived('b13373c6', 'docs/evidence/v16/input-fixture-audit.json'));
assert.equal(oldAudit.files[path].currentSha256, sha(beforeBytes));
for (const file of ['trajectory.json', ...current.cases.map(entry => entry.file)]) {
  const filePath = 'tests/fixtures/v16-herald-raw/' + file;
  assert.deepEqual(archived('b13373c6^', filePath), archived('b13373c6', filePath));
  assert.deepEqual(archived('b13373c6', filePath), fs.readFileSync(filePath));
}
assert.equal(JSON.parse(fs.readFileSync('docs/evidence/v16/input-fixture-audit.json')).files[path].currentSha256, sha(currentBytes));
const checkpoints = {};
for (const build of ['cannon', 'sniper']) {
  const file = `tests/fixtures/v16-recorded-states/${build}.json.gz`;
  const a = archived('b13373c6', file), b = fs.readFileSync(file);
  assert.deepEqual(gunzipSync(a), gunzipSync(b));
  checkpoints[build] = { decompressedBytesEqual: true, oldGzipSha256: sha(a), currentGzipSha256: sha(b),
    changedGzipByteOffsets: Array.from({ length: Math.max(a.length, b.length) }, (_, i) => i).filter(i => a[i] !== b[i]) };
}
const report = { beforeRefreshSha256: sha(beforeBytes), b13373c6Sha256: sha(refreshedBytes), currentSha256: sha(currentBytes),
  b13373c6ChangedFields: changes(before, refreshed),
  b13373c6ChangedSources: changes(before.sources, refreshed.sources), currentChangedSources: changes(refreshed.sources, current.sources),
  rawCasesAndTrajectoryByteIdentical: true, checkpoints };
fs.writeFileSync('docs/evidence/v16/premerge-265-herald-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
