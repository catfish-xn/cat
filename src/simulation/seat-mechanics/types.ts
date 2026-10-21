/**
 * G2-3 netcode hooks (MULTIPLAYER_CONTRACT §25, MATCH_CONTRACT「G2-3 机制通用接口」): one generic, owner-visible container for
 * seat-level mechanic state, exactly-once mechanic receipts, three mechanic choice kinds, unit forms and summon flags.
 * Absent from every pre-G2-3 state, save and view; existing matches never create it.
 */
export const SEAT_MECHANICS_VERSION = 'g2-3-seat-mechanics-v1' as const;

/** Plain JSON only: integers for numbers (no floats, NaN or Infinity), no undefined, no functions. */
export type MechanicJson = null | boolean | number | string | readonly MechanicJson[] | { readonly [key: string]: MechanicJson };

/** Stored value; always a MechanicJson (checked on write and restore). Kept opaque so MatchState stays shallow for the type checker. */
export type MechanicValue = unknown;

/** Reserved `seat` keys for G2-3. Other keys are allowed; each key belongs to one mechanic. */
export const SEAT_MECHANIC_KEYS = ['conqueror', 'academy', 'alchemist', 'junkerKing', 'experimentCells', 'radiantConversion'] as const;
export type ReservedSeatMechanicKey = typeof SEAT_MECHANIC_KEYS[number];

/** Who earned a mechanic grant, e.g. 'conqueror-chest', 'high-roller', 'black-market', 'armory'. Free text, non-empty. */
export type MechanicSource = string;

interface ReceiptIdentity {
  /** Unique within this seat's receipts; a second grant with the same id is refused, never paid twice. */
  readonly receiptId: string;
  readonly round: number;
  readonly roundId: string;
  readonly source: MechanicSource;
}
export type MechanicReceipt =
  | (ReceiptIdentity & { readonly kind: 'gold'; readonly amount: number })
  /** `held`: a unit was born (unitId). `gold`: the shared pool had no copy, `gold` = unit cost, like PvE unit loot. */
  | (ReceiptIdentity & { readonly kind: 'unit'; readonly definitionId: string; readonly resolution: 'held' | 'gold' | 'orb'; readonly unitId: string | null; readonly gold: number; readonly orbId?:string; readonly starLevel?:1|2|3 })
  | (ReceiptIdentity & { readonly kind: 'consumable'; readonly definitionId:string; readonly consumableId:string })
  | (ReceiptIdentity & { readonly kind: 'item'; readonly definitionId: string; readonly itemId: string })
  /** One resolved forge/blackMarket/armory choice. receiptId === choiceId. itemId only when the option granted an item. */
  | (ReceiptIdentity & { readonly kind: 'choice'; readonly choiceKind: MechanicChoiceKind; readonly optionId: string;
      readonly skipped: boolean; readonly price: number; readonly itemId: string | null; readonly timedOut: boolean });

export interface SeatMechanicsState {
  readonly version: typeof SEAT_MECHANICS_VERSION;
  /** Owner-visible state, copied verbatim into toPrivateSeatView().seatMechanics.seat. Never put RNG or future offers here. */
  readonly seat: Readonly<Record<string, MechanicValue>>;
  /** Authority-only state (RNG words, future offers). Never projected to any client. */
  readonly hidden: Readonly<Record<string, MechanicValue>>;
  /** Append-only, in grant order. Projected to the owner. */
  readonly receipts: readonly MechanicReceipt[];
}

export type MechanicChoiceKind = 'forge' | 'blackMarket' | 'armory';
export const MECHANIC_CHOICE_KINDS: readonly MechanicChoiceKind[] = ['forge', 'blackMarket', 'armory'];
/** `choose.definitionId` value that skips a skippable black market. Never a valid content id. */
export const CHOICE_SKIP_OPTION = '@skip' as const;

/**
 * forge: offers are item definition ids; choosing one grants that item to inventory.
 * blackMarket: offers are item definition ids; choosing grants it, CHOICE_SKIP_OPTION (only when skippable) grants nothing
 *   and records skipped:true; the mechanic reads skipped receipts to pay `skipReward`.
 * armory: offers are mechanic option ids (not items); choosing charges prices[option] gold and records the receipt only.
 * timeoutOption: what a timeout and the basic bot pick. armory requires price 0; blackMarket may name CHOICE_SKIP_OPTION.
 */
export type MechanicChoicePayload =
  | { readonly kind: 'forge'; readonly source: MechanicSource; readonly timeoutOption: string }
  | { readonly kind: 'blackMarket'; readonly grantItem?:boolean; readonly source: MechanicSource; readonly skippable: boolean;
      readonly skipReward: { readonly kind: string; readonly amount: number } | null; readonly timeoutOption: string }
  | { readonly kind: 'armory'; readonly source: MechanicSource; readonly prices: Readonly<Record<string, number>>; readonly timeoutOption: string };

export interface MechanicChoiceSpec {
  readonly choiceId: string;
  readonly offers: readonly string[];
  readonly payload: MechanicChoicePayload;
  /** settlement: opened after combat, combat result kept; preparation: opened before/at preparation. */
  readonly returnPhase: 'preparation' | 'settlement';
}

/** UI-visible match events added by the hooks. */
export type SeatMechanicMatchEvent =
  | { readonly type: 'mechanicGranted'; readonly receipt: MechanicReceipt }
  | { readonly type: 'seatMechanicChanged'; readonly key: string }
  | { readonly type: 'mechanicFailed'; readonly hook: 'rewards' | 'choice' | 'academy'; readonly reason: import('../match-types').MatchFailure };

/** New command failures. Rules map them to MatchFailure; the UI maps them to text. */
export type SeatMechanicFailure =
  | 'unit-not-sellable'       // summon/forge-like unit with `unsellable`
  | 'item-restricted'         // e.g. black market item on a non-Alchemist holder
  | 'choice-not-skippable'    // CHOICE_SKIP_OPTION on a non-skippable choice
  | 'duplicate-mechanic-receipt'
  | 'invalid-mechanic-state';

/** Form-swapper position rule (user decision 2026-10-16): front two deployment rows melee, back two ranged, frozen at combat start. */
export type UnitForm = 'melee' | 'ranged';

/** A pending choice of one of the mechanic kinds; `payload.kind === kind`, step 'offer', generation 0, no target. */
export type MechanicPendingChoice = import('../strategy-types').PendingChoice
  & { readonly kind: MechanicChoiceKind; readonly payload: MechanicChoicePayload; readonly returnPhase: 'preparation' | 'settlement' };

/**
 * Item equip restriction (ItemDefinition.restriction). `trait`: only units whose definition has that trait may hold it,
 * e.g. black market items `{ kind: 'trait', traitId: <Alchemist trait id> }`. Equip on anyone else fails 'item-restricted'.
 */
export type ItemRestriction = { readonly kind: 'trait' | 'exclude-trait'; readonly traitId: string };
