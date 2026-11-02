import { unitHoverCard } from './hover-card';
import { ORB_TIER_TEXT } from './orb-loot';
import { orbCardBody } from '../rendering/online/orb-dock';
/** Lazy inspect UI. All numbers are content/display projections; no planning bonus rules live here. */
import { UNIT_DEFINITIONS, type StarLevel } from '../simulation/units';
import { getUnitStats } from '../simulation/unit-stats';
import { abilityDisplayValues } from '../simulation/ability-display';
import { S13_ABILITY_DATA } from '../simulation/content/abilities';
import type { CombatViewUnit } from './combat-display';
import type { UnitBattleStats } from './battle-ranking';
import { abilityText, fillAbilityTemplate } from './ability-text';
import { fourStarBaseStats } from './d14-display';
import { heroTraitTagsWithIds } from './hero-identity';
import { s13IconHtml } from './s13-assets';
import { catalogEntry, itemCardBody, itemMarkHtml } from './item-codex';
import { itemDisplayName } from './g23-display';
import { unitCardBody, roleSection, battleLine, itemStackLine, abilityLabel } from './unit-card';
import { applyUnitPanelSkin, loadUnitPanelSkin, type UnitPanelSkin } from './unit-panel-skin';
import { loadTooltipText, readTooltipText } from './tooltip-text-loader';
import { PANEL_STYLE } from './unit-panel-style';

export interface UnitPanelData {
  id: string; definitionId: string; starLevel: number; team: 'player' | 'enemy';
  items?: readonly string[]; notes?: readonly string[]; battle?: UnitBattleStats | null;
  combat?: CombatViewUnit | null;
}
/** Future rules-side planning projection. Never reconstruct item/trait bonuses in the UI. */
export function planningBonusProjection(_unit: UnitPanelData): null { return null; }
const node = (tag: string, text = '', className = '') => {
  const el = document.createElement(tag); el.textContent = text; el.className = className; return el;
};

/** Token substitution first, then the existing plain-text sanitizer. Markers preserve safe emphasis without HTML input. */
export function abilityRanks(definitionId: string, star: number): HTMLElement {
  const out = node('p', '', 'unit-card-text');
  if (star === 4) { out.textContent = abilityText(definitionId, 4)?.text ?? '无主动技能说明'; return out; }
  const def = UNIT_DEFINITIONS[definitionId], data = S13_ABILITY_DATA[def.abilityId];
  if (!data) { out.textContent = '无主动技能说明'; return out; }
  const values = ([1, 2, 3] as const).map(rank => abilityDisplayValues(definitionId, rank));
  const template = readTooltipText()?.ABILITY_ZH[data.id]?.text ?? '';
  const marked = template.replace(/@([^@<>\s]+)@/g, (token, key: string) => {
    const ranks = values.map(row => row[key]);
    if (ranks.some(value => value === undefined)) return token;
    const format = (value: number) => String(Math.round(value * 100) / 100);
    if (ranks.every(value => value === ranks[0])) return format(ranks[0]);
    return ranks.map((value, index) => index + 1 === star ? `\uE000${format(value)}\uE001` : format(value)).join('/');
  });
  const text = fillAbilityTemplate(marked, values[star - 1]).text;
  for (const part of text.split(/(\uE000[^\uE001]*\uE001)/)) {
    out.append(part.startsWith('\uE000') ? node('b', part.slice(1, -1)) : document.createTextNode(part));
  }
  return out;
}

const STAT_LABELS = { attack: '攻击力', ap: '法术强度', armor: '护甲', mr: '魔抗', speed: '攻击速度', crit: '暴击几率', critDamage: '暴击伤害', range: '射程' };
/** Original-style layout: splash banner (cost strip, stars, traits), bars, ability + items, a 4×2 stat grid. The ability text,
 * role and recommended items sit in a card that opens from the ability icon; battle totals stay as one line at the bottom. */
