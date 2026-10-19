import { deepStrictEqual } from 'node:assert';
import { beforeAll, describe, expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState, type LedgerCombatEvent } from '../src/simulation/combat';
import { toLedgerEvents } from '../src/simulation/combat-ledger';
import { applyCombatReplayTick, startCombatReplay, toCombatReplay, toCombatViewEvents, toCombatViewState } from '../src/simulation/combat-replay-view';
import { alignReplayUnits } from '../src/simulation/seat-mechanics/replay-units';

function simulate() {
  const base = createMatch(42);
  const preparation = { ...base.preparation, units: [
    { id: 'a', definitionId: 'jayce', starLevel: 1 as const, team: 'player' as const,
      location: { kind: 'board' as const, cell: { col: 0, row: 4 } } },
    { id: 'z', definitionId: 'trundle', starLevel: 1 as const, team: 'enemy' as const,
      location: { kind: 'board' as const, cell: { col: 0, row: 3 } } },
  ] };
  const opened = createCombatWithEvents(preparation, buildStrategySnapshot({ ...base, preparation, items: [], augments: [] }), 'jayce-forge-replay', 42);
  const all: CombatState[] = [opened.state], events: LedgerCombatEvent[] = toLedgerEvents(opened.events);
  let terminal = opened.state;
  while (terminal.status === 'running') {
    const next = stepCombat(terminal);
    terminal = next.state; all.push(terminal); events.push(...toLedgerEvents(next.events));
  }
  return { initial: opened.state, terminal, events, all };
}

let source: ReturnType<typeof simulate>;
beforeAll(() => { source = simulate(); });
describe('Jayce forge replay order regression', () => {
  it('seed 42: two unequipped one-star heroes replay every tick, with exact terminal and ledger', () => {
    expect(source.initial.units.map(u => u.id)).toEqual(['a', 'z', 'a:g23-forge']);
    expect(source.all[1].units.map(u => u.id)).toEqual(['a', 'a:g23-forge', 'z']);
    const before = structuredClone(source);
    const replay = toCombatReplay(source), task = startCombatReplay(source);
    expect(task.advance(1)).toBeNull();
    let sliced;
    do { sliced = task.advance(17); } while (!sliced);
    deepStrictEqual(sliced, replay);
    expect(replay.ticks[1].keyframe).toEqual(toCombatViewState(source.all[1]));
    expect(replay.ticks[1].events.some(e => e.type === 'unitEntered' || e.type === 'unitLeft')).toBe(false);
    let view = replay.initial;
    for (const frame of replay.ticks) {
      view = applyCombatReplayTick(view, frame);
      deepStrictEqual(view, toCombatViewState(source.all[frame.tick]));
    }
    deepStrictEqual(view, replay.terminal);
    deepStrictEqual(replay.terminal, toCombatViewState(source.terminal));
    deepStrictEqual(replay.ticks.flatMap(f => f.events).filter(e => 'eventSeq' in e), toCombatViewEvents(source.events));
    const repeated = simulate();
    deepStrictEqual(repeated.terminal, source.terminal);
    deepStrictEqual(repeated.events, source.events);
    deepStrictEqual(source, before);
  });
  it.each(['terminal', 'missing event', 'reordered events', 'extra event'])('still rejects a forged %s', kind => {
    let terminal = structuredClone(source.terminal);
    const events = [...source.events];
    const index = events.findIndex(e => e.type === 'attack');
    expect(index).toBeGreaterThanOrEqual(0);
    if (kind === 'terminal') terminal = { ...terminal, units: terminal.units.map((u, i) => i === 0 ? { ...u, hp: u.hp + 1 } : u) };
    else if (kind === 'missing event') events.splice(index, 1);
    else if (kind === 'reordered events') [events[index], events[index + 1]] = [events[index + 1], events[index]];
    else events.push(events[index]);
    expect(() => toCombatReplay({ ...source, terminal, events })).toThrow('replay-divergence');
  });
  it.each(['previous', 'current'])('still rejects duplicate unit IDs in %s', side => {
    const units = toCombatViewState(source.initial).units;
    const duplicate = [...units, units[0]];
    expect(() => alignReplayUnits(side === 'previous' ? duplicate : units, side === 'current' ? duplicate : units, []))
      .toThrow('replay-divergence');
  });
});
