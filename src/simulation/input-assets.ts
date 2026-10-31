import { isOverflowUnit, usableBenchSlots } from './bench-capacity';
import { isAnvil } from './content/anvils';
import type { GameState } from './game';
import type { Unit } from './unit-types';
import type { ItemInstance } from './strategy-types';
import { DEFAULT_BOARD, contains, isDeploymentCell } from './board';
import { canonicalContent } from './content';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';
import { M5_UNIT_DEFINITIONS, UNIT_DEFINITIONS } from './units';
import { checkEquipmentPlacement } from './equipment-policy';
import { MATCH_RULES } from './match-rules';

/** Both restore boundaries keep their own error contract while sharing the predicates. */
export interface InputValidation {
  requireValue(condition: unknown, message: string): asserts condition;
  integer(value: unknown, min?: number): asserts value is number;
  id(value: unknown): asserts value is string;
  definitionId(value: unknown, catalog: object, label: string): asserts value is string;
  list(value: unknown): asserts value is unknown[];
  record(value: unknown): asserts value is Record<string, unknown>;
  checkSerial(instanceId: string, prefix: string, next: number): void;
}
export function createInputValidation(requireValue: InputValidation['requireValue']): InputValidation {
  function integer(value: unknown, min = 0): asserts value is number { requireValue(Number.isSafeInteger(value) && (value as number) >= min, 'integer'); }
  function id(value: unknown): asserts value is string { requireValue(typeof value === 'string' && value.length > 0, 'ID'); }
  function definitionId(value: unknown, catalog: object, label: string): asserts value is string { id(value); requireValue(Object.hasOwn(catalog, value), label); }
  function list(value: unknown): asserts value is unknown[] { requireValue(Array.isArray(value), 'array'); }
  function record(value: unknown): asserts value is Record<string, unknown> { requireValue(value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype, 'object'); }
  function checkSerial(instanceId: string, prefix: string, next: number): void {
    id(instanceId);
    requireValue(new RegExp(`^${prefix}-[1-9][0-9]*$`).test(instanceId), `${prefix} ID`);
    requireValue(Number(instanceId.slice(prefix.length + 1)) < next, `${prefix} serial`);
  }
  return { requireValue, integer, id, definitionId, list, record, checkSerial };
}
interface InputAssets { readonly preparation: GameState; readonly items: readonly ItemInstance[] }
/** `teamSizeBonus`: permanent crown team size, from the caller's validated G2-3 progress. */
interface AssetBoundary { readonly playerLevel: number; readonly nextUnitSerial: number; readonly nextItemSerial: number; readonly teamSizeBonus?: number }
/** Structural assets only: original combat inputs and current resources remain separate callers.
 * Enemy identities come from the round catalog, never from either candidate's saved projection. */
