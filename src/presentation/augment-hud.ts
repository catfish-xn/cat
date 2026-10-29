import './augment-hud.css';

const GAP = 4;
const ICON_GAP = 2;

export interface AugmentStripRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

export interface AugmentStripLayoutInput {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly board: AugmentStripRect;
  /** Left column beside the board. Ignored when it is not actually beside the board. */
  readonly rail: AugmentStripRect | null;
  readonly shop: AugmentStripRect | null;
  readonly items: readonly AugmentStripRect[];
  readonly threeD: boolean;
  readonly count: number;
}

export interface AugmentStripLayout {
  readonly left: number;
  readonly top: number;
  readonly size: number;
}

const naturalSize = (viewportWidth: number): number => Math.min(44, Math.max(24, viewportWidth * 0.022));
const rowWidth = (count: number, size: number): number => count * size + Math.max(0, count - 1) * ICON_GAP;
const overlaps = (left: number, top: number, width: number, height: number, box: AugmentStripRect): boolean =>
  left < box.right && left + width > box.left && top < box.bottom && top + height > box.top;

/** Right edge of a column that sits beside the board. A rail below the board is not a horizontal limit. */
function railRight(rail: AugmentStripRect | null, board: AugmentStripRect): number {
  if (!rail || rail.width <= 0 || rail.height <= 0) return 0;
  const beside = rail.right <= board.left + GAP && rail.bottom > board.top && rail.top < board.bottom;
  return beside ? rail.right : 0;
}

/** Move the row above item cards. Horizontal fit is handled by the caller. */
function liftClear(top: number, height: number, boxes: readonly AugmentStripRect[]): number {
  let next = top;
  for (let pass = 0; pass < boxes.length + 1; pass++) {
    const blocker = boxes.find(box => next < box.bottom && next + height > box.top);
    if (!blocker) return next;
    next = blocker.top - GAP - height;
  }
  return next;
}

/** Push a 3D row off the trait rail, item cards and shop without adding a fixed pixel bias. */
function clearObstacles(left: number, top: number, width: number, height: number, boxes: readonly AugmentStripRect[]): { left: number; top: number } {
  let x = left, y = top;
  for (const box of boxes) {
    if (!overlaps(x, y, width, height, box)) continue;
    const toRight = box.right + GAP - x;
    const up = y + height - (box.top - GAP);
    if (toRight < up) x += toRight;
    else y -= up;
  }
  return { left: x, top: y };
}

/**
 * Viewport position of the owned-augment row.
 * 2D: right edge on the board's left edge, vertically near the top fifth, shrunk to the measured gap
 * so the row stays out of the left column, the board, the shop and item cards.
 * 3D: centre on the S13 screenshot anchor (26.7% × 23.8%). The element is mounted on `document.body`,
 * so these are viewport coordinates, not offsets inside `#board-frame`.
 */
export function augmentStripLayout(input: AugmentStripLayoutInput): AugmentStripLayout {
  const count = Math.max(0, input.count);
  const size0 = naturalSize(input.viewportWidth);
  if (input.threeD) {
    const width = rowWidth(count, size0), height = size0;
    const cleared = clearObstacles(
      input.viewportWidth * 0.267 - width / 2,
      input.viewportHeight * 0.238 - height / 2,
      width, height,
      [input.rail, input.shop, ...input.items].filter((box): box is AugmentStripRect => !!box && box.width > 0 && box.height > 0),
    );
    return { left: cleared.left, top: cleared.top, size: size0 };
  }
  const limit = railRight(input.rail, input.board);
  const available = Math.max(0, input.board.left - GAP - (limit + GAP));
  let size = size0;
  if (count > 0 && rowWidth(count, size) > available) size = Math.floor((available - Math.max(0, count - 1) * ICON_GAP) / count);
  if (!Number.isFinite(size) || size < 1) size = 1;
  const width = rowWidth(count, size), height = size;
  let top = input.board.top + input.board.height * 0.2 - height / 2;
  const itemBoxes = input.items.filter(box => box.right > limit && box.left < input.board.left);
  top = liftClear(top, height, itemBoxes);
  if (input.shop && input.shop.height > 0 && top + height > input.shop.top - GAP) top = input.shop.top - GAP - height;
  if (top < GAP) top = GAP;
  return { left: input.board.left - GAP - width, top, size };
}

function readRect(id: string): AugmentStripRect | null {
  const node = document.getElementById(id);
  if (!node) return null;
  const box = node.getBoundingClientRect();
  return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
}

/** Measure the live board and write viewport `left`/`top` onto the row. Idempotent for the same geometry. */
export function placeAugmentStrip(strip: HTMLElement): void {
  const count = strip.childElementCount;
  if (!count) { delete strip.dataset.placed; delete strip.dataset.anchor; return; }
  const board = readRect('board-root');
  if (!board || board.width < 1 || board.height < 1) return;
  const items = Array.from(document.querySelectorAll('#item-dock .item-card, #item-dock .consumable-card')).map(node => {
    const box = node.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
  });
  const layout = augmentStripLayout({
    viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, board,
    rail: readRect('panels-root'), shop: readRect('shop-dock'), items,
    threeD: Boolean(document.body.querySelector(':scope > .render3d-layer')), count,
  });
  const anchor = `${Math.round(layout.left)},${Math.round(layout.top)},${layout.size}`;
  if (strip.dataset.anchor === anchor && strip.dataset.placed === 'true') return;
  strip.style.setProperty('--augment-size', `${layout.size}px`);
  strip.style.left = `${Math.round(layout.left)}px`;
  strip.style.top = `${Math.round(layout.top)}px`;
  strip.dataset.anchor = anchor;
  strip.dataset.placed = 'true';
}

/** Follow board, column and viewport changes. Returns a disposer. */
export function bindAugmentStrip(strip: HTMLElement): () => void {
  const update = () => placeAugmentStrip(strip);
  const observer = new ResizeObserver(update);
  for (const id of ['board-root', 'app', 'panels-root', 'shop-dock', 'item-dock']) {
    const node = document.getElementById(id);
    if (node) observer.observe(node);
  }
  observer.observe(strip);
  window.addEventListener('resize', update);
  update();
  return () => { observer.disconnect(); window.removeEventListener('resize', update); };
}
