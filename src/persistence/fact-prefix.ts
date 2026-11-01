import type { BattleRecord, SaveEnvelope } from '../m6/contracts';

/** Battle contexts repeat the match's append-only augment-fact log. The file stores the length. */
export const AUGMENT_FACT_PREFIX = '$augmentFactPrefix';
/** A repeated contribution value. Import expands the dictionary before any check. */
const STATUS_REF = '$statusRef';
const STATUS_DICTIONARY = 'statusDictionary';
/** Status events share one key set. A row omits those names and the battle's combat id. */
const STATUS_ROW = '$s';
const PACKET_ROW = '$p';
const MANA_ROW = '$m';
const SHIELD_ROW = '$h';
const PACKET_EVENT_KEYS = ['type', 'tick', 'outcome', 'domain', 'combatId', 'eventSeq'];
const PACKET_OUTCOME_KEYS = ['context', 'hit', 'raw', 'prevented', 'mitigated', 'critical', 'absorbed', 'hpDamage', 'overkill', 'killingPacket'];
const PACKET_CONTEXT_KEYS = ['source', 'targetId', 'damageType', 'delivery', 'actionSeq', 'rootActionSeq', 'parentPacketId', 'triggeringCastActionSeq', 'packetId', 'packetOrdinal', 'equipmentDepth', 'redirected', 'area', 'critEligibility', 'permissions'];
const MANA_OUTCOME_KEYS = ['source', 'targetId', 'amount', 'reason', 'bypassLock', 'castActionSeq', 'before', 'blocked', 'applied', 'overflow', 'after'];
const SHIELD_EVENT_KEYS = ['type', 'tick', 'layer', 'reason', 'domain', 'combatId', 'eventSeq'];
const SHIELD_LAYER_KEYS = ['key', 'source', 'targetId', 'granted', 'remaining', 'absorbed', 'decayed', 'expiredDiscarded', 'startsAtTick', 'expiresAtTick', 'endRewardConsumed', 'decay'];
const STATUS_EVENT_KEYS = ['type', 'tick', 'reason', 'group', 'domain', 'combatId', 'eventSeq'];
const STATUS_GROUP_KEYS = ['targetId', 'kind', 'contributions', 'effectiveSourceKey', 'effectiveMagnitudeBps', 'nextPulseAtTick'];
const STATUS_CONTRIBUTION_KEYS = ['key', 'source', 'targetId', 'application', 'appliedAtTick', 'expiresAtTick', 'endRewardConsumed'];
const MIN_INTERN_CHARS = 48;
const MIN_SAVINGS = 4096;

interface FactTail { readonly sequence?: unknown; readonly kind?: unknown }

function replaceKey<T extends object>(value: T, key: string, next: unknown): T {
  const copy: Record<string, unknown> = {};
  for (const name of Object.keys(value)) copy[name] = name === key ? next : (value as Record<string, unknown>)[name];
  return copy as T;
}

/** Same key order and values. One fact is enough for the tail of an append-only log. */
function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const leftKeys = Object.keys(left), rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  const leftRecord = left as Record<string, unknown>, rightRecord = right as Record<string, unknown>;
  for (let i = 0; i < leftKeys.length; i++) {
    const key = leftKeys[i];
    if (key !== rightKeys[i] || !sameValue(leftRecord[key], rightRecord[key])) return false;
  }
  return true;
}

function isFactPrefix(facts: readonly FactTail[], source: readonly FactTail[]): boolean {
  if (facts.length > source.length || facts.length === 0) return false;
  // Small logs are compared in full so a rewritten early fact is stored as written.
  // A long log compares its ends: facts are append-only, and import still replays.
  const limit = facts.length <= 64 ? facts.length : 2;
  const indexes = limit === facts.length ? facts.map((_, index) => index) : [0, facts.length - 1];
  return indexes.every(index => sameValue(facts[index], source[index]));
}

interface CatalogEntry { value: unknown; count: number; id: number }
interface RepeatedContribution {
  readonly key: unknown; readonly source: unknown; readonly application: unknown; readonly targetId: unknown;
  readonly appliedAtTick: unknown; readonly expiresAtTick: unknown; readonly endRewardConsumed: unknown;
}

