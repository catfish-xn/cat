import { snapshotData } from './snapshot';
import type { BattleRecord, SaveEnvelope, SessionChange } from '../m6/contracts';
import type { MatchState } from '../simulation/match-types';
import type { CombatState, LedgerCombatEvent } from '../simulation/combat-types';
import { validateMatchStructure } from '../simulation/serialization-structure';
import { readG23Progress } from '../simulation/g2-3-state';
import { needsCrownHistory } from '../simulation/crown-history';
import { digestContent } from '../simulation/content';
import { ownBattleRecord as markOwned, deepFreeze, recordVersion, equalContent,
  replayBattleRecord, matchHistoryChecks, validateBattleRecord } from '../simulation/battle-record-validation';
export { isOwnedBattleRecord, deepFreeze, recordVersion, equalContent, checkRecordCompatibility,
  validateBattleRecord, type VerifiedReplay } from '../simulation/battle-record-validation';

function check(value: unknown, message: string): asserts value { if (!value) throw new Error(`战斗档案无效：${message}`); }
export interface ArchiveAdmission { readonly records: readonly BattleRecord[]; readonly quarantined: readonly { readonly runId: string; readonly reason: string }[] }
/** Only archives that route as current M8 files and pass complete history validation enter the replay list;
 * anything else is quarantined whole (never partially listed). */
export function admitArchives(envelopes: readonly unknown[], route: (file: unknown) => { readonly view: unknown; readonly envelope: SaveEnvelope | null }): ArchiveAdmission {
  const records: BattleRecord[] = [], quarantined: { runId: string; reason: string }[] = [];
  for (const file of envelopes) {
    const runId = file && typeof file === 'object' && typeof (file as { runId?: unknown }).runId === 'string' ? (file as { runId: string }).runId : '';
    try {
      const routed = route(file);
      check(routed.view === null && routed.envelope, '归档版本或内容不兼容');
      const envelope = routed.envelope!;
      check(Array.isArray(envelope.battles) && envelope.battles.every(record => record.runId === envelope.runId), '归档局身份');
      validateBattleCollectionSync(envelope);
      records.push(...envelope.battles);
    } catch (error) { quarantined.push({ runId, reason: error instanceof Error ? error.message : String(error) }); }
  }
  return { records, quarantined };
}
/** Strict archive topology and historical context validation; yields once after each battle. */
function* battleCollectionChecks(envelope: SaveEnvelope): Generator<void, void, void> {
  const match = validateMatchStructure(envelope.match);
  yield* matchHistoryChecks(match, envelope.battles, envelope.runId);
  if (match.combat?.status === 'running') {
    check(envelope.currentBattle !== null, '缺少当前事件前缀');
    const record = envelope.currentBattle, verified = replayBattleRecord(record);
    check(record.runId === envelope.runId && record.context.seed === match.seed, '当前局身份或种子');
    check(equalContent(record.context.roundResults, match.roundResults), '当前历史结算前缀');
    check(equalContent(readG23Progress(record.context), readG23Progress(match)), '当前历史经济收据不一致');
    check(record.context.round === match.round && record.result === null, '当前前缀身份');
    check(equalContent(verified.terminal, match.combat), '当前战斗与事件前缀不一致');
    check(equalContent(verified.settledMatch, match), '当前会话与开战上下文不一致');
  } else check(envelope.currentBattle === null, '已结束战斗重复前缀');
}
/** Same checks, yielding to the event loop between battles (import/continue paths). */
export async function validateBattleCollection(envelope: SaveEnvelope): Promise<void> {
  for (const _ of battleCollectionChecks(envelope)) await new Promise<void>(resolve => setTimeout(resolve, 0));
}
/** Same checks without yielding, for the synchronous readCompatibility query. */
export function validateBattleCollectionSync(envelope: SaveEnvelope): void {
  for (const _ of battleCollectionChecks(envelope)) { /* drain */ }
}

interface WorkingRecord { context: MatchState; initial: CombatState; terminal: CombatState; events: LedgerCombatEvent[]; equipmentCommands: NonNullable<BattleRecord['equipmentCommands']>[number][] }
function capture(runId: string, working: WorkingRecord): BattleRecord {
  const { context, initial, terminal, events, equipmentCommands } = working;
  // Context, initial state and individual events are already owned and deeply frozen.
  // Snapshot the growing arrays; combat hashes cover state/events, while commands
  // are validated through production replay and strict resource-prefix comparison.
  return markOwned(Object.freeze({ version: Object.freeze(recordVersion(context)), roundId: context.m8.round.roundId, runId, combatId: terminal.combatId!, context, initial, equipmentCommands: Object.freeze([...equipmentCommands]), events: Object.freeze([...events]),
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
      terminal: validateBattleRecord(owned, needsCrownHistory(owned.context) ? this.completed : undefined).terminal, events: [...owned.events], equipmentCommands: [...(owned.equipmentCommands ?? [])] } : null;
  }
  get completedRecords(): readonly BattleRecord[] { return Object.freeze([...this.completed]); }
  capturePrefix(): BattleRecord | null { return this.current ? capture(this.runId, this.current) : null; }
  observe(change: SessionChange): void {
    const combat = change.after.combat;
    if (!combat) return;
    if (!change.before.combat && combat) {
      const initial = deepFreeze(snapshotData(combat));
      this.current = { context: deepFreeze(snapshotData(change.before)), initial, terminal: initial,
        equipmentCommands: [], events: change.events.map(event => deepFreeze(snapshotData(event))) };
    } else if (this.current && combat.combatId === this.current.terminal.combatId) {
      if (change.before.phase === 'combat') {
        for (const fact of change.after.resourceProvenance.entries.slice(change.before.resourceProvenance.entries.length)) {
          if (fact.kind === 'item-equipped') this.current.equipmentCommands.push(Object.freeze({
            tick: change.before.combat!.tick, itemId: fact.itemId, unitId: fact.unitId, slot: fact.slot,
          }));
          else if (fact.kind === 'item-combined') {
            // In-place equip consumes the incoming inventory component. Replay
            // that input, not the newly allocated completed item's identity.
            const incoming = change.before.items.find(item => fact.event.consumedIds.includes(item.id)
              && item.location.kind === 'inventory');
            const combined = change.after.items.find(item => item.id === fact.event.itemId);
            if (incoming && combined?.location.kind === 'unit') this.current.equipmentCommands.push(Object.freeze({
              tick: change.before.combat!.tick, itemId: incoming.id,
              unitId: combined.location.unitId, slot: combined.location.slot,
            }));
            else if (combined?.location.kind === 'inventory') this.current.equipmentCommands.push(Object.freeze({
              tick: change.before.combat!.tick,
              consumedIds: Object.freeze([fact.event.consumedIds[0], fact.event.consumedIds[1]] as const),
            }));
          }
        }
      }
      this.current.terminal = snapshotData(combat);
      this.current.events.push(...change.events.map(event => deepFreeze(snapshotData(event))));
    }
    if (combat.status === 'finished' && this.current) {
      if (!this.completed.some(record => record.combatId === combat.combatId)) this.completed.push(capture(this.runId, this.current));
      this.current = null;
    }
  }
}
