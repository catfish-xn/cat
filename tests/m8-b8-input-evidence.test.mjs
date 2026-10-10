import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as api from '../src/simulation/match';
import { readCombatStats } from '../src/simulation/combat-s13';
import { validateB8RagebladeEvidence } from '../scripts/b8-input-evidence.cjs';
import { hash } from '../scripts/m4-evidence.cjs';

/* Audit P2-2 negative controls for the final comparator's B8 Rageblade gate. A genuine
 * evidence set is produced from public commands exactly as the input gate records it
 * (one artifact per interaction, manifest hashes, trusted inputs); every tampering below
 * must be rejected. */
const accepted = result => { if (!result.ok) throw new Error(result.reason); return result.state; };
function genuine() {
  const steps = [];
  let state = api.createMatch(42); const picks = ['bow', 'rod'];
  while (state.roundDefinitionId !== '2-1' || state.phase !== 'preparation') {
    if (state.phase === 'preparation') { state = accepted(api.startMatchCombat(state)); while (state.phase === 'combat') state = api.stepMatch(state).state; }
    else if (state.phase === 'choice') {
      const choice = state.pendingChoice, pick = choice.kind === 'component' ? picks.shift() : choice.offers.find(id => id !== 'placebo');
      const next = accepted(api.selectChoice(state, choice.choiceId, choice.generation, pick));
      steps.push({ name: `b8-opening-${choice.kind}-${pick}`, before: state, expected: next }); state = next;
    } else state = accepted(api.nextRound(state, state.round));
  }
  const receipt = id => state.m8.loot.receipts.find(r => r.payload.kind === 'item' && r.payload.definitionId === id).grantedItemIds[0];
  const combined = accepted(api.combineItems(state, receipt('bow'), receipt('rod')));
  steps.push({ name: 'normal-opening-rageblade-recipe', before: state, expected: combined });
  const blade = combined.items.find(item => item.definitionId === 'rageblade');
  const lux = combined.preparation.units.find(unit => unit.team === 'player' && unit.definitionId === 'lux');
  const equipped = accepted(api.equipItem(combined, blade.id, lux.id, 0));
  steps.push({ name: 'normal-opening-rageblade-equipped', before: combined, expected: equipped });
  const fielded = accepted(api.deployMatchUnit(equipped, lux.id, { kind: 'board', cell: { col: 3, row: 7 } }));
  steps.push({ name: 'b8-rageblade-lux-deployed', before: equipped, expected: fielded });
  const started = api.startMatchCombat(fielded); let fought = accepted(started);
  const events = started.events.filter(event => 'tick' in event);
  while (fought.phase === 'combat') { const next = api.stepMatch(fought); fought = next.state; events.push(...next.events.filter(event => 'tick' in event)); }
  steps.push({ name: 'b8-rageblade-2-1-combat', before: fielded, expected: fought, events });
  const unit = fought.combat.units.find(u => u.id === lux.id);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b8-evidence-'));
  const interactions = steps.map((step, index) => {
    const artifact = `input-${String(index).padStart(2, '0')}.json`;
    fs.writeFileSync(path.join(dir, artifact), JSON.stringify({ name: step.name, before: step.before, expected: step.expected,
      actual: { state: step.expected, combatEvents: step.events ?? [] }, inputs: [{ type: 'pointerdown', trusted: true }] }));
    return { name: step.name, beforeHash: hash(step.before), stateHash: hash(step.expected), artifact };
  });
  const manifest = { interactions, b8RagebladeChain: { roundId: '2-1', luxId: lux.id, ragebladeId: blade.id, combatTicks: fought.combat.tick,
    frozenAttackIntervalTicks: unit.attackIntervalTicks, currentAttackIntervalTicks: readCombatStats(unit, fought.combat).attackIntervalTicks } };
  return { dir, manifest };
}
const base = genuine();
function variant(change) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b8-evidence-variant-'));
  for (const file of fs.readdirSync(base.dir)) fs.copyFileSync(path.join(base.dir, file), path.join(dir, file));
  const manifest = structuredClone(base.manifest); change(manifest, dir);
  return () => validateB8RagebladeEvidence(manifest, dir, { readCombatStats });
}
const edit = (dir, artifact, change) => {
  const file = path.join(dir, artifact), value = JSON.parse(fs.readFileSync(file, 'utf8')); change(value); fs.writeFileSync(file, JSON.stringify(value));
};
const combatArtifact = manifest => manifest.interactions.find(entry => entry.name === 'b8-rageblade-2-1-combat').artifact;

describe('B8 Rageblade input evidence gate (audit P2-2)', () => {
  it('accepts the genuine public-command evidence', () => {
    expect(() => validateB8RagebladeEvidence(base.manifest, base.dir, { readCombatStats })).not.toThrow();
    expect(base.manifest.b8RagebladeChain.currentAttackIntervalTicks).toBeLessThan(base.manifest.b8RagebladeChain.frozenAttackIntervalTicks);
  });
  it.each([
    ['deleted combat artifact', (m, dir) => fs.rmSync(path.join(dir, combatArtifact(m))), /missing artifact/],
    ['deleted recipe interaction', (m) => { m.interactions = m.interactions.filter((e) => e.name !== 'normal-opening-rageblade-recipe'); }, /exactly one normal-opening-rageblade-recipe/],
    ['deleted Rageblade events', (m, dir) => edit(dir, combatArtifact(m), a => {
      a.actual.combatEvents = a.actual.combatEvents.filter((e) => e.source?.definitionId !== 'rageblade'); }), /combat ledger matches/],
    ['forged extra event', (m, dir) => edit(dir, combatArtifact(m), a => { a.actual.combatEvents.push({ ...a.actual.combatEvents.at(-1) }); }), /combat ledger matches/],
    ['modified recorded state', (m, dir) => edit(dir, combatArtifact(m), a => { a.actual.state.gold++; }), /recorded state was modified/],
    ['untrusted input', (m, dir) => edit(dir, combatArtifact(m), a => { a.inputs = [{ type: 'pointerdown', trusted: false }]; }), /trusted native input/],
    ['changed Lux identity', (m) => { m.b8RagebladeChain.luxId = 'unit-1'; }, /Lux identity/],
    ['changed Rageblade identity', (m) => { m.b8RagebladeChain.ragebladeId = 'item-1'; }, /Rageblade identity/],
    ['forged summary values', (m) => { Object.assign(m.b8RagebladeChain, { currentAttackIntervalTicks: -2, frozenAttackIntervalTicks: -1 }); }, /positive integer/],
    ['forged frozen interval', (m) => { m.b8RagebladeChain.frozenAttackIntervalTicks++; }, /frozen interval is the CombatUnit field/],
    ['forged current interval', (m) => { m.b8RagebladeChain.currentAttackIntervalTicks--; }, /current interval is readCombatStats/],
    ['forged tick count', (m) => { m.b8RagebladeChain.combatTicks++; }, /combat ticks/],
    ['missing summary', (m) => { delete m.b8RagebladeChain; }, /summary missing/],
    ['reordered interactions', (m) => { m.interactions.reverse(); }, /route order/],
  ])('rejects %s', (_label, change, message) => {
    expect(variant(change)).toThrow(message);
  });
});
