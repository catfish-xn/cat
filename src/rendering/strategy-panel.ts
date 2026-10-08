import { displayUnitName } from './display-names';
export { displayUnitName } from './display-names';
import { getRoundKind, getStageRound } from '../simulation/round-schedule';
import { UNIT_DEFINITIONS } from '../simulation/units';
import { ITEM_DEFINITIONS } from '../simulation/content/items';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import { AUGMENT_DEFINITIONS } from '../simulation/content/augments';
import { ANOMALY_DEFINITIONS } from '../simulation/content/anomalies';
import { deriveTraits } from '../simulation/trait-snapshot';
import { getUnitStats, getXpToNextLevel, getShopOdds, needsAnomalyRecruitment } from '../simulation/match';
import type { MatchState } from '../simulation/match-types';
import type { UnitLocation } from '../simulation/units';
import type { Effect } from '../simulation/strategy-types';
import type { CombatEvent, CombatOrigin } from '../simulation/combat-types';
import { readCombatStats } from '../simulation/combat-s13';
import { getInterestGold } from '../simulation/economy';
import { combatEventText, originLabel } from './combat-feedback';
import { readUnitStatusRows, shieldSource, statusRowText, ticksToSeconds } from '../presentation/combat-status';
import { InputRouter, type Gesture } from './input-router';
import { getDeploymentCap } from '../simulation/match';
import { getPlayerDeploymentCount } from '../simulation/game';
import { getHeroIdentity, heroEmblemSvg, heroTraitLabels } from '../presentation/hero-identity';
import { heroPortraitHtml, s13IconHtml } from '../presentation/s13-assets';
import { attachItemPopover, catalogEntry, createItemCodex, itemDescriptions, itemMarkHtml, itemTags } from '../presentation/item-codex';

type ControlName = 'reroll' | 'buy-xp' | 'sell' | 'start-combat' | 'continue' | 'new-match';
const PHASE_LABEL: Readonly<Record<MatchState['phase'], string>> = { preparation: '准备阶段', choice: '构筑选择', combat: '战斗中', settlement: '回合结算', gameOver: '对局结束' };
const PHASE_HINT: Readonly<Record<MatchState['phase'], string>> = {
  preparation: '购买、部署、装备后，点击开始战斗', choice: '完成三选一后继续运营', combat: '自动战斗进行中 · 运营已锁定',
  settlement: '收入与经验已到账 · 点击继续进入下一回合', gameOver: '本局结束 · 点击新局重新开始',
};

interface PanelActions {
  readonly state: () => MatchState;
  readonly shopLock: (locked: boolean, generation: number) => void;
  readonly selectedUnit: () => string | null;
  readonly selectUnit: (id: string) => void;
  readonly combine: (a: string, b: string) => void;
  readonly equip: (item: string, unit: string, slot: number) => void;
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
}

