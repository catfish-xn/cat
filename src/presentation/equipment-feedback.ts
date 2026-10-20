/**
 * M8 U3 (dynamic part): one wording table for equipment rejections, shared by the
 * pre-click preview (previewCombine / previewEquip) and the command-failure status line,
 * plus display helpers for readUnitEquipment(). The domain decides every reason; this
 * module only names it and never re-checks recipes, uniqueness, slots or phases.
 */
import type { EquipmentFailure, EquipPreview, UnitEquipmentView } from '../simulation/m8/ui-contracts';
import type { TemporaryEquipment } from '../simulation/m8/contracts';
import type { MatchState } from '../simulation/match-types';

/** Equipment wording for the frozen EquipmentFailure codes (M8_UI_CONTRACT §2). */
export const EQUIPMENT_FAILURE_TEXT: Readonly<Record<EquipmentFailure, string>> = {
  'wrong-phase': '当前阶段不能对该目标合成或穿戴装备',
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
  'item-restricted': '这件装备只有特定羁绊的单位可以穿戴',
};
/**
 * Codes whose command-failure text comes from this table. 'wrong-phase', 'unknown-unit'
 * and 'invalid-slot' are shared with non-equipment commands (shop slots, deployment), so
 * the status line keeps its own phase-aware wording for those.
 */
export const EQUIPMENT_COMMAND_FAILURES = ['unknown-item', 'item-not-inventory', 'invalid-recipe', 'item-slot-occupied',
  'same-item', 'unique-conflict', 'exclusive-slots', 'temporary-item', 'item-restricted'] as const satisfies readonly EquipmentFailure[];
/** Generic wording for a code this table does not name yet (a newer rules build may add codes). */
export const EQUIPMENT_FAILURE_FALLBACK = '当前无法执行该装备操作';
export const equipmentFailureText = (reason: string): string =>
  (EQUIPMENT_FAILURE_TEXT as Readonly<Record<string, string>>)[reason] ?? EQUIPMENT_FAILURE_FALLBACK;

const slotList = (slots: readonly number[]) => slots.map(slot => slot + 1).join('、');
export { slotList };

/**
 * C17: which slot a drop on a whole unit uses, from previewEquip's answers for slots 0–2 in order. A slot whose
 * preview carries `combination` (a component onto a worn component) wins; otherwise the first allowed slot; -1 when
 * every slot refuses. Only picks among the domain's answers, never decides a recipe or a slot itself.
 */
export function pickUnitDropSlot(previews: readonly EquipPreview[]): number {
  const combining = previews.findIndex(preview => preview.allowed && preview.combination !== undefined);
  return combining >= 0 ? combining : previews.findIndex(preview => preview.allowed);
}
/**
 * C18 (Bug 1, UI side until T13-A lands): the slot a drop on one slot button actually uses. When the domain says some
 * slot of this unit combines the component (previews for slots 0–2), that slot wins whichever button was hit, so a
 * second component never sits loose beside the first; otherwise the requested slot. Picks among the domain's answers only.
 */
export function routeSlotDrop(previews: readonly EquipPreview[], requested: number): number {
  const combining = previews.findIndex(preview => preview.allowed && preview.combination !== undefined);
  return combining >= 0 ? combining : requested;
}
/** The finished item an allowed preview will create in its slot, or null for a plain equip. */
export const combinationResult = (preview: EquipPreview): string | null =>
  preview.allowed && preview.combination ? preview.combination.resultDefinitionId : null;
/** Preview wording for one allowed slot: "将合成 ⟨成装名⟩" when the domain says the drop combines. */
export function allowedPreviewText(preview: Extract<EquipPreview, { allowed: true }>, slot: number, name: (definitionId: string) => string): string {
  if (preview.combination) return `将合成 ${name(preview.combination.resultDefinitionId)}（槽 ${slot + 1}）`;
  return preview.occupiedSlots.length > 1 ? `可装备 · 将占用槽 ${slotList(preview.occupiedSlots)}` : `可装备到槽 ${slot + 1}`;
}
/**
 * C17 (contract §17.2): equipment changed outside preparation enters the next battle, never the one in progress.
 * The phase is the shown state's own (an online battle replay is shown in its combat phase).
 */
