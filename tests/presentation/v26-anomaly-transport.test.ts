import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMatch } from '../../src/simulation/match';
import type { MatchCommandResult, MatchState } from '../../src/simulation/match-types';
import { toSeatPrivateView } from '../../src/server/room/projection';
import { WsGameClient } from '../../src/rendering/online/ws-client';
import { RemoteSession } from '../../src/rendering/online/remote-session';
import { OnlineApplication, type OnlineHooks } from '../../src/rendering/online/online-application';
import { StrategyPanel } from '../../src/rendering/strategy-panel';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));
import { BoardScene } from '../../src/rendering/BoardScene';

type ChoiceToken = { choiceId: string; generation: number };
type FakeSocket = WebSocket & {
  onopen: () => void;
  onmessage: (event: { data: string }) => void;
  onclose: (event: { code: number }) => void;
};
// Record the production panel's nodes/callbacks; no layout or selector emulation.
class Node {
  children: Node[] = []; dataset: Record<string, string> = {}; textContent = ''; className = '';
  hidden = false; disabled = false; inert = false; type = ''; listeners: Record<string, () => void> = {};
  append(...nodes: Node[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: Node[]) { this.children = nodes; }
  addEventListener(type: string, fn: () => void) { this.listeners[type] = fn; }
  contains() { return false; }
  focus() {}
  remove() {}
  click() { if (!this.disabled) this.listeners.click?.(); }
  all(): Node[] { return [this, ...this.children.flatMap(child => child.all())]; }
}
interface PanelBridge {
  renderChoice(state: MatchState): void;
  choiceRefused(choiceId: string, generation: number): void;
}
interface SceneBridge {
  session: { dispose(): void };
  strategyPanel: PanelBridge;
  pendingChoices: Map<number, ChoiceToken>;
  pendingSuccess: Map<number, string>;
  command(result: MatchCommandResult, message: string, equipment?: boolean, benchMove?: boolean, choice?: ChoiceToken): void;
  refused: NonNullable<OnlineHooks['refused']>;
  setStatus: ReturnType<typeof vi.fn>;
}
const cleanup: (() => void)[] = [];
afterEach(() => { cleanup.splice(0).forEach(fn => fn()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function transportPanel() {
  const body = new Node(); body.dataset.online = 'websocket';
  vi.stubGlobal('document', { body, createElement: () => new Node(), getElementById: () => null, activeElement: null });
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  const sockets: FakeSocket[] = [], sent: { type: string; commandId: number }[] = [], timers: (() => void)[] = [];
  const client = new WsGameClient({ url: 'ws://memory', storage: null, backoffMs: [1],
    createSocket: () => {
      const socket = { readyState: 1, send: (text: string) => sent.push(JSON.parse(text)), close() {} } as unknown as FakeSocket;
      sockets.push(socket); return socket;
    }, timers: { set: callback => { timers.push(callback); return callback; }, clear() {} } });
  const base = createMatch(42), choice: ChoiceToken = { choiceId: 'round:4-6:anomaly', generation: 3 };
  const initial: MatchState = { ...base, phase: 'choice', combat: null, gold: 2,
    pendingChoice: { ...choice, kind: 'anomaly', eventId: choice.choiceId, step: 'offer', offers: ['the-finisher'],
      targetId: base.preparation.units.find(u => u.team === 'player')!.id, rerollCount: 2, returnPhase: 'preparation' } };
  const session = new RemoteSession(client, initial);
  const scene = new BoardScene() as unknown as SceneBridge;
  scene.session.dispose(); scene.session = session; scene.setStatus = vi.fn();
  const choose = vi.fn((choiceId: string, generation: number, option: string) =>
    scene.command(session.choose(choiceId, generation, option), '进化', false, false, { choiceId, generation }));
  const rerollAnomaly = vi.fn((choiceId: string, generation: number) =>
    scene.command(session.anomalyReroll(choiceId, generation), '刷新', false, false, { choiceId, generation }));
  const modal = new Node();
  const panel = Object.assign(Object.create(StrategyPanel.prototype), {
    actions: { state: () => session.state, choose, rerollAnomaly }, modal, root: new Node(),
    choiceToken: '', dismissalTimer: null, focusFrame: null, choiceReopen: null,
    clearChoiceDismissal() {}, shieldChoiceDismissal() {},
  }) as PanelBridge;
  scene.strategyPanel = panel;
  const refused = vi.spyOn(panel, 'choiceRefused');
  // Exercise the real application -> BoardScene -> panel bridge, without constructing unrelated HUDs.
  const application = Object.assign(Object.create(OnlineApplication.prototype), {
    carousel: { clearPending: vi.fn() }, publishCarousel3d: vi.fn(),
    hooks: { refused: (id: number, reason: null, text: string) => scene.refused(id, reason, text) },
  }) as { onInterrupted(ids: readonly number[]): void };
  const interrupted = vi.fn((ids: readonly number[]) => application.onInterrupted(ids));
  client.listen({ lobby() {}, view() {}, replay() {}, interrupted,
    state: state => { session.receiveState(state); panel.renderChoice(session.state); },
    connection: status => { session.offline = status.kind === 'reconnecting' ? '重连中' : null; },
  });
  const push = (message: object) => sockets.at(-1)!.onmessage({ data: JSON.stringify(message) });
  const snapshot = () => push({ type: 'state', roomId: 'r', round: initial.round, seatRevision: 7, state: toSeatPrivateView(initial) });
  client.joinQueue('玩家');
  push({ type: 'receipt', commandId: sent.at(-1)!.commandId, ok: true,
    result: { kind: 'joined', token: 'token', seatId: 's', connectionEpoch: 1 } });
  snapshot();
  cleanup.push(() => { session.dispose(); client.dispose(); });
  const button = (debug: string) => {
    const node = modal.all().find(n => n.dataset.debug === debug);
    if (!node) throw new Error(`missing ${debug}`);
    return node;
  };
  return { scene, session, client, sockets, sent, timers, push, snapshot, choice, interrupted, refused,
    choose, rerollAnomaly, evolve: () => button('choice:the-finisher'), reroll: () => button('anomaly-reroll') };
}

describe('P2 anomaly commands whose receipt tracking is interrupted', () => {
  for (const path of ['disconnect', 'rate-limited'] as const) {
    it.each(['choose', 'reroll'] as const)(`${path}: unlocks pending %s even when the next snapshot has the identical choice token`, action => {
      const t = transportPanel(), button = action === 'choose' ? t.evolve() : t.reroll();
      button.click(); button.click();
      const commandId = t.sent.at(-1)!.commandId;
      expect(t.client.pendingCount).toBe(1);
      expect(t.scene.pendingChoices.get(commandId)).toEqual(t.choice);
      expect(t.evolve().disabled).toBe(true);
      expect(t.reroll().disabled).toBe(true);
      // An unrelated pending command is also discarded, without producing another choice refusal.
      t.scene.command(t.session.buyXp(), '购买经验');
      const otherId = t.sent.at(-1)!.commandId, before = t.sent.length;
      if (path === 'disconnect') {
        t.sockets[0]!.onclose({ code: 1006 });
      } else {
        t.push({ type: 'error', code: 'rate-limited', message: 'too fast' });
      }
      expect(t.interrupted).toHaveBeenCalledExactlyOnceWith([commandId, otherId]);
      expect(t.refused).toHaveBeenCalledExactlyOnceWith(t.choice.choiceId, t.choice.generation);
      expect(t.scene.pendingChoices.size).toBe(0);
      expect(t.scene.pendingSuccess.size).toBe(0);
      expect(t.client.pendingCount).toBe(0);
      expect(t.sent).toHaveLength(before); // No automatic resend or optimistic rule changes.
      if (path === 'disconnect') {
        t.timers.shift()!(); t.sockets[1]!.onopen();
        expect(t.sent.at(-1)!.type).toBe('resume');
        t.push({ type: 'receipt', commandId: t.sent.at(-1)!.commandId, ok: true,
          result: { kind: 'resumed', seatId: 's', roomId: 'r', lastCommandId: otherId, connectionEpoch: 2 } });
      }
      t.snapshot();
      expect(t.session.state.pendingChoice).toMatchObject(t.choice);
      expect(t.evolve().disabled).toBe(false);
      expect(t.reroll().disabled).toBe(false);
      button.click(); button.click();
      expect(action === 'choose' ? t.choose : t.rerollAnomaly).toHaveBeenCalledTimes(2);
      expect(t.sent.at(-1)!.commandId).toBeGreaterThan(otherId);
      expect(t.scene.pendingChoices.size).toBe(1);
    });
  }

  it.each([false, true])('releases an applied receipt whose state push was lost (rate limit before disconnect: %s)', rateLimited => {
    const t = transportPanel(); t.evolve().click();
    const commandId = t.sent.at(-1)!.commandId;
    t.push({ type: 'receipt', commandId, ok: true, result: { kind: 'applied', seatRevision: 8, events: [] } });
    expect(t.client.pendingCount).toBe(0);
    expect(t.scene.pendingChoices.size).toBe(1);
    if (rateLimited) {
      // A rate limit must retain receipts already received while the state push is still on this socket.
      t.push({ type: 'error', code: 'rate-limited', message: 'too fast' });
      expect(t.interrupted).not.toHaveBeenCalled();
      expect(t.evolve().disabled).toBe(true);
    }
    t.sockets[0]!.onclose({ code: 1006 });
    expect(t.interrupted).toHaveBeenCalledExactlyOnceWith([commandId]);
    expect(t.refused).toHaveBeenCalledExactlyOnceWith(t.choice.choiceId, t.choice.generation);
    expect(t.scene.pendingChoices.size).toBe(0);
  });
});