function traitLine(definitionId: string): HTMLElement {
  const line = element('span', '', 'shop-trait');
  for (const label of heroTraitLabels(definitionId)) line.append(element('span', label.name, label.open ? 'trait-open' : 'trait-closed'));
  return line;
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
const TERM: Readonly<Record<string,string>> = {
  health:'生命', maxHp:'最大生命', attack:'攻击力', attackDamage:'攻击力', armor:'护甲', magicResist:'魔抗', abilityPower:'法强', initialMana:'初始法力', maxMana:'最大法力', attackRange:'射程',
  attackSpeed:'攻速', attackSpeedBps:'攻速', range:'射程', stun:'眩晕', damageReduction:'减伤', armorReduction:'护甲削减', resistanceFlat:'双抗', channel:'引导', redirect:'伤害分担',
  combatStart:'开战时', onAttack:'普攻时', onCast:'施法时', onHpLoss:'损失生命时', physical:'物理', magic:'魔法',
  ability:'技能', trait:'羁绊', item:'装备', augment:'强化', anomaly:'异常', enemyGrowth:'敌方成长',
};
const term = (value: string) => TERM[value] ?? value;
const definitionName = (id: string) => (UNIT_DEFINITIONS[id] ? displayUnitName(id) : undefined) ?? ITEM_DEFINITIONS[id]?.name ?? TRAIT_DEFINITIONS[id]?.name ?? AUGMENT_DEFINITIONS[id]?.name ?? ANOMALY_DEFINITIONS[id]?.name ?? '未知来源';
export function describeEffect(effect: Effect): string {
  if (effect.kind === 'mechanic') {
    const v = effect.values, pct = (key: string) => `${v[key] / 100}%`;
    const descriptions: Record<string, string> = {
      rageblade: `每次普攻叠加 ${pct('attackSpeedBps')} 攻速`, damageAmp: `伤害增幅 ${pct('bps')}`,
      extraAttackMana: `每次普攻额外 ${v.amount} 法力${v.backRowOnly ? '（最后一排）' : ''}`,
      archangel: `每 ${v.periodTicks * .05} 秒增加 ${v.abilityPower} 法强`, dragonClaw: `每 ${v.periodTicks * .05} 秒治疗 ${pct('healMaxHpBps')} 最大生命`,
      gargoyle: `每个以持有者为目标的敌人增加 ${v.resistPerEnemy} 双抗`, gunblade: `实际伤害的 ${pct('selfHealBps')} 自疗、${pct('allyHealBps')} 治疗最低生命比例友军`,
      artillery: `每 ${v.everyN} 次普攻造成 ${pct('adBps')} 攻击力 范围物理伤害`, sniper: `每格距离增加 ${pct('damageBpsPerHex')} 伤害`,
      watcher: `减伤 ${pct('reductionBps')}；生命超过 ${pct('thresholdBps')} 时为 ${pct('healthyReductionBps')}`,
      acquisitionGold: `立即获得 ${v.amount} 金币`, glassCannon: `最后一排初始生命 ${pct('startingHealthBps')}、伤害增加 ${pct('damageAmpBps')}`,
      pumpingUp: `每轮增加 ${pct('attackSpeedBpsPerRound')} 攻速`, investment: `每点利息永久增加 ${v.healthPerInterest} 生命`,
      bulkyBuddies: `相邻双人组获得 ${v.health} 生命，触发 ${pct('shieldMaxHpBps')} 最大生命护盾，持续 ${v.durationTicks * .05} 秒`,
      titanic: `普攻附加 ${pct('adBps')} 攻击力 物理伤害，命中目标及相邻格`, mageArmor: `获得最终法强 ${pct('apBps')} 的双抗`, killStreak: `击杀后存活获得 ${v.mana} 法力`,
    };
    return descriptions[effect.mechanic] ?? effect.mechanic;
  }
  if (effect.kind === 'statFlat') return `${term(effect.stat)} +${effect.amount}`;
  if (effect.kind === 'statPercentBps') return `${term(effect.stat)} +${effect.bps / 100}%`;
  if (effect.kind === 'attackSpeedBps') return `攻速 +${effect.bps / 100}%`;
  const action = effect.action;
  const result = action.kind === 'grantShield' ? `护盾 ${action.amount} / ${action.durationTicks * 50 / 1000}s`
    : action.kind === 'gainMana' ? `法力 +${action.amount}` : `${term(action.damageType)}伤害 ${action.amount}`;
  return `${term(effect.hook)}${effect.everyN > 1 ? ` 每${effect.everyN}次` : ''} → ${result}`;
}

/** Describe authored benefits by audience; merge additive flat stats for the member total. */
export function describeTraitTier(definition: import('../simulation/strategy-types').TraitDefinition,
  tier: import('../simulation/strategy-types').TraitTier): string {
  const text = (effects: readonly Effect[]) => effects.map(describeEffect).join('；') || '无';
  const combined: Effect[] = [];
  for (const effect of [...tier.effects, ...(tier.memberEffects ?? [])]) {
    const index = effect.kind === 'statFlat' ? combined.findIndex(value => value.kind === 'statFlat' && value.stat === effect.stat) : -1;
    const prior = combined[index];
    if (index >= 0 && prior.kind === 'statFlat' && effect.kind === 'statFlat') combined[index] = { ...prior, amount: prior.amount + effect.amount };
    else combined.push(effect);
  }
  return `${tier.threshold}：${definition.target === 'team' ? '全队收益' : '职业成员收益'}：${text(tier.effects)}`
    + (tier.memberEffects?.length ? `；职业成员额外收益：${text(tier.memberEffects)}；职业成员最终合计：${text(combined)}` : '');
}

const CHOICE_POINTER_QUIET_MS = 400;
const LIFECYCLE_QUIET_MS = 400;
const LIFECYCLE: ReadonlySet<string> = new Set(['start-combat', 'continue', 'new-match']);

/** Accessible DOM view over the same Match commands; it owns no game state. */
export class StrategyPanel {
  private readonly root: HTMLElement;
  private readonly modal: HTMLElement;
  private readonly disposers: (() => void)[] = [];
  private selectedItems: string[] = [];
  private tab: 'traits' | 'items' | 'units' | 'builds' | 'events' = 'items';
  private lastCombatTick = -1;
  private lastCombatId: string | undefined;
  private eventList: HTMLElement | null = null;
  private eventTexts: string[] = [];
  private eventCombatId: string | undefined;
  private pointerPosition: { x: number; y: number } | null = null;
  private itemDrag: { gesture: Gesture; x: number; y: number; moved: boolean; element: HTMLElement } | null = null;
  private choiceToken = '';
  private lifecycleGuard: { at: number; name: ControlName } | null = null;
  private dismissalTimer: number | null = null;
  private focusFrame: number | null = null;
  private combatText: HTMLElement | null = null;
  private statusText: HTMLElement | null = null;
  /** Static B4 catalogue view; built once so its filter and open state survive re-renders. */
  private codex: HTMLElement | null = null;

  constructor(private readonly actions: PanelActions, private readonly router: InputRouter) {
    this.root = document.getElementById('strategy-root')!; this.root.tabIndex = -1;
    this.modal = element('section', '', 'choice-overlay');
    this.modal.setAttribute('role', 'dialog'); this.modal.setAttribute('aria-modal', 'true');
    this.modal.setAttribute('aria-label', '构筑选择'); this.modal.tabIndex = -1; this.modal.hidden = true;
    document.body.append(this.modal);
    this.disposers.push(attachItemPopover(this.root));
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
  reset(): void { this.eventTexts = []; this.eventCombatId = undefined; this.lastCombatTick = -1; this.lastCombatId = undefined; this.cancel(); this.clearChoiceDismissal(); this.selectedItems = []; this.choiceToken = ''; }
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
    this.root.replaceChildren(); this.eventList = null;
    const stage = getStageRound(state.round), xp = getXpToNextLevel(state.level), interest = getInterestGold(state.gold);
    const head = element('header', '', 'hud-bar'); head.dataset.phase = state.phase;
    const title = element('div', '', 'hud-title');
    title.append(element('span', PHASE_LABEL[state.phase], `phase-badge phase-${state.phase}`), element('h2', `${stage.stage}-${stage.round} · ${{ pvp: '对战', pve: '野怪', supply: '补给' }[getRoundKind(state.round)]}`));
    const help = this.button('help-open', '？帮助', () => this.actions.help()); help.classList.add('help-button'); title.append(help);
    head.append(title);
    const stats = element('div', '', 'hud-stats panel-hud');
    const chip = (label: string, value: string, kind: string) => { const node = element('div', '', `hud-chip hud-${kind}`); node.append(element('span', label, 'hud-label'), element('strong', value)); stats.append(node); };
    chip('生命', String(state.playerHp), 'hp'); chip('金币', `${state.gold}`, 'gold');
    chip('等级', `${state.level}${xp === null ? ' · 满' : ` · ${state.xp}/${xp}`}`, 'level');
    chip('人口', `${getPlayerDeploymentCount(state.preparation)}/${getDeploymentCap(state)}`, 'pop');
    head.append(stats);
    head.append(element('p', `利息 +${interest} · ${state.streak.kind === 'win' ? '连胜' : state.streak.kind === 'loss' ? '连败' : '连胜败'} ${state.streak.count} · ${PHASE_HINT[state.phase]}`, 'hud-hint'));
    this.root.append(head);
    // One phase-appropriate primary action; the other lifecycle buttons stay reachable as secondary.
    const primary: ControlName = state.phase === 'settlement' ? 'continue' : state.phase === 'gameOver' ? 'new-match' : 'start-combat';
    const labels: Record<ControlName, string> = { reroll: 'D · 刷新 2', 'buy-xp': 'F · 经验 4', sell: 'E · 出售', 'start-combat': state.phase === 'combat' ? '战斗进行中…' : state.phase === 'choice' ? '请先完成选择' : getRoundKind(state.round) === 'supply' ? '领取补给' : '开始战斗', continue: '继续', 'new-match': '新局' };
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
      return button;
    };
    actions.append(controlButton(primary, 'primary-action'));
    const controls = element('div', '', 'mobile-controls'); controls.classList.toggle('locked', !ready);
    for (const name of ['reroll', 'buy-xp', 'sell'] as const) controls.append(controlButton(name, 'economy-action'));
    const lock = this.button('shop-lock', state.shop.locked ? '🔒 已锁店' : '锁店', () => this.actions.shopLock(!state.shop.locked, state.shop.generation), !ready);
    lock.setAttribute('aria-pressed', String(Boolean(state.shop.locked))); lock.classList.add('economy-action'); controls.append(lock);
    actions.append(controls);
    this.root.append(actions);
    // Lifecycle buttons that are not the current primary action sit below the shop,
    // keeping the shop within the first screen on small phones.
    const secondary = element('div', '', 'secondary-controls');
    for (const name of (['start-combat', 'continue', 'new-match'] as const).filter(name => name !== primary)) secondary.append(controlButton(name, 'secondary-action'));
    this.renderShop(state, ready);
    this.root.append(secondary);
    const result = state.roundResults.at(-1);
    if (result) {
      const receipt = element('details', '', 'income-receipt'); receipt.dataset.debug = 'income-receipt';
      receipt.append(element('summary', `上轮收入 +${result.income} 金币 · 生命 ${result.hpBefore} → ${result.hpAfter}`));
      const income = result.incomeBreakdown;
      receipt.append(element('p', `基础 ${income.base} + 胜利 ${income.win} + 利息 ${income.interest}（基数 ${result.interestBasis}）+ 连胜败 ${income.streak} = ${result.income} 金币；余额 ${result.goldBefore} → ${result.goldAfter}；经验 +${result.xpAwarded}/${result.xpRequested}`));
      this.root.append(receipt);
    }
    this.statusText = element('p', ready ? '点物品选择；两件组件可合成；选物品后点空装备槽。' : state.phase === 'choice' ? '完成选择后继续运营' : state.phase === 'gameOver' ? `${state.outcome === 'victory' ? '胜利 · 完成最终挑战' : '失败 · 对局结束'} · 点击新局` : '战斗与回合结算期间构筑已锁定', 'panel-status');
    this.statusText.setAttribute('role', 'status'); this.root.append(this.statusText);
    const tabs = element('nav', '', 'panel-tabs'); tabs.setAttribute('aria-label', '构筑面板');
    for (const [tab, label] of [['traits', '羁绊'], ['items', '装备'], ['units', '部署'], ['builds', '构筑'], ['events', '记录']] as const) {
      const button = this.button(`panel:${tab}`, label, () => { this.actions.cancelGesture(); this.tab = tab; this.render(); });
      button.setAttribute('aria-pressed', String(this.tab === tab)); tabs.append(button);
    }
    this.root.append(tabs);
    this.combatText = element('section', '', 'combat-sources'); this.root.append(this.combatText); this.lastCombatTick = -1; this.lastCombatId = undefined; this.updateCombat();
    if (this.tab === 'traits') this.renderTraits(state);
    if (this.tab === 'items') this.renderItems(state, ready);
    if (this.tab === 'units') this.renderUnits(state, ready);
    if (this.tab === 'builds') this.renderBuilds();
    if (this.tab === 'events') { this.eventList = element('section', '', 'battle-record'); this.eventList.dataset.debug = 'battle-record'; this.root.append(this.eventList); this.renderEventList(); }
    const owned = element('section', '', 'owned-modifiers'); owned.append(element('h3', '永久构筑'));
    owned.append(element('p', `强化： ${state.augments.map(augment => AUGMENT_DEFINITIONS[augment.definitionId].name).join(' / ') || '尚未选择'}`));
    if (needsAnomalyRecruitment(state)) owned.append(element('p', '4-6 异常等待招募：先购买一名棋子，再选择异常目标。刷新与经验购买必须保留招募资金。', 'anomaly-recruitment'));
    const binding = state.anomalyBinding;
    owned.append(element('p', binding ? `异常： ${ANOMALY_DEFINITIONS[binding.definitionId].name} → ${displayUnitName(state.preparation.units.find(unit => unit.id === binding.unitId)!.definitionId)}` : '异常： 4-6 选择单位'));
    this.root.append(owned);
    this.renderChoice(state); this.lastCombatTick = -1; this.updateCombat();
  }
  private renderTraits(state: MatchState): void {
    const list = element('section', '', 'trait-list'); list.dataset.debug = 'trait-panel';
    for (const snapshot of deriveTraits(state.preparation, 'player')) {
      const definition = TRAIT_DEFINITIONS[snapshot.traitId], next = definition.tiers.find(tier => tier.threshold > snapshot.count);
      const row = element('article', '', snapshot.tier > 0 ? 'trait active' : 'trait'); row.dataset.debug = `trait:${snapshot.traitId}`;
      const title = element('h3', `${definition.name} · ${snapshot.count} / ${next?.threshold ?? '已满'} · 档位 ${snapshot.tier}`);
      title.insertAdjacentHTML('afterbegin', s13IconHtml('trait', snapshot.traitId, 20, 'trait-icon'));
      row.append(title);
      row.append(element('p', `上阵不同单位：${snapshot.memberDefinitionIds.map(id => displayUnitName(id)).join('、') || '无'}`));
      row.append(element('p', definition.tiers.map(tier => describeTraitTier(definition, tier)).join(' / ')));
      list.append(row);
    }
    this.root.append(list);
  }
  private renderItems(state: MatchState, ready: boolean): void {
    const section = element('section', '', 'item-panel'); section.dataset.items = 'true'; section.append(element('h3', '物品备战席'));
    const inventory = element('div', '', 'item-inventory');
    for (const item of state.items.filter(item => item.location.kind === 'inventory')) {
      const definition = ITEM_DEFINITIONS[item.definitionId];
      const tags = catalogEntry(item.definitionId) ? itemTags(catalogEntry(item.definitionId)!).map(tag => tag.text) : [];
      const button = this.button(`item:${item.id}`, `${definition.name}${tags.length ? `\n${tags.join(' · ')}` : ''}`, () => {}, !ready);
      button.setAttribute('aria-pressed', String(this.selectedItems.includes(item.id))); button.classList.add('item-card');
      button.insertAdjacentHTML('afterbegin', itemMarkHtml(item.definitionId, 28));
      button.dataset.itemDef = item.definitionId; button.dataset.itemId = item.id; button.title = `${item.id} · ${definition.id}`;
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
    section.append(element('h3', '单位装备 · 每单位 3 槽'));
    for (const unit of state.preparation.units.filter(unit => unit.team === 'player')) {
      const row = element('article', '', 'equipment-row');
      row.append(element('strong', `${displayUnitName(unit.definitionId)} ${'★'.repeat(unit.starLevel)}${state.anomalyBinding?.unitId === unit.id ? ' ◈ 异常' : ''}`));
      const slots = element('div', '', 'equipment-slots');
      for (let slot = 0; slot < 3; slot++) {
        const item = state.items.find(item => item.location.kind === 'unit' && item.location.unitId === unit.id && item.location.slot === slot);
        const chosen = this.selectedItems.at(-1);
        const button = this.button(`equipment:${unit.id}:${slot}`, item ? ITEM_DEFINITIONS[item.definitionId].name : `空槽 ${slot + 1}`, () => {
          if (this.router.current) { this.actions.status('请先结束当前拖拽，再点击装备槽'); return; }
          if (chosen) this.actions.equip(chosen, unit.id, slot); else this.actions.status('请先点选物品备战席中的一件物品');
        }, !ready);
        if (item) { button.insertAdjacentHTML('afterbegin', itemMarkHtml(item.definitionId, 22)); button.dataset.itemDef = item.definitionId; }
        button.dataset.equipUnit = unit.id; button.dataset.equipSlot = String(slot); slots.append(button);
      }
      row.append(slots); section.append(row);
    }
    section.append(this.codex ??= createItemCodex());
    this.root.append(section);
  }
  private renderUnits(state: MatchState, ready: boolean): void {
    const section = element('section'); section.append(element('h3', '先选单位，再点部署位置'));
    const roster = element('div', '', 'unit-roster');
    for (const unit of state.preparation.units.filter(unit => unit.team === 'player')) {
      const button = this.button(`mobile:unit:${unit.id}`, `${displayUnitName(unit.definitionId)} ${'★'.repeat(unit.starLevel)} · ${unit.location.kind === 'bench' ? '备战席' : `(${unit.location.cell.col},${unit.location.cell.row})`}${state.anomalyBinding?.unitId === unit.id ? ' ◈' : ''}`, () => { this.actions.selectUnit(unit.id); this.render(); });
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
    card.append(element('h2', choice.kind === 'component' ? '补给 · 选择一件组件' : choice.kind === 'augment' ? '选择强化 · 本局永久生效' : '异常 · 单位永久进化'));
    card.append(element('p', '必须完成本次选择，才可继续搜牌、购买经验、装备与战斗。'));
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
        const button = this.button(`choice:${id}`, `${definition.name}\n${'description' in definition ? definition.description : '领取后可合成或装备'}\n${choice.kind === 'component' ? itemDescriptions(id).join('；') : definition.effects.map(describeEffect).join('；')}`, () => {
          this.actions.choose(choice.choiceId, choice.generation, id);
          const after = this.actions.state().pendingChoice;
          if (!after || after.choiceId !== choice.choiceId || after.generation !== choice.generation) this.shieldChoiceDismissal();
        });
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
    const state = this.actions.state(), combat = state.combat, node = this.combatText;
    if (!node) return;
    if (combat && this.lastCombatId === combat.combatId && this.lastCombatTick === combat.tick) return;
    if (combat && this.lastCombatId === combat.combatId && combat.status === 'running' && combat.tick - this.lastCombatTick < 2) return;
    this.lastCombatId = combat?.combatId; this.lastCombatTick = combat?.tick ?? -1;
    node.replaceChildren();
    if (!combat) {
      const selected = state.preparation.units.find(unit => unit.id === this.actions.selectedUnit());
      if (selected) {
        const definition = UNIT_DEFINITIONS[selected.definitionId], stats = getUnitStats(selected.definitionId, selected.starLevel);
        node.append(element('h3', `${displayUnitName(selected.definitionId)} ${'★'.repeat(selected.starLevel)}`), element('p', `基础 生命 ${stats.health} · 攻击力 ${stats.attack} · 护甲 ${stats.armor} · 魔抗 ${stats.magicResist} · 法力 ${stats.initialMana}/${stats.maxMana}`));
        node.append(element('p', `职业：${definition.traits.map(id => TRAIT_DEFINITIONS[id]?.name ?? `${id}（本版本未开放）`).join(' / ')}`));
      }
      return;
    }
    const equipped = state.items.find(item => item.location.kind === 'unit');
    const preferred = this.actions.selectedUnit() ?? state.anomalyBinding?.unitId ?? (equipped?.location.kind === 'unit' ? equipped.location.unitId : null);
    const unit = combat.units.find(unit => unit.id === preferred) ?? combat.units.find(unit => unit.team === 'player');
    if (!unit) return;
    const base = getUnitStats(unit.definitionId, unit.starLevel);
    const current = readCombatStats(unit, combat);
    node.append(element('h3', `战斗 · ${displayUnitName(unit.definitionId)}`));
    node.append(element('p', `生命 ${unit.hp}/${unit.maxHp} · 法力 ${unit.mana}/${unit.maxMana} · 盾 ${unit.shield}`));
    node.append(element('p', `基础最大生命 ${base.health} → 本场最大生命 ${unit.maxHp}`));
    node.append(element('p', '基础 → 开战冻结 → 当前（含技能与状态）', 'stat-columns'));
    const statRows: readonly [string, string, number | string, number | string, number][] = [
      ['ad', '攻击力', base.attack, unit.attackDamage, current.attackDamage],
      ['ap', '法强', '—', unit.abilityPower ?? '—', current.abilityPower],
      ['attack-interval', '攻速 / 普攻间隔(ms)', base.attackIntervalTicks * 50, unit.attackIntervalTicks * 50, current.attackIntervalTicks * 50],
      ['armor', '护甲', base.armor, unit.armor, current.armor],
      ['magic-resist', '魔抗', base.magicResist, unit.magicResist, current.magicResist],
      ['range', '射程(格)', base.attackRange, unit.attackRange, current.attackRange],
    ];
    for (const [id, label, original, frozen, value] of statRows) {
      const row = element('p', `${label} ${original} → ${frozen} → ${value}`);
      row.dataset.debug = `combat-stat:${id}`; row.dataset.current = String(value); node.append(row);
    }
    const ability = unit.ability;
    node.append(element('p', `技能 · ${ability.kind === 's13' ? `${displayUnitName(ability.championId)} 技能` : `${ability.kind === 'selfShield' ? '护盾' : ability.damageType === 'magic' ? '魔法伤害' : '物理伤害'} ${ability.amount}`} · 普攻间隔 ${current.attackIntervalTicks * 50}ms`));
    node.append(element('p', `当前目标 ${combat.units.find(target => target.id === unit.targetId) ? definitionName(combat.units.find(target => target.id === unit.targetId)!.definitionId) : '无'}`));
    const label = (origin: CombatOrigin) => originLabel(origin, id => this.combatUnitName(id));
    for (const layer of unit.shieldLayers ?? []) {
      if (layer.remaining <= 0) continue;
      const m8 = layer.m8State;
      node.append(element('p', `盾 ${layer.remaining} / ${layer.granted}${m8 ? ` · 已吸收 ${m8.absorbed}${m8.decayed ? ` · 已衰减 ${m8.decayed}` : ''}` : ''} · 剩余 ${ticksToSeconds(layer.expiresAtTick - combat.tick)}（第 ${layer.expiresAtTick} 刻结束） · ${label(shieldSource(layer))}`, 'combat-shield'));
    }
    for (const row of readUnitStatusRows(combat, unit.id)) {
      const line = element('p', statusRowText(row, combat.tick, label), `combat-status${row.harmful ? ' harmful' : ''}${row.state === 'suppressed' || row.state === 'pending' ? ' inactive' : ''}`);
      line.dataset.debug = `combat-status:${row.kind}`; node.append(line);
    }
    for (const source of unit.sources ?? []) node.append(element('p', `${term(source.source.sourceKind)} · ${definitionName(source.source.sourceDefinitionId)}：${describeEffect(source.effect)}`));
  }
  private combatUnitName(id: string | null): string {
    if (!id) return '无';
    const state = this.actions.state();
    const unit = state.combat?.units.find(value => value.id === id) ?? state.preparation.units.find(value => value.id === id);
    return unit ? `${displayUnitName(unit.definitionId)} ${'★'.repeat(unit.starLevel)}` : '历史单位';
  }
  observeEvents(events: readonly CombatEvent[]): void {
    if (!events.length) return;
    if (events.length && events[0].combatId !== this.eventCombatId) { this.eventTexts = []; this.eventCombatId = events[0].combatId; }
    for (const event of events) { const text = combatEventText(event, id => this.combatUnitName(id)); if (text) this.eventTexts.push(text); }
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
        const emblem = element('span', '', 'shop-emblem'); emblem.innerHTML = heroPortraitHtml(definition.id, 34, heroEmblemSvg(definition.id, 34));
        button.append(emblem, element('span', identity.name, 'shop-name'), traitLine(definition.id), element('span', `${definition.cost}`, 'shop-cost'));
        button.setAttribute('aria-label', `购买 ${identity.name}，${definition.cost} 金币${affordable ? '' : '，金币不足'}`);
      } else button.append(element('span', '已购买', 'shop-name'));
      shop.append(button);
    });
    section.append(shop, element('p', `Lv.${state.level} 概率 ${getShopOdds(state.level).map((odds, index) => `${index + 1}费 ${odds}%`).join(' · ')}`, 'shop-odds')); this.root.append(section);
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
    section.append(element('p', '目标：八人口、核心二星、输出至少两件成装、前排一件成装。4-6 绑定核心异常；组件来自开局、每阶段 .4 补给及 .7 野怪。副羁绊只保留原生身份，本版本未开放。'));
    this.root.append(section);
  }
  snapshot() {
    const bounds: Record<string, { x: number; y: number; width: number; height: number; centerX: number; centerY: number }> = {};
    for (const scope of [this.root, this.modal]) for (const node of Array.from(scope.querySelectorAll<HTMLElement>('[data-debug]'))) {
      const rect = node.getBoundingClientRect(); if (!rect.width || !rect.height || node.closest('[hidden]')) continue;
      bounds[node.dataset.debug!] = { x: rect.x, y: rect.y, width: rect.width, height: rect.height, centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2 };
    }
    return { bounds, recentEventText: [...this.eventTexts], selectedItemIds: [...this.selectedItems], tab: this.tab, choiceVisible: !this.modal.hidden && this.dismissalTimer === null,
      choiceText: this.modal.textContent, text: this.root.textContent, combatSourceText: this.combatText?.textContent ?? '', itemPointer: this.blocksSell };
  }
}
