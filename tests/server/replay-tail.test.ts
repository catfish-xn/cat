import { describe, expect, it } from 'vitest';
import type { CombatReplay, CombatViewState } from '../../src/server-entry';
import { replayTail } from '../../src/server/room/live-bank';

/** Synthetic public replay only: the predicted future and the live run share an unchanged prefix. */
function predictedReplay(): CombatReplay {
  const initial: CombatViewState = {
    combatId: 'tail-regression', tick: 0, maxTicks: 1200, status: 'running', result: null,
    board: { columns: 7, rows: 8, deploymentZones: { player: { firstRow: 4, lastRow: 7 }, enemy: { firstRow: 0, lastRow: 3 } } },
    units: [],
  };
  return { initial, ticks: Array.from({ length: 5 }, (_, tick) => ({ tick, events: [] })),
    terminal: { ...initial, tick: 4, status: 'finished', result: 'draw' } };
}

describe('replayTail unchanged-prefix revisions', () => {
  it('carries the last authoritative tick when a live prefix truncates an identical prediction', () => {
    const before = predictedReplay();
    const prefix = { ...before, ticks: before.ticks.slice(0, 3) };
    const tail = replayTail(before, prefix)!;
    expect(tail).toEqual({ fromTick: 2, ticks: [prefix.ticks[2]], terminal: prefix.terminal });
    expect(tail.ticks.length).toBeGreaterThan(0);
    const shown = { ...before, ticks: [...before.ticks.slice(0, tail.fromTick), ...tail.ticks], terminal: tail.terminal };
    expect(shown).toEqual(prefix);
    expect(replayTail(shown, prefix)).toBeNull();
    // The next live slice appends without a gap or replaying the discarded prediction.
    const next = { ...prefix, ticks: before.ticks.slice(0, 4) };
    expect(replayTail(shown, next)).toEqual({ fromTick: 3, ticks: [next.ticks[3]], terminal: next.terminal });
  });

  it('carries the final tick with a terminal-only revision and suppresses identical replacements', () => {
    const before = predictedReplay();
    const after = { ...before, terminal: { ...before.terminal, result: 'playerWin' as const } };
    const tail = replayTail(before, after)!;
    expect(tail).toEqual({ fromTick: 4, ticks: [after.ticks[4]], terminal: after.terminal });
    expect({ ...before, ticks: [...before.ticks.slice(0, tail.fromTick), ...tail.ticks], terminal: tail.terminal }).toEqual(after);
    expect(replayTail(after, after)).toBeNull();
  });

  it('keeps the same suffix for shared frames and for JSON-equal copies', () => {
    const before = predictedReplay();
    const extra = { tick: 5, events: [] };
    const extended = { ...before, ticks: [...before.ticks, extra] };
    expect(replayTail(before, extended)).toEqual({ fromTick: 5, ticks: [extra], terminal: extended.terminal });
    const copied = { ...before, ticks: before.ticks.map(frame => ({ tick: frame.tick, events: [...frame.events] })), terminal: { ...before.terminal } };
    expect(replayTail(before, copied)).toBeNull();
    const changed = { ...copied, ticks: copied.ticks.map((frame, index) => index === 2 ? { ...frame, tick: frame.tick + 100 } : frame) };
    expect(replayTail(copied, changed)).toEqual({ fromTick: 2, ticks: changed.ticks.slice(2), terminal: changed.terminal });
  });
});
