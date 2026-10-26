/**
 * 3D 素材预下载（只在 3D chunk 里）：按素材根下的 precache.json 把全部模型、特效和贴图在后台下好，存进浏览器
 * IndexedDB，按每个文件的 sha256 做版本控制，素材更新时只重下变了的文件，清单里没有的旧文件删除。
 * 选 IndexedDB 而不是 Cache Storage / Service Worker：后两者只在 HTTPS 或 localhost 下可用，素材服务器可能是纯 http。
 * 渲染器读素材一律经 read()：已缓存的从本地取；还在排队的提到队首、等它下完；不在清单里的直接走网络（不缓存）。
 * 下载失败或浏览器不让存时，对局照常，只是该文件每次走网络。Display only: nothing here reaches a rule.
 *
 * precache.json（素材管线 merge-manifests 生成）：
 *   { "schemaVersion": 1, "files": [{ "path": "models/jinx/model.glb", "bytes": 1834221, "sha256": "<64 位小写十六进制>" }] }
 * 没有 precache.json 时退回只预下载 manifest.json 里列出的模型和特效文件，且不做版本控制（已缓存的一直用）。
 *
 * packs.json（素材管线 pack-root 生成，可选）：把 precache 里的文件按模块拼成几个 5–16 MB 的大包，每个文件按
 * offset/bytes 切出后照常校验、入库。经隧道或远端服务器时每个请求约有 1 秒往返，大包省掉大部分往返。
 * 包下载或校验失败、或某个切片不符时，相应文件退回逐文件下载；渲染马上要用的文件不等整包，单独先下。
 */
import { assetUrl, type AssetManifest } from '../../rendering3d';

export interface PrecacheFile { readonly path: string; readonly bytes: number; readonly sha256: string | null }
export interface PrecacheList { readonly files: readonly PrecacheFile[]; readonly versioned: boolean }
export interface StoredAsset { readonly key: string; readonly sha256: string | null; readonly blob: Blob }
/** Persistent key-value store for downloaded files; keys are `<asset root>|<path>`. */
export interface AssetStore {
  readonly persistent: boolean;
  get(key: string): Promise<StoredAsset | undefined>;
  /** Existing keys and their stored hashes, without retaining blobs. Missing records are omitted. */
  hashes(keys: readonly string[]): Promise<Map<string, string | null>>;
  put(asset: StoredAsset): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}
export type PreloadState = 'checking' | 'downloading' | 'done' | 'partial';
export interface PreloadProgress {
  readonly state: PreloadState;
  readonly totalFiles: number; readonly readyFiles: number; readonly failedFiles: number;
  /** Bytes from precache.json; 0 when the list has no sizes (manifest fallback). */
  readonly totalBytes: number; readonly readyBytes: number;
  /** False when the browser refused IndexedDB (private window, quota): files download but are not kept. */
  readonly persistent: boolean;
  readonly versioned: boolean;
  /** Files and bytes fetched from the server during this visit (0 when everything came from the store). */
  readonly downloadedFiles: number; readonly downloadedBytes: number;
  /** Extra attempts after a failed download, size or hash check; shown so a flaky link never shrinks the set silently. */
  readonly retriedRequests: number;
  /** Milliseconds from start() to done/partial; null until then. Used to check the first-visit download time. */
  readonly elapsedMs: number | null;
}

const SHA256 = /^[0-9a-f]{64}$/;
const MAX_FILES = 20000;
/** Parallel downloads. Each request over a tunnel or distant host costs a round trip of ~0.5–1 s regardless of
 * size, so a deeper pipeline matters more than bandwidth for ~2,300 small files; 12 stays under browser per-host limits on HTTP/2. */
export const PRELOAD_CONCURRENCY = 12;
export const PRELOAD_RETRIES = 3;
/** Bound the number of blob records cloned by a warm-cache transaction; yield between batches for reads. */
export const CACHE_CHECK_BATCH_SIZE = 128;

