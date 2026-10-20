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
 */
import { assetUrl, type AssetManifest } from '../../rendering3d';

export interface PrecacheFile { readonly path: string; readonly bytes: number; readonly sha256: string | null }
export interface PrecacheList { readonly files: readonly PrecacheFile[]; readonly versioned: boolean }
export interface StoredAsset { readonly key: string; readonly sha256: string | null; readonly blob: Blob }
/** Persistent key-value store for downloaded files; keys are `<asset root>|<path>`. */
export interface AssetStore {
  readonly persistent: boolean;
  get(key: string): Promise<StoredAsset | undefined>;
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
}

const SHA256 = /^[0-9a-f]{64}$/;
const MAX_FILES = 20000;

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

export interface PreloaderOptions {
  fetch?: typeof fetch;
  concurrency?: number;
  /** Retries per file after the first failure. */
  retries?: number;
  /** sha256 hex of a blob, or null when the page cannot hash (crypto.subtle needs HTTPS or localhost). */
  digest?: (blob: Blob) => Promise<string | null>;
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
  private readonly listeners = new Set<(progress: PreloadProgress) => void>();
  private readonly abort = new AbortController();
  private readonly fetcher: typeof fetch;
  private readonly digest: (blob: Blob) => Promise<string | null>;
  private state: PreloadState = 'checking';
  private failed = 0; private readyBytes = 0; private persistent: boolean;
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
      totalBytes, readyBytes: this.readyBytes, persistent: this.persistent, versioned: this.list.versioned };
  }
  onProgress(listener: (progress: PreloadProgress) => void): () => void {
    this.listeners.add(listener); listener(this.progress);
    return () => this.listeners.delete(listener);
  }
  private emit(): void { const progress = this.progress; for (const listener of this.listeners) listener(progress); }
  private key(path: string): string { return `${this.root}|${path}`; }

  /** Checks what the store already has, drops stale files of this root, then downloads the rest in the background. */
  async start(): Promise<PreloadProgress> {
    const keep = new Set<string>();
    for (const file of this.files.values()) {
      const key = this.key(file.path);
      keep.add(key);
      const stored = await this.store.get(key).catch(() => undefined);
      if (this.disposed) return this.progress;
      if (stored && (file.sha256 === null || stored.sha256 === file.sha256)) this.markReady(file, null);
      else if (!this.jobs.has(file.path)) this.enqueue(file);
    }
    const prefix = `${this.root}|`;
    for (const key of await this.store.keys().catch(() => [] as string[])) {
      if (key.startsWith(prefix) && !keep.has(key)) await this.store.delete(key).catch(() => undefined);
    }
    if (this.disposed) return this.progress;
    this.state = this.queue.length ? 'downloading' : 'done';
    this.emit();
    const workers = Array.from({ length: Math.max(1, this.options.concurrency ?? 4) }, () => this.work());
    await Promise.all(workers);
    if (!this.disposed) { this.state = this.failed ? 'partial' : 'done'; this.emit(); }
    return this.progress;
  }

  /** The file's bytes: local copy, or the queued download moved to the front, or (not in the list) the network. */
  async read(path: string): Promise<Blob> {
    const file = this.files.get(path);
    if (file) {
      const memory = this.ready.get(path);
      if (memory) return memory;
      // Also covers a read before start() has checked this file.
      const stored = await this.store.get(this.key(path)).catch(() => undefined);
      if (stored && (file.sha256 === null || stored.sha256 === file.sha256)) { this.markReady(file, null); return stored.blob; }
    }
    const job = this.jobs.get(path) ?? (file ? this.enqueue(file) : undefined);
    if (job) {
      if (!job.started) { this.queue.splice(this.queue.indexOf(job), 1); this.queue.unshift(job); }
      if (this.state === 'done' || this.state === 'partial') void this.work();
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
    this.jobs.set(file.path, job); this.queue.push(job);
    return job;
  }
  private markReady(file: PrecacheFile, blob: Blob | null): void {
    if (this.ready.has(file.path)) return;
    this.ready.set(file.path, blob); this.readyBytes += file.bytes;
  }

  private async work(): Promise<void> {
    for (let job = this.queue.shift(); job && !this.disposed; job = this.queue.shift()) {
      job.started = true;
      const file = job.file;
      let lastError: unknown = null;
      for (let attempt = 0; attempt <= (this.options.retries ?? 2) && !this.disposed; attempt++) {
        try {
          const blob = await this.download(file.path);
          if (file.sha256 !== null && file.bytes !== blob.size) throw new Error(`size-mismatch:${file.path}`);
          const sha256 = file.sha256 === null ? null : await this.digest(blob);
          if (sha256 !== null && sha256 !== file.sha256) throw new Error(`hash-mismatch:${file.path}`);
          let kept: Blob | null = null;
          try { await this.store.put({ key: this.key(file.path), sha256: file.sha256, blob }); }
          catch { kept = blob; this.persistent = false; }
          this.markReady(file, kept);
          this.jobs.delete(file.path);
          job.resolve(blob);
          lastError = null;
          break;
        } catch (error) { lastError = error; }
      }
      if (lastError !== null || this.disposed) {
        this.jobs.delete(file.path);
        if (!this.disposed) this.failed++;
        job.reject(lastError ?? new Error('preload-disposed'));
      }
      this.emit();
    }
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
  switch (progress.state) {
    case 'checking': return '检查本地素材缓存…';
    case 'downloading': return `素材预下载 ${counted}${keep}`;
    case 'done': return `素材已全部${progress.persistent ? '缓存到本地' : '下载'}（${progress.totalFiles} 个文件）`;
    case 'partial': return `素材预下载完成，${progress.failedFiles} 个文件失败（用到时再从网络读）${keep}`;
  }
}
