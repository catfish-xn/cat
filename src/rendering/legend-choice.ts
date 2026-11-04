/**
 * The little legend this browser picked (planning/3d/tft-parity-carousel-scout-ui-2026-10-21.md A3/A4): kept in
 * localStorage, sent with `join`, cosmetic only. The picker itself lives in the 3D chunk (three-mode/legend-picker.ts).
 */
import { ROOM_LITTLE_LEGENDS, type LittleLegendId } from '../server/protocol';

const KEY = 'hex-little-legend';
/** Shown until the player picks one (羽翼骑士企鹅); an explicit 河灵 (`default`) pick is kept as is. */
export const UNSET_LEGEND: LittleLegendId = 'pengu';
export const isLittleLegend = (value: unknown): value is LittleLegendId => (ROOM_LITTLE_LEGENDS as readonly unknown[]).includes(value);

export function readLegendChoice(): LittleLegendId {
  try { const value = localStorage.getItem(KEY); return isLittleLegend(value) ? value : UNSET_LEGEND; } catch { return UNSET_LEGEND; }
}
export function writeLegendChoice(id: LittleLegendId): void {
  try { localStorage.setItem(KEY, id); } catch { /* storage unavailable: this page keeps the default */ }
}
