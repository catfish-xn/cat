import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import type { MatchEvent, MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { getUnitSellPrice } from '../src/simulation/unit-stats';
import { run } from '../scripts/generate-m5-route.cjs';

const players = (state: MatchState) => state.preparation.units.filter(unit => unit.team === 'player');
const bench = (state: MatchState) => players(state).filter(unit => unit.location.kind === 'bench');
const plan = (state: MatchState) => state.m8.loot.frozen.rounds.at(-1)!;
const counter = (roundId: string) => JSON.stringify(['m8b-loot-project-v1', roundId, 'components-granted']);
function accepted(result: api.MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(`Public capacity fixture: ${result.reason}`);
  return result.state;
}
function roundTrip(state: MatchState): MatchState {
  const saved = serializeMatch(state), restored = restoreMatch(saved);
  expect(restored).toEqual(state);
  expect(restored).not.toBe(state);
  expect(serializeMatch(state)).toBe(saved);
  return restored;
}
function command(state: MatchState, operation: (state: MatchState) => api.MatchCommandResult) {
  const saved = serializeMatch(state), actual = operation(state), resumed = operation(roundTrip(state));
  expect(resumed).toEqual(actual); // Entire result: state, complete events, or failure reason.
  expect(serializeMatch(state)).toBe(saved);
  if (!actual.ok) expect(actual.state).toBe(state);
  return actual;
}
function unchangedStep(state: MatchState): void {
  const saved = serializeMatch(state), result = api.stepMatch(state);
  expect(result).toEqual({ state, events: [] });
  expect(result.state).toBe(state);
  expect(serializeMatch(state)).toBe(saved);
}
function reject(state: MatchState, message: string, change: (state: any) => void): void {
  const saved = serializeMatch(state), bad = JSON.parse(saved);
  change(bad);
  expect(() => restoreMatch(bad), change.toString()).toThrowError(new RegExp(`^${message}$`));
  expect(serializeMatch(state)).toBe(saved);
}
function reserveExcept(initial: MatchState, keep: readonly string[]): MatchState {
  let state = initial;
  for (const unit of players(state).filter(unit => unit.location.kind === 'board' && !keep.includes(unit.id))) {
    const used = new Set(bench(state).flatMap(unit => unit.location.kind === 'bench' ? [unit.location.slot] : []));
    const slot = Array.from({ length: 9 }, (_, index) => index).find(index => !used.has(index));
    if (slot === undefined) throw new Error('Public route exhausted its bench');
    state = accepted(api.deployMatchUnit(state, unit.id, { kind: 'bench', slot }));
  }
  return state;
}
const emptyRounds = new Set(['1-3', '1-4', '2-1', '2-2', '2-3', '2-5', '2-6', '2-7',
  '3-1', '3-2', '3-3', '3-7', '4-1', '4-2']);
/** The existing command-only driver is a domain fixture, not B9 application/import acceptance.
 * Intercept Start only to issue ordinary deployment commands before the actual Start.
 * Nothing edits HP, units, stars, resources, deaths, provenance, or combat results. */
async function publicPrefix(roundId: string, accumulateLosses = false): Promise<MatchState> {
  const captured = new Error('Captured public preparation');
  let prefix: MatchState | undefined;
  const driver = { ...api, startMatchCombat(state: MatchState) {
    if (state.roundDefinitionId === roundId) { prefix = state; throw captured; }
    return api.startMatchCombat(accumulateLosses && emptyRounds.has(state.roundDefinitionId)
      ? reserveExcept(state, []) : state);
  } };
  try { await run(driver, { build: 'cannon', seed: 230 }); }
  catch (error) { if (error !== captured) throw error; }
  if (!prefix) throw new Error(`Public route did not reach ${roundId}`);
  return prefix;
}
// 2-7 prefix: 37 public commands, 8 actual combats, 2,889 ticks.
const capacityPrefix = await publicPrefix('2-7');
// 4-7 prefix: 188 driver commands + 58 public bench deployments, 20 combats, 2,020 ticks.
const terminalPrefix = await publicPrefix('4-7', true);

function capacityPreparation(): MatchState {
  let state = roundTrip(capacityPrefix);
  // Actual seed-230 shop generations: nine paid, non-merging bench births.
  for (const [generation, slots] of [[9, [1, 3]], [10, [1, 4]], [11, [3]], [12, [1, 3, 4]], [13, [1]]] as const) {
    if (state.shop.generation < generation) state = accepted(api.rerollShop(state));
    expect(state.shop.generation).toBe(generation);
    for (const slot of slots) state = accepted(api.buyUnit(state, slot, generation));
  }
  expect(bench(state)).toHaveLength(9);
  expect(players(state).filter(unit => unit.definitionId === 'maddie' && unit.starLevel === 1)).toHaveLength(1);
  expect(state.gold).toBe(19);
  return roundTrip(state);
}
function terminalPreparation(keep: readonly string[]): MatchState {
  let state = reserveExcept(roundTrip(terminalPrefix), keep);
  // The real generation-43 Nami/Urgot offers fill the newly available bench slots.
  for (const slot of keep.length === 2 ? [2, 3] : [2]) state = accepted(api.buyUnit(state, slot, 43));
  expect(bench(state)).toHaveLength(9);
  expect(players(state).filter(unit => unit.definitionId === 'ezreal' && unit.starLevel === 1)).toHaveLength(0);
  expect(state.playerHp).toBe(3);
  expect(state.roundResults.reduce((sum, result) => sum + result.hpLost, 0)).toBe(97);
  expect(state.roundResults.filter(result => result.hpLost > 0).map(result => result.roundId)).toEqual([...emptyRounds]);
  return roundTrip(state);
}
function finish(initial: MatchState) {
  let state = initial;
  const events: MatchEvent[] = [];
  while (state.phase === 'combat') {
    const result = api.stepMatch(state);
    state = result.state; events.push(...result.events);
  }
  return { state, events };
}
/** Restore at the first actual earned death, then compare every remaining event and final field. */
function realBattle(preparation: MatchState) {
  let state = accepted(command(preparation, api.startMatchCombat));
  const events: MatchEvent[] = [];
  while (state.phase === 'combat') {
    const result = api.stepMatch(state);
    state = result.state; events.push(...result.events);
    if (result.events.some(event => event.type === 'lootRevealed')) break;
  }
  expect(state.phase).toBe('combat');
  const revealed = state, uninterrupted = finish(state), resumed = finish(roundTrip(state));
  expect(resumed).toEqual(uninterrupted);
  roundTrip(uninterrupted.state);
  return { ...uninterrupted, events: [...events, ...uninterrupted.events], revealed };
}
const capacity = realBattle(capacityPreparation());
function resolveCapacityChoice(): MatchState {
  const choice = capacity.state.pendingChoice!;
  return accepted(command(capacity.state, state => api.selectChoice(state, choice.choiceId, choice.generation, 'sword')));
}
function sellCapacityUnit(state: MatchState) {
  const unit = bench(state).find(unit => unit.definitionId === 'zoe')!;
  return { unit, result: command(state, value => api.sellUnit(value, unit.id)) };
}

// Pure award-planner vectors remain in m8-b8-loot-runtime.test.ts. These states
// come solely from createMatch, real ticks and successful public commands.
describe('B8 live full-bench settlement and exact command resumption', () => {
  it('earns a non-merging hero at nine capacity without receipt, unit ID, resource or RNG consumption', () => {
    const state = capacity.state, before = capacity.revealed, hero = plan(state).encounterPlan.drops[1];
    expect(hero.payload).toEqual({ kind: 'unit', definitionId: 'maddie', quantity: 1 });
    expect(state.phase).toBe('choice');
    expect(state.combat?.tick).toBe(172);
    expect(before.combat?.tick).toBe(69);
    expect(before.m8.loot.direct.slice(-2).map(drop => drop.status)).toEqual(['revealed', 'revealed']);
    expect(state.m8.loot.direct.at(-1)).toEqual({ dropId: hero.dropId, status: 'pending-capacity', receiptId: null });
    expect(state.m8.loot.receipts.some(receipt => receipt.dropId === hero.dropId)).toBe(false);
    expect(state.preparation).toEqual(before.preparation);
    expect(state.nextUnitSerial).toBe(before.nextUnitSerial);
    expect(state.nextItemSerial).toBe(before.nextItemSerial + 1);
    expect(state.m8.loot.receipts).toHaveLength(before.m8.loot.receipts.length + 1);
    expect(state.m8.loot.guaranteeCounters[counter('2-7')]).toBe(1);
    expect(state.resourceProvenance.entries.slice(before.resourceProvenance.entries.length).map(entry => entry.kind))
      .toEqual(['item-acquired', 'combat-growth-committed']);
    for (const field of ['rngState', 'choiceRngState', 'rewardRngState', 'battleSeedRngState', 'equipmentState'] as const)
      expect(state[field]).toEqual(before[field]);
    expect(state.m8.loot.frozen).toEqual(before.m8.loot.frozen);
    expect(command(state, value => api.nextRound(value, value.round))).toMatchObject({ ok: false, reason: 'wrong-phase' });
    expect(command(state, value => api.sellUnit(value, bench(value)[0].id))).toMatchObject({ ok: false, reason: 'wrong-phase' });
  });

  it('clears choice before sale, grants once on actual release, and never resettles income, investment, XP or growth', () => {
    const waiting = resolveCapacityChoice(), settled = waiting.roundResults.at(-1)!;
    expect(waiting.phase).toBe('settlement');
    unchangedStep(waiting);
    const restoredWaiting = roundTrip(waiting);
    unchangedStep(restoredWaiting);
    expect(waiting.m8.loot.direct.at(-1)?.status).toBe('pending-capacity');
    expect(waiting.scheduleReceipts).toEqual(capacity.state.scheduleReceipts);
    expect(command(waiting, state => api.nextRound(state, state.round))).toMatchObject({ ok: false, reason: 'unsettled-round' });
    const { unit, result } = sellCapacityUnit(waiting), sold = accepted(result);
    expect(getUnitSellPrice(unit)).toBe(4);
    expect(settled).toMatchObject({ interestBasis: 19, incomeBreakdown: { interest: 1 }, goldAfter: 25 });
    expect(Math.floor((settled.interestBasis + 4) / 10)).toBe(2); // A forbidden recomputation would add interest.
    expect(sold.gold).toBe(29);
    expect(sold.augments.some(augment => augment.definitionId === 'investment-strategy-i')).toBe(true);
    for (const field of ['roundResults', 'augmentProgress', 'persistentGrowth', 'level', 'xp', 'combat', 'combatInputBasis',
      'scheduleReceipts', 'rngState', 'choiceRngState', 'rewardRngState', 'battleSeedRngState', 'equipmentState'] as const)
      expect(sold[field]).toEqual(waiting[field]);
    expect(sold.m8.loot.frozen).toEqual(waiting.m8.loot.frozen);
    expect(sold.m8.loot.direct.at(-1)?.status).toBe('granted');
    const receipt = sold.m8.loot.receipts.at(-1)!;
    expect(receipt).toMatchObject({ dropId: plan(sold).encounterPlan.drops[1].dropId,
      payload: { kind: 'unit', definitionId: 'maddie', quantity: 1 }, grantedUnitIds: [`unit-${waiting.nextUnitSerial}`], grantedItemIds: [] });
    expect(sold.nextUnitSerial).toBe(waiting.nextUnitSerial + 1);
    expect(bench(sold)).toHaveLength(9);
    expect(sold.resourceProvenance.entries.slice(waiting.resourceProvenance.entries.length)).toEqual([
      { kind: 'unit-sold', unitId: unit.id, context: 'settlement-capacity', goldGranted: 4,
        sequence: waiting.resourceProvenance.entries.length, roundId: '2-7' },
      { kind: 'unit-acquired', unitId: `unit-${waiting.nextUnitSerial}`, source: { kind: 'loot', receiptId: receipt.receiptId },
        sequence: waiting.resourceProvenance.entries.length + 1, roundId: '2-7' },
    ]);
    expect(result.ok && result.events.map(event => event.type)).toEqual(['lootGranted']);
    unchangedStep(sold);
    expect(command(sold, state => api.sellUnit(state, bench(state)[0].id))).toMatchObject({ ok: false, reason: 'wrong-phase' });
    const continued = accepted(command(sold, state => api.nextRound(state, state.round)));
    expect(continued.roundDefinitionId).toBe('3-1');
    expect(continued.m8.loot.receipts).toEqual(sold.m8.loot.receipts);
    roundTrip(continued);
  });

  it('rejects capacity, post-choice sale, provenance ordering and post-settlement balance tampering', () => {
    const waiting = resolveCapacityChoice(), sold = accepted(sellCapacityUnit(waiting).result);
    const pendingChanges: readonly [string, (state: any) => void][] = [
      ['Invalid B8 Match: unit capacity status', state => { state.m8.loot.direct.at(-1).status = 'retained-terminal'; }],
      ['Invalid B8 Match: unprocessed direct', state => { state.m8.loot.direct.at(-1).status = 'revealed'; }],
      ['Invalid B8 Match: current resource fold', state => { state.nextUnitSerial++; }],
      ['Invalid B8 Match: current resource fold', state => {
        state.preparation.units = state.preparation.units.filter((unit: any) => unit.id !== bench(waiting)[0].id);
      }],
    ];
    for (const [message, change] of pendingChanges) reject(waiting, message, change);
    const soldChanges: readonly [string, (state: any) => void][] = [
      ['Invalid Match save: current settlement totals', state => { state.gold = state.roundResults.at(-1).goldAfter; }],
      ['Invalid resource provenance: sale price', state => { state.resourceProvenance.entries.at(-2).goldGranted++; state.gold++; }],
      ['Invalid resource provenance: preparation sale after settlement', state => { state.resourceProvenance.entries.at(-2).context = 'preparation'; }],
      ['Invalid B8 Match: direct receipt', state => {
        state.m8.loot.direct.at(-1).status = 'pending-capacity'; state.m8.loot.direct.at(-1).receiptId = null;
      }],
      ['Invalid B8 Match: ordered resource transaction', state => {
        // Move the real sale before the real component choice, preserving all sequence numbers.
        const entries = state.resourceProvenance.entries, index = entries.length - 3;
        [entries[index], entries[index + 1]] = [entries[index + 1], entries[index]];
        entries.forEach((entry: any, sequence: number) => { entry.sequence = sequence; });
      }],
      ['Invalid resource provenance: combat settlement identity/uniqueness', state => {
        const entry = structuredClone(state.resourceProvenance.entries.find((value: any) =>
          value.kind === 'combat-growth-committed' && value.roundId === '2-7'));
        entry.sequence = state.resourceProvenance.entries.length; state.resourceProvenance.entries.push(entry);
      }],
    ];
    for (const [message, change] of soldChanges) reject(sold, message, change);
  });
});

describe('B8 live lethal PvE, earned fallback and retained terminal capacity', () => {
  it.each([
    { name: 'both sources', keep: ['unit-11', 'unit-6'], tick: 849, direct: ['granted', 'retained-terminal'], earned: true, components: 2 },
    { name: 'only direct source', keep: ['unit-16'], tick: 448, direct: ['granted', 'retained-terminal'], earned: false, components: 1 },
    { name: 'only choice source', keep: ['unit-14'], tick: 309, direct: ['forfeited', 'forfeited'], earned: true, components: 1 },
  ])('$name: restores real lethal settlement without resurrecting unearned loot', scenario => {
    const preparation = terminalPreparation(scenario.keep), battle = realBattle(preparation), state = battle.state;
    const frozen = plan(state), hero = frozen.encounterPlan.drops[1], choice = frozen.choices[0];
    expect(state.phase).toBe('gameOver'); expect(state.outcome).toBe('defeat'); expect(state.playerHp).toBe(0);
    expect(state.combat?.tick).toBe(scenario.tick);
    expect(state.roundResults.at(-1)).toMatchObject({ hpBefore: 3, hpAfter: 0, hpLost: 3, result: 'enemyWin' });
    expect(state.m8.loot.direct.slice(-2).map(drop => drop.status)).toEqual(scenario.direct);
    expect(state.m8.loot.receipts.some(receipt => receipt.dropId === hero.dropId)).toBe(false);
    expect(state.nextUnitSerial).toBe(preparation.nextUnitSerial);
    expect(state.preparation).toEqual(preparation.preparation);
    expect(state.nextItemSerial).toBe(preparation.nextItemSerial + scenario.components);
    expect(state.m8.loot.guaranteeCounters[counter('4-7')]).toBe(scenario.components);
    expect(state.pendingChoice).toBeNull();
    expect(state.m8.loot.frozen).toEqual(preparation.m8.loot.frozen);
    expect(state.scheduleReceipts).toEqual(preparation.scheduleReceipts);
    expect(battle.events.filter(event => event.type === 'roundSettled')).toHaveLength(1);
    expect(battle.events.filter(event => event.type === 'lootGranted')).toHaveLength(scenario.components);
    const facts = state.resourceProvenance.entries.slice(preparation.resourceProvenance.entries.length);
    expect(facts.map(fact => fact.kind)).toEqual([...Array(scenario.components).fill('item-acquired'), 'combat-growth-committed']);
    if (scenario.earned) {
      expect(choice.terminalFallbackDefinitionId).toBe('tear');
      const receipt = state.m8.loot.receipts.find(value => value.dropId === choice.dropId)!;
      expect(receipt.payload).toEqual({ kind: 'item', definitionId: 'tear', quantity: 1 });
      expect(state.items.find(item => item.id === receipt.grantedItemIds[0])).toMatchObject({ definitionId: 'tear', location: { kind: 'inventory' } });
      expect(state.m8.loot.choiceResolutions).toEqual([{ dropId: choice.dropId, receiptId: receipt.receiptId, method: 'terminal-fallback' }]);
      expect(battle.events.filter(event => event.type === 'lootChoiceResolved')).toHaveLength(1);
      reject(state, 'Invalid B8 Match: terminal choice method', bad => { bad.m8.loot.choiceResolutions.at(-1).method = 'player-choice'; });
      reject(state, 'Invalid B8 Match: terminal fallback', bad => { // Corrupt both the receipt and item; frozen fallback remains authoritative.
        const receipt = bad.m8.loot.receipts.at(-1); receipt.payload.definitionId = 'sword';
        bad.items.find((item: any) => item.id === receipt.grantedItemIds[0]).definitionId = 'sword';
      });
    } else {
      expect(state.m8.loot.choiceEligibility.at(-1)?.status).toBe('forfeited');
      expect(state.m8.loot.choiceResolutions).toEqual([]);
      expect(state.m8.loot.receipts.some(receipt => receipt.dropId === choice.dropId)).toBe(false);
      expect(battle.events.filter(event => event.type === 'lootChoiceResolved')).toEqual([]);
      reject(state, 'Invalid B8 Match: qualification evidence', bad => { bad.m8.loot.choiceEligibility.at(-1).status = 'revealed'; });
    }
    reject(state, scenario.direct[1] === 'retained-terminal' ? 'Invalid B8 Match: unit capacity status'
      : 'Invalid B8 Match: qualification evidence', bad => { bad.m8.loot.direct.at(-1).status = 'pending-capacity'; });
    reject(state, 'Invalid B8 Match: actual guarantee counters', bad => { bad.m8.loot.guaranteeCounters[counter('4-7')]++; });
    unchangedStep(state);
    const restored = roundTrip(state);
    unchangedStep(restored);
    expect(command(state, value => api.nextRound(value, value.round))).toMatchObject({ ok: false, reason: 'wrong-phase' });
    expect(command(state, value => api.sellUnit(value, bench(value)[0].id))).toMatchObject({ ok: false, reason: 'wrong-phase' });
    expect(command(state, value => api.selectChoice(value, JSON.stringify(['m8b-loot-choice', choice.dropId]), 0, 'tear')))
      .toMatchObject({ ok: false, reason: 'wrong-phase' });
  });
});
