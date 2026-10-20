/**
 * I3: current statuses as small code-drawn icons above a piece (stun star, burn flame, shield...), replacing the
 * glyph strip. Reads the same rows as the panels (readUnitStatusRows) and the displayed shield value; decides
 * nothing. Shapes are plain paths in a unit box so the live board (Phaser Graphics) and the replay canvas draw
 * the same icon. No bitmaps.
 */
import type { CombatState } from '../simulation/combat-types';
import type { CombatActivity, StatusKind } from '../simulation/m8/contracts';
import type { DisplayUnit } from './combat-display';
import { readUnitStatusRows } from './combat-status';
import { THEME, toNumber } from './theme';

export type StatusIconKind = StatusKind | CombatActivity['kind'] | 'shield';
export interface StatusIcon { readonly kind: StatusIconKind; readonly harmful: boolean; readonly badge: string }

/** Icons per piece; harmful first, the rest are still listed in the unit panel. */
export const STATUS_ICON_MAX = 6;
export const STATUS_ICON_RADIUS = 6.5;
const STEP = 14;
/** Centre line of the row, piece-relative: just above the HP bar. */
export const STATUS_ICON_Y = -53;
/** Fallback under the worn-item row, for pieces too close to the canvas top (row 0) to fit the row above. */
const STATUS_ICON_Y_BELOW = 49;
/** Piece-relative row centre for a piece whose centre is at canvas y `pieceY`. */
export const statusIconY = (pieceY: number): number => pieceY + STATUS_ICON_Y - STATUS_ICON_RADIUS < 1 ? STATUS_ICON_Y_BELOW : STATUS_ICON_Y;

