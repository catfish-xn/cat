import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientListeners, GameClient, PlayerView } from '../src/rendering/online/protocol';
import type { RemoteSession } from '../src/rendering/online/remote-session';
import type { OnlineApplication } from '../src/rendering/online/online-application';
import type { OnlineBoardMounts } from '../src/rendering/app-shell';

/** Minimal DOM, with real minimap clicks and real OpponentBoardPanel open/close behavior. */
class Node {
  children: Node[] = []; dataset: Record<string, string> = {}; className = ''; hidden = false; inert = false;
  textContent = ''; id = ''; style = { setProperty() {} }; classList = { add() {}, remove() {}, toggle() {} };
  private attributes = new Set<string>();
  private listeners = new Map<string, () => void>();
  append(...nodes: Node[]) { this.children.push(...nodes); }
  prepend(...nodes: Node[]) { this.children.unshift(...nodes); }
  replaceChildren(...nodes: Node[]) { this.children = nodes; }
  setAttribute(name: string) { this.attributes.add(name); }
  hasAttribute(name: string) { return this.attributes.has(name); }
  toggleAttribute(name: string, on: boolean) { if (on) this.attributes.add(name); else this.attributes.delete(name); }
  addEventListener(type: string, callback: () => void) { this.listeners.set(type, callback); }
  removeEventListener(type: string) { this.listeners.delete(type); }
  click() { this.listeners.get('click')?.(); }
  querySelector() { return null; }
  remove() {}
}

