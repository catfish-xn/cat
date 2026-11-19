/**
 * The carousel holding slot (临时位) and the helpers it shares with the carousel panel. The holding slot shows outside
 * carousel rounds, so it stays in the main bundle; the carousel panel itself is its own chunk (carousel-panel-loader.ts).
 */
import { attachHoverCards, HoverCard } from '../../presentation/hover-card';
import { unitCardBody } from '../../presentation/unit-card';
import { hoverAction } from '../../presentation/text-card';
import { UNIT_DEFINITIONS } from '../../simulation/units';
import { getHeroIdentity, heroEmblemSvg } from '../../presentation/hero-identity';
import { attachItemPopover } from '../../presentation/item-codex';
import { heroPortraitHtml } from '../../presentation/s13-assets';

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}
export const unitName = (definitionId: string) => getHeroIdentity(definitionId).name;

export const HOLDING_RULE = '临时位：只保管，不参战 · 备战席或场上有空位时自动移入';
export function attachCarouselCards(scope: HTMLElement): () => void {
  const card = new HoverCard(`${scope.className}-unit-card`, 'hover:carousel');
  const detach = attachHoverCards(scope, card, '[data-carousel-unit], [data-item-def], .carousel-holding-sell', anchor => {
    const id = anchor.dataset.carouselUnit;
    if (!id) return null;
    const star = Number(anchor.dataset.star ?? 1) as 1 | 2 | 3;
    const notes = anchor.dataset.holding ? [HOLDING_RULE] : [];
    return { key: `${id}:${star}:${notes}`, build: () => unitCardBody(id, star, null, '', notes)! };
  }, { pin: true, longPress: hoverAction });
  const items = attachItemPopover(scope, `${scope.className}-item-card`, { pin: true, longPress: hoverAction });
  return () => { detach(); items(); card.dispose(); };
}

/**
 * One unit in the carousel holding slot (临时位): a pick the rules could not place because my bench and my board were both
 * full (MULTIPLAYER_CONTRACT §21.6). The server sends them as `PrivateSeatView.heldCarouselUnits`, copied from the rules'
 * `carousel.heldCarouselUnits`; only `readHeldCarouselUnits` reads the wire.
 */
export interface HeldCarouselUnitView { readonly receiptId: string; readonly unitId: string; readonly definitionId: string }
/** The held units of my seat view (or its display copy); empty when the server sent none. */
export function readHeldCarouselUnits(state: object): readonly HeldCarouselUnitView[] {
  const held = (state as { readonly heldCarouselUnits?: unknown }).heldCarouselUnits;
  return Array.isArray(held) ? held as HeldCarouselUnitView[] : [];
}

/**
 * The holding slot (临时位) beside the bench: a carousel unit kept there does not fight. The server moves it out by
 * itself once the bench or the board has room (the rules decide where); the only command here is the explicit sell, the
 * same `sell` as any unit.
 */
export class CarouselHoldingSlot {
  readonly root: HTMLElement;
  private readonly detach: () => void;
  private key = '';
  constructor(host: HTMLElement, private readonly onSell: (unitId: string) => void) {
    this.root = element('aside', '', 'carousel-holding'); this.root.hidden = true; this.root.dataset.debug = 'online:carousel-holding';
    this.root.setAttribute('aria-label', '临时位 · 不参战');
    host.append(this.root); this.detach = attachCarouselCards(this.root);
  }
  render(units: readonly HeldCarouselUnitView[], operable: boolean, refusal = '准备阶段可出售'): void {
    const key = `${operable}|${refusal}|${units.map(unit => unit.unitId).join(',')}`;
    if (key === this.key) return;
    this.key = key;
    this.root.hidden = units.length === 0;
    const cards = units.map(unit => {
      const cost = UNIT_DEFINITIONS[unit.definitionId]?.cost ?? 0;
      const card = element('div', '', `carousel-holding-unit cost-${cost}`); card.dataset.unit = unit.unitId; card.dataset.definition = unit.definitionId;
      card.dataset.debug = `online:carousel-holding-unit:${unit.unitId}`;
      card.dataset.carouselUnit = unit.definitionId; card.dataset.holding = 'true'; card.tabIndex = 0;
      card.setAttribute('aria-label', `${unitName(unit.definitionId)} · ${HOLDING_RULE}`);
      const portrait = element('span', '', 'carousel-holding-portrait');
      portrait.innerHTML = heroPortraitHtml(unit.definitionId, 40, heroEmblemSvg(unit.definitionId, 40));
      const sell = element('button', `出售 +${cost}`, 'carousel-holding-sell'); sell.type = 'button'; sell.disabled = !operable;
      sell.dataset.debug = `online:carousel-holding-sell:${unit.unitId}`;
      sell.title = operable ? `出售 ${unitName(unit.definitionId)}` : refusal;
      sell.addEventListener('click', () => { if (!sell.disabled) this.onSell(unit.unitId); });
      card.append(portrait, element('span', unitName(unit.definitionId), 'carousel-holding-name'), element('span', '不参战', 'carousel-holding-idle'), sell);
      return card;
    });
    const head = element('header', '', 'carousel-holding-head'); head.setAttribute('aria-label', HOLDING_RULE);
    head.append(element('strong', '临时位', 'carousel-holding-title'), element('span', '只保管不参战 · 有空位自动移入', 'carousel-holding-note'));
    this.root.replaceChildren(head, ...cards);
  }
  dispose(): void { this.detach(); this.root.remove(); }
}
