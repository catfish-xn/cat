import { expect, it } from 'vitest';
import { validateResourceReceipts, withResourceReceiptReuse } from '../src/simulation/resource-provenance';
import { restoreMatch } from '../src/simulation/serialization';
import { startMatchCombat } from '../src/simulation/match';
import { accepted, reachRound } from './match-helpers';

function fixture() {
  const state = reachRound('2-5');
  const context = { scheduleReceipts: state.scheduleReceipts, lootReceipts: state.m8.loot.receipts,
    mechanicReceipts: state.seatMechanics!.receipts, throughRoundOrdinal: state.round };
  return { state, context };
}

it('keeps within-call receipt projections detached and keys every receipt boundary', () => {
  const { context } = fixture(), expected = validateResourceReceipts(context);
  expect(expected.size).toBeGreaterThan(0);
  withResourceReceiptReuse(true, () => {
    const first = validateResourceReceipts(context);
    Object.assign(first.values().next().value!, { definitionId: 'caller-edited' });
    first.clear();
    expect(validateResourceReceipts(context)).toEqual(expected);
    expect(() => validateResourceReceipts({ ...context, throughRoundOrdinal: 1 })).toThrow();
    const changed = JSON.parse(JSON.stringify(context));
    changed.scheduleReceipts[0].extra = 1;
    expect(() => validateResourceReceipts(changed)).toThrow('fields');
  });
  expect(validateResourceReceipts(context)).toEqual(expected);
});

it('disables reuse for object paths and restores the outer scope after failure', () => {
  const { context } = fixture();
  const expected = validateResourceReceipts(context);
  withResourceReceiptReuse(true, () => {
    expect(validateResourceReceipts(context)).toEqual(expected);
    expect(() => withResourceReceiptReuse(false, () => {
      const raw = JSON.parse(JSON.stringify(context));
      validateResourceReceipts(raw);
      raw.scheduleReceipts[0].extra = 1;
      validateResourceReceipts(raw);
    })).toThrow('fields');
    expect(validateResourceReceipts(context)).toEqual(expected);
  });
  const raw = JSON.parse(JSON.stringify(context));
  raw.scheduleReceipts[0].extra = 1;
  expect(() => validateResourceReceipts(raw)).toThrow('fields');
});

it('freezes restored basis metadata only after complete validation and keeps each restore isolated', () => {
  const state = accepted(startMatchCombat(fixture().state)), text = JSON.stringify(state);
  const first = restoreMatch(text), second = restoreMatch(text);
  expect(first).toEqual(state); expect(second).toEqual(state);
  expect(Object.isFrozen(first.combatInputBasis)).toBe(true);
  expect(Object.isFrozen(first.combatInputBasis!.inputs.preparation.units)).toBe(true);
  expect(second.combatInputBasis).not.toBe(first.combatInputBasis);
  expect(second.combatInputBasis!.inputs.preparation).not.toBe(first.combatInputBasis!.inputs.preparation);
  const bad = JSON.parse(text);
  bad.combatInputBasis.inputs.preparation.units[0].definitionId = 'forged';
  expect(() => restoreMatch(JSON.stringify(bad))).toThrow();
  expect(restoreMatch(text)).toEqual(state);
});
