import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMatch } from '../../src/simulation/match';
import type { MatchState } from '../../src/simulation/match-types';
import type { Unit, UnitLocation } from '../../src/simulation/units';
import type { BoardControls } from '../../src/rendering/board-feed';
import { RemoteSession } from '../../src/rendering/online/remote-session';
import { MatchSession } from '../../src/rendering/match-session';
import type { GameClient } from '../../src/rendering/online/protocol';
import { ANOMALY_BOARD_LOCKED, ANOMALY_SELL_BLOCKED } from '../../src/rendering/strategy-panel';

vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown' } } } }));
vi.mock('../../src/presentation/unit-view', () => ({ UnitView: class {
  token: Token;
  constructor(_scene: unknown, unit: Unit) { this.token = new Token(unit.id); }
  update() {} setAnomalies() {} setOverflow() {} resetMeters() {}
} }));
import { BoardScene } from '../../src/rendering/BoardScene';

class Token {
  input = { enabled: true, draggable: false };
  data = new Map<string, unknown>();
  handlers = new Map<string, () => void>();
  name = '';
  constructor(readonly id: string) { this.data.set('unitId', id); }
  getData(key: string) { return this.data.get(key); }
  setData(key: string, value: unknown) { this.data.set(key, value); return this; }
  setPosition() { return this; } setScale() { return this; } setDepth() { return this; }
  setVisible() { return this; } setAlpha() { return this; }
  setInteractive() { this.input.enabled = true; return this; }
  disableInteractive() { this.input.enabled = false; return this; }
  on(type: string, fn: () => void) { this.handlers.set(type, fn); return this; }
  click() { if (this.input.enabled) this.handlers.get('pointerdown')?.(); }
}
type Pointer = { id: number; wasCanceled?: boolean; positionToCamera(): { x: number; y: number } };
interface SceneBridge {
  session: RemoteSession | MatchSession;
  selectedId: string | null;
  draggingId: string | null;
  tokens: Map<string, Token>;
  sync(): void;
  syncAfterDrag(): void;
  command: ReturnType<typeof vi.fn>;
  setStatus: ReturnType<typeof vi.fn>;
  target: ReturnType<typeof vi.fn>;
  installDragHandlers(): void;
  installKeyboardHandlers(): void;
  boardControls(): BoardControls;
  syncChoiceInputs(): void;
  canDrag(unit: Unit): boolean;
  deploy(id: string, location: UnitLocation): void;
  sell(id: string): void;
  benchBoardSwap(id: string): void;
}
const sessions: (RemoteSession | MatchSession)[] = [];
afterEach(() => { sessions.splice(0).forEach(session => session.dispose()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function setup(phase: 'preparation' | 'choice' = 'choice') {
  const base = createMatch(42), original = base.preparation.units.find(unit => unit.team === 'player')!;
  const state: MatchState = { ...base, phase, combat: null, level: 5,
    preparation: { ...base.preparation, units: [
      { ...original, id: 'board', location: { kind: 'board', cell: { col: 0, row: 4 } } },
      { ...original, id: 'bench', location: { kind: 'bench', slot: 0 } },
    ] },
    pendingChoice: { kind: 'anomaly', step: 'offer', choiceId: 'anomaly', eventId: 'anomaly', generation: 1,
      offers: ['the-finisher'], targetId: 'board', rerollCount: 0, returnPhase: 'preparation' } };
  let commandId = 0, hidden = false, overShop = false;
  const shop = { dataset: {} as Record<string, string> };
  const handlers = new Map<string, (pointer: Pointer, token: Token) => void>();
  const native = new Map<string, Set<(event: never) => void>>();
  vi.stubGlobal('window', {
    location: { search: '?mode=online' },
    addEventListener(type: string, fn: (event: never) => void) { if (!native.has(type)) native.set(type, new Set()); native.get(type)!.add(fn); },
    removeEventListener(type: string, fn: (event: never) => void) { native.get(type)?.delete(fn); },
  });
  vi.stubGlobal('HTMLElement', class {});
  vi.stubGlobal('document', { body: { dataset: { online: 'websocket' } }, getElementById: () => null,
    elementFromPoint: () => overShop ? { closest: () => shop } : null });
  const send = vi.fn(() => ({ ok: 'pending', commandId: ++commandId } as const));
  const session = new RemoteSession({ send } as unknown as GameClient, state); sessions.push(session);
  const scene = new BoardScene() as unknown as SceneBridge;
  scene.session.dispose();
  const setDraggable = vi.fn((token: Token, draggable: boolean) => { token.input.draggable = draggable; });
  const graphic = { clear: vi.fn(), fillStyle() {}, fillPoints() {}, fillRoundedRect() {}, lineStyle() {}, strokePoints() {}, strokeRoundedRect() {} };
  Object.assign(scene, { session, online: true, selectedId: 'board',
    strategyPanel: { get blocksBoard() { return !hidden && scene.session.state.pendingChoice?.kind === 'anomaly'; }, render: vi.fn(), cancel: vi.fn(), refreshBench: vi.fn() },
    input: { on: (name: string, fn: (pointer: Pointer, token: Token) => void) => handlers.set(name, fn), setDraggable,
      manager: { pointers: [] }, setDragState: vi.fn() },
    cameras: { main: {} }, tweens: { killTweensOf: vi.fn(), killAll: vi.fn() }, events: { once: vi.fn() }, scene: { isActive: () => true },
    sync: vi.fn(), syncAfterDrag: vi.fn(), syncSelection: vi.fn(), command: vi.fn(), setStatus: vi.fn(),
    target: vi.fn(() => ({ kind: 'board', cell: { col: 1, row: 4 } })), overlay: graphic, dropZones: graphic,
  });
  for (const unit of state.preparation.units) scene.tokens.set(unit.id, new Token(unit.id));
  scene.installDragHandlers(); scene.installKeyboardHandlers();
  const controls = scene.boardControls(), pointer: Pointer & { event: { clientX: number; clientY: number } } = {
    id: 1, event: { clientX: 1, clientY: 4 }, positionToCamera: () => ({ x: 1, y: 4 }),
  };
  const emit = (type: string, event: object) => native.get(type)?.forEach(fn => fn(event as never));
  const toggle = (value: boolean) => { hidden = value; scene.syncChoiceInputs(); };
  return { scene, state, session, send, controls, handlers, pointer, setDraggable, shop, toggle, emit,
    overShop: () => { overShop = true; },
    start: (mode: '2d' | '3d', id: string) => mode === '2d' ? handlers.get('dragstart')!(pointer, scene.tokens.get(id)!) : controls.dragStart(id),
    end: (mode: '2d' | '3d', id: string) => mode === '2d' ? handlers.get('dragend')!(pointer, scene.tokens.get(id)!) : controls.dragEnd({ x: 1, y: 4 }, { x: 1, y: 4 }),
  };
}

describe('anomaly board input shared by 2D and 3D', () => {
  it.each(['board', 'bench'])('solo choice/%s: real sync restores selectable, draggable tokens after hiding and after each sync', id => {
    const t = setup(), session = new MatchSession(t.state); sessions.push(session);
    Object.assign(t.scene, { session, online: false, syncHud: vi.fn(), syncSoloOpening: vi.fn(), syncOrbs: vi.fn() });
    Reflect.deleteProperty(t.scene, 'sync'); // Exercise the production sync, reconciliation and token creation.
    Reflect.deleteProperty(t.scene, 'syncAfterDrag');
    t.scene.tokens.clear();
    t.scene.sync();
    const token = t.scene.tokens.get(id)!;
    expect(session).toBeInstanceOf(MatchSession); expect(session.phase).toBe('choice');
    expect(token.input).toEqual({ enabled: false, draggable: false });
    t.scene.selectedId = null; token.click(); expect(t.scene.selectedId).toBeNull();
    t.toggle(true);
    expect(token.input).toEqual({ enabled: true, draggable: true });
    token.click(); expect(t.scene.selectedId).toBe(id);
    t.scene.sync(); // A command/refresh must not disable the hidden single-player board again.
    expect(t.scene.tokens.get(id)).toBe(token);
    expect(token.input).toEqual({ enabled: true, draggable: true });
    const deploy = vi.spyOn(session, 'deploy');
    t.start('2d', id); expect(t.scene.draggingId).toBe(id); t.end('2d', id);
    expect(deploy).toHaveBeenCalledExactlyOnceWith(id, { kind: 'board', cell: { col: 1, row: 4 } });
    // R1 accepts this deploy on the real choice state. The scene does not rewrite phase to preparation.
    const moved = deploy.mock.results[0]!.value;
    expect(moved).toMatchObject({ ok: true });
    expect(session.state.preparation.units.find(unit => unit.id === id)?.location).toEqual({ kind: 'board', cell: { col: 1, row: 4 } });
    expect(session.phase).toBe('choice');
    const beforeSell = session.state;
    const sold = session.sell('bench');
    expect(sold).toMatchObject({ ok: false, reason: 'wrong-phase' });
    expect(sold).not.toHaveProperty('events');
    expect(sold.state).toBe(beforeSell);
    expect(session.state).toBe(beforeSell);
    expect(session.state.preparation.units.find(unit => unit.id === 'bench')?.location.kind).toBe(id === 'bench' ? 'board' : 'bench');
    expect(token.input).toEqual({ enabled: true, draggable: true });
    t.toggle(false); t.scene.sync();
    expect(token.input).toEqual({ enabled: false, draggable: false });
    t.scene.selectedId = null; token.click(); expect(t.scene.selectedId).toBeNull();
    t.toggle(true); t.scene.sync();
    expect(token.input).toEqual({ enabled: true, draggable: true });
  });

  it('solo choice keeps preparation summons visible while the anomaly is open and hidden', () => {
    const t = setup(), state: MatchState = { ...t.state, items: [{ id: 'item-1', definitionId: 'TFT5_Item_ZzRotPortalRadiant', location: { kind: 'unit', unitId: 'board', slot: 0 } }] };
    const session = new MatchSession(state); sessions.push(session);
    Object.assign(t.scene, { session, online: false, syncHud: vi.fn(), syncSoloOpening: vi.fn(), syncOrbs: vi.fn() });
    Reflect.deleteProperty(t.scene, 'sync'); t.scene.tokens.clear(); t.scene.sync();
    expect(session.itemSummons).toHaveLength(1);
    const summon = session.itemSummons[0], token = t.scene.tokens.get(summon.unit.id)!;
    expect(token).toBeDefined(); expect(token.input.draggable).toBe(false);
    t.toggle(true); t.scene.sync();
    expect(t.scene.tokens.get(summon.unit.id)).toBe(token);
    expect(token.input).toEqual({ enabled: true, draggable: true });
  });

  for (const phase of ['preparation', 'choice'] as const) for (const mode of ['2d', '3d'] as const) {
    it.each(['board', 'bench'])(`${phase}/${mode}/%s: locks the whole board, unlocks hidden movement and sends the unchanged deploy intent`, id => {
      const t = setup(phase), authority = t.session.state, before = JSON.stringify(t.state), unit = t.state.preparation.units.find(unit => unit.id === id)!;
      expect(t.scene.canDrag(unit)).toBe(false);
      t.start(mode, id); t.end(mode, id);
      t.scene.deploy(id, { kind: 'bench', slot: 1 }); t.scene.benchBoardSwap(id);
      t.emit('keydown', { code: 'KeyW', preventDefault: vi.fn() });
      expect(t.scene.draggingId).toBeNull(); expect(t.send).not.toHaveBeenCalled();
      expect(t.scene.setStatus).toHaveBeenLastCalledWith(ANOMALY_BOARD_LOCKED);
      t.toggle(true);
      expect(t.scene.canDrag(unit)).toBe(true);
      expect([...t.scene.tokens.values()].every(token => token.input.draggable)).toBe(true);
      t.start(mode, id); expect(t.scene.draggingId).toBe(id); t.end(mode, id);
      expect(t.send).toHaveBeenCalledExactlyOnceWith({ type: 'deploy', unitId: id, target: { kind: 'board', cell: { col: 1, row: 4 } } });
      expect(t.scene.draggingId).toBeNull();
      expect(t.session.state).toBe(authority); expect(JSON.stringify(t.session.state)).toBe(before); expect(JSON.stringify(t.state)).toBe(before);
    });
  }

  it.each(['2d', '3d'] as const)('%s: restoring the interface cancels an existing drag and its delayed release', mode => {
    const t = setup(); t.toggle(true); t.start(mode, 'board');
    expect(t.scene.draggingId).toBe('board');
    t.toggle(false);
    expect(t.scene.draggingId).toBeNull(); expect([...t.scene.tokens.values()].every(token => !token.input.draggable)).toBe(true);
    t.end(mode, 'board'); expect(t.send).not.toHaveBeenCalled();
    // Rehiding cannot revive a delayed release from that cancelled gesture.
    t.toggle(true); t.end(mode, 'board'); expect(t.send).not.toHaveBeenCalled();
  });

  it.each(['board', 'bench'])('W/deployment controls work while hidden for %s; sale controls and E stay blocked', id => {
    const t = setup(); t.toggle(true);
    t.scene.selectedId = id; t.emit('keydown', { code: 'KeyW', preventDefault: vi.fn() });
    expect(t.send).toHaveBeenCalledOnce();
    expect(t.send.mock.calls[0]).toEqual([{ type: 'deploy', unitId: id, target: expect.objectContaining({ kind: id === 'board' ? 'bench' : 'board' }) }]);
    t.scene.deploy(id, { kind: 'bench', slot: 2 });
    expect(t.send).toHaveBeenLastCalledWith({ type: 'deploy', unitId: id, target: { kind: 'bench', slot: 2 } });
    t.send.mockClear(); t.scene.sell(id);
    t.emit('keydown', { code: 'KeyE', preventDefault: vi.fn() });
    expect(t.send).not.toHaveBeenCalled(); expect(t.scene.setStatus).toHaveBeenLastCalledWith(ANOMALY_SELL_BLOCKED);
  });

  it.each(['2d', '3d'] as const)('%s: dragging to the shop while hidden shows a refusal and sends no sale', mode => {
    const t = setup(); t.toggle(true); t.start(mode, 'bench'); t.overShop();
    t.emit('pointermove', { clientX: 1, clientY: 4 });
    expect(t.shop.dataset.sellHint).toBe(ANOMALY_SELL_BLOCKED);
    t.end(mode, 'bench');
    expect(t.send).not.toHaveBeenCalled(); expect(t.scene.setStatus).toHaveBeenLastCalledWith(ANOMALY_SELL_BLOCKED);
    expect(t.shop.dataset.sellHint).toBeUndefined();
  });

  it('disables the sale button and price hint until the authority resolves the choice, including while hidden', () => {
    const t = setup(), selection = { text: '', setText(value: string) { this.text = value; } };
    const sale = { ...selection, input: { enabled: true }, setAlpha: vi.fn() };
    Object.assign(t.scene, { selectionLabel: selection, sellButton: sale, hoveredId: () => undefined });
    const syncSelection = (BoardScene.prototype as unknown as { syncSelection(): void }).syncSelection;
    for (const hidden of [false, true]) {
      t.toggle(hidden); syncSelection.call(t.scene);
      expect(sale.input.enabled).toBe(false); expect(sale.text).toBe('E · 异变待选（禁售）');
      expect(selection.text).toContain(ANOMALY_SELL_BLOCKED);
    }
    t.session.receiveState({ ...t.state, phase: 'preparation', combat: null, pendingChoice: null });
    syncSelection.call(t.scene);
    expect(sale.input.enabled).toBe(true); expect(sale.text).toContain('E · 出售 · +');
    expect(selection.text).toContain('E 售出 +');
  });

  it('offers hide and restore targets of at least 44px in the shared stylesheet', () => {
    const css = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.choice-collapse, \.choice-reopen\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/);
  });
});