function mix(hash: number, sample: number): number { return Math.imul(hash ^ sample, 16777619); }

/** No key allocation. Used only to bucket status values; sameJson still decides equality. */
function fingerprint(value: object): number {
  let hash = 2166136261;
  let count = 0;
  const record = value as Record<string, unknown>;
  for (const key in record) {
    if (!Object.hasOwn(record, key)) continue;
    count++;
    if (count > 8) continue;
    hash = mix(hash, key.charCodeAt(0) + key.length * 131);
    const child = record[key];
    if (typeof child === 'string') hash = mix(hash, child.length * 131 + child.charCodeAt(0) + child.charCodeAt(child.length - 1));
    else if (typeof child === 'number') hash = mix(hash, child | 0);
    else if (typeof child === 'boolean') hash = mix(hash, child ? 1 : 2);
    else if (child === null) hash = mix(hash, 3);
    else if (typeof child === 'object') {
      const kind = (child as { kind?: unknown }).kind;
      hash = mix(hash, typeof kind === 'string' ? kind.length * 131 + kind.charCodeAt(0) : 9);
    }
  }
  return mix(hash, count) >>> 0;
}

/** Structural equality without the key arrays Object.keys would allocate on the hot path. */
function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (let i = 0; i < left.length; i++) if (!sameJson(left[i], right[i])) return false;
    return true;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  let leftCount = 0;
  for (const key in leftRecord) {
    if (!Object.hasOwn(leftRecord, key)) continue;
    leftCount++;
    if (!Object.hasOwn(rightRecord, key) || !sameJson(leftRecord[key], rightRecord[key])) return false;
  }
  let rightCount = 0;
  for (const key in rightRecord) if (Object.hasOwn(rightRecord, key)) rightCount++;
  return leftCount === rightCount;
}

function packCombatEvent(event: { readonly type?: string; readonly domain?: unknown; readonly combatId?: unknown; readonly tick?: unknown; readonly eventSeq?: unknown; readonly outcome?: object; readonly layer?: object; readonly reason?: unknown }, combatId: unknown): unknown[] | undefined {
  if (event.domain !== 'combat' || event.combatId !== combatId) return;
  if (event.type === 'packetDamage' && event.outcome && exactKeys(event, PACKET_EVENT_KEYS) && exactKeys(event.outcome, PACKET_OUTCOME_KEYS)) {
    const outcome = event.outcome as Record<string, unknown>;
    const context = outcome.context;
    if (!context || typeof context !== 'object' || !exactKeys(context, PACKET_CONTEXT_KEYS)) return;
    const source = context as Record<string, unknown>;
    return [PACKET_ROW, event.tick, event.eventSeq, outcome.hit, outcome.raw, outcome.prevented, outcome.mitigated, outcome.critical, outcome.absorbed, outcome.hpDamage, outcome.overkill, outcome.killingPacket, source.source, source.targetId, source.damageType, source.delivery, source.actionSeq, source.rootActionSeq, source.parentPacketId, source.triggeringCastActionSeq, source.packetId, source.packetOrdinal, source.equipmentDepth, source.redirected, source.area, source.critEligibility, source.permissions];
  }
  if (event.type === 'manaChanged' && event.outcome && exactKeys(event, PACKET_EVENT_KEYS) && exactKeys(event.outcome, MANA_OUTCOME_KEYS)) {
    const outcome = event.outcome as Record<string, unknown>;
    return [MANA_ROW, event.tick, event.eventSeq, outcome.source, outcome.targetId, outcome.amount, outcome.reason, outcome.bypassLock, outcome.castActionSeq, outcome.before, outcome.blocked, outcome.applied, outcome.overflow, outcome.after];
  }
  if (event.type === 'shieldLayerChanged' && event.layer && exactKeys(event, SHIELD_EVENT_KEYS) && exactKeys(event.layer, SHIELD_LAYER_KEYS)) {
    const layer = event.layer as Record<string, unknown>;
    return [SHIELD_ROW, event.tick, event.eventSeq, event.reason, layer.key, layer.source, layer.targetId, layer.granted, layer.remaining, layer.absorbed, layer.decayed, layer.expiredDiscarded, layer.startsAtTick, layer.expiresAtTick, layer.endRewardConsumed, layer.decay];
  }
  return undefined;
}

