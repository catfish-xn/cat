/* Local 14.24 archive only. Missing execution data cannot prove hidden visibility. */
const fs = require('node:fs'), zlib = require('node:zlib'), { createHash } = require('node:crypto');
const directory = 'src/simulation/content/source/s13-14.24b/raw/';
const file = 'map22.bin.json.gz', bytes = fs.readFileSync(directory + file);
const map = JSON.parse(zlib.gunzipSync(bytes));
const entry = map['{cf1ee294}'], tooltip = map[entry['{900aff58}']];
const refs = entry['{4e874e78}'];
const report = {
  source: directory + file, sha256: createHash('sha256').update(bytes).digest('hex'),
  pointer: '{cf1ee294}', name: entry.name, fields: Object.keys(entry), tooltip,
  effectAmounts: entry.effectAmounts,
  executionReferences: refs.map(pointer => ({ pointer, resolvedInArchive: Object.hasOwn(map, pointer) })),
  originalOpponentVisibility: 'unknown',
  reason: 'The retained metadata archive lacks the referenced execution records and client/network star-display replication data. Rank-4 ability values and upgrade description do not establish scouting visibility.',
  currentProjection: 'Keep publicBoard.starLevel physical 3; no inferred effectiveStarLevel. This is a conservative project fallback, not a claim that the original client hides rank 4.',
};
const out = 'docs/evidence/v16/scouting-visibility-audit.json';
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
