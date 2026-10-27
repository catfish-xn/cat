/**
 * Trait column (G2 prerequisite, TFT left column): the traits of the units on a board, active ones first by tier then by
 * count, inactive ones greyed after them. Each row shows the icon (or a letter badge when no icon is bundled), the count,
 * the name and every breakpoint with the current one highlighted; hover shows the trait's rule summary, each tier's effect and the members.
 * Counts and tiers are the rules' `deriveTraits` snapshot (same selector the trait tab and the scouting panel use);
 * nothing is recounted here.
 */
import type { GameState } from '../simulation/game';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import { SHOP_CATALOG } from '../simulation/match-rules';
import type { ItemInstance, TraitSnapshot } from '../simulation/strategy-types';
import { deriveTraits } from '../simulation/trait-snapshot';
import { UNIT_DEFINITIONS } from '../simulation/units';
import type { MatchState } from '../simulation/match-types';
import { readG23Progress } from '../simulation/g2-3-state';
import { familyReunionView } from '../simulation/family-reunion';
import { readFamilyReunion } from './online/seat-view-adapter';
import { isOnlineMode } from './online/mode';
import { readSeatMechanic } from '../simulation/seat-mechanics/state';
import { G23_CONQUEROR_CHESTS, G23_POLICY } from '../simulation/content/g2-3-policy';
import { g23RewardLines } from '../presentation/g23-reward-text';
import { traitSummary, traitTierText } from '../presentation/trait-text';
import { getHeroIdentity, heroEmblemSvg, traitDisplayName } from '../presentation/hero-identity';
import { attachHoverCards, type HoverCard } from '../presentation/hover-card';
import { heroPortraitHtml, s13IconHtml } from '../presentation/s13-assets';
import { traitTierStyle } from '../presentation/trait-styles';
import type { BoardMechanics } from './board-feed';

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

/**
 * G2-3 prep: optional runtime counter lines per trait (stacks, opened chests and the like), supplied by the rules
 * through a later contract. The column only shows them verbatim; with no entry for a trait nothing extra renders.
 */
export interface TraitRuntimeLine {
  readonly label: string; readonly value: string;
  /** Shown at the bottom of the hover card only, not on the row (家人 5 progress). */
  readonly cardOnly?: true;
  /** Shown with the hover card's counters (above the ladder), not on the row (征服 chests opened). */
  readonly counterOnly?: true;
  /** 征服层数 only: the hover card draws the 15-chest ladder from these counters. */
  readonly ladder?: { readonly stacks: number; readonly opened: number };
}
export type TraitRuntime = ReadonlyMap<string, readonly TraitRuntimeLine[]>;
const runtimeText = (lines: readonly TraitRuntimeLine[] | undefined, all = false) => (lines ?? []).filter(line => all || !(line.cardOnly || line.counterOnly)).map(line => `${line.label} ${line.value}`).join(' · ');

/**
 * My own Conqueror and Chem-Baron counters, read from the rules' G2-3 progress (offline state or my private seat view):
 * 征服层数 with the next chest breakpoint (all 15 opened shows the total only), and 微光 with the next black-market
 * breakpoint (every 100, eighth market at 800; past it the total only). Labels follow the 14.24 zh_cn trait text. Owner-only data:
 * never pass it for a scouted board. No progress (older saves, content without G2-3) renders no counters.
 */
export function g23TraitRuntime(state: MatchState): TraitRuntime | undefined {
  let progress; try { progress = readG23Progress(state); } catch { return undefined; }
  if (!progress) return undefined;
  const { stacks, chestsOpened } = progress.conquest, next = G23_CONQUEROR_CHESTS[chestsOpened]?.threshold, shimmer = progress.chem.shimmer;
  const market = nextMarket(shimmer);
  const lines = new Map<string, readonly TraitRuntimeLine[]>([
    ['conqueror', [{ label: '征服层数', value: next === undefined ? String(stacks) : `${stacks}/${next}`, ladder: { stacks, opened: chestsOpened } },
      { label: '已开奖励', value: `${chestsOpened}/${G23_CONQUEROR_CHESTS.length}`, counterOnly: true }]],
    ['chem-baron', [{ label: '微光', value: market ? `${shimmer}/${market}` : String(shimmer) }]],
  ]);
  // 家人 5 (v19): the rules' current reward and progress toward it, as the seat view carries them; the reunion marker on the row.
  const heist = readSeatMechanic<{ currentRewardName: string; CurrentProgress: number; CurrentRewardValue: number }>(state, 'familyHeist');
  const family: TraitRuntimeLine[] = familyReunionDancers(state).length ? [{ label: '家人团聚', value: '♪' }] : [];
  if (heist) family.push({ label: '当前奖励', value: heist.currentRewardName, cardOnly: true }, { label: '进度', value: `${heist.CurrentProgress}/${heist.CurrentRewardValue}`, cardOnly: true });
  if (family.length) lines.set('family', family);
  return lines;
}
/**
 * The six 家人团聚 units in planning while the rules' view says the reunion is on: online only the seat view's (none when the
 * server sent none), offline the rules' own familyReunionView; empty otherwise.
 */
