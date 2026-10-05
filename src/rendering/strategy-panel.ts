import { getStageRound } from '../simulation/round-schedule';
import { UNIT_DEFINITIONS } from '../simulation/units';
import { ITEM_DEFINITIONS } from '../simulation/content/items';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import { AUGMENT_DEFINITIONS } from '../simulation/content/augments';
import { ANOMALY_DEFINITIONS } from '../simulation/content/anomalies';
import { deriveTraits } from '../simulation/trait-snapshot';
import { getUnitStats } from '../simulation/match';
import type { MatchState } from '../simulation/match-types';
import type { UnitLocation } from '../simulation/units';
import type { Effect } from '../simulation/strategy-types';
import { InputRouter, type Gesture } from './input-router';

interface PanelActions {
  readonly state: () => MatchState;
  readonly selectedUnit: () => string | null;
  readonly selectUnit: (id: string) => void;
  readonly combine: (a: string, b: string) => void;
  readonly equip: (item: string, unit: string, slot: number) => void;
  readonly choose: (choice: string, generation: number, definition: string) => void;
  readonly target: (choice: string, generation: number, unit: string) => void;
  readonly rerollAnomaly: (choice: string, generation: number) => void;
  readonly buy: (slot: number, generation: number) => void;
  readonly deploy: (id: string, location: UnitLocation) => void;
  readonly control: (name: 'reroll' | 'buy-xp' | 'sell' | 'start-combat' | 'continue' | 'new-match') => void;
  readonly unitAt: (x: number, y: number) => string | undefined;
  readonly cancelGesture: () => void;
  readonly status: (message: string) => void;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
export function describeEffect(effect: Effect): string {
  if (effect.kind === 'statFlat') return `${effect.stat} +${effect.amount}`;
  if (effect.kind === 'statPercentBps') return `${effect.stat} +${effect.bps / 100}%`;
  if (effect.kind === 'attackSpeedBps') return `攻速 +${effect.bps / 100}%`;
  const action = effect.action;
  const result = action.kind === 'grantShield' ? `护盾 ${action.amount} / ${action.durationTicks * 50 / 1000}s`
    : action.kind === 'gainMana' ? `Mana +${action.amount}` : `${action.damageType} 伤害 ${action.amount}`;
  return `${effect.hook}${effect.everyN > 1 ? ` 每${effect.everyN}次` : ''} → ${result}`;
}

const CHOICE_POINTER_QUIET_MS = 400;

/** Accessible DOM view over the same Match commands; it owns no game state. */
export class StrategyPanel {
  private readonly root: HTMLElement;
  private readonly modal: HTMLElement;
  private readonly disposers: (() => void)[] = [];
  private selectedItems: string[] = [];
  private tab: 'traits' | 'items' | 'units' = 'items';
  private pointerPosition: { x: number; y: number } | null = null;
  private itemDrag: { gesture: Gesture; x: number; y: number; moved: boolean; element: HTMLElement } | null = null;
  private choiceToken = '';
  private dismissalTimer: number | null = null;
  private combatText: HTMLElement | null = null;
  private statusText: HTMLElement | null = null;

