import type { CombatEvent } from '../simulation/combat-types';
export interface FeedbackAnchor { readonly x: number; readonly y: number; readonly radius: number }
export interface CombatFeedbackRenderer { push(events: readonly CombatEvent[], displayTimeMs: number): void; render(displayTimeMs: number, anchors: ReadonlyMap<string, FeedbackAnchor>): void; reset(): void; dispose(): void }
interface Float { key: string; unitId: string; kind: 'damage' | 'shield' | 'heal'; amount: number; at: number; label: HTMLSpanElement }
/** Decorative DOM layer only. Caller supplies CSS coordinates and drives the sole frame loop. */
export function createCombatFeedbackRenderer(host: HTMLElement): CombatFeedbackRenderer {
  const root = document.createElement('div'); root.className = 'm6-combat-feedback'; root.setAttribute('aria-hidden', 'true');
  Object.assign(root.style, { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none' }); host.append(root);
  let floats: Float[] = [], disposed = false;
  function reset(): void { for (const item of floats) item.label.remove(); floats = []; }
  function add(event: CombatEvent, unitId: string, kind: Float['kind'], amount: number, at: number): void {
    if (amount <= 0) return;
    const key = `${event.combatId}/${event.tick}/${unitId}/${kind}`;
    const old = floats.find(item => item.key === key);
    if (old) { old.amount += amount; return; }
    const perUnit = floats.filter(item => item.unitId === unitId);
    if (perUnit.length >= 3) { const first = perUnit[0]; first.label.remove(); floats = floats.filter(item => item !== first); }
    while (floats.length >= 24) floats.shift()!.label.remove();
    const label = document.createElement('span'); Object.assign(label.style, { position: 'absolute', fontSize: '14px', fontWeight: '700', whiteSpace: 'nowrap', textShadow: '0 1px 3px #000', color: kind === 'heal' ? '#78efab' : kind === 'shield' ? '#a7dcff' : '#ffe8c2', pointerEvents: 'none' }); root.append(label);
    floats.push({ key, unitId, kind, amount, at, label });
  }
  return {
    push(events, at) { if (disposed) return; for (const event of events) { if (event.type === 'packetDamage') { add(event, event.unitId, 'damage', event.hpDamage, at); add(event, event.unitId, 'shield', event.absorbed, at); } else if (event.type === 'heal') add(event, event.unitId, 'heal', event.actual, at); } },
    render(now, anchors) {
      if (disposed) return;
      floats = floats.filter(item => { if (now - item.at >= 850) { item.label.remove(); return false; } return true; });
      const lanes = new Map<string, number>();
      const occupied: { x: number; y: number; half: number }[] = [];
      for (const item of floats) {
        const anchor = anchors.get(item.unitId); item.label.hidden = !anchor; if (!anchor) continue;
        const lane = lanes.get(item.unitId) ?? 0; lanes.set(item.unitId, lane + 1);
        const age = Math.max(0, now - item.at); item.label.textContent = `${item.kind === 'damage' ? '−' : item.kind === 'heal' ? '+' : '盾 '}${item.amount}`;
        const half = Math.max(20, item.label.offsetWidth / 2); const width = root.clientWidth, height = root.clientHeight;
        const x = Math.max(half, Math.min(width - half, anchor.x));
        let y = Math.max(16, Math.min(height - 16, anchor.y - anchor.radius - 22 - lane * 17 - age / 70));
        let placed = false;
        for (let attempt = 0; attempt < 7; attempt++) {
          const candidate = y - attempt * 18;
          if (candidate < 12) break;
          const overlapsFloat = occupied.some(rect => Math.abs(rect.x - x) < rect.half + half + 3 && Math.abs(rect.y - candidate) < 17);
          const overlapsPiece = [...anchors.values()].some(point => Math.abs(point.x - x) < point.radius + half && Math.abs(point.y - candidate) < point.radius + 10);
          if (!overlapsFloat && !overlapsPiece) { y = candidate; placed = true; occupied.push({ x, y, half }); break; }
        }
        item.label.hidden = !placed; if (!placed) continue;
        item.label.style.left = `${x}px`; item.label.style.top = `${y}px`; item.label.style.transform = 'translate(-50%, -50%)'; item.label.style.opacity = String(Math.min(1, (850 - age) / 250));
      }
    },
    reset,
    dispose() { disposed = true; reset(); root.remove(); },
  };
}
