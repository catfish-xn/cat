import { appliedStatusFloat } from '../presentation/combat-status';
import { asDisplayEvents, type SceneCombatEvent } from '../presentation/combat-display';
export interface FeedbackAnchor { readonly x: number; readonly y: number; readonly radius: number }
/** A centred rect in the same CSS coordinates as anchors (e.g. a canvas text label) that floats must not cover. */
export interface FeedbackObstacle { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface CombatFeedbackRenderer { push(events: readonly SceneCombatEvent[], displayTimeMs: number): void; render(displayTimeMs: number, anchors: ReadonlyMap<string, FeedbackAnchor>, obstacles?: readonly FeedbackObstacle[]): void; reset(): void; dispose(): void }
type FloatKind = 'physical' | 'magic' | 'true' | 'heal' | 'status';
/** What a float shows (the damage-float table, Fable 11-17): a plain hit, a crit, or a damage-over-time tick. */
type FloatClass = 'plain' | 'crit' | 'tick';
type LabelStyle = 'color' | 'fontSize' | 'fontWeight' | 'textShadow' | 'backgroundImage' | 'paddingLeft' | 'left' | 'top' | 'transform' | 'opacity';
interface Label { label: HTMLSpanElement; styles: Partial<Record<LabelStyle, string>> }
interface Float extends Label { key: string; unitId: string; kind: FloatKind; cls: FloatClass; amount: number; text: string; at: number; measured: number; life: number; px: number }
/** Remember requested CSS values: CSSOM can round fractional px when reading them back. */
function style(item: Label, key: LabelStyle, value: string): void {
  if ((item.styles[key] ?? item.label.style[key]) !== value) item.label.style[key] = value;
  item.styles[key] = value;
}
function hidden(label: HTMLSpanElement, value: boolean): void { if (label.hidden !== value) label.hidden = value; }
/**
 * The damage-float table (Library 伤害飘字分类表, Fable 11-17). Numbers only, told apart by colour: physical orange, magic
 * cyan-blue, true damage white and bolder, heals green with "+". A crit is a larger, more saturated number with a crack
 * badge drawn here (no original artwork); a damage-over-time tick is a small number. Sizes and colours are fitted to footage.
 */
const COLORS: Readonly<Record<FloatKind, string>> = { physical: '#ffc58f', magic: '#5fd3ff', true: '#ffffff', heal: '#78efab', status: '#ff9d8a' };
/** A crit's colour: physical as the original's saturated orange, or the gold alternative the user named; magic a bright blue. */
const CRIT_COLORS = { physical: { orange: '#ff8c1a', gold: '#ffd23f' }, magic: '#2fa8ff', true: '#ffffff' } as const;
/** A burn's tick is white whatever its damage type. */
const BURN_COLOR = '#ffffff';
const FONT_PX = 14, CRIT_SCALE = 2.4, TICK_SCALE = 0.8;
/** A new number pops at POP_SCALE where the hit lands and settles to its size over POP_MS while it rises. */
const POP_SCALE = 1.5, POP_MS = 300;
const LIFE_MS: Readonly<Record<FloatClass, number>> = { plain: 850, crit: 1000, tick: 650 };
const PER_UNIT = 5, ALL = 40;
const OUTLINE = '1px 0 0 #000, -1px 0 0 #000, 0 1px 0 #000, 0 -1px 0 #000, 0 1px 3px #000';
/** The gold crit's inner highlight: a light edge above the glyphs inside the black outline. */
const GOLD_OUTLINE = `0 -1px 0 #fff3c4, ${OUTLINE}`;
/** The crack badge left of a crit (drawn here: a split star with three rays), tinted with the number's colour. */
const badge = (color: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 1l2.6 6.2L21 5l-3.6 5.6L23 13l-6.2 1.4L19 21l-5.8-3.6L12 23l-1.6-5.4L4 21l2.6-6.6L1 13l5.6-2.4L3 5l6.6 2.4z' fill='${color}' stroke='#000' stroke-width='1.2'/><path d='M12 6l-1 5 3 1-2 6' fill='none' stroke='#000' stroke-width='1.4'/></svg>`)}")`;
export interface FeedbackOptions {
  /** Which physical crit colour to draw: the original's orange (default) or the gold alternative, both kept for the user to choose. */
  readonly physicalCrit?: 'orange' | 'gold';
}
/** Decorative DOM layer only. Caller supplies CSS coordinates and drives the sole frame loop. */
export function createCombatFeedbackRenderer(host: HTMLElement, options: FeedbackOptions = {}): CombatFeedbackRenderer {
  const root = document.createElement('div'); root.className = 'm6-combat-feedback'; root.setAttribute('aria-hidden', 'true');
  Object.assign(root.style, { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none' }); host.append(root);
  let floats: Float[] = [], disposed = false;
  const gold = options.physicalCrit === 'gold';
  // Detached nodes do not change the active DOM/order or keep expired text on the board. At most ALL are retained.
  const pool: Label[] = [];
  function release(item: Label): void { item.label.remove(); pool.push({ label: item.label, styles: item.styles }); }
  function reset(): void { for (const item of floats) release(item); floats = []; }
  const look = (kind: FloatKind, cls: FloatClass, burn: boolean) => {
    const color = cls === 'crit' ? (kind === 'physical' ? CRIT_COLORS.physical[gold ? 'gold' : 'orange'] : kind === 'magic' ? CRIT_COLORS.magic : kind === 'true' ? CRIT_COLORS.true : COLORS[kind])
      : cls === 'tick' && burn ? BURN_COLOR : COLORS[kind];
    const px = Math.round(FONT_PX * (cls === 'crit' ? CRIT_SCALE : cls === 'tick' ? TICK_SCALE : 1));
    return { color, px, fontWeight: kind === 'true' || cls === 'crit' ? '900' : '700',
      textShadow: cls === 'crit' && kind === 'physical' && gold ? GOLD_OUTLINE : OUTLINE,
      backgroundImage: cls === 'crit' ? badge(color) : '', paddingLeft: cls === 'crit' ? `${Math.round(px * 0.9)}px` : '' };
  };
  function acquire(l: ReturnType<typeof look>): Label {
    let item = pool.pop();
    if (!item) {
      const label = document.createElement('span');
      Object.assign(label.style, { position: 'absolute', fontSize: `${l.px}px`, fontWeight: l.fontWeight, whiteSpace: 'nowrap', textShadow: l.textShadow, color: l.color, pointerEvents: 'none',
        backgroundImage: l.backgroundImage, backgroundRepeat: 'no-repeat', backgroundPosition: 'left center', backgroundSize: '0.9em 0.9em', paddingLeft: l.paddingLeft });
      item = { label, styles: { color: l.color } };
    } else {
      // Match a fresh label even if it has no anchor, or cannot be placed on its first frame.
      if (item.label.textContent !== '') item.label.textContent = '';
      hidden(item.label, false);
      for (const key of ['left', 'top', 'transform', 'opacity'] as const) style(item, key, '');
      style(item, 'color', l.color); style(item, 'fontSize', `${l.px}px`); style(item, 'fontWeight', l.fontWeight); style(item, 'textShadow', l.textShadow);
      style(item, 'backgroundImage', l.backgroundImage); style(item, 'paddingLeft', l.paddingLeft);
    }
    root.append(item.label); return item;
  }
  /**
   * Every hit shows on its own (the original merges nothing); only the packets of one hit (one tick, source, target, kind and
   * class) add up to one number. A unit keeps PER_UNIT at once and the board ALL; the earliest plain number gives way first.
   */
  function add(tick: number, unitId: string, kind: FloatKind, amount: number, at: number, text = '', cls: FloatClass = 'plain', source = '', burn = false): void {
    if (amount <= 0) return;
    const key = `${tick}/${unitId}/${kind}${text}/${cls}/${source}`;
    const old = floats.find(item => item.key === key);
    if (old) { if (kind !== 'status') old.amount += amount; return; }
    const perUnit = floats.filter(item => item.unitId === unitId);
    if (perUnit.length >= PER_UNIT) { const first = perUnit.find(item => item.cls !== 'crit') ?? perUnit[0]; release(first); floats = floats.filter(item => item !== first); }
    while (floats.length >= ALL) release(floats.shift()!);
    const l = look(kind, cls, burn);
    floats.push({ ...acquire(l), key, unitId, kind, cls, amount, text, at, measured: Number.NaN, life: LIFE_MS[cls], px: l.px });
  }
  return {
    push(events, at) {
      if (disposed) return;
      // Local ledger and §14.2 wire events read through the same display whitelist (event-carried numbers only).
      for (const event of asDisplayEvents(events)) {
        // Absorbed damage shows on the bar's shield segment, not as a number (the original shows none).
        if (event.type === 'packetDamage') {
          const tick = event.delivery === 'ability-periodic' || event.delivery === 'item-burn';
          add(event.tick, event.targetId, event.damageType, event.hpDamage, at, '', event.critical ? 'crit' : tick ? 'tick' : 'plain', event.sourceId, event.delivery === 'item-burn');
        }
        else if (event.type === 'heal') add(event.tick, event.targetId, 'heal', event.actual, at);
        else { const status = appliedStatusFloat(event); if (status && event.type === 'statusChanged') add(event.tick, event.targetId, 'status', 1, at, status); }
      }
    },
    render(now, anchors, obstacles = []) {
      if (disposed) return;
      // Drop expired nodes only after this frame's geometry reads, so a removal cannot force layout before them.
      const expired: Float[] = [], active: Float[] = [];
      for (const item of floats) (now - item.at >= item.life ? expired : active).push(item);
      floats = active;
      // Text and visibility writes finish before any geometry read. A label whose text did not change
      // keeps its measured half-width, so a steady frame reads the container once and then only writes positions.
      const visible: { item: Float; anchor: FeedbackAnchor }[] = [];
      for (const item of floats) {
        const anchor = anchors.get(item.unitId); hidden(item.label, !anchor); if (!anchor) continue;
        const text = item.kind === 'status' ? item.text : `${item.kind === 'heal' ? '+' : ''}${item.amount}`;
        if (item.label.textContent !== text) { item.label.textContent = text; item.measured = Number.NaN; }
        visible.push({ item, anchor });
      }
      if (!visible.length) { for (const item of expired) release(item); return; }
      const width = root.clientWidth, height = root.clientHeight;
      const measured = visible.map(({ item, anchor }) => {
        if (Number.isNaN(item.measured)) item.measured = Math.max(20, item.label.offsetWidth / 2);
        return { item, anchor, half: item.measured };
      });
      for (const item of expired) release(item);
      const lanes = new Map<string, number>();
      const occupied: { x: number; y: number; half: number; px: number }[] = [];
      const points = [...anchors.values()];
      for (const { item, anchor, half } of measured) {
        // Older numbers stack above newer ones, each lane as tall as its number.
        const lane = lanes.get(item.unitId) ?? 0; lanes.set(item.unitId, lane + item.px + 3);
        const age = Math.max(0, now - item.at);
        const x = Math.max(half, Math.min(width - half, anchor.x));
        let y = Math.max(16, Math.min(height - 16, anchor.y - anchor.radius - 22 - lane - age / 70));
        let placed = false;
        for (let attempt = 0; attempt < 7; attempt++) {
          const candidate = y - attempt * (item.px + 7);
          if (candidate < 12) break;
          const overlapsFloat = occupied.some(rect => Math.abs(rect.x - x) < rect.half + half + 3 && Math.abs(rect.y - candidate) < (rect.px + item.px) / 2 + 7);
          const overlapsPiece = points.some(point => Math.abs(point.x - x) < point.radius + half && Math.abs(point.y - candidate) < point.radius + 10);
          const overlapsLabel = obstacles.some(rect => Math.abs(rect.x - x) < rect.w / 2 + half + 2 && Math.abs(rect.y - candidate) < rect.h / 2 + 12);
          if (!overlapsFloat && !overlapsPiece && !overlapsLabel) { y = candidate; placed = true; occupied.push({ x, y, half, px: item.px }); break; }
        }
        hidden(item.label, !placed); if (!placed) continue;
        // A new number pops where the hit lands and settles over POP_MS.
        const pop = age < POP_MS ? POP_SCALE - (POP_SCALE - 1) * (age / POP_MS) : 1;
        style(item, 'left', `${x}px`); style(item, 'top', `${y}px`); style(item, 'transform', pop === 1 ? 'translate(-50%, -50%)' : `translate(-50%, -50%) scale(${pop.toFixed(3)})`);
        style(item, 'opacity', String(Math.min(1, (item.life - age) / 250)));
      }
    },
    reset,
    dispose() { disposed = true; reset(); pool.length = 0; root.remove(); },
  };
}
