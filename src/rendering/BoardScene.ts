import Phaser from 'phaser';
import { getDefinition, getPlayerDeploymentCount, validateDeployment } from '../simulation/game';
import { isDeploymentCell } from '../simulation/board';
import { UNIT_DEFINITIONS, type Unit, type UnitLocation } from '../simulation/units';
import { MATCH_RULES, type MatchCommandResult, type MatchFailure } from '../simulation/match';
import { COMBAT_TICK_MS, type CombatEvent } from '../simulation/combat';
import { HexLayout, type Point } from './hex-layout';
import { MatchSession } from './match-session';

declare global {
  interface Window { __CAT_DEBUG__?: Readonly<{ read: () => ReturnType<BoardScene['debugSnapshot']> }> }
}

export class BoardScene extends Phaser.Scene {
  private session = new MatchSession();
  private get state() { return this.session.preparation; }
  private layout = new HexLayout(this.state.board);
  private health = new Map<string, Phaser.GameObjects.Graphics>();
  private discs = new Map<string, Phaser.GameObjects.Arc>();
  private tokens = new Map<string, Phaser.GameObjects.Container>();
  private renderedCells = new Map<string, string>();
  private effects = new Set<Phaser.GameObjects.GameObject>();
  private namedObjects = new Map<string, Phaser.GameObjects.Text | Phaser.GameObjects.Container>();
  private draggingId: string | null = null;
  private selectedId: string | null = null;
  private shopButtons: Phaser.GameObjects.Text[] = [];
  private startButton!: Phaser.GameObjects.Text;
  private continueButton!: Phaser.GameObjects.Text;
  private rerollButton!: Phaser.GameObjects.Text;
  private sellButton!: Phaser.GameObjects.Text;
  private phaseLabel!: Phaser.GameObjects.Text;
  private roundLabel!: Phaser.GameObjects.Text;
  private goldLabel!: Phaser.GameObjects.Text;
  private resultLabel!: Phaser.GameObjects.Text;
  private incomeLabel!: Phaser.GameObjects.Text;
  private selectionLabel!: Phaser.GameObjects.Text;
  private startHint!: Phaser.GameObjects.Text;
  private timer!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Graphics;
  private status!: Phaser.GameObjects.Text;
  private count!: Phaser.GameObjects.Text;

  constructor() { super('Board'); }
  create() {
    this.add.text(48, 28, 'HEX / 自动战棋', { fontSize: '25px', color: '#edf4f3', fontStyle: 'bold' });
    this.phaseLabel = this.add.text(48, 76, '', { fontSize: '15px', color: '#9aaeb9' });
    this.roundLabel = this.add.text(480, 32, '', { fontSize: '21px', color: '#edf4f3' }).setName('round');
    this.goldLabel = this.add.text(650, 32, '', { fontSize: '21px', color: '#e6bc76' }).setName('gold');
    this.count = this.add.text(756, 104, '', { fontSize: '14px', color: '#68ddd0' });
    this.startButton = this.button('start-combat', 756, 148, 164, 48, 'Start Combat', () => this.command(this.session.start(), '战斗开始 · 阵容已锁定'));
    this.continueButton = this.button('continue', 756, 207, 164, 48, 'Continue', () => {
      this.command(this.session.continue(this.continueButton.getData('round')), '进入下一回合 · 商店已更新，可继续调整阵容');
    });
    this.resultLabel = this.add.text(756, 280, '', { fontSize: '25px', color: '#edf4f3', fontStyle: 'bold' });
    this.incomeLabel = this.add.text(756, 315, '', { fontSize: '15px', color: '#e6bc76', lineSpacing: 5 });
    this.timer = this.add.text(756, 366, '', { fontSize: '14px', color: '#9aaeb9' });
    this.startHint = this.add.text(756, 400, '', { fontSize: '14px', color: '#9aaeb9', wordWrap: { width: 165 }, lineSpacing: 5 });
    this.selectionLabel = this.add.text(756, 494, '', { fontSize: '14px', color: '#edf4f3', wordWrap: { width: 165 } });
    this.sellButton = this.button('sell', 756, 526, 164, 40, `Sell · +${MATCH_RULES.sellPrice} G`, () => {
      if (this.selectedId === null) {
        this.status.setText(this.session.phase === 'preparation' ? '请先点击一个我方单位，再点击 Sell' : this.failureMessage('wrong-phase'));
        return;
      }
      this.command(this.session.sell(this.selectedId), '出售成功 · 金币已到账');
    });
    this.rerollButton = this.button('reroll', 756, 577, 164, 40, `Reroll · ${MATCH_RULES.rerollCost} G`, () => this.command(this.session.reroll(), '商店已刷新'));
    this.button('debug-new-match', 756, 710, 164, 30, 'Debug New Match', () => {
      this.session.newMatch();
      this.clearCombatEffects();
      this.selectedId = null;
      this.sync();
      this.status.setText('已重开整局 · Round 1，金币、商店和阵容全部重置');
    }, 12);
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
      const button = this.button(`buy-${slot}`, 205 + slot * 106, 568, 102, 52, '', () => {
        this.command(this.session.buy(slot, button.getData('generation')), '购买成功 · 单位已加入第一个空备战格');
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
    this.input.dragDistanceThreshold = 6;
    this.installDragHandlers();
    this.sync();
    const debug = Object.freeze({ read: () => this.debugSnapshot() });
    window.__CAT_DEBUG__ = debug;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (window.__CAT_DEBUG__ === debug) delete window.__CAT_DEBUG__;
    });
  }

