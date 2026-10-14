/**
 * C18-B: the panel's target answers for consumables (contract §18.8 01). Online the display state is the private seat
 * view and the answer comes from its `consumableTargets` projection only; offline it is the rules' previewUseConsumable
 * on the real state. Both must agree with the authority for every candidate, and a target the projection does not list
 * is never usable. The drop wording reads only that answer. Tool states come from Codex's public-command fixture.
 */
import { describe, expect, it } from 'vitest';
import { consumableDropText, consumableEventText, CONSUMABLE_FAILURE_TEXT } from '../../src/presentation/orb-loot';
import { previewConsumable, readConsumables } from '../../src/rendering/online/loot-fields';
import { toDisplayMatch } from '../../src/rendering/online/seat-view-adapter';
import { previewUseConsumable } from '../../src/simulation/consumables';
import { toPrivateSeatView } from '../../src/server-entry';
import type { ConsumableTarget } from '../../src/simulation/consumable-types';
import type { MatchState } from '../../src/simulation/match-types';
import { publicConsumables } from '../fixtures/r3r4-public';

const candidates = (state: MatchState): ConsumableTarget[] => [
  ...state.preparation.units.filter(unit => unit.team === 'player').map(unit => ({ kind: 'unit' as const, unitId: unit.id })),
  ...state.items.map(item => ({ kind: 'item' as const, itemId: item.id })),
];

describe('C18-B consumable target answers', () => {
  const state = publicConsumables(26);
  it('the fixture holds tools of every kind (precondition)', () => {
    expect(state.consumables.length).toBeGreaterThan(0);
  });
  it('online: the seat view answer equals the authority for every candidate, without reading the authority', () => {
    const display = toDisplayMatch(toPrivateSeatView(state));
    expect(readConsumables(display)).toEqual(state.consumables.map(tool => ({ consumableId: tool.consumableId, definitionId: tool.definitionId })));
    let allowed = 0;
    for (const tool of state.consumables) for (const target of candidates(state)) {
      const authority = previewUseConsumable(state, tool.consumableId, target), shown = previewConsumable(display, tool.consumableId, target);
      expect(shown, `${tool.definitionId} → ${JSON.stringify(target)}`).toEqual(authority);
      if (shown.ok) allowed++;
    }
    expect(allowed).toBeGreaterThan(0);
  });
  it('online: targets the projection does not list (enemy, unknown, consumed tool) are not usable', () => {
    const display = toDisplayMatch(toPrivateSeatView(state)), tool = state.consumables[0]!;
    expect(previewConsumable(display, tool.consumableId, { kind: 'unit', unitId: 'no-such-unit' })).toEqual({ ok: false, reason: 'invalid-consumable-target' });
    const mine = state.preparation.units.find(unit => unit.team === 'player')!;
    expect(previewConsumable(display, 'no-such-tool', { kind: 'unit', unitId: mine.id })).toEqual({ ok: false, reason: 'unknown-consumable' });
  });
  it("offline: the answer is the rules' own preview on the real state, which stays untouched", () => {
    const before = JSON.stringify(state);
    for (const tool of state.consumables) for (const target of candidates(state))
      expect(previewConsumable(state, tool.consumableId, target)).toEqual(previewUseConsumable(state, tool.consumableId, target));
    expect(JSON.stringify(state)).toBe(before);
  });
  it('words an allowed answer from affectedItemIds and a refusal from the §18.8 table; next-battle only outside preparation', () => {
    const remover = { consumableId: 't', definitionId: 'magnetic-remover' } as const, name = (id: string) => ({ a: '暴风大剑', b: '反曲之弓' } as Record<string, string>)[id] ?? id;
    const ok = { ok: true, effect: 'remove-all', affectedItemIds: ['a', 'b'], destination: 'inventory', affectsCurrentBattle: false } as const;
    expect(consumableDropText(remover, '艾瑞莉娅', ok, name, 'preparation')).toBe('拆卸器 → 艾瑞莉娅：将拆下 暴风大剑、反曲之弓，放回物品备战席');
    expect(consumableDropText(remover, '艾瑞莉娅', ok, name, 'combat')).toBe('拆卸器 → 艾瑞莉娅：将拆下 暴风大剑、反曲之弓，放回物品备战席 · 下场生效');
    expect(consumableDropText({ consumableId: 't', definitionId: 'component-reforger' }, '暴风大剑', { ...ok, effect: 'reforge-component', affectedItemIds: ['a'] }, name, 'settlement'))
      .toBe('组件重铸器 → 暴风大剑：将重铸 暴风大剑（结果随机），产物进入物品备战席 · 下场生效');
    for (const reason of Object.keys(CONSUMABLE_FAILURE_TEXT) as (keyof typeof CONSUMABLE_FAILURE_TEXT)[])
      expect(consumableDropText(remover, '艾瑞莉娅', { ok: false, reason }, name, 'combat')).toBe(`拆卸器 → 艾瑞莉娅：${CONSUMABLE_FAILURE_TEXT[reason]}`);
  });
  it('record lines for reforge and removal; consumableUsed adds none', () => {
    const names = { item: (id: string) => id === 'i1' ? '暴风大剑' : id, unit: () => '艾瑞莉娅' };
    expect(consumableEventText({ type: 'itemReforged', itemId: 'i1', definitionId: 'sword', outputItemId: 'i9', outputDefinitionId: 'bow', consumableId: 't' } as never, names)).toMatch(/^重铸：.+ → .+$/);
    expect(consumableEventText({ type: 'itemsRemoved', unitId: 'u1', itemIds: ['i1'] } as never, names)).toBe('拆卸：艾瑞莉娅 卸下 暴风大剑');
    expect(consumableEventText({ type: 'consumableUsed' } as never, names)).toBeNull();
  });
});
