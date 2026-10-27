// Structural inputs also admit deliberately incomplete/malformed adversarial vectors.
export interface Gift {
  receiptId: string; source: string; kind: 'unit' | 'item' | 'consumable';
  definitionId: string; starLevel: number; acquiredRound: number;
}
export interface Gold {
  receiptId: string; source: string; kind: 'gold'; amount: number; round: number;
}
export function rewardPlan(state: unknown, environment: unknown): { gifts: Gift[]; gold: Gold[] };
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
