/**
 * M7 combat feedback drawn on the Phaser board from authoritative CombatEvents.
 * Shared by live combat; every object is registered through `fade` so the scene's
 * effect set owns cleanup (Continue, New Match, import, replay switches).
 * Nothing here feeds back into Match/Combat: visuals never decide results.
 */
import Phaser from 'phaser';
import type { CombatEvent, CombatState } from '../simulation/combat-types';
import type { HexCell } from '../simulation/board';
import { ITEM_DEFINITIONS } from '../simulation/content/items';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import { AUGMENT_DEFINITIONS } from '../simulation/content/augments';
import { ANOMALY_DEFINITIONS } from '../simulation/content/anomalies';
import { displayUnitName } from '../rendering/display-names';
import { combatEventText } from '../rendering/combat-feedback';
import { getHeroIdentity } from './hero-identity';
import { THEME, toNumber } from './theme';
import type { UnitView } from './unit-view';
import { reducedMotion } from './preferences';

type Point = { x: number; y: number };
type Fadeable = Phaser.GameObjects.Graphics | Phaser.GameObjects.Text | Phaser.GameObjects.Arc;
export interface CombatFxHost {
  readonly scene: Phaser.Scene;
  center(cell: HexCell): Point;
  view(id: string): UnitView | undefined;
  /** Registers an effect for scene-owned cleanup and fades it out over `duration`. */
  fade(effect: Fadeable, duration: number): void;
}
const C = THEME.color;
const SOURCE_KIND: Readonly<Record<string, string>> = { ability: '技能', trait: '羁绊', item: '装备', augment: '强化', anomaly: '异常', enemyGrowth: '敌方成长' };
const sourceName = (kind: string, id: string) => {
  const catalog = kind === 'item' ? ITEM_DEFINITIONS : kind === 'trait' ? TRAIT_DEFINITIONS : kind === 'augment' ? AUGMENT_DEFINITIONS : kind === 'anomaly' ? ANOMALY_DEFINITIONS : null;
  return (catalog?.[id] as { name?: string } | undefined)?.name ?? displayUnitName(id);
};

export class CombatFx {
  /** Reduced motion: no travelling projectiles or pulses, only short static markers. */
  get reduced(): boolean { return reducedMotion(); }
  casts = 0;
  constructor(private readonly host: CombatFxHost) {}

