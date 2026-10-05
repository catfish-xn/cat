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
  it('starts with public resources and ordered two-component/augment choices, restores every choice', () => {
    let state = createMatch(42);
    expect(state.preparation.benchSize).toBe(9);
    expect(state.preparation.units.filter(u => u.team === 'player').map(u=>u.definitionId)).toEqual(['irelia','maddie','lux']);
    expect(state.pendingChoice?.kind).toBe('component');
    for (let i=0;i<3;i++) {
      expect(restoreMatch(serializeMatch(state))).toEqual(state);
      const c=state.pendingChoice!, selected=selectChoice(state,c.choiceId,c.generation,c.offers[0]);
      expect(selected.ok).toBe(true); if(!selected.ok) throw new Error(selected.reason);
      const stale=selectChoice(selected.state,c.choiceId,c.generation,c.offers[0]);
      expect(stale.ok).toBe(false); expect(stale.state).toBe(selected.state); state=selected.state;
    }
    expect(state.phase).toBe('preparation'); expect(state.items).toHaveLength(2); expect(state.augments).toHaveLength(1);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  });
  it('locks natural refresh while allowing paid D and immediate F, rejected commands retain identity', () => {
    let state=choices(createMatch(42));
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
  it('restores each real tick, then supply without creating combat or consuming battle RNG', () => {
    let state=choices(createMatch(42));
    for(let round=1;round<=3;round++) {
      const started=startMatchCombat(state); if(!started.ok) throw new Error(started.reason);state=started.state;
      while(state.phase==='combat') {
        const restored=restoreMatch(serializeMatch(state));
        expect(stepMatch(restored)).toEqual(stepMatch(state));state=stepMatch(state).state;
      }
      state=choices(state);expect(state.roundResults).toHaveLength(round);
      expect(restoreMatch(serializeMatch(state))).toEqual(state);
      const next=nextRound(state,round);if(!next.ok)throw new Error(next.reason);state=next.state;
    }
    expect(state.roundDefinitionId).toBe('2-4');expect(state.pendingChoice?.kind).toBe('component');
    const battleSeed=state.battleSeedRngState, gold=state.gold, c=state.pendingChoice!;
    const selected=selectChoice(state,c.choiceId,c.generation,c.offers[0]);if(!selected.ok)throw new Error(selected.reason);state=selected.state;
    expect(state.phase).toBe('settlement');expect(state.combat).toBe(null);expect(state.battleSeedRngState).toBe(battleSeed);
    expect(state.roundResults.at(-1)?.result).toBe('supply');expect(state.gold).toBeGreaterThan(gold);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  }, 30000);
});
