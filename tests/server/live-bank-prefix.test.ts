import { afterEach, expect, it, vi } from 'vitest';
import { LivePvpTrack } from '../../src/server/room/live-bank';
import * as resolver from '../../src/server/room/two-sided-resolver';
import type { BattleInput } from '../../src/server/room/types';

afterEach(() => vi.restoreAllMocks());

function track(changesBank: boolean) {
  let tick = 0;
  const sampleBankGold = vi.fn(() => changesBank);
  // The public replay remains identical with either bank: e.g. rounding absorbs the damage difference.
  // The rules task still reports whether it accepted a private bank change.
  vi.spyOn(resolver, 'startLiveTask').mockReturnValue({
    input: {
      a: { seatId: 'a', units: [{ id: 'u', team: 'player', location: { kind: 'board' } }], anomalyBinding: { definitionId: 'avarice-incarnate', unitId: 'u' } },
      b: { seatId: 'b', units: [], anomalyBinding: null }, mirrorOfSeatId: null,
    },
    task: {
      initialFrame: { tick: 0, events: [] }, sampleBankGold,
      advanceTick: () => ({ frame: { tick: ++tick, events: [] }, result: null }),
    },
  } as unknown as ReturnType<typeof resolver.startLiveTask>);
  return { live: new LivePvpTrack({ battleId: 'bank-prefix', maxSteps: 100 } as BattleInput), sampleBankGold };
}

it('streams the authoritative prefix after an accepted bank change even when public frames stay equal', () => {
  const { live, sampleBankGold } = track(true);
  expect(live.advance(2, 10)).toBe(false);
  live.sample('a', 15, 2);
  expect(live.advance(4, 10)).toBe(true);
  expect(sampleBankGold).toHaveBeenCalledExactlyOnceWith('a', 15);
  expect(live.liveFrames).toEqual({ fromTick: 3, ticks: [{ tick: 3, events: [] }, { tick: 4, events: [] }] });
  expect(live.advance(6, 10)).toBe(true);
  expect(live.liveFrames?.ticks.map(frame => frame.tick)).toEqual([3, 4, 5, 6]);
  expect(live.advance(6, 10)).toBe(false);
});

it('keeps the frozen replay when the rules reject a no-op bank sample or the seat has no live reader', () => {
  const { live, sampleBankGold } = track(false);
  live.sample('b', 15, 0);
  expect(live.advance(2, 10)).toBe(false);
  expect(sampleBankGold).not.toHaveBeenCalled();
  live.sample('a', 19, 2);
  expect(live.advance(4, 10)).toBe(false);
  expect(sampleBankGold).toHaveBeenCalledExactlyOnceWith('a', 19);
  expect(live.liveFrames).toBeNull();
});
