import { describe, expect, it } from 'vitest';
import { createMatch, nextRound, rerollAugment, selectChoice, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { augmentCandidates, augmentOfferAllowed, deriveAugmentTier, externalAugmentBlocks, externallyBlockableAugments, fieldedTraitSnapshot,
  resolveAugmentTier, type AugmentOfferFilter } from '../src/simulation/augment-offers';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { AUGMENT_OFFER_RULES, AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import { previewRoundEconomy } from '../src/simulation/economy-preview';
import { accepted, emptyBoard, freeze, reachRound, resolveM5Choices } from './match-helpers';

const TEAMUPS = ['sisters', 'mentorship', 'reunion', 'geniuses', 'menaces', 'unlikely-duo'];
const filter = (node: string, fieldedTraits: string[] = [], blocked: string[] = []): AugmentOfferFilter => ({ node, fieldedTraits, blocked });
const NODES = ['2-1', '3-2', '4-2'];

/** Plays public commands to `roundId`, keeping whatever the player has on the board (unlike reachRound). */
function reachKeepingBoard(roundId: string, seed: number): MatchState {
  let state = createMatch(seed);
  while (state.roundDefinitionId !== roundId) {
    state = resolveM5Choices(state);
    if (state.phase === 'preparation') {
      state = accepted(startMatchCombat(state));
      for (let i = 0; i < 1201 && state.phase === 'combat'; i++) state = stepMatch(state).state;
    }
    state = resolveM5Choices(state);
    state = accepted(nextRound(state, state.round));
  }
  return state;
}
const tierSeed = (tiers: string) => Array.from({ length: 2000 }, (_, i) => i).find(seed => NODES.map(id => deriveAugmentTier(seed, `round:${id}:augment`)).join(',') === tiers)!;

describe('v22 content: data-driven offer rules', () => {
  it('maps every pool augment to a 14.24 apiName and every associated trait to a project trait', () => {
    expect(Object.keys(AUGMENT_POOL_API_NAMES).sort()).toEqual(Object.keys(AUGMENT_DEFINITIONS).sort());
    for (const traits of Object.values(AUGMENT_OFFER_RULES.associatedTraits)) for (const trait of traits) expect(TRAIT_DEFINITIONS, trait).toHaveProperty(trait);
    expect(AUGMENT_OFFER_RULES.associatedTraits.TFT13_TeamupAugment_Sisters).toEqual(['ambusher', 'enforcer', 'pit-fighter', 'rebel']);
    expect(AUGMENT_OFFER_RULES.associatedTraits.TFT13_Augment_CabalCrest).toEqual(['black-rose']);
    // None of the cross-player / one-per-match augments is in today's pool: those rules are inert, not missing.
    expect(externallyBlockableAugments()).toEqual([]);
  });
});

describe('v22 trait filter: 3-2 and 4-2 tailored, 2-1 not', () => {
  it('drops trait-linked augments at 3-2/4-2 without a fielded member and keeps them at 2-1', () => {
    // Geniuses is prismatic in the 14.24 tier table; the other five team-ups are gold.
    const GOLD_TEAMUPS = TEAMUPS.filter(id => AUGMENT_TIERS[id] === 'gold');
    expect(TEAMUPS.filter(id => !GOLD_TEAMUPS.includes(id))).toEqual(['geniuses']);
    expect(AUGMENT_TIERS.geniuses).toBe('prismatic');
    for (const node of ['3-2', '4-2']) {
      const none = augmentCandidates('gold', [], [], null, filter(node));
      for (const id of TEAMUPS) expect(none, `${node} ${id}`).not.toContain(id);
      expect(augmentCandidates('prismatic', [], [], null, filter(node)), `${node} geniuses`).not.toContain('geniuses');
      const enforcer = augmentCandidates('gold', [], [], null, filter(node, ['enforcer']));
      expect(TEAMUPS.filter(id => enforcer.includes(id)).sort()).toEqual(['mentorship', 'reunion', 'sisters']);
      // Untouched augments without AssociatedTraits are never filtered.
      expect(none.length).toBe(Object.keys(AUGMENT_TIERS).filter(id => AUGMENT_TIERS[id] === 'gold').length - GOLD_TEAMUPS.length - 22); // 22 new trait-linked crests
    }
    const untailored = augmentCandidates('gold', [], [], null, filter('2-1'));
    for (const id of GOLD_TEAMUPS) expect(untailored).toContain(id);
    expect(augmentCandidates('prismatic', [], [], null, filter('2-1'))).toContain('geniuses');
  });

  it('records the fielded-trait snapshot when 3-2 opens, reuses it for rerolls and restores from it', () => {
    const seed = tierSeed('silver,gold,gold');
    let state = reachKeepingBoard('3-2', seed);
    const choice = state.pendingChoice!;
    expect(choice).toMatchObject({ kind: 'augment', choiceId: 'round:3-2:augment' });
    const record = state.augmentOffers.find(r => r.choiceId === 'round:3-2:augment')!;
    expect(record.fieldedTraits).toEqual(fieldedTraitSnapshot(state));
    expect(record.fieldedTraits.length).toBeGreaterThan(0);
    expect(state.augmentOffers.find(r => r.choiceId === 'round:2-1:augment')!.fieldedTraits).toEqual([]);
    const allowed = (id: string) => augmentOfferAllowed(id, state.augments, filter('3-2', [...record.fieldedTraits]));
    expect(choice.offers.every(allowed)).toBe(true);
    // A board edited after the node opened (moves are open while choosing online) does not change the reroll pool:
    // the reroll reads the opening snapshot, not the current board.
    const emptied = freeze({ ...state, preparation: { ...state.preparation, units: state.preparation.units.filter(u => u.team !== 'player') } });
    expect(fieldedTraitSnapshot(emptied)).toEqual([]);
    const fromEmptied = rerollAugment(emptied, choice.choiceId, choice.generation, 0);
    const fromBoard = rerollAugment(freeze(state), choice.choiceId, choice.generation, 0);
    expect(fromEmptied.ok && fromBoard.ok && fromEmptied.state.pendingChoice!.offers).toEqual(fromBoard.ok && fromBoard.state.pendingChoice!.offers);
    for (const optionIndex of [0, 1, 2]) {
      const c = state.pendingChoice!;
      const result = rerollAugment(freeze(state), c.choiceId, c.generation, optionIndex);
      if (!result.ok) { expect(result.reason).toBe('augment-pool-too-small'); break; }
      state = result.state;
      expect(state.pendingChoice!.offers.every(allowed)).toBe(true);
      expect(restoreMatch(serializeMatch(state))).toEqual(state);
    }
    expect(state.augmentOffers.find(r => r.choiceId === 'round:3-2:augment')!.fieldedTraits).toEqual(record.fieldedTraits);
    const tampered = (edit: (r: Record<string, unknown>) => void) => {
      const raw = JSON.parse(serializeMatch(state));
      edit(raw.augmentOffers.find((r: { choiceId: string }) => r.choiceId === 'round:3-2:augment'));
      return () => restoreMatch(JSON.stringify(raw));
    };
    expect(tampered(r => { r.fieldedTraits = [...(r.fieldedTraits as string[])].reverse().concat('not-a-trait'); })).toThrow();
    expect(tampered(r => { r.externalBlocks = (r.externalBlocks as string[][]).map(() => ['sisters']); })).toThrow();
    expect(tampered(r => { r.externalBlocks = []; })).toThrow();
  });

  it('a 3-2 offer never contains a team-up whose traits are not fielded (empty board, many seeds)', () => {
    let checked = 0;
    for (let seed = 1; checked < 4 && seed < 400; seed++) {
      if (deriveAugmentTier(seed, 'round:3-2:augment') !== 'gold') continue;
      const state = reachRound('3-2', false, seed);
      if (resolveAugmentTier(state, 'round:3-2:augment') !== 'gold') continue;
      checked++;
      const record = state.augmentOffers.find(r => r.choiceId === 'round:3-2:augment')!;
      expect(record.fieldedTraits).toEqual([]);
      expect(state.pendingChoice!.offers.some(id => TEAMUPS.includes(id))).toBe(false);
    }
    expect(checked).toBe(4);
  });
});

describe('v22 own mutual exclusion (MutuallyExclusiveItems, triggered by ownership)', () => {
  it('excludes the configured partners of an owned augment in either direction', () => {
    const own = (definitionId: string) => [{ definitionId, choiceId: 'round:2-1:augment', acquiredRound: 5 }];
    expect(augmentCandidates('silver', [])).toContain('placebo-plus');
    expect(augmentCandidates('silver', own('placebo'))).not.toContain('placebo-plus');
    expect(augmentCandidates('gold', own('built-different'))).not.toContain('climb-the-ladder-ii');
    expect(augmentCandidates('gold', own('climb-the-ladder-i'))).not.toContain('built-different');
    expect(augmentCandidates('gold', own('pair-of-fours'))).not.toContain('all-for-one-ii');
    expect(augmentCandidates('gold', own('placebo'))).toEqual(augmentCandidates('gold', []));
  });
});

describe('v22 seen once, never offered again', () => {
  it('every shown card (initial three and reroll results) joins removedAugmentIds; chosen or not, it never returns', () => {
    const seed = tierSeed('silver,silver,gold');
    let state = reachRound('2-1', false, seed);
    const first = [...state.pendingChoice!.offers];
    expect(state.removedAugmentIds).toEqual(first);
    const c = state.pendingChoice!;
    state = accepted(rerollAugment(state, c.choiceId, c.generation, 1));
    const rerolled = state.pendingChoice!.offers[1];
    expect(state.removedAugmentIds).toEqual([...first, rerolled]);
    const shown = [...first, rerolled];
    const picked = state.pendingChoice!.offers[0];
    state = accepted(selectChoice(state, c.choiceId, state.pendingChoice!.generation, picked));
    const unpicked = shown.filter(id => id !== picked);
    // The old rule excluded only the rerolled-away card; the two shown-but-not-chosen cards would still be eligible.
    expect(augmentCandidates('silver', state.augments, [first[1]])).toEqual(expect.arrayContaining(unpicked.filter(id => id !== first[1])));
    expect(augmentCandidates('silver', state.augments, state.removedAugmentIds).some(id => shown.includes(id))).toBe(false);
    while (state.roundDefinitionId !== '3-2') {
      state = resolveM5Choices(state);
      if (state.phase === 'preparation') state = accepted(startMatchCombat(emptyBoard(state)));
      state = resolveM5Choices(state);
      state = accepted(nextRound(state, state.round));
    }
    expect(state.pendingChoice!.augmentTier).toBe('silver');
    expect(state.pendingChoice!.offers.some(id => shown.includes(id))).toBe(false);
    expect(state.removedAugmentIds.slice(0, shown.length)).toEqual(shown);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  });
});

describe('v22 augment choice inside preparation (rules side)', () => {
  it('keeps the private choice view and the economy preview while the augment choice is open (board moves: see the room test)', () => {
    const state = reachRound('2-1', false);
    expect(state.phase).toBe('choice');
    expect(state.pendingChoice).toMatchObject({ kind: 'augment', returnPhase: 'preparation' });
    expect(toPrivateSeatView(state).pendingChoice).toMatchObject({ choiceId: 'round:2-1:augment' });
    expect(previewRoundEconomy(state)).not.toBeNull();
  });

  it('cross-player blocks are empty for the current pool, whatever the other seats hold', () => {
    const a = reachRound('2-1', false, 7), b = reachRound('2-1', false, 9);
    const seat = (s: MatchState, seatId: string) => ({ ...s, multiplayer: { version: 1, seatId, status: 'active', receipts: [], forfeitedChoices: [] } }) as unknown as MatchState;
    expect(externalAugmentBlocks('A', [seat(a, 'A'), seat(b, 'B')])).toEqual([]);
  });
});
