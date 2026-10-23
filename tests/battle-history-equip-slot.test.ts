import { describe, expect, it } from 'vitest';
import { createMatch, equipItem, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { grantMechanicItem } from '../src/simulation/seat-mechanics/index';
import { BattleHistory, validateBattleRecord } from '../src/replay/history';

describe('battle history: in-place combine during combat', () => {
  it('records the requested slot so the prefix replays', () => {
    let state: MatchState = createMatch(7);
    for (let i = 0; i < 2; i++) {
      const granted = grantMechanicItem(state, { receiptId: `m7:sword:${i}`, source: 'test', definitionId: 'sword' });
      if (!granted.ok) throw new Error(granted.reason);
      state = granted.state;
    }
    const equipped = equipItem(state, 'item-1', 'unit-1', 0);
    if (!equipped.ok) throw new Error(equipped.reason);
    state = equipped.state;
    const history = new BattleHistory('equip-slot');
    const commit = (result: { state: MatchState; events: readonly { domain: string }[]; ok?: boolean; reason?: string }, reason: 'command' | 'tick') => {
      if ('ok' in result && !result.ok) throw new Error(result.reason);
      const before = state;
      state = result.state;
      history.observe({ before, after: state, events: result.events.filter(e => e.domain === 'combat') as never, reason });
    };
    commit(startMatchCombat(state) as never, 'command');
    commit(stepMatch(state) as never, 'tick');
    commit(equipItem(state, 'item-2', 'unit-1', 2) as never, 'command');
    const record = history.capturePrefix();
    expect(record?.equipmentCommands).toEqual([{ tick: 1, itemId: 'item-2', unitId: 'unit-1', slot: 2 }]);
    expect(() => validateBattleRecord(record!, [])).not.toThrow();
  });
});
