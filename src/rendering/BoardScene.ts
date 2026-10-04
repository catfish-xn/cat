import Phaser from 'phaser';
import { getDefinition, getPlayerDeploymentCount, validateDeployment, type DeploymentFailure } from '../simulation/game';
import { isDeploymentCell } from '../simulation/board';
import type { UnitLocation } from '../simulation/units';
import { HexLayout, type Point } from './hex-layout';
import { CombatSession } from './combat-session';
import { COMBAT_TICK_MS, type CombatEvent } from '../simulation/combat';

export class BoardScene extends Phaser.Scene {
  private session = new CombatSession();
  private get state() { return this.session.preparation; }
  private health = new Map<string, Phaser.GameObjects.Graphics>();
  private discs = new Map<string, Phaser.GameObjects.Arc>();
  private renderedCells = new Map<string, string>();
  private effects = new Set<Phaser.GameObjects.GameObject>();
  private draggingId: string | null = null;
  private startButton!: Phaser.GameObjects.Text;
  private resetButton!: Phaser.GameObjects.Text;
  private phaseLabel!: Phaser.GameObjects.Text;
  private resultLabel!: Phaser.GameObjects.Text;
  private timer!: Phaser.GameObjects.Text;
  private layout = new HexLayout(this.state.board);
  private tokens = new Map<string, Phaser.GameObjects.Container>();
  private overlay!: Phaser.GameObjects.Graphics;
  private status!: Phaser.GameObjects.Text;
  private count!: Phaser.GameObjects.Text;
  constructor() { super('Board'); }
  create() {
    this.add.text(48, 34, 'HEX / 部署实验室', { fontSize: '25px', color: '#edf4f3', fontStyle: 'bold' });
    this.phaseLabel = this.add.text(48, 76, '准备阶段 · 拖拽我方单位到下半场空格或备战席。', { fontSize: '15px', color: '#9aaeb9' });
    this.count = this.add.text(758, 40, '', { fontSize: '16px', color: '#68ddd0' });
    this.startButton = this.add.text(728, 210, 'Start Combat', { fontSize: '19px', color: '#10212c', backgroundColor: '#68ddd0', padding: { x: 15, y: 14 } }).setInteractive({ useHandCursor: true });
    this.resetButton = this.add.text(728, 280, 'Reset to\nPreparation', { fontSize: '17px', color: '#edf4f3', backgroundColor: '#304653', padding: { x: 15, y: 12 }, align: 'center' }).setInteractive({ useHandCursor: true });
    this.resultLabel = this.add.text(728, 380, '', { fontSize: '25px', color: '#edf4f3', fontStyle: 'bold' });
    this.timer = this.add.text(728, 430, '', { fontSize: '14px', color: '#9aaeb9' });
    this.startButton.on('pointerdown', () => this.startCombat());
    this.resetButton.on('pointerdown', () => this.resetCombat());
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
    this.add.text(48, 630, '备战席', { fontSize: '19px', color: '#edf4f3' });
    this.add.text(48, 666, '可拖回空备战格', { fontSize: '13px', color: '#7e95a4' });
    for (let slot = 0; slot < this.state.benchSize; slot++) {
      const p = this.benchCenter(slot);
      graphics.fillStyle(0x182531).lineStyle(1, 0x36505d).fillRoundedRect(p.x - 37, p.y - 38, 74, 76, 10).strokeRoundedRect(p.x - 37, p.y - 38, 74, 76, 10);
    }
    this.overlay = this.add.graphics();
    this.status = this.add.text(48, 748, '准备就绪 · 敌方单位不可操作', { fontSize: '14px', color: '#9aaeb9' });
    for (const unit of this.state.units) {
      const definition = getDefinition(unit), p = this.position(unit.location);
      const disc = this.add.circle(0, 0, 27, definition.color).setStrokeStyle(3, unit.team === 'enemy' ? 0xf08080 : 0x0b151f);
      const label = this.add.text(0, -6, definition.symbol, { fontSize: '23px', color: '#10212c', fontStyle: 'bold' }).setOrigin(0.5);
      const name = this.add.text(0, 16, definition.name, { fontSize: '10px', color: '#10212c' }).setOrigin(0.5);
      const hp = this.add.graphics().setVisible(false);
      const token = this.add.container(p.x, p.y, [disc, label, name, hp]).setSize(58, 58);
      this.health.set(unit.id, hp);
      this.discs.set(unit.id, disc);
      token.setData('unitId', unit.id);
      if (unit.team === 'player') {
        token.setInteractive({ useHandCursor: true });
        this.input.setDraggable(token);
      } else {
        token.add(this.add.circle(21, -21, 10, 0xc35364));
        token.add(this.add.text(21, -21, '敌', { fontSize: '11px', color: '#ffffff' }).setOrigin(0.5));
      }
      this.tokens.set(unit.id, token);
    }
    this.input.on('dragstart', (_pointer: Phaser.Input.Pointer, token: Phaser.GameObjects.Container) => {
      if (this.session.phase !== 'preparation') return;
      this.draggingId = token.getData('unitId');
      token.setDepth(10).setScale(1.08);
    });
    this.input.on('drag', (_pointer: Phaser.Input.Pointer, token: Phaser.GameObjects.Container, x: number, y: number) => {
      if (this.session.phase !== 'preparation' || this.draggingId !== token.getData('unitId')) return;
      token.setPosition(x, y);
      this.overlay.clear();
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
      this.draggingId = null;
      const target = this.target(token);
      const reason = target ? this.session.deploy(token.getData('unitId'), target) : 'invalid-location';
      this.status.setText(reason ? this.failureMessage(reason) : '放置成功 · 拖拽单位继续调整阵容');
      this.overlay.clear(); token.setDepth(0).setScale(1); this.sync();
    });
    this.sync();
  }
  private benchCenter(slot: number): Point { return { x: 242 + slot * 80, y: 660 }; }
  private position(location: UnitLocation): Point { return location.kind === 'board' ? this.layout.center(location.cell) : this.benchCenter(location.slot); }
  private target(point: Point): UnitLocation | undefined {
    const cell = this.layout.hitTest(point);
    if (cell) return { kind: 'board', cell };
    for (let slot = 0; slot < this.state.benchSize; slot++) { const p = this.benchCenter(slot); if (Math.abs(point.x - p.x) <= 37 && Math.abs(point.y - p.y) <= 38) return { kind: 'bench', slot }; }
    return undefined;
  }
  private failureMessage(reason: DeploymentFailure | 'combat-active'): string {
    const messages: Record<DeploymentFailure | 'combat-active', string> = {
      'combat-active': '战斗期间不能部署，请先 Reset',
      'unknown-unit': '未找到该单位',
      'enemy-unit': '玩家不能移动敌方单位',
      'invalid-location': '请放置到棋盘或备战席内',
      'outside-deployment-zone': '只能部署在我方区域，不能放入敌方区域',
      'occupied': '该位置已有单位，请选择空位',
    };
    return messages[reason];
  }
  private sync() {
    for (const unit of this.state.units) {
      const p = this.position(unit.location), token = this.tokens.get(unit.id)!;
      token.setPosition(p.x, p.y).setVisible(true).setAlpha(1).setScale(1).setDepth(0);
      this.health.get(unit.id)?.clear().setVisible(false);
      this.discs.get(unit.id)?.setAlpha(1);
      if (token.input) { token.input.enabled = true; this.input.setDraggable(token, true); }
    }
    this.startButton.setAlpha(1);
    this.resetButton.setAlpha(0.4);
    this.phaseLabel.setText('准备阶段 · 拖拽我方单位到下半场空格或备战席。');
    this.resultLabel.setText('');
    this.timer.setText('');
    this.count.setText(`我方部署 ${getPlayerDeploymentCount(this.state)} / ${this.state.units.filter(unit => unit.team === 'player').length}`);
  }
  update(_time: number, delta: number) {
    if (this.session.phase !== 'combat') return;
    const events = this.session.advance(delta);
    this.syncCombat();
    this.showEvents(events);
  }
  private clearCombatEffects() {
    this.tweens.killAll();
    for (const effect of this.effects) effect.destroy();
    this.effects.clear();
    this.renderedCells.clear();
    this.draggingId = null;
    for (const pointer of this.input.manager.pointers) this.input.setDragState(pointer, 0);
    this.overlay.clear();
  }
  private startCombat() {
    if (!this.session.start()) return;
    this.clearCombatEffects();
    this.sync();
    for (const token of this.tokens.values()) {
      if (token.input) { this.input.setDraggable(token, false); token.disableInteractive(); }
    }
    this.startButton.setAlpha(0.4);
    this.resetButton.setAlpha(1);
    this.syncCombat();
  }
  private resetCombat() {
    if (!this.session.reset()) return;
    this.clearCombatEffects();
    this.sync();
    this.status.setText('已恢复本场准备站位 · 可以重新部署并开始下一场');
  }
  private syncCombat() {
    const combat = this.session.combat;
    if (!combat) return;
    for (const unit of this.state.units) {
      if (unit.location.kind === 'bench') this.tokens.get(unit.id)?.setAlpha(0.35);
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
    if (combat.status === 'finished') {
      const labels = { playerWin: 'Victory', enemyWin: 'Defeat', draw: 'Draw' };
      this.resultLabel.setText(combat.result ? labels[combat.result] : '');
      this.phaseLabel.setText('战斗结束 · Reset to Preparation 恢复站位');
      this.status.setText('战斗结果已确定 · 点击 Reset 后可调整阵容并再战');
    } else {
      this.phaseLabel.setText('自动战斗 · 部署已锁定');
      this.status.setText('单位自动寻敌、移动和攻击 · 可随时 Reset 回到准备阶段');
    }
  }
  private showEvents(events: readonly CombatEvent[]) {
    const combat = this.session.combat;
    if (!combat) return;
    for (const event of events) {
      if (event.type === 'attack') {
        const source = combat.units.find(unit => unit.id === event.attackerId);
        const target = combat.units.find(unit => unit.id === event.targetId);
        if (!source || !target) continue;
        const from = this.layout.center(source.cell), to = this.layout.center(target.cell);
        const line = this.add.graphics().setDepth(20);
        line.lineStyle(3, source.team === 'player' ? 0x68ddd0 : 0xf08080, 0.85).lineBetween(from.x, from.y, to.x, to.y);
        this.fadeEffect(line, 180);
      } else if (event.type === 'damage') {
        const disc = this.discs.get(event.unitId);
        if (disc) {
          this.tweens.killTweensOf(disc);
          disc.setAlpha(1);
          this.tweens.add({ targets: disc, alpha: 0.25, duration: 80, yoyo: true });
        }
      } else if (event.type === 'death') {
        const unit = combat.units.find(unit => unit.id === event.unitId);
        if (!unit) continue;
        const p = this.layout.center(unit.cell);
        const cross = this.add.text(p.x, p.y, '×', { fontSize: '42px', color: '#f08080' }).setOrigin(0.5).setDepth(20);
        this.fadeEffect(cross, 500);
      }
    }
  }
  private fadeEffect(effect: Phaser.GameObjects.Graphics | Phaser.GameObjects.Text, duration: number) {
    this.effects.add(effect);
    this.tweens.add({ targets: effect, alpha: 0, duration, onComplete: () => {
      this.effects.delete(effect);
      effect.destroy();
    } });
  }

}
