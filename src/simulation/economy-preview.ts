import type { MatchState } from './match-types';
import type { EconomyStreak } from './economy';
import { resolveRoundEconomy } from './round-economy';
import { getMultiplayerRoundById } from './multiplayer-round';

export interface RoundEconomyPreviewOutcome {
  /** This round's base gold, excluding victory, interest, streak and loot. */
  readonly base: number;
  readonly interest: number;
  readonly win: number;
  readonly streakGold: number;
  readonly streakAfter: EconomyStreak;
}
export interface RoundEconomyPreview {
  readonly roundId: string;
  readonly gold: number;
  readonly ifWin: RoundEconomyPreviewOutcome;
  readonly ifLoss: RoundEconomyPreviewOutcome;
}

/** Current own-seat resources only; no loot, enemy information or RNG is sampled. */
export function previewRoundEconomy(state: MatchState): RoundEconomyPreview | null {
  // v22: an augment choice open inside preparation is still preparation for the preview.
  const augmentPreparation = state.phase === 'choice' && state.pendingChoice?.kind === 'augment' && state.pendingChoice.returnPhase === 'preparation';
  if (state.phase !== 'preparation' && state.phase !== 'combat' && !augmentPreparation) return null;
  if (state.multiplayer?.status === 'eliminated' || getMultiplayerRoundById(state.roundDefinitionId).kind === 'supply') return null;
  const preview = (result: 'playerWin' | 'enemyWin'): RoundEconomyPreviewOutcome => {
    const plan = resolveRoundEconomy({ augments:state.augments, roundId: state.roundDefinitionId, result, gold: state.gold,
      streak: state.streak, level: state.level, xp: state.xp, hp: state.playerHp, enemySurvivors: 0 });
    return { base: plan.incomeBreakdown.base, interest: plan.incomeBreakdown.interest, win: plan.incomeBreakdown.win,
      streakGold: plan.incomeBreakdown.streak, streakAfter: plan.streakAfter };
  };
  return { roundId: state.roundDefinitionId, gold: state.gold, ifWin: preview('playerWin'), ifLoss: preview('enemyWin') };
}
