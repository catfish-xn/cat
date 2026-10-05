import Phaser from 'phaser';
import { getDefinition, getPlayerDeploymentCount } from '../simulation/game';
import { isDeploymentCell } from '../simulation/board';
import { UNIT_DEFINITIONS, type Unit, type UnitLocation } from '../simulation/units';
import { MATCH_RULES, getUnitSellPrice, getUnitStats, getDeploymentCap, getXpToNextLevel, getShopOdds, validateMatchDeployment, type MatchCommandResult, type MatchFailure } from '../simulation/match';
import { COMBAT_TICK_MS, type CombatEvent } from '../simulation/combat';
import { HexLayout, type Point } from './hex-layout';
import { MatchSession } from './match-session';
import { InputRouter } from './input-router';
import { StrategyPanel } from './strategy-panel';

declare global {
  interface Window { __CAT_DEBUG__?: Readonly<{ read: () => ReturnType<BoardScene['debugSnapshot']> }> }
}

export class BoardScene extends Phaser.Scene {
  private session = new MatchSession();
  private inputRouter = new InputRouter();
  private strategyPanel: StrategyPanel | null = null;
  private get state() { return this.session.preparation; }
  private layout = new HexLayout(this.state.board);
  private health = new Map<string, Phaser.GameObjects.Graphics>();
  private mana = new Map<string, Phaser.GameObjects.Graphics>();
  private shields = new Map<string, Phaser.GameObjects.Graphics>();
  private stars = new Map<string, Phaser.GameObjects.Text>();
  private shieldLabels = new Map<string, Phaser.GameObjects.Text>();
  private discs = new Map<string, Phaser.GameObjects.Arc>();
  private tokens = new Map<string, Phaser.GameObjects.Container>();
  private renderedCells = new Map<string, string>();
  private effects = new Set<Phaser.GameObjects.GameObject>();
  private namedObjects = new Map<string, Phaser.GameObjects.Text | Phaser.GameObjects.Container>();
  private draggingId: string | null = null;
  private selectedId: string | null = null;
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
  private renderedCastCount = 0;
  private renderedUpgradeCount = 0;