/** Validates precache.json; anything unreadable falls back to the manifest's model and effect paths (unversioned). */
export function readPrecacheList(value: unknown, manifest: AssetManifest): PrecacheList {
  const raw = value as { schemaVersion?: unknown; files?: unknown } | null;
  if (raw && raw.schemaVersion === 1 && Array.isArray(raw.files) && raw.files.length <= MAX_FILES) {
    const seen = new Set<string>(), files: PrecacheFile[] = [];
    let valid = true;
    for (const entry of raw.files as { path?: unknown; bytes?: unknown; sha256?: unknown }[]) {
      const path = entry?.path, bytes = entry?.bytes, sha256 = entry?.sha256;
      if (typeof path !== 'string' || seen.has(path) || !Number.isSafeInteger(bytes) || (bytes as number) < 0
        || typeof sha256 !== 'string' || !SHA256.test(sha256)) { valid = false; break; }
      try { assetUrl('', path); } catch { valid = false; break; }
      seen.add(path); files.push({ path, bytes: bytes as number, sha256 });
    }
    if (valid) return { files, versioned: true };
  }
  const paths = [...Object.values(manifest.models).map(model => model.path), ...Object.values(manifest.effects ?? {}).map(effect => effect.path)];
  return { files: [...new Set(paths)].map(path => ({ path, bytes: 0, sha256: null })), versioned: false };
}

export interface PackFile { readonly path: string; readonly offset: number; readonly bytes: number; readonly sha256: string }
export interface AssetPack { readonly name: string; readonly path: string; readonly bytes: number; readonly sha256: string; readonly files: readonly PackFile[] }
const MAX_PACKS = 256;

/** Validates packs against precache. A superseded UI index is fetched separately; inconsistent model/FX entries reject packs. */
export function readPackList(value: unknown, list: PrecacheList): AssetPack[] {
  const raw = value as { schemaVersion?: unknown; packs?: unknown } | null;
  if (!list.versioned || !raw || raw.schemaVersion !== 1 || !Array.isArray(raw.packs) || raw.packs.length > MAX_PACKS) return [];
  const precache = new Map(list.files.map(file => [file.path, file]));
  const packed = new Set<string>(), packs: AssetPack[] = [];
  for (const entry of raw.packs as { name?: unknown; path?: unknown; bytes?: unknown; sha256?: unknown; files?: unknown }[]) {
    const { name, path, bytes, sha256, files } = entry ?? {};
    if (typeof name !== 'string' || typeof path !== 'string' || !Number.isSafeInteger(bytes) || typeof sha256 !== 'string'
      || !SHA256.test(sha256) || !Array.isArray(files) || precache.has(path)) return [];
    try { assetUrl('', path); } catch { return []; }
    const parts: PackFile[] = [];
    for (const file of files as { path?: unknown; offset?: unknown; bytes?: unknown; sha256?: unknown }[]) {
      const known = typeof file?.path === 'string' ? precache.get(file.path) : undefined;
      if (!known || known.sha256 === null || packed.has(known.path)
        || !Number.isSafeInteger(file.bytes) || (file.bytes as number) < 0 || typeof file.sha256 !== 'string' || !SHA256.test(file.sha256)
        || !Number.isSafeInteger(file.offset) || (file.offset as number) < 0
        || (file.offset as number) + (file.bytes as number) > (bytes as number)) return [];
      packed.add(known.path);
      if (file.bytes !== known.bytes || file.sha256 !== known.sha256) {
        // Seven-file asset deltas update ui-assets.json without rebuilding the base's packs.
        // Never expose its old packed bytes: the new index remains queued for a verified per-file read.
        if (known.path === 'ui-assets.json') continue;
        return [];
      }
      parts.push({ path: known.path, offset: file.offset as number, bytes: known.bytes, sha256: known.sha256 });
    }
    packs.push({ name, path, bytes: bytes as number, sha256, files: parts });
  }
  return packs;
}

export interface PreloaderOptions {
  fetch?: typeof fetch;
  concurrency?: number;
  /** Retries per file after the first failure. */
  retries?: number;
  /** Wait before retry n (1-based); defaults to 400 ms × n so a briefly dropped link can recover. */
  retryDelayMs?: (attempt: number) => number;
  /** sha256 hex of a blob, or null when the page cannot hash (crypto.subtle needs HTTPS or localhost). */
  digest?: (blob: Blob) => Promise<string | null>;
  /** Millisecond clock for elapsedMs; defaults to performance.now. */
  now?: () => number;
  /** Large packs from packs.json (readPackList); files they do not cover, or that fail, download one by one. */
  packs?: readonly AssetPack[];
  /** Packs downloading at once; defaults to 3. */
  packConcurrency?: number;
}

