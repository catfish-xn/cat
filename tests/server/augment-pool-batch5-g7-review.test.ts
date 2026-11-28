import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { canonicalContent } from '../../src/simulation/content';
import { requireAugmentFacts } from '../../src/simulation/augment-history';
import { drainLootExplosionRewards } from '../../src/simulation/augment-pool-batch5-g7';
import { validateLootExplosionRewards } from '../../src/simulation/restore-checks/loot-explosion-check';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { installB1Offers } from '../fixtures/b1-scripted-offers';
import type { MatchState } from '../../src/simulation/match-types';
import { answerOpenChoices, claimAllOrbs, makeRoom, runUntil, runUntilClaiming } from './helpers';

const ID = 'loot-explosion', SOURCE = 'augment-pool-batch5-g7';
const forms = ['object', 'json', 'serialized'] as const;
const encode = (state: MatchState, form: typeof forms[number]) => form === 'object' ? state : form === 'json' ? JSON.stringify(state) : canonicalContent(state);
function disguise(state: MatchState): MatchState {
  const { augmentHistory: _history, ...rest } = structuredClone(state);
  return { ...rest, gold: rest.gold + 123, augments: rest.augments.map(a => a.definitionId === ID ? { ...a, definitionId: 'crownguard-spirit' } : a) };
}

