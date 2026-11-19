import { createLazyChunk, type LazyChunkOptions } from '../presentation/lazy-chunk';
import type { StatsPanel, StatsView } from './stats-panel';

/**
 * The battle stats panel is its own chunk (assets/ui/, 2D bundle split 11-19): it first renders after the first battle,
 * and is prefetched once the first screen is idle. A render before it arrives keeps the latest view and shows one
 * loading line; the panel then renders that view, so no battle's numbers are lost.
 */
export function createStatsPanelChunk(options?: LazyChunkOptions) {
  return createLazyChunk(() => import('./stats-panel'), '统计面板', options);
}
export type StatsPanelChunk = ReturnType<typeof createStatsPanelChunk>;
export const STATS_LOADING_TEXT = '统计加载中…';
let shared: StatsPanelChunk | undefined;
/** One chunk per page: a scene restart reuses what the first one loaded. */
export const statsPanelChunk = (): StatsPanelChunk => (shared ??= createStatsPanelChunk());

export function lazyStatsPanel(host: HTMLElement, onSelect: (id: string | null) => void, chunk: StatsPanelChunk = statsPanelChunk()): StatsPanel {
  let panel: StatsPanel | undefined, latest: StatsView | undefined, disposed = false, loading: HTMLElement | undefined;
  const ready = (module: typeof import('./stats-panel')) => {
    if (disposed) return;
    loading?.remove(); loading = undefined;
    panel = module.createStatsPanel(host, onSelect);
    if (latest) panel.render(latest);
  };
  const unsubscribe = chunk.onReady(ready);
  chunk.prefetch();
  return {
    render(view) {
      if (panel) { panel.render(view); return; }
      latest = view;
      if (!loading) {
        loading = document.createElement('p'); loading.className = 'stats-loading'; loading.dataset.debug = 'stats-loading';
        loading.textContent = STATS_LOADING_TEXT; host.append(loading);
      }
      void chunk.load();
    },
    dispose() { disposed = true; unsubscribe(); loading?.remove(); panel?.dispose(); },
  };
}
