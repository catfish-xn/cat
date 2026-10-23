import { G24_FORGE_POOLS } from './content/g2-4-forges';
import { nextRandom, validateSeed } from './rng';
import { getCatalogRoundById } from './round-selectors';
import { grantMechanicGold, grantMechanicItem } from './seat-mechanics/grants';
import { appendMechanicReceipt } from './seat-mechanics/state';
import { forfeitUnclaimedOrbs } from './orb-claim';
import type { MatchState, MatchEvent } from './match-types';
import type { OpeningEffectFact, OpeningEffectReceipt } from './opening-encounter';

export const MONKEY_NODE = '3-5';
export const MONKEY_OUTCOMES = ['damage', 'gold', 'masterwork', 'components'] as const;
export type MonkeyOutcome = typeof MONKEY_OUTCOMES[number];
export const MONKEY_ROUND = getCatalogRoundById(MONKEY_NODE).ordinal;
const source = 'opening-encounter-monkey';
function stream(seed: number, name: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) hash = Math.imul(hash ^ name.charCodeAt(i), 0x01000193) >>> 0;
  return (seed ^ hash) >>> 0;
}
export function selectMonkeyOutcomeFromWord(word: number): MonkeyOutcome {
  validateSeed(word);
  return MONKEY_OUTCOMES[Math.floor(word / 1073741824)];
}
export function monkeyOutcome(seed: number): MonkeyOutcome {
  validateSeed(seed);
  return selectMonkeyOutcomeFromWord(nextRandom(stream(seed, 'opening-encounter-v1/shared/wind-up-monkey/outcome')).word);
}
export function monkeyComponents(seed: number, seatId: string): readonly string[] {
  const pool = G24_FORGE_POOLS.TFT_ArmoryKeyComponent;
  let rng = stream(seed, `opening-encounter-v1/seat/${seatId}/wind-up-monkey/components`);
  return Array.from({length: 4}, () => {const draw = nextRandom(rng); rng = draw.state; return pool[Math.floor(draw.word * pool.length / 4294967296)];});
}
export function monkeyReceipt(state: MatchState): OpeningEffectReceipt | undefined {
  const opening = state.openingEncounter;
  if (opening.mode === 'shared-deferred') return undefined;
  const selection = opening.mode === 'solo' ? opening.context.selection : opening.selection;
  return selection.encounterId === 'wind-up-monkey' ? opening.receipts.find(r => r.nodeId === MONKEY_NODE) : undefined;
}
/** Only a complete apply transaction may publish this state. No combat receipts or income are fabricated. */
export function applyMonkey(state: MatchState, fact: OpeningEffectFact, receipt: OpeningEffectReceipt): {state: MatchState; events: readonly MatchEvent[]} {
  const outcome = fact.outcome!;
  if (outcome === 'damage') {
    const playerHp = Math.max(0, state.playerHp - 10);
    if (state.phase !== 'preparation') throw new RangeError('Invalid monkey phase');
    const next: MatchState = {...state, playerHp,
      ...(playerHp === 0 ? state.multiplayer
        ? {multiplayer: {...state.multiplayer, status: 'eliminated' as const}}
        : {phase: 'gameOver' as const, outcome: 'defeat' as const} : {})};
    const forfeited = playerHp === 0 ? forfeitUnclaimedOrbs(next) : {state: next, events: []};
    return {state: forfeited.state, events: [{type: 'openingMonkeyResolved', receiptId: receipt.receiptId,
      outcome, hpBefore: state.playerHp, hpAfterRaw: state.playerHp - 10, hpAfter: playerHp}, ...forfeited.events]};
  }
  if (outcome === 'masterwork') {
    const consumableId = `consumable-${state.nextConsumableSerial}`;
    if (!Number.isSafeInteger(state.nextConsumableSerial + 1)) throw new RangeError('Invalid tool serial');
    const grant = {kind: 'consumable' as const, receiptId: receipt.receiptId, source, round: state.round,
      roundId: MONKEY_NODE, consumableId, definitionId: 'masterwork-upgrade' as const};
    return {state: appendMechanicReceipt({...state, nextConsumableSerial: state.nextConsumableSerial + 1,
      consumables: [...state.consumables, {consumableId, definitionId: 'masterwork-upgrade'}]}, grant), events: [{type: 'mechanicGranted', receipt: grant}]};
  }
  if (outcome === 'gold') {
    const granted = grantMechanicGold(state, {receiptId: receipt.receiptId, source, amount: 25});
    if (!granted.ok) throw new RangeError(granted.reason);
    return granted;
  }
  const events: MatchEvent[] = [];
  for (const [index, definitionId] of monkeyComponents(state.augmentTierSeed, state.sharedPool?.seatId ?? 'solo').entries()) {
    const granted = grantMechanicItem(state, {receiptId: `${receipt.receiptId}/component/${index}`, source, definitionId});
    if (!granted.ok) throw new RangeError(granted.reason);
    state = granted.state; events.push(...granted.events);
  }
  return {state, events};
}
/** Strict source coverage, including consumed tools and components which have since combined or moved. */
export function validateMonkeyGrants(state: MatchState, fact?: OpeningEffectFact): void {
  const check = (v: unknown) => {if (!v) throw new RangeError('Invalid monkey grant');};
  const receipt = monkeyReceipt(state), grants = (state.seatMechanics?.receipts ?? []).filter(r => r.source === source
    || r.receiptId.includes('wind-up-monkey') || r.kind === 'consumable' && r.definitionId === 'masterwork-upgrade');
  if (!receipt) {check(grants.length === 0); return;}
  check(fact && fact.factId === receipt.factId);
  const outcome = fact!.outcome;
  check(grants.length === (outcome === 'damage' ? 0 : outcome === 'components' ? 4 : 1));
  const components = monkeyComponents(state.augmentTierSeed, state.sharedPool?.seatId ?? 'solo');
  grants.forEach((r, index) => {
    check(r.source === source && r.round === MONKEY_ROUND && r.roundId === MONKEY_NODE
      && r.receiptId === receipt.receiptId + (outcome === 'components' ? `/component/${index}` : ''));
    if (outcome === 'gold') check(r.kind === 'gold' && r.amount === 25);
    if (outcome === 'masterwork') check(r.kind === 'consumable' && r.definitionId === 'masterwork-upgrade');
    if (outcome === 'components') check(r.kind === 'item' && r.definitionId === components[index]
      && state.resourceProvenance.entries.some(e => e.kind === 'item-acquired' && e.itemId === r.itemId
        && e.source.kind === 'mechanic' && e.source.receiptId === r.receiptId));
  });
  if (outcome === 'damage') {
    const hpBefore = state.roundResults.find(r => r.round === MONKEY_ROUND - 1)?.hpAfter;
    check(Number.isSafeInteger(receipt.hpBefore) && receipt.hpBefore! > 0 && receipt.hpBefore! <= 100
      && (hpBefore === undefined || receipt.hpBefore === hpBefore));
    const hpAfter = Math.max(0, receipt.hpBefore! - 10);
    const result = state.roundResults.find(r => r.round === MONKEY_ROUND);
    if (result) check(result.hpBefore === hpAfter);
    else if (state.round === MONKEY_ROUND) check(state.playerHp === hpAfter);
    if (hpAfter === 0) check(!result && state.round === MONKEY_ROUND && state.playerHp === 0
      && (state.multiplayer ? state.multiplayer.status === 'eliminated' : state.phase === 'gameOver'));
  } else check(!Object.hasOwn(receipt, 'hpBefore'));
}
/** HP at a preparation boundary; strict restore uses this only after authenticating the opening receipt. */
export function openingHpBeforeRound(state: MatchState, roundId: string, hp: number): number {
  return roundId === MONKEY_NODE && monkeyReceipt(state)?.hpBefore !== undefined ? Math.max(0, hp - 10) : hp;
}
