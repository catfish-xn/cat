import { expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { createConquerorFlag } from '../src/rendering/conqueror-flag';
import { BOARD_LAYOUT } from '../src/rendering/layout-config';

function setup() {
  const graphics: Record<string, unknown> = {};
  for (const name of ['fillStyle', 'fillRect', 'lineStyle', 'strokeRect', 'fillPoints']) graphics[name] = vi.fn(() => graphics);
  const label = { text: '', width: 20, setOrigin() { return this; }, setName() { return this; }, setScale: vi.fn(),
    setText: vi.fn(function(this: { text: string }, text: string) { this.text = text; }) };
  const root = { visible: false, x: 0, y: 0, setName() { return this; }, setDepth() { return this; },
    setVisible(value: boolean) { this.visible = value; return this; }, setY(value: number) { this.y = value; return this; }, destroy: vi.fn() };
  const scene = { add: { graphics: () => graphics, text: () => label, container: (x: number, y: number) => { root.x = x; root.y = y; return root; } },
    tweens: { add: vi.fn(), killTweensOf: vi.fn() } };
  const flag = createConquerorFlag(scene as unknown as Phaser.Scene);
  return { flag, root, label, scene };
}
const conquest = (stacks: number, opened: number, next: number | null = 20) => ({ stacks, opened, from: 0, next });

it('shows only projected conquest, updates the total even after all rewards, and stays outside every hex', () => {
  const { flag, root, label } = setup();
  flag.sync(undefined, false); expect(root.visible).toBe(false);
  flag.sync(conquest(0, 0), false); expect(root.visible).toBe(true); expect(label.text).toBe('0/20');
  flag.sync(conquest(12, 2), false); expect(label.text).toBe('12/20');
  flag.sync(conquest(900, 15, null), false); expect(root.visible).toBe(true); expect(label.text).toBe('900');
  expect(root.x - 14).toBeGreaterThan(BOARD_LAYOUT.origin.x + Math.sqrt(3) * BOARD_LAYOUT.hexRadius * 7);
  expect(root.x + 14).toBeLessThanOrEqual(BOARD_LAYOUT.width);
  flag.sync(undefined, false); expect(root.visible).toBe(false);
});

it('bounces only for newly opened rewards, never on first display, remount or return from 3D', () => {
  const { flag, root, label, scene } = setup();
  flag.sync(conquest(12, 2), false); expect(scene.tweens.add).not.toHaveBeenCalled();
  flag.sync(conquest(13, 2), false); expect(scene.tweens.add).not.toHaveBeenCalled();
  const restingY = root.y;
  flag.sync(conquest(20, 3), false);
  expect(scene.tweens.add).toHaveBeenCalledTimes(1);
  expect(scene.tweens.add).toHaveBeenLastCalledWith(expect.objectContaining({ targets: root, y: restingY - 7, yoyo: true }));
  flag.sync(conquest(20, 3), false); expect(scene.tweens.add).toHaveBeenCalledTimes(1);
  flag.sync(conquest(30, 4), true); expect(root.visible).toBe(false); expect(root.y).toBe(restingY); expect(label.text).toBe('30/20');
  flag.sync(conquest(30, 4), false); expect(root.visible).toBe(true); expect(scene.tweens.add).toHaveBeenCalledTimes(1);
  flag.sync(undefined, false); flag.sync(conquest(40, 5), false); expect(scene.tweens.add).toHaveBeenCalledTimes(1);
  flag.dispose(); expect(scene.tweens.killTweensOf).toHaveBeenCalledWith(root); expect(root.destroy).toHaveBeenCalledOnce();
});
