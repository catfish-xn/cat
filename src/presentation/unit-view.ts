/**
 * M7 board/bench piece view. Pure presentation: reads Unit/CombatUnit snapshots and
 * draws them; never writes domain state. The container keeps the original 58×58 hit
 * area and 27px logical radius so input geometry and touch targets are unchanged.
 */
import Phaser from 'phaser';
import type { Unit } from '../simulation/units';
import type { CombatUnit } from '../simulation/combat-types';
import { ITEM_DEFINITIONS } from '../simulation/content/items';
import { EMBLEM_POINTS, getHeroIdentity, type HeroIdentity } from './hero-identity';
import { THEME, costColor, toNumber } from './theme';

export const PIECE_RADIUS = 27;
const C = THEME.color;
/** TFT client convention: 1★ bronze, 2★ silver, 3★ gold. */
const STAR_COLORS = ['#d39a6a', '#dfe6ec', '#ffd34d'] as const;
export type RingState = 'normal' | 'selected' | 'target';
export interface MeterData { value: number; maxValue: number; ratio: number; width: number }

export class UnitView {
  readonly token: Phaser.GameObjects.Container;
  readonly disc: Phaser.GameObjects.Arc;
  readonly hp: Phaser.GameObjects.Graphics;
  readonly mana: Phaser.GameObjects.Graphics;
  readonly shield: Phaser.GameObjects.Graphics;
  readonly shieldLabel: Phaser.GameObjects.Text;
  readonly star: Phaser.GameObjects.Text;
  private readonly emblem: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly costBadge: Phaser.GameObjects.Arc;
  private readonly costText: Phaser.GameObjects.Text;
  private readonly items: Phaser.GameObjects.Graphics;
  private identity: HeroIdentity;
  private renderKey = '';
  ring: RingState = 'normal';

  constructor(private readonly scene: Phaser.Scene, unit: Unit, x: number, y: number) {
    this.identity = getHeroIdentity(unit.definitionId);
    const add = scene.add;
    this.disc = add.circle(0, 0, PIECE_RADIUS, this.identity.colorNumber);
    this.emblem = add.graphics();
    this.label = add.text(0, 1, '', { fontSize: '15px', fontStyle: 'bold', color: this.identity.ink, resolution: 3 }).setOrigin(0.5).setName('symbol');
    this.star = add.text(0, -PIECE_RADIUS + 1, '', { fontSize: '12px', color: STAR_COLORS[0], backgroundColor: '#0b151fd9', padding: { x: 3, y: 0 }, resolution: 3 }).setOrigin(0.5);
    this.costBadge = add.circle(-20, 18, 8, toNumber(costColor(1))).setStrokeStyle(2, 0x0b151f);
    this.costText = add.text(-20, 18, '', { fontSize: '11px', fontStyle: 'bold', color: '#0b151f', resolution: 3 }).setOrigin(0.5);
    this.items = add.graphics();
    this.hp = add.graphics().setVisible(false);
    this.mana = add.graphics().setVisible(false);
    this.shield = add.graphics().setVisible(false);
    this.shieldLabel = add.text(0, 40, '', { fontSize: '11px', color: C.shield, backgroundColor: '#182b38', resolution: 3 }).setOrigin(0.5).setVisible(false);
    const children: Phaser.GameObjects.GameObject[] = [this.disc, this.emblem, this.label, this.star, this.costBadge, this.costText, this.items, this.hp, this.mana, this.shield, this.shieldLabel];
    if (unit.team === 'enemy') {
      children.push(add.circle(20, -19, 9, toNumber(C.enemy)).setStrokeStyle(2, 0x0b151f));
      children.push(add.text(20, -19, '敌', { fontSize: '11px', color: '#ffffff', fontStyle: 'bold', resolution: 3 }).setOrigin(0.5));
    }
    this.token = add.container(x, y, children).setSize(58, 58).setName(`unit:${unit.id}`);
    this.token.setData('unitId', unit.id);
    for (const meter of [this.hp, this.mana, this.shield]) meter.setData({ value: 0, maxValue: 0, ratio: 0, width: 0 });
    this.update(unit, []);
  }

  get name(): string { return this.identity.name; }
  get symbol(): string { return this.label.text; }

