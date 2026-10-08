/**
 * M8 U3 (static part): item codex, recipe table and description popover.
 * Reads only the signed-off B4 query readItemCatalog(); never evaluates effects and never
 * answers "can these two instances combine / can this unit equip" — that is B5's
 * previewCombine/previewEquip and, until then, the public Match command result.
 */
import { readItemCatalog, type RuntimeItemCatalogEntry } from '../simulation/item-catalog';
import { s13AssetUrl } from './s13-assets';

type Entry = RuntimeItemCatalogEntry;
let cached: { list: readonly Entry[]; byId: ReadonlyMap<string, Entry> } | null = null;
/** The catalogue is static content; one read per page. */
function catalog() {
  if (!cached) { const list = readItemCatalog(); cached = { list, byId: new Map(list.map(entry => [entry.id, entry])) }; }
  return cached;
}
export const catalogEntry = (id: string): Entry | undefined => catalog().byId.get(id);
/** Authoritative description lines, shown verbatim. */
export const itemDescriptions = (id: string): readonly string[] => catalogEntry(id)?.effectDescriptions ?? [];

const KIND_NAMES = { component: '组件', completed: '成装' } as const;
const EVIDENCE_NAMES: Readonly<Record<Entry['evidenceStatus'], string>> = { 'source-reviewed': '来源已核对', 'approved-provisional': '批准暂行，待历史核验' };
const LOCALIZATION_NAMES: Readonly<Record<Entry['localizationStatus'], string>> = { 'temporary-unverified': '临时译名（待核实）', verified: '译名已核实' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node;
}
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Item mark: bundled official icon when the manifest has one, layered over a neutral
 * placeholder (kind colour + first two characters of the name). A missing or failed
 * icon leaves the placeholder; no imitation artwork is drawn.
 */
export function itemMarkHtml(id: string, size: number): string {
  const entry = catalogEntry(id), url = s13AssetUrl('item', id);
  const kind = entry?.kind ?? 'component', glyph = escapeHtml([...(entry?.name ?? id)].slice(0, 2).join(''));
  return `<span class="item-mark kind-${kind}" style="width:${size}px;height:${size}px" aria-hidden="true"><span class="item-glyph">${glyph}</span>`
    + `${url ? `<img class="item-icon" src="${url}" width="${size}" height="${size}" alt="" draggable="false" loading="lazy" decoding="async">` : ''}</span>`;
}
/** Short declaration tags; unique/slotCost/evidence are catalogue declarations, not legality checks. */
export function itemTags(entry: Entry): { text: string; kind: 'unique' | 'slots' | 'provisional' }[] {
  const tags: { text: string; kind: 'unique' | 'slots' | 'provisional' }[] = [];
  if (entry.unique) tags.push({ text: '唯一', kind: 'unique' });
  if (entry.slotCost > 1) tags.push({ text: `占${entry.slotCost}槽`, kind: 'slots' });
  if (entry.evidenceStatus === 'approved-provisional') tags.push({ text: '暂定', kind: 'provisional' });
  return tags;
}
function tagNodes(entry: Entry): HTMLElement[] { return itemTags(entry).map(tag => el('span', tag.text, `item-tag tag-${tag.kind}`)); }
function nameNode(entry: Entry): HTMLElement {
  const name = el('span', entry.name, 'item-name');
  // Every current name is temporary; the marker stays until the catalogue reports "verified".
  if (entry.localizationStatus === 'temporary-unverified') name.append(el('sup', '暂译', 'item-l10n'));
  return name;
}
/** Static recipe lookups for display only (which completed items list this component). */
function usedIn(componentId: string): Entry[] { return catalog().list.filter(entry => entry.recipe?.includes(componentId)); }
function recipeFor(a: string, b: string): Entry | undefined {
  const key = [a, b].sort().join('|');
  return catalog().list.find(entry => entry.recipe && [...entry.recipe].sort().join('|') === key);
}

/** Popover body for one definition. */
function describe(entry: Entry): HTMLElement {
  const body = el('div', '', 'item-pop-body');
  const head = el('div', '', 'item-pop-head'); head.insertAdjacentHTML('afterbegin', itemMarkHtml(entry.id, 36));
  const title = el('div'); title.append(nameNode(entry), ...tagNodes(entry));
  title.append(el('div', `${KIND_NAMES[entry.kind]} · ${entry.apiName}`, 'item-pop-meta')); head.append(title); body.append(head);
  if (entry.recipe) body.append(el('p', `配方：${entry.recipe.map(id => catalogEntry(id)?.name ?? id).join(' + ')}`, 'item-pop-recipe'));
  else { const uses = usedIn(entry.id); if (uses.length) body.append(el('p', `可用于配方：${uses.map(item => item.name).join('、')}`, 'item-pop-recipe')); }
  const effects = el('ul', '', 'item-pop-effects');
  for (const line of entry.effectDescriptions) effects.append(el('li', line));
  if (!entry.effectDescriptions.length) effects.append(el('li', '目录未提供效果说明'));
  body.append(effects);
  body.append(el('p', `声明：${entry.unique ? '唯一' : '非唯一'} · 占用装备槽 ${entry.slotCost}`, 'item-pop-decl'));
  body.append(el('p', `规则依据：${EVIDENCE_NAMES[entry.evidenceStatus]} · 参考版本 ${entry.referencePatch}${entry.conventionIds.length ? ` · 约定 ${entry.conventionIds.join('、')}` : ''}`, 'item-pop-meta'));
  body.append(el('p', `译名：${LOCALIZATION_NAMES[entry.localizationStatus]} · 目录 ${entry.contentVersion}`, 'item-pop-meta'));
  body.append(el('p', '静态目录说明：能否合成或装备，以实际操作结果为准。', 'item-pop-note'));
  return body;
}

