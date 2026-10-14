// Run compare-m8-u5-initialization.mjs first; pass its baseline/api.mjs and current/api.mjs.
// Evidence-only runner: no application sources or catalogs are modified.
import { deepStrictEqual, strictEqual } from 'node:assert';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const old = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const next = await import(pathToFileURL(path.resolve(process.argv[3])).href);
const accepted = result => { if (!result.ok) throw new Error(result.reason); return result.state; };
function choices(input) {
  let state = input;
  while (state.phase === 'choice') {
    const c = state.pendingChoice;
    state = accepted(c.step === 'target' ? old.selectAnomalyTarget(state, c.choiceId, c.generation, state.preparation.units.find(u => u.team === 'player').id)
      : old.selectChoice(state, c.choiceId, c.generation, c.kind === 'augment' ? c.offers.find(id => id !== 'placebo' && id !== 'glass-cannon-i') : c.offers[0]));
  }
  return state;
}
const legacy = view => view === null ? null : {
  encounterId: view.encounterId, rulesNote: view.rulesNote,
  units: view.units.map(u => ({ unitId: u.unitId, definitionId: u.definitionId, name: u.name, starLevel: u.starLevel,
    cell: u.cell, abilityDescription: u.abilityDescription,
    stats: { maxHp: u.stats.maxHp, attackDamage: u.stats.attackDamage, armor: u.stats.armor, magicResist: u.stats.magicResist } })),
};
let comparisons = 0;
function compare(state) {
  const before = old.serializeMatch(state);
  deepStrictEqual(legacy(next.readEncounterPreview(state)), old.readEncounterPreview(state), `${state.roundDefinitionId}/${state.phase}`);
  strictEqual(old.serializeMatch(state), before);
  comparisons++;
}
let state = choices(old.createMatch(42));
for (const round of old.ROUND_CATALOG) {
  strictEqual(state.roundDefinitionId, round.roundId); compare(state);
  if (state.phase === 'preparation') state = accepted(old.startMatchCombat(state));
  compare(state);
  if (state.phase === 'combat') { state = old.stepMatch(state).state; compare(state); }
  if (state.phase === 'combat') state = old.stepMatch({ ...state, combat: { ...state.combat, units: state.combat.units.map(u => u.team === 'enemy' ? { ...u, hp: 0, alive: false } : u) } }).state;
  if (round === old.ROUND_CATALOG.at(-1)) break;
  state = choices(state); state = choices(accepted(old.nextRound(state, state.round)));
}
console.log(`PASS: ${comparisons} old-field preview comparisons across 38 catalog rounds; identities, cells, four stats, full descriptions, rulesNote and supply null unchanged.`);
