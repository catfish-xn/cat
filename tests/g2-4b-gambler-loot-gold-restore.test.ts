import {expect, it} from 'vitest';
import {createMatch, openAnvil, selectChoice, equipItem, deployMatchUnit, startMatchCombat, stepMatch, nextRound} from '../src/simulation/match';
import {isAnvil} from '../src/simulation/content/anvils';
import {restoreMatch, serializeMatch} from '../src/simulation/serialization';
import type {MatchState} from '../src/simulation/match-types';
import {accepted} from './fixtures/r3r4-public';
import {room, fight, accept} from './tp-helpers';
import {runSharedMatchCommand, restoreSharedOrbSnapshot} from '../src/simulation/shared-pool';
import {forfeitTerminalOrbs} from '../src/server-entry';
import {readLootView} from '../src/simulation/loot-view';

const blade = 'TFT7_Item_ShimmerscaleGamblersBlade';
function prepare(equipped = true): MatchState {
  let state = createMatch(1942);
  state = accepted(openAnvil(state, state.preparation.units.find(u => isAnvil(u.definitionId))!.id));
  const choice = state.pendingChoice!;
  expect(choice.offers).toContain(blade);
  state = accepted(selectChoice(state, choice.choiceId, choice.generation, blade));
  const owner = state.preparation.units.find(u => u.team === 'player' && !isAnvil(u.definitionId))!;
  state = accepted(deployMatchUnit(state, owner.id, {kind:'board', cell:{col:3,row:4}}));
  return equipped ? accepted(equipItem(state, state.items.find(i => i.definitionId === blade)!.id, owner.id, 0)) : state;
}
function finish(state: MatchState): MatchState {
  while (state.phase === 'combat') state = stepMatch(state).state;
  expect(state.phase).toBe('settlement');
  return state;
}
function accepts(state: MatchState): void {
  const text = JSON.stringify(state);
  expect(restoreMatch(text)).toEqual(state);
  expect(restoreMatch(state)).toEqual(state);
  expect(restoreMatch(serializeMatch(state))).toEqual(state);
}
function rejects(state: MatchState): void {
  expect(() => restoreMatch(JSON.stringify(state))).toThrow();
  expect(() => restoreMatch(state)).toThrow();
  expect(() => serializeMatch(state)).toThrow();
}
function forgeBank(state: MatchState, delta: number): MatchState {
  const bad = structuredClone(state);
  const bank = bad.combatInputBasis!.inputs.bankGold! + delta;
  Object.assign(bad.combatInputBasis!.inputs, {bankGold:bank});
  // Keep the visible declarations coherent too: the input authority must still reject.
  for (const unit of bad.combat!.strategy!.units) if (unit.openingItemBankGold !== undefined)
    Object.assign(unit, {openingItemBankGold:bank});
  for (const unit of bad.combat!.units) if (unit.openingItemBankGold !== undefined)
    Object.assign(unit, {openingItemBankGold:bank, currentItemBankGold:unit.currentItemBankGold! + delta});
  return bad;
}

it('restores real same-round PvE gold and Gambler in combat and settlement, then a no-gold-loot round', () => {
  let state = accepted(startMatchCombat(prepare()));
  accepts(state);
  const opening = state.gold;
  state = finish(state);
  expect(state.m8.loot.receipts.map(r => r.payload)).toEqual([
    {kind:'item', definitionId:'sword', quantity:1},
    {kind:'unit', definitionId:'scar', quantity:1},
    {kind:'gold', quantity:3},
  ]);
  expect(state.roundResults.at(-1)!.goldBefore).toBe(opening + 3);
  expect(state.combatInputBasis!.inputs.bankGold).toBe(opening);
  accepts(state);
  expect(stepMatch(restoreMatch(serializeMatch(state))).state).toEqual(state);
  state = accepted(startMatchCombat(accepted(nextRound(state, state.round))));
  expect(state.gold).toBeGreaterThan(0);
  accepts(state);
  const noLootOpening = state.gold;
  state = finish(state);
  expect(state.roundResults.at(-1)!.goldBefore).toBe(noLootOpening);
  accepts(state);
});

it('rejects changing paid solo gold to a structurally valid forfeited receipt', () => {
  const state = finish(accepted(startMatchCombat(prepare()))), saved = serializeMatch(state);
  const bad = structuredClone(state), receipt = bad.m8.loot.receipts.find(r => r.payload.kind === 'gold')!;
  // Supply all resolution fields, so the structural receipt validator accepts
  // the forgery and combat-bank authority must account for its zero payment.
  Object.assign(receipt, {resolution:'forfeited', gold:0, claimedRoundId:state.roundDefinitionId});
  rejects(bad);
  for (const input of [bad, JSON.stringify(bad)])
    expect(() => restoreMatch(input)).toThrowError(/^Invalid combat input basis$/);
  expect(serializeMatch(state)).toBe(saved);
});

