import { appliedStatusFloat } from '../presentation/combat-status';
import { asDisplayEvents, type SceneCombatEvent } from '../presentation/combat-display';
export interface FeedbackAnchor { readonly x: number; readonly y: number; readonly radius: number }
/** A centred rect in the same CSS coordinates as anchors (e.g. a canvas text label) that floats must not cover. */
export interface FeedbackObstacle { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface CombatFeedbackRenderer { push(events: readonly SceneCombatEvent[], displayTimeMs: number): void; render(displayTimeMs: number, anchors: ReadonlyMap<string, FeedbackAnchor>, obstacles?: readonly FeedbackObstacle[], bars?: ReadonlyMap<string, FeedbackObstacle>): void; reset(): void; dispose(): void }
type FloatKind = 'physical' | 'magic' | 'true' | 'heal' | 'status';
/** What a float shows (the damage-float table, Fable 11-17): a plain hit, a crit, or a damage-over-time tick. */
type FloatClass = 'plain' | 'crit' | 'tick';
type LabelStyle = 'color' | 'fontSize' | 'fontWeight' | 'fontFamily' | 'textShadow' | 'backgroundImage' | 'paddingLeft' | 'left' | 'top' | 'transform' | 'opacity';
interface Label { label: HTMLSpanElement; styles: Partial<Record<LabelStyle, string>> }
interface Float extends Label { key: string; unitId: string; kind: FloatKind; cls: FloatClass; amount: number; text: string; at: number; measured: number; life: number; px: number }
/** Remember requested CSS values: CSSOM can round fractional px when reading them back. */
function style(item: Label, key: LabelStyle, value: string): void {
  if ((item.styles[key] ?? item.label.style[key]) !== value) item.label.style[key] = value;
  item.styles[key] = value;
}
function hidden(label: HTMLSpanElement, value: boolean): void { if (label.hidden !== value) label.hidden = value; }
/**
 * Damage floats (the user's 8 points, 11-19). Numbers only, coloured by damage type: physical orange, magic cyan-blue, true
 * damage white, heals green with "+"; a basic attack takes its type's colour too. A crit is the same colour, CRIT_SCALE larger,
 * with a same-coloured spiky mark on its left; a damage-over-time tick is a little smaller (a burn white). Every colour, size,
 * scale and timing here is our own choice, not original data.
 */
const COLORS: Readonly<Record<FloatKind, string>> = { physical: '#ff9a2e', magic: '#4fd0ff', true: '#ffffff', heal: '#6ee89a', status: '#ff9d8a' };
/** A burn's tick is white whatever its damage type. */
const BURN_COLOR = '#ffffff';
/** Sizes (own choice, not original): a plain number reads on both a close-up and the whole board; a crit 1.6× it, a tick 0.8×. */
const FONT_PX = 22, CRIT_SCALE = 1.6, TICK_SCALE = 0.8;
/** A bold rounded sans-serif from the system (no font file is shipped), never a serif face. */
const FONT_FAMILY = '"Arial Rounded MT Bold", "Nunito", "Varela Round", "Trebuchet MS", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
/** A thin dark edge and a light drop shadow. */
const OUTLINE = '1px 0 0 rgba(0,0,0,.85), -1px 0 0 rgba(0,0,0,.85), 0 1px 0 rgba(0,0,0,.85), 0 -1px 0 rgba(0,0,0,.85), 0 2px 3px rgba(0,0,0,.55)';
/**
 * The motion (own rhythm, not original): a number pops in at POP_SCALE and drops back to its size over POP_MS, then rises
 * RISE_PX over the rest of its life and fades out over its last FADE_MS.
 */
const POP_SCALE = 1.6, POP_MS = 160, RISE_PX = 28, FADE_MS = 300;
const LIFE_MS: Readonly<Record<FloatClass, number>> = { plain: 900, crit: 1100, tick: 700 };
const PER_UNIT = 6, ALL = 40;
/** Where a number appears: on its unit's body, chest to waist, BODY_DROP radii below the anchor (own fit). */
const BODY_DROP = 0.35;
/**
 * A unit's numbers at once: the newest on its body, each older one pushed up above the one after it, STACK_SHRINK smaller and
 * STACK_FADE fainter per place; at most SHOWN, and a newer one makes the earliest past that fade out within EARLY_FADE_MS.
 */
const SHOWN = 4, STACK_SHRINK = 0.15, STACK_FADE = 0.25, STACK_GAP = 6, EARLY_FADE_MS = 200;
/**
 * Overhead bars (own rule, not original): a number above BAR_OPACITY never covers any unit's bar. It starts at least half its
 * height below its own unit's bar (a short unit's body point moves down), rises no closer than that, and one pushed into a
 * bar by the stack or standing over another unit's bar shows at BAR_OPACITY at most.
 */
const BAR_OPACITY = 0.5;
/** The crit mark left of a crit: a spiky burst in the number's own colour with a thin darker edge (drawn here). */
const badge = (color: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 1l1.9 6.3L19.8 4.2l-2.6 6.1L23 12l-5.8 1.7 2.6 6.1-5.9-3.1L12 23l-1.9-6.3-5.9 3.1 2.6-6.1L1 12l5.8-1.7L4.2 4.2l5.9 3.1z' fill='${color}' stroke='rgba(0,0,0,.6)' stroke-width='0.8' stroke-linejoin='round'/></svg>`)}")`;
/** Decorative DOM layer only. Caller supplies CSS coordinates and drives the sole frame loop. */
export function createCombatFeedbackRenderer(host: HTMLElement): CombatFeedbackRenderer {
  const root = document.createElement('div'); root.className = 'm6-combat-feedback'; root.setAttribute('aria-hidden', 'true');
  Object.assign(root.style, { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none' }); host.append(root);
  let floats: Float[] = [], disposed = false;
  // Detached nodes do not change the active DOM/order or keep expired text on the board. At most ALL are retained.
  const pool: Label[] = [];
  function release(item: Label): void { item.label.remove(); pool.push({ label: item.label, styles: item.styles }); }
  function reset(): void { for (const item of floats) release(item); floats = []; }
  const look = (kind: FloatKind, cls: FloatClass, burn: boolean) => {
    const color = cls === 'tick' && burn ? BURN_COLOR : COLORS[kind];
    const px = Math.round(FONT_PX * (cls === 'crit' ? CRIT_SCALE : cls === 'tick' ? TICK_SCALE : 1));
    return { color, px, fontWeight: cls === 'crit' ? '900' : '800', textShadow: OUTLINE,
      backgroundImage: cls === 'crit' ? badge(color) : '', paddingLeft: cls === 'crit' ? `${Math.round(px * 0.8)}px` : '' };
  };
  function acquire(l: ReturnType<typeof look>): Label {
    let item = pool.pop();
    if (!item) {
      const label = document.createElement('span');
      Object.assign(label.style, { position: 'absolute', fontSize: `${l.px}px`, fontWeight: l.fontWeight, fontFamily: FONT_FAMILY, whiteSpace: 'nowrap', textShadow: l.textShadow, color: l.color, pointerEvents: 'none',
        backgroundImage: l.backgroundImage, backgroundRepeat: 'no-repeat', backgroundPosition: 'left center', backgroundSize: '0.75em 0.75em', paddingLeft: l.paddingLeft });
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
   * Every hit shows on its own; only the packets of one hit (one tick, source, target, kind and
   * class) add up to one number. A unit keeps PER_UNIT at once and the board ALL; the earliest plain number gives way first.
   */
  function add(tick: number, unitId: string, kind: FloatKind, amount: number, at: number, text = '', cls: FloatClass = 'plain', source = '', burn = false): void {
    if (amount <= 0) return;
    const key = `${tick}/${unitId}/${kind}${text}/${cls}/${source}`;
    const old = floats.find(item => item.key === key);
    if (old) { if (kind !== 'status') old.amount += amount; return; }
    const perUnit = floats.filter(item => item.unitId === unitId);
    // One number more than SHOWN on a unit: its earliest one fades out now.
    const showing = perUnit.filter(item => item.at + item.life > at);
    if (showing.length >= SHOWN) { const first = showing[0]; first.life = Math.min(first.life, Math.max(0, at - first.at) + EARLY_FADE_MS); }
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
        // Absorbed damage shows on the bar's shield segment, not as a number.
        if (event.type === 'packetDamage') {
          const tick = event.delivery === 'ability-periodic' || event.delivery === 'item-burn';
          add(event.tick, event.targetId, event.damageType, event.hpDamage, at, '', event.critical ? 'crit' : tick ? 'tick' : 'plain', event.sourceId, event.delivery === 'item-burn');
        }
        else if (event.type === 'heal') add(event.tick, event.targetId, 'heal', event.actual, at);
        else { const status = appliedStatusFloat(event); if (status && event.type === 'statusChanged') add(event.tick, event.targetId, 'status', 1, at, status); }
      }
    },
    render(now, anchors, obstacles = [], bars = new Map()) {
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
      // Per unit, newest first: the newest number on the body, each older one above the one after it.
      const byUnit = new Map<string, { item: Float; anchor: FeedbackAnchor; half: number }[]>();
      for (const entry of measured) { const list = byUnit.get(entry.item.unitId); if (list) list.unshift(entry); else byUnit.set(entry.item.unitId, [entry]); }
      for (const list of byUnit.values()) {
        let above = Infinity;
        list.forEach(({ item, anchor, half }, place) => {
          const age = Math.max(0, now - item.at);
          // Pop in, drop back, then rise; an older number also stays above the newer one below it (spaced by drawn sizes).
          const pop = age < POP_MS ? POP_SCALE - (POP_SCALE - 1) * (age / POP_MS) : 1;
          const shrink = Math.max(0.5, 1 - STACK_SHRINK * place), size = item.px * shrink * pop;
          const rise = age < POP_MS ? 0 : RISE_PX * Math.min(1, (age - POP_MS) / Math.max(1, item.life - POP_MS));
          // Its own bar: the number's top stays at least half its height below the bar's bottom (start and rise alike).
          const ownBar = bars.get(item.unitId), floor = ownBar ? ownBar.y + ownBar.h / 2 + size : -Infinity;
          const own = Math.max(anchor.y + anchor.radius * BODY_DROP - rise, floor);
          const y = Math.max(12 + size / 2, Math.min(height - 12, Math.min(own, above - size / 2 - STACK_GAP)));
          above = y - size / 2;
          // A canvas label in the way moves the number to the side, never up.
          let x = Math.max(half, Math.min(width - half, anchor.x));
          for (const dx of [0, half + 4, -half - 4]) {
            const cx = Math.max(half, Math.min(width - half, anchor.x + dx));
            if (!obstacles.some(rect => Math.abs(rect.x - cx) < rect.w / 2 + half + 2 && Math.abs(rect.y - y) < rect.h / 2 + size / 2)) { x = cx; break; }
          }
          const scale = pop * shrink;
          let fade = Math.max(0, Math.min(1, (item.life - age) / FADE_MS)) * Math.max(0.25, 1 - STACK_FADE * place);
          // Over any unit's bar (its own, pushed up by the stack, or another's) it shows at BAR_OPACITY at most.
          const w = half * scale;
          for (const bar of bars.values()) if (Math.abs(bar.x - x) < bar.w / 2 + w && Math.abs(bar.y - y) < bar.h / 2 + size / 2) { fade = Math.min(fade, BAR_OPACITY); break; }
          style(item, 'left', `${x}px`); style(item, 'top', `${y}px`);
          style(item, 'transform', scale === 1 ? 'translate(-50%, -50%)' : `translate(-50%, -50%) scale(${scale.toFixed(3)})`);
          style(item, 'opacity', String(Number(fade.toFixed(3))));
        });
      }
    },
    reset,
    dispose() { disposed = true; reset(); pool.length = 0; root.remove(); },
  };
}
