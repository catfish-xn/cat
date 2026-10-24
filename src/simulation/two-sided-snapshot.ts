import { drainSetup } from './setup-work';
import { d14Certificate, eligibleD14Target } from './d14-runtime';
import {readItemSummonPositions,validateItemSummonPositions} from './g2-4b-voidspawn';
import {readG23Progress} from './g2-3-state';
import { isG23NonCombatant, isG23Summon } from './g2-3-summons';
import { validateG23ProgressSteps } from './g2-3-match-progress';
import { canonicalContent, canonicalContentSteps, CONTENT_DIGEST } from './content';
import { freezeContentSteps } from './content/freeze';
import { DEFAULT_BOARD } from './board';
import { createInputValidation, validateInputAssets } from './input-assets';
import { crownTeamSizeBonus } from './deployment-cap';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { ANOMALY_DEFINITIONS } from './content/anomalies';
import { getCatalogRoundByOrdinal } from './round-selectors';
import { getMultiplayerRoundById, getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { M8_VERSION } from './m8/version';
import { G22_EMISSARY_WIN_CAP, priorPvpWins } from './g2-2-pvp-history';
import type { MatchState } from './match-types';
import { BattleValidationError, PLAYER_BATTLE_SNAPSHOT_VERSION, type PlayerBattleSnapshot } from './two-sided-types';

function requireSnapshot(condition: unknown): asserts condition {
  if (!condition) throw new BattleValidationError('invalid-snapshot');
}
const validation = createInputValidation(requireSnapshot);
const id: typeof validation.id = validation.id;
const integer: typeof validation.integer = validation.integer;
const list: typeof validation.list = validation.list;
const record: typeof validation.record = validation.record;
const ascii = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
/** A snapshot cannot claim more wins than PvP rounds before its own round, nor more than the Emissary cap. */
const priorPvpRoundLimit = (ordinal: number) => {
  let rounds = 0;
  for (let i = 1; i < ordinal && rounds < G22_EMISSARY_WIN_CAP; i++) if (getMultiplayerRoundByOrdinal(i).kind === 'pvp') rounds++;
  return rounds;
};
const nextSerial = (ids: readonly string[]) => Math.max(0, ...ids.map(value => Number(value.slice(value.indexOf('-') + 1)))) + 1;

/** Own-format structural validation, not client authentication or asset-history validation. */
export function restorePlayerBattleSnapshot(input: unknown): PlayerBattleSnapshot {
  return drainSetup(restorePlayerBattleSnapshotSteps(input));
}
export function* restorePlayerBattleSnapshotSteps(input: unknown): Generator<void, PlayerBattleSnapshot, void> {
  try {
    const value: unknown = typeof input === 'string' ? JSON.parse(input) : input;
    yield* canonicalContentSteps(value); yield; record(value);
    if (value.version !== PLAYER_BATTLE_SNAPSHOT_VERSION) throw new BattleValidationError('snapshot-version');
    if (value.contentDigest !== CONTENT_DIGEST) throw new BattleValidationError('content-digest');
    const s = value as unknown as PlayerBattleSnapshot;
    if(s.itemSummonPositions)validateItemSummonPositions(s.itemSummonPositions);
    if(s.bankGold!==undefined)integer(s.bankGold);
    if(s.playerHp!==undefined){integer(s.playerHp);requireSnapshot(s.playerHp<=100);}
    if(s.g23)yield* validateG23ProgressSteps(s.g23,s.g23.seed,getMultiplayerRoundById(s.roundId).ordinal);
    if(s.priorPvpWins!==undefined){integer(s.priorPvpWins,1);requireSnapshot(s.priorPvpWins<=priorPvpRoundLimit(getMultiplayerRoundById(s.roundId).ordinal));}
    id(s.seatId); id(s.roundId); integer(s.level, 1);
    const round = getMultiplayerRoundById(s.roundId);
    if(s.itemSummonPositions)requireSnapshot(Object.keys(s.itemSummonPositions).every(id=>id.startsWith('unit-')?Array.isArray(s.units)&&s.units.some(u=>u.id===id&&u.definitionId==='jayce'):Array.isArray(s.items)&&s.items.some(i=>i.id===id)));
    list(s.units); list(s.items); list(s.temporaryEquipment); list(s.augments); list(s.persistentGrowth);
    // Sion, the Forge and other combat-only skill bodies are spawned at combat start from the roster; a snapshot
    // never carries one (a pre-placed Sion would bypass the Black Rose tier and its one-Sion projection).
    for (const unit of s.units) { record(unit); id(unit.id); requireSnapshot(unit.team === 'player' && unit.location?.kind === 'board' && !unit.encounterId && !isG23Summon(unit) && !isG23NonCombatant(unit)); }
    for (const item of s.items) { record(item); id(item.id); requireSnapshot(item.location?.kind === 'unit'); }
    const units = validateInputAssets({ preparation: { board: DEFAULT_BOARD, benchSize: 9, units: s.units }, items: s.items },
      { playerLevel: s.level, nextUnitSerial: nextSerial(s.units.map(u => u.id)), nextItemSerial: nextSerial(s.items.map(i => i.id)), teamSizeBonus: crownTeamSizeBonus(s.g23) }, [], validation);
    const itemIds = new Set(s.items.map(item => item.id)), temporarySlots = new Set<string>();
    for (const child of s.temporaryEquipment) {
      record(child); id(child.temporaryId); requireSnapshot(!itemIds.has(child.temporaryId)); itemIds.add(child.temporaryId);
      const parent = s.items.find(item => item.id === child.parentItemInstanceId);
      requireSnapshot(parent?.location.kind === 'unit' && ITEM_DEFINITIONS[parent.definitionId].slotCost === 3
        && parent.location.unitId === child.holderId && (child.slot === 1 || child.slot === 2)
        && child.roundId === s.roundId && child.expiresAfterRoundId === s.roundId
        && Object.hasOwn(ITEM_DEFINITIONS, child.definitionId) && ITEM_DEFINITIONS[child.definitionId].slotCost !== 3);
      const slot = JSON.stringify([child.parentItemInstanceId, child.slot]);
      requireSnapshot(!temporarySlots.has(slot)); temporarySlots.add(slot);
    }
    for (const parent of s.items.filter(item => ITEM_DEFINITIONS[item.definitionId].slotCost === 3)) {
      requireSnapshot([1, 2].every(slot => temporarySlots.has(JSON.stringify([parent.id, slot]))));
    }
    const augmentIds = new Set<string>(), choices = new Set<string>();
    requireSnapshot(s.augments.length <= 3);
    for (const augment of s.augments) {
      record(augment); id(augment.choiceId); integer(augment.acquiredRound, 1);
      requireSnapshot(augment.acquiredRound <= round.ordinal && Object.hasOwn(AUGMENT_DEFINITIONS, augment.definitionId)
        && !augmentIds.has(augment.definitionId) && !choices.has(augment.choiceId));
      augmentIds.add(augment.definitionId); choices.add(augment.choiceId);
    }
    if (s.anomalyBinding !== null) {
      record(s.anomalyBinding); const binding = s.anomalyBinding; id(binding.choiceId); integer(binding.boundRound, 1);
      requireSnapshot(binding.boundRound <= round.ordinal && units.has(binding.unitId) && Object.hasOwn(ANOMALY_DEFINITIONS, binding.definitionId));
    }
    if(s.anomalyBinding&&['ultimate-hero','into-the-unknown'].includes(s.anomalyBinding.definitionId))requireSnapshot(s.d14Combat);
    if(s.d14Combat){
      const c=s.d14Combat,u=units.get(c.unitId),b=s.anomalyBinding;
      requireSnapshot(!!u&&b?.unitId===c.unitId&&b.definitionId===c.anomalyId);
      requireSnapshot(eligibleD14Target(u,c.anomalyId));
      requireSnapshot(c.anomalyId==='ultimate-hero'?['waiting','promoted'].includes(c.phase):c.anomalyId==='into-the-unknown'&&c.phase==='returned');
      requireSnapshot(c.anomalyId!=='ultimate-hero'||c.phase===(round.ordinal>=b!.boundRound+3?'promoted':'waiting'));
      requireSnapshot(c.phase!=='returned'||round.ordinal>=b!.boundRound+3);
      requireSnapshot(Object.keys(c).length===3);
    }
    const growthIds = new Set<string>();
    for (const growth of s.persistentGrowth) {
      record(growth); integer(growth.attackDamageBps, 1);
      requireSnapshot(units.get(growth.unitId)?.definitionId === 'tristana' && growth.attackDamageBps % 125 === 0 && !growthIds.has(growth.unitId));
      growthIds.add(growth.unitId);
    }
    record(s.augmentProgress); integer(s.augmentProgress.pumpingRounds); integer(s.augmentProgress.investmentHp);
    requireSnapshot(s.augmentProgress.pumpingRounds <= round.ordinal
      && (augmentIds.has('pumping-up-i') || s.augmentProgress.pumpingRounds === 0)
      && ((augmentIds.has('investment-strategy-i') || augmentIds.has('investment-strategy-ii')) || s.augmentProgress.investmentHp === 0));
    // Reject extra/private fields, including fields nested in unit and item descriptors.
    const clean: PlayerBattleSnapshot = {
      ...(s.d14Combat?{d14Combat:structuredClone(s.d14Combat)}:{}),
      ...(s.itemSummonPositions?{itemSummonPositions:structuredClone(s.itemSummonPositions)}:{}),
      ...(s.bankGold===undefined?{}:{bankGold:s.bankGold}),...(s.playerHp===undefined?{}:{playerHp:s.playerHp}),...(s.g23===undefined?{}:{g23:structuredClone(s.g23)}),
      ...(s.priorPvpWins===undefined?{}:{priorPvpWins:s.priorPvpWins}),
      version: PLAYER_BATTLE_SNAPSHOT_VERSION, contentDigest: CONTENT_DIGEST, seatId: s.seatId, roundId: s.roundId, level: s.level,
      units: s.units.map(u => ({ id: u.id, definitionId: u.definitionId, team: 'player', starLevel: u.starLevel,
        location: { kind: 'board', cell: u.location.kind === 'board' ? { col: u.location.cell.col, row: u.location.cell.row } : { col: -1, row: -1 } } })),
      items: s.items.map(i => ({ id: i.id, definitionId: i.definitionId, location: i.location.kind === 'unit'
        ? { kind: 'unit', unitId: i.location.unitId, slot: i.location.slot } : { kind: 'inventory' } })),
      temporaryEquipment: s.temporaryEquipment.map(c => ({ temporaryId:c.temporaryId, parentItemInstanceId:c.parentItemInstanceId,
        roundId:c.roundId, holderId:c.holderId, definitionId:c.definitionId, slot:c.slot, expiresAfterRoundId:c.expiresAfterRoundId })),
      augments: s.augments.map(a => ({ definitionId:a.definitionId, choiceId:a.choiceId, acquiredRound:a.acquiredRound })),
      anomalyBinding: s.anomalyBinding === null ? null : { definitionId:s.anomalyBinding.definitionId,
        unitId:s.anomalyBinding.unitId, choiceId:s.anomalyBinding.choiceId, boundRound:s.anomalyBinding.boundRound },
      persistentGrowth: s.persistentGrowth.map(g => ({unitId:g.unitId,attackDamageBps:g.attackDamageBps})),
      augmentProgress: { pumpingRounds:s.augmentProgress.pumpingRounds, investmentHp:s.augmentProgress.investmentHp },
    };
    const cleanText = yield* canonicalContentSteps(clean);
    yield;
    requireSnapshot(cleanText === (yield* canonicalContentSteps(s)));
    yield;
    return yield* freezeContentSteps(structuredClone(clean));
  } catch (error) {
    if (error instanceof BattleValidationError) throw error;
    throw new BattleValidationError('invalid-snapshot');
  }
}

/** Only called on server-owned preparation state; history/authentication remain upstream. */
export function snapshotForBattle(state: MatchState, seatId: string): PlayerBattleSnapshot {
  return drainSetup(snapshotForBattleSteps(state, seatId));
}
export function* snapshotForBattleSteps(state: MatchState, seatId: string): Generator<void, PlayerBattleSnapshot, void> {
  if ((state.phase !== 'preparation' || state.multiplayer?.combatRosterLocked)) throw new BattleValidationError('wrong-phase');
  if (state.contentDigest !== CONTENT_DIGEST) throw new BattleValidationError('content-digest');
  if ((['schemaVersion','rulesVersion','contentVersion','commandProtocolVersion','rngAlgorithm','tickMs'] as const)
    .some(key => state[key] !== M8_VERSION[key])) throw new BattleValidationError('snapshot-version');
  if ((state.multiplayer ? getMultiplayerRoundByOrdinal(state.round) : getCatalogRoundByOrdinal(state.round)).roundId !== state.roundDefinitionId) throw new BattleValidationError('round-mismatch');
  requireSnapshot(canonicalContent(state.preparation.board) === canonicalContent(DEFAULT_BOARD) && state.preparation.benchSize === 9);
  const units = state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'board').sort(ascii);
  const ids = new Set(units.map(unit => unit.id));
  const wins = priorPvpWins(state.roundResults, state.round);
  // A placed Hextech Forge travels with its deployed Jayce (keyed by the Jayce), a Voidspawn with its equipped portal.
  const itemSummonPositions=Object.fromEntries(Object.entries(readItemSummonPositions(state)??{}).filter(([id])=>units.some(u=>u.id===id&&u.definitionId==='jayce')||state.items.some(i=>i.id===id&&i.location.kind==='unit'&&ids.has(i.location.unitId))));
  const d14Combat=d14Certificate(state);
  return yield* restorePlayerBattleSnapshotSteps({
    ...(d14Combat&&ids.has(d14Combat.unitId)?{d14Combat}:{}),
    ...(Object.keys(itemSummonPositions).length?{itemSummonPositions}:{}),
    ...(state.anomalyBinding?.definitionId==='avarice-incarnate'||state.items.some(i=>i.definitionId==='TFT7_Item_ShimmerscaleGamblersBlade')||state.temporaryEquipment.some(i=>i.definitionId==='TFT7_Item_ShimmerscaleGamblersBlade')?{bankGold:state.gold}:{}),
    version: PLAYER_BATTLE_SNAPSHOT_VERSION, contentDigest: state.contentDigest, playerHp:state.playerHp,g23:readG23Progress(state),...(wins===0?{}:{priorPvpWins:wins}),seatId, roundId: state.roundDefinitionId, level: state.level,
    units, items: state.items.filter(item => item.location.kind === 'unit' && ids.has(item.location.unitId)).sort(ascii),
    temporaryEquipment: state.temporaryEquipment.filter(item => ids.has(item.holderId)),
    augments: state.augments, anomalyBinding: state.anomalyBinding && ids.has(state.anomalyBinding.unitId) ? state.anomalyBinding : null,
    persistentGrowth: state.persistentGrowth.filter(growth => ids.has(growth.unitId)), augmentProgress: state.augmentProgress,
  });
}
