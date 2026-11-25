import { readFileSync } from 'node:fs';
import { Texture, type Group, type Sprite, type SpriteMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { createDebuffMarks, DEBUFF_ICONS, quadWidth, RELL_SHRED } from '../src/rendering/three-mode/debuff-icons';
import { ARENA_UNIT_SCALE } from '../src/rendering/three-mode/vfx-ltk/fx-size';
import { BAR_WIDTH, createUnitOverhead, DEFAULT_METER_COLORS } from '../src/rendering/three-mode/unit-overhead';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { rell } from '../src/rendering/three-mode/vfx-ltk/batch3/rell';

// 11-24 (Fable): Rell's defence steal shows as a still overhead icon on every unit her stab hits, for the whole fight: the
// display events give neither its source nor its time, and the rules' steal outlasts a fight. One icon per unit.

const hit = (targetId: string, extra: Record<string, unknown> = {}) =>
  ({ type: 'packetDamage', tick: 10, eventSeq: 1, sourceId: 'rell', targetId, damageType: 'magic', sourceKind: 'ability', definitionId: 'rell-ability', hit: true, ...extra }) as never;

describe('which units carry the icon', () => {
  it('her ability hit puts it on, once per unit however often she hits it', () => {
    const marks = createDebuffMarks();
    expect(marks.next(hit('a'))).toBe(true);
    expect(marks.next(hit('b'))).toBe(true);
    expect(marks.next(hit('a'))).toBe(false);
    expect(marks.of('a')).toEqual(['rell-shred']);
    expect(marks.of('b')).toEqual(['rell-shred']);
    expect(marks.of('c')).toEqual([]);
  });
  it('nothing else puts it on: her attacks, another ability, a packet that did not hit', () => {
    const marks = createDebuffMarks();
    expect(marks.next(hit('a', { sourceKind: 'basic-attack' }))).toBe(false);
    expect(marks.next(hit('a', { definitionId: 'leona-ability' }))).toBe(false);
    expect(marks.next(hit('a', { hit: false }))).toBe(false);
    expect(marks.of('a')).toEqual([]);
  });
  it('it stays until the unit dies or leaves, or the fight is over', () => {
    const marks = createDebuffMarks();
    marks.next(hit('a')); marks.next(hit('b')); marks.next(hit('c'));
    expect(marks.next({ type: 'death', tick: 20, eventSeq: 2, unitId: 'a' } as never)).toBe(true);
    expect(marks.of('a')).toEqual([]);
    expect(marks.next({ type: 'unitRemoved', tick: 21, eventSeq: 3, unitId: 'b' } as never)).toBe(true);
    expect(marks.of('b')).toEqual([]);
    expect(marks.of('c')).toEqual(['rell-shred']);
    marks.clear();
    expect(marks.of('c')).toEqual([]);
  });
});

describe('the icon over the bar', () => {
  const overhead = () => createUnitOverhead({ colors: () => DEFAULT_METER_COLORS, itemTexture: async () => null });
  const row = (object: Group) => object.getObjectByName('render3d-overhead-debuffs') as Group;
  it('draws each layer of the icon as a still sprite, back to front, and takes it off again', () => {
    const view = overhead(), texture = new Texture();
    view.setDebuffs([{ kind: 'rell-shred', texture, layers: RELL_SHRED.layers }]);
    const icons = row(view.object).children as Group[];
    expect(icons).toHaveLength(1);
    const first = icons[0]!;
    const sprites = first.children as Sprite[];
    expect(sprites.map(sprite => sprite.scale.x)).toEqual(RELL_SHRED.layers.map(layer => layer.size));
    expect(sprites.map(sprite => (sprite.material as SpriteMaterial).opacity)).toEqual(RELL_SHRED.layers.map(layer => layer.opacity));
    expect(sprites.every(sprite => (sprite.material as SpriteMaterial).map === texture)).toBe(true);
    expect(sprites[1]!.renderOrder).toBeGreaterThan(sprites[0]!.renderOrder);
    expect(view.drawn).toBe(true);
    // The same kinds again rebuild nothing.
    view.setDebuffs([{ kind: 'rell-shred', texture, layers: RELL_SHRED.layers }]);
    expect(row(view.object).children).toHaveLength(1);
    expect(row(view.object).children[0]).toBe(first);
    view.setDebuffs([]);
    expect(row(view.object).children).toHaveLength(0);
    view.dispose();
  });
  it('dispose takes the icons down and releases their materials', () => {
    const view = overhead(), texture = new Texture();
    view.setDebuffs([{ kind: 'rell-shred', texture, layers: RELL_SHRED.layers }]);
    const group = row(view.object), materials = (group.children[0]!.children as Sprite[]).map(sprite => sprite.material as SpriteMaterial);
    let released = 0; for (const material of materials) material.addEventListener('dispose', () => { released++; });
    view.dispose();
    expect(released).toBe(materials.length);
    expect(group.children).toHaveLength(0);
  });
  it('is drawn at the system\'s own size: a camera quad\'s scale is a half-extent, so its width is twice the scale', () => {
    expect(quadWidth(1)).toBeCloseTo(2 * ARENA_UNIT_SCALE, 9);
    for (const def of Object.values(DEBUFF_ICONS)) for (const layer of def.layers) expect(layer.size).toBeGreaterThan(BAR_WIDTH * 0.25);
  });
});

describe('the short particle play of the same icon is gone', () => {
  it('Rell\'s cast keeps every exported cue but her defence-steal icon system', () => {
    expect(CUE_OVERRIDES.rell!.map(({ bone, ...cue }) => cue)).toEqual(rell.rell!.filter(cue => cue.system !== '5fe3dc8a').map(({ bone, ...cue }) => cue));
    // Her attack hit, repeated in the override, names the target's chest (vfx-ltk-attack-anchor.test.ts).
    expect(CUE_OVERRIDES.rell!.filter(cue => cue.action === 'attack').map(cue => cue.bone)).toEqual(['C_BUFFBONE_GLB_CHEST_LOC']);
    expect(rell.rell!.some(cue => cue.system === '5fe3dc8a')).toBe(true);
  });
  it('the renderer marks on every event, draws in every fighting frame for living units, and clears with a new combat', () => {
    const source = readFileSync(new URL('../src/rendering/three-mode/placeholder-renderer.ts', import.meta.url), 'utf8');
    expect(source).toContain('debuffMarks.next(event)');
    expect(source).toContain('view.overhead.setDebuffs(frame.fighting && piece.alive ? debuffsOf(piece.id) : [])');
    expect(source).toContain('debuffMarks.clear()');
  });
});
