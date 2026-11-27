/**
 * The animation envelope each model was measured at (model-fit.ts: reach, feet, idle foot support), kept in this
 * browser so a later visit fits a model the moment it loads, even one first seen in the middle of a combat, without
 * measuring it again (playtest 11-25: a model first loaded during a combat stood up to 0.4 cell off its cell).
 *
 * Display only, measured by this browser itself from the files it loaded: nothing is shipped with the game or the asset
 * root. Keys are the model id, its file's sha256 (precache.json) and ENVELOPE_VERSION, so a new model file or a changed
 * measurement is a miss and is measured again. Every read and write may fail (no IndexedDB, private window, quota,
 * a blocked or corrupt store): the store then holds nothing and the renderer measures as before.
 */
import { ENVELOPE_VERSION, type Envelope } from './model-fit';

/** The stored values, by key; get resolves undefined for a key it does not have. */
export interface EnvelopeBackend {
  getMany(keys: readonly string[]): Promise<readonly unknown[]>;
  put(key: string, value: unknown): Promise<void>;
}

export interface EnvelopeStore {
  /** Stored envelopes for these models (id → its file's sha256), by model id; missing, stale or unreadable ones are left out. */
  load(models: ReadonlyMap<string, string>): Promise<Map<string, Envelope>>;
  /** Keeps one; never throws and never waits for the write. */
  keep(id: string, sha256: string, envelope: Envelope): void;
}

export const envelopeKey = (id: string, sha256: string): string => `${id}|${sha256}|v${ENVELOPE_VERSION}`;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const nullableFinite = (value: unknown): boolean => value === null || value === undefined || finite(value);
const point = (value: unknown): boolean => Array.isArray(value) && value.length === 3 && value.every(finite);
/** A stored value is used only when it still has an envelope's shape (a store written by other code is ignored). */
export function readStoredEnvelope(value: unknown): Envelope | undefined {
  const raw = value as Partial<Envelope> | null;
  if (!raw || typeof raw !== 'object' || !finite(raw.radius) || !nullableFinite(raw.ground) || !nullableFinite(raw.feet)) return undefined;
  const support = raw.support;
  if (support !== undefined && (!support || typeof support !== 'object' || !point(support.center) || !point(support.normal)
    || !finite(support.floor) || !finite(support.meshFloor) || !finite(support.height)
    || !Array.isArray(support.contacts) || !Array.isArray(support.meshContacts))) return undefined;
  return raw as Envelope;
}

export function createEnvelopeStore(backend: EnvelopeBackend | null): EnvelopeStore {
  let broken = !backend;
  return {
    async load(models) {
      const found = new Map<string, Envelope>();
      if (broken || !models.size) return found;
      const ids = [...models.keys()];
      try {
        const values = await backend!.getMany(ids.map(id => envelopeKey(id, models.get(id)!)));
        ids.forEach((id, index) => { const envelope = readStoredEnvelope(values[index]); if (envelope) found.set(id, envelope); });
      } catch { broken = true; }
      return found;
    },
    keep(id, sha256, envelope) {
      if (broken) return;
      try { void backend!.put(envelopeKey(id, sha256), envelope).catch(() => { broken = true; }); } catch { broken = true; }
    },
  };
}

const DATABASE = 'set13-model-envelopes', STORE = 'envelopes';
const done = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
/** IndexedDB (structured clone keeps the support's Infinity fields, which JSON would not). */
function openIndexedDbBackend(): Promise<EnvelopeBackend> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('indexeddb-unavailable')); return; }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onblocked = () => reject(new Error('indexeddb-blocked'));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      resolve({
        async getMany(keys) {
          const store = db.transaction(STORE, 'readonly').objectStore(STORE);
          return Promise.all(keys.map(key => done(store.get(key))));
        },
        async put(key, value) {
          const transaction = db.transaction(STORE, 'readwrite');
          transaction.objectStore(STORE).put(value, key);
          await new Promise<void>((resolveWrite, rejectWrite) => {
            transaction.oncomplete = () => resolveWrite(); transaction.onerror = () => rejectWrite(transaction.error); transaction.onabort = () => rejectWrite(transaction.error);
          });
        },
      });
    };
  });
}

/** This browser's store, or one that keeps nothing when it cannot be opened. */
export async function openEnvelopeStore(open: () => Promise<EnvelopeBackend> = openIndexedDbBackend): Promise<EnvelopeStore> {
  try { return createEnvelopeStore(await open()); } catch { return createEnvelopeStore(null); }
}
