import type { CombatEvent, CombatState } from '../simulation/combat-types';
import { planFx, type FxSpec } from '../presentation/fx-plan';
import { reducedMotion } from '../presentation/preferences';
import { HexLayout } from './hex-layout';
import { BOARD_LAYOUT } from './layout-config';
import { getHeroIdentity } from '../presentation/hero-identity';
import { s13AssetUrl } from '../presentation/s13-assets';
import { THEME, costColor } from '../presentation/theme';
import { statusBadges } from '../presentation/combat-status';
import { canvasLabelRects as labelRects, placeLabel, type LabelRect } from '../presentation/label-layout';

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
  private effects: { spec: FxSpec; start: number; rect?: LabelRect | null }[] = [];
  private consumed = 0;
  private combatId: string | undefined;
  /** Read-only counters for acceptance checks. */
  readonly stats = { specs: 0, casts: 0, attacks: 0 };
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
  /**
   * Feed the playback event prefix. Contiguous forward playback plans feedback for the new
   * events only; seek backwards, large jumps and battle switches drop old effects instead of
   * replaying the whole history at once.
   */
  private consume(state: CombatState, events: readonly CombatEvent[] | undefined, now: number): void {
    if (!events) return;
    if (state.combatId !== this.combatId || events.length < this.consumed || events.length - this.consumed > 400) {
      this.combatId = state.combatId; this.effects = []; this.consumed = events.length; return;
    }
    const fresh = events.slice(this.consumed); this.consumed = events.length;
    for (const spec of planFx(fresh, state, reducedMotion())) {
      this.effects.push({ spec, start: now }); this.stats.specs++;
      if (spec.kind === 'cast') this.stats.casts++;
      if (spec.kind === 'slash' || spec.kind === 'bolt') this.stats.attacks++;
    }
    if (this.effects.length > 120) this.effects.splice(0, this.effects.length - 120);
  }
  render(state: CombatState, selected: string | null = null, events?: readonly CombatEvent[]) {
    const now = performance.now();
    this.consume(state, events, now);
    this.last = { state, selected };
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.fillStyle = '#101923'; ctx.fillRect(0, 0, 480, 520);
    const layout = new HexLayout(state.board, BOARD_LAYOUT.hexRadius, BOARD_LAYOUT.origin);
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
      ctx.lineWidth = 2; ctx.strokeStyle = '#0b151f'; ctx.font = 'bold 11px system-ui, sans-serif';
      if (!identity.neutral) {
        ctx.beginPath(); ctx.arc(p.x - 20, p.y + 18, 8, 0, Math.PI * 2); ctx.fillStyle = costColor(identity.cost); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#0b151f'; ctx.fillText(String(identity.cost), p.x - 20, p.y + 18);
      }
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
        // Same status strip as the live piece, read from this snapshot's own mechanism store.
        const badges = statusBadges(state, unit.id);
        ctx.font = 'bold 10px system-ui, sans-serif';
        for (const [text, align, fg, bg] of [[badges.harmful, -1, '#ffb0a0', '#3a1218e6'], [badges.beneficial, 1, '#9ff0e4', '#0f2e2ae6']] as const) {
          if (!text) continue;
          const w = ctx.measureText(text).width + 4, x = align < 0 ? p.x - 1 - w : p.x + 1;
          ctx.fillStyle = bg; ctx.fillRect(x, p.y + 4, w, 12); ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.fillText(text, x + 2, p.y + 10);
        }
        ctx.textAlign = 'center';
      }
    }
    ctx.globalAlpha = 1;
    this.drawEffects(ctx, layout, state, now);
  }
  private drawEffects(ctx: CanvasRenderingContext2D, layout: HexLayout, state: CombatState, now: number) {
    const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
    this.effects = this.effects.filter(({ spec, start }) => now - start < ('duration' in spec ? spec.duration : 160));
    // Each label takes a free slot on its first frame and keeps it until it fades (same rule as the live board).
    const taken: LabelRect[] = [];
    for (const effect of this.effects) {
      const { spec } = effect;
      if (spec.kind !== 'cast' && spec.kind !== 'label') continue;
      if (effect.rect === undefined) {
        const text = spec.kind === 'cast' ? spec.label : spec.text;
        ctx.font = spec.kind === 'cast' ? 'bold 13px system-ui, sans-serif' : '12px system-ui, sans-serif';
        const w = ctx.measureText(text).width + (spec.kind === 'cast' ? 8 : 6), h = spec.kind === 'cast' ? 17 : 16;
        effect.rect = placeLabel(layout.center(spec.at), w, h, spec.kind === 'cast' ? -58 : spec.dy, taken, { width: 480, height: 520 });
      }
      if (effect.rect) taken.push(effect.rect);
    }
    labelRects.set(this.canvas, taken);
    for (const { spec, start, rect } of this.effects) {
      const age = now - start, life = 'duration' in spec ? spec.duration : 160, alpha = Math.max(0, 1 - age / life);
      ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round';
      if (spec.kind === 'slash') {
        const to = layout.center(spec.at), from = layout.center(spec.from), angle = Math.atan2(to.y - from.y, to.x - from.x);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(to.x, to.y, 20, angle - 0.9, angle + 0.9); ctx.stroke();
        ctx.strokeStyle = hex(spec.color); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(to.x, to.y, 24, angle - 0.7, angle + 0.7); ctx.stroke();
      } else if (spec.kind === 'bolt') {
        const from = layout.center(spec.from), to = layout.center(spec.to);
        if (spec.travel) {
          const t = Math.min(1, age / 140), x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t;
          ctx.fillStyle = hex(spec.color); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else { ctx.strokeStyle = hex(spec.color); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke(); }
      } else if (spec.kind === 'cast') {
        const from = layout.center(spec.at);
        ctx.strokeStyle = hex(spec.color); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(from.x, from.y, 34, 0, Math.PI * 2); ctx.stroke();
        for (const cell of spec.targets) { const to = layout.center(cell); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke(); ctx.beginPath(); ctx.arc(to.x, to.y, 30, 0, Math.PI * 2); ctx.stroke(); }
        if (rect) {
          ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = hex(spec.color); ctx.fillRect(rect.x - rect.w / 2, rect.y - rect.h / 2, rect.w, rect.h); ctx.fillStyle = '#ffffff'; ctx.fillText(spec.label, rect.x, rect.y + 1);
        }
      } else if (spec.kind === 'ring') {
        const p = layout.center(spec.at); ctx.strokeStyle = hex(spec.color); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, spec.radius, 0, Math.PI * 2); ctx.stroke();
      } else if (spec.kind === 'death') {
        const p = layout.center(spec.at); ctx.strokeStyle = C.danger; ctx.fillStyle = C.danger; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI * 2); ctx.stroke();
        ctx.font = 'bold 40px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('×', p.x, p.y);
      } else if (spec.kind === 'label' && rect) {
        ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = spec.background; ctx.fillRect(rect.x - rect.w / 2, rect.y - rect.h / 2, rect.w, rect.h);
        ctx.fillStyle = spec.color; ctx.fillText(spec.text, rect.x, rect.y);
      } else if (spec.kind === 'flash' || spec.kind === 'target') {
        const unit = state.units.find(value => value.id === spec.unitId);
        if (unit?.alive) {
          const p = layout.center(unit.cell); ctx.beginPath(); ctx.arc(p.x, p.y, spec.kind === 'flash' ? 27 : 29, 0, Math.PI * 2);
          if (spec.kind === 'flash') { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill(); } else { ctx.strokeStyle = C.focus; ctx.lineWidth = 3; ctx.stroke(); }
        }
      }
      ctx.restore();
    }
  }
  dispose() { this.disposed = true; this.last = null; this.effects = []; labelRects.delete(this.canvas); this.canvas.remove(); }
}
