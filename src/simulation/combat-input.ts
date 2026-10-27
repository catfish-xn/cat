import { portableAnomalyId } from './content/augment-pool-batch5-r2';
import { r2FrozenCopyKills, type AugmentCopyKills } from './augment-pool-batch5-r2-history';
import { equipmentRollFor } from './augment-pool-batch5-g1-equipment';
import { ghostFriendsGrowth } from './augment-pool-batch5-g2';
import { combatHistoryGrowth } from './augment-pool-batch5-h3';
import { scoreboardCombatGrowth } from './augment-pool-batch5-h6-scoreboard';
import { maximumPlayerHp } from './augment-pool-batch5-h7-health';
import { readSniperOpening } from './augment-pool-batch5-h10-sniper';
import { readCabalGrowth, type CabalGrowth } from './augment-pool-batch5-h9-cabal';
import { createOpeningEncounter } from './opening-encounter';
import { d14Certificate, type D14CombatCertificate } from './d14-runtime';
import { investmentGrowth } from './augment-income';
import {readItemSummonPositions,validateItemSummonPositions} from './g2-4b-voidspawn';
import {readG23Progress} from './g2-3-state';
import { crownTeamSizeBonus } from './deployment-cap';
import {validateG23Progress} from './g2-3-match-progress';
import { shareGeneratedJson } from './immutable-json';
import type { MatchBase, PersistentGrowth, RoundResult } from './match-types';
import type { Unit } from './unit-types';
import type { ItemInstance, ScheduleReceipt } from './strategy-types';
import type { EquipmentRoundRoll } from './m8/contracts';
import { canonicalContent, equalValidatedContent } from './content';
import { freezeContent } from './content/freeze';
import { createInputValidation, validateInputAssets, type InputValidation } from './input-assets';
import { ROUND_CATALOG } from './content/round-catalog';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { ANOMALY_DEFINITIONS } from './content/anomalies';
import { readRoundEnemyProjection } from './round-enemies';
import { grantsTemporaryEquipment } from './temporary-equipment';
import { projectTemporaryEquipment } from './m8/equipment';
import { nextRandom, validateSeed } from './rng';

export const COMBAT_INPUT_VERSION = 'm8-b8-combat-input-v1';
/** Exactly the inputs consumed by the single strategy compiler; never its answer. */
export type CombatStrategyInputs = Pick<MatchBase, 'round' | 'preparation' | 'items' | 'temporaryEquipment'
  | 'augments' | 'anomalyBinding' | 'persistentGrowth' | 'augmentProgress' > & {readonly g23?:import('./g2-3-match-progress').G23MatchProgress;readonly visibleExperimentCells?:readonly import('./board').HexCell[]} & { readonly roundResults?: readonly RoundResult[]; readonly playerHp?: number }
  /** Online two-sided only: the frozen snapshot's priorPvpWins; solo inputs never set it and read roundResults. */
  & { readonly ghostFriendsGrowth?: import('./augment-pool-batch5-g2').GhostFriendsGrowth; readonly augmentCopyKills?:readonly AugmentCopyKills[]; readonly augmentHistoryGrowth?: readonly import('./augment-history-types').AugmentGrowth[] }
  & { readonly cabalGrowth?: CabalGrowth; readonly h6Growth?:readonly import('./augment-history-types').AugmentGrowth[]; readonly sniperOpening?: Readonly<Record<string, number>>; readonly d14Combat?:D14CombatCertificate; readonly priorPvpWins?: number; readonly bankGold?:number; readonly itemSummonPositions?:import('./g2-4b-voidspawn').ItemSummonPositions };
