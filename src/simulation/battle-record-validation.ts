import { validateAugmentHistoryCarry } from './augment-history';
import type { BattleRecord, BattleRecordVersion } from '../m6/contracts';
import { CHECKPOINT_INTERVAL_TICKS, MAX_BATTLE_RECORDS, MAX_EVENTS_PER_BATTLE } from '../m6/limits';
import { M8_VERSION } from './m8/version';
import { combineItems, equipItem, useConsumable, startMatchCombat, stepMatch } from './match';
import type { MatchState } from './match-types';
import type { CombatState } from './combat-types';
import { MAX_COMBAT_TICKS } from './combat-types';
import { validateMatchStructure } from './serialization-structure';
import { readG23Progress } from './g2-3-state';
import { needsCrownHistory, missingCrownHistory } from './crown-history';
import { canonicalContent, digestContent, withSynchronousRestoreEncoding } from './content';
import { validateHistoricalEquipment } from './b8-restore';
import { equalOrderedJson, isImmutableJson } from './immutable-json';

// The recorder establishes detached, deeply immutable record ownership here.
// Weak branding never keeps an old battle alive and cannot be forged by freezing input.
const ownedBattleRecords = new WeakSet<object>();
export function isOwnedBattleRecord(value: unknown): value is BattleRecord {
  return value !== null && typeof value === 'object' && ownedBattleRecords.has(value);
}
export function ownBattleRecord(record: BattleRecord): BattleRecord {
  // Internal recorder entry: unusual but valid values (e.g. -0) simply retain
  // the uncached path. External freezing alone never applies this brand.
  if (isImmutableJson(record)) ownedBattleRecords.add(record);
  return record;
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(`战斗档案无效：${message}`); }
// Compare ordinary finite data without materializing two canonical strings.
// Read descriptors only: accessors and exotic arrays/objects keep the original
// encoder (including its read order and errors). Every child is visited, even
// after a value mismatch; equality never certifies an unvisited subtree.
function equalPlainContent(a: unknown, b: unknown): boolean | undefined {
  const scalar = (value: unknown) => value === null || typeof value === 'string' || typeof value === 'boolean'
    || typeof value === 'number' && Number.isFinite(value);
  if (scalar(a) && scalar(b)) return a === b;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return undefined;
  const array = Array.isArray(a);
  if (array !== Array.isArray(b) || Object.getPrototypeOf(a) !== (array ? Array.prototype : Object.prototype)
    || Object.getPrototypeOf(b) !== (array ? Array.prototype : Object.prototype)) return undefined;
  let keys: string[];
  if (array) {
    if ((a as unknown[]).length !== (b as unknown[]).length || Object.hasOwn(a, 'map') || Object.hasOwn(b, 'map')
      || Object.hasOwn(a, 'constructor') || Object.hasOwn(b, 'constructor')) return undefined;
    keys = Array.from({ length: (a as unknown[]).length }, (_, i) => String(i));
  } else {
    keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return undefined;
  }
  let equal = true;
  for (const key of keys) {
    const left = Object.getOwnPropertyDescriptor(a, key), right = Object.getOwnPropertyDescriptor(b, key);
    if (!left || !right || !('value' in left) || !('value' in right) || (!array && !right.enumerable)) return undefined;
    const child = equalPlainContent(left.value, right.value);
    if (child === undefined) return undefined;
    if (!child) equal = false;
  }
  return equal;
}
export function equalContent(a: unknown, b: unknown): boolean {
  return equalPlainContent(a, b) ?? (canonicalContent(a) === canonicalContent(b));
}
const keys = ['version','roundId','runId','combatId','context','initial','events','endTick','nextEventSeq','result','stateHash','eventHash'].sort();
const VERSION_KEYS = ['schemaVersion','rulesVersion','contentVersion','contentDigest','replayFormatVersion'] as const;
/** The version block a record made from this context must carry. */
export function recordVersion(context: MatchState): BattleRecordVersion {
  return { schemaVersion: context.schemaVersion, rulesVersion: context.rulesVersion, contentVersion: context.contentVersion, contentDigest: context.contentDigest, replayFormatVersion: M8_VERSION.replayFormatVersion };
}
function checkShape(record: BattleRecord) {
  check(record && typeof record === 'object' && !Array.isArray(record), '记录类型');
  check(equalContent(Object.keys(record).filter(key => key !== 'equipmentCommands').sort(), keys), '记录字段');
  check(typeof record.runId === 'string' && record.runId.length > 0 && typeof record.combatId === 'string', '身份');
  check(Number.isSafeInteger(record.endTick) && record.endTick >= 0 && record.endTick <= MAX_COMBAT_TICKS, '终点');
  check(Array.isArray(record.events) && record.events.length <= MAX_EVENTS_PER_BATTLE, '事件边界');
  check(record.nextEventSeq === record.events.length, '事件游标');
  check([null,'playerWin','enemyWin','draw'].includes(record.result), '结果');
  check(typeof record.stateHash === 'string' && typeof record.eventHash === 'string', '校验值');
  check(record.equipmentCommands === undefined || Array.isArray(record.equipmentCommands), '穿戴命令');
  let equipmentTick = 0;
  for (const command of record.equipmentCommands ?? []) {
    check(command && typeof command === 'object', '穿戴命令字段');
    if ('consumableId' in command) {
      check(equalContent(Object.keys(command).sort(), ['consumableId','target','tick'])
        && typeof command.consumableId === 'string' && command.consumableId.length > 0, '消耗品命令字段');
      const target = command.target;
      check(target && typeof target === 'object' && (target.kind === 'unit'
        ? equalContent(Object.keys(target).sort(), ['kind','unitId']) && typeof target.unitId === 'string' && target.unitId.length > 0
        : target.kind === 'item' && equalContent(Object.keys(target).sort(), ['itemId','kind']) && typeof target.itemId === 'string' && target.itemId.length > 0), '消耗品命令目标');
    } else if ('consumedIds' in command) {
      check(equalContent(Object.keys(command).sort(), ['consumedIds','tick'])
        && Array.isArray(command.consumedIds) && command.consumedIds.length === 2
        && command.consumedIds.every((id: unknown) => typeof id === 'string' && id.length > 0), '合成命令字段');
    } else check(equalContent(Object.keys(command).sort(), ['itemId','slot','tick','unitId']), '穿戴命令字段');
    check(Number.isSafeInteger(command.tick) && command.tick >= equipmentTick && command.tick <= record.endTick, '穿戴命令tick');
    equipmentTick = command.tick;
  }
  let lastTick = 0;
  for (let i = 0; i < record.events.length; i++) {
    const event = record.events[i];
    check(event && event.domain === 'combat' && event.combatId === record.combatId && event.eventSeq === i, '事件身份或序号');
    check(Number.isSafeInteger(event.tick) && event.tick >= lastTick && event.tick <= record.endTick, '事件tick');
    lastTick = event.tick;
  }
}
export interface VerifiedReplay { readonly terminal: CombatState; readonly settledMatch: MatchState }
/** Version routing first (M8_RULES §10): only the exact M8 replay2 record has a validator; anything else is refused. */
function validatorFor(record: BattleRecord): (record: BattleRecord, checkpoints?: CombatState[]) => VerifiedReplay {
  const version = record && typeof record === 'object' ? (record as { version?: unknown }).version : undefined;
  check(version !== null && typeof version === 'object' && !Array.isArray(version) && equalContent(Object.keys(version).sort(), [...VERSION_KEYS].sort()), '记录版本');
  const v = version as BattleRecordVersion;
  check(v.schemaVersion === M8_VERSION.schemaVersion && v.rulesVersion === M8_VERSION.rulesVersion && v.contentVersion === M8_VERSION.contentVersion
    && v.replayFormatVersion === M8_VERSION.replayFormatVersion && typeof v.contentDigest === 'string', '不支持的战斗档案版本');
  return validateM8Record;
}
/** Version/content preflight only: the structurally valid context is not admitted
 * for resumption here. Collection admission and PlaybackSession verify history. */
