import type { BattleRecord, CapturedSave, SaveEnvelope, SlotToken } from '../m6/contracts';
import { MAX_COMPLETED_RUNS } from '../m6/limits';
import { fixedCapture } from './capture-ownership';
import { canonicalContent } from '../simulation/content';

export type SaveFailureReason = 'quota' | 'abort' | 'conflict' | 'unavailable' | 'validation';
export class SaveError extends Error {
  constructor(readonly reason: SaveFailureReason, message: string) { super(message); this.name = 'SaveError'; }
}
export function saveError(error: unknown): SaveError {
  if (error instanceof SaveError) return error;
  const name = error instanceof DOMException ? error.name : '';
  return new SaveError(name === 'QuotaExceededError' ? 'quota' : name === 'AbortError' ? 'abort' : 'unavailable', error instanceof Error ? error.message : String(error));
}
export interface CompletedRun { readonly runId: string; readonly completedAt: string }
interface StoredRun {
  runId: string; createdAt: string; match: SaveEnvelope['match']; currentBattle: BattleRecord | null; battleKeys: readonly string[];
}
const STORES = ['metadata', 'runs', 'battles'];
const equal = (a: SlotToken | undefined, b: SlotToken | null) => b === null ? a === undefined : a !== undefined && a.runId === b.runId && a.activationEpoch === b.activationEpoch && a.revision === b.revision;
function request<T>(r: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(saveError(r.error)); }); }
function completion(tx: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(saveError(tx.error ?? new DOMException('保存事务已取消', 'AbortError'))); }); }

