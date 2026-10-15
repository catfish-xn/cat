/* Audit regenerated P7 inputs against archived G2 bytes; never execute an old tree. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const previous = require('../tests/g2-1-content-baseline.json');
const current = require('../tests/p7-content-baseline.json');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const normalize = value => JSON.parse(JSON.stringify(value), (_, v) => v === previous.contentDigest ? current.contentDigest : v);
assert.equal(current.lootReplayDigest, previous.lootReplayDigest);
const pairs = [
  ['tests/fixtures/c19-seed-9-minimal.json', 'tests/fixtures/p7-c19-seed-9-minimal.json'],
  ...['ionic-spark', 'evenshroud', 'ionic-spark--evenshroud', 'quicksilver', 'edge-of-night'].map(name =>
    [`tests/fixtures/g2-1-herald-raw/${name}.json`, `tests/fixtures/p7-herald-raw/${name}.json`]),
];
const files = pairs.map(([beforePath, afterPath]) => {
  const before = fs.readFileSync(beforePath), after = fs.readFileSync(afterPath);
  const normalized = normalize(JSON.parse(before));
  assert.deepEqual(JSON.parse(after), normalized, `${afterPath}: only the explicit identity may change`);
  let offset = 0;
  while (offset < Math.min(before.length, after.length) && before[offset] === after[offset]) offset++;
  return { beforePath, afterPath, previousBytes: before.length, currentBytes: after.length,
    previousSha256: sha(before), currentSha256: sha(after), byteEqual: before.equals(after),
    firstByteOffset: before.equals(after) ? null : offset, equalAfterExplicitIdentityReplacement: true };
});
const result = { baseline: 'multiplayer@cf75fbc', contentDigest: current.contentDigest,
  previousContentDigest: previous.contentDigest, lootReplayDigest: current.lootReplayDigest, files };
const output = JSON.stringify(result, null, 2) + '\n';
const path = 'docs/evidence/p7/fixture-byte-evidence.json';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(path, 'utf8'), output);
else fs.writeFileSync(path, output);
console.log(JSON.stringify({ files: files.length, passed: true, contentDigest: current.contentDigest }));
