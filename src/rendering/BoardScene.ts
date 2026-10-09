import Phaser from 'phaser';
import { getDefinition, getPlayerDeploymentCount } from '../simulation/game';
import { isDeploymentCell } from '../simulation/board';
import { UNIT_DEFINITIONS, type Unit, type UnitLocation } from '../simulation/units';
import { MATCH_RULES, getUnitSellPrice, getUnitStats, getDeploymentCap, getXpToNextLevel, getShopOdds, validateMatchDeployment, type MatchCommandResult, type MatchFailure } from '../simulation/match';
import { COMBAT_TICK_MS, type CombatEvent } from '../simulation/combat';
import { HexLayout, type Point } from './hex-layout';
import { BOARD_LAYOUT } from './layout-config';
import { MatchSession } from './match-session';
import { InputRouter } from './input-router';
import { getStageRound, getRoundKind } from '../simulation/round-schedule';
import { StrategyPanel } from './strategy-panel';
import { MatchApplication } from '../m6/application';
import { aggregateStats, appendStats, emptyStats, type BattleStats } from '../stats/aggregate';
import { createStatsPanel, type StatsPanel } from '../stats/stats-panel';
import { createCombatFeedbackRenderer, type CombatFeedbackRenderer } from '../stats/combat-feedback-renderer';
import type { SessionChange } from '../m6/contracts';
import { UnitView, type RingState } from '../presentation/unit-view';
import { THEME, toNumber } from '../presentation/theme';
import { CombatFx } from '../presentation/combat-fx';
import { canvasLabelRects } from '../presentation/label-layout';
import { buildPortraitTextures, loadS13Portraits } from '../presentation/s13-assets';
import { HelpPanel } from '../presentation/help-panel';
import { reducedMotion } from '../presentation/preferences';
import { EQUIPMENT_COMMAND_FAILURES, EQUIPMENT_FAILURE_TEXT } from '../presentation/equipment-feedback';

declare global {
  interface Window { __CAT_DEBUG__?: Readonly<{ read: () => ReturnType<BoardScene['debugSnapshot']> }> }
}

export class BoardScene extends Phaser.Scene {
  private session = new MatchSession();
  private application: MatchApplication | null = null;
  private statsPanel: StatsPanel | null = null;
  private feedback: CombatFeedbackRenderer | null = null;
  private activeStats: BattleStats | null = null;
  private lastStatsRender = -1;
  private lastReplaySeq = -1;
  private replayBattle = '';
  private replayCombat: import('../simulation/combat-types').CombatState | null = null;
  private replayRenderKey = '';
  private inputRouter = new InputRouter();
  private strategyPanel: StrategyPanel | null = null;
  private help: HelpPanel | null = null;
  private get state() { return this.session.preparation; }
  private layout = new HexLayout(this.state.board, BOARD_LAYOUT.hexRadius, BOARD_LAYOUT.origin);
  private views = new Map<string, UnitView>();
  private tokens = new Map<string, Phaser.GameObjects.Container>();
  private renderedCells = new Map<string, string>();
  private effects = new Set<Phaser.GameObjects.GameObject>();
  private namedObjects = new Map<string, Phaser.GameObjects.Text | Phaser.GameObjects.Container>();
  private draggingId: string | null = null;
  private selectedId: string | null = null;
  private mouseClient: Point | null = null;
  private shopButtons: Phaser.GameObjects.Text[] = [];
  private shopFrames: Phaser.GameObjects.Graphics[] = [];
  private startButton!: Phaser.GameObjects.Text;
  private continueButton!: Phaser.GameObjects.Text;
  private rerollButton!: Phaser.GameObjects.Text;
  private xpButton!: Phaser.GameObjects.Text;
  private sellButton!: Phaser.GameObjects.Text;
  private phaseLabel!: Phaser.GameObjects.Text;
  private roundLabel!: Phaser.GameObjects.Text;
  private goldLabel!: Phaser.GameObjects.Text;
  private hpLabel!: Phaser.GameObjects.Text;
  private levelLabel!: Phaser.GameObjects.Text;
  private xpLabel!: Phaser.GameObjects.Text;
  private oddsLabel!: Phaser.GameObjects.Text;
  private resultLabel!: Phaser.GameObjects.Text;
  private incomeLabel!: Phaser.GameObjects.Text;
  private selectionLabel!: Phaser.GameObjects.Text;
  private startHint!: Phaser.GameObjects.Text;
  private timer!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Graphics;
  private status!: Phaser.GameObjects.Text;
  private count!: Phaser.GameObjects.Text;
  private recentCombatEvents: CombatEvent[] = [];
  private fx = new CombatFx({ scene: this, center: cell => this.layout.center(cell), view: id => this.views.get(id), fade: (effect, duration) => this.fadeEffect(effect, duration) });
  private renderedCastCount = 0;
  private renderedUpgradeCount = 0;

