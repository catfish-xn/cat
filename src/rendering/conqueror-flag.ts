import type Phaser from 'phaser';
import type { BoardMechanics } from './board-feed';
import { BOARD_LAYOUT } from './layout-config';

/** Presentation only: both renderers consume the same conquest projection. */
export function createConquerorFlag(scene: Phaser.Scene) {
  // The rightmost hex ends at x≈447; this standard stays inside the 480-wide canvas.
  const x = BOARD_LAYOUT.width - 14, y = BOARD_LAYOUT.origin.y + BOARD_LAYOUT.hexRadius * 1.5 * 5.7;
  const flag = scene.add.graphics();
  flag.fillStyle(0xe5b64a).fillRect(-8, -3, 16, 3).fillRect(-1, -57, 2, 55).fillRect(-11, -55, 22, 2);
  flag.fillStyle(0x741d30).fillRect(-9, -53, 18, 30);
  flag.lineStyle(1, 0xe5b64a).strokeRect(-9, -53, 18, 30);
  flag.fillStyle(0xe5b64a).fillPoints([{ x: 0, y: -46 }, { x: 5, y: -39 }, { x: 0, y: -32 }, { x: -5, y: -39 }], true);
  const label = scene.add.text(0, -64, '', { fontSize: '12px', fontStyle: 'bold', color: '#e5b64a', backgroundColor: '#0a1018', padding: { x: 2, y: 2 } }).setOrigin(0.5, 1);
  label.setName('conqueror-stacks');
  const root = scene.add.container(x, y, [flag, label]).setName('conqueror-flag').setDepth(8).setVisible(false);
  let opened: number | undefined;
  return {
    sync(conquest: BoardMechanics['conquest'], covered: boolean) {
      root.setVisible(!!conquest && !covered);
      if (conquest) {
        const text = String(conquest.stacks);
        if (label.text !== text) { label.setText(text); label.setScale(Math.min(1, 28 / label.width)); }
        if (!covered && opened !== undefined && conquest.opened > opened) {
          scene.tweens.killTweensOf(root); root.setY(y);
          scene.tweens.add({ targets: root, y: y - 7, duration: 180, yoyo: true, ease: 'Sine.easeOut' });
        }
      }
      if (!conquest || covered) { scene.tweens.killTweensOf(root); root.setY(y); }
      opened = conquest?.opened;
    },
    dispose() { scene.tweens.killTweensOf(root); root.destroy(); },
  };
}
