import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createMatch, previewRoundEconomy, enableMultiplayerSettlement, applyRoundSettlement,
  startMatchCombat, stepMatch, ROUND_SETTLEMENT_VERSION, type MatchState, type RoundResult } from '../src/server-entry';
import { getMultiplayerRoundById } from '../src/simulation/multiplayer-round';
import { selectPlayerBaseDamage } from '../src/simulation/match-rules';
import { accepted } from './t5r-helpers';
import { freeze } from './combat-helpers';

let openingLastTick: MatchState;
let record: RoundResult;
beforeAll(() => {
  const base = createMatch(42);
  let state = accepted(startMatchCombat({ ...base, preparation: { ...base.preparation,
    units: base.preparation.units.map(u => u.team === 'player' ? { ...u, starLevel: 3 } : u) } }));
  while (state.phase === 'combat') {
    const next = stepMatch(state).state;
    if (next.phase !== 'combat') {
      expect(next.roundResults[0].result).toBe('playerWin');
      openingLastTick = freeze(state); record = next.roundResults[0]; break;
    }
    state = next;
  }
});

const golds = [0, 9, 10, 11, 19, 20, 21, 29, 30, 31, 39, 40, 41, 49, 50, 51];
const streaks = [{kind:null,count:0}, {kind:'win',count:1}, {kind:'loss',count:2}, {kind:'win',count:4}, {kind:'loss',count:5}] as const;
describe('SR-G5-02 preview agrees with committed round results', () => {
  for (const roundId of ['1-2', '2-1', 'overtime-1', 'overtime-3']) {
    it.each(golds)(`${roundId} at %i gold: both outcomes and streak boundaries`, gold => {
      for (const streak of streaks) for (const won of [true, false]) {
        const base = createMatch(42), round = getMultiplayerRoundById(roundId);
        let state: MatchState;
        if (roundId === '1-2') state = won ? { ...openingLastTick, gold, streak }
          : { ...base, gold, streak, preparation: { ...base.preparation, units: base.preparation.units.filter(u => u.team !== 'player') } };
        else state = { ...accepted(enableMultiplayerSettlement(base, 'A')), round: round.ordinal,
          roundDefinitionId: roundId, m8: { ...base.m8, round }, gold, streak, pendingChoice: null,
          roundResults: Array.from({length:round.ordinal-1}, (_,i) => ({...record, round:i+1})) };
        const before = JSON.stringify(state), preview = previewRoundEconomy(freeze(state))!;
        expect(preview.roundId).toBe(roundId); expect(preview.gold).toBe(gold);
        let settled: MatchState;
        if (roundId === '1-2') settled = won ? stepMatch(state).state : accepted(startMatchCombat(state));
        else {
          const baseDamage = selectPlayerBaseDamage(round.stage, 'pvp', roundId);
          settled = accepted(applyRoundSettlement(state, { version: ROUND_SETTLEMENT_VERSION,
            settlementId: `${roundId}:A`, battleId: roundId, seatId:'A', round:round.ordinal, roundId,
            settlementEligible:true, result:won?'win':'loss', damage:won?0:baseDamage+2, baseDamage,
            opposingSurvivors:2, growth:[], combatTicks:100, combatEventCount:10 }));
        }
        const actual = settled.roundResults.at(-1)!;
        expect(actual.result).toBe(won ? 'playerWin' : 'enemyWin');
        expect(preview[won?'ifWin':'ifLoss']).toEqual({ base:actual.incomeBreakdown.base, interest:actual.incomeBreakdown.interest,
          win:actual.incomeBreakdown.win, streakGold:actual.incomeBreakdown.streak, streakAfter:actual.streakAfter });
        // v22 opening rounds count streaks and pay streak gold (thresholds 2/5/6 -> 1/2/3); no interest or win gold.
        if (roundId === '1-2') {
          const count = streak.kind === 'win' ? streak.count + 1 : 1;
          expect(preview.ifWin).toEqual({base:2,interest:0,win:0,streakGold:count >= 6 ? 3 : count >= 5 ? 2 : count >= 2 ? 1 : 0,streakAfter:{kind:'win',count}});
        }
        expect(JSON.stringify(state)).toBe(before);
      }
    });
  }
  // v22 opening base income is 2/3/4 for 1-2/1-3/1-4.
  it.each([['1-2',2],['1-3',3],['1-4',4],['2-1',5],['2-7',5],['overtime-1',5]] as const)(
    '%s exposes base income %i separately from outcome bonuses and loot', (roundId, base) => {
      for (const phase of ['preparation','combat'] as const) {
        const state = { ...(phase === 'combat' ? openingLastTick : createMatch(42)), roundDefinitionId:roundId, gold:49,
          streak:{kind:'win' as const,count:5} };
        const before = JSON.stringify(state), preview = previewRoundEconomy(freeze(state))!;
        expect(preview.ifWin.base).toBe(base); expect(preview.ifLoss.base).toBe(base);
        expect(JSON.stringify(state)).toBe(before);
      }
    });
  it('returns null outside active preparation/combat and for supply/eliminated seats', () => {
    const state = createMatch(42);
    for (const phase of ['choice','settlement','gameOver'] as const) expect(previewRoundEconomy({...state,phase} as MatchState)).toBeNull();
    expect(previewRoundEconomy({...state,roundDefinitionId:'2-4'})).toBeNull();
    const online = accepted(enableMultiplayerSettlement(state,'A'));
    expect(previewRoundEconomy({...online,multiplayer:{...online.multiplayer!,status:'eliminated'}})).toBeNull();
  });
  it('reads no enemy, combat, shop or RNG data and returns detached streaks', () => {
    const state = {...createMatch(42), gold:19};
    for (const field of ['preparation','combat','rngState','choiceRngState','rewardRngState','battleSeedRngState','shop']) {
      Object.defineProperty(state, field, {get() { throw new Error(`private read: ${field}`); }});
    }
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('RNG'); });
    try {
      const value = previewRoundEconomy(state)!;
      expect(value.ifWin.streakAfter).not.toBe(state.streak);
      expect(value.ifLoss.streakAfter).not.toBe(state.streak);
      expect(value.ifWin.interest).toBe(0);
    } finally { random.mockRestore(); }
  });
});
