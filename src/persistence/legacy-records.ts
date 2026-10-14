import type { LegacyExportRequest, LegacyExportResult, LegacyListResult, LegacyRecord, LegacyRecordAccess, LegacyRecordRef } from '../simulation/m8/ui-contracts';
import { digestContent } from '../simulation/content';

/** D2-A (M8_RULES §10): the M7 library is recognized, preserved and exported as-is, never migrated,
 * relabelled or opened by the M8 engine. M8 writes only to its own namespace. */
export const LEGACY_NAMESPACE = 'hex-autobattler-m6' as const;
export const LEGACY_M8_NAMESPACE = 'hex-autobattler-m8' as const;
export const M8_NAMESPACE = 'hex-autobattler-s13-rules-gap-v1' as const;
type LegacyNamespace=typeof LEGACY_NAMESPACE|typeof LEGACY_M8_NAMESPACE;
const STORES = ['metadata', 'runs', 'battles'] as const;

interface LegacyToken { readonly runId: string; readonly revision: number }
interface LegacyRun { readonly runId: string; readonly createdAt: string; readonly match: unknown; readonly currentBattle: unknown; readonly battleKeys: readonly string[] }
interface LegacyEntry { readonly record: LegacyRecord; readonly envelope: Record<string, unknown> | null }
class LegacyReadError extends Error { constructor(readonly reason: 'unavailable' | 'read-failed') { super(reason); } }

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(new LegacyReadError('read-failed')); });
}
/** Opens the existing legacy database without ever creating or upgrading it; null when it does not exist. */
function openLegacy(namespace:LegacyNamespace): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    let missing = false;
    let open: IDBOpenDBRequest;
    try { open = indexedDB.open(namespace); } catch { reject(new LegacyReadError('unavailable')); return; }
    open.onupgradeneeded = event => {
      // oldVersion 0: the library does not exist. Abort the implicit creation so nothing is written.
      if (event.oldVersion === 0) { missing = true; open.transaction?.abort(); }
    };
    open.onerror = event => { if (missing) { event.preventDefault(); resolve(null); } else reject(new LegacyReadError('unavailable')); };
    open.onblocked = () => reject(new LegacyReadError('unavailable'));
    open.onsuccess = () => {
      const db = open.result;
      db.onversionchange = () => db.close();
      if (STORES.some(store => !db.objectStoreNames.contains(store))) { db.close(); reject(new LegacyReadError('read-failed')); return; }
      resolve(db);
    };
  });
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
/** The original v1 materialize, byte-for-byte field order: format1 wrapper around the stored run and its battles. */
function materialize(run: LegacyRun, battles: readonly unknown[],format:1|2): Record<string, unknown> {
  return { kind: 'hex-autobattler-save', saveFormatVersion: format, replayFormatVersion: format, runId: run.runId, createdAt: run.createdAt, match: run.match, currentBattle: run.currentBattle, battles };
}
async function readEntries(db: IDBDatabase,namespace:LegacyNamespace): Promise<LegacyEntry[]> {
  const tx = db.transaction([...STORES], 'readonly');
  const done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(new LegacyReadError('read-failed')); });
  const meta = tx.objectStore('metadata'), runs = tx.objectStore('runs'), battles = tx.objectStore('battles');
  const token = await request(meta.get('current')) as LegacyToken | undefined;
  const completed = (await request(meta.get('completed')) ?? []) as readonly { readonly runId: string }[];
  const ids: { runId: string; location: 'active' | 'history' }[] = [];
  if (object(token) && typeof token.runId === 'string') ids.push({ runId: token.runId, location: 'active' });
  for (const row of Array.isArray(completed) ? completed : []) if (object(row) && typeof row.runId === 'string' && !ids.some(id => id.runId === row.runId)) ids.push({ runId: row.runId, location: 'history' });
  const entries: LegacyEntry[] = [];
  for (const { runId, location } of ids) {
    const run = await request(runs.get(runId)) as LegacyRun | undefined;
    const base = { location, activeSlotRevision: location === 'active' && Number.isSafeInteger(token?.revision) ? token!.revision : null,
      ...(namespace===LEGACY_NAMESPACE?{rulesVersion:'m5-14.24b-v1',schemaVersion:5,saveFormatVersion:1,replayFormatVersion:1} as const
        :{rulesVersion:'m8-14.24b-v1',schemaVersion:6,saveFormatVersion:2,replayFormatVersion:2} as const)};
    if (!object(run) || !Array.isArray(run.battleKeys) || typeof run.createdAt !== 'string') {
      entries.push({ envelope: null, record: { ...base, recordRef: { namespace, runId, fingerprint: '' }, createdAt: '', canExportOriginal: false, reason: 'invalid-record' } });
      continue;
    }
    const stored = await Promise.all(run.battleKeys.map(key => request(battles.get([runId, key]))));
    const envelope = materialize(run, stored,base.saveFormatVersion);
    const match = object(run.match) ? run.match : null;
    const legacyHeader = match !== null && match.schemaVersion === base.schemaVersion && match.rulesVersion === base.rulesVersion;
    let fingerprint = '';
    try { fingerprint = digestContent(envelope); } catch { fingerprint = ''; }
    const reason = stored.some(value => value === undefined) ? 'missing-history' as const : !legacyHeader || !fingerprint ? 'invalid-record' as const : null;
    entries.push({ envelope: reason ? null : envelope, record: { ...base, recordRef: { namespace, runId, fingerprint }, createdAt: run.createdAt, canExportOriginal: reason === null, reason } });
  }
  await done;
  return entries;
}
async function withLegacy<T>(read: (entries: readonly LegacyEntry[]) => T, empty: () => T,namespace:LegacyNamespace): Promise<T> {
  const db = await openLegacy(namespace);
  if (!db) return empty();
  try { return read(await readEntries(db,namespace)); } finally { db.close(); }
}
const failure = (error: unknown): 'unavailable' | 'read-failed' => error instanceof LegacyReadError ? error.reason : 'read-failed';
const validRef = (ref: unknown): ref is LegacyRecordRef => object(ref) && (ref.namespace === LEGACY_NAMESPACE||ref.namespace===LEGACY_M8_NAMESPACE)
  && typeof ref.runId === 'string' && typeof ref.fingerprint === 'string' && Object.keys(ref).length === 3;

