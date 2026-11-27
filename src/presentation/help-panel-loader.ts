import { createLazyChunk, type LazyChunkOptions } from './lazy-chunk';

/**
 * The help dialog is its own chunk (assets/ui/, 2D bundle budget 11-28): it opens only on the help button, so its text and
 * code load then (prefetched once the first screen is idle) instead of with the first screen. Behaviour is unchanged: the
 * dialog opens when the chunk has arrived, normally already prefetched.
 */
export function createHelpPanelChunk(options?: LazyChunkOptions) {
  return createLazyChunk(() => import('./help-panel'), '帮助', options);
}
export type HelpPanelChunk = ReturnType<typeof createHelpPanelChunk>;
let shared: HelpPanelChunk | undefined;
/** One chunk per page: a scene restart reuses what the first one loaded. */
export const helpPanelChunk = (): HelpPanelChunk => (shared ??= createHelpPanelChunk());
