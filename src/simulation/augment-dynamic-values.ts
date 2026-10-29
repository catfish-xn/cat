import type { MatchState } from './match-types';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { AUGMENT_BRONZE_THRESHOLDS } from './content/augment-policy';
import { batch2Values } from './content/augment-pool-batch2';
import { AUGMENT_BATCH3, batch3Count, magicRollKind, callToChaosOutcome } from './content/augment-pool-batch3';
import { AUGMENT_BATCH4 } from './content/augment-pool-batch4';
import { planAugmentGifts } from './augment-gift-plan';
import { readG23Progress } from './g2-3-state';
import { starryChanceBps } from './shop-augments';
import { buildStrategySnapshot } from './strategy-snapshot';
import { pumpingUpRounds } from './augment-effects';
import { outcomeReward, outcomeAcquisitionXp, outcomeFreeRerolls } from './augment-pool-batch3-progress';
import { portfolioRoundGold } from './augment-pool-batch5-h4';
import { lunchMoneyDamage } from './augment-pool-batch5-h7';
import { forwardThinkingReceiptId } from './augment-pool-batch5-h8';
import { gloriousEvolutionCapRoundId, gloriousEvolutionProgress } from './augment-pool-batch5-s8b';
import { AUGMENT_BATCH5_H8 } from './content/augment-pool-batch5-h8';
import { AUGMENT_BATCH5_S8B } from './content/augment-pool-batch5-s8b';
import { ROUND_CATALOG } from './content/round-catalog';
import { ghostFriendsGrowth } from './augment-pool-batch5-g2';

export type DynamicValue = number | { readonly unit: string } | { readonly outcome: string;
 readonly gifts?: readonly { readonly kind: 'unit'|'item'|'consumable'; readonly definitionId: string; readonly starLevel?: number }[];
 readonly gold?: number; readonly xp?: number; readonly rerolls?: number; readonly health?: number } | null;
export interface AugmentDynamicValue { readonly values?: readonly DynamicValue[]; readonly attackSpeedBps?: number; readonly damageAmpBps?: number; readonly durabilityBps?: number }
export type AugmentDynamicValues = Readonly<Record<string, AugmentDynamicValue>>;

type Owned = MatchState['augments'][number];

/** Current-round trait gold. The acquisition round pays nothing. Missing round-entry stays unknown. */
function portfolioShown(state: MatchState, owner: Owned): number | null {
 if (state.round <= owner.acquiredRound) return 0;
 const entries = state.augmentHistory?.facts.filter(f => f.kind === 'round-entry' && f.round === state.round) ?? [];
 if (entries.length !== 1) return null;
 return portfolioRoundGold(state, owner, state.round);
}

/** Catalog and overtime ids accepted by getMultiplayerRoundById. */
function multiplayerRoundIdResolves(id: string): boolean {
 if (/^overtime-[1-9][0-9]*$/.test(id)) {
  const last = ROUND_CATALOG[ROUND_CATALOG.length - 1].ordinal;
  const ordinal = last + Number(id.slice(9));
  return Number.isSafeInteger(ordinal) && `overtime-${ordinal - last}` === id;
 }
 return ROUND_CATALOG.some(round => round.roundId === id);
}

/** Upgrade count. No helm returns 0. A cap whose round id would throw is still the cap. */
function gloriousShown(state: MatchState): number {
 const capRoundId = gloriousEvolutionCapRoundId(state);
 if (capRoundId !== undefined && !multiplayerRoundIdResolves(capRoundId))
  return AUGMENT_BATCH5_S8B['glorious-evolution'].source.values.NumUpgrades;
 return gloriousEvolutionProgress(state).count;
}

/** Cumulative actual damage. Absent history, or a PvP round with no damage fact, stays unknown. */
function lunchShown(state: MatchState, owner: Owned): number | null {
 const facts = state.augmentHistory?.facts;
 if (!facts) return null;
 for (const result of state.roundResults)
  if (result.round >= owner.acquiredRound && result.roundKind === 'pvp' && !facts.some(f => f.kind === 'player-damage' && f.round === result.round)) return null;
 return lunchMoneyDamage(state, owner);
}

