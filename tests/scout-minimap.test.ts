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
