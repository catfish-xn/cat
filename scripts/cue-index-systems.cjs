#!/usr/bin/env node
// The system ids each champion's exported cue list names, read from an asset root's vfx-ltk folder the way the game's
// loader reads it (index.json skills, then each champion package's skills). Only ids: no emitter names, bones, times or
// any other asset property. tests/vfx-ltk-cue-dropped.test.ts checks the CUE_OVERRIDES drop registry against the
// committed copy (tests/fixtures/cue-index-systems.json) in CI, and that copy against the assets when VFX_LTK_ROOT is set.
//
// Regenerate after the asset snapshot changes:
//   node scripts/cue-index-systems.cjs <asset root>/vfx-ltk <snapshot id>
const fs = require('node:fs');
const path = require('node:path');

const FIXTURE = path.join(__dirname, '..', 'tests', 'fixtures', 'cue-index-systems.json');

/** { champion: sorted unique system ids } for every champion with an exported cue list. */
function readCueIndexSystems(root) {
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const top = read('index.json');
  const skills = { ...top.skills };
  for (const file of new Set(Object.values(top.champions ?? {}))) Object.assign(skills, read(file).skills);
  return Object.fromEntries(Object.keys(skills).sort().map(champion =>
    [champion, [...new Set((skills[champion] ?? []).map(cue => cue.system))].sort()]));
}

if (require.main === module) {
  const [root, snapshot] = process.argv.slice(2);
  if (!root || !snapshot) { console.error('usage: node scripts/cue-index-systems.cjs <asset root>/vfx-ltk <snapshot id>'); process.exit(2); }
  const champions = readCueIndexSystems(root);
  const lines = Object.entries(champions).map(([champion, ids]) => `  ${JSON.stringify(champion)}: ${JSON.stringify(ids)}`);
  fs.writeFileSync(FIXTURE, `{\n "source": ${JSON.stringify({ snapshot })},\n "champions": {\n${lines.join(',\n')}\n }\n}\n`);
  console.log(`${path.relative(process.cwd(), FIXTURE)}: ${Object.keys(champions).length} champions, snapshot ${snapshot}`);
}

module.exports = { readCueIndexSystems, FIXTURE };
