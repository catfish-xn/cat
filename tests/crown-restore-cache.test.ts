import { afterEach, expect, it, vi } from 'vitest';
import * as commands from '../src/simulation/match';
import { restoreMatch } from '../src/simulation/serialization';
import { validateMatchHistory } from '../src/simulation/battle-record-validation';
import * as equipment from '../src/simulation/b8-restore';
import { MAX_BATTLE_RECORDS, MAX_COMPLETED_RUNS } from '../src/m6/limits';
import { recordedCrownBattle } from './crown-history-helpers';
import { accepted, emptyBoard, resolveM5Choices } from './match-helpers';

afterEach(() => vi.restoreAllMocks());

it('keeps recently used proofs under cache pressure within the same record bound', () => {
  const live = recordedCrownBattle(emptyBoard(commands.createMatch(12303)));
  const records = Array.from({length: MAX_BATTLE_RECORDS * (MAX_COMPLETED_RUNS + 1) + 1}, (_, i) =>
    ({...structuredClone(live.battles[0]), runId: `cache-pressure-${i}`}));
  for (const record of records.slice(0, -1)) validateMatchHistory(live.state, [record]);
  validateMatchHistory(live.state, [records[0]]);
  validateMatchHistory(live.state, [records.at(-1)!]);
  const start = vi.spyOn(commands, 'startMatchCombat');
  validateMatchHistory(live.state, [records[0]]);
  expect(start).not.toHaveBeenCalled();
  validateMatchHistory(live.state, [records[1]]);
  expect(start).toHaveBeenCalledTimes(1);
});

it('reuses immutable historical edges while checking every current candidate', () => {
  const first = recordedCrownBattle(emptyBoard(commands.createMatch(12304)));
  const next = accepted(commands.nextRound(resolveM5Choices(first.state), first.state.round));
  const second = recordedCrownBattle(next, first.history);
  validateMatchHistory(second.state, second.battles);
  const carry = vi.spyOn(equipment, 'validateHistoricalEquipment');
  validateMatchHistory(second.state, second.battles);
  expect(carry).toHaveBeenCalledTimes(1);
  expect(carry.mock.calls[0][1]).toBe(second.state);
  const altered = structuredClone(second.state);
  Object.assign(altered.resourceProvenance, {entries: altered.resourceProvenance.entries.slice(0, -1)});
  expect(() => validateMatchHistory(altered, second.battles)).toThrow(/历史获得或合成/);
});

it('reuses owned battle proofs but still checks each candidate and only replays a new round', () => {
  const first = recordedCrownBattle(commands.createMatch(12301));
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

it('reuses content proofs across cloned external evidence but rejects changes after an earlier success', () => {
  const live = recordedCrownBattle(commands.createMatch(12302));
  const external = structuredClone(live.battles);
  const start = vi.spyOn(commands, 'startMatchCombat');
  expect(restoreMatch(live.state, external)).toEqual(live.state);
  expect(restoreMatch(live.state, external)).toEqual(live.state);
  expect(start).toHaveBeenCalledTimes(1);
  Object.assign(external[0].initial, { tick: 1 });
  expect(() => restoreMatch(live.state, external)).toThrow(/tick0/);
  expect(start).toHaveBeenCalledTimes(2);
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
