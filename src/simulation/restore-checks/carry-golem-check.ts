// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { CARRY_GOLEM_SOURCE, receiptId } from '../augment-pool-batch5-g6';
import { carryGolemStar } from '../augment-pool-batch5-g6-stats';
import { DEFAULT_BOARD, isDeploymentCell, sameCell } from '../board';
import { CARRY_GOLEM, CARRY_GOLEM_ID } from '../content/augment-pool-batch5-g6';
import { canonicalContent } from '../content/index';
import type { MatchState } from '../match-types';
import { getMultiplayerRoundById, getMultiplayerRoundByOrdinal } from '../multiplayer-round';
import { restartMissionRemovedUnit } from '../restart-mission';

/** Applies at both offline and shared restore boundaries, including orphaned receipt/unit attempts. */
export function validateCarryGolem(state: MatchState): void {
  const fail = (): never => { throw new RangeError('Invalid carry golem authority'); };
  const owner = state.augments.find(a => a.definitionId === 'im-the-carry-now');
  const receipts = state.seatMechanics?.receipts.filter(r => r.source === CARRY_GOLEM_SOURCE || r.receiptId.startsWith(`["${CARRY_GOLEM_SOURCE}",`)) ?? [];
  const units = state.preparation.units.filter(u => u.definitionId === CARRY_GOLEM_ID);
  if (!owner) { if (receipts.length || units.length) fail(); return; }
  if (receipts.length !== 4) fail();
  const birth = receipts.find(r => r.receiptId === receiptId(owner, 'unit'));
  if (!birth || birth.kind !== 'unit' || birth.resolution !== 'held' || !birth.unitId || birth.gold !== 0
    || birth.definitionId !== CARRY_GOLEM_ID || (birth.starLevel ?? 1) !== 1 || birth.orbId !== undefined) return fail();
  const unitId=birth.unitId,retired=restartMissionRemovedUnit(state,unitId),unit=units[0];
  if (retired) {
    if (units.length!==0 || retired.definitionId!==CARRY_GOLEM_ID
      || retired.starLevel!==carryGolemStar(getMultiplayerRoundById(retired.roundId).ordinal,owner.acquiredRound)) fail();
  } else {
    if (units.length!==1 || unit.id!==unitId || unit.team!=='player' || unit.location.kind!=='board'
      || unit.starLevel!==carryGolemStar(state.round,owner.acquiredRound)) fail();
    if (unit.location.kind !== 'board' || !unit.location.cell || !isDeploymentCell(DEFAULT_BOARD, 'player', unit.location.cell)
    || state.preparation.units.some(other => other !== unit && other.location.kind === 'board'
      && unit.location.kind === 'board' && sameCell(other.location.cell, unit.location.cell))) fail();
  }
  for (const r of receipts) if (r.source !== CARRY_GOLEM_SOURCE || r.round !== owner.acquiredRound
    || r.roundId !== getMultiplayerRoundByOrdinal(owner.acquiredRound).roundId) fail();
  for (const [slot, definitionId] of CARRY_GOLEM.items.entries()) {
    const r = receipts.find(r => r.receiptId === receiptId(owner, `item:${slot}`));
    if (!r || r.kind !== 'item' || r.definitionId !== definitionId) fail();
    if (!retired && r?.kind==='item' && !state.items.some(i => i.id === r.itemId
      && i.definitionId === definitionId && i.location.kind === 'unit' && i.location.unitId === unitId && i.location.slot === slot)) fail();
  }
  if (state.items.filter(i => i.location.kind === 'unit' && i.location.unitId === unitId).length !== (retired?0:3)) fail();
  // Replay allocation counts from the resource prefix, never from item IDs, receipts or nextItemSerial.
  // Acquisitions, combinations and replacement consumable outputs are the only permanent item births.
  let itemSerial = 1;
  for (const entry of state.resourceProvenance.entries) {
    const allocated = entry.kind === 'item-acquired' ? [entry.itemId]
      : entry.kind === 'item-combined' ? [entry.event.itemId]
      : entry.kind === 'consumable-used' ? entry.record.outputs.filter((output, index) => output.id !== entry.record.affectedItems[index]?.id).map(output => output.id) : [];
    for (const itemId of allocated) if (itemId !== `item-${itemSerial++}`) fail();
  }
  if (state.nextItemSerial !== itemSerial) fail();
  // The fixed grant has seven ordered resource facts. Receipts alone cannot replace birth/equipment evidence.
  const start = state.resourceProvenance.entries.findIndex(e => e.kind === 'unit-acquired' && e.unitId === unitId);
  if (unitId !== `unit-${1 + state.resourceProvenance.entries.slice(0, start).filter(e => e.kind === 'unit-acquired').length}`) fail();
  const facts: import('../resource-provenance').ResourceFact[] = [
    { kind: 'unit-acquired', unitId, source: { kind: 'mechanic', receiptId: receiptId(owner, 'unit') } },
  ];
  for (const [slot] of CARRY_GOLEM.items.entries()) {
    const r = receipts.find(r => r.receiptId === receiptId(owner, `item:${slot}`));
    if (!r || r.kind !== 'item') return fail();
    facts.push({ kind: 'item-acquired', itemId: r.itemId, source: { kind: 'mechanic', receiptId: r.receiptId } },
      { kind: 'item-equipped', itemId: r.itemId, unitId, slot });
  }
  for (const [offset, fact] of facts.entries()) {
    const actual = state.resourceProvenance.entries[start + offset];
    if (start < 0 || !actual || canonicalContent(actual) !== canonicalContent({ ...fact, sequence: start + offset, roundId: birth!.roundId })) fail();
  }
}
