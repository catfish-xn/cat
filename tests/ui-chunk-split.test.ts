// 2D bundle split (11-19): the stats panel, the carousel panel and the G2-3 item tables load after the first screen.
// A failed request is retried with one notice line, a view drawn before a panel arrives is kept and drawn on arrival,
// and nothing rejects or blocks. Injected importers, timers and idle hooks stand in for the network.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLazyChunk, showChunkNotice } from '../src/presentation/lazy-chunk';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
function scheduler() {
  const timers: { callback: () => void; ms: number }[] = [], idles: (() => void)[] = [];
  return {
    timers, idles,
    options: { setTimer: (callback: () => void, ms: number) => { timers.push({ callback, ms }); }, idle: (callback: () => void) => { idles.push(callback); } },
    fire() { timers.splice(0).forEach(timer => timer.callback()); },
  };
}

describe('lazy UI chunks', () => {
  it('a failed request is retried after a delay and then succeeds; load() resolves once, never rejects', async () => {
    const clock = scheduler(), notices: [string, boolean][] = [];
    let calls = 0;
    const importChunk = vi.fn(async () => { calls++; if (calls <= 2) throw new Error('offline'); return { value: 42 }; });
    const chunk = createLazyChunk(importChunk, '统计面板', { ...clock.options, retryDelaysMs: [1000, 2000], notice: (label, waiting) => notices.push([label, waiting]) });
    const ready = vi.fn();
    chunk.onReady(ready);
    const loaded = chunk.load(), settled = vi.fn();
    void loaded.then(settled, settled);
    await flush();
    expect(chunk.failures).toBe(1); expect(clock.timers.map(timer => timer.ms)).toEqual([1000]);
    expect(notices).toEqual([['统计面板', true]]);
    clock.fire(); await flush();
    expect(chunk.failures).toBe(2); expect(clock.timers.map(timer => timer.ms)).toEqual([2000]);
    expect(settled).not.toHaveBeenCalled(); expect(chunk.peek()).toBeUndefined();
    clock.fire(); await flush();
    await expect(loaded).resolves.toEqual({ value: 42 });
    expect(chunk.peek()).toEqual({ value: 42 }); expect(ready).toHaveBeenCalledTimes(1);
    expect(notices.at(-1)).toEqual(['统计面板', false]);
    expect(importChunk).toHaveBeenCalledTimes(3);
    // Later loads reuse the module; a late listener is called at once.
    await chunk.load(); expect(importChunk).toHaveBeenCalledTimes(3);
    const late = vi.fn(); chunk.onReady(late); expect(late).toHaveBeenCalledTimes(1);
  });
  it('the last retry delay repeats until the chunk arrives', async () => {
    const clock = scheduler();
    let calls = 0;
    const chunk = createLazyChunk(async () => { if (++calls < 5) throw new Error('404'); return 'ok'; }, '选秀面板', { ...clock.options, retryDelaysMs: [10, 20], notice: () => {} });
    const loaded = chunk.load();
    for (let i = 0; i < 4; i++) { await flush(); clock.fire(); }
    await expect(loaded).resolves.toBe('ok');
    expect(chunk.failures).toBe(4);
  });
  it('prefetch waits for the page to be idle and then loads once; a load before that does not start a second request', async () => {
    const clock = scheduler(), importChunk = vi.fn(async () => 'module');
    const chunk = createLazyChunk(importChunk, '物品名表', { ...clock.options, notice: () => {} });
    chunk.prefetch();
    expect(importChunk).not.toHaveBeenCalled(); expect(clock.idles).toHaveLength(1);
    await chunk.load(); expect(importChunk).toHaveBeenCalledTimes(1);
    clock.idles[0]!(); await flush();
    expect(importChunk).toHaveBeenCalledTimes(1);
  });
});

