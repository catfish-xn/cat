import { beforeAll, describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import type { MatchCommandResult, MatchEvent, MatchState } from '../src/simulation/match-types';
import { run } from '../scripts/generate-m5-route.cjs';
import { Ledger, COMPONENTS, investment, lootIndex, lootPlan, settlement, validateLoot, validateLootTransition } from './fixtures/m5/oracle.cjs';

type Command = { type: string; [key: string]: unknown } | undefined;
type Transition = { before: MatchState; after: MatchState; command: Command; events: readonly MatchEvent[] };
let initial: MatchState, timeline: Transition[], pending: MatchState;
function openingWithRealConsumedReward() {
  let state = api.createMatch(1);
  initial = state; timeline = [];
  const ledger = new Ledger(initial);
  const take = (result: MatchCommandResult | { readonly state: MatchState; readonly events: readonly MatchEvent[] }, command?: Command) => {
    if ('ok' in result) { expect(result.ok).toBe(true); if (!result.ok) throw Error(result.reason); }
    const before = state; state = result.state;
    ledger.apply(before, state, command, result.events);
    timeline.push({ before, after: state, command, events: result.events });
  };
  const battle = () => { take(api.startMatchCombat(state), { type: 'start' });
    for (let i = 0; state.phase === 'combat' && i < 1201; i++) take(api.stepMatch(state));
  };
  battle(); expect(state.roundResults[0].result).toBe('playerWin');
  take(api.nextRound(state, 1), { type: 'continue', round: 1 });
  // Seed 1 has two natural Lux offers at 1-3. Pay the actual 2G from 1-2.
  for (const slot of [0, 4]) take(api.buyUnit(state, slot, state.shop.generation), { type: 'buy', slot, generation: state.shop.generation });
  take(api.deployMatchUnit(state, 'unit-2', { kind: 'board', cell: { col: 1, row: 7 } }), { type: 'deploy', id: 'unit-2' });
  battle(); expect(state.phase).toBe('choice'); pending = state;
}
function prefixLedger(count = timeline.length) {
  const ledger = new Ledger(initial);
  for (const t of timeline.slice(0, count)) ledger.apply(t.before, t.after, t.command, t.events);
  return ledger;
}
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
const copy = <T>(value: T): Mutable<T> => structuredClone(value) as Mutable<T>;

beforeAll(openingWithRealConsumedReward);

describe('independent B8 oracle arithmetic and frozen reference', () => {
  it.each([
    [9, 10, 1, 16, 88, 0, 14, 80],
    [49, 50, 5, 60, 120, 4, 58, 112],
    [50, 51, 5, 61, 120, 5, 60, 120],
  ])('pins LOOT A3 at %iG: direct gold before interest, heroes never become gold', (gold, basis, interest, after, hp, heroInterest, heroAfter, heroHp) => {
    // Isolated oracle inputs, not a forged production Match or an implementation-generated expectation.
    const before = { round: 10, gold, level: 4, xp: 0, playerHp: 64, streak: { kind: null, count: 0 },
      augments: [{ definitionId: 'investment-strategy-i' }], augmentProgress: { pumpingRounds: 0, investmentHp: 80 } };
    const combat = { result: 'playerWin' as const, tick: 23, nextEventSeq: 147, units: [] };
    const goldResult = settlement({ ...before, gold: gold + 1 }, combat);
    expect(goldResult).toMatchObject({ interestBasis: basis, goldBefore: basis, goldAfter: after,
      incomeBreakdown: { base: 5, win: 0, interest, streak: 0 }, hpAfter: 64, combatEventCount: 147 });
    expect(investment(before, goldResult).investmentHp).toBe(hp);
    const heroResult = settlement(before, combat);
    expect(heroResult).toMatchObject({ interestBasis: gold, goldAfter: heroAfter, incomeBreakdown: { interest: heroInterest } });
    expect(investment(before, heroResult).investmentHp).toBe(heroHp);
    expect(investment({ ...before, augments: [] }, goldResult).investmentHp).toBe(80);
  });

  it('pins accepted and rejected words using independent unbounded integer arithmetic', () => {
    expect(lootIndex({ state: 2463395136, draws: 41 }, 100)).toEqual({ index: 99, rng: { state: 4294967199, draws: 42 } });
    expect(lootIndex({ state: 2444543493, draws: 41 }, 100)).toEqual({ index: 23, rng: { state: 854109823, draws: 43 } });
    expect(lootIndex({ state: 653637408, draws: 41 }, 5)).toEqual({ index: 3, rng: { state: 1012239698, draws: 43 } });
    expect(lootIndex({ state: 653637408, draws: 41 }, 3)).toEqual({ index: 2, rng: { state: 1012239698, draws: 43 } });
    expect(lootIndex({ state: 653637408, draws: 41 }, 8)).toEqual({ index: 7, rng: { state: 4294967295, draws: 42 } });
  });

  it('pins full-plan source order, all eight pools, four hero tiers and fixed terminal 5G', () => {
    const plan = lootPlan(230, 38);
    expect(plan.rng).toEqual({ state: 3625804339, draws: 18 });
    expect(plan.rounds.flatMap((r) => r.choices.map((c) => c.terminalFallbackDefinitionId))).toEqual(['cloak', 'rod', 'tear', 'rod', 'tear', 'vest']);
    expect(plan.rounds.slice(3, 7).map((r) => r.encounterPlan.drops[1].payload)).toEqual(
      ['maddie', 'urgot', 'ezreal', 'garen'].map(definitionId => ({ kind: 'unit', definitionId, quantity: 1 })));
    expect(plan.rounds[7].encounterPlan.drops[0].payload).toEqual({ kind: 'gold', quantity: 5 });
    expect(plan.rounds[7].choices).toEqual([]);
    expect(lootPlan(230, 31).rng).toEqual(plan.rng);
    expect(COMPONENTS).toEqual(['sword', 'vest', 'belt', 'rod', 'cloak', 'bow', 'gloves', 'tear']);
  });
});

describe('independent B8 oracle checks authentic command transitions', () => {
  it('counts a real reward candidate even when immediately consumed by its upgrade', () => {
    const transition = timeline.find(t => t.events.some(e => e.type === 'unitUpgraded'))!;
    expect(transition).toBeDefined();
    const receipt = transition.after.m8.loot.receipts.find(r => r.payload.kind === 'unit' && r.payload.definitionId === 'lux')!;
    expect(receipt.grantedUnitIds).toEqual(['unit-5']);
    expect(transition.after.preparation.units.some(u => u.id === 'unit-5')).toBe(false);
    expect(transition.after.preparation.units.find(u => u.id === 'unit-3')?.starLevel).toBe(2);
    expect(prefixLedger().cards).toBe(5);
    const invalid = copy(transition.after);
    invalid.m8.loot.receipts.at(-1)!.grantedUnitIds = ['unit-3'];
    const events = copy(transition.events);
    events.find(e => e.type === 'lootGranted')!.receipt = invalid.m8.loot.receipts.at(-1)!;
    expect(() => prefixLedger(timeline.indexOf(transition)).apply(transition.before, invalid, transition.command, events)).toThrow('true loot candidate serial');
  });

  it.each(['sword', 'vest', 'belt', 'rod', 'cloak', 'bow', 'gloves', 'tear'])('validates actual %s choice, one LootReceipt and no ScheduleReceipt', definitionId => {
    const c = pending.pendingChoice!;
    const result = api.selectChoice(pending, c.choiceId, c.generation, definitionId);
    expect(result.ok).toBe(true); if (!result.ok) return;
    const ledger = prefixLedger();
    ledger.apply(pending, result.state, { type: 'select', choiceId: c.choiceId, generation: c.generation, definitionId }, result.events);
    expect(result.state.scheduleReceipts).toEqual(pending.scheduleReceipts);
    expect(result.state.m8.loot.receipts.length).toBe(pending.m8.loot.receipts.length + 1);
    expect(result.state.items[0].definitionId).toBe(definitionId);
    const repeated = api.selectChoice(result.state, c.choiceId, c.generation, definitionId);
    expect(repeated.ok).toBe(false); expect(repeated.state).toBe(result.state);
    ledger.apply(result.state, repeated.state, undefined, []);
  });

  it('rejects duplicate grant, reveal and resolution events independently of event-sequence checks', () => {
    for (const type of ['lootGranted', 'lootRevealed']) {
      const t = timeline.find(t => t.events.some(e => e.type === type))!;
      const event = t.events.find(e => e.type === type)!;
      expect(() => validateLootTransition(t.before, t.after, t.command, [...t.events, event])).toThrow('exactly one event');
    }
    const c = pending.pendingChoice!, result = api.selectChoice(pending, c.choiceId, 0, 'gloves');
    if (!result.ok) throw Error(result.reason);
    const command = { type: 'select', choiceId: c.choiceId, generation: 0, definitionId: 'gloves' };
    expect(() => validateLootTransition(pending, result.state, command,
      [...result.events, result.events.find(e => e.type === 'lootChoiceResolved')!])).toThrow('exactly one event');
  });

  it.each(['wrong payload', 'wrong source', 'duplicate receipt', 'unearned receipt', 'wrong fallback', 'missing candidate'])('rejects %s instead of blessing mutated production output', corruption => {
    const t = timeline.find(t => t.events.some(e => e.type === 'lootGranted'))!;
    const invalid = copy(corruption === 'wrong fallback' || corruption === 'missing candidate' ? pending : t.after);
    if (corruption === 'wrong payload') invalid.m8.loot.receipts[0].payload = { kind: 'unit', definitionId: 'caitlyn', quantity: 1 };
    if (corruption === 'wrong source') invalid.m8.loot.frozen.rounds[0].encounterPlan.drops[0].sourceUnitId = '["pve","1-2","minions-a-v1","m02"]';
    if (corruption === 'duplicate receipt') invalid.m8.loot.receipts.push(copy(invalid.m8.loot.receipts[0]));
    if (corruption === 'unearned receipt') invalid.m8.loot.earnedEvidence = [];
    if (corruption === 'wrong fallback') invalid.m8.loot.frozen.rounds[1].choices[0].terminalFallbackDefinitionId = 'sword';
    if (corruption === 'missing candidate') invalid.pendingChoice!.offers.pop();
    expect(() => validateLoot(invalid)).toThrow();
  });

  it('validates pre-frozen fallback identity and rejects a second schedule grant', () => {
    const descriptor = pending.m8.loot.frozen.rounds[1].choices[0], c = pending.pendingChoice!;
    const result = api.selectChoice(pending, c.choiceId, 0, descriptor.terminalFallbackDefinitionId);
    if (!result.ok) throw Error(result.reason);
    // Oracle-only adversarial receipt shapes; no production function consumes these copies.
    const fallback = copy(result.state);
    fallback.m8.loot.choiceResolutions[0].method = 'terminal-fallback';
    fallback.phase = 'gameOver';
    expect(() => validateLoot(fallback)).not.toThrow();
    fallback.m8.loot.receipts.at(-1)!.payload = { kind: 'item', definitionId: 'tear', quantity: 1 };
    expect(() => validateLoot(fallback)).toThrow('pre-frozen terminal fallback');
    const doubled = copy(result.state);
    doubled.scheduleReceipts.push({ eventId: c.eventId, round: 2, kind: 'component', itemIds: ['item-1'], gold: 0, unitId: null, definitionId: descriptor.terminalFallbackDefinitionId });
    expect(() => validateLoot(doubled)).toThrow('approved schedule receipt source');
  });

  it.each([42, 230])('runs the complete real cannon route, seed %i, through the unchanged public-command driver', async seed => {
    const route = await run(api, { seed, build: 'cannon' });
    expect(route.final.roundDefinitionId).toBe('6-7');
    expect(route.final.roundResults).toHaveLength(38);
    expect(route.rounds).toHaveLength(33);
    expect(route.final.m8.loot.receipts.filter((r: MatchState['m8']['loot']['receipts'][number]) => r.payload.kind === 'item')).toHaveLength(10);
    expect(route.final.scheduleReceipts.filter((r: MatchState['scheduleReceipts'][number]) => r.kind === 'component')).toHaveLength(5);
    expect(Object.values(route.final.m8.loot.guaranteeCounters)).toEqual([0, 1, 1, 2, 2, 2, 2, 0]);
    if (seed === 230) expect(route.final.m8.loot.receipts.filter((r: MatchState['m8']['loot']['receipts'][number]) => r.payload.kind === 'unit')
      .map((r: MatchState['m8']['loot']['receipts'][number]) => r.payload)).toEqual(
        ['maddie', 'lux', 'maddie', 'urgot', 'ezreal', 'garen'].map(definitionId => ({ kind: 'unit', definitionId, quantity: 1 })));
  }, 120000);
});