export function checkRecordCompatibility(record: BattleRecord): void {
  validatorFor(record);
  checkShape(record);
  const context = validateMatchStructure(record.context);
  check(equalContent(record.version, recordVersion(context)) && record.roundId === context.m8.round.roundId, '记录版本与开战上下文');
  check(digestContent(record.events) === record.eventHash, '事件校验值');
}
/** Full deterministic validation; never reads an active session. */
const verifiedRecords = new WeakMap<BattleRecord, VerifiedReplay>();
// v26 combat (14.24 neutrals, targeting, pathing) made a second full-catalog replay miss the
// existing 60s import wait. Admission of a detached copy may reuse one verified proof only when
// every field the validator reads matches, including shape. runId is the one retitled admission
// field; it is rechecked as a non-empty string and is not part of the combat proof.
// Mutable external evidence (validateMatchHistory / restoreMatch) is never reused: the caller
// can edit the same objects after a success, and the next call must simulate again.
const CONTENT_REPLAY_LIMIT = 48;
const contentReplays = new Map<string, { readonly record: BattleRecord; readonly verified: VerifiedReplay }>();
let coldBattleReplays = 0;
let mutableExternalEvidence = 0;
/** Combat reconstructions actually simulated. A matching unowned copy does not increment this. */
export function coldBattleReplayCount(): number { return coldBattleReplays; }
function contentReplayKey(record: BattleRecord): string {
  const names = record && typeof record === 'object' ? Object.keys(record).filter(key => key !== 'runId').sort() : [];
  return `${names.join(',')}\n${record.eventHash}\n${record.stateHash}\n${record.combatId}\n${record.endTick}\n${record.result ?? ''}\n${record.roundId}\n${record.nextEventSeq}`;
}
/** Plain enumerable data fields the validator reads, excluding the retitled runId. Accessors,
 * symbols and non-enumerable properties stay on the full path. */