interface Job { file: PrecacheFile; promise: Promise<Blob>; resolve(blob: Blob): void; reject(error: unknown): void; started: boolean }

async function webDigest(blob: Blob): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const bytes = new Uint8Array(await subtle.digest('SHA-256', await blob.arrayBuffer()));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export class AssetPreloader {
  private readonly files = new Map<string, PrecacheFile>();
  private readonly ready = new Map<string, Blob | null>(); // null: stored, read back from the store on demand
  private readonly jobs = new Map<string, Job>();
  private readonly queue: Job[] = [];
  private readonly requestedPaths = new Set<string>();
  private readonly listeners = new Set<(progress: PreloadProgress) => void>();
  private readonly abort = new AbortController();
  private readonly fetcher: typeof fetch;
  private readonly digest: (blob: Blob) => Promise<string | null>;
  private state: PreloadState = 'checking';
  private failed = 0; private readyBytes = 0; private persistent: boolean;
  /** Files counted in `failed`; a later successful read takes them back out. */
  private readonly failedPaths = new Set<string>();
  /** True while packs download: a read then starts its own file at once instead of waiting for a pack. */
  private packing = false;
  private downloadedFiles = 0; private downloadedBytes = 0; private retried = 0; private startedAt = 0; private elapsedMs: number | null = null;
  private disposed = false;

  constructor(private readonly root: string, private readonly list: PrecacheList, private readonly store: AssetStore,
    private readonly options: PreloaderOptions = {}) {
    for (const file of list.files) this.files.set(file.path, file);
    this.fetcher = options.fetch ?? ((input, init) => fetch(input, init));
    this.digest = options.digest ?? webDigest;
    this.persistent = store.persistent;
  }

  get progress(): PreloadProgress {
    let totalBytes = 0;
    for (const file of this.files.values()) totalBytes += file.bytes;
    return { state: this.state, totalFiles: this.files.size, readyFiles: this.ready.size, failedFiles: this.failed,
      totalBytes, readyBytes: this.readyBytes, persistent: this.persistent, versioned: this.list.versioned,
      downloadedFiles: this.downloadedFiles, downloadedBytes: this.downloadedBytes, retriedRequests: this.retried,
      elapsedMs: this.elapsedMs };
  }
  onProgress(listener: (progress: PreloadProgress) => void): () => void {
    this.listeners.add(listener); listener(this.progress);
    return () => this.listeners.delete(listener);
  }
  private emit(): void { const progress = this.progress; for (const listener of this.listeners) listener(progress); }
  private key(path: string): string { return `${this.root}|${path}`; }

  /** Checks what the store already has, drops stale files of this root, then downloads the rest in the background. */
  async start(): Promise<PreloadProgress> {
    const now = this.options.now ?? (() => performance.now());
    this.startedAt = now();
    const keep = new Set([...this.files.keys()].map(path => this.key(path)));
    // A cold cache needs just this transaction, not one empty get per manifest entry.
    const keys = await this.store.keys().catch(() => null);
    if (this.disposed) return this.progress;
    const existing = keys === null ? null : new Set(keys);
    const cached = [...keep].filter(key => existing === null || existing.has(key));
    const hashes = new Map<string, string | null>();
    for (let i = 0; i < cached.length; i += CACHE_CHECK_BATCH_SIZE) {
      const batch = await this.store.hashes(cached.slice(i, i + CACHE_CHECK_BATCH_SIZE)).catch(() => new Map<string, string | null>());
      if (this.disposed) return this.progress;
      for (const [key, hash] of batch) hashes.set(key, hash);
    }
    for (const file of this.files.values()) {
      const key = this.key(file.path);
      // A foreground read may have completed while the inventory was being checked.
      if (this.ready.has(file.path)) continue;
      if (hashes.has(key) && (file.sha256 === null || hashes.get(key) === file.sha256)) this.markReady(file, null);
      else if (!this.jobs.has(file.path)) this.enqueue(file);
    }
    const prefix = `${this.root}|`;
    for (const key of keys ?? []) {
      if (key.startsWith(prefix) && !keep.has(key)) await this.store.delete(key).catch(() => undefined);
    }
    if (this.disposed) return this.progress;
    this.state = this.jobs.size ? 'downloading' : 'done';
    if (this.state === 'done') this.elapsedMs = now() - this.startedAt;
    this.emit();
    if (this.queue.length && this.options.packs?.length) {
      this.packing = true;
      await this.loadPacks(this.options.packs);
      this.packing = false;
    }
    const workers = Array.from({ length: Math.max(1, this.options.concurrency ?? PRELOAD_CONCURRENCY) }, () => this.work());
    await Promise.all(workers);
    // Foreground reads can be running independently of both the queue and packs.
    await Promise.allSettled([...this.jobs.values()].map(job => job.promise));
    if (!this.disposed) { this.state = this.failed ? 'partial' : 'done'; this.elapsedMs ??= now() - this.startedAt; this.emit(); }
    return this.progress;
  }

  /** The file's bytes: local copy, or the queued download moved to the front, or (not in the list) the network. */
  async read(path: string): Promise<Blob> {
    const file = this.files.get(path);
    if (file) {
      // Record demand before the async lookup: a fast inventory may fill/start the queue meanwhile.
      this.requestedPaths.add(path);
      const memory = this.ready.get(path);
      if (memory) return memory;
      // Also covers a read before start() has checked this file.
      const stored = await this.store.get(this.key(path)).catch(() => undefined);
      if (stored && (file.sha256 === null || stored.sha256 === file.sha256)) { this.markReady(file, null); return stored.blob; }
    }
    const job = this.jobs.get(path) ?? (file ? this.enqueue(file) : undefined);
    if (job) {
      if (!job.started) {
        this.queue.splice(this.queue.indexOf(job), 1);
        // The board needs it now: checking and packs must not block a foreground file.
        if (this.state === 'checking' || this.packing || this.state === 'done' || this.state === 'partial') void this.runJob(job);
        else this.queue.unshift(job);
      }
      try { return await job.promise; } catch { /* fall through to one plain network read */ }
    }
    return this.download(path);
  }

  dispose(): void { this.disposed = true; this.abort.abort(); this.queue.length = 0; this.listeners.clear(); }

  private enqueue(file: PrecacheFile): Job {
    let resolve!: (blob: Blob) => void, reject!: (error: unknown) => void;
    const promise = new Promise<Blob>((done, fail) => { resolve = done; reject = fail; });
    promise.catch(() => undefined);
    const job: Job = { file, promise, resolve, reject, started: false };
    this.jobs.set(file.path, job);
    if (this.requestedPaths.has(file.path)) this.queue.unshift(job); else this.queue.push(job);
    return job;
  }
  private markReady(file: PrecacheFile, blob: Blob | null): void {
    if (this.ready.has(file.path)) return;
    this.ready.set(file.path, blob); this.readyBytes += file.bytes;
  }

  private async work(): Promise<void> {
    for (let job = this.queue.shift(); job && !this.disposed; job = this.queue.shift()) await this.runJob(job);
  }
  private async runJob(job: Job): Promise<void> {
    job.started = true;
    const file = job.file;
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= (this.options.retries ?? PRELOAD_RETRIES) && !this.disposed; attempt++) {
      if (attempt > 0) {
        this.retried++; this.emit();
        await this.pause((this.options.retryDelayMs ?? (n => 400 * n))(attempt));
        if (this.disposed) break;
      }
      try {
        const blob = await this.download(file.path);
        await this.verify(file, blob);
        await this.keep(job, blob);
        this.downloadedBytes += blob.size;
        lastError = null;
        break;
      } catch (error) { lastError = error; }
    }
    if (lastError !== null || this.disposed) {
      this.jobs.delete(file.path);
      if (!this.disposed) { this.failed++; this.failedPaths.add(file.path); }
      job.reject(lastError ?? new Error('preload-disposed'));
    }
    this.emit();
  }
  private async verify(file: PrecacheFile, blob: Blob): Promise<void> {
    if (file.sha256 !== null && file.bytes !== blob.size) throw new Error(`size-mismatch:${file.path}`);
    const sha256 = file.sha256 === null ? null : await this.digest(blob);
    if (sha256 !== null && sha256 !== file.sha256) throw new Error(`hash-mismatch:${file.path}`);
  }
  /** Stores a verified file and settles its job; bytes are counted by the caller (per file, or once per pack). */
  private async keep(job: Job, blob: Blob): Promise<void> {
    let kept: Blob | null = null;
    try { await this.store.put({ key: this.key(job.file.path), sha256: job.file.sha256, blob }); }
    catch { kept = blob; this.persistent = false; }
    this.markReady(job.file, kept);
    this.downloadedFiles++;
    this.jobs.delete(job.file.path);
    // A read retried a file the background gave up on: it no longer counts as failed.
    if (this.failedPaths.delete(job.file.path)) {
      this.failed--;
      if (this.state === 'partial' && this.failed === 0) this.state = 'done';
    }
    job.resolve(blob);
  }
  /** Downloads the packs that still hold queued files, a few at a time; whatever a pack cannot deliver stays queued. */
  private async loadPacks(packs: readonly AssetPack[]): Promise<void> {
    const pending = packs.filter(pack => pack.files.some(part => this.jobs.get(part.path)?.started === false));
    const next = async (): Promise<void> => {
      for (let pack = pending.shift(); pack && !this.disposed; pack = pending.shift()) await this.loadPack(pack);
    };
    await Promise.all(Array.from({ length: Math.max(1, this.options.packConcurrency ?? 3) }, next));
  }
  private async loadPack(pack: AssetPack): Promise<void> {
    let blob: Blob | null = null;
    for (let attempt = 0; attempt <= (this.options.retries ?? PRELOAD_RETRIES) && !this.disposed && !blob; attempt++) {
      if (attempt > 0) {
        this.retried++; this.emit();
        await this.pause((this.options.retryDelayMs ?? (n => 400 * n))(attempt));
        if (this.disposed) return;
      }
      try {
        const body = await this.download(pack.path);
        if (body.size !== pack.bytes) throw new Error(`pack-size-mismatch:${pack.name}`);
        const sha256 = await this.digest(body);
        if (sha256 !== null && sha256 !== pack.sha256) throw new Error(`pack-hash-mismatch:${pack.name}`);
        blob = body;
      } catch { /* retry; after the budget its files stay on the per-file queue */ }
    }
    if (!blob || this.disposed) return;
    this.downloadedBytes += blob.size;
    for (const part of pack.files) {
      const job = this.jobs.get(part.path);
      if (!job || job.started || this.disposed) continue;
      job.started = true;
      this.queue.splice(this.queue.indexOf(job), 1);
      const slice = blob.slice(part.offset, part.offset + part.bytes);
      try { await this.verify(job.file, slice); await this.keep(job, slice); }
      catch { job.started = false; this.queue.push(job); }
    }
    this.emit();
  }
  private pause(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise(done => {
      const timer = setTimeout(done, ms);
      this.abort.signal.addEventListener('abort', () => { clearTimeout(timer); done(); }, { once: true });
    });
  }
  private async download(path: string): Promise<Blob> {
    const response = await this.fetcher(assetUrl(this.root, path), { signal: this.abort.signal });
    if (!response.ok) throw new Error(`asset-http-${response.status}`);
    return response.blob();
  }
}

