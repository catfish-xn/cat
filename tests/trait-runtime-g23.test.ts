import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { readG23Progress, writeG23Progress } from '../src/simulation/g2-3-state';
import { G23_CONQUEROR_CHESTS } from '../src/simulation/content/g2-3-policy';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import { toDisplayMatch } from '../src/rendering/online/seat-view-adapter';
import { g23TraitRuntime } from '../src/rendering/trait-column';

const withProgress = (stacks: number, chestsOpened: number, shimmer: number) => {
  const state = createMatch(7), p = readG23Progress(state)!;
  return writeG23Progress(state, { ...p, conquest: { ...p.conquest, stacks, chestsOpened }, chem: { ...p.chem, shimmer } });
};

it('shows Conqueror stacks against the next chest and Shimmer out of 100', () => {
  const runtime = g23TraitRuntime(withProgress(5, 1, 40))!;
  expect(runtime.get('conqueror')).toEqual([{ label: '征服层数', value: `5/${G23_CONQUEROR_CHESTS[1]!.threshold}` }]);
  expect(runtime.get('chem-baron')).toEqual([{ label: '微光', value: '40/100' }]);
  expect(g23TraitRuntime(createMatch(7))!.get('conqueror')).toEqual([{ label: '征服层数', value: `0/${G23_CONQUEROR_CHESTS[0]!.threshold}` }]);
});

it('moves Shimmer to the next hundred and drops the breakpoint past the last chest and the eighth market', () => {
  const runtime = g23TraitRuntime(withProgress(900, 15, 230))!;
  expect(runtime.get('conqueror')).toEqual([{ label: '征服层数', value: '900' }]);
  expect(runtime.get('chem-baron')).toEqual([{ label: '微光', value: '230/300' }]);
  expect(g23TraitRuntime(withProgress(0, 0, 799))!.get('chem-baron')).toEqual([{ label: '微光', value: '799/800' }]);
  expect(g23TraitRuntime(withProgress(0, 0, 800))!.get('chem-baron')).toEqual([{ label: '微光', value: '800' }]);
});

it('reads the same counters from my private seat view online', () => {
  const state = withProgress(12, 2, 75);
  expect(g23TraitRuntime(toDisplayMatch(toPrivateSeatView(state) as never))).toEqual(g23TraitRuntime(state));
});

it('shows nothing without G2-3 progress', () => {
  expect(g23TraitRuntime({ ...createMatch(7), seatMechanics: undefined })).toBeUndefined();
});
