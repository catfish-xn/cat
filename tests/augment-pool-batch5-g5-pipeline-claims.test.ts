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
it.each([false, true])('validates queued prismatic claims and rewards at a real PvE settlement (two orbs: %s)', multiple => {
  const fixture = claimsFixture();
  const ready = { ...fixture.state, phase: 'preparation' as const, combat: null };
  let current = accept(runSharedMatchCommand(fixture.pool, ready, { type: 'startCombat' }));
  expect(current.state.phase).toBe('combat');
  const orbs = multiple ? [fixture.natural, fixture.extra] : [fixture.natural];
  for (const orb of orbs) {
    const queued = accept(runSharedMatchCommand(current.pool, current.state, { type: 'claimOrb', round: current.state.round, orbId: orb.orbId }));
    expect(queued.events).toEqual([]); current = queued;
  }
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
it('does not invent a consumable or bonus when an eliminated seat forfeits a queued orb', () => {
  const fixture = claimsFixture(false, false, 16), ready = { ...fixture.state, playerHp:1, phase:'preparation' as const, combat:null };
  expect(fixture.extra.entries.some(e => e.payload.kind === 'consumable')).toBe(true);
  let current = accept(runSharedMatchCommand(fixture.pool, ready, { type:'startCombat' }));
  expect(current.state.phase).toBe('combat');
  current = accept(runSharedMatchCommand(current.pool, current.state, { type:'claimOrb', round:current.state.round, orbId:fixture.extra.orbId }));
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
