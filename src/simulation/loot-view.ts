import type { MatchState } from './match-types';
import type { LootView, RevealedDropView } from './m8/ui-contracts';
import { compareLootFreezeSlots, compareLootChoices } from './loot-identity';
import { hasPendingLootCapacity, unresolvedLootChoices } from './loot-runtime';
import { freezeContent } from './content/freeze';

/**
 * Public current-round loot projection (M8_UI_CONTRACT §5). Planned and
 * forfeited drops, unresolved choice fallbacks, frozen future rounds and loot
 * RNG never enter the view; a component choice appears only once its receipt
 * exists. Pure read: no state, RNG or event changes.
 */
export function readLootView(state: Readonly<MatchState>): LootView {
  const loot = state.m8.loot, roundId = state.roundDefinitionId;
  const plan = loot.frozen.rounds.find(value => value.encounterPlan.roundId === roundId);
  const drops: RevealedDropView[] = [];
  for (const drop of [...plan?.encounterPlan.drops ?? []].sort(compareLootFreezeSlots)) {
    const progress = loot.direct.find(value => value.dropId === drop.dropId);
    const identity = { dropId: drop.dropId, encounterId: drop.encounterId, sourceUnitId: drop.sourceUnitId, roundId: drop.roundId, payload: { ...drop.payload } };
    if (progress?.status === 'granted') drops.push({ ...identity, status: 'granted', receiptId: progress.receiptId, allowedActions: [] });
    else if (progress?.status === 'revealed') drops.push({ ...identity, status: 'revealed', receiptId: null, allowedActions: [], reason: 'auto-grant-in-domain' });
    else if (progress?.status === 'pending-capacity') drops.push({ ...identity, status: 'pending-capacity', receiptId: null, allowedActions: [], reason: 'bench-full' });
    else if (progress?.status === 'retained-terminal') drops.push({ ...identity, status: 'retained-terminal', receiptId: null, allowedActions: [], reason: 'terminal-bench-full' });
  }
  for (const choice of [...plan?.choices ?? []].sort(compareLootChoices)) {
    const resolution = loot.choiceResolutions.find(value => value.dropId === choice.dropId);
    const receipt = resolution && loot.receipts.find(value => value.receiptId === resolution.receiptId);
    if (!receipt) continue;
    drops.push({ dropId: choice.dropId, encounterId: choice.encounterId, sourceUnitId: choice.sourceUnitId, roundId: choice.roundId,
      payload: { ...receipt.payload }, status: 'granted', receiptId: receipt.receiptId, allowedActions: [] });
  }
  const pendingClaims = state.phase === 'gameOver' ? [] : drops.filter(drop => drop.status === 'pending-capacity').map(drop => drop.dropId);
  // Same order as nextRound's guards, so the hint never disagrees with the command.
  const reason: LootView['reason'] = state.phase === 'gameOver' ? 'game-over'
    : state.phase !== 'settlement' ? 'unsettled-round'
      : hasPendingLootCapacity(state as MatchState) ? 'pending-capacity'
        : unresolvedLootChoices(state as MatchState).length || state.roundResults.length !== state.round
          || state.roundResults.at(-1)?.round !== state.round ? 'unsettled-round' : null;
  return freezeContent({ roundId, revealedDrops: drops, pendingClaims, canContinue: reason === null, reason });
}
