/* Audit P2-2: the B8 Rageblade chain of the input gate is accepted only when its summary is
 * bound to the recorded interactions: each artifact file exists, is unmodified (hashes in the
 * manifest), shows native trusted input and a state equal to its public-command expectation; the
 * states form one chain (pick → combine → equip → [deploy] → 2-1 combat); the item, the loot-born
 * Lux and the Rageblade keep their identities; the combat ledger has Rageblade statChanged events
 * for that Lux; and both attack intervals equal the domain's own fields (frozen CombatUnit
 * attackIntervalTicks and readCombatStats(...).attackIntervalTicks of the recorded final state).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { hash } = require('./m4-evidence.cjs');

const positive = value => Number.isSafeInteger(value) && value > 0;
function one(interactions, name) {
  const found = interactions.filter(entry => entry.name === name);
  assert.equal(found.length, 1, `B8 Rageblade evidence: exactly one ${name} interaction`);
  return found[0];
}
function load(dir, interaction) {
  const file = path.join(dir, interaction.artifact ?? '');
  assert(interaction.artifact && fs.existsSync(file), `B8 Rageblade evidence: missing artifact for ${interaction.name}`);
  const artifact = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(artifact.name, interaction.name, `${interaction.name}: artifact name`);
  assert.equal(hash(artifact.before), interaction.beforeHash, `${interaction.name}: before state was modified`);
  assert.equal(hash(artifact.actual?.state), interaction.stateHash, `${interaction.name}: recorded state was modified`);
  assert.deepEqual(artifact.actual.state, artifact.expected, `${interaction.name}: actual state equals the public command result`);
  assert(Array.isArray(artifact.inputs) && artifact.inputs.length > 0 && artifact.inputs.every(input => input.trusted === true),
    `${interaction.name}: trusted native input`);
  return artifact;
}
const players = state => state.preparation.units.filter(unit => unit.team === 'player');

/** readCombatStats is the domain function (src/simulation/combat-s13.ts), injected by the caller. */
function validateB8RagebladeEvidence(manifest, dir, { readCombatStats }) {
  const summary = manifest.b8RagebladeChain;
  assert(summary && typeof summary === 'object', 'B8 Rageblade evidence: summary missing');
  assert.equal(summary.roundId, '2-1', 'B8 Rageblade evidence: round');
  for (const key of ['luxId', 'ragebladeId']) assert(typeof summary[key] === 'string' && summary[key], `B8 Rageblade evidence: ${key}`);
  for (const key of ['combatTicks', 'frozenAttackIntervalTicks', 'currentAttackIntervalTicks'])
    assert(positive(summary[key]), `B8 Rageblade evidence: ${key} must be a positive integer tick count`);
  const interactions = manifest.interactions ?? [];
  const names = ['b8-opening-component-bow', 'b8-opening-component-rod', 'normal-opening-rageblade-recipe', 'normal-opening-rageblade-equipped'];
  const steps = names.map(name => one(interactions, name));
  const deployed = interactions.filter(entry => entry.name === 'b8-rageblade-lux-deployed');
  assert(deployed.length <= 1, 'B8 Rageblade evidence: at most one deployment');
  const combatStep = one(interactions, 'b8-rageblade-2-1-combat');
  const ordered = [...steps, ...deployed, combatStep], index = ordered.map(entry => interactions.indexOf(entry));
  assert.deepEqual(index, [...index].sort((a, b) => a - b), 'B8 Rageblade evidence: interactions in route order');
  const [bowPick, rodPick, recipe, equipped, ...rest] = ordered.map(entry => load(dir, entry));
  const combat = rest.at(-1), deploy = rest.length === 2 ? rest[0] : null;

  // Chain continuity from the first preparation command to the 2-1 start.
  assert.deepEqual(equipped.before, recipe.expected, 'B8 Rageblade evidence: equip follows combine');
  assert.deepEqual(deploy ? deploy.before : combat.before, equipped.expected, 'B8 Rageblade evidence: next step follows equip');
  if (deploy) assert.deepEqual(combat.before, deploy.expected, 'B8 Rageblade evidence: combat follows deployment');
  assert.equal(recipe.before.roundDefinitionId, '2-1'); assert.equal(recipe.before.phase, 'preparation');

  // Identities: components from real loot picks, Rageblade from them, carried by the loot-born Lux.
  const lootItem = (state, definitionId) => state.m8.loot.receipts.find(receipt => receipt.payload.kind === 'item' && receipt.payload.definitionId === definitionId);
  const bow = lootItem(bowPick.expected, 'bow'), rod = lootItem(rodPick.expected, 'rod');
  assert(bow && rod, 'B8 Rageblade evidence: bow and rod loot receipts');
  const ids = [bow.grantedItemIds[0], rod.grantedItemIds[0]];
  assert(ids.every(id => recipe.before.items.some(item => item.id === id && item.location.kind === 'inventory')), 'components in inventory before combine');
  const blade = recipe.expected.items.find(item => item.id === summary.ragebladeId);
  assert(blade && blade.definitionId === 'rageblade', 'B8 Rageblade evidence: Rageblade identity');
  assert(ids.every(id => !recipe.expected.items.some(item => item.id === id)), 'combine consumed both loot components');
  const lux = players(equipped.expected).find(unit => unit.id === summary.luxId);
  assert(lux && lux.definitionId === 'lux', 'B8 Rageblade evidence: Lux identity');
  assert(combat.before.m8.loot.receipts.some(receipt => receipt.payload.kind === 'unit' && receipt.payload.definitionId === 'lux'
    && receipt.grantedUnitIds.includes(summary.luxId)), 'B8 Rageblade evidence: Lux was granted by its loot receipt');
  assert.deepEqual(equipped.expected.items.find(item => item.id === summary.ragebladeId)?.location,
    { kind: 'unit', unitId: summary.luxId, slot: 0 }, 'B8 Rageblade evidence: Rageblade equipped on Lux');

  // The real 2-1 combat, its events and the domain's attack-speed fields.
  const state = combat.actual.state, fight = state.combat;
  assert.equal(state.roundDefinitionId, '2-1'); assert.notEqual(state.phase, 'combat', 'B8 Rageblade evidence: combat finished');
  assert(fight && fight.status === 'finished' && fight.tick === summary.combatTicks, 'B8 Rageblade evidence: combat ticks');
  const unit = fight.units.find(entry => entry.id === summary.luxId);
  assert(unit, 'B8 Rageblade evidence: Lux in the recorded combat');
  const events = combat.actual.combatEvents;
  // Events are not in the manifest hash; bind the ledger to the hashed combat state instead.
  assert(Array.isArray(events) && events.length === fight.nextEventSeq && events.every((event, seq) => event.eventSeq === seq
    && event.combatId === fight.combatId), 'B8 Rageblade evidence: combat ledger matches the recorded combat');
  assert(events.some(event => event.type === 'statChanged' && event.unitId === summary.luxId
    && event.source?.definitionId === 'rageblade'), 'B8 Rageblade evidence: Rageblade statChanged for Lux');
  assert.equal(summary.frozenAttackIntervalTicks, unit.attackIntervalTicks, 'frozen interval is the CombatUnit field');
  assert.equal(summary.currentAttackIntervalTicks, readCombatStats(unit, fight).attackIntervalTicks, 'current interval is readCombatStats');
  assert(summary.currentAttackIntervalTicks < summary.frozenAttackIntervalTicks, 'Rageblade attacks raised attack speed');
}
module.exports = { validateB8RagebladeEvidence };
