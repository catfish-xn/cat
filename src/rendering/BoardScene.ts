import Phaser from 'phaser';
import { createGame, getDefinition, moveUnit } from '../simulation/game';
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
    this.add.text(48, 76, '拖拽单位到棋盘，开始编排你的阵容。', { fontSize: '15px', color: '#9aaeb9' });
    this.count = this.add.text(758, 40, '', { fontSize: '16px', color: '#68ddd0' });
    const graphics = this.add.graphics();
    for (let row = 0; row < this.state.board.rows; row++) for (let col = 0; col < this.state.board.columns; col++) {
      graphics.fillStyle(row < 3 ? 0x18222e : 0x1b3039).lineStyle(1, 0x36505d);
      graphics.fillPoints(this.layout.corners({ col, row }), true).strokePoints(this.layout.corners({ col, row }), true);
    }
    this.add.text(48, 260, '六边形棋盘\n7 列 × 6 行', { fontSize: '14px', color: '#7e95a4', lineSpacing: 10 });
    this.add.text(48, 508, '备战区', { fontSize: '19px', color: '#edf4f3' });
    this.add.text(48, 541, '可随时将棋盘上的单位拖回空位', { fontSize: '13px', color: '#7e95a4' });
    for (let slot = 0; slot < this.state.benchSize; slot++) {
      const p = this.benchCenter(slot);
      graphics.fillStyle(0x182531).lineStyle(1, 0x36505d).fillRoundedRect(p.x - 37, p.y - 38, 74, 76, 10).strokeRoundedRect(p.x - 37, p.y - 38, 74, 76, 10);
    }
    this.overlay = this.add.graphics();
    this.status = this.add.text(48, 668, '准备就绪 · 支持棋盘移动和返回备战区', { fontSize: '14px', color: '#9aaeb9' });
    for (const unit of this.state.units) {
      const definition = getDefinition(unit), p = this.position(unit.location);
      const disc = this.add.circle(0, 0, 27, definition.color).setStrokeStyle(3, 0x0b151f);
      const label = this.add.text(0, -2, definition.symbol, { fontSize: '23px', color: '#10212c', fontStyle: 'bold' }).setOrigin(0.5);
      const name = this.add.text(0, 35, definition.name, { fontSize: '11px', color: '#c6d8df' }).setOrigin(0.5);
      const token = this.add.container(p.x, p.y, [disc, label, name]).setSize(58, 58).setInteractive({ useHandCursor: true });
      token.setData('unitId', unit.id);
      this.input.setDraggable(token);
      this.tokens.set(unit.id, token);
    }
    this.input.on('dragstart', (_pointer: Phaser.Input.Pointer, token: Phaser.GameObjects.Container) => { token.setDepth(10).setScale(1.08); });
    this.input.on('drag', (_pointer: Phaser.Input.Pointer, token: Phaser.GameObjects.Container, x: number, y: number) => {
      token.setPosition(x, y);
      this.overlay.clear();
      const target = this.target({ x, y });
      if (target) {
        const result = moveUnit(this.state, token.getData('unitId'), target);
        this.overlay.lineStyle(3, result.ok ? 0x68ddd0 : 0xf08080);
        if (target.kind === 'board') this.overlay.strokePoints(this.layout.corners(target.cell), true);
        else { const p = this.benchCenter(target.slot); this.overlay.strokeRoundedRect(p.x - 37, p.y - 38, 74, 76, 10); }
      }
    });
    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, token: Phaser.GameObjects.Container) => {
      const target = this.target(token), result = target ? moveUnit(this.state, token.getData('unitId'), target) : undefined;
      if (result?.ok) { this.state = result.state; this.status.setText('放置成功 · 拖拽单位继续调整阵容'); }
      else this.status.setText(result?.reason === 'occupied' ? '该位置已有单位，请选择空位' : '请放置到棋盘或备战区内');
      this.overlay.clear(); token.setDepth(0).setScale(1); this.sync();
    });
    this.sync();
  }
  private benchCenter(slot: number): Point { return { x: 242 + slot * 80, y: 603 }; }
  private position(location: UnitLocation): Point { return location.kind === 'board' ? this.layout.center(location.cell) : this.benchCenter(location.slot); }
  private target(point: Point): UnitLocation | undefined {
    const cell = this.layout.hitTest(point);
    if (cell) return { kind: 'board', cell };
    for (let slot = 0; slot < this.state.benchSize; slot++) { const p = this.benchCenter(slot); if (Math.abs(point.x - p.x) <= 37 && Math.abs(point.y - p.y) <= 38) return { kind: 'bench', slot }; }
    return undefined;
  }
  private sync() {
    for (const unit of this.state.units) { const p = this.position(unit.location); this.tokens.get(unit.id)?.setPosition(p.x, p.y); }
    this.count.setText(`已部署 ${this.state.units.filter(unit => unit.location.kind === 'board').length} / ${this.state.units.length}`);
  }
}