/**
 * One floating description popover for any element carrying data-item-def inside `scope`.
 * Shown on hover/focus, hidden on leave/blur/Escape/pointerdown; never intercepts pointers.
 */
export function attachItemPopover(scope: HTMLElement): () => void {
  const pop = el('div', '', 'item-popover'); pop.setAttribute('role', 'tooltip'); pop.id = 'item-popover'; pop.hidden = true; pop.dataset.debugItemPopover = 'true';
  document.body.append(pop);
  let anchor: HTMLElement | null = null;
  const hide = () => { if (anchor) anchor.removeAttribute('aria-describedby'); anchor = null; pop.hidden = true; pop.replaceChildren(); };
  const show = (target: HTMLElement) => {
    const entry = catalogEntry(target.dataset.itemDef ?? ''); if (!entry) { hide(); return; }
    if (anchor === target && !pop.hidden) return;
    hide(); anchor = target; target.setAttribute('aria-describedby', pop.id);
    pop.replaceChildren(describe(entry)); pop.dataset.itemDef = entry.id; pop.hidden = false;
    const rect = target.getBoundingClientRect(), width = Math.min(320, window.innerWidth - 16);
    pop.style.width = `${width}px`;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left - width - 10 >= 8 ? rect.left - width - 10 : rect.left));
    const height = pop.offsetHeight;
    const top = rect.left - width - 10 >= 8 ? Math.max(8, Math.min(window.innerHeight - height - 8, rect.top))
      : (rect.bottom + 8 + height <= window.innerHeight ? rect.bottom + 8 : Math.max(8, rect.top - height - 8));
    pop.style.left = `${left}px`; pop.style.top = `${top}px`;
  };
  const target = (event: Event) => (event.target instanceof Element ? event.target.closest<HTMLElement>('[data-item-def]') : null);
  const over = (event: PointerEvent) => { if (event.pointerType === 'mouse') { const t = target(event); if (t && scope.contains(t)) show(t); } };
  const out = (event: PointerEvent) => { const t = target(event); if (t && t === anchor && !(event.relatedTarget instanceof Node && t.contains(event.relatedTarget))) hide(); };
  const focus = (event: FocusEvent) => { const t = target(event); if (t) show(t); else hide(); };
  const blur = (event: FocusEvent) => { if (target(event) === anchor && !(event.relatedTarget instanceof Node && anchor?.contains(event.relatedTarget))) hide(); };
  const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !pop.hidden) hide(); };
  scope.addEventListener('pointerover', over); scope.addEventListener('pointerout', out);
  scope.addEventListener('focusin', focus); scope.addEventListener('focusout', blur);
  scope.addEventListener('pointerdown', hide); document.addEventListener('keydown', key); window.addEventListener('scroll', hide, true);
  return () => {
    scope.removeEventListener('pointerover', over); scope.removeEventListener('pointerout', out);
    scope.removeEventListener('focusin', focus); scope.removeEventListener('focusout', blur);
    scope.removeEventListener('pointerdown', hide); document.removeEventListener('keydown', key); window.removeEventListener('scroll', hide, true);
    hide(); pop.remove();
  };
}

type Filter = 'all' | 'component' | 'completed' | 'unique' | 'slots' | 'provisional';
const FILTERS: readonly [Filter, string][] = [['all', '全部'], ['component', '组件'], ['completed', '成装'], ['unique', '唯一'], ['slots', '占多槽'], ['provisional', '暂定']];
const matches = (entry: Entry, filter: Filter) => filter === 'all' || filter === entry.kind || filter === 'unique' && entry.unique
  || filter === 'slots' && entry.slotCost > 1 || filter === 'provisional' && entry.evidenceStatus === 'approved-provisional';

/**
 * Codex section (built once, reused across panel renders so filter/open state survive).
 * Tiles and recipe cells carry data-item-def for the shared popover.
 */
