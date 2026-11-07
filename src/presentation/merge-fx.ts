/** Short, non-interactive star-up overlay. No runtime imports: this stays in its own lazy UI chunk. */
import type Phaser from 'phaser';

export interface MergePoint { readonly id?: string; readonly x: number; readonly y: number }
export interface MergeFx {
  readonly fromStar: number; readonly toStar: number;
  readonly from: readonly MergePoint[]; readonly to: MergePoint;
  readonly portrait: string; readonly color: number;
  readonly survivor?: Phaser.GameObjects.Container;
  readonly star?: Phaser.GameObjects.Text;
}
export interface MergeFxHost {
  readonly scene: Phaser.Scene; readonly radius: number;
  reduced(): boolean; color(level: number): string;
}
export const MERGE_FLY_MS = 300, MERGE_DURATION_MS = 680;

export function createMergeFx(host: MergeFxHost) {
  const { scene, radius } = host;
  type Object = Phaser.GameObjects.Container | Phaser.GameObjects.Arc | Phaser.GameObjects.Text;
  interface Live { merge: MergeFx; age: number; delay: number; fly: number; objects: Object[];
    ghosts: Phaser.GameObjects.Container[]; ring: Phaser.GameObjects.Arc; flash: Phaser.GameObjects.Arc;
    stars: Phaser.GameObjects.Text; }
  const live: Live[] = [];
  const hidden = new Map<Phaser.GameObjects.Text, number>();
  let disposed = false;
  const release = (fx: Live) => {
    fx.objects.forEach(object => object.destroy());
    const star = fx.merge.star;
    if (star && !live.some(other => other !== fx && other.merge.star === star)) {
      if (star.active) star.setAlpha(hidden.get(star) ?? 1);
      hidden.delete(star);
    }
  };
  const update = (_time: number, delta: number) => {
    for (const fx of [...live]) {
      fx.age += delta;
      const elapsed = fx.age - fx.delay;
      if (elapsed < 0) continue;
      if (elapsed >= (fx.fly ? MERGE_DURATION_MS : 240)) {
        live.splice(live.indexOf(fx), 1); release(fx); continue;
      }
      const { merge, fly } = fx;
      const to = merge.survivor?.active ? merge.survivor : merge.to;
      const travel = fly ? Math.min(1, elapsed / fly) : 1;
      fx.ghosts.forEach((ghost, index) => {
        const from = merge.from[index], t = travel * travel;
        ghost.setVisible(travel < 1).setPosition(from.x + (to.x - from.x) * t,
          from.y + (to.y - from.y) * t - Math.sin(travel * Math.PI) * radius * .7)
          .setScale(1 - travel * .65).setAlpha(.95 - travel * .25);
      });
      const burst = elapsed >= fly, p = Math.max(0, (elapsed - fly) / (fly ? MERGE_DURATION_MS - fly : 240));
      fx.ring.setVisible(burst).setPosition(to.x, to.y).setScale(fly ? 1 + p * 1.6 : 1).setAlpha(1 - p);
      fx.flash.setVisible(burst).setPosition(to.x, to.y).setScale(fly ? 1 + p * .7 : 1).setAlpha((1 - p) ** 2 * .7);
      fx.stars.setVisible(true).setPosition(to.x, to.y - radius - 10 - (burst && fly ? p * 8 : 0))
        .setText('★'.repeat(burst ? merge.toStar : merge.fromStar)).setColor(host.color(burst ? merge.toStar : merge.fromStar))
        .setScale(burst && fly ? 1 + Math.sin(Math.PI * p) * .45 : 1).setAlpha(burst ? Math.min(1, (1 - p) * 3) : 1);
    }
  };
  scene.events.on('update', update);
  return {
    play(merges: readonly MergeFx[]) {
      if (disposed) return;
      const ready = new Map<string, number>();
      for (const merge of merges) {
        const delay = Math.max(0, ...[merge.to, ...merge.from].map(point => point.id ? ready.get(point.id) ?? 0 : 0));
        const fly = host.reduced() ? 0 : MERGE_FLY_MS, color = Number(host.color(merge.toStar).replace('#', '0x'));
        const ghosts = fly ? merge.from.map(from => {
          const parts: Phaser.GameObjects.GameObject[] = [scene.add.circle(0, 0, radius, merge.color).setStrokeStyle(2, color)];
          if (scene.textures.exists(merge.portrait)) parts.push(scene.add.image(0, 0, merge.portrait).setDisplaySize(radius * 2 - 2, radius * 2 - 2));
          return scene.add.container(from.x, from.y, parts).setDepth(24).setVisible(false).setName('merge-copy');
        }) : [];
        const ring = scene.add.circle(merge.to.x, merge.to.y, radius + 2).setStrokeStyle(4, color).setDepth(25).setVisible(false).setName('merge-ring');
        const flash = scene.add.circle(merge.to.x, merge.to.y, radius + 4, color).setDepth(24).setVisible(false).setName('merge-flash');
        const stars = scene.add.text(0, 0, '', { fontSize: '17px', fontStyle: 'bold', backgroundColor: '#0b151fe6', padding: { x: 4, y: 1 }, resolution: 2 })
          .setOrigin(.5).setDepth(26).setVisible(false).setName('merge-stars');
        if (merge.star?.active) {
          if (!hidden.has(merge.star)) hidden.set(merge.star, merge.star.alpha);
          merge.star.setAlpha(0);
        }
        live.push({ merge, age: 0, delay, fly, ghosts, ring, flash, stars, objects: [...ghosts, ring, flash, stars] });
        // Cascade stages overlap only after the preceding copies reach their survivor.
        if (merge.to.id) ready.set(merge.to.id, delay + fly);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true; scene.events.off('update', update);
      while (live.length) { const fx = live.pop()!; release(fx); }
    },
  };
}