/** B9 storage service for the U7 legacy list/export (M8_UI_CONTRACT §6 A13). Read-only. */
export const legacyRecords: LegacyRecordAccess = {
  async listLegacyRecords(): Promise<LegacyListResult> {
    const records:LegacyRecord[]=[];
    for(const namespace of [LEGACY_NAMESPACE,LEGACY_M8_NAMESPACE]) {
      try { records.push(...await withLegacy(entries=>entries.map(entry=>entry.record),()=>[],namespace)); }
      catch(error){return {ok:false,namespace,reason:failure(error)};}
    }
    return {ok:true,records};
  },
  async exportLegacy(input: LegacyExportRequest): Promise<LegacyExportResult> {
    const request = { requestId: input.requestId, recordRef: input.recordRef };
    if (typeof input.requestId !== 'string' || !validRef(input.recordRef)) return { ...request, ok: false, reason: 'not-found' };
    try {
      return await withLegacy<LegacyExportResult>(entries => {
        const entry = entries.find(item => item.record.recordRef.runId === input.recordRef.runId);
        if (!entry) return { ...request, ok: false, reason: 'not-found' };
        if (entry.record.reason) return { ...request, ok: false, reason: entry.record.reason };
        if (entry.record.recordRef.fingerprint !== input.recordRef.fingerprint) return { ...request, ok: false, reason: 'stale-reference' };
        const match = entry.envelope!.match as { seed?: unknown };
        const bytes = new TextEncoder().encode(JSON.stringify(entry.envelope));
        return { ...request, ok: true, fileName: `hex-${typeof match.seed === 'number' ? match.seed : 'legacy'}-${input.recordRef.runId}.json`, mediaType: 'application/json', bytes };
      }, () => ({ ...request, ok: false, reason: 'not-found' }),input.recordRef.namespace);
    } catch (error) { return { ...request, ok: false, reason: failure(error) }; }
  },
};