it('rejects both directions of real online receipt forfeiture flips', () => {
  const initial = room(undefined, 1, 1), done = fight(initial.pool, initial.states[0]);
  const orb = readLootView(done.state).unclaimedOrbs!.find(o => o.entries.some(e => e.kind === 'gold'))!;
  expect(orb).toBeDefined();
  const paid = accept(runSharedMatchCommand(done.pool, done.state, {type:'claimOrb', round:done.state.round, orbId:orb.orbId}));
  const forfeited = forfeitTerminalOrbs(done.state).state;
  for (const {state:original, pool} of [paid, {state:forfeited, pool:done.pool}]) {
    expect(restoreSharedOrbSnapshot(pool, original)).toEqual(original);
    expect(restoreSharedOrbSnapshot(pool, JSON.stringify(original))).toEqual(original);
    const saved = JSON.stringify(original), bad = structuredClone(original);
    const receipt = bad.m8.loot.receipts.find(r => r.payload.kind === 'gold')!;
    expect(receipt.resolution).toBe(original === paid.state ? 'held' : 'forfeited');
    Object.assign(receipt, original === paid.state ? {resolution:'forfeited', gold:0} : {resolution:'held', gold:receipt.payload.quantity});
    for (const input of [bad, JSON.stringify(bad)])
      expect(() => restoreSharedOrbSnapshot(pool, input)).toThrowError(/^Invalid multiplayer orb ledger: receipt status$/);
    expect(JSON.stringify(original)).toBe(saved);
  }
});

it('rejects blade +/-1 and shifting PvE loot into or out of its authenticated combat basis', () => {
  const state = finish(accepted(startMatchCombat(prepare())));
  for (const delta of [1, -1, 3, -3]) rejects(forgeBank(state, delta));
  const goldReceipt = state.m8.loot.receipts.find(r => r.payload.kind === 'gold')!;
  for (const delta of [1, -1]) {
    const bad = forgeBank(state, delta);
    const receipt = bad.m8.loot.receipts.find(r => r.dropId === goldReceipt.dropId)!;
    // Counter-shift loot and bank so their sum remains unchanged.
    Object.assign(receipt.payload, {quantity:goldReceipt.payload.quantity - delta});
    rejects(bad);
    const frozen = bad.m8.loot.frozen.rounds[0].encounterPlan.drops.find(d => d.dropId === receipt.dropId)!;
    Object.assign(frozen.payload, {quantity:goldReceipt.payload.quantity - delta});
    rejects(bad);
  }
  const noLoot = finish(accepted(startMatchCombat(accepted(nextRound(state, state.round)))));
  for (const delta of [1, -1, 3, -3]) rejects(forgeBank(noLoot, delta));
  for (const original of [state, noLoot]) for (const field of ['openingItemBankGold', 'currentItemBankGold'] as const) {
    for (const delta of [1, -1]) {
      const bad = structuredClone(original);
      const holder = bad.combat!.units.find(u => u.openingItemBankGold !== undefined)!;
      Object.assign(holder, {[field]:holder[field]! + delta});
      rejects(bad);
    }
  }
});

it('authenticates a blade equipped during combat against the same pre-loot bank', () => {
  let state = prepare(false);
  const owner = state.preparation.units.find(u => u.team === 'player')!;
  state = accepted(startMatchCombat(state));
  state = accepted(equipItem(state, state.items.find(i => i.definitionId === blade)!.id, owner.id, 1));
  expect(state.combat!.pendingEquipment).toHaveLength(1);
  accepts(state);
  state = finish(state);
  accepts(state);
  for (const delta of [1, -1]) {
    const bad = structuredClone(state);
    const receipt = bad.combat!.equipmentReceipts![0];
    Object.assign(receipt.after, {bankGold:receipt.after.bankGold! + delta});
    rejects(bad);
  }
});

it('reuses the same trusted trajectory for gold without exposing its cursor or accepting altered receipts', async () => {
  const { createRestoreCombatReplay } = await import('../src/simulation/restore-combat-replay');
  const { validateCombatItemGold } = await import('../src/simulation/g2-4b-gold-restore');
  const combat = await import('../src/simulation/combat');
  const { vi } = await import('vitest');
  let state = accepted(startMatchCombat(prepare()));
  for (let n = 0; n < 10 && state.phase === 'combat'; n++) state = stepMatch(state).state;
  const basis = state.combatInputBasis!, strategy = state.combat!.strategy!, candidate = state.combat!;
  const replay = createRestoreCombatReplay(basis, strategy, candidate.tick, true);
  replay.atSaveTick();
  const create = vi.spyOn(combat, 'createCombatWithEvents'), step = vi.spyOn(combat, 'stepCombat');
  try {
    validateCombatItemGold(candidate, basis, strategy, replay);
    expect(create).not.toHaveBeenCalled(); expect(step).not.toHaveBeenCalled();
    const detached = replay.itemGoldAtSaveTick();
    Object.assign(detached.units[0], { currentItemBankGold: -100 });
    validateCombatItemGold(candidate, basis, strategy, replay);
    expect(replay.itemGoldAtSaveTick()).not.toEqual(detached);
    const bad = structuredClone(candidate);
    Object.assign(bad, { itemGoldReceipts: [...bad.itemGoldReceipts!, { invented: true }] });
    const failure = (run: () => unknown) => {
      try { run(); } catch (error) {
        if (error instanceof Error) return { name: error.name, message: error.message };
        throw error;
      }
      throw new Error('Expected gold forgery rejection');
    };
    expect(failure(() => validateCombatItemGold(bad, basis, strategy, replay)))
      .toEqual(failure(() => validateCombatItemGold(bad, basis, strategy)));
    validateCombatItemGold(candidate, basis, strategy, replay);
  } finally { create.mockRestore(); step.mockRestore(); }
});
