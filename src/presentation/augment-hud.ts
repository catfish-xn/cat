import './augment-hud.css';

/** Integration rail: src/style.css 44px hit targets and 4px gap. Not a shrunk viewport row. */
export const AUGMENT_CHIP_SIZE = 44;
export const AUGMENT_CHIP_GAP = 4;

export interface AugmentStripLayoutInput {
  readonly count: number;
  /** True for the 3D portrait rail (style.css max-width 92px, two columns). */
  readonly narrow: boolean;
}

export interface AugmentStripLayout {
  readonly size: number;
  readonly gap: number;
  readonly columns: number;
  readonly width: number;
  readonly height: number;
}

/** Row box of the in-flow rail above traits. Never shrinks below the 44px control size. */
export function augmentStripLayout(input: AugmentStripLayoutInput): AugmentStripLayout {
  const count = Math.max(0, Math.floor(input.count));
  const columns = count === 0 ? 0 : input.narrow ? Math.min(count, 2) : count;
  const rows = columns === 0 ? 0 : Math.ceil(count / columns);
  const size = AUGMENT_CHIP_SIZE;
  const gap = AUGMENT_CHIP_GAP;
  const width = columns === 0 ? 0 : columns * size + (columns - 1) * gap;
  const height = rows === 0 ? 0 : rows * size + (rows - 1) * gap;
  return { size, gap, columns, width, height };
}

/**
 * Marks the row as placed without writing left, top, or --augment-size.
 * Those viewport writes assumed a size below 44px; min-width then made the real row cross the board.
 */
export function placeAugmentStrip(strip: HTMLElement): void {
  if (!strip.childElementCount) { delete strip.dataset.placed; return; }
  strip.dataset.placed = 'rail';
}

/** One resize observer and one window listener. Geometry stays with the rail CSS. */
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
