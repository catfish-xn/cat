import { describe, expect, it } from 'vitest';
import { summarizeBattle } from '../src/simulation/combat-summary';
import { toCombatViewState, type CombatReplay } from '../src/simulation/combat-replay-view';
import { rankBattle, rankLiveBattle } from '../src/presentation/battle-ranking';
import { battle, freeze, unit } from './combat-helpers';

function removedSummon(): CombatReplay {
  const owner = unit('owner', 'player', 2, 4), mini = unit('mini', 'player', 3, 4), enemy = unit('enemy', 'enemy', 2, 3);
  const initial = toCombatViewState(battle([owner, mini, enemy], { combatId: 'stage5-removal' }));
  const terminal = toCombatViewState(battle([owner, { ...enemy, alive: false, hp: 0 }], { combatId: 'stage5-removal', tick: 293 }));
  return freeze({ initial, terminal, ticks: [{ tick: 293, events: [
    { type: 'heal', tick: 293, eventSeq: 0, targetId: 'owner', actual: 7, shares: [{ sourceId: 'mini', actual: 7 }] },
    { type: 'unitLeft', tick: 293, eventSeq: 1, unitId: 'mini' },
  ] }] });
}
describe('stage-5 removed summon display accounting', () => {
  it('keeps a removed opening unit and its contributions without dereferencing a missing terminal unit', () => {
    const replay = removedSummon(), before = JSON.stringify(replay);
    const rows = summarizeBattle(replay);
    expect(rows.map(row => [row.unitId, row.alive])).toEqual([['owner', true], ['mini', false], ['enemy', false]]);
    expect(rows.find(row => row.unitId === 'mini')!.healingDone).toBe(7);
    expect(rows.find(row => row.unitId === 'owner')!.healingReceived).toBe(7);
    expect(JSON.stringify(replay)).toBe(before);
  });
  it('handles the online live-prefix path and the completed ranking with the same removed-unit row', () => {
    const replay = removedSummon();
    const streaming = { ...replay, ticks: [...replay.ticks, { tick: 294, events: [] }], terminal: replay.initial };
    const live = rankLiveBattle(streaming, 1, replay.terminal);
    const ended = rankBattle({ ...replay, terminal: { ...replay.terminal, status: 'finished', result: 'playerWin' } });
    expect(live.rows).toEqual(ended.rows);
    expect(live.rows.find(row => row.unitId === 'mini')).toMatchObject({ alive: false, healingDone: 7 });
  });
});
