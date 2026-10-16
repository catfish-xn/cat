import { displayUnitName } from './display-names';
export { displayUnitName } from './display-names';
import { readRoundInfo } from '../simulation/round-selectors';
import { encounterPreviewSection } from '../presentation/encounter-preview';
import { UNIT_DEFINITIONS } from '../simulation/units';
import { CONSUMABLE_DEFINITIONS } from '../simulation/content/consumables';
import type { ConsumableDefinitionId } from '../simulation/consumable-types';
import { ITEM_DEFINITIONS } from '../simulation/content/items';
import { readRevealedLoot } from './online/seat-view-adapter';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import { AUGMENT_DEFINITIONS } from '../simulation/content/augments';
import { ANOMALY_DEFINITIONS } from '../simulation/content/anomalies';
import { deriveTraits } from '../simulation/trait-snapshot';
import { getUnitStats, getXpToNextLevel, getShopOdds, needsAnomalyRecruitment } from '../simulation/match';
import type { MatchEvent, MatchState } from '../simulation/match-types';
import type { UnitLocation } from '../simulation/units';
import type { CombatOrigin } from '../simulation/combat-types';
import type { CombatState } from '../simulation/combat-types';
import { isLedgerEvent, type CombatViewState, type SceneCombatEvent } from '../presentation/combat-display';
import { readCombatStats } from '../simulation/combat-s13';
import { getInterestGold } from '../simulation/economy';
import { combatEventText, originLabel, viewEventLine } from './combat-feedback';
import { readUnitStatusRows, shieldSource, statusRowText, ticksToSeconds } from '../presentation/combat-status';
import { InputRouter, type Gesture } from './input-router';
import { getDeploymentCap } from '../simulation/match';
import { getPlayerDeploymentCount } from '../simulation/game';
import { getHeroIdentity, heroEmblemSvg, heroTraitTags, traitDisplayName } from '../presentation/hero-identity';
import { abilityNameOf } from '../presentation/ability-text';
import { heroPortraitHtml, s13IconHtml } from '../presentation/s13-assets';
import { augmentDisplayName, augmentIconHtml, augmentPlayerDescription } from '../presentation/augment-display';
import { describeEffect, describeTraitTier, term } from '../presentation/effect-text';
import { traitHoverCard } from '../presentation/hover-card';
import { attachUnitCards } from '../presentation/unit-card';
import { TraitColumn } from './trait-column';
import { attachItemPopover, catalogEntry, createItemCodex, itemDescriptions, itemMarkHtml, itemTags } from '../presentation/item-codex';
import { previewCombine, previewEquip, readUnitEquipment } from '../simulation/item-selectors';
import { allowedPreviewText, battleLoadout, battleLoadoutText, combinationResult, equipmentFailureText, NEXT_BATTLE_TEXT, pickUnitDropSlot, routeSlotDrop, slotList, slotViews, temporaryItemText, type BattleLoadout } from '../presentation/equipment-feedback';
import type { EquipPreview } from '../simulation/m8/ui-contracts';
import { readEncounterPreview, readLootView } from '../simulation/match';
import { appendLootStatus, continueBlockText, lootPanelSection, lootRevealedSection, lootTerminalSummary } from '../presentation/loot-view';
import { isEmptyShopSlot } from './online/pool-feedback';
import { previewConsumable, readConsumables, readOrbLoot } from './online/loot-fields';
import { consumableDropText, consumableEventText, consumableName, consumableShelf, consumableTargetHint, orbLootSection, routeToolUnitDrop } from '../presentation/orb-loot';
import type { ConsumableInstance, ConsumableTarget } from '../simulation/consumable-types';

type ControlName = 'reroll' | 'buy-xp' | 'sell' | 'start-combat' | 'continue' | 'new-match';
const PHASE_LABEL: Readonly<Record<MatchState['phase'], string>> = { preparation: '准备阶段', choice: '构筑选择', combat: '战斗中', settlement: '回合结算', gameOver: '对局结束' };
const PHASE_HINT: Readonly<Record<MatchState['phase'], string>> = {
  preparation: '购买、部署、装备后，点击开始战斗', choice: '完成三选一后继续运营', combat: '自动战斗进行中 · 等待本轮结算',
  settlement: '收入与经验已到账 · 点击继续进入下一回合', gameOver: '本局结束 · 点击新局重新开始',
};
/** Online outside preparation: what stays open. Equipment legality is per target, read from previewEquip. */
const ONLINE_OPS_TEXT = '可购买、刷新、买经验、整理备战席；装备以单位提示为准';
/** Status line when nothing can be operated outside preparation (single player). */
const IDLE_STATUS: Partial<Record<MatchState['phase'], string>> = { combat: '自动战斗进行中 · 等待本轮结算', settlement: '本轮已结算 · 点击继续进入下一回合' };
/** Online (`?mode=online`): the server advances phases and there is no local 新局, so the single-player calls to action change. */
const ONLINE_PHASE_LABEL: Partial<Record<MatchState['phase'], string>> = { gameOver: '对局结束' };
const ONLINE_PHASE_HINT: Partial<Record<MatchState['phase'], string>> = {
  preparation: '购买、部署、装备 · 倒计时结束自动开战', combat: `战斗中 · ${ONLINE_OPS_TEXT}`, settlement: '收入与经验已到账 · 可继续购买 · 稍后自动进入下一回合', gameOver: '对局结束 · 查看排名',
};
const isOnline = () => typeof document !== 'undefined' && document.body.dataset.online !== undefined;
/** The room ended (all other seats out, or I was eliminated) even when my own MatchState is still mid-round. */
const isOnlineEnded = () => isOnline() && document.body.dataset.onlineMode === 'online-ended';
const ONLINE_END_TEXT = '对局结束 · 查看排名';
/** My seat is out but the match goes on (C5): watch only, every command control is disabled. */
const isOnlineSpectating = () => isOnline() && document.body.dataset.onlineSpectating === 'true';
const ONLINE_SPECTATE_TEXT = '已淘汰 · 观战中 · 点击右侧玩家查看阵容';

interface PanelActions {
  readonly state: () => MatchState;
  /** C6: the battle on the board (offline and online) and, offline only, the engine state behind it. */
  readonly combat: () => { readonly view: CombatViewState | null; readonly runtime: CombatState | null };
  /** C18: the item list as it stood when the battle on the board was first shown (null when none is shown). */
  readonly battleItems: () => MatchState['items'] | null;
  readonly shopLock: (locked: boolean, generation: number) => void;
  readonly selectedUnit: () => string | null;
  readonly selectUnit: (id: string) => void;
  readonly combine: (a: string, b: string) => void;
  /** `combinedName`: the finished item previewEquip says this equip creates in the slot (C17), for the success text. */
  readonly equip: (item: string, unit: string, slot: number, combinedName?: string) => void;
  /** C18-B (§18.3): send useConsumable; the panel calls it only when the target answer is ok (the rules check again). */
  readonly useConsumable: (consumableId: string, target: ConsumableTarget, success: string) => void;
  readonly choose: (choice: string, generation: number, definition: string) => void;
  readonly target: (choice: string, generation: number, unit: string) => void;
  readonly rerollAnomaly: (choice: string, generation: number) => void;
  readonly buy: (slot: number, generation: number) => void;
  readonly deploy: (id: string, location: UnitLocation) => void;
  readonly control: (name: ControlName) => void;
  readonly unitAt: (x: number, y: number) => string | undefined;
  readonly cancelGesture: () => void;
  readonly status: (message: string) => void;
  readonly help: () => void;
  readonly highlight: (unitIds: readonly string[]) => void;
}