  private button(name: string, x: number, y: number, width: number, height: number, text: string, onClick: () => void, size = 17) {
    const button = this.add.text(x, y, text, { fontSize: `${size}px`, color: '#edf4f3', backgroundColor: '#304653',
      fixedWidth: width, fixedHeight: height, align: 'center', padding: { top: 8 }, lineSpacing: 2 })
      .setName(name).setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    this.namedObjects.set(name, button);
    return button;
  }

  private installDragHandlers() {
    this.input.on('dragstart', (_pointer: Phaser.Input.Pointer, token: Phaser.GameObjects.Container) => {
      if (this.session.phase !== 'preparation' || !this.tokens.has(token.getData('unitId'))) return;
      this.draggingId = token.getData('unitId'); this.selectedId = this.draggingId;
      token.setDepth(10).setScale(1.08); this.syncSelection();
    });
    this.input.on('drag', (_pointer: Phaser.Input.Pointer, token: Phaser.GameObjects.Container, x: number, y: number) => {
      if (this.session.phase !== 'preparation' || this.draggingId !== token.getData('unitId')) return;
      token.setPosition(x, y); this.overlay.clear();
      const target = this.target({ x, y });
      if (target) {
        const reason = validateDeployment(this.state, token.getData('unitId'), target);
        this.status.setText(reason ? this.failureMessage(reason) : '可放置 · 释放以确认部署');
        this.overlay.lineStyle(3, reason ? 0xf08080 : 0x68ddd0);
        if (target.kind === 'board') this.overlay.strokePoints(this.layout.corners(target.cell), true);
        else { const p = this.benchCenter(target.slot); this.overlay.strokeRoundedRect(p.x - 37, p.y - 38, 74, 76, 10); }
      } else this.status.setText(this.failureMessage('invalid-location'));
    });
    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, token: Phaser.GameObjects.Container) => {
      if (this.session.phase !== 'preparation' || this.draggingId !== token.getData('unitId')) return;
      const target = this.target(token);
      if (target) this.command(this.session.deploy(token.getData('unitId'), target), '放置成功 · 可点击选中单位出售');
      else this.status.setText(this.failureMessage('invalid-location'));
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
      'wrong-phase': '当前阶段不可操作 · 请等待战斗结束后点击 Continue',
      'unknown-unit': '未找到该单位', 'enemy-unit': '敌方单位不可操作或出售',
      'invalid-location': '请放置到棋盘或备战席内', 'outside-deployment-zone': '只能部署在我方区域，不能放入敌方区域',
      'occupied': '该位置已有单位，请选择空位',
      'missing-player': '无法开始：请先将至少 1 个我方单位部署到棋盘',
      'missing-enemy': '无法开始：棋盘上至少需要 1 个敌方单位',
      'missing-both': '无法开始：棋盘上双方都至少需要 1 个单位',
      'invalid-slot': '商店槽位无效', 'stale-shop': '商店已更新，请选择当前商品', 'purchased-slot': '该商店槽位已经购买',
      'insufficient-gold': '金币不足', 'bench-full': '备战席已满 · 请先部署或出售单位',
      'stale-round': '此回合已结束，请使用当前 Continue', 'unsettled-round': '当前回合尚未结算',
    };
    return messages[reason];
  }
  private command(result: MatchCommandResult, success: string) {
    if (!result.ok) { this.status.setText(this.failureMessage(result.reason)); return; }
    this.clearCombatEffects();
    if (this.session.phase !== 'preparation') this.selectedId = null;
    this.sync(); this.status.setText(success);
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
      this.namedObjects.delete(`unit:${id}`);
      if (this.selectedId === id) this.selectedId = null;
    }
    for (const unit of this.state.units) if (!this.tokens.has(unit.id)) this.createToken(unit);
  }
  private createToken(unit: Unit) {
    const definition = getDefinition(unit), p = this.position(unit.location);
    const disc = this.add.circle(0, 0, 27, definition.color).setStrokeStyle(3, unit.team === 'enemy' ? 0xf08080 : 0x0b151f);
    const label = this.add.text(0, -6, definition.symbol, { fontSize: '23px', color: '#10212c', fontStyle: 'bold' }).setOrigin(0.5);
    const name = this.add.text(0, 16, definition.name, { fontSize: '10px', color: '#10212c' }).setOrigin(0.5);
    const hp = this.add.graphics().setVisible(false);
    const token = this.add.container(p.x, p.y, [disc, label, name, hp]).setSize(58, 58).setName(`unit:${unit.id}`);
    this.health.set(unit.id, hp); this.discs.set(unit.id, disc); this.tokens.set(unit.id, token); this.namedObjects.set(token.name, token);
    token.setData('unitId', unit.id);
    if (unit.team === 'player') {
      token.setInteractive({ useHandCursor: true }); this.input.setDraggable(token);
      token.on('pointerdown', () => {
        if (this.session.phase !== 'preparation' || !this.tokens.has(unit.id)) return;
        this.selectedId = unit.id; this.syncSelection();
      });
    } else {
      token.add(this.add.circle(21, -21, 10, 0xc35364));
      token.add(this.add.text(21, -21, '敌', { fontSize: '11px', color: '#ffffff' }).setOrigin(0.5));
    }
  }

  private sync() {
    this.reconcileTokens(); this.syncHud();
    if (this.session.phase !== 'preparation') { this.syncCombat(); return; }
    for (const unit of this.state.units) {
      const p = this.position(unit.location), token = this.tokens.get(unit.id)!;
      token.setPosition(p.x, p.y).setVisible(true).setAlpha(1).setScale(1).setDepth(0);
      this.health.get(unit.id)!.clear().setVisible(false); this.discs.get(unit.id)!.setAlpha(1);
      if (token.input) { token.input.enabled = true; this.input.setDraggable(token, true); }
    }
  }
  private syncHud() {
    const match = this.session.state, ready = match.phase === 'preparation';
    this.roundLabel.setText(`Round ${match.round}`); this.goldLabel.setText(`Gold ${match.gold}`);
    this.count.setText(`我方部署 ${getPlayerDeploymentCount(this.state)} / ${this.state.units.filter(unit => unit.team === 'player').length}`);
    this.startButton.setAlpha(this.session.startFailure ? 0.4 : 1).setBackgroundColor('#38695f');
    this.continueButton.setData('round', match.round).setAlpha(match.phase === 'settlement' ? 1 : 0.4);
    this.rerollButton.setAlpha(ready ? 1 : 0.4);
    for (let slot = 0; slot < this.shopButtons.length; slot++) {
      const offer = match.shop.slots[slot], button = this.shopButtons[slot];
      button.setData('generation', match.shop.generation);
      if (offer.status === 'purchased') button.setText('已购买\nPurchased').setBackgroundColor('#1c2934').setAlpha(0.45);
      else {
        const definition = UNIT_DEFINITIONS[offer.definitionId];
        button.setText(`${definition.symbol} ${definition.name}\nBuy · ${MATCH_RULES.buyPrice} G`).setBackgroundColor('#304653').setAlpha(ready ? 1 : 0.4);
      }
    }
    const failure = this.session.startFailure;
    this.startHint.setText(ready ? (failure ? this.failureMessage(failure) : '双方已部署，可以开始') : '');
    this.phaseLabel.setText(ready ? '准备阶段 · 购买 / 出售 / 布阵，再开始战斗。'
      : match.phase === 'combat' ? '自动战斗 · 商店与部署已锁定' : '回合结算 · 收入已到账，Continue 进入下一回合');
    if (match.phase === 'settlement') {
      const labels = { playerWin: 'Victory', enemyWin: 'Defeat', draw: 'Draw' }, result = match.roundResults.at(-1)!;
      this.resultLabel.setText(labels[result.result]); this.incomeLabel.setText(`第 ${result.round} 回合\n本轮收入 +${result.income} G`);
    } else { this.resultLabel.setText(''); this.incomeLabel.setText(''); }
    if (!match.combat) this.timer.setText('');
    this.syncSelection();
  }
  private syncSelection() {
    const selected = this.state.units.find(unit => unit.id === this.selectedId && unit.team === 'player');
    if (!selected || this.session.phase !== 'preparation') this.selectedId = null;
    this.selectionLabel.setText(this.selectedId && selected ? `已选择：${getDefinition(selected).name}` : '点击我方单位以出售');
    this.sellButton.setAlpha(this.selectedId ? 1 : 0.4);
    for (const unit of this.state.units) this.discs.get(unit.id)?.setStrokeStyle(3,
      unit.id === this.selectedId ? 0xffffff : unit.team === 'enemy' ? 0xf08080 : 0x0b151f);
  }
  update(_time: number, delta: number) {
    if (this.session.phase !== 'combat') return;
    const events = this.session.advance(delta);
    this.syncCombat(); this.showEvents(events);
    if (this.session.state.phase === 'settlement') {
      this.syncHud(); this.status.setText('本轮结果已结算 · 点击 Continue 保留阵容并进入下一回合');
    }
  }
  private clearDrag() {
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
      hp.fillStyle(0x091219).fillRect(-27, -39, 54, 7);
      hp.fillStyle(unit.team === 'player' ? 0x68ddd0 : 0xf08080).fillRect(-26, -38, 52 * unit.hp / unit.maxHp, 5);
    }
    this.timer.setText(`${(combat.tick * COMBAT_TICK_MS / 1000).toFixed(1)}s / ${(combat.maxTicks * COMBAT_TICK_MS / 1000).toFixed(0)}s`);
  }
  private showEvents(events: readonly CombatEvent[]) {
    const combat = this.session.combat;
    if (!combat) return;
    for (const event of events) {
      if (event.type === 'attack') {
        const source = combat.units.find(unit => unit.id === event.attackerId), target = combat.units.find(unit => unit.id === event.targetId);
        if (!source || !target) continue;
        const from = this.layout.center(source.cell), to = this.layout.center(target.cell), line = this.add.graphics().setDepth(20);
        line.lineStyle(3, source.team === 'player' ? 0x68ddd0 : 0xf08080, 0.85).lineBetween(from.x, from.y, to.x, to.y);
        this.fadeEffect(line, 180);
      } else if (event.type === 'damage') {
        const disc = this.discs.get(event.unitId);
        if (disc) { this.tweens.killTweensOf(disc); disc.setAlpha(1); this.tweens.add({ targets: disc, alpha: 0.25, duration: 80, yoyo: true }); }
      } else if (event.type === 'death') {
        const unit = combat.units.find(unit => unit.id === event.unitId);
        if (!unit) continue;
        const p = this.layout.center(unit.cell), cross = this.add.text(p.x, p.y, '×', { fontSize: '42px', color: '#f08080' }).setOrigin(0.5).setDepth(20);
        this.fadeEffect(cross, 500);
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
    return structuredClone({ state: this.session.state,
      tokens: [...this.tokens].map(([id, token]) => ({ id, x: token.x, y: token.y, screenX: client(token).x, screenY: client(token).y,
        visible: token.visible, alpha: token.alpha, draggable: Boolean(token.input?.enabled && token.input.draggable) })),
      health: [...this.health].map(([id, hp]) => ({ id, visible: hp.visible })),
      effects: this.effects.size, tweens: this.tweens.getTweens().length, selectedId: this.selectedId, draggingId: this.draggingId,
      texts: this.children.list.filter((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text).map(child => child.text),
      bounds, layout: { hexes, bench: Array.from({ length: this.state.benchSize }, (_, slot) => client(this.benchCenter(slot))) },
    });
  }
}
