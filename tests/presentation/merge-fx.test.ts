import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import { createMergeFx, type MergeFx } from '../../src/presentation/merge-fx';
import { lazyMergeFx } from '../../src/presentation/merge-fx-loader';

/** Minimal display objects; the real presentation frame loop runs without a browser or Phaser renderer. */
class Display {
  active = true; alpha = 1; visible = true; x = 0; y = 0; scale = 1; name = ''; text = ''; color = '';
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setVisible(value: boolean) { this.visible = value; return this; }
  setAlpha(value: number) { this.alpha = value; return this; }
  setScale(value: number) { this.scale = value; return this; }
  setName(value: string) { this.name = value; return this; }
  setText(value: string) { this.text = value; return this; }
  setColor(value: string) { this.color = value; return this; }
  setDepth() { return this; } setStrokeStyle() { return this; } setOrigin() { return this; }
  setDisplaySize() { return this; }
  destroy() { this.active = false; }
}
function setup(reduced = false) {
  const events = new EventEmitter(), objects: Display[] = [];
  const add = (x: number, y: number) => { const object = new Display(x, y); objects.push(object); return object; };
  const scene = { events, textures: { exists: () => true }, add: { circle: add, image: add, container: add, text: add } } as unknown as Phaser.Scene;
  const host = { scene, radius: 24, reduced: () => reduced, color: (level: number) => level === 3 ? '#ffd34d' : '#dfe6ec' };
  const star = new Display() as unknown as Phaser.GameObjects.Text;
  const survivor = new Display(200, 200) as unknown as Phaser.GameObjects.Container;
  const merge: MergeFx = { fromStar: 1, toStar: 2, portrait: 'portrait', color: 0xffffff,
    from: [{ id: 'b', x: 0, y: 0 }, { id: 'c', x: 100, y: 0 }], to: { id: 'a', x: 200, y: 200 }, survivor, star };
  return { host, objects, events, merge, star, survivor, step: (delta: number) => events.emit('update', 0, delta) };
}

describe('2D star-up overlay', () => {
  it('flies both copies, changes stars at arrival, follows a moved survivor and leaves its transform untouched', () => {
    const ctx = setup(), fx = createMergeFx(ctx.host);
    fx.play([ctx.merge]); ctx.step(150);
    const copies = ctx.objects.filter(object => object.name === 'merge-copy');
    expect(copies).toHaveLength(2); expect(copies.every(object => object.visible && object.x > 0 && object.x < 200)).toBe(true);
    const row = ctx.objects.find(object => object.name === 'merge-stars')!;
    expect(row.text).toBe('★'); expect(ctx.star.alpha).toBe(0);
    ctx.survivor.setPosition(300, 250); ctx.step(151);
    expect(copies.every(object => !object.visible)).toBe(true); expect(row.text).toBe('★★'); expect(row.x).toBe(300);
    expect(ctx.objects.find(object => object.name === 'merge-flash')?.visible).toBe(true);
    expect(ctx.survivor.scale).toBe(1); // never fights drag/lift scale or blocks a command
    ctx.step(380); expect(ctx.star.alpha).toBe(1);
    expect(ctx.objects.filter(object => object.name.startsWith('merge-')).every(object => !object.active)).toBe(true);
    fx.dispose(); expect(ctx.events.listenerCount('update')).toBe(0);
  });
  it('chains promotions of the same survivor, but unrelated upgrades fly at the same time', () => {
    const ctx = setup(), fx = createMergeFx(ctx.host);
    fx.play([ctx.merge, { ...ctx.merge, fromStar: 2, toStar: 3 }, { ...ctx.merge, to: { id: 'other', x: 400, y: 200 }, star: undefined, survivor: undefined }]);
    ctx.step(150);
    const rows = ctx.objects.filter(object => object.name === 'merge-stars');
    expect(rows.map(row => row.visible)).toEqual([true, false, true]);
    ctx.step(151); expect(rows[0].text).toBe('★★'); expect(rows[1].text).toBe('★★');
    ctx.step(300); expect(rows[1].text).toBe('★★★');
    ctx.step(100); expect(ctx.star.alpha).toBe(0); // second stage still owns the hidden badge
    fx.dispose(); expect(ctx.star.alpha).toBe(1);
  });
  it('reduced motion only flashes, and disposal prevents late lazy imports from drawing', async () => {
    const ctx = setup(true), fx = createMergeFx(ctx.host);
    fx.play([ctx.merge]); ctx.step(1);
    expect(ctx.objects.some(object => object.name === 'merge-copy')).toBe(false);
    expect(ctx.objects.find(object => object.name === 'merge-stars')?.text).toBe('★★');
    ctx.step(240); expect(ctx.star.alpha).toBe(1); fx.dispose();
    const cold = setup(), lazy = lazyMergeFx(cold.host);
    lazy.play([cold.merge]); lazy.dispose(); await import('../../src/presentation/merge-fx'); await Promise.resolve();
    expect(cold.objects).toHaveLength(0); expect(cold.events.listenerCount('update')).toBe(0);
  });
});
