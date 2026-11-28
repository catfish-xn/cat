import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { captureAugmentHistoryAuthority } from '../../src/simulation/augment-history';
import { validateB8Resources } from '../../src/simulation/b8-restore';
import { canonicalContent } from '../../src/simulation/content';
import { readCombatStrategyInputs } from '../../src/simulation/combat-input';
import { equipItem, selectChoice, type MatchState } from '../../src/simulation/match';
import { appendResourceProvenance } from '../../src/simulation/resource-provenance';
import { grantMechanicItem } from '../../src/simulation/seat-mechanics';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { buildStrategySnapshot } from '../../src/simulation/strategy-snapshot';
import { M5_UNIT_IDS } from '../../src/simulation/units';
import { installB1Offers } from '../fixtures/b1-scripted-offers';
import { accepted } from '../match-helpers';
import { answerOpenChoices, makeRoom, runUntilClaiming } from './helpers';

const carry = 'im-the-carry-now', anger = 'anger-issues';
// Independent expected kit: do not derive this assertion from the production grant table.
const kit = ['crownguard', 'bloodthirster', 'titans-resolve'];
const inputs = (s: MatchState) => [s, JSON.stringify(s), canonicalContent(s)];

for (const first of [carry, anger]) describe(`B5-21 + B5-83: ${first} first`, () => {
  // The 0..100 tier search found 29 gives gold/prismatic/prismatic for the inverse route.
  // v26: the carry route's 2-7 krugs leg (14.24 neutrals 568eeea4 + targeting 8106acee/927d3045) took 3146 combat ticks
  // over 8 seats on seed 0 (v25: 1943) and ~2x the v25 wall time, with no history augment on any seat. Seed 35 keeps the
  // same scripted carry/anger route and takes 2367 ticks there (was seed 0; timeout unchanged).
  const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: first === carry ? 35 : 29 });
  let seatId = 's3', restoreOffers: () => void;
  let state: MatchState, fixed: MatchState['items'], ordinaryIds: string[] = [];
  let authority: ReturnType<typeof captureAugmentHistoryAuthority>;
  const mine = () => room.state.seats.find(s => s.seatId === seatId)!.match;
  beforeAll(() => { restoreOffers = installB1Offers([anger, carry]); room.start(); });
  afterAll(() => { restoreOffers?.(); room.dispose(); });
  const rounds = ['1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '3-1', '3-2',
    ...(first === anger ? ['3-3', '3-4', '3-5', '3-6', '3-7', '4-1', '4-2'] : [])];
  for (const round of rounds) it(`reaches ${round} through the real room`, () => {
    runUntilClaiming(room, clock, s => s.roundId === round && s.phase === (round.endsWith('-4') ? 'settlement' : 'preparation'), 5000);
    if (round === rounds.at(-1)) return;
    if (first === anger && round === '3-2') {
      // Seen cards cannot recur: choose a human seat that has not already seen the carry card.
      const seat = room.state.seats.find(s => s.kind === 'human' && s.match.pendingChoice?.offers.includes(anger)
        && !s.match.removedAugmentIds.includes(carry));
      expect(seat).toBeDefined();
      seatId = seat!.seatId;
    }
    if (first === carry && round === '2-1' || first === anger && round === '3-2') {
      const c = mine().pendingChoice!;
      // Scripted offer fixture self-check; this does not claim a real-RNG offer.
      expect(c.offers).toContain(first);
      expect(room.handle(seatId, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: first })).toMatchObject({ ok: true });
    }
    if (round === '2-1' || round === '3-2') answerOpenChoices(room);
  });
  it('keeps the fixed kit and converts the same three ordinary items in the ledger and frozen battle input', () => {
    state = mine();
    expect(state.multiplayer).toBeDefined();
    const second = first === carry ? anger : carry, c = state.pendingChoice!;
    // Scripted offer fixture self-check, preserving actual eligibility and RNG advancement.
    expect(c.offers).toContain(second);
    const champion = state.preparation.units.find(u => u.team === 'player' && M5_UNIT_IDS.includes(u.definitionId))!;
    expect(champion).toBeDefined();
    // Exercise public domain transactions on the shared seat's draft. Its captured authority below
    // belongs to this draft; it is never presented as the room's checkpoint.
    for (const [slot, definitionId] of kit.entries()) {
      const grant = grantMechanicItem(state, { source: 'test', receiptId: `ordinary-kit:${slot}`, definitionId });
      expect(grant.ok).toBe(true);
      if (!grant.ok || grant.receipt.kind !== 'item') throw Error('ordinary grant failed');
      state = grant.state;
      const itemId = grant.receipt.itemId;
      ordinaryIds.push(itemId);
      expect(state.items.find(i => i.id === itemId)?.definitionId).toBe(first === anger ? 'rageblade' : definitionId);
      state = accepted(equipItem(state, itemId, champion.id, slot));
    }
    state = accepted(selectChoice(state, c.choiceId, c.generation, second));
    expect(state.augments.map(a => a.definitionId)).toEqual(expect.arrayContaining([carry, anger]));
    const golem = state.preparation.units.find(u => u.definitionId === 'carry-golem')!;
    fixed = state.items.filter(i => i.location.kind === 'unit' && i.location.unitId === golem.id);
    expect(fixed.map(i => i.definitionId)).toEqual(kit);
    expect(state.items.filter(i => ordinaryIds.includes(i.id)).map(i => i.definitionId)).toEqual(['rageblade', 'rageblade', 'rageblade']);
    const conversions = state.resourceProvenance.entries.filter(e => e.kind === 'anger-item-converted');
    expect(conversions.filter(e => fixed.some(i => i.id === e.itemId))).toEqual([]);
    expect(conversions.filter(e => ordinaryIds.includes(e.itemId))).toHaveLength(3);
    const strategy = buildStrategySnapshot(readCombatStrategyInputs(state));
    expect(strategy.units.find(u => u.unitId === golem.id)!.itemPrograms!.map(p => p.source.definitionId)).toEqual(kit);
    expect(strategy.units.find(u => u.unitId === champion.id)!.itemPrograms!.map(p => p.source.definitionId)).toEqual(['rageblade', 'rageblade', 'rageblade']);
    authority = captureAugmentHistoryAuthority(state);
  });
  for (const [index, format] of ['object', 'JSON', 'canonical'].entries()) it(`round trips ${format}`, () => {
    expect(restoreSharedOrbSnapshot(room.state.pool, inputs(state)[index], authority)).toEqual(state);
  });
  const changedFixed = (): MatchState => ({ ...state, items: state.items.map(i => i.id === fixed[0].id ? { ...i, definitionId: 'rageblade' } : i) });
  const forgedConversion = (): MatchState => ({ ...changedFixed(), resourceProvenance: appendResourceProvenance(state.resourceProvenance, state.roundDefinitionId,
    { kind: 'anger-item-converted', itemId: fixed[0].id, from: 'crownguard', to: 'rageblade', receiptId: state.augments.find(a => a.definitionId === anger)!.choiceId }) });
  const unchangedOrdinary = (): MatchState => ({ ...state, items: state.items.map(i => i.id === ordinaryIds[0] ? { ...i, definitionId: 'crownguard' } : i) });
  const missingConversion = (): MatchState => ({ ...unchangedOrdinary(), resourceProvenance: { ...state.resourceProvenance,
    entries: state.resourceProvenance.entries.filter(e => e.kind !== 'anger-item-converted' || e.itemId !== ordinaryIds[0])
      .map((e, sequence) => ({ ...e, sequence })) } });
  // Directly reach the resource checker: rejection must not rely only on the server checkpoint comparison.
  it('rejects a fabricated fixed-item conversion in the resource fold', () => {
    expect(() => validateB8Resources(forgedConversion())).toThrow('anger issues conversion');
  });
  it('rejects a missing ordinary conversion in the resource fold', () => {
    expect(() => validateB8Resources(missingConversion())).toThrow('missing anger issues conversion');
  });
  for (const [name, forge] of Object.entries({ changedFixed, forgedConversion, unchangedOrdinary, missingConversion })) {
    it(`rejects ${name} at all three shared restore boundaries`, () => {
      for (const input of inputs(forge())) expect(() => restoreSharedOrbSnapshot(room.state.pool, input, authority)).toThrow();
    });
  }
});
