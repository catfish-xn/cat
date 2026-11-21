import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { room, accept, conserved } from './tp-helpers';
import { freezeOrbLayoutThroughRound } from '../src/simulation/orb-layout';
import { prepareMatchLoot, revealMatchLoot } from '../src/simulation/loot-runtime';
import { recordAugmentAcquisition } from '../src/simulation/augment-history';
import { pipelineExtraOrbs, pipelineBonusPlan, preparePipelineOrbs } from '../src/simulation/augment-pool-batch5-g5-pipeline';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { createRoundEnemies } from '../src/simulation/round-enemies';
import { enterOpeningCrabs, openingCrabCarrier } from '../src/simulation/opening-crabs';
import { createCombat } from '../src/simulation/combat';
import { runSharedMatchCommand, generateSharedShop, buySharedUnit, rerollSharedShop, sellSharedUnit } from '../src/simulation/shared-pool';
import { readLootView } from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match-types';
import * as m5Oracle from './fixtures/m5/oracle.g2.cjs';
import { rewardPlan, validateRewards } from './fixtures/m5/augment-rewards-oracle.cjs';

const require = createRequire(import.meta.url), independent = require('./fixtures/m5/augment-batch5-g5-oracle.cjs');
const pools = require('./augment-reward-pools-oracle-data.cjs').pools;
/** Isolated, already-entered PvE vector; real offer/round traversal and authority are tested in both room suites. */
function claimsFixture(fullBench = false, early = false, seed = 4) {
  const initial = room(undefined, 1, seed), round = getCatalogRoundById('3-7');
  let pool = initial.pool, source = initial.states[0];
  if (fullBench) {
    const generated = accept(generateSharedShop(pool, { ...source, gold: 1000, level: 9, xp: 0 }, 0)); pool = generated.pool; source = generated.state;
    for (let budget = 0; source.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench').length < source.preparation.benchSize; budget++) {
      expect(budget).toBeLessThan(40);
      const slot = source.shop.slots.findIndex(o => o.status === 'available' && source.preparation.units.filter(u => u.definitionId === o.definitionId && u.starLevel === 1).length < 2);
      const bought = accept(slot < 0 ? rerollSharedShop(pool, source, source.shop.generation) : buySharedUnit(pool, source, slot, source.shop.generation));
      pool = bought.pool; source = bought.state;
    }
  }
  const frozen = freezeOrbLayoutThroughRound(pool.orbLayout, round.ordinal); if (!frozen.ok) throw new Error(frozen.reason);
  pool = { ...pool, orbLayout: frozen.layout };
  const acquisition = { ...source, round: early ? 4 : 12, roundDefinitionId: early ? '2-1' : '3-2' };
  let state = recordAugmentAcquisition(acquisition, { ...acquisition,
    augments: [{ definitionId: 'prismatic-pipeline', choiceId: `round:${acquisition.roundDefinitionId}:augment`, acquiredRound: acquisition.round }] });
  state = preparePipelineOrbs({ ...state, round: round.ordinal, roundDefinitionId: round.roundId,
    m8: { ...state.m8, round, loot: prepareMatchLoot(state.seed, round.ordinal, state.m8.loot, frozen.layout) },
    preparation: { ...state.preparation, units: [...state.preparation.units.filter(u => u.team === 'player'), ...createRoundEnemies(round.ordinal)] } });
  state = enterOpeningCrabs(state);
  const natural = state.m8.loot.frozen.rounds.at(-1)!.orbs, extra = pipelineExtraOrbs(state);
  const carriers = [...new Set([...natural, ...extra].map(o => openingCrabCarrier(state, round.roundId, o.sourceUnitId)))];
  const raw = createCombat(state.preparation);
  const combat = { ...raw, combatId: `round-${round.ordinal}`, status: 'finished' as const, result: 'draw' as const, tick: 5, nextEventSeq: 100,
    units: raw.units.map(u => carriers.includes(u.id) ? { ...u, alive: false, hp: 0 } : u),
    neutralReceipts: { deaths: carriers.map((unitId, i) => ({ unitId, tick: 4, eventSeq: 7 + i })), controls: [] } };
  state = { ...revealMatchLoot(state, combat).state, phase: 'settlement', combat };
  return { pool, state: state as MatchState, natural: natural.find(o => o.tier === 'prismatic')!, extra: extra[0], ordinary: natural.find(o => o.tier !== 'prismatic')! };
}
/**
 * A save written before battle claims opened at once (v26 integration up to 2db1fc85) can still hold a battle queue of
 * loot orbs, which the settlement drains in FIFO order. This isolated vector is not a restorable save (its PvE entry is
 * synthetic), so the queue is written directly; tests/loot-orb-claim.test.ts shows restore accepts such a queue.
 */