  constructor() { super('Board'); }
  create() {
    // Phaser reuses the Scene instance on restart but destroys its display list.
    // Keep the authoritative MatchSession; all cached display references must be new.
    this.resetViewReferences();
    this.add.text(48, 28, 'HEX / 自动战棋', { fontSize: '25px', color: '#edf4f3', fontStyle: 'bold' });
    this.phaseLabel = this.add.text(48, 67, '', { fontSize: '14px', color: '#9aaeb9' });
    this.roundLabel = this.add.text(455, 32, '', { fontSize: '21px', color: '#edf4f3' }).setName('round');
    this.goldLabel = this.add.text(600, 32, '', { fontSize: '21px', color: '#e6bc76' }).setName('gold');
    this.hpLabel = this.add.text(756, 32, '', { fontSize: '21px', color: '#f08080' }).setName('player-hp');
    this.levelLabel = this.add.text(756, 70, '', { fontSize: '17px', color: '#edf4f3' }).setName('level');
    this.xpLabel = this.add.text(756, 95, '', { fontSize: '14px', color: '#b4a1f5' }).setName('xp');
    this.oddsLabel = this.add.text(48, 89, '', { fontSize: '12px', color: '#9aaeb9' }).setName('shop-odds');
    this.count = this.add.text(756, 119, '', { fontSize: '14px', color: '#68ddd0' }).setName('population');
    this.startButton = this.button('start-combat', 756, 148, 164, 48, 'Start Combat', () => this.command(this.session.start(), '战斗开始 · 阵容已锁定'));
    this.continueButton = this.button('continue', 756, 207, 164, 48, 'Continue', () => {
      this.command(this.session.continue(this.continueButton.getData('round')), '进入下一回合 · 商店已更新，可继续调整阵容');
    });
    this.resultLabel = this.add.text(756, 269, '', { fontSize: '25px', color: '#edf4f3', fontStyle: 'bold' }).setName('result');
    this.incomeLabel = this.add.text(756, 306, '', { fontSize: '13px', color: '#e6bc76', lineSpacing: 4 });
    this.timer = this.add.text(756, 426, '', { fontSize: '13px', color: '#9aaeb9' });
    this.startHint = this.add.text(756, 308, '', { fontSize: '14px', color: '#9aaeb9', wordWrap: { width: 164 }, lineSpacing: 5 });
    this.selectionLabel = this.add.text(756, 462, '', { fontSize: '13px', color: '#edf4f3', wordWrap: { width: 164 }, lineSpacing: 3 });
    this.sellButton = this.button('sell', 756, 526, 164, 40, 'E · Sell', () => {
      if (this.selectedId === null) {
        this.setStatus(this.session.phase === 'preparation' ? '请先点击一个我方单位，再点击 Sell' : this.failureMessage('wrong-phase'));
        return;
      }
      this.sell(this.selectedId);
    });
    this.rerollButton = this.button('reroll', 756, 577, 164, 40, `D · Reroll · ${MATCH_RULES.rerollCost} G`, () => this.command(this.session.reroll(), '商店已刷新'));
    this.xpButton = this.button('buy-xp', 756, 629, 164, 44, `F · ${MATCH_RULES.xpPurchaseCost} G → ${MATCH_RULES.xpPurchaseAmount} XP`, () => this.command(this.session.buyXp(), '经验已购买 · 升级增加人口，下一次刷新使用新概率'), 15);
    this.button('debug-new-match', 756, 710, 164, 30, 'New Match', () => this.newMatch(), 12);
    const graphics = this.add.graphics();
    for (let row = 0; row < this.state.board.rows; row++) for (let col = 0; col < this.state.board.columns; col++) {
      graphics.fillStyle(isDeploymentCell(this.state.board, 'player', { col, row }) ? 0x1b3039 : 0x30232e).lineStyle(1, 0x36505d);
      graphics.fillPoints(this.layout.corners({ col, row }), true).strokePoints(this.layout.corners({ col, row }), true);
    }
    this.add.text(48, 140, `${this.state.board.columns} 列 × ${this.state.board.rows} 行`, { fontSize: '14px', color: '#7e95a4' });
    for (const team of ['enemy', 'player'] as const) {
      const zone = this.state.board.deploymentZones[team];
      const y = (this.layout.center({ col: 0, row: zone.firstRow }).y + this.layout.center({ col: 0, row: zone.lastRow }).y) / 2;
      this.add.text(48, y, `${team === 'player' ? '我方部署区' : '敌方部署区'}\nrow ${zone.firstRow}–${zone.lastRow}`, { fontSize: '14px', color: team === 'player' ? '#68ddd0' : '#f08080', lineSpacing: 10 });
    }
    this.add.text(48, 575, '商店', { fontSize: '19px', color: '#edf4f3' });
    this.add.text(48, 600, '买入备战席', { fontSize: '12px', color: '#7e95a4' });
    for (let slot = 0; slot < MATCH_RULES.shopSize; slot++) {
      this.shopFrames.push(this.add.graphics());
      const button = this.button(`buy-${slot}`, 205 + slot * 106, 568, 102, 52, '', () => {
        this.command(this.session.buy(slot, button.getData('generation')), '购买成功 · 集齐三张同星同名单位自动升星');
      }, 14);
      button.setData('slot', slot);
      this.shopButtons.push(button);
    }
    this.add.text(48, 641, '备战席', { fontSize: '19px', color: '#edf4f3' });
    this.add.text(48, 672, '拖拽部署 · 点击选择', { fontSize: '12px', color: '#7e95a4' });
    for (let slot = 0; slot < this.state.benchSize; slot++) {
      const p = this.benchCenter(slot);
      graphics.fillStyle(0x182531).lineStyle(1, 0x36505d).fillRoundedRect(p.x - 37, p.y - 38, 74, 76, 10).strokeRoundedRect(p.x - 37, p.y - 38, 74, 76, 10);
    }
    this.overlay = this.add.graphics().setDepth(5);
    this.status = this.add.text(48, 754, '准备就绪 · 购买或部署棋子，再点击 Start Combat', { fontSize: '14px', color: '#9aaeb9', wordWrap: { width: 865 } }).setName('status');
    this.strategyPanel = new StrategyPanel({
      state: () => this.session.state, selectedUnit: () => this.selectedId,
      selectUnit: id => { this.selectedId = id; this.syncSelection(); },
      combine: (a, b) => this.command(this.session.combine(a, b), '组件已合成'),
      equip: (item, unit, slot) => this.command(this.session.equip(item, unit, slot), '装备已穿戴 · 将在下次战斗生效'),
      choose: (choice, generation, definition) => this.command(this.session.choose(choice, generation, definition), '永久构筑已选择'),
      target: (choice, generation, unit) => this.command(this.session.anomalyTarget(choice, generation, unit), 'Anomaly 目标已锁定'),
      rerollAnomaly: (choice, generation) => this.command(this.session.anomalyReroll(choice, generation), 'Anomaly 选项已刷新 · 扣除 2 G'),
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
    const debug = Object.freeze({ read: () => this.debugSnapshot() });
    window.__CAT_DEBUG__ = debug;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (window.__CAT_DEBUG__ === debug) delete window.__CAT_DEBUG__;
      this.strategyPanel?.destroy(); this.strategyPanel = null;
      this.resetViewReferences();
    });
  }

