import type { CombatState } from '../simulation/combat-types';
import { displayUnitName } from './display-names';
import { HexLayout } from './hex-layout';

/** A presentation-only canvas over isolated playback snapshots. */
export class ReplayView {
  readonly canvas = document.createElement('canvas');
  constructor(host: HTMLElement) {
    this.canvas.width = 480; this.canvas.height = 460;
    this.canvas.className = 'replay-canvas';
    this.canvas.setAttribute('aria-label', '已完成战斗回放棋盘');
    this.canvas.style.cssText = 'position:absolute;inset:0;margin:auto;max-width:100%;max-height:100%;aspect-ratio:480/460;pointer-events:none';
    host.append(this.canvas);
  }
  render(state: CombatState, selected: string | null = null) {
    const ctx = this.canvas.getContext('2d')!;
    ctx.fillStyle = '#101923'; ctx.fillRect(0, 0, 480, 460);
    const layout = new HexLayout(state.board, 34, { x: 35, y: 40 });
    for (let row = 0; row < state.board.rows; row++) for (let col = 0; col < state.board.columns; col++) {
      ctx.beginPath(); layout.corners({ row, col }).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath();
      ctx.fillStyle = row < 4 ? '#30232e' : '#1b3039'; ctx.fill(); ctx.strokeStyle = '#527080'; ctx.stroke();
    }
    for (const unit of state.units) {
      const p = layout.center(unit.cell); ctx.globalAlpha = unit.alive ? 1 : .3;
      ctx.beginPath(); ctx.arc(p.x, p.y, 27, 0, Math.PI * 2);
      ctx.fillStyle = unit.team === 'player' ? '#328879' : '#a64c63'; ctx.fill();
      if (selected === unit.id) { ctx.strokeStyle = '#ffe39b'; ctx.lineWidth = 3; ctx.stroke(); ctx.lineWidth = 1; }
      ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(displayUnitName(unit.definitionId), p.x, p.y);
      ctx.fillText('★'.repeat(unit.starLevel), p.x, p.y + 15);
      ctx.fillStyle = '#223943'; ctx.fillRect(p.x - 25, p.y - 35, 50, 5);
      ctx.fillStyle = '#70db92'; ctx.fillRect(p.x - 25, p.y - 35, 50 * unit.hp / unit.maxHp, 5);
      if (unit.shield) { ctx.fillStyle = '#9fbdff'; ctx.fillText(`盾 ${unit.shield}`, p.x, p.y + 35); }
    }
    ctx.globalAlpha = 1;
  }
  dispose() { this.canvas.remove(); }
}
