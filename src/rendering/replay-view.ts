import type { CombatState } from '../simulation/combat-types';
import { HexLayout } from './hex-layout';
import { getHeroIdentity } from '../presentation/hero-identity';
import { s13AssetUrl } from '../presentation/s13-assets';
import { THEME, costColor } from '../presentation/theme';

const C = THEME.color;
const STAR_COLORS = ['#d39a6a', '#dfe6ec', '#ffd34d'];
const SCALE = 2;
/** Shared, bounded (one per hero) portrait cache; images load once per page. */
const portraits = new Map<string, HTMLImageElement>();

/**
 * A presentation-only canvas over isolated playback snapshots. Uses the same hero identity
 * as the live board (official portrait, else code-drawn color + short name), star/cost/team
 * marks and HP/mana/shield meters, so a replayed battle looks like the one that was played.
 */
export class ReplayView {
  readonly canvas = document.createElement('canvas');
  private last: { state: CombatState; selected: string | null } | null = null;
  private disposed = false;
  constructor(host: HTMLElement) {
    this.canvas.width = 480 * SCALE; this.canvas.height = 520 * SCALE;
    this.canvas.className = 'replay-canvas';
    this.canvas.setAttribute('aria-label', '已完成战斗回放棋盘');
    this.canvas.style.cssText = 'position:absolute;inset:0;margin:auto;max-width:100%;max-height:100%;aspect-ratio:480/520;pointer-events:none';
    host.append(this.canvas);
  }
  private portrait(definitionId: string): HTMLImageElement | null {
    const url = s13AssetUrl('champion', definitionId);
    if (!url) return null;
    let image = portraits.get(definitionId);
    if (!image) {
      image = new Image(); image.src = url; portraits.set(definitionId, image);
    }
    if (!image.complete) {
      image.addEventListener('load', () => { if (!this.disposed && this.last) this.render(this.last.state, this.last.selected); }, { once: true });
      return null;
    }
    return image.naturalWidth ? image : null;
  }
  render(state: CombatState, selected: string | null = null) {
    this.last = { state, selected };
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.fillStyle = '#101923'; ctx.fillRect(0, 0, 480, 520);
    const layout = new HexLayout(state.board, 34, { x: 35, y: 40 });
    for (let row = 0; row < state.board.rows; row++) for (let col = 0; col < state.board.columns; col++) {
      ctx.beginPath(); layout.corners({ row, col }).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath();
      ctx.fillStyle = row < 4 ? C.boardEnemy : C.boardAlly; ctx.fill(); ctx.strokeStyle = C.boardLine; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const unit of state.units) {
      const p = layout.center(unit.cell), identity = getHeroIdentity(unit.definitionId), radius = 27;
      ctx.globalAlpha = unit.alive ? 1 : 0.3;
      ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = identity.color; ctx.fill();
      const image = this.portrait(unit.definitionId);
      if (image) { ctx.clip(); ctx.drawImage(image, p.x - radius, p.y - radius, radius * 2, radius * 2); }
      else { ctx.fillStyle = identity.ink; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.fillText(identity.short, p.x, p.y + 1); }
      ctx.restore();
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.lineWidth = selected === unit.id ? 4 : 3;
      ctx.strokeStyle = selected === unit.id ? '#ffffff' : unit.team === 'enemy' ? C.enemy : '#0b151f'; ctx.stroke();
      // Star row, cost badge and enemy badge mirror the live piece.
      ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = '#0b151fd9';
      const stars = '★'.repeat(unit.starLevel), width = ctx.measureText(stars).width + 6;
      ctx.fillRect(p.x - width / 2, p.y - radius - 6, width, 13);
      ctx.fillStyle = STAR_COLORS[unit.starLevel - 1]; ctx.fillText(stars, p.x, p.y - radius + 1);
      ctx.beginPath(); ctx.arc(p.x - 20, p.y + 18, 8, 0, Math.PI * 2); ctx.fillStyle = costColor(identity.cost); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#0b151f'; ctx.stroke();
      ctx.fillStyle = '#0b151f'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.fillText(String(identity.cost), p.x - 20, p.y + 18);
      if (unit.team === 'enemy') {
        ctx.beginPath(); ctx.arc(p.x + 20, p.y - 19, 9, 0, Math.PI * 2); ctx.fillStyle = C.enemy; ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.fillText('敌', p.x + 20, p.y - 19);
      }
      if (unit.alive) {
        const left = p.x - 26, hp = unit.hp / unit.maxHp, mana = unit.maxMana > 0 ? unit.mana / unit.maxMana : 0, shield = Math.min(1, unit.shield / unit.maxHp);
        ctx.fillStyle = '#091219'; ctx.fillRect(left - 1, p.y - 45, 54, 8); ctx.fillRect(left - 1, p.y - 36, 54, 5);
        ctx.fillStyle = unit.team === 'player' ? C.hp : C.hpEnemy; ctx.fillRect(left, p.y - 44, 52 * hp, 6);
        if (unit.shield > 0) { ctx.fillStyle = C.shield; ctx.fillRect(left + 52 * hp, p.y - 44, Math.max(2, Math.min(52 - 52 * hp, 52 * shield)), 6); }
        ctx.fillStyle = unit.mana === unit.maxMana ? C.manaFull : C.mana; ctx.fillRect(left, p.y - 35, 52 * mana, 3);
        if (unit.shield > 0) { ctx.beginPath(); ctx.arc(p.x, p.y, radius + 3, 0, Math.PI * 2); ctx.strokeStyle = C.shield; ctx.lineWidth = 3; ctx.stroke(); }
      }
    }
    ctx.globalAlpha = 1;
  }
  dispose() { this.disposed = true; this.last = null; this.canvas.remove(); }
}
