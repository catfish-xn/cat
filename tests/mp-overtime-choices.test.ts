import { expect, it } from 'vitest';
import { createMatch, enableMultiplayerSettlement, applyRoundSettlement, selectChoice,
  forfeitPendingChoice, advanceMultiplayerRound, ROUND_SETTLEMENT_VERSION, type MatchState,
  type RoundSettlementReceipt } from '../src/server-entry';
import { getMultiplayerRoundByOrdinal } from '../src/simulation/multiplayer-round';
import { advanceG23Economy, type G23BattleFacts } from '../src/simulation/g2-3-economy';
import { readG23Progress, writeG23Progress } from '../src/simulation/g2-3-state';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import { finalSettlement, accepted } from './t5r-helpers';
import { freeze } from './combat-helpers';

// v23 fmix32: seed 2 now opens Trainer Golems, whose structure this synthetic board drops; seed 4 keeps seed 2's old Crab Rave.
const SEED = 4;
/** A transaction vector: six tier-3 wins bank 90 shimmer, then the first overtime win crosses 100.
 * Round history is a contiguous settlement fixture, not an offline save or a fabricated reward. */
function overtimeMarket() {
  const base = accepted(advanceMultiplayerRound(finalSettlement(accepted(enableMultiplayerSettlement(createMatch(SEED), 'bot-5'))), 38));
  const round = getMultiplayerRoundByOrdinal(39);
  const facts = (ordinal: number): G23BattleFacts => ({ battleId: `chem:${ordinal}`, round: ordinal,
    roundKind: 'pvp', result: 'win', conquerorTier: 0, conquestTakedowns: [], chemBaronTier: 3,
    alliedDeaths: 0, rumbleStar: 0, highRollerGold: 0 });
  let progress = readG23Progress(createMatch(SEED))!;
  for (let ordinal = 33; ordinal <= 38; ordinal++) progress = advanceG23Economy(progress, facts(ordinal)).progress;
  expect(progress.chem).toMatchObject({ shimmer: 90, offer: null });
  const state: MatchState = writeG23Progress({ ...base, round: round.ordinal, roundDefinitionId: round.roundId,
    m8: { ...base.m8, round }, pendingChoice: null, phase: 'preparation', combat: null,
    preparation: { ...base.preparation, units: ['singed', 'renni', 'smeech'].map((definitionId, index) => ({
      id: `chem-${index}`, definitionId, team: 'player' as const, starLevel: 1 as const,
      location: { kind: 'board' as const, cell: { col: index, row: 4 } } })) } }, progress);
  const receipt: RoundSettlementReceipt = { version: ROUND_SETTLEMENT_VERSION,
    settlementId: 'overtime:bot-5', battleId: 'chem:39', seatId: 'bot-5', round: 39,
    roundId: 'overtime-1', settlementEligible: true, result: 'win', damage: 0, baseDamage: 17,
    opposingSurvivors: 0, growth: [], combatTicks: 100, combatEventCount: 10, g23Facts: facts(39) };
  return { state, receipt };
}

it('overtime settlement opens the newly earned black market; pick and timeout both resume and advance once', () => {
  const { state, receipt } = overtimeMarket(), before = JSON.stringify(state);
  const opened = accepted(applyRoundSettlement(freeze(state), receipt));
  expect(JSON.stringify(state)).toBe(before);
  expect(opened.phase).toBe('choice');
  expect(opened.pendingChoice).toMatchObject({ kind: 'blackMarket', returnPhase: 'settlement' });
  expect(readG23Progress(opened)!.chem).toMatchObject({ shimmer: 105, offeredThrough: 1 });
  const choice = opened.pendingChoice!;
  const offer = readG23Progress(opened)!.chem.offer!;
  expect(toPrivateSeatView(opened).seatMechanics?.seat.alchemist).toEqual(readG23Progress(opened)!.chem);
  expect(toPrivateSeatView(opened).seatMechanics?.hidden).toEqual({});
  for (const timedOut of [false, true]) {
    const resolved = accepted(timedOut
      ? forfeitPendingChoice(freeze(opened), 39, choice.choiceId, choice.generation)
      : selectChoice(freeze(opened), choice.choiceId, choice.generation, choice.offers[0]));
    expect(resolved.phase).toBe('settlement');
    expect(resolved.pendingChoice).toBeNull();
    expect(resolved.multiplayer!.receipts).toHaveLength(state.multiplayer!.receipts.length + 1);
    expect(resolved.seatMechanics!.receipts.filter(r => r.receiptId === choice.choiceId)).toHaveLength(1);
    expect(readG23Progress(resolved)!.chem.offer).toBeNull();
    if (!timedOut) {
      expect(readG23Progress(resolved)!.rewards.find(b=>b.id===offer.id)?.concreteItems).toEqual(offer.concreteItems);
      for (const item of offer.concreteItems)
        expect(readG23Progress(resolved)!.rewardClaims.find(c=>c.atomId===item.atomId)?.definitionId).toBe(item.definitionId);
    } else expect(readG23Progress(resolved)!.rewards.some(b=>b.id===offer.id)).toBe(false);
    expect(applyRoundSettlement(resolved, receipt)).toEqual({ ok: false, state: resolved, reason: 'duplicate-settlement' });
    expect(accepted(advanceMultiplayerRound(resolved, 39))).toMatchObject({ round: 40, roundDefinitionId: 'overtime-2', phase: 'preparation' });
  }
  expect(applyRoundSettlement(state, { ...receipt, damage: 1 })).toEqual({ ok: false, state, reason: 'invalid-receipt' });
});
