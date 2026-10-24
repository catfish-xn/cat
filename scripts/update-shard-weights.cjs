#!/usr/bin/env node
// Rebuild tests/fixtures/shard-weights.json (read by vitest.config.ts to balance CI's
// fast-project shards) from a Vitest JSON report of a full fast-project run:
//   npx vitest run --project fast --reporter=json --outputFile=report.json
//   node scripts/update-shard-weights.cjs report.json
'use strict';
const { readFileSync, writeFileSync } = require('node:fs');
const { join, relative } = require('node:path');

const report = process.argv[2];
if (!report) { console.error('usage: node scripts/update-shard-weights.cjs <vitest-json-report>'); process.exit(2); }
const root = join(__dirname, '..');
const weights = {};
for (const file of JSON.parse(readFileSync(report, 'utf8')).testResults) {
  const seconds = Math.max(1, Math.round((file.endTime - file.startTime) / 1000));
  weights[relative(root, file.name).split('\\').join('/')] = seconds;
}
const sorted = Object.fromEntries(Object.entries(weights).sort(([a], [b]) => (a < b ? -1 : 1)));
writeFileSync(join(root, 'tests/fixtures/shard-weights.json'), JSON.stringify(sorted, null, 1) + '\n');
console.log(`${Object.keys(sorted).length} files written`);