export interface CombatInputBasis {
  readonly mechanicReceiptPrefixLength:number;
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
    /** Authenticated shared encounter and externally settled PvP rounds do not use the seat's PvE RNG. */
  readonly shared?: { readonly openingId: import('./opening-encounter').OpeningEncounterId | null; readonly twoSidedRounds: readonly number[] };
  readonly augmentCopyKills?:readonly AugmentCopyKills[]; readonly augmentHistoryGrowth?: readonly import('./augment-history-types').AugmentGrowth[];
  readonly ghostFriendsGrowth?: import('./augment-pool-batch5-g2').GhostFriendsGrowth;
  readonly h6Growth?:readonly import('./augment-history-types').AugmentGrowth[];
  readonly sniperOpening?: Readonly<Record<string, number>>;
  readonly cabalGrowth?: CabalGrowth;
  readonly d14Combat?:D14CombatCertificate;
  readonly heldUnitIds?:readonly string[];readonly heldItemIds?:readonly string[];
  readonly epicCrownsBeforeCombat?:NonNullable<import('./g2-3-match-progress').G23MatchProgress['epicCrowns']>;
  readonly itemSummonPositions?:import('./g2-4b-voidspawn').ItemSummonPositions;
  readonly bankGold?:number;
  /** Batch-3 Dummify/Golemify totals, recomputed by the caller from authenticated provenance. */
  readonly forming?:import('./augment-pool-batch3-progress').FormingTotals;
  readonly magicRoll?:readonly [number,number,number];
  readonly g23?:import('./g2-3-match-progress').G23MatchProgress;readonly playerHp?:number;
  readonly seed: number; readonly round: number; readonly contentDigest: string;
  readonly playerLevel: number; readonly provenancePrefixLength: number;
  readonly resources: CombatResourcePrefix;
  readonly equipmentRolls: readonly EquipmentRoundRoll[];
  readonly equipmentRollPrefixLength: number;
  readonly scheduleReceipts: readonly ScheduleReceipt[];
  readonly roundResults: readonly RoundResult[];
}
export function readCombatStrategyInputs(state: CombatStrategyInputs | MatchBase): CombatStrategyInputs {
  const { round, preparation, items, temporaryEquipment, augments, anomalyBinding, persistentGrowth, augmentProgress, roundResults = [],playerHp } = state;
  const cabalGrowth='resourceProvenance' in state?readCabalGrowth(state):state.cabalGrowth;
  const needsBank=anomalyBinding?.definitionId==='avarice-incarnate'||items.some(i=>portableAnomalyId(i.definitionId)==='avarice-incarnate')||items.some(i=>i.definitionId==='TFT7_Item_ShimmerscaleGamblersBlade')||temporaryEquipment.some(i=>i.definitionId==='TFT7_Item_ShimmerscaleGamblersBlade');
  const bankGold='bankGold' in state?state.bankGold:needsBank&&'gold' in state?state.gold:undefined;
  const itemSummonPositions='seatMechanics' in state?readItemSummonPositions(state):('itemSummonPositions' in state?state.itemSummonPositions:undefined);
  const g23='seatMechanics' in state?readG23Progress(state):('g23' in state?state.g23:undefined);
  const visibleExperimentCells='seatMechanics' in state&&state.seatMechanics&&!state.seatMechanics.hidden.progress?state.seatMechanics.seat.experimentCells as readonly import('./board').HexCell[]:('visibleExperimentCells' in state?state.visibleExperimentCells:undefined);
  const sniperOpening = 'seatMechanics' in state ? readSniperOpening(state) : ('sniperOpening' in state ? state.sniperOpening : undefined);
  const ghost = 'resourceProvenance' in state ? ghostFriendsGrowth(state as import('./match-types').MatchState) : state.ghostFriendsGrowth;
  const h6Growth='resourceProvenance' in state ? scoreboardCombatGrowth(state as import('./match-types').MatchState,preparation.units.filter(u=>u.team==='player').map(u=>u.id)) : ('h6Growth' in state?state.h6Growth:undefined);
  const d14='d14' in state?d14Certificate(state as MatchBase):'d14Combat' in state?state.d14Combat:undefined;
  const absent='d14' in state&&state.d14&&'held' in state.d14&&state.d14.held;
  const historyGrowth = 'resourceProvenance' in state && 'augmentHistory' in state ? combatHistoryGrowth(state as import('./match-types').MatchState,preparation.units.filter(u=>u.team==='player').map(u=>u.id),!!('combatInputBasis' in state && state.combatInputBasis)) : ('augmentHistoryGrowth' in state ? state.augmentHistoryGrowth : undefined);
  const copyKills='resourceProvenance' in state?r2FrozenCopyKills(state as import('./match-types').MatchState):('augmentCopyKills' in state?state.augmentCopyKills:undefined);
  return { ...(ghost?{ghostFriendsGrowth:ghost}:{}),...(copyKills?.length?{augmentCopyKills:copyKills}:{}),...(cabalGrowth?{cabalGrowth}:{}), ...(sniperOpening ? { sniperOpening } : {}), ...(h6Growth?{h6Growth}:{}),...(historyGrowth?.length?{augmentHistoryGrowth:historyGrowth}:{}),...(d14?{d14Combat:d14}:{}),...(itemSummonPositions?{itemSummonPositions}:{}),round, preparation, items, temporaryEquipment, augments, anomalyBinding:absent?null:anomalyBinding, persistentGrowth:absent?persistentGrowth.filter(g=>g.unitId!==('d14' in state?state.d14?.unitId:undefined)):persistentGrowth, augmentProgress, roundResults,...(bankGold===undefined?{}:{bankGold}),...(visibleExperimentCells?{visibleExperimentCells}:{}),...(g23===undefined?{}:{g23}),...(playerHp===undefined?{}:{playerHp}),
    ...('priorPvpWins' in state&&state.priorPvpWins!==undefined?{priorPvpWins:state.priorPvpWins}:{}) };
}
/** Called once at successful Start, before Combat or any settlement can mutate resources. */
export function freezeCombatInput(state: MatchBase, battleSeed: number, provenancePrefixLength: number): CombatInputBasis {
  return shareGeneratedJson(structuredClone({ version: COMBAT_INPUT_VERSION,mechanicReceiptPrefixLength:state.seatMechanics?.receipts.length??0, combatId: `round-${state.round}`,
    roundId: state.roundDefinitionId, contentDigest: state.contentDigest, battleSeed, playerLevel: state.level,
    nextUnitSerial: state.nextUnitSerial, nextItemSerial: state.nextItemSerial,
    equipmentRollPrefixLength: state.equipmentState.rolls.length, provenancePrefixLength,
    inputs: readCombatStrategyInputs(state) }));
}
function requireBasis(condition: unknown): asserts condition { if (!condition) throw new RangeError('Invalid combat input basis'); }
const inputValidation = createInputValidation(requireBasis);
const integer: InputValidation['integer'] = inputValidation.integer;
const record: (value: unknown) => void = inputValidation.record;
const sorted = <T extends { readonly id: string }>(values: readonly T[]): T[] => [...values].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
/** Pure own-format validation. Caller first validates history, receipts and the provenance prefix.
 * No combat creation, RNG mutation, inventory grant, or replacement of saved values. */