/** One IndexedDB database for every asset root. Throws when IndexedDB is unavailable. */
export function openIndexedDbStore(name = 'cat-assets3d'): Promise<AssetStore> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('indexeddb-unavailable')); return; }
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('files', { keyPath: 'key' }); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('indexeddb-blocked'));
    request.onsuccess = () => {
      const db = request.result;
      const run = <T>(mode: IDBTransactionMode, body: (files: IDBObjectStore) => IDBRequest<T>) => new Promise<T>((done, fail) => {
        const transaction = db.transaction('files', mode), call = body(transaction.objectStore('files'));
        transaction.oncomplete = () => done(call.result);
        transaction.onerror = () => fail(transaction.error ?? call.error);
        transaction.onabort = () => fail(transaction.error ?? new Error('indexeddb-abort'));
      });
      resolve({
        persistent: true,
        get: key => run('readonly', files => files.get(key) as IDBRequest<StoredAsset | undefined>),
        hashes: keys => new Promise((done, fail) => {
          const hashes = new Map<string, string | null>();
          if (!keys.length) { done(hashes); return; }
          const transaction = db.transaction('files', 'readonly'), files = transaction.objectStore('files');
          // Queue synchronously in ONE transaction. Keep only hashes, not the cloned Blob handles.
          for (const key of keys) {
            const call = files.get(key) as IDBRequest<StoredAsset | undefined>;
            call.onsuccess = () => { if (call.result) hashes.set(key, call.result.sha256); };
          }
          transaction.oncomplete = () => done(hashes);
          transaction.onerror = () => fail(transaction.error);
          transaction.onabort = () => fail(transaction.error ?? new Error('indexeddb-abort'));
        }),
        put: async asset => { await run('readwrite', files => files.put(asset)); },
        delete: async key => { await run('readwrite', files => files.delete(key)); },
        keys: async () => (await run('readonly', files => files.getAllKeys())).map(String),
      });
    };
  });
}

