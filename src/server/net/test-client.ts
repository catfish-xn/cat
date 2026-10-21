/**
 * Node test client for the game server (work order B2). Uses the WebSocket client built into
 * Node 22 (no extra dependency): join, start, send commands, disconnect, resume with the seat
 * token. Every message received is kept in `inbox` so tests can assert on exactly what the
 * server sent. Not a browser client: that is work order C4.
 *
 * Run `npm run client:game -- ws://localhost:8787 名字` to play one idle match end to end.
 */
import type { LittleLegendId, LobbyView, PlayerView, SeatStateView, WireCommand } from '../protocol';
import { NET_PROTOCOL_VERSION, type ClientMessage, type ReceiptMessage, type ServerMessage } from './messages';

export type Receipt = ReceiptMessage;
type Pending = { resolve(receipt: Receipt): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> };
type Raw = ClientMessage extends infer M ? M extends ClientMessage ? Omit<M, 'protocolVersion' | 'commandId'> : never : never;

export class TestClient {
  readonly inbox: ServerMessage[] = [];
  readonly closed: Promise<{ code: number; reason: string }>;
  token: string | null = null;
  seatId: string | null = null;
  connectionEpoch = 0;
  private nextCommandId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly waiters = new Set<(message: ServerMessage) => void>();
  private resolveClosed!: (value: { code: number; reason: string }) => void;

  private constructor(readonly url: string, private readonly socket: WebSocket, readonly receiptTimeoutMs: number) {
    this.closed = new Promise(resolve => { this.resolveClosed = resolve; });
    socket.addEventListener('message', event => this.onMessage(String(event.data)));
    socket.addEventListener('close', event => {
      for (const entry of this.pending.values()) { clearTimeout(entry.timer); entry.reject(new Error(`connection closed (${event.code})`)); }
      this.pending.clear();
      this.resolveClosed({ code: event.code, reason: event.reason });
    });
  }

  static connect(url: string, receiptTimeoutMs = 5_000): Promise<TestClient> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const client = new TestClient(url, socket, receiptTimeoutMs);
      socket.addEventListener('open', () => resolve(client), { once: true });
      socket.addEventListener('error', () => reject(new Error(`could not connect to ${url}`)), { once: true });
    });
  }

  get isOpen(): boolean { return this.socket.readyState === WebSocket.OPEN; }
  get lobby(): LobbyView | null { return this.last('lobby')?.view ?? null; }
  get view(): PlayerView | null { return this.last('view')?.view ?? null; }
  get state(): SeatStateView | null { return this.last('state')?.state ?? null; }
  get stateRevision(): number { return this.last('state')?.seatRevision ?? -1; }
  /** Starts the next commandId at this value (tests reuse ids on purpose). */
  set commandCounter(value: number) { this.nextCommandId = value; }
  get commandCounter(): number { return this.nextCommandId; }

  private last<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }> | null {
    for (let index = this.inbox.length - 1; index >= 0; index--) {
      const message = this.inbox[index]!;
      if (message.type === type) return message as Extract<ServerMessage, { type: T }>;
    }
    return null;
  }

  private onMessage(text: string): void {
    const message = JSON.parse(text) as ServerMessage;
    this.inbox.push(message);
    if (message.type === 'receipt') {
      const entry = this.pending.get(message.commandId);
      if (entry) { clearTimeout(entry.timer); this.pending.delete(message.commandId); entry.resolve(message); }
      if (message.ok && message.result.kind === 'joined') { this.token = message.result.token; this.seatId = message.result.seatId; this.connectionEpoch = message.result.connectionEpoch; }
      if (message.ok && message.result.kind === 'resumed') {
        this.seatId = message.result.seatId; this.connectionEpoch = message.result.connectionEpoch;
        this.nextCommandId = Math.max(this.nextCommandId, message.result.lastCommandId + 1);
      }
    }
    for (const waiter of [...this.waiters]) waiter(message);
  }

  /** Sends a text frame as is (malformed input for the validators). */
  sendRaw(text: string): void { this.socket.send(text); }

  /** Sends a message with the next commandId (or a chosen one) and resolves with its receipt. */
  send(raw: Raw, commandId = this.nextCommandId++): Promise<Receipt> {
    if (commandId >= this.nextCommandId) this.nextCommandId = commandId + 1;
    const message = { ...raw, protocolVersion: NET_PROTOCOL_VERSION, commandId } as ClientMessage;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(commandId); reject(new Error(`no receipt for commandId ${commandId} within ${this.receiptTimeoutMs} ms`)); }, this.receiptTimeoutMs);
      this.pending.set(commandId, { resolve, reject, timer });
      this.socket.send(JSON.stringify(message));
    });
  }

  join(name: string, legend?: string): Promise<Receipt> { return this.send({ type: 'join', name, ...(legend === undefined ? {} : { legend: legend as LittleLegendId }) }); }
  leaveQueue(): Promise<Receipt> { return this.send({ type: 'leaveQueue' }); }
  start(): Promise<Receipt> { return this.send({ type: 'start' }); }
  resume(token: string): Promise<Receipt> { return this.send({ type: 'resume', token }); }

  /** Sends a seat command against the latest view/state this client has seen unless overridden. */
  command(command: WireCommand, overrides: Partial<Pick<ClientMessage & { type: 'command' }, 'roomId' | 'round' | 'seatRevision'>> = {}, commandId?: number): Promise<Receipt> {
    const view = this.last('view');
    if (!view && (overrides.roomId === undefined || overrides.round === undefined)) throw new Error('no view received yet: pass roomId and round');
    return this.send({
      type: 'command', roomId: overrides.roomId ?? view!.roomId, round: overrides.round ?? view!.view.phase.round,
      seatRevision: overrides.seatRevision ?? this.stateRevision, command,
    }, commandId);
  }

  /** Resolves with the first message (already received or future) that satisfies the predicate. */
  waitFor<T extends ServerMessage = ServerMessage>(predicate: (message: ServerMessage) => boolean, timeoutMs = 5_000, fromIndex = 0): Promise<T> {
    const seen = this.inbox.slice(fromIndex).find(predicate);
    if (seen) return Promise.resolve(seen as T);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.waiters.delete(waiter); reject(new Error(`timed out after ${timeoutMs} ms waiting for a message (inbox ${this.inbox.length}, last ${this.inbox.at(-1)?.type ?? 'none'})`)); }, timeoutMs);
      const waiter = (message: ServerMessage) => { if (predicate(message)) { clearTimeout(timer); this.waiters.delete(waiter); resolve(message as T); } };
      this.waiters.add(waiter);
    });
  }
  waitForView(predicate: (view: PlayerView) => boolean, timeoutMs = 5_000): Promise<PlayerView> {
    return this.waitFor<Extract<ServerMessage, { type: 'view' }>>(message => message.type === 'view' && predicate(message.view), timeoutMs).then(message => message.view);
  }

  close(code = 1000): Promise<{ code: number; reason: string }> { this.socket.close(code); return this.closed; }
}

