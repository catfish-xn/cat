/**
 * Product lifecycle for online play: lobby → match → ranking. Owns the lobby page, the
 * eight-seat sidebar and the ranking overlay, and routes server pushes into RemoteSession.
 * Nothing here decides rules; it only shows what the server sent.
 */
import type { SessionChange } from '../../m6/contracts';
import type { ReceiptFailure } from '../../server/net/messages';
import type { MatchFailure, MatchState } from '../../simulation/match-types';
import type { ReplaySnapshot } from '../../replay';
import { Lobby } from './lobby';
import { OpponentBoardPanel } from './opponent-board';
import { PlayersSidebar } from './players-sidebar';
import type { ConfirmedCommand, ConnectionStatus, GameClient, LobbyView, PlayerView, RefusedCommand } from './protocol';
import { RankingOverlay } from './ranking';
import type { RemoteSession } from './remote-session';
import type { SceneApplication } from './scene-application';
import type { OnlineBoardMounts } from '../app-shell';

export interface OnlineHooks {
  /** The server replaced my state outside a command: redraw everything. */
  refresh(): void;
  clearInput(): void;
  status(message: string): void;
  changed?(change: SessionChange): void;
  /** The server confirmed pending commands of mine; the state already shows them. */
  confirmed?(commands: readonly ConfirmedCommand[]): void;
  /** The server refused a pending command; `text` is set for network/room refusals, else `reason` is a rule failure. */
  refused?(commandId: number, reason: MatchFailure | null, text: string | null): void;
}
/** Refusals that are not rule failures (docs/UI_REQUESTS.md B2 错误码表); everything else uses the offline wording. */
const NON_RULE_REFUSALS: Partial<Record<ReceiptFailure, string>> = {
  'seat-revision-mismatch': '画面已更新 · 请重新操作', 'stale-round': '回合已变化 · 请重新操作', 'resync-required': '画面已更新 · 请重新操作',
  'unknown-seat': '席位不存在', 'seat-eliminated': '你已被淘汰，只能观看', 'room-phase': '当前阶段不能操作',
  'seat-controlled': '机器人接管中 · 正在接回席位', 'control-revoked': '席位控制已变更 · 请重新操作',
  'no-room': '对局已不存在', 'wrong-room': '对局已更换，请刷新页面', 'not-authenticated': '连接未绑定席位 · 正在恢复',
  'rate-limited': '操作过快 · 请稍后再试', 'invalid-message': '客户端发送了无效命令（请刷新页面）', 'commandId-conflict': '命令编号冲突（请刷新页面）',
  'unsupported-protocol': '客户端版本过旧，请刷新页面',
};
const RECONNECTING = '连接中断，重连中…';
const SUPERSEDED = '已在别处打开此席位 · 本页停止操作';
/** Shown in the top status badge for a while after a resume took my seat back from a bot (B6). */
const RECLAIMED = '已接回席位 · 机器人代打已结束';
const RECLAIMED_NOTICE_MS = 8_000;
type Mode = 'online-lobby' | 'active' | 'online-ended';

