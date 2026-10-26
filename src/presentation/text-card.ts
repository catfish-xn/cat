import { attachHoverCards, HoverCard } from './hover-card';

/** G: verbatim display text, shared by passive labels and action controls. */
export function textCard(anchor: HTMLElement, text: string): void {
  anchor.dataset.textCard = text;
  anchor.removeAttribute('title'); anchor.setAttribute('aria-label', text);
  if (!anchor.matches('button,[tabindex]')) anchor.tabIndex = 0;
}
export const hoverAction = (anchor: HTMLElement): boolean => !!anchor.closest('button,[role="button"],[data-hover-action]');
export function textCardBody(text: string): HTMLElement {
  const body = document.createElement('div');
  text.split('\n').filter(Boolean).forEach((line, index) => {
    const node = document.createElement(index ? 'p' : 'strong'); node.className = index ? 'unit-card-text' : 'unit-card-name'; node.textContent = line; body.append(node);
  });
  return body;
}
let serial = 0;
export function attachTextCards(scope: HTMLElement): () => void {
  const card = new HoverCard(`text-card-${++serial}`, 'hover:text');
  const detach = attachHoverCards(scope, card, '[data-text-card]', anchor => ({ key: anchor.dataset.textCard!, build: () => textCardBody(anchor.dataset.textCard!) }), { pin: true, longPress: hoverAction });
  return () => { detach(); card.dispose(); };
}
