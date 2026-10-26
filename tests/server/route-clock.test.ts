import { expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { RouteClock } from './route-clock';

it('pausing between continuations preserves runNext groups, cancellation, nested and overdue timers', () => {
  function setup(clock: ManualClock) {
    const trace: string[] = [];
    clock.schedule(4, () => {
      trace.push(`a:${clock.now()}`);
      clock.schedule(4, () => trace.push(`c:${clock.now()}`));
      clock.schedule(2, () => trace.push(`late:${clock.now()}`));
    });
    clock.schedule(4, () => trace.push(`b:${clock.now()}`));
    const cancelled = clock.schedule(6, () => trace.push('cancelled'));
    clock.cancel(cancelled);
    clock.schedule(8, () => trace.push(`d:${clock.now()}`));
    return trace;
  }
  const whole = new ManualClock(), sliced = new RouteClock();
  const wholeTrace = setup(whole), slicedTrace = setup(sliced);
  const wholeGroups: string[][] = [], slicedGroups: string[][] = [];
  while (whole.runNext()) wholeGroups.push([...wholeTrace]);
  let groupEnd: number | undefined;
  while (sliced.nextAt !== undefined) {
    groupEnd ??= Math.max(sliced.now(), sliced.nextAt);
    expect(sliced.fireNext()).toBe(true);
    if (sliced.nextAt === undefined || sliced.nextAt > groupEnd) {
      slicedGroups.push([...slicedTrace]); groupEnd = undefined;
    }
  }
  expect(slicedGroups).toEqual(wholeGroups);
  expect(slicedGroups).toEqual([['a:4', 'late:4', 'b:4', 'c:4'], ['a:4', 'late:4', 'b:4', 'c:4', 'd:8']]);
  expect(sliced.now()).toBe(whole.now()); expect(sliced.pending).toBe(0);
});