/** IndexedDB when the browser allows it, otherwise a non-persistent store (files still download, every visit). */
export function openAssetStore(open: () => Promise<AssetStore> = openIndexedDbStore): Promise<AssetStore> {
  return open().catch(() => memoryStore());
}

/** Keeps nothing: used when IndexedDB is unavailable, so every read goes to the network. */
export function memoryStore(): AssetStore {
  const files = new Map<string, StoredAsset>();
  return {
    persistent: false,
    get: async key => files.get(key),
    hashes: async keys => new Map(keys.filter(key => files.has(key)).map(key => [key, files.get(key)!.sha256])),
    put: async asset => { files.set(asset.key, asset); },
    delete: async key => { files.delete(key); },
    keys: async () => [...files.keys()],
  };
}

/** Human-readable one-liner for the 3D bar. */
export function describePreload(progress: PreloadProgress): string {
  const mb = (bytes: number) => (bytes / 1048576).toFixed(bytes >= 10 * 1048576 ? 0 : 1);
  const counted = progress.totalBytes > 0
    ? `${mb(progress.readyBytes)}/${mb(progress.totalBytes)} MB（${Math.floor(progress.readyBytes * 100 / progress.totalBytes)}%）`
    : `${progress.readyFiles}/${progress.totalFiles} 个文件`;
  const keep = progress.persistent ? '' : '，浏览器不允许本地保存，下次需重下';
  // Trouble is visible while it happens, not only at the end.
  const trouble = (progress.retriedRequests > 0 ? `，已重试 ${progress.retriedRequests} 次` : '')
    + (progress.failedFiles > 0 ? `，${progress.failedFiles} 个失败` : '');
  // First visit: how much came over the network and how long it took; a later visit reads everything locally.
  const timing = progress.elapsedMs === null ? ''
    : progress.downloadedFiles > 0 ? `，本次下载 ${mb(progress.downloadedBytes)} MB 用时 ${(progress.elapsedMs / 1000).toFixed(1)} 秒`
    : '，全部来自本地';
  switch (progress.state) {
    case 'checking': return '检查本地素材缓存…';
    case 'downloading': return `素材预下载 ${counted}${trouble}${keep}`;
    case 'done': return `素材已全部${progress.persistent ? '缓存到本地' : '下载'}（${progress.totalFiles} 个文件${timing}`
      + `${progress.retriedRequests > 0 ? `，其间重试 ${progress.retriedRequests} 次` : ''}）`;
    case 'partial': return `素材预下载完成，${progress.failedFiles} 个文件失败（重试 ${progress.retriedRequests} 次后仍失败，用到时再从网络读）${timing}${keep}`;
  }
}
