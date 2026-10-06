import { MatchSession } from '../rendering/match-session';
import { createMatch } from '../simulation/match';
import type { BattleRecord, SaveEnvelope, SaveStatus, SessionChange, SlotToken } from './contracts';
import { AUTOSAVE_TICKS } from './limits';
import { SaveRepository, saveError } from '../persistence/repository';
import { SaveCoordinator } from '../persistence/coordinator';
import { createSeed, createRunId } from '../persistence/seed';
import { exportFile, validateEnvelope, validateFile } from '../persistence/format';
import { createSaveControls, type SaveControls } from '../persistence/save-controls';
import { BattleHistory, PlaybackSession, ReplayPanel, validateBattleCollection, type ReplaySnapshot } from '../replay';
import { ReplayView } from '../rendering/replay-view';

interface ApplicationHooks {
  replace(session: MatchSession): void;
  clearInput(): void;
  status(message: string): void;
  changed?(change: SessionChange): void;
  playback?(snapshot: ReplaySnapshot | null, record: BattleRecord | null): void;
}
type Mode = 'startup' | 'active' | 'import' | 'replay';
/** Owns product lifecycle. Domain rules remain exclusively in Match/Combat. */
export class MatchApplication {
  private static instances = 0;
  private repository = new SaveRepository();
  private coordinator: SaveCoordinator | null = null;
  private controls: SaveControls;
  private replayPanel: ReplayPanel;
  private history: BattleHistory;
  private runId = '';
  private createdAt = new Date().toISOString();
  private persistedCount = 0;
  private mode: Mode = 'startup';
  private status: SaveStatus | null = null;
  private existing: { token: SlotToken; envelope: SaveEnvelope } | null = null;
  private archives: readonly BattleRecord[] = [];
  private unsubscribe: () => void;
  private playbackSession: PlaybackSession | null = null;
  replaySelectedUnit: string | null = null;
  private playbackRecord: BattleRecord | null = null;
  private replayView: ReplayView | null = null;
  private disposed = false;
  private busy = true;
  private ignoreNextDelta = true;
  private operation = 0;
  private archiveRequest = 0;
  private savedArchiveRun: string | null = null;
  constructor(private session: MatchSession, private hooks: ApplicationHooks) {
    MatchApplication.instances++;
    this.history = new BattleHistory('startup');
    this.session.pause('startup'); this.unsubscribe = this.session.subscribe(change => this.observe(change));
    this.controls = createSaveControls(document.getElementById('save-root')!, {
      onNewRandom: () => this.newRun(null), onNewFixed: seed => this.newRun(seed),
      onContinue: () => this.continueSaved(), onImport: file => this.import(file), onExport: () => this.export(),
    });
    this.replayPanel = new ReplayPanel(document.getElementById('replay-root')!, {
      select: record => { void this.openReplay(record); }, play: () => this.playbackSession?.play(), pause: () => this.playbackSession?.pause(),
      speed: value => this.playbackSession?.setSpeed(value), seek: tick => { if (this.playbackSession) this.renderReplay(this.playbackSession.seek(tick)); },
      close: () => this.closeReplay(),
    });
    document.addEventListener('visibilitychange', this.visibility);
    this.syncMode(); void this.initialize();
  }
  get activeSession(): MatchSession { return this.session; }
  get replay(): ReplaySnapshot | null { return this.playbackSession?.read() ?? null; }
  get isActive(): boolean { return this.mode === 'active' && !this.busy && !document.hidden; }
  get records(): readonly BattleRecord[] { return this.history.completedRecords; }
  private async initialize() {
    try { this.existing = await this.repository.readCurrent(); await this.loadArchives(); }
    catch (error) { this.failed(error); }
    finally { if (!this.disposed) { this.busy = false; this.syncMode(); } }
  }
  private async loadArchives() {
    const request = ++this.archiveRequest, session = this.session, run = this.runId;
    const epoch = this.coordinator?.token.activationEpoch ?? this.existing?.token.activationEpoch ?? null;
    const current = () => !this.disposed && request === this.archiveRequest && session === this.session
      && run === this.runId && epoch === (this.coordinator?.token.activationEpoch ?? this.existing?.token.activationEpoch ?? null);
    try {
      const records: BattleRecord[] = [];
      const completed = await this.repository.listCompleted();
      if (!current()) return;
      for (const info of completed) {
        if (info.runId === run) continue;
        const envelope = await this.repository.readCompleted(info.runId);
        if (!current()) return;
        if (envelope) records.push(...envelope.battles);
      }
      if (current()) { this.archives = records; this.refreshRecords(); }
    } catch (error) {
      // Handle failures in the same continuation as the identity check: a late
      // rejection must not report failure against a newly activated session.
      if (current()) this.failed(error);
    }
  }
  private refreshRecords() { this.replayPanel.setRecords([...this.history.completedRecords, ...this.archives.filter(record => record.runId !== this.runId)]); }
  private observe(change: SessionChange) {
    this.history.observe(change);
    this.hooks.changed?.(change);
    const completed = this.history.completedRecords;
    if (change.after.combat?.status === 'finished' && change.before.combat?.status !== 'finished') this.refreshRecords();
    const phaseChanged = change.before.phase !== change.after.phase;
    if (change.reason !== 'tick' || phaseChanged || change.after.combat !== null && change.after.combat.tick % AUTOSAVE_TICKS === 0) this.enqueue();
    this.replayPanel.setEnabled(this.mode === 'active' && ['preparation','settlement','gameOver'].includes(change.after.phase));
    // Do not materialize all historical records during a frame update.
    if (completed.length > 30) throw new Error('战斗历史超过冻结边界');
  }
  private envelope(): SaveEnvelope {
    return { kind: 'hex-autobattler-save', saveFormatVersion: 1, replayFormatVersion: 1,
      runId: this.runId, createdAt: this.createdAt, match: structuredClone(this.session.state),
      battles: this.history.completedRecords, currentBattle: this.history.capturePrefix() };
  }
  private enqueue() {
    if (!this.runId || !this.coordinator || this.mode === 'startup' || this.mode === 'import' || this.mode === 'replay') return;
    const records = this.history.completedRecords;
    this.coordinator.enqueue({ match: this.session.state, currentBattle: this.history.capturePrefix(),
      battleKeys: records.map(record => record.combatId), addedBattles: records.slice(this.persistedCount) });
    this.persistedCount = records.length;
  }
  private failed(error: unknown) {
    if (this.disposed) return;
    const reason = saveError(error);
    this.status = { kind: 'failed', reason: reason.reason, message: reason.message };
    this.hooks.status(reason.reason === 'conflict' ? '另一页面已更新存档，自动保存已停止；仍可导出本地对局。' : `保存失败：${reason.message}；仍可导出本地对局。`);
    this.syncControls();
  }
  private attachCoordinator(token: SlotToken) {
    this.coordinator?.dispose();
    const run = this.runId;
    this.coordinator = new SaveCoordinator(this.repository, token, (status, committed) => {
      if (this.disposed || this.runId !== run) return;
      this.status = status; this.syncControls();
      if (status.kind === 'saved' && committed?.phase === 'gameOver' && this.savedArchiveRun !== run) {
        this.savedArchiveRun = run; void this.loadArchives();
      }
    });
  }
  private install(envelope: SaveEnvelope, token: SlotToken | null, prepared: MatchSession, preparedHistory: BattleHistory) {
    const old = this.session;
    this.archiveRequest++; this.archives = [];
    this.unsubscribe();
    this.session = prepared;
    if (document.hidden) this.session.pause('hidden');
    this.runId = envelope.runId; this.createdAt = envelope.createdAt;
    this.savedArchiveRun = null;
    this.history = preparedHistory;
    this.persistedCount = envelope.battles.length;
    this.unsubscribe = this.session.subscribe(change => this.observe(change));
    old.dispose(); this.coordinator?.dispose(); this.coordinator = null;
    if (token) this.attachCoordinator(token);
    this.mode = 'active'; this.ignoreNextDelta = true;
    this.existing = null;
    this.hooks.replace(this.session); this.refreshRecords();
  }
  private async replaceCandidate(make: () => Promise<SaveEnvelope>, allowUnsavedInitial = false) {
    if (this.busy || this.mode === 'replay') return;
    const id = ++this.operation, previous = this.mode;
    let prepared: MatchSession | null = null;
    this.busy = true; this.mode = 'import'; this.session.pause('import'); this.hooks.clearInput(); this.syncMode();
    try {
      const candidate = await make();
      // Build and validate the candidate before touching persisted or active state.
      const ledger = candidate.currentBattle?.events ?? candidate.battles.find(record => record.combatId === candidate.match.combat?.combatId)?.events ?? [];
      prepared = new MatchSession(candidate.match, ledger);
      const preparedHistory = new BattleHistory(candidate.runId, candidate.battles, candidate.currentBattle);
      await this.coordinator?.flush();
      const expected = this.coordinator?.token ?? this.existing?.token ?? null;
      let token: SlotToken | null;
      try { token = await this.repository.activate(expected, candidate); }
      catch (error) {
        if (!allowUnsavedInitial || this.runId || this.existing || saveError(error).reason === 'conflict') throw error;
        token = null; this.failed(error);
      }
      if (this.disposed || id !== this.operation) return;
      this.install(candidate, token, prepared, preparedHistory);
      if (token) {
        this.status = { kind: 'saved', at: new Date().toISOString(), token };
        // Activation may import a fourth finished run and evict the oldest archive.
        await this.loadArchives();
      }
    } catch (error) {
      if (this.disposed || id !== this.operation) return;
      this.mode = previous; this.failed(error);
      this.hooks.status(`对局未替换：${error instanceof Error ? error.message : String(error)}`);
      throw error;
    } finally {
      if (prepared && prepared !== this.session) prepared.dispose();
      if (!this.disposed && id === this.operation) { this.session.resume('import'); this.busy = false; this.ignoreNextDelta = true; this.syncMode(); }
    }
  }
  private confirmReplacement(): boolean {
    const replaced = this.runId ? this.session.state : this.existing?.envelope.match;
    return !replaced || replaced.phase === 'gameOver' || window.confirm('这会替换当前自动存档。需要保留当前对局时，请取消并先点击“导出当前局”。继续替换？');
  }
  private async newRun(seed: number | null) {
    if (!this.confirmReplacement()) return;
    await this.replaceCandidate(async () => ({ kind: 'hex-autobattler-save', saveFormatVersion: 1, replayFormatVersion: 1,
      runId: createRunId(), createdAt: new Date().toISOString(), match: createMatch(seed ?? createSeed()), battles: [], currentBattle: null }), true);
  }
  private async continueSaved() {
    if (!this.existing) return;
    await this.replaceCandidate(() => validateEnvelope(this.existing!.envelope, validateBattleCollection));
  }
  private async import(file: File) {
    if (!this.confirmReplacement()) return;
    await this.replaceCandidate(() => validateFile(file, validateBattleCollection));
  }
  private export() {
    const envelope = this.runId ? this.envelope() : this.existing?.envelope;
    if (!envelope) return;
    const url = URL.createObjectURL(exportFile(envelope));
    const a = document.createElement('a'); a.href = url; a.download = `hex-${envelope.match.seed}-${envelope.runId}.json`;
    document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  requestNew() {
    if (this.busy || this.mode === 'replay') return;
    document.getElementById('save-root')!.scrollIntoView({ block: 'start' });
    document.querySelector<HTMLInputElement>('[data-debug="m6-seed-input"]')?.focus();
    this.hooks.status('请选择随机新局，或输入固定种子；需要保留当前局可先导出。');
  }
  private async openReplay(record: BattleRecord) {
    if (this.busy || (this.mode !== 'replay' && (this.mode !== 'active' || !['preparation','settlement','gameOver'].includes(this.session.phase)))) return;
    const wasReplay = this.mode === 'replay';
    const id = ++this.operation;
    this.session.pause('replay'); this.busy = true; this.hooks.clearInput(); this.syncMode();
    try {
      // Settle already queued writes before the read-only replay interval begins.
      if (!wasReplay) {
        try { await this.coordinator?.flush(); } catch (error) { this.failed(error); }
      }
      if (this.disposed || id !== this.operation) return;
      const candidate = new PlaybackSession(record);
      this.session.pause('replay'); this.hooks.clearInput();
      this.playbackSession?.dispose(); this.playbackSession = candidate; this.playbackRecord = record;
      this.replayView ??= new ReplayView(document.getElementById('board-root')!);
      this.mode = 'replay'; this.syncMode(); this.renderReplay(candidate.read());
    } catch (error) {
      if (this.disposed || id !== this.operation) return;
      if (!wasReplay) this.session.resume('replay');
      this.hooks.status(error instanceof Error ? error.message : String(error));
    }
    finally { if (!this.disposed && id === this.operation) { this.busy = false; this.syncMode(); } }
  }
  private renderReplay(snapshot: ReplaySnapshot) {
    this.replayView?.render(snapshot.combat, this.replaySelectedUnit); this.replayPanel.render(snapshot); this.hooks.playback?.(snapshot, this.playbackRecord);
  }
  selectReplayUnit(id: string | null) {
    this.replaySelectedUnit = id;
    if (this.playbackSession) this.renderReplay(this.playbackSession.read());
  }
  private closeReplay() {
    if (this.mode !== 'replay' || this.busy) return;
    this.operation++;
    this.playbackSession?.dispose(); this.playbackSession = null; this.playbackRecord = null;
    this.replayView?.dispose(); this.replayView = null;
    this.session.resume('replay'); this.mode = 'active'; this.ignoreNextDelta = true;
    this.replayPanel.render(null); this.hooks.playback?.(null, null); this.syncMode();
  }
  /** Called by the one Phaser render loop, before active-domain advancement. */
  frame(delta: number): boolean {
    if (this.ignoreNextDelta) { this.ignoreNextDelta = false; return false; }
    if (document.hidden) return false;
    if (this.mode === 'replay' && this.playbackSession) this.renderReplay(this.playbackSession.advance(delta));
    return this.isActive;
  }
  private visibility = () => {
    this.ignoreNextDelta = true;
    if (document.hidden) {
      this.session.pause('hidden'); this.playbackSession?.pause();
      if (this.mode === 'active' && !this.busy) { this.enqueue(); void this.coordinator?.flush().catch(error => this.failed(error)); }
    } else this.session.resume('hidden');
  };
  private syncControls() {
    this.controls?.update({ startup: !this.runId, canContinue: this.existing !== null, seed: this.session.state.seed,
      runId: this.runId, busy: this.busy || this.mode === 'replay', status: this.status, hasActive: Boolean(this.runId) });
  }
  private syncMode() {
    document.body.dataset.m6Mode = this.mode;
    const blocked = this.mode !== 'active' || this.busy;
    const strategy = document.getElementById('strategy-root'); if (strategy) strategy.inert = blocked;
    const stats = document.getElementById('stats-root'); if (stats) stats.inert = this.busy || this.mode === 'startup';
    const canvas = document.querySelector<HTMLCanvasElement>('#board-root canvas:not(.replay-canvas)');
    if (canvas) { canvas.style.pointerEvents = blocked ? 'none' : ''; canvas.style.visibility = this.mode === 'replay' ? 'hidden' : ''; }
    this.replayPanel?.setEnabled(!this.busy && (this.mode === 'replay' || this.mode === 'active' && ['preparation','settlement','gameOver'].includes(this.session.phase)));
    this.syncControls();
  }
  debug() { return { mode: this.mode, runId: this.runId, token: this.coordinator?.token ?? null, status: this.status,
    completedCount: this.history.completedRecords.length, lifecycle: { applications: MatchApplication.instances, sessions: MatchSession.liveCount, observers: this.session.observerCount }, paused: this.session.paused,
    replay: this.playbackSession ? { tick: this.playbackSession.read().tick, endTick: this.playbackSession.read().endTick } : null }; }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; MatchApplication.instances--; this.operation++; this.archiveRequest++; this.unsubscribe(); this.coordinator?.dispose(); this.repository.close();
    document.removeEventListener('visibilitychange', this.visibility); this.controls.dispose(); this.replayPanel.dispose();
    this.playbackSession?.dispose(); this.replayView?.dispose(); this.session.dispose();
  }
}
