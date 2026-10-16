import { describe, expect, it } from 'vitest';
import { mirrorCombatReplay } from '../../src/server/room/projection';
import { toCombatViewState } from '../../src/simulation/combat-replay-view';
import { battle, unit } from '../combat-helpers';

describe('G2-3 mid-combat units in the mirrored replay', () => {
  it('flips the entered unit and the spawn fact for the enemy-side viewer', () => {
    const initial = toCombatViewState(battle([unit('a', 'player', 1, 4), unit('b', 'enemy', 1, 3)]));
    const entered = toCombatViewState(battle([unit('m', 'player', 5, 6)])).units[0];
    const mirrored = mirrorCombatReplay({ initial, terminal: initial, ticks: [{ tick: 3, events: [
      { domain: 'combat', combatId: 'c', tick: 3, eventSeq: 0, type: 'unitSpawned', unitId: 'm', definitionId: 'sentinel', team: 'player', cell: { col: 5, row: 6 }, sourceId: 'a' },
      { type: 'unitEntered', unit: entered },
    ] as never }] });
    const [spawn, enter] = mirrored.ticks[0].events as never as [{ team: string; cell: object }, { unit: { team: string; cell: object } }];
    expect(spawn).toMatchObject({ team: 'enemy', cell: { col: 5, row: 1 } });
    expect(enter.unit).toMatchObject({ team: 'enemy', cell: { col: 5, row: 1 } });
  });
});
