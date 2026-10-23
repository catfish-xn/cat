import { deepStrictEqual } from 'node:assert';
import { describe, expect, it } from 'vitest';
import { createMatch, type MatchState } from '../src/simulation/match';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type LedgerCombatEvent } from '../src/simulation/combat';
import { ad, ap, type S13Unit } from '../src/simulation/combat-s13-state';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { validateDynamicCombat } from '../src/simulation/g2-4b-gold-restore';
import { toLedgerEvents } from '../src/simulation/combat-ledger';
import { compileBattle, resolveTwoSidedBattle, startTwoSidedBattle } from '../src/simulation/two-sided-battle';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { applyCombatReplayTick, toCombatReplay, toCombatViewState } from '../src/simulation/combat-replay-view';

function army(starLevel: 1 | 2 | 3): MatchState {
  const base = createMatch(42), round = getCatalogRoundById('4-6');
  return { ...base, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round }, level: 10, nextUnitSerial: 4,
    items: [], augments: [], preparation: { ...base.preparation, units: [
      ...['warwick', 'viktor', 'mel'].map((definitionId, col) => ({ id: `unit-${col + 1}`, definitionId, starLevel,
        team: 'player' as const, location: { kind: 'board' as const, cell: { col, row: 4 } } })),
      { id: 'enemy', definitionId: 'garen', starLevel: 3, team: 'enemy', location: { kind: 'board', cell: { col: 0, row: 3 } } },
    ] } };
}

describe('approved six-cost AD stars (2026-10-23 project decision)', () => {
  it.each([[1, 100, 110, 110], [2, 150, 165, 115], [3, 225, 247, 122]] as const)(
    'Viktor star %s: fixed AD and only equipment extra AD converts to AP', (star, fixed, raw, power) => {
      let state = army(star);
      const open = () => createCombatWithEvents(state.preparation, buildStrategySnapshot(state), 'six-ad', 42);
      const find = () => open().state.units.find(u => u.id === 'unit-2')! as S13Unit;
      const bare = find();
      expect(ad(bare)).toBe(fixed); expect(ap(bare, 0)).toBe(100);
      state = { ...state, items: [{ id: 'item-1', definitionId: 'sword', location: { kind: 'unit', unitId: 'unit-2', slot: 0 } }] };
      const equipped = find();
      // Sword +10% AD: floor(100/150/225 * 1.1) = 110/165/247.
      expect(ad(equipped, true)).toBe(raw); expect(ad(equipped)).toBe(fixed); expect(ap(equipped, 0)).toBe(power);
      expect(open().state).toMatchObject({ rngState: 42, rngDraws: 0 });
    });

  it.each([1, 2, 3] as const)('star %s: sync, sliced battle, JSON checkpoint and every replay tick agree', star => {
    const state = army(star), basis = freezeCombatInput(state, 42, state.resourceProvenance.entries.length);
    const strategy = buildStrategySnapshot(state);
    const opened = createCombatWithEvents(basis.inputs.preparation, strategy, basis.combatId, basis.battleSeed);
    expect(opened.state).toMatchObject({ rngState: 42, rngDraws: 0 });
    const all = [opened.state], events: LedgerCombatEvent[] = toLedgerEvents(opened.events);
    let terminal = opened.state;
    while (terminal.status === 'running') {
      const next = stepCombat(terminal); terminal = next.state;
      all.push(terminal); events.push(...toLedgerEvents(next.events));
    }
    const checkpoint = JSON.parse(JSON.stringify(all[Math.min(17, all.length - 2)]));
    expect(validateDynamicCombat(checkpoint, basis, strategy)).toBe(true);
    let resumed = checkpoint;
    const suffix: LedgerCombatEvent[] = [];
    while (resumed.status === 'running') {
      const next = stepCombat(resumed); resumed = next.state; suffix.push(...toLedgerEvents(next.events));
    }
    deepStrictEqual(resumed, terminal);
    deepStrictEqual(suffix, events.filter(e => e.eventSeq >= checkpoint.nextEventSeq));
    const source = { initial: opened.state, terminal, events }, replay = toCombatReplay(source);
    let view = replay.initial;
    for (const frame of replay.ticks) {
      view = applyCombatReplayTick(view, frame); deepStrictEqual(view, toCombatViewState(all[frame.tick]));
    }
    deepStrictEqual(view, replay.terminal);
    const input = compileBattle(snapshotForBattle(state, 'A'), snapshotForBattle(state, 'B'), 42, { battleId: 'six-ad' });
    const sync = resolveTwoSidedBattle(input, 1201), task = startTwoSidedBattle(input, { captureReplay: true });
    let sliced;
    do { sliced = task.advance(17); } while (!sliced);
    deepStrictEqual(sliced, sync);
    deepStrictEqual(task.replay(), toCombatReplay(sync));
  });
});