function exactKeys(value: object, expected: readonly string[]): boolean {
  let count = 0;
  for (const key in value) if (Object.hasOwn(value, key)) count++;
  if (count !== expected.length) return false;
  for (const key of expected) if (!Object.hasOwn(value, key)) return false;
  return true;
}

function replaceContribution(contribution: RepeatedContribution, key: unknown, source: unknown, application: unknown): RepeatedContribution {
  const copy: Record<string, unknown> = {};
  for (const name of Object.keys(contribution)) {
    copy[name] = name === 'key' ? key : name === 'source' ? source : name === 'application' ? application : (contribution as unknown as Record<string, unknown>)[name];
  }
  return copy as unknown as RepeatedContribution;
}

/** Battle snapshots copy each event, so repetition is by value. Keep small records unchanged. */
function compactSharedStatus<T extends BattleRecord>(record: T): T {
  const events = record.events;
  if (!Array.isArray(events) || events.length === 0) return record;
  const buckets = new Map<number, CatalogEntry[]>();
  const strings = new Map<string, CatalogEntry>();
  const entries: CatalogEntry[] = [];
  const noted: (CatalogEntry | undefined)[] = [];
  const groupNotes: (CatalogEntry | undefined)[] = [];
  const recent: (CatalogEntry | undefined)[] = [];
  const note = (value: unknown, slot: number): CatalogEntry | undefined => {
    if (typeof value === 'string') {
      if (value.length < MIN_INTERN_CHARS) return;
      const existing = strings.get(value);
      if (existing) { existing.count++; return existing; }
      const entry: CatalogEntry = { value, count: 1, id: -1 };
      strings.set(value, entry); entries.push(entry); return entry;
    }
    if (!value || typeof value !== 'object') return;
    const prior = recent[slot];
    if (prior && (prior.value === value || sameJson(prior.value, value))) { prior.count++; return prior; }
    const hash = fingerprint(value);
    let bucket = buckets.get(hash);
    if (bucket) {
      for (const entry of bucket) if (entry.value === value || sameJson(entry.value, value)) {
        entry.count++; recent[slot] = entry; return entry;
      }
    } else {
      bucket = [];
      buckets.set(hash, bucket);
    }
    const entry: CatalogEntry = { value, count: 1, id: -1 };
    bucket.push(entry); entries.push(entry); recent[slot] = entry; return entry;
  };
  for (const event of events) {
    if (event.type !== 'statusChanged') continue;
    groupNotes.push(note(event.group.effectiveSourceKey, 3));
    for (const contribution of event.group.contributions) {
      noted.push(note(contribution.key, 0), note(contribution.source, 1), note(contribution.application, 2));
    }
  }
  const dictionary: unknown[] = [];
  let savings = 0;
  for (const entry of entries) {
    if (entry.count < 2) continue;
    const encoded = JSON.stringify(entry.value);
    if (encoded.length < MIN_INTERN_CHARS) continue;
    entry.id = dictionary.length;
    dictionary.push(entry.value);
    savings += (entry.count - 1) * (encoded.length - MIN_INTERN_CHARS);
  }
  if (dictionary.length === 0 || savings < MIN_SAVINGS) return record;
  const reused = (entry: CatalogEntry | undefined, value: unknown): unknown => entry && entry.id >= 0 ? { [STATUS_REF]: entry.id } : value;
  let cursor = 0;
  let groupCursor = 0;
  let changed = false;
  const nextEvents = events.map(event => {
    if (event.type !== 'statusChanged') {
      const row = packCombatEvent(event, record.combatId);
      if (!row) return event;
      changed = true;
      return row as unknown as typeof event;
    }
    const group = event.group;
    const packed = event.domain === 'combat' && event.combatId === record.combatId
      && exactKeys(event, STATUS_EVENT_KEYS) && exactKeys(group, STATUS_GROUP_KEYS);
    const sourceKey = reused(groupNotes[groupCursor++], group.effectiveSourceKey);
    const rows: unknown[] = [];
    let shape = packed;
    for (const contribution of group.contributions as readonly RepeatedContribution[]) {
      const key = reused(noted[cursor++], contribution.key);
      const source = reused(noted[cursor++], contribution.source);
      const application = reused(noted[cursor++], contribution.application);
      if (!shape || !exactKeys(contribution, STATUS_CONTRIBUTION_KEYS)) { shape = false; continue; }
      rows.push([key, source, contribution.targetId, application, contribution.appliedAtTick, contribution.expiresAtTick, contribution.endRewardConsumed]);
    }
    if (shape) {
      changed = true;
      return [STATUS_ROW, event.tick, event.reason, group.targetId, group.kind, rows, sourceKey, group.effectiveMagnitudeBps, group.nextPulseAtTick, event.eventSeq] as unknown as typeof event;
    }
    cursor -= group.contributions.length * 3;
    let groupChanged = sourceKey !== group.effectiveSourceKey;
    const mapped = group.contributions.map((contribution: RepeatedContribution) => {
      const key = reused(noted[cursor++], contribution.key);
      const source = reused(noted[cursor++], contribution.source);
      const application = reused(noted[cursor++], contribution.application);
      if (key === contribution.key && source === contribution.source && application === contribution.application) return contribution;
      groupChanged = true;
      return replaceContribution(contribution, key, source, application);
    });
    if (!groupChanged) return event;
    changed = true;
    const nextGroup = sourceKey === group.effectiveSourceKey ? group : replaceKey(group, 'effectiveSourceKey', sourceKey);
    return replaceKey(event, 'group', replaceKey(nextGroup, 'contributions', mapped));
  });
  if (!changed) return record;
  return { ...replaceKey(record, 'events', nextEvents), [STATUS_DICTIONARY]: dictionary } as T;
}

