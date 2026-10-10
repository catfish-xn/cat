/* Audit P2-2: the B8 Rageblade chain of the input gate is accepted only when it is bound to a
 * trusted start and to the recorded native inputs. The validator replays the whole route with the
 * domain's own public commands from createMatch(42), using the same pick policy as the gate, and
 * requires every recorded interaction (before, expected and actual state) to equal the replay; the
 * complete 2-1 combat ledger must equal the replayed ledger event by event. Each interaction's
 * inputs must be trusted native mouse events of known types, in time order, whose pointer
 * operations hit exactly the controls that issue that command (and end in a click on the
 * committing control). Hashes, artifact files and the summary identities are still checked, and
 * both attack intervals are recomputed from the replayed combat, not read from the evidence.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { hash } = require('./m4-evidence.cjs');

const SEED = 42, OPENING_COMPONENTS = ['bow', 'rod'];
const INPUT_TYPES = new Set(['pointerdown', 'pointerup', 'pointerout', 'mousedown', 'mouseup', 'mouseout', 'mouseleave', 'click']);
const POINTER_TYPES = new Set(['pointerdown', 'pointerup', 'pointerout', 'click']);
const positive = value => Number.isSafeInteger(value) && value > 0;
const plain = value => JSON.parse(JSON.stringify(value));
// Large states and ledgers: strict deep equality without assert's (very slow) diff rendering.
const same = (actual, expected, message) => assert(isDeepStrictEqual(actual, expected), message);
const accepted = (result, label) => { assert(result.ok, `B8 Rageblade replay: ${label} rejected (${result.reason})`); return result.state; };

function load(dir, interaction) {
  const file = path.join(dir, interaction.artifact ?? '');
  assert(interaction.artifact && fs.existsSync(file), `B8 Rageblade evidence: missing artifact for ${interaction.name}`);
  const artifact = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(artifact.name, interaction.name, `${interaction.name}: artifact name`);
  assert.equal(hash(artifact.before), interaction.beforeHash, `${interaction.name}: before state was modified`);
  assert.equal(hash(artifact.actual?.state), interaction.stateHash, `${interaction.name}: recorded state was modified`);
  same(artifact.actual.state, artifact.expected, `${interaction.name}: actual state equals the public command result`);
  assert(Array.isArray(artifact.inputs) && artifact.inputs.length > 0 && artifact.inputs.every(input => input?.trusted === true),
    `${interaction.name}: trusted native input`);
  return artifact;
}

/** The recorded inputs must be the native mouse operations on exactly `targets`, in order. */
function checkInputs(name, inputs, targets) {
  let time = -Infinity;
  for (const input of inputs) {
    assert(INPUT_TYPES.has(input.type), `${name}: input type ${input.type} is not a native mouse event of the gate`);
    assert(Number.isFinite(input.time) && input.time >= time, `${name}: inputs in native time order`);
    time = input.time;
    assert(typeof input.target === 'string' && input.target.length > 0, `${name}: input target recorded`);
    if (POINTER_TYPES.has(input.type)) assert.equal(input.pointerType, 'mouse', `${name}: ${input.type} pointerType`);
  }
  const downs = inputs.filter(input => input.type === 'pointerdown');
  assert.deepEqual(downs.map(input => input.target), targets, `${name}: pointer operations hit the command's controls`);
  downs.forEach((down, index) => {
    const from = inputs.indexOf(down), to = index + 1 < downs.length ? inputs.indexOf(downs[index + 1]) : inputs.length;
    const operation = inputs.slice(from, to);
    assert(operation.some(input => input.type === 'mousedown' && input.target === down.target), `${name}: mousedown on ${down.target}`);
    assert(operation.some(input => input.type === 'pointerup' && input.target === down.target), `${name}: pointerup on ${down.target}`);
    if (index === downs.length - 1)
      assert(operation.some(input => input.type === 'click' && input.target === down.target), `${name}: committing click on ${down.target}`);
  });
}

