import { SHOP_CATALOG } from '../../simulation/match-rules';
import { UNIT_DEFINITIONS, type Unit } from '../../simulation/units';
import { getHeroIdentity, heroEmblemSvg } from '../hero-identity';
import { heroPortraitHtml, s13IconHtml } from '../s13-assets';
import { traitTierStyle } from '../trait-styles';
import { PLANNER_KEY, previewTraits, readPlanner, replacePlan, selectPlan, snapshotPlan, toggleHero, writePlanner, type PlannerState } from './model';
import { PLANNER_STYLE } from './style';
import { highlightShop } from './shop-highlight';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
const button = (text: string, action: () => void) => {
  const node = el('button', text); node.type = 'button'; node.onclick = action; return node;
};
let state: PlannerState | undefined;
let dialog: HTMLDialogElement | undefined;
let observer: MutationObserver | undefined;
let closePanel: (() => void) | undefined;
let scope: HTMLElement | undefined;
let shopRoot: HTMLElement | null;

function observeShop(): void {
  observer!.disconnect();
  if (shopRoot) observer!.observe(shopRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-unit-def'] });
}

/** Also used by the idle startup import, without opening a modal. */
export function enableShopHighlights(): void {
  if (state) return;
  state = readPlanner();
  shopRoot = document.querySelector<HTMLElement>('.shop-dock') ?? document.querySelector<HTMLElement>('#strategy-root');
  const style = el('style', PLANNER_STYLE); document.head.append(style);
  observer = new MutationObserver(records => {
    if (records.some(record => shopRoot?.contains(record.target)
      && (record.type === 'childList' || record.attributeName === 'data-unit-def'))) highlightShop(shopRoot!, state!);
    if (dialog?.open && (Array.from(document.querySelectorAll<HTMLElement>('.choice-overlay:not([hidden])')).some(node => getComputedStyle(node).display !== 'none') || !scope?.isConnected || scope.closest('[hidden], [inert]'))) closePanel?.();
  });
  observeShop();
  window.addEventListener('storage', event => { if (event.key === PLANNER_KEY || event.key === null) { state = readPlanner(); highlightShop(shopRoot ?? document, state); closePanel?.(); } });
  highlightShop(shopRoot ?? document, state);
}

/** The opener passes only its own roster. Nothing is written to Match, server, saves or replay. */
export function openPlanner(host: HTMLElement, readBoard?: () => readonly Unit[]): void {
  if (!host.isConnected || host.closest('[hidden], [inert]')) return;
  closePanel?.();
  scope = host;
  enableShopHighlights();
  observer!.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'inert', 'class', 'style', 'data-unit-def'] });
  dialog = el('dialog', '', 'team-planner'); dialog.dataset.debug = 'planner:panel'; dialog.setAttribute('aria-label', '阵容规划');
  const root = dialog, previousFocus = document.activeElement as HTMLElement | null;
  const close = () => { root.close(); root.remove(); if (dialog === root) dialog = undefined; closePanel = undefined;
    observeShop();
    if (previousFocus?.isConnected) previousFocus.focus(); else (host.parentElement ?? host).querySelector<HTMLElement>('[data-debug="planner:open"]')?.focus();
    window.removeEventListener('keydown', key, true);
  };
  // Stop game hotkeys while editing, while preserving native Tab, Enter and Space.
  const key = (event: KeyboardEvent) => {
    event.stopImmediatePropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(); }
  };
  closePanel = close;
  root.addEventListener('cancel', event => { event.preventDefault(); close(); });
  const change = (next: PlannerState) => { state = next; writePlanner(next); draw(); highlightShop(shopRoot ?? document, next); };
  const heroButton = (id: string, action: () => void) => {
    const name = getHeroIdentity(id).name, node = button('', action); node.className = 'planner-hero'; node.dataset.hero = id;
    node.insertAdjacentHTML('afterbegin', heroPortraitHtml(id, 36, heroEmblemSvg(id, 36))); node.append(el('span', name));
    node.setAttribute('aria-label', name); return node;
  };
  const draw = () => {
    const ids = state!.plans[state!.active], header = el('header'), tabs = el('div', '', 'planner-tabs');
    header.append(el('h2', '阵容规划'));
    for (let index = 0; index < 3; index++) {
      const tab = button(`规划 ${index + 1}`, () => change(selectPlan(state!, index)));
      tab.dataset.action = `plan-${index}`; tab.setAttribute('aria-pressed', String(index === state!.active)); tabs.append(tab);
    }
    header.append(tabs);
    const snapshot = button('快照', () => change(snapshotPlan(state!, readBoard!()))); snapshot.disabled = !readBoard;
    snapshot.title = readBoard ? '用自己的场上英雄替换当前规划' : '进入对局后可读取自己的场上英雄'; snapshot.dataset.debug = 'planner:snapshot';
    snapshot.dataset.action = 'snapshot';
    const clear = button('清空', () => change(replacePlan(state!, []))); clear.dataset.action = 'clear';
    header.append(snapshot, clear, button('关闭', close));
    const slots = el('div', '', 'planner-slots'); slots.setAttribute('aria-label', `当前规划 ${ids.length}/10`);
    for (let index = 0; index < 10; index++) {
      const id = ids[index];
      if (id) { const node = heroButton(id, () => change(toggleHero(state!, id))); node.setAttribute('aria-label', `移除 ${getHeroIdentity(id).name}`); slots.append(node); }
      else { const empty = button('空位', () => {}); empty.disabled = true; slots.append(empty); }
    }
    const body = el('div', '', 'planner-body'), catalog = el('section'); catalog.setAttribute('aria-label', '英雄列表');
    for (const cost of [1, 2, 3, 4, 5, 6]) {
      const row = el('div', '', 'planner-cost'); row.append(el('h3', `${cost} 费`));
      for (const id of SHOP_CATALOG.filter(id => UNIT_DEFINITIONS[id].cost === cost)) {
        const node = heroButton(id, () => change(toggleHero(state!, id))), selected = ids.includes(id);
        node.setAttribute('aria-pressed', String(selected)); node.disabled = !selected && ids.length >= 10; row.append(node);
      }
      catalog.append(row);
    }
    const traits = el('aside'); traits.append(el('h3', '羁绊预览'), el('p', '仅按英雄计算，不含纹章、异常与强化。', 'planner-note'));
    const list = el('ol', '', 'planner-traits');
    for (const trait of previewTraits(ids)) {
      const row = el('li'), style = traitTierStyle(trait.id, trait.tier, trait.thresholds); if (style) row.dataset.style = style;
      row.insertAdjacentHTML('afterbegin', s13IconHtml('trait', trait.id, 22, 'trait-icon'));
      row.append(el('span', `${trait.count} ${trait.name}`), el('small', trait.thresholds.map(value => value === trait.tier ? `[${value}]` : value).join('/')));
      list.append(row);
    }
    if (!list.childElementCount) list.append(el('li', '选择英雄后显示羁绊'));
    traits.append(list); body.append(catalog, traits);
    const focused = root.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset : undefined;
    root.replaceChildren(header, el('p', `本机保存 · ${ids.length}/10 · 点击英雄加入或移除 · Esc 关闭`, 'planner-note'), slots, body);
    if (focused?.hero) root.querySelector<HTMLButtonElement>(`.planner-cost [data-hero="${focused.hero}"]`)?.focus();
    else if (focused?.action) root.querySelector<HTMLButtonElement>(`[data-action="${focused.action}"]`)?.focus();
  };
  draw(); document.body.append(root); root.showModal(); window.addEventListener('keydown', key, true);
}