export function validateInputAssets(
  input: InputAssets, boundary: AssetBoundary, enemies: readonly Unit[], validation: InputValidation,
): Map<string, Unit> {
  const requireValue: InputValidation['requireValue'] = validation.requireValue;
  const integer: InputValidation['integer'] = validation.integer;
  const id: InputValidation['id'] = validation.id;
  const definitionId: InputValidation['definitionId'] = validation.definitionId;
  const list: InputValidation['list'] = validation.list;
  const record: InputValidation['record'] = validation.record;
  const checkSerial: InputValidation['checkSerial'] = validation.checkSerial;
  integer(boundary.playerLevel, 1); integer(boundary.nextUnitSerial, 1); integer(boundary.nextItemSerial, 1);
  requireValue(boundary.playerLevel <= MATCH_RULES.maxLevel, 'level/HP bounds');
  record(input.preparation); record(input.preparation.board); record(input.preparation.board.deploymentZones);
  const { board, benchSize } = input.preparation;
  integer(board.columns, 1); integer(board.rows, 1);
  for (const team of ['player', 'enemy'] as const) { record(board.deploymentZones[team]); integer(board.deploymentZones[team].firstRow); integer(board.deploymentZones[team].lastRow); }
  integer(benchSize, 1); list(input.preparation.units);
  requireValue(canonicalContent(board) === canonicalContent(DEFAULT_BOARD) && benchSize === 9, 'board rules');
  if (input.preparation.usableBenchSlots !== undefined) requireValue(input.preparation.usableBenchSlots === 1, 'usable bench slots');
  if (input.preparation.overflowUnitIds !== undefined) {
    list(input.preparation.overflowUnitIds);
    requireValue(input.preparation.usableBenchSlots === 1 && input.preparation.overflowUnitIds.length <= benchSize - 1
      && new Set(input.preparation.overflowUnitIds).size === input.preparation.overflowUnitIds.length
      && input.preparation.overflowUnitIds.every(id => input.preparation.units.some(u => u.id === id && u.team === 'player' && u.location.kind === 'board')), 'overflow units');
  }
  const units = new Map<string, Unit>(), locations = new Set<string>();
  for (const unit of input.preparation.units) {
    record(unit); id(unit.id); requireValue(!units.has(unit.id), 'duplicate unit'); units.set(unit.id, unit);
    requireValue(!['s13-crab','s13-wolf','s13-mini'].includes(unit.definitionId), 'combat-only anomaly identity');
    requireValue(!isAnvil(unit.definitionId)||(unit.team==='player'&&(unit.location.kind==='bench'||isOverflowUnit(input.preparation,unit.id))&&unit.starLevel===1),'anvil bench unit');
    definitionId(unit.definitionId, unit.team === 'player'&&!UNIT_DEFINITIONS[unit.definitionId]?.summon ? M5_UNIT_DEFINITIONS : UNIT_DEFINITIONS, 'unit definition');
    requireValue(unit.team === 'player' || unit.team === 'enemy', 'team');
    requireValue(([1, 2, 3].includes(unit.starLevel) || unit.definitionId === 'carry-golem' && unit.starLevel === 4), 'star'); record(unit.location);
    if (unit.team === 'player') checkSerial(unit.id, 'unit', boundary.nextUnitSerial);
    if (unit.location.kind === 'bench') { integer(unit.location.slot); requireValue(unit.team === 'player' && unit.location.slot < usableBenchSlots(input.preparation), 'bench location'); }
    else { requireValue(unit.location.kind === 'board', 'location kind'); record(unit.location.cell); integer(unit.location.cell.col); integer(unit.location.cell.row);
      requireValue(contains(board, unit.location.cell) && isDeploymentCell(board, unit.team, unit.location.cell), 'board location'); }
    const key = unit.location.kind === 'bench' ? `bench:${unit.location.slot}` : `board:${unit.location.cell.col}:${unit.location.cell.row}`;
    requireValue(!locations.has(key), 'occupied location'); locations.add(key);
  }
  const byId = (a: Unit, b: Unit): number => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  requireValue(canonicalContent(input.preparation.units.filter(unit => unit.team === 'enemy').sort(byId))
    === canonicalContent([...enemies].sort(byId)), 'enemy roster identity');
  requireValue([...units.values()].filter(unit => unit.team === 'player' && unit.location.kind === 'board' && !isOverflowUnit(input.preparation,unit.id) && (UNIT_DEFINITIONS[unit.definitionId]?.summon?.countsTowardPopulation??true)).length <= boundary.playerLevel + (boundary.teamSizeBonus ?? 0), 'population cap');
  list(input.items); const itemIds = new Set<string>(), equipment = new Set<string>();
  for (const item of input.items) {
    record(item); id(item.id); checkSerial(item.id, 'item', boundary.nextItemSerial);
    requireValue(!itemIds.has(item.id), 'duplicate item'); itemIds.add(item.id);
    definitionId(item.definitionId, ITEM_DEFINITIONS, 'item definition'); record(item.location);
    if (item.location.kind === 'unit') {
      requireValue(units.get(item.location.unitId)?.team === 'player', 'item owner'); integer(item.location.slot);
      requireValue(item.location.slot <= 2, 'equipment slot'); const key = `${item.location.unitId}:${item.location.slot}`;
      requireValue(!equipment.has(key), 'occupied equipment slot'); equipment.add(key);
    } else requireValue(item.location.kind === 'inventory', 'item location');
  }
  for (const item of input.items) if (item.location.kind === 'unit') {
    requireValue(ITEM_DEFINITIONS[item.definitionId].slotCost !== 3 || item.location.slot === 0, 'exclusive parent slot');
    requireValue(checkEquipmentPlacement(input.items, item, item.location.unitId, item.location.slot).allowed, 'equipment constraints');
  }
  return units;
}
