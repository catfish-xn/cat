import { readMasterworkOptions } from './masterwork-choice';
import { readOpeningEncounterView, readOpeningMelProgress, readOpeningForgeProgress } from './opening-encounter';
import { getUnitSellPrice } from './unit-stats';
import { D14_POLICY } from './content/d14-anomalies';
import { isD14PromotedUnit } from './d14-public-unit-mark';
import type { MatchState } from './match-types';
import { d11PrivateDisplay } from './d11-display';
import type { RevealedDropView } from './m8/ui-contracts';
import { readLootView, payloadView } from './loot-view';
import { previewUseConsumable } from './consumables';
import type { ConsumableTarget, ConsumableFailure } from './consumable-types';
import { freezeContent } from './content/freeze';
import { boardView, cellView, pick } from './view-fields';
import { seatMechanicsView } from './seat-mechanics/state';
import type { MechanicChoicePayload } from './seat-mechanics/types';
import { augmentOptionViews } from './augment-offers';
import { familyReunionView } from './family-reunion';
import { sixCostOddsBps, sixCostShopContext } from './six-cost-shop';
import { augmentDynamicValues } from './augment-dynamic-values';
import { readG23MechanismState } from './g2-3-view';
import { preparationUnitView, itemView, d14PrivateDisplay } from './private-seat-display';

/** Current-round display summary, deliberately separate from the private m8.loot authority. */
function revealedLootView(state: MatchState) {
  const round = state.m8.round;
  if (round.kind !== 'pve' || round.roundId !== state.roundDefinitionId || round.ordinal !== state.round) return undefined;
  const plan = state.m8.loot.frozen.rounds.find(value => value.encounterPlan.roundId === round.roundId);
  if (!plan || plan.encounterPlan.encounterId !== round.encounterId) return undefined;
  const revealedDrops = readLootView(state).revealedDrops
    .filter(drop => drop.roundId === round.roundId && drop.encounterId === round.encounterId)
    .map((drop): RevealedDropView => {
      const payload=payloadView(drop.payload);
      const identity = { ...pick(drop, ['orbId','entryOrdinal','dropId', 'encounterId', 'sourceUnitId', 'roundId']), payload };
      switch (drop.status) {
        case 'forfeited': return {...identity,status:drop.status,receiptId:null,allowedActions:[],reason:drop.reason};
        case 'granted': return { ...identity, status: drop.status, receiptId: drop.receiptId, allowedActions: [] };
        case 'revealed': return { ...identity, status: drop.status, receiptId: null, allowedActions: [], reason: drop.reason };
        case 'pending-capacity': return { ...identity, status: drop.status, receiptId: null, allowedActions: [], reason: 'bench-full' };
        case 'retained-terminal': return { ...identity, status: drop.status, receiptId: null, allowedActions: [], reason: 'terminal-bench-full' };
      }
    });
  return { roundId: round.roundId, revealedDrops, revealedOrbs:readLootView(state).revealedOrbs.map(o=>({...pick(o,['orbId','tier','status']),entryDropIds:[...o.entryDropIds]})) };
}

export type ConsumableTargetView =
  | { readonly target: ConsumableTarget; readonly allowed: true; readonly affectedItemIds: readonly string[] }
  | { readonly target: ConsumableTarget; readonly allowed: false; readonly reason: ConsumableFailure };

