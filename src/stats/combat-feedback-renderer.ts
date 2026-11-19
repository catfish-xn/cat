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
interface Float extends Label { key: string; unitId: string; kind: FloatKind; cls: FloatClass; amount: number; text: string; at: number; measured: number; life: number; px: number; lastX: number }
/** Remember requested CSS values: CSSOM can round fractional px when reading them back. */
function style(item: Label, key: LabelStyle, value: string): void {
  if ((item.styles[key] ?? item.label.style[key]) !== value) item.label.style[key] = value;
  item.styles[key] = value;
}
function hidden(label: HTMLSpanElement, value: boolean): void { if (label.hidden !== value) label.hidden = value; }
/**
 * Damage floats (the user's 8 points, 11-19). Numbers only, coloured by damage type: physical orange, magic cyan-blue, true
 * damage white, heals green with "+"; a basic attack takes its type's colour too. A crit is the same colour, CRIT_SCALE larger,
 * with a slanted claw-tear mark on its left (CRIT_MARK); a damage-over-time tick is a little smaller (a burn white). Every colour, size,
 * scale and timing here is our own choice, not original data.
 */
const COLORS: Readonly<Record<FloatKind, string>> = { physical: '#ff8a24', magic: '#36c4ff', true: '#ffffff', heal: '#4fdc84', status: '#ff9d8a' };
/** A burn's tick is white whatever its damage type. */
const BURN_COLOR = '#ffffff';
/** Sizes (own choice, not original): a plain number reads on both a close-up and the whole board; a crit about 1.9× it (42 px), a tick 0.8×. */
const FONT_PX = 22, CRIT_SCALE = 1.9, TICK_SCALE = 0.8;
/** A bold rounded sans-serif from the system (no font file is shipped), never a serif face. */
const FONT_FAMILY = '"Arial Rounded MT Bold", "Nunito", "Varela Round", "Trebuchet MS", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
/** A dark edge all round (eight directions) and a drop shadow, so the number holds on a bright floor. */
const OUTLINE = '1px 0 0 rgba(0,0,0,.9), -1px 0 0 rgba(0,0,0,.9), 0 1px 0 rgba(0,0,0,.9), 0 -1px 0 rgba(0,0,0,.9), 1px 1px 0 rgba(0,0,0,.9), -1px 1px 0 rgba(0,0,0,.9), 1px -1px 0 rgba(0,0,0,.9), -1px -1px 0 rgba(0,0,0,.9), 0 2px 4px rgba(0,0,0,.6)';
/**
 * The motion (own rhythm, not original): a number pops in at POP_SCALE and drops back to its size over POP_MS, then rises
 * RISE_PX over the rest of its life; it stays fully opaque until its last FADE_MS and only then fades out.
 */
const POP_SCALE = 1.6, POP_MS = 160, RISE_PX = 28, FADE_MS = 300;
const LIFE_MS: Readonly<Record<FloatClass, number>> = { plain: 900, crit: 900, tick: 700 };
const PER_UNIT = 6, ALL = 40;
/** Where a number appears: on its unit's body, chest to waist, BODY_DROP radii below the anchor (own fit). */
const BODY_DROP = 0.35;
/**
 * A unit's numbers at once: the newest on its body, each older one pushed up above the one after it, STACK_SHRINK smaller and
 * STACK_FADE fainter per place; at most SHOWN, and a newer one makes the earliest past that fade out within EARLY_FADE_MS.
 */
const SHOWN = 4, STACK_SHRINK = 0.15, STACK_FADE = 0.1, STACK_GAP = 6, EARLY_FADE_MS = 200;
/**
 * Overhead bars (own rule, not original): a number never covers any unit's bar, by where it stands, never by fading. It starts
 * at least half its height below its own unit's bar (a short unit's body point moves down) and rises no closer than that; one
 * the stack pushes into a bar, or that would stand on another unit's bar, steps sideways out past that bar's end.
 */
const BAR_SIDESTEP_GAP = 3;
/** How many of the nearest bar-free spots a number tries for one also free of other units' numbers (own value). */
const NUMBER_TRIES = 4;
/**
 * The crit mark left of a crit (自绘，非原版素材), drawn here as a vector: a slanted claw tear (about 35°, pointed at both
 * ends, a few notches on its lower edge), solid, darker and redder than the number, with the number's dark edge, about
 * 0.8 of the digits' height, just left of the number.
 */
