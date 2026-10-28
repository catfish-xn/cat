import { afterEach, describe, expect, it, vi } from 'vitest';
import { Texture, type Sprite } from 'three';
import { BAR_WIDTH, DEFAULT_METER_COLORS, createUnitOverhead } from '../src/rendering/three-mode/unit-overhead';

/** A recording 2D context: no real canvas in the node test environment. */
function fakeCanvas() {
  const rects: { fill: string; x: number; w: number }[] = [];
  const context = { fillStyle: '', clearRect() { rects.length = 0; }, fillRect(x: number, _y: number, w: number) { rects.push({ fill: context.fillStyle, x, w }); } };
  return { rects, canvas: { width: 0, height: 0, getContext: () => context } };
}

describe('3D overhead meters and items', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the confiscation stamp above retained emblem icons and clears it outside combat', () => {
    const overhead = createUnitOverhead({ colors: () => DEFAULT_METER_COLORS, itemTexture: async () => null });
    const meters = { hp: 1, maxHp: 1, mana: 0, maxMana: 0, shield: 0 };
    overhead.set('player', meters, [{ id: 'emblem', icon: null }], true, true);
    const stamp = overhead.object.getObjectByName('render3d-confiscated-items')!;
    const wanted = overhead.object.getObjectByName('render3d-enforcer-wanted')!;
    expect(stamp.visible).toBe(true); expect(wanted.position.y).toBeGreaterThan(stamp.position.y);
    overhead.set('player', undefined, undefined, false, true);
    expect(stamp.visible).toBe(false); expect(overhead.drawn).toBe(false); overhead.dispose();
  });

  it('draws HP in team color with a shield segment and mana, and redraws only when the values change', () => {
    const { rects, canvas } = fakeCanvas();
    vi.stubGlobal('document', { createElement: () => canvas });
    const overhead = createUnitOverhead({ colors: () => DEFAULT_METER_COLORS, itemTexture: async () => null });
    expect(overhead.drawn).toBe(false);
    overhead.set('enemy', { hp: 300, maxHp: 600, mana: 50, maxMana: 50, shield: 60 }, undefined);
    expect(overhead.drawn).toBe(true);
    const bar = overhead.object.getObjectByName('render3d-overhead-bar') as Sprite;
    expect(bar.visible).toBe(true); expect(bar.scale.x).toBe(BAR_WIDTH);
    const hp = rects.find(rect => rect.fill === DEFAULT_METER_COLORS.hpEnemy)!, inner = 124;
    expect(hp.w).toBe(inner / 2);
    expect(rects.find(rect => rect.fill === DEFAULT_METER_COLORS.shield)).toMatchObject({ x: 2 + inner / 2, w: inner / 10 });
    expect(rects.find(rect => rect.fill === DEFAULT_METER_COLORS.manaFull)?.w).toBe(inner); // full mana uses the full color
    rects.push({ fill: 'marker', x: 0, w: 0 });
    overhead.set('enemy', { hp: 300, maxHp: 600, mana: 50, maxMana: 50, shield: 60 }, undefined);
    expect(rects.at(-1)?.fill).toBe('marker');
    overhead.set('enemy', undefined, undefined);
    expect(bar.visible).toBe(false); expect(overhead.drawn).toBe(false);
  });

  it('shows worn items with their icon texture, above the bar while it shows, and releases them', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas().canvas });
    const icon = new Texture();
    const itemTexture = vi.fn(async (url: string) => (url === 'icon-a.png' ? icon : null));
    const overhead = createUnitOverhead({ colors: () => DEFAULT_METER_COLORS, itemTexture });
    overhead.set('player', undefined, [{ id: 'a', icon: 'icon-a.png' }, { id: 'b', icon: null }]);
    const row = overhead.object.getObjectByName('render3d-overhead-items')!;
    expect(row.children.map(child => child.name)).toEqual(['render3d-overhead-item-a', 'render3d-overhead-item-b']);
    expect(row.position.y).toBe(0);
    expect(overhead.drawn).toBe(true);
    await vi.waitFor(() => expect((row.children[0] as Sprite).material.map).toBe(icon));
    expect((row.children[1] as Sprite).material.map).toBeNull();
    expect(itemTexture).toHaveBeenCalledTimes(1);
    overhead.set('player', { hp: 1, maxHp: 1, mana: 0, maxMana: 0, shield: 0 }, [{ id: 'a', icon: 'icon-a.png' }, { id: 'b', icon: null }]);
    expect(row.position.y).toBeGreaterThan(0);
    expect(row.children).toHaveLength(2); // same items: not rebuilt
    const material = (row.children[0] as Sprite).material, dispose = vi.spyOn(material, 'dispose');
    overhead.dispose();
    expect(dispose).toHaveBeenCalled(); expect(icon.source).toBeDefined(); // the shared icon stays with its owner
    expect(overhead.object.children).toHaveLength(0);
  });
});
