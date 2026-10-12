/**
 * Product lifecycle for online play: lobby → match → ranking. Owns the lobby page, the
 * eight-seat sidebar and the ranking overlay, and routes server pushes into RemoteSession.
 * Nothing here decides rules; it only shows what the server sent.
 */
import type { SessionChange } from '../../m6/contracts';
import type { ReplaySnapshot } from '../../replay';
import { Lobby } from './lobby';
import { PlayersSidebar } from './players-sidebar';
import type { GameClient, LobbyView, PlayerView } from './protocol';
import { RankingOverlay } from './ranking';
import type { RemoteSession } from './remote-session';
import type { SceneApplication } from './scene-application';
import type { FakeServer } from './fake-server';
import type { OnlineBoardMounts } from '../app-shell';

export interface OnlineHooks {
  /** The server replaced my state outside a command: redraw everything. */
  refresh(): void;
  clearInput(): void;
  status(message: string): void;
  changed?(change: SessionChange): void;
}
type Mode = 'online-lobby' | 'active' | 'online-ended';

export class OnlineApplication implements SceneApplication {
  private mode: Mode = 'online-lobby';
  private lobby: Lobby;
  private sidebar: PlayersSidebar;
  private ranking: RankingOverlay;
  private view: PlayerView | null = null;
  private unlisten: () => void;
  private unsubscribe: () => void;
  private disposed = false;
  private ignoreNextDelta = true;
  replaySelectedUnit: string | null = null;
  /** @param mounts Online-only board-frame mounts (countdown above the board, shop dock below); the sidebar then keeps only the phase badge. */
  constructor(private readonly session: RemoteSession, private readonly client: GameClient, private readonly hooks: OnlineHooks, private readonly mounts: OnlineBoardMounts | null = null) {
    const app = document.getElementById('app')!;
    document.body.dataset.online = client.transport;
    const fake = client.transport === 'fake' ? (client as FakeServer) : null;
    this.lobby = new Lobby(app, { join: name => client.joinQueue(name), leave: () => client.leaveQueue(), start: () => client.startMatch(),
      ...(fake ? { addFakeFriend: () => fake.addFakeFriend() } : {}) });
    app.prepend(this.lobby.root);
    this.sidebar = new PlayersSidebar(app, mounts?.countdown ?? null);
    this.ranking = new RankingOverlay(document.body, () => this.again());
    this.session.pause('lobby');
    this.unsubscribe = this.session.subscribe(change => this.hooks.changed?.(change));
    document.addEventListener('visibilitychange', this.visibility);
    this.unlisten = client.listen({
      lobby: view => this.onLobby(view),
      view: view => this.onView(view),
      state: state => { this.session.receiveState(state); this.hooks.refresh(); },
      combat: frames => { this.session.receiveCombat(frames); this.hooks.clearInput(); this.hooks.refresh(); },
    });
    this.syncMode();
  }
  get replay(): ReplaySnapshot | null { return null; }
  get isActive(): boolean { return this.mode === 'active' && !document.hidden; }
  private onLobby(view: LobbyView) { this.lobby.render(view); }
  private onView(view: PlayerView) {
    this.view = view; this.sidebar.render(view);
    if (view.phase.kind === 'ended') {
      // syncMode first: the panel reads body[data-online-mode] while re-rendering to show the online end text.
      if (this.mode !== 'online-ended') { this.mode = 'online-ended'; this.session.skipPlayback(); this.session.pause('ended'); this.syncMode(); this.hooks.clearInput(); this.hooks.refresh(); }
      if (view.ranking) this.ranking.render(view.ranking, view.mySeatId);
      else if (view.fault) { this.ranking.renderFault(view.fault.detail); this.hooks.status(`对局异常结束：${view.fault.detail}`); }
      return;
    }
    if (view.phase.kind !== 'lobby' && this.mode === 'online-lobby') {
      this.mode = 'active'; this.session.resume('lobby'); this.ignoreNextDelta = true; this.hooks.refresh(); this.syncMode();
      this.hooks.status('对局开始 · 准备阶段结束时服务器自动开战，无需点击开始');
    }
    this.syncStatus(view);
  }
  private lastPhase = '';
  private syncStatus(view: PlayerView) {
    const key = `${view.phase.kind}/${view.phase.round}`; if (key === this.lastPhase) return; this.lastPhase = key;
    const opponent = view.seats.find(seat => seat.seatId === view.opponentSeatId);
    if (view.phase.kind === 'preparation') this.hooks.status(opponent ? `${view.phase.roundName} · 本轮对手：${opponent.name} · 倒计时结束自动开战` : `${view.phase.roundName} · 倒计时结束自动开始`);
    else if (view.phase.kind === 'combat') this.hooks.status('战斗由服务器计算 · 正在播放');
    else if (view.phase.kind === 'choice') this.hooks.status('请在倒计时内完成选择 · 超时由服务器代选');
    else if (view.phase.kind === 'settlement') this.hooks.status('回合结算 · 稍后自动进入下一回合');
  }
  private again() {
    this.ranking.hide(); this.client.reset(); this.mode = 'online-lobby'; this.lastPhase = '';
    this.session.resume('ended'); this.session.pause('lobby'); this.hooks.clearInput(); this.syncMode();
  }
  /** Called by the one Phaser render loop, before active-domain advancement. */
  frame(delta: number): boolean {
    this.sidebar.tick();
    if (this.ignoreNextDelta) { this.ignoreNextDelta = false; return false; }
    if (delta > 1000) return false; // a long stall: let the next frame continue from the current state
    return this.isActive;
  }
  private visibility = () => {
    this.ignoreNextDelta = true;
    // The server keeps running while the tab is hidden; on return, show the latest state at once.
    if (!document.hidden && this.session.playingBack) { this.session.skipPlayback(); this.hooks.clearInput(); this.hooks.refresh(); }
  };
  private syncMode() {
    document.body.dataset.m6Mode = this.mode === 'active' ? 'active' : this.mode === 'online-ended' ? 'active' : 'startup';
    document.body.dataset.onlineMode = this.mode;
    const inGame = this.mode !== 'online-lobby';
    this.lobby.show(!inGame); this.sidebar.show(inGame);
    const strategy = document.getElementById('strategy-root'); if (strategy) strategy.inert = this.mode !== 'active';
    if (this.mounts) { this.mounts.shopDock.inert = this.mode !== 'active'; this.mounts.countdown.hidden = !inGame; }
    const stats = document.getElementById('stats-root'); if (stats) stats.inert = !inGame;
    const canvas = document.querySelector<HTMLCanvasElement>('#board-root canvas'); if (canvas) canvas.style.pointerEvents = this.mode === 'active' ? '' : 'none';
  }
  requestNew() { this.hooks.status(this.mode === 'online-ended' ? '对局已结束 · 点击 返回匹配 再来一局' : '联机对局由服务器控制，没有本地新局'); }
  selectReplayUnit(_id: string | null) { /* no replay online */ }
  debug() { return { mode: this.mode, runId: 'online', transport: this.client.transport, phase: this.view?.phase ?? null, seats: this.view?.seats ?? [], ranking: this.view?.ranking ?? null, playingBack: this.session.playingBack, paused: this.session.paused }; }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    document.removeEventListener('visibilitychange', this.visibility);
    this.unlisten(); this.unsubscribe(); this.client.dispose();
    this.lobby.dispose(); this.sidebar.dispose(); this.ranking.dispose(); this.session.dispose();
    delete document.body.dataset.online; delete document.body.dataset.onlineMode;
  }
}