export function buildUnitPanel(data: UnitPanelData): HTMLElement | null {
  const card = unitCardBody(data.definitionId, data.starLevel);
  if (!card || card.classList.contains('unit-card-anvil')) return card;
  const def = UNIT_DEFINITIONS[data.definitionId], neutral = def.unitKind === 'neutral';
  const star = Number(card.dataset.star);
  const body = node('div', '', 'unit-card unit-inspect-body'); body.dataset.unitDef = data.definitionId; body.dataset.star = String(star);
  const hero = node('div', '', 'inspect-hero'); hero.dataset.cost = neutral ? '1' : String(Math.min(6, Math.max(1, def.cost)));
  const portrait = card.querySelector('.unit-card-portrait')!; portrait.classList.toggle('neutral', neutral);
  const stars = node('span', '★'.repeat(star), 'inspect-stars'); stars.dataset.star = String(star); stars.setAttribute('aria-label', `${star} 星`);
  const traits = node('div', '', 'inspect-traits');
  if (!neutral) for (const tag of heroTraitTagsWithIds(data.definitionId)) {
    const chip = node('span', '', `inspect-trait ${tag.open ? 'trait-open' : 'trait-closed'}`);
    if (!tag.open) chip.title = '本版本未开放';
    const icon = node('i'); if (tag.id) icon.innerHTML = s13IconHtml('trait', tag.id, 18, 'trait-icon');
    chip.append(icon, document.createTextNode(tag.name)); traits.append(chip);
  }
  const name = node('div', '', 'inspect-name');
  name.append(node('strong', card.querySelector('.unit-card-name')!.textContent!, 'unit-card-name'), node('span', neutral ? '野怪' : String(def.cost), 'inspect-cost'));
  hero.append(portrait, stars, traits, name);
  body.append(hero, node('div', '', 'inspect-notes'));
  const bars = node('div', '', 'inspect-bars');
  for (const kind of ['hp', 'mana']) {
    const bar = node('div', '', `inspect-bar inspect-${kind}`); bar.dataset.bar = kind;
    const fill = node('span', '', 'inspect-fill'); fill.dataset.fill = kind; bar.append(fill);
    if (kind === 'hp') { const shield = node('span', '', 'inspect-shield'); shield.dataset.fill = 'shield'; bar.append(shield); }
    const label = node('span', '', 'inspect-bar-text'); label.dataset.value = kind; bar.append(label); bars.append(bar);
  }
  const base = (star === 4 ? fourStarBaseStats(data.definitionId) : null) ?? getUnitStats(data.definitionId, neutral ? 1 : Math.min(3, data.starLevel) as StarLevel);
  const abilityName = abilityText(data.definitionId, star)?.name ?? '无主动技能';
  const row = node('div', '', 'inspect-row');
  const button = node('button', '', 'inspect-ability') as HTMLButtonElement; button.type = 'button';
  button.setAttribute('aria-label', `技能：${abilityName}`); button.setAttribute('aria-expanded', 'false');
  const art = abilityLabel(data.definitionId, '').querySelector('img');
  if (art) { art.removeAttribute('style'); art.width = art.height = 40; button.append(art); }
  const items = node('div', '', 'inspect-items');
  for (let slot = 0; slot < 3; slot++) {
    const cell = node('span', '', 'inspect-item'); cell.tabIndex = 0; cell.dataset.slot = String(slot); items.append(cell);
  }
  row.append(button, items);
  const tip = node('div', '', 'inspect-ability-card'); tip.setAttribute('role', 'tooltip');
  const ability = node('div', '', 'unit-card-ability');
  ability.append(abilityLabel(data.definitionId, `${abilityName} · 法力 ${base.initialMana}/${base.maxMana}`), abilityRanks(data.definitionId, data.starLevel));
  tip.append(ability);
  const role = roleSection(data.definitionId); if (role) tip.append(role);
  const toggle = (open: boolean) => { tip.classList.toggle('open', open); button.setAttribute('aria-expanded', String(open)); };
  button.addEventListener('pointerenter', () => toggle(true)); button.addEventListener('pointerleave', () => toggle(false));
  button.addEventListener('focus', () => toggle(true)); button.addEventListener('blur', () => toggle(false));
  button.addEventListener('click', () => toggle(!tip.classList.contains('open')));
  const grid = node('dl', '', 'unit-card-stats');
  for (const [key, label] of Object.entries(STAT_LABELS)) {
    const cell = node('div', '', 'inspect-stat'), value = node('dd'); value.dataset.value = key; cell.append(node('dt', label), value); grid.append(cell);
  }
  body.append(bars, row, tip, node('div', '', 'inspect-stats-label'), grid, itemStackLine(data.combat?.itemStacks), battleLine(data.battle ?? { battle: null, match: null }));
  updateUnitPanel(body, data);
  return body;
}

/** Splash banner from the optional original art (heroes only; others keep the portrait). */
export function applyUnitSplash(body: HTMLElement, skin: UnitPanelSkin | null): void {
  const hero = body.querySelector<HTMLElement>('.inspect-hero'), id = body.dataset.unitDef?.replace(/-ranged$/, '') ?? '';
  const url = skin?.splash.get(id);
  if (!hero || !url) return;
  hero.style.setProperty('--splash', `url(${JSON.stringify(url)})`); hero.classList.add('has-splash');
}

