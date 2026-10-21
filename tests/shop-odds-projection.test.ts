import { afterEach, expect, it, vi } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { StrategyPanel } from '../src/rendering/strategy-panel';
import { toDisplayMatch, type DisplayMatch } from '../src/rendering/online/seat-view-adapter';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';

/** Small DOM recorder: assertions inspect the text emitted by the real shop renderer. */
class ShopNode {
  children: (ShopNode | string)[] = [];
  dataset: Record<string, string> = {};
  className = '';
  private text = '';
  set textContent(value: string) { this.text = value; this.children = []; }
  get textContent(): string { return this.text + this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
  append(...children: (ShopNode | string)[]) { this.children.push(...children); }
  find(predicate: (node: ShopNode) => boolean): ShopNode | undefined {
    if (predicate(this)) return this;
    for (const child of this.children) {
      if (typeof child !== 'string') { const found = child.find(predicate); if (found) return found; }
    }
  }
}

afterEach(() => vi.unstubAllGlobals());

function renderOdds(state: DisplayMatch): ShopNode {
  vi.stubGlobal('document', { createElement: () => new ShopNode(), body: { dataset: {} } });
  const root = new ShopNode();
  // Exercise only the shop DOM boundary, avoiding unrelated panel controls/hover cards.
  // Keep the real renderShop and element creation; no copied formatter or mocked selector.
  const panel = Object.assign(Object.create(StrategyPanel.prototype), { root, shopChoiceQuietUntil: 0 }) as {
    renderShop(state: DisplayMatch, ready: boolean): void;
  };
  panel.renderShop({ ...state, pendingChoice: null, shop: { ...state.shop, slots: [] } }, true);
  return root.find(node => node.className === 'shop-odds')!;
}

it.each([
  [0, undefined],
  [1, '6费 0.01%'],
  [20, '6费 0.20%'],
  [10000, '6费 100.00%'],
] as const)('renders projected six-cost odds of %i Bps without applying round/level rules', (sixCostBps, expected) => {
  // Round 1 ordinarily has no six-cost chance; every positive projected value must win.
  const privateView = toPrivateSeatView(createMatch(7));
  const state = toDisplayMatch({ ...privateView, shopOdds: { sixCostBps } } as never);
  const odds = renderOdds(state);
  expect(odds.find(node => node.dataset.cost === '6')?.textContent).toBe(expected);
  expect(odds.textContent).not.toContain('undefined');
});

it('hides missing six-cost odds even at a late round and level that would unlock them offline', () => {
  const base = createMatch(7);
  const state: DisplayMatch = { ...base, round: 40, level: 10 };
  const odds = renderOdds(state);
  expect(odds.find(node => node.dataset.cost === '6')).toBeUndefined();
  expect(odds.textContent).not.toContain('6费');
  expect(odds.textContent).not.toMatch(/NaN|undefined/);
});
