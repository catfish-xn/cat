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
/** Authenticate openings from the claim or the pre-settlement FIFO and raw tables, never a reward receipt. */
function validatePipelineClaim(before, after, command, events) {
 const prior = before.augmentHistory?.facts ?? [], next = after.augmentHistory?.facts ?? [];
 assert.deepEqual(next.slice(0, prior.length), prior, 'augment history facts append-only');
 const openings = next.slice(prior.length).filter(f => f.kind === 'orb-opened');
 const a = before.augments.find(a => a.definitionId === 'prismatic-pipeline');
 if (!a) { assert.equal(openings.length, 0, 'no pipeline opening without its owner'); return; }
 // PvE has a combat phase; PvP retains preparation with the server roster lock.
 // A queued intent only drains when this round really settles, not on another combat command.
 const settlement = (before.phase === 'combat' || before.multiplayer?.combatRosterLocked === true)
  && after.phase !== 'combat' && after.round === before.round
  && !before.roundResults.some(r => r.round === before.round) && after.roundResults.some(r => r.round === before.round)
  && events.some(e => e.type === 'roundSettled' && e.round === before.round);
 const queued = settlement ? before.m8.loot.queuedOrbClaims ?? [] : [];
 assert.equal(new Set(queued).size, queued.length, 'queued claims must be unique');
 if (queued.length) assert.deepEqual(after.m8.loot.queuedOrbClaims ?? [], [], 'settlement drains the claim queue');
 const ids = settlement ? queued : command?.type === 'claimOrb' ? [command.orbId] : [];
 if (!ids.length) { assert.equal(openings.length, 0, 'no pipeline opening without an owned claim or queued settlement'); return; }
 const natural = require('../orb-combo-oracle.cjs').lootPlan(before.seed, before.round, before.augmentTierSeed).rounds.flatMap(r => r.orbs);
 const plans = [...natural, ...pipelineOrbs(before)];
 const orbs = ids.map(id => plans.find(o => o.orbId === id)).filter(Boolean);
 const complete = (s, orb) => orb.entries.every(e => s.m8.loot.direct.some(d => d.dropId === e.dropId && d.status === 'granted'));
 const due = orbs.filter(orb => orb.tier === 'prismatic' && !complete(before, orb) && complete(after, orb));
 assert.deepEqual(openings.map(f => f.orbId), due.map(orb => orb.orbId), 'one pipeline history trigger per completed prismatic claim in FIFO order');
 for (const r of after.m8.loot.receipts.slice(before.m8.loot.receipts.length)) {
  const e = orbs.flatMap(orb => orb.entries).find(e => e.dropId === r.dropId);
  if (!settlement && orbs.length) assert(e, 'claim can only grant entries of the independently planned orb');
  if (e) assert.deepEqual(r.payload, e.payload, 'independent partial or complete orb payload');
 }
 for (const [i, orb] of due.entries()) {
  const f = openings[i];
  assert(!prior.some(old => old.kind === 'orb-opened' && old.orbId === orb.orbId), 'pipeline orb cannot open twice');
  assert.equal(f.choiceId, a.choiceId); assert.equal(f.orbId, orb.orbId); assert.equal(f.tier, 'prismatic');
  assert.equal(f.round, before.round); assert.equal(f.roundId, before.roundDefinitionId); assert.equal(f.seatId, before.multiplayer?.seatId ?? 'solo');
  assert(f.resourcePrefix >= before.resourceProvenance.entries.length && f.resourcePrefix <= after.resourceProvenance.entries.length);
  for (const e of orb.entries) {
   const receipt = after.m8.loot.receipts.find(r => r.dropId === e.dropId);
   assert(receipt, 'opened pipeline base entry needs a claim');
   assert.deepEqual(receipt.payload, e.payload, 'pipeline base payload independently sampled');
   if (!before.m8.loot.receipts.some(r => r.dropId === e.dropId)) {
    const granted = events.find(ev => ev.type === 'lootGranted' && ev.receipt.dropId === e.dropId);
    assert(granted, 'opened pipeline base entry needs a loot event');
    assert.deepEqual(granted.receipt, receipt, 'loot event must match the independently checked receipt');
   }
  }
 }
}
module.exports = { draws, expectedRolls, pipelineOrbs, pipelineBonuses, validatePipelineClaim };