/** Text and widths only: combat refresh never replaces the header, slots, bars or stat nodes. */
export function updateUnitPanel(body: HTMLElement, data: UnitPanelData): void {
  if (body.classList.contains('unit-card-anvil')) return;
  const def = UNIT_DEFINITIONS[data.definitionId];
  const base = (data.starLevel === 4 ? fourStarBaseStats(data.definitionId) : null) ?? getUnitStats(data.definitionId, def.unitKind === 'neutral' ? 1 : Math.min(3, data.starLevel) as StarLevel);
  const live = data.combat ?? planningBonusProjection(data);
  const hp = live?.hp ?? base.health, maxHp = live?.maxHp ?? base.health, shield = live?.shield ?? 0;
  const mana = live?.mana ?? base.initialMana, maxMana = live?.maxMana ?? base.maxMana;
  // The replay's interval is already the rules' current speed projection (including temporary effects).
  const speed = live ? 20 / live.attackIntervalTicks : base.baseAttackSpeedBps !== undefined ? base.baseAttackSpeedBps / 10000 : 20 / base.attackIntervalTicks;
  const crit = live as (CombatViewUnit & { baseCritChanceBps?: number; baseCritMultiplierBps?: number }) | null;
  const values = { hp: `${hp}/${maxHp}`, mana: `${mana}/${maxMana}`, attack: live?.attackDamage ?? base.attack, ap: live?.abilityPower ?? 100,
    armor: live?.armor ?? base.armor, mr: live?.magicResist ?? base.magicResist, speed: speed.toFixed(2),
    crit: `${(crit?.baseCritChanceBps ?? base.baseCritChanceBps ?? 2500) / 100}%`, critDamage: `${(crit?.baseCritMultiplierBps ?? base.baseCritMultiplierBps ?? 14000) / 100}%`, range: `${live?.attackRange ?? base.attackRange} 格` };
  for (const [key, value] of Object.entries(values)) {
    const el = body.querySelector<HTMLElement>(`[data-value="${key}"]`); if (el && el.textContent !== String(value)) el.textContent = String(value);
  }
  for (const [key, supplied] of [['crit', crit?.baseCritChanceBps], ['critDamage', crit?.baseCritMultiplierBps]] as const) {
    body.querySelector<HTMLElement>(`[data-value="${key}"]`)!.title = live && supplied === undefined ? '基础暴击数值（战斗快照未提供实时暴击）' : '';
  }
  const width = (key: string, value: number) => { body.querySelector<HTMLElement>(`[data-fill="${key}"]`)!.style.width = `${Math.max(0, Math.min(100, value * 100))}%`; };
  width('hp', hp / Math.max(maxHp, hp + shield, 1)); width('shield', shield / Math.max(maxHp, hp + shield, 1)); width('mana', mana / Math.max(maxMana, 1));
  body.querySelector<HTMLElement>('[data-bar="hp"]')!.dataset.team = data.team;
  body.querySelector('.inspect-stats-label')!.textContent = live ? '实时属性' : '基础属性';
  const notes = body.querySelector<HTMLElement>('.inspect-notes')!;
  const noteKey = JSON.stringify(data.notes ?? []);
  if (notes.dataset.notes !== noteKey) {
    notes.dataset.notes = noteKey;
    notes.replaceChildren(...(data.notes ?? []).map(note => node('p', note, 'unit-card-note')));
  }
  const battle = body.querySelector<HTMLElement>('.unit-card-battle')!;
  battleLine(data.battle ?? { battle: null, match: null }, battle);
  battle.hidden = !data.battle || !(data.battle.battle || data.battle.match);
  const ids = data.items ?? [];
  itemStackLine(live?.itemStacks, body.querySelector<HTMLElement>('[data-debug="unit-card:item-stacks"]')!);
  body.querySelectorAll<HTMLElement>('[data-slot]').forEach((cell, slot) => {
    const id = ids[slot] ?? ''; if (cell.dataset.item === id) return;
    cell.dataset.item = id; cell.title = id ? itemDisplayName(id) : '空装备栏'; cell.setAttribute('aria-label', cell.title);
    cell.innerHTML = id ? itemMarkHtml(id, 32) : '';
  });
}

