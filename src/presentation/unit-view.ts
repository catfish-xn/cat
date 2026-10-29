/**
 * M7 board/bench piece view. Pure presentation: reads Unit/CombatUnit snapshots and
 * draws them; never writes domain state. The container keeps the original 58×58 hit
 * area and 27px logical radius so input geometry and touch targets are unchanged.
 */
import Phaser from 'phaser';
import type { Unit } from '../simulation/units';
import type { CombatState } from '../simulation/combat-types';
import { combatItemStackBadges, itemStackBadgeText } from './battle-equipment';
import type { CombatViewUnit } from './combat-display';
import type { DisplayUnit } from './combat-display';
import { ITEM_DEFINITIONS } from '../simulation/content/g2-3-item-registry';
import { EMBLEM_POINTS, getHeroIdentity, type HeroIdentity } from './hero-identity';
import { THEME, costColor, starColor, toNumber } from './theme';
import { championPortraitKey, itemTextureKey, requestItemTexture } from './s13-assets';
import { drawStatusIcons, statusIconY, statusIcons, type IconPen } from './status-icons';
import { reducedMotion } from './preferences';
import { NO_GEAR_EXTRAS, type GearExtras } from './equipment-feedback';
import { DISPLACEMENT_SLIDE_2D, KNOCKUP_2D, knockupLift, type ControlKind } from './control-display';
import { anvilIconUrl, isAnvilUnit } from './anvil-display';
import type { UnitAnomaly } from './anomaly-display';

export const PIECE_RADIUS = 27;
/** v22 anvil piece: icon size and disc colour (dark forge bronze). */
const ANVIL_ICON = 38, ANVIL_DISC = 0x2a2118;
const anvilTextureKey = (definitionId: string) => `s13-anvil-${definitionId}`;
const C = THEME.color;
export type RingState = 'normal' | 'selected' | 'target';
/** Worn item icons: a row centred under the piece, over its lower rim (TFT style). */
const ITEM_ICON = 16, ITEM_Y = 32;
/** Cheap motion (presentation only): idle bob, attack lunge, hit flash/shake. */
const BOB_PX = 1.8, BOB_PERIOD_MS = 520, LUNGE_MS = 180, HIT_MS = 200;
const SHADOW_FLAT = 0.35;
export interface MeterData { value: number; maxValue: number; ratio: number; width: number }

export class UnitView {
  readonly token: Phaser.GameObjects.Container;
  /** Everything drawn; offset by the motion below so the token (input, hit tests, positions) never moves for it. */
  readonly body: Phaser.GameObjects.Container;
  /** White overlay for the hit flash. */
  private readonly flash: Phaser.GameObjects.Arc;
  private readonly stackLabels: Phaser.GameObjects.Text[] = [];
  private itemStacks: CombatViewUnit['itemStacks'];
  private readonly itemIcons: Phaser.GameObjects.Image[] = [];
  private readonly bobPhase: number;
  private lungeAt = -Infinity;
  private lunge = { x: 0, y: 0 };
  private hitAt = -Infinity;
  /** Crowd control drawn now (control-display.ts): stunned pieces stop bobbing, knocked-up ones rise off a shadow. */
  private controlKind: ControlKind | null = null;
  private airborneAt: number | null = null;
  private landedAt: number | null = null;
  private landFrom = 0;
  /** Forced skid (pull/grab/knockback): when it started and its lean sign (-1 left, 1 right). */
  private slideAt = -Infinity;
  private slideLean = 0;
  /** Ground shadow under a knocked-up piece; outside `body`, so it stays on the cell. */
  private readonly shadow: Phaser.GameObjects.Arc;
  readonly disc: Phaser.GameObjects.Arc;
  readonly hp: Phaser.GameObjects.Graphics;
  readonly mana: Phaser.GameObjects.Graphics;
  readonly shield: Phaser.GameObjects.Graphics;
  readonly shieldLabel: Phaser.GameObjects.Text;
  readonly star: Phaser.GameObjects.Text;
  /** I3: current statuses as small icons above the HP bar; full names live in the panels. */
  private readonly statusIcons: Phaser.GameObjects.Graphics;
  private statusKey = '';
  private strip = { harmful: '', beneficial: '' };
  private readonly emblem: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly costBadge: Phaser.GameObjects.Arc;
  private readonly costText: Phaser.GameObjects.Text;
  private readonly items: Phaser.GameObjects.Graphics;
  declare confiscationTag?: Phaser.GameObjects.Text;
  /** C18: corner tag for items worn now that enter the next battle, not the one shown (hidden when none). */
  private readonly pendingTag: Phaser.GameObjects.Text;
  private readonly anomalyMark: Phaser.GameObjects.Text;
  anomalies: readonly UnitAnomaly[] = [];
  private portrait: Phaser.GameObjects.Image | null = null;
  private identity: HeroIdentity;
  private renderKey = '';
  /** The unit and star of the last redraw, for a redraw when an anvil icon finishes loading. */
  private lastDrawn: { readonly unit: Unit; readonly star: number } | null = null;
  /** Item definition ids whose pips are drawn now, in slot order (debug/acceptance read). */
  equipped: readonly string[] = [];
  /** Item definition ids worn for the next battle only (C18 tag; debug/acceptance read). */
  pendingEquipped: readonly string[] = [];
  /** Reserved slots and temporary items drawn after the worn pips (debug/acceptance read). */
  extras: GearExtras = NO_GEAR_EXTRAS;
  ring: RingState = 'normal';

