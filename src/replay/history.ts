import { snapshotData } from './snapshot';
import type { BattleRecord, SaveEnvelope, SessionChange } from '../m6/contracts';
import type { MatchState } from '../simulation/match-types';
import type { CombatState, LedgerCombatEvent } from '../simulation/combat-types';
import { validateMatchStructure } from '../simulation/serialization-structure';
import { readG23Progress } from '../simulation/g2-3-state';
import { needsCrownHistory } from '../simulation/crown-history';
import { canonicalContent, digestContent } from '../simulation/content';
import { ownBattleRecord as markOwned, deepFreeze, recordVersion, equalContent, isOwnedBattleRecord,
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

interface WorkingRecord {
  context: MatchState; initial: CombatState; terminal: CombatState; events: LedgerCombatEvent[];
  equipmentCommands: NonNullable<BattleRecord['equipmentCommands']>[number][];
  hashes?: { state: string; events: string };
  // Only this recorder appends to the detached, deeply frozen event ledger.
  eventHashPrefix?: { count: number; hash: number };
}
function captureEventHash(working: WorkingRecord): string {
  // Keep the FNV state before the closing bracket so the next capture only
  // encodes newly appended events. This is exactly digestContent(events).
  const prefix = working.eventHashPrefix ??= { count: 0, hash: Math.imul(0x811c9dc5 ^ 91, 0x01000193) >>> 0 };
  const append = (text: string) => {
    for (let i = 0; i < text.length; i++) prefix.hash = Math.imul(prefix.hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  };
  while (prefix.count < working.events.length) {
    if (prefix.count > 0) append(',');
    append(canonicalContent(working.events[prefix.count]));
    prefix.count++;
  }
  const hash = Math.imul(prefix.hash ^ 93, 0x01000193) >>> 0;
  return `fnv1a32-utf16:${hash.toString(16).padStart(8, '0')}`;
}
function capture(runId: string, working: WorkingRecord): BattleRecord {
  const { context, initial, terminal, events, equipmentCommands } = working;
  // This recorder owns every input. A restored prefix's two hashes have already
  // been verified by validateBattleRecord. Normal observation invalidates both;
  // repeated capture of an unchanged private prefix need not hash it again.
  const hashes = working.hashes ??= { state: digestContent(terminal), events: captureEventHash(working) };
  // Context, initial state and individual events are already owned and deeply frozen.
  // Snapshot the growing arrays; combat hashes cover state/events, while commands
  // are validated through production replay and strict resource-prefix comparison.
  return markOwned(Object.freeze({ version: Object.freeze(recordVersion(context)), roundId: context.m8.round.roundId, runId, combatId: terminal.combatId!, context, initial,
    // Omitted when empty so records without combat equipment commands keep the earlier shape.
    ...(equipmentCommands.length ? { equipmentCommands: Object.freeze([...equipmentCommands]) } : {}), events: Object.freeze([...events]),
    endTick: terminal.tick, nextEventSeq: terminal.nextEventSeq!, result: terminal.result,
    stateHash: hashes.state, eventHash: hashes.events }));
}
/** Observes already committed steps; never advances or settles the active match. */
export class BattleHistory {
  private completed: BattleRecord[];
  private current: WorkingRecord | null;
  constructor(readonly runId: string, battles: readonly BattleRecord[] = [], currentBattle: BattleRecord | null = null) {
    // Recorder-owned records are already detached and deeply immutable; sharing them keeps their verified replay.
    const own = (record: BattleRecord) => isOwnedBattleRecord(record) ? record : markOwned(deepFreeze(structuredClone(record)));
    this.completed = battles.map(own);
    const owned = currentBattle ? own(currentBattle) : null;
    this.current = owned ? { context: owned.context, initial: owned.initial,
      terminal: validateBattleRecord(owned, needsCrownHistory(owned.context) ? this.completed : undefined).terminal,
      events: [...owned.events], equipmentCommands: [...(owned.equipmentCommands ?? [])],
      hashes: { state: owned.stateHash, events: owned.eventHash } } : null;
    // Full validation above remains mandatory. Build the append cursor during
    // restore so the next capture does not re-encode the verified old ledger.
    if (this.current) captureEventHash(this.current);
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
      this.current.hashes = undefined;
      if (change.before.phase === 'combat') {
        for (const fact of change.after.resourceProvenance.entries.slice(change.before.resourceProvenance.entries.length)) {
          if (fact.kind === 'item-equipped') this.current.equipmentCommands.push(Object.freeze({
            tick: change.before.combat!.tick, itemId: fact.itemId, unitId: fact.unitId, slot: fact.slot,
          }));
          else if (fact.kind === 'consumable-used') this.current.equipmentCommands.push(deepFreeze({
            tick: change.before.combat!.tick, consumableId: fact.record.consumableId, target: snapshotData(fact.record.target),
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
