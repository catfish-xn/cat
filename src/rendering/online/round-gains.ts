/**
 * "本轮获得" for online play (work order C7). The private seat view carries no loot ledger (contract §14.1), so the
 * client compares two authoritative states of my seat in the same round: the last one before the battle (end of
 * preparation; the first state of a round that opens with a choice) and the current one. Whatever appeared in
 * between is shown: new units (loot heroes), new inventory items (loot components, picks) and the gold that arrived
 * before the round's income (gold drops). Nothing here grants, settles or names a drop's source; it only lists the
 * difference of two server states. SR-C7-02 asks the rules for the real drop receipts to replace this.
 */
import type { MatchState } from '../../simulation/match-types';

export interface RoundGains {
  readonly round: number;
  readonly units: readonly { readonly id: string; readonly definitionId: string; readonly starLevel: number }[];
  readonly items: readonly { readonly id: string; readonly definitionId: string }[];
  /** Gold received during the round before the settlement income (0 when none). */
  readonly gold: number;
}

/** Baseline of one round: null when it was first seen after its battle settled (a resume mid-round), so gains are unknown. */
export interface RoundBaseline { readonly round: number; readonly state: MatchState | null }

/**
 * Next baseline after a new authoritative state. A round's baseline is its latest pre-battle state: every
 * preparation state of the round, or the first state of a round that starts with a choice, as long as the
 * round has no settlement record yet.
 */
export function nextBaseline(previous: RoundBaseline | null, state: MatchState): RoundBaseline {
  const settled = state.roundResults.some(result => result.round === state.round);
  if (!previous || previous.round !== state.round) return { round: state.round, state: settled ? null : state };
  if (previous.state && state.phase === 'preparation' && !settled) return { round: state.round, state };
  return previous;
}

/** What my seat gained this round, or null while the battle is still ahead or the baseline is unknown. */
export function readRoundGains(baseline: RoundBaseline | null, current: MatchState): RoundGains | null {
  if (!baseline?.state || baseline.round !== current.round || current.phase === 'preparation' || current.phase === 'combat') return null;
  const before = baseline.state;
  const unitIds = new Set(before.preparation.units.map(unit => unit.id));
  const itemIds = new Set(before.items.map(item => item.id));
  const units = current.preparation.units.filter(unit => unit.team === 'player' && !unitIds.has(unit.id))
    .map(unit => ({ id: unit.id, definitionId: unit.definitionId, starLevel: unit.starLevel }));
  const items = current.items.filter(item => item.location.kind === 'inventory' && !itemIds.has(item.id))
    .map(item => ({ id: item.id, definitionId: item.definitionId }));
  // Gold cannot be spent between the preparation deadline and the settlement: any rise before the income is a drop.
  const record = current.roundResults.find(result => result.round === current.round);
  const gold = Math.max(0, (record ? record.goldBefore : current.gold) - before.gold);
  return { round: current.round, units, items, gold };
}