describe('the retry notice', () => {
  afterEach(() => { vi.unstubAllGlobals(); showChunkNotice('统计面板', false); showChunkNotice('选秀面板', false); });
  it('one line names every chunk still waiting for a retry and goes once all arrived', () => {
    const nodes = new Map<string, { id: string; textContent: string; style: { cssText: string }; dataset: Record<string, string>; setAttribute(): void; remove(): void }>();
    vi.stubGlobal('document', {
      getElementById: (id: string) => nodes.get(id) ?? null,
      createElement: () => { const node = { id: '', textContent: '', style: { cssText: '' }, dataset: {}, setAttribute() {}, remove: () => nodes.delete(node.id) }; return node; },
      body: { append: (node: { id: string }) => nodes.set(node.id, node as never) },
    });
    showChunkNotice('统计面板', true);
    expect(nodes.get('ui-chunk-notice')?.textContent).toBe('统计面板加载失败，正在重试…');
    showChunkNotice('选秀面板', true);
    expect(nodes.get('ui-chunk-notice')?.textContent).toBe('统计面板、选秀面板加载失败，正在重试…');
    showChunkNotice('统计面板', false);
    expect(nodes.get('ui-chunk-notice')?.textContent).toBe('选秀面板加载失败，正在重试…');
    showChunkNotice('选秀面板', false);
    expect(nodes.has('ui-chunk-notice')).toBe(false);
  });
});

// A chunk the test releases by hand, with a stand-in module.
function heldChunk<T>() {
  let release: ((module: T) => void) | undefined; const listeners: ((module: T) => void)[] = [];
  let module: T | undefined; const loads = vi.fn(), prefetches = vi.fn();
  const pending = new Promise<T>(resolve => { release = resolve; });
  return {
    chunk: { peek: () => module, load: () => { loads(); return pending; }, prefetch: prefetches, failures: 0,
      onReady: (listener: (module: T) => void) => { if (module) listener(module); else listeners.push(listener); return () => { listeners.splice(listeners.indexOf(listener), 1); }; } },
    loads, prefetches,
    arrive(value: T) { module = value; release!(value); for (const listener of listeners.splice(0)) listener(value); },
  };
}
function fakeDom() {
  const made: { className: string; textContent: string; dataset: Record<string, string>; removed: boolean; remove(): void }[] = [];
  vi.stubGlobal('document', { createElement: () => { const node = { className: '', textContent: '', dataset: {}, removed: false, remove() { node.removed = true; } }; made.push(node); return node; } });
  const host = { appended: [] as unknown[], append(node: unknown) { this.appended.push(node); } };
  return { made, host };
}

