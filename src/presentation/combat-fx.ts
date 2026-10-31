/**
 * M7 combat feedback. `planFx` is the single read-only mapping from authoritative
 * CombatEvents to visual specs; the live Phaser board (`CombatFx`) and the replay canvas
 * (`ReplayView`) both draw these specs, so a replayed battle shows the same feedback.
 * Numeric floats (damage/shield/heal amounts) belong to the DOM feedback renderer only;
 * specs here are shapes and short labels. Nothing feeds back into Match/Combat.
 */
import Phaser from 'phaser';
import type { DisplayCombat, SceneCombatEvent } from './combat-display';
import type { HexCell } from '../simulation/board';
import { THEME, toNumber } from './theme';
import type { UnitView } from './unit-view';
import { reducedMotion } from './preferences';
import { planFx } from './fx-plan';
import { placeLabel, type LabelRect } from './label-layout';
export { planFx, type FxSpec } from './fx-plan';

type Point = { x: number; y: number };
const C = THEME.color;

type Fadeable = Phaser.GameObjects.Graphics | Phaser.GameObjects.Text | Phaser.GameObjects.Arc | Phaser.GameObjects.Container;
/** Live slash, bolt, cast and ring shapes. Past this, new shapes are dropped; lunges and flashes still run. */
export const MAX_LIVE_BOARD_FX = 48;
export interface CombatFxHost {
  readonly scene: Phaser.Scene;
  center(cell: HexCell): Point;
  view(id: string): UnitView | undefined;
  /** Registers an effect for scene-owned cleanup and fades it out over `duration`. */
  fade(effect: Fadeable, duration: number): void;
}

/** Phaser backend for the live board. */
export class CombatFx {
  casts = 0;
  /**
   * False while another layer draws the board (the 3D view covers the 2D canvas): the pieces still lunge, flash and
   * ring as the plan says, but no slash, bolt, ring or label is built just to be faded unseen.
   */
  drawn = true;
  private labels: { rect: LabelRect; text: Phaser.GameObjects.Text }[] = [];
  private liveShapes = 0;
  private readonly spareGraphics: Phaser.GameObjects.Graphics[] = [];
  private readonly spareCircles: Phaser.GameObjects.Arc[] = [];
  private readonly spareTexts: Phaser.GameObjects.Text[] = [];
  private readonly activeShapes = new Set<Phaser.GameObjects.Graphics | Phaser.GameObjects.Arc>();
  constructor(private readonly host: CombatFxHost) {}

  /** Drops every pooled shape. Call when the scene kills tweens, so a finished fade cannot revive one. */
  releaseAll(): void {
    const held = [...this.activeShapes];
    this.activeShapes.clear(); this.liveShapes = 0;
    for (const shape of held) shape.destroy();
    for (const shape of this.spareGraphics) shape.destroy();
    for (const shape of this.spareCircles) shape.destroy();
    this.spareGraphics.length = 0; this.spareCircles.length = 0;
    for (const label of this.labels) if (label.text.scene) label.text.destroy();
    this.labels = [];
    for (const text of this.spareTexts) text.destroy();
    this.spareTexts.length = 0;
  }

  private takeGraphics(): Phaser.GameObjects.Graphics | null {
    if (this.liveShapes >= MAX_LIVE_BOARD_FX) return null;
    while (this.spareGraphics.length > 0 && !this.spareGraphics[this.spareGraphics.length - 1]?.scene) this.spareGraphics.pop();
    const graphic = this.spareGraphics.pop() ?? this.host.scene.add.graphics();
    graphic.clear().setActive(true).setVisible(true).setAlpha(1).setDepth(20);
    this.liveShapes++;
    return graphic;
  }

  private takeCircle(x: number, y: number, radius: number, color: number): Phaser.GameObjects.Arc | null {
    if (this.liveShapes >= MAX_LIVE_BOARD_FX) return null;
    while (this.spareCircles.length > 0 && !this.spareCircles[this.spareCircles.length - 1]?.scene) this.spareCircles.pop();
    const pooled = this.spareCircles.pop();
    const bolt = pooled ? pooled.setPosition(x, y).setRadius(radius).setFillStyle(color) : this.host.scene.add.circle(x, y, radius, color);
    bolt.setActive(true).setVisible(true).setAlpha(1).setDepth(20);
    this.liveShapes++;
    return bolt;
  }

  private fadeShape(shape: Phaser.GameObjects.Graphics | Phaser.GameObjects.Arc, duration: number, circle: boolean): void {
    this.activeShapes.add(shape);
    this.host.scene.tweens.add({ targets: shape, alpha: 0, duration, onComplete: () => {
      if (!this.activeShapes.delete(shape)) return;
      this.liveShapes = Math.max(0, this.liveShapes - 1);
      if (!shape.scene) return;
      shape.setVisible(false);
      if (circle) this.spareCircles.push(shape as Phaser.GameObjects.Arc);
      else this.spareGraphics.push(shape as Phaser.GameObjects.Graphics);
    } });
  }

  /** Live label rects (board logical coordinates) for the numeric floats to avoid. */
  labelRects(): LabelRect[] {
    this.labels = this.labels.filter(label => label.text.active);
    return this.labels.map(label => label.rect);
  }