  constructor(private readonly scene: Phaser.Scene, unit: Unit, x: number, y: number) {
    this.identity = getHeroIdentity(unit.definitionId);
    const add = scene.add;
    this.disc = add.circle(0, 0, PIECE_RADIUS, this.identity.colorNumber);
    this.emblem = add.graphics();
    this.label = add.text(0, 1, '', { fontSize: '15px', fontStyle: 'bold', color: this.identity.ink, resolution: 2 }).setOrigin(0.5).setName('symbol');
    this.star = add.text(0, -PIECE_RADIUS + 1, '', { fontSize: '12px', color: starColor(1), backgroundColor: '#0b151fd9', padding: { x: 3, y: 0 }, resolution: 2 }).setOrigin(0.5);
    this.costBadge = add.circle(-20, 18, 8, toNumber(costColor(1))).setStrokeStyle(2, 0x0b151f);
    this.costText = add.text(-20, 18, '', { fontSize: '11px', fontStyle: 'bold', color: '#0b151f', resolution: 2 }).setOrigin(0.5);
    this.items = add.graphics();
    this.flash = add.circle(0, 0, PIECE_RADIUS, 0xffffff).setAlpha(0);
    this.pendingTag = add.text(21, -19, '', { fontSize: '10px', fontStyle: 'bold', color: '#0b151f', backgroundColor: '#68ddd0', padding: { x: 2, y: 1 }, resolution: 2 }).setOrigin(0.5).setVisible(false);
    this.anomalyMark = add.text(20, 14, '异', { fontSize: '11px', fontStyle: 'bold', color: '#f0dcff', backgroundColor: '#492f60', padding: { x: 3, y: 1 }, resolution: 2 }).setOrigin(0.5).setName('anomaly-mark').setVisible(false);
    this.hp = add.graphics().setVisible(false);
    this.mana = add.graphics().setVisible(false);
    this.shield = add.graphics().setVisible(false);
    this.statusIcons = add.graphics().setVisible(false);
    this.shieldLabel = add.text(0, 48, '', { fontSize: '11px', color: C.shield, backgroundColor: '#182b38', resolution: 2 }).setOrigin(0.5).setVisible(false);
    const children: Phaser.GameObjects.GameObject[] = [this.disc, this.emblem, this.label, this.flash, this.star, this.costBadge, this.costText, this.items, this.hp, this.mana, this.shield, this.shieldLabel, this.statusIcons, this.pendingTag, this.anomalyMark];
    if (unit.team === 'enemy') {
      children.push(add.circle(20, -19, 9, toNumber(C.enemy)).setStrokeStyle(2, 0x0b151f));
      children.push(add.text(20, -19, '敌', { fontSize: '11px', color: '#ffffff', fontStyle: 'bold', resolution: 2 }).setOrigin(0.5));
    }
    this.body = add.container(0, 0, children);
    // A flattened circle (the trimmed Phaser build has no Ellipse).
    this.shadow = add.circle(0, PIECE_RADIUS * 0.55, PIECE_RADIUS * 0.85, 0x000000, 0.35).setScale(1, SHADOW_FLAT).setVisible(false);
    this.token = add.container(x, y, [this.shadow, this.body]).setSize(58, 58).setName(`unit:${unit.id}`);
    this.bobPhase = [...unit.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 7;
    this.token.setData('unitId', unit.id);
    for (const meter of [this.hp, this.mana, this.shield]) meter.setData({ value: 0, maxValue: 0, ratio: 0, width: 0 });
    this.update(unit, []);
  }

  /** Forces the next update() to redraw identity (e.g. portraits finished loading). */
  invalidate(): void { this.renderKey = ''; }
  get name(): string { return this.identity.name; }
  get symbol(): string { return this.label.text; }

  /** Kept separate from identity redraws so combat equipment refreshes cannot erase a native mark. */
  setAnomalies(anomalies: readonly UnitAnomaly[]): void {
    this.anomalies = anomalies;
    this.anomalyMark.setText(anomalies.some(entry => entry.source === 'portable') ? '异·复' : '异').setVisible(anomalies.length > 0);
    this.token.setData('anomalies', anomalies);
  }

  /**
   * Preparation identity: hero, star level, cost and equipped item pips. `pending` (C18): items worn now that enter the
   * next battle while `equipped` shows the battle on the board; drawn as a separate corner tag, never as a pip.
   * `star` is the star level drawn (v16: 4 for a promoted Ultimate Hero, physically 3★).
   */
  update(unit: Unit, equipped: readonly string[], pending: readonly string[] = [], extras: GearExtras = NO_GEAR_EXTRAS, star: number = unit.starLevel, itemStacks?: CombatViewUnit['itemStacks']): void {
    this.confiscationTag?.setVisible(false);
    const key = `${unit.definitionId}|${star}|${equipped.join(',')}|${pending.join(',')}|${unit.team}|${extras.reserved}|${extras.temporary.join(',')}|${JSON.stringify(itemStacks)}`;
    if (key === this.renderKey) return;
    this.renderKey = key; this.lastDrawn = { unit, star };
    this.identity = getHeroIdentity(unit.definitionId);
    this.disc.setFillStyle(this.identity.colorNumber);
    this.label.setText(this.identity.short).setColor(this.identity.ink);
    // v22 anvil (锻造器): the client's square anvil icon on a dark forge disc; no star, no cost (it is not a hero).
    const anvil = isAnvilUnit(unit.definitionId);
    if (anvil) this.disc.setFillStyle(ANVIL_DISC);
    // Official S13 portrait when bundled; otherwise the code-drawn emblem and short name.
    const portraitKey = anvil ? anvilTextureKey(unit.definitionId) : championPortraitKey(unit.definitionId), hasPortrait = this.scene.textures.exists(portraitKey);
    if (anvil && !hasPortrait) this.requestAnvilTexture(unit.definitionId);
    const size = anvil ? ANVIL_ICON : PIECE_RADIUS * 2 - 2;
    if (hasPortrait) {
      if (!this.portrait) { this.portrait = this.scene.add.image(0, 0, portraitKey); this.body.addAt(this.portrait, 1); }
      this.portrait.setTexture(portraitKey).setDisplaySize(size, size).setVisible(true);
    } else this.portrait?.setVisible(false);
    this.label.setVisible(!hasPortrait);
    const points = EMBLEM_POINTS[this.identity.shape].map(([px, py]) => new Phaser.Math.Vector2(px * PIECE_RADIUS * 0.82, py * PIECE_RADIUS * 0.82));
    this.emblem.clear().lineStyle(3, this.identity.inkNumber, 0.28).strokePoints(points, true, true);
    this.emblem.setVisible(!hasPortrait && !anvil);
    this.star.setText(anvil ? '' : '★'.repeat(star)).setColor(starColor(star)).setVisible(!anvil);
    // Monsters have no shop cost: no badge rather than the adapter's placeholder "1".
    this.costBadge.setFillStyle(toNumber(costColor(this.identity.cost))).setVisible(!this.identity.neutral && !anvil);
    this.costText.setText(String(this.identity.cost)).setVisible(!this.identity.neutral && !anvil);
    this.itemStacks = itemStacks; this.equipped = [...equipped]; this.extras = extras; this.drawItems();
    this.pendingEquipped = [...pending];
    this.pendingTag.setText(pending.length ? `下场+${pending.length}` : '').setVisible(pending.length > 0);
    this.token.setData({ definitionId: unit.definitionId, starLevel: unit.starLevel, effectiveStarLevel: star === 4 ? 4 : undefined, neutral: this.identity.neutral, cost: this.identity.cost, team: unit.team });
    this.applyRing(unit.team);
  }

  /** Loads the anvil icon once per scene; the piece redraws when it arrives. */
  private requestAnvilTexture(definitionId: string): void {
    const key = anvilTextureKey(definitionId), url = anvilIconUrl(definitionId);
    if (!url || this.scene.textures.exists(key)) return;
    this.scene.load.once(`filecomplete-image-${key}`, () => {
      const last = this.lastDrawn;
      if (this.token.active && last) { this.invalidate(); this.update(last.unit, this.equipped, this.pendingEquipped, this.extras, last.star); }
    });
    this.scene.load.image(key, url);
    if (!this.scene.load.isLoading()) this.scene.load.start();
  }

  /**
   * Icon row of the worn items, then slots a 3-slot item reserves (empty dim tiles) and temporary items (teal frame);
   * a framed tile stands in until (or unless) the bundled icon is loaded.
   */
  private drawItems(): void {
    this.items.clear();
    const tiles: { definitionId: string | null; temporary: boolean }[] = [...this.equipped.map(definitionId => ({ definitionId, temporary: false })),
      ...Array.from({ length: this.extras.reserved }, () => ({ definitionId: null, temporary: false })),
      ...this.extras.temporary.map(definitionId => ({ definitionId, temporary: true }))];
    const step = ITEM_ICON + 2, left = -((tiles.length - 1) * step) / 2;
    const badges = combatItemStackBadges(tiles.map(tile => tile.definitionId ?? ''), this.itemStacks);
    this.stackLabels.forEach(label => label.setVisible(false));
    let icons = 0;
    tiles.forEach(({ definitionId, temporary }, index) => {
      const completed = Boolean(definitionId && ITEM_DEFINITIONS[definitionId]?.recipe), x = left + index * step, half = ITEM_ICON / 2;
      this.items.fillStyle(definitionId ? completed ? 0x6b5432 : 0x3a5266 : 0x16222c, definitionId ? 1 : 0.85)
        .lineStyle(1.5, temporary ? 0x68ddd0 : !definitionId ? 0x5c6d79 : completed ? toNumber(C.gold) : 0x9fb4c2)
        .fillRect(x - half - 1, ITEM_Y - half - 1, ITEM_ICON + 2, ITEM_ICON + 2).strokeRect(x - half - 1, ITEM_Y - half - 1, ITEM_ICON + 2, ITEM_ICON + 2);
      if (!definitionId) { this.items.lineBetween(x - half + 2, ITEM_Y + half - 2, x + half - 2, ITEM_Y - half + 2); return; }
      const badge = badges[index];
      if (badge) {
        let label = this.stackLabels[index];
        if (!label) { label = this.scene.add.text(0, 0, '', { fontSize: '10px', fontStyle: 'bold', backgroundColor: '#091219', resolution: 2 }).setOrigin(1, 1); this.stackLabels[index] = label; this.body.add(label); }
        label.setText(itemStackBadgeText(badge)).setColor(badge.stacks >= badge.maxStacks ? '#ffd84d' : '#ffffff').setPosition(x + half, ITEM_Y + half).setVisible(true);
      }
      const slot = icons++, key = itemTextureKey(definitionId);
      if (!this.scene.textures.exists(key)) {
        this.itemIcons[slot]?.setVisible(false);
        requestItemTexture(this.scene, definitionId, () => { if (this.token.active) this.drawItems(); });
        return;
      }
      let icon = this.itemIcons[slot];
      if (!icon) { icon = this.scene.add.image(0, 0, key); this.itemIcons[slot] = icon; this.body.addAt(icon, this.body.getIndex(this.items) + 1); }
      icon.setTexture(key).setDisplaySize(ITEM_ICON, ITEM_ICON).setPosition(x, ITEM_Y).setAlpha(temporary ? 0.8 : 1).setVisible(true);
    });
    this.stackLabels.forEach(label => this.body.bringToTop(label));
    for (let index = icons; index < this.itemIcons.length; index++) this.itemIcons[index].setVisible(false);
  }

  /** Attack: a short lunge toward the target (board units, presentation only). */
  attack(dx: number, dy: number, ranged: boolean): void {
    const length = Math.hypot(dx, dy) || 1, reach = ranged ? -3 : 9;
    this.lunge = { x: (dx / length) * reach, y: (dy / length) * reach }; this.lungeAt = performance.now();
  }
  /** Took damage: white flash and a small shake. */
  hit(): void { this.hitAt = performance.now(); }
  /** Per-frame motion; offsets the drawn body only. */
  animate(now: number): void {
    if (!this.token.visible) return;
    const still = reducedMotion();
    const slide = now - this.slideAt, sliding = slide >= 0 && slide < DISPLACEMENT_SLIDE_2D.ms;
    // A controlled or skidding piece holds still: no idle bob. The skid leans the body back against the slide.
    let x = 0, y = still || this.controlKind || sliding ? 0 : Math.sin(now / BOB_PERIOD_MS + this.bobPhase) * BOB_PX;
    this.body.setRotation(!still && sliding ? this.slideLean * DISPLACEMENT_SLIDE_2D.lean * Math.sin(Math.PI * slide / DISPLACEMENT_SLIDE_2D.ms) : 0);
    const lunge = now - this.lungeAt;
    if (!still && lunge >= 0 && lunge < LUNGE_MS) { const k = Math.sin((Math.PI * lunge) / LUNGE_MS); x += this.lunge.x * k; y += this.lunge.y * k; }
    const hit = now - this.hitAt;
    if (hit >= 0 && hit < HIT_MS) {
      const fade = 1 - hit / HIT_MS; this.flash.setAlpha(0.7 * fade);
      if (!still) x += Math.sin(hit * 0.09) * 2.5 * fade;
    } else if (this.flash.alpha !== 0) this.flash.setAlpha(0);
    // Knock-up: the body rises off its shadow (reduced motion: it stays down, the stun icon still says so).
    const lift = still ? 0 : this.liftShare(now);
    if (this.landedAt !== null && lift === 0) this.landedAt = null;
    y -= lift * KNOCKUP_2D.height;
    const shrink = 1 - lift * 0.3;
    this.shadow.setVisible(lift > 0).setScale(shrink, shrink * SHADOW_FLAT);
    this.body.setPosition(x, y);
  }
  /** Death: a copy of the face that shrinks and fades where the piece fell; the caller owns its cleanup. */
  ghost(x: number, y: number): Phaser.GameObjects.Container {
    const add = this.scene.add, parts: Phaser.GameObjects.GameObject[] = [add.circle(0, 0, PIECE_RADIUS, this.identity.colorNumber)];
    if (this.portrait?.visible) parts.push(add.image(0, 0, this.portrait.texture.key).setDisplaySize(PIECE_RADIUS * 2 - 2, PIECE_RADIUS * 2 - 2));
    return add.container(x, y, parts).setDepth(19);
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
    this.statusIcons.clear().setVisible(false); this.statusKey = ''; this.strip = { harmful: '', beneficial: '' };
    this.disc.setAlpha(1); this.flash.setAlpha(0); this.hitAt = this.lungeAt = -Infinity;
    this.controlKind = null; this.airborneAt = this.landedAt = null; this.shadow.setVisible(false);
    this.slideAt = -Infinity; this.body.setRotation(0);
  }

  /** The control drawn on the piece (null: none). Airborne lifts it until the control ends, then it drops back. */
  setControl(kind: ControlKind | null, now = performance.now()): void {
    if (kind === this.controlKind) return;
    if (kind === 'airborne') { this.airborneAt = now; this.landedAt = null; }
    else if (this.controlKind === 'airborne') { this.landFrom = this.liftShare(now); this.airborneAt = null; this.landedAt = now; }
    this.controlKind = kind;
  }
  /** A forced move started: `dx` is the slide's screen x direction; the body leans back against it. */
  skid(dx: number, now = performance.now()): void { this.slideAt = now; this.slideLean = dx < 0 ? 1 : -1; }
  /** Debug/acceptance read: true while a forced skid is drawn. */
  skidding(now = performance.now()): boolean { return now - this.slideAt >= 0 && now - this.slideAt < DISPLACEMENT_SLIDE_2D.ms; }
  /** Debug/acceptance read of the drawn control. */
  get control(): ControlKind | null { return this.controlKind; }
  private liftShare(now: number): number {
    const since = this.airborneAt === null ? null : (now - this.airborneAt) / 1000, landing = this.landedAt === null ? null : (now - this.landedAt) / 1000;
    return knockupLift(since, landing, this.landFrom, KNOCKUP_2D.riseSeconds, KNOCKUP_2D.fallSeconds);
  }

  /**
   * Combat meters: HP (team colored) with shield segment, mana below, from the displayed values only. Status icons
   * need the local engine state (`runtime`, offline); the online view carries no statuses and shows only the shield icon.
   */
  drawCombat(unit: DisplayUnit, runtime: CombatState | null): void {
    // PvE/legacy replay frames can carry counters without a replacement loadout.
    if (JSON.stringify(this.itemStacks) !== JSON.stringify(unit.itemStacks)) {
      this.itemStacks = unit.itemStacks; this.renderKey = ''; this.drawItems();
    }
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
    // I3: the amount stays readable for debug/acceptance; on the board the shield is the ring, bar segment and icon.
    this.shieldLabel.setText(`盾 ${unit.shield}`).setVisible(false);
    // Row 0 pieces sit too close to the canvas top for the row above the HP bar: draw it below them instead.
    const icons = statusIcons(runtime, unit), y = statusIconY(this.token.y);
    const key = icons.map(icon => `${icon.harmful ? '-' : '+'}${icon.kind}`).join(',') + (icons.length ? `@${y}` : '');
    if (key !== this.statusKey) {
      this.statusKey = key;
      this.statusIcons.clear().setVisible(icons.length > 0);
      drawStatusIcons(graphicsPen(this.statusIcons), icons, 0, y);
      const glyphs = (harmful: boolean) => icons.filter(icon => icon.harmful === harmful && icon.badge).map(icon => icon.badge).join('');
      this.strip = { harmful: glyphs(true), beneficial: glyphs(false) };
    }
  }
  /** Debug/acceptance read of the status row: the panels' one-glyph names of the icons drawn (shield excluded). */
  get statusStrip(): { harmful: string; beneficial: string } { return { ...this.strip }; }
  /** Debug/acceptance read of the drawn icon kinds, in order. */
  get statusIconKinds(): string { return this.statusKey; }

  meter(kind: 'hp' | 'mana' | 'shield'): MeterData {
    const object = kind === 'hp' ? this.hp : kind === 'mana' ? this.mana : this.shield;
    return { value: object.getData('value') ?? 0, maxValue: object.getData('maxValue') ?? 0, ratio: object.getData('ratio') ?? 0, width: object.getData('width') ?? 0 };
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.token); this.scene.tweens.killTweensOf(this.disc);
    this.token.destroy();
  }
}

/** Phaser Graphics backend for the status icons. */
function graphicsPen(graphics: Phaser.GameObjects.Graphics): IconPen {
  const finish = (fill: number | null, stroke: number | null, width: number) => {
    if (fill !== null) graphics.fillStyle(fill).fillPath();
    if (stroke !== null) graphics.lineStyle(width, stroke).strokePath();
  };
  return {
    path(points, closed, fill, stroke, width) {
      graphics.beginPath(); graphics.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) graphics.lineTo(points[i], points[i + 1]);
      if (closed) graphics.closePath();
      finish(fill, stroke, width);
    },
    circle(x, y, r, fill, stroke, width) {
      if (fill !== null) graphics.fillStyle(fill).fillCircle(x, y, r);
      if (stroke !== null) graphics.lineStyle(width, stroke).strokeCircle(x, y, r);
    },
  };
}