export function familyReunionDancers(state: MatchState): readonly string[] {
  if (state.phase !== 'preparation') return [];
  let view; try { view = isOnlineMode() ? readFamilyReunion(state) : familyReunionView(state); } catch { return []; }
  return view?.eligible ? view.participantIds : [];
}
/** One chest of the 征服层数 ladder: opened, the next one (with the stacks still missing) or later. */
export interface ConquestStep { readonly threshold: number; readonly reward: string; readonly state: 'done' | 'next' | 'later'; readonly left?: number }
/** The rules' 15 chests in order, each reward named from the table the rules grant from (no number is written here). */
export function conquestLadder(stacks: number, opened: number): ConquestStep[] {
  return G23_CONQUEROR_CHESTS.map((chest, index) => ({ threshold: chest.threshold, reward: g23RewardLines(G23_POLICY.conqueror.transitionalRewards[index] ?? chest.reward).join(' · '),
    state: index < opened ? 'done' : index === opened ? 'next' : 'later', ...(index === opened ? { left: Math.max(0, chest.threshold - stacks) } : {}) }));
}
const nextMarket = (shimmer: number) => { const market = (Math.floor(shimmer / 100) + 1) * 100; return market <= 800 ? market : null; };

/**
 * The same owner-only counters for the 3D chest and shimmer flask (board-feed `mechanics`): a part shows while its trait
 * is on my board or once it has gathered anything. Same source and breakpoints as g23TraitRuntime; never for a scouted board.
 */
export function g23BoardMechanics(state: MatchState): BoardMechanics | undefined {
  let progress; try { progress = readG23Progress(state); } catch { return undefined; }
  if (!progress) return undefined;
  const traits = new Set(boardTraitRows(state.preparation, state.items).map(row => row.traitId));
  const { stacks, chestsOpened } = progress.conquest, chem = progress.chem;
  const conquest = traits.has('conqueror') || stacks > 0 ? { stacks, opened: chestsOpened,
    from: G23_CONQUEROR_CHESTS[chestsOpened - 1]?.threshold ?? 0, next: G23_CONQUEROR_CHESTS[chestsOpened]?.threshold ?? null } : undefined;
  const shimmer = traits.has('chem-baron') || chem.shimmer > 0 || chem.offer ? { value: chem.shimmer, next: nextMarket(chem.shimmer), offer: !!chem.offer } : undefined;
  return conquest || shimmer ? { ...(conquest ? { conquest } : {}), ...(shimmer ? { shimmer } : {}) } : undefined;
}

