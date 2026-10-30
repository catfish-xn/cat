import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PlaceholderBattleResolver } from '../../src/server/room/battle-resolver';
import { placeholderPvp } from './placeholder-resolver-helper';
import { runSharedMatchCommand } from '../../src/server/room/logged-shared-pool';
import { requireAugmentFacts } from '../../src/simulation/augment-history';
import { goldenFindGoldPlan, GOLDEN_FIND_SOURCE, settleBatch5H9History } from '../../src/simulation/augment-pool-batch5-h9';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import * as matchRules from '../../src/simulation/match';
import { isAnvil } from '../../src/simulation/content/anvils';
import { ITEM_DEFINITIONS } from '../../src/simulation/content/items';
import { validateHistoricalEquipment } from '../../src/simulation/b8-restore';
import type { SeatCommand } from '../../src/server/room/types';
import { answerOpenChoices, makeRoom, runUntil } from './helpers';

describe('production placeholder Golden Find history', () => {
  const placeholder = new PlaceholderBattleResolver();
  // Keep the seed-42 seats alive until acquisition; run the production own-combat path from 4-2 onward.
  const { room, clock } = makeRoom({ resolveBattle: (input, pool) =>
    (input.round >= 19 ? placeholder : placeholderPvp).resolveBattle(input, pool) }, { pvpMode: 'placeholder' });
  const mine = () => room.state.seats.find(s => s.seatId === 's3')!.match;
  beforeAll(() => room.start());
  afterAll(() => room.dispose());
  for (let round = 2; round < 19; round++) beforeAll(() => runUntil(room, clock, s => s.round === round));
  beforeAll(() => runUntil(room, clock, s => s.round === 19 && s.phase === 'preparation'));
  it('times out into Golden Find through the production resolver', () => {
    expect(mine().pendingChoice!.offers[0]).toBe('a-golden-find');
    runUntil(room, clock, s => s.round === 19 && s.phase === 'settlement');
    expect(mine().augments).toContainEqual(expect.objectContaining({ definitionId: 'a-golden-find', acquiredRound: 19 }));
    expect(room.state.fault).toBeNull();
  });
  for (const round of [20, 21]) it(`advances through round ${round} with complete room-keyed evidence and an authentic snapshot`, () => {
    runUntil(room, clock, s => s.round === round && s.phase === 'settlement');
    expect(room.state.fault).toBeNull();
    for (const pvpRound of [19, 20].filter(r => r <= round)) {
      const [binding] = requireAugmentFacts(mine(), 'combat-binding', pvpRound);
      expect(requireAugmentFacts(mine(), 'pvp-roster', pvpRound).map(f => f.battleId)).toEqual([binding.battleId]);
      const deaths = requireAugmentFacts(mine(), 'deaths', pvpRound);
      expect(deaths.every(f => f.battleId === binding.battleId)).toBe(true);
      expect(Math.max(...deaths.map(f => f.completeThroughTick))).toBeGreaterThanOrEqual(mine().roundResults.find(r => r.round === pvpRound)!.combatTicks);
      expect(deaths.flatMap(f => f.deaths).every(d => Object.hasOwn(d, 'killer'))).toBe(true);
      expect(requireAugmentFacts(mine(), 'player-damage', pvpRound)).toEqual([expect.objectContaining({
        battleId: binding.battleId, opponentSeatId: null, actualDamage: null,
      })]);
    }
    expect(() => goldenFindGoldPlan(mine())).not.toThrow();
    expect(restoreSharedOrbSnapshot(room.state.pool, mine(), room.augmentHistoryAuthority('s3'))).toEqual(mine());
  });
  it('logs the original unexpected exception and preserves atomic failure', () => {
    const logger = vi.fn();
    const original = new RangeError('Invalid augment history: missing deaths for round 19');
    const command = vi.spyOn(matchRules, 'forfeitPendingChoice').mockImplementationOnce(() => { throw original; });
    const state = mine();
    try {
      const result = runSharedMatchCommand(room.state.pool, state, { type: 'timeoutChoice', round: state.round, choiceId: null, generation: null }, logger);
      expect(result).toMatchObject({ ok: false, reason: 'invalid-pool' });
      expect(result.state).toBe(state); expect(result.pool).toBe(room.state.pool);
      expect(logger).toHaveBeenCalledExactlyOnceWith('error', 'shared-pool.unexpected-error', expect.objectContaining({
        roomId: 'test-room', seatId: 's3', error: original.message, stack: original.stack,
      }));
    } finally { command.mockRestore(); }
  });
  it('keeps ordinary command refusals quiet and atomic', () => {
    const logger = vi.fn(), state = mine();
    const result = runSharedMatchCommand(room.state.pool, state, { type: 'timeoutChoice', round: state.round - 1, choiceId: null, generation: null }, logger);
    expect(result).toMatchObject({ ok: false, reason: 'stale-round' });
    expect(result.state).toBe(state); expect(result.pool).toBe(room.state.pool);
    expect(logger).not.toHaveBeenCalled();
  });
  it('preserves atomic invalid-pool failure when the diagnostic logger also throws', () => {
    const original = new RangeError('Invalid augment history: missing deaths for round 19');
    const logger = vi.fn(() => { throw new Error('logger unavailable'); });
    const command = vi.spyOn(matchRules, 'forfeitPendingChoice').mockImplementationOnce(() => { throw original; });
    const state = mine(), pool = room.state.pool;
    const before = structuredClone({ state, pool });
    try {
      const result = runSharedMatchCommand(pool, state, { type: 'timeoutChoice', round: state.round, choiceId: null, generation: null }, logger);
      expect(result).toEqual({ ok: false, reason: 'invalid-pool', state, pool });
      expect(result.state).toBe(state);
      expect(result.pool).toBe(pool);
      expect({ state, pool }).toEqual(before);
      expect(logger).toHaveBeenCalledExactlyOnceWith('error', 'shared-pool.unexpected-error', expect.objectContaining({ error: original.message }));
    } finally { command.mockRestore(); }
  });
});

