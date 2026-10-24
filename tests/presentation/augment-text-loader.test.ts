import { expect, it, vi } from 'vitest';
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
