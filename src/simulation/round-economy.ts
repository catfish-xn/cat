import { planRoundEconomy, type RoundEconomyInput, type RoundEconomyPlan } from './economy';
import { planCatalogRoundEconomy } from './opening-economy';
import { getMultiplayerRoundById } from './multiplayer-round';
import { FINAL_ROUND } from './round-schedule';

/** Shared catalog/opening/overtime routing for settlement and read-only previews. */
export function resolveRoundEconomy(input: Omit<RoundEconomyInput, 'stage' | 'roundKind'> & { readonly roundId: string }): RoundEconomyPlan {
  const round = getMultiplayerRoundById(input.roundId);
  return round.ordinal <= FINAL_ROUND ? planCatalogRoundEconomy(input)
    : planRoundEconomy({ ...input, stage: round.stage, roundKind: round.kind });
}
