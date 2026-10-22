import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { ModelCache, type ModelLease, type ModelTemplate } from '../src/rendering3d';
import { createLoadReport, createModelWarmup, type ModelWarmup } from '../src/rendering/three-mode/model-warmup';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function flush() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
const lease = (): ModelLease => ({ scene: new Group(), animations: [], animationNames: {}, placeholder: false, release: vi.fn() });

describe('idle model warm-up', () => {
  let warmup: ModelWarmup | undefined;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { warmup?.dispose(); warmup = undefined; vi.clearAllTimers(); vi.useRealTimers(); });

  it('pauses during combat, resumes in preparation, and waits for each upload before loading the next model', async () => {
    const idle: (() => void)[] = [], first = deferred<ModelLease>(), upload = deferred<number>();
    let fighting = true;
    const a = lease(), b = lease(), load = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(b);
    const gpu = vi.fn().mockReturnValueOnce(upload.promise).mockResolvedValue(2), progress = vi.fn();
    warmup = createModelWarmup({ load, has: id => id !== 'missing', upload: gpu, busy: () => fighting,
      idle: step => idle.push(step), onProgress: progress });
    warmup.want(['legend', 'cost1', 'legend', 'missing']);
    expect(warmup.size).toBe(2); expect(idle).toHaveLength(1);
    idle.shift()!(); await flush();
    expect(load).not.toHaveBeenCalled(); expect(progress).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500); idle.shift()!(); await flush(); expect(load).not.toHaveBeenCalled();
    fighting = false; await vi.advanceTimersByTimeAsync(500); idle.shift()!();
    expect(load).toHaveBeenCalledExactlyOnceWith('legend');
    first.resolve(a); await flush(); expect(gpu).toHaveBeenCalledExactlyOnceWith(a);
    expect(idle).toHaveLength(0); expect(a.release).not.toHaveBeenCalled(); expect(warmup.warmed('legend')).toBe(false);
    upload.resolve(3); await flush();
    expect(a.release).toHaveBeenCalledTimes(1); expect(warmup.warmed('legend')).toBe(true); expect(idle).toHaveLength(1);
    idle.shift()!(); await flush();
    expect(load.mock.calls.map(([id]) => id)).toEqual(['legend', 'cost1']);
    expect(b.release).toHaveBeenCalledTimes(1); expect(progress.mock.calls).toEqual([[1, 2], [2, 2]]);
    warmup.want(['cost1', 'legend']); expect(idle).toHaveLength(0);
  });

  it.each(['idle', 'combat retry', 'load', 'upload'] as const)('cancels at %s without starting any further model requests', async phase => {
    const idle: (() => void)[] = [], pending = deferred<ModelLease>(), uploading = deferred<number>(), model = lease();
    const load = vi.fn(() => pending.promise), upload = vi.fn(() => uploading.promise);
    warmup = createModelWarmup({ load, upload, has: () => true, busy: () => phase === 'combat retry', idle: step => idle.push(step) });
    warmup.want(['a', 'b']);
    if (phase !== 'idle') idle.shift()!();
    if (phase === 'upload') { pending.resolve(model); await flush(); expect(upload).toHaveBeenCalledTimes(1); }
    warmup.dispose(); warmup.want(['c']);
    if (phase === 'idle') idle.shift()!();
    pending.resolve(model); uploading.resolve(4); await flush(); await vi.advanceTimersByTimeAsync(2000);
    expect(load).toHaveBeenCalledTimes(phase === 'load' || phase === 'upload' ? 1 : 0);
    expect(upload).toHaveBeenCalledTimes(phase === 'upload' ? 1 : 0);
    expect(idle).toHaveLength(0);
    expect(model.release).toHaveBeenCalledTimes(phase === 'load' || phase === 'upload' ? 1 : 0);
  });

  it('cancel leaves a pending idle callback harmless and allows a fresh queue afterwards', async () => {
    const idle: (() => void)[] = [], load = vi.fn(async () => lease()), upload = vi.fn(async () => 1);
    warmup = createModelWarmup({ load, upload, has: () => true, busy: () => false, idle: step => idle.push(step) });
    warmup.want(['old-a', 'old-b']); warmup.cancel();
    idle.shift()!(); await flush();
    expect(load).not.toHaveBeenCalled(); expect(upload).not.toHaveBeenCalled();
    warmup.want(['new']); expect(idle).toHaveLength(1); idle.shift()!(); await flush();
    expect(load).toHaveBeenCalledExactlyOnceWith('new'); expect(warmup.warmed('new')).toBe(true);
  });

  it('forgets an evicted model and schedules a fresh read and completed GPU upload on want', async () => {
    const idle: (() => void)[] = [], first = lease(), second = lease(), uploading = deferred<number>();
    const load = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const upload = vi.fn().mockResolvedValueOnce(1).mockReturnValueOnce(uploading.promise);
    warmup = createModelWarmup({ load, upload, has: () => true, busy: () => false, idle: step => idle.push(step) });
    warmup.want(['toy']); idle.shift()!(); await flush();
    expect(warmup.warmed('toy')).toBe(true); expect(warmup.size).toBe(1);
    warmup.want(['toy']); expect(idle).toHaveLength(0);
    warmup.forget('toy');
    expect(warmup.warmed('toy')).toBe(false); expect(warmup.size).toBe(0);
    warmup.want(['toy', 'toy']); expect(idle).toHaveLength(1); expect(warmup.size).toBe(1);
    idle.shift()!(); await flush();
    expect(load.mock.calls).toEqual([['toy'], ['toy']]);
    expect(upload.mock.calls).toEqual([[first], [second]]);
    expect(warmup.warmed('toy')).toBe(false); expect(second.release).not.toHaveBeenCalled();
    uploading.resolve(2); await flush();
    expect(warmup.warmed('toy')).toBe(true);
    expect(first.release).toHaveBeenCalledTimes(1); expect(second.release).toHaveBeenCalledTimes(1);
    warmup.want(['toy']); expect(idle).toHaveLength(0);
  });

  it.each(['cancel', 'dispose'] as const)('%s clears the combat retry timer immediately', async action => {
    const idle: (() => void)[] = [], load = vi.fn(async () => lease());
    warmup = createModelWarmup({ load, upload: async () => 1, has: () => true, busy: () => true, idle: step => idle.push(step) });
    warmup.want(['a']); idle.shift()!(); await flush();
    expect(vi.getTimerCount()).toBe(1);
    warmup[action](); expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(idle).toHaveLength(0); expect(load).not.toHaveBeenCalled();
  });

  it('lets the in-flight model finish after cancel without restoring models that were queued', async () => {
    const idle: (() => void)[] = [], pending = deferred<ModelLease>(), model = lease();
    let fighting = false;
    const load = vi.fn(() => pending.promise), upload = vi.fn(async () => 1);
    warmup = createModelWarmup({ load, upload, has: () => true, busy: () => fighting, idle: step => idle.push(step) });
    warmup.want(['a', 'b']); idle.shift()!();
    fighting = true; warmup.cancel(); pending.resolve(model); await flush();
    expect(model.release).toHaveBeenCalledTimes(1); expect(upload).not.toHaveBeenCalled();
    fighting = false; await vi.advanceTimersByTimeAsync(500);
    while (idle.length) { idle.shift()!(); await flush(); }
    // cancel explicitly allows the current model to finish; only the waiting model b must stay cancelled.
    expect(load.mock.calls).toEqual([['a'], ['a']]); expect(upload).toHaveBeenCalledExactlyOnceWith(model);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shares already parsed and in-flight on-demand models with the real ModelCache', async () => {
    const pending = deferred<ModelTemplate>(), read = vi.fn((url: string) => url.endsWith('pending.glb') ? pending.promise
      : Promise.resolve({ scene: new Group(), animations: [] }));
    const cache = new ModelCache({ schemaVersion: 1, models: { ready: { path: 'ready.glb' }, pending: { path: 'pending.glb' } } }, '/test/', read);
    const ready = await cache.load('ready'), demand = cache.load('pending'); await flush();
    const idle: (() => void)[] = [], upload = vi.fn(async () => 1);
    warmup = createModelWarmup({ load: id => cache.load(id), has: () => true, upload, busy: () => false, idle: step => idle.push(step) });
    try {
      warmup.want(['ready', 'pending', 'ready']); idle.shift()!(); await flush();
      idle.shift()!(); await flush(); expect(upload).toHaveBeenCalledTimes(1);
      expect(read.mock.calls.map(([url]) => url)).toEqual(['/test/ready.glb', '/test/pending.glb']);
      pending.resolve({ scene: new Group(), animations: [] }); const held = await demand; await flush();
      expect(upload).toHaveBeenCalledTimes(2); expect(warmup.warmed('pending')).toBe(true);
      expect(read).toHaveBeenCalledTimes(2); held.release();
    } finally { ready.release(); cache.dispose(); }
  });

  it('waits for prepare after upload and retries an interrupted prepare at the front', async () => {
    const idle: (() => void)[] = [], prepared = deferred<boolean>(), a = lease(), b = lease();
    let fighting = false;
    const load = vi.fn(async (id: string) => id === 'a' ? a : b), upload = vi.fn(async () => 1);
    const prepare = vi.fn().mockReturnValueOnce(prepared.promise).mockResolvedValue(true);
    warmup = createModelWarmup({ load, upload, prepare, has: () => true, busy: () => fighting, idle: step => idle.push(step) });
    warmup.want(['a', 'b']); idle.shift()!(); await flush();
    expect(upload).toHaveBeenCalledExactlyOnceWith(a); expect(prepare).toHaveBeenCalledExactlyOnceWith('a', a);
    expect(warmup.warmed('a')).toBe(false); expect(a.release).not.toHaveBeenCalled(); expect(idle).toHaveLength(0);
    fighting = true; prepared.resolve(false); await flush();
    expect(a.release).toHaveBeenCalledTimes(1); expect(warmup.warmed('a')).toBe(false);
    fighting = false; await vi.advanceTimersByTimeAsync(500); idle.shift()!(); await flush();
    expect(load.mock.calls).toEqual([['a'], ['a']]); expect(warmup.warmed('a')).toBe(true);
    idle.shift()!(); await flush(); expect(load.mock.calls).toEqual([['a'], ['a'], ['b']]);
    expect(prepare.mock.calls.map(([id]) => id)).toEqual(['a', 'a', 'b']);
  });

  it('releases an interrupted preparation on dispose without restoring its queue', async () => {
    const idle: (() => void)[] = [], pending = deferred<boolean>(), model = lease(), load = vi.fn(async () => model);
    warmup = createModelWarmup({ load, upload: async () => 1, prepare: () => pending.promise,
      has: () => true, busy: () => false, idle: step => idle.push(step) });
    warmup.want(['a', 'b']); idle.shift()!(); await flush(); warmup.dispose(); pending.resolve(false); await flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(model.release).toHaveBeenCalledTimes(1); expect(warmup.warmed('a')).toBe(false);
    expect(load).toHaveBeenCalledTimes(1); expect(idle).toHaveLength(0);
  });

  it('does not queue the active id again when hints change during prepare', async () => {
    const idle: (() => void)[] = [], pending = deferred<boolean>(), load = vi.fn(async () => lease());
    const prepare = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(true);
    warmup = createModelWarmup({ load, upload: async () => 1, prepare, has: () => true, busy: () => false, idle: step => idle.push(step) });
    warmup.want(['a']); idle.shift()!(); await flush();
    warmup.want(['a', 'b']); pending.resolve(true); await flush();
    while (idle.length) { idle.shift()!(); await flush(); }
    expect(load.mock.calls).toEqual([['a'], ['b']]);
    expect(prepare.mock.calls.map(([id]) => id)).toEqual(['a', 'b']);
  });
});

