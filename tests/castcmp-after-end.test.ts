import { describe, expect, it } from 'vitest';
import { auditWindow, parseAfterEndMs } from '../dev/castcmp/real-combat';

// castcmp --after-end-ms (recording only): a window may run past the combat's last tick; the rules hold their last state
// there and the effects already started play on. Without it a window past the end does not cover.
const ticks = (n: number) => Array.from({ length: n }, () => [] as any[]);
const aliveFor = (n: number) => Array.from({ length: n }, () => ({ me: true, foe: true }));
describe('castcmp --after-end-ms', () => {
  it('parses a whole number of ms within bounds, and nothing given is zero', () => {
    expect(parseAfterEndMs(undefined)).toEqual({ afterEndMs: 0 });
    expect(parseAfterEndMs('800')).toEqual({ afterEndMs: 800 });
    for (const bad of ['-1', '1.5', 'x', '9999']) expect('why' in parseAfterEndMs(bad), bad).toBe(true);
  });
  it('a window past the last tick covers only with enough after-end time; without it nothing changes', () => {
    const events = ticks(31); events[10] = [{ type: 'cast', sourceId: 'me', targetIds: ['foe'] }];
    const alive = aliveFor(31);
    // Window: from tick 0 (lead 10 before the cast) for 2000 ms = to tick 40; the combat's last tick is 30.
    const plain = auditWindow(events, alive, 10, 2000, 10);
    expect(plain).toMatchObject({ to: 40, replayEnds: 30, coversWindow: false, afterEndTicks: 10 });
    expect(auditWindow(events, alive, 10, 2000, 10, undefined, 450).coversWindow).toBe(false);
    expect(auditWindow(events, alive, 10, 2000, 10, undefined, 500)).toMatchObject({ coversWindow: true, pastEnd: true });
    expect(plain.pastEnd).toBe(false);
    // A window inside the combat is unchanged by it.
    expect(auditWindow(events, alive, 10, 1000, 10, undefined, 500)).toMatchObject({ coversWindow: true, afterEndTicks: 0, pastEnd: false });
    expect(auditWindow(events, alive, 10, 1000, 10)).toMatchObject({ coversWindow: true, afterEndTicks: 0 });
  });
});