/** Unpaid principal plus 70. A recorded payout receipt shows 0. Absent acquisition evidence stays unknown. */
function forwardShown(state: MatchState, owner: Owned): number | null {
 if (state.seatMechanics?.receipts.some(r => r.receiptId === forwardThinkingReceiptId(owner.choiceId))) return 0;
 const acquired = state.augmentHistory?.facts.find(f => f.kind === 'acquire' && f.choiceId === owner.choiceId && f.definitionId === owner.definitionId && f.round === owner.acquiredRound);
 if (!acquired || acquired.kind !== 'acquire' || !Number.isSafeInteger(acquired.goldBefore) || acquired.goldBefore < 0) return null;
 return acquired.goldBefore + AUGMENT_BATCH5_H8['forward-thinking'].source.values.BaseGold;
}

function ghostValues(state: MatchState): readonly [number, number, number] | readonly [null, null, null] {
 const growth = ghostFriendsGrowth(state);
 return growth ? [growth.healthFlat, growth.attackDamageBps / 100, growth.abilityPower] : [null, null, null];
}

/** Owner-only display projection. Counters are settled battle receipts; the board values describe the next combat. */
export function augmentDynamicValues(state: MatchState): AugmentDynamicValues {
 const ids = new Set([...state.augments.map(a => a.definitionId), ...(state.pendingChoice?.kind === 'augment' ? state.pendingChoice.offers : [])]);
 const result: Record<string, AugmentDynamicValue> = {};
 const counterIds = ['rocket-collection','rocket-collection-plus','scrap-recycling','wealthy-rehab-i','wealthy-rehab-ii','eye-for-an-eye','eye-for-an-eye-plus','what-doesnt-kill-you','warpath'];
 const battles = counterIds.some(id => ids.has(id)) ? readG23Progress(state)?.economyReceipts.filter(r => r.kind === 'battle') ?? [] : [];
 const bronze = [...ids].some(id => id.startsWith('bronze-for-life-'));
 const traits = bronze ? buildStrategySnapshot(state).traits : [];
 for (const id of ids) {
  const owner = state.augments.find(a => a.definitionId === id);
  const a = owner ?? { definitionId: id, choiceId: '', acquiredRound: state.round };
  const relevant = battles.filter(r => r.kind === 'battle' && r.facts.round >= a.acquiredRound);
  if (id.startsWith('pumping-up-')) {
   const effects = AUGMENT_DEFINITIONS[id].effects;
   const base = effects.filter(e => e.kind === 'attackSpeedBps').reduce((n,e) => n + e.bps,0);
   const mechanic = effects.find(e => e.kind === 'mechanic' && e.mechanic === 'pumpingUp');
   const growth = owner && mechanic?.kind === 'mechanic' ? pumpingUpRounds(state, owner) * mechanic.values.attackSpeedBpsPerRound : 0;
   result[id] = { attackSpeedBps: base + growth }; continue;
  }
  if (id === 'starry-night' || id === 'starry-night-plus') { result[id] = { values: [starryChanceBps({augments:[a],level:state.level}) / 100] }; continue; }
  if (id.startsWith('bronze-for-life-')) {
   const count = traits.filter(t => t.team === 'player' && (AUGMENT_BRONZE_THRESHOLDS[t.traitId] ?? []).includes(t.tier)).length;
   const effect = AUGMENT_DEFINITIONS[id].effects.find(e => e.kind === 'mechanic' && e.mechanic === 'bronzeForLife');
   if (effect?.kind === 'mechanic') result[id] = { damageAmpBps: count * effect.values.damageAmpBps, durabilityBps: count * effect.values.durabilityBps };
   continue;
  }
  if (id === 'superstars-i' || id === 'superstars-ii') {
   const effect = AUGMENT_DEFINITIONS[id].effects.find(e => e.kind === 'mechanic' && e.mechanic === 'superstars');
   if (effect?.kind === 'mechanic') result[id] = { values: [(effect.values.baseBps + state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board' && u.starLevel === 3).length * effect.values.per3StarBps) / 100] };
  } else if (id === 'rocket-collection' || id === 'rocket-collection-plus' || id === 'scrap-recycling') {
   const total = relevant.reduce((n,r) => n + (r.facts.batch2?.find(f => f.definitionId === id)?.count ?? 0),0);
   const threshold = id === 'scrap-recycling' ? batch2Values(id).NumScrapItemsConverted : 0;
   result[id] = { values: [threshold ? total % threshold : total] };
  } else if (id === 'wealthy-rehab-i' || id === 'wealthy-rehab-ii') result[id] = { values: [relevant.reduce((n,r) => n + (r.facts.batch3Healing ?? 0),0)] };
  else if (id === 'eye-for-an-eye' || id === 'eye-for-an-eye-plus') {
   const row = AUGMENT_BATCH3[id], total = relevant.reduce((n,r) => n + r.facts.alliedDeaths,0), every = batch3Count(row,'AllyDeaths'), max = batch3Count(row,'NumComponents');
   result[id] = { values: [total >= every * max ? 0 : every - total % every] };
  } else if (id === 'what-doesnt-kill-you') {
   const total = relevant.filter(r => r.facts.roundKind === 'pvp' && r.facts.result === 'loss').length, every = batch3Count(AUGMENT_BATCH3[id],'RoundsPerComponent');
   result[id] = { values: [every - total % every] };
  } else if (id === 'warpath') result[id] = { values: [relevant.reduce((n,r) => n + (r.facts.batch3DamageDealt ?? 0),0)] };
  else if (['an-exalted-adventure','worth-the-wait','worth-the-wait-ii','caretakers-ally'].includes(id)) {
   const row = AUGMENT_BATCH3[id] ?? AUGMENT_BATCH4[id];
   result[id] = { values: owner ? planAugmentGifts(state, owner, row.gifts).filter(g => g.kind === 'unit').map(g => ({unit:g.definitionId})) : Array(id === 'an-exalted-adventure' ? 3 : 1).fill(null) };
  } else if (id === 'magic-roll' || id === 'call-to-chaos') {
   if (!owner || id === 'magic-roll' && !state.augmentProgress.magicRoll) { result[id] = { values: [null] }; continue; }
   const kind = id === 'magic-roll' ? magicRollKind(state.augmentProgress.magicRoll!) : callToChaosOutcome(state,owner);
   const reward = outcomeReward(state,owner), schedule = AUGMENT_BATCH3[id].schedules.findIndex(s => s.counter === 'outcome');
   const gifts = planAugmentGifts(state,{...owner,choiceId:JSON.stringify([owner.choiceId,'batch3',schedule,0])},reward.gifts)
    .map(g => ({kind:g.kind,definitionId:g.definitionId,...(g.starLevel ? {starLevel:g.starLevel} : {})}));
   result[id] = { values: [{outcome:`${id === 'magic-roll' ? 'magic' : 'chaos'}:${kind}`, gifts, gold:reward.gold,
    xp:outcomeAcquisitionXp(state,owner), rerolls:outcomeFreeRerolls(state,owner),
    ...(id === 'magic-roll' && kind === 'health' ? {health:batch3Count(AUGMENT_BATCH3[id],'{3b0ef232}')} : {})}] };
  }
  else if (id === 'diversified-portfolio' || id === 'diversified-portfolio-plus') result[id] = { values: [owner ? portfolioShown(state, owner) : null] };
  else if (id === 'glorious-evolution') result[id] = { values: [owner ? gloriousShown(state) : null] };
  else if (id === 'lunch-money') result[id] = { values: [owner ? lunchShown(state, owner) : null] };
  else if (id === 'forward-thinking') result[id] = { values: [owner ? forwardShown(state, owner) : null] };
  else if (id === 'ghost-of-friends-past') result[id] = { values: owner && state.augmentHistory ? ghostValues(state) : [null, null, null] };
  else if (id === 'forbidden-magic') result[id] = { values: [null] }; // This augment is blocked: no authenticated growth ledger exists.
 }
 return result;
}