describe('first-batch timing accounting', () => {
  it('sums each model read/parse once for shared models and completes only the first nonempty batch', () => {
    let now = 100;
    const load = createLoadReport(() => now);
    load.frame([], 0); expect(load.began).toBe(false);
    load.read('a', 7, 11); load.read('a', 70, 110); load.read('b', 13, 17); load.read('unused', 999, 999);
    load.frame(['p1', 'p2', 'p3'], 1); expect(load.waiting).toBe(true);
    expect(load.attached('unrelated', 'unused')).toBe(false);
    expect(load.attached('p1', 'a')).toBe(false); expect(load.attached('p2', 'a')).toBe(false);
    load.uploaded(3); now = 180; expect(load.attached('p3', 'b')).toBe(true); load.uploaded(5);
    expect(load.report).toEqual({ pieces: 3, shown: 3, wallMs: 80, readMs: 20, parseMs: 28, uploadMs: 8, warmed: 1 });
    load.frame(['later'], 0); expect(load.attached('later', 'unused')).toBe(false); expect(load.attached('p3', 'b')).toBe(false);
    expect(load.waiting).toBe(false); expect(load.report.shown).toBe(3);
    expect(createLoadReport(() => now).report).toEqual({ pieces: 0, shown: 0, wallMs: null, readMs: 0, parseMs: 0, uploadMs: 0, warmed: 0 });
  });

  it('stops waiting for removed pieces without claiming their models were shown', () => {
    let now = 0; const load = createLoadReport(() => now);
    load.frame(['shown', 'removed'], 0); load.attached('shown', 'model'); now = 20;
    expect(load.dropped('unrelated')).toBe(false); expect(load.dropped('removed')).toBe(true);
    expect(load.report).toMatchObject({ pieces: 2, shown: 1, wallMs: 20 });
    expect(load.dropped('removed')).toBe(false); expect(load.attached('removed', 'model')).toBe(false);
  });
});
