import { describe, expect, it } from 'vitest';
import { createCombatWithEvents, type CombatResult } from '../src/simulation/combat';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { buyUnit, buyXp, createMatch, deployMatchUnit, nextRound, rerollShop, sellUnit, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { accepted, battle, deployed, finish, freeze } from './match-helpers';
import { expectedRound, expectedShop, progression } from './fixtures/m4/oracle.cjs';
import { resolveChoices } from './m4-helpers';

const players = (state: MatchState) => state.preparation.units.filter(unit => unit.team === 'player');
function weak(): MatchState { return accepted(deployMatchUnit(createMatch(), 'unit-2', { kind: 'board', cell: { col: 3, row: 7 } })); }

describe('M4 round lifecycle, XP, HP and unique settlement', () => {
  it.each(['playerWin', 'enemyWin', 'draw'] as const)('settles real %s exactly once and Continue refreshes enemies/shop before the scheduled choice', result => {
    let state = result === 'playerWin' ? battle() : accepted(startMatchCombat(weak()));
    if (result === 'draw' && state.phase === 'combat') state = { ...state, combat: { ...state.combat, maxTicks: 1 } };
    const before = structuredClone(state), settled = finish(freeze(state));
    expect(settled.combat?.result).toBe(result);
    const record = expectedRound(before, settled.combat!);
    expect(settled.roundResults).toEqual([record]);
    expect(settled).toMatchObject({ gold: record.goldAfter, level: record.levelAfter, xp: record.xpAfter, playerHp: record.hpAfter });
    expect(settled.rngState).toBe(before.rngState);
    for (let i = 0; i < 20; i++) {
      expect(stepMatch(settled)).toEqual({ state: settled, events: [] });
      expect(stepMatch(settled).state).toBe(settled);
      expect(startMatchCombat(settled)).toEqual({ ok: false, state: settled, reason: 'wrong-phase' });
    }
    const scheduled = accepted(nextRound(freeze(settled), 1));
    expect(scheduled).toMatchObject({ phase: 'choice', pendingChoice: { kind: 'augment', step: 'offer' } });
    const next = resolveChoices(scheduled);
    expect(next).toMatchObject({ phase: 'preparation', round: 2, combat: null, gold: settled.gold, level: settled.level, xp: settled.xp, playerHp: settled.playerHp });
    expect(next.roundResults).toBe(settled.roundResults); expect(players(next)).toEqual(players(before));
    expect(next.preparation.units.filter(u => u.team === 'enemy').map(u => u.id)).toEqual(['enemy-r2-1', 'enemy-r2-2']);
    expect({ shop: next.shop, rngState: next.rngState }).toEqual(expectedShop(settled.rngState, 2, settled.level));
    expect(nextRound(next, 1)).toEqual({ ok: false, state: next, reason: 'wrong-phase' });
  });
  it('natural XP crosses a level exactly once, and Continue uses the new level odds', () => {
    const prep = accepted(buyXp(createMatch()));
    const settled = accepted(startMatchCombat(prep)); // Empty board is a real tick-zero defeat.
    expect(settled).toMatchObject({ phase: 'settlement', level: 4, xp: 0, gold: 11, playerHp: 94 });
    expect(settled.roundResults[0]).toMatchObject({ xpAwarded: 2, levelBefore: 3, levelAfter: 4, xpBefore: 4, xpAfter: 0 });
    const next = resolveChoices(accepted(nextRound(settled, 1)));
    expect(next.level).toBe(4); expect(next.xp).toBe(0);
    expect({ shop: next.shop, rngState: next.rngState }).toEqual(expectedShop(settled.rngState, 2, 4));
  });
  it('caps natural XP at max level, recording actual applied experience', () => {
    for (const [level, xp, applied] of [[8, 79, 1], [9, 0, 0]]) {
      const settled = accepted(startMatchCombat({ ...createMatch(), level, xp }));
      expect(settled).toMatchObject({ level: 9, xp: 0 });
      expect(settled.roundResults[0].xpAwarded).toBe(applied);
    }
  });
  it('rejects stale or unsettled Continue without refreshing RNG', () => {
    const first = finish(battle()), second = finish(accepted(startMatchCombat(resolveChoices(accepted(nextRound(first, 1))))));
    const before = structuredClone(second);
    expect(nextRound(freeze(second), 1)).toEqual({ ok: false, state: second, reason: 'stale-round' });
    expect(second).toEqual(before);
    const malformed = { ...second, roundResults: [] };
    expect(nextRound(malformed, 2)).toEqual({ ok: false, state: malformed, reason: 'unsettled-round' });
    expect(accepted(nextRound(second, 2)).round).toBe(3);
  });
  it('keeps preparation ticks inert and rejects missing enemies/both while empty player board settles once', () => {
    const empty = freeze(createMatch());
    expect(stepMatch(empty)).toEqual({ state: empty, events: [] }); expect(stepMatch(empty).state).toBe(empty);
    const abandoned = accepted(startMatchCombat(empty));
    expect(abandoned).toMatchObject({ phase: 'settlement', playerHp: 94, gold: 15 });
    expect(abandoned.combat).toMatchObject({ tick: 0, result: 'enemyWin' });
    for (const [teams, reason] of [[['player'], 'missing-enemy'], [[], 'missing-both']] as const) {
      const input = deployed(), fixture = { ...input, preparation: { ...input.preparation, units: input.preparation.units.filter(unit => (teams as readonly string[]).includes(unit.team)) } };
      expect(startMatchCombat(fixture)).toEqual({ ok: false, state: fixture, reason });
    }
  });
  it('enters Game Over directly on lethal loss, grants final income/XP once and clamps actual HP loss', () => {
    const before = { ...createMatch(), playerHp: 1, xp: 5 }, terminal = accepted(startMatchCombat(freeze(before)));
    expect(terminal.phase).toBe('gameOver');
    expect(terminal).toMatchObject({ playerHp: 0, gold: 15, level: 4, xp: 1 });
    expect(terminal.roundResults).toEqual([expectedRound(before, terminal.combat!)]);
    expect(terminal.roundResults[0]).toMatchObject({ playerDamage: 6, hpLost: 1, hpAfter: 0 });
    const commands = [buyXp, rerollShop, startMatchCombat, (s: MatchState) => buyUnit(s, 0, s.shop.generation),
      (s: MatchState) => sellUnit(s, 'unit-1'), (s: MatchState) => nextRound(s, s.round),
      (s: MatchState) => deployMatchUnit(s, 'unit-1', { kind: 'board', cell: { col: 1, row: 4 } })];
    for (let i = 0; i < 30; i++) {
      expect(stepMatch(terminal)).toEqual({ state: terminal, events: [] });
      for (const command of commands) { expect(command(terminal)).toEqual({ ok: false, state: terminal, reason: 'wrong-phase' }); expect(command(terminal).state).toBe(terminal); }
    }
  });
  it('plays a real nonempty weak roster to Game Over within twenty rounds without injecting HP or results', () => {
    let state = weak(), nonemptyDefeats = 0;
    while (state.phase !== 'gameOver' && state.round <= 20) {
      const before = state, settled = finish(accepted(startMatchCombat(state)));
      expect(settled.roundResults.at(-1)).toEqual(expectedRound(before, settled.combat!));
      expect(settled.roundResults).toHaveLength(before.round);
      if (settled.combat?.result === 'enemyWin') nonemptyDefeats++;
      state = settled.phase === 'gameOver' ? settled : resolveChoices(accepted(nextRound(settled, settled.round)));
    }
    expect(state.phase).toBe('gameOver'); expect(state.playerHp).toBe(0); expect(state.round).toBeLessThanOrEqual(20);
    expect(nonemptyDefeats).toBeGreaterThan(0);
  });
  it('selling everything and spending every gold still allows bounded defeat/recovery instead of softlock', () => {
    let state = createMatch();
    for (const unit of players(state)) state = accepted(sellUnit(state, unit.id));
    while (state.gold >= 4) state = accepted(buyXp(state));
    while (state.gold >= 2) state = accepted(rerollShop(state));
    expect(state.gold).toBeLessThan(2); expect(players(state)).toHaveLength(0);
    const settled = accepted(startMatchCombat(state));
    expect(settled.playerHp).toBeLessThan(state.playerHp); expect(settled.gold).toBe(state.gold + 5);
    const next = resolveChoices(accepted(nextRound(settled, settled.round)));
    expect(buyUnit(next, 0, next.shop.generation).ok).toBe(true);
  });
});

describe('M4 preparation/Combat isolation and changing opponents', () => {
  it('preserves frozen history and all economic fields until the one terminal transition', () => {
    const prep = freeze(deployed()), original = structuredClone(prep);
    let state = accepted(startMatchCombat(prep));
    const snapshots: { actual: MatchState; copy: MatchState }[] = [];
    while (state.phase === 'combat') {
      snapshots.push({ actual: freeze(state), copy: structuredClone(state) }); state = stepMatch(state).state;
      expect(state.preparation).toEqual(prep.preparation); expect(state.shop).toBe(prep.shop);
      expect(state.rngState).toBe(prep.rngState); expect(state.nextUnitSerial).toBe(prep.nextUnitSerial);
      if (state.phase === 'combat') expect([state.gold, state.level, state.xp, state.playerHp]).toEqual([prep.gold, prep.level, prep.xp, prep.playerHp]);
    }
    expect(prep).toEqual(original);
    for (const snapshot of snapshots) expect(snapshot.actual).toEqual(snapshot.copy);
  });
  it('retains upgraded purchases/positions, never resurrects consumed/sold IDs, and creates fresh combat each round', () => {
    const initial = createMatch();
    // Keep the upgrade/identity boundary fixed as the authored shop catalog grows.
    const offered: MatchState = { ...initial, shop: { ...initial.shop,
      slots: [{ status: 'available', definitionId: 'sentinel' }, ...initial.shop.slots.slice(1)] } };
    let state = accepted(buyUnit(offered, 0, 1));
    for (const [id, col] of [['unit-1', 1], ['unit-2', 3], ['unit-3', 5]] as const) state = accepted(deployMatchUnit(state, id, { kind: 'board', cell: { col, row: 4 } }));
    state = accepted(sellUnit(state, 'unit-5'));
    const owned = structuredClone(players(state)), results: CombatResult[] = [];
    for (let round = 1; round <= 5; round++) {
      const before = state, started = accepted(startMatchCombat(freeze(state)));
      const strategy = buildStrategySnapshot(before);
      expect(started.combat).toEqual(createCombatWithEvents(before.preparation, strategy, `round-${round}`).state);
      expect(started.combat!.units.every(u => u.alive && u.hp === u.maxHp && u.cooldownTicks === 0 && u.moveCooldownTicks === 0 && u.targetId === null)).toBe(true);
      for (const unit of started.combat!.units) {
        const resolved = strategy.units.find(value => value.unitId === unit.id)!;
        const starts = resolved.triggers.filter(trigger => trigger.hook === 'combatStart');
        const manaGain = starts.reduce((sum, trigger) => sum + (trigger.action.kind === 'gainMana' ? trigger.action.amount : 0), 0);
        expect(unit.mana).toBe(Math.min(unit.maxMana, resolved.stats.initialMana + manaGain));
        const shieldGrants = starts.flatMap(trigger => trigger.action.kind === 'grantShield' ? [trigger.action] : []);
        expect(unit.shield).toBe(Math.max(0, ...shieldGrants.map(action => action.amount)));
        expect(unit.shieldExpiresAtTick).toBe(shieldGrants.length ? Math.max(...shieldGrants.map(action => action.durationTicks)) : null);
      }
      const settled = finish(started); results.push(settled.combat!.result!);
      expect(settled.roundResults.at(-1)).toEqual(expectedRound(before, settled.combat!));
      state = resolveChoices(accepted(nextRound(freeze(settled), round)));
      expect(players(state)).toEqual(owned); expect(state.combat).toBeNull();
      expect(state.preparation.units.some(u => ['unit-4', 'unit-5', 'unit-6'].includes(u.id))).toBe(false);
      expect(state.preparation.units.filter(u => u.team === 'enemy').every(u => u.id.startsWith(`enemy-r${round + 1}-`))).toBe(true);
    }
    expect(state.round).toBe(6); expect(state.gold).toBe(10 - 1 + 1 + 5 * 5);
    expect([state.level, state.xp]).toEqual([progression(3, 0, 10).level, progression(3, 0, 10).xp]);
    expect(state.roundResults.map(record => record.result)).toEqual(results);
  });
});
