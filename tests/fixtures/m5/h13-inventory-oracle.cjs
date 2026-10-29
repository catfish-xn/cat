/* Independent P-B5-20/22/23 inventory obligations. Literal test pools/recipes only. */
const assert = require('node:assert/strict');
const { pools } = require('../../augment-reward-pools-oracle-data.cjs');
const { RECIPES } = require('./augment-batch5-s3b-oracle.cjs');
const MOD = 4294967296n;
function draw(state, choiceId, round, item, pool) {
 let hash = 2166136261n;
 for (const char of JSON.stringify(['batch5-h13', state.multiplayer?.seatId ?? 'solo', choiceId, round, item]))
  hash = ((hash ^ BigInt(char.charCodeAt(0))) * 16777619n) % MOD;
 const word = ((BigInt(state.seed) ^ hash) * 1664525n + 1013904223n) % MOD;
 return pool[Number(word * BigInt(pool.length) / MOD)];
}
function transformPlan(before, after, command) {
 const expected = [], entries = [];
 let serial = before.nextItemSerial;
 function transform(owner, original, definitions) {
  const input = { ...original, location: { kind: 'inventory' } };
  expected.push({ kind: 'augment-item-transform', choiceId: owner.choiceId,
   receiptId: JSON.stringify(['batch5-h13', owner.choiceId, after.round, input.id]), input,
   outputs: definitions.map(definitionId => ({ id: `item-${serial++}`, definitionId, location: { kind: 'inventory' } })) });
 }
 for (const owner of before.augments) {
  if (command?.type === 'continue' && ['artifactory', 'pandoras-items-iii'].includes(owner.definitionId)
    && owner.acquiredRound < after.round) {
   const eligible = before.items.filter(item => item.location.kind === 'inventory' &&
    (RECIPES[item.definitionId] || owner.definitionId === 'pandoras-items-iii' && pools.component.includes(item.definitionId)))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
   for (const item of eligible) {
    const pool = owner.definitionId === 'artifactory' ? pools.artifact
     : pools.component.includes(item.definitionId) ? pools.component : pools.completed;
    transform(owner, item, [draw(before, owner.choiceId, after.round, item.id, pool)]);
   }
   entries.push({ kind: 'inventory-transform-entry', choiceId: owner.choiceId, itemIds: eligible.map(item => item.id) });
  }
  if (command?.type === 'sell' && owner.definitionId === 'salvage-bin-plus') {
   for (const item of before.items.filter(item => item.location.kind === 'unit' && item.location.unitId === command.id
     && RECIPES[item.definitionId]).sort((a, b) => a.location.slot - b.location.slot))
    transform(owner, item, RECIPES[item.definitionId]);
  }
 }
 return { expected, entries, inputs: expected.length, outputs: serial - before.nextItemSerial };
}
function validateTransforms(before, after, command) {
 const plan = transformPlan(before, after, command);
 const added = after.resourceProvenance.entries.slice(before.resourceProvenance.entries.length);
 const strip = ({ sequence, roundId, round, seatId, resourcePrefix, ...fact }) => {
  assert.equal(roundId, after.roundDefinitionId, 'independent H13 transform round');
  if (round !== undefined) assert.equal(round, after.round, 'independent H13 history ordinal');
  if (seatId !== undefined) assert.equal(seatId, before.multiplayer?.seatId ?? 'solo', 'independent H13 history seat');
  if (resourcePrefix !== undefined && fact.kind === 'augment-item-transform') {
   const index = added.findIndex(row => row.kind === fact.kind && row.receiptId === fact.receiptId);
   assert(index >= 0, 'H13 history requires resource evidence');
   assert.equal(resourcePrefix, before.resourceProvenance.entries.length + index, 'independent H13 resource prefix');
  }
  return fact;
 };
 assert.deepEqual(added.filter(f => f.kind === 'augment-item-transform').map(strip), plan.expected,
  'independent H13 complete transforms, identities, categories, draws and serials');
 const history = (after.augmentHistory?.facts ?? []).slice(before.augmentHistory?.facts.length ?? 0);
 assert.deepEqual(history.filter(f => f.kind === 'augment-item-transform').map(strip), plan.expected,
  'independent H13 transform history');
 assert.deepEqual(history.filter(f => f.kind === 'inventory-transform-entry').map(strip), plan.entries,
  'independent H13 once-only entry coverage');
 for (const fact of plan.expected) {
  assert(!after.items.some(item => item.id === fact.input.id), 'H13 consumes original instance');
  for (const output of fact.outputs) assert.deepEqual(after.items.find(item => item.id === output.id), output,
   'independent H13 permanent output');
 }
 return plan;
}
module.exports = { transformPlan, validateTransforms };
