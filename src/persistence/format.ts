import type { SaveEnvelope } from '../m6/contracts';
import { MAX_BATTLE_RECORDS, MAX_EVENTS_PER_BATTLE, MAX_SAVE_BYTES } from '../m6/limits';
import { restoreMatch } from '../simulation/serialization';
import { SaveError } from './repository';

export type ValidateHistory = (envelope: SaveEnvelope) => void | Promise<void>;
const KEYS = ['kind', 'saveFormatVersion', 'replayFormatVersion', 'runId', 'createdAt', 'match', 'battles', 'currentBattle'].sort();
function reject(message: string): never { throw new SaveError('validation', `存档无效：${message}`); }
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}
/** Boundary validation precedes all domain/history reconstruction. Does not mutate input. */
export async function validateEnvelope(input: unknown, validateHistory: ValidateHistory): Promise<SaveEnvelope> {
  if (!object(input) || Object.keys(input).sort().join('|') !== KEYS.join('|')) reject('包装字段不匹配');
  if (input.kind !== 'hex-autobattler-save' || input.saveFormatVersion !== 1 || input.replayFormatVersion !== 1) reject('不支持的文件版本');
  if (typeof input.runId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.runId)) reject('对局身份不合法');
  if (typeof input.createdAt !== 'string' || input.createdAt.length > 40 || !Number.isFinite(Date.parse(input.createdAt))) reject('创建时间不合法');
  if (!Array.isArray(input.battles) || input.battles.length > MAX_BATTLE_RECORDS) reject('战斗档案数量超限');
  if (input.currentBattle !== null && !object(input.currentBattle)) reject('当前战斗档案不合法');
  const records = [...input.battles, ...(input.currentBattle === null ? [] : [input.currentBattle])];
  if (records.length > MAX_BATTLE_RECORDS) reject('战斗档案数量超限');
  for (const record of records) {
    if (!object(record) || !Array.isArray(record.events) || record.events.length > MAX_EVENTS_PER_BATTLE) reject('战斗事件边界不合法');
  }
  // Only validated Match may be passed on to the isolated historical validator.
  try {
    const match = restoreMatch(input.match);
    const envelope = structuredClone({ ...input, match }) as unknown as SaveEnvelope;
    await validateHistory(envelope);
    return envelope;
  } catch (error) {
    if (error instanceof SaveError && error.reason === 'validation') throw error;
    reject(error instanceof Error ? error.message : String(error));
  }
}
export async function validateFile(file: Blob, validateHistory: ValidateHistory): Promise<SaveEnvelope> {
  if (file.size > MAX_SAVE_BYTES) reject('文件体积超限');
  let parsed: unknown;
  try { parsed = JSON.parse(await file.text()); } catch { reject('文件不是有效 JSON'); }
  return validateEnvelope(parsed, validateHistory);
}
/** Export takes a same-tick snapshot supplied by the controller; no storage or RNG. */
export function exportFile(envelope: SaveEnvelope): Blob {
  const file = new Blob([JSON.stringify(envelope)], { type: 'application/json;charset=utf-8' });
  if (file.size > MAX_SAVE_BYTES) reject('文件体积超限');
  return file;
}