export const NEXT_BATTLE_TEXT = '下场生效';
export const takesEffectNextBattle = (phase: string): boolean => phase === 'combat' || phase === 'choice' || phase === 'settlement';
export function equipSuccessText(phase: string, combinedName: string | null): string {
  const done = combinedName ? `已合成 ${combinedName}` : '装备已穿戴';
  return takesEffectNextBattle(phase) ? `${done} · ${NEXT_BATTLE_TEXT}` : done;
}

/**
 * C18 (Bug 2): one unit's equipment in the battle on the board versus now. `frozen` is the item list as it stood when
 * that battle was first shown (BoardScene's battle snapshot), `live` the current state's; both name the owner by the
 * same permanent unit id. An item worn now that the unit did not wear in the snapshot is pending: it was equipped (or
 * combined) during the battle and enters the next one. A plain comparison of two item lists, no rule is decided here.
 */
export interface BattleLoadout {
  /** Definition ids the unit fights this battle with, in slot order. */
  readonly thisBattle: readonly string[];
  /** Definition ids the unit wears now (next battle), in slot order. */
  readonly nextBattle: readonly string[];
  /** Permanent ids worn now that were not worn in the snapshot. */
  readonly pendingIds: ReadonlySet<string>;
  /** Definition ids of the pending items, in slot order. */
  readonly pending: readonly string[];
  /** The two loadouts differ (something added, combined away or removed). */
  readonly changed: boolean;
}
type Item = MatchState['items'][number];
const wornBy = (items: readonly Item[], unitId: string) => items
  .filter((item): item is Item & { location: { kind: 'unit'; unitId: string; slot: number } } => item.location.kind === 'unit' && item.location.unitId === unitId)
  .sort((a, b) => a.location.slot - b.location.slot);
/** Definition ids a unit wears in `items`, in slot order. */
export const wornDefinitions = (items: readonly Item[], unitId: string): string[] => wornBy(items, unitId).map(item => item.definitionId);
export function battleLoadout(live: readonly Item[], frozen: readonly Item[] | null, unitId: string): BattleLoadout | null {
  if (!frozen) return null;
  const now = wornBy(live, unitId), then = wornBy(frozen, unitId), thenIds = new Set(then.map(item => item.id));
  const pendingItems = now.filter(item => !thenIds.has(item.id));
  return { thisBattle: then.map(item => item.definitionId), nextBattle: now.map(item => item.definitionId),
    pendingIds: new Set(pendingItems.map(item => item.id)), pending: pendingItems.map(item => item.definitionId),
    changed: pendingItems.length > 0 || then.length !== now.length };
}
/** "本场：X / 下场：Y" for a hover, from one BattleLoadout. */
export function battleLoadoutText(loadout: BattleLoadout, name: (definitionId: string) => string): string {
  const list = (ids: readonly string[]) => ids.length ? ids.map(name).join('、') : '无';
  return `本场：${list(loadout.thisBattle)} / 下场：${list(loadout.nextBattle)}`;
}

/** Lifetime wording from the recorded round ids; the domain owns creation and removal. */
export function temporaryLifetime(item: TemporaryEquipment): string {
  return item.roundId === item.expiresAfterRoundId ? `仅 ${item.roundId} 本轮有效` : `${item.roundId} 生成，${item.expiresAfterRoundId} 结束后失效`;
}
export function temporaryItemText(item: TemporaryEquipment, name: (definitionId: string) => string, parentName: string): string {
  return `临时 · ${name(item.definitionId)}：来自 ${parentName} · 槽 ${item.slot + 1} · ${temporaryLifetime(item)} · 不可操作`;
}

/** What a piece carries beyond its worn items: slots a 3-slot item reserves, then temporary items (piece tiles, hover card). */
export interface GearExtras { readonly reserved: number; readonly temporary: readonly string[] }
export const NO_GEAR_EXTRAS: GearExtras = { reserved: 0, temporary: [] };
export function gearExtras(view: UnitEquipmentView | null): GearExtras {
  if (!view) return NO_GEAR_EXTRAS;
  return { reserved: view.slots.filter(slot => slot.reservedByItemInstanceId !== null && slot.itemInstanceId === null).length,
    temporary: view.temporaryItems.map(item => item.definitionId) };
}
/** "A、临时 B、2 槽被占用" for the hover card; empty when the piece carries nothing. */
export function gearText(worn: readonly string[], extras: GearExtras, name: (definitionId: string) => string): string {
  const parts = [...worn.map(name), ...extras.temporary.map(id => `临时 ${name(id)}`)];
  if (extras.reserved) parts.push(`${extras.reserved} 槽被占用`);
  return parts.join('、');
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