  /** Preparation identity: hero, star level, cost and equipped item pips. */
  update(unit: Unit, equipped: readonly string[]): void {
    const key = `${unit.definitionId}|${unit.starLevel}|${equipped.join(',')}|${unit.team}`;
    if (key === this.renderKey) return;
    this.renderKey = key;
    this.identity = getHeroIdentity(unit.definitionId);
    this.disc.setFillStyle(this.identity.colorNumber);
    this.label.setText(this.identity.short).setColor(this.identity.ink);
    const points = EMBLEM_POINTS[this.identity.shape].map(([px, py]) => new Phaser.Math.Vector2(px * PIECE_RADIUS * 0.82, py * PIECE_RADIUS * 0.82));
    this.emblem.clear().lineStyle(3, this.identity.inkNumber, 0.28).strokePoints(points, true, true);
    this.star.setText('★'.repeat(unit.starLevel)).setColor(STAR_COLORS[unit.starLevel - 1]);
    this.costBadge.setFillStyle(toNumber(costColor(this.identity.cost)));
    this.costText.setText(String(this.identity.cost));
    this.items.clear();
    equipped.forEach((definitionId, index) => {
      const completed = Boolean(ITEM_DEFINITIONS[definitionId]?.recipe);
      const x = -10 + index * 10;
      this.items.fillStyle(completed ? toNumber(C.gold) : 0x9fb4c2).lineStyle(1.5, 0x0b151f).fillRect(x - 4, 22, 8, 8).strokeRect(x - 4, 22, 8, 8);
    });
    this.token.setData({ definitionId: unit.definitionId, starLevel: unit.starLevel, cost: this.identity.cost });
    this.applyRing(unit.team);
  }

  setRing(state: RingState, team: 'player' | 'enemy'): void { this.ring = state; this.applyRing(team); }
  private applyRing(team: 'player' | 'enemy' | string): void {
    const width = this.ring === 'normal' ? 3 : 4;
    const color = this.ring === 'selected' ? 0xffffff : this.ring === 'target' ? toNumber(C.focus) : team === 'enemy' ? toNumber(C.enemy) : 0x0b151f;
    this.disc.setStrokeStyle(width, color);
  }

  resetMeters(): void {
    for (const meter of [this.hp, this.mana, this.shield]) meter.clear().setVisible(false).setData({ value: 0, maxValue: 0, ratio: 0, width: 0 });
    this.shieldLabel.setVisible(false).setText('');
    this.disc.setAlpha(1);
  }

  /** Combat meters: HP (team colored) with shield segment, mana below. */
  drawCombat(unit: CombatUnit): void {
    const alive = unit.alive, width = 52, left = -26;
    const hpRatio = unit.hp / unit.maxHp;
    this.hp.clear().setVisible(alive);
    this.hp.fillStyle(0x091219).fillRoundedRect(left - 1, -45, width + 2, 8, 2);
    this.hp.fillStyle(toNumber(unit.team === 'player' ? C.hp : C.hpEnemy)).fillRect(left, -44, width * hpRatio, 6);
    // Tick marks every 300 max HP make large health pools readable at a glance.
    this.hp.fillStyle(0x091219, 0.6);
    for (let mark = 300; mark < unit.maxHp; mark += 300) this.hp.fillRect(left + (width * mark) / unit.maxHp, -44, 1, 6);
    this.hp.setData({ value: unit.hp, maxValue: unit.maxHp, ratio: hpRatio, width: width * hpRatio });
    const manaRatio = unit.maxMana > 0 ? unit.mana / unit.maxMana : 0;
    this.mana.clear().setVisible(alive).fillStyle(0x091219).fillRect(left - 1, -36, width + 2, 5);
    this.mana.fillStyle(toNumber(unit.mana === unit.maxMana ? C.manaFull : C.mana)).fillRect(left, -35, width * manaRatio, 3);
    this.mana.setData({ value: unit.mana, maxValue: unit.maxMana, ratio: manaRatio, width: width * manaRatio });
    const shieldRatio = Math.min(1, unit.shield / unit.maxHp);
    this.shield.clear().setVisible(alive && unit.shield > 0);
    this.shield.lineStyle(3, toNumber(C.shield), 0.9).strokeCircle(0, 0, PIECE_RADIUS + 3);
    const start = Math.min(width, width * hpRatio), segment = Math.min(width - start, width * shieldRatio);
    this.shield.fillStyle(toNumber(C.shield)).fillRect(left + start, -44, Math.max(segment, unit.shield > 0 ? 2 : 0), 6);
    this.shield.setData({ value: unit.shield, maxValue: unit.maxHp, ratio: shieldRatio, width: width * shieldRatio });
    this.shieldLabel.setText(`盾 ${unit.shield}`).setVisible(alive && unit.shield > 0);
  }

  meter(kind: 'hp' | 'mana' | 'shield'): MeterData {
    const object = kind === 'hp' ? this.hp : kind === 'mana' ? this.mana : this.shield;
    return { value: object.getData('value') ?? 0, maxValue: object.getData('maxValue') ?? 0, ratio: object.getData('ratio') ?? 0, width: object.getData('width') ?? 0 };
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.token); this.scene.tweens.killTweensOf(this.disc);
    this.token.destroy();
  }
}
