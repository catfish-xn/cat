/**
 * Display adapter for the server's private seat view (work order B7, contract §14.1). The server sends
 * `toPrivateSeatView`, a whitelisted subset of MatchState; the existing panels and BoardScene read a
 * MatchState. This fills every field the view leaves out with an inert placeholder so the reviewed
 * selectors (deployment cap/count, traits, inventory, own equipment, unit stats, XP/odds/interest,
 * visible round info) keep working. Nothing here flows back: commands carry only ids and generations,
 * and the server decides every result on its own state.
 *
 * Placeholders that cannot be faithful (contract §14.1 "不能靠占位保真"): no RNG, no encounter plan, no loot
 * ledger, no schedule receipts, no combat runtime. `isFinal` is always false and must never decide the match;
 * the room's ranking does. The current PvE enemy preview is real (PR #50 whitelist `m8.preparation`): only its
 * static `version`/`contentStatus` are filled in, so readEncounterPreview shows this round's monsters. PvP rounds
 * carry no preparation and keep an empty enemy list (the preview then shows nothing, never a fake opponent).
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
 * Round records miss the server-only bookkeeping (settlementId, roundKind, streaks, XP requested); they stay
 * absent and the panels print only what is there. `interestBasis` is whitelisted (PR #50) and shown as is.
 */
export function toDisplayMatch(view: PrivateSeatView): MatchState {
  const base = placeholderShell();
  const round = { ...view.m8.round, isFinal: false };
  // Present only for this round's public PvE encounter (contract §14.1).
  const preview = 'preparation' in view.m8 ? view.m8.preparation : undefined;
  return {
    ...base,
    ...view,
    preparation: { ...view.preparation, units: view.preparation.units.map(unit => ({ ...unit })) },
    roundResults: view.roundResults as unknown as readonly RoundResult[],
    m8: {
      ...base.m8,
      round,
      preparation: preview
        ? { ...base.m8.preparation, roundId: preview.roundId, encounterId: preview.encounterId, contentStatus: 'ready-b8-loot', enemies: preview.enemies.map(unit => ({ ...unit })) }
        : { ...base.m8.preparation, roundId: view.roundDefinitionId, encounterId: null, contentStatus: 'not-pve', enemies: [] },
    },
    combat: null,
  } as unknown as MatchState;
}
