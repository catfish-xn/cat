/**
 * C18-B: the panel's consumable answers are the server's `consumableTargets` rows (contract §18.8 SR-C18-01), read off
 * the display state by value; a target the server did not list is unusable. The drop wording reads that answer alone.
 */
import { describe, expect, it } from 'vitest';
import { CONSUMABLE_DEFINITIONS, toPrivateSeatView } from '../../src/server-entry';
import { CONSUMABLE_FAILURE_TEXT, consumableDropText, type ConsumableInstance } from '../../src/presentation/orb-loot';
import { consumableAnswer, readConsumables } from '../../src/rendering/online/seat-loot';
import { toDisplayMatch } from '../../src/rendering/online/seat-view-adapter';
import { equipItem } from '../../src/simulation/match';
import { accepted, publicConsumables } from '../fixtures/r3r4-public';

const remover: ConsumableInstance = { consumableId: 'tool-1', definitionId: 'magnetic-remover' };
const name = (id: string) => ({ sword: '暴风大剑', bow: '反曲之弓' } as Record<string, string>)[id] ?? id;

function seat() {
  let state = publicConsumables(162);
  const parent = state.items.find(item => item.definitionId === 'thiefs-gloves')!;
  const holder = state.preparation.units.find(unit => unit.team === 'player')!;
  state = accepted(equipItem(state, parent.id, holder.id, 0));
  return { state, view: toPrivateSeatView(state), holder, parent };
}

describe('C18-B consumable answers from consumableTargets', () => {
  it('reads every listed target exactly as the server answered it, without touching the state', () => {
    const { state, view } = seat();
    const display = toDisplayMatch(view), before = JSON.stringify(display);
    expect(readConsumables(display)).toEqual(view.consumables);
    expect(view.consumables.length).toBeGreaterThan(0);
    for (const row of view.consumableTargets) {
      const tool = view.consumables.find(entry => entry.consumableId === row.consumableId)!;
      for (const shown of row.targets) expect(consumableAnswer(display, row.consumableId, shown.target)).toEqual(shown.allowed
        ? { ok: true, effect: CONSUMABLE_DEFINITIONS[tool.definitionId].effect, affectedItemIds: shown.affectedItemIds }
        : { ok: false, reason: shown.reason });
    }
    expect(JSON.stringify(display)).toBe(before);
    // Offline (no consumableTargets) there is no shelf; the authoritative state is never previewed here.
    expect(readConsumables(state)).toBeNull();
  });
  it('treats a missing row or target as not listed', () => {
    const { view, holder, parent } = seat();
    const display = toDisplayMatch(view);
    const tool = view.consumables.find(entry => entry.definitionId === 'magnetic-remover')!;
    expect(consumableAnswer(display, tool.consumableId, { kind: 'unit', unitId: holder.id })).toEqual({ ok: true, effect: 'remove-all', affectedItemIds: [parent.id] });
    expect(consumableAnswer(display, tool.consumableId, { kind: 'unit', unitId: 'enemy-or-gone' })).toEqual({ ok: false, reason: 'not-listed' });
    expect(consumableAnswer(display, 'consumed-tool', { kind: 'unit', unitId: holder.id })).toEqual({ ok: false, reason: 'not-listed' });
  });
  it('words allowed, refused and unlisted answers from the answer alone', () => {
    expect(consumableDropText(remover, '艾瑞莉娅', { ok: true, effect: 'remove-all', affectedItemIds: ['sword', 'bow'] }, name))
      .toBe('拆卸器 → 艾瑞莉娅：将拆下 暴风大剑、反曲之弓 · 产物进入物品备战席 · 下场生效');
    for (const reason of Object.keys(CONSUMABLE_FAILURE_TEXT) as (keyof typeof CONSUMABLE_FAILURE_TEXT)[])
      expect(consumableDropText(remover, '艾瑞莉娅', { ok: false, reason }, name)).toBe(`拆卸器 → 艾瑞莉娅：${CONSUMABLE_FAILURE_TEXT[reason]}`);
    expect(consumableDropText(remover, '敌方', { ok: false, reason: 'not-listed' }, name)).toBe(`拆卸器 → 敌方：${CONSUMABLE_FAILURE_TEXT['invalid-consumable-target']}`);
  });
});