/** api: the public Match module (src/simulation/match.ts); readCombatStats: src/simulation/combat-s13.ts. */
function validateB8RagebladeEvidence(manifest, dir, { api, readCombatStats }) {
  const summary = manifest.b8RagebladeChain;
  assert(summary && typeof summary === 'object', 'B8 Rageblade evidence: summary missing');
  assert.equal(summary.roundId, '2-1', 'B8 Rageblade evidence: round');
  for (const key of ['luxId', 'ragebladeId']) assert(typeof summary[key] === 'string' && summary[key], `B8 Rageblade evidence: ${key}`);
  for (const key of ['combatTicks', 'frozenAttackIntervalTicks', 'currentAttackIntervalTicks'])
    assert(positive(summary[key]), `B8 Rageblade evidence: ${key} must be a positive integer tick count`);
  const interactions = manifest.interactions ?? [];
  const finals = interactions.filter(entry => entry.name === 'b8-rageblade-2-1-combat');
  assert.equal(finals.length, 1, 'B8 Rageblade evidence: exactly one b8-rageblade-2-1-combat interaction');
  const first = interactions.findIndex(entry => entry.name?.startsWith('b8-opening-'));
  const last = interactions.indexOf(finals[0]);
  assert(first >= 0 && first < last, 'B8 Rageblade evidence: interactions in route order');
  const chain = interactions.slice(first, last + 1);
  let cursor = 0;
  const step = (name, before, after, targets) => {
    const entry = chain[cursor++];
    assert(entry, `B8 Rageblade evidence: exactly one ${name} interaction`);
    assert.equal(entry.name, name, `B8 Rageblade evidence: interactions in route order (expected ${name})`);
    const artifact = load(dir, entry);
    same(artifact.before, plain(before), `${name}: recorded before state equals the trusted replay`);
    same(artifact.expected, plain(after), `${name}: recorded result equals the replayed public command`);
    checkInputs(name, artifact.inputs, typeof targets === 'function' ? targets(artifact) : targets);
    return artifact;
  };

  // Trusted start and the gate's opening policy: Start in preparation, Continue in settlement,
  // components bow then rod, any other pick the first non-placebo offer.
  let state = api.createMatch(SEED);
  const components = [...OPENING_COMPONENTS];
  for (let guard = 0; state.m8.round.roundId !== '2-1' || state.phase !== 'preparation'; guard++) {
    assert(guard < 200, 'B8 Rageblade replay: 2-1 preparation not reached');
    if (state.phase === 'preparation') {
      state = accepted(api.startMatchCombat(state), 'opening start');
      while (state.phase === 'combat') state = api.stepMatch(state).state;
    } else if (state.phase === 'choice') {
      const choice = state.pendingChoice;
      const pick = choice.kind === 'component' ? components.shift() : choice.offers.find(id => id !== 'placebo');
      assert(pick && choice.offers.includes(pick), `B8 Rageblade replay: offer ${pick}`);
      const after = accepted(api.selectChoice(state, choice.choiceId, choice.generation, pick), `pick ${pick}`);
      step(`b8-opening-${choice.kind}-${pick}`, state, after, [`choice:${pick}`]);
      state = after;
    } else if (state.phase === 'settlement') state = accepted(api.nextRound(state, state.round), 'continue');
    else assert.fail(`B8 Rageblade replay: opening ended at ${state.phase}`);
  }
  assert.deepEqual(components, [], 'B8 Rageblade replay: both loot component picks were made');

  // Identities from the replay: components from the real loot picks, Lux from its loot receipt.
  const lootItem = id => state.m8.loot.receipts.find(receipt => receipt.payload.kind === 'item' && receipt.payload.definitionId === id)?.grantedItemIds[0];
  const [bow, rod] = OPENING_COMPONENTS.map(lootItem);
  assert(bow && rod, 'B8 Rageblade evidence: bow and rod loot receipts');
  const luxReceipt = state.m8.loot.receipts.find(receipt => receipt.payload.kind === 'unit' && receipt.payload.definitionId === 'lux');
  const lux = state.preparation.units.find(unit => unit.team === 'player' && unit.definitionId === 'lux' && luxReceipt?.grantedUnitIds.includes(unit.id));
  assert(lux && summary.luxId === lux.id, 'B8 Rageblade evidence: Lux identity (granted by its loot receipt)');

  const combined = accepted(api.combineItems(state, bow, rod), 'combine');
  step('normal-opening-rageblade-recipe', state, combined, ['panel:items', `item:${bow}`, `item:${rod}`, 'combine-items']);
  const blade = combined.items.find(item => item.definitionId === 'rageblade' && !state.items.some(old => old.id === item.id));
  assert(blade && summary.ragebladeId === blade.id, 'B8 Rageblade evidence: Rageblade identity');
  const equipped = accepted(api.equipItem(combined, blade.id, lux.id, 0), 'equip');
  step('normal-opening-rageblade-equipped', combined, equipped, [`item:${blade.id}`, `equipment:${lux.id}:0`]);
  state = equipped;
  if (lux.location.kind !== 'board') {
    const entry = chain[cursor];
    const cell = entry && load(dir, entry).expected.preparation.units.find(unit => unit.id === lux.id)?.location.cell;
    assert(cell, 'B8 Rageblade evidence: Lux deployment cell');
    const fielded = accepted(api.deployMatchUnit(state, lux.id, { kind: 'board', cell }), 'deploy');
    step('b8-rageblade-lux-deployed', state, fielded, ['panel:units', `mobile:unit:${lux.id}`, `deploy:${cell.col},${cell.row}`]);
    state = fielded;
  }

  // The real 2-1 combat: the full recorded ledger must equal the replayed one.
  const started = api.startMatchCombat(state);
  let fought = accepted(started, 'start 2-1');
  const events = started.events.filter(event => 'tick' in event);
  while (fought.phase === 'combat') { const next = api.stepMatch(fought); fought = next.state; events.push(...next.events.filter(event => 'tick' in event)); }
  const combat = step('b8-rageblade-2-1-combat', state, fought, ['mobile:start-combat']);
  same(combat.actual.combatEvents, plain(events), 'B8 Rageblade evidence: combat ledger equals the replayed combat');
  assert.equal(cursor, chain.length, 'B8 Rageblade evidence: no unreplayed interaction in the chain');

  assert.equal(fought.roundDefinitionId, '2-1');
  assert(fought.combat?.status === 'finished' && fought.combat.tick === summary.combatTicks, 'B8 Rageblade evidence: combat ticks');
  assert(events.some(event => event.type === 'statChanged' && event.unitId === lux.id && event.source?.definitionId === 'rageblade'),
    'B8 Rageblade evidence: Rageblade statChanged for Lux');
  const unit = fought.combat.units.find(entry => entry.id === lux.id);
  assert(unit, 'B8 Rageblade evidence: Lux in the replayed combat');
  assert.equal(summary.frozenAttackIntervalTicks, unit.attackIntervalTicks, 'frozen interval is the CombatUnit field');
  assert.equal(summary.currentAttackIntervalTicks, readCombatStats(unit, fought.combat).attackIntervalTicks, 'current interval is readCombatStats');
  assert(summary.currentAttackIntervalTicks < summary.frozenAttackIntervalTicks, 'Rageblade attacks raised attack speed');
}
module.exports = { validateB8RagebladeEvidence };
