import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { StrategyPanel } from '../../src/rendering/strategy-panel';
import { attachItemPopover, itemDescriptions } from '../../src/presentation/item-codex';
import { itemDisplayName } from '../../src/presentation/g23-display';
import { loadTooltipText } from '../../src/presentation/tooltip-text-loader';
import { G23_BLACK_MARKETS } from '../../src/simulation/content/g2-3-policy';
import { g23RewardIcons } from '../../src/presentation/g23-reward-text';
import { CONSUMABLE_DEFINITIONS } from '../../src/simulation/content/consumables';

beforeAll(() => loadTooltipText());

// DOM/event recorder: actual market rendering and the shared inventory popover run together.
class Node {
  children: Node[] = []; parent: Node | null = null;
  dataset: Record<string, string> = {}; style: Record<string, string> = {};
  attrs: Record<string, string> = {}; listeners = new Map<string, Set<(event: any) => void>>();
  className = ''; innerHTML = ''; title = ''; hidden = false; tabIndex = -1; id = ''; offsetHeight = 200;
  private text = '';
  classList = { add: (...names: string[]) => { this.className += ` ${names.join(' ')}`; } };
  get childElementCount() { return this.children.length; }
  get isConnected(): boolean { return this === body || Boolean(this.parent?.isConnected); }
  set textContent(value: string) { this.text = value; this.children = []; }
  get textContent(): string { return this.text + this.children.map(child => child.textContent).join(''); }
  append(...children: Node[]) { for (const child of children) { child.parent = this; this.children.push(child); } }
  replaceChildren(...children: Node[]) { for (const child of this.children) child.parent = null; this.children = []; this.append(...children); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  contains(node: Node): boolean { return node === this || this.children.some(child => child.contains(node)); }
  closest(): Node | null { return this.dataset.itemDef ? this : this.parent?.closest() ?? null; }
  setAttribute(name: string, value: string) { this.attrs[name] = value; }
  removeAttribute(name: string) { delete this.attrs[name]; }
  insertAdjacentHTML(_where: string, html: string) { this.innerHTML += html; }
  getBoundingClientRect() { return { left: 400, right: 460, top: 400, bottom: 460, width: 60, height: 60 }; }
  addEventListener(name: string, fn: (event: any) => void) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name)!.add(fn); }
  removeEventListener(name: string, fn: (event: any) => void) { this.listeners.get(name)?.delete(fn); }
  emit(name: string, target: Node = this, extra = {}) { for (const fn of this.listeners.get(name) ?? []) fn({ target, pointerType: 'mouse', ...extra }); }
  all(): Node[] { return [this, ...this.children.flatMap(child => child.all())]; }
}
let body: Node;
afterEach(() => vi.unstubAllGlobals());
function setup() {
  body = new Node();
  const doc = Object.assign(new Node(), { body, createElement: () => new Node(), getElementById: () => null, activeElement: null });
  vi.stubGlobal('document', doc); vi.stubGlobal('Element', Node); vi.stubGlobal('Node', Node);
  vi.stubGlobal('window', Object.assign(new Node(), { innerWidth: 1440, innerHeight: 900 }));
  vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} });
  const cards = new Node(); body.append(cards);
  const send = vi.fn();
  const panel = Object.create(StrategyPanel.prototype) as {
    blackMarketBundle(cards: Node, id: string, options: unknown[], drawn: string | undefined,
      concrete: { definitionId: string }[] | undefined, skip: boolean, perSkip: number, send: (id: string) => void): void;
  };
  const dispose = attachItemPopover(cards as unknown as HTMLElement, 'shop-item-popover');
  return { cards, panel, send, dispose, pop: () => body.all().find(n => n.id === 'shop-item-popover')! };
}

it('opens each concrete online market item with the inventory name/effects and keeps take/skip callbacks', () => {
  const ui = setup();
  const option = G23_BLACK_MARKETS.flatMap(m => m.options).find(option =>
    g23RewardIcons(option.reward).filter(icon => icon.kind === 'item' && /^Tier/.test(icon.source ?? '')).length >= 2)!;
  expect(option).toBeDefined();
  const ids = ['TFT13_Crime_Bronze_ChemGrips', 'TFT13_Crime_Silver_FleshRipper'];
  ui.panel.blackMarketBundle(ui.cards, option.id, [option], undefined, ids.map(definitionId => ({ definitionId })), true, 1, ui.send);
  const slots = ui.cards.all().filter(n => n.dataset.itemDef);
  expect(slots.map(slot => slot.dataset.itemDef)).toEqual(ids);
  for (const slot of slots) {
    expect(slot.tabIndex).toBe(0);
    ui.cards.emit('pointerover', slot);
    const pop = ui.pop(), id = slot.dataset.itemDef;
    expect(pop.hidden).toBe(false); expect(pop.dataset.itemDef).toBe(id);
    expect(pop.textContent).toContain(itemDisplayName(id));
    for (const line of itemDescriptions(id)) expect(pop.textContent).toContain(line);
    ui.cards.emit('pointerout', slot); expect(pop.hidden).toBe(true);
    ui.cards.emit('focusin', slot); expect(pop.hidden).toBe(false);
    ui.cards.emit('pointerdown', slot); expect(pop.hidden).toBe(true);
  }
  expect(ui.send).not.toHaveBeenCalled();
  ui.cards.all().find(n => n.dataset.debug === 'market:take')!.emit('click');
  ui.cards.all().find(n => n.dataset.debug === 'market:keep')!.emit('click');
  expect(ui.send.mock.calls).toEqual([[option.id], ['@skip']]);
  ui.dispose(); expect(ui.pop()).toBeUndefined();
});

it('describes a legacy single-item offer and never presents a random pool as a concrete item', () => {
  const ui = setup(), id = 'TFT13_Crime_Bronze_ChemGrips';
  ui.panel.blackMarketBundle(ui.cards, id, [], undefined, undefined, false, 1, ui.send);
  const slot = ui.cards.all().find(n => n.dataset.itemDef === id)!;
  ui.cards.emit('focusin', slot);
  expect(ui.pop().textContent).toContain(itemDisplayName(id));
  ui.dispose();
  const pool = setup();
  pool.panel.blackMarketBundle(pool.cards, 'pool', [{ id: 'pool', reward: { Item: ['Tier1'] } }], undefined, undefined, false, 1, pool.send);
  expect(pool.cards.all().some(n => n.dataset.itemDef)).toBe(false);
  pool.dispose();
});

it('keeps native backpack-style effect descriptions for consumable rewards', () => {
  const ui = setup(), tool = CONSUMABLE_DEFINITIONS.TFT13_Crime_Consumable_LesserShimmerDuplicator;
  ui.panel.blackMarketBundle(ui.cards, 'tools', [{ id: 'tools', reward: { Consumables: [tool.apiName] } }], undefined, undefined, false, 1, ui.send);
  expect(ui.cards.all().find(n => n.className === 'market-slot')!.title).toBe(`${tool.name}\n${tool.description}`);
  ui.dispose();
});
