import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareMatchLoot } from '../../src/simulation/loot-runtime';
import { freezeOrbLayoutThroughRound } from '../../src/simulation/orb-layout';
import { getMultiplayerRoundByOrdinal } from '../../src/simulation/multiplayer-round';
import type { MatchFailure, MatchState } from '../../src/simulation/match-types';
import type { RoomState, SeatCommand } from '../../src/server/room/types';
import { PER_ROUND_PREPARATION, type Room } from '../../src/server/room/room';
import { makeRoom } from '../server/helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { toSeatPrivateView } from '../../src/server/room/projection';
import { ManualClock } from '../../src/server/room/clock';
import { LOCAL_ROOM_DEFAULTS, LocalRoomClient } from '../../src/rendering/online/local-room-client';
import { toDisplayMatch } from '../../src/rendering/online/seat-view-adapter';
import type { ClientSendResult, GameClient, WireCommand } from '../../src/rendering/online/protocol';
import { RemoteSession } from '../../src/rendering/online/remote-session';
import type { Unit } from '../../src/simulation/units';
import { ANOMALY_SELL_BLOCKED } from '../../src/rendering/strategy-panel';

vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown' } } } }));
import { BoardScene } from '../../src/rendering/BoardScene';

class Token {
  input = { enabled: true, draggable: false };
  data = new Map<string, unknown>();
  handlers = new Map<string, () => void>();
  constructor(readonly id: string) { this.data.set('unitId', id); }
  getData(key: string) { return this.data.get(key); }
  setData(key: string, value: unknown) { this.data.set(key, value); return this; }
  setPosition() { return this; } setScale() { return this; } setDepth() { return this; }
  setVisible() { return this; } setAlpha() { return this; }
  setInteractive() { this.input.enabled = true; return this; }
  disableInteractive() { this.input.enabled = false; return this; }
  on(type: string, fn: () => void) { this.handlers.set(type, fn); return this; }
}
type Pointer = { id: number; wasCanceled?: boolean; positionToCamera(): { x: number; y: number } };
interface SceneBridge {
  session: RemoteSession;
  selectedId: string | null;
  draggingId: string | null;
  tokens: Map<string, Token>;
  setStatus: ReturnType<typeof vi.fn>;
  installDragHandlers(): void;
  installKeyboardHandlers(): void;
  syncChoiceInputs(): void;
  boardControls(): {
    dragStart(id: string): boolean;
    dragEnd(point: { x: number; y: number }, client: { x: number; y: number }): void;
  };
  sell(id: string): void;
}

function stageAnomaly(room: Room): void {
  const seam = room as unknown as { current: RoomState; clearTimer(): void; enterRound(): void };
  seam.clearTimer();
  const round = getMultiplayerRoundByOrdinal(23);
  const frozen = freezeOrbLayoutThroughRound(room.state.pool.orbLayout, 23);
  if (!frozen.ok) throw new Error(frozen.reason);
  seam.current = { ...room.state, pool: { ...room.state.pool, naturalRound: 23, orbLayout: frozen.layout },
    seats: room.state.seats.map(seat => ({ ...seat, match: { ...seat.match, round: 23, roundDefinitionId: '4-6', gold: 20,
      phase: 'choice' as const,
      m8: { ...seat.match.m8, round, loot: prepareMatchLoot(seat.match.seed, 23, seat.match.m8.loot, frozen.layout) },
      pendingChoice: { kind: 'anomaly' as const, step: 'target' as const, choiceId: 'round:4-6:anomaly',
        eventId: 'round:4-6:anomaly', generation: 0, offers: [], targetId: null, rerollCount: 0, returnPhase: 'preparation' as const },
    } })) } as RoomState;
  seam.enterRound();
}

const sessions: RemoteSession[] = [];
const closers: (() => void)[] = [];
afterEach(() => {
  sessions.splice(0).forEach(session => session.dispose());
  closers.splice(0).forEach(close => close());
  vi.unstubAllGlobals(); vi.restoreAllMocks();
});

