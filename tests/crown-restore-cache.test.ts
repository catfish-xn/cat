import { afterEach, expect, it, vi } from 'vitest';
import * as commands from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { validateMatchHistory } from '../src/simulation/battle-record-validation';
import { recordedCrownBattle } from './crown-history-helpers';
import { accepted, resolveM5Choices } from './match-helpers';

afterEach(() => vi.restoreAllMocks());

it('reuses owned battle proofs but still checks each candidate and only replays a new round', () => {
  const first = recordedCrownBattle(commands.createMatch(42));
  const start = vi.spyOn(commands, 'startMatchCombat');
  validateMatchHistory(first.state, first.battles);
  expect(start).toHaveBeenCalledTimes(1);
  start.mockClear();
  const clone = vi.spyOn(globalThis, 'structuredClone');
  validateMatchHistory(first.state, first.battles);
  expect(start).not.toHaveBeenCalled();
  expect(clone).not.toHaveBeenCalled();
  const altered = structuredClone(first.state);
  Object.assign(altered.roundResults[0], { result: 'draw' });
  expect(() => validateMatchHistory(altered, first.battles)).toThrow(/历史结算结果/);
  const settled = resolveM5Choices(first.state);
  const next = accepted(commands.nextRound(settled, settled.round));
  const second = recordedCrownBattle(next, first.history);
  start.mockClear();
  expect(restoreMatch(second.state, second.battles)).toEqual(second.state);
  expect(start).toHaveBeenCalledTimes(1);
});

it('replays mutable external evidence each time, including after an earlier success', () => {
  const live = recordedCrownBattle(commands.createMatch(42));
  const external = structuredClone(live.battles);
  const start = vi.spyOn(commands, 'startMatchCombat');
  expect(restoreMatch(live.state, external)).toEqual(live.state);
  expect(restoreMatch(live.state, external)).toEqual(live.state);
  expect(start).toHaveBeenCalledTimes(2);
  Object.assign(external[0].initial, { tick: 1 });
  expect(() => restoreMatch(live.state, external)).toThrow(/tick0/);
});

it('restoration preserves detachment, continuation, key order and rejection', () => {
  const original = accepted(commands.startMatchCombat(commands.createMatch(42)));
  const input = structuredClone(original);
  const restored = restoreMatch(input);
  expect(restored).toEqual(original);
  expect(input).toEqual(original);
  expect(commands.stepMatch(restored)).toEqual(commands.stepMatch(original));
  expect(restored.combat).not.toBe(input.combat);
  Object.assign(restored.combat!.units[0], { hp: 0 });
  expect(restoreMatch(input)).toEqual(original);
  const reordered = Object.fromEntries(Object.entries(input).reverse());
  expect(restoreMatch(reordered)).toEqual(original);
  Object.assign(input.combat!.strategy!, { extra: true });
  expect(() => restoreMatch(input)).toThrow();
});

it('retains native Proxy rejection and does not normalize object negative zero', () => {
  const original = accepted(commands.startMatchCombat(commands.createMatch(42)));
  expect(() => restoreMatch(new Proxy(original, {}))).toThrow();
  const nested = structuredClone(original);
  Object.assign(nested, { combat: new Proxy(nested.combat!, {}) });
  expect(() => restoreMatch(nested)).toThrow();
  const signed = structuredClone(original);
  Object.assign(signed.combat!.units[0], { cooldownTicks: -0 });
  expect(Object.is(restoreMatch(signed).combat!.units[0].cooldownTicks, -0)).toBe(true);
});


it('ties warmed owned proofs to seed economics and rechecks the current candidate', () => {
  const first = recordedCrownBattle(commands.createMatch(42));
  validateMatchHistory(first.state, first.battles);
  const next = accepted(commands.nextRound(resolveM5Choices(first.state), first.state.round));
  const second = recordedCrownBattle(next, first.history);
  expect(restoreMatch(second.state, second.battles)).toEqual(second.state);
  const forged = structuredClone(accepted(commands.nextRound(resolveM5Choices(second.state), second.state.round)));
  Object.assign(forged, { gold: forged.gold + 1 });
  for (const input of [forged, JSON.stringify(forged)])
    expect(() => restoreMatch(input, second.battles)).toThrow('Invalid Match save: preparation-ledger-gold');
  expect(() => serializeMatch(forged, second.battles)).toThrow('Invalid Match save: preparation-ledger-gold');
  const records = structuredClone(second.battles);
  Object.assign(records[1].context, { gold: records[1].context.gold + 1 });
  expect(() => restoreMatch(second.state, records)).toThrow('Invalid Match save: preparation-ledger-gold');
  const old = structuredClone(second.state) as Partial<typeof second.state>;
  Reflect.deleteProperty(old, 'preparationLedger');
  expect(() => restoreMatch(old, second.battles)).toThrow('Invalid Match save: preparation-ledger-missing');
});

it('validates a getter-provided forged context exactly once', () => {
  const first = recordedCrownBattle(commands.createMatch(1));
  validateMatchHistory(first.state, first.battles);
  const record = structuredClone(first.battles[0]);
  const forged = structuredClone(record.context);
  Object.assign(forged, { gold: forged.gold + 1 });
  let reads = 0;
  Object.defineProperty(record, 'context', { enumerable: true, get: () => { reads++; return forged; } });
  expect(() => restoreMatch(first.state, [record])).toThrow('Invalid Match save: preparation-ledger-gold');
  expect(reads).toBe(1);
});
