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
