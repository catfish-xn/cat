/**
 * The little legend this browser picked (planning/3d/tft-parity-carousel-scout-ui-2026-10-21.md A3/A4): kept in
 * localStorage, sent with `join`, cosmetic only. The picker itself lives in the 3D chunk (three-mode/legend-picker.ts).
 */
import { ROOM_DEFAULT_LEGEND, ROOM_LITTLE_LEGENDS, type LittleLegendId } from '../server/protocol';

const KEY = 'hex-little-legend';
export const isLittleLegend = (value: unknown): value is LittleLegendId => (ROOM_LITTLE_LEGENDS as readonly unknown[]).includes(value);

export function readLegendChoice(): LittleLegendId {
  try { const value = localStorage.getItem(KEY); return isLittleLegend(value) ? value : ROOM_DEFAULT_LEGEND; } catch { return ROOM_DEFAULT_LEGEND; }
}
export function writeLegendChoice(id: LittleLegendId): void {
  try { localStorage.setItem(KEY, id); } catch { /* storage unavailable: this page keeps the default */ }
}
