/**
 * A UI chunk loaded after the first screen (2D bundle split, 11-19): prefetched when the page is idle, awaited where it
 * is first needed, and retried on its own when a request fails (offline, a 404 while a deploy rolls). While a retry is
 * pending one line tells the player; nothing else waits on it, so a round timer never stops for a panel.
 * Tests inject the importer, the timer and the idle hook to exercise slow and failed requests without a network.
 */
export interface LazyChunkOptions {
  /** Delays before each retry (ms); the last repeats until the chunk arrives. */
  readonly retryDelaysMs?: readonly number[];
  readonly setTimer?: (callback: () => void, ms: number) => unknown;
  readonly idle?: (callback: () => void) => void;
  /** Told when this chunk starts waiting for a retry (true) and when it arrives after one (false). */
  readonly notice?: (label: string, retrying: boolean) => void;
}
export interface LazyChunk<T> {
  /** The module once loaded. */
  peek(): T | undefined;
  /** Resolves with the module; a failure is retried until it arrives (it never rejects). */
  load(): Promise<T>;
  /** Starts loading when the page is idle (the first screen comes first). */
  prefetch(): void;
  /** Called once when the module arrives. */
  onReady(listener: (module: T) => void): () => void;
  /** Failed requests so far (for the debug read and the tests). */
  readonly failures: number;
}

export const RETRY_DELAYS_MS: readonly number[] = [1000, 2000, 4000, 8000];
const idleDefault = (callback: () => void) => {
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(callback, { timeout: 3000 }); else setTimeout(callback, 200);
};

export function createLazyChunk<T>(importChunk: () => Promise<T>, label: string, options: LazyChunkOptions = {}): LazyChunk<T> {
  const delays = options.retryDelaysMs ?? RETRY_DELAYS_MS, setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  const notice = options.notice ?? showChunkNotice;
  let module: T | undefined, pending: Promise<T> | undefined, failures = 0;
  const listeners = new Set<(module: T) => void>();
  const attempt = (resolve: (value: T) => void) => {
    importChunk().then(value => {
      module = value;
      if (failures > 0) notice(label, false);
      resolve(value);
      for (const listener of [...listeners]) listener(value);
      listeners.clear();
    }, () => {
      failures++;
      notice(label, true);
      setTimer(() => attempt(resolve), delays[Math.min(failures - 1, delays.length - 1)]!);
    });
  };
  const load = () => module !== undefined ? Promise.resolve(module) : (pending ??= new Promise<T>(attempt));
  return {
    peek: () => module,
    load,
    prefetch() { if (module === undefined && !pending) (options.idle ?? idleDefault)(() => { void load(); }); },
    onReady(listener) {
      if (module !== undefined) { listener(module); return () => undefined; }
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
    get failures() { return failures; },
  };
}

/** One line at the bottom of the page while any UI chunk waits for a retry. */
const retrying = new Set<string>();
export function showChunkNotice(label: string, waiting: boolean): void {
  if (waiting) retrying.add(label); else retrying.delete(label);
  if (typeof document === 'undefined') return;
  let node = document.getElementById('ui-chunk-notice');
  if (retrying.size === 0) { node?.remove(); return; }
  if (!node) {
    node = document.createElement('div'); node.id = 'ui-chunk-notice'; node.setAttribute('role', 'status'); node.dataset.debug = 'ui-chunk-notice';
    node.style.cssText = 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:9999;padding:4px 12px;border-radius:4px;'
      + 'background:rgba(20,24,32,.88);color:#f0e6c8;font:13px/1.5 system-ui,sans-serif;pointer-events:none';
    document.body.append(node);
  }
  node.textContent = `${[...retrying].join('、')}加载失败，正在重试…`;
}
