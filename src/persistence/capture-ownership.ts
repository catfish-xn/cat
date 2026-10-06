import { isOwnedBattleRecord } from '../replay/history';
import type { BattleRecord, CapturedSave } from '../m6/contracts';

// A frozen outer object supplied by a caller is not evidence of owned children.
// Only this module can brand a recursively frozen, detached capture.
const owned = new WeakSet<object>();
function freezeTree(value: unknown, seen: WeakSet<object>): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const key of Object.keys(value)) freezeTree((value as Record<string, unknown>)[key], seen);
  Object.freeze(value);
}
export function fixedCapture(source: CapturedSave): CapturedSave {
  if (owned.has(source)) return source;
  const detach = <T>(value: T): T => {
    const copy = structuredClone(value);
    freezeTree(copy, new WeakSet());
    return copy;
  };
  const record = (value: BattleRecord): BattleRecord => isOwnedBattleRecord(value) ? value : detach(value);
  // History's private brand certifies its whole record graph, never just the wrapper.
  // Active Match and caller-owned arrays are detached on every capture.
  const copy: CapturedSave = Object.freeze({
    match: detach(source.match),
    currentBattle: source.currentBattle === null ? null : record(source.currentBattle),
    battleKeys: Object.freeze([...source.battleKeys]),
    addedBattles: Object.freeze(source.addedBattles.map(record)),
  });
  owned.add(copy);
  return copy;
}
/** Both operands are detached here; an injected writer cannot mutate their children. */
export function mergeCaptures(older: CapturedSave | null, newer: CapturedSave): CapturedSave {
  newer = fixedCapture(newer);
  if (!older) return newer;
  older = fixedCapture(older);
  const additions = new Map(older.addedBattles.map(record => [record.combatId, record]));
  for (const record of newer.addedBattles) if (!additions.has(record.combatId)) additions.set(record.combatId, record);
  const merged = Object.freeze({ ...newer, addedBattles: Object.freeze([...additions.values()]) });
  owned.add(merged);
  return merged;
}