export function createItemCodex(): HTMLElement {
  const { list } = catalog();
  const root = el('details', '', 'item-codex'); root.dataset.debug = 'item-codex';
  const summary = el('summary', `装备图鉴与合成表（${list.length} 件 · ${list.filter(e => e.recipe).length} 条配方）`); summary.dataset.debug = 'item-codex-toggle';
  root.append(summary);
  root.append(el('p', '静态目录：展示配方与效果说明，不判断当前两件能否合成或能否装备；中文名均为临时译名。', 'codex-note'));

  const controls = el('div', '', 'codex-controls'); controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', '图鉴筛选');
  const buttons = new Map<Filter, HTMLButtonElement>();
  for (const [value, label] of FILTERS) {
    const count = list.filter(entry => matches(entry, value)).length;
    const button = el('button', `${label} ${count}`, 'codex-filter'); button.type = 'button'; button.dataset.debug = `codex-filter:${value}`;
    button.addEventListener('click', () => { filter = value; apply(); }); buttons.set(value, button); controls.append(button);
  }
  const search = el('input', '', 'codex-search'); search.type = 'search'; search.placeholder = '搜索名称或 apiName'; search.setAttribute('aria-label', '搜索装备'); search.dataset.debug = 'codex-search';
  search.addEventListener('input', () => apply());
  const count = el('p', '', 'codex-count'); count.setAttribute('aria-live', 'polite');
  root.append(controls, search, count);

  const grid = el('div', '', 'codex-grid'); grid.setAttribute('role', 'list');
  const tiles = list.map(entry => {
    const tile = el('div', '', `codex-tile kind-${entry.kind}`); tile.setAttribute('role', 'listitem'); tile.tabIndex = 0;
    tile.dataset.itemDef = entry.id; tile.dataset.codexItem = entry.id;
    tile.insertAdjacentHTML('afterbegin', itemMarkHtml(entry.id, 32));
    const text = el('div', '', 'codex-tile-text'); text.append(nameNode(entry));
    const tags = el('div', '', 'codex-tile-tags'); tags.append(el('span', KIND_NAMES[entry.kind], 'item-tag tag-kind'), ...tagNodes(entry)); text.append(tags);
    tile.append(text); tile.setAttribute('aria-label', `${entry.name}，${KIND_NAMES[entry.kind]}${itemTags(entry).map(tag => `，${tag.text}`).join('')}`);
    grid.append(tile); return { entry, tile };
  });
  root.append(grid);

  // 8×8 symmetric table: every unordered component pair appears once per side; results come from catalogue recipes.
  const components = list.filter(entry => entry.kind === 'component');
  root.append(el('h4', `合成表 · ${list.filter(e => e.recipe).length} 条配方`, 'codex-heading'));
  const table = el('table', '', 'recipe-matrix'); table.dataset.debug = 'recipe-matrix';
  table.append(el('caption', '行与列为两件组件，交点为配方结果（静态配方，不代表当前可合成）'));
  const head = table.createTHead().insertRow(); head.append(el('th'));
  for (const component of components) { const th = el('th'); th.scope = 'col'; th.dataset.itemDef = component.id; th.insertAdjacentHTML('afterbegin', itemMarkHtml(component.id, 26)); th.setAttribute('aria-label', component.name); head.append(th); }
  const body = table.createTBody();
  for (const a of components) {
    const row = body.insertRow(); const th = el('th'); th.scope = 'row'; th.dataset.itemDef = a.id; th.insertAdjacentHTML('afterbegin', itemMarkHtml(a.id, 26)); th.setAttribute('aria-label', a.name); row.append(th);
    for (const b of components) {
      const cell = row.insertCell(), result = recipeFor(a.id, b.id);
      if (!result) { cell.textContent = '—'; continue; }
      cell.dataset.itemDef = result.id; cell.dataset.recipeCell = `${a.id}+${b.id}`;
      cell.setAttribute('aria-label', `${a.name} + ${b.name} → ${result.name}`);
      cell.insertAdjacentHTML('afterbegin', itemMarkHtml(result.id, 30));
      if (result.evidenceStatus === 'approved-provisional') cell.classList.add('provisional');
      if (result.unique || result.slotCost > 1) cell.classList.add('declared');
    }
  }
  const scroller = el('div', '', 'recipe-scroll'); scroller.append(table); root.append(scroller);
  root.append(el('p', '交点带黄框：规则暂定；带角标：唯一或占多槽。悬停或聚焦查看完整说明。', 'codex-note'));

  let filter: Filter = 'all';
  function apply(): void {
    const query = search.value.trim().toLowerCase(); let shown = 0;
    for (const { entry, tile } of tiles) {
      const visible = matches(entry, filter) && (!query || entry.name.toLowerCase().includes(query) || entry.apiName.toLowerCase().includes(query) || entry.id.includes(query));
      tile.hidden = !visible; if (visible) shown++;
    }
    for (const [value, button] of buttons) button.setAttribute('aria-pressed', String(value === filter));
    count.textContent = `显示 ${shown} / ${list.length} 件`;
  }
  apply();
  return root;
}
