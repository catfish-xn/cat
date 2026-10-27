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
import { validateRewards } from './fixtures/m5/augment-rewards-oracle.cjs';

const require = createRequire(import.meta.url), independent = require('./fixtures/m5/augment-batch5-g5-oracle.cjs');
/** Isolated, already-entered PvE vector; real offer/round traversal and authority are tested in both room suites. */
function claimsFixture(fullBench = false) {
  const initial = room(undefined, 1, 4), round = getCatalogRoundById('3-7');
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
  const acquisition = { ...source, round: 12, roundDefinitionId: '3-2' };
  let state = recordAugmentAcquisition(acquisition, { ...acquisition,
    augments: [{ definitionId: 'prismatic-pipeline', choiceId: 'round:3-2:augment', acquiredRound: 12 }] });
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