describe('the stats panel before and after its chunk', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('prefetches, keeps the latest view with one loading line, and renders it on arrival; later views go straight through', async () => {
    const { lazyStatsPanel, STATS_LOADING_TEXT } = await import('../src/stats/stats-panel-loader');
    const { made, host } = fakeDom(), held = heldChunk<{ createStatsPanel: () => { render: (view: unknown) => void; dispose: () => void } }>();
    const panel = lazyStatsPanel(host as never, () => {}, held.chunk as never);
    expect(held.prefetches).toHaveBeenCalledTimes(1);
    panel.render({ stats: null, runId: 'a' } as never); panel.render({ stats: null, runId: 'b' } as never);
    expect(made.filter(node => node.textContent === STATS_LOADING_TEXT)).toHaveLength(1);
    expect(held.loads).toHaveBeenCalled();
    const rendered: unknown[] = [];
    held.arrive({ createStatsPanel: () => ({ render: view => rendered.push(view), dispose() {} }) });
    expect(rendered).toEqual([{ stats: null, runId: 'b' }]);
    expect(made[0]!.removed).toBe(true);
    panel.render({ stats: null, runId: 'c' } as never);
    expect(rendered).toEqual([{ stats: null, runId: 'b' }, { stats: null, runId: 'c' }]);
  });
  it('a panel disposed before its chunk arrives never builds', async () => {
    const { lazyStatsPanel } = await import('../src/stats/stats-panel-loader');
    const { host } = fakeDom(), held = heldChunk<{ createStatsPanel: () => never }>(), create = vi.fn();
    const panel = lazyStatsPanel(host as never, () => {}, held.chunk as never);
    panel.dispose(); held.arrive({ createStatsPanel: create as never });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('the carousel panel before and after its chunk', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('reads as closed with a loading line until it arrives, then draws the latest view and asks the client to resync', async () => {
    const { LazyCarouselPanel, CAROUSEL_LOADING_TEXT } = await import('../src/rendering/online/carousel-panel-loader');
    const { made, host } = fakeDom(), held = heldChunk<{ CarouselPanel: new (...args: unknown[]) => unknown }>(), loaded = vi.fn();
    const panel = new LazyCarouselPanel(host as never, () => {}, () => {}, loaded, held.chunk as never);
    expect(held.prefetches).toHaveBeenCalledTimes(1);
    const view = { id: 'c1' };
    panel.render(view as never, [], 'me', 5); panel.drawnIn3d = true;
    expect(panel.showing).toBeNull(); expect(panel.pickSlot(2)).toBe(false); expect(panel.elapsedNow()).toBeNull();
    expect(made.filter(node => node.textContent === CAROUSEL_LOADING_TEXT)).toHaveLength(1); expect(held.loads).toHaveBeenCalled();
    const calls: unknown[][] = [];
    class Panel { showing = 'carousel'; drawn = false; set drawnIn3d(on: boolean) { this.drawn = on; } render(...args: unknown[]) { calls.push(args); } pickSlot() { return true; } }
    held.arrive({ CarouselPanel: Panel as never });
    expect(calls).toEqual([[view, [], 'me', 5]]); expect(loaded).toHaveBeenCalledTimes(1);
    expect(panel.showing).toBe('carousel'); expect(panel.pickSlot(2)).toBe(true); expect(made[0]!.removed).toBe(true);
  });
  it('a carousel that ended before the chunk arrived is not drawn', async () => {
    const { LazyCarouselPanel } = await import('../src/rendering/online/carousel-panel-loader');
    const { host } = fakeDom(), held = heldChunk<{ CarouselPanel: new (...args: unknown[]) => unknown }>();
    const panel = new LazyCarouselPanel(host as never, () => {}, () => {}, () => {}, held.chunk as never);
    panel.render({ id: 'c1' } as never, [], 'me', 5); panel.hide();
    const render = vi.fn();
    held.arrive({ CarouselPanel: class { render = render; set drawnIn3d(_on: boolean) {} } as never });
    expect(render).not.toHaveBeenCalled();
  });
});

describe('G2-3 item names before and after their chunk', () => {
  afterEach(() => { vi.doUnmock('../src/presentation/s13-g23-items'); vi.resetModules(); });
  it('a content name and no icon until the tables arrive, then the client name and icon, with one change call', async () => {
    vi.resetModules();
    let release: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const real = await vi.importActual<typeof import('../src/presentation/s13-g23-items')>('../src/presentation/s13-g23-items');
    vi.doMock('../src/presentation/s13-g23-items', async () => { await gate; return real; });
    const display = await import('../src/presentation/g23-display');
    const { ITEM_DEFINITIONS } = await import('../src/simulation/content/g2-3-item-registry');
    const radiant = Object.entries(ITEM_DEFINITIONS).find(([, item]) => item.apiName === 'TFT5_Item_TrapClawRadiant');
    expect(radiant, 'a radiant content item').toBeDefined();
    const [id, definition] = radiant!;
    const changed = vi.fn(); display.onG23ItemsChanged(changed);
    expect(display.g23ItemsReady()).toBe(false);
    expect(display.itemDisplayName(id)).toBe(definition.name);
    expect(display.g23IconUrl('item', id)).toBeNull();
    const loaded = display.loadG23Items();
    release!(); await loaded;
    expect(display.g23ItemsReady()).toBe(true); expect(changed).toHaveBeenCalledTimes(1);
    expect(display.itemDisplayName(id)).toBe('意志破坏者');
    expect(display.g23IconUrl('item', id)).toMatch(/assets\/s13\/g23\/items\/tft5_item_trapclawradiant\.png$/);
  });
});

describe('the online battle stats before and after their chunk (2D bundle budget 11-28)', () => {
  afterEach(() => vi.unstubAllGlobals());
  type Place = { hidden: boolean; removed: boolean; replacedWith?: unknown; remove(): void; replaceWith(node: unknown): void };
  function placeDom() {
    const places: Place[] = [];
    vi.stubGlobal('document', { createElement: () => {
      const holder: { firstElementChild: unknown; append(node: unknown): void } & Partial<Place> = { firstElementChild: null, append(node) { this.firstElementChild = node; } };
      const place: Place = Object.assign(holder, { hidden: false, removed: false, remove() { place.removed = true; }, replaceWith(node: unknown) { place.replacedWith = node; } }) as never;
      places.push(place); return place;
    } });
    const host = { appended: [] as unknown[], append(node: unknown) { this.appended.push(node); } };
    return { places, host };
  }
  it('keeps a hidden place in the column, reads null, and shows only the latest call once the panel arrives, where the place was', async () => {
    const { LazyBattleSummary } = await import('../src/rendering/online/battle-summary-loader');
    const { places, host } = placeDom();
    type Panel = { live: (battle: unknown, round: string) => void; show: (last: unknown, visible: boolean) => void; debug: () => unknown; dispose: () => void };
    const held = heldChunk<{ BattleSummaryPanel: new (host: { append(node: unknown): void }) => Panel }>();
    const summary = new LazyBattleSummary(host as never, held.chunk as never);
    expect(held.prefetches).toHaveBeenCalledTimes(1);
    expect(host.appended).toEqual([places[0]]); expect(places[0]!.hidden).toBe(true);
    expect(summary.debug()).toBeNull();
    summary.live({ played: 1 } as never, '2-1'); summary.show(null, false);
    expect(held.loads).toHaveBeenCalled();
    const calls: unknown[][] = [], root = { id: 'battle-summary' };
    held.arrive({ BattleSummaryPanel: class { constructor(holder: { append(node: unknown): void }) { holder.append(root); }
      live(...args: unknown[]) { calls.push(['live', ...args]); } show(...args: unknown[]) { calls.push(['show', ...args]); }
      debug() { return { shown: true }; } dispose() { calls.push(['dispose']); } } });
    expect(calls).toEqual([['show', null, false]]);
    expect(places[0]!.replacedWith).toBe(root);
    summary.live({ played: 2 } as never, '2-1');
    expect(calls).toEqual([['show', null, false], ['live', { played: 2 }, '2-1']]);
    expect(summary.debug()).toEqual({ shown: true });
    summary.dispose(); expect(calls.at(-1)).toEqual(['dispose']);
  });
  it('a summary disposed before its chunk arrives never builds and leaves no place behind', async () => {
    const { LazyBattleSummary } = await import('../src/rendering/online/battle-summary-loader');
    const { places, host } = placeDom(), held = heldChunk<{ BattleSummaryPanel: never }>(), build = vi.fn();
    const summary = new LazyBattleSummary(host as never, held.chunk as never);
    summary.dispose(); held.arrive({ BattleSummaryPanel: build as never });
    expect(build).not.toHaveBeenCalled(); expect(places[0]!.removed).toBe(true);
  });
});

describe('the help dialog chunk (2D bundle budget 11-28)', () => {
  it('loads the help dialog module on demand, once per page', async () => {
    const { createHelpPanelChunk, helpPanelChunk } = await import('../src/presentation/help-panel-loader');
    const module = await createHelpPanelChunk().load();
    expect(typeof module.HelpPanel).toBe('function');
    expect(helpPanelChunk()).toBe(helpPanelChunk());
  });
});
