import type { MergeFx, MergeFxHost, createMergeFx } from './merge-fx';

/** Import only on the first merge; late imports cannot paint into a stopped/restarted scene. */
export function lazyMergeFx(host: MergeFxHost) {
  let fx: ReturnType<typeof createMergeFx> | undefined, pending: Promise<void> | undefined, disposed = false;
  const queued: (readonly MergeFx[])[] = [];
  return {
    play(merges: readonly MergeFx[]) {
      if (disposed) return;
      if (fx) { fx.play(merges); return; }
      queued.push(merges);
      pending ??= import('./merge-fx').then(module => {
        if (disposed) return;
        fx = module.createMergeFx(host);
        queued.splice(0).forEach(batch => fx!.play(batch));
      }).catch(() => { queued.length = 0; pending = undefined; });
    },
    dispose() { disposed = true; queued.length = 0; fx?.dispose(); },
  };
}
