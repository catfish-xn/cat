import { asDisplayEvents, type SceneCombatEvent } from '../presentation/combat-display';
export interface FeedbackAnchor { readonly x: number; readonly y: number; readonly radius: number }
/** A centred rect in the same CSS coordinates as anchors (e.g. a canvas text label) that floats must not cover. */
export interface FeedbackObstacle { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface CombatFeedbackRenderer { push(events: readonly SceneCombatEvent[], displayTimeMs: number): void; render(displayTimeMs: number, anchors: ReadonlyMap<string, FeedbackAnchor>, obstacles?: readonly FeedbackObstacle[], bars?: ReadonlyMap<string, FeedbackObstacle>): void; reset(): void; dispose(): void }
type FloatKind = 'physical' | 'magic' | 'true' | 'heal';
/** What a float shows (the damage-float table, Fable 11-17): a plain hit, a crit, or a damage-over-time tick. */
type FloatClass = 'plain' | 'crit' | 'tick';
type LabelStyle = 'color' | 'fontSize' | 'fontWeight' | 'fontFamily' | 'textShadow' | 'backgroundImage' | 'paddingLeft' | 'paddingTop' | 'paddingBottom' | 'backgroundPosition' | 'backgroundSize' | 'left' | 'top' | 'transform' | 'opacity';
interface Label { label: HTMLSpanElement; styles: Partial<Record<LabelStyle, string>> }
interface Float extends Label { key: string; unitId: string; kind: FloatKind; cls: FloatClass; amount: number; at: number; measured: number; life: number; px: number;
  /** A damage number's place on its first drawn frame: it stays there, its unit may move on (DAMAGE_RIGHT, DAMAGE_JITTER). */
  spawn?: { x: number; y: number };
  /** Its place among damage numbers of one tick on its unit (0 for the first): DAMAGE_SAME_TICK_DOWN. */
  order: number }
/** Remember requested CSS values: CSSOM can round fractional px when reading them back. */
function style(item: Label, key: LabelStyle, value: string): void {
  if ((item.styles[key] ?? item.label.style[key]) !== value) item.label.style[key] = value;
  item.styles[key] = value;
}
function hidden(label: HTMLSpanElement, value: boolean): void { if (label.hidden !== value) label.hidden = value; }
/**
 * Damage floats (the user's 8 points, 11-19). Numbers only, coloured by damage type: physical orange, magic cyan-blue, true
 * damage white, heals green with "+"; a basic attack takes its type's colour too. A crit is the same colour, CRIT_SCALE larger,
 * with a wedge mark slammed in at its lower left (CRIT_MARK_PATH); a damage-over-time tick is a little smaller (a burn white). Where a number appears, how it moves, how long
 * it lives and the crit's size follow the original's look (11-27, the user: look at the original, sum up its rules, then build):
 * those values are measured from official-server footage and marked so; no value here is original data.
 */
const COLORS: Readonly<Record<FloatKind, string>> = { physical: '#ff8a24', magic: '#36c4ff', true: '#ffffff', heal: '#4fdc84' };
/** A burn's tick is white whatever its damage type. */
const BURN_COLOR = '#ffffff';
/**
 * Sizes: a plain number reads on both a close-up and the whole board (own choice); a crit CRIT_SCALE of it once settled, as
 * the original draws a crit beside a plain hit on one target (fitted to official-server footage, not original data); a tick
 * TICK_SCALE of it (own choice).
 */
const FONT_PX = 22, CRIT_SCALE = 1.4, TICK_SCALE = 0.8;
/** A bold rounded sans-serif from the system (no font file is shipped), never a serif face. */
const FONT_FAMILY = '"Arial Rounded MT Bold", "Nunito", "Varela Round", "Trebuchet MS", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
/** A dark edge all round (eight directions) and a drop shadow, so the number holds on a bright floor. */
/** Hard drop shadow (own value, not original): pure black, no blur, down-right by HARD_SHADOW_EM of the font size (about 9% of the digits' height). */
const HARD_SHADOW_EM = 0.065;
const OUTLINE = `1px 0 0 rgba(0,0,0,.9), -1px 0 0 rgba(0,0,0,.9), 0 1px 0 rgba(0,0,0,.9), 0 -1px 0 rgba(0,0,0,.9), 1px 1px 0 rgba(0,0,0,.9), -1px 1px 0 rgba(0,0,0,.9), 1px -1px 0 rgba(0,0,0,.9), -1px -1px 0 rgba(0,0,0,.9), ${HARD_SHADOW_EM}em ${HARD_SHADOW_EM}em 0 #000`;
/**
 * The motion, after the original's look (every pixel and time below is fitted to official-server footage, not original
 * data):
 * - Damage pops in at its largest (POP_SCALE) and drops back over POP_MS, and drifts a little from where it appeared, not
 *   following its unit: DAMAGE_DRIFT_X to the right over its life, up DAMAGE_RISE_PX and then down to DAMAGE_FALL_PX below
 *   where it appeared, as a small arc. It lives LIFE_MS and fades out linearly over its last FADE_MS.
 * - A crit pops at CRIT_POP and settles within CRIT_POP_MS, slamming in from up-left (CRIT_SLAM, the user's 11-19 pick, not the
 *   original's), then holds still until it fades.
 * - A heal stays on its unit and rises straight up at HEAL_RISE_PER_S from its first frame; it pops at HEAL_POP_SCALE and drops
 *   back over HEAL_POP_MS, and lives HEAL_LIFE_MS, fading over its last HEAL_FADE_MS.
 */
const POP_SCALE = 1.6, POP_MS = 160, FADE_MS = 300;
const DAMAGE_DRIFT_X = 25, DAMAGE_RISE_PX = 8, DAMAGE_FALL_PX = 20;
/** The arc's height at `u` of its life (screen px, down is +): up to −DAMAGE_RISE_PX at about a third, +DAMAGE_FALL_PX at the end. */
const damageArc = (u: number) => { const b = -2 * (DAMAGE_RISE_PX + Math.sqrt(DAMAGE_RISE_PX * (DAMAGE_RISE_PX + DAMAGE_FALL_PX))); return b * u + (DAMAGE_FALL_PX - b) * u * u; };
const CRIT_POP = 1.9, CRIT_POP_MS = 80, CRIT_SLAM = 0.25;
const critPop = (age: number) => age >= CRIT_POP_MS ? 1 : CRIT_POP - (CRIT_POP - 1) * age / CRIT_POP_MS;
const HEAL_POP_SCALE = 2, HEAL_POP_MS = 200, HEAL_RISE_PER_S = 80, HEAL_LIFE_MS = 620, HEAL_FADE_MS = 170;
const LIFE_MS: Readonly<Record<FloatClass, number>> = { plain: 700, crit: 700, tick: 700 };
const PER_UNIT = 6, ALL = 40;
/** Where a number appears: on its unit's body, chest to waist, BODY_DROP radii below the anchor (own fit). */
const BODY_DROP = 0.35;
/**
 * Where a damage number appears (official-server footage, 11-25): on the struck body, from its bar's centre toward its right
 * end, never above the bar, with a jitter that comes from the hit, not a random draw (the same on every replay). Numbers on
 * one unit do not queue or take turns. Without a bar: DAMAGE_RIGHT of the unit's width right of it, ±DAMAGE_JITTER px.
 */
const DAMAGE_RIGHT = 0.25, DAMAGE_JITTER = 15;
/**
 * Our own readability rules on where numbers appear (coordinator 11-27, not original data), taken on a number's first frame:
 * damage and heals stand in two layers under the unit's own bar, so neither moves aside for the other.
 * - A damage number's top edge starts DAMAGE_BELOW_BAR px (2–6, by its own jitter) under its bar's bottom, plus up to
 *   DAMAGE_BELOW_JITTER px more; its centre between the bar's middle and its right end, by its own jitter.
 * - A heal's centre is HEAL_BELOW_BAR px under its bar's bottom, on the unit's midline, and rises and follows from there.
 * - DAMAGE_SAME_TICK_*: the 2nd, 3rd… damage number of one tick on one unit lands right of the earlier ones with a gap of at
 *   least DAMAGE_GAP of its own width, and DAMAGE_SAME_TICK_DOWN px lower per place, at most DAMAGE_SAME_TICK_DOWN_MAX in all,
 *   so it stays in the damage layer.
 * - A crit's top edge is its mark's (CRIT_TOP_EM of its font size above its centre), not its digits'.
 * Without a bar (2D, replays) a number stands on its unit's body as before (BODY_DROP).
 */
const DAMAGE_BELOW_BAR = [2, 6] as const, DAMAGE_BELOW_JITTER = 20, HEAL_BELOW_BAR = 85;
const DAMAGE_GAP = 0.5, DAMAGE_SAME_TICK_DOWN = 4, DAMAGE_SAME_TICK_DOWN_MAX = 8;
/** Three numbers in [0, 1) from a number's key: the same hit always lands on the same spot. */
function spotOf(key: string): [number, number, number] {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const a = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0, b = Math.imul(a ^ (a >>> 13), 3266489909) >>> 0, c = Math.imul(b ^ (b >>> 16), 2654435761) >>> 0;
  return [a / 4294967296, b / 4294967296, c / 4294967296];
}
/** The digits' half height in em (own fit for the rounded faces used) and so how far a crit's mark reaches above its centre. */
const DIGITS_HALF_EM = 0.35;
/** Canvas labels (2D) a number steps sideways past, BAR_SIDESTEP_GAP px clear of their ends (own rule). Bars are not avoided. */
const BAR_SIDESTEP_GAP = 3;
/**
 * The crit mark left of a crit (自绘，非原版素材; its shape, colours and sizes are our own, the user's pick E5): a heavy wedge
 * slammed in at the number's lower left, its right angle at the bottom-right against the number, one long thick spike and a
 * few shorter ones flung up-left behind it, so the whole reads as a thick arrow pointing down-right. Straight lines and hard
 * corners only; two hard tones split along the slam (lighter upper right, darker lower left), its dark edge and the same hard
 * shadow as the digits. The wedge's bottom lines up with the digits' bottom.
 */
const CRIT_MARK_PATH = 'M24 9L24 24 11 24 11 22.5 6.5 22 11 20.5 11 17.5 4.5 16.5 11 15 11.5 14.5 1 1 16.2 9.8 17 9 18 9 18.5 4 21.5 9Z';
const MARK_EM = 1.27, MARK_PAD_EM = 0.42, DIGITS_BOTTOM_EM = 0.93;
/** A crit's mark hangs from the digits' bottom (MARK_EM tall), so its top is this far above the label's centre, in em. */
const CRIT_TOP_EM = MARK_EM - DIGITS_HALF_EM;
const channels = (color: string) => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
const hex = (values: number[]) => `#${values.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const lightTone = (color: string) => { const [r, g, b] = channels(color); return hex([r * 0.86 + 30, g * 0.7, b * 0.78]); };
const darkTone = (color: string) => { const [r, g, b] = channels(color); return hex([r * 0.62 + 18, g * 0.46, b * 0.58]); };
const markBox = 24 * (1 + HARD_SHADOW_EM / MARK_EM), markBoxEm = MARK_EM * markBox / 24;
const badge = (color: string) => {
  const shift = 24 * HARD_SHADOW_EM / MARK_EM, d = CRIT_MARK_PATH;
  // The darker tone lies below-left of a line along the slam, top-left to bottom-right.
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${markBox} ${markBox}'><defs><clipPath id='lo'><polygon points='-10,-8 40,42 -10,42'/></clipPath></defs>`
    + `<path d='${d}' fill='#000' transform='translate(${shift} ${shift})'/><path d='${d}' fill='${lightTone(color)}'/><path d='${d}' fill='${darkTone(color)}' clip-path='url(#lo)'/>`
    + `<path d='${d}' fill='none' stroke='rgba(0,0,0,.9)' stroke-width='1'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};
/** Decorative DOM layer only. Caller supplies CSS coordinates and drives the sole frame loop. */
export function createCombatFeedbackRenderer(host: HTMLElement): CombatFeedbackRenderer {
  const root = document.createElement('div'); root.className = 'm6-combat-feedback'; root.setAttribute('aria-hidden', 'true');
  Object.assign(root.style, { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none' }); host.append(root);
  let floats: Float[] = [], disposed = false;
  // A unit that died keeps its numbers where it last stood: its piece is hidden the frame it dies (BoardScene syncCombat),
  // before this frame's events reach push, so without this its killing blow's number never showed (11-24). Only a death
  // does this; a unit hidden for any other reason still shows nothing.
  const fallen = new Set<string>(), gone = new Set<string>(), lastAnchor = new Map<string, FeedbackAnchor>();
  // Detached nodes do not change the active DOM/order or keep expired text on the board. At most ALL are retained.
  const pool: Label[] = [];
  function release(item: Label): void { item.label.remove(); pool.push({ label: item.label, styles: item.styles }); }
  function reset(): void { for (const item of floats) release(item); floats = []; fallen.clear(); gone.clear(); lastAnchor.clear(); }
  const look = (kind: FloatKind, cls: FloatClass, burn: boolean) => {
    const color = cls === 'tick' && burn ? BURN_COLOR : COLORS[kind];
    const px = Math.round(FONT_PX * (cls === 'crit' ? CRIT_SCALE : cls === 'tick' ? TICK_SCALE : 1));
    return { color, px, fontWeight: '900', textShadow: OUTLINE,
      backgroundImage: cls === 'crit' ? badge(color) : '', paddingLeft: cls === 'crit' ? `${markBoxEm.toFixed(3)}em` : '', backgroundSize: cls === 'crit' ? `auto ${markBoxEm.toFixed(3)}em` : '',
      // The room above matches the room below, so the digits stay on the label's centre while the spikes hang below them.
      padding: cls === 'crit' ? `${MARK_PAD_EM}em` : '', backgroundPosition: cls === 'crit' ? `left 0 top ${(MARK_PAD_EM + DIGITS_BOTTOM_EM - MARK_EM).toFixed(3)}em` : '' };
  };
  function acquire(l: ReturnType<typeof look>): Label {
    let item = pool.pop();
    if (!item) {
      const label = document.createElement('span');
      Object.assign(label.style, { position: 'absolute', fontSize: `${l.px}px`, fontWeight: l.fontWeight, fontFamily: FONT_FAMILY, whiteSpace: 'nowrap', textShadow: l.textShadow, color: l.color, pointerEvents: 'none',
        backgroundImage: l.backgroundImage, backgroundRepeat: 'no-repeat', backgroundPosition: l.backgroundPosition, backgroundSize: l.backgroundSize,
        paddingTop: l.padding, paddingBottom: l.padding, paddingLeft: l.paddingLeft });
      item = { label, styles: { color: l.color } };
    } else {
      // Match a fresh label even if it has no anchor, or cannot be placed on its first frame.
      if (item.label.textContent !== '') item.label.textContent = '';
      hidden(item.label, false);
      for (const key of ['left', 'top', 'transform', 'opacity'] as const) style(item, key, '');
      style(item, 'color', l.color); style(item, 'fontSize', `${l.px}px`); style(item, 'fontWeight', l.fontWeight); style(item, 'textShadow', l.textShadow);
      style(item, 'backgroundImage', l.backgroundImage); style(item, 'paddingLeft', l.paddingLeft); style(item, 'backgroundPosition', l.backgroundPosition);
      style(item, 'paddingTop', l.padding); style(item, 'paddingBottom', l.padding); style(item, 'backgroundSize', l.backgroundSize);
    }
    root.append(item.label); return item;
  }
  /**
   * Every hit shows on its own; only the packets of one hit (one tick, source, target, kind and
   * class) add up to one number. A unit keeps PER_UNIT at once and the board ALL; the earliest plain number gives way first.
   */
  function add(tick: number, unitId: string, kind: FloatKind, amount: number, at: number, cls: FloatClass = 'plain', source = '', burn = false): void {
    if (amount <= 0) return;
    const key = `${tick}/${unitId}/${kind}/${cls}/${source}`;
    const old = floats.find(item => item.key === key);
    if (old) { old.amount += amount; return; }
    const perUnit = floats.filter(item => item.unitId === unitId);
    if (perUnit.length >= PER_UNIT) { const first = perUnit.find(item => item.cls !== 'crit') ?? perUnit[0]; release(first); floats = floats.filter(item => item !== first); }
    while (floats.length >= ALL) release(floats.shift()!);
    const l = look(kind, cls, burn);
    const order = kind === 'heal' ? 0 : floats.filter(item => item.unitId === unitId && item.kind !== 'heal' && item.key.startsWith(`${tick}/`)).length;
    floats.push({ ...acquire(l), key, unitId, kind, cls, amount, at, measured: Number.NaN, life: kind === 'heal' ? HEAL_LIFE_MS : LIFE_MS[cls], px: l.px, order });
  }
  return {
    push(events, at) {
      if (disposed) return;
      // Local ledger and §14.2 wire events read through the same display whitelist (event-carried numbers only).
      for (const event of asDisplayEvents(events)) {
        // Absorbed damage shows on the bar's shield segment, not as a number.
        if (event.type === 'packetDamage') {
          const tick = event.delivery === 'ability-periodic' || event.delivery === 'item-burn';
          // The killing packet shows its full amount, as the original does, not the target's last HP: the rest is the
          // packet's overkill (replay view, killing packets only). An event without it (an older server or replay) shows the HP it took.
          const overkill = event.killingPacket ? event.overkill ?? 0 : 0;
          add(event.tick, event.targetId, event.damageType, event.hpDamage + overkill, at, event.critical ? 'crit' : tick ? 'tick' : 'plain', event.sourceId, event.delivery === 'item-burn');
        }
        // Only damage and heals float, as in the original; a status (stun, knock-up, shred, sunder, burn…) shows no word.
        else if (event.type === 'heal') add(event.tick, event.targetId, 'heal', event.actual, at);
        if (event.type === 'death') fallen.add(event.unitId);
        else if (event.type === 'packetDamage' && event.killingPacket) fallen.add(event.targetId);
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
      // Where each unit stands now; a fallen unit with no piece left stands where it was last seen. A fallen unit seen again
      // after its piece was gone (a new combat, a revive) is no longer fallen.
      for (const [id, anchor] of anchors) { lastAnchor.set(id, anchor); if (gone.has(id)) { fallen.delete(id); gone.delete(id); } }
      for (const id of fallen) if (!anchors.has(id)) gone.add(id);
      const anchorOf = (id: string) => anchors.get(id) ?? (fallen.has(id) ? lastAnchor.get(id) : undefined);
      const visible: { item: Float; anchor: FeedbackAnchor }[] = [];
      for (const item of floats) {
        const anchor = anchorOf(item.unitId); hidden(item.label, !anchor); if (!anchor) continue;
        const text = `${item.kind === 'heal' ? '+' : ''}${item.amount}`;
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
      // Each number on its own (no queue, no turns, as in the original): a heal on its unit's body, rising; a damage number where it
      // first appeared, drifting. Canvas labels (2D) it would cover make it step sideways; bars do not.
      for (const { item, anchor, half } of measured) {
        const age = Math.max(0, now - item.at), heal = item.kind === 'heal';
        const pop = heal ? (age < HEAL_POP_MS ? HEAL_POP_SCALE - (HEAL_POP_SCALE - 1) * (age / HEAL_POP_MS) : 1)
          : item.cls === 'crit' ? critPop(age) : age < POP_MS ? POP_SCALE - (POP_SCALE - 1) * (age / POP_MS) : 1;
        const size = item.px * pop, w = half * pop, bar = bars.get(item.unitId), barBottom = bar ? bar.y + bar.h / 2 : 0;
        let x: number, y: number;
        if (heal) {
          // On the unit's midline in the heal layer (HEAL_BELOW_BAR under its bar), rising from its first frame and following
          // its unit; it never rises past half its height below its bar.
          const floor = bar ? barBottom + size / 2 : -Infinity, from = bar ? barBottom + HEAL_BELOW_BAR : anchor.y + anchor.radius * BODY_DROP;
          x = anchor.x; y = Math.max(from - HEAL_RISE_PER_S * age / 1000, floor);
        } else {
          if (!item.spawn) {
            // Its first frame, in the damage layer: its top edge (at its popped size; a crit's mark) just under its own bar, its
            // centre between the bar's middle and right end. Its arc may then touch the bar a little; other bars are not avoided.
            const [sx, sy, sd] = spotOf(item.key), top = item.cls === 'crit' ? CRIT_TOP_EM * item.px * pop : size / 2;
            const down = Math.min(DAMAGE_SAME_TICK_DOWN_MAX, DAMAGE_SAME_TICK_DOWN * item.order);
            const spawn = bar
              ? { x: bar.x + bar.w / 2 * sx, y: barBottom + DAMAGE_BELOW_BAR[0] + (DAMAGE_BELOW_BAR[1] - DAMAGE_BELOW_BAR[0]) * sy + DAMAGE_BELOW_JITTER * sd + top + down }
              : { x: anchor.x + anchor.radius * DAMAGE_RIGHT * 2 + (sx * 2 - 1) * DAMAGE_JITTER, y: anchor.y + anchor.radius * BODY_DROP + (sy * 2 - 1) * DAMAGE_JITTER + down };
            // Right of this tick's earlier damage numbers on its unit, a gap clear of each as both appear (popped alike: one tick).
            const gap = DAMAGE_GAP * 2 * half, tick = item.key.slice(0, item.key.indexOf('/') + 1);
            for (const other of floats) if (other !== item && other.spawn && other.unitId === item.unitId && other.kind !== 'heal' && other.order < item.order && other.key.startsWith(tick))
              spawn.x = Math.max(spawn.x, other.spawn.x + ((Number.isNaN(other.measured) ? 20 : other.measured) + half) * pop + gap);
            item.spawn = spawn;
          }
          const u = Math.min(1, age / Math.max(1, item.life)), still = item.cls === 'crit';
          x = item.spawn.x + (still ? 0 : DAMAGE_DRIFT_X * u); y = item.spawn.y + (still ? 0 : damageArc(u));
        }
        y = Math.max(12 + size / 2, Math.min(height - 12, y));
        const fit = (at: number) => Math.max(w, Math.min(width - w, at));
        x = fit(x);
        const hard = obstacles.filter(rect => Math.abs(rect.y - y) < rect.h / 2 + size / 2);
        const clear = (at: number) => !hard.some(rect => Math.abs(rect.x - at) < rect.w / 2 + w);
        if (!clear(x)) {
          const spots = hard.flatMap(rect => [rect.x + rect.w / 2 + w + BAR_SIDESTEP_GAP, rect.x - rect.w / 2 - w - BAR_SIDESTEP_GAP]).map(fit).filter(clear);
          if (spots.length) x = spots.reduce((best, at) => Math.abs(at - x) < Math.abs(best - x) ? at : best);
        }
        const fadeMs = heal ? HEAL_FADE_MS : FADE_MS;
        const fade = Math.max(0, Math.min(1, (item.life - age) / fadeMs));
        style(item, 'left', `${x}px`); style(item, 'top', `${y}px`);
        // A crit slams in from up-left: it starts CRIT_SLAM of its size up and left and reaches its spot by CRIT_POP_MS (the user's pick).
        const slam = item.cls === 'crit' && age < CRIT_POP_MS ? -CRIT_SLAM * item.px * (1 - age / CRIT_POP_MS) : 0;
        const moved = slam ? ` translate(${slam.toFixed(1)}px, ${slam.toFixed(1)}px)` : '';
        style(item, 'transform', pop === 1 && !moved ? 'translate(-50%, -50%)' : `translate(-50%, -50%)${moved}${pop === 1 ? '' : ` scale(${pop.toFixed(3)})`}`);
        style(item, 'opacity', String(Number(fade.toFixed(3))));
      }
    },
    reset,
    dispose() { disposed = true; reset(); pool.length = 0; root.remove(); },
  };
}