function validatedFieldValues(record: object): Map<string, unknown> | null {
  if (Object.getPrototypeOf(record) !== Object.prototype || Object.getOwnPropertySymbols(record).length) return null;
  const names = Object.getOwnPropertyNames(record);
  if (names.length !== Object.keys(record).length) return null;
  const fields = new Map<string, unknown>();
  for (const key of names) {
    if (key === 'runId') continue;
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
    fields.set(key, descriptor.value);
  }
  return fields;
}
function reusableContent(a: unknown, b: unknown): boolean {
  const plain = equalPlainContent(a, b);
  if (plain !== undefined) return plain;
  try { return canonicalContent(a) === canonicalContent(b); }
  catch { return false; }
}
function sameBattleContent(record: BattleRecord, stored: BattleRecord): boolean {
  if (record === null || typeof record !== 'object' || stored === null || typeof stored !== 'object') return false;
  if (typeof record.runId !== 'string' || record.runId.length === 0) return false;
  const left = validatedFieldValues(record), right = validatedFieldValues(stored);
  if (!left || !right || left.size !== right.size) return false;
  for (const [key, value] of left) if (!right.has(key) || !reusableContent(value, right.get(key))) return false;
  return true;
}
function takeContentReplay(record: BattleRecord): VerifiedReplay | null {
  const hit = contentReplays.get(contentReplayKey(record));
  if (!hit || !sameBattleContent(record, hit.record)) return null;
  // A hit still routes the version and walks checkShape. Those reads are not skipped;
  // simulation is reused only after they accept this record.
  validatorFor(record);
  checkShape(record);
  // Detach the proof so a caller cannot rewrite the cached graph.
  return structuredClone(hit.verified);
}
function rememberContentReplay(record: BattleRecord, verified: VerifiedReplay): void {
  if (!validatedFieldValues(record)) return;
  const key = contentReplayKey(record);
  if (contentReplays.has(key) && !sameBattleContent(record, contentReplays.get(key)!.record)) return;
  if (contentReplays.size >= CONTENT_REPLAY_LIMIT && !contentReplays.has(key)) {
    const oldest = contentReplays.keys().next().value;
    if (oldest !== undefined) contentReplays.delete(oldest);
  }
  // Keep a detached copy. The caller's record is often frozen later, and an in-place edit of the
  // same object would otherwise compare equal to itself and reuse a stale proof. Hits clone again.
  contentReplays.set(key, { record: structuredClone(record), verified: structuredClone(verified) });
}
export function validateBattleRecord(record: BattleRecord, battles?: readonly BattleRecord[]): VerifiedReplay {
  const verified = replayBattleRecord(record);
  if (battles !== undefined) validateMatchHistory(record.context, battles);
  else if (needsCrownHistory(record.context)) missingCrownHistory();
  return verified;
}
/** Internal single-battle reconstruction. Collection admission separately binds
 * its context to the verified historical prefix; this is never a resume API. */
