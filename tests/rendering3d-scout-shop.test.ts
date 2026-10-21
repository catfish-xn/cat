import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientListeners, GameClient, PlayerView, WireCommand } from '../src/rendering/online/protocol';
import type { RemoteSession } from '../src/rendering/online/remote-session';
import type { OnlineApplication } from '../src/rendering/online/online-application';
import type { OnlineBoardMounts } from '../src/rendering/app-shell';
import type { CombatReplay } from '../src/server-entry';

/** Minimal DOM, with real minimap clicks and real OpponentBoardPanel open/close behavior. */
class Node {
  children: Node[] = []; dataset: Record<string, string> = {}; className = ''; hidden = false; inert = false;
  textContent = ''; id = ''; style = { setProperty() {} }; classList = { add() {}, remove() {}, toggle() {} };
  private attributes = new Set<string>();
  private listeners = new Map<string, () => void>();
  append(...nodes: Node[]) { this.children.push(...nodes); }
  prepend(...nodes: Node[]) { this.children.unshift(...nodes); }
  replaceChildren(...nodes: Node[]) { this.children = nodes; }
  insertAdjacentHTML() {} // portraits and trait icons are passive in this DOM double
  setAttribute(name: string) { this.attributes.add(name); }
  hasAttribute(name: string) { return this.attributes.has(name); }
  toggleAttribute(name: string, on: boolean) { if (on) this.attributes.add(name); else this.attributes.delete(name); }
  addEventListener(type: string, callback: () => void) { this.listeners.set(type, callback); }
  removeEventListener(type: string) { this.listeners.delete(type); }
  click() { this.listeners.get('click')?.(); }
  querySelector() { return null; }
  closest(_selector?: string): Node | null { return null; }
  isContentEditable = false;
  remove() {}
}

