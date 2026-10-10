/** Compare the whole public tick-zero/first-step result against the fixed pre-U5 tree.
 * Earlier outcomes are synthesized only to reach every catalog preparation boundary.
 * This is an initialization-regression experiment, not balance or no-cheat acceptance.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { build } from 'vite';
const arg = (name, fallback) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const roots = { baseline: path.resolve(arg('baseline', '')), current: path.resolve(arg('current', '.')) };
const out = path.resolve(arg('out', 'artifacts/u5-preview/initialization'));
const apis = {};
for (const [name, root] of Object.entries(roots)) {
  const entry = path.join(root, '__u5-initialization-api__.ts');
  await build({ root, configFile: false, plugins: [{ name: 'initialization-api', resolveId(id) { if (id === entry) return entry; },
    load(id) { return id === entry ? ['match', 'serialization', 'content/round-catalog'].map(module => `export * from ${JSON.stringify(path.join(root, 'src/simulation', module + '.ts'))};`).join('\n') : undefined; } }],
    build: { outDir: path.join(out, name), emptyOutDir: true, minify: false, lib: { entry, formats: ['es'], fileName: () => 'api.mjs' } },
  });
  apis[name] = await import(pathToFileURL(path.join(out, name, 'api.mjs')).href);
}
const accepted = result => { if (!result.ok) throw new Error(result.reason); return result.state; };
const resolveChoices = (api, input) => {
  let state = input;
  while (state.phase === 'choice') {
    const c = state.pendingChoice;
    state = accepted(c.step === 'target' ? api.selectAnomalyTarget(state, c.choiceId, c.generation, state.preparation.units.find(u => u.team === 'player').id)
      : api.selectChoice(state, c.choiceId, c.generation, c.kind === 'augment' ? c.offers.find(id => id !== 'placebo' && id !== 'glass-cannon-i') : c.offers[0]));
  }
  return state;
};
const { baseline: old, current: next } = apis;
const report = { node: process.version, baseline: arg('baseline-sha', 'fixed archive'), rounds: [], unchanged: 'complete public start result, combat events, first step, canonical save bytes and bidirectional restore' };
let state = resolveChoices(old, old.createMatch(42));
for (const round of old.ROUND_CATALOG) {
  strictEqual(state.roundDefinitionId, round.roundId);
  const before = old.serializeMatch(state);
  const restored = next.restoreMatch(before), started = state.phase === 'preparation';
  const a = started ? old.startMatchCombat(state) : { ok: true, state, events: [] };
  const b = started ? next.startMatchCombat(restored) : { ok: true, state: restored, events: [] };
  deepStrictEqual(b, a, `${round.roundId}: start result`);
  accepted(a);
  const bytes = old.serializeMatch(a.state);
  strictEqual(next.serializeMatch(b.state), bytes, `${round.roundId}: canonical bytes`);
  deepStrictEqual(next.restoreMatch(bytes), old.restoreMatch(bytes));
  if (a.state.phase === 'combat') deepStrictEqual(next.stepMatch(b.state), old.stepMatch(a.state), `${round.roundId}: first step`);
  report.rounds.push({ roundId: round.roundId, kind: round.kind, started, enemies: state.m8.preparation.enemies.length,
    initializationSha256: createHash('sha256').update(bytes).digest('hex'), events: a.events.length });
  state = a.state;
  if (state.phase === 'combat') state = old.stepMatch(state).state;
  if (state.phase === 'combat') state = old.stepMatch({ ...state, combat: { ...state.combat, units: state.combat.units.map(u => u.team === 'enemy' ? { ...u, hp: 0, alive: false } : u) } }).state;
  if (round === old.ROUND_CATALOG.at(-1)) break;
  state = resolveChoices(old, state);
  state = resolveChoices(old, accepted(old.nextRound(state, state.round)));
}
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`PASS: ${report.rounds.length} catalog rounds; ${report.unchanged}`);
