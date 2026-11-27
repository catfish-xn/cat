import { createLazyChunk, type LazyChunkOptions } from './lazy-chunk';
import type { HelpPanel } from './help-panel';

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

/**
 * The help button's action: the first click loads the dialog's chunk (normally already prefetched) and opens it; later
 * clicks open the same dialog at once. One that arrives after the scene has closed (`alive()` false) builds nothing.
 * `held` keeps the dialog the scene made (it destroys it on shutdown); the scene passes its own slot.
 */
export function openHelpOnDemand(held: { help: HelpPanel | null }, alive: () => boolean, chunk: HelpPanelChunk = helpPanelChunk()): void {
  if (held.help) { held.help.show(); return; }
  void chunk.load().then(module => { if (!alive()) return; (held.help ??= new module.HelpPanel()).show(); });
}
