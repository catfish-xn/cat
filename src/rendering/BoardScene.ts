import Phaser from 'phaser';
import { createGame, deployUnit, getDefinition, getPlayerDeploymentCount, validateDeployment, type DeploymentFailure } from '../simulation/game';
import { isDeploymentCell } from '../simulation/board';
import type { UnitLocation } from '../simulation/units';
import { HexLayout, type Point } from './hex-layout';

export class BoardScene extends Phaser.Scene {
  private state = createGame();
  private layout = new HexLayout(this.state.board);
  private tokens = new Map<string, Phaser.GameObjects.Container>();
  private overlay!: Phaser.GameObjects.Graphics;
  private status!: Phaser.GameObjects.Text;
  private count!: Phaser.GameObjects.Text;
  constructor() { super('Board'); }
  create() {
    this.add.text(48, 34, 'HEX / 部署实验室', { fontSize: '25px', color: '#edf4f3', fontStyle: 'bold' });
    this.add.text(48, 76, '准备阶段 · 拖拽我方单位到下半场空格或备战席。', { fontSize: '15px', color: '#9aaeb9' });
    this.count = this.add.text(758, 40, '', { fontSize: '16px', color: '#68ddd0' });
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
      const token = this.add.container(p.x, p.y, [disc, label, name]).setSize(58, 58);
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
    this.input.on('dragstart', (_pointer: Phaser.Input.Pointer, token: Phaser.GameObjects.Container) => { token.setDepth(10).setScale(1.08); });
    this.input.on('drag', (_pointer: Phaser.Input.Pointer, token: Phaser.GameObjects.Container, x: number, y: number) => {
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
      const target = this.target(token), result = target ? deployUnit(this.state, token.getData('unitId'), target) : undefined;
      if (result?.ok) { this.state = result.state; this.status.setText('放置成功 · 拖拽单位继续调整阵容'); }
      else this.status.setText(this.failureMessage(result && !result.ok ? result.reason : 'invalid-location'));
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
  private failureMessage(reason: DeploymentFailure): string {
    const messages: Record<DeploymentFailure, string> = {
      'unknown-unit': '未找到该单位',
      'enemy-unit': '玩家不能移动敌方单位',
      'invalid-location': '请放置到棋盘或备战席内',
      'outside-deployment-zone': '只能部署在我方区域，不能放入敌方区域',
      'occupied': '该位置已有单位，请选择空位',
    };
    return messages[reason];
  }
  private sync() {
    for (const unit of this.state.units) { const p = this.position(unit.location); this.tokens.get(unit.id)?.setPosition(p.x, p.y); }
    this.count.setText(`我方部署 ${getPlayerDeploymentCount(this.state)} / ${this.state.units.filter(unit => unit.team === 'player').length}`);
  }
}