  show(events: readonly CombatEvent[], combat: CombatState): void {
    const { scene } = this.host, add = scene.add;
    const unit = (id: string | null | undefined) => (id ? combat.units.find(value => value.id === id) : undefined);
    for (const event of events) {
      if (event.type === 'attack') {
        const source = unit(event.attackerId), target = unit(event.targetId);
        if (!source || !target) continue;
        const from = this.host.center(source.cell), to = this.host.center(target.cell);
        const color = toNumber(source.team === 'player' ? C.ally : C.enemy);
        if (source.attackRange <= 1) {
          // Melee: a short slash across the target.
          const angle = Math.atan2(to.y - from.y, to.x - from.x);
          const slash = add.graphics().setDepth(20).lineStyle(4, 0xffffff, 0.9);
          slash.beginPath(); slash.arc(to.x, to.y, 20, angle - 0.9, angle + 0.9); slash.strokePath();
          slash.lineStyle(2, color, 1).beginPath(); slash.arc(to.x, to.y, 24, angle - 0.7, angle + 0.7); slash.strokePath();
          this.host.fade(slash, 200);
        } else if (this.reduced) {
          const line = add.graphics().setDepth(20).lineStyle(2, color, 0.7).lineBetween(from.x, from.y, to.x, to.y);
          this.host.fade(line, 160);
        } else {
          // Ranged: a projectile travels to the target (display only).
          const bolt = add.circle(from.x, from.y, 5, color).setStrokeStyle(2, 0xffffff).setDepth(20);
          scene.tweens.add({ targets: bolt, x: to.x, y: to.y, duration: 140 });
          this.host.fade(bolt, 220);
        }
      } else if (event.type === 'cast') {
        const source = unit(event.sourceId);
        if (!source) continue;
        const from = this.host.center(source.cell), ability = source.ability;
        const color = ability.kind === 's13' ? getHeroIdentity(ability.championId).colorNumber : ability.kind === 'selfShield' ? toNumber(C.shield) : ability.damageType === 'magic' ? 0xc5a0ff : 0xffc56e;
        const effect = add.graphics().setDepth(20).lineStyle(5, color, 0.95).strokeCircle(from.x, from.y, 34).lineStyle(2, 0xffffff, 0.8).strokeCircle(from.x, from.y, 38);
        for (const id of event.targetIds) {
          const target = unit(id);
          if (!target || target.id === source.id) continue;
          const to = this.host.center(target.cell);
          effect.lineStyle(3, color, 0.85).lineBetween(from.x, from.y, to.x, to.y).strokeCircle(to.x, to.y, 30);
        }
        this.host.fade(effect, 600);
        const label = add.text(from.x, from.y - 58, ability.kind === 's13' ? `施法 · ${displayUnitName(ability.championId)}` : ability.kind === 'selfShield' ? '施法 · 护盾' : ability.damageType === 'magic' ? '施法 · 魔法' : '施法 · 物理', {
          fontSize: '13px', fontStyle: 'bold', color: '#ffffff', backgroundColor: Phaser.Display.Color.IntegerToColor(color).rgba, padding: { x: 4, y: 1 }, resolution: 3,
        }).setOrigin(0.5).setDepth(22);
        this.host.fade(label, 800); this.casts++;
      } else if (event.type === 'heal' && event.actual > 0) {
        const target = unit(event.unitId);
        if (!target) continue;
        const p = this.host.center(target.cell);
        const text = add.text(p.x + 14, p.y - 14, `+${event.actual}`, { fontSize: '14px', fontStyle: 'bold', color: '#7dff9e', stroke: '#0b151f', strokeThickness: 3, resolution: 3 }).setOrigin(0.5).setDepth(21);
        if (!this.reduced) scene.tweens.add({ targets: text, y: p.y - 34, duration: 600 });
        this.host.fade(text, 700);
      } else if (event.type === 'shieldLayerChanged' && event.reason === 'granted') {
        const target = unit(event.unitId);
        if (!target) continue;
        const p = this.host.center(target.cell);
        const ring = add.graphics().setDepth(20).lineStyle(4, toNumber(C.shield), 0.95).strokeCircle(p.x, p.y, 33);
        this.host.fade(ring, 450);
      } else if (event.type === 'growth' || event.type === 'statusChanged') {
        const target = unit(event.unitId);
        if (!target) continue;
        const p = this.host.center(target.cell);
        const text = event.type === 'growth' ? `成长 +${event.amountBps / 100}%` : `效果${event.reason === 'applied' ? '生效' : '结束'}`;
        const label = add.text(p.x, p.y - 32, text, { fontSize: '12px', color: C.shield, backgroundColor: '#14212c', resolution: 3 }).setOrigin(0.5).setDepth(21);
        label.setData('eventText', combatEventText(event)); this.host.fade(label, 600);
      } else if (event.type === 'targetChanged') {
        const target = unit(event.after);
        if (target) this.host.view(target.id)?.setRing('target', target.team);
      } else if (event.type === 'damage') {
        const disc = this.host.view(event.unitId)?.disc;
        if (disc) { scene.tweens.killTweensOf(disc); disc.setAlpha(1); scene.tweens.add({ targets: disc, alpha: 0.35, duration: 80, yoyo: true }); }
      } else if (event.type === 'death') {
        const target = unit(event.unitId);
        if (!target) continue;
        const p = this.host.center(target.cell);
        const ring = add.graphics().setDepth(20).lineStyle(3, toNumber(C.danger), 0.9).strokeCircle(p.x, p.y, 26);
        const cross = add.text(p.x, p.y, '×', { fontSize: '40px', color: C.danger, fontStyle: 'bold', resolution: 3 }).setOrigin(0.5).setDepth(21);
        this.host.fade(ring, 500); this.host.fade(cross, 600);
      } else if (event.type === 'effectTriggered') {
        const owner = unit(event.source.ownerId);
        if (!owner) continue;
        const p = this.host.center(owner.cell);
        const label = add.text(p.x, p.y + 46, `${SOURCE_KIND[event.source.sourceKind] ?? '效果'} · ${sourceName(event.source.sourceKind, event.source.sourceDefinitionId)}`, {
          fontSize: '11px', color: '#ffe39b', backgroundColor: '#1b2634', resolution: 3,
        }).setOrigin(0.5).setDepth(20);
        this.host.fade(label, 700);
      }
    }
  }
}
