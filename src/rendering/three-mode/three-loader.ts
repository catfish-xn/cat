/**
 * 3D 单独加载模式外壳。这一文件留在 2D 主包里，体积很小；three.js 和渲染实现只在 `?render=3d` 时
 * 动态 import，构建时落在 assets/3d/（见 vite.config.ts），JS 体积预算把它单列，不计入 2D 门槛。
 * 3D 层盖在 #board-root 上，画面和棋盘指针都在 3D 层；拖放和点选经 board-feed 交回 2D 棋盘的同一套手势和命令。
 * 任何失败都留在 2D。
 */
import { buildAssetBase3d, readAssetBase3d, readRenderMode, withRenderParam, withoutRenderParam } from '../render-mode';
import type { Renderer3d } from './contract';
import { boardFeed } from '../board-feed';
import { reducedMotion } from '../../presentation/preferences';
import { THEME, costColor, starColor } from '../../presentation/theme';
import { s13AssetUrl } from '../../presentation/s13-assets';
import { SHOP_CATALOG_BY_COST } from '../../simulation/match-rules';

export interface ThreeModeHandle { dispose(): void }

const NOOP: ThreeModeHandle = { dispose() {} };

export function mountThreeMode(board: HTMLElement, search = window.location.search): ThreeModeHandle {
  let current = NOOP;
  const show2d = () => { current = mountEntry(board, () => {
    current.dispose();
    const href = withRenderParam(window.location.href);
    history.replaceState(history.state, '', href);
    show3d(new URL(href).search);
  }); };
  const show3d = (next: string) => { current = mount3d(board, next, show2d); };
  if (readRenderMode(search) === '3d') show3d(search); else show2d();
  return { dispose: () => { current.dispose(); current = NOOP; } };
}

/** 2D page, built with an asset root: a corner button that opens 3D in place (none without one, e.g. the public /cat/ site). */
function mountEntry(board: HTMLElement, open: () => void): ThreeModeHandle {
  if (!buildAssetBase3d()) return NOOP;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'render3d-entry';
  button.dataset.debug = 'render3d-enter';
  button.textContent = '切换 3D';
  button.addEventListener('click', open);
  board.append(button);
  return { dispose: () => button.remove() };
}

function mount3d(board: HTMLElement, search: string, exited: () => void): ThreeModeHandle {
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
  const preload = document.createElement('span');
  preload.className = 'render3d-preload';
  preload.dataset.debug = 'render3d-preload';
  // The first visit downloads the whole asset root (tens of MB over a slow link): a bar shows it is moving.
  const meter = document.createElement('div');
  meter.className = 'render3d-progress'; meter.dataset.debug = 'render3d-progress'; meter.hidden = true;
  const fill = document.createElement('i');
  meter.append(fill);
  bar.append(label, preload, meter, back);
  layer.append(bar);
  board.append(layer);

  let renderer: Renderer3d | null = null, disposed = false, preloadClear: ReturnType<typeof setTimeout> | undefined;
  const observer = new ResizeObserver(() => renderer?.resize(layer.clientWidth, layer.clientHeight));
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect(); renderer?.dispose(); renderer = null; layer.remove();
  };
  back.addEventListener('click', () => {
    dispose();
    history.replaceState(history.state, '', withoutRenderParam(window.location.href));
    exited();
  });

  // A WebGL context that was lost and came back: this renderer goes and a fresh one mounts in the same layer.
  const remount = () => {
    if (disposed) return;
    observer.disconnect(); renderer?.dispose(); renderer = null;
    layer.dataset.state = 'loading'; label.textContent = '3D 模式重新加载中…';
    generation++; start();
  };
  // The only reference to the 3D chunk (placeholder-renderer.ts composes src/rendering3d/).
  let generation = 0;
  const start = (mine = generation) => import('./placeholder-renderer')
    .then(module => { module.useBoardFeed?.(boardFeed); module.useReducedMotion?.(reducedMotion); module.useAssetProgress?.((text, fraction) => {
        // Shown while it changes; six quiet seconds after the last update (done, or stalled) it clears so it never sits on the HUD.
        if (disposed) return; preload.textContent = text; clearTimeout(preloadClear); preloadClear = setTimeout(() => { preload.textContent = ''; }, 6000);
        meter.hidden = fraction === null; if (fraction !== null) fill.style.width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`; });
      // The cheapest shop tiers are what a game shows first: their models are parsed and uploaded while idle.
      module.useWarmModels?.([...SHOP_CATALOG_BY_COST[1], ...SHOP_CATALOG_BY_COST[2], ...SHOP_CATALOG_BY_COST[3]]);
      module.useStarColor?.(starColor); module.useCostColor?.(costColor); module.useMeterColors?.(THEME.color); module.useItemIcon?.(id => s13AssetUrl('item', id));
      module.useChampionIcon?.(id => s13AssetUrl('champion', id));
      module.useContextRestored?.(remount);
      return module.mountRenderer3d(layer, { assetBase: readAssetBase3d(search) }); })
    .then(mounted => {
      if (disposed || mine !== generation) { mounted.dispose(); return; }
      renderer = mounted;
      layer.dataset.state = mounted.status;
      label.textContent = `3D 预览 · ${mounted.detail}`;
      observer.observe(layer);
    })
    .catch((error: unknown) => {
      console.warn('3D 模式不可用，留在 2D', error);
      if (disposed || mine !== generation) return;
      dispose();
      const notice = document.createElement('div');
      notice.className = 'render3d-notice';
      notice.dataset.debug = 'render3d-fallback';
      notice.textContent = '3D 模式不可用，已使用 2D';
      board.append(notice);
      setTimeout(() => notice.remove(), 4000);
      // Back to plain 2D: a reload stays there, and the 2D page offers the button again.
      history.replaceState(history.state, '', withoutRenderParam(window.location.href));
      exited();
    });
  start();
  return { dispose };
}
