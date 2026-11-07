/** Display identities only: native binding and the immutable effect encoded in a public item definition. */
import { PORTABLE_ANOMALY_PREFIX } from '../simulation/content/augment-pool-batch5-r2';
import { anomalyDisplayName, anomalyPlayerDescription } from './g23-display';

export interface UnitAnomaly { readonly id: string; readonly source: 'native' | 'portable' }
export function unitAnomalies(native: string | undefined, items: readonly string[]): readonly UnitAnomaly[] {
  return [...(native ? [{ id: native, source: 'native' as const }] : []),
    ...items.filter(id => id.startsWith(PORTABLE_ANOMALY_PREFIX)).map(id => ({ id: id.slice(PORTABLE_ANOMALY_PREFIX.length), source: 'portable' as const }))];
}
export function anomalyNotes(anomalies: readonly UnitAnomaly[]): string[] {
  return anomalies.flatMap(({ id, source }) => [`${source === 'portable' ? '便携异常（装备复制）' : '异常'}：${anomalyDisplayName(id)}`, anomalyPlayerDescription(id)].filter(Boolean));
}
