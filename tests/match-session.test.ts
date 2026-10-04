import { describe, expect, it } from 'vitest';
import { MatchSession } from '../src/rendering/match-session';
import { type CombatEvent } from '../src/simulation/combat';
import { createMatch, deployMatchUnit, type MatchState } from '../src/simulation/match';

function preparation(): MatchState {
  return deployMatchUnit(createMatch(), 'unit-1', { kind: 'board', cell: { col: 2, row: 7 } }).state;
}

describe('match session commands and fixed clock (migrated M1 lifecycle guarantees)', () => {
  it('locks deployment and economy and rejects repeated Start throughout combat and settlement', () => {
    const session = new MatchSession(preparation());
    expect(session.start().ok).toBe(true);
    for (const phase of ['combat', 'settlement']) {
      expect(session.phase).toBe(phase);
      const before = session.state;
      for (const rejected of [session.start(), session.deploy('unit-1', { kind: 'bench', slot: 0 }),
        session.buy(0, before.shop.generation), session.sell('unit-1'), session.reroll()]) {
        expect(rejected).toEqual({ ok: false, state: before, reason: 'wrong-phase' });
        expect(rejected.state).toBe(before);
      }
      session.advance(60_000);
    }
    const settled = session.state;
    expect(session.advance(500)).toEqual([]);
    expect(session.state).toBe(settled);
    expect(settled.roundResults).toHaveLength(1);
    expect(settled.gold).toBe(15);
  });

  it('Continue restores preparation and clears prior death, cooldown, target, events and partial time', () => {
    const prep = preparation(), session = new MatchSession(prep);
    const before = structuredClone(prep.preparation);
    expect(session.continue(1).ok).toBe(false);
    session.start();
    session.advance(60_025);
    expect(session.combat?.units.some(unit => !unit.alive)).toBe(true);
    expect(session.combat?.units.some(unit => unit.hp < unit.maxHp)).toBe(true);
    expect(session.preparation).toEqual(before);
    expect(session.continue(1).ok).toBe(true);
    expect(session.phase).toBe('preparation');
    expect(session.combat).toBeNull();
    expect(session.preparation).toEqual(before);
    expect(session.advance(1000)).toEqual([]);
    expect(session.deploy('unit-1', { kind: 'board', cell: { col: 4, row: 6 } }).ok).toBe(true);
    const secondSnapshot = structuredClone(session.preparation);
    session.start();
    expect(session.combat?.units.every(unit => unit.hp === unit.maxHp && unit.alive && unit.targetId === null
      && unit.cooldownTicks === 0 && unit.moveCooldownTicks === 0)).toBe(true);
    expect(session.combat?.units.find(unit => unit.id === 'unit-1')?.cell).toEqual({ col: 4, row: 6 });
    expect(session.advance(25)).toEqual([]);
    expect(session.combat?.tick).toBe(0);
    session.advance(25);
    expect(session.combat?.tick).toBe(1);
    session.advance(60_000);
    session.continue(2);
    expect(session.preparation).toEqual(secondSnapshot);
    expect(prep.preparation).toEqual(before);
  });

  it('only advances whole 50 ms ticks and ignores invalid deltas', () => {
    const session = new MatchSession(preparation());
    session.start();
    const initial = session.state;
    for (const delta of [-1, NaN, Infinity, -Infinity, 0]) expect(session.advance(delta)).toEqual([]);
    expect(session.state).toBe(initial);
    session.advance(49);
    expect(session.combat?.tick).toBe(0);
    session.advance(1);
    expect(session.combat?.tick).toBe(1);
    session.advance(125);
    expect(session.combat?.tick).toBe(3);
    session.advance(25);
    expect(session.combat?.tick).toBe(4);
  });

  it('retains every tick, event and settlement across equal-time frame partitions', () => {
    function run(deltas: number[]) {
      const session = new MatchSession(preparation());
      const events: CombatEvent[] = [];
      session.start();
      for (const delta of deltas) events.push(...session.advance(delta));
      return { state: session.state, events };
    }
    expect(run([13, 7, 75, 5, 900])).toEqual(run(Array(100).fill(10)));
    expect(run([1000])).toEqual(run(Array(20).fill(50)));
    expect(run([60_000])).toEqual(run(Array(1200).fill(50)));
    expect(run([60_000]).state.phase).toBe('settlement');
  });

  it.each(['missing-player', 'missing-enemy', 'missing-both'] as const)('rejects %s without creating combat or changing any match state', reason => {
    const prep = preparation();
    const units = reason === 'missing-player' ? createMatch().preparation.units
      : reason === 'missing-enemy' ? prep.preparation.units.filter(unit => unit.team === 'player') : [];
    const session = new MatchSession({ ...prep, preparation: { ...prep.preparation, units } });
    const before = session.state;
    expect(session.startFailure).toBe(reason);
    expect(session.start()).toEqual({ ok: false, state: before, reason });
    expect(session.start().state).toBe(before);
    expect(session.phase).toBe('preparation');
    expect(session.combat).toBeNull();
    expect(session.advance(1000)).toEqual([]);
    expect(session.continue(1).ok).toBe(false);
    expect(session.state).toBe(before);
  });

  it('rechecks eligibility after deployment, returning the last player to bench and selling it', () => {
    const session = new MatchSession();
    expect(session.start().ok).toBe(false);
    session.deploy('unit-1', { kind: 'board', cell: { col: 2, row: 7 } });
    expect(session.startFailure).toBeUndefined();
    expect(session.start().ok).toBe(true);
    session.advance(60_000);
    session.continue(1);
    session.deploy('unit-1', { kind: 'bench', slot: 0 });
    expect(session.startFailure).toBe('missing-player');
    expect(session.start().ok).toBe(false);
    session.deploy('unit-1', { kind: 'board', cell: { col: 2, row: 7 } });
    session.sell('unit-1');
    expect(session.startFailure).toBe('missing-player');
    expect(session.start().ok).toBe(false);
  });

  it('delegates atomic buy/sell/reroll and preserves the purchased roster for five rounds', () => {
    const session = new MatchSession();
    expect(session.buy(0, 1).ok).toBe(true);
    expect(session.buy(1, 1).ok).toBe(true);
    const full = session.state;
    expect(session.buy(2, 1)).toEqual({ ok: false, reason: 'bench-full', state: full });
    expect(session.state).toBe(full);
    expect(session.sell('unit-7').ok).toBe(true);
    expect(session.reroll().ok).toBe(true);
    const refreshed = session.state;
    expect(session.buy(2, 1)).toEqual({ ok: false, reason: 'stale-shop', state: refreshed });
    expect(session.state).toBe(refreshed);
    session.deploy('unit-6', { kind: 'board', cell: { col: 2, row: 7 } });
    const roster = structuredClone(session.preparation);
    for (let round = 1; round <= 5; round++) {
      expect(session.start().ok).toBe(true);
      session.advance(60_025);
      expect(session.state.gold).toBe(4 + 5 * round);
      expect(session.continue(round).ok).toBe(true);
      const next = session.state;
      expect(session.continue(round).ok).toBe(false);
      expect(session.state).toBe(next);
      expect(session.preparation).toEqual(roster);
      expect(session.combat).toBeNull();
    }
    expect(session.state.round).toBe(6);
    expect(session.state.roundResults).toHaveLength(5);
    expect(session.state.shop.generation).toBe(7);
  });

  it('debug New Match discards the whole match and the partial combat clock', () => {
    const session = new MatchSession(preparation());
    session.buy(0, 1);
    session.start();
    session.advance(60_025);
    expect(session.state.roundResults).toHaveLength(1);
    session.newMatch();
    expect(session.state).toEqual(createMatch());
    session.deploy('unit-1', { kind: 'board', cell: { col: 2, row: 7 } });
    session.start();
    session.advance(49);
    session.newMatch();
    session.deploy('unit-1', { kind: 'board', cell: { col: 2, row: 7 } });
    session.start();
    expect(session.advance(1)).toEqual([]);
    expect(session.combat?.tick).toBe(0);
  });
});
