import { createLazyChunk, type LazyChunkOptions } from '../../presentation/lazy-chunk';
import type { BattleSummaryPanel, LiveBattle } from './battle-summary';
import type { FinishedBattle } from './remote-session';

/**
 * The battle stats panel of the online right column is its own chunk (assets/ui/, 2D bundle budget 11-28): it is first
 * shown after a battle starts, and is prefetched once the first screen is idle. Until it arrives it keeps a hidden place
 * in the column (so it lands where it always stood) and the latest call; the panel then shows that call, so nothing a
 * battle showed is lost. Before it arrives `debug()` reads null, as a panel with nothing shown does.
 */
export function createBattleSummaryChunk(options?: LazyChunkOptions) {
  return createLazyChunk(() => import('./battle-summary'), '战斗统计', options);
}
export type BattleSummaryChunk = ReturnType<typeof createBattleSummaryChunk>;
let shared: BattleSummaryChunk | undefined;
/** One chunk per page: a new online application reuses what the first one loaded. */
export const battleSummaryChunk = (): BattleSummaryChunk => (shared ??= createBattleSummaryChunk());

export class LazyBattleSummary {
  private panel: BattleSummaryPanel | undefined;
  private last: ((panel: BattleSummaryPanel) => void) | undefined;
  private disposed = false;
  /** Its place in the column until the panel arrives: an empty hidden element (no comment nodes: the stand-in DOMs lack them). */
  private readonly place = Object.assign(document.createElement('span'), { hidden: true });
  private readonly unsubscribe: () => void;
  constructor(host: HTMLElement, private readonly chunk: BattleSummaryChunk = battleSummaryChunk()) {
    host.append(this.place);
    this.unsubscribe = chunk.onReady(module => {
      if (this.disposed) return;
      // Built in a holder, then put where its place was kept.
      const holder = document.createElement('div'), panel = new module.BattleSummaryPanel(holder);
      const root = holder.firstElementChild; if (root) this.place.replaceWith(root);
      this.panel = panel; this.last?.(panel); this.last = undefined;
    });
    chunk.prefetch();
  }
  live(battle: LiveBattle, roundId: string): void { this.call(panel => panel.live(battle, roundId)); }
  show(last: FinishedBattle | null, visible: boolean): void { this.call(panel => panel.show(last, visible)); }
  debug(): ReturnType<BattleSummaryPanel['debug']> { return this.panel ? this.panel.debug() : null; }
  dispose(): void { this.disposed = true; this.unsubscribe(); this.place.remove(); this.panel?.dispose(); }
  private call(apply: (panel: BattleSummaryPanel) => void): void {
    if (this.panel) { apply(this.panel); return; }
    this.last = apply; void this.chunk.load();
  }
}
