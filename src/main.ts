import Phaser from 'phaser';
import { BoardScene } from './rendering/BoardScene';
import './style.css';
import { createAppShell } from './rendering/app-shell';
import { BOARD_LAYOUT } from './rendering/layout-config';
import { applyThemeVariables } from './presentation/theme';
applyThemeVariables();
const app = document.getElementById('app')!;
const shell = createAppShell(app);
const board = shell.board;
new Phaser.Game({
  type: Phaser.AUTO, parent: 'board-root', width: BOARD_LAYOUT.width, height: BOARD_LAYOUT.height, backgroundColor: '#101923',
  scene: [BoardScene], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // CSS touch-action:none controls canvas gestures. Phaser must still track
  // cancellation without preventDefault on a noncancelable touchcancel event.
  input: { touch: { capture: false } },
  render: { antialias: true },
  callbacks: {
    postBoot(game) {
      // Phaser filters touch-derived mouse events at its window entry, but not
      // at its canvas entry. Keep the touch input and discard only that duplicate
      // mouse stream; genuine mouse input and every keyboard repeat stay immediate.
      const ignoreTouchMouse = (event: MouseEvent) => {
        const capabilities = (event as MouseEvent & { sourceCapabilities?: { firesTouchEvents: boolean } }).sourceCapabilities;
        if (capabilities?.firesTouchEvents) event.stopImmediatePropagation();
      };
      const mouseEvents = ['mousedown', 'mousemove', 'mouseup'] as const;
      const updateInputBounds = () => game.scale.updateBounds();
      const geometryEvents = ['mousedown', 'mousemove', 'touchstart', 'touchmove'] as const;
      for (const type of geometryEvents) game.canvas.addEventListener(type, updateInputBounds, { capture: true, passive: true });
      window.addEventListener('scroll', updateInputBounds, true);
      for (const type of mouseEvents) game.canvas.addEventListener(type, ignoreTouchMouse, true);
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
        for (const type of mouseEvents) game.canvas.removeEventListener(type, ignoreTouchMouse, true);
        for (const type of geometryEvents) game.canvas.removeEventListener(type, updateInputBounds, true);
        window.removeEventListener('scroll', updateInputBounds, true);
        observer.disconnect(); shell.dispose();
        if (frame !== null) cancelAnimationFrame(frame);
      });
    },
  },
});
