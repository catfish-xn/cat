import { appliedStatusFloat } from '../presentation/combat-status';
import { asDisplayEvents, type SceneCombatEvent } from '../presentation/combat-display';
export interface FeedbackAnchor { readonly x: number; readonly y: number; readonly radius: number }
/** A centred rect in the same CSS coordinates as anchors (e.g. a canvas text label) that floats must not cover. */
export interface FeedbackObstacle { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface CombatFeedbackRenderer { push(events: readonly SceneCombatEvent[], displayTimeMs: number): void; render(displayTimeMs: number, anchors: ReadonlyMap<string, FeedbackAnchor>, obstacles?: readonly FeedbackObstacle[]): void; reset(): void; dispose(): void }
type FloatKind = 'physical' | 'magic' | 'true' | 'shield' | 'heal' | 'status';
type LabelStyle = 'color' | 'left' | 'top' | 'transform' | 'opacity';
interface Label { label: HTMLSpanElement; styles: Partial<Record<LabelStyle, string>> }
interface Float extends Label { key: string; unitId: string; kind: FloatKind; amount: number; text: string; at: number }
/** Remember requested CSS values: CSSOM can round fractional px when reading them back. */
function style(item: Label, key: LabelStyle, value: string): void {
  if ((item.styles[key] ?? item.label.style[key]) !== value) item.label.style[key] = value;
  item.styles[key] = value;
}
function hidden(label: HTMLSpanElement, value: boolean): void { if (label.hidden !== value) label.hidden = value; }
/** Damage type is told apart by color and by a suffix, so color is never the only cue. */
const COLORS: Readonly<Record<FloatKind, string>> = { physical: '#ffc58f', magic: '#c9a8ff', true: '#ffffff', shield: '#a7dcff', heal: '#78efab', status: '#ff9d8a' };
const SUFFIX: Readonly<Record<FloatKind, string>> = { physical: '', magic: ' 魔', true: ' 真', shield: '', heal: '', status: '' };
/** Decorative DOM layer only. Caller supplies CSS coordinates and drives the sole frame loop. */
export function createCombatFeedbackRenderer(host: HTMLElement): CombatFeedbackRenderer {
  const root = document.createElement('div'); root.className = 'm6-combat-feedback'; root.setAttribute('aria-hidden', 'true');
  Object.assign(root.style, { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none' }); host.append(root);
  let floats: Float[] = [], disposed = false;
  // Detached nodes do not change the active DOM/order or keep expired text on the board. At most 24 are retained.
  const pool: Label[] = [];
  function release(item: Label): void { item.label.remove(); pool.push({ label: item.label, styles: item.styles }); }
  function reset(): void { for (const item of floats) release(item); floats = []; }
  function acquire(kind: FloatKind): Label {
    let item = pool.pop();
    if (!item) {
      const label = document.createElement('span');
      Object.assign(label.style, { position: 'absolute', fontSize: '14px', fontWeight: '700', whiteSpace: 'nowrap', textShadow: '0 1px 3px #000', color: COLORS[kind], pointerEvents: 'none' });
      item = { label, styles: { color: COLORS[kind] } };
    } else {
      // Match a fresh label even if it has no anchor, or cannot be placed on its first frame.
      if (item.label.textContent !== '') item.label.textContent = '';
      hidden(item.label, false);
      for (const key of ['left', 'top', 'transform', 'opacity'] as const) style(item, key, '');
      style(item, 'color', COLORS[kind]);
    }
    root.append(item.label); return item;
  }
  /** Floats of one tick and unit merge; reset() runs on every new battle, so the tick identifies the batch. */
  function add(tick: number, unitId: string, kind: FloatKind, amount: number, at: number, text = ''): void {
    if (amount <= 0) return;
    const key = `${tick}/${unitId}/${kind}${text}`;
    const old = floats.find(item => item.key === key);
    if (old) { if (kind !== 'status') old.amount += amount; return; }
    const perUnit = floats.filter(item => item.unitId === unitId);
    if (perUnit.length >= 3) { const first = perUnit[0]; release(first); floats = floats.filter(item => item !== first); }
    while (floats.length >= 24) release(floats.shift()!);
    floats.push({ key, unitId, kind, amount, text, at, ...acquire(kind) });
  }
  return {
    push(events, at) {
      if (disposed) return;
      // Local ledger and §14.2 wire events read through the same display whitelist (event-carried numbers only).
      for (const event of asDisplayEvents(events)) {
        if (event.type === 'packetDamage') { add(event.tick, event.targetId, event.damageType, event.hpDamage, at); add(event.tick, event.targetId, 'shield', event.absorbed, at); }
        else if (event.type === 'heal') add(event.tick, event.targetId, 'heal', event.actual, at);
        else { const status = appliedStatusFloat(event); if (status && event.type === 'statusChanged') add(event.tick, event.targetId, 'status', 1, at, status); }
      }
    },
    render(now, anchors, obstacles = []) {
      if (disposed) return;
      floats = floats.filter(item => { if (now - item.at >= 850) { release(item); return false; } return true; });
      // Prepare changed content and reveal measurable labels together. New text needs one layout boundary;
      // never interleave a label's position/opacity writes with the next label's geometry reads.
      const visible: { item: Float; anchor: FeedbackAnchor }[] = [];
      for (const item of floats) {
        const anchor = anchors.get(item.unitId); hidden(item.label, !anchor); if (!anchor) continue;
        const text = item.kind === 'status' ? item.text : `${item.kind === 'heal' ? '+' : item.kind === 'shield' ? '盾 ' : '−'}${item.amount}${SUFFIX[item.kind]}`;
        if (item.label.textContent !== text) item.label.textContent = text;
        visible.push({ item, anchor });
      }
      if (!visible.length) return;
      // All layout reads precede all placement writes. Remeasure instead of assuming fonts/scale never change.
      const width = root.clientWidth, height = root.clientHeight;
      const measured = visible.map(({ item, anchor }) => ({ item, anchor, half: Math.max(20, item.label.offsetWidth / 2) }));
      const lanes = new Map<string, number>();
      const occupied: { x: number; y: number; half: number }[] = [];
      const points = [...anchors.values()];
      for (const { item, anchor, half } of measured) {
        const lane = lanes.get(item.unitId) ?? 0; lanes.set(item.unitId, lane + 1);
        const age = Math.max(0, now - item.at);
        const x = Math.max(half, Math.min(width - half, anchor.x));
        let y = Math.max(16, Math.min(height - 16, anchor.y - anchor.radius - 22 - lane * 17 - age / 70));
        let placed = false;
        for (let attempt = 0; attempt < 7; attempt++) {
          const candidate = y - attempt * 21;
          if (candidate < 12) break;
          const overlapsFloat = occupied.some(rect => Math.abs(rect.x - x) < rect.half + half + 3 && Math.abs(rect.y - candidate) < 21);
          const overlapsPiece = points.some(point => Math.abs(point.x - x) < point.radius + half && Math.abs(point.y - candidate) < point.radius + 10);
          const overlapsLabel = obstacles.some(rect => Math.abs(rect.x - x) < rect.w / 2 + half + 2 && Math.abs(rect.y - candidate) < rect.h / 2 + 12);
          if (!overlapsFloat && !overlapsPiece && !overlapsLabel) { y = candidate; placed = true; occupied.push({ x, y, half }); break; }
        }
        hidden(item.label, !placed); if (!placed) continue;
        style(item, 'left', `${x}px`); style(item, 'top', `${y}px`); style(item, 'transform', 'translate(-50%, -50%)'); style(item, 'opacity', String(Math.min(1, (850 - age) / 250)));
      }
    },
    reset,
    dispose() { disposed = true; reset(); pool.length = 0; root.remove(); },
  };
}
