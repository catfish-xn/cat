import { ITEM_DEFINITIONS } from '../content/g2-3-item-registry';
import { planPermanentItemGrant } from '../item-grants';
import type { MatchEvent, MatchFailure, MatchState } from '../match-types';
import { appendResourceProvenance } from '../resource-provenance';
import { getRoundKind } from '../round-schedule';
import { getMultiplayerRoundByOrdinal } from '../multiplayer-round';
import type { PendingChoice } from '../strategy-types';
import { appendMechanicReceipt, findMechanicReceipt } from './state';
import { CHOICE_SKIP_OPTION, MECHANIC_CHOICE_KINDS, type MechanicChoiceKind, type MechanicChoicePayload, type MechanicChoiceSpec,
  type MechanicPendingChoice, type MechanicReceipt } from './types';

export function isMechanicChoiceKind(kind: unknown): kind is MechanicChoiceKind {
  return (MECHANIC_CHOICE_KINDS as readonly unknown[]).includes(kind);
}
export function isMechanicChoice(choice: PendingChoice | null | undefined): choice is MechanicPendingChoice {
  return !!choice && isMechanicChoiceKind(choice.kind);
}
/** What a timeout (and the basic bot) picks: mechanic payload.timeoutOption, otherwise the existing first offer. */
export function choiceTimeoutOption(choice: PendingChoice): string | undefined {
  return isMechanicChoice(choice) ? choice.payload.timeoutOption : choice.offers[0];
}

const nonempty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
/** Throws RangeError on a malformed spec. Shared by openMechanicChoice and save restore. */
export function validateMechanicChoiceSpec(kind: MechanicChoiceKind, offers: readonly string[], payload: MechanicChoicePayload): void {
  const fail = (message: string): never => { throw new RangeError(`Invalid mechanic choice: ${message}`); };
  if (!payload || payload.kind !== kind || !nonempty(payload.source)) fail('payload kind/source');
  if (!Array.isArray(offers) || !offers.length || !offers.every(nonempty)
    || new Set(offers).size !== offers.length && !(kind === 'forge' && payload.source === 'augment-pool-batch5-r1')
    || offers.includes(CHOICE_SKIP_OPTION)) fail('offers');
  if (kind !== 'armory' && !(payload.kind==='blackMarket'&&payload.grantItem===false) && !offers.every(id => Object.hasOwn(ITEM_DEFINITIONS, id))) fail('item offers');
  const skippable = payload.kind === 'blackMarket' && payload.skippable;
  if (payload.kind === 'blackMarket') {
    if(payload.grantItem!==undefined&&typeof payload.grantItem!=='boolean')fail('grant item');
    if (typeof payload.skippable !== 'boolean') fail('skippable');
    if (payload.skipReward !== null && (!nonempty(payload.skipReward?.kind) || !count(payload.skipReward.amount))) fail('skip reward');
    if (!payload.skippable && payload.skipReward !== null) fail('skip reward without skip');
  }
  if (payload.kind === 'armory') {
    const keys = Object.keys(payload.prices ?? {});
    if (keys.length !== offers.length || !offers.every(id => Object.hasOwn(payload.prices, id) && count(payload.prices[id]))) fail('prices');
    // A timeout never spends gold the player did not choose to spend.
    if (payload.prices[payload.timeoutOption] !== 0) fail('armory timeout must be free');
  }
  if (!(offers.includes(payload.timeoutOption) || skippable && payload.timeoutOption === CHOICE_SKIP_OPTION)) fail('timeout option');
}

export type MechanicChoiceResult = { readonly ok: true; readonly state: MatchState; readonly events: readonly MatchEvent[] }
  | { readonly ok: false; readonly state: MatchState; readonly reason: MatchFailure };

/**
 * Opens a blocking mechanic choice, like an augment: phase 'choice', the player answers with `choose`, and a timeout
 * resolves it with payload.timeoutOption. The UI may collapse it; the round cannot leave the phase until it resolves.
 * preparation-return: from phase 'preparation'. settlement-return: from phase 'settlement', combat kept.
 * Refused in supply rounds and while another choice is pending. Pure; the caller stamps the events through Match.
 */
