import type { BattleRecord, SaveEnvelope, SessionChange } from '../m6/contracts';
import { MAX_BATTLE_RECORDS, MAX_EVENTS_PER_BATTLE } from '../m6/limits';
import { startMatchCombat, stepMatch } from '../simulation/match';
import type { MatchState } from '../simulation/match-types';
import type { CombatState, CombatEvent } from '../simulation/combat-types';
import { MAX_COMBAT_TICKS } from '../simulation/combat-types';
import { restoreMatch } from '../simulation/serialization';
import { canonicalContent, digestContent } from '../simulation/content';

// Only this recorder can establish detached, deeply immutable record ownership.
// Weak branding never keeps an old battle alive and cannot be forged by freezing input.
const ownedBattleRecords = new WeakSet<object>();
export function isOwnedBattleRecord(value: unknown): value is BattleRecord {
  return value !== null && typeof value === 'object' && ownedBattleRecords.has(value);
}
function markOwned(record: BattleRecord): BattleRecord {
  ownedBattleRecords.add(record); return record;
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(`战斗档案无效：${message}`); }
export function equalContent(a: unknown, b: unknown): boolean { return canonicalContent(a) === canonicalContent(b); }
const keys = ['runId','combatId','context','initial','events','endTick','nextEventSeq','result','stateHash','eventHash'].sort();
function checkShape(record: BattleRecord) {
  check(record && typeof record === 'object' && !Array.isArray(record), '记录类型');
  check(equalContent(Object.keys(record).sort(), keys), '记录字段');
  check(typeof record.runId === 'string' && record.runId.length > 0 && typeof record.combatId === 'string', '身份');
  check(Number.isSafeInteger(record.endTick) && record.endTick >= 0 && record.endTick <= MAX_COMBAT_TICKS, '终点');
  check(Array.isArray(record.events) && record.events.length <= MAX_EVENTS_PER_BATTLE, '事件边界');
  check(record.nextEventSeq === record.events.length, '事件游标');
  check([null,'playerWin','enemyWin','draw'].includes(record.result), '结果');
  check(typeof record.stateHash === 'string' && typeof record.eventHash === 'string', '校验值');
  let lastTick = 0;
  for (let i = 0; i < record.events.length; i++) {
    const event = record.events[i];
    check(event && event.domain === 'combat' && event.combatId === record.combatId && event.eventSeq === i, '事件身份或序号');
    check(Number.isSafeInteger(event.tick) && event.tick >= lastTick && event.tick <= record.endTick, '事件tick');
    lastTick = event.tick;
  }
}
export interface VerifiedReplay { readonly terminal: CombatState; readonly settledMatch: MatchState }
/** Full deterministic validation; never reads an active session. */
export function validateBattleRecord(record: BattleRecord): VerifiedReplay {
  checkShape(record);
  let state = restoreMatch(record.context);
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
  while (state.combat!.tick < record.endTick) {
    check(state.phase === 'combat', '终点超过战斗结束');
    const step = stepMatch(state); state = step.state; compare(step.events);
  }
  const terminal = state.combat!;
  check(cursor === record.events.length && terminal.nextEventSeq === record.nextEventSeq, '多余事件或游标');
  check(terminal.result === record.result && terminal.tick === record.endTick, '终点结果');
  check(digestContent(terminal) === record.stateHash && digestContent(record.events) === record.eventHash, '内容校验');
  return { terminal, settledMatch: state };
}
/** Strict archive topology and historical context validation. Yields between battles. */
export async function validateBattleCollection(envelope: SaveEnvelope): Promise<void> {
  const match = restoreMatch(envelope.match);
  check(Array.isArray(envelope.battles) && envelope.battles.length <= MAX_BATTLE_RECORDS, '战斗数量');
  const results = match.roundResults.filter(result => result.result !== 'supply');
  check(results.length === envelope.battles.length, '历史缺战或重战');
  const inspect = (record: BattleRecord) => {
    check(record.runId === envelope.runId, '局身份');
    check(record.context.seed === match.seed, '历史种子');
    check(equalContent(record.context.roundResults, match.roundResults.filter(r => r.round < record.context.round)), '历史结算前缀');
    return validateBattleRecord(record);
  };
  for (let i = 0; i < envelope.battles.length; i++) {
    const record = envelope.battles[i], result = results[i];
    const verified = inspect(record);
    check(record.context.round === result.round && record.result !== null && verified.terminal.status === 'finished', '历史身份或完成状态');
    check(equalContent(verified.settledMatch.roundResults.at(-1), result), '历史结算结果');
    if (match.combat?.status === 'finished' && match.combat.combatId === record.combatId) check(equalContent(verified.terminal, match.combat), '当前终战状态');
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  if (match.combat?.status === 'running') {
    check(envelope.currentBattle !== null, '缺少当前事件前缀');
    const record = envelope.currentBattle, verified = inspect(record);
    check(record.context.round === match.round && record.result === null, '当前前缀身份');
    check(equalContent(verified.terminal, match.combat), '当前战斗与事件前缀不一致');
    check(equalContent(verified.settledMatch, match), '当前会话与开战上下文不一致');
  } else check(envelope.currentBattle === null, '已结束战斗重复前缀');
}

interface WorkingRecord { context: MatchState; initial: CombatState; terminal: CombatState; events: CombatEvent[] }
function capture(runId: string, working: WorkingRecord): BattleRecord {
  const { context, initial, terminal, events } = working;
  // Context, initial state and individual events are already owned and deeply frozen.
  // Only the growing array needs a new snapshot; hashes still cover the complete payload.
  return markOwned(Object.freeze({ runId, combatId: terminal.combatId!, context, initial, events: Object.freeze([...events]),
    endTick: terminal.tick, nextEventSeq: terminal.nextEventSeq!, result: terminal.result,
    stateHash: digestContent(terminal), eventHash: digestContent(events) }));
}
/** Observes already committed steps; never advances or settles the active match. */
export class BattleHistory {
  private completed: BattleRecord[];
  private current: WorkingRecord | null;
  constructor(readonly runId: string, battles: readonly BattleRecord[] = [], currentBattle: BattleRecord | null = null) {
    this.completed = battles.map(record => markOwned(deepFreeze(structuredClone(record))));
    const owned = currentBattle ? markOwned(deepFreeze(structuredClone(currentBattle))) : null;
    this.current = owned ? { context: owned.context, initial: owned.initial,
      terminal: validateBattleRecord(owned).terminal, events: [...owned.events] } : null;
  }
  get completedRecords(): readonly BattleRecord[] { return Object.freeze([...this.completed]); }
  capturePrefix(): BattleRecord | null { return this.current ? capture(this.runId, this.current) : null; }
  observe(change: SessionChange): void {
    const combat = change.after.combat;
    if (!combat) return;
    if (!change.before.combat && combat) {
      const initial = deepFreeze(structuredClone(combat));
      this.current = { context: deepFreeze(structuredClone(change.before)), initial, terminal: initial,
        events: change.events.map(event => deepFreeze(structuredClone(event))) };
    } else if (this.current && combat.combatId === this.current.terminal.combatId) {
      this.current.terminal = structuredClone(combat);
      this.current.events.push(...change.events.map(event => deepFreeze(structuredClone(event))));
    }
    if (combat.status === 'finished' && this.current) {
      if (!this.completed.some(record => record.combatId === combat.combatId)) this.completed.push(capture(this.runId, this.current));
      this.current = null;
    }
  }
}
