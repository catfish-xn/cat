#!/usr/bin/env node
// Rebuild tests/fixtures/shard-weights.json (read by vitest.config.ts to balance CI's
// fast-project shards) from a full fast-project run recorded by scripts/shard-weights-reporter.mjs:
//   SHARD_WEIGHTS_REPORT=report.json npx vitest run --project fast --reporter=default --reporter=./scripts/shard-weights-reporter.mjs
//   node scripts/update-shard-weights.cjs report.json
// (Vitest's JSON reporter is not used: its per-file times leave out beforeAll/afterAll hooks.)
'use strict';
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const report = process.argv[2];
if (!report) { console.error('usage: node scripts/update-shard-weights.cjs <shard-weights-reporter output>'); process.exit(2); }
const root = join(__dirname, '..');
const weights = {};
for (const [file, ms] of Object.entries(JSON.parse(readFileSync(report, 'utf8'))))
  weights[file] = Math.max(1, Math.round(ms / 1000));
const sorted = Object.fromEntries(Object.entries(weights).sort(([a], [b]) => (a < b ? -1 : 1)));
writeFileSync(join(root, 'tests/fixtures/shard-weights.json'), JSON.stringify(sorted, null, 1) + '\n');
console.log(`${Object.keys(sorted).length} files written`);