function open(transport: 'room' | 'local-room') {
  const clock = new ManualClock();
  const local = transport === 'local-room' ? new LocalRoomClient({ ...LOCAL_ROOM_DEFAULTS, clock, carousel: false, preparationMs: PER_ROUND_PREPARATION }) : null;
  if (local) { local.joinQueue('异变测试'); local.startMatch(); }
  const room = local?.currentRoom ?? makeRoom(new TwoSidedBattleResolver(), { clock, preparationMs: PER_ROUND_PREPARATION }).room;
  if (!local) room.start();
  closers.push(() => { if (local) local.dispose(); else room.dispose(); });
  stageAnomaly(room);
  const seat = room.state.seats[0]!;
  expect(seat.kind).toBe('human');
  const match = () => room.state.seats[0]!.match;
  const players = () => match().preparation.units.filter(unit => unit.team === 'player');
  const benched = () => players().filter(unit => unit.location.kind === 'bench');
  // Level 1 can field one unit. Move that unit; keep another on the bench for the sale.
  if (!players().some(unit => unit.location.kind === 'board') && benched()[0]) {
    expect(room.handle(seat.seatId, { type: 'deploy', unitId: benched()[0]!.id, target: { kind: 'board', cell: { col: 1, row: 4 } } })).toMatchObject({ ok: true });
  }
  for (let bought = 0; !benched().length && bought < 5; bought++) {
    const slot = match().shop.slots.findIndex(entry => entry.status === 'available');
    expect(room.handle(seat.seatId, { type: 'buy', slot, generation: match().shop.generation })).toMatchObject({ ok: true });
  }
  const moving = players().find(unit => unit.location.kind === 'board')!;
  const staying = benched()[0]!;
  expect(moving?.id).toBeTruthy();
  expect(staying?.id).toBeTruthy();
  expect(moving.id).not.toBe(staying.id);
  const at = moving.location.kind === 'board' ? moving.location.cell : { col: -1, row: -1 };
  const destination = at.col === 0 && at.row === 4 ? { col: 2, row: 4 } : { col: 0, row: 4 };
  const original = room.handle.bind(room);
  const calls: SeatCommand[] = [];
  const results: { ok: boolean; reason?: string }[] = [];
  vi.spyOn(room, 'handle').mockImplementation((seatId: string, command: SeatCommand) => {
    const result = original(seatId, command);
    if (seatId === seat.seatId) { calls.push(structuredClone(command)); results.push(result.ok ? { ok: true } : { ok: false, reason: result.reason }); }
    return result;
  });
  let commandId = 0;
  const client: GameClient = local ?? {
    transport: 'websocket',
    listen: () => () => undefined,
    joinQueue() {}, leaveQueue() {}, startMatch() {}, reset() {}, dispose() {},
    send(command: WireCommand): ClientSendResult {
      const result = room.handle(seat.seatId, command);
      if (!result.ok) {
        const reason = result.reason === 'unknown-seat' || result.reason === 'seat-eliminated' || result.reason === 'room-phase' ? 'wrong-phase' : result.reason;
        return { ok: false, state: session.state, reason: reason as MatchFailure };
      }
      return { ok: 'pending', commandId: ++commandId };
    },
  } as GameClient;
  const session = new RemoteSession(client, toDisplayMatch(toSeatPrivateView(match())) as MatchState);
  sessions.push(session);
  return { room, match, session, calls, results, moving, staying, destination, local: local !== null };
}

