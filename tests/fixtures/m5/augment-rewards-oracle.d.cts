// Structural inputs also admit deliberately incomplete/malformed adversarial vectors.
export interface Gift {
  receiptId: string; source: string; kind: 'unit' | 'item' | 'consumable';
  definitionId: string; starLevel: number; acquiredRound: number;
}
export interface Gold {
  receiptId: string; source: string; kind: 'gold'; amount: number; round: number;
}
export function rewardPlan(state: unknown, environment: unknown): { gifts: Gift[]; gold: Gold[] };
export function tombRaiderPlan(state: unknown, environment: unknown): readonly { choiceId: string; seatId: string; round: number; offers: readonly string[] }[];
export function validateTombRaiderTransition(before: unknown, after: unknown, command: unknown, events: readonly unknown[], environment: unknown): void;
export function r3Opening(input: import('../../../src/simulation/combat-input').CombatStrategyInputs,
  opening: readonly import('../../../src/simulation/combat-types').CombatUnit[]): {
    id: string; ownerId: string; definitionId: string; starLevel: number; cell: { col: number; row: number }; maxHp: number; maxMana: number;
  }[];
export function hallOpening(input: import('../../../src/simulation/combat-input').CombatStrategyInputs,
  original: readonly import('../../../src/simulation/combat-types').CombatUnit[]): {
    id: string; definitionId: string; starLevel: number; cell: { col: number; row: number }; maxHp: number;
  }[];
export function hallDamage(amount: number): number;
export function validateRewards(before: unknown, after: unknown, command: unknown, events: readonly unknown[], environment: unknown): {
  gold: Map<string, Gold>; gifts: Map<string, Gift>; price: number;
};
export function batch5Transforms(before: import('../../../src/simulation/match-types').MatchState, augmentId: string,
  stock: Readonly<Record<string, number>>, costs: Readonly<Record<string, number>>): {
  units: import('../../../src/simulation/unit-types').Unit[]; available: Record<string, number>;
  exchanges: {unitId:string;from:string;to:string;starLevel:number}[];
  upgrades: {survivorId:string;consumedIds:string[];definitionId:string;fromStar:number;toStar:number}[];
};

export interface GhostFriendsGrowth { healthFlat: number; attackDamageBps: number; abilityPower: number }
export function ghostFriendsGrowth(state: unknown): GhostFriendsGrowth | undefined;
export function ghostFriendsDeathReward(death: unknown): GhostFriendsGrowth;
export function rebelCopyStats(base: {health:number;attack:number}, star: number): {starLevel:number;maxHp:number;attackDamage:number};
export function rebelCopyDeaths(events: readonly unknown[], originals: readonly unknown[]): readonly {ownerId:string;team:string;ordinal:number}[];

export function validateGhostCombatInputs(state: unknown): void;

export function aerialWarfareExpected(moves: readonly {from:{col:number;row:number};to:{col:number;row:number}}[], dashes:number): {hexes:number;adBps:number;ap:number};

export function mutationLaboratoryExpected(tier:number, donor:string|null, normalDonors:readonly string[]): {healthFlat:number;values:Record<string,number>};
export function mutationLabsExpected(seed:number,tier:number): {col:number;row:number}[];
