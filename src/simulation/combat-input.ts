import type { MatchBase, PersistentGrowth, RoundResult } from './match-types';
import type { Unit } from './unit-types';
import type { ItemInstance, ScheduleReceipt } from './strategy-types';
import type { EquipmentRoundRoll } from './m8/contracts';
import { canonicalContent } from './content';
import { freezeContent } from './content/freeze';
import { DEFAULT_BOARD, contains, isDeploymentCell } from './board';
import { ROUND_CATALOG } from './content/round-catalog';
import { M5_UNIT_DEFINITIONS } from './units';
import { ITEM_DEFINITIONS } from './content/items';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { ANOMALY_DEFINITIONS } from './content/anomalies';
import { readRoundEnemyProjection } from './round-enemies';
import { checkEquipmentPlacement } from './equipment-policy';
import { grantsTemporaryEquipment } from './temporary-equipment';
import { projectTemporaryEquipment } from './m8/equipment';
import { nextRandom, validateSeed } from './rng';

export const COMBAT_INPUT_VERSION = 'm8-b8-combat-input-v1';
/** Exactly the inputs consumed by the single strategy compiler; never its answer. */
export type CombatStrategyInputs = Pick<MatchBase, 'round' | 'preparation' | 'items' | 'temporaryEquipment'
  | 'augments' | 'anomalyBinding' | 'persistentGrowth' | 'augmentProgress'>;
export interface CombatInputBasis {
  readonly version: typeof COMBAT_INPUT_VERSION;
  readonly combatId: string; readonly roundId: string; readonly contentDigest: string;
  readonly battleSeed: number; readonly playerLevel: number;
  readonly nextUnitSerial: number; readonly nextItemSerial: number;
  readonly equipmentRollPrefixLength: number; readonly provenancePrefixLength: number;
  readonly inputs: CombatStrategyInputs;
}
/** Produced by the independently validated resource prefix, not candidate basis data. */
export interface CombatResourcePrefix {
  readonly units: readonly Pick<Unit, 'id' | 'definitionId' | 'starLevel'>[];
  readonly items: readonly Pick<ItemInstance, 'id' | 'definitionId'>[];
  readonly persistentGrowth: readonly PersistentGrowth[];
  readonly nextUnitSerial: number; readonly nextItemSerial: number;
}
export interface CombatInputAuthority {
  readonly seed: number; readonly round: number; readonly contentDigest: string;
  readonly playerLevel: number; readonly provenancePrefixLength: number;
  readonly resources: CombatResourcePrefix;
  readonly equipmentRolls: readonly EquipmentRoundRoll[];
  readonly equipmentRollPrefixLength: number;
  readonly scheduleReceipts: readonly ScheduleReceipt[];
  readonly roundResults: readonly RoundResult[];
}
export function readCombatStrategyInputs(state: CombatStrategyInputs): CombatStrategyInputs {
  const { round, preparation, items, temporaryEquipment, augments, anomalyBinding, persistentGrowth, augmentProgress } = state;
  return { round, preparation, items, temporaryEquipment, augments, anomalyBinding, persistentGrowth, augmentProgress };
}
/** Called once at successful Start, before Combat or any settlement can mutate resources. */
export function freezeCombatInput(state: MatchBase, battleSeed: number, provenancePrefixLength: number): CombatInputBasis {
  return freezeContent(structuredClone({ version: COMBAT_INPUT_VERSION, combatId: `round-${state.round}`,
    roundId: state.roundDefinitionId, contentDigest: state.contentDigest, battleSeed, playerLevel: state.level,
    nextUnitSerial: state.nextUnitSerial, nextItemSerial: state.nextItemSerial,
    equipmentRollPrefixLength: state.equipmentState.rolls.length, provenancePrefixLength,
    inputs: readCombatStrategyInputs(state) }));
}
const equal = (a: unknown, b: unknown): boolean => canonicalContent(a) === canonicalContent(b);
function requireBasis(condition: unknown): asserts condition { if (!condition) throw new RangeError('Invalid combat input basis'); }
function integer(value: unknown, min = 0): asserts value is number { requireBasis(Number.isSafeInteger(value) && (value as number) >= min); }
function record(value: unknown): void {
  requireBasis(value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype);
}
const sorted = <T extends { readonly id: string }>(values: readonly T[]): T[] => [...values].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
/** Pure own-format validation. Caller first validates history, receipts and the provenance prefix.
 * No combat creation, RNG mutation, inventory grant, or replacement of saved values. */
