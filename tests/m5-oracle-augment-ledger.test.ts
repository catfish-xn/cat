import { expect, it } from 'vitest';
import { augmentGold, entryXp, freeRerollCredits } from './fixtures/m5/oracle.g2.cjs';

it('transcribes acquisition gold independently, including seed 3044 Scapegoat', () => {
  for (const [id, amount] of Object.entries({scapegoat:4, 'wandering-trainer-i':1,
    'wandering-trainer-ii':6, 'trade-sector':1, 'shopping-spree':4, kingslayer:1})) {
    expect(augmentGold(id, '2-1')).toBe(amount);
  }
  expect(augmentGold('risky-moves', '2-1')).toBe(0);
  expect(augmentGold('placebo-plus', '3-2')).toBe(18);
});

it('pays Patient Study only for a fought player combat and Epoch only at the next stage entry', () => {
  const state = {round:10, augments:[{definitionId:'epoch', acquiredRound:4},
    {definitionId:'patient-study', acquiredRound:4}], roundResults:[{round:10, roundKind:'pve', result:'playerWin'}]};
  expect(entryXp(state)).toBe(6);
  expect(entryXp({...state, round:9, roundResults:[{round:9, roundKind:'pvp', result:'draw'}]})).toBe(3);
  expect(entryXp({...state, round:9, roundResults:[{round:9, roundKind:'pvp', result:'playerWin'}]})).toBe(2);
  expect(entryXp({...state, round:9, roundResults:[]})).toBe(0);
});

it('accumulates free rerolls from source grants, stage boundaries and every reached level', () => {
  const state = {round:11, level:6, seatMechanics:{seat:{'augment-acquisition-levels':{shop:3, mobility:4}}},
    augments:[{definitionId:'epoch', acquiredRound:4, choiceId:'epoch'},
      {definitionId:'trade-sector', acquiredRound:4, choiceId:'trade'},
      {definitionId:'shopping-spree', acquiredRound:4, choiceId:'shop'},
      {definitionId:'upward-mobility', acquiredRound:4, choiceId:'mobility'}]};
  expect(freeRerollCredits(state)).toBe(4 + 8 + 4 + 5 + 6 + 6);
  expect(freeRerollCredits({...state, level:4})).toBe(4 + 8 + 4);
});
