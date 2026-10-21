import { describe, expect, it, vi } from 'vitest';
import { Group, Scene, type Texture } from 'three';
import { createScoutStage, readScout } from '../src/rendering/three-mode/scout-stage';
import { boardFeedGeneration, publishScout, subscribeBoardFeed, type BoardFrame, type BoardScout } from '../src/rendering/board-feed';
import { TraitColumn, traitColumnShowRows, type TraitRow } from '../src/rendering/trait-column';
import type { ModelLease } from '../src/rendering3d';

/** Synthetic seats only: no asset files, no real players. */
const frame: BoardFrame = {
  rows: 8, columns: 7, hexRadius: 34, origin: { x: 100, y: 100 }, fighting: false, dragging: null, pieces: [],
  bench: Array.from({ length: 9 }, (_, slot) => ({ x: 80 + slot * 50, y: 520 })),
};
const scoutOf = (extra: Record<string, unknown> = {}): BoardScout => ({
  seatId: 'seat-3', name: '机器人 3',
  board: {
    units: [
      { definitionId: 'unit-a', starLevel: 3, effectiveStarLevel: 4, cell: { col: 2, row: 6 }, items: ['item-1', 'item-2'], anomaly: 'anomaly-x' },
      { definitionId: 'unit-b', starLevel: 1, cell: { col: 5, row: 7 }, items: [] },
      { definitionId: 'summon-c', starLevel: 2, cell: { col: 1, row: 5 }, items: [], summon: true },
    ],
    bench: [{ definitionId: 'unit-d', starLevel: 2, slot: 4, items: ['item-3'] }],
    looseItems: ['item-4'], augments: ['augment-1'],
  },
  orbs: { count: 2, tiers: ['gold', 'blue'] },
  ...extra,
} as BoardScout);

/** Every key anywhere in a value (to prove what is absent). */
function keys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach(entry => keys(entry, out));
  else if (value && typeof value === 'object') for (const [key, entry] of Object.entries(value)) { out.add(key); keys(entry, out); }
  return out;
}

describe('3D scouting: what is read (S2)', () => {
  it('copies only the published build: no gold, XP, streak, shop or orb ids/contents, whatever the input carries', () => {
    // A view that (wrongly) carried private fields at every level: none of them may come through.
    const leaky = scoutOf({ gold: 50, xp: 12, streak: 3, shop: ['unit-z'], hp: 80, level: 7 });
    const board = leaky.board as unknown as Record<string, unknown>;
    board.gold = 9; board.shop = ['unit-y']; board.streak = -2; board.xp = 3; board.pendingChoices = ['x'];
    (board.units as Record<string, unknown>[])[0]!.sellValue = 9;
    (board.units as Record<string, unknown>[])[0]!.poolCopies = 4;
    const orbs = leaky.orbs as unknown as Record<string, unknown>;
    orbs.ids = ['orb-1', 'orb-2']; orbs.contents = [{ gold: 3 }]; orbs.queued = true;
    const view = readScout(leaky);
    const seen = keys(view);
    for (const secret of ['gold', 'xp', 'streak', 'shop', 'hp', 'level', 'pendingChoices', 'sellValue', 'poolCopies', 'ids', 'contents', 'queued', 'orbId', 'id'])
      expect(seen.has(secret), secret).toBe(false);
    expect(Object.keys(view).sort()).toEqual(['augments', 'bench', 'looseItems', 'name', 'orbs', 'seatId', 'units']);
    expect(Object.keys(view.orbs).sort()).toEqual(['count', 'tiers']);
  });

  it('keeps everything scouting shows: units with cells, four stars, items and anomaly, bench, loose items, augments, orb tiers', () => {
    const view = readScout(scoutOf());
    expect(view.units[0]).toEqual({ definitionId: 'unit-a', starLevel: 3, effectiveStarLevel: 4, items: ['item-1', 'item-2'], anomaly: 'anomaly-x', cell: { col: 2, row: 6 } });
    expect(view.units[2]!.summon).toBe(true);
    expect(view.bench).toEqual([{ definitionId: 'unit-d', starLevel: 2, items: ['item-3'], slot: 4 }]);
    expect(view.looseItems).toEqual(['item-4']);
    expect(view.augments).toEqual(['augment-1']);
    expect(view.orbs).toEqual({ count: 2, tiers: ['gold', 'blue'] });
  });

  it('drops malformed entries instead of guessing', () => {
    const view = readScout({ seatId: 's', name: 'n', board: { units: [{ definitionId: 'a', starLevel: 'x', cell: { col: 0, row: 0 }, items: [] },
      { definitionId: 'b', starLevel: 1, items: [] }] as never, bench: [{ definitionId: 'c', starLevel: 1, slot: -1, items: [] }] as never },
      orbs: { count: 1, tiers: ['gold', 'weird'] as never } });
    expect(view.units).toEqual([]);
    expect(view.bench).toEqual([]);
    expect(view.orbs.tiers).toEqual(['gold']);
  });
});

