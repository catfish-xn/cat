/**
 * Work order C9: the online settlement panel reads the server's revealed-loot summary (contract §14.1 SR-C7-02)
 * off the display MatchState, exactly as the private view sent it; nothing is diffed from snapshots any more.
 */
import { describe, expect, it } from 'vitest';
import { createMatch, toPrivateSeatView } from '../../src/server-entry';
import { ROUND_CATALOG } from '../../src/simulation/content/round-catalog';
import { readRevealedLoot, toDisplayMatch } from '../../src/rendering/online/seat-view-adapter';
import { catalogPreparation } from '../t5r-helpers';
import { freeze } from '../combat-helpers';

describe('C9 revealed loot on the display state', () => {
  it('carries the private view summary through toDisplayMatch, by value', () => {
    const state = catalogPreparation('1-2');
    const view = toPrivateSeatView(freeze(state));
    // T13-B (§18.4): the summary also carries the round's revealed orbs; none before the battle.
    expect(view.revealedLoot).toEqual({ roundId: '1-2', revealedDrops: [], revealedOrbs: [] });
    const display = toDisplayMatch(view);
    expect(readRevealedLoot(display)).toEqual(view.revealedLoot);
    expect(readRevealedLoot(display)).toBe(view.revealedLoot);
    // Round-tripped over the wire it is still the same summary.
    expect(readRevealedLoot(toDisplayMatch(JSON.parse(JSON.stringify(view))))).toEqual(view.revealedLoot);
  });
  it.each(ROUND_CATALOG.filter(round => round.kind !== 'pve').slice(0, 3).map(round => round.roundId))('is null for %s, which the view omits', roundId => {
    const view = toPrivateSeatView(freeze(catalogPreparation(roundId)));
    expect(view).not.toHaveProperty('revealedLoot');
    const display = toDisplayMatch(view);
    expect(display).not.toHaveProperty('revealedLoot');
    expect(readRevealedLoot(display)).toBeNull();
  });
  it('is null on an offline authoritative state and ignores malformed fields', () => {
    expect(readRevealedLoot(createMatch(42))).toBeNull();
    expect(readRevealedLoot({ ...createMatch(42), revealedLoot: { roundId: '1-2' } } as never)).toBeNull();
    expect(readRevealedLoot({ ...createMatch(42), revealedLoot: null } as never)).toBeNull();
  });
});
