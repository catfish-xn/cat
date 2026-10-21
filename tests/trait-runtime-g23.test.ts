import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { readG23Progress, writeG23Progress } from '../src/simulation/g2-3-state';
import { G23_CONQUEROR_CHESTS } from '../src/simulation/content/g2-3-policy';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import { toDisplayMatch } from '../src/rendering/online/seat-view-adapter';
import { g23BoardMechanics, g23TraitRuntime } from '../src/rendering/trait-column';

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

it('gives the 3D chest and flask the same counters, only once gathered (or the trait is fielded)', () => {
  expect(g23BoardMechanics(createMatch(7))).toBeUndefined();
  const first = G23_CONQUEROR_CHESTS[0]!.threshold, second = G23_CONQUEROR_CHESTS[1]!.threshold;
  expect(g23BoardMechanics(withProgress(5, 1, 0))).toEqual({ conquest: { stacks: 5, opened: 1, from: first, next: second } });
  expect(g23BoardMechanics(withProgress(0, 0, 230))).toEqual({ shimmer: { value: 230, next: 300, offer: false } });
  expect(g23BoardMechanics(withProgress(900, 15, 800))).toEqual({ conquest: { stacks: 900, opened: 15, from: G23_CONQUEROR_CHESTS[14]!.threshold, next: null },
    shimmer: { value: 800, next: null, offer: false } });
  const state = withProgress(0, 0, 100), p = readG23Progress(state)!;
  expect(g23BoardMechanics(writeG23Progress(state, { ...p, chem: { ...p.chem, offer: {} as never } }))?.shimmer?.offer).toBe(true);
  expect(g23BoardMechanics(toDisplayMatch(toPrivateSeatView(withProgress(12, 2, 75)) as never))).toEqual(g23BoardMechanics(withProgress(12, 2, 75)));
});
