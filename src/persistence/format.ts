import type { BattleRecord, SaveEnvelope } from '../m6/contracts';
import { deepFreeze, isOwnedBattleRecord, validateBattleCollection } from '../replay/history';
import { isImmutableJson } from '../simulation/immutable-json';
import type { CompatibilityView } from '../simulation/m8/ui-contracts';
import { MAX_SAVE_BYTES } from '../m6/limits';
import { SaveError } from './repository';
import { rejectedView, routeSaveFile, type RejectedReason } from './compatibility';

export type ValidateHistory = (envelope: SaveEnvelope) => void | Promise<void>;
function reject(message: string): never { throw new SaveError('validation', `存档无效：${message}`); }
const MESSAGES: Record<RejectedReason | 'new-match-required', string> = {
  'unsupported-version': '不支持的文件版本', 'digest-mismatch': '内容摘要与当前版本不一致', 'invalid-data': '文件数据损坏或校验未通过',
  'capacity-exceeded': '战斗档案数量超限', 'new-match-required': '旧版（M7/M8）对局只能原样保全导出，请开始新局',
};
/** A routed rejection keeps its CompatibilityView so the UI can explain it without re-deriving it. */
export class CompatibilityError extends SaveError {
  constructor(readonly view: CompatibilityView, detail?: string) { super('validation', `存档无效：${detail ?? MESSAGES[view.reason ?? 'invalid-data']}`); this.name = 'CompatibilityError'; }
}
/** Version routing (compatibility.ts) precedes all domain/history reconstruction. Does not mutate input. */
export async function validateEnvelope(input: unknown, validateHistory: ValidateHistory): Promise<SaveEnvelope> {
  const routed = routeSaveFile(input);
  if (routed.view) throw new CompatibilityError(routed.view, routed.detail);
  try {
    await validateBattleCollection(routed.envelope);
    if (validateHistory !== validateBattleCollection) await validateHistory(routed.envelope);
    return routed.envelope;
  }
  catch (error) {
    if (error instanceof SaveError && error.reason === 'validation') throw error;
    throw new CompatibilityError(rejectedView('invalid-data', routed.envelope.match.rulesVersion), error instanceof Error ? error.message : String(error));
  }
}
export async function validateFile(file: Blob, validateHistory: ValidateHistory): Promise<SaveEnvelope> {
  if (file.size > MAX_SAVE_BYTES) reject('文件体积超限');
  let parsed: unknown;
  try { parsed = JSON.parse(await file.text()); } catch { reject('文件不是有效 JSON'); }
  const envelope = await validateEnvelope(parsed, validateHistory);
  // File parsing owns these graphs. Certify immutable archives once after every
  // authority/replay check; activation need not detach the same packets again.
  // Object-input validateEnvelope deliberately keeps its caller's data mutable.
  for (const record of [...envelope.battles,...(envelope.currentBattle?[envelope.currentBattle]:[])]) {
    deepFreeze(record); isImmutableJson(record);
  }
  return envelope;
}
// Owned records are detached, deeply frozen JSON data. Cache a whole archive's
// encoded bytes: many separate Blob encodings make the first full export slower.
// Weak keys release bytes with the history; keep a detached membership snapshot.
const archiveFiles = new WeakMap<BattleRecord, {records:readonly BattleRecord[];file:Blob}>();
function archiveBytes(text: string): Blob {
  // encodeInto writes UTF-8 once; Blob(string) otherwise scans/encodes again.
  // Keep the original path for very large files to bound the scratch buffer.
  if (text.length > MAX_SAVE_BYTES / 4) return new Blob([text]);
  const bytes = new Uint8Array(text.length * 3);
  const { written } = new TextEncoder().encodeInto(text, bytes);
  return new Blob([bytes.subarray(0,written)]);
}
function archiveFile(records: readonly BattleRecord[]): Blob {
  const previous = archiveFiles.get(records[0]);
  const prefix = previous && previous.records.length <= records.length
    && previous.records.every((record,i)=>records[i]===record);
  if (prefix && previous.records.length===records.length) return previous.file;
  const file = prefix
    ? new Blob([previous.file.slice(0,-1), ',', archiveBytes(JSON.stringify(records.slice(previous.records.length)).slice(1))])
    : archiveBytes(JSON.stringify(records));
  archiveFiles.set(records[0],{records:Object.freeze([...records]),file}); return file;
}
function exportParts(envelope: SaveEnvelope): BlobPart[] {
  const prototype = Object.getPrototypeOf(envelope);
  if ((prototype !== Object.prototype && prototype !== null) || 'toJSON' in envelope) return [JSON.stringify(envelope)];
  const keys = Object.keys(envelope), descriptors = Object.getOwnPropertyDescriptors(envelope);
  if (keys.some(key => !('value' in descriptors[key]))) return [JSON.stringify(envelope)];
  const battles: unknown = descriptors.battles?.value;
  // Only the private history brand permits encoded-byte reuse. External/frozen
  // spoofs stay on the native path, including unusual array properties/accessors.
  if (!Array.isArray(battles) || Object.getPrototypeOf(battles)!==Array.prototype
    || Object.getOwnPropertySymbols(battles).length || Object.getOwnPropertyNames(battles).length!==battles.length+1
    || 'toJSON' in battles || !battles.length
    || Array.from({length:battles.length},(_,i)=>Object.getOwnPropertyDescriptor(battles,String(i)))
      .some(descriptor=>!descriptor || !('value' in descriptor) || !isOwnedBattleRecord(descriptor.value))) return [JSON.stringify(envelope)];
  const parts: BlobPart[] = ['{']; let separator = '';
  for (const key of keys) {
    const value = descriptors[key].value;
    if (key === 'battles') {
      parts.push(separator, JSON.stringify(key), ':', archiveFile(battles));
    } else {
      // A wrapper preserves native property-key/toJSON/undefined semantics.
      const field = JSON.stringify({[key]:value}).slice(1,-1);
      if (!field) continue;
      parts.push(separator, field);
    }
    separator = ',';
  }
  parts.push('}'); return parts;
}
/** Export takes a same-tick snapshot supplied by the controller; no storage or RNG. */
export function exportFile(envelope: SaveEnvelope): Blob {
  const file = new Blob(exportParts(envelope), { type: 'application/json;charset=utf-8' });
  if (file.size > MAX_SAVE_BYTES) reject('文件体积超限');
  return file;
}