  private resetViewReferences() {
    this.health.clear(); this.mana.clear(); this.shields.clear(); this.stars.clear(); this.shieldLabels.clear();
    this.discs.clear(); this.tokens.clear(); this.renderedCells.clear(); this.effects.clear(); this.namedObjects.clear();
    this.shopButtons.length = 0; this.shopFrames.length = 0;
    this.draggingId = null; this.selectedId = null; this.recentCombatEvents = [];
    this.inputRouter.cancel();
  }

  private installKeyboardHandlers() {
    // Native keydown preserves each OS repeat and commits in DOM event order,
    // alongside pointer input, without Phaser's per-frame keyboard queue.
    const keydown = (event: KeyboardEvent) => {
      if (!this.scene.isActive() || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
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
    const pointer = this.input.activePointer;
    const point = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    // Resolve current geometry in Phaser's click order, including enemy tokens.
    const candidates = this.input.manager.isOver ? [...this.tokens.values()].filter(token =>
      token.visible && Math.abs(point.x - token.x) <= 29 * token.scaleX && Math.abs(point.y - token.y) <= 29 * token.scaleY) : [];
    return this.input.sortGameObjects(candidates, pointer)[0]?.getData('unitId');
  }

  private sell(id: string) {
    const result = this.session.sell(id);
    // A hover sale must also clear a different old selection: holding E must
    // never unexpectedly sell that unit once the hovered token disappears.
    if (result.ok) this.selectedId = null;
    this.command(result, '出售成功 · 金币已到账');
  }

  private setStatus(message: string) { this.status.setText(message); this.strategyPanel?.status(message); }
  private newMatch() {
    this.clearCombatEffects(); this.session.newMatch(); this.selectedId = null;
    this.strategyPanel?.reset();
    this.recentCombatEvents = []; this.renderedCastCount = 0; this.renderedUpgradeCount = 0;
    this.sync(); this.setStatus('已重开整局 · Round 1 / Level 3 / HP 100，成长、金币与阵容已重置');
  }
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
        else { const p = this.benchCenter(target.slot); this.overlay.strokeRoundedRect(p.x - 37, p.y - 38, 74, 76, 10); }
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
  private benchCenter(slot: number): Point { return { x: 242 + slot * 80, y: 660 }; }
  private position(location: UnitLocation): Point { return location.kind === 'board' ? this.layout.center(location.cell) : this.benchCenter(location.slot); }
  private target(point: Point): UnitLocation | undefined {
    const cell = this.layout.hitTest(point);
    if (cell) return { kind: 'board', cell };
    for (let slot = 0; slot < this.state.benchSize; slot++) { const p = this.benchCenter(slot); if (Math.abs(point.x - p.x) <= 37 && Math.abs(point.y - p.y) <= 38) return { kind: 'bench', slot }; }
    return undefined;
  }

  private failureMessage(reason: MatchFailure): string {
    const messages: Record<MatchFailure, string> = {
      'wrong-phase': this.session.phase === 'preparation' ? '当前为准备阶段 · 请布阵或开始战斗'
        : this.session.phase === 'choice' ? '请先完成当前 Augment / Anomaly 选择'
        : this.session.phase === 'combat' ? '正在战斗 · 请等待本轮结算'
        : this.session.phase === 'settlement' ? '本轮已结算 · 点击 Continue 进入下一回合'
        : 'Game Over · 点击 New Match 开始新的一局',
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
      'unknown-item': '物品已不存在', 'item-not-inventory': '只能操作物品备战席中的装备',
      'invalid-recipe': '请选择两件不同的组件实例合成', 'item-slot-occupied': '该装备槽已有物品',
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
    if (this.session.phase === 'gameOver') this.setStatus('Game Over · HP 已归零，点击 New Match 重开');
    else if (this.session.phase === 'choice') this.setStatus('完成当前三选一后继续运营');
    else if (this.session.phase === 'settlement') this.setStatus('本轮结果已结算 · 点击 Continue 保留阵容并进入下一回合');
  }

  private reconcileTokens() {
    const ids = new Set(this.state.units.map(unit => unit.id));
    for (const [id, token] of this.tokens) {
      if (ids.has(id)) continue;
      this.tweens.killTweensOf(token);
      const disc = this.discs.get(id);
      if (disc) this.tweens.killTweensOf(disc);
      token.destroy();
      this.tokens.delete(id); this.health.delete(id); this.discs.delete(id); this.renderedCells.delete(id);
      this.mana.delete(id); this.shields.delete(id); this.stars.delete(id); this.shieldLabels.delete(id);
      this.namedObjects.delete(`unit:${id}`);
      if (this.selectedId === id) this.selectedId = null;
    }
    for (const unit of this.state.units) {
      if (!this.tokens.has(unit.id)) this.createToken(unit);
      const token = this.tokens.get(unit.id)!, definition = getDefinition(unit);
      this.stars.get(unit.id)!.setText('★'.repeat(unit.starLevel));
      (token.getByName('symbol') as Phaser.GameObjects.Text).setText(definition.symbol);
      (token.getByName('unit-name') as Phaser.GameObjects.Text).setText(definition.name);
      this.discs.get(unit.id)!.setFillStyle(definition.color);
      token.setData({ definitionId: unit.definitionId, starLevel: unit.starLevel, cost: definition.cost });
    }
  }
  private createToken(unit: Unit) {
    const definition = getDefinition(unit), p = this.position(unit.location);
    const disc = this.add.circle(0, 0, 27, definition.color).setStrokeStyle(3, unit.team === 'enemy' ? 0xf08080 : 0x0b151f);
    const label = this.add.text(0, -4, definition.symbol, { fontSize: '23px', color: '#10212c', fontStyle: 'bold' }).setOrigin(0.5).setName('symbol');
    const name = this.add.text(0, 16, definition.name, { fontSize: '10px', color: '#10212c' }).setOrigin(0.5).setName('unit-name');
    const star = this.add.text(0, -24, '★'.repeat(unit.starLevel), { fontSize: '11px', color: '#fff1ae', backgroundColor: '#243341' }).setOrigin(0.5);
    const hp = this.add.graphics().setVisible(false);
    const mana = this.add.graphics().setVisible(false), shield = this.add.graphics().setVisible(false);
    const shieldLabel = this.add.text(0, 34, '', { fontSize: '10px', color: '#bcefff', backgroundColor: '#182b38' }).setOrigin(0.5).setVisible(false);
    const token = this.add.container(p.x, p.y, [disc, label, name, star, hp, mana, shield, shieldLabel]).setSize(58, 58).setName(`unit:${unit.id}`);
    this.health.set(unit.id, hp); this.discs.set(unit.id, disc); this.tokens.set(unit.id, token); this.namedObjects.set(token.name, token);
    this.mana.set(unit.id, mana); this.shields.set(unit.id, shield); this.stars.set(unit.id, star); this.shieldLabels.set(unit.id, shieldLabel);
    token.setData('unitId', unit.id);
    if (unit.team === 'player') {
      token.setInteractive({ useHandCursor: true }); this.input.setDraggable(token);
      token.on('pointerdown', () => {
        if (this.session.phase !== 'preparation' || !this.tokens.has(unit.id)) return;
        if (this.inputRouter.current) return;
        this.selectedId = unit.id; this.syncSelection(); this.strategyPanel?.render();
      });
    } else {
      token.add(this.add.circle(21, -21, 10, 0xc35364));
      token.add(this.add.text(21, -21, '敌', { fontSize: '11px', color: '#ffffff' }).setOrigin(0.5));
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
      this.health.get(unit.id)!.clear().setVisible(false); this.discs.get(unit.id)!.setAlpha(1);
      this.mana.get(unit.id)!.clear().setVisible(false);
      this.shields.get(unit.id)!.clear().setVisible(false); this.shieldLabels.get(unit.id)!.setVisible(false).setText('');
      for (const meter of [this.health.get(unit.id)!, this.mana.get(unit.id)!, this.shields.get(unit.id)!]) meter.setData({ value: 0, maxValue: 0, ratio: 0, width: 0 });
      if (token.input) { token.input.enabled = true; this.input.setDraggable(token, true); }
    }
  }
  private syncHud() {
    const match = this.session.state, ready = match.phase === 'preparation';
    this.roundLabel.setText(`Round ${match.round}`); this.goldLabel.setText(`Gold ${match.gold}`);
    this.hpLabel.setText(`HP ${match.playerHp}`);
    this.levelLabel.setText(`Level ${match.level}`);
    const threshold = getXpToNextLevel(match.level);
    this.xpLabel.setText(threshold === null ? 'XP MAX' : `XP ${match.xp} / ${threshold}`);
    this.oddsLabel.setText(`Lv.${match.level} 搜牌概率 · ${getShopOdds(match.level).map((chance, index) => `${index + 1}费 ${chance}%`).join(' / ')}`);
    this.count.setText(`我方人口 ${getPlayerDeploymentCount(this.state)} / ${getDeploymentCap(match)}`);
    this.startButton.setAlpha(this.session.startFailure ? 0.4 : 1).setBackgroundColor('#38695f');
    this.continueButton.setData('round', match.round).setAlpha(match.phase === 'settlement' ? 1 : 0.4);
    this.rerollButton.setAlpha(ready ? 1 : 0.4);
    this.xpButton.setText(threshold === null ? 'F · MAX LEVEL' : `F · ${MATCH_RULES.xpPurchaseCost} G → ${MATCH_RULES.xpPurchaseAmount} XP`).setAlpha(ready && threshold !== null ? 1 : 0.4);
    for (let slot = 0; slot < this.shopButtons.length; slot++) {
      const offer = match.shop.slots[slot], button = this.shopButtons[slot];
      const frame = this.shopFrames[slot].clear();
      button.setData('generation', match.shop.generation);
      if (offer.status === 'purchased') button.setText('已购买\nPurchased').setBackgroundColor('#1c2934').setAlpha(0.45);
      else {
        const definition = UNIT_DEFINITIONS[offer.definitionId];
        const colors = ['#304653', '#245841', '#28517d', '#634786', '#846230'];
        const borders = [0x7b94a3, 0x68c087, 0x72b6ff, 0xba8bff, 0xffd675];
        button.setText(`${definition.symbol} ${definition.name}\nBuy · ${definition.cost} G`).setBackgroundColor(colors[definition.cost - 1]).setAlpha(ready ? 1 : 0.4);
        frame.lineStyle(2, borders[definition.cost - 1], ready ? 1 : 0.4).strokeRect(204 + slot * 106, 567, 104, 54);
      }
    }
    const failure = this.session.startFailure;
    this.startHint.setText(ready ? (failure ? this.failureMessage(failure) : getPlayerDeploymentCount(this.state) === 0 ? '空阵容出战：立即战败\n仍获收入与 XP，但会扣 HP' : '阵容就绪，可以开始\n蓝条满后自动施法\n白色盾环吸收伤害') : '');
    this.phaseLabel.setText(ready ? '准备阶段 · 购买 / 出售 / 布阵，再开始战斗。'
      : match.phase === 'choice' ? '构筑选择 · 完成当前 Augment / Anomaly 后继续'
      : match.phase === 'combat' ? '自动战斗 · 积累 Mana 并施法，商店与部署已锁定'
      : match.phase === 'gameOver' ? 'Game Over · HP 已归零，点击 New Match 重开' : '回合结算 · 收入与 XP 已到账，Continue 进入下一回合');
    if (match.phase === 'settlement' || match.phase === 'gameOver') {
      const labels = { playerWin: 'Victory', enemyWin: 'Defeat', draw: 'Draw' }, result = match.roundResults.at(-1)!;
      this.resultLabel.setText(match.phase === 'gameOver' ? 'Game Over' : labels[result.result]);
      const reason = result.result === 'playerWin' ? '胜利 · 不扣 HP' : result.result === 'draw' ? `平局 · 基础伤害 ${result.baseDamage}` : `败局 · 基础 ${result.baseDamage} + 存活 ${result.survivingEnemyCount}×2`;
      this.incomeLabel.setText(`第 ${result.round} 回合 · ${labels[result.result]}\n收入 +${result.income} G / XP +${result.xpAwarded}\nLv.${result.levelBefore} → ${result.levelAfter}\nHP ${result.hpBefore} → ${result.hpAfter} (-${result.hpLost})\n${reason}`);
    } else { this.resultLabel.setText(''); this.incomeLabel.setText(''); }
    if (!match.combat) this.timer.setText('');
    this.syncSelection();
  }
  private syncSelection() {
    const selected = this.state.units.find(unit => unit.id === this.selectedId && unit.team === 'player');
    if (!selected || this.session.phase !== 'preparation') this.selectedId = null;
    const displayId = this.draggingId ?? this.hoveredId() ?? this.selectedId;
    const displayed = this.session.phase === 'preparation' ? this.state.units.find(unit => unit.id === displayId) : undefined;
    if (displayed) {
      const definition = getDefinition(displayed), stats = getUnitStats(displayed.definitionId, displayed.starLevel);
      this.selectionLabel.setText(`${definition.name} ${'★'.repeat(displayed.starLevel)} · ${definition.cost}费\nHP ${stats.health} / AD ${stats.attack}\n${displayed.team === 'enemy' ? '敌方 · 不可出售' : `E 售出 +${getUnitSellPrice(displayed)} G`}`);
    } else this.selectionLabel.setText('悬停按 E / 点击选择\n集齐三张同星棋子升星');
    this.sellButton.setText(this.selectedId && selected ? `E · Sell · +${getUnitSellPrice(selected)} G` : 'E · Sell');
    this.sellButton.setAlpha(this.selectedId ? 1 : 0.4);
    for (const unit of this.state.units) this.discs.get(unit.id)?.setStrokeStyle(3,
      unit.id === this.selectedId ? 0xffffff : unit.team === 'enemy' ? 0xf08080 : 0x0b151f);
  }
  update(_time: number, delta: number) {
    if (this.session.phase !== 'combat') { this.syncSelection(); return; }
    const events = this.session.advance(delta);
    this.syncCombat(); this.showEvents(events); this.strategyPanel?.updateCombat();
    if (this.session.state.phase === 'settlement' || this.session.state.phase === 'gameOver') {
      this.syncHud(); this.strategyPanel?.render(); this.setStatus(this.session.state.phase === 'gameOver' ? 'Game Over · HP 已归零，点击 New Match 重开' : '本轮结果已结算 · 点击 Continue 保留阵容并进入下一回合');
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
      if (token.input) { this.input.setDraggable(token, false); token.disableInteractive(); }
      if (unit.location.kind === 'bench') token.setAlpha(0.35);
    }
    for (const unit of combat.units) {
      const token = this.tokens.get(unit.id)!;
      token.setVisible(unit.alive);
      const key = `${unit.cell.col},${unit.cell.row}`;
      if (this.renderedCells.get(unit.id) !== key) {
        this.tweens.killTweensOf(token);
        const p = this.layout.center(unit.cell);
        if (this.renderedCells.has(unit.id) && unit.alive) this.tweens.add({ targets: token, x: p.x, y: p.y, duration: 100 });
        else token.setPosition(p.x, p.y);
        this.renderedCells.set(unit.id, key);
      }
      const hp = this.health.get(unit.id)!;
      hp.clear().setVisible(unit.alive);
      const hpRatio = unit.hp / unit.maxHp;
      hp.fillStyle(0x091219).fillRect(-27, -43, 54, 7);
      hp.fillStyle(unit.team === 'player' ? 0x68ddd0 : 0xf08080).fillRect(-26, -42, 52 * hpRatio, 5);
      hp.setData({ value: unit.hp, maxValue: unit.maxHp, ratio: hpRatio, width: 52 * hpRatio });
      const mana = this.mana.get(unit.id)!, manaRatio = unit.mana / unit.maxMana;
      mana.clear().setVisible(unit.alive).fillStyle(0x091219).fillRect(-27, -35, 54, 5);
      mana.fillStyle(unit.mana === unit.maxMana ? 0xbde5ff : 0x449cfa).fillRect(-26, -34, 52 * manaRatio, 3);
      mana.setData({ value: unit.mana, maxValue: unit.maxMana, ratio: manaRatio, width: 52 * manaRatio });
      const shield = this.shields.get(unit.id)!, shieldRatio = Math.min(1, unit.shield / unit.maxHp);
      shield.clear().setVisible(unit.alive && unit.shield > 0);
      shield.lineStyle(3, 0xbcefff).strokeCircle(0, 0, 30);
      shield.fillStyle(0xbcefff).fillRect(-26, -42, 52 * shieldRatio, 2);
      shield.setData({ value: unit.shield, maxValue: unit.maxHp, ratio: shieldRatio, width: 52 * shieldRatio });
      this.shieldLabels.get(unit.id)!.setText(`盾 ${unit.shield}`).setVisible(unit.alive && unit.shield > 0);
    }
    this.timer.setText(`${(combat.tick * COMBAT_TICK_MS / 1000).toFixed(1)}s / ${(combat.maxTicks * COMBAT_TICK_MS / 1000).toFixed(0)}s`);
  }
  private showEvents(events: readonly CombatEvent[]) {
    const combat = this.session.combat;
    if (!combat) return;
    this.recentCombatEvents.push(...structuredClone(events));
    if (this.recentCombatEvents.length > 200) this.recentCombatEvents.splice(0, this.recentCombatEvents.length - 200);
    for (const event of events) {
      if (event.type === 'attack') {
        const source = combat.units.find(unit => unit.id === event.attackerId), target = combat.units.find(unit => unit.id === event.targetId);
        if (!source || !target) continue;
        const from = this.layout.center(source.cell), to = this.layout.center(target.cell), line = this.add.graphics().setDepth(20);
        line.lineStyle(3, source.team === 'player' ? 0x68ddd0 : 0xf08080, 0.85).lineBetween(from.x, from.y, to.x, to.y);
        this.fadeEffect(line, 180);
      } else if (event.type === 'cast') {
        const source = combat.units.find(unit => unit.id === event.sourceId);
        if (!source) continue;
        const from = this.layout.center(source.cell), ability = source.ability;
        const color = ability.kind === 'selfShield' ? 0xbcefff : ability.damageType === 'magic' ? 0xc5a0ff : 0xffc56e;
        const effect = this.add.graphics().setDepth(20).lineStyle(4, color, 0.9).strokeCircle(from.x, from.y, 34);
        for (const id of event.targetIds) {
          const target = combat.units.find(unit => unit.id === id);
          if (!target || target.id === source.id) continue;
          const to = this.layout.center(target.cell);
          effect.lineBetween(from.x, from.y, to.x, to.y).strokeCircle(to.x, to.y, 31);
        }
        this.fadeEffect(effect, 500);
        const label = this.add.text(from.x, from.y - 56, ability.kind === 'selfShield' ? '施法 · 护盾' : ability.damageType === 'magic' ? '施法 · 魔法' : '施法 · 物理', {
          fontSize: '12px', color: Phaser.Display.Color.IntegerToColor(color).rgba, backgroundColor: '#16232d',
        }).setOrigin(0.5).setDepth(20);
        this.fadeEffect(label, 700); this.renderedCastCount++;
      } else if (event.type === 'damage') {
        const disc = this.discs.get(event.unitId);
        if (disc) { this.tweens.killTweensOf(disc); disc.setAlpha(1); this.tweens.add({ targets: disc, alpha: 0.25, duration: 80, yoyo: true }); }
      } else if (event.type === 'death') {
        const unit = combat.units.find(unit => unit.id === event.unitId);
        if (!unit) continue;
        const p = this.layout.center(unit.cell), cross = this.add.text(p.x, p.y, '×', { fontSize: '42px', color: '#f08080' }).setOrigin(0.5).setDepth(20);
        this.fadeEffect(cross, 500);
      } else if (event.type === 'effectTriggered') {
        const unit = combat.units.find(unit => unit.id === event.source.ownerId);
        if (!unit) continue;
        const p = this.layout.center(unit.cell);
        const label = this.add.text(p.x, p.y + 44, `${event.source.sourceKind} · ${event.source.sourceDefinitionId}`, {
          fontSize: '10px', color: '#ffe39b', backgroundColor: '#1b2634',
        }).setOrigin(0.5).setDepth(20);
        this.fadeEffect(label, 700);
      }
    }
  }
  private fadeEffect(effect: Phaser.GameObjects.Graphics | Phaser.GameObjects.Text, duration: number) {
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
    const meters = (map: Map<string, Phaser.GameObjects.Graphics>) => [...map].map(([id, meter]) => ({ id, visible: meter.visible,
      value: meter.getData('value') ?? 0, maxValue: meter.getData('maxValue') ?? 0,
      ratio: meter.getData('ratio') ?? 0, width: meter.getData('width') ?? 0 }));
    const strategy = this.strategyPanel?.snapshot();
    Object.assign(bounds, strategy?.bounds ?? {});
    return structuredClone({ state: this.session.state, strategy,
      tokens: [...this.tokens].map(([id, token]) => ({ id, x: token.x, y: token.y, screenX: client(token).x, screenY: client(token).y,
        visible: token.visible, alpha: token.alpha, draggable: Boolean(token.input?.enabled && token.input.draggable),
        definitionId: token.getData('definitionId'), starLevel: token.getData('starLevel'), cost: token.getData('cost'),
        starLabel: this.stars.get(id)!.text, name: (token.getByName('unit-name') as Phaser.GameObjects.Text).text,
        symbol: (token.getByName('symbol') as Phaser.GameObjects.Text).text })),
      health: meters(this.health), mana: meters(this.mana),
      shields: meters(this.shields).map(meter => ({ ...meter, text: this.shieldLabels.get(meter.id)!.text, labelVisible: this.shieldLabels.get(meter.id)!.visible })),
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