/** Plays one idle match: join, start, buy XP each preparation, take the first choice, print the ranking. */
export async function runSmoke(url: string, name: string, log: (line: string) => void = () => {}): Promise<PlayerView> {
  const client = await TestClient.connect(url, 30_000);
  const joined = await client.join(name);
  if (!joined.ok) throw new Error(`join refused: ${joined.reason}`);
  const started = await client.start();
  if (!started.ok) throw new Error(`start refused: ${started.reason}`);
  let actedRound = -1;
  for (;;) {
    const view = client.view;
    if (view?.phase.kind === 'ended') { log(`ended: ${view.ranking?.map(seat => `${seat.rank}.${seat.name}`).join(' ') ?? 'no ranking'}`); await client.close(); return view; }
    if (view && client.state && view.phase.round !== actedRound) {
      const state = client.state;
      let receipt: Receipt | null = null;
      if (view.phase.kind === 'preparation' && state.phase === 'preparation') {
        actedRound = view.phase.round;
        receipt = await client.command({ type: 'buyXp' });
        log(`round ${view.phase.round} buyXp → ${receipt.ok ? 'ok' : receipt.reason}`);
      } else if (view.phase.kind === 'choice' && state.pendingChoice && state.pendingChoice.step === 'offer') {
        const pending = state.pendingChoice;
        receipt = await client.command({ type: 'choose', choiceId: pending.choiceId, generation: pending.generation, definitionId: pending.offers[0]! });
        log(`round ${view.phase.round} choose → ${receipt.ok ? 'ok' : receipt.reason}`);
      }
      // An applied command is followed by the new private state; act on that, not on the stale one.
      if (receipt?.ok && receipt.result.kind === 'applied') {
        const revision = receipt.result.seatRevision;
        await client.waitFor(message => message.type === 'state' && message.seatRevision >= revision, 30_000);
        continue;
      }
    }
    const before = client.inbox.length;
    await client.waitFor(() => true, 600_000, before);
  }
}

const argv = (globalThis as { process?: { argv: string[]; exitCode?: number } }).process?.argv ?? [];
if (argv[1] && /test-client/.test(argv[1])) {
  const url = argv[2] ?? 'ws://127.0.0.1:8787';
  runSmoke(url, argv[3] ?? '测试客户端', line => console.log(line)).catch(error => { console.error(error); (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1; });
}