export class UnitPanel {
  readonly root = node('aside', '', 'unit-inspect');
  private body: HTMLElement | null = null;
  private key = '';
  private stamp = -Infinity;
  private read: (() => UnitPanelData | null) | null = null;
  private skin: UnitPanelSkin | null = null;
  private readonly escape = (event: KeyboardEvent) => { if (event.key === 'Escape') this.close(); };
  constructor() {
    if (!document.querySelector('style[data-unit-inspect]')) { const style = document.createElement('style'); style.dataset.unitInspect = ''; style.textContent = PANEL_STYLE; document.head.append(style); }
    this.root.hidden = true; this.root.setAttribute('aria-label', '棋子信息'); this.root.setAttribute('role', 'region');
    const close = node('button', '×', 'inspect-close'); close.title = '关闭'; close.setAttribute('aria-label', '关闭棋子信息'); close.addEventListener('click', () => this.close());
    this.root.append(close); document.body.append(this.root); document.addEventListener('keydown', this.escape);
    void loadUnitPanelSkin().then(skin => {
      if (!skin || !this.root.isConnected) return;
      this.skin = skin; applyUnitPanelSkin(this.root, skin); if (this.body) applyUnitSplash(this.body, skin);
    });
  }
  pin(read: () => UnitPanelData | null): void { this.read = read; this.key = ''; this.stamp = -Infinity; this.refresh(performance.now()); }
  refresh(now: number): void {
    if (!this.read || now - this.stamp < 100) return;
    this.stamp = now; const data = this.read(); if (!data) { this.close(); return; }
    const key = JSON.stringify([data.id, data.definitionId, data.starLevel]);
    if (key !== this.key) {
      this.body?.remove(); this.body = buildUnitPanel(data); if (!this.body) { this.close(); return; }
      applyUnitSplash(this.body, this.skin); this.root.append(this.body); this.key = key;
    } else if (this.body) updateUnitPanel(this.body, data);
    this.root.hidden = false; this.place();
  }
  private place(): void {
    const dock = document.getElementById('shop-dock')?.getBoundingClientRect();
    const floor = dock && dock.height > 0 ? Math.max(0, Math.min(window.innerHeight - 8, dock.top - 8)) : window.innerHeight - 8;
    const seats = document.querySelector('.online-seats')?.getBoundingClientRect();
    const right = window.innerWidth >= 700 && seats && seats.width > 0 ? Math.max(8, window.innerWidth - seats.left + 8) : 8;
    Object.assign(this.root.style, { right: `${right}px`, bottom: `${window.innerHeight - floor}px`, maxHeight: `${Math.max(0, Math.min(floor - 8, window.innerWidth < 700 ? window.innerHeight * .48 : floor))}px` });
  }
  close(): void { this.read = null; this.root.hidden = true; this.key = ''; }
  dispose(): void { this.close(); document.removeEventListener('keydown', this.escape); this.root.remove(); }
}
export async function createUnitPanel(): Promise<UnitPanel> { await loadTooltipText(); return new UnitPanel(); }

/** The optional 3D scene reports only identities and projected boxes; DOM cards stay on this side. */
export function showSceneDescription(target: import('../rendering/board-feed').BoardDescription | null,
  box: import('./hover-card').HoverBox | undefined, unit: UnitPanelData | null,
  orb: import('../simulation/m8/ui-contracts').UnclaimedOrbView | undefined,
  context: import('../rendering/online/orb-dock').OrbDockContext): void {
  const card = unitHoverCard();
  if (!target || !box) { card.hide(); return; }
  let body: HTMLElement | null = null;
  if (target.kind === 'unit' || target.kind === 'carousel') {
    const data = target.kind === 'carousel' ? target.unit : unit;
    if (data) body = unitCardBody(data.definitionId, data.starLevel, null,
      (data.items ?? []).map(item => itemDisplayName(typeof item === 'string' ? item : item.id)).join('、'), 'notes' in data ? data.notes : []);
  } else if (target.kind === 'item') {
    const entry = catalogEntry(target.id); if (entry) body = itemCardBody(entry);
  } else if (target.kind === 'orb') {
    if (orb) body = orbCardBody(orb, context, false);
  } else {
    body = node('div', `未领取的法球 ${target.count} 个：${target.tiers.map(tier => ORB_TIER_TEXT[tier as keyof typeof ORB_TIER_TEXT] ?? tier).join('、')}`);
  }
  if (body) card.showAt(box, JSON.stringify([target, unit, orb, context]), () => body!);
  else card.hide();
}