  /** A short label from the spare list, or a new text when the list is empty. */
  private takeText(x: number, y: number, content: string, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    while (this.spareTexts.length > 0 && !this.spareTexts[this.spareTexts.length - 1]?.scene) this.spareTexts.pop();
    const pooled = this.spareTexts.pop();
    if (pooled) return pooled.setText(content).setStyle(style).setPosition(x, y).setOrigin(0.5).setAlpha(1).setVisible(true).setActive(true).setDepth(21);
    return this.host.scene.add.text(x, y, content, style).setOrigin(0.5).setDepth(21);
  }
  /** Returns a label to the spare list. A destroyed scene (combat cleanup) drops it. */
  private recycleText(text: Phaser.GameObjects.Text): void {
    if (!text.scene) return;
    text.setVisible(false).setActive(false);
    this.spareTexts.push(text);
  }
  /** Places a label in a free slot near `anchor`, or returns it to the pool when the area is full. */
  private place(text: Phaser.GameObjects.Text, anchor: Point, dy: number, duration: number): void {
    const { width, height } = this.host.scene.scale;
    const rect = placeLabel(anchor, text.width, text.height, dy, this.labelRects(), { width, height });
    if (!rect) { this.recycleText(text); return; }
    text.setPosition(rect.x, rect.y); this.labels.push({ rect, text });
    this.host.scene.tweens.add({ targets: text, alpha: 0, duration, onComplete: () => {
      this.labels = this.labels.filter(label => label.text !== text);
      this.recycleText(text);
    } });
  }

  show(events: readonly SceneCombatEvent[], combat: DisplayCombat): void {
    const { scene } = this.host, add = scene.add, at = (cell: HexCell) => this.host.center(cell);
    for (const spec of planFx(events, combat, reducedMotion())) {
      if (spec.kind === 'slash') {
        const to = at(spec.at), from = at(spec.from), angle = Math.atan2(to.y - from.y, to.x - from.x);
        this.host.view(spec.sourceId)?.attack(to.x - from.x, to.y - from.y, false);
        if (!this.drawn) continue;
        const slash = this.takeGraphics();
        if (!slash) continue;
        slash.lineStyle(4, 0xffffff, 0.9);
        slash.beginPath(); slash.arc(to.x, to.y, 20, angle - 0.9, angle + 0.9); slash.strokePath();
        slash.lineStyle(2, spec.color, 1).beginPath(); slash.arc(to.x, to.y, 24, angle - 0.7, angle + 0.7); slash.strokePath();
        this.fadeShape(slash, spec.duration, false);
      } else if (spec.kind === 'bolt') {
        const from = at(spec.from), to = at(spec.to);
        this.host.view(spec.sourceId)?.attack(to.x - from.x, to.y - from.y, true);
        if (!this.drawn) continue;
        if (spec.travel) {
          const bolt = this.takeCircle(from.x, from.y, 5, spec.color);
          if (!bolt) continue;
          bolt.setStrokeStyle(2, 0xffffff);
          scene.tweens.add({ targets: bolt, x: to.x, y: to.y, duration: 140 });
          this.fadeShape(bolt, spec.duration, true);
        } else {
          const line = this.takeGraphics();
          if (!line) continue;
          line.lineStyle(2, spec.color, 0.7).lineBetween(from.x, from.y, to.x, to.y);
          this.fadeShape(line, spec.duration, false);
        }
      } else if (spec.kind === 'cast') {
        this.casts++;
        if (!this.drawn) continue;
        const from = at(spec.at);
        const effect = this.takeGraphics();
        if (!effect) continue;
        effect.lineStyle(5, spec.color, 0.95).strokeCircle(from.x, from.y, 34).lineStyle(2, 0xffffff, 0.8).strokeCircle(from.x, from.y, 38);
        for (const cell of spec.targets) { const to = at(cell); effect.lineStyle(3, spec.color, 0.85).lineBetween(from.x, from.y, to.x, to.y).strokeCircle(to.x, to.y, 30); }
        // I3: rings only; the 14.24 client names no ability on the board.
        this.fadeShape(effect, spec.duration - 100, false);
      } else if (spec.kind === 'ring') {
        if (!this.drawn) continue;
        const p = at(spec.at);
        const ring = this.takeGraphics();
        if (!ring) continue;
        ring.lineStyle(4, spec.color, 0.95).strokeCircle(p.x, p.y, spec.radius);
        this.fadeShape(ring, spec.duration, false);
      } else if (spec.kind === 'death') {
        // The piece shrinks and fades where it fell (the token itself hides with the end-of-tick alive flag).
        const p = at(spec.at), ghost = this.host.view(spec.unitId)?.ghost(p.x, p.y);
        if (ghost) {
          if (!reducedMotion()) scene.tweens.add({ targets: ghost, scale: 0.4, y: p.y + 8, duration: spec.duration - 150, ease: 'Quad.easeIn' });
          this.host.fade(ghost, spec.duration - 150);
        } else if (this.drawn) this.host.fade(add.graphics().setDepth(20).lineStyle(3, toNumber(C.danger), 0.9).strokeCircle(p.x, p.y, 26), spec.duration - 100);
      } else if (spec.kind === 'label') {
        if (!this.drawn) continue;
        const p = at(spec.at);
        this.place(this.takeText(p.x, p.y, spec.text, { fontSize: '12px', color: spec.color, backgroundColor: spec.background, resolution: 2 }), p, spec.dy, spec.duration);
      } else if (spec.kind === 'target') {
        this.host.view(spec.unitId)?.setRing('target', spec.team);
      } else if (spec.kind === 'flash') {
        this.host.view(spec.unitId)?.hit();
      }
    }
  }
}
