import { describe, expect, it, vi } from 'vitest';
import { ScoutMinimap } from '../src/rendering/online/scout-minimap';
import type { PlayerView, SeatPublic } from '../src/rendering/online/protocol';

/** Minimal DOM (no jsdom here): enough for the minimap's buttons and dots. */
class Node {
  children: Node[] = []; dataset: Record<string, string> = {}; style: Record<string, string> = {}; className = ''; textContent = ''; title = ''; type = ''; hidden = false;
  listeners: Record<string, () => void> = {};
  setAttribute() {} append(...nodes: Node[]) { this.children.push(...nodes); } replaceChildren(...nodes: Node[]) { this.children = nodes; } remove() {}
  addEventListener(type: string, handler: () => void) { this.listeners[type] = handler; }
}
const seat = (seatId: string, extra: Partial<SeatPublic> = {}): SeatPublic => ({ seatId, name: `玩家 ${seatId}`, kind: 'bot', hp: 80, level: 5, alive: true, rank: null,
  connected: true, controller: 'bot', publicBoard: { units: [] }, ...extra } as SeatPublic);

describe('3D scouting minimap', () => {
  it('keeps nodes/listeners through repeated cloned publications and invalidates every drawn field', () => {
    const createElement = vi.fn(() => new Node());
    vi.stubGlobal('document', { createElement });
    try {
      const minimap = new ScoutMinimap(new Node() as unknown as HTMLElement, () => {});
      const initial = { mySeatId: 's1', opponentSeatId: 's2', seats: [seat('s1'), seat('s2', { publicBoard: { units: [
        { definitionId: 'missing-unit', starLevel: 1, cell: { row: 4, col: 0 }, items: [] },
      ] } })] } as unknown as PlayerView;
      minimap.render(initial, null);
      const original = (minimap.root as unknown as Node).children, count = createElement.mock.calls.length;
      for (let round = 1; round <= 40; round++) for (let push = 0; push < 20; push++) minimap.render(structuredClone(initial), null);
      expect((minimap.root as unknown as Node).children).toBe(original);
      expect(createElement).toHaveBeenCalledTimes(count);
      const changes = [
        (v: any) => { v.seats[1].name = '改名'; }, (v: any) => { v.seats[1].hp--; },
        (v: any) => { v.seats[1].alive = false; }, (v: any) => { v.mySeatId = 's2'; },
        (v: any) => { v.opponentSeatId = null; }, (v: any) => { v.seats.reverse(); },
        (v: any) => { v.seats[1].publicBoard.units[0].cell.col++; },
        (v: any) => { v.seats[1].publicBoard.units[0].cell.row++; },
        (v: any) => { v.seats[1].publicBoard.units[0].summon = true; },
        (v: any) => { v.seats[1].publicBoard.units[0].definitionId = 'vex'; },
      ];
      for (const change of changes) {
        minimap.render(initial, null);
        const before = (minimap.root as unknown as Node).children;
        const next = structuredClone(initial); change(next); minimap.render(next, null);
        expect((minimap.root as unknown as Node).children).not.toBe(before);
      }
      minimap.render(initial, 's2');
      expect((minimap.root as unknown as Node).children[1].className).toContain('shown');
      minimap.render(null, null); expect((minimap.root as unknown as Node).children).toEqual([]);
      minimap.dispose();
    } finally { vi.unstubAllGlobals(); }
  });
  it('draws one tile per seat from the public board, marks me, my opponent and the shown seat, and opens a seat on click', () => {
    vi.stubGlobal('document', { createElement: () => new Node() });
    try {
      const host = new Node(), picked: string[] = [];
      const minimap = new ScoutMinimap(host as unknown as HTMLElement, seatId => picked.push(seatId));
      const view = { mySeatId: 's1', opponentSeatId: 's2', seats: [
        seat('s1'),
        seat('s2', { publicBoard: { units: [
          { definitionId: 'missing-unit', starLevel: 2, cell: { col: 0, row: 4 }, items: [] },
          { definitionId: 'missing-unit', starLevel: 1, cell: { col: 6, row: 7 }, items: [], summon: true },
          { definitionId: 'missing-unit', starLevel: 1, cell: { col: 3, row: 1 }, items: [] }, // not on the deployment half: left out
        ] } }),
        seat('s3', { alive: false, hp: 0 }),
      ] } as unknown as PlayerView;
      minimap.render(view, 's3');
      const tiles = (minimap.root as unknown as Node).children;
      expect(tiles.map(tile => tile.dataset.seat)).toEqual(['s1', 's2', 's3']);
      expect(tiles[0]!.className).toBe('minimap-seat me');
      expect(tiles[1]!.className).toBe('minimap-seat opponent');
      expect(tiles[2]!.className).toBe('minimap-seat shown eliminated');
      const dots = tiles[1]!.children[0]!.children;
      expect(dots).toHaveLength(2);
      expect(dots[0]!.style.top).toBe('12.5%');
      expect(dots[1]!.style.top).toBe('87.5%');
      expect(dots[1]!.style.background).toBe('#8a96a3');
      tiles[1]!.listeners.click!();
      expect(picked).toEqual(['s2']);
      // Without a scouted seat my own board is the one shown.
      minimap.render(view, null);
      expect((minimap.root as unknown as Node).children[0]!.className).toBe('minimap-seat me shown');
      minimap.render(null, null);
      expect((minimap.root as unknown as Node).children).toEqual([]);
    } finally { vi.unstubAllGlobals(); }
  });
});
