import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAugmentTextLoader } from '../../src/presentation/augment-text-loader';
import * as texts from '../../src/presentation/augment-text-data';

it('loads only on demand, deduplicates slow requests, notifies open views and caches the result', async () => {
  let finish!: (data: typeof texts) => void;
  const request = vi.fn(() => new Promise<typeof texts>(resolve => { finish = resolve; }));
  const loader = createAugmentTextLoader(request), redraw = vi.fn(), disposed = vi.fn();
  const unsubscribe = loader.onAugmentTextChanged(disposed);
  loader.onAugmentTextChanged(redraw); unsubscribe();
  expect(request).not.toHaveBeenCalled();
  expect(loader.readAugmentText()).toBeUndefined();
  expect(loader.augmentTextPlaceholder()).toContain('加载中');
  const first = loader.loadAugmentText();
  expect(loader.loadAugmentText()).toBe(first);
  expect(request).toHaveBeenCalledTimes(1);
  finish(texts); await first;
  expect(loader.readAugmentText()).toBe(texts);
  await loader.loadAugmentText();
  expect(request).toHaveBeenCalledTimes(1);
  expect(redraw).toHaveBeenCalledTimes(1); expect(disposed).not.toHaveBeenCalled();
});

it('reports a failed import once, retries on its own (no redraw loop) and redraws when the text arrives', async () => {
  // Old loaders gained lazy-chunk retries (11-19): the first failure still settles loadAugmentText, so awaiting callers
  // never block while offline; the retry runs on its timer with the bottom notice line instead of asking for a reload.
  const request = vi.fn<() => Promise<typeof texts>>().mockRejectedValueOnce(Error('offline')).mockRejectedValueOnce(Error('offline')).mockResolvedValue(texts);
  const timers: (() => void)[] = [], notices: [string, boolean][] = [], redraw = vi.fn();
  const loader = createAugmentTextLoader(request, '强化说明', { setTimer: callback => { timers.push(callback); }, notice: (label, retrying) => { notices.push([label, retrying]); } });
  loader.onAugmentTextChanged(redraw);
  await loader.loadAugmentText();
  expect(loader.augmentTextPlaceholder()).toBe('强化说明加载失败，正在重试…');
  expect(loader.readAugmentText()).toBeUndefined();
  expect(request).toHaveBeenCalledTimes(1);
  expect(redraw).toHaveBeenCalledTimes(1);
  // Reads and explicit loads while a retry waits start no extra request.
  await loader.loadAugmentText(); loader.readAugmentText();
  expect(request).toHaveBeenCalledTimes(1);
  expect(timers).toHaveLength(1);
  timers.shift()!(); await vi.waitFor(() => expect(timers).toHaveLength(1));
  expect(request).toHaveBeenCalledTimes(2);
  expect(redraw).toHaveBeenCalledTimes(1); // the second failure stays quiet
  timers.shift()!(); await vi.waitFor(() => expect(loader.readAugmentText()).toBe(texts));
  expect(request).toHaveBeenCalledTimes(3);
  expect(redraw).toHaveBeenCalledTimes(2);
  expect(loader.augmentTextPlaceholder()).toBe('强化说明加载中…');
  expect(notices).toEqual([['强化说明', true], ['强化说明', true], ['强化说明', false]]);
  expect(timers).toHaveLength(0);
});

it('the tooltip loader names its own chunk in the retry notice', async () => {
  vi.resetModules();
  vi.doMock('../../src/presentation/tooltip-text-data', () => { throw new Error('offline'); });
  const lazy = await import('../../src/presentation/lazy-chunk');
  const shown = vi.spyOn(lazy, 'showChunkNotice').mockImplementation(() => undefined);
  try {
    const tooltip = await import('../../src/presentation/tooltip-text-loader');
    await tooltip.loadTooltipText();
    expect(shown).toHaveBeenCalledWith('技能和装备说明', true);
    expect(tooltip.tooltipTextPlaceholder()).toContain('加载失败，正在重试');
  } finally { shown.mockRestore(); vi.doUnmock('../../src/presentation/tooltip-text-data'); vi.resetModules(); }
});

