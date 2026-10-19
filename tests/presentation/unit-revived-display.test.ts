// #139: a Forge revival (unitRevived from the real reviveG23Forge) shows on the board/replay as a gold ring with a
// "复活 · 生命 N" label, and as one "X 复活 Y（生命 N）" line in the combat log and the stats event list.
import { describe, expect, it } from 'vitest';
import { reviveG23Forge } from '../../src/simulation/combat-g2-3-summons';
import { resolveAbility } from '../../src/simulation/combat-abilities';
import { EMPTY_RUNTIME, type S13Unit } from '../../src/simulation/combat-s13-state';
import { toCombatViewEvents, toCombatViewState } from '../../src/simulation/combat-replay-view';
import type { AbilityContext } from '../../src/simulation/combat-s13-abilities';
import type { CombatUnit, LedgerCombatEvent } from '../../src/simulation/combat-types';
import { DEFAULT_BOARD } from '../../src/simulation/board';
import { planFx } from '../../src/presentation/fx-plan';
import { combatEventText, viewEventLine } from '../../src/rendering/combat-feedback';
import { eventText, viewEventText } from '../../src/stats/stats-panel';
import { battle, unit } from '../combat-helpers';

function revival() {
  const base: Partial<CombatUnit> = { runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [] };
  const jayce = unit('j', 'player', 2, 4, { ...base, definitionId: 'jayce', ability: resolveAbility('jayce-ability', 1), hp: 800, maxHp: 800 }) as S13Unit;
  const forge = unit('j:g23-forge', 'player', 0, 6, { ...base, definitionId: 'g23-forge', alive: false, hp: 0, maxHp: 1000 }) as S13Unit;
  const ctx: AbilityContext = { tick: 37, combatId: 'revive', board: DEFAULT_BOARD, units: [jayce, forge], events: [], packets: [], heals: [], draw: () => { throw Error('no RNG'); } };
  reviveG23Forge(ctx, jayce);
  const revived = ctx.events.find(event => event.type === 'unitRevived')!;
  const ledger = { ...revived, domain: 'combat', combatId: 'revive', eventSeq: 5 } as unknown as LedgerCombatEvent;
  return { ledger, state: battle([jayce, forge], { tick: 37 }), forge };
}

describe('unitRevived display (#139)', () => {
  it('the engine event carries the revived unit, the reviver and the new HP', () => {
    const { ledger, forge } = revival();
    expect(ledger).toMatchObject({ type: 'unitRevived', tick: 37, unitId: 'j:g23-forge', hp: 1000, source: { ownerId: 'j' } });
    expect(forge.alive).toBe(true);
  });
  it('board and replay draw a gold ring and a "复活 · 生命 N" label at the revived unit', () => {
    const { ledger, state, forge } = revival();
    const view = toCombatViewEvents([ledger]);
    expect(view).toEqual([{ type: 'unitRevived', tick: 37, eventSeq: 5, unitId: 'j:g23-forge', hp: 1000, sourceId: 'j' }]);
    for (const [events, combat] of [[[ledger], state], [view, toCombatViewState(state)]] as const) {
      const specs = planFx(events as never, combat, false);
      expect(specs).toEqual([
        expect.objectContaining({ kind: 'ring', at: forge.cell, color: 0xffd56e }),
        expect.objectContaining({ kind: 'label', at: forge.cell, text: '复活 · 生命 1000' }),
      ]);
    }
  });
  it('combat log and stats event list each have one revive line', () => {
    const { ledger, state } = revival();
    const name = (id: string | null) => id ?? '无';
    const [view] = toCombatViewEvents([ledger]);
    expect(combatEventText(ledger, name)).toBe('第 37 刻 j · 技能 复活 j:g23-forge（生命 1000）');
    expect(viewEventLine(view, name)).toBe('第 37 刻 j 复活 j:g23-forge（生命 1000）');
    expect(eventText(ledger, state)).toBe('第 37 tick：杰斯 1星 · 技能 复活 海克斯科技锻炉 1星，生命 1000');
    expect(viewEventText(view, toCombatViewState(state))).toBe('第 37 tick：杰斯 1星 复活 海克斯科技锻炉 1星，生命 1000');
  });
});