  constructor() { super('Board'); }
  create() {
    buildPortraitTextures(this);
    // Phaser reuses the Scene instance on restart but destroys its display list.
    // Keep the authoritative MatchSession; all cached display references must be new.
    this.resetViewReferences();
    const oldHudStart = this.children.length;
    this.add.text(48, 28, 'HEX / 自动战棋', { fontSize: '25px', color: '#edf4f3', fontStyle: 'bold' });
    this.phaseLabel = this.add.text(48, 67, '', { fontSize: '14px', color: '#9aaeb9' });
    this.roundLabel = this.add.text(455, 32, '', { fontSize: '21px', color: '#edf4f3' }).setName('round');
    this.goldLabel = this.add.text(600, 32, '', { fontSize: '21px', color: '#e6bc76' }).setName('gold');
    this.hpLabel = this.add.text(756, 32, '', { fontSize: '21px', color: '#f08080' }).setName('player-hp');
    this.levelLabel = this.add.text(756, 70, '', { fontSize: '17px', color: '#edf4f3' }).setName('level');
    this.xpLabel = this.add.text(756, 95, '', { fontSize: '14px', color: '#b4a1f5' }).setName('xp');
    this.oddsLabel = this.add.text(48, 89, '', { fontSize: '12px', color: '#9aaeb9' }).setName('shop-odds');
    this.count = this.add.text(756, 119, '', { fontSize: '14px', color: '#68ddd0' }).setName('population');
    this.startButton = this.button('start-combat', 756, 148, 164, 48, '开始战斗', () => this.command(this.session.start(), '战斗开始 · 阵容已锁定'));
    this.continueButton = this.button('continue', 756, 207, 164, 48, '继续', () => {
      this.command(this.session.continue(this.continueButton.getData('round')), '进入下一回合 · 商店已更新，可继续调整阵容');
    });
    this.resultLabel = this.add.text(756, 269, '', { fontSize: '25px', color: '#edf4f3', fontStyle: 'bold' }).setName('result');
    this.incomeLabel = this.add.text(756, 306, '', { fontSize: '13px', color: '#e6bc76', lineSpacing: 4 });
    this.timer = this.add.text(756, 426, '', { fontSize: '13px', color: '#9aaeb9' });
    this.startHint = this.add.text(756, 308, '', { fontSize: '14px', color: '#9aaeb9', wordWrap: { width: 164 }, lineSpacing: 5 });
    this.selectionLabel = this.add.text(756, 462, '', { fontSize: '13px', color: '#edf4f3', wordWrap: { width: 164 }, lineSpacing: 3 });
    this.sellButton = this.button('sell', 756, 526, 164, 40, 'E · 出售', () => {
      if (this.selectedId === null) {
        this.setStatus(this.session.phase === 'preparation' ? '请先点击一个我方单位，再点击出售' : this.failureMessage('wrong-phase'));
        return;
      }
      this.sell(this.selectedId);
    });
    this.rerollButton = this.button('reroll', 756, 577, 164, 40, `D · 刷新 · ${MATCH_RULES.rerollCost} 金币`, () => this.command(this.session.reroll(), '商店已刷新'));
    this.xpButton = this.button('buy-xp', 756, 629, 164, 44, `F · ${MATCH_RULES.xpPurchaseCost} 金币 → ${MATCH_RULES.xpPurchaseAmount} 经验`, () => this.command(this.session.buyXp(), '经验已购买 · 升级增加人口，下一次刷新使用新概率'), 15);
    this.button('debug-new-match', 756, 710, 164, 30, '新局', () => this.newMatch(), 12);
    for (const child of this.children.list.slice(oldHudStart)) (child as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
    const graphics = this.add.graphics();
    for (let row = 0; row < this.state.board.rows; row++) for (let col = 0; col < this.state.board.columns; col++) {
      graphics.fillStyle(toNumber(isDeploymentCell(this.state.board, 'player', { col, row }) ? THEME.color.boardAlly : THEME.color.boardEnemy)).lineStyle(1, toNumber(THEME.color.boardLine));
      graphics.fillPoints(this.layout.corners({ col, row }), true).strokePoints(this.layout.corners({ col, row }), true);
    }
    this.add.text(-2000, 140, `${this.state.board.columns} 列 × ${this.state.board.rows} 行`, { fontSize: '14px', color: '#7e95a4' });
    for (const team of ['enemy', 'player'] as const) {
      const zone = this.state.board.deploymentZones[team];
      const y = (this.layout.center({ col: 0, row: zone.firstRow }).y + this.layout.center({ col: 0, row: zone.lastRow }).y) / 2;
      this.add.text(-2000, y, `${team === 'player' ? '我方部署区' : '敌方部署区'}\nrow ${zone.firstRow}–${zone.lastRow}`, { fontSize: '14px', color: team === 'player' ? '#68ddd0' : '#f08080', lineSpacing: 10 });
    }
    this.add.text(-2000, 575, '商店', { fontSize: '19px', color: '#edf4f3' });
    this.add.text(-2000, 600, '买入备战席', { fontSize: '12px', color: '#7e95a4' });
    for (let slot = 0; slot < MATCH_RULES.shopSize; slot++) {
      this.shopFrames.push(this.add.graphics());
      const button = this.button(`buy-${slot}`, 205 + slot * 106, 568, 102, 52, '', () => {
        this.command(this.session.buy(slot, button.getData('generation')), '购买成功 · 集齐三张同星同名单位自动升星');
      }, 14);
      button.setData('slot', slot);
      button.setVisible(false);
      this.shopButtons.push(button);
    }
    this.add.text(-2000, 641, '备战席', { fontSize: '19px', color: '#edf4f3' });
    this.add.text(-2000, 672, '拖拽部署 · 点击选择', { fontSize: '12px', color: '#7e95a4' });
    for (let slot = 0; slot < this.state.benchSize; slot++) {
      const p = this.benchCenter(slot);
      graphics.fillStyle(toNumber(THEME.color.bench)).lineStyle(1, toNumber(THEME.color.boardLine)).fillRoundedRect(p.x - 26, p.y - 30, 52, 60, 10).strokeRoundedRect(p.x - 26, p.y - 30, 52, 60, 10);
    }
    this.overlay = this.add.graphics().setDepth(5);
    this.status = this.add.text(-2000, 754, '准备就绪 · 购买或部署棋子，再点击 开始战斗', { fontSize: '14px', color: '#9aaeb9', wordWrap: { width: 865 } }).setName('status');
    this.help = new HelpPanel();
    this.strategyPanel = new StrategyPanel({
      help: () => this.help?.show(),
      state: () => this.session.state, shopLock: (locked, generation) => this.command(this.session.shopLock(locked, generation), locked ? '商店已锁定，跨轮保留' : '商店已解锁'), selectedUnit: () => this.selectedId,
      selectUnit: id => { this.selectedId = id; this.syncSelection(); },
      combine: (a, b) => this.command(this.session.combine(a, b), '组件已合成'),
      equip: (item, unit, slot) => this.command(this.session.equip(item, unit, slot), '装备已穿戴 · 将在下次战斗生效'),
      choose: (choice, generation, definition) => this.command(this.session.choose(choice, generation, definition), '永久构筑已选择'),
      target: (choice, generation, unit) => this.command(this.session.anomalyTarget(choice, generation, unit), '异常目标已锁定'),
      rerollAnomaly: (choice, generation) => this.command(this.session.anomalyReroll(choice, generation), '异常选项已刷新 · 扣除 1 金币'),
      buy: (slot, generation) => this.command(this.session.buy(slot, generation), '购买成功'),
      deploy: (id, location) => this.command(this.session.deploy(id, location), '部署成功'),
      control: name => this.panelControl(name),
      unitAt: (x, y) => this.playerUnitAt(x, y), cancelGesture: () => this.clearDrag(),
      status: message => this.setStatus(message),
    }, this.inputRouter);
    this.input.dragDistanceThreshold = 6;
    this.installDragHandlers();
    this.installKeyboardHandlers();
    this.sync();
    this.statsPanel = createStatsPanel(document.getElementById('stats-root')!, id => {
      if (this.application?.debug().mode === 'replay') { this.application.selectReplayUnit(id); return; }
      this.selectedId = id; this.syncSelection(); this.renderActiveStats();
    });
    this.feedback = createCombatFeedbackRenderer(document.getElementById('feedback-root')!);
    this.application = new MatchApplication(this.session, {
      replace: session => {
        this.clearCombatEffects(); this.session = session; this.selectedId = null;
        this.strategyPanel?.reset(); this.recentCombatEvents = []; this.renderedCastCount = 0; this.renderedUpgradeCount = 0;
        this.activeStats = session.combat ? aggregateStats(this.application?.debug().runId ?? '', session.combat.combatId!, session.combatEvents) : null;
        this.feedback?.reset(); this.sync(); this.renderActiveStats();
      }, changed: change => this.observeStats(change),
      playback: (snapshot, record) => {
        if (!snapshot || !record) { this.lastReplaySeq = -1; this.replayRenderKey = ''; this.replayCombat = null; this.feedback?.reset(); this.renderActiveStats(); return; }
        const key = `${record.runId}/${record.combatId}/${snapshot.tick}/${this.application?.replaySelectedUnit}`;
        if (key === this.replayRenderKey) return; this.replayRenderKey = key;
        document.getElementById('stats-root')!.hidden = false;
        // Same numeric floats as live combat: feed only newly played events; seek/switch resets.
        const battle = `${record.runId}/${record.combatId}`, forward = battle === this.replayBattle && this.lastReplaySeq >= 0
          && snapshot.nextEventSeq >= this.lastReplaySeq && snapshot.nextEventSeq - this.lastReplaySeq <= 400;
        if (forward) { if (snapshot.nextEventSeq > this.lastReplaySeq) this.feedback?.push(snapshot.events.slice(this.lastReplaySeq), performance.now()); }
        else this.feedback?.reset();
        this.replayBattle = battle; this.replayCombat = snapshot.combat;
        this.lastReplaySeq = snapshot.nextEventSeq;
        this.statsPanel?.render({ stats: aggregateStats(record.runId, record.combatId, snapshot.events), combat: snapshot.combat,
          events: snapshot.events, selectedUnitId: this.application?.replaySelectedUnit ?? null });
      }, clearInput: () => this.clearCombatEffects(), status: message => this.setStatus(message),
    });
    // Portraits load once the page is idle so they never delay the first usable controls.
    const loadPortraits = () => { if (this.sys.isActive()) loadS13Portraits(this, () => { buildPortraitTextures(this); for (const view of this.views.values()) view.invalidate(); this.reconcileTokens(); }); };
    const idle = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(loadPortraits, { timeout: 1500 }); else window.setTimeout(loadPortraits, 300);
    const debug = Object.freeze({ read: () => this.debugSnapshot() });
    window.__CAT_DEBUG__ = debug;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (window.__CAT_DEBUG__ === debug) delete window.__CAT_DEBUG__;
      this.statsPanel?.dispose(); this.statsPanel = null; this.feedback?.dispose(); this.feedback = null;
      this.application?.dispose(); this.application = null;
      this.strategyPanel?.destroy(); this.strategyPanel = null; this.help?.destroy(); this.help = null;
      this.resetViewReferences();
    });
  }

  private resetViewReferences() {
    this.views.clear(); this.tokens.clear(); this.renderedCells.clear(); this.effects.clear(); this.namedObjects.clear();
    this.shopButtons.length = 0; this.shopFrames.length = 0;
    this.draggingId = null; this.selectedId = null; this.recentCombatEvents = [];
    this.inputRouter.cancel();
  }

  private installKeyboardHandlers() {
    const mousemove = (event: MouseEvent) => {
      const capabilities = (event as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } }).sourceCapabilities;
      if (!capabilities?.firesTouchEvents) this.mouseClient = { x: event.clientX, y: event.clientY };
    };
    const touch = (event: PointerEvent) => { if (event.pointerType === 'touch') this.mouseClient = null; };
    const clearHover = () => { this.mouseClient = null; };
    const mouseout = (event: MouseEvent) => { if (event.relatedTarget === null) clearHover(); };
    window.addEventListener('mousemove', mousemove, true);
    window.addEventListener('pointerdown', touch, true);
    window.addEventListener('mouseout', mouseout, true);
    window.addEventListener('blur', clearHover);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('mousemove', mousemove, true); window.removeEventListener('pointerdown', touch, true);
      window.removeEventListener('mouseout', mouseout, true); window.removeEventListener('blur', clearHover);
      this.mouseClient = null;
    });
    // Native keydown preserves each OS repeat and commits in DOM event order,
    // alongside pointer input, without Phaser's per-frame keyboard queue.
    const keydown = (event: KeyboardEvent) => {
      if (!this.scene.isActive() || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      // Reading help never issues a game command.
      if (this.help?.open) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return;
      if (event.code === 'KeyD') {
        event.preventDefault();
        this.command(this.session.reroll(), '商店已刷新');
      } else if (event.code === 'KeyF') {
        event.preventDefault();
        this.command(this.session.buyXp(), '经验已购买 · 升级增加人口，下一次刷新使用新概率');
      } else if (event.code === 'KeyE') {
        event.preventDefault();
        if (this.strategyPanel?.blocksSell) { this.setStatus('无出售单位目标 · 物品操作不会出售背景单位'); return; }
        const id = this.draggingId ?? this.hoveredId() ?? this.selectedId;
        if (id) this.sell(id);
        else this.setStatus(this.session.phase === 'preparation' ? '请悬停或选择一个我方单位，再按 E' : this.failureMessage('wrong-phase'));
      }
    };
    window.addEventListener('keydown', keydown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', keydown));
  }

  private hoveredId(): string | undefined {
    // D/F can change page layout without another mousemove. Resolve native client
    // coordinates against the current canvas bounds instead of a cached pointer transform.
    const client = this.mouseClient;
    if (!client || document.elementFromPoint(client.x, client.y) !== this.game.canvas) return;
    const rect = this.game.canvas.getBoundingClientRect();
    const point = { x: (client.x - rect.left) * this.scale.gameSize.width / rect.width,
      y: (client.y - rect.top) * this.scale.gameSize.height / rect.height };
    const candidates = [...this.tokens.values()].filter(token => token.visible
      && Math.abs(point.x - token.x) <= 29 * token.scaleX && Math.abs(point.y - token.y) <= 29 * token.scaleY);
    return this.input.sortGameObjects(candidates, this.input.activePointer)[0]?.getData('unitId');
  }

  private sell(id: string) {
    const result = this.session.sell(id);
    // A hover sale must also clear a different old selection: holding E must
    // never unexpectedly sell that unit once the hovered token disappears.
    if (result.ok) this.selectedId = null;
    this.command(result, '出售成功 · 金币已到账');
  }

  private setStatus(message: string) { this.status.setText(message); this.strategyPanel?.status(message); }
  private newMatch() { this.application?.requestNew(); }
  private panelControl(name: 'reroll' | 'buy-xp' | 'sell' | 'start-combat' | 'continue' | 'new-match') {
    if (name === 'new-match') { this.newMatch(); return; }
    if (name === 'reroll') this.command(this.session.reroll(), '商店已刷新');
    if (name === 'buy-xp') this.command(this.session.buyXp(), '经验已购买');
    if (name === 'start-combat') this.command(this.session.start(), '战斗开始');
    if (name === 'continue') this.command(this.session.continue(this.session.state.round), '进入下一回合');
    if (name === 'sell') {
      if (this.selectedId) this.sell(this.selectedId);
      else this.setStatus('请先在单位面板选择一个我方单位');
    }
  }
  private playerUnitAt(x: number, y: number): string | undefined {
    const rect = this.game.canvas.getBoundingClientRect();
    const px = (x - rect.left) * this.scale.gameSize.width / rect.width;
    const py = (y - rect.top) * this.scale.gameSize.height / rect.height;
    return this.state.units.find(unit => unit.team === 'player' && (() => {
      const token = this.tokens.get(unit.id);
      return token?.visible && Math.abs(px - token.x) <= 29 && Math.abs(py - token.y) <= 29;
    })())?.id;
  }

  private button(name: string, x: number, y: number, width: number, height: number, text: string, onClick: () => void, size = 17) {
    const button = this.add.text(x, y, text, { fontSize: `${size}px`, color: '#edf4f3', backgroundColor: '#304653',
      fixedWidth: width, fixedHeight: height, align: 'center', padding: { top: 8 }, lineSpacing: 2 })
      .setName(name).setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    this.namedObjects.set(name, button);
    return button;
  }

  private installDragHandlers() {
    this.input.on('dragstart', (pointer: Phaser.Input.Pointer, token: Phaser.GameObjects.Container) => {
      if (this.session.phase !== 'preparation' || !this.tokens.has(token.getData('unitId'))) return;
      const gesture = this.inputRouter.begin('unit', token.getData('unitId'), pointer.id);
      if (!gesture) return;
      token.setData('gesture', gesture);
      this.draggingId = token.getData('unitId'); this.selectedId = this.draggingId;
      token.setDepth(10).setScale(1.08); this.syncSelection();
    });
    this.input.on('drag', (pointer: Phaser.Input.Pointer, token: Phaser.GameObjects.Container) => {
      if (this.session.phase !== 'preparation' || this.draggingId !== token.getData('unitId')) return;
      if (!token.getData('gesture') || !this.inputRouter.owns(token.getData('gesture')) || pointer.id !== token.getData('gesture').pointerId) return;
      // Center the token on the pointer: Phaser's threshold-delayed drag offset
      // otherwise incorporates the first mouse move and can shift a whole hex.
      const { x, y } = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      token.setPosition(x, y); this.overlay.clear();
      const target = this.target({ x, y });
      if (target) {
        const reason = validateMatchDeployment(this.session.state, token.getData('unitId'), target);
        this.setStatus(reason ? this.failureMessage(reason) : '可放置 · 释放以确认部署');
        this.overlay.lineStyle(3, reason ? 0xf08080 : 0x68ddd0);
        if (target.kind === 'board') this.overlay.strokePoints(this.layout.corners(target.cell), true);
        else { const p = this.benchCenter(target.slot); this.overlay.strokeRoundedRect(p.x - 26, p.y - 30, 52, 60, 10); }
      } else this.setStatus(this.failureMessage('invalid-location'));
    });
    this.input.on('dragend', (pointer: Phaser.Input.Pointer, token: Phaser.GameObjects.Container) => {
      if (this.session.phase !== 'preparation' || this.draggingId !== token.getData('unitId')) return;
      const gesture = token.getData('gesture');
      if (!gesture || pointer.id !== gesture.pointerId) return;
      if (pointer.wasCanceled) { this.clearDrag(); return; }
      if (!this.inputRouter.release(gesture)) return;
      // Read release coordinates directly, even if no final drag frame rendered.
      const target = this.target(pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2);
      if (target) this.command(this.session.deploy(token.getData('unitId'), target), '放置成功 · 可点击选中单位出售');
      else this.setStatus(this.failureMessage('invalid-location'));
      this.clearDrag(); this.sync();
    });
  }
  private benchCenter(slot: number): Point { return { x: 27 + slot * 53.25, y: 480 }; }
  private position(location: UnitLocation): Point { return location.kind === 'board' ? this.layout.center(location.cell) : this.benchCenter(location.slot); }
  private target(point: Point): UnitLocation | undefined {
    const cell = this.layout.hitTest(point);
    if (cell) return { kind: 'board', cell };
    for (let slot = 0; slot < this.state.benchSize; slot++) { const p = this.benchCenter(slot); if (Math.abs(point.x - p.x) <= 26 && Math.abs(point.y - p.y) <= 30) return { kind: 'bench', slot }; }
    return undefined;
  }

  private failureMessage(reason: MatchFailure): string {
    const messages: Record<MatchFailure, string> = {
      'wrong-phase': this.session.phase === 'preparation' ? '当前为准备阶段 · 请布阵或开始战斗'
        : this.session.phase === 'choice' ? '请先完成当前 Augment / Anomaly 选择'
        : this.session.phase === 'combat' ? '正在战斗 · 请等待本轮结算'
        : this.session.phase === 'settlement' ? '本轮已结算 · 点击 继续进入下一回合'
        : 'Game Over · 点击 新局 开始新的一局',
      'unknown-unit': '未找到该单位', 'enemy-unit': '敌方单位不可操作或出售',
      'invalid-location': '请放置到棋盘或备战席内', 'outside-deployment-zone': '只能部署在我方区域，不能放入敌方区域',
      'occupied': '该位置已有单位，请选择空位',
      'missing-player': '无法开始：请先将至少 1 个我方单位部署到棋盘',
      'missing-enemy': '无法开始：棋盘上至少需要 1 个敌方单位',
      'missing-both': '无法开始：棋盘上双方都至少需要 1 个单位',
      'invalid-slot': '商店槽位无效', 'stale-shop': '商店已更新，请选择当前商品', 'purchased-slot': '该商店槽位已经购买',
      'insufficient-gold': '金币不足', 'bench-full': '备战席已满 · 请先部署或出售单位',
      'stale-round': '此回合已结束，请使用当前 Continue', 'unsettled-round': '当前回合尚未结算',
      'max-level': '已达最高等级 · 无需继续购买经验', 'population-cap': '人口已满 · 按 F 升级或先移回一个单位',
      // Equipment-only codes share the preview wording (U3 dynamic; replaces the B5 interim copy).
      ...Object.fromEntries(EQUIPMENT_COMMAND_FAILURES.map(code => [code, EQUIPMENT_FAILURE_TEXT[code]])) as Record<typeof EQUIPMENT_COMMAND_FAILURES[number], string>,
      'stale-choice': '选项已更新，请使用当前卡片', 'invalid-choice': '当前选择无效', 'invalid-target': '请选择一个我方单位',
    };
    return messages[reason];
  }
  private command(result: MatchCommandResult, success: string) {
    if (!result.ok) { this.setStatus(this.failureMessage(result.reason)); return; }
    this.clearCombatEffects();
    if (this.session.phase !== 'preparation') this.selectedId = null;
    if (!this.session.combat) this.recentCombatEvents = [];
    this.sync();
    this.showEvents(result.events.filter((event): event is CombatEvent => 'tick' in event));
    const upgrades = result.events.filter(event => event.type === 'unitUpgraded');
    for (const event of upgrades) {
      const token = this.tokens.get(event.survivorId);
      // A cascade can consume an intermediate survivor in the same transaction.
      // Its immutable event still identifies where to show that upgrade.
      const point = token ?? this.position(event.location);
      const label = this.add.text(point.x, point.y - 52, `${event.toStar}★ 升星`, {
        fontSize: '18px', color: '#ffe39b', fontStyle: 'bold', backgroundColor: '#243341',
      }).setOrigin(0.5).setDepth(20);
      this.fadeEffect(label, 1000); this.renderedUpgradeCount++;
    }
    this.setStatus(upgrades.length ? upgrades.map(event => `${UNIT_DEFINITIONS[event.definitionId].name} → ${event.toStar}★`).join(' · ') + ' · 自动升星成功' : success);
    if (this.session.phase === 'gameOver') this.setStatus(`${this.session.state.outcome === 'victory' ? '胜利 · 最终挑战完成' : '失败 · 对局结束'}，点击 新局 重开`);
    else if (this.session.phase === 'choice') this.setStatus('完成当前三选一后继续运营');
    else if (this.session.phase === 'settlement') this.setStatus('本轮结果已结算 · 点击 继续保留阵容并进入下一回合');
  }

  private reconcileTokens() {
    const ids = new Set(this.state.units.map(unit => unit.id));
    for (const [id, token] of this.tokens) {
      if (ids.has(id)) continue;
      this.views.get(id)?.destroy(); if (token.active) token.destroy();
      this.tokens.delete(id); this.views.delete(id); this.renderedCells.delete(id);
      this.namedObjects.delete(`unit:${id}`);
      if (this.selectedId === id) this.selectedId = null;
    }
    const items = this.session.state.items;
    for (const unit of this.state.units) {
      if (!this.tokens.has(unit.id)) this.createToken(unit);
      const equipped = items.filter(item => item.location.kind === 'unit' && item.location.unitId === unit.id)
        .sort((a, b) => (a.location.kind === 'unit' ? a.location.slot : 0) - (b.location.kind === 'unit' ? b.location.slot : 0)).map(item => item.definitionId);
      this.views.get(unit.id)!.update(unit, equipped);
    }
  }
  private createToken(unit: Unit) {
    const p = this.position(unit.location);
    const view = new UnitView(this, unit, p.x, p.y), token = view.token;
    this.views.set(unit.id, view); this.tokens.set(unit.id, token); this.namedObjects.set(token.name, token);
    if (unit.team === 'player') {
      token.setInteractive({ useHandCursor: true }); this.input.setDraggable(token);
      token.on('pointerdown', () => {
        if (!this.tokens.has(unit.id)) return;
        if (this.inputRouter.current) return;
        this.selectedId = unit.id; this.syncSelection(); this.strategyPanel?.render();
      });
    }
  }

  private sync() {
    this.reconcileTokens(); this.syncHud();
    this.strategyPanel?.render();
    if (this.session.phase !== 'preparation') {
      for (const token of this.tokens.values()) if (token.input) { this.input.setDraggable(token, false); token.disableInteractive(); }
      this.syncCombat(); return;
    }
    for (const unit of this.state.units) {
      const p = this.position(unit.location), token = this.tokens.get(unit.id)!;
      token.setPosition(p.x, p.y).setVisible(true).setAlpha(1).setScale(1).setDepth(0);
      this.views.get(unit.id)!.resetMeters();
      if (token.input) { token.input.enabled = true; this.input.setDraggable(token, true); }
    }
  }
  private syncHud() {
    const match = this.session.state, ready = match.phase === 'preparation';
    this.roundLabel.setText(`${getStageRound(match.round).stage}-${getStageRound(match.round).round}`); this.goldLabel.setText(`金币 ${match.gold}`);
    this.hpLabel.setText(`生命 ${match.playerHp}`);
    this.levelLabel.setText(`等级 ${match.level}`);
    const threshold = getXpToNextLevel(match.level);
    this.xpLabel.setText(threshold === null ? '经验 已满' : `经验 ${match.xp} / ${threshold}`);
    this.oddsLabel.setText(`${match.level} 级搜牌概率 · ${getShopOdds(match.level).map((chance, index) => `${index + 1}费 ${chance}%`).join(' / ')}`);
    this.count.setText(`我方人口 ${getPlayerDeploymentCount(this.state)} / ${getDeploymentCap(match)}`);
    this.startButton.setText(getRoundKind(match.round) === 'supply' ? '领取补给' : '开始战斗');
    this.startButton.setAlpha(this.session.startFailure ? 0.4 : 1).setBackgroundColor('#38695f');
    this.continueButton.setData('round', match.round).setAlpha(match.phase === 'settlement' ? 1 : 0.4);
    this.rerollButton.setAlpha(ready ? 1 : 0.4);
    this.xpButton.setText(threshold === null ? 'F · 已满级' : `F · ${MATCH_RULES.xpPurchaseCost} 金币 → ${MATCH_RULES.xpPurchaseAmount} 经验`).setAlpha(ready && threshold !== null ? 1 : 0.4);
    for (let slot = 0; slot < this.shopButtons.length; slot++) {
      const offer = match.shop.slots[slot], button = this.shopButtons[slot];
      const frame = this.shopFrames[slot].clear().setVisible(false);
      button.setData('generation', match.shop.generation);
      if (offer.status === 'purchased') button.setText('已购买').setBackgroundColor('#1c2934').setAlpha(0.45);
      else {
        const definition = UNIT_DEFINITIONS[offer.definitionId];
        const colors = ['#304653', '#245841', '#28517d', '#634786', '#846230'];
        const borders = [0x7b94a3, 0x68c087, 0x72b6ff, 0xba8bff, 0xffd675];
        button.setText(`${definition.symbol} ${definition.name}\n购买 · ${definition.cost} 金币`).setBackgroundColor(colors[definition.cost - 1]).setAlpha(ready ? 1 : 0.4);
        frame.lineStyle(2, borders[definition.cost - 1], ready ? 1 : 0.4).strokeRect(204 + slot * 106, 567, 104, 54);
      }
    }
    const failure = this.session.startFailure;
    this.startHint.setText(ready ? (failure ? this.failureMessage(failure) : getPlayerDeploymentCount(this.state) === 0 ? '空阵容出战：立即战败\n仍获收入与经验，但会扣 HP' : '阵容就绪，可以开始\n蓝条满后自动施法\n白色盾环吸收伤害') : '');
    this.phaseLabel.setText(ready ? '准备阶段 · 购买 / 出售 / 布阵，再开始战斗。'
      : match.phase === 'choice' ? '构筑选择 · 完成组件 / 强化 / 异常 后继续'
      : match.phase === 'combat' ? '自动战斗 · 积累法力 并施法，商店与部署已锁定'
      : match.phase === 'gameOver' ? `${this.session.state.outcome === 'victory' ? '胜利 · 最终挑战完成' : '失败 · 对局结束'}，点击 新局 重开` : '回合结算 · 收入与经验 已到账，继续进入下一回合');
    if (match.phase === 'settlement' || match.phase === 'gameOver') {
      const labels = { playerWin: '胜利', enemyWin: '失败', draw: '平局', supply: '补给' }, result = match.roundResults.at(-1)!;
      this.resultLabel.setText(match.phase === 'gameOver' ? (match.outcome === 'victory' ? '胜利' : '失败') : labels[result.result]);
      const reason = result.result === 'supply' ? '补给 · 无战斗' : result.result === 'playerWin' ? '胜利 · 不扣 HP' : result.result === 'draw' ? `平局 · 基础伤害 ${result.baseDamage}` : `败局 · 基础 ${result.baseDamage} + 存活 ${result.survivingEnemyCount}`;
      this.incomeLabel.setText(`第 ${result.round} 回合 · ${labels[result.result]}\n收入 +${result.income} 金币 / 经验 +${result.xpAwarded}\n等级 ${result.levelBefore} → ${result.levelAfter}\n生命 ${result.hpBefore} → ${result.hpAfter} (-${result.hpLost})\n${reason}`);
    } else { this.resultLabel.setText(''); this.incomeLabel.setText(''); }
    if (!match.combat) this.timer.setText('');
    this.syncSelection();
  }
  private syncSelection() {
    const selected = this.state.units.find(unit => unit.id === this.selectedId);
    if (!selected) this.selectedId = null;
    const displayId = this.draggingId ?? this.hoveredId() ?? this.selectedId;
    const displayed = this.session.phase === 'preparation' ? this.state.units.find(unit => unit.id === displayId) : undefined;
    if (displayed) {
      const definition = getDefinition(displayed), stats = getUnitStats(displayed.definitionId, displayed.starLevel);
      this.selectionLabel.setText(`${definition.name} ${'★'.repeat(displayed.starLevel)} · ${definition.cost}费\n生命 ${stats.health} / 攻击力 ${stats.attack}\n${displayed.team === 'enemy' ? '敌方 · 不可出售' : `E 售出 +${getUnitSellPrice(displayed)} 金币`}`);
    } else this.selectionLabel.setText('悬停按 E / 点击选择\n集齐三张同星棋子升星');
    this.sellButton.setText(this.selectedId && selected ? `E · 出售 · +${getUnitSellPrice(selected)} 金币` : 'E · 出售');
    this.sellButton.setAlpha(this.selectedId ? 1 : 0.4);
    for (const unit of this.state.units) this.views.get(unit.id)?.setRing(unit.id === this.selectedId ? 'selected' : 'normal', unit.team);
  }
  private observeStats(change: SessionChange) {
    const combat = change.after.combat;
    if (!combat) { this.activeStats = null; this.feedback?.reset(); return; }
    if (!this.activeStats || this.activeStats.combatId !== combat.combatId) {
      this.activeStats = emptyStats(this.application?.debug().runId ?? '', combat.combatId!); this.feedback?.reset();
    }
    this.activeStats = appendStats(this.activeStats, change.events);
    this.feedback?.push(change.events, performance.now());
    if (combat.status === 'finished') this.renderActiveStats();
  }
  private renderActiveStats() {
    document.getElementById('stats-root')!.hidden = !this.activeStats || !this.session.combat;
    if (!this.activeStats || !this.session.combat) return;
    this.statsPanel?.render({ stats: this.activeStats, combat: this.session.combat, events: this.session.combatEvents, selectedUnitId: this.selectedId });
    this.lastStatsRender = performance.now();
  }
  /** Replay floats anchor to the replay canvas, which shares the board's 480×520 geometry. */
  private renderReplayFeedback() {
    const combat = this.replayCombat, overlay = document.querySelector<HTMLCanvasElement>('#board-root .replay-canvas');
    if (!combat || !overlay) return;
    const canvas = overlay.getBoundingClientRect(), host = document.getElementById('feedback-root')!.getBoundingClientRect();
    const scale = canvas.width / BOARD_LAYOUT.width;
    this.feedback?.render(performance.now(), new Map(combat.units.filter(unit => unit.alive).map(unit => {
      const p = this.layout.center(unit.cell);
      return [unit.id, { x: canvas.left - host.left + p.x * scale, y: canvas.top - host.top + p.y * scale, radius: BOARD_LAYOUT.tokenRadius * scale }];
    })), (canvasLabelRects.get(overlay) ?? []).map(rect => ({ x: canvas.left - host.left + rect.x * scale, y: canvas.top - host.top + rect.y * scale, w: rect.w * scale, h: rect.h * scale })));
  }
  private renderFeedback() {
    const canvas = this.game.canvas.getBoundingClientRect(), host = document.getElementById('feedback-root')!.getBoundingClientRect();
    const scale = canvas.width / this.scale.gameSize.width;
    this.feedback?.render(performance.now(), new Map([...this.tokens].filter(([, token]) => token.visible).map(([id,token]) => [id,
      { x: canvas.left - host.left + token.x * scale, y: canvas.top - host.top + token.y * scale, radius: 27 * scale }])),
      this.fx.labelRects().map(rect => ({ x: canvas.left - host.left + rect.x * scale, y: canvas.top - host.top + rect.y * scale, w: rect.w * scale, h: rect.h * scale })));
  }
  update(_time: number, delta: number) {
    if (this.application && !this.application.frame(delta)) { if (document.body.dataset.m6Mode === 'replay') this.renderReplayFeedback(); return; }
    this.renderFeedback();
    if (performance.now() - this.lastStatsRender > 250) this.renderActiveStats();
    if (this.session.phase !== 'combat') { this.syncSelection(); return; }
    const events = this.session.advance(delta);
    this.syncCombat(); this.showEvents(events); this.strategyPanel?.updateCombat();
    // Rewards may leave combat directly for a component choice (for example 2-7).
    // Render every phase exit, including choices, before waiting for more input.
    if (this.session.state.phase !== 'combat') {
      this.syncHud(); this.strategyPanel?.render(); this.setStatus(this.session.state.phase === 'choice' ? '战斗已结算 · 请选择本轮组件奖励' : this.session.state.phase === 'gameOver' ? `${this.session.state.outcome === 'victory' ? '胜利 · 最终挑战完成' : '失败 · 对局结束'}，点击 新局 重开` : '本轮结果已结算 · 点击 继续保留阵容并进入下一回合');
    }
  }
  private clearDrag() {
    this.inputRouter.cancel(); this.strategyPanel?.cancel();
    const dragged = this.state.units.find(unit => unit.id === this.draggingId);
    if (dragged) {
      const point = this.position(dragged.location);
      this.tokens.get(dragged.id)?.setPosition(point.x, point.y);
    }
    this.draggingId = null;
    for (const pointer of this.input.manager.pointers) this.input.setDragState(pointer, 0);
    for (const token of this.tokens.values()) token.setScale(1).setDepth(0);
    this.overlay.clear();
  }
  private clearCombatEffects() {
    this.tweens.killAll();
    for (const effect of this.effects) effect.destroy();
    this.effects.clear(); this.renderedCells.clear(); this.clearDrag();
  }
  private syncCombat() {
    const combat = this.session.combat;
    if (!combat) return;
    for (const unit of this.state.units) {
      const token = this.tokens.get(unit.id)!;
      if (token.input) { this.input.setDraggable(token, false); token.input.enabled = true; }
      if (unit.location.kind === 'bench') token.setAlpha(0.35);
    }
    const selectedTarget = combat.units.find(unit => unit.id === this.selectedId)?.targetId;
    for (const unit of combat.units) {
      const ring: RingState = unit.id === selectedTarget ? 'target' : unit.id === this.selectedId ? 'selected' : 'normal';
      this.views.get(unit.id)?.setRing(ring, unit.team);
      const token = this.tokens.get(unit.id)!;
      token.setVisible(unit.alive);
      const key = `${unit.cell.col},${unit.cell.row}`;
      if (this.renderedCells.get(unit.id) !== key) {
        this.tweens.killTweensOf(token);
        const p = this.layout.center(unit.cell);
        if (this.renderedCells.has(unit.id) && unit.alive && !reducedMotion()) this.tweens.add({ targets: token, x: p.x, y: p.y, duration: 100 });
        else token.setPosition(p.x, p.y);
        this.renderedCells.set(unit.id, key);
      }
      this.views.get(unit.id)?.drawCombat(unit, combat);
    }
    this.timer.setText(`${(combat.tick * COMBAT_TICK_MS / 1000).toFixed(1)}s / ${(combat.maxTicks * COMBAT_TICK_MS / 1000).toFixed(0)}s`);
  }
  private showEvents(events: readonly CombatEvent[]) {
    const combat = this.session.combat;
    if (!combat) return;
    this.strategyPanel?.observeEvents(events);
    this.recentCombatEvents.push(...structuredClone(events));
    if (this.recentCombatEvents.length > 200) this.recentCombatEvents.splice(0, this.recentCombatEvents.length - 200);
    const casts = this.fx.casts;
    this.fx.show(events, combat);
    this.renderedCastCount += this.fx.casts - casts;
  }
  private fadeEffect(effect: Phaser.GameObjects.Graphics | Phaser.GameObjects.Text | Phaser.GameObjects.Arc, duration: number) {
    this.effects.add(effect);
    this.tweens.add({ targets: effect, alpha: 0, duration, onComplete: () => { this.effects.delete(effect); effect.destroy(); } });
  }

  /** Plain copies and client-space coordinates only; no commands or mutable objects. */
  debugSnapshot() {
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = rect.width / this.scale.gameSize.width, scaleY = rect.height / this.scale.gameSize.height;
    const client = (p: Point): Point => ({ x: rect.left + p.x * scaleX, y: rect.top + p.y * scaleY });
    const bounds = Object.fromEntries([...this.namedObjects].map(([name, object]) => {
      const box = object.getBounds(), p = client(box), center = client({ x: box.centerX, y: box.centerY });
      return [name, { x: p.x, y: p.y, width: box.width * scaleX, height: box.height * scaleY, centerX: center.x, centerY: center.y }];
    }));
    const hexes: Record<string, Point> = {};
    for (let row = 0; row < this.state.board.rows; row++) for (let col = 0; col < this.state.board.columns; col++) hexes[`${col},${row}`] = client(this.layout.center({ col, row }));
    const meters = (kind: 'hp' | 'mana' | 'shield') => [...this.views].map(([id, view]) => ({ id,
      visible: (kind === 'hp' ? view.hp : kind === 'mana' ? view.mana : view.shield).visible, ...view.meter(kind) }));
    const strategy = this.strategyPanel?.snapshot();
    Object.assign(bounds, strategy?.bounds ?? {});
    return structuredClone({ state: this.session.state, strategy, m6: this.application?.debug(), stats: this.activeStats,
      tokens: [...this.tokens].map(([id, token]) => ({ id, x: token.x, y: token.y, screenX: client(token).x, screenY: client(token).y,
        visible: token.visible, alpha: token.alpha, draggable: Boolean(token.input?.enabled && token.input.draggable),
        definitionId: token.getData('definitionId'), starLevel: token.getData('starLevel'), cost: token.getData('cost'),
        starLabel: this.views.get(id)!.star.text, name: this.views.get(id)!.name, symbol: this.views.get(id)!.symbol, statusStrip: this.views.get(id)!.statusStrip })),
      health: meters('hp'), mana: meters('mana'),
      shields: meters('shield').map(meter => ({ ...meter, text: this.views.get(meter.id)!.shieldLabel.text, labelVisible: this.views.get(meter.id)!.shieldLabel.visible })),
      hud: { round: this.roundLabel.text, gold: this.goldLabel.text, playerHp: this.hpLabel.text, level: this.levelLabel.text,
        xp: this.xpLabel.text, population: this.count.text, odds: this.oddsLabel.text, result: this.resultLabel.text,
        settlement: this.incomeLabel.text, selection: this.selectionLabel.text, startHint: this.startHint.text },
      recentCombatEvents: this.recentCombatEvents, combatEvents: this.session.combatEvents,
      gesture: this.inputRouter.current, gestureEpoch: this.inputRouter.gestureEpoch,
      renderedCastCount: this.renderedCastCount, renderedUpgradeCount: this.renderedUpgradeCount,
      effects: this.effects.size, tweens: this.tweens.getTweens().length, selectedId: this.selectedId, draggingId: this.draggingId,
      texts: this.children.list.filter((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text).map(child => child.text),
      bounds, layout: { hexes, bench: Array.from({ length: this.state.benchSize }, (_, slot) => client(this.benchCenter(slot))) },
    });
  }
}