function legacyQueue<T extends { pool: unknown; state: MatchState }>(current: T, orbIds: readonly string[]): T {
  return { ...current, state: { ...current.state, m8: { ...current.state.m8, loot: { ...current.state.m8.loot, queuedOrbClaims: [...orbIds] } } } };
}
it('real claims bonus both natural and augment-created prismatic orbs independently, and an ordinary orb gets zero', () => {
  let { pool, state, natural, extra, ordinary } = claimsFixture();
  expect(natural).toBeDefined(); expect(ordinary).toBeDefined(); expect(extra).toBeDefined();
  for (const orb of [ordinary, natural, extra]) {
    const before = state, command = { type: 'claimOrb' as const, round: state.round, orbId: orb.orbId };
    const r = accept(runSharedMatchCommand(pool, state, command)); pool = r.pool; state = r.state;
    independent.validatePipelineClaim(before, state, command, r.events);
    validateRewards(before, state, command, r.events, { ...m5Oracle, lootReceipts: state.m8.loot.receipts.slice(before.m8.loot.receipts.length) });
    expect(pipelineBonusPlan(state)).toHaveLength(orb === ordinary ? 0 : orb === natural ? 1 : 2);
    const expected = independent.pipelineBonuses(state);
    expect(pipelineBonusPlan(state).map(p => p.reward.gold)).toEqual(expected.map((p: any) => p.gold));
    if (orb !== ordinary && expected.at(-1).gold) {
      const forged = structuredClone(state) as any;
      forged.seatMechanics.receipts.find((p: any) => p.receiptId === expected.at(-1).receiptId).amount++;
      expect(() => validateRewards(before, forged, command, r.events, { ...m5Oracle, lootReceipts: state.m8.loot.receipts.slice(before.m8.loot.receipts.length) })).toThrow();
    }
    conserved(pool, [state]);
  }
});
it('rejects an altered or truncated history prefix even when an ordinary claim hides a second 8-gold bonus', () => {
  let { pool, state, natural, ordinary } = claimsFixture(false, true);
  expect(natural).toBeDefined(); expect(ordinary).toBeDefined();
  const opened = accept(runSharedMatchCommand(pool, state, { type: 'claimOrb', round: state.round, orbId: natural.orbId }));
  pool = opened.pool; state = opened.state;
  const fact = state.augmentHistory!.facts.find(f => f.kind === 'orb-opened')!;
  expect(fact).toMatchObject({ orbId: natural.orbId });
  const paid = state.seatMechanics!.receipts.find(r => r.source === 'augment-pool-batch5-g5')!;
  expect(paid).toMatchObject({ kind: 'gold', amount: 8 });
  const before = state, command = { type: 'claimOrb' as const, round: state.round, orbId: ordinary.orbId };
  const claimed = accept(runSharedMatchCommand(pool, state, command));
  const env = { ...m5Oracle, lootReceipts: claimed.state.m8.loot.receipts.slice(before.m8.loot.receipts.length) };
  expect(() => validateRewards(before, claimed.state, command, claimed.events, env)).not.toThrow();

  const forged = structuredClone(claimed.state) as any;
  const forgedFact = forged.augmentHistory.facts.find((f: any) => f.kind === 'orb-opened');
  forgedFact.orbId += '-forged';
  forged.gold += 8;
  forged.seatMechanics.receipts.push({ ...paid, receiptId: JSON.stringify(['augment-pool-batch5-g5', fact.choiceId, 'pipeline-bonus', forgedFact.orbId]) });
  expect(() => validateRewards(before, forged, command, claimed.events, env)).toThrow(/augment history.*append-only/);
  const truncated = structuredClone(claimed.state) as any;
  truncated.augmentHistory.facts = truncated.augmentHistory.facts.slice(0, before.augmentHistory!.facts.length - 1);
  expect(() => validateRewards(before, truncated, command, claimed.events, env)).toThrow(/augment history.*append-only/);
});
it('a partially opened full-bench orb withholds the bonus until its anvil is actually claimed, then pays once', () => {
  let { pool, state, extra } = claimsFixture(true);
  expect(extra.entries.some(e => e.payload.kind === 'forge')).toBe(true);
  expect(state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench')).toHaveLength(state.preparation.benchSize);
  let r = accept(runSharedMatchCommand(pool, state, { type: 'claimOrb', round: state.round, orbId: extra.orbId })); pool = r.pool; state = r.state;
  expect(pipelineBonusPlan(state)).toHaveLength(0);
  expect(readLootView(state).unclaimedOrbs?.some(o => o.orbId === extra.orbId)).toBe(true);
  const unit = state.preparation.units.find(u => u.team === 'player' && u.location.kind === 'bench')!;
  r = accept(sellSharedUnit(pool, state, unit.id)); pool = r.pool; state = r.state;
  const before = state, command = { type: 'claimOrb' as const, round: state.round, orbId: extra.orbId };
  r = accept(runSharedMatchCommand(pool, state, command)); pool = r.pool; state = r.state;
  expect(pipelineBonusPlan(state)).toHaveLength(1); independent.validatePipelineClaim(before, state, command, r.events);
  validateRewards(before, state, command, r.events, { ...m5Oracle, lootReceipts: state.m8.loot.receipts.slice(before.m8.loot.receipts.length) });
  const repeat = runSharedMatchCommand(pool, state, command);
  expect(repeat.ok).toBe(false); expect(repeat.state).toBe(state); expect(repeat.pool).toBe(pool);
  conserved(pool, [state]);
});
it.each([false, true])('prismatic claims during a real PvE battle open at once and pay bonus gold then; gifts follow at the settlement (two orbs: %s)', multiple => {
  const fixture = claimsFixture();
  const ready = { ...fixture.state, phase: 'preparation' as const, combat: null };
  let current = accept(runSharedMatchCommand(fixture.pool, ready, { type: 'startCombat' }));
  expect(current.state.phase).toBe('combat');
  const orbs = multiple ? [fixture.natural, fixture.extra] : [fixture.natural];
  const start = current.state, claims: { before: MatchState; after: MatchState; command: any; events: any[] }[] = [];
  for (const orb of orbs) {
    // TFT: each claim opens its orb at once, in claim order; nothing is queued.
    const command = { type: 'claimOrb' as const, round: current.state.round, orbId: orb.orbId };
    const opened = accept(runSharedMatchCommand(current.pool, current.state, command));
    expect(opened.state.phase).toBe('combat');
    expect(opened.events.some(e => e.type === 'lootGranted')).toBe(true);
    independent.validatePipelineClaim(current.state, opened.state, command, opened.events);
    claims.push({ before: current.state, after: opened.state, command, events: opened.events as any[] });
    current = opened;
  }
  expect(current.state.m8.loot.queuedOrbClaims ?? []).toEqual([]);
  expect(current.state.augmentHistory!.facts.slice(start.augmentHistory!.facts.length).filter(f => f.kind === 'orb-opened').map(f => f.orbId))
    .toEqual(orbs.map(orb => orb.orbId));
  let before = current.state, steps = 0;
  while (current.state.phase === 'combat' && steps++ < 1201) {
    before = current.state;
    current = accept(runSharedMatchCommand(current.pool, before, { type: 'step' }));
  }
  expect(current.state.phase).not.toBe('combat');
  expect(current.state.augmentHistory!.facts.slice(before.augmentHistory!.facts.length).filter(f => f.kind === 'orb-opened')).toEqual([]);
  const bonuses = independent.pipelineBonuses(current.state);
  expect(bonuses).toHaveLength(orbs.length);
  const g5 = (from: MatchState, to: MatchState) => to.seatMechanics!.receipts.slice(from.seatMechanics!.receipts.length).filter(r => r.source === 'augment-pool-batch5-g5')
    .map(r => ({ receiptId: r.receiptId, kind: r.kind, amount: r.kind === 'gold' ? r.amount : null }));
  // Each opening's bonus gold is paid at its touch, in claim order; the settlement pays no second copy.
  expect(claims.flatMap(c => g5(c.before, c.after)))
    .toEqual(bonuses.filter((bonus: any) => bonus.gold).map((bonus: any) => ({ receiptId: bonus.receiptId, kind: 'gold', amount: bonus.gold })));
  for (const c of claims) expect(() => validateRewards(c.before, c.after, c.command, c.events, {
    ...m5Oracle, lootReceipts: c.after.m8.loot.receipts.slice(c.before.m8.loot.receipts.length),
  })).not.toThrow();
  expect(g5(before, current.state)).toEqual([]);
  const priorReceipts = new Set(before.seatMechanics!.receipts.map(r => r.receiptId));
  const gifts = rewardPlan(current.state, { ...m5Oracle, pools }).gifts.filter(g => !priorReceipts.has(g.receiptId));
  const giftKey = (gift: any) => ({ receiptId: gift.receiptId, kind: gift.kind, definitionId: gift.definitionId, starLevel: gift.starLevel ?? 1 });
  expect(current.state.seatMechanics!.receipts.slice(before.seatMechanics!.receipts.length).filter(r => r.source === 'augment-pool-batch1').map(giftKey))
    .toEqual(gifts.map(giftKey));
  independent.validatePipelineClaim(before, current.state, { type: 'step' }, current.events);
  validateRewards(before, current.state, { type: 'step' }, current.events, {
    ...m5Oracle, lootReceipts: current.state.m8.loot.receipts.slice(before.m8.loot.receipts.length),
  });
  if (multiple) {
    // The orb's consumable was mine at the touch; the fixed PvE remover follows at the settlement with the next ID.
    const after = current.state;
    const loot = after.m8.loot.receipts.slice(start.m8.loot.receipts.length).find(r => r.payload.kind === 'consumable')!;
    expect(loot.grantedConsumableIds).toEqual([`consumable-${start.nextConsumableSerial}`]);
    expect(before.consumables.map(c => c.consumableId)).toContain(`consumable-${start.nextConsumableSerial}`);
    const mechanic = after.seatMechanics!.receipts.slice(before.seatMechanics!.receipts.length).find(r => r.source === 'pve-remover') as any;
    expect(mechanic).toMatchObject({ definitionId: 'magnetic-remover', consumableId: `consumable-${start.nextConsumableSerial + 1}` });
    const events = current.events as any[], first = loot.grantedConsumableIds![0], second = mechanic.consumableId;

    // The claim that opened the consumable orb: its tool takes the next ID, checked independently.
    const opening = claims.find(c => c.after.m8.loot.receipts.some(r => r.dropId === loot.dropId) && !c.before.m8.loot.receipts.some(r => r.dropId === loot.dropId))!;
    const claimCheck = (state: any, ev: any[]) => validateRewards(opening.before, state, opening.command, ev, {
      ...m5Oracle, lootReceipts: state.m8.loot.receipts.slice(opening.before.m8.loot.receipts.length),
    });
    expect(() => claimCheck(opening.after, opening.events)).not.toThrow();
    const skipped = structuredClone(opening.after) as any, skippedEvents = structuredClone(opening.events);
    const skippedId = `consumable-${opening.before.nextConsumableSerial + 1}`;
    skipped.m8.loot.receipts.find((r: any) => r.dropId === loot.dropId).grantedConsumableIds = [skippedId];
    skipped.consumables.find((c: any) => c.consumableId === first).consumableId = skippedId;
    skippedEvents.find(e => e.type === 'lootGranted' && e.receipt.dropId === loot.dropId).receipt.grantedConsumableIds = [skippedId];
    expect(() => claimCheck(skipped, skippedEvents)).toThrow(/independent consumable grant ID/);

    // The settlement's fixed PvE remover: definition, count, survival and its ID after the orb's.
    const check = (state: any, ev: any[]) => validateRewards(before, state, { type: 'step' }, ev, {
      ...m5Oracle, lootReceipts: state.m8.loot.receipts.slice(before.m8.loot.receipts.length),
    });
    expect(() => check(after, events)).not.toThrow();
    const reused = structuredClone(after) as any, reusedEvents = structuredClone(events);
    reused.seatMechanics.receipts.find((r: any) => r.receiptId === mechanic.receiptId).consumableId = first;
    reusedEvents.find(e => e.type === 'mechanicGranted' && e.receipt.receiptId === mechanic.receiptId).receipt.consumableId = first;
    reused.consumables = reused.consumables.map((c: any) => c.consumableId === second ? { ...c, consumableId: first } : c);
    expect(() => check(reused, reusedEvents)).toThrow(/independent consumable grant ID/);

    const wrongTool = structuredClone(after) as any, wrongToolEvents = structuredClone(events);
    wrongTool.seatMechanics.receipts.find((r: any) => r.receiptId === mechanic.receiptId).definitionId = 'reforger';
    wrongToolEvents.find(e => e.type === 'mechanicGranted' && e.receipt.receiptId === mechanic.receiptId).receipt.definitionId = 'reforger';
    wrongTool.consumables.find((c: any) => c.consumableId === second).definitionId = 'reforger';
    expect(() => check(wrongTool, wrongToolEvents)).toThrow(/independent fixed PvE remover definition/);

    const missing = structuredClone(after) as any, missingEvents = structuredClone(events);
    missing.seatMechanics.receipts = missing.seatMechanics.receipts.filter((r: any) => r.receiptId !== mechanic.receiptId);
    missing.consumables = missing.consumables.filter((c: any) => c.consumableId !== second);
    missing.nextConsumableSerial--;
    missingEvents.splice(missingEvents.findIndex(e => e.type === 'mechanicGranted' && e.receipt.receiptId === mechanic.receiptId), 1);
    expect(() => check(missing, missingEvents)).toThrow(/independent fixed PvE remover count/);
    expect(() => check({ ...missing, playerHp:0 }, missingEvents)).toThrow(/independent PvE surviving status/);
  }
  conserved(current.pool, [current.state]);
});
it('an orb opened before a lethal PvE battle ends stays paid once with its single pipeline bonus', () => {
  const fixture = claimsFixture(false, false, 16), ready = { ...fixture.state, playerHp:1, phase:'preparation' as const, combat:null };
  expect(fixture.extra.entries.some(e => e.payload.kind === 'consumable')).toBe(true);
  let current = accept(runSharedMatchCommand(fixture.pool, ready, { type:'startCombat' }));
  expect(current.state.phase).toBe('combat');
  const start = current.state;
  current = accept(runSharedMatchCommand(current.pool, current.state, { type:'claimOrb', round:current.state.round, orbId:fixture.extra.orbId }));
  if (current.state.phase !== 'combat') throw new Error('the claim must keep the battle running');
  const paid = current.state.m8.loot.receipts.slice(start.m8.loot.receipts.length);
  expect(paid).toContainEqual(expect.objectContaining({ resolution:'held', payload:expect.objectContaining({ kind:'consumable' }) }));
  expect(current.state.consumables.length).toBeGreaterThan(start.consumables.length);
  // Isolate a lethal next battle by starting the already-running ally at 1 HP.
  current = { ...current, state:{ ...current.state, combat:{ ...current.state.combat,
    units:current.state.combat.units.map(u => u.team === 'player' ? { ...u, hp:1 } : u) } } };
  let before = current.state, steps = 0;
  while (current.state.phase === 'combat' && steps++ < 1201) {
    before = current.state;
    current = accept(runSharedMatchCommand(current.pool, before, { type:'step' }));
  }
  expect(current.state.playerHp).toBe(0);
  const receipts = current.state.m8.loot.receipts.slice(before.m8.loot.receipts.length);
  expect(receipts.filter(r => paid.some(p => p.dropId === r.dropId))).toEqual([]);
  // The prismatic orb really opened, so its pipeline bonus is owed exactly once (its gold paid at the touch).
  const bonuses = independent.pipelineBonuses(current.state);
  expect(bonuses).toHaveLength(1);
  expect((current.state.seatMechanics?.receipts ?? []).filter(r => r.source === 'augment-pool-batch5-g5').map(r => r.kind === 'gold' ? r.amount : null))
    .toEqual(bonuses.filter((bonus: any) => bonus.gold).map((bonus: any) => bonus.gold));
  expect(() => validateRewards(before, current.state, { type:'step' }, current.events, { ...m5Oracle, lootReceipts:receipts })).not.toThrow();
});
it.each([false, true])('a legacy battle queue: validates queued prismatic claims and rewards at a real PvE settlement (two orbs: %s)', multiple => {
  const fixture = claimsFixture();
  const ready = { ...fixture.state, phase: 'preparation' as const, combat: null };
  let current = accept(runSharedMatchCommand(fixture.pool, ready, { type: 'startCombat' }));
  expect(current.state.phase).toBe('combat');
  const orbs = multiple ? [fixture.natural, fixture.extra] : [fixture.natural];
  current = legacyQueue(current, orbs.map(orb => orb.orbId));
  expect(current.state.m8.loot.queuedOrbClaims).toEqual(orbs.map(orb => orb.orbId));
  let before = current.state, steps = 0;
  while (current.state.phase === 'combat' && steps++ < 1201) {
    before = current.state;
    current = accept(runSharedMatchCommand(current.pool, before, { type: 'step' }));
  }
  expect(current.state.phase).not.toBe('combat');
  const openings = current.state.augmentHistory!.facts.slice(before.augmentHistory!.facts.length).filter(f => f.kind === 'orb-opened');
  expect(openings.map(f => f.orbId)).toEqual(orbs.map(orb => orb.orbId));
  const bonuses = independent.pipelineBonuses(current.state);
  expect(bonuses).toHaveLength(orbs.length);
  expect(current.state.seatMechanics!.receipts.slice(before.seatMechanics!.receipts.length).filter(r => r.source === 'augment-pool-batch5-g5')
    .map(r => ({ receiptId: r.receiptId, kind: r.kind, amount: r.kind === 'gold' ? r.amount : null })))
    .toEqual(bonuses.filter((bonus: any) => bonus.gold).map((bonus: any) => ({ receiptId: bonus.receiptId, kind: 'gold', amount: bonus.gold })));
  const priorReceipts = new Set(before.seatMechanics!.receipts.map(r => r.receiptId));
  const gifts = rewardPlan(current.state, { ...m5Oracle, pools }).gifts.filter(g => !priorReceipts.has(g.receiptId));
  const giftKey = (gift: any) => ({ receiptId: gift.receiptId, kind: gift.kind, definitionId: gift.definitionId, starLevel: gift.starLevel ?? 1 });
  expect(current.state.seatMechanics!.receipts.slice(before.seatMechanics!.receipts.length).filter(r => r.source === 'augment-pool-batch1').map(giftKey))
    .toEqual(gifts.map(giftKey));
  independent.validatePipelineClaim(before, current.state, { type: 'step' }, current.events);
  if (multiple) {
    const reversed = { ...before, m8: { ...before.m8, loot: { ...before.m8.loot, queuedOrbClaims: [...before.m8.loot.queuedOrbClaims!].reverse() } } };
    expect(() => independent.validatePipelineClaim(reversed, current.state, { type: 'step' }, current.events)).toThrow(/FIFO order/);
    const noQueue = { ...before, m8: { ...before.m8, loot: { ...before.m8.loot, queuedOrbClaims: [] } } };
    expect(() => independent.validatePipelineClaim(noQueue, current.state, { type: 'step' }, current.events)).toThrow();
    expect(() => independent.validatePipelineClaim(before, current.state, { type: 'step' }, current.events.filter(e => e.type !== 'roundSettled'))).toThrow();
    const queueRemains = { ...current.state, m8: { ...current.state.m8, loot: { ...current.state.m8.loot, queuedOrbClaims: [orbs[0].orbId] } } };
    expect(() => independent.validatePipelineClaim(before, queueRemains, { type: 'step' }, current.events)).toThrow(/drains the claim queue/);
  }
  validateRewards(before, current.state, { type: 'step' }, current.events, {
    ...m5Oracle, lootReceipts: current.state.m8.loot.receipts.slice(before.m8.loot.receipts.length),
  });
  if (multiple) {
    const after = current.state, events = current.events as any[];
    const mechanic = after.seatMechanics!.receipts.slice(before.seatMechanics!.receipts.length).find(r => r.source === 'pve-remover') as any;
    const loot = after.m8.loot.receipts.slice(before.m8.loot.receipts.length).find(r => r.payload.kind === 'consumable')!;
    if (loot.payload.kind !== 'consumable') throw new Error('queued test orb must grant a consumable');
    expect(mechanic).toMatchObject({ definitionId: 'magnetic-remover', consumableId: `consumable-${before.nextConsumableSerial}` });
    expect(loot.grantedConsumableIds).toEqual([`consumable-${before.nextConsumableSerial + 1}`]);
    const check = (state: any, ev: any[]) => validateRewards(before, state, { type: 'step' }, ev, {
      ...m5Oracle, lootReceipts: state.m8.loot.receipts.slice(before.m8.loot.receipts.length),
    });

    // Forge receipt, event and inventory together, exchanging the pre-queue and queued IDs.
    const swapped = structuredClone(after) as any, swappedEvents = structuredClone(events);
    const first = mechanic.consumableId, second = loot.grantedConsumableIds![0];
    swapped.seatMechanics.receipts.find((r: any) => r.receiptId === mechanic.receiptId).consumableId = second;
    swapped.m8.loot.receipts.find((r: any) => r.dropId === loot.dropId).grantedConsumableIds = [first];
    swappedEvents.find(e => e.type === 'mechanicGranted' && e.receipt.receiptId === mechanic.receiptId).receipt.consumableId = second;
    swappedEvents.find(e => e.type === 'lootGranted' && e.receipt.dropId === loot.dropId).receipt.grantedConsumableIds = [first];
    swapped.consumables = [...before.consumables, { consumableId:first, definitionId:loot.payload.definitionId },
      { consumableId:second, definitionId:'magnetic-remover' }];
    expect(() => check(swapped, swappedEvents)).toThrow(/independent consumable grant ID/);

    const wrongTool = structuredClone(after) as any, wrongToolEvents = structuredClone(events);
    wrongTool.seatMechanics.receipts.find((r: any) => r.receiptId === mechanic.receiptId).definitionId = 'reforger';
    wrongToolEvents.find(e => e.type === 'mechanicGranted' && e.receipt.receiptId === mechanic.receiptId).receipt.definitionId = 'reforger';
    wrongTool.consumables.find((c: any) => c.consumableId === first).definitionId = 'reforger';
    expect(() => check(wrongTool, wrongToolEvents)).toThrow(/independent fixed PvE remover definition/);

    const missing = structuredClone(after) as any, missingEvents = structuredClone(events);
    missing.seatMechanics.receipts = missing.seatMechanics.receipts.filter((r: any) => r.receiptId !== mechanic.receiptId);
    missing.m8.loot.receipts.find((r: any) => r.dropId === loot.dropId).grantedConsumableIds = [first];
    missing.consumables = [...before.consumables, { consumableId:first, definitionId:loot.payload.definitionId }];
    missing.nextConsumableSerial--;
    missingEvents.splice(missingEvents.findIndex(e => e.type === 'mechanicGranted' && e.receipt.receiptId === mechanic.receiptId), 1);
    missingEvents.find(e => e.type === 'lootGranted' && e.receipt.dropId === loot.dropId).receipt.grantedConsumableIds = [first];
    expect(() => check(missing, missingEvents)).toThrow(/independent fixed PvE remover count/);
    expect(() => check({ ...missing, playerHp:0 }, missingEvents)).toThrow(/independent PvE surviving status/);

    const falseForfeit = structuredClone(after) as any, falseForfeitEvents = structuredClone(events);
    const forgedLoot = falseForfeit.m8.loot.receipts.find((r: any) => r.dropId === loot.dropId);
    forgedLoot.resolution = 'forfeited'; delete forgedLoot.grantedConsumableIds;
    const forgedLootEvent = falseForfeitEvents.find(e => e.type === 'lootGranted' && e.receipt.dropId === loot.dropId).receipt;
    forgedLootEvent.resolution = 'forfeited'; delete forgedLootEvent.grantedConsumableIds;
    falseForfeit.consumables = falseForfeit.consumables.filter((c: any) => c.consumableId !== second);
    falseForfeit.nextConsumableSerial--;
    expect(() => check(falseForfeit, falseForfeitEvents)).toThrow(/queued forfeit requires a terminal seat/);

    const reordered = structuredClone(events), removerIndex = reordered.findIndex(e => e.type === 'mechanicGranted' && e.receipt.receiptId === mechanic.receiptId);
    const [removerEvent] = reordered.splice(removerIndex, 1);
    reordered.splice(reordered.findIndex(e => e.type === 'roundSettled') + 1, 0, removerEvent);
    expect(() => check(after, reordered)).toThrow(/fixed PvE remover precedes queued loot/);
  }
  conserved(current.pool, [current.state]);
});
it('a legacy battle queue: does not invent a consumable or bonus when an eliminated seat forfeits a queued orb', () => {
  const fixture = claimsFixture(false, false, 16), ready = { ...fixture.state, playerHp:1, phase:'preparation' as const, combat:null };
  expect(fixture.extra.entries.some(e => e.payload.kind === 'consumable')).toBe(true);
  let current = accept(runSharedMatchCommand(fixture.pool, ready, { type:'startCombat' }));
  expect(current.state.phase).toBe('combat');
  current = legacyQueue(current, [fixture.extra.orbId]);
  if (current.state.phase !== 'combat') throw new Error('queued claim must remain in combat');
  // Isolate a lethal next battle by starting the already-running ally at 1 HP.
  current = { ...current, state:{ ...current.state, combat:{ ...current.state.combat,
    units:current.state.combat.units.map(u => u.team === 'player' ? { ...u, hp:1 } : u) } } };
  let before = current.state, steps = 0;
  while (current.state.phase === 'combat' && steps++ < 1201) {
    before = current.state;
    current = accept(runSharedMatchCommand(current.pool, before, { type:'step' }));
  }
  expect(current.state.playerHp).toBe(0);
  const receipts = current.state.m8.loot.receipts.slice(before.m8.loot.receipts.length);
  expect(receipts).toContainEqual(expect.objectContaining({ resolution:'forfeited', payload:expect.objectContaining({ kind:'consumable' }) }));
  expect(current.state.consumables).toEqual(before.consumables);
  expect(independent.pipelineBonuses(current.state)).toHaveLength(0);
  expect(() => validateRewards(before, current.state, { type:'step' }, current.events, { ...m5Oracle, lootReceipts:receipts })).not.toThrow();
});