interface CritMark { readonly path: string; readonly viewBox: readonly [number, number, number, number] }
const CRIT_MARK: CritMark = { path: 'M0.5 19.5L6.3 12.5 12.9 8 23.5 3.5 20.4 9.7 17.2 8.9 16 12.7 12.8 11.9 11.6 15.7 8.4 14.9 6.6 17.8Z', viewBox: [-0.5, 2.5, 24.5, 17.5] };
/** The mark's height (em of the crit) and its gap to the digits; own values, not original. */
const MARK_EM = 0.6, MARK_GAP_EM = 0.04;
const channels = (color: string) => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
const hex = (values: number[]) => `#${values.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const tint = (color: string) => { const [r, g, b] = channels(color); return hex([r * 0.78 + 30, g * 0.62, b * 0.7]); };
const markWidthEm = (mark: CritMark) => MARK_EM * mark.viewBox[2] / mark.viewBox[3];
const badge = (color: string, mark: CritMark) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${mark.viewBox.join(' ')}'><path d='${mark.path}' fill='${tint(color)}' stroke='rgba(0,0,0,.9)' stroke-width='1.4'/></svg>`)}")`;
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
    return { color, px, fontWeight: '900', textShadow: OUTLINE,
      backgroundImage: cls === 'crit' ? badge(color, CRIT_MARK) : '', paddingLeft: cls === 'crit' ? `${Math.round(px * (markWidthEm(CRIT_MARK) + MARK_GAP_EM))}px` : '' };
  };
  function acquire(l: ReturnType<typeof look>): Label {
    let item = pool.pop();
    if (!item) {
      const label = document.createElement('span');
      Object.assign(label.style, { position: 'absolute', fontSize: `${l.px}px`, fontWeight: l.fontWeight, fontFamily: FONT_FAMILY, whiteSpace: 'nowrap', textShadow: l.textShadow, color: l.color, pointerEvents: 'none',
        backgroundImage: l.backgroundImage, backgroundRepeat: 'no-repeat', backgroundPosition: 'left center', backgroundSize: `auto ${MARK_EM}em`, paddingLeft: l.paddingLeft });
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
    floats.push({ ...acquire(l), key, unitId, kind, cls, amount, text, at, measured: Number.NaN, life: LIFE_MS[cls], px: l.px, lastX: Number.NaN });
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
      // Numbers placed so far this frame, so a later unit's number keeps clear of an earlier unit's.
      const placed: { unitId: string; rect: FeedbackObstacle }[] = [];
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
          const scale = pop * shrink, w = half * scale;
          // A canvas label or any unit's bar in the way: the number steps sideways (never up) to the nearest spot past an end
          // of one of them that no bar or label covers, so bars side by side are cleared together. Another unit's number
          // already placed is avoided the same way, over the NUMBER_TRIES nearest such spots; when none of those is free of
          // numbers too, it takes the nearest bar-free one and may overlap a number a little (never a bar). Once moved aside,
          // "nearest" is measured from where it stood last frame, so it does not hop across a pair of bars between frames.
          const fit = (at: number) => Math.max(w, Math.min(width - w, at));
          const inRow = (rect: FeedbackObstacle) => Math.abs(rect.y - y) < rect.h / 2 + size / 2;
          const hard = [...obstacles, ...bars.values()].filter(inRow);
          const soft = placed.filter(other => other.unitId !== item.unitId && inRow(other.rect)).map(other => other.rect);
          const free = (rects: readonly FeedbackObstacle[]) => (at: number) => !rects.some(rect => Math.abs(rect.x - at) < rect.w / 2 + w);
          const clearHard = free(hard), clearSoft = free(soft);
          let x = fit(anchor.x);
          if (!clearHard(x) || !clearSoft(x)) {
            const from = Number.isNaN(item.lastX) ? anchor.x : item.lastX;
            const spots = [x, ...[...hard, ...soft].flatMap(rect => [rect.x + rect.w / 2 + w + BAR_SIDESTEP_GAP, rect.x - rect.w / 2 - w - BAR_SIDESTEP_GAP]).map(fit)]
              .filter(clearHard).sort((a, b) => Math.abs(a - from) - Math.abs(b - from)).slice(0, NUMBER_TRIES);
            if (spots.length) x = spots.find(clearSoft) ?? spots[0]!;
          }
          placed.push({ unitId: item.unitId, rect: { x, y, w: 2 * w, h: size } });
          item.lastX = x;
          const fade = Math.max(0, Math.min(1, (item.life - age) / FADE_MS)) * Math.max(0.6, 1 - STACK_FADE * place);
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
