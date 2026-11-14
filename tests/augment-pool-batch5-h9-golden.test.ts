import { expect, it } from 'vitest';
import { buyXp, createMatch, deployMatchUnit, equipItem, nextRound, rerollAugment, rerollShop, selectAnomalyTarget, selectChoice, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { equipArmyItems } from './fixtures/army-items';
import { grantMechanicUnit } from '../src/simulation/seat-mechanics/grants';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { freeRerollsAvailable } from '../src/simulation/free-rerolls';
import { goldenFindGoldPlan, GOLDEN_FIND_SOURCE, settleBatch5H9History } from '../src/simulation/augment-pool-batch5-h9';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { getCatalogRoundByOrdinal } from '../src/simulation/round-selectors';
import { accepted, emptyBoard, fieldBench, resolveM5Choices } from './match-helpers';
import { augmentPool, freeRerollCredits } from './fixtures/m5/oracle.g2.cjs';

/** v25 pool: first fielded 4-2 seed in 0..100 after rerolls 0/1/2 (seed 17).
 * v26 D5 (7953c99a) and the 14.24 neutral fights moved that route: seed 17 no longer shows a-golden-find.
 * Re-search on the full-field route found seeds 5, 30, 79. Seeds 5 and 30 already own a history augment
 * before 4-2, so the legacy checkpoint would replay the whole game. Seed 79 does not (sentinel-slam,
 * item-grab-bag-i) and rerolls 0/1/2 still offer a-golden-find,moonlight,support-cache, but fielding every
 * round is about 7039 ticks / 7s and does not fit in one 5s case.
 * Seed 170 keeps the same shape: no augmentHistory before the pick (beggars-can-be-choosers, branching-out),
 * rerolls 0/1/2 still contain a-golden-find. Field 1-2, 1-3, 1-4, 2-2 and 2-3, and only Gangplank at 4-1.
 * The full 4-1 board is a 383-tick loss whose rerolled offers are clockwork-accelerator,a-golden-find,conqueror-crest.
 * Gangplank alone is a 127-tick loss and the offers become crownguard-spirit,a-golden-find,salvage-bin-plus.
 * HP at 4-2 is 4; the old full-field seed 79 arrived at 23. Later fights still have to be wins. */
const H9_GOLDEN_FIND = { seed: 170, rerolls: [0, 1, 2] as const };
const H9_ROUTE = Array.from({ length: getCatalogRoundByOrdinal(19).ordinal }, (_, index) => getCatalogRoundByOrdinal(index + 1).roundId);
const FIELD_ROUNDS = new Set(['1-2', '1-3', '1-4', '2-2', '2-3']);

function fieldRound(state: MatchState, roundId: string): MatchState {
  if (roundId === '4-1') {
    const benched = emptyBoard(state);
    const unit = benched.preparation.units.find(u => u.team === 'player' && u.definitionId === 'gangplank');
    if (!unit) throw new Error('seed 170 no longer has Gangplank at 4-1');
    return accepted(deployMatchUnit(benched, unit.id, { kind: 'board', cell: { col: 0, row: 4 } }));
  }
  return FIELD_ROUNDS.has(roundId) ? fieldBench(state) : emptyBoard(state);
}
function finishRound(state: MatchState): MatchState {
  const roundId = state.roundDefinitionId;
  let next = resolveM5Choices(state);
  if (next.phase === 'preparation') {
    next = accepted(startMatchCombat(fieldRound(next, roundId)));
    while (next.phase === 'combat') next = stepMatch(next).state;
  }
  next = resolveM5Choices(next);
  if (next.phase !== 'settlement') throw new Error(`Cannot leave ${roundId}/${next.phase}`);
  return accepted(nextRound(next, next.round));
}
function reach(roundId: string): MatchState {
  let state = createMatch(H9_GOLDEN_FIND.seed);
  while (state.roundDefinitionId !== roundId) state = finishRound(state);
  return state;
}
function rerollGoldenFind(state: MatchState): MatchState {
  for (const slot of H9_GOLDEN_FIND.rerolls) {
    const choice = state.pendingChoice!;
    state = accepted(rerollAugment(state, choice.choiceId, choice.generation, slot));
  }
  return state;
}
interface Acquired { readonly acquired: MatchState; readonly anomalyTarget: string; readonly priorCredits: number }
function acquireGoldenFind(): Acquired {
  let state = rerollGoldenFind(reach('4-2'));
  expect(state.roundDefinitionId).toBe('4-2');
  expect(state.augmentHistory).toBeUndefined();
  expect(state.pendingChoice?.offers).toContain('a-golden-find');
  const grant = grantMechanicUnit(state, { receiptId: 'h9-kill-witness', source: 'test', definitionId: 'viktor', starLevel: 3 });
  expect(grant.ok).toBe(true); if (!grant.ok) throw new Error(grant.reason);
  const open = restoreMatch(serializeMatch(grant.state));
  const anomalyTarget = open.preparation.units.find(u => u.definitionId === 'viktor')!.id;
  expect(anomalyTarget).toBeTruthy();
  const choice = open.pendingChoice!;
  expect(choice.offers).toContain('a-golden-find');
  const priorCredits = freeRerollsAvailable(open);
  const acquired = accepted(selectChoice(open, choice.choiceId, choice.generation, 'a-golden-find'));
  expect(acquired.augments.some(augment => augment.definitionId === 'a-golden-find')).toBe(true);
  return { acquired, anomalyTarget, priorCredits };
}
function awardGoldenFind(): Acquired & { readonly paid: MatchState } {
  const { acquired, anomalyTarget, priorCredits } = acquireGoldenFind();
  let armed = acquired;
  while (armed.gold >= 4 && armed.level < 8) armed = accepted(buyXp(armed));
  armed = fieldBench(armed);
  armed = equipArmyItems(armed, anomalyTarget);
  for (const item of armed.items.filter(i => i.location.kind === 'inventory')) for (const unit of armed.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').sort((a, b) => Number(b.id === anomalyTarget) - Number(a.id === anomalyTarget))) {
    let done = false;
    for (let slot = 0; slot < 3; slot++) {
      const equipped = equipItem(armed, item.id, unit.id, slot);
      if (equipped.ok) { armed = equipped.state; done = true; break; }
    }
    if (done) break;
  }
  const deployment = armed.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board');
  expect(deployment.some(unit => unit.id === anomalyTarget)).toBe(true);
  expect(armed.level).toBeGreaterThanOrEqual(8);
  let state = armed;
  let paid = state;
  for (const node of ['4-2', '4-3', '4-4', '4-5', '4-6', '4-7']) {
    expect(state.roundDefinitionId).toBe(node);
    if (node === '4-6') {
      const pending = state.pendingChoice!;
      expect(pending.step).toBe('target');
      state = accepted(selectAnomalyTarget(state, pending.choiceId, pending.generation, anomalyTarget));
    }
    state = resolveM5Choices(state);
    if (node === '4-2' || node === '4-3') for (const unit of deployment) if (state.preparation.units.find(u => u.id === unit.id)?.location.kind !== 'board') state = accepted(deployMatchUnit(state, unit.id, unit.location));
    if (state.phase === 'preparation') state = accepted(startMatchCombat(state));
    while (state.phase === 'combat') state = stepMatch(state).state;
    state = resolveM5Choices(state);
    const plan = goldenFindGoldPlan(state);
    if (node < '4-6') expect(plan).toEqual([]);
    else {
      const deaths = state.augmentHistory!.facts.filter(f => f.kind === 'deaths' && f.round >= 23).flatMap(f => f.kind === 'deaths' ? f.deaths : []);
      const kills = deaths.filter(d => d.team === 'enemy' && d.killer?.ownerId === anomalyTarget).length;
      expect(kills).toBeGreaterThanOrEqual(3);
      expect(plan.reduce((n, payout) => n + payout.amount, 0)).toBe(2 * Math.floor(kills / 3));
      expect(state.seatMechanics!.receipts.filter(r => r.source === GOLDEN_FIND_SOURCE).map(r => r.kind === 'gold' ? r.amount : 0)).toEqual(plan.map(p => p.amount));
      expect(settleBatch5H9History(state).state).toBe(state);
      expect(stepMatch(state).state).toBe(state);
      paid = state;
    }
    if (node !== '4-7') state = accepted(nextRound(state, state.round));
  }
  return { acquired, paid, anomalyTarget, priorCredits };
}

it('offers Golden Find only at 4-2 in the production and independent pools', () => {
  for (const node of ['2-1', '3-2', '4-2']) {
    expect(augmentOfferAllowed('a-golden-find', [], { node, fieldedTraits: [], blocked: [] })).toBe(node === '4-2');
    expect(augmentPool('gold', [], [], `round:${node}:augment`, []).includes('a-golden-find')).toBe(node === '4-2');
  }
});
it('opens the golden-find seed at 1-2', () => {
  expect(createMatch(H9_GOLDEN_FIND.seed).roundDefinitionId).toBe(H9_ROUTE[0]);
});
it.each(H9_ROUTE.slice(1))('reaches %s on the public golden-find route', roundId => {
  expect(reach(roundId).roundDefinitionId).toBe(roundId);
});
it('acquires Golden Find from a legacy checkpoint that owns no earlier history', () => {
  acquireGoldenFind();
});
it('grants ten spendable shop rerolls immediately, survives restore and refuses duplicate selection', () => {
  const { acquired, priorCredits } = acquireGoldenFind();
  expect(freeRerollsAvailable(acquired)).toBe(priorCredits + 10);
  expect(freeRerollCredits(acquired)).toBe(priorCredits + 10);
  let spent = acquired;
  for (let i = 0; i < 10; i++) {
    const before = spent;
    spent = accepted(rerollShop(spent));
    expect(spent.gold).toBe(before.gold);
  }
  expect(freeRerollsAvailable(spent)).toBe(priorCredits);
  expect(restoreMatch(serializeMatch(spent))).toEqual(spent);
  const failed = selectChoice(acquired, acquired.augments.at(-1)!.choiceId, 0, 'a-golden-find');
  expect(failed.ok).toBe(false);
  expect(failed.state).toBe(acquired);
});
it('prepares a real army using paid XP and inventory equipment', () => {
  const { anomalyTarget, acquired } = acquireGoldenFind();
  let armed = acquired;
  while (armed.gold >= 4 && armed.level < 8) armed = accepted(buyXp(armed));
  armed = equipArmyItems(fieldBench(armed), anomalyTarget);
  expect(armed.level).toBeGreaterThanOrEqual(8);
  expect(armed.preparation.units.some(unit => unit.id === anomalyTarget && unit.location.kind === 'board')).toBe(true);
});
it('executes real 4-2 through 4-7 combat and pays only original anomaly-holder kills', () => {
  const { paid } = awardGoldenFind();
  // paid is the 4-7 post-combat state. The original case also left that round.
  accepted(nextRound(paid, paid.round));
});
it('serializes the awarded state through the validating save entry', () => {
  const { paid } = awardGoldenFind();
  expect(JSON.parse(serializeMatch(paid))).toEqual(paid);
});
it.each(['object', 'JSON', 'serialized'] as const)('%s: round-trips awarded gold and rejects every tampered save', entry => {
  const { acquired, paid, anomalyTarget } = awardGoldenFind();
  const paidSerialized = entry === 'serialized' ? serializeMatch(paid) : '';
  const restore = (s: MatchState) => entry === 'object' ? restoreMatch(s) : entry === 'JSON' ? restoreMatch(JSON.stringify(s)) : restoreMatch(s === paid ? paidSerialized : JSON.stringify(s));
  expect(restore(paid)).toEqual(paid);
  expect(requireAugmentFacts(paid, 'combat-binding', 23)[0].binding?.unitId).toBe(anomalyTarget);
  expect(rerollShop(restore(acquired))).toEqual(rerollShop(acquired));
  for (const kind of ['missing-history', 'killer', 'binding', 'death-removal', 'gold', 'receipt-removal', 'free-spend'] as const) {
    const bad: any = structuredClone(paid);
    if (kind === 'missing-history') delete bad.augmentHistory;
    if (kind === 'killer') bad.augmentHistory.facts.find((f: any) => f.kind === 'deaths' && f.round === 23 && f.deaths.some((d: any) => d.killer?.ownerId === anomalyTarget)).deaths.find((d: any) => d.killer?.ownerId === anomalyTarget).killer.ownerId = 'unit-1';
    if (kind === 'binding') bad.augmentHistory.facts.find((f: any) => f.kind === 'combat-binding' && f.round === 23).binding.unitId = 'unit-1';
    if (kind === 'death-removal') bad.augmentHistory.facts.find((f: any) => f.kind === 'deaths' && f.round === 23 && f.deaths.length).deaths.pop();
    if (kind === 'gold') bad.seatMechanics.receipts.find((r: any) => r.source === GOLDEN_FIND_SOURCE).amount += 2;
    if (kind === 'receipt-removal') bad.seatMechanics.receipts = bad.seatMechanics.receipts.filter((r: any) => r.source !== GOLDEN_FIND_SOURCE);
    if (kind === 'free-spend') bad.seatMechanics.seat['free-shop-rerolls'] = { used: 1 };
    expect(() => restore(bad)).toThrow();
  }
});
