import './augment-hud.css';

/**
 * Owned augments on the board's upper-left corner, as in the S13 client (docs/V26_AUGMENT_ICONS_LAYOUT.md:
 * a small horizontal row above the player's own hextech device, about 27% across and 24% down the screen,
 * separate from the item and trait columns). Hit targets stay 44px; only the artwork inside is smaller.
 */
export const AUGMENT_CHIP_SIZE = 44;
export const AUGMENT_CHIP_GAP = 4;
const EDGE = 6;
/** S13 screenshots: the row's centre sits at about (26.7vw, 23.8vh) in 3D. */
const ANCHOR_3D = { x: 0.267, y: 0.238 };
/** 2D: the row's centre sits a fifth of the way down the board, like the S13 row against its board. */
const ANCHOR_2D_Y = 0.2;

export interface AugmentStripRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface AugmentStripLayoutInput {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly count: number;
  readonly threeD: boolean;
  readonly board: AugmentStripRect;
  /** Left-hand HUD boxes (trait rail, open strategy drawer, item column); the row stays right of them. */
  readonly left: readonly AugmentStripRect[];
}

export interface AugmentStripLayout {
  readonly left: number;
  readonly top: number;
  readonly columns: number;
  readonly width: number;
  readonly height: number;
}

const span = (n: number): number => n <= 0 ? 0 : n * AUGMENT_CHIP_SIZE + (n - 1) * AUGMENT_CHIP_GAP;
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/** Viewport box of the owned-augment row. Pure, so the placement rules are testable without a page. */
export function augmentStripLayout(input: AugmentStripLayoutInput): AugmentStripLayout {
  const count = Math.max(0, Math.floor(input.count));
  if (!count) return { left: 0, top: 0, columns: 0, width: 0, height: 0 };
  const { board } = input, boardMiddle = (board.left + board.right) / 2;
  // Only boxes in the left half count; the player list and shop sit elsewhere.
  const leftEdge = Math.max(0, ...input.left.filter(box => box.right > box.left && box.right <= boardMiddle).map(box => box.right)) + EDGE;
  let columns = count, left: number, top: number;
  if (input.threeD) {
    left = Math.max(leftEdge, input.viewportWidth * ANCHOR_3D.x - span(count) / 2);
    top = input.viewportHeight * ANCHOR_3D.y - AUGMENT_CHIP_SIZE / 2;
  } else {
    // In the gap left of the board, wrapping to fewer columns rather than covering hexes. No room at all: inside the corner.
    const room = board.left - EDGE - leftEdge;
    if (room >= AUGMENT_CHIP_SIZE) {
      columns = clamp(Math.floor((room + AUGMENT_CHIP_GAP) / (AUGMENT_CHIP_SIZE + AUGMENT_CHIP_GAP)), 1, count);
      left = board.left - EDGE - span(columns);
    } else left = board.left + EDGE;
    top = board.top + (board.bottom - board.top) * ANCHOR_2D_Y - span(Math.ceil(count / columns)) / 2;
  }
  const width = span(columns), height = span(Math.ceil(count / columns));
  left = clamp(left, EDGE, Math.max(EDGE, input.viewportWidth - EDGE - width));
  top = clamp(top, EDGE, Math.max(EDGE, input.viewportHeight - EDGE - height));
  return { left: Math.round(left), top: Math.round(top), columns, width, height };
}

const rectOf = (node: Element | null): AugmentStripRect | null => {
  if (!node || (node as HTMLElement).hidden) return null;
  const box = node.getBoundingClientRect();
  return box.width > 0 && box.height > 0 ? { left: box.left, top: box.top, right: box.right, bottom: box.bottom } : null;
};

/** Measure the live board and HUD, then write the row's viewport position. */
export function placeAugmentStrip(strip: HTMLElement): void {
  const count = strip.querySelectorAll(':scope > .augment-chip').length;
  if (!count) { delete strip.dataset.placed; return; }
  // An unmeasured board (still mounting, or folded away on a narrow screen) must not hide the row: assume the middle half.
  const board = rectOf(document.getElementById('board-root'))
    ?? { left: window.innerWidth * 0.25, top: 0, right: window.innerWidth * 0.75, bottom: rectOf(document.getElementById('shop-dock'))?.top ?? window.innerHeight };
  const threeD = Boolean(document.body.querySelector(':scope > .render3d-layer'));
  // The 2D item column sits under the board's left edge, below the row, so it is not a horizontal limit there.
  const left = ['#panels-root', '#strategy-root', '#trait-column', '.left-panel-toggle', ...(threeD ? ['#item-dock'] : [])]
    .map(selector => rectOf(document.querySelector(selector))).filter((box): box is AugmentStripRect => box !== null);
  const layout = augmentStripLayout({ viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, count, threeD, board, left });
  strip.style.left = `${layout.left}px`; strip.style.top = `${layout.top}px`;
  strip.style.setProperty('--augment-columns', String(layout.columns));
  strip.dataset.placed = threeD ? '3d' : '2d';
}

/** Follow the board, the left drawer and the viewport; open the list on tap. Returns a disposer. */
export function bindAugmentStrip(strip: HTMLElement): () => void {
  // Observer callbacks already arrive batched once per frame; placing is a handful of rect reads.
  const update = () => placeAugmentStrip(strip);
  const resize = new ResizeObserver(update);
  for (const id of ['board-root', 'app', 'panels-root', 'strategy-root', 'item-dock']) {
    const node = document.getElementById(id);
    if (node) resize.observe(node);
  }
  // Chips arrive with each new augment; the 3D layer and the left drawer toggle through body children/attributes.
  const mutation = new MutationObserver(update);
  mutation.observe(strip, { childList: true });
  mutation.observe(document.body, { childList: true, attributes: true, attributeFilter: ['data-online-left', 'data-online'] });
  // Touch or click: a tap on an icon opens the list, a second tap or a tap elsewhere closes it.
  const toggle = (event: Event) => {
    const chip = (event.target as Element | null)?.closest?.('.augment-chip');
    if (chip && chip.parentElement === strip) strip.toggleAttribute('data-open');
  };
  const outside = (event: Event) => { if (!strip.contains(event.target as Node)) strip.removeAttribute('data-open'); };
  strip.addEventListener('click', toggle);
  document.addEventListener('pointerdown', outside, true);
  window.addEventListener('resize', update);
  placeAugmentStrip(strip);
  return () => {
    resize.disconnect(); mutation.disconnect();
    strip.removeEventListener('click', toggle); document.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('resize', update);
  };
}
