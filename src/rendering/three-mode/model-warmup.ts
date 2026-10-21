/**
 * Model warm-up and the first-batch load report (playtest 2026-10-21: at the start of a game the pieces stood as pawns
 * for a long while before their models appeared).
 *
 * A model shows in three steps: its bytes are read (the local store, or the network on a first visit), parsed (glTF,
 * meshopt, KTX2 transcoding) and uploaded to the GPU (textures, shader programs) on the first frame that draws it.
 * The warm-up runs the last two ahead of time for models a game is likely to show first (little legends, then the
 * cheapest shop tiers), one model per idle slot so the page never blocks, and never while a combat is shown. The parsed
 * template stays in the ModelCache, so a piece that needs it later only clones it; its textures and programs are
 * already on the GPU.
 *
 * The report times the first frame that has pieces until every one of them has its model: summed read, parse and
 * upload time per model, and the wall time, logged once to the console and kept on `window.__render3dLoad`.
 */
import type { ModelLease } from '../../rendering3d';

export interface LoadReport {
  /** Pieces in the first frame that had any, and how many of them got their model. */
  pieces: number; shown: number;
  /** Wall milliseconds from that frame until the last of them had its model; null until then. */
  wallMs: number | null;
  /** Summed per model (they overlap in time): bytes, parse, and the GPU upload of the frame that first drew them. */
  readMs: number; parseMs: number; uploadMs: number;
  /** Models parsed before the first frame by the warm-up, of those pieces. */
  warmed: number;
}

export interface WarmupContext {
  load(id: string): Promise<ModelLease>;
  has(id: string): boolean;
  /** Puts a model's textures and shader programs on the GPU; resolves with the milliseconds it took. */
  upload(lease: ModelLease): Promise<number>;
  /** Runs `step` when the page is idle (requestIdleCallback, else a short timeout). */
  idle?(step: () => void): void;
  /** True while warming would compete with something on screen (a combat). */
  busy(): boolean;
  onProgress?(done: number, total: number): void;
}

export interface ModelWarmup {
  /** Adds models to warm, in order, after the ones already asked for (a warmed or queued one is not added again). */
  want(ids: readonly string[]): void;
  /** Drops the models still waiting (the one being warmed finishes); warmed ones stay warmed. */
  cancel(): void;
  /** True once a model's template was parsed and uploaded here. */
  warmed(id: string): boolean;
  readonly size: number;
  dispose(): void;
}

const defaultIdle = (step: () => void) => {
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(step, { timeout: 1000 }); else setTimeout(step, 30);
};

export function createModelWarmup(ctx: WarmupContext): ModelWarmup {
  const queue: string[] = [], asked = new Set<string>(), done = new Set<string>();
  const idle = ctx.idle ?? defaultIdle;
  let running = false, closed = false;
  const schedule = () => {
    if (running || closed || !queue.length) return;
    running = true;
    idle(() => void step());
  };
  const step = async () => {
    if (closed) return;
    if (ctx.busy()) { running = false; setTimeout(schedule, 500); return; }
    const id = queue.shift()!;
    try {
      const lease = await ctx.load(id);
      try {
        // A combat that started while it was read waits for its upload: the model goes back to the front of the queue.
        if (closed || lease.placeholder) { if (!closed) done.add(id); return; }
        if (ctx.busy()) { queue.unshift(id); return; }
        await ctx.upload(lease);
        done.add(id);
      } finally { lease.release(); }
    } catch { /* an unreadable model stays a placeholder; the piece will say so itself */ }
    finally {
      running = false;
      ctx.onProgress?.(asked.size - queue.length, asked.size);
      if (ctx.busy()) setTimeout(schedule, 500); else schedule();
    }
  };
  return {
    want(ids) {
      for (const id of ids) if (!done.has(id) && !queue.includes(id) && ctx.has(id)) { asked.add(id); queue.push(id); }
      schedule();
    },
    cancel() { queue.length = 0; },
    warmed: id => done.has(id),
    get size() { return asked.size; },
    dispose() { closed = true; queue.length = 0; },
  };
}

/** The first-batch report: `frame` with the first piece ids seen, `attached` per model shown, `read` per model read. */
export function createLoadReport(now: () => number = () => performance.now()) {
  const report: LoadReport = { pieces: 0, shown: 0, wallMs: null, readMs: 0, parseMs: 0, uploadMs: 0, warmed: 0 };
  let started: number | null = null, waiting: Set<string> | null = null, finished = false;
  const reads = new Map<string, { readMs: number; parseMs: number }>();
  return {
    report,
    /** One model read by the asset reader (keyed by model id). */
    read(id: string, readMs: number, parseMs: number) { if (!reads.has(id)) reads.set(id, { readMs, parseMs }); },
    /** The first frame with pieces: the piece ids to wait for and the models the warm-up had already parsed. */
    frame(pieceIds: readonly string[], warmed: number) {
      if (started !== null || !pieceIds.length) return;
      started = now(); waiting = new Set(pieceIds); report.pieces = pieceIds.length; report.warmed = warmed;
    },
    /** A piece of that frame got its model (`model` its id); returns true when it was the last one. */
    attached(pieceId: string, model: string): boolean {
      if (!waiting?.delete(pieceId) || finished) return false;
      report.shown++;
      const read = reads.get(model);
      if (read) { report.readMs += read.readMs; report.parseMs += read.parseMs; reads.delete(model); }
      if (waiting.size) return false;
      finished = true; report.wallMs = now() - started!;
      return true;
    },
    /** A piece of that frame left before its model came: no longer waited for. */
    dropped(pieceId: string): boolean {
      if (!waiting?.delete(pieceId) || finished || waiting.size) return false;
      finished = true; report.wallMs = now() - started!;
      return true;
    },
    uploaded(ms: number) { report.uploadMs += ms; },
    get waiting() { return !!waiting && !finished; },
    /** True once the first frame with pieces was seen. */
    get began() { return started !== null; },
  };
}
