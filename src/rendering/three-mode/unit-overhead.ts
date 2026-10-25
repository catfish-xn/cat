import { spritePick, type ScreenArea } from './description-pick';
import type { Camera } from 'three';
/**
 * Over a 3D piece: its combat meters (HP in team color with the shield segment and 300-HP ticks, mana below) and its
 * worn item icons, drawn from the BoardFeed values the 2D piece shows (unit-view.ts drawCombat) — the 3D layer covers
 * that view. Billboard sprites, above models and effects; nothing here is computed from rules. Display only.
 */
import { CanvasTexture, Group, LinearFilter, SRGBColorSpace, Sprite, SpriteMaterial, type Texture } from 'three';
import type { BoardMeters, BoardPiece } from '../board-feed';

export interface MeterColors { readonly hp: string; readonly hpEnemy: string; readonly mana: string; readonly manaFull: string; readonly shield: string }
export const DEFAULT_METER_COLORS: MeterColors = { hp: '#5fd68a', hpEnemy: '#f08080', mana: '#449cfa', manaFull: '#bde5ff', shield: '#e8f4ff' };

/** Board units: the bar is as wide as the 2D one (52 of a 68-unit hex), icons a little smaller than a star row. */
export const BAR_WIDTH = 52;
const BAR_CANVAS = { width: 128, height: 26 }, BAR_HEIGHT = BAR_WIDTH * BAR_CANVAS.height / BAR_CANVAS.width;
const ITEM_SIZE = 13, ITEM_GAP = 2;
/** Above the star row (1000) so a bar is never hidden behind stars of a piece in front. */
const RENDER_ORDER = 1001;

export interface UnitOverhead {
  /** Scene child: the host moves it to the piece's head each frame. Its origin is the bar's bottom edge. */
  readonly object: Group;
  /** Meters show while `meters` is given; items whenever the piece wears any. */
  set(team: BoardPiece['team'], meters: BoardMeters | undefined, items: BoardPiece['items']): void;
  /** A cast's charge: the mana bar shows full and bright until it is switched off, then the meters as they are. */
  flashMana(on: boolean): void;
  /** True when something is drawn (the host skips placing an empty one). */
  readonly drawn: boolean;
  itemAt(client: { x: number; y: number }, camera: Camera, area: ScreenArea): ReturnType<typeof spritePick>;
  dispose(): void;
}

export interface OverheadContext {
  colors(): MeterColors;
  /** Shared, cached item icon texture (null while loading or when it failed); owned by the host. */
  itemTexture(url: string): Promise<Texture | null>;
}

export function createUnitOverhead(ctx: OverheadContext): UnitOverhead {
  const object = new Group(); object.name = 'render3d-overhead';
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  if (canvas) { canvas.width = BAR_CANVAS.width; canvas.height = BAR_CANVAS.height; }
  const texture = canvas ? new CanvasTexture(canvas) : null;
  if (texture) { texture.colorSpace = SRGBColorSpace; texture.minFilter = LinearFilter; texture.generateMipmaps = false; }
  const barMaterial = new SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
  const bar = new Sprite(barMaterial); bar.name = 'render3d-overhead-bar';
  bar.scale.set(BAR_WIDTH, BAR_HEIGHT, 1); bar.position.y = BAR_HEIGHT / 2; bar.renderOrder = RENDER_ORDER; bar.visible = false;
  object.add(bar);
  const icons = new Group(); icons.name = 'render3d-overhead-items';
  object.add(icons);
  let barKey = '', itemKey = '', disposed = false, flashing = false;
  let shown: { team: BoardPiece['team']; meters: BoardMeters } | null = null;

  const drawBar = (team: BoardPiece['team'], m: BoardMeters) => {
    const g = canvas?.getContext('2d');
    if (!g || !canvas) return;
    const c = ctx.colors(), w = canvas.width, pad = 2, inner = w - pad * 2;
    const hpRatio = m.maxHp > 0 ? Math.max(0, Math.min(1, m.hp / m.maxHp)) : 0;
    const manaRatio = m.maxMana > 0 ? Math.max(0, Math.min(1, m.mana / m.maxMana)) : 0;
    g.clearRect(0, 0, w, canvas.height);
    g.fillStyle = '#091219'; g.fillRect(0, 0, w, 16); g.fillRect(0, 17, w, 9);
    g.fillStyle = team === 'player' ? c.hp : c.hpEnemy; g.fillRect(pad, pad, inner * hpRatio, 12);
    if (m.shield > 0 && m.maxHp > 0) {
      const start = inner * hpRatio, segment = Math.min(inner - start, inner * Math.min(1, m.shield / m.maxHp));
      g.fillStyle = c.shield; g.fillRect(pad + start, pad, Math.max(segment, 3), 12);
    }
    g.fillStyle = 'rgba(9, 18, 25, 0.6)';
    for (let mark = 300; mark < m.maxHp; mark += 300) g.fillRect(pad + inner * mark / m.maxHp, pad, 2, 12);
    if (flashing) { g.fillStyle = '#ffffff'; g.fillRect(pad, 19, inner, 5); }
    else { g.fillStyle = m.maxMana > 0 && m.mana >= m.maxMana ? c.manaFull : c.mana; g.fillRect(pad, 19, inner * manaRatio, 5); }
    if (texture) texture.needsUpdate = true;
  };

  const placeItems = (items: NonNullable<BoardPiece['items']>) => {
    for (const sprite of icons.children as Sprite[]) sprite.material.dispose();
    icons.clear();
    items.forEach((item, index) => {
      const material = new SpriteMaterial({ color: '#8a96a3', depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
      const sprite = new Sprite(material); sprite.name = `render3d-overhead-item-${item.id}`;
      sprite.scale.set(ITEM_SIZE, ITEM_SIZE, 1); sprite.renderOrder = RENDER_ORDER;
      sprite.position.set((index - (items.length - 1) / 2) * (ITEM_SIZE + ITEM_GAP), ITEM_SIZE / 2, 0);
      icons.add(sprite);
      if (item.icon) void ctx.itemTexture(item.icon).then(map => {
        if (disposed || !map || sprite.parent !== icons) return;
        material.map = map; material.color.set('#ffffff'); material.needsUpdate = true;
      });
    });
  };

  return {
    object,
    itemAt: (client, camera, area) => object.visible ? spritePick(icons.children as Sprite[], client, camera, area) : undefined,
    get drawn() { return bar.visible || icons.children.length > 0; },
    set(team, meters, items) {
      if (disposed) return;
      const nextBar = meters ? `${team}:${meters.hp}/${meters.maxHp}:${meters.mana}/${meters.maxMana}:${meters.shield}` : '';
      shown = meters ? { team, meters } : null;
      if (nextBar !== barKey) { barKey = nextBar; bar.visible = Boolean(meters); if (meters) drawBar(team, meters); }
      const nextItems = (items ?? []).map(item => `${item.id}@${item.icon ?? ''}`).join(',');
      if (nextItems !== itemKey) { itemKey = nextItems; placeItems(items ?? []); }
      // Icons sit above the bar while it shows, in its place otherwise.
      icons.position.y = bar.visible ? BAR_HEIGHT + ITEM_GAP : 0;
    },
    flashMana(on) {
      if (disposed || flashing === on) return;
      flashing = on;
      if (shown) drawBar(shown.team, shown.meters);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const sprite of icons.children as Sprite[]) sprite.material.dispose();
      icons.clear(); object.removeFromParent(); object.clear();
      barMaterial.dispose(); texture?.dispose();
    },
  };
}
