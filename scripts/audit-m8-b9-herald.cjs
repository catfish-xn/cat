/* B9 Herald raw-fixture migration evidence. Old bytes are read from the node-one merge base (git history), new bytes
 * from the regenerated fixtures (scripts/verify-m8-herald-fixtures.cjs --write). Raw Match states may differ only in the
 * version/digest/event-sequence/ledger-length fields (same classifier as the golden audit); the trajectory may differ
 * only in hashes and ledger lengths, with identical commands, rounds and battle results otherwise.
 *   node scripts/audit-m8-b9-herald.cjs            writes docs/evidence/m8-b9/herald-diff.json */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const { leafDifferences, classify } = require('./update-m8-b9-golden.cjs');
const ROOT = path.resolve(__dirname, '..'), BASE = '52413d0dbb931bbeae2b988c7fedc0f6427e4a12', DIR = 'tests/fixtures/m8-herald-raw';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const RAW = ['ionic-spark.json', 'evenshroud.json', 'ionic-spark--evenshroud.json', 'quicksilver.json', 'edge-of-night.json'];
const TRAJECTORY_PATHS = [/\/(eventsSha256|resultSha256|startSha256|afterSha256|beforeSha256|rawStateSha256|eventsHash|stateHash|afterHash|beforeHash|rawPrefixSha256)$/, /\/result\/combatEventCount$/];
const report = { base: BASE, generator: 'scripts/verify-m8-herald-fixtures.cjs --write', files: {} };
for (const file of [...RAW, 'trajectory.json']) {
  const oldBytes = execFileSync('git', ['show', `${BASE}:${DIR}/${file}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }), newBytes = fs.readFileSync(path.join(ROOT, DIR, file));
  const diffs = leafDifferences(JSON.parse(oldBytes), JSON.parse(newBytes));
  let classes;
  if (file === 'trajectory.json') {
    for (const d of diffs) assert(TRAJECTORY_PATHS.some(p => p.test(d.path)), `UNKNOWN trajectory difference ${d.path}`);
    classes = { hashOrLedgerLength: diffs.length };
  } else classes = classify(diffs, file);
  report.files[file] = { oldSha256: sha(oldBytes), newSha256: sha(newBytes), classes,
    paths: [...new Set(diffs.map(d => d.path.replace(/\/\d+(?=\/|$)/g, '/N')))].sort() };
}
fs.mkdirSync(path.join(ROOT, 'docs/evidence/m8-b9'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/evidence/m8-b9/herald-diff.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.files).map(([f, r]) => [f, r.classes]))));
