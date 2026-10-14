import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';

describe('ManualClock', () => {
  it('fires due timers in time order and sets now to each due time', () => {
    const clock = new ManualClock(); const seen: string[] = [];
    clock.schedule(300, () => seen.push(`b@${clock.now()}`));
    clock.schedule(100, () => seen.push(`a@${clock.now()}`));
    clock.schedule(100, () => seen.push(`c@${clock.now()}`));
    clock.advance(250);
    expect(seen).toEqual(['a@100', 'c@100']); expect(clock.now()).toBe(250);
    clock.advance(50); expect(seen).toEqual(['a@100', 'c@100', 'b@300']); expect(clock.pending).toBe(0);
  });
  it('cancels and runs timers scheduled from a callback within the same advance', () => {
    const clock = new ManualClock(); const seen: number[] = [];
    const handle = clock.schedule(10, () => seen.push(10));
    clock.schedule(20, () => { seen.push(20); clock.schedule(clock.now() + 5, () => seen.push(25)); });
    clock.cancel(handle); clock.advance(100);
    expect(seen).toEqual([20, 25]);
  });
  it('runNext jumps straight to the next timer and refuses negative advances', () => {
    const clock = new ManualClock(5); let fired = false;
    clock.schedule(1_000, () => { fired = true; });
    expect(clock.runNext()).toBe(true); expect(fired).toBe(true); expect(clock.now()).toBe(1_000);
    expect(clock.runNext()).toBe(false);
    expect(() => clock.advance(-1)).toThrow(RangeError);
  });
});
