#!/usr/bin/env node
// The system ids each champion's spell data names as a hit or missile effect, read from a local export of the game's
// champion data (one `<package>.cdtb.bin.json` per champion package, kept outside the repository) and resolved to the
// systems of an asset root's vfx-ltk folder. Only champion ids and system ids are written: no spell, key, path or any other
// name from the game data. tests/vfx-ltk-cue-dropped.test.ts checks in CI that every id the committed copy
// (tests/fixtures/spell-referenced-systems.json) lists is played by the repository lists or registered with a reason
// (11-21: such systems were never in an exported cue list, so the dropped-system registry could not see them).
//
// Regenerate after the asset snapshot or the champion data changes:
//   node scripts/spell-referenced-systems.cjs <champion data folder> <asset root>/vfx-ltk <snapshot id>
const fs = require('node:fs');
const path = require('node:path');

const FIXTURE = path.join(__dirname, '..', 'tests', 'fixtures', 'spell-referenced-systems.json');
const EFFECT_FIELD = /^m(Hit|Missile)Effect(Key|Name)$/;

/** The asset system id behind each system path (lower case), and each champion package folder's champion id. */
function readAssetSystems(root) {
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const nameOf = file => { const fd = fs.openSync(path.join(root, file), 'r'), b = Buffer.alloc(512); fs.readSync(fd, b, 0, 512, 0); fs.closeSync(fd); return /"name":\s*"([^"]+)"/.exec(b.toString())?.[1]; };
  const top = read('index.json');
  const byPath = new Map(), packages = new Map();
  const add = (dir, systems) => { for (const [id, file] of Object.entries(systems ?? {})) { const name = nameOf(dir + file); if (name) byPath.set(name.toLowerCase(), id); } };
  add('', top.systems);
  for (const [champion, index] of Object.entries(top.champions ?? {})) {
    const dir = index.slice(0, -'index.json'.length);
    packages.set(dir.split('/').filter(Boolean).pop().toLowerCase(), champion);
    add(dir, read(index).systems);
  }
  return { byPath, packages };
}

/** { champion: sorted unique system ids } its spell data names as hit or missile effects and the assets hold. */
function readSpellReferencedSystems(dataDir, assetRoot) {
  const { byPath, packages } = readAssetSystems(assetRoot);
  const out = {};
  for (const file of fs.readdirSync(dataDir).filter(f => f.endsWith('.cdtb.bin.json')).sort()) {
    const champion = packages.get(file.slice(0, -'.cdtb.bin.json'.length).toLowerCase());
    if (!champion) continue;
    const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
    const resolve = {}, keys = new Set();
    const walk = (node, inSpell) => {
      if (!node || typeof node !== 'object') return;
      if (node.resourceMap && typeof node.resourceMap === 'object') Object.assign(resolve, node.resourceMap);
      const spell = inSpell || node.__type === 'SpellObject';
      for (const [field, value] of Object.entries(node)) {
        if (spell && typeof value === 'string' && EFFECT_FIELD.test(field)) keys.add(value); else walk(value, spell);
      }
    };
    walk(data, false);
    const ids = new Set();
    for (const key of keys) { const target = resolve[key] ?? key; const id = byPath.get(String(target).toLowerCase()); if (id) ids.add(id); }
    if (ids.size) out[champion] = [...ids].sort();
  }
  return Object.fromEntries(Object.keys(out).sort().map(champion => [champion, out[champion]]));
}

if (require.main === module) {
  const [dataDir, root, snapshot] = process.argv.slice(2);
  if (!dataDir || !root || !snapshot) { console.error('usage: node scripts/spell-referenced-systems.cjs <champion data folder> <asset root>/vfx-ltk <snapshot id>'); process.exit(2); }
  const champions = readSpellReferencedSystems(dataDir, root);
  const lines = Object.entries(champions).map(([champion, ids]) => `  ${JSON.stringify(champion)}: ${JSON.stringify(ids)}`);
  fs.writeFileSync(FIXTURE, `{\n "source": ${JSON.stringify({ snapshot })},\n "champions": {\n${lines.join(',\n')}\n }\n}\n`);
  console.log(`${path.relative(process.cwd(), FIXTURE)}: ${Object.keys(champions).length} champions, ${Object.values(champions).flat().length} systems, snapshot ${snapshot}`);
}

module.exports = { readSpellReferencedSystems, FIXTURE };
