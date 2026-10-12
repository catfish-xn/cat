import type { MatchState } from './match-types';
import { freezeContent } from './content/freeze';
import { boardView, cellView, pick } from './view-fields';

/** A detached recursive subset of MatchState, never a serializable authority/save. */
export function toPrivateSeatView(state: MatchState) {
  const units = state.preparation.units.filter(unit => unit.team === 'player');
  const ids = new Set(units.map(unit => unit.id));
  const items = state.items.filter(item => item.location.kind === 'inventory' || ids.has(item.location.unitId));
  return freezeContent({
    ...pick(state, ['schemaVersion', 'rulesVersion', 'contentVersion', 'contentDigest', 'commandProtocolVersion',
      'tickMs', 'round', 'roundDefinitionId', 'phase', 'gold', 'level', 'xp', 'playerHp']),
    streak: pick(state.streak, ['kind', 'count']),
    shop: { ...pick(state.shop, ['generation', 'locked']), slots: state.shop.slots.map(slot => slot.status === 'available'
      ? pick(slot, ['status', 'definitionId']) : pick(slot, ['status', 'empty'])) },
    preparation: { board: boardView(state.preparation.board), benchSize: state.preparation.benchSize,
      units: units.map(unit => ({ ...pick(unit, ['id', 'definitionId', 'team', 'starLevel']),
        location: unit.location.kind === 'bench' ? pick(unit.location, ['kind', 'slot'])
          : { kind: 'board' as const, cell: cellView(unit.location.cell) } })) },
    items: items.map(item => ({ ...pick(item, ['id', 'definitionId']), location: item.location.kind === 'inventory'
      ? { kind: 'inventory' as const } : pick(item.location, ['kind', 'unitId', 'slot']) })),
    temporaryEquipment: state.temporaryEquipment.filter(item => item.roundId === state.roundDefinitionId
      && item.expiresAfterRoundId === state.roundDefinitionId && ids.has(item.holderId)
      && items.some(parent => parent.id === item.parentItemInstanceId && parent.location.kind === 'unit'
        && parent.location.unitId === item.holderId)).map(item => pick(item,
      ['temporaryId', 'parentItemInstanceId', 'roundId', 'holderId', 'definitionId', 'slot', 'expiresAfterRoundId'])),
    augments: state.augments.map(augment => pick(augment, ['definitionId', 'choiceId', 'acquiredRound'])),
    anomalyBinding: state.anomalyBinding && ids.has(state.anomalyBinding.unitId)
      ? pick(state.anomalyBinding, ['definitionId', 'unitId', 'choiceId', 'boundRound']) : null,
    persistentGrowth: state.persistentGrowth.filter(growth => ids.has(growth.unitId)).map(growth => pick(growth, ['unitId', 'attackDamageBps'])),
    augmentProgress: pick(state.augmentProgress, ['pumpingRounds', 'investmentHp']),
    pendingChoice: state.phase === 'choice' && state.pendingChoice ? {
      ...pick(state.pendingChoice, ['kind', 'step', 'choiceId', 'generation', 'targetId', 'rerollCount']),
      offers: [...state.pendingChoice.offers],
    } : null,
    roundResults: state.roundResults.map(result => ({ ...pick(result,
      ['round', 'roundId', 'result', 'combatTicks', 'combatEventCount', 'baseDamage', 'survivingEnemyCount',
        'playerDamage', 'hpLost', 'hpBefore', 'hpAfter', 'goldBefore', 'goldAfter', 'income', 'xpAwarded',
        'levelBefore', 'levelAfter', 'xpBefore', 'xpAfter']),
      incomeBreakdown: pick(result.incomeBreakdown, ['base', 'win', 'interest', 'streak']) })),
    m8: { round: pick(state.m8.round, ['roundId', 'ordinal', 'stage', 'subround', 'kind', 'encounterId', 'displayName']) },
  });
}
export type PrivateSeatView = ReturnType<typeof toPrivateSeatView>;
