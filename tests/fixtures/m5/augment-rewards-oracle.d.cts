// Structural inputs also admit deliberately incomplete/malformed adversarial vectors.
export interface Gift {
  receiptId: string; source: string; kind: 'unit' | 'item' | 'consumable';
  definitionId: string; starLevel: number; acquiredRound: number;
}
export interface Gold {
  receiptId: string; source: string; kind: 'gold'; amount: number; round: number;
}
export function rewardPlan(state: unknown, environment: unknown): { gifts: Gift[]; gold: Gold[] };
export function validateRewards(before: unknown, after: unknown, command: unknown, events: readonly unknown[], environment: unknown): {
  gold: Map<string, Gold>; gifts: Map<string, Gift>; price: number;
};

export interface GhostFriendsGrowth { healthFlat: number; attackDamageBps: number; abilityPower: number }
export function ghostFriendsGrowth(state: unknown): GhostFriendsGrowth | undefined;
export function ghostFriendsDeathReward(death: unknown): GhostFriendsGrowth;
export function rebelCopyStats(base: {health:number;attack:number}, star: number): {starLevel:number;maxHp:number;attackDamage:number};
export function rebelCopyDeaths(events: readonly unknown[], originals: readonly unknown[]): readonly {ownerId:string;team:string;ordinal:number}[];

export function validateGhostCombatInputs(state: unknown): void;
