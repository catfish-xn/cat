import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import { freezeContent } from '../src/simulation/content/freeze';
import { reachRound } from './match-helpers';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { describe, expect, it } from 'vitest';
import { createMatch, selectChoice, setShopLock, rerollShop, buyXp, startMatchCombat, stepMatch, nextRound } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import type { MatchState } from '../src/simulation/match-types';
function choices(state: MatchState): MatchState {
  while (state.phase === 'choice') {
    const choice = state.pendingChoice!;
    if (choice.step !== 'offer') throw new Error('Unexpected anomaly target');
    const result = selectChoice(state, choice.choiceId, choice.generation, choice.offers[0]);
    if (!result.ok) throw new Error(result.reason); state = result.state;
  }
  return state;
}
function fight(state: MatchState) {
  const start = startMatchCombat(state); if (!start.ok) throw new Error(start.reason);
  state = start.state;
  while (state.phase === 'combat') state = stepMatch(state).state;
  return choices(state);
}
describe('M5 Match atomic integration', () => {
  it('starts with the approved single hero, then restores the first real augment without an old component package', () => {
    const initial=createMatch(42);
    expect(initial.preparation.benchSize).toBe(9);
    expect(initial.preparation.units.filter(u=>u.team==='player').map(u=>u.definitionId)).toEqual(['irelia']);
    expect(initial.pendingChoice).toBeNull();expect(initial.items).toHaveLength(0);expect(initial.augments).toHaveLength(0);
    expect(restoreMatch(serializeMatch(initial))).toEqual(initial);
    const before=reachRound('2-1',false),c=before.pendingChoice!;
    expect(c.kind).toBe('augment');expect(restoreMatch(serializeMatch(before))).toEqual(before);
    // Built Different is actually offered and grants no items; keep the item-free acquisition invariant.
    const pick='built-different';expect(c.offers).toContain(pick);
    const selected=selectChoice(before,c.choiceId,c.generation,pick);
    expect(selected.ok).toBe(true);if(!selected.ok)throw new Error(selected.reason);
    const stale=selectChoice(selected.state,c.choiceId,c.generation,pick);
    expect(stale.ok).toBe(false);expect(stale.state).toBe(selected.state);
    expect(selected.state.phase).toBe('preparation');expect(selected.state.items).toHaveLength(0);expect(selected.state.augments).toHaveLength(1);
    expect(restoreMatch(serializeMatch(selected.state))).toEqual(selected.state);
  });
  it('locks natural refresh while allowing paid D and immediate F, rejected commands retain identity', () => {
    let state=reachRound('2-1');
    const lock=setShopLock(state,true,state.shop.generation); expect(lock.ok).toBe(true);state=lock.state;
    expect(setShopLock(state,true,state.shop.generation).state).toBe(state);
    const failed=setShopLock(state,false,state.shop.generation-1); expect(failed.ok).toBe(false); expect(failed.state).toBe(state);
    const d=rerollShop(state);expect(d.ok).toBe(true);expect(d.state.shop.locked).toBe(true);
    const f=buyXp(d.state);expect(f.ok).toBe(true);expect(f.state.shop).toBe(d.state.shop);
    state=fight(f.state);
    if(state.phase!=='settlement') throw new Error('Expected live settlement');
    const before=state, next=nextRound(state,state.round);expect(next.ok).toBe(true);
    expect(next.state.shop).toBe(before.shop);expect(next.state.rngState).toBe(before.rngState);
    expect(nextRound(next.state,before.round).state).toBe(next.state);
  });
  // Cache the live cursor only. Every restored tick and settlement assertion
  // still executes, with one live step reused instead of calculating it twice.
  let restoreCursor: MatchState | undefined;
  function restoreThrough(round: number, untilTick: number): MatchState {
    let state = restoreCursor ?? choices(createMatch(42));
    while (state.round <= round) {
      if (state.phase === 'preparation') {
        const started = startMatchCombat(state); if (!started.ok) throw new Error(started.reason);
        state = started.state;
      }
      while (state.phase === 'combat') {
        if (state.round === round && state.combat!.tick >= untilTick) {
          restoreCursor = freezeContent(state); return restoreCursor;
        }
        const restored = restoreMatch(serializeMatch(state)), live = stepMatch(state);
        expect(stepMatch(restored)).toEqual(live); state = live.state;
      }
      state = choices(state); expect(state.roundResults).toHaveLength(state.round);
      expect(restoreMatch(serializeMatch(state))).toEqual(state);
      const next = nextRound(state, state.round); if (!next.ok) throw new Error(next.reason);
      state = next.state;
      if (state.pendingChoice?.kind === 'augment') state = choices(state);
    }
    restoreCursor = freezeContent(state); return restoreCursor;
  }
  for (const round of ROUND_CATALOG.filter(r => r.ordinal < getCatalogRoundById('2-4').ordinal))
    for (const tick of [150, 300, 450, 600, 750, 900, 1050, 1201])
      it(`restores each real tick in ${round.roundId} through ${tick}`, () => { restoreThrough(round.ordinal, tick); });
  it('restores each real tick, then supply without creating combat or consuming battle RNG', () => {
    let state = restoreThrough(getCatalogRoundById('2-4').ordinal - 1, 1201);
    expect(state.roundDefinitionId).toBe('2-4');expect(state.pendingChoice?.kind).toBe('component');
    const battleSeed=state.battleSeedRngState, gold=state.gold, c=state.pendingChoice!;
    const selected=selectChoice(state,c.choiceId,c.generation,c.offers[0]);if(!selected.ok)throw new Error(selected.reason);state=selected.state;
    expect(state.phase).toBe('settlement');expect(state.combat).toBe(null);expect(state.battleSeedRngState).toBe(battleSeed);
    expect(state.roundResults.at(-1)?.result).toBe('supply');expect(state.gold).toBe(gold);
    const paid=nextRound(state,state.round);expect(paid.ok).toBe(true);
    expect(paid.state.gold).toBe(state.roundResults.at(-1)!.goldAfter);expect(paid.state.gold).toBeGreaterThan(gold);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  });
});
