/** Top/bottom extent of a piece's drawing (HP bar above, cost badge below) relative to its centre. */
export const PIECE_EXTENT = Object.freeze({ top: 45, bottom: 30 });
/** Board-only logical geometry. CSS/FIT bounds, not these numbers, determine touch size. */
export const BOARD_LAYOUT = Object.freeze({ width: 480, height: 520, hexRadius: 34, origin: Object.freeze({ x: 35, y: 50 }), tokenRadius: 27,
  benchY: 480, benchStartX: 27, benchStepX: 53.25 });
export function boardLayoutMetrics(cssWidth: number, cssHeight: number) {
  const scale = Math.min(cssWidth / BOARD_LAYOUT.width, cssHeight / BOARD_LAYOUT.height);
  return { width: BOARD_LAYOUT.width * scale, height: BOARD_LAYOUT.height * scale, pieceDiameterCSS: BOARD_LAYOUT.tokenRadius * 2 * scale };
}