/** Rows of the traits present on the board (count > 0): active by tier desc, then count desc, then name; inactive after. */
export function traitRows(snapshots: readonly TraitSnapshot[]): TraitRow[] {
  return snapshots.filter(snapshot => snapshot.count > 0 && Object.hasOwn(TRAIT_DEFINITIONS, snapshot.traitId)).map(snapshot => {
    const definition = TRAIT_DEFINITIONS[snapshot.traitId]!;
    return { traitId: snapshot.traitId, name: traitDisplayName(snapshot.traitId), count: snapshot.count, tier: snapshot.tier, thresholds: definition.tiers.map(tier => tier.threshold), members: snapshot.memberDefinitionIds };
  }).sort((a, b) => Number(b.tier > 0) - Number(a.tier > 0) || b.tier - a.tier || b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}
/**
 * Player rows of a preparation state; an unknown definition (content mismatch) shows no rows instead of throwing.
 * `items`: the owner's item instances, so emblems held by board units (魔像训练师's golem included) count like the rules count them.
 */
export function boardTraitRows(preparation: GameState, items: readonly ItemInstance[] = []): TraitRow[] {
  try { return traitRows(deriveTraits(preparation, 'player', undefined, undefined, items)); } catch { return []; }
}

/** Trait icon, or a letter badge (first character of the name) when the icon is not bundled. */
export function traitIconHtml(traitId: string, size: number): string {
  const icon = s13IconHtml('trait', traitId, size, 'trait-icon');
  if (icon) return icon;
  const letter = escapeHtml([...traitDisplayName(traitId)][0] ?? '?');
  return `<span class="trait-letter" style="width:${size}px;height:${size}px" aria-hidden="true">${letter}</span>`;
}

/** The list element; rows carry `data-trait` so a hover card can describe them. */
export function renderTraitRows(rows: readonly TraitRow[], debug: string, empty: string, runtime?: TraitRuntime): HTMLElement {
  const list = el('ol', '', 'trait-rows'); list.dataset.debug = debug;
  for (const row of rows) {
    const item = el('li', '', `trait-row${row.tier > 0 ? ' active' : ' inactive'}`);
    item.dataset.trait = row.traitId; item.dataset.count = String(row.count); item.dataset.tier = String(row.tier); item.tabIndex = 0;
    const style = traitTierStyle(row.traitId, row.tier, row.thresholds); if (style) item.dataset.style = style;
    item.dataset.debug = `${debug}:${row.traitId}`;
    item.insertAdjacentHTML('afterbegin', traitIconHtml(row.traitId, 22));
    item.append(el('span', String(row.count), 'trait-count'), el('span', row.name, 'trait-name'));
    const steps = el('span', '', 'trait-steps'); steps.dataset.count = String(row.count);
    row.thresholds.forEach((threshold, index) => {
      if (index) steps.append(el('span', '/', 'trait-sep'));
      const step = el('span', String(threshold), `trait-step${threshold === row.tier ? ' current' : threshold <= row.count ? ' reached' : ''}`);
      steps.append(step);
    });
    item.append(steps);
    const counter = runtimeText(runtime?.get(row.traitId));
    if (counter) { const line = el('span', counter, 'trait-runtime'); line.dataset.debug = `${debug}:${row.traitId}:runtime`; item.append(line); }
    item.setAttribute('aria-label', `${row.name} ${row.count} 人，${row.tier > 0 ? `已激活 ${row.tier} 档` : '未激活'}，断点 ${row.thresholds.join('/')}`);
    list.append(item);
  }
  if (!rows.length) list.append(el('li', empty, 'trait-row empty'));
  return list;
}

/** Hover body of one trait: breakpoints with each tier's effect, then every hero of the trait with those on the board marked. */
export function traitCardBody(traitId: string, count: number, onBoard: readonly string[], runtime?: readonly TraitRuntimeLine[]): HTMLElement | null {
  const definition = Object.hasOwn(TRAIT_DEFINITIONS, traitId) ? TRAIT_DEFINITIONS[traitId] : undefined;
  if (!definition) return null;
  const body = el('div', '', 'trait-card'); body.dataset.trait = traitId;
  const head = el('div', '', 'trait-card-head'); head.insertAdjacentHTML('afterbegin', traitIconHtml(traitId, 28));
  head.append(el('strong', traitDisplayName(traitId)), el('span', `${count} 人 · ${definition.target === 'team' ? '全队收益' : '成员收益'}`, 'trait-card-meta'));
  body.append(head);
  const reachedTier = definition.tiers.filter(tier => tier.threshold <= count).at(-1)?.threshold ?? 0;
  const summary = traitSummary(traitId, reachedTier);
  if (summary) { const line = el('p', summary, 'trait-card-summary'); line.dataset.debug = 'trait-card:summary'; body.append(line); }
  const tiers = el('ul', '', 'trait-card-tiers'); tiers.dataset.debug = 'trait-card:tiers';
  for (const tier of definition.tiers) {
    const reached = tier.threshold <= count;
    tiers.append(el('li', traitTierText(definition, tier), reached ? 'reached' : ''));
  }
  body.append(tiers);
  const rowLines = runtime?.filter(line => !line.cardOnly), footLines = runtime?.filter(line => line.cardOnly);
  if (rowLines?.length) {
    const counters = el('ul', '', 'trait-card-runtime'); counters.dataset.debug = 'trait-card:runtime';
    for (const line of rowLines) counters.append(el('li', `${line.label}：${line.value}`));
    body.append(counters);
    const ladder = rowLines.find(line => line.ladder)?.ladder;
    if (ladder) {
      const list = el('ol', '', 'conquest-ladder'); list.dataset.debug = 'trait-card:ladder';
      for (const step of conquestLadder(ladder.stacks, ladder.opened)) {
        const row = el('li', '', step.state);
        row.append(el('span', String(step.threshold), 'ladder-at'), el('span', step.reward, 'ladder-reward'));
        if (step.left !== undefined) row.append(el('span', `还差 ${step.left} 层`, 'ladder-left'));
        list.append(row);
      }
      body.append(list);
    }
  }
  const members = el('div', '', 'trait-card-members'); members.dataset.debug = 'trait-card:members';
  for (const id of SHOP_CATALOG.filter(id => UNIT_DEFINITIONS[id]?.traits.includes(traitId))) {
    const unit = UNIT_DEFINITIONS[id]!;
    // The original card's member row: each hero's portrait framed in its cost colour, the name under it; off-board ones dimmed.
    const member = el('span', '', `member cost-${unit.cost}${onBoard.includes(id) ? ' on-board' : ''}`), name = getHeroIdentity(id).name;
    member.title = `${name} ${unit.cost}费${onBoard.includes(id) ? ' · 在场' : ''}`;
    member.insertAdjacentHTML('afterbegin', `<span class="member-portrait" aria-hidden="true">${heroPortraitHtml(id, 32, heroEmblemSvg(id, 32))}</span>`);
    member.append(el('span', name, 'member-name'));
    members.append(member);
  }
  body.append(members);
  if (footLines?.length) {
    const foot = el('ul', '', 'trait-card-runtime trait-card-foot'); foot.dataset.debug = 'trait-card:foot';
    for (const line of footLines) foot.append(el('li', `${line.label}：${line.value}`));
    body.append(foot);
  }
  return body;
}

/** Hover cards for every `[data-trait]` row inside `scope`; the members on board are read back from the rendered rows. */
export function attachTraitCards(scope: HTMLElement, card: HoverCard, membersOf: (traitId: string) => readonly string[],
  runtimeOf: (traitId: string) => readonly TraitRuntimeLine[] | undefined = () => undefined): () => void {
  return attachHoverCards(scope, card, '.trait-row[data-trait]', anchor => {
    const traitId = anchor.dataset.trait!, count = Number(anchor.dataset.count ?? 0), members = membersOf(traitId), runtime = runtimeOf(traitId);
    return { key: `trait:${traitId}:${count}:${members.join(',')}:${runtimeText(runtime, true)}`, build: () => traitCardBody(traitId, count, members, runtime) ?? el('div', traitId) };
  }, { pin: true });
}

/** The always-visible column at the top of the left panels; re-rendered with the panel. */
/** Columns on the page, for traitColumnShowRows (online scouting does not hold the strategy panel's column). */
const columns = new Set<TraitColumn>();
/** 3D 看对手: every column shows these rows (another seat's, publicTraitRows) instead of my board's; null restores mine. */
export function traitColumnShowRows(rows: readonly TraitRow[] | null): void { for (const column of columns) column.showRows(rows); }
export class TraitColumn {
  readonly root: HTMLElement;
  private rows: readonly TraitRow[] = [];
  private runtime: TraitRuntime | undefined;
  private key = '';
  private readonly detach: () => void;
  private own: [GameState, TraitRuntime | undefined, readonly ItemInstance[]] | null = null;
  private shown: readonly TraitRow[] | null = null;
  constructor(host: HTMLElement, before: HTMLElement | null, card: HoverCard) {
    this.root = el('section', '', 'trait-column'); this.root.id = 'trait-column'; this.root.setAttribute('aria-label', '羁绊');
    this.root.dataset.debug = 'trait-column';
    if (before && before.parentElement === host) host.insertBefore(this.root, before); else host.prepend(this.root);
    this.detach = attachTraitCards(this.root, card, traitId => this.rows.find(row => row.traitId === traitId)?.members ?? [], traitId => this.runtime?.get(traitId));
    columns.add(this);
  }
  /** `runtime`: optional counter lines per trait (G2-3 prep); omitted, the column renders exactly as before. */
  render(preparation: GameState, runtime?: TraitRuntime, items: readonly ItemInstance[] = []): void {
    this.own = [preparation, runtime, items];
    if (!this.shown) this.draw(boardTraitRows(preparation, items), runtime);
  }
  /** Rows to show instead of my board's (another seat's while scouting, no counter lines); null goes back to mine. */
  showRows(rows: readonly TraitRow[] | null): void {
    this.shown = rows;
    if (rows) { this.root.dataset.scout = ''; this.draw(rows, undefined); }
    else { delete this.root.dataset.scout; if (this.own) this.draw(boardTraitRows(this.own[0], this.own[2]), this.own[1]); }
  }
  private draw(rows: readonly TraitRow[], runtime: TraitRuntime | undefined): void {
    const key = `${this.shown ? 's' : ''}${rows.map(row => `${row.traitId}:${row.count}:${row.tier}:${runtimeText(runtime?.get(row.traitId), true)}`).join('|')}`;
    if (key === this.key && this.root.childElementCount) return;
    this.rows = rows; this.runtime = runtime; this.key = key;
    this.root.replaceChildren(el('h3', this.shown ? '对方羁绊' : '羁绊', 'trait-column-title'), renderTraitRows(rows, 'trait-column:rows', '场上暂无单位', runtime));
  }
  dispose(): void { columns.delete(this); this.detach(); this.root.remove(); }
}
