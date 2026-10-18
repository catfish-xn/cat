import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import type { BattleRecord } from '../../src/m6/contracts';
import { deepFreeze, ownBattleRecord } from '../../src/simulation/battle-record-validation';
import { canonicalContent } from '../../src/simulation/content';
// Retain compact bucket addresses, not another complete copy of every archive
// as canonical strings. A bucket hit still compares the full canonical value;
// neither a digest nor its collision can substitute a different recording.
function intern<T extends object>(cache:Map<string,T[]>,value:T,prepare:(value:T)=>T):T {
  const text=canonicalContent(value),key=createHash('sha256').update(text).digest('hex');
  const bucket=cache.get(key)??[];
  for(const candidate of bucket)if(canonicalContent(candidate)===text)return candidate;
  const owned=prepare(value);bucket.push(owned);cache.set(key,bucket);return owned;
}
const parts = new Map<string, object[]>();
function share<T extends object>(value:T): T {
  return intern(parts,value,deepFreeze) as T;
}
const records = new Map<string, BattleRecord[]>();
const fixtures = new Map<string, unknown>();
/** Share identical immutable recordings, including the common neutral/Herald prefix.
 * No replay result is persisted: production restore validates the first use. */
export function internRecordedBattles(battles: readonly BattleRecord[]): readonly BattleRecord[] {
  return battles.map(record => intern(records,record,value=>
    ownBattleRecord(deepFreeze({...value,initial:share(value.initial),events:share(value.events)}))));
}
/** Raw command recordings only. Consumers still validate candidates through production restore. */
export function readRecordedFixture<T>(name: string): T {
  if (!fixtures.has(name)) {
    const value = JSON.parse(gunzipSync(readFileSync(new URL(`./save-history/${name}.json.gz`, import.meta.url))).toString());
    value.battles = internRecordedBattles(value.battles);
    if (value.sharedPrefixRounds) {
      const neutral = readRecordedFixture<{ battles: readonly BattleRecord[] }>('neutral');
      value.battles = [...neutral.battles.slice(0,value.sharedPrefixRounds), ...value.battles];
    }
    fixtures.set(name, value);
  }
  return fixtures.get(name) as T;
}
