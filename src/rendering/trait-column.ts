/**
 * Trait column (G2 prerequisite, TFT left column): the traits of the units on a board, active ones first by tier then by
 * count, inactive ones greyed after them. Each row shows the icon (or a letter badge when no icon is bundled), the count,
 * the name and every breakpoint with the current one highlighted; hover shows each tier's effect and the members.
 * Counts and tiers are the rules' `deriveTraits` snapshot (same selector the trait tab and the scouting panel use);
 * nothing is recounted here.
 */
import type { GameState } from '../simulation/game';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import { SHOP_CATALOG } from '../simulation/match-rules';
import type { TraitSnapshot } from '../simulation/strategy-types';
import { deriveTraits } from '../simulation/trait-snapshot';
import { UNIT_DEFINITIONS } from '../simulation/units';
import { describeTraitTier } from '../presentation/effect-text';
import { getHeroIdentity, traitDisplayName } from '../presentation/hero-identity';
import { attachHoverCards, type HoverCard } from '../presentation/hover-card';
import { s13IconHtml } from '../presentation/s13-assets';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface TraitRow {
  readonly traitId: string;
  readonly name: string;
  readonly count: number;
  /** Highest reached threshold, 0 when inactive. */
  readonly tier: number;
  readonly thresholds: readonly number[];
  /** Distinct member definitions on the board. */
  readonly members: readonly string[];
}