/** Statuses in effect now (pending/suppressed contributions are skipped, as in the old strip) plus a shield icon. */
export function statusIcons(runtime: CombatState | null, unit: DisplayUnit): StatusIcon[] {
  if (!unit.alive) return [];
  const harmful: StatusIcon[] = [], beneficial: StatusIcon[] = [], seen = new Set<string>();
  for (const row of runtime ? readUnitStatusRows(runtime, unit.id) : []) {
    if (row.state === 'pending' || row.state === 'suppressed') continue;
    const key = `${row.harmful}:${row.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (row.harmful ? harmful : beneficial).push({ kind: row.kind, harmful: row.harmful, badge: row.badge });
  }
  if (unit.shield > 0) beneficial.push({ kind: 'shield', harmful: false, badge: '' });
  return [...harmful, ...beneficial].slice(0, STATUS_ICON_MAX);
}

/** Minimal drawing surface both backends implement. Points are flat [x0, y0, x1, y1, ...]. */
export interface IconPen {
  path(points: readonly number[], closed: boolean, fill: number | null, stroke: number | null, width: number): void;
  circle(x: number, y: number, r: number, fill: number | null, stroke: number | null, width: number): void;
}

type Shape =
  | { readonly path: readonly number[]; readonly closed?: boolean; readonly fill?: number; readonly stroke?: number; readonly width?: number }
  | { readonly circle: readonly [number, number, number]; readonly fill?: number; readonly stroke?: number; readonly width?: number };

const SHIELD = [-0.72, -0.78, 0.72, -0.78, 0.72, 0.05, 0, 0.9, -0.72, 0.05];
const CRACK = [0.05, -0.78, -0.2, -0.2, 0.15, 0.1, -0.05, 0.6];
const STAR = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 0.42 : 0.95, a = -Math.PI / 2 + (i * Math.PI) / 5;
  return [r * Math.cos(a), r * Math.sin(a)];
}).flat();
const ARROW_UP = [0, -0.85, 0.75, 0, 0.28, 0, 0.28, 0.8, -0.28, 0.8, -0.28, 0, -0.75, 0];
const ARROW_DOWN = ARROW_UP.map((value, index) => (index % 2 ? -value : value));
const DARK = 0x0b151f;

const ICONS: Readonly<Record<StatusIconKind, readonly Shape[]>> = {
  burn: [
    { path: [0, -0.95, 0.55, -0.15, 0.55, 0.4, 0, 0.85, -0.55, 0.4, -0.55, -0.15, -0.18, -0.45], closed: true, fill: 0xff7a2e },
    { path: [0, -0.2, 0.25, 0.25, 0, 0.6, -0.25, 0.25], closed: true, fill: 0xffd84d },
  ],
  wound: [
    { path: [-0.22, -0.75, 0.22, -0.75, 0.22, -0.22, 0.75, -0.22, 0.75, 0.22, 0.22, 0.22, 0.22, 0.75, -0.22, 0.75, -0.22, 0.22, -0.75, 0.22, -0.75, -0.22, -0.22, -0.22], closed: true, fill: 0x6be38a },
    { path: [-0.8, 0.8, 0.8, -0.8], stroke: 0xff4d4d, width: 0.32 },
  ],
  sunder: [{ path: SHIELD, closed: true, fill: 0xd08a3a }, { path: CRACK, stroke: DARK, width: 0.2 }],
  shred: [{ path: SHIELD, closed: true, fill: 0xa77de8 }, { path: CRACK, stroke: DARK, width: 0.2 }],
  stun: [{ path: STAR, closed: true, fill: 0xffd84d }],
  'control-immunity': [{ path: SHIELD, closed: true, fill: 0xffe39b }, { path: [-0.35, -0.05, -0.05, 0.3, 0.4, -0.4], stroke: DARK, width: 0.22 }],
  untargetable: [{ circle: [0, 0, 0.62], stroke: 0xd4dcff, width: 0.24 }, { path: [-0.75, 0.75, 0.75, -0.75], stroke: 0xd4dcff, width: 0.24 }],
  'damage-prevention': [{ path: [0, -0.9, 0.7, 0, 0, 0.9, -0.7, 0], closed: true, fill: 0xf3f6ff }],
  'stat-buff': [{ path: ARROW_UP, closed: true, fill: 0x6be38a }],
  'stat-debuff': [{ path: ARROW_DOWN, closed: true, fill: 0xff6b6b }],
  'damage-reduction': [{ path: SHIELD, closed: true, fill: 0x7fb2e6 }],
  channel: [{ circle: [0, 0, 0.68], stroke: 0xc5a0ff, width: 0.22 }, { circle: [0, 0, 0.26], fill: 0xc5a0ff }],
  redirect: [{ circle: [-0.38, 0, 0.36], stroke: 0x68ddd0, width: 0.22 }, { circle: [0.38, 0, 0.36], stroke: 0x68ddd0, width: 0.22 }],
  shield: [{ path: SHIELD, closed: true, fill: toNumber(THEME.color.shield) }],
};

/** One centred row at piece-relative (x, y): a dark disc framed red (harmful) or teal, the shape inside. */
export function drawStatusIcons(pen: IconPen, icons: readonly StatusIcon[], x: number, y: number): void {
  const r = STATUS_ICON_RADIUS, scale = r * 0.62, left = x - ((icons.length - 1) * STEP) / 2;
  icons.forEach((icon, index) => {
    const cx = left + index * STEP;
    pen.circle(cx, y, r, DARK, icon.harmful ? 0xff6b6b : 0x68ddd0, 1.5);
    for (const shape of ICONS[icon.kind]) {
      const width = (shape.width ?? 0) * scale;
      if ('circle' in shape) {
        const [px, py, pr] = shape.circle;
        pen.circle(cx + px * scale, y + py * scale, pr * scale, shape.fill ?? null, shape.stroke ?? null, width);
      } else {
        pen.path(shape.path.map((value, i) => (i % 2 ? y : cx) + value * scale), shape.closed ?? false, shape.fill ?? null, shape.stroke ?? null, width);
      }
    }
  });
}

/** Canvas 2D backend (replay canvas). */
export function canvasPen(ctx: CanvasRenderingContext2D): IconPen {
  const css = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
  const finish = (fill: number | null, stroke: number | null, width: number) => {
    if (fill !== null) { ctx.fillStyle = css(fill); ctx.fill(); }
    if (stroke !== null) { ctx.strokeStyle = css(stroke); ctx.lineWidth = width; ctx.stroke(); }
  };
  return {
    path(points, closed, fill, stroke, width) {
      ctx.beginPath(); ctx.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
      if (closed) ctx.closePath();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; finish(fill, stroke, width);
    },
    circle(x, y, r, fill, stroke, width) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); finish(fill, stroke, width); },
  };
}