export function replayBattleRecord(record: BattleRecord): VerifiedReplay {
  const verified = replaySnapshot(record);
  // Public results remain detached and mutable; only the internal history walk
  // may read the private immutable proof without copying every completed Match.
  return isOwnedBattleRecord(record) ? structuredClone(verified) : verified;
}
function replaySnapshot(record: BattleRecord, checkpoints?: CombatState[]): VerifiedReplay {
  const cached = verifiedRecords.get(record);
  if (cached) return cached;
  // Checkpoint playback must walk the ticks. A content hit has no trajectory to fill.
  // Recorder-owned records keep the identity cache above. Mutable external evidence
  // (a restore/history walk) is simulated on every call, even when the bytes still match.
  const reuseContent = !checkpoints && mutableExternalEvidence === 0 && !isOwnedBattleRecord(record);
  if (reuseContent) {
    const reused = takeContentReplay(record);
    if (reused) return reused;
  }
  coldBattleReplays++;
  const verified = validatorFor(record)(record, checkpoints);
  if (reuseContent) rememberContentReplay(record, verified);
  // Only recorder-owned, detached immutable records qualify, after full replay.
  // Reconstruction already owns this detached graph. Freeze it directly;
  // replayBattleRecord copies it at the public boundary, never inside the walk.
  if (isOwnedBattleRecord(record)) verifiedRecords.set(record, deepFreeze(verified));
  return verified;
}
/** Playback can retain the states produced by its mandatory cold validation.
 * No callback sees provisional evidence, and nothing escapes until every event,
 * hash, settlement and required historical-prefix check has succeeded. Cached
 * proofs have no trajectory: playback then builds checkpoints by normal stepping.
 * Only this selected battle retains checkpoints; archive validation does not. */
export function validateBattlePlayback(record: BattleRecord, battles?: readonly BattleRecord[]): {
  readonly terminal: CombatState; readonly checkpoints: readonly CombatState[];
} {
  return withSynchronousRestoreEncoding(true, () => {
    const checkpoints: CombatState[] = [];
    const verified = replaySnapshot(record, checkpoints);
    if (battles !== undefined) validateMatchHistory(record.context, battles);
    else if (needsCrownHistory(record.context)) missingCrownHistory();
    // A hand-reordered opening is canonically valid, but normal playback keeps
    // its native property order. Equipment-command playback also keeps its
    // existing step/event checks rather than jumping over a command boundary.
    if (record.equipmentCommands?.length || (checkpoints.length > 0 && !equalOrderedJson(record.initial, checkpoints[0]))) checkpoints.length = 0;
    if (checkpoints.length) checkpoints.push(verified.terminal);
    return deepFreeze({ terminal: verified.terminal, checkpoints });
  });
}
function validateM8Record(record: BattleRecord, checkpoints?: CombatState[]): VerifiedReplay {
  checkShape(record);
  let state = validateMatchStructure(record.context);
  check(equalContent(record.version, recordVersion(state)) && record.roundId === state.m8.round.roundId, '记录版本与开战上下文');
  check(state.phase === 'preparation' && record.combatId === `round-${state.round}`, '开战上下文');
  const start = startMatchCombat(state);
  check(start.ok && start.state.combat, '无法开战');
  state = start.state;
  check(equalContent(state.combat, record.initial), 'tick0状态');
  let cursor = 0;
  const compare = (events: readonly import('../simulation/match-types').MatchEvent[]) => {
    for (const event of events) if (event.domain === 'combat') {
      check(cursor < record.events.length && equalContent(event, record.events[cursor]), '事件缺失或内容错误'); cursor++;
    }
  };
  compare(start.events);
  let equipmentCursor = 0;
  const replayEquipment = () => {
    const commands = record.equipmentCommands ?? [];
    while (equipmentCursor < commands.length && commands[equipmentCursor].tick === state.combat!.tick) {
      const command = commands[equipmentCursor++];
      check(state.phase === 'combat', '战后穿戴命令');
      const inventoryCombination = 'consumedIds' in command;
      const consumableUse = 'consumableId' in command;
      const equipped = consumableUse ? useConsumable(state, command.consumableId, command.target) : inventoryCombination
        ? combineItems(state, command.consumedIds[0], command.consumedIds[1])
        : equipItem(state, command.itemId, command.unitId, command.slot);
      // Production commands allocate the result before the next command. Their
      // resource facts include tick; history carry compares every fact, including
      // its order relative to loot and other settlement resources, without filtering.
      check(equipped.ok && equipped.events.some(event => event.type === (consumableUse ? 'consumableUsed' : inventoryCombination ? 'itemCombined' : 'itemEquipped')),
        consumableUse ? '非法消耗品命令' : inventoryCombination ? '非法合成命令' : '非法穿戴命令');
      state = equipped.state; compare(equipped.events);
    }
  };
  replayEquipment();
  checkpoints?.push(state.combat!);
  while (state.combat!.tick < record.endTick) {
    check(state.phase === 'combat', '终点超过战斗结束');
    const step = stepMatch(state); state = step.state; compare(step.events);
    replayEquipment();
    if (checkpoints && state.combat!.tick % CHECKPOINT_INTERVAL_TICKS === 0) checkpoints.push(state.combat!);
  }
  check(equipmentCursor === (record.equipmentCommands?.length ?? 0), '未重演穿戴命令');
  const terminal = state.combat!;
  check(cursor === record.events.length && terminal.nextEventSeq === record.nextEventSeq, '多余事件或游标');
  check(terminal.result === record.result && terminal.tick === record.endTick, '终点结果');
  check(digestContent(terminal) === record.stateHash && digestContent(record.events) === record.eventHash, '内容校验');
  return { terminal, settledMatch: state };
}
/** Preparation commands may append market choices/resources, never rewrite a settled
 * battle or insert another battle without its replay. All inputs have passed the
 * structural resource fold before reaching this comparison. */