/** Single current slot. Every writer, including activation, uses a transaction-local CAS. */
export class SaveRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private closed = false;
  constructor(private readonly name = 'hex-autobattler-m6') {}
  private db(): Promise<IDBDatabase> {
    if (this.closed) return Promise.reject(new SaveError('unavailable', '存储已关闭'));
    return this.dbPromise ??= new Promise((resolve, reject) => {
      try {
        const open = indexedDB.open(this.name, 1);
        open.onupgradeneeded = () => { for (const store of STORES) open.result.createObjectStore(store); };
        open.onerror = () => reject(saveError(open.error));
        open.onblocked = () => reject(new SaveError('unavailable', '请关闭旧版本页面后重试'));
        open.onsuccess = () => {
          const db = open.result;
          if (this.closed) { db.close(); reject(new SaveError('unavailable', '存储已关闭')); return; }
          db.onversionchange = () => { this.closed = true; db.close(); };
          resolve(db);
        };
      } catch (error) { reject(saveError(error)); }
    });
  }
  private materialize(tx: IDBTransaction, run: StoredRun): Promise<SaveEnvelope> {
    const reads = run.battleKeys.map(key => request(tx.objectStore('battles').get([run.runId, key])) as Promise<BattleRecord | undefined>);
    return Promise.all(reads).then(battles => {
      if (battles.some(b => !b)) throw new SaveError('validation', '存档缺少战斗档案');
      return { kind: 'hex-autobattler-save', saveFormatVersion: 1, replayFormatVersion: 1, runId: run.runId, createdAt: run.createdAt, match: run.match, currentBattle: run.currentBattle, battles: battles as BattleRecord[] };
    });
  }
  async readCurrent(): Promise<{ token: SlotToken; envelope: SaveEnvelope } | null> {
    const tx = (await this.db()).transaction(STORES, 'readonly');
    const done = completion(tx);
    try {
      const token = await request(tx.objectStore('metadata').get('current')) as SlotToken | undefined;
      if (!token) { await done; return null; }
      const run = await request(tx.objectStore('runs').get(token.runId)) as StoredRun | undefined;
      if (!run) throw new SaveError('validation', '存档缺少当前对局');
      const envelope = await this.materialize(tx, run); await done; return { token, envelope };
    } catch (error) { await done.catch(() => undefined); throw saveError(error); }
  }
  async listCompleted(): Promise<readonly CompletedRun[]> {
    const tx = (await this.db()).transaction('metadata', 'readonly'); const done = completion(tx);
    try {
      const rows = await request(tx.objectStore('metadata').get('completed')) as CompletedRun[] | undefined;
      await done; return rows ?? [];
    } catch (error) { await done.catch(() => undefined); throw saveError(error); }
  }
  async readCompleted(runId: string): Promise<SaveEnvelope> {
    const tx = (await this.db()).transaction(STORES, 'readonly'); const done = completion(tx);
    try {
      const rows = await request(tx.objectStore('metadata').get('completed')) as CompletedRun[] | undefined;
      if (!rows?.some(row => row.runId === runId)) throw new SaveError('validation', '找不到已完成对局');
      const run = await request(tx.objectStore('runs').get(runId)) as StoredRun | undefined;
      if (!run) throw new SaveError('validation', '档案已丢失');
      const envelope = await this.materialize(tx, run); await done; return envelope;
    } catch (error) { await done.catch(() => undefined); throw saveError(error); }
  }
  /** Caller must validate imports before this method, outside the IDB transaction. */
  async activate(expected: SlotToken | null, candidate: SaveEnvelope): Promise<SlotToken> {
    const fixed = structuredClone(candidate);
    const token = { runId: fixed.runId, activationEpoch: crypto.randomUUID(), revision: (expected?.revision ?? 0) + 1 };
    const run: StoredRun = { runId: fixed.runId, createdAt: fixed.createdAt, match: fixed.match, currentBattle: fixed.currentBattle, battleKeys: fixed.battles.map(b => b.combatId) };
    return this.write(expected, token, run, fixed.battles, true);
  }
  async commit(expected: SlotToken, snapshot: CapturedSave): Promise<SlotToken> {
    // Coordinator already owns a fixed snapshot; direct callers get the same protection.
    const fixed = fixedCapture(snapshot);
    const run: StoredRun = { runId: expected.runId, createdAt: '', match: fixed.match, currentBattle: fixed.currentBattle, battleKeys: fixed.battleKeys };
    return this.write(expected, { ...expected, revision: expected.revision + 1 }, run, fixed.addedBattles, false);
  }
  private async write(expected: SlotToken | null, token: SlotToken, run: StoredRun, added: readonly BattleRecord[], activation: boolean): Promise<SlotToken> {
    expected = expected === null ? null : { ...expected };
    if (!Number.isSafeInteger(token.revision)) throw new SaveError('validation', '保存修订号超限');
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES, 'readwrite');
      let failure: SaveError | null = null;
      const abort = (reason: SaveFailureReason, message: string) => { failure = new SaveError(reason, message); tx.abort(); };
      const guarded = (callback: () => void) => () => { try { callback(); } catch (error) { failure = saveError(error); try { tx.abort(); } catch { /* Already aborted. */ } } };
      tx.oncomplete = () => resolve(token);
      tx.onabort = () => reject(failure ?? saveError(tx.error ?? new DOMException('保存事务已取消', 'AbortError')));
      const meta = tx.objectStore('metadata'), runs = tx.objectStore('runs'), battles = tx.objectStore('battles');
      const current = meta.get('current');
      current.onsuccess = guarded(() => {
        if (!equal(current.result, expected)) { abort('conflict', '另一页面已修改存档，自动保存已停止；仍可导出当前局'); return; }
        const allRuns = runs.getAll();
        allRuns.onsuccess = guarded(() => {
          const stored = allRuns.result as StoredRun[];
          const prior = stored.find(value => value.runId === run.runId);
          if (!activation && !prior) { abort('validation', '当前对局存储已丢失'); return; }
          if (!activation) run.createdAt = prior!.createdAt;
          const known = new Set(activation ? [] : prior!.battleKeys);
          const incoming = new Set(added.map(b => b.combatId));
          if (incoming.size !== added.length || new Set(run.battleKeys).size !== run.battleKeys.length || added.some(b => b.runId !== run.runId || !run.battleKeys.includes(b.combatId)) || run.battleKeys.some(key => !known.has(key) && !incoming.has(key)) || (!activation && prior!.battleKeys.some(key => !run.battleKeys.includes(key)))) {
            abort('validation', '战斗档案引用不一致'); return;
          }
          if (activation && prior) for (const key of prior.battleKeys) battles.delete([run.runId, key]);
          for (const battle of added) {
            if (!known.has(battle.combatId)) battles.add(battle, [run.runId, battle.combatId]);
            else {
              const existing = battles.get([run.runId, battle.combatId]);
              existing.onsuccess = guarded(() => {
                if (!existing.result || canonicalContent(existing.result) !== canonicalContent(battle)) abort('validation', '已完成战斗档案不能改写');
              });
            }
          }
          const completed = meta.get('completed');
          completed.onsuccess = guarded(() => {
            let rows = (completed.result ?? []) as CompletedRun[];
            // An explicit same-run import can rewind a completed run; no stale archive refs.
            if (activation) rows = rows.filter(row => row.runId !== run.runId);
            if (run.match.phase === 'gameOver' && !rows.some(row => row.runId === run.runId)) rows = [...rows, { runId: run.runId, completedAt: new Date().toISOString() }];
            rows = rows.slice(-MAX_COMPLETED_RUNS);
            const keep = new Set([...rows.map(row => row.runId), run.runId]);
            for (const old of stored) if (!keep.has(old.runId)) {
              runs.delete(old.runId); for (const key of old.battleKeys) battles.delete([old.runId, key]);
            }
            runs.put(run, run.runId); meta.put(token, 'current'); meta.put(rows, 'completed');
          });
        });
      });
    });
  }
  close(): void { this.closed = true; void this.dbPromise?.then(db => db.close(), () => undefined); }
}
