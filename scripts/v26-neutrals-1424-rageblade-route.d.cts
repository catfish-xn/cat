import type * as Match from '../src/simulation/match';
export const SEED: number;
export const ROUND: string;
export function prefix(api: typeof Match, onChoice?: (before: Match.MatchState, after: Match.MatchState, pick: string) => void): Match.MatchState;