describe('production placeholder Golden Find payout from real bound-unit kills', () => {
  const placeholder = new PlaceholderBattleResolver();
  const { room, clock } = makeRoom({ resolveBattle: (input, pool) =>
    (input.round >= 19 ? placeholder : placeholderPvp).resolveBattle(input, pool) }, { pvpMode: 'placeholder' });
  const seatId = 's3', target = 'unit-1';
  const mine = () => room.state.seats.find(s => s.seatId === seatId)!.match;
  const command = (cmd: SeatCommand) => expect(room.handle(seatId, cmd)).toMatchObject({ ok: true });
  const answer = () => answerOpenChoices(room, [seatId]);

  // Seed 42: public orb/shop/XP/equipment commands produce a two-star Darius and
  // three-star Urgot. Darius gets one real PvP kill at 4-6 and two PvE kills at 4-7.
  // That first kill must carry into the 3-kill threshold; the old T2-only logic pays nothing.
  function prepareArmy(): void {
    for (const orb of matchRules.readLootView(mine()).unclaimedOrbs ?? []) {
      if (!orb.queued) command({ type: 'claimOrb', round: mine().round, orbId: orb.orbId });
    }
    answer();
    for (const unit of mine().preparation.units.filter(u => isAnvil(u.definitionId))) {
      command({ type: 'openAnvil', unitId: unit.id });
      answer();
    }
    while (mine().gold >= 4 && mine().level < 6) command({ type: 'buyXp' });
    for (const unit of mine().preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench' && !isAnvil(u.definitionId))) {
      const board = mine().preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board');
      if (board.length >= matchRules.getDeploymentCap(mine())) break;
      const used = new Set(board.flatMap(u => u.location.kind === 'board' ? [`${u.location.cell.col},${u.location.cell.row}`] : []));
      const cell = Array.from({ length: 28 }, (_, i) => ({ col: i % 7, row: 4 + Math.floor(i / 7) }))
        .find(c => !used.has(`${c.col},${c.row}`))!;
      command({ type: 'deploy', unitId: unit.id, target: { kind: 'board', cell } });
      answer();
    }
    for (let slot = 0; slot < 5; slot++) {
      if (mine().shop.slots[slot].status === 'available' && mine().gold >= 5
        && mine().preparation.units.filter(u => u.location.kind === 'bench').length < 9) {
        command({ type: 'buy', slot, generation: mine().shop.generation });
        answer();
      }
    }
    for (let n = 0; n < 20; n++) {
      const inventory = mine().items.filter(i => i.location.kind === 'inventory');
      const pair = inventory.flatMap((a, i) => inventory.slice(i + 1).map(b => [a, b] as const))
        .find(([a, b]) => Object.values(ITEM_DEFINITIONS).some(d => d.recipe?.slice().sort().join() === [a.definitionId, b.definitionId].sort().join()));
      if (!pair) break;
      command({ type: 'combine', a: pair[0].id, b: pair[1].id });
    }
    for (const item of mine().items.filter(i => i.location.kind === 'inventory')
      .sort((a, b) => Number(b.definitionId === 'deathblade') - Number(a.definitionId === 'deathblade'))) {
      for (let slot = 0; slot < 3; slot++) {
        if (room.handle(seatId, { type: 'equip', itemId: item.id, unitId: target, slot }).ok) break;
      }
    }
    for (const unit of mine().preparation.units.filter(u => u.location.kind === 'bench' && !['darius', 'urgot'].includes(u.definitionId))) {
      command({ type: 'sell', unitId: unit.id });
    }
    for (let n = 0; n < 50; n++) {
      for (let slot = 0; slot < 5; slot++) {
        const offer = mine().shop.slots[slot];
        if (offer.status === 'available' && ['darius', 'urgot'].includes(offer.definitionId) && mine().gold >= 2) {
          command({ type: 'buy', slot, generation: mine().shop.generation });
        }
      }
      if (mine().gold < 2 || mine().preparation.units.find(u => u.id === target)?.starLevel === 3) break;
      command({ type: 'reroll' });
    }
  }

  beforeAll(() => room.start());
  afterAll(() => room.dispose());
  for (let round = 2; round < 19; round++) beforeAll(() => runUntil(room, clock, s => s.round === round));
  beforeAll(() => runUntil(room, clock, s => s.round === 19 && s.phase === 'preparation'));
  for (const round of [20, 22]) it(`prepares the seed-42 army through public room commands at round ${round}`, () => {
    runUntil(room, clock, s => s.round === round && s.phase === 'preparation');
    expect(mine().augments).toContainEqual(expect.objectContaining({ definitionId: 'a-golden-find', acquiredRound: 19 }));
    prepareArmy();
    expect(room.state.fault).toBeNull();
  });
  it('records a real original-ID kill by the bound unit in production placeholder PvP', () => {
    runUntil(room, clock, s => s.round === 23 && s.phase === 'preparation');
    const choice = mine().pendingChoice!;
    command({ type: 'anomalyTarget', choiceId: choice.choiceId, generation: choice.generation, unitId: target });
    answer();
    runUntil(room, clock, s => s.round === 23 && s.phase === 'settlement');
    expect(room.state.fault).toBeNull();
    const [binding] = requireAugmentFacts(mine(), 'combat-binding', 23);
    expect(binding.binding?.unitId).toBe(target);
    expect(requireAugmentFacts(mine(), 'combat-roster', 23).map(f => f.battleId)).toEqual([binding.battleId]);
    const kills = requireAugmentFacts(mine(), 'deaths', 23).flatMap(f => f.deaths)
      .filter(d => d.team === 'enemy' && d.ownerSeatId === null && d.killer?.ownerId === target);
    expect(kills).toHaveLength(1);
    expect(goldenFindGoldPlan(mine())).toEqual([]);
  });
  it('carries that PvP kill into the next threshold, pays once and restores the authoritative receipt', () => {
    runUntil(room, clock, s => s.round === 24 && s.phase === 'settlement');
    expect(room.state.fault).toBeNull();
    const state = mine();
    const kills = requireAugmentFacts(state, 'deaths', 24).flatMap(f => f.deaths)
      .filter(d => d.team === 'enemy' && d.killer?.ownerId === target);
    expect(kills).toHaveLength(2);
    const plan = goldenFindGoldPlan(state);
    expect(plan).toEqual([{ receiptId: JSON.stringify([GOLDEN_FIND_SOURCE, 'round:4-2:augment', 24]), source: GOLDEN_FIND_SOURCE, round: 24, amount: 2 }]);
    expect(state.seatMechanics!.receipts.filter(r => r.source === GOLDEN_FIND_SOURCE))
      .toEqual([expect.objectContaining({ receiptId: plan[0].receiptId, kind: 'gold', amount: 2 })]);
    expect(settleBatch5H9History(state).state).toBe(state);
    expect(restoreSharedOrbSnapshot(room.state.pool, state, room.augmentHistoryAuthority(seatId))).toEqual(state);
  });
  for (const field of ['unitId', 'slot', 'source', 'duplicate'] as const) it(`rejects forged dummy gift equipment: ${field}`, () => {
    const state = structuredClone(mine());
    const facts = state.resourceProvenance.entries;
    const equipped = facts.find(f => f.kind === 'item-equipped' && f.unitId === 'unit-2');
    if (!equipped || equipped.kind !== 'item-equipped') throw new Error('missing dummy gift equipment');
    if (field === 'unitId') Object.assign(equipped, { unitId: target });
    if (field === 'slot') Object.assign(equipped, { slot: 1 });
    if (field === 'source') {
      const acquired = facts[equipped.sequence - 1];
      expect(acquired.kind).toBe('item-acquired');
      Object.assign(acquired, { source: { kind: 'mechanic', receiptId: 'forged-dummy-gift' } });
    }
    if (field === 'duplicate') Object.assign(state.resourceProvenance, { entries: [...facts, { ...equipped, sequence: facts.length, roundId: state.roundDefinitionId }] });
    expect(() => validateHistoricalEquipment(null, state))
      .toThrow(field === 'unitId' || field === 'slot' ? /dummy gift equipment transaction/ : /equipment transaction/);
  });
});
