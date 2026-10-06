/** Board-only logical geometry. CSS/FIT bounds, not these numbers, determine touch size. */
export const BOARD_LAYOUT = Object.freeze({ width: 480, height: 520, hexRadius: 34, origin: Object.freeze({ x: 35, y: 40 }), tokenRadius: 27,
  benchY: 480, benchStartX: 27, benchStepX: 53.25 });
export function boardLayoutMetrics(cssWidth: number, cssHeight: number) {
  const scale = Math.min(cssWidth / BOARD_LAYOUT.width, cssHeight / BOARD_LAYOUT.height);
  return { width: BOARD_LAYOUT.width * scale, height: BOARD_LAYOUT.height * scale, pieceDiameterCSS: BOARD_LAYOUT.tokenRadius * 2 * scale };
}
