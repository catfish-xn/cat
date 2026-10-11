const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
/** Every recorded before/after/final Match state of a docs/evidence/m8-b9/golden new-<build> route (gzip JSON). */
exports.goldenStates = build => {
  const route = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, '../../docs/evidence/m8-b9/golden', `new-${build}.json.gz`))).toString('utf8'));
  return [...route.rounds.flatMap(round => [round.before, round.after]), route.final];
};
