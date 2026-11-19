import { createLazyChunk, showChunkNotice, type LazyChunkOptions } from './lazy-chunk';

/** Injectable importer (and retry timer) lets tests exercise slow and failed requests without a network.
 * A failed request is retried on its own (lazy-chunk.ts: 1/2/4/8 s, then every 8 s, with the bottom notice line);
 * the first settle (data or failure) still resolves loadAugmentText, so a caller that awaits it never blocks while offline. */
export function createAugmentTextLoader<TextData>(importData: () => Promise<TextData>, label = '强化说明', options: LazyChunkOptions = {}) {
  let data: TextData | undefined;
  let started: Promise<void> | undefined;
  let failed = false;
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of [...listeners]) listener(); };
  let settleFirst: (() => void) | undefined;
  const chunk = createLazyChunk(importData, label, { ...options, notice: (chunkLabel, retrying) => {
    (options.notice ?? showChunkNotice)(chunkLabel, retrying);
    // The first failure redraws open views once with the retrying placeholder; later failures stay quiet.
    if (retrying && !failed) { failed = true; settleFirst?.(); notify(); }
  } });
  chunk.onReady(result => { data = result; failed = false; settleFirst?.(); notify(); });
  /** Resolves once the first request settles (loaded, or failed and now retrying on its own). */
  function loadAugmentText(): Promise<void> {
    if (data) return Promise.resolve();
    started ??= new Promise<void>(resolve => { settleFirst = () => { settleFirst = undefined; resolve(); }; void chunk.load(); });
    return started;
  }
  function readAugmentText(): TextData | undefined {
    if (!data && !started) void loadAugmentText();
    return data;
  }
  const augmentTextPlaceholder = (): string => failed ? '强化说明加载失败，正在重试…' : '强化说明加载中…';
  function onAugmentTextChanged(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }
  const peekAugmentText = () => data;
  return { peekAugmentText, loadAugmentText, readAugmentText, augmentTextPlaceholder, onAugmentTextChanged };
}
export const { peekAugmentText, loadAugmentText, readAugmentText, augmentTextPlaceholder, onAugmentTextChanged } =
  // Online values come from the server; never request the solo projection there.
  // Solo text and its synchronous projection become visible atomically.
  createAugmentTextLoader(async () => {
    const online = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'online';
    const [text, dynamic] = await Promise.all([
      import('./augment-text-data'),
      online ? undefined : import('../simulation/augment-dynamic-values'),
    ]);
    return { ...text, augmentDynamicValues: dynamic?.augmentDynamicValues };
  });