/** A detached MatchState subset plus the revealedLoot display summary; never an authority/save. */
export function toPrivateSeatView(state: MatchState) {
  const units = state.preparation.units.filter(unit => unit.team === 'player');
  const ids = new Set(units.map(unit => unit.id));
  const preview = state.m8.round.kind === 'pve' && state.m8.round.roundId === state.roundDefinitionId
    && state.m8.preparation.roundId === state.roundDefinitionId
    && state.m8.preparation.encounterId === state.m8.round.encounterId ? state.m8.preparation : null;
  const enemies = preview ? preview.enemies.filter(unit => unit.team === 'enemy' && unit.location.kind === 'board') : [];
  const items = state.items.filter(item => item.location.kind === 'inventory' || ids.has(item.location.unitId));
  const revealedLoot = revealedLootView(state);
  const seatMechanics = seatMechanicsView(state);
  const mutationCell = readG23MechanismState(state)?.mutationSacrificeCell;
  const d11Display = d11PrivateDisplay(state);
  // Candidate ownership is filtered before authority preview; never reveal foreign targets or rolls.
  const candidates: ConsumableTarget[] = [
    ...units.map(unit => ({ kind: 'unit' as const, unitId: unit.id })),
    ...items.map(item => ({ kind: 'item' as const, itemId: item.id })),
  ];
  const consumableTargets = state.consumables.map(tool => ({
    consumableId: tool.consumableId,
    targets: candidates.map((target): ConsumableTargetView => {
      const preview = previewUseConsumable(state, tool.consumableId, target);
      return preview.ok
        ? { target: { ...target }, allowed: true, affectedItemIds: [...preview.affectedItemIds] }
        : { target: { ...target }, allowed: false, reason: preview.reason };
    }),
  }));
  return freezeContent({
    openingEncounter: readOpeningEncounterView(state),
    openingMelProgress: readOpeningMelProgress(state),
    ...(readOpeningForgeProgress(state) ? {openingForgeProgress: readOpeningForgeProgress(state)} : {}),
    ...(state.multiplayer ? {unclaimedOrbs:readLootView(state).unclaimedOrbs??[],
      orbClaimReceipts:readLootView(state).claimReceipts??[]}:{}),
    ...(d11Display?{d11Display}:{}),
    ...(state.d14?{d14Display:d14PrivateDisplay(state)}:{}),
    ...pick(state, ['schemaVersion', 'rulesVersion', 'contentVersion', 'contentDigest', 'commandProtocolVersion',
      'tickMs', 'round', 'roundDefinitionId', 'phase', 'gold', 'level', 'xp', 'playerHp']),
    ...(state.carousel?{heldCarouselUnits:state.carousel.heldCarouselUnits.map(u=>pick(u,['receiptId','unitId','definitionId']))}:{}),
    ...(revealedLoot ? { revealedLoot } : {}),
    // G2-3: the whole owner-visible mechanic container; `hidden` always empty. Same key as MatchState, so display states keep it.
    ...(seatMechanics ? { seatMechanics } : {}),
    ...(mutationCell ? { mutationSacrificeCell: cellView(mutationCell) } : {}),
    ...(state.pendingChoice?.payload?.kind === 'armory' && state.pendingChoice.payload.masterwork
      ? {masterworkOptions:readMasterworkOptions(state,state.pendingChoice.payload.masterwork.unitId)} : {}),
    consumables:state.consumables.map(c=>pick(c,['consumableId','definitionId'])),
    consumableTargets,
    familyReunion: familyReunionView(state),
    shopOdds: { sixCostBps: sixCostOddsBps(state.round, state.level, sixCostShopContext(state).viktor) },
    augmentDynamicValues: augmentDynamicValues(state),
    streak: pick(state.streak, ['kind', 'count']),
    shop: { ...pick(state.shop, ['generation', 'locked']), slots: state.shop.slots.map(slot => slot.status === 'available'
      ? pick(slot, ['status', 'definitionId', 'starLevel']) : pick(slot, ['status', 'empty'])) },
    preparation: { board: boardView(state.preparation.board), benchSize: state.preparation.benchSize,
      ...(state.preparation.usableBenchSlots === undefined ? {} : {usableBenchSlots:state.preparation.usableBenchSlots,overflowUnitIds:[...state.preparation.overflowUnitIds ?? []]}),
      units: [...units, ...enemies].map(u=>({...preparationUnitView(u),...(isD14PromotedUnit(state,u.id)?{effectiveStarLevel:4 as const,sellGold:getUnitSellPrice({definitionId:u.definitionId,starLevel:3}),poolCopies:D14_POLICY.ultimateShares}:{})})) },
    items: items.map(itemView),
    temporaryEquipment: state.temporaryEquipment.filter(item => item.roundId === state.roundDefinitionId
      && item.expiresAfterRoundId === state.roundDefinitionId && ids.has(item.holderId)
      && items.some(parent => parent.id === item.parentItemInstanceId && parent.location.kind === 'unit'
        && parent.location.unitId === item.holderId)).map(item => pick(item,
      ['temporaryId', 'parentItemInstanceId', 'roundId', 'holderId', 'definitionId', 'slot', 'expiresAfterRoundId'])),
    augments: state.augments.map(augment => pick(augment, ['definitionId', 'choiceId', 'acquiredRound'])),
    anomalyBinding: state.anomalyBinding && ids.has(state.anomalyBinding.unitId)
      ? pick(state.anomalyBinding, ['definitionId', 'unitId', 'choiceId', 'boundRound']) : null,
    persistentGrowth: state.persistentGrowth.filter(growth => ids.has(growth.unitId)).map(growth => pick(growth, ['unitId', 'attackDamageBps'])),
    augmentProgress: pick(state.augmentProgress, ['pumpingRounds', 'investmentHp', 'forming', 'magicRoll']),
    pendingChoice: state.phase === 'choice' && state.pendingChoice ? {
      ...pick(state.pendingChoice, ['kind', 'step', 'choiceId', 'generation', 'targetId', 'rerollCount', 'augmentTier', 'rerollsRemaining']),
      offers: [...state.pendingChoice.offers],
      ...(state.pendingChoice.kind === 'augment' ? {
        rerolledSlots: [...state.pendingChoice.rerolledSlots!], augmentOptions: augmentOptionViews(state),
      } : {}),
      ...(state.pendingChoice.payload ? { payload: structuredClone(state.pendingChoice.payload) as MechanicChoicePayload } : {}),
    } : null,
    roundResults: state.roundResults.map(result => ({ ...pick(result,
      ['round', 'roundId', 'roundKind', 'result', 'combatTicks', 'combatEventCount', 'baseDamage', 'survivingEnemyCount',
        'playerDamage', 'hpLost', 'hpBefore', 'hpAfter', 'goldBefore', 'goldAfter', 'income', 'interestBasis', 'xpAwarded',
        'levelBefore', 'levelAfter', 'xpBefore', 'xpAfter']),
      incomeBreakdown: pick(result.incomeBreakdown, ['base', 'win', 'interest', 'streak']) })),
    m8: { round: pick(state.m8.round, ['roundId', 'ordinal', 'stage', 'subround', 'kind', 'encounterId', 'displayName']),
      ...(preview ? { preparation: { ...pick(preview, ['roundId', 'encounterId']),
        enemies: enemies.map(preparationUnitView) } } : {}) },
  });
}
export type PrivateSeatView = ReturnType<typeof toPrivateSeatView>;