export function restoreCombatInput(value: unknown, authority: CombatInputAuthority): CombatInputBasis {
  canonicalContent(value); record(value);
  const basis = value as unknown as CombatInputBasis, input = basis.inputs; record(input);
  const round = ROUND_CATALOG.find(entry => entry.ordinal === authority.round);
  requireBasis(round && round.kind !== 'supply' && basis.version === COMBAT_INPUT_VERSION
    && basis.combatId === `round-${authority.round}` && basis.roundId === round.roundId
    && basis.contentDigest === authority.contentDigest && input.round === authority.round);
  validateSeed(authority.seed); validateSeed(basis.battleSeed);
  let battleSeed = (authority.seed ^ 0x9e3779b9) >>> 0;
  for (const entry of ROUND_CATALOG) {
    if (entry.ordinal > authority.round) break;
    if (entry.kind !== 'supply') battleSeed = nextRandom(battleSeed).word;
  }
  requireBasis(basis.battleSeed === battleSeed);
  for (const key of ['nextUnitSerial','nextItemSerial','playerLevel'] as const) integer(basis[key], 1);
  integer(basis.provenancePrefixLength); integer(basis.equipmentRollPrefixLength);
  requireBasis(basis.playerLevel === authority.playerLevel && basis.playerLevel <= 9
    && basis.provenancePrefixLength === authority.provenancePrefixLength
    && basis.equipmentRollPrefixLength === authority.equipmentRollPrefixLength
    && basis.equipmentRollPrefixLength <= authority.equipmentRolls.length
    && basis.nextUnitSerial === authority.resources.nextUnitSerial && basis.nextItemSerial === authority.resources.nextItemSerial);
  record(input.preparation); requireBasis(equal(input.preparation.board, DEFAULT_BOARD)
    && input.preparation.benchSize === 9 && Array.isArray(input.preparation.units));
  const units = new Map<string, Unit>(), places = new Set<string>();
  for (const unit of input.preparation.units) {
    record(unit); record(unit.location); requireBasis(typeof unit.id === 'string' && !units.has(unit.id));
    units.set(unit.id, unit); requireBasis(unit.team === 'player' || unit.team === 'enemy');
    requireBasis([1,2,3].includes(unit.starLevel));
    if (unit.team === 'player') requireBasis(Object.hasOwn(M5_UNIT_DEFINITIONS, unit.definitionId));
    if (unit.location.kind === 'bench') {
      integer(unit.location.slot); requireBasis(unit.team === 'player' && unit.location.slot < 9);
    } else {
      requireBasis(unit.location.kind === 'board'); record(unit.location.cell);
      integer(unit.location.cell.col); integer(unit.location.cell.row);
      requireBasis(contains(input.preparation.board, unit.location.cell)
        && isDeploymentCell(input.preparation.board, unit.team, unit.location.cell));
    }
    const place = unit.location.kind === 'bench' ? `bench:${unit.location.slot}` : `board:${unit.location.cell.col}:${unit.location.cell.row}`;
    requireBasis(!places.has(place)); places.add(place);
  }
  const players = input.preparation.units.filter(unit => unit.team === 'player');
  requireBasis(players.filter(unit => unit.location.kind === 'board').length <= basis.playerLevel);
  requireBasis(equal(sorted(players.map(({id,definitionId,starLevel}) => ({id,definitionId,starLevel}))), sorted(authority.resources.units)));
  requireBasis(equal(sorted(input.preparation.units.filter(unit => unit.team === 'enemy')), sorted(readRoundEnemyProjection(authority.round).units)));
  requireBasis(Array.isArray(input.items));
  requireBasis(equal(sorted(input.items.map(({id,definitionId}) => ({id,definitionId}))), sorted(authority.resources.items)));
  const itemIds = new Set<string>();
  for (const item of input.items) {
    record(item); record(item.location); requireBasis(!itemIds.has(item.id) && Object.hasOwn(ITEM_DEFINITIONS, item.definitionId)); itemIds.add(item.id);
    if (item.location.kind === 'unit') {
      integer(item.location.slot); requireBasis(item.location.slot <= 2 && units.get(item.location.unitId)?.team === 'player'
        && (ITEM_DEFINITIONS[item.definitionId].slotCost !== 3 || item.location.slot === 0)
        && checkEquipmentPlacement(input.items, item, item.location.unitId, item.location.slot).allowed);
    } else requireBasis(item.location.kind === 'inventory');
  }
  requireBasis(Array.isArray(input.augments) && input.augments.length <= 3);
  const receipts = authority.scheduleReceipts.filter(receipt => receipt.round <= authority.round);
  const expectedAugments = receipts.filter(receipt => receipt.kind === 'augment').map(receipt => ({definitionId:receipt.definitionId,choiceId:receipt.eventId,acquiredRound:receipt.round}));
  requireBasis(equal(input.augments, expectedAugments) && new Set(input.augments.map(augment => augment.definitionId)).size === input.augments.length);
  for (const augment of input.augments) requireBasis(Object.hasOwn(AUGMENT_DEFINITIONS, augment.definitionId));
  if (input.anomalyBinding !== null) {
    record(input.anomalyBinding); const binding = input.anomalyBinding;
    requireBasis(Object.hasOwn(ANOMALY_DEFINITIONS, binding.definitionId) && units.get(binding.unitId)?.team === 'player'
      && receipts.some(receipt => receipt.kind === 'anomaly' && receipt.eventId === binding.choiceId
        && receipt.definitionId === binding.definitionId && receipt.round === binding.boundRound));
  }
  requireBasis(Array.isArray(input.persistentGrowth) && equal(input.persistentGrowth, authority.resources.persistentGrowth));
  const growthIds = new Set<string>();
  for (const growth of input.persistentGrowth) {
    record(growth); integer(growth.attackDamageBps,1);
    requireBasis(units.get(growth.unitId)?.definitionId === 'tristana' && growth.attackDamageBps % 125 === 0 && !growthIds.has(growth.unitId)); growthIds.add(growth.unitId);
  }
  const history = authority.roundResults.filter(result => result.round < authority.round);
  const pump = input.augments.find(augment => augment.definitionId === 'pumping-up-i');
  const investment = input.augments.find(augment => augment.definitionId === 'investment-strategy-i');
  requireBasis(equal(input.augmentProgress, {
    pumpingRounds: pump ? history.filter(result => result.round >= pump.acquiredRound).length : 0,
    investmentHp: investment ? history.filter(result => result.round >= investment.acquiredRound).reduce((sum,result) => sum + result.incomeBreakdown.interest * 8,0) : 0,
  }));
  const rolls = authority.equipmentRolls.slice(0, basis.equipmentRollPrefixLength);
  const expectedChildren = sorted(input.items).filter(item => item.location.kind === 'unit' && grantsTemporaryEquipment(ITEM_DEFINITIONS[item.definitionId])).flatMap(item => {
    requireBasis(item.location.kind === 'unit');
    const roll = rolls.find(entry => entry.parentItemInstanceId === item.id && entry.roundId === basis.roundId);
    requireBasis(roll && roll.playerLevelSnapshot <= basis.playerLevel);
    return projectTemporaryEquipment(roll, item.location.unitId);
  });
  requireBasis(equal(input.temporaryEquipment, expectedChildren));
  return freezeContent(structuredClone(basis));
}
