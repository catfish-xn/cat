import { describe, expect, it } from 'vitest';
import { assertSharedPoolConservation, generateSharedShop, runSharedMatchCommand } from '../src/simulation/shared-pool';
import {readLootView} from '../src/simulation/loot-view';
import { freezeContent } from '../src/simulation/content/freeze';
import { accept, room } from './tp-helpers';

describe('shared loot validation cache boundaries', () => {
  it('matches uncached JSON transactions through a real PvE reward and preserves all events', () => {
    const initial = room(undefined, 1);
    let live = accept(generateSharedShop(initial.pool, initial.states[0], 0));
    let restored = structuredClone(live);
    const commands = [{ type: 'startCombat' as const }, ...Array.from({ length: 240 }, () => ({ type: 'step' as const }))];
    let awarded = false;
    for (const command of commands) {
      live = accept(runSharedMatchCommand(live.pool, live.state, command));
      const cold = JSON.parse(JSON.stringify(restored));
      restored = accept(runSharedMatchCommand(cold.pool, cold.state, command));
      expect(restored).toEqual(live);
      awarded ||= live.poolEvents.some(event => event.type === 'sharedRewardResolved');
      if (live.state.phase === 'settlement') break;
    }
    expect(live.state.phase).toBe('settlement');
    expect(awarded).toBe(false);
    for(const orb of readLootView(live.state).unclaimedOrbs!) {
      const command={type:'claimOrb' as const,round:live.state.round,orbId:orb.orbId};
      live=accept(runSharedMatchCommand(live.pool,live.state,command));
      const cold=JSON.parse(JSON.stringify(restored));restored=accept(runSharedMatchCommand(cold.pool,cold.state,command));
      expect(restored).toEqual(live);awarded ||=live.poolEvents.some(e=>e.type==='sharedRewardResolved');
    }
    expect(awarded).toBe(true);
  });

  it('does not trust mutable or shallow-frozen identical shop references after warming', () => {
    const source = room(undefined, 1);
    const live = accept(generateSharedShop(source.pool, source.states[0], 0));
    assertSharedPoolConservation(live.pool, [live.state]);
    for (const freeze of [(value: object) => value, Object.freeze]) {
      const cold = structuredClone(live) as any;
      cold.state.shop.untrusted = NaN;
      cold.pool.seats[0].shop = freeze(cold.state.shop);
      const result = runSharedMatchCommand(cold.pool, cold.state, { type: 'startCombat' });
      expect(result).toEqual({ ok: false, pool: cold.pool, state: cold.state, reason: 'invalid-pool' });
      expect(result.pool).toBe(cold.pool); expect(result.state).toBe(cold.state);
      expect(Number.isNaN(cold.state.shop.untrusted)).toBe(true);
    }
  });

  it('rejects replaced, shallow-frozen and deep-frozen forged ledgers after warming the cache', () => {
    const { pool, states: [state] } = room(undefined, 1);
    assertSharedPoolConservation(pool, [state]);
    for (const freeze of [(v: any) => v, Object.freeze, freezeContent]) {
      const ledger = JSON.parse(JSON.stringify(state.m8.loot.frozen));
      ledger.rounds[0].encounterPlan.drops[0].payload = { kind: 'gold', quantity: 999 };
      const forged = { ...state, m8: { ...state.m8, loot: { ...state.m8.loot, frozen: freeze(ledger) } } };
      const before = JSON.stringify({ pool, forged });
      expect(() => assertSharedPoolConservation(pool, [forged])).toThrow('invalid-seat-state');
      expect(generateSharedShop(pool, forged, 0)).toEqual({ ok: false, pool, state: forged, reason: 'invalid-seat-state' });
      expect(JSON.stringify({ pool, forged })).toBe(before);
    }
  });

  it('does not trust a mutable ledger/layout after an earlier successful check', () => {
    const source = room(undefined, 1);
    const { pool, states: [state] } = JSON.parse(JSON.stringify(source));
    assertSharedPoolConservation(pool, [state]);
    state.m8.loot.frozen.rng.draws++;
    expect(() => assertSharedPoolConservation(pool, [state])).toThrow('invalid-seat-state');
    const copy = JSON.parse(JSON.stringify(source));
    assertSharedPoolConservation(copy.pool, copy.states);
    copy.pool.orbLayout.rng.draws++;
    expect(() => assertSharedPoolConservation(copy.pool, copy.states)).toThrow();
    const changedSeed = { ...source.states[0], seed: source.states[0].seed + 1 };
    expect(() => assertSharedPoolConservation(source.pool, [changedSeed])).toThrow('invalid-seat-state');
  });
});
