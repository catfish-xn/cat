import type { SaveEnvelope } from '../m6/contracts';
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
  try { await validateHistory(routed.envelope); return routed.envelope; }
  catch (error) {
    if (error instanceof SaveError && error.reason === 'validation') throw error;
    throw new CompatibilityError(rejectedView('invalid-data', routed.envelope.match.rulesVersion), error instanceof Error ? error.message : String(error));
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
