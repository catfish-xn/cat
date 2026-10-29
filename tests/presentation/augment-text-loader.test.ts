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

it('reports a failed import, never creates a redraw/retry loop, and permits explicit retry', async () => {
  const request = vi.fn<() => Promise<typeof texts>>().mockRejectedValueOnce(Error('offline')).mockResolvedValue(texts);
  const loader = createAugmentTextLoader(request);
  await loader.loadAugmentText();
  expect(loader.augmentTextPlaceholder()).toContain('加载失败');
  expect(loader.readAugmentText()).toBeUndefined();
  expect(request).toHaveBeenCalledTimes(1);
  await loader.loadAugmentText();
  expect(loader.readAugmentText()).toBe(texts);
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