describe('3D scouting shop availability', () => {
  let app: OnlineApplication | undefined, root: Node, shop: Node, listeners: ClientListeners, off: (() => void) | undefined;
  let shutdown: (() => void) | undefined;
  const sceneMocks = ['phaser', '../src/rendering/online/mode', '../src/rendering/app-shell',
    '../src/rendering/strategy-panel', '../src/presentation/help-panel', '../src/presentation/s13-assets',
    '../src/presentation/unit-view', '../src/stats/stats-panel', '../src/stats/combat-feedback-renderer',
    '../src/rendering/online/orb-dock', '../src/rendering/online/online-application'];
  const mocked = ['lobby', 'players-sidebar', 'carousel-panel', 'battle-summary', 'economy-hint', 'left-panel-toggle', 'sound', 'ranking', 'battle-outcome'];
  beforeEach(() => {
    vi.resetModules(); root = new Node(); shop = new Node();
    const body = new Node();
    const stats = new Node();
    vi.stubGlobal('document', { body, hidden: false, createElement: () => new Node(), getElementById: (id: string) => id === 'app' ? root : id === 'shop-dock' ? shop : id === 'stats-root' ? stats : null,
      querySelector: () => null, addEventListener() {}, removeEventListener() {} });
    // Unrelated HUD widgets are passive: keep the application, minimap, scout panel and board-feed real.
    class Widget {
      root = new Node(); showing = false; isCollapsed = false; isMuted = true; played: string[] = [];
      render() {} live() {} show() {} hide() {} dispose() {} setViewing() {} connection() {} tick() {} secondsLeft() { return null; }
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
    shutdown?.(); shutdown = undefined;
    app?.dispose(); app = undefined; off?.(); off = undefined;
    vi.unstubAllGlobals();
    for (const name of mocked) vi.doUnmock(`../src/rendering/online/${name}`);
    for (const name of ['hover-card', 'unit-card', 'item-codex']) vi.doUnmock(`../src/presentation/${name}`);
    vi.doUnmock('../src/rendering/trait-column');
    for (const name of sceneMocks) vi.doUnmock(name);
    vi.restoreAllMocks(); vi.resetModules();
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
      watchedSeat: null, stopWatching() {}, pause() {}, resume() {}, subscribe: () => () => {}, dispose() {} } as unknown as RemoteSession;
    app = new OnlineApplication(session, client, { refresh() {}, clearInput() {}, status() {} },
      { shopDock: shop, countdown: new Node() } as unknown as OnlineBoardMounts);
    listeners.view(view);
    expect(app.debug().mode).toBe('active');
    expect(shop.inert).toBe(false);
  }

  /** Public create + native event boundary; only graphics and unrelated DOM widgets are substituted.
   * The real OnlineApplication, RemoteSession and BoardScene choose whether any intent reaches send.
   * No private scene fields/methods are accessed, and no server or asset requests are made.
   */
  async function mountKeyboard(assetRoot?: string | null) {
    const { createMatch } = await import('../src/simulation/match');
    const { createCombat } = await import('../src/simulation/combat');
    const { toCombatViewState } = await import('../src/simulation/combat-replay-view');
    const initial = { ...createMatch(42), gold: 50 };
    const replayFor = (prefix: string): CombatReplay => {
      const view = toCombatViewState(createCombat(initial.preparation));
      const opening = { ...view, combatId: prefix, units: view.units.map(unit => ({ ...unit, id: `${prefix}:${unit.id}` })) };
      const terminal = { ...opening, tick: 1, status: 'finished' as const, result: 'playerWin' as const };
      return { initial: opening, ticks: [{ tick: 1, events: [], keyframe: terminal }], terminal };
    };
    let commandId = 0;
    const send = vi.fn<GameClient['send']>(() => ({ ok: 'pending', commandId: ++commandId }));
    const watch = vi.fn();
    const client = { transport: 'websocket', send, watch, listen(next: ClientListeners) { listeners = next; return () => {}; }, dispose() {} } as unknown as GameClient;
    const keyEvents = new EventTarget();
    const stops: (() => void)[] = [];
    const idleCallbacks: (() => void)[] = [];
    const portraitPreload = vi.fn();
    vi.stubGlobal('HTMLElement', Node);
    vi.stubGlobal('window', { addEventListener: keyEvents.addEventListener.bind(keyEvents),
      removeEventListener: keyEvents.removeEventListener.bind(keyEvents),
      location: { search: assetRoot ? `?assets3d=${encodeURIComponent(assetRoot)}` : '', href: 'https://page.invalid/synthetic/' },
      requestIdleCallback(callback: () => void) { idleCallbacks.push(callback); } });
    vi.stubGlobal('fetch', vi.fn(() => {
      if (assetRoot === undefined) throw Error('unexpected network request');
      return new Promise<Response>(() => {}); // Synthetic hung request; never touches the network.
    }));

    // Chainable Phaser drawing doubles. They never decide input availability or issue commands.
    class Drawing {
      name = ''; visible = true; active = true; scaleX = 1; scaleY = 1;
      input = { enabled: true }; private data = new Map<string, unknown>();
      constructor(public x = 0, public y = 0) {}
      setName(value: string) { this.name = value; return this; }
      setData(key: string, value: unknown) { this.data.set(key, value); return this; }
      getData(key: string) { return this.data.get(key); }
      setVisible(value: boolean) { this.visible = value; return this; }
      setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
      setInteractive() { this.input.enabled = true; return this; }
      disableInteractive() { this.input.enabled = false; return this; }
      setText() { return this; } setAlpha() { return this; } setScale() { return this; }
      setDepth() { return this; } setOrigin() { return this; } setBackgroundColor() { return this; }
      on() { return this; } clear() { return this; } fillStyle() { return this; } lineStyle() { return this; }
      fillPoints() { return this; } strokePoints() { return this; } strokeRect() { return this; }
      fillRoundedRect() { return this; } strokeRoundedRect() { return this; } destroy() {}
    }
    class Scene {
      children = { length: 0, list: [] as Drawing[] };
      add = { text: (x: number, y: number) => { const node = new Drawing(x, y); this.children.list.push(node); return node; }, graphics: () => new Drawing() };
      input = { on() {}, setDraggable() {}, setDragState() {}, manager: { pointers: [] } };
      events = { once: (_event: string, callback: () => void) => stops.push(callback) };
      scene = { isActive: () => true }; tweens = { killAll() {}, killTweensOf() {} };
      sys = { isActive: () => true };
    }
    vi.doMock('phaser', () => ({ default: { Scene, Scenes: { Events: { SHUTDOWN: 'shutdown' } } } }));
    vi.doMock('../src/rendering/online/mode', () => ({ isOnlineMode: () => true, createGameClient: () => client }));
    vi.doMock('../src/rendering/app-shell', () => ({ mountOnlineBoardFrame: () => ({ shopDock: shop, countdown: new Node(), orbDock: new Node() }) }));
    let selectUnit: (id: string) => void;
    vi.doMock('../src/rendering/strategy-panel', () => ({ StrategyPanel: class {
      blocksSell = false;
      constructor(actions: { selectUnit: (id: string) => void }) { selectUnit = actions.selectUnit; }
      render() {} reset() {} cancel() {} destroy() {} status() {}
    } }));
    vi.doMock('../src/presentation/help-panel', () => ({ HelpPanel: class { open = false; destroy() {} } }));
    vi.doMock('../src/presentation/s13-assets', async importOriginal => ({
      ...await importOriginal<typeof import('../src/presentation/s13-assets')>(),
      buildPortraitTextures() {}, loadS13Portraits: portraitPreload, s13AssetUrl: () => '',
      heroPortraitHtml: () => '', s13IconHtml: () => '',
      loadRootUiAssets: assetRoot === undefined ? async () => {} : (await importOriginal<typeof import('../src/presentation/s13-assets')>()).loadRootUiAssets,
    }));
    const drawn = new Set<string>();
    vi.doMock('../src/presentation/unit-view', () => ({ UnitView: class {
      token: Drawing;
      constructor(_scene: unknown, private unit: { id: string }, x: number, y: number) {
        drawn.add(unit.id); this.token = new Drawing(x, y).setName(`unit:${unit.id}`).setData('unitId', unit.id);
      }
      update() {} setRing() {} resetMeters() {} drawCombat() {} destroy() { drawn.delete(this.unit.id); }
    } }));
    vi.doMock('../src/stats/stats-panel', () => ({ createStatsPanel: () => ({ render() {}, dispose() {} }) }));
    vi.doMock('../src/stats/combat-feedback-renderer', () => ({ createCombatFeedbackRenderer: () => ({ reset() {}, dispose() {} }) }));
    vi.doMock('../src/rendering/online/orb-dock', async importOriginal => ({
      ...await importOriginal<typeof import('../src/rendering/online/orb-dock')>(), OrbDock: class { render() {} reset() {} },
    }));
    // Capture the public session passed by create; do not replace any application behavior.
    let session: RemoteSession;
    vi.doMock('../src/rendering/online/online-application', async importOriginal => {
      const original = await importOriginal<typeof import('../src/rendering/online/online-application')>();
      return { ...original, OnlineApplication: class extends original.OnlineApplication {
        constructor(...args: ConstructorParameters<typeof original.OnlineApplication>) {
          super(...args); app = this; session = args[0];
        }
      } };
    });
    const { BoardScene } = await import('../src/rendering/BoardScene');
    const scene = new BoardScene();
    scene.create();
    shutdown = () => { for (const stop of stops) stop(); };
    listeners.state(initial);
    const unit = initial.preparation.units.find(unit => unit.team === 'player')!;
    expect(unit).toBeDefined();
    const press = (target: Node = new Node()) => {
      selectUnit!(unit.id); // the same public callback the strategy panel invokes
      for (const code of ['KeyD', 'KeyF', 'KeyW', 'KeyE']) {
        const event = new Event('keydown', { cancelable: true });
        Object.defineProperties(event, { code: { value: code }, target: { value: target } });
        keyEvents.dispatchEvent(event);
      }
    };
    const expectBlocked = () => {
      expect(shop.inert).toBe(true);
      const before = session!.state;
      press();
      expect(send).not.toHaveBeenCalled(); // includes buy, shopLock and all other wire commands
      expect(session!.state).toBe(before);
      expect(session!.state.gold).toBe(50);
    };
    const expectEnabled = () => {
      expect(shop.inert).toBe(false);
      press();
      expect(send.mock.calls.map(([command]) => command.type)).toEqual(['reroll', 'buyXp', 'deploy', 'sell']);
      for (const type of ['reroll', 'buyXp', 'deploy', 'sell'] as WireCommand['type'][])
        expect(send.mock.calls.filter(([command]) => command.type === type)).toHaveLength(1);
      send.mockClear();
    };
    return { press, send, watch, session: session!, replayFor, drawn, initial, expectBlocked, expectEnabled,
      loadIdlePortraits: () => { for (const callback of idleCallbacks) callback(); }, portraitPreload };
  }

  it.each([null, 'https://ui-assets.invalid/synthetic/root/'])('starts and accepts controls while optional portraits load (root %s)', async assetRoot => {
    const keyboard = await mountKeyboard(assetRoot);
    expect(app!.debug().mode).toBe('online-lobby');
    expect(keyboard.loadIdlePortraits).not.toThrow();
    await Promise.resolve();
    if (assetRoot) {
      expect(fetch).toHaveBeenCalledOnce();
      expect(vi.mocked(fetch).mock.calls[0][0]).toBe(`${assetRoot}ui-assets.json`);
      expect(keyboard.portraitPreload).not.toHaveBeenCalled();
    } else {
      expect(fetch).not.toHaveBeenCalled();
      expect(keyboard.portraitPreload).toHaveBeenCalledOnce();
    }
    listeners.view(view);
    expect(app!.debug().mode).toBe('active');
    keyboard.expectEnabled();
  }, 20_000);

  it('blocks all D/F/W/E intents and preserves gold while scouting, then restores each shortcut once', async () => {
    const { subscribeBoardFeed } = await import('../src/rendering/board-feed');
    off = subscribeBoardFeed({ frame() {}, events() {}, scout() {} });
    const keyboard = await mountKeyboard();
    listeners.view(view);
    keyboard.expectEnabled(); // positive control: W and E have a valid own-unit target
    select('other'); keyboard.expectBlocked();
    listeners.view(view); keyboard.expectBlocked();
    select('me'); keyboard.expectEnabled();
    select('other'); keyboard.expectBlocked();
    nodes(root).find(node => node.dataset.debug === 'online:opponent-close')!.click();
    keyboard.expectEnabled();
  }, 20_000);

  it('blocks D/F/W/E outside a match and after match end, restoring them when play starts', async () => {
    const keyboard = await mountKeyboard();
    expect(app!.debug().mode).toBe('online-lobby'); keyboard.expectBlocked();
    listeners.view(view); keyboard.expectEnabled();
    listeners.view({ ...view, phase: { ...view.phase, kind: 'ended' } });
    expect(app!.debug().mode).toBe('online-ended'); keyboard.expectBlocked();
  }, 20_000);

  it('keeps editable targets exempt when the shop is enabled', async () => {
    const keyboard = await mountKeyboard();
    listeners.view(view);
    for (const tag of ['input', 'textarea', 'select']) {
      const target = new Node();
      vi.spyOn(target, 'closest').mockImplementation(selector => selector === 'input, textarea, select' ? target : null);
      keyboard.press(target);
      expect(keyboard.send, tag).not.toHaveBeenCalled();
    }
    const editable = new Node(); editable.isContentEditable = true;
    keyboard.press(editable); expect(keyboard.send).not.toHaveBeenCalled();
    keyboard.expectEnabled();
  }, 20_000);

  it('keeps the scouted seat and shortcuts blocked through choice/carousel/combat until the panel closes', async () => {
    const { subscribeBoardFeed } = await import('../src/rendering/board-feed');
    off = subscribeBoardFeed({ frame() {}, events() {}, scout() {} });
    const keyboard = await mountKeyboard();
    listeners.view(view);
    select('other'); keyboard.expectBlocked();
    for (const kind of ['choice', 'carousel'] as const) {
      listeners.view({ ...view, phase: { ...view.phase, kind } });
      expect(app!.debug().viewingSeatId).toBe('other');
      keyboard.expectBlocked();
    }
    listeners.view({ ...view, phase: { ...view.phase, kind: 'combat' } });
    expect(app!.debug().viewingSeatId).toBe('other');
    keyboard.expectBlocked();
    nodes(root).find(node => node.dataset.debug === 'online:opponent-close')!.click();
    expect(app!.debug().viewingSeatId).toBeNull();
    keyboard.expectEnabled();
  }, 20_000);

  it.each(['own battle', 'no own replay', 'eliminated'] as const)('continues scouting into combat and rebuilds BoardScene tokens on return: %s', async situation => {
    const { subscribeBoardFeed } = await import('../src/rendering/board-feed');
    const shown: (string | null)[] = [];
    off = subscribeBoardFeed({ frame() {}, events() {}, scout: value => shown.push(value?.watching ? value.seatId : null) });
    const keyboard = await mountKeyboard();
    const currentView = situation === 'eliminated' ? { ...view, seats: view.seats.map(seat => seat.seatId === 'me' ? { ...seat, alive: false, rank: 8, hp: 0 } : seat) } : view;
    listeners.view(currentView);
    select('other');
    expect(keyboard.watch).toHaveBeenLastCalledWith(null);
    listeners.view({ ...currentView, phase: { ...currentView.phase, kind: 'combat' } });
    expect(app!.debug().viewingSeatId).toBe('other');
    expect(keyboard.watch).toHaveBeenLastCalledWith('other');
    if (situation === 'own battle') listeners.replay(keyboard.replayFor('own'));
    const home = new Set(keyboard.drawn), before = keyboard.session.state;
    const other = keyboard.replayFor('other');
    expect(other.initial.units.length).toBeGreaterThan(0);
    expect(() => listeners.watched!('other', other)).not.toThrow();
    expect(keyboard.session.state).not.toBe(before);
    expect(keyboard.session.phase).toBe('combat');
    expect(keyboard.session.spectating).toBe(situation === 'eliminated');
    expect(shown.at(-1)).toBe('other');
    expect(keyboard.drawn).toEqual(new Set(other.initial.units.map(unit => unit.id)));
    keyboard.expectBlocked();
    keyboard.session.advanceDisplay(400); // includes my battle's opening hold, when one is present
    expect(keyboard.session.combatView).toEqual(other.terminal);
    const watching = keyboard.session.state;
    // Uses the real syncScout -> refresh -> reconcileTokens -> sync/syncCombat path.
    expect(() => nodes(root).find(node => node.dataset.debug === 'online:opponent-close')!.click()).not.toThrow();
    expect(keyboard.session.state).not.toBe(watching);
    expect(keyboard.session.watchedSeat).toBeNull();
    expect(keyboard.drawn).toEqual(home);
    expect(keyboard.watch).toHaveBeenLastCalledWith(null);
    expect(shown.at(-1)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  }, 20_000);

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
    const keyboard = await mountKeyboard();
    listeners.view(view);
    select('other'); keyboard.expectEnabled();
    off = subscribeBoardFeed({ frame() {}, events() {}, scout() {} });
    app!.frame(0); keyboard.expectBlocked();
    off(); off = undefined;
    app!.frame(0); keyboard.expectEnabled();
  }, 20_000);

  function warmView(): PlayerView {
    return { ...view, opponentSeatId: 'other', seats: ['me', 'other', 'scout'].map(seatId => ({ ...view.seats[0], seatId, name: seatId,
      publicBoard: { units: [
        { definitionId: ({ me: 'powder', other: 'lux', scout: 'garen' }[seatId]!), starLevel: 1, cell: { col: 0, row: 4 }, items: [] },
        { definitionId: 'amumu', starLevel: 1, cell: { col: 1, row: 4 }, items: [] },
        { definitionId: 'summoned', starLevel: 1, cell: { col: 2, row: 4 }, items: [], summon: true as const },
      ], bench: [{ definitionId: `${seatId}-bench`, starLevel: 1, slot: 0, items: [] }] } })) };
  }

  it('orders own available shop, published opponent board, then scout board; excludes benches and summons and clears on leave', async () => {
    const board = await import('../src/rendering/board-feed');
    const keyboard = await mountKeyboard(), published = warmView();
    listeners.state({ ...keyboard.initial, shop: { generation: 3, slots: [
      { status: 'available', definitionId: 'ziggs' }, { status: 'purchased' }, { status: 'available', definitionId: 'amumu' },
      { status: 'purchased' }, { status: 'purchased' },
    ] } });
    listeners.view(published); select('scout');
    listeners.view(published); // a push refreshes hints for the open seat
    const hints = board.boardFeed.warmHints!();
    expect(hints.ids).toEqual(['ziggs', 'amumu', 'lux', 'garen']);
    listeners.view(published); expect(board.boardFeed.warmHints!()).toBe(hints);
    // The client only follows the public pairing field; it must not guess an opponent from candidates.
    listeners.view({ ...published, opponentSeatId: null, opponentCandidates: ['other'] });
    expect(board.boardFeed.warmHints!().ids).toEqual(['ziggs', 'amumu', 'garen']);
    listeners.connection!({ kind: 'seat-lost' });
    expect(app!.debug().mode).toBe('online-lobby'); expect(board.boardFeed.warmHints!().ids).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  }, 20_000);

  it.each(['open', 'close'] as const)('refreshes hints immediately on scout %s without a server push', async action => {
    const board = await import('../src/rendering/board-feed');
    const keyboard = await mountKeyboard();
    listeners.state({ ...keyboard.initial, shop: { generation: 3, slots: Array.from({ length: 5 }, () => ({ status: 'purchased' as const })) } });
    listeners.view(warmView()); select('scout');
    if (action === 'close') { listeners.view(warmView()); select('scout'); }
    expect(board.boardFeed.warmHints!().ids).toEqual(action === 'open' ? ['lux', 'amumu', 'garen'] : ['lux', 'amumu']);
  }, 20_000);
});
