/* Independent P-B5-32/33/34 (docs/AUGMENT_BATCH5_GAPS.md): facts are inputs,
 * never production plans, trait projections, saved counters or reward receipts. */
const assert = require('node:assert/strict');
const data = require('./h4-traits-oracle-data.cjs');
const PORTFOLIO = 'augment-pool-batch5-h4', SURVIVOR = PORTFOLIO + '-survivor';
const sources = [PORTFOLIO, SURVIVOR];
const portfolio = id => ['diversified-portfolio', 'diversified-portfolio-plus'].includes(id);
// Approved project team-up membership, including Menaces' extra Dominator.
const partners = { sisters: ['jinx','vi'], mentorship: ['ambessa','caitlyn'], reunion: ['vi','ekko'],
  geniuses: ['heimerdinger','ekko'], menaces: ['powder','silco'], 'unlikely-duo': ['jinx','sevika'] };
const empty = new Set(['training-dummy','forming-dummy','tower-dummy','trainer-golem',
  'TFT_ArmoryKeyCompleted','TFT_ArmoryKeyComponent','TFT_ArmoryKeyOrnn','TFT_ArmoryKeySupport','TFT_ArmoryKeyRadiant']);
function activeTraits(roster, augments = []) {
  const field = roster.units.filter(u => u.team === 'player' && u.location.kind === 'board');
  const members = new Map();
  const add = (trait, definitionId) => {
    assert(data.thresholds[trait] || data.unique.includes(trait), 'independent H4 known trait ' + trait);
    if (!members.has(trait)) members.set(trait, new Set());
    members.get(trait).add(definitionId);
  };
  for (const unit of field) {
    const native = data.units[unit.definitionId] ?? (empty.has(unit.definitionId) ? [] : null);
    assert(native, 'independent H4 known fielded unit ' + unit.definitionId);
    for (const trait of native) add(trait, unit.definitionId);
    for (const item of roster.items) if (item.location.kind === 'unit' && item.location.unitId === unit.id) {
      const trait = data.emblems[item.definitionId];
      if (trait) add(trait, unit.definitionId);
    }
  }
  for (const a of augments) {
    const pair = partners[a.definitionId];
    if (!pair || !pair.every(id => field.some(u => u.definitionId === id))) continue;
    for (const id of pair) add(a.definitionId, id);
    if (a.definitionId === 'menaces') add('dominator', 'powder');
  }
  return [...members].filter(([trait, ids]) => trait === 'emissary'
    ? ids.size === 1 || ids.size === 4 : data.thresholds[trait] && ids.size >= data.thresholds[trait])
    .map(([trait]) => trait).sort();
}
function history(state) {
  const facts = state.augmentHistory?.facts;
  assert(facts, 'independent H4 history required');
  return facts;
}
function goldPlan(state) {
  const plan = [];
  for (const a of state.augments) {
    if (portfolio(a.definitionId)) for (let round = a.acquiredRound + 1; round <= state.round; round++) {
      const rows = history(state).filter(f => f.kind === 'round-entry' && f.round === round);
      assert.equal(rows.length, 1, 'independent H4 one entry roster per later natural round');
      const count = activeTraits(rows[0].roster, state.augments.filter(a => a.acquiredRound < round)).length;
      const amount = Math.floor(count / 3);
      if (amount) plan.push({receiptId: JSON.stringify([PORTFOLIO,a.choiceId,round]), source: PORTFOLIO, kind: 'gold', amount, round});
    }
    if (a.definitionId === 'survivor') {
      const facts = history(state), acquisitions = facts.filter(f => f.kind === 'acquire' && f.choiceId === a.choiceId);
      assert.equal(acquisitions.length, 1, 'independent H4 Survivor acquisition');
      const acquisition = acquisitions[0];
      assert.equal(acquisition.definitionId, 'survivor'); assert.equal(acquisition.round, a.acquiredRound);
      for (const f of facts) {
        if (f.sequence <= acquisition.sequence || f.kind !== 'table' || !['acquire','settlement'].includes(f.stage)) continue;
        assert.equal(f.seatId, state.multiplayer?.seatId ?? 'solo', 'independent H4 table owner');
        assert.equal(f.seats.length, state.multiplayer ? 8 : 1, 'independent H4 complete table');
        assert.equal(new Set(f.seats.map(s => s.seatId)).size, f.seats.length, 'independent H4 distinct seats');
        assert(f.round >= a.acquiredRound && f.round <= state.round, 'independent H4 table round');
        for (const seat of f.seats) assert(seat.alive ? seat.hp > 0 && seat.eliminatedRound === null
          : seat.hp === 0 && Number.isInteger(seat.eliminatedRound) && seat.eliminatedRound > 0 && seat.eliminatedRound <= f.round,
        'independent H4 elimination facts');
        const holder = f.seats.find(s => s.seatId === f.seatId);
        assert(holder, 'independent H4 holder in table');
        if (holder.alive && f.seats.filter(s => s.seatId !== holder.seatId && !s.alive).length >= 3) {
          plan.push({receiptId: JSON.stringify([SURVIVOR,a.choiceId]), source: SURVIVOR, kind: 'gold', amount: 60, round: f.round});
          break;
        }
      }
    }
  }
  return plan;
}
const isH4 = r => sources.includes(r.source) || sources.some(s => r.receiptId?.startsWith(JSON.stringify([s]).slice(0,-1) + ','));
const sort = rows => [...rows].sort((a,b) => a.receiptId.localeCompare(b.receiptId));
function validateTransition(before, after, command, events, base) {
  if (![...before.augments,...after.augments].some(a => portfolio(a.definitionId) || a.definitionId === 'survivor') &&
    !(after.seatMechanics?.receipts ?? []).some(isH4) && !events.some(e => e.type === 'mechanicGranted' && isH4(e.receipt))) return;
  const oldFacts = before.augmentHistory?.facts ?? [], newFacts = after.augmentHistory?.facts ?? [];
  assert.deepEqual(newFacts.slice(0,oldFacts.length), oldFacts, 'independent H4 history append-only');
  const added = newFacts.slice(oldFacts.length);
  for (const [i,f] of added.entries()) {
    assert.equal(f.sequence, oldFacts.length+i, 'independent H4 fact sequence');
    assert.equal(f.round, after.round, 'independent H4 fact timing');
    assert.equal(f.roundId, base.ROUNDS[f.round-1]?.roundId, 'independent H4 fact round identity');
    assert.equal(f.seatId, after.multiplayer?.seatId ?? 'solo', 'independent H4 fact owner');
  }
  const entries = added.filter(f => f.kind === 'round-entry');
  if (after.augments.some(a => portfolio(a.definitionId))) {
    assert.equal(entries.length, command?.type === 'continue' ? 1 : 0, 'independent H4 entry timing');
    if (entries.length) assert.deepEqual(entries[0].roster,
      {units: before.preparation.units.filter(u => u.team === 'player'), items: before.items}, 'independent H4 entry roster');
  }
  // The server hook is a separate transaction after every seat's elimination is known.
  if (command?.type === 'recordAugmentSettlementTable') {
    const tables = added.filter(f => f.kind === 'table' && f.stage === 'settlement');
    const already = oldFacts.some(f => f.kind === 'table' && f.stage === 'settlement' && f.round === before.round);
    const settled = before.roundResults.at(-1)?.round === before.round;
    assert.equal(tables.length, before.augmentHistory && settled && !already ? 1 : 0, 'independent H4 settlement table timing');
    if (tables.length) assert.deepEqual(tables[0].seats, command.seats, 'independent H4 authoritative table');
  }
  const prior = before.seatMechanics?.receipts ?? [], actual = after.seatMechanics?.receipts ?? [];
  assert.deepEqual(actual.slice(0,prior.length), prior, 'independent H4 receipts append-only');
  const complete = state => goldPlan(state).map(r => ({...r, roundId: base.ROUNDS[r.round-1]?.roundId}));
  const previousPlan = complete(before), nextPlan = complete(after);
  assert.deepEqual(sort(prior.filter(isH4)), sort(previousPlan), 'independent H4 prior payments');
  assert.deepEqual(sort(actual.filter(isH4)), sort(nextPlan), 'independent H4 complete payments (amount, round, unique receipt)');
  const due = nextPlan.filter(r => !previousPlan.some(p => p.receiptId === r.receiptId));
  for (const r of due) {
    assert.equal(r.round, after.round, 'independent H4 no late payments');
    if (r.source === PORTFOLIO) assert.equal(command?.type, 'continue', 'independent H4 portfolio only at entry');
    else {
      const stage = command?.type === 'select' ? 'acquire' : 'settlement';
      assert(added.some(f => f.kind === 'table' && f.stage === stage) &&
        (command?.type === 'select' || command?.type === 'recordAugmentSettlementTable' || before.phase === 'combat'),
      'independent H4 Survivor only after acquisition/table settlement');
    }
  }
  const grants = events.filter(e => e.type === 'mechanicGranted' && isH4(e.receipt));
  assert.deepEqual(sort(grants.map(e => e.receipt)), sort(due), 'independent H4 exactly one event per due payment');
  for (const e of grants) {
    assert.equal(e.domain, 'match', 'independent H4 grant domain');
    const preceding = events.slice(0,events.indexOf(e)).filter(e => e.domain === 'match').length;
    assert.equal(e.eventSeq, before.nextMatchEventSeq+preceding, 'independent H4 numbered grant');
  }
  if (grants.length) assert.equal(after.nextMatchEventSeq, before.nextMatchEventSeq + events.filter(e => e.domain === 'match').length,
    'independent H4 event sequence advancement');
  if (command?.type === 'recordAugmentSettlementTable') {
    assert.equal(after.gold, before.gold + due.reduce((sum,r) => sum+r.amount, 0), 'independent H4 table gold balance');
    assert.equal(after.nextMatchEventSeq, before.nextMatchEventSeq + grants.length, 'independent H4 table event sequence');
  }
}
module.exports = { goldPlan, activeTraits, validateTransition, sources };
