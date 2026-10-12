/**
 * Display adapter for the server's private seat view (work order B7, contract §14.1). The server sends
 * `toPrivateSeatView`, a whitelisted subset of MatchState; the existing panels and BoardScene read a
 * MatchState. This fills every field the view leaves out with an inert placeholder so the reviewed
 * selectors (deployment cap/count, traits, inventory, own equipment, unit stats, XP/odds/interest,
 * visible round info) keep working. Nothing here flows back: commands carry only ids and generations,
 * and the server decides every result on its own state.
 *
 * Placeholders that cannot be faithful (contract §14.1 "不能靠占位保真"): no RNG, no encounter plan or
 * enemy preview, no loot ledger, no schedule receipts, no combat runtime. `isFinal` is always false and
 * must never decide the match; the room's ranking does.
 */
import { createMatch } from '../../simulation/match';
import type { MatchState, RoundResult } from '../../simulation/match-types';
import type { PrivateSeatView } from '../../server-entry';

let shell: MatchState | null = null;
/** Neutral MatchState skeleton for the fields a seat view does not carry; built once, never mutated. */
function placeholderShell(): MatchState {
  if (shell) return shell;
  const base = createMatch(0);
  const loot = base.m8.loot;
  shell = {
    ...base,
    m8: { ...base.m8, encounterPlan: null, loot: { ...loot, direct: [], choiceEligibility: [], choiceResolutions: [], earnedEvidence: [], receipts: [] } },
    scheduleReceipts: [],
    combat: null, combatInputBasis: null, outcome: null,
  } as MatchState;
  return shell;
}

/**
 * MatchState-shaped display copy of my seat view. Fields of the view win; anything else is a placeholder.
 * Round records miss the server-only bookkeeping (settlementId, roundKind, interest basis, streaks, XP
 * requested); they stay absent and the panels print only what is there.
 */
export function toDisplayMatch(view: PrivateSeatView): MatchState {
  const base = placeholderShell();
  const round = { ...view.m8.round, isFinal: false };
  return {
    ...base,
    ...view,
    preparation: { ...view.preparation, units: view.preparation.units.map(unit => ({ ...unit })) },
    roundResults: view.roundResults as unknown as readonly RoundResult[],
    m8: {
      ...base.m8,
      round,
      preparation: { ...base.m8.preparation, roundId: view.roundDefinitionId, encounterId: null, contentStatus: 'not-pve', enemies: [] },
    },
    combat: null,
  } as unknown as MatchState;
}
