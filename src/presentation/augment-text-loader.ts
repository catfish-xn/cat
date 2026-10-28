/** Injectable importer lets tests exercise slow and failed requests without a network. */
export function createAugmentTextLoader<TextData>(importData: () => Promise<TextData>) {
  let data: TextData | undefined;
  let pending: Promise<void> | undefined;
  let failed = false;
  const listeners = new Set<() => void>();
  /** Calling explicitly after failure retries; render-time reads never retry-loop. */
  function loadAugmentText(): Promise<void> {
    if (data) return Promise.resolve();
    if (pending) return pending;
    failed = false;
    pending = importData().then(result => { data = result; }, () => { failed = true; })
      .then(() => {
        pending = undefined;
        for (const listener of listeners) listener();
      });
    return pending;
  }
  function readAugmentText(): TextData | undefined {
    if (!data && !pending && !failed) void loadAugmentText();
    return data;
  }
  const augmentTextPlaceholder = (): string => failed ? '强化说明加载失败，请刷新页面重试' : '强化说明加载中…';
  function onAugmentTextChanged(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }
  const peekAugmentText = () => data;
  return { peekAugmentText, loadAugmentText, readAugmentText, augmentTextPlaceholder, onAugmentTextChanged };
}
export const { peekAugmentText, loadAugmentText, readAugmentText, augmentTextPlaceholder, onAugmentTextChanged } =
  // Keep text-only UI chunks independent of the domain. The companion projection
  // is loaded by the same request and shares the server's synchronous implementation.
  createAugmentTextLoader(async () => {
    const [text, dynamic] = await Promise.all([import('./augment-text-data'), import('../simulation/augment-dynamic-values')]);
    return { ...text, augmentDynamicValues: dynamic.augmentDynamicValues };
  });
