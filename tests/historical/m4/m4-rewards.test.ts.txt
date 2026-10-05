import { describe, expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { planReward } from '../src/simulation/rewards';
import { getRoundSchedule } from '../src/simulation/round-schedule';
import type { MatchState } from '../src/simulation/match-types';
import type { ScheduleEvent } from '../src/simulation/strategy-types';
const reward = (round: number) => getRoundSchedule(round).find((event): event is Extract<ScheduleEvent, { kind: 'reward' }> => event.kind === 'reward')!;
const bigWord = (state: number) => Number((BigInt(state) * 1664525n + 1013904223n) % 4294967296n);
function commitReward(state: MatchState, round: number): MatchState {
  const current = { ...state, round };
  const { receipt, ...plan } = planReward(current, reward(round));
  return { ...current, ...plan, scheduleReceipts: [...current.scheduleReceipts, receipt] };
}
function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeDeep); Object.freeze(value); }
  return value;
}
describe('deterministic inventory acquisition and reward receipts', () => {
  it('grants the initial blade and rod once without consuming any reward words', () => {
    const state = createMatch(42);
    expect(state.items).toEqual([
      { id: 'item-1', definitionId: 'blade', location: { kind: 'inventory' } },
      { id: 'item-2', definitionId: 'rod', location: { kind: 'inventory' } },
    ]);
    expect(state.nextItemSerial).toBe(3);
    expect(state.rewardRngState).toBe((42 ^ 0x85ebca6b) >>> 0);
    const repeated = planReward(state, reward(1));
    expect(repeated.items).toBe(state.items);
    expect(repeated.receipt).toBe(state.scheduleReceipts[0]);
    expect(repeated.nextItemSerial).toBe(3);
  });
  it('uses one independent BigInt-verified word per random component in ASCII order', () => {
    let state = createMatch(42);
    let expectedRewardState = state.rewardRngState;
    const initialShopState = state.rngState, initialChoiceState = state.choiceRngState;
    for (const round of [3, 4, 6, 8, 10, 12]) {
      const before = JSON.stringify(state);
      freezeDeep(state);
      const next = commitReward(state, round);
      expectedRewardState = bigWord(expectedRewardState);
      expect(next.items.at(-1)?.definitionId).toBe(['belt', 'blade', 'rod', 'tear', 'vest'][expectedRewardState % 5]);
      expect(next.rewardRngState).toBe(expectedRewardState);
      expect([next.rngState, next.choiceRngState]).toEqual([initialShopState, initialChoiceState]);
      expect(JSON.stringify(state)).toBe(before);
      const serialized = JSON.parse(JSON.stringify(state)) as MatchState;
      expect(commitReward(serialized, round)).toEqual(next);
      state = next;
    }
    expect(state.items).toHaveLength(8);
    expect(new Set(state.items.map(item => item.id)).size).toBe(8);
  });
  it('has no hidden coupling to shop draws or choice draws', () => {
    const state = createMatch(0);
    expect(planReward({ ...state, round: 3 }, reward(3))).toEqual(planReward({ ...state, rngState: 123, choiceRngState: 456, round: 3 }, reward(3)));
  });
  it('grants R7 gold and a public one-star bench sentinel only when all owned units are absent', () => {
    const initial = createMatch();
    const empty: MatchState = { ...initial, round: 7, preparation: { ...initial.preparation, units: initial.preparation.units.filter(unit => unit.team === 'enemy') } };
    const plan = planReward(freezeDeep(empty), reward(7));
    expect(plan.gold).toBe(initial.gold + 2);
    expect(plan.preparation.units.find(unit => unit.team === 'player')).toEqual({ id: 'unit-6', definitionId: 'sentinel', team: 'player', starLevel: 1, location: { kind: 'bench', slot: 0 } });
    expect(plan.receipt.unitId).toBe('unit-6');
    expect(plan.nextUnitSerial).toBe(7);
    expect(plan.rewardRngState).toBe(initial.rewardRngState);
    expect(planReward({ ...initial, round: 7 }, reward(7)).preparation).toBe(initial.preparation);
    const { receipt, ...fields } = plan;
    const completed: MatchState = { ...empty, ...fields, scheduleReceipts: [...empty.scheduleReceipts, receipt] };
    const soldAgain: MatchState = { ...completed, preparation: empty.preparation };
    expect(planReward(soldAgain, reward(7)).preparation.units.some(unit => unit.team === 'player')).toBe(false);
    expect(planReward(soldAgain, reward(7)).gold).toBe(plan.gold);
  });
});
