/* P-B5-82, user approved 2026-10-27. Literal Gemini primary table + 14.24 economy 7/15/20.
 * No production imports or reward-receipt reads. BigInt independently implements the stream. */
const assert = require('node:assert/strict');
const modulus = 2n ** 32n;
function draws(s, identity, sizes) {
 let cursor = 2166136261n;
 for (const c of JSON.stringify(['augment-pool-batch5-g5', s.seed, s.multiplayer?.seatId ?? 'solo', ...identity]))
  cursor = ((cursor ^ BigInt(c.charCodeAt(0))) * 16777619n) % modulus;
 return sizes.map(n => {
  const width = modulus / BigInt(n), limit = width * BigInt(n);
  do { cursor = (cursor * 1664525n + 1013904223n) % modulus; } while (cursor >= limit);
  return Number(cursor / width);
 });
}
function expectedRolls(s) {
 const a = s.augments.find(a => a.definitionId === 'expected-unexpectedness');
 if (!a) return [];
 return [[2, a.acquiredRound], [3, 11], [4, 18]].filter(([, round]) => round <= s.round).map(([stage, round]) => {
  const dice = draws(s, [a.choiceId, 'dice', String(stage)], [6, 6, 6]).map(n => n + 1), sum = dice.reduce((a, b) => a + b, 0);
  const band = dice[0] === dice[1] && dice[1] === dice[2] ? 4 : sum < 9 ? 0 : sum < 12 ? 1 : sum < 16 ? 2 : 3;
  // [gold, free rolls, gift tuples]. The alternatives in parentheses in Gemini were not selected.
  const tables = {
   2: [[0, 7, []], [0, 0, [['R', 4, 2, 1]]], [2, 0, [['U', 'TFT_ArmoryKeyCompleted'], ['C', 'reforger', 3]]],
    [2, 0, [['C', 'masterwork-upgrade']]], [5, 0, [['I', 'TFT_Item_ForceOfNature']]]],
   3: [[15, 0, []], [10, 0, [['C', 'TFT_Consumable_ChampionDuplicator_III', 4]]], [2, 0, [['U', 'TFT_ArmoryKeyOrnn']]],
    [2, 0, [['Q', 'component', 3]]], [5, 0, [['Q', 'emblem', 2]]]],
   4: [[20, 0, []], [0, 0, [['R', 5, 3, 1]]], [2, 0, [['U', 'TFT_ArmoryKeySupport']]],
    [2, 0, [['Q', 'completed', 1], ['Q', 'component', 2]]], [5, 0, [['R', 5, 2, 1], ['C', 'TFT_Consumable_NeekosHelp']]]],
  };
  assert(tables[stage][band]);
  const [gold, rerolls, gifts] = tables[stage][band];
  return { stage, round, dice, band: ['economy', 'units', 'forge', 'equipment', 'jackpot'][band], gold, rerolls, gifts,
   owner: { ...a, acquiredRound: round, choiceId: JSON.stringify([a.choiceId, 'expected-unexpectedness', stage]) },
   receiptId: JSON.stringify(['augment-pool-batch5-g5', a.choiceId, 'dice', stage]) };
 });
}
function pipelineOrbs(s) {
 if (!s.multiplayer) return [];
 const a = s.augments.find(a => a.definitionId === 'prismatic-pipeline');
 if (!a) return [];
 const [round, roundId, encounter, carrier] = a.acquiredRound < 10 ? [10, '2-7', 'krugs-v1', 'k01'] : [17, '3-7', 'wolves-v1', 'w00'];
 if (s.round < round) return [];
 const sourceUnitId = JSON.stringify(['pve', roundId, encounter, carrier]);
 const natural = require('../orb-combo-oracle.cjs').lootPlan(s.seed, round, s.augmentTierSeed ?? s.seed).rounds.find(r => r.encounterPlan.roundId === roundId).orbs;
 const slotOrdinal = Math.max(-1, ...natural.filter(o => o.sourceUnitId === sourceUnitId).map(o => o.slotOrdinal)) + 1;
 const orbId = JSON.stringify(['orb', roundId, encounter, sourceUnitId, slotOrdinal]);
 const entries = require('../orb-combo-oracle.cjs').box(s.seed, orbId, 'ultraPlus').map((payload, entryOrdinal) => ({
  orbId, entryOrdinal, dropId: JSON.stringify([orbId, entryOrdinal]), roundId, encounterId: encounter, sourceUnitId,
  slotOrdinal, status: 'planned', receiptId: null, revealCondition: 'source-killed', payload,
 }));
 return [{ orbId, roundId, encounterId: encounter, sourceUnitId, slotOrdinal, tier: 'prismatic', templateId: 'ultraPlus', entries }];
}
function pipelineBonuses(s) {
 const a = s.augments.find(a => a.definitionId === 'prismatic-pipeline');
 if (!a) return [];
 return s.augmentHistory.facts.filter(f => f.kind === 'orb-opened' && f.choiceId === a.choiceId).map(f => {
  const ticket = a.acquiredRound === 4 ? -1 : draws(s, [a.choiceId, 'pipeline-bonus', f.orbId], [100])[0];
  const [gold, gifts] = ticket === -1 ? [8, []] : ticket < 34 ? [16, []] : ticket < 67 ? [0, [['Q', 'component', 2]]] : [6, [['R', 5, 2, 1]]];
  return { round: f.round, gold, gifts, owner: { ...a, acquiredRound: f.round, choiceId: JSON.stringify([a.choiceId, 'pipeline-bonus', f.orbId]) },
   receiptId: JSON.stringify(['augment-pool-batch5-g5', a.choiceId, 'pipeline-bonus', f.orbId]) };
 });
}
/** Authenticate the new history trigger from the actual claim + raw-table payloads, never a reward receipt. */
function validatePipelineClaim(before, after, command, events) {
 const prior = before.augmentHistory?.facts ?? [], next = after.augmentHistory?.facts ?? [];
 const openings = next.slice(prior.length).filter(f => f.kind === 'orb-opened');
 const a = before.augments.find(a => a.definitionId === 'prismatic-pipeline');
 if (!a || command?.type !== 'claimOrb') { assert.equal(openings.length, 0, 'no pipeline opening without an owned claim'); return; }
 const natural = require('../orb-combo-oracle.cjs').lootPlan(before.seed, before.round, before.augmentTierSeed).rounds.flatMap(r => r.orbs);
 const orb = [...natural, ...pipelineOrbs(before)].find(o => o.orbId === command.orbId);
 const complete = s => orb?.entries.every(e => s.m8.loot.direct.some(d => d.dropId === e.dropId && d.status === 'granted'));
 const due = orb?.tier === 'prismatic' && !complete(before) && complete(after);
 assert.equal(openings.length, due ? 1 : 0, 'one pipeline history trigger per completed prismatic claim');
 if (orb) for (const r of after.m8.loot.receipts.slice(before.m8.loot.receipts.length)) {
  const e = orb.entries.find(e => e.dropId === r.dropId);
  assert(e, 'claim can only grant entries of the independently planned orb');
  assert.deepEqual(r.payload, e.payload, 'independent partial or complete orb payload');
 }
 if (!due) return;
 const f = openings[0];
 assert.equal(f.choiceId, a.choiceId); assert.equal(f.orbId, orb.orbId); assert.equal(f.tier, 'prismatic');
 assert.equal(f.round, before.round); assert.equal(f.roundId, before.roundDefinitionId); assert.equal(f.seatId, before.multiplayer?.seatId ?? 'solo');
 assert(f.resourcePrefix >= before.resourceProvenance.entries.length && f.resourcePrefix <= after.resourceProvenance.entries.length);
 for (const e of orb.entries) {
  const receipt = after.m8.loot.receipts.find(r => r.dropId === e.dropId);
  assert(receipt, 'opened pipeline base entry needs a claim');
  assert.deepEqual(receipt.payload, e.payload, 'pipeline base payload independently sampled');
  if (!before.m8.loot.receipts.some(r => r.dropId === e.dropId)) assert(events.some(ev => ev.type === 'lootGranted' && ev.receipt.dropId === e.dropId));
 }
}
module.exports = { draws, expectedRolls, pipelineOrbs, pipelineBonuses, validatePipelineClaim };
