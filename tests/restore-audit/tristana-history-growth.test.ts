import { beforeAll, expect, it } from 'vitest';
import * as api from '../../src/simulation/match';
import { restoreMatch, serializeMatch } from '../../src/simulation/serialization';
import { validateMatchStructure } from '../../src/simulation/serialization-structure';
import type { BattleRecord } from '../../src/m6/contracts';
import { CompletedBattleHistory } from '../fixtures/completed-battle-history';
import { run } from '../../scripts/generate-m5-route.cjs';

let state: api.MatchState, battles: readonly BattleRecord[];
beforeAll(async () => {
  const history = new CompletedBattleHistory('a3-growth');
  const stop = new Error('public growth captured');
  try {
    await run(api, {seed:48, build:'cannon', copyLimits:{tristana:2}, fieldCopies:['tristana'],
      onStep(before, result) {
        if (before.phase === 'preparation' && before.combat === null && before.persistentGrowth.length) {
          state = before; battles = history.completedRecords; throw stop;
        }
        history.observe({before, after:result.state, events:('events' in result ? result.events : []).filter(e => e.domain === 'combat'),
          reason:before.combat ? 'tick' : 'command'});
      }});
  } catch (error) { if (error !== stop) throw error; }
  if (!state!) throw new Error('missing public Tristana growth');
});
it('A3 restores real Tristana killing growth from public-command completed history after combat clears', () => {
  expect(state.combat).toBeNull();
  expect(state.persistentGrowth.some(g => g.attackDamageBps > 0)).toBe(true);
  for (const input of [state, serializeMatch(state, battles)])
    expect(restoreMatch(input, battles)).toEqual(state);
});
it('A3 rejects coordinated sourceDeltas and persistentGrowth with no corresponding killing trigger', () => {
  const bad = structuredClone(state);
  const growth = bad.persistentGrowth[0];
  const commit = bad.resourceProvenance.entries.find(e => e.kind === 'combat-growth-committed'
    && e.sourceDeltas.some(d => d.sourceUnitId === growth.unitId));
  if (commit?.kind !== 'combat-growth-committed') throw Error('growth commit missing');
  const delta = commit.sourceDeltas.find(d => d.sourceUnitId === growth.unitId)!;
  Object.assign(delta, {attackDamageBps:delta.attackDamageBps + 125});
  Object.assign(growth, {attackDamageBps:growth.attackDamageBps + 125});
  expect(() => validateMatchStructure(bad)).not.toThrow();
  for (const input of [bad, JSON.stringify(bad)]) {
    expect(() => restoreMatch(input)).toThrow(/缺少历史证据/);
    expect(() => restoreMatch(input, battles)).toThrow(/历史获得或合成记录不一致/);
  }
});
