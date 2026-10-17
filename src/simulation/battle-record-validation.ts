import { createPreparationLedgerValidator } from './preparation-ledger';
import type { BattleRecord, BattleRecordVersion } from '../m6/contracts';
import { MAX_BATTLE_RECORDS, MAX_EVENTS_PER_BATTLE } from '../m6/limits';
import { M8_VERSION } from './m8/version';
import { combineItems, equipItem, useConsumable, startMatchCombat, stepMatch } from './match';
import type { MatchState } from './match-types';
import type { CombatState } from './combat-types';
import { MAX_COMBAT_TICKS } from './combat-types';
import { validateMatchStructure } from './serialization-structure';
import { readG23Progress } from './g2-3-state';
import { needsCrownHistory, missingCrownHistory } from './crown-history';
import { canonicalContent, digestContent } from './content';
import { validateHistoricalEquipment } from './b8-restore';
import { isImmutableJson } from './immutable-json';

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
export function equalContent(a: unknown, b: unknown): boolean { return canonicalContent(a) === canonicalContent(b); }
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
function validatorFor(record: BattleRecord): (record: BattleRecord) => VerifiedReplay {
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
function replaySnapshot(record: BattleRecord): VerifiedReplay {
  const cached = verifiedRecords.get(record);
  if (cached) return cached;
  const verified = validatorFor(record)(record);
  // Only recorder-owned, detached immutable records qualify, after full replay.
  // Reconstruction already owns this detached graph. Freeze it directly;
  // replayBattleRecord copies it at the public boundary, never inside the walk.
  if (isOwnedBattleRecord(record)) verifiedRecords.set(record, deepFreeze(verified));
  return verified;
}
function validateM8Record(record: BattleRecord, restore = validateMatchStructure,
  proofFor?: ReturnType<typeof createPreparationLedgerValidator>['battleProof']): VerifiedReplay {
  checkShape(record);
  const state = restore(record.context);
  return validateBattleFacts(record, state, proofFor);
}
/** Direct battle-facts validator, not Match admission. Production callers must
 * first verify the opening's complete structure and preparation economics.
 * Exported for isolated rule tests whose artificial equipment has no save route. */
export function validateBattleFacts(record: BattleRecord, context: MatchState,
  proofFor?: ReturnType<typeof createPreparationLedgerValidator>['battleProof']): VerifiedReplay {
  validatorFor(record);
  checkShape(record);
  let state = context;
  check(equalContent(record.version, recordVersion(state)) && record.roundId === state.m8.round.roundId, '记录版本与开战上下文');
  check(state.phase === 'preparation' && record.combatId === `round-${state.round}`, '开战上下文');
  // The new equipment command stream has its own strict production replay below.
  // A generic ledger battle proof cannot substitute for validating that stream.
  const proof = record.equipmentCommands?.length ? undefined : proofFor?.(state, record.endTick);
  if (proof && proof.settledMatch.preparationLedger.commands
    .slice(proof.context.preparationLedger.commands.length)
    .every(command => command.name === 'startMatchCombat' || command.name === 'stepMatch')) {
    check(equalContent(proof.initial, record.initial), 'tick0状态');
    check(equalContent(proof.events, record.events), '事件缺失或内容错误');
    const terminal = proof.settledMatch.combat!;
    check(proof.events.length === record.events.length && terminal.nextEventSeq === record.nextEventSeq, '多余事件或游标');
    check(terminal.result === record.result && terminal.tick === record.endTick, '终点结果');
    check(digestContent(terminal) === record.stateHash && digestContent(record.events) === record.eventHash, '内容校验');
    return { terminal, settledMatch: proof.settledMatch };
  }
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
  while (state.combat!.tick < record.endTick) {
    check(state.phase === 'combat', '终点超过战斗结束');
    const step = stepMatch(state); state = step.state; compare(step.events);
    replayEquipment();
  }
  check(equipmentCursor === (record.equipmentCommands?.length ?? 0), '未重演穿戴命令');
  const terminal = state.combat!;
  check(cursor === record.events.length && terminal.nextEventSeq === record.nextEventSeq, '多余事件或游标');
  check(terminal.result === record.result && terminal.tick === record.endTick, '终点结果');
  check(digestContent(terminal) === record.stateHash && digestContent(record.events) === record.eventHash, '内容校验');
  return { terminal, settledMatch: state };
}
/** Internal collection scope: preserves all record checks and never admits a
 * caller-provided proof. The callback owns only states it replayed itself. */
export function replayBattleRecordInSession(record: BattleRecord, restore: (input: unknown) => MatchState,
  proofFor: ReturnType<typeof createPreparationLedgerValidator>['battleProof']): VerifiedReplay {
  validatorFor(record);
  return validateM8Record(record, restore, proofFor);
}
/** Preparation commands may append market choices/resources, never rewrite a settled
 * battle or insert another battle without its replay. All inputs have passed the
 * structural resource fold before reaching this comparison. */
export function checkHistoryCarry(previous: MatchState | null, next: MatchState): void {
  const before = previous ? readG23Progress(previous)!.economyReceipts : [];
  const after = readG23Progress(next)!.economyReceipts;
  check(equalContent(after.slice(0, before.length), before), '历史经济收据前缀不一致');
  check(after.slice(before.length).every(action => action.kind !== 'battle'), '缺少历史证据：未验证的战斗经济收据');
  if (!previous) { validateHistoricalEquipment(null, next); return; }
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
export function* matchHistoryChecks(match: MatchState, battles: readonly BattleRecord[], runId?: string,
  replay: (record: BattleRecord) => VerifiedReplay = replaySnapshot): Generator<void, void, void> {
  check(Array.isArray(battles) && battles.length <= MAX_BATTLE_RECORDS, '战斗数量');
  const results = match.roundResults.filter(result => result.result !== 'supply');
  check(results.length === battles.length, '缺少历史证据：历史缺战或重战');
  let previous: MatchState | null = null;
  for (let i = 0; i < battles.length; i++) {
    const record = battles[i], result = results[i];
    check(record.runId === (runId ?? battles[0].runId), '局身份');
    check(record.context.seed === match.seed, '历史种子');
    check(equalContent(record.context.roundResults, match.roundResults.filter(r => r.round < record.context.round)), '历史结算前缀');
    const verified = replay(record);
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
  for (const _ of matchHistoryChecks(match, battles)) { /* drain */ }
}

/** Restore-only history walk. Every opening is independently tied to the seed
 * ledger before a recorder-owned battle result can advance that same verifier.
 * This is not a public caller-supplied proof or a module-global active session. */
export function validateRestorationHistory(match: MatchState, battles: readonly BattleRecord[]): void {
  check(Array.isArray(battles) && battles.length <= MAX_BATTLE_RECORDS, '战斗数量');
  // External graphs are read once; owned records are already detached and frozen.
  const records = battles.map(record => isOwnedBattleRecord(record) ? record : structuredClone(record));
  const ledger = createPreparationLedgerValidator(true);
  const restore = (input: unknown) => validateMatchStructure(input, ledger);
  const replay = (record: BattleRecord): VerifiedReplay => {
    // Even immutable cached records first prove their entire opening economics
    // from this call's seed/previous verified settlement. Branding is insufficient.
    restore(record.context);
    let verified = isOwnedBattleRecord(record) ? verifiedRecords.get(record) : undefined;
    if (!verified) {
      validatorFor(record);
      verified = validateM8Record(record, restore, ledger.battleProof);
      if (isOwnedBattleRecord(record)) verifiedRecords.set(record, deepFreeze(verified));
    }
    ledger.acceptReplayedBattle(verified.settledMatch);
    return verified;
  };
  for (const _ of matchHistoryChecks(match, records, undefined, replay)) { /* drain all carry checks */ }
  ledger(match);
}
