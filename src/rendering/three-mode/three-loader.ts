/**
 * 3D 单独加载模式外壳。这一文件留在 2D 主包里，体积很小；three.js 和渲染实现只在 `?render=3d` 时
 * 动态 import，构建时落在 assets/3d/（见 vite.config.ts），JS 体积预算把它单列，不计入 2D 门槛。
 * 3D 层盖在 #board-root 上，只负责画面；对局、输入和 2D 棋盘照常运行在下面。任何失败都留在 2D。
 */
import { readAssetBase3d, readRenderMode, withoutRenderParam } from '../render-mode';
import type { Renderer3d } from './contract';

export interface ThreeModeHandle { dispose(): void }

const NOOP: ThreeModeHandle = { dispose() {} };

export function mountThreeMode(board: HTMLElement, search = window.location.search): ThreeModeHandle {
  if (readRenderMode(search) !== '3d') return NOOP;
  const layer = document.createElement('div');
  layer.className = 'render3d-layer';
  layer.dataset.debug = 'render3d-layer';
  layer.dataset.state = 'loading';
  const bar = document.createElement('div');
  bar.className = 'render3d-bar';
  const label = document.createElement('span');
  label.dataset.debug = 'render3d-status';
  label.textContent = '3D 模式加载中…';
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = '切回 2D';
  back.dataset.debug = 'render3d-exit';
  bar.append(label, back);
  layer.append(bar);
  board.append(layer);

  let renderer: Renderer3d | null = null, disposed = false;
  const observer = new ResizeObserver(() => renderer?.resize(layer.clientWidth, layer.clientHeight));
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect(); renderer?.dispose(); renderer = null; layer.remove();
  };
  back.addEventListener('click', () => {
    dispose();
    history.replaceState(history.state, '', withoutRenderParam(window.location.href));
  });

  // The only reference to the 3D chunk. When src/rendering3d/ ships, point this import at its entry.
  import('./placeholder-renderer')
    .then(module => module.mountRenderer3d(layer, { assetBase: readAssetBase3d(search) }))
    .then(mounted => {
      if (disposed) { mounted.dispose(); return; }
      renderer = mounted;
      layer.dataset.state = mounted.status;
      label.textContent = `3D 预览 · ${mounted.detail}`;
      observer.observe(layer);
    })
    .catch((error: unknown) => {
      console.warn('3D 模式不可用，留在 2D', error);
      if (disposed) return;
      dispose();
      const notice = document.createElement('div');
      notice.className = 'render3d-notice';
      notice.dataset.debug = 'render3d-fallback';
      notice.textContent = '3D 模式不可用，已使用 2D';
      board.append(notice);
      setTimeout(() => notice.remove(), 4000);
    });
  return { dispose };
}