/** Rows of the traits present on the board (count > 0): active by tier desc, then count desc, then name; inactive after. */
export function traitRows(snapshots: readonly TraitSnapshot[]): TraitRow[] {
  return snapshots.filter(snapshot => snapshot.count > 0 && Object.hasOwn(TRAIT_DEFINITIONS, snapshot.traitId)).map(snapshot => {
    const definition = TRAIT_DEFINITIONS[snapshot.traitId]!;
    return { traitId: snapshot.traitId, name: traitDisplayName(snapshot.traitId), count: snapshot.count, tier: snapshot.tier, thresholds: definition.tiers.map(tier => tier.threshold), members: snapshot.memberDefinitionIds };
  }).sort((a, b) => Number(b.tier > 0) - Number(a.tier > 0) || b.tier - a.tier || b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}
/** Player rows of a preparation state; an unknown definition (content mismatch) shows no rows instead of throwing. */
export function boardTraitRows(preparation: GameState): TraitRow[] {
  try { return traitRows(deriveTraits(preparation, 'player')); } catch { return []; }
}

/** Trait icon, or a letter badge (first character of the name) when the icon is not bundled. */
export function traitIconHtml(traitId: string, size: number): string {
  const icon = s13IconHtml('trait', traitId, size, 'trait-icon');
  if (icon) return icon;
  const letter = escapeHtml([...traitDisplayName(traitId)][0] ?? '?');
  return `<span class="trait-letter" style="width:${size}px;height:${size}px" aria-hidden="true">${letter}</span>`;
}

/** The list element; rows carry `data-trait` so a hover card can describe them. */
export function renderTraitRows(rows: readonly TraitRow[], debug: string, empty: string): HTMLElement {
  const list = el('ol', '', 'trait-rows'); list.dataset.debug = debug;
  for (const row of rows) {
    const item = el('li', '', `trait-row${row.tier > 0 ? ' active' : ' inactive'}`);
    item.dataset.trait = row.traitId; item.dataset.count = String(row.count); item.dataset.tier = String(row.tier); item.tabIndex = 0;
    item.dataset.debug = `${debug}:${row.traitId}`;
    item.insertAdjacentHTML('afterbegin', traitIconHtml(row.traitId, 22));
    item.append(el('span', String(row.count), 'trait-count'), el('span', row.name, 'trait-name'));
    const steps = el('span', '', 'trait-steps');
    row.thresholds.forEach((threshold, index) => {
      if (index) steps.append(el('span', '/', 'trait-sep'));
      const step = el('span', String(threshold), `trait-step${threshold === row.tier ? ' current' : threshold <= row.count ? ' reached' : ''}`);
      steps.append(step);
    });
    item.append(steps);
    item.setAttribute('aria-label', `${row.name} ${row.count} 人，${row.tier > 0 ? `已激活 ${row.tier} 档` : '未激活'}，断点 ${row.thresholds.join('/')}`);
    list.append(item);
  }
  if (!rows.length) list.append(el('li', empty, 'trait-row empty'));
  return list;
}

/** Hover body of one trait: breakpoints with each tier's effect, then every hero of the trait with those on the board marked. */
export function traitCardBody(traitId: string, count: number, onBoard: readonly string[]): HTMLElement | null {
  const definition = Object.hasOwn(TRAIT_DEFINITIONS, traitId) ? TRAIT_DEFINITIONS[traitId] : undefined;
  if (!definition) return null;
  const body = el('div', '', 'trait-card'); body.dataset.trait = traitId;
  const head = el('div', '', 'trait-card-head'); head.insertAdjacentHTML('afterbegin', traitIconHtml(traitId, 28));
  head.append(el('strong', traitDisplayName(traitId)), el('span', `${count} 人 · ${definition.target === 'team' ? '全队收益' : '成员收益'}`, 'trait-card-meta'));
  body.append(head);
  const tiers = el('ul', '', 'trait-card-tiers'); tiers.dataset.debug = 'trait-card:tiers';
  for (const tier of definition.tiers) {
    const reached = tier.threshold <= count;
    tiers.append(el('li', describeTraitTier(definition, tier), reached ? 'reached' : ''));
  }
  body.append(tiers);
  const members = el('div', '', 'trait-card-members'); members.dataset.debug = 'trait-card:members';
  for (const id of SHOP_CATALOG.filter(id => UNIT_DEFINITIONS[id]?.traits.includes(traitId))) {
    const unit = UNIT_DEFINITIONS[id]!;
    members.append(el('span', `${getHeroIdentity(id).name} ${unit.cost}费`, onBoard.includes(id) ? 'member on-board' : 'member'));
  }
  body.append(members);
  return body;
}

/** Hover cards for every `[data-trait]` row inside `scope`; the members on board are read back from the rendered rows. */
export function attachTraitCards(scope: HTMLElement, card: HoverCard, membersOf: (traitId: string) => readonly string[]): () => void {
  return attachHoverCards(scope, card, '.trait-row[data-trait]', anchor => {
    const traitId = anchor.dataset.trait!, count = Number(anchor.dataset.count ?? 0), members = membersOf(traitId);
    return { key: `trait:${traitId}:${count}:${members.join(',')}`, build: () => traitCardBody(traitId, count, members) ?? el('div', traitId) };
  });
}

/** The always-visible column at the top of the left panels; re-rendered with the panel. */
export class TraitColumn {
  readonly root: HTMLElement;
  private rows: readonly TraitRow[] = [];
  private key = '';
  private readonly detach: () => void;
  constructor(host: HTMLElement, before: HTMLElement | null, card: HoverCard) {
    this.root = el('section', '', 'trait-column'); this.root.id = 'trait-column'; this.root.setAttribute('aria-label', '羁绊');
    this.root.dataset.debug = 'trait-column';
    if (before && before.parentElement === host) host.insertBefore(this.root, before); else host.prepend(this.root);
    this.detach = attachTraitCards(this.root, card, traitId => this.rows.find(row => row.traitId === traitId)?.members ?? []);
  }
  render(preparation: GameState): void {
    const rows = boardTraitRows(preparation);
    const key = rows.map(row => `${row.traitId}:${row.count}:${row.tier}`).join('|');
    if (key === this.key && this.root.childElementCount) return;
    this.rows = rows; this.key = key;
    this.root.replaceChildren(el('h3', '羁绊', 'trait-column-title'), renderTraitRows(rows, 'trait-column:rows', '场上暂无单位'));
  }
  dispose(): void { this.detach(); this.root.remove(); }
}