function checkHistoryCarry(previous: MatchState | null, next: MatchState): void {
  const before = previous ? readG23Progress(previous)!.economyReceipts : [];
  const after = readG23Progress(next)!.economyReceipts;
  check(equalContent(after.slice(0, before.length), before), '历史经济收据前缀不一致');
  check(after.slice(before.length).every(action => action.kind !== 'battle'&&action.kind!=='mel-save'), '缺少历史证据：未验证的战斗经济收据');
  if (!previous) { validateHistoricalEquipment(null, next); return; }
  validateAugmentHistoryCarry(previous,next);
  if(previous.shopHistory){
    check(next.shopHistory?.version===previous.shopHistory.version
      &&equalContent(next.shopHistory.initial,previous.shopHistory.initial)
      &&equalContent(next.shopHistory.entries.slice(0,previous.shopHistory.entries.length),previous.shopHistory.entries),'历史商店证据前缀不一致');
  }
  const resources = previous.resourceProvenance.entries;
  check(equalContent(next.resourceProvenance.entries.slice(0, resources.length), resources), '历史获得或合成记录不一致');
  const rolls = previous.equipmentState.rolls;
  check(equalContent(next.equipmentState.rolls.slice(0, rolls.length), rolls), '历史临时装备收据前缀不一致');
  validateHistoricalEquipment(previous, next);
  const receipts = previous.seatMechanics!.receipts;
  check(equalContent(next.seatMechanics!.receipts.slice(0, receipts.length), receipts), '历史机制收据前缀不一致');
}

/** Reconstruct completed battles in order, carrying only verified prefixes. Each
 * record must continue verified equipment bindings through legal resource facts;
 * and normal combat/settlement reconstructs eligibility, result, RNG and payouts. */
export function* matchHistoryChecks(match: MatchState, battles: readonly BattleRecord[], runId?: string): Generator<void, void, void> {
  check(Array.isArray(battles) && battles.length <= MAX_BATTLE_RECORDS, '战斗数量');
  const results = match.roundResults.filter(result => result.result !== 'supply');
  check(results.length === battles.length, '缺少历史证据：历史缺战或重战');
  let previous: MatchState | null = null;
  for (let i = 0; i < battles.length; i++) {
    const record = battles[i], result = results[i];
    check(record.runId === (runId ?? battles[0].runId), '局身份');
    check(record.context.seed === match.seed, '历史种子');
    check(equalContent(record.context.roundResults, match.roundResults.filter(r => r.round < record.context.round)), '历史结算前缀');
    const verified = replaySnapshot(record);
    checkHistoryCarry(previous, record.context);
    check(record.context.round === result.round && record.result !== null && verified.terminal.status === 'finished', '历史身份或完成状态');
    check(equalContent(verified.settledMatch.roundResults.at(-1), result), '历史结算结果');
    if (match.combat?.status === 'finished' && match.combat.combatId === record.combatId) check(equalContent(verified.terminal, match.combat), '当前终战状态');
    previous = verified.settledMatch;
    yield;
  }
  checkHistoryCarry(previous, match);
}
/** Used by strict Match restoration. No history is inferred from the candidate's
 * own receipts and no externally supplied "verified" flag is accepted. */
export function validateMatchHistory(match: MatchState, battles: readonly BattleRecord[]): void {
  // These records stay caller-owned and mutable. Reusing a previous proof would hide an
  // in-place edit made after an earlier success (crown external evidence).
  mutableExternalEvidence++;
  try {
    for (const _ of matchHistoryChecks(match, battles)) { /* drain */ }
  } finally { mutableExternalEvidence--; }
}
