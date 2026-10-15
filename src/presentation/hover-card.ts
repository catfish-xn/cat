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
  constructor(id: string, debug: string) {
    this.root = el('div', 'hover-card'); this.root.id = id; this.root.setAttribute('role', 'tooltip'); this.root.hidden = true;
    this.root.dataset.debug = debug;
    document.body.append(this.root);
  }
  get shownKey(): string | null { return this.key; }
  /** Shows `build()` beside `box` (viewport coordinates); rebuilds only when `key` changed. */
  showAt(box: HoverBox, key: string, build: () => HTMLElement): void {
    if (this.key !== key) { this.root.replaceChildren(build()); this.key = key; this.root.dataset.key = key; }
    this.root.hidden = false;
    const width = Math.min(320, window.innerWidth - 16);
    this.root.style.width = `${width}px`;
    const height = this.root.offsetHeight;
    const right = box.right + 10 + width <= window.innerWidth - 8;
    const left = right ? box.right + 10 : Math.max(8, box.left - width - 10);
    const top = Math.max(8, Math.min(window.innerHeight - height - 8, box.top));
    this.root.style.left = `${left}px`; this.root.style.top = `${top}px`;
  }
  hide(): void {
    if (this.key === null && this.root.hidden) return;
    this.key = null; this.root.hidden = true; this.root.replaceChildren(); delete this.root.dataset.key;
  }
  dispose(): void { this.root.remove(); }
}

/**
 * Opens `card` for the closest element of `scope` that `resolve` accepts, on mouse hover or keyboard focus; closes on leave,
 * blur, pointerdown, Escape, or when the anchor leaves the document (a panel rebuild).
 */
export function attachHoverCards(scope: HTMLElement, card: HoverCard, selector: string, resolve: (anchor: HTMLElement) => { key: string; build: () => HTMLElement } | null): () => void {
  let anchor: HTMLElement | null = null;
  const watcher = new MutationObserver(() => { if (anchor && !anchor.isConnected) close(); });
  function close(): void { anchor = null; watcher.disconnect(); card.hide(); }
  function open(target: HTMLElement): void {
    const found = resolve(target);
    if (!found) { close(); return; }
    anchor = target;
    card.showAt(target.getBoundingClientRect(), found.key, found.build);
    watcher.disconnect(); watcher.observe(scope, { childList: true, subtree: true });
  }
  const targetOf = (event: Event) => event.target instanceof Element ? event.target.closest<HTMLElement>(selector) : null;
  const over = (event: PointerEvent) => { if (event.pointerType !== 'mouse') return; const target = targetOf(event); if (target && scope.contains(target) && target !== anchor) open(target); };
  const out = (event: PointerEvent) => {
    const target = targetOf(event);
    if (target && target === anchor && !(event.relatedTarget instanceof Node && target.contains(event.relatedTarget))) close();
  };
  const focus = (event: FocusEvent) => { const target = targetOf(event); if (target && scope.contains(target)) open(target); };
  const blur = (event: FocusEvent) => { if (targetOf(event) === anchor) close(); };
  const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && anchor) close(); };
  scope.addEventListener('pointerover', over); scope.addEventListener('pointerout', out);
  scope.addEventListener('focusin', focus); scope.addEventListener('focusout', blur);
  scope.addEventListener('pointerdown', close); document.addEventListener('keydown', key);
  return () => {
    scope.removeEventListener('pointerover', over); scope.removeEventListener('pointerout', out);
    scope.removeEventListener('focusin', focus); scope.removeEventListener('focusout', blur);
    scope.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key);
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
