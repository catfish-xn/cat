/**
 * v22 rules whose augments are not in today's pool (Black Rose emblem, Welcome to the Playground / Gloves Off,
 * War for the Undercity): pool ids are re-mapped to those apiNames here so the real rule paths, the room's per-seat
 * blocks and restore are exercised. `oneOfAll` additionally marks every gold pool augment one-per-match for the room test.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
const remap = vi.hoisted(() => ({ oneOfAll: [] as string[] }));
vi.mock('../src/simulation/content/augment-offer-rules', async importOriginal => {
  const real = await importOriginal<typeof import('../src/simulation/content/augment-offer-rules')>();
  const api = { ...real.AUGMENT_POOL_API_NAMES, sisters: 'TFT13_Augment_CabalCrest', reunion: 'TFT13_Augment_Family',
    geniuses: 'TFT13_Augment_PrimeCarry', menaces: 'TFT13_Augment_Chembaron' };
  const rules = real.AUGMENT_OFFER_RULES;
  return { ...real, AUGMENT_POOL_API_NAMES: api,
    AUGMENT_OFFER_RULES: { ...rules, get onePerMatch() { return [...rules.onePerMatch, ...remap.oneOfAll]; } } };
});
import { augmentCandidates, augmentApiName, resolveAugmentTier, externalAugmentBlocks, externallyBlockableAugments, type AugmentOfferFilter } from '../src/simulation/augment-offers';
import { rerollAugment, type MatchState } from '../src/simulation/match';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted, reachRound } from './match-helpers';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { makeRoom, runUntilClaiming } from './server/helpers';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import type { Room } from '../src/server/room/room';

const filter = (node: string, fieldedTraits: string[] = [], blocked: string[] = []): AugmentOfferFilter => ({ node, fieldedTraits, blocked });
const seat = (state: MatchState, seatId: string, patch: Partial<MatchState> = {}, status = 'active') =>
  ({ ...state, ...patch, multiplayer: { version: 1, seatId, status, receipts: [], forfeitedChoices: [] } }) as unknown as MatchState;
const own = (definitionId: string) => [{ definitionId, choiceId: 'round:2-1:augment', acquiredRound: 5 }];

describe('v22 node bans and external rules (re-mapped pool)', () => {
  it('Black Rose emblem is never offered at 2-1; at 3-2/4-2 only with a fielded Black Rose unit', () => {
    expect(augmentApiName('sisters')).toBe('TFT13_Augment_CabalCrest');
    expect(augmentCandidates('gold', [], [], null, filter('2-1'))).not.toContain('sisters');
    expect(augmentCandidates('gold', [], [], null, filter('2-1', ['black-rose']))).not.toContain('sisters');
    for (const node of ['3-2', '4-2']) {
      expect(augmentCandidates('gold', [], [], null, filter(node))).not.toContain('sisters');
      expect(augmentCandidates('gold', [], [], null, filter(node, ['black-rose']))).toContain('sisters');
    }
  });

  it('Welcome to the Playground / Gloves Off: another live player owning one blocks the other, not itself', () => {
    const base = reachRound('2-1', false);
    const a = seat(base, 'A', { augments: own('reunion') }), b = seat(base, 'B');
    expect(externalAugmentBlocks('B', [a, b])).toEqual(['geniuses']);
    expect(externalAugmentBlocks('A', [a, b])).toEqual([]);
    expect(externalAugmentBlocks('B', [seat(base, 'A', { augments: own('reunion') }, 'eliminated'), b])).toEqual([]);
    expect(augmentCandidates('gold', [], [], null, filter('2-1', [], ['geniuses']))).not.toContain('geniuses');
    expect(augmentCandidates('gold', [], [], null, filter('2-1', [], ['geniuses']))).toContain('reunion');
  });

  it('War for the Undercity: shown once to any other live player (offer, seen, owned) blocks it for everyone else', () => {
    const base = reachRound('2-1', false), b = seat(base, 'B');
    expect(externalAugmentBlocks('B', [seat(base, 'A', { removedAugmentIds: ['menaces'] }), b])).toEqual(['crimson-pact','menaces']);
    expect(externalAugmentBlocks('B', [seat(base, 'A', { augments: own('menaces') }), b])).toEqual(['crimson-pact','menaces']);
    const offered = seat(base, 'A', { pendingChoice: { ...base.pendingChoice!, offers: ['menaces', 'x', 'y'] }, removedAugmentIds: [] });
    expect(externalAugmentBlocks('B', [offered, b])).toEqual(['crimson-pact','menaces']);
    expect(externalAugmentBlocks('B', [seat(base, 'A', { removedAugmentIds: ['menaces'] }, 'eliminated'), b])).toEqual([]);
  });

  it('a reroll records its external blocks; restore replays them and rejects blocks no rule can produce', () => {
    expect(externallyBlockableAugments()).toEqual(['crimson-pact','geniuses','menaces','reunion','welcome-to-the-playground']);
    let state: MatchState | null = null;
    for (let seed = 1; seed < 300 && !state; seed++) {
      const s = reachRound('2-1', false, seed);
      if (s.pendingChoice!.augmentTier === 'gold') state = s;
    }
    const c = state!.pendingChoice!;
    const next = accepted(rerollAugment(state!, c.choiceId, c.generation, 0, ['menaces', 'geniuses']));
    expect(next.augmentOffers.at(-1)!.externalBlocks).toEqual([[], ['geniuses', 'menaces']]);
    expect(['menaces', 'geniuses']).not.toContain(next.pendingChoice!.offers[0]);
    expect(restoreMatch(serializeMatch(next))).toEqual(next);
    const raw = JSON.parse(serializeMatch(next));
    raw.augmentOffers.at(-1).externalBlocks = [[], ['sisters']];
    expect(() => restoreMatch(JSON.stringify(raw))).toThrow();
  });
});

describe('v22 one-per-match in the shared round advance and the room', () => {
  const rooms: Room[] = [];
  afterEach(() => { remap.oneOfAll = []; for (const room of rooms.splice(0)) room.dispose(); });
  it('seats open 2-1 in batch order and never see a one-per-match card shown to another seat; rerolls get the room\'s blocks', { timeout: 300_000 }, () => {
    remap.oneOfAll = Object.keys(AUGMENT_TIERS).filter(id => AUGMENT_TIERS[id] === 'gold').map(augmentApiName);
    // A room whose shared 2-1 tier is gold (34 eligible gold cards ≥ 8 seats × 3).
    let picked: ReturnType<typeof makeRoom> | null = null;
    for (let seed = 1; seed < 200 && !picked; seed++) {
      const candidate = makeRoom(new TwoSidedBattleResolver(), { seed });
      candidate.room.start();
      if (resolveAugmentTier(candidate.room.state.seats[0].match, 'round:2-1:augment') === 'gold') picked = candidate;
      else candidate.room.dispose();
    }
    const { room, clock } = picked!;
    rooms.push(room);
    runUntilClaiming(room, clock, state => state.roundId === '2-1' && state.phase === 'preparation');
    const seats = room.state.seats.filter(s => s.alive);
    const tier = seats[0].match.pendingChoice!.augmentTier;
    expect(tier).toBe('gold');
    const offers = seats.flatMap(s => s.match.pendingChoice!.offers);
    expect(new Set(offers).size).toBe(offers.length);
    // The mock now aliases enabled batch-2 cards; onePerMatch is keyed by apiName.
    // Independently close each known alias group when any internal ID was shown.
    const blockedAliases=(ids:string[])=>[...new Set([...ids,...[
      ['menaces','crimson-pact'],['reunion','welcome-to-the-playground'],['sisters','black-rose-crest'],
    ].flatMap(group=>group.some(id=>ids.includes(id))?group:[])])].sort();
    const shownBefore: string[] = [];
    for (const s of seats) {
      const record = s.match.augmentOffers.at(-1)!;
      expect(record.externalBlocks[0]).toEqual(blockedAliases(shownBefore));
      shownBefore.push(...s.match.pendingChoice!.offers);
      expect(restoreSharedOrbSnapshot(room.state.pool, JSON.stringify(s.match))).toEqual(s.match);
    }
    // Restore replays the recorded blocks: dropping the last seat's blocks re-draws different offers and is refused.
    const forged = JSON.parse(JSON.stringify(seats.at(-1)!.match));
    forged.augmentOffers.at(-1).externalBlocks = [[]];
    expect(() => restoreSharedOrbSnapshot(room.state.pool, forged)).toThrow();
    const c = seats[0].match.pendingChoice!;
    expect(room.handle('s0', { type: 'rerollAugment', choiceId: c.choiceId, generation: c.generation, optionIndex: 1 })).toMatchObject({ ok: true });
    const after = room.state.seats.find(s => s.seatId === 's0')!.match;
    const others = seats.slice(1).flatMap(s => s.match.pendingChoice!.offers);
    expect(after.augmentOffers.at(-1)!.externalBlocks[1]).toEqual(blockedAliases(others));
    expect(others).not.toContain(after.pendingChoice!.offers[1]);
  });
});