describe('3D scouting stage', () => {
  const setup = (loadModel: ((id: string) => Promise<ModelLease>) | null = null) => {
    const scene = new Scene(), owned: { dispose(): void }[] = [];
    const icons: string[] = [];
    const stage = createScoutStage({ scene, championHeight: 92, championWidth: 110, pawnHeight: 56, pawnWidth: 40, loadModel, hasLegend: false,
      starColor: () => '#ffd34d', itemIcon: id => { icons.push(id); return `/icons/${id}.png`; },
      overhead: { colors: () => ({ hp: '#0f0', hpEnemy: '#f00', mana: '#00f', manaFull: '#fff', shield: '#eee' }), itemTexture: () => Promise.resolve(null as Texture | null) },
      own: <T extends { dispose(): void }>(resource: T) => { owned.push(resource); return resource; } });
    return { scene, stage, icons };
  };

  it('draws the seat on my board layout: units on their own cells, bench slots, its legend and orbs by tier', () => {
    const { scene, stage, icons } = setup();
    expect(stage.active).toBe(false);
    stage.show(scoutOf(), frame);
    expect(stage.active).toBe(true);
    const debug = stage.debug();
    expect(debug.seatId).toBe('seat-3');
    expect(debug.units.sort()).toEqual(['board:1,5:standin', 'board:2,6:standin', 'board:5,7:standin']);
    expect(debug.bench).toEqual(['bench:4']);
    expect(debug.orbs).toEqual(['gold', 'blue']);
    expect(debug.legend).toBe('standin');
    expect(icons.sort()).toEqual(['item-1', 'item-2', 'item-3']);
    expect(scene.getObjectByName('render3d-scout-anomaly')).toBeDefined();
    // The bench unit stands on the frame's bench slot.
    const group = scene.getObjectByName('render3d-scout') as Group;
    expect(group.visible).toBe(true);
    stage.show(null, frame);
    expect(stage.active).toBe(false);
    expect(group.visible).toBe(false);
    expect(stage.debug().units).toEqual([]);
  });

  it('loads each unit model once per build and releases them on stop', async () => {
    const leases: { released: boolean }[] = [];
    const { stage } = setup(() => {
      const lease = { scene: new Group(), animations: [], animationNames: {}, placeholder: false, released: false, release() { lease.released = true; } };
      leases.push(lease); return Promise.resolve(lease as unknown as ModelLease);
    });
    stage.show(scoutOf(), frame);
    stage.show(scoutOf(), frame); // same seat and layout: no rebuild
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(leases).toHaveLength(4);
    expect(stage.debug().units.every(entry => entry.endsWith(':model'))).toBe(true);
    stage.show(null, null);
    expect(leases.every(lease => lease.released)).toBe(true);
  });
});

describe('board-feed scout channel', () => {
  it('builds a scout only for a layer that draws one', () => {
    expect(publishScout(() => { throw new Error('not built'); })).toBe(false);
    const shown: (BoardScout | null)[] = [];
    const off = subscribeBoardFeed({ frame() {}, events() {}, scout: view => shown.push(view) });
    expect(publishScout(() => scoutOf())).toBe(true);
    expect(publishScout(() => null)).toBe(true);
    expect(shown.map(view => view?.seatId ?? null)).toEqual(['seat-3', null]);
    off();
    const offOther = subscribeBoardFeed({ frame() {}, events() {} });
    expect(publishScout(() => scoutOf())).toBe(false);
    offOther();
  });

  it('moves the generation on when the 3D layer detaches, so the panel and trait column go back to 2D', () => {
    const off = subscribeBoardFeed({ frame() {}, events() {}, scout() {} });
    const attached = boardFeedGeneration();
    off();
    expect(boardFeedGeneration()).toBe(attached + 1);
    expect(publishScout(() => scoutOf())).toBe(false);
    off(); // a second detach of the same layer changes nothing
    expect(boardFeedGeneration()).toBe(attached + 1);
  });
});

describe('trait column while scouting', () => {
  it('shows the given rows and goes back to my own on null', () => {
    // Minimal DOM for the column (no jsdom here).
    class Node {
      children: Node[] = []; dataset: Record<string, string> = {}; textContent = ''; className = ''; id = ''; parentElement: Node | null = null;
      get childElementCount() { return this.children.length; }
      setAttribute() {} addEventListener() {} removeEventListener() {} append(...nodes: Node[]) { this.children.push(...nodes); }
      prepend(...nodes: Node[]) { this.children.unshift(...nodes); } insertBefore(node: Node) { this.children.unshift(node); }
      replaceChildren(...nodes: Node[]) { this.children = nodes; } remove() {} querySelector() { return null; } querySelectorAll() { return []; }
      closest() { return null; } classList = { add() {}, remove() {}, toggle() {} }; style = { setProperty() {} };
    }
    const doc = { createElement: () => new Node(), body: new Node(), addEventListener() {}, removeEventListener() {} };
    vi.stubGlobal('document', doc);
    vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} });
    try {
      const host = new Node();
      const card = { show() {}, hide() {}, move() {}, dispose() {} };
      const column = new TraitColumn(host as unknown as HTMLElement, null, card as never);
      const rows: TraitRow[] = [];
      traitColumnShowRows(rows);
      expect('scout' in (column.root as unknown as Node).dataset).toBe(true);
      expect(((column.root as unknown as Node).children[0] as Node).textContent).toBe('对方羁绊');
      traitColumnShowRows(null);
      expect('scout' in (column.root as unknown as Node).dataset).toBe(false);
      column.dispose();
    } finally { vi.unstubAllGlobals(); }
  });
});
