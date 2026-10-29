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

  it('distinguishes allies in green and enemies in red without a foot marker', () => {
    const { rects, canvas } = fakeCanvas();
    vi.stubGlobal('document', { createElement: () => canvas });
    const overhead = createUnitOverhead({ colors: () => DEFAULT_METER_COLORS, itemTexture: async () => null });
    const meters = { hp: 300, maxHp: 600, mana: 0, maxMana: 50, shield: 0 };
    expect(DEFAULT_METER_COLORS.hp).toBe('#5fd68a'); expect(DEFAULT_METER_COLORS.hpEnemy).toBe('#f08080');
    overhead.set('player', meters, undefined);
    expect(rects.find(rect => rect.fill === '#5fd68a')?.w).toBe(62);
    expect(rects.some(rect => rect.fill === '#f08080')).toBe(false);
    overhead.set('enemy', meters, undefined);
    expect(rects.find(rect => rect.fill === '#f08080')?.w).toBe(62);
    expect(rects.some(rect => rect.fill === '#5fd68a')).toBe(false);
    overhead.dispose();
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

  it('redraws unchanged meters when a reviewed skin arrives, preserving ratios, ticks, shield and flash', () => {
    const { canvas, rects } = fakeCanvas(), drawImage = vi.fn();
    Object.assign(canvas.getContext(), { drawImage });
    vi.stubGlobal('document', { createElement: vi.fn(() => fakeCanvas().canvas).mockReturnValueOnce(canvas) });
    let ready = false, update = () => {};
    const unsubscribe = vi.fn(), source = {} as CanvasImageSource;
    const overhead = createUnitOverhead({ colors: () => DEFAULT_METER_COLORS, itemTexture: async () => null,
      ui: { sprite: id => ready && id !== 'health.mana-full' ? { source, url: 'blob:test', width: 80, height: 8, dispose() {} } : undefined,
        subscribe(listener) { update = listener; return unsubscribe; } } });
    overhead.set('player', { hp: 300, maxHp: 600, mana: 25, maxMana: 50, shield: 60 }, undefined);
    expect(drawImage).not.toHaveBeenCalled(); ready = true; update();
    // HP/shield/mana take the same destination widths as their original color fills, with proportional source crops.
    expect(drawImage.mock.calls[0]).toEqual([source, 0, 0, 128, 26]); // opaque frame backing must not cover the values
    expect(drawImage.mock.calls[1]).toEqual([source, 0, 0, 40, 8, 2, 2, 62, 12]);
    expect(drawImage.mock.calls[2]).toEqual([source, 0, 0, 8, 8, 64, 2, 12.4, 12]);
    expect(drawImage.mock.calls[3]).toEqual([source, 0, 0, 40, 8, 2, 19, 62, 5]);
    expect(rects).toContainEqual({ fill: 'rgba(9, 18, 25, 0.6)', x: 64, w: 2 });
    overhead.flashMana(true); expect(rects).toContainEqual({ fill: '#ffffff', x: 2, w: 124 });
    overhead.dispose(); expect(unsubscribe).toHaveBeenCalledTimes(1);
    const calls = drawImage.mock.calls.length; update(); expect(drawImage).toHaveBeenCalledTimes(calls);
  });

  it('repaints item stack numerals on font readiness while retaining the displayed stack count', () => {
    const labels: { text: string; font: string }[] = [];
    vi.stubGlobal('document', { createElement: () => {
      const { canvas } = fakeCanvas(), g = Object.assign(canvas.getContext(), { font: '',
        fillText(text: string) { labels.push({ text, font: g.font }); } });
      return canvas;
    } });
    let font = 'sans-serif', update = () => {};
    const overhead = createUnitOverhead({ colors: () => DEFAULT_METER_COLORS, itemTexture: async () => null, font: () => font,
      ui: { sprite: () => undefined, subscribe(listener) { update = listener; return () => {}; } } });
    overhead.set('player', undefined, [{ id: 'synthetic-stack', icon: null, stacks: 2, maxStacks: 3 }]);
    expect(labels.at(-1)).toEqual({ text: '2', font: 'bold 30px sans-serif' });
    font = 'Render3dBeaufort, sans-serif'; update();
    expect(labels.at(-1)).toEqual({ text: '2', font: `bold 30px ${font}` });
    const count = labels.length; update(); expect(labels).toHaveLength(count); overhead.dispose();
  });

  it('redraws only badge canvases on font readiness, retaining sprites, materials and an in-flight icon', async () => {
    const createElement = vi.fn(() => {
      const { canvas } = fakeCanvas(); Object.assign(canvas.getContext(), { fillText() {} }); return canvas;
    });
    vi.stubGlobal('document', { createElement });
    let font = 'sans-serif', update = () => {}, finish!: (icon: Texture) => void;
    const itemTexture = vi.fn(() => new Promise<Texture>(resolve => { finish = resolve; }));
    const overhead = createUnitOverhead({ colors: () => DEFAULT_METER_COLORS, itemTexture, font: () => font,
      ui: { sprite: () => undefined, subscribe(listener) { update = listener; return () => {}; } } });
    overhead.set('player', undefined, [{ id: 'stack', icon: 'pending.png', stacks: 2, maxStacks: 3 }, { id: 'plain', icon: null }]);
    const row = overhead.object.getObjectByName('render3d-overhead-items')!, icons = [...row.children];
    const badge = overhead.object.getObjectByName('render3d-item-stack-0') as Sprite, map = badge.material.map!;
    const material = (icons[0] as Sprite).material, version = map.version, canvasCount = createElement.mock.calls.length;
    const dropMaterial = vi.spyOn(material, 'dispose'), dropMap = vi.spyOn(map, 'dispose');
    const dropBadge = vi.spyOn(badge.material, 'dispose');
    font = 'Render3dBeaufort, sans-serif'; update();
    expect(row.children[0]).toBe(icons[0]); expect(row.children[1]).toBe(icons[1]);
    expect((icons[0] as Sprite).material).toBe(material);
    expect(overhead.object.getObjectByName('render3d-item-stack-0')).toBe(badge);
    expect(badge.material.map).toBe(map); expect(map.version).toBeGreaterThan(version);
    expect(createElement).toHaveBeenCalledTimes(canvasCount); expect(itemTexture).toHaveBeenCalledTimes(1);
    expect(dropMaterial).not.toHaveBeenCalled(); expect(dropBadge).not.toHaveBeenCalled(); expect(dropMap).not.toHaveBeenCalled();
    const icon = new Texture(); finish(icon);
    await vi.waitFor(() => expect(material.map).toBe(icon));
    const painted = map.version; update(); expect(map.version).toBe(painted);
    overhead.dispose();
    expect(dropMaterial).toHaveBeenCalledTimes(1); expect(dropBadge).toHaveBeenCalledTimes(1); expect(dropMap).toHaveBeenCalledTimes(1);
  });
});
