const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
/** Public-route before/after/final states re-recorded after G2-1; historical B9 evidence stays archived. */
exports.goldenStates = build => {
  const recording = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'v23-online-rules-recorded-states', `${build}.json.gz`))).toString('utf8'));
  return recording.states;
};