it('keeps the lazy team-up wording identical to the archived source tables', async () => {
  const { V19_OFFICIAL_TRAIT_TEXT } = await import('../../src/simulation/content/v19-trait-text');
  const { V20_OFFICIAL_TRAIT_TEXT } = await import('../../src/simulation/content/v20-trait-text');
  expect((await import('../../src/presentation/tooltip-text-data')).EXTRA_TRAIT_TEXT).toEqual({ ...V19_OFFICIAL_TRAIT_TEXT, ...V20_OFFICIAL_TRAIT_TEXT });
});

it('loads the same synchronous dynamic projection used by the server with augment text', async () => {
  const { loadAugmentText, peekAugmentText } = await import('../../src/presentation/augment-text-loader');
  const { augmentDynamicValues } = await import('../../src/simulation/augment-dynamic-values');
  await loadAugmentText();
  expect(peekAugmentText()?.augmentDynamicValues).toBe(augmentDynamicValues);
});

describe('mode-specific augment imports', () => {
  afterEach(() => {
    vi.doUnmock('../../src/presentation/augment-text-data');
    vi.doUnmock('../../src/simulation/augment-dynamic-values');
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it.each(['?mode=online', '?mode=online&server=ws'])('loads text without requesting solo dynamic values for %s', async search => {
    vi.resetModules();
    vi.stubGlobal('window', { location: { search } });
    const requestText = vi.fn(() => texts);
    const requestDynamic = vi.fn(() => { throw new Error('online must not import solo values'); });
    vi.doMock('../../src/presentation/augment-text-data', requestText);
    vi.doMock('../../src/simulation/augment-dynamic-values', requestDynamic);
    const loader = await import('../../src/presentation/augment-text-loader');
    expect(requestText).not.toHaveBeenCalled();
    expect(requestDynamic).not.toHaveBeenCalled();
    expect(loader.readAugmentText()).toBeUndefined();
    await loader.loadAugmentText();
    expect(loader.peekAugmentText()).toMatchObject(texts);
    expect(loader.peekAugmentText()?.augmentDynamicValues).toBeUndefined();
    await loader.loadAugmentText();
    expect(requestText).toHaveBeenCalledTimes(1);
    expect(requestDynamic).not.toHaveBeenCalled();
  });

  it.each(['text', 'dynamic'] as const)('waits for both solo modules when %s resolves first', async first => {
    vi.resetModules();
    vi.stubGlobal('window', { location: { search: '' } });
    const projection = vi.fn(() => ({}));
    let finishText!: (value: typeof texts) => void;
    let finishDynamic!: (value: { augmentDynamicValues: typeof projection }) => void;
    const text = new Promise<typeof texts>(resolve => { finishText = resolve; });
    const dynamic = new Promise<{ augmentDynamicValues: typeof projection }>(resolve => { finishDynamic = resolve; });
    const requestText = vi.fn(() => text), requestDynamic = vi.fn(() => dynamic);
    vi.doMock('../../src/presentation/augment-text-data', requestText);
    vi.doMock('../../src/simulation/augment-dynamic-values', requestDynamic);
    const loader = await import('../../src/presentation/augment-text-loader');
    const redraw = vi.fn();
    loader.onAugmentTextChanged(redraw);
    const pending = loader.loadAugmentText();
    await vi.waitFor(() => {
      expect(requestText).toHaveBeenCalledTimes(1);
      expect(requestDynamic).toHaveBeenCalledTimes(1);
    });
    if (first === 'text') { finishText(texts); await text; }
    else { finishDynamic({ augmentDynamicValues: projection }); await dynamic; }
    expect(loader.peekAugmentText()).toBeUndefined();
    expect(loader.readAugmentText()).toBeUndefined();
    expect(redraw).not.toHaveBeenCalled();
    if (first === 'text') finishDynamic({ augmentDynamicValues: projection });
    else finishText(texts);
    await pending;
    expect(loader.peekAugmentText()).toMatchObject(texts);
    expect(loader.peekAugmentText()?.augmentDynamicValues).toBe(projection);
    expect(redraw).toHaveBeenCalledTimes(1);
    await loader.loadAugmentText();
    expect(requestText).toHaveBeenCalledTimes(1);
    expect(requestDynamic).toHaveBeenCalledTimes(1);
  });
});
