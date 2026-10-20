/**
 * I6 star-up merge (TFT style): the consumed copies fly into the survivor, then a ring of light bursts around it.
 * Pure presentation; positions come from the scene, nothing here reads or writes domain state.
 */
import Phaser from 'phaser';
import { getHeroIdentity } from './hero-identity';
import { championPortraitKey } from './s13-assets';
import { PIECE_RADIUS } from './unit-view';

interface Point { readonly x: number; readonly y: number }
export interface MergeFxHost {
  readonly scene: Phaser.Scene;
  /** Tracks the effect so the scene clears it with its other effects; destroys it once faded. */
  fade(effect: Phaser.GameObjects.Arc | Phaser.GameObjects.Container, duration: number): void;
  readonly reduced: boolean;
}
export interface MergeFx {
  readonly definitionId: string;
  readonly toStar: number;
  /** Where each consumed copy was last drawn (a copy bought from the shop starts below the board). */
  readonly from: readonly Point[];
  readonly to: Point;
  /** The survivor's token, when it is still on the board, pops as the ring bursts. */
  readonly survivor?: Phaser.GameObjects.Container;
}

export const MERGE_FLY_MS = 280;
const RING_MS = 520, DEPTH = 19;
/** Ring color follows the new star: 2★ silver, 3★ gold (matches the star badge). */
const RING_COLORS: Record<number, number> = { 2: 0xdfe6ec, 3: 0xffd34d };

/** Plays one merge after `delay` ms; returns when the ring bursts (ms from now). */
export function playMerge(host: MergeFxHost, merge: MergeFx, delay = 0): number {
  const { scene } = host, fly = host.reduced ? 0 : MERGE_FLY_MS;
  if (fly) for (const from of merge.from) {
    if (Math.hypot(from.x - merge.to.x, from.y - merge.to.y) < 4) continue;
    const ghost = ghostPiece(scene, merge.definitionId, from).setAlpha(0.9);
    host.fade(ghost, delay + fly + 60);
    scene.tweens.add({ targets: ghost, x: merge.to.x, y: merge.to.y, scale: 0.55, delay, duration: fly, ease: 'Quad.easeIn' });
  }
  scene.time.delayedCall(delay + fly, () => burst(host, merge));
  return delay + fly;
}

function ghostPiece(scene: Phaser.Scene, definitionId: string, at: Point): Phaser.GameObjects.Container {
  const identity = getHeroIdentity(definitionId), key = championPortraitKey(definitionId);
  const parts: Phaser.GameObjects.GameObject[] = [scene.add.circle(0, 0, PIECE_RADIUS, identity.colorNumber).setStrokeStyle(2, 0xffe39b)];
  if (scene.textures.exists(key)) parts.push(scene.add.image(0, 0, key).setDisplaySize(PIECE_RADIUS * 2 - 2, PIECE_RADIUS * 2 - 2));
  return scene.add.container(at.x, at.y, parts).setDepth(DEPTH);
}

function burst(host: MergeFxHost, merge: MergeFx) {
  const { scene } = host, color = RING_COLORS[merge.toStar] ?? RING_COLORS[2], { x, y } = merge.to;
  const glow = scene.add.circle(x, y, PIECE_RADIUS + 4, color, 0.55).setDepth(DEPTH);
  const ring = scene.add.circle(x, y, PIECE_RADIUS + 2).setStrokeStyle(4, color).setDepth(DEPTH + 1).setName('merge-ring');
  host.fade(glow, RING_MS * 0.7); host.fade(ring, RING_MS);
  if (!host.reduced) {
    scene.tweens.add({ targets: ring, scale: 2.2, duration: RING_MS, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: glow, scale: 1.5, duration: RING_MS * 0.7, ease: 'Cubic.easeOut' });
    const survivor = merge.survivor;
    if (survivor?.active) scene.tweens.add({ targets: survivor, scale: 1.18, duration: 110, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => { if (survivor.active) survivor.setScale(1); } });
  }
}
