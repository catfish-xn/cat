/**
 * C18-B: the consumable drop wording reads only the preview answer it is given (contract §18.1 draft). Until a
 * client-usable preview exists the placeholder answers `pending` for every target and never "allowed".
 */
import { describe, expect, it } from 'vitest';
import { CONSUMABLE_FAILURE_TEXT, consumableDropText, type DraftConsumable } from '../../src/presentation/orb-loot';
import { previewConsumable } from '../../src/rendering/online/fake-loot';
import { createMatch } from '../../src/simulation/match';

const remover: DraftConsumable = { consumableId: 'tool-1', definitionId: 'magnetic-remover' };
const name = (id: string) => ({ sword: '暴风大剑', bow: '反曲之弓' } as Record<string, string>)[id] ?? id;

describe('C18-B consumable preview placeholder', () => {
  it('answers pending for every target and leaves the state untouched', () => {
    const state = createMatch(7), before = JSON.stringify(state);
    for (const target of [{ kind: 'unit', unitId: 'unit-1' }, { kind: 'item', itemId: 'item-1' }, { kind: 'unit', unitId: 'nobody' }] as const)
      expect(previewConsumable(state, 'tool-1', target)).toEqual({ ok: 'pending', contract: '§18.1' });
    expect(JSON.stringify(state)).toBe(before);
  });
  it('words pending, allowed and refused answers from the preview alone', () => {
    expect(consumableDropText(remover, '艾瑞莉娅', { ok: 'pending', contract: '§18.1' }, name)).toBe('磁力拆卸器 → 艾瑞莉娅 · 能否使用待接线（合同 §18.1 previewUseConsumable）');
    expect(consumableDropText(remover, '艾瑞莉娅', { ok: true, effect: 'remove-all', affectedItemIds: ['sword', 'bow'], destination: 'inventory', affectsCurrentBattle: false }, name))
      .toBe('磁力拆卸器 → 艾瑞莉娅：将拆下 暴风大剑、反曲之弓 · 产物进入物品备战席 · 下场生效');
    for (const reason of Object.keys(CONSUMABLE_FAILURE_TEXT) as (keyof typeof CONSUMABLE_FAILURE_TEXT)[])
      expect(consumableDropText(remover, '艾瑞莉娅', { ok: false, reason }, name)).toBe(`磁力拆卸器 → 艾瑞莉娅：${CONSUMABLE_FAILURE_TEXT[reason]}`);
  });
});
