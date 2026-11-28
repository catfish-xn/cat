import type { MatchEvent, MatchState, Shop } from './match-types';
import type { MultiplayerFailure } from './round-settlement';

export const SHARED_POOL_VERSION = 'shared-pool-v3';
/** Riot 14.15 official patch notes, champion bag sizes: 30/25/18/10/9.
 * https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-15-notes/
 * Explicitly adopted by the project for its 19-hero S13 slice on 2026-10-12.
 * This does not claim every historical S13 reward rule was specified on that page. */
export const POOL_CAPACITY_BY_COST = Object.freeze({1:30,2:25,3:18,4:10,5:9,6:9} as const);
export interface SharedPoolBinding { readonly poolId:string; readonly seatId:string; readonly revision:number }
export interface PoolSeat {
  readonly seatId:string; readonly seatIndex:number; readonly revision:number;
  readonly shop:Shop; readonly released:boolean;
}
export interface ShopReservation {
  readonly seatId:string; readonly generation:number; readonly slot:number; readonly definitionId:string;
  /** A 2-star offer reserves three copies. */
  readonly starLevel?:2;
}
export interface PoolHolding {
  readonly seatId:string; readonly unitId:string; readonly definitionId:string;
  /** One immutable source key per base copy, merged using actual upgrade events. */
  readonly sources:readonly string[];
}
export interface RewardReservation {
  readonly starLevel?: 1 | 2 | 3;
  readonly seatId:string; readonly dropId:string; readonly receiptId:string; readonly definitionId:string;
}
export interface PoolRewardReceipt extends RewardReservation {
  readonly resolution:'held'|'gold'|'capacity-sold'|'forfeited'; readonly gold:number;
}
export interface SharedPoolState {
  /** Sole shared encounter authority. Seats carry only its selection binding. */
  readonly openingEncounter: import('./opening-encounter').OpeningEncounterContext;
  readonly carouselParticipants: readonly import('./carousel-types').CarouselParticipant[];
  readonly carouselReservations: readonly import('./carousel-types').CarouselReservation[];
  readonly carouselReceipts: readonly import('./carousel-types').CarouselReceipt[];
  readonly carouselRounds: readonly import('./carousel-types').CarouselRoundId[];
  readonly orbLayout: import('./orb-layout').OrbLayoutLedger;
  readonly version:typeof SHARED_POOL_VERSION; readonly poolId:string; readonly seed:number;
  readonly seatCount:number; readonly revision:number;
  readonly initial:Readonly<Record<string,number>>; readonly available:Readonly<Record<string,number>>;
  readonly seats:readonly PoolSeat[]; readonly shops:readonly ShopReservation[];
  readonly holdings:readonly PoolHolding[]; readonly pending:readonly RewardReservation[];
  readonly rewards:readonly PoolRewardReceipt[];
  readonly naturalRound:number;
  /** Fixed seeded permutation, rotated one place per natural round. */
  readonly order:readonly string[];
}
export type SharedPoolFailure = MultiplayerFailure | 'invalid-pool' | 'invalid-seat-state' | 'stale-seat'
  | 'pool-empty' | 'empty-slot' | 'already-generated' | 'duplicate-release' | 'incomplete-seats'
  | 'stale-refresh' | 'not-eliminated' | 'invalid-command' | import('./orb-layout').OrbLayoutFailure;
export type SharedPoolEvent =
  | { readonly type:'sharedShopGenerated'; readonly seatId:string; readonly generation:number; readonly rngDraws:number }
  | { readonly type:'sharedRewardReserved'; readonly seatId:string; readonly dropId:string }
  | { readonly type:'sharedRewardResolved'; readonly receipt:PoolRewardReceipt }
  | { readonly type:'sharedSeatReleased'; readonly seatId:string }
  | { readonly type:'sharedRefreshOrder'; readonly round:number; readonly seatIds:readonly string[] };
export type SharedPoolResult =
  | { readonly ok:true; readonly pool:SharedPoolState; readonly state:MatchState; readonly events:readonly MatchEvent[]; readonly poolEvents:readonly SharedPoolEvent[] }
  | { readonly ok:false; readonly pool:SharedPoolState; readonly state:MatchState; readonly reason:SharedPoolFailure };
export interface OpeningRoundResolution {
  readonly nodeId: '3-5'; readonly outcome: import('./opening-monkey').MonkeyOutcome;
  readonly eliminated: readonly {readonly seatId:string; readonly rank:number; readonly hpBefore:number; readonly hpAfterRaw:number}[];
  /** If ended, these are the ranks of THIS batch. Append previously eliminated seats' already-fixed ranks. */
  readonly ended: boolean; readonly survivorRanks: readonly {readonly seatId:string; readonly rank:number}[];
}
export type SharedPoolBatchResult =
  | { readonly ok:true; readonly pool:SharedPoolState; readonly states:readonly MatchState[];
      readonly events:readonly {readonly seatId:string;readonly events:readonly MatchEvent[]}[]; readonly poolEvents:readonly SharedPoolEvent[]; readonly openingResolution?:OpeningRoundResolution }
  | { readonly ok:false; readonly pool:SharedPoolState; readonly states:readonly MatchState[]; readonly reason:SharedPoolFailure };
export type SharedMatchCommand =
  | {readonly type:'buyXp'}
  | {readonly type:'openAnvil';readonly unitId:string}
  | {readonly type:'claimOrb';readonly round:number;readonly orbId:string}
  /** `augmentBlocked`: server-computed externalAugmentBlocks for the seat; never taken from a client. */
  | {readonly type:'rerollAugment';readonly choiceId:string;readonly generation:number;readonly optionIndex:number;readonly augmentBlocked?:readonly string[]}
  | {readonly type:'useConsumable';readonly consumableId:string;readonly target:import('./consumable-types').ConsumableTarget}
  | {readonly type:'settleRound';readonly receipt:import('./round-settlement').RoundSettlementReceipt}
  | {readonly type:'settleCombatStream';readonly terminal:import('./combat-types').CombatState}
  | {readonly type:'startCombat'} | {readonly type:'startPlaceholderCombat'} | {readonly type:'stepPlaceholderCombat'} | {readonly type:'step'}
  | {readonly type:'choose';readonly choiceId:string;readonly generation:number;readonly definitionId:string}
  | {readonly type:'timeoutChoice';readonly round:number;readonly choiceId:string|null;readonly generation:number|null}
  | {readonly type:'claimLoot';readonly round:number};
