/** Read-only catalogue audit. Runs every mapped action/phase with synthetic systems,
 * units and textures in Node; never opens a browser or copies game assets into git. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
if (!args.catalog || !args.out || !resolve(args.out).startsWith('/tmp/')) throw Error('--catalog=<index.json> --out=/tmp/<report.json> required');
const scratch = await mkdtemp('/tmp/vfx-target-audit-'), bundle = join(scratch, 'audit.mjs');
await build({ stdin: { contents: `
  export { createVfxLibrary, parseIndex } from './src/rendering/three-mode/vfx-ltk/loader';
  export { createLtkRuntime } from './src/rendering/three-mode/vfx-ltk/runtime';
  export { mapSkillTimeline } from './src/rendering/three-mode/vfx-ltk/timeline';
  export { syntheticSystem } from './tests/vfx-ltk-synthetic';
  export { battle, unit } from './tests/combat-helpers';
  export { stepCombat } from './src/simulation/combat';
  export { resolveAbility } from './src/simulation/combat-abilities';
  export { EMPTY_RUNTIME } from './src/simulation/combat-s13-state';
  export { Camera, Group, Scene, Texture } from 'three';
`, resolveDir: process.cwd(), loader: 'ts' }, outfile: bundle, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const { createVfxLibrary, parseIndex, createLtkRuntime, mapSkillTimeline, syntheticSystem,
  battle, unit, stepCombat, resolveAbility, EMPTY_RUNTIME, Group, Scene, Texture } = await import(pathToFileURL(bundle));
const read = async path => JSON.parse(await readFile(path, 'utf8'));
const catalogPath = resolve(args.catalog), root = parseIndex(await read(catalogPath));
const entries = Object.entries(root.champions ?? {}); assert.equal(entries.length, 63);
const rows = [], scenarios = {
  empty: [], self: ['self'], ally: ['ally'], enemy: ['enemy'],
  'self-first': ['self', 'ally', 'enemy', 'self'], 'ally-first': ['ally', 'self', 'enemy', 'ally'],
  'enemy-first': ['enemy', 'self', 'ally', 'enemy'], absent: ['self', 'absent'],
};
function observedTargets(champion, castIndex, withAlly) {
  const caster = unit('self', 'player', 1, 3, { definitionId: champion, ability: resolveAbility(`${champion}-ability`, 1),
    hp: 4000, maxHp: 5000, mana: 100, maxMana: 100, abilityPower: 100, baseAttackSpeedBps: 10000,
    runtime: { ...EMPTY_RUNTIME, castCount: castIndex }, statuses: [], shieldLayers: [], tasks: [], mechanics: [] });
  const enemy = unit('enemy', 'enemy', 2, 3, { hp: 10000, maxHp: 10000, cooldownTicks: 1000 });
  const ally = unit('ally', 'player', 0, 3, { hp: 5, maxHp: 5000, cooldownTicks: 1000 });
  const result = stepCombat(battle([caster, enemy, ...(withAlly ? [ally] : [])], { rngState: 42 }));
  const cast = result.events.find(event => event.type === 'cast' && event.receipt.source.ownerId === 'self');
  return cast ? cast.receipt.targetIds : null;
}
for (const [champion, path] of entries) {
  const index = parseIndex(await read(join(dirname(catalogPath), path))), original = index.skills[champion] ?? [];
  // Retain cue structure/phase/primary flags, replacing all system IDs and resources.
  const cues = original.map((cue, i) => ({ ...cue, system: `synthetic-${i}` }));
  const library = createVfxLibrary('/synthetic/', {
    readJson: async url => url.endsWith('/index.json') ? { version: 1,
      systems: Object.fromEntries(cues.map(c => [c.system, `${c.system}.json`])), assets: { 'synthetic.tex': 'texture.png' },
      skills: cues.length ? { [champion]: cues } : {} } : syntheticSystem(),
    readTexture: async () => new Texture(),
  });
  const units = new Map(['self', 'ally', 'enemy'].map(id => [id, { root: new Group(), body: null, alive: true }]));
  const runtime = createLtkRuntime(library, new Scene(), id => units.get(id));
  let checks = 0;
  const outcomes = [], observed = [];
  try {
    await runtime.warm(champion);
    const check = (action, castIndex, label, targets) => {
      const active = cues.filter(c => (c.action ?? 'cast') === action && (c.phase === undefined || c.phase === castIndex % 3));
      const counts = { start: active.filter(c => c.event === 'cast-start').length,
        primary: active.filter(c => c.event === 'projectile' || c.event === 'hit' && c.primary).length,
        fanout: active.filter(c => c.event === 'hit' && !c.primary).length };
      const unique = [...new Set(targets)];
      const unsupported = active.some(c => c.event !== 'cast-start' && !targets.length || c.event === 'projectile' && targets[0] === 'self');
      const mapping = mapSkillTimeline(active, 'self', targets, castIndex);
      assert.equal(mapping.unsupported.length > 0, unsupported, `${champion}:${action}:${label}:coverage`);
      const missing = mapping.spawns.some(c => c.targetId !== undefined && !units.has(c.targetId));
      const expected = active.length > 0 && !unsupported && !missing;
      const handled = runtime.play(champion, 'self', targets, castIndex, action);
      assert.equal(handled, expected, `${champion}:${action}:${label}:play`);
      assert.equal(runtime.queued, expected ? counts.start + counts.primary * Math.min(1, unique.length) + counts.fanout * unique.length : 0,
        `${champion}:${action}:${label}:atomic-queue`);
      if (!unsupported) for (const cue of active.filter(c => c.event === 'hit' && !c.primary)) {
        assert.deepEqual(mapping.spawns.filter(c => c.system === cue.system).map(c => c.targetId), unique);
      }
      const result = { action, castIndex, scenario: label, handled, queued: runtime.queued,
        unsupported: mapping.unsupported.map(({ cue, reason }) => ({ system: cue.system, event: cue.event, reason })) };
      runtime.clear(); checks++; return result;
    };
    for (const action of ['cast', 'attack']) for (let phase = 0; phase < 3; phase++) {
      for (const [label, targets] of Object.entries(scenarios)) outcomes.push(check(action, phase, label, targets));
    }
    for (let phase = 0; phase < 3; phase++) for (const withAlly of [false, true]) {
      const targets = observedTargets(champion, phase, withAlly);
      observed.push({ castIndex: phase, withAlly, targets, ...(targets === null ? {} : check('cast', phase, 'receipt', targets)) });
    }
    rows.push({ champion, castCues: cues.filter(c => (c.action ?? 'cast') === 'cast').map(c => c.event),
      attackCues: cues.filter(c => c.action === 'attack').map(c => c.event), checks, observed, outcomes });
  } finally { runtime.dispose(); }
}
const report = { catalog: catalogPath, champions: rows.length, checks: rows.reduce((sum, row) => sum + row.checks, 0),
  note: 'Real cue shapes; synthetic assets/units. This verifies target coverage and atomic queue ownership, not GPU visuals or real asset readiness.', rows };
await writeFile(resolve(args.out), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ champions: report.champions, checks: report.checks, out: resolve(args.out) }));
