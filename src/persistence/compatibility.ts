import type { SaveEnvelope } from '../m6/contracts';
import type { CompatibilityView } from '../simulation/m8/ui-contracts';
import { MAX_BATTLE_RECORDS, MAX_EVENTS_PER_BATTLE } from '../m6/limits';
import { CONTENT_DIGEST } from '../simulation/content';
import { restoreMatch } from '../simulation/serialization';
import { LEGACY_M7_VERSION, LEGACY_M8_VERSION, M8_VERSION } from '../simulation/m8/version';
import { validateBattleCollectionSync } from '../replay/history';

/** M8_UI_CONTRACT §6: format routing first, then the matching validator; a header alone is never a licence. */
export type RejectedReason = Extract<CompatibilityView, { status: 'rejected' }>['reason'];
export type RoutedFile = { readonly view: CompatibilityView; readonly envelope: null; readonly detail?: string } | { readonly view: null; readonly envelope: SaveEnvelope };

const KEYS = ['kind', 'saveFormatVersion', 'replayFormatVersion', 'runId', 'createdAt', 'match', 'battles', 'currentBattle'].sort().join('|');
const MATCH_HEADER = ['schemaVersion', 'rulesVersion', 'contentVersion', 'commandProtocolVersion', 'rngAlgorithm', 'tickMs'] as const;
const plain = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;

export const currentView = (): CompatibilityView => ({ status: 'current', currentRulesVersion: M8_VERSION.rulesVersion,
  fileRulesVersion: M8_VERSION.rulesVersion, canResume: true, canReplay: true, canExportOriginal: true, reason: null });
const legacyView = (version:typeof LEGACY_M7_VERSION|typeof LEGACY_M8_VERSION=LEGACY_M7_VERSION): CompatibilityView => ({ status: 'legacy-preserved', currentRulesVersion: M8_VERSION.rulesVersion,
  fileRulesVersion: version.rulesVersion, canResume: false, canReplay: false, canExportOriginal: true, reason: 'new-match-required' });
/** A parsed file holds no stored original bytes, so a rejected file is never offered for export here. */
export const rejectedView = (reason: RejectedReason, fileRulesVersion: string | null): CompatibilityView => ({ status: 'rejected',
  currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion, canResume: false, canReplay: false, canExportOriginal: false, reason });

/** D2-A recognition only: the shipped M7 wrapper and Match header. Preservation is not M8 semantic validation. */
function legacyShape(input: Record<string, unknown>, match: Record<string, unknown>): boolean {
  return Object.keys(input).sort().join('|') === KEYS && typeof input.runId === 'string' && typeof input.createdAt === 'string'
    && Array.isArray(input.battles) && (input.currentBattle === null || plain(input.currentBattle))
    && match.schemaVersion === LEGACY_M7_VERSION.schemaVersion && match.contentVersion === LEGACY_M7_VERSION.contentVersion;
}
/** Synchronous routing and boundary checks up to (not including) history replay. Never mutates input. */
export function routeSaveFile(input: unknown): RoutedFile {
  const reject = (reason: RejectedReason, file: string | null, detail?: string): RoutedFile => ({ view: rejectedView(reason, file), envelope: null, ...(detail === undefined ? {} : { detail }) });
  if (!plain(input) || input.kind !== 'hex-autobattler-save') return reject('invalid-data', null);
  const match = plain(input.match) ? input.match : null;
  const fileRules = typeof match?.rulesVersion === 'string' ? match.rulesVersion : null;
  if (input.saveFormatVersion === LEGACY_M7_VERSION.saveFormatVersion && input.replayFormatVersion === LEGACY_M7_VERSION.replayFormatVersion
    && fileRules === LEGACY_M7_VERSION.rulesVersion) {
    return legacyShape(input, match!) ? { view: legacyView(), envelope: null } : reject('invalid-data', fileRules);
  }
  if(input.saveFormatVersion===2&&input.replayFormatVersion===2&&fileRules===LEGACY_M8_VERSION.rulesVersion) {
    const valid=Object.keys(input).sort().join('|')===KEYS&&typeof input.runId==='string'&&typeof input.createdAt==='string'
      &&Array.isArray(input.battles)&&(input.currentBattle===null||plain(input.currentBattle))
      &&match?.schemaVersion===6&&match.contentVersion===LEGACY_M8_VERSION.contentVersion;
    return valid?{view:legacyView(LEGACY_M8_VERSION),envelope:null}:reject('invalid-data',fileRules);
  }
  if (input.saveFormatVersion !== M8_VERSION.saveFormatVersion || input.replayFormatVersion !== M8_VERSION.replayFormatVersion) return reject('unsupported-version', fileRules);
  if (Object.keys(input).sort().join('|') !== KEYS || !match) return reject('invalid-data', fileRules);
  if (MATCH_HEADER.some(key => match[key] !== M8_VERSION[key])) return reject('unsupported-version', fileRules);
  if (match.contentDigest !== CONTENT_DIGEST) return reject('digest-mismatch', fileRules);
  if (typeof input.runId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.runId)) return reject('invalid-data', fileRules);
  if (typeof input.createdAt !== 'string' || input.createdAt.length > 40 || !Number.isFinite(Date.parse(input.createdAt))) return reject('invalid-data', fileRules);
  if (!Array.isArray(input.battles) || (input.currentBattle !== null && !plain(input.currentBattle))) return reject('invalid-data', fileRules);
  const records: unknown[] = [...input.battles, ...(input.currentBattle === null ? [] : [input.currentBattle])];
  if (input.battles.length > MAX_BATTLE_RECORDS || records.length > MAX_BATTLE_RECORDS) return reject('capacity-exceeded', fileRules);
  for (const record of records) {
    if (!plain(record) || !Array.isArray(record.events)) return reject('invalid-data', fileRules);
    if (record.events.length > MAX_EVENTS_PER_BATTLE) return reject('capacity-exceeded', fileRules, '战斗事件边界超限');
  }
  try {
    // Only a validated Match is handed on to the isolated historical validator.
    const restored = restoreMatch(match);
    return { view: null, envelope: structuredClone({ ...input, match: restored }) as unknown as SaveEnvelope };
  } catch (error) { return reject('invalid-data', fileRules, error instanceof Error ? error.message : String(error)); }
}
/** M8Queries.readCompatibility: routing plus full state/history validation, synchronously. */
export function readCompatibility(file: unknown): CompatibilityView {
  const routed = routeSaveFile(file);
  if (routed.view) return routed.view;
  try { validateBattleCollectionSync(routed.envelope); return currentView(); }
  catch { return rejectedView('invalid-data', M8_VERSION.rulesVersion); }
}
