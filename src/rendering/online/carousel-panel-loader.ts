import { createLazyChunk, type LazyChunkOptions } from '../../presentation/lazy-chunk';
import type { CarouselPanel, CarouselSide } from './carousel-panel';
import type { CarouselView, SeatPublic } from './protocol';

/**
 * The carousel (选秀) panel is its own chunk (assets/ui/, 2D bundle split 11-19). The online client prefetches it once
 * the first screen is idle, long before the first carousel round; a carousel view that comes before it arrives shows
 * one loading line and is drawn as soon as it does. The server runs the carousel either way (picks, release times and
 * the auto-pick never wait for this panel).
 */
export function createCarouselPanelChunk(options?: LazyChunkOptions) {
  return createLazyChunk(() => import('./carousel-panel'), '选秀面板', options);
}
export type CarouselPanelChunk = ReturnType<typeof createCarouselPanelChunk>;
export const CAROUSEL_LOADING_TEXT = '选秀加载中…';
let shared: CarouselPanelChunk | undefined;
export const carouselPanelChunk = (): CarouselPanelChunk => (shared ??= createCarouselPanelChunk());

/** What the online client uses of the panel; before the chunk arrives it holds the latest view and reads as closed. */
export class LazyCarouselPanel {
  private panel: CarouselPanel | undefined;
  private args: Parameters<CarouselPanel['render']> | undefined;
  private shownIn3d = false;
  private loading: HTMLElement | undefined;
  private disposed = false;
  private readonly unsubscribe: () => void;
  constructor(private readonly host: HTMLElement, onPick: (slot: number, view: CarouselView) => void, onSide: (side: CarouselSide) => void,
    onLoaded: () => void, chunk: CarouselPanelChunk = carouselPanelChunk()) {
    this.unsubscribe = chunk.onReady(module => {
      if (this.disposed) return;
      this.loading?.remove(); this.loading = undefined;
      const panel = this.panel = new module.CarouselPanel(host, onPick, onSide);
      if (this.args) panel.render(...this.args);
      panel.drawnIn3d = this.shownIn3d;
      onLoaded();
    });
    this.chunk = chunk;
    chunk.prefetch();
  }
  private readonly chunk: CarouselPanelChunk;
  get loaded(): boolean { return this.panel !== undefined; }
  get showing(): CarouselSide | null { return this.panel?.showing ?? null; }
  get pendingSlot(): number | null { return this.panel?.pendingSlot ?? null; }
  set drawnIn3d(on: boolean) { this.shownIn3d = on; if (this.panel) this.panel.drawnIn3d = on; }
  render(view: CarouselView | null, seats: readonly SeatPublic[], mySeatId: string, serverNow: number): void {
    if (this.panel) { this.panel.render(view, seats, mySeatId, serverNow); return; }
    this.args = [view, seats, mySeatId, serverNow];
    if (view && !this.loading) {
      this.loading = document.createElement('p'); this.loading.className = 'carousel-loading'; this.loading.dataset.debug = 'online:carousel-loading';
      this.loading.textContent = CAROUSEL_LOADING_TEXT; this.host.append(this.loading);
    }
    if (view) void this.chunk.load();
  }
  hide(): void {
    if (this.panel) { this.panel.hide(); return; }
    this.args = undefined; this.loading?.remove(); this.loading = undefined;
  }
  clearPending(): void { this.panel?.clearPending(); }
  pickSlot(slot: number): boolean { return this.panel?.pickSlot(slot) ?? false; }
  hoverSlot(slot: number | null): void { this.panel?.hoverSlot(slot); }
  elapsedNow(): number | null { return this.panel?.elapsedNow() ?? null; }
  tick(): void { this.panel?.tick(); }
  dispose(): void { this.disposed = true; this.unsubscribe(); this.loading?.remove(); this.panel?.dispose(); }
}
