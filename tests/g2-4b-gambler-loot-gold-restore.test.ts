import {expect, it} from 'vitest';
import {createMatch, openAnvil, selectChoice, equipItem, deployMatchUnit, startMatchCombat, stepMatch, nextRound} from '../src/simulation/match';
import {isAnvil} from '../src/simulation/content/anvils';
import {restoreMatch, serializeMatch} from '../src/simulation/serialization';
import type {MatchState} from '../src/simulation/match-types';
import {accepted} from './fixtures/r3r4-public';

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
