import { describe, expect, it } from 'vitest';
import { OPENING_INITIAL_STATE, planOpeningEconomy, type OpeningEconomyInput } from '../src/simulation/opening-economy';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import { MATCH_RULES } from '../src/simulation/match-rules';

// All numeric answers handwritten from OPENING §§2, 3.1, 3.2, 5 before running implementation.
// provisional: round ID literals follow B6-Q1 pending user approval.
const input = (overrides: Partial<OpeningEconomyInput> = {}): OpeningEconomyInput => ({
  roundId:'1-2', result:'playerWin', gold:0, level:1, xp:0, streak:{kind:null,count:0}, ...overrides,
});

describe('B6 isolated opening economy', () => {
  it('exports only immutable initialization data for the 1-1 semantics', () => {
    expect(OPENING_INITIAL_STATE).toEqual({
      gold:0, level:1, xp:0, hp:100,
      unit:{definitionId:'irelia', id:'unit-1', starLevel:1, cell:{col:1,row:4}}, nextUnitSeq:2,
    });
    expect(Object.isFrozen(OPENING_INITIAL_STATE)).toBe(true);
    expect(Object.isFrozen(OPENING_INITIAL_STATE.unit)).toBe(true);
    expect(Object.isFrozen(OPENING_INITIAL_STATE.unit.cell)).toBe(true);
  });

  it('follows the complete 0G/level1 -> 2G/level2 -> 5G/level3 -> 10G/level3 ledger', () => {
    let current = input();
    for (const expected of [
      {roundId:'1-2', base:2, naturalXp:2, gold:2, level:2, xp:0, gained:1},
      {roundId:'1-3', base:3, naturalXp:2, gold:5, level:3, xp:0, gained:1},
      {roundId:'1-4', base:5, naturalXp:0, gold:10, level:3, xp:0, gained:0},
    ]) {
      const plan = planOpeningEconomy({...current, roundId:expected.roundId});
      expect(plan.kind).toBe('opening');
      if (plan.kind !== 'opening') throw new Error('Expected an opening plan');
      expect(plan.incomeBreakdown).toEqual({base:expected.base,win:0,interest:0,streak:0});
      expect(plan.income).toBe(expected.base);
      expect(plan.goldAfter).toBe(expected.gold);
      expect(plan.naturalXp).toBe(expected.naturalXp);
      expect(plan.playerDamage).toBe(0);
      expect(plan.progression).toEqual({
        level:expected.level, xp:expected.xp, xpRequested:expected.naturalXp,
        xpApplied:expected.naturalXp, levelsGained:expected.gained,
      });
      current = {...current, gold:plan.goldAfter, level:plan.progression.level, xp:plan.progression.xp};
    }
    expect(planOpeningEconomy({...current, roundId:'2-1'})).toEqual({kind:'existing-rules',roundId:'2-1'});
  });

  it.each([
    ['1-2',2,2], ['1-3',3,2], ['1-4',5,0],
  ] as const)('%s pays %iG and %iXP on win, loss and draw without interest or streak changes', (roundId, base, naturalXp) => {
    for (const result of ['playerWin','enemyWin','draw'] as const) {
      for (const streak of [{kind:null,count:0}, {kind:'win',count:6}, {kind:'loss',count:4}] as const) {
        const value = input({roundId,result,gold:50,level:3,streak});
        const before = structuredClone(value);
        const plan = planOpeningEconomy(value);
        if (plan.kind !== 'opening') throw new Error('Expected an opening plan');
        expect(plan.incomeBreakdown).toEqual({base,win:0,interest:0,streak:0});
        expect(plan.goldAfter).toBe(50 + base);
        expect(plan.naturalXp).toBe(naturalXp);
        expect(plan.playerDamage).toBe(result === 'playerWin' ? 0 : 3);
        expect(plan.streakAfter).toEqual(streak);
        expect(plan.streakAfter).not.toBe(streak);
        expect(value).toEqual(before);
      }
    }
  });

  it('preserves active operations and uses the existing progression rules across thresholds and cap', () => {
    const cases = [
      {roundId:'1-2', gold:17, level:3, xp:5, afterGold:19, afterLevel:4, afterXp:1, applied:2, gained:1},
      {roundId:'1-3', gold:1, level:8, xp:75, afterGold:4, afterLevel:9, afterXp:0, applied:1, gained:1},
      {roundId:'1-4', gold:23, level:4, xp:7, afterGold:28, afterLevel:4, afterXp:7, applied:0, gained:0},
      {roundId:'1-2', gold:3, level:9, xp:0, afterGold:5, afterLevel:9, afterXp:0, applied:0, gained:0},
    ];
    for (const c of cases) {
      const plan = planOpeningEconomy(input(c));
      if (plan.kind !== 'opening') throw new Error('Expected an opening plan');
      expect([plan.goldAfter,plan.progression.level,plan.progression.xp,plan.progression.xpApplied,plan.progression.levelsGained])
        .toEqual([c.afterGold,c.afterLevel,c.afterXp,c.applied,c.gained]);
    }
  });

  it('returns the existing-rules marker for all 35 later rounds without calculating a second economy', () => {
    const laterRounds = ROUND_CATALOG.filter(r => r.stage >= 2);
    expect(laterRounds).toHaveLength(35);
    for (const r of laterRounds) expect(planOpeningEconomy(input({roundId:r.roundId,result:r.kind === 'supply' ? null : 'playerWin'})))
      .toEqual({kind:'existing-rules',roundId:r.roundId});
  });

  it('has the handwritten full-match base budget: 0 + 10 + 35*5 = 185G', () => {
    let baseGold = OPENING_INITIAL_STATE.gold;
    let laterRounds = 0;
    for (const r of ROUND_CATALOG) {
      const plan = planOpeningEconomy(input({roundId:r.roundId,result:r.kind === 'supply' ? null : 'playerWin'}));
      if (plan.kind === 'opening') baseGold += plan.incomeBreakdown.base;
      else laterRounds++;
    }
    expect(baseGold).toBe(10);
    expect(laterRounds).toBe(35);
    expect(MATCH_RULES.roundIncome).toBe(5);
    expect(baseGold + laterRounds * MATCH_RULES.roundIncome).toBe(185);
  });

  it('is deterministic and never mutates frozen input, including its streak', () => {
    const value = Object.freeze(input({roundId:'1-3',gold:19,level:3,xp:5,result:'enemyWin',streak:Object.freeze({kind:'win',count:8})}));
    const before = structuredClone(value);
    const first = planOpeningEconomy(value);
    expect(planOpeningEconomy(value)).toEqual(first);
    expect(value).toEqual(before);
  });

  it.each([
    {roundId:'1-1'}, {roundId:'1-5'}, {result:null}, {gold:-1}, {gold:0.5}, {gold:NaN}, {gold:Infinity},
    {gold:Number.MAX_SAFE_INTEGER}, {level:0}, {level:10}, {xp:-1}, {xp:2}, {level:9,xp:1},
    {streak:{kind:null,count:1}}, {streak:{kind:'win',count:0}}, {streak:{kind:'loss',count:-1}},
    {roundId:'2-1',result:null}, {roundId:'2-4',result:'draw'},
  ] satisfies Partial<OpeningEconomyInput>[])('rejects invalid input without mutation: %j', overrides => {
    const value = input(overrides), before = structuredClone(value);
    expect(() => planOpeningEconomy(value)).toThrow(RangeError);
    expect(value).toEqual(before);
  });
});