export function openMechanicChoice(state: MatchState, spec: MechanicChoiceSpec): MechanicChoiceResult {
  const refuse = (reason: MatchFailure): MechanicChoiceResult => ({ ok: false, state, reason });
  if (state.pendingChoice || state.phase !== spec.returnPhase || (state.multiplayer ? getMultiplayerRoundByOrdinal(state.round).kind : getRoundKind(state.round)) === 'supply') return refuse('wrong-phase');
  if (!nonempty(spec.choiceId) || findMechanicReceipt(state, spec.choiceId)) return refuse('duplicate-mechanic-receipt');
  try { validateMechanicChoiceSpec(spec.payload?.kind, spec.offers, spec.payload); } catch { return refuse('invalid-mechanic-state'); }
  const pendingChoice: MechanicPendingChoice = { kind: spec.payload.kind, step: 'offer', choiceId: spec.choiceId, eventId: spec.choiceId,
    generation: 0, offers: [...spec.offers], targetId: null, rerollCount: 0, returnPhase: spec.returnPhase, payload: structuredClone(spec.payload) };
  const next = { ...state, phase: 'choice', combat: spec.returnPhase === 'settlement' ? state.combat : null, pendingChoice } as MatchState;
  return { ok: true, state: next, events: [{ type: 'choiceOpened', choice: pendingChoice }] };
}

/**
 * Resolves the pending mechanic choice with `optionId` (already checked against choiceId/generation by selectChoice).
 * forge / blackMarket item: grants that item (provenance source mechanic, receiptId = choiceId).
 * blackMarket CHOICE_SKIP_OPTION: grants nothing, receipt skipped:true (the mechanic pays skipReward from it).
 * armory: charges prices[optionId]; the receipt is the purchase record.
 * Leaves pendingChoice null with phase still 'choice'; Match then continues to returnPhase.
 */
export function resolveMechanicChoice(state: MatchState, optionId: string, timedOut = false): MechanicChoiceResult {
  const choice = state.pendingChoice;
  const refuse = (reason: MatchFailure): MechanicChoiceResult => ({ ok: false, state, reason });
  if (!isMechanicChoice(choice)) return refuse('invalid-choice');
  const payload = choice.payload;
  const skipped = optionId === CHOICE_SKIP_OPTION;
  if (skipped && !(payload.kind === 'blackMarket' && payload.skippable)) return refuse('choice-not-skippable');
  if (!skipped && (typeof optionId !== 'string' || !choice.offers.includes(optionId))) return refuse('invalid-choice');
  if (findMechanicReceipt(state, choice.choiceId)) return refuse('duplicate-mechanic-receipt');
  const price = payload.kind === 'armory' ? payload.prices[optionId] : 0;
  if (state.gold < price) return refuse('insufficient-gold');
  let next: MatchState = { ...state, gold: state.gold - price, pendingChoice: null } as MatchState;
  let itemId: string | null = null;
  if (payload.kind !== 'armory' && !(payload.kind==='blackMarket'&&payload.grantItem===false) && !skipped) {
    const grant = planPermanentItemGrant(next, { definitionId: optionId, receiptId: choice.choiceId }, []);
    if (!grant.ok) return refuse('invalid-choice');
    itemId = grant.grantedItemIds[0];
    next = { ...grant.state, resourceProvenance: appendResourceProvenance(next.resourceProvenance, next.roundDefinitionId,
      { kind: 'item-acquired', itemId, source: { kind: 'mechanic', receiptId: choice.choiceId } }) };
  }
  const receipt: MechanicReceipt = { kind: 'choice', receiptId: choice.choiceId, round: state.round, roundId: state.roundDefinitionId,
    source: payload.source, choiceKind: choice.kind, optionId, skipped, price, itemId, timedOut };
  next = appendMechanicReceipt(next, receipt);
  return { ok: true, state: next, events: [
    { type: 'choiceSelected', choiceId: choice.choiceId, definitionId: optionId, unitId: null },
    { type: 'mechanicGranted', receipt },
  ] };
}

/** Save restore: a pending mechanic choice must be well formed and not yet receipted. */
export function validateMechanicPendingChoice(state: MatchState): void {
  const choice = state.pendingChoice;
  if (!isMechanicChoice(choice)) throw new RangeError('Invalid mechanic choice');
  if (choice.step !== 'offer' || choice.choiceId !== choice.eventId || choice.generation !== 0 || choice.rerollCount !== 0
    || choice.targetId !== null || !['preparation', 'settlement'].includes(choice.returnPhase)
    || findMechanicReceipt(state, choice.choiceId)) throw new RangeError('Invalid mechanic choice substate');
  validateMechanicChoiceSpec(choice.kind, choice.offers, choice.payload);
}