  constructor(private readonly actions: PanelActions, private readonly router: InputRouter) {
    this.root = document.getElementById('strategy-root')!;
    this.modal = element('section', '', 'choice-overlay');
    this.modal.setAttribute('role', 'dialog'); this.modal.setAttribute('aria-modal', 'true');
    this.modal.setAttribute('aria-label', '构筑选择'); this.modal.hidden = true;
    document.body.append(this.modal);
    const trackPointer = (event: PointerEvent) => {
      this.pointerPosition = event.pointerType === 'touch' ? null : { x: event.clientX, y: event.clientY };
    };
    const move = (event: PointerEvent) => {
      trackPointer(event);
      const drag = this.itemDrag;
      if (!drag || event.pointerId !== drag.gesture.pointerId || !this.router.owns(drag.gesture)) return;
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) >= 6) drag.moved = true;
      if (drag.moved) { drag.element.classList.add('dragging'); this.actions.status('拖动物品到单位或空装备槽 · E 不会出售单位'); }
    };
    const release = (event: PointerEvent) => {
      const drag = this.itemDrag;
      if (!drag || event.pointerId !== drag.gesture.pointerId) return;
      this.itemDrag = null; drag.element.classList.remove('dragging');
      if (!this.router.release(drag.gesture)) return;
      if (drag.element.hasPointerCapture(event.pointerId)) drag.element.releasePointerCapture(event.pointerId);
      if (!drag.moved) { this.selectItem(drag.gesture.id); return; }
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-equip-unit]');
      const unitId = target?.dataset.equipUnit ?? this.actions.unitAt(event.clientX, event.clientY);
      if (!unitId) { this.actions.status('物品未装备 · 请放到我方单位或空装备槽'); return; }
      const state = this.actions.state();
      const slot = target ? Number(target.dataset.equipSlot) : [0, 1, 2].find(index => !state.items.some(item => item.location.kind === 'unit' && item.location.unitId === unitId && item.location.slot === index));
      if (slot === undefined) { this.actions.status('该单位的 3 个装备槽已满'); return; }
      this.actions.equip(drag.gesture.id, unitId, slot);
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
  reset(): void { this.cancel(); this.clearChoiceDismissal(); this.selectedItems = []; this.choiceToken = ''; }
  destroy(): void { this.cancel(); this.clearChoiceDismissal(); this.disposers.forEach(dispose => dispose()); this.root.replaceChildren(); this.modal.remove(); }
  status(message: string): void { if (this.statusText) this.statusText.textContent = message; }
  private button(name: string, label: string, action: () => void, disabled = false): HTMLButtonElement {
    const button = element('button', label); button.type = 'button'; button.dataset.debug = name; button.disabled = disabled;
    button.addEventListener('click', action);
    return button;
  }
  private selectItem(id: string) {
    if (this.actions.state().phase !== 'preparation') return;
    this.selectedItems = this.selectedItems.includes(id) ? this.selectedItems.filter(item => item !== id) : [...this.selectedItems.slice(-1), id];
    this.render();
  }
  render(): void {
    const state = this.actions.state(), ready = state.phase === 'preparation';
    this.selectedItems = this.selectedItems.filter(id => state.items.some(item => item.id === id && item.location.kind === 'inventory'));
    this.root.replaceChildren();
    const head = element('header'), stage = getStageRound(state.round);
    head.append(element('h2', `构筑 · Round ${state.round} · ${stage.stage}-${stage.round}`), element('p', `HP ${state.playerHp} · ${state.gold} G · Lv.${state.level} / ${state.xp} XP`, 'panel-hud'));
    this.root.append(head);
    const controls = element('div', '', 'mobile-controls');
    const controlsList = [['reroll', 'D · 搜牌 2 G'], ['buy-xp', 'F · 经验 4 G'], ['sell', 'E · 出售选中'], ['start-combat', 'Start Combat'], ['continue', 'Continue'], ['new-match', 'New Match']] as const;
    for (const [name, label] of controlsList) controls.append(this.button(`mobile:${name}`, label, () => {
      if (name === 'sell' && this.router.current?.kind === 'item') { this.actions.status('无出售单位目标 · 请先结束物品拖拽'); return; }
      this.actions.control(name);
    }));
    this.root.append(controls);
    this.statusText = element('p', ready ? '点物品选择；两件组件可合成；选物品后点空装备槽。' : state.phase === 'choice' ? '完成选择后继续运营' : state.phase === 'gameOver' ? 'Game Over · 点击 New Match' : '战斗与回合结算期间构筑已锁定', 'panel-status');
    this.statusText.setAttribute('role', 'status'); this.root.append(this.statusText);
    const tabs = element('nav', '', 'panel-tabs'); tabs.setAttribute('aria-label', '构筑面板');
    for (const [tab, label] of [['traits', '羁绊'], ['items', '装备'], ['units', '单位 / 部署']] as const) {
      const button = this.button(`panel:${tab}`, label, () => { this.actions.cancelGesture(); this.tab = tab; this.render(); });
      button.setAttribute('aria-pressed', String(this.tab === tab)); tabs.append(button);
    }
    this.root.append(tabs);
    this.combatText = element('section', '', 'combat-sources'); this.root.append(this.combatText); this.updateCombat();
    if (this.tab === 'traits') this.renderTraits(state);
    if (this.tab === 'items') this.renderItems(state, ready);
    if (this.tab === 'units') this.renderUnits(state, ready);
    const owned = element('section', '', 'owned-modifiers'); owned.append(element('h3', '永久构筑'));
    owned.append(element('p', `Augment: ${state.augments.map(augment => AUGMENT_DEFINITIONS[augment.definitionId].name).join(' / ') || '尚未选择'}`));
    const binding = state.anomalyBinding;
    owned.append(element('p', binding ? `Anomaly: ${ANOMALY_DEFINITIONS[binding.definitionId].name} → ${UNIT_DEFINITIONS[state.preparation.units.find(unit => unit.id === binding.unitId)!.definitionId].name} (${binding.unitId})` : 'Anomaly: 第 7 回合选择单位'));
    this.root.append(owned);
    this.renderChoice(state);
  }
  private renderTraits(state: MatchState): void {
    const list = element('section', '', 'trait-list'); list.dataset.debug = 'trait-panel';
    for (const snapshot of deriveTraits(state.preparation, 'player')) {
      const definition = TRAIT_DEFINITIONS[snapshot.traitId], next = definition.tiers.find(tier => tier.threshold > snapshot.count);
      const row = element('article', '', snapshot.tier > 0 ? 'trait active' : 'trait'); row.dataset.debug = `trait:${snapshot.traitId}`;
      row.append(element('h3', `${definition.name} · ${snapshot.count} / ${next?.threshold ?? 'MAX'} · tier ${snapshot.tier}`));
      row.append(element('p', `上阵不同单位：${snapshot.memberDefinitionIds.map(id => UNIT_DEFINITIONS[id].name).join('、') || '无'}`));
      row.append(element('p', definition.tiers.map(tier => `${tier.threshold}：${tier.effects.map(describeEffect).join('；')}`).join(' / ')));
      list.append(row);
    }
    this.root.append(list);
  }
  private renderItems(state: MatchState, ready: boolean): void {
    const section = element('section', '', 'item-panel'); section.dataset.items = 'true'; section.append(element('h3', '物品备战席'));
    const inventory = element('div', '', 'item-inventory');
    for (const item of state.items.filter(item => item.location.kind === 'inventory')) {
      const definition = ITEM_DEFINITIONS[item.definitionId];
      const button = this.button(`item:${item.id}`, `${definition.name}\n${definition.effects.map(describeEffect).join('；')}`, () => {}, !ready);
      button.setAttribute('aria-pressed', String(this.selectedItems.includes(item.id))); button.classList.add('item-card');
      button.dataset.itemId = item.id; button.title = `${item.id} · ${definition.id}`;
      button.addEventListener('pointerdown', event => {
        if (!ready || event.button !== 0) return;
        const gesture = this.router.begin('item', item.id, event.pointerId);
        if (!gesture) return;
        button.setPointerCapture(event.pointerId);
        this.itemDrag = { gesture, x: event.clientX, y: event.clientY, moved: false, element: button };
      });
      button.addEventListener('keydown', event => { if (event.code === 'Enter' || event.code === 'Space') { event.preventDefault(); this.selectItem(item.id); } });
      inventory.append(button);
    }
    section.append(inventory);
    const definitions = this.selectedItems.map(id => ITEM_DEFINITIONS[state.items.find(item => item.id === id)!.definitionId]);
    const recipe = definitions.length === 2 ? Object.values(ITEM_DEFINITIONS).find(item => item.recipe && [...item.recipe].sort().join('|') === definitions.map(item => item.id).sort().join('|')) : undefined;
    section.append(element('p', `选择：${definitions.map(definition => definition.name).join(' + ') || '无'}${recipe ? ` → ${recipe.name}` : ''}`));
    const selected = [...this.selectedItems];
    section.append(this.button('combine-items', recipe ? `合成 ${recipe.name}` : '选择两件组件合成', () => {
      if (this.router.current) { this.actions.status('请先结束当前拖拽，再确认合成'); return; }
      this.actions.combine(selected[0], selected[1]);
    }, !ready || !recipe));
    const recipes = element('details'); recipes.append(element('summary', '查看全部组件配方'));
    for (const item of Object.values(ITEM_DEFINITIONS)) if (item.recipe) recipes.append(element('p', `${item.recipe.map(id => ITEM_DEFINITIONS[id].name).join(' + ')} → ${item.name}：${item.effects.map(describeEffect).join('；')}`));
    section.append(recipes, element('h3', '单位装备 · 每单位 3 槽'));
    for (const unit of state.preparation.units.filter(unit => unit.team === 'player')) {
      const row = element('article', '', 'equipment-row');
      row.append(element('strong', `${UNIT_DEFINITIONS[unit.definitionId].name} ${'★'.repeat(unit.starLevel)} · ${unit.id}${state.anomalyBinding?.unitId === unit.id ? ' ◈ Anomaly' : ''}`));
      const slots = element('div', '', 'equipment-slots');
      for (let slot = 0; slot < 3; slot++) {
        const item = state.items.find(item => item.location.kind === 'unit' && item.location.unitId === unit.id && item.location.slot === slot);
        const chosen = this.selectedItems.at(-1);
        const button = this.button(`equipment:${unit.id}:${slot}`, item ? ITEM_DEFINITIONS[item.definitionId].name : `空槽 ${slot + 1}`, () => {
          if (this.router.current) { this.actions.status('请先结束当前拖拽，再点击装备槽'); return; }
          if (chosen) this.actions.equip(chosen, unit.id, slot); else this.actions.status('请先点选物品备战席中的一件物品');
        }, !ready);
        button.dataset.equipUnit = unit.id; button.dataset.equipSlot = String(slot); slots.append(button);
      }
      row.append(slots); section.append(row);
    }
    this.root.append(section);
  }
  private renderUnits(state: MatchState, ready: boolean): void {
    const section = element('section'); section.append(element('h3', '商店'));
    const shop = element('div', '', 'touch-shop');
    state.shop.slots.forEach((offer, slot) => shop.append(this.button(`mobile:buy-${slot}`, offer.status === 'available' ? `${UNIT_DEFINITIONS[offer.definitionId].name} · ${UNIT_DEFINITIONS[offer.definitionId].cost} G` : '已购买', () => this.actions.buy(slot, state.shop.generation), !ready || offer.status === 'purchased')));
    section.append(shop, element('h3', '先选单位，再点部署位置'));
    const roster = element('div', '', 'unit-roster');
    for (const unit of state.preparation.units.filter(unit => unit.team === 'player')) {
      const button = this.button(`mobile:unit:${unit.id}`, `${UNIT_DEFINITIONS[unit.definitionId].name} ${'★'.repeat(unit.starLevel)} · ${unit.location.kind === 'bench' ? '备战席' : `(${unit.location.cell.col},${unit.location.cell.row})`}${state.anomalyBinding?.unitId === unit.id ? ' ◈' : ''}`, () => { this.actions.selectUnit(unit.id); this.render(); });
      button.setAttribute('aria-pressed', String(this.actions.selectedUnit() === unit.id)); roster.append(button);
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
    for (let slot = 0; slot < state.preparation.benchSize; slot++) bench.append(this.button(`mobile:bench:${slot}`, `备 ${slot + 1}`, () => {
      const selected = this.actions.selectedUnit(); if (selected) this.actions.deploy(selected, { kind: 'bench', slot });
    }, !ready));
    section.append(bench); this.root.append(section);
  }
  private clearChoiceDismissal(): void {
    if (this.dismissalTimer !== null) window.clearTimeout(this.dismissalTimer);
    this.dismissalTimer = null;
    this.modal.classList.remove('dismissal-shield');
    this.modal.removeAttribute('aria-hidden'); delete this.modal.dataset.debug;
  }
  private shieldChoiceDismissal(): void {
    this.clearChoiceDismissal();
    // Consume the rest of the confirming pointer burst before exposing the
    // board below. Keyboard D/F/E still commit synchronously in preparation.
    this.modal.hidden = false; this.modal.replaceChildren();
    this.modal.classList.add('dismissal-shield'); this.modal.setAttribute('aria-hidden', 'true');
    this.modal.dataset.debug = 'choice-dismissal-shield';
    this.dismissalTimer = window.setTimeout(() => {
      this.clearChoiceDismissal(); this.renderChoice(this.actions.state());
    }, CHOICE_POINTER_QUIET_MS);
  }
  private renderChoice(state: MatchState): void {
    const choice = state.pendingChoice;
    if (!choice) {
      this.choiceToken = '';
      if (this.dismissalTimer === null) { this.modal.hidden = true; this.modal.replaceChildren(); }
      return;
    }
    this.clearChoiceDismissal();
    const token = `${choice.choiceId}:${choice.generation}:${choice.step}`;
    if (token === this.choiceToken) return;
    this.choiceToken = token; this.modal.hidden = false; this.modal.replaceChildren();
    const card = element('div', '', 'choice-dialog');
    card.append(element('h2', choice.kind === 'augment' ? '选择 Augment · 本局永久生效' : 'Anomaly · 单位永久进化'));
    card.append(element('p', '必须完成本次选择，才可继续搜牌、购买经验、装备与战斗。'));
    if (choice.step === 'target') {
      card.append(element('p', '先选择一个单位。锁定后不能换目标；升级时随单位保留。'));
      const targets = element('div', '', 'choice-targets');
      for (const unit of state.preparation.units.filter(unit => unit.team === 'player')) targets.append(this.button(`anomaly-target:${unit.id}`, `${UNIT_DEFINITIONS[unit.definitionId].name} ${'★'.repeat(unit.starLevel)} · ${unit.id}`, () => this.actions.target(choice.choiceId, choice.generation, unit.id)));
      card.append(targets);
    } else {
      if (choice.kind === 'anomaly') {
        const target = state.preparation.units.find(unit => unit.id === choice.targetId);
        card.append(element('p', `已锁定 ${target ? UNIT_DEFINITIONS[target.definitionId].name : ''} (${choice.targetId}) · 余额 ${state.gold} G · 已刷新 ${choice.rerollCount} 次`, 'anomaly-target-lock'));
      }
      const offers = element('div', '', 'choice-cards');
      for (const id of choice.offers) {
        const definition = (choice.kind === 'augment' ? AUGMENT_DEFINITIONS : ANOMALY_DEFINITIONS)[id];
        const button = this.button(`choice:${id}`, `${definition.name}\n${definition.description}\n${definition.effects.map(describeEffect).join('；')}`, () => {
          this.actions.choose(choice.choiceId, choice.generation, id);
          if (!this.actions.state().pendingChoice) this.shieldChoiceDismissal();
        });
        button.dataset.choiceId = choice.choiceId; button.dataset.generation = String(choice.generation); offers.append(button);
      }
      card.append(offers);
      if (choice.kind === 'anomaly') card.append(this.button('anomaly-reroll', `刷新三选项 · 2 G（余额 ${state.gold} G）`, () => this.actions.rerollAnomaly(choice.choiceId, choice.generation), state.gold < 2));
    }
    this.modal.append(card);
  }
  updateCombat(): void {
    const state = this.actions.state(), combat = state.combat, node = this.combatText;
    if (!node) return;
    node.replaceChildren();
    if (!combat) return;
    const equipped = state.items.find(item => item.location.kind === 'unit');
    const preferred = this.actions.selectedUnit() ?? state.anomalyBinding?.unitId ?? (equipped?.location.kind === 'unit' ? equipped.location.unitId : null);
    const unit = combat.units.find(unit => unit.id === preferred) ?? combat.units.find(unit => unit.team === 'player');
    if (!unit) return;
    const base = getUnitStats(unit.definitionId, unit.starLevel);
    node.append(element('h3', `Combat · ${UNIT_DEFINITIONS[unit.definitionId].name}`));
    node.append(element('p', `HP ${unit.hp}/${unit.maxHp} · Mana ${unit.mana}/${unit.maxMana} · 盾 ${unit.shield}`));
    node.append(element('p', `Base HP ${base.health} → ${unit.maxHp} · AD ${base.attack} → ${unit.attackDamage} · Armor ${base.armor} → ${unit.armor} · MR ${base.magicResist} → ${unit.magicResist}`));
    const ability = unit.ability;
    node.append(element('p', `Ability · ${ability.kind === 'selfShield' ? '护盾' : ability.damageType === 'magic' ? '魔法伤害' : '物理伤害'} ${ability.amount} · 普攻间隔 ${unit.attackIntervalTicks * 50}ms`));
    for (const source of unit.sources ?? []) node.append(element('p', `${source.source.sourceKind} · ${source.source.sourceDefinitionId}：${describeEffect(source.effect)}`));
  }
  snapshot() {
    const bounds: Record<string, { x: number; y: number; width: number; height: number; centerX: number; centerY: number }> = {};
    for (const scope of [this.root, this.modal]) for (const node of Array.from(scope.querySelectorAll<HTMLElement>('[data-debug]'))) {
      const rect = node.getBoundingClientRect(); if (!rect.width || !rect.height || node.closest('[hidden]')) continue;
      bounds[node.dataset.debug!] = { x: rect.x, y: rect.y, width: rect.width, height: rect.height, centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2 };
    }
    return { bounds, selectedItemIds: [...this.selectedItems], tab: this.tab, choiceVisible: !this.modal.hidden && this.dismissalTimer === null,
      choiceText: this.modal.textContent, text: this.root.textContent, combatSourceText: this.combatText?.textContent ?? '', itemPointer: this.blocksSell };
  }
}
