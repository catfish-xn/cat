import type { MatchState } from './match-types';
import { planAugmentGifts } from './augment-gift-plan';
import { AUGMENT_BATCH5_S8B } from './content/augment-pool-batch5-s8b';
import { getMultiplayerRoundById, getMultiplayerRoundByOrdinal } from './multiplayer-round';

/** The mandatory acquisition Helm's existing authenticated item fact is the selection boundary.
 * Count actual permanent upgrade facts after it, including carousel and deferred merges. */
function scanGloriousUpgrades(state: MatchState): { count: number; capRoundId?: string } {
  const a = state.augments.find(x => x.definitionId === 'glorious-evolution');
  if (!a) return { count: 0 };
  const initial = planAugmentGifts(state, a, AUGMENT_BATCH5_S8B['glorious-evolution'].gifts)[0];
  const marker = state.resourceProvenance.entries.find(e => e.kind === 'item-acquired' && e.source.kind === 'mechanic' && e.source.receiptId === initial.receiptId);
  if (!marker) return { count: 0 };
  let count = 0;
  const cap = AUGMENT_BATCH5_S8B['glorious-evolution'].source.values.NumUpgrades;
  for (const e of state.resourceProvenance.entries) {
    if (e.sequence <= marker.sequence) continue;
    const upgrades = e.kind === 'unit-upgraded' || e.kind === 'unit-upgraded-after-combat' ? [e.event]
      : e.kind === 'carousel-unit-claimed' || e.kind === 'carousel-preparation-settled' ? e.upgrades : [];
    for (const u of upgrades) {
      count += u.toStar - u.fromStar;
      if (count >= cap) return { count: cap, capRoundId: e.roundId };
    }
  }
  return { count };
}
/** Round id read after the upgrade cap. Absent until the cap is met; the progress lookup can throw on it. */
export function gloriousEvolutionCapRoundId(state: MatchState): string | undefined {
  return scanGloriousUpgrades(state).capRoundId;
}
export function gloriousEvolutionProgress(state: MatchState): { count: number; completedRound?: number } {
  const scanned = scanGloriousUpgrades(state);
  if (scanned.capRoundId === undefined) return { count: scanned.count };
  return { count: scanned.count, completedRound: getMultiplayerRoundById(scanned.capRoundId).ordinal };
}
export function gloriousEvolutionRewardPlan(state: MatchState) {
  const a = state.augments.find(x => x.definitionId === 'glorious-evolution');
  const round = gloriousEvolutionProgress(state).completedRound;
  if (!a || round === undefined) return [];
  const owner = (part: string, acquiredRound: number) => ({ ...a, choiceId: JSON.stringify([a.choiceId, 'glorious-evolution', part]), acquiredRound });
  let unitRound = round;
  while (getMultiplayerRoundByOrdinal(unitRound).kind === 'supply') unitRound++;
  return [...planAugmentGifts(state, owner('item', round), [{ kind: 'item', definitionId: 'jeweled-gauntlet' }]),
    ...(unitRound <= state.round ? planAugmentGifts(state, owner('unit', unitRound), [{ kind: 'unit', definitionId: 'viktor' }]) : [])];
}
