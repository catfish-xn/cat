/**
 * M7 combat feedback. `planFx` is the single read-only mapping from authoritative
 * CombatEvents to visual specs; the live Phaser board (`CombatFx`) and the replay canvas
 * (`ReplayView`) both draw these specs, so a replayed battle shows the same feedback.
 * Numeric floats (damage/shield/heal amounts) belong to the DOM feedback renderer only;
 * specs here are shapes and short labels. Nothing feeds back into Match/Combat.
 */
import Phaser from 'phaser';
import type { CombatEvent, CombatState } from '../simulation/combat-types';
import type { HexCell } from '../simulation/board';
import { THEME, toNumber } from './theme';
import type { UnitView } from './unit-view';
import { reducedMotion } from './preferences';
import { planFx } from './fx-plan';
import { placeLabel, type LabelRect } from './label-layout';
export { planFx, type FxSpec } from './fx-plan';

type Point = { x: number; y: number };
const C = THEME.color;

type Fadeable = Phaser.GameObjects.Graphics | Phaser.GameObjects.Text | Phaser.GameObjects.Arc;
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
  private labels: { rect: LabelRect; text: Phaser.GameObjects.Text }[] = [];
  constructor(private readonly host: CombatFxHost) {}

  /** Live label rects (board logical coordinates) for the numeric floats to avoid. */
  labelRects(): LabelRect[] {
    this.labels = this.labels.filter(label => label.text.active);
    return this.labels.map(label => label.rect);
  }

  /** Places a created label in a free slot near `anchor`, or destroys it when the area is full. */
  private place(text: Phaser.GameObjects.Text, anchor: Point, dy: number, duration: number): void {
    const { width, height } = this.host.scene.scale;
    const rect = placeLabel(anchor, text.width, text.height, dy, this.labelRects(), { width, height });
    if (!rect) { text.destroy(); return; }
    text.setPosition(rect.x, rect.y); this.labels.push({ rect, text }); this.host.fade(text, duration);
  }

  show(events: readonly CombatEvent[], combat: CombatState): void {
    const { scene } = this.host, add = scene.add, at = (cell: HexCell) => this.host.center(cell);
    for (const spec of planFx(events, combat, reducedMotion())) {
      if (spec.kind === 'slash') {
        const to = at(spec.at), from = at(spec.from), angle = Math.atan2(to.y - from.y, to.x - from.x);
        const slash = add.graphics().setDepth(20).lineStyle(4, 0xffffff, 0.9);
        slash.beginPath(); slash.arc(to.x, to.y, 20, angle - 0.9, angle + 0.9); slash.strokePath();
        slash.lineStyle(2, spec.color, 1).beginPath(); slash.arc(to.x, to.y, 24, angle - 0.7, angle + 0.7); slash.strokePath();
        this.host.fade(slash, spec.duration);
      } else if (spec.kind === 'bolt') {
        const from = at(spec.from), to = at(spec.to);
        if (spec.travel) {
          const bolt = add.circle(from.x, from.y, 5, spec.color).setStrokeStyle(2, 0xffffff).setDepth(20);
          scene.tweens.add({ targets: bolt, x: to.x, y: to.y, duration: 140 });
          this.host.fade(bolt, spec.duration);
        } else this.host.fade(add.graphics().setDepth(20).lineStyle(2, spec.color, 0.7).lineBetween(from.x, from.y, to.x, to.y), spec.duration);
      } else if (spec.kind === 'cast') {
        const from = at(spec.at);
        const effect = add.graphics().setDepth(20).lineStyle(5, spec.color, 0.95).strokeCircle(from.x, from.y, 34).lineStyle(2, 0xffffff, 0.8).strokeCircle(from.x, from.y, 38);
        for (const cell of spec.targets) { const to = at(cell); effect.lineStyle(3, spec.color, 0.85).lineBetween(from.x, from.y, to.x, to.y).strokeCircle(to.x, to.y, 30); }
        this.host.fade(effect, spec.duration - 100);
        const label = add.text(from.x, from.y, spec.label, { fontSize: '13px', fontStyle: 'bold', color: '#ffffff',
          backgroundColor: Phaser.Display.Color.IntegerToColor(spec.color).rgba, padding: { x: 4, y: 1 }, resolution: 2 }).setOrigin(0.5).setDepth(22);
        this.place(label, from, -58, spec.duration + 100); this.casts++;
      } else if (spec.kind === 'ring') {
        const p = at(spec.at);
        this.host.fade(add.graphics().setDepth(20).lineStyle(4, spec.color, 0.95).strokeCircle(p.x, p.y, spec.radius), spec.duration);
      } else if (spec.kind === 'death') {
        const p = at(spec.at);
        this.host.fade(add.graphics().setDepth(20).lineStyle(3, toNumber(C.danger), 0.9).strokeCircle(p.x, p.y, 26), spec.duration - 100);
        this.host.fade(add.text(p.x, p.y, '×', { fontSize: '40px', color: C.danger, fontStyle: 'bold', resolution: 2 }).setOrigin(0.5).setDepth(21), spec.duration);
      } else if (spec.kind === 'label') {
        const p = at(spec.at);
        this.place(add.text(p.x, p.y, spec.text, { fontSize: '12px', color: spec.color, backgroundColor: spec.background, resolution: 2 }).setOrigin(0.5).setDepth(21), p, spec.dy, spec.duration);
      } else if (spec.kind === 'target') {
        this.host.view(spec.unitId)?.setRing('target', spec.team);
      } else if (spec.kind === 'flash') {
        const disc = this.host.view(spec.unitId)?.disc;
        if (disc) { scene.tweens.killTweensOf(disc); disc.setAlpha(1); scene.tweens.add({ targets: disc, alpha: 0.35, duration: 80, yoyo: true }); }
      }
    }
  }
}