export function restoreCombatInput(value: unknown, authority: CombatInputAuthority, parsedJsonInput = false, deferFreeze = false): CombatInputBasis {
  // Only restoreMatch's own fully validated JSON.parse graph uses this path.
  const equal = parsedJsonInput ? equalValidatedContent : (a: unknown, b: unknown) => canonicalContent(a) === canonicalContent(b);
  if (!parsedJsonInput) canonicalContent(value);
  record(value);
  const basis = value as unknown as CombatInputBasis, input = basis.inputs; record(input);
  const round = ROUND_CATALOG.find(entry => entry.ordinal === authority.round);
  requireBasis(round && round.kind !== 'supply' && basis.version === COMBAT_INPUT_VERSION
    && basis.combatId === `round-${authority.round}` && basis.roundId === round.roundId
    && basis.contentDigest === authority.contentDigest && input.round === authority.round);
  integer(basis.mechanicReceiptPrefixLength);
  requireBasis(equal(input.ghostFriendsGrowth??null,authority.ghostFriendsGrowth??null));
  requireBasis(equal(input.h6Growth??null,authority.h6Growth??null));
  requireBasis(equal(input.sniperOpening ?? null, authority.sniperOpening ?? null));
  requireBasis(equal(input.cabalGrowth??null,authority.cabalGrowth??null));
  requireBasis(equal(input.itemSummonPositions??null,authority.itemSummonPositions??null));
  if(input.itemSummonPositions)validateItemSummonPositions(input.itemSummonPositions,authority.resources.nextItemSerial,authority.resources.nextUnitSerial);
  if(input.bankGold!==undefined){integer(input.bankGold);requireBasis(input.bankGold===authority.bankGold);}
  if(input.playerHp!==undefined){integer(input.playerHp);requireBasis(input.playerHp<=maximumPlayerHp(input.augments,input.round)&&input.playerHp===authority.playerHp);}
  if(authority.g23){
    requireBasis(input.g23);validateG23Progress(input.g23,authority.seed,authority.round);
    requireBasis(equal(input.g23.economyReceipts,authority.g23.economyReceipts.slice(0,input.g23.economyReceipts.length)));
    requireBasis(input.g23.economyReceipts.filter(r=>r.kind==='battle').length===authority.g23.economyReceipts.filter(r=>r.kind==='battle'&&r.facts.round<authority.round).length);
    requireBasis(equal(input.g23.itemReceipts,authority.g23.itemReceipts));
    requireBasis(equal(input.g23.epicCrowns??[],authority.epicCrownsBeforeCombat??(authority.g23.epicCrowns??[]).filter(r=>r.round<authority.round)));
    // Junker purchases only happen in preparation, before this frozen combat.
    requireBasis(equal(input.g23.junkerPurchases,authority.g23.junkerPurchases));
    // Claims only append, and the crown's team size is read from them: the frozen claims are an authoritative prefix.
    requireBasis(equal(input.g23.rewardClaims,authority.g23.rewardClaims.slice(0,input.g23.rewardClaims.length)));
  }else requireBasis(input.g23===undefined);
  requireBasis(equal(input.roundResults ?? [], authority.roundResults.filter(r => r.round < input.round)));
  // Solo reads its Emissary wins from roundResults; the online-only frozen count never appears in a solo basis.
  requireBasis(input.priorPvpWins===undefined);
  validateSeed(authority.seed); validateSeed(basis.battleSeed);
  let battleSeed = (authority.seed ^ 0x9e3779b9) >>> 0;
  for (const entry of ROUND_CATALOG) {
    if (entry.ordinal > authority.round) break;
    if (entry.kind !== 'supply' && !authority.shared?.twoSidedRounds.includes(entry.ordinal)) battleSeed = nextRandom(battleSeed).word;
  }
  requireBasis(basis.battleSeed === battleSeed);
  integer(basis.provenancePrefixLength); integer(basis.equipmentRollPrefixLength);
  requireBasis(basis.playerLevel === authority.playerLevel
    && basis.provenancePrefixLength === authority.provenancePrefixLength
    && basis.equipmentRollPrefixLength === authority.equipmentRollPrefixLength
    && basis.equipmentRollPrefixLength <= authority.equipmentRolls.length
    && basis.nextUnitSerial === authority.resources.nextUnitSerial && basis.nextItemSerial === authority.resources.nextItemSerial);
  const units = validateInputAssets(input, {...basis, teamSizeBonus: crownTeamSizeBonus(input.g23)}, readRoundEnemyProjection(authority.round,authority.shared?.openingId ?? createOpeningEncounter(authority.seed).selection.encounterId).units, inputValidation);
  requireBasis(equal(input.d14Combat??null,authority.d14Combat??null));
  const players = input.preparation.units.filter(unit => unit.team === 'player');
  requireBasis(equal(sorted(players.map(({id,definitionId,starLevel}) => ({id,definitionId,starLevel}))), sorted(authority.resources.units.filter(u=>!authority.heldUnitIds?.includes(u.id)).map(({id,definitionId,starLevel}) => ({id,definitionId,starLevel})))));
  requireBasis(equal(sorted(input.items.map(({id,definitionId}) => ({id,definitionId}))), sorted(authority.resources.items.filter(i=>!authority.heldItemIds?.includes(i.id)).map(({id,definitionId}) => ({id,definitionId})))));
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
  requireBasis(equal(input.augmentCopyKills??[],authority.augmentCopyKills??[]));
  requireBasis(equal(input.augmentHistoryGrowth ?? [],authority.augmentHistoryGrowth ?? []));
  requireBasis(Array.isArray(input.persistentGrowth) && equal(input.persistentGrowth, authority.resources.persistentGrowth.filter(g=>!authority.heldUnitIds?.includes(g.unitId))));
  const growthIds = new Set<string>();
  for (const growth of input.persistentGrowth) {
    record(growth); integer(growth.attackDamageBps,1);
    requireBasis(units.get(growth.unitId)?.definitionId === 'tristana' && growth.attackDamageBps % 125 === 0 && !growthIds.has(growth.unitId)); growthIds.add(growth.unitId);
  }
  const history = authority.roundResults.filter(result => result.round < authority.round);
  const pump = input.augments.find(augment => augment.definitionId === 'pumping-up-i');
  const forming = authority.forming, magicRoll = authority.magicRoll;
  requireBasis(equal(input.augmentProgress, {
    pumpingRounds: pump ? history.filter(result => result.round >= pump.acquiredRound).length : 0,
    investmentHp: investmentGrowth(input.augments,history),
    ...(forming ? { forming } : {}),
    ...(magicRoll ? { magicRoll } : {}),
  }));
  const rolls = authority.equipmentRolls.slice(0, basis.equipmentRollPrefixLength);
  const expectedChildren = sorted(input.items).filter(item => item.location.kind === 'unit' && grantsTemporaryEquipment(ITEM_DEFINITIONS[item.definitionId])).flatMap(item => {
    requireBasis(item.location.kind === 'unit');
    const roll = equipmentRollFor(rolls,basis.roundId,item,input);
    requireBasis(roll && roll.playerLevelSnapshot <= basis.playerLevel);
    return projectTemporaryEquipment(roll, item.location.unitId);
  });
  requireBasis(equal(input.temporaryEquipment, expectedChildren));
  // The Match restore boundary can defer freezing its private parsed graph to
  // its final metadata interning. It still runs every check above, and keeps
  // freezing public/object callers here. No candidate validation is memoized.
  return parsedJsonInput && deferFreeze ? basis : freezeContent(parsedJsonInput ? basis : structuredClone(basis));
}
