import { expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { run } from '../scripts/generate-m5-route.cjs';

it.each(['onStep', 'onBattleProgress', 'onRound'] as const)(
  'audits retained records when %s truncates a real public-command route', async callback => {
    const stop = new Error('intentional route truncation');
    let checked = false;
    const truncate = (state: api.MatchState) => {
      const record = state.roundResults[0];
      if (!record) return;
      expect(record).toBeDefined();
      Object.assign(record, { hpAfter: record.hpAfter + 1 });
      checked = true;
      throw stop;
    };
    const options = callback === 'onStep' ? {
      onStep(_before: api.MatchState, result: { state: api.MatchState }) {
        if (result.state.roundResults.length > 0 && result.state.phase === 'combat' && result.state.combat!.tick === 2) truncate(result.state);
      },
    } : { [callback]: truncate };
    await expect(run(api, { seed: 230, build: 'cannon', ...options }))
      .rejects.toThrow(/H3 independent observed checkpoint/);
    expect(checked).toBe(true);
  },
);

it.each([false, true])('preserves clean truncation (temporary edit restored: %s)', async temporaryEdit => {
  const stop = new Error('intentional clean truncation');
  let checked = false;
  await expect(run(api, { seed: 230, build: 'cannon', onStep(_before, result) {
    if (!result.state.roundResults.length || result.state.phase !== 'combat' || result.state.combat!.tick !== 2) return;
    const record = result.state.roundResults[0];
    expect(record).toBeDefined();
    if (temporaryEdit) {
      const savedHp = record.hpAfter;
      Object.assign(record, { hpAfter: savedHp + 1 });
      Object.assign(record, { hpAfter: savedHp });
    }
    checked = true;
    throw stop;
  } })).rejects.toBe(stop);
  expect(checked).toBe(true);
});
