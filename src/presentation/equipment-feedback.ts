/**
 * M8 U3 (dynamic part): one wording table for equipment rejections, shared by the
 * pre-click preview (previewCombine / previewEquip) and the command-failure status line,
 * plus display helpers for readUnitEquipment(). The domain decides every reason; this
 * module only names it and never re-checks recipes, uniqueness, slots or phases.
 */
import type { EquipmentFailure, UnitEquipmentView } from '../simulation/m8/ui-contracts';
import type { TemporaryEquipment } from '../simulation/m8/contracts';

/** Equipment wording for the frozen EquipmentFailure codes (M8_UI_CONTRACT §2). */
export const EQUIPMENT_FAILURE_TEXT: Readonly<Record<EquipmentFailure, string>> = {
  'wrong-phase': '只能在准备阶段合成或穿戴装备',
  'unknown-item': '该物品已不存在，请重新选择',
  'unknown-unit': '未找到该单位，只能装备到我方单位',
  'same-item': '不能拿同一件物品与自己合成，请选两件不同的组件',
  'item-not-inventory': '只能使用物品备战席中的装备',
  'invalid-recipe': '这两件物品没有对应的合成配方',
  'invalid-slot': '装备槽位无效',
  'item-slot-occupied': '该装备槽已有装备',
  'unique-conflict': '该单位已有同名的唯一装备，同一单位只能装备一件',
  'exclusive-slots': '独占全部装备槽的装备不能与其他装备同时穿戴',
  'temporary-item': '临时装备由本轮自动生成，不能合成、穿戴或单独移动',
};
/**
 * Codes whose command-failure text comes from this table. 'wrong-phase', 'unknown-unit'
 * and 'invalid-slot' are shared with non-equipment commands (shop slots, deployment), so
 * the status line keeps its own phase-aware wording for those.
 */
export const EQUIPMENT_COMMAND_FAILURES = ['unknown-item', 'item-not-inventory', 'invalid-recipe', 'item-slot-occupied',
  'same-item', 'unique-conflict', 'exclusive-slots', 'temporary-item'] as const satisfies readonly EquipmentFailure[];
export const equipmentFailureText = (reason: EquipmentFailure): string => EQUIPMENT_FAILURE_TEXT[reason];

const slotList = (slots: readonly number[]) => slots.map(slot => slot + 1).join('、');
export { slotList };

/** Lifetime wording from the recorded round ids; the domain owns creation and removal. */
export function temporaryLifetime(item: TemporaryEquipment): string {
  return item.roundId === item.expiresAfterRoundId ? `仅 ${item.roundId} 本轮有效` : `${item.roundId} 生成，${item.expiresAfterRoundId} 结束后失效`;
}
export function temporaryItemText(item: TemporaryEquipment, name: (definitionId: string) => string, parentName: string): string {
  return `临时 · ${name(item.definitionId)}：来自 ${parentName} · 槽 ${item.slot + 1} · ${temporaryLifetime(item)} · 不可操作`;
}

/** Per-slot display state for one unit, straight from readUnitEquipment(). */
export interface SlotView {
  readonly slot: 0 | 1 | 2;
  readonly itemInstanceId: string | null;
  readonly reservedByItemInstanceId: string | null;
  readonly temporary: TemporaryEquipment | null;
}
export function slotViews(view: UnitEquipmentView): SlotView[] {
  return view.slots.map(entry => ({ slot: entry.slot, itemInstanceId: entry.itemInstanceId, reservedByItemInstanceId: entry.reservedByItemInstanceId,
    temporary: view.temporaryItems.find(item => item.slot === entry.slot) ?? null }));
}
