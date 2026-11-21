import { afterEach, expect, test, vi } from 'vitest';
import { highlightShop } from '../src/presentation/team-planner/shop-highlight';
import { normalizePlanner, selectPlan, toggleHero } from '../src/presentation/team-planner/model';

// Only the DOM decoration surface: real planner/highlight code runs unchanged.
class Card {
  dataset: Record<string, string> = {};
  attrs = new Map<string, string>();
  classes = new Set<string>(['shop-card', 'upgrade']);
  classList = { contains: (name: string) => this.classes.has(name), toggle: (name: string, on: boolean) => on ? this.classes.add(name) : this.classes.delete(name) };
  children: Card[] = []; className = ''; textContent = ''; disabled = false;
  parent?: Card;
  onclick = vi.fn();
  constructor(id?: string) { if (id) this.dataset.unitDef = id; this.attrs.set('aria-label', '购买 艾瑞莉娅，1 金币，可升 2 星'); }
  setAttribute(key: string, value: string) { this.attrs.set(key, value); }
  getAttribute(key: string) { return this.attrs.get(key) ?? null; }
  append(mark: Card) { this.children.push(mark); mark.parent = this; }
  querySelector() { return this.children.find(child => child.className === 'planner-mark') ?? null; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
}
afterEach(() => vi.unstubAllGlobals());
function render(cards: Card[], state: ReturnType<typeof normalizePlanner>) {
  vi.stubGlobal('document', { createElement: () => new Card() });
  highlightShop({ querySelectorAll: () => cards } as unknown as ParentNode, state);
}

test('planning marks are idempotent and removable while purchase/upgrade state stays intact', () => {
  const card = new Card('irelia'), click = card.onclick, beforeLabel = card.getAttribute('aria-label');
  card.disabled = true;
  const selected = toggleHero(normalizePlanner(null), 'irelia');
  render([card], selected); render([card], selected);
  expect(card.classList.contains('planned')).toBe(true);
  expect(card.children).toHaveLength(1);
  expect(card.children[0].textContent).toBe('规划');
  expect(card.children[0].getAttribute('aria-hidden')).toBe('true');
  expect(card.getAttribute('aria-label')).toBe(`${beforeLabel}，在阵容规划中`);
  expect(card.classList.contains('upgrade')).toBe(true);
  expect(card.disabled).toBe(true); expect(card.onclick).toBe(click); expect(click).not.toHaveBeenCalled();
  render([card], selectPlan(selected, 1));
  expect(card.classList.contains('planned')).toBe(false);
  expect(card.children).toHaveLength(0); expect(card.getAttribute('aria-label')).toBe(beforeLabel);
});

test('new shop cards receive highlights after refresh, unknown/sold slots never do and reused slots are cleared', () => {
  const state = toggleHero(normalizePlanner(null), 'irelia');
  const first = new Card('irelia'); render([first], state);
  const refreshed = new Card('irelia'), sold = new Card(), unknown = new Card('removed-hero');
  render([refreshed, sold, unknown], state);
  expect(refreshed.classList.contains('planned')).toBe(true);
  expect(sold.children).toHaveLength(0); expect(unknown.children).toHaveLength(0);
  refreshed.dataset.unitDef = 'lux'; render([refreshed], state);
  expect(refreshed.classList.contains('planned')).toBe(false); expect(refreshed.children).toHaveLength(0);
});
