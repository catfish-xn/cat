import { onTooltipTextChanged } from './tooltip-text-loader';
/**
 * One floating description card for units and traits (G2 prerequisite). DOM anchors inside a scope open it on hover or
 * focus through `attachHoverCards`; the board canvas opens it at a token's screen box through `showAt`. It never takes
 * pointer events, so it cannot block a drag or a click underneath.
 */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.className = className; return node;
}

export interface HoverBox { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

export class HoverCard {
  readonly root: HTMLElement;
  private key: string | null = null;
  private rebuild: (() => void) | undefined;
  private readonly unsubscribe: () => void;
  constructor(id: string, debug: string) {
    this.root = el('div', 'hover-card'); this.root.id = id; this.root.setAttribute('role', 'tooltip'); this.root.hidden = true;
    this.root.dataset.debug = debug;
    document.body.append(this.root);
    this.unsubscribe = onTooltipTextChanged(() => this.rebuild?.());
  }
  get shownKey(): string | null { return this.key; }
  /** Shows `build()` beside `box` (viewport coordinates); rebuilds only when `key` changed. */
  showAt(box: HoverBox, key: string, build: () => HTMLElement): void {
    this.rebuild = () => { this.key = null; this.showAt(box, key, build); };
    if (this.key !== key) { this.root.replaceChildren(build()); this.key = key; this.root.dataset.key = key; }
    this.root.hidden = false;
    const width = Math.min(320, window.innerWidth - 16);
    this.root.style.width = `${width}px`;
    const height = this.root.offsetHeight;
    const right = box.right + 10 + width <= window.innerWidth - 8;
    const left = right ? box.right + 10 : Math.max(8, box.left - width - 10);
    // A card for something above the shop bar stays above the bar, so it never hides the shop cards, gold or buttons.
    const dock = document.getElementById('shop-dock')?.getBoundingClientRect?.();
    const floor = dock && dock.height > 0 && box.bottom <= dock.top + 1 ? dock.top : window.innerHeight;
    const top = Math.max(8, Math.min(floor - height - 8, box.top));
    this.root.style.left = `${left}px`; this.root.style.top = `${top}px`;
  }
  hide(): void {
    if (this.key === null && this.root.hidden) return;
    this.rebuild = undefined;
    this.key = null; this.root.hidden = true; this.root.replaceChildren(); delete this.root.dataset.key;
  }
  dispose(): void { this.unsubscribe(); this.rebuild = undefined; this.root.remove(); }
}

/**
 * Opens `card` for the closest element of `scope` that `resolve` accepts, on mouse hover or keyboard focus; closes on leave,
 * blur, pointerdown, Escape, or when the anchor leaves the document (a panel rebuild).
 * `pin`: a click or tap on an anchor (TFT: tap to read on touch) keeps its card open until the same anchor is pressed again,
 * something outside the card is pressed, Escape, or the anchor goes away; hover and blur then leave it alone.
 */
export function attachHoverCards(scope: HTMLElement, card: HoverCard, selector: string, resolve: (anchor: HTMLElement) => { key: string; build: () => HTMLElement } | null,
  { pin = false }: { readonly pin?: boolean } = {}): () => void {
  let anchor: HTMLElement | null = null, pinned = false;
  const watcher = new MutationObserver(() => { if (anchor && !anchor.isConnected) close(); });
  function close(): void { anchor = null; pinned = false; watcher.disconnect(); card.hide(); document.removeEventListener('pointerdown', outside, true); }
  // A press anywhere but the card or the pinned anchor (whose own press toggles it) closes a pinned card.
  function outside(event: PointerEvent): void {
    const node = event.target instanceof Node ? event.target : null;
    if (node && (card.root.contains(node) || anchor?.contains(node))) return;
    close();
  }
  function open(target: HTMLElement): void {
    const found = resolve(target);
    if (!found) { close(); return; }
    anchor = target;
    card.showAt(target.getBoundingClientRect(), found.key, found.build);
    watcher.disconnect(); watcher.observe(scope, { childList: true, subtree: true });
  }
  const targetOf = (event: Event) => event.target instanceof Element ? event.target.closest<HTMLElement>(selector) : null;
  const over = (event: PointerEvent) => { if (event.pointerType !== 'mouse' || pinned) return; const target = targetOf(event); if (target && scope.contains(target) && target !== anchor) open(target); };
  const out = (event: PointerEvent) => {
    const target = targetOf(event);
    if (!pinned && target && target === anchor && !(event.relatedTarget instanceof Node && target.contains(event.relatedTarget))) close();
  };
  const focus = (event: FocusEvent) => { if (pinned) return; const target = targetOf(event); if (target && scope.contains(target)) open(target); };
  const blur = (event: FocusEvent) => { if (!pinned && targetOf(event) === anchor) close(); };
  const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && anchor) close(); };
  const press = (event: PointerEvent) => {
    const target = pin ? targetOf(event) : null;
    if (!target || !scope.contains(target)) { close(); return; }
    if (pinned && target === anchor) { close(); return; }
    open(target);
    if (anchor !== target) return;
    pinned = true; document.addEventListener('pointerdown', outside, true);
  };
  scope.addEventListener('pointerover', over); scope.addEventListener('pointerout', out);
  scope.addEventListener('focusin', focus); scope.addEventListener('focusout', blur);
  scope.addEventListener('pointerdown', press); document.addEventListener('keydown', key);
  return () => {
    scope.removeEventListener('pointerover', over); scope.removeEventListener('pointerout', out);
    scope.removeEventListener('focusin', focus); scope.removeEventListener('focusout', blur);
    scope.removeEventListener('pointerdown', press); document.removeEventListener('keydown', key);
    close();
  };
}

const shared = new Map<string, HoverCard>();
/** One card per id for the page; a scene restart reuses it (or recreates it if something removed it). */
export function sharedHoverCard(id: 'unit-card' | 'trait-card', debug: string): HoverCard {
  let card = shared.get(id);
  if (!card || !card.root.isConnected) { card = new HoverCard(id, debug); shared.set(id, card); }
  return card;
}
export const unitHoverCard = () => sharedHoverCard('unit-card', 'hover:unit');
export const traitHoverCard = () => sharedHoverCard('trait-card', 'hover:trait');
