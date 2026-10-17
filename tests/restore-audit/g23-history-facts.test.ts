import { beforeAll, describe, expect, it } from 'vitest';
import { createMatch, nextRound, type MatchState } from '../../src/simulation/match';
import { restoreMatch, serializeMatch } from '../../src/simulation/serialization';
import { readG23Progress, writeG23Progress } from '../../src/simulation/g2-3-state';
import { createG23Progress, validateG23Progress } from '../../src/simulation/g2-3-match-progress';
import { advanceG23Economy, decideG23Market, type G23BattleFacts } from '../../src/simulation/g2-3-economy';
import { g23BattlePayouts } from '../../src/simulation/g2-3-settlement';
import { drainG23Rewards } from '../../src/simulation/g2-3-runtime';
import { grantMechanicGold } from '../../src/simulation/seat-mechanics';
import { validateMatchStructure } from '../../src/simulation/serialization-structure';
import { recordedCrownBattle } from '../crown-history-helpers';
import { BattleHistory } from '../../src/replay/history';
import { accepted, emptyBoard, resolveM5Choices } from '../match-helpers';

let live: ReturnType<typeof recordedCrownBattle>, state: MatchState;
beforeAll(() => {
  live = recordedCrownBattle(createMatch(42));
  state = accepted(nextRound(resolveM5Choices(live.state), 1));
});
function forged(patch: Partial<G23BattleFacts>, market = false): MatchState {
  const original = readG23Progress(state)!.economyReceipts[0];
  if (original.kind !== 'battle') throw Error('battle expected');
  let progress = advanceG23Economy(createG23Progress(state.seed), {...original.facts, ...patch}).progress;
  const action = progress.economyReceipts[0];
  if (action.kind !== 'battle') throw Error('battle expected');
  if (market) {
    expect(progress.chem.offer).not.toBeNull();
    progress = decideG23Market(progress, progress.chem.offer!.id, true, state.round);
    expect(progress.rewards.some(r => r.source === 'black-market')).toBe(true);
  }
  let bad = writeG23Progress(structuredClone(state), progress);
  for (const payout of g23BattlePayouts(action.facts, progress.conquest.chestsOpened, 0))
    {
      bad = accepted(grantMechanicGold(bad, payout));
      Object.assign(bad.seatMechanics!.receipts.at(-1)!, {round:1, roundId:live.state.roundDefinitionId});
    }
  bad = drainG23Rewards(bad);
  // The forged economy is fully self-consistent; the independent replay must
  // reject its inputs, rather than merely noticing a stale RNG/counter total.
  validateG23Progress(readG23Progress(bad)!, bad.seed, bad.round);
  return bad;
}
function reject(bad: MatchState, reason: RegExp) {
  for (const input of [bad, JSON.stringify(bad)]) {
    expect(() => restoreMatch(input)).toThrow(/缺少历史证据/);
    expect(() => restoreMatch(input, live.battles)).toThrow(reason);
  }
}
describe('A1 historical facts require trusted opening replay', () => {
  it('restores public-command history with combat cleared at object and JSON entries', () => {
    expect(state.combat).toBeNull();
    expect(restoreMatch(structuredClone(state), live.battles)).toEqual(state);
    expect(restoreMatch(serializeMatch(state, live.battles), live.battles)).toEqual(state);
  });
  it.each([
    ['conqueror', {conquerorTier:2, conquestTakedowns:['invented-kill']}],
    ['chem-baron', {chemBaronTier:3, alliedDeaths:1}],
    ['rumble', {rumbleStar:1}],
    ['highRollerGold', {highRollerGold:3}],
    ['chest', {conquerorTier:9, conquestTakedowns:Array.from({length:10}, (_,i) => `invented-${i}`)}],
  ] as const)('rejects coordinated %s facts and progression', (_name, patch) => {
    const bad = forged(patch);
    expect(() => validateMatchStructure(bad)).not.toThrow();
    reject(bad, /历史经济收据/);
  });
  it('rejects fabricated black-market earnings even when their own RNG and reward ledger agree', () => {
    const bad = forged({chemBaronTier:7, alliedDeaths:30}, true);
    reject(bad, /历史经济收据/);
  });
  it.each(['tick','eventSeq'] as const)('binds earnedEvidence to the source death %s after combat clears', key => {
    const bad = structuredClone(state), entry = bad.m8.loot.earnedEvidence[0];
    expect(entry).toBeDefined();
    const original = JSON.stringify(entry.death);
    for (const evidence of bad.m8.loot.earnedEvidence)
      if (JSON.stringify(evidence.death) === original) Object.assign(evidence.death, {[key]:evidence.death[key] + 1});
    expect(() => validateMatchStructure(bad)).not.toThrow();
    reject(bad, /历史掉落死亡证据/);
  });
  it('rejects an in-range historical survivor count against the real terminal result', () => {
    const bad = structuredClone(state);
    Object.assign(bad.roundResults[0],{survivingEnemyCount:1});
    expect(() => validateMatchStructure(bad)).not.toThrow();
    reject(bad,/历史结算结果/);
  });
  it('rejects a fully normalized historical loss paired with the original winning replay', () => {
    const loss = recordedCrownBattle(emptyBoard(createMatch(42)));
    expect(loss.state.roundResults[0].result).toBe('enemyWin');
    const candidate = accepted(nextRound(resolveM5Choices(loss.state),1));
    expect(restoreMatch(candidate,loss.battles)).toEqual(candidate);
    reject(candidate,/历史结算结果/);
  });
  it('rejects missing and repeated facts, and missing/duplicated/out-of-order replays', () => {
    const progress = readG23Progress(state)!;
    expect(() => restoreMatch(writeG23Progress(state, {...progress,
      economyReceipts:[]}), live.battles)).toThrow();
    expect(() => restoreMatch(writeG23Progress(state, {...progress,
      economyReceipts:[...progress.economyReceipts, ...progress.economyReceipts]}), live.battles)).toThrow();
    expect(() => restoreMatch(state, [])).toThrow(/缺少历史证据/);
    expect(() => restoreMatch(state, [...live.battles, ...live.battles])).toThrow(/历史缺战或重战/);
    const second = recordedCrownBattle(state, new BattleHistory('crown-history',live.battles));
    expect(restoreMatch(second.state,second.battles)).toEqual(second.state);
    expect(() => restoreMatch(second.state,[...second.battles].reverse())).toThrow();
  });
  it('never accepts multiplayer.g23Facts as independent historical evidence', () => {
    const bad = forged({rumbleStar:1});
    const facts = readG23Progress(bad)!.economyReceipts[0];
    if (facts.kind !== 'battle') throw Error('battle expected');
    Object.assign(bad,{multiplayer:{version:'multiplayer-settlement-v1',seatId:'A',status:'active',
      receipts:[{round:1,g23Facts:facts.facts}],forfeitedChoices:[]}});
    for (const input of [bad,JSON.stringify(bad)]) {
      expect(() => restoreMatch(input)).toThrow();
      expect(() => restoreMatch(input,live.battles)).toThrow();
    }
  });
});
