import { describe, it } from 'vitest';
import type { BattleRecord } from '../../src/m6/contracts';
import { validateBattleRecord } from '../../src/replay/history';
/** Every cold admission is a visible timed test, using the unchanged 5s limit.
 * This keeps fixture verification in suite wall time instead of module import. */
export function verifyRecordedHistories(label: string, histories: readonly (readonly BattleRecord[])[]): void {
  const seen = new Set<BattleRecord>();
  const cases = histories.flatMap(battles => battles.flatMap((record,index) => {
    if (seen.has(record)) return [];
    seen.add(record);
    return [{name:`${label}/${histories.indexOf(battles)}/${record.roundId}`,record,prior:battles.slice(0,index)}];
  }));
  describe('recorded public fixture history admission', () => {
    it.each(cases)('$name replays its complete ledger and historical prefix', ({record,prior}) => {
      validateBattleRecord(record,prior);
    });
  });
}
/** Deferred public routes are constructed by the file's existing beforeAll. */
export function verifyDeferredRecordedHistory(label: string, count: number, get: () => readonly BattleRecord[]): void {
  describe(`${label} recorded public history admission`, () => {
    it.each(Array.from({length:count},(_,index)=>index))('battle %i replays its complete ledger and historical prefix', index => {
      const battles=get();
      if (battles.length !== count) throw new Error(`Expected ${count} real battles, received ${battles.length}`);
      validateBattleRecord(battles[index],battles.slice(0,index));
    });
  });
}
