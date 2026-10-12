import type { MatchState } from './match-types';
import type { RevealedDropView } from './m8/ui-contracts';
import { readLootView } from './loot-view';
import { freezeContent } from './content/freeze';
import { boardView, cellView, pick } from './view-fields';

function preparationUnitView(unit: MatchState['preparation']['units'][number]) {
  return { ...pick(unit, ['id', 'definitionId', 'team', 'starLevel']),
    location: unit.location.kind === 'bench' ? pick(unit.location, ['kind', 'slot'])
      : { kind: 'board' as const, cell: cellView(unit.location.cell) } };
}

/** Current-round display summary, deliberately separate from the private m8.loot authority. */
function revealedLootView(state: MatchState) {
  const round = state.m8.round;
  if (round.kind !== 'pve' || round.roundId !== state.roundDefinitionId || round.ordinal !== state.round) return undefined;
  const plan = state.m8.loot.frozen.rounds.find(value => value.encounterPlan.roundId === round.roundId);
  if (!plan || plan.encounterPlan.encounterId !== round.encounterId) return undefined;
  const revealedDrops = readLootView(state).revealedDrops
    .filter(drop => drop.roundId === round.roundId && drop.encounterId === round.encounterId)
    .map((drop): RevealedDropView => {
      const payload = drop.payload.kind === 'gold' ? pick(drop.payload, ['kind', 'quantity'])
        : pick(drop.payload, ['kind', 'definitionId', 'quantity']);
      const identity = { ...pick(drop, ['dropId', 'encounterId', 'sourceUnitId', 'roundId']), payload };
      switch (drop.status) {
        case 'granted': return { ...identity, status: drop.status, receiptId: drop.receiptId, allowedActions: [] };
        case 'revealed': return { ...identity, status: drop.status, receiptId: null, allowedActions: [], reason: 'auto-grant-in-domain' };
        case 'pending-capacity': return { ...identity, status: drop.status, receiptId: null, allowedActions: [], reason: 'bench-full' };
        case 'retained-terminal': return { ...identity, status: drop.status, receiptId: null, allowedActions: [], reason: 'terminal-bench-full' };
      }
    });
  return { roundId: round.roundId, revealedDrops };
}

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
  return freezeContent({
    ...pick(state, ['schemaVersion', 'rulesVersion', 'contentVersion', 'contentDigest', 'commandProtocolVersion',
      'tickMs', 'round', 'roundDefinitionId', 'phase', 'gold', 'level', 'xp', 'playerHp']),
    ...(revealedLoot ? { revealedLoot } : {}),
    streak: pick(state.streak, ['kind', 'count']),
    shop: { ...pick(state.shop, ['generation', 'locked']), slots: state.shop.slots.map(slot => slot.status === 'available'
      ? pick(slot, ['status', 'definitionId']) : pick(slot, ['status', 'empty'])) },
    preparation: { board: boardView(state.preparation.board), benchSize: state.preparation.benchSize,
      units: [...units, ...enemies].map(preparationUnitView) },
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
        'playerDamage', 'hpLost', 'hpBefore', 'hpAfter', 'goldBefore', 'goldAfter', 'income', 'interestBasis', 'xpAwarded',
        'levelBefore', 'levelAfter', 'xpBefore', 'xpAfter']),
      incomeBreakdown: pick(result.incomeBreakdown, ['base', 'win', 'interest', 'streak']) })),
    m8: { round: pick(state.m8.round, ['roundId', 'ordinal', 'stage', 'subround', 'kind', 'encounterId', 'displayName']),
      ...(preview ? { preparation: { ...pick(preview, ['roundId', 'encounterId']),
        enemies: enemies.map(preparationUnitView) } } : {}) },
  });
}
export type PrivateSeatView = ReturnType<typeof toPrivateSeatView>;
