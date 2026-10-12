import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealClock } from '../../src/server/room/real-clock';

describe('RealClock', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  it('fires a scheduled callback once the real time reaches its deadline, and not before', () => {
    const clock = new RealClock();
    const fired: number[] = [];
    const start = clock.now();
    clock.schedule(start + 1_000, () => fired.push(1));
    clock.schedule(start + 500, () => fired.push(2));
    expect(clock.pending).toBe(2);
    vi.advanceTimersByTime(499); expect(fired).toEqual([]);
    vi.advanceTimersByTime(1); expect(fired).toEqual([2]);
    vi.advanceTimersByTime(500); expect(fired).toEqual([2, 1]);
    expect(clock.pending).toBe(0);
  });
  it('runs a past deadline on the next timer turn and cancels cleanly', () => {
    const clock = new RealClock();
    const fired: string[] = [];
    clock.schedule(clock.now() - 10, () => fired.push('past'));
    const handle = clock.schedule(clock.now() + 100, () => fired.push('cancelled'));
    clock.cancel(handle); clock.cancel(handle); clock.cancel(999);
    vi.advanceTimersByTime(200);
    expect(fired).toEqual(['past']);
    clock.schedule(clock.now() + 50, () => fired.push('disposed'));
    clock.dispose(); vi.advanceTimersByTime(100);
    expect(fired).toEqual(['past']); expect(clock.pending).toBe(0);
  });
});
