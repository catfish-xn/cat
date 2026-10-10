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
 * (one artifact per interaction, manifest hashes, native mouse operations on the command's
 * controls); every tampering below must be rejected. The validator replays the route from
 * createMatch(42), so re-hashed forgeries and placeholder ledgers fail as well. */
const accepted = result => { if (!result.ok) throw new Error(result.reason); return result.state; };
// The gate's recorded shape for one native mouse operation per control (pointer then compatibility mouse events).
const clicks = targets => targets.flatMap((target, index) => [['pointerdown', 'mouse'], ['mousedown', null], ['pointerup', 'mouse'], ['mouseup', null], ['click', 'mouse']]
  .map(([type, pointerType], offset) => ({ type, time: 1000 + index * 100 + offset, trusted: true, pointerType, target })));
function genuine() {
  const steps = [];
  let state = api.createMatch(42); const picks = ['bow', 'rod'];
  while (state.roundDefinitionId !== '2-1' || state.phase !== 'preparation') {
    if (state.phase === 'preparation') { state = accepted(api.startMatchCombat(state)); while (state.phase === 'combat') state = api.stepMatch(state).state; }
    else if (state.phase === 'choice') {
      const choice = state.pendingChoice, pick = choice.kind === 'component' ? picks.shift() : choice.offers.find(id => id !== 'placebo');
      const next = accepted(api.selectChoice(state, choice.choiceId, choice.generation, pick));
      steps.push({ name: `b8-opening-${choice.kind}-${pick}`, before: state, expected: next, targets: [`choice:${pick}`] }); state = next;
    } else state = accepted(api.nextRound(state, state.round));
  }
  const receipt = id => state.m8.loot.receipts.find(r => r.payload.kind === 'item' && r.payload.definitionId === id).grantedItemIds[0];
  const combined = accepted(api.combineItems(state, receipt('bow'), receipt('rod')));
  steps.push({ name: 'normal-opening-rageblade-recipe', before: state, expected: combined, targets: ['panel:items', `item:${receipt('bow')}`, `item:${receipt('rod')}`, 'combine-items'] });
  const blade = combined.items.find(item => item.definitionId === 'rageblade');
  const lux = combined.preparation.units.find(unit => unit.team === 'player' && unit.definitionId === 'lux');
  const equipped = accepted(api.equipItem(combined, blade.id, lux.id, 0));
  steps.push({ name: 'normal-opening-rageblade-equipped', before: combined, expected: equipped, targets: [`item:${blade.id}`, `equipment:${lux.id}:0`] });
  const fielded = accepted(api.deployMatchUnit(equipped, lux.id, { kind: 'board', cell: { col: 3, row: 7 } }));
  steps.push({ name: 'b8-rageblade-lux-deployed', before: equipped, expected: fielded, targets: ['panel:units', `mobile:unit:${lux.id}`, 'deploy:3,7'] });
  const started = api.startMatchCombat(fielded); let fought = accepted(started);
  const events = started.events.filter(event => 'tick' in event);
  while (fought.phase === 'combat') { const next = api.stepMatch(fought); fought = next.state; events.push(...next.events.filter(event => 'tick' in event)); }
  steps.push({ name: 'b8-rageblade-2-1-combat', before: fielded, expected: fought, events, targets: ['mobile:start-combat'] });
  const unit = fought.combat.units.find(u => u.id === lux.id);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b8-evidence-'));
  const interactions = steps.map((step, index) => {
    const artifact = `input-${String(index).padStart(2, '0')}.json`;
    fs.writeFileSync(path.join(dir, artifact), JSON.stringify({ name: step.name, before: step.before, expected: step.expected,
      actual: { state: step.expected, combatEvents: step.events ?? [] }, inputs: clicks(step.targets) }));
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
  return () => validateB8RagebladeEvidence(manifest, dir, { api, readCombatStats });
}
const edit = (dir, artifact, change) => {
  const file = path.join(dir, artifact), value = JSON.parse(fs.readFileSync(file, 'utf8')); change(value); fs.writeFileSync(file, JSON.stringify(value));
};
const artifactOf = (manifest, name) => manifest.interactions.find(entry => entry.name === name).artifact;
const combatArtifact = manifest => artifactOf(manifest, 'b8-rageblade-2-1-combat');
// Changes an artifact and rewrites its manifest hashes, as an author forging both files would.
const rehashed = (manifest, dir, name, change) => {
  const entry = manifest.interactions.find(item => item.name === name);
  edit(dir, entry.artifact, artifact => { change(artifact); entry.beforeHash = hash(artifact.before); entry.stateHash = hash(artifact.actual.state); });
};

describe('B8 Rageblade input evidence gate (audit P2-2)', () => {
  it('accepts the genuine public-command evidence', () => {
    expect(() => validateB8RagebladeEvidence(base.manifest, base.dir, { api, readCombatStats })).not.toThrow();
    expect(base.manifest.b8RagebladeChain.currentAttackIntervalTicks).toBeLessThan(base.manifest.b8RagebladeChain.frozenAttackIntervalTicks);
  });
  it.each([
    ['deleted combat artifact', (m, dir) => fs.rmSync(path.join(dir, combatArtifact(m))), /missing artifact/],
    ['deleted recipe interaction', (m) => { m.interactions = m.interactions.filter((e) => e.name !== 'normal-opening-rageblade-recipe'); }, /route order \(expected normal-opening-rageblade-recipe\)/],
    ['deleted Rageblade events', (m, dir) => edit(dir, combatArtifact(m), a => {
      a.actual.combatEvents = a.actual.combatEvents.filter((e) => e.source?.definitionId !== 'rageblade'); }), /combat ledger equals the replayed combat/],
    ['forged extra event', (m, dir) => edit(dir, combatArtifact(m), a => { a.actual.combatEvents.push({ ...a.actual.combatEvents.at(-1) }); }), /combat ledger equals the replayed combat/],
    // Audit original 1: a same-length placeholder ledger with one forged Rageblade statChanged for Lux.
    ['placeholder ledger with one forged statChanged', (m, dir) => edit(dir, combatArtifact(m), a => {
      a.actual.combatEvents = a.actual.combatEvents.map((e, eventSeq) => ({ eventSeq, combatId: e.combatId, tick: e.tick, type: 'placeholder' }));
      Object.assign(a.actual.combatEvents[1], { type: 'statChanged', unitId: m.b8RagebladeChain.luxId, source: { definitionId: 'rageblade' } }); }),
      /combat ledger equals the replayed combat/],
    // Audit original 2: every recorded input replaced by a bare {trusted:true}.
    ['all inputs replaced by {trusted:true}', (m, dir) => { for (const entry of m.interactions) edit(dir, entry.artifact, a => { a.inputs = a.inputs.map(() => ({ trusted: true })); }); },
      /input type undefined is not a native mouse event/],
    ['start pressed on the canvas instead of the Start control', (m, dir) => edit(dir, combatArtifact(m), a => { for (const input of a.inputs) input.target = 'CANVAS'; }),
      /pointer operations hit the command's controls/],
    ['equip operations in the wrong order', (m, dir) => edit(dir, artifactOf(m, 'normal-opening-rageblade-equipped'), a => { a.inputs = [...a.inputs.slice(5), ...a.inputs.slice(0, 5)]
      .map((input, index) => ({ ...input, time: 1000 + index })); }), /pointer operations hit the command's controls/],
    ['touch input substituted for the mouse pick', (m, dir) => edit(dir, artifactOf(m, 'b8-opening-component-bow'), a => { a.inputs[0].type = 'touchstart'; }),
      /input type touchstart is not a native mouse event/],
    ['committing click removed', (m, dir) => edit(dir, artifactOf(m, 'normal-opening-rageblade-recipe'), a => { a.inputs = a.inputs.filter(input => input.type !== 'click' || input.target !== 'combine-items'); }),
      /committing click on combine-items/],
    ['inputs out of time order', (m, dir) => edit(dir, combatArtifact(m), a => { a.inputs[1].time = a.inputs[0].time - 1; }), /native time order/],
    ['re-hashed forged before state', (m, dir) => rehashed(m, dir, 'normal-opening-rageblade-recipe', a => { a.before.gold += 5; }),
      /recorded before state equals the trusted replay/],
    ['re-hashed forged combat result', (m, dir) => rehashed(m, dir, 'b8-rageblade-2-1-combat', a => { a.expected.gold += 1; a.actual.state = a.expected; }),
      /recorded result equals the replayed public command/],
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