describe('3D scouting shop availability', () => {
  let app: OnlineApplication | undefined, root: Node, shop: Node, listeners: ClientListeners, off: (() => void) | undefined;
  const mocked = ['lobby', 'players-sidebar', 'carousel-panel', 'battle-summary', 'economy-hint', 'left-panel-toggle', 'sound', 'ranking', 'battle-outcome'];
  beforeEach(() => {
    vi.resetModules(); root = new Node(); shop = new Node();
    const body = new Node();
    vi.stubGlobal('document', { body, hidden: false, createElement: () => new Node(), getElementById: (id: string) => id === 'app' ? root : null,
      querySelector: () => null, addEventListener() {}, removeEventListener() {} });
    // Unrelated HUD widgets are passive: keep the application, minimap, scout panel and board-feed real.
    class Widget {
      root = new Node(); showing = false; isCollapsed = false; isMuted = true; played: string[] = [];
      render() {} show() {} hide() {} dispose() {} setViewing() {} connection() {} tick() {} secondsLeft() { return null; }
      play() {} createToggle() { return new Node(); } debug() { return {}; } clear() {}
    }
    vi.doMock('../src/rendering/online/lobby', () => ({ Lobby: Widget }));
    vi.doMock('../src/rendering/online/players-sidebar', () => ({ PlayersSidebar: Widget }));
    vi.doMock('../src/rendering/online/carousel-panel', () => ({ CarouselPanel: Widget, CarouselHoldingSlot: Widget, readHeldCarouselUnits: () => [] }));
    vi.doMock('../src/rendering/online/battle-summary', () => ({ BattleSummaryPanel: Widget }));
    vi.doMock('../src/rendering/online/economy-hint', () => ({ EconomyHint: Widget }));
    vi.doMock('../src/rendering/online/left-panel-toggle', () => ({ LeftPanelToggle: Widget }));
    vi.doMock('../src/rendering/online/sound', () => ({ OnlineSound: Widget }));
    vi.doMock('../src/rendering/online/ranking', () => ({ RankingOverlay: Widget, EliminationCard: Widget }));
    vi.doMock('../src/rendering/online/battle-outcome', () => ({ BattleOutcome: Widget }));
    vi.doMock('../src/presentation/hover-card', () => ({ traitHoverCard: () => ({}) }));
    vi.doMock('../src/presentation/unit-card', () => ({ attachUnitCards: () => () => {} }));
    vi.doMock('../src/presentation/item-codex', async importOriginal => ({
      ...await importOriginal<typeof import('../src/presentation/item-codex')>(), attachItemPopover: () => () => {},
    }));
    vi.doMock('../src/rendering/trait-column', async importOriginal => ({
      ...await importOriginal<typeof import('../src/rendering/trait-column')>(), attachTraitCards: () => () => {},
    }));
  });
  afterEach(() => {
    app?.dispose(); app = undefined; off?.(); off = undefined;
    vi.unstubAllGlobals();
    for (const name of mocked) vi.doUnmock(`../src/rendering/online/${name}`);
    for (const name of ['hover-card', 'unit-card', 'item-codex']) vi.doUnmock(`../src/presentation/${name}`);
    vi.doUnmock('../src/rendering/trait-column'); vi.resetModules();
  });
  const nodes = (node: Node): Node[] => [node, ...node.children.flatMap(nodes)];
  const select = (seatId: string) => {
    const minimap = nodes(root).find(node => node.dataset.debug === 'online:minimap')!;
    const button = minimap.children.find(node => node.dataset.seat === seatId)!;
    expect(button).toBeDefined(); button.click();
  };
  const view: PlayerView = { mySeatId: 'me', opponentSeatId: null, ranking: null, fault: null,
    phase: { kind: 'preparation', round: 2, roundName: '1-2', serverNow: 0, endsAt: 30000 },
    seats: ['me', 'other'].map(seatId => ({ seatId, name: seatId, kind: 'human', connected: true, controller: 'human',
      rank: null, alive: true, hp: 100, level: 1, publicBoard: { units: [] } })) };

  async function mount() {
    const { OnlineApplication } = await import('../src/rendering/online/online-application');
    const client = { transport: 'websocket', listen(next: ClientListeners) { listeners = next; return () => {}; }, dispose() {} } as unknown as GameClient;
    const session = { state: { phase: 'preparation', preparation: { board: { columns: 7, rows: 8, deploymentZones: { player: { firstRow: 4, lastRow: 7 } } } } },
      pause() {}, resume() {}, subscribe: () => () => {}, dispose() {} } as unknown as RemoteSession;
    app = new OnlineApplication(session, client, { refresh() {}, clearInput() {}, status() {} },
      { shopDock: shop, countdown: new Node() } as unknown as OnlineBoardMounts);
    listeners.view(view);
    expect(app.debug().mode).toBe('active');
    expect(shop.inert).toBe(false);
  }

  it('makes the shop inert for a 3D scout, and restores it via my avatar or the panel close button', async () => {
    const { subscribeBoardFeed } = await import('../src/rendering/board-feed');
    const shown: (string | null)[] = [];
    off = subscribeBoardFeed({ frame() {}, events() {}, scout: value => shown.push(value?.seatId ?? null) });
    await mount();
    select('other');
    expect(shown.at(-1)).toBe('other'); expect(shop.inert).toBe(true);
    listeners.view(view); // a server refresh must not restore the shop while still scouting
    expect(shop.inert).toBe(true);
    select('me');
    expect(shown.at(-1)).toBeNull(); expect(shop.inert).toBe(false);
    select('other'); expect(shop.inert).toBe(true);
    nodes(root).find(node => node.dataset.debug === 'online:opponent-close')!.click();
    expect(shown.at(-1)).toBeNull(); expect(shop.inert).toBe(false);
  });

  it('keeps the shop usable for a 2D scout and restores it when the 3D layer detaches', async () => {
    const { subscribeBoardFeed } = await import('../src/rendering/board-feed');
    await mount();
    select('other'); expect(shop.inert).toBe(false);
    off = subscribeBoardFeed({ frame() {}, events() {}, scout() {} });
    app!.frame(0); expect(shop.inert).toBe(true);
    off(); off = undefined;
    app!.frame(0); expect(shop.inert).toBe(false);
  });
});
