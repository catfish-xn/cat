import Phaser from 'phaser';
import { BoardScene } from './rendering/BoardScene';
import './style.css';
const app = document.getElementById('app')!;
const board = document.createElement('main'); board.id = 'board-root'; board.setAttribute('aria-label', '自动战棋棋盘');
const strategy = document.createElement('aside'); strategy.id = 'strategy-root'; strategy.setAttribute('aria-label', '策略构筑');
app.append(board, strategy);
new Phaser.Game({
  type: Phaser.AUTO, parent: 'board-root', width: 960, height: 800, backgroundColor: '#101923',
  scene: [BoardScene], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // CSS touch-action:none controls canvas gestures. Phaser must still track
  // cancellation without preventDefault on a noncancelable touchcancel event.
  input: { touch: { capture: false } },
  render: { antialias: true },
  callbacks: {
    postBoot(game) {
      // Phaser's orientation handler can refresh with the previous parent size.
      // Observe the settled host layout, then refresh both FIT and input bounds.
      let frame: number | null = null;
      const observer = new ResizeObserver(() => {
        if (frame !== null) return;
        frame = requestAnimationFrame(() => {
          frame = null;
          game.scale.getParentBounds();
          game.scale.refresh();
        });
      });
      observer.observe(board);
      game.events.once(Phaser.Core.Events.DESTROY, () => {
        observer.disconnect();
        if (frame !== null) cancelAnimationFrame(frame);
      });
    },
  },
});