/** Shallow wrappers only. Frozen records stay intact, and key order matches the live objects. */
export function compactBattleRecord<T extends BattleRecord>(record: T, sourceFacts: readonly FactTail[] | undefined): T {
  let next = record;
  const history = record.context?.augmentHistory;
  if (history && Array.isArray(history.facts) && sourceFacts && isFactPrefix(history.facts, sourceFacts)) {
    const compacted = replaceKey(history, 'facts', { [AUGMENT_FACT_PREFIX]: history.facts.length });
    next = replaceKey(next, 'context', replaceKey(record.context, 'augmentHistory', compacted));
  }
  return compactSharedStatus(next);
}

export function compactBattleRecords(records: readonly BattleRecord[], sourceFacts: readonly FactTail[] | undefined): readonly BattleRecord[] {
  let changed = false;
  const compacted = records.map(record => {
    const next = compactBattleRecord(record, sourceFacts);
    if (next !== record) changed = true;
    return next;
  });
  return changed ? compacted : records;
}

/** Restores fact arrays on a freshly parsed file. Live objects have real arrays and are left untouched. */
export function expandAugmentFactPrefixes(input: unknown): void {
  if (!input || typeof input !== 'object') return;
  const envelope = input as Partial<SaveEnvelope>;
  const source = envelope.match?.augmentHistory?.facts;
  const expandStatus = (record: BattleRecord): void => {
    const host = record as BattleRecord & { statusDictionary?: unknown; events: BattleRecord['events'] };
    if (!Object.hasOwn(host, STATUS_DICTIONARY)) return;
    const dictionary = host.statusDictionary;
    if (!Array.isArray(dictionary)) throw new Error('状态字典');
    const revive = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        let changed = false;
        const copy = value.map(child => {
          const next = revive(child);
          if (next !== child) changed = true;
          return next;
        });
        return changed ? copy : value;
      }
      if (!value || typeof value !== 'object') return value;
      const keys = Object.keys(value);
      if (keys.length === 1 && keys[0] === STATUS_REF) {
        const id = (value as Record<string, unknown>)[STATUS_REF];
        if (typeof id !== 'number' || !Number.isInteger(id) || id < 0 || id >= dictionary.length) throw new Error('状态字典');
        return dictionary[id];
      }
      let changed = false;
      const copy: Record<string, unknown> = {};
      for (const key of keys) {
        const current = (value as Record<string, unknown>)[key];
        const next = revive(current);
        copy[key] = next;
        if (next !== current) changed = true;
      }
      return changed ? copy : value;
    };
    const revived = revive(host.events);
    delete host.statusDictionary;
    host.events = expandStatusRows(revived, record.combatId) as BattleRecord['events'];
  };
  const expandStatusRows = (events: unknown, combatId: unknown): unknown => {
    if (!Array.isArray(events)) return events;
    let changed = false;
    const expanded = events.map(event => {
      if (!Array.isArray(event)) return event;
      if (event[0] === PACKET_ROW && event.length === 27) {
        changed = true;
        return {
          type: 'packetDamage', tick: event[1],
          outcome: {
            context: {
              source: event[12], targetId: event[13], damageType: event[14], delivery: event[15], actionSeq: event[16],
              rootActionSeq: event[17], parentPacketId: event[18], triggeringCastActionSeq: event[19], packetId: event[20],
              packetOrdinal: event[21], equipmentDepth: event[22], redirected: event[23], area: event[24],
              critEligibility: event[25], permissions: event[26],
            },
            hit: event[3], raw: event[4], prevented: event[5], mitigated: event[6], critical: event[7], absorbed: event[8],
            hpDamage: event[9], overkill: event[10], killingPacket: event[11],
          },
          domain: 'combat', combatId, eventSeq: event[2],
        };
      }
      if (event[0] === MANA_ROW && event.length === 14) {
        changed = true;
        return {
          type: 'manaChanged', tick: event[1],
          outcome: {
            source: event[3], targetId: event[4], amount: event[5], reason: event[6], bypassLock: event[7],
            castActionSeq: event[8], before: event[9], blocked: event[10], applied: event[11], overflow: event[12], after: event[13],
          },
          domain: 'combat', combatId, eventSeq: event[2],
        };
      }
      if (event[0] === SHIELD_ROW && event.length === 16) {
        changed = true;
        return {
          type: 'shieldLayerChanged', tick: event[1],
          layer: {
            key: event[4], source: event[5], targetId: event[6], granted: event[7], remaining: event[8], absorbed: event[9],
            decayed: event[10], expiredDiscarded: event[11], startsAtTick: event[12], expiresAtTick: event[13],
            endRewardConsumed: event[14], decay: event[15],
          },
          reason: event[3], domain: 'combat', combatId, eventSeq: event[2],
        };
      }
      if (event[0] !== STATUS_ROW || event.length !== 10) return event;
      changed = true;
      if (!Array.isArray(event[5])) throw new Error('状态字典');
      const contributions = event[5].map((row: unknown) => {
        if (!Array.isArray(row) || row.length !== 7) throw new Error('状态字典');
        return {
          key: row[0], source: row[1], targetId: row[2], application: row[3],
          appliedAtTick: row[4], expiresAtTick: row[5],         endRewardConsumed: row[6],
        };
      });
      return {
        type: 'statusChanged', tick: event[1], reason: event[2],
        group: {
          targetId: event[3], kind: event[4], contributions, effectiveSourceKey: event[6],
          effectiveMagnitudeBps: event[7], nextPulseAtTick: event[8],
        },
        domain: 'combat', combatId, eventSeq: event[9],
      };
    });
    return changed ? expanded : events;
  };
  const expand = (record: BattleRecord | null | undefined): void => {
    if (record) expandStatus(record);
    const history = record?.context?.augmentHistory as { facts?: unknown } | undefined;
    const facts = history?.facts;
    if (!history || facts == null || Array.isArray(facts) || typeof facts !== 'object') return;
    const length = (facts as Record<string, unknown>)[AUGMENT_FACT_PREFIX];
    if (typeof length !== 'number' || !Number.isInteger(length) || length < 0 || !Array.isArray(source) || length > source.length)
      throw new Error('强化事实前缀');
    history.facts = source.slice(0, length);
  };
  if (Array.isArray(envelope.battles)) for (const record of envelope.battles) expand(record);
  expand(envelope.currentBattle);
}