export class OnlineApplication implements SceneApplication {
  private mode: Mode = 'online-lobby';
  private lobby: Lobby;
  private sidebar: PlayersSidebar;
  private opponentBoard: OpponentBoardPanel;
  /** My seat is eliminated while the match goes on: watch only (TFT keeps the screen, the ranking comes at the end). */
  private spectating = false;
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
    this.lobby = new Lobby(app, { join: name => client.joinQueue(name), leave: () => client.leaveQueue(), start: () => client.startMatch() });
    app.prepend(this.lobby.root);
    this.sidebar = new PlayersSidebar(app, mounts?.countdown ?? null, seatId => this.toggleBoard(seatId));
    const frame = document.getElementById('board-frame') ?? app;
    this.opponentBoard = new OpponentBoardPanel(frame, () => this.session.state.preparation.board, () => this.sidebar.setViewing(null));
    this.ranking = new RankingOverlay(document.body, () => this.again());
    this.session.pause('lobby');
    this.unsubscribe = this.session.subscribe(change => this.hooks.changed?.(change));
    document.addEventListener('visibilitychange', this.visibility);
    this.unlisten = client.listen({
      lobby: view => this.onLobby(view),
      view: view => this.onView(view),
      state: (state, confirmed) => this.onState(state, confirmed ?? []),
      combat: frames => { this.session.receiveCombat(frames); this.hooks.clearInput(); this.hooks.refresh(); },
      refused: refusal => this.onRefused(refusal),
      connection: status => this.onConnection(status),
    });
    this.syncMode();
  }
  get replay(): ReplaySnapshot | null { return null; }
  get isActive(): boolean { return this.mode === 'active' && !document.hidden; }
  private onLobby(view: LobbyView) { this.lobby.render(view); }
  /** A push that only confirms my own commands keeps selection and panels (like a local command); anything else redraws. */
  private onState(state: MatchState, confirmed: readonly ConfirmedCommand[]) {
    const before = this.session.state;
    if (confirmed.length && !this.session.playingBack && before.phase === state.phase && before.round === state.round) {
      this.session.receiveState(state, confirmed.flatMap(command => command.events));
      this.hooks.confirmed?.(confirmed);
      return;
    }
    this.session.receiveState(state); this.hooks.refresh();
  }
  private onRefused(refusal: RefusedCommand) {
    const text = NON_RULE_REFUSALS[refusal.reason] ?? null;
    this.hooks.refused?.(refusal.commandId, text === null ? refusal.reason as MatchFailure : null, text);
  }
  private connectionText: string | null = null;
  private reclaimedTimer: number | null = null;
  private onConnection(status: ConnectionStatus) {
    const before = this.connectionText;
    switch (status.kind) {
      case 'online': this.connectionText = null; break;
      case 'reconnecting': this.connectionText = RECONNECTING; break;
      case 'superseded': this.connectionText = SUPERSEDED; break;
      case 'seat-lost':
        this.connectionText = null;
        if (this.mode !== 'online-lobby') { this.backToLobby(); this.hooks.status('席位已失效（服务器重启或对局已结束）· 请重新匹配'); }
        break;
    }
    this.session.offline = this.connectionText;
    this.clearReclaimed();
    this.sidebar.connection(this.connectionText); this.lobby.connection(this.connectionText);
    if (status.kind === 'reconnecting') this.hooks.status(`${RECONNECTING}（第 ${status.attempt} 次，${Math.round(status.delayMs / 1000)} 秒后）`);
    else if (status.kind === 'superseded') this.hooks.status(SUPERSEDED);
    else if (status.kind === 'online' && status.reclaimed) {
      // The status line is redrawn by the snapshot that follows the resume; the badge keeps the notice for a while.
      this.hooks.status(RECLAIMED);
      this.sidebar.connection(RECLAIMED, 'ok');
      this.reclaimedTimer = window.setTimeout(() => { this.reclaimedTimer = null; this.sidebar.connection(this.connectionText); }, RECLAIMED_NOTICE_MS);
    }
    else if (status.kind === 'online' && before !== null) this.hooks.status('已重新连接 · 画面已恢复');
  }
  private onView(view: PlayerView) {
    this.view = view; this.sidebar.render(view); this.opponentBoard.update(view.seats, view.mySeatId);
    this.syncSpectating(view);
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
  /** Opens (or closes) the read-only public board of a seat; no command is involved. */
  private toggleBoard(seatId: string) {
    const view = this.view, seat = view?.seats.find(candidate => candidate.seatId === seatId);
    if (!view || !seat) return;
    this.opponentBoard.toggle(seat, seatId === view.mySeatId);
    this.sidebar.setViewing(this.opponentBoard.openSeatId);
  }
  private syncSpectating(view: PlayerView) {
    const me = view.seats.find(seat => seat.seatId === view.mySeatId);
    const spectating = me !== undefined && !me.alive && view.phase.kind !== 'ended';
    if (spectating === this.spectating) return;
    this.spectating = spectating; this.session.spectating = spectating;
    this.syncMode(); this.hooks.clearInput(); this.hooks.refresh();
    if (spectating) this.hooks.status(`已淘汰 · 第 ${me!.rank ?? '?'} 名 · 观战中 · 点击右侧玩家查看阵容`);
  }
  private syncStatus(view: PlayerView) {
    const key = `${view.phase.kind}/${view.phase.round}`; if (key === this.lastPhase) return; this.lastPhase = key;
    if (this.spectating) return; // the spectate line stays; phases still show in the countdown and sidebar
    const opponent = view.seats.find(seat => seat.seatId === view.opponentSeatId);
    if (view.phase.kind === 'preparation') this.hooks.status(opponent ? `对手：${opponent.name} · ${view.phase.roundName} · 倒计时结束自动开战` : `${view.phase.roundName} · 野怪回合 · 倒计时结束自动开战`);
    else if (view.phase.kind === 'combat') this.hooks.status(opponent ? `对战 ${opponent.name} · 战斗由服务器计算` : '战斗由服务器计算 · 正在播放');
    else if (view.phase.kind === 'choice') this.hooks.status('请在倒计时内完成选择 · 超时由服务器代选');
    else if (view.phase.kind === 'settlement') this.hooks.status('回合结算 · 稍后自动进入下一回合');
  }
  private again() { this.client.reset(); this.backToLobby(); }
  private backToLobby() {
    this.ranking.hide(); this.mode = 'online-lobby'; this.lastPhase = ''; this.view = null;
    this.spectating = false; this.session.spectating = false; this.opponentBoard.close();
    this.session.skipPlayback(); this.session.resume('ended'); this.session.pause('lobby'); this.hooks.clearInput(); this.syncMode();
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
    if (this.spectating) document.body.dataset.onlineSpectating = 'true'; else delete document.body.dataset.onlineSpectating;
    const inGame = this.mode !== 'online-lobby', playing = this.mode === 'active' && !this.spectating;
    this.lobby.show(!inGame); this.sidebar.show(inGame);
    if (!inGame) this.opponentBoard.close();
    const strategy = document.getElementById('strategy-root'); if (strategy) strategy.inert = !playing;
    if (this.mounts) { this.mounts.shopDock.inert = !playing; this.mounts.countdown.hidden = !inGame; }
    const stats = document.getElementById('stats-root'); if (stats) stats.inert = !inGame;
    const canvas = document.querySelector<HTMLCanvasElement>('#board-root canvas'); if (canvas) canvas.style.pointerEvents = playing ? '' : 'none';
  }
  requestNew() { this.hooks.status(this.mode === 'online-ended' ? '对局已结束 · 点击 返回匹配 再来一局' : '联机对局由服务器控制，没有本地新局'); }
  selectReplayUnit(_id: string | null) { /* no replay online */ }
  debug() { return { mode: this.mode, runId: 'online', transport: this.client.transport, connection: this.connectionText, spectating: this.spectating, viewingSeatId: this.opponentBoard.openSeatId, phase: this.view?.phase ?? null, seats: this.view?.seats ?? [], ranking: this.view?.ranking ?? null, playingBack: this.session.playingBack, paused: this.session.paused }; }
  private clearReclaimed() { if (this.reclaimedTimer !== null) { window.clearTimeout(this.reclaimedTimer); this.reclaimedTimer = null; } }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.clearReclaimed();
    document.removeEventListener('visibilitychange', this.visibility);
    this.unlisten(); this.unsubscribe(); this.client.dispose();
    this.lobby.dispose(); this.sidebar.dispose(); this.opponentBoard.dispose(); this.ranking.dispose(); this.session.dispose();
    delete document.body.dataset.online; delete document.body.dataset.onlineMode; delete document.body.dataset.onlineSpectating;
  }
}