for (const streaming of [false, true]) for (const army of ['empty', 'wiped'] as const) describe(`B5-69 review: ${streaming ? 'stream' : 'ordinary'} PvE, ${army} army`, () => {
  // Seed 13, seat s3, retains Crownguard Spirit; script only Loot Explosion's draw, keeping candidate eligibility and RNG advancement.
  // v26 D5 (7953c99a) drifted the old seed-65 s3 draw (Crownguard Spirit moved to its second reroll); old value seed 65.
  // Keep the same scope during restore, whose offer-history validator replays the draw.
  let restoreOffers: () => void;
  beforeEach(() => { restoreOffers = installB1Offers([ID]); });
  afterEach(() => restoreOffers());
  const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 13, combatStreaming: streaming });
  const own = () => room.state.seats.find(s => s.seatId === 's3')!.match;
  afterAll(() => room.dispose());

  it('starts the seed-13 room with a scripted Loot Explosion draw', () => { room.start(); });
  for (const roundId of ['1-3', '1-4', '2-1']) it(`reaches ${roundId}`, () => {
    runUntilClaiming(room, clock, s => s.roundId === roundId && (roundId === '2-4' || s.phase === 'preparation'));
  });
  it('selects the scripted Loot Explosion offer with Crownguard Spirit in the same generation', () => {
    const choice = own().pendingChoice!;
    // Fixture self-check under installB1Offers, not evidence of a real-RNG Loot Explosion draw.
    expect(choice.offers).toContain(ID);
    expect(choice.offers).toContain('crownguard-spirit');
    expect(room.handle('s3', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: ID })).toMatchObject({ ok: true });
    expect(own().seatMechanics!.receipts.filter(r => r.source === SOURCE)).toHaveLength(0);
  });

  if (!streaming && army === 'empty') it.each(forms)('rejects orphan initial gift namespaces before claiming, via %s', form => {
    const original = own(), pool = room.state.pool;
    // Fail explicitly if setup ever drifts again: the forgery must retain real initial gift claims.
    expect(original.seatMechanics!.receipts.filter(r => r.receiptId.includes(ID))).toMatchObject([
      { source: 'augment-pool-batch1', kind: 'unit', definitionId: 'camille', resolution: 'orb' },
      { source: 'augment-pool-batch1', kind: 'unit', definitionId: 'powder', resolution: 'orb' },
    ]);
    expect(restoreSharedOrbSnapshot(pool, encode(original, form), room.augmentHistoryAuthority('s3'))).toEqual(original);
    // No combat reward exists yet; both original gift receipts use the shared batch1 namespace.
    for (const rewriteSource of [false, true]) {
      const disguised = disguise(original);
      const bad = rewriteSource ? { ...disguised, seatMechanics: { ...disguised.seatMechanics!, receipts: disguised.seatMechanics!.receipts.map(r => r.receiptId.includes(ID) ? { ...r, source: 'academy' } : r) } } : disguised;
      expect(() => restoreSharedOrbSnapshot(pool, encode(bad, form))).toThrow(/Invalid augment batch1 gift authority/);
    }
    expect(own()).toBe(original);
    expect(room.state.pool).toBe(pool);
  });

  it('claims both original champions through public room commands', () => {
    claimAllOrbs(room, ['s3']);
    expect(own().preparation.units.some(u => u.definitionId === 'camille')).toBe(true);
    expect(own().preparation.units.some(u => u.definitionId === 'powder')).toBe(true);
    answerOpenChoices(room);
  });

  if (!streaming && army === 'empty') it.each(forms)('requires authority from trusted pool gift evidence after claiming, via %s', form => {
    const original = own(), pool = room.state.pool, authority = room.augmentHistoryAuthority('s3');
    expect(pool.rewards.filter(r => r.seatId === 's3' && r.dropId.includes(ID))).toHaveLength(2);
    expect(restoreSharedOrbSnapshot(pool, encode(original, form), authority)).toEqual(original);
    for (const eraseReceipts of [false, true]) {
      const disguised = disguise(original);
      const bad = eraseReceipts ? { ...disguised, seatMechanics: { ...disguised.seatMechanics!, receipts: disguised.seatMechanics!.receipts.filter(r => !r.receiptId.includes(ID)) } } : disguised;
      expect(() => restoreSharedOrbSnapshot(pool, encode(bad, form))).toThrow(/missing independent server authority/);
      expect(() => restoreSharedOrbSnapshot(pool, encode(bad, form), authority)).toThrow(/server facts\/state mismatch/);
    }
    expect(own()).toBe(original);
    expect(room.state.pool).toBe(pool);
  });

  for (const roundId of ['2-2', '2-3', '2-4', '2-5', '2-6', '2-7']) it(`continues to ${roundId}`, () => {
    runUntilClaiming(room, clock, s => s.roundId === roundId && (roundId === '2-4' || s.phase === 'preparation'));
  });
  it(`sells ${army === 'empty' ? 'the entire army' : 'every champion except one unequipped Powder'} before 2-7`, () => {
    const keep = army === 'wiped' ? own().preparation.units.find(u => u.team === 'player' && u.definitionId === 'powder')!.id : null;
    for (const unit of own().preparation.units.filter(u => u.team === 'player' && u.id !== keep))
      expect(room.handle('s3', { type: 'sell', unitId: unit.id })).toMatchObject({ ok: true });
    if (keep) expect(room.handle('s3', { type: 'deploy', unitId: keep, target: { kind: 'board', cell: { col: 0, row: 4 } } })).toMatchObject({ ok: true });
    expect(own().preparation.units.filter(u => u.team === 'player')).toHaveLength(keep ? 1 : 0);
  });
  if (!streaming && army === 'empty') it.each(forms)('retains trusted gift evidence after selling both heroes, via %s', form => {
    const original = own(), pool = room.state.pool, authority = room.augmentHistoryAuthority('s3');
    expect(pool.rewards.filter(r => r.seatId === 's3' && r.dropId.includes(ID))).toHaveLength(2);
    expect(restoreSharedOrbSnapshot(pool, encode(original, form), authority)).toEqual(original);
    const bad = disguise(original);
    expect(() => restoreSharedOrbSnapshot(pool, encode(bad, form))).toThrow(/missing independent server authority/);
    expect(() => restoreSharedOrbSnapshot(pool, encode(bad, form), authority)).toThrow(/server facts\/state mismatch/);
  });
  it('settles the actual PvE with a complete death boundary and no resolver fault', () => {
    runUntil(room, clock, s => s.roundId === '2-7' && s.phase === 'settlement');
    expect(room.state.fault).toBeNull();
    const state = own(), result = state.roundResults.at(-1)!, rows = requireAugmentFacts(state, 'deaths', 10);
    expect(result).toMatchObject({ round: 10, roundKind: 'pve', result: 'enemyWin' });
    expect(rows.at(-1)!.completeThroughTick).toBe(result.combatTicks);
    const deaths = rows.flatMap(f => f.deaths);
    if (army === 'empty') {
      expect(result.combatTicks).toBe(0);
      expect(deaths).toEqual([]);
      expect(rows.some(f => f.completeThroughTick === 0 && f.deaths.length === 0)).toBe(true);
    } else {
      expect(result.combatTicks).toBeGreaterThan(0);
      expect(deaths.filter(d => d.team === 'player')).toMatchObject([{ definitionId: 'powder', ownerSeatId: 's3' }]);
      expect(new Set(deaths.map(d => d.eventSeq)).size).toBe(deaths.length);
    }
    expect(state.seatMechanics!.receipts.filter(r => r.source === SOURCE && r.round === 10)).toHaveLength(0);
    expect(() => validateLootExplosionRewards(state)).not.toThrow();
    expect(drainLootExplosionRewards(state)).toBe(state);
    for (const form of forms) expect(restoreSharedOrbSnapshot(room.state.pool, encode(state, form), room.augmentHistoryAuthority('s3'))).toEqual(state);
  });
  it('continues into 3-1 without issuing any old reward again', () => {
    const receipts = own().seatMechanics!.receipts.filter(r => r.source === SOURCE);
    runUntilClaiming(room, clock, s => s.roundId === '3-1' && s.phase === 'preparation');
    expect(room.state.fault).toBeNull();
    expect(own().seatMechanics!.receipts.filter(r => r.source === SOURCE)).toEqual(receipts);
  });
});
