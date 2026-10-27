import type { MatchState } from './match-types';
import type { OrbPlan } from './loot-types';
import type { OwnedAugment } from './strategy-types';
import { PRISMATIC_PIPELINE_REWARDS } from './content/augment-pool-batch5-g5';
import { NEUTRAL_ENCOUNTERS } from './content/neutral-encounters';
import { ROUND_CATALOG } from './content/round-catalog';
import { appendAugmentFact, readAugmentFacts } from './augment-history';
import { batch5G5Draws, BATCH5_G5_SOURCE } from './augment-pool-batch5-g5';
import { sampleOrbBox } from './orb-box';
import { lootOrbId, lootEntryId } from './loot-identity';
import { planAugmentGifts } from './augment-gift-plan';
import { getMultiplayerRoundById } from './multiplayer-round';

/** Derived immutable extra plan. It never changes the table-wide natural layout or ordinary loot stream. */
export function pipelineExtraOrbs(state: MatchState): OrbPlan[] {
  // Batch 5 G5 targets online play; the retained solo path has no extra-orb lifecycle.
  if (!state.multiplayer) return [];
  const owner = state.augments.find(a => a.definitionId === 'prismatic-pipeline');
  if (!owner) return [];
  const round = ROUND_CATALOG.find(r => r.ordinal > owner.acquiredRound && r.kind === 'pve');
  if (!round || round.ordinal > state.round) return [];
  const encounter = NEUTRAL_ENCOUNTERS.find(e => e.roundId === round.roundId)!;
  const sourceUnitId = JSON.stringify(['pve', round.roundId, encounter.encounterId, encounter.slots.map(s => s.slotId).sort()[0]]);
  const natural = state.m8.loot.frozen.rounds.find(r => r.encounterPlan.roundId === round.roundId)?.orbs ?? [];
  const slotOrdinal = Math.max(-1, ...natural.filter(o => o.sourceUnitId === sourceUnitId).map(o => o.slotOrdinal)) + 1;
  const orbId = lootOrbId(round.roundId, encounter.encounterId, sourceUnitId, slotOrdinal);
  const entries = sampleOrbBox(state.seed, orbId, PRISMATIC_PIPELINE_REWARDS.baseTable).payloads.map((payload, entryOrdinal) => ({
    orbId, entryOrdinal, dropId: lootEntryId(orbId, entryOrdinal), roundId: round.roundId, encounterId: encounter.encounterId,
    sourceUnitId, slotOrdinal, status: 'planned' as const, receiptId: null, revealCondition: 'source-killed' as const, payload,
  }));
  return [{ orbId, roundId: round.roundId, encounterId: encounter.encounterId, sourceUnitId, slotOrdinal,
    tier: 'prismatic', templateId: PRISMATIC_PIPELINE_REWARDS.baseTable, entries }];
}
export function preparePipelineOrbs(state: MatchState): MatchState {
  const added = pipelineExtraOrbs(state).flatMap(o => o.entries).filter(e => !state.m8.loot.direct.some(d => d.dropId === e.dropId));
  return !added.length ? state : { ...state, m8: { ...state.m8, loot: { ...state.m8.loot,
    direct: [...state.m8.loot.direct, ...added.map(e => ({ dropId: e.dropId, status: 'planned' as const, receiptId: null }))] } } };
}
/** Called only by the common successful claim path, after its last entry has left the unclaimed list.
 * History, rather than receipt timestamps or a current balance, proves ownership at the opening boundary. */
export function recordPipelineOpening(before: MatchState, after: MatchState, orb: { readonly orbId: string; readonly tier: string }, stillUnclaimed: boolean): MatchState {
  const owner = before.augments.find(a => a.definitionId === 'prismatic-pipeline');
  if (!owner || before === after || orb.tier !== 'prismatic' || stillUnclaimed) return after;
  if (readAugmentFacts(after, 'orb-opened').some(f => f.orbId === orb.orbId)) return after;
  return appendAugmentFact(after, { kind: 'orb-opened', choiceId: owner.choiceId, orbId: orb.orbId, tier: 'prismatic' });
}
export function pipelineBonusForTicket(early: boolean, ticket: number) {
  if (!Number.isInteger(ticket) || ticket < 0 || ticket >= 100) throw new RangeError('Invalid pipeline bonus ticket');
  return early ? PRISMATIC_PIPELINE_REWARDS.early : PRISMATIC_PIPELINE_REWARDS.late[ticket < 34 ? 0 : ticket < 67 ? 1 : 2];
}
export function pipelineBonusPlan(state: MatchState) {
  const owner = state.augments.find(a => a.definitionId === 'prismatic-pipeline');
  if (!owner) return [];
  const early = getMultiplayerRoundById(`2-1`).ordinal === owner.acquiredRound;
  return readAugmentFacts(state, 'orb-opened').filter(f => f.choiceId === owner.choiceId).map(f => {
    const ticket = early ? 0 : batch5G5Draws(state, [owner.choiceId, 'pipeline-bonus', f.orbId], [100])[0];
    const reward = pipelineBonusForTicket(early, ticket);
    const giftOwner: OwnedAugment = { ...owner, acquiredRound: f.round,
      choiceId: JSON.stringify([owner.choiceId, 'pipeline-bonus', f.orbId]) };
    return { round: f.round, orbId: f.orbId, reward, giftOwner,
      receiptId: JSON.stringify([BATCH5_G5_SOURCE, owner.choiceId, 'pipeline-bonus', f.orbId]) };
  });
}
export function pipelineGiftPlan(state: MatchState) {
  return pipelineBonusPlan(state).flatMap(p => planAugmentGifts(state, p.giftOwner, p.reward.gifts));
}
export function pipelineGoldPlan(state: MatchState) { return pipelineBonusPlan(state).filter(p => p.reward.gold); }

/** Defence in depth beside the history API's independent server authority / solo command replay. */
export function validatePipelineHistory(state: MatchState): void {
  const owner = state.augments.find(a => a.definitionId === 'prismatic-pipeline');
  const facts = state.augmentHistory?.facts.filter(f => f.kind === 'orb-opened') ?? [];
  if (!facts.length) return;
  if (!owner || new Set(facts.map(f => f.kind === 'orb-opened' ? f.orbId : '')).size !== facts.length
    || facts.some(f => f.kind !== 'orb-opened' || f.choiceId !== owner.choiceId || f.tier !== 'prismatic'
      || f.round < owner.acquiredRound || typeof f.orbId !== 'string' || !f.orbId.length))
    throw new RangeError('Invalid prismatic pipeline opening history');
}