function sceneFor(session: RemoteSession, units: readonly Unit[], destination: { col: number; row: number }) {
  const native = new Map<string, Set<(event: never) => void>>();
  vi.stubGlobal('window', {
    location: { search: '?mode=online' },
    addEventListener(type: string, fn: (event: never) => void) { if (!native.has(type)) native.set(type, new Set()); native.get(type)!.add(fn); },
    removeEventListener(type: string, fn: (event: never) => void) { native.get(type)?.delete(fn); },
  });
  vi.stubGlobal('HTMLElement', class {});
  vi.stubGlobal('document', { body: { dataset: { online: 'websocket' } }, getElementById: () => null, elementFromPoint: () => null });
  let hidden = false;
  const handlers = new Map<string, (pointer: Pointer, token: Token) => void>();
  const scene = new BoardScene() as unknown as SceneBridge;
  scene.session.dispose();
  const graphic = { clear: vi.fn(), fillStyle() {}, fillPoints() {}, fillRoundedRect() {}, lineStyle() {}, strokePoints() {}, strokeRoundedRect() {} };
  Object.assign(scene, { session, online: true, selectedId: null,
    strategyPanel: { get blocksBoard() { return !hidden && session.state.pendingChoice?.kind === 'anomaly'; }, render: vi.fn(), cancel: vi.fn(), refreshBench: vi.fn(), recordOperations: vi.fn() },
    input: { on: (name: string, fn: (pointer: Pointer, token: Token) => void) => handlers.set(name, fn), setDraggable: (token: Token, draggable: boolean) => { token.input.draggable = draggable; },
      manager: { pointers: [] }, setDragState: vi.fn() },
    cameras: { main: {} }, tweens: { killTweensOf: vi.fn(), killAll: vi.fn() }, events: { once: vi.fn() }, scene: { isActive: () => true },
    sync: vi.fn(), syncAfterDrag: vi.fn(), syncSelection: vi.fn(), setStatus: vi.fn(),
    target: vi.fn(() => ({ kind: 'board', cell: destination })), overlay: graphic, dropZones: graphic,
  });
  for (const unit of units) scene.tokens.set(unit.id, new Token(unit.id));
  scene.installDragHandlers(); scene.installKeyboardHandlers();
  const pointer: Pointer = { id: 1, positionToCamera: () => ({ x: 1, y: 4 }) };
  const emit = (type: string, event: object) => native.get(type)?.forEach(fn => fn(event as never));
  return { scene, handlers, pointer, emit,
    hide: () => { hidden = true; scene.syncChoiceInputs(); },
    start: (mode: '2d' | '3d', id: string) => mode === '2d' ? handlers.get('dragstart')!(pointer, scene.tokens.get(id)!) : scene.boardControls().dragStart(id),
    end: (mode: '2d' | '3d', id: string) => mode === '2d' ? handlers.get('dragend')!(pointer, scene.tokens.get(id)!) : scene.boardControls().dragEnd({ x: 1, y: 4 }, { x: 8, y: 8 }),
  };
}

describe('hidden anomaly movement reaches the room and local room', () => {
  for (const transport of ['room', 'local-room'] as const) for (const mode of ['2d', '3d'] as const) {
    it(`${transport}/${mode}: a hidden move is accepted and a bench sale is refused`, () => {
      const live = open(transport);
      const board = sceneFor(live.session, live.session.state.preparation.units, live.destination);
      const cell = { kind: 'board' as const, cell: live.destination };
      const lockedAt = live.match().preparation.units.find(unit => unit.id === live.moving.id)?.location;
      board.start(mode, live.moving.id); board.end(mode, live.moving.id);
      expect(live.calls).toEqual([]);
      expect(live.match().preparation.units.find(unit => unit.id === live.moving.id)?.location).toEqual(lockedAt);
      board.hide();
      const beforeMove = live.room.state;
      board.start(mode, live.moving.id); board.end(mode, live.moving.id);
      expect(live.results.at(-1)).toEqual({ ok: true });
      expect(live.calls).toEqual([{ type: 'deploy', unitId: live.moving.id, target: cell }]);
      expect(live.match().preparation.units.find(unit => unit.id === live.moving.id)?.location).toEqual(cell);
      expect(live.match().pendingChoice?.kind).toBe('anomaly');
      expect(live.room.state).not.toBe(beforeMove);
      expect(live.room.state.fault).toBeNull();
      if (!live.local) live.session.receiveState(toDisplayMatch(toSeatPrivateView(live.match())) as MatchState);
      expect(live.session.state.preparation.units.find(unit => unit.id === live.moving.id)?.location).toEqual(cell);
      expect(live.session.state.phase).toBe('choice');
      const benchUnit = live.match().preparation.units.find(unit => unit.id === live.staying.id);
      expect(benchUnit?.location.kind).toBe('bench');
      const gold = live.match().gold, roomBeforeSale = live.room.state, sent = live.calls.length;
      board.scene.selectedId = live.staying.id;
      board.scene.sell(live.staying.id);
      board.emit('keydown', { code: 'KeyE', preventDefault: vi.fn(), target: null, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, repeat: false });
      expect(live.calls).toHaveLength(sent);
      expect(board.scene.setStatus).toHaveBeenCalledWith(ANOMALY_SELL_BLOCKED);
      expect(live.room.state).toBe(roomBeforeSale);
      const refused = live.session.sell(live.staying.id);
      expect(refused).toMatchObject({ ok: false, reason: 'wrong-phase' });
      expect(refused).not.toHaveProperty('events');
      expect(live.calls.at(-1)).toEqual({ type: 'sell', unitId: live.staying.id });
      expect(live.room.state).toBe(roomBeforeSale);
      expect(live.match().gold).toBe(gold);
      expect(live.match().preparation.units.find(unit => unit.id === live.staying.id)?.location).toEqual(benchUnit!.location);
      expect(live.match().pendingChoice?.kind).toBe('anomaly');
    });
  }
});