function traitLine(definitionId: string): HTMLElement {
  const line = element('span', '', 'shop-trait');
  for (const label of heroTraitTags(definitionId)) line.append(element('span', label.name, label.open ? 'trait-open' : 'trait-closed'));
  return line;
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
export { describeEffect, describeTraitTier };
/** A finished item's name from the content table (C17 combine preview); never assembled from a recipe here. */
const itemDefinitionName = (id: string) => ITEM_DEFINITIONS[id]?.name ?? id;
/** C18-B: a tool whose content-table target kind is a unit (the remover). */
const unitTool = (tool: { readonly definitionId: string }) => CONSUMABLE_DEFINITIONS[tool.definitionId as ConsumableDefinitionId]?.targetKind === 'unit';
const definitionName = (id: string) => (UNIT_DEFINITIONS[id] ? displayUnitName(id) : undefined) ?? ITEM_DEFINITIONS[id]?.name ?? (TRAIT_DEFINITIONS[id] ? traitDisplayName(id) : undefined) ?? (AUGMENT_DEFINITIONS[id] ? augmentDisplayName(id) : undefined) ?? ANOMALY_DEFINITIONS[id]?.name ?? '未知来源';
const CHOICE_POINTER_QUIET_MS = 400;
const LIFECYCLE_QUIET_MS = 400;
const LIFECYCLE: ReadonlySet<string> = new Set(['start-combat', 'continue', 'new-match']);

/** Accessible DOM view over the same Match commands; it owns no game state. */
export class StrategyPanel {
  private readonly root: HTMLElement;
  private readonly modal: HTMLElement;
  private readonly disposers: (() => void)[] = [];
  /** G2: always-visible trait column above the panel (its own mount, so render() replacing the panel keeps it). */
  private readonly traitColumn: TraitColumn;
  private selectedItems: string[] = [];
  /** C18-B: the consumable picked for targeting (use not wired yet, contract §18.1). */
  private selectedConsumable: string | null = null;
  private tab: 'traits' | 'items' | 'units' | 'builds' | 'events' = 'items';
  private lastCombatTick = -1;
  private lastCombatId: string | undefined;
  private eventList: HTMLElement | null = null;
  private eventTexts: string[] = [];
  private eventCombatId: string | undefined;
  private pointerPosition: { x: number; y: number } | null = null;
  /** `tool` (C18-B): a consumable being dragged; its drop only names the target, no command is sent yet (§18.1). */
  private itemDrag: { gesture: Gesture; x: number; y: number; moved: boolean; element: HTMLElement; target?: string; tool?: ConsumableInstance } | null = null;
  private choiceToken = '';
  private lifecycleGuard: { at: number; name: ControlName } | null = null;
  private dismissalTimer: number | null = null;
  private focusFrame: number | null = null;
  private combatText: HTMLElement | null = null;
  private lootSection: HTMLElement | null = null;
  private lootKey = '';
  private statusText: HTMLElement | null = null;
  /** Static B4 catalogue view; built once so its filter and open state survive re-renders. */
  private codex: HTMLElement | null = null;
  /** Enemy-preview open state chosen by the player for the current round only. */
  private previewOpen: { round: number; open: boolean } | null = null;

  /** @param shopDock Optional mount for the HUD chips, economy buttons and shop (online TFT layout); null keeps them in the panel. */
  constructor(private readonly actions: PanelActions, private readonly router: InputRouter, private readonly shopDock: HTMLElement | null = null) {
    this.root = document.getElementById('strategy-root')!; this.root.tabIndex = -1;
    if (this.shopDock) this.shopDock.classList.add('shop-dock');
    this.modal = element('section', '', 'choice-overlay');
    this.modal.setAttribute('role', 'dialog'); this.modal.setAttribute('aria-modal', 'true');
    this.modal.setAttribute('aria-label', '构筑选择'); this.modal.tabIndex = -1; this.modal.hidden = true;
    document.body.append(this.modal);
    this.disposers.push(attachItemPopover(this.root));
    this.traitColumn = new TraitColumn(this.root.parentElement ?? document.body, this.root, traitHoverCard());
    this.disposers.push(() => this.traitColumn.dispose(), attachUnitCards(this.root));
    if (this.shopDock) this.disposers.push(attachUnitCards(this.shopDock));
    const choiceVisible = () => !this.modal.hidden && getComputedStyle(this.modal).display !== 'none';
    // The help dialog sits above every game layer: while it is open the choice is inert and never takes focus.
    const helpOpen = () => document.body.dataset.helpOpen === 'true';
    const tabWithinChoice = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !choiceVisible() || helpOpen()) return;
      // Only Tab belongs to the focus boundary. D/F/E and repeat still reach the
      // existing domain command handlers without a timer or key suppression.
      const targets = Array.from(this.modal.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const index = targets.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      if (!targets.length) this.modal.focus({ preventScroll: true });
      else targets[index < 0 ? (event.shiftKey ? targets.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length].focus({ preventScroll: true });
    };
    const retainChoiceFocus = (event: FocusEvent) => {
      if (choiceVisible() && !helpOpen() && !this.modal.contains(event.target as Node)) this.focusChoice();
    };
    document.addEventListener('keydown', tabWithinChoice, true);
    document.addEventListener('focusin', retainChoiceFocus, true);
    // Candidate activation may await archive reads after the choice DOM exists.
    // React to the mode commit instead of assuming a single animation frame is
    // late enough to move focus into an import-hidden dialog.
    const modeObserver = new MutationObserver(() => {
      this.modal.inert = helpOpen();
      if (!this.modal.contains(document.activeElement)) this.focusChoice();
    });
    modeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-m6-mode', 'data-help-open'] });
    this.disposers.push(() => {
      document.removeEventListener('keydown', tabWithinChoice, true);
      document.removeEventListener('focusin', retainChoiceFocus, true);
      modeObserver.disconnect();
      if (this.focusFrame !== null) cancelAnimationFrame(this.focusFrame);
      this.focusFrame = null;
    });
    const trackPointer = (event: PointerEvent) => {
      this.pointerPosition = event.pointerType === 'touch' ? null : { x: event.clientX, y: event.clientY };
    };
    const move = (event: PointerEvent) => {
      trackPointer(event);
      const drag = this.itemDrag;
      if (!drag || event.pointerId !== drag.gesture.pointerId || !this.router.owns(drag.gesture)) return;
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) >= 6) drag.moved = true;
      if (!drag.moved) return;
      drag.element.classList.add('dragging');
      if (drag.tool) {
        const target = this.toolTarget(drag.tool, event.clientX, event.clientY), key = target ? JSON.stringify(target.target) : '';
        if (key === drag.target) return;
        drag.target = key;
        this.actions.status(target ? this.toolDropText(drag.tool, target) : `拖动${consumableName(drag.tool.definitionId)}到我方单位或装备上`);
        return;
      }
      // C17: over a unit or a slot, name what a drop there would do (previewEquip's answer); elsewhere the drag hint.
      const target = this.dropTarget(event.clientX, event.clientY), key = target ? `${target.unitId}:${target.slot ?? '*'}` : '';
      if (key === drag.target) return;
      drag.target = key;
      this.actions.status(target ? this.dropPreviewText(drag.gesture.id, target.unitId, target.slot) : '拖动物品到单位或空装备槽 · E 不会出售单位');
    };
    const release = (event: PointerEvent) => {
      const drag = this.itemDrag;
      if (!drag || event.pointerId !== drag.gesture.pointerId) return;
      this.itemDrag = null; drag.element.classList.remove('dragging');
      if (!this.router.release(drag.gesture)) return;
      if (drag.element.hasPointerCapture(event.pointerId)) drag.element.releasePointerCapture(event.pointerId);
      if (drag.tool) {
        if (!drag.moved) { this.selectConsumable(drag.tool.consumableId); return; }
        const target = this.toolTarget(drag.tool, event.clientX, event.clientY);
        if (target) this.useTool(drag.tool, target); else this.actions.status('消耗品未使用 · 请放到我方单位或装备上');
        return;
      }
      if (!drag.moved) { this.selectItem(drag.gesture.id); return; }
      const target = this.dropTarget(event.clientX, event.clientY);
      if (!target) { this.actions.status('物品未装备 · 请放到我方单位或空装备槽'); return; }
      if (target.slot !== null) { this.equipAt(drag.gesture.id, target.unitId, target.slot); return; }
      // Dropped on a board piece: a slot whose preview combines wins (C17), else the first slot the domain accepts.
      const previews = this.unitPreviews(drag.gesture.id, target.unitId), slot = pickUnitDropSlot(previews);
      if (slot >= 0) { this.equipAt(drag.gesture.id, target.unitId, slot); return; }
      this.actions.status(this.unitRefusalText(previews));
    };
    const cancel = () => this.actions.cancelGesture();
    const cancelPointer = (event: PointerEvent) => {
      if (this.router.current?.kind === 'unit' || this.itemDrag?.gesture.pointerId === event.pointerId) cancel();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', release);
    window.addEventListener('pointerdown', trackPointer, true);
    window.addEventListener('pointercancel', cancelPointer, true); window.addEventListener('resize', cancel);
    window.addEventListener('touchcancel', cancel, true);
    window.addEventListener('blur', cancel); window.addEventListener('scroll', cancel, true);
    this.disposers.push(() => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', release);
      window.removeEventListener('pointerdown', trackPointer, true);
      window.removeEventListener('pointercancel', cancelPointer, true); window.removeEventListener('resize', cancel);
      window.removeEventListener('touchcancel', cancel, true);
      window.removeEventListener('blur', cancel); window.removeEventListener('scroll', cancel, true);
    });
    this.modal.addEventListener('pointerdown', event => {
      event.stopPropagation();
      if (this.dismissalTimer !== null) this.shieldChoiceDismissal();
    });
    // Phaser also consumes native mouse/touch events bubbling to window.
    // Isolate both the dialog and its dismissal shield at those entry points,
    // while leaving DOM click activation and keyboard commands intact.
    for (const type of ['click', 'mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchmove', 'touchend', 'touchcancel'])
      this.modal.addEventListener(type, event => event.stopPropagation());
  }

  get blocksSell(): boolean {
    if (this.router.current?.kind === 'item') return true;
    // Re-resolve geometry after synchronous D/F rebuilds. No mouse movement or
    // new pointerover event is required to keep the panel from selling behind it.
    const point = this.pointerPosition;
    return Boolean(point && document.elementFromPoint(point.x, point.y)?.closest('[data-items]'));
  }
  cancel(): void {
    if (this.itemDrag) {
      const { element: target, gesture } = this.itemDrag;
      target.classList.remove('dragging');
      if (target.hasPointerCapture(gesture.pointerId)) target.releasePointerCapture(gesture.pointerId);
      this.itemDrag = null;
    }
  }
  reset(): void { this.eventTexts = []; this.eventCombatId = undefined; this.lastCombatTick = -1; this.lastCombatId = undefined; this.cancel(); this.clearChoiceDismissal(); this.selectedItems = []; this.selectedConsumable = null; this.choiceToken = ''; this.previewOpen = null; }
  destroy(): void { this.cancel(); this.clearChoiceDismissal(); this.disposers.forEach(dispose => dispose()); this.root.replaceChildren(); this.shopDock?.replaceChildren(); this.modal.remove(); }
  status(message: string): void { if (this.statusText) this.statusText.textContent = message; }
  /** Owned augment: icon + zh name; hovering shows the authored effect text. */
  private augmentChip(id: string): HTMLElement {
    const chip = element('span', augmentDisplayName(id), 'augment-chip');
    chip.dataset.augment = id; chip.title = `${augmentDisplayName(id)}\n${AUGMENT_DEFINITIONS[id]?.effects.map(describeEffect).join('；') ?? ''}`;
    chip.insertAdjacentHTML('afterbegin', augmentIconHtml(id, 20));
    return chip;
  }
  private button(name: string, label: string, action: () => void, disabled = false): HTMLButtonElement {
    const button = element('button', label); button.type = 'button'; button.dataset.debug = name; button.disabled = disabled;
    button.addEventListener('click', action);
    return button;
  }
  /** Online (T10, contract §15.1): the shop, XP and shop lock stay open through my battle, the choice window and the settlement. */
  private operable(state: MatchState): boolean {
    if (isOnlineSpectating()) return false;
    return state.phase === 'preparation' || (isOnline() && !isOnlineEnded() && (state.phase === 'combat' || state.phase === 'choice' || state.phase === 'settlement'));
  }
  /**
   * Item cards and slots are live whenever this seat can send commands at all. No phase check here: whether an item
   * combines, and which unit and slot it fits, in any phase, is previewCombine / previewEquip's answer alone.
   */
  private itemsOpen(): boolean { return !isOnlineSpectating() && !isOnlineEnded(); }
  /**
   * A chosen slot: send only what previewEquip accepts, otherwise name its reason. C18: when the domain says another
   * slot of this unit combines the component, the drop goes there (routeSlotDrop), whichever slot button was hit.
   */
  private equipAt(itemId: string, unitId: string, slot: number): void {
    const previews = this.unitPreviews(itemId, unitId), target = routeSlotDrop(previews, slot);
    const preview = previews[target], combined = combinationResult(preview);
    if (preview.allowed) this.actions.equip(itemId, unitId, target, combined ? itemDefinitionName(combined) : undefined);
    else this.actions.status(equipmentFailureText(preview.reason));
  }
  /** Where an item drag points: a slot button of the equipment panel, or a piece on the board (slot chosen on drop). */
  private dropTarget(x: number, y: number): { unitId: string; slot: number | null } | null {
    const slot = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-equip-unit]');
    if (slot?.dataset.equipUnit) return { unitId: slot.dataset.equipUnit, slot: Number(slot.dataset.equipSlot) };
    const unitId = this.actions.unitAt(x, y);
    return unitId ? { unitId, slot: null } : null;
  }
  private unitPreviews(itemId: string, unitId: string): EquipPreview[] {
    const state = this.actions.state();
    return [0, 1, 2].map(slot => previewEquip(state, itemId, unitId, slot));
  }
  /** Every slot refused: the most specific reason (an occupied slot is the least informative). */
  private unitRefusalText(previews: readonly EquipPreview[]): string {
    const main = previews.find(preview => !preview.allowed && preview.reason !== 'item-slot-occupied') ?? previews[0];
    return main.allowed ? '' : main.reason === 'item-slot-occupied' ? '该单位的 3 个装备槽已满' : equipmentFailureText(main.reason);
  }
  /** What dropping the dragged item on this target would do, in previewEquip's words (C17). */
  private dropPreviewText(itemId: string, unitId: string, slot: number | null): string {
    if (slot !== null) {
      const previews = this.unitPreviews(itemId, unitId), target = routeSlotDrop(previews, slot), preview = previews[target];
      return preview.allowed ? allowedPreviewText(preview, target, itemDefinitionName) : equipmentFailureText(preview.reason);
    }
    const previews = this.unitPreviews(itemId, unitId), chosen = pickUnitDropSlot(previews), preview = previews[chosen];
    return preview?.allowed ? allowedPreviewText(preview, chosen, itemDefinitionName) : this.unitRefusalText(previews);
  }
  /**
   * C18-B: what a consumable drag points at, as a §18.1 ConsumableTarget: an item card or a worn item's slot (item), an
   * equipment row or a board/bench piece of mine (unit; for an item tool, routed to an item it wears). Same in every phase;
   * whether the tool fits the target is the preview's call.
   */
  private toolTarget(tool: ConsumableInstance, x: number, y: number): { target: ConsumableTarget; label: string } | null {
    const state = this.actions.state(), hit = document.elementFromPoint(x, y);
    // A unit tool (the remover) names the unit from any of its slots, also one wearing an item.
    const itemId = unitTool(tool) ? undefined : hit?.closest<HTMLElement>('[data-item-id]')?.dataset.itemId;
    if (itemId) { const item = state.items.find(entry => entry.id === itemId); return { target: { kind: 'item', itemId }, label: item ? ITEM_DEFINITIONS[item.definitionId]?.name ?? item.definitionId : itemId }; }
    const unitId = hit?.closest<HTMLElement>('[data-unit-id]')?.dataset.unitId ?? this.actions.unitAt(x, y);
    const unit = unitId ? state.preparation.units.find(entry => entry.id === unitId) : undefined;
    if (!unit) return null;
    // P1: an item tool on a whole unit (board or bench token, equipment row) goes to an item it wears, in any phase.
    if (!unitTool(tool)) {
      const worn = state.items.filter(item => item.location.kind === 'unit' && item.location.unitId === unit.id)
        .sort((a, b) => (a.location.kind === 'unit' ? a.location.slot : 0) - (b.location.kind === 'unit' ? b.location.slot : 0));
      const routed = routeToolUnitDrop(worn.map(item => item.id), id => previewConsumable(state, tool.consumableId, { kind: 'item', itemId: id }).ok);
      const item = routed ? worn.find(entry => entry.id === routed) : undefined;
      if (item) return { target: { kind: 'item', itemId: item.id }, label: `${displayUnitName(unit.definitionId)} · ${itemDefinitionName(item.definitionId)}` };
    }
    return { target: { kind: 'unit', unitId: unit.id }, label: displayUnitName(unit.definitionId) };
  }
  /**
   * A tool dropped (or clicked) on a target: sent only when the target answer is ok (§18.8 01); otherwise its reason is
   * shown and nothing is sent. The success text is the preview's wording, confirmed by the server's receipt.
   */
  private useTool(tool: ConsumableInstance, target: { target: ConsumableTarget; label: string }): void {
    const preview = previewConsumable(this.actions.state(), tool.consumableId, target.target), text = this.toolDropText(tool, target);
    if (preview.ok) { this.selectedConsumable = null; this.actions.useConsumable(tool.consumableId, target.target, text.replace('：将', '：已')); }
    else this.actions.status(text);
  }
  private toolDropText(tool: ConsumableInstance, target: { target: ConsumableTarget; label: string }): string {
    const state = this.actions.state();
    // affectedItemIds are permanent item ids (§18.8 01): named through the items they point at.
    const itemName = (id: string) => { const item = state.items.find(entry => entry.id === id); return item ? itemDefinitionName(item.definitionId) : '已移除的装备'; };
    return consumableDropText(tool, target.label, previewConsumable(state, tool.consumableId, target.target), itemName, state.phase);
  }
  private selectConsumable(id: string) {
    if (!this.itemsOpen()) return;
    this.selectedConsumable = this.selectedConsumable === id ? null : id; this.render();
  }
  private selectItem(id: string) {
    if (!this.itemsOpen()) return;
    this.selectedItems = this.selectedItems.includes(id) ? this.selectedItems.filter(item => item !== id) : [...this.selectedItems.slice(-1), id];
    this.render();
  }
  render(): void {
    const spectating = isOnlineSpectating();
    const state = this.actions.state(), ready = state.phase === 'preparation' && !spectating;
    const operable = this.operable(state);
    this.selectedItems = this.selectedItems.filter(id => state.items.some(item => item.id === id && item.location.kind === 'inventory'));
    this.root.replaceChildren(); this.shopDock?.replaceChildren(); this.eventList = null;
    this.traitColumn.render(state.preparation);
    const online = isOnline(), ended = isOnlineEnded(), dock = this.shopDock;
    const round = readRoundInfo(state), xp = getXpToNextLevel(state.level), interest = getInterestGold(state.gold);
    const lootView = readLootView(state);
    const head = element('header', '', 'hud-bar'); head.dataset.phase = state.phase;
    const title = element('div', '', 'hud-title');
    title.append(element('span', ended ? ONLINE_PHASE_LABEL.gameOver! : spectating ? '已淘汰' : (online && ONLINE_PHASE_LABEL[state.phase]) || PHASE_LABEL[state.phase], `phase-badge phase-${ended ? 'gameOver' : state.phase}`), element('h2', `${round.displayName} · ${{ pvp: '对战', pve: '野怪', supply: '补给' }[round.kind]}${round.isFinal ? ' · 终局' : ''}`));
    const help = this.button('help-open', '？帮助', () => this.actions.help()); help.classList.add('help-button'); title.append(help);
    head.append(title);
    const stats = element('div', '', 'hud-stats panel-hud');
    const chip = (label: string, value: string, kind: string) => { const node = element('div', '', `hud-chip hud-${kind}`); node.append(element('span', label, 'hud-label'), element('strong', value)); stats.append(node); };
    // Docked (online): gold and level lead, as at the bottom-left of a TFT screen. Offline keeps the original order.
    if (dock) chip('金币', `${state.gold}`, 'gold'); else chip('生命', String(state.playerHp), 'hp');
    if (!dock) chip('金币', `${state.gold}`, 'gold');
    chip('等级', `${state.level}${xp === null ? ' · 满' : ` · ${state.xp}/${xp}`}`, 'level');
    chip('人口', `${getPlayerDeploymentCount(state.preparation)}/${getDeploymentCap(state)}`, 'pop');
    if (dock) chip('生命', String(state.playerHp), 'hp');
    if (dock) dock.append(stats); else head.append(stats);
    head.append(element('p', `预计利息 +${interest} · ${state.streak.kind === 'win' ? '连胜' : state.streak.kind === 'loss' ? '连败' : '连胜败'} ${state.streak.count} · ${ended ? ONLINE_END_TEXT : spectating ? ONLINE_SPECTATE_TEXT : (online && ONLINE_PHASE_HINT[state.phase]) || PHASE_HINT[state.phase]}`, 'hud-hint'));
    this.root.append(head);
    // One phase-appropriate primary action; the other lifecycle buttons stay reachable as secondary.
    const primary: ControlName = state.phase === 'settlement' ? 'continue' : state.phase === 'gameOver' ? 'new-match' : 'start-combat';
    const labels: Record<ControlName, string> = { reroll: 'D · 刷新 2', 'buy-xp': 'F · 经验 4', sell: 'E · 出售', 'start-combat': state.phase === 'combat' ? '战斗进行中…' : state.phase === 'choice' ? '请先完成选择' : round.kind === 'supply' ? '领取补给' : '开始战斗', continue: '继续', 'new-match': '新局' };
    const actions = element('div', '', 'action-bar');
    const controlButton = (name: ControlName, className: string) => {
      const button = this.button(`mobile:${name}`, labels[name], () => {
        if (name === 'sell' && this.router.current?.kind === 'item') { this.actions.status('无出售单位目标 · 请先结束物品拖拽'); return; }
        if (LIFECYCLE.has(name)) {
          // The primary button changes meaning when the phase changes (继续 → 开始战斗). A second
          // click of the same burst must not land on the new action; deliberate clicks after the
          // quiet window, and every D/F/E or shop input, are unaffected.
          const now = performance.now(), guard = this.lifecycleGuard;
          if (guard && guard.name !== name && now - guard.at < LIFECYCLE_QUIET_MS) { this.actions.status('阶段刚刚切换 · 请确认后再点击'); return; }
          const before = this.actions.state().phase;
          this.actions.control(name);
          if (this.actions.state().phase !== before) this.lifecycleGuard = { at: performance.now(), name };
          return;
        }
        this.actions.control(name);
      });
      button.classList.add(className);
      if (name === primary && state.phase !== 'preparation' && name === 'start-combat') button.classList.add('waiting');
      // Continue is usable exactly when the domain's LootView says so; the command still re-checks.
      if (name === 'continue' && !lootView.canContinue) {
        button.disabled = true; button.dataset.blockedReason = lootView.reason ?? 'unsettled-round';
        button.title = continueBlockText(lootView.reason ?? 'unsettled-round'); button.setAttribute('aria-disabled', 'true');
      }
      if (spectating) { button.disabled = true; button.setAttribute('aria-disabled', 'true'); }
      return button;
    };
    actions.append(controlButton(primary, 'primary-action'));
    const controls = element('div', '', 'mobile-controls'); controls.classList.toggle('locked', !operable);
    for (const name of ['reroll', 'buy-xp', 'sell'] as const) controls.append(controlButton(name, 'economy-action'));
    const lock = this.button('shop-lock', state.shop.locked ? '🔒 已锁店' : '锁店', () => this.actions.shopLock(!state.shop.locked, state.shop.generation), !operable);
    lock.setAttribute('aria-pressed', String(Boolean(state.shop.locked))); lock.classList.add('economy-action'); controls.append(lock);
    if (dock) dock.append(controls); else actions.append(controls);
    this.root.append(actions);
    // Lifecycle buttons that are not the current primary action sit below the shop,
    // keeping the shop within the first screen on small phones.
    const secondary = element('div', '', 'secondary-controls');
    for (const name of (['start-combat', 'continue', 'new-match'] as const).filter(name => name !== primary)) secondary.append(controlButton(name, 'secondary-action'));
    this.renderShop(state, operable);
    this.root.append(secondary);
    this.actions.highlight([]);
    const preview = encounterPreviewSection(state, {
      open: this.previewOpen?.round === state.round ? this.previewOpen.open : null,
      onToggle: open => { this.previewOpen = { round: state.round, open }; },
      onHover: ids => this.actions.highlight(ids),
    });
    if (preview) this.root.append(preview);
    const result = state.roundResults.at(-1);
    if (result) {
      const receipt = element('details', '', 'income-receipt'); receipt.dataset.debug = 'income-receipt';
      // C11: interest and XP sit in the summary so they show without expanding the receipt.
      receipt.append(element('summary', `上轮收入 +${result.income} 金币（利息 ${result.incomeBreakdown.interest}）· 经验 +${result.xpAwarded} · 生命 ${result.hpBefore} → ${result.hpAfter}`));
      const income = result.incomeBreakdown;
      // Online round records come from the private seat view: interestBasis is whitelisted (PR #50), XP requested is not (B7).
      const basis = result.interestBasis === undefined ? '' : `（基数 ${result.interestBasis}）`, requested = result.xpRequested === undefined ? '' : `/${result.xpRequested}`;
      receipt.append(element('p', `基础 ${income.base} + 胜利 ${income.win} + 利息 ${income.interest}${basis}+ 连胜败 ${income.streak} = ${result.income} 金币；余额 ${result.goldBefore} → ${result.goldAfter}；经验 +${result.xpAwarded}${requested}`));
      this.root.append(receipt);
    }
    // Online keeps an empty slot so the panel can appear once my battle has played out (updateCombat).
    this.lootSection = this.lootPanel(state) ?? (isOnline() ? Object.assign(element('section'), { hidden: true }) : null);
    if (this.lootSection) this.root.append(this.lootSection);
    this.statusText = element('p', ended ? ONLINE_END_TEXT : spectating ? ONLINE_SPECTATE_TEXT : ready ? '点物品选择；两件组件可合成；选物品后点空装备槽。' : state.phase === 'choice' ? '完成选择后继续运营' : state.phase === 'gameOver' ? (online ? ONLINE_END_TEXT : `${state.outcome === 'victory' ? '胜利 · 完成最终挑战' : '失败 · 对局结束'} · 点击新局`) : operable ? ONLINE_OPS_TEXT : IDLE_STATUS[state.phase] ?? '', 'panel-status');
    this.statusText.setAttribute('role', 'status'); this.root.append(this.statusText);
    const tabs = element('nav', '', 'panel-tabs'); tabs.setAttribute('aria-label', '构筑面板');
    for (const [tab, label] of [['traits', '羁绊'], ['items', '装备'], ['units', '部署'], ['builds', '构筑'], ['events', '记录']] as const) {
      const button = this.button(`panel:${tab}`, label, () => { this.actions.cancelGesture(); this.tab = tab; this.render(); });
      button.setAttribute('aria-pressed', String(this.tab === tab)); tabs.append(button);
    }
    this.root.append(tabs);
    this.combatText = element('section', '', 'combat-sources'); this.root.append(this.combatText); this.lastCombatTick = -1; this.lastCombatId = undefined; this.updateCombat();
    if (this.tab === 'traits') this.renderTraits(state);
    if (this.tab === 'items') this.renderItems(state, this.itemsOpen());
    if (this.tab === 'units') this.renderUnits(state, ready);
    if (this.tab === 'builds') this.renderBuilds();
    if (this.tab === 'events') { this.eventList = element('section', '', 'battle-record'); this.eventList.dataset.debug = 'battle-record'; this.root.append(this.eventList); this.renderEventList(); }
    const owned = element('section', '', 'owned-modifiers'); owned.append(element('h3', '永久构筑'));
    const augments = element('p', state.augments.length ? '强化：' : '强化： 尚未选择', 'owned-augments');
    for (const augment of state.augments) augments.append(this.augmentChip(augment.definitionId));
    owned.append(augments);
    if (needsAnomalyRecruitment(state)) owned.append(element('p', '4-6 异常等待招募：先购买一名棋子，再选择异常目标。刷新与经验购买必须保留招募资金。', 'anomaly-recruitment'));
    const binding = state.anomalyBinding;
    owned.append(element('p', binding ? `异常： ${ANOMALY_DEFINITIONS[binding.definitionId].name} → ${displayUnitName(state.preparation.units.find(unit => unit.id === binding.unitId)!.definitionId)}` : '异常： 4-6 选择单位'));
    this.root.append(owned);
    this.renderChoice(state); this.lastCombatTick = -1; this.updateCombat();
  }
  /** U6: the domain's LootView only; PvE rounds after Start. Nothing here grants, settles or decides Continue. */
  private lootPanel(state: MatchState): HTMLElement | null {
    if (isOnline()) return this.revealedLootPanel(state);
    if (state.m8.round.kind !== 'pve' || state.phase === 'preparation') { this.lootKey = ''; return null; }
    const view = readLootView(state), orbs = readOrbLoot(state);
    this.lootKey = JSON.stringify([view, state.pendingChoice?.choiceId ?? null]);
    if (state.phase === 'gameOver') return lootTerminalSummary(view, this.lootLabels(state));
    // C18-B: the round's orbs as cards, then the domain's own pick/Continue verdict (lootPanelSection without its list).
    return orbs ? appendLootStatus(orbLootSection(orbs, this.lootLabels(state)), view, this.lootLabels(state)) : lootPanelSection(view, this.lootLabels(state));
  }
  /** Drop sources are the round's public neutral units (same unit IDs as the encounter preview). */
  private lootLabels(state: MatchState) {
    const names = new Map(readEncounterPreview(state)?.units.map(unit => [unit.unitId, unit.name]) ?? []);
    return { sourceName: (id: string | null) => (id && names.get(id)) || '本回合野怪' };
  }
  /**
   * Online (C9): the server's revealed-loot summary of my current PvE round, rendered like the offline settlement
   * block. Shown after the battle (choice and settlement); absent field (PvP, supply, not sent) shows nothing.
   * Continue, pending claims and the pick identity are not sent online and are not inferred here.
   */
  private revealedLootPanel(state: MatchState): HTMLElement | null {
    const hidden = this.onlineLootHidden(state);
    const loot = hidden ? null : readRevealedLoot(state);
    // C18-B: the R3/R4 orb summary of the private view (contract §18.4), shown under the same timing as C9.
    const orbs = hidden ? null : readOrbLoot(state);
    this.lootKey = this.onlineLootKey(state);
    if (orbs) {
      const section = orbLootSection(orbs, this.lootLabels(state)); section.dataset.online = 'true';
      if (state.phase === 'choice' && state.pendingChoice?.kind === 'component') section.append(element('p', '组件奖励选择后入库，会出现在这里。', 'loot-note'));
      return section;
    }
    if (!loot) return null;
    const pick = state.phase === 'choice' && state.pendingChoice?.kind === 'component';
    const section = lootRevealedSection(loot, this.lootLabels(state), !pick); section.dataset.online = 'true';
    if (pick) section.append(element('p', '组件奖励选择后入库，会出现在这里。', 'loot-note'));
    return section;
  }
  /**
   * Online: the drops stay hidden in preparation (an older round's) and while my battle is still playing back (no
   * spoiler before the kill). Once it has played out they show, also when a reconnect replays the battle over the
   * settlement (C18-B: still visible after a reconnect).
   */
  private onlineLootHidden(state: MatchState): boolean {
    if (state.phase === 'preparation') return true;
    const battle = this.actions.combat().view;
    return state.phase === 'combat' && (!battle || battle.status === 'running');
  }
  private onlineLootKey(state: MatchState): string {
    const hidden = this.onlineLootHidden(state);
    return JSON.stringify([hidden, hidden ? null : readRevealedLoot(state), hidden ? null : readOrbLoot(state), state.pendingChoice?.choiceId ?? null]);
  }
  private renderTraits(state: MatchState): void {
    const list = element('section', '', 'trait-list'); list.dataset.debug = 'trait-panel';
    for (const snapshot of deriveTraits(state.preparation, 'player')) {
      const definition = TRAIT_DEFINITIONS[snapshot.traitId], next = definition.tiers.find(tier => tier.threshold > snapshot.count);
      const row = element('article', '', snapshot.tier > 0 ? 'trait active' : 'trait'); row.dataset.debug = `trait:${snapshot.traitId}`;
      const title = element('h3', `${traitDisplayName(snapshot.traitId)} · ${snapshot.count} / ${next?.threshold ?? '已满'} · 档位 ${snapshot.tier}`);
      title.insertAdjacentHTML('afterbegin', s13IconHtml('trait', snapshot.traitId, 20, 'trait-icon'));
      row.append(title);
      row.append(element('p', `上阵不同单位：${snapshot.memberDefinitionIds.map(id => displayUnitName(id)).join('、') || '无'}`));
      row.append(element('p', definition.tiers.map(tier => describeTraitTier(definition, tier)).join(' / ')));
      list.append(row);
    }
    this.root.append(list);
  }
  /** `open`: this seat can send commands at all; each combine/equip target's legality comes from the previews. */
  private renderItems(state: MatchState, open: boolean): void {
    const section = element('section', '', 'item-panel'); section.dataset.items = 'true'; section.append(element('h3', '物品备战席'));
    const inventory = element('div', '', 'item-inventory');
    for (const item of state.items.filter(item => item.location.kind === 'inventory')) {
      const definition = ITEM_DEFINITIONS[item.definitionId];
      const tags = catalogEntry(item.definitionId) ? itemTags(catalogEntry(item.definitionId)!).map(tag => tag.text) : [];
      const button = this.button(`item:${item.id}`, `${definition.name}${tags.length ? `\n${tags.join(' · ')}` : ''}`, () => {}, !open);
      button.setAttribute('aria-pressed', String(this.selectedItems.includes(item.id))); button.classList.add('item-card');
      button.insertAdjacentHTML('afterbegin', itemMarkHtml(item.definitionId, 28));
      button.dataset.itemDef = item.definitionId; button.dataset.itemId = item.id; button.title = `${item.id} · ${definition.id}`;
      button.addEventListener('pointerdown', event => {
        if (!open || event.button !== 0) return;
        const gesture = this.router.begin('item', item.id, event.pointerId);
        if (!gesture) return;
        button.setPointerCapture(event.pointerId);
        this.itemDrag = { gesture, x: event.clientX, y: event.clientY, moved: false, element: button };
      });
      button.addEventListener('keydown', event => { if (event.code === 'Enter' || event.code === 'Space') { event.preventDefault(); this.selectItem(item.id); } });
      inventory.append(button);
    }
    section.append(inventory);
    // C18-B: consumable tools (§18.4); a picked or dragged tool outlines the targets the answers allow (§18.8 01).
    const consumables = readConsumables(state);
    const tool = consumables.find(entry => entry.consumableId === this.selectedConsumable) ?? null;
    if (!tool) this.selectedConsumable = null;
    const usable = (target: ConsumableTarget) => tool !== null && previewConsumable(state, tool.consumableId, target).ok;
    if (consumables.length) section.append(consumableShelf(consumables, this.selectedConsumable, (card, entry) => {
      card.disabled = !open;
      card.addEventListener('pointerdown', event => {
        if (!open || event.button !== 0) return;
        const gesture = this.router.begin('item', entry.consumableId, event.pointerId);
        if (!gesture) return;
        card.setPointerCapture(event.pointerId);
        this.itemDrag = { gesture, x: event.clientX, y: event.clientY, moved: false, element: card, tool: entry };
      });
      card.addEventListener('keydown', event => { if (event.code === 'Enter' || event.code === 'Space') { event.preventDefault(); this.selectConsumable(entry.consumableId); } });
    }));
    for (const card of Array.from(inventory.querySelectorAll<HTMLElement>('.item-card'))) if (usable({ kind: 'item', itemId: card.dataset.itemId! })) card.classList.add('consumable-candidate');
    // Combine and equip legality come from the B5 previews (same validators as the commands);
    // the commands still re-check the current state when clicked.
    const itemName = (id: string) => { const item = state.items.find(entry => entry.id === id); return item ? ITEM_DEFINITIONS[item.definitionId].name : '已不存在的物品'; };
    const selected = [...this.selectedItems];
    const combine = open && selected.length === 2 ? previewCombine(state, selected[0], selected[1]) : null;
    const resultName = combine?.allowed ? ITEM_DEFINITIONS[combine.resultDefinitionId]?.name ?? combine.resultDefinitionId : '';
    const choice = element('p', `选择：${selected.map(itemName).join(' + ') || '无'}${combine?.allowed ? ` → ${resultName}` : ''}`, 'combine-selection');
    section.append(choice);
    if (combine && !combine.allowed) { const hint = element('p', `无法合成：${equipmentFailureText(combine.reason)}`, 'equip-hint denied'); hint.dataset.debug = 'combine-preview'; hint.dataset.reason = combine.reason; section.append(hint); }
    section.append(this.button('combine-items', combine?.allowed ? `合成 ${resultName}` : combine ? '无法合成' : '选择两件组件合成', () => {
      if (this.router.current) { this.actions.status('请先结束当前拖拽，再确认合成'); return; }
      this.actions.combine(selected[0], selected[1]);
    }, !open || !combine?.allowed));
    section.append(element('h3', '单位装备 · 每单位 3 槽'));
    const chosen = open ? this.selectedItems.filter(id => state.items.some(item => item.id === id)).at(-1) : undefined;
    const frozen = this.actions.battleItems();
    for (const unit of state.preparation.units.filter(unit => unit.team === 'player')) {
      const row = element('article', '', 'equipment-row'); row.dataset.unitId = unit.id;
      const heading = element('strong', `${displayUnitName(unit.definitionId)} ${'★'.repeat(unit.starLevel)}${state.anomalyBinding?.unitId === unit.id ? ' ◈ 异常' : ''}`);
      // C18: during a shown battle, items worn now but not in that battle's snapshot are marked "下场生效".
      const loadout = battleLoadout(state.items, frozen, unit.id), loadoutText = loadout?.changed ? battleLoadoutText(loadout, itemDefinitionName) : '';
      if (loadoutText) { heading.title = loadoutText; row.classList.add('has-pending'); }
      if (tool && usable({ kind: 'unit', unitId: unit.id })) { row.classList.add('consumable-candidate'); heading.title = consumableTargetHint(tool); }
      row.append(heading);
      const view = readUnitEquipment(state, unit.id);
      const previews: EquipPreview[] | null = chosen ? [0, 1, 2].map(slot => previewEquip(state, chosen, unit.id, slot)) : null;
      const conflicts = new Set(previews?.flatMap(preview => preview.allowed ? [] : preview.conflictingItemIds) ?? []);
      const slots = element('div', '', 'equipment-slots');
      for (const entry of view ? slotViews(view) : []) {
        const { slot } = entry, item = entry.itemInstanceId ? state.items.find(value => value.id === entry.itemInstanceId) : undefined;
        const reserved = !item && entry.reservedByItemInstanceId !== null;
        const label = item ? ITEM_DEFINITIONS[item.definitionId].name
          : entry.temporary ? `临时 · ${ITEM_DEFINITIONS[entry.temporary.definitionId]?.name ?? entry.temporary.definitionId}`
          : reserved ? `${itemName(entry.reservedByItemInstanceId!)} 占用` : `空槽 ${slot + 1}`;
        const button = this.button(`equipment:${unit.id}:${slot}`, label, () => {
          if (this.router.current) { this.actions.status('请先结束当前拖拽，再点击装备槽'); return; }
          if (tool) {
            const onItem = item && !unitTool(tool) ? item : undefined;
            const target: ConsumableTarget = onItem ? { kind: 'item', itemId: onItem.id } : { kind: 'unit', unitId: unit.id };
            this.useTool(tool, { target, label: onItem ? ITEM_DEFINITIONS[onItem.definitionId].name : displayUnitName(unit.definitionId) });
            return;
          }
          if (chosen) this.equipAt(chosen, unit.id, slot); else this.actions.status('请先点选物品备战席中的一件物品');
        }, !open || reserved);
        if (item) { button.insertAdjacentHTML('afterbegin', itemMarkHtml(item.definitionId, 22)); button.dataset.itemDef = item.definitionId; }
        else if (entry.temporary) { button.insertAdjacentHTML('afterbegin', itemMarkHtml(entry.temporary.definitionId, 22)); button.dataset.itemDef = entry.temporary.definitionId; }
        if (reserved) { button.classList.add('slot-reserved'); button.dataset.reservedBy = entry.reservedByItemInstanceId!; }
        if (entry.temporary) { button.classList.add('slot-temporary'); button.dataset.temporaryId = entry.temporary.temporaryId; }
        if (item) button.dataset.itemId = item.id;
        if (item && usable({ kind: 'item', itemId: item.id })) button.classList.add('consumable-candidate');
        if (item && loadout?.pendingIds.has(item.id)) this.markPending(button, loadout);
        else if (loadoutText) button.title = loadoutText;
        const routed = previews ? routeSlotDrop(previews, slot) : slot, preview = previews?.[routed];
        if (preview) {
          button.classList.add(preview.allowed ? 'equip-ok' : 'equip-denied');
          button.dataset.preview = preview.allowed ? 'allowed' : preview.reason;
          if (routed !== slot) button.dataset.routedSlot = String(routed);
          const previewText = preview.allowed ? preview.combination ? allowedPreviewText(preview, routed, itemDefinitionName)
            : `可装备${preview.occupiedSlots.length > 1 ? `，占用槽 ${slotList(preview.occupiedSlots)}` : ''}` : equipmentFailureText(preview.reason);
          button.title = button.title ? `${previewText}\n${button.title}` : previewText;
        }
        if (item && conflicts.has(item.id)) button.classList.add('equip-conflict');
        button.dataset.equipUnit = unit.id; button.dataset.equipSlot = String(slot); slots.append(button);
      }
      row.append(slots);
      if (loadoutText) { const line = element('p', loadoutText, 'equip-loadout'); line.dataset.debug = `equip-loadout:${unit.id}`; row.append(line); }
      if (previews) row.append(this.equipHint(previews, itemName));
      for (const temporary of view?.temporaryItems ?? []) row.append(element('p', temporaryItemText(temporary, id => ITEM_DEFINITIONS[id]?.name ?? id, itemName(temporary.parentItemInstanceId)), 'temporary-line'));
      section.append(row);
    }
    section.append(this.codex ??= createItemCodex());
    this.root.append(section);
  }
  /** C18: a slot whose item is worn now but not in the battle on the board says so, with both loadouts on hover. */
  private markPending(button: HTMLButtonElement, loadout: BattleLoadout): void {
    button.classList.add('slot-pending'); button.dataset.pending = 'next-battle';
    button.append(element('span', NEXT_BATTLE_TEXT, 'pending-tag'));
    button.title = `${NEXT_BATTLE_TEXT} · 本场战斗不带此装备\n${battleLoadoutText(loadout, itemDefinitionName)}`;
  }
  /** Unit detail: slots and temporary children from readUnitEquipment(); temporaries are read-only. */
  private appendEquipmentDetail(node: HTMLElement, state: MatchState, unitId: string): void {
    // Enemy loadouts are not player instances (no permanent IDs to name); only player units get the detail.
    if (state.preparation.units.find(unit => unit.id === unitId)?.team !== 'player') return;
    const view = readUnitEquipment(state, unitId);
    if (!view) return;
    const name = (id: string | null) => { const item = id ? state.items.find(entry => entry.id === id) : undefined; return item ? ITEM_DEFINITIONS[item.definitionId]?.name ?? item.definitionId : null; };
    const slots = slotViews(view).map(entry => entry.itemInstanceId ? name(entry.itemInstanceId) : entry.temporary ? `临时·${ITEM_DEFINITIONS[entry.temporary.definitionId]?.name ?? entry.temporary.definitionId}`
      : entry.reservedByItemInstanceId ? `（${name(entry.reservedByItemInstanceId) ?? '独占装备'}占用）` : '空');
    const line = element('p', `装备槽：${slots.map((text, slot) => `${slot + 1} ${text}`).join(' · ')}`, 'unit-equipment'); line.dataset.debug = `unit-equipment:${unitId}`;
    node.append(line);
    const loadout = battleLoadout(state.items, this.actions.battleItems(), unitId);
    if (loadout?.changed) { const text = element('p', battleLoadoutText(loadout, itemDefinitionName), 'equip-loadout'); text.dataset.debug = `unit-loadout:${unitId}`; node.append(text); }
    for (const temporary of view.temporaryItems) {
      const item = element('p', temporaryItemText(temporary, id => ITEM_DEFINITIONS[id]?.name ?? id, name(temporary.parentItemInstanceId) ?? '已移除的装备'), 'temporary-line');
      item.dataset.itemDef = temporary.definitionId; item.tabIndex = 0; node.append(item);
    }
  }
  /** One line per unit while an item is chosen: where it fits, or why not and what conflicts. */
  private equipHint(previews: readonly EquipPreview[], itemName: (id: string) => string): HTMLElement {
    const allowed = previews.flatMap((preview, slot) => preview.allowed ? [{ slot, preview }] : []);
    if (allowed.length) {
      // C17: a slot where the component combines with the one already worn is named first, as a drop on the unit picks it.
      const combining = allowed.find(entry => entry.preview.allowed && entry.preview.combination);
      if (combining?.preview.allowed) {
        const hint = element('p', allowedPreviewText(combining.preview, combining.slot, itemDefinitionName), 'equip-hint ok');
        hint.dataset.preview = 'allowed'; return hint;
      }
      const span = allowed[0].preview.allowed ? allowed[0].preview.occupiedSlots : [];
      const hint = element('p', span.length > 1 ? `可装备 · 将占用槽 ${slotList(span)}` : `可装备到槽 ${slotList(allowed.map(entry => entry.slot))}`, 'equip-hint ok');
      hint.dataset.preview = 'allowed'; return hint;
    }
    // Every slot refused: show the most specific reason (an occupied slot is the least informative).
    const denied = previews.filter((preview): preview is Extract<EquipPreview, { allowed: false }> => !preview.allowed);
    const main = denied.find(preview => preview.reason !== 'item-slot-occupied') ?? denied[0];
    const conflicts = [...new Set(main.conflictingItemIds)];
    const hint = element('p', `不可装备：${main.reason === 'item-slot-occupied' ? '三个装备槽均已有装备' : equipmentFailureText(main.reason)}${conflicts.length ? `（冲突：${conflicts.map(itemName).join('、')}）` : ''}`, 'equip-hint denied');
    hint.dataset.preview = main.reason; return hint;
  }
  private renderUnits(state: MatchState, ready: boolean): void {
    const section = element('section'); section.append(element('h3', '先选单位，再点部署位置'));
    const roster = element('div', '', 'unit-roster');
    for (const unit of state.preparation.units.filter(unit => unit.team === 'player')) {
      const button = this.button(`mobile:unit:${unit.id}`, `${displayUnitName(unit.definitionId)} ${'★'.repeat(unit.starLevel)} · ${unit.location.kind === 'bench' ? '备战席' : `(${unit.location.cell.col},${unit.location.cell.row})`}${state.anomalyBinding?.unitId === unit.id ? ' ◈' : ''}`, () => { this.actions.selectUnit(unit.id); this.render(); });
      button.setAttribute('aria-pressed', String(this.actions.selectedUnit() === unit.id)); button.dataset.unitDef = unit.definitionId; button.dataset.unitStar = String(unit.starLevel);
      roster.append(button);
    }
    section.append(roster);
    const grid = element('div', '', 'deployment-grid'), zone = state.preparation.board.deploymentZones.player;
    for (let row = zone.firstRow; row <= zone.lastRow; row++) for (let col = 0; col < state.preparation.board.columns; col++) {
      const occupant = state.preparation.units.find(unit => unit.location.kind === 'board' && unit.location.cell.col === col && unit.location.cell.row === row);
      grid.append(this.button(`deploy:${col},${row}`, occupant ? UNIT_DEFINITIONS[occupant.definitionId].symbol : `${col},${row}`, () => {
        const selected = this.actions.selectedUnit(); if (selected) this.actions.deploy(selected, { kind: 'board', cell: { col, row } }); else this.actions.status('请先选择一个我方单位');
      }, !ready));
    }
    section.append(grid);
    const bench = element('div', '', 'bench-grid');
    // Occupied cells and slots stay clickable: an allied occupant swaps with the selected unit (SR-C7-01).
    for (let slot = 0; slot < state.preparation.benchSize; slot++) {
      const occupant = state.preparation.units.find(unit => unit.location.kind === 'bench' && unit.location.slot === slot);
      bench.append(this.button(`mobile:bench:${slot}`, occupant ? `备 ${slot + 1} ${UNIT_DEFINITIONS[occupant.definitionId].symbol}` : `备 ${slot + 1}`, () => {
        const selected = this.actions.selectedUnit(); if (selected) this.actions.deploy(selected, { kind: 'bench', slot }); else this.actions.status('请先选择一个我方单位');
      }, !ready));
    }
    section.append(bench); this.root.append(section);
  }
  private clearChoiceDismissal(): void {
    if (this.dismissalTimer !== null) window.clearTimeout(this.dismissalTimer);
    this.dismissalTimer = null;
    this.modal.classList.remove('dismissal-shield');
    this.modal.removeAttribute('aria-hidden'); delete this.modal.dataset.debug;
  }
  private shieldChoiceDismissal(): void {
    this.clearChoiceDismissal(); this.choiceToken = '';
    // Consume the rest of the confirming pointer burst before exposing the
    // board below. Keyboard D/F/E still commit synchronously in preparation.
    this.modal.hidden = false; this.modal.replaceChildren();
    this.modal.classList.add('dismissal-shield'); this.modal.removeAttribute('aria-hidden');
    this.modal.focus({ preventScroll: true });
    this.modal.dataset.debug = 'choice-dismissal-shield';
    this.dismissalTimer = window.setTimeout(() => {
      this.clearChoiceDismissal(); this.renderChoice(this.actions.state());
    }, CHOICE_POINTER_QUIET_MS);
  }
  private renderChoice(state: MatchState): void {
    const choice = state.pendingChoice;
    if (!choice) {
      this.choiceToken = '';
      if (this.dismissalTimer === null) {
        const restoreFocus = this.modal.contains(document.activeElement);
        this.modal.hidden = true; this.modal.replaceChildren();
        // Return to a neutral panel only after the pointer shield is gone.
        // Never focus the seed field or activate a gameplay control on close.
        if (restoreFocus) this.root.focus({ preventScroll: true });
      }
      return;
    }
    this.clearChoiceDismissal();
    const token = `${choice.choiceId}:${choice.generation}:${choice.step}`;
    if (token === this.choiceToken) return;
    this.choiceToken = token; this.modal.hidden = false; this.modal.replaceChildren();
    this.modal.inert = document.body.dataset.helpOpen === 'true';
    const card = element('div', '', 'choice-dialog');
    // The domain names the loot pick (LootView.pendingChoice, approved addendum); supply/augment/anomaly keep their wording.
    const pendingLoot = readLootView(state).pendingChoice, loot = pendingLoot?.choiceId === choice.choiceId ? pendingLoot : null;
    card.dataset.choiceSource = loot ? 'loot' : choice.kind;
    if (loot) card.dataset.dropId = loot.dropId;
    const sourceName = loot ? readEncounterPreview(state)?.units.find(unit => unit.unitId === loot.sourceUnitId)?.name ?? '本回合野怪' : '';
    card.append(element('h2', loot ? '野怪奖励 · 选择一件组件' : choice.kind === 'component' ? '补给 · 选择一件组件' : choice.kind === 'augment' ? '选择强化 · 本局永久生效' : '异常 · 单位永久进化'));
    card.append(element('p', loot ? `来源：${sourceName} · 固定 ${choice.offers.length} 选 1，不可刷新；确认后立即入库。完成选择前不能继续。` : '必须完成本次选择，才可继续搜牌、购买经验、装备与战斗。'));
    if (choice.step === 'target') {
      card.append(element('p', '先选择一个单位。锁定后不能换目标；升级时随单位保留。'));
      const targets = element('div', '', 'choice-targets');
      for (const unit of state.preparation.units.filter(unit => unit.team === 'player')) targets.append(this.button(`anomaly-target:${unit.id}`, `${displayUnitName(unit.definitionId)} ${'★'.repeat(unit.starLevel)}`, () => this.actions.target(choice.choiceId, choice.generation, unit.id)));
      card.append(targets);
    } else {
      if (choice.kind === 'anomaly') {
        const target = state.preparation.units.find(unit => unit.id === choice.targetId);
        card.append(element('p', `已锁定 ${target ? displayUnitName(target.definitionId) : ''} · 余额 ${state.gold} 金币 · 已刷新 ${choice.rerollCount} 次`, 'anomaly-target-lock'));
      }
      const offers = element('div', '', 'choice-cards');
      for (const id of choice.offers) {
        const definition = (choice.kind === 'component' ? ITEM_DEFINITIONS : choice.kind === 'augment' ? AUGMENT_DEFINITIONS : ANOMALY_DEFINITIONS)[id];
        const effects = choice.kind === 'component' ? itemDescriptions(id).join('；') : definition.effects.map(describeEffect).join('；');
        // Augments: zh name + icon; the W4 batch's content description is an implementation note, so only effects show.
        const label = choice.kind === 'augment' ? [augmentDisplayName(id), augmentPlayerDescription(id), effects].filter(Boolean).join('\n')
          : `${definition.name}\n${'description' in definition ? definition.description : '领取后可合成或装备'}\n${effects}`;
        const button = this.button(`choice:${id}`, label, () => {
          this.actions.choose(choice.choiceId, choice.generation, id);
          const after = this.actions.state().pendingChoice;
          if (!after || after.choiceId !== choice.choiceId || after.generation !== choice.generation) this.shieldChoiceDismissal();
        });
        if (choice.kind === 'augment') { button.insertAdjacentHTML('afterbegin', augmentIconHtml(id, 48)); button.title = label; }
        button.dataset.choiceId = choice.choiceId; button.dataset.generation = String(choice.generation); offers.append(button);
      }
      card.append(offers);
      if (choice.kind === 'anomaly') card.append(this.button('anomaly-reroll', `刷新异常 · 1 金币（余额 ${state.gold} 金币）`, () => this.actions.rerollAnomaly(choice.choiceId, choice.generation), state.gold < 1));
    }
    this.modal.append(card);
    // Session replacement changes the mode at the end of this same task.
    // Focus after that commit so startup/import-hidden choices cannot steal it.
    if (this.focusFrame !== null) cancelAnimationFrame(this.focusFrame);
    this.focusFrame = requestAnimationFrame(() => { this.focusFrame = null; this.focusChoice(); });
  }
  private focusChoice(): void {
    if (this.modal.hidden || getComputedStyle(this.modal).display === 'none' || document.body.dataset.helpOpen === 'true') return;
    this.modal.inert = false;
    (this.modal.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? this.modal).focus({ preventScroll: true });
  }
  updateCombat(): void {
    const state = this.actions.state(), { view: combat, runtime } = this.actions.combat(), node = this.combatText;
    if (!node) return;
    if (combat && this.lastCombatId === combat.combatId && this.lastCombatTick === combat.tick) return;
    if (combat && this.lastCombatId === combat.combatId && combat.status === 'running' && combat.tick - this.lastCombatTick < 2) return;
    this.lastCombatId = combat?.combatId; this.lastCombatTick = combat?.tick ?? -1;
    // Drops are revealed mid-combat by the domain; refresh only when the projection changes.
    if (this.lootSection && isOnline()) {
      if (this.onlineLootKey(state) !== this.lootKey) {
        const next = this.lootPanel(state) ?? Object.assign(element('section'), { hidden: true });
        this.lootSection.replaceWith(next); this.lootSection = next;
      }
    } else if (this.lootSection && combat?.status === 'running') {
      const view = isOnline() ? readRevealedLoot(state) : readLootView(state);
      if (JSON.stringify([view, state.pendingChoice?.choiceId ?? null]) !== this.lootKey) {
        const next = this.lootPanel(state); if (next) { this.lootSection.replaceWith(next); this.lootSection = next; }
      }
    }
    node.replaceChildren();
    if (!combat) {
      const selected = state.preparation.units.find(unit => unit.id === this.actions.selectedUnit());
      if (selected) {
        const definition = UNIT_DEFINITIONS[selected.definitionId], stats = getUnitStats(selected.definitionId, selected.starLevel);
        node.append(element('h3', `${displayUnitName(selected.definitionId)} ${'★'.repeat(selected.starLevel)}`), element('p', `基础 生命 ${stats.health} · 攻击力 ${stats.attack} · 护甲 ${stats.armor} · 魔抗 ${stats.magicResist} · 法力 ${stats.initialMana}/${stats.maxMana}`));
        node.append(element('p', `职业：${definition.traits.map(id => TRAIT_DEFINITIONS[id] ? traitDisplayName(id) : `${id}（本版本未开放）`).join(' / ')}`));
        this.appendEquipmentDetail(node, state, selected.id);
      }
      return;
    }
    const equipped = state.items.find(item => item.location.kind === 'unit');
    const preferred = this.actions.selectedUnit() ?? state.anomalyBinding?.unitId ?? (equipped?.location.kind === 'unit' ? equipped.location.unitId : null);
    const unit = combat.units.find(unit => unit.id === preferred) ?? combat.units.find(unit => unit.team === 'player');
    if (!unit) return;
    const base = getUnitStats(unit.definitionId, unit.starLevel);
    this.appendEquipmentDetail(node, state, unit.id);
    node.append(element('h3', `战斗 · ${displayUnitName(unit.definitionId)}`));
    node.append(element('p', `生命 ${unit.hp}/${unit.maxHp} · 法力 ${unit.mana}/${unit.maxMana} · 盾 ${unit.shield}`));
    node.append(element('p', `基础最大生命 ${base.health} → 本场最大生命 ${unit.maxHp}`));
    const engine = runtime?.units.find(value => value.id === unit.id);
    if (!runtime || !engine) {
      // Online (C6): the view's stats are already the current effective values (§14.2); the frozen column,
      // ability, shield layers, statuses and sources are not sent, so they are not shown.
      node.append(element('p', '基础 → 当前（含技能与状态）', 'stat-columns'));
      const viewRows: readonly [string, string, number | string, number][] = [
        ['ad', '攻击力', base.attack, unit.attackDamage], ['ap', '法强', '—', unit.abilityPower],
        ['attack-interval', '攻速 / 普攻间隔(ms)', base.attackIntervalTicks * 50, unit.attackIntervalTicks * 50],
        ['armor', '护甲', base.armor, unit.armor], ['magic-resist', '魔抗', base.magicResist, unit.magicResist], ['range', '射程(格)', base.attackRange, unit.attackRange],
      ];
      for (const [id, label, original, value] of viewRows) {
        const row = element('p', `${label} ${original} → ${value}`);
        row.dataset.debug = `combat-stat:${id}`; row.dataset.current = String(value); node.append(row);
      }
      node.append(element('p', `当前目标 ${combat.units.find(target => target.id === unit.targetId) ? definitionName(combat.units.find(target => target.id === unit.targetId)!.definitionId) : '无'}`));
      return;
    }
    const current = readCombatStats(engine, runtime);
    node.append(element('p', '基础 → 开战冻结 → 当前（含技能与状态）', 'stat-columns'));
    const statRows: readonly [string, string, number | string, number | string, number][] = [
      ['ad', '攻击力', base.attack, engine.attackDamage, current.attackDamage],
      ['ap', '法强', '—', engine.abilityPower ?? '—', current.abilityPower],
      ['attack-interval', '攻速 / 普攻间隔(ms)', base.attackIntervalTicks * 50, engine.attackIntervalTicks * 50, current.attackIntervalTicks * 50],
      ['armor', '护甲', base.armor, engine.armor, current.armor],
      ['magic-resist', '魔抗', base.magicResist, engine.magicResist, current.magicResist],
      ['range', '射程(格)', base.attackRange, engine.attackRange, current.attackRange],
    ];
    for (const [id, label, original, frozen, value] of statRows) {
      const row = element('p', `${label} ${original} → ${frozen} → ${value}`);
      row.dataset.debug = `combat-stat:${id}`; row.dataset.current = String(value); node.append(row);
    }
    const ability = engine.ability;
    node.append(element('p', `技能 · ${ability.kind === 's13' ? (abilityNameOf(ability.championId) ?? `${displayUnitName(ability.championId)} 技能`) : `${ability.kind === 'selfShield' ? '护盾' : ability.damageType === 'magic' ? '魔法伤害' : '物理伤害'} ${ability.amount}`} · 普攻间隔 ${current.attackIntervalTicks * 50}ms`));
    node.append(element('p', `当前目标 ${combat.units.find(target => target.id === unit.targetId) ? definitionName(combat.units.find(target => target.id === unit.targetId)!.definitionId) : '无'}`));
    const label = (origin: CombatOrigin) => originLabel(origin, id => this.combatUnitName(id));
    for (const layer of engine.shieldLayers ?? []) {
      if (layer.remaining <= 0) continue;
      const m8 = layer.m8State;
      node.append(element('p', `盾 ${layer.remaining} / ${layer.granted}${m8 ? ` · 已吸收 ${m8.absorbed}${m8.decayed ? ` · 已衰减 ${m8.decayed}` : ''}` : ''} · 剩余 ${ticksToSeconds(layer.expiresAtTick - runtime.tick)}（第 ${layer.expiresAtTick} 刻结束） · ${label(shieldSource(layer))}`, 'combat-shield'));
    }
    for (const row of readUnitStatusRows(runtime, unit.id)) {
      const line = element('p', statusRowText(row, runtime.tick, label), `combat-status${row.harmful ? ' harmful' : ''}${row.state === 'suppressed' || row.state === 'pending' ? ' inactive' : ''}`);
      line.dataset.debug = `combat-status:${row.kind}`; node.append(line);
    }
    for (const source of engine.sources ?? []) node.append(element('p', `${term(source.source.sourceKind)} · ${definitionName(source.source.sourceDefinitionId)}：${describeEffect(source.effect)}`));
  }
  private combatUnitName(id: string | null): string {
    if (!id) return '无';
    const state = this.actions.state();
    const unit = this.actions.combat().view?.units.find(value => value.id === id) ?? state.preparation.units.find(value => value.id === id);
    return unit ? `${displayUnitName(unit.definitionId)} ${'★'.repeat(unit.starLevel)}` : '历史单位';
  }
  /** Offline: the local ledger with full provenance text. Online: §14.2 wire events (reset() runs per battle). */
  observeEvents(events: readonly SceneCombatEvent[]): void {
    if (!events.length) return;
    const first = events[0]!;
    if (isLedgerEvent(first) && first.combatId !== this.eventCombatId) { this.eventTexts = []; this.eventCombatId = first.combatId; }
    for (const event of events) {
      const text = isLedgerEvent(event) ? combatEventText(event, id => this.combatUnitName(id)) : viewEventLine(event, id => this.combatUnitName(id));
      if (text) this.eventTexts.push(text);
    }
    if (this.eventTexts.length > 200) this.eventTexts.splice(0, this.eventTexts.length - 200);
    this.renderEventList();
  }
  /** C18-B: tool-use lines (§18.8 03) join the record of this round. */
  recordOperations(events: readonly MatchEvent[]): void {
    const state = this.actions.state();
    const item = (id: string) => { const found = state.items.find(entry => entry.id === id); return found ? itemDefinitionName(found.definitionId) : '已移除的装备'; };
    const unit = (id: string) => { const found = state.preparation.units.find(entry => entry.id === id); return found ? displayUnitName(found.definitionId) : '单位'; };
    const lines = events.map(event => consumableEventText(event, { item, unit })).filter((text): text is string => text !== null);
    if (!lines.length) return;
    this.eventTexts.push(...lines);
    if (this.eventTexts.length > 200) this.eventTexts.splice(0, this.eventTexts.length - 200);
    this.renderEventList();
  }
  private renderEventList(): void {
    if (!this.eventList) return;
    this.eventList.replaceChildren(element('h3', '战斗记录 · 最近 200 条（完整事件保留在回放）'));
    for (const text of this.eventTexts.slice().reverse()) this.eventList.append(element('p', text));
  }
  private renderShop(state: MatchState, ready: boolean): void {
    const section = element('section', '', 'shop-panel');
    const shop = element('div', '', 'touch-shop');
    state.shop.slots.forEach((offer, slot) => {
      const definition = offer.status === 'available' ? UNIT_DEFINITIONS[offer.definitionId] : null;
      const affordable = definition ? state.gold >= definition.cost : false;
      const button = this.button(`mobile:buy-${slot}`, '', () => this.actions.buy(slot, state.shop.generation), !ready || !definition);
      button.classList.add('shop-card');
      if (definition) {
        const identity = getHeroIdentity(definition.id);
        button.dataset.cost = String(definition.cost); button.classList.toggle('unaffordable', !affordable);
        button.dataset.unitDef = definition.id; button.dataset.unitStar = '1';
        const emblem = element('span', '', 'shop-emblem'); emblem.innerHTML = heroPortraitHtml(definition.id, 34, heroEmblemSvg(definition.id, 34));
        button.append(emblem, element('span', identity.name, 'shop-name'), traitLine(definition.id), element('span', `${definition.cost}`, 'shop-cost'));
        button.setAttribute('aria-label', `购买 ${identity.name}，${definition.cost} 金币${affordable ? '' : '，金币不足'}`);
      } else {
        // A shared-pool empty slot (online, §12.3) is out of stock, not a purchase; neither shows a hero.
        const empty = isEmptyShopSlot(offer);
        button.classList.toggle('shop-empty', empty);
        button.append(element('span', empty ? '缺货' : '已购买', 'shop-name'));
      }
      shop.append(button);
    });
    section.append(shop, element('p', `Lv.${state.level} 概率 ${getShopOdds(state.level).map((odds, index) => `${index + 1}费 ${odds}%`).join(' · ')}`, 'shop-odds')); (this.shopDock ?? this.root).append(section);
  }
  private renderBuilds(): void {
    const section = element('section', '', 'build-guide'); section.dataset.debug = 'build-guide';
    const builds = [
      ['四炮四哨', '崔丝塔娜 / 厄加特 / 伊泽瑞尔 / 库奇 · 艾瑞莉娅 / 芮尔 / 蕾欧娜 / 洛里斯', '麦迪 暂持物理装 → 中期两炮 → 升8找二星 库奇；出售持装者归还装备。', '库奇：死亡之刃 / 朔极之矛 / 海克斯科技枪刃；洛里斯：狂徒铠甲 / 巨龙之爪 / 石像鬼石板甲'],
      ['两狙四监察两哨', '麦迪 / 克格莫 · 德莱厄斯 / 范德尔 / 斯卡 / 盖伦 · 艾瑞莉娅 / 洛里斯', '6/7级寻找二星 克格莫、斯卡，保利息搜牌；8级补 盖伦。凯特琳 可替 麦迪。', '克格莫：鬼索的狂暴之刃 / 大天使之杖 / 海克斯科技枪刃；盖伦：狂徒铠甲 / 巨龙之爪 / 石像鬼石板甲'],
      ['四法四哨', '拉克丝 / 婕拉 / 娜美 / 佐伊 · 艾瑞莉娅 / 芮尔 / 蕾欧娜 / 洛里斯', '拉克丝/婕拉 过渡 → 娜美 中期 → 8级二星 佐伊；出售过渡持装者后重购羁绊挂件。', '佐伊：朔极之矛 / 灭世者的死亡之帽 / 海克斯科技枪刃；洛里斯：狂徒铠甲 / 巨龙之爪 / 石像鬼石板甲'],
    ];
    for (const [title, units, route, items] of builds) { const card = element('article', '', 'trait'); card.append(element('h3', title), element('p', units), element('p', route), element('p', items)); section.append(card); }
    for (const definition of Object.values(ANOMALY_DEFINITIONS)) section.append(element('p', `${definition.name}：${definition.description}`));
    section.append(element('p', '异常适配：库奇/崔丝塔娜 可选泰坦打击；克格莫/佐伊 可选法师护甲；库奇/佐伊 可选连杀。无需特定异常才能继续。'));
    section.append(element('p', '日程：强化 2-1 / 3-2 / 4-2 · 异常 4-6 · 终局 6-7。S13 14.24b 精选单人模式 · 无限单位池 · 补给代替选秀。', 'mode-note'));
    section.append(element('p', '目标：八人口、核心二星、输出至少两件成装、前排一件成装。4-6 绑定核心异常；组件来自每阶段 .4 补给；1-2～1-4 与各阶段 .7 为野怪回合，野怪掉落尚未开放。副羁绊只保留原生身份，本版本未开放。'));
    this.root.append(section);
  }
  snapshot() {
    const bounds: Record<string, { x: number; y: number; width: number; height: number; centerX: number; centerY: number }> = {};
    for (const scope of [this.root, this.modal, ...(this.shopDock ? [this.shopDock] : [])]) for (const node of Array.from(scope.querySelectorAll<HTMLElement>('[data-debug]'))) {
      const rect = node.getBoundingClientRect(); if (!rect.width || !rect.height || node.closest('[hidden]')) continue;
      bounds[node.dataset.debug!] = { x: rect.x, y: rect.y, width: rect.width, height: rect.height, centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2 };
    }
    return { bounds, recentEventText: [...this.eventTexts], selectedItemIds: [...this.selectedItems], tab: this.tab, choiceVisible: !this.modal.hidden && this.dismissalTimer === null,
      choiceText: this.modal.textContent, text: this.root.textContent, combatSourceText: this.combatText?.textContent ?? '', itemPointer: this.blocksSell };
  }
}
