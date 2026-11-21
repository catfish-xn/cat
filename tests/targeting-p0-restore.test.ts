import { expect, it } from 'vitest';
import { battle } from './match-helpers';
import { stepMatch } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';

it('real PvE combat restores engaged targets, authenticates missing/forged locks, and resumes identically', () => {
  let state = battle();
  while (state.phase === 'combat' && !state.combat!.units.some(u => u.targetEngaged)) state = stepMatch(state).state;
  expect(state.phase).toBe('combat');
  const engaged = state.combat!.units.find(u => u.targetEngaged)!;
  expect(engaged).toBeDefined();
  for (const input of [structuredClone(state), serializeMatch(state)]) {
    let restored = restoreMatch(input), live = state;
    expect(restored).toEqual(live);
    while (live.phase === 'combat') {
      const next = stepMatch(live), resumed = stepMatch(restored);
      expect(resumed).toEqual(next); live = next.state; restored = resumed.state;
    }
  }
  const missing = structuredClone(state);
  delete (missing.combat!.units.find(u => u.id === engaged.id)! as { targetEngaged?: true }).targetEngaged;
  expect(() => restoreMatch(missing)).toThrow(/target binding facts/);
  const forged = structuredClone(state);
  Object.assign(forged.combat!.units.find(u => u.id === engaged.id)!, { targetId: null });
  expect(() => restoreMatch(forged)).toThrow(/engaged target|target binding facts/);
});
